/**
 * Home — welcome page after login: centered logo + time-based greeting, an
 * agent selector, and a composer to immediately start a new conversation.
 *
 * Send a message → create a new session bound to the selected agent → open the
 * thread & auto-send the first message (with the composer's tool selections).
 */
import { DrawerScreenProps } from '@react-navigation/drawer';
import { useHeaderHeight } from '@react-navigation/elements';
import { useFocusEffect } from '@react-navigation/native';
import { Check, ChevronDown } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Composer, type ComposerOptions } from '@/components/chat/composer';
import { Logo, Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { Agent, createChatSession, getAgents } from '@/lib/api';
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

/** Choose the initial agent: user default → system default → "general" → first. */
function pickInitialAgent(agents: Agent[], defaultId: string | null): Agent | null {
  if (!agents.length) return null;
  return (
    agents.find((a) => a.id === defaultId) ??
    agents.find((a) => a.isSystemDefault) ??
    agents.find((a) => a.id === 'general') ??
    agents[0]
  );
}

export function HomeScreen({ navigation }: Props) {
  const theme = useTheme();
  const headerHeight = useHeaderHeight();
  const { token, user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Load agents on focus so freshly created ones show up, but keep the user's
  // current selection if it still exists.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!token) return;
        try {
          const { assistants, defaultAssistantId } = await getAgents(token);
          if (!active) return;
          setAgents(assistants);
          setAgent((prev) =>
            prev && assistants.some((a) => a.id === prev.id)
              ? prev
              : pickInitialAgent(assistants, defaultAssistantId),
          );
        } catch {
          // Non-fatal: fall back to the default "general" agent on send.
        }
      })();
      return () => {
        active = false;
      };
    }, [token]),
  );

  const name = user?.name || user?.email || 'User';
  const greeting = greetingFor(new Date().getHours());

  /** Create the session then open the thread; the first message is sent there. */
  async function startChat(content: string, options: ComposerOptions) {
    if (!token || creating) return;
    setError(null);
    setCreating(true);
    try {
      const session = await createChatSession(token, agent?.id ?? 'general', titleFrom(content));
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

        <View style={styles.agentBar}>
          <Pressable
            onPress={() => setPickerOpen(true)}
            disabled={!agents.length}
            style={[
              styles.chip,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            <Text style={styles.chipEmoji}>{agent?.emoji ?? '🤖'}</Text>
            <Text style={[styles.chipText, { color: theme.text }]} numberOfLines={1}>
              {agent?.name ?? 'Just Chat'}
            </Text>
            <ChevronDown color={theme.textSecondary} size={16} />
          </Pressable>
        </View>

        <Composer
          placeholder="Ask something to get started…"
          sending={creating}
          error={error}
          onSend={startChat}
        />
      </KeyboardAvoidingView>

      {/* Agent picker */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Choose an agent</Text>
            <FlatList
              data={agents}
              keyExtractor={(a) => a.id}
              style={styles.sheetList}
              ItemSeparatorComponent={() => (
                <View style={[styles.sep, { backgroundColor: theme.border }]} />
              )}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setAgent(item);
                    setPickerOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.sheetItem,
                    pressed && { backgroundColor: theme.backgroundElement },
                  ]}>
                  <Text style={styles.chipEmoji}>{item.emoji || '🤖'}</Text>
                  <View style={styles.flex}>
                    <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.description ? (
                      <Text
                        style={[styles.itemDesc, { color: theme.textSecondary }]}
                        numberOfLines={1}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                  {item.id === agent?.id ? <Check color={theme.accent} size={18} /> : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
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
  agentBar: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: '100%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  chipEmoji: { fontSize: 18 },
  chipText: { fontSize: FontSize.base, fontWeight: FontWeight.medium, flexShrink: 1 },

  // picker
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
    maxHeight: '70%',
  },
  sheetTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  sheetList: { flexGrow: 0 },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  itemName: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
  itemDesc: { fontSize: FontSize.sm },
  sep: { height: StyleSheet.hairlineWidth },
});
