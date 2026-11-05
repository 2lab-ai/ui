import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { attrs, esc } from '../../core/html';
import { morphInto } from '../../core/morph';
import { icon } from '../../icons/icons';
import { SLIDE_BOX, SLIDE_MOTION, SLIDE_SPRINGS, slideSpring, styles } from './styles';

/** idle: ready to slide · busy: the host is doing it · done: it is done · failed: it did not go (then idle again). */
export type SlideState = 'idle' | 'busy' | 'done' | 'failed';
/** danger: the grip and its wash in the fail colour, for the actions that destroy something. */
export type SlideTone = 'neutral' | 'danger';
export type SlideLang = 'en' | 'ko';

export interface SlideConfirmData {
  /** What sliding does ("Slide to deploy to prod"). Also the slider's name. */
  label?: string;
  /** The words in the filled grip once it went through ("Deployed"). */
  doneLabel?: string;
  /** The words beside the spinner while the host works ("Deploying…"). */
  busyLabel?: string;
  /** The host's word on the action. Heard when you set `data`: see the docs. */
  state?: SlideState;
  tone?: SlideTone;
  disabled?: boolean;
  /** The share of the travel past which a release takes over to the end (0.5 … 1, default 0.85). */
  threshold?: number;
}

const STRINGS = {
  en: { label: 'Slide to confirm', done: 'Confirmed', busy: 'Working…', failed: 'Failed — try again' },
  ko: { label: '밀어서 확인', done: '확인됨', busy: '처리 중…', failed: '실패 — 다시 시도' },
};

/** A release past this share of the travel takes over to the end. */
export const SLIDE_THRESHOLD = 0.85;
const STATES: readonly SlideState[] = ['idle', 'busy', 'done', 'failed'];
const KEY_STEPS: Record<string, number> = {
  ArrowRight: 10,
  ArrowUp: 10,
  ArrowLeft: -10,
  ArrowDown: -10,
  PageUp: 25,
  PageDown: -25,
};
/** The failed shake, then the grip goes home (ms). */
const SHAKE_MS = 320;
/** How long the track keeps the fail tint (ms). */
const TINT_MS = 1100;
const SQUASH_EASE = 'cubic-bezier(0.33, 0.55, 0.2, 1)';
const { pad: PAD, grip: GRIP } = SLIDE_BOX;
const HOME_MS = SLIDE_MOTION.home.ms;
/** When the home spring comes back under its target: the end of its overshoot (ms). */
const REBOUND_MS = (() => {
  let ms = HOME_MS;
  while (ms < 1000 && slideSpring(SLIDE_SPRINGS.home, ms / 1000) >= 1) ms++;
  return ms;
})();

/** The threshold from a number or a numeric string, clamped to 0.5 … 1; 0.85 for anything else. */
export function slideThreshold(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? Math.min(1, Math.max(0.5, n)) : SLIDE_THRESHOLD;
}

/** How far along the travel `x` px is: 0 … 1, clamped; 0 when there is no travel. */
export function slideProgress(x: number, travel: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(travel) || travel <= 0) return 0;
  return Math.min(1, Math.max(0, x / travel));
}

/** Whether a release at `progress` goes through (at or past the threshold). */
export function slideCommits(progress: number, threshold?: unknown): boolean {
  return Number.isFinite(progress) && progress >= slideThreshold(threshold);
}

/**
 * The value (percent of the travel) a key moves the slider to: arrows ±10, Page Up / Down ±25, Home 0, End 100,
 * clamped to 0 … 100. `null` for any other key.
 */
export function slideKeyStep(key: string, value: number): number | null {
  if (key === 'Home') return 0;
  if (key === 'End') return 100;
  if (!Object.hasOwn(KEY_STEPS, key)) return null;
  const v = Number.isFinite(value) ? Math.round(value) : 0;
  return Math.min(100, Math.max(0, v + KEY_STEPS[key]));
}

/** A state the host may set, or undefined for anything else (no word). */
export function slideState(v: unknown): SlideState | undefined {
  return STATES.includes(v as SlideState) ? (v as SlideState) : undefined;
}

export function slideTone(v: unknown): SlideTone {
  return v === 'danger' ? 'danger' : 'neutral';
}

/**
 * The squash for a grip that comes home from `distance` px away. The home spring would pass the start by up to 8%
 * of the way; the grip stops there instead and gets narrower (up to 8%) and as much taller for as long as it would
 * have been past it. `null` when there is too little to show.
 */
