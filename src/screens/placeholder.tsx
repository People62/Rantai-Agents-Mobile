/**
 * Placeholder — temporary screen for features not yet built (design phase).
 * Used for Search, Agent Builder, Workflows, Media Studio, Settings.
 */
import { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui';
import { FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function makePlaceholder(title: string, subtitle: string, Icon: LucideIcon) {
  return function PlaceholderScreen() {
    const theme = useTheme();
    return (
      <Screen>
        <View style={styles.center}>
          <View style={[styles.iconWrap, { backgroundColor: theme.backgroundElement }]}>
            <Icon color={theme.textSecondary} size={32} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
        </View>
      </Screen>
    );
  };
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  title: { fontSize: FontSize.title3, fontWeight: FontWeight.bold },
  subtitle: { fontSize: FontSize.base, textAlign: 'center', maxWidth: 260 },
});
