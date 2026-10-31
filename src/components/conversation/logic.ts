import type { RawView, SkillBadge } from '../../core/activity';
import type { AiAnswerData } from '../ai-answer/ai-answer';

export type ConversationLang = 'en' | 'ko';
export type TurnRole = 'user' | 'assistant' | 'system' | 'pending';

/** An assistant turn's summary: a title and a text, or why there is none yet. */
export interface TurnSummary {
  title?: string;
  text?: string;
  /** Offer Retry in Raw's Summary view: `ui-retry` with `{ id, what: 'summary' }`. */
  canRetry?: boolean;
  /** The summary failed (e.g. "HTTP 500"): shown in the Summary view instead of the text. */
  error?: string;
}

/** A long operation a system turn reports while it runs (a compaction, a restart, a background job). */
export interface TurnProgress {
  /** When it started (epoch ms). */
  startedAt: number;
  /** How long it usually takes (ms). Past it the bar turns into an over-run sweep; 0 / absent: no percentage. */
  estimateMs?: number;
  /** What it is doing, e.g. "Compacting…". Default: "Compacting…" for kind compact, else "Working…". */
  verb?: string;
  /** Finished: no bar and no timer — the turn's `text` (or "Done") says how it went. */
  done?: boolean;
}

/**
 * One turn of the conversation. `id` is required and stable (it keys the node). Fields per role:
 * - user: `name`, `at`, `text`, `media`, `skills`
 * - assistant: `name`, `at`, `markdown`, `source`, `summary`, `responseMs`, `streaming`, `loading`, `deferred`,
 *   `error`, `canRetry`, `attachments`, `linkTitles`
 * - system: `name`, `at`, `kind`, `label`, `text`, `facts`, `raw`, `media`, `progress`
 * - pending: `name` — the "writing the answer" row; always shown last.
 */
export interface ConversationTurn {
  id: string;
  role: TurnRole;
  /** Who: the person (user), the assistant's name (default `data.assistantName`), or "System". */
  name?: string;
  /** When (epoch ms or an ISO string): HH:MM, the full date in the tooltip. */
  at?: number | string;
  /** user: the instruction as typed (plain text, clamped to `data.clampLines`). system: the one line it shows. */
  text?: string;
  /**
   * user: the host put media for this turn in slot `media-<id>` (shown above the words). system: the files the
   * intercepted message carried, in the same slot — shown in the open detail (the row opens for them alone).
   */
  media?: boolean;
  /** user: skills the instruction invoked — chips that open their text. */
  skills?: SkillBadge[];
  /** assistant: the answer as written (markdown, rendered safely by `<ui-ai-answer>`). */
  markdown?: string;
  /** assistant: the source shown in Raw, when it differs from `markdown`. */
  source?: string;
  /**
   * assistant: the turn's summary — shown in Raw, and as the heading of an answer that is empty or failed.
   * `canRetry` offers Retry in Raw's Summary view (`ui-retry` with `what: 'summary'`); `error` says why there is
   * none yet (shown instead of the text, with the alert mark).
   */
  summary?: TurnSummary;
  /** assistant: time from the instruction to the answer (ms) — the chip in the header. */
  responseMs?: number;
  /** assistant: more text is coming. */
  streaming?: boolean;
  /** assistant: the host is fetching the recorded answer. */
  loading?: boolean;
  /**
   * assistant: the answer is recorded but not fetched yet. With no `markdown`, the turn's summary heads the answer
   * and a “Load answer” button sends `ui-load-answer` with the turn id; Raw keeps its Summary view and has no Source
   * until the text arrives. `loading` and `error` take precedence.
   */
  deferred?: boolean;
  /**
   * assistant: the answer could not be had — the cause only (e.g. "HTTP 404"), not a sentence: it is shown as
   * “Couldn’t get the answer (<error>)” / “답변을 불러오지 못했습니다 (<error>)”.
   */
  error?: string;
  /** assistant: offer "Try again" next to the error (`ui-retry` with the turn id). */
  canRetry?: boolean;
  /** assistant: the host put files this answer produced in slot `attachments-<id>`. */
  attachments?: boolean;
  /** assistant: titles the host knows for some URLs in the answer. */
  linkTitles?: Record<string, string>;
  /** system: compact · restart · retry · goal · cron · background (or any word — shown as is). */
  kind?: string;
  /** system: badge text instead of the kind's word. */
  label?: string;
  /** system: the facts the row opens to, as `[label, value]` pairs. */
  facts?: Array<[string, string]>;
  /** system: the text as it was sent (shown in the open row). */
  raw?: string;
  /** system: a long operation — bar, elapsed time ticking in place, percent. */
  progress?: TurnProgress;
}

