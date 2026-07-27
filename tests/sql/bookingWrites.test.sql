-- =====================================================================
--  Writing to a booking — 0008.
--
--  Two regressions and one feature:
--
--    a client could rewrite price and ticket_no on their own booking
--    confirming a wash failed outright, so nothing was ever billed
--    arrival is the client's to set and the owner's to read
--
--  Every assertion runs as an end user. As the table owner they would all
--  pass against the broken version.
-- =====================================================================
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('a8000000-0000-0000-0000-0000000000a8'),   -- owner
  ('c8000000-0000-0000-0000-0000000000c8'),   -- the client
  ('d8000000-0000-0000-0000-0000000000d8');   -- an unrelated client

insert into profiles (id, role, full_name, phone) values
  ('a8000000-0000-0000-0000-0000000000a8', 'owner',  'Write Owner',  '+212680000001'),
  ('c8000000-0000-0000-0000-0000000000c8', 'client', 'Write Client', '+212680000002'),
  ('d8000000-0000-0000-0000-0000000000d8', 'client', 'Other Client', '+212680000003');

insert into car_washes
  (id, owner_id, name, address, city, location, status,
   is_open_now, opens_at, closes_at, credit_balance, free_washes_left, bays_count)
values
  ('88000000-0000-0000-0000-000000000088', 'a8000000-0000-0000-0000-0000000000a8',
   'Write Wash', 'addr', 'Casablanca',
   st_setsrid(st_makepoint(-7.5898, 33.5749), 4326)::geography,
   'approved', true, '00:00', '23:59', 5000, 0, 1);

insert into services (id, car_wash_id, name, price, duration_min, is_active)
values ('89000000-0000-0000-0000-000000000089',
        '88000000-0000-0000-0000-000000000088', 'Complet', 4000, 20, true);

insert into bookings (id, car_wash_id, client_id, service_id, status, price)
values ('8a000000-0000-0000-0000-00000000008a',
        '88000000-0000-0000-0000-000000000088',
        'c8000000-0000-0000-0000-0000000000c8',
        '89000000-0000-0000-0000-000000000089', 'pending', 4000);

-- =====================================================================
--  The client
-- =====================================================================
set role authenticated;
set request.jwt.claim.sub = 'c8000000-0000-0000-0000-0000000000c8';

do $$
begin
  begin
    update bookings set price = 0 where id = '8a000000-0000-0000-0000-00000000008a';
    raise exception 'FAIL 0008: a client rewrote the price of their booking';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    -- 99, not 1: this is the day's first booking so its ticket already is 1,
    -- and setting a column to the value it already holds changes nothing for
    -- IS DISTINCT FROM to catch.
    update bookings set ticket_no = 99 where id = '8a000000-0000-0000-0000-00000000008a';
    raise exception 'FAIL 0008: a client rewrote their ticket number';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    -- Straight to confirmed from pending would bill the wash for a wash that
    -- never happened.
    update bookings set status = 'confirmed' where id = '8a000000-0000-0000-0000-00000000008a';
    raise exception 'FAIL 0008: a client confirmed a booking that had not been done';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    update bookings set status = 'in_progress' where id = '8a000000-0000-0000-0000-00000000008a';
    raise exception 'FAIL 0008: a client started their own wash';
  exception when insufficient_privilege then null;
  end;
end $$;

-- The feature: the client says they are on the way.
update bookings set arrival = 'on_the_way' where id = '8a000000-0000-0000-0000-00000000008a';
update bookings set arrival = 'arrived'    where id = '8a000000-0000-0000-0000-00000000008a';

do $$
begin
  if (select arrival from bookings where id = '8a000000-0000-0000-0000-00000000008a') <> 'arrived' then
    raise exception 'FAIL 0008: the client could not set their arrival';
  end if;
end $$;

-- =====================================================================
--  The owner: reads the arrival, drives the status, cannot fake either
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = 'a8000000-0000-0000-0000-0000000000a8';

do $$
declare
  r record;
begin
  select * into r from owner_queue('88000000-0000-0000-0000-000000000088');

  if r.arrival is distinct from 'arrived'::arrival_status then
    raise exception 'FAIL 0008: the owner board did not carry the arrival (%)', r.arrival;
  end if;
end $$;

do $$
begin
  begin
    update bookings set arrival = 'on_the_way' where id = '8a000000-0000-0000-0000-00000000008a';
    raise exception 'FAIL 0008: the owner set the client''s arrival for them';
  exception when insufficient_privilege then null;
  end;
end $$;

update bookings set status = 'in_progress', started_at = now()
 where id = '8a000000-0000-0000-0000-00000000008a';
update bookings set status = 'done', finished_at = now()
 where id = '8a000000-0000-0000-0000-00000000008a';

do $$
begin
  begin
    -- Confirming is the client's word that the job was done, not the
    -- owner's. It is also what triggers the charge.
    update bookings set status = 'confirmed' where id = '8a000000-0000-0000-0000-00000000008a';
    raise exception 'FAIL 0008: the owner confirmed on the client''s behalf';
  exception when insufficient_privilege then null;
  end;
end $$;

-- =====================================================================
--  Billing actually runs now
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = 'c8000000-0000-0000-0000-0000000000c8';

-- Before 0008 this raised "new row violates row-level security policy for
-- table credit_transactions" and no wash was ever billed.
update bookings set status = 'confirmed' where id = '8a000000-0000-0000-0000-00000000008a';

reset role;

do $$
declare
  v_balance int;
  v_tx      int;
begin
  select credit_balance into v_balance
    from car_washes where id = '88000000-0000-0000-0000-000000000088';

  -- 5000 centimes less the 1 DH fee.
  if v_balance <> 4900 then
    raise exception 'FAIL 0008: balance is % after a confirmed wash, expected 4900', v_balance;
  end if;

  select count(*)::int into v_tx
    from credit_transactions
   where booking_id = '8a000000-0000-0000-0000-00000000008a' and type = 'charge';

  if v_tx <> 1 then
    raise exception 'FAIL 0008: % charge rows in the ledger, expected 1', v_tx;
  end if;

  if (select confirmed_at from bookings where id = '8a000000-0000-0000-0000-00000000008a') is null then
    raise exception 'FAIL 0008: confirmed_at was not stamped';
  end if;
end $$;

-- =====================================================================
--  A stranger
-- =====================================================================
set role authenticated;
set request.jwt.claim.sub = 'd8000000-0000-0000-0000-0000000000d8';

do $$
declare
  v_rows int;
begin
  -- RLS filters the row away rather than raising, so assert on the effect.
  update bookings set arrival = 'on_the_way' where id = '8a000000-0000-0000-0000-00000000008a';
  get diagnostics v_rows = row_count;

  if v_rows <> 0 then
    raise exception 'FAIL 0008: an unrelated client wrote to somebody else''s booking';
  end if;
end $$;

reset role;
reset request.jwt.claim.sub;

\echo 'All booking write assertions passed.'
