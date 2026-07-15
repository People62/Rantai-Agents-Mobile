/**
 * ChatList — daftar riwayat percakapan milik user dari backend
 * (GET /api/dashboard/chat/sessions, Bearer token). Ketuk untuk membuka thread.
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Avatar, Screen } from '@/components/ui';
import { FontSize, FontWeight, Spacing } from '@/constants/theme';
import { ChatSessionSummary, getChatSessions } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { ChatStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatList'>;

/** Label waktu ringkas (manual, tanpa Intl agar aman di Hermes). */
function timeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d.toDateString() === now.toDateString()) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

export function ChatListScreen({ navigation }: Props) {
  const theme = useTheme();
  const { token } = useAuth();
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setSessions(await getChatSessions(token));
    } catch {
      setError('Gagal memuat riwayat. Ketuk untuk coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

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
        data={sessions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={sessions.length ? styles.list : styles.emptyWrap}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={load} tintColor={theme.accent} />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Belum ada percakapan</Text>
            <Text style={[styles.muted, { color: theme.textSecondary }]}>
              Percakapan baru akan muncul di sini.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => (
          <View style={[styles.sep, { backgroundColor: theme.border }]} />
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('ChatThread', { id: item.id, title: item.title })}
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: theme.backgroundElement },
            ]}>
            <Avatar name={item.title || 'Chat'} />
            <View style={styles.rowText}>
              <View style={styles.rowTop}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {item.title || 'Tanpa judul'}
                </Text>
                <Text style={[styles.time, { color: theme.textSecondary }]}>
                  {timeLabel(item.updatedAt)}
                </Text>
              </View>
              <Text style={[styles.preview, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.lastMessage ?? 'Belum ada pesan'}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.one, padding: Spacing.four },
  emptyWrap: { flexGrow: 1 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  muted: { fontSize: FontSize.base, textAlign: 'center' },
  list: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: 12,
  },
  rowText: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, flex: 1 },
  time: { fontSize: FontSize.xs },
  preview: { fontSize: FontSize.base },
  sep: { height: StyleSheet.hairlineWidth },
});
