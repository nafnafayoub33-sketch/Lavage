-- =====================================================================
--  A live queue that clients are actually allowed to see.
--
--  C6 must react to two things: the client's own booking changing status,
--  and the queue in front of them shrinking. Realtime's postgres_changes
--  applies RLS, and "read own bookings" means a client is never sent an
--  event about anyone else's row — so subscribing to `bookings` would
--  deliver the first and silently never deliver the second. The car ahead
--  would finish and nothing would arrive.
--
--  So the queue publishes a summary of itself. One row per wash, holding
--  only what is already public through nearby_car_washes: how many cars are
--  waiting and which ticket is on the ramp. No client learns anything about
--  another client that C1 did not already show them.
--
--  This is a signal, not a source of truth. C6 refetches on it and reads the
--  real numbers through my_queue_position, which checks ownership.
-- =====================================================================

create table queue_events (
  car_wash_id  uuid primary key references car_washes(id) on delete cascade,
  cars_waiting int not null default 0,
  now_serving  int,
  updated_at   timestamptz not null default now()
);

alter table queue_events enable row level security;

-- Aggregates only, and the same aggregates nearby_car_washes already returns
-- to anyone. Readable by all, writable by nobody: the trigger below is the
-- only writer, and it runs as definer.
create policy "public read queue events" on queue_events for select using (true);

-- ---------------------------------------------------------------------
-- Recompute a wash's summary whenever any of its bookings move.
--
-- SECURITY DEFINER for the same reason queue_state needs it: counting the
-- queue means reading rows the acting user cannot see.
-- ---------------------------------------------------------------------
create or replace function refresh_queue_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wash uuid;
begin
  v_wash := coalesce(new.car_wash_id, old.car_wash_id);
  if v_wash is null then
    return null;
  end if;

  insert into queue_events (car_wash_id, cars_waiting, now_serving, updated_at)
  select v_wash,
         (select count(*)::int
            from bookings
           where car_wash_id = v_wash
             and status in ('pending', 'in_progress')),
         (select ticket_no
            from bookings
           where car_wash_id = v_wash
             and status = 'in_progress'
           order by started_at nulls last
           limit 1),
         now()
  on conflict (car_wash_id) do update
     set cars_waiting = excluded.cars_waiting,
         now_serving  = excluded.now_serving,
         updated_at   = excluded.updated_at;

  return null;
end $$;

comment on function refresh_queue_event() is
  'Publishes a wash queue summary for Realtime. RLS hides other clients bookings, so the queue has to announce itself.';

create trigger bookings_refresh_queue_event
  after insert or update or delete on bookings
  for each row execute function refresh_queue_event();

-- ---------------------------------------------------------------------
-- Hand the table to Realtime.
--
-- Guarded: the publication is created by Supabase and does not exist in a
-- bare Postgres, which is what the tests run against.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table queue_events;
  end if;
end $$;
