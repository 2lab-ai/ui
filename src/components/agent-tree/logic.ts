import { fmtUsd } from '../../core/format';
import { type ModelVendor, modelVendor } from '../../core/model-mark';

/**
 * Where an agent is. `needs_you` waits for a person (a permission, a question); `waiting` waits for something else
 * (queued, idle, its sub-agents); `cancelled` was stopped; `unknown` lost track of (an archive that cannot tell).
 */
export type AgentTreeStatus = 'running' | 'waiting' | 'needs_you' | 'done' | 'failed' | 'cancelled' | 'unknown';

export const AGENT_TREE_STATUSES: readonly AgentTreeStatus[] = [
  'running',
  'waiting',
  'needs_you',
  'done',
  'failed',
  'cancelled',
  'unknown',
];

/** compact: one row per agent (who is doing what now). rich: a card per agent with spend and a waterfall span. */
export type AgentTreeDensity = 'compact' | 'rich';

/** One agent as the host knows it. The tree is built from `parentId`; the order of `nodes` is the spawn order. */
export interface AgentTreeNode {
  /** Stable across updates (the card keeps its place, focus and fold state by it). Empty ids are skipped. */
  id: string;
  /** The agent that started this one. Missing, unknown or cyclic → it hangs at the top level. */
  parentId?: string | null;
  name: string;
  /** A second line under the name — the model or the agent type. */
  role?: string;
  /**
   * 0.23.0 — the model the agent runs (an id or a name: `claude-sonnet-4-6`, `GPT-5.5`). Its maker's mark leads the
   * row (a rich card's avatar tile, a compact row's mark before the name) in the maker's colour; the text is not shown.
   */
  model?: string;
  /** Also accepts completed (→ done), stopped / canceled (→ cancelled) and queued (→ waiting); anything else → unknown. */
  status: AgentTreeStatus | (string & {});
  /** Epoch ms. */
  startedAt?: number;
  /** Epoch ms. Without it a running / waiting / needs_you agent's time runs on. */
  endedAt?: number;
  /** This agent's own tokens (not its sub-agents' — the tree adds the branch up). */
  tokens?: number;
  /** This agent's own cost in USD (not its sub-agents'). */
  costUsd?: number;
  /** This agent's own tool calls. */
  toolCalls?: number;
  /** What it is doing / did — its task, current step or result. */
  summary?: string;
  /** Why it needs you, or what went wrong — shown on the node. */
  reason?: string;
}

export interface AgentTreeData {
  nodes: AgentTreeNode[];
  /** Default 'rich'. */
  density?: AgentTreeDensity;
  /** Set (a string or null) → controlled: the tree only emits ui-select. Unset → the tree keeps its own selection. */
  selectedId?: string | null;
  /** Ids of the open branches. Set → controlled: the tree only emits ui-toggle. Unset → every branch starts open. */
  expanded?: string[];
  /** The clock for running times (epoch ms). Set → no ticking; unset → one shared 1 s tick while an agent runs. */
  now?: number;
  /** Heading of the bar. Default “Agents” / “에이전트”; null hides the bar (and its totals). */
  title?: string | null;
}

/** A node after normalisation: strings are strings, numbers finite and ≥ 0 or absent. */
export interface AgentTreeNodeNorm {
  id: string;
  parentId: string | null;
  name: string;
  role: string;
  /** The model's maker, when the host named a model (0.23.0). */
  vendor?: ModelVendor;
  status: AgentTreeStatus;
  startedAt?: number;
  endedAt?: number;
  tokens?: number;
  costUsd?: number;
  toolCalls?: number;
  summary: string;
  reason: string;
}

/** Sums over a node and everything below it; a field is absent when no node of the branch reports it. */
export interface BranchTotals {
  tokens?: number;
  costUsd?: number;
  toolCalls?: number;
  /** Nodes below this one. */
  below: number;
  /** The most urgent status below this one (needs_you › failed › running › waiting › unknown › cancelled › done). */
  worst?: AgentTreeStatus;
  /** Counts by status below this one. */
  counts: Partial<Record<AgentTreeStatus, number>>;
  /** This node or one below it runs (its spend still climbs). */
  live: boolean;
}

