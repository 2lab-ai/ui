import { define, UiElement } from '../../core/element';
import { fmtDuration, fmtTokens, fmtUsd } from '../../core/format';
import { esc, escAttr, safeHref } from '../../core/html';
import { morphInto } from '../../core/morph';
import { type PlanLang, planStateHtml, planTimeOfDay } from '../../core/plan';
import { lastEnabled, rovingIndex } from '../../core/roving';
import { icon } from '../../icons/icons';
import { styles } from './styles';

/** What became of a run: still running, paused (the session stopped), done, failed, or dropped by a newer plan. */
export type TaskRunStatus = 'running' | 'paused' | 'done' | 'failed' | 'dropped';

export interface TaskRunTokens {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

export interface TaskRunTool {
  name: string;
  count: number;
}

/** A change to the task while it ran (its wording, its scope): when, and what. */
export interface TaskRunRevision {
  at?: number;
  note: string;
}

export interface TaskRun {
  id: string;
  title: string;
  status: TaskRunStatus;
  /** Short reference before the title, e.g. `#T3`. */
  ref?: string;
  /** Epoch ms. A running run ticks from here; a finished one shows endedAt − startedAt. */
  startedAt?: number;
  endedAt?: number;
  /** Run time when the host measures it itself (e.g. active time only); wins over endedAt − startedAt. */
  durationMs?: number;
  tokens?: TaskRunTokens;
  /** Tools used, with how often. */
  tools?: TaskRunTool[];
  /** Tool calls in all; default the sum of `tools`. */
  toolCalls?: number;
  /** API-equivalent cost in US dollars. */
  costUsd?: number;
  revisions?: TaskRunRevision[];
  /** Where the run opens (a cancelable `ui-open` first). */
  href?: string;
  /** An Open button without a link: the host handles `ui-open`. */
  canOpen?: boolean;
}

export interface TaskRunsData {
  /** Heading. Default `Task runs` / `실행된 태스크`; an empty string draws none. */
  title?: string;
  /** The runs in the order to show them (the host sorts; oldest first reads like a log). */
  runs: TaskRun[];
  /** The totals row under the runs. Default true. */
  totals?: boolean;
  /** The host's clock (epoch ms) when it built this data: running clocks correct for this device's clock skew. */
  now?: number;
}

/** `ui-toggle` detail: a run's detail was opened or closed. */
export interface TaskRunToggle {
  id: string;
  open: boolean;
}

/** `ui-open` detail: open this run. */
export interface TaskRunOpen {
  id: string;
}

export interface TaskRunTotals {
  runs: number;
  /** All tokens (input + output + cache read + cache write) of the runs that carry them. */
  tokens: number;
  hasTokens: boolean;
  tools: number;
  /** Run time summed (running runs count up to `now`). */
  ms: number;
  costUsd: number;
  hasCost: boolean;
  /** Some run is still running with a start time: the total time keeps growing. */
  live: boolean;
}

const STRINGS = {
  en: {
    title: 'Task runs',
    list: 'Task runs',
    empty: 'No runs yet',
    emptyHint: 'Each task the agent works on shows up here with its time, tokens and tools.',
    tokens: (s: string) => `${s} tokens`,
    calls: (n: number) => (n === 1 ? '1 tool call' : `${n} tool calls`),
    started: 'Started',
    ended: 'Ended',
    took: 'Took',
    tokensK: 'Tokens',
    toolsK: 'Tools',
    cost: 'Cost',
    revisions: 'Revisions',
    stillRunning: 'Still running',
    pausedEnd: 'Paused',
    leftPlan: (t: string) => `${t} · left the plan`,
    part: { input: 'in', output: 'out', cacheRead: 'cache read', cacheWrite: 'cache write' } as Record<
      keyof TaskRunTokens,
      string
    >,
    open: 'Open',
    openLabel: (title: string) => `Open ${title}`,
    total: 'Total',
    runs: (n: number) => (n === 1 ? '1 run' : `${n} runs`),
  },
  ko: {
    title: '실행된 태스크',
    list: '실행된 태스크',
    empty: '아직 실행된 태스크가 없습니다',
    emptyHint: '에이전트가 맡은 태스크가 시간, 토큰, 도구와 함께 여기에 표시됩니다.',
    tokens: (s: string) => `토큰 ${s}`,
    calls: (n: number) => `툴 ${n}회`,
    started: '시작',
    ended: '종료',
    took: '소요',
    tokensK: '토큰',
    toolsK: '도구',
    cost: '비용',
    revisions: '변경 기록',
    stillRunning: '진행 중',
    pausedEnd: '멈춤',
    leftPlan: (t: string) => `${t} · 계획에서 빠짐`,
    part: { input: '입력', output: '출력', cacheRead: '캐시 읽기', cacheWrite: '캐시 쓰기' } as Record<
      keyof TaskRunTokens,
      string
    >,
    open: '열기',
    openLabel: (title: string) => `${title} 열기`,
    total: '합계',
    runs: (n: number) => `실행 ${n}`,
  },
};
type Strings = (typeof STRINGS)['en'];

const STATUSES: ReadonlySet<string> = new Set<TaskRunStatus>(['running', 'paused', 'done', 'failed', 'dropped']);
const PARTS = ['input', 'output', 'cacheRead', 'cacheWrite'] as const;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const runsOf = (v: unknown): TaskRun[] =>
  Array.isArray(v) ? v.filter((r): r is TaskRun => !!r && typeof r === 'object') : [];
const statusOf = (r: TaskRun): TaskRunStatus => (STATUSES.has(r.status) ? r.status : 'done');

// ── Pure helpers ────────────────────────────────────────────────────────────

/**
 * A run's time: up to `now` while it runs (from startedAt); else the host's `durationMs`; else endedAt − startedAt;
 * else 0.
 */
export function taskRunMs(
  run: Pick<TaskRun, 'status' | 'startedAt' | 'endedAt' | 'durationMs'>,
  now: number = Date.now(),
): number {
  const start = num(run.startedAt);
  if (run.status === 'running' && start) return Math.max(0, now - start);
  if (run.durationMs !== undefined) return num(run.durationMs);
  const end = num(run.endedAt);
  return start && end > start ? end - start : 0;
}

/** Every token of a run: input + output + cache read + cache write. */
export function taskRunTokenTotal(tokens: TaskRunTokens | undefined): number {
  if (!tokens) return 0;
  return PARTS.reduce((sum, k) => sum + num(tokens[k]), 0);
}

/** A run's tool calls: `toolCalls` when given, else the sum of its tools' counts. */
export function taskRunToolCount(run: Pick<TaskRun, 'toolCalls' | 'tools'>): number {
  if (run.toolCalls !== undefined) return Math.round(num(run.toolCalls));
  return Math.round((run.tools ?? []).reduce((sum, t) => sum + num(t?.count), 0));
}

/** The totals row: how many runs, their tokens, tool calls, time and cost. */
export function taskRunTotals(runs: readonly TaskRun[], now: number = Date.now()): TaskRunTotals {
  const out: TaskRunTotals = {
    runs: 0,
    tokens: 0,
    hasTokens: false,
    tools: 0,
    ms: 0,
    costUsd: 0,
    hasCost: false,
    live: false,
  };
  for (const r of runsOf(runs)) {
    out.runs++;
    if (r.tokens) {
      out.hasTokens = true;
      out.tokens += taskRunTokenTotal(r.tokens);
    }
    out.tools += taskRunToolCount(r);
    out.ms += taskRunMs(r, now);
    if (typeof r.costUsd === 'number' && Number.isFinite(r.costUsd)) {
      out.hasCost = true;
      out.costUsd += Math.max(0, r.costUsd);
    }
    if (r.status === 'running' && num(r.startedAt)) out.live = true;
  }
  return out;
}

/** Date and time of a run's start or end: `Oct 27, 6:56 PM` / `10월 27일 오후 06:56`. */
export function taskRunStamp(ts: number, lang: PlanLang = 'en'): string {
  if (!num(ts)) return '';
  return lang === 'ko'
    ? new Date(ts).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * `<ui-task-runs>` — the tasks the agent actually ran: one row per run (title, status icon + word, start and run
 * time, tokens, tool calls) that opens its detail in place (start/end, run time, tokens in/out/cache, tools with
 * counts, cost, revisions, an Open action), and a totals row. Several runs can be open at once — the detail is
 * for comparing runs, and a row never closes another one under the person's eyes. Up/Down/Home/End move between
 * rows (one tab stop).
 */
export class UiTaskRuns extends UiElement<TaskRunsData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  #timer: ReturnType<typeof setInterval> | 0 = 0;
  #open = new Set<string>();
  /** The row that holds the list's one tab stop. */
  #current: string | null = null;
  #skew = 0;
  #seen: TaskRunsData | undefined;

  constructor() {
    super();
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('keydown', (e) => this.#onKeydown(e as KeyboardEvent));
    this.root.addEventListener('focusin', (e) => {
      const row = (e.target as Element | null)?.closest?.('.tr-row') as HTMLElement | null;
      if (row?.dataset.id !== undefined) this.#rove(row.dataset.id);
    });
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override disconnectedCallback(): void {
    this.#stopTimer();
  }

  get #lang(): PlanLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #t(): Strings {
    return STRINGS[this.#lang];
  }

  /** Whether a run's detail is open. */
  isOpen(id: string): boolean {
    return this.#open.has(id);
  }

  /** Open or close a run's detail (no event — the host's own choice). */
  setOpen(id: string, open: boolean): void {
    if (open === this.#open.has(id)) return;
    if (open) this.#open.add(id);
    else this.#open.delete(id);
    this.requestRender();
  }

  // ── Intent ────────────────────────────────────────────────────────────────

  #onClick(e: Event): void {
    const target = e.target as Element | null;
    const opener = target?.closest?.('.tr-open') as HTMLElement | null;
    if (opener) {
      const id = opener.closest<HTMLElement>('.tr-run')?.dataset.id;
      if (id === undefined) return;
      if (!this.emit<TaskRunOpen>('ui-open', { id })) e.preventDefault();
      return;
    }
    const row = target?.closest?.('.tr-row') as HTMLElement | null;
    const id = row?.dataset.id;
    if (id === undefined) return;
    const open = !this.#open.has(id);
    if (open) this.#open.add(id);
    else this.#open.delete(id);
    this.#current = id;
    this.renderNow();
    this.notify<TaskRunToggle>('ui-toggle', { id, open });
  }

  /** Up/Down move between rows (wrapping), Home/End to the first / last; Enter and Space are the button's own. */
  #onKeydown(e: KeyboardEvent): void {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const row = (e.target as Element | null)?.closest?.('.tr-row') as HTMLElement | null;
    if (!row) return;
    const rows = this.$$('.tr-row');
    const at = rows.indexOf(row);
    const off = rows.map(() => false);
    let next = -1;
    if (e.key === 'ArrowDown') next = rovingIndex(off, at, 1);
    else if (e.key === 'ArrowUp') next = rovingIndex(off, at, -1);
    else if (e.key === 'Home') next = rovingIndex(off, 0, 0);
    else if (e.key === 'End') next = lastEnabled(off);
    else return;
    e.preventDefault();
    const to = rows[next];
    if (!to) return;
    this.#rove(to.dataset.id ?? null);
    to.focus();
  }

  /** Move the tab stop to a row without re-rendering. */
  #rove(id: string | null): void {
    this.#current = id;
    for (const r of this.$$('.tr-row')) r.tabIndex = r.dataset.id === id ? 0 : -1;
  }

  // ── Render cycle ──────────────────────────────────────────────────────────

  /** Morph instead of replacing: the detail's 0fr → 1fr transition runs, focus and the ticking text nodes stay. */
  protected override update(): void {
    const d = this.data;
    if (d !== this.#seen) this.#observe(d);
    const key = (this.root.activeElement as HTMLElement | null)?.dataset?.key;
    morphInto(this.content, this.render());
    this.updated();
    if (key && !this.root.activeElement) {
      this.$$('[data-key]')
        .find((el) => el.dataset.key === key)
        ?.focus({ preventScroll: true });
    }
  }

  /** New data: settle the clock skew; forget open rows and the tab stop of runs that are gone. */
  #observe(d: TaskRunsData | undefined): void {
    this.#seen = d;
    this.#skew = d && num(d.now) ? num(d.now) - Date.now() : 0;
    const ids = new Set(runsOf(d?.runs).map((r) => r.id));
    for (const id of Array.from(this.#open)) if (!ids.has(id)) this.#open.delete(id);
    if (this.#current !== null && !ids.has(this.#current)) this.#current = null;
  }

  protected override updated(): void {
    this.#tick();
    const live = !!this.$('[data-since], [data-total-live]');
    if (live && !this.#timer && this.isConnected) this.#timer = setInterval(() => this.#tick(), 1000);
    else if (!live) this.#stopTimer();
  }

  #stopTimer(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = 0;
  }

  /** 1 Hz: run clocks and the live total are text nodes filled in place — the markup never carries `now`. */
  #tick(): void {
    const now = Date.now() + this.#skew;
    for (const el of this.$$('[data-since]')) {
      const txt = fmtDuration(now - (Number(el.dataset.since) || now));
      if (el.textContent !== txt) el.textContent = txt;
    }
    const total = this.$('[data-total-live]');
    if (total) {
      const txt = fmtDuration(taskRunTotals(runsOf(this.data?.runs), now).ms);
      if (total.textContent !== txt) total.textContent = txt;
    }
  }

  protected render(): string {
    const d = this.data;
    if (!d) return '';
    const t = this.#t;
    const runs = runsOf(d.runs);
    const title = d.title ?? t.title;
    const head = title
      ? `<header class="tr-head"><h3 class="tr-title" id="tr-title">${esc(title)}</h3>${
          runs.length ? `<span class="tr-count">${runs.length}</span>` : ''
        }</header>`
      : '';
    const label = title ? 'aria-labelledby="tr-title"' : `aria-label="${escAttr(t.title)}"`;
    if (!runs.length) {
      return `<section class="tr is-empty" ${label}>${head}<div class="tr-empty">${icon('clock', {
        size: 20,
        class: 'tr-empty-icon',
      })}<strong>${esc(t.empty)}</strong><span>${esc(t.emptyHint)}</span></div></section>`;
    }
    const stop = runs.some((r) => r.id === this.#current) ? this.#current : runs[0].id;
    const rows = runs.map((r, i) => this.#run(r, i, r.id === stop, t)).join('');
    return `<section class="tr" ${label}>${head}<ul class="tr-list" aria-label="${escAttr(t.list)}">${rows}</ul>${
      d.totals === false ? '' : this.#totals(runs, t)
    }</section>`;
  }

  #run(r: TaskRun, i: number, stop: boolean, t: Strings): string {
    const lang = this.#lang;
    const st = statusOf(r);
    const open = this.#open.has(r.id);
    const start = num(r.startedAt);
    const ticking = st === 'running' && !!start;
    const ms = taskRunMs(r, Date.now() + this.#skew);
    const time = ticking ? `<span data-since="${start}"></span>` : ms ? esc(fmtDuration(ms)) : '';
    const tools = taskRunToolCount(r);
    const meta = [
      start ? esc(planTimeOfDay(start, lang)) : '',
      time,
      r.tokens ? esc(t.tokens(fmtTokens(taskRunTokenTotal(r.tokens)))) : '',
      tools || r.tools?.length || r.toolCalls !== undefined ? esc(t.calls(tools)) : '',
    ]
      .filter(Boolean)
      .map((m) => `<span class="tr-m">${m}</span>`)
      .join('<span class="tr-dot" aria-hidden="true">·</span>');
    return `<li class="tr-run" data-mk="${escAttr(r.id)}" data-id="${escAttr(r.id)}" data-status="${st}"${
      open ? ' data-open' : ''
    }><button type="button" class="tr-row" id="tr-b-${i}" data-id="${escAttr(r.id)}" data-key="${escAttr(
      `run|${r.id}`,
    )}" tabindex="${stop ? 0 : -1}" aria-expanded="${open}" aria-controls="tr-r-${i}">${icon('chevron-right', {
      size: 12,
      class: 'tr-chev',
    })}<span class="tr-main"><span class="tr-line">${r.ref ? `<span class="tr-ref">${esc(r.ref)}</span>` : ''}<span class="tr-name">${esc(
      r.title,
    )}</span></span>${meta ? `<span class="tr-meta">${meta}</span>` : ''}</span>${planStateHtml(st, {
      lang,
    })}</button><div class="tr-region" id="tr-r-${i}"${open ? '' : ' inert'}><div class="tr-in">${this.#detail(
      r,
      st,
      t,
    )}</div></div></li>`;
  }

  #detail(r: TaskRun, st: TaskRunStatus, t: Strings): string {
    const lang = this.#lang;
    const start = num(r.startedAt);
    const end = num(r.endedAt);
    const rows: Array<[string, string]> = [];
    if (start) rows.push([t.started, esc(taskRunStamp(start, lang))]);
    if (st === 'running') rows.push([t.ended, esc(t.stillRunning)]);
    else if (st === 'paused') rows.push([t.ended, esc(t.pausedEnd)]);
    else if (end) {
      const stamp = taskRunStamp(end, lang);
      rows.push([t.ended, esc(st === 'dropped' ? t.leftPlan(stamp) : stamp)]);
    }
    const ms = taskRunMs(r, Date.now() + this.#skew);
    if (st === 'running' && start) rows.push([t.took, `<span data-since="${start}"></span>`]);
    else if (ms) rows.push([t.took, esc(fmtDuration(ms))]);
    if (r.tokens) {
      const parts = PARTS.filter((k) => r.tokens?.[k] !== undefined)
        .map((k) => `<span class="tr-part">${esc(t.part[k])} ${esc(fmtTokens(num(r.tokens?.[k])))}</span>`)
        .join('<span class="tr-dot" aria-hidden="true">·</span>');
      rows.push([
        t.tokensK,
        `<span class="tr-tok-total">${esc(fmtTokens(taskRunTokenTotal(r.tokens)))}</span>${
          parts ? `<span class="tr-parts">${parts}</span>` : ''
        }`,
      ]);
    }
    const tools = (r.tools ?? []).filter((x) => x && x.name);
    if (tools.length) {
      rows.push([
        t.toolsK,
        `<ul class="tr-tools">${tools
          .map(
            (x) =>
              `<li class="tr-tool"><span class="tr-tool-name">${esc(x.name)}</span> <span class="tr-tool-n">×${Math.round(
                num(x.count),
              )}</span></li>`,
          )
          .join('')}</ul>`,
      ]);
    } else if (r.toolCalls !== undefined) {
      rows.push([t.toolsK, esc(t.calls(taskRunToolCount(r)))]);
    }
    if (typeof r.costUsd === 'number' && Number.isFinite(r.costUsd)) {
      rows.push([t.cost, esc(fmtUsd(Math.max(0, r.costUsd)))]);
    }
    const revs = (r.revisions ?? []).filter((x) => x && x.note !== undefined && x.note !== '');
    if (revs.length) {
      rows.push([
        t.revisions,
        `<ol class="tr-revs">${revs
          .map(
            (x) =>
              `<li>${num(x.at) ? `<span class="tr-rev-at">${esc(planTimeOfDay(num(x.at), lang))}</span>` : ''}<span class="tr-rev-note">${esc(
                x.note,
              )}</span></li>`,
          )
          .join('')}</ol>`,
      ]);
    }
    const dl = rows.length
      ? `<dl class="tr-dl">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`
      : '';
    const openLabel = escAttr(t.openLabel(r.title));
    const action = r.href
      ? `<a class="tr-open" href="${safeHref(r.href)}" data-key="${escAttr(`open|${r.id}`)}" aria-label="${openLabel}">${esc(
          t.open,
        )}${icon('arrow-right', { size: 12 })}</a>`
      : r.canOpen
        ? `<button type="button" class="tr-open" data-key="${escAttr(`open|${r.id}`)}" aria-label="${openLabel}">${esc(
            t.open,
          )}${icon('arrow-right', { size: 12 })}</button>`
        : '';
    return `<div class="tr-detail">${dl}${action ? `<div class="tr-actions">${action}</div>` : ''}</div>`;
  }

  #totals(runs: TaskRun[], t: Strings): string {
    const s = taskRunTotals(runs, Date.now() + this.#skew);
    const bits = [esc(t.runs(s.runs))];
    if (s.hasTokens) bits.push(esc(t.tokens(fmtTokens(s.tokens))));
    bits.push(esc(t.calls(s.tools)));
    if (s.live) bits.push(`<span class="tr-total-time" data-total-live></span>`);
    else if (s.ms) bits.push(`<span class="tr-total-time">${esc(fmtDuration(s.ms))}</span>`);
    if (s.hasCost) bits.push(esc(fmtUsd(s.costUsd)));
    return `<div class="tr-total"><span class="tr-total-k">${esc(t.total)}</span><span class="tr-total-v">${bits
      .map((b) => `<span class="tr-m">${b}</span>`)
      .join('<span class="tr-dot" aria-hidden="true">·</span>')}</span></div>`;
  }
}

define('ui-task-runs', UiTaskRuns);

declare global {
  interface HTMLElementTagNameMap {
    'ui-task-runs': UiTaskRuns;
  }
}