export function slideSquash(distance: number): { delay: number; duration: number; frames: Keyframe[] } | null {
  if (!(distance > 0)) return null;
  const n = 8;
  const frames: Keyframe[] = [];
  let most = 1;
  for (let i = 0; i <= n; i++) {
    const t = (HOME_MS + ((REBOUND_MS - HOME_MS) * i) / n) / 1000;
    const past = Math.max(0, slideSpring(SLIDE_SPRINGS.home, t) - 1) * distance;
    const x = i === 0 || i === n ? 1 : 1 - Math.min(0.08, past / 110);
    most = Math.min(most, x);
    frames.push({ transform: `scale(${round(x)}, ${round(1 / x)})` });
  }
  return most > 0.998 ? null : { delay: HOME_MS, duration: REBOUND_MS - HOME_MS, frames };
}

const round = (v: number) => String(Math.round(v * 10000) / 10000);
const words = (v: unknown) => String(v ?? '').trim();

type Motion = '' | 'drag' | keyof typeof SLIDE_MOTION;

/**
 * `<ui-slide-confirm>` — slide to confirm an action that cannot be taken back. The person drags the grip across the
 * track (it follows the finger exactly; the offset is taken at the first move, so a press away from the grip never
 * makes it jump); a release past the mark lets it take over to the end and sends a cancelable `ui-confirm`. If that
 * goes through, the grip opens out behind itself to fill the track — its width and its place move together, so the
 * right edge stays put — and shows the done words; the host then sets `state` (busy → done, or failed: a shake, a
 * fail tint, and home again). A release short of the mark, Escape or a prevented `ui-confirm` springs it home.
 * role="slider" with the arrow keys, Page Up / Down, Home and End; reaching the end by keyboard confirms the same.
 *
 * Ported from bencho.dev's “Slide to confirm” (MIT, © 2026 Lorenzo Cabra — https://bencho.dev/blocks/slide-confirm).
 */
