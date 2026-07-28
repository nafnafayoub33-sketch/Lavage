/**
 * src/ui/Skeleton.tsx
 *
 * The loading state every list owes the user (SCREENS.md rule 2).
 *
 * Deliberately still. The motion budget in theme.ts allows four kinds of
 * movement and a shimmer is none of them — a pulsing placeholder animates
 * while nothing is actually happening, which is exactly what the budget
 * exists to prevent.
 */
import { StyleSheet, View } from 'react-native';

import { radii, spacing } from './theme';
import { useTheme } from './useTheme';

export function SkeletonBlock({ height, width }: { height: number; width?: number | `${number}%` }) {
  const { c } = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.block, { height, width: width ?? '100%', backgroundColor: c.raised }]}
    />
  );
}

/** One placeholder row, shaped like the real thing so nothing jumps on load. */
export function SkeletonRow() {
  const { c } = useTheme();

  return (
    <View style={[styles.row, { borderColor: c.line }]}>
      <View style={styles.rowText}>
        <SkeletonBlock height={16} width="60%" />
        <SkeletonBlock height={12} width="40%" />
      </View>
      <SkeletonBlock height={12} width={48} />
    </View>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: radii.sm },
  list: { rowGap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, rowGap: spacing.sm },
});
