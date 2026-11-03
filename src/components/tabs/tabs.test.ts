import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import { styles } from './styles';
import { endIndex, pinnedCount, selectedIndex, type TabsData, tabItems, type UiTabs } from './tabs';

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

  describe('agent strip and section strip (G3)', () => {
    const AGENTS: TabsData = {
      label: 'Agents',
      value: 'a1',
      tabs: [
        { id: 'main', label: 'Main', meta: 'opus-5-5', pinned: true, tone: 'run' },
        { id: 'a1', label: 'A1', meta: 'Explore', tone: 'done' },
        { id: 'a2', label: 'A2', meta: '<b>Review</b>', pinned: true },
      ],
    };

    it('pinnedCount takes the leading run only; endIndex is the first end tab', () => {
      expect(pinnedCount(AGENTS.tabs)).toBe(1);
      expect(pinnedCount([{ id: 'a', label: 'A' }])).toBe(0);
      expect(pinnedCount(AGENTS.tabs.map((t) => ({ ...t, pinned: true })))).toBe(3);
      expect(
        endIndex([
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B', end: true },
          { id: 'c', label: 'C' },
        ]),
      ).toBe(1);
      expect(endIndex([{ id: 'a', label: 'A' }])).toBe(-1);
    });

    it('meta is a muted second label, escaped, inside the tab’s name', () => {
      const el = mount(AGENTS);
      const tabs = qa(el, '.tb-tab');
      expect(tabs[0].querySelector('.tb-meta')?.textContent).toBe('opus-5-5');
      expect(tabs[2].querySelector('.tb-meta b')).toBeNull();
      expect(tabs[2].querySelector('.tb-meta')?.textContent).toBe('<b>Review</b>');
      expect(tabs[0].textContent).toBe('Mainopus-5-5');
      expect(styles).toContain('.tb-meta { color: var(--ib-muted);');
    });

    it('model: the maker’s mark before the label in the maker’s colour, out of the tab’s name (soma-work#813)', () => {
      const el = mount({
        tabs: [
          { id: 'main', label: 'Main', meta: 'Opus 5.5 (1M)', model: 'claude-opus-5-5[1m]', pinned: true },
          { id: 'a1', label: 'A1', meta: 'grok-elon', model: 'grok-4' },
          { id: 'a2', label: 'A2', meta: 'astra', model: 'gpt-5.5' },
          { id: 'a3', label: 'A3', meta: 'log only' },
          { id: 'a4', label: 'A4', model: '<img src=x onerror=alert(1)>' },
        ],
      });
      const tabs = qa(el, '.tb-tab');
      const mark = (i: number) => tabs[i].querySelector<HTMLElement>('.tb-mark');
      expect(mark(0)?.dataset.vendor).toBe('claude');
      expect(mark(0)?.style.getPropertyValue('--model-hue')).toBe('#d97757');
      expect(mark(0)?.getAttribute('aria-hidden')).toBe('true');
      expect(mark(0)?.querySelector('svg')).not.toBeNull();
      // After the status dot, before the label.
      expect(mark(0)?.nextElementSibling?.classList.contains('tb-label')).toBe(true);
      expect(mark(1)?.dataset.vendor).toBe('grok');
      expect(mark(1)?.style.getPropertyValue('--model-hue')).toBe('');
      expect(mark(2)?.dataset.vendor).toBe('openai');
      // No model, no mark — never a guess.
      expect(mark(3)).toBeNull();
      // Host text never reaches the markup: an unknown model is the generic chip.
      expect(mark(4)?.dataset.vendor).toBe('model');
      expect(tabs[4].querySelector('img')).toBeNull();
      // The mark is drawn, not read: the tab's name is its label and meta.
      expect(tabs[0].textContent).toBe('MainOpus 5.5 (1M)');
      expect(styles).toContain('.tb-mark {');
      // The maker's colour in the colour themes; the tab's own ink under the mono palette (--chroma 0, 0.25.0).
      expect(styles).toContain(
        'color: color-mix(in srgb, var(--model-hue, currentColor) calc(100% * var(--chroma)), currentColor)',
      );
      expect(styles).toMatch(/forced-colors: active\) \{[^}]*\.tb-mark \{ color: CanvasText; \}/);
    });

    it('pinned: the leading run is sticky with its own part, the last one carries the fade; later ones are not', () => {
      const el = mount(AGENTS);
      const tabs = qa(el, '.tb-tab');
      expect(tabs.map((t) => t.hasAttribute('data-pinned'))).toEqual([true, false, false]);
      expect(tabs[0].hasAttribute('data-pin-last')).toBe(true);
      expect(tabs[0].getAttribute('part')).toBe('tab pinned');
      expect(tabs[1].getAttribute('part')).toBe('tab selected');
      // Order and keyboard order are the data's.
      expect(tabs.map((t) => t.dataset.key)).toEqual(['main', 'a1', 'a2']);
      expect(styles).toMatch(/\.tb-tab\[data-pinned\] \{\s*position: sticky; inset-inline-start: 0; z-index: 2;/);
      expect(styles).toContain(
        '.tb-tab[data-pinned][aria-selected="true"] { box-shadow: inset 0 -2px 0 var(--ib-text); }',
      );
      expect(styles).toContain('.tb-scroll[data-scrolled] .tb-tab[data-pin-last]::after { opacity: 1; }');
      expect(styles).toContain('--tb-bg: var(--ui-tabs-bg, var(--ib-card))');
    });

    it('the fade shows once the list scrolls; a second pinned tab sticks after the first', () => {
      const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get(this: HTMLElement) {
          return this.classList?.contains('tb-tab') ? 70 : 0;
        },
      });
      try {
        const el = mount({ ...AGENTS, tabs: [AGENTS.tabs[0], { ...AGENTS.tabs[2] }, AGENTS.tabs[1]] });
        const tabs = qa(el, '.tb-tab');
        expect(tabs[0].style.insetInlineStart).toBe('');
        expect(tabs[1].style.insetInlineStart).toBe('70px');
        expect(tabs[1].hasAttribute('data-pin-last')).toBe(true);
        expect(tabs[0].hasAttribute('data-pin-last')).toBe(false);
        const scroller = q(el, '.tb-scroll')!;
        expect(scroller.style.scrollPaddingInlineStart).toBe('140px');
        expect(scroller.hasAttribute('data-scrolled')).toBe(false);
        scroller.scrollLeft = 40;
        scroller.dispatchEvent(new Event('scroll'));
        expect(scroller.hasAttribute('data-scrolled')).toBe(true);
        el.data = { ...el.data! };
        el.renderNow();
        expect(q(el, '.tb-scroll')?.hasAttribute('data-scrolled')).toBe(true);
        expect(qa(el, '.tb-tab')[1].style.insetInlineStart).toBe('70px');
        scroller.scrollLeft = 0;
        scroller.dispatchEvent(new Event('scroll'));
        expect(scroller.hasAttribute('data-scrolled')).toBe(false);
      } finally {
        if (width) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', width);
      }
    });

    it('end: the first end tab (and so the ones after it) sits at the far end; keyboard order is unchanged', () => {
      const el = mount({
        label: 'Sections',
        value: 'chat',
        tabs: [
          { id: 'chat', label: 'Chat' },
          { id: 'log', label: 'Work log' },
          { id: 'tree', label: 'Agent tree', icon: 'tree', end: true },
          { id: 'x', label: 'X', end: true },
        ],
      });
      const tabs = qa(el, '.tb-tab');
      expect(tabs.map((t) => t.hasAttribute('data-end'))).toEqual([false, false, true, false]);
      expect(tabs[2].getAttribute('part')).toBe('tab end');
      expect(styles).toContain('.tb-tab[data-end] { margin-inline-start: auto; }');
      const seen: string[] = [];
      el.addEventListener('ui-change', (e) => seen.push((e as CustomEvent).detail.value));
      key(tabs[1], 'ArrowRight');
      expect(seen).toEqual(['tree']);
    });

    it('shared-panel: one default-slot panel every tab controls, labelled by the selected tab', () => {
      const el = mount(AGENTS, { 'shared-panel': '' });
      const own = document.createElement('div');
      own.textContent = 'agent header · Tasks · sections';
      el.append(own);
      const panels = qa(el, '[role="tabpanel"]');
      expect(panels).toHaveLength(1);
      expect(panels[0].id).toBe('tb-p');
      expect(panels[0].hidden).toBe(false);
      expect(panels[0].querySelector('slot')?.hasAttribute('name')).toBe(false);
      expect(qa(el, '.tb-tab').map((t) => t.getAttribute('aria-controls'))).toEqual(['tb-p', 'tb-p', 'tb-p']);
      expect(panels[0].getAttribute('aria-labelledby')).toBe('tb-t-1');
      qa(el, '.tb-tab')[0].click();
      el.renderNow();
      expect(q(el, '[role="tabpanel"]')).toBe(panels[0]);
      expect(panels[0].getAttribute('aria-labelledby')).toBe('tb-t-0');
      el.removeAttribute('shared-panel');
      el.renderNow();
      expect(qa(el, '[role="tabpanel"]')).toHaveLength(3);
    });

    it('panel-focus="none": the panel is no tab stop (the slotted scroller is); default panels stay focusable', () => {
      const el = mount(DATA, { 'panel-focus': 'none' }, ['chat', 'log', 'tree']);
      expect(qa(el, '[role="tabpanel"]').every((p) => !p.hasAttribute('tabindex'))).toBe(true);
      const shared = mount(DATA, { 'panel-focus': 'none', 'shared-panel': '' });
      expect(q(shared, '[role="tabpanel"]')?.hasAttribute('tabindex')).toBe(false);
      el.removeAttribute('panel-focus');
      el.renderNow();
      expect(qa(el, '[role="tabpanel"]').every((p) => p.getAttribute('tabindex') === '0')).toBe(true);
    });
  });

  it('carries the host’s Korean labels with lang="ko"', () => {
    const el = mount({ label: '세션 섹션', tabs: [{ id: 'log', label: '작업 로그' }] }, { lang: 'ko' });
    expect(q(el, '[role="tablist"]')?.getAttribute('aria-label')).toBe('세션 섹션');
    expect(q(el, '.tb-label')?.textContent).toBe('작업 로그');
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    spy = soundSpy();
  });
  afterEach(() => spy.restore());
  const click = (t: HTMLElement, detail = 1) =>
    t.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail }));

  it('another tab plays a subtle select, forward to a later tab and back to an earlier one', async () => {
    const el = mount(DATA);
    click(qa(el, '.tb-tab')[2]);
    await spy.settle();
    el.renderNow();
    key(qa(el, '.tb-tab')[2], 'Home');
    await spy.settle();
    expect(spy.calls).toEqual([
      ['select', { emphasis: 'subtle', direction: 'forward', input: 'mouse' }],
      ['select', { emphasis: 'subtle', direction: 'back', input: 'keyboard' }],
    ]);
  });

  it('manual activation: arrows only move focus; Enter (a click from the keyboard) selects', async () => {
    const el = mount(DATA, { activation: 'manual' });
    key(qa(el, '.tb-tab')[1], 'ArrowLeft');
    await spy.settle();
    expect(spy.calls).toEqual([]);
    click(qa(el, '.tb-tab')[0], 0);
    await spy.settle();
    expect(spy.calls).toEqual([['select', { emphasis: 'subtle', direction: 'back', input: 'keyboard' }]]);
  });

  it('silent for the current tab, a cancelled change, data the app sets, and a quiet region', async () => {
    const el = mount(DATA);
    click(qa(el, '.tb-tab')[1]);
    el.addEventListener('ui-change', (e) => e.preventDefault(), { once: true });
    click(qa(el, '.tb-tab')[0]);
    el.data = { ...DATA, value: 'tree' };
    el.renderNow();
    await spy.settle();
    const quiet = document.createElement('div');
    quiet.setAttribute('data-ui-sound', 'off');
    document.body.append(quiet);
    quiet.append(el);
    click(qa(el, '.tb-tab')[0]);
    await spy.settle();
    expect(el.value).toBe('chat');
    expect(spy.calls).toEqual([]);
  });
});
