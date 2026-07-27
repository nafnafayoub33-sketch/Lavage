/**
 * src/core/usecases/turnState.ts
 *
 * Which of C6's faces to show.
 *
 * C6 is one screen with six states and the rules for choosing between them
 * are not obvious from any single field — "you're up" is a pending booking
 * with nothing in front of it, and an owner cancellation stops being news
 * after a while. Pure, so each rule is testable on its own.
 */
import type { BookingStatus } from '@/data/supabase/types';

/**
 * How long an owner's cancellation stays on screen. Long enough that someone
 * who put their phone down still finds out why their booking vanished, short
 * enough that it is not still there tomorrow.
 */
export const CANCEL_NOTICE_HOURS = 6;

export type TurnBooking = {
  status: BookingStatus;
  /** null while the booking is still live */
  cancelledAt: string | null;
  cancelReason: string | null;
};

export type QueuePosition = {
  carsAhead: number;
  waitMinutes: number;
  nowServing: number | null;
};

export type TurnState =
  /** nothing booked — "You don't have a turn right now" */
  | { kind: 'none' }
  /** queued, with cars in front */
  | { kind: 'waiting'; carsAhead: number; waitMinutes: number; nowServing: number | null }
  /** next on the ramp — the screen turns amber */
  | { kind: 'next'; nowServing: number | null }
  /** the owner has started */
  | { kind: 'washing' }
  /** finished and waiting to be confirmed — C6 hands straight over to C8 */
  | { kind: 'finished' }
  /** the owner cancelled, and it is recent enough to still matter */
  | { kind: 'cancelledByOwner'; reason: string | null };

export function resolveTurnState(
  booking: TurnBooking | null,
  position: QueuePosition | null,
  now: number = Date.now(),
): TurnState {
  if (booking === null) return { kind: 'none' };

  switch (booking.status) {
    case 'cancelled_owner': {
      // Stale cancellations are not news, they are clutter.
      if (booking.cancelledAt === null) return { kind: 'none' };

      const age = now - Date.parse(booking.cancelledAt);
      if (Number.isNaN(age) || age > CANCEL_NOTICE_HOURS * 3600_000) return { kind: 'none' };

      return { kind: 'cancelledByOwner', reason: booking.cancelReason };
    }

    case 'in_progress':
      return { kind: 'washing' };

    case 'done':
      return { kind: 'finished' };

    case 'pending': {
      // No position yet: treat it as queued rather than claiming their turn.
      const carsAhead = position?.carsAhead ?? 1;
      const nowServing = position?.nowServing ?? null;

      if (carsAhead === 0) return { kind: 'next', nowServing };

      return {
        kind: 'waiting',
        carsAhead,
        waitMinutes: position?.waitMinutes ?? 0,
        nowServing,
      };
    }

    // confirmed, cancelled_client and no_show are all finished business.
    default:
      return { kind: 'none' };
  }
}

/** The amber treatment, which C6 applies to the whole screen. */
export const isUrgent = (state: TurnState): boolean => state.kind === 'next';
