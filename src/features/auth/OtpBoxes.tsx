/**
 * src/features/auth/OtpBoxes.tsx
 *
 * A4: "6 boxes".
 *
 * One real, invisible TextInput behind six drawn boxes. Six separate inputs
 * fight the keyboard, break paste, and break SMS autofill — this keeps the
 * platform behaviour (one-time-code autofill included) and only borrows the
 * look.
 *
 * The boxes are laid out LTR always: a code is a number, and numbers do not
 * mirror in Arabic.
 */
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { numeric, radii, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export const CODE_LENGTH = 6;

type Props = {
  value: string;
  onChange: (code: string) => void;
  invalid?: boolean;
  editable?: boolean;
  autoFocus?: boolean;
};

export function OtpBoxes({
  value,
  onChange,
  invalid = false,
  editable = true,
  autoFocus = false,
}: Props) {
  const { c } = useTheme();
  const inputRef = useRef<TextInput>(null);

  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? '');
  // The box the next digit lands in, so exactly one box reads as focused.
  const cursor = Math.min(value.length, CODE_LENGTH - 1);

  return (
    <Pressable
      accessibilityRole="none"
      onPress={() => inputRef.current?.focus()}
      style={styles.row}
    >
      {digits.map((digit, index) => {
        const active = editable && index === cursor;
        return (
          <View
            key={index}
            style={[
              styles.box,
              {
                backgroundColor: c.surface,
                borderColor: invalid ? c.bad : active ? c.lineStrong : c.line,
              },
            ]}
          >
            <Text style={[type.title, numeric, { color: c.text }]}>{digit}</Text>
          </View>
        );
      })}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, CODE_LENGTH))}
        editable={editable}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={CODE_LENGTH}
        style={styles.hidden}
        // Screen readers get the real field, not the drawn boxes.
        accessibilityLabel={undefined}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    // a code is a number: never mirrored
    flexDirection: 'row',
    justifyContent: 'center',
    columnGap: spacing.sm,
    direction: 'ltr',
  },
  box: {
    width: spacing.xxl + spacing.sm,
    height: spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hidden: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
  },
});

export default OtpBoxes;
