/**
 * src/data/repositories/WashRepository.ts
 *
 * Only what A1 needs today: does the signed-in owner have a car wash, and
 * what state is it in. That answer decides whether an owner lands on O1
 * (register), O2 (waiting for approval) or their queue.
 *
 * The rest of the wash surface arrives with O5/O6.
 */
import { supabase } from '@/data/supabase/client';
import type { WashStatus } from '@/data/supabase/types';

import type { AuthResult } from './AuthRepository';

/**
 * The owner's own wash, whatever its status.
 *
 * RLS allows this: "public read approved" also admits `owner_id = auth.uid()`,
 * so a pending or suspended wash is still visible to the person who owns it.
 *
 * null means "has not registered one yet" — the O1 case.
 */
export async function getMyWashStatus(): Promise<AuthResult<WashStatus | null>> {
  const { data, error } = await supabase
    .from('car_washes')
    .select('status')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };
  }

  return { ok: true, value: data?.status ?? null };
}
