import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FLIP_MS, ROLL_FIRST_MS, ROLL_MS, type UiCompactBreakdown } from './compact-breakdown';
import './compact-breakdown';
import {
  assignSlots,
  type BreakdownPart,
  type CompactBreakdownData,
  easeOut,
  fmtShare,
  fmtValue,
  foldParts,
  normUnit,
  resolution,
  safeColor,
  shareOf,
} from './logic';
import { STRINGS } from './strings';

const XSS = '<img src=x onerror=alert(1)>';

// ── a frame clock the tests drive ──
let frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
let clock = 0;
let reduce = false;
const cancelled: number[] = [];
function tick(ms: number): void {
  clock += ms;
  const due = [...frames.values()];
  frames.clear();
  for (const f of due) f(clock);
}
function settle(): void {
  for (let i = 0; i < 400 && frames.size; i++) tick(16);
}

function mount(data: CompactBreakdownData, attrs: Record<string, string> = {}): UiCompactBreakdown {
  const el = document.createElement('ui-compact-breakdown');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = (el: HTMLElement, s: string) => el.shadowRoot!.querySelector<HTMLElement>(s);
const qa = (el: HTMLElement, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const text = (el: HTMLElement, s: string) => q(el, s)?.textContent ?? '';
const set = (el: UiCompactBreakdown, patch: Partial<CompactBreakdownData>) => {
  el.data = { ...el.data!, ...patch };
  el.renderNow();
};
const labels = (el: HTMLElement) => qa(el, '.cb-row:not([data-leaving]) .cb-label').map((n) => n.textContent);
const vals = (el: HTMLElement) => qa(el, '.cb-row:not([data-leaving]) .cb-val').map((n) => n.textContent);
const live = (el: HTMLElement) => q(el, '[role="status"]')?.textContent ?? '';
const rowOf = (el: HTMLElement, id: string) => qa(el, '.cb-item[data-id]').find((n) => n.dataset.id === id);
const segOf = (el: HTMLElement, id: string) => qa(el, '.cb-seg[data-id]').find((n) => n.dataset.id === id);
const optOf = (el: HTMLElement, id: string) => qa(el, '.cb-opt').find((n) => n.dataset.opt === id)!;
const key = (target: HTMLElement, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true }));
const pointer = (target: Element, type: string, pointerType = 'mouse') =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, pointerType }));

const MODELS: BreakdownPart[] = [
  { key: 'opus', label: 'claude-opus-4-7', value: 60 },
  { key: 'fable', label: 'claude-fable-5[1m]', value: 25 },
  { key: 'sonnet', label: 'claude-sonnet-4-6', value: 10 },
  { key: 'haiku', label: 'claude-haiku-4-20250414', value: 5 },
];
const SPEND: CompactBreakdownData = { title: 'Spend by model', unit: 'usd', parts: MODELS };
const PERIODS = [
  { id: 'day', label: 'Today' },
  { id: 'week', label: 'Last 7 days' },
  { id: 'month', label: 'Last 30 days' },
];

