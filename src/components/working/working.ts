import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { attrs, cls, esc } from '../../core/html';
import { morphInto } from '../../core/morph';
import { icon } from '../../icons/icons';
import { elapsedTicker, elapsedTime, fmtSpan } from '../elapsed/elapsed';
import { styles } from './styles';

/** working: under way. waiting: needs you. done / failed: the turn ended. idle: nothing running. */
export type WorkingState = 'working' | 'waiting' | 'done' | 'failed' | 'idle';
export type WorkingSize = 'sm' | 'md';
export type WorkingLang = 'en' | 'ko';

export interface WorkingData {
  state: WorkingState;
  /** What it is doing now (`Reading dashboard.ts`). Without one the line shows the state word. */
  label?: string;
  /** When the turn started: epoch ms or an ISO string. Without it there is no time. */
  since?: number | string;
  /** When it ended: epoch ms or an ISO string. Done and failed need it for their time; working with one stands still. */
  until?: number | string;
  /** A quiet note after the time (`12.4k tokens`, `tool call 9 of ~20`). */
  detail?: string;
}

const STATES: readonly WorkingState[] = ['working', 'waiting', 'done', 'failed', 'idle'];

const STRINGS = {
  en: {
    state: { working: 'Working', waiting: 'Needs you', done: 'Done', failed: 'Failed', idle: 'Idle' } as Record<
      WorkingState,
      string
    >,
    doneIn: (t: string) => `Done in ${t}`,
    failedAfter: (t: string) => `Failed after ${t}`,
  },
  ko: {
    state: { working: '작업 중', waiting: '확인 필요', done: '완료', failed: '실패', idle: '대기' } as Record<
      WorkingState,
      string
    >,
    doneIn: (t: string) => `${t} 만에 완료`,
    failedAfter: (t: string) => `${t} 후 실패`,
  },
};

/** How long a label swap lasts (styles.ts: wk-rise / wk-leave). */
const SWAP_MS = 220;

const MARK: Record<WorkingState, string> = {
  working: '<span class="wk-ring"></span>',
  waiting: '<span class="wk-dot"></span>',
  done: icon('check', { size: 14, stroke: 2 }),
  failed: icon('cross', { size: 14, stroke: 2 }),
  idle: '<span class="wk-dot"></span>',
};

const words = (v: unknown): string => String(v ?? '').trim();
const langOf = (lang: unknown): WorkingLang => (lang === 'ko' ? 'ko' : 'en');

// ── Pure helpers ────────────────────────────────────────────────────────────

/** A known state, else `idle` — the line never claims work it was not told about. */
export function workingState(v: unknown): WorkingState {
  return STATES.includes(v as WorkingState) ? (v as WorkingState) : 'idle';
}

/** What the line is, in words: `Working: Reading dashboard.ts` (ko `작업 중: …`), or the state word alone. */
export function workingWords(state: unknown, label?: unknown, lang?: string): string {
  const word = STRINGS[langOf(lang)].state[workingState(state)];
  const l = words(label);
  return l ? `${word}: ${l}` : word;
}

/**
 * The time words at `now`: working and waiting — the span from `since` to `until` (or `now`): 42s · 4m 12s · 1h 02m;
 * done — `Done in 4m 12s` (ko `4분 12초 만에 완료`); failed — `Failed after 1m 03s` (`1분 03초 후 실패`); done and
 * failed need both ends. Idle has no time. Empty without a usable `since` (epoch ms, a numeric string or ISO).
 */
export function workingTime(state: unknown, since: unknown, until: unknown, now: number, lang?: string): string {
  const st = workingState(state);
  const lg = langOf(lang);
  const start = elapsedTime(since);
  const end = elapsedTime(until);
  if (st === 'idle' || Number.isNaN(start)) return '';
  if (st === 'done' || st === 'failed') {
    if (Number.isNaN(end)) return '';
    const t = fmtSpan(end - start, lg);
    return st === 'done' ? STRINGS[lg].doneIn(t) : STRINGS[lg].failedAfter(t);
  }
  return fmtSpan((Number.isNaN(end) ? now : end) - start, lg);
}

/** Whether the time moves: working or waiting, from a usable `since`, with no `until`. */
export function workingTicks(state: unknown, since: unknown, until: unknown): boolean {
  const st = workingState(state);
  return (
    (st === 'working' || st === 'waiting') && !Number.isNaN(elapsedTime(since)) && Number.isNaN(elapsedTime(until))
  );
}

/** Fill an element's text without replacing its text node. */
function setText(el: Element, txt: string): void {
  const n = el.firstChild;
  if (n && n.nodeType === 3 && !n.nextSibling) {
    if (n.nodeValue !== txt) n.nodeValue = txt;
  } else if (el.textContent !== txt) el.textContent = txt;
}

/**
 * `<ui-working>` — what an agent is doing right now, and for how long, in one line: a mark for the state (the working
 * ring, a pulsing dot when it needs you, a check, a cross, a hollow dot when idle), the current step, the elapsed time
 * and a quiet detail. While working the label carries a slow highlight sweep; a new step swaps in place — the old
 * label leaves upward, the new one rises — and the line keeps its height. The time ticks in place on the page's shared
 * whole-second ticker (the one `<ui-elapsed>` turns on) while the turn is live. A visually hidden polite status says
 * the state and the label when either changes; the time and the detail are read in the line, never announced. Display
 * only: data in, no events, no sound.
 */
