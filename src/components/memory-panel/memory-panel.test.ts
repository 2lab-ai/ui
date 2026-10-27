import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { doc } from './docs';
import {
  entryKeys,
  entryMatches,
  FOLD_MS,
  highlight,
  isSameEdit,
  type MemoryPanelData,
  type MemoryStore,
  shortText,
  storeUsed,
  type UiMemoryPanel,
  UNDO_MS,
  usageAfterAdd,
  usageLevel,
} from './memory-panel';

const XSS = '<img src=x onerror=alert(1)>';
const SEP = '\n§\n';

const store = (over: Partial<MemoryStore> = {}): MemoryStore => ({
  id: 'memory',
  label: 'Agent notes',
  file: 'MEMORY.md',
  limit: 2200,
  perEntryLimit: 660,
  separator: SEP,
  entries: ['Repo uses pnpm', 'Deploys via release/*', 'Staging DB is read-only'],
  ...over,
});
const user = (over: Partial<MemoryStore> = {}): MemoryStore =>
  store({
    id: 'user',
    label: 'User profile',
    file: 'USER.md',
    limit: 1375,
    perEntryLimit: 412,
    entries: ['Prefers short answers', 'Timezone Asia/Seoul'],
    ...over,
  });
const BASE = (): MemoryPanelData => ({ stores: [store(), user()] });

