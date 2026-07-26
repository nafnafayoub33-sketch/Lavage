/**
 * src/ui/useTheme.ts
 *
 * The hook theme.ts documents but does not ship.
 *
 *   const { c, scheme } = useTheme();
 *   <View style={{ backgroundColor: c.bg }} />
 *
 * The stored preference wins over the system setting:
 *   'system' | 'light' | 'dark'  ->  AsyncStorage key 'app.scheme'
 *
 * Preference lives in Zustand (UI state), not in TanStack Query (server cache).
 * Call `hydrateScheme()` once at startup, before the splash screen hides, so
 * the first paint is already in the right scheme.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { create } from 'zustand';

import { resolveScheme, schemes, type ColorScheme, type Colors, type SchemePreference } from './theme';

const STORAGE_KEY = 'app.scheme';

const PREFERENCES: readonly SchemePreference[] = ['system', 'light', 'dark'];

function isPreference(value: string | null): value is SchemePreference {
  return value !== null && (PREFERENCES as readonly string[]).includes(value);
}

type SchemeStore = {
  pref: SchemePreference;
  hydrated: boolean;
  setPref: (pref: SchemePreference) => Promise<void>;
  hydrate: () => Promise<void>;
};

const useSchemeStore = create<SchemeStore>((set) => ({
  pref: 'system',
  hydrated: false,

  setPref: async (pref) => {
    set({ pref });
    await AsyncStorage.setItem(STORAGE_KEY, pref);
  },

  hydrate: async () => {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    set({ pref: isPreference(saved) ? saved : 'system', hydrated: true });
  },
}));

/** Run once at startup, before hiding the splash screen. */
export const hydrateScheme = () => useSchemeStore.getState().hydrate();

export type Theme = {
  /** the resolved palette — light or dark, never both */
  c: Colors;
  /** what is actually on screen right now */
  scheme: ColorScheme;
  /** what the user asked for; 'system' means "follow the phone" */
  pref: SchemePreference;
  setPref: (pref: SchemePreference) => Promise<void>;
};

export function useTheme(): Theme {
  // useColorScheme() can also report 'unspecified'; resolveScheme() treats
  // anything it does not recognise as "no system preference".
  const system = useColorScheme();
  const pref = useSchemeStore((s) => s.pref);
  const setPref = useSchemeStore((s) => s.setPref);

  const scheme = resolveScheme(pref, system === 'light' || system === 'dark' ? system : null);

  return { c: schemes[scheme], scheme, pref, setPref };
}

export { PREFERENCES as SCHEME_PREFERENCES };
