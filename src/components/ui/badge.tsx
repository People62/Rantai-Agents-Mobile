/**
 * Badge — small label (default/secondary/accent/outline).
 */
import { StyleSheet, Text, View } from 'react-native';

import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'default' | 'secondary' | 'accent' | 'outline';

export function Badge({ label, variant = 'secondary' }: { label: string; variant?: Variant }) {
  const theme = useTheme();

  const bg: Record<Variant, string> = {
    default: theme.primary,
    secondary: theme.backgroundElement,
    accent: theme.accent,
    outline: 'transparent',
  };
  const fg: Record<Variant, string> = {
    default: theme.primaryForeground,
    secondary: theme.textSecondary,
    accent: theme.accentForeground,
    outline: theme.textSecondary,
  };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg[variant],
          borderColor: variant === 'outline' ? theme.border : 'transparent',
          borderWidth: variant === 'outline' ? StyleSheet.hairlineWidth * 2 : 0,
        },
      ]}>
      <Text style={[styles.text, { color: fg[variant] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  text: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
});
