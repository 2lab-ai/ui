import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { fmtAgo, fmtDuration, fmtInt, fmtUsd } from '../../core/format';
import { esc, escAttr } from '../../core/html';
import { styles } from './styles';

/** Where a run stands. `waiting` = it needs the person; `idle` = parked (sleeping, archived, never started). */
export type InboxStatus = 'waiting' | 'running' | 'done' | 'failed' | 'idle';

/** A button in an open card. A string `disabled` keeps it visible and says why it cannot be pressed. */
export interface InboxAction {
  id: string;
  label: string;
  disabled?: boolean | string;
}

/** One line of an open card's step list. Plain strings are steps; the last one is drawn as the current step. */
export interface InboxDetail {
  label: string;
  /** Right-aligned meta (time, tool calls…). */
  meta?: string;
  state?: 'done' | 'current' | 'pending';
}

export interface InboxCard {
  id: string;
  title: string;
  /** One or two sentences: why the card is here / where it stands (clamped to two lines). */
  summary?: string;
  status: InboxStatus;
  /** Replaces the status word (e.g. `Sleeping`, `Archived`, `Retrying`). */
  statusText?: string;
  /**
   * Epoch ms the current status began. `running`: the live clock runs from here (plus `elapsedMs`);
   * every other status shows it as recency (`· 6m ago`). Without it no clock and no age are shown.
   */
  since?: number;
  /** Active time in ms: `done` shows `Done in …`; `running` adds it to the live clock (time before `since`). */
  elapsedMs?: number;
  /** The task in progress: `#id label · 3m 12s` (live from `startedAt`, else the static `elapsedMs`). */
  task?: { id?: string; label: string; startedAt?: number; elapsedMs?: number };
  /** Sub-agent counts. Dots are drawn from these counts only; the rest of `total` is drawn hollow (unknown). */
  agents?: { total: number; running?: number; done?: number; failed?: number };
  /** Total tokens (all kinds). Shown only when given. */
  tokens?: number;
  /** API-equivalent cost in USD. Shown only when given. */
  costUsd?: number;
  /** Names of the files the run made (newest first). Up to four chips + `+N`. */
  artifacts?: string[];
  /** Tasks / steps done of total, shown in the card foot. */
  steps?: { done: number; total: number };
  /** Context window used, 0–100. Above 60 warns, above 80 is danger. */
  contextPct?: number;
  /** Model (agent) name, shown at the left of the open card's button row. */
  model?: string;
  /** The one decision this viewer can make here — the card's single ink button. */
  primary?: InboxAction;
  /** Secondary buttons (outline), left of the primary. */
  actions?: InboxAction[];
  /** The open card's step list, oldest first. Over five, the earliest fold into `+N earlier`. */
  details?: Array<string | InboxDetail>;
}

export interface InboxColumn {
  id: string;
  label: string;
  /** Shown while the column draws no cards. Default `Nothing here`. */
  emptyText?: string;
  /** Cards in display order. A card id listed twice renders once (first wins). */
  cards: InboxCard[];
}

export interface AgentInboxData {
  columns: InboxColumn[];
  /** Card ids that start open the first time they appear. Afterwards the person's toggles rule. */
  expanded?: string[];
  /** Label of the open card's Open button (`ui-open`). `false` hides it. Default `Open` / `열기`. */
  openLabel?: string | false;
}

export type InboxTone = 'wait' | 'run' | 'done' | 'fail' | 'rest';

/** A card held in the column it is drawn in while its new status shows. */
export interface LaneHold {
  from: string;
  to: string;
  until: number;
}

/** How long a card whose column changed shows its new status in place before it moves. */
export const BOARD_HOLD_MS = 900;
/** A burst of announcements within this window is said once. */
export const ANNOUNCE_MS = 1000;
const MAX_DOTS = 6;
const MAX_CHIPS = 4;
const MAX_DETAILS = 5;
const COUNT_MS = 900;

const STATUSES: readonly InboxStatus[] = ['waiting', 'running', 'done', 'failed', 'idle'];

function agoKo(at: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 45) return '방금';
  const m = Math.floor(s / 60);
  if (m < 60) return `${Math.max(1, m)}분 전`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

const STRINGS = {
  en: {
    status: {
      waiting: 'Waiting for you',
      running: 'Running',
      done: 'Done',
      failed: 'Failed',
      idle: 'Idle',
    } as Record<InboxStatus, string>,
    doneIn: 'Done in ',
    empty: 'Nothing here',
    open: 'Open',
    columns: { needs: 'Needs you', running: 'Running', done: 'Done' },
    agents: 'Sub-agents',
    agentsRunning: (n: number) => `running ${n}`,
    agentsFailed: (n: number) => `failed ${n}`,
    tok: 'tok',
    tokTitle: 'Total tokens',
    costTitle: 'API-equivalent cost',
    steps: 'Tasks done / total',
    ctx: (p: number) => `Context window used — ${p}%`,
    arts: 'Files the run made',
    earlier: (n: number) => `+${n} earlier`,
    announce: (w: number, r: number) => `${w} need${w === 1 ? 's' : ''} you, ${r} running`,
    changed: (title: string, word: string) => `${title}: ${word}.`,
    ago: (at: number, now?: number) => fmtAgo(at, now),
  },
  ko: {
    status: {
      waiting: '입력 대기',
      running: '실행 중',
      done: '완료',
      failed: '실패',
      idle: '대기',
    } as Record<InboxStatus, string>,
    doneIn: '완료 · ',
    empty: '비어 있음',
    open: '열기',
    columns: { needs: '응답 필요', running: '실행 중', done: '완료' },
    agents: '서브에이전트',
    agentsRunning: (n: number) => `실행 ${n}`,
    agentsFailed: (n: number) => `실패 ${n}`,
    tok: 'tok',
    tokTitle: '총 토큰',
    costTitle: 'API 환산 비용',
    steps: '완료한 task / 전체',
    ctx: (p: number) => `컨텍스트 ${p}% 사용`,
    arts: '모델이 만든 산출물',
    earlier: (n: number) => `이전 ${n}개 더`,
    announce: (w: number, r: number) => `응답이 필요한 세션 ${w}개, 실행 중 ${r}개`,
    changed: (title: string, word: string) => `${title}: ${word}.`,
    ago: agoKo,
  },
};
type Strings = (typeof STRINGS)['en'];