export class UiSlideConfirm extends UiElement<SlideConfirmData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return ['label', 'done-label', 'tone', 'disabled', 'threshold', 'lang'];
  }

  /** The share of the travel the grip has crossed (0 … 1). */
  #p = 0;
  /** How far the grip has opened out to fill the track: 0 or 1. */
  #q = 0;
  #motion: Motion = '';
  /** The pointer that holds the track; `grab` is its offset from the grip, taken at its first move. */
  #drag: { id: number; grab: number | null } | null = null;
  /** The last state the host set. */
  #heard: SlideState | undefined;
  /** How many times the host's state was taken in (a commit checks whether its listener answered). */
  #hears = 0;
  /** A commit waits for the host's answer: its next state counts even when it is the one it said last time. */
  #answer = false;
  /** What the element itself made of things since the host last spoke: a commit (done) or `reset()` (idle). */
  #local: 'done' | 'idle' | null = null;
  /** Released past the mark (or End): the grip is on its way to the end, `ui-confirm` comes when it is there. */
  #taking = false;
  /** The failed shake is running: the grip stays as it was until it goes home. */
  #failing = false;
  #tint = false;
  /** The track reads the failed words until the person tries again. */
  #note = false;
  #takeTimer: ReturnType<typeof setTimeout> | 0 = 0;
  #failTimer: ReturnType<typeof setTimeout> | 0 = 0;
  #tintTimer: ReturnType<typeof setTimeout> | 0 = 0;
  #fx: Animation | null = null;
  #squash: Animation | null = null;

  constructor() {
    super();
    const r = this.root;
    r.addEventListener('pointerdown', (e) => this.#onDown(e as PointerEvent));
    r.addEventListener('pointermove', (e) => this.#onMove(e as PointerEvent));
    r.addEventListener('pointerup', (e) => this.#onUp(e as PointerEvent));
    r.addEventListener('pointercancel', (e) => this.#onUp(e as PointerEvent));
    r.addEventListener('lostpointercapture', (e) => this.#onUp(e as PointerEvent));
    r.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    r.addEventListener('focusout', (e) => this.#onBlur(e));
  }

  override get data(): SlideConfirmData | undefined {
    return super.data;
  }

  /** The host speaks through `data`: its `state` is taken in here, once per assignment. */
  override set data(value: SlideConfirmData | undefined) {
    super.data = value;
    this.#hear(value?.state);
    this.#check();
  }

  /** What the slider shows now: idle, busy, done — or failed while it shakes. */
  get state(): SlideState {
    if (this.#failing) return 'failed';
    if (this.#local) return this.#local;
    return this.#heard === 'busy' || this.#heard === 'done' ? this.#heard : 'idle';
  }

  /** Back to the start, idle, whatever the host said last. */
  reset(): void {
    this.#endDrag();
    this.#cancelTake();
    this.#clearFail();
    this.#note = false;
    this.#answer = false;
    this.#local = 'idle';
    this.#home();
    this.requestRender();
  }

  attributeChangedCallback(): void {
    this.#check();
    this.requestRender();
  }

  override disconnectedCallback(): void {
    this.#endDrag();
    clearTimeout(this.#takeTimer);
    this.#takeTimer = 0;
    if (this.#taking) this.#p = 0;
    this.#taking = false;
    if (this.#failing) this.#p = this.#q = 0;
    this.#clearFail();
    this.#motion = '';
    this.#fx?.cancel();
    this.#squash?.cancel();
    this.#fx = this.#squash = null;
  }

  get #lang(): SlideLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #disabled(): boolean {
    const d = this.data?.disabled;
    return d === undefined ? this.hasAttribute('disabled') : !!d;
  }

  get #threshold(): number {
    return slideThreshold(this.data?.threshold ?? this.getAttribute('threshold'));
  }

  /** Whether the person can move it now. */
  get #live(): boolean {
    return !this.#disabled && !this.#taking && !this.#failing && this.#q === 0 && this.state === 'idle';
  }

  #words() {
    const d = this.data ?? {};
    const s = STRINGS[this.#lang];
    return {
      label: words(d.label ?? this.getAttribute('label')) || s.label,
      done: words(d.doneLabel ?? this.getAttribute('done-label')) || s.done,
      busy: words(d.busyLabel) || s.busy,
      failed: s.failed,
    };
  }

  #track(): HTMLElement | null {
    return this.$('.sc');
  }

  #grip(): HTMLElement | null {
    return this.$('.sc-grip');
  }

  // ── the host's word ───────────────────────────────────────────────────────

  #hear(raw: unknown): void {
    const s = slideState(raw);
    if (s === undefined || (s === this.#heard && !this.#answer)) return;
    this.#heard = s;
    this.#hears++;
    this.#answer = false;
    this.#local = null;
    this.#note = false;
    if (s === 'failed') this.#fail();
    else this.#clearFail();
    this.#reflect();
  }

  /** Fill the grip for busy / done, close it for idle. */
  #reflect(): void {
    if (this.#failing) return;
    const fill = this.state === 'busy' || this.state === 'done';
    if (fill && this.#q === 0) {
      this.#endDrag();
      this.#cancelTake();
      this.#p = 0;
      this.#q = 1;
      this.#motion = 'morph';
    } else if (!fill && this.#q === 1) this.#home();
  }

  /** Disabled while it was moving: let go and go home. */
  #check(): void {
    if (!this.#disabled || this.#q === 1 || this.#failing) return;
    if (!this.#drag && !this.#taking && this.#p === 0) return;
    this.#endDrag();
    this.#cancelTake();
    this.#home();
    this.requestRender();
  }

  #fail(): void {
    this.#endDrag();
    this.#cancelTake();
    this.#clearFail();
    this.#note = true;
    if (!this.isConnected) {
      this.#home();
      return;
    }
    this.#tint = true;
    this.#tintTimer = setTimeout(() => {
      this.#tintTimer = 0;
      this.#tint = false;
      this.requestRender();
    }, TINT_MS);
    if (prefersReducedMotion()) {
      this.#home();
      return;
    }
    this.#failing = true;
    this.#play(
      this.#track(),
      'fx',
      [0, -6, 5, -4, 3, -1, 0].map((x) => ({ transform: `translateX(${x}px)` })),
      {
        duration: SHAKE_MS,
        easing: 'ease-out',
      },
    );
    this.#failTimer = setTimeout(() => {
      this.#failTimer = 0;
      this.#failing = false;
      this.#home();
      this.requestRender();
    }, SHAKE_MS);
  }

  #clearFail(): void {
    clearTimeout(this.#failTimer);
    clearTimeout(this.#tintTimer);
    this.#failTimer = this.#tintTimer = 0;
    this.#failing = false;
    this.#tint = false;
  }

  // ── moves ─────────────────────────────────────────────────────────────────

  /** Home: a filled grip closes, a moved one springs back (and squashes against the start). */
  #home(): void {
    if (this.#q === 1) {
      this.#q = 0;
      this.#p = 0;
      this.#motion = 'close';
      return;
    }
    const from = this.#p;
    if (!(from > 0)) return;
    this.#p = 0;
    this.#motion = 'home';
    const box = this.#track()?.getBoundingClientRect();
    const squash = !prefersReducedMotion() && box ? slideSquash(from * (box.width - 2 * PAD - GRIP)) : null;
    if (squash) this.#play(this.#grip(), 'squash', squash.frames, { duration: squash.duration, delay: squash.delay });
  }

  /** Released past the mark, or End: take over to the end, then ask. */
  #commit(e: Event): void {
    this.#taking = true;
    this.#note = false;
    this.#p = 1;
    this.#motion = 'take';
    if (prefersReducedMotion()) this.#confirm(e);
    else this.#takeTimer = setTimeout(() => this.#confirm(e), SLIDE_MOTION.take.ms);
  }

  #confirm(e: Event): void {
    this.#takeTimer = 0;
    this.#taking = false;
    this.#answer = true;
    const hears = this.#hears;
    if (!this.emit('ui-confirm', {})) {
      this.#answer = false;
      this.#home();
      this.renderNow();
      return;
    }
    // A host that answered inside its listener (busy, most often) has the last word; otherwise it is done.
    if (this.#hears === hears) this.#local = 'done';
    this.#reflect();
    if (!prefersReducedMotion() && !this.#failing)
      this.#play(
        this.#track(),
        'fx',
        [
          { transform: 'scale(1)', easing: SQUASH_EASE },
          { transform: 'scale(0.974)', offset: 0.62, easing: SQUASH_EASE },
          { transform: 'scale(1)' },
        ],
        { duration: 420, delay: 100 },
      );
    this.sound('success', { emphasis: 'normal' }, e);
    this.renderNow();
  }

  #cancelTake(): void {
    if (!this.#taking) return;
    clearTimeout(this.#takeTimer);
    this.#takeTimer = 0;
    this.#taking = false;
  }

  #play(el: HTMLElement | null, slot: 'fx' | 'squash', frames: Keyframe[], opts: KeyframeAnimationOptions): void {
    if (!el || typeof el.animate !== 'function') return;
    const prev = slot === 'fx' ? this.#fx : this.#squash;
    prev?.cancel();
    const a = el.animate(frames, opts);
    // A cancelled animation rejects `finished`; nobody waits on it here.
    a.finished?.catch(() => {});
    if (slot === 'fx') this.#fx = a;
    else this.#squash = a;
  }

  // ── pointer ───────────────────────────────────────────────────────────────

  #onDown(e: PointerEvent): void {
    const t = (e.target as Element | null)?.closest?.<HTMLElement>('.sc');
    if (!t || e.button > 0 || this.#drag || !this.#live) return;
    this.#drag = { id: e.pointerId, grab: null };
    try {
      t.setPointerCapture(e.pointerId);
    } catch {
      // a synthetic or already-gone pointer: the drag still works while the pointer stays on the track
    }
    t.toggleAttribute('data-held', true);
  }

  #onMove(e: PointerEvent): void {
    const d = this.#drag;
    const t = this.#track();
    if (!d || e.pointerId !== d.id || !t) return;
    const box = t.getBoundingClientRect();
    const travel = box.width - 2 * PAD - GRIP;
    if (!(travel > 0)) return;
    const x = e.clientX - box.left - PAD;
    if (d.grab === null) {
      // The offset is taken here, at the first move — never at the press. Taken at the press, a press away from the
      // grip would set it to the grip's own middle and the first move would jump the grip the whole way. And from
      // where the grip is drawn now, so a grip caught on its way home does not snap to where it was going.
      const g = this.#grip()?.getBoundingClientRect();
      const at = g && g.width > 0 ? slideProgress(g.left - box.left - PAD, travel) : this.#p;
      d.grab = x - at * travel;
      this.#p = at;
      this.#motion = 'drag';
      this.#note = false;
      this.#squash?.cancel();
      this.renderNow();
      return;
    }
    const p = slideProgress(x - d.grab, travel);
    if (p === this.#p) return;
    this.#p = p;
    // Live, without a render: only the place and the value move.
    t.style.setProperty('--sc-p', round(p));
    const pct = Math.round(p * 100);
    const grip = this.#grip();
    grip?.setAttribute('aria-valuenow', String(pct));
    grip?.setAttribute('aria-valuetext', `${this.#words().label}: ${pct}%`);
  }

  #onUp(e: PointerEvent): void {
    const d = this.#drag;
    if (!d || e.pointerId !== d.id) return;
    this.#endDrag();
    if (d.grab !== null) {
      if (e.type === 'pointerup' && slideCommits(this.#p, this.#threshold)) this.#commit(e);
      else this.#home();
    }
    this.renderNow();
  }

  #endDrag(): void {
    const d = this.#drag;
    if (!d) return;
    this.#drag = null;
    const t = this.#track();
    t?.removeAttribute('data-held');
    try {
      if (t?.hasPointerCapture(d.id)) t.releasePointerCapture(d.id);
    } catch {
      // not captured
    }
  }

  // ── keys ──────────────────────────────────────────────────────────────────

  #onKey(e: KeyboardEvent): void {
    if (!(e.target as Element | null)?.closest?.('.sc-grip') || e.isComposing) return;
    if (e.key === 'Escape') {
      // Only when there is something to undo: otherwise Escape stays the page's (a dialog around it closes).
      if (this.#taking) this.#cancelTake();
      else if (!this.#live || this.#drag || this.#p === 0) return;
      e.preventDefault();
      this.#home();
      this.renderNow();
      return;
    }
    if (!this.#live || this.#drag) return;
    const next = slideKeyStep(e.key, this.#p * 100);
    if (next === null) return;
    e.preventDefault();
    this.#note = false;
    if (next >= 100) this.#commit(e);
    else {
      this.#p = next / 100;
      this.#motion = 'take';
    }
    this.renderNow();
  }

  #onBlur(e: Event): void {
    if (!(e.target as Element | null)?.closest?.('.sc-grip')) return;
    if (this.#drag || !this.#live || this.#p === 0) return;
    this.#home();
    this.renderNow();
  }

  // ── render ────────────────────────────────────────────────────────────────

  /** Patched in place, so a new value moves the grip on its transition and the live region keeps its node. */
  protected override update(): void {
    morphInto(this.content, this.render());
    this.updated();
  }

  protected render(): string {
    const w = this.#words();
    const state = this.state;
    const disabled = this.#disabled;
    const filled = this.#q === 1;
    const show = !filled ? '' : this.#failing ? 'fail' : state === 'busy' ? 'busy' : 'done';
    const pct = filled ? 100 : Math.round(this.#p * 100);
    const value =
      show === 'busy' ? w.busy : show === 'done' ? w.done : show === 'fail' ? w.failed : `${w.label}: ${pct}%`;
    const status = this.#failing || this.#note ? w.failed : state === 'done' ? w.done : '';
    const track = attrs({
      class: 'sc',
      part: 'track',
      'data-tone': slideTone(this.data?.tone ?? this.getAttribute('tone')),
      'data-motion': this.#motion || undefined,
      'data-held': !!this.#drag,
      'data-filled': filled,
      'data-show': show || undefined,
      'data-tint': this.#tint,
      'data-note': this.#note,
      'data-disabled': disabled,
      style: `--sc-p: ${round(this.#p)}; --sc-q: ${this.#q};`,
    });
    const grip = attrs({
      class: 'sc-grip',
      part: 'grip',
      role: 'slider',
      tabindex: 0,
      'data-key': 'grip',
      'aria-label': w.label,
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'aria-valuenow': pct,
      'aria-valuetext': value,
      'aria-disabled': disabled || filled || this.#failing ? 'true' : undefined,
    });
    return `<div${track}><span class="sc-say" aria-hidden="true"><span>${esc(this.#note ? w.failed : w.label)}</span></span><span class="sc-wash" aria-hidden="true"></span><div${grip}><span class="sc-arrow" aria-hidden="true">${icon(
      disabled ? 'lock' : 'arrow-right',
      { size: 20 },
    )}</span><span class="sc-done sc-end" aria-hidden="true">${icon('check', { size: 18, stroke: 1.75 })}<span>${esc(
      w.done,
    )}</span></span><span class="sc-busy sc-end" aria-hidden="true"><span class="sc-spin"></span><span>${esc(
      w.busy,
    )}</span></span><span class="sc-fail sc-end" aria-hidden="true">${icon('cross', { size: 18, stroke: 1.75 })}<span>${esc(
      w.failed,
    )}</span></span></div></div><span class="sr-only" role="status">${esc(status)}</span>`;
  }
}

define('ui-slide-confirm', UiSlideConfirm);

declare global {
  interface HTMLElementTagNameMap {
    'ui-slide-confirm': UiSlideConfirm;
  }
}
