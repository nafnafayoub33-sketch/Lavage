-- =====================================================================
--  owner_queue() — 0007.
--
--  This function exists because RLS hides the client and the vehicle from
--  the owner, and it is SECURITY DEFINER, which means the ownership check is
--  its own responsibility. The assertion that matters most is the negative
--  one: a different owner must get nothing.
-- =====================================================================
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('01000000-0000-0000-0000-000000000001'),   -- owner of the wash under test
  ('02000000-0000-0000-0000-000000000002'),   -- a completely different owner
  ('03000000-0000-0000-0000-000000000003');   -- the client

insert into profiles (id, role, full_name, phone) values
  ('01000000-0000-0000-0000-000000000001', 'owner',  'Ours Owner',    '+212600000001'),
  ('02000000-0000-0000-0000-000000000002', 'owner',  'Rival Owner',   '+212600000002'),
  ('03000000-0000-0000-0000-000000000003', 'client', 'Youssef Alami', '+212612345678');

insert into car_washes
  (id, owner_id, name, address, city, location, status,
   is_open_now, opens_at, closes_at, credit_balance, bays_count)
values
  ('0a000000-0000-0000-0000-00000000000a', '01000000-0000-0000-0000-000000000001',
   'Ours', 'addr', 'Casablanca',
   st_setsrid(st_makepoint(-7.5898, 33.5749), 4326)::geography,
   'approved', true, '00:00', '23:59', 5000, 2),
  ('0b000000-0000-0000-0000-00000000000b', '02000000-0000-0000-0000-000000000002',
   'Theirs', 'addr', 'Casablanca',
   st_setsrid(st_makepoint(-7.5900, 33.5750), 4326)::geography,
   'approved', true, '00:00', '23:59', 5000, 1);

insert into services (id, car_wash_id, name, price, duration_min, is_active)
values ('0c000000-0000-0000-0000-00000000000c',
        '0a000000-0000-0000-0000-00000000000a', 'Complet', 4000, 25, true);

insert into vehicles (id, client_id, brand, model, plate)
values ('0d000000-0000-0000-0000-00000000000d',
        '03000000-0000-0000-0000-000000000003', 'Dacia', 'Logan', '1234-A-56');

insert into bookings (id, car_wash_id, client_id, vehicle_id, service_id, status, price)
values ('0e000000-0000-0000-0000-00000000000e',
        '0a000000-0000-0000-0000-00000000000a',
        '03000000-0000-0000-0000-000000000003',
        '0d000000-0000-0000-0000-00000000000d',
        '0c000000-0000-0000-0000-00000000000c', 'pending', 4000);

-- =====================================================================
--  The owner of this wash.
-- =====================================================================
set role authenticated;
set request.jwt.claim.sub = '01000000-0000-0000-0000-000000000001';

do $$
declare
  r record;
begin
  select * into r from owner_queue('0a000000-0000-0000-0000-00000000000a');

  if r is null then
    raise exception 'FAIL 0007: the owner got an empty board for their own wash';
  end if;

  -- Everything below is a row RLS refuses the owner directly.
  if r.client_first_name <> 'Youssef' then
    raise exception 'FAIL 0007: client_first_name is %, expected the first name only', r.client_first_name;
  end if;

  if r.client_phone is null then
    raise exception 'FAIL 0007: no phone, so the Call action cannot work';
  end if;

  if r.vehicle_label is null or r.vehicle_label not like '%Logan%' then
    raise exception 'FAIL 0007: vehicle_label is %, expected the car', r.vehicle_label;
  end if;

  if r.service_name <> 'Complet' or r.service_minutes <> 25 then
    raise exception 'FAIL 0007: the service did not come through';
  end if;
end $$;

do $$
begin
  -- Sanity: the owner genuinely cannot reach these tables directly, which is
  -- the whole reason the function exists.
  if exists (select 1 from profiles where id = '03000000-0000-0000-0000-000000000003') then
    raise exception 'FAIL 0007: RLS let an owner read a client profile directly';
  end if;

  if exists (select 1 from vehicles where id = '0d000000-0000-0000-0000-00000000000d') then
    raise exception 'FAIL 0007: RLS let an owner read a client vehicle directly';
  end if;
end $$;

-- =====================================================================
--  A different owner. SECURITY DEFINER bypasses RLS, so this is the check
--  that stands between one business and another's customer list.
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = '02000000-0000-0000-0000-000000000002';

do $$
begin
  if exists (select 1 from owner_queue('0a000000-0000-0000-0000-00000000000a')) then
    raise exception 'FAIL 0007: a rival owner read another wash''s customers';
  end if;
end $$;

-- =====================================================================
--  The client themselves is not an owner of anything.
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = '03000000-0000-0000-0000-000000000003';

do $$
begin
  if exists (select 1 from owner_queue('0a000000-0000-0000-0000-00000000000a')) then
    raise exception 'FAIL 0007: a client read the owner board';
  end if;
end $$;

-- =====================================================================
--  The owner drives the board: start, then finish.
--  These go through ordinary RLS ("client or owner updates"), not the RPC.
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = '01000000-0000-0000-0000-000000000001';

update bookings set status = 'in_progress', started_at = now()
 where id = '0e000000-0000-0000-0000-00000000000e';

do $$
declare
  r record;
begin
  select * into r from owner_queue('0a000000-0000-0000-0000-00000000000a');
  if r.status <> 'in_progress' then
    raise exception 'FAIL 0007: Start did not take — status is %', r.status;
  end if;
  if r.started_at is null then
    raise exception 'FAIL 0007: started_at was not recorded, so "started N min ago" cannot render';
  end if;
end $$;

-- The owner closes for the day. This is an ordinary wash update.
update car_washes set is_open_now = false
 where id = '0a000000-0000-0000-0000-00000000000a';

do $$
begin
  if (select is_open_now from car_washes where id = '0a000000-0000-0000-0000-00000000000a') then
    raise exception 'FAIL 0007: the closed-today switch did not take';
  end if;
end $$;

do $$
begin
  -- ... and a rival owner cannot close it for them.
  perform set_config('request.jwt.claim.sub', '02000000-0000-0000-0000-000000000002', true);
  update car_washes set is_open_now = true
   where id = '0a000000-0000-0000-0000-00000000000a';

  if (select is_open_now from car_washes where id = '0a000000-0000-0000-0000-00000000000a') then
    raise exception 'FAIL 0007: a rival owner reopened somebody else''s wash';
  end if;
end $$;

reset role;
reset request.jwt.claim.sub;

\echo 'All owner_queue assertions passed.'
