-- =====================================================================
--  Three things about writing to a booking.
--
--  1. O3's row shows "on the way / arrived". No column existed, so the
--     screen had strings and no data. The client sets it; the owner reads it
--     through owner_queue, which already crosses the RLS boundary for them.
--
--  2. "client or owner updates" was declared with USING and no WITH CHECK.
--     Postgres reuses USING as the check for UPDATE, so a client could write
--     ANY column of their own booking. Measured against this schema:
--
--         update bookings set price = 0      -> succeeded
--         update bookings set ticket_no = 1  -> succeeded
--
--     Adding a column the client is meant to write makes that worse, not
--     better, so the guard lands in the same migration.
--
--  3. charge_wash_on_confirm() — the trigger that bills 1 DH per confirmed
--     wash, which is the entire business model — is SECURITY INVOKER and
--     inserts into credit_transactions, a table whose only policy is a
--     SELECT. So confirming a booking failed for every real user:
--
--         ERROR: new row violates row-level security policy
--                for table "credit_transactions"
--
--     C8 could never have worked. The billing trigger needs authority, not
--     the caller's permissions.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Arrival status
-- ---------------------------------------------------------------------
create type arrival_status as enum ('on_the_way', 'arrived');

-- Null means the client has not said. That is a real third state, not a
-- missing value: most people book and simply turn up.
alter table bookings add column arrival arrival_status;

comment on column bookings.arrival is
  'Set by the client from C6, read by the owner through owner_queue. Null = not said.';

-- ---------------------------------------------------------------------
-- 3. Billing needs authority (done before the guard, so the guard's tests
--    exercise a working confirm path)
-- ---------------------------------------------------------------------
create or replace function charge_wash_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee     int;
  v_free    int;
  v_balance int;
begin
  if new.status <> 'confirmed' or old.status = 'confirmed' then
    return new;
  end if;

  select (value #>> '{}')::int into v_fee
    from platform_settings where key = 'wash_fee_centimes';

  select free_washes_left, credit_balance into v_free, v_balance
    from car_washes where id = new.car_wash_id for update;

  if v_free > 0 then
    update car_washes
       set free_washes_left = free_washes_left - 1
     where id = new.car_wash_id;

    insert into credit_transactions
      (car_wash_id, type, amount, balance_after, booking_id, note)
    values (new.car_wash_id, 'bonus', 0, v_balance, new.id, 'free quota');
  else
    update car_washes
       set credit_balance = credit_balance - v_fee
     where id = new.car_wash_id
    returning credit_balance into v_balance;

    insert into credit_transactions
      (car_wash_id, type, amount, balance_after, booking_id)
    values (new.car_wash_id, 'charge', -v_fee, v_balance, new.id);
  end if;

  new.confirmed_at := now();
  return new;
end $$;

comment on function charge_wash_on_confirm() is
  'Bills 1 DH on confirmation. SECURITY DEFINER: RLS on credit_transactions blocks the ledger insert for every ordinary caller.';

-- ---------------------------------------------------------------------
-- 2. What each side may actually write
--
-- The policy decides which rows are visible to an UPDATE. This decides
-- which columns may move, and between which statuses. Splitting it that way
-- keeps the policy readable and puts the transition rules somewhere they can
-- be tested.
-- ---------------------------------------------------------------------
create or replace function guard_booking_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_client boolean;
  v_is_owner  boolean;
begin
  -- No end user in context: cron (auto_confirm_stale_bookings), edge
  -- functions, migrations.
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  -- Nobody but an admin moves these. price and ticket_no in particular:
  -- one is what the client pays, the other is their place in the queue.
  if new.id           is distinct from old.id
  or new.car_wash_id  is distinct from old.car_wash_id
  or new.client_id    is distinct from old.client_id
  or new.service_id   is distinct from old.service_id
  or new.price        is distinct from old.price
  or new.ticket_no    is distinct from old.ticket_no
  or new.created_at   is distinct from old.created_at then
    raise exception 'this column can only be changed by an admin'
      using errcode = 'insufficient_privilege';
  end if;

  v_is_client := old.client_id = auth.uid();
  v_is_owner  := owns_wash(old.car_wash_id);

  -- Arrival is the client's word about themselves.
  if new.arrival is distinct from old.arrival and not v_is_client then
    raise exception 'only the client sets their arrival'
      using errcode = 'insufficient_privilege';
  end if;

  if new.status is distinct from old.status then
    if v_is_client then
      -- C7 cancels; C8 confirms a finished wash. Nothing else.
      if not (
        (old.status = 'pending' and new.status = 'cancelled_client')
        or (old.status = 'done' and new.status = 'confirmed')
      ) then
        raise exception 'a client cannot move a booking from % to %', old.status, new.status
          using errcode = 'insufficient_privilege';
      end if;

    elsif v_is_owner then
      -- O3's four buttons.
      if not (
        (old.status = 'pending' and new.status in ('in_progress', 'no_show', 'cancelled_owner'))
        or (old.status = 'in_progress' and new.status in ('done', 'cancelled_owner'))
      ) then
        raise exception 'an owner cannot move a booking from % to %', old.status, new.status
          using errcode = 'insufficient_privilege';
      end if;

    else
      raise exception 'not your booking'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end $$;

comment on function guard_booking_update() is
  'Column and status-transition rules for bookings. The RLS policy picks the row; this picks what may change in it.';

-- Before charge_wash_on_confirm alphabetically, and BEFORE triggers fire in
-- name order, so the guard runs first and a refused transition never reaches
-- the billing trigger.
create trigger bookings_aa_guard_update
  before update on bookings
  for each row execute function guard_booking_update();

-- ---------------------------------------------------------------------
-- owner_queue gains the arrival column. The return type changes, so this is
-- a drop and recreate.
-- ---------------------------------------------------------------------
drop function if exists owner_queue(uuid);

create function owner_queue(p_wash_id uuid)
returns table (
  booking_id        uuid,
  ticket_no         int,
  status            booking_status,
  arrival           arrival_status,
  price             int,
  created_at        timestamptz,
  started_at        timestamptz,
  service_name      text,
  service_minutes   int,
  client_first_name text,
  client_phone      text,
  vehicle_label     text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id,
         b.ticket_no,
         b.status,
         b.arrival,
         b.price,
         b.created_at,
         b.started_at,
         s.name,
         s.duration_min,
         split_part(p.full_name, ' ', 1),
         p.phone,
         nullif(trim(concat_ws(' ', v.brand, v.model, v.plate)), '')
    from bookings b
    join services s on s.id = b.service_id
    join profiles p on p.id = b.client_id
    left join vehicles v on v.id = b.vehicle_id
   where b.car_wash_id = p_wash_id
     and (owns_wash(p_wash_id) or is_admin())
     and b.created_at >= date_trunc('day', now())
     and b.status in ('pending', 'in_progress', 'done')
   order by b.ticket_no;
$$;

comment on function owner_queue(uuid) is
  'O3. Today''s live queue for one wash, joined to the client and vehicle rows RLS hides from the owner. Checks ownership itself.';

revoke all on function owner_queue(uuid) from public;
grant execute on function owner_queue(uuid) to authenticated;
