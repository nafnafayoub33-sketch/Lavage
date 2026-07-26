/**
 * src/ui/NotBuilt.tsx
 *
 * Temporary scaffolding, not part of the design system.
 *
 * A3/A4/A5 hand off to screens that do not exist yet. Rather than crash on a
 * missing route, each destination gets a placeholder saying which screen
 * belongs there. Delete this file and its routes as the real screens land.
 *
 * The text here is intentionally untranslated developer copy — it is never
 * meant to reach a user, and inventing i18n keys for screens that do not
 * exist would be worse than leaving it in English.
 */
import { StyleSheet, Text, View } from 'react-native';

import { spacing, type } from './theme';
import { useTheme } from './useTheme';

export function NotBuilt({ id, name }: { id: string; name: string }) {
  const { c } = useTheme();

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <Text style={[type.ticket, { color: c.textFaint }]}>{id}</Text>
      <Text style={[type.subtitle, { color: c.textMuted }]}>{name}</Text>
      <Text style={[type.caption, { color: c.textFaint }]}>not built yet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: spacing.sm,
  },
});

export default NotBuilt;
