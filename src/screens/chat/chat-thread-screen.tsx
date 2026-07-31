/**
 * ChatThread — a session's messages from the backend + sending messages (AI reply).
 * The Composer (input, tools, attachments) is shared with the Home screen.
 */
import Clipboard from '@react-native-clipboard/clipboard';
import { useHeaderHeight } from '@react-navigation/elements';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Check,
  Copy,
  LayoutGrid,
  LucideIcon,
  MessageSquare,
  RefreshCw,
  Reply,
  Trash2,
} from 'lucide-react-native';
import { Fragment, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ARTIFACT_TYPES, Composer, type ComposerOptions } from '@/components/chat/composer';
import { MessageContent } from '@/components/chat/message-content';
import { Button, EmptyState, Screen } from '@/components/ui';
import { Scrim, BorderWidth, Fonts, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import {
  ChatArtifact,
  ChatSessionMessage,
  deleteChatMessages,
  getChatSession,
  regenerateReply,
  sendChatAndReply,
} from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { ChatStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatThread'>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** "HH:MM" in local time (manual, avoiding Intl for Hermes safety). */
function timeLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Calendar-day key (year-month-day) used to detect day boundaries. */
function dayKey(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** "Today" / "Yesterday" / "12 Jul 2026" for a day separator. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Animated three-dot "assistant is typing" indicator. */
function TypingDots({ color }: { color: string }) {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const c = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const mk = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ]),
      );
    const anims = [mk(a, 0), mk(b, 150), mk(c, 300)];
    anims.forEach((x) => x.start());
    return () => anims.forEach((x) => x.stop());
  }, [a, b, c]);

  const dotStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
  });

  return (
    <View style={styles.typingRow}>
      {[a, b, c].map((v, i) => (
        <Animated.View key={i} style={[styles.typingDot, { backgroundColor: color }, dotStyle(v)]} />
      ))}
    </View>
  );
}

