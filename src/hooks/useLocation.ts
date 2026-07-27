/**
 * src/hooks/useLocation.ts
 *
 * Where the user is, for C1.
 *
 * A7 already asked for this permission with an explanation, so this never
 * prompts on mount — it reads the current grant and reports it. Asking again
 * unprompted, on a screen the user just opened, is how permission dialogs
 * become noise. `request()` is exposed for the "Turn on location" button.
 *
 * Denial is a state, not an error: C1 has a whole screen for it.
 */
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';

export type Coords = { latitude: number; longitude: number };

export type LocationState =
  /** still finding out */
  | { status: 'loading' }
  /** permission granted and we have a fix */
  | { status: 'ready'; coords: Coords }
  /** the user said no, or the OS has it switched off */
  | { status: 'denied' }
  /** granted, but the fix itself failed */
  | { status: 'unavailable' };

export function useLocation() {
  const [state, setState] = useState<LocationState>({ status: 'loading' });

  const read = useCallback(async ({ prompt }: { prompt: boolean }) => {
    setState({ status: 'loading' });

    try {
      const permission = prompt
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();

      if (!permission.granted) {
        setState({ status: 'denied' });
        return;
      }

      // Balanced accuracy: C1 sorts by distance and draws pins, neither of
      // which needs a GPS-grade fix, and the cheaper one returns much faster.
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setState({
        status: 'ready',
        coords: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
      });
    } catch (error) {
      console.error('[useLocation] could not read the position', error);
      setState({ status: 'unavailable' });
    }
  }, []);

  useEffect(() => {
    void read({ prompt: false });
  }, [read]);

  /** For the "Turn on location" button — this one may show the OS prompt. */
  const request = useCallback(() => read({ prompt: true }), [read]);

  return { state, request };
}

/**
 * Once a permission is denied for good the OS prompt stops appearing, and
 * the only way through is the app's settings page.
 */
export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch (error) {
    console.error('[useLocation] could not open app settings', error);
  }
}
