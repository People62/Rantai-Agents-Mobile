/**
 * MemoryScreen — Settings → Memory. Shows the user's AI memory (working /
 * semantic / long-term) with counts, lets them filter by type, delete a single
 * entry, or clear a whole type. Memory is per-user.
 */
import { useFocusEffect } from '@react-navigation/native';
import { Brain, Cpu, Search, Trash2, UserCircle } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, Screen } from '@/components/ui';
import { Scrim, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import {
  MemoryItem,
  MemoryStats,
  MemoryType,
  clearMemories,
  deleteMemory,
  getMemories,
} from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';

type Filter = 'ALL' | MemoryType;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'WORKING', label: 'Working' },
  { key: 'SEMANTIC', label: 'Semantic' },
  { key: 'LONG_TERM', label: 'Long-term' },
];

const TYPE_LABEL: Record<string, string> = {
  WORKING: 'Working',
  SEMANTIC: 'Semantic',
  LONG_TERM: 'Long-term',
};

function preview(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function MemoryScreen() {
  const theme = useTheme();
  const { token } = useAuth();

  const [items, setItems] = useState<MemoryItem[]>([]);
  const [stats, setStats] = useState<MemoryStats>({ working: 0, semantic: 0, longTerm: 0, total: 0 });
  const [filter, setFilter] = useState<Filter>('ALL');
  const [loading, setLoading] = useState(true);

  const [deleting, setDeleting] = useState<MemoryItem | null>(null);
  const [clearing, setClearing] = useState<MemoryType | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getMemories(token, filter === 'ALL' ? undefined : filter);
      setItems(res.memories);
      setStats(res.stats);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function doDelete() {
    if (!token || !deleting || busy) return;
    setBusy(true);
    try {
      await deleteMemory(token, deleting.id);
      setItems((prev) => prev.filter((m) => m.id !== deleting.id));
      setDeleting(null);
      load();
    } catch {
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  async function doClear() {
    if (!token || !clearing || busy) return;
    setBusy(true);
    try {
      await clearMemories(token, clearing);
      setClearing(null);
      await load();
    } catch {
      setClearing(null);
    } finally {
      setBusy(false);
    }
  }

  const STAT_TILES = [
    { icon: Cpu, label: 'Working', count: stats.working },
    { icon: Search, label: 'Semantic', count: stats.semantic },
    { icon: UserCircle, label: 'Long-term', count: stats.longTerm },
    { icon: Brain, label: 'Total', count: stats.total },
  ];

  if (loading) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['bottom']}>
      <FlatList
        data={items}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Stats */}
            <View style={styles.statRow}>
              {STAT_TILES.map((t) => {
                const Icon = t.icon;
                return (
                  <View key={t.label} style={[styles.statTile, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Icon color={theme.accent} size={16} />
                    <Text style={[styles.statCount, { color: theme.text }]}>{t.count}</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.label}</Text>
                  </View>
                );
              })}
            </View>

            {/* Filter */}
            <View style={styles.filterRow}>
              {FILTERS.map((f) => {
                const on = f.key === filter;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setFilter(f.key)}
                    style={[
                      styles.filterChip,
                      { backgroundColor: on ? theme.primary : theme.backgroundElement },
                    ]}>
                    <Text style={[styles.filterText, { color: on ? theme.primaryForeground : theme.text }]}>
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {filter !== 'ALL' && items.length ? (
              <Pressable onPress={() => setClearing(filter)} style={styles.clearBtn}>
                <Trash2 color={theme.destructive} size={14} />
                <Text style={[styles.clearText, { color: theme.destructive }]}>
                  Clear all {TYPE_LABEL[filter]}
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Brain color={theme.textSecondary} size={32} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No memories</Text>
            <Text style={[styles.muted, { color: theme.textSecondary }]}>
              Memories appear as your agents learn from conversations.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => setDeleting(item)}
            delayLongPress={300}
            style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.rowTop}>
              <Text style={[styles.rowKey, { color: theme.text }]} numberOfLines={1}>
                {item.key}
              </Text>
              <View style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.pillText, { color: theme.textSecondary }]}>
                  {TYPE_LABEL[item.type] ?? item.type}
                </Text>
              </View>
            </View>
            <Text style={[styles.rowValue, { color: theme.textSecondary }]} numberOfLines={3}>
              {preview(item.value)}
            </Text>
          </Pressable>
        )}
      />

      {/* Delete one */}
      <Modal visible={!!deleting} transparent animationType="fade" onRequestClose={() => setDeleting(null)}>
        <Pressable style={styles.backdrop} onPress={() => (busy ? undefined : setDeleting(null))}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.dangerIcon, { backgroundColor: `${theme.destructive}1A` }]}>
              <Trash2 color={theme.destructive} size={26} />
            </View>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>Delete memory?</Text>
            <Text style={[styles.dialogMsg, { color: theme.textSecondary }]} numberOfLines={2}>
              {deleting?.key}
            </Text>
            <View style={styles.actions}>
              <Button label="Cancel" variant="outline" onPress={() => setDeleting(null)} disabled={busy} style={styles.flex} />
              <Button label="Delete" variant="destructive" onPress={doDelete} loading={busy} style={styles.flex} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Clear by type */}
      <Modal visible={!!clearing} transparent animationType="fade" onRequestClose={() => setClearing(null)}>
        <Pressable style={styles.backdrop} onPress={() => (busy ? undefined : setClearing(null))}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.dangerIcon, { backgroundColor: `${theme.destructive}1A` }]}>
              <Trash2 color={theme.destructive} size={26} />
            </View>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>
              Clear {clearing ? TYPE_LABEL[clearing] : ''} memory?
            </Text>
            <Text style={[styles.dialogMsg, { color: theme.textSecondary }]}>
              All memories of this type will be permanently deleted.
            </Text>
            <View style={styles.actions}>
              <Button label="Cancel" variant="outline" onPress={() => setClearing(null)} disabled={busy} style={styles.flex} />
              <Button label="Clear all" variant="destructive" onPress={doClear} loading={busy} style={styles.flex} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.six },
  muted: { fontSize: FontSize.base, textAlign: 'center' },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  list: { padding: Spacing.four, flexGrow: 1 },

  header: { gap: Spacing.three, marginBottom: Spacing.three },
  statRow: { flexDirection: 'row', gap: Spacing.two },
  statTile: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  statCount: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  statLabel: { fontSize: FontSize.xs },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  filterChip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.full },
  filterText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  clearText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  row: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowKey: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  rowValue: { fontSize: FontSize.sm, lineHeight: 18 },
  pill: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Radius.full },
  pillText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  backdrop: { flex: 1, backgroundColor: Scrim, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  dialog: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  dangerIcon: { width: 56, height: 56, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  dialogTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  dialogMsg: { fontSize: FontSize.base, textAlign: 'center', lineHeight: 20 },
  actions: { flexDirection: 'row', gap: Spacing.two, alignSelf: 'stretch' },
});
