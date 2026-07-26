/**
 * app/(auth)/permissions.tsx — A7 · Permissions
 *
 * Every account passes through here. Both explanations are shown *before* the
 * OS prompt, which is the whole point of the screen: a system dialog with no
 * context is the easiest thing in the world to deny.
 *
 * "Later" is a real answer, not a nudge to reconsider. Both permissions are
 * re-requestable from C14 later, and neither blocks the app.
 *
 * The exit differs by role — clients go to the app, owners still have a car
 * wash to register.
 */
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMyProfile } from '@/data/repositories/AuthRepository';
import { Button } from '@/ui/Button';
import { radii, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function PermissionsScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();

  const [role, setRole] = useState<'client' | 'owner' | 'admin' | null>(null);
  const [asking, setAsking] = useState(false);

  // A6 just wrote the row, so this is the authoritative role — not the
  // pending one, which A6 has already cleared.
  useEffect(() => {
    let cancelled = false;

    getMyProfile().then((result) => {
      if (cancelled) return;
      if (result.ok && result.value !== null) setRole(result.value.role);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const leave = () => {
    // An owner who has not registered a wash yet has O1 ahead of them; A1
    // makes the same call on every later launch.
    router.replace(role === 'owner' ? '/(owner)/register' : '/(client)/home');
  };

  const onAllow = async () => {
    setAsking(true);

    // Sequential on purpose: two OS dialogs at once stack badly on Android,
    // and the second one gets dismissed along with the first.
    //
    // A denial is not an error. The user said no, the app continues, and the
    // screens that need the permission handle its absence — C1 has a
    // "location off" state for exactly this.
    await Location.requestForegroundPermissionsAsync().catch(() => undefined);
    await Notifications.requestPermissionsAsync().catch(() => undefined);

    setAsking(false);
    leave();
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[type.title, { color: c.text }]}>{t('auth.permTitle')}</Text>

        <View style={styles.reasons}>
          <Reason
            title={t('auth.permLocationTitle')}
            body={t('auth.permLocation')}
          />
          <Reason
            title={t('auth.permNotificationsTitle')}
            body={t('auth.permNotifications')}
          />
        </View>

        <View style={styles.footer}>
          <Button label={t('common.allow')} onPress={onAllow} loading={asking} />
          <Button
            label={t('common.later')}
            variant="ghost"
            onPress={leave}
            disabled={asking}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Reason({ title, body }: { title: string; body: string }) {
  const { c } = useTheme();

  return (
    <View style={[styles.reason, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[type.subtitle, { color: c.text }]}>{title}</Text>
      <Text style={[type.body, { color: c.textMuted }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    rowGap: spacing.xl,
  },
  reasons: { rowGap: spacing.md },
  reason: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    rowGap: spacing.xs,
  },
  footer: {
    marginTop: 'auto',
    rowGap: spacing.sm,
  },
});
