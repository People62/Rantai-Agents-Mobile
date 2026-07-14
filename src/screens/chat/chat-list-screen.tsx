/**
 * ChatList — daftar percakapan (data dummy). Ketuk untuk membuka thread.
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Badge, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { conversations } from '@/data/mock';
import { useTheme } from '@/hooks/use-theme';
import type { ChatStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatList'>;

export function ChatListScreen({ navigation }: Props) {
  const theme = useTheme();

  return (
    <Screen padded={false} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Chat</Text>
      </View>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
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
            <Avatar name={item.title} />
            <View style={styles.rowText}>
              <View style={styles.rowTop}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.time, { color: theme.textSecondary }]}>{item.time}</Text>
              </View>
              <Text style={[styles.preview, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.lastMessage}
              </Text>
            </View>
            {item.unread ? <Badge label={String(item.unread)} variant="accent" /> : null}
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  title: { fontSize: 28, fontWeight: '700' },
  list: { paddingHorizontal: Spacing.four },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: 12,
  },
  rowText: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  name: { fontSize: 15, fontWeight: '600', flex: 1 },
  time: { fontSize: 12 },
  preview: { fontSize: 14 },
  sep: { height: StyleSheet.hairlineWidth },
});
