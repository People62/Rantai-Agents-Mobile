/**
 * AdminKnowledgeTab — global KB/RAG configuration (GET/PUT
 * /api/mobile/admin/settings/kb). Editable: each field writes a DB override, and
 * clearing a field falls back to env/default. Changing the embedding model or
 * dimension re-embeds every document, so the backend returns 409 and we require
 * an explicit typed confirmation before retrying with confirmEmbeddingChange.
 */
import { useHeaderHeight } from '@react-navigation/elements';
import { useFocusEffect } from '@react-navigation/native';
import { Database } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

import { Button, EmptyState } from '@/components/ui';
import { Scrim, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import { ApiError, KbField, KbSettings, getKbSettings, updateKbSettings } from '@/lib/api';

type FieldType = 'text' | 'url' | 'int' | 'bool' | 'secret';

const FIELD_META: Record<string, { label: string; type: FieldType }> = {
  extractPrimary: { label: 'Primary extractor', type: 'text' },
  extractFallback: { label: 'Fallback extractor', type: 'text' },
  extractSmartFallback: { label: 'Smart fallback', type: 'text' },
  extractVisionBaseUrl: { label: 'Vision base URL', type: 'url' },
  extractVisionApiKey: { label: 'Vision API key', type: 'secret' },
  extractMineruBaseUrl: { label: 'MinerU base URL', type: 'url' },
  embeddingModel: { label: 'Embedding model', type: 'text' },
  embeddingDim: { label: 'Embedding dimension', type: 'int' },
  embeddingBaseUrl: { label: 'Embedding base URL', type: 'url' },
  embeddingApiKey: { label: 'Embedding API key', type: 'secret' },
  defaultMaxChunks: { label: 'Max chunks', type: 'int' },
  rerankEnabled: { label: 'Reranking', type: 'bool' },
  rerankModel: { label: 'Rerank model', type: 'text' },
  rerankInitialK: { label: 'Rerank initial K', type: 'int' },
  rerankFinalK: { label: 'Rerank final K', type: 'int' },
};

const GROUPS: Array<{ title: string; keys: string[] }> = [
  {
    title: 'Extraction',
    keys: [
      'extractPrimary',
      'extractFallback',
      'extractSmartFallback',
      'extractVisionBaseUrl',
      'extractVisionApiKey',
      'extractMineruBaseUrl',
    ],
  },
  {
    title: 'Embedding',
    keys: ['embeddingModel', 'embeddingDim', 'embeddingBaseUrl', 'embeddingApiKey'],
  },
  { title: 'Retrieval', keys: ['defaultMaxChunks'] },
  { title: 'Reranking', keys: ['rerankEnabled', 'rerankModel', 'rerankInitialK', 'rerankFinalK'] },
];

const SOURCE_LABEL: Record<KbField['source'], string> = {
  db: 'Custom',
  env: 'Env',
  default: 'Default',
  provider: 'Provider',
};

/** Fields locked while an embedding provider supplies the endpoint at runtime. */
const PROVIDER_LOCKED = new Set(['embeddingBaseUrl', 'embeddingApiKey']);

const CONFIRM_WORD = 'RE-EMBED';

function initialText(field: KbField): string {
  if (field.secret) return '';
  const v = field.value;
  if (v === undefined || v === null) return '';
  return String(v);
}

/** Height of the segmented control block above the form (marginTop + control). */
const SEGMENT_BLOCK = 56;

export function AdminKnowledgeTab() {
  const theme = useTheme();
  const { token } = useAuth();
  const headerHeight = useHeaderHeight();
  const [settings, setSettings] = useState<KbSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Draft edits keyed by field key. Text covers text/url/int/secret; bools its own.
  const [text, setText] = useState<Record<string, string>>({});
  const [bools, setBools] = useState<Record<string, boolean>>({});
  const [clearSecret, setClearSecret] = useState<Set<string>>(new Set());
  const [baseText, setBaseText] = useState<Record<string, string>>({});
  const [baseBools, setBaseBools] = useState<Record<string, boolean>>({});

  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmWord, setConfirmWord] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hydrate = useCallback((s: KbSettings) => {
    const t: Record<string, string> = {};
    const b: Record<string, boolean> = {};
    for (const f of s.fields) {
      const meta = FIELD_META[f.key];
      if (!meta) continue;
      if (meta.type === 'bool') b[f.key] = f.value === true;
      else t[f.key] = initialText(f);
    }
    setText(t);
    setBaseText(t);
    setBools(b);
    setBaseBools(b);
    setClearSecret(new Set());
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const s = await getKbSettings(token);
      setSettings(s);
      hydrate(s);
    } catch {
      setError('Failed to load KB settings. Tap to try again.');
    } finally {
      setLoading(false);
    }
  }, [token, hydrate]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /** Build the {updates} payload from the diff between drafts and their baseline. */
  const updates = useMemo(() => {
    const out: Record<string, unknown> = {};
    if (!settings) return out;
    for (const f of settings.fields) {
      const meta = FIELD_META[f.key];
      if (!meta) continue;
      if (meta.type === 'bool') {
        if (bools[f.key] !== baseBools[f.key]) out[f.key] = bools[f.key];
        continue;
      }
      if (meta.type === 'secret') {
        const v = (text[f.key] ?? '').trim();
        if (clearSecret.has(f.key)) out[f.key] = null;
        else if (v !== '') out[f.key] = v;
        continue;
      }
      const v = (text[f.key] ?? '').trim();
      if (v === (baseText[f.key] ?? '')) continue;
      if (v === '') out[f.key] = null;
      else if (meta.type === 'int') out[f.key] = Number(v);
      else out[f.key] = v;
    }
    return out;
  }, [settings, text, bools, baseText, baseBools, clearSecret]);

  const hasChanges = Object.keys(updates).length > 0;

  const commit = useCallback(
    async (confirmEmbeddingChange: boolean) => {
      if (!token) return;
      setSaving(true);
      setSaveError(null);
      try {
        const s = await updateKbSettings(token, updates, confirmEmbeddingChange);
        setSettings(s);
        hydrate(s);
        setConfirmOpen(false);
        setConfirmWord('');
        setBanner('Saved.');
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          setConfirmOpen(true);
          return;
        }
        if (e instanceof ApiError && e.status === 400) {
          setSaveError(safeMessage(e.body) ?? 'Invalid value.');
          setConfirmOpen(false);
        } else {
          setSaveError('Save failed. Try again.');
          setConfirmOpen(false);
        }
      } finally {
        setSaving(false);
      }
    },
    [token, updates, hydrate],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (error || !settings) {
    return (
      <Pressable
        style={styles.centered}
        onPress={() => {
          setLoading(true);
          load();
        }}>
        <Text style={[styles.muted, { color: theme.destructive }]}>{error ?? 'No settings.'}</Text>
      </Pressable>
    );
  }

  if (settings.fields.length === 0) {
    return (
      <View style={styles.centered}>
        <EmptyState icon={Database} title="No KB config" subtitle="Nothing to show." />
      </View>
    );
  }

  const byKey = new Map(settings.fields.map((f) => [f.key, f]));

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight + SEGMENT_BLOCK}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive">
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          Empty a field to fall back to its env/default value. Changing the embedding model or
          dimension re-embeds every document.
        </Text>

        {settings.embeddingProviderId ? (
          <View style={[styles.providerNote, { backgroundColor: `${theme.accent}18` }]}>
            <Text style={[styles.providerText, { color: theme.accent }]}>
              Embedding endpoint is managed by a linked provider — those fields are read-only here.
            </Text>
          </View>
        ) : null}

        {GROUPS.map((group) => {
          const rows = group.keys.map((k) => byKey.get(k)).filter(Boolean) as KbField[];
          if (!rows.length) return null;
          return (
            <View key={group.title} style={styles.group}>
              <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>{group.title}</Text>
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {rows.map((field, i) => {
                  const meta = FIELD_META[field.key];
                  const locked = field.source === 'provider' && PROVIDER_LOCKED.has(field.key);
                  return (
                    <View
                      key={field.key}
                      style={[
                        styles.fieldRow,
                        i > 0 && {
                          borderTopColor: theme.border,
                          borderTopWidth: StyleSheet.hairlineWidth,
                        },
                      ]}>
                      <View style={styles.fieldLabelRow}>
                        <Text style={[styles.fieldLabel, { color: theme.text }]}>{meta.label}</Text>
                        <View
                          style={[
                            styles.sourceTag,
                            {
                              backgroundColor:
                                field.source === 'db' || field.source === 'provider'
                                  ? `${theme.accent}22`
                                  : theme.backgroundElement,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.sourceText,
                              {
                                color:
                                  field.source === 'db' || field.source === 'provider'
                                    ? theme.accent
                                    : theme.textSecondary,
                              },
                            ]}>
                            {SOURCE_LABEL[field.source]}
                          </Text>
                        </View>
                      </View>

                      {meta.type === 'bool' ? (
                        <Switch
                          value={!!bools[field.key]}
                          onValueChange={(v) => setBools((p) => ({ ...p, [field.key]: v }))}
                          trackColor={{ false: theme.border, true: theme.accent }}
                          thumbColor={theme.accentForeground}
                          accessibilityLabel={meta.label}
                        />
                      ) : meta.type === 'secret' ? (
                        <View style={styles.secretWrap}>
                          <TextInput
                            value={clearSecret.has(field.key) ? '' : text[field.key] ?? ''}
                            editable={!clearSecret.has(field.key)}
                            onChangeText={(v) => setText((p) => ({ ...p, [field.key]: v }))}
                            placeholder={
                              clearSecret.has(field.key)
                                ? 'Will clear on save'
                                : field.set
                                  ? '•••••• set · enter to change'
                                  : 'Not set · enter a value'
                            }
                            placeholderTextColor={theme.textSecondary}
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={[
                              styles.input,
                              {
                                color: theme.text,
                                borderColor: theme.border,
                                backgroundColor: theme.background,
                                opacity: clearSecret.has(field.key) ? 0.6 : 1,
                              },
                            ]}
                          />
                          {field.set ? (
                            <Pressable
                              onPress={() =>
                                setClearSecret((p) => {
                                  const n = new Set(p);
                                  if (n.has(field.key)) n.delete(field.key);
                                  else {
                                    n.add(field.key);
                                    setText((t) => ({ ...t, [field.key]: '' }));
                                  }
                                  return n;
                                })
                              }
                              accessibilityRole="button"
                              accessibilityLabel={`Clear ${meta.label}`}
                              style={styles.clearBtn}>
                              <Text
                                style={[
                                  styles.clearText,
                                  {
                                    color: clearSecret.has(field.key)
                                      ? theme.accent
                                      : theme.textSecondary,
                                  },
                                ]}>
                                {clearSecret.has(field.key) ? 'Keep' : 'Clear'}
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ) : (
                        <TextInput
                          value={text[field.key] ?? ''}
                          editable={!locked}
                          onChangeText={(v) => setText((p) => ({ ...p, [field.key]: v }))}
                          placeholder={locked ? 'Managed by provider' : 'env / default'}
                          placeholderTextColor={theme.textSecondary}
                          keyboardType={meta.type === 'int' ? 'numeric' : 'default'}
                          autoCapitalize="none"
                          autoCorrect={false}
                          style={[
                            styles.input,
                            {
                              color: theme.text,
                              borderColor: theme.border,
                              backgroundColor: theme.background,
                              opacity: locked ? 0.6 : 1,
                            },
                          ]}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        {saveError ? (
          <Text style={[styles.saveError, { color: theme.destructive }]}>{saveError}</Text>
        ) : null}
        {banner ? <Text style={[styles.banner, { color: theme.success }]}>{banner}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
        <Button
          label="Discard"
          variant="outline"
          onPress={() => settings && hydrate(settings)}
          disabled={!hasChanges || saving}
          style={styles.flex}
        />
        <Button
          label="Save"
          onPress={() => commit(false)}
          loading={saving}
          disabled={!hasChanges}
          style={styles.flex}
        />
      </View>

      {/* Embedding re-embed confirmation */}
      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmOpen(false)}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={() => setConfirmOpen(false)}>
            <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.dialogTitle, { color: theme.text }]}>Re-embed all documents?</Text>
              <Text style={[styles.dialogMsg, { color: theme.textSecondary }]}>
                Changing the embedding model or dimension breaks retrieval for already-embedded
                documents until they are re-embedded. Type {CONFIRM_WORD} to confirm.
              </Text>
              <TextInput
                value={confirmWord}
                onChangeText={setConfirmWord}
                placeholder={CONFIRM_WORD}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
                ]}
              />
              <View style={styles.dialogActions}>
                <Button
                  label="Cancel"
                  variant="outline"
                  onPress={() => {
                    setConfirmOpen(false);
                    setConfirmWord('');
                  }}
                  style={styles.flex}
                />
                <Button
                  label="Confirm"
                  variant="destructive"
                  onPress={() => commit(true)}
                  loading={saving}
                  disabled={confirmWord.trim().toUpperCase() !== CONFIRM_WORD}
                  style={styles.flex}
                />
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/** Pull a human message out of an ApiError JSON body, if present. */
function safeMessage(body: string): string | null {
  try {
    const parsed = JSON.parse(body);
    return typeof parsed?.error === 'string' ? parsed.error : null;
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    padding: Spacing.four,
    minHeight: 240,
  },
  muted: { fontSize: FontSize.base, textAlign: 'center' },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    // Extra bottom room so a focused field near the end can scroll clear of the
    // keyboard (the sticky footer sits just below this).
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  note: { fontSize: FontSize.sm, lineHeight: 18 },
  providerNote: { padding: Spacing.three, borderRadius: Radius.md },
  providerText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, lineHeight: 18 },
  group: { gap: Spacing.two },
  groupTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: Spacing.one,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  fieldRow: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, gap: Spacing.two },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  fieldLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium, flexShrink: 1 },
  sourceTag: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Radius.full },
  sourceText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  input: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
    fontSize: FontSize.md,
  },
  secretWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  clearBtn: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
  clearText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  saveError: { fontSize: FontSize.sm },
  banner: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  footer: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Confirm dialog
  backdrop: {
    flex: 1,
    backgroundColor: Scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    padding: Spacing.four,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    gap: Spacing.two,
  },
  dialogTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  dialogMsg: { fontSize: FontSize.base, textAlign: 'center', lineHeight: 20 },
  dialogActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
});
