/**
 * src/ui/Banner.tsx
 *
 * The inline message strip: offline, an error, a warning.
 *
 * SCREENS.md rule 3 — offline shows a banner on top and cached data stays
 * visible. A banner never replaces content, it sits above it.
 */
import { StyleSheet, Text, View } from 'react-native';

import { radii, spacing, type } from './theme';
import { useTheme } from './useTheme';

export type BannerTone = 'error' | 'warn' | 'muted';

export function Banner({ message, tone = 'error' }: { message: string; tone?: BannerTone }) {
  const { c } = useTheme();

  const color = { error: c.bad, warn: c.warn, muted: c.textMuted }[tone];

  return (
    <View
      accessibilityRole="alert"
      style={[styles.base, { backgroundColor: c.surface, borderColor: color }]}
    >
      <Text style={[type.label, { color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderStartWidth: spacing.xs / 2,
  },
});

export default Banner;
