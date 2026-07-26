/**
 * app/(auth)/language.tsx — A2 · Language
 *
 * Three large buttons, shown on first launch only. Nothing is preselected:
 * the app is already running in a guessed language and highlighting that
 * guess would make the screen look answered before it is.
 *
 * Picking Arabic flips the layout to RTL, which React Native can only do
 * across a restart. setLanguage() handles that and tells us when the restart
 * could not happen, which is every development build.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LANGS, setLanguage, type Lang } from '@/lib/i18n';
import { hitSize, radii, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** A language is always offered in its own script, never translated. */
const LANG_LABEL: Record<Lang, string> = {
  ar: 'العربية',
  fr: 'Français',
  en: 'English',
};

export default function LanguageScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onPick = async (lng: Lang) => {
    if (busy) return;
    setBusy(true);

    const { restartNeeded } = await setLanguage(lng);

    // On a real build an RTL switch restarts the app and this line is never
    // reached. When it is, say so rather than leaving a half-mirrored screen
    // unexplained.
    if (restartNeeded) {
      Alert.alert(t('account.restartNeeded'), undefined, [{ text: t('common.close') }]);
    }

    router.replace('/(auth)/phone');
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <View style={styles.content}>
        <Text style={[type.title, { color: c.text }]}>{t('auth.language')}</Text>

        <View style={styles.choices}>
          {LANGS.map((lng) => (
            <Pressable
              key={lng}
              accessibilityRole="button"
              accessibilityLabel={LANG_LABEL[lng]}
              disabled={busy}
              onPress={() => void onPick(lng)}
              style={({ pressed }) => [
                styles.choice,
                {
                  backgroundColor: c.surface,
                  borderColor: pressed ? c.lineStrong : c.line,
                  opacity: busy ? 0.4 : 1,
                },
              ]}
            >
              <Text style={[type.title, { color: c.text }]}>{LANG_LABEL[lng]}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    rowGap: spacing.xxl,
  },
  choices: { rowGap: spacing.md },
  choice: {
    minHeight: hitSize.primary + spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
