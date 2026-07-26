/**
 * src/hooks/useOffline.ts
 *
 * SCREENS.md rule 3: offline shows a banner and cached data stays visible.
 *
 * Deliberately conservative — only an explicit "not connected" counts as
 * offline. While the state is still unknown we say online, because a banner
 * that flashes on every cold start trains people to ignore it.
 */
import { useNetworkState } from 'expo-network';

export function useOffline(): boolean {
  const { isConnected, isInternetReachable } = useNetworkState();

  // A connected device on a captive portal reports reachable === false.
  if (isInternetReachable === false) return true;
  return isConnected === false;
}

export default useOffline;
