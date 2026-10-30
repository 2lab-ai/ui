import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../setting-row/setting-row';
import type { SettingRowData } from '../setting-row/setting-row';
import { applySettingsFilter, settingMatches, settingRowText } from './filter';
import './settings-nav';
import { FILTER_DEBOUNCE_MS, NAV_PIN_MS, navSections, type SettingsNavData, type UiSettingsNav } from './settings-nav';
import { styles } from './styles';

const SECTIONS: SettingsNavData['sections'] = [
  { id: 'general', label: 'General', count: 3 },
  { id: 'models', label: 'Models', count: 2, modified: 1 },
  { id: 'alerts', label: 'Notifications', count: 0 },
];

/** Sections the nav links to, in the document. */
function page(ids = ['general', 'models', 'alerts']): Record<string, HTMLElement> {
  const out: Record<string, HTMLElement> = {};
  for (const id of ids) {
    const s = document.createElement('section');
    s.id = id;
    s.scrollIntoView = vi.fn();
    document.body.append(s);
    out[id] = s;
  }
  return out;
}

function mount(
  data: SettingsNavData | null = { sections: SECTIONS },
  attrs: Record<string, string> = {},
  children = '',
): UiSettingsNav {
  const el = document.createElement('ui-settings-nav') as UiSettingsNav;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (children) el.innerHTML = children;
  document.body.append(el);
  if (data) el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends HTMLElement = HTMLElement>(el: UiSettingsNav, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = (el: UiSettingsNav, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const link = (el: UiSettingsNav, id: string) => qa(el, '.sn-link').find((b) => b.dataset.id === id)!;
const currentId = (el: UiSettingsNav) => q(el, '.sn-link[aria-current="true"]')?.dataset.id;

function type(el: UiSettingsNav, value: string): void {
  const input = q<HTMLInputElement>(el, '.sn-q')!;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}
function key(el: UiSettingsNav, k: string): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true });
  q(el, '.sn-q')!.dispatchEvent(ev);
  return ev;
}
function check(el: UiSettingsNav, on: boolean): void {
  const box = q<HTMLInputElement>(el, '.sn-modchk')!;
  box.checked = on;
  box.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}
function events<T>(el: EventTarget, name: string): CustomEvent<T>[] {
  const seen: CustomEvent<T>[] = [];
  el.addEventListener(name, (e) => seen.push(e as CustomEvent<T>));
  return seen;
}

