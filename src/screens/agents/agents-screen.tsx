/**
 * DigitalEmployees — placeholder for the upcoming "Digital Employees" feature
 * (autonomous agents with an isolated workspace and graduated autonomy L1–L4).
 *
 * There is no mobile API for this yet, so instead of showing fake data we show
 * an honest "coming soon" state, with a link to manage it on the web.
 */
import { Users } from 'lucide-react-native';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Button, EmptyState, Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { getApiUrl } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';

export function AgentsScreen() {
  const theme = useTheme();

  return (
    <Screen edges={['bottom']}>
      <View style={styles.center}>
        <EmptyState
          icon={Users}
          title="Digital Employees"
          subtitle="Autonomous AI agents that run in their own isolated workspace with graduated autonomy (L1–L4). Coming soon to mobile."
          action={
            <View style={styles.actions}>
              <View style={[styles.badge, { backgroundColor: `${theme.accent}1A` }]}>
                <Text style={[styles.badgeText, { color: theme.accent }]}>Coming soon</Text>
              </View>
              <Button
                label="Open on web"
                variant="outline"
                onPress={() => Linking.openURL(`${getApiUrl()}/dashboard/digital-employees`)}
                style={styles.webBtn}
              />
            </View>
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  actions: { alignItems: 'center', gap: Spacing.three, marginTop: Spacing.two },
  badge: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.full,
  },
  badgeText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  webBtn: { minWidth: 180 },
});