function mount(data: MemoryPanelData = BASE(), attrs: Record<string, string> = {}): UiMemoryPanel {
  const el = document.createElement('ui-memory-panel') as UiMemoryPanel;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const sr = (el: UiMemoryPanel) => el.shadowRoot!;
const q = <E extends Element = HTMLElement>(el: UiMemoryPanel, s: string) => sr(el).querySelector<E>(s);
const qa = <E extends Element = HTMLElement>(el: UiMemoryPanel, s: string) => Array.from(sr(el).querySelectorAll<E>(s));
const byKey = (el: UiMemoryPanel, key: string) => qa(el, '[data-key]').find((b) => b.dataset.key === key) ?? null;
const group = (el: UiMemoryPanel, id: string) => qa(el, '.mm-group').find((g) => g.dataset.store === id)!;
const rowsOf = (el: UiMemoryPanel, id: string) => Array.from(group(el, id).querySelectorAll<HTMLElement>('.mm-rowf'));
const act = (el: UiMemoryPanel, id: string, i: number, kind: string) =>
  rowsOf(el, id)[i].querySelector<HTMLButtonElement>(`[data-act="${kind}"]`)!;
const key = (target: Element, k: string, init: KeyboardEventInit = {}) => {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(ev);
  return ev;
};
const active = (el: UiMemoryPanel) => (sr(el).activeElement as HTMLElement | null)?.dataset?.key ?? null;
const caption = (el: UiMemoryPanel) => q(el, '.mm-caption .mm-swap:not([data-out])')?.textContent ?? '';
const live = (el: UiMemoryPanel) => q(el, '.mm-live')?.textContent ?? '';
const outside = () => {
  const b = document.createElement('button');
  document.body.append(b);
  b.focus();
  return b;
};

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('helpers', () => {
  it('counts usage like the store: entries joined with the separator', () => {
    expect(storeUsed([])).toBe(0);
    expect(storeUsed(['abc', 'de'], SEP)).toBe(8);
    expect(storeUsed(['abc', 'de'])).toBe(5);
  });
  it('bands usage: warn from 80 %, high from 95 %, full from 100 %', () => {
    expect(usageLevel(1759, 2200)).toBe('ok');
    expect(usageLevel(1760, 2200)).toBe('warn');
    expect(usageLevel(2170, 2200)).toBe('high');
    expect(usageLevel(2200, 2200)).toBe('full');
    expect(usageLevel(10, 0)).toBe('ok');
  });
  it('projects the usage after an add: trimmed text plus one separator', () => {
    expect(usageAfterAdd([], SEP, '  hello ')).toBe(5);
    expect(usageAfterAdd(['abc'], SEP, 'hello')).toBe(11);
    expect(usageAfterAdd(['abc'], SEP, '   ')).toBe(3);
  });
  it('compares an edit trimmed on both sides', () => {
    expect(isSameEdit('  same text \n', 'same text')).toBe(true);
    expect(isSameEdit('same text', ' same text  ')).toBe(true);
    expect(isSameEdit('same  text', 'same text')).toBe(false);
  });
  it('shortens to 40 characters with an ellipsis', () => {
    expect(shortText('a'.repeat(40))).toBe('a'.repeat(40));
    expect(shortText('a'.repeat(41))).toBe(`${'a'.repeat(40)}…`);
  });
  it('matches the trimmed query case-insensitively in the text or the store name', () => {
    expect(entryMatches('Deploys via release', '  DEPLOY ')).toBe(true);
    expect(entryMatches('Deploys via release', 'nope')).toBe(false);
    expect(entryMatches('anything', 'user.md', { label: 'User profile', file: 'USER.md' })).toBe(true);
    expect(entryMatches('anything', '')).toBe(true);
  });
  it('highlights every match and escapes everything', () => {
    expect(highlight('Deploy and deploy', 'deploy')).toBe('<mark>Deploy</mark> and <mark>deploy</mark>');
    expect(highlight(`${XSS} img`, 'img')).toBe('&lt;<mark>img</mark> src=x onerror=alert(1)&gt; <mark>img</mark>');
    expect(highlight('a<b', '<')).toBe('a<mark>&lt;</mark>b');
    expect(highlight('plain', '')).toBe('plain');
  });
  it('keys rows by content so a shift keeps the key, duplicates stay distinct', () => {
    const [a, b, c] = entryKeys(['one', 'two', 'three']);
    expect(entryKeys(['two', 'three'])).toEqual([b, c]);
    expect(a).not.toBe(b);
    const dup = entryKeys(['x', 'x']);
    expect(dup[0]).not.toBe(dup[1]);
  });
});

describe('<ui-memory-panel> rendering', () => {
  it('renders nothing without stores', () => {
    const el = mount({} as MemoryPanelData);
    expect(q(el, '.mm')).toBeNull();
  });

  it('draws the store chips as a radiogroup with counts and one tab stop', () => {
    const el = mount();
    const rg = q(el, '.mm-chips')!;
    expect(rg.getAttribute('role')).toBe('radiogroup');
    expect(rg.getAttribute('aria-label')).toBe('Stores');
    const chips = qa(el, '.mm-chip');
    expect(chips.map((c) => c.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'All 5',
      'Agent notes 3',
      'User profile 2',
    ]);
    expect(chips.map((c) => c.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(chips.map((c) => c.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  it('draws one named group per store with its usage meter and numbered rows', () => {
    const el = mount();
    const g = group(el, 'memory');
    expect(g.tagName).toBe('SECTION');
    const h = sr(el).getElementById(g.getAttribute('aria-labelledby')!)!;
    expect(h.tagName).toBe('H3');
    expect(h.textContent).toBe('Agent notes MEMORY.md');
    const used = storeUsed(store().entries, SEP);
    const meter = g.querySelector('[role="meter"]')!;
    expect(meter.getAttribute('aria-valuemax')).toBe('2200');
    expect(meter.getAttribute('aria-valuenow')).toBe(String(used));
    expect(meter.getAttribute('aria-valuetext')).toBe(`${used} / 2,200 chars`);
    expect(meter.getAttribute('aria-label')).toBe('Agent notes usage');
    expect(g.querySelector('.mm-usage')?.getAttribute('data-level')).toBe('ok');
    expect(rowsOf(el, 'memory').map((r) => r.querySelector('.mm-src')?.textContent)).toEqual([
      '#1 · 14 chars',
      '#2 · 21 chars',
      '#3 · 23 chars',
    ]);
    expect(act(el, 'memory', 0, 'edit').getAttribute('aria-label')).toBe('Edit “Repo uses pnpm”');
    expect(act(el, 'memory', 0, 'delete').getAttribute('aria-label')).toBe('Delete “Repo uses pnpm”');
    expect(byKey(el, 'add|memory')?.textContent).toBe('+ Add to Agent notes');
    expect(byKey(el, 'clear|memory')?.textContent).toBe('Clear all');
  });

  it('bands the usage (amber text, red bar from 95 %) and flags entries over the per-entry limit', () => {
    const long = 'x'.repeat(700);
    const el = mount({
      stores: [store({ entries: [long, 'y'.repeat(600), 'w'.repeat(884)] }), user({ entries: ['z'.repeat(1200)] })],
    });
    const mem = group(el, 'memory').querySelector('.mm-usage')!;
    expect(mem.getAttribute('data-level')).toBe('high');
    expect(mem.querySelector('.mm-uval')?.textContent).toBe('2,190 / 2,200 chars');
    expect(group(el, 'user').querySelector('.mm-usage')?.getAttribute('data-level')).toBe('warn');
    expect(rowsOf(el, 'memory')[0].querySelector('.mm-over')?.textContent).toBe('over the per-entry limit');
    expect(rowsOf(el, 'memory')[1].querySelector('.mm-over')).toBeNull();
  });

  it('says “full” once usage reaches the limit', () => {
    const el = mount({ stores: [store({ entries: ['a'.repeat(2200)] })] });
    expect(group(el, 'memory').querySelector('.mm-uval')?.textContent).toBe('2,200 / 2,200 chars · full');
  });

  it('shows the empty state and the tray summary', () => {
    const el = mount({ stores: [store({ entries: [] }), user()] });
    expect(group(el, 'memory').querySelector('.mm-empty')?.textContent).toBe('Empty — add an entry below.');
    expect(byKey(el, 'clear|memory')).toBeNull();
    expect(caption(el)).toBe('2 entries · Agent notes 0 / 2,200 chars · User profile 43 / 1,375 chars');
    expect(live(el)).toBe(caption(el));
    expect(q(el, '.mm-caption')?.getAttribute('aria-hidden')).toBe('true');
    expect(q(el, '.mm-live')?.getAttribute('aria-live')).toBe('polite');
  });

  it('shows a title with the entry count when given', () => {
    const el = mount({ ...BASE(), title: 'Personal memory' });
    expect(q(el, '.mm')?.getAttribute('aria-labelledby')).toBe('mm-title');
    expect(q(el, '.mm-title')?.textContent).toBe('Personal memory');
    expect(q(el, '.mm-count')?.textContent).toBe('5');
    expect(q(el, '.mm-count')?.getAttribute('aria-hidden')).toBe('true');
    expect(q(mount(), '.mm')?.getAttribute('aria-label')).toBe('Personal memory');
  });

  it('escapes every host string: labels, files, ids, entries, title, reason, search, tray', () => {
    const el = mount({
      title: XSS,
      readOnly: false,
      stores: [store({ id: `"${XSS}`, label: XSS, file: XSS, entries: [XSS, `${XSS} img`] })],
    });
    expect(q(el, 'img')).toBeNull();
    expect(q(el, '.mm-title')?.innerHTML).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(q(el, '.mm-text')?.innerHTML).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(q(el, '.mm-group')?.dataset.store).toBe(`"${XSS}`);
    // search highlight
    (q(el, '.mm-search-open') as HTMLButtonElement).click();
    const input = q<HTMLInputElement>(el, '.mm-q')!;
    input.value = 'img';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(qa(el, 'mark').length).toBe(3);
    expect(q(el, 'img')).toBeNull();
    input.value = XSS;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    key(input, 'Escape');
    // tray after a delete
    outside();
    act(el, `"${XSS}`, 0, 'delete').click();
    expect(q(el, '.mm-quote')?.innerHTML).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(q(el, 'img')).toBeNull();
    // read-only reason
    const ro = mount({ readOnly: XSS, stores: [store()] });
    expect(q(ro, '.mm-note')?.innerHTML).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(q(ro, 'img')).toBeNull();
  });
});

describe('chips and search', () => {
  it('moves and selects with arrows (wrapping), Home / End; other groups fold and go inert', () => {
    const el = mount();
    const chips = () => qa(el, '.mm-chip');
    chips()[0].focus();
    key(chips()[0], 'ArrowRight');
    expect(chips()[1].getAttribute('aria-checked')).toBe('true');
    expect(chips()[1].getAttribute('tabindex')).toBe('0');
    expect(active(el)).toBe('chip|memory');
    expect(group(el, 'user').hasAttribute('inert')).toBe(true);
    expect(group(el, 'user').hasAttribute('data-open')).toBe(false);
    expect(group(el, 'memory').hasAttribute('data-open')).toBe(true);
    key(chips()[1], 'ArrowDown');
    expect(active(el)).toBe('chip|user');
    key(chips()[2], 'ArrowRight');
    expect(active(el)).toBe('chip-all');
    key(chips()[0], 'ArrowLeft');
    expect(active(el)).toBe('chip|user');
    key(chips()[2], 'Home');
    expect(active(el)).toBe('chip-all');
    key(chips()[0], 'End');
    expect(active(el)).toBe('chip|user');
    key(chips()[2], 'ArrowUp');
    expect(active(el)).toBe('chip|memory');
    const ev = key(chips()[1], 'a');
    expect(ev.defaultPrevented).toBe(false);
    chips()[0].click();
    expect(chips()[0].getAttribute('aria-checked')).toBe('true');
    expect(group(el, 'user').hasAttribute('inert')).toBe(false);
  });

  it('opens search over the chips, filters with highlight, matches store names, says when nothing matches', () => {
    const el = mount();
    const opener = q<HTMLButtonElement>(el, '.mm-search-open')!;
    expect(opener.getAttribute('aria-expanded')).toBe('false');
    opener.click();
    expect(opener.getAttribute('aria-expanded')).toBe('true');
    expect(q(el, '.mm-filters')?.hasAttribute('data-searching')).toBe(true);
    expect(q(el, '.mm-chips')?.hasAttribute('inert')).toBe(true);
    expect(active(el)).toBe('q');
    const input = q<HTMLInputElement>(el, '.mm-q')!;
    input.value = 'DEPLOY';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const shown = rowsOf(el, 'memory').filter((r) => r.hasAttribute('data-open'));
    expect(shown).toHaveLength(1);
    expect(shown[0].querySelector('.mm-text')?.innerHTML).toBe('<mark>Deploy</mark>s via release/*');
    expect(rowsOf(el, 'memory')[0].hasAttribute('inert')).toBe(true);
    expect(group(el, 'user').hasAttribute('inert')).toBe(true);
    input.value = 'user.md';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(group(el, 'user').hasAttribute('data-open')).toBe(true);
    expect(rowsOf(el, 'user').every((r) => r.hasAttribute('data-open'))).toBe(true);
    input.value = 'zzz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(q(el, '.mm-nomatch-f')?.hasAttribute('data-open')).toBe(true);
    expect(q(el, '.mm-nomatch')?.textContent).toBe('No entries match “zzz”');
    const esc = key(input, 'Escape');
    expect(esc.defaultPrevented).toBe(true);
    expect(input.value).toBe('');
    expect(q(el, '.mm-filters')?.hasAttribute('data-searching')).toBe(false);
    expect(active(el)).toBe('search-open');
    expect(rowsOf(el, 'memory').every((r) => r.hasAttribute('data-open'))).toBe(true);
    expect(rowsOf(el, 'memory')[1].querySelector('mark')).toBeNull();
  });
});

describe('edit', () => {
  it('opens in place, Enter saves (ui-edit, optimistic), focus returns to the row’s Edit', () => {
    const el = mount();
    const fired = vi.fn();
    el.addEventListener('ui-edit', (e) => fired((e as CustomEvent).detail));
    act(el, 'memory', 1, 'edit').click();
    const ta = byKey(el, 'edit|memory') as HTMLTextAreaElement;
    expect(ta.value).toBe('Deploys via release/*');
    expect(active(el)).toBe('edit|memory');
    expect(caption(el)).toBe('Enter to save · Shift+Enter for a new line · Esc to cancel');
    expect(ta.getAttribute('aria-label')).toBe('Edit Agent notes #2');
    ta.value = 'Deploys via release/* only';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    expect(q(el, '[data-ecount]')?.textContent).toBe('26 / 660 chars');
    expect(key(ta, 'Enter', { shiftKey: true }).defaultPrevented).toBe(false);
    expect(key(ta, 'Enter', { isComposing: true }).defaultPrevented).toBe(false);
    expect(key(ta, 'Enter', { keyCode: 229 } as KeyboardEventInit).defaultPrevented).toBe(false);
    expect(fired).not.toHaveBeenCalled();
    expect(key(ta, 'Enter').defaultPrevented).toBe(true);
    expect(fired).toHaveBeenCalledWith({
      store: 'memory',
      index: 1,
      text: 'Deploys via release/* only',
      previous: 'Deploys via release/*',
    });
    expect(byKey(el, 'edit|memory')).toBeNull();
    expect(rowsOf(el, 'memory')[1].querySelector('.mm-text')?.textContent).toBe('Deploys via release/* only');
    expect(active(el)).toBe(`ed|memory|${entryKeys(['Deploys via release/* only'])[0]}`);
    expect(caption(el)).toBe('Saved');
  });

  it('a whitespace-only change closes without an event; an empty one is refused', () => {
    const el = mount();
    const fired = vi.fn();
    el.addEventListener('ui-edit', fired);
    act(el, 'memory', 0, 'edit').click();
    let ta = byKey(el, 'edit|memory') as HTMLTextAreaElement;
    ta.value = '  Repo uses pnpm \n';
    key(ta, 'Enter');
    expect(fired).not.toHaveBeenCalled();
    expect(byKey(el, 'edit|memory')).toBeNull();
    expect(active(el)).toBe(`ed|memory|${entryKeys(['Repo uses pnpm'])[0]}`);
    act(el, 'memory', 0, 'edit').click();
    ta = byKey(el, 'edit|memory') as HTMLTextAreaElement;
    ta.value = '   ';
    key(ta, 'Enter');
    expect(fired).not.toHaveBeenCalled();
    expect(byKey(el, 'edit|memory')).not.toBeNull();
    expect(caption(el)).toBe('An entry cannot be empty — use Delete to remove it');
  });

  it('Esc cancels and focuses Edit; a refused edit (preventDefault) keeps the editor and the draft', () => {
    const el = mount();
    act(el, 'memory', 2, 'edit').click();
    let ta = byKey(el, 'edit|memory') as HTMLTextAreaElement;
    ta.value = 'draft';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    const esc = key(ta, 'Escape');
    expect(esc.defaultPrevented).toBe(true);
    expect(byKey(el, 'edit|memory')).toBeNull();
    expect(rowsOf(el, 'memory')[2].querySelector('.mm-text')?.textContent).toBe('Staging DB is read-only');
    expect(active(el)).toBe(`ed|memory|${entryKeys(['Staging DB is read-only'])[0]}`);
    el.addEventListener('ui-edit', (e) => e.preventDefault());
    act(el, 'memory', 2, 'edit').click();
    ta = byKey(el, 'edit|memory') as HTMLTextAreaElement;
    ta.value = 'refused change';
    key(ta, 'Enter');
    expect((byKey(el, 'edit|memory') as HTMLTextAreaElement).value).toBe('refused change');
  });

  it('keeps the open editor and its draft when new data arrives, re-attached by text', () => {
    const el = mount();
    act(el, 'memory', 1, 'edit').click();
    const ta = byKey(el, 'edit|memory') as HTMLTextAreaElement;
    ta.value = 'typing…';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    el.data = { stores: [store({ entries: ['New first', 'Repo uses pnpm', 'Deploys via release/*'] }), user()] };
    el.renderNow();
    const again = byKey(el, 'edit|memory') as HTMLTextAreaElement;
    expect(again.value).toBe('typing…');
    expect(again.closest('.mm-rowf')?.getAttribute('data-i')).toBe('2');
    expect(active(el)).toBe('edit|memory');
    // the entry is gone: the draft moves to the store's add box, which opens
    el.data = { stores: [store({ entries: ['Repo uses pnpm'] }), user()] };
    el.renderNow();
    expect(byKey(el, 'edit|memory')).toBeNull();
    expect((byKey(el, 'new|memory') as HTMLTextAreaElement).value).toBe('typing…');
    expect(q(el, '#mm-new-0')?.hasAttribute('data-open')).toBe(true);
  });
});

describe('delete and undo', () => {
  it('emits ui-delete at once, folds the row, offers Undo, focuses the next row’s Delete', () => {
    const el = mount();
    const fired = vi.fn();
    el.addEventListener('ui-delete', (e) => fired((e as CustomEvent).detail));
    const del = act(el, 'memory', 1, 'delete');
    del.focus();
    del.click();
    expect(fired).toHaveBeenCalledWith({ store: 'memory', index: 1, text: 'Deploys via release/*' });
    const row = rowsOf(el, 'memory')[1];
    expect(row.hasAttribute('data-leaving')).toBe(true);
    expect(row.hasAttribute('data-open')).toBe(false);
    expect(row.hasAttribute('inert')).toBe(true);
    expect(active(el)).toBe(`del|memory|${entryKeys(['Staging DB is read-only'])[0]}`);
    expect(caption(el)).toBe('Deleted “Deploys via release/*”');
    expect(live(el)).toBe('Deleted “Deploys via release/*” — Undo brings it back');
    expect(q<HTMLButtonElement>(el, '.mm-undo')?.hidden).toBe(false);
    expect(qa(el, '.mm-chip-n')[1].textContent).toBe('2');
    vi.advanceTimersByTime(FOLD_MS);
    expect(rowsOf(el, 'memory')).toHaveLength(2);
    expect(rowsOf(el, 'memory')[1].querySelector('.mm-src')?.textContent).toBe('#2 · 23 chars');
    expect(active(el)).toBe(`del|memory|${entryKeys(['Staging DB is read-only'])[0]}`);
  });

  it('a refused delete changes nothing', () => {
    const el = mount();
    el.addEventListener('ui-delete', (e) => e.preventDefault());
    act(el, 'memory', 0, 'delete').click();
    expect(rowsOf(el, 'memory')[0].hasAttribute('data-leaving')).toBe(false);
    expect(q<HTMLButtonElement>(el, '.mm-undo')?.hidden).toBe(true);
  });

  it('focus falls back to the previous row, then the add button', () => {
    const el = mount({ stores: [store({ entries: ['a', 'b'] })] });
    act(el, 'memory', 1, 'delete').click();
    expect(active(el)).toBe(`del|memory|${entryKeys(['a'])[0]}`);
    vi.advanceTimersByTime(FOLD_MS);
    act(el, 'memory', 0, 'delete').click();
    expect(active(el)).toBe('add|memory');
  });

  it('ignores a held Enter (key guard): repeats never activate a button', () => {
    const el = mount();
    const del = act(el, 'memory', 0, 'delete');
    expect(key(del, 'Enter', { repeat: true }).defaultPrevented).toBe(true);
    expect(key(del, 'Enter').defaultPrevented).toBe(false);
  });

  it('keeps Undo for 5 s once focus is outside the panel, and paused while focus is inside', () => {
    const el = mount();
    act(el, 'memory', 0, 'delete').click(); // (a click does not move focus in this DOM)
    const out = outside();
    vi.advanceTimersByTime(UNDO_MS - 1);
    expect(q<HTMLButtonElement>(el, '.mm-undo')?.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(q<HTMLButtonElement>(el, '.mm-undo')?.hidden).toBe(true);
    expect(caption(el)).toMatch(/^4 entries/);
    // focus inside the panel holds the clock — however long
    act(el, 'memory', 0, 'delete').click();
    act(el, 'memory', 1, 'edit').focus();
    vi.advanceTimersByTime(60_000);
    expect(q<HTMLButtonElement>(el, '.mm-undo')?.hidden).toBe(false);
    out.focus();
    vi.advanceTimersByTime(UNDO_MS - 1);
    expect(q<HTMLButtonElement>(el, '.mm-undo')?.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(q<HTMLButtonElement>(el, '.mm-undo')?.hidden).toBe(true);
  });

  it('pauses while the pointer rests on the tray, resuming from the time left', () => {
    const el = mount();
    act(el, 'memory', 0, 'delete').click();
    outside();
    vi.advanceTimersByTime(3000);
    const foot = q(el, '.mm-foot')!;
    foot.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    vi.advanceTimersByTime(20_000);
    expect(q<HTMLButtonElement>(el, '.mm-undo')?.hidden).toBe(false);
    foot.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    vi.advanceTimersByTime(1999);
    expect(q<HTMLButtonElement>(el, '.mm-undo')?.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(q<HTMLButtonElement>(el, '.mm-undo')?.hidden).toBe(true);
  });

  it('Undo emits ui-restore, puts the entry back where it was and focuses its Edit', () => {
    const el = mount();
    const fired = vi.fn();
    el.addEventListener('ui-restore', (e) => fired((e as CustomEvent).detail));
    act(el, 'memory', 1, 'delete').click();
    vi.advanceTimersByTime(FOLD_MS);
    q<HTMLButtonElement>(el, '.mm-undo')!.click();
    expect(fired).toHaveBeenCalledWith({ store: 'memory', index: 1, text: 'Deploys via release/*' });
    expect(rowsOf(el, 'memory').map((r) => r.querySelector('.mm-text')?.textContent)).toEqual(store().entries);
    expect(active(el)).toBe(`ed|memory|${entryKeys(['Deploys via release/*'])[0]}`);
    expect(caption(el)).toBe('Restored');
    expect(q<HTMLButtonElement>(el, '.mm-undo')?.hidden).toBe(true);
  });

  it('a refused restore leaves the text in the add box', () => {
    const el = mount();
    el.addEventListener('ui-restore', (e) => e.preventDefault());
    act(el, 'memory', 0, 'delete').click();
    q<HTMLButtonElement>(el, '.mm-undo')!.click();
    expect((byKey(el, 'new|memory') as HTMLTextAreaElement).value).toBe('Repo uses pnpm');
    expect(q(el, '#mm-new-0')?.hasAttribute('data-open')).toBe(true);
  });

  it('stays coherent when the host answers during the fold: the fold finishes, Undo stays, focus stays put', () => {
    const el = mount();
    const del = act(el, 'memory', 0, 'delete');
    del.focus();
    del.click();
    const focused = active(el);
    expect(focused).toBe(`del|memory|${entryKeys(['Deploys via release/*'])[0]}`);
    // the host persisted and sends the truth right away
    el.data = { stores: [store({ entries: ['Deploys via release/*', 'Staging DB is read-only'] }), user()] };
    el.renderNow();
    expect(rowsOf(el, 'memory')).toHaveLength(3); // still folding
    expect(rowsOf(el, 'memory')[0].hasAttribute('data-leaving')).toBe(true);
    vi.advanceTimersByTime(FOLD_MS);
    expect(rowsOf(el, 'memory')).toHaveLength(2);
    expect(active(el)).toBe(focused);
    expect(q<HTMLButtonElement>(el, '.mm-undo')?.hidden).toBe(false);
    // a host that trims the edited text: focus falls back to the same row
    act(el, 'memory', 0, 'edit').click();
    const ta = byKey(el, 'edit|memory') as HTMLTextAreaElement;
    ta.value = 'Deploys via release/* — ask first  ';
    key(ta, 'Enter');
    el.data = {
      stores: [store({ entries: ['Deploys via release/* — ask first', 'Staging DB is read-only'] }), user()],
    };
    el.renderNow();
    expect(active(el)).toBe(`ed|memory|${entryKeys(['Deploys via release/* — ask first'])[0]}`);
  });
});

describe('add and clear', () => {
  it('opens the store’s editor, Esc folds it keeping the draft, Enter adds (ui-add) and focuses the add button', () => {
    const el = mount();
    const fired = vi.fn();
    el.addEventListener('ui-add', (e) => fired((e as CustomEvent).detail));
    const add = byKey(el, 'add|user') as HTMLButtonElement;
    expect(add.getAttribute('aria-expanded')).toBe('false');
    expect(add.getAttribute('aria-controls')).toBe('mm-new-1');
    expect(q(el, '#mm-new-1')?.hasAttribute('inert')).toBe(true);
    expect(byKey(el, 'new|user')).not.toBeNull(); // the box exists while folded
    add.click();
    expect(add.getAttribute('aria-expanded')).toBe('true');
    expect(q(el, '#mm-new-1')?.hasAttribute('data-open')).toBe(true);
    expect(active(el)).toBe('new|user');
    expect(caption(el)).toBe('Enter to add · Shift+Enter for a new line · Esc to close');
    const ta = byKey(el, 'new|user') as HTMLTextAreaElement;
    ta.value = 'Likes diagrams';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    expect(q(el, '#mm-new-1 [data-count]')?.textContent).toBe('After adding: 60 / 1,375 chars');
    key(ta, 'Escape');
    expect(q(el, '#mm-new-1')?.hasAttribute('inert')).toBe(true);
    expect(active(el)).toBe('add|user');
    expect((byKey(el, 'new|user') as HTMLTextAreaElement).value).toBe('Likes diagrams');
    // a repaint keeps the folded draft
    el.data = BASE();
    el.renderNow();
    expect((byKey(el, 'new|user') as HTMLTextAreaElement).value).toBe('Likes diagrams');
    (byKey(el, 'add|user') as HTMLButtonElement).click();
    const box = byKey(el, 'new|user') as HTMLTextAreaElement;
    expect(key(box, 'Enter', { isComposing: true }).defaultPrevented).toBe(false);
    expect(fired).not.toHaveBeenCalled();
    key(box, 'Enter');
    expect(fired).toHaveBeenCalledWith({ store: 'user', text: 'Likes diagrams' });
    expect(rowsOf(el, 'user').map((r) => r.querySelector('.mm-text')?.textContent)).toEqual([
      'Prefers short answers',
      'Timezone Asia/Seoul',
      'Likes diagrams',
    ]);
    expect((byKey(el, 'new|user') as HTMLTextAreaElement).value).toBe('');
    expect(q(el, '#mm-new-1')?.hasAttribute('inert')).toBe(true);
    expect(active(el)).toBe('add|user');
    expect(caption(el)).toBe('Added');
  });

  it('warns in the add counter when the entry or the store would overflow', () => {
    const el = mount({ stores: [store({ limit: 40, perEntryLimit: 10, entries: ['abc'] })] });
    (byKey(el, 'add|memory') as HTMLButtonElement).click();
    const ta = byKey(el, 'new|memory') as HTMLTextAreaElement;
    ta.value = 'x'.repeat(40);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    const c = q(el, '[data-count]')!;
    expect(c.textContent).toBe('After adding: 46 / 40 chars — 6 over — over the per-entry limit');
    expect(c.classList.contains('is-over')).toBe(true);
  });

  it('Clear all needs a second press that names the count; Esc and 4 s disarm', () => {
    const el = mount();
    const fired = vi.fn();
    el.addEventListener('ui-clear', (e) => fired((e as CustomEvent).detail));
    const clear = () => byKey(el, 'clear|memory') as HTMLButtonElement;
    clear().click();
    expect(fired).not.toHaveBeenCalled();
    expect(clear().textContent).toBe('Clear 3 entries');
    expect(clear().hasAttribute('data-armed')).toBe(true);
    expect(live(el)).toBe('Clear all 3 entries in Agent notes? This cannot be undone — press again to clear');
    key(clear(), 'Escape');
    expect(clear().textContent).toBe('Clear all');
    clear().click();
    vi.advanceTimersByTime(4000);
    expect(clear().textContent).toBe('Clear all');
    clear().click();
    clear().click();
    expect(fired).toHaveBeenCalledWith({ store: 'memory' });
    expect(rowsOf(el, 'memory')).toHaveLength(0);
    expect(group(el, 'memory').querySelector('.mm-empty')).not.toBeNull();
    expect(active(el)).toBe('add|memory');
    expect(caption(el)).toBe('Cleared');
  });
});

describe('read-only, language, lifecycle', () => {
  it('read-only hides every write action and shows the reason', () => {
    const el = mount({ ...BASE(), readOnly: 'Managed by an admin' });
    expect(qa(el, '[data-act="edit"], [data-act="delete"], [data-act="add-open"], [data-act="clear"]')).toHaveLength(0);
    expect(q(el, '.mm-note')?.textContent).toBe('Managed by an admin');
    expect(qa(el, '.mm-chip')).toHaveLength(3);
    const plain = mount({ ...BASE(), readOnly: true });
    expect(q(plain, '.mm-note')).toBeNull();
    expect(qa(plain, '[data-act="delete"]')).toHaveLength(0);
  });

  it('speaks Korean with lang="ko"', () => {
    const el = mount(
      { stores: [store({ label: '에이전트 노트', entries: ['한국어 항목입니다'] }), user({ label: '사용자 프로필' })] },
      { lang: 'ko' },
    );
    expect(q(el, '.mm-chips')?.getAttribute('aria-label')).toBe('저장소');
    expect(qa(el, '.mm-chip')[0].textContent?.trim()).toBe('전체 3');
    expect(q(el, '.mm-src')?.textContent).toBe('#1 · 9자');
    expect(byKey(el, 'add|memory')?.textContent).toBe('+ 에이전트 노트에 추가');
    expect(byKey(el, 'clear|memory')?.textContent).toBe('모두 지우기');
    expect(act(el, 'memory', 0, 'edit').getAttribute('aria-label')).toBe('수정: “한국어 항목입니다”');
    expect(q(el, '.mm-search-open')?.getAttribute('aria-label')).toBe('개인 메모리 검색');
    expect(q<HTMLInputElement>(el, '.mm-q')?.placeholder).toBe('항목 검색');
    expect(caption(el)).toMatch(/^3개 항목 · 에이전트 노트 9 \/ 2,200자 · 사용자 프로필 43 \/ 1,375자$/);
    outside();
    act(el, 'memory', 0, 'delete').click();
    expect(caption(el)).toBe('삭제함 “한국어 항목입니다”');
    expect(q(el, '.mm-undo')?.textContent).toBe('되돌리기');
    expect(live(el)).toBe('삭제함 “한국어 항목입니다” — 되돌리기로 되돌릴 수 있습니다');
  });

  it('switches language when the attribute changes', async () => {
    const el = mount();
    el.setAttribute('lang', 'ko');
    await Promise.resolve();
    expect(qa(el, '.mm-chip')[0].textContent?.trim()).toBe('전체 5');
  });

  it('leaves no timer running after it is removed', () => {
    const el = mount();
    act(el, 'memory', 0, 'edit').click();
    key(byKey(el, 'edit|memory')!, 'Enter'); // (same text: closes)
    act(el, 'memory', 1, 'delete').click();
    (byKey(el, 'clear|memory') as HTMLButtonElement).click();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    el.remove();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('docs', () => {
  it('has at least three demos, one in Korean, each rendering a panel', () => {
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    expect(doc.demos.some((d) => d.create().getAttribute('lang') === 'ko')).toBe(true);
    for (const d of doc.demos) {
      const el = d.create() as UiMemoryPanel;
      document.body.append(el);
      el.renderNow();
      expect(q(el, '.mm-chips')).not.toBeNull();
    }
  });

  it('the demo host persists an event and sends data the panel agrees with', () => {
    const el = doc.demos[0].create() as UiMemoryPanel;
    document.body.append(el);
    el.renderNow();
    const before = rowsOf(el, 'memory').length;
    act(el, 'memory', 0, 'delete').click();
    vi.advanceTimersByTime(400);
    expect(el.data?.stores[0].entries).toHaveLength(before - 1);
    expect(rowsOf(el, 'memory')).toHaveLength(before - 1);
    expect(q<HTMLButtonElement>(el, '.mm-undo')?.hidden).toBe(false);
  });
});
