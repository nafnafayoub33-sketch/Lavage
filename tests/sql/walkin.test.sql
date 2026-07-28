-- =====================================================================
--  Walk-ins — 0011.
--
--  One assertion per thing the plan said this would break, plus the pieces
--  it said would not, because "walk-ins count in queue_state for free" is
--  worth pinning down rather than believing.
-- =====================================================================
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('11100000-0000-0000-0000-000000000111'),   -- owner
  ('22200000-0000-0000-0000-000000000222'),   -- an app client
  ('33300000-0000-0000-0000-000000000333');   -- a different owner

insert into profiles (id, role, full_name, phone) values
  ('11100000-0000-0000-0000-000000000111', 'owner',  'Walkin Owner', '+212660000001'),
  ('22200000-0000-0000-0000-000000000222', 'client', 'App Client',   '+212660000002'),
  ('33300000-0000-0000-0000-000000000333', 'owner',  'Rival Owner',  '+212660000003');

insert into car_washes
  (id, owner_id, name, address, city, location, status,
   is_open_now, opens_at, closes_at, credit_balance, free_washes_left, bays_count)
values
  ('44400000-0000-0000-0000-000000000444', '11100000-0000-0000-0000-000000000111',
   'Walkin Wash', 'addr', 'Casablanca',
   st_setsrid(st_makepoint(-7.5898, 33.5749), 4326)::geography,
   'approved', true, '00:00', '23:59', 5000, 0, 1);

insert into services (id, car_wash_id, name, price, duration_min, is_active)
values ('55500000-0000-0000-0000-000000000555',
        '44400000-0000-0000-0000-000000000444', 'Complet', 4000, 20, true);

-- =====================================================================
--  The constraint: exactly one of the two
-- =====================================================================
do $$
begin
  begin
    insert into bookings (car_wash_id, client_id, walkin_label, service_id, status, price)
    values ('44400000-0000-0000-0000-000000000444', '22200000-0000-0000-0000-000000000222',
            'both at once', '55500000-0000-0000-0000-000000000555', 'pending', 4000);
    raise exception 'FAIL 0011: a booking had both a client and a walk-in label';
  exception when check_violation then null;
  end;
end $$;

do $$
begin
  begin
    insert into bookings (car_wash_id, service_id, status, price)
    values ('44400000-0000-0000-0000-000000000444',
            '55500000-0000-0000-0000-000000000555', 'pending', 4000);
    raise exception 'FAIL 0011: a booking had neither a client nor a label';
  exception when check_violation then null;
  end;
end $$;

-- =====================================================================
--  Only the wash adds a walk-in
-- =====================================================================
set role authenticated;
set request.jwt.claim.sub = '22200000-0000-0000-0000-000000000222';

do $$
begin
  begin
    insert into bookings (car_wash_id, walkin_label, service_id, status, price)
    values ('44400000-0000-0000-0000-000000000444', 'Ghost',
            '55500000-0000-0000-0000-000000000555', 'pending', 4000);
    raise exception 'FAIL 0011: a client filed a walk-in';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role; set role authenticated;
set request.jwt.claim.sub = '33300000-0000-0000-0000-000000000333';

do $$
begin
  begin
    insert into bookings (car_wash_id, walkin_label, service_id, status, price)
    values ('44400000-0000-0000-0000-000000000444', 'Rival''s walk-in',
            '55500000-0000-0000-0000-000000000555', 'pending', 4000);
    raise exception 'FAIL 0011: a rival owner added a walk-in to somebody else''s queue';
  exception when insufficient_privilege then null;
  end;
end $$;

-- =====================================================================
--  Walk-ins share the queue with app bookings
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = '22200000-0000-0000-0000-000000000222';

insert into bookings (id, car_wash_id, client_id, service_id, status, price)
values ('66600000-0000-0000-0000-000000000666', '44400000-0000-0000-0000-000000000444',
        '22200000-0000-0000-0000-000000000222', '55500000-0000-0000-0000-000000000555',
        'pending', 4000);

