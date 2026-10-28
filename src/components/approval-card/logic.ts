/** Which question the card asks: a tool permission (Approve / Deny) or a single-choice question (Submit). */
export type ApprovalKind = 'permission' | 'question';
export type ApprovalRisk = 'low' | 'medium' | 'high';
/** What the person answered a permission with. `explain` only when `canExplain` is set. */
export type ApprovalDecision = 'approve' | 'deny' | 'approve_disable_rule' | 'explain';
/**
 * How a request ended, shown as one row: `approved` / `denied` / `explained` (permission), `answered` (question),
 * `expired` (nobody answered in time), `elsewhere` (answered in another place — Slack, another tab).
 */
export type ApprovalOutcome = 'approved' | 'denied' | 'explained' | 'answered' | 'expired' | 'elsewhere';
/** The card's effective state. */
export type ApprovalStatus = 'pending' | 'sending' | 'error' | 'resolved';

/** A matched dangerous-command rule (soma-work's `rules[]`). */
export interface ApprovalRule {
  id: string;
  label: string;
  description?: string;
}

export interface ApprovalChoice {
  id: string;
  label: string;
  description?: string;
}

/** What the host says about the request. Pending by default. */
export type ApprovalCardState =
  | { status: 'pending' }
  /** The host is sending an answer: answers lock, the button (or option) answered with shows a spinner. */
  | { status: 'sending'; decision?: ApprovalDecision; choiceId?: string }
  /** The answer failed: the message under the buttons. `retry` (default true) unlocks the answers and offers Retry. */
  | { status: 'error'; message: string; retry?: boolean }
  /** The request is over: the card becomes one row. */
  | {
      status: 'resolved';
      outcome: ApprovalOutcome;
      /** Who answered (shown “by …”). */
      by?: string;
      /** Epoch ms it ended (shown as “2m ago”, kept current). */
      at?: number;
      /** Approved and the matched rule turned off for the session. */
      ruleDisabled?: boolean;
      /** The question's answer: a choice id, or free text. */
      choiceId?: string;
      text?: string;
    };

interface ApprovalCommon {
  /** The request id (soma-work's `approvalId`), echoed as `detail.id` in every event. */
  id: string;
  /** Small muted line above the card. Default: `<tool> · requested 6:56 PM` (permission). */
  label?: string;
  /** Epoch ms the request was made (the default label). */
  createdAt?: number;
  /** Epoch ms the request expires: a live “Expires in 4:59”, amber in the last 10 s, then `ui-expire`. */
  expiresAt?: number;
  /** Default true. `false` locks the answers; a string locks them and says why. */
  canAnswer?: boolean | string;
  /** Default pending. `'pending'` / `'sending'` may be given as strings. */
  state?: ApprovalCardState | 'pending' | 'sending';
}

export interface ApprovalPermissionData extends ApprovalCommon {
  kind: 'permission';
  /** Tool name as the agent calls it — `Bash`, `Edit`, `mcp__github__create_issue`. */
  tool: string;
  /** Default `<tool> approval` / `<tool> 실행 승인`. */
  title?: string;
  /** One line under the title. Default: the input's string `description`. */
  description?: string;
  /** Badge in the header. Default: `high` when any rule matched, else no badge. */
  risk?: ApprovalRisk;
  rules?: ApprovalRule[];
  /**
   * The tool input — an object, or JSON text (soma-work's `GET …/permission/:id` `input`). `command` → a shell
   * block, `old_string`/`new_string` · `edits[]` · `content` with `file_path` → a diff, other keys → rows; text that
   * is not JSON is shown as written.
   */
  input?: unknown;
  /** `input` was cut by the host (it is shown as written, with a note). */
  truncated?: boolean;
  /** The host is fetching the input: a quiet loading line. */
  loading?: boolean;
  /** A muted line in place of the input (e.g. only the requester may see it). */
  notice?: string;
  /** Offer “Disable this rule for this session”: Approve with it ticked sends `approve_disable_rule`. */
  canDisableRule?: boolean;
  /** Offer Explain (`decision: 'explain'`). */
  canExplain?: boolean;
}

export interface ApprovalQuestionData extends ApprovalCommon {
  kind: 'question';
  /** The whole question (the card's title; line breaks kept). */
  question: string;
  /** Context under the question. */
  description?: string;
  choices: ApprovalChoice[];
  /** The recommended choice: listed first, tagged and selected to start with. */
  recommendedId?: string;
  /** Offer a free-text answer (`ui-answer { text }`). */
  allowOther?: boolean;
}

