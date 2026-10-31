import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import './disclosure';
import { cssMs, type DisclosureData, type UiDisclosure } from './disclosure';
import { styles } from './styles';

function mount(data: DisclosureData | undefined, attrs: Record<string, string> = {}, body = 'Body text'): UiDisclosure {
  const el = document.createElement('ui-disclosure') as UiDisclosure;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  const p = document.createElement('p');
  p.textContent = body;
  const link = document.createElement('a');
  link.href = '#x';
  link.textContent = 'inner link';
  el.append(p, link);
  document.body.append(el);
  if (data) el.data = data;
  el.renderNow();
  return el;
}
const q = (el: UiDisclosure, s: string) => el.shadowRoot!.querySelector<HTMLElement>(s);

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('<ui-disclosure>', () => {
  it('renders a closed row: aria-expanded=false, region inert, chevron from the icon set', () => {
    const el = mount({ summary: 'Session info', meta: '6' });
    const head = q(el, '.dc-head')!;
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(head.getAttribute('aria-controls')).toBe('dc-region');
    expect(q(el, '.dc-region')?.hasAttribute('inert')).toBe(true);
    expect(q(el, '.dc')?.hasAttribute('data-open')).toBe(false);
    expect(q(el, '.dc-summary')?.textContent).toBe('Session info');
    expect(q(el, '.dc-meta')?.textContent).toBe('6');
    expect(q(el, 'svg.dc-chev[data-icon="chevron-right"]')).not.toBeNull();
    expect(el.open).toBe(false);
  });

  it('reads summary and meta from attributes; data wins; everything is escaped', () => {
    const a = mount(undefined, { summary: '<b>A</b>', meta: '<i>1</i>' });
    expect(q(a, '.dc-summary b')).toBeNull();
    expect(q(a, '.dc-summary')?.textContent).toBe('<b>A</b>');
    expect(q(a, '.dc-meta')?.textContent).toBe('<i>1</i>');
    const b = mount({ summary: 'From data' }, { summary: 'From attr' });
    expect(q(b, '.dc-summary')?.textContent).toBe('From data');
  });

  it('a press sends a cancelable ui-toggle and opens', () => {
    const el = mount({ summary: 'S' });
    const fired = vi.fn();
    el.addEventListener('ui-toggle', (e) => fired((e as CustomEvent).detail));
    q(el, '.dc-head')!.click();
    expect(fired).toHaveBeenCalledWith({ open: true });
    el.renderNow();
    expect(el.open).toBe(true);
    expect(el.hasAttribute('open')).toBe(true);
    expect(q(el, '.dc-head')?.getAttribute('aria-expanded')).toBe('true');
    expect(q(el, '.dc-region')?.hasAttribute('inert')).toBe(false);
    q(el, '.dc-head')!.click();
    el.renderNow();
    expect(fired).toHaveBeenLastCalledWith({ open: false });
    expect(q(el, '.dc-region')?.hasAttribute('inert')).toBe(true);
  });

  it('preventDefault keeps the state', () => {
    const el = mount({ summary: 'S' });
    el.addEventListener('ui-toggle', (e) => e.preventDefault());
    q(el, '.dc-head')!.click();
    el.renderNow();
    expect(el.open).toBe(false);
  });

  it('the open attribute and property change state without an event', () => {
    const el = mount({ summary: 'S' });
    const fired = vi.fn();
    el.addEventListener('ui-toggle', fired);
    el.setAttribute('open', '');
    el.renderNow();
    expect(el.open).toBe(true);
    el.open = false;
    el.renderNow();
    expect(el.hasAttribute('open')).toBe(false);
    expect(q(el, '.dc-region')?.hasAttribute('inert')).toBe(true);
    expect(fired).not.toHaveBeenCalled();
  });

  it('starting open draws open and settled (no clipping, nothing to animate)', () => {
    const el = mount({ summary: 'S' }, { open: '' });
    expect(q(el, '.dc')?.hasAttribute('data-open')).toBe(true);
    expect(q(el, '.dc')?.hasAttribute('data-settled')).toBe(true);
  });

  it('opening later clips until the grow transition ends', () => {
    const el = mount({ summary: 'S' });
    el.toggle();
    el.renderNow();
    const dc = q(el, '.dc')!;
    expect(dc.hasAttribute('data-settled')).toBe(false);
    const ev = new Event('transitionend', { bubbles: true }) as TransitionEvent;
    Object.defineProperty(ev, 'propertyName', { value: 'grid-template-rows' });
    q(el, '.dc-region')!.dispatchEvent(ev);
    expect(dc.hasAttribute('data-settled')).toBe(true);
    el.renderNow();
    expect(q(el, '.dc')?.hasAttribute('data-settled')).toBe(true);
  });

  it('a disabled row does not toggle', () => {
    const el = mount({ summary: 'S', disabled: true });
    const fired = vi.fn();
    el.addEventListener('ui-toggle', fired);
    expect(q(el, '.dc-head')?.getAttribute('aria-disabled')).toBe('true');
    q(el, '.dc-head')!.click();
    expect(fired).not.toHaveBeenCalled();
    expect(el.open).toBe(false);
  });

  it('level wraps the row in a heading', () => {
    const el = mount({ summary: 'S' }, { level: '3' });
    const h = q(el, '[role="heading"]');
    expect(h?.getAttribute('aria-level')).toBe('3');
    expect(h?.querySelector('.dc-head')).not.toBeNull();
    expect(q(mount({ summary: 'S' }, { level: '9' }), '[role="heading"]')).toBeNull();
  });

  it('keeps its nodes across renders (the transition survives)', () => {
    const el = mount({ summary: 'S' });
    const region = q(el, '.dc-region');
    el.toggle();
    el.renderNow();
    expect(q(el, '.dc-region')).toBe(region);
  });

  it('the summary row keeps focus across a toggle', () => {
    const el = mount({ summary: 'S' });
    const head = q(el, '.dc-head')!;
    head.focus();
    head.click();
    el.renderNow();
    expect(el.shadowRoot!.activeElement).toBe(head);
  });

  it('styles: 0fr → 1fr on --dur-expand with opacity, chevron on --dur-press, hover gated, reduced motion', () => {
    expect(styles).toContain(
      'grid-template-rows: 0fr; transition: grid-template-rows var(--dur-expand) var(--ease-out)',
    );
    expect(styles).toContain('.dc[data-open] .dc-region { grid-template-rows: 1fr; }');
    expect(styles).toContain('.dc-region { display: grid; grid-template-columns: minmax(0, 1fr);');
    expect(styles).toContain('transition: transform var(--dur-press) var(--ease-out)');
    expect(styles).toContain('.dc[data-open] .dc-chev { transform: rotate(90deg); }');
    expect(styles).toMatch(/\.dc-inner \{[^}]*visibility: hidden/);
    expect(styles).toMatch(/@media \(hover: hover\) and \(pointer: fine\)/);
    expect(styles).toMatch(
      /prefers-reduced-motion: reduce\) \{\s*\.dc-region, \.dc-chev \{ transition: none !important; \}/,
    );
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  describe('G4: slotted summary, external trigger, ui-toggled, roved rows', () => {
    const grow = (el: UiDisclosure) => {
      const ev = new Event('transitionend', { bubbles: true }) as TransitionEvent;
      Object.defineProperty(ev, 'propertyName', { value: 'grid-template-rows' });
      q(el, '.dc-region')!.dispatchEvent(ev);
    };

    it('a click on slotted summary content toggles (G4-4)', () => {
      const el = mount(undefined);
      const words = document.createElement('span');
      words.slot = 'summary';
      words.innerHTML = '<b>System</b> · 12:03';
      el.append(words);
      el.renderNow();
      words.querySelector('b')!.click();
      expect(el.open).toBe(true);
      // A click in the region does not.
      el.querySelector('p')!.click();
      expect(el.open).toBe(true);
    });

    it('cssMs reads the first duration in ms', () => {
      expect(cssMs('0.24s, 0s')).toBe(240);
      expect(cssMs('180ms')).toBe(180);
      expect(cssMs('0s')).toBe(0);
      expect(Number.isNaN(cssMs(''))).toBe(true);
    });

    it('ui-toggled follows once the region settles — open and closed — and is not cancelable (G4-2)', () => {
      vi.useFakeTimers();
      try {
        const el = mount({ summary: 'Tasks' });
        const seen: Array<[boolean, boolean]> = [];
        el.addEventListener('ui-toggled', (e) =>
          seen.push([(e as CustomEvent).detail.open, (e as CustomEvent).cancelable]),
        );
        q(el, '.dc-head')!.click();
        el.renderNow();
        expect(seen).toEqual([]);
        grow(el);
        expect(seen).toEqual([[true, false]]);
        expect(q(el, '.dc')?.hasAttribute('data-settled')).toBe(true);
        vi.advanceTimersByTime(1000);
        expect(seen).toHaveLength(1);
        el.open = false; // the host's own change settles too
        el.renderNow();
        grow(el);
        expect(seen).toEqual([
          [true, false],
          [false, false],
        ]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('without a transitionend the duration fallback reports it; a quick re-toggle reports only the last state', () => {
      vi.useFakeTimers();
      try {
        const el = mount({ summary: 'Tasks' });
        const seen: boolean[] = [];
        el.addEventListener('ui-toggled', (e) => seen.push((e as CustomEvent).detail.open));
        el.toggle();
        el.renderNow();
        vi.advanceTimersByTime(100);
        el.toggle();
        el.renderNow();
        vi.advanceTimersByTime(400);
        expect(seen).toEqual([false]);
        // Nothing on first paint, nothing for a state the element was born in.
        const born = mount({ summary: 'S' }, { open: '' });
        const fired = vi.fn();
        born.addEventListener('ui-toggled', fired);
        vi.advanceTimersByTime(400);
        expect(fired).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('reduced motion reports at once (after the render)', async () => {
      const mm = vi
        .spyOn(window, 'matchMedia')
        .mockImplementation((q: string) => ({ matches: q.includes('reduce'), media: q }) as MediaQueryList);
      try {
        const el = mount({ summary: 'S' });
        const fired = vi.fn();
        el.addEventListener('ui-toggled', fired);
        el.toggle();
        el.renderNow();
        await Promise.resolve();
        expect(fired).toHaveBeenCalledTimes(1);
      } finally {
        mm.mockRestore();
      }
    });

    it('trigger="external" draws no row; for= wires the host button (aria, click), even after a repaint (G4-1)', () => {
      const btn = document.createElement('button');
      btn.id = 'stats-more';
      btn.textContent = 'More';
      document.body.append(btn);
      const el = mount(undefined, { trigger: 'external', for: 'stats-more' });
      expect(q(el, '.dc-head')).toBeNull();
      expect(el.id).toMatch(/^ui-dc-\d+$/);
      expect(btn.getAttribute('aria-expanded')).toBe('false');
      expect(btn.getAttribute('aria-controls')).toBe(el.id);
      const asked = vi.fn();
      el.addEventListener('ui-toggle', (e) => asked((e as CustomEvent).detail.open));
      btn.click();
      el.renderNow();
      expect(el.open).toBe(true);
      expect(asked).toHaveBeenCalledWith(true);
      expect(btn.getAttribute('aria-expanded')).toBe('true');
      expect(q(el, '.dc-region')?.hasAttribute('inert')).toBe(false);
      // The host repaints its strip: a new button with the same id.
      const again = btn.cloneNode(true) as HTMLButtonElement;
      btn.replaceWith(again);
      again.click();
      el.renderNow();
      expect(el.open).toBe(false);
      expect(again.getAttribute('aria-expanded')).toBe('false');
      // A disabled trigger does nothing; leaving the page takes our attributes off.
      again.disabled = true;
      again.click();
      expect(el.open).toBe(false);
      el.remove();
      expect(again.hasAttribute('aria-expanded')).toBe(false);
      expect(again.hasAttribute('aria-controls')).toBe(false);
      again.disabled = false;
      again.click();
      expect(el.open).toBe(false);
      expect(styles).toContain(':host([trigger="external"]) .dc-body { padding: 0; }');
    });

    it('show() / hide() ask like toggle(): a cancelable ui-toggle, and nothing when already there', () => {
      const el = mount(undefined, { trigger: 'external' });
      const asked = vi.fn();
      el.addEventListener('ui-toggle', (e) => asked((e as CustomEvent).detail.open));
      el.hide();
      expect(asked).not.toHaveBeenCalled();
      el.show();
      expect(el.open).toBe(true);
      el.show();
      expect(asked).toHaveBeenCalledTimes(1);
      el.addEventListener('ui-toggle', (e) => e.preventDefault(), { once: true });
      el.hide();
      expect(el.open).toBe(true);
      el.hide();
      expect(el.open).toBe(false);
    });

    it('head-tabindex passes to the row; focus() lands on the row unless the host is focusable itself (G4-3)', () => {
      const el = mount({ summary: 'Step 3 · Edit' }, { 'head-tabindex': '-1' });
      const head = q(el, '.dc-head')!;
      expect(head.getAttribute('tabindex')).toBe('-1');
      el.focus();
      expect(el.shadowRoot!.activeElement).toBe(head);
      expect(document.activeElement).toBe(el);
      el.setAttribute('head-tabindex', 'x');
      el.renderNow();
      expect(q(el, '.dc-head')?.hasAttribute('tabindex')).toBe(false);
      const own = mount({ summary: 'S' }, { tabindex: '0' });
      own.focus();
      expect(document.activeElement).toBe(own);
      expect(own.shadowRoot!.activeElement).toBeNull();
    });
  });

  it('carries Korean text with lang="ko"', () => {
    const el = mount({ summary: '자세히', meta: '3' }, { lang: 'ko' });
    expect(q(el, '.dc-summary')?.textContent).toBe('자세히');
  });

  describe('G6-2: the links slot — a row under the summary that stays in view while closed', () => {
    function withLinks(attrs: Record<string, string> = {}): { el: UiDisclosure; nav: HTMLElement } {
      const el = mount({ summary: 'Mina Park · release-notes · 12.3K tokens · $0.42' }, attrs);
      const nav = document.createElement('nav');
      nav.slot = 'links';
      nav.innerHTML = '<a href="#issue">Issue</a> <a href="#pr">PR</a>';
      el.append(nav);
      el.renderNow();
      return { el, nav };
    }

    it('is hidden with nothing slotted; shows once a links child arrives (slotchange) and goes when it leaves', () => {
      const el = mount({ summary: 'S' });
      expect(q(el, '.dc-links')?.hidden).toBe(true);
      expect(el.hasLinks).toBe(false);
      const nav = document.createElement('nav');
      nav.slot = 'links';
      nav.textContent = 'Issue';
      el.append(nav);
      el.renderNow();
      expect(el.hasLinks).toBe(true);
      expect(q(el, '.dc-links')?.hidden).toBe(false);
      nav.remove();
      el.renderNow();
      expect(q(el, '.dc-links')?.hidden).toBe(true);
    });

    it('sits between the row and the region, outside the inert region, so its links work while closed', () => {
      const { el } = withLinks();
      const links = q(el, '.dc-links')!;
      expect(links.getAttribute('part')).toBe('links');
      expect(links.previousElementSibling?.classList.contains('dc-head')).toBe(true);
      expect(links.nextElementSibling?.classList.contains('dc-region')).toBe(true);
      expect(links.closest('.dc-region')).toBeNull();
      expect(q(el, '.dc-region')?.hasAttribute('inert')).toBe(true);
      expect(links.querySelector('slot')?.getAttribute('name')).toBe('links');
    });

    it('a click on a slotted link does not toggle the region', () => {
      const { el, nav } = withLinks();
      const fired = vi.fn();
      el.addEventListener('ui-toggle', fired);
      nav
        .querySelector('a')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
      expect(fired).not.toHaveBeenCalled();
      expect(el.open).toBe(false);
    });

    it('keeps the row with trigger="external" and variant="card" (padding rules exist)', () => {
      const { el } = withLinks({ trigger: 'external', for: 'nope', variant: 'card' });
      expect(q(el, '.dc-head')).toBeNull();
      expect(q(el, '.dc-links')?.hidden).toBe(false);
      expect(styles).toMatch(/:host\(\[variant="card"\]\) \.dc-links \{ padding/);
      expect(styles).toMatch(/:host\(\[trigger="external"\]\) \.dc-links \{ padding/);
      expect(styles).toMatch(/\.dc-links\[hidden\] \{ display: none; \}/);
    });
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    spy = soundSpy();
  });
  afterEach(() => {
    spy.restore();
    Reflect.deleteProperty(navigator, 'userActivation');
  });
  const tap = (t: EventTarget, detail = 1) =>
    t.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail }));
  const activation = (isActive: boolean) =>
    Object.defineProperty(navigator, 'userActivation', { configurable: true, get: () => ({ isActive }) });

  it('the row opens and closes with a subtle open / close', async () => {
    const el = mount({ summary: 'Info' });
    tap(q(el, '.dc-head')!);
    await spy.settle();
    tap(q(el, '.dc-head')!, 0);
    await spy.settle();
    expect(el.open).toBe(false);
    expect(spy.calls).toEqual([
      ['open', { emphasis: 'subtle', input: 'mouse' }],
      ['close', { emphasis: 'subtle', input: 'keyboard' }],
    ]);
  });

  it('the external trigger sounds; the host’s own toggle() / show() / hide() only inside a user gesture', async () => {
    const btn = document.createElement('button');
    btn.id = 'more';
    document.body.append(btn);
    const el = mount(undefined, { trigger: 'external', for: 'more' });
    tap(btn);
    await spy.settle();
    activation(false);
    el.hide();
    el.toggle();
    await spy.settle();
    activation(true);
    el.hide();
    await spy.settle();
    expect(spy.calls).toEqual([
      ['open', { emphasis: 'subtle', input: 'mouse' }],
      ['close', { emphasis: 'subtle' }],
    ]);
  });

  it('silent for a cancelled toggle, the open property / attribute, a disabled row, and a quiet region', async () => {
    const el = mount({ summary: 'Info' });
    el.addEventListener('ui-toggle', (e) => e.preventDefault(), { once: true });
    tap(q(el, '.dc-head')!);
    el.open = true;
    el.removeAttribute('open');
    el.data = { summary: 'Info', disabled: true };
    el.renderNow();
    tap(q(el, '.dc-head')!);
    expect(el.open).toBe(false);
    await spy.settle();
    expect(spy.calls).toEqual([]);
    el.data = { summary: 'Info' };
    el.renderNow();
    const quiet = document.createElement('div');
    quiet.setAttribute('data-ui-sound', 'off');
    document.body.append(quiet);
    quiet.append(el);
    tap(q(el, '.dc-head')!);
    expect(el.open).toBe(true);
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });
});
