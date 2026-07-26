/**
 * src/features/auth/useOtpLockout.ts
 *
 * A4: three wrong codes, then fifteen minutes out.
 *
 * The policy itself is pure and lives in src/core/usecases/otpLockout.ts.
 * This hook only supplies the clock and the storage, keyed per phone number
 * so locking one number does not lock another.
 *
 * Persisted, so force-quitting the app is not a way around the wait. That
 * said it is still device-local state — see the note in the usecase about
 * why this is a UX guard and Supabase's rate limiting is the real defence.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import {
  attemptsLeft,
  clearFailures,
  initialLockout,
  isLockedOut,
  pruneExpired,
  registerFailure,
  remainingMs,
  type LockoutState,
} from '@/core/usecases/otpLockout';

const keyFor = (phoneE164: string) => `auth.otpLockout.${phoneE164}`;

function parse(raw: string | null): LockoutState {
  if (raw === null) return initialLockout;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as LockoutState).failures === 'number'
    ) {
      return parsed as LockoutState;
    }
  } catch {
    // Corrupt entry — treat it as a clean slate rather than locking the user
    // out of their own account.
  }
  return initialLockout;
}

export function useOtpLockout(phoneE164: string) {
  const [state, setState] = useState<LockoutState>(initialLockout);
  const [now, setNow] = useState(() => Date.now());

  // Rehydrate, dropping a lockout that expired while the app was closed.
  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(keyFor(phoneE164)).then((raw) => {
      if (cancelled) return;
      setState(pruneExpired(parse(raw), Date.now()));
    });

    return () => {
      cancelled = true;
    };
  }, [phoneE164]);

  const locked = isLockedOut(state, now);

  // Only tick while locked — no timer running behind a normal code entry.
  useEffect(() => {
    if (!locked) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [locked]);

  const persist = useCallback(
    async (next: LockoutState) => {
      setState(next);
      setNow(Date.now());
      await AsyncStorage.setItem(keyFor(phoneE164), JSON.stringify(next));
    },
    [phoneE164],
  );

  const fail = useCallback(
    () => persist(registerFailure(state, Date.now())),
    [persist, state],
  );

  const reset = useCallback(() => persist(clearFailures()), [persist]);

  return {
    locked,
    /** whole minutes left, rounded up — what the user is told */
    lockedMinutes: Math.ceil(remainingMs(state, now) / 60000),
    attemptsLeft: attemptsLeft(state),
    /** record a rejected code */
    fail,
    /** a correct code, or a freshly requested one */
    reset,
  };
}

export default useOtpLockout;
