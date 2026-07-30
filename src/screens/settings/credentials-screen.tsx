/**
 * CredentialsScreen — Settings → Credentials. List / create / edit / delete
 * org credentials (api_key, bearer, basic_auth, oauth2). Secrets are encrypted
 * server-side and never returned, so the list is masked and editing a secret
 * means re-entering it (leave blank to keep the current value).
 */
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { KeyRound, Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import {
  ApiError,
  Credential,
  CredentialType,
  createCredential,
  deleteCredential,
  getCredentials,
  updateCredential,
} from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { SettingsStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Credentials'>;

const CRED_TYPES: { key: CredentialType; label: string }[] = [
  { key: 'api_key', label: 'API key' },
  { key: 'bearer', label: 'Bearer' },
  { key: 'basic_auth', label: 'Basic auth' },
  { key: 'oauth2', label: 'OAuth2' },
];
const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  CRED_TYPES.map((t) => [t.key, t.label]),
);

const TYPE_FIELDS: Record<CredentialType, { key: string; label: string; secure: boolean }[]> = {
  api_key: [{ key: 'apiKey', label: 'API key', secure: true }],
  bearer: [{ key: 'token', label: 'Token', secure: true }],
  basic_auth: [
    { key: 'username', label: 'Username', secure: false },
    { key: 'password', label: 'Password', secure: true },
  ],
  oauth2: [
    { key: 'clientId', label: 'Client ID', secure: false },
    { key: 'clientSecret', label: 'Client secret', secure: true },
    { key: 'accessToken', label: 'Access token', secure: true },
  ],
};

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

export function CredentialsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { token } = useAuth();

  const [items, setItems] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);

  // Form: null = closed, 'new' = create, Credential = edit.
  const [form, setForm] = useState<'new' | Credential | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<CredentialType>('api_key');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<Credential | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setItems(await getCredentials(token));
    } catch {
      // leave existing list
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
    setType('api_key');
    setFields({});
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

  function openEdit(cred: Credential) {
    setForm(cred);
    setName(cred.name);
    setType((cred.type as CredentialType) ?? 'api_key');
    setFields({});
    setFormError(null);
  }

  const isEditing = form !== 'new' && form !== null;
  const activeFields = TYPE_FIELDS[type] ?? [];
  const dataFilled = activeFields.some((f) => (fields[f.key] ?? '').trim() !== '');

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    // Create needs at least one secret; edit may keep the existing one.
    if (!isEditing && !dataFilled) return false;
    return true;
  }, [name, isEditing, dataFilled]);

  async function save() {
    if (!token || !canSave || saving) return;
    setSaving(true);
    setFormError(null);

    const data: Record<string, string> = {};
    for (const f of activeFields) {
      const v = (fields[f.key] ?? '').trim();
      if (v) data[f.key] = v;
    }

    try {
      if (form && form !== 'new') {
        await updateCredential(token, form.id, {
          name: name.trim(),
          type,
          ...(dataFilled ? { data } : {}),
        });
      } else {
        await createCredential(token, { name: name.trim(), type, data });
      }
      setForm(null);
      await load();
    } catch (e) {
      setFormError(apiMessage(e, 'Failed to save. Try again.'));
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!token || !deleting || busy) return;
    setBusy(true);
    try {
      await deleteCredential(token, deleting.id);
      setItems((prev) => prev.filter((c) => c.id !== deleting.id));
      setDeleting(null);
    } catch {
      // keep dialog open on failure
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
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        contentContainerStyle={items.length ? styles.list : styles.emptyWrap}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <KeyRound color={theme.textSecondary} size={32} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No credentials</Text>
            <Text style={[styles.muted, { color: theme.textSecondary }]}>
              Add API keys and tokens your tools can use.
            </Text>
            <Button label="Add credential" onPress={openCreate} style={styles.emptyBtn} />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openEdit(item)}
            onLongPress={() => setDeleting(item)}
            delayLongPress={300}
            style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.rowIcon, { backgroundColor: theme.backgroundElement }]}>
              <KeyRound color={theme.accent} size={18} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <View style={[styles.typePill, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.typePillText, { color: theme.textSecondary }]}>
                {TYPE_LABEL[item.type] ?? item.type}
              </Text>
            </View>
          </Pressable>
        )}
      />

      {/* Create / edit form */}
      <Modal visible={!!form} transparent animationType="slide" onRequestClose={() => setForm(null)}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setForm(null)}>
            <Pressable style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>
                {isEditing ? 'Edit credential' : 'New credential'}
              </Text>

              <Text style={[styles.label, { color: theme.textSecondary }]}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. OpenAI key"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              />

              <Text style={[styles.label, { color: theme.textSecondary }]}>Type</Text>
              <View style={styles.typeRow}>
                {CRED_TYPES.map((t) => {
                  const on = t.key === type;
                  return (
                    <Pressable
                      key={t.key}
                      onPress={() => {
                        setType(t.key);
                        setFields({});
                      }}
                      style={[
                        styles.typeChip,
                        {
                          backgroundColor: on ? `${theme.accent}22` : theme.backgroundElement,
                          borderColor: on ? theme.accent : theme.border,
                        },
                      ]}>
                      <Text style={[styles.typeChipText, { color: on ? theme.accent : theme.text }]}>
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {activeFields.map((f) => (
                <View key={f.key}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>{f.label}</Text>
                  <TextInput
                    value={fields[f.key] ?? ''}
                    onChangeText={(v) => setFields((prev) => ({ ...prev, [f.key]: v }))}
                    placeholder={isEditing ? 'Leave blank to keep current' : f.label}
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry={f.secure}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                  />
                </View>
              ))}

              {formError ? (
                <Text style={[styles.errorText, { color: theme.destructive }]}>{formError}</Text>
              ) : null}

              <View style={styles.formActions}>
                <Button label="Cancel" variant="outline" onPress={() => setForm(null)} style={styles.flex} />
                <Button
                  label={isEditing ? 'Save' : 'Create'}
                  onPress={save}
                  loading={saving}
                  disabled={!canSave}
                  style={styles.flex}
                />
              </View>
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
            <Text style={[styles.dialogTitle, { color: theme.text }]}>Delete credential?</Text>
            <Text style={[styles.dialogMsg, { color: theme.textSecondary }]}>
              <Text style={{ color: theme.text, fontWeight: FontWeight.semibold }}>{deleting?.name}</Text>
              {' will be permanently deleted. Tools using it will stop working.'}
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  muted: { fontSize: FontSize.base, textAlign: 'center' },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  emptyBtn: { marginTop: Spacing.three, minWidth: 180 },
  emptyWrap: { flexGrow: 1 },
  list: { padding: Spacing.four },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  rowMeta: { fontSize: FontSize.sm, marginTop: 1 },
  typePill: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Radius.full },
  typePillText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  // Form sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: Spacing.one },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginTop: Spacing.two },
  input: {
    minHeight: 46,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: FontSize.md,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  typeChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  typeChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  errorText: { fontSize: FontSize.sm, marginTop: Spacing.one },
  formActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },

  // Delete dialog
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  dangerIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  dialogMsg: { fontSize: FontSize.base, textAlign: 'center', lineHeight: 20 },
});
