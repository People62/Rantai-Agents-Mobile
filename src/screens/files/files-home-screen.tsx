/**
 * FilesHome — knowledge bases (groups) plus an "All Documents" entry. Tap to
 * browse documents; create or delete a KB.
 */
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronRight, FolderPlus, Layers } from 'lucide-react-native';
import { useCallback, useState } from 'react';
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
  KnowledgeGroup,
  createKnowledgeGroup,
  deleteKnowledgeGroup,
  getKnowledgeGroups,
} from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { FilesStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<FilesStackParamList, 'FilesHome'>;

const PRESET_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

export function FilesHomeScreen({ navigation }: Props) {
  const theme = useTheme();
  const { token } = useAuth();
  const [groups, setGroups] = useState<KnowledgeGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const { groups: g, totalDocumentCount } = await getKnowledgeGroups(token);
      setGroups(g);
      setTotal(totalDocumentCount);
    } catch {
      setError('Failed to load knowledge bases. Tap to try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function submitCreate() {
    const n = name.trim();
    if (!token || !n || busy) return;
    setBusy(true);
    try {
      const g = await createKnowledgeGroup(token, { name: n, color });
      setGroups((prev) => [{ ...g, documentCount: 0 }, ...prev]);
      setCreateOpen(false);
      setName('');
      setColor(PRESET_COLORS[0]);
    } catch {
      Alert.alert('Failed', 'Could not create the knowledge base.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(g: KnowledgeGroup) {
    Alert.alert('Delete knowledge base?', `"${g.name}" will be removed. Its documents are kept.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await deleteKnowledgeGroup(token, g.id);
            setGroups((prev) => prev.filter((x) => x.id !== g.id));
          } catch {
            Alert.alert('Failed', 'Could not delete the knowledge base.');
          }
        },
      },
    ]);
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
      <FlatList
        data={groups}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={theme.accent} />}
        ListHeaderComponent={
          <>
            <Pressable
              onPress={() => navigation.navigate('KnowledgeDocs', {})}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.card, borderColor: theme.border },
                pressed && { opacity: 0.7 },
              ]}>
              <View style={[styles.iconBox, { backgroundColor: theme.backgroundElement }]}>
                <Layers color={theme.accent} size={20} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.name, { color: theme.text }]}>All Documents</Text>
                <Text style={[styles.sub, { color: theme.textSecondary }]}>{total} document{total === 1 ? '' : 's'}</Text>
              </View>
              <ChevronRight color={theme.textSecondary} size={18} />
            </Pressable>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Knowledge Bases</Text>
          </>
        }
        ListEmptyComponent={
          <Text style={[styles.muted, { color: theme.textSecondary, padding: Spacing.four }]}>
            No knowledge bases yet. Create one with the + button.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('KnowledgeDocs', { groupId: item.id, groupName: item.name })}
            onLongPress={() => confirmDelete(item)}
            delayLongPress={300}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: theme.card, borderColor: theme.border },
              pressed && { opacity: 0.7 },
            ]}>
            <View style={[styles.dot, { backgroundColor: item.color || theme.accent }]} />
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
              {item.description ? (
                <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>{item.description}</Text>
              ) : (
                <Text style={[styles.sub, { color: theme.textSecondary }]}>
                  {item.documentCount ?? 0} document{(item.documentCount ?? 0) === 1 ? '' : 's'}
                </Text>
              )}
            </View>
            <ChevronRight color={theme.textSecondary} size={18} />
          </Pressable>
        )}
      />

      {/* Create KB FAB */}
      <Pressable
        onPress={() => setCreateOpen(true)}
        style={({ pressed }) => [styles.fab, { backgroundColor: theme.accent, opacity: pressed ? 0.9 : 1 }]}>
        <FolderPlus color={theme.accentForeground} size={24} />
      </Pressable>

      {/* Create KB dialog */}
      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCreateOpen(false)}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>New knowledge base</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor={theme.textSecondary}
              autoFocus
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            />
            <Text style={[styles.colorLabel, { color: theme.textSecondary }]}>Color</Text>
            <View style={styles.swatches}>
              {PRESET_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[
                    styles.swatch,
                    { backgroundColor: c, borderColor: color === c ? theme.text : 'transparent' },
                  ]}
                />
              ))}
            </View>
            <View style={styles.dialogActions}>
              <Button label="Cancel" variant="outline" onPress={() => setCreateOpen(false)} style={styles.flex} />
              <Button label="Create" onPress={submitCreate} loading={busy} disabled={!name.trim()} style={styles.flex} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  muted: { fontSize: FontSize.base, textAlign: 'center' },
  list: { padding: Spacing.four, gap: Spacing.two },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginTop: Spacing.three, marginBottom: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  iconBox: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginHorizontal: 14 },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  sub: { fontSize: FontSize.sm },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.four,
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  dialog: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  dialogTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  input: {
    height: 46,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
    fontSize: FontSize.md,
  },
  dialogActions: { flexDirection: 'row', gap: Spacing.two },
  colorLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
});
