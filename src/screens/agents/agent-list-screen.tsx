/**
 * AgentList — the user's agents (assistants) from the backend
 * (GET /api/mobile/assistants, Bearer token). Tap to edit; long-press for
 * actions (Duplicate / Set as Default / Delete). "+" in the header creates one.
 */
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Copy, Pencil, Search, Star, Trash2 } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { Button, Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import {
  Agent,
  deleteAgent,
  duplicateAgent,
  getAgents,
  setDefaultAgent,
} from '@/lib/api';
import { AGENT_TEMPLATES, templateToInput } from '@/lib/agent-templates';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { AgentStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AgentStackParamList, 'AgentList'>;

export function AgentListScreen({ navigation }: Props) {
  const theme = useTheme();
  const { token } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState<Agent | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const { assistants, defaultAssistantId } = await getAgents(token);
      setAgents(assistants);
      setDefaultId(defaultAssistantId);
    } catch {
      setError('Failed to load agents. Tap to try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function edit() {
    if (!selected) return;
    const id = selected.id;
    setSelected(null);
    navigation.navigate('AgentEditor', { id });
  }

  async function doDuplicate() {
    if (!selected || !token || busy) return;
    const source = selected;
    setSelected(null);
    setBusy(true);
    try {
      const copy = await duplicateAgent(token, source.id);
      setAgents((prev) => [copy, ...prev]);
    } catch {
      Alert.alert('Failed', 'Could not duplicate the agent. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function makeDefault() {
    if (!selected || !token || busy) return;
    const target = selected;
    setSelected(null);
    setBusy(true);
    try {
      await setDefaultAgent(token, target.id);
      setDefaultId(target.id);
    } catch {
      Alert.alert('Failed', 'Could not set the default agent. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function askDelete() {
    if (!selected) return;
    setDeleting(selected);
    setDeleteError(null);
    setSelected(null);
  }

  async function doDelete() {
    if (!deleting || !token || busy) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteAgent(token, deleting.id);
      setAgents((prev) => prev.filter((a) => a.id !== deleting.id));
      setDeleting(null);
    } catch {
      setDeleteError('Failed to delete. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.description ?? '').toLowerCase().includes(q),
    );
  }, [agents, query]);

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
            placeholder="Search agents…"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(a) => a.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={filtered.length ? styles.list : styles.emptyWrap}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={load} tintColor={theme.accent} />
        }
        ListHeaderComponent={
          query ? null : (
            <View style={styles.galleryWrap}>
              <Text style={[styles.galleryTitle, { color: theme.textSecondary }]}>
                Start from a template
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.gallery}>
                {AGENT_TEMPLATES.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() =>
                      navigation.navigate('AgentEditor', { template: templateToInput(t) })
                    }
                    style={({ pressed }) => [
                      styles.tplCard,
                      { backgroundColor: theme.card, borderColor: theme.border },
                      pressed && { backgroundColor: theme.backgroundElement },
                    ]}>
                    <Text style={styles.tplEmoji}>{t.emoji}</Text>
                    <Text style={[styles.tplName, { color: theme.text }]} numberOfLines={1}>
                      {t.name}
                    </Text>
                    <Text
                      style={[styles.tplDesc, { color: theme.textSecondary }]}
                      numberOfLines={3}>
                      {t.description}
                    </Text>
                    <View style={styles.tplTags}>
                      {t.tags.slice(0, 2).map((tag) => (
                        <View
                          key={tag}
                          style={[styles.tplTag, { backgroundColor: theme.backgroundElement }]}>
                          <Text style={[styles.tplTagText, { color: theme.textSecondary }]}>
                            {tag}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {query ? 'No results' : 'No agents yet'}
            </Text>
            <Text style={[styles.muted, { color: theme.textSecondary }]}>
              {query
                ? `No agents match "${query}".`
                : 'Create your first agent with the + button.'}
            </Text>
            {!query ? (
              <Button
                label="Create agent"
                onPress={() => navigation.navigate('AgentEditor')}
                style={styles.emptyBtn}
              />
            ) : null}
          </View>
        }
        ItemSeparatorComponent={() => (
          <View style={[styles.sep, { backgroundColor: theme.border }]} />
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('AgentEditor', { id: item.id })}
            onLongPress={() => setSelected(item)}
            delayLongPress={300}
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: theme.backgroundElement },
            ]}>
            <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
              <Text style={styles.avatarEmoji}>{item.emoji || '🤖'}</Text>
            </View>
            <View style={styles.rowText}>
              <View style={styles.rowTop}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.id === defaultId ? (
                  <View style={[styles.badge, { backgroundColor: `${theme.accent}22` }]}>
                    <Star color={theme.accent} size={11} fill={theme.accent} />
                    <Text style={[styles.badgeText, { color: theme.accent }]}>Default</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.preview, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.description?.trim() || item.model}
              </Text>
            </View>
          </Pressable>
        )}
      />

      {/* Action menu (long-press) */}
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sheetTitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {selected?.name}
            </Text>
            <Pressable
              onPress={edit}
              style={({ pressed }) => [
                styles.sheetItem,
                pressed && { backgroundColor: theme.backgroundElement },
              ]}>
              <Pencil color={theme.text} size={20} />
              <Text style={[styles.sheetLabel, { color: theme.text }]}>Edit</Text>
            </Pressable>
            <Pressable
              onPress={doDuplicate}
              style={({ pressed }) => [
                styles.sheetItem,
                pressed && { backgroundColor: theme.backgroundElement },
              ]}>
              <Copy color={theme.text} size={20} />
              <Text style={[styles.sheetLabel, { color: theme.text }]}>Duplicate</Text>
            </Pressable>
            {selected && selected.id !== defaultId ? (
              <Pressable
                onPress={makeDefault}
                style={({ pressed }) => [
                  styles.sheetItem,
                  pressed && { backgroundColor: theme.backgroundElement },
                ]}>
                <Star color={theme.text} size={20} />
                <Text style={[styles.sheetLabel, { color: theme.text }]}>Set as Default</Text>
              </Pressable>
            ) : null}
            {selected && !selected.isBuiltIn ? (
              <Pressable
                onPress={askDelete}
                style={({ pressed }) => [
                  styles.sheetItem,
                  pressed && { backgroundColor: theme.backgroundElement },
                ]}>
                <Trash2 color={theme.destructive} size={20} />
                <Text style={[styles.sheetLabel, { color: theme.destructive }]}>Delete</Text>
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        visible={!!deleting}
        transparent
        animationType="fade"
        onRequestClose={() => (busy ? undefined : setDeleting(null))}>
        <Pressable
          style={styles.backdrop}
          onPress={() => (busy ? undefined : setDeleting(null))}>
          <Pressable
            style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.dangerIcon, { backgroundColor: `${theme.destructive}1A` }]}>
              <Trash2 color={theme.destructive} size={26} />
            </View>
            <Text style={[styles.dialogTitle, styles.textCenter, { color: theme.text }]}>
              Delete agent?
            </Text>
            <Text style={[styles.dialogMessage, { color: theme.textSecondary }]}>
              <Text style={{ color: theme.text, fontWeight: FontWeight.semibold }}>
                {deleting?.name}
              </Text>
              {' will be permanently deleted. This action cannot be undone.'}
            </Text>
            {deleteError ? (
              <Text style={[styles.dialogError, { color: theme.destructive }]}>{deleteError}</Text>
            ) : null}
            <View style={styles.dialogActions}>
              <Button
                label="Cancel"
                variant="outline"
                onPress={() => setDeleting(null)}
                disabled={busy}
                style={styles.dialogBtn}
              />
              <Button
                label="Delete"
                variant="destructive"
                onPress={doDelete}
                loading={busy}
                style={styles.dialogBtn}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.one, padding: Spacing.four },
  emptyWrap: { flexGrow: 1 },
  emptyBtn: { marginTop: Spacing.three, minWidth: 180 },
  searchWrap: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.two },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, padding: 0 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  muted: { fontSize: FontSize.base, textAlign: 'center' },
  list: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two },

  // --- Template gallery ---
  galleryWrap: { marginBottom: Spacing.three, marginHorizontal: -Spacing.four },
  galleryTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  gallery: { paddingHorizontal: Spacing.four, gap: Spacing.three },
  tplCard: {
    width: 200,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.three,
    gap: 6,
  },
  tplEmoji: { fontSize: 26 },
  tplName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  tplDesc: { fontSize: FontSize.sm, lineHeight: 18, minHeight: 54 },
  tplTags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, marginTop: 2 },
  tplTag: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Radius.full },
  tplTagText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 22 },
  rowText: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, flexShrink: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  preview: { fontSize: FontSize.base },
  sep: { height: StyleSheet.hairlineWidth },

  // --- Modal ---
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingVertical: Spacing.two,
  },
  sheetTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  sheetLabel: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
  dialog: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  dialogTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  textCenter: { textAlign: 'center' },
  dangerIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  dialogMessage: { fontSize: FontSize.base, textAlign: 'center', lineHeight: 20 },
  dialogError: { fontSize: FontSize.sm, textAlign: 'center' },
  dialogActions: { flexDirection: 'row', gap: Spacing.two },
  dialogBtn: { flex: 1 },
});
