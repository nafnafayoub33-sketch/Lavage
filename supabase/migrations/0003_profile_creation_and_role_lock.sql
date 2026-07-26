-- =====================================================================
--  Who may write to `profiles`.
--
--  1. There was no INSERT policy. RLS denies by default, so A6 could not
--     create the row it exists to create — and nothing in 0001 creates a
--     profile on signup either, so no user could ever have one.
--
--  2. "update own profile" was declared with USING and no WITH CHECK. For
--     UPDATE, Postgres then reuses the USING expression as the check, so the
--     policy permitted a signed-in user to write *any* value to their own
--     row: role = 'admin', or is_blocked = false right after an admin
--     blocked them. A5 promises the role "cannot be changed later except by
--     an admin"; nothing enforced that.
--
--  3. That same policy restricted admins to their own row, so D5's
--     block/unblock could never have worked.
--
--  Fixing (1) without (2) would be worse than either: the insert path hands
--  the user a role column to fill in.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A6 creates the profile row, once the name exists (full_name is NOT NULL).
-- 'admin' is never self-assigned — an admin is made by an admin.
-- ---------------------------------------------------------------------
create policy "create own profile" on profiles for insert
  with check (id = auth.uid() and role <> 'admin');

-- ---------------------------------------------------------------------
-- Admins moderate other people's profiles (D3, D5). Without this the
-- is_admin() branch in the trigger below is unreachable.
-- ---------------------------------------------------------------------
drop policy "update own profile" on profiles;

create policy "update own profile" on profiles for update
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------
-- The columns a user must never write on their own row.
--
-- `role` is locked outright, not merely against escalation: A5 says the
-- choice cannot change except by an admin, so client -> owner is exactly as
-- forbidden as client -> admin.
--
-- `is_blocked` and `no_show_count` are moderation state. A client who could
-- clear their own no_show_count would walk straight through the three-strike
-- booking block.
--
-- SECURITY DEFINER because the check calls is_admin(), which reads profiles
-- and must not be subject to the policies it is helping enforce.
-- ---------------------------------------------------------------------
create or replace function prevent_privilege_self_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- No end user in context: edge functions holding the service key, pg_cron,
  -- migrations, psql. This guards against self-service, not against the
  -- server.
  --
  -- NOTE for whoever builds the no-show flow: the owner marking a client
  -- absent has to raise that client's no_show_count, but an owner is an
  -- authenticated end user and RLS already stops them writing another user's
  -- row at all. That increment belongs in a server-side function reached
  -- with the service key, not in a client update.
  if auth.uid() is null then
    return new;
  end if;

  if is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'role can only be changed by an admin'
      using errcode = 'insufficient_privilege';
  end if;

  if new.is_blocked is distinct from old.is_blocked then
    raise exception 'is_blocked can only be changed by an admin'
      using errcode = 'insufficient_privilege';
  end if;

  if new.no_show_count is distinct from old.no_show_count then
    raise exception 'no_show_count can only be changed by an admin'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end $$;

comment on function prevent_privilege_self_change() is
  'Locks role, is_blocked and no_show_count against self-service updates. See A5.';

create trigger profiles_lock_privileged_columns
  before update on profiles
  for each row execute function prevent_privilege_self_change();
