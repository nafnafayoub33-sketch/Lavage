/**
 * app/(owner)/credit.tsx — O7 · Credit
 *
 * Balance and free washes on top, a top-up form, and the transaction list.
 *
 * The screen never names a payment provider. It asks the gateway from
 * src/core/payments for its presets and whether money lands immediately, and
 * shows the bank panel only when a human has to check the transfer. Swapping
 * the manual transfer for a card provider is a one-line change in
 * useCredit.ts and nothing here.
 *
 * States: loading · error with retry · no wash yet · empty ledger ·
 * data · a request already pending · a request that was declined · offline.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isValidTopUpAmount, MIN_TOPUP_CENTIMES } from '@/core/payments/PaymentGateway';
import { creditStateFor } from '@/core/usecases/ownerCredit';
import type { CreditTransaction } from '@/data/repositories/CreditRepository';
import { useCredit } from '@/features/credit/useCredit';
import { useOffline } from '@/hooks/useOffline';
import { formatDH } from '@/lib/i18n';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { SkeletonList } from '@/ui/Skeleton';
import { hitSize, numeric, radii, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function CreditScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const offline = useOffline();
  const credit = useCredit();

  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [reference, setReference] = useState('');

  const wash = credit.wash;
  const chosen = amount ?? centimesFromDirhams(custom);
  const amountOk = chosen !== null && isValidTopUpAmount(chosen);
  const referenceOk = credit.gateway.settlesImmediately || reference.trim() !== '';

  const state =
    wash === null
      ? 'ok'
      : creditStateFor({
          balanceCentimes: wash.credit_balance,
          freeWashesLeft: wash.free_washes_left,
        });

  const onSubmit = () => {
    if (chosen === null || !amountOk || !referenceOk) return;

    credit.submit.mutate(
      { amountCentimes: chosen, reference: reference.trim() },
      {
        onSuccess: (outcome) => {
          if (outcome.kind === 'failed') {
            Alert.alert(t('error.generic'), undefined, [{ text: t('common.close') }]);
            return;
          }
          setAmount(null);
          setCustom('');
          setReference('');
        },
        onError: (error) => {
          console.error('[O7] top-up request failed', error);
          Alert.alert(t('error.generic'), undefined, [{ text: t('common.close') }]);
        },
      },
    );
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[type.title, { color: c.text }]}>{t('owner.balance')}</Text>

        {offline ? <Banner message={t('error.offline')} tone="muted" /> : null}

        {credit.isLoading ? (
          <SkeletonList rows={4} />
        ) : credit.isError ? (
          <EmptyState
            message={t('error.generic')}
            actionLabel={t('common.retry')}
            onAction={credit.refetch}
          />
        ) : wash === null ? (
          <EmptyState message={t('owner.noWashYet')} />
        ) : (
          <>
            <View style={[styles.balance, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Text style={[type.ticket, numeric, { color: c.text }]}>
                {formatDH(wash.credit_balance)}
              </Text>
              {wash.free_washes_left > 0 ? (
                <Text style={[type.label, numeric, { color: c.textMuted }]}>
                  {t('owner.freeLeft', { count: wash.free_washes_left })}
                </Text>
              ) : null}
              {state === 'low' ? (
                <Text style={[type.caption, { color: c.warn }]}>{t('owner.lowCredit')}</Text>
              ) : null}
              {state === 'empty' ? (
                <Text style={[type.caption, { color: c.bad }]}>{t('owner.noCredit')}</Text>
              ) : null}
            </View>

            {credit.pendingRequest !== null ? (
              <Banner tone="warn" message={t('owner.topupPending')} />
            ) : null}

            {credit.pendingRequest === null && credit.lastRejected !== null ? (
              <Banner
                message={t('owner.topupRejected', {
                  reason: credit.lastRejected.adminNote ?? '',
                })}
              />
            ) : null}

            {/* One outstanding request at a time: a second would be a second
                transfer to reconcile against the same balance. */}
            {credit.pendingRequest === null ? (
              <View style={styles.form}>
                <Text style={[type.subtitle, { color: c.text }]}>{t('owner.topupAmount')}</Text>

                <View style={styles.presets}>
                  {credit.gateway.presetAmounts.map((preset) => (
                    <Preset
                      key={preset}
                      label={formatDH(preset)}
                      selected={amount === preset}
                      onPress={() => {
                        setAmount(preset);
                        setCustom('');
                      }}
                    />
                  ))}
                </View>

                <Field
                  value={custom}
                  onChange={(next) => {
                    setCustom(next.replace(/\D/g, ''));
                    setAmount(null);
                  }}
                  placeholder={t('owner.topupCustom')}
                  keyboardType="number-pad"
                />

                {chosen !== null && !amountOk ? (
                  <Text style={[type.caption, { color: c.bad }]}>
                    {t('owner.amountTooSmall', { amount: formatDH(MIN_TOPUP_CENTIMES) })}
                  </Text>
                ) : null}

                {/* Only a gateway that needs a human needs a bank panel. */}
                {!credit.gateway.settlesImmediately ? (
                  <>
                    <BankPanel bank={credit.bank} />
                    <Field
                      value={reference}
                      onChange={setReference}
                      placeholder={t('owner.referencePlaceholder')}
                      label={t('owner.reference')}
                    />
                  </>
                ) : null}

                <Button
                  label={t('owner.submitTopup')}
                  size="owner"
                  disabled={!amountOk || !referenceOk || offline}
                  loading={credit.submit.isPending}
                  onPress={onSubmit}
                />
              </View>
            ) : null}

            <Text style={[type.subtitle, { color: c.text }]}>{t('owner.transactions')}</Text>

            {credit.transactions.length === 0 ? (
              <EmptyState message={t('owner.noTransactions')} />
            ) : (
              <View style={styles.ledger}>
                {credit.transactions.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function BankPanel({ bank }: { bank: { bank: string; accountHolder: string; rib: string; note: string } | null }) {
  const { t } = useTranslation();
  const { c } = useTheme();

  // The admin fills these in through D9. Until then, say so rather than
  // showing an empty card that looks broken.
  if (bank === null || bank.rib.trim() === '') {
    return <Banner message={t('owner.bankMissing')} tone="warn" />;
  }

  return (
    <View style={[styles.bank, { backgroundColor: c.raised, borderColor: c.line }]}>
      <Text style={[type.label, { color: c.textMuted }]}>{t('owner.bankDetails')}</Text>
      <Text style={[type.subtitle, { color: c.text }]}>{bank.bank}</Text>
      <Text style={[type.body, { color: c.text }]}>{bank.accountHolder}</Text>
      {/* A RIB is a number: Latin and LTR in every language. */}
      <Text style={[type.body, numeric, { color: c.text }]}>{bank.rib}</Text>
      {bank.note !== '' ? (
        <Text style={[type.caption, { color: c.textMuted }]}>{bank.note}</Text>
      ) : null}
    </View>
  );
}

function TransactionRow({ tx }: { tx: CreditTransaction }) {
  const { t } = useTranslation();
  const { c } = useTheme();

  const positive = tx.amountCentimes > 0;
  const label = {
    topup: t('owner.txTopup'),
    charge: t('owner.txCharge'),
    refund: t('owner.txRefund'),
    bonus: t('owner.txBonus'),
  }[tx.type];

  return (
    <View style={[styles.tx, { borderColor: c.line }]}>
      <View style={styles.txText}>
        <Text style={[type.label, { color: c.text }]}>{label}</Text>
        {tx.note !== null ? (
          <Text style={[type.caption, { color: c.textMuted }]} numberOfLines={1}>
            {tx.note}
          </Text>
        ) : null}
      </View>

      <View style={styles.txAmounts}>
        <Text style={[type.label, numeric, { color: positive ? c.ok : c.text }]}>
          {formatDH(tx.amountCentimes)}
        </Text>
        <Text style={[type.caption, numeric, { color: c.textFaint }]}>
          {formatDH(tx.balanceAfterCentimes)}
        </Text>
      </View>
    </View>
  );
}

function Preset({
  label,
  selected,
  onPress,
}: {
  label: string;
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
        styles.preset,
        {
          backgroundColor: selected ? c.primary : c.surface,
          borderColor: selected ? c.primary : c.line,
        },
      ]}
    >
      <Text style={[type.label, numeric, { color: selected ? c.onPrimary : c.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Field({
  value,
  onChange,
  placeholder,
  label,
  keyboardType,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  label?: string;
  keyboardType?: 'number-pad';
}) {
  const { c } = useTheme();

  return (
    <View style={styles.field}>
      {label !== undefined ? (
        <Text style={[type.label, { color: c.textMuted }]}>{label}</Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textFaint}
        keyboardType={keyboardType}
        style={[
          type.body,
          styles.input,
          { backgroundColor: c.surface, borderColor: c.line, color: c.text },
        ]}
      />
    </View>
  );
}

/** The owner types dirhams; everything below the UI is centimes. */
function centimesFromDirhams(input: string): number | null {
  if (input.trim() === '') return null;
  const dirhams = Number.parseInt(input, 10);
  if (Number.isNaN(dirhams)) return null;
  return dirhams * 100;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, rowGap: spacing.md },
  balance: {
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    rowGap: spacing.xs,
  },
  form: { rowGap: spacing.md },
  presets: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.sm, rowGap: spacing.sm },
  preset: {
    minHeight: hitSize.primary,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bank: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    rowGap: spacing.xs,
  },
  field: { rowGap: spacing.xs },
  input: {
    minHeight: hitSize.primary,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ledger: { rowGap: 0 },
  tx: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txText: { flex: 1, rowGap: spacing.xs },
  txAmounts: { alignItems: 'flex-end' },
});
