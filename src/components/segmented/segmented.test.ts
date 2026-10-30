import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rovingIndex, type SegmentedData, segmentedOptions, type UiSegmented } from './segmented';
import { styles } from './styles';

function mount(data: SegmentedData, attrs: Record<string, string> = {}): UiSegmented {
  const el = document.createElement('ui-segmented') as UiSegmented;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = (el: UiSegmented, s: string) => el.shadowRoot!.querySelector<HTMLElement>(s);
const qa = (el: UiSegmented, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const key = (t: HTMLElement, k: string) =>
  t.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true }));

const DATA: SegmentedData = {
  label: 'Period',
  value: '7d',
  options: [
    { value: 'today', label: 'Today' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
  ],
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('helpers', () => {
  it('rovingIndex wraps and skips disabled', () => {
    expect(rovingIndex([false, true, false], 0, 1)).toBe(2);
    expect(rovingIndex([false, true, false], 2, 1)).toBe(0);
    expect(rovingIndex([false, true, false], 0, -1)).toBe(2);
    expect(rovingIndex([true, false], 0, 0)).toBe(1);
    expect(rovingIndex([true, true], 0, 1)).toBe(-1);
    expect(rovingIndex([], 0, 1)).toBe(-1);
  });
  it('segmentedOptions drops junk and duplicate values', () => {
    const out = segmentedOptions({
      options: [{ value: 'a', label: 'A' }, { value: 'a', label: 'A2' }, null as never, { label: 'x' } as never],
    });
    expect(out.map((o) => o.label)).toEqual(['A']);
  });
});

describe('<ui-segmented>', () => {
  it('renders a radiogroup with one checked radio and one tab stop', () => {
    const el = mount(DATA);
    const g = q(el, '.sg')!;
    expect(g.getAttribute('role')).toBe('radiogroup');
    expect(g.getAttribute('aria-label')).toBe('Period');
    const r = qa(el, '[role="radio"]');
    expect(r.map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(r.map((b) => b.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    expect(g.style.getPropertyValue('--i').trim()).toBe('1');
    expect(g.style.getPropertyValue('--n').trim()).toBe('3');
  });

  it('escapes labels and the group name', () => {
    const el = mount({ label: '<b>x</b>', options: [{ value: '"v"', label: '<img src=x onerror=alert(1)>' }] });
    expect(q(el, 'img')).toBeNull();
    expect(q(el, 'b')).toBeNull();
    expect(q(el, '.sg-label')?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(q(el, '.sg-opt')?.dataset.key).toBe('"v"');
  });

  it('draws no chip and puts the stop on the first enabled option when nothing is checked', () => {
    const el = mount({
      ...DATA,
      value: undefined,
      options: [{ value: 'a', label: 'A', disabled: true }, ...DATA.options],
    });
    expect(q(el, '.sg')?.hasAttribute('data-none')).toBe(true);
    expect(qa(el, '.sg-opt').map((b) => b.getAttribute('tabindex'))).toEqual(['-1', '0', '-1', '-1']);
  });

  it('a click emits a cancelable ui-change and shows the new value', () => {
    const el = mount(DATA);
    const fired = vi.fn();
    el.addEventListener('ui-change', (e) => fired((e as CustomEvent).detail));
    qa(el, '.sg-opt')[2].click();
    expect(fired).toHaveBeenCalledWith({ value: '30d', previous: '7d' });
    el.renderNow();
    expect(el.value).toBe('30d');
    expect(q(el, '[aria-checked="true"]')?.dataset.key).toBe('30d');
    expect(q(el, '.sg')?.style.getPropertyValue('--i').trim()).toBe('2');
  });

  it('preventDefault keeps the old value; the same option sends nothing', () => {
    const el = mount(DATA);
    const fired = vi.fn((e: Event) => e.preventDefault());
    el.addEventListener('ui-change', fired);
    qa(el, '.sg-opt')[0].click();
    el.renderNow();
    expect(fired).toHaveBeenCalledTimes(1);
    expect(el.value).toBe('7d');
    qa(el, '.sg-opt')[1].click();
    expect(fired).toHaveBeenCalledTimes(1);
  });

  it('a listener that sets its own value wins over the optimistic one', () => {
    const el = mount(DATA);
    el.addEventListener('ui-change', () => {
      el.data = { ...DATA, value: 'today' };
    });
    qa(el, '.sg-opt')[2].click();
    expect(el.value).toBe('today');
  });

  it('arrows move focus and choose, wrapping and skipping disabled; Home / End', () => {
    const el = mount({
      ...DATA,
      options: [...DATA.options.slice(0, 2), { value: 'x', label: 'X', disabled: true }, DATA.options[2]],
    });
    const seen: string[] = [];
    el.addEventListener('ui-change', (e) => seen.push((e as CustomEvent).detail.value));
    const opts = () => qa(el, '.sg-opt');
    opts()[1].focus();
    key(opts()[1], 'ArrowRight');
    el.renderNow();
    expect(el.shadowRoot!.activeElement).toBe(opts()[3]);
    expect(el.value).toBe('30d');
    key(opts()[3], 'ArrowRight');
    el.renderNow();
    expect(el.value).toBe('today');
    key(opts()[0], 'ArrowLeft');
    el.renderNow();
    expect(el.value).toBe('30d');
    key(opts()[3], 'Home');
    el.renderNow();
    expect(el.value).toBe('today');
    key(opts()[0], 'End');
    el.renderNow();
    expect(el.value).toBe('30d');
    key(opts()[3], 'ArrowUp');
    el.renderNow();
    expect(el.value).toBe('7d');
    expect(seen).toEqual(['30d', 'today', '30d', 'today', '30d', '7d']);
  });

  it('a disabled option is aria-disabled and cannot be chosen', () => {
    const el = mount({ ...DATA, options: [...DATA.options, { value: 'y', label: 'Y', disabled: true }] });
    const fired = vi.fn();
    el.addEventListener('ui-change', fired);
    const b = qa(el, '.sg-opt')[3];
    expect(b.getAttribute('aria-disabled')).toBe('true');
    b.click();
    expect(fired).not.toHaveBeenCalled();
  });

  it('a read-only control explains why and sends nothing, but arrows still move focus', () => {
    const el = mount({ ...DATA, disabled: 'Read-only' });
    const fired = vi.fn();
    el.addEventListener('ui-change', fired);
    expect(q(el, '.sg')?.getAttribute('aria-disabled')).toBe('true');
    expect(qa(el, '.sg-opt').every((b) => b.title === 'Read-only')).toBe(true);
    qa(el, '.sg-opt')[0].click();
    key(qa(el, '.sg-opt')[1], 'ArrowRight');
    expect(fired).not.toHaveBeenCalled();
    expect(el.shadowRoot!.activeElement).toBe(qa(el, '.sg-opt')[2]);
  });

  it('icon-only options carry the label as their name; icons come from the set', () => {
    const el = mount({
      label: 'Theme',
      value: 'dark',
      options: [
        { value: 'light', label: 'Light', icon: 'sun', iconOnly: true },
        { value: 'dark', label: 'Dark', icon: 'moon' },
      ],
    });
    const [a, b] = qa(el, '.sg-opt');
    expect(a.getAttribute('aria-label')).toBe('Light');
    expect(a.title).toBe('Light');
    expect(a.querySelector('svg[data-icon="sun"]')).not.toBeNull();
    expect(a.querySelector('.sg-label')).toBeNull();
    expect(b.querySelector('.sg-label')?.textContent).toBe('Dark');
  });

  it('keeps its nodes across renders (the chip transition survives)', () => {
    const el = mount(DATA);
    const thumb = q(el, '.sg-thumb');
    el.data = { ...DATA, value: 'today' };
    el.renderNow();
    expect(q(el, '.sg-thumb')).toBe(thumb);
  });

  it('renders nothing without options', () => {
    expect(q(mount({ options: [] }), '.sg')).toBeNull();
  });

  it('styles: chip slides on --dur-move, hover gated, 44px on touch, jumps under reduced motion', () => {
    expect(styles).toContain('transform: translateX(calc(var(--i) * (100% + var(--sg-gap))))');
    expect(styles).toContain('transition: transform var(--dur-move) var(--ease-out)');
    expect(styles).toMatch(/@media \(hover: hover\) and \(pointer: fine\)/);
    expect(styles).toMatch(/@media \(pointer: coarse\), \(max-width: 639px\) \{\s*\.sg \{ --sg-h: 44px; \}/);
    expect(styles).toMatch(
      /prefers-reduced-motion: reduce\) \{\s*\.sg-thumb \{ transition: opacity 120ms ease !important; \}/,
    );
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  it('speaks the host’s Korean labels with lang="ko" (no chrome strings of its own)', () => {
    const el = mount({ label: '기간', value: 'a', options: [{ value: 'a', label: '오늘' }] }, { lang: 'ko' });
    expect(q(el, '.sg')?.getAttribute('aria-label')).toBe('기간');
    expect(q(el, '.sg-label')?.textContent).toBe('오늘');
  });
});
