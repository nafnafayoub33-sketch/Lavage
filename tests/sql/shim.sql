-- =====================================================================
--  Stand-in for the parts of Supabase that the migrations assume exist.
--  Test-only — never applied to a real project.
--
--  Supabase provides the `auth` schema, auth.uid(), and the anon /
--  authenticated roles. A bare Postgres does not, so the RLS policies in
--  0001 and 0003 would not even parse without these.
-- =====================================================================
create extension if not exists "uuid-ossp";

create schema if not exists auth;

create table auth.users (
  id uuid primary key default uuid_generate_v4()
);

-- Supabase reads the JWT 'sub' claim. Tests set it with
--   set request.jwt.claim.sub = '<uuid>';
-- and clear it with `reset` to act as the server rather than an end user.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- Supabase ships this publication; Realtime streams whatever is added to it.
-- Creating it here means 0006's ALTER PUBLICATION runs under test rather than
-- being skipped, so a table that never reaches Realtime is a test failure.
create publication supabase_realtime;

-- Roles live in the cluster, not the database, so they survive a dropped test
-- database and must be created conditionally for a re-run to work.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

grant usage on schema public, auth to anon, authenticated;

-- Supabase grants these roles table access and lets RLS decide which rows they
-- actually see. Without it every policy in 0001 would be untestable, because
-- the role would be refused at the table before any policy was consulted.
-- Default privileges apply to the tables the migrations are about to create.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
