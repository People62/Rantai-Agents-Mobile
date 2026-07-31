/**
 * Marketplace — browse the curated catalog (assistants, skills, tools, MCP,
 * workflows) and install/uninstall into the org. Installing an assistant or
 * workflow deep-links into its editor; tools/skills toggle in place (and then
 * appear in the Agent Builder → Tools/Skills tabs).
 *
 * There is no publish/review/rating flow on the backend — this is consume-only.
 */
import type { DrawerScreenProps } from '@react-navigation/drawer';
import {
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  ListFilter,
  Search,
  Server,
  SlidersHorizontal,
  Sparkles,
  Workflow as WorkflowIcon,
  Wrench,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Screen } from '@/components/ui';
import { Scrim, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import {
  MarketplaceItem,
  MarketplaceItemDetail,
  MarketplaceType,
  getMarketplaceItem,
  getMarketplaceItems,
  installMarketplaceItem,
  marketplaceAssistantToInput,
  uninstallMarketplaceItem,
} from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { DrawerParamList } from '@/navigation/types';

type Props = DrawerScreenProps<DrawerParamList, 'Marketplace'>;

type TabKey = 'all' | MarketplaceType;
type SortKey = 'featured' | 'az' | 'installed';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'assistant', label: 'Assistants' },
  { key: 'skill', label: 'Skills' },
  { key: 'tool', label: 'Tools' },
  { key: 'mcp', label: 'MCP' },
  { key: 'workflow', label: 'Workflows' },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'featured', label: 'Featured' },
  { key: 'az', label: 'A–Z' },
  { key: 'installed', label: 'Installed first' },
];

const TYPE_ICON: Record<MarketplaceType, typeof Bot> = {
  assistant: Bot,
  skill: Sparkles,
  tool: Wrench,
  mcp: Server,
  workflow: WorkflowIcon,
};
const TYPE_LABEL: Record<MarketplaceType, string> = {
  assistant: 'Assistant',
  skill: 'Skill',
  tool: 'Tool',
  mcp: 'MCP',
  workflow: 'Workflow',
};

/** Whether an item needs config we don't collect on mobile yet (Fase 1.5). */
function needsConfig(item: MarketplaceItem): boolean {
  return !!item.configSchema && Object.keys(item.configSchema).length > 0;
}