export interface TreeItem {
  id: string;
  node: AgentTreeNodeNorm;
  parent: TreeItem | null;
  children: TreeItem[];
  /** 0 for a top-level agent. */
  depth: number;
  /** Position among its siblings (0-based). */
  index: number;
  branch: BranchTotals;
}

export interface AgentTreeModel {
  roots: TreeItem[];
  byId: Map<string, TreeItem>;
  /** Every item, depth first (parents before their children, siblings in spawn order). */
  all: TreeItem[];
  counts: Record<AgentTreeStatus, number>;
  total: { tokens?: number; costUsd?: number; toolCalls?: number; live: boolean };
  /** Deepest depth (0 when everything is top level). */
  depth: number;
}

const ALIAS: Record<string, AgentTreeStatus> = {
  completed: 'done',
  stopped: 'cancelled',
  canceled: 'cancelled',
  queued: 'waiting',
};

/** One of the seven statuses (a few common aliases accepted); anything else reads `unknown`. */
export function normAgentStatus(v: unknown): AgentTreeStatus {
  const s = typeof v === 'string' ? v : '';
  if ((AGENT_TREE_STATUSES as readonly string[]).includes(s)) return s as AgentTreeStatus;
  return ALIAS[s] ?? 'unknown';
}

/** Most urgent first: what a person must act on, then what broke, then what still moves. */
export const AGENT_SEVERITY: readonly AgentTreeStatus[] = [
  'needs_you',
  'failed',
  'running',
  'waiting',
  'unknown',
  'cancelled',
  'done',
];

/** The more urgent of two statuses (undefined counts as nothing). */
export function worseOf(a: AgentTreeStatus | undefined, b: AgentTreeStatus | undefined): AgentTreeStatus | undefined {
  if (!a) return b;
  if (!b) return a;
  return AGENT_SEVERITY.indexOf(a) <= AGENT_SEVERITY.indexOf(b) ? a : b;
}

/** Statuses whose clock runs while they have no end time. */
export function isOpenStatus(s: AgentTreeStatus): boolean {
  return s === 'running' || s === 'waiting' || s === 'needs_you';
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};
const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

/** A host node as the tree uses it, or null when it has no id. */
export function normNode(v: unknown): AgentTreeNodeNorm | null {
  if (!v || typeof v !== 'object') return null;
  const n = v as Record<string, unknown>;
  const id = str(n.id);
  if (!id) return null;
  const parent = str(n.parentId);
  return {
    id,
    parentId: parent && parent !== id ? parent : null,
    name: str(n.name) || id,
    role: str(n.role),
    vendor: str(n.model) ? modelVendor(str(n.model)) : undefined,
    status: normAgentStatus(n.status),
    startedAt: num(n.startedAt),
    endedAt: num(n.endedAt),
    tokens: num(n.tokens),
    costUsd: num(n.costUsd),
    toolCalls: num(n.toolCalls),
    summary: str(n.summary),
    reason: str(n.reason),
  };
}

const addTo = (a: number | undefined, b: number | undefined): number | undefined =>
  a === undefined ? b : b === undefined ? a : a + b;

/**
 * The tree from a flat list: each node hangs under its `parentId`, children in input (spawn) order — never re-sorted
 * by status. A parent that is missing, the node itself, or a cycle back to the node makes it top level; the first of
 * two nodes with one id wins. Every branch is summed up (tokens, cost, tool calls, worst status below).
 */
