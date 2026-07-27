/**
 * src/data/repositories/CreditRepository.ts
 *
 * O7's data: the balance, the transaction history, the bank details, and
 * filing a top-up request.
 *
 * Approving one is not here — that is D8's, and it goes through
 * approve_topup(), which only an admin may call.
 */
import { supabase } from '@/data/supabase/client';

import type { AuthResult } from './AuthRepository';

export type CreditTransaction = {
  id: string;
  type: 'topup' | 'charge' | 'refund' | 'bonus';
  amountCentimes: number;
  balanceAfterCentimes: number;
  note: string | null;
  bookingId: string | null;
  createdAt: string;
};

export type TopUpRequestRow = {
  id: string;
  amountCentimes: number;
  reference: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string | null;
  createdAt: string;
};

/** Where the owner sends the money. Admin-editable through D9. */
export type BankDetails = {
  bank: string;
  accountHolder: string;
  rib: string;
  note: string;
};

export async function getTransactions(
  washId: string,
): Promise<AuthResult<CreditTransaction[]>> {
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('id, type, amount, balance_after, note, booking_id, created_at')
    .eq('car_wash_id', washId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };

  return {
    ok: true,
    value: data.map((row) => ({
      id: row.id,
      type: row.type,
      amountCentimes: row.amount,
      balanceAfterCentimes: row.balance_after,
      note: row.note,
      bookingId: row.booking_id,
      createdAt: row.created_at,
    })),
  };
}

/** The owner's own requests, newest first — a pending one is the O7 state. */
export async function getTopUpRequests(
  washId: string,
): Promise<AuthResult<TopUpRequestRow[]>> {
  const { data, error } = await supabase
    .from('topup_requests')
    .select('id, amount, reference, status, admin_note, created_at')
    .eq('car_wash_id', washId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };

  return {
    ok: true,
    value: data.map((row) => ({
      id: row.id,
      amountCentimes: row.amount,
      reference: row.reference,
      status: row.status,
      adminNote: row.admin_note,
      createdAt: row.created_at,
    })),
  };
}

/**
 * Files a request. Does not credit anything — 0009's RLS only lets an owner
 * insert a row that is already `pending`, and only an admin can move it on.
 */
export async function createTopUpRequest({
  washId,
  amountCentimes,
  reference,
  receiptUrl,
}: {
  washId: string;
  amountCentimes: number;
  reference: string;
  receiptUrl: string | null;
}): Promise<AuthResult<string>> {
  const { data, error } = await supabase
    .from('topup_requests')
    .insert({
      car_wash_id: washId,
      amount: amountCentimes,
      reference,
      receipt_url: receiptUrl,
    })
    .select('id')
    .single();

  if (error) return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };
  return { ok: true, value: data.id };
}

export async function getBankDetails(): Promise<AuthResult<BankDetails | null>> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'bank_transfer')
    .maybeSingle();

  if (error) return { ok: false, reason: error.code === undefined ? 'offline' : 'unknown' };
  if (data === null) return { ok: true, value: null };

  const value = data.value as Record<string, unknown>;
  return {
    ok: true,
    value: {
      bank: String(value.bank ?? ''),
      accountHolder: String(value.account_holder ?? ''),
      rib: String(value.rib ?? ''),
      note: String(value.note ?? ''),
    },
  };
}
