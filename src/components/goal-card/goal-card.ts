import { define, UiElement } from '../../core/element';
import { clamp, fmtAgo } from '../../core/format';
import { esc, escAttr } from '../../core/html';
import { morphInto } from '../../core/morph';
import { icon } from '../../icons/icons';
import { typedKey } from '../../sound/sound';
import { styles } from './styles';

/** Known words: active · paused · complete · failed · cancelled (aliases: running, completed, done, error, canceled). */
export type GoalStatus = 'active' | 'paused' | 'complete' | 'failed' | 'cancelled' | (string & {});

/**
 * How far the current goal is: a fraction `0..1` (clamped), or `{ done, total }` steps (shown as “3 / 5 · 60%”).
 * Both normalise through `goalProgress()`; anything else draws no bar.
 */
export type GoalProgress = number | { done: number; total: number };

/** Epoch milliseconds (an ISO string is accepted too). */
export type GoalTime = number | string;

/** One quiet fact on a goal: a word (`'evaluator: done'`) or a label · value pair (`{ label: 'Continues', value: '3/10' }`). */
export type GoalMetaItem = string | { label: string; value: string };

export interface GoalCurrent {
  id: string;
  /** The objective, as the person wrote it (newlines kept). */
  objective: string;
  status: GoalStatus;
  progress?: GoalProgress;
  startedAt?: GoalTime;
  updatedAt?: GoalTime;
  /**
   * Budget and bookkeeping that is not progress — the auto-continue count (`{ label: 'Continues', value: '3/10' }`),
   * a cost — drawn as one quiet line after the times.
   */
  meta?: GoalMetaItem[];
  /** A note under the goal: what the evaluator says is left, why it paused (newlines kept). */
  note?: string;
}

export interface GoalQueued {
  id: string;
  objective: string;
  addedAt?: GoalTime;
}

export interface GoalPast {
  id: string;
  objective: string;
  status: GoalStatus;
  endedAt?: GoalTime;
  /** One quiet line per goal: active time, tokens, cost, how it closed (`['2h 10m', '$0.42', 'Continued 3×']`). */
  meta?: GoalMetaItem[];
  /** Why it ended the way it did (the evaluator's reason), under the meta line. */
  note?: string;
}

/** The goal write in flight (one at a time). `pause` covers resume too. */
export type GoalBusy = 'complete' | 'pause' | 'delete' | 'add';

export interface GoalCardData {
  /** The goal being worked on. Without it the card shows “No goal yet” (and the add box when editable). */
  current?: GoalCurrent | null;
  /** Goals waiting their turn, in order. */
  queue?: GoalQueued[];
  /** Goals that ended, in the order to show (newest first, usually). Collapsed under “Past goals”. */
  history?: GoalPast[];
  /** Default `true`. `false` = read-only: no actions, no add box. */
  canEdit?: boolean;
  /**
   * The goal actions the host answers (`ui-complete`, `ui-pause` / `ui-resume`, `ui-delete`). The card draws, of what
   * the status allows, only these — a host whose goal route takes add and delete passes `['delete']`. `[]` draws no
   * goal action; without `delete` the queued goals lose their remove too. Default: every action the status allows.
   * The add box stays with `canEdit`.
   */
  actions?: GoalAction[];
  /** A goal write in flight: its button spins, every goal action waits. */
  busy?: GoalBusy | null;
  /** The goal `busy` is about (a queued goal's id for its remove button). Default: the current goal. */
  busyId?: string;
  /** The last refused goal action, shown as an alert until the host clears it. */
  error?: string;
  /** Clock for the relative times (epoch ms). Without it the card reads `Date.now()` and refreshes every 30 s. */
  now?: number;
  /** Longest objective the add box takes (characters); shows a counter. */
  maxLength?: number;
}

export interface GoalIdDetail {
  id: string;
}
export interface GoalDeleteDetail {
  id: string;
  /** `true` for a goal from the queue, `false` for the current goal. */
  queued: boolean;
}
export interface GoalAddDetail {
  objective: string;
}

export type GoalTone = 'run' | 'wait' | 'done' | 'fail' | 'idle';
export type GoalAction = 'complete' | 'pause' | 'resume' | 'delete';
type StatusKey = 'active' | 'paused' | 'complete' | 'failed' | 'cancelled';
type Lang = 'en' | 'ko';
type WhenKind = 'started' | 'updated' | 'added' | 'ended';

/** The window for the confirming second press of Complete / Delete / Remove. */
export const GOAL_ARM_MS = 4000;
/** A second press sooner than this after arming is the same press (a double click), not a confirmation. */
export const GOAL_ARM_GUARD_MS = 250;
/** Lines of the objective shown while folded. */
export const GOAL_FOLD_LINES = 3;
const TICK_MS = 30_000;
const GROW_MAX = 140;