export function buildTree(nodes: unknown): AgentTreeModel {
  const list: AgentTreeNodeNorm[] = [];
  const known = new Map<string, AgentTreeNodeNorm>();
  for (const raw of Array.isArray(nodes) ? nodes : []) {
    const n = normNode(raw);
    if (!n || known.has(n.id)) continue;
    known.set(n.id, n);
    list.push(n);
  }
  // Declared parents that exist; then each node's parent with cycles broken. A node processed earlier is walked
  // through its resolved parent, a later one through its declared parent: a walk that comes back to the node is a
  // cycle and makes it top level (a loop above it that does not pass through it is broken by its own members).
  const declared = new Map<string, string>();
  for (const n of list) if (n.parentId && known.has(n.parentId)) declared.set(n.id, n.parentId);
  const resolved = new Map<string, string | null>();
  for (const n of list) {
    let p: string | null = declared.get(n.id) ?? null;
    const walked = new Set<string>();
    for (let up: string | null = p; up; ) {
      if (up === n.id) {
        p = null;
        break;
      }
      if (walked.has(up)) break;
      walked.add(up);
      up = resolved.has(up) ? (resolved.get(up) ?? null) : (declared.get(up) ?? null);
    }
    resolved.set(n.id, p);
  }

  const byId = new Map<string, TreeItem>();
  for (const n of list)
    byId.set(n.id, {
      id: n.id,
      node: n,
      parent: null,
      children: [],
      depth: 0,
      index: 0,
      branch: { below: 0, counts: {}, live: false },
    });
  const roots: TreeItem[] = [];
  for (const n of list) {
    const item = byId.get(n.id)!;
    const p = resolved.get(n.id);
    const parent = p ? byId.get(p) : undefined;
    item.parent = parent ?? null;
    item.index = parent ? parent.children.length : roots.length;
    (parent ? parent.children : roots).push(item);
  }

  // Depth first, iteratively (a long chain must not overflow the stack).
  const all: TreeItem[] = [];
  const stack = [...roots].reverse();
  let depth = 0;
  while (stack.length) {
    const it = stack.pop()!;
    it.depth = it.parent ? it.parent.depth + 1 : 0;
    if (it.depth > depth) depth = it.depth;
    all.push(it);
    for (let i = it.children.length - 1; i >= 0; i--) stack.push(it.children[i]);
  }

  // Roll up children before parents (reverse depth-first order).
  for (let i = all.length - 1; i >= 0; i--) {
    const it = all[i];
    const b = it.branch;
    b.tokens = addTo(b.tokens, it.node.tokens);
    b.costUsd = addTo(b.costUsd, it.node.costUsd);
    b.toolCalls = addTo(b.toolCalls, it.node.toolCalls);
    if (it.node.status === 'running') b.live = true;
    const p = it.parent?.branch;
    if (!p) continue;
    p.tokens = addTo(p.tokens, b.tokens);
    p.costUsd = addTo(p.costUsd, b.costUsd);
    p.toolCalls = addTo(p.toolCalls, b.toolCalls);
    p.below += 1 + b.below;
    p.worst = worseOf(worseOf(p.worst, it.node.status), b.worst);
    p.counts[it.node.status] = (p.counts[it.node.status] ?? 0) + 1;
    for (const [k, v] of Object.entries(b.counts) as Array<[AgentTreeStatus, number]>)
      p.counts[k] = (p.counts[k] ?? 0) + v;
    if (b.live) p.live = true;
  }

  const counts = Object.fromEntries(AGENT_TREE_STATUSES.map((s) => [s, 0])) as Record<AgentTreeStatus, number>;
  for (const it of all) counts[it.node.status]++;
  const total: AgentTreeModel['total'] = { live: false };
  for (const r of roots) {
    total.tokens = addTo(total.tokens, r.branch.tokens);
    total.costUsd = addTo(total.costUsd, r.branch.costUsd);
    total.toolCalls = addTo(total.toolCalls, r.branch.toolCalls);
    if (r.branch.live) total.live = true;
  }
  return { roots, byId, all, counts, total, depth };
}

/** The items a reader can reach now: depth first, skipping the children of every closed branch. */
export function visibleItems(model: AgentTreeModel, isOpen: (item: TreeItem) => boolean): TreeItem[] {
  const out: TreeItem[] = [];
  const stack = [...model.roots].reverse();
  while (stack.length) {
    const it = stack.pop()!;
    out.push(it);
    if (it.children.length && isOpen(it)) for (let i = it.children.length - 1; i >= 0; i--) stack.push(it.children[i]);
  }
  return out;
}

/** The item itself when it is visible, else its nearest visible ancestor. */
export function nearestVisible(item: TreeItem | undefined, visible: ReadonlySet<string>): TreeItem | undefined {
  for (let cur = item; cur; cur = cur.parent ?? undefined) if (visible.has(cur.id)) return cur;
  return undefined;
}

/** How long it ran (ms): to its end, or to `now` while it is still open; undefined without a start. */
export function durationOf(n: AgentTreeNodeNorm, now: number): number | undefined {
  if (n.startedAt === undefined) return undefined;
  const end = n.endedAt ?? (isOpenStatus(n.status) ? now : undefined);
  if (end === undefined) return undefined;
  return Math.max(0, end - n.startedAt);
}