export interface ConversationData {
  /** The turns, oldest first. Unchanged ids keep their nodes; new ones after the last are live, before the first history. */
  turns: ConversationTurn[];
  /** Older turns exist: scrolling near the top asks for them (`ui-load-older`). */
  hasMore?: boolean;
  /** A page is on its way: skeleton turns with no turns yet, else the "Loading older…" row. */
  loading?: boolean;
  /** Something failed: an alert with Try again (`ui-retry` with id null) — the whole box without turns, a bar above them. */
  error?: string;
  /** Offer Try again with `error`. Default true. */
  canRetry?: boolean;
  /** The answer is being written: a writing row under the assistant's avatar, always last. */
  pending?: boolean;
  /** Name over the assistant's turns. Default "Assistant" / "어시스턴트". */
  assistantName?: string;
  /** Lines a long instruction shows before "Show more". Default 12. */
  clampLines?: number;
  /** The clock (epoch ms) for progress — demos and tests; it keeps ticking from there. Default Date.now(). */
  now?: number;
  /** Accessible name of the list. Default "Conversation" / "대화". */
  label?: string;
  /** Empty-state text. Default "No messages yet" / "아직 메시지가 없습니다". */
  emptyText?: string;
  /** Marker at the top once there is nothing older. Default "Start of conversation"; empty string hides it. */
  startText?: string;
  /** Announce new turns politely (`role="log"`). Default true; older pages are never announced. */
  live?: boolean;
}

/**
 * `ui-retry` detail: the turn whose answer to fetch again, or null for the conversation itself. `what: 'summary'`
 * when the person pressed Retry on the turn's summary (Raw's Summary view, `summary.canRetry`); absent for the answer.
 */
export interface ConversationRetryDetail {
  id: string | null;
  what?: 'summary';
}

/** `ui-select` detail (notification, `selectable`): the turn the person checked or unchecked, and every selected id. */
export interface ConversationSelectDetail {
  id: string;
  selected: boolean;
  /** The selected turns' ids, in the order shown. */
  ids: string[];
}

/** `ui-load-answer` detail (cancelable): the deferred turn whose answer to fetch (“Load answer” was pressed). */
export interface ConversationLoadDetail {
  id: string;
}

/** `ui-copy` detail (notification): what was copied from which turn. */
export interface ConversationCopyDetail {
  id: string;
  text: string;
  /** answer: the answer's own Copy · summary / source: Raw's two views · raw: a system turn's raw text. */
  from: 'answer' | 'summary' | 'source' | 'raw';
}

export const DEFAULT_CLAMP = 12;
/** Key of the writing row when it comes from `data.pending` (a `{ role: 'pending' }` turn keys by its own id). */
export const PENDING_KEY = 'ui-conversation:pending';

export const STRINGS = {
  en: {
    label: 'Conversation',
    user: 'User',
    assistant: 'Assistant',
    system: 'System',
    more: 'Show more',
    less: 'Show less',
    media: 'Attached media',
    files: 'Files from this answer',
    raw: 'Raw',
    summary: 'Summary',
    source: 'Source',
    rawText: 'Raw text',
    empty: 'No messages yet',
    start: 'Start of conversation',
    failed: 'Couldn’t load the conversation',
    failedSome: 'Couldn’t load some turns',
    retry: 'Try again',
    compacting: 'Compacting…',
    working: 'Working…',
    done: 'Done',
    over: 'Taking longer than expected',
    of: (est: string) => `/ ~${est}`,
    details: 'Details',
    noSummary: 'No summary yet',
    pick: (name: string) => `Select the turn by ${name}`,
  },
  ko: {
    label: '대화',
    user: '사용자',
    assistant: '어시스턴트',
    system: '시스템',
    more: '더 보기',
    less: '접기',
    media: '첨부한 미디어',
    files: '이 답변이 만든 파일',
    raw: '원본',
    summary: '요약',
    source: '원문',
    rawText: '보낸 원문',
    empty: '아직 메시지가 없습니다',
    start: '대화의 시작',
    failed: '대화를 불러오지 못했습니다',
    failedSome: '일부 대화를 불러오지 못했습니다',
    retry: '다시 시도',
    compacting: '압축 중…',
    working: '작업 중…',
    done: '완료',
    over: '예상보다 오래 걸리는 중',
    of: (est: string) => `/ 약 ${est}`,
    details: '자세히',
    noSummary: '아직 요약이 없습니다',
    pick: (name: string) => `${name}의 대화 선택`,
  },
};
export type ConversationStrings = (typeof STRINGS)['en'];

