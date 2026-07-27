/**
 * app/(client)/turn.tsx — C6 · My turn
 *
 * Your number, large · progress track · cars ahead · now washing · the
 * details · directions · call · cancel.
 *
 * States:
 *   no booking        "You don't have a turn right now" + browse car washes
 *   waiting           number, track, "2 cars ahead of you", now washing 09
 *   you're up         the screen turns amber
 *   wash started      "Your car is being washed"
 *   finished          straight to C8, no interstitial
 *   owner cancelled   the reason, plus find another car wash
 *   loading / error   skeleton, then a retry
 *
 * Which of those applies is decided by src/core/usecases/turnState.ts.
 */
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isUrgent } from '@/core/usecases/turnState';
import { cancelBooking } from '@/data/repositories/BookingRepository';
import { useCurrentTurn } from '@/features/booking/useCurrentTurn';
import { useOffline } from '@/hooks/useOffline';
import { formatWait } from '@/lib/format';
import { formatDH } from '@/lib/i18n';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { SkeletonList } from '@/ui/Skeleton';
import { numeric, radii, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function MyTurnScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const offline = useOffline();
  const turn = useCurrentTurn();

  const [cancelling, setCancelling] = useState(false);

  // The wash is done: C8 confirms and rates. Nothing to look at here first.
  if (turn.state.kind === 'finished' && turn.booking !== null) {
    return <Redirect href={`/(client)/booking/${turn.booking.id}/confirm`} />;
  }

  const urgent = isUrgent(turn.state);

  const performCancel = async () => {
    if (turn.booking === null) return;
    setCancelling(true);

    try {
      const result = await cancelBooking(turn.booking.id);
      if (!result.ok) {
        Alert.alert(t('error.generic'), undefined, [{ text: t('common.close') }]);
        return;
      }
      turn.refetch();
    } catch (error) {
      console.error('[C6] could not cancel the booking', error);
      Alert.alert(t('error.generic'), undefined, [{ text: t('common.close') }]);
    } finally {
      setCancelling(false);
    }
  };

  // Destructive, so it confirms first.
  const onCancel = () => {
    if (turn.booking === null) return;

    Alert.alert(t('booking.cancelTitle'), t('booking.cancelWarn'), [
      { text: t('common.later'), style: 'cancel' },
      { text: t('common.confirm'), style: 'destructive', onPress: () => void performCancel() },
    ]);
  };

  const call = () => {
    const phone = turn.booking?.washPhone;
    if (phone === null || phone === undefined || phone === '') return;

    void Linking.openURL(`tel:${phone}`).catch((error: unknown) =>
      console.error('[C6] could not open the dialler', error),
    );
  };

  const directions = () => {
    const address = turn.booking?.washAddress;
    if (address === undefined || address === '') return;

    // Apple Maps on iOS, whatever handles geo: on Android.
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?q=${encodeURIComponent(address)}`
        : `geo:0,0?q=${encodeURIComponent(address)}`;

    void Linking.openURL(url).catch((error: unknown) =>
      console.error('[C6] could not open maps', error),
    );
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: urgent ? c.warn : c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {offline ? <Banner message={t('error.offline')} tone="muted" /> : null}

        {turn.isLoading ? (
          <SkeletonList rows={3} />
        ) : turn.isError ? (
          <EmptyState
            message={t('error.generic')}
            actionLabel={t('common.retry')}
            onAction={turn.refetch}
          />
        ) : (
          <Content
            turn={turn}
            urgent={urgent}
            cancelling={cancelling}
            onCancel={onCancel}
            onCall={call}
            onDirections={directions}
            onBrowse={() => router.replace('/(client)/home')}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Content({
  turn,
  urgent,
  cancelling,
  onCancel,
  onCall,
  onDirections,
  onBrowse,
}: {
  turn: ReturnType<typeof useCurrentTurn>;
  urgent: boolean;
  cancelling: boolean;
  onCancel: () => void;
  onCall: () => void;
  onDirections: () => void;
  onBrowse: () => void;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();

  const { state, booking } = turn;

  // On the amber screen the text sits on amber, not on the page colour.
  const ink = urgent ? c.onPrimary : c.text;
  const inkMuted = urgent ? c.onPrimary : c.textMuted;

  if (state.kind === 'none' || booking === null) {
    return (
      <EmptyState message={t('queue.noBooking')} actionLabel={t('queue.near')} onAction={onBrowse} />
    );
  }

  if (state.kind === 'cancelledByOwner') {
    return (
      <View style={styles.block}>
        <Text style={[type.title, { color: c.text }]}>{t('queue.cancelledByOwner')}</Text>
        {state.reason !== null ? (
          <Text style={[type.body, { color: c.textMuted }]}>
            {t(`owner.reasons.${state.reason}`, { defaultValue: state.reason })}
          </Text>
        ) : null}
        <Button label={t('queue.findAnother')} onPress={onBrowse} />
      </View>
    );
  }

  const wait = state.kind === 'waiting' ? formatWait(state.waitMinutes) : null;
  const nowServing = state.kind === 'waiting' || state.kind === 'next' ? state.nowServing : null;

  return (
    <View style={styles.block}>
      <View style={styles.ticket}>
        <Text style={[type.label, { color: inkMuted }]}>{t('queue.yourNumber')}</Text>
        <Text style={[type.ticket, numeric, { color: ink }]}>{booking.ticketNo}</Text>
      </View>

      {state.kind === 'next' ? (
        <Text style={[type.title, styles.centred, { color: ink }]}>{t('queue.youAreUp')}</Text>
      ) : null}

      {state.kind === 'washing' ? (
        <Text style={[type.title, styles.centred, { color: ink }]}>{t('queue.washing')}</Text>
      ) : null}

      {state.kind === 'waiting' ? (
        <>
          <Track carsAhead={state.carsAhead} urgent={urgent} />
          <Text style={[type.subtitle, styles.centred, { color: ink }]}>
            {t('queue.ahead', { count: state.carsAhead })}
          </Text>
          {wait !== null ? (
            <Text style={[type.body, numeric, styles.centred, { color: inkMuted }]}>
              {t(wait.key, wait.params)}
            </Text>
          ) : null}
          <Text style={[type.caption, styles.centred, { color: inkMuted }]}>
            {t('queue.etaSub')}
          </Text>
        </>
      ) : null}

      {nowServing !== null ? (
        <Text style={[type.label, numeric, styles.centred, { color: inkMuted }]}>
          {t('queue.nowServing', { number: nowServing })}
        </Text>
      ) : null}

      <View style={[styles.details, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Detail label={t('queue.queueNow')} value={booking.washName} />
        <Detail label={t('booking.service')} value={booking.serviceName} />
        <Detail label={t('booking.price')} value={formatDH(booking.price)} isNumeric />
      </View>

      <View style={styles.actions}>
        <Button label={t('common.directions')} variant="secondary" onPress={onDirections} />
        {booking.washPhone !== null && booking.washPhone !== '' ? (
          <Button label={t('common.call')} variant="secondary" onPress={onCall} />
        ) : null}
        <Button
          label={t('booking.cancelTitle')}
          variant="ghost"
          onPress={onCancel}
          loading={cancelling}
        />
      </View>
    </View>
  );
}

/**
 * The progress track. The motion budget allows `advance` only when the
 * position really changes, so this is a bar that redraws on a new count
 * rather than something that animates on every render.
 */
function Track({ carsAhead, urgent }: { carsAhead: number; urgent: boolean }) {
  const { c } = useTheme();
  const segments = Math.min(Math.max(carsAhead + 1, 1), 8);

  return (
    <View style={styles.track}>
      {Array.from({ length: segments }, (_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            {
              backgroundColor: urgent ? c.onPrimary : i === 0 ? c.text : c.line,
              opacity: i === 0 ? 1 : 0.35,
            },
          ]}
        />
      ))}
    </View>
  );
}

function Detail({
  label,
  value,
  isNumeric = false,
}: {
  label: string;
  value: string;
  isNumeric?: boolean;
}) {
  const { c } = useTheme();

  return (
    <View style={styles.detailRow}>
      <Text style={[type.label, { color: c.textMuted }]}>{label}</Text>
      <Text style={[type.label, isNumeric ? numeric : null, { color: c.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    rowGap: spacing.lg,
  },
  block: { rowGap: spacing.lg },
  ticket: { alignItems: 'center', rowGap: spacing.xs },
  centred: { textAlign: 'center' },
  track: {
    flexDirection: 'row',
    columnGap: spacing.xs,
    justifyContent: 'center',
  },
  segment: {
    flex: 1,
    height: spacing.sm,
    borderRadius: radii.pill,
  },
  details: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    rowGap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: spacing.lg,
  },
  actions: { rowGap: spacing.sm },
});
