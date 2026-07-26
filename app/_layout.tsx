/**
 * app/_layout.tsx
 *
 * Boot: fonts, language, colour scheme — then the app.
 *
 * This will become the role gate (redirect by profile.role) once auth exists.
 * Routes hold no business logic; this file only wires providers.
 */
// Per-weight subpaths on purpose: importing the package root drags all seven
// weights into the bundle, and theme.ts only names four.
import { IBMPlexSansArabic_400Regular } from '@expo-google-fonts/ibm-plex-sans-arabic/400Regular';
import { IBMPlexSansArabic_500Medium } from '@expo-google-fonts/ibm-plex-sans-arabic/500Medium';
import { IBMPlexSansArabic_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold';
import { IBMPlexSansArabic_700Bold } from '@expo-google-fonts/ibm-plex-sans-arabic/700Bold';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import i18n, { initI18n } from '@/lib/i18n';
import { queryClient } from '@/lib/queryClient';
import { hydrateScheme, useTheme } from '@/ui/useTheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    // Language and stored colour scheme, both read from AsyncStorage.
    Promise.all([initI18n(), hydrateScheme()]).finally(() => setBootstrapped(true));
  }, []);

  const ready = bootstrapped && (fontsLoaded || fontError !== null);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ThemedStack />
      </I18nextProvider>
    </QueryClientProvider>
  );
}

/** Split out so it sits under the providers and can read the theme. */
function ThemedStack() {
  const { c, scheme } = useTheme();

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg },
        }}
      />
    </>
  );
}
