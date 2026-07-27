-- =====================================================================
--  RLS and privilege tests for 0002 and 0003.
--
--  This is the only automated cover for the guard that stops a signed-in
--  user granting themselves admin. Before 0003 shipped, one statement took
--  a blocked client to role=admin, is_blocked=false, no_show_count=0.
--
--  Every assertion is a DO block that fails loudly. An expected refusal is
--  caught by SQLSTATE; anything else propagates and fails the run. psql is
--  invoked with ON_ERROR_STOP=1, so the first failure ends it non-zero.
--
--  Run with tests/sql/run.sh, which applies shim.sql and then every
--  migration in order against a throwaway database.
-- =====================================================================
\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------
-- Fixtures, created as the owner so RLS does not apply to the setup.
-- ---------------------------------------------------------------------
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),  -- a blocked client with no-shows
  ('22222222-2222-2222-2222-222222222222'),  -- an admin
  ('33333333-3333-3333-3333-333333333333'),  -- signed in, no profile row yet
  ('44444444-4444-4444-4444-444444444444');  -- ditto

insert into profiles (id, role, full_name, phone, is_blocked, no_show_count) values
  ('11111111-1111-1111-1111-111111111111', 'client', 'Blocked Client',
   '+212612345678', true, 3),
  ('22222222-2222-2222-2222-222222222222', 'admin', 'The Admin',
   '+212700000000', false, 0);

-- =====================================================================
--  0002 — is_phone_blocked(): answers one question and leaks nothing
-- =====================================================================
set role anon;

do $$
begin
  if not is_phone_blocked('+212612345678') then
    raise exception 'FAIL 0002: a blocked number was not reported as blocked';
  end if;
end $$;

do $$
begin
  if is_phone_blocked('+212799999999') then
    raise exception 'FAIL 0002: an unknown number was reported as blocked';
  end if;
end $$;

do $$
begin
  -- The admin exists and is not blocked. Returning false here is what makes
  -- the function useless for discovering who has an account.
  if is_phone_blocked('+212700000000') then
    raise exception 'FAIL 0002: a known, allowed number was reported as blocked';
  end if;
end $$;

reset role;

-- =====================================================================
--  0003 — a user may not rewrite their own privileges
-- =====================================================================
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
begin
  begin
    update profiles set role = 'admin' where id = auth.uid();
    raise exception 'FAIL 0003: a client granted itself admin';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    -- A5 says the role cannot change at all, not merely that it cannot rise.
    update profiles set role = 'owner' where id = auth.uid();
    raise exception 'FAIL 0003: a client changed its own role to owner';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    update profiles set is_blocked = false where id = auth.uid();
    raise exception 'FAIL 0003: a blocked user unblocked itself';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    -- Clearing this would walk straight through the three-strike booking block.
    update profiles set no_show_count = 0 where id = auth.uid();
    raise exception 'FAIL 0003: a user cleared its own no_show_count';
  exception when insufficient_privilege then null;
  end;
end $$;

-- The guard must not break ordinary profile editing (A6, C11).
update profiles set full_name = 'Renamed', city = 'Casablanca' where id = auth.uid();

do $$
declare
  r record;
begin
  select role, is_blocked, no_show_count, full_name, city into r
    from profiles where id = auth.uid();

  if r.full_name <> 'Renamed' or r.city <> 'Casablanca' then
    raise exception 'FAIL 0003: an ordinary profile edit was refused';
  end if;

  if r.role <> 'client' or not r.is_blocked or r.no_show_count <> 3 then
    raise exception 'FAIL 0003: privileged columns changed despite the refusals (role=%, blocked=%, no_shows=%)',
      r.role, r.is_blocked, r.no_show_count;
  end if;
end $$;

-- =====================================================================
--  0003 — creating your own profile (A6)
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

do $$
begin
  begin
    insert into profiles (id, role, full_name) values (auth.uid(), 'admin', 'Sneaky');
    raise exception 'FAIL 0003: a user created itself as an admin';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    insert into profiles (id, role, full_name)
      values ('44444444-4444-4444-4444-444444444444', 'client', 'Hijack');
    raise exception 'FAIL 0003: a user created a profile for somebody else';
  exception when insufficient_privilege then null;
  end;
end $$;

-- The case A6 actually needs.
insert into profiles (id, role, full_name, city) values (auth.uid(), 'owner', 'New Owner', 'Rabat');

do $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'owner') then
    raise exception 'FAIL 0003: A6 could not create its own profile row';
  end if;
end $$;

-- =====================================================================
--  0003 — admins moderate other people (D3, D5)
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

update profiles
   set role = 'owner', is_blocked = true, no_show_count = 9
 where id = '11111111-1111-1111-1111-111111111111';

do $$
declare
  r record;
begin
  select role, is_blocked, no_show_count into r
    from profiles where id = '11111111-1111-1111-1111-111111111111';

  if r.role <> 'owner' or not r.is_blocked or r.no_show_count <> 9 then
    raise exception 'FAIL 0003: an admin could not moderate another user';
  end if;
end $$;

-- =====================================================================
--  0003 — the server is not what this guards against
-- =====================================================================
reset role;
reset request.jwt.claim.sub;

-- The no-show flow will need this: an owner marking a client absent has to
-- raise that client's counter, and RLS stops any end user writing another
-- user's row. That increment runs server-side, with no JWT in context.
update profiles set no_show_count = no_show_count + 1
 where id = '11111111-1111-1111-1111-111111111111';

do $$
begin
  if (select no_show_count from profiles
       where id = '11111111-1111-1111-1111-111111111111') <> 10 then
    raise exception 'FAIL 0003: a server-side write was blocked';
  end if;
end $$;

\echo 'All RLS and privilege assertions passed.'
