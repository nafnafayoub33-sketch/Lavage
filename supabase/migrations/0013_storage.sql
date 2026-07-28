-- =====================================================================
--  Storage.
--
--  Three things in the app upload a file: A6's avatar, O1/O5's wash photos,
--  and O7's bank transfer receipt. None of them had anywhere to go.
--
--  TWO buckets, not one.
--
--  The earlier plan was a single bucket. That does not survive contact with
--  what actually gets stored in it: a wash photo is a shopfront picture that
--  every client browsing C1 must be able to load, and a transfer receipt is a
--  financial document with an account number on it. A bucket is public or it
--  is not; those two cannot share one.
--
--    media    public read. Avatars and wash photos. A client scrolling C1
--             loads a dozen of these at once, and signing every URL would be
--             a round trip per card.
--    private  no public read at all. Receipts. Reachable only through a
--             signed URL, and only the owner who filed it and an admin can
--             ask for one.
--
--  Writes are restricted in both by the first path segment, which is why the
--  layout below is a contract and not a convention:
--
--    media/avatars/<user_id>/<file>
--    media/wash-photos/<wash_id>/<file>
--    private/receipts/<wash_id>/<file>
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('private', 'private', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
--  media — public read, narrow write.
--
--  Public read is the bucket flag, so no SELECT policy is needed for
--  anonymous fetches. The policies here govern who may put something there
--  and who may take it away.
-- ---------------------------------------------------------------------

create policy "own avatar" on storage.objects for all
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- owns_wash() is SECURITY DEFINER and takes a uuid; the path segment is
-- text, so it is cast — and a path segment that is not a uuid at all would
-- raise rather than quietly matching. The regex check keeps that from
-- turning a bad upload path into a 500.
create policy "own wash photos" on storage.objects for all
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'wash-photos'
    and (storage.foldername(name))[2] ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and owns_wash(((storage.foldername(name))[2])::uuid)
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'wash-photos'
    and (storage.foldername(name))[2] ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and owns_wash(((storage.foldername(name))[2])::uuid)
  );

create policy "admin manages media" on storage.objects for all
  to authenticated
  using (bucket_id = 'media' and is_admin())
  with check (bucket_id = 'media' and is_admin());

-- ---------------------------------------------------------------------
--  private — receipts.
--
--  The owner uploads and reads back their own; an admin reads all of them,
--  because checking the transfer against the receipt is the whole of D8.
--  Nobody else gets a row, and the bucket is not public, so a leaked path is
--  not a leaked document.
-- ---------------------------------------------------------------------

create policy "own receipts" on storage.objects for all
  to authenticated
  using (
    bucket_id = 'private'
    and (storage.foldername(name))[1] = 'receipts'
    and (storage.foldername(name))[2] ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and owns_wash(((storage.foldername(name))[2])::uuid)
  )
  with check (
    bucket_id = 'private'
    and (storage.foldername(name))[1] = 'receipts'
    and (storage.foldername(name))[2] ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and owns_wash(((storage.foldername(name))[2])::uuid)
  );

create policy "admin reads receipts" on storage.objects for select
  to authenticated
  using (bucket_id = 'private' and is_admin());
