-- =====================================================================
--  The 0001 audit — 0010.
--
--  One assertion per hole, each run as the end user who could exploit it.
--  As the table owner every one of these passes against the broken schema,
--  which is exactly how they survived this long.
-- =====================================================================
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('aa100000-0000-0000-0000-0000000000a1'),   -- owner
  ('aa200000-0000-0000-0000-0000000000a2'),   -- admin
  ('cc100000-0000-0000-0000-0000000000c1'),   -- client one
  ('cc200000-0000-0000-0000-0000000000c2');   -- client two

insert into profiles (id, role, full_name, phone) values
  ('aa100000-0000-0000-0000-0000000000a1', 'owner',  'Audit Owner',  '+212670000001'),
  ('aa200000-0000-0000-0000-0000000000a2', 'admin',  'Audit Admin',  '+212670000002'),
  ('cc100000-0000-0000-0000-0000000000c1', 'client', 'Audit One',    '+212670000003'),
  ('cc200000-0000-0000-0000-0000000000c2', 'client', 'Audit Two',    '+212670000004');

insert into car_washes
  (id, owner_id, name, address, city, location, status,
   is_open_now, opens_at, closes_at, credit_balance, free_washes_left, bays_count)
values
  ('ff100000-0000-0000-0000-0000000000f1', 'aa100000-0000-0000-0000-0000000000a1',
   'Audit Wash', 'addr', 'Casablanca',
   st_setsrid(st_makepoint(-7.5898, 33.5749), 4326)::geography,
   'approved', true, '00:00', '23:59', 5000, 0, 1),
  -- a second, still awaiting D2
  ('ff200000-0000-0000-0000-0000000000f2', 'aa100000-0000-0000-0000-0000000000a1',
   'Not Approved', 'addr', 'Casablanca',
   st_setsrid(st_makepoint(-7.5899, 33.5750), 4326)::geography,
   'pending', true, '00:00', '23:59', 5000, 0, 1);

insert into services (id, car_wash_id, name, price, duration_min, is_active) values
  ('ff300000-0000-0000-0000-0000000000f3', 'ff100000-0000-0000-0000-0000000000f1', 'Complet', 5000, 20, true),
  ('ff400000-0000-0000-0000-0000000000f4', 'ff100000-0000-0000-0000-0000000000f1', 'Retired', 3000, 15, false),
  ('ff500000-0000-0000-0000-0000000000f5', 'ff200000-0000-0000-0000-0000000000f2', 'Elsewhere', 9000, 30, true);

-- =====================================================================
--  1. The owner may run their wash, not promote or fund it
-- =====================================================================
set role authenticated;
set request.jwt.claim.sub = 'aa100000-0000-0000-0000-0000000000a1';

do $$
begin
  begin
    update car_washes set status = 'approved' where id = 'ff200000-0000-0000-0000-0000000000f2';
    raise exception 'FAIL 0010: an owner approved their own car wash — D2 exists for this';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    update car_washes set credit_balance = 999999 where id = 'ff100000-0000-0000-0000-0000000000f1';
    raise exception 'FAIL 0010: an owner minted their own credit';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    update car_washes set free_washes_left = 500 where id = 'ff100000-0000-0000-0000-0000000000f1';
    raise exception 'FAIL 0010: an owner granted themselves free washes';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    update car_washes set rating_avg = 5.0, rating_count = 999
     where id = 'ff100000-0000-0000-0000-0000000000f1';
    raise exception 'FAIL 0010: an owner wrote their own rating';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    update car_washes set owner_id = 'cc100000-0000-0000-0000-0000000000c1'
     where id = 'ff100000-0000-0000-0000-0000000000f1';
    raise exception 'FAIL 0010: an owner gave their wash away';
  exception when insufficient_privilege then null;
  end;
end $$;

-- O5 still works.
update car_washes
   set name = 'Renamed', address = 'New address', bays_count = 3, is_open_now = false
 where id = 'ff100000-0000-0000-0000-0000000000f1';

do $$
declare
  r record;
begin
  select * into r from car_washes where id = 'ff100000-0000-0000-0000-0000000000f1';

  if r.name <> 'Renamed' or r.bays_count <> 3 or r.is_open_now then
    raise exception 'FAIL 0010: the guard broke ordinary wash editing';
  end if;
  if r.status <> 'approved' or r.credit_balance <> 5000 then
    raise exception 'FAIL 0010: protected columns moved despite the refusals';
  end if;
end $$;

update car_washes set is_open_now = true where id = 'ff100000-0000-0000-0000-0000000000f1';

-- =====================================================================
--  2. Ticket numbers count the whole queue, not the caller's share of it
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = 'cc100000-0000-0000-0000-0000000000c1';

insert into bookings (id, car_wash_id, client_id, service_id, status, price)
values ('bb100000-0000-0000-0000-0000000000b1', 'ff100000-0000-0000-0000-0000000000f1',
        'cc100000-0000-0000-0000-0000000000c1', 'ff300000-0000-0000-0000-0000000000f3', 'pending', 5000);

reset role; set role authenticated;
set request.jwt.claim.sub = 'cc200000-0000-0000-0000-0000000000c2';

insert into bookings (id, car_wash_id, client_id, service_id, status, price)
values ('bb200000-0000-0000-0000-0000000000b2', 'ff100000-0000-0000-0000-0000000000f1',
        'cc200000-0000-0000-0000-0000000000c2', 'ff300000-0000-0000-0000-0000000000f3', 'pending', 5000);