export type ApprovalCardData = ApprovalPermissionData | ApprovalQuestionData;

export interface ApprovalDecideDetail {
  id: string;
  decision: ApprovalDecision;
}
export interface ApprovalAnswerDetail {
  id: string;
  choiceId?: string;
  text?: string;
}
export interface ApprovalExpireDetail {
  id: string;
}

/** The countdown turns amber from here (ms left). */
export const LOW_MS = 10_000;
/** Most diff lines one card renders; the rest is counted. */
export const MAX_DIFF_LINES = 300;

const STATUSES: ReadonlySet<string> = new Set(['pending', 'sending', 'error', 'resolved']);
const OUTCOMES: ReadonlySet<string> = new Set(['approved', 'denied', 'explained', 'answered', 'expired', 'elsewhere']);
const DECISIONS: ReadonlySet<string> = new Set(['approve', 'deny', 'approve_disable_rule', 'explain']);

/** A positive finite number, else 0. */
export function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** The host's state as an object; anything unknown reads as pending (a resolved state needs a known outcome). */
export function normState(v: unknown): ApprovalCardState {
  const s = (typeof v === 'string' ? { status: v } : v) as Record<string, unknown> | null | undefined;
  const status = s && typeof s === 'object' ? String(s.status) : '';
  if (!s || !STATUSES.has(status)) return { status: 'pending' };
  if (status === 'resolved') {
    if (!OUTCOMES.has(String(s.outcome))) return { status: 'pending' };
    return s as ApprovalCardState;
  }
  if (status === 'error') {
    const message = s.message === undefined || s.message === null ? '' : String(s.message);
    return { status: 'error', message, retry: s.retry !== false };
  }
  if (status === 'sending') {
    const out: ApprovalCardState = { status: 'sending' };
    if (DECISIONS.has(String(s.decision))) out.decision = s.decision as ApprovalDecision;
    if (s.choiceId !== undefined && s.choiceId !== null) out.choiceId = String(s.choiceId);
    return out;
  }
  return { status: 'pending' };
}

/** The outcome (and rule flag) a decision resolves to — what a host sets once its answer went through. */
export function decisionOutcome(decision: ApprovalDecision): { outcome: ApprovalOutcome; ruleDisabled?: boolean } {
  if (decision === 'deny') return { outcome: 'denied' };
  if (decision === 'explain') return { outcome: 'explained' };
  if (decision === 'approve_disable_rule') return { outcome: 'approved', ruleDisabled: true };
  return { outcome: 'approved' };
}

/** The header badge: the host's risk, else `high` when a dangerous-command rule matched, else none. */
export function riskOf(d: Pick<ApprovalPermissionData, 'risk' | 'rules'>): ApprovalRisk | undefined {
  if (d.risk === 'low' || d.risk === 'medium' || d.risk === 'high') return d.risk;
  return Array.isArray(d.rules) && d.rules.length ? 'high' : undefined;
}

/** The recommended choice id when it names one of the choices. */
export function recommendedOf(d: Pick<ApprovalQuestionData, 'choices' | 'recommendedId'>): string | undefined {
  const id = d.recommendedId;
  return id !== undefined && (d.choices ?? []).some((c) => c.id === id) ? id : undefined;
}

/** The recommended choice first, the rest in their order. */
export function choiceOrder(choices: ApprovalChoice[], recommendedId?: string): ApprovalChoice[] {
  const list = (choices ?? []).filter((c) => c && c.id !== undefined && c.id !== null);
  const rec = recommendedId === undefined ? undefined : list.find((c) => c.id === recommendedId);
  return rec ? [rec, ...list.filter((c) => c !== rec)] : list;
}

/** Countdown text: 0:42 · 4:59 · 1:02:03 (whole seconds, rounded up — 0:00 only when the time is up). */
export function clockText(ms: number): string {
  const s = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  if (s < 3600) return `${Math.floor(s / 60)}:${pad(s % 60)}`;
  return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}

/** Relative past time: just now · 5m ago · 3h ago · 2d ago (ko: 방금 · 5분 전 · 3시간 전 · 2일 전). */
export function agoText(at: number, now: number, lang: 'en' | 'ko' = 'en'): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  const ko = lang === 'ko';
  if (s < 45) return ko ? '방금' : 'just now';
  const m = Math.max(1, Math.floor(s / 60));
  if (m < 60) return ko ? `${m}분 전` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return ko ? `${h}시간 전` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return ko ? `${d}일 전` : `${d}d ago`;
}