const SPARK_SVG =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M7 1.5c.5 3.3 2.2 5 5.5 5.5-3.3.5-5 2.2-5.5 5.5C6.5 9.2 4.8 7.5 1.5 7c3.3-.5 5-2.2 5.5-5.5z"/><circle cx="13" cy="12.6" r="1.3"/></svg>';
const WAIT_SVG = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.8 15 14H1z"/></svg>';
const FAIL_SVG =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm-.8 3h1.6v4.8H7.2zM8 12.3a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>';
const TASKS_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.2l1.4 1.4 2.4-2.6M2.5 10.2l1.4 1.4 2.4-2.6M9 4.5h4.5M9 10.5h4.5"/></svg>';
const CTX_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="5.6"/><path d="M8 8V2.4A5.6 5.6 0 0 1 13.6 8z" fill="currentColor" stroke="none"/></svg>';
const AGENTS_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="4" cy="3.5" r="1.8"/><circle cx="12" cy="8" r="1.8"/><circle cx="12" cy="13" r="1.8"/><path d="M4 5.3v5.2c0 1.4 1.1 2.5 2.5 2.5h3.7M4 8h6.2"/></svg>';

export type ArtifactKind = 'image' | 'html' | 'markdown' | 'pdf' | 'audio' | 'video' | 'text' | 'file';
const ART_GLYPH: Record<ArtifactKind, string> = {
  image:
    '<rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="6" cy="6.5" r="1.2"/><path d="M14 11l-3.5-3.5L4 13"/>',
  audio: '<path d="M2.5 7.5v1M5 5.5v5M7.5 3v10M10 5v6M12.5 6.5v3"/>',
  video: '<rect x="2" y="4" width="9" height="8" rx="1.5"/><path d="M11 7l3-2v6l-3-2z"/>',
  html: '<path d="M5.5 5L2.5 8l3 3M10.5 5l3 3-3 3M9 3.5l-2 9"/>',
  markdown: '<path d="M4 2h5l3 3v9H4z"/><path d="M6 8h4M6 10.5h4M6 5.5h1.5"/>',
  pdf: '<path d="M4 2h5l3 3v9H4z"/><path d="M9 2v3h3M6 10h4"/>',
  text: '<path d="M3 4h10M3 7h10M3 10h7M3 13h5"/>',
  file: '<path d="M4 2h5l3 3v9H4z"/><path d="M9 2v3h3"/>',
};
const glyph = (k: ArtifactKind) =>
  `<svg class="ib-glyph" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ART_GLYPH[k]}</svg>`;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// ── Pure helpers ───────────────────────────────────────────────────────────

/** The status a card is drawn with (anything unknown reads as idle). */
export function statusOf(card: Pick<InboxCard, 'status'>): InboxStatus {
  return STATUSES.includes(card?.status) ? card.status : 'idle';
}

/** Status → tag tone: waiting amber, running blue, done green, failed red, idle grey. */
export function statusTone(status: InboxStatus): InboxTone {
  return status === 'waiting'
    ? 'wait'
    : status === 'running'
      ? 'run'
      : status === 'done'
        ? 'done'
        : status === 'failed'
          ? 'fail'
          : 'rest';
}

/** Glyph kind from a file name's extension. */
export function artifactKind(name: string): ArtifactKind {
  const m = /\.([a-z0-9]{1,6})$/i.exec(String(name ?? '').trim());
  const ext = m ? m[1].toLowerCase() : '';
  if (/^(png|jpe?g|gif|webp|svg|avif|bmp)$/.test(ext)) return 'image';
  if (/^html?$/.test(ext)) return 'html';
  if (/^(md|mdx|markdown)$/.test(ext)) return 'markdown';
  if (ext === 'pdf') return 'pdf';
  if (/^(mp3|wav|m4a|ogg|flac|aac)$/.test(ext)) return 'audio';
  if (/^(mp4|mov|webm|mkv)$/.test(ext)) return 'video';
  if (/^(txt|log|csv|json|ya?ml|xml)$/.test(ext)) return 'text';
  return 'file';
}

/**
 * Sub-agent dots from counts: running, failed, done, then unknown (hollow) — at most `max`, the rest as `more`.
 * Only what the counts say is drawn; nothing is invented.
 */
export function agentDots(
  a: InboxCard['agents'],
  max = MAX_DOTS,
): { dots: Array<'running' | 'failed' | 'done' | 'unknown'>; more: number } {
  const total = Math.floor(num(a?.total));
  if (!total) return { dots: [], more: 0 };
  const running = Math.min(total, Math.floor(num(a?.running)));
  const failed = Math.min(total - running, Math.floor(num(a?.failed)));
  const done = Math.min(total - running - failed, Math.floor(num(a?.done)));
  const all: Array<'running' | 'failed' | 'done' | 'unknown'> = [
    ...Array<'running'>(running).fill('running'),
    ...Array<'failed'>(failed).fill('failed'),
    ...Array<'done'>(done).fill('done'),
    ...Array<'unknown'>(total - running - failed - done).fill('unknown'),
  ];
  return { dots: all.slice(0, max), more: Math.max(0, total - max) };
}

/** How many cards need the person (waiting + failed) and how many run — what the live region says. */
export function boardCounts(columns: InboxColumn[]): { needs: number; running: number } {
  const seen = new Set<string>();
  let needs = 0;
  let running = 0;
  for (const col of Array.isArray(columns) ? columns : []) {
    for (const c of Array.isArray(col?.cards) ? col.cards : []) {
      if (!c || seen.has(String(c.id))) continue;
      seen.add(String(c.id));
      const s = statusOf(c);
      if (s === 'waiting' || s === 'failed') needs++;
      else if (s === 'running') running++;
    }
  }
  return { needs, running };
}

