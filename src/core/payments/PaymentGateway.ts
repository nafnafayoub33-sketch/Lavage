/**
 * src/core/payments/PaymentGateway.ts
 *
 * How a car wash adds credit, without O7 knowing who processes it.
 *
 * Phase 1 is a bank transfer an admin approves by hand. Phase 2 is a card
 * provider — CMI, PayZone or Naps. Those differ in almost every respect
 * except the two things O7 actually needs: start a top-up, and know whether
 * the money has landed or is still being checked.
 *
 * Framework-free and provider-free on purpose. Never import a provider SDK
 * into a screen; implement this instead.
 */

/** What the owner is asking for. */
export type TopUpRequest = {
  washId: string;
  /** centimes, like all money here */
  amountCentimes: number;
  /**
   * The owner's own note tying this to a real transfer. A card gateway will
   * ignore it; a bank transfer is unidentifiable without it.
   */
  reference?: string;
  /** Optional proof, when the gateway and the storage bucket support one. */
  receiptUrl?: string | null;
};

export type TopUpOutcome =
  /** Money has landed. The balance is already higher. */
  | { kind: 'settled' }
  /** Somebody has to look at it first. The balance has not moved. */
  | { kind: 'awaitingReview'; requestId: string }
  /** The gateway refused before any money moved. */
  | { kind: 'failed'; reason: string };

export interface PaymentGateway {
  /** Stable identifier, for logs and for the ledger note. */
  readonly id: string;

  /**
   * True when a human approves before the balance moves. O7 uses this to
   * decide whether to promise credit now or explain the wait — the one place
   * the difference between manual and card is allowed to show.
   */
  readonly settlesImmediately: boolean;

  /** The amounts to offer as one-tap choices, in centimes. O7 also allows a custom amount. */
  readonly presetAmounts: readonly number[];

  requestTopUp(request: TopUpRequest): Promise<TopUpOutcome>;
}

/** O7: "20 / 50 / 100 / 200 DH or a custom amount". */
export const DEFAULT_PRESETS = [2000, 5000, 10_000, 20_000] as const;

/** The smallest top-up worth a bank transfer and an admin's attention. */
export const MIN_TOPUP_CENTIMES = 2000;

/**
 * Whether an amount can be submitted at all. Pure, so O7's disabled button
 * and any future gateway agree on the rule.
 */
export function isValidTopUpAmount(centimes: number): boolean {
  return Number.isInteger(centimes) && centimes >= MIN_TOPUP_CENTIMES;
}
