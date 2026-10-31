import {
  type ActivityLang,
  type RawView,
  rawViewHtml,
  type SkillBadge,
  type SysKind,
  skillBadgesHtml,
  sysBadgeHtml,
} from '../../core/activity';
import { fmtDurationIn } from '../../core/format';
import { attrs, esc } from '../../core/html';
import { icon } from '../../icons/icons';

export type WorkLogLang = ActivityLang;

/** What one entry of the log is. Unknown kinds read as `narration`. */
export type WorkEntryKind = 'instruction' | 'narration' | 'final' | 'notice' | 'error' | 'tool' | 'system' | 'agent';

export type WorkToolStatus = 'running' | 'success' | 'error' | 'interrupted';
export type WorkAgentStatus = 'running' | 'waiting' | 'done' | 'failed' | 'stopped' | 'unknown';

/** A tool call. The host puts a `<ui-tool-call-card slot="tool-<entry id>">` in the log; without one, a plain line. */
export interface WorkTool {
  /** Tool name as the agent calls it (`Read`, `Bash`). */
  name: string;
  status: WorkToolStatus;
  /** One human line (`src/router.ts (lines 1-80)`). */
  summary?: string;
}

/** A child agent the entry started: status, name, time, tool count and an Open action (`ui-open`). */
export interface WorkAgent {
  /** Sent back in `ui-open`. */
  id: string;
  name: string;
  status?: WorkAgentStatus;
  /** Epoch ms it started — the time counts up while it runs. */
  startedAt?: number;
  /** Final duration in ms (shown when it is not running). */
  duration?: number;
  /** Tool calls it made. */
  tools?: number;
  /** What it is doing now, one line. */
  activity?: string;
}

/** A system turn (compacted, restarted, retried, goal, scheduled, background): a badge and one line. */
export interface WorkSystem {
  kind: SysKind | (string & {});
  /** Replaces the badge word (`Goal 2/5`). */
  label?: string;
}

export interface WorkEntry {
  /** Stable and unique across the whole log: the key for updates, focus and the tool slot. */
  id: string;
  kind: WorkEntryKind;
  /** The words: the instruction, the narration, the response, the notice, the error, the system line. */
  text?: string;
  /** Epoch ms. */
  at?: number;
  /** Replaces the kind's label (`Instruction`, `Response` …). */
  label?: string;
  /** kind `tool`. */
  tool?: WorkTool;
  /** kind `system`. */
  system?: WorkSystem;
  /** A child agent this entry started (kind `agent`, or under any other entry). */
  agent?: WorkAgent;
  /** Skills the entry invoked: chips that open their text. */
  skills?: SkillBadge[];
  /** The entry's raw output, once the host has it (or its state: loading / missing / denied / error). */
  raw?: RawView;
  /** The row opens to its raw output even before `raw` is set: the host loads it on `ui-toggle`. */
  hasRaw?: boolean;
}

/** One item of a group's meta line: a string as it is, or a quiet label with its value (`{ label: 'Tools', value: '12' }`). */
export type WorkMetaItem = string | { label: string; value?: string };

export interface WorkGroup {
  /** Stable key (`data-item` in the log). */
  id: string;
  /** Short reference shown before the title (default: the id; empty string hides it). */
  ref?: string;
  title?: string;
  /** Epoch ms the group started. */
  at?: number;
  /** Entry count shown in the head (default: the number of entries given). */
  count?: number;
  /** Set → controlled (the host owns it); unset → newest group open, others closed, then the reader's choice. */
  open?: boolean;
  /**
   * The task's ledger, one quiet `·` separated line under the title: how it ended, its time, `{ label: 'Tools',
   * value: '12' }`. Strings are shown as they are.
   */
  meta?: WorkMetaItem[];
  /**
   * No head: the entries stand in line between the task groups (the instruction that starts a turn, the response
   * that ends it), always shown, never folded. `open`, `title`, `count` and `meta` are not drawn.
   */
  headless?: boolean;
  /** Oldest first. */
  entries?: WorkEntry[];
}

export interface WorkLogData {
  /** Oldest first. */
  groups?: WorkGroup[];
  /** Older groups exist: the top row offers them and scrolling up asks (`ui-load-older`). */
  hasMore?: boolean;
  /** A page is on its way (the first page with no groups yet, else an older page). */
  loading?: boolean;
  /** The reader may not see this log: an owner-only notice instead (string = custom text). */
  denied?: boolean | string;
  /** The log comes from an older format that did not record which agent wrote each entry (string = custom text). */
  legacy?: boolean | string;
  /** Accessible name of the log. */
  label?: string;
  emptyText?: string;
  /** Start-of-history marker once `hasMore` is false ('' hides it). */
  startText?: string;
  /** Announce new entries politely (`role="log"`). Default true. */
  live?: boolean;
}