export class UiWorking extends UiElement<WorkingData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return ['state', 'label', 'since', 'until', 'detail', 'lang'];
  }

  /** Leaves the shared ticker; set while the time is live. */
  #untick: (() => void) | undefined;
  readonly #onTick = (): void => this.#tick();
  #swapTimer: ReturnType<typeof setTimeout> | 0 = 0;
  /** The label the last render drew (undefined before the first one): a new one swaps in. */
  #shown: string | undefined;
  /** The label on its way out while the new one rises; empty when no swap is under way. */
  #was = '';
  /** Swaps so far: both label nodes take a new key, so each swap's animation starts from the top. */
  #swaps = 0;

  override disconnectedCallback(): void {
    this.#stopTimer();
    this.#endSwap(false);
    this.#shown = undefined;
    super.disconnectedCallback();
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  /** The state drawn now (`data.state`, else the attribute; unknown reads `idle`). */
  get state(): WorkingState {
    return workingState(this.data?.state ?? this.getAttribute('state'));
  }

  get #lang(): WorkingLang {
    return langOf(this.getAttribute('lang'));
  }

  /** What it shows, from `data` first, then the attributes. */
  get #value(): { state: WorkingState; label: string; since: unknown; until: unknown; detail: string } {
    const d = this.data;
    const a = (name: string) => this.getAttribute(name) ?? undefined;
    return {
      state: this.state,
      label: words(d?.label ?? a('label')),
      since: d?.since ?? a('since'),
      until: d?.until ?? a('until'),
      detail: words(d?.detail ?? a('detail')),
    };
  }

  /** The line's parts at `now`: the label drawn (the state word without one), the time, and the words said. */
  #parts(now: number) {
    const v = this.#value;
    const lang = this.#lang;
    const time = workingTime(v.state, v.since, v.until, now, lang);
    const finished = (v.state === 'done' || v.state === 'failed') && !!time;
    // "Done in 4m 12s" already says the state: without a label it stands alone.
    const shown = v.label || (finished ? '' : STRINGS[lang].state[v.state]);
    const named = workingWords(v.state, v.label, lang);
    const said = finished ? (v.label ? `${named}, ${time}` : time) : named;
    return { ...v, time, finished, shown, said };
  }

  /** Patched in place: the time keeps its text node; the status words change only with the state or the label. */
  protected override update(): void {
    const { shown } = this.#parts(Date.now());
    const was = this.#shown;
    this.#shown = shown;
    if (was && shown && was !== shown && !prefersReducedMotion()) this.#startSwap(was);
    morphInto(this.content, this.render());
    this.#syncTimer();
    this.updated();
  }

  protected render(): string {
    const p = this.#parts(Date.now());
    const swap = !!this.#was;
    const n = this.#swaps;
    // The status words say the state, the label and a finished time: those parts of the line are not read twice.
    const label = p.shown
      ? `<span${attrs({ class: cls('wk-label', swap && 'is-swap'), part: 'label', 'aria-hidden': 'true' })}>${
          swap ? `<span class="wk-text wk-was" data-mk="was-${n}">${esc(this.#was)}</span>` : ''
        }<span${attrs({
          class: cls('wk-text', 'wk-now', p.state === 'working' && !prefersReducedMotion() && 'is-sweep'),
          'data-mk': `now-${n}`,
        })}>${esc(p.shown)}</span></span>`
      : '';
    const time = p.time
      ? `<span${attrs({
          class: 'wk-time',
          part: 'time',
          'data-sep': !!p.shown,
          'aria-hidden': p.finished ? 'true' : undefined,
        })}>${esc(p.time)}</span>`
      : '';
    const detail = p.detail
      ? `<span${attrs({ class: 'wk-detail', part: 'detail', 'data-sep': !!(p.shown || p.time) })}>${esc(
          p.detail,
        )}</span>`
      : '';
    return `<span class="wk-said sr-only" role="status" aria-live="polite">${esc(p.said)}</span><div${attrs({
      class: 'wk',
      part: 'line',
      'data-state': p.state,
    })}><span class="wk-mark" part="mark" aria-hidden="true" data-mk="mark-${p.state}">${
      MARK[p.state]
    }</span>${label}${time}${detail}</div>`;
  }

  // ── The label swap ────────────────────────────────────────────────────────

  #startSwap(was: string): void {
    if (this.#swapTimer) clearTimeout(this.#swapTimer);
    this.#was = was;
    this.#swaps++;
    this.#swapTimer = setTimeout(() => this.#endSwap(true), SWAP_MS + 80);
  }

  /** The old label goes; `draw` redraws the line without it (and without the swap class). */
  #endSwap(draw: boolean): void {
    if (this.#swapTimer) clearTimeout(this.#swapTimer);
    this.#swapTimer = 0;
    if (!this.#was) return;
    this.#was = '';
    if (draw && this.isConnected) this.renderNow();
  }

  // ── The time ──────────────────────────────────────────────────────────────

  /**
   * On the page's shared whole-second ticker (`elapsedTicker`, the one every `<ui-elapsed>` turns on), so all live
   * times turn together — one subscription, only while connected and the turn is live (working or waiting, a start,
   * no end).
   */
  #syncTimer(): void {
    const v = this.#value;
    if (this.isConnected && workingTicks(v.state, v.since, v.until)) this.#untick ??= elapsedTicker(this.#onTick);
    else this.#stopTimer();
  }

  #stopTimer(): void {
    this.#untick?.();
    this.#untick = undefined;
  }

  /** Each second: the time's text node changes in place — never a re-render, and outside the live region. */
  #tick(): void {
    const el = this.$('.wk-time');
    if (!el) return;
    const v = this.#value;
    setText(el, workingTime(v.state, v.since, v.until, Date.now(), this.#lang));
  }
}

define('ui-working', UiWorking);

declare global {
  interface HTMLElementTagNameMap {
    'ui-working': UiWorking;
  }
}
