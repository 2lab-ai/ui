import { beforeEach, describe, expect, it } from 'vitest';
import tokens from '../../core/tokens.json';
import { type DeckNavData, type DeckNavPage, deckBehind, deckClamp, deckStep, type UiDeckNav } from './deck-nav';
import { styles } from './styles';

function mount(data: DeckNavData | undefined, attrs: Record<string, string> = {}): UiDeckNav {
  const el = document.createElement('ui-deck-nav') as UiDeckNav;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiDeckNav, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = <E extends Element = HTMLElement>(el: UiDeckNav, s: string) =>
  Array.from(el.shadowRoot!.querySelectorAll<E>(s));
const prev = (el: UiDeckNav) => q<HTMLButtonElement>(el, '.dn-btn[data-dir="-1"]')!;
const next = (el: UiDeckNav) => q<HTMLButtonElement>(el, '.dn-btn[data-dir="1"]')!;
const pos = (el: UiDeckNav) => q(el, '.dn-pos')?.textContent;
const pages = (el: UiDeckNav) => {
  const got: DeckNavPage[] = [];
  el.addEventListener('ui-page', (e) => got.push((e as CustomEvent<DeckNavPage>).detail));
  return got;
};
const key = (target: Element, k: string, init: KeyboardEventInit = {}) => {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(ev);
  return ev;
};
const flush = () => Promise.resolve();

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('pure helpers', () => {
  it('clamps an index into the deck', () => {
    expect(deckClamp(3, 5)).toBe(3);
    expect(deckClamp(9, 5)).toBe(4);
    expect(deckClamp(-2, 5)).toBe(0);
    expect(deckClamp(2.7, 5)).toBe(2);
    expect(deckClamp(Number.NaN, 5)).toBe(0);
    expect(deckClamp(2, 0)).toBe(0);
  });

  it('steps one card, stopping at the ends unless it wraps', () => {
    expect(deckStep(1, 5, 1)).toBe(2);
    expect(deckStep(1, 5, -1)).toBe(0);
    expect(deckStep(0, 5, -1)).toBe(-1);
    expect(deckStep(4, 5, 1)).toBe(-1);
    expect(deckStep(0, 5, -1, true)).toBe(4);
    expect(deckStep(4, 5, 1, true)).toBe(0);
    expect(deckStep(0, 1, 1, true)).toBe(-1);
    expect(deckStep(0, 0, 1)).toBe(-1);
    expect(deckStep(9, 3, -1)).toBe(1);
  });

  it('draws up to two cards behind', () => {
    expect([0, 1, 2, 3, 9].map(deckBehind)).toEqual([0, 0, 1, 2, 2]);
  });
});

describe('<ui-deck-nav> rendering', () => {
  it('shows ‹ n / m › with chevrons, a labelled group and a spoken position', () => {
    const el = mount({ index: 1, count: 5 });
    expect(pos(el)).toBe('2 / 5');
    expect(q(el, '.dn-pos')?.getAttribute('aria-hidden')).toBe('true');
    expect(q(el, '.dn-say')?.textContent).toBe('2 of 5');
    expect(q(el, '.dn-say')?.getAttribute('role')).toBe('status');
    expect(q(el, '.dn-nav')?.getAttribute('role')).toBe('group');
    expect(q(el, '.dn-nav')?.getAttribute('aria-label')).toBe('Cards');
    expect(prev(el).getAttribute('aria-label')).toBe('Previous');
    expect(next(el).getAttribute('aria-label')).toBe('Next');
    expect(prev(el).querySelector('svg')?.getAttribute('data-icon')).toBe('chevron-left');
    expect(next(el).querySelector('svg')?.getAttribute('data-icon')).toBe('chevron-right');
    expect(prev(el).type).toBe('button');
    expect(el.hasAttribute('data-single')).toBe(false);
    expect(q(el, '.dn-peek')).toBeNull();
  });

  it('hides itself with one card or none, and comes back with two', () => {
    const el = mount({ index: 0, count: 1 });
    expect(el.hasAttribute('data-single')).toBe(true);
    expect(q(el, '.dn')).toBeNull();
    el.data = { index: 0, count: 0 };
    el.renderNow();
    expect(el.hasAttribute('data-single')).toBe(true);
    el.data = { index: 0, count: 2 };
    el.renderNow();
    expect(el.hasAttribute('data-single')).toBe(false);
    expect(pos(el)).toBe('1 / 2');
    expect(mount(undefined).hasAttribute('data-single')).toBe(true);
    expect(styles).toContain(':host([data-single]) { display: none; }');
  });

  it('clamps a host index outside the deck', () => {
    expect(pos(mount({ index: 7, count: 3 }))).toBe('3 / 3');
    expect(pos(mount({ index: -1, count: 3 }))).toBe('1 / 3');
  });

  it('disables (aria-disabled, still focusable) the end buttons unless it wraps', () => {
    const first = mount({ index: 0, count: 3 });
    expect(prev(first).getAttribute('aria-disabled')).toBe('true');
    expect(prev(first).disabled).toBe(false);
    expect(next(first).hasAttribute('aria-disabled')).toBe(false);
    const last = mount({ index: 2, count: 3 });
    expect(next(last).getAttribute('aria-disabled')).toBe('true');
    const wrap = mount({ index: 0, count: 3 }, { wrap: '' });
    expect(prev(wrap).hasAttribute('aria-disabled')).toBe(false);
  });

  it('names where each button goes from titles, escaped', () => {
    const evil = '"><img src=x onerror=alert(1)>';
    const el = mount({ index: 1, count: 3, titles: ['Fix the upload retry', 'Now', evil], label: evil });
    expect(prev(el).title).toBe('Previous: Fix the upload retry');
    expect(next(el).title).toBe(`Next: ${evil}`);
    expect(q(el, '.dn-nav')?.getAttribute('aria-label')).toBe(evil);
    expect(q(el, 'img')).toBeNull();
    const end = mount({ index: 0, count: 2, titles: ['A', 'B'] });
    expect(prev(end).title).toBe('Previous');
  });

  it('peek draws the cards behind, count-aware and decorative', () => {
    const two = mount({ index: 0, count: 2 }, { peek: '' });
    const peek = q(two, '.dn-peek')!;
    expect(peek.getAttribute('aria-hidden')).toBe('true');
    expect(peek.dataset.behind).toBe('1');
    expect(qa(two, '.dn-edge[data-on]')).toHaveLength(1);
    const edges = qa(two, '.dn-edge');
    two.data = { index: 0, count: 6 };
    two.renderNow();
    expect(q(two, '.dn-peek')?.dataset.behind).toBe('2');
    expect(qa(two, '.dn-edge[data-on]')).toHaveLength(2);
    // The same nodes: the far edge fades in instead of popping.
    expect(qa(two, '.dn-edge')).toEqual(edges);
    two.removeAttribute('peek');
    two.renderNow();
    expect(q(two, '.dn-peek')).toBeNull();
  });
});

describe('<ui-deck-nav> events', () => {
  it('sends ui-page on prev / next and moves itself when not cancelled', async () => {
    const el = mount({ index: 1, count: 4 });
    const got = pages(el);
    next(el).click();
    await flush();
    expect(got).toEqual([{ index: 2, from: 1 }]);
    expect(pos(el)).toBe('3 / 4');
    expect(q(el, '.dn-say')?.textContent).toBe('3 of 4');
    expect(el.index).toBe(2);
    prev(el).click();
    prev(el).click();
    await flush();
    expect(got.slice(1)).toEqual([
      { index: 1, from: 2 },
      { index: 0, from: 1 },
    ]);
    expect(pos(el)).toBe('1 / 4');
  });

  it('ui-page bubbles, is composed and cancelable; preventDefault keeps the index', async () => {
    const el = mount({ index: 1, count: 4 });
    let ev: CustomEvent | undefined;
    const cancel = (e: Event) => {
      ev = e as CustomEvent;
      e.preventDefault();
    };
    document.addEventListener('ui-page', cancel);
    next(el).click();
    await flush();
    document.removeEventListener('ui-page', cancel);
    expect(ev?.bubbles).toBe(true);
    expect(ev?.composed).toBe(true);
    expect(ev?.cancelable).toBe(true);
    expect(pos(el)).toBe('2 / 4');
    expect(el.index).toBe(1);
  });

  it('the host owns the index: new data wins over the element’s own step', async () => {
    const el = mount({ index: 0, count: 4 });
    next(el).click();
    await flush();
    expect(pos(el)).toBe('2 / 4');
    el.data = { index: 3, count: 4 };
    el.renderNow();
    expect(pos(el)).toBe('4 / 4');
    expect(el.index).toBe(3);
    // A shorter deck clamps the element's own index too.
    el.data = { ...el.data, count: 2 };
    el.renderNow();
    expect(pos(el)).toBe('2 / 2');
  });

  it('does nothing at the ends, and wraps round with `wrap`', async () => {
    const el = mount({ index: 0, count: 3 });
    const got = pages(el);
    prev(el).click();
    expect(el.prev()).toBe(false);
    expect(got).toEqual([]);
    el.setAttribute('wrap', '');
    prev(el).click();
    await flush();
    expect(got).toEqual([{ index: 2, from: 0 }]);
    expect(pos(el)).toBe('3 / 3');
    next(el).click();
    await flush();
    expect(got[1]).toEqual({ index: 0, from: 2 });
  });

  it('prev() / next() page as a press would', async () => {
    const el = mount({ index: 0, count: 3 });
    const got = pages(el);
    expect(el.next()).toBe(true);
    await flush();
    expect(got).toEqual([{ index: 1, from: 0 }]);
    el.addEventListener('ui-page', (e) => e.preventDefault(), { once: true });
    expect(el.next()).toBe(false);
    expect(el.index).toBe(1);
  });
});

describe('<ui-deck-nav> keyboard', () => {
  it('←/→ page while a button is focused; the key does not scroll the page', async () => {
    const el = mount({ index: 1, count: 3 });
    const got = pages(el);
    const b = next(el);
    b.focus();
    const right = key(b, 'ArrowRight');
    await flush();
    expect(right.defaultPrevented).toBe(true);
    expect(got).toEqual([{ index: 2, from: 1 }]);
    expect(pos(el)).toBe('3 / 3');
    // Focus stays on the same (now end, aria-disabled) button.
    expect(el.shadowRoot!.activeElement).toBe(b);
    expect(b.getAttribute('aria-disabled')).toBe('true');
    key(b, 'ArrowRight');
    expect(got).toHaveLength(1);
    key(b, 'ArrowLeft');
    key(b, 'ArrowLeft');
    await flush();
    expect(got.slice(1)).toEqual([
      { index: 1, from: 2 },
      { index: 0, from: 1 },
    ]);
  });

  it('ignores other keys, modified arrows and handled events', () => {
    const el = mount({ index: 1, count: 3 });
    const got = pages(el);
    const b = prev(el);
    expect(key(b, 'ArrowUp').defaultPrevented).toBe(false);
    key(b, 'ArrowLeft', { altKey: true });
    key(b, 'ArrowLeft', { metaKey: true });
    const handled = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true, cancelable: true });
    handled.preventDefault();
    b.dispatchEvent(handled);
    expect(got).toEqual([]);
  });
});

