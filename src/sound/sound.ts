/**
 * `@2lab.ai/ui/sound` — the interface-sound policy every element follows. It loads no audio and stays silent until
 * the host page hands it a player and turns it on (`setSound`); `@2lab.ai/ui/sound-cuelume` is the player.
 *
 * Ported from Morphin UI's `sound` (MIT, Ivan Oliinyk — https://morphin.dev/docs/sound) for Web Components: the
 * React provider becomes one page-wide setting, the nested `enabled={false}` provider a `data-ui-sound="off"`
 * ancestor, the cue queue is the same.
 */

/** The interface sounds elements ask for, one per job (Cuelume's fourteen cues). */
export type SoundCue =
  | 'tap'
  | 'type'
  | 'select'
  | 'toggle'
  | 'open'
  | 'close'
  | 'navigate'
  | 'success'
  | 'warning'
  | 'error'
  | 'loading'
  | 'ready'
  | 'attention'
  | 'count';

export interface SoundOptions {
  /** How much the action matters. */
  emphasis?: 'subtle' | 'normal' | 'strong';
  /** Which way the interaction moved: a switch turning off, a step back. */
  direction?: 'forward' | 'back';
  /** Multiplier for this cue only, 0 to 1. */
  volume?: number;
  /** What did the activating. */
  input?: 'mouse' | 'touch' | 'pen' | 'keyboard';
  /** Which key was typed, for `type`. */
  key?: 'printable' | 'space' | 'delete' | 'enter';
  /** How long a `count` runs, in milliseconds. */
  duration?: number;
}

/** Plays a cue. `cuelumeSound` from `@2lab.ai/ui/sound-cuelume` is one; any function of this shape works. */
export type SoundPlayer = (cue: SoundCue, options?: SoundOptions) => void;

export interface SoundSettings {
  /** What plays the cues. `null` removes it (silent). */
  player?: SoundPlayer | null;
  /** The user's choice. Off until the host turns it on. */
  enabled?: boolean;
  /** Keystroke sounds in text fields. Off unless asked for: they are the most divisive cue. */
  typing?: boolean;
}

/** Every cue, from the least specific to the most (an outcome beats an open beats a tap). */
export const SOUND_CUES: readonly SoundCue[] = [
  'tap',
  'type',
  'count',
  'navigate',
  'close',
  'open',
  'select',
  'toggle',
  'loading',
  'ready',
  'success',
  'warning',
  'error',
  'attention',
];

/** The attribute that marks a host control's cue (`bindSound`) — or, as `"off"`, a region where nothing sounds. */
export const SOUND_ATTR = 'data-ui-sound';
/** How much a marked control matters (`subtle` / `normal` / `strong`), read from it or the nearest ancestor. */
export const SOUND_EMPHASIS_ATTR = 'data-ui-sound-emphasis';

interface SoundState {
  player: SoundPlayer | null;
  enabled: boolean;
  typing: boolean;
}

// One record per page under a registered symbol: two copies of the library (two versions, or a page that loads
// both the flat files and a bundle) read and write the same choice.
const KEY = Symbol.for('@2lab.ai/ui/sound');
function state(): SoundState {
  const g = globalThis as unknown as Record<symbol, SoundState | undefined>;
  let s = g[KEY];
  if (!s) {
    s = { player: null, enabled: false, typing: false };
    g[KEY] = s;
  }
  return s;
}

/**
 * Turns interface sounds on or off for every element on the page. Silent until a player is set and `enabled` is
 * true. Keep the user's choice in your app and pass it here; sound is never the only feedback, since many people
 * keep it off. Fields left out keep their value.
 */
export function setSound(settings: SoundSettings): void {
  const s = state();
  const p = settings?.player;
  if (p === null || typeof p === 'function') s.player = p;
  if (typeof settings?.enabled === 'boolean') s.enabled = settings.enabled;
  if (typeof settings?.typing === 'boolean') s.typing = settings.typing;
}

/** The page's current sound settings. */
export function soundSettings(): Readonly<SoundState> {
  const { player, enabled, typing } = state();
  return { player, enabled, typing };
}

/** The parent in the composed tree: across a shadow root to its host. */
function up(n: Node): Node | null {
  if (n.parentNode) return n.parentNode;
  return typeof ShadowRoot !== 'undefined' && n instanceof ShadowRoot ? n.host : null;
}

/** True when `from` sits inside a `data-ui-sound="off"` region (crossing shadow roots). */
function muted(from: Node | null | undefined): boolean {
  for (let n: Node | null = from ?? null; n; n = up(n)) {
    if ((n as Element).getAttribute?.(SOUND_ATTR) === 'off') return true;
  }
  return false;
}

/** Whether a cue raised at `from` would reach the player now. */
export function soundOn(from?: Node | null): boolean {
  const s = state();
  return s.enabled && s.player !== null && !muted(from);
}

