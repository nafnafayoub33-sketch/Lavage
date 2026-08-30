-- =====================================================================
--  Registration and storage — 0013 and 0014.
--
--  The headline assertion is the first one. Before 0014 an owner could
--  INSERT a car wash that was already approved, funded and five-star, and it
--  reached clients immediately. That is the whole of D2 bypassed by one
--  statement from an ordinary session.
-- =====================================================================
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('b0000000-0000-0000-0000-0000000000b0'),   -- owner
  ('b1000000-0000-0000-0000-0000000000b1'),   -- a second owner
  ('b2000000-0000-0000-0000-0000000000b2'),   -- client
  ('b3000000-0000-0000-0000-0000000000b3');   -- admin

insert into profiles (id, role, full_name, phone) values
  ('b0000000-0000-0000-0000-0000000000b0', 'owner',  'Reg Owner',  '+212696000001'),
  ('b1000000-0000-0000-0000-0000000000b1', 'owner',  'Other Reg',  '+212696000002'),
  ('b2000000-0000-0000-0000-0000000000b2', 'client', 'Reg Client', '+212696000003'),
  ('b3000000-0000-0000-0000-0000000000b3', 'admin',  'Reg Admin',  '+212696000004');

-- =====================================================================
--  The hole 0014 closes.
-- =====================================================================
set role authenticated;
set request.jwt.claim.sub = 'b0000000-0000-0000-0000-0000000000b0';

do $$
declare
  r record;
begin
  insert into car_washes
    (owner_id, name, address, city, location, status,
     credit_balance, free_washes_left, rating_avg, rating_count)
  values
    ('b0000000-0000-0000-0000-0000000000b0', 'Self Approved', 'addr', 'Casablanca',
     st_setsrid(st_makepoint(-7.5898, 33.5749), 4326)::geography,
     'approved', 9999999, 9999, 5.0, 4000)
  returning * into r;

  if r.status <> 'pending' then
    raise exception 'FAIL 0014: an owner registered themselves %, not pending', r.status;
  end if;

  if r.credit_balance <> 0 then
    raise exception 'FAIL 0014: an owner funded themselves % centimes', r.credit_balance;
  end if;

  if r.rating_avg <> 0 or r.rating_count <> 0 then
    raise exception 'FAIL 0014: an owner arrived with % reviews', r.rating_count;
  end if;

  if r.free_washes_left <> 100 then
    raise exception 'FAIL 0014: the welcome quota is %, expected the platform setting',
      r.free_washes_left;
  end if;
end $$;

-- And it is not visible to a client, because it is not approved.
do $$
begin
  if exists (select 1 from nearby_car_washes(33.5749, -7.5898, 5000)
              where name = 'Self Approved') then
    raise exception 'FAIL 0014: a self-inserted wash reached C1';
  end if;
end $$;

-- A wash cannot be registered in someone else's name either.
do $$
begin
  begin
    insert into car_washes (owner_id, name, address, city, location)
    values ('b1000000-0000-0000-0000-0000000000b1', 'Not Mine', 'addr', 'Rabat',
            st_setsrid(st_makepoint(-6.8498, 33.9716), 4326)::geography);
    raise exception 'FAIL 0014: an owner registered a wash for somebody else';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Clear the fixture so the RPC below starts from nothing.
reset role; reset request.jwt.claim.sub;
delete from car_washes where name in ('Self Approved', 'Not Mine');

-- =====================================================================
--  register_car_wash — O1's actual path.
-- =====================================================================

-- A client is not an owner, whatever they send.
set role authenticated;
set request.jwt.claim.sub = 'b2000000-0000-0000-0000-0000000000b2';

do $$
begin
  begin
    perform register_car_wash('Client Wash', null, 'addr', 'Casablanca',
                              33.5749, -7.5898, null, 2, '08:00', '20:00');
    raise exception 'FAIL 0014: a client registered a car wash';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role; set role authenticated;
set request.jwt.claim.sub = 'b0000000-0000-0000-0000-0000000000b0';

-- A pin outside Morocco is a map-picker mistake, and a wash nobody can find
-- is impossible to explain after the fact.
do $$
begin
  begin
    -- Paris.
    perform register_car_wash('Lost Wash', null, 'addr', 'Casablanca',
                              48.8566, 2.3522, null, 2, '08:00', '20:00');
    raise exception 'FAIL 0014: a pin outside Morocco was accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL 0014%' then raise; end if;
  end;
end $$;

