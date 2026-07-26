/**
 * src/features/auth/PhoneField.tsx
 *
 * A3: "fixed +212 prefix with flag, number field".
 *
 * The prefix is not editable and not part of the value — the user types the
 * national number only. Digits stay Latin and LTR in all three languages,
 * including Arabic, so the field is forced LTR regardless of layout
 * direction and sits inside a row that mirrors normally.
 */
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { COUNTRY_PREFIX, formatNational, toNationalDigits } from '@/core/usecases/phone';
import { numeric, radii, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

const MOROCCO_FLAG = '🇲🇦';

type Props = {
  /** national significant digits, e.g. "612345678" */
  value: string;
  onChange: (nationalDigits: string) => void;
  invalid?: boolean;
  editable?: boolean;
  autoFocus?: boolean;
};

export function PhoneField({
  value,
  onChange,
  invalid = false,
  editable = true,
  autoFocus = false,
}: Props) {
  const { c } = useTheme();

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: c.surface, borderColor: invalid ? c.bad : c.line },
      ]}
    >
      <View style={styles.prefix}>
        <Text style={type.subtitle}>{MOROCCO_FLAG}</Text>
        <Text style={[type.subtitle, numeric, { color: c.textMuted }]}>{COUNTRY_PREFIX}</Text>
      </View>

      <View style={[styles.divider, { backgroundColor: c.line }]} />

      <TextInput
        value={formatNational(value)}
        onChangeText={(text) => onChange(toNationalDigits(text))}
        editable={editable}
        autoFocus={autoFocus}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        placeholder="612 345 678"
        placeholderTextColor={c.textFaint}
        style={[type.title, numeric, styles.input, { color: c.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
  },
  prefix: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: spacing.md,
    marginHorizontal: spacing.lg,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.lg,
    // digits never mirror, whatever the layout direction
    textAlign: 'left',
  },
});

export default PhoneField;
