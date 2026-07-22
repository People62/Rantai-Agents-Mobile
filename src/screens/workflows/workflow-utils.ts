/**
 * Shared helpers for the workflow screens: status colors, relative time, and a
 * read-only topological ordering of the graph for the linear step list.
 */
import type {
  RunStatus,
  WorkflowEdge,
  WorkflowNode,
  WorkflowStatus,
} from '@/lib/api';

type StatusTheme = { accent: string; destructive: string; textSecondary: string };

// The theme has no dedicated success/warning tokens; use fixed literals.
const GREEN = '#16A34A';
const AMBER = '#D97706';

export function workflowStatusColor(theme: StatusTheme, status: WorkflowStatus): string {
  switch (status) {
    case 'ACTIVE':
      return GREEN;
    case 'PAUSED':
      return AMBER;
    case 'ARCHIVED':
      return theme.textSecondary;
    default:
      return theme.textSecondary; // DRAFT
  }
}

export function runStatusColor(theme: StatusTheme, status: RunStatus): string {
  switch (status) {
    case 'COMPLETED':
      return GREEN;
    case 'FAILED':
      return theme.destructive;
    case 'RUNNING':
    case 'PENDING':
      return theme.accent;
    case 'PAUSED':
      return AMBER;
    default:
      return theme.textSecondary;
  }
}

/** A step's status ("success"/"failed"/"running"/…) → color. */
export function stepStatusColor(theme: StatusTheme, status: string): string {
  const s = status.toLowerCase();
  if (s === 'success' || s === 'completed') return GREEN;
  if (s === 'failed' || s === 'error') return theme.destructive;
  if (s === 'running' || s === 'pending') return theme.accent;
  return theme.textSecondary;
}

/** True while a run is still in progress (used to keep polling). */
export function isRunActive(status: RunStatus): boolean {
  return status === 'PENDING' || status === 'RUNNING';
}

/** Relative time, e.g. "2 minutes ago" (no Intl, Hermes-safe). */
export function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = 60_000;
  const h = 60 * m;
  const d = 24 * h;
  if (diff < m) return 'just now';
  if (diff < h) {
    const n = Math.floor(diff / m);
    return `${n} minute${n === 1 ? '' : 's'} ago`;
  }
  if (diff < d) {
    const n = Math.floor(diff / h);
    return `${n} hour${n === 1 ? '' : 's'} ago`;
  }
  const n = Math.floor(diff / d);
  return `${n} day${n === 1 ? '' : 's'} ago`;
}

/** Human label / type for a node (defensive against varying data shapes). */
export function nodeLabel(n: WorkflowNode): string {
  const d = n.data ?? {};
  return (d.label as string) || (d.type as string) || n.type || n.id;
}

export function nodeType(n: WorkflowNode): string {
  const d = n.data ?? {};
  return (d.type as string) || n.type || '';
}

/** A representative color for a node, grouped by its type/category. */
export function nodeAccent(type: string, theme: StatusTheme): string {
  const t = (type || '').toLowerCase();
  if (t.startsWith('trigger')) return theme.accent;
  if (t === 'llm' || t === 'agent' || t === 'stream_output') return '#8B5CF6'; // AI
  if (['condition', 'switch', 'loop', 'parallel', 'merge', 'error_handler', 'sub_workflow'].includes(t))
    return AMBER; // flow control
  if (['transform', 'filter', 'aggregate', 'output_parser'].includes(t)) return GREEN; // data
  if (['rag_search', 'database', 'storage'].includes(t)) return '#0D9488'; // integration
  if (['human_input', 'approval', 'handoff'].includes(t)) return '#DB2777'; // human
  return theme.textSecondary;
}

/**
 * Order nodes for a read-only linear view via a topological sort (Kahn's
 * algorithm), triggers first. Leftover nodes (cycles/disconnected) are appended
 * so none are dropped.
 */
export function orderNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  if (!nodes.length) return [];
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (!indeg.has(e.target) || !adj.has(e.source)) continue;
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    adj.get(e.source)!.push(e.target);
  }
  const queue = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  const seen = new Set<string>();
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
    for (const t of adj.get(id) ?? []) {
      indeg.set(t, (indeg.get(t) ?? 1) - 1);
      if ((indeg.get(t) ?? 0) <= 0) queue.push(t);
    }
  }
  for (const n of nodes) if (!seen.has(n.id)) order.push(n.id);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return order.map((id) => byId.get(id)).filter((n): n is WorkflowNode => !!n);
}