/** The reference board's three columns from a flat list: Needs you (waiting, failed) · Running · Done (done, idle). */
export function columnsByStatus(cards: InboxCard[], lang: 'en' | 'ko' = 'en'): InboxColumn[] {
  const L = STRINGS[lang === 'ko' ? 'ko' : 'en'].columns;
  const list = Array.isArray(cards) ? cards : [];
  const of = (...s: InboxStatus[]) => list.filter((c) => c && s.includes(statusOf(c)));
  return [
    { id: 'needs-you', label: L.needs, cards: of('waiting', 'failed') },
    { id: 'running', label: L.running, cards: of('running') },
    { id: 'done', label: L.done, cards: of('done', 'idle') },
  ];
}

/**
 * The column each card is drawn in this render. `want` = the column its data puts it in; `drawn` = the column
 * it is drawn in now (cards on screen only); `holds` = the running holds. A card whose column changed stays where
 * it is drawn until its deadline (`now + BOARD_HOLD_MS` when the change is first seen). Data that returns to the
 * drawn column drops the hold; a new target keeps the first deadline. `on = false` (reduced motion, first paint,
 * hidden tab) moves every card at once. Returns the columns, the holds still running and the earliest deadline.
 */
export function holdLanes(
  want: Record<string, string>,
  drawn: Record<string, string>,
  holds: Record<string, LaneHold>,
  now: number,
  on: boolean,
): { lanes: Record<string, string>; holds: Record<string, LaneHold>; wakeAt: number } {
  const lanes: Record<string, string> = Object.create(null);
  const next: Record<string, LaneHold> = Object.create(null);
  let wakeAt = 0;
  for (const key of Object.keys(want)) {
    const to = want[key];
    const from = drawn[key];
    lanes[key] = to;
    if (!on || !from || from === to) continue;
    const h = holds[key];
    const until = h && h.from === from ? h.until : now + BOARD_HOLD_MS;
    if (now >= until) continue;
    lanes[key] = from;
    next[key] = { from, to, until };
    if (!wakeAt || until < wakeAt) wakeAt = until;
  }
  return { lanes, holds: next, wakeAt };
}

/**
 * Put held cards back where they are drawn: each leaves its new column and returns to `lanes[id]` at its place
 * in that column's previous order (`drawnOrder`). Held cards are taken out first and put back in ascending
 * place, so cards leaving one column together keep their order there. A hold whose column is gone is dropped.
 */
export function placeHolds(
  slots: Record<string, string[]>,
  lanes: Record<string, string>,
  drawnOrder: Record<string, string[]>,
): { slots: Record<string, string[]>; dropped: string[] } {
  const out: Record<string, string[]> = Object.create(null);
  for (const k of Object.keys(slots)) out[k] = slots[k].slice();
  const moves: Array<{ id: string; home: string; at: number }> = [];
  const dropped: string[] = [];
  for (const col of Object.keys(out)) {
    const list = out[col];
    for (let i = list.length - 1; i >= 0; i--) {
      const id = list[i];
      const lane = lanes[id];
      if (!lane || lane === col) continue;
      if (!out[lane]) {
        dropped.push(id);
        continue;
      }
      list.splice(i, 1);
      moves.push({ id, home: lane, at: Math.max(0, (drawnOrder[lane] ?? []).indexOf(id)) });
    }
  }
  moves.sort((a, b) => a.at - b.at);
  for (const m of moves) {
    const l = out[m.home];
    l.splice(Math.min(m.at, l.length), 0, m.id);
  }
  return { slots: out, dropped };
}

// ── Markup ─────────────────────────────────────────────────────────────────

function fmtCount(kind: string, v: number): string {
  return kind === 'usd' ? fmtUsd(v) : fmtInt(v);
}

function statusWord(c: InboxCard, t: Strings): string {
  const own = typeof c.statusText === 'string' ? c.statusText.trim() : '';
  return own || t.status[statusOf(c)];
}

/** The status tag's inside: icon · word · clock / age. Clocks and ages are filled by the 1 Hz tick. */
function renderStatus(c: InboxCard, t: Strings): string {
  const s = statusOf(c);
  const word = statusWord(c, t);
  const since = num(c.since);
  const acc = num(c.elapsedMs);
  const ago = since ? `<span class="ib-ago" data-at="${since}"></span>` : '';
  const icon = (inner: string) => `<span class="ib-tag-icon" aria-hidden="true">${inner}</span>`;
  if (s === 'running') {
    const text =
      since || acc
        ? `<span class="ib-pre">${esc(word)} · </span><span class="ib-clock" data-clock data-from="${since}" data-acc="${acc}"></span>`
        : esc(word);
    return `${icon('<span class="ib-spin"></span>')}<span class="ib-tag-text">${text}</span>`;
  }
  if (s === 'waiting') return `${icon(WAIT_SVG)}<span class="ib-tag-text">${esc(word)}${ago}</span>`;
  if (s === 'failed') return `${icon(FAIL_SVG)}<span class="ib-tag-text">${esc(word)}${ago}</span>`;
  if (s === 'done') {
    const pre = c.statusText?.trim() ? `${esc(word)} · ` : esc(t.doneIn);
    const text = acc ? `<span class="ib-pre">${pre}</span>${esc(fmtDuration(acc))}` : esc(word);
    return `${icon('<span class="ib-dot"></span>')}<span class="ib-tag-text">${text}${ago}</span>`;
  }
  return `${icon('<span class="ib-dot is-hollow"></span>')}<span class="ib-tag-text">${esc(word)}${ago}</span>`;
}

