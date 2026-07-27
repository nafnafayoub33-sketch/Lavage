/**
 * src/features/booking/useCurrentTurn.ts
 *
 * C6's data: the booking, its position in the queue, and the state those two
 * add up to.
 *
 * Polls while a turn is live. ARCHITECTURE has this arriving over Supabase
 * Realtime, and it should — a queue that only moves every twenty seconds is
 * not the promise. This is the honest interim: correct, just not instant.
 * The subscription replaces the interval without changing this signature.
 */
import { useQuery } from '@tanstack/react-query';

import { resolveTurnState, type TurnState } from '@/core/usecases/turnState';
import {
  getCurrentBooking,
  getQueuePosition,
  type CurrentBooking,
  type QueuePosition,
} from '@/data/repositories/BookingRepository';

const LIVE_POLL_MS = 20_000;

export type CurrentTurn = {
  booking: CurrentBooking | null;
  position: QueuePosition | null;
  state: TurnState;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

export function useCurrentTurn(): CurrentTurn {
  const bookingQuery = useQuery({
    queryKey: ['currentBooking'],
    queryFn: async () => {
      const result = await getCurrentBooking();
      if (!result.ok) throw new Error(result.reason);
      return result.value;
    },
  });

  const booking = bookingQuery.data ?? null;

  // Only a queued booking has a position; a wash in progress has started and
  // a cancelled one has no queue to be in.
  const wantsPosition = booking !== null && booking.status === 'pending';

  const positionQuery = useQuery({
    queryKey: ['queuePosition', booking?.id],
    enabled: wantsPosition,
    refetchInterval: wantsPosition ? LIVE_POLL_MS : false,
    queryFn: async () => {
      if (booking === null) return null;
      const result = await getQueuePosition(booking.id);
      if (!result.ok) throw new Error(result.reason);
      return result.value;
    },
  });

  const position = positionQuery.data ?? null;

  return {
    booking,
    position,
    state: resolveTurnState(booking, position),
    isLoading: bookingQuery.isPending,
    isError: bookingQuery.isError,
    refetch: () => {
      void bookingQuery.refetch();
      void positionQuery.refetch();
    },
  };
}
