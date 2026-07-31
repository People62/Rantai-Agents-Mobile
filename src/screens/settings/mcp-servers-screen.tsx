/**
 * McpServersScreen — Settings → MCP Servers. List / create / edit / delete MCP
 * server configs and run tool discovery. env/header values are encrypted
 * server-side and never returned, so editing them means re-entering (leave the
 * editor empty to keep the current values).
 */
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Plus, RefreshCw, Server, Trash2, X } from 'lucide-react-native';
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

import { Button, Screen } from '@/components/ui';
import { Scrim, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import {
  ApiError,
  McpServer,
  McpServerInput,
  McpTransport,
  createMcpServer,
  deleteMcpServer,
  discoverMcpServer,
  getMcpServers,
  updateMcpServer,
} from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { SettingsStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<SettingsStackParamList, 'McpServers'>;

const TRANSPORTS: { key: McpTransport; label: string }[] = [
  { key: 'sse', label: 'SSE' },
  { key: 'streamable-http', label: 'Streamable HTTP' },
];

type Pair = { key: string; value: string };

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

function pairsToRecord(pairs: Pair[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of pairs) {
    const k = p.key.trim();
    if (k) out[k] = p.value;
  }
  return out;
}

export function McpServersScreen({ navigation }: Props) {
  const theme = useTheme();
  const { token } = useAuth();

  const [items, setItems] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [discoveringId, setDiscoveringId] = useState<string | null>(null);

  const [form, setForm] = useState<'new' | McpServer | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [transport, setTransport] = useState<McpTransport>('sse');
  const [url, setUrl] = useState('');
  const [env, setEnv] = useState<Pair[]>([]);
  const [headers, setHeaders] = useState<Pair[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<McpServer | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setItems(await getMcpServers(token));
    } catch {
      // keep existing
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
    setForm('new');
    setName('');
    setDescription('');
    setTransport('sse');
    setUrl('');
    setEnv([]);
    setHeaders([]);
    setEnabled(true);
    setFormError(null);
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={openCreate}
          hitSlop={8}
          style={{ paddingHorizontal: Spacing.two, paddingVertical: Spacing.one }}>
          <Plus color={theme.accent} size={24} />
        </Pressable>
      ),
    });
  }, [navigation, openCreate, theme]);

  function openEdit(s: McpServer) {
    setForm(s);
    setName(s.name);
    setDescription(s.description ?? '');
    setTransport((s.transport as McpTransport) ?? 'sse');
    setUrl(s.url);
    setEnv([]);
    setHeaders([]);
    setEnabled(s.enabled);
    setFormError(null);
  }

  const isEditing = form !== 'new' && form !== null;
  const canSave = name.trim() !== '' && url.trim() !== '';

  async function save() {
    if (!token || !canSave || saving) return;
    setSaving(true);
    setFormError(null);

    const envRecord = pairsToRecord(env);
    const headerRecord = pairsToRecord(headers);
    const input: McpServerInput = {
      name: name.trim(),
      description: description.trim() || null,
      transport,
      url: url.trim(),
      ...(Object.keys(envRecord).length ? { env: envRecord } : {}),
      ...(Object.keys(headerRecord).length ? { headers: headerRecord } : {}),
    };

    try {
      if (form && form !== 'new') {
        await updateMcpServer(token, form.id, { ...input, enabled });
      } else {
        await createMcpServer(token, input);
      }
      setForm(null);
      await load();
    } catch (e) {
      setFormError(apiMessage(e, 'Failed to save. Check the URL and try again.'));
    } finally {
      setSaving(false);
    }
  }

  async function discover(s: McpServer) {
    if (!token || discoveringId) return;
    setDiscoveringId(s.id);
    setBanner(null);
    try {
      const res = await discoverMcpServer(token, s.id);
      setBanner(`${s.name}: found ${res.toolCount} tool${res.toolCount === 1 ? '' : 's'}.`);
      await load();
    } catch (e) {
      setBanner(apiMessage(e, `${s.name}: discovery failed.`));
    } finally {
      setDiscoveringId(null);
    }
  }

  async function doDelete() {
    if (!token || !deleting || busy) return;
    setBusy(true);
    try {
      await deleteMcpServer(token, deleting.id);
      setItems((prev) => prev.filter((s) => s.id !== deleting.id));
      setDeleting(null);
    } catch {
      // keep dialog
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

  return (
    <Screen padded={false} edges={['bottom']}>
      {banner ? (
        <Pressable onPress={() => setBanner(null)} style={[styles.banner, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.bannerText, { color: theme.text }]}>{banner}</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(s) => s.id}
        contentContainerStyle={items.length ? styles.list : styles.emptyWrap}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Server color={theme.textSecondary} size={32} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No MCP servers</Text>
            <Text style={[styles.muted, { color: theme.textSecondary }]}>
              Connect a Model Context Protocol server to add tools.
            </Text>
            <Button label="Add server" onPress={openCreate} style={styles.emptyBtn} />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openEdit(item)}
            onLongPress={() => (item.isBuiltIn ? undefined : setDeleting(item))}
            delayLongPress={300}
            style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.rowTop}>
              <View style={[styles.rowIcon, { backgroundColor: theme.backgroundElement }]}>
                <Server color={theme.accent} size={18} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.rowUrl, { color: theme.textSecondary }]} numberOfLines={1}>
                  {item.url}
                </Text>
              </View>
              <View style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.pillText, { color: theme.textSecondary }]}>
                  {item.toolCount} tools
                </Text>
              </View>
            </View>
            <View style={styles.rowBottom}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: item.lastError ? theme.destructive : item.configured ? '#22C55E' : theme.textSecondary },
                ]}
              />
              <Text style={[styles.statusText, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.lastError
                  ? 'Connection error'
                  : item.configured
                    ? 'Configured'
                    : 'Not configured'}
                {!item.enabled ? ' · Disabled' : ''}
              </Text>
              <Pressable
                onPress={() => discover(item)}
                disabled={discoveringId === item.id}
                style={[styles.discoverBtn, { borderColor: theme.border }]}>
                {discoveringId === item.id ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <>
                    <RefreshCw color={theme.accent} size={13} />
                    <Text style={[styles.discoverText, { color: theme.accent }]}>Discover</Text>
                  </>
                )}
              </Pressable>
            </View>
          </Pressable>
        )}
      />

      {/* Create / edit form */}
      <Modal visible={!!form} transparent animationType="slide" onRequestClose={() => setForm(null)}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setForm(null)}>
            <Pressable style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={[styles.sheetTitle, { color: theme.text }]}>
                  {isEditing ? 'Edit MCP server' : 'New MCP server'}
                </Text>

                <Text style={[styles.label, { color: theme.textSecondary }]}>Name</Text>
                <TextInput value={name} onChangeText={setName} placeholder="e.g. GitHub MCP"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} />

                <Text style={[styles.label, { color: theme.textSecondary }]}>Description (optional)</Text>
                <TextInput value={description} onChangeText={setDescription} placeholder="What this server provides"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} />

                <Text style={[styles.label, { color: theme.textSecondary }]}>Transport</Text>
                <View style={styles.chipRow}>
                  {TRANSPORTS.map((t) => {
                    const on = t.key === transport;
                    return (
                      <Pressable key={t.key} onPress={() => setTransport(t.key)}
                        style={[styles.chip, { backgroundColor: on ? `${theme.accent}22` : theme.backgroundElement, borderColor: on ? theme.accent : theme.border }]}>
                        <Text style={[styles.chipText, { color: on ? theme.accent : theme.text }]}>{t.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.label, { color: theme.textSecondary }]}>Server URL</Text>
                <TextInput value={url} onChangeText={setUrl} placeholder="https://…"
                  placeholderTextColor={theme.textSecondary} autoCapitalize="none" autoCorrect={false} keyboardType="url"
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} />

                <PairEditor theme={theme} title="Environment variables" pairs={env} onChange={setEnv}
                  hint={isEditing ? 'Add to replace; leave empty to keep current' : undefined} />
                <PairEditor theme={theme} title="Headers" pairs={headers} onChange={setHeaders}
                  hint={isEditing ? 'Add to replace; leave empty to keep current' : undefined} />

                {isEditing ? (
                  <View style={styles.enabledRow}>
                    <Text style={[styles.label, { color: theme.textSecondary, marginTop: 0 }]}>Enabled</Text>
                    <Switch value={enabled} onValueChange={setEnabled}
                      trackColor={{ true: theme.accent, false: theme.border }} thumbColor="#fff" />
                  </View>
                ) : null}

                {formError ? <Text style={[styles.errorText, { color: theme.destructive }]}>{formError}</Text> : null}

                <View style={styles.formActions}>
                  <Button label="Cancel" variant="outline" onPress={() => setForm(null)} style={styles.flex} />
                  <Button label={isEditing ? 'Save' : 'Create'} onPress={save} loading={saving} disabled={!canSave} style={styles.flex} />
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete confirm */}
      <Modal visible={!!deleting} transparent animationType="fade" onRequestClose={() => setDeleting(null)}>
        <Pressable style={styles.backdrop} onPress={() => (busy ? undefined : setDeleting(null))}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.dangerIcon, { backgroundColor: `${theme.destructive}1A` }]}>
              <Trash2 color={theme.destructive} size={26} />
            </View>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>Delete server?</Text>
            <Text style={[styles.dialogMsg, { color: theme.textSecondary }]}>
              <Text style={{ color: theme.text, fontWeight: FontWeight.semibold }}>{deleting?.name}</Text>
              {' and its discovered tools will be removed.'}
            </Text>
            <View style={styles.formActions}>
              <Button label="Cancel" variant="outline" onPress={() => setDeleting(null)} disabled={busy} style={styles.flex} />
              <Button label="Delete" variant="destructive" onPress={doDelete} loading={busy} style={styles.flex} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

