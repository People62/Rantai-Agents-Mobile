/**
 * Input — themed text field with a label & blue accent focus (shadcn input).
 */
import { forwardRef, useState, type ReactNode } from 'react';
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
  /** Element rendered inside the field on the right (e.g. a show-password eye). */
  rightElement?: ReactNode;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, style, onFocus, onBlur, rightElement, ...rest },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      ) : null}
      <View style={styles.field}>
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
            rightElement ? styles.inputWithRight : null,
            {
              color: theme.text,
              backgroundColor: theme.card,
              borderColor: focused ? theme.accent : theme.border,
            },
            style,
          ]}
          {...rest}
        />
        {rightElement ? <View style={styles.right}>{rightElement}</View> : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  field: { position: 'relative', justifyContent: 'center' },
  input: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
    fontSize: FontSize.md,
  },
  inputWithRight: { paddingRight: 44 },
  right: {
    position: 'absolute',
    right: Spacing.two,
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
});
