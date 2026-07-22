/**
 * DocumentDetail — a knowledge document's extracted content, metadata, and
 * chunks. Image documents show a preview. Edit the title or delete the document.
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Screen } from '@/components/ui';
import { Fonts, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import {
  DocumentIntelligence,
  KnowledgeDocumentDetail,
  deleteKnowledgeDocument,
  getDocumentIntelligence,
  getKnowledgeDocument,
  knowledgeFileSource,
  updateKnowledgeDocument,
} from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { FilesStackParamList } from '@/navigation/types';
import { KnowledgeGraph } from './knowledge-graph';

type Props = NativeStackScreenProps<FilesStackParamList, 'KnowledgeDocDetail'>;

export function DocumentDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const theme = useTheme();
  const { token } = useAuth();

  const [doc, setDoc] = useState<KnowledgeDocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [chunksOpen, setChunksOpen] = useState(false);
  const [contentExpanded, setContentExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Content vs Intelligence
  const [view, setView] = useState<'content' | 'intelligence'>('content');
  const [intelSub, setIntelSub] = useState<'entities' | 'relations' | 'graph'>('entities');
  const [intel, setIntel] = useState<DocumentIntelligence | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState<string | null>(null);

  const loadIntel = useCallback(async () => {
    if (!token || intel || intelLoading) return;
    setIntelLoading(true);
    setIntelError(null);
    try {
      setIntel(await getDocumentIntelligence(token, id));
    } catch {
      setIntelError('Failed to load intelligence.');
    } finally {
      setIntelLoading(false);
    }
  }, [token, id, intel, intelLoading]);

  function showIntelligence() {
    setView('intelligence');
    loadIntel();
  }

  useEffect(() => {
    let active = true;
    (async () => {
      if (!token) return;
      try {
        const d = await getKnowledgeDocument(token, id);
        if (active) setDoc(d);
      } catch {
        if (active) setDoc(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token, id]);

  const openDelete = useCallback(() => setDeleteOpen(true), []);

  async function confirmDelete() {
    if (!token || !doc || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteKnowledgeDocument(token, doc.id, true);
      navigation.goBack();
    } catch {
      setDeleteError('Failed to delete. Try again.');
      setDeleteBusy(false);
    }
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={openDelete} hitSlop={8} style={{ paddingHorizontal: Spacing.two, paddingVertical: Spacing.one }}>
          <Trash2 color={theme.destructive} size={22} />
        </Pressable>
      ),
    });
  }, [navigation, openDelete, theme.destructive]);

  async function saveTitle() {
    const t = title.trim();
    if (!token || !doc || !t || busy) return;
    setBusy(true);
    try {
      await updateKnowledgeDocument(token, doc.id, { title: t });
      setDoc((prev) => (prev ? { ...prev, title: t } : prev));
      navigation.setOptions({ title: t });
      setEditOpen(false);
    } catch {
      Alert.alert('Failed', 'Could not update the title.');
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

  if (!doc) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={{ color: theme.destructive, fontSize: FontSize.base }}>Document not found.</Text>
        </View>
      </Screen>
    );
  }

  const isImage = (doc.mimeType || '').startsWith('image/') || doc.fileType === 'image';

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Title + edit */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.text }]}>{doc.title}</Text>
          <Pressable
            onPress={() => {
              setTitle(doc.title);
              setEditOpen(true);
            }}
            hitSlop={8}>
            <Pencil color={theme.textSecondary} size={18} />
          </Pressable>
        </View>

        {/* Meta chips */}
        <View style={styles.metaRow}>
          {[
            (doc.fileType || 'doc').toUpperCase(),
            `${doc.chunks.length} chunks`,
            ...doc.groups.map((g) => g.name),
            ...doc.categories,
          ].map((m, i) => (
            <View key={`${m}-${i}`} style={[styles.tag, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.tagText, { color: theme.textSecondary }]}>{m}</Text>
            </View>
          ))}
        </View>

        {/* Content / Intelligence toggle */}
        <View style={[styles.toggle, { backgroundColor: theme.backgroundElement }]}>
          {(['content', 'intelligence'] as const).map((v) => {
            const active = view === v;
            return (
              <Pressable
                key={v}
                onPress={() => (v === 'intelligence' ? showIntelligence() : setView('content'))}
                style={[styles.toggleBtn, active && { backgroundColor: theme.accent }]}>
                <Text style={[styles.toggleText, { color: active ? theme.accentForeground : theme.textSecondary }]}>
                  {v === 'content' ? 'Content' : 'Intelligence'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {view === 'content' ? (
          <>
            {isImage ? (
              <Image source={knowledgeFileSource(token!, doc.id)} style={styles.image} resizeMode="contain" />
            ) : null}
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Content</Text>
            <View style={[styles.contentBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text
                style={[styles.contentText, { color: theme.text }]}
                selectable
                numberOfLines={contentExpanded ? undefined : 8}>
                {doc.content?.trim() || '(No extracted text)'}
              </Text>
              {(doc.content?.trim().length ?? 0) > 360 ? (
                <Pressable onPress={() => setContentExpanded((v) => !v)} style={styles.readAllBtn}>
                  <Text style={[styles.readAll, { color: theme.accent }]}>
                    {contentExpanded ? 'Show less' : 'Read all'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable style={styles.sectionHead} onPress={() => setChunksOpen((v) => !v)}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Chunks ({doc.chunks.length})</Text>
              {chunksOpen ? <ChevronDown color={theme.textSecondary} size={18} /> : <ChevronRight color={theme.textSecondary} size={18} />}
            </Pressable>
            {chunksOpen
              ? doc.chunks.map((c, i) => (
                  <View key={i} style={[styles.chunk, { backgroundColor: theme.backgroundElement }]}>
                    <Text style={[styles.chunkIdx, { color: theme.textSecondary }]}>#{c.chunkIndex ?? i}</Text>
                    <Text style={[styles.chunkText, { color: theme.text }]} numberOfLines={6}>{c.content}</Text>
                  </View>
                ))
              : null}
          </>
        ) : (
          <IntelligenceView
            intel={intel}
            loading={intelLoading}
            error={intelError}
            sub={intelSub}
            onSub={setIntelSub}
            theme={theme}
          />
        )}
      </ScrollView>

      {/* Edit title dialog */}
      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setEditOpen(false)}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>Edit title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              autoFocus
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            />
            <View style={styles.dialogActions}>
              <Button label="Cancel" variant="outline" onPress={() => setEditOpen(false)} style={styles.flex} />
              <Button label="Save" onPress={saveTitle} loading={busy} disabled={!title.trim()} style={styles.flex} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete confirmation (themed) */}
      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => (deleteBusy ? undefined : setDeleteOpen(false))}>
        <Pressable style={styles.backdrop} onPress={() => (deleteBusy ? undefined : setDeleteOpen(false))}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border, alignItems: 'center' }]}>
            <View style={[styles.dangerIcon, { backgroundColor: `${theme.destructive}1A` }]}>
              <Trash2 color={theme.destructive} size={26} />
            </View>
            <Text style={[styles.dialogTitle, styles.textCenter, { color: theme.text }]}>Delete file?</Text>
            <Text style={[styles.dialogMessage, { color: theme.textSecondary }]}>
              <Text style={{ color: theme.text, fontWeight: FontWeight.semibold }}>{doc.title}</Text>
              {' and its extracted data will be permanently removed. This cannot be undone.'}
            </Text>
            {deleteError ? <Text style={[styles.dialogError, { color: theme.destructive }]}>{deleteError}</Text> : null}
            <View style={[styles.dialogActions, styles.selfStretch]}>
              <Button label="Cancel" variant="outline" onPress={() => setDeleteOpen(false)} disabled={deleteBusy} style={styles.flex} />
              <Button label="Delete" variant="destructive" onPress={confirmDelete} loading={deleteBusy} style={styles.flex} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function IntelligenceView({
  intel,
  loading,
  error,
  sub,
  onSub,
  theme,
}: {
  intel: DocumentIntelligence | null;
  loading: boolean;
  error: string | null;
  sub: 'entities' | 'relations' | 'graph';
  onSub: (s: 'entities' | 'relations' | 'graph') => void;
  theme: ReturnType<typeof useTheme>;
}) {
  if (loading) {
    return <View style={styles.intelCenter}><ActivityIndicator color={theme.accent} /></View>;
  }
  if (error || !intel) {
    return (
      <View style={styles.intelCenter}>
        <Text style={{ color: theme.textSecondary, fontSize: FontSize.base }}>{error ?? 'No data.'}</Text>
      </View>
    );
  }

  const nameById = new Map(intel.entities.map((e) => [e.id, e.name]));
  const short = (id: string) => nameById.get(id) ?? id.split(':').pop() ?? id;

  return (
    <View style={styles.intelWrap}>
      <Text style={[styles.stats, { color: theme.textSecondary }]}>
        {intel.stats.totalEntities} entities · {intel.stats.totalRelations} relations
      </Text>

      <View style={[styles.subToggle, { backgroundColor: theme.backgroundElement }]}>
        {(['entities', 'relations', 'graph'] as const).map((s) => {
          const active = sub === s;
          return (
            <Pressable key={s} onPress={() => onSub(s)} style={[styles.subBtn, active && { backgroundColor: theme.accent }]}>
              <Text style={[styles.subText, { color: active ? theme.accentForeground : theme.textSecondary }]}>
                {s === 'entities' ? 'Entities' : s === 'relations' ? 'Relations' : 'Graph'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {sub === 'entities' ? (
        intel.entities.length ? (
          intel.entities.map((e) => (
            <View key={e.id} style={[styles.entRow, { borderColor: theme.border }]}>
              <View style={styles.flex}>
                <Text style={[styles.entName, { color: theme.text }]} numberOfLines={1}>{e.name}</Text>
                <Text style={[styles.entType, { color: theme.textSecondary }]}>{e.type}</Text>
              </View>
              <Text style={[styles.entConf, { color: theme.textSecondary }]}>{Math.round(e.confidence * 100)}%</Text>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyMsg, { color: theme.textSecondary }]}>No entities extracted.</Text>
        )
      ) : null}

      {sub === 'relations' ? (
        intel.relations.length ? (
          intel.relations.map((r) => (
            <View key={r.id} style={[styles.entRow, { borderColor: theme.border }]}>
              <Text style={[styles.relText, { color: theme.text }]} numberOfLines={2}>
                <Text style={{ fontWeight: FontWeight.semibold }}>{short(r.in)}</Text>
                <Text style={{ color: theme.accent }}>{`  ${r.relation_type}  `}</Text>
                <Text style={{ fontWeight: FontWeight.semibold }}>{short(r.out)}</Text>
              </Text>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyMsg, { color: theme.textSecondary }]}>No relations extracted.</Text>
        )
      ) : null}

      {sub === 'graph' ? <KnowledgeGraph entities={intel.entities} relations={intel.relations} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  toggle: { flexDirection: 'row', borderRadius: Radius.full, padding: 3, alignSelf: 'flex-start' },
  toggleBtn: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.one + 1, borderRadius: Radius.full },
  toggleText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  intelWrap: { gap: Spacing.two },
  intelCenter: { paddingVertical: Spacing.five, alignItems: 'center' },
  stats: { fontSize: FontSize.sm },
  subToggle: { flexDirection: 'row', borderRadius: Radius.full, padding: 3, alignSelf: 'flex-start' },
  subBtn: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Radius.full },
  subText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  entRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  entName: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  entType: { fontSize: FontSize.xs },
  entConf: { fontSize: FontSize.xs },
  relText: { fontSize: FontSize.base, lineHeight: 20, flex: 1 },
  emptyMsg: { fontSize: FontSize.base, paddingVertical: Spacing.three },
  content: { padding: Spacing.four, gap: Spacing.three },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.two },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, flex: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tag: { paddingHorizontal: Spacing.two, paddingVertical: 3, borderRadius: Radius.full },
  tagText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  image: { width: '100%', aspectRatio: 1, borderRadius: Radius.md, backgroundColor: '#00000010' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.two },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  contentBox: { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2, padding: Spacing.three },
  contentText: { fontSize: FontSize.base, lineHeight: 21 },
  readAllBtn: { marginTop: Spacing.two },
  readAll: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  chunk: { borderRadius: Radius.sm, padding: Spacing.three, gap: Spacing.one },
  chunkIdx: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  chunkText: { fontSize: FontSize.sm, fontFamily: Fonts.mono, lineHeight: 18 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  dialog: { width: '100%', maxWidth: 360, borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth * 2, padding: Spacing.four, gap: Spacing.three },
  dialogTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  input: { height: 46, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: Spacing.three, fontSize: FontSize.md },
  dialogActions: { flexDirection: 'row', gap: Spacing.two },
  textCenter: { textAlign: 'center' },
  dangerIcon: { width: 56, height: 56, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  dialogMessage: { fontSize: FontSize.base, textAlign: 'center', lineHeight: 20 },
  dialogError: { fontSize: FontSize.sm, textAlign: 'center' },
  selfStretch: { alignSelf: 'stretch' },
});
