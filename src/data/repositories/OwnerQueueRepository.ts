/**
 * src/data/repositories/OwnerQueueRepository.ts
 *
 * O3's board and the four things an owner does to a row.
 *
 * Reading goes through owner_queue (0007), because RLS hides the client and
 * the vehicle from the owner. Writing does not: "client or owner updates"
 * already lets the owner move a booking at their own wash, so the status
 * changes are ordinary updates and stay subject to RLS.
 */
import { supabase } from '@/data/supabase/client';
import type { BookingRow, BookingStatus } from '@/data/supabase/types';

import type { AuthResult } from './AuthRepository';

export type QueueRow = {
  bookingId: string;
  ticketNo: number;
  status: BookingStatus;
  price: number;
  createdAt: string;
  startedAt: string | null;
  serviceName: string;
  serviceMinutes: number;
  clientFirstName: string;
  /** full number: "Call" has to dial. O3 displays it masked. */
  clientPhone: string | null;
  vehicleLabel: string | null;
};

export async function getOwnerQueue(washId: string): Promise<AuthResult<QueueRow[]>> {
  const { data, error } = await supabase.rpc('owner_queue', { p_wash_id: washId });

  if (error) {
    return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };
  }

  return {
    ok: true,
    value: (data ?? []).map((row) => ({
      bookingId: row.booking_id,
      ticketNo: row.ticket_no,
      status: row.status,
      price: row.price,
      createdAt: row.created_at,
      startedAt: row.started_at,
      serviceName: row.service_name,
      serviceMinutes: row.service_minutes,
      clientFirstName: row.client_first_name,
      clientPhone: row.client_phone,
      vehicleLabel: row.vehicle_label,
    })),
  };
}

/** Typed against BookingRow so a typo in a column name fails the build. */
async function setStatus(
  bookingId: string,
  patch: Partial<BookingRow>,
): Promise<AuthResult<void>> {
  const { error } = await supabase.from('bookings').update(patch).eq('id', bookingId);

  if (error) {
    return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };
  }
  return { ok: true, value: undefined };
}

/** Start — the car is on the ramp. started_at drives "started N min ago". */
export const startWash = (bookingId: string) =>
  setStatus(bookingId, { status: 'in_progress', started_at: new Date().toISOString() });

/**
 * Done — waiting on the client to confirm. The 1 DH charge fires on
 * `confirmed`, not here, so this costs the owner nothing yet.
 */
export const finishWash = (bookingId: string) =>
  setStatus(bookingId, { status: 'done', finished_at: new Date().toISOString() });

/** No-show — the client never came. No credit is charged. */
export const markNoShow = (bookingId: string) =>
  setStatus(bookingId, { status: 'no_show', cancelled_at: new Date().toISOString() });

/**
 * The "Closed today" switch. Stops new bookings without touching the ones
 * already queued — 0004 reads this as `is_open`, and C1 shows the wash red
 * rather than hiding it.
 */
export async function setOpenToday(
  washId: string,
  isOpen: boolean,
): Promise<AuthResult<void>> {
  const { error } = await supabase
    .from('car_washes')
    .update({ is_open_now: isOpen })
    .eq('id', washId);

  if (error) {
    return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };
  }
  return { ok: true, value: undefined };
}
