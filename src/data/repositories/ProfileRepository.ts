/**
 * src/data/repositories/ProfileRepository.ts
 *
 * A6 creates the profile row. Nothing else in the system does — 0001 has no
 * signup trigger, and `full_name` is NOT NULL, so the row cannot exist until
 * a name has been typed.
 *
 * The role comes from A5 and is written exactly once, here. After this it is
 * locked in the database: 0003 rejects any self-service change, so a mistake
 * at this point needs an admin to undo.
 */
import { supabase } from '@/data/supabase/client';
import type { ProfileRow } from '@/data/supabase/types';

import type { AuthResult } from './AuthRepository';

export type CreateProfileInput = {
  userId: string;
  role: 'client' | 'owner';
  fullName: string;
  city: string | null;
};

/**
 * Upsert rather than insert: a signup interrupted between A6 and A7 leaves a
 * row behind, and re-running A6 should correct it rather than fail on the
 * primary key.
 *
 * The role is deliberately part of the payload on both paths. On a second run
 * it will be identical — and if it somehow is not, 0003's trigger rejects the
 * update, which is the behaviour we want.
 */
export async function createProfile(
  input: CreateProfileInput,
): Promise<AuthResult<ProfileRow>> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: input.userId,
        role: input.role,
        full_name: input.fullName,
        city: input.city,
      },
      { onConflict: 'id' },
    )
    .select()
    .single();

  if (error) {
    // 42501 is the trigger in 0003 refusing a role change. It means the row
    // already exists under a different role, which A5 says only an admin can
    // undo — not something a retry will fix.
    if (error.code === '42501') return { ok: false, reason: 'blocked' };
    return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };
  }

  return { ok: true, value: data };
}
