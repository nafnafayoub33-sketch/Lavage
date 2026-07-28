/**
 * app/(owner)/register.tsx — O1 · Register the car wash
 *
 * The owner arrives from A7 with a profile row already created, so this
 * screen is only ever about the car wash, never about the person.
 *
 * The form itself is src/features/wash/WashApplicationForm — O2 renders the
 * same four steps when the owner edits an application that is already filed.
 * This route decides what submitting means and where it goes afterwards.
 *
 * Documents (ID and business registration) are in the spec and deliberately
 * not here; see docs/SCREENS.md O1.
 *
 * States: loading · error with retry · already registered (bounces to O2 or
 * the board) · per-step problems · submitting · offline.
 */
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useWashApplication } from '@/features/wash/useWashApplication';
import { WashApplicationForm } from '@/features/wash/WashApplicationForm';
import { useLocation } from '@/hooks/useLocation';
import { useOffline } from '@/hooks/useOffline';
import { Banner } from '@/ui/Banner';
import { EmptyState } from '@/ui/EmptyState';
import { SkeletonList } from '@/ui/Skeleton';
import { spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function RegisterWashScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const offline = useOffline();
  const location = useLocation();
  const application = useWashApplication();

  const wash = application.wash;

  // An owner who already applied does not belong here. They arrive by deep
  // link or a stale back stack, and the form would file a second application
  // that 0014 refuses anyway.
  useEffect(() => {
    if (wash === null) return;
    router.replace(wash.status === 'approved' ? '/(owner)/queue' : '/(owner)/pending');
  }, [wash, router]);

  const onSubmit = () => {
    application.submit.mutate(application.draft, {
      onSuccess: () => router.replace('/(owner)/pending'),
      onError: (error) => {
        console.error('[O1] registration failed', error);
        Alert.alert(t('error.generic'), undefined, [{ text: t('common.close') }]);
      },
    });
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[type.title, { color: c.text }]}>{t('owner.registerTitle')}</Text>

        {offline ? <Banner message={t('error.offline')} tone="muted" /> : null}

        {application.isLoading ? (
          <SkeletonList rows={4} />
        ) : application.isError ? (
          <EmptyState
            message={t('error.generic')}
            actionLabel={t('common.retry')}
            onAction={application.refetch}
          />
        ) : (
          <WashApplicationForm
            draft={application.draft}
            onChange={application.setDraft}
            fallbackCentre={
              location.state.status === 'ready' ? location.state.coords : null
            }
            submitLabel={t('owner.submitApplication')}
            submitting={application.submit.isPending}
            submitDisabled={offline}
            onSubmit={onSubmit}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, rowGap: spacing.md },
});
