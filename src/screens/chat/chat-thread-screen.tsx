/**
 * ChatThread — tampilan percakapan (bubble user/assistant) + input bar. Dummy.
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Input, Screen } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ChatStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatThread'>;

const DEMO = [
  { id: '1', role: 'assistant', text: 'Halo! Ada yang bisa saya bantu hari ini?' },
  { id: '2', role: 'user', text: 'Tolong ringkas penjualan minggu ini.' },
  { id: '3', role: 'assistant', text: 'Tentu. Total penjualan minggu ini naik 12% dibanding minggu lalu, dengan 3 produk teratas menyumbang 60% pendapatan.' },
] as const;

export function ChatThreadScreen({ route }: Props) {
  const theme = useTheme();
  const [text, setText] = useState('');

  return (
    <Screen padded={false} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={{ color: theme.destructive, fontSize: FontSize.base }}>{error}</Text>
          </View>
        ) : (
        <ScrollView contentContainerStyle={styles.messages}>
            {messages.length === 0 ? (
              <Text style={[styles.empty, { color: theme.textSecondary }]}>
                Belum ada pesan pada percakapan ini.
              </Text>
            ) : (
              messages.map((m) => {
            const mine = m.role === 'user';
            return (
              <View
                key={m.id}
                style={[
                  styles.bubble,
                  {
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    backgroundColor: mine ? theme.accent : theme.backgroundElement,
                  },
                ]}>
                    <Text
                      style={{
                        color: mine ? theme.accentForeground : theme.text,
                        fontSize: FontSize.md,
                      }}>
                      {m.content}
                </Text>
              </View>
            );
              })
            )}
        </ScrollView>
        )}
        <View style={[styles.inputBar, { borderTopColor: theme.border }]}>
          <View style={styles.flex}>
            <Input
              value={text}
              onChangeText={setText}
              placeholder={`Pesan ke ${route.params.title}…`}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', marginTop: Spacing.six, fontSize: FontSize.base },
  messages: { padding: Spacing.four, gap: Spacing.two },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.lg,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
