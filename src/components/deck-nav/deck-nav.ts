import { define, UiElement } from '../../core/element';
import { attrs, esc, escAttr } from '../../core/html';
import { morphInto } from '../../core/morph';
import { icon } from '../../icons/icons';
import { styles } from './styles';

export interface DeckNavData {
  /** 0-based index of the card in front. Owned by the host. */
  index: number;
  /** Cards in the deck. With 1 or none the element hides itself. */
  count: number;
  /** A name per card: the buttons’ tooltips say where they go (`Previous: Fix the upload retry`). */
  titles?: string[];
  /** Accessible name of the control group. Default `Cards`. */
  label?: string;
}

/** `ui-page` detail: the index asked for and the index it leaves. */
export interface DeckNavPage {
  index: number;
  from: number;
}

const STRINGS = {
  en: {
    label: 'Cards',
    prev: 'Previous',
    next: 'Next',
    to: (dir: string, name: string) => `${dir}: ${name}`,
    pos: (i: number, n: number) => `${i} of ${n}`,
  },
  ko: {
    label: '카드',
    prev: '이전',
    next: '다음',
    to: (dir: string, name: string) => `${dir}: ${name}`,
    pos: (i: number, n: number) => `${n}개 중 ${i}번째`,
  },
};
type Strings = (typeof STRINGS)['en'];

const int = (v: unknown): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n : 0;
};

// ── Pure helpers ────────────────────────────────────────────────────────────

/** An index inside the deck: an integer in [0, count − 1] (0 for an empty deck). */
export function deckClamp(index: number, count: number): number {
  const n = Math.max(0, int(count));
  return n ? Math.min(n - 1, Math.max(0, int(index))) : 0;
}

/** The index one step (`dir` ±1) from `index`, wrapping round the deck when `wrap`; -1 when there is none. */
export function deckStep(index: number, count: number, dir: 1 | -1, wrap = false): number {
  const n = Math.max(0, int(count));
  if (n < 2) return -1;
  const to = deckClamp(index, n) + (dir < 0 ? -1 : 1);
  if (to >= 0 && to < n) return to;
  return wrap ? (to + n) % n : -1;
}

/** Cards drawn behind the front one: up to 2. */
export function deckBehind(count: number): number {
  return Math.min(2, Math.max(0, int(count) - 1));
}

/**
 * `<ui-deck-nav>` — ‹ n / m › for a deck of cards the host shows one at a time: previous / next icon buttons and the
 * position, ←/→ while focused, a cancelable `ui-page`, and with `peek` up to two thin edges under the controls that
 * suggest the cards stacked behind the front one. Hidden while the deck has one card or none.
 */
export class UiDeckNav extends UiElement<DeckNavData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang', 'wrap', 'peek'];
  }

  #index = 0;
  #seen: DeckNavData | undefined;

  constructor() {
    super();
    this.root.addEventListener('click', (e) => {
      const b = (e.target as Element | null)?.closest?.('.dn-btn') as HTMLElement | null;
      if (b) this.#go(b.dataset.dir === '-1' ? -1 : 1);
    });
    this.root.addEventListener('keydown', (e) => {
      const ke = e as KeyboardEvent;
      if (ke.defaultPrevented || ke.altKey || ke.ctrlKey || ke.metaKey) return;
      if (ke.key !== 'ArrowLeft' && ke.key !== 'ArrowRight') return;
      if (!(ke.target as Element | null)?.closest?.('.dn-nav')) return;
      ke.preventDefault();
      this.#go(ke.key === 'ArrowLeft' ? -1 : 1);
    });
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  get #t(): Strings {
    return this.getAttribute('lang') === 'ko' ? STRINGS.ko : STRINGS.en;
  }

  get #count(): number {
    return Math.max(0, int(this.data?.count));
  }

  /** The index shown now: the host’s, or the one this element moved to since the host last set data. */
  get index(): number {
    this.#sync();
    return this.#index;
  }

  /** Go back one card as if the person pressed ‹ (sends ui-page). Returns whether the index changed. */
  prev(): boolean {
    return this.#go(-1);
  }

  /** Go forward one card as if the person pressed › (sends ui-page). Returns whether the index changed. */
  next(): boolean {
    return this.#go(1);
  }

  #sync(): void {
    const d = this.data;
    if (d !== this.#seen) {
      this.#seen = d;
      this.#index = deckClamp(int(d?.index), this.#count);
    } else this.#index = deckClamp(this.#index, this.#count);
  }

  #go(dir: 1 | -1): boolean {
    this.#sync();
    const from = this.#index;
    const to = deckStep(from, this.#count, dir, this.hasAttribute('wrap'));
    if (to < 0 || !this.emit<DeckNavPage>('ui-page', { index: to, from })) return false;
    this.#index = to;
    this.requestRender();
    return true;
  }

  /** Patch in place: the focused button keeps its node, the edges fade in and out, the position speaks once. */
  protected override update(): void {
    this.#sync();
    this.toggleAttribute('data-single', this.#count < 2);
    morphInto(this.content, this.render());
    this.updated();
  }

  protected render(): string {
    const d = this.data;
    const n = this.#count;
    if (!d || n < 2) return '';
    const t = this.#t;
    const i = this.#index;
    const wrap = this.hasAttribute('wrap');
    const behind = deckBehind(n);
    const peek = this.hasAttribute('peek')
      ? `<div class="dn-peek" part="peek" aria-hidden="true" data-behind="${behind}"><i class="dn-edge" data-mk="far"${
          behind > 1 ? ' data-on' : ''
        }></i><i class="dn-edge" data-mk="near" data-on></i></div>`
      : '';
    const btn = (dir: 1 | -1) => {
      const to = deckStep(i, n, dir, wrap);
      const word = dir < 0 ? t.prev : t.next;
      const name = to >= 0 ? d.titles?.[to] : undefined;
      return `<button${attrs({
        type: 'button',
        class: 'dn-btn',
        'data-dir': String(dir),
        'data-key': dir < 0 ? 'dn-prev' : 'dn-next',
        'data-mk': dir < 0 ? 'dn-prev' : 'dn-next',
        'aria-label': word,
        'aria-disabled': to < 0 ? 'true' : undefined,
        title: typeof name === 'string' && name ? t.to(word, name) : word,
      })}>${icon(dir < 0 ? 'chevron-left' : 'chevron-right', { size: 14, stroke: 1.75 })}</button>`;
    };
    const nav = `<div class="dn-nav" part="nav" role="group" aria-label="${escAttr(d.label || t.label)}">${btn(-1)}<span class="dn-pos" aria-hidden="true">${
      i + 1
    } / ${n}</span><span class="dn-say sr-only" role="status">${esc(t.pos(i + 1, n))}</span>${btn(1)}</div>`;
    return `<div class="dn">${nav}${peek}</div>`;
  }
}

define('ui-deck-nav', UiDeckNav);

declare global {
  interface HTMLElementTagNameMap {
    'ui-deck-nav': UiDeckNav;
  }
}
