/**
 * src/features/credit/useCredit.ts
 *
 * O7's data. The gateway is injected rather than imported by the screen, so
 * swapping the manual transfer for a card provider is a one-line change here
 * and nothing at all in O7.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PaymentGateway, TopUpRequest } from '@/core/payments/PaymentGateway';
import { manualTransferGateway } from '@/data/payments/ManualTransferGateway';
import {
  getBankDetails,
  getTopUpRequests,
  getTransactions,
} from '@/data/repositories/CreditRepository';
import { getMyWash } from '@/data/repositories/WashRepository';

/** Phase 1. Replace this to switch providers; O7 does not change. */
export const activeGateway: PaymentGateway = manualTransferGateway;

export function useCredit() {
  const queryClient = useQueryClient();

  const washQuery = useQuery({
    queryKey: ['myWash'],
    queryFn: async () => {
      const result = await getMyWash();
      if (!result.ok) throw new Error(result.reason);
      return result.value;
    },
  });

  const wash = washQuery.data ?? null;
  const washId = wash?.id ?? null;

  const transactionsQuery = useQuery({
    queryKey: ['creditTransactions', washId],
    enabled: washId !== null,
    queryFn: async () => {
      if (washId === null) return [];
      const result = await getTransactions(washId);
      if (!result.ok) throw new Error(result.reason);
      return result.value;
    },
  });

  const requestsQuery = useQuery({
    queryKey: ['topupRequests', washId],
    enabled: washId !== null,
    queryFn: async () => {
      if (washId === null) return [];
      const result = await getTopUpRequests(washId);
      if (!result.ok) throw new Error(result.reason);
      return result.value;
    },
  });

  // Only fetched for a gateway that needs a human; a card provider would not
  // ask the owner to look at a RIB.
  const bankQuery = useQuery({
    queryKey: ['bankDetails'],
    enabled: !activeGateway.settlesImmediately,
    queryFn: async () => {
      const result = await getBankDetails();
      if (!result.ok) throw new Error(result.reason);
      return result.value;
    },
  });

  const submit = useMutation({
    mutationFn: async (request: Omit<TopUpRequest, 'washId'>) => {
      if (washId === null) throw new Error('no wash');
      return activeGateway.requestTopUp({ ...request, washId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['topupRequests'] });
      void queryClient.invalidateQueries({ queryKey: ['creditTransactions'] });
      void queryClient.invalidateQueries({ queryKey: ['myWash'] });
    },
  });

  const requests = requestsQuery.data ?? [];

  return {
    wash,
    transactions: transactionsQuery.data ?? [],
    /** at most one can be outstanding at a time in practice, and it is the O7 state */
    pendingRequest: requests.find((r) => r.status === 'pending') ?? null,
    lastRejected: requests.find((r) => r.status === 'rejected') ?? null,
    bank: bankQuery.data ?? null,
    gateway: activeGateway,
    isLoading: washQuery.isPending || (washId !== null && transactionsQuery.isPending),
    isError: washQuery.isError || transactionsQuery.isError,
    refetch: () => {
      void washQuery.refetch();
      void transactionsQuery.refetch();
      void requestsQuery.refetch();
    },
    submit,
  };
}
