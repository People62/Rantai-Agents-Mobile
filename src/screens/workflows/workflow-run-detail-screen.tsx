/**
 * WorkflowRunDetail — a single run's outcome and step-by-step trace. Polls every
 * 2s while the run is still PENDING/RUNNING, then stops.
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '@/components/ui';
import { Fonts, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { WorkflowRun, WorkflowStep, getWorkflowRun } from '@/lib/api';
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

        {run.error ? (
          <View style={[styles.errorBox, { backgroundColor: `${theme.destructive}12`, borderColor: theme.destructive }]}>
            <Text style={[styles.errorText, { color: theme.destructive }]}>{run.error}</Text>
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
                    <Field label="Input" value={pretty(step.input)} theme={theme} />
                  ) : null}
                  {step.output !== undefined ? (
                    <Field label="Output" value={pretty(step.output)} theme={theme} />
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
            <View style={[styles.codeBox, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.code, { color: theme.text }]}>{pretty(run.output)}</Text>
            </View>
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
  dot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  time: { fontSize: FontSize.sm },
  errorBox: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.three,
    marginTop: Spacing.one,
  },
  errorText: { fontSize: FontSize.sm, fontFamily: Fonts.mono },
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