const STRINGS = {
  en: {
    title: 'Goal',
    status: { active: 'Active', paused: 'Paused', complete: 'Complete', failed: 'Failed', cancelled: 'Cancelled' },
    more: 'More',
    less: 'Less',
    when: {
      started: (a: string) => `Started ${a}`,
      updated: (a: string) => `Updated ${a}`,
      added: (a: string) => `Added ${a}`,
      ended: (a: string) => a,
    },
    progress: 'Progress',
    steps: (d: string, t: string, p: number) => `${d} / ${t} · ${p}%`,
    stepsSr: (d: string, t: string, p: number) => `${d} of ${t} done, ${p}%`,
    act: { complete: 'Complete', pause: 'Pause', resume: 'Resume', delete: 'Delete' },
    armed: { complete: 'Complete?', delete: 'Delete?', remove: 'Remove?' },
    armedSr: {
      complete: 'Press again to mark the goal complete',
      delete: (next: boolean) => `Press again to delete the goal${next ? ' — the next one starts' : ''}`,
      remove: (n: number) => `Press again to remove queued goal ${n}`,
    },
    busy: {
      complete: 'Completing…',
      pause: 'Pausing…',
      resume: 'Resuming…',
      delete: 'Deleting…',
      remove: 'Removing…',
      add: 'Adding…',
    },
    queue: 'Up next',
    remove: (n: number) => `Remove queued goal ${n}`,
    addLabel: 'Add a goal',
    placeNext: 'Add a goal — starts after the current one',
    placeNow: 'Add a goal — starts now',
    add: 'Add',
    hint: 'Enter to add · Shift+Enter for a new line',
    empty: 'No goal yet',
    noCurrent: 'No current goal',
    history: 'Past goals',
  },
  ko: {
    title: '목표',
    status: { active: '진행 중', paused: '일시정지', complete: '완료', failed: '실패', cancelled: '취소됨' },
    more: '펼치기',
    less: '접기',
    when: {
      started: (a: string) => `${a} 시작`,
      updated: (a: string) => `${a} 갱신`,
      added: (a: string) => `${a} 추가`,
      ended: (a: string) => a,
    },
    progress: '진행률',
    steps: (d: string, t: string, p: number) => `${d} / ${t} · ${p}%`,
    stepsSr: (d: string, t: string, p: number) => `${t}개 중 ${d}개 완료, ${p}%`,
    act: { complete: '완료', pause: '일시정지', resume: '재개', delete: '삭제' },
    armed: { complete: '완료할까요?', delete: '삭제할까요?', remove: '삭제할까요?' },
    armedSr: {
      complete: '한 번 더 누르면 목표를 완료로 표시합니다',
      delete: (next: boolean) => `한 번 더 누르면 목표를 삭제합니다${next ? ' — 다음 목표가 시작됩니다' : ''}`,
      remove: (n: number) => `한 번 더 누르면 ${n}번째 대기 목표를 삭제합니다`,
    },
    busy: {
      complete: '완료 처리 중…',
      pause: '일시정지 중…',
      resume: '재개 중…',
      delete: '삭제 중…',
      remove: '삭제 중…',
      add: '추가 중…',
    },
    queue: '다음 목표',
    remove: (n: number) => `${n}번째 대기 목표 삭제`,
    addLabel: '목표 추가',
    placeNext: '목표 추가 — 지금 목표 다음에 시작',
    placeNow: '목표 추가 — 바로 시작',
    add: '추가',
    hint: 'Enter 추가 · Shift+Enter 줄바꿈',
    empty: '아직 목표가 없습니다',
    noCurrent: '진행 중인 목표가 없습니다',
    history: '지난 목표',
  },
};
type Strings = (typeof STRINGS)['en'];

const ALIASES: Record<string, StatusKey> = {
  active: 'active',
  running: 'active',
  paused: 'paused',
  complete: 'complete',
  completed: 'complete',
  done: 'complete',
  failed: 'failed',
  error: 'failed',
  cancelled: 'cancelled',
  canceled: 'cancelled',
};
const TONE: Record<StatusKey, GoalTone> = {
  active: 'run',
  paused: 'wait',
  complete: 'done',
  failed: 'fail',
  cancelled: 'idle',
};
const STATUS_ICON: Record<StatusKey | 'other', string> = {
  active: 'play',
  paused: 'pause',
  complete: 'check',
  failed: 'cross',
  cancelled: 'minus',
  other: 'clock',
};
const ACT_ICON: Record<GoalAction | 'remove', string> = {
  complete: 'check',
  pause: 'pause',
  resume: 'play',
  delete: 'trash',
  remove: 'trash',
};

/** The icon set has no pause glyph: two bars drawn on the same 16-grid, stroke and caps as `icon()`. */
function glyph(name: string, size: number): string {
  if (name !== 'pause') return icon(name, { size });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false" data-icon="pause" aria-hidden="true"><path d="M5.75 3.75v8.5M10.25 3.75v8.5" stroke-width="1.85"/></svg>`;
}

