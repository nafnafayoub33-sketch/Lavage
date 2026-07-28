/**
 * src/ui/EmptyState.tsx
 *
 * The "nothing here" and "that went wrong" halves of SCREENS.md rule 2.
 *
 * An empty state always offers a way out — widen the search, try again, open
 * settings. A dead end with an apology on it is not a state, it is a
 * cul-de-sac.
 */
import { StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { spacing, type } from './theme';
import { useTheme } from './useTheme';

export function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { c } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[type.body, styles.message, { color: c.textMuted }]}>{message}</Text>

      {actionLabel !== undefined && onAction !== undefined ? (
        <Button label={actionLabel} variant="secondary" onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    rowGap: spacing.lg,
  },
  message: { textAlign: 'center' },
});

export default EmptyState;
