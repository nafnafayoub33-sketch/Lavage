/**
 * app/index.tsx
 *
 * A1's decision — "not signed in -> A2 | client -> home | owner -> queue" —
 * without A1's visual. The logo screen and A2 (language) are not built yet,
 * so this sends new users straight to A3.
 *
 * This replaced the skeleton smoke-test screen, as the README said it would.
 * Language now follows the device locale until A2 lands; appearance follows
 * the system setting until C14 lands.
 */
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { resolvePostAuthDestination, type PostAuthDestination } from '@/core/usecases/postAuthRoute';
import { getMyProfile, getSessionUserId, signOut } from '@/data/repositories/AuthRepository';
import { useTheme } from '@/ui/useTheme';

type Landing = { kind: 'loading' } | { kind: 'auth' } | { kind: 'signedIn'; to: PostAuthDestination };

export default function Index() {
  const { c } = useTheme();
  const [landing, setLanding] = useState<Landing>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const userId = await getSessionUserId();
      if (cancelled) return;

      if (userId === null) {
        setLanding({ kind: 'auth' });
        return;
      }

      const profile = await getMyProfile();
      if (cancelled) return;

      // A profile we cannot read is not a reason to strand the user on a
      // spinner — send them back through sign-in.
      if (!profile.ok) {
        setLanding({ kind: 'auth' });
        return;
      }

      const to = resolvePostAuthDestination(profile.value);
      if (to.kind === 'blocked') await signOut();

      setLanding({ kind: 'signedIn', to });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (landing.kind === 'loading') {
    return (
      <View style={[styles.fill, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.textMuted} />
      </View>
    );
  }

  if (landing.kind === 'auth') return <Redirect href="/(auth)/phone" />;

  switch (landing.to.kind) {
    case 'blocked':
      return <Redirect href="/(auth)/phone" />;
    case 'role':
      return <Redirect href="/(auth)/role" />;
    case 'app':
      switch (landing.to.role) {
        case 'owner':
          return <Redirect href="/(owner)/queue" />;
        case 'admin':
          return <Redirect href="/(admin)" />;
        case 'client':
          return <Redirect href="/(client)/home" />;
      }
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
