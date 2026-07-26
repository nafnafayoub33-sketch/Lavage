-- =====================================================================
--  A3 (phone entry) needs to know a number is blocked BEFORE spending an
--  SMS on it. RLS on `profiles` only exposes is_blocked to the owner of the
--  row, and at A3 nobody is authenticated yet — so the check gets its own
--  narrow, security-definer function instead of a weaker policy.
--
--  It answers exactly one question: "is this number blocked?".
--  An unknown number and an allowed number are indistinguishable — both
--  return false — so this cannot be used to enumerate registered users.
--  The only fact it reveals is the one A3 is about to display anyway.
--
--  The client re-checks is_blocked after verification as well; this
--  function saves an SMS, it is not the enforcement point.
-- =====================================================================

create or replace function is_phone_blocked(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from profiles
     where phone = p_phone
       and is_blocked
  );
$$;

comment on function is_phone_blocked(text) is
  'A3 pre-flight check. True only for blocked numbers; unknown numbers return false.';

-- security definer functions are executable by everyone by default
revoke all on function is_phone_blocked(text) from public;
grant execute on function is_phone_blocked(text) to anon, authenticated;
