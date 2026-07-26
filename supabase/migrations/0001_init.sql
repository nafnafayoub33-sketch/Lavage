-- =====================================================================
--  LAVAGE PLATFORM — Database schema (PostgreSQL / Supabase)
--  Money is stored in CENTIMES (integer). 1 DH = 100.
--  Phase 1 : queue + bookings + credit billing
--  Phase 2 : mobile wash (escrow) + loyalty  -> marked [P2]
-- =====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists postgis;

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type user_role as enum ('admin', 'owner', 'client');

create type wash_status as enum ('pending', 'approved', 'suspended', 'closed');

create type booking_status as enum (
  'pending',        -- client booked, waiting in queue
  'in_progress',    -- owner started the wash
  'done',           -- owner marked finished, waiting client confirmation
  'confirmed',      -- client confirmed (or auto-confirmed after 2h) -> billed
  'cancelled_client',
  'cancelled_owner',
  'no_show'         -- client never came
);

create type cancel_reason as enum (
  'closed_today', 'no_water', 'power_cut', 'too_busy', 'holiday',
  'client_changed_mind', 'other'
);

create type credit_tx_type as enum ('topup', 'charge', 'refund', 'bonus');

create type payment_method as enum ('cash', 'card', 'wallet');

-- ---------------------------------------------------------------------
-- PROFILES  (extends auth.users)
-- ---------------------------------------------------------------------
create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  role          user_role   not null default 'client',
  full_name     text        not null,
  phone         text        unique,
  avatar_url    text,
  city          text,
  no_show_count int         not null default 0,
  is_blocked    boolean     not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CAR WASHES
-- ---------------------------------------------------------------------
create table car_washes (
  id             uuid primary key default uuid_generate_v4(),
  owner_id       uuid not null references profiles(id) on delete cascade,
  name           text not null,
  description    text,
  address        text not null,
  city           text not null,
  location       geography(Point, 4326) not null,
  phone          text,
  photos         text[] not null default '{}',
  bays_count     int  not null default 1 check (bays_count > 0),
  opens_at       time not null default '08:00',
  closes_at      time not null default '20:00',
  status         wash_status not null default 'pending',
  is_open_now    boolean not null default true,  -- owner "closed today" switch

  -- billing
  credit_balance   int not null default 0,   -- centimes
  free_washes_left int not null default 100, -- welcome quota

  -- cached stats (updated by triggers / cron)
  rating_avg     numeric(2,1) not null default 0,
  rating_count   int not null default 0,
  cancel_rate    numeric(4,3) not null default 0,

  created_at     timestamptz not null default now()
);

create index car_washes_location_idx on car_washes using gist (location);
create index car_washes_owner_idx    on car_washes (owner_id);

-- ---------------------------------------------------------------------
-- SERVICES  (price list per car wash)
-- ---------------------------------------------------------------------
create table services (
  id            uuid primary key default uuid_generate_v4(),
  car_wash_id   uuid not null references car_washes(id) on delete cascade,
  name          text not null,                 -- "Lavage complet"
  price         int  not null check (price >= 0),
  duration_min  int  not null check (duration_min > 0),
  vehicle_type  text not null default 'all',   -- all | small | suv | van
  is_active     boolean not null default true
);

create index services_wash_idx on services (car_wash_id) where is_active;

-- ---------------------------------------------------------------------
-- VEHICLES
-- ---------------------------------------------------------------------
create table vehicles (
  id         uuid primary key default uuid_generate_v4(),
  client_id  uuid not null references profiles(id) on delete cascade,
  brand      text,
  model      text,
  plate      text,
  color      text,
  photo_url  text,
  is_default boolean not null default false
);

create index vehicles_client_idx on vehicles (client_id);

-- ---------------------------------------------------------------------
-- BOOKINGS  (the queue)
-- ---------------------------------------------------------------------
create table bookings (
  id             uuid primary key default uuid_generate_v4(),
  car_wash_id    uuid not null references car_washes(id) on delete cascade,
  client_id      uuid not null references profiles(id) on delete cascade,
  vehicle_id     uuid references vehicles(id) on delete set null,
  service_id     uuid not null references services(id),

  status         booking_status not null default 'pending',
  price          int  not null,
  payment_method payment_method not null default 'cash',

  ticket_no      int  not null,          -- daily sequence per wash
  estimated_at   timestamptz,            -- computed ETA

  started_at     timestamptz,
  finished_at    timestamptz,
  confirmed_at   timestamptz,
  cancelled_at   timestamptz,
  cancel_reason  cancel_reason,

  created_at     timestamptz not null default now()
);