/** Time of day: `6:56 PM` (en) / `오후 06:56` (ko); empty for a missing or invalid time. */
export function timeOfDay(ts: number | undefined, lang: 'en' | 'ko' = 'en'): string {
  const v = num(ts);
  if (!v || Number.isNaN(new Date(v).getTime())) return '';
  try {
    return lang === 'ko'
      ? new Date(v).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : new Date(v).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** A value as text: strings as they are, anything else as pretty JSON. */
export function fieldText(v: unknown): string {
  if (typeof v === 'string') return v;
  try {
    const s = JSON.stringify(v, null, 2);
    return s === undefined ? String(v) : s;
  } catch {
    return String(v);
  }
}

/** One line of a diff: ` ` kept (context), `-` removed, `+` added. */
export interface DiffLine {
  op: ' ' | '-' | '+';
  text: string;
}

const CONTEXT = 2;
const LCS_CELLS = 40_000;

/**
 * A line diff of two texts: the common head and tail are trimmed to two lines of context each, the middle is an
 * LCS diff (or every old line then every new line when it is too big to compare cheaply).
 */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before === '' ? [] : String(before).split('\n');
  const b = after === '' ? [] : String(after).split('\n');
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const out: DiffLine[] = [];
  for (let i = Math.max(0, head - CONTEXT); i < head; i++) out.push({ op: ' ', text: a[i] });
  const am = a.slice(head, a.length - tail);
  const bm = b.slice(head, b.length - tail);
  if ((am.length + 1) * (bm.length + 1) <= LCS_CELLS) out.push(...lcsDiff(am, bm));
  else {
    for (const t of am) out.push({ op: '-', text: t });
    for (const t of bm) out.push({ op: '+', text: t });
  }
  for (let i = a.length - tail; i < Math.min(a.length, a.length - tail + CONTEXT); i++)
    out.push({ op: ' ', text: a[i] });
  return out;
}

function lcsDiff(a: string[], b: string[]): DiffLine[] {
  const n = a.length;
  const m = b.length;
  const w = m + 1;
  // len[i][j] = LCS length of a[i..] and b[j..]
  const len = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      len[i * w + j] =
        a[i] === b[j] ? len[(i + 1) * w + j + 1] + 1 : Math.max(len[(i + 1) * w + j], len[i * w + j + 1]);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: ' ', text: a[i++] });
      j++;
    } else if (len[(i + 1) * w + j] >= len[i * w + j + 1]) out.push({ op: '-', text: a[i++] });
    else out.push({ op: '+', text: b[j++] });
  }
  while (i < n) out.push({ op: '-', text: a[i++] });
  while (j < m) out.push({ op: '+', text: b[j++] });
  return out;
}

/** What the card shows of a tool input. */
export interface ApprovalPreview {
  /** The input's string `description` (the card's default description). */
  summary: string;
  /** A shell command (`command`). */
  command?: string;
  /** File changes: `old_string`/`new_string`, `edits[]`, or a new file's `content` / `new_source`. */
  diffs: Array<{ path?: string; lines: DiffLine[] }>;
  /** Diff lines left out past MAX_DIFF_LINES. */
  more: number;
  /** Every other key as label → text. */
  fields: Array<[string, string]>;
  /** Shown as written: text that is not JSON, a cut input, or a JSON value that is not an object. */
  raw?: string;
}

const str = (v: unknown): v is string => typeof v === 'string';

