/**
 * Agents — list of digital employees / agents (dummy data).
 */
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Avatar, Card, Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { agents } from '@/data/mock';
import { useTheme } from '@/hooks/use-theme';

export function AgentsScreen() {
  const theme = useTheme();

  return (
    <Screen padded={false} edges={['bottom']}>
      <FlatList
        data={agents}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Avatar name={item.name} size={44} />
              <View style={styles.info}>
                <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.role, { color: theme.textSecondary }]}>{item.role}</Text>
              </View>
              <View style={styles.statusWrap}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: item.status === 'active' ? '#16a34a' : theme.textSecondary },
                  ]}
                />
                <Text style={[styles.status, { color: theme.textSecondary }]}>
                  {item.status === 'active' ? 'Active' : 'Idle'}
                </Text>
              </View>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  info: { flex: 1, gap: 2 },
  name: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  role: { fontSize: FontSize.sm },
  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  status: { fontSize: FontSize.xs },
});