-- Latitude and longitude the wrong way round lands in the sea off Somalia,
-- and is exactly what a swapped argument list produces.
do $$
begin
  begin
    perform register_car_wash('Swapped', null, 'addr', 'Casablanca',
                              -7.5898, 33.5749, null, 2, '08:00', '20:00');
    raise exception 'FAIL 0014: a swapped lat/lng was accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL 0014%' then raise; end if;
  end;
end $$;

do $$
begin
  begin
    perform register_car_wash('No Hours', null, 'addr', 'Casablanca',
                              33.5749, -7.5898, null, 2, '08:00', '08:00');
    raise exception 'FAIL 0014: a wash that is never open was accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL 0014%' then raise; end if;
  end;
end $$;

do $$
begin
  begin
    perform register_car_wash('   ', null, 'addr', 'Casablanca',
                              33.5749, -7.5898, null, 2, '08:00', '20:00');
    raise exception 'FAIL 0014: a blank name was accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL 0014%' then raise; end if;
  end;
end $$;

-- The real thing.
do $$
declare
  v_id uuid;
  r    record;
begin
  v_id := register_car_wash('  Lavage Al Amal  ', '  Rapide et propre  ',
                            '  12 rue Zerktouni  ', 'Casablanca',
                            33.5749, -7.5898, '  +212600112233  ',
                            3, '07:30', '21:00');

  select * into r from car_washes where id = v_id;

  if r.name <> 'Lavage Al Amal' or r.address <> '12 rue Zerktouni' then
    raise exception 'FAIL 0014: the name or address came back untrimmed';
  end if;

  if r.status <> 'pending' then
    raise exception 'FAIL 0014: a new registration is %, expected pending', r.status;
  end if;

  if r.owner_id <> 'b0000000-0000-0000-0000-0000000000b0' then
    raise exception 'FAIL 0014: the wash is not owned by whoever registered it';
  end if;

  -- The pin has to survive the trip in the right order.
  if round(st_y(r.location::geometry)::numeric, 3) <> 33.575
  or round(st_x(r.location::geometry)::numeric, 3) <> -7.590 then
    raise exception 'FAIL 0014: the pin landed at %, %',
      st_y(r.location::geometry), st_x(r.location::geometry);
  end if;
end $$;

-- Submitting O1 twice would put a duplicate in D2's queue.
do $$
begin
  begin
    perform register_car_wash('Second Try', null, 'addr', 'Casablanca',
                              33.5749, -7.5898, null, 2, '08:00', '20:00');
    raise exception 'FAIL 0014: a second application was accepted while one was undecided';
  exception when raise_exception then
    if sqlerrm like 'FAIL 0014%' then raise; end if;
  end;
end $$;

-- It reaches D2.
reset role; set role authenticated;
set request.jwt.claim.sub = 'b3000000-0000-0000-0000-0000000000b3';

do $$
begin
  if not exists (select 1 from pending_washes() where name = 'Lavage Al Amal') then
    raise exception 'FAIL 0014: the application never reached D2';
  end if;
end $$;

-- =====================================================================
--  The pin, photos, and who may move them.
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = 'b0000000-0000-0000-0000-0000000000b0';

do $$
declare
  v_id  uuid;
  v_lat double precision;
  v_lng double precision;
begin
  select id into v_id from car_washes where name = 'Lavage Al Amal';

  -- O1/O2/O5 read their own pin without going through nearby_car_washes(),
  -- which would never return a pending wash.
  select latitude, longitude into v_lat, v_lng from my_wash_pin(v_id);

  if round(v_lat::numeric, 3) <> 33.575 or round(v_lng::numeric, 3) <> -7.590 then
    raise exception 'FAIL 0014: my_wash_pin returned %, %', v_lat, v_lng;
  end if;

  perform set_wash_media(
    v_id,
    array['wash-photos/' || v_id || '/1.jpg',
          'wash-photos/' || v_id || '/2.jpg',
          'wash-photos/' || v_id || '/3.jpg'],
    33.6000, -7.6000);

  if (select array_length(photos, 1) from car_washes where id = v_id) <> 3 then
    raise exception 'FAIL 0014: the photos were not attached';
  end if;

  select latitude, longitude into v_lat, v_lng from my_wash_pin(v_id);
  if round(v_lat::numeric, 3) <> 33.600 then
    raise exception 'FAIL 0014: the pin did not move, it is at %', v_lat;
  end if;

  -- Null means leave alone, so O2 can move the pin without resending photos.
  perform set_wash_media(v_id, null, 33.5749, -7.5898);
  if (select array_length(photos, 1) from car_washes where id = v_id) <> 3 then
    raise exception 'FAIL 0014: a null photo list wiped the photos';
  end if;
end $$;