/** A stand-in IntersectionObserver: records what it watches and lets a test say what is in view. */
class MockIO {
  static all: MockIO[] = [];
  observed: Element[] = [];
  disconnected = false;
  constructor(
    public cb: IntersectionObserverCallback,
    public opts?: IntersectionObserverInit,
  ) {
    MockIO.all.push(this);
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  fire(entries: Array<[Element, boolean]>): void {
    this.cb(
      entries.map(([target, isIntersecting]) => ({ target, isIntersecting }) as IntersectionObserverEntry),
      this as unknown as IntersectionObserver,
    );
  }
  static get last(): MockIO {
    return MockIO.all[MockIO.all.length - 1];
  }
}

beforeEach(() => {
  document.body.innerHTML = '';
  MockIO.all = [];
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('<ui-settings-nav> rendering', () => {
  it('draws one link per section with its label, count and modified dot inside a named nav', () => {
    const el = mount();
    const links = qa(el, '.sn-link');
    expect(links.map((b) => b.dataset.id)).toEqual(['general', 'models', 'alerts']);
    expect(links.map((b) => b.querySelector('.sn-label')?.textContent)).toEqual(['General', 'Models', 'Notifications']);
    expect(links.map((b) => b.querySelector('.sn-count')?.textContent)).toEqual(['3', '2', '0']);
    expect(links.every((b) => b.getAttribute('type') === 'button')).toBe(true);
    expect(q(el, 'nav')?.getAttribute('aria-label')).toBe('Settings sections');
    expect(q(el, '.sn-list')?.getAttribute('role')).toBe('list');
    // Modified: a dot (shape) plus words for screen readers.
    const mod = link(el, 'models');
    expect(mod.querySelector('.sn-dot')?.getAttribute('aria-hidden')).toBe('true');
    expect(mod.querySelector('.sr-only')?.textContent).toBe(', 1 modified');
    expect(link(el, 'general').querySelector('.sn-dot')).toBeNull();
    // A section with nothing left is quieter.
    expect(link(el, 'alerts').hasAttribute('data-zero')).toBe(true);
    expect(link(el, 'general').hasAttribute('data-zero')).toBe(false);
  });

  it('the search box and “Modified only” by default; filter: false drops them', () => {
    const el = mount();
    const input = q<HTMLInputElement>(el, '.sn-q')!;
    expect(input.type).toBe('search');
    expect(input.getAttribute('aria-label')).toBe('Search settings');
    expect(input.getAttribute('placeholder')).toBe('Search settings');
    expect(q(el, '.sn-qclear')?.hasAttribute('hidden')).toBe(true);
    expect(q(el, '.sn-mod')?.textContent).toBe('Modified only');
    expect(q<HTMLInputElement>(el, '.sn-modchk')?.type).toBe('checkbox');
    const bare = mount({ sections: SECTIONS, filter: false, empty: true });
    expect(q(bare, '.sn-filter')).toBeNull();
    expect(q(bare, '.sn-empty')?.textContent).toBe('No settings match');
    expect(q(bare, '.sn-clear')).toBeNull();
  });

  it('a custom nav name and placeholder; no count when none is given; bad counts are dropped', () => {
    const el = mount({
      sections: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B', count: Number.NaN, modified: -2 },
        { id: 'c', label: 'C', count: 4.7 },
      ],
      label: 'Preferences',
      placeholder: 'Find a setting',
    });
    expect(q(el, 'nav')?.getAttribute('aria-label')).toBe('Preferences');
    expect(q(el, '.sn-q')?.getAttribute('placeholder')).toBe('Find a setting');
    expect(link(el, 'a').querySelector('.sn-count')).toBeNull();
    expect(link(el, 'b').querySelector('.sn-count')).toBeNull();
    expect(link(el, 'b').querySelector('.sn-dot')).toBeNull();
    expect(link(el, 'c').querySelector('.sn-count')?.textContent).toBe('4');
  });

  it('navSections keeps the first of each id and skips entries without one', () => {
    const list = navSections({
      sections: [
        { id: 'a', label: 'A' },
        { id: 'a', label: 'Again' },
        { id: '', label: 'No id' },
        null as unknown as SettingsNavData['sections'][number],
        { id: 7 as unknown as string, label: 'Number' },
        { id: 'b', label: 'B' },
      ],
    });
    expect(list.map((s) => s.label)).toEqual(['A', 'B']);
    expect(navSections(undefined)).toEqual([]);
    expect(navSections({ sections: 'x' as unknown as [] })).toEqual([]);
  });

  it('renders the shell without data and without throwing on an empty list', () => {
    const el = mount(null);
    expect(qa(el, '.sn-link')).toHaveLength(0);
    expect(q(el, 'nav')).not.toBeNull();
    const none = mount({ sections: [] });
    expect(qa(none, '.sn-link')).toHaveLength(0);
  });

  it('escapes every string the host passes', () => {
    const x = '<img src=x onerror=alert(1)>';
    const id = `"><img src=x onerror=alert(2)>`;
    const el = mount({
      sections: [{ id, label: x, count: 1, modified: 1 }],
      label: x,
      placeholder: x,
      query: x,
      current: id,
      empty: true,
    });
    expect(q(el, 'img')).toBeNull();
    expect(link(el, id).querySelector('.sn-label')?.textContent).toBe(x);
    expect(link(el, id).getAttribute('aria-current')).toBe('true');
    expect(q(el, 'nav')?.getAttribute('aria-label')).toBe(x);
    expect(q(el, '.sn-q')?.getAttribute('placeholder')).toBe(x);
    expect(q<HTMLInputElement>(el, '.sn-q')?.value).toBe(x);
    // And the id still round-trips through ui-navigate.
    const seen = events<{ id: string }>(el, 'ui-navigate');
    link(el, id).click();
    expect(seen[0].detail).toEqual({ id });
  });
});

describe('<ui-settings-nav> navigate', () => {
  it('a link sends a cancelable ui-navigate { id }; by default the section scrolls into view and becomes current', () => {
    const secs = page();
    const el = mount();
    const before = location.hash;
    const seen = events<{ id: string }>(el, 'ui-navigate');
    link(el, 'models').click();
    expect(seen).toHaveLength(1);
    expect(seen[0].detail).toEqual({ id: 'models' });
    expect(seen[0].bubbles && seen[0].composed && seen[0].cancelable).toBe(true);
    expect(secs.models.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(secs.general.scrollIntoView).not.toHaveBeenCalled();
    expect(currentId(el)).toBe('models');
    expect(el.current).toBe('models');
    expect(location.hash).toBe(before);
  });

  it('preventDefault: no scroll, the current section stays', () => {
    const secs = page();
    const el = mount({ sections: SECTIONS, current: 'general' });
    el.addEventListener('ui-navigate', (e) => e.preventDefault());
    link(el, 'alerts').click();
    expect(secs.alerts.scrollIntoView).not.toHaveBeenCalled();
    expect(currentId(el)).toBe('general');
    expect(el.navigate('alerts')).toBe(false);
  });

  it('reduced motion scrolls without the glide', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }));
    const secs = page();
    const el = mount();
    el.navigate('alerts');
    expect(secs.alerts.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('navigate(id) works like a press; unknown ids are refused without an event', () => {
    page();
    const el = mount();
    const seen = events(el, 'ui-navigate');
    expect(el.navigate('nope')).toBe(false);
    expect(seen).toHaveLength(0);
    expect(el.navigate('alerts')).toBe(true);
    expect(currentId(el)).toBe('alerts');
  });

  it('a section that is not on the page: the event still goes out and the link becomes current', () => {
    const el = mount();
    const seen = events(el, 'ui-navigate');
    expect(el.navigate('models')).toBe(true);
    expect(seen).toHaveLength(1);
    expect(currentId(el)).toBe('models');
  });

  it('finds the section in its own root node first (a shadow root), not a same-id node in the document', () => {
    const outside = page(['models']).models;
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const inside = document.createElement('section');
    inside.id = 'models';
    inside.scrollIntoView = vi.fn();
    const el = document.createElement('ui-settings-nav') as UiSettingsNav;
    shadow.append(el, inside);
    el.data = { sections: SECTIONS };
    el.renderNow();
    el.navigate('models');
    expect(inside.scrollIntoView).toHaveBeenCalled();
    expect(outside.scrollIntoView).not.toHaveBeenCalled();
  });

  it('the host moves current; a data update that keeps the same current does not undo a press', () => {
    page();
    const el = mount({ sections: SECTIONS, current: 'general' });
    expect(currentId(el)).toBe('general');
    el.navigate('alerts');
    el.data = { sections: SECTIONS.map((s) => ({ ...s, count: 1 })), current: 'general' };
    el.renderNow();
    expect(currentId(el)).toBe('alerts');
    el.data = { sections: SECTIONS, current: 'models' };
    el.renderNow();
    expect(currentId(el)).toBe('models');
  });

  it('keeps focus on the pressed link across a data update (data-key)', () => {
    const el = mount();
    link(el, 'models').focus();
    el.data = { sections: SECTIONS.map((s) => ({ ...s, count: 9 })) };
    el.renderNow();
    expect(el.shadowRoot!.activeElement).toBe(link(el, 'models'));
  });
});

describe('<ui-settings-nav> filter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('typing sends one ui-filter once it settles (debounced)', () => {
    const el = mount();
    const seen = events<{ query: string; modifiedOnly: boolean }>(el, 'ui-filter');
    type(el, 'th');
    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS - 1);
    type(el, 'theme');
    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS - 1);
    expect(seen).toHaveLength(0);
    expect(el.query).toBe('theme');
    vi.advanceTimersByTime(1);
    expect(seen).toHaveLength(1);
    expect(seen[0].detail).toEqual({ query: 'theme', modifiedOnly: false });
    expect(seen[0].bubbles && seen[0].composed).toBe(true);
    expect(FILTER_DEBOUNCE_MS).toBe(120);
  });

  it('the clear button shows while there is text; pressing it clears and sends at once', () => {
    const el = mount();
    const seen = events<{ query: string }>(el, 'ui-filter');
    type(el, 'model');
    expect(q(el, '.sn-qclear')?.hasAttribute('hidden')).toBe(false);
    expect(q(el, '.sn-qclear')?.getAttribute('aria-label')).toBe('Clear search');
    q(el, '.sn-qclear')!.click();
    expect(seen.map((e) => e.detail.query)).toEqual(['']);
    expect(q<HTMLInputElement>(el, '.sn-q')?.value).toBe('');
    expect(q(el, '.sn-qclear')?.hasAttribute('hidden')).toBe(true);
    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS * 2);
    expect(seen).toHaveLength(1);
  });

  it('“Modified only” sends at once, with the text typed so far (and drops the pending one)', () => {
    const el = mount();
    const seen = events<{ query: string; modifiedOnly: boolean }>(el, 'ui-filter');
    type(el, 'sound');
    check(el, true);
    expect(seen.map((e) => e.detail)).toEqual([{ query: 'sound', modifiedOnly: true }]);
    expect(el.modifiedOnly).toBe(true);
    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS * 2);
    expect(seen).toHaveLength(1);
    check(el, false);
    expect(seen[1].detail).toEqual({ query: 'sound', modifiedOnly: false });
  });

  it('Enter sends at once; Esc clears the text first and only lets an empty box through', () => {
    const el = mount();
    const seen = events<{ query: string }>(el, 'ui-filter');
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    type(el, 'digest');
    const enter = key(el, 'Enter');
    expect(enter.defaultPrevented).toBe(true);
    expect(seen.map((e) => e.detail.query)).toEqual(['digest']);
    const esc = key(el, 'Escape');
    expect(esc.defaultPrevented).toBe(true);
    expect(outer).toHaveBeenCalledTimes(1);
    expect(seen.map((e) => e.detail.query)).toEqual(['digest', '']);
    expect(q<HTMLInputElement>(el, '.sn-q')?.value).toBe('');
    const again = key(el, 'Escape');
    expect(again.defaultPrevented).toBe(false);
    expect(outer).toHaveBeenCalledTimes(2);
    expect(seen).toHaveLength(2);
    document.removeEventListener('keydown', outer);
  });

  it('adopts a query and modifiedOnly the host sets, but an echo never overwrites what is being typed', () => {
    const el = mount({ sections: SECTIONS, query: 'model', modifiedOnly: true });
    expect(q<HTMLInputElement>(el, '.sn-q')?.value).toBe('model');
    expect(q<HTMLInputElement>(el, '.sn-modchk')?.checked).toBe(true);
    expect(q(el, '.sn-qclear')?.hasAttribute('hidden')).toBe(false);
    const seen = events<{ query: string }>(el, 'ui-filter');
    type(el, 'mod');
    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS);
    expect(seen[0].detail.query).toBe('mod');
    type(el, 'mode');
    // The host answers the first filter after the person typed on.
    el.data = { sections: SECTIONS, query: 'mod', modifiedOnly: true };
    el.renderNow();
    expect(q<HTMLInputElement>(el, '.sn-q')?.value).toBe('mode');
    // A real change from the host is adopted.
    el.data = { sections: SECTIONS, query: 'sound', modifiedOnly: false };
    el.renderNow();
    expect(q<HTMLInputElement>(el, '.sn-q')?.value).toBe('sound');
    expect(q<HTMLInputElement>(el, '.sn-modchk')?.checked).toBe(false);
  });

  it('empty: “No settings match” in a status region; Clear filters resets both and sends', () => {
    const el = mount({ sections: SECTIONS, query: 'zzz', modifiedOnly: true, empty: true });
    expect(q(el, '.sn-empty')?.getAttribute('role')).toBe('status');
    expect(q(el, '.sn-empty-text')?.textContent).toBe('No settings match');
    const seen = events<{ query: string; modifiedOnly: boolean }>(el, 'ui-filter');
    q(el, '.sn-clear')!.click();
    expect(seen.map((e) => e.detail)).toEqual([{ query: '', modifiedOnly: false }]);
    expect(q<HTMLInputElement>(el, '.sn-q')?.value).toBe('');
    expect(q<HTMLInputElement>(el, '.sn-modchk')?.checked).toBe(false);
    expect(el.shadowRoot!.activeElement).toBe(q(el, '.sn-q'));
    el.data = { sections: SECTIONS };
    el.renderNow();
    expect(q(el, '.sn-empty')?.textContent).toBe('');
  });

  it('a pending filter is dropped when the nav leaves the page', () => {
    const el = mount();
    const fired = vi.fn();
    document.addEventListener('ui-filter', fired);
    type(el, 'abc');
    el.remove();
    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS * 2);
    expect(fired).not.toHaveBeenCalled();
    document.removeEventListener('ui-filter', fired);
  });
});