export interface GoalStatusInfo {
  /** The canonical word, or `other` for a status the card does not know (shown as written, neutral tone). */
  key: StatusKey | 'other';
  tone: GoalTone;
  label: string;
  /** The goal has ended (complete, failed, cancelled): only Delete is left. */
  terminal: boolean;
}

/** Status → tone (st-* colour), human word and whether it is final. Unknown words keep their text, neutral tone. */
export function goalStatus(status: unknown, lang: Lang = 'en'): GoalStatusInfo {
  const raw = String(status ?? '').trim();
  const k = raw.toLowerCase();
  const key = Object.hasOwn(ALIASES, k) ? ALIASES[k] : null;
  const t = STRINGS[lang] ?? STRINGS.en;
  if (!key) return { key: 'other', tone: 'idle', label: raw, terminal: false };
  return {
    key,
    tone: TONE[key],
    label: t.status[key],
    terminal: key === 'complete' || key === 'failed' || key === 'cancelled',
  };
}

/**
 * The actions the current goal offers: active → complete, pause, delete; paused → complete, resume, delete; ended →
 * delete. `allowed` (the host's `actions`) keeps only the ones the host answers, in the card's order.
 */
export function goalActions(status: unknown, allowed?: readonly GoalAction[] | null): GoalAction[] {
  const s = goalStatus(status);
  let all: GoalAction[];
  if (s.terminal) all = ['delete'];
  else if (s.key === 'active') all = ['complete', 'pause', 'delete'];
  else if (s.key === 'paused') all = ['complete', 'resume', 'delete'];
  else all = ['complete', 'delete'];
  if (!Array.isArray(allowed)) return all;
  return all.filter((a) => allowed.includes(a));
}

/** `meta` items → the quiet `label value` spans (strings as they are), for one · separated line. */
export function goalMetaHtml(items: unknown, cls = 'gc-kv'): string {
  if (!Array.isArray(items)) return '';
  return items
    .map((m) => {
      if (typeof m === 'string') return m.trim() ? `<span class="${cls}">${esc(m)}</span>` : '';
      if (m && typeof m === 'object') {
        const { label, value } = m as { label?: unknown; value?: unknown };
        const l = String(label ?? '').trim();
        const v = String(value ?? '').trim();
        if (!l && !v) return '';
        return `<span class="${cls}">${l ? `<span class="gc-k">${esc(l)}</span>` : ''}${l && v ? ' ' : ''}${
          v ? `<span class="gc-v">${esc(v)}</span>` : ''
        }</span>`;
      }
      return '';
    })
    .filter(Boolean)
    .join('<span class="gc-dot" aria-hidden="true">·</span>');
}

export interface GoalProgressInfo {
  /** 0..1 */
  ratio: number;
  /** Whole percent; 100 only when finished (199 / 200 reads 99%). */
  pct: number;
  done?: number;
  total?: number;
}

/** `0..1` or `{ done, total }` → one shape. Non-finite values or a total ≤ 0 → null (no bar). */
export function goalProgress(p: unknown): GoalProgressInfo | null {
  const pct = (r: number) => (r >= 1 ? 100 : Math.floor(r * 100));
  if (typeof p === 'number') {
    if (!Number.isFinite(p)) return null;
    const ratio = clamp(p, 0, 1);
    return { ratio, pct: pct(ratio) };
  }
  if (p && typeof p === 'object') {
    const total = Number((p as { total?: unknown }).total);
    const done = Number((p as { done?: unknown }).done);
    if (!Number.isFinite(total) || !(total > 0) || !Number.isFinite(done)) return null;
    const d = clamp(done, 0, total);
    const ratio = d / total;
    return { ratio, pct: pct(ratio), done: d, total };
  }
  return null;
}

/** Relative past time: just now · 5m ago · 3h ago · 2d ago (ko: 방금 · 5분 전 · 3시간 전 · 2일 전). */
export function goalAgo(at: number, now: number = Date.now(), lang: Lang = 'en'): string {
  if (lang !== 'ko') return fmtAgo(at, now);
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 45) return '방금';
  const m = Math.floor(s / 60);
  if (m < 60) return `${Math.max(1, m)}분 전`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export interface FoldMeasure {
  /** The whole text's height (folded or not). */
  scrollHeight: number;
  /** The box's height (the fold when folded). */
  clientHeight?: number;
  /** Computed line height in px (NaN / 0 when unknown). */
  lineHeight?: number;
  /** The text is unfolded right now. */
  open?: boolean;
}

/**
 * Does the objective run past its fold (so the More / Less toggle is worth showing)? With a known line height:
 * taller than `lines` lines. Without one: folded text taller than its box. An open text that cannot be measured
 * keeps its toggle (so it can always be folded again); text that is not laid out yet does not get one.
 */