describe('lang="ko"', () => {
  it('speaks Korean', () => {
    const el = mount({ index: 1, count: 5, titles: ['첫 카드', '둘', '셋'] }, { lang: 'ko' });
    expect(q(el, '.dn-nav')?.getAttribute('aria-label')).toBe('카드');
    expect(prev(el).getAttribute('aria-label')).toBe('이전');
    expect(next(el).getAttribute('aria-label')).toBe('다음');
    expect(prev(el).title).toBe('이전: 첫 카드');
    expect(q(el, '.dn-say')?.textContent).toBe('5개 중 2번째');
    expect(pos(el)).toBe('2 / 5');
  });

  it('switches language when the attribute changes', async () => {
    const el = mount({ index: 0, count: 2 });
    el.setAttribute('lang', 'ko');
    await flush();
    expect(next(el).getAttribute('aria-label')).toBe('다음');
  });
});

describe('styles', () => {
  it('use tokens only — no hex or rgb literals — and known token names', () => {
    const css = styles.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(rgba?|hsla?)\(/i);
    const known = new Set([...Object.keys(tokens.light), ...Object.keys(tokens.shared)]);
    for (const m of css.matchAll(/var\(--([a-z0-9-]+)/g)) expect(known.has(m[1]), m[1]).toBe(true);
  });

  it('gate hover to fine pointers without movement, give 44px coarse targets, and stop motion when reduced', () => {
    const hover = styles.slice(styles.indexOf('@media (hover: hover) and (pointer: fine)'));
    expect(hover.slice(0, hover.indexOf('\n}\n'))).not.toMatch(/transform|translate|scale\(/);
    expect(styles.slice(0, styles.indexOf('@media (hover: hover)'))).not.toMatch(/:hover/);
    expect(styles).toMatch(/\.dn-btn \{ width: 44px; height: 44px; \}/);
    expect(styles).toContain('font-variant-numeric: tabular-nums');
    const rm = styles.slice(styles.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rm).toContain('transform: none');
  });
});
