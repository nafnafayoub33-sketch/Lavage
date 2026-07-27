-- =====================================================================
--  queue_events — 0006.
--
--  The point of this table is that a client can be told the car in front of
--  them has finished. RLS on bookings makes that impossible to learn from
--  bookings directly, so the assertions below run as a client who owns
--  nothing at the wash in question — the exact case that gets no events.
-- =====================================================================
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('e1000000-0000-0000-0000-0000000000e1'),   -- owner
  ('e2000000-0000-0000-0000-0000000000e2'),   -- the client watching
  ('e3000000-0000-0000-0000-0000000000e3');   -- a different client, ahead

insert into profiles (id, role, full_name) values
  ('e1000000-0000-0000-0000-0000000000e1', 'owner',  'Events Owner'),
  ('e2000000-0000-0000-0000-0000000000e2', 'client', 'Watcher'),
  ('e3000000-0000-0000-0000-0000000000e3', 'client', 'Ahead');

insert into car_washes
  (id, owner_id, name, address, city, location, status,
   is_open_now, opens_at, closes_at, credit_balance, bays_count)
values
  ('ee110000-0000-0000-0000-00000000ee11', 'e1000000-0000-0000-0000-0000000000e1',
   'Events Wash', 'addr', 'Casablanca',
   st_setsrid(st_makepoint(-7.5898, 33.5749), 4326)::geography,
   'approved', true, '00:00', '23:59', 5000, 1);

insert into services (id, car_wash_id, name, price, duration_min, is_active)
values ('ee220000-0000-0000-0000-00000000ee22',
        'ee110000-0000-0000-0000-00000000ee11', 'Complet', 3000, 20, true);

-- =====================================================================

do $$
begin
  -- Nothing booked yet, so nothing has been published.
  if exists (select 1 from queue_events where car_wash_id = 'ee110000-0000-0000-0000-00000000ee11') then
    raise exception 'FAIL 0006: a summary existed before any booking';
  end if;
end $$;

insert into bookings (id, car_wash_id, client_id, service_id, status, price)
values ('ee330000-0000-0000-0000-00000000ee33', 'ee110000-0000-0000-0000-00000000ee11',
        'e3000000-0000-0000-0000-0000000000e3', 'ee220000-0000-0000-0000-00000000ee22',
        'pending', 3000);

do $$
declare
  r record;
begin
  select * into r from queue_events where car_wash_id = 'ee110000-0000-0000-0000-00000000ee11';

  if r is null then
    raise exception 'FAIL 0006: booking an insert published no summary';
  end if;
  if r.cars_waiting <> 1 then
    raise exception 'FAIL 0006: cars_waiting is %, expected 1', r.cars_waiting;
  end if;
  if r.now_serving is not null then
    raise exception 'FAIL 0006: now_serving set while nothing had started';
  end if;
end $$;

-- The owner starts the wash.
update bookings
   set status = 'in_progress', started_at = now()
 where id = 'ee330000-0000-0000-0000-00000000ee33';

do $$
declare
  r record;
begin
  select * into r from queue_events where car_wash_id = 'ee110000-0000-0000-0000-00000000ee11';

  if r.now_serving is null then
    raise exception 'FAIL 0006: starting a wash did not publish now_serving';
  end if;
  if r.cars_waiting <> 1 then
    raise exception 'FAIL 0006: an in-progress car stopped counting as waiting';
  end if;
end $$;

-- ... and finishes it. This is the transition C6 must hear about.
update bookings set status = 'done', finished_at = now()
 where id = 'ee330000-0000-0000-0000-00000000ee33';

do $$
declare
  r record;
begin
  select * into r from queue_events where car_wash_id = 'ee110000-0000-0000-0000-00000000ee11';

  if r.cars_waiting <> 0 then
    raise exception 'FAIL 0006: finishing the wash left cars_waiting at %', r.cars_waiting;
  end if;
  if r.now_serving is not null then
    raise exception 'FAIL 0006: now_serving survived the wash finishing';
  end if;
end $$;

-- =====================================================================
--  As the watching client, who owns no booking at this wash at all.
--  Under RLS they cannot see the booking above; the summary is the only
--  way they ever learn the queue moved.
-- =====================================================================
set role authenticated;
set request.jwt.claim.sub = 'e2000000-0000-0000-0000-0000000000e2';

do $$
begin
  if not exists (select 1 from bookings where car_wash_id = 'ee110000-0000-0000-0000-00000000ee11') is false then
    -- sanity: RLS really is hiding the other client's booking
    raise exception 'FAIL 0006: RLS let a client read another client''s booking';
  end if;
end $$;

do $$
declare
  r record;
begin
  select * into r from queue_events where car_wash_id = 'ee110000-0000-0000-0000-00000000ee11';

  if r is null then
    raise exception 'FAIL 0006: the watching client cannot read the queue summary — Realtime would deliver nothing';
  end if;
end $$;

do $$
declare
  v_rows int;
  v_after int;
begin
  -- Readable, never writable: the trigger is the only writer.
  --
  -- RLS refuses an UPDATE by matching no rows, not by raising — there is no
  -- UPDATE policy, so the row is simply invisible to the statement. The
  -- assertion has to be about the effect, not about an exception.
  update queue_events set cars_waiting = 99
   where car_wash_id = 'ee110000-0000-0000-0000-00000000ee11';
  get diagnostics v_rows = row_count;

  if v_rows <> 0 then
    raise exception 'FAIL 0006: a client updated % row(s) of the queue summary', v_rows;
  end if;

  select cars_waiting into v_after
    from queue_events where car_wash_id = 'ee110000-0000-0000-0000-00000000ee11';

  if v_after <> 0 then
    raise exception 'FAIL 0006: the queue summary was rewritten to %', v_after;
  end if;
end $$;

do $$
declare
  v_rows int;
begin
  -- Nor may a client invent a summary for a wash.
  begin
    insert into queue_events (car_wash_id, cars_waiting)
    values ('ee110000-0000-0000-0000-00000000ee11', 99);
    get diagnostics v_rows = row_count;
    raise exception 'FAIL 0006: a client inserted a queue summary';
  exception
    when insufficient_privilege then null;   -- no INSERT policy
    when unique_violation then
      raise exception 'FAIL 0006: the insert reached the table before RLS stopped it';
  end;
end $$;

reset role;
reset request.jwt.claim.sub;

-- =====================================================================
--  Realtime only streams what is in the publication.
-- =====================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'queue_events'
  ) then
    raise exception 'FAIL 0006: queue_events is not in the supabase_realtime publication — no events would ever be sent';
  end if;
end $$;

\echo 'All queue_events assertions passed.'
