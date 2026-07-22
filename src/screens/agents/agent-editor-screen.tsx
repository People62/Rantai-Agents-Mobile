/**
 * AgentEditor — create or edit an agent (assistant). MVP fields: emoji, name,
 * system prompt (persona), description, and model. Save writes to the backend
 * via POST/PUT /api/mobile/assistants and returns to the list.
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, ChevronDown } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import {
  AgentInput,
  AgentModel,
  createAgent,
  getAgent,
  getModels,
  updateAgent,
} from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { AgentStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AgentStackParamList, 'AgentEditor'>;

const MIN_PROMPT = 20;

export function AgentEditorScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { token } = useAuth();
  const editingId = route.params?.id;
  const isEditing = !!editingId;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [emoji, setEmoji] = useState('🤖');
  const [name, setName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState<string | null>(null);
  const [isBuiltIn, setIsBuiltIn] = useState(false);

  const [models, setModels] = useState<AgentModel[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const modelList = await getModels(token).catch(() => []);
      setModels(modelList);
      if (isEditing && editingId) {
        const agent = await getAgent(token, editingId);
        setEmoji(agent.emoji || '🤖');
        setName(agent.name);
        setSystemPrompt(agent.systemPrompt);
        setDescription(agent.description ?? '');
        setModel(agent.model);
        setIsBuiltIn(agent.isBuiltIn);
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
  const canSave =
    !!trimmedName && trimmedPrompt.length >= MIN_PROMPT && !saving;

  async function save() {
    if (!token || !canSave) return;
    setSaving(true);
    setError(null);
    const payload: AgentInput = {
      name: trimmedName,
      systemPrompt: trimmedPrompt,
      description: description.trim() || null,
      emoji: emoji || '🤖',
      ...(model ? { model } : {}),
    };
    try {
      if (isEditing && editingId) {
        await updateAgent(token, editingId, payload);
      } else {
        await createAgent(token, payload);
      }
      navigation.goBack();
    } catch {
      setError('Failed to save. Please try again.');
      setSaving(false);
    }
  }

  const selectedModelName =
    models.find((m) => m.id === model)?.name ?? model ?? 'Default model';

  if (loading) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          {/* Emoji + name */}
          <View style={styles.headerRow}>
            <TextInput
              value={emoji}
              onChangeText={(t) => setEmoji([...t].slice(-1).join('') || '🤖')}
              style={[
                styles.emoji,
                { backgroundColor: theme.backgroundElement, color: theme.text },
              ]}
              maxLength={2}
            />
            <View style={styles.flex}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Research Assistant"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
                ]}
              />
            </View>
          </View>

          {isBuiltIn ? (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              This is a built-in agent. The name can’t be changed, but other fields can.
            </Text>
          ) : null}

          {/* System prompt */}
          <View>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                System prompt
              </Text>
              <Text
                style={[
                  styles.counter,
                  {
                    color:
                      trimmedPrompt.length >= MIN_PROMPT ? theme.textSecondary : theme.destructive,
                  },
                ]}>
                {trimmedPrompt.length}/{MIN_PROMPT}
              </Text>
            </View>
            <TextInput
              value={systemPrompt}
              onChangeText={setSystemPrompt}
              placeholder="Describe how the agent should behave, its role, tone, and rules…"
              placeholderTextColor={theme.textSecondary}
              multiline
              textAlignVertical="top"
              style={[
                styles.input,
                styles.textarea,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
              ]}
            />
          </View>

          {/* Description */}
          <View>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Description <Text style={styles.optional}>(optional)</Text>
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="A short summary shown in the list"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
              ]}
            />
          </View>

          {/* Model */}
          <View>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Model</Text>
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={[
                styles.input,
                styles.selectRow,
                { borderColor: theme.border, backgroundColor: theme.card },
              ]}>
              <Text style={[styles.selectText, { color: theme.text }]} numberOfLines={1}>
                {selectedModelName}
              </Text>
              <ChevronDown color={theme.textSecondary} size={18} />
            </Pressable>
          </View>

          {error ? (
            <Text style={[styles.error, { color: theme.destructive }]}>{error}</Text>
          ) : null}

          <Button
            label={isEditing ? 'Save changes' : 'Create agent'}
            onPress={save}
            loading={saving}
            disabled={!canSave}
            style={styles.save}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Model picker */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable
            style={[styles.pickerSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Choose a model</Text>
            <FlatList
              data={models}
              keyExtractor={(m) => m.id}
              style={styles.pickerList}
              ItemSeparatorComponent={() => (
                <View style={[styles.sep, { backgroundColor: theme.border }]} />
              )}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setModel(item.id);
                    setPickerOpen(false);
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
                    </Text>
                  </View>
                  {item.id === model ? <Check color={theme.accent} size={18} /> : null}
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four, gap: Spacing.four },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.three },
  emoji: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    textAlign: 'center',
    fontSize: 26,
    lineHeight: Platform.OS === 'ios' ? 0 : 56,
    padding: 0,
  },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: Spacing.two },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { fontSize: FontSize.xs, marginBottom: Spacing.two },
  optional: { fontWeight: FontWeight.regular },
  hint: { fontSize: FontSize.sm, marginTop: -Spacing.two },
  input: {
    minHeight: 46,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: FontSize.md,
  },
  textarea: { minHeight: 140 },
  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { flex: 1, fontSize: FontSize.md },
  error: { fontSize: FontSize.sm },
  save: { marginTop: Spacing.two },

  // picker
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerSheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
    maxHeight: '70%',
  },
  pickerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  pickerList: { flexGrow: 0 },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  pickerName: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
  pickerProvider: { fontSize: FontSize.sm },
  sep: { height: StyleSheet.hairlineWidth },
});
