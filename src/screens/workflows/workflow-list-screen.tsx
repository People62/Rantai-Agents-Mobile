/**
 * WorkflowList — the user's workflows from the backend
 * (GET /api/mobile/workflows). Search + filter by status; tap to open detail.
 * Read & monitor only — building/editing graphs is not supported on mobile.
 */
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Search } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { Workflow, WorkflowStatus, getWorkflows } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { WorkflowStackParamList } from '@/navigation/types';
import { workflowStatusColor } from './workflow-utils';

type Props = NativeStackScreenProps<WorkflowStackParamList, 'WorkflowList'>;

const FILTERS: Array<{ label: string; value: WorkflowStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Paused', value: 'PAUSED' },
  { label: 'Archived', value: 'ARCHIVED' },
];

export function WorkflowListScreen({ navigation }: Props) {
  const theme = useTheme();
  const { token } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<WorkflowStatus | 'ALL'>('ALL');

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setWorkflows(await getWorkflows(token));
    } catch {
      setError('Failed to load workflows. Tap to try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return workflows.filter((w) => {
      if (filter !== 'ALL' && w.status !== filter) return false;
      if (!q) return true;
      return (
        w.name.toLowerCase().includes(q) ||
        (w.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [workflows, query, filter]);

  if (loading) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen edges={['bottom']}>
        <Pressable
          style={styles.centered}
          onPress={() => {
            setLoading(true);
            load();
          }}>
          <Text style={[styles.muted, { color: theme.destructive }]}>{error}</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['bottom']}>
      <View style={styles.searchWrap}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          <Search color={theme.textSecondary} size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search workflows…"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => setFilter(f.value)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.accent : theme.backgroundElement,
                    borderColor: active ? theme.accent : theme.border,
                  },
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? theme.accentForeground : theme.textSecondary },
                  ]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(w) => w.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={filtered.length ? styles.list : styles.emptyWrap}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={load} tintColor={theme.accent} />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {query || filter !== 'ALL' ? 'No results' : 'No workflows yet'}
            </Text>
            <Text style={[styles.muted, { color: theme.textSecondary }]}>
              {query || filter !== 'ALL'
                ? 'No workflows match your filter.'
                : 'Workflows are built on the web dashboard, then run & monitored here.'}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => (
          <View style={[styles.sep, { backgroundColor: theme.border }]} />
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              navigation.navigate('WorkflowDetail', { id: item.id, name: item.name })
            }
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: theme.backgroundElement },
            ]}>
            <View style={styles.rowText}>
              <View style={styles.rowTop}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: `${workflowStatusColor(theme, item.status)}22` },
                  ]}>
                  <View
                    style={[styles.dot, { backgroundColor: workflowStatusColor(theme, item.status) }]}
                  />
                  <Text
                    style={[styles.badgeText, { color: workflowStatusColor(theme, item.status) }]}>
                    {item.status}
                  </Text>
                </View>
              </View>
              <Text style={[styles.preview, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.description?.trim() ||
                  `${item.category} · ${item._count?.runs ?? 0} run${
                    (item._count?.runs ?? 0) === 1 ? '' : 's'
                  }`}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.one, padding: Spacing.four },
  emptyWrap: { flexGrow: 1 },
  searchWrap: { paddingTop: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 44,
    marginHorizontal: Spacing.four,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, padding: 0 },
  chips: { paddingHorizontal: Spacing.four, gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  muted: { fontSize: FontSize.base, textAlign: 'center' },
  list: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  row: { paddingVertical: Spacing.three, borderRadius: 12 },
  rowText: { gap: 2, marginHorizontal: Spacing.two },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, flex: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  preview: { fontSize: FontSize.base },
  sep: { height: StyleSheet.hairlineWidth },
});
