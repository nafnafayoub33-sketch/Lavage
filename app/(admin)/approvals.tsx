/**
 * app/(admin)/approvals.tsx — D2 · Approvals
 *
 * The bottleneck of the whole product. Since 0010 nothing an owner can do
 * makes a car wash appear in C1 — the only route from "registered" to
 * "visible" runs through this screen.
 *
 * Each application shows what the decision actually turns on: the photos, the
 * address and pin, the hours and bays, whether there is a price list at all,
 * and who to phone. Approve is one tap behind a confirmation; reject asks for
 * a reason, because the reason is the entire content of O2.
 *
 * States: loading skeleton · error with retry · empty (nothing waiting) ·
 * data · offline.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PendingWash } from '@/data/repositories/AdminRepository';
import { useApprovals } from '@/features/admin/useApprovals';
import { useOffline } from '@/hooks/useOffline';
import { formatDate } from '@/lib/i18n';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { SkeletonList } from '@/ui/Skeleton';
import { hitSize, numeric, radii, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function ApprovalsScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const offline = useOffline();
  const approvals = useApprovals();

  // Which application the reject sheet is open for; null means closed.
  const [rejecting, setRejecting] = useState<PendingWash | null>(null);

  const onApprove = (wash: PendingWash) => {
    // Approving puts a business in front of clients. Confirm first.
    Alert.alert(wash.name, t('admin.confirmApprove'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.approve'),
        onPress: () =>
          approvals.approve.mutate(wash.id, {
            onError: (error) => {
              console.error('[D2] approve failed', error);
              Alert.alert(t('error.generic'), undefined, [{ text: t('common.close') }]);
            },
          }),
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[type.title, { color: c.text }]}>{t('admin.approvals')}</Text>
          {approvals.washes.length > 0 ? (
            <Text style={[type.label, numeric, { color: c.textMuted }]}>
              {t('admin.waiting', { count: approvals.washes.length })}
            </Text>
          ) : null}
        </View>

        {offline ? <Banner message={t('error.offline')} tone="muted" /> : null}

        {approvals.isLoading ? (
          <SkeletonList rows={3} />
        ) : approvals.isError ? (
          <EmptyState
            message={t('error.generic')}
            actionLabel={t('common.retry')}
            onAction={approvals.refetch}
          />
        ) : approvals.washes.length === 0 ? (
          <EmptyState message={t('admin.noPending')} />
        ) : (
          <View style={styles.list}>
            {approvals.washes.map((wash) => (
              <ApplicationCard
                key={wash.id}
                wash={wash}
                busy={approvals.approve.isPending || approvals.reject.isPending}
                offline={offline}
                onApprove={() => onApprove(wash)}
                onReject={() => setRejecting(wash)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <RejectSheet
        wash={rejecting}
        pending={approvals.reject.isPending}
        offline={offline}
        onClose={() => setRejecting(null)}
        onSubmit={(reason) => {
          if (rejecting === null) return;
          approvals.reject.mutate(
            { washId: rejecting.id, reason },
            {
              onSuccess: () => setRejecting(null),
              onError: (error) => {
                console.error('[D2] reject failed', error);
                Alert.alert(t('error.generic'), undefined, [{ text: t('common.close') }]);
              },
            },
          );
        }}
      />
    </SafeAreaView>
  );
}

function ApplicationCard({
  wash,
  busy,
  offline,
  onApprove,
  onReject,
}: {
  wash: PendingWash;
  busy: boolean;
  offline: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();

  const call = (phone: string | null) => {
    if (phone === null || phone === '') return;
    void Linking.openURL(`tel:${phone}`).catch((error: unknown) =>
      console.error('[D2] could not open the dialler', error),
    );
  };

  const openMap = () => {
    // geo: is handled by every Android map app and by iOS through the
    // universal link, so the admin is not forced onto one vendor.
    const url = `geo:${wash.latitude},${wash.longitude}?q=${wash.latitude},${wash.longitude}`;
    void Linking.openURL(url).catch((error: unknown) =>
      console.error('[D2] could not open the map', error),
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={styles.cardHead}>
        <View style={styles.cardTitle}>
          <Text style={[type.subtitle, { color: c.text }]}>{wash.name}</Text>
          <Text style={[type.caption, { color: c.textMuted }]}>
            {wash.address}
          </Text>
          <Text style={[type.caption, { color: c.textMuted }]}>{wash.city}</Text>
        </View>
        <Text style={[type.caption, numeric, { color: c.textFaint }]}>
          {t('admin.appliedOn', { date: formatDate(wash.createdAt) })}
        </Text>
      </View>

      {wash.photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.photos}>
            {wash.photos.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                style={[styles.photo, { backgroundColor: c.raised }]}
                resizeMode="cover"
              />
            ))}
          </View>
        </ScrollView>
      ) : null}

      <View style={styles.facts}>
        <Text style={[type.caption, numeric, { color: c.textMuted }]}>
          {t('admin.bays', { count: wash.baysCount })}
        </Text>
        <Text style={[type.caption, numeric, { color: c.textMuted }]}>
          {t('admin.hours', { from: wash.opensAt, to: wash.closesAt })}
        </Text>
        <Text style={[type.caption, numeric, { color: c.textMuted }]}>
          {t('admin.serviceCount', { count: wash.serviceCount })}
        </Text>
      </View>

      {/* An approved wash with no price list is a wash nobody can book — it
          would sit in C1 collecting taps and going nowhere. */}
      {wash.serviceCount === 0 ? (
        <Banner message={t('admin.noServices')} tone="warn" />
      ) : null}

      <View style={[styles.owner, { borderColor: c.line }]}>
        <Text style={[type.label, { color: c.textMuted }]}>{t('admin.owner')}</Text>
        <Text style={[type.body, { color: c.text }]}>{wash.ownerName}</Text>
        {wash.ownerPhone !== null ? (
          <Text style={[type.caption, numeric, { color: c.textFaint }]}>
            {wash.ownerPhone}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button
          label={t('admin.approve')}
          disabled={busy || offline}
          onPress={onApprove}
        />
        <Button
          label={t('admin.reject')}
          variant="secondary"
          disabled={busy || offline}
          onPress={onReject}
        />
        <Button label={t('common.directions')} variant="ghost" onPress={openMap} />
        {wash.ownerPhone !== null && wash.ownerPhone !== '' ? (
          <Button
            label={t('common.call')}
            variant="ghost"
            onPress={() => call(wash.ownerPhone)}
          />
        ) : null}
      </View>
    </View>
  );
}

