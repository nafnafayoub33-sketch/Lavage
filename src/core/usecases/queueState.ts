/**
 * src/core/usecases/queueState.ts
 *
 * How busy a car wash is, as one of three words.
 *
 * The thresholds are product rules, not styling. theme.ts pairs the same
 * three names with colours in queueColor(), and says never to pick those
 * colours by hand in a screen — this is the function that decides which one
 * a wash gets.
 *
 *   free  wait under 15 minutes
 *   busy  15 to 40 minutes
 *   full  over 40 minutes, or closed
 */
import type { QueueState } from '@/ui/theme';

export const BUSY_FROM_MINUTES = 15;
export const FULL_FROM_MINUTES = 40;

export function queueStateFor({
  waitMinutes,
  isOpen,
}: {
  waitMinutes: number;
  isOpen: boolean;
}): QueueState {
  // A closed wash is full regardless of its queue: you cannot join it.
  if (!isOpen) return 'full';

  if (waitMinutes < BUSY_FROM_MINUTES) return 'free';
  if (waitMinutes <= FULL_FROM_MINUTES) return 'busy';
  return 'full';
}
