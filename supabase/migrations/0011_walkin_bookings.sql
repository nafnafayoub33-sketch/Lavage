-- =====================================================================
--  Walk-ins.
--
--  Someone with no app arrives at the wash. The owner adds them in one tap,
--  or the board on O3 stops matching the cars actually queued outside — and
--  a board that disagrees with the forecourt is worse than no board.
--
--  A walk-in is an ordinary booking with no client attached. It takes a
--  ticket, occupies a queue position, and bills the wash, all exactly like an
--  app booking. What it does not have is somebody to notify, to charge, or to
--  ask for a rating.
--
--  What this had to change, and why, is written against each part below.
--  What it did NOT have to change is worth recording too: queue_state(),
--  now_serving(), set_ticket_no(), refresh_queue_event() and
--  nearby_car_washes() all work off car_wash_id and status and never look at
--  client_id, so walk-ins count in every one of them for free. The
--  bookings_one_active_per_client index also needs nothing: a unique index
--  treats NULLs as distinct, so any number of walk-ins coexist.
-- =====================================================================

alter table bookings alter column client_id drop not null;

-- Free text: a first name, a plate, "the red Clio". Whatever the owner will
-- recognise when they call it out.
alter table bookings add column walkin_label text;

-- Exactly one of the two. A booking belongs to a person with an account or
-- to a label on a board, never both and never neither.
alter table bookings add constraint bookings_client_xor_walkin
  check ((client_id is null) <> (walkin_label is null));

comment on column bookings.walkin_label is
  'Set for walk-ins instead of client_id. Exactly one of the two is present.';

-- ---------------------------------------------------------------------
-- Two rates, both admin-editable.
--
-- wash_fee_centimes keeps its name and meaning — it is referenced in
-- CLAUDE.md and ARCHITECTURE.md as the app-booking rate — and the walk-in
-- rate joins it. 0009 already gives admins write access and everyone read
-- access to this table, so D9 picks both up with no further work.
-- ---------------------------------------------------------------------
insert into platform_settings (key, value) values ('walkin_fee_centimes', '50')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Who may create one.
--
-- "client creates booking" checks client_id = auth.uid(). For a walk-in that
-- is NULL = auth.uid(), which is NULL, which is not true — so the existing
-- policy refuses every walk-in. The owner needs their own way in.
-- ---------------------------------------------------------------------
create policy "owner adds walkin" on bookings for insert
  with check (
    owns_wash(car_wash_id)
    and client_id is null
    and walkin_label is not null
  );

-- ---------------------------------------------------------------------
-- The insert guard.
--
-- 0010's version assumed a client was inserting their own booking. It
-- required arrival to be null, which is wrong for someone standing at the
-- counter, and it never checked who was inserting what — a client could have
-- filed a walk-in at a wash they had nothing to do with.
-- ---------------------------------------------------------------------
create or replace function guard_booking_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service_price int;
  v_service_wash  uuid;
  v_service_live  boolean;
  v_wash_status   wash_status;
  v_is_walkin     boolean;
begin
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  v_is_walkin := new.client_id is null;

  if v_is_walkin then
    -- Only the wash can add someone standing in front of it.
    if not owns_wash(new.car_wash_id) then
      raise exception 'only the car wash can add a walk-in'
        using errcode = 'insufficient_privilege';
    end if;

    -- Arrival-only by definition: they are here. No future bookings, no
    -- advance slots — the label goes on the board at the moment they arrive.
    new.arrival := 'arrived';
    new.estimated_at := null;
  else
    -- An app booking is the client's own, and they have not arrived yet.
    if new.client_id <> auth.uid() then
      raise exception 'a booking belongs to the client who made it'
        using errcode = 'insufficient_privilege';
    end if;
    if new.arrival is not null then
      raise exception 'arrival is set after booking, not during'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if new.status <> 'pending' then
    raise exception 'a new booking starts pending'
      using errcode = 'insufficient_privilege';
  end if;

  select s.price, s.car_wash_id, s.is_active, cw.status
    into v_service_price, v_service_wash, v_service_live, v_wash_status
    from services s
    join car_washes cw on cw.id = s.car_wash_id
   where s.id = new.service_id;

  if v_service_price is null then
    raise exception 'no such service';
  end if;

  if v_service_wash is distinct from new.car_wash_id then
    raise exception 'that service belongs to a different car wash'
      using errcode = 'insufficient_privilege';
  end if;

  if not v_service_live then
    raise exception 'that service is not on sale'
      using errcode = 'insufficient_privilege';
  end if;

  if v_wash_status <> 'approved' then
    raise exception 'that car wash is not open for business'
      using errcode = 'insufficient_privilege';
  end if;

  new.price := v_service_price;

  return new;