/** True when the node's time still runs on (open, started, not ended). */
export function ticks(n: AgentTreeNodeNorm): boolean {
  return n.startedAt !== undefined && n.endedAt === undefined && isOpenStatus(n.status);
}

export interface SpanAxis {
  t0: number;
  t1: number;
}

/** The shared time axis of the waterfall: the first start to the last end (or `now` while one is open). */
export function spanAxis(nodes: readonly AgentTreeNodeNorm[], now: number): SpanAxis | null {
  let t0 = Number.POSITIVE_INFINITY;
  let t1 = Number.NEGATIVE_INFINITY;
  for (const n of nodes) {
    if (n.startedAt === undefined) continue;
    if (n.startedAt < t0) t0 = n.startedAt;
    const end = n.endedAt ?? (isOpenStatus(n.status) ? now : n.startedAt);
    if (end > t1) t1 = end;
  }
  if (!Number.isFinite(t0)) return null;
  if (t1 - t0 < 1000) t1 = t0 + 1000;
  return { t0, t1 };
}

/** A node's bar on the axis, in percent of its width (at least 1.5% so a short run still shows); null without a start. */
export function spanOf(
  n: AgentTreeNodeNorm,
  axis: SpanAxis,
  now: number,
): { left: number; width: number; open: boolean } | null {
  if (n.startedAt === undefined) return null;
  const open = n.endedAt === undefined && isOpenStatus(n.status);
  const end = Math.max(n.startedAt, n.endedAt ?? (open ? now : n.startedAt));
  const w = axis.t1 - axis.t0;
  const width = Math.min(100, Math.max(1.5, ((end - n.startedAt) / w) * 100));
  const left = Math.min(100 - width, Math.max(0, ((n.startedAt - axis.t0) / w) * 100));
  return { left: Math.round(left * 100) / 100, width: Math.round(width * 100) / 100, open };
}

/** What a key does on a tree item (WAI-ARIA tree pattern). */
export type TreeKeyAction =
  | 'next'
  | 'prev'
  | 'first'
  | 'last'
  | 'expand'
  | 'child'
  | 'collapse'
  | 'parent'
  | 'siblings'
  | 'select'
  | '';

export function treeKeyAction(
  key: string,
  info: { hasKids: boolean; open: boolean; hasParent: boolean },
): TreeKeyAction {
  switch (key) {
    case 'ArrowDown':
      return 'next';
    case 'ArrowUp':
      return 'prev';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    case 'ArrowRight':
      return info.hasKids ? (info.open ? 'child' : 'expand') : '';
    case 'ArrowLeft':
      return info.hasKids && info.open ? 'collapse' : info.hasParent ? 'parent' : '';
    case '*':
      return 'siblings';
    case 'Enter':
    case ' ':
      return 'select';
    default:
      return '';
  }
}

/** Type-ahead: the next label (after `from`, wrapping) that starts with `query`; a longer query may stay on `from`. */
export function typeaheadIndex(labels: readonly string[], from: number, query: string): number {
  const q = query.toLocaleLowerCase();
  const n = labels.length;
  if (!q || !n) return -1;
  const start = q.length > 1 ? 0 : 1;
  for (let k = start; k < n + start; k++) {
    const i = (((from + k) % n) + n) % n;
    if (labels[i].toLocaleLowerCase().startsWith(q)) return i;
  }
  return -1;
}

/** Dollars with cents; a cost above zero that rounds to nothing reads <$0.01. */
export function fmtCost(n: number): string {
  return n > 0 && n < 0.005 ? '<$0.01' : fmtUsd(n);
}

/** A DOM id part from any text, collision-free: letters and digits kept, anything else as _<hex>_. */
export function idPart(v: string): string {
  let out = '';
  for (const ch of v) out += /[A-Za-z0-9]/.test(ch) ? ch : `_${ch.codePointAt(0)!.toString(16)}_`;
  return out;
}

/** Two letters for the avatar tile: the first letter or digit of the first two words. */
export function agentInitials(name: string): string {
  let out = '';
  for (const word of name.split(/[\s_\-/]+/)) {
    const m = word.match(/[\p{L}\p{N}]/u);
    if (m) out += m[0];
    if (out.length >= 2) break;
  }
  return out.toLocaleUpperCase() || '·';
}
