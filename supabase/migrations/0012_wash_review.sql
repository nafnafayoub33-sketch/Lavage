-- =====================================================================
--  D2 · Approvals.
--
--  Since 0010 an owner cannot write car_washes.status, which is right and
--  which means no wash can go live without an admin. There was, until now,
--  no way for an admin to do it — the whole product was blocked behind a
--  column nobody could set.
--
--  This adds the three transitions and the paper trail behind them:
--    approve   pending  -> approved   the wash appears in C1
--    reject    pending  -> rejected   with a reason the owner reads on O2
--    resubmit  rejected -> pending    the owner fixes it and tries again
--
--  Each is an RPC rather than an UPDATE, for the same reason as
--  approve_topup: the caller is asking for a decision, not for a column to
--  change, and the checks belong next to the change.
-- =====================================================================

-- 'rejected' is its own status, not a reuse of 'suspended'. Suspended means
-- "was live, has been stopped"; rejected means "was never live". They read
-- differently to the owner and they resume differently — a suspension is
-- lifted by an admin, a rejection is answered by the owner.
--
-- Its own statement on purpose: Postgres will not let a new enum value be
-- used in the same transaction that adds it.
alter type wash_status add value if not exists 'rejected';

alter table car_washes
  add column review_note  text,
  add column reviewed_at  timestamptz,
  add column reviewed_by  uuid references profiles(id);

comment on column car_washes.review_note is
  'The admin''s reason, shown to the owner on O2. Cleared on approval.';

-- ---------------------------------------------------------------------
-- The owner may not write the verdict on themselves.
--
-- 0010 already blocks status. The three review columns need the same
-- treatment, or an owner could clear their own rejection reason and O2
-- would show an empty explanation.
-- ---------------------------------------------------------------------
create or replace function guard_car_wash_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Deliberately current_user, not auth.uid(). See 0010 — a SECURITY
  -- DEFINER function swaps the role but leaves the JWT alone, so auth.uid()
  -- here is still the person who triggered the write.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if is_admin() then
    return new;
  end if;

  -- D2 approves and rejects, D3 suspends. Never the owner.
  if new.status is distinct from old.status then
    raise exception 'a car wash status can only be changed by an admin'
      using errcode = 'insufficient_privilege';
  end if;

  -- The verdict and who signed it. Written only by the review RPCs below,
  -- which are SECURITY DEFINER and so never reach this branch.
  if new.review_note is distinct from old.review_note
  or new.reviewed_at is distinct from old.reviewed_at
  or new.reviewed_by is distinct from old.reviewed_by then
    raise exception 'the review is written by the admin who made it'
      using errcode = 'insufficient_privilege';
  end if;

  if new.credit_balance   is distinct from old.credit_balance
  or new.free_washes_left is distinct from old.free_washes_left then
    raise exception 'credit can only be changed by billing or an admin'
      using errcode = 'insufficient_privilege';
  end if;

  if new.rating_avg   is distinct from old.rating_avg
  or new.rating_count is distinct from old.rating_count
  or new.cancel_rate  is distinct from old.cancel_rate then
    raise exception 'ratings and cancel rates are maintained by the platform'
      using errcode = 'insufficient_privilege';
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'ownership can only be changed by an admin'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end $$;

comment on function guard_car_wash_update() is
  'Columns on car_washes an owner may not write: status, the review verdict, credit, cached stats, ownership.';

-- ---------------------------------------------------------------------
-- The queue for D2.
--
-- "public read approved" already lets an admin select anything, so this
-- exists for the join, not for access: the screen needs the owner's name
-- and number to call them about a rejected application, and profiles is
-- readable to admins but the client has no business assembling that join
-- itself.
-- ---------------------------------------------------------------------
create or replace function pending_washes()
returns table (
  id            uuid,
  name          text,
  address       text,
  city          text,
  phone         text,
  photos        text[],
  bays_count    int,
  opens_at      time,
  closes_at     time,
  latitude      double precision,
  longitude     double precision,
  created_at    timestamptz,
  owner_name    text,
  owner_phone   text,
  service_count int
)
language sql
stable
security definer
set search_path = public
as $$
  select cw.id,
         cw.name,
         cw.address,
         cw.city,
         cw.phone,
         cw.photos,
         cw.bays_count,
         cw.opens_at,
         cw.closes_at,
         st_y(cw.location::geometry),
         st_x(cw.location::geometry),
         cw.created_at,
         p.full_name,
         p.phone,
         (select count(*)::int from services s
           where s.car_wash_id = cw.id and s.is_active)
    from car_washes cw
    join profiles p on p.id = cw.owner_id
   where cw.status = 'pending'
     and is_admin()
   order by cw.created_at;