// Cues raised by one interaction compete, and the most specific one plays: an item that is picked also closes its
// menu, a trigger button also opens its dialog. Outcomes beat everything.
const RANK: Record<SoundCue, number> = {
  tap: 0,
  type: 0,
  count: 1,
  navigate: 2,
  close: 3,
  open: 4,
  select: 5,
  toggle: 5,
  loading: 6,
  ready: 6,
  success: 7,
  warning: 7,
  error: 7,
  attention: 8,
};
/** A tap that follows a richer cue this soon belongs to the same gesture (a menu opens on press, the click comes after). */
const GESTURE_MS = 250;
/** The same cue again this soon is dropped, so a dragged slider ticks instead of buzzing. */
const REPEAT_MS = 50;
/** How long a tap waits for a richer cue of the same click. */
const TAP_HOLD_MS = 24;

let pending: { cue: SoundCue; options?: SoundOptions } | null = null;
let lastRich: number | undefined;
const lastPlayed = new Map<SoundCue, number>();
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
/** `last` happened less than `ms` before `t` (a clock that went back — a reset test clock — is not recent). */
const within = (t: number, last: number | undefined, ms: number) => last !== undefined && t >= last && t - last < ms;

function flush(): void {
  const next = pending;
  pending = null;
  const s = state();
  if (!next || !s.enabled || !s.player) return;
  const t = now();
  if (next.cue === 'tap' && within(t, lastRich, GESTURE_MS)) return;
  if (within(t, lastPlayed.get(next.cue), REPEAT_MS)) return;
  lastPlayed.set(next.cue, t);
  if (RANK[next.cue] > RANK.type) lastRich = t;
  try {
    s.player(next.cue, next.options);
  } catch {
    // A player that fails (no Web Audio, a blocked context) never breaks the interaction that asked for it.
  }
}

/**
 * Plays a cue through the page's player, or does nothing when sound is off, `from` is inside a quiet region, or
 * the cue is `type` and typing is off. Call it from event handlers, never from a render or for a value the app set.
 */
export function playSound(cue: SoundCue, options?: SoundOptions, from?: Node | null): void {
  if (!Object.hasOwn(RANK, cue) || !soundOn(from)) return;
  if (cue === 'type' && !state().typing) return;
  if (pending && RANK[pending.cue] > RANK[cue]) return;
  const waiting = pending !== null;
  pending = { cue, options };
  // A tap waits a moment: a menu opens just after the press, so its open should replace the tap. Anything richer
  // plays on the next tick.
  if (cue === 'tap') {
    if (!waiting) setTimeout(flush, TAP_HOLD_MS);
  } else setTimeout(flush, 0);
}

/**
 * True while the page is inside a user's gesture (the browser's transient activation), or when the browser cannot
 * say. For a change the element did not start itself — a dialog the host opened — this tells a click that opened it
 * (sound) from a timer or a stream that did (silence).
 */
export function userGesture(): boolean {
  const ua = (globalThis.navigator as Navigator | undefined)?.userActivation;
  return ua ? ua.isActive : true;
}

/** @internal Forget the queue (pending cue, last plays) — tests only, so each starts a fresh gesture. */
export function resetSoundQueue(): void {
  pending = null;
  lastRich = undefined;
  lastPlayed.clear();
}

/** What did the activating, read from a click, pointer or key event. */
export function soundInput(event?: Event | null): SoundOptions['input'] {
  if (!event) return undefined;
  if (typeof KeyboardEvent !== 'undefined' && event instanceof KeyboardEvent) return 'keyboard';
  // change, submit or a custom event says nothing about what did the activating.
  if (typeof MouseEvent === 'undefined' || !(event instanceof MouseEvent)) return undefined;
  const e = event as Partial<PointerEvent>;
  if (e.pointerType === 'mouse' || e.pointerType === 'touch' || e.pointerType === 'pen') return e.pointerType;
  return e.detail === 0 ? 'keyboard' : 'mouse';
}

type Field = HTMLInputElement | HTMLTextAreaElement;
function isField(t: EventTarget | null): t is Field {
  return (
    (typeof HTMLInputElement !== 'undefined' && t instanceof HTMLInputElement) ||
    (typeof HTMLTextAreaElement !== 'undefined' && t instanceof HTMLTextAreaElement)
  );
}

/**
 * The key a keystroke typed into a text field, or nothing when it edits no text: a shortcut, an arrow or modifier,
 * Enter in a one-line field (it submits), deleting at the edge of the text, a password, a read-only field, or an
 * IME composition. `field` defaults to the element the listener sits on.
 */
