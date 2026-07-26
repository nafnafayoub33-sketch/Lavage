import type { ExpoConfig } from 'expo/config';

/**
 * app.config.ts
 *
 * Android + iOS only — there is no web target (see CLAUDE.md: no web-only APIs).
 *
 * Supabase keys come from `.env` (see `.env.example`). They are surfaced under
 * `extra` so the app reads them through one documented place; never inline a key
 * in source. The anon key is public by design — row level security is what
 * protects the data, not secrecy of this key.
 */
const config: ExpoConfig = {
  name: 'Lavage',
  slug: 'lavage',
  scheme: 'lavage',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',

  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.lavage.app',
  },

  android: {
    package: 'com.lavage.app',
    adaptiveIcon: {
      backgroundColor: '#0B0C0E',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },

  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0B0C0E',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    [
      // Arabic is the default language and the only RTL one. `supportsRTL`
      // lets the native side mirror the layout; the actual flip happens at
      // runtime in src/lib/i18n.ts.
      'expo-localization',
      {
        supportsRTL: true,
        supportedLocales: ['ar', 'fr', 'en'],
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },

  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default config;
