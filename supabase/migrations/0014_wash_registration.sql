-- =====================================================================
--  O1 · Register the car wash.
--
--  Two things had to exist before that screen could be written.
--
--  ONE — an insert guard.
--
--  0010 stopped an owner from UPDATEing status, credit and the cached stats.
--  Nothing stopped them from INSERTing those values in the first place.
--  "owner manages wash" is `for all` with `check (owner_id = auth.uid())`,
--  which asks who the row belongs to and nothing else, so this succeeded
--  from an ordinary authenticated session:
--
--    insert into car_washes (..., status, credit_balance, free_washes_left,
--                            rating_avg, rating_count)
--    values (..., 'approved', 9999999, 9999, 5.0, 4000);
--
--  and the wash appeared in nearby_car_washes() immediately — approved
--  without D2, funded without a transfer, five stars from four thousand
--  reviews that were never written. Verified against a local database before
--  writing this. O1 is the screen that performs the insert, so shipping it
--  without this guard would have handed every owner a self-approval button.
--
--  TWO — a way to write the location at all.
--
--  car_washes.location is a PostGIS geography. PostgREST cannot be handed
--  one from the client in any form worth relying on, so registration goes
--  through an RPC that takes a latitude and a longitude and builds the point
--  server-side. That also gives the validation somewhere honest to live.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The insert guard.
--
-- SECURITY INVOKER, like guard_car_wash_update() and for the same reason:
-- it has to be able to tell a request that came from a person from one that
-- came through a definer function or a migration, and current_user is the
-- only honest answer to that. See the note in 0010.
-- ---------------------------------------------------------------------
create or replace function guard_car_wash_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_free int;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if is_admin() then
    return new;
  end if;

  -- A wash belongs to whoever registered it. The RLS policy says the same,
  -- but saying it here means the rest of this function can trust it.
  if new.owner_id is distinct from auth.uid() then
    raise exception 'a car wash belongs to the owner who registered it'
      using errcode = 'insufficient_privilege';
  end if;

  -- Every application starts at the beginning, whatever the client sent.
  -- Overwritten rather than rejected: a client that omits these columns and
  -- one that lies about them should end up in the same place.
  new.status           := 'pending';
  new.credit_balance   := 0;
  new.rating_avg       := 0;
  new.rating_count     := 0;
  new.cancel_rate      := 0;
  new.review_note      := null;
  new.reviewed_at      := null;
  new.reviewed_by      := null;

  -- The welcome quota is a platform setting, not a number the applicant
  -- chooses. D9 edits it; 0001's column default is only the fallback.
  select (value #>> '{}')::int into v_free
    from platform_settings where key = 'free_washes_new';

  new.free_washes_left := coalesce(v_free, 100);

  return new;
end $$;

comment on function guard_car_wash_insert() is
  'Every car wash starts pending, unfunded and unrated. Before this, an owner could INSERT themselves approved with a balance and a five-star rating.';

create trigger car_washes_guard_insert
  before insert on car_washes
  for each row execute function guard_car_wash_insert();

-- D9 already edits platform_settings, so the quota joins the fees there
-- rather than living only as a column default nobody can see.
insert into platform_settings (key, value) values ('free_washes_new', '100')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 2. Registration.
--
-- Returns the new id, which O1 needs immediately: the photos are uploaded to
-- media/wash-photos/<wash_id>/ and that path does not exist until the row
-- does. So the row is created first and the photos are attached after — see
-- set_wash_photos() below.
-- ---------------------------------------------------------------------
create or replace function register_car_wash(
  p_name        text,
  p_description text,
  p_address     text,
  p_city        text,
  p_lat         double precision,
  p_lng         double precision,
  p_phone       text,
  p_bays        int,
  p_opens_at    time,
  p_closes_at   time
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_role user_role;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;

  select role into v_role from profiles where id = auth.uid();

  if v_role is distinct from 'owner' then
    raise exception 'only an owner can register a car wash'
      using errcode = 'insufficient_privilege';
  end if;

  -- One undecided application at a time.
  --
  -- Deliberately a check here and not a unique index on the table. A chain
  -- with two branches is an ordinary Moroccan business and the schema should
  -- not forbid it; what must not happen is O1 being submitted twice, which
  -- puts a duplicate in D2's queue and leaves the owner looking at whichever
  -- row getMyWash() happened to pick. 'approved' is not blocked — a second
  -- branch is a product decision for later, not something to rule out in a
  -- migration about registration.
  if exists (
    select 1 from car_washes
     where owner_id = auth.uid()
       and status in ('pending', 'rejected')
  ) then
    raise exception 'you already have an application waiting on a decision';
  end if;

  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'a car wash needs a name';
  end if;

  if btrim(coalesce(p_address, '')) = '' then
    raise exception 'a car wash needs an address';
  end if;

  -- Not a general bounds check: a pin outside Morocco is a mistake on the
  -- map picker, and letting it through means a wash that never appears in
  -- anyone's C1 and nobody can explain why.
  if p_lat is null or p_lng is null
  or p_lat not between 20.0 and 36.5
  or p_lng not between -18.0 and -0.5 then
    raise exception 'that pin is not in Morocco';
  end if;

  if p_bays is null or p_bays < 1 then
    raise exception 'a car wash has at least one bay';
  end if;

  -- Hours drive the is_open calculation in 0004. Equal hours would mean a
  -- wash that is never open and never says so.
  if p_opens_at is null or p_closes_at is null or p_opens_at = p_closes_at then
    raise exception 'opening and closing hours must differ';
  end if;

  insert into car_washes
    (owner_id, name, description, address, city, location, phone,
     bays_count, opens_at, closes_at)
  values
    (auth.uid(), btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''),
     btrim(p_address), btrim(p_city),
     st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
     nullif(btrim(coalesce(p_phone, '')), ''),
     p_bays, p_opens_at, p_closes_at)
  returning id into v_id;

  return v_id;
end $$;

comment on function register_car_wash(text, text, text, text, double precision, double precision, text, int, time, time) is
  'O1. Creates the application and returns its id, so the photos can be uploaded under wash-photos/<id>/ and attached afterwards.';

-- ---------------------------------------------------------------------
-- 4. Photos and the pin, after the fact.
--
-- Photos are a plain text[] of storage paths and could have been an
-- ordinary UPDATE — but the pin cannot, and O1 and O2 both save the two
-- together. One call keeps them from drifting apart.
--
-- Null means "leave it alone", so O2's edit can move the pin without
-- resending every photo.
-- ---------------------------------------------------------------------
create or replace function set_wash_media(
  p_wash_id uuid,
  p_photos  text[] default null,
  p_lat     double precision default null,
  p_lng     double precision default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not owns_wash(p_wash_id) and not is_admin() then
    raise exception 'that is not your car wash'
      using errcode = 'insufficient_privilege';
  end if;

  if p_photos is not null then
    update car_washes set photos = p_photos where id = p_wash_id;
  end if;

  if p_lat is not null or p_lng is not null then
    if p_lat is null or p_lng is null then
      raise exception 'a pin needs both a latitude and a longitude';
    end if;

    if p_lat not between 20.0 and 36.5 or p_lng not between -18.0 and -0.5 then
      raise exception 'that pin is not in Morocco';
    end if;

    update car_washes
       set location = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
     where id = p_wash_id;
  end if;
end $$;

comment on function set_wash_media(uuid, text[], double precision, double precision) is
  'O1/O2/O5. Attaches photos and moves the pin. Null arguments are left untouched.';

-- ---------------------------------------------------------------------
-- 5. The pin, for anyone allowed to see the wash.
--
-- nearby_car_washes() returns coordinates but only for approved washes
-- within a radius. An owner looking at their own pending application, and
-- an admin looking at it in D2, both need the pin without either of those
-- being true. D2 has it through pending_washes(); this is O1/O2/O5's.
-- ---------------------------------------------------------------------
create or replace function my_wash_pin(p_wash_id uuid)
returns table (latitude double precision, longitude double precision)
language sql
stable
security definer
set search_path = public
as $$
  select st_y(location::geometry), st_x(location::geometry)
    from car_washes
   where id = p_wash_id
     and (owns_wash(p_wash_id) or is_admin());
$$;

comment on function my_wash_pin(uuid) is
  'O1/O2/O5. The wash''s own coordinates, for the owner and for admins. Approval and radius do not apply.';

revoke all on function register_car_wash(text, text, text, text, double precision, double precision, text, int, time, time) from public;
revoke all on function set_wash_media(uuid, text[], double precision, double precision) from public;
revoke all on function my_wash_pin(uuid) from public;
grant execute on function register_car_wash(text, text, text, text, double precision, double precision, text, int, time, time) to authenticated;
grant execute on function set_wash_media(uuid, text[], double precision, double precision) to authenticated;
grant execute on function my_wash_pin(uuid) to authenticated;
