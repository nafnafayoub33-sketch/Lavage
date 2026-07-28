-- =====================================================================
--  Approvals — 0012.
--
--  The whole product is behind this transition: since 0010 nothing an owner
--  can do makes a wash appear in C1, so if approve_wash is wrong the app has
--  no supply at all.
--
--  The assertions are mostly about who cannot make the decision, and about
--  the reason surviving to the screen that shows it.
-- =====================================================================
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('a0000000-0000-0000-0000-0000000000a0'),   -- owner of the applicant
  ('a1000000-0000-0000-0000-0000000000a1'),   -- admin
  ('a2000000-0000-0000-0000-0000000000a2'),   -- a plain client
  ('a3000000-0000-0000-0000-0000000000a3');   -- a second, unrelated owner

insert into profiles (id, role, full_name, phone) values
  ('a0000000-0000-0000-0000-0000000000a0', 'owner',  'Review Owner', '+212695000001'),
  ('a1000000-0000-0000-0000-0000000000a1', 'admin',  'Review Admin', '+212695000002'),
  ('a2000000-0000-0000-0000-0000000000a2', 'client', 'Review Client','+212695000003'),
  ('a3000000-0000-0000-0000-0000000000a3', 'owner',  'Other Owner',  '+212695000004');

insert into car_washes (id, owner_id, name, address, city, location, status)
values
  ('a4000000-0000-0000-0000-0000000000a4', 'a0000000-0000-0000-0000-0000000000a0',
   'Applicant Wash', 'rue 12', 'Casablanca',
   st_setsrid(st_makepoint(-7.5898, 33.5749), 4326)::geography, 'pending'),
  ('a5000000-0000-0000-0000-0000000000a5', 'a3000000-0000-0000-0000-0000000000a3',
   'Second Applicant', 'rue 13', 'Rabat',
   st_setsrid(st_makepoint(-6.8498, 33.9716), 4326)::geography, 'pending');

insert into services (car_wash_id, name, price, duration_min) values
  ('a4000000-0000-0000-0000-0000000000a4', 'Complet', 4000, 30);

-- =====================================================================
--  The queue. Admin only, and it is a filter, not an error — a non-admin
--  calling it gets nothing back.
-- =====================================================================
set role authenticated;
set request.jwt.claim.sub = 'a2000000-0000-0000-0000-0000000000a2';

do $$
begin
  if (select count(*) from pending_washes()) <> 0 then
    raise exception 'FAIL 0012: a client can read the approvals queue';
  end if;
end $$;

reset role; set role authenticated;
set request.jwt.claim.sub = 'a1000000-0000-0000-0000-0000000000a1';

do $$
declare
  r record;
begin
  if (select count(*) from pending_washes()) <> 2 then
    raise exception 'FAIL 0012: the admin sees % applications, expected 2',
      (select count(*) from pending_washes());
  end if;

  select * into r from pending_washes() where id = 'a4000000-0000-0000-0000-0000000000a4';

  -- The screen calls the owner about a rejection, so the join has to carry
  -- their name and number.
  if r.owner_name <> 'Review Owner' or r.owner_phone <> '+212695000001' then
    raise exception 'FAIL 0012: the owner is missing from the application';
  end if;

  -- Latitude then longitude. Swapping them puts Casablanca in Somalia and
  -- nothing in the app would complain.
  if round(r.latitude::numeric, 3) <> 33.575
  or round(r.longitude::numeric, 3) <> -7.590 then
    raise exception 'FAIL 0012: the pin is at %, % — lat/lng are swapped',
      r.latitude, r.longitude;
  end if;

  if r.service_count <> 1 then
    raise exception 'FAIL 0012: the price list count is %, expected 1', r.service_count;
  end if;
end $$;

-- =====================================================================
--  Who may decide.
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = 'a2000000-0000-0000-0000-0000000000a2';

do $$
begin
  begin
    perform approve_wash('a4000000-0000-0000-0000-0000000000a4');
    raise exception 'FAIL 0012: a client approved a car wash';
  exception when insufficient_privilege then null;
  end;
end $$;

-- The owner of the wash is the most motivated attacker here.
reset role; set role authenticated;
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-0000000000a0';

do $$
begin
  begin
    perform approve_wash('a4000000-0000-0000-0000-0000000000a4');
    raise exception 'FAIL 0012: an owner approved their own car wash';
  exception when insufficient_privilege then null;
  end;
end $$;

-- And not by writing the column directly either. RLS refuses an UPDATE by
-- matching no rows, so the assertion is on the effect, not on an error.
do $$
declare
  v_status wash_status;
begin
  begin
    update car_washes set status = 'approved'
     where id = 'a4000000-0000-0000-0000-0000000000a4';
  exception when insufficient_privilege then null;
  end;

  select status into v_status from car_washes
   where id = 'a4000000-0000-0000-0000-0000000000a4';

  if v_status <> 'pending' then
    raise exception 'FAIL 0012: an owner set their own status to %', v_status;
  end if;
end $$;

-- =====================================================================
--  Reject, and the reason.
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = 'a1000000-0000-0000-0000-0000000000a1';

do $$
begin
  -- A rejection with nothing in it leaves O2 a dead end.
  begin
    perform reject_wash('a4000000-0000-0000-0000-0000000000a4', '   ');
    raise exception 'FAIL 0012: a rejection was accepted with a blank reason';
  exception when raise_exception then
    if sqlerrm like 'FAIL 0012%' then raise; end if;
  end;