export function conversationStrings(lang?: string): ConversationStrings {
  return lang === 'ko' ? STRINGS.ko : STRINGS.en;
}

const ROLES = new Set<TurnRole>(['user', 'assistant', 'system', 'pending']);

/**
 * The turns as the list shows them: entries without an id dropped, ids as strings, duplicates after the first
 * dropped, unknown roles read as system. The writing row (a `{ role: 'pending' }` turn, else `pending` → a row keyed
 * `PENDING_KEY`) is split off — it always goes last.
 */
export function normalizeTurns(
  turns: unknown,
  pending?: boolean,
): { regular: ConversationTurn[]; pending: ConversationTurn | null } {
  const list = Array.isArray(turns) ? turns : [];
  const seen = new Set<string>();
  const regular: ConversationTurn[] = [];
  let row: ConversationTurn | null = null;
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const t = raw as ConversationTurn;
    if (t.id === undefined || t.id === null || t.id === '') continue;
    const id = String(t.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const role: TurnRole = ROLES.has(t.role) ? t.role : 'system';
    const turn = id === t.id && role === t.role ? t : { ...t, id, role };
    if (role === 'pending') {
      if (!row) row = turn;
      continue;
    }
    regular.push(turn);
  }
  if (!row && pending) row = { id: PENDING_KEY, role: 'pending' };
  return { regular, pending: row };
}

/** What to do to go from the keys shown (in order) to the keys wanted. */
export interface TurnPlan {
  /** Keys shown that are no longer wanted. */
  remove: string[];
  /** New keys before the first one kept: history, prepended without motion. */
  prepend: string[];
  /** New keys between kept ones: `[key, before]` (inserted before the kept key `before`). */
  insert: Array<[string, string]>;
  /** New keys after the last one kept (live, animated) — or every key when `first`. */
  append: string[];
  /** Nothing shown is kept: `append` is a first page (no motion). */
  first: boolean;
  /** Keys were shown and none is kept (another conversation): clear before the first page. */
  reset: boolean;
}

/**
 * The diff of a turn list by id: kept ids stay put, ids before the first kept one are history (prepend), ids after
 * the last kept one are live (append), ids in between go before the next kept id. Order among kept ids is the
 * order shown (turns do not move).
 */
export function planTurns(current: string[], next: string[]): TurnPlan {
  const want = new Set(next);
  const shown = new Set(current);
  const remove = current.filter((k) => !want.has(k));
  const kept = current.filter((k) => want.has(k));
  if (!kept.length) {
    return { remove, prepend: [], insert: [], append: next.slice(), first: true, reset: current.length > 0 };
  }
  const at = new Map(next.map((k, i) => [k, i]));
  let lo = Number.POSITIVE_INFINITY;
  let hi = -1;
  for (const k of kept) {
    const i = at.get(k) ?? -1;
    if (i < lo) lo = i;
    if (i > hi) hi = i;
  }
  const insert: Array<[string, string]> = [];
  for (let i = lo + 1; i < hi; i++) {
    const k = next[i];
    if (shown.has(k)) continue;
    let before = '';
    for (let j = i + 1; j <= hi; j++)
      if (shown.has(next[j])) {
        before = next[j];
        break;
      }
    insert.push([k, before]);
  }
  return { remove, prepend: next.slice(0, lo), insert, append: next.slice(hi + 1), first: false, reset: false };
}