/** `ui-toggle` detail: a group opened / closed, or an entry's raw output. */
export interface WorkToggleDetail {
  kind: 'group' | 'entry';
  id: string;
  group: string;
  open: boolean;
}
/** `ui-open` detail: open this child agent. */
export interface WorkOpenDetail {
  id: string;
  entry: string;
}
/** `ui-retry` detail: load this entry's raw output again. */
export interface WorkRetryDetail {
  id: string;
  group: string;
}
/** `ui-copy` detail: the raw output that was copied. */
export interface WorkCopyDetail {
  id: string;
  group: string;
  text: string;
}

const STRINGS = {
  en: {
    label: 'Work log',
    empty: 'No work logged yet',
    denied: 'Only the owner can see this work log',
    legacy:
      'Earlier entries come from an older log that did not record which agent wrote them — some may be a helper agent’s.',
    untitled: 'Untitled',
    kinds: {
      instruction: 'Instruction',
      narration: 'Progress',
      final: 'Response',
      notice: 'Notice',
      error: 'Error',
    },
    tool: { running: 'Running', success: 'Done', error: 'Failed', interrupted: 'Stopped' },
    agent: {
      running: 'Running',
      waiting: 'Waiting',
      done: 'Done',
      failed: 'Failed',
      stopped: 'Stopped',
      unknown: 'Not known yet',
    },
    entries: (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`,
    tools: (n: number) => `${n} ${n === 1 ? 'tool' : 'tools'}`,
    open: 'Open',
    openAgent: (name: string, status: string, tools: string) => `Open ${name} — ${status}${tools ? `, ${tools}` : ''}`,
    agentFallback: 'Helper agent',
  },
  ko: {
    label: '작업 로그',
    empty: '작업 로그 없음',
    denied: '작업 로그는 소유자만 볼 수 있어요',
    legacy: '이전 형식의 로그예요 — 어느 에이전트가 남긴 항목인지 기록되지 않아 일부는 보조 에이전트의 것일 수 있어요.',
    untitled: '제목 없음',
    kinds: { instruction: '지시', narration: '진행', final: '응답', notice: '알림', error: '오류' },
    tool: { running: '실행 중', success: '완료', error: '실패', interrupted: '중단됨' },
    agent: {
      running: '실행 중',
      waiting: '대기 중',
      done: '완료',
      failed: '실패',
      stopped: '중단됨',
      unknown: '확인 불가',
    },
    entries: (n: number) => `항목 ${n}개`,
    tools: (n: number) => `툴 ${n}개`,
    open: '열기',
    openAgent: (name: string, status: string, tools: string) => `${name} 열기 — ${status}${tools ? `, ${tools}` : ''}`,
    agentFallback: '보조 에이전트',
  },
};

export type WorkLogStrings = (typeof STRINGS)['en'];

/** The string table for a language (anything but `ko` is English). */
export function workLogStrings(lang?: string | null): WorkLogStrings {
  return lang === 'ko' ? STRINGS.ko : STRINGS.en;
}

type TextKind = 'instruction' | 'narration' | 'final' | 'notice' | 'error';
const KINDS: readonly WorkEntryKind[] = [
  'instruction',
  'narration',
  'final',
  'notice',
  'error',
  'tool',
  'system',
  'agent',
];
const KIND_ICON: Record<TextKind, string> = {
  instruction: 'user',
  narration: 'chat',
  final: 'check',
  notice: 'info',
  error: 'alert',
};

/** The entry's kind, unknown kinds as `narration`. */
export function entryKind(kind: unknown): WorkEntryKind {
  return KINDS.includes(kind as WorkEntryKind) ? (kind as WorkEntryKind) : 'narration';
}

/** Tool status: ok / done → success, failed → error, stopped / cancelled → interrupted, anything else → running. */
export function toolStatus(s: unknown): WorkToolStatus {
  const v = String(s ?? '').toLowerCase();
  if (v === 'success' || v === 'ok' || v === 'done' || v === 'completed') return 'success';
  if (v === 'error' || v === 'failed' || v === 'fail') return 'error';
  if (v === 'interrupted' || v === 'stopped' || v === 'cancelled' || v === 'canceled') return 'interrupted';
  return 'running';
}

/** Agent status: completed / success → done, error → failed, pending / queued → waiting, cancelled → stopped. */
export function agentStatus(s: unknown): WorkAgentStatus {
  const v = String(s ?? '').toLowerCase();
  if (v === 'running' || v === 'active') return 'running';
  if (v === 'waiting' || v === 'pending' || v === 'queued') return 'waiting';
  if (v === 'done' || v === 'completed' || v === 'success') return 'done';
  if (v === 'failed' || v === 'error') return 'failed';
  if (v === 'stopped' || v === 'cancelled' || v === 'canceled' || v === 'interrupted') return 'stopped';
  return 'unknown';
}

/** The slot a tool entry's card goes in: `tool-<entry id>`. */
export function toolSlotName(entryId: string): string {
  return `tool-${entryId}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local clock time, 24 h: `14:02:07` (or `14:02` without seconds). Empty for a missing or bad time. */
export function fmtLogTime(ms: unknown, seconds = true): string {
  const v = Number(ms);
  if (ms === null || ms === undefined || ms === '' || !Number.isFinite(v)) return '';
  const d = new Date(v);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return seconds ? `${hm}:${pad(d.getSeconds())}` : hm;
}

function timeHtml(ms: unknown, seconds: boolean, cls: string): string {
  const text = fmtLogTime(ms, seconds);
  return text ? `<time${attrs({ class: cls, datetime: new Date(Number(ms)).toISOString() })}>${esc(text)}</time>` : '';
}

const idOf = (v: unknown): string | null =>
  typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)) ? String(v) : null;

/**
 * Groups as the log shows them: objects with an id only, the first of a repeated group id wins, entries need an id
 * and an id appears once in the whole log (the first one wins). Ids become strings.
 */
export function normGroups(groups: unknown): WorkGroup[] {
  if (!Array.isArray(groups)) return [];
  const seenG = new Set<string>();
  const seenE = new Set<string>();
  const out: WorkGroup[] = [];
  for (const g of groups) {
    if (!g || typeof g !== 'object') continue;
    const id = idOf((g as WorkGroup).id);
    if (id === null || seenG.has(id)) continue;
    seenG.add(id);
    const entries: WorkEntry[] = [];
    const list = (g as WorkGroup).entries;
    if (Array.isArray(list)) {
      for (const e of list) {
        if (!e || typeof e !== 'object') continue;
        const eid = idOf((e as WorkEntry).id);
        if (eid === null || seenE.has(eid)) continue;
        seenE.add(eid);
        entries.push(eid === e.id ? e : { ...e, id: eid });
      }
    }
    out.push({ ...(g as WorkGroup), id, entries });
  }
  return out;
}

/**
 * Which groups are open: the host's `open` when set, else the reader's last choice, else only the newest (last)
 * group with a head. A headless group is always open.
 */
export function openGroups(
  groups: WorkGroup[],
  chosen: ReadonlyMap<string, boolean> = new Map(),
): Map<string, boolean> {
  const out = new Map<string, boolean>();
  const headed = groups.filter((g) => !g.headless);
  const newest = headed.length ? headed[headed.length - 1].id : null;
  for (const g of groups) {
    const open = g.headless ? true : typeof g.open === 'boolean' ? g.open : (chosen.get(g.id) ?? g.id === newest);
    out.set(g.id, open);
  }
  return out;
}

/** The meta items → `·` separated quiet spans (a label in its own span); nothing for an empty list. */
export function workMetaHtml(items: unknown): string {
  if (!Array.isArray(items)) return '';
  const parts = items
    .map((m) => {
      if (typeof m === 'string') return m.trim() ? `<span class="wl-g-kv">${esc(m)}</span>` : '';
      if (m && typeof m === 'object') {
        const { label, value } = m as { label?: unknown; value?: unknown };
        const l = String(label ?? '').trim();
        const v = String(value ?? '').trim();
        if (!l && !v) return '';
        return `<span class="wl-g-kv">${l ? `<span class="wl-g-k">${esc(l)}</span>` : ''}${l && v ? ' ' : ''}${
          v ? `<span class="wl-g-v">${esc(v)}</span>` : ''
        }</span>`;
      }
      return '';
    })
    .filter(Boolean);
  return parts.length
    ? `<span class="wl-g-meta">${parts.join('<span class="wl-g-dot" aria-hidden="true">·</span>')}</span>`
    : '';
}

/** The group head's content: chevron · ref · title · count · time, then the meta line when given. */
export function groupHeadHtml(g: WorkGroup, lang?: WorkLogLang): string {
  const t = workLogStrings(lang);
  const ref = g.ref === undefined || g.ref === null ? g.id : String(g.ref);
  const title = String(g.title ?? '').trim();
  const n = Number.isFinite(Number(g.count)) && g.count !== undefined ? Math.max(0, Math.floor(Number(g.count))) : 0;
  const count = g.count === undefined ? (g.entries?.length ?? 0) : n;
  return `${icon('chevron-right', { size: 12, class: 'wl-g-chev' })}${
    ref ? `<span class="wl-g-ref">${esc(ref)}</span>` : ''
  }<span${attrs({ class: 'wl-g-title', 'data-empty': !title })}>${esc(title || t.untitled)}</span><span class="wl-g-count" aria-hidden="true">${count}</span><span class="sr-only">${esc(
    t.entries(count),
  )}</span>${timeHtml(g.at, false, 'wl-g-time')}${workMetaHtml(g.meta)}`;
}

/** What the agent row says: status word, time text, tools text. */
function agentParts(a: WorkAgent, lang: WorkLogLang | undefined, now: number) {
  const t = workLogStrings(lang);
  const status = agentStatus(a.status);
  const tools = Number.isFinite(Number(a.tools)) && a.tools !== undefined ? Math.max(0, Math.floor(a.tools)) : null;
  const live = status === 'running' && Number.isFinite(Number(a.startedAt)) && a.startedAt !== undefined;
  const time = live
    ? fmtDurationIn(now - Number(a.startedAt), lang)
    : Number.isFinite(Number(a.duration)) && a.duration !== undefined
      ? fmtDurationIn(Number(a.duration), lang)
      : '';
  return { t, status, word: t.agent[status], tools: tools === null ? '' : t.tools(tools), time, live };
}

const AGENT_ICON: Record<WorkAgentStatus, string> = {
  running: '',
  waiting: 'clock',
  done: 'check',
  failed: 'cross',
  stopped: 'stop',
  unknown: 'info',
};

/** The child agent row: one button (status icon + word, name, time, tools, activity, Open). */
export function agentRowHtml(a: WorkAgent, entryId: string, lang?: WorkLogLang, now = Date.now()): string {
  const p = agentParts(a, lang, now);
  const name = String(a.name ?? '').trim() || p.t.agentFallback;
  const mark = p.status === 'running' ? '<span class="wl-spin"></span>' : icon(AGENT_ICON[p.status], { size: 14 });
  const act = String(a.activity ?? '').trim();
  return `<button${attrs({
    type: 'button',
    class: 'wl-agent',
    tabindex: '-1',
    'data-nav': true,
    'data-key': `a:${entryId}`,
    'data-agent': String(a.id ?? ''),
    'data-status': p.status,
    'aria-label': p.t.openAgent(name, p.word, p.tools),
  })}><span class="wl-ag-icon" aria-hidden="true">${mark}</span><span class="wl-ag-name">${esc(
    name,
  )}</span><span class="wl-ag-meta"><span class="wl-ag-st">${esc(p.word)}</span>${
    p.time
      ? `<span${attrs({ class: 'wl-ag-time', 'data-since': p.live ? String(Number(a.startedAt)) : undefined })}>${esc(p.time)}</span>`
      : ''
  }${p.tools ? `<span class="wl-ag-tools">${esc(p.tools)}</span>` : ''}</span>${
    act ? `<span class="wl-ag-act">${esc(act)}</span>` : ''
  }<span class="wl-ag-open">${esc(p.t.open)}${icon('arrow-right', { size: 12 })}</span></button>`;
}

const TOOL_ICON: Record<WorkToolStatus, string> = {
  running: '',
  success: 'check',
  error: 'cross',
  interrupted: 'stop',
};

/** The plain tool line shown when no card is slotted: status mark + word, name, summary, time. */
export function toolLineHtml(e: WorkEntry, lang?: WorkLogLang): string {
  const t = workLogStrings(lang);
  const tool: Partial<WorkTool> = e.tool && typeof e.tool === 'object' ? e.tool : {};
  const status = toolStatus(tool.status);
  const mark =
    status === 'running' ? '<span class="wl-spin" aria-hidden="true"></span>' : icon(TOOL_ICON[status], { size: 12 });
  const name = String(tool.name ?? '');
  const summary = String(tool.summary ?? e.text ?? '');
  return `<div${attrs({ class: 'wl-tool', 'data-status': status })}><span class="wl-mark">${mark}<span class="wl-st">${esc(
    t.tool[status],
  )}</span></span>${name ? `<span class="wl-tool-name">${esc(name)}</span>` : ''}${
    summary ? `<span class="wl-tool-sum">${esc(summary)}</span>` : ''
  }${timeHtml(e.at, true, 'wl-time')}</div>`;
}

/** Per-entry state the element keeps (not data). */
export interface EntryView {
  lang?: WorkLogLang;
  /** Id stem unique in the element (`wl12`): ids and aria-controls. */
  uid: string;
  /** Raw output open. */
  open?: boolean;
  /** Open skill index. */
  skill?: number | null;
  /** Copy just copied. */
  copied?: boolean;
  /** Retry pressed: loading until the host answers. */
  retrying?: boolean;
  /** The detail opened in this render (fade in). */
  entering?: boolean;
  now?: number;
}

/** The row opens to its raw output. */
export function entryExpandable(e: WorkEntry): boolean {
  const kind = entryKind(e.kind);
  return kind !== 'tool' && kind !== 'agent' && !!(e.hasRaw || (e.raw && typeof e.raw === 'object'));
}

/** One entry: `<div class="wl-entry" data-kind data-entry data-anchor>` with its row, skills, child agent, raw. */
export function entryHtml(e: WorkEntry, v: EntryView): string {
  const t = workLogStrings(v.lang);
  const kind = entryKind(e.kind);
  const id = String(e.id);
  const agent = e.agent && typeof e.agent === 'object' ? agentRowHtml(e.agent, id, v.lang, v.now) : '';
  const open = (inner: string) =>
    `<div${attrs({ class: 'wl-entry', 'data-kind': kind, 'data-entry': id, 'data-anchor': true })}>${inner}</div>`;
  if (kind === 'tool')
    return open(`<slot${attrs({ name: toolSlotName(id) })}>${toolLineHtml(e, v.lang)}</slot>${agent}`);
  if (kind === 'agent') return open(agent);
  const expandable = entryExpandable(e);
  const isOpen = expandable && !!v.open;
  const rawId = `${v.uid}-raw`;
  const chev = expandable ? icon('chevron-right', { size: 12, class: 'wl-row-chev' }) : '';
  const time = timeHtml(e.at, true, 'wl-time');
  const text = String(e.text ?? '');
  let row: string;
  if (kind === 'system') {
    const sys = e.system && typeof e.system === 'object' ? e.system : { kind: '' };
    row = `<div class="wl-head">${sysBadgeHtml(String(sys.kind ?? ''), v.lang, sys.label)}<span class="wl-sys-line">${esc(
      text,
    )}</span>${time}${chev}</div>`;
  } else {
    const label = e.label === undefined || e.label === null || e.label === '' ? t.kinds[kind] : String(e.label);
    row = `<div class="wl-head">${icon(KIND_ICON[kind], { size: 12, class: 'wl-k-icon' })}<span class="wl-label">${esc(
      label,
    )}</span>${time}${chev}</div>${text ? `<div class="wl-text">${esc(text)}</div>` : ''}`;
  }
  const rowAttrs = expandable
    ? {
        class: 'wl-row',
        role: 'button',
        tabindex: '-1',
        'data-nav': true,
        'data-key': `e:${id}`,
        'aria-expanded': String(isOpen),
        'aria-controls': rawId,
      }
    : { class: 'wl-row' };
  const skills = Array.isArray(e.skills)
    ? skillBadgesHtml(e.skills, { lang: v.lang, open: v.skill ?? null, keyPrefix: `s:${id}`, idPrefix: v.uid })
    : '';
  let detail = '';
  if (expandable) {
    const raw: RawView = v.retrying || !e.raw || typeof e.raw !== 'object' ? { state: 'loading' } : e.raw;
    detail = `<div${attrs({
      class: 'wl-detail',
      id: rawId,
      'aria-live': 'off',
      hidden: !isOpen,
      'data-enter': isOpen && !!v.entering,
    })}>${isOpen ? rawViewHtml(raw, { lang: v.lang, keyPrefix: `r:${id}`, copied: !!v.copied }) : ''}</div>`;
  }
  return open(`<div${attrs(rowAttrs)}>${row}</div>${skills}${agent}${detail}`);
}
