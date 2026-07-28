/**
 * src/core/usecases/ownerCredit.ts
 *
 * How much trouble the owner's balance is in.
 *
 * The platform charges 1 DH per confirmed wash against a prepaid balance,
 * and a wash at zero stops appearing in search — 0004 drops it from
 * nearby_car_washes. O3 has to say so before that happens, not after.
 *
 * Free washes come first: a new wash with 100 of them and no balance is
 * perfectly healthy, and warning it about money would be wrong.
 */

/** "Your balance is under 10 DH" — in centimes, because money always is. */
export const LOW_BALANCE_CENTIMES = 1000;

export type CreditState =
  /** nothing to worry about */
  | 'ok'
  /** running out — amber warning */
  | 'low'
  /** invisible to clients until topped up — red screen */
  | 'empty';

export function creditStateFor({
  balanceCentimes,
  freeWashesLeft,
}: {
  balanceCentimes: number;
  freeWashesLeft: number;
}): CreditState {
  // The welcome quota is spent before the balance is, so while it lasts the
  // balance is not what keeps the wash listed.
  if (freeWashesLeft > 0) return 'ok';

  if (balanceCentimes <= 0) return 'empty';
  if (balanceCentimes < LOW_BALANCE_CENTIMES) return 'low';
  return 'ok';
}

/** Exactly the condition 0004 uses to hide a wash from search. */
export const isHiddenFromClients = (state: CreditState): boolean => state === 'empty';
