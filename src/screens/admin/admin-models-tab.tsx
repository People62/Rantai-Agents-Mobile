/**
 * AdminModelsTab — LLM catalog admin (GET /api/mobile/admin/models). Search +
 * provider filter; toggle a model's availability, mark the platform default, and
 * flip tool-calling. "Sync" re-imports the OpenRouter catalog.
 */
import { Boxes, RefreshCw, Search, Star } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { EmptyState } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import {
  AdminModel,
  AdminProvider,
  getAdminModels,
  getAdminProviders,
  syncAdminModels,
  updateAdminModel,
} from '@/lib/api';

export function AdminModelsTab() {
  const theme = useTheme();
  const { token } = useAuth();
  const [models, setModels] = useState<AdminModel[]>([]);
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [defaultModelId, setDefaultModelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [providerId, setProviderId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  /** ids currently mutating, to disable their controls. */
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [modelsRes, providersRes] = await Promise.all([
        getAdminModels(token, {
          search: query.trim() || undefined,
          providerId: providerId ?? undefined,
        }),
        providers.length ? Promise.resolve({ providers }) : getAdminProviders(token),
      ]);
      setModels(modelsRes.models);
      setDefaultModelId(modelsRes.defaultModelId);
      if (!providers.length) setProviders(providersRes.providers);
    } catch {
      setError('Failed to load models. Tap to try again.');
    } finally {
      setLoading(false);
    }
  }, [token, query, providerId, providers]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      load();
      return;
    }
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusy((prev) => new Set(prev).add(id));
    try {
      await fn();
    } catch {
      setBanner('Update failed. Try again.');
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleEnabled = (m: AdminModel) =>
    withBusy(m.id, async () => {
      if (!token) return;
      await updateAdminModel(token, { id: m.id, enabled: !m.enabled });
      setModels((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, enabled: !m.enabled } : x)),
      );
    });

  const toggleTools = (m: AdminModel) =>
    withBusy(m.id, async () => {
      if (!token) return;
      await updateAdminModel(token, { id: m.id, hasToolCalling: !m.hasToolCalling });
      setModels((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, hasToolCalling: !m.hasToolCalling } : x)),
      );
    });

  const makeDefault = (m: AdminModel) =>
    withBusy(m.id, async () => {
      if (!token) return;
      const res = await updateAdminModel(token, { id: m.id, default: true });
      setDefaultModelId(res.defaultModelId ?? m.id);
    });

  const runSync = async () => {
    if (!token) return;
    setSyncing(true);
    setBanner(null);
    try {
      const res = await syncAdminModels(token);
      setBanner(`Synced ${res.synced} model${res.synced === 1 ? '' : 's'}.`);
      await load();
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <Pressable
        style={styles.centered}
        onPress={() => {
          setLoading(true);
          load();
        }}>
        <Text style={[styles.muted, { color: theme.destructive }]}>{error}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            <Search color={theme.textSecondary} size={18} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search models…"
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.text }]}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
          <Pressable
            onPress={runSync}
            disabled={syncing}
            accessibilityRole="button"
            accessibilityLabel="Sync OpenRouter catalog"
            style={[styles.syncBtn, { backgroundColor: theme.primary, opacity: syncing ? 0.6 : 1 }]}>
            {syncing ? (
              <ActivityIndicator color={theme.primaryForeground} size="small" />
            ) : (
              <RefreshCw color={theme.primaryForeground} size={18} />
            )}
          </Pressable>
        </View>

        {providers.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}>
            {[{ id: null, name: 'All' }, ...providers].map((p) => {
              const active = providerId === p.id;
              return (
                <Pressable
                  key={p.id ?? 'all'}
                  onPress={() => setProviderId(p.id)}
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
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {banner ? (
          <Text style={[styles.banner, { color: theme.textSecondary }]}>{banner}</Text>
        ) : null}
      </View>

      <FlatList
        data={models}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={models.length ? styles.list : styles.emptyWrap}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={load} tintColor={theme.accent} />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <EmptyState
              icon={query || providerId ? Search : Boxes}
              title={query || providerId ? 'No results' : 'No models'}
              subtitle={
                query || providerId
                  ? 'No models match your filter.'
                  : 'Sync the OpenRouter catalog to populate models.'
              }
            />
          </View>
        }
        ItemSeparatorComponent={() => (
          <View style={[styles.sep, { backgroundColor: theme.border }]} />
        )}
        renderItem={({ item }) => {
          const isDefault = item.id === defaultModelId;
          const isBusy = busy.has(item.id);
          return (
            <View style={styles.row}>
              <View style={styles.rowMain}>
                <View style={styles.rowText}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {isDefault ? (
                      <View style={[styles.tag, { backgroundColor: `${theme.accent}22` }]}>
                        <Text style={[styles.tagText, { color: theme.accent }]}>Default</Text>
                      </View>
                    ) : null}
                    {item.isFree ? (
                      <View style={[styles.tag, { backgroundColor: `${theme.success}22` }]}>
                        <Text style={[styles.tagText, { color: theme.success }]}>Free</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.llmProvider?.name ?? item.provider}
                    {item.hasVision ? ' · Vision' : ''}
                    {item.contextWindow ? ` · ${(item.contextWindow / 1000).toFixed(0)}k ctx` : ''}
                  </Text>
                </View>
                <Switch
                  value={item.enabled}
                  onValueChange={() => toggleEnabled(item)}
                  disabled={isBusy}
                  trackColor={{ false: theme.border, true: theme.accent }}
                  thumbColor={theme.accentForeground}
                  accessibilityLabel={`${item.name} enabled`}
                />
              </View>
              <View style={styles.rowActions}>
                <Pressable
                  onPress={() => makeDefault(item)}
                  disabled={isBusy || isDefault || !item.enabled}
                  accessibilityRole="button"
                  accessibilityLabel={`Set ${item.name} as default`}
                  style={[
                    styles.actionChip,
                    {
                      backgroundColor: isDefault ? `${theme.accent}22` : theme.backgroundElement,
                      borderColor: isDefault ? theme.accent : theme.border,
                      opacity: !item.enabled && !isDefault ? 0.5 : 1,
                    },
                  ]}>
                  <Star
                    color={isDefault ? theme.accent : theme.textSecondary}
                    size={14}
                    fill={isDefault ? theme.accent : 'transparent'}
                  />
                  <Text
                    style={[
                      styles.actionChipText,
                      { color: isDefault ? theme.accent : theme.textSecondary },
                    ]}>
                    Default
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => toggleTools(item)}
                  disabled={isBusy}
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.hasToolCalling }}
                  accessibilityLabel={`Tool calling for ${item.name}`}
                  style={[
                    styles.actionChip,
                    {
                      backgroundColor: item.hasToolCalling
                        ? `${theme.success}22`
                        : theme.backgroundElement,
                      borderColor: item.hasToolCalling ? theme.success : theme.border,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.actionChipText,
                      { color: item.hasToolCalling ? theme.success : theme.textSecondary },
                    ]}>
                    Tools {item.hasToolCalling ? 'on' : 'off'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    padding: Spacing.four,
  },
  muted: { fontSize: FontSize.base, textAlign: 'center' },
  toolbar: { paddingTop: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, padding: 0 },
  syncBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { paddingHorizontal: Spacing.four, gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  banner: { fontSize: FontSize.sm, paddingHorizontal: Spacing.four },
  list: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, paddingBottom: Spacing.four },
  emptyWrap: { flexGrow: 1 },
  row: { paddingVertical: Spacing.three, gap: Spacing.two },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rowText: { flex: 1, gap: Spacing.half },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, flexShrink: 1 },
  tag: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Radius.full },
  tagText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  meta: { fontSize: FontSize.xs },
  rowActions: { flexDirection: 'row', gap: Spacing.two },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  actionChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  sep: { height: StyleSheet.hairlineWidth },
});
