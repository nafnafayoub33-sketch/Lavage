/**
 * src/data/supabase/client.ts
 *
 * The single Supabase client for the app.
 *
 * Screens never import this file — data access goes through
 * src/data/repositories/*. See CLAUDE.md.
 */
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

import type { Database } from './types';

/**
 * Values live in `.env` and are surfaced through app.config.ts -> extra.
 * The `process.env` fallback covers runtimes where the manifest is not
 * populated (unit tests, for instance).
 */
function readConfig(key: 'supabaseUrl' | 'supabaseAnonKey', envVar: string): string {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const fromExtra = extra?.[key];
  const value = typeof fromExtra === 'string' && fromExtra.length > 0 ? fromExtra : process.env[envVar];

  if (!value) {
    throw new Error(
      `Missing ${envVar}. Copy .env.example to .env and fill it in, then restart the dev server.`,
    );
  }
  return value;
}

const supabaseUrl = readConfig('supabaseUrl', 'EXPO_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = readConfig('supabaseAnonKey', 'EXPO_PUBLIC_SUPABASE_ANON_KEY');

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // AsyncStorage, never localStorage — this app has no web target.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based auth callbacks on native; sessions come from the OTP flow.
    detectSessionInUrl: false,
  },
});

export default supabase;
