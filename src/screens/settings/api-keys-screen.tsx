/**
 * ApiKeysScreen — Settings → Agent API Keys. Owner/admin can create keys scoped
 * to an assistant, copy/enable/disable/revoke them. A newly created key's full
 * secret is shown once for copying.
 */
import Clipboard from '@react-native-clipboard/clipboard';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, Copy, KeySquare, Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, EmptyState, Screen } from '@/components/ui';
import { Scrim, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import {
  Agent,
  AgentApiKey,
  ApiError,
  createAgentApiKey,
  deleteAgentApiKey,
  getAgentApiKeys,
  getAgents,
  updateAgentApiKey,
} from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { SettingsStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<SettingsStackParamList, 'ApiKeys'>;

function maskKey(k: string): string {
  if (k.length <= 14) return k;
  return `${k.slice(0, 10)}••••${k.slice(-4)}`;
}

function apiMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    try {
      return (JSON.parse(e.body) as { error?: string }).error ?? fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function ApiKeysScreen({ navigation }: Props) {
  const theme = useTheme();
  const { token } = useAuth();

  const [items, setItems] = useState<AgentApiKey[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [assistantId, setAssistantId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<AgentApiKey | null>(null);

  const [deleting, setDeleting] = useState<AgentApiKey | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [keys, agentRes] = await Promise.all([
        getAgentApiKeys(token),
        getAgents(token).catch(() => ({ assistants: [] as Agent[], defaultAssistantId: null })),
      ]);
      setItems(keys);
      setAgents(agentRes.assistants);
      setForbidden(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setForbidden(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openCreate = useCallback(() => {
    setCreateOpen(true);
    setName('');
    setAssistantId(null);
    setCreateError(null);
  }, []);

  useLayoutEffect(() => {
    if (forbidden) return;
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={openCreate}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Create API key"
          style={{ paddingHorizontal: Spacing.two, paddingVertical: Spacing.one }}>
          <Plus color={theme.accent} size={24} />
        </Pressable>
      ),
    });
  }, [navigation, openCreate, theme, forbidden]);

  function copy(value: string) {
    Clipboard.setString(value);
    setBanner('Copied to clipboard');
  }

  async function create() {
    if (!token || !name.trim() || !assistantId || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createAgentApiKey(token, { name: name.trim(), assistantId });
      setCreateOpen(false);
      setCreatedKey(created);
      await load();
    } catch (e) {
      setCreateError(apiMessage(e, 'Failed to create key. Try again.'));
    } finally {
      setCreating(false);
    }
  }

  async function toggleEnabled(key: AgentApiKey, next: boolean) {
    if (!token) return;
    setItems((prev) => prev.map((k) => (k.id === key.id ? { ...k, enabled: next } : k)));
    try {
      await updateAgentApiKey(token, key.id, { enabled: next });
    } catch {
      setItems((prev) => prev.map((k) => (k.id === key.id ? { ...k, enabled: !next } : k)));
    }
  }

  async function doDelete() {
    if (!token || !deleting || busy) return;
    setBusy(true);
    try {
      await deleteAgentApiKey(token, deleting.id);
      setItems((prev) => prev.filter((k) => k.id !== deleting.id));
      setDeleting(null);
    } catch {
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </Screen>
    );
  }

  if (forbidden) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}>
          <KeySquare color={theme.textSecondary} size={32} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Admins only</Text>
          <Text style={[styles.muted, { color: theme.textSecondary }]}>
            Only organization owners and admins can manage API keys.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['bottom']}>
      {banner ? (
        <Pressable onPress={() => setBanner(null)} style={[styles.banner, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.bannerText, { color: theme.text }]}>{banner}</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(k) => k.id}
        contentContainerStyle={items.length ? styles.list : styles.emptyWrap}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <EmptyState
              icon={KeySquare}
              title="No API keys"
              subtitle="Create a key to call an agent from your own apps."
              action={<Button label="Create key" onPress={openCreate} style={styles.emptyBtn} />}
            />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => setDeleting(item)}
            delayLongPress={300}
            style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.rowTop}>
              <View style={styles.flex}>
                <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.rowSub, { color: theme.textSecondary }]} numberOfLines={1}>
                  {item.assistant ? `${item.assistant.emoji ?? '🤖'} ${item.assistant.name}` : 'Agent'}
                  {' · '}
                  {item.requestCount} calls
                </Text>
              </View>
              <Switch
                value={item.enabled}
                onValueChange={(v) => toggleEnabled(item, v)}
                trackColor={{ true: theme.accent, false: theme.border }}
                thumbColor={theme.accentForeground}
              />
            </View>
            <Pressable
              onPress={() => copy(item.key)}
              accessibilityRole="button"
              accessibilityLabel="Copy API key"
              style={[styles.keyBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Text style={[styles.keyText, { color: theme.textSecondary }]} numberOfLines={1}>
                {maskKey(item.key)}
              </Text>
              <Copy color={theme.accent} size={15} />
            </Pressable>
          </Pressable>
        )}
      />

      {/* Create modal */}
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setCreateOpen(false)}>
            <Pressable style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>New API key</Text>

              <Text style={[styles.label, { color: theme.textSecondary }]}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Production server"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              />

              <Text style={[styles.label, { color: theme.textSecondary }]}>Assistant</Text>
              <ScrollView style={styles.agentList} keyboardShouldPersistTaps="handled">
                {agents.map((a) => {
                  const on = a.id === assistantId;
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => setAssistantId(a.id)}
                      style={({ pressed }) => [
                        styles.agentRow,
                        (on || pressed) && { backgroundColor: theme.backgroundElement },
                      ]}>
                      <Text style={styles.agentEmoji}>{a.emoji || '🤖'}</Text>
                      <Text style={[styles.agentName, { color: theme.text }]} numberOfLines={1}>
                        {a.name}
                      </Text>
                      {on ? <Check color={theme.accent} size={18} /> : null}
                    </Pressable>
                  );
                })}
                {agents.length === 0 ? (
                  <Text style={[styles.muted, { color: theme.textSecondary, padding: Spacing.three }]}>
                    No assistants yet.
                  </Text>
                ) : null}
              </ScrollView>

              {createError ? <Text style={[styles.errorText, { color: theme.destructive }]}>{createError}</Text> : null}

              <View style={styles.actions}>
                <Button label="Cancel" variant="outline" onPress={() => setCreateOpen(false)} style={styles.flex} />
                <Button label="Create" onPress={create} loading={creating} disabled={!name.trim() || !assistantId} style={styles.flex} />
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Created key reveal */}
      <Modal visible={!!createdKey} transparent animationType="fade" onRequestClose={() => setCreatedKey(null)}>
        <Pressable style={styles.backdrop} onPress={() => setCreatedKey(null)}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>API key created</Text>
            <Text style={[styles.dialogMsg, { color: theme.textSecondary }]}>
              Copy it now — for your security, store it somewhere safe.
            </Text>
            <View style={[styles.revealBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Text selectable style={[styles.revealText, { color: theme.text }]}>
                {createdKey?.key}
              </Text>
            </View>
            <View style={styles.actions}>
              <Button
                label="Copy"
                variant="outline"
                onPress={() => createdKey && copy(createdKey.key)}
                style={styles.flex}
              />
              <Button label="Done" onPress={() => setCreatedKey(null)} style={styles.flex} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Revoke confirm */}
      <Modal visible={!!deleting} transparent animationType="fade" onRequestClose={() => setDeleting(null)}>
        <Pressable style={styles.backdrop} onPress={() => (busy ? undefined : setDeleting(null))}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.dangerIcon, { backgroundColor: `${theme.destructive}1A` }]}>
              <Trash2 color={theme.destructive} size={26} />
            </View>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>Revoke key?</Text>
            <Text style={[styles.dialogMsg, { color: theme.textSecondary }]}>
              <Text style={{ color: theme.text, fontWeight: FontWeight.semibold }}>{deleting?.name}</Text>
              {' will stop working immediately.'}
            </Text>
            <View style={styles.actions}>
              <Button label="Cancel" variant="outline" onPress={() => setDeleting(null)} disabled={busy} style={styles.flex} />
              <Button label="Revoke" variant="destructive" onPress={doDelete} loading={busy} style={styles.flex} />
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
  emptyBtn: { marginTop: Spacing.three, minWidth: 180 },
  emptyWrap: { flexGrow: 1 },
  list: { padding: Spacing.four },

  banner: { padding: Spacing.three, marginHorizontal: Spacing.four, marginTop: Spacing.three, borderRadius: Radius.md },
  bannerText: { fontSize: FontSize.sm },

  row: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  rowSub: { fontSize: FontSize.sm, marginTop: 1 },
  keyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  keyText: { flex: 1, fontSize: FontSize.sm, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Create sheet
  sheetBackdrop: { flex: 1, backgroundColor: Scrim, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.four,
    maxHeight: '80%',
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: Spacing.one },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginTop: Spacing.three },
  input: {
    minHeight: 46,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: FontSize.md,
    marginTop: Spacing.one,
  },
  agentList: {
    maxHeight: 220,
    marginTop: Spacing.one,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'transparent',
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.md,
  },
  agentEmoji: { fontSize: 20 },
  agentName: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.medium },
  errorText: { fontSize: FontSize.sm, marginTop: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.four, alignSelf: 'stretch' },

  // Dialogs
  backdrop: { flex: 1, backgroundColor: Scrim, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  dialog: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  dangerIcon: { width: 56, height: 56, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  dialogTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  dialogMsg: { fontSize: FontSize.base, textAlign: 'center', lineHeight: 20 },
  revealBox: {
    alignSelf: 'stretch',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.three,
  },
  revealText: { fontSize: FontSize.sm, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
