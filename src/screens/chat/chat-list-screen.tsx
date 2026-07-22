/**
 * ChatList — list of the user's conversation history from the backend
 * (GET /api/dashboard/chat/sessions, Bearer token). Tap to open a thread.
 */
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pencil, Search, Trash2 } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import {
  ChatSessionSummary,
  deleteChatSession,
  getChatSessions,
  renameChatSession,
} from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { ChatStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatList'>;

/** Relative time, e.g. "2 minutes ago" (manual, without Intl so it's safe on Hermes). */
function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return 'just now';
  if (diff < hour) {
    const n = Math.floor(diff / minute);
    return `${n} minute${n === 1 ? '' : 's'} ago`;
  }
  if (diff < day) {
    const n = Math.floor(diff / hour);
    return `${n} hour${n === 1 ? '' : 's'} ago`;
  }
  if (diff < 7 * day) {
    const n = Math.floor(diff / day);
    return `${n} day${n === 1 ? '' : 's'} ago`;
  }
  if (diff < 30 * day) {
    const n = Math.floor(diff / (7 * day));
    return `${n} week${n === 1 ? '' : 's'} ago`;
  }
  if (diff < 365 * day) {
    const n = Math.floor(diff / (30 * day));
    return `${n} month${n === 1 ? '' : 's'} ago`;
  }
  const n = Math.floor(diff / (365 * day));
  return `${n} year${n === 1 ? '' : 's'} ago`;
}

export function ChatListScreen({ navigation }: Props) {
  const theme = useTheme();
  const { token } = useAuth();
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  /** Session whose action menu is open (long-press on an item). */
  const [selected, setSelected] = useState<ChatSessionSummary | null>(null);
  /** Session currently being renamed. */
  const [renaming, setRenaming] = useState<ChatSessionSummary | null>(null);
  const [renameText, setRenameText] = useState('');
  /** Session awaiting delete confirmation. */
  const [deleting, setDeleting] = useState<ChatSessionSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openRename() {
    if (!selected) return;
    setRenaming(selected);
    setRenameText(selected.title ?? '');
    setSelected(null);
  }

  async function submitRename() {
    const title = renameText.trim();
    if (!renaming || !token || !title || busy) return;
    setBusy(true);
    try {
      await renameChatSession(token, renaming.id, title);
      setSessions((prev) =>
        prev.map((s) => (s.id === renaming.id ? { ...s, title } : s)),
      );
      setRenaming(null);
    } catch {
      Alert.alert('Failed', 'Could not rename. Try again.');
    } finally {
      setBusy(false);
    }
  }

  /** Open the delete confirmation dialog (themed, replacing the OS Alert). */
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
      await deleteChatSession(token, deleting.id);
      setSessions((prev) => prev.filter((s) => s.id !== deleting.id));
      setDeleting(null);
    } catch {
      setDeleteError('Failed to delete. Try again.');
    } finally {
      setBusy(false);
    }
  }

  // Filter by title or last-message snippet.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        (s.title ?? '').toLowerCase().includes(q) ||
        (s.lastMessage ?? '').toLowerCase().includes(q),
    );
  }, [sessions, query]);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setSessions(await getChatSessions(token));
    } catch {
      setError('Failed to load history. Tap to try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Reload whenever the screen gains focus (e.g. returning from a thread), so
  // new conversations appear immediately without a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
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
            placeholder="Search conversations…"
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
        keyExtractor={(s) => s.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={filtered.length ? styles.list : styles.emptyWrap}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={load} tintColor={theme.accent} />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {query ? 'No results' : 'No conversations yet'}
            </Text>
            <Text style={[styles.muted, { color: theme.textSecondary }]}>
              {query
                ? `No conversations match "${query}".`
                : 'New conversations will appear here.'}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => (
          <View style={[styles.sep, { backgroundColor: theme.border }]} />
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('ChatThread', { id: item.id, title: item.title })}
            onLongPress={() => setSelected(item)}
            delayLongPress={300}
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: theme.backgroundElement },
            ]}>
            <View style={styles.rowText}>
              <View style={styles.rowTop}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {item.title || 'Untitled'}
                </Text>
              </View>
              <Text style={[styles.preview, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.lastMessage ?? 'No messages yet'}
              </Text>
              <Text style={[styles.time, { color: theme.textSecondary }]}>
                {relativeTime(item.updatedAt)}
              </Text>
            </View>
          </Pressable>
        )}
      />

      {/* Action menu (long-press on an item) */}
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sheetTitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {selected?.title || 'Untitled'}
            </Text>
            <Pressable
              onPress={openRename}
              style={({ pressed }) => [
                styles.sheetItem,
                pressed && { backgroundColor: theme.backgroundElement },
              ]}>
              <Pencil color={theme.text} size={20} />
              <Text style={[styles.sheetLabel, { color: theme.text }]}>Rename</Text>
            </Pressable>
            <Pressable
              onPress={askDelete}
              style={({ pressed }) => [
                styles.sheetItem,
                pressed && { backgroundColor: theme.backgroundElement },
              ]}>
              <Trash2 color={theme.destructive} size={20} />
              <Text style={[styles.sheetLabel, { color: theme.destructive }]}>Delete</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Rename dialog */}
      <Modal
        visible={!!renaming}
        transparent
        animationType="fade"
        onRequestClose={() => setRenaming(null)}>
        <Pressable style={styles.backdrop} onPress={() => setRenaming(null)}>
          <Pressable
            style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>Rename conversation</Text>
            <TextInput
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Conversation title"
              placeholderTextColor={theme.textSecondary}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitRename}
              style={[
                styles.dialogInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
            />
            <View style={styles.dialogActions}>
              <Button
                label="Cancel"
                variant="outline"
                onPress={() => setRenaming(null)}
                style={styles.dialogBtn}
              />
              <Button
                label="Save"
                onPress={submitRename}
                loading={busy}
                style={styles.dialogBtn}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete confirmation dialog */}
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
              Delete conversation?
            </Text>
            <Text style={[styles.dialogMessage, { color: theme.textSecondary }]}>
              <Text style={{ color: theme.text, fontWeight: FontWeight.semibold }}>
                {deleting?.title || 'Untitled'}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: 12,
    // backgroundColor: 'red'
  },
  rowText: { flex: 1, gap: 2, marginHorizontal: Spacing.two },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, flex: 1 },
  time: { fontSize: FontSize.xs },
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
  dialogMessage: {
    fontSize: FontSize.base,
    textAlign: 'center',
    lineHeight: 20,
  },
  dialogError: { fontSize: FontSize.sm, textAlign: 'center' },
  dialogInput: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
    fontSize: FontSize.md,
  },
  dialogActions: { flexDirection: 'row', gap: Spacing.two },
  dialogBtn: { flex: 1 },
});
