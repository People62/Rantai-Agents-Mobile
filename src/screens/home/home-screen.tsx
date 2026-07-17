/**
 * Home — welcome page after login: centered logo + time-based greeting,
 * and a composer to immediately start a new conversation.
 *
 * Send a message → create a new session → open the thread & auto-send the first
 * message (along with the tool selections from the composer).
 */
import { DrawerScreenProps } from '@react-navigation/drawer';
import { useHeaderHeight } from '@react-navigation/elements';
import { useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, Text, View } from 'react-native';

import { Composer, type ComposerOptions } from '@/components/chat/composer';
import { Logo, Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { createChatSession } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { DrawerParamList } from '@/navigation/types';

type Props = DrawerScreenProps<DrawerParamList, 'Home'>;

/**
 * Conversation title from the first message, so it matches the chat context
 * (without this the backend gives a default "New Chat" title).
 */
function titleFrom(content: string): string {
  const oneLine = content.replace(/\s+/g, ' ').trim();
  return oneLine.length > 40 ? `${oneLine.slice(0, 40).trim()}…` : oneLine;
}

/** Greeting based on the local hour. */
function greetingFor(hour: number): string {
  if (hour >= 4 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 21) return 'Good Evening';
  return 'Good Night';
}

export function HomeScreen({ navigation }: Props) {
  const theme = useTheme();
  const headerHeight = useHeaderHeight();
  const { token, user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = user?.name || user?.email || 'User';
  const greeting = greetingFor(new Date().getHours());

  /** Create the session then open the thread; the first message is sent there. */
  async function startChat(content: string, options: ComposerOptions) {
    if (!token || creating) return;
    setError(null);
    setCreating(true);
    try {
      const session = await createChatSession(token, 'general', titleFrom(content));
      navigation.navigate('ChatTab', {
        screen: 'ChatThread',
        params: {
          id: session.id,
          title: session.title,
          initialMessage: content,
          initialOptions: options,
        },
      });
    } catch (e) {
      setError('Failed to start the conversation. Try again.');
      throw e; // composer restores the text so it can be retried
    } finally {
      setCreating(false);
    }
  }

  return (
    <Screen padded={false} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={headerHeight}>
        <View style={styles.center}>
          <Logo width={132} />
          <Text style={[styles.greeting, { color: theme.text }]}>
            {greeting}, {name}
          </Text>
        </View>

        <Composer
          placeholder="Ask something to get started…"
          sending={creating}
          error={error}
          onSend={startChat}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  greeting: {
    fontSize: FontSize.title3,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
});