describe('<ui-settings-nav> tracking', () => {
  it('watches every section on the page and sends ui-section-change for the topmost one in view', () => {
    vi.stubGlobal('IntersectionObserver', MockIO);
    const secs = page();
    const el = mount();
    const io = MockIO.last;
    expect(io.observed).toEqual([secs.general, secs.models, secs.alerts]);
    expect(io.opts?.rootMargin).toBe('0px 0px -55% 0px');
    const seen = events<{ id: string }>(el, 'ui-section-change');
    io.fire([
      [secs.models, true],
      [secs.alerts, true],
    ]);
    expect(seen).toHaveLength(1);
    expect(seen[0].detail).toEqual({ id: 'models' });
    expect(seen[0].cancelable).toBe(false);
    expect(seen[0].bubbles && seen[0].composed).toBe(true);
    expect(currentId(el)).toBe('models');
    io.fire([[secs.models, false]]);
    expect(seen.map((e) => e.detail.id)).toEqual(['models', 'alerts']);
    // Nothing in the band: the current one stays, no event.
    io.fire([[secs.alerts, false]]);
    expect(seen).toHaveLength(2);
    expect(currentId(el)).toBe('alerts');
  });

  it('a pressed link holds while the page scrolls past other sections, then follows again', () => {
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', MockIO);
    const secs = page();
    const el = mount();
    const io = MockIO.last;
    const seen = events<{ id: string }>(el, 'ui-section-change');
    link(el, 'alerts').click();
    io.fire([[secs.general, true]]);
    io.fire([[secs.models, true]]);
    expect(currentId(el)).toBe('alerts');
    expect(seen).toHaveLength(0);
    vi.advanceTimersByTime(NAV_PIN_MS);
    // The pressed section is not in the band: the topmost visible one wins.
    expect(currentId(el)).toBe('general');
    expect(seen.map((e) => e.detail.id)).toEqual(['general']);
  });

  it('scrollend releases the hold early; a pressed section still in view stays current', () => {
    vi.stubGlobal('IntersectionObserver', MockIO);
    const secs = page();
    const el = mount();
    const io = MockIO.last;
    el.navigate('models');
    io.fire([
      [secs.general, true],
      [secs.models, true],
    ]);
    document.dispatchEvent(new Event('scrollend'));
    expect(currentId(el)).toBe('models');
  });

  it('skips hidden sections (a filter hid every row of them)', () => {
    vi.stubGlobal('IntersectionObserver', MockIO);
    const secs = page();
    const el = mount();
    secs.general.hidden = true;
    MockIO.last.fire([
      [secs.general, true],
      [secs.models, true],
    ]);
    expect(currentId(el)).toBe('models');
  });

  it('guards: no IntersectionObserver, no targets, or track: false — nothing is observed and nothing throws', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    page();
    const el = mount();
    expect(() => el.navigate('models')).not.toThrow();
    expect(currentId(el)).toBe('models');
    vi.stubGlobal('IntersectionObserver', MockIO);
    document.body.innerHTML = '';
    mount();
    expect(MockIO.all).toHaveLength(0);
    page();
    mount({ sections: SECTIONS, track: false });
    expect(MockIO.all).toHaveLength(0);
  });

  it('a throwing observer is tolerated', () => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor() {
          throw new Error('nope');
        }
      },
    );
    page();
    expect(() => mount()).not.toThrow();
  });

  it('re-observes when sections change and disconnects when the nav leaves', () => {
    vi.stubGlobal('IntersectionObserver', MockIO);
    const secs = page();
    const el = mount({ sections: SECTIONS.slice(0, 2) });
    const first = MockIO.last;
    expect(first.observed).toEqual([secs.general, secs.models]);
    el.data = { sections: SECTIONS.slice(0, 2).map((s) => ({ ...s, count: 1 })) };
    el.renderNow();
    expect(MockIO.all).toHaveLength(1);
    el.data = { sections: SECTIONS };
    el.renderNow();
    expect(first.disconnected).toBe(true);
    expect(MockIO.last.observed).toHaveLength(3);
    el.remove();
    expect(MockIO.last.disconnected).toBe(true);
  });
});

