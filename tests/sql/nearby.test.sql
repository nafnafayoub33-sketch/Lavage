-- =====================================================================
--  nearby_car_washes() — 0004.
--
--  Two behaviours here are business rules, not query details:
--
--    a wash with no credit left disappears from search entirely
--      ("balance hits 0 -> the wash disappears from nearby_car_washes
--       automatically", ARCHITECTURE; "never listed at all", C3)
--
--    a wash that is merely closed is still listed, so C1 can show it red
--      and C3 can say "opens at 08:00"
--
--  The old signature folded both into one is_available flag, which left the
--  billing rule to the client. These assertions exist so it cannot drift
--  back.
-- =====================================================================
\set ON_ERROR_STOP on

-- Casablanca, near enough.
\set lat 33.5731
\set lng -7.5898

insert into auth.users (id) values ('99999999-9999-9999-9999-999999999999');
insert into profiles (id, role, full_name)
  values ('99999999-9999-9999-9999-999999999999', 'owner', 'Test Owner');

-- Every wash sits ~200m from the reference point unless stated otherwise.
insert into car_washes
  (id, owner_id, name, address, city, location, status,
   is_open_now, opens_at, closes_at, credit_balance, free_washes_left)
values
  -- has credit, open: the ordinary case
  ('a0000000-0000-0000-0000-00000000000a', '99999999-9999-9999-9999-999999999999',
   'Open And Funded', 'addr', 'Casablanca',
   st_setsrid(st_makepoint(-7.5898, 33.5749), 4326)::geography,
   'approved', true, '00:00', '23:59', 5000, 0),

  -- no credit and no free washes: must vanish from search
  ('b0000000-0000-0000-0000-00000000000b', '99999999-9999-9999-9999-999999999999',
   'Broke', 'addr', 'Casablanca',
   st_setsrid(st_makepoint(-7.5898, 33.5750), 4326)::geography,
   'approved', true, '00:00', '23:59', 0, 0),

  -- no balance but still on the welcome quota: must remain visible
  ('c0000000-0000-0000-0000-00000000000c', '99999999-9999-9999-9999-999999999999',
   'On Free Quota', 'addr', 'Casablanca',
   st_setsrid(st_makepoint(-7.5898, 33.5751), 4326)::geography,
   'approved', true, '00:00', '23:59', 0, 7),

  -- funded, but the owner flipped "closed today": listed, and closed
  ('d0000000-0000-0000-0000-00000000000d', '99999999-9999-9999-9999-999999999999',
   'Closed Today', 'addr', 'Casablanca',
   st_setsrid(st_makepoint(-7.5898, 33.5752), 4326)::geography,
   'approved', false, '00:00', '23:59', 5000, 0),

  -- awaiting approval: never in search
  ('e0000000-0000-0000-0000-00000000000e', '99999999-9999-9999-9999-999999999999',
   'Not Approved Yet', 'addr', 'Casablanca',
   st_setsrid(st_makepoint(-7.5898, 33.5753), 4326)::geography,
   'pending', true, '00:00', '23:59', 5000, 0),

  -- ~80km away: outside any radius under test
  ('f0000000-0000-0000-0000-00000000000f', '99999999-9999-9999-9999-999999999999',
   'Far Away', 'addr', 'Rabat',
   st_setsrid(st_makepoint(-6.8498, 34.0209), 4326)::geography,
   'approved', true, '00:00', '23:59', 5000, 0);

-- price_from must be the cheapest ACTIVE service, not simply the cheapest.
insert into services (car_wash_id, name, price, duration_min, is_active) values
  ('a0000000-0000-0000-0000-00000000000a', 'Complet',  5000, 30, true),
  ('a0000000-0000-0000-0000-00000000000a', 'Extérieur', 3000, 20, true),
  ('a0000000-0000-0000-0000-00000000000a', 'Retired',   500, 10, false);

-- =====================================================================

do $$
declare
  visible uuid[];
begin
  select array_agg(id order by id) into visible
    from nearby_car_washes(33.5731, -7.5898, 10000);

  if 'b0000000-0000-0000-0000-00000000000b' = any(visible) then
    raise exception 'FAIL 0004: a wash with no credit is still listed';
  end if;

  if not ('c0000000-0000-0000-0000-00000000000c' = any(visible)) then
    raise exception 'FAIL 0004: a wash on its free quota was hidden';
  end if;

  if not ('d0000000-0000-0000-0000-00000000000d' = any(visible)) then
    raise exception 'FAIL 0004: a closed wash was hidden instead of listed as closed';
  end if;

  if 'e0000000-0000-0000-0000-00000000000e' = any(visible) then
    raise exception 'FAIL 0004: an unapproved wash is listed';
  end if;

  if 'f0000000-0000-0000-0000-00000000000f' = any(visible) then
    raise exception 'FAIL 0004: a wash outside the radius is listed';
  end if;
end $$;

do $$
declare
  r record;
begin
  select * into r from nearby_car_washes(33.5731, -7.5898, 10000)
   where id = 'a0000000-0000-0000-0000-00000000000a';

  if not r.is_open then
    raise exception 'FAIL 0004: an open, funded wash reported itself closed';
  end if;

  if r.price_from <> 3000 then
    raise exception 'FAIL 0004: price_from is %, expected the cheapest active service (3000)',
      r.price_from;
  end if;

  -- Centimes, never a float: 3000 is 30,00 DH.
  if r.price_from <> round(r.price_from) then
    raise exception 'FAIL 0004: price_from is not an integer';
  end if;

  if r.latitude is null or r.longitude is null then
    raise exception 'FAIL 0004: no coordinates returned — C1 cannot place a pin';
  end if;

  -- ~200m north of the reference point, so a wide tolerance still catches a
  -- swapped latitude and longitude.
  if abs(r.latitude - 33.5749) > 0.01 or abs(r.longitude - (-7.5898)) > 0.01 then
    raise exception 'FAIL 0004: coordinates look wrong (lat=%, lng=%)', r.latitude, r.longitude;
  end if;

  if r.distance_m < 50 or r.distance_m > 500 then
    raise exception 'FAIL 0004: distance_m is %, expected roughly 200', r.distance_m;
  end if;
end $$;

do $$
declare
  r record;
begin
  select * into r from nearby_car_washes(33.5731, -7.5898, 10000)
   where id = 'd0000000-0000-0000-0000-00000000000d';

  if r.is_open then
    raise exception 'FAIL 0004: the closed-today switch was ignored';
  end if;
end $$;

do $$
declare
  r record;
begin
  select * into r from nearby_car_washes(33.5731, -7.5898, 10000)
   where id = 'c0000000-0000-0000-0000-00000000000c';

  -- No price list yet; the row omits "from …" rather than showing 0 DH.
  if r.price_from is not null then
    raise exception 'FAIL 0004: a wash with no services reported a price';
  end if;
end $$;

do $$
begin
  -- The radius is a filter, not a suggestion.
  if exists (select 1 from nearby_car_washes(33.5731, -7.5898, 100)) then
    raise exception 'FAIL 0004: a 100m radius returned washes ~200m away';
  end if;
end $$;

\echo 'All nearby_car_washes assertions passed.'
