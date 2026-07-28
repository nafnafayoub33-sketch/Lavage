/**
 * app/(owner)/queue.tsx — O3 · Queue
 *
 * The most important screen in the app, and the one used with wet hands, so
 * every action here is a 52px target (hitSize.primary).
 *
 * Top: balance and top-up, open/closed badge.
 * List: number · service · vehicle · time, with Start / Done / No-show / Call.
 * Bottom: "Closed today".
 *
 * States: loading · error with retry · empty queue · data · credit low
 * (amber warning) · credit at zero (red — the wash is hidden from clients)
 * · offline.
 *
 * Live over the same queue_events channel C6 uses: a client booking
 * republishes the wash summary, and this board is another subscriber.
 */
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { creditStateFor, type CreditState } from '@/core/usecases/ownerCredit';
import type { QueueRow } from '@/data/repositories/OwnerQueueRepository';
import { useOwnerQueue } from '@/features/queue/useOwnerQueue';
import { useOffline } from '@/hooks/useOffline';
import { maskPhone } from '@/lib/format';
import { formatDH } from '@/lib/i18n';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { SkeletonList } from '@/ui/Skeleton';
import { hitSize, numeric, radii, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function OwnerQueueScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const offline = useOffline();
  const board = useOwnerQueue();

  const wash = board.wash;
  const credit: CreditState =
    wash === null
      ? 'ok'
      : creditStateFor({
          balanceCentimes: wash.credit_balance,
          freeWashesLeft: wash.free_washes_left,
        });

  // Credit at zero means the wash is already gone from search (0004). That is
  // not a banner, it is the screen.
  const blockedOut = credit === 'empty';

  const onToggleOpen = () => {
    if (wash === null) return;

    // Closing stops new bookings for everyone — confirm before doing it.
    if (wash.is_open_now) {
      Alert.alert(t('owner.closedToday'), t('owner.confirmClose'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => board.toggleOpen.mutate(false),
        },
      ]);
      return;
    }
    board.toggleOpen.mutate(true);
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: blockedOut ? c.bad : c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[type.title, { color: blockedOut ? c.onPrimary : c.text }]}>
            {t('owner.todayQueue')}
          </Text>
          {wash !== null ? (
            <OpenBadge isOpen={wash.is_open_now} onPress={onToggleOpen} />
          ) : null}
        </View>

        {offline ? <Banner message={t('error.offline')} tone="muted" /> : null}

        {wash !== null ? (
          <CreditCard
            state={credit}
            balanceCentimes={wash.credit_balance}
            freeWashesLeft={wash.free_washes_left}
            onTopUp={() => router.push('/(owner)/credit')}
          />
        ) : null}

        {board.isLoading ? (
          <SkeletonList rows={4} />
        ) : board.isError ? (
          <EmptyState
            message={t('error.generic')}
            actionLabel={t('common.retry')}
            onAction={board.refetch}
          />
        ) : wash === null ? (
          <EmptyState
            message={t('owner.noWashYet')}
            actionLabel={t('common.continue')}
            onAction={() => router.replace('/(owner)/register')}
          />
        ) : board.rows.length === 0 ? (
          <EmptyState message={t('owner.emptyQueue')} />
        ) : (
          <View style={styles.rows}>
            {board.rows.map((row) => (
              <Row
                key={row.bookingId}
                row={row}
                onStart={() => board.start.mutate(row.bookingId)}
                onFinish={() => board.finish.mutate(row.bookingId)}
                onNoShow={() =>
                  Alert.alert(t('owner.confirmNoShow'), undefined, [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('owner.noShow'),
                      style: 'destructive',
                      onPress: () => board.noShow.mutate(row.bookingId),
                    },
                  ])
                }
              />
            ))}
          </View>
        )}

        {wash !== null ? (
          <View style={styles.footer}>
            <Button
              label={wash.is_open_now ? t('owner.closedToday') : t('owner.reopen')}
              variant="secondary"
              size="owner"
              onPress={onToggleOpen}
              loading={board.toggleOpen.isPending}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function CreditCard({
  state,
  balanceCentimes,
  freeWashesLeft,
  onTopUp,
}: {
  state: CreditState;
  balanceCentimes: number;
  freeWashesLeft: number;
  onTopUp: () => void;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();

  const tone = state === 'empty' ? c.bad : state === 'low' ? c.warn : c.line;

  return (
    <View style={[styles.credit, { backgroundColor: c.surface, borderColor: tone }]}>
      <View style={styles.creditText}>
        <Text style={[type.label, { color: c.textMuted }]}>{t('owner.balance')}</Text>
        <Text style={[type.counter, numeric, { color: c.text }]}>
          {formatDH(balanceCentimes)}
        </Text>
        {freeWashesLeft > 0 ? (
          <Text style={[type.caption, numeric, { color: c.textMuted }]}>
            {t('owner.freeLeft', { count: freeWashesLeft })}
          </Text>
        ) : null}

        {state === 'low' ? (
          <Text style={[type.caption, { color: c.warn }]}>{t('owner.lowCredit')}</Text>
        ) : null}
        {state === 'empty' ? (
          <Text style={[type.caption, { color: c.bad }]}>{t('owner.noCredit')}</Text>
        ) : null}
      </View>

      <Button
        label={state === 'empty' ? t('owner.topupNow') : t('owner.topup')}
        size="owner"
        onPress={onTopUp}
      />
    </View>
  );
}

function OpenBadge({ isOpen, onPress }: { isOpen: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isOpen }}
      onPress={onPress}
      style={[
        styles.badge,
        { backgroundColor: isOpen ? c.ok : c.raised, borderColor: isOpen ? c.ok : c.line },
      ]}
    >
      <Text style={[type.label, { color: isOpen ? c.onPrimary : c.textMuted }]}>
        {isOpen ? t('queue.open') : t('queue.closed')}
      </Text>
    </Pressable>
  );
}

function Row({
  row,
  onStart,
  onFinish,
  onNoShow,
}: {
  row: QueueRow;
  onStart: () => void;
  onFinish: () => void;
  onNoShow: () => void;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();

  const call = () => {
    if (row.clientPhone === null || row.clientPhone === '') return;
    void Linking.openURL(`tel:${row.clientPhone}`).catch((error: unknown) =>
      console.error('[O3] could not open the dialler', error),
    );
  };

  return (
    <View style={[styles.row, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={styles.rowHead}>
        <Text style={[type.counter, numeric, { color: c.text }]}>{row.ticketNo}</Text>

        <View style={styles.rowText}>
          <Text style={[type.subtitle, { color: c.text }]} numberOfLines={1}>
            {row.serviceName}
          </Text>
          <Text style={[type.caption, { color: c.textMuted }]} numberOfLines={1}>
            {row.vehicleLabel ?? row.clientFirstName}
          </Text>
          {/* The client's own word (0008). Absent means they have not said,
              which is different from "not coming" and is left blank. */}
          {row.arrival !== null ? (
            <Text
              style={[
                type.caption,
                { color: row.arrival === 'arrived' ? c.ok : c.warn },
              ]}
            >
              {row.arrival === 'arrived' ? t('owner.arrived') : t('owner.onTheWay')}
            </Text>
          ) : null}
          {row.clientPhone !== null ? (
            <Text style={[type.caption, numeric, { color: c.textFaint }]}>
              {maskPhone(row.clientPhone)}
            </Text>
          ) : null}
        </View>

        <Text style={[type.caption, numeric, { color: c.textFaint }]}>
          {formatDH(row.price)}
        </Text>
      </View>

      <View style={styles.rowActions}>
        {row.status === 'pending' ? (
          <>
            <Button label={t('owner.start')} size="owner" onPress={onStart} />
            <Button
              label={t('owner.noShow')}
              variant="secondary"
              size="owner"
              onPress={onNoShow}
            />
          </>
        ) : null}

        {row.status === 'in_progress' ? (
          <Button label={t('owner.done')} size="owner" onPress={onFinish} />
        ) : null}

        {row.status === 'done' ? (
          <Text style={[type.label, { color: c.textMuted }]}>{t('booking.confirmDone')}</Text>
        ) : null}

        {row.clientPhone !== null && row.clientPhone !== '' ? (
          <Button label={t('common.call')} variant="ghost" size="owner" onPress={call} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    rowGap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.md,
  },
  badge: {
    minHeight: hitSize.min,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  credit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  creditText: { flex: 1, rowGap: spacing.xs },
  rows: { rowGap: spacing.sm },
  row: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    rowGap: spacing.md,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.lg,
  },
  rowText: { flex: 1, rowGap: spacing.xs },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
    rowGap: spacing.sm,
  },
  footer: { marginTop: 'auto', paddingTop: spacing.lg },
});
