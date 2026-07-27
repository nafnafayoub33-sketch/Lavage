/**
 * app/index.tsx
 *
 * A1's decision — "not signed in -> A2 | client -> home | approved owner ->
 * queue | pending owner -> O2" — without A1's logo.
 *
 * A2 only appears once: a stored language is written the first time the user
 * picks one, so its absence is what "first launch" means.
 */
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { signOut, getSessionUserId } from '@/data/repositories/AuthRepository';
import { landingHref, resolveLanding } from '@/features/auth/resolveLanding';
import { hasChosenLanguage } from '@/lib/i18n';
import { useTheme } from '@/ui/useTheme';

type Landing =
  | { kind: 'loading' }
  | { kind: 'language' }
  | { kind: 'auth' }
  | { kind: 'signedIn'; href: ReturnType<typeof landingHref> };

export default function Index() {
  const { c } = useTheme();
  const [landing, setLanding] = useState<Landing>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const userId = await getSessionUserId();
      if (cancelled) return;

      if (userId === null) {
        // A2 before A3, but only ever once.
        const chosen = await hasChosenLanguage();
        if (cancelled) return;
        setLanding({ kind: chosen ? 'auth' : 'language' });
        return;
      }

      const destination = await resolveLanding();
      if (cancelled) return;

      // Could not read the profile — do not strand the user on a spinner.
      if (destination === null) {
        setLanding({ kind: 'auth' });
        return;
      }

      if (destination.kind === 'blocked') await signOut();
      setLanding({ kind: 'signedIn', href: landingHref(destination) });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  switch (landing.kind) {
    case 'loading':
      return (
        <View style={[styles.fill, { backgroundColor: c.bg }]}>
          <ActivityIndicator color={c.textMuted} />
        </View>
      );
    case 'language':
      return <Redirect href="/(auth)/language" />;
    case 'auth':
      return <Redirect href="/(auth)/phone" />;
    case 'signedIn':
      return <Redirect href={landing.href} />;
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
