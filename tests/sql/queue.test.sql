-- =====================================================================
--  queue_state(), now_serving(), my_queue_position() — 0005.
--
--  The regression these exist for: queue_state() was SECURITY INVOKER, so
--  RLS on bookings reduced "how many cars are queued here" to "how many of
--  them are mine". Clients saw a fraction of the real wait and signed-out
--  visitors saw zero, which renders as a green "free" dot on C1.
--
--  So every assertion below runs as an ordinary end user, not as the table
--  owner. Running these as the owner would pass against the broken version.
-- =====================================================================
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('a1000000-0000-0000-0000-0000000000a1'),   -- owner
  ('c1000000-0000-0000-0000-0000000000c1'),   -- client one
  ('c2000000-0000-0000-0000-0000000000c2'),   -- client two
  ('c3000000-0000-0000-0000-0000000000c3');   -- client three

insert into profiles (id, role, full_name) values
  ('a1000000-0000-0000-0000-0000000000a1', 'owner',  'Queue Owner'),
  ('c1000000-0000-0000-0000-0000000000c1', 'client', 'First'),
  ('c2000000-0000-0000-0000-0000000000c2', 'client', 'Second'),
  ('c3000000-0000-0000-0000-0000000000c3', 'client', 'Third');

insert into car_washes
  (id, owner_id, name, address, city, location, status,
   is_open_now, opens_at, closes_at, credit_balance, bays_count)
values
  ('11110000-0000-0000-0000-000000001111', 'a1000000-0000-0000-0000-0000000000a1',
   'Queue Test', 'addr', 'Casablanca',
   st_setsrid(st_makepoint(-7.5898, 33.5749), 4326)::geography,
   'approved', true, '00:00', '23:59', 5000, 1);

insert into services (id, car_wash_id, name, price, duration_min, is_active)
values ('22220000-0000-0000-0000-000000002222',
        '11110000-0000-0000-0000-000000001111', 'Complet', 3000, 20, true);

-- Three cars, queued in order, from three different clients. The first is
-- already on the ramp.
insert into bookings (id, car_wash_id, client_id, service_id, status, price, created_at, started_at)
values
  ('b1000000-0000-0000-0000-0000000000b1', '11110000-0000-0000-0000-000000001111',
   'c1000000-0000-0000-0000-0000000000c1', '22220000-0000-0000-0000-000000002222',
   'in_progress', 3000, now() - interval '30 minutes', now() - interval '5 minutes'),
  ('b2000000-0000-0000-0000-0000000000b2', '11110000-0000-0000-0000-000000001111',
   'c2000000-0000-0000-0000-0000000000c2', '22220000-0000-0000-0000-000000002222',
   'pending', 3000, now() - interval '20 minutes', null),
  ('b3000000-0000-0000-0000-0000000000b3', '11110000-0000-0000-0000-000000001111',
   'c3000000-0000-0000-0000-0000000000c3', '22220000-0000-0000-0000-000000002222',
   'pending', 3000, now() - interval '10 minutes', null);

-- =====================================================================
--  As a signed-in client who owns exactly one of those three bookings.
-- =====================================================================
set role authenticated;
set request.jwt.claim.sub = 'c3000000-0000-0000-0000-0000000000c3';

do $$
declare
  r record;
begin
  select * into r from queue_state('11110000-0000-0000-0000-000000001111');

  -- Before 0005 this returned 1: the caller's own booking and nothing else.
  if r.cars_ahead <> 3 then
    raise exception 'FAIL 0005: queue_state saw % cars, expected 3 — RLS is still shrinking the count',
      r.cars_ahead;
  end if;

  if r.wait_minutes <> 60 then
    raise exception 'FAIL 0005: wait_minutes is %, expected 60 (3 cars / 1 bay * 20 min)',
      r.wait_minutes;
  end if;
end $$;

do $$
begin
  -- Another client's ticket, which is exactly what C6 has to display.
  if now_serving('11110000-0000-0000-0000-000000001111') is null then
    raise exception 'FAIL 0005: now_serving returned null while a wash was in progress';
  end if;
end $$;

do $$
declare
  r record;
begin
  select * into r from my_queue_position('b3000000-0000-0000-0000-0000000000b3');

  -- Two cars were booked before this one.
  if r.cars_ahead <> 2 then
    raise exception 'FAIL 0005: my_queue_position says % cars ahead, expected 2', r.cars_ahead;
  end if;

  if r.now_serving is null then
    raise exception 'FAIL 0005: my_queue_position lost now_serving';
  end if;
end $$;

do $$
begin
  -- SECURITY DEFINER bypasses RLS, so the ownership check has to be its own.
  if exists (select 1 from my_queue_position('b2000000-0000-0000-0000-0000000000b2')) then
    raise exception 'FAIL 0005: my_queue_position leaked another client''s position';
  end if;
end $$;

-- =====================================================================
--  As a signed-out visitor. C1 is browsable before signing in, and this is
--  the case that reported a flat zero.
-- =====================================================================
reset role;
reset request.jwt.claim.sub;
set role anon;

do $$
declare
  r record;
begin
  select * into r from nearby_car_washes(33.5731, -7.5898, 10000)
   where id = '11110000-0000-0000-0000-000000001111';

  if r.cars_ahead <> 3 then
    raise exception 'FAIL 0005: a signed-out visitor saw % cars, expected 3', r.cars_ahead;
  end if;

  if r.wait_minutes <> 60 then
    raise exception 'FAIL 0005: a signed-out visitor saw a % minute wait, expected 60',
      r.wait_minutes;
  end if;
end $$;

reset role;

\echo 'All queue_state assertions passed.'
