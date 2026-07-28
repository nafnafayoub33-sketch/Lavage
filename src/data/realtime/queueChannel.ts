/**
 * src/data/realtime/queueChannel.ts
 *
 * The live queue, for C6.
 *
 * Subscribes to a wash's summary row rather than to `bookings`. Realtime
 * applies RLS to postgres_changes, and "read own bookings" means a client is
 * never sent an event about anybody else's row — so a bookings subscription
 * would deliver your own status changes and silently never tell you the car
 * ahead of you finished. queue_events (0006) exists to carry that.
 *
 * The payload is deliberately ignored. It is a nudge to refetch, and the
 * numbers on screen come from my_queue_position, which checks ownership.
 * Acting on the payload would mean trusting a broadcast to be in order and
 * complete; a refetch is neither of those things and does not need to be.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/data/supabase/client';

export type QueueSubscriptionStatus = 'subscribed' | 'closed' | 'error';

/**
 * Watch one wash. Returns the unsubscribe function.
 *
 * `onStatus` matters as much as `onChange`: Realtime can drop and reconnect,
 * and anything that happened while it was away arrives as nothing at all. The
 * caller refetches on every (re)subscribe to close that gap.
 */
export function subscribeToQueue({
  washId,
  onChange,
  onStatus,
}: {
  washId: string;
  onChange: () => void;
  onStatus?: (status: QueueSubscriptionStatus) => void;
}): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`queue:${washId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'queue_events',
        filter: `car_wash_id=eq.${washId}`,
      },
      () => onChange(),
    )
    .subscribe((status) => {
      switch (status) {
        case 'SUBSCRIBED':
          onStatus?.('subscribed');
          return;
        case 'CHANNEL_ERROR':
        case 'TIMED_OUT':
          onStatus?.('error');
          return;
        case 'CLOSED':
          onStatus?.('closed');
          return;
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}
