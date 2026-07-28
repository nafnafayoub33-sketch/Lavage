-- =====================================================================
--  O3 needs rows an owner is not allowed to read.
--
--  The board shows, per booking: the ticket, the service, the vehicle, and
--  enough of the client to call them. But:
--
--    profiles  "read own profile"    -> id = auth.uid() or is_admin()
--    vehicles  "client owns vehicles" -> client_id = auth.uid()
--
--  so an owner can read neither the client nor the car they are about to
--  wash. The booking row itself they can see; everything that makes it
--  actionable, they cannot.
--
--  Widening those two policies would hand every owner the whole customer
--  table. This returns one shape instead — exactly the board — and checks
--  that the caller owns the wash before returning anything.
--
--  On the phone number: it is returned in full, because "Call" is a listed
--  action on this screen and a masked number cannot be dialled. It leaves
--  the database only for the owner of that wash, and only for a booking of
--  the current day that is still live. O4 says the number is *displayed*
--  masked, which is the client's job, not the query's.
-- =====================================================================

create or replace function owner_queue(p_wash_id uuid)
returns table (
  booking_id        uuid,
  ticket_no         int,
  status            booking_status,
  price             int,
  created_at        timestamptz,
  started_at        timestamptz,
  service_name      text,
  service_minutes   int,
  client_first_name text,
  client_phone      text,
  vehicle_label     text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id,
         b.ticket_no,
         b.status,
         b.price,
         b.created_at,
         b.started_at,
         s.name,
         s.duration_min,
         -- A first name is enough to call someone over; the rest is not the
         -- owner's business.
         split_part(p.full_name, ' ', 1),
         p.phone,
         nullif(trim(concat_ws(' ', v.brand, v.model, v.plate)), '')
    from bookings b
    join services s on s.id = b.service_id
    join profiles p on p.id = b.client_id
    left join vehicles v on v.id = b.vehicle_id
   where b.car_wash_id = p_wash_id
     -- The ownership check RLS would normally make. Without it, SECURITY
     -- DEFINER would let any signed-in user read any wash's customers.
     and (owns_wash(p_wash_id) or is_admin())
     and b.created_at >= date_trunc('day', now())
     and b.status in ('pending', 'in_progress', 'done')
   order by b.ticket_no;
$$;

comment on function owner_queue(uuid) is
  'O3. Today''s live queue for one wash, joined to the client and vehicle rows RLS hides from the owner. Checks ownership itself.';

revoke all on function owner_queue(uuid) from public;
grant execute on function owner_queue(uuid) to authenticated;
