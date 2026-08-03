/**
 * WorkflowRunDetail — a single run's outcome and step-by-step trace. Polls every
 * 2s while the run is still PENDING/RUNNING, then stops.
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, CodeBlock, Screen } from '@/components/ui';
import { Fonts, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { WorkflowRun, WorkflowStep, getApiUrl, getWorkflowRun } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { WorkflowStackParamList } from '@/navigation/types';
import { isRunActive, relativeTime, runStatusColor, stepStatusColor } from './workflow-utils';

type Props = NativeStackScreenProps<WorkflowStackParamList, 'WorkflowRunDetail'>;

function pretty(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Compact duration: "820ms" / "4.2s" / "1m 3s". */
function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

export function WorkflowRunDetailScreen({ route }: Props) {
  const { workflowId, runId } = route.params;
  const theme = useTheme();
  const { token } = useAuth();

  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (!token) return;
      try {
        const r = await getWorkflowRun(token, workflowId, runId);
        if (cancelled) return;
        setRun(r);
        setLoading(false);
        if (isRunActive(r.status)) {
          timer.current = setTimeout(tick, 2000);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [token, workflowId, runId]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Auto-expand the step that is currently running so progress is visible.
  useEffect(() => {
    const running = run?.steps?.find((s) => s.status?.toLowerCase() === 'running');
    if (running) {
      setExpanded((prev) => (prev[running.stepId] ? prev : { ...prev, [running.stepId]: true }));
    }
  }, [run]);

  if (loading) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </Screen>
    );
  }

  if (!run) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={[styles.muted, { color: theme.destructive }]}>Run not found.</Text>
        </View>
      </Screen>
    );
  }

  const statusColor = runStatusColor(theme, run.status);
  const active = isRunActive(run.status);
  const steps = run.steps ?? [];
  const totalMs = steps.reduce((a, s) => a + (s.durationMs ?? 0), 0);
  const totalTok = steps.reduce((a, s) => a + (s.tokenUsage?.total ?? 0), 0);

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Run status header */}
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: `${statusColor}22` }]}>
            {active ? (
              <ActivityIndicator size="small" color={statusColor} />
            ) : (
              <View style={[styles.dot, { backgroundColor: statusColor }]} />
            )}
            <Text style={[styles.badgeText, { color: statusColor }]}>{run.status}</Text>
          </View>
          <Text style={[styles.time, { color: theme.textSecondary }]}>
            {relativeTime(run.startedAt)}
          </Text>
        </View>

        {steps.length ? (
          <Text style={[styles.summary, { color: theme.textSecondary }]}>
            {steps.length} step{steps.length === 1 ? '' : 's'}
            {totalMs ? ` · ${fmtDuration(totalMs)}` : ''}
            {totalTok ? ` · ${totalTok} tokens` : ''}
          </Text>
        ) : null}

        {run.error ? (
          <View style={[styles.errorBox, { backgroundColor: `${theme.destructive}12`, borderColor: theme.destructive }]}>
            <Text style={[styles.errorText, { color: theme.destructive }]}>{run.error}</Text>
          </View>
        ) : null}

        {/* Paused (human-in-the-loop) — mobile has no resume endpoint yet. */}
        {run.status === 'PAUSED' ? (
          <View style={[styles.pausedBox, { backgroundColor: `${theme.warning}14`, borderColor: theme.warning }]}>
            <Text style={[styles.pausedTitle, { color: theme.text }]}>Waiting for input</Text>
            <Text style={[styles.pausedText, { color: theme.textSecondary }]}>
              This run is paused for human input (an approval or a response). Resume it from the web
              dashboard.
            </Text>
            <Button
              label="Open on web"
              variant="outline"
              leftIcon={<ExternalLink color={theme.text} size={16} />}
              onPress={() => Linking.openURL(`${getApiUrl()}/dashboard/workflows/${workflowId}`)}
              style={styles.pausedBtn}
            />
          </View>
        ) : null}

        {/* Steps timeline */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Steps ({run.steps?.length ?? 0})
        </Text>
        {(run.steps ?? []).map((step: WorkflowStep) => {
          const open = !!expanded[step.stepId];
          const sColor = stepStatusColor(theme, step.status);
          return (
            <View
              key={step.stepId}
              style={[styles.step, { borderColor: theme.border, backgroundColor: theme.card }]}>
              <Pressable style={styles.stepHead} onPress={() => toggle(step.stepId)}>
                <View style={[styles.dot, { backgroundColor: sColor }]} />
                <View style={styles.flex}>
                  <Text style={[styles.stepLabel, { color: theme.text }]} numberOfLines={1}>
                    {step.label || step.nodeType}
                  </Text>
                  <Text style={[styles.stepMeta, { color: theme.textSecondary }]}>
                    {step.nodeType}
                    {typeof step.durationMs === 'number' ? ` · ${step.durationMs}ms` : ''}
                    {step.tokenUsage?.total ? ` · ${step.tokenUsage.total} tok` : ''}
                  </Text>
                </View>
                <Text style={[styles.stepStatus, { color: sColor }]}>{step.status}</Text>
                {open ? (
                  <ChevronDown color={theme.textSecondary} size={16} />
                ) : (
                  <ChevronRight color={theme.textSecondary} size={16} />
                )}
              </Pressable>
              {open ? (
                <View style={styles.stepBody}>
                  {step.error ? (
                    <Field label="Error" value={step.error} color={theme.destructive} theme={theme} />
                  ) : null}
                  {step.input !== undefined ? (
                    <LabeledCode label="Input" code={pretty(step.input)} theme={theme} />
                  ) : null}
                  {step.output !== undefined ? (
                    <LabeledCode label="Output" code={pretty(step.output)} theme={theme} />
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}

        {/* Final output */}
        {!active && run.output !== undefined && run.output !== null ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Output</Text>
            <CodeBlock code={pretty(run.output)} language="json" />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Field({
  label,
  value,
  color,
  theme,
}: {
  label: string;
  value: string;
  color?: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      <View style={[styles.codeBox, { backgroundColor: theme.backgroundElement }]}>
        <Text style={[styles.code, { color: color ?? theme.text }]}>{value || '—'}</Text>
      </View>
    </View>
  );
}

/** A labelled JSON payload rendered in the shared CodeBlock (mono + copy). */
function LabeledCode({
  label,
  code,
  theme,
}: {
  label: string;
  code: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      <CodeBlock code={code || '—'} language="json" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  muted: { fontSize: FontSize.base },
  content: { padding: Spacing.four, gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  badgeText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  time: { fontSize: FontSize.sm },
  summary: { fontSize: FontSize.sm, marginTop: Spacing.one },
  errorBox: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.three,
    marginTop: Spacing.one,
  },
  errorText: { fontSize: FontSize.sm, fontFamily: Fonts.mono },
  pausedBox: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.three,
    marginTop: Spacing.one,
    gap: Spacing.two,
  },
  pausedTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  pausedText: { fontSize: FontSize.sm, lineHeight: 19 },
  pausedBtn: { alignSelf: 'flex-start', marginTop: Spacing.one },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, marginTop: Spacing.two },
  section: { gap: Spacing.two },
  step: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three },
  stepLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  stepMeta: { fontSize: FontSize.xs },
  stepStatus: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  stepBody: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.two },
  fieldWrap: { gap: Spacing.one },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  codeBox: { borderRadius: Radius.sm, padding: Spacing.two },
  code: { fontSize: FontSize.xs, fontFamily: Fonts.mono },
});
