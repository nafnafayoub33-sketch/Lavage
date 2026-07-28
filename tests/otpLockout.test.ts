/**
 * tests/otpLockout.test.ts — src/core/usecases/otpLockout.ts
 *
 * A4: "wrong code (3 attempts, then 15-minute lockout)".
 *
 * The usecase takes `now` as an argument, so none of this needs fake timers.
 */
import {
  attemptsLeft,
  clearFailures,
  initialLockout,
  isLockedOut,
  LOCKOUT_MINUTES,
  MAX_ATTEMPTS,
  pruneExpired,
  registerFailure,
  remainingMs,
} from '@/core/usecases/otpLockout';

const T0 = 1_000_000;
const minutes = (n: number) => n * 60 * 1000;

/** Walk n failures forward from a clean slate. */
const afterFailures = (n: number, at: number = T0) => {
  let state = initialLockout;
  for (let i = 0; i < n; i += 1) state = registerFailure(state, at);
  return state;
};

describe('a clean slate', () => {
  it('is not locked out and has the full set of attempts', () => {
    expect(isLockedOut(initialLockout, T0)).toBe(false);
    expect(attemptsLeft(initialLockout)).toBe(MAX_ATTEMPTS);
    expect(remainingMs(initialLockout, T0)).toBe(0);
  });
});

describe('counting failures', () => {
  it('spends one attempt at a time', () => {
    expect(attemptsLeft(afterFailures(1))).toBe(2);
    expect(attemptsLeft(afterFailures(2))).toBe(1);
  });

  it('stays unlocked until the last attempt is spent', () => {
    expect(isLockedOut(afterFailures(1), T0)).toBe(false);
    expect(isLockedOut(afterFailures(2), T0)).toBe(false);
  });
});

describe('the lockout', () => {
  it('starts on the third failure', () => {
    expect(isLockedOut(afterFailures(MAX_ATTEMPTS), T0)).toBe(true);
  });

  it('runs for fifteen minutes', () => {
    const locked = afterFailures(MAX_ATTEMPTS);
    expect(remainingMs(locked, T0)).toBe(minutes(LOCKOUT_MINUTES));
  });

  it('still holds one minute before it expires', () => {
    const locked = afterFailures(MAX_ATTEMPTS);
    expect(isLockedOut(locked, T0 + minutes(LOCKOUT_MINUTES - 1))).toBe(true);
  });

  it('is over exactly on the boundary', () => {
    const locked = afterFailures(MAX_ATTEMPTS);
    expect(isLockedOut(locked, T0 + minutes(LOCKOUT_MINUTES))).toBe(false);
  });

  it('counts down rather than reporting a flat figure', () => {
    const locked = afterFailures(MAX_ATTEMPTS);
    expect(remainingMs(locked, T0 + minutes(5))).toBe(minutes(10));
  });

  it('never reports negative time left', () => {
    const locked = afterFailures(MAX_ATTEMPTS);
    expect(remainingMs(locked, T0 + minutes(60))).toBe(0);
  });
});

describe('after the wait', () => {
  it('hands back a full set of attempts, not an instant relock', () => {
    const locked = afterFailures(MAX_ATTEMPTS);
    const later = pruneExpired(locked, T0 + minutes(LOCKOUT_MINUTES));

    expect(isLockedOut(later, T0 + minutes(LOCKOUT_MINUTES))).toBe(false);
    expect(attemptsLeft(later)).toBe(MAX_ATTEMPTS);
  });

  it('leaves a lockout that is still running alone', () => {
    const locked = afterFailures(MAX_ATTEMPTS);
    expect(pruneExpired(locked, T0 + minutes(1))).toEqual(locked);
  });
});

describe('clearFailures', () => {
  it('wipes the slate for a correct or freshly requested code', () => {
    expect(clearFailures()).toEqual(initialLockout);
  });
});
