/**
 * src/ui/Button.tsx
 *
 * One primary button per screen — that is a rule, not a default. Everything
 * else on a screen is `secondary` or `ghost`.
 *
 * Owner-facing screens pass `size="owner"`: 52px, because those buttons get
 * tapped with wet hands.
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { hitSize, motion, radii, spacing, type } from './theme';
import { useTheme } from './useTheme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** 'owner' bumps the target to 52px for wet hands */
  size?: 'default' | 'owner';
  disabled?: boolean;
  loading?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'default',
  disabled = false,
  loading = false,
}: Props) {
  const { c } = useTheme();

  // A loading button is not tappable, but it must not look disabled — the
  // user asked for something and it is happening.
  const inert = disabled || loading;

  const palette = {
    primary: { bg: c.primary, fg: c.onPrimary, border: c.primary },
    secondary: { bg: c.surface, fg: c.text, border: c.line },
    ghost: { bg: 'transparent', fg: c.text, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: loading }}
      disabled={inert}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: size === 'owner' ? hitSize.primary : hitSize.min,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled ? 0.4 : 1,
          transform: [{ scale: pressed && !inert ? motion.press.scale : 1 }],
        },
      ]}
    >
      {/* The label stays mounted under the spinner so the button keeps its width. */}
      <Text style={[type.subtitle, { color: palette.fg, opacity: loading ? 0 : 1 }]}>
        {label}
      </Text>
      {loading ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <ActivityIndicator style={styles.spinner} color={palette.fg} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  spinner: { flex: 1 },
});

export default Button;
