/**
 * More — menu to secondary sections (Workflows, Media, Settings, etc.) + log out.
 * All items are placeholders for the design phase.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar, Button, Card, Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';

const ITEMS = [
  { key: 'workflows', label: 'Workflows', desc: 'Agent pipelines & automation' },
  { key: 'media', label: 'Media Studio', desc: 'Image / audio / video generation' },
  { key: 'agent-builder', label: 'Agent Builder', desc: 'Configure AI assistants' },
  { key: 'audit', label: 'Audit Log', desc: 'Activity history' },
  { key: 'organization', label: 'Organization', desc: 'Members & teams' },
  { key: 'settings', label: 'Settings', desc: 'General, credentials, MCP' },
];

export function MoreScreen() {
  const theme = useTheme();
  const { signOut } = useAuth();

  return (
    <Screen padded={false} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>More</Text>

        <Card style={styles.profile}>
          <View style={styles.profileRow}>
            <Avatar name="Evan K" size={48} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: theme.text }]}>Evan Kleopas</Text>
              <Text style={[styles.email, { color: theme.textSecondary }]}>
                kleopasevan@gmail.com
              </Text>
            </View>
          </View>
        </Card>

        <View style={styles.menu}>
          {ITEMS.map((it) => (
            <Pressable
              key={it.key}
              style={({ pressed }) => [
                styles.item,
                { borderColor: theme.border, backgroundColor: pressed ? theme.backgroundElement : theme.card },
              ]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemLabel, { color: theme.text }]}>{it.label}</Text>
                <Text style={[styles.itemDesc, { color: theme.textSecondary }]}>{it.desc}</Text>
              </View>
              <Text style={{ color: theme.textSecondary, fontSize: FontSize.xl }}>›</Text>
            </Pressable>
          ))}
        </View>

        <Button label="Log out" variant="outline" onPress={signOut} style={styles.signOut} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.three },
  title: { fontSize: FontSize.title1, fontWeight: FontWeight.bold },
  profile: {},
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  name: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  email: { fontSize: FontSize.sm },
  menu: { gap: Spacing.two },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  itemLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  itemDesc: { fontSize: FontSize.sm },
  signOut: { marginTop: Spacing.two },
});
