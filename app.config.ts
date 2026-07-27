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
  name: 'Lavajna',
  slug: 'lavajna',
  scheme: 'lavajna',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',

  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.lavajna.app',
  },

  android: {
    package: 'com.lavajna.app',
    config: {
      // C1's map. Android has no built-in map provider, so without this the
      // MapView renders as a blank rectangle and nothing in the build says
      // why. See README → "Google Maps key". iOS uses Apple Maps and needs
      // no key.
      //
      // Not EXPO_PUBLIC_: it is read here at config time and baked into the
      // native manifest, not into the JS bundle. It still ships inside the
      // APK, so it must be restricted by package name and SHA-1 in the
      // Google Cloud console — restriction is what protects it, not secrecy.
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY },
    },
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

    // Whether, not what. `android.config` is stripped out of the public
    // manifest, so the app cannot read the key back to check it is there —
    // and a missing key shows up as a blank rectangle with no error anywhere.
    // This lets C1's map say so instead.
    hasAndroidMapsKey: Boolean(process.env.GOOGLE_MAPS_ANDROID_API_KEY),
  },
};

export default config;
