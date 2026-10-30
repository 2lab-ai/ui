import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clampDrawerWidth, DRAWER_EXIT_MS, drawerWidthBounds, resolveDrawerMode, type UiDrawer } from './drawer';
import { styles } from './styles';

function mount(attrs: Record<string, string> = {}, html = '<p>Body</p>'): UiDrawer {
  const el = document.createElement('ui-drawer') as UiDrawer;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.innerHTML = html;
  document.body.append(el);
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiDrawer, s: string) => el.shadowRoot!.querySelector<E>(s);
const dlg = (el: UiDrawer) => q<HTMLDialogElement>(el, 'dialog')!;
const key = (t: EventTarget, k: string, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init });
  t.dispatchEvent(e);
  return e;
};
const ptr = (t: EventTarget, type: string, clientX = 0) =>
  t.dispatchEvent(new PointerEvent(type, { pointerId: 1, clientX, bubbles: true, composed: true, cancelable: true }));
const click = (t: EventTarget) =>
  t.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
function events<T>(el: UiDrawer, name: string): T[] {
  const seen: T[] = [];
  el.addEventListener(name, (e) => seen.push((e as CustomEvent<T>).detail));
  return seen;
}

/** A matchMedia whose min-width answer the test flips (and tells the listeners about). */
function fakeMedia(wide: boolean) {
  const listeners = new Set<() => void>();
  const state = { wide };
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('min-width') ? state.wide : false;
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }));
  return {
    set(w: boolean) {
      state.wide = w;
      for (const fn of Array.from(listeners)) fn();
    },
    listeners,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('helpers', () => {
  it('clampDrawerWidth keeps [min, min(max, viewport - 48)] and rounds', () => {
    expect(clampDrawerWidth(480, 320, 960, 1024)).toBe(480);
    expect(clampDrawerWidth(2000, 320, 960, 1440)).toBe(960);
    expect(clampDrawerWidth(2000, 320, 960, 800)).toBe(752);
    expect(clampDrawerWidth(100, 320, 960, 1024)).toBe(320);
    expect(clampDrawerWidth(500.6, 320, 960, 1024)).toBe(501);
    // A viewport too narrow for min: min wins (the sheet's CSS caps it at the viewport).
    expect(clampDrawerWidth(480, 320, 960, 340)).toBe(320);
    expect(clampDrawerWidth(Number.NaN, 320, 960, 1024)).toBe(320);
    expect(clampDrawerWidth(5000, 320, 960, Number.NaN)).toBe(960);
  });
  it('drawerWidthBounds never puts max under min', () => {
    expect(drawerWidthBounds(320, 960, 1024)).toEqual([320, 960]);
    expect(drawerWidthBounds(320, 960, 900)).toEqual([320, 852]);
    expect(drawerWidthBounds(400, 300, 1024)).toEqual([400, 400]);
  });
  it('resolveDrawerMode: explicit modes win, auto docks when wide', () => {
    expect(resolveDrawerMode('sheet', true)).toBe('sheet');
    expect(resolveDrawerMode('dock', false)).toBe('dock');
    expect(resolveDrawerMode('auto', true)).toBe('dock');
    expect(resolveDrawerMode(null, false)).toBe('sheet');
  });
});

describe('<ui-drawer>', () => {
  it('is closed by default', () => {
    const el = mount({ heading: 'Detail' });
    expect(dlg(el).open).toBe(false);
    expect(dlg(el).dataset.state).toBe('closed');
    expect(el.open).toBe(false);
    expect(el.hasAttribute('open')).toBe(false);
  });

  it('auto mode at 1024px docks: a non-modal show(), no scrim, docked', () => {
    const el = mount({ heading: 'Detail' });
    const modal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    const plain = vi.spyOn(HTMLDialogElement.prototype, 'show');
    el.show();
    expect(plain).toHaveBeenCalledTimes(1);
    expect(modal).not.toHaveBeenCalled();
    expect(dlg(el).open).toBe(true);
    expect(dlg(el).dataset.mode).toBe('dock');
    expect(dlg(el).dataset.state).toBe('open');
    expect(el.docked).toBe(true);
    expect(el.hasAttribute('open')).toBe(true);
    expect(styles).toContain('.dr[data-mode="dock"] .dr-scrim { display: none; }');
  });

  it('mode="sheet" opens modally over the scrim', () => {
    const el = mount({ heading: 'Runs', mode: 'sheet' });
    const modal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    el.show();
    expect(modal).toHaveBeenCalledTimes(1);
    expect(dlg(el).dataset.mode).toBe('sheet');
    expect(el.docked).toBe(false);
    expect(q(el, '.dr-scrim')).not.toBeNull();
  });

  it('a mode flip while open re-opens the other way, keeps focus inside, and says so', () => {
    const el = mount({ heading: 'Detail' }, '<button autofocus>Resume</button>');
    const modes = events<{ mode: string }>(el, 'ui-mode-change');
    el.show();
    const btn = el.querySelector('button')!;
    expect(document.activeElement).toBe(btn);
    const modal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    const d = dlg(el);
    el.setAttribute('mode', 'sheet');
    expect(modes).toEqual([{ mode: 'sheet' }]);
    expect(modal).toHaveBeenCalledTimes(1);
    expect(dlg(el)).toBe(d);
    expect(d.open).toBe(true);
    expect(d.dataset.mode).toBe('sheet');
    expect(d.dataset.state).toBe('open');
    expect(d.hasAttribute('data-instant')).toBe(false);
    expect(el.open).toBe(true);
    expect(document.activeElement).toBe(btn);
    el.setAttribute('mode', 'dock');
    expect(modes).toEqual([{ mode: 'sheet' }, { mode: 'dock' }]);
    expect(el.docked).toBe(true);
    el.setAttribute('mode', 'auto'); // still dock at 1024px: no change, no event
    expect(modes).toHaveLength(2);
  });

  it('auto mode follows the dock-at breakpoint while connected', () => {
    const media = fakeMedia(true);
    const el = mount({ heading: 'Detail' });
    const modes = events<{ mode: string }>(el, 'ui-mode-change');
    expect(el.docked).toBe(true);
    media.set(false);
    expect(modes).toEqual([{ mode: 'sheet' }]);
    expect(dlg(el).dataset.mode).toBe('sheet');
    el.show();
    media.set(true);
    expect(modes).toEqual([{ mode: 'sheet' }, { mode: 'dock' }]);
    expect(dlg(el).open).toBe(true);
    expect(dlg(el).dataset.mode).toBe('dock');
    el.remove();
    expect(media.listeners.size).toBe(0);
  });

  it('dock-at moves the breakpoint', () => {
    const el = mount({ heading: 'Detail', 'dock-at': '1200' });
    expect(el.docked).toBe(false);
    el.setAttribute('dock-at', '900');
    expect(el.docked).toBe(true);
  });

  it('side="left" lands on the dialog', () => {
    const el = mount({ side: 'left' });
    expect(dlg(el).dataset.side).toBe('left');
    expect(mount().shadowRoot!.querySelector<HTMLElement>('dialog')!.dataset.side).toBe('right');
  });

  it('width, min-width and max-width clamp the panel', () => {
    const el = mount();
    expect(el.width).toBe(480);
    expect(q(el, '.dr-panel')!.style.getPropertyValue('--dr-w').trim()).toBe('480px');
    el.setAttribute('width', '2000');
    el.renderNow();
    expect(el.width).toBe(960);
    el.setAttribute('max-width', '700');
    expect(el.width).toBe(700);
    el.width = 100;
    expect(el.getAttribute('width')).toBe('100');
    expect(el.width).toBe(320);
    el.setAttribute('min-width', '360');
    el.renderNow();
    expect(el.width).toBe(360);
    expect(q(el, '.dr-panel')!.style.getPropertyValue('--dr-w').trim()).toBe('360px');
  });

  it('resizable draws a focusable separator with its value range', () => {
    expect(q(mount(), '.dr-handle')).toBeNull();
    const el = mount({ resizable: '', width: '500' });
    const h = q(el, '.dr-handle')!;
    expect(h.getAttribute('role')).toBe('separator');
    expect(h.getAttribute('aria-orientation')).toBe('vertical');
    expect(h.getAttribute('aria-label')).toBe('Resize panel');
    expect(h.getAttribute('aria-valuenow')).toBe('500');
    expect(h.getAttribute('aria-valuemin')).toBe('320');
    expect(h.getAttribute('aria-valuemax')).toBe('960');
    expect(h.getAttribute('tabindex')).toBe('0');
  });

  it('handle keys: ← widens a right drawer by 16 (Shift 64), → narrows, Home / End — each sends ui-resize', () => {
    const el = mount({ resizable: '' });
    const sizes = events<{ width: number }>(el, 'ui-resize');
    const h = () => q(el, '.dr-handle')!;
    expect(key(h(), 'ArrowLeft').defaultPrevented).toBe(true);
    expect(el.width).toBe(496);
    key(h(), 'ArrowLeft', { shiftKey: true });
    expect(el.width).toBe(560);
    key(h(), 'ArrowRight');
    expect(el.width).toBe(544);
    expect(h().getAttribute('aria-valuenow')).toBe('544');
    key(h(), 'Home');
    expect(el.width).toBe(320);
    key(h(), 'Home'); // already there: nothing to report
    key(h(), 'End');
    expect(el.width).toBe(960);
    expect(sizes.map((s) => s.width)).toEqual([496, 560, 544, 320, 960]);
    expect(el.getAttribute('width')).toBe('960');
  });

  it('a left drawer widens with →', () => {
    const el = mount({ resizable: '', side: 'left' });
    key(q(el, '.dr-handle')!, 'ArrowRight');
    expect(el.width).toBe(496);
    key(q(el, '.dr-handle')!, 'ArrowLeft', { shiftKey: true });
    expect(el.width).toBe(432);
  });

  it('a pointer drag resizes live with transitions off and reports once at the end', () => {
    const el = mount({ resizable: '' });
    el.show();
    const sizes = events<{ width: number }>(el, 'ui-resize');
    const h = q(el, '.dr-handle')!;
    ptr(h, 'pointerdown', 544);
    expect(dlg(el).hasAttribute('data-resizing')).toBe(true);
    ptr(h, 'pointermove', 500);
    ptr(h, 'pointermove', 424);
    expect(q(el, '.dr-panel')!.style.getPropertyValue('--dr-w').trim()).toBe('600px');
    expect(h.getAttribute('aria-valuenow')).toBe('600');
    expect(sizes).toEqual([]);
    ptr(h, 'pointermove', -1000); // clamped to max
    ptr(h, 'pointerup', -1000);
    expect(sizes).toEqual([{ width: 960 }]);
    expect(el.width).toBe(960);
    expect(dlg(el).hasAttribute('data-resizing')).toBe(false);
    ptr(h, 'pointermove', 0); // after the drag: nothing
    expect(el.width).toBe(960);
  });

  it('close button, Escape and the scrim ask with their reasons; preventDefault keeps it open', () => {
    const el = mount({ heading: 'Runs', mode: 'sheet' });
    const seen: string[] = [];
    let keep = true;
    el.addEventListener('ui-close', (e) => {
      seen.push((e as CustomEvent).detail.reason);
      if (keep) e.preventDefault();
    });
    el.show();
    q(el, '.dr-close')!.click();
    key(q(el, '.dr-panel')!, 'Escape');
    ptr(q(el, '.dr-scrim')!, 'pointerdown');
    click(q(el, '.dr-scrim')!);
    expect(seen).toEqual(['close-button', 'escape', 'scrim']);
    expect(el.open).toBe(true);
    keep = false;
    ptr(q(el, '.dr-scrim')!, 'pointerdown');
    click(q(el, '.dr-scrim')!);
    expect(el.open).toBe(false);
    vi.advanceTimersByTime(DRAWER_EXIT_MS);
    expect(dlg(el).open).toBe(false);
  });

  it('a drag that ends on the scrim, or a cancel event, are handled like the dialog', () => {
    const el = mount({ heading: 'Runs', mode: 'sheet' });
    const seen = events<{ reason: string }>(el, 'ui-close');
    el.show();
    ptr(q(el, '.dr-body')!, 'pointerdown');
    click(q(el, '.dr-scrim')!);
    expect(seen).toEqual([]);
    const c = new Event('cancel', { cancelable: true });
    dlg(el).dispatchEvent(c);
    expect(c.defaultPrevented).toBe(true);
    expect(seen).toEqual([{ reason: 'escape' }]);
  });

  it('docked, Escape only counts while focus is in the drawer', () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    const el = mount({ heading: 'Detail' }, '<input>');
    const seen = events<{ reason: string }>(el, 'ui-close');
    el.show();
    outside.focus();
    key(el, 'Escape');
    key(document.body, 'Escape');
    dlg(el).dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(seen).toEqual([]);
    expect(el.open).toBe(true);
    const input = el.querySelector('input')!;
    input.focus();
    key(input, 'Escape');
    expect(seen).toEqual([{ reason: 'escape' }]);
  });

  it('hide() slides out on the drawer curve, then closes — no event', () => {
    const el = mount({ heading: 'Detail' });
    const seen = events(el, 'ui-close');
    el.show();
    el.hide();
    expect(dlg(el).dataset.state).toBe('closing');
    expect(el.hasAttribute('open')).toBe(false);
    vi.advanceTimersByTime(DRAWER_EXIT_MS - 1);
    expect(dlg(el).open).toBe(true);
    vi.advanceTimersByTime(1);
    expect(dlg(el).open).toBe(false);
    expect(seen).toEqual([]);
  });

  it('toggle() and the open property / attribute open and close it', () => {
    const el = mount();
    el.toggle();
    expect(el.open).toBe(true);
    el.toggle();
    expect(el.open).toBe(false);
    vi.advanceTimersByTime(DRAWER_EXIT_MS);
    el.open = true;
    expect(el.hasAttribute('open')).toBe(true);
    el.removeAttribute('open');
    expect(el.open).toBe(false);
    expect(dlg(el).dataset.state).toBe('closing');
  });

  it('opening again mid-exit cancels the close (the slide turns around)', () => {
    const el = mount({ heading: 'Detail' });
    el.show();
    el.hide();
    vi.advanceTimersByTime(DRAWER_EXIT_MS / 2);
    el.show();
    vi.advanceTimersByTime(1000);
    expect(dlg(el).open).toBe(true);
    expect(dlg(el).dataset.state).toBe('open');
  });

  it('focuses [autofocus] (else the panel) and returns focus to the opener', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    const el = mount({ heading: 'Detail', mode: 'sheet' }, '<input autofocus>');
    opener.focus();
    el.show();
    expect(document.activeElement).toBe(el.querySelector('input'));
    el.hide();
    vi.advanceTimersByTime(DRAWER_EXIT_MS);
    expect(document.activeElement).toBe(opener);
    const el2 = mount({ heading: 'Plain' });
    el2.show();
    expect(el2.shadowRoot!.activeElement).toBe(q(el2, '.dr-panel'));
  });

  it('docked: a close leaves focus where the person moved it in the page', () => {
    const opener = document.createElement('button');
    const board = document.createElement('button');
    document.body.append(opener, board);
    const el = mount({ heading: 'Detail' });
    opener.focus();
    el.show();
    board.focus();
    el.hide();
    vi.advanceTimersByTime(DRAWER_EXIT_MS);
    expect(document.activeElement).toBe(board);
  });

  it('labels by heading or label (escaped); footer hidden until slotted', () => {
    const el = mount({ heading: '<b>T-1842</b>' });
    expect(dlg(el).getAttribute('aria-labelledby')).toBe('dr-title');
    expect(q(el, '#dr-title')?.textContent).toBe('<b>T-1842</b>');
    expect(q(el, 'b')).toBeNull();
    expect(q(el, '.dr-foot')?.hasAttribute('hidden')).toBe(true);
    const el2 = mount({ label: 'Navigation', 'hide-close': '' }, '<nav>x</nav><button slot="footer">Go</button>');
    expect(dlg(el2).getAttribute('aria-label')).toBe('Navigation');
    expect(q(el2, '.dr-close')).toBeNull();
    expect(q(el2, '.dr-head')?.hasAttribute('hidden')).toBe(true);
    expect(q(el2, '.dr-foot')?.hasAttribute('hidden')).toBe(false);
  });

  it('speaks Korean with lang="ko"', () => {
    const el = mount({ lang: 'ko', heading: '세션 상세', resizable: '' });
    expect(q(el, '.dr-close')?.getAttribute('aria-label')).toBe('닫기');
    expect(q(el, '.dr-handle')?.getAttribute('aria-label')).toBe('패널 크기 조절');
  });

  it('under reduced motion the exit is a 120ms fade', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }));
    const el = mount({ heading: 'Detail' });
    el.show();
    el.hide();
    vi.advanceTimersByTime(119);
    expect(dlg(el).open).toBe(true);
    vi.advanceTimersByTime(1);
    expect(dlg(el).open).toBe(false);
  });

  it('keeps its nodes across re-renders while open', () => {
    const el = mount({ heading: 'One', resizable: '' });
    el.show();
    const d = dlg(el);
    const panel = q(el, '.dr-panel');
    el.setAttribute('heading', 'Two');
    el.setAttribute('width', '600');
    el.renderNow();
    expect(dlg(el)).toBe(d);
    expect(q(el, '.dr-panel')).toBe(panel);
    expect(d.open).toBe(true);
    expect(q(el, '#dr-title')?.textContent).toBe('Two');
  });

  it('styles: translateX(100%) on the drawer curve both ways, scrim 180ms, reduced motion, tokens only', () => {
    expect(styles).toMatch(
      /\.dr-panel \{[^}]*transform: translateX\(100%\);\s*transition: transform var\(--dur-move\) var\(--ease-drawer\);/,
    );
    expect(styles).toContain('.dr[data-side="left"] .dr-panel { right: auto; left: 0; transform: translateX(-100%); }');
    expect(styles).toContain('.dr[data-state="open"] .dr-panel { transform: none; }');
    // No separate exit transition: the way out is the way in.
    expect(styles.match(/transition: transform var\(--dur-move\)/g)).toHaveLength(1);
    expect(styles).toMatch(/\.dr-scrim \{[^}]*background: var\(--scrim\)[^}]*transition: opacity var\(--dur-fade\)/);
    expect(styles).toContain('top: var(--ui-drawer-top, 0px)');
    expect(styles).toContain('.dr[data-resizing] .dr-panel { transition: none; }');
    expect(styles).toMatch(
      /prefers-reduced-motion: reduce\) \{[\s\S]*transform: none !important;[\s\S]*\.dr-scrim, \.dr-panel \{ transition: opacity 120ms ease !important; \}/,
    );
    expect(styles).toMatch(/@media \(hover: hover\) and \(pointer: fine\) \{\s*\.dr-close:hover/);
    expect(styles).toMatch(
      /@media \(pointer: coarse\), \(max-width: 639px\) \{\s*\.dr-close \{ width: 44px; height: 44px;/,
    );
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});

describe('ui-drawer — accessible name from a slotted header', () => {
  it('a slotted header names the drawer (aria-labelledby), not the label', () => {
    const el = mount({ label: 'fallback' }, '<h3 slot="header">Session detail</h3><p>Body</p>');
    el.renderNow();
    expect(dlg(el).getAttribute('aria-labelledby')).toBe('dr-title');
    expect(dlg(el).hasAttribute('aria-label')).toBe(false);
  });
});

describe('ui-drawer — notifications', () => {
  it('ui-resize reports a width that already changed: not cancelable', () => {
    const el = mount({ resizable: '', mode: 'dock' });
    const seen: boolean[] = [];
    el.addEventListener('ui-resize', (e) => seen.push(e.cancelable));
    el.show();
    el.renderNow();
    const h = q(el, '[role="separator"]');
    if (h) key(h, 'ArrowLeft');
    expect(seen.every((c) => c === false)).toBe(true);
  });
  it('follows the visual viewport while open, in sheet and dock (G8-1)', () => {
    const media = fakeMedia(false);
    const vv = Object.assign(new EventTarget(), { height: 760, offsetTop: 0 });
    vi.stubGlobal('visualViewport', vv);
    const el = mount({ heading: 'Session' });
    expect(dlg(el).style.getPropertyValue('--ui-vv-h')).toBe('');
    el.show();
    expect(dlg(el).dataset.mode).toBe('sheet');
    expect(dlg(el).style.getPropertyValue('--ui-vv-h')).toBe('760px');
    vv.height = 388;
    vv.offsetTop = 210;
    vv.dispatchEvent(new Event('resize'));
    expect(dlg(el).style.getPropertyValue('--ui-vv-h')).toBe('388px');
    expect(dlg(el).style.getPropertyValue('--ui-vv-top')).toBe('210px');
    // Crossing into dock keeps following (the dock's top is --ui-drawer-top below the visible top).
    media.set(true);
    expect(dlg(el).dataset.mode).toBe('dock');
    expect(dlg(el).style.getPropertyValue('--ui-vv-top')).toBe('210px');
    el.hide();
    vi.advanceTimersByTime(DRAWER_EXIT_MS);
    expect(dlg(el).style.getPropertyValue('--ui-vv-h')).toBe('');
    expect(dlg(el).hasAttribute('style')).toBe(false);
  });

  it('viewport="layout" opts out of the visual viewport', () => {
    fakeMedia(false);
    vi.stubGlobal('visualViewport', Object.assign(new EventTarget(), { height: 400, offsetTop: 90 }));
    const el = mount({ heading: 'Session', viewport: 'layout' });
    el.show();
    expect(dlg(el).style.getPropertyValue('--ui-vv-h')).toBe('');
    el.removeAttribute('viewport');
    expect(dlg(el).style.getPropertyValue('--ui-vv-top')).toBe('90px');
    expect(styles).toContain('inset: var(--ui-vv-top, 0px) 0 auto;');
    expect(styles).toContain('height: var(--ui-vv-h, 100%);');
  });
});
