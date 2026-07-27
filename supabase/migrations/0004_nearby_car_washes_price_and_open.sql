-- =====================================================================
--  nearby_car_washes() could not back C1 as specified.
--
--  1. C1's row shows "price from" and the function returned no price at all.
--
--  2. `is_available` folded together three unrelated facts — the owner's
--     "closed today" switch, the opening hours, and whether there is any
--     credit left. C1 has to treat those differently:
--
--       out of credit  -> "never listed at all" (C3), and ARCHITECTURE says
--                         the wash "disappears from nearby_car_washes
--                         automatically" when the balance hits zero
--       closed now     -> still listed, shown red, "opens at 08:00" (C3)
--
--     Returning an out-of-credit wash with a false flag left the client to
--     enforce a billing rule that belongs in the query. Now the WHERE clause
--     drops them, and `is_open` carries only the open/closed question.
--
--  3. rating_count comes along so "best rated" can break ties sensibly —
--     one five-star review should not outrank a hundred at 4.8.
--
--  The return signature changes, so this is a drop and recreate; CREATE OR
--  REPLACE cannot alter a function's OUT columns. Nothing calls it yet.
-- =====================================================================

drop function if exists nearby_car_washes(double precision, double precision, int);

create function nearby_car_washes(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int default 10000
)
returns table (
  id uuid,
  name text,
  address text,
  photos text[],
  latitude double precision,
  longitude double precision,
  distance_m int,
  rating_avg numeric,
  rating_count int,
  bays_count int,
  cars_ahead int,
  wait_minutes int,
  price_from int,
  is_open boolean
)
language sql stable as $$
  select cw.id,
         cw.name,
         cw.address,
         cw.photos,
         -- C1 draws a pin per wash. Without these the map can only place them
         -- by distance, which is a circle, not a location.
         st_y(cw.location::geometry),
         st_x(cw.location::geometry),
         st_distance(cw.location,
           st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)::int,
         cw.rating_avg,
         cw.rating_count,
         cw.bays_count,
         qs.cars_ahead,
         qs.wait_minutes,
         -- Cheapest active service, in centimes. Null when the owner has not
         -- added a price list yet — the row simply omits "from …".
         (select min(s.price)
            from services s
           where s.car_wash_id = cw.id
             and s.is_active)::int,
         (cw.is_open_now and current_time between cw.opens_at and cw.closes_at)
    from car_washes cw
    cross join lateral queue_state(cw.id) qs
   where cw.status = 'approved'
     -- The billing rule, enforced here rather than in the client.
     and (cw.credit_balance > 0 or cw.free_washes_left > 0)
     and st_dwithin(cw.location,
           st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_m)
   order by 7;
$$;

comment on function nearby_car_washes(double precision, double precision, int) is
  'C1. Approved washes in range that still have credit. is_open covers hours and the closed-today switch only.';
