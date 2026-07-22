/**
 * Documents — list of knowledge documents (all or within a KB group). Search +
 * category filter; upload a file from the device via a dialog that also picks
 * the title, knowledge base(s), categories and subcategory (synchronous
 * ingestion, shown with a "processing" overlay); tap to open detail.
 */
import { pick, types } from '@react-native-documents/picker';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FileText, FileUp, Pencil, Plus, Search, Trash2 } from 'lucide-react-native';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import {
  KnowledgeCategory,
  KnowledgeDocumentListItem,
  KnowledgeGroup,
  createKnowledgeCategory,
  deleteKnowledgeDocument,
  getKnowledgeCategories,
  getKnowledgeDocuments,
  getKnowledgeGroups,
  updateKnowledgeDocument,
  uploadKnowledgeDocument,
} from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { FilesStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<FilesStackParamList, 'KnowledgeDocs'>;

const MAX_SIZE = 50 * 1024 * 1024;

type PickedFile = { uri: string; name: string; type: string; size?: number | null };

function fmtSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Decode %20 etc. and drop the extension for a clean default title. */
function cleanTitle(name: string): string {
  let n = name;
  try {
    n = decodeURIComponent(name);
  } catch {
    // keep raw name on malformed encoding
  }
  return n.replace(/\.[^/.]+$/, '').trim();
}

export function DocumentsScreen({ route, navigation }: Props) {
  const groupId = route.params?.groupId;
  const theme = useTheme();
  const { token } = useAuth();
  const [docs, setDocs] = useState<KnowledgeDocumentListItem[]>([]);
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [groups, setGroups] = useState<KnowledgeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Upload dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [upTitle, setUpTitle] = useState('');
  const [upSub, setUpSub] = useState('');
  const [upCats, setUpCats] = useState<string[]>([]);
  const [upGroups, setUpGroups] = useState<string[]>([]);
  const [upEnhanced, setUpEnhanced] = useState(true);
  const [newCat, setNewCat] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  // Row actions (long-press)
  const [selected, setSelected] = useState<KnowledgeDocumentListItem | null>(null);
  const [renaming, setRenaming] = useState<KnowledgeDocumentListItem | null>(null);
  const [renameText, setRenameText] = useState('');
  const [deleting, setDeleting] = useState<KnowledgeDocumentListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  function openRename() {
    if (!selected) return;
    setRenaming(selected);
    setRenameText(selected.title);
    setSelected(null);
  }

  async function submitRename() {
    const t = renameText.trim();
    if (!token || !renaming || !t || actionBusy) return;
    setActionBusy(true);
    try {
      await updateKnowledgeDocument(token, renaming.id, { title: t });
      setDocs((prev) => prev.map((d) => (d.id === renaming.id ? { ...d, title: t } : d)));
      setRenaming(null);
    } catch {
      Alert.alert('Failed', 'Could not rename the document.');
    } finally {
      setActionBusy(false);
    }
  }

  function askDelete() {
    if (!selected) return;
    setDeleting(selected);
    setDeleteError(null);
    setSelected(null);
  }

  async function doDelete() {
    if (!token || !deleting || actionBusy) return;
    setActionBusy(true);
    setDeleteError(null);
    try {
      await deleteKnowledgeDocument(token, deleting.id, true);
      setDocs((prev) => prev.filter((d) => d.id !== deleting.id));
      setDeleting(null);
    } catch {
      setDeleteError('Failed to delete. Try again.');
    } finally {
      setActionBusy(false);
    }
  }

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [{ documents }, { categories: cats }, { groups: g }] = await Promise.all([
        getKnowledgeDocuments(token, groupId),
        getKnowledgeCategories(token).catch(() => ({ categories: [] as KnowledgeCategory[] })),
        getKnowledgeGroups(token).catch(() => ({ groups: [] as KnowledgeGroup[], totalDocumentCount: 0 })),
      ]);
      setDocs(documents);
      setCategories(cats);
      setGroups(g);
    } catch {
      setError('Failed to load documents. Tap to try again.');
    } finally {
      setLoading(false);
    }
  }, [token, groupId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openDialog() {
    setPicked(null);
    setUpTitle('');
    setUpSub('');
    setUpCats([]);
    setUpGroups(groupId ? [groupId] : []);
    setUpEnhanced(true);
    setDialogOpen(true);
  }

  async function chooseFile() {
    try {
      const [f] = await pick({ type: [types.allFiles], allowMultiSelection: false });
      if (!f?.uri) return;
      const file: PickedFile = {
        uri: f.uri,
        name: f.name ?? 'document',
        type: f.type ?? 'application/octet-stream',
        size: f.size,
      };
      if (file.size && file.size > MAX_SIZE) {
        Alert.alert('Too large', 'Files must be 50 MB or smaller.');
        return;
      }
      setPicked(file);
      if (!upTitle) setUpTitle(cleanTitle(file.name));
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'DOCUMENT_PICKER_CANCELED') return;
      Alert.alert('Failed', 'Could not pick a file.');
    }
  }

  async function addCategory() {
    const label = newCat.trim();
    if (!token || !label || addingCat) return;
    setAddingCat(true);
    try {
      const c = await createKnowledgeCategory(token, { label });
      setCategories((prev) => (prev.some((x) => x.name === c.name) ? prev : [...prev, c]));
      setUpCats((prev) => (prev.includes(c.name) ? prev : [...prev, c.name]));
      setNewCat('');
    } catch {
      Alert.alert('Failed', 'Could not create the category.');
    } finally {
      setAddingCat(false);
    }
  }

  async function submitUpload() {
    if (!token || !picked || uploading) return;
    setDialogOpen(false);
    setUploading(true);
    try {
      await uploadKnowledgeDocument(token, picked, {
        title: upTitle.trim() || undefined,
        categories: upCats,
        subcategory: upSub.trim() || undefined,
        groupIds: upGroups,
        enhanced: upEnhanced,
      });
      await load();
    } catch {
      Alert.alert('Upload failed', 'Could not process the document. Try a smaller or simpler file.');
    } finally {
      setUploading(false);
    }
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={openDialog} hitSlop={8} style={{ paddingHorizontal: Spacing.two, paddingVertical: Spacing.one }}>
          <Plus color={theme.accent} size={24} />
        </Pressable>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, theme.accent, groupId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((d) => {
      if (cat && !d.categories.includes(cat)) return false;
      if (!q) return true;
      return d.title.toLowerCase().includes(q);
    });
  }, [docs, query, cat]);

  if (loading) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}><ActivityIndicator color={theme.accent} /></View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen edges={['bottom']}>
        <Pressable style={styles.centered} onPress={() => { setLoading(true); load(); }}>
          <Text style={[styles.muted, { color: theme.destructive }]}>{error}</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['bottom']}>
      <View style={styles.filters}>
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Search color={theme.textSecondary} size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search documents…"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
        {categories.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="All" active={!cat} onPress={() => setCat(null)} theme={theme} />
            {categories.map((c) => (
              <Chip key={c.id} label={c.label || c.name} active={cat === c.name} onPress={() => setCat(cat === c.name ? null : c.name)} theme={theme} />
            ))}
          </ScrollView>
        ) : null}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(d) => d.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={filtered.length ? styles.list : styles.emptyWrap}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={theme.accent} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {query || cat ? 'No results' : 'No documents yet'}
            </Text>
            <Text style={[styles.muted, { color: theme.textSecondary }]}>
              {query || cat ? 'No documents match your filter.' : 'Upload one with the + button.'}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: theme.border }]} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('KnowledgeDocDetail', { id: item.id, title: item.title })}
            onLongPress={() => setSelected(item)}
            delayLongPress={300}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
            <View style={[styles.fileIcon, { backgroundColor: theme.backgroundElement }]}>
              <FileText color={theme.textSecondary} size={20} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
              <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
                {(item.fileType || 'doc').toUpperCase()}
                {item.fileSize ? ` · ${fmtSize(item.fileSize)}` : ''}
                {` · ${item.chunkCount} chunk${item.chunkCount === 1 ? '' : 's'}`}
                {item.categories.length ? ` · ${item.categories.join(', ')}` : ''}
              </Text>
            </View>
          </Pressable>
        )}
      />

      {/* Action sheet (long-press) */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.centerBackdrop} onPress={() => setSelected(null)}>
          <Pressable style={[styles.sheetMenu, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.menuTitle, { color: theme.textSecondary }]} numberOfLines={1}>{selected?.title}</Text>
            <Pressable onPress={openRename} style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: theme.backgroundElement }]}>
              <Pencil color={theme.text} size={20} />
              <Text style={[styles.menuLabel, { color: theme.text }]}>Rename file</Text>
            </Pressable>
            <Pressable onPress={askDelete} style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: theme.backgroundElement }]}>
              <Trash2 color={theme.destructive} size={20} />
              <Text style={[styles.menuLabel, { color: theme.destructive }]}>Delete file</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Rename dialog */}
      <Modal visible={!!renaming} transparent animationType="fade" onRequestClose={() => setRenaming(null)}>
        <Pressable style={styles.centerBackdrop} onPress={() => setRenaming(null)}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>Rename file</Text>
            <TextInput
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitRename}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            />
            <View style={styles.dialogActions}>
              <Button label="Cancel" variant="outline" onPress={() => setRenaming(null)} style={styles.flex} />
              <Button label="Save" onPress={submitRename} loading={actionBusy} disabled={!renameText.trim()} style={styles.flex} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete confirmation (themed) */}
      <Modal visible={!!deleting} transparent animationType="fade" onRequestClose={() => (actionBusy ? undefined : setDeleting(null))}>
        <Pressable style={styles.centerBackdrop} onPress={() => (actionBusy ? undefined : setDeleting(null))}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border, alignItems: 'center' }]}>
            <View style={[styles.dangerIcon, { backgroundColor: `${theme.destructive}1A` }]}>
              <Trash2 color={theme.destructive} size={26} />
            </View>
            <Text style={[styles.dialogTitle, styles.textCenter, { color: theme.text }]}>Delete file?</Text>
            <Text style={[styles.dialogMessage, { color: theme.textSecondary }]}>
              <Text style={{ color: theme.text, fontWeight: FontWeight.semibold }}>{deleting?.title}</Text>
              {' and its extracted data will be permanently removed. This cannot be undone.'}
            </Text>
            {deleteError ? <Text style={[styles.dialogError, { color: theme.destructive }]}>{deleteError}</Text> : null}
            <View style={[styles.dialogActions, styles.selfStretch]}>
              <Button label="Cancel" variant="outline" onPress={() => setDeleting(null)} disabled={actionBusy} style={styles.flex} />
              <Button label="Delete" variant="destructive" onPress={doDelete} loading={actionBusy} style={styles.flex} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Upload dialog */}
      <Modal visible={dialogOpen} transparent animationType="slide" onRequestClose={() => setDialogOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setDialogOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Upload document</Text>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
              {/* File */}
              <Pressable
                onPress={chooseFile}
                style={[styles.fileBtn, { borderColor: theme.border, backgroundColor: theme.background }]}>
                <FileUp color={theme.accent} size={20} />
                <Text style={[styles.fileBtnText, { color: picked ? theme.text : theme.textSecondary }]} numberOfLines={1}>
                  {picked ? picked.name : 'Choose a file…'}
                </Text>
              </Pressable>
              {picked?.size ? (
                <Text style={[styles.hint, { color: theme.textSecondary }]}>{fmtSize(picked.size)}</Text>
              ) : null}

              {/* Title */}
              <Field label="Title">
                <TextInput
                  value={upTitle}
                  onChangeText={setUpTitle}
                  placeholder="Document title"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                />
              </Field>

              {/* Knowledge bases */}
              {groups.length ? (
                <Field label="Knowledge base">
                  <View style={styles.wrapChips}>
                    {groups.map((g) => (
                      <SelChip
                        key={g.id}
                        label={g.name}
                        active={upGroups.includes(g.id)}
                        onPress={() => setUpGroups((p) => (p.includes(g.id) ? p.filter((x) => x !== g.id) : [...p, g.id]))}
                        theme={theme}
                      />
                    ))}
                  </View>
                </Field>
              ) : null}

              {/* Categories */}
              <Field label="Categories">
                {categories.length ? (
                  <View style={styles.wrapChips}>
                    {categories.map((c) => (
                      <SelChip
                        key={c.id}
                        label={c.label || c.name}
                        active={upCats.includes(c.name)}
                        onPress={() => setUpCats((p) => (p.includes(c.name) ? p.filter((x) => x !== c.name) : [...p, c.name]))}
                        theme={theme}
                      />
                    ))}
                  </View>
                ) : null}
                <View style={styles.addCatRow}>
                  <TextInput
                    value={newCat}
                    onChangeText={setNewCat}
                    placeholder="Add a new category…"
                    placeholderTextColor={theme.textSecondary}
                    onSubmitEditing={addCategory}
                    returnKeyType="done"
                    style={[styles.addCatInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                  />
                  <Pressable
                    onPress={addCategory}
                    disabled={!newCat.trim() || addingCat}
                    style={[styles.addCatBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border, opacity: newCat.trim() ? 1 : 0.5 }]}>
                    {addingCat ? <ActivityIndicator size="small" color={theme.accent} /> : <Plus color={theme.accent} size={18} />}
                  </Pressable>
                </View>
              </Field>

              {/* Subcategory */}
              <Field label="Subcategory (optional)">
                <TextInput
                  value={upSub}
                  onChangeText={setUpSub}
                  placeholder="e.g. 2026 policy"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                />
              </Field>

              {/* Enhanced analysis */}
              <View style={styles.switchRow}>
                <View style={styles.flex}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Enhanced analysis</Text>
                  <Text style={[styles.hint, { color: theme.textSecondary, marginTop: 0 }]}>
                    Extract entities & relations (slower). Powers the Intelligence tab.
                  </Text>
                </View>
                <Switch
                  value={upEnhanced}
                  onValueChange={setUpEnhanced}
                  trackColor={{ true: theme.accent, false: theme.border }}
                />
              </View>
            </ScrollView>
            <View style={styles.sheetActions}>
              <Button label="Cancel" variant="outline" onPress={() => setDialogOpen(false)} style={styles.flex} />
              <Button label="Upload" onPress={submitUpload} disabled={!picked} style={styles.flex} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Processing overlay (ingestion is synchronous + slow) */}
      <Modal visible={uploading} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.overlayCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ActivityIndicator color={theme.accent} size="large" />
            <Text style={[styles.overlayText, { color: theme.text }]}>Processing document…</Text>
            <Text style={[styles.overlaySub, { color: theme.textSecondary }]}>
              Extracting text & building the index. This can take a while.
            </Text>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

function Chip({ label, active, onPress, theme }: { label: string; active: boolean; onPress: () => void; theme: ReturnType<typeof useTheme> }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? theme.accent : theme.backgroundElement, borderColor: active ? theme.accent : theme.border }]}>
      <Text style={[styles.chipText, { color: active ? theme.accentForeground : theme.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function SelChip({ label, active, onPress, theme }: { label: string; active: boolean; onPress: () => void; theme: ReturnType<typeof useTheme> }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? theme.accent : theme.backgroundElement, borderColor: active ? theme.accent : theme.border }]}>
      <Text style={[styles.chipText, { color: active ? theme.accentForeground : theme.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.one, padding: Spacing.four },
  emptyWrap: { flexGrow: 1 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  muted: { fontSize: FontSize.base, textAlign: 'center' },
  filters: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two, height: 44,
    paddingHorizontal: Spacing.three, borderRadius: Radius.full, borderWidth: StyleSheet.hairlineWidth * 2,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, padding: 0 },
  chips: { gap: Spacing.two, paddingRight: Spacing.four },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2, borderRadius: Radius.full, borderWidth: StyleSheet.hairlineWidth * 2 },
  chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  list: { paddingHorizontal: Spacing.four, paddingTop: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three, borderRadius: Radius.md },
  fileIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  sub: { fontSize: FontSize.sm },
  sep: { height: StyleSheet.hairlineWidth },

  // upload dialog
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2, paddingTop: Spacing.four, maxHeight: '85%',
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  sheetBody: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two, gap: Spacing.three },
  fileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two, height: 48,
    borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2,
    borderStyle: 'dashed', paddingHorizontal: Spacing.three,
  },
  fileBtnText: { flex: 1, fontSize: FontSize.md },
  hint: { fontSize: FontSize.xs, marginTop: -Spacing.two },
  field: { gap: Spacing.one + 2 },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  input: {
    minHeight: 46, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three, fontSize: FontSize.md,
  },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  addCatRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  addCatInput: {
    flex: 1, height: 40, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three, fontSize: FontSize.sm,
  },
  addCatBtn: { width: 40, height: 40, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: 'center', justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  sheetActions: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.four },

  // processing overlay
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  overlayCard: {
    width: '100%', maxWidth: 320, borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.five, alignItems: 'center', gap: Spacing.two,
  },
  overlayText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, marginTop: Spacing.two },
  overlaySub: { fontSize: FontSize.sm, textAlign: 'center' },

  // action sheet + dialogs
  centerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  sheetMenu: { width: '100%', maxWidth: 360, borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth * 2, paddingVertical: Spacing.two },
  menuTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  menuLabel: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
  dialog: {
    width: '100%', maxWidth: 360, borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.four, gap: Spacing.three,
  },
  dialogTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  textCenter: { textAlign: 'center' },
  dangerIcon: { width: 56, height: 56, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  dialogMessage: { fontSize: FontSize.base, textAlign: 'center', lineHeight: 20 },
  dialogError: { fontSize: FontSize.sm, textAlign: 'center' },
  dialogActions: { flexDirection: 'row', gap: Spacing.two },
  selfStretch: { alignSelf: 'stretch' },
});
