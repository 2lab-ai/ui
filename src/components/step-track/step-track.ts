import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { attrs, esc, escAttr } from '../../core/html';
import { morphInto } from '../../core/morph';
import { rovingIndex } from '../../core/roving';
import { styles } from './styles';

/** done · current (under way) · todo · failed · skipped. */
export type StepStatus = 'done' | 'current' | 'todo' | 'failed' | 'skipped';
export type StepTrackSize = 'sm' | 'md';
export type StepTrackLang = 'en' | 'ko';

export interface StepTrackStep {
  /** Keeps the step's node across renders and comes back in `ui-select`. Without one the step is keyed by its place. */
  id?: string;
  label: string;
  /** Missing: done before the current step, to do after it. A failed step at the current index is a failed current. */
  status?: StepStatus;
}

export interface StepTrackData {
  steps: StepTrackStep[];
  /**
   * Index of the step under way. Default: the first step marked `current`, else the first one not done or skipped;
   * all done → none. A number outside the steps is none (past the end: the steps without a status read done).
   */
  current?: number;
  /** How far into the current step, 0 … 1. `null` / missing: under way, amount unknown (a band sweeps the pill). */
  progress?: number | null;
  /** The accessible name of the whole track (`Pipeline`). Default `Steps` / `단계`. */
  label?: string;
  /** The line under the dots (`Review · 3 of 5`). Default true. */
  caption?: boolean;
}

/** `ui-select` detail (cancelable): the person picked a dot. The host decides what that opens; nothing moves here. */
export interface StepTrackSelect {
  index: number;
  id: string | undefined;
}

/** One dot of the wake: its index and when it moves (0 = first crossed). */
export interface StepWake {
  index: number;
  order: number;
}

const STATUSES: ReadonlySet<string> = new Set<StepStatus>(['done', 'current', 'todo', 'failed', 'skipped']);

const STRINGS = {
  en: {
    steps: 'Steps',
    of: (n: number, m: number) => `${n} of ${m}`,
    failedAt: (l: string) => `Failed at ${l}`,
    status: { done: 'Done', current: 'Current', todo: 'To do', failed: 'Failed', skipped: 'Skipped' } as Record<
      StepStatus,
      string
    >,
  },
  ko: {
    steps: '단계',
    of: (n: number, m: number) => `${m}단계 중 ${n}`,
    failedAt: (l: string) => `${l}에서 실패`,
    status: { done: '완료', current: '진행 중', todo: '대기', failed: '실패', skipped: '건너뜀' } as Record<
      StepStatus,
      string
    >,
  },
};

/** The wake reaches this many dots back from the landing (bencho's `1 + round(wake * 7)` at wake ≈ 0.43). */
const WAKE_REACH = 4;
/** Each dot of the wake starts this long after the one crossed before it; one bump lasts WAKE_MS (styles.ts). */
const WAKE_STAGGER = 60;
const WAKE_MS = 420;

const list = (v: unknown): StepTrackStep[] =>
  Array.isArray(v) ? v.filter((s): s is StepTrackStep => !!s && typeof s === 'object') : [];
const own = (s: StepTrackStep | null | undefined): StepStatus | undefined =>
  s && STATUSES.has(s.status as string) ? s.status : undefined;
const finished = (st: StepStatus | undefined): boolean => st === 'done' || st === 'skipped';
const words = (v: unknown): string => String(v ?? '').trim();

// ── Pure helpers ────────────────────────────────────────────────────────────

/**
 * The index of the step under way, or -1. A finite `current` wins (floored; outside the steps = none); else the
 * first step marked `current`, else the first one not done or skipped (a failed step counts); all done → -1.
 */
export function stepCurrent(steps: readonly StepTrackStep[], current?: number | null): number {
  if (typeof current === 'number' && Number.isFinite(current)) {
    const i = Math.floor(current);
    return i >= 0 && i < steps.length ? i : -1;
  }
  const marked = steps.findIndex((s) => own(s) === 'current');
  return marked >= 0 ? marked : steps.findIndex((s) => !finished(own(s)));
}