export function typedKey(
  event: KeyboardEvent,
  field: EventTarget | null = event.currentTarget ?? event.target,
): SoundOptions['key'] {
  if (!isField(field) || event.isComposing || field.readOnly || field.disabled) return undefined;
  if (field instanceof HTMLInputElement && field.type === 'password') return undefined;
  const { key } = event;
  // A held key repeats: only Backspace / Delete keep sounding, as they keep deleting.
  if (event.repeat && key !== 'Backspace' && key !== 'Delete') return undefined;
  if (key === 'Backspace' || key === 'Delete') {
    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? 0;
    const edge = key === 'Backspace' ? start > 0 : end < field.value.length;
    return end - start > 0 || edge ? 'delete' : undefined;
  }
  if (key === 'Enter') return field instanceof HTMLTextAreaElement ? 'enter' : undefined;
  if (event.ctrlKey || event.metaKey || event.altKey) return undefined;
  if (key === ' ') return 'space';
  return key.length === 1 ? 'printable' : undefined;
}

const EMPHASES = new Set(['subtle', 'normal', 'strong']);

/** The innermost marked element on the event's path, and its cue (`tap` when the value is empty). */
function marked(e: Event): { el: Element; cue: SoundCue | 'off' } | null {
  for (const n of e.composedPath()) {
    const v = (n as Element).getAttribute?.(SOUND_ATTR);
    if (v === null || v === undefined) continue;
    if (v === 'off') return { el: n as Element, cue: 'off' };
    if (v === '' || Object.hasOwn(RANK, v)) return { el: n as Element, cue: (v || 'tap') as SoundCue };
    return null;
  }
  return null;
}

function disabled(el: Element): boolean {
  return (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true';
}

/** A toggle's new state: a native checkbox's `checked`, else `aria-pressed` / `aria-checked` after the click. */
function toggled(el: Element): SoundOptions['direction'] {
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio'))
    return el.checked ? 'forward' : 'back';
  const v = el.getAttribute('aria-pressed') ?? el.getAttribute('aria-checked');
  return v === 'true' ? 'forward' : v === 'false' ? 'back' : undefined;
}

/** Native checkable controls and selects report a choice through `change`; their click only opens or flips them. */
function changes(el: Element): boolean {
  return (
    (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) ||
    el instanceof HTMLSelectElement
  );
}

function optionsFor(el: Element, cue: SoundCue, e: Event): SoundOptions | undefined {
  const o: SoundOptions = {};
  const emph = el.closest(`[${SOUND_EMPHASIS_ATTR}]`)?.getAttribute(SOUND_EMPHASIS_ATTR);
  if (emph && EMPHASES.has(emph)) o.emphasis = emph as SoundOptions['emphasis'];
  if (cue === 'toggle') {
    const dir = toggled(el);
    if (dir) o.direction = dir;
  }
  if (e.type === 'click') o.input = soundInput(e);
  return Object.keys(o).length ? o : undefined;
}

const bound = new WeakMap<Node, { holders: number; stop: () => void }>();

/**
 * Sounds the host page's own controls (the light-DOM kit's buttons, chips, switches, links): a click on an element
 * marked `data-ui-sound="<cue>"` plays that cue (`tap` when the value is empty), the innermost marked element
 * deciding; a native checkbox, radio or select plays on `change`; a text field marked `type` sounds keystrokes
 * while typing is on. `data-ui-sound-emphasis` on the control or an ancestor sets how much it matters. Listeners are
 * delegated, so controls added later just work. Returns a function that stops listening.
 */
export function bindSound(root: Document | Element | ShadowRoot = globalThis.document): () => void {
  if (!root) return () => {};
  const held = bound.get(root);
  if (held) {
    held.holders++;
    return once(root);
  }
  const ac = new AbortController();
  const opts = { signal: ac.signal, capture: false };
  const handle = (e: Event, want: 'click' | 'change') => {
    const m = marked(e);
    if (!m || m.cue === 'off' || m.cue === 'type' || disabled(m.el)) return;
    if (changes(m.el) !== (want === 'change')) return;
    playSound(m.cue, optionsFor(m.el, m.cue, e), m.el);
  };
  root.addEventListener('click', (e) => handle(e, 'click'), opts);
  root.addEventListener('change', (e) => handle(e, 'change'), opts);
  root.addEventListener(
    'keydown',
    (e) => {
      const m = marked(e);
      if (!m || m.cue !== 'type' || !isField(m.el)) return;
      // The field the key went to is the marked element, wherever this listener sits.
      const key = typedKey(e as KeyboardEvent, m.el);
      if (key) playSound('type', { key }, m.el);
    },
    opts,
  );
  bound.set(root, { holders: 1, stop: () => ac.abort() });
  return once(root);
}

function once(root: Node): () => void {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const b = bound.get(root);
    if (!b) return;
    if (--b.holders > 0) return;
    b.stop();
    bound.delete(root);
  };
}
