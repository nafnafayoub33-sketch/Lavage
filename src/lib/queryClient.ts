/**
 * src/lib/queryClient.ts
 *
 * One QueryClient for the app. Server cache only — UI state belongs in
 * Zustand, see CLAUDE.md.
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Queue data goes stale fast, but it arrives over Realtime rather than
      // by polling. Per-query overrides are the right place to tune this.
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export default queryClient;