export function MarketplaceScreen({ navigation }: Props) {
  const theme = useTheme();
  const { token } = useAuth();

  const [tab, setTab] = useState<TabKey>('all');
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('featured');
  const [sortOpen, setSortOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [selected, setSelected] = useState<MarketplaceItem | null>(null);
  const [detail, setDetail] = useState<MarketplaceItemDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const { items: list, categories: cats } = await getMarketplaceItems(token, {
        type: tab === 'all' ? undefined : tab,
        category: category ?? undefined,
      });
      setItems(list);
      setCategories(cats);
    } catch {
      setError('Failed to load the marketplace. Tap to retry.');
    } finally {
      setLoading(false);
    }
  }, [token, tab, category]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Category chips only make sense within a single type; reset when tab changes.
  useEffect(() => {
    setCategory(null);
  }, [tab]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items;
    if (q) {
      list = list.filter(
        (m) =>
          m.displayName.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (sort === 'az') {
      list = [...list].sort((a, b) => a.displayName.localeCompare(b.displayName));
    } else if (sort === 'installed') {
      list = [...list].sort((a, b) => Number(b.installed) - Number(a.installed));
    }
    // 'featured' keeps the server order (featured-first).
    return list;
  }, [items, query, sort]);

  /** Optimistically patch one item's install state in the list + detail. */
  const patch = useCallback((id: string, next: Partial<MarketplaceItem>) => {
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...next } : m)));
    setDetail((prev) => (prev && prev.id === id ? { ...prev, ...next } : prev));
    setSelected((prev) => (prev && prev.id === id ? { ...prev, ...next } : prev));
  }, []);

  const openDetail = useCallback(
    async (item: MarketplaceItem) => {
      setSelected(item);
      setDetail(null);
      if (!token) return;
      setDetailLoading(true);
      try {
        setDetail(await getMarketplaceItem(token, item.id));
      } catch {
        // Fall back to the list data already shown.
      } finally {
        setDetailLoading(false);
      }
    },
    [token],
  );

  const act = useCallback(
    async (item: MarketplaceItem) => {
      if (!token || busyId) return;

      // Assistant "Use Template" → open the agent builder pre-filled (unsaved);
      // Save there creates the agent. Nothing is installed/cloned yet.
      if (item.type === 'assistant') {
        setBusyId(item.id);
        try {
          let tmpl =
            detail && detail.id === item.id ? detail.assistantTemplate : undefined;
          if (!tmpl) tmpl = (await getMarketplaceItem(token, item.id)).assistantTemplate;
          if (!tmpl) {
            setError('Template data unavailable for this item.');
            return;
          }
          setSelected(null);
          navigation.navigate('AgentBuilder', {
            screen: 'AgentEditor',
            params: { template: marketplaceAssistantToInput(tmpl) },
          });
        } catch {
          setError('Failed to open the template. Try again.');
        } finally {
          setBusyId(null);
        }
        return;
      }

      // Workflow "Use Template" → install (clone) then open the workflow.
      if (item.type === 'workflow') {
        setBusyId(item.id);
        try {
          const res = await installMarketplaceItem(token, item.id);
          if (!res.success) {
            setError(res.error || 'Install failed.');
            return;
          }
          patch(item.id, { installed: true, installedId: res.installedId });
          if (res.installedId) {
            setSelected(null);
            navigation.navigate('Workflows', {
              screen: 'WorkflowDetail',
              params: { id: res.installedId, name: item.displayName },
            });
          }
        } catch {
          setError('Failed to install. Try again.');
        } finally {
          setBusyId(null);
        }
        return;
      }

      // Tools/skills/mcp installed → uninstall (built-ins are locked).
      if (item.installed && !item.isBuiltIn) {
        setBusyId(item.id);
        try {
          await uninstallMarketplaceItem(token, item.id);
          patch(item.id, { installed: false, installedId: undefined, skillId: undefined });
        } catch {
          setError('Failed to uninstall. Try again.');
        } finally {
          setBusyId(null);
        }
        return;
      }

      // Tools/skills/mcp → install.
      setBusyId(item.id);
      try {
        const res = await installMarketplaceItem(token, item.id);
        if (!res.success) {
          setError(res.error || 'Install failed.');
          return;
        }
        patch(item.id, {
          installed: true,
          installedId: res.installedId,
          skillId: res.skillId,
        });
      } catch {
        setError('Failed to install. Try again.');
      } finally {
        setBusyId(null);
      }
    },
    [token, busyId, patch, detail, navigation],
  );

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
      {/* Type tabs */}
      <View style={[styles.tabBarWrap, { borderBottomColor: theme.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}>
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[
                  styles.tabChip,
                  { backgroundColor: active ? theme.primary : theme.backgroundElement },
                ]}>
                <Text
                  style={[
                    styles.tabChipText,
                    { color: active ? theme.primaryForeground : theme.text },
                  ]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Search + sort */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Search color={theme.textSecondary} size={16} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search the marketplace…"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
        <Pressable
          onPress={() => setSortOpen(true)}
          style={[styles.sortBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <SlidersHorizontal color={theme.text} size={18} />
        </Pressable>
      </View>

      {/* Category filter — a single-select dropdown, visually subordinate to the
          type tabs so the two filter axes read as different (primary nav vs.
          secondary refinement) instead of two identical horizontal scrollers. */}
      {categories.length ? (
        <View style={styles.catRow}>
          <Pressable
            onPress={() => setCatOpen(true)}
            style={[
              styles.catSelect,
              {
                backgroundColor: category ? `${theme.accent}14` : theme.backgroundElement,
                borderColor: category ? theme.accent : theme.border,
              },
            ]}>
            <ListFilter color={category ? theme.accent : theme.textSecondary} size={16} />
            <Text
              style={[styles.catSelectText, { color: category ? theme.accent : theme.text }]}
              numberOfLines={1}>
              {category ?? 'All categories'}
            </Text>
            <ChevronDown color={category ? theme.accent : theme.textSecondary} size={16} />
          </Pressable>
          {category ? (
            <Pressable onPress={() => setCategory(null)} hitSlop={8} style={styles.catClear}>
              <X color={theme.textSecondary} size={16} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <FlatList
        data={visible}
        keyExtractor={(m) => m.id}
        contentContainerStyle={visible.length ? styles.list : styles.emptyWrap}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={load} tintColor={theme.accent} />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            {error ? (
              <Pressable onPress={load}>
                <Text style={[styles.muted, { color: theme.destructive }]}>{error}</Text>
              </Pressable>
            ) : (
              <Text style={[styles.muted, { color: theme.textSecondary }]}>
                {query ? `No results for "${query}".` : 'Nothing here yet.'}
              </Text>
            )}
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            theme={theme}
            busy={busyId === item.id}
            onPress={() => openDetail(item)}
            onAction={() => act(item)}
          />
        )}
      />

      {/* Detail sheet */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSelected(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {selected ? (
              <DetailBody
                item={selected}
                detail={detail}
                loading={detailLoading}
                busy={busyId === selected.id}
                theme={theme}
                onClose={() => setSelected(null)}
                onAction={() => act(selected)}
              />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Sort picker */}
      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSortOpen(false)}>
          <Pressable style={[styles.menu, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.menuTitle, { color: theme.textSecondary }]}>Sort by</Text>
            {SORTS.map((s) => (
              <Pressable
                key={s.key}
                onPress={() => {
                  setSort(s.key);
                  setSortOpen(false);
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && { backgroundColor: theme.backgroundElement },
                ]}>
                <Text style={[styles.menuLabel, { color: theme.text }]}>{s.label}</Text>
                {sort === s.key ? <Check color={theme.accent} size={18} /> : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Category picker */}
      <Modal visible={catOpen} transparent animationType="slide" onRequestClose={() => setCatOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setCatOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.catSheetTitle, { color: theme.text }]}>Filter by category</Text>
            <ScrollView style={styles.catSheetList} contentContainerStyle={styles.catSheetContent}>
              <CatOption
                label="All categories"
                active={category === null}
                theme={theme}
                onPress={() => {
                  setCategory(null);
                  setCatOpen(false);
                }}
              />
              {categories.map((c) => (
                <CatOption
                  key={c}
                  label={c}
                  active={c === category}
                  theme={theme}
                  onPress={() => {
                    setCategory(c);
                    setCatOpen(false);
                  }}
                />
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

type Theme = ReturnType<typeof useTheme>;

function CatOption({
  label, active, theme, onPress,
}: { label: string; active: boolean; theme: Theme; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.catOption, pressed && { backgroundColor: theme.backgroundElement }]}>
      <Text style={[styles.catOptionText, { color: active ? theme.accent : theme.text }]}>{label}</Text>
      {active ? <Check color={theme.accent} size={18} /> : null}
    </Pressable>
  );
}

/** Action button label + state shared by card and detail. */
function actionState(item: MarketplaceItem) {
  const template = item.type === 'assistant' || item.type === 'workflow';
  if (item.isBuiltIn && item.type === 'tool')
    return { label: 'Always On', disabled: true, danger: false };
  if (template) return { label: 'Use Template', disabled: false, danger: false };
  if (item.installed) return { label: 'Remove', disabled: false, danger: true };
  if (needsConfig(item)) return { label: 'Configure on web', disabled: true, danger: false };
  return { label: 'Install', disabled: false, danger: false };
}

function ActionButton({
  item, busy, theme, onAction,
}: { item: MarketplaceItem; busy: boolean; theme: Theme; onAction: () => void }) {
  const s = actionState(item);
  const color = s.danger ? theme.destructive : theme.accent;
  return (
    <Pressable
      onPress={onAction}
      disabled={s.disabled || busy}
      style={[
        styles.actionBtn,
        {
          borderColor: s.disabled ? theme.border : color,
          backgroundColor: s.disabled ? theme.backgroundElement : 'transparent',
          opacity: busy ? 0.6 : 1,
        },
      ]}>
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Text style={[styles.actionText, { color: s.disabled ? theme.textSecondary : color }]}>
          {s.label}
        </Text>
      )}
    </Pressable>
  );
}

function ItemCard({
  item, theme, busy, onPress, onAction,
}: {
  item: MarketplaceItem; theme: Theme; busy: boolean;
  onPress: () => void; onAction: () => void;
}) {
  const Icon = TYPE_ICON[item.type];
  const community = !!(item.communitySkillName || item.communityToolName);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.cardHead}>
        <View style={[styles.cardIcon, { backgroundColor: theme.backgroundElement }]}>
          <Icon color={theme.accent} size={20} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>
            {item.displayName}
          </Text>
          <View style={styles.badgeRow}>
            <Text style={[styles.typeBadge, { color: theme.textSecondary, borderColor: theme.border }]}>
              {TYPE_LABEL[item.type]}
            </Text>
            {item.isBuiltIn ? (
              <Text style={[styles.typeBadge, { color: theme.textSecondary, borderColor: theme.border }]}>
                Built-in
              </Text>
            ) : community ? (
              <Text style={[styles.typeBadge, { color: theme.textSecondary, borderColor: theme.border }]}>
                Community
              </Text>
            ) : null}
            {item.installed ? (
              <View style={[styles.installedBadge, { backgroundColor: `${theme.accent}22` }]}>
                <Check color={theme.accent} size={11} />
                <Text style={[styles.installedText, { color: theme.accent }]}>Installed</Text>
              </View>
            ) : null}
          </View>
        </View>
        <ChevronRight color={theme.textSecondary} size={18} />
      </View>
      <Text style={[styles.cardDesc, { color: theme.textSecondary }]} numberOfLines={2}>
        {item.description}
      </Text>
      <View style={styles.cardFoot}>
        <View style={styles.tagRow}>
          {item.tags.slice(0, 3).map((t) => (
            <Text key={t} style={[styles.tag, { backgroundColor: theme.backgroundElement, color: theme.textSecondary }]}>
              {t}
            </Text>
          ))}
        </View>
        <ActionButton item={item} busy={busy} theme={theme} onAction={onAction} />
      </View>
    </Pressable>
  );
}

function DetailBody({
  item, detail, loading, busy, theme, onClose, onAction,
}: {
  item: MarketplaceItem; detail: MarketplaceItemDetail | null; loading: boolean;
  busy: boolean; theme: Theme; onClose: () => void; onAction: () => void;
}) {
  const Icon = TYPE_ICON[item.type];
  const d = detail;
  return (
    <View>
      <View style={styles.sheetHead}>
        <View style={[styles.cardIcon, { backgroundColor: theme.backgroundElement }]}>
          <Icon color={theme.accent} size={22} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.sheetName, { color: theme.text }]}>{item.displayName}</Text>
          <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>
            {TYPE_LABEL[item.type]} · {item.category}
            {d?.version ? ` · v${d.version}` : ''}
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={8}>
          <X color={theme.textSecondary} size={22} />
        </Pressable>
      </View>

      <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
        <Text style={[styles.sheetDesc, { color: theme.text }]}>{item.description}</Text>

        {item.tags.length ? (
          <View style={styles.tagRow}>
            {item.tags.map((t) => (
              <Text key={t} style={[styles.tag, { backgroundColor: theme.backgroundElement, color: theme.textSecondary }]}>
                {t}
              </Text>
            ))}
          </View>
        ) : null}

        {loading ? <ActivityIndicator color={theme.accent} style={{ marginVertical: Spacing.three }} /> : null}

        {d?.author ? (
          <Text style={[styles.metaLine, { color: theme.textSecondary }]}>By {d.author}</Text>
        ) : null}

        {d?.tools?.length ? (
          <View style={styles.detailSection}>
            <Text style={[styles.detailHead, { color: theme.textSecondary }]}>
              Included tools ({d.tools.length})
            </Text>
            {d.tools.map((t) => (
              <Text key={t.name} style={[styles.detailItem, { color: theme.text }]}>
                • {t.displayName}
              </Text>
            ))}
          </View>
        ) : null}

        {d?.skillPrompt ? (
          <View style={styles.detailSection}>
            <Text style={[styles.detailHead, { color: theme.textSecondary }]}>Skill prompt</Text>
            <Text style={[styles.promptText, { color: theme.textSecondary, borderColor: theme.border }]}>
              {d.skillPrompt}
            </Text>
          </View>
        ) : null}

        {needsConfig(item) && !item.installed ? (
          <View style={[styles.noteBox, { backgroundColor: `${theme.accent}12`, borderColor: `${theme.accent}44` }]}>
            <Text style={[styles.noteText, { color: theme.text }]}>
              This item needs configuration (e.g. an API key). Install it from the web app for now.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.sheetFoot, { borderTopColor: theme.border }]}>
        <ActionButton item={item} busy={busy} theme={theme} onAction={onAction} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  muted: { fontSize: FontSize.base, textAlign: 'center' },
  emptyWrap: { flexGrow: 1 },

  tabBarWrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  tabBar: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, gap: Spacing.two },
  tabChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
  },
  tabChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
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
  sortBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
  },
  catSelect: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  catSelectText: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.medium },
  catClear: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catSheetTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  catSheetList: { flexGrow: 0 },
  catSheetContent: { paddingBottom: Spacing.four },
  catOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  catOptionText: { fontSize: FontSize.md },

  list: { padding: Spacing.four },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: 3, flexWrap: 'wrap' },
  typeBadge: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  installedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
  },
  installedText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  cardDesc: { fontSize: FontSize.base, lineHeight: 19 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, flex: 1 },
  tag: {
    fontSize: FontSize.xs,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  actionBtn: {
    minWidth: 96,
    height: 34,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  // Detail sheet
  sheetBackdrop: { flex: 1, backgroundColor: Scrim, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    maxHeight: '85%',
    paddingTop: Spacing.three,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  sheetName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  sheetSub: { fontSize: FontSize.sm, marginTop: 2 },
  sheetScroll: { flexGrow: 0 },
  sheetContent: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.four, gap: Spacing.three },
  sheetDesc: { fontSize: FontSize.md, lineHeight: 21 },
  metaLine: { fontSize: FontSize.sm },
  detailSection: { gap: Spacing.one },
  detailHead: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  detailItem: { fontSize: FontSize.base, lineHeight: 20 },
  promptText: {
    fontSize: FontSize.sm,
    lineHeight: 19,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  noteBox: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.three,
  },
  noteText: { fontSize: FontSize.sm, lineHeight: 19 },
  sheetFoot: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    alignItems: 'flex-end',
  },

  // Menus
  backdrop: {
    flex: 1,
    backgroundColor: Scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  menu: {
    width: '100%',
    maxWidth: 320,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingVertical: Spacing.two,
  },
  menuTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  menuLabel: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
});
