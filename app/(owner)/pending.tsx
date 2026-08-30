/**
 * app/(owner)/pending.tsx — O2 · Pending approval
 *
 * Two very different screens behind one route, because the owner arrives at
 * both the same way — they opened the app and their wash is not live.
 *
 *   pending   "Your application is with the admin, we'll get back to you
 *             within 48 hours." Nothing to do but wait, or fix a detail.
 *   rejected  The reason D2 gave, verbatim, and the two things that answer
 *             it: edit the application, then submit it again.
 *
 * The reason is `car_washes.review_note` — written only by reject_wash and
 * read-only to the owner (0012). "Submit again" is resubmit_wash(), the only
 * route from rejected back to pending.
 *
 * States: loading · error with retry · no wash at all (bounces to O1) ·
 * pending · rejected · editing · saving · offline.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { firstIncompleteStep } from '@/core/usecases/washApplication';
import { useWashApplication } from '@/features/wash/useWashApplication';
import { WashApplicationForm } from '@/features/wash/WashApplicationForm';
import { useLocation } from '@/hooks/useLocation';
import { useOffline } from '@/hooks/useOffline';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { SkeletonList } from '@/ui/Skeleton';
import { radii, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** Where "Contact us" goes until there is a support screen (C13, phase 2). */
const SUPPORT_PHONE = '+212522000000';

export default function PendingScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const offline = useOffline();
  const location = useLocation();
  const application = useWashApplication();

  const [editing, setEditing] = useState(false);

  const wash = application.wash;
  const rejected = wash?.status === 'rejected';

  // Nothing filed yet, or already approved — neither belongs on this screen.
  useEffect(() => {
    if (application.isLoading || application.isError) return;
    if (wash === null) {
      router.replace('/(owner)/register');
      return;
    }
    if (wash.status === 'approved') router.replace('/(owner)/queue');
  }, [wash, application.isLoading, application.isError, router]);

  const onSave = () => {
    application.save.mutate(application.draft, {
      onSuccess: () => setEditing(false),
      onError: (error) => {
        console.error('[O2] saving the application failed', error);
        Alert.alert(t('error.generic'), undefined, [{ text: t('common.close') }]);
      },
    });
  };

  const onResubmit = () => {
    // It goes back into a queue a human works through. Confirm first.
    Alert.alert(t('owner.submitAgain'), t('owner.confirmResubmit'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('owner.submitAgain'),
        onPress: () =>
          application.resubmit.mutate(undefined, {
            onError: (error) => {
              console.error('[O2] resubmission failed', error);
              Alert.alert(t('error.generic'), undefined, [{ text: t('common.close') }]);
            },
          }),
      },
    ]);
  };

  const contact = () => {
    void Linking.openURL(`tel:${SUPPORT_PHONE}`).catch((error: unknown) =>
      console.error('[O2] could not open the dialler', error),
    );
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {offline ? <Banner message={t('error.offline')} tone="muted" /> : null}

        {application.isLoading ? (
          <SkeletonList rows={3} />
        ) : application.isError ? (
          <EmptyState
            message={t('error.generic')}
            actionLabel={t('common.retry')}
            onAction={application.refetch}
          />
        ) : wash === null ? (
          // The redirect above is already on its way; this is the frame it
          // takes to get there, and a blank screen would look like a crash.
          <SkeletonList rows={3} />
        ) : editing ? (
          <>
            <Text style={[type.title, { color: c.text }]}>{t('owner.editApplication')}</Text>

            <WashApplicationForm
              draft={application.draft}
              onChange={application.setDraft}
              fallbackCentre={
                location.state.status === 'ready' ? location.state.coords : null
              }
              // Someone editing after a rejection is answering one specific
              // objection. Dropping them on step one to fix a photo is rude.
              initialStep={firstIncompleteStep(application.draft)}
              submitLabel={t('owner.saveChanges')}
              submitting={application.save.isPending}
              submitDisabled={offline}
              onSubmit={onSave}
            />

            <Button
              label={t('common.cancel')}
              variant="ghost"
              size="owner"
              onPress={() => setEditing(false)}
            />
          </>
        ) : (
          <>
            <Text style={[type.title, { color: rejected ? c.bad : c.text }]}>
              {rejected ? t('owner.rejectedTitle') : t('owner.pendingTitle')}
            </Text>

            {rejected ? (
              <View style={[styles.reason, { backgroundColor: c.surface, borderColor: c.bad }]}>
                <Text style={[type.label, { color: c.textMuted }]}>
                  {t('owner.rejectedWhy')}
                </Text>
                {/* Verbatim. It is the only thing telling the owner what to
                    fix, and paraphrasing would lose the specifics. */}
                <Text style={[type.body, { color: c.text }]}>{wash.review_note ?? ''}</Text>
              </View>
            ) : (
              <Text style={[type.body, { color: c.textMuted }]}>{t('owner.pendingBody')}</Text>
            )}

            <View style={[styles.summary, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Text style={[type.subtitle, { color: c.text }]}>{wash.name}</Text>
              <Text style={[type.caption, { color: c.textMuted }]}>{wash.address}</Text>
              <Text style={[type.caption, { color: c.textMuted }]}>{wash.city}</Text>
            </View>

            <View style={styles.actions}>
              {/* One primary button. While pending, waiting is the correct
                  action and editing is what gets the emphasis; after a
                  rejection, resubmitting is. */}
              {rejected ? (
                <Button
                  label={t('owner.submitAgain')}
                  size="owner"
                  disabled={offline}
                  loading={application.resubmit.isPending}
                  onPress={onResubmit}
                />
              ) : null}

              <Button
                label={t('owner.editApplication')}
                variant={rejected ? 'secondary' : 'primary'}
                size="owner"
                onPress={() => setEditing(true)}
              />

              <Button
                label={t('owner.contactSupport')}
                variant="ghost"
                size="owner"
                onPress={contact}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, rowGap: spacing.md },
  reason: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    rowGap: spacing.xs,
  },
  summary: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    rowGap: spacing.xs,
  },
  actions: { marginTop: 'auto', paddingTop: spacing.lg, rowGap: spacing.sm },
});
