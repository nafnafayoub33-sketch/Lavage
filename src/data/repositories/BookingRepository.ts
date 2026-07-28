/**
 * src/data/repositories/BookingRepository.ts
 *
 * The client's booking: the banner on C1, and everything C6 shows.
 * Creating one is C4's job and lands with it.
 */
import { supabase } from '@/data/supabase/client';
import {
  ACTIVE_BOOKING_STATUSES,
  type ArrivalStatus,
  type BookingStatus,
} from '@/data/supabase/types';

import type { AuthResult } from './AuthRepository';

export type ActiveBooking = {
  id: string;
  ticketNo: number;
  status: BookingStatus;
  washName: string;
};

/** Everything C6 puts on screen. */
export type CurrentBooking = ActiveBooking & {
  price: number;
  /** null when the client has said nothing */
  arrival: ArrivalStatus | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  serviceName: string;
  serviceDurationMin: number;
  washPhone: string | null;
  washAddress: string;
  washId: string;
};

export type QueuePosition = {
  carsAhead: number;
  waitMinutes: number;
  nowServing: number | null;
};

/**
 * C1's banner. Cheap on purpose — the banner needs a name and a number.
 *
 * 0001 has a partial unique index allowing one pending/in_progress/done
 * booking per client, so at most one row can come back.
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

/**
 * C6's booking.
 *
 * Wider than getActiveBooking in two ways: it carries the details the screen
 * shows, and it also admits `cancelled_owner`, because C6 has a state for
 * "the owner cancelled — here is why". How long that stays worth showing is
 * a product rule and lives in src/core/usecases/turnState.ts, not here.
 *
 * Newest first rather than maybeSingle(): the one-active-booking index does
 * not cover cancelled rows, so several can legitimately exist.
 */
export async function getCurrentBooking(): Promise<AuthResult<CurrentBooking | null>> {
  const { data, error } = await supabase
    .from('bookings')
    // One literal, deliberately: supabase-js infers the row type from this
    // string at compile time, and concatenating it widens it to `string`,
    // which collapses the result to an error type.
    .select(
      'id, ticket_no, status, arrival, price, cancelled_at, cancel_reason, car_wash_id, services(name, duration_min), car_washes(name, phone, address)',
    )
    .in('status', [...ACTIVE_BOOKING_STATUSES, 'cancelled_owner'])
    .order('created_at', { ascending: false })
    .limit(1)
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
      price: data.price,
      arrival: data.arrival,
      cancelledAt: data.cancelled_at,
      cancelReason: data.cancel_reason,
      washId: data.car_wash_id,
      washName: data.car_washes?.name ?? '',
      washPhone: data.car_washes?.phone ?? null,
      washAddress: data.car_washes?.address ?? '',
      serviceName: data.services?.name ?? '',
      serviceDurationMin: data.services?.duration_min ?? 0,
    },
  };
}

/**
 * "2 cars ahead of you", plus the ticket on the ramp.
 *
 * Counting other clients' cars is impossible under RLS, so this goes through
 * my_queue_position (0005), which is SECURITY DEFINER and checks ownership of
 * the booking itself. An unknown or someone else's id returns no rows.
 */
export async function getQueuePosition(
  bookingId: string,
): Promise<AuthResult<QueuePosition | null>> {
  const { data, error } = await supabase.rpc('my_queue_position', {
    p_booking_id: bookingId,
  });

  if (error) {
    return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };
  }

  const row = data?.[0];
  if (row === undefined) return { ok: true, value: null };

  return {
    ok: true,
    value: {
      carsAhead: row.cars_ahead,
      waitMinutes: row.wait_minutes,
      nowServing: row.now_serving,
    },
  };
}

/**
 * C7 — the client cancels. RLS ("client or owner updates") already limits
 * this to the caller's own booking.
 *
 * cancelled_at is set here rather than by a trigger; 0001 only fills it in
 * for the billing path.
 */
export async function cancelBooking(bookingId: string): Promise<AuthResult<void>> {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled_client', cancelled_at: new Date().toISOString() })
    .eq('id', bookingId);

  if (error) {
    return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };
  }
  return { ok: true, value: undefined };
}

/**
 * C6 — the client says whether they are coming.
 *
 * 0008 lets only the client write this column, and only on their own
 * booking; the owner reads it back through owner_queue.
 */
export async function setArrival(
  bookingId: string,
  arrival: ArrivalStatus,
): Promise<AuthResult<void>> {
  const { error } = await supabase
    .from('bookings')
    .update({ arrival })
    .eq('id', bookingId);

  if (error) {
    return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };
  }
  return { ok: true, value: undefined };
}
