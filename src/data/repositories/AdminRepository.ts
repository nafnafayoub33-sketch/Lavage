/**
 * src/data/repositories/AdminRepository.ts
 *
 * D2's data: the applications waiting on a decision, and the decision.
 *
 * Nothing here is an ordinary table read. `pending_washes()` exists so the
 * screen gets the owner's name and number alongside the wash, and
 * approve_wash / reject_wash exist because since 0010 no UPDATE from a
 * browser can move car_washes.status at all — the checks live next to the
 * change, in the database.
 */
import { supabase } from '@/data/supabase/client';

import type { AuthResult } from './AuthRepository';

export type PendingWash = {
  id: string;
  name: string;
  address: string;
  city: string;
  /** the wash's own line, which may differ from the owner's */
  phone: string | null;
  photos: string[];
  baysCount: number;
  opensAt: string;
  closesAt: string;
  latitude: number;
  longitude: number;
  /** how long the owner has been waiting — the reason the list is oldest-first */
  createdAt: string;
  ownerName: string;
  ownerPhone: string | null;
  /** zero means there is nothing for a client to book; worth seeing before approving */
  serviceCount: number;
};

export async function getPendingWashes(): Promise<AuthResult<PendingWash[]>> {
  const { data, error } = await supabase.rpc('pending_washes');

  if (error) {
    return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };
  }

  return {
    ok: true,
    value: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      city: row.city,
      phone: row.phone,
      photos: row.photos,
      baysCount: row.bays_count,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      latitude: row.latitude,
      longitude: row.longitude,
      createdAt: row.created_at,
      ownerName: row.owner_name,
      ownerPhone: row.owner_phone,
      serviceCount: row.service_count,
    })),
  };
}

export async function approveWash(washId: string): Promise<AuthResult<void>> {
  const { error } = await supabase.rpc('approve_wash', { p_wash_id: washId });

  if (error) {
    return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };
  }
  return { ok: true, value: undefined };
}

/**
 * The reason is not optional and not cosmetic: it is the whole of what the
 * owner sees on O2, and 0012 refuses a blank one.
 */
export async function rejectWash(
  washId: string,
  reason: string,
): Promise<AuthResult<void>> {
  const { error } = await supabase.rpc('reject_wash', {
    p_wash_id: washId,
    p_reason: reason,
  });

  if (error) {
    return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };
  }
  return { ok: true, value: undefined };
}
