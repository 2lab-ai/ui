/**
 * `createMoodReader()` — the mood reader on a page, without a framework: it listens to the pointer, presses, scrolling,
 * typing (only whether a key deleted) and sent forms inside its scope, feeds them to a {@link MoodCore}, and hands
 * back a reading every 66 ms while there is something to read. Calm and still for 3 s, it stops its timer; the next
 * input wakes it. A hidden tab gives one `away` reading and no more until it is shown again. Nothing leaves the page:
 * the only thing it stores is the person's pace (two numbers), in localStorage under `baselineKey`.
 *
 * The name and options follow Libraries.dev's Mood recognition kit (`createMoodReader({ model, scope, onReading })`)
 * as its page documents them; there is no `model` here (see `types.ts`).
 */
import { emptyReading, MoodCore, moodBaseline, moodReactTo } from './core';
import { moodElementKey, moodFactsOf, moodIgnored, moodIsField, moodPath } from './facts';
import { AWAY_IDLE_MS, type MoodBaseline, type MoodReading, type MoodSignal, REACTION_MS } from './types';

export const DEFAULT_BASELINE_KEY = 'mood-baseline';
/** The baseline is written at most this often while reading (and once more on stop). */
const SAVE_EVERY_MS = 15_000;

export interface MoodReaderOptions {
  /** Where to listen: an element (its subtree, slotted light DOM included) or the whole document. Default document. */
  scope?: Element | Document;
  /** Called with each reading (every 66 ms while active). */
  onReading?: (reading: MoodReading) => void;
  /** The moods the reaction rises for: a list or a space-separated string. Default frustrated, confused and lost. */
  reactTo?: readonly MoodSignal[] | string;
  /** Where the person's pace is kept in localStorage; null or '' keeps it in memory only. Default `mood-baseline`. */
  baselineKey?: string | null;
  /** The clock, ms. Default `performance.now()`. */
  now?: () => number;
}

export interface MoodReader {
  /** Start listening. Safe to call twice. */
  start(): void;
  /** Stop listening and stepping, and store the person's pace. */
  stop(): void;
  /** Forget what was seen (the person's pace is kept). */
  reset(): void;
  /** Change the moods the reaction rises for. */
  setReactTo(v: readonly MoodSignal[] | string): void;
  readonly reading: MoodReading;
  readonly running: boolean;
  /** The engine underneath, for replays and tests. */
  readonly core: MoodCore;
}

function loadBaseline(key: string | null): Partial<MoodBaseline> | null {
  if (!key) return null;
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<MoodBaseline>) : null;
  } catch {
    return null;
  }
}

function saveBaseline(key: string | null, b: MoodBaseline): void {
  if (!key) return;
  try {
    globalThis.localStorage?.setItem(
      key,
      JSON.stringify({ v: 1, speed: Math.round(b.speed), pressGap: Math.round(b.pressGap), n: b.n }),
    );
  } catch {
    /* storage full or blocked: the pace stays in memory */
  }
}

