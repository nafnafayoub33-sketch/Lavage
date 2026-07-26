/**
 * app/(auth)/profile-setup.tsx — A6 · Profile setup
 *
 * Every account passes through here, client and owner alike. This is where
 * the profile row is created, with the role picked at A5 — nothing else in
 * the system creates it.
 *
 * States: name empty (continue disabled) · saving · save failed with retry ·
 *         offline · role missing (sent back to A5).
 *
 * The photo from the spec is not built yet; it is optional there and needs a
 * storage bucket that does not exist. `avatar_url` stays null.
 */
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getSessionUserId, type AuthFailure } from '@/data/repositories/AuthRepository';
import { createProfile } from '@/data/repositories/ProfileRepository';
import { usePendingRole } from '@/features/auth/pendingRole';
import { useOffline } from '@/hooks/useOffline';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { radii, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function ProfileSetupScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const offline = useOffline();

  const role = usePendingRole((s) => s.role);
  const hydrate = usePendingRole((s) => s.hydrate);
  const clearRole = usePendingRole((s) => s.clear);

  const [hydrated, setHydrated] = useState(false);
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | null>(null);

  // The store is memory-only until something reads storage; a cold start
  // straight onto this screen would otherwise see no role at all.
  useEffect(() => {
    hydrate().finally(() => setHydrated(true));
  }, [hydrate]);

  const name = fullName.trim();
  const canContinue = name.length > 0 && !offline;

  const onSave = async () => {
    if (!canContinue || role === null) return;

    const userId = await getSessionUserId();
    if (userId === null) {
      // The session went away mid-signup. Start over rather than guess.
      router.replace('/(auth)/phone');
      return;
    }

    setSaving(true);
    setFailure(null);

    const result = await createProfile({
      userId,
      role,
      fullName: name,
      city: city.trim() === '' ? null : city.trim(),
    });

    setSaving(false);

    if (!result.ok) {
      setFailure(result.reason);
      return;
    }

    // The role has done its job and now lives in the database, where 0003
    // locks it. Keeping a stale copy on the device invites disagreement.
    await clearRole();
    router.replace('/(auth)/permissions');
  };

  if (!hydrated) return null;
  // No role means A5 never happened — nothing here can be saved without it.
  if (role === null) return <Redirect href="/(auth)/role" />;

  const message = offline ? t('error.offline') : failureMessage(failure, t);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[type.title, { color: c.text }]}>{t('auth.nameTitle')}</Text>

          {message ? <Banner message={message} tone={offline ? 'muted' : 'error'} /> : null}

          <View style={styles.fields}>
            <Field
              value={fullName}
              onChange={setFullName}
              placeholder={t('auth.namePlaceholder')}
              editable={!saving}
              autoFocus
              autoComplete="name"
            />
            <Field
              value={city}
              onChange={setCity}
              placeholder={t('auth.cityPlaceholder')}
              editable={!saving}
              autoComplete="postal-address-locality"
            />
          </View>

          <View style={styles.footer}>
            <Button
              label={t('common.continue')}
              onPress={onSave}
              disabled={!canContinue}
              loading={saving}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  value,
  onChange,
  placeholder,
  editable,
  autoFocus = false,
  autoComplete,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  editable: boolean;
  autoFocus?: boolean;
  autoComplete: 'name' | 'postal-address-locality';
}) {
  const { c } = useTheme();

  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={c.textFaint}
      editable={editable}
      autoFocus={autoFocus}
      autoComplete={autoComplete}
      style={[
        type.subtitle,
        styles.field,
        { backgroundColor: c.surface, borderColor: c.line, color: c.text },
      ]}
    />
  );
}

function failureMessage(
  failure: AuthFailure | null,
  t: (key: string) => string,
): string | null {
  switch (failure) {
    case null:
      return null;
    case 'offline':
      return t('error.network');
    // 0003 refused a role change: the row exists under another role, and only
    // an admin can move it.
    case 'blocked':
      return t('auth.roleWarn');
    default:
      return t('error.generic');
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    rowGap: spacing.lg,
  },
  fields: { rowGap: spacing.md },
  field: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  footer: { marginTop: 'auto' },
});
