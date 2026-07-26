/**
 * src/features/auth/useResendCountdown.ts
 *
 * A4: "60-second countdown", resend only after it runs out.
 *
 * Counts against a wall-clock deadline rather than decrementing a number, so
 * backgrounding the app does not freeze the timer — come back after two
 * minutes and the resend is available, as it should be.
 */
import { useCallback, useEffect, useState } from 'react';

export const RESEND_SECONDS = 60;

function secondsUntil(deadline: number): number {
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

export function useResendCountdown(seconds: number = RESEND_SECONDS) {
  const [deadline, setDeadline] = useState(() => Date.now() + seconds * 1000);
  const [remaining, setRemaining] = useState(() => secondsUntil(deadline));

  useEffect(() => {
    setRemaining(secondsUntil(deadline));
    if (deadline <= Date.now()) return;

    const id = setInterval(() => {
      const left = secondsUntil(deadline);
      setRemaining(left);
      if (left === 0) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
  }, [deadline]);

  const restart = useCallback(() => {
    setDeadline(Date.now() + seconds * 1000);
  }, [seconds]);

  return { remaining, canResend: remaining === 0, restart };
}

export default useResendCountdown;
