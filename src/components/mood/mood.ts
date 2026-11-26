import { define, UiElement } from '../../core/element';
import { emptyReading, moodReactTo } from './engine/core';
import { createMoodReader, DEFAULT_BASELINE_KEY, type MoodReader } from './engine/reader';
import type { Mood, MoodReading, MoodSignal } from './engine/types';
import { styles } from './styles';

/** Where `<ui-mood>` reads: its own subtree (`self`) or the whole page (`page`). */
export type MoodScope = 'self' | 'page';

export interface MoodData {
  /** The moods the reaction (`--mood`) rises for. Default frustrated, confused and lost. */
  reactTo?: readonly MoodSignal[];
  /** Where the person's pace is kept in localStorage; null keeps it in memory only. Default `mood-baseline`. */
  baselineKey?: string | null;
  /** `self` (default): only input inside the element; `page`: the whole document, as the Libraries.dev kit reads. */
  scope?: MoodScope;
  /** Stop reading (the reading eases back to calm). */
  paused?: boolean;
}

/** What the element reads with now: `data` first, then the attributes. */
export interface MoodOptions {
  reactTo: MoodSignal[];
  baselineKey: string | null;
  scope: MoodScope;
  paused: boolean;
}

/** `ui-mood-change` detail: the reading the mood changed in. */
export type MoodChange = MoodReading;

/** Resolve the data and attributes into what the element reads with. */
export function moodOptions(d: MoodData | undefined, attr: (name: string) => string | null): MoodOptions {
  const scopeAttr = (d?.scope ?? attr('scope') ?? '').trim().toLowerCase();
  const keyAttr = attr('baseline-key');
  let baselineKey: string | null;
  if (d && 'baselineKey' in d) baselineKey = d.baselineKey ? String(d.baselineKey) : null;
  else if (keyAttr !== null) baselineKey = keyAttr.trim() || null;
  else baselineKey = DEFAULT_BASELINE_KEY;
  return {
    reactTo: moodReactTo(d?.reactTo ?? attr('react-to')),
    baselineKey,
    scope: scopeAttr === 'page' ? 'page' : 'self',
    paused: d?.paused ?? attr('paused') !== null,
  };
}

/**
 * `<ui-mood>` — an interface that reads the user's mood. Wrap the part of the screen that can block someone (a Pay
 * locked behind a checkbox, a strict form, a long settings page); the element reads how the pointer moves, presses,
 * scrolling and typing behave inside it and says whether the person seems frustrated, confused or lost, so the screen
 * can bring forward what helps. It sets `mood="…"` on itself and `--mood` (the reaction, 0 … 1) for the CSS inside,
 * and fires `ui-mood-change` when the mood changes.
 *
 * Ported from Libraries.dev's Mood recognition (https://libraries.dev/mood-recognition): its API — the moods, the
 * reading's fields, `reactTo`, `baselineKey`, `data-mood-ignore`, `--mood`, `createMoodReader()` — and its documented
 * behaviour. Not its model or kit: `MoodRecognition.json`, the React kit and the loader on that page are under the
 * Libraries.dev Model License and are not shipped, copied or downloaded. The reading here is a heuristic of this
 * library's own (`engine/`): the fast signals as the page describes them, and one formula per mood instead of the
 * trained trees.
 */
export class UiMood extends UiElement<MoodData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return ['scope', 'react-to', 'baseline-key', 'paused'];
  }

  #reader: MoodReader | null = null;
  #readerFor = '';
  #reading: MoodReading = emptyReading();
  #mood: Mood | null = null;

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (old !== value && name !== 'mood') this.#sync();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#sync();
  }

  override disconnectedCallback(): void {
    this.#reader?.stop();
    this.#reader = null;
    this.#readerFor = '';
    super.disconnectedCallback();
  }

  override set data(value: MoodData | undefined) {
    super.data = value;
    this.#sync();
  }
  override get data(): MoodData | undefined {
    return super.data;
  }

  /** The last reading. */
  get reading(): MoodReading {
    return this.#reading;
  }

  /** The mood now: frustrated, confused, lost, away, or null while calm. */
  get mood(): Mood | null {
    return this.#mood;
  }

  /** The reaction now, 0 … 1 (also `--mood`). */
  get reaction(): number {
    return this.#reading.reaction;
  }

  get paused(): boolean {
    return this.hasAttribute('paused');
  }
  set paused(on: boolean) {
    this.toggleAttribute('paused', !!on);
  }

  /** The reader underneath (its `core` takes replayed input), or null while disconnected or paused. */
  get reader(): MoodReader | null {
    return this.#reader;
  }

  /** What the element reads with now. */
  get options(): MoodOptions {
    return moodOptions(this.data, (n) => this.getAttribute(n));
  }

  /** Forget what was seen — call it when the flow moves on to a new step. The person's pace is kept. */
  reset(): void {
    this.#reader?.reset();
  }

  protected render(): string {
    return '<slot></slot>';
  }

  #sync(): void {
    if (!this.isConnected) return;
    const o = this.options;
    const id = `${o.scope}|${o.baselineKey ?? ''}`;
    if (o.paused) {
      this.#reader?.stop();
      this.#reader = null;
      this.#readerFor = '';
      this.#apply(emptyReading(this.#reading.at));
      return;
    }
    if (this.#reader && this.#readerFor === id) {
      this.#reader.setReactTo(o.reactTo);
      return;
    }
    this.#reader?.stop();
    this.#readerFor = id;
    this.#reader = createMoodReader({
      scope: o.scope === 'page' ? document : this,
      reactTo: o.reactTo,
      baselineKey: o.baselineKey,
      onReading: (r) => this.#apply(r),
    });
    this.#reader.start();
  }

  #apply(r: MoodReading): void {
    this.#reading = r;
    this.style.setProperty('--mood', r.reaction.toFixed(3));
    this.dispatchEvent(new CustomEvent<MoodReading>('ui-mood-reading', { detail: r }));
    if (r.mood === this.#mood) return;
    this.#mood = r.mood;
    if (r.mood) this.setAttribute('mood', r.mood);
    else this.removeAttribute('mood');
    this.notify<MoodChange>('ui-mood-change', r);
  }
}

define('ui-mood', UiMood);

declare global {
  interface HTMLElementTagNameMap {
    'ui-mood': UiMood;
  }
}
