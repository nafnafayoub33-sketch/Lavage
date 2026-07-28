/**
 * tests/turnState.test.ts — src/core/usecases/turnState.ts
 *
 * Which of C6's six faces to show.
 */
import {
  CANCEL_NOTICE_HOURS,
  isUrgent,
  resolveTurnState,
  type QueuePosition,
  type TurnBooking,
} from '@/core/usecases/turnState';
import type { BookingStatus } from '@/data/supabase/types';

const NOW = Date.parse('2026-07-27T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

const booking = (status: BookingStatus, over: Partial<TurnBooking> = {}): TurnBooking => ({
  status,
  cancelledAt: null,
  cancelReason: null,
  ...over,
});

const at = (carsAhead: number, over: Partial<QueuePosition> = {}): QueuePosition => ({
  carsAhead,
  waitMinutes: carsAhead * 20,
  nowServing: 9,
  ...over,
});

describe('no booking', () => {
  it('is the empty state', () => {
    expect(resolveTurnState(null, null, NOW)).toEqual({ kind: 'none' });
  });
});

describe('queued', () => {
  it('waits while cars are in front', () => {
    expect(resolveTurnState(booking('pending'), at(2), NOW)).toEqual({
      kind: 'waiting',
      carsAhead: 2,
      waitMinutes: 40,
      nowServing: 9,
    });
  });

  it('is your turn once nothing is in front', () => {
    expect(resolveTurnState(booking('pending'), at(0), NOW)).toEqual({
      kind: 'next',
      nowServing: 9,
    });
  });

  it('does not claim your turn before the position is known', () => {
    // A missing position must not read as "zero cars ahead".
    expect(resolveTurnState(booking('pending'), null, NOW).kind).toBe('waiting');
  });
});

describe('under way', () => {
  it('reports a wash in progress', () => {
    expect(resolveTurnState(booking('in_progress'), null, NOW)).toEqual({ kind: 'washing' });
  });

  it('hands a finished wash to C8', () => {
    expect(resolveTurnState(booking('done'), null, NOW)).toEqual({ kind: 'finished' });
  });
});

describe('cancelled by the owner', () => {
  it('shows the reason while it is still news', () => {
    const state = resolveTurnState(
      booking('cancelled_owner', { cancelledAt: hoursAgo(1), cancelReason: 'no_water' }),
      null,
      NOW,
    );
    expect(state).toEqual({ kind: 'cancelledByOwner', reason: 'no_water' });
  });

  it('still shows just inside the window', () => {
    const state = resolveTurnState(
      booking('cancelled_owner', { cancelledAt: hoursAgo(CANCEL_NOTICE_HOURS - 0.5) }),
      null,
      NOW,
    );
    expect(state.kind).toBe('cancelledByOwner');
  });

  it('stops being news once the window passes', () => {
    const state = resolveTurnState(
      booking('cancelled_owner', { cancelledAt: hoursAgo(CANCEL_NOTICE_HOURS + 1) }),
      null,
      NOW,
    );
    expect(state).toEqual({ kind: 'none' });
  });

  it('survives a missing or unparseable timestamp without crashing', () => {
    expect(resolveTurnState(booking('cancelled_owner'), null, NOW)).toEqual({ kind: 'none' });
    expect(
      resolveTurnState(booking('cancelled_owner', { cancelledAt: 'not a date' }), null, NOW),
    ).toEqual({ kind: 'none' });
  });
});

describe('finished business', () => {
  it.each(['confirmed', 'cancelled_client', 'no_show'] as const)(
    'treats %s as nothing to show',
    (status) => {
      expect(resolveTurnState(booking(status), null, NOW)).toEqual({ kind: 'none' });
    },
  );
});

describe('isUrgent', () => {
  it('is the amber screen, and only that', () => {
    expect(isUrgent({ kind: 'next', nowServing: null })).toBe(true);
    expect(isUrgent({ kind: 'waiting', carsAhead: 1, waitMinutes: 20, nowServing: null })).toBe(
      false,
    );
    expect(isUrgent({ kind: 'washing' })).toBe(false);
    expect(isUrgent({ kind: 'none' })).toBe(false);
  });
});
