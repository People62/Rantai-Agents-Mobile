/**
 * Button — mengikuti varian shadcn/ui web (default/outline/ghost/destructive/secondary).
 */
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type Size = 'default' | 'sm' | 'lg';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  style?: ViewStyle;
};

const HEIGHT: Record<Size, number> = { sm: 36, default: 44, lg: 52 };

export function Button({
  label,
  onPress,
  variant = 'default',
  size = 'default',
  disabled,
  loading,
  leftIcon,
  style,
}: ButtonProps) {
  const theme = useTheme();

  const bg: Record<Variant, string> = {
    default: theme.primary,
    secondary: theme.backgroundElement,
    outline: 'transparent',
    ghost: 'transparent',
    destructive: theme.destructive,
  };
  const fg: Record<Variant, string> = {
    default: theme.primaryForeground,
    secondary: theme.text,
    outline: theme.text,
    ghost: theme.text,
    destructive: '#FFFFFF',
  };

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHT[size],
          backgroundColor: bg[variant],
          borderColor: variant === 'outline' ? theme.border : 'transparent',
          borderWidth: variant === 'outline' ? StyleSheet.hairlineWidth * 2 : 0,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <View style={styles.content}>
          {leftIcon}
          <Text
            style={[
              styles.label,
              { color: fg[variant], fontSize: size === 'lg' ? FontSize.lg : FontSize.md },
            ]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { fontWeight: FontWeight.semibold },
});
