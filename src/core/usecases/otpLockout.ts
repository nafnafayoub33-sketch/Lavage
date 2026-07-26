/**
 * src/core/usecases/otpLockout.ts
 *
 * A4: "wrong code (3 attempts, then 15-minute lockout)".
 *
 * Pure state machine — the caller owns the clock and the storage. Every
 * function takes `now` so the behaviour is deterministic and testable.
 *
 * This is a UX guard, not a security control. It lives on the device and a
 * determined caller can reset it by clearing app data. The real protection
 * against brute force is Supabase's own server-side rate limiting on
 * verifyOtp; this exists so an honest user gets a clear, calm explanation
 * instead of a wall of generic failures.
 */

export const MAX_ATTEMPTS = 3;
export const LOCKOUT_MINUTES = 15;

const LOCKOUT_MS = LOCKOUT_MINUTES * 60 * 1000;

export type LockoutState = {
  /** failed attempts against the current code */
  failures: number;
  /** epoch ms when the lockout ends, null when not locked out */
  lockedUntil: number | null;
};

export const initialLockout: LockoutState = { failures: 0, lockedUntil: null };

export function isLockedOut(state: LockoutState, now: number): boolean {
  return state.lockedUntil !== null && state.lockedUntil > now;
}

/** Milliseconds left on the lockout; 0 when not locked out. */
export function remainingMs(state: LockoutState, now: number): number {
  if (state.lockedUntil === null) return 0;
  return Math.max(0, state.lockedUntil - now);
}

/** Attempts left before the lockout kicks in. */
export function attemptsLeft(state: LockoutState): number {
  return Math.max(0, MAX_ATTEMPTS - state.failures);
}

/**
 * Record a rejected code.
 *
 * The third failure starts the lockout and resets the counter, so that when
 * the lockout expires the user gets a full set of attempts again rather than
 * being locked out instantly by a stale count.
 */
export function registerFailure(state: LockoutState, now: number): LockoutState {
  const failures = state.failures + 1;

  if (failures >= MAX_ATTEMPTS) {
    return { failures: 0, lockedUntil: now + LOCKOUT_MS };
  }
  return { failures, lockedUntil: null };
}

/** A correct code, or a freshly requested one, wipes the slate. */
export function clearFailures(): LockoutState {
  return initialLockout;
}

/**
 * Drop a lockout that has already expired, so callers can persist and
 * rehydrate without carrying dead state forward.
 */
export function pruneExpired(state: LockoutState, now: number): LockoutState {
  if (state.lockedUntil !== null && state.lockedUntil <= now) {
    return initialLockout;
  }
  return state;
}