beforeEach(() => {
  document.body.innerHTML = '';
  frames = new Map();
  frameId = 0;
  clock = 1000;
  reduce = false;
  cancelled.length = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++frameId, cb);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    cancelled.push(id);
    frames.delete(id);
  });
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('logic', () => {
  it('formats every value in the card’s unit with src/core/format', () => {
    expect(fmtValue('usd', 412.3)).toBe('$412.30');
    expect(fmtValue('tokens', 12_345_678)).toBe('12.3M');
    expect(fmtValue('tokens', 950)).toBe('950');
    expect(fmtValue('count', 1234)).toBe('1,234');
    expect(normUnit('usd')).toBe('usd');
    expect(normUnit('tokens')).toBe('tokens');
    expect(normUnit('eur')).toBe('count');
    expect(resolution('usd')).toBe(0.005);
    expect(resolution('count')).toBe(0.5);
  });

  it('writes shares as whole percents that never read 0% or 100% for a part that is not', () => {
    expect(fmtShare(0)).toBe('0%');
    expect(fmtShare(0.4)).toBe('<1%');
    expect(fmtShare(45.5)).toBe('46%');
    expect(fmtShare(99.6)).toBe('>99%');
    expect(fmtShare(100)).toBe('100%');
    expect(fmtShare(Number.NaN)).toBe('0%');
    expect(shareOf(25, 100)).toBe(25);
    expect(shareOf(5, 0)).toBe(0);
  });

  it('ranks parts by value (ties keep the host order), leaves out zero, negative and non-numbers', () => {
    const m = foldParts(
      [
        { key: 'a', label: 'A', value: 5 },
        { key: 'b', label: 'B', value: 9 },
        { key: 'c', label: 'C', value: 5 },
        { key: 'z', label: 'Z', value: 0 },
        { key: 'n', label: 'N', value: -3 },
        { key: 'x', label: 'X', value: Number.NaN },
      ],
      undefined,
      undefined,
      'count',
    );
    expect(m.rows.map((r) => r.label)).toEqual(['B', 'A', 'C']);
    expect(m.rows.map((r) => r.id)).toEqual(['p:b', 'p:a', 'p:c']);
    expect(m.base).toBe(19);
  });

  it('makes duplicate keys unique instead of merging them', () => {
    const m = foldParts(
      [
        { key: 'a', label: 'A', value: 1 },
        { key: 'a', label: 'A again', value: 2 },
      ],
      5,
      undefined,
      'count',
    );
    expect(m.rows.map((r) => r.key)).toEqual(['a#2', 'a']);
  });

  it('folds the smallest parts into a last Other row past maxRows (Other counts as a row)', () => {
    const parts = [9, 8, 7, 6, 5, 4, 3].map((v, i) => ({ key: `k${i}`, label: `L${i}`, value: v }));
    const m = foldParts(parts, 5, undefined, 'count');
    expect(m.rows).toHaveLength(5);
    expect(m.rows.slice(0, 4).map((r) => r.value)).toEqual([9, 8, 7, 6]);
    expect(m.rows[4]).toMatchObject({ id: 'other', other: true, value: 12, folded: ['L4', 'L5', 'L6'] });
    expect(m.base).toBe(42);
    expect(foldParts(parts.slice(0, 5), 5, undefined, 'count').rows.some((r) => r.other)).toBe(false);
    expect(foldParts(parts, 1, undefined, 'count').rows.map((r) => r.id)).toEqual(['p:k0', 'other']);
    expect(foldParts(parts, undefined, undefined, 'count').rows).toHaveLength(5);
  });

  it('adds a total above the parts’ sum to Other; rounding and a smaller total are ignored', () => {
    const two = MODELS.slice(0, 2);
    const m = foldParts(two, 5, 100, 'usd');
    expect(m.base).toBe(100);
    expect(m.rows.at(-1)).toMatchObject({ other: true, value: 15, folded: [] });
    expect(foldParts(two, 5, 85.004, 'usd').rows.some((r) => r.other)).toBe(false);
    expect(foldParts(two, 5, 50, 'usd').base).toBe(85);
    expect(foldParts([], 5, 12, 'usd').rows).toEqual([{ id: 'other', label: '', value: 12, other: true, folded: [] }]);
    expect(foldParts(undefined, 5, undefined, 'usd')).toEqual({ rows: [], base: 0 });
  });

  it('keeps palette slots by id, gives new ids the lowest free slot and frees the slots of ids that left', () => {
    let s = assignSlots(new Map(), ['a', 'b', 'c'], 5);
    expect([...s]).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ]);
    s = assignSlots(s, ['c', 'a', 'd'], 5);
    expect(s.get('c')).toBe(2);
    expect(s.get('a')).toBe(0);
    expect(s.get('d')).toBe(1);
    expect(s.has('b')).toBe(false);
    const many = assignSlots(new Map(), ['1', '2', '3', '4', '5', '6', '7'], 5);
    expect([...many.values()]).toEqual([0, 1, 2, 3, 4, 4, 4]);
  });

  it('lets a host colour only paint', () => {
    for (const ok of [
      '#e5484d',
      'rgb(1 2 3 / 50%)',
      'var(--st-run)',
      'color-mix(in srgb, var(--accent) 40%, white)',
      'oklch(0.7 0.1 250)',
      'tomato',
    ])
      expect(safeColor(ok)).toBe(ok);
    for (const bad of [
      'red;background:url(x)',
      'url(//evil.example/x.png)',
      '"red"',
      'expression(alert(1))',
      'var(--x))',
      'rgb(1,2,3',
      '<b>',
      'image-set(x 1x)',
      '',
      42,
      undefined,
    ])
      expect(safeColor(bad)).toBeUndefined();
  });

  it('eases out from 0 to 1', () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeCloseTo(0.9375);
    expect(easeOut(2)).toBe(1);
  });
});

