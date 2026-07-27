/**
 * src/data/repositories/WashRepository.ts
 *
 * Only what A1 needs today: does the signed-in owner have a car wash, and
 * what state is it in. That answer decides whether an owner lands on O1
 * (register), O2 (waiting for approval) or their queue.
 *
 * The rest of the wash surface arrives with O5/O6.
 */
import type { NearbyWash } from '@/core/domain/CarWash';
import { supabase } from '@/data/supabase/client';
import type { CarWashRow, WashStatus } from '@/data/supabase/types';

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

/**
 * C1 — approved washes within `radiusM` of a point.
 *
 * The RPC already drops anything out of credit and orders by distance, so
 * this only renames columns into the domain shape. Sorting and filtering
 * happen on what comes back; see src/core/usecases/sortWashes.ts.
 */
export async function getNearbyWashes({
  latitude,
  longitude,
  radiusM,
}: {
  latitude: number;
  longitude: number;
  radiusM: number;
}): Promise<AuthResult<NearbyWash[]>> {
  const { data, error } = await supabase.rpc('nearby_car_washes', {
    p_lat: latitude,
    p_lng: longitude,
    p_radius_m: radiusM,
  });

  if (error) {
    return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };
  }

  return {
    ok: true,
    value: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      photos: row.photos,
      latitude: row.latitude,
      longitude: row.longitude,
      distanceM: row.distance_m,
      ratingAvg: Number(row.rating_avg),
      ratingCount: row.rating_count,
      baysCount: row.bays_count,
      carsAhead: row.cars_ahead,
      waitMinutes: row.wait_minutes,
      priceFrom: row.price_from,
      isOpen: row.is_open,
    })),
  };
}

/**
 * The owner's own wash, in full — O3 needs the balance, the free quota and
 * the open/closed switch. "public read approved" also admits
 * owner_id = auth.uid(), so a pending or suspended wash is still visible to
 * the person who owns it.
 */
export async function getMyWash(): Promise<AuthResult<CarWashRow | null>> {
  const { data, error } = await supabase
    .from('car_washes')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };
  }
  return { ok: true, value: data };
}
