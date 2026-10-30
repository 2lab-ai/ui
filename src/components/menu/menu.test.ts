import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyMenuSelect,
  type MenuData,
  type MenuItem,
  menuItemKind,
  menuRadioGroups,
  menuTypeahead,
  type UiMenu,
} from './menu';
import { styles } from './styles';

const XSS = '<img src=x onerror=alert(1)>';

const DEFAULTS: MenuData = {
  label: 'Default model',
  items: [
    { kind: 'heading', label: 'Default model' },
    { kind: 'radio', value: 'opus', label: 'Opus 5.5', description: 'Most capable' },
    { kind: 'radio', value: 'sonnet', label: 'Sonnet 5', description: 'Balanced', checked: true },
    { kind: 'radio', value: 'haiku', label: 'Haiku 5', description: 'Fastest' },
    { kind: 'separator' },
    { kind: 'checkbox', value: 'apply', label: 'Apply to open sessions' },
  ],
};

const ACTIONS: MenuData = {
  items: [
    { value: 'copy', label: 'Copy link', icon: 'copy', shortcut: '⌘C' },
    { value: 'open', label: 'Open in new tab', icon: 'external' },
    { value: 'download', label: 'Download', disabled: true },
    { kind: 'separator' },
    { value: 'delete', label: 'Delete', icon: 'trash', danger: true },
  ],
};

function mount(data: MenuData, attrs: Record<string, string> = {}): { el: UiMenu; trig: HTMLButtonElement } {
  const el = document.createElement('ui-menu') as UiMenu;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  const trig = document.createElement('button');
  trig.slot = 'trigger';
  trig.textContent = 'Open';
  el.append(trig);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return { el, trig };
}
const q = (el: UiMenu, s: string) => el.shadowRoot!.querySelector<HTMLElement>(s);
const qa = (el: UiMenu, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const items = (el: UiMenu) => qa(el, '.mn-item');
const focused = (el: UiMenu) => el.shadowRoot!.activeElement as HTMLElement | null;
const label = (el: UiMenu) => focused(el)?.querySelector('.mn-label')?.textContent;
const key = (t: Element, k: string, init: KeyboardEventInit = {}) =>
  t.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init }));
const press = (t: Element) => t.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  vi.useRealTimers();
});

describe('helpers', () => {
  it('menuItemKind keeps real rows and drops junk', () => {
    expect(menuItemKind({ value: 'a' })).toBe('item');
    expect(menuItemKind({ kind: 'radio', value: 'a' })).toBe('radio');
    expect(menuItemKind({ kind: 'separator' })).toBe('separator');
    expect(menuItemKind({ kind: 'heading', label: 'H' })).toBe('heading');
    expect(menuItemKind({ kind: 'heading' })).toBeNull();
    expect(menuItemKind({ label: 'no value' })).toBeNull();
    expect(menuItemKind({ kind: 'bogus' as never, value: 'a' })).toBeNull();
    expect(menuItemKind(null)).toBeNull();
  });

  it('radio groups: the run between separators / headings, or an explicit group', () => {
    const items: MenuItem[] = [
      { kind: 'radio', value: 'a' },
      { kind: 'radio', value: 'b' },
      { kind: 'separator' },
      { kind: 'radio', value: 'c' },
      { kind: 'radio', value: 'd', group: 'x' },
      { kind: 'heading', label: 'H' },
      { kind: 'radio', value: 'e', group: 'x' },
      { value: 'f' },
    ];
    expect(menuRadioGroups(items)).toEqual(['r:0', 'r:0', '', 'r:1', 'g:x', '', 'g:x', '']);
    const after = applyMenuSelect(items, 6);
    expect(after.map((x) => !!x.checked)).toEqual([false, false, false, false, false, false, true, false]);
    expect(after[0]).toBe(items[0]); // other groups untouched
    expect(applyMenuSelect([{ kind: 'checkbox', value: 'c', checked: true }], 0)[0].checked).toBe(false);
  });

  it('typeahead: one letter cycles from the next row, a longer query stays on a match, disabled skipped', () => {
    const labels = ['Opus', 'Sonnet', 'Sonata', 'Haiku'];
    const off = [false, false, false, false];
    expect(menuTypeahead(labels, off, 0, 's')).toBe(1);
    expect(menuTypeahead(labels, off, 1, 's')).toBe(2);
    expect(menuTypeahead(labels, off, 2, 'ss')).toBe(1);
    expect(menuTypeahead(labels, off, 1, 'son')).toBe(1);
    expect(menuTypeahead(labels, off, 1, 'sona')).toBe(2);
    expect(menuTypeahead(labels, [false, true, false, false], 0, 's')).toBe(2);
    expect(menuTypeahead(labels, off, -1, 'O')).toBe(0);
    expect(menuTypeahead(labels, off, 0, 'z')).toBe(-1);
  });
});