reset role; set role authenticated;
set request.jwt.claim.sub = '11100000-0000-0000-0000-000000000111';

insert into bookings (id, car_wash_id, walkin_label, service_id, status, price)
values ('77700000-0000-0000-0000-000000000777', '44400000-0000-0000-0000-000000000444',
        'Red Clio', '55500000-0000-0000-0000-000000000555', 'pending', 999);

-- A second walk-in: the one-active-booking index must not treat two NULL
-- client_ids as a collision.
insert into bookings (id, car_wash_id, walkin_label, service_id, status, price)
values ('88800000-0000-0000-0000-000000000888', '44400000-0000-0000-0000-000000000444',
        'Blue Dacia', '55500000-0000-0000-0000-000000000555', 'pending', 4000);

do $$
declare
  r record;
begin
  select * into r from bookings where id = '77700000-0000-0000-0000-000000000777';

  -- The guard takes the price from the price list, not from whatever the
  -- caller sent — 999 above was ignored.
  if r.price <> 4000 then
    raise exception 'FAIL 0011: a walk-in was booked at %, expected the list price', r.price;
  end if;

  -- Arrival-only: they are standing there.
  if r.arrival is distinct from 'arrived'::arrival_status then
    raise exception 'FAIL 0011: a walk-in was not marked arrived (%)', r.arrival;
  end if;
  if r.estimated_at is not null then
    raise exception 'FAIL 0011: a walk-in was given a future time';
  end if;
end $$;

do $$
declare
  v_tickets int[];
begin
  select array_agg(ticket_no order by ticket_no) into v_tickets
    from bookings where car_wash_id = '44400000-0000-0000-0000-000000000444';

  -- One app booking and two walk-ins, sharing one sequence.
  if v_tickets <> array[1, 2, 3] then
    raise exception 'FAIL 0011: tickets are %, expected one shared run 1,2,3', v_tickets;
  end if;
end $$;

do $$
declare
  r record;
begin
  select * into r from queue_state('44400000-0000-0000-0000-000000000444');

  -- The plan said queue_state needs no change because it never looks at
  -- client_id. This is that claim, pinned down.
  if r.cars_ahead <> 3 then
    raise exception 'FAIL 0011: queue_state counted % cars, expected 3 including the walk-ins',
      r.cars_ahead;
  end if;
end $$;

-- =====================================================================
--  The board shows them — this is the inner join that dropped them
-- =====================================================================
do $$
declare
  v_rows int;
  r record;
begin
  select count(*)::int into v_rows from owner_queue('44400000-0000-0000-0000-000000000444');

  if v_rows <> 3 then
    raise exception 'FAIL 0011: the board shows % rows, expected 3 — walk-ins were dropped by the join',
      v_rows;
  end if;

  select * into r from owner_queue('44400000-0000-0000-0000-000000000444')
   where booking_id = '77700000-0000-0000-0000-000000000777';

  if r.walkin_label <> 'Red Clio' then
    raise exception 'FAIL 0011: the walk-in label did not reach the board';
  end if;
  if r.client_first_name is not null or r.client_phone is not null then
    raise exception 'FAIL 0011: a walk-in came back with client details attached';
  end if;

  -- The app booking still carries its client, unmasked.
  select * into r from owner_queue('44400000-0000-0000-0000-000000000444')
   where booking_id = '66600000-0000-0000-0000-000000000666';

  if r.client_first_name <> 'App' then
    raise exception 'FAIL 0011: the app booking lost its client';
  end if;
  if r.client_phone <> '+212660000002' then
    raise exception 'FAIL 0011: the phone is not the real number (%)', r.client_phone;
  end if;
end $$;

-- =====================================================================
--  A walk-in has no client, so no client can reach it
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = '22200000-0000-0000-0000-000000000222';

do $$
begin
  if exists (select 1 from bookings where id = '77700000-0000-0000-0000-000000000777') then
    raise exception 'FAIL 0011: a client can read the wash''s walk-ins';
  end if;

  if exists (select 1 from my_queue_position('77700000-0000-0000-0000-000000000777')) then
    raise exception 'FAIL 0011: my_queue_position answered for a walk-in';
  end if;
