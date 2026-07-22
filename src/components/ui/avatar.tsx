/**
 * Avatar — initials inside a themed circle (fallback when there's no image).
 */
import { StyleSheet, Text, View } from 'react-native';

import { FontWeight, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: Radius.full,
          backgroundColor: theme.backgroundElement,
        },
      ]}>
      <Text style={[styles.text, { color: theme.text, fontSize: size * 0.4 }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: FontWeight.semibold },
});
