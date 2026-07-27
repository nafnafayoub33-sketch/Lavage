/**
 * app/(owner)/wash/index.tsx — O5 · My wash page
 *
 * The same page C3 shows a client, but editable: name, description, address,
 * phone, bays, hours, and the open/closed switch.
 *
 * Three things from the spec are absent and each is a missing capability
 * rather than a choice:
 *   photos    need a Supabase Storage bucket, which does not exist yet
 *   location  needs a map picker; the address is editable in the meantime
 *   status    is the admin's (D2/D3), never the owner's
 *
 * States: loading · error with retry · no wash yet · data · saving · offline.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOwnerWash } from '@/features/wash/useOwnerWash';
import { useOffline } from '@/hooks/useOffline';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { SkeletonList } from '@/ui/Skeleton';
import { hitSize, numeric, radii, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function MyWashScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const offline = useOffline();
  const owner = useOwnerWash();

  const wash = owner.wash;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [bays, setBays] = useState('1');
  const [opensAt, setOpensAt] = useState('08:00');
  const [closesAt, setClosesAt] = useState('20:00');

  // Fill the form once the wash arrives. Keyed on id so it does not stamp
  // over what the owner is typing on every refetch.
  useEffect(() => {
    if (wash === null) return;
    setName(wash.name);
    setDescription(wash.description ?? '');
    setAddress(wash.address);
    setPhone(wash.phone ?? '');
    setBays(String(wash.bays_count));
    setOpensAt(wash.opens_at.slice(0, 5));
    setClosesAt(wash.closes_at.slice(0, 5));
  }, [wash?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const baysCount = Number.parseInt(bays, 10);
  const canSave =
    name.trim() !== '' && address.trim() !== '' && Number.isInteger(baysCount) && baysCount > 0;

  const onSave = () => {
    if (!canSave || wash === null) return;

    owner.save.mutate(
      {
        name: name.trim(),
        description: description.trim() === '' ? null : description.trim(),
        address: address.trim(),
        phone: phone.trim() === '' ? null : phone.trim(),
        baysCount,
        opensAt,
        closesAt,
      },
      {
        onError: (error) => {
          console.error('[O5] could not save the wash', error);
          Alert.alert(t('error.generic'), undefined, [{ text: t('common.close') }]);
        },
      },
    );
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[type.title, { color: c.text }]}>{t('owner.washTitle')}</Text>

        {offline ? <Banner message={t('error.offline')} tone="muted" /> : null}

        {owner.isLoading ? (
          <SkeletonList rows={5} />
        ) : owner.isError ? (
          <EmptyState
            message={t('error.generic')}
            actionLabel={t('common.retry')}
            onAction={owner.refetch}
          />
        ) : wash === null ? (
          <EmptyState
            message={t('owner.noWashYet')}
            actionLabel={t('common.continue')}
            onAction={() => router.replace('/(owner)/register')}
          />
        ) : (
          <>
            <View style={[styles.openRow, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Text style={[type.label, { color: c.text }]}>
                {wash.is_open_now ? t('queue.open') : t('owner.closedToday')}
              </Text>
              <Switch
                value={wash.is_open_now}
                onValueChange={(next) => owner.toggleOpen.mutate(next)}
              />
            </View>

            <Field value={name} onChange={setName} label={t('owner.washName')} />
            <Field
              value={description}
              onChange={setDescription}
              label={t('owner.washDescription')}
              multiline
            />
            <Field value={address} onChange={setAddress} label={t('owner.washAddress')} />
            <Field value={phone} onChange={setPhone} label={t('owner.washPhone')} isNumeric />
            <Field
              value={bays}
              onChange={(next) => setBays(next.replace(/\D/g, ''))}
              label={t('owner.bays')}
              isNumeric
            />

            <View style={styles.hours}>
              <View style={styles.hoursField}>
                <Field value={opensAt} onChange={setOpensAt} label={t('owner.opensAt')} isNumeric />
              </View>
              <View style={styles.hoursField}>
                <Field value={closesAt} onChange={setClosesAt} label={t('owner.closesAt')} isNumeric />
              </View>
            </View>

            <Button
              label={t('common.save')}
              size="owner"
              disabled={!canSave || offline}
              loading={owner.save.isPending}
              onPress={onSave}
            />

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(owner)/wash/services')}
              style={[styles.link, { borderColor: c.line }]}
            >
              <Text style={[type.body, { color: c.text }]}>{t('owner.servicesTitle')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  value,
  onChange,
  label,
  isNumeric = false,
  multiline = false,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  isNumeric?: boolean;
  multiline?: boolean;
}) {
  const { c } = useTheme();

  return (
    <View style={styles.field}>
      <Text style={[type.label, { color: c.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={isNumeric ? 'numbers-and-punctuation' : 'default'}
        style={[
          type.body,
          isNumeric ? numeric : null,
          styles.input,
          multiline ? styles.multiline : null,
          { backgroundColor: c.surface, borderColor: c.line, color: c.text },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, rowGap: spacing.md },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: hitSize.primary,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  field: { rowGap: spacing.xs },
  input: {
    minHeight: hitSize.primary,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  multiline: { minHeight: hitSize.primary * 2, paddingTop: spacing.md },
  hours: { flexDirection: 'row', columnGap: spacing.md },
  hoursField: { flex: 1 },
  link: {
    minHeight: hitSize.primary,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
