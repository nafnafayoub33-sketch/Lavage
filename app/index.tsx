/**
 * app/index.tsx
 *
 * Skeleton smoke test — not a screen from docs/SCREENS.md.
 *
 * It proves four things are wired: the fonts load, the theme switches, the
 * translations resolve (interpolation, Latin digits, money), and the language
 * switch flips direction. Delete it when A1 (splash) lands.
 */
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatDH, LANGS, setLanguage, type Lang } from '@/lib/i18n';
import { hitSize, numeric, radii, spacing, type } from '@/ui/theme';
import { SCHEME_PREFERENCES, useTheme } from '@/ui/useTheme';

/** Endonyms — a language is always offered in its own script, never translated. */
const LANG_LABEL: Record<Lang, string> = {
  ar: 'العربية',
  fr: 'Français',
  en: 'English',
};

export default function SkeletonScreen() {
  const { t, i18n } = useTranslation();
  const { c, scheme, pref, setPref } = useTheme();

  const onPickLanguage = async (lng: Lang) => {
    const { restartNeeded } = await setLanguage(lng);
    if (restartNeeded) {
      Alert.alert(t('account.restartNeeded'), undefined, [{ text: t('common.close') }]);
    }
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[type.ticket, numeric, { color: c.text }]}>OK</Text>

        <Text style={[type.subtitle, { color: c.textMuted }]}>
          {t('queue.eta', { minutes: 12 })}
        </Text>

        <Text style={[type.body, numeric, { color: c.textFaint }]}>{formatDH(3000)}</Text>

        <Section title={t('account.language')}>
          {LANGS.map((lng) => (
            <Choice
              key={lng}
              label={LANG_LABEL[lng]}
              selected={i18n.language === lng}
              onPress={() => onPickLanguage(lng)}
            />
          ))}
        </Section>

        <Section title={t('account.appearance')}>
          {SCHEME_PREFERENCES.map((option) => (
            <Choice
              key={option}
              label={t(`account.${option}`)}
              selected={pref === option}
              onPress={() => setPref(option)}
            />
          ))}
        </Section>

        <Text style={[type.caption, { color: c.textFaint }]}>{scheme}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { c } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[type.label, { color: c.textMuted }]}>{title}</Text>
      <View style={styles.row}>{children}</View>
    </View>
  );
}

function Choice({
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
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: selected ? c.primary : c.surface,
          borderColor: selected ? c.primary : c.line,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[type.subtitle, { color: selected ? c.onPrimary : c.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    rowGap: spacing.lg,
  },
  section: {
    alignItems: 'center',
    rowGap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: spacing.sm,
    rowGap: spacing.sm,
  },
  choice: {
    minHeight: hitSize.min,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
