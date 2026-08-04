/**
 * SkillsScreen — Settings → Skills. Manage the org's skill catalog: list,
 * enable/disable, create, edit, delete. A skill is mostly a name + a prompt
 * (content) plus category/tags.
 */
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Plus, Sparkles, Trash2 } from 'lucide-react-native';
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
  ApiError,
  ManagedSkill,
  createSkill,
  deleteSkill,
  getManagedSkills,
  updateSkill,
} from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { SettingsStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Skills'>;

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
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'skill';

export function SkillsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { token } = useAuth();

  const [items, setItems] = useState<ManagedSkill[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<'new' | ManagedSkill | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<ManagedSkill | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setItems(await getManagedSkills(token));
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
    setDisplayName('');
    setDescription('');
    setContent('');
    setCategory('');
    setTags('');
    setFormError(null);
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={openCreate} hitSlop={8} accessibilityRole="button" accessibilityLabel="Create skill" style={{ paddingHorizontal: Spacing.two, paddingVertical: Spacing.one }}>
          <Plus color={theme.accent} size={24} />
        </Pressable>
      ),
    });
  }, [navigation, openCreate, theme]);

  function openEdit(s: ManagedSkill) {
    setForm(s);
    setDisplayName(s.displayName);
    setDescription(s.description);
    setContent(s.content);
    setCategory(s.category);
    setTags(s.tags.join(', '));
    setFormError(null);
  }

  const isEditing = form !== 'new' && form !== null;
  const canSave = displayName.trim() !== '' && content.trim() !== '';

  async function save() {
    if (!token || !canSave || saving) return;
    setSaving(true);
    setFormError(null);
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
    try {
      if (form && form !== 'new') {
        await updateSkill(token, form.id, {
          displayName: displayName.trim(),
          description: description.trim(),
          content: content.trim(),
          category: category.trim() || 'general',
          tags: tagList,
        });
      } else {
        await createSkill(token, {
          name: slugify(displayName),
          displayName: displayName.trim(),
          description: description.trim() || undefined,
          content: content.trim(),
          category: category.trim() || undefined,
          tags: tagList.length ? tagList : undefined,
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

  async function toggle(s: ManagedSkill, next: boolean) {
    if (!token) return;
    setItems((prev) => prev.map((x) => (x.id === s.id ? { ...x, enabled: next } : x)));
    try {
      await updateSkill(token, s.id, { enabled: next });
    } catch {
      setItems((prev) => prev.map((x) => (x.id === s.id ? { ...x, enabled: !next } : x)));
    }
  }

  async function doDelete() {
    if (!token || !deleting || busy) return;
    setBusy(true);
    try {
      await deleteSkill(token, deleting.id);
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

  return (
    <Screen padded={false} edges={['bottom']}>
      <FlatList
        data={items}
        keyExtractor={(s) => s.id}
        contentContainerStyle={items.length ? styles.list : styles.emptyWrap}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <EmptyState
              icon={Sparkles}
              title="No skills"
              subtitle="Create a reusable instruction skill for your agents."
              action={<Button label="Create skill" onPress={openCreate} style={styles.emptyBtn} />}
            />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openEdit(item)}
            onLongPress={() => setDeleting(item)}
            delayLongPress={300}
            style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.rowTop}>
              <View style={styles.flex}>
                <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>{item.displayName}</Text>
                {item.description ? (
                  <Text style={[styles.rowDesc, { color: theme.textSecondary }]} numberOfLines={2}>{item.description}</Text>
                ) : null}
              </View>
              <Switch value={item.enabled} onValueChange={(v) => toggle(item, v)}
                trackColor={{ true: theme.accent, false: theme.border }} thumbColor={theme.accentForeground} />
            </View>
            <View style={styles.pills}>
              <View style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.pillText, { color: theme.textSecondary }]}>{item.category}</Text>
              </View>
              {item.source && item.source !== 'custom' ? (
                <View style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
                  <Text style={[styles.pillText, { color: theme.textSecondary }]}>{item.source}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        )}
      />

      {/* Form */}
      <Modal visible={!!form} transparent animationType="slide" onRequestClose={() => setForm(null)}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setForm(null)}>
            <Pressable style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={[styles.sheetTitle, { color: theme.text }]}>
                  {isEditing ? 'Edit skill' : 'New skill'}
                </Text>

                <Field label="Name" theme={theme} value={displayName} onChangeText={setDisplayName} placeholder="e.g. Summarize meeting" />
                <Field label="Description" theme={theme} value={description} onChangeText={setDescription} placeholder="Short summary" />
                <Field label="Instructions (prompt)" theme={theme} value={content} onChangeText={setContent}
                  placeholder="What the skill tells the agent to do…" multiline />
                <Field label="Category" theme={theme} value={category} onChangeText={setCategory} placeholder="general" />
                <Field label="Tags (comma separated)" theme={theme} value={tags} onChangeText={setTags} placeholder="research, writing" />

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
            <Text style={[styles.dialogTitle, { color: theme.text }]}>Delete skill?</Text>
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

type Theme = ReturnType<typeof useTheme>;

function Field({
  theme, label, value, onChangeText, placeholder, multiline,
}: {
  theme: Theme; label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; multiline?: boolean;
}) {
  return (
    <View>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.input,
          multiline && styles.textarea,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.six },
  muted: { fontSize: FontSize.base, textAlign: 'center' },
  emptyBtn: { marginTop: Spacing.three, minWidth: 180 },
  emptyWrap: { flexGrow: 1 },
  list: { padding: Spacing.four },

  row: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: Spacing.three, gap: Spacing.two },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  rowDesc: { fontSize: FontSize.sm, marginTop: 1, lineHeight: 18 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  pill: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Radius.full },
  pillText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },

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
  input: {
    minHeight: 46,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: FontSize.md,
    marginTop: Spacing.one,
  },
  textarea: { minHeight: 120 },
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
