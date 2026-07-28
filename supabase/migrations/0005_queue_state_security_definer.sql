-- =====================================================================
--  queue_state() was invisible to the people it exists for.
--
--  It is declared `language sql stable`, which means SECURITY INVOKER, so
--  its `select count(*) from bookings ...` runs under the caller's RLS. The
--  policy on bookings is "read own bookings" — client_id = auth.uid() — so
--  the count only ever included the caller's own cars.
--
--  Measured against this schema with two cars queued from two different
--  clients:
--
--      table owner (no RLS)   cars_ahead 2, wait 40      <- the truth
--      a signed-in client     cars_ahead 1, wait 20
--      a signed-out visitor   cars_ahead 0, wait 0       <- shows as "free"
--
--  nearby_car_washes() cross joins this, so C1 showed nearly every wash as
--  green with no wait. The live wait time is the whole point of the product.
--
--  The fix is SECURITY DEFINER with a pinned search_path. These functions
--  return counts and one ticket number — aggregates, never rows — so no
--  client learns anything about another client's booking.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Same signature and same body as 0001; only the security context changes,
-- so CREATE OR REPLACE is enough and nothing depending on it has to move.
-- ---------------------------------------------------------------------
create or replace function queue_state(p_wash_id uuid)
returns table (cars_ahead int, wait_minutes int)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select count(*)::int as ahead
      from bookings
     where car_wash_id = p_wash_id
       and status in ('pending', 'in_progress')
  ),
  w as (
    select bays_count from car_washes where id = p_wash_id
  ),
  d as (
    select coalesce(avg(duration_min), 20)::int as avg_min
      from services where car_wash_id = p_wash_id and is_active
  )
  select q.ahead,
         (ceil(q.ahead::numeric / w.bays_count) * d.avg_min)::int
    from q, w, d;
$$;

comment on function queue_state(uuid) is
  'Live queue depth for a wash. SECURITY DEFINER: RLS on bookings would otherwise reduce the count to the caller''s own cars.';

-- ---------------------------------------------------------------------
-- C6 shows "now washing 09" — the ticket currently on the ramp. That is
-- another client's booking, so it needs the same treatment. One integer
-- leaves here, never a row.
-- ---------------------------------------------------------------------
create or replace function now_serving(p_wash_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select ticket_no
    from bookings
   where car_wash_id = p_wash_id
     and status = 'in_progress'
   order by started_at nulls last
   limit 1;
$$;

comment on function now_serving(uuid) is
  'C6. Ticket number currently being washed, or null.';

-- ---------------------------------------------------------------------
-- C6's own line: "2 cars ahead of you".
--
-- Not the same as queue_state — it counts the cars in front of one specific
-- booking, not the whole queue.
--
-- SECURITY DEFINER means the ownership check has to be explicit: without it
-- anyone could pass someone else's booking id and learn their position.
-- ---------------------------------------------------------------------
create or replace function my_queue_position(p_booking_id uuid)
returns table (cars_ahead int, wait_minutes int, now_serving int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_wash    uuid;
  v_created timestamptz;
  v_ahead   int;
  v_bays    int;
  v_avg     int;
begin
  -- The policy that RLS would normally apply, applied by hand.
  select car_wash_id, created_at
    into v_wash, v_created
    from bookings
   where id = p_booking_id
     and client_id = auth.uid();

  if v_wash is null then
    return;  -- not yours, or not a booking: no rows
  end if;

  select count(*)::int into v_ahead
    from bookings
   where car_wash_id = v_wash
     and status in ('pending', 'in_progress')
     and created_at < v_created;

  select bays_count into v_bays from car_washes where id = v_wash;

  select coalesce(avg(duration_min), 20)::int into v_avg
    from services where car_wash_id = v_wash and is_active;

  return query
    select v_ahead,
           (ceil(v_ahead::numeric / greatest(v_bays, 1)) * v_avg)::int,
           now_serving(v_wash);
end $$;

comment on function my_queue_position(uuid) is
  'C6. Cars ahead of one booking. Checks ownership itself, because SECURITY DEFINER bypasses RLS.';

revoke all on function my_queue_position(uuid) from public;
grant execute on function my_queue_position(uuid) to authenticated;