function renderTask(c: InboxCard): string {
  const task = c.task;
  if (!task || typeof task.label !== 'string' || !task.label) return '';
  const from = num(task.startedAt);
  const fixed = num(task.elapsedMs);
  const time = from
    ? `<span class="ib-task-time" data-clock data-from="${from}" data-acc="0"></span>`
    : fixed
      ? `<span class="ib-task-time">${esc(fmtDuration(fixed))}</span>`
      : '';
  return `<div class="ib-task" title="${escAttr(task.label)}">${
    task.id ? `<span class="ib-task-id">#${esc(task.id)}</span>` : ''
  }<span class="ib-task-name">${esc(task.label)}</span>${time}</div>`;
}

function renderAgents(c: InboxCard, t: Strings): string {
  const { dots, more } = agentDots(c.agents);
  if (!dots.length) return '';
  const total = Math.floor(num(c.agents?.total));
  const running = Math.min(total, Math.floor(num(c.agents?.running)));
  const failed = Math.floor(num(c.agents?.failed));
  const parts = [`${esc(t.agents)} <b>${total}</b>`];
  if (running) parts.push(esc(t.agentsRunning(running)));
  if (failed) parts.push(`<span class="ib-fail">${esc(t.agentsFailed(failed))}</span>`);
  const words = [`${t.agents} ${total}`, running ? t.agentsRunning(running) : '', failed ? t.agentsFailed(failed) : '']
    .filter(Boolean)
    .join(', ');
  return `<div class="ib-agents" title="${escAttr(words)}">${AGENTS_SVG}<span class="ib-dots" aria-hidden="true">${dots
    .map((d) => `<i class="ib-adot is-${d}"></i>`)
    .join(
      '',
    )}${more ? `<span class="ib-dots-more">+${more}</span>` : ''}</span><span class="ib-agents-text">${parts.join(' · ')}</span></div>`;
}

function renderUsage(c: InboxCard, t: Strings): string {
  const parts: string[] = [];
  if (finite(c.tokens) && c.tokens >= 0)
    parts.push(
      `<span class="ib-use" title="${escAttr(t.tokTitle)}"><span class="ib-cnt" data-cnt="tok" data-to="${c.tokens}">${fmtInt(c.tokens)}</span><span class="ib-unit">${esc(t.tok)}</span></span>`,
    );
  if (finite(c.costUsd) && c.costUsd >= 0)
    parts.push(
      `<span class="ib-use" title="${escAttr(t.costTitle)}"><span class="ib-cnt" data-cnt="usd" data-to="${c.costUsd}">${fmtUsd(c.costUsd)}</span></span>`,
    );
  return parts.length
    ? `<div class="ib-usage">${parts.join('<span class="ib-sep" aria-hidden="true">·</span>')}</div>`
    : '';
}

function renderArtifacts(c: InboxCard, t: Strings): string {
  const names = (Array.isArray(c.artifacts) ? c.artifacts : []).filter((n) => typeof n === 'string' && n);
  if (!names.length) return '';
  const shown = names.slice(0, MAX_CHIPS);
  const more = names.length - shown.length;
  return `<div class="ib-arts"><span class="ib-arts-n" title="${escAttr(t.arts)}">${glyph('file')}${names.length}</span>${shown
    .map((n) => {
      const k = artifactKind(n);
      return `<span class="ib-chip is-${k}" title="${escAttr(n)}">${glyph(k)}<span class="ib-chip-name">${esc(n)}</span></span>`;
    })
    .join('')}${more > 0 ? `<span class="ib-arts-more">+${more}</span>` : ''}</div>`;
}

function renderMetrics(c: InboxCard, t: Strings): string {
  const out: string[] = [];
  const total = Math.floor(num(c.steps?.total));
  if (total) {
    const done = Math.min(total, Math.floor(num(c.steps?.done)));
    out.push(`<span class="ib-metric" title="${escAttr(t.steps)}">${TASKS_SVG}${done}/${total}</span>`);
  }
  const pct = num(c.contextPct);
  if (pct) {
    const p = Math.round(Math.min(pct, 100));
    const lv = pct > 80 ? ' is-danger' : pct > 60 ? ' is-warn' : '';
    out.push(`<span class="ib-metric${lv}" title="${escAttr(t.ctx(p))}">${CTX_SVG}${p}%</span>`);
  }
  return out.length ? `<span class="ib-metrics">${out.join('')}</span>` : '';
}

/** The collapsed face: spark + title / summary / task / sub-agents / tokens · cost / files / status tag · metrics. */
function renderFace(c: InboxCard, t: Strings = STRINGS.en): string {
  return `<div class="ib-head"><span class="ib-spark" aria-hidden="true">${SPARK_SVG}</span><span class="ib-title">${esc(c.title)}</span></div>${
    c.summary ? `<div class="ib-summary">${esc(c.summary)}</div>` : ''
  }${renderTask(c)}${renderAgents(c, t)}${renderUsage(c, t)}${renderArtifacts(c, t)}<div class="ib-foot"><span class="ib-tag" data-tone="${statusTone(
    statusOf(c),
  )}">${renderStatus(c, t)}</span>${renderMetrics(c, t)}</div>`;
}

function renderButton(cardId: string, a: InboxAction, primary: boolean): string {
  const why = typeof a.disabled === 'string' ? a.disabled : '';
  const off = !!a.disabled;
  return `<button type="button" class="ib-btn${primary ? ' is-primary' : ''}" data-act="${escAttr(a.id)}" data-key="${escAttr(
    `a:${cardId}:${a.id}`,
  )}"${off ? ' aria-disabled="true"' : ''}${why ? ` title="${escAttr(why)}"` : ''}>${esc(a.label)}${
    why ? `<span class="sr-only"> — ${esc(why)}</span>` : ''
  }</button>`;
}

