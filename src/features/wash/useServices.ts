/**
 * src/features/wash/useServices.ts
 *
 * O6's price list. Every mutation invalidates the wash too, because
 * nearby_car_washes derives "price from" and the wait estimate from these
 * rows — a change here changes what C1 shows.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteService,
  getServices,
  saveService,
  type ServiceDraft,
} from '@/data/repositories/WashRepository';
import { getMyWash } from '@/data/repositories/WashRepository';

export function useServices() {
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

  const servicesQuery = useQuery({
    queryKey: ['services', washId],
    enabled: washId !== null,
    queryFn: async () => {
      if (washId === null) return [];
      const result = await getServices(washId);
      if (!result.ok) throw new Error(result.reason);
      return result.value;
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['services'] });
    // C1's "price from" and its wait estimate both come off these rows.
    void queryClient.invalidateQueries({ queryKey: ['nearbyWashes'] });
  };

  const save = useMutation({
    mutationFn: async ({ draft, serviceId }: { draft: ServiceDraft; serviceId?: string }) => {
      if (washId === null) throw new Error('no wash');
      const result = await saveService(washId, draft, serviceId);
      if (!result.ok) throw new Error(result.reason);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (serviceId: string) => {
      const result = await deleteService(serviceId);
      if (!result.ok) throw new Error(result.reason);
    },
    onSuccess: invalidate,
  });

  return {
    rows: servicesQuery.data ?? [],
    isLoading: washQuery.isPending || (washId !== null && servicesQuery.isPending),
    isError: washQuery.isError || servicesQuery.isError,
    refetch: () => {
      void washQuery.refetch();
      void servicesQuery.refetch();
    },
    save,
    remove,
  };
}
