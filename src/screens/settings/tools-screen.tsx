/**
 * ToolsScreen — Settings → Tools. Lists built-in tools (read-only) and the
 * org's custom HTTP tools (create / edit / enable / delete). Custom tools are
 * defined by an HTTP executionConfig plus an optional JSON-Schema `parameters`.
 */
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Plus, Trash2, Wrench, X } from 'lucide-react-native';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
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
  AgentTool,
  ApiError,
  createTool,
  deleteTool,
  getTools,
  updateTool,
} from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { SettingsStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Tools'>;

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
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

const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'tool';

export function ToolsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { token } = useAuth();

  const [items, setItems] = useState<AgentTool[]>([]);
  const [loading, setLoading] = useState(true);

  // Form (custom tools only). null = closed, 'new' = create, AgentTool = edit.
  const [form, setForm] = useState<'new' | AgentTool | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('POST');
  const [headers, setHeaders] = useState<Pair[]>([]);
  const [paramsJson, setParamsJson] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<AgentTool | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setItems(await getTools(token));
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

  const { custom, builtIn } = useMemo(() => {
    const c: AgentTool[] = [];
    const b: AgentTool[] = [];
    for (const t of items) (t.isBuiltIn ? b : c).push(t);
    return { custom: c, builtIn: b };
  }, [items]);

  const openCreate = useCallback(() => {
    setForm('new');
    setDisplayName('');
    setDescription('');
    setUrl('');
    setMethod('POST');
    setHeaders([]);
    setParamsJson('');
    setFormError(null);
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={openCreate} hitSlop={8} style={{ paddingHorizontal: Spacing.two, paddingVertical: Spacing.one }}>
          <Plus color={theme.accent} size={24} />
        </Pressable>
      ),
    });
  }, [navigation, openCreate, theme]);

  function openEdit(t: AgentTool) {
    // Built-in tools are read-only.
    if (t.isBuiltIn) return;
    setForm(t);
    setDisplayName(t.displayName);
    setDescription(t.description);
    setUrl('');
    setMethod('POST');
    setHeaders([]);
    setParamsJson('');
    setFormError(null);
  }

  const isEditing = form !== 'new' && form !== null;
  const canSave = isEditing
    ? displayName.trim() !== ''
    : displayName.trim() !== '' && description.trim() !== '' && url.trim() !== '';

  async function save() {
    if (!token || !canSave || saving) return;
    setSaving(true);
    setFormError(null);

    // Parse the optional JSON-Schema parameters.
    let parameters: object | undefined;
    if (paramsJson.trim()) {
      try {
        parameters = JSON.parse(paramsJson);
      } catch {
        setFormError('Parameters must be valid JSON.');
        setSaving(false);
        return;
      }
    }

    try {
      if (form && form !== 'new') {
        await updateTool(token, form.id, {
          displayName: displayName.trim(),
          description: description.trim(),
        });
      } else {
        const headerRecord: Record<string, string> = {};
        for (const h of headers) {
          const k = h.key.trim();
          if (k) headerRecord[k] = h.value;
        }
        await createTool(token, {
          name: slugify(displayName),
          displayName: displayName.trim(),
          description: description.trim(),
          ...(parameters ? { parameters } : {}),
          executionConfig: {
            url: url.trim(),
            method,
            ...(Object.keys(headerRecord).length ? { headers: headerRecord } : {}),
          },
        });
      }
      setForm(null);
      await load();
    } catch (e) {
      setFormError(apiMessage(e, 'Failed to save. Try again.'));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(t: AgentTool, next: boolean) {
    if (!token) return;
    setItems((prev) => prev.map((x) => (x.id === t.id ? { ...x, enabled: next } : x)));
    try {
      await updateTool(token, t.id, { enabled: next });
    } catch {
      setItems((prev) => prev.map((x) => (x.id === t.id ? { ...x, enabled: !next } : x)));
    }
  }

  async function doDelete() {
    if (!token || !deleting || busy) return;
    setBusy(true);
    try {
      await deleteTool(token, deleting.id);
      setItems((prev) => prev.filter((x) => x.id !== deleting.id));
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
        <View style={styles.centered}><ActivityIndicator color={theme.accent} /></View>
      </Screen>
    );
  }

  const renderTool = (item: AgentTool) => (
    <Pressable
      onPress={() => openEdit(item)}
      onLongPress={() => (item.isBuiltIn ? undefined : setDeleting(item))}
      delayLongPress={300}
      style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: theme.backgroundElement }]}>
        <Wrench color={theme.accent} size={16} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>{item.displayName}</Text>
        {item.description ? (
          <Text style={[styles.rowDesc, { color: theme.textSecondary }]} numberOfLines={1}>{item.description}</Text>
        ) : null}
      </View>
      {item.isBuiltIn ? (
        <View style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.pillText, { color: theme.textSecondary }]}>Built-in</Text>
        </View>
      ) : (
        <Switch value={item.enabled ?? true} onValueChange={(v) => toggle(item, v)}
          trackColor={{ true: theme.accent, false: theme.border }} thumbColor="#fff" />
      )}
    </Pressable>
  );

  return (
    <Screen padded={false} edges={['bottom']}>
      <FlatList
        data={custom}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
        ListHeaderComponent={
          custom.length ? (
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Custom</Text>
          ) : (
            <View style={styles.emptyCustom}>
              <Text style={[styles.muted, { color: theme.textSecondary }]}>
                No custom tools yet. Tap + to add an HTTP tool.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => renderTool(item)}
        ListFooterComponent={
          builtIn.length ? (
            <View>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: Spacing.four }]}>
                Built-in
              </Text>
              <View style={{ gap: Spacing.two }}>{builtIn.map((t) => <View key={t.id}>{renderTool(t)}</View>)}</View>
            </View>
          ) : null
        }
      />

      {/* Form */}
      <Modal visible={!!form} transparent animationType="slide" onRequestClose={() => setForm(null)}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setForm(null)}>
            <Pressable style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={[styles.sheetTitle, { color: theme.text }]}>
                  {isEditing ? 'Edit tool' : 'New HTTP tool'}
                </Text>

                <Text style={[styles.label, { color: theme.textSecondary }]}>Name</Text>
                <TextInput value={displayName} onChangeText={setDisplayName} placeholder="e.g. Lookup order"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} />

                <Text style={[styles.label, { color: theme.textSecondary }]}>Description</Text>
                <TextInput value={description} onChangeText={setDescription} placeholder="What the tool does (the agent reads this)"
                  placeholderTextColor={theme.textSecondary} multiline
                  style={[styles.input, styles.textarea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} />

                {!isEditing ? (
                  <>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Method</Text>
                    <View style={styles.chipRow}>
                      {METHODS.map((m) => {
                        const on = m === method;
                        return (
                          <Pressable key={m} onPress={() => setMethod(m)}
                            style={[styles.chip, { backgroundColor: on ? `${theme.accent}22` : theme.backgroundElement, borderColor: on ? theme.accent : theme.border }]}>
                            <Text style={[styles.chipText, { color: on ? theme.accent : theme.text }]}>{m}</Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text style={[styles.label, { color: theme.textSecondary }]}>Endpoint URL</Text>
                    <TextInput value={url} onChangeText={setUrl} placeholder="https://api.example.com/…"
                      placeholderTextColor={theme.textSecondary} autoCapitalize="none" autoCorrect={false} keyboardType="url"
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} />

                    <Text style={[styles.label, { color: theme.textSecondary }]}>Headers</Text>
                    {headers.map((h, i) => (
                      <View key={i} style={styles.pairRow}>
                        <TextInput value={h.key} onChangeText={(v) => setHeaders((p) => p.map((x, idx) => idx === i ? { ...x, key: v } : x))}
                          placeholder="Header" placeholderTextColor={theme.textSecondary} autoCapitalize="none"
                          style={[styles.input, styles.pairInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} />
                        <TextInput value={h.value} onChangeText={(v) => setHeaders((p) => p.map((x, idx) => idx === i ? { ...x, value: v } : x))}
                          placeholder="value" placeholderTextColor={theme.textSecondary} autoCapitalize="none"
                          style={[styles.input, styles.pairInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} />
                        <Pressable onPress={() => setHeaders((p) => p.filter((_, idx) => idx !== i))} hitSlop={6} style={styles.pairRemove}>
                          <X color={theme.textSecondary} size={16} />
                        </Pressable>
                      </View>
                    ))}
                    <Pressable onPress={() => setHeaders((p) => [...p, { key: '', value: '' }])} style={styles.addPair}>
                      <Plus color={theme.accent} size={14} />
                      <Text style={[styles.addPairText, { color: theme.accent }]}>Add header</Text>
                    </Pressable>

                    <Text style={[styles.label, { color: theme.textSecondary }]}>Parameters (JSON Schema, optional)</Text>
                    <TextInput value={paramsJson} onChangeText={setParamsJson}
                      placeholder={'{ "type": "object", "properties": { … } }'}
                      placeholderTextColor={theme.textSecondary} autoCapitalize="none" autoCorrect={false} multiline
                      style={[styles.input, styles.textarea, styles.mono, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} />
                  </>
                ) : null}

                {formError ? <Text style={[styles.errorText, { color: theme.destructive }]}>{formError}</Text> : null}
                <View style={styles.actions}>
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
            <Text style={[styles.dialogTitle, { color: theme.text }]}>Delete tool?</Text>
            <Text style={[styles.dialogMsg, { color: theme.textSecondary }]}>
              <Text style={{ color: theme.text, fontWeight: FontWeight.semibold }}>{deleting?.displayName}</Text>
              {' will be removed from agents using it.'}
            </Text>
            <View style={styles.actions}>
              <Button label="Cancel" variant="outline" onPress={() => setDeleting(null)} disabled={busy} style={styles.flex} />
              <Button label="Delete" variant="destructive" onPress={doDelete} loading={busy} style={styles.flex} />
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
  list: { padding: Spacing.four },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.two },
  emptyCustom: { paddingVertical: Spacing.four },

  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: Spacing.three },
  rowIcon: { width: 36, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  rowDesc: { fontSize: FontSize.sm, marginTop: 1 },
  pill: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Radius.full },
  pillText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  sheetBackdrop: { flex: 1, backgroundColor: Scrim, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2, padding: Spacing.four, maxHeight: '90%',
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: Spacing.one },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginTop: Spacing.three },
  input: {
    minHeight: 46, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: FontSize.md, marginTop: Spacing.one,
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: FontSize.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  pairRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pairInput: { flex: 1 },
  pairRemove: { padding: Spacing.one },
  addPair: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.two, alignSelf: 'flex-start' },
  addPairText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  errorText: { fontSize: FontSize.sm, marginTop: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.four },

  backdrop: { flex: 1, backgroundColor: Scrim, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  dialog: {
    width: '100%', maxWidth: 360, borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.four, gap: Spacing.three, alignItems: 'center',
  },
  dangerIcon: { width: 56, height: 56, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  dialogTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  dialogMsg: { fontSize: FontSize.base, textAlign: 'center', lineHeight: 20 },
});