/** The open card: step list (oldest first, the earliest folded past five) and the button row with one ink button. */
function renderBody(c: InboxCard, t: Strings = STRINGS.en, openLabel: string | false = t.open): string {
  const id = String(c.id);
  const raw = (Array.isArray(c.details) ? c.details : [])
    .map((d) => (typeof d === 'string' ? { label: d } : d))
    .filter((d): d is InboxDetail => !!d && typeof d.label === 'string' && d.label !== '');
  let steps = '';
  if (raw.length) {
    const folded = Math.max(0, raw.length - MAX_DETAILS);
    const shown = raw.slice(folded);
    steps = `<div class="ib-steps-wrap">${folded ? `<div class="ib-more">${esc(t.earlier(folded))}</div>` : ''}<ol class="ib-steps">${shown
      .map((d, i) => {
        const state = d.state ?? (i === shown.length - 1 ? 'current' : 'done');
        return `<li class="ib-step is-${state === 'current' || state === 'pending' ? state : 'done'}"><span class="ib-step-text">${esc(
          d.label,
        )}</span>${d.meta ? `<span class="ib-step-meta">${esc(d.meta)}</span>` : ''}</li>`;
      })
      .join('')}</ol></div>`;
  }
  const primary = c.primary && c.primary.id != null && c.primary.label ? c.primary : null;
  const decides = !!primary && !primary.disabled;
  const btns: string[] = [];
  for (const a of Array.isArray(c.actions) ? c.actions : [])
    if (a && a.id != null && a.label) btns.push(renderButton(id, a, false));
  if (openLabel)
    btns.push(
      `<button type="button" class="ib-btn${decides ? '' : ' is-primary'}" data-open data-key="${escAttr(`o:${id}`)}">${esc(openLabel)}</button>`,
    );
  if (primary) btns.push(renderButton(id, primary, decides));
  const model = c.model ? `<span class="ib-model">${esc(c.model)}</span>` : '';
  const bar =
    btns.length || model ? `<div class="ib-bar">${model}<span class="ib-actions">${btns.join('')}</span></div>` : '';
  return steps || bar ? `<div class="ib-body">${steps}${bar}</div>` : '';
}

// ── Element ────────────────────────────────────────────────────────────────

interface Shell {
  el: HTMLLIElement;
  face: HTMLElement;
  expand: HTMLElement;
  body: HTMLElement;
  faceHtml: string | null;
  bodyHtml: string | null;
  col: string;
  status: InboxStatus | '';
  flip: Animation | null;
}
interface ColShell {
  el: HTMLElement;
  name: HTMLElement;
  count: HTMLElement;
  list: HTMLElement;
  empty: HTMLElement;
}
type Timer = ReturnType<typeof setTimeout>;
interface Motion {
  move: number;
  fade: number;
  easeOut: string;
  easeInOut: string;
}

/**
 * `<ui-agent-inbox>` — a calm kanban of agent runs: labelled columns with counts, cards with a tinted status tag
 * (Waiting for you · Running · Done · Failed), the task in progress, sub-agents, tokens · cost, files, and a card
 * that opens in place to its steps and one ink decision. A card whose column changes shows its new status where it
 * is for 900 ms, then glides over (FLIP). Cards keep their DOM node for their whole life.
 */