describe('<ui-menu>', () => {
  it('wires the trigger and draws a closed, inert role="menu" with typed rows', () => {
    const { el, trig } = mount(DEFAULTS);
    expect(trig.getAttribute('aria-haspopup')).toBe('menu');
    expect(trig.getAttribute('aria-expanded')).toBe('false');
    const pop = q(el, '.mn-pop')!;
    expect(pop.getAttribute('role')).toBe('menu');
    expect(pop.getAttribute('aria-label')).toBe('Default model');
    expect(pop.getAttribute('tabindex')).toBe('-1');
    expect(pop.hasAttribute('inert')).toBe(true);
    expect(pop.classList.contains('is-open')).toBe(false);
    expect(items(el).map((x) => x.getAttribute('role'))).toEqual([
      'menuitemradio',
      'menuitemradio',
      'menuitemradio',
      'menuitemcheckbox',
    ]);
    expect(items(el).every((x) => x.getAttribute('tabindex') === '-1')).toBe(true);
    expect(items(el).map((x) => x.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false']);
    expect(q(el, '[role="separator"]')).not.toBeNull();
    // Runs are groups; the first is named by its heading.
    const groups = qa(el, '[role="group"]');
    expect(groups).toHaveLength(2);
    const head = el.shadowRoot!.getElementById(groups[0].getAttribute('aria-labelledby')!)!;
    expect(head.textContent).toBe('Default model');
    expect(head.getAttribute('aria-hidden')).toBe('true');
    expect(groups[1].hasAttribute('aria-labelledby')).toBe(false);
  });

  it('draws the check column, icons, descriptions, shortcuts, danger and disabled rows', () => {
    const { el } = mount(DEFAULTS);
    const [opus, sonnet, , apply] = items(el);
    expect(sonnet.querySelector('.mn-check svg[data-icon="check"]')).not.toBeNull();
    expect(opus.querySelector('.mn-check')!.innerHTML).toBe('');
    expect(apply.querySelector('.mn-check .mn-box')).not.toBeNull();
    expect(opus.getAttribute('aria-describedby')).toBe(opus.querySelector('.mn-desc')!.id);
    const b = mount(ACTIONS).el;
    const [copy, , download, del] = items(b);
    expect(copy.querySelector('.mn-check')).toBeNull(); // no checkable rows → no check column
    expect(copy.getAttribute('role')).toBe('menuitem');
    expect(copy.hasAttribute('aria-checked')).toBe(false);
    expect(copy.querySelector('.mn-icon svg[data-icon="copy"]')).not.toBeNull();
    expect(copy.querySelector('kbd.mn-kbd')!.textContent).toBe('⌘C');
    expect(download.getAttribute('aria-disabled')).toBe('true');
    expect(del.classList.contains('is-danger')).toBe(true);
    expect(qa(b, '[role="group"]')).toHaveLength(2);
  });

  it('escapes every string: label, description, shortcut, heading, value, menu name', () => {
    const { el } = mount({
      label: XSS,
      items: [
        { kind: 'heading', label: XSS },
        { kind: 'radio', value: '"><b>v', label: XSS, description: XSS, shortcut: XSS },
        { value: '<i>x</i>' },
      ],
    });
    expect(q(el, 'img')).toBeNull();
    expect(q(el, 'b')).toBeNull();
    expect(q(el, 'i:not(.mn-probe)')).toBeNull();
    expect(q(el, '.mn-pop')!.getAttribute('aria-label')).toBe(XSS);
    expect(q(el, '.mn-head')!.textContent).toBe(XSS);
    expect(q(el, '.mn-label')!.textContent).toBe(XSS);
    expect(q(el, '.mn-desc')!.textContent).toBe(XSS);
    expect(q(el, '.mn-kbd')!.textContent).toBe(XSS);
    expect(items(el)[0].dataset.mk).toBe('radio:"><b>v');
    expect(items(el)[1].querySelector('.mn-label')!.textContent).toBe('<i>x</i>'); // label falls back to value
  });

  it('a click on the trigger opens on the checked radio; again closes onto the trigger', () => {
    const { el, trig } = mount(DEFAULTS);
    const changes: boolean[] = [];
    el.addEventListener('ui-open-change', (e) => changes.push((e as CustomEvent).detail.open));
    trig.click();
    expect(el.open).toBe(true);
    expect(el.hasAttribute('open')).toBe(true);
    expect(trig.getAttribute('aria-expanded')).toBe('true');
    expect(q(el, '.mn-pop')!.classList.contains('is-open')).toBe(true);
    expect(q(el, '.mn-pop')!.hasAttribute('inert')).toBe(false);
    expect(label(el)).toBe('Sonnet 5');
    trig.click();
    expect(el.open).toBe(false);
    expect(trig.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trig);
    expect(changes).toEqual([true, false]);
  });

  it('↓ on the trigger opens on the checked radio (else the first row); ↑ on the last row', () => {
    const { el, trig } = mount(DEFAULTS);
    trig.focus();
    key(trig, 'ArrowDown');
    expect(el.open).toBe(true);
    expect(label(el)).toBe('Sonnet 5');
    key(focused(el)!, 'Escape');
    key(trig, 'ArrowUp');
    expect(label(el)).toBe('Apply to open sessions');
    const b = mount(ACTIONS);
    key(b.trig, 'ArrowDown');
    expect(label(b.el)).toBe('Copy link');
    key(focused(b.el)!, 'Escape');
    key(b.trig, 'ArrowUp');
    expect(label(b.el)).toBe('Delete');
  });

  it('arrows wrap and skip disabled rows, separators and headings; Home / End', () => {
    const { el, trig } = mount(ACTIONS);
    key(trig, 'ArrowDown');
    const seen: Array<string | null | undefined> = [];
    for (const k of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp', 'End', 'Home']) {
      key(focused(el)!, k);
      seen.push(label(el));
    }
    expect(seen).toEqual([
      'Open in new tab',
      'Delete',
      'Copy link',
      'Delete',
      'Open in new tab',
      'Delete',
      'Copy link',
    ]);
  });

  it('typeahead focuses by label and the buffer resets after 500ms', () => {
    vi.useFakeTimers();
    const { el, trig } = mount(DEFAULTS);
    key(trig, 'ArrowDown');
    key(focused(el)!, 'h');
    expect(label(el)).toBe('Haiku 5');
    key(focused(el)!, 'O');
    expect(label(el)).toBe('Haiku 5'); // "ho" matches nothing
    vi.advanceTimersByTime(500);
    key(focused(el)!, 'o');
    expect(label(el)).toBe('Opus 5.5');
    key(focused(el)!, 'Control', { ctrlKey: true });
    expect(label(el)).toBe('Opus 5.5');
  });

  it('Enter on an action sends ui-select, closes and gives focus back to the trigger', () => {
    const { el, trig } = mount(ACTIONS);
    const fired = vi.fn();
    el.addEventListener('ui-select', (e) => fired((e as CustomEvent).detail));
    key(trig, 'ArrowDown');
    key(focused(el)!, 'Enter');
    expect(fired).toHaveBeenCalledWith({ value: 'copy', kind: 'item', checked: false });
    expect(el.open).toBe(false);
    expect(document.activeElement).toBe(trig);
  });

  it('a radio checks and its run unchecks; the checked radio only closes', () => {
    const data: MenuData = {
      items: [
        { kind: 'radio', value: 'a', label: 'A', checked: true },
        { kind: 'radio', value: 'b', label: 'B' },
        { kind: 'separator' },
        { kind: 'radio', value: 'c', label: 'C', checked: true },
        { kind: 'radio', value: 'd', label: 'D' },
      ],
    };
    const { el, trig } = mount(data);
    const fired = vi.fn();
    el.addEventListener('ui-select', (e) => fired((e as CustomEvent).detail));
    trig.click();
    items(el)[3].click();
    expect(fired).toHaveBeenLastCalledWith({ value: 'd', kind: 'radio', checked: true });
    expect(el.open).toBe(false);
    el.renderNow();
    expect(items(el).map((x) => x.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'true']);
    trig.click();
    items(el)[0].click(); // already checked
    expect(fired).toHaveBeenCalledTimes(1);
    expect(el.open).toBe(false);
  });

  it('an explicit group spans separators', () => {
    const { el, trig } = mount({
      items: [
        { kind: 'radio', value: 'a', label: 'A', group: 'g', checked: true },
        { kind: 'separator' },
        { kind: 'radio', value: 'b', label: 'B', group: 'g' },
        { kind: 'radio', value: 'c', label: 'C', checked: true },
      ],
    });
    trig.click();
    items(el)[1].click();
    el.renderNow();
    expect(items(el).map((x) => x.getAttribute('aria-checked'))).toEqual(['false', 'true', 'true']);
  });

  it('a checkbox toggles and the menu stays open with focus on it', () => {
    const { el, trig } = mount(DEFAULTS);
    const fired = vi.fn();
    el.addEventListener('ui-select', (e) => fired((e as CustomEvent).detail));
    trig.click();
    const box = items(el)[3];
    box.focus();
    key(box, ' ');
    expect(fired).toHaveBeenCalledWith({ value: 'apply', kind: 'checkbox', checked: true });
    el.renderNow();
    expect(el.open).toBe(true);
    expect(items(el)[3]).toBe(box);
    expect(box.getAttribute('aria-checked')).toBe('true');
    expect(box.querySelector('svg[data-icon="check"]')).not.toBeNull();
    expect(focused(el)).toBe(box);
  });

  it('preventDefault keeps the state and the menu open; a listener’s own data wins', () => {
    const { el, trig } = mount(DEFAULTS);
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('ui-select', stop);
    trig.click();
    items(el)[0].click();
    el.renderNow();
    expect(el.open).toBe(true);
    expect(items(el).map((x) => x.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false']);
    el.removeEventListener('ui-select', stop);
    const mine: MenuData = { ...DEFAULTS, items: DEFAULTS.items.map((x) => ({ ...x, checked: x.value === 'haiku' })) };
    el.addEventListener('ui-select', () => {
      el.data = mine;
    });
    items(el)[0].click();
    expect(el.data).toBe(mine);
  });

  it('Esc and Tab close onto the trigger; keys inside never reach the page', () => {
    const { el, trig } = mount(DEFAULTS);
    const page = vi.fn();
    document.addEventListener('keydown', page);
    const changes = vi.fn();
    el.addEventListener('ui-open-change', changes);
    key(trig, 'ArrowDown');
    key(focused(el)!, 'ArrowDown');
    key(focused(el)!, 'Escape');
    expect(el.open).toBe(false);
    expect(document.activeElement).toBe(trig);
    key(trig, 'ArrowDown');
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true, cancelable: true });
    focused(el)!.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(el.open).toBe(false);
    expect(document.activeElement).toBe(trig);
    // Only the trigger's own ↓ presses reached the page.
    expect(page.mock.calls.map((c) => (c[0] as KeyboardEvent).key)).toEqual(['ArrowDown', 'ArrowDown']);
    expect(changes).toHaveBeenCalledTimes(4);
    document.removeEventListener('keydown', page);
  });

  it('a press outside closes without moving focus; inside or on the trigger it does not', () => {
    const { el, trig } = mount(DEFAULTS);
    const out = document.createElement('button');
    document.body.append(out);
    trig.click();
    const row = focused(el)!;
    press(row);
    press(trig);
    expect(el.open).toBe(true);
    press(out);
    expect(el.open).toBe(false);
    expect(document.activeElement).not.toBe(trig);
  });

  it('focus moving outside closes it', () => {
    const { el, trig } = mount(DEFAULTS);
    const out = document.createElement('button');
    document.body.append(out);
    trig.click();
    out.focus();
    out.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
    expect(el.open).toBe(false);
  });

  it('the open attribute and property open it without an event and without moving focus', () => {
    const { el, trig } = mount(DEFAULTS);
    const changes = vi.fn();
    el.addEventListener('ui-open-change', changes);
    el.setAttribute('open', '');
    expect(el.open).toBe(true);
    expect(trig.getAttribute('aria-expanded')).toBe('true');
    expect(focused(el)).toBeNull();
    el.open = false;
    expect(el.hasAttribute('open')).toBe(false);
    el.open = true;
    expect(el.hasAttribute('open')).toBe(true);
    el.removeAttribute('open');
    expect(el.open).toBe(false);
    expect(changes).not.toHaveBeenCalled();
  });

  it('show(anchor) hangs it from an external anchor and gives focus back there', () => {
    const { el, trig } = mount(DEFAULTS);
    const ext = document.createElement('button');
    document.body.append(ext);
    const changes: boolean[] = [];
    el.addEventListener('ui-open-change', (e) => changes.push((e as CustomEvent).detail.open));
    el.show(ext);
    expect(el.anchor).toBe(ext);
    expect(ext.getAttribute('aria-haspopup')).toBe('menu');
    expect(ext.getAttribute('aria-expanded')).toBe('true');
    expect(trig.getAttribute('aria-expanded')).toBe('false');
    expect(label(el)).toBe('Sonnet 5');
    press(ext); // a press on the anchor is not "outside"
    expect(el.open).toBe(true);
    key(focused(el)!, 'Escape');
    expect(document.activeElement).toBe(ext);
    expect(ext.getAttribute('aria-expanded')).toBe('false');
    el.toggle(ext);
    expect(el.open).toBe(true);
    el.toggle(ext);
    expect(el.open).toBe(false);
    expect(document.activeElement).toBe(ext);
    expect(changes).toEqual([false]); // only the user's Esc; show / hide / toggle are the host's own calls
    el.anchor = null;
    expect(ext.hasAttribute('aria-haspopup')).toBe(false);
    expect(ext.hasAttribute('aria-expanded')).toBe(false);
  });

  it('the pointer focuses enabled rows it moves over; disabled rows do nothing', () => {
    const { el, trig } = mount(ACTIONS);
    const fired = vi.fn();
    el.addEventListener('ui-select', fired);
    trig.click();
    const [, open, download] = items(el);
    open.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, composed: true, pointerType: 'mouse' }));
    expect(focused(el)).toBe(open);
    download.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, composed: true, pointerType: 'mouse' }));
    expect(focused(el)).toBe(open);
    download.click();
    expect(fired).not.toHaveBeenCalled();
    expect(el.open).toBe(true);
  });

  it('a disabled trigger does not open it', () => {
    const { el, trig } = mount(DEFAULTS);
    trig.setAttribute('aria-disabled', 'true');
    trig.click();
    key(trig, 'ArrowDown');
    expect(el.open).toBe(false);
  });

  it('names itself “Menu” / “메뉴” without data.label', () => {
    expect(q(mount(ACTIONS).el, '.mn-pop')!.getAttribute('aria-label')).toBe('Menu');
    const { el } = mount({ items: [{ kind: 'radio', value: 'a', label: '기본 모델' }] }, { lang: 'ko' });
    expect(q(el, '.mn-pop')!.getAttribute('aria-label')).toBe('메뉴');
    expect(q(el, '.mn-label')!.textContent).toBe('기본 모델');
  });

  it('keeps its nodes across renders and leaves no listener behind after disconnect', () => {
    const { el, trig } = mount(DEFAULTS);
    const pop = q(el, '.mn-pop');
    trig.click();
    expect(q(el, '.mn-pop')).toBe(pop);
    const remove = vi.spyOn(document, 'removeEventListener');
    el.remove();
    expect(remove.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(['pointerdown', 'focusin', 'scroll']));
    remove.mockRestore();
  });

  it('styles: origin-aware pop, 160/220ms open, 180ms exit with delayed visibility, gentle reduced motion', () => {
    expect(styles).toContain('transform: translateY(-4px) scale(0.96)');
    expect(styles).toContain(
      '.mn-pop[data-side="top"] { transform-origin: bottom left; transform: translateY(4px) scale(0.96); }',
    );
    expect(styles).toContain('.mn-pop[data-side="top"][data-align="end"] { transform-origin: bottom right; }');
    expect(styles).toContain('.mn-pop[data-align="end"] { transform-origin: top right; }');
    expect(styles).toContain(
      'transition: opacity 160ms var(--ease-out), transform 220ms var(--ease-out), visibility 0s;',
    );
    expect(styles).toContain(
      'transition: opacity 180ms var(--ease-out), transform 180ms var(--ease-out), visibility 0s linear 180ms;',
    );
    expect(styles).not.toMatch(/scale\(0\)/);
    expect(styles).toMatch(/@media \(pointer: coarse\), \(max-width: 639px\) \{\s*\.mn-item \{ min-height: 44px; \}/);
    expect(styles).toMatch(
      /prefers-reduced-motion: reduce\) \{\s*\.mn-pop, \.mn-pop\[data-side="top"\] \{ transform: none; transition: opacity 120ms ease/,
    );
    expect(styles).toContain('outline: 2px solid var(--border-focus); outline-offset: -2px;');
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});