export function objectiveOverflows(m: FoldMeasure, lines: number = GOAL_FOLD_LINES): boolean {
  const sh = Number(m.scrollHeight) || 0;
  if (!(sh > 0)) return !!m.open;
  const lh = Number(m.lineHeight);
  if (lh > 0) return sh > lh * lines + 1;
  if (!m.open) return sh > (Number(m.clientHeight) || 0) + 1;
  return true;
}

/** Epoch ms from a number or an ISO string; 0 when it is not a usable date. */
function toMs(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Date.parse(v) : Number.NaN;
  return Number.isFinite(n) && n > 0 && n < 8.64e15 ? n : 0;
}

const fmtStep = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const SPIN = '<span class="gc-spin" aria-hidden="true"></span>';

type Armed = { act: 'complete' | 'delete' | 'remove'; id: string };

/**
 * `<ui-goal-card>` — the goal an agent works toward: status (icon + word), progress, the objective folded to three
 * lines, and the goals queued after it; Complete, Pause / Resume, Delete and Add hand the decision to the host
 * (`ui-complete`, `ui-pause`, `ui-resume`, `ui-delete`, `ui-add`). Complete and Delete ask for a second press.
 */
export class UiGoalCard extends UiElement<GoalCardData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  #armed: Armed | null = null;
  #armedAt = 0;
  #armTimer = 0;
  /** The objective is unfolded — for the goal `#foldId`; a new goal starts folded. */
  #open = false;
  #foldId: string | null = null;
  #overflows = false;
  #histOpen = false;
  #draft = '';
  #ro: ResizeObserver | undefined;
  #observed: Element | null = null;
  #tick = 0;

  constructor() {
    super();
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    this.root.addEventListener('input', (e) => this.#onInput(e));
    // Focus leaving the armed button disarms it (Tab away, a click elsewhere): a later Enter must not confirm.
    this.root.addEventListener('focusout', (e) => this.#onFocusOut(e as FocusEvent));
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override disconnectedCallback(): void {
    this.#disarm(false);
    this.#ro?.disconnect();
    this.#observed = null;
    clearInterval(this.#tick);
    this.#tick = 0;
  }

  /** The add box's text. Set it to replace the draft — e.g. clear it once a prevented `ui-add` went through. */
  get draft(): string {
    return this.#draft;
  }

  set draft(v: string) {
    const max = this.#max();
    const s = String(v ?? '');
    this.#draft = max ? s.slice(0, max) : s;
    const ta = this.#input();
    if (ta && ta.value !== this.#draft) ta.value = this.#draft;
    this.#paintDraft();
  }

  get #lang(): Lang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #t(): Strings {
    return STRINGS[this.#lang];
  }

  #edit(): boolean {
    return !!this.data && this.data.canEdit !== false;
  }

  #max(): number {
    const m = Number(this.data?.maxLength);
    return Number.isFinite(m) && m > 0 ? Math.floor(m) : 0;
  }

  #input(): HTMLTextAreaElement | null {
    return this.$<HTMLTextAreaElement>('.gc-input');
  }

  #current(): GoalCurrent | null {
    const c = this.data?.current;
    return c && typeof c === 'object' ? c : null;
  }

  #queue(): GoalQueued[] {
    const q = this.data?.queue;
    return Array.isArray(q) ? q.filter((g) => g && typeof g === 'object') : [];
  }

  /** A queued goal's remove is a delete: it needs the host to answer `ui-delete`. */
  #canRemove(): boolean {
    const a = this.data?.actions;
    return !Array.isArray(a) || a.includes('delete');
  }

  // ── Render ──

  /**
   * Patch the live tree instead of replacing it: the add box keeps its node (and the person's typing), a focused
   * button keeps its focus, and the history region keeps its transition. The current goal and each queued goal are
   * keyed by id (`data-mk`), so a focused control is never rebound to another goal; when its goal leaves, focus
   * lands on the card instead of falling to the page.
   */
  protected override update(): void {
    const had = this.#focusInside();
    this.#reconcile();
    morphInto(this.content, this.render());
    this.updated();
    if (had && !this.#focusInside()) this.$<HTMLElement>('.gc')?.focus({ preventScroll: true });
  }

  #focusInside(): boolean {
    const a = this.root.activeElement;
    return !!a && this.content.contains(a);
  }

  /** State that no longer matches the data: an armed press whose goal left or that a write now blocks; a new goal. */
  #reconcile(): void {
    const cur = this.#current();
    const id = cur ? String(cur.id) : null;
    if (id !== this.#foldId) {
      this.#foldId = id;
      this.#open = false;
      this.#overflows = false;
    }
    const a = this.#armed;
    if (!a) return;
    const alive =
      a.act === 'remove'
        ? this.#canRemove() && this.#queue().some((q) => String(q.id) === a.id)
        : !!cur && String(cur.id) === a.id && goalActions(cur.status, this.data?.actions).includes(a.act);
    if (!alive || !this.#edit() || this.data?.busy) this.#disarm(false);
  }

  protected render(): string {
    const d = this.data;
    if (!d) return '';
    const t = this.#t;
    const lang = this.#lang;
    const now = Number.isFinite(d.now) ? Number(d.now) : Date.now();
    const edit = this.#edit();
    const cur = this.#current();
    const queue = this.#queue();
    const hist = Array.isArray(d.history) ? d.history.filter((g) => g && typeof g === 'object') : [];
    const st = cur ? goalStatus(cur.status, lang) : null;

    const head = `<div class="gc-head"><span class="gc-title" id="gc-title">${icon('target', { size: 14, class: 'gc-title-i' })}<span>${esc(
      t.title,
    )}</span></span>${st ? this.#chip(st) : ''}</div>`;
    const error = d.error
      ? `<div class="gc-error" role="alert">${icon('alert', { size: 14 })}<span class="gc-error-t">${esc(d.error)}</span></div>`
      : '';
    const body =
      cur && st ? this.#currentHtml(cur, st, queue.length, now, edit, t, lang) : this.#emptyHtml(queue, hist, t);
    const queueHtml = queue.length ? this.#queueHtml(queue, now, edit, t, lang) : '';
    const add = edit ? this.#addHtml(cur, st, t) : '';
    const histHtml = hist.length ? this.#historyHtml(hist, now, t, lang) : '';
    return `<section class="gc" role="group" aria-labelledby="gc-title" tabindex="-1">${head}${error}${body}${queueHtml}${add}${histHtml}<span class="gc-live sr-only" aria-live="polite">${esc(
      this.#liveText(queue, t),
    )}</span></section>`;
  }

  #chip(st: GoalStatusInfo, quiet = false): string {
    return `<span class="gc-chip${quiet ? ' is-quiet' : ''}" data-tone="${st.tone}">${glyph(STATUS_ICON[st.key], 12)}<span class="gc-chip-t">${esc(
      st.label,
    )}</span></span>`;
  }

  #emptyHtml(queue: GoalQueued[], hist: GoalPast[], t: Strings): string {
    return `<p class="gc-empty">${esc(queue.length || hist.length ? t.noCurrent : t.empty)}</p>`;
  }

  #currentHtml(
    cur: GoalCurrent,
    st: GoalStatusInfo,
    queued: number,
    now: number,
    edit: boolean,
    t: Strings,
    lang: Lang,
  ): string {
    const id = String(cur.id);
    const open = this.#open;
    const prog = goalProgress(cur.progress);
    let progress = '';
    if (prog) {
      const has = prog.done !== undefined && prog.total !== undefined;
      const text = has ? t.steps(fmtStep(prog.done!), fmtStep(prog.total!), prog.pct) : `${prog.pct}%`;
      const sr = has ? t.stepsSr(fmtStep(prog.done!), fmtStep(prog.total!), prog.pct) : `${prog.pct}%`;
      progress = `<div class="gc-prog" data-tone="${st.tone}"><span class="gc-bar" role="progressbar" aria-label="${escAttr(
        t.progress,
      )}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${prog.pct}" aria-valuetext="${escAttr(
        sr,
      )}"><i class="gc-fill" style="--p:${prog.ratio}"></i></span><span class="gc-prog-t" aria-hidden="true">${esc(text)}</span></div>`;
    }
    const started = toMs(cur.startedAt);
    const updated = toMs(cur.updatedAt);
    const when: string[] = [];
    if (started) when.push(this.#when(started, 'started', now, t, lang));
    if (updated && (!started || updated - started >= 60_000)) when.push(this.#when(updated, 'updated', now, t, lang));
    const facts = [...when, goalMetaHtml(cur.meta)].filter(Boolean);
    const meta = facts.length
      ? `<div class="gc-meta">${facts.join('<span class="gc-dot" aria-hidden="true">·</span>')}</div>`
      : '';
    const note =
      typeof cur.note === 'string' && cur.note.trim() ? `<p class="gc-note">${esc(cur.note.trim())}</p>` : '';
    const offered = edit ? goalActions(cur.status, this.data?.actions) : [];
    const actions = offered.length
      ? `<div class="gc-acts">${offered.map((a) => this.#actBtn(a, id, queued, t)).join('')}</div>`
      : '';
    return `<div class="gc-cur" data-mk="${escAttr(`goal:${id}`)}"><p class="gc-obj" id="gc-obj"${open ? ' data-open' : ''}>${esc(
      cur.objective,
    )}</p><button type="button" class="gc-more" data-act="more" data-key="more" aria-controls="gc-obj" aria-expanded="${open}"${
      this.#overflows ? '' : ' hidden'
    }><span class="gc-more-t">${esc(open ? t.less : t.more)}</span>${icon('chevron-down', {
      size: 12,
      class: 'gc-more-i',
    })}</button>${progress}${meta}${note}${actions}</div>`;
  }

  #when(at: number, kind: WhenKind, now: number, t: Strings, lang: Lang): string {
    return `<time class="gc-when" datetime="${new Date(at).toISOString()}" data-at="${at}" data-kind="${kind}">${esc(
      t.when[kind](goalAgo(at, now, lang)),
    )}</time>`;
  }

  #actBtn(act: GoalAction, id: string, queued: number, t: Strings): string {
    const d = this.data!;
    const busyKey: GoalBusy = act === 'resume' ? 'pause' : act;
    const spinning = d.busy === busyKey && (d.busyId === undefined || d.busyId === null || String(d.busyId) === id);
    const a = this.#armed;
    const armed = !!a && a.id === id && a.act === act;
    const label = spinning
      ? t.busy[act]
      : armed && (act === 'complete' || act === 'delete')
        ? t.armed[act]
        : t.act[act];
    // Pause and Resume are one control (its node and focus survive the swap); the others never turn into each other.
    const mk = act === 'pause' || act === 'resume' ? 'toggle' : act;
    return `<button type="button" class="gc-btn${act === 'delete' ? ' is-danger' : ''}" data-mk="${mk}" data-act="${act}" data-id="${escAttr(
      id,
    )}" data-key="${escAttr(`${mk}|${id}`)}"${armed ? ' data-armed' : ''}${d.busy ? ' aria-disabled="true"' : ''}${
      spinning ? ' aria-busy="true"' : ''
    }${armed && act === 'delete' ? ` title="${escAttr(t.armedSr.delete(queued > 0))}"` : ''}>${
      spinning ? SPIN : glyph(ACT_ICON[act], 14)
    }<span class="gc-btn-t">${esc(label)}</span></button>`;
  }

  #queueHtml(queue: GoalQueued[], now: number, edit: boolean, t: Strings, lang: Lang): string {
    const d = this.data!;
    const rows = queue
      .map((q, i) => {
        const id = String(q.id);
        const n = i + 1;
        const added = toMs(q.addedAt);
        let rm = '';
        if (edit && this.#canRemove()) {
          const a = this.#armed;
          const armed = !!a && a.act === 'remove' && a.id === id;
          const spinning =
            d.busy === 'delete' && d.busyId !== undefined && d.busyId !== null && String(d.busyId) === id;
          const label = spinning ? t.busy.remove : armed ? t.armedSr.remove(n) : t.remove(n);
          rm = `<button type="button" class="gc-rm" data-act="remove" data-id="${escAttr(id)}" data-key="${escAttr(
            `remove|${id}`,
          )}" aria-label="${escAttr(label)}"${armed ? ' data-armed' : ''}${d.busy ? ' aria-disabled="true"' : ''}${
            spinning ? ' aria-busy="true"' : ''
          }>${spinning ? SPIN : glyph(ACT_ICON.remove, 14)}${armed ? `<span class="gc-btn-t" aria-hidden="true">${esc(t.armed.remove)}</span>` : ''}</button>`;
        }
        return `<li class="gc-q-row" data-mk="${escAttr(`q:${id}`)}"><span class="gc-q-n" aria-hidden="true">${n}</span><div class="gc-q-main"><span class="gc-q-text">${esc(
          q.objective,
        )}</span>${added ? this.#when(added, 'added', now, t, lang) : ''}</div>${rm}</li>`;
      })
      .join('');
    return `<div class="gc-q"><div class="gc-sub" id="gc-q-title"><span>${esc(t.queue)}</span><span class="gc-n">${
      queue.length
    }</span></div><ol class="gc-q-list" aria-labelledby="gc-q-title">${rows}</ol></div>`;
  }

  #addHtml(cur: GoalCurrent | null, st: GoalStatusInfo | null, t: Strings): string {
    const d = this.data!;
    const max = this.#max();
    const place = cur && st && !st.terminal ? t.placeNext : t.placeNow;
    const adding = d.busy === 'add';
    return `<div class="gc-add"><div class="gc-field"><textarea class="gc-input" data-key="add-input" rows="1" aria-label="${escAttr(
      t.addLabel,
    )}" aria-describedby="gc-hint" placeholder="${escAttr(place)}" enterkeyhint="done"${
      max ? ` maxlength="${max}"` : ''
    }></textarea><button type="button" class="gc-add-btn" data-act="add" data-key="add"${this.#addOff() ? ' aria-disabled="true"' : ''}${
      adding ? ' aria-busy="true"' : ''
    }>${adding ? SPIN : icon('plus', { size: 14 })}<span class="gc-btn-t">${esc(adding ? t.busy.add : t.add)}</span></button></div><div class="gc-hint" id="gc-hint"><span class="gc-hint-t">${esc(
      t.hint,
    )}</span>${max ? `<span class="gc-count" data-count>${this.#draft.length} / ${max}</span>` : ''}</div></div>`;
  }

  #historyHtml(hist: GoalPast[], now: number, t: Strings, lang: Lang): string {
    const open = this.#histOpen;
    const items = hist
      .map((h) => {
        const ended = toMs(h.endedAt);
        const meta = goalMetaHtml(h.meta);
        const note =
          typeof h.note === 'string' && h.note.trim() ? `<p class="gc-h-note">${esc(h.note.trim())}</p>` : '';
        return `<li class="gc-h-row" data-mk="${escAttr(`h:${String(h.id)}`)}"><div class="gc-h-top">${this.#chip(
          goalStatus(h.status, lang),
          true,
        )}${ended ? this.#when(ended, 'ended', now, t, lang) : ''}</div><p class="gc-h-obj">${esc(h.objective)}</p>${
          meta ? `<div class="gc-h-meta">${meta}</div>` : ''
        }${note}</li>`;
      })
      .join('');
    return `<div class="gc-hist"${open ? ' data-open' : ''}><button type="button" class="gc-hist-head" data-act="history" data-key="history" aria-expanded="${open}" aria-controls="gc-hist-region">${icon(
      'chevron-right',
      { size: 12, class: 'gc-chev' },
    )}<span class="gc-hist-t">${esc(t.history)}</span><span class="gc-n">${hist.length}</span></button><div class="gc-hist-region" id="gc-hist-region"${open ? '' : ' inert'}><div class="gc-hist-inner"><ol class="gc-h-list">${items}</ol></div></div></div>`;
  }

  #liveText(queue: GoalQueued[], t: Strings): string {
    const a = this.#armed;
    if (!a) return '';
    if (a.act === 'complete') return t.armedSr.complete;
    if (a.act === 'delete') return t.armedSr.delete(queue.length > 0);
    return t.armedSr.remove(queue.findIndex((q) => String(q.id) === a.id) + 1);
  }

  protected override updated(): void {
    const ta = this.#input();
    if (ta) {
      // The draft is set, never rendered: the node is kept across renders, and a fresh one gets the text back.
      if (ta.value !== this.#draft) ta.value = this.#draft;
      this.#grow(ta);
    }
    this.#measure();
    this.#observe();
    this.#syncTicker();
  }

  // ── The fold ──

  /** Show More / Less only where the fold cuts something; measured after every render and on every resize. */
  #measure(): void {
    const obj = this.$<HTMLElement>('.gc-obj');
    const more = this.$<HTMLElement>('.gc-more');
    if (!obj || !more) return;
    let lh = Number.NaN;
    try {
      lh = Number.parseFloat(getComputedStyle(obj).lineHeight);
    } catch {}
    this.#overflows = objectiveOverflows({
      scrollHeight: obj.scrollHeight,
      clientHeight: obj.clientHeight,
      lineHeight: lh,
      open: this.#open,
    });
    if (more.hidden === this.#overflows) more.hidden = !this.#overflows;
  }

  /** A width change rewraps the objective (panel resized, shown after display:none, fonts arrived). */
  #observe(): void {
    if (typeof ResizeObserver !== 'function') return;
    const obj = this.$('.gc-obj');
    if (obj === this.#observed) return;
    this.#ro ??= new ResizeObserver(() => this.#measure());
    this.#ro.disconnect();
    this.#observed = obj;
    if (obj) this.#ro.observe(obj);
  }

  // ── Times ──

  /** Without a host clock the relative times refresh in place every 30 s (text nodes only, no re-render). */
  #syncTicker(): void {
    const need = this.isConnected && !!this.data && !Number.isFinite(this.data.now) && !!this.$('[data-at]');
    if (need && !this.#tick) this.#tick = window.setInterval(() => this.#paintTimes(), TICK_MS);
    else if (!need && this.#tick) {
      clearInterval(this.#tick);
      this.#tick = 0;
    }
  }

  #paintTimes(): void {
    const t = this.#t;
    const lang = this.#lang;
    const now = Number.isFinite(this.data?.now) ? Number(this.data?.now) : Date.now();
    for (const el of this.$$<HTMLElement>('[data-at]')) {
      const kind = el.dataset.kind as WhenKind;
      if (!t.when[kind]) continue;
      const text = t.when[kind](goalAgo(Number(el.dataset.at), now, lang));
      if (el.textContent !== text) el.textContent = text;
    }
  }

  // ── The add box ──

  #addOff(): boolean {
    return !!this.data?.busy || !this.#draft.trim();
  }

  #paintDraft(): void {
    const ta = this.#input();
    if (ta) this.#grow(ta);
    const btn = this.$('.gc-add-btn');
    if (btn) {
      if (this.#addOff()) btn.setAttribute('aria-disabled', 'true');
      else btn.removeAttribute('aria-disabled');
    }
    const count = this.$('[data-count]');
    if (count) count.textContent = `${this.#draft.length} / ${this.#max()}`;
  }

  /** The box grows with its text up to ~7 lines, then scrolls. */
  #grow(ta: HTMLTextAreaElement): void {
    ta.style.height = '';
    const h = ta.scrollHeight;
    if (h > 0) ta.style.height = `${Math.min(h + (ta.offsetHeight - ta.clientHeight), GROW_MAX)}px`;
  }

  #add(e: Event): void {
    const d = this.data;
    if (!d || !this.#edit() || d.busy) return;
    const ta = this.#input();
    const objective = (ta ? ta.value : this.#draft).trim();
    if (!objective) {
      ta?.focus();
      return;
    }
    const wasArmed = !!this.#armed;
    this.#disarm(false);
    if (wasArmed) this.requestRender();
    const detail: GoalAddDetail = { objective };
    if (!this.emit('ui-add', detail)) return;
    this.sound('tap', undefined, e);
    this.#draft = '';
    if (ta) ta.value = '';
    this.#paintDraft();
  }

  // ── Input ──

  #onInput(e: Event): void {
    const ta = e.target as HTMLTextAreaElement | null;
    if (!ta?.classList?.contains('gc-input')) return;
    this.#draft = ta.value;
    this.#paintDraft();
  }

  #onClick(e: Event): void {
    const b = (e.target as Element | null)?.closest?.<HTMLElement>('button[data-act]');
    if (!b || !this.content.contains(b)) return;
    const act = b.dataset.act;
    if (act === 'more') {
      this.#open = !this.#open;
      this.requestRender();
      return;
    }
    if (act === 'history') {
      this.#histOpen = !this.#histOpen;
      this.requestRender();
      return;
    }
    if (b.getAttribute('aria-disabled') === 'true') {
      if (act === 'add' && !this.data?.busy) this.#input()?.focus();
      return;
    }
    if (!this.#edit()) return;
    const id = b.dataset.id ?? '';
    switch (act) {
      case 'add':
        this.#add(e);
        break;
      case 'complete':
      case 'delete':
      case 'remove':
        this.#press(act, id, e);
        break;
      case 'pause':
      case 'resume': {
        const was = !!this.#armed;
        this.#disarm(false);
        if (was) this.requestRender();
        const detail: GoalIdDetail = { id };
        if (this.emit(`ui-${act}`, detail))
          this.sound('toggle', { direction: act === 'resume' ? 'forward' : 'back' }, e);
        break;
      }
    }
  }

  #onKey(e: KeyboardEvent): void {
    const el = e.target as HTMLElement | null;
    if (!el) return;
    if (el.classList?.contains('gc-input')) {
      // Never while an IME is composing: Korean input commits its syllable with Enter.
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) {
        const key = typedKey(e, el);
        if (key) this.sound('type', { key }, e);
        return;
      }
      e.preventDefault();
      this.#add(e);
      return;
    }
    // A held Enter repeats the click: on an armed button that would confirm on its own.
    if (e.repeat && (e.key === 'Enter' || e.key === ' ') && el.tagName === 'BUTTON') {
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape' && this.#armed) {
      e.stopPropagation();
      this.#disarm();
    }
  }

  #onFocusOut(e: FocusEvent): void {
    if (!this.#armed) return;
    const from = (e.target as Element | null)?.closest?.('[data-armed]');
    if (!from) return;
    const to = e.relatedTarget as Node | null;
    if (to && from.contains(to)) return;
    this.#disarm();
  }

  // ── Two-press ──

  /**
   * First press arms (the button asks “Delete?”), a second within 4 s confirms; Esc, blur or the timeout disarm.
   * Arming taps subtly; a confirmed Complete taps, a confirmed delete or remove plays a strong close.
   */
  #press(act: Armed['act'], id: string, e: Event): void {
    const a = this.#armed;
    const now = Date.now();
    if (a && a.act === act && a.id === id) {
      const since = now - this.#armedAt;
      if (since < GOAL_ARM_GUARD_MS) return;
      if (since < GOAL_ARM_MS) {
        this.#disarm(false);
        if (act === 'complete') {
          const detail: GoalIdDetail = { id };
          if (this.emit('ui-complete', detail)) this.sound('tap', undefined, e);
        } else {
          const detail: GoalDeleteDetail = { id, queued: act === 'remove' };
          if (this.emit('ui-delete', detail)) this.sound('close', { emphasis: 'strong' }, e);
        }
        this.requestRender();
        return;
      }
    }
    this.#armed = { act, id };
    this.#armedAt = now;
    clearTimeout(this.#armTimer);
    this.#armTimer = window.setTimeout(() => this.#disarm(), GOAL_ARM_MS);
    this.sound('tap', { emphasis: 'subtle' }, e);
    this.requestRender();
  }

  #disarm(render = true): void {
    const was = !!this.#armed;
    this.#armed = null;
    this.#armedAt = 0;
    clearTimeout(this.#armTimer);
    this.#armTimer = 0;
    if (render && was) this.requestRender();
  }
}

define('ui-goal-card', UiGoalCard);

declare global {
  interface HTMLElementTagNameMap {
    'ui-goal-card': UiGoalCard;
  }
}