export function createMoodReader(o: MoodReaderOptions = {}): MoodReader {
  const now = o.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const key = o.baselineKey === undefined ? DEFAULT_BASELINE_KEY : o.baselineKey || null;
  const doc: Document | null = typeof document !== 'undefined' ? document : null;
  const scope: Element | Document | null = o.scope ?? doc;
  const core = new MoodCore({ reactTo: moodReactTo(o.reactTo), baseline: moodBaseline(loadBaseline(key)), now: now() });
  let running = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let awayTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSave = now();
  let reading = emptyReading(now());

  const inScope = (path: readonly Element[]): boolean =>
    !moodIgnored(path) && (!scope || scope === doc || path.includes(scope as Element));

  const emit = (r: MoodReading) => {
    reading = r;
    o.onReading?.(r);
  };

  const tick = () => {
    timer = null;
    if (!running) return;
    const t = now();
    emit(core.step(t));
    if (core.baselineDirty && t - lastSave >= SAVE_EVERY_MS) {
      saveBaseline(key, core.baseline);
      core.baselineDirty = false;
      lastSave = t;
    }
    if (doc?.visibilityState === 'hidden') return;
    if (core.idle(t)) {
      // asleep until the next input, or until a minute without input reads as away
      if (!core.away(t) && !awayTimer) {
        awayTimer = setTimeout(
          () => {
            awayTimer = null;
            wake();
          },
          Math.max(0, core.lastInput + AWAY_IDLE_MS - t) + 20,
        );
      }
      return;
    }
    timer = setTimeout(tick, REACTION_MS);
  };

  const wake = () => {
    if (!running || timer) return;
    if (awayTimer) {
      clearTimeout(awayTimer);
      awayTimer = null;
    }
    timer = setTimeout(tick, 0);
  };

  const onMove = (e: Event) => {
    const p = e as PointerEvent;
    const path = moodPath(e);
    if (!inScope(path)) return;
    core.pointer(p.clientX, p.clientY, now(), moodFactsOf(path));
    wake();
  };
  const onDown = (e: Event) => {
    const p = e as PointerEvent;
    if (p.button > 0) return;
    const path = moodPath(e);
    if (!inScope(path)) return;
    const t = now();
    const facts = moodFactsOf(path);
    core.pointer(p.clientX, p.clientY, t, facts);
    core.press(p.clientX, p.clientY, t, facts);
    // a send pressed while its form is already invalid (forms that check on their own, without the browser's check)
    if (facts.submit && facts.invalid && !facts.disabled) core.sent(t, false);
    wake();
  };
  const onLeave = (e: Event) => {
    if (e.target !== scope) return;
    core.leave(now());
    wake();
  };
  const onKey = (e: Event) => {
    const k = e as KeyboardEvent;
    const path = moodPath(e);
    if (!inScope(path) || !moodIsField(path[0] ?? null)) return;
    const del = k.key === 'Backspace' || k.key === 'Delete';
    if (del || (typeof k.key === 'string' && k.key.length === 1)) core.key(del, now());
    wake();
  };
  const onChange = (e: Event) => {
    if (!inScope(moodPath(e))) return;
    core.change(now());
    wake();
  };
  const onInvalid = (e: Event) => {
    if (!inScope(moodPath(e))) return;
    core.sent(now(), false);
    wake();
  };
  const onSubmit = (e: Event) => {
    const path = moodPath(e);
    if (!inScope(path)) return;
    const form = e.target as HTMLFormElement | null;
    // a form that checks itself marks its fields after the submit handler: look a moment later
    setTimeout(() => {
      if (!running) return;
      const bad = !!form?.querySelector?.('[aria-invalid="true"]');
      core.sent(now(), !bad);
      wake();
    }, 50);
  };
  const onScroll = (e: Event) => {
    const t = e.target;
    if (doc && (t === doc || t === doc.documentElement)) {
      if (scope !== doc) return;
      core.scroll('page', globalThis.scrollY ?? doc.documentElement.scrollTop, now());
    } else if (t instanceof Element) {
      if (!inScope(moodPath(e, t))) return;
      core.scroll(moodElementKey(t), t.scrollTop, now());
    } else return;
    wake();
  };
  const onOut = (e: Event) => {
    if ((e as MouseEvent).relatedTarget) return;
    core.windowOut(true, now());
    wake();
  };
  const onVisibility = () => {
    core.hidden(doc?.visibilityState === 'hidden', now());
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (doc?.visibilityState === 'hidden') emit(core.step(now()));
    else wake();
  };

  const scoped: Array<[string, (e: Event) => void]> = [
    ['pointermove', onMove],
    ['pointerdown', onDown],
    ['keydown', onKey],
    ['input', onChange],
    ['change', onChange],
    ['invalid', onInvalid],
    ['submit', onSubmit],
    ['scroll', onScroll],
  ];
  const opts: AddEventListenerOptions = { capture: true, passive: true };

  return {
    start() {
      if (running || !scope) return;
      running = true;
      for (const [type, fn] of scoped) scope.addEventListener(type, fn, opts);
      if (scope !== doc) scope.addEventListener('pointerleave', onLeave, opts);
      doc?.addEventListener('mouseout', onOut, opts);
      doc?.addEventListener('visibilitychange', onVisibility);
      core.hidden(doc?.visibilityState === 'hidden', now());
      emit(core.step(now()));
    },
    stop() {
      if (!running || !scope) return;
      running = false;
      for (const [type, fn] of scoped) scope.removeEventListener(type, fn, opts);
      if (scope !== doc) scope.removeEventListener('pointerleave', onLeave, opts);
      doc?.removeEventListener('mouseout', onOut, opts);
      doc?.removeEventListener('visibilitychange', onVisibility);
      if (timer) clearTimeout(timer);
      if (awayTimer) clearTimeout(awayTimer);
      timer = null;
      awayTimer = null;
      if (core.baselineDirty) {
        saveBaseline(key, core.baseline);
        core.baselineDirty = false;
      }
    },
    reset() {
      core.reset(now());
      emit(core.step(now()));
      wake();
    },
    setReactTo(v) {
      core.reactTo = new Set(moodReactTo(v));
      wake();
    },
    get reading() {
      return reading;
    },
    get running() {
      return running;
    },
    core,
  };
}