/** Small action button below an assistant reply. */
function MsgAction({
  icon: Icon,
  label,
  tint,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}>
      <Icon color={tint} size={15} />
      <Text style={[styles.actionLabel, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

export function ChatThreadScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const headerHeight = useHeaderHeight();
  const { token } = useAuth();
  const [messages, setMessages] = useState<ChatSessionMessage[]>([]);
  const [artifacts, setArtifacts] = useState<ChatArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const autoSentRef = useRef(false);
  /** Id of the message just copied (for the checkmark icon feedback). */
  const [copiedId, setCopiedId] = useState<string | null>(null);
  /** Last options used — reused when regenerating. */
  const lastOptionsRef = useRef<ComposerOptions | null>(null);
  /** Message being replied to (reply feature). */
  const [replyingTo, setReplyingTo] = useState<ChatSessionMessage | null>(null);
  /** Message awaiting delete confirmation. */
  const [confirmDel, setConfirmDel] = useState<ChatSessionMessage | null>(null);

  function copyMessage(m: ChatSessionMessage) {
    Clipboard.setString(m.content);
    setCopiedId(m.id);
    setTimeout(() => setCopiedId((id) => (id === m.id ? null : id)), 1500);
  }

  /** Run the delete after the user confirms in the dialog. */
  async function confirmDelete() {
    const m = confirmDel;
    setConfirmDel(null);
    if (m) await deleteMessage(m);
  }

  async function deleteMessage(m: ChatSessionMessage) {
    if (!token) return;
    const before = messages;
    setMessages((prev) => prev.filter((x) => x.id !== m.id)); // optimistic
    try {
      await deleteChatMessages(token, route.params.id, [m.id]);
    } catch {
      setMessages(before); // restore on failure
      setSendError('Failed to delete message.');
    }
  }

  /** Regenerate the last reply using the same options as before. */
  async function regenerate() {
    if (!token || sending) return;
    setSendError(null);
    setSending(true);
    // Hide the old reply first so it feels "replaced".
    const before = messages;
    setMessages((prev) => {
      const next = [...prev];
      while (next.length > 0 && next[next.length - 1].role === 'assistant') next.pop();
      return next;
    });
    try {
      const opts = lastOptionsRef.current;
      const { reply } = await regenerateReply(token, route.params.id, {
        enableWebSearch: opts?.enableWebSearch,
        enableCodeInterpreter: opts?.enableCodeInterpreter,
        enabledToolNames: opts?.enabledToolNames,
        enabledSkillIds: opts?.enabledSkillIds,
        canvasMode: opts?.canvasMode,
      });
      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: 'assistant', content: reply, createdAt: new Date().toISOString() },
      ]);
    } catch {
      setMessages(before);
      setSendError('Failed to regenerate reply. Try again.');
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        const detail = await getChatSession(token, route.params.id);
        setMessages(detail.messages);
        setArtifacts(detail.artifacts ?? []);
      } catch {
        setError('Failed to load messages.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, route.params.id]);

  /** Send to the backend & get the AI reply (optimistic). Throws on failure. */
  async function send(content: string, options: ComposerOptions) {
    if (!token || sending) return;

    lastOptionsRef.current = options;
    const replyToId = replyingTo?.id;
    const tempId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: 'user', content, replyTo: replyToId ?? null, createdAt: new Date().toISOString() },
    ]);
    setReplyingTo(null);
    setSendError(null);
    setSending(true);

    try {
      const { reply } = await sendChatAndReply(
        token,
        route.params.id,
        content,
        {
          enableWebSearch: options.enableWebSearch,
          enableCodeInterpreter: options.enableCodeInterpreter,
          enabledToolNames: options.enabledToolNames,
          enabledSkillIds: options.enabledSkillIds,
          canvasMode: options.canvasMode,
          fileContext: options.fileContext,
        },
        replyToId,
      );
      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: 'assistant', content: reply, createdAt: new Date().toISOString() },
      ]);
      // Canvas may produce new artifacts — refetch from the server.
      if (options.canvasMode) {
        getChatSession(token, route.params.id)
          .then((d) => setArtifacts(d.artifacts ?? []))
          .catch(() => {});
      }
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setSendError('Failed to send / get a reply. Try again.');
      throw e;
    } finally {
      setSending(false);
    }
  }

  // Initial message from Home: auto-send once after loading completes.
  useEffect(() => {
    const initial = route.params.initialMessage;
    if (!loading && token && initial && !autoSentRef.current) {
      autoSentRef.current = true;
      const opts = route.params.initialOptions;
      navigation.setParams({ initialMessage: undefined, initialOptions: undefined });
      send(initial, {
        enableWebSearch: opts?.enableWebSearch ?? false,
        enableCodeInterpreter: opts?.enableCodeInterpreter ?? false,
        enabledToolNames: opts?.enabledToolNames ?? [],
        enabledSkillIds: opts?.enabledSkillIds ?? [],
        canvasMode: opts?.canvasMode,
        fileContext: opts?.fileContext,
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, token, route.params.initialMessage]);

  return (
    <Screen padded={false} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={headerHeight}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={{ color: theme.destructive, fontSize: FontSize.base }}>{error}</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.messages}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
            {messages.length === 0 && !sending ? (
              <View style={styles.emptyThread}>
                <EmptyState
                  icon={MessageSquare}
                  title="No messages yet"
                  subtitle="Send a message to start the conversation."
                />
              </View>
            ) : (
              messages.map((m, i) => {
                const mine = m.role === 'user';
                // Regenerate only for the very last assistant reply.
                const isLastAssistant = !mine && i === messages.length - 1;
                const quoted = m.replyTo
                  ? messages.find((x) => x.id === m.replyTo)
                  : undefined;
                // Day separator when this message starts a new calendar day.
                const dkey = dayKey(m.createdAt);
                const showDay = !!dkey && dkey !== (i > 0 ? dayKey(messages[i - 1].createdAt) : '');
                // Code-bearing messages get more width so the code viewer isn't cramped.
                const hasCode = m.content.includes('```');
                return (
                  <Fragment key={m.id}>
                    {showDay ? (
                      <View style={styles.daySep}>
                        <Text
                          style={[
                            styles.dayText,
                            { color: theme.textSecondary, backgroundColor: theme.backgroundElement },
                          ]}>
                          {dayLabel(m.createdAt!)}
                        </Text>
                      </View>
                    ) : null}
                    <View style={mine ? styles.rowEnd : styles.rowStart}>
                    {/* Quote of the message being replied to */}
                    {quoted ? (
                      <View
                        style={[
                          styles.quote,
                          {
                            backgroundColor: theme.backgroundElement,
                            borderLeftColor: theme.accent,
                          },
                        ]}>
                        <Text
                          style={[styles.quoteText, { color: theme.textSecondary }]}
                          numberOfLines={2}>
                          {quoted.content}
                        </Text>
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.bubble,
                        {
                          alignSelf: mine ? 'flex-end' : 'flex-start',
                          backgroundColor: mine ? theme.chatBubbleMine : theme.backgroundElement,
                          maxWidth: hasCode ? '96%' : '82%',
                        },
                      ]}>
                      <MessageContent
                        content={m.content}
                        color={mine ? theme.chatBubbleMineText : theme.text}
                      />
                    </View>

                    {m.createdAt ? (
                      <Text
                        style={[
                          styles.time,
                          { color: theme.textSecondary, alignSelf: mine ? 'flex-end' : 'flex-start' },
                        ]}>
                        {timeLabel(m.createdAt)}
                      </Text>
                    ) : null}

                    {/* Message actions — only on assistant replies */}
                    {!mine && !sending ? (
                      <View style={styles.actions}>
                        <MsgAction
                          icon={copiedId === m.id ? Check : Copy}
                          label={copiedId === m.id ? 'Copied' : 'Copy'}
                          tint={copiedId === m.id ? theme.accent : theme.textSecondary}
                          onPress={() => copyMessage(m)}
                        />
                        <MsgAction
                          icon={Reply}
                          label="Reply"
                          tint={theme.textSecondary}
                          onPress={() => setReplyingTo(m)}
                        />
                        {isLastAssistant ? (
                          <MsgAction
                            icon={RefreshCw}
                            label="Regenerate"
                            tint={theme.textSecondary}
                            onPress={regenerate}
                          />
                        ) : null}
                        <MsgAction
                          icon={Trash2}
                          label="Delete"
                          tint={theme.destructive}
                          onPress={() => setConfirmDel(m)}
                        />
                      </View>
                    ) : null}
                    </View>
                  </Fragment>
                );
              })
            )}

            {sending ? (
              <View
                style={[
                  styles.bubble,
                  styles.typingBubble,
                  { alignSelf: 'flex-start', backgroundColor: theme.backgroundElement },
                ]}
                accessibilityLabel="Assistant is typing">
                <TypingDots color={theme.textSecondary} />
              </View>
            ) : null}

            {/* Artifacts produced by Canvas */}
            {artifacts.length > 0 ? (
              <View style={styles.artifactWrap}>
                <Text style={[styles.artifactSection, { color: theme.textSecondary }]}>
                  Artifact
                </Text>
                {artifacts.map((a) => (
                  <View
                    key={a.id}
                    style={[
                      styles.artifactCard,
                      { backgroundColor: theme.card, borderColor: theme.border },
                    ]}>
                    <View style={styles.artifactHead}>
                      <LayoutGrid color={theme.accent} size={18} />
                      <Text style={[styles.artifactTitle, { color: theme.text }]} numberOfLines={1}>
                        {a.title}
                      </Text>
                      <Text style={[styles.artifactType, { color: theme.textSecondary }]}>
                        {ARTIFACT_TYPES.find((t) => t.value === a.artifactType)?.label ??
                          a.artifactType}
                      </Text>
                    </View>
                    <Text
                      style={[styles.artifactCode, { color: theme.textSecondary }]}
                      numberOfLines={6}>
                      {a.content}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        )}

        <Composer
          placeholder={`Message ${route.params.title}…`}
          sessionId={route.params.id}
          sending={sending}
          error={sendError}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          onSend={send}
        />
      </KeyboardAvoidingView>

      {/* Delete-message confirmation */}
      <Modal
        visible={!!confirmDel}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDel(null)}>
        <Pressable style={styles.backdrop} onPress={() => setConfirmDel(null)}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.dangerIcon, { backgroundColor: `${theme.destructive}1A` }]}>
              <Trash2 color={theme.destructive} size={24} />
            </View>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>Delete message?</Text>
            <Text style={[styles.dialogMessage, { color: theme.textSecondary }]}>
              This message will be permanently deleted. This action cannot be undone.
            </Text>
            <View style={styles.dialogActions}>
              <Button
                label="Cancel"
                variant="outline"
                onPress={() => setConfirmDel(null)}
                style={styles.flex}
              />
              <Button
                label="Delete"
                variant="destructive"
                onPress={confirmDelete}
                style={styles.flex}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyThread: { marginTop: Spacing.six },
  messages: { padding: Spacing.four, gap: Spacing.two },
  rowStart: { alignItems: 'flex-start', gap: Spacing.half },
  rowEnd: { alignItems: 'flex-end', gap: Spacing.half },
  daySep: { alignItems: 'center', marginVertical: Spacing.two },
  dayText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.half,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  time: { fontSize: FontSize.xs, paddingHorizontal: Spacing.half },
  actions: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingLeft: Spacing.one,
    paddingBottom: Spacing.one,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  actionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  quote: {
    maxWidth: '82%',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.sm,
    borderLeftWidth: BorderWidth.accent,
  },
  quoteText: { fontSize: FontSize.xs },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.lg,
  },
  typingBubble: { paddingVertical: Spacing.three },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  typingDot: { width: 7, height: 7, borderRadius: Radius.full },
  artifactWrap: { gap: Spacing.two, marginTop: Spacing.two },
  artifactSection: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  artifactCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  artifactHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  artifactTitle: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  artifactType: { fontSize: FontSize.xs },
  artifactCode: { fontSize: FontSize.xs, fontFamily: Fonts.mono },

  // Delete-message confirmation dialog
  backdrop: {
    flex: 1,
    backgroundColor: Scrim,
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
  },
  dangerIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  dialogTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  dialogMessage: { fontSize: FontSize.base, textAlign: 'center', lineHeight: 20 },
  dialogActions: { flexDirection: 'row', gap: Spacing.two },
});
