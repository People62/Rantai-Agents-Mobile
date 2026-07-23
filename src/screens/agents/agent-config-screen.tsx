/**
 * AgentConfig — sectioned configuration for an agent (assistant), mirroring the
 * web Agent Builder tabs. Opened by tapping an agent (`id`), creating a blank
 * one (no params), or from a starter template (`template`).
 *
 * Editable sections (persisted to /api/mobile/assistants): Configure, Model,
 * Knowledge, Memory, Guard Rails, Chat. Web-only sections (Tools, Skills,
 * Workflows, MCP, Test, Deploy) are shown for parity but not editable here.
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  Cpu,
  MessageSquare,
  Minus,
  Play,
  Plus,
  Rocket,
  Search,
  Server,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
  Zap,
} from 'lucide-react-native';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
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

import { Button, Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import {
  AgentInput,
  AgentModel,
  AgentTool,
  ChatConfig,
  GuardRailsConfig,
  KnowledgeGroup,
  MemoryConfig,
  ModelConfig,
  createAgent,
  getAgent,
  getAgentToolIds,
  getKnowledgeGroups,
  getModels,
  getTools,
  setAgentTools,
  updateAgent,
} from '@/lib/api';
import { PROMPT_TEMPLATES } from '@/lib/agent-templates';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { AgentStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AgentStackParamList, 'AgentEditor'>;

const MIN_PROMPT = 20;
const MAX_QUESTIONS = 4;

type TabId =
  | 'configure'
  | 'model'
  | 'tools'
  | 'skills'
  | 'workflows'
  | 'mcp'
  | 'knowledge'
  | 'memory'
  | 'guardrails'
  | 'chat'
  | 'test'
  | 'deploy';

const TABS: { id: TabId; label: string; icon: typeof Settings; editable: boolean }[] = [
  { id: 'configure', label: 'Configure', icon: Settings, editable: true },
  { id: 'model', label: 'Model', icon: Cpu, editable: true },
  { id: 'tools', label: 'Tools', icon: Wrench, editable: true },
  { id: 'skills', label: 'Skills', icon: Zap, editable: false },
  { id: 'workflows', label: 'Workflows', icon: Share2, editable: false },
  { id: 'mcp', label: 'MCP', icon: Server, editable: false },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen, editable: true },
  { id: 'memory', label: 'Memory', icon: Brain, editable: true },
  { id: 'guardrails', label: 'Guard Rails', icon: ShieldCheck, editable: true },
  { id: 'chat', label: 'Chat', icon: MessageSquare, editable: true },
  { id: 'test', label: 'Test', icon: Play, editable: false },
  { id: 'deploy', label: 'Deploy', icon: Rocket, editable: false },
];

const RESPONSE_FORMATS: NonNullable<ModelConfig['responseFormat']>[] = [
  'default',
  'json',
  'markdown',
  'concise',
  'detailed',
];
const REASONING: NonNullable<ModelConfig['reasoningEffort']>[] = ['low', 'medium', 'high'];

const WEB_ONLY: Record<string, string> = {
  skills:
    'Attach reusable skills — bundles of tools and instructions the agent can invoke.',
  workflows: 'Let the agent trigger task workflows as part of a conversation.',
  mcp: 'Connect Model Context Protocol servers to extend the agent with external capabilities.',
  deploy: 'Publish the agent as a REST API, embeddable widget, or WebSocket endpoint.',
};

export function AgentConfigScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { token } = useAuth();
  const editingId = route.params?.id;
  const template = route.params?.template;
  const isEditing = !!editingId;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('configure');

  // --- Configure ---
  const [emoji, setEmoji] = useState(template?.emoji ?? '🤖');
  const [name, setName] = useState(template?.name ?? '');
  const [systemPrompt, setSystemPrompt] = useState(template?.systemPrompt ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [tags, setTags] = useState<string[]>(template?.tags ?? []);
  const [openingMessage, setOpeningMessage] = useState(template?.openingMessage ?? '');
  const [openingQuestions, setOpeningQuestions] = useState<string[]>(
    template?.openingQuestions ?? [],
  );
  const [liveChatEnabled, setLiveChatEnabled] = useState(template?.liveChatEnabled ?? false);
  const [isBuiltIn, setIsBuiltIn] = useState(false);

  // --- Model ---
  const [model, setModel] = useState<string | null>(template?.model ?? null);
  const [mc, setMc] = useState<ModelConfig>({
    temperature: 0.7,
    topP: 1,
    maxTokens: 2048,
    presencePenalty: 0,
    frequencyPenalty: 0,
    reasoningEffort: 'medium',
    responseFormat: 'default',
    ...(template?.modelConfig ?? {}),
  });

  // --- Knowledge ---
  const [useKb, setUseKb] = useState(template?.useKnowledgeBase ?? false);
  const [kbGroupIds, setKbGroupIds] = useState<string[]>(template?.knowledgeBaseGroupIds ?? []);
  const [kbGroups, setKbGroups] = useState<KnowledgeGroup[]>([]);

  // --- Memory ---
  const [mem, setMem] = useState<MemoryConfig>({
    enabled: false,
    workingMemory: true,
    semanticRecall: false,
    longTermProfile: false,
    memoryInstructions: '',
    ...(template?.memoryConfig ?? {}),
  });

  // --- Guard Rails ---
  const [gr, setGr] = useState<GuardRailsConfig>({
    blockedTopics: [],
    safetyInstructions: '',
    maxResponseLength: 0,
    requireCitations: false,
    ...(template?.guardRails ?? {}),
  });

  // --- Chat ---
  const [chat, setChat] = useState<ChatConfig>({
    autoCreateTopic: false,
    messageThreshold: 10,
    limitHistory: false,
    historyCount: 20,
    autoSummary: false,
    autoScroll: true,
    ...(template?.chatConfig ?? {}),
  });

  // --- Tools ---
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [toolIds, setToolIds] = useState<string[]>([]);
  const [toolsReady, setToolsReady] = useState(false);
  const [toolQuery, setToolQuery] = useState('');

  const [models, setModels] = useState<AgentModel[]>([]);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [promptPickerOpen, setPromptPickerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [modelList, groupsRes, toolList] = await Promise.all([
        getModels(token).catch(() => []),
        getKnowledgeGroups(token).catch(() => ({ groups: [], totalDocumentCount: 0 })),
        getTools(token).catch(() => null),
      ]);
      setModels(modelList);
      setKbGroups(groupsRes.groups);
      if (toolList) {
        setTools(toolList);
        setToolsReady(true);
      }
      if (isEditing && editingId) {
        const agent = await getAgent(token, editingId);
        setEmoji(agent.emoji || '🤖');
        setName(agent.name);
        setSystemPrompt(agent.systemPrompt);
        setDescription(agent.description ?? '');
        setTags(agent.tags ?? []);
        setOpeningMessage(agent.openingMessage ?? '');
        setOpeningQuestions(agent.openingQuestions ?? []);
        setLiveChatEnabled(agent.liveChatEnabled ?? false);
        setIsBuiltIn(agent.isBuiltIn);
        setModel(agent.model);
        if (agent.modelConfig) setMc((p) => ({ ...p, ...agent.modelConfig }));
        setUseKb(agent.useKnowledgeBase ?? false);
        setKbGroupIds(agent.knowledgeBaseGroupIds ?? []);
        if (agent.memoryConfig) setMem((p) => ({ ...p, ...agent.memoryConfig }));
        if (agent.guardRails) setGr((p) => ({ ...p, ...agent.guardRails }));
        if (agent.chatConfig) setChat((p) => ({ ...p, ...agent.chatConfig }));
        const boundIds = await getAgentToolIds(token, editingId).catch(() => null);
        if (boundIds) {
          // Show only catalog (user-selectable) tools; hidden bindings (e.g. MCP)
          // are preserved server-side by setAssistantTools on save.
          setToolIds(
            toolList ? boundIds.filter((id) => toolList.some((t) => t.id === id)) : boundIds,
          );
        }
      }
    } catch {
      setError('Failed to load. Go back and try again.');
    } finally {
      setLoading(false);
    }
  }, [token, isEditing, editingId]);

  useEffect(() => {
    load();
  }, [load]);

  const trimmedName = name.trim();
  const trimmedPrompt = systemPrompt.trim();
  const canSave = !!trimmedName && trimmedPrompt.length >= MIN_PROMPT && !saving;

  const save = useCallback(async () => {
    if (!token || !canSave) return;
    setSaving(true);
    setError(null);
    const payload: AgentInput = {
      name: trimmedName,
      systemPrompt: trimmedPrompt,
      description: description.trim() || null,
      emoji: emoji || '🤖',
      tags,
      openingMessage: openingMessage.trim() || null,
      openingQuestions,
      liveChatEnabled,
      useKnowledgeBase: useKb,
      knowledgeBaseGroupIds: kbGroupIds,
      modelConfig: mc,
      memoryConfig: mem,
      guardRails: gr,
      chatConfig: chat,
      ...(model ? { model } : {}),
    };
    try {
      const agentId =
        isEditing && editingId
          ? (await updateAgent(token, editingId, payload), editingId)
          : (await createAgent(token, payload)).id;
      // Persist tool bindings only when the catalog loaded, so a failed fetch
      // can't silently wipe existing bindings.
      if (toolsReady) {
        await setAgentTools(token, agentId, toolIds);
      }
      navigation.goBack();
    } catch {
      setError('Failed to save. Please try again.');
      setSaving(false);
    }
  }, [
    token, canSave, trimmedName, trimmedPrompt, description, emoji, tags, openingMessage,
    openingQuestions, liveChatEnabled, useKb, kbGroupIds, mc, mem, gr, chat, model,
    isEditing, editingId, navigation, toolsReady, toolIds,
  ]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Edit Agent' : template ? 'New from Template' : 'New Agent',
      headerRight: () =>
        saving ? (
          <ActivityIndicator color={theme.accent} style={{ marginRight: Spacing.two }} />
        ) : (
          <Pressable
            onPress={save}
            disabled={!canSave}
            hitSlop={8}
            style={{ paddingHorizontal: Spacing.three, paddingVertical: Spacing.one }}>
            <Text
              style={{
                color: canSave ? theme.accent : theme.textSecondary,
                fontSize: FontSize.md,
                fontWeight: FontWeight.semibold,
              }}>
              Save
            </Text>
          </Pressable>
        ),
    });
  }, [navigation, save, canSave, saving, isEditing, template, theme]);

  const selectedModel = models.find((m) => m.id === model);
  const selectedModelName = selectedModel?.name ?? model ?? 'Default model';
  const modelSupportsTools = selectedModel ? selectedModel.hasToolCalling : true;
  const filteredTools = useMemo(() => {
    const q = toolQuery.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter(
      (t) =>
        t.displayName.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );
  }, [tools, toolQuery]);

  if (loading) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </Screen>
    );
  }

  const activeTab = TABS.find((t) => t.id === tab)!;

  return (
    <Screen padded={false} edges={['bottom']}>
      {/* Section tabs */}
      <View style={[styles.tabBarWrap, { borderBottomColor: theme.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.id === tab;
            return (
              <Pressable
                key={t.id}
                onPress={() => setTab(t.id)}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: active ? theme.accent : theme.backgroundElement,
                  },
                ]}>
                <Icon
                  color={active ? theme.accentForeground : theme.textSecondary}
                  size={15}
                />
                <Text
                  style={[
                    styles.tabChipText,
                    { color: active ? theme.accentForeground : theme.text },
                  ]}>
                  {t.label}
                </Text>
                {!t.editable ? (
                  <View
                    style={[
                      styles.tabDot,
                      { backgroundColor: active ? theme.accentForeground : theme.textSecondary },
                    ]}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          {activeTab.editable ? null : (
            <WebOnly theme={theme} label={activeTab.label} icon={activeTab.icon}
              message={
                tab === 'test'
                  ? 'Save the agent, then open the Chat tab to talk to it.'
                  : WEB_ONLY[tab] ?? 'This section is managed in the web app.'
              }
            />
          )}

          {tab === 'configure' ? (
            <View style={styles.section}>
              <View style={styles.headerRow}>
                <TextInput
                  value={emoji}
                  onChangeText={(t) => setEmoji([...t].slice(-1).join('') || '🤖')}
                  style={[styles.emoji, { backgroundColor: theme.backgroundElement, color: theme.text }]}
                  maxLength={2}
                />
                <View style={styles.flex}>
                  <FieldLabel theme={theme} text="Name" required />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    editable={!isBuiltIn}
                    placeholder="e.g. Research Assistant"
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.input,
                      {
                        color: isBuiltIn ? theme.textSecondary : theme.text,
                        borderColor: theme.border,
                        backgroundColor: theme.card,
                      },
                    ]}
                  />
                </View>
              </View>
              {isBuiltIn ? (
                <Text style={[styles.hint, { color: theme.textSecondary }]}>
                  Built-in agent — the name can’t be changed, but other fields can.
                </Text>
              ) : null}

              <View>
                <FieldLabel theme={theme} text="Description" optional />
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="A short summary shown in the list"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                />
              </View>

              <View>
                <FieldLabel theme={theme} text="Tags" optional />
                <ListEditor
                  theme={theme}
                  items={tags}
                  onChange={setTags}
                  placeholder="Add a tag…"
                  asChips
                />
              </View>

              <View>
                <View style={styles.labelRow}>
                  <FieldLabel theme={theme} text="System prompt" required noMargin />
                  <Pressable
                    onPress={() => setPromptPickerOpen(true)}
                    style={styles.templateBtn}>
                    <Sparkles color={theme.accent} size={13} />
                    <Text style={[styles.templateBtnText, { color: theme.accent }]}>
                      Start from a template
                    </Text>
                  </Pressable>
                </View>
                <TextInput
                  value={systemPrompt}
                  onChangeText={setSystemPrompt}
                  placeholder="Describe how the agent should behave, its role, tone, and rules…"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  textAlignVertical="top"
                  style={[styles.input, styles.textarea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                />
                <Text
                  style={[
                    styles.counter,
                    { color: trimmedPrompt.length >= MIN_PROMPT ? theme.textSecondary : theme.destructive },
                  ]}>
                  {trimmedPrompt.length}/{MIN_PROMPT} min
                </Text>
              </View>

              <View>
                <FieldLabel theme={theme} text="Opening message" optional />
                <TextInput
                  value={openingMessage}
                  onChangeText={setOpeningMessage}
                  placeholder="Hello! How can I help you today?"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card, minHeight: 60 }]}
                />
              </View>

              <View>
                <FieldLabel
                  theme={theme}
                  text={`Conversation starters (${openingQuestions.length}/${MAX_QUESTIONS})`}
                  optional
                />
                <ListEditor
                  theme={theme}
                  items={openingQuestions}
                  onChange={setOpeningQuestions}
                  placeholder="Add a suggested question…"
                  max={MAX_QUESTIONS}
                />
              </View>

              <Toggle
                theme={theme}
                label="Live chat handoff"
                hint="Allow the agent to escalate to a human agent."
                value={liveChatEnabled}
                onValueChange={setLiveChatEnabled}
              />
            </View>
          ) : null}

          {tab === 'model' ? (
            <View style={styles.section}>
              <View>
                <FieldLabel theme={theme} text="Model" />
                <Pressable
                  onPress={() => setModelPickerOpen(true)}
                  style={[styles.input, styles.selectRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
                  <Text style={[styles.selectText, { color: theme.text }]} numberOfLines={1}>
                    {selectedModelName}
                  </Text>
                  <ChevronDown color={theme.textSecondary} size={18} />
                </Pressable>
              </View>

              <Stepper theme={theme} label="Temperature" value={mc.temperature ?? 0.7}
                min={0} max={2} step={0.1} decimals={1} onChange={(v) => setMc((p) => ({ ...p, temperature: v }))} />
              <Stepper theme={theme} label="Top P" value={mc.topP ?? 1}
                min={0} max={1} step={0.05} decimals={2} onChange={(v) => setMc((p) => ({ ...p, topP: v }))} />
              <Stepper theme={theme} label="Max tokens" value={mc.maxTokens ?? 2048}
                min={256} max={8192} step={256} decimals={0} onChange={(v) => setMc((p) => ({ ...p, maxTokens: v }))} />
              <Stepper theme={theme} label="Presence penalty" value={mc.presencePenalty ?? 0}
                min={-2} max={2} step={0.1} decimals={1} onChange={(v) => setMc((p) => ({ ...p, presencePenalty: v }))} />
              <Stepper theme={theme} label="Frequency penalty" value={mc.frequencyPenalty ?? 0}
                min={-2} max={2} step={0.1} decimals={1} onChange={(v) => setMc((p) => ({ ...p, frequencyPenalty: v }))} />

              <View>
                <FieldLabel theme={theme} text="Reasoning effort" />
                <ChipSelect
                  theme={theme}
                  options={REASONING.map((r) => ({ value: r, label: r }))}
                  value={mc.reasoningEffort ?? 'medium'}
                  onChange={(v) => setMc((p) => ({ ...p, reasoningEffort: v as ModelConfig['reasoningEffort'] }))}
                />
              </View>
              <View>
                <FieldLabel theme={theme} text="Response format" />
                <ChipSelect
                  theme={theme}
                  options={RESPONSE_FORMATS.map((r) => ({ value: r, label: r }))}
                  value={mc.responseFormat ?? 'default'}
                  onChange={(v) => setMc((p) => ({ ...p, responseFormat: v as ModelConfig['responseFormat'] }))}
                />
              </View>
            </View>
          ) : null}

          {tab === 'tools' ? (
            <View style={styles.section}>
              {!toolsReady ? (
                <Text style={[styles.hint, { color: theme.textSecondary }]}>
                  Couldn’t load the tool catalog. Go back and open the agent again.
                </Text>
              ) : (
                <>
                  {!modelSupportsTools ? (
                    <View style={[styles.warnBox, { backgroundColor: `${theme.destructive}14`, borderColor: `${theme.destructive}44` }]}>
                      <Text style={[styles.warnText, { color: theme.text }]}>
                        The selected model doesn’t support function calling, so bound tools won’t run. Pick a tool-capable model in the Model tab.
                      </Text>
                    </View>
                  ) : null}
                  <Text style={[styles.hint, { color: theme.textSecondary }]}>
                    {toolIds.length} selected · {tools.length} available
                  </Text>
                  <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                    <Search color={theme.textSecondary} size={16} />
                    <TextInput
                      value={toolQuery}
                      onChangeText={setToolQuery}
                      placeholder="Search tools…"
                      placeholderTextColor={theme.textSecondary}
                      style={[styles.searchInput, { color: theme.text }]}
                      autoCapitalize="none"
                      clearButtonMode="while-editing"
                    />
                  </View>
                  {filteredTools.length === 0 ? (
                    <Text style={[styles.hint, { color: theme.textSecondary }]}>
                      {tools.length ? 'No tools match your search.' : 'No tools available.'}
                    </Text>
                  ) : (
                    <View style={styles.toolList}>
                      {filteredTools.map((t) => {
                        const on = toolIds.includes(t.id);
                        return (
                          <Pressable
                            key={t.id}
                            onPress={() =>
                              setToolIds((prev) =>
                                on ? prev.filter((x) => x !== t.id) : [...prev, t.id],
                              )
                            }
                            style={[styles.toolRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <View style={[styles.toolIcon, { backgroundColor: theme.backgroundElement }]}>
                              <Wrench color={theme.textSecondary} size={16} />
                            </View>
                            <View style={styles.flex}>
                              <View style={styles.toolTop}>
                                <Text style={[styles.toolName, { color: theme.text }]} numberOfLines={1}>
                                  {t.displayName}
                                </Text>
                                <View style={[styles.toolCat, { backgroundColor: theme.backgroundElement }]}>
                                  <Text style={[styles.toolCatText, { color: theme.textSecondary }]}>
                                    {t.isBuiltIn ? 'Built-in' : t.category}
                                  </Text>
                                </View>
                              </View>
                              {t.description ? (
                                <Text style={[styles.toolDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                                  {t.description}
                                </Text>
                              ) : null}
                            </View>
                            <Switch
                              value={on}
                              onValueChange={(v) =>
                                setToolIds((prev) =>
                                  v ? [...prev, t.id] : prev.filter((x) => x !== t.id),
                                )
                              }
                              trackColor={{ true: theme.accent, false: theme.border }}
                              thumbColor="#fff"
                            />
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </>
              )}
            </View>
          ) : null}

          {tab === 'knowledge' ? (
            <View style={styles.section}>
              <Toggle
                theme={theme}
                label="Use knowledge base"
                hint="Let the agent retrieve from your documents (RAG)."
                value={useKb}
                onValueChange={setUseKb}
              />
              {useKb ? (
                <View>
                  <FieldLabel theme={theme} text="Document groups" />
                  <Text style={[styles.hint, { color: theme.textSecondary, marginBottom: Spacing.two }]}>
                    {kbGroupIds.length ? 'Only the selected groups are searched.' : 'All groups are searched.'}
                  </Text>
                  {kbGroups.length === 0 ? (
                    <Text style={[styles.hint, { color: theme.textSecondary }]}>
                      No knowledge base groups yet. Create them in the Files tab.
                    </Text>
                  ) : (
                    <View style={styles.chipWrap}>
                      {kbGroups.map((g) => {
                        const on = kbGroupIds.includes(g.id);
                        return (
                          <Pressable
                            key={g.id}
                            onPress={() =>
                              setKbGroupIds((prev) =>
                                on ? prev.filter((x) => x !== g.id) : [...prev, g.id],
                              )
                            }
                            style={[
                              styles.selectChip,
                              {
                                backgroundColor: on ? `${theme.accent}22` : theme.backgroundElement,
                                borderColor: on ? theme.accent : theme.border,
                              },
                            ]}>
                            {g.color ? (
                              <View style={[styles.dot, { backgroundColor: g.color }]} />
                            ) : null}
                            <Text style={[styles.selectChipText, { color: on ? theme.accent : theme.text }]}>
                              {g.name}
                            </Text>
                            {on ? <Check color={theme.accent} size={13} /> : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}

          {tab === 'memory' ? (
            <View style={styles.section}>
              <Toggle
                theme={theme}
                label="Enable memory"
                hint="Persist context and recall it across conversations."
                value={mem.enabled}
                onValueChange={(v) => setMem((p) => ({ ...p, enabled: v }))}
              />
              <Toggle theme={theme} label="Working memory" hint="Track the current conversation's key facts."
                value={mem.workingMemory} disabled={!mem.enabled}
                onValueChange={(v) => setMem((p) => ({ ...p, workingMemory: v }))} />
              <Toggle theme={theme} label="Semantic recall" hint="Retrieve relevant past messages by meaning."
                value={mem.semanticRecall} disabled={!mem.enabled}
                onValueChange={(v) => setMem((p) => ({ ...p, semanticRecall: v }))} />
              <Toggle theme={theme} label="Long-term profile" hint="Remember stable user preferences over time."
                value={mem.longTermProfile} disabled={!mem.enabled}
                onValueChange={(v) => setMem((p) => ({ ...p, longTermProfile: v }))} />
              <View>
                <FieldLabel theme={theme} text="Memory instructions" optional />
                <TextInput
                  value={mem.memoryInstructions ?? ''}
                  onChangeText={(v) => setMem((p) => ({ ...p, memoryInstructions: v }))}
                  editable={mem.enabled}
                  placeholder="What should the agent remember?"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  textAlignVertical="top"
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card, minHeight: 80 }]}
                />
              </View>
            </View>
          ) : null}

          {tab === 'guardrails' ? (
            <View style={styles.section}>
              <View>
                <FieldLabel theme={theme} text="Blocked topics" optional />
                <ListEditor
                  theme={theme}
                  items={gr.blockedTopics ?? []}
                  onChange={(v) => setGr((p) => ({ ...p, blockedTopics: v }))}
                  placeholder="Add a topic to block…"
                  asChips
                />
              </View>
              <View>
                <FieldLabel theme={theme} text="Safety instructions" optional />
                <TextInput
                  value={gr.safetyInstructions ?? ''}
                  onChangeText={(v) => setGr((p) => ({ ...p, safetyInstructions: v }))}
                  placeholder="Extra safety rules the agent must follow…"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  textAlignVertical="top"
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card, minHeight: 80 }]}
                />
              </View>
              <Stepper theme={theme} label="Max response length" value={gr.maxResponseLength ?? 0}
                min={0} max={4000} step={100} decimals={0} hint="0 = no limit"
                onChange={(v) => setGr((p) => ({ ...p, maxResponseLength: v }))} />
              <Toggle theme={theme} label="Require citations" hint="Responses must cite knowledge base sources."
                value={gr.requireCitations ?? false}
                onValueChange={(v) => setGr((p) => ({ ...p, requireCitations: v }))} />
            </View>
          ) : null}

          {tab === 'chat' ? (
            <View style={styles.section}>
              <Toggle theme={theme} label="Auto-create topics" hint="Start a new topic after several messages."
                value={chat.autoCreateTopic ?? false}
                onValueChange={(v) => setChat((p) => ({ ...p, autoCreateTopic: v }))} />
              {chat.autoCreateTopic ? (
                <Stepper theme={theme} label="Message threshold" value={chat.messageThreshold ?? 10}
                  min={2} max={50} step={1} decimals={0}
                  onChange={(v) => setChat((p) => ({ ...p, messageThreshold: v }))} />
              ) : null}
              <Toggle theme={theme} label="Limit history" hint="Only carry the most recent messages as context."
                value={chat.limitHistory ?? false}
                onValueChange={(v) => setChat((p) => ({ ...p, limitHistory: v }))} />
              {chat.limitHistory ? (
                <Stepper theme={theme} label="History count" value={chat.historyCount ?? 20}
                  min={2} max={100} step={1} decimals={0}
                  onChange={(v) => setChat((p) => ({ ...p, historyCount: v }))} />
              ) : null}
              <Toggle theme={theme} label="Auto summary" hint="Summarize long conversations automatically."
                value={chat.autoSummary ?? false}
                onValueChange={(v) => setChat((p) => ({ ...p, autoSummary: v }))} />
              <Toggle theme={theme} label="Auto scroll" hint="Scroll to the latest message as it streams."
                value={chat.autoScroll ?? true}
                onValueChange={(v) => setChat((p) => ({ ...p, autoScroll: v }))} />
            </View>
          ) : null}

          {error ? <Text style={[styles.error, { color: theme.destructive }]}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Model picker */}
      <Modal visible={modelPickerOpen} transparent animationType="slide" onRequestClose={() => setModelPickerOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setModelPickerOpen(false)}>
          <Pressable style={[styles.pickerSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Choose a model</Text>
            <FlatList
              data={models}
              keyExtractor={(m) => m.id}
              style={styles.pickerList}
              ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: theme.border }]} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setModel(item.id);
                    setModelPickerOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.pickerItem,
                    pressed && { backgroundColor: theme.backgroundElement },
                  ]}>
                  <View style={styles.flex}>
                    <Text style={[styles.pickerName, { color: theme.text }]}>{item.name}</Text>
                    <Text style={[styles.pickerProvider, { color: theme.textSecondary }]}>
                      {item.provider}
                      {item.isFree ? ' · Free' : ''}
                      {item.hasToolCalling ? ' · Tools' : ''}
                    </Text>
                  </View>
                  {item.id === model ? <Check color={theme.accent} size={18} /> : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Prompt template picker */}
      <Modal visible={promptPickerOpen} transparent animationType="slide" onRequestClose={() => setPromptPickerOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setPromptPickerOpen(false)}>
          <Pressable style={[styles.pickerSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Start from a template</Text>
            <FlatList
              data={PROMPT_TEMPLATES}
              keyExtractor={(t) => t.id}
              style={styles.pickerList}
              ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: theme.border }]} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setSystemPrompt(item.systemPrompt);
                    if (item.emoji) setEmoji(item.emoji);
                    setPromptPickerOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.pickerItem,
                    pressed && { backgroundColor: theme.backgroundElement },
                  ]}>
                  <Text style={styles.avatarEmoji}>{item.emoji}</Text>
                  <View style={styles.flex}>
                    <Text style={[styles.pickerName, { color: theme.text }]}>{item.name}</Text>
                    <Text style={[styles.pickerProvider, { color: theme.textSecondary }]} numberOfLines={1}>
                      {item.description}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Reusable field components
// ---------------------------------------------------------------------------

type Theme = ReturnType<typeof useTheme>;

function FieldLabel({
  theme, text, required, optional, noMargin,
}: { theme: Theme; text: string; required?: boolean; optional?: boolean; noMargin?: boolean }) {
  return (
    <Text style={[styles.label, { color: theme.textSecondary }, noMargin && { marginBottom: 0 }]}>
      {text}
      {required ? <Text style={{ color: theme.destructive }}> *</Text> : null}
      {optional ? <Text style={styles.optional}> (optional)</Text> : null}
    </Text>
  );
}

function Toggle({
  theme, label, hint, value, onValueChange, disabled,
}: {
  theme: Theme; label: string; hint?: string; value: boolean;
  onValueChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, disabled && { opacity: 0.5 }]}>
      <View style={styles.flex}>
        <Text style={[styles.toggleLabel, { color: theme.text }]}>{label}</Text>
        {hint ? <Text style={[styles.toggleHint, { color: theme.textSecondary }]}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: theme.accent, false: theme.border }}
        thumbColor="#fff"
      />
    </View>
  );
}

function Stepper({
  theme, label, value, min, max, step, onChange, decimals = 2, hint,
}: {
  theme: Theme; label: string; value: number; min: number; max: number;
  step: number; onChange: (v: number) => void; decimals?: number; hint?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 1000) / 1000));
  const fmt = (v: number) => (decimals === 0 ? String(Math.round(v)) : v.toFixed(decimals));
  return (
    <View style={styles.stepperRow}>
      <View style={styles.flex}>
        <Text style={[styles.toggleLabel, { color: theme.text }]}>{label}</Text>
        {hint ? <Text style={[styles.toggleHint, { color: theme.textSecondary }]}>{hint}</Text> : null}
      </View>
      <View style={[styles.stepper, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <Pressable
          onPress={() => onChange(clamp(value - step))}
          hitSlop={6}
          style={styles.stepBtn}>
          <Minus color={value <= min ? theme.textSecondary : theme.text} size={16} />
        </Pressable>
        <Text style={[styles.stepValue, { color: theme.text }]}>{fmt(value)}</Text>
        <Pressable
          onPress={() => onChange(clamp(value + step))}
          hitSlop={6}
          style={styles.stepBtn}>
          <Plus color={value >= max ? theme.textSecondary : theme.text} size={16} />
        </Pressable>
      </View>
    </View>
  );
}

function ChipSelect({
  theme, options, value, onChange,
}: {
  theme: Theme; options: { value: string; label: string }[];
  value: string; onChange: (v: string) => void;
}) {
  return (
    <View style={styles.chipWrap}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[
              styles.selectChip,
              {
                backgroundColor: on ? `${theme.accent}22` : theme.backgroundElement,
                borderColor: on ? theme.accent : theme.border,
              },
            ]}>
            <Text style={[styles.selectChipText, { color: on ? theme.accent : theme.text, textTransform: 'capitalize' }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ListEditor({
  theme, items, onChange, placeholder, max, asChips,
}: {
  theme: Theme; items: string[]; onChange: (v: string[]) => void;
  placeholder: string; max?: number; asChips?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const atMax = max != null && items.length >= max;
  const add = () => {
    const v = draft.trim();
    if (!v || atMax || items.includes(v)) {
      setDraft('');
      return;
    }
    onChange([...items, v]);
    setDraft('');
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <View style={styles.listEditor}>
      {!atMax ? (
        <View style={styles.listInputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            returnKeyType="done"
            blurOnSubmit={false}
            style={[styles.input, styles.flex, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
          />
          <Pressable
            onPress={add}
            style={[styles.addBtn, { backgroundColor: theme.accent }]}>
            <Plus color={theme.accentForeground} size={18} />
          </Pressable>
        </View>
      ) : null}
      {items.length ? (
        asChips ? (
          <View style={styles.chipWrap}>
            {items.map((it, i) => (
              <View key={`${it}-${i}`} style={[styles.tagChip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <Text style={[styles.tagChipText, { color: theme.text }]}>{it}</Text>
                <Pressable onPress={() => remove(i)} hitSlop={6}>
                  <X color={theme.textSecondary} size={13} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.listRows}>
            {items.map((it, i) => (
              <View key={`${it}-${i}`} style={[styles.listRow, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.listRowText, { color: theme.text }]} numberOfLines={2}>{it}</Text>
                <Pressable onPress={() => remove(i)} hitSlop={6}>
                  <X color={theme.textSecondary} size={16} />
                </Pressable>
              </View>
            ))}
          </View>
        )
      ) : null}
    </View>
  );
}

function WebOnly({
  theme, label, message, icon: Icon,
}: { theme: Theme; label: string; message: string; icon: typeof Settings }) {
  return (
    <View style={styles.webOnly}>
      <View style={[styles.webOnlyIcon, { backgroundColor: theme.backgroundElement }]}>
        <Icon color={theme.textSecondary} size={28} />
      </View>
      <Text style={[styles.webOnlyTitle, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.webOnlyMsg, { color: theme.textSecondary }]}>{message}</Text>
      <View style={[styles.webOnlyBadge, { backgroundColor: theme.backgroundElement }]}>
        <Text style={[styles.webOnlyBadgeText, { color: theme.textSecondary }]}>Manage on web</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.four },
  section: { gap: Spacing.four },

  tabBarWrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  tabBar: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, gap: Spacing.two },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
  },
  tabChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  tabDot: { width: 5, height: 5, borderRadius: 3, opacity: 0.7 },

  headerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.three },
  emoji: {
    width: 56, height: 56, borderRadius: Radius.full, textAlign: 'center',
    fontSize: 26, lineHeight: Platform.OS === 'ios' ? 0 : 56, padding: 0,
  },
  avatarEmoji: { fontSize: 24 },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: Spacing.two },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.two },
  optional: { fontWeight: FontWeight.regular },
  hint: { fontSize: FontSize.sm },
  counter: { fontSize: FontSize.xs, marginTop: 4, textAlign: 'right' },
  templateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  templateBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  input: {
    minHeight: 46, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: FontSize.md,
  },
  textarea: { minHeight: 150 },
  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { flex: 1, fontSize: FontSize.md },
  error: { fontSize: FontSize.sm },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  toggleLabel: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
  toggleHint: { fontSize: FontSize.sm, marginTop: 2 },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepper: {
    flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  stepBtn: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  stepValue: { minWidth: 52, textAlign: 'center', fontSize: FontSize.md, fontWeight: FontWeight.semibold },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  selectChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
    borderRadius: Radius.full, borderWidth: StyleSheet.hairlineWidth * 2,
  },
  selectChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  dot: { width: 10, height: 10, borderRadius: 5 },

  listEditor: { gap: Spacing.two },
  listInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  addBtn: { width: 46, height: 46, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  listRows: { gap: Spacing.two },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.md,
  },
  listRowText: { flex: 1, fontSize: FontSize.base },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.three, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: StyleSheet.hairlineWidth * 2,
  },
  tagChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

  // Tools
  warnBox: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.three,
  },
  warnText: { fontSize: FontSize.sm, lineHeight: 19 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 42,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, padding: 0 },
  toolList: { gap: Spacing.two },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  toolIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  toolName: { flexShrink: 1, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  toolCat: { paddingHorizontal: Spacing.two, paddingVertical: 1, borderRadius: Radius.full },
  toolCatText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, textTransform: 'capitalize' },
  toolDesc: { fontSize: FontSize.sm, marginTop: 2, lineHeight: 18 },

  webOnly: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
  webOnlyIcon: { width: 64, height: 64, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  webOnlyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  webOnlyMsg: { fontSize: FontSize.base, textAlign: 'center', lineHeight: 20, paddingHorizontal: Spacing.four },
  webOnlyBadge: { paddingHorizontal: Spacing.three, paddingVertical: 6, borderRadius: Radius.full, marginTop: Spacing.two },
  webOnlyBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  // Picker sheets
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerSheet: {
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2, paddingTop: Spacing.four, paddingBottom: Spacing.four, maxHeight: '70%',
  },
  pickerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  pickerList: { flexGrow: 0 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  pickerName: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
  pickerProvider: { fontSize: FontSize.sm },
  sep: { height: StyleSheet.hairlineWidth },
});
