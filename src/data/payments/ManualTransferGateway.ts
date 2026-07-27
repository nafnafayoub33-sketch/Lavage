/**
 * src/data/payments/ManualTransferGateway.ts
 *
 * Phase 1: the owner transfers to the platform's bank account and an admin
 * confirms it against the statement.
 *
 * Nothing here moves money. It files a request; approve_topup (0009) is what
 * credits the account, and only an admin can call it.
 */
import {
  DEFAULT_PRESETS,
  isValidTopUpAmount,
  type PaymentGateway,
  type TopUpOutcome,
  type TopUpRequest,
} from '@/core/payments/PaymentGateway';
import { createTopUpRequest } from '@/data/repositories/CreditRepository';

export const manualTransferGateway: PaymentGateway = {
  id: 'manual_bank_transfer',

  // An admin checks the bank first. O7 promises a wait, not credit.
  settlesImmediately: false,

  presetAmounts: DEFAULT_PRESETS,

  async requestTopUp(request: TopUpRequest): Promise<TopUpOutcome> {
    if (!isValidTopUpAmount(request.amountCentimes)) {
      return { kind: 'failed', reason: 'amount' };
    }

    // Without a reference an admin cannot match the transfer to the request.
    const reference = request.reference?.trim() ?? '';
    if (reference === '') {
      return { kind: 'failed', reason: 'reference' };
    }

    const result = await createTopUpRequest({
      washId: request.washId,
      amountCentimes: request.amountCentimes,
      reference,
      receiptUrl: request.receiptUrl ?? null,
    });

    if (!result.ok) return { kind: 'failed', reason: result.reason };

    return { kind: 'awaitingReview', requestId: result.value };
  },
};

export default manualTransferGateway;
