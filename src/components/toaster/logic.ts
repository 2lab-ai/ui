/** Pure helpers for `<ui-toaster>`: input normalisation, timing, the stack layout and the swipe decision. */

/** neutral = no icon; loading = a spinner and no timer (promise toasts start here). */
export type ToastTone = 'neutral' | 'success' | 'error' | 'warning' | 'loading';

export type ToastPlacement = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

/** A button on the toast. Pressing it emits `ui-action { id, actionId }`; not cancelled → the toast closes. */
export interface ToastAction {
  /** Echoed as `detail.actionId`. */
  id: string;
  /** Button text. Defaults to the built-in word for `retry`, `undo` and `open` (다시 시도 / 실행 취소 / 열기). */
  label?: string;
}

/** A quiet link next to the action (opens in a new tab, http/https/mailto only). It does not close the toast. */
export interface ToastLink {
  label: string;
  href: string;
}

/** What one toast says. */
export interface ToastInput {
  /** Pass an existing id to update that toast in place (the timer restarts, the text crossfades). */
  id?: string;
  title: string;
  description?: string;
  tone?: ToastTone;
  action?: ToastAction;
  link?: ToastLink;
  /** Time on screen in ms. `Infinity` (or 0) keeps it until closed. Default: the toaster's duration; errors twice that. */
  duration?: number;
}

/** `show(title, options)` / `toast(title, options)`. */
export type ToastOptions = Omit<ToastInput, 'title'>;

/** A promise message: a title, a title with details, or a function of the result / the error. */
export type ToastMessage = string | Omit<ToastInput, 'id' | 'tone'>;
export type ToastPromiseMessage<V> = ToastMessage | ((value: V) => ToastMessage);
export interface ToastPromiseMessages<T> {
  loading?: ToastMessage;
  success?: ToastPromiseMessage<T>;
  error?: ToastPromiseMessage<unknown>;
}

/** Element configuration (`el.data`). Everything is optional; a bare `<ui-toaster>` works. */
export interface ToasterData {
  /** Corner or edge of the stack on screens 600px and wider. */
  placement?: ToastPlacement;
  /** Edge of the stack under 600px wide, where it spans the width with 12px gutters. */
  mobilePlacement?: 'top-center' | 'bottom-center';
  /** Default time on screen in ms (errors stay twice as long). */
  duration?: number;
  /** Toasts shown at once; the rest wait with a paused timer behind a “+N”. */
  visible?: number;
  /** Always fanned out, instead of on hover / keyboard focus / tap. */
  expand?: boolean;
  /** Distance from the edges in px (24, or 20 inline). Under 600px always 12. */
  offset?: number;
  /** Key (KeyboardEvent.key or .code) that moves focus to the newest toast. null turns it off. */
  hotkey?: string | null;
  /** The 1px line along the bottom that runs down with the timer. */
  hairline?: boolean;
  /** The small close button (on hover and focus; always on touch screens). */
  closeButton?: boolean;
  /** Name of the region for screen readers (the hotkey is added). */
  label?: string;
}

export const DEFAULT_DURATION = 4000;
export const DEFAULT_VISIBLE = 3;
/** Fanned-out gap, collapsed peek (px) and the shrink per card behind. */
export const STACK_GAP = 10;
export const STACK_PEEK = 10;
export const STACK_SHRINK = 0.05;
/** Under this host width the stack spans the width and moves to mobilePlacement. */
export const NARROW_PX = 600;

const TONES: ReadonlySet<string> = new Set(['neutral', 'success', 'error', 'warning', 'loading']);
const PLACEMENTS: ReadonlySet<string> = new Set([
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]);

export function normTone(t: unknown): ToastTone {
  return TONES.has(t as string) ? (t as ToastTone) : 'neutral';
}

/** Which edge the stack sits on and where along it. Narrow hosts use the mobile placement, spanning the width. */
export function parsePlacement(
  placement: unknown,
  narrow = false,
  mobile: unknown = 'top-center',
): { y: 'top' | 'bottom'; x: 'left' | 'center' | 'right' } {
  if (narrow) return { y: mobile === 'bottom-center' ? 'bottom' : 'top', x: 'center' };
  const p = PLACEMENTS.has(placement as string) ? (placement as ToastPlacement) : 'bottom-right';
  const [y, x] = p.split('-') as ['top' | 'bottom', 'left' | 'center' | 'right'];
  return { y, x };
}

/**
 * Effective time on screen: loading never times out, `Infinity` / 0 / negative keeps it open, a finite duration
 * wins, else the toaster's default — doubled for errors so a failure can be read (and retried).
 */
