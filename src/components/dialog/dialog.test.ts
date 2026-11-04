import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import { DIALOG_EXIT_MS, dialogSize, type UiDialog } from './dialog';
import { styles } from './styles';

function mount(attrs: Record<string, string> = {}, html = '<p>Body</p>'): UiDialog {
  const el = document.createElement('ui-dialog') as UiDialog;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.innerHTML = html;
  document.body.append(el);
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiDialog, s: string) => el.shadowRoot!.querySelector<E>(s);
const dlg = (el: UiDialog) => q<HTMLDialogElement>(el, 'dialog')!;
const key = (t: EventTarget, k: string, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init });
  t.dispatchEvent(e);
  return e;
};
const pointer = (t: EventTarget) =>
  t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, cancelable: true }));
const click = (t: EventTarget) =>
  t.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
function closes(el: UiDialog): Array<string> {
  const seen: string[] = [];
  el.addEventListener('ui-close', (e) => seen.push((e as CustomEvent).detail.reason));
  return seen;
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
  it('dialogSize keeps the five sizes and falls back to md', () => {
    expect(['sm', 'md', 'lg', 'xl', 'full'].map(dialogSize)).toEqual(['sm', 'md', 'lg', 'xl', 'full']);
    expect(dialogSize(null)).toBe('md');
    expect(dialogSize('huge')).toBe('md');
  });
});

