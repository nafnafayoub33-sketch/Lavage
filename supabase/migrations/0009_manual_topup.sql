-- =====================================================================
--  Manual top-up (O7, phase 1) — and the table that was guarding nothing.
--
--  The owner transfers money to the platform's bank account, submits the
--  reference, and waits. An admin checks the bank and approves, which is what
--  actually moves the balance. No card provider in phase 1.
--
--  The screen talks to a PaymentGateway interface, so the card provider drops
--  in later without O7 changing. This migration is that interface's
--  phase-1 backing store.
--
--  Separately: platform_settings never had RLS enabled. 0001 turns it on for
--  eight tables and this is not one of them, so with Supabase's default
--  grants any signed-in user could write it. Measured:
--
--      fee before: 100
--      fee after a plain client wrote to it: 0
--
--  wash_fee_centimes is what the platform charges. It is fixed here.
-- =====================================================================

-- ---------------------------------------------------------------------
-- platform_settings: everyone reads, only admins write.
--
-- Reading is fine and necessary — clients need the auto-confirm delay, O7
-- needs the bank details. Writing is D9, and D9 is admin-only.
-- ---------------------------------------------------------------------
alter table platform_settings enable row level security;

create policy "public read settings" on platform_settings for select using (true);
create policy "admin writes settings" on platform_settings for all
  using (is_admin()) with check (is_admin());

-- Where owners send the money. Admin-editable through D9 like every other
-- setting, rather than hardcoded in a screen.
insert into platform_settings (key, value) values
  ('bank_transfer', jsonb_build_object(
    'bank', '', 'account_holder', '', 'rib', '', 'note', ''
  ))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Top-up requests
-- ---------------------------------------------------------------------
create type topup_status as enum ('pending', 'approved', 'rejected');

create table topup_requests (
  id           uuid primary key default uuid_generate_v4(),
  car_wash_id  uuid not null references car_washes(id) on delete cascade,
  amount       int  not null check (amount > 0),   -- centimes, like all money
  reference    text not null,                      -- the owner's transfer reference
  receipt_url  text,                               -- optional photo, storage lands later
  status       topup_status not null default 'pending',
  admin_note   text,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid references profiles(id)
);

create index topup_requests_wash_idx on topup_requests (car_wash_id, created_at desc);
create index topup_requests_pending_idx on topup_requests (created_at) where status = 'pending';

alter table topup_requests enable row level security;

create policy "owner reads own topups" on topup_requests for select
  using (owns_wash(car_wash_id) or is_admin());

-- An owner may ask, and only ask: status and the admin's note are not theirs
-- to set, and an approved row is not something you can submit.
create policy "owner asks for topup" on topup_requests for insert
  with check (owns_wash(car_wash_id) and status = 'pending' and admin_note is null);

-- Deliberately no UPDATE policy for owners. Reviewing happens through the
-- functions below, which are the only things that move money.
create policy "admin reviews topups" on topup_requests for update
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- Approval is the only thing that credits an account.
--
-- SECURITY DEFINER for the reason 0008 found the hard way: credit_transactions
-- has a SELECT policy and nothing else, so any ledger write from an ordinary
-- session is refused. Every credit lands as a credit_transaction with a
-- reason, the same as a charge does.
-- ---------------------------------------------------------------------
create or replace function approve_topup(p_request_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wash    uuid;
  v_amount  int;
  v_ref     text;
  v_balance int;
begin
  if not is_admin() then
    raise exception 'only an admin can approve a top-up'
      using errcode = 'insufficient_privilege';
  end if;

  -- FOR UPDATE, so two admins tapping approve cannot credit it twice.
  select car_wash_id, amount, reference
    into v_wash, v_amount, v_ref
    from topup_requests
   where id = p_request_id and status = 'pending'
     for update;

  if v_wash is null then
    raise exception 'no pending top-up with that id';
  end if;

  update car_washes
     set credit_balance = credit_balance + v_amount
   where id = v_wash
  returning credit_balance into v_balance;

  insert into credit_transactions
    (car_wash_id, type, amount, balance_after, note)
  values (v_wash, 'topup', v_amount, v_balance,
          coalesce(p_note, 'bank transfer ' || v_ref));

  update topup_requests
     set status = 'approved',
         admin_note = p_note,
         reviewed_at = now(),
         reviewed_by = auth.uid()
   where id = p_request_id;
end $$;

comment on function approve_topup(uuid, text) is
  'D8/D3. Credits a wash from an approved bank transfer and writes the ledger row. Admin only.';

create or replace function reject_topup(p_request_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'only an admin can reject a top-up'
      using errcode = 'insufficient_privilege';
  end if;

  update topup_requests
     set status = 'rejected',
         admin_note = p_note,
         reviewed_at = now(),
         reviewed_by = auth.uid()
   where id = p_request_id and status = 'pending';

  if not found then
    raise exception 'no pending top-up with that id';
  end if;
end $$;

comment on function reject_topup(uuid, text) is
  'D8/D3. Declines a bank transfer with a reason. Moves no money. Admin only.';

revoke all on function approve_topup(uuid, text) from public;
revoke all on function reject_topup(uuid, text) from public;
grant execute on function approve_topup(uuid, text) to authenticated;
grant execute on function reject_topup(uuid, text) to authenticated;
