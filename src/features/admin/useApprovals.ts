/**
 * src/features/admin/useApprovals.ts
 *
 * D2's data.
 *
 * Both decisions invalidate the list rather than mutating it in place: the
 * RPCs refuse a wash that is no longer pending, so a stale list is not a
 * cosmetic problem — it produces a decision that silently fails. Refetching
 * is the honest answer.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  approveWash,
  getPendingWashes,
  rejectWash,
  type PendingWash,
} from '@/data/repositories/AdminRepository';

export function useApprovals() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['pendingWashes'],
    queryFn: async () => {
      const result = await getPendingWashes();
      if (!result.ok) throw new Error(result.reason);
      return result.value;
    },
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['pendingWashes'] });
  }, [queryClient]);

  const approve = useMutation({
    mutationFn: async (washId: string) => {
      const result = await approveWash(washId);
      if (!result.ok) throw new Error(result.reason);
    },
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: async ({ washId, reason }: { washId: string; reason: string }) => {
      const result = await rejectWash(washId, reason);
      if (!result.ok) throw new Error(result.reason);
    },
    onSuccess: invalidate,
  });

  const washes: PendingWash[] = query.data ?? [];

  return {
    washes,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: () => void query.refetch(),
    approve,
    reject,
  };
}
