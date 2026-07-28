/**
 * src/features/booking/useCurrentTurn.ts
 *
 * C6's data: the booking, its position in the queue, and the state those two
 * add up to.
 *
 * Live over Supabase Realtime. This used to poll every 20 seconds, which put
 * up to 20 seconds between the car ahead finishing and the screen saying so.
 * The app promises to tell you when one car is left, and a promise that
 * arrives late is a different promise.
 *
 * Two things besides the events themselves keep it honest:
 *
 *   a refetch on every (re)subscribe, because whatever happened while the
 *   socket was away arrives as nothing at all
 *
 *   a refetch when the app returns to the foreground, because a phone in a
 *   pocket drops the socket without telling the client
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { resolveTurnState, type TurnState } from '@/core/usecases/turnState';
import {
  getCurrentBooking,
  getQueuePosition,
  type CurrentBooking,
  type QueuePosition,
} from '@/data/repositories/BookingRepository';
import { subscribeToQueue } from '@/data/realtime/queueChannel';

export type CurrentTurn = {
  booking: CurrentBooking | null;
  position: QueuePosition | null;
  state: TurnState;
  isLoading: boolean;
  isError: boolean;
  /** true once Realtime is attached and this screen is genuinely live */
  isLive: boolean;
  refetch: () => void;
};

export function useCurrentTurn(): CurrentTurn {
  const queryClient = useQueryClient();
  const [isLive, setIsLive] = useState(false);

  const bookingQuery = useQuery({
    queryKey: ['currentBooking'],
    queryFn: async () => {
      const result = await getCurrentBooking();
      if (!result.ok) throw new Error(result.reason);
      return result.value;
    },
  });

  const booking = bookingQuery.data ?? null;

  // A queued booking has a position in a queue. One in progress has started,
  // and a cancelled one has no queue to be in.
  const wantsPosition = booking !== null && booking.status === 'pending';

  const positionQuery = useQuery({
    queryKey: ['queuePosition', booking?.id],
    enabled: wantsPosition,
    queryFn: async () => {
      if (booking === null) return null;
      const result = await getQueuePosition(booking.id);
      if (!result.ok) throw new Error(result.reason);
      return result.value;
    },
  });

  // Both states are worth watching: a pending booking moves up the queue, an
  // in-progress one is about to finish and hand over to C8.
  const watching =
    booking !== null && (booking.status === 'pending' || booking.status === 'in_progress');
  const washId = watching ? booking.washId : null;

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['currentBooking'] });
    void queryClient.invalidateQueries({ queryKey: ['queuePosition'] });
  }, [queryClient]);

  useEffect(() => {
    if (!watching || washId === null) {
      setIsLive(false);
      return;
    }

    const unsubscribe = subscribeToQueue({
      washId,
      onChange: invalidate,
      onStatus: (status) => {
        const live = status === 'subscribed';
        setIsLive(live);
        // Catch up on anything missed while the socket was down.
        if (live) invalidate();
      },
    });

    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') invalidate();
    });

    return () => {
      unsubscribe();
      appState.remove();
      setIsLive(false);
    };
  }, [watching, washId, invalidate]);

  const position = positionQuery.data ?? null;

  return {
    booking,
    position,
    state: resolveTurnState(booking, position),
    isLoading: bookingQuery.isPending,
    isError: bookingQuery.isError,
    isLive,
    refetch: () => {
      void bookingQuery.refetch();
      void positionQuery.refetch();
    },
  };
}