reset role;

do $$
declare
  v_first  int;
  v_second int;
begin
  select ticket_no into v_first  from bookings where id = 'bb100000-0000-0000-0000-0000000000b1';
  select ticket_no into v_second from bookings where id = 'bb200000-0000-0000-0000-0000000000b2';

  -- Before 0010 both were 1: RLS hid every other client's booking from
  -- max(ticket_no), so the count restarted for each person.
  if v_first = v_second then
    raise exception 'FAIL 0010: two clients were both issued ticket %', v_first;
  end if;
  if v_second <> v_first + 1 then
    raise exception 'FAIL 0010: tickets went % then %, expected consecutive', v_first, v_second;
  end if;
end $$;

-- =====================================================================
--  3. The price comes from the price list
-- =====================================================================
set role authenticated;
set request.jwt.claim.sub = 'cc200000-0000-0000-0000-0000000000c2';

do $$
begin
  begin
    insert into bookings (car_wash_id, client_id, service_id, status, price)
    values ('ff100000-0000-0000-0000-0000000000f1', 'cc200000-0000-0000-0000-0000000000c2',
            'ff300000-0000-0000-0000-0000000000f3', 'confirmed', 5000);
    raise exception 'FAIL 0010: a booking was created already confirmed';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    -- A service belonging to a different wash.
    insert into bookings (car_wash_id, client_id, service_id, status, price)
    values ('ff100000-0000-0000-0000-0000000000f1', 'cc200000-0000-0000-0000-0000000000c2',
            'ff500000-0000-0000-0000-0000000000f5', 'pending', 9000);
    raise exception 'FAIL 0010: a booking mixed one wash with another wash''s service';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    insert into bookings (car_wash_id, client_id, service_id, status, price)
    values ('ff100000-0000-0000-0000-0000000000f1', 'cc200000-0000-0000-0000-0000000000c2',
            'ff400000-0000-0000-0000-0000000000f4', 'pending', 3000);
    raise exception 'FAIL 0010: a booking used a service that is not on sale';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    insert into bookings (car_wash_id, client_id, service_id, status, price)
    values ('ff200000-0000-0000-0000-0000000000f2', 'cc200000-0000-0000-0000-0000000000c2',
            'ff500000-0000-0000-0000-0000000000f5', 'pending', 9000);
    raise exception 'FAIL 0010: a booking was taken at a wash still awaiting approval';
  exception when insufficient_privilege then null;
  end;
end $$;

-- =====================================================================
--  4. Ratings actually update, and only after a real wash
-- =====================================================================
-- `reset role` alone leaves the JWT claim set, so auth.uid() would still be
-- client two and the 0008 guard would call this somebody else's booking.
reset role;
reset request.jwt.claim.sub;
-- Walk the first booking to confirmed the legitimate way.
update bookings set status = 'in_progress', started_at = now()
 where id = 'bb100000-0000-0000-0000-0000000000b1';
update bookings set status = 'done', finished_at = now()
 where id = 'bb100000-0000-0000-0000-0000000000b1';

set role authenticated;
set request.jwt.claim.sub = 'cc100000-0000-0000-0000-0000000000c1';
update bookings set status = 'confirmed' where id = 'bb100000-0000-0000-0000-0000000000b1';

do $$
begin
  begin
    -- Client two never had this booking.
    perform set_config('request.jwt.claim.sub', 'cc200000-0000-0000-0000-0000000000c2', true);
    insert into reviews (booking_id, car_wash_id, client_id, rating)
    values ('bb100000-0000-0000-0000-0000000000b1', 'ff100000-0000-0000-0000-0000000000f1',
            'cc200000-0000-0000-0000-0000000000c2', 1);
    raise exception 'FAIL 0010: a client reviewed somebody else''s booking';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    -- Client two's own booking is still pending, not confirmed.
    perform set_config('request.jwt.claim.sub', 'cc200000-0000-0000-0000-0000000000c2', true);
    insert into reviews (booking_id, car_wash_id, client_id, rating)
    values ('bb200000-0000-0000-0000-0000000000b2', 'ff100000-0000-0000-0000-0000000000f1',
            'cc200000-0000-0000-0000-0000000000c2', 5);
    raise exception 'FAIL 0010: a wash was reviewed before it happened';
  exception when insufficient_privilege then null;
  end;
end $$;


set request.jwt.claim.sub = 'cc100000-0000-0000-0000-0000000000c1';
insert into reviews (booking_id, car_wash_id, client_id, rating)
values ('bb100000-0000-0000-0000-0000000000b1', 'ff100000-0000-0000-0000-0000000000f1',
        'cc100000-0000-0000-0000-0000000000c1', 5);

reset role;

do $$
declare
  r record;
begin
  select rating_avg, rating_count into r
    from car_washes where id = 'ff100000-0000-0000-0000-0000000000f1';

  -- Before 0010 this stayed 0.0 / 0: refresh_wash_rating updated car_washes
  -- as the reviewing client, and RLS filtered it to nothing without error.
  if r.rating_count <> 1 then
    raise exception 'FAIL 0010: rating_count is % after one review, expected 1', r.rating_count;
  end if;
  if r.rating_avg <> 5.0 then
    raise exception 'FAIL 0010: rating_avg is % after a five-star review', r.rating_avg;
  end if;
end $$;

\echo 'All audit assertions passed.'