/**
 * Rejection needs a reason. 0012 refuses a blank one, so this is not the
 * only guard — but the owner reading O2 needs a sentence they can act on,
 * and that is a decision made here, not in the database.
 */
function RejectSheet({
  wash,
  pending,
  offline,
  onClose,
  onSubmit,
}: {
  wash: PendingWash | null;
  pending: boolean;
  offline: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();

  const [reason, setReason] = useState('');
  const ready = reason.trim() !== '';

  const close = () => {
    setReason('');
    onClose();
  };

  return (
    <Modal
      visible={wash !== null}
      animationType="slide"
      transparent
      onRequestClose={close}
      accessibilityViewIsModal
    >
      <View style={[styles.backdrop, { backgroundColor: c.scrim }]}>
        <View style={[styles.sheet, { backgroundColor: c.bg, borderColor: c.line }]}>
          <ScrollView
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[type.title, { color: c.text }]}>{t('admin.rejectTitle')}</Text>
            {wash !== null ? (
              <Text style={[type.caption, { color: c.textMuted }]}>{wash.name}</Text>
            ) : null}

            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder={t('admin.rejectHint')}
              placeholderTextColor={c.textFaint}
              multiline
              autoFocus
              style={[
                type.body,
                styles.reason,
                { backgroundColor: c.surface, borderColor: c.line, color: c.text },
              ]}
            />

            {!ready ? (
              <Text style={[type.caption, { color: c.textMuted }]}>
                {t('admin.reasonRequired')}
              </Text>
            ) : null}

            <Button
              label={t('admin.rejectSend')}
              disabled={!ready || offline}
              loading={pending}
              onPress={() => {
                onSubmit(reason.trim());
                setReason('');
              }}
            />
            <Button label={t('common.cancel')} variant="ghost" onPress={close} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, rowGap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.md,
  },
  list: { rowGap: spacing.md },
  card: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    rowGap: spacing.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: spacing.md,
  },
  cardTitle: { flex: 1, rowGap: spacing.xs },
  photos: { flexDirection: 'row', columnGap: spacing.sm },
  photo: { width: 140, height: 96, borderRadius: radii.md },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.xs },
  owner: {
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    rowGap: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
    rowGap: spacing.sm,
  },

  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '85%',
    borderTopStartRadius: radii.xl,
    borderTopEndRadius: radii.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetContent: { padding: spacing.lg, rowGap: spacing.md },
  reason: {
    minHeight: hitSize.primary * 2,
    textAlignVertical: 'top',
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