create index bookings_queue_idx  on bookings (car_wash_id, created_at)
  where status in ('pending', 'in_progress');
create index bookings_client_idx on bookings (client_id, created_at desc);

-- one active booking per client at a time
create unique index bookings_one_active_per_client
  on bookings (client_id)
  where status in ('pending', 'in_progress', 'done');

-- ---------------------------------------------------------------------
-- CREDIT LEDGER  (1 DH per confirmed wash)
-- ---------------------------------------------------------------------
create table credit_transactions (
  id            uuid primary key default uuid_generate_v4(),
  car_wash_id   uuid not null references car_washes(id) on delete cascade,
  type          credit_tx_type not null,
  amount        int not null,             -- +topup / -charge, centimes
  balance_after int not null,
  booking_id    uuid references bookings(id),
  note          text,
  created_at    timestamptz not null default now()
);

create index credit_tx_wash_idx on credit_transactions (car_wash_id, created_at desc);

-- ---------------------------------------------------------------------
-- REVIEWS
-- ---------------------------------------------------------------------
create table reviews (
  booking_id  uuid primary key references bookings(id) on delete cascade,
  car_wash_id uuid not null references car_washes(id) on delete cascade,
  client_id   uuid not null references profiles(id) on delete cascade,
  rating      int  not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PUSH TOKENS
-- ---------------------------------------------------------------------
create table device_tokens (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references profiles(id) on delete cascade,
  token      text not null unique,
  platform   text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now()
);

-- =====================================================================
--  BUSINESS LOGIC
-- =====================================================================

-- Billing rate: 1 DH per confirmed wash
create table platform_settings (
  key   text primary key,
  value jsonb not null
);
insert into platform_settings (key, value) values
  ('wash_fee_centimes', '100'),
  ('auto_confirm_hours', '2'),
  ('cancel_rate_warning', '0.20'),
  ('cancel_rate_suspend', '0.40');

-- ---------------------------------------------------------------------
-- Daily ticket number
-- ---------------------------------------------------------------------
create or replace function set_ticket_no()
returns trigger language plpgsql as $$
begin
  select coalesce(max(ticket_no), 0) + 1
    into new.ticket_no
    from bookings
   where car_wash_id = new.car_wash_id
     and created_at::date = current_date;
  return new;
end $$;

create trigger bookings_ticket_no
  before insert on bookings
  for each row execute function set_ticket_no();

-- ---------------------------------------------------------------------
-- Queue position + estimated wait
--   wait = ceil(cars_ahead / bays) * avg_service_duration
-- ---------------------------------------------------------------------
create or replace function queue_state(p_wash_id uuid)
returns table (cars_ahead int, wait_minutes int)
language sql stable as $$
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

-- ---------------------------------------------------------------------
-- Nearby car washes (map screen)
-- ---------------------------------------------------------------------
create or replace function nearby_car_washes(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int default 10000
)
returns table (
  id uuid, name text, address text, photos text[],
  distance_m int, rating_avg numeric, bays_count int,
  cars_ahead int, wait_minutes int, is_available boolean
)
language sql stable as $$
  select cw.id, cw.name, cw.address, cw.photos,
         st_distance(cw.location,
           st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)::int,
         cw.rating_avg, cw.bays_count,
         qs.cars_ahead, qs.wait_minutes,
         (cw.is_open_now
          and (cw.credit_balance > 0 or cw.free_washes_left > 0)
          and current_time between cw.opens_at and cw.closes_at)
    from car_washes cw
    cross join lateral queue_state(cw.id) qs
   where cw.status = 'approved'
     and st_dwithin(cw.location,
           st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_m)
   order by 4;
$$;

-- ---------------------------------------------------------------------
-- Charge the car wash 1 DH when a booking is confirmed
-- ---------------------------------------------------------------------
create or replace function charge_wash_on_confirm()
returns trigger language plpgsql as $$
declare
  v_fee     int;
  v_free    int;
  v_balance int;
begin
  if new.status <> 'confirmed' or old.status = 'confirmed' then
    return new;
  end if;

  select (value #>> '{}')::int into v_fee
    from platform_settings where key = 'wash_fee_centimes';

  select free_washes_left, credit_balance into v_free, v_balance
    from car_washes where id = new.car_wash_id for update;

  if v_free > 0 then
    update car_washes
       set free_washes_left = free_washes_left - 1
     where id = new.car_wash_id;

    insert into credit_transactions
      (car_wash_id, type, amount, balance_after, booking_id, note)
    values (new.car_wash_id, 'bonus', 0, v_balance, new.id, 'free quota');
  else
    update car_washes
       set credit_balance = credit_balance - v_fee
     where id = new.car_wash_id
    returning credit_balance into v_balance;

    insert into credit_transactions
      (car_wash_id, type, amount, balance_after, booking_id)
    values (new.car_wash_id, 'charge', -v_fee, v_balance, new.id);
  end if;

  new.confirmed_at := now();
  return new;
end $$;

create trigger bookings_charge_credit
  before update of status on bookings
  for each row execute function charge_wash_on_confirm();

-- ---------------------------------------------------------------------
-- Auto-confirm bookings left untouched for 2h  (run by pg_cron / edge fn)
-- ---------------------------------------------------------------------
create or replace function auto_confirm_stale_bookings()
returns int language plpgsql as $$
declare
  v_hours int;
  v_count int;
begin
  select (value #>> '{}')::int into v_hours
    from platform_settings where key = 'auto_confirm_hours';

  with updated as (
    update bookings
       set status = 'confirmed'
     where status = 'done'
       and finished_at < now() - (v_hours || ' hours')::interval
    returning 1
  )
  select count(*) into v_count from updated;

  return v_count;
end $$;

-- ---------------------------------------------------------------------
-- Refresh cancel rate + auto-suspend abusive owners
-- ---------------------------------------------------------------------
create or replace function refresh_cancel_rates()
returns void language plpgsql as $$
begin
  update car_washes cw
     set cancel_rate = coalesce(s.rate, 0)
    from (
      select car_wash_id,
             count(*) filter (where status = 'cancelled_owner')::numeric
               / nullif(count(*), 0) as rate
        from bookings
       where created_at > now() - interval '30 days'
       group by car_wash_id
    ) s
   where s.car_wash_id = cw.id;

  update car_washes
     set status = 'suspended'
   where status = 'approved'
     and cancel_rate >= (select (value #>> '{}')::numeric
                           from platform_settings
                          where key = 'cancel_rate_suspend');
end $$;

-- ---------------------------------------------------------------------
-- Keep rating cache in sync
-- ---------------------------------------------------------------------
create or replace function refresh_wash_rating()
returns trigger language plpgsql as $$
begin
  update car_washes cw
     set rating_avg   = s.avg_rating,
         rating_count = s.cnt
    from (
      select round(avg(rating), 1) as avg_rating, count(*) as cnt
        from reviews where car_wash_id = new.car_wash_id
    ) s
   where cw.id = new.car_wash_id;
  return new;
end $$;

create trigger reviews_refresh_rating
  after insert or update on reviews
  for each row execute function refresh_wash_rating();

-- =====================================================================
--  ROW LEVEL SECURITY
-- =====================================================================
alter table profiles            enable row level security;
alter table car_washes          enable row level security;
alter table services            enable row level security;
alter table vehicles            enable row level security;
alter table bookings            enable row level security;
alter table credit_transactions enable row level security;
alter table reviews             enable row level security;
alter table device_tokens       enable row level security;

create or replace function is_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function owns_wash(p_wash_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from car_washes where id = p_wash_id and owner_id = auth.uid()
  );
$$;

-- profiles
create policy "read own profile"   on profiles for select using (id = auth.uid() or is_admin());
create policy "update own profile" on profiles for update using (id = auth.uid());

-- car_washes
create policy "public read approved" on car_washes for select
  using (status = 'approved' or owner_id = auth.uid() or is_admin());
create policy "owner manages wash"   on car_washes for all
  using (owner_id = auth.uid() or is_admin())
  with check (owner_id = auth.uid() or is_admin());

-- services
create policy "public read services" on services for select using (true);
create policy "owner manages services" on services for all
  using (owns_wash(car_wash_id) or is_admin())
  with check (owns_wash(car_wash_id) or is_admin());

-- vehicles
create policy "client owns vehicles" on vehicles for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());

-- bookings
create policy "read own bookings" on bookings for select
  using (client_id = auth.uid() or owns_wash(car_wash_id) or is_admin());
create policy "client creates booking" on bookings for insert
  with check (client_id = auth.uid());
create policy "client or owner updates" on bookings for update
  using (client_id = auth.uid() or owns_wash(car_wash_id) or is_admin());

-- credit
create policy "owner reads own credit" on credit_transactions for select
  using (owns_wash(car_wash_id) or is_admin());

-- reviews
create policy "public read reviews" on reviews for select using (true);
create policy "client writes review" on reviews for insert
  with check (client_id = auth.uid());

-- device tokens
create policy "own tokens" on device_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
