/**
 * app/(client)/account.tsx — C11 · Account
 *
 * Name and phone, then the way through to vehicles, settings, history and
 * the referral, and log out at the bottom.
 *
 * The points card from the spec is deliberately absent. There is no points
 * table in any migration — 0001 marks loyalty as phase 2, and C13 is phase 2
 * in the priority table. Drawing "7/10" over data that does not exist would
 * be a lie with a progress bar on it.
 *
 * The rows below it lead to screens that are also phase 2. They are here
 * because the way out of this screen is the screen, and each lands on a
 * placeholder that names itself.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useProfile } from '@/features/auth/useProfile';
import { useOffline } from '@/hooks/useOffline';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { SkeletonList } from '@/ui/Skeleton';
import { hitSize, numeric, radii, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function AccountScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const offline = useOffline();

  const { profile, isLoading, isError, refetch, signOut } = useProfile();
  const [signingOut, setSigningOut] = useState(false);

  const performSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      // Back to A1, which decides where an unauthenticated user belongs.
      router.replace('/');
    } catch (error) {
      console.error('[C11] could not sign out', error);
      Alert.alert(t('error.generic'), undefined, [{ text: t('common.close') }]);
      setSigningOut(false);
    }
  };

  const onSignOut = () => {
    Alert.alert(t('account.logout'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('account.logout'), style: 'destructive', onPress: () => void performSignOut() },
    ]);
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[type.title, { color: c.text }]}>{t('account.title')}</Text>

        {offline ? <Banner message={t('error.offline')} tone="muted" /> : null}

        {isLoading ? (
          <SkeletonList rows={4} />
        ) : isError || profile === null ? (
          <EmptyState
            message={t('error.generic')}
            actionLabel={t('common.retry')}
            onAction={refetch}
          />
        ) : (
          <>
            <View style={[styles.identity, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Text style={[type.subtitle, { color: c.text }]}>{profile.full_name}</Text>
              {profile.phone !== null ? (
                <Text style={[type.body, numeric, { color: c.textMuted }]}>{profile.phone}</Text>
              ) : null}
              {profile.city !== null ? (
                <Text style={[type.caption, { color: c.textFaint }]}>{profile.city}</Text>
              ) : null}
            </View>

            <View style={styles.rows}>
              <Row
                label={t('account.vehicles')}
                onPress={() => router.push('/(client)/account/vehicles')}
              />
              <Row
                label={t('account.history')}
                onPress={() => router.push('/(client)/history')}
              />
              <Row
                label={t('account.invite')}
                onPress={() => router.push('/(client)/account/points')}
              />
              <Row
                label={t('account.settings')}
                onPress={() => router.push('/(client)/account/settings')}
              />
            </View>

            <Button
              label={t('account.logout')}
              variant="secondary"
              onPress={onSignOut}
              loading={signingOut}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: c.line, backgroundColor: pressed ? c.raised : 'transparent' },
      ]}
    >
      <Text style={[type.body, { color: c.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    rowGap: spacing.lg,
  },
  identity: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    rowGap: spacing.xs,
  },
  rows: { rowGap: 0 },
  row: {
    minHeight: hitSize.min,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
