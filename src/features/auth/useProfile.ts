/**
 * src/features/auth/useProfile.ts
 *
 * The signed-in user's profile, for C11.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { getMyProfile, signOut as signOutRequest } from '@/data/repositories/AuthRepository';

export function useProfile() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const result = await getMyProfile();
      if (!result.ok) throw new Error(result.reason);
      return result.value;
    },
  });

  const signOut = useCallback(async () => {
    await signOutRequest();
    // Otherwise the next signed-in user briefly sees the last one's data.
    queryClient.clear();
  }, [queryClient]);

  return {
    profile: query.data ?? null,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: () => void query.refetch(),
    signOut,
  };
}

export default useProfile;
