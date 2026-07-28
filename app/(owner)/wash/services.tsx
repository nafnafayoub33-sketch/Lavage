/**
 * app/(owner)/wash/services.tsx — O6 · Services and prices
 *
 * The price list: add, edit, activate, delete.
 *
 * Duration is not decoration — queue_state() averages it to produce the wait
 * time C1 shows and C6 counts down. An implausible value is warned about
 * rather than blocked: an owner with a genuine five-minute rinse should not
 * be argued with, but a three-minute full valet would quietly wreck every
 * estimate in the app.
 *
 * States: loading · error with retry · empty (and what that costs them) ·
 * data · saving · offline.
 */
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parseServiceDraft } from '@/core/usecases/serviceDraft';
import { useServices } from '@/features/wash/useServices';
import { useOffline } from '@/hooks/useOffline';
import { formatDH } from '@/lib/i18n';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { SkeletonList } from '@/ui/Skeleton';
import { hitSize, numeric, radii, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function ServicesScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const offline = useOffline();
  const { editing } = useLocalSearchParams<{ editing?: string }>();

  const services = useServices();
  const [openId, setOpenId] = useState<string | null>(editing ?? null);
  const [adding, setAdding] = useState(false);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[type.title, { color: c.text }]}>{t('owner.servicesTitle')}</Text>

        {offline ? <Banner message={t('error.offline')} tone="muted" /> : null}

        {services.isLoading ? (
          <SkeletonList rows={3} />
        ) : services.isError ? (
          <EmptyState
            message={t('error.generic')}
            actionLabel={t('common.retry')}
            onAction={services.refetch}
          />
        ) : (
          <>
            {services.rows.length === 0 && !adding ? (
              <EmptyState
                message={t('owner.noServices')}
                actionLabel={t('owner.addService')}
                onAction={() => setAdding(true)}
              />
            ) : null}

            {services.rows.map((service) =>
              openId === service.id ? (
                <ServiceForm
                  key={service.id}
                  initial={{
                    name: service.name,
                    priceDirhams: String(Math.round(service.price / 100)),
                    durationMin: String(service.duration_min),
                    isActive: service.is_active,
                  }}
                  saving={services.save.isPending}
                  onCancel={() => setOpenId(null)}
                  onSave={(draft) =>
                    services.save.mutate(
                      { draft, serviceId: service.id },
                      { onSuccess: () => setOpenId(null) },
                    )
                  }
                  onDelete={() =>
                    Alert.alert(t('owner.deleteService'), service.name, [
                      { text: t('common.cancel'), style: 'cancel' },
                      {
                        text: t('common.delete'),
                        style: 'destructive',
                        onPress: () =>
                          services.remove.mutate(service.id, {
                            onSuccess: () => setOpenId(null),
                          }),
                      },
                    ])
                  }
                />
              ) : (
                <Pressable
                  key={service.id}
                  accessibilityRole="button"
                  onPress={() => setOpenId(service.id)}
                  style={[styles.row, { backgroundColor: c.surface, borderColor: c.line }]}
                >
                  <View style={styles.rowText}>
                    <Text style={[type.subtitle, { color: c.text }]}>{service.name}</Text>
                    <Text style={[type.caption, numeric, { color: c.textMuted }]}>
                      {t('wash.waitMinutes', { value: String(service.duration_min) })}
                    </Text>
                  </View>

                  <View style={styles.rowEnd}>
                    <Text style={[type.subtitle, numeric, { color: c.text }]}>
                      {formatDH(service.price)}
                    </Text>
                    {!service.is_active ? (
                      <Text style={[type.caption, { color: c.textFaint }]}>
                        {t('queue.closed')}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ),
            )}

            {adding ? (
              <ServiceForm
                initial={{ name: '', priceDirhams: '', durationMin: '', isActive: true }}
                saving={services.save.isPending}
                onCancel={() => setAdding(false)}
                onSave={(draft) =>
                  services.save.mutate({ draft }, { onSuccess: () => setAdding(false) })
                }
              />
            ) : services.rows.length > 0 ? (
              <Button
                label={t('owner.addService')}
                variant="secondary"
                size="owner"
                onPress={() => setAdding(true)}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ServiceForm({
  initial,
  saving,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: { name: string; priceDirhams: string; durationMin: string; isActive: boolean };
  saving: boolean;
  onSave: (draft: {
    name: string;
    priceCentimes: number;
    durationMin: number;
    isActive: boolean;
  }) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();

  const [name, setName] = useState(initial.name);
  const [price, setPrice] = useState(initial.priceDirhams);
  const [duration, setDuration] = useState(initial.durationMin);
  const [isActive, setIsActive] = useState(initial.isActive);

  const parsed = parseServiceDraft({ name, priceDirhams: price, durationMin: duration });

  return (
    <View style={[styles.form, { backgroundColor: c.surface, borderColor: c.lineStrong }]}>
      <Field value={name} onChange={setName} label={t('owner.serviceName')} />
      <Field
        value={price}
        onChange={(next) => setPrice(next.replace(/\D/g, ''))}
        label={t('owner.servicePrice')}
        numeric
      />
      <Field
        value={duration}
        onChange={(next) => setDuration(next.replace(/\D/g, ''))}
        label={t('owner.serviceDuration')}
        numeric
      />

      {/* A warning, not a block — see the note at the top of the file. */}
      {parsed.ok && parsed.warnDuration ? (
        <Text style={[type.caption, { color: c.warn }]}>{t('owner.durationOdd')}</Text>
      ) : null}

      <View style={styles.switchRow}>
        <Text style={[type.label, { color: c.text }]}>{t('owner.serviceActive')}</Text>
        <Switch value={isActive} onValueChange={setIsActive} />
      </View>

      <Button
        label={t('common.save')}
        size="owner"
        disabled={!parsed.ok}
        loading={saving}
        onPress={() => {
          if (!parsed.ok) return;
          onSave({
            name: parsed.name,
            priceCentimes: parsed.priceCentimes,
            durationMin: parsed.durationMin,
            isActive,
          });
        }}
      />
      <Button label={t('common.cancel')} variant="ghost" size="owner" onPress={onCancel} />
      {onDelete !== undefined ? (
        <Button label={t('common.delete')} variant="ghost" size="owner" onPress={onDelete} />
      ) : null}
    </View>
  );
}

function Field({
  value,
  onChange,
  label,
  numeric: isNumeric = false,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  numeric?: boolean;
}) {
  const { c } = useTheme();

  return (
    <View style={styles.field}>
      <Text style={[type.label, { color: c.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={isNumeric ? 'number-pad' : 'default'}
        style={[
          type.body,
          isNumeric ? numeric : null,
          styles.input,
          { backgroundColor: c.bg, borderColor: c.line, color: c.text },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, rowGap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.lg,
    minHeight: hitSize.primary,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, rowGap: spacing.xs },
  rowEnd: { alignItems: 'flex-end' },
  form: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    rowGap: spacing.md,
  },
  field: { rowGap: spacing.xs },
  input: {
    minHeight: hitSize.primary,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: hitSize.min,
  },
});