/**
 * What each dot draws: the step at the current index is `current` (or `failed` when it failed); the others keep
 * their own status, and one without (or a stray `current`) is done before the current step and to do after it.
 * With no current step they read to do — or done when `current` points past the end.
 */
export function stepStates(steps: readonly StepTrackStep[], current?: number | null): StepStatus[] {
  const cur = stepCurrent(steps, current);
  const past = cur < 0 && typeof current === 'number' && current >= steps.length;
  return steps.map((s, i) => {
    const st = own(s);
    if (i === cur) return st === 'failed' ? 'failed' : 'current';
    if (st && st !== 'current') return st;
    return (cur >= 0 ? i < cur : past) ? 'done' : 'todo';
  });
}

/**
 * The line under the dots: `Review · 3 of 5` (the current step and its place); `Failed at Review` for a failed
 * current; with none current, `Done · 5 of 5` when every step is done or skipped, `Failed at …` for the first failed
 * one, else `To do · 2 of 5` (steps finished). Korean with `lang` `ko` (`리뷰 · 5단계 중 3`). Empty without steps.
 */
export function stepCaption(steps: readonly StepTrackStep[], current?: number | null, lang?: string): string {
  const t = lang === 'ko' ? STRINGS.ko : STRINGS.en;
  const n = steps.length;
  if (!n) return '';
  const label = (i: number) => words(steps[i]?.label);
  const failedAt = (i: number) => (label(i) ? t.failedAt(label(i)) : t.status.failed);
  const cur = stepCurrent(steps, current);
  const st = stepStates(steps, current);
  if (cur >= 0) {
    if (st[cur] === 'failed') return failedAt(cur);
    return label(cur) ? `${label(cur)} · ${t.of(cur + 1, n)}` : t.of(cur + 1, n);
  }
  const failed = st.indexOf('failed');
  if (failed >= 0) return failedAt(failed);
  const fin = st.filter(finished).length;
  return `${fin === n ? t.status.done : t.status.todo} · ${t.of(fin, n)}`;
}

/**
 * The wake of a move from step `from` to step `to`: the dots the bar crossed (the one it left, then each one it
 * passed — never the landing), at most `reach` of them counted back from the landing, in the order crossed.
 * Empty for no move or an index below 0.
 */
export function stepWake(from: number, to: number, reach = 1): StepWake[] {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from === to) return [];
  const r = Number.isFinite(reach) ? Math.max(1, Math.floor(reach)) : 1;
  const dir = to > from ? 1 : -1;
  const start = Math.abs(to - from) > r ? to - dir * r : from;
  const out: StepWake[] = [];
  for (let i = start; i !== to; i += dir) out.push({ index: i, order: out.length });
  return out;
}

/** How far into the current step, clamped to 0 … 1; `null` when unknown (not a finite number). */
export function stepProgress(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null;
}

/**
 * `<ui-step-track>` — where a pipeline is and how far into the current step: one dot per step (done in ink, to do
 * faint, failed red, skipped a hollow ring) and the current step a wide pill whose fill is its progress — or a
 * sweeping band when the amount is unknown — with a caption under it (`Review · 3 of 5`). When the current step
 * changes the two slot widths ease to their new place and the dots the bar crossed stand up and settle in order,
 * the landing pill last (the wake; none on the first render or under reduced motion). `interactive` turns the dots
 * into buttons on a roving tabindex that send a cancelable `ui-select`. Data-driven: the host owns the steps.
 *
 * Ported from bencho.dev's “Step player” (MIT, © 2026 Lorenzo Cabra — https://bencho.dev/blocks/step-player).
 */
