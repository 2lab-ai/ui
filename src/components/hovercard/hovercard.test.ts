import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HOVERCARD_DELAY_MS,
  HOVERCARD_EXIT_MS,
  HOVERCARD_GRACE_MS,
  HOVERCARD_SWAP_MS,
  type HovercardDetail,
  hovercardDelay,
  hovercardSize,
  triggerOnPath,
  type UiHovercard,
} from './hovercard';
import { styles } from './styles';

const XSS = '<img src=x onerror=alert(1)>';

/** Three artifact tiles and one card for all of them; the card is filled on ui-open. */
function mount(attrs: Record<string, string> = {}): { el: UiHovercard; tiles: HTMLButtonElement[]; opened: Element[] } {
  const strip = document.createElement('div');
  const tiles = ['report.html', 'retries.png', 'notes.md'].map((name) => {
    const b = document.createElement('button');
    b.className = 'tile';
    b.dataset.name = name;
    b.innerHTML = `<span class="ic"></span><span class="nm"></span>`;
    b.querySelector('.nm')!.textContent = name;
    strip.append(b);
    return b;
  });
  const el = document.createElement('ui-hovercard') as UiHovercard;
  el.setAttribute('for', '.tile');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  const opened: Element[] = [];
  el.addEventListener('ui-open', (e) => {
    const t = (e as CustomEvent<HovercardDetail>).detail.trigger;
    opened.push(t);
    const p = document.createElement('p');
    p.className = 'peek';
    p.textContent = `Preview of ${(t as HTMLElement).dataset.name}`;
    el.replaceChildren(p);
  });
  document.body.append(strip, el);
  el.renderNow();
  return { el, tiles, opened };
}
const card = (el: UiHovercard) => el.shadowRoot!.querySelector<HTMLElement>('.hc-card')!;
const over = (t: Element, pointerType = 'mouse') =>
  t.dispatchEvent(new PointerEvent('pointerover', { pointerType, bubbles: true, composed: true }));
const leave = (t: Element, pointerType = 'mouse') =>
  t.dispatchEvent(new PointerEvent('pointerleave', { pointerType, composed: false }));
const enter = (t: Element) => t.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
const down = (t: Element) =>
  t.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', bubbles: true, composed: true }));
const esc = (t: EventTarget) => {
  const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true });
  t.dispatchEvent(e);
  return e;
};

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('helpers', () => {
  it('hovercardDelay reads ms, else 350', () => {
    expect(hovercardDelay(null)).toBe(350);
    expect(hovercardDelay('0')).toBe(0);
    expect(hovercardDelay('500')).toBe(500);
    expect(hovercardDelay('-1')).toBe(350);
    expect(hovercardDelay('soon')).toBe(350);
  });
  it('hovercardSize reads a positive px number', () => {
    expect(hovercardSize('320')).toBe(320);
    expect(hovercardSize('270.6')).toBe(271);
    expect(hovercardSize('0')).toBeNull();
    expect(hovercardSize('auto')).toBeNull();
    expect(hovercardSize(null)).toBeNull();
  });
  it('triggerOnPath finds the nearest match, stops at the card, survives a bad selector', () => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    const inner = document.createElement('span');
    tile.append(inner);
    const cardHost = document.createElement('div');
    expect(triggerOnPath([inner, tile, document.body], '.tile')).toBe(tile);
    expect(triggerOnPath([inner, cardHost, tile], '.tile', cardHost)).toBeNull();
    expect(triggerOnPath([inner, tile], '[[bad')).toBeNull();
    expect(triggerOnPath([inner, tile], null)).toBeNull();
  });
});