/** A tool input as the card's preview (see `ApprovalPreview`). Pure: the element only renders it. */
export function toPreview(input: unknown, truncated = false): ApprovalPreview {
  const empty: ApprovalPreview = { summary: '', diffs: [], more: 0, fields: [] };
  if (input === undefined || input === null || input === '') return empty;
  let value: unknown = input;
  if (typeof input === 'string') {
    const head = input.trimStart().charAt(0);
    if (truncated || (head !== '{' && head !== '[')) return { ...empty, raw: input };
    try {
      value = JSON.parse(input);
    } catch {
      return { ...empty, raw: input };
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...empty, raw: fieldText(value) };
  const rec = value as Record<string, unknown>;
  const used = new Set<string>();
  const out: ApprovalPreview = { ...empty, diffs: [] };
  if (str(rec.description) && rec.description) {
    out.summary = rec.description;
    used.add('description');
  }
  if (str(rec.command)) {
    out.command = rec.command;
    used.add('command');
  }
  const pathKey = str(rec.file_path) ? 'file_path' : str(rec.notebook_path) ? 'notebook_path' : '';
  const path = pathKey ? (rec[pathKey] as string) : undefined;
  const edits = Array.isArray(rec.edits) ? rec.edits : null;
  if (str(rec.old_string) && str(rec.new_string)) {
    out.diffs.push({ path, lines: lineDiff(rec.old_string, rec.new_string) });
    used.add('old_string').add('new_string');
  } else if (edits?.length && edits.every((e) => e && str(e.old_string) && str(e.new_string))) {
    edits.forEach((e, i) => {
      out.diffs.push({ path: i === 0 ? path : undefined, lines: lineDiff(e.old_string, e.new_string) });
    });
    used.add('edits');
  } else if (path && (str(rec.content) || str(rec.new_source))) {
    const key = str(rec.content) ? 'content' : 'new_source';
    const text = rec[key] as string;
    out.diffs.push({ path, lines: text === '' ? [] : text.split('\n').map((t) => ({ op: '+' as const, text: t })) });
    used.add(key);
  }
  if (out.diffs.length && pathKey) used.add(pathKey);
  // Cap the rendered diff lines; the rest is counted.
  let room = MAX_DIFF_LINES;
  for (const d of out.diffs) {
    if (d.lines.length > room) {
      out.more += d.lines.length - room;
      d.lines = d.lines.slice(0, room);
    }
    room -= d.lines.length;
  }
  for (const k of Object.keys(rec)) if (!used.has(k)) out.fields.push([k, fieldText(rec[k])]);
  return out;
}

/** The header icon for a tool: terminal (Bash), edit (Edit, MultiEdit, NotebookEdit), file (Write), globe
 * (WebFetch, WebSearch), plug (mcp__*), else a shield. */
export type ApprovalIcon = 'shield' | 'terminal' | 'edit' | 'file' | 'globe' | 'plug' | 'question';
export function approvalIcon(tool: string): ApprovalIcon {
  const t = String(tool ?? '');
  if (t === 'Bash' || t === 'BashOutput') return 'terminal';
  if (t === 'Edit' || t === 'MultiEdit' || t === 'NotebookEdit') return 'edit';
  if (t === 'Write') return 'file';
  if (t === 'WebFetch' || t === 'WebSearch') return 'globe';
  return t.startsWith('mcp__') ? 'plug' : 'shield';
}

// 16×16 stroke glyphs drawn for this library (currentColor).
const G = (d: string) => `<svg viewBox="0 0 16 16" aria-hidden="true">${d}</svg>`;
export const APPROVAL_ICONS: Record<ApprovalIcon, string> = {
  shield: G(
    '<path d="M8 1.8 3.1 3.7v3.6c0 3 2.1 5.6 4.9 6.8 2.8-1.2 4.9-3.8 4.9-6.8V3.7Z"/><path d="m5.9 8 1.5 1.5 2.8-3"/>',
  ),
  terminal: G('<rect x="1.9" y="2.9" width="12.2" height="10.2" rx="2"/><path d="m4.6 6.3 2 1.8-2 1.8M8.4 10.1h3"/>'),
  edit: G(
    '<path d="M10.3 2.9a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1L6.4 12.4l-3.3.8.8-3.3Z"/><path d="m9.2 4 2.8 2.8"/>',
  ),
  file: G(
    '<path d="M9 1.9H4.6a1 1 0 0 0-1 1v10.2a1 1 0 0 0 1 1h6.8a1 1 0 0 0 1-1V5.3Z"/><path d="M9 1.9v3.4h3.4M5.9 8.6h4.2M5.9 11h2.8"/>',
  ),
  globe: G(
    '<circle cx="8" cy="8" r="6.1"/><path d="M1.9 8h12.2M8 1.9c-1.7 1.7-2.5 3.7-2.5 6.1s.8 4.4 2.5 6.1c1.7-1.7 2.5-3.7 2.5-6.1S9.7 3.6 8 1.9Z"/>',
  ),
  plug: G('<path d="M5.9 1.9v2.9M10.1 1.9v2.9M4.1 4.8h7.8v2.3a3.9 3.9 0 0 1-7.8 0ZM8 11v3.1"/>'),
  question: G(
    '<circle cx="8" cy="8" r="6.1"/><path d="M6.3 6.3a1.8 1.8 0 0 1 3.4.7c0 1.2-1.7 1.5-1.7 2.6M8 11.3v.1"/>',
  ),
};
