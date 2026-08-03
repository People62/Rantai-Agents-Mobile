/**
 * WorkflowDetail — read-only summary of a workflow: status, trigger, variables,
 * and its steps as a linear (topologically ordered) list. Run it with an input
 * form, toggle deploy/pause, delete, and open recent runs.
 */
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronRight, ExternalLink, Play, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Screen } from '@/components/ui';
import { Scrim, Fonts, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import {
  Workflow,
  WorkflowRun,
  deleteWorkflow,
  getApiUrl,
  getWorkflow,
  getWorkflowRuns,
  runWorkflow,
  setWorkflowStatus,
} from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { WorkflowStackParamList } from '@/navigation/types';
import { WorkflowDiagram } from './workflow-diagram';
import {
  nodeLabel,
  nodeType,
  orderNodes,
  relativeTime,
  runStatusColor,
  workflowStatusColor,
} from './workflow-utils';

type Props = NativeStackScreenProps<WorkflowStackParamList, 'WorkflowDetail'>;

export function WorkflowDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const theme = useTheme();
  const { token } = useAuth();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [runOpen, setRunOpen] = useState(false);
  const [runInputs, setRunInputs] = useState<Record<string, string | boolean>>({});
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [flowView, setFlowView] = useState<'steps' | 'diagram'>('steps');

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [wf, runList] = await Promise.all([
        getWorkflow(token, id),
        getWorkflowRuns(token, id).catch(() => [] as WorkflowRun[]),
      ]);
      setWorkflow(wf);
      setRuns(runList);
    } catch {
      setError('Failed to load workflow.');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openRun() {
    const inputs = workflow?.variables?.inputs ?? [];
    const initial: Record<string, string | boolean> = {};
    for (const v of inputs) initial[v.name] = v.type === 'boolean' ? false : '';
    setRunInputs(initial);
    setRunError(null);
    setRunOpen(true);
  }

  async function submitRun() {
    if (!token || !workflow || running) return;
    const inputs = workflow.variables?.inputs ?? [];

    // Coerce each value to its declared type and enforce required fields.
    const payload: Record<string, unknown> = {};
    for (const v of inputs) {
      const raw = runInputs[v.name];
      if (v.type === 'boolean') {
        payload[v.name] = !!raw;
        continue;
      }
      const str = typeof raw === 'string' ? raw.trim() : '';
      if (!str) {
        if (v.required) {
          setRunError(`"${v.name}" is required.`);
          return;
        }
        continue; // optional & empty → omit
      }
      if (v.type === 'number') {
        const n = Number(str);
        if (Number.isNaN(n)) {
          setRunError(`"${v.name}" must be a number.`);
          return;
        }
        payload[v.name] = n;
      } else if (v.type === 'object' || v.type === 'array') {
        try {
          payload[v.name] = JSON.parse(str);
        } catch {
          setRunError(`"${v.name}" must be valid JSON.`);
          return;
        }
      } else {
        payload[v.name] = str;
      }
    }

    setRunError(null);
    setRunning(true);
    try {
      const run = await runWorkflow(token, workflow.id, payload);
      setRunOpen(false);
      navigation.navigate('WorkflowRunDetail', {
        workflowId: workflow.id,
        runId: run.id,
        name: workflow.name,
      });
    } catch {
      setError('Failed to start the run. Try again.');
      setRunOpen(false);
    } finally {
      setRunning(false);
    }
  }

  const openWeb = () =>
    workflow && Linking.openURL(`${getApiUrl()}/dashboard/workflows/${workflow.id}`);

  async function toggleStatus() {
    if (!token || !workflow || busy) return;
    const next = workflow.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setBusy(true);
    try {
      const updated = await setWorkflowStatus(token, workflow.id, next);
      setWorkflow((prev) => (prev ? { ...prev, status: updated.status } : prev));
    } catch {
      setError('Failed to update status.');
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!token || !workflow || busy) return;
    setBusy(true);
    try {
      await deleteWorkflow(token, workflow.id);
      setDeleteOpen(false);
      navigation.goBack();
    } catch {
      setError('Failed to delete.');
      setBusy(false);
    }
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

  if (!workflow) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={[styles.muted, { color: theme.destructive }]}>
            {error ?? 'Workflow not found.'}
          </Text>
        </View>
      </Screen>
    );
  }

  const inputs = workflow.variables?.inputs ?? [];
  const steps = orderNodes(workflow.nodes ?? [], workflow.edges ?? []);
  const statusColor = workflowStatusColor(theme, workflow.status);
  // Chatflow workflows are a streaming chat on the web — running them is blocked
  // on mobile, so we point users to the web instead of a Run button that 400s.
  const isChatflow = workflow.mode === 'CHATFLOW';

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Summary */}
        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: `${statusColor}22` }]}>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text style={[styles.badgeText, { color: statusColor }]}>{workflow.status}</Text>
          </View>
          <View style={[styles.tag, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.tagText, { color: theme.textSecondary }]}>{workflow.category}</Text>
          </View>
          <View style={[styles.tag, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.tagText, { color: theme.textSecondary }]}>
              Trigger: {workflow.trigger?.type ?? 'manual'}
            </Text>
          </View>
        </View>
        {workflow.description ? (
          <Text style={[styles.desc, { color: theme.textSecondary }]}>{workflow.description}</Text>
        ) : null}

        {error ? <Text style={[styles.error, { color: theme.destructive }]}>{error}</Text> : null}

        {/* Actions */}
        <View style={styles.actions}>
          {isChatflow ? (
            <Button
              label="Open chat on web"
              leftIcon={<ExternalLink color={theme.primaryForeground} size={18} />}
              onPress={openWeb}
              style={styles.flex}
            />
          ) : (
            <Button
              label="Run"
              leftIcon={<Play color={theme.primaryForeground} size={18} />}
              onPress={openRun}
              style={styles.flex}
            />
          )}
          <Button
            label={workflow.status === 'ACTIVE' ? 'Pause' : 'Deploy'}
            variant="secondary"
            onPress={toggleStatus}
            loading={busy}
            style={styles.flex}
          />
        </View>
        {isChatflow ? (
          <Text style={[styles.chatflowHint, { color: theme.textSecondary }]}>
            Chatflow workflows run as a chat on the web dashboard — not supported on mobile yet.
          </Text>
        ) : null}

        {/* Inputs */}
        {inputs.length ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Inputs</Text>
            {inputs.map((v) => (
              <View key={v.name} style={styles.varRow}>
                <Text style={[styles.varName, { color: theme.text }]}>
                  {v.name}
                  {v.required ? <Text style={{ color: theme.destructive }}> *</Text> : null}
                </Text>
                <Text style={[styles.varType, { color: theme.textSecondary }]}>
                  {v.type ?? 'string'}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Flow — steps list or visual diagram */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Flow ({steps.length})
            </Text>
            <View style={[styles.toggle, { backgroundColor: theme.backgroundElement }]}>
              {(['steps', 'diagram'] as const).map((v) => {
                const active = flowView === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => setFlowView(v)}
                    style={[styles.toggleBtn, active && { backgroundColor: theme.accent }]}>
                    <Text
                      style={[
                        styles.toggleText,
                        { color: active ? theme.accentForeground : theme.textSecondary },
                      ]}>
                      {v === 'steps' ? 'Steps' : 'Diagram'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {flowView === 'steps' ? (
            steps.map((n, i) => (
              <View key={n.id} style={styles.stepRow}>
                <View style={[styles.stepIndex, { backgroundColor: theme.backgroundElement }]}>
                  <Text style={[styles.stepIndexText, { color: theme.textSecondary }]}>{i + 1}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.stepLabel, { color: theme.text }]} numberOfLines={1}>
                    {nodeLabel(n)}
                  </Text>
                  <Text style={[styles.stepType, { color: theme.textSecondary }]}>{nodeType(n)}</Text>
                </View>
              </View>
            ))
          ) : (
            <WorkflowDiagram nodes={workflow.nodes ?? []} edges={workflow.edges ?? []} />
          )}
        </View>

        {/* Recent runs */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Recent runs ({runs.length})
          </Text>
          {runs.length === 0 ? (
            <Text style={[styles.muted, { color: theme.textSecondary }]}>No runs yet.</Text>
          ) : (
            runs.slice(0, 20).map((r) => (
              <Pressable
                key={r.id}
                onPress={() =>
                  navigation.navigate('WorkflowRunDetail', {
                    workflowId: workflow.id,
                    runId: r.id,
                    name: workflow.name,
                  })
                }
                style={({ pressed }) => [
                  styles.runRow,
                  pressed && { backgroundColor: theme.backgroundElement },
                ]}>
                <View
                  style={[styles.dot, { backgroundColor: runStatusColor(theme, r.status) }]}
                />
                <View style={styles.flex}>
                  <Text style={[styles.runStatus, { color: theme.text }]}>{r.status}</Text>
                  <Text style={[styles.runTime, { color: theme.textSecondary }]}>
                    {relativeTime(r.startedAt)}
                  </Text>
                </View>
                <ChevronRight color={theme.textSecondary} size={18} />
              </Pressable>
            ))
          )}
        </View>

        {/* Delete */}
        <Pressable
          onPress={() => setDeleteOpen(true)}
          style={({ pressed }) => [
            styles.deleteRow,
            pressed && { backgroundColor: `${theme.destructive}12` },
          ]}>
          <Trash2 color={theme.destructive} size={18} />
          <Text style={[styles.deleteText, { color: theme.destructive }]}>Delete workflow</Text>
        </Pressable>
      </ScrollView>

      {/* Run input modal */}
      <Modal
        visible={runOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRunOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setRunOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Run workflow</Text>
            {inputs.length === 0 ? (
              <Text style={[styles.muted, { color: theme.textSecondary }]}>
                This workflow takes no inputs.
              </Text>
            ) : (
              inputs.map((v) => {
                const val = runInputs[v.name];
                const label = (
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    {v.name}
                    {v.required ? <Text style={{ color: theme.destructive }}> *</Text> : null}
                    <Text style={styles.fieldType}> · {v.type ?? 'string'}</Text>
                  </Text>
                );
                if (v.type === 'boolean') {
                  return (
                    <View key={v.name} style={styles.boolField}>
                      {label}
                      <Switch
                        value={!!val}
                        onValueChange={(b) => setRunInputs((prev) => ({ ...prev, [v.name]: b }))}
                        trackColor={{ true: theme.accent, false: theme.border }}
                        thumbColor={theme.accentForeground}
                      />
                    </View>
                  );
                }
                const isJson = v.type === 'object' || v.type === 'array';
                return (
                  <View key={v.name} style={styles.field}>
                    {label}
                    <TextInput
                      value={typeof val === 'string' ? val : ''}
                      onChangeText={(t) => setRunInputs((prev) => ({ ...prev, [v.name]: t }))}
                      placeholder={v.description || (isJson ? '{ "key": "value" }' : v.type || 'value')}
                      placeholderTextColor={theme.textSecondary}
                      keyboardType={v.type === 'number' ? 'numeric' : 'default'}
                      multiline={isJson}
                      textAlignVertical={isJson ? 'top' : 'center'}
                      style={[
                        styles.input,
                        isJson && styles.jsonInput,
                        { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
                      ]}
                    />
                  </View>
                );
              })
            )}
            {runError ? (
              <Text style={[styles.runError, { color: theme.destructive }]}>{runError}</Text>
            ) : null}
            <Button label="Start run" onPress={submitRun} loading={running} style={styles.startBtn} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete confirm */}
      <Modal
        visible={deleteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => (busy ? undefined : setDeleteOpen(false))}>
        <Pressable style={styles.dialogBackdrop} onPress={() => (busy ? undefined : setDeleteOpen(false))}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.dangerIcon, { backgroundColor: `${theme.destructive}1A` }]}>
              <Trash2 color={theme.destructive} size={26} />
            </View>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>Delete workflow?</Text>
            <Text style={[styles.dialogMessage, { color: theme.textSecondary }]}>
              <Text style={{ color: theme.text, fontWeight: FontWeight.semibold }}>{workflow.name}</Text>
              {' and its run history will be permanently deleted.'}
            </Text>
            <View style={styles.dialogActions}>
              <Button label="Cancel" variant="outline" onPress={() => setDeleteOpen(false)} disabled={busy} style={styles.flex} />
              <Button label="Delete" variant="destructive" onPress={doDelete} loading={busy} style={styles.flex} />
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
  content: { padding: Spacing.four, gap: Spacing.three },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  dot: { width: 7, height: 7, borderRadius: Radius.full },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  tag: { paddingHorizontal: Spacing.two, paddingVertical: 3, borderRadius: Radius.full },
  tagText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  desc: { fontSize: FontSize.base, lineHeight: 20 },
  error: { fontSize: FontSize.sm },
  actions: { flexDirection: 'row', gap: Spacing.two },
  chatflowHint: { fontSize: FontSize.sm, lineHeight: 19 },
  section: { gap: Spacing.two, marginTop: Spacing.two },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  toggle: { flexDirection: 'row', borderRadius: Radius.full, padding: Spacing.half },
  toggleBtn: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Radius.full },
  toggleText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  varRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.one },
  varName: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  varType: { fontSize: FontSize.sm },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.one + 2 },
  stepIndex: { width: 26, height: 26, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  stepIndexText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  stepLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  stepType: { fontSize: FontSize.xs },
  runRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three, borderRadius: Radius.md },
  runStatus: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  runTime: { fontSize: FontSize.xs },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.md,
  },
  deleteText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  muted: { fontSize: FontSize.base },

  // Run modal
  backdrop: { flex: 1, backgroundColor: Scrim, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  field: { gap: Spacing.one },
  boolField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  fieldType: { fontWeight: FontWeight.regular },
  input: {
    height: 46,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
    fontSize: FontSize.md,
  },
  jsonInput: { height: 90, paddingTop: Spacing.two, fontFamily: Fonts.mono, fontSize: FontSize.sm },
  runError: { fontSize: FontSize.sm },
  startBtn: { marginTop: Spacing.one },

  // Delete dialog
  dialogBackdrop: { flex: 1, backgroundColor: Scrim, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  dialog: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  dangerIcon: { width: 56, height: 56, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  dialogTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  dialogMessage: { fontSize: FontSize.base, textAlign: 'center', lineHeight: 20 },
  dialogActions: { flexDirection: 'row', gap: Spacing.two, alignSelf: 'stretch' },
});
