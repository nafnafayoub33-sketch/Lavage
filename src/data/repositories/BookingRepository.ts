/**
 * src/data/repositories/BookingRepository.ts
 *
 * Only what C1 needs today: the banner that says the client already has a
 * place in a queue somewhere. The booking flow itself arrives with C4.
 */
import { supabase } from '@/data/supabase/client';
import { ACTIVE_BOOKING_STATUSES, type BookingStatus } from '@/data/supabase/types';

import type { AuthResult } from './AuthRepository';

export type ActiveBooking = {
  id: string;
  ticketNo: number;
  status: BookingStatus;
  washName: string;
};

/**
 * The client's booking in flight, or null.
 *
 * 0001 has a partial unique index allowing one pending/in_progress/done
 * booking per client, so at most one row can come back — maybeSingle() is
 * safe rather than optimistic.
 *
 * RLS ("read own bookings") scopes this to the caller; there is no client_id
 * filter here because the policy already is one.
 */
export async function getActiveBooking(): Promise<AuthResult<ActiveBooking | null>> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, ticket_no, status, car_washes(name)')
    .in('status', [...ACTIVE_BOOKING_STATUSES])
    .maybeSingle();

  if (error) {
    return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };
  }

  if (data === null) return { ok: true, value: null };

  return {
    ok: true,
    value: {
      id: data.id,
      ticketNo: data.ticket_no,
      status: data.status,
      washName: data.car_washes?.name ?? '',
    },
  };
}