export class UiStepTrack extends UiElement<StepTrackData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return ['lang', 'size', 'interactive'];
  }

  /** The current index the last render drew (undefined before the first): a change starts the wake. */
  #drawn: number | undefined;
  /** Dots in the wake now: index → how it moves (crossed, or the landing pill) and when. */
  #wake = new Map<number, { kind: 'cross' | 'land'; order: number }>();
  #wakeTimer: ReturnType<typeof setTimeout> | 0 = 0;
  /** The roving stop the person focused (-1: the current step's). */
  #stop = -1;

  constructor() {
    super();
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    this.root.addEventListener('focusin', (e) => {
      const hit = (e.target as Element | null)?.closest?.<HTMLElement>('.st-hit');
      if (hit) this.#stop = Number(hit.dataset.i);
    });
    this.root.addEventListener('animationend', (e) => this.#settle(e.target));
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override disconnectedCallback(): void {
    this.#clearWake();
  }

  /** The index of the step under way now (-1: none). */
  get current(): number {
    return stepCurrent(list(this.data?.steps), this.data?.current);
  }

  get #lang(): StepTrackLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  /** Patched in place: the slot widths and the fill transition, the dots keep their nodes (and focus). */
  protected override update(): void {
    const cur = this.current;
    const was = this.#drawn;
    this.#drawn = cur;
    if (was !== undefined && was !== cur) {
      this.#stop = -1;
      this.#startWake(was, cur);
    }
    const key = (this.root.activeElement as HTMLElement | null)?.dataset?.key;
    morphInto(this.content, this.render());
    this.updated();
    if (key && !this.root.activeElement) {
      this.$$('[data-key]')
        .find((el) => el.dataset.key === key)
        ?.focus({ preventScroll: true });
    }
  }

  // ── The wake ──────────────────────────────────────────────────────────────

  #startWake(from: number, to: number): void {
    this.#clearWake();
    if (from < 0 || to < 0 || prefersReducedMotion()) return;
    const crossed = stepWake(from, to, WAKE_REACH);
    for (const w of crossed) this.#wake.set(w.index, { kind: 'cross', order: w.order });
    this.#wake.set(to, { kind: 'land', order: crossed.length });
    // animationend lets each dot go; this catches a tab in the background or a dot that never painted.
    this.#wakeTimer = setTimeout(() => this.#clearWake(), crossed.length * WAKE_STAGGER + WAKE_MS + 200);
  }

  #clearWake(): void {
    if (this.#wakeTimer) clearTimeout(this.#wakeTimer);
    this.#wakeTimer = 0;
    this.#wake.clear();
    for (const dot of this.$$('.st-dot[data-wake]')) this.#unwake(dot);
  }

  #unwake(dot: HTMLElement): void {
    dot.removeAttribute('data-wake');
    dot.removeAttribute('style');
  }

  /** A dot's bump ended: it leaves the wake (and the timer goes with the last one). */
  #settle(target: EventTarget | null): void {
    const dot = target as HTMLElement | null;
    if (!dot?.classList?.contains('st-dot') || !dot.hasAttribute('data-wake')) return;
    this.#wake.delete(Number(dot.closest<HTMLElement>('.st-step')?.dataset.i));
    this.#unwake(dot);
    if (!this.#wake.size) this.#clearWake();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  protected render(): string {
    const d = this.data;
    const steps = list(d?.steps);
    if (!steps.length) return '';
    const t = STRINGS[this.#lang];
    const cur = stepCurrent(steps, d?.current);
    const states = stepStates(steps, d?.current);
    const progress = stepProgress(d?.progress);
    const interactive = this.hasAttribute('interactive');
    const stop = this.#stop >= 0 && this.#stop < steps.length ? this.#stop : Math.max(0, cur);
    const items = steps
      .map((s, i) => {
        const st = states[i];
        const label = words(s.label);
        const here = i === cur;
        const key = typeof s.id === 'string' && s.id ? `id:${s.id}` : `i:${i}`;
        const w = this.#wake.get(i);
        const fill = here && st === 'current' ? this.#fill(label || t.status.current, progress) : '';
        const dot = `<span${attrs({
          class: 'st-dot',
          part: 'dot',
          'data-wake': w?.kind,
          style: w ? `--i: ${w.order}` : undefined,
        })}>${fill}</span>`;
        const said = `<span class="sr-only">${esc(label ? `${label}, ${t.status[st]}` : t.status[st])}</span>`;
        const hit = interactive
          ? `<button${attrs({
              type: 'button',
              class: 'st-hit',
              title: label || undefined,
              tabindex: i === stop ? '0' : '-1',
              'aria-current': here ? 'step' : undefined,
              'data-key': `st-${key}`,
              'data-i': i,
            })}>${said}</button>`
          : '';
        return `<li${attrs({
          class: 'st-step',
          part: 'step',
          'data-mk': key,
          'data-st': st,
          'data-cur': here,
          'data-i': i,
          'aria-current': here && !interactive ? 'step' : undefined,
        })}>${hit}${dot}${interactive ? '' : said}</li>`;
      })
      .join('');
    // The caption reads in the failed tone when it says "Failed at …" (the same rule as stepCaption).
    const failed = cur >= 0 ? states[cur] === 'failed' : states.includes('failed');
    const caption =
      d?.caption === false
        ? ''
        : `<p${attrs({ class: 'st-cap', part: 'caption', 'data-failed': failed })}>${esc(
            stepCaption(steps, d?.current, this.#lang),
          )}</p>`;
    return `<div class="st" part="track"><ol class="st-list" part="list" aria-label="${escAttr(
      words(d?.label) || t.steps,
    )}">${items}</ol>${caption}</div>`;
  }

  /** The current pill's fill: a progressbar at the progress, or a sweeping band (busy) when it is unknown. */
  #fill(label: string, p: number | null): string {
    if (p === null) {
      return `<span${attrs({
        class: 'st-busy',
        part: 'fill',
        role: 'progressbar',
        'aria-label': label,
        'aria-busy': 'true',
      })}><span class="st-band"></span></span>`;
    }
    return `<span${attrs({
      class: 'st-fill',
      part: 'fill',
      role: 'progressbar',
      'aria-label': label,
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'aria-valuenow': Math.round(p * 100),
      style: `width: ${Math.round(p * 1000) / 10}%`,
    })}></span>`;
  }

  // ── Interaction ───────────────────────────────────────────────────────────

  #onClick(e: Event): void {
    const hit = (e.target as Element | null)?.closest?.<HTMLElement>('.st-hit');
    if (!hit) return;
    const index = Number(hit.dataset.i);
    const step = list(this.data?.steps)[index];
    if (!step) return;
    const detail: StepTrackSelect = { index, id: typeof step.id === 'string' ? step.id : undefined };
    if (!this.emit('ui-select', detail)) return;
    this.sound('select', { emphasis: 'subtle' }, e);
  }

  /** Roving tabindex over the dots: the arrows move (wrapping), Home / End jump; Enter / Space press the button. */
  #onKey(e: KeyboardEvent): void {
    const hit = (e.target as Element | null)?.closest?.<HTMLElement>('.st-hit');
    if (!hit) return;
    const hits = this.$$<HTMLElement>('.st-hit');
    const none = hits.map(() => false);
    const at = hits.indexOf(hit);
    const rtl = getComputedStyle(this).direction === 'rtl';
    let next: number;
    switch (e.key) {
      case 'ArrowRight':
        next = rovingIndex(none, at, rtl ? -1 : 1);
        break;
      case 'ArrowLeft':
        next = rovingIndex(none, at, rtl ? 1 : -1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = hits.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const to = hits[next];
    if (!to) return;
    for (const h of hits) h.setAttribute('tabindex', h === to ? '0' : '-1');
    to.focus();
  }
}

define('ui-step-track', UiStepTrack);

declare global {
  interface HTMLElementTagNameMap {
    'ui-step-track': UiStepTrack;
  }
}