-- Somebody else's wash is somebody else's.
reset role; set role authenticated;
set request.jwt.claim.sub = 'b1000000-0000-0000-0000-0000000000b1';

do $$
declare
  v_id uuid;
begin
  select id into v_id from car_washes where name = 'Lavage Al Amal';

  begin
    perform set_wash_media(v_id, array['wash-photos/x/hijack.jpg']);
    raise exception 'FAIL 0014: another owner replaced the photos';
  exception when insufficient_privilege then null;
  end;

  if exists (select 1 from my_wash_pin(v_id)) then
    raise exception 'FAIL 0014: another owner read the pin';
  end if;
end $$;

-- =====================================================================
--  Storage — 0013.
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = 'b0000000-0000-0000-0000-0000000000b0';

do $$
declare
  v_id uuid;
begin
  select id into v_id from car_washes where name = 'Lavage Al Amal';

  -- Own wash, own folder.
  insert into storage.objects (bucket_id, name)
  values ('media', 'wash-photos/' || v_id || '/1.jpg');

  -- Own avatar.
  insert into storage.objects (bucket_id, name)
  values ('media', 'avatars/b0000000-0000-0000-0000-0000000000b0/me.jpg');

  -- Own receipt, in the bucket that is not public.
  insert into storage.objects (bucket_id, name)
  values ('private', 'receipts/' || v_id || '/transfer.jpg');
end $$;

-- A second wash, belonging to the other owner, as the fixture for the
-- cross-tenant checks below. Inserted as the server: the guard would
-- otherwise force it to 'pending', and an approved one is what these need.
reset role; reset request.jwt.claim.sub;

insert into car_washes (id, owner_id, name, address, city, location, status)
values ('b9000000-0000-0000-0000-0000000000b9',
        'b1000000-0000-0000-0000-0000000000b1',
        'Other Wash', 'addr', 'Rabat',
        st_setsrid(st_makepoint(-6.8498, 33.9716), 4326)::geography, 'approved');

set role authenticated;
set request.jwt.claim.sub = 'b0000000-0000-0000-0000-0000000000b0';

do $$
declare
  v_rows int;
begin
  -- Another wash's photo folder.
  begin
    insert into storage.objects (bucket_id, name)
    values ('media', 'wash-photos/b9000000-0000-0000-0000-0000000000b9/hijack.jpg');
    raise exception 'FAIL 0013: an owner uploaded into another wash''s folder';
  exception when insufficient_privilege then null;
  end;

  -- Another user's avatar folder.
  begin
    insert into storage.objects (bucket_id, name)
    values ('media', 'avatars/b1000000-0000-0000-0000-0000000000b1/hijack.jpg');
    raise exception 'FAIL 0013: an owner uploaded into another user''s avatar folder';
  exception when insufficient_privilege then null;
  end;

  -- A path with no folder prefix at all — the policies must not fall open.
  begin
    insert into storage.objects (bucket_id, name) values ('media', 'loose.jpg');
    raise exception 'FAIL 0013: a file landed in the bucket root';
  exception when insufficient_privilege then null;
  end;

  -- Another wash's receipt is a financial document.
  select count(*) into v_rows from storage.objects
   where bucket_id = 'private'
     and name like 'receipts/b9000000-0000-0000-0000-0000000000b9/%';

  if v_rows <> 0 then
    raise exception 'FAIL 0013: an owner can see another wash''s receipts';
  end if;
end $$;

-- A client has no business in any of it.
reset role; set role authenticated;
set request.jwt.claim.sub = 'b2000000-0000-0000-0000-0000000000b2';

do $$
declare
  v_id uuid;
begin
  select id into v_id from car_washes where name = 'Lavage Al Amal';

  begin
    insert into storage.objects (bucket_id, name)
    values ('media', 'wash-photos/' || v_id || '/hijack.jpg');
    raise exception 'FAIL 0013: a client uploaded a wash photo';
  exception when insufficient_privilege then null;
  end;

  if exists (select 1 from storage.objects where bucket_id = 'private') then
    raise exception 'FAIL 0013: a client can read receipts';
  end if;
end $$;

-- The admin checks the transfer against the receipt; that is the whole of D8.
reset role; set role authenticated;
set request.jwt.claim.sub = 'b3000000-0000-0000-0000-0000000000b3';

do $$
begin
  if not exists (select 1 from storage.objects
                  where bucket_id = 'private' and name like 'receipts/%') then
    raise exception 'FAIL 0013: an admin cannot read the receipts they have to check';
  end if;
end $$;

reset role;
reset request.jwt.claim.sub;

\echo 'All registration and storage assertions passed.'
