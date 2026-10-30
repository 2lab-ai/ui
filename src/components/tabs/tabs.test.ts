import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { styles } from './styles';
import { selectedIndex, type TabsData, tabItems, type UiTabs } from './tabs';

function mount(data: TabsData, attrs: Record<string, string> = {}, panels: string[] = []): UiTabs {
  const el = document.createElement('ui-tabs') as UiTabs;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const id of panels) {
    const p = document.createElement('section');
    p.slot = id;
    p.textContent = `panel ${id}`;
    el.append(p);
  }
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = (el: UiTabs, s: string) => el.shadowRoot!.querySelector<HTMLElement>(s);
const qa = (el: UiTabs, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const key = (t: HTMLElement, k: string) =>
  t.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true }));

const DATA: TabsData = {
  label: 'Sections',
  value: 'log',
  tabs: [
    { id: 'chat', label: 'Chat' },
    { id: 'log', label: 'Work log', badge: 42 },
    { id: 'tree', label: 'Agent tree' },
  ],
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('helpers', () => {
  it('tabItems drops junk and duplicates; selectedIndex falls back to the first enabled tab', () => {
    const tabs = tabItems({
      tabs: [
        { id: 'a', label: 'A', disabled: true },
        { id: 'a', label: 'dup' },
        { id: '', label: 'x' },
        { id: 'b', label: 'B' },
      ],
    });
    expect(tabs.map((t) => t.label)).toEqual(['A', 'B']);
    expect(selectedIndex(tabs, 'b')).toBe(1);
    expect(selectedIndex(tabs, 'a')).toBe(1);
    expect(selectedIndex(tabs, 'zz')).toBe(1);
    expect(selectedIndex([], 'zz')).toBe(-1);
  });
});

describe('<ui-tabs>', () => {
  it('renders tablist, tabs and panels wired to each other; only the selected panel shows', () => {
    const el = mount(DATA, {}, ['chat', 'log', 'tree']);
    expect(q(el, '[role="tablist"]')?.getAttribute('aria-label')).toBe('Sections');
    const tabs = qa(el, '[role="tab"]');
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    const panels = qa(el, '[role="tabpanel"]');
    expect(panels.map((p) => p.hidden)).toEqual([true, false, true]);
    expect(tabs[1].getAttribute('aria-controls')).toBe(panels[1].id);
    expect(panels[1].getAttribute('aria-labelledby')).toBe(tabs[1].id);
    expect(panels[1].querySelector('slot')?.getAttribute('name')).toBe('log');
    expect(q(el, '.tb-badge')?.textContent).toBe('42');
    expect(el.value).toBe('log');
  });

  it('escapes labels, badges, titles and slot names', () => {
    const el = mount({
      tabs: [{ id: '"><img src=x>', label: '<b>L</b>', badge: '<i>9</i>', title: '"t"' }],
    });
    expect(q(el, 'img')).toBeNull();
    expect(q(el, 'b')).toBeNull();
    expect(q(el, '.tb-badge i')).toBeNull();
    expect(q(el, '.tb-label')?.textContent).toBe('<b>L</b>');
    expect(q(el, 'slot')?.getAttribute('name')).toBe('"><img src=x>');
    expect(q(el, '.tb-tab')?.title).toBe('"t"');
  });

  it('a click emits a cancelable ui-change and shows the new panel', () => {
    const el = mount(DATA, {}, ['chat', 'log', 'tree']);
    const fired = vi.fn();
    el.addEventListener('ui-change', (e) => fired((e as CustomEvent).detail));
    qa(el, '.tb-tab')[2].click();
    expect(fired).toHaveBeenCalledWith({ value: 'tree', previous: 'log' });
    el.renderNow();
    expect(el.value).toBe('tree');
    expect(qa(el, '[role="tabpanel"]').map((p) => p.hidden)).toEqual([true, true, false]);
  });

  it('preventDefault keeps the tab; the selected tab and disabled tabs send nothing', () => {
    const el = mount({ ...DATA, tabs: [...DATA.tabs, { id: 'x', label: 'X', disabled: true }] });
    const fired = vi.fn((e: Event) => e.preventDefault());
    el.addEventListener('ui-change', fired);
    qa(el, '.tb-tab')[0].click();
    el.renderNow();
    expect(el.value).toBe('log');
    qa(el, '.tb-tab')[1].click();
    qa(el, '.tb-tab')[3].click();
    expect(fired).toHaveBeenCalledTimes(1);
    expect(qa(el, '.tb-tab')[3].getAttribute('aria-disabled')).toBe('true');
  });

  it('arrows move and select (auto), wrap, skip disabled; Home / End', () => {
    const el = mount({
      ...DATA,
      tabs: [DATA.tabs[0], { id: 'off', label: 'Off', disabled: true }, ...DATA.tabs.slice(1)],
    });
    const seen: string[] = [];
    el.addEventListener('ui-change', (e) => seen.push((e as CustomEvent).detail.value));
    const tabs = () => qa(el, '.tb-tab');
    key(tabs()[2], 'ArrowRight');
    el.renderNow();
    expect(el.shadowRoot!.activeElement).toBe(tabs()[3]);
    key(tabs()[3], 'ArrowRight');
    el.renderNow();
    key(tabs()[0], 'ArrowRight');
    el.renderNow();
    key(tabs()[2], 'Home');
    el.renderNow();
    key(tabs()[0], 'End');
    el.renderNow();
    key(tabs()[3], 'ArrowLeft');
    el.renderNow();
    expect(seen).toEqual(['tree', 'chat', 'log', 'chat', 'tree', 'log']);
  });

  it('activation="manual": arrows move focus only, Enter (click) selects', () => {
    const el = mount(DATA, { activation: 'manual' });
    const fired = vi.fn();
    el.addEventListener('ui-change', fired);
    key(qa(el, '.tb-tab')[1], 'ArrowRight');
    expect(fired).not.toHaveBeenCalled();
    const focused = el.shadowRoot!.activeElement as HTMLElement;
    expect(focused).toBe(qa(el, '.tb-tab')[2]);
    expect(focused.getAttribute('tabindex')).toBe('0');
    focused.click();
    expect(fired).toHaveBeenCalledTimes(1);
  });

  it('draws tone dots and icons only from the known set', () => {
    const el = mount({
      tabs: [
        { id: 'a', label: 'A', tone: 'run', icon: 'bot' },
        { id: 'b', label: 'B', tone: 'bogus' as never },
      ],
    });
    expect(q(el, '.tb-dot')?.getAttribute('data-tone')).toBe('run');
    expect(qa(el, '.tb-dot')).toHaveLength(1);
    expect(q(el, '.tb-tab svg[data-icon="bot"]')).not.toBeNull();
  });

  describe('underline', () => {
    let restore: () => void;
    beforeEach(() => {
      const left = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetLeft');
      const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
      Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
        configurable: true,
        get(this: HTMLElement) {
          return Number(this.dataset?.i ?? 0) * 100;
        },
      });
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get(this: HTMLElement) {
          return this.classList?.contains('tb-tab') ? 80 + Number(this.dataset.i) * 10 : 0;
        },
      });
      restore = () => {
        if (left) Object.defineProperty(HTMLElement.prototype, 'offsetLeft', left);
        if (width) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', width);
      };
    });
    afterEach(() => restore());

    it('snaps under the selected tab on first paint, then glides on a change', () => {
      const el = mount(DATA);
      const ind = q(el, '.tb-ind')!;
      expect(q(el, '.tb-list')?.hasAttribute('data-measured')).toBe(true);
      expect(ind.style.transform).toBe('translateX(100px)');
      expect(ind.style.width).toBe('90px');
      expect(ind.hasAttribute('data-still')).toBe(true);
      ind.removeAttribute('data-still');
      qa(el, '.tb-tab')[2].click();
      el.renderNow();
      expect(q(el, '.tb-ind')).toBe(ind);
      expect(ind.style.transform).toBe('translateX(200px)');
      expect(ind.style.width).toBe('100px');
      expect(ind.hasAttribute('data-still')).toBe(false);
    });
  });

  it('without a measurement the selected tab draws its own underline', () => {
    const el = mount(DATA);
    expect(q(el, '.tb-list')?.hasAttribute('data-measured')).toBe(false);
    expect(styles).toContain(
      '.tb-list:not([data-measured]) .tb-tab[aria-selected="true"] { box-shadow: inset 0 -2px 0 var(--ib-text); }',
    );
  });

  it('keeps its nodes across renders, keyed by tab id', () => {
    const el = mount(DATA);
    const tree = qa(el, '.tb-tab')[2];
    el.data = { ...DATA, tabs: [{ id: 'new', label: 'New' }, ...DATA.tabs] };
    el.renderNow();
    expect(qa(el, '.tb-tab')[3]).toBe(tree);
    expect(tree.dataset.i).toBe('3');
  });

  it('renders nothing without tabs', () => {
    expect(q(mount({ tabs: [] }), '.tb')).toBeNull();
  });

  it('styles: underline glides on --dur-move, hover gated, 44px touch, reduced motion snaps', () => {
    expect(styles).toContain(
      'transition: transform var(--dur-move) var(--ease-out), width var(--dur-move) var(--ease-out)',
    );
    expect(styles).toMatch(/@media \(hover: hover\) and \(pointer: fine\)/);
    expect(styles).toMatch(/\.tb-tab \{ min-height: 44px; \}/);
    expect(styles).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.tb-ind \{ transition: none; \}/);
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  it('carries the host’s Korean labels with lang="ko"', () => {
    const el = mount({ label: '세션 섹션', tabs: [{ id: 'log', label: '작업 로그' }] }, { lang: 'ko' });
    expect(q(el, '[role="tablist"]')?.getAttribute('aria-label')).toBe('세션 섹션');
    expect(q(el, '.tb-label')?.textContent).toBe('작업 로그');
  });
});