type Theme = ReturnType<typeof useTheme>;

function PairEditor({
  theme, title, pairs, onChange, hint,
}: {
  theme: Theme; title: string; pairs: Pair[];
  onChange: (p: Pair[]) => void; hint?: string;
}) {
  const set = (i: number, patch: Partial<Pair>) =>
    onChange(pairs.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  return (
    <View>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{title}</Text>
      {hint ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text> : null}
      {pairs.map((p, i) => (
        <View key={i} style={styles.pairRow}>
          <TextInput value={p.key} onChangeText={(v) => set(i, { key: v })} placeholder="KEY"
            placeholderTextColor={theme.textSecondary} autoCapitalize="none" autoCorrect={false}
            style={[styles.input, styles.pairInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} />
          <TextInput value={p.value} onChangeText={(v) => set(i, { value: v })} placeholder="value"
            placeholderTextColor={theme.textSecondary} autoCapitalize="none" autoCorrect={false} secureTextEntry
            style={[styles.input, styles.pairInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} />
          <Pressable onPress={() => onChange(pairs.filter((_, idx) => idx !== i))} hitSlop={6} style={styles.pairRemove}>
            <X color={theme.textSecondary} size={16} />
          </Pressable>
        </View>
      ))}
      <Pressable onPress={() => onChange([...pairs, { key: '', value: '' }])} style={styles.addPair}>
        <Plus color={theme.accent} size={14} />
        <Text style={[styles.addPairText, { color: theme.accent }]}>Add</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
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
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rowIcon: { width: 38, height: 38, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  rowUrl: { fontSize: FontSize.sm, marginTop: 1 },
  pill: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Radius.full },
  pillText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { flex: 1, fontSize: FontSize.sm },
  discoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    minWidth: 92,
    justifyContent: 'center',
  },
  discoverText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  // Form sheet
  sheetBackdrop: { flex: 1, backgroundColor: Scrim, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.four,
    maxHeight: '88%',
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: Spacing.one },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginTop: Spacing.three },
  hint: { fontSize: FontSize.xs, marginTop: 2 },
  input: {
    minHeight: 46,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: FontSize.md,
    marginTop: Spacing.one,
  },
  chipRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  chip: { flex: 1, alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  pairRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pairInput: { flex: 1 },
  pairRemove: { padding: Spacing.one },
  addPair: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.two, alignSelf: 'flex-start' },
  addPairText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  enabledRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.three },
  errorText: { fontSize: FontSize.sm, marginTop: Spacing.two },
  formActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.four },

  // Delete dialog
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
});
