/**
 * app/(auth)/otp.tsx — A4 · SMS code
 *
 * States: countdown running · resend available · wrong code with attempts
 *         left · locked out 15 minutes · code expired · verifying · offline.
 *
 * Route only. The lockout policy is src/core/usecases/otpLockout.ts, the
 * new-vs-returning branch is src/core/usecases/postAuthRoute.ts.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COUNTRY_PREFIX, formatNational, isValidMobile, toE164 } from '@/core/usecases/phone';
import { resolvePostAuthDestination } from '@/core/usecases/postAuthRoute';
import {
  getMyProfile,
  resendOtp,
  signOut,
  verifyOtp,
  type AuthFailure,
} from '@/data/repositories/AuthRepository';
import { CODE_LENGTH, OtpBoxes } from '@/features/auth/OtpBoxes';
import { useOtpLockout } from '@/features/auth/useOtpLockout';
import { useResendCountdown } from '@/features/auth/useResendCountdown';
import { useOffline } from '@/hooks/useOffline';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { numeric, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function OtpScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const offline = useOffline();

  const { phone } = useLocalSearchParams<{ phone: string }>();
  const nationalDigits = phone ?? '';
  // A deep link straight to /otp can carry nothing usable. Never throw on it.
  const phoneE164 = isValidMobile(nationalDigits) ? toE164(nationalDigits) : null;

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | null>(null);

  const countdown = useResendCountdown();
  const lockout = useOtpLockout(phoneE164 ?? 'unknown');

  const blocked = lockout.locked || verifying || offline || phoneE164 === null;

  const submit = async (value: string) => {
    if (phoneE164 === null) return;

    setVerifying(true);
    setFailure(null);

    const result = await verifyOtp(phoneE164, value);

    if (!result.ok) {
      setVerifying(false);
      setFailure(result.reason);
      setCode('');
      // An expired code is not a wrong guess — do not spend an attempt on it.
      if (result.reason === 'invalid_code') await lockout.fail();
      return;
    }

    await lockout.reset();
    await routeOnward();
  };

  /**
   * A4 -> "new user: A5 | returning: the app".
   * The blocked re-check is defence in depth: 0002_is_phone_blocked.sql
   * already saved the SMS, this catches anyone blocked mid-session.
   */
  const routeOnward = async () => {
    const profile = await getMyProfile();
    setVerifying(false);

    if (!profile.ok) {
      setFailure(profile.reason);
      return;
    }

    const destination = resolvePostAuthDestination(profile.value);

    switch (destination.kind) {
      case 'blocked':
        await signOut();
        setFailure('blocked');
        return;
      case 'role':
        router.replace('/(auth)/role');
        return;
      case 'app':
        router.replace(homeFor(destination.role));
        return;
    }
  };

  // Six digits in, check it — nobody should have to press a second button
  // after typing the last digit.
  useEffect(() => {
    if (code.length === CODE_LENGTH && !blocked) void submit(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, blocked]);

  const onResend = async () => {
    if (phoneE164 === null) return;

    setFailure(null);
    setCode('');

    const result = await resendOtp(phoneE164);
    if (!result.ok) {
      setFailure(result.reason);
      return;
    }

    // A fresh code deserves a fresh set of attempts.
    await lockout.reset();
    countdown.restart();
  };

  const message = offline
    ? t('error.offline')
    : lockout.locked
      ? t('auth.otpLocked', { minutes: lockout.lockedMinutes })
      : failureMessage(failure, lockout.attemptsLeft, t);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={[type.title, { color: c.text }]}>{t('auth.otpTitle')}</Text>

            <Text style={[type.body, { color: c.textMuted }]}>
              {t('auth.otpSub', {
                phone: `${COUNTRY_PREFIX} ${formatNational(nationalDigits)}`,
              })}
            </Text>

            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <Text style={[type.label, { color: c.text }]}>{t('auth.changeNumber')}</Text>
            </Pressable>
          </View>

          {message ? (
            <Banner message={message} tone={offline ? 'muted' : 'error'} />
          ) : null}

          <OtpBoxes
            value={code}
            onChange={(next) => {
              setCode(next);
              setFailure(null);
            }}
            invalid={failure === 'invalid_code' || failure === 'expired_code'}
            editable={!blocked}
            autoFocus
          />

          <View style={styles.footer}>
            {countdown.canResend ? (
              <Button
                label={t('auth.resend')}
                variant="secondary"
                onPress={onResend}
                disabled={blocked}
              />
            ) : (
              <Text style={[type.label, numeric, styles.centered, { color: c.textFaint }]}>
                {t('auth.resendIn', { seconds: countdown.remaining })}
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function failureMessage(
  failure: AuthFailure | null,
  attemptsLeft: number,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  switch (failure) {
    case 'invalid_code':
      return t('auth.otpWrong', { attempts: attemptsLeft });
    case 'expired_code':
      return t('auth.otpExpired');
    case 'sms_rate_limit':
      return t('auth.smsLimit');
    case 'blocked':
      return t('auth.phoneBlocked');
    case 'offline':
      return t('error.network');
    case null:
      return null;
    default:
      return t('error.generic');
  }
}

/** Where each role's app starts. */
function homeFor(role: 'admin' | 'owner' | 'client') {
  switch (role) {
    case 'owner':
      return '/(owner)/queue' as const;
    case 'admin':
      return '/(admin)' as const;
    case 'client':
      return '/(client)/home' as const;
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
  footer: { marginTop: 'auto' },
  centered: { textAlign: 'center' },
});
