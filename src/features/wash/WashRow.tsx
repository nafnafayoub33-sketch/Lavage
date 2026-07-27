/**
 * src/features/wash/WashRow.tsx
 *
 * C1's list row: name · distance · price from · estimated wait · status dot.
 *
 * Every number here stays Latin and LTR in all three languages, which is
 * what the `numeric` style from theme.ts is for.
 */
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { NearbyWash } from '@/core/domain/CarWash';
import { queueStateFor } from '@/core/usecases/queueState';
import { formatDistance, formatWait } from '@/lib/format';
import { formatDH } from '@/lib/i18n';
import { hitSize, motion, numeric, queueColor, radii, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export function WashRow({ wash, onPress }: { wash: NearbyWash; onPress: () => void }) {
  const { t } = useTranslation();
  const { c } = useTheme();

  const state = queueStateFor({ waitMinutes: wash.waitMinutes, isOpen: wash.isOpen });
  const dot = queueColor(c)[state];

  const distance = formatDistance(wash.distanceM);
  const wait = formatWait(wash.waitMinutes);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: c.line,
          transform: [{ scale: pressed ? motion.press.scale : 1 }],
        },
      ]}
    >
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <View style={[styles.dot, { backgroundColor: dot }]} />
          <Text numberOfLines={1} style={[type.subtitle, styles.name, { color: c.text }]}>
            {wash.name}
          </Text>
        </View>

        <View style={styles.meta}>
          <Text style={[type.caption, numeric, { color: c.textMuted }]}>
            {t(distance.key, distance.params)}
          </Text>

          {wash.priceFrom !== null ? (
            <>
              <Text style={[type.caption, { color: c.textFaint }]}>·</Text>
              <Text style={[type.caption, numeric, { color: c.textMuted }]}>
                {t('wash.priceFrom', { price: formatDH(wash.priceFrom) })}
              </Text>
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.waitBox}>
        {wash.isOpen ? (
          <Text style={[type.subtitle, numeric, { color: c.text }]}>
            {t(wait.key, wait.params)}
          </Text>
        ) : (
          <Text style={[type.label, { color: c.textMuted }]}>{t('queue.closed')}</Text>
        )}
        <Text style={[type.caption, { color: c.textFaint }]}>{t(`queue.${state}`)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.lg,
    minHeight: hitSize.min,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  main: { flex: 1, rowGap: spacing.xs },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
  },
  dot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radii.pill,
  },
  name: { flex: 1 },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.xs,
    // the dot's width plus its gap, so the metadata lines up under the name
    marginStart: spacing.sm + spacing.sm,
  },
  waitBox: { alignItems: 'flex-end' },
});

export default WashRow;