describe('<ui-compact-breakdown>', () => {
  it('renders nothing without data', () => {
    const el = document.createElement('ui-compact-breakdown');
    document.body.append(el);
    el.renderNow();
    expect(q(el, '.cb')).toBeNull();
  });

  it('shows the total, ranked rows with value and share, the bar and “Largest”', () => {
    const el = mount({ ...SPEND, parts: [...MODELS].reverse() });
    settle();
    expect(q(el, '.cb')?.getAttribute('role')).toBe('group');
    expect(q(el, '.cb')?.getAttribute('aria-labelledby')).toBe('cb-title');
    expect(text(el, '.cb-title')).toBe('Spend by model');
    expect(text(el, '.cb-big')).toBe('$100.00');
    expect(text(el, '.cb-cap')).toBe('Total');
    expect(labels(el)).toEqual([
      'claude-opus-4-7',
      'claude-fable-5[1m]',
      'claude-sonnet-4-6',
      'claude-haiku-4-20250414',
    ]);
    expect(vals(el)).toEqual(['$60.00', '$25.00', '$10.00', '$5.00']);
    expect(qa(el, '.cb-share').map((n) => n.textContent)).toEqual(['60%', '25%', '10%', '5%']);
    expect(qa(el, '.cb-seg')).toHaveLength(4);
    expect(Number(segOf(el, 'p:opus')?.style.flexGrow)).toBe(60);
    expect(text(el, '.cb-foot')).toBe('Largest: claude-opus-4-7');
    expect(text(el, '.cb-body > .sr-only')).toBe('Total: $100.00');
    expect(rowOf(el, 'p:fable')?.querySelector('.sr-only')?.textContent).toBe(
      'claude-fable-5[1m]: $25.00, 25% of the total',
    );
    expect(q(el, '.cb-switch')).toBeNull();
  });

  it('rolls the first data up from zero in one shared tween (900 ms), the rolling text hidden from screen readers', () => {
    const el = mount(SPEND);
    expect(text(el, '.cb-big')).toBe('$0.00');
    expect(q(el, '.cb-big')?.getAttribute('aria-hidden')).toBe('true');
    expect(text(el, '.cb-body > .sr-only')).toBe('Total: $100.00');
    tick(ROLL_FIRST_MS / 2);
    const e = easeOut(0.5);
    expect(text(el, '.cb-big')).toBe(`$${(100 * e).toFixed(2)}`);
    expect(vals(el)[0]).toBe(`$${(60 * e).toFixed(2)}`);
    // every part moves with the total, so the shares hold still while the numbers roll
    expect(qa(el, '.cb-share')[0].textContent).toBe('60%');
    tick(ROLL_FIRST_MS / 2);
    expect(text(el, '.cb-big')).toBe('$100.00');
    expect(frames.size).toBe(0);
  });

  it('rolls later changes from where the numbers are, in 620 ms', () => {
    const el = mount(SPEND);
    settle();
    set(el, { parts: MODELS.map((p) => ({ ...p, value: p.value * 2 })) });
    expect(text(el, '.cb-big')).toBe('$100.00');
    tick(ROLL_MS / 2);
    expect(text(el, '.cb-big')).toBe(`$${(100 + 100 * easeOut(0.5)).toFixed(2)}`);
    tick(ROLL_MS / 2);
    expect(text(el, '.cb-big')).toBe('$200.00');
    expect(frames.size).toBe(0);
  });

  it('jumps with reduced motion, and when the unit changes', () => {
    reduce = true;
    const el = mount(SPEND);
    expect(text(el, '.cb-big')).toBe('$100.00');
    expect(frames.size).toBe(0);
    reduce = false;
    set(el, { unit: 'tokens', parts: [{ key: 'opus', label: 'claude-opus-4-7', value: 21_480_310 }] });
    expect(text(el, '.cb-big')).toBe('21.5M');
    expect(frames.size).toBe(0);
  });

  it('keeps each part’s colour and place in the bar while the rows re-rank', () => {
    const el = mount(SPEND);
    settle();
    const colour = (id: string) => rowOf(el, id)?.style.getPropertyValue('--c');
    expect(colour('p:opus')).toBe('var(--cb-c1)');
    expect(colour('p:fable')).toBe('var(--cb-c2)');
    const order = () => qa(el, '.cb-seg').map((s) => s.dataset.id);
    const before = order();
    set(el, {
      parts: [
        { key: 'opus', label: 'claude-opus-4-7', value: 5 },
        { key: 'fable', label: 'claude-fable-5[1m]', value: 50 },
        { key: 'sonnet', label: 'claude-sonnet-4-6', value: 30 },
        { key: 'haiku', label: 'claude-haiku-4-20250414', value: 15 },
      ],
    });
    settle();
    expect(labels(el)[0]).toBe('claude-fable-5[1m]');
    expect(order()).toEqual(before);
    expect(colour('p:opus')).toBe('var(--cb-c1)');
    expect(colour('p:fable')).toBe('var(--cb-c2)');
    expect(segOf(el, 'p:opus')?.style.getPropertyValue('--c')).toBe('var(--cb-c1)');
  });

  it('folds past maxRows into “Other (n)” — last, neutral, its tooltip listing the folded parts', () => {
    const parts = [9, 8, 7, 6, 5, 4, 3].map((v, i) => ({ key: `u${i}`, label: `User ${i}`, value: v }));
    const el = mount({ title: 'Spend by user', unit: 'usd', parts, maxRows: 5 });
    settle();
    expect(labels(el)).toEqual(['User 0', 'User 1', 'User 2', 'User 3', 'Other (3)']);
    const other = rowOf(el, 'other')!;
    expect(other.closest('.cb-row')?.hasAttribute('data-other')).toBe(true);
    expect(other.style.getPropertyValue('--c')).toBe('var(--cb-other)');
    expect(other.querySelector('.cb-label')?.getAttribute('title')).toBe('User 4, User 5, User 6');
    expect(other.querySelector('.cb-val')?.textContent).toBe('$12.00');
    expect(qa(el, '.cb-seg').at(-1)?.dataset.id).toBe('other');
    expect(text(el, '.cb-foot')).toBe('Largest: User 0');
  });

  it('uses a host colour that can only paint and falls back to the palette otherwise', () => {
    const el = mount({
      title: 'Sessions by workflow',
      parts: [
        { key: 'default', label: 'default', value: 3, color: 'var(--st-run)' },
        { key: 'deploy', label: 'deploy', value: 2, color: `red;background:url(x)"${XSS}` },
      ],
    });
    expect(rowOf(el, 'p:default')?.style.getPropertyValue('--c')).toBe('var(--st-run)');
    expect(rowOf(el, 'p:deploy')?.style.getPropertyValue('--c')).toBe('var(--cb-c2)');
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
  });

  it('escapes every host string', () => {
    const el = mount({
      title: XSS,
      unit: 'count',
      parts: [
        { key: `"${XSS}`, label: XSS, value: 3 },
        { key: 'b', label: 'b', value: 1 },
      ],
      options: [
        { id: `"${XSS}`, label: XSS },
        { id: 'b', label: 'b' },
      ],
      optionsLabel: `"${XSS}`,
      totalLabel: XSS,
      footer: XSS,
    });
    settle();
    const root = el.shadowRoot!;
    expect(root.querySelector('img')).toBeNull();
    expect(text(el, '.cb-title')).toBe(XSS);
    expect(q(el, '.cb-title')?.getAttribute('title')).toBe(XSS);
    expect(text(el, '.cb-cap')).toBe(XSS);
    expect(text(el, '.cb-foot')).toBe(XSS);
    expect(labels(el)[0]).toBe(XSS);
    expect(qa(el, '.cb-opt')[0].textContent).toBe(XSS);
    expect(qa(el, '.cb-opt')[0].dataset.opt).toBe(`"${XSS}`);
    expect(q(el, '.cb-switch')?.getAttribute('aria-label')).toBe(`"${XSS}`);
    expect(rowOf(el, `p:"${XSS}`)?.dataset.key).toBe(`row:p:"${XSS}`);
    set(el, { footer: undefined });
    expect(text(el, '.cb-foot')).toBe(`Largest: ${XSS}`);
    set(el, { error: XSS });
    expect(text(el, '.cb-cap')).toBe(XSS);
    expect(root.querySelector('img')).toBeNull();
    set(el, { error: undefined, parts: [], emptyText: XSS });
    expect(text(el, '.cb-empty')).toBe(XSS);
    // hover caption
    set(el, { parts: [{ key: 'x', label: XSS, value: 1 }], emptyText: undefined });
    settle();
    rowOf(el, 'p:x')!.focus();
    expect(q(el, '.cb-cap-label')?.textContent).toBe(XSS);
    expect(root.querySelector('img')).toBeNull();
  });

  describe('switch', () => {
    it('is a radiogroup with one tab stop, named “Period” by default', () => {
      const el = mount({ ...SPEND, options: PERIODS, value: 'week' });
      const sw = q(el, '.cb-switch')!;
      expect(sw.getAttribute('role')).toBe('radiogroup');
      expect(sw.getAttribute('aria-label')).toBe('Period');
      expect(qa(el, '.cb-opt').map((b) => [b.getAttribute('aria-checked'), b.getAttribute('tabindex')])).toEqual([
        ['false', '-1'],
        ['true', '0'],
        ['false', '-1'],
      ]);
      expect(el.value).toBe('week');
      expect(q(el, '.cb-pill')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('needs two options; an unknown value falls back to the first', () => {
      expect(q(mount({ ...SPEND, options: [PERIODS[0]] }), '.cb-switch')).toBeNull();
      const el = mount({ ...SPEND, options: PERIODS, value: 'year' });
      expect(el.value).toBe('day');
      expect(optOf(el, 'day').getAttribute('aria-checked')).toBe('true');
    });

    it('emits ui-change and, uncontrolled, moves its own selection', () => {
      const el = mount({ ...SPEND, options: PERIODS });
      const seen: Array<{ value: string }> = [];
      let bubbled = false;
      document.body.addEventListener('ui-change', (e) => {
        bubbled = (e as CustomEvent).composed;
        seen.push((e as CustomEvent).detail);
      });
      expect(el.value).toBe('day');
      optOf(el, 'month').click();
      expect(seen).toEqual([{ value: 'month' }]);
      expect(bubbled).toBe(true);
      expect(el.value).toBe('month');
      expect(optOf(el, 'month').getAttribute('aria-checked')).toBe('true');
      optOf(el, 'month').click();
      expect(seen).toHaveLength(1);
    });

    it('controlled: only emits until the host sets value; preventDefault keeps the current one', () => {
      const el = mount({ ...SPEND, options: PERIODS, value: 'day' });
      const seen: string[] = [];
      el.addEventListener('ui-change', (e) => seen.push((e as CustomEvent).detail.value));
      optOf(el, 'week').click();
      expect(seen).toEqual(['week']);
      expect(optOf(el, 'day').getAttribute('aria-checked')).toBe('true');
      set(el, { value: 'week' });
      expect(optOf(el, 'week').getAttribute('aria-checked')).toBe('true');

      const un = mount({ ...SPEND, options: PERIODS });
      un.addEventListener('ui-change', (e) => e.preventDefault());
      optOf(un, 'week').click();
      expect(un.value).toBe('day');
    });

    it('arrows, Home and End pick and focus the next option, wrapping around', () => {
      const el = mount({ ...SPEND, options: PERIODS });
      const seen: string[] = [];
      el.addEventListener('ui-change', (e) => seen.push((e as CustomEvent).detail.value));
      const focused = () => (el.shadowRoot!.activeElement as HTMLElement | null)?.dataset.opt;
      optOf(el, 'day').focus();
      key(optOf(el, 'day'), 'ArrowRight');
      expect(el.value).toBe('week');
      expect(focused()).toBe('week');
      key(optOf(el, 'week'), 'End');
      expect(el.value).toBe('month');
      key(optOf(el, 'month'), 'ArrowDown');
      expect(el.value).toBe('day');
      key(optOf(el, 'day'), 'ArrowLeft');
      expect(el.value).toBe('month');
      key(optOf(el, 'month'), 'Home');
      expect(el.value).toBe('day');
      expect(focused()).toBe('day');
      expect(key(optOf(el, 'day'), 'a')).toBe(true);
      expect(seen).toEqual(['week', 'month', 'day', 'month', 'day']);
    });

    it('focus() goes to the checked option, else the first row', () => {
      const el = mount({ ...SPEND, options: PERIODS, value: 'week' });
      el.focus();
      expect((el.shadowRoot!.activeElement as HTMLElement).dataset.opt).toBe('week');
      const plain = mount(SPEND);
      plain.focus();
      expect((plain.shadowRoot!.activeElement as HTMLElement).dataset.id).toBe('p:opus');
    });
  });

  describe('hover and focus', () => {
    it('a focused row lights its segment, dims the others and rolls the big number to the part', () => {
      const el = mount(SPEND);
      settle();
      rowOf(el, 'p:fable')!.focus();
      expect(rowOf(el, 'p:fable')?.hasAttribute('data-active')).toBe(true);
      expect(segOf(el, 'p:fable')?.hasAttribute('data-active')).toBe(true);
      expect(segOf(el, 'p:opus')?.hasAttribute('data-active')).toBe(false);
      expect(q(el, '.cb-list')?.hasAttribute('data-active')).toBe(true);
      expect(q(el, '.cb-bar')?.hasAttribute('data-active')).toBe(true);
      expect(text(el, '.cb-cap')).toBe('claude-fable-5[1m]· 25%');
      tick(ROLL_MS);
      expect(text(el, '.cb-big')).toBe('$25.00');
      rowOf(el, 'p:fable')!.blur();
      expect(q(el, '.cb-list')?.hasAttribute('data-active')).toBe(false);
      expect(text(el, '.cb-cap')).toBe('Total');
      settle();
      expect(text(el, '.cb-big')).toBe('$100.00');
    });

    it('hovering a segment lights its row; touch pointers are left to focus; leaving the card clears', () => {
      const el = mount(SPEND);
      settle();
      pointer(segOf(el, 'p:sonnet')!, 'pointerover');
      expect(rowOf(el, 'p:sonnet')?.hasAttribute('data-active')).toBe(true);
      expect(text(el, '.cb-cap')).toContain('claude-sonnet-4-6');
      pointer(rowOf(el, 'p:haiku')!, 'pointerover', 'touch');
      expect(rowOf(el, 'p:sonnet')?.hasAttribute('data-active')).toBe(true);
      pointer(q(el, '.cb-title')!, 'pointerover');
      expect(q(el, '.cb-list')?.hasAttribute('data-active')).toBe(false);
      pointer(rowOf(el, 'p:opus')!, 'pointerover');
      expect(rowOf(el, 'p:opus')?.hasAttribute('data-active')).toBe(true);
      el.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
      expect(q(el, '.cb-list')?.hasAttribute('data-active')).toBe(false);
    });

    it('the hot row survives new data; a focused row keeps focus across a re-render', () => {
      const el = mount(SPEND);
      settle();
      rowOf(el, 'p:sonnet')!.focus();
      set(el, { parts: MODELS.map((p) => ({ ...p, value: p.value + 1 })) });
      expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset.id).toBe('p:sonnet');
      expect(rowOf(el, 'p:sonnet')?.hasAttribute('data-active')).toBe(true);
    });
  });

  describe('motion', () => {
    it('a part that left folds away last (no tab stop, hidden from screen readers), then is gone', () => {
      const el = mount(SPEND);
      settle();
      set(el, { parts: MODELS.filter((p) => p.key !== 'fable') });
      const row = q(el, '.cb-row[data-leaving]')!;
      expect(row.dataset.id).toBe('p:fable');
      expect(row.getAttribute('aria-hidden')).toBe('true');
      expect(row.querySelector('.cb-item')?.getAttribute('tabindex')).toBe('-1');
      expect(qa(el, '.cb-row').at(-1)).toBe(row);
      expect(segOf(el, 'p:fable')).toBeDefined();
      settle();
      expect(q(el, '.cb-row[data-leaving]')).toBeNull();
      expect(segOf(el, 'p:fable')).toBeUndefined();
      expect(labels(el)).toEqual(['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-20250414']);
      expect(text(el, '.cb-big')).toBe('$75.00');
    });

    it('with reduced motion a part that left is gone at once', () => {
      reduce = true;
      const el = mount(SPEND);
      set(el, { parts: MODELS.slice(1) });
      expect(q(el, '.cb-row[data-leaving]')).toBeNull();
      expect(labels(el)).toHaveLength(3);
    });

    it('a focused row that folds away hands focus to the first row', () => {
      reduce = true;
      const el = mount(SPEND);
      rowOf(el, 'p:haiku')!.focus();
      set(el, { parts: MODELS.slice(0, 3) });
      expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset.id).toBe('p:opus');
    });

    it('rows that change rank slide from where they were (FLIP, 560 ms)', () => {
      const calls: Array<{ id?: string; from: string; ms: number }> = [];
      const anim = { cancel: vi.fn(), playState: 'running' };
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        const i = this.parentElement ? Array.from(this.parentElement.children).indexOf(this) : 0;
        return {
          top: i * 32,
          left: 0,
          width: 300,
          height: 32,
          right: 300,
          bottom: i * 32 + 32,
          x: 0,
          y: i * 32,
        } as DOMRect;
      });
      Object.defineProperty(HTMLElement.prototype, 'animate', {
        configurable: true,
        value(this: HTMLElement, kf: Keyframe[], o: KeyframeAnimationOptions) {
          calls.push({ id: this.dataset.id, from: String(kf[0].transform), ms: Number(o.duration) });
          return anim;
        },
      });
      const el = mount(SPEND);
      settle();
      set(el, {
        parts: [
          { key: 'opus', label: 'claude-opus-4-7', value: 20 },
          { key: 'fable', label: 'claude-fable-5[1m]', value: 25 },
          { key: 'sonnet', label: 'claude-sonnet-4-6', value: 10 },
          { key: 'haiku', label: 'claude-haiku-4-20250414', value: 5 },
        ],
      });
      expect(calls).toEqual([
        { id: 'p:fable', from: 'translateY(32px)', ms: FLIP_MS },
        { id: 'p:opus', from: 'translateY(-32px)', ms: FLIP_MS },
      ]);
      el.remove();
      expect(anim.cancel).toHaveBeenCalled();
      delete (HTMLElement.prototype as { animate?: unknown }).animate;
    });

    it('stops every timer on disconnect and shows the final numbers when it comes back', () => {
      const observed: string[] = [];
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe() {
            observed.push('observe');
          }
          disconnect() {
            observed.push('disconnect');
          }
          unobserve() {}
        },
      );
      const el = mount({ ...SPEND, options: PERIODS });
      expect(frames.size).toBe(1);
      expect(observed).toContain('observe');
      tick(100);
      el.remove();
      expect(frames.size).toBe(0);
      expect(cancelled.length).toBeGreaterThan(0);
      expect(observed.at(-1)).toBe('disconnect');
      document.body.append(el);
      el.renderNow();
      expect(text(el, '.cb-big')).toBe('$100.00');
      expect(frames.size).toBe(0);
      el.remove();
    });
  });

  describe('states', () => {
    it('loading without parts shows a skeleton; with parts the numbers dim', () => {
      const el = mount({ ...SPEND, parts: [], loading: true });
      expect(q(el, '.cb')?.getAttribute('aria-busy')).toBe('true');
      expect(q(el, '.cb-sk.is-big')).not.toBeNull();
      expect(qa(el, '.cb-skrow')).toHaveLength(3);
      expect(text(el, '.cb-cap')).toBe('Loading…');
      expect(q(el, '.cb-foot')).toBeNull();
      set(el, { parts: MODELS });
      expect(q(el, '.cb-sk')).toBeNull();
      expect(q(el, '.cb')?.getAttribute('aria-busy')).toBe('true');
      expect(labels(el)).toHaveLength(4);
      set(el, { loading: false });
      expect(q(el, '.cb')?.hasAttribute('aria-busy')).toBe(false);
    });

    it('error: a dash and the message, no rows, the switch still there', () => {
      const el = mount({ ...SPEND, options: PERIODS, error: 'Couldn’t load usage (HTTP 502).' });
      expect(text(el, '.cb-big')).toBe('—');
      expect(text(el, '.cb-cap')).toBe('Couldn’t load usage (HTTP 502).');
      expect(q(el, '.cb-cap')?.classList.contains('is-error')).toBe(true);
      expect(q(el, '.cb-list')).toBeNull();
      expect(q(el, '.cb-foot')).toBeNull();
      expect(q(el, '.cb-switch')).not.toBeNull();
      expect(text(el, '.cb-body > .sr-only')).toBe('Total: —. Couldn’t load usage (HTTP 502).');
    });

    it('empty: zero in the unit and the empty line; footer null hides the last line', () => {
      const el = mount({ title: 'Tokens by model', unit: 'tokens', parts: [] });
      settle();
      expect(text(el, '.cb-big')).toBe('0');
      expect(text(el, '.cb-empty')).toBe('Nothing to break down for this period.');
      expect(q(el, '.cb-bar')?.classList.contains('is-empty')).toBe(true);
      expect(q(el, '.cb-foot')).toBeNull();
      const plain = mount({ ...SPEND, footer: null });
      expect(q(plain, '.cb-foot')).toBeNull();
    });

    it('after a pick, says the new total once its data is in — not on other updates', () => {
      const el = mount({ ...SPEND, options: PERIODS, value: 'day', totalLabel: 'Spent today' });
      set(el, { parts: MODELS.slice(0, 2) });
      expect(live(el)).toBe('');
      el.addEventListener('ui-change', (e) => {
        el.data = { ...el.data!, value: (e as CustomEvent).detail.value, loading: true };
      });
      optOf(el, 'week').click();
      el.renderNow();
      expect(live(el)).toBe('');
      set(el, { loading: false, parts: MODELS, totalLabel: 'Spent in the last 7 days' });
      expect(live(el)).toBe('Spent in the last 7 days: $100.00, largest claude-opus-4-7');
    });
  });

  it('speaks Korean with lang="ko"', () => {
    const parts = [9, 8, 7, 6, 5, 4, 3].map((v, i) => ({ key: `u${i}`, label: `사용자 ${i}`, value: v }));
    const el = mount({ title: '사용자별 비용', unit: 'usd', parts, options: PERIODS }, { lang: 'ko' });
    settle();
    expect(labels(el).at(-1)).toBe('기타 3개');
    expect(text(el, '.cb-cap')).toBe('합계');
    expect(text(el, '.cb-foot')).toBe('가장 큰 항목: 사용자 0');
    expect(q(el, '.cb-switch')?.getAttribute('aria-label')).toBe('기간');
    expect(text(el, '.cb-body > .sr-only')).toBe('합계 $42.00');
    expect(rowOf(el, 'p:u0')?.querySelector('.sr-only')?.textContent).toBe('사용자 0 $9.00, 전체의 21%');
    set(el, { parts: [] });
    expect(text(el, '.cb-empty')).toBe(STRINGS.ko.empty);
    set(el, { parts: [], loading: true });
    expect(text(el, '.cb-cap')).toBe('불러오는 중…');
    expect(STRINGS.ko.other(0)).toBe('기타');
  });
});