/** Where a running operation is: elapsed ms, percent of the estimate (0–99, null without one), past the estimate. */
export function progressState(
  p: TurnProgress | undefined,
  now: number,
): { elapsed: number; estimate: number; pct: number | null; over: boolean; done: boolean } {
  const start = Number(p?.startedAt);
  const elapsed = Number.isFinite(start) ? Math.max(0, now - start) : 0;
  const est = Number(p?.estimateMs);
  const estimate = Number.isFinite(est) && est > 0 ? est : 0;
  const done = !!p?.done;
  if (!estimate) return { elapsed, estimate, pct: null, over: false, done };
  return {
    elapsed,
    estimate,
    pct: Math.max(0, Math.min(99, Math.floor((elapsed / estimate) * 100))),
    over: elapsed > estimate,
    done,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A turn's time: `short` HH:MM (24h, local), `full` the date and time for the tooltip, `iso` for `<time datetime>`. */
export function turnTime(
  at: number | string | undefined,
  lang: ConversationLang = 'en',
): { short: string; full: string; iso: string } | null {
  if (at === undefined || at === null || at === '') return null;
  const d = new Date(typeof at === 'string' && /^\d+$/.test(at) ? Number(at) : at);
  const ms = d.getTime();
  if (!Number.isFinite(ms)) return null;
  let full: string;
  try {
    full = d.toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    full = d.toString();
  }
  return { short: `${pad(d.getHours())}:${pad(d.getMinutes())}`, full, iso: d.toISOString() };
}

/** The avatar letter: the name's first character (a whole code point), upper-cased; "?" without a name. */
export function initialOf(name: string | undefined): string {
  const first = Array.from(String(name ?? '').trim())[0];
  return first ? first.toUpperCase() : '?';
}

/** A clamped block hides text: its full height is more than a pixel past the box. */
export function clampOverflows(scrollHeight: number, clientHeight: number): boolean {
  return Number(scrollHeight) - Number(clientHeight) > 1;
}

/** The summary as one line: title — text, whitespace folded. */
export function summaryLine(summary: ConversationTurn['summary']): string {
  if (!summary) return '';
  return [summary.title, summary.text]
    .map((x) =>
      String(x ?? '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .join(' — ');
}

/**
 * What the nested `<ui-ai-answer>` gets for an assistant turn. The response time is not passed (the turn's header
 * shows it); an answer that is empty or failed is headed by the turn's summary; `animate` only for an answer that
 * arrived live.
 */
export function turnAnswerData(turn: ConversationTurn, animate: boolean): AiAnswerData {
  const markdown = String(turn.markdown ?? '');
  const data: AiAnswerData = { markdown, animate };
  if (turn.streaming) data.streaming = true;
  if (turn.loading) data.loading = true;
  if (turn.deferred) data.deferred = true;
  if (turn.error) data.error = String(turn.error);
  if (turn.canRetry) data.canRetry = true;
  if (turn.linkTitles && typeof turn.linkTitles === 'object') data.linkTitles = turn.linkTitles;
  if (!markdown.trim() && !turn.loading && !turn.streaming) {
    const title = summaryLine(turn.summary);
    if (title) data.title = title;
  }
  return data;
}

/** The text Raw shows as the answer's source: `source` when given, else the markdown as written. */
export function turnSource(turn: ConversationTurn): string {
  return String(turn.source ?? turn.markdown ?? '');
}

/** Clamp lines as an integer 1–200 (default 12). */
export function clampLinesOf(n: unknown): number {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v >= 1 ? Math.min(200, v) : DEFAULT_CLAMP;
}

/** Raw's Summary view has something to show: the text, why it failed, or a Retry to ask for one. */
export function hasSummaryView(summary: TurnSummary | undefined): boolean {
  return !!summary && (!!summaryText(summary) || !!summary.error || !!summary.canRetry);
}

/**
 * Raw's Summary view: the text when there is one (Copy; Retry with `canRetry`), else the failure (`error`, alert
 * mark) or the quiet "no summary yet" line — each with Retry when `canRetry`.
 */
export function summaryView(summary: TurnSummary | undefined, noneText: string): RawView {
  const text = summaryText(summary);
  const canRetry = !!summary?.canRetry;
  if (text) return { state: 'ready', text, canRetry };
  const error = summary?.error === undefined || summary.error === null ? '' : String(summary.error);
  if (error) return { state: 'error', note: error, canRetry };
  return { state: 'missing', note: noneText, canRetry };
}

/** The summary as Raw shows and copies it: the title, a blank line, the text. */
export function summaryText(summary: ConversationTurn['summary']): string {
  if (!summary) return '';
  return [summary.title, summary.text]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join('\n\n');
}

/** The response-time chip: <1s · 12s · 1m 5s · 2h 3m (ko: 1초 미만 · 12초 · 1분 5초 · 2시간 3분). Empty when unknown. */
export function tookText(ms: unknown, lang: ConversationLang = 'en'): string {
  const v = Number(ms);
  if (!Number.isFinite(v) || v <= 0) return '';
  const ko = lang === 'ko';
  if (v < 1000) return ko ? '1초 미만' : '<1s';
  const s = Math.floor(v / 1000);
  if (s < 60) return ko ? `${s}초` : `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return ko ? `${m}분 ${s % 60}초` : `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return ko ? `${h}시간 ${m % 60}분` : `${h}h ${m % 60}m`;
}

/** A running clock: m:ss, h:mm:ss past an hour (whole seconds, rounded down). */
export function clockText(ms: unknown): string {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

let unique = 0;
/**
 * What a turn looks like, as a string to compare: equal strings mean the node can stay. A turn that cannot be
 * serialised (a cycle) never compares equal.
 */
export function turnSignature(turn: ConversationTurn): string {
  try {
    return JSON.stringify(turn) ?? '';
  } catch {
    unique++;
    return `\u0000${unique}`;
  }
}
