/**
 * app/(auth)/role.tsx — A5 · Account type
 *
 * Two cards: "I have a car" / "I own a car wash".
 * The choice cannot be changed later except by an admin, so it confirms
 * before committing — CLAUDE.md treats irreversible actions like
 * destructive ones.
 *
 * The role is not written to the database here: profiles.full_name is NOT
 * NULL and no name has been collected yet, so the row cannot exist until A6.
 * It waits in the pendingRole store.
 *
 * Both roles go to A6 next. Owners used to be sent straight to O1, which
 * could not work — O1 inserts a car_wash whose owner_id references a profile
 * row that would not exist yet.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePendingRole, type SignupRole } from '@/features/auth/pendingRole';
import { Banner } from '@/ui/Banner';
import { hitSize, radii, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function RoleScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const choose = usePendingRole((s) => s.choose);

  const [saving, setSaving] = useState<SignupRole | null>(null);
  const [failed, setFailed] = useState(false);

  /**
   * Never rejects. It used to, and the rejection went nowhere: the caller was
   * an Alert button, so a failed write left the screen with no error, no
   * navigation, and `saving` stuck — which disabled both cards and made A5 a
   * dead end.
   */
  const commit = async (role: SignupRole) => {
    setSaving(role);
    setFailed(false);

    try {
      await choose(role);
    } catch (error) {
      // Worth a log line: this is a device storage failure, and the message
      // is the only clue to which one.
      console.error('[A5] could not persist the chosen role', error);
      setFailed(true);
      setSaving(null);
      return;
    }

    // Same next screen for both — the paths diverge after A7.
    router.replace('/(auth)/profile-setup');
  };

  // Irreversible: confirm before committing.
  const onPick = (role: SignupRole) => {
    const label = role === 'owner' ? t('auth.roleOwner') : t('auth.roleClient');

    Alert.alert(label, t('auth.roleWarn'), [
      { text: t('common.cancel'), style: 'cancel' },
      // Safe to discard: commit() handles its own failures.
      { text: t('common.confirm'), onPress: () => void commit(role) },
    ]);
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[type.title, { color: c.text }]}>{t('auth.roleTitle')}</Text>
          <Text style={[type.body, { color: c.textMuted }]}>{t('auth.roleWarn')}</Text>
        </View>

        {failed ? <Banner message={t('error.generic')} /> : null}

        <View style={styles.cards}>
          <RoleCard
            label={t('auth.roleClient')}
            onPress={() => onPick('client')}
            disabled={saving !== null}
          />
          <RoleCard
            label={t('auth.roleOwner')}
            onPress={() => onPick('owner')}
            disabled={saving !== null}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function RoleCard({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: pressed ? c.lineStrong : c.line,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Text style={[type.title, { color: c.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flex: 1,
    padding: spacing.xl,
    rowGap: spacing.xxl,
    justifyContent: 'center',
  },
  header: { rowGap: spacing.sm },
  cards: { rowGap: spacing.lg },
  card: {
    minHeight: hitSize.primary + spacing.xxl,
    justifyContent: 'center',
    padding: spacing.xl,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
