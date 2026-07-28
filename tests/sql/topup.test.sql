-- =====================================================================
--  Manual top-up and platform_settings — 0009.
--
--  Money moves here, so the assertions are mostly about who cannot move it.
-- =====================================================================
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('90000000-0000-0000-0000-000000000090'),   -- owner
  ('91000000-0000-0000-0000-000000000091'),   -- admin
  ('92000000-0000-0000-0000-000000000092');   -- a plain client

insert into profiles (id, role, full_name, phone) values
  ('90000000-0000-0000-0000-000000000090', 'owner',  'Topup Owner',  '+212690000001'),
  ('91000000-0000-0000-0000-000000000091', 'admin',  'The Admin',    '+212690000002'),
  ('92000000-0000-0000-0000-000000000092', 'client', 'Passing By',   '+212690000003');

insert into car_washes
  (id, owner_id, name, address, city, location, status, credit_balance, free_washes_left)
values
  ('93000000-0000-0000-0000-000000000093', '90000000-0000-0000-0000-000000000090',
   'Topup Wash', 'addr', 'Casablanca',
   st_setsrid(st_makepoint(-7.5898, 33.5749), 4326)::geography,
   'approved', 2000, 0);

-- =====================================================================
--  platform_settings: readable by all, writable by admins only.
--  Before 0009 the update below succeeded and the platform charged nothing.
-- =====================================================================
set role authenticated;
set request.jwt.claim.sub = '92000000-0000-0000-0000-000000000092';

do $$
begin
  if (select (value #>> '{}')::int from platform_settings where key = 'wash_fee_centimes') <> 100 then
    raise exception 'FAIL 0009: a client cannot read the settings they need';
  end if;
end $$;

do $$
declare
  v_rows int;
begin
  update platform_settings set value = '0' where key = 'wash_fee_centimes';
  get diagnostics v_rows = row_count;

  if v_rows <> 0 then
    raise exception 'FAIL 0009: a client rewrote the platform fee';
  end if;

  if (select (value #>> '{}')::int from platform_settings where key = 'wash_fee_centimes') <> 100 then
    raise exception 'FAIL 0009: the platform fee changed';
  end if;
end $$;

-- =====================================================================
--  The owner asks
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = '90000000-0000-0000-0000-000000000090';

insert into topup_requests (id, car_wash_id, amount, reference)
values ('94000000-0000-0000-0000-000000000094',
        '93000000-0000-0000-0000-000000000093', 10000, 'VIR-2026-0042');

do $$
begin
  if (select status from topup_requests where id = '94000000-0000-0000-0000-000000000094')
     <> 'pending' then
    raise exception 'FAIL 0009: a new request did not start pending';
  end if;
end $$;

do $$
begin
  begin
    -- Submitting an already-approved request would be self-service credit.
    insert into topup_requests (car_wash_id, amount, reference, status)
    values ('93000000-0000-0000-0000-000000000093', 50000, 'CHEEKY', 'approved');
    raise exception 'FAIL 0009: an owner submitted a pre-approved top-up';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
declare
  v_rows int;
begin
  -- No UPDATE policy for owners: approving is not theirs to do.
  update topup_requests set status = 'approved'
   where id = '94000000-0000-0000-0000-000000000094';
  get diagnostics v_rows = row_count;

  if v_rows <> 0 then
    raise exception 'FAIL 0009: an owner approved their own top-up';
  end if;
end $$;

do $$
begin
  begin
    perform approve_topup('94000000-0000-0000-0000-000000000094', null);
    raise exception 'FAIL 0009: an owner credited their own account';
  exception when insufficient_privilege then null;
  end;
end $$;

-- =====================================================================
--  A different owner cannot even see it
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = '92000000-0000-0000-0000-000000000092';

do $$
begin
  if exists (select 1 from topup_requests where id = '94000000-0000-0000-0000-000000000094') then
    raise exception 'FAIL 0009: an unrelated user read somebody''s top-up request';
  end if;
end $$;

-- =====================================================================
--  The admin approves — the only thing that moves money
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = '91000000-0000-0000-0000-000000000091';

select approve_topup('94000000-0000-0000-0000-000000000094', 'checked the bank');

do $$
declare
  v_balance int;
  v_tx      record;
begin
  select credit_balance into v_balance
    from car_washes where id = '93000000-0000-0000-0000-000000000093';

  if v_balance <> 12000 then
    raise exception 'FAIL 0009: balance is % after a 10000 top-up on 2000, expected 12000', v_balance;
  end if;

  select * into v_tx from credit_transactions
   where car_wash_id = '93000000-0000-0000-0000-000000000093' and type = 'topup';

  if v_tx is null then
    raise exception 'FAIL 0009: the credit was not recorded in the ledger';
  end if;
  if v_tx.amount <> 10000 or v_tx.balance_after <> 12000 then
    raise exception 'FAIL 0009: ledger row disagrees with the balance (% / %)',
      v_tx.amount, v_tx.balance_after;
  end if;
  if v_tx.note is null then
    raise exception 'FAIL 0009: the credit landed without a reason';
  end if;
end $$;

do $$
begin
  begin
    -- Approving twice would credit twice.
    perform approve_topup('94000000-0000-0000-0000-000000000094', null);
    raise exception 'FAIL 0009: the same top-up was approved twice';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

do $$
begin
  if (select count(*) from credit_transactions
       where car_wash_id = '93000000-0000-0000-0000-000000000093' and type = 'topup') <> 1 then
    raise exception 'FAIL 0009: a second ledger row appeared';
  end if;
end $$;

-- =====================================================================
--  Rejection moves nothing
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = '90000000-0000-0000-0000-000000000090';

insert into topup_requests (id, car_wash_id, amount, reference)
values ('95000000-0000-0000-0000-000000000095',
        '93000000-0000-0000-0000-000000000093', 7000, 'VIR-BAD');

reset role; set role authenticated;
set request.jwt.claim.sub = '91000000-0000-0000-0000-000000000091';

select reject_topup('95000000-0000-0000-0000-000000000095', 'no transfer found');

do $$
begin
  if (select credit_balance from car_washes where id = '93000000-0000-0000-0000-000000000093')
     <> 12000 then
    raise exception 'FAIL 0009: a rejection changed the balance';
  end if;

  if (select status from topup_requests where id = '95000000-0000-0000-0000-000000000095')
     <> 'rejected' then
    raise exception 'FAIL 0009: the rejection did not stick';
  end if;

  if (select admin_note from topup_requests where id = '95000000-0000-0000-0000-000000000095')
     is null then
    raise exception 'FAIL 0009: a rejection without a reason';
  end if;
end $$;

reset role;
reset request.jwt.claim.sub;

\echo 'All top-up assertions passed.'
