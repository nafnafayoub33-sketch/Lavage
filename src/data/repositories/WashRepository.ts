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
import type { CarWashRow, ServiceRow, WashStatus } from '@/data/supabase/types';

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

/** O6 — the wash's price list, active and inactive alike. */
export async function getServices(washId: string): Promise<AuthResult<ServiceRow[]>> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('car_wash_id', washId)
    .order('price', { ascending: true });

  if (error) return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };
  return { ok: true, value: data };
}

export type ServiceDraft = {
  name: string;
  priceCentimes: number;
  durationMin: number;
  isActive: boolean;
};

/** "owner manages services" covers all of these through owns_wash(). */
export async function saveService(
  washId: string,
  draft: ServiceDraft,
  serviceId?: string,
): Promise<AuthResult<void>> {
  const row = {
    car_wash_id: washId,
    name: draft.name,
    price: draft.priceCentimes,
    duration_min: draft.durationMin,
    is_active: draft.isActive,
  };

  const { error } =
    serviceId === undefined
      ? await supabase.from('services').insert(row)
      : await supabase.from('services').update(row).eq('id', serviceId);

  if (error) return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };
  return { ok: true, value: undefined };
}

export async function deleteService(serviceId: string): Promise<AuthResult<void>> {
  const { error } = await supabase.from('services').delete().eq('id', serviceId);
  if (error) return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };
  return { ok: true, value: undefined };
}

export type WashDraft = {
  name: string;
  description: string | null;
  address: string;
  phone: string | null;
  baysCount: number;
  opensAt: string;
  closesAt: string;
};

/**
 * O5 — the editable half of the wash page.
 *
 * Location, photos and status are deliberately absent: the first two need a
 * map picker and a storage bucket, and status is the admin's (D2/D3), not the
 * owner's.
 */
export async function updateWash(
  washId: string,
  draft: WashDraft,
): Promise<AuthResult<void>> {
  const { error } = await supabase
    .from('car_washes')
    .update({
      name: draft.name,
      description: draft.description,
      address: draft.address,
      phone: draft.phone,
      bays_count: draft.baysCount,
      opens_at: draft.opensAt,
      closes_at: draft.closesAt,
    })
    .eq('id', washId);

  if (error) return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };
  return { ok: true, value: undefined };
}