end $$;

-- =====================================================================
--  The owner drives it end to end, and confirms it themselves
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = '11100000-0000-0000-0000-000000000111';

update bookings set status = 'in_progress', started_at = now()
 where id = '77700000-0000-0000-0000-000000000777';
update bookings set status = 'done', finished_at = now()
 where id = '77700000-0000-0000-0000-000000000777';

-- Walk the app booking to done outside any exception block: a DO block that
-- catches rolls back everything inside it, which would leave this booking
-- pending and break the confirm below.
update bookings set status = 'in_progress', started_at = now()
 where id = '66600000-0000-0000-0000-000000000666';
update bookings set status = 'done', finished_at = now()
 where id = '66600000-0000-0000-0000-000000000666';

do $$
begin
  begin
    -- The same move on an app booking stays the client's.
    update bookings set status = 'confirmed'
     where id = '66600000-0000-0000-0000-000000000666';
    raise exception 'FAIL 0011: an owner confirmed an app booking on the client''s behalf';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Nobody else can confirm a walk-in, so the owner does.
update bookings set status = 'confirmed'
 where id = '77700000-0000-0000-0000-000000000777';

reset role;
reset request.jwt.claim.sub;

do $$
declare
  v_free int;
begin
  select free_washes_left into v_free
    from car_washes where id = '44400000-0000-0000-0000-000000000444';

  -- Quota was 0, so this billed rather than consuming a free wash.
  if (select credit_balance from car_washes where id = '44400000-0000-0000-0000-000000000444')
     <> 4950 then
    raise exception 'FAIL 0011: balance is %, expected 5000 less the 50 centime walk-in rate',
      (select credit_balance from car_washes where id = '44400000-0000-0000-0000-000000000444');
  end if;

  if not exists (
    select 1 from credit_transactions
     where booking_id = '77700000-0000-0000-0000-000000000777'
       and type = 'charge' and amount = -50
  ) then
    raise exception 'FAIL 0011: the walk-in was not billed at the walk-in rate';
  end if;
end $$;

-- =====================================================================
--  The two rates are genuinely separate
-- =====================================================================
do $$
declare
  v_app    int;
  v_walkin int;
begin
  select (value #>> '{}')::int into v_app    from platform_settings where key = 'wash_fee_centimes';
  select (value #>> '{}')::int into v_walkin from platform_settings where key = 'walkin_fee_centimes';

  if v_app <> 100 then
    raise exception 'FAIL 0011: the app rate is %, expected 100', v_app;
  end if;
  if v_walkin <> 50 then
    raise exception 'FAIL 0011: the walk-in rate is %, expected 50', v_walkin;
  end if;
end $$;

-- And an app booking still bills at the app rate.
set role authenticated;
set request.jwt.claim.sub = '22200000-0000-0000-0000-000000000222';
update bookings set status = 'confirmed' where id = '66600000-0000-0000-0000-000000000666';
reset role;
reset request.jwt.claim.sub;

do $$
begin
  if not exists (
    select 1 from credit_transactions
     where booking_id = '66600000-0000-0000-0000-000000000666'
       and type = 'charge' and amount = -100
  ) then
    raise exception 'FAIL 0011: the app booking was not billed at the app rate';
  end if;
end $$;

-- =====================================================================
--  A walk-in cannot be reviewed — there is nobody to review it
-- =====================================================================
set role authenticated;
set request.jwt.claim.sub = '22200000-0000-0000-0000-000000000222';

do $$
begin
  begin
    insert into reviews (booking_id, car_wash_id, client_id, rating)
    values ('77700000-0000-0000-0000-000000000777', '44400000-0000-0000-0000-000000000444',
            '22200000-0000-0000-0000-000000000222', 5);
    raise exception 'FAIL 0011: a client reviewed a walk-in they had nothing to do with';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
reset request.jwt.claim.sub;

\echo 'All walk-in assertions passed.'