end $$;

-- ---------------------------------------------------------------------
-- The update guard.
--
-- The client branch was already unreachable for walk-ins, since
-- old.client_id = auth.uid() is NULL when there is no client. That left
-- nobody able to confirm one: confirming is the client's transition, so a
-- finished walk-in would sit at `done` until the two-hour cron swept it up,
-- billing late and cluttering the board in the meantime.
--
-- The owner watched the wash happen and there is no one else to ask, so for
-- walk-ins only, the owner may confirm.
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
  v_is_walkin boolean;
begin
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  if new.id           is distinct from old.id
  or new.car_wash_id  is distinct from old.car_wash_id
  or new.client_id    is distinct from old.client_id
  or new.walkin_label is distinct from old.walkin_label
  or new.service_id   is distinct from old.service_id
  or new.price        is distinct from old.price
  or new.ticket_no    is distinct from old.ticket_no
  or new.created_at   is distinct from old.created_at then
    raise exception 'this column can only be changed by an admin'
      using errcode = 'insufficient_privilege';
  end if;

  v_is_walkin := old.client_id is null;
  -- NULL = auth.uid() is NULL, so this is false for a walk-in, which is
  -- correct: there is no client to be.
  v_is_client := old.client_id = auth.uid();
  v_is_owner  := owns_wash(old.car_wash_id);

  if new.arrival is distinct from old.arrival and not v_is_client then
    raise exception 'only the client sets their arrival'
      using errcode = 'insufficient_privilege';
  end if;

  if new.status is distinct from old.status then
    if v_is_client then
      if not (
        (old.status = 'pending' and new.status = 'cancelled_client')
        or (old.status = 'done' and new.status = 'confirmed')
      ) then
        raise exception 'a client cannot move a booking from % to %', old.status, new.status
          using errcode = 'insufficient_privilege';
      end if;

    elsif v_is_owner then
      if not (
        (old.status = 'pending' and new.status in ('in_progress', 'no_show', 'cancelled_owner'))
        or (old.status = 'in_progress' and new.status in ('done', 'cancelled_owner'))
        -- Walk-ins only. On an app booking this stays the client's call.
        or (v_is_walkin and old.status = 'done' and new.status = 'confirmed')
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

-- ---------------------------------------------------------------------
-- Billing picks its rate.
--
-- The free quota is spent first either way: it is counted in washes, not in
-- money, and 100 free washes is a welcome gift rather than precise
-- accounting.
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
  v_key     text;
begin
  if new.status <> 'confirmed' or old.status = 'confirmed' then
    return new;
  end if;

  v_key := case when new.client_id is null
                then 'walkin_fee_centimes'
                else 'wash_fee_centimes'
           end;

  select (value #>> '{}')::int into v_fee
    from platform_settings where key = v_key;

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
      (car_wash_id, type, amount, balance_after, booking_id, note)
    values (new.car_wash_id, 'charge', -v_fee, v_balance, new.id,
            case when new.client_id is null then 'walk-in' else null end);
  end if;

  new.confirmed_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- The owner's board.
--
-- `join profiles p on p.id = b.client_id` is an inner join, so a walk-in —
-- whose client_id is NULL — was dropped from the result entirely. The board
-- would have shown every app booking and none of the walk-ins, which is the
-- exact failure this feature exists to prevent.
--
-- Left join now, with walkin_label alongside. The phone comes back unmasked
-- on both sides; see docs/SCREENS.md O4.
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
  walkin_label      text,
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
         -- Null for a walk-in; the label carries the name instead.
         split_part(p.full_name, ' ', 1),
         p.phone,
         b.walkin_label,
         nullif(trim(concat_ws(' ', v.brand, v.model, v.plate)), '')
    from bookings b
    join services s on s.id = b.service_id
    left join profiles p on p.id = b.client_id
    left join vehicles v on v.id = b.vehicle_id
   where b.car_wash_id = p_wash_id
     and (owns_wash(p_wash_id) or is_admin())
     and b.created_at >= date_trunc('day', now())
     and b.status in ('pending', 'in_progress', 'done')
   order by b.ticket_no;
$$;

comment on function owner_queue(uuid) is
  'O3. Today''s live queue, app bookings and walk-ins alike. LEFT JOIN on profiles: a walk-in has no client.';

revoke all on function owner_queue(uuid) from public;
grant execute on function owner_queue(uuid) to authenticated;