end $$;

do $$
declare
  v_note   text;
  v_status wash_status;
  v_by     uuid;
begin
  perform reject_wash('a4000000-0000-0000-0000-0000000000a4',
                      '  The photos do not show the bays.  ');

  select status, review_note, reviewed_by into v_status, v_note, v_by
    from car_washes where id = 'a4000000-0000-0000-0000-0000000000a4';

  if v_status <> 'rejected' then
    raise exception 'FAIL 0012: the wash is %, expected rejected', v_status;
  end if;

  -- Trimmed, because the reason is rendered straight onto O2.
  if v_note <> 'The photos do not show the bays.' then
    raise exception 'FAIL 0012: the reason came back as %', quote_literal(v_note);
  end if;

  if v_by <> 'a1000000-0000-0000-0000-0000000000a1' then
    raise exception 'FAIL 0012: the decision is not signed';
  end if;
end $$;

-- The second application is rejected too, and left that way. It is the
-- fixture for the cross-owner check further down: if it were still pending,
-- resubmit_wash would refuse it on its status and the ownership check would
-- never be the thing under test.
do $$
begin
  perform reject_wash('a5000000-0000-0000-0000-0000000000a5', 'No address.');
end $$;

-- A rejected wash is not a live wash.
do $$
begin
  if exists (select 1 from nearby_car_washes(33.5749, -7.5898, 50000)
              where id = 'a4000000-0000-0000-0000-0000000000a4') then
    raise exception 'FAIL 0012: a rejected wash is showing to clients';
  end if;
end $$;

-- It also leaves the queue, or D2 would show the same application forever.
do $$
begin
  if exists (select 1 from pending_washes()
              where id = 'a4000000-0000-0000-0000-0000000000a4') then
    raise exception 'FAIL 0012: a decided application is still in the queue';
  end if;
end $$;

-- Deciding twice is refused rather than silently ignored: it means the admin
-- is looking at a stale list.
do $$
begin
  begin
    perform approve_wash('a4000000-0000-0000-0000-0000000000a4');
    raise exception 'FAIL 0012: a rejected wash was approved without resubmission';
  exception when raise_exception then
    if sqlerrm like 'FAIL 0012%' then raise; end if;
  end;
end $$;

-- =====================================================================
--  The owner reads the reason, and cannot rewrite it.
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-0000000000a0';

do $$
declare
  v_note text;
begin
  select review_note into v_note from car_washes
   where id = 'a4000000-0000-0000-0000-0000000000a4';

  if v_note is distinct from 'The photos do not show the bays.' then
    raise exception 'FAIL 0012: the owner cannot read why they were rejected';
  end if;
end $$;

do $$
declare
  v_note text;
begin
  begin
    update car_washes set review_note = 'looks fine to me'
     where id = 'a4000000-0000-0000-0000-0000000000a4';
  exception when insufficient_privilege then null;
  end;

  select review_note into v_note from car_washes
   where id = 'a4000000-0000-0000-0000-0000000000a4';

  if v_note <> 'The photos do not show the bays.' then
    raise exception 'FAIL 0012: the owner rewrote the admin''s reason';
  end if;
end $$;

-- =====================================================================
--  Resubmit — the owner's half of the loop.
-- =====================================================================
do $$
declare
  v_status wash_status;
begin
  perform resubmit_wash('a4000000-0000-0000-0000-0000000000a4');

  select status into v_status from car_washes
   where id = 'a4000000-0000-0000-0000-0000000000a4';

  if v_status <> 'pending' then
    raise exception 'FAIL 0012: resubmitting left the wash at %', v_status;
  end if;
end $$;

-- Not a back door into approval.
do $$
begin
  begin
    perform resubmit_wash('a4000000-0000-0000-0000-0000000000a4');
    raise exception 'FAIL 0012: a pending wash was resubmitted';
  exception when raise_exception then
    if sqlerrm like 'FAIL 0012%' then raise; end if;
  end;
end $$;

-- And not a way to touch somebody else's application.
do $$
begin
  begin
    perform resubmit_wash('a5000000-0000-0000-0000-0000000000a5');
    raise exception 'FAIL 0012: an owner reached another owner''s application';
  exception when insufficient_privilege then null;
  end;
end $$;

-- =====================================================================
--  Approve, and the wash goes live.
-- =====================================================================
reset role; set role authenticated;
set request.jwt.claim.sub = 'a1000000-0000-0000-0000-0000000000a1';

do $$
declare
  v_status wash_status;
  v_note   text;
begin
  perform approve_wash('a4000000-0000-0000-0000-0000000000a4');

  select status, review_note into v_status, v_note
    from car_washes where id = 'a4000000-0000-0000-0000-0000000000a4';

  if v_status <> 'approved' then
    raise exception 'FAIL 0012: the wash is %, expected approved', v_status;
  end if;

  -- The application succeeded; O2 must not still be showing the old reason.
  if v_note is not null then
    raise exception 'FAIL 0012: an approved wash still carries a rejection reason';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from nearby_car_washes(33.5749, -7.5898, 50000)
                  where id = 'a4000000-0000-0000-0000-0000000000a4') then
    raise exception 'FAIL 0012: an approved wash is not showing to clients';
  end if;
end $$;

reset role;
reset request.jwt.claim.sub;

\echo 'All wash review assertions passed.'