describe('<ui-dialog>', () => {
  it('is closed by default', () => {
    const el = mount({ heading: 'Hi' });
    expect(dlg(el).open).toBe(false);
    expect(dlg(el).dataset.state).toBe('closed');
    expect(el.open).toBe(false);
    expect(el.hasAttribute('open')).toBe(false);
  });

  it('show() opens modally, reflects open and sends no event', () => {
    const el = mount({ heading: 'Hi' });
    const seen = closes(el);
    const modal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    el.show();
    expect(modal).toHaveBeenCalledTimes(1);
    expect(dlg(el).open).toBe(true);
    expect(dlg(el).dataset.state).toBe('open');
    expect(el.hasAttribute('open')).toBe(true);
    expect(el.open).toBe(true);
    expect(seen).toEqual([]);
  });

  it('hide() plays the exit, then closes — no event', () => {
    const el = mount({ heading: 'Hi' });
    const seen = closes(el);
    el.show();
    el.hide();
    expect(dlg(el).dataset.state).toBe('closing');
    expect(dlg(el).open).toBe(true);
    expect(el.hasAttribute('open')).toBe(false);
    expect(el.open).toBe(false);
    vi.advanceTimersByTime(DIALOG_EXIT_MS - 1);
    expect(dlg(el).open).toBe(true);
    vi.advanceTimersByTime(1);
    expect(dlg(el).open).toBe(false);
    expect(dlg(el).dataset.state).toBe('closed');
    expect(seen).toEqual([]);
  });

  it('D4 G6-2: ui-closed follows every exit with its reason — hide, escape, close-button — not a cancelled or turned-around close', () => {
    const el = mount({ heading: 'Hi' });
    const closed: string[] = [];
    el.addEventListener('ui-closed', (e) => closed.push((e as CustomEvent).detail.reason));
    el.show();
    el.hide();
    vi.advanceTimersByTime(DIALOG_EXIT_MS - 1);
    expect(closed).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(closed).toEqual(['hide']);
    el.show();
    key(dlg(el), 'Escape');
    vi.advanceTimersByTime(DIALOG_EXIT_MS);
    expect(closed).toEqual(['hide', 'escape']);
    el.show();
    click(q(el, '.dg-close')!);
    vi.advanceTimersByTime(DIALOG_EXIT_MS);
    expect(closed).toEqual(['hide', 'escape', 'close-button']);
    // Cancelled: nothing closes, nothing follows.
    el.show();
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('ui-close', stop);
    key(dlg(el), 'Escape');
    vi.advanceTimersByTime(DIALOG_EXIT_MS);
    expect(dlg(el).open).toBe(true);
    expect(closed).toHaveLength(3);
    el.removeEventListener('ui-close', stop);
    // Turned around mid-exit: still open, no ui-closed.
    el.hide();
    vi.advanceTimersByTime(DIALOG_EXIT_MS / 2);
    el.show();
    vi.advanceTimersByTime(DIALOG_EXIT_MS);
    expect(dlg(el).open).toBe(true);
    expect(closed).toHaveLength(3);
    // The open attribute going is the host's: hide.
    el.removeAttribute('open');
    vi.advanceTimersByTime(DIALOG_EXIT_MS);
    expect(closed).toEqual(['hide', 'escape', 'close-button', 'hide']);
  });

  it('D4 G6-1: size-phone is the size under 640px, followed live; size elsewhere; nothing without matchMedia', () => {
    let matches = false;
    const listeners = new Set<() => void>();
    const mql = {
      get matches() {
        return matches;
      },
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    };
    const mm = vi.fn(() => mql as unknown as MediaQueryList);
    vi.stubGlobal('matchMedia', mm);
    const el = mount({ size: 'lg', 'size-phone': 'full' });
    expect(mm).toHaveBeenCalledWith('(max-width: 639px)');
    expect(dlg(el).dataset.size).toBe('lg');
    matches = true;
    for (const fn of listeners) fn();
    el.renderNow();
    expect(dlg(el).dataset.size).toBe('full');
    el.setAttribute('size-phone', 'sm');
    el.renderNow();
    expect(dlg(el).dataset.size).toBe('sm');
    el.removeAttribute('size-phone');
    el.renderNow();
    expect(dlg(el).dataset.size).toBe('lg');
    expect(listeners.size).toBe(0);
    el.setAttribute('size-phone', 'full');
    expect(listeners.size).toBe(1);
    el.remove();
    expect(listeners.size).toBe(0);
    document.body.append(el);
    expect(listeners.size).toBe(1);
    expect(dlg(el).dataset.size).toBe('full');
    vi.stubGlobal('matchMedia', undefined);
    const plain = mount({ size: 'md', 'size-phone': 'full' });
    expect(dlg(plain).dataset.size).toBe('md');
  });

  it('the open attribute and property open and close it', () => {
    const el = mount();
    el.setAttribute('open', '');
    expect(dlg(el).open).toBe(true);
    el.removeAttribute('open');
    expect(dlg(el).dataset.state).toBe('closing');
    vi.advanceTimersByTime(DIALOG_EXIT_MS);
    expect(dlg(el).open).toBe(false);
    el.open = true;
    expect(el.hasAttribute('open')).toBe(true);
    expect(dlg(el).open).toBe(true);
  });

  it('opens on connect when open was set before it was in the document', () => {
    const el = document.createElement('ui-dialog') as UiDialog;
    el.setAttribute('open', '');
    expect(el.open).toBe(true);
    document.body.append(el);
    expect(dlg(el).open).toBe(true);
    expect(dlg(el).dataset.state).toBe('open');
  });

  it('a slotted header names the dialog (aria-labelledby), not the label', () => {
    const el = mount({ label: 'fallback' }, '<h3 slot="header">Session detail</h3><p>Body</p>');
    el.renderNow();
    expect(dlg(el).getAttribute('aria-labelledby')).toBe('dg-title');
    expect(dlg(el).hasAttribute('aria-label')).toBe(false);
  });

  it('labels the dialog by its heading, else by label — both escaped', () => {
    const el = mount({ heading: '<img src=x onerror=alert(1)>', label: 'ignored' });
    expect(dlg(el).getAttribute('aria-labelledby')).toBe('dg-title');
    expect(dlg(el).hasAttribute('aria-label')).toBe(false);
    expect(q(el, '#dg-title')?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(q(el, 'img')).toBeNull();
    const el2 = mount({ label: '"><b>x</b>' });
    expect(dlg(el2).getAttribute('aria-label')).toBe('"><b>x</b>');
    expect(dlg(el2).hasAttribute('aria-labelledby')).toBe(false);
    expect(q(el2, 'b')).toBeNull();
    expect(q(el2, '.dg-title')?.hasAttribute('hidden')).toBe(true);
  });

  it('the close button asks with reason close-button, then closes', () => {
    const el = mount({ heading: 'Hi' });
    const seen = closes(el);
    el.show();
    const b = q(el, '.dg-close')!;
    expect(b.getAttribute('aria-label')).toBe('Close');
    expect(b.querySelector('svg[data-icon="close"]')).not.toBeNull();
    b.click();
    expect(seen).toEqual(['close-button']);
    expect(el.open).toBe(false);
    vi.advanceTimersByTime(DIALOG_EXIT_MS);
    expect(dlg(el).open).toBe(false);
  });

  it('Escape asks with reason escape and takes the key from the native cancel', () => {
    const el = mount({ heading: 'Hi' });
    const seen = closes(el);
    el.show();
    const e = key(q(el, '.dg-panel')!, 'Escape');
    expect(e.defaultPrevented).toBe(true);
    expect(seen).toEqual(['escape']);
    expect(dlg(el).dataset.state).toBe('closing');
  });

  it('the native cancel event is prevented and asks with reason escape', () => {
    const el = mount({ heading: 'Hi' });
    const seen = closes(el);
    el.show();
    const c = new Event('cancel', { cancelable: true });
    dlg(el).dispatchEvent(c);
    expect(c.defaultPrevented).toBe(true);
    expect(seen).toEqual(['escape']);
    expect(el.open).toBe(false);
  });

  it('one Escape press is handled once (keydown, then a cancel from the same press)', () => {
    const el = mount({ heading: 'Hi' });
    const seen: string[] = [];
    el.addEventListener('ui-close', (e) => {
      seen.push((e as CustomEvent).detail.reason);
      e.preventDefault();
    });
    el.show();
    key(q(el, '.dg-panel')!, 'Escape');
    const c = new Event('cancel', { cancelable: true });
    dlg(el).dispatchEvent(c);
    expect(c.defaultPrevented).toBe(true);
    expect(seen).toEqual(['escape']);
    vi.advanceTimersByTime(1);
    key(q(el, '.dg-panel')!, 'Escape');
    expect(seen).toEqual(['escape', 'escape']);
  });

  it('Escape that a control inside used, or that ends an IME composition, is left alone', () => {
    const el = mount({ heading: 'Hi' }, '<input>');
    const seen = closes(el);
    el.show();
    const input = el.querySelector('input')!;
    input.addEventListener('keydown', (e) => e.preventDefault(), { once: true });
    key(input, 'Escape');
    key(input, 'Escape', { isComposing: true });
    expect(seen).toEqual([]);
    expect(el.open).toBe(true);
  });

  it('pointerdown and click on the scrim ask with reason scrim', () => {
    const el = mount({ heading: 'Hi' });
    const seen = closes(el);
    el.show();
    const scrim = q(el, '.dg-scrim')!;
    pointer(scrim);
    click(scrim);
    expect(seen).toEqual(['scrim']);
    expect(el.open).toBe(false);
  });

  it('a drag that started in the panel and ended on the scrim does not close', () => {
    const el = mount({ heading: 'Hi' });
    const seen = closes(el);
    el.show();
    pointer(q(el, '.dg-body')!);
    click(q(el, '.dg-scrim')!);
    click(q(el, '.dg-scrim')!); // no pointerdown at all (synthetic click) either
    expect(seen).toEqual([]);
    expect(el.open).toBe(true);
  });

  it('preventDefault() on ui-close keeps it open, whatever the reason', () => {
    const el = mount({ heading: 'Hi' });
    const seen: string[] = [];
    el.addEventListener('ui-close', (e) => {
      seen.push((e as CustomEvent).detail.reason);
      e.preventDefault();
    });
    el.show();
    q(el, '.dg-close')!.click();
    key(q(el, '.dg-panel')!, 'Escape');
    pointer(q(el, '.dg-scrim')!);
    click(q(el, '.dg-scrim')!);
    vi.advanceTimersByTime(1000);
    expect(seen).toEqual(['close-button', 'escape', 'scrim']);
    expect(dlg(el).open).toBe(true);
    expect(dlg(el).dataset.state).toBe('open');
    expect(el.hasAttribute('open')).toBe(true);
  });

  it('opening again during the exit cancels the close and turns the motion around', () => {
    const el = mount({ heading: 'Hi' });
    el.show();
    const panel = q(el, '.dg-panel');
    el.hide();
    vi.advanceTimersByTime(DIALOG_EXIT_MS / 2);
    el.show();
    expect(dlg(el).dataset.state).toBe('open');
    vi.advanceTimersByTime(1000);
    expect(dlg(el).open).toBe(true);
    expect(dlg(el).dataset.state).toBe('open');
    expect(q(el, '.dg-panel')).toBe(panel);
  });

  it('focuses the first [autofocus] element on open, else the panel', () => {
    const el = mount({ heading: 'New task' }, '<input id="a"><textarea autofocus></textarea>');
    el.show();
    expect(document.activeElement).toBe(el.querySelector('textarea'));
    const el2 = mount({ heading: 'Plain' });
    el2.show();
    expect(el2.shadowRoot!.activeElement).toBe(q(el2, '.dg-panel'));
    expect(q(el2, '.dg-panel')?.getAttribute('tabindex')).toBe('-1');
  });

  it('returns focus to the opener after the close completes', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    const el = mount({ heading: 'Hi' }, '<button autofocus>OK</button>');
    opener.focus();
    el.show();
    expect(document.activeElement).toBe(el.querySelector('button'));
    key(el.querySelector('button')!, 'Escape');
    vi.advanceTimersByTime(DIALOG_EXIT_MS);
    expect(document.activeElement).toBe(opener);
  });

  it('a native close (by other means) settles the state at once', () => {
    const el = mount({ heading: 'Hi' });
    const seen = closes(el);
    el.show();
    dlg(el).close();
    expect(dlg(el).dataset.state).toBe('closed');
    expect(el.open).toBe(false);
    expect(el.hasAttribute('open')).toBe(false);
    expect(seen).toEqual([]);
    el.show();
    expect(dlg(el).open).toBe(true);
  });

  it('hides the footer row until something is slotted into it', () => {
    const el = mount({ heading: 'Hi' });
    expect(q(el, '.dg-foot')?.hasAttribute('hidden')).toBe(true);
    const b = document.createElement('button');
    b.slot = 'footer';
    b.textContent = 'OK';
    el.append(b);
    q(el, 'slot[name="footer"]')!.dispatchEvent(new Event('slotchange', { bubbles: true }));
    expect(q(el, '.dg-foot')?.hasAttribute('hidden')).toBe(false);
    const el2 = mount({ heading: 'Hi' }, '<p>x</p><button slot="footer">Go</button>');
    expect(q(el2, '.dg-foot')?.hasAttribute('hidden')).toBe(false);
  });

  it('a header slot shows the title row without a heading', () => {
    const el = mount({ label: 'Artifact', 'hide-close': '' }, '<span slot="header">plan.md</span><p>x</p>');
    expect(q(el, '.dg-head')?.hasAttribute('hidden')).toBe(false);
    expect(q(el, '.dg-title')?.hasAttribute('hidden')).toBe(false);
    // The visible slotted title names it (0.5.0 review P2); the label is only for an untitled dialog.
    expect(dlg(el).getAttribute('aria-labelledby')).toBe('dg-title');
    expect(dlg(el).hasAttribute('aria-label')).toBe(false);
  });

  it('hide-close drops the button; with no title either the header row goes', () => {
    const el = mount({ heading: 'Hi', 'hide-close': '' });
    expect(q(el, '.dg-close')).toBeNull();
    expect(q(el, '.dg-head')?.hasAttribute('hidden')).toBe(false);
    const el2 = mount({ label: 'Quiet', 'hide-close': '' });
    expect(q(el2, '.dg-head')?.hasAttribute('hidden')).toBe(true);
  });

  it('slot="actions" sits beside the close button, outside the heading (G7-2)', () => {
    const el = mount(
      { heading: 'report.html' },
      '<p>Body</p><a slot="actions" href="#n">Open</a><button slot="actions">Download</button>',
    );
    el.renderNow();
    const actions = q(el, '.dg-actions')!;
    expect(actions.hidden).toBe(false);
    expect(actions.getAttribute('part')).toBe('actions');
    expect(actions.querySelector('slot')?.getAttribute('name')).toBe('actions');
    expect(q(el, '.dg-title')!.contains(actions)).toBe(false);
    expect(actions.nextElementSibling?.classList.contains('dg-close')).toBe(true);
    expect(actions.parentElement?.classList.contains('dg-head')).toBe(true);
    // Without slotted actions the box stays out.
    expect(q(mount({ heading: 'x' }), '.dg-actions')?.hidden).toBe(true);
  });

  it('actions alone keep the header row (no heading, no close button)', () => {
    const el = mount({ 'hide-close': '', label: 'Viewer' }, '<p>Body</p><button slot="actions">Next</button>');
    el.renderNow();
    expect(q(el, '.dg-head')?.hidden).toBe(false);
    expect(q(el, '.dg-title')?.hidden).toBe(true);
    expect(dlg(el).getAttribute('aria-label')).toBe('Viewer');
    el.querySelector('[slot="actions"]')!.remove();
    el.renderNow();
    expect(q(el, '.dg-head')?.hidden).toBe(true);
    expect(styles).toContain('.dg-actions:not([hidden]) + .dg-close { margin-left: 0; }');
    // On a phone the toolbar wraps under the title and ×, end-aligned.
    const phone = styles.slice(styles.lastIndexOf('@media (max-width: 639px)'));
    expect(phone).toContain('.dg-head:has(> .dg-actions:not([hidden])) { flex-wrap: wrap; row-gap: 4px; }');
    expect(phone).toContain('.dg-actions { order: 1; flex-basis: 100%; justify-content: flex-end; }');
  });

  describe('the box never stays scrolled, so the phone sheet slides up instead of appearing in place', () => {
    // showModal() runs the native focusing steps while the phone sheet is still translateY(100%) below the box, and a
    // focus() without preventScroll does the same. Chromium scrolls the box (overflow: hidden is a scroll container) to
    // show it; the shrinking transform then clamps that scroll with it, so the sheet stayed pinned at its open place.
    // Here the browser's scroll is played by hand.
    const transitionEnd = (t: EventTarget, propertyName: string) =>
      t.dispatchEvent(Object.assign(new Event('transitionend', { bubbles: true }), { propertyName }));

    it('the box is back at 0 when show() returns', () => {
      const native = HTMLDialogElement.prototype.showModal;
      vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) {
        native.call(this);
        this.scrollTop = 520;
        this.scrollLeft = 30;
      });
      const el = mount();
      el.show();
      expect([dlg(el).scrollTop, dlg(el).scrollLeft]).toEqual([0, 0]);
    });

    it('an [autofocus] field focused on the way in does not scroll the box either', () => {
      const el = mount({}, '<input autofocus>');
      const box = dlg(el);
      vi.spyOn(HTMLInputElement.prototype, 'focus').mockImplementation(() => {
        box.scrollTop = 300;
      });
      el.show();
      expect(box.scrollTop).toBe(0);
    });

    it('a later scroll of the box while the panel enters goes back at once; the body keeps its own', () => {
      const el = mount();
      el.show();
      const box = dlg(el);
      box.scrollTop = 200;
      box.dispatchEvent(new Event('scroll'));
      expect(box.scrollTop).toBe(0);
      const body = q(el, '.dg-body')!;
      body.scrollTop = 40;
      body.dispatchEvent(new Event('scroll'));
      expect(body.scrollTop).toBe(40);
    });

    it('once the panel is in, a vertical scroll of the box stays (a control below a short visible area); sideways never', () => {
      const el = mount();
      el.show();
      const box = dlg(el);
      transitionEnd(q(el, '.dg-panel')!, 'opacity'); // not the move: still entering
      box.scrollTop = 30;
      box.dispatchEvent(new Event('scroll'));
      expect(box.scrollTop).toBe(0);
      transitionEnd(q(el, '.dg-panel')!, 'transform');
      box.scrollTop = 55;
      box.scrollLeft = 20;
      box.dispatchEvent(new Event('scroll'));
      expect([box.scrollTop, box.scrollLeft]).toEqual([55, 0]);
    });

    it('without a transitionend (reduced motion, a missed event) the way in ends after a second', () => {
      const now = vi.spyOn(performance, 'now').mockReturnValue(10_000);
      const el = mount();
      el.show();
      const box = dlg(el);
      now.mockReturnValue(10_999);
      box.scrollTop = 40;
      box.dispatchEvent(new Event('scroll'));
      expect(box.scrollTop).toBe(0);
      now.mockReturnValue(11_001);
      box.scrollTop = 40;
      box.dispatchEvent(new Event('scroll'));
      expect(box.scrollTop).toBe(40);
    });

    it('the box stays a scroll container: overscroll-behavior on it fences the page behind (scrim, head)', () => {
      expect(styles).toMatch(/\.dg \{[^}]*overflow: hidden;[^}]*overscroll-behavior: contain;/);
      expect(styles).not.toContain('overflow: clip');
    });
  });

  it('size="full" goes edge to edge on phones: no rounding, no grab, safe areas inside (G7-2)', () => {
    const phone = styles.slice(styles.lastIndexOf('@media (max-width: 639px)'));
    expect(phone).toContain('.dg[data-size="full"] { place-items: stretch; }');
    expect(phone).toMatch(
      /\.dg\[data-size="full"\]\[data-sheet\] \.dg-panel \{\s*width: 100%; height: 100%; max-height: none; border-radius: 0;/,
    );
    expect(phone).toContain('env(safe-area-inset-top) env(safe-area-inset-right)');
    expect(phone).toContain('.dg[data-size="full"][data-sheet] .dg-grab { display: none; }');
    // Desktop full is unchanged: the viewport less 16px each side.
    expect(styles).toContain(
      '.dg[data-size="full"] .dg-panel { width: calc(100% - 32px); height: calc(var(--ui-vv-h, 100dvh) - 32px); max-height: none; }',
    );
  });

  it('follows the visual viewport while open: --ui-vv-h / --ui-vv-top on the box (G7-1)', () => {
    const vv = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 });
    const add = vi.spyOn(vv, 'addEventListener');
    const remove = vi.spyOn(vv, 'removeEventListener');
    vi.stubGlobal('visualViewport', vv);
    const el = mount({ heading: 'New task' });
    // Closed: nothing listened to, nothing written.
    expect(add).not.toHaveBeenCalled();
    expect(dlg(el).style.getPropertyValue('--ui-vv-h')).toBe('');
    el.show();
    expect(dlg(el).style.getPropertyValue('--ui-vv-h')).toBe('800px');
    expect(dlg(el).style.getPropertyValue('--ui-vv-top')).toBe('0px');
    // The soft keyboard opens and iOS scrolls the page under it.
    vv.height = 412;
    vv.offsetTop = 196;
    vv.dispatchEvent(new Event('resize'));
    expect(dlg(el).style.getPropertyValue('--ui-vv-h')).toBe('412px');
    expect(dlg(el).style.getPropertyValue('--ui-vv-top')).toBe('196px');
    // A re-render keeps them (they are in the markup too).
    el.setAttribute('heading', 'New task · draft');
    el.renderNow();
    expect(dlg(el).style.getPropertyValue('--ui-vv-h')).toBe('412px');
    // Still followed on the way out; gone once closed.
    el.hide();
    vv.height = 800;
    vv.offsetTop = 0;
    vv.dispatchEvent(new Event('scroll'));
    expect(dlg(el).style.getPropertyValue('--ui-vv-h')).toBe('800px');
    vi.advanceTimersByTime(DIALOG_EXIT_MS);
    expect(dlg(el).open).toBe(false);
    expect(dlg(el).style.getPropertyValue('--ui-vv-h')).toBe('');
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('viewport="layout" opts out; switching it while open starts or stops the tracking', () => {
    const vv = Object.assign(new EventTarget(), { height: 500, offsetTop: 40 });
    vi.stubGlobal('visualViewport', vv);
    const el = mount({ heading: 'x', viewport: 'layout' });
    el.show();
    expect(dlg(el).style.getPropertyValue('--ui-vv-h')).toBe('');
    el.removeAttribute('viewport');
    expect(dlg(el).style.getPropertyValue('--ui-vv-h')).toBe('500px');
    el.setAttribute('viewport', 'layout');
    el.renderNow();
    expect(dlg(el).style.getPropertyValue('--ui-vv-h')).toBe('');
    expect(dlg(el).hasAttribute('style')).toBe(false);
    // Removed from the page: the listener goes with it.
    el.removeAttribute('viewport');
    const remove = vi.spyOn(vv, 'removeEventListener');
    el.remove();
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('without the API (or with layout) the styles fall back to the layout viewport', () => {
    const el = mount({ heading: 'x' });
    el.show();
    expect(dlg(el).hasAttribute('style')).toBe(false);
    expect(styles).toContain('inset: var(--ui-vv-top, 0px) 0 auto;');
    expect(styles).toContain('height: var(--ui-vv-h, 100%);');
    expect(styles).toContain('max-height: calc(var(--ui-vv-h, 100dvh) - 48px)');
    expect(styles).toContain('max-height: calc(var(--ui-vv-h, 100dvh) - 24px)');
    expect(styles).not.toMatch(/[^,(] 100dvh/);
  });

  it('size and sheet land on the dialog as CSS hooks', () => {
    const el = mount({ size: 'xl', sheet: 'never' });
    expect(dlg(el).dataset.size).toBe('xl');
    expect(dlg(el).dataset.sheet).toBe('never');
    el.setAttribute('size', 'nope');
    el.removeAttribute('sheet');
    el.renderNow();
    expect(dlg(el).dataset.size).toBe('md');
    expect(dlg(el).dataset.sheet).toBe('auto');
  });

  it('re-renders while open patch attributes in place (no rebuild, still open)', () => {
    const el = mount({ heading: 'One' });
    el.show();
    const d = dlg(el);
    el.setAttribute('heading', 'Two');
    el.setAttribute('size', 'lg');
    el.renderNow();
    expect(dlg(el)).toBe(d);
    expect(d.open).toBe(true);
    expect(d.dataset.state).toBe('open');
    expect(d.dataset.size).toBe('lg');
    expect(q(el, '#dg-title')?.textContent).toBe('Two');
  });

  it('speaks Korean with lang="ko"', () => {
    const el = mount({ lang: 'ko', heading: '세션 정책' });
    expect(q(el, '.dg-close')?.getAttribute('aria-label')).toBe('닫기');
    expect(q(el, '#dg-title')?.textContent).toBe('세션 정책');
  });

  it('under reduced motion the exit is a 120ms fade', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }));
    const el = mount({ heading: 'Hi' });
    el.show();
    el.hide();
    vi.advanceTimersByTime(119);
    expect(dlg(el).open).toBe(true);
    vi.advanceTimersByTime(1);
    expect(dlg(el).open).toBe(false);
  });

  it('the panel transitionend finishes the exit early', () => {
    const el = mount({ heading: 'Hi' });
    el.show();
    el.hide();
    vi.advanceTimersByTime(DIALOG_EXIT_MS - 20);
    q(el, '.dg-body')!.dispatchEvent(new Event('transitionend', { bubbles: true }));
    expect(dlg(el).open).toBe(true);
    q(el, '.dg-panel')!.dispatchEvent(new Event('transitionend', { bubbles: true }));
    expect(dlg(el).open).toBe(false);
  });

  it('closes the native dialog when removed, and reopens on re-insert', () => {
    const el = mount({ heading: 'Hi' });
    el.show();
    const d = dlg(el);
    el.remove();
    expect(d.open).toBe(false);
    document.body.append(el);
    expect(dlg(el).open).toBe(true);
    expect(dlg(el).dataset.state).toBe('open');
  });

  it('styles: rise in 240ms, settle out 180ms, scrim 180ms, the phone sheet, reduced motion, tokens only', () => {
    expect(styles).toContain('transform: translateY(8px) scale(0.97)');
    expect(styles).toContain(
      'transition: opacity var(--dur-expand) var(--ease-out), transform var(--dur-expand) var(--ease-out)',
    );
    expect(styles).toContain(
      'transition: opacity var(--dur-fade) var(--ease-out), transform var(--dur-fade) var(--ease-out)',
    );
    expect(styles).toMatch(/\.dg-scrim \{[^}]*background: var\(--scrim\)[^}]*transition: opacity var\(--dur-fade\)/);
    expect(styles).toContain('.dg::backdrop { background: transparent; }');
    expect(styles).toMatch(
      /@media \(max-width: 639px\) \{[\s\S]*\.dg\[data-sheet="auto"\] \.dg-panel \{[^}]*transform: translateY\(100%\)[^}]*var\(--ease-drawer\)/,
    );
    expect(styles).toContain('transform: none; transition: transform var(--dur-move) var(--ease-drawer)');
    expect(styles).toContain('padding-bottom: env(safe-area-inset-bottom)');
    expect(styles).toMatch(
      /prefers-reduced-motion: reduce\) \{[\s\S]*transform: none !important;[\s\S]*\.dg-scrim, \.dg-panel \{ transition: opacity 120ms ease !important; \}/,
    );
    expect(styles).toMatch(/@media \(hover: hover\) and \(pointer: fine\) \{\s*\.dg-close:hover/);
    expect(styles).toMatch(
      /@media \(pointer: coarse\), \(max-width: 639px\) \{\s*\.dg-close \{ width: 44px; height: 44px;/,
    );
    expect(styles).toContain('outline: 2px solid var(--border-focus); outline-offset: 2px;');
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    vi.useRealTimers();
    spy = soundSpy();
  });
  afterEach(() => {
    spy.restore();
    Reflect.deleteProperty(navigator, 'userActivation');
  });
  const tap = (t: EventTarget) =>
    t.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail: 1 }));
  const activation = (isActive: boolean) =>
    Object.defineProperty(navigator, 'userActivation', { configurable: true, get: () => ({ isActive }) });

  it('the close button, Escape and the scrim play close once ui-close goes through', async () => {
    const el = mount({ heading: 'Hi', open: '' });
    tap(q(el, '.dg-close')!);
    await spy.settle();
    el.show();
    await spy.settle();
    key(q(el, '.dg-panel')!, 'Escape');
    await spy.settle();
    el.show();
    await spy.settle();
    pointer(q(el, '.dg-scrim')!);
    tap(q(el, '.dg-scrim')!);
    await spy.settle();
    expect(spy.calls).toEqual([
      ['close', { input: 'mouse' }],
      ['open', undefined],
      ['close', { input: 'keyboard' }],
      ['open', undefined],
      ['close', { input: 'mouse' }],
    ]);
  });

  it('the host opening or closing it sounds only inside a user gesture', async () => {
    const el = mount({ heading: 'Hi' });
    activation(false);
    el.open = true;
    el.hide();
    el.setAttribute('open', '');
    el.removeAttribute('open');
    await spy.settle();
    expect(spy.calls).toEqual([]);
    activation(true);
    el.setAttribute('open', '');
    await spy.settle();
    el.open = false;
    await spy.settle();
    expect(spy.calls).toEqual([
      ['open', undefined],
      ['close', undefined],
    ]);
  });

  it('silent when it starts open, for a cancelled close or the state it is already in, and in a quiet region', async () => {
    document.body.innerHTML = '<ui-dialog open heading="Hi"></ui-dialog>';
    const el = mount({ heading: 'Hi', open: '' });
    el.addEventListener('ui-close', (e) => e.preventDefault(), { once: true });
    tap(q(el, '.dg-close')!);
    el.show();
    el.open = true;
    expect(el.open).toBe(true);
    await spy.settle();
    expect(spy.calls).toEqual([]);
    const quiet = document.createElement('div');
    quiet.setAttribute('data-ui-sound', 'off');
    document.body.append(quiet);
    quiet.append(el);
    tap(q(el, '.dg-close')!);
    expect(el.open).toBe(false);
    el.show();
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });
});