describe('<ui-settings-nav> layout and notice', () => {
  it('layout: a column from 840px (auto) or always (side); chips on top otherwise', () => {
    expect(styles).toContain(':host([layout="side"]) .sn-list');
    expect(styles).toMatch(/@media \(min-width: 840px\) \{\s*:host\(:not\(\[layout="top"\]\)\) \.sn/);
    expect(styles).toContain('overflow-x: auto');
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('layout is an observed attribute (the shadow markup stays the same)', async () => {
    const el = mount({ sections: SECTIONS }, { layout: 'top' });
    expect(el.getAttribute('layout')).toBe('top');
    el.setAttribute('layout', 'side');
    await Promise.resolve();
    expect(qa(el, '.sn-link')).toHaveLength(3);
  });

  it('the notice slot shows only when the host slots something into it', () => {
    const none = mount();
    expect(q(none, '.sn-notice')?.hasAttribute('hidden')).toBe(true);
    expect(q(none, 'slot[name="notice"]')).not.toBeNull();
    const el = mount({ sections: SECTIONS }, {}, '<div slot="notice" class="ui-notice">Read-only until approved</div>');
    expect(q(el, '.sn-notice')?.hasAttribute('hidden')).toBe(false);
    expect(q(el, '.sn-notice')?.getAttribute('part')).toBe('notice');
    el.querySelector('[slot="notice"]')!.remove();
    el.renderNow();
    expect(q(el, '.sn-notice')?.hasAttribute('hidden')).toBe(true);
  });
});

describe('<ui-settings-nav> lang', () => {
  it('lang="ko" switches the words', () => {
    vi.useFakeTimers();
    const el = mount({ sections: SECTIONS, empty: true }, { lang: 'ko' });
    expect(q(el, 'nav')?.getAttribute('aria-label')).toBe('설정 섹션');
    expect(q(el, '.sn-q')?.getAttribute('aria-label')).toBe('설정 검색');
    expect(q(el, '.sn-q')?.getAttribute('placeholder')).toBe('설정 검색');
    expect(q(el, '.sn-qclear')?.getAttribute('aria-label')).toBe('검색어 지우기');
    expect(q(el, '.sn-mod')?.textContent).toBe('바꾼 것만');
    expect(q(el, '.sn-empty-text')?.textContent).toBe('맞는 설정이 없습니다');
    expect(q(el, '.sn-clear')?.textContent).toBe('필터 지우기');
    expect(link(el, 'models').querySelector('.sr-only')?.textContent).toBe(', 1개 변경됨');
  });

  it('changing lang re-renders', async () => {
    const el = mount();
    el.setAttribute('lang', 'ko');
    await Promise.resolve();
    expect(q(el, '.sn-mod')?.textContent).toBe('바꾼 것만');
  });
});

describe('settingMatches', () => {
  it('every word of the query, anywhere, any case; an empty query matches all', () => {
    expect(settingMatches('Default model', 'model default')).toBe(true);
    expect(settingMatches('Default model', 'MOD')).toBe(true);
    expect(settingMatches('Default model', 'model sound')).toBe(false);
    expect(settingMatches('Default model', '   ')).toBe(true);
    expect(settingMatches('Default model', '')).toBe(true);
    expect(settingMatches('', 'x')).toBe(false);
    expect(settingMatches(null as unknown as string, undefined as unknown as string)).toBe(true);
    expect(settingMatches('알림 소리', '소리')).toBe(true);
  });

  it('settingRowText joins label, description, hints and key', () => {
    expect(
      settingRowText({
        key: 'model',
        label: 'Default model',
        description: 'Starts new chats',
        hints: ['24-hour clock', { label: 'Command', code: '/model' }, { code: '/m' }],
      }),
    ).toBe('Default model Starts new chats 24-hour clock Command /model  /m model');
    expect(settingRowText(null)).toBe('');
    expect(settingRowText({ label: 'Theme' })).toBe('Theme');
  });
});

describe('applySettingsFilter', () => {
  type RowEl = HTMLElement & { data?: SettingRowData };
  function build(): HTMLElement {
    const root = document.createElement('div');
    const spec: Array<[string, string, SettingRowData[]]> = [
      [
        'general',
        'General',
        [
          { key: 'theme', label: 'Theme', description: 'Light, dark or the system’s.' },
          { key: 'clock', label: 'Time format', hints: ['24-hour clock'], modified: true },
        ],
      ],
      [
        'models',
        'Models',
        [
          { key: 'model', label: 'Default model', hints: [{ label: 'Command', code: '/model' }], modified: true },
          { key: 'effort', label: 'Reasoning effort' },
        ],
      ],
      ['alerts', 'Notifications', [{ key: 'sound', label: 'Notification sound' }]],
    ];
    for (const [id, title, rows] of spec) {
      const sec = document.createElement('section');
      sec.id = id;
      sec.innerHTML = `<header><h2>${title}</h2></header>`;
      for (const d of rows) {
        const r = document.createElement('ui-setting-row') as RowEl;
        r.data = d;
        sec.append(r);
      }
      root.append(sec);
    }
    // A section without rows is left alone.
    const about = document.createElement('section');
    about.id = 'about';
    about.textContent = 'Version 1.0';
    root.append(about);
    document.body.append(root);
    return root;
  }
  const shown = (root: HTMLElement) =>
    Array.from(root.querySelectorAll<RowEl>('ui-setting-row'))
      .filter((r) => !r.hidden)
      .map((r) => r.data?.key);
  const sec = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`#${id}`)!;

  it('no filter: everything shows; counts per section; the first row of each section is data-first', () => {
    const root = build();
    expect(applySettingsFilter(root)).toEqual({ shown: 5, total: 5, sections: { general: 2, models: 2, alerts: 1 } });
    expect(shown(root)).toEqual(['theme', 'clock', 'model', 'effort', 'sound']);
    const firsts = Array.from(root.querySelectorAll<RowEl>('ui-setting-row[data-first]')).map((r) => r.data?.key);
    expect(firsts).toEqual(['theme', 'model', 'sound']);
  });

  it('a query hides rows that do not match (label, description, hints, key) and sections with none left', () => {
    const root = build();
    const r = applySettingsFilter(root, { query: 'model' });
    expect(r).toEqual({ shown: 1, total: 5, sections: { general: 0, models: 1, alerts: 0 } });
    expect(shown(root)).toEqual(['model']);
    expect(sec(root, 'general').hidden).toBe(true);
    expect(sec(root, 'alerts').hidden).toBe(true);
    expect(sec(root, 'models').hidden).toBe(false);
    expect(sec(root, 'about').hidden).toBe(false);
    // Description, hints and key count too.
    expect(applySettingsFilter(root, { query: 'dark' }).shown).toBe(1);
    expect(applySettingsFilter(root, { query: '24-hour' }).shown).toBe(1);
    expect(applySettingsFilter(root, { query: '/model' }).shown).toBe(1);
    expect(applySettingsFilter(root, { query: 'effort' }).shown).toBe(1);
  });

  it('modifiedOnly keeps modified rows only, together with the query; data-first moves to the first shown row', () => {
    const root = build();
    expect(applySettingsFilter(root, { modifiedOnly: true })).toEqual({
      shown: 2,
      total: 5,
      sections: { general: 1, models: 1, alerts: 0 },
    });
    expect(shown(root)).toEqual(['clock', 'model']);
    const clock = Array.from(root.querySelectorAll<RowEl>('ui-setting-row')).find((r) => r.data?.key === 'clock')!;
    expect(clock.hasAttribute('data-first')).toBe(true);
    expect(applySettingsFilter(root, { query: 'time', modifiedOnly: true }).shown).toBe(1);
    expect(applySettingsFilter(root, { query: 'theme', modifiedOnly: true }).shown).toBe(0);
  });

  it('clearing the filter shows everything again and restores data-first', () => {
    const root = build();
    applySettingsFilter(root, { query: 'zzz' });
    expect(Array.from(root.querySelectorAll('section')).filter((s) => s.hidden)).toHaveLength(3);
    const r = applySettingsFilter(root, { query: '', modifiedOnly: false });
    expect(r.shown).toBe(5);
    expect(Array.from(root.querySelectorAll('section')).some((s) => s.hidden)).toBe(false);
    const clock = Array.from(root.querySelectorAll<RowEl>('ui-setting-row')).find((r) => r.data?.key === 'clock')!;
    expect(clock.hasAttribute('data-first')).toBe(false);
  });

  it('a row without data is searched by its text; an empty container returns zeros', () => {
    const root = document.createElement('div');
    root.innerHTML = '<section id="s"><ui-setting-row>Language</ui-setting-row></section>';
    expect(applySettingsFilter(root, { query: 'lang' }).shown).toBe(1);
    expect(applySettingsFilter(root, { query: 'lang', modifiedOnly: true }).shown).toBe(0);
    expect(applySettingsFilter(document.createElement('div'), { query: 'x' })).toEqual({
      shown: 0,
      total: 0,
      sections: {},
    });
  });
});