$$;

comment on function pending_washes() is
  'D2. Applications waiting on a decision, oldest first. Admin only — the is_admin() predicate is inside the query, so a non-admin gets zero rows rather than an error.';

revoke all on function pending_washes() from public;
grant execute on function pending_washes() to authenticated;

-- ---------------------------------------------------------------------
-- Approve.
--
-- Only from pending. Approving something already approved is not a no-op
-- worth allowing quietly: it means the admin is looking at a stale list,
-- and the honest answer is to say so and let them reload.
-- ---------------------------------------------------------------------
create or replace function approve_wash(p_wash_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'only an admin can approve a car wash'
      using errcode = 'insufficient_privilege';
  end if;

  update car_washes
     set status      = 'approved',
         -- The application succeeded; the old reason is not history worth
         -- keeping in the column the owner reads.
         review_note = null,
         reviewed_at = now(),
         reviewed_by = auth.uid()
   where id = p_wash_id
     and status = 'pending';

  if not found then
    raise exception 'no car wash awaiting approval with that id';
  end if;
end $$;

comment on function approve_wash(uuid) is
  'D2. pending -> approved. The wash starts appearing in C1. Admin only.';

-- ---------------------------------------------------------------------
-- Reject.
--
-- The reason is the point of the transition — O2 shows it verbatim and it
-- is the only thing telling the owner what to fix. An empty one turns the
-- screen into a dead end, so it is refused here rather than trusted to the
-- form.
-- ---------------------------------------------------------------------
create or replace function reject_wash(p_wash_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'only an admin can reject a car wash'
      using errcode = 'insufficient_privilege';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'a rejection needs a reason the owner can act on';
  end if;

  update car_washes
     set status      = 'rejected',
         review_note = btrim(p_reason),
         reviewed_at = now(),
         reviewed_by = auth.uid()
   where id = p_wash_id
     and status = 'pending';

  if not found then
    raise exception 'no car wash awaiting approval with that id';
  end if;
end $$;

comment on function reject_wash(uuid, text) is
  'D2. pending -> rejected, with a reason shown to the owner on O2. Admin only.';

-- ---------------------------------------------------------------------
-- Resubmit.
--
-- The owner's half of the loop. O2 says "Submit again", and without this
-- the owner would have to ask an admin to move a column by hand.
--
-- Only out of `rejected`: this is not a way back from `suspended`, which is
-- a decision about a wash that was already live and is an admin's to undo.
-- ---------------------------------------------------------------------
create or replace function resubmit_wash(p_wash_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not owns_wash(p_wash_id) then
    raise exception 'that is not your car wash'
      using errcode = 'insufficient_privilege';
  end if;

  update car_washes
     set status      = 'pending',
         reviewed_at = null,
         reviewed_by = null
         -- review_note stays: the owner is still reading it while they fix
         -- the application, and the next decision overwrites it.
   where id = p_wash_id
     and status = 'rejected';

  if not found then
    raise exception 'only a rejected application can be submitted again';
  end if;
end $$;

comment on function resubmit_wash(uuid) is
  'O2. rejected -> pending after the owner has fixed the application. Owner only.';

revoke all on function approve_wash(uuid) from public;
revoke all on function reject_wash(uuid, text) from public;
revoke all on function resubmit_wash(uuid) from public;
grant execute on function approve_wash(uuid) to authenticated;
grant execute on function reject_wash(uuid, text) to authenticated;
grant execute on function resubmit_wash(uuid) to authenticated;
