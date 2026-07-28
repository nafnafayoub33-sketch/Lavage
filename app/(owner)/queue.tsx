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
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { creditStateFor, type CreditState } from '@/core/usecases/ownerCredit';
import type { QueueRow } from '@/data/repositories/OwnerQueueRepository';
import type { ServiceRow } from '@/data/supabase/types';
import { useOwnerQueue } from '@/features/queue/useOwnerQueue';
import { useOffline } from '@/hooks/useOffline';
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
  const [sheetOpen, setSheetOpen] = useState(false);

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

        {/* Above the list, not below it: the owner reaches for this while
            somebody is standing in front of them, and the list can be long. */}
        {wash !== null && !board.isLoading && !board.isError ? (
          <Button
            label={t('owner.addWalkIn')}
            variant="secondary"
            size="owner"
            onPress={() => setSheetOpen(true)}
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
                onConfirm={() => board.confirm.mutate(row.bookingId)}
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

      <WalkInSheet
        visible={sheetOpen}
        services={board.services}
        pending={board.walkIn.isPending}
        offline={offline}
        onClose={() => setSheetOpen(false)}
        onAddService={() => {
          setSheetOpen(false);
          router.push('/(owner)/wash/services');
        }}
        onSubmit={(draft) => {
          board.walkIn.mutate(draft, {
            onSuccess: () => setSheetOpen(false),
            onError: (error) => {
              console.error('[O3] could not add the walk-in', error);
              Alert.alert(t('error.generic'), undefined, [{ text: t('common.close') }]);
            },
          });
        }}
      />
    </SafeAreaView>
  );
}

/**
 * The add-a-customer sheet.
 *
 * Two fields and nothing else. Someone is standing at the counter while this
 * is open, so it asks for the least that 0011 cannot derive: a label to call
 * out, and which service. The price comes from the price list, the ticket
 * from set_ticket_no, and arrival is stamped `arrived` by the insert guard.
 */
function WalkInSheet({
  visible,
  services,
  pending,
  offline,
  onClose,
  onAddService,
  onSubmit,
}: {
  visible: boolean;
  services: ServiceRow[];
  pending: boolean;
  offline: boolean;
  onClose: () => void;
  onAddService: () => void;
  onSubmit: (draft: { serviceId: string; label: string }) => void;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();

  const [label, setLabel] = useState('');
  const [serviceId, setServiceId] = useState<string | null>(null);

  // One service on the list is not a choice, it is the answer.
  const chosen = serviceId ?? (services.length === 1 ? services[0].id : null);
  const ready = label.trim() !== '' && chosen !== null;

  const close = () => {
    setLabel('');
    setServiceId(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
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
            <Text style={[type.title, { color: c.text }]}>{t('owner.addWalkIn')}</Text>

            {services.length === 0 ? (
              // Nothing to book them onto. Say why, and offer the way out.
              <>
                <EmptyState
                  message={t('owner.walkInNeedsService')}
                  actionLabel={t('wash.services')}
                  onAction={onAddService}
                />
                <Button
                  label={t('common.close')}
                  variant="ghost"
                  size="owner"
                  onPress={close}
                />
              </>
            ) : (
              <>
                <View style={styles.field}>
                  <Text style={[type.label, { color: c.textMuted }]}>
                    {t('owner.walkInLabel')}
                  </Text>
                  <TextInput
                    value={label}
                    onChangeText={setLabel}
                    placeholder={t('owner.walkInHint')}
                    placeholderTextColor={c.textFaint}
                    autoFocus
                    style={[
                      type.body,
                      styles.input,
                      { backgroundColor: c.surface, borderColor: c.line, color: c.text },
                    ]}
                  />
                </View>

                <Text style={[type.label, { color: c.textMuted }]}>
                  {t('owner.walkInPick')}
                </Text>
                <View style={styles.services}>
                  {services.map((service) => (
                    <ServiceChoice
                      key={service.id}
                      service={service}
                      selected={chosen === service.id}
                      onPress={() => setServiceId(service.id)}
                    />
                  ))}
                </View>

                <Button
                  label={t('owner.addWalkIn')}
                  size="owner"
                  disabled={!ready || offline}
                  loading={pending}
                  onPress={() => {
                    if (chosen === null) return;
                    onSubmit({ serviceId: chosen, label: label.trim() });
                    setLabel('');
                    setServiceId(null);
                  }}
                />
                <Button
                  label={t('common.cancel')}
                  variant="ghost"
                  size="owner"
                  onPress={close}
                />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ServiceChoice({
  service,
  selected,
  onPress,
}: {
  service: ServiceRow;
  selected: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.service,
        {
          backgroundColor: selected ? c.primary : c.surface,
          borderColor: selected ? c.primary : c.line,
        },
      ]}
    >
      <Text
        style={[type.label, { color: selected ? c.onPrimary : c.text }]}
        numberOfLines={1}
      >
        {service.name}
      </Text>
      <Text style={[type.caption, numeric, { color: selected ? c.onPrimary : c.textMuted }]}>
        {formatDH(service.price)}
      </Text>
    </Pressable>
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
  onConfirm,
}: {
  row: QueueRow;
  onStart: () => void;
  onFinish: () => void;
  onNoShow: () => void;
  onConfirm: () => void;
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
            {row.walkinLabel ?? row.vehicleLabel ?? row.clientFirstName ?? ''}
          </Text>
          {/* A walk-in has nobody to notify, so the owner needs to see at a
              glance which rows they are responsible for chasing. */}
          {row.walkinLabel !== null ? (
            <Text style={[type.caption, { color: c.textFaint }]}>
              {t('owner.walkInBadge')}
            </Text>
          ) : null}
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
          {/* Shown in full. Masking is deliberately off for now — maskPhone()
              is kept in src/lib/format.ts for the day an owner complains
              about late-night calls. See docs/SCREENS.md O4. */}
          {row.clientPhone !== null ? (
            <Text style={[type.caption, numeric, { color: c.textFaint }]}>
              {row.clientPhone}
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
          row.walkinLabel !== null ? (
            // Nobody else can confirm a walk-in; without this it would sit
            // until the two-hour cron swept it up.
            <Button label={t('owner.confirmWalkIn')} size="owner" onPress={onConfirm} />
          ) : (
            <Text style={[type.label, { color: c.textMuted }]}>{t('booking.confirmDone')}</Text>
          )
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

  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '85%',
    borderTopStartRadius: radii.xl,
    borderTopEndRadius: radii.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetContent: { padding: spacing.lg, rowGap: spacing.md },
  field: { rowGap: spacing.xs },
  input: {
    minHeight: hitSize.primary,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  services: { rowGap: spacing.sm },
  service: {
    minHeight: hitSize.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