describe('<ui-hovercard>', () => {
  it('opens after the 350ms hover intent with ui-open (the host fills it); no describedby, no role', () => {
    const { el, tiles, opened } = mount();
    over(tiles[0].querySelector('.nm')!); // over a child of the tile
    vi.advanceTimersByTime(HOVERCARD_DELAY_MS - 1);
    expect(el.open).toBe(false);
    vi.advanceTimersByTime(1);
    expect(el.open).toBe(true);
    expect(el.trigger).toBe(tiles[0]);
    expect(opened).toEqual([tiles[0]]);
    expect(card(el).classList.contains('is-open')).toBe(true);
    expect(card(el).getAttribute('part')).toBe('card');
    expect(card(el).hasAttribute('role')).toBe(false);
    expect(el.querySelector('.peek')?.textContent).toBe('Preview of report.html');
    expect(tiles[0].hasAttribute('aria-describedby')).toBe(false);
    // Moving within the tile does not restart anything.
    over(tiles[0].querySelector('.ic')!);
    expect(opened).toHaveLength(1);
  });

  it('a sweep that leaves before the intent opens nothing; touch never opens it', () => {
    const { el, tiles, opened } = mount();
    over(tiles[0]);
    vi.advanceTimersByTime(200);
    leave(tiles[0]);
    vi.advanceTimersByTime(1000);
    over(tiles[1], 'touch');
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);
    expect(opened).toEqual([]);
  });

  it('ui-open cancelled, or nothing filled: it stays closed', () => {
    const { el, tiles } = mount();
    el.addEventListener('ui-open', (e) => {
      if ((e as CustomEvent<HovercardDetail>).detail.trigger === tiles[1]) e.preventDefault();
    });
    el.anchor(tiles[1]);
    expect(el.open).toBe(false);
    const bare = document.createElement('ui-hovercard') as UiHovercard;
    document.body.append(bare);
    bare.anchor(tiles[2]);
    expect(bare.open).toBe(false);
  });

  it('leaving hides after a 200ms grace; the card under the pointer keeps it; ui-closed follows the exit', () => {
    const { el, tiles } = mount();
    const closed: Element[] = [];
    el.addEventListener('ui-closed', (e) => closed.push((e as CustomEvent<HovercardDetail>).detail.trigger));
    over(tiles[0]);
    vi.advanceTimersByTime(HOVERCARD_DELAY_MS);
    leave(tiles[0]);
    vi.advanceTimersByTime(HOVERCARD_GRACE_MS - 1);
    expect(el.open).toBe(true);
    over(el.querySelector('.peek')!); // onto the card's content
    enter(card(el));
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(true);
    leave(card(el));
    vi.advanceTimersByTime(HOVERCARD_GRACE_MS);
    expect(el.open).toBe(false);
    expect(card(el).classList.contains('is-open')).toBe(false);
    expect(closed).toEqual([]);
    vi.advanceTimersByTime(HOVERCARD_EXIT_MS);
    expect(closed).toEqual([tiles[0]]);
  });

  it('while open, the next tile takes the card over in 90ms (one ui-open each), with no ui-closed between', () => {
    const { el, tiles, opened } = mount();
    const closed = vi.fn();
    el.addEventListener('ui-closed', closed);
    over(tiles[0]);
    vi.advanceTimersByTime(HOVERCARD_DELAY_MS);
    leave(tiles[0]);
    over(tiles[1]);
    vi.advanceTimersByTime(HOVERCARD_SWAP_MS);
    expect(el.trigger).toBe(tiles[1]);
    expect(opened).toEqual([tiles[0], tiles[1]]);
    expect(el.querySelector('.peek')?.textContent).toBe('Preview of retries.png');
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(true);
    expect(closed).not.toHaveBeenCalled();
  });

  it('keyboard focus opens it at once; focus leaving hides it after the grace', () => {
    const { el, tiles } = mount();
    tiles[2].focus();
    expect(el.open).toBe(true);
    expect(el.trigger).toBe(tiles[2]);
    tiles[2].blur();
    vi.advanceTimersByTime(HOVERCARD_GRACE_MS);
    expect(el.open).toBe(false);
  });

  it('Esc closes it first (the key is marked used, so a dialog under it stays); closed, Esc is left alone', () => {
    const { el, tiles } = mount();
    tiles[0].focus();
    expect(el.open).toBe(true);
    const e = esc(tiles[0]);
    expect(el.open).toBe(false);
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(tiles[0]);
    expect(esc(tiles[0]).defaultPrevented).toBe(false);
  });

  it('a press anywhere but the card hides it and cancels a pending open; a press on the card keeps it', () => {
    const { el, tiles } = mount();
    el.anchor(tiles[0]);
    down(el.querySelector('.peek')!);
    expect(el.open).toBe(true);
    down(tiles[0]);
    expect(el.open).toBe(false);
    // A quick click on a tile (inside the intent): the card never follows the viewer it opens.
    leave(tiles[0]);
    over(tiles[1]);
    vi.advanceTimersByTime(HOVERCARD_DELAY_MS - 50);
    down(tiles[1]);
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);
  });

  it('anchor(el) opens now for any element, anchor(null) hides; disabled never opens', () => {
    const { el, tiles, opened } = mount();
    const other = document.createElement('a');
    other.dataset.name = 'linked.md';
    document.body.append(other);
    el.anchor(other);
    expect(el.open).toBe(true);
    expect(opened).toEqual([other]);
    el.anchor(null);
    expect(el.open).toBe(false);
    el.setAttribute('disabled', '');
    el.anchor(tiles[0]);
    over(tiles[1]);
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);
  });

  it('matches triggers inside open shadow roots (a tile drawn by another component)', () => {
    const { el } = mount();
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<button class="tile" data-name="deep.png"><span>deep</span></button>';
    document.body.append(host);
    const tile = root.querySelector('.tile')!;
    over(tile.querySelector('span')!);
    vi.advanceTimersByTime(HOVERCARD_DELAY_MS);
    expect(el.trigger).toBe(tile);
    expect(el.querySelector('.peek')?.textContent).toBe('Preview of deep.png');
  });

  it('host-set size: width (default 360) and height land on the card', () => {
    const { el } = mount({ width: '420', height: '270' });
    expect(card(el).style.getPropertyValue('--hc-w')).toBe('420px');
    expect(card(el).style.getPropertyValue('--hc-h')).toBe('270px');
    expect(card(el).hasAttribute('data-sized')).toBe(true);
    el.removeAttribute('height');
    el.setAttribute('width', 'wide');
    el.renderNow();
    expect(card(el).style.getPropertyValue('--hc-w')).toBe('360px');
    expect(card(el).hasAttribute('data-sized')).toBe(false);
  });

  it('host content is never parsed by the element; removed, it lets go of the document', () => {
    const { el, tiles } = mount();
    const p = document.createElement('p');
    p.textContent = XSS;
    el.replaceChildren(p);
    expect(el.shadowRoot!.innerHTML).not.toContain('<img');
    el.anchor(tiles[0]);
    const removed = vi.spyOn(document, 'removeEventListener');
    el.remove();
    expect(el.open).toBe(false);
    expect(removed).toHaveBeenCalledWith('pointerover', expect.any(Function), true);
    expect(removed).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    // A tile hovered after removal opens nothing.
    over(tiles[1]);
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);
  });

  it('styles: raised card from tokens, origin-aware pop, 180ms exit with delayed visibility, gentle reduced motion', () => {
    expect(styles).toContain('box-shadow: 0 0 0 1px var(--ib-card-border), var(--ib-shadow-raised);');
    expect(styles).toContain(
      'transition: opacity 160ms var(--ease-out), transform 220ms var(--ease-out), visibility 0s;',
    );
    expect(styles).toContain('visibility 0s linear 180ms');
    expect(styles).toContain('.hc-card[data-side="top"] { transform-origin: bottom left;');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('z-index: var(--ui-hovercard-z, 170)');
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});
