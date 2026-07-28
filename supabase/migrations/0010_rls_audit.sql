-- =====================================================================
--  Security audit of 0001 — every table, every policy, every function.
--
--  0001 has one habit that produced all of this: policies written with
--  USING and no WITH CHECK, and functions left SECURITY INVOKER while their
--  bodies read or write rows the caller cannot see. 0003, 0005, 0008 and
--  0009 each fixed one instance when a screen tripped over it. This is the
--  sweep.
--
--  Measured before writing any of the fixes below:
--
--    owner self-approval     status=approved balance=999999
--    ticket numbers          two clients, same wash, both got ticket 1
--    booking price           service costs 5000, booking stored at 1
--
--  What was already sound, for the record: vehicles, device_tokens and
--  services all pair USING with a matching WITH CHECK and scope to the
--  owner; credit_transactions has no write policy at all, which is correct
--  because only the SECURITY DEFINER billing paths may touch the ledger.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. An owner could approve their own wash and mint their own credit.
--
--    "owner manages wash" is FOR ALL with owner_id = auth.uid() on both
--    sides, which reads as reasonable until you notice what lives on that
--    table: `status`, which D2 exists to control, and `credit_balance`,
--    which is the entire business model.
--
--    The policy stays — an owner does manage their wash. A trigger takes
--    away the columns that are not theirs, the same shape as 0003 on
--    profiles and 0008 on bookings.
-- ---------------------------------------------------------------------
-- SECURITY INVOKER, unlike the other guards here, and that is the point: it
-- has to see the *caller's* role. A SECURITY DEFINER function reports
-- current_user as its own owner, so a definer guard could never tell a
-- client's direct write apart from the billing trigger's.
--
-- It needs no elevated rights of its own — it reads OLD and NEW, and
-- is_admin() is already definer.
create or replace function guard_car_wash_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Deliberately current_user, not auth.uid().
  --
  -- charge_wash_on_confirm() and approve_topup() both move credit_balance,
  -- and both are SECURITY DEFINER — which swaps the *role* but leaves the
  -- JWT alone, so auth.uid() inside them is still the client or the admin
  -- who triggered the write. Testing auth.uid() here blocks the billing
  -- trigger, which is how this was caught.
  --
  -- current_user is the honest question: `authenticated` and `anon` mean a
  -- request arrived straight from a person, anything else means it came
  -- through a definer function, a migration, or cron.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if is_admin() then
    return new;
  end if;

  -- D2 approves, D3 suspends. Never the owner.
  if new.status is distinct from old.status then
    raise exception 'a car wash status can only be changed by an admin'
      using errcode = 'insufficient_privilege';
  end if;

  -- Money. Only the billing trigger and approve_topup() move these, and both
  -- are SECURITY DEFINER, so both arrive here with no JWT.
  if new.credit_balance   is distinct from old.credit_balance
  or new.free_washes_left is distinct from old.free_washes_left then
    raise exception 'credit can only be changed by billing or an admin'
      using errcode = 'insufficient_privilege';
  end if;

  -- Cached aggregates. refresh_wash_rating() and refresh_cancel_rates() own
  -- these; an owner editing their own rating would be the end of reviews
  -- meaning anything.
  if new.rating_avg   is distinct from old.rating_avg
  or new.rating_count is distinct from old.rating_count
  or new.cancel_rate  is distinct from old.cancel_rate then
    raise exception 'ratings and cancel rates are maintained by the platform'
      using errcode = 'insufficient_privilege';
  end if;

  -- A wash cannot be handed to somebody else by its owner.
  if new.owner_id is distinct from old.owner_id then
    raise exception 'ownership can only be changed by an admin'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end $$;

comment on function guard_car_wash_update() is
  'Columns on car_washes an owner may not write: status, credit, cached stats, ownership.';

create trigger car_washes_guard_update
  before update on car_washes
  for each row execute function guard_car_wash_update();

-- ---------------------------------------------------------------------
-- 2. Every booking was ticket number 1.
--
--    set_ticket_no() takes max(ticket_no) over the wash's bookings for
--    today. It is SECURITY INVOKER, so under "read own bookings" it only
--    ever saw the inserting client's own rows — max of nothing is 0, so
--    every client got 1. Two clients booking the same wash both walked away
--    holding ticket 1.
--
--    The daily ticket is the thing the client watches on C6 and the owner
--    calls out on O3. Same body, run with authority.
-- ---------------------------------------------------------------------
create or replace function set_ticket_no()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(max(ticket_no), 0) + 1
    into new.ticket_no
    from bookings
   where car_wash_id = new.car_wash_id
     and created_at::date = current_date;
  return new;
end $$;

comment on function set_ticket_no() is
  'Daily per-wash ticket. SECURITY DEFINER: RLS would otherwise hide every other client''s booking and restart the count at 1 for everyone.';

-- ---------------------------------------------------------------------
-- 3. Ratings never updated.
--
--    refresh_wash_rating() updates car_washes, and the person writing a
--    review is a client, not the owner. "owner manages wash" filters the
--    update to zero rows — silently, because an UPDATE that matches nothing
--    is not an error. Every rating_avg stayed at 0.0.
-- ---------------------------------------------------------------------
create or replace function refresh_wash_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update car_washes cw
     set rating_avg   = s.avg_rating,
         rating_count = s.cnt
    from (
      select round(avg(rating), 1) as avg_rating, count(*) as cnt
        from reviews where car_wash_id = new.car_wash_id
    ) s
   where cw.id = new.car_wash_id;
  return new;
end $$;

comment on function refresh_wash_rating() is
  'Rating cache. SECURITY DEFINER: the reviewer is never the wash owner, so RLS silently dropped the update.';

-- ---------------------------------------------------------------------
-- 4. A client could book at a price of their choosing.
--
--    "client creates booking" checks client_id = auth.uid() and nothing
--    else, so price, status and arrival were all free text on the way in.
--    0008 guards UPDATEs; this guards the way in.
--
--    Every value here is derivable from the service, so none of them needs
--    to be trusted from the client at all.
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
begin
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  -- A booking starts pending and unremarked. C6 sets arrival afterwards.
  if new.status <> 'pending' then
    raise exception 'a new booking starts pending'
      using errcode = 'insufficient_privilege';
  end if;
  if new.arrival is not null then
    raise exception 'arrival is set after booking, not during'
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

  -- The service has to belong to the wash being booked, or the price and
  -- the queue would come from different businesses.
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

  -- Not "must match" — just taken. The price list is the price.
  new.price := v_service_price;

  return new;
end $$;

comment on function guard_booking_insert() is
  'Derives price from the service and pins status on insert. The client supplies which service, nothing else.';

-- Fires before set_ticket_no by name, which does not matter to either, but
-- keeps the ordering explicit.
create trigger bookings_aa_guard_insert
  before insert on bookings
  for each row execute function guard_booking_insert();

-- ---------------------------------------------------------------------
-- 5. Reviews were attached to any booking, in any state.
--
--    "client writes review" checked only that client_id = auth.uid(), so a
--    client could review a wash from a booking that was cancelled, never
--    happened, or belonged to a different wash entirely. C8 writes a review
--    after confirming, and that is the only moment one should exist.
-- ---------------------------------------------------------------------
drop policy "client writes review" on reviews;

create policy "client writes review" on reviews for insert
  with check (
    client_id = auth.uid()
    and exists (
      select 1 from bookings b
       where b.id = reviews.booking_id
         and b.client_id = auth.uid()
         and b.car_wash_id = reviews.car_wash_id
         and b.status = 'confirmed'
    )
  );
