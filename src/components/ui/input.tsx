/**
 * Input — themed text field with a label & blue accent focus (shadcn input).
 */
import { forwardRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type InputProps = TextInputProps & {
  label?: string;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, style, onFocus, onBlur, ...rest },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={theme.textSecondary}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.card,
            borderColor: focused ? theme.accent : theme.border,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  input: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
    fontSize: FontSize.md,
  },
});
