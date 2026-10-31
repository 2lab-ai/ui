import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import {
  type BreadcrumbsData,
  type BreadcrumbsSelect,
  breadcrumbCollapse,
  breadcrumbItems,
  breadcrumbVisible,
  type UiBreadcrumbs,
} from './breadcrumbs';
import { styles } from './styles';

const XSS = '<img src=x onerror=alert(1)>';

/** A ResizeObserver the test drives: `fire(el)` reports a size for what it observes (happy-dom has none). */
class FakeRO {
  static all: FakeRO[] = [];
  targets: Element[] = [];
  constructor(readonly cb: ResizeObserverCallback) {
    FakeRO.all.push(this);
  }
  observe(t: Element): void {
    this.targets.push(t);
  }
  unobserve(t: Element): void {
    this.targets = this.targets.filter((x) => x !== t);
  }
  disconnect(): void {
    this.targets = [];
  }
  static fire(el: Element): void {
    for (const ro of FakeRO.all)
      if (ro.targets.includes(el))
        ro.cb([{ contentRect: { width: 0 } } as unknown as ResizeObserverEntry], ro as unknown as ResizeObserver);
  }
}

function mount(data: BreadcrumbsData | undefined, attrs: Record<string, string> = {}): UiBreadcrumbs {
  const el = document.createElement('ui-breadcrumbs');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiBreadcrumbs, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = (el: UiBreadcrumbs, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const text = (n: Element | null | undefined) => n?.textContent ?? '';
const labels = (el: UiBreadcrumbs) => qa(el, '.bc-item').map((li) => text(li).trim());
/** Pretend the list is `scroll` wide inside a `client` box. */
function size(el: UiBreadcrumbs, scroll: number, client: number): void {
  const list = q(el, '.bc-list')!;
  Object.defineProperty(list, 'scrollWidth', { value: scroll, configurable: true });
  Object.defineProperty(list, 'clientWidth', { value: client, configurable: true });
}

const TRAIL: BreadcrumbsData = {
  items: [
    { id: 'home', label: 'soma-work', href: '/' },
    { id: 'inbox', label: 'Agent inbox', href: '/inbox' },
    { id: 's1', label: 'Fix the checkout bug', href: '/inbox/s1' },
    { id: 'tasks', label: 'Tasks' },
  ],
};
const PATH: BreadcrumbsData = {
  label: 'Agent path',
  items: [
    { id: 'main', label: 'Main' },
    { id: 'a1', label: 'Explore' },
    { id: 'a2', label: 'Fix', title: 'Fix · rounding in total.ts' },
  ],
};

beforeEach(() => {
  document.body.innerHTML = '';
  FakeRO.all = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pure helpers', () => {
  it('normalizes items and says which show', () => {
    expect(breadcrumbItems([{ label: 'A', id: 1 }, null, 'x', { label: 2 }])).toEqual([
      { label: 'A', id: '1' },
      { label: '2', id: undefined },
    ]);
    expect(breadcrumbItems('nope')).toEqual([]);
    expect(breadcrumbVisible(4, false)).toEqual([0, 1, 2, 3]);
    expect(breadcrumbVisible(4, true)).toEqual([0, 3]);
    expect(breadcrumbVisible(2, true)).toEqual([0, 1]);
    expect(breadcrumbVisible(0, true)).toEqual([]);
    expect(breadcrumbCollapse('never')).toBe('never');
    expect(breadcrumbCollapse(null)).toBe('auto');
    expect(breadcrumbCollapse('always')).toBe('auto');
  });
});

describe('<ui-breadcrumbs> rendering', () => {
  it('draws a named nav over an ordered list: links for crumbs with href, the last one the current page as text', () => {
    const el = mount(TRAIL);
    const nav = q(el, 'nav')!;
    expect(nav.getAttribute('aria-label')).toBe('Breadcrumbs');
    expect(q(el, 'nav > ol.bc-list')).not.toBeNull();
    expect(labels(el)).toEqual(['soma-work', 'Agent inbox', 'Fix the checkout bug', 'Tasks']);
    const links = qa(el, 'a.bc-link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/', '/inbox', '/inbox/s1']);
    expect(links.map((a) => a.dataset.key)).toEqual(['c0', 'c1', 'c2']);
    const cur = q(el, '[aria-current="page"]')!;
    expect(cur.tagName).toBe('SPAN');
    expect(text(cur)).toBe('Tasks');
    expect(q(el, '.bc-item:last-child a, .bc-item:last-child button')).toBeNull();
    // Separators between crumbs, hidden from screen readers, never after the last.
    const seps = qa(el, '.bc-sep');
    expect(seps.length).toBe(3);
    expect(seps.every((s) => s.getAttribute('aria-hidden') === 'true' && s.querySelector('svg'))).toBe(true);
    expect(q(el, 'ol')!.lastElementChild?.classList.contains('bc-item')).toBe(true);
    // The end slot after the list.
    expect(q(el, 'nav > .bc-end > slot[name="end"]')).not.toBeNull();
  });

  it('draws buttons for crumbs without href, carries titles, and takes the host’s nav label', () => {
    const el = mount(PATH);
    expect(q(el, 'nav')?.getAttribute('aria-label')).toBe('Agent path');
    const btns = qa(el, 'button.bc-btn');
    expect(btns.map((b) => [(b as HTMLButtonElement).type, b.dataset.i, text(b)])).toEqual([
      ['button', '0', 'Main'],
      ['button', '1', 'Explore'],
    ]);
    expect(q(el, 'a')).toBeNull();
    expect(q(el, '[aria-current="page"]')?.getAttribute('title')).toBe('Fix · rounding in total.ts');
    expect(btns[0].hasAttribute('title')).toBe(false);
  });

  it('renders nothing without data, one crumb alone as the current page, and survives junk', () => {
    expect(q(mount(undefined), '.bc-item')).toBeNull();
    const one = mount({ items: [{ label: 'Home' }] });
    expect(labels(one)).toEqual(['Home']);
    expect(q(one, '[aria-current="page"]')).not.toBeNull();
    expect(q(one, '.bc-sep')).toBeNull();
    const junk = mount({ items: [null, { label: 'A' }, 'x', { label: 'B' }] as never });
    expect(labels(junk)).toEqual(['A', 'B']);
    expect(q(mount({ items: 'x' as never }), '.bc-item')).toBeNull();
  });

  it('escapes every host string and refuses unsafe hrefs', () => {
    const el = mount({
      label: XSS,
      items: [
        { id: XSS, label: XSS, href: 'javascript:alert(1)', title: XSS },
        { label: 'off-site', href: '//evil.example/x' },
        { label: XSS, href: `/x?q=${XSS}` },
        { label: XSS, title: XSS },
      ],
    });
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    const all = Array.from(el.shadowRoot!.querySelectorAll('*'));
    expect(all.some((n) => n.getAttributeNames().some((a) => a.startsWith('on')))).toBe(false);
    expect(el.shadowRoot!.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(q(el, 'nav')?.getAttribute('aria-label')).toBe(XSS);
    expect(qa(el, 'a').map((a) => a.getAttribute('href'))).toEqual(['#', '#', `/x?q=${XSS}`]);
    expect(q(el, 'a')?.getAttribute('title')).toBe(XSS);
    expect(text(q(el, '[aria-current="page"]'))).toBe(XSS);
  });

  it('sizes: the default trail and size="sm"; tokens only, 44px on coarse pointers, still under reduced motion', () => {
    const el = mount(TRAIL, { size: 'sm' });
    const css = q(el, 'style')?.textContent ?? '';
    expect(css).toContain('.bc { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 15px;');
    expect(css).toContain(':host([size="sm"]) .bc { font-size: 12px;');
    expect(css).toMatch(/\(pointer: coarse\)[^{]*\{\s*\.bc-link, \.bc-btn, \.bc-more \{ min-height: 44px;/);
    expect(css).toMatch(/\(pointer: coarse\)[^}]*\}\s*\.bc-more \{ width: 44px; \}/);
    expect(css).toContain('.bc-item.bc-fold { flex: none; }');
    // The current page reads whole (it never shrinks below 60% of the row); the middle crumbs give way first.
    expect(css).toContain('.bc-item:last-child { flex-shrink: 0; max-width: 60%; }');
    expect(css).toContain('.bc-item { display: flex; align-items: center; flex: 0 4 auto; min-width: 0; }');
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[^}]*\.bc-item\.is-in \{ animation: none; \}/);
    expect(css).toContain(
      '.bc-link:hover, .bc-btn:hover, .bc-more:hover { background: var(--ib-pill); color: var(--text); }',
    );
    // No hover movement, no hard-coded colours.
    expect(css).not.toMatch(/:hover[^}]*transform/);
    expect(styles.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});

describe('ui-select', () => {
  it('says which crumb was chosen (cancelable, bubbles, composed) — buttons only, links are the browser’s', () => {
    const el = mount(PATH);
    const seen: Array<{ detail: BreadcrumbsSelect; cancelable: boolean; bubbles: boolean; composed: boolean }> = [];
    el.addEventListener('ui-select', (e) => {
      const ev = e as CustomEvent<BreadcrumbsSelect>;
      seen.push({ detail: ev.detail, cancelable: ev.cancelable, bubbles: ev.bubbles, composed: ev.composed });
    });
    qa(el, '.bc-btn')[1].click();
    expect(seen).toEqual([
      {
        detail: { id: 'a1', index: 1, item: { id: 'a1', label: 'Explore' } },
        cancelable: true,
        bubbles: true,
        composed: true,
      },
    ]);
    const trail = mount(TRAIL);
    const heard: BreadcrumbsSelect[] = [];
    trail.addEventListener('ui-select', (e) => heard.push((e as CustomEvent<BreadcrumbsSelect>).detail));
    qa(trail, 'a')[0].dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
    expect(heard).toEqual([]);
  });

  it('an item without id reports undefined; the current page is not a control', () => {
    const el = mount({ items: [{ label: 'Root' }, { label: 'Here' }] });
    const seen: BreadcrumbsSelect[] = [];
    el.addEventListener('ui-select', (e) => seen.push((e as CustomEvent<BreadcrumbsSelect>).detail));
    q<HTMLButtonElement>(el, '.bc-btn')!.click();
    expect(seen[0].id).toBeUndefined();
    expect(seen[0].index).toBe(0);
    q(el, '.bc-cur')!.click();
    expect(seen.length).toBe(1);
  });
});

describe('collapse', () => {
  it('folds the middle crumbs behind a named “…” button when the row overflows; first and last stay', () => {
    vi.stubGlobal('ResizeObserver', FakeRO);
    const el = mount(TRAIL);
    expect(el.folded).toBe(false);
    expect(FakeRO.all[0].targets).toEqual([q(el, '.bc-list')]);
    size(el, 700, 400);
    FakeRO.fire(q(el, '.bc-list')!);
    expect(el.folded).toBe(true);
    expect(labels(el)).toEqual(['soma-work', '', 'Tasks']);
    const more = q<HTMLButtonElement>(el, '.bc-more')!;
    expect(more.getAttribute('aria-label')).toBe('Show 2 more');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(more.dataset.key).toBe('more');
    expect(more.querySelector('svg')).not.toBeNull();
    expect(qa(el, '.bc-sep').length).toBe(2);
    expect(text(q(el, '[aria-current="page"]'))).toBe('Tasks');
    expect(q(el, 'a.bc-link')?.getAttribute('href')).toBe('/');
    // Morphed, not replaced: the observed list is the same node.
    expect(FakeRO.all[0].targets).toEqual([q(el, '.bc-list')]);
  });

  it('“…” reveals the folded crumbs inline, moves focus to the first of them, and holds until the trail changes', () => {
    vi.stubGlobal('ResizeObserver', FakeRO);
    const el = mount(TRAIL);
    size(el, 700, 400);
    FakeRO.fire(q(el, '.bc-list')!);
    const more = q<HTMLButtonElement>(el, '.bc-more')!;
    more.focus();
    more.click();
    expect(el.folded).toBe(false);
    expect(labels(el)).toEqual(['soma-work', 'Agent inbox', 'Fix the checkout bug', 'Tasks']);
    expect(q(el, '.bc-more')).toBeNull();
    expect(el.shadowRoot!.activeElement).toBe(q(el, '.bc-item[data-i="1"] > a'));
    expect(qa(el, '.bc-item.is-in').map((li) => li.dataset.i)).toEqual(['1', '2']);
    // Still too narrow, still open: the person asked for it.
    FakeRO.fire(q(el, '.bc-list')!);
    expect(el.folded).toBe(false);
    el.renderNow();
    expect(q(el, '.bc-item.is-in')).toBeNull();
    // A new trail folds again when it overflows.
    el.data = { items: [...TRAIL.items, { label: 'Runs' }] };
    el.renderNow();
    expect(el.folded).toBe(true);
    expect(q(el, '.bc-more')?.getAttribute('aria-label')).toBe('Show 3 more');
  });

  it('folds when a crumb had to ellipsize even though the list itself fits (its need counts the cut text)', () => {
    vi.stubGlobal('ResizeObserver', FakeRO);
    const el = mount(TRAIL);
    size(el, 400, 400);
    const cut = qa(el, '.bc-link')[2];
    Object.defineProperty(cut, 'scrollWidth', { value: 150, configurable: true });
    Object.defineProperty(cut, 'clientWidth', { value: 90, configurable: true });
    FakeRO.fire(q(el, '.bc-list')!);
    expect(el.folded).toBe(true);
    expect(labels(el)).toEqual(['soma-work', '', 'Tasks']);
    // It needed 460: a 450 box keeps the fold, a 460 box lets it go.
    size(el, 300, 450);
    FakeRO.fire(q(el, '.bc-list')!);
    expect(el.folded).toBe(true);
    size(el, 300, 460);
    FakeRO.fire(q(el, '.bc-list')!);
    expect(el.folded).toBe(false);
    expect(labels(el).length).toBe(4);
  });

  it('unfolds once the box is as wide as the row needed, and never flips in between', () => {
    vi.stubGlobal('ResizeObserver', FakeRO);
    const el = mount(TRAIL);
    size(el, 700, 400);
    FakeRO.fire(q(el, '.bc-list')!);
    expect(el.folded).toBe(true);
    size(el, 390, 600);
    FakeRO.fire(q(el, '.bc-list')!);
    expect(el.folded).toBe(true); // narrower than the 700px it needed
    size(el, 390, 720);
    FakeRO.fire(q(el, '.bc-list')!);
    expect(el.folded).toBe(false);
    expect(labels(el).length).toBe(4);
  });

  it('collapse="never" keeps every crumb; two crumbs never fold; no observer, no fold', () => {
    vi.stubGlobal('ResizeObserver', FakeRO);
    const never = mount(TRAIL, { collapse: 'never' });
    size(never, 700, 400);
    FakeRO.fire(q(never, '.bc-list')!);
    expect(never.folded).toBe(false);
    expect(labels(never).length).toBe(4);
    never.removeAttribute('collapse');
    never.renderNow();
    FakeRO.fire(q(never, '.bc-list')!);
    expect(never.folded).toBe(true);
    const two = mount({ items: TRAIL.items.slice(0, 2) });
    size(two, 700, 400);
    FakeRO.fire(q(two, '.bc-list')!);
    expect(two.folded).toBe(false);
    vi.unstubAllGlobals();
    const plain = mount(TRAIL);
    size(plain, 700, 400);
    expect(plain.folded).toBe(false);
  });

  it('measures again when the end slot changes, and lets the observer go when disconnected', () => {
    vi.stubGlobal('ResizeObserver', FakeRO);
    const el = mount(TRAIL);
    const chip = document.createElement('span');
    chip.slot = 'end';
    chip.textContent = 'Running';
    size(el, 700, 400);
    el.append(chip);
    el.shadowRoot!.querySelector('slot[name="end"]')!.dispatchEvent(new Event('slotchange'));
    expect(el.folded).toBe(true);
    expect(el.querySelector('[slot="end"]')).toBe(chip);
    el.remove();
    expect(FakeRO.all[0].targets).toEqual([]);
  });
});

describe('lang="ko"', () => {
  it('names the nav 위치 and the fold N개 더 보기', () => {
    vi.stubGlobal('ResizeObserver', FakeRO);
    const el = mount(TRAIL, { lang: 'ko' });
    expect(q(el, 'nav')?.getAttribute('aria-label')).toBe('위치');
    size(el, 700, 400);
    FakeRO.fire(q(el, '.bc-list')!);
    expect(q(el, '.bc-more')?.getAttribute('aria-label')).toBe('2개 더 보기');
    expect(q(el, 'style')?.textContent).toContain(':host([lang="ko"]), :host(:lang(ko)) { word-break: keep-all; }');
  });

  it('switches language when the attribute changes', async () => {
    const el = mount(TRAIL);
    el.setAttribute('lang', 'ko');
    await Promise.resolve();
    expect(q(el, 'nav')?.getAttribute('aria-label')).toBe('위치');
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    spy = soundSpy();
  });
  afterEach(() => spy.restore());
  const tap = (n: Element | null, detail = 1) =>
    n!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail }));

  it('a chosen crumb goes back (quiet); not when the host prevented it; “…” opens (quiet); links are silent', async () => {
    vi.stubGlobal('ResizeObserver', FakeRO);
    const el = mount(PATH);
    tap(qa(el, '.bc-btn')[0]);
    await spy.settle();
    el.addEventListener('ui-select', (e) => e.preventDefault(), { once: true });
    tap(qa(el, '.bc-btn')[1], 0);
    await spy.settle();
    size(el, 700, 100);
    FakeRO.fire(q(el, '.bc-list')!);
    tap(q(el, '.bc-more'), 0);
    await spy.settle();
    const trail = mount(TRAIL);
    tap(qa(trail, 'a')[0]);
    await spy.settle();
    expect(spy.calls).toEqual([
      ['navigate', { emphasis: 'subtle', direction: 'back', input: 'mouse' }],
      ['open', { emphasis: 'subtle', input: 'keyboard' }],
    ]);
  });
});