export class UiAgentInbox extends UiElement<AgentInboxData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  #wrap: HTMLElement | null = null;
  #board: HTMLElement | null = null;
  #live: HTMLElement | null = null;
  #cards = new Map<string, Shell>();
  #cols = new Map<string, ColShell>();
  #order: Record<string, string[]> = Object.create(null);
  #open = new Set<string>();
  #holds: Record<string, LaneHold> = Object.create(null);
  #lastStatus = new Map<string, InboxStatus>();
  #seq = 0;
  #painted = false;
  #holdTimer: Timer | undefined;
  #tickTimer: ReturnType<typeof setInterval> | undefined;
  #announceTimer: Timer | undefined;
  #announcePending = '';
  #lastCounts = '';
  #shown = new Map<string, number>();
  #counting = new Map<string, { el: HTMLElement; kind: string; from: number; to: number; t0: number }>();
  #raf = 0;

  attributeChangedCallback(): void {
    this.requestRender();
  }

  get #lang(): 'en' | 'ko' {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #t(): Strings {
    return STRINGS[this.#lang];
  }

  constructor() {
    super();
    this.root.addEventListener('click', (e) => this.#onClick(e as MouseEvent));
    this.root.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
  }

  override disconnectedCallback(): void {
    clearTimeout(this.#holdTimer);
    clearTimeout(this.#announceTimer);
    clearInterval(this.#tickTimer);
    if (this.#raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.#raf);
    this.#holdTimer = this.#announceTimer = this.#tickTimer = undefined;
    this.#raf = 0;
    for (const [key, c] of this.#counting) {
      c.el.textContent = fmtCount(c.kind, c.to);
      this.#shown.set(key, c.to);
    }
    this.#counting.clear();
    // A hold cannot outlive the element: on reconnect every card is drawn where its data puts it.
    this.#holds = Object.create(null);
  }

  /** The board is reconciled by `update()` (keyed, persistent nodes); there is no single markup string. */
  protected render(): string {
    return '';
  }

  // ── Events ──

  #cardOf(el: Element | null): string | null {
    const li = el?.closest?.('li.ib-card[data-card]');
    return li ? (li.getAttribute('data-card') ?? null) : null;
  }

  #onClick(e: MouseEvent): void {
    const target = e.target as Element | null;
    const act = target?.closest?.('[data-act]');
    if (act) {
      const id = this.#cardOf(act);
      if (id === null || act.getAttribute('aria-disabled') === 'true') return;
      this.emit('ui-action', { cardId: id, actionId: act.getAttribute('data-act') ?? '' });
      return;
    }
    const open = target?.closest?.('[data-open]');
    if (open) {
      const id = this.#cardOf(open);
      if (id !== null) this.emit('ui-open', { cardId: id });
      return;
    }
    const face = target?.closest?.('.ib-face[role="button"]');
    if (face) {
      const id = this.#cardOf(face);
      if (id !== null) this.#toggle(id, false);
    }
  }

  #onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if ((e.key === 'Enter' || e.key === ' ') && target.matches?.('.ib-face[role="button"]')) {
      e.preventDefault();
      if (e.repeat) return;
      const id = this.#cardOf(target);
      if (id !== null) this.#toggle(id, true);
      return;
    }
    if (e.key !== 'Escape') return;
    // A text field, a select or an editable region keeps its own Escape (clear, cancel, IME).
    const tag = String(target.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
    const li = target.closest?.('li.ib-card.is-open');
    const id = li ? li.getAttribute('data-card') : null;
    if (id === null || !this.#open.has(id)) return;
    e.stopPropagation();
    if (this.#toggle(id, true)) this.#cards.get(id)?.face.focus({ preventScroll: true });
  }

  /** Open / close one card in place. Keyboard toggles skip the transition. Returns false when the host prevented it. */
  #toggle(id: string, instant: boolean): boolean {
    const sh = this.#cards.get(id);
    if (!sh || !sh.face.hasAttribute('aria-controls')) return false;
    const open = !this.#open.has(id);
    if (!this.emit('ui-toggle', { cardId: id, expanded: open })) return false;
    if (open) this.#open.add(id);
    else this.#open.delete(id);
    if (instant) sh.el.classList.add('no-motion');
    this.#applyOpen(sh, open);
    if (instant) {
      void sh.el.offsetHeight;
      sh.el.classList.remove('no-motion');
    }
    return true;
  }

  #applyOpen(sh: Shell, open: boolean): void {
    if (sh.el.classList.contains('is-open') !== open) sh.el.classList.toggle('is-open', open);
    if (sh.face.hasAttribute('aria-controls')) sh.face.setAttribute('aria-expanded', String(open));
    sh.expand.toggleAttribute('inert', !open);
  }

  // ── Reconciler ──

  #skeleton(): void {
    if (this.#wrap) return;
    const wrap = document.createElement('div');
    wrap.className = 'ib';
    const live = document.createElement('p');
    live.className = 'sr-only';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    const board = document.createElement('div');
    board.className = 'ib-board';
    wrap.append(live, board);
    this.content.append(wrap);
    this.#wrap = wrap;
    this.#live = live;
    this.#board = board;
  }

  #colShell(id: string): ColShell {
    const n = ++this.#seq;
    const el = document.createElement('section');
    el.className = 'ib-col';
    el.setAttribute('data-col', id);
    const head = document.createElement('div');
    head.className = 'ib-col-head';
    head.innerHTML = `<span class="ib-col-spark" aria-hidden="true">${SPARK_SVG}</span>`;
    const name = document.createElement('h3');
    name.className = 'ib-col-name';
    name.id = `ib-c${n}-name`;
    const count = document.createElement('span');
    count.className = 'ib-count';
    count.id = `ib-c${n}-count`;
    head.append(name, count);
    const list = document.createElement('ul');
    list.className = 'ib-cards';
    list.setAttribute('role', 'list');
    const empty = document.createElement('p');
    empty.className = 'ib-empty';
    el.setAttribute('aria-labelledby', `${name.id} ${count.id}`);
    el.append(head, list, empty);
    return { el, name, count, list, empty };
  }

  #shell(id: string): Shell {
    const el = document.createElement('li');
    el.className = 'ib-card';
    el.setAttribute('data-card', id);
    const face = document.createElement('div');
    face.className = 'ib-face';
    face.setAttribute('data-key', `f:${id}`);
    const expand = document.createElement('div');
    expand.className = 'ib-expand';
    expand.id = `ib-x${++this.#seq}`;
    expand.setAttribute('inert', '');
    const body = document.createElement('div');
    body.className = 'ib-expand-inner';
    expand.append(body);
    el.append(face, expand);
    return { el, face, expand, body, faceHtml: null, bodyHtml: null, col: '', status: '', flip: null };
  }

  #motion(): Motion {
    const cs = typeof getComputedStyle === 'function' ? getComputedStyle(this) : null;
    const ms = (name: string, fallback: number) => {
      const raw = cs?.getPropertyValue(name).trim() ?? '';
      const v = Number.parseFloat(raw);
      if (!Number.isFinite(v)) return fallback;
      return /[^m]s$/.test(raw) ? v * 1000 : v;
    };
    const str = (name: string, fallback: string) => cs?.getPropertyValue(name).trim() || fallback;
    return {
      move: ms('--dur-move', 320),
      fade: ms('--dur-fade', 180),
      easeOut: str('--ease-out', 'cubic-bezier(0.23, 1, 0.32, 1)'),
      easeInOut: str('--ease-in-out', 'cubic-bezier(0.77, 0, 0.175, 1)'),
    };
  }

  /** Top-left of the card's full-size box as drawn (a move in flight included, an entrance scale not). */
  #boxOf(el: HTMLElement): { x: number; y: number } {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - el.offsetWidth / 2, y: r.top + r.height / 2 - el.offsetHeight / 2 };
  }

  protected override update(): void {
    this.#skeleton();
    const board = this.#board!;
    const t = this.#t;
    const d = this.data;
    const now = Date.now();
    const activeKey = (this.root.activeElement as HTMLElement | null)?.dataset?.key;
    const hidden = typeof document !== 'undefined' && document.hidden;
    const reduced = prefersReducedMotion();
    const live = this.#painted && !hidden;
    const canAnimate = live && typeof HTMLElement.prototype.animate === 'function';
    const openLabel = d?.openLabel === false ? false : typeof d?.openLabel === 'string' ? d.openLabel : t.open;
    const startOpen = new Set((Array.isArray(d?.expanded) ? d.expanded : []).map(String));

    // 1. Columns and cards as the data puts them (first column id / card id wins).
    const cols: Array<{ id: string; col: InboxColumn }> = [];
    const cardById = new Map<string, InboxCard>();
    const slots: Record<string, string[]> = Object.create(null);
    const want: Record<string, string> = Object.create(null);
    for (const col of Array.isArray(d?.columns) ? d.columns : []) {
      if (!col || col.id == null) continue;
      const cid = String(col.id);
      if (slots[cid]) continue;
      slots[cid] = [];
      cols.push({ id: cid, col });
      for (const card of Array.isArray(col.cards) ? col.cards : []) {
        if (!card || card.id == null) continue;
        const id = String(card.id);
        if (cardById.has(id)) continue;
        cardById.set(id, card);
        slots[cid].push(id);
        want[id] = cid;
      }
    }

    // 2. Status changes since the last data — said once, before any hold.
    const changes: InboxCard[] = [];
    const nextStatus = new Map<string, InboxStatus>();
    for (const [id, card] of cardById) {
      const s = statusOf(card);
      const prev = this.#lastStatus.get(id);
      if (prev && prev !== s) changes.push(card);
      nextStatus.set(id, s);
    }
    this.#lastStatus = nextStatus;

    // 3. Status first, move later: a card whose column changed stays where it is drawn for BOARD_HOLD_MS.
    const drawn: Record<string, string> = Object.create(null);
    for (const [id, sh] of this.#cards) if (want[id] && slots[sh.col]) drawn[id] = sh.col;
    const held = holdLanes(want, drawn, this.#holds, now, live && !reduced);
    const placed = placeHolds(slots, held.lanes, this.#order);
    for (const id of placed.dropped) delete held.holds[id];
    this.#holds = held.holds;
    clearTimeout(this.#holdTimer);
    this.#holdTimer = undefined;
    if (held.wakeAt)
      this.#holdTimer = setTimeout(
        () => {
          this.#holdTimer = undefined;
          this.requestRender();
        },
        Math.max(0, held.wakeAt - now) + 20,
      );

    // 4. FLIP — first boxes.
    const first = new Map<string, { x: number; y: number }>();
    const firstCol = new Map<string, string>();
    const firstStatus = new Map<string, string>();
    for (const [id, sh] of this.#cards) {
      firstCol.set(id, sh.col);
      firstStatus.set(id, sh.status);
      if (canAnimate) first.set(id, this.#boxOf(sh.el));
    }

    // 5. Columns, in order.
    board.style.setProperty('--ib-cols', String(Math.max(1, cols.length)));
    cols.forEach(({ id }, i) => {
      let c = this.#cols.get(id);
      if (!c) {
        c = this.#colShell(id);
        this.#cols.set(id, c);
      }
      if (board.children[i] !== c.el) board.insertBefore(c.el, board.children[i] ?? null);
    });

    // 6. Cards, in order, each patched only where its markup changed.
    const fresh = new Set<string>();
    const order: Record<string, string[]> = Object.create(null);
    for (const { id: colId, col } of cols) {
      const c = this.#cols.get(colId)!;
      const ids = placed.slots[colId];
      order[colId] = ids;
      ids.forEach((id, i) => {
        let sh = this.#cards.get(id);
        if (!sh) {
          sh = this.#shell(id);
          this.#cards.set(id, sh);
          fresh.add(id);
          if (startOpen.has(id)) this.#open.add(id);
        }
        this.#patch(sh, id, cardById.get(id)!, t, openLabel, live && !reduced);
        sh.col = colId;
        if (c.list.children[i] !== sh.el) c.list.insertBefore(sh.el, c.list.children[i] ?? null);
      });
      const name = String(col.label ?? '');
      if (c.name.textContent !== name) c.name.textContent = name;
      const count = String(ids.length);
      if (c.count.textContent !== count) c.count.textContent = count;
      const empty = typeof col.emptyText === 'string' && col.emptyText ? col.emptyText : t.empty;
      if (c.empty.textContent !== empty) c.empty.textContent = empty;
      if (c.empty.hidden !== ids.length > 0) c.empty.hidden = ids.length > 0;
    }
    this.#order = order;

    // 7. Cards that left fade out where they were; then columns that left go.
    const motion = canAnimate ? this.#motion() : null;
    for (const [id, sh] of this.#cards) {
      if (cardById.has(id)) continue;
      this.#cards.delete(id);
      this.#open.delete(id);
      this.#shown.delete(`${id}\u0000tok`);
      this.#shown.delete(`${id}\u0000usd`);
      this.#exit(sh, first.get(id), slots[firstCol.get(id) ?? ''] ? motion : null);
    }
    for (const [id, c] of this.#cols) {
      if (slots[id]) continue;
      c.el.remove();
      this.#cols.delete(id);
    }

    // 8. Enter, move (FLIP), and the status icon's pop where the status changed on screen.
    if (motion) {
      for (const [id, sh] of this.#cards) {
        if (fresh.has(id)) {
          sh.el.animate(
            reduced
              ? [{ opacity: 0 }, { opacity: 1 }]
              : [
                  { opacity: 0, transform: 'scale(0.97)' },
                  { opacity: 1, transform: 'scale(1)' },
                ],
            { duration: motion.fade, easing: motion.easeOut },
          );
          continue;
        }
        const prev = firstStatus.get(id);
        if (!reduced && prev && prev !== sh.status)
          sh.face.querySelector('.ib-tag-icon')?.animate(
            [
              { opacity: 0, transform: 'scale(0.6)' },
              { opacity: 1, transform: 'scale(1)' },
            ],
            { duration: motion.move, easing: motion.easeOut },
          );
        const a = first.get(id);
        if (!a) continue;
        const wasFlying = sh.el.classList.contains('is-flying');
        if (sh.flip) {
          sh.flip.cancel();
          sh.flip = null;
        }
        if (wasFlying) sh.el.classList.remove('is-flying');
        const b = this.#boxOf(sh.el);
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
        this.#flip(sh, dx, dy, wasFlying || firstCol.get(id) !== sh.col, motion, reduced);
      }
    }

    // 9. Announce (once there is data), keep focus, start the clocks.
    if (d)
      this.#announce(
        cols.map((c) => c.col),
        changes,
        t,
      );
    if (activeKey && (this.root.activeElement as HTMLElement | null)?.dataset?.key !== activeKey) {
      const next = this.$$<HTMLElement>('[data-key]').find((el) => el.dataset.key === activeKey);
      next?.focus({ preventScroll: true });
    }
    this.#tickIn(this.content);
    this.#syncTick();
    // The first paint with data never animates (a render before any data does not count).
    if (d) this.#painted = true;
  }

  #patch(sh: Shell, id: string, card: InboxCard, t: Strings, openLabel: string | false, countUp: boolean): void {
    const status = statusOf(card);
    if (sh.status !== status) {
      sh.status = status;
      sh.el.setAttribute('data-status', status);
    }
    const face = renderFace(card, t);
    if (sh.faceHtml !== face) {
      sh.face.innerHTML = face;
      sh.faceHtml = face;
      // Spinners share one phase, so a rewritten face never makes its ring jump.
      const phase = `-${Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) % 900)}ms`;
      for (const s of Array.from(sh.face.querySelectorAll<HTMLElement>('.ib-spin'))) s.style.animationDelay = phase;
      this.#countUp(id, sh.face, countUp);
    }
    const body = renderBody(card, t, openLabel);
    if (sh.bodyHtml !== body) {
      sh.body.innerHTML = body;
      sh.bodyHtml = body;
    }
    if (body) {
      if (sh.face.getAttribute('role') !== 'button') {
        sh.face.setAttribute('role', 'button');
        sh.face.setAttribute('tabindex', '0');
        sh.face.setAttribute('aria-controls', sh.expand.id);
      }
    } else if (sh.face.hasAttribute('role')) {
      for (const a of ['role', 'tabindex', 'aria-controls', 'aria-expanded']) sh.face.removeAttribute(a);
      this.#open.delete(id);
    }
    this.#applyOpen(sh, this.#open.has(id));
  }

  /** Move = translate only, raised while it changes column. Reduced motion: no travel, a fade where it landed. */
  #flip(sh: Shell, dx: number, dy: number, raise: boolean, m: Motion, reduced: boolean): void {
    if (reduced) {
      if (raise) sh.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: m.fade, easing: 'linear' });
      return;
    }
    if (raise) sh.el.classList.add('is-flying');
    const anim = sh.el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
      duration: m.move,
      easing: m.easeInOut,
      composite: 'add',
    });
    sh.flip = anim;
    anim.onfinish = () => {
      if (sh.flip !== anim) return;
      sh.flip = null;
      sh.el.classList.remove('is-flying');
    };
  }

  /** Exit = opacity only, absolutely placed in its column where it was drawn, so the rest FLIP into the gap. */
  #exit(sh: Shell, box: { x: number; y: number } | undefined, m: Motion | null): void {
    if (sh.flip) {
      sh.flip.cancel();
      sh.flip = null;
    }
    const section = sh.el.closest<HTMLElement>('.ib-col');
    if (!box || !section || !m) {
      sh.el.remove();
      return;
    }
    const hr = section.getBoundingClientRect();
    const width = sh.el.offsetWidth;
    sh.el.removeAttribute('data-card');
    sh.el.setAttribute('aria-hidden', 'true');
    sh.el.setAttribute('inert', '');
    sh.el.classList.add('is-exiting');
    sh.el.style.left = `${box.x - hr.left}px`;
    sh.el.style.top = `${box.y - hr.top}px`;
    sh.el.style.width = `${width}px`;
    section.append(sh.el);
    const anim = sh.el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: m.fade,
      easing: m.easeOut,
      fill: 'forwards',
    });
    anim.onfinish = anim.oncancel = () => sh.el.remove();
  }

  /**
   * The polite region says "N need you, M running" — the first sentence at once, then only real changes; a burst
   * within ANNOUNCE_MS is said once (the last text). One card changing status is named first.
   */
  #announce(columns: InboxColumn[], changes: InboxCard[], t: Strings): void {
    const live = this.#live;
    if (!live) return;
    const c = boardCounts(columns);
    const counts = t.announce(c.needs, c.running);
    if (!changes.length && counts === this.#lastCounts) return;
    this.#lastCounts = counts;
    const text =
      changes.length === 1
        ? `${t.changed(String(changes[0].title ?? ''), statusWord(changes[0], t))} ${counts}`
        : counts;
    this.#announcePending = text;
    if (!live.textContent && !this.#announceTimer) {
      live.textContent = text;
      return;
    }
    if (this.#announceTimer || live.textContent === text) return;
    this.#announceTimer = setTimeout(() => {
      this.#announceTimer = undefined;
      if (live.textContent !== this.#announcePending) live.textContent = this.#announcePending;
    }, ANNOUNCE_MS);
  }

  /** Clocks and ages are written in place (never by a re-render), once a second while any is on the board. */
  #tickIn(root: ParentNode): void {
    const now = Date.now();
    const t = this.#t;
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-clock]'))) {
      const from = Number(el.dataset.from) || 0;
      const acc = Number(el.dataset.acc) || 0;
      const text = fmtDuration(acc + (from ? Math.max(0, now - from) : 0));
      if (el.textContent !== text) el.textContent = text;
    }
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-at]'))) {
      const text = t.ago(Number(el.dataset.at) || 0, now);
      if (el.textContent !== text) el.textContent = text;
    }
  }

  #syncTick(): void {
    const need = !!this.content.querySelector('[data-clock], [data-at]');
    if (need && !this.#tickTimer) this.#tickTimer = setInterval(() => this.#tickIn(this.content), 1000);
    else if (!need && this.#tickTimer) {
      clearInterval(this.#tickTimer);
      this.#tickTimer = undefined;
    }
  }

  /** Tokens and cost count up (900 ms, ease-out cubic) when they grow on a card on screen; else they are set. */
  #countUp(id: string, root: HTMLElement, animate: boolean): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-cnt]'))) {
      const kind = el.dataset.cnt ?? 'tok';
      const key = `${id}\u0000${kind}`;
      const to = Number(el.dataset.to) || 0;
      const shown = this.#shown.get(key);
      if (shown === undefined || !(to > shown) || !animate || typeof requestAnimationFrame !== 'function') {
        this.#shown.set(key, to);
        this.#counting.delete(key);
        continue;
      }
      el.textContent = fmtCount(kind, shown);
      this.#counting.set(key, { el, kind, from: shown, to, t0: now });
    }
    if (this.#counting.size && !this.#raf && typeof requestAnimationFrame === 'function')
      this.#raf = requestAnimationFrame(this.#step);
  }

  #step = (now: number): void => {
    for (const [key, c] of this.#counting) {
      const p = Math.min(1, Math.max(0, (now - c.t0) / COUNT_MS));
      const v = p >= 1 ? c.to : c.from + (c.to - c.from) * (1 - (1 - p) ** 3);
      const text = fmtCount(c.kind, v);
      if (c.el.textContent !== text) c.el.textContent = text;
      this.#shown.set(key, v);
      if (p >= 1) this.#counting.delete(key);
    }
    this.#raf = this.#counting.size ? requestAnimationFrame(this.#step) : 0;
  };
}

define('ui-agent-inbox', UiAgentInbox);

declare global {
  interface HTMLElementTagNameMap {
    'ui-agent-inbox': UiAgentInbox;
  }
}
