/**
 * app/(auth)/phone.tsx — A3 · Phone number
 *
 * States: invalid number · number blocked · offline · sending ·
 *         SMS rate limited.
 *
 * Route only. Validation is src/core/usecases/phone.ts, the network call is
 * AuthRepository, connectivity is useOffline.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isComplete, isValidMobile, toE164 } from '@/core/usecases/phone';
import { sendOtp, type AuthFailure } from '@/data/repositories/AuthRepository';
import { PhoneField } from '@/features/auth/PhoneField';
import { useOffline } from '@/hooks/useOffline';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function PhoneScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const offline = useOffline();

  const [digits, setDigits] = useState('');
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | null>(null);

  const complete = isComplete(digits);
  // Only complain once they have typed a full number — nobody wants to be
  // told they are wrong halfway through.
  const invalid = complete && !isValidMobile(digits);

  const onSend = async () => {
    if (!isValidMobile(digits) || offline) return;

    setSending(true);
    setFailure(null);

    const result = await sendOtp(toE164(digits));
    setSending(false);

    if (!result.ok) {
      setFailure(result.reason);
      return;
    }

    router.push({ pathname: '/(auth)/otp', params: { phone: digits } });
  };

  const message = offline ? t('error.offline') : failureMessage(failure, t);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={[type.title, { color: c.text }]}>{t('auth.phoneTitle')}</Text>
            <Text style={[type.body, { color: c.textMuted }]}>{t('auth.phoneSub')}</Text>
          </View>

          {message ? <Banner message={message} tone={offline ? 'muted' : 'error'} /> : null}

          <PhoneField
            value={digits}
            onChange={(next) => {
              setDigits(next);
              setFailure(null);
            }}
            invalid={invalid || failure === 'blocked'}
            editable={!sending}
            autoFocus
          />

          {invalid ? (
            <Text style={[type.label, { color: c.bad }]}>{t('auth.phoneInvalid')}</Text>
          ) : null}

          <View style={styles.footer}>
            <Text style={[type.caption, styles.terms, { color: c.textFaint }]}>
              {t('auth.terms')}
            </Text>

            <Button
              label={t('auth.sendCode')}
              onPress={onSend}
              disabled={!isValidMobile(digits) || offline}
              loading={sending}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Everything except 'offline', which the banner handles from live state. */
function failureMessage(failure: AuthFailure | null, t: (key: string) => string): string | null {
  switch (failure) {
    case 'blocked':
      return t('auth.phoneBlocked');
    case 'sms_rate_limit':
      return t('auth.smsLimit');
    case 'offline':
      return t('error.network');
    case null:
      return null;
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
  header: { rowGap: spacing.sm },
  footer: {
    marginTop: 'auto',
    rowGap: spacing.lg,
  },
  terms: { textAlign: 'center' },
});
