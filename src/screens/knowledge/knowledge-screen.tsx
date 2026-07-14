/**
 * Knowledge — daftar file basis pengetahuan (RAG). Data dummy.
 */
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, Screen } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { knowledgeFiles } from '@/data/mock';
import { useTheme } from '@/hooks/use-theme';

export function KnowledgeScreen() {
  const theme = useTheme();

  return (
    <Screen padded={false} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Knowledge</Text>
      </View>
      <FlatList
        data={knowledgeFiles}
        keyExtractor={(f) => f.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <View style={[styles.icon, { backgroundColor: theme.backgroundElement }]}>
                <Text style={{ color: theme.textSecondary, fontWeight: '700', fontSize: 12 }}>
                  {item.type}
                </Text>
              </View>
              <View style={styles.info}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.size, { color: theme.textSecondary }]}>{item.size}</Text>
              </View>
              <Badge label="Terindeks" variant="secondary" />
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.three },
  title: { fontSize: 28, fontWeight: '700' },
  list: { paddingHorizontal: Spacing.four },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  icon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600' },
  size: { fontSize: 12 },
});
