/**
 * src/features/booking/useActiveBooking.ts
 *
 * The banner on C1: "You have a place at X · number 12".
 *
 * Returns null rather than an error state — a banner that cannot load is a
 * banner that does not appear, and failing to show it must never take the
 * screen behind it down.
 */
import { useQuery } from '@tanstack/react-query';

import { getActiveBooking, type ActiveBooking } from '@/data/repositories/BookingRepository';

export function useActiveBooking(): ActiveBooking | null {
  const { data } = useQuery({
    queryKey: ['activeBooking'],
    queryFn: async () => {
      const result = await getActiveBooking();
      if (!result.ok) throw new Error(result.reason);
      return result.value;
    },
    // The queue moves; C6 subscribes to it properly over Realtime, but this
    // banner only needs to be roughly current.
    staleTime: 30_000,
  });

  return data ?? null;
}