export function toastDuration(tone: ToastTone, duration: unknown, fallback: unknown = DEFAULT_DURATION): number {
  if (tone === 'loading') return Number.POSITIVE_INFINITY;
  if (duration !== undefined && duration !== null && duration !== '') {
    const n = Number(duration);
    if (n === Number.POSITIVE_INFINITY || (Number.isFinite(n) && n <= 0)) return Number.POSITIVE_INFINITY;
    if (Number.isFinite(n)) return n;
  }
  const f = Number(fallback);
  const base = f === Number.POSITIVE_INFINITY || (Number.isFinite(f) && f > 0) ? f : DEFAULT_DURATION;
  return tone === 'error' ? base * 2 : base;
}

export function visibleCount(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_VISIBLE;
}

/** Text a host string becomes: `null`/`undefined` → '' (never the word “undefined”). */
export function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v);
}

/** A message (string, object or function of the settled value) as toast fields. */
export function messageFields<V>(
  msg: ToastPromiseMessage<V> | undefined,
  value: V,
  fallbackTitle: string,
  fallbackDescription?: string,
): Omit<ToastInput, 'id' | 'tone'> {
  let m: ToastMessage | undefined;
  try {
    m = typeof msg === 'function' ? msg(value) : msg;
  } catch {
    m = undefined;
  }
  if (m === undefined || m === null || m === '') return { title: fallbackTitle, description: fallbackDescription };
  if (typeof m === 'string') return { title: m };
  return { ...m, title: str(m.title) || fallbackTitle };
}

/** A thrown value as one readable line: Error.message, a string, else nothing. */
export function errorText(e: unknown): string | undefined {
  if (e instanceof Error) return e.message || undefined;
  if (typeof e === 'string') return e || undefined;
  if (e && typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string')
    return (e as { message: string }).message || undefined;
  return undefined;
}

/** Where one toast sits: lifted `y` px off the edge, scaled, its box height, stacking order. */
export interface StackSlot {
  y: number;
  scale: number;
  /** Box height; 0 = not measured yet (auto). */
  height: number;
  z: number;
  /** A collapsed card behind the front one: its content is hidden, only its edge peeks out. */
  behind: boolean;
  /** Past the visible count: waits invisible (and paused) behind the stack. */
  hidden: boolean;
}

/**
 * The stack, newest first. Collapsed: the front toast at the edge, up to `visible - 1` cards behind it, each
 * peeking 10px further out and 5% smaller, all as tall as the front one. Expanded: a list with 10px gaps, every
 * toast at its own measured height. Returns each slot and the height the list needs.
 */
export function stackLayout(
  heights: readonly number[],
  opts: { expanded: boolean; visible?: number; gap?: number; frontHeight?: number },
): { slots: StackSlot[]; height: number } {
  const n = heights.length;
  const max = visibleCount(opts.visible);
  const gap = opts.gap ?? STACK_GAP;
  const front = heights[0] || opts.frontHeight || 0;
  const slots: StackSlot[] = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const h = heights[i] || 0;
    const hidden = i >= max;
    if (opts.expanded) {
      slots.push({ y: acc, scale: 1, height: h, z: n - i, behind: false, hidden });
    } else {
      const r = Math.min(i, max - 1);
      slots.push({
        y: r * STACK_PEEK,
        scale: 1 - r * STACK_SHRINK,
        height: i === 0 ? h : front,
        z: n - i,
        behind: i > 0,
        hidden,
      });
    }
    if (!hidden) acc += h + gap;
  }
  const shown = Math.min(n, max);
  const height = !n ? 0 : opts.expanded ? Math.max(0, acc - gap) : front + STACK_PEEK * (shown - 1);
  return { slots, height };
}

/** Rubber band for a drag away from the dismiss direction: it gives, less and less. */
export function rubber(delta: number): number {
  return Math.sign(delta) * Math.abs(delta) ** 0.7 * 0.6;
}

export interface SwipeSample {
  /** Offset along the locked axis, px. */
  v: number;
  /** Event time, ms. */
  at: number;
}

/**
 * Whether a released swipe dismisses: sideways in either direction, or vertically toward the stack's edge
 * (`edge` 1 = bottom, -1 = top); farther than 64px, or flicked faster than 0.45 px/ms in the drag's direction.
 */
export function swipeDismisses(samples: readonly SwipeSample[], axis: 'x' | 'y', edge: 1 | -1): boolean {
  const last = samples[samples.length - 1];
  if (!last) return false;
  const first = samples[0];
  const vel = last.at > first.at ? (last.v - first.v) / (last.at - first.at) : 0;
  const toward = axis === 'x' || last.v * edge > 0;
  const flick = Math.abs(vel) > 0.45 && Math.sign(vel) === Math.sign(last.v);
  return toward && (Math.abs(last.v) > 64 || flick);
}

/** Opacity while dragging toward a dismiss: fades with distance, never below 0.25. */
export function swipeOpacity(delta: number, size: number): number {
  return Math.max(0.25, 1 - Math.abs(delta) / (Math.max(1, size) * 1.1));
}
