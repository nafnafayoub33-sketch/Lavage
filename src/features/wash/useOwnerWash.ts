/**
 * src/features/wash/useOwnerWash.ts
 *
 * O5's data. Saving invalidates the nearby query too — the name, address and
 * hours an owner edits here are what C1 shows a client.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { setOpenToday } from '@/data/repositories/OwnerQueueRepository';
import { getMyWash, updateWash, type WashDraft } from '@/data/repositories/WashRepository';

export function useOwnerWash() {
  const queryClient = useQueryClient();

  const washQuery = useQuery({
    queryKey: ['myWash'],
    queryFn: async () => {
      const result = await getMyWash();
      if (!result.ok) throw new Error(result.reason);
      return result.value;
    },
  });

  const washId = washQuery.data?.id ?? null;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['myWash'] });
    void queryClient.invalidateQueries({ queryKey: ['nearbyWashes'] });
  };

  const save = useMutation({
    mutationFn: async (draft: WashDraft) => {
      if (washId === null) throw new Error('no wash');
      const result = await updateWash(washId, draft);
      if (!result.ok) throw new Error(result.reason);
    },
    onSuccess: invalidate,
  });

  const toggleOpen = useMutation({
    mutationFn: async (isOpen: boolean) => {
      if (washId === null) throw new Error('no wash');
      const result = await setOpenToday(washId, isOpen);
      if (!result.ok) throw new Error(result.reason);
    },
    onSuccess: invalidate,
  });

  return {
    wash: washQuery.data ?? null,
    isLoading: washQuery.isPending,
    isError: washQuery.isError,
    refetch: () => void washQuery.refetch(),
    save,
    toggleOpen,
  };
}
