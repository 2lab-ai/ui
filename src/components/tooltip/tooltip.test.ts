import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { styles } from './styles';
import { idrefList, tooltipDelay, type UiTooltip } from './tooltip';

const XSS = '<img src=x onerror=alert(1)>';

function mount(
  attrs: Record<string, string> = { text: 'Copy link' },
  content?: HTMLElement,
): { el: UiTooltip; trig: HTMLButtonElement } {
  const el = document.createElement('ui-tooltip') as UiTooltip;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  const trig = document.createElement('button');
  trig.textContent = 'Copy';
  el.append(trig);
  if (content) el.append(content);
  document.body.append(el);
  el.renderNow();
  return { el, trig };
}
const pop = (el: UiTooltip) => el.shadowRoot!.querySelector<HTMLElement>('.tt-pop')!;
const textSpan = (el: UiTooltip) => el.querySelector<HTMLElement>('[data-ui-tooltip-text]');
const pointer = (t: Element, type: string, pointerType = 'mouse') =>
  t.dispatchEvent(new PointerEvent(type, { pointerType, bubbles: type === 'pointerdown', composed: true }));

// Each test runs an hour after the last on the fake clock, so the module's "warm" timestamp never leaks across.
let clock = Date.UTC(2026, 9, 30, 9);
beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
  clock += 3_600_000;
  vi.setSystemTime(clock);
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('helpers', () => {
  it('idrefList appends and drops ids, keeping the others in order', () => {
    expect(idrefList(null, ['a'])).toBe('a');
    expect(idrefList('x  y', ['a', 'x'])).toBe('x y a');
    expect(idrefList('x a y', [], ['a'])).toBe('x y');
    expect(idrefList('a', [], ['a'])).toBe('');
  });
  it('tooltipDelay reads ms, else 500', () => {
    expect(tooltipDelay(null)).toBe(500);
    expect(tooltipDelay('0')).toBe(0);
    expect(tooltipDelay('250')).toBe(250);
    expect(tooltipDelay('-1')).toBe(500);
    expect(tooltipDelay('soon')).toBe(500);
  });
});

describe('<ui-tooltip>', () => {
  it('puts the text in a light-DOM span the trigger is described by, keeping its own ids', () => {
    const el = document.createElement('ui-tooltip') as UiTooltip;
    el.setAttribute('text', 'Copy link');
    const trig = document.createElement('button');
    trig.setAttribute('aria-describedby', 'hint');
    el.append(trig);
    document.body.append(el);
    el.renderNow();
    const span = textSpan(el)!;
    expect(span.slot).toBe('content');
    expect(span.id).toMatch(/^ui-tt-\d+$/);
    expect(span.textContent).toBe('Copy link');
    expect(trig.getAttribute('aria-describedby')).toBe(`hint ${span.id}`);
    const p = pop(el);
    expect(p.getAttribute('role')).toBe('tooltip');
    expect(p.getAttribute('part')).toBe('tooltip');
    expect(p.querySelector('slot[name="content"]')).not.toBeNull();
    el.remove();
    expect(trig.getAttribute('aria-describedby')).toBe('hint');
  });

  it('describes the trigger by slot content: its own id kept, an id given when missing', () => {
    const rich = document.createElement('div');
    rich.slot = 'content';
    rich.id = 'breakdown';
    const { el, trig } = mount({ variant: 'card' }, rich);
    expect(trig.getAttribute('aria-describedby')).toBe('breakdown');
    const extra = document.createElement('p');
    extra.slot = 'content';
    el.append(extra);
    el.renderNow();
    expect(extra.id).toMatch(/^ui-tt-\d+$/);
    expect(trig.getAttribute('aria-describedby')).toBe(`breakdown ${extra.id}`);
    expect(textSpan(el)).toBeNull();
  });

  it('a new trigger takes the description; the old one loses only our id', () => {
    const { el, trig } = mount();
    const id = textSpan(el)!.id;
    trig.setAttribute('aria-describedby', `own ${id}`);
    const next = document.createElement('a');
    trig.remove();
    el.prepend(next);
    el.renderNow();
    expect(trig.getAttribute('aria-describedby')).toBe('own');
    expect(next.getAttribute('aria-describedby')).toBe(id);
  });

  it('text from the attribute, the property and data (data wins) — never parsed as HTML', () => {
    const { el, trig } = mount({ text: 'One' });
    el.text = XSS;
    el.renderNow();
    expect(el.getAttribute('text')).toBe(XSS);
    expect(textSpan(el)!.textContent).toBe(XSS);
    expect(el.querySelector('img')).toBeNull();
    el.data = { text: 'From data' };
    el.renderNow();
    expect(el.text).toBe('From data');
    expect(textSpan(el)!.textContent).toBe('From data');
    el.data = { text: '' };
    el.renderNow();
    expect(textSpan(el)).toBeNull();
    expect(trig.hasAttribute('aria-describedby')).toBe(false);
  });

  it('a mouse shows it after the delay; touch never does', () => {
    const { el, trig } = mount({ text: 'Copy link', delay: '400' });
    pointer(trig, 'pointerenter', 'touch');
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);
    pointer(trig, 'pointerenter');
    vi.advanceTimersByTime(399);
    expect(el.open).toBe(false);
    vi.advanceTimersByTime(1);
    expect(el.open).toBe(true);
    expect(pop(el).classList.contains('is-open')).toBe(true);
  });

  it('keyboard focus shows it at once; focus leaving hides it', () => {
    const { el, trig } = mount();
    trig.focus();
    expect(el.open).toBe(true);
    trig.blur();
    expect(el.open).toBe(false);
  });

  it('leaving the trigger hides after a 100ms grace; the bubble under the pointer keeps it', () => {
    const { el, trig } = mount();
    pointer(trig, 'pointerenter');
    vi.advanceTimersByTime(500);
    pointer(trig, 'pointerleave');
    vi.advanceTimersByTime(99);
    expect(el.open).toBe(true);
    pointer(pop(el), 'pointerenter');
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(true);
    pointer(pop(el), 'pointerleave');
    vi.advanceTimersByTime(100);
    expect(el.open).toBe(false);
    expect(pop(el).classList.contains('is-open')).toBe(false);
  });

  it('leaving before the delay cancels the show', () => {
    const { el, trig } = mount();
    pointer(trig, 'pointerenter');
    vi.advanceTimersByTime(300);
    pointer(trig, 'pointerleave');
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);
  });

  it('Esc hides it without moving focus or stopping the key', () => {
    const { el, trig } = mount();
    trig.focus();
    expect(el.open).toBe(true);
    const page = vi.fn();
    document.addEventListener('keydown', page);
    trig.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    expect(el.open).toBe(false);
    expect(document.activeElement).toBe(trig);
    expect(page).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', page);
  });

  it('a press on the trigger hides it and cancels a pending show', () => {
    const { el, trig } = mount();
    pointer(trig, 'pointerenter');
    vi.advanceTimersByTime(500);
    expect(el.open).toBe(true);
    pointer(trig, 'pointerdown');
    expect(el.open).toBe(false);
    vi.advanceTimersByTime(1000);
    pointer(trig, 'pointerleave');
    pointer(trig, 'pointerenter');
    vi.advanceTimersByTime(200);
    pointer(trig, 'pointerdown');
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);
  });

  it('a warm group: the next tooltip shows at once within 300ms, one at a time', () => {
    const a = mount({ text: 'Copy' });
    const b = mount({ text: 'Refresh' });
    pointer(a.trig, 'pointerenter');
    vi.advanceTimersByTime(500);
    expect(a.el.open).toBe(true);
    pointer(b.trig, 'pointerenter'); // A still showing → B at once, A gives way
    expect(b.el.open).toBe(true);
    expect(a.el.open).toBe(false);
    pointer(b.trig, 'pointerleave');
    vi.advanceTimersByTime(100);
    expect(b.el.open).toBe(false);
    vi.advanceTimersByTime(250);
    pointer(a.trig, 'pointerenter'); // hidden 250ms ago → still warm
    expect(a.el.open).toBe(true);
    pointer(a.trig, 'pointerleave');
    vi.advanceTimersByTime(100 + 300);
    pointer(b.trig, 'pointerenter'); // cold again
    expect(b.el.open).toBe(false);
  });

  it('disabled never shows (and hides when it turns disabled); show() / hide() work otherwise', () => {
    const { el, trig } = mount({ text: 'Copy', disabled: '' });
    pointer(trig, 'pointerenter');
    vi.advanceTimersByTime(1000);
    trig.focus();
    el.show();
    expect(el.open).toBe(false);
    el.removeAttribute('disabled');
    el.show();
    expect(el.open).toBe(true);
    el.setAttribute('disabled', '');
    expect(el.open).toBe(false);
    el.removeAttribute('disabled');
    el.show();
    el.hide();
    expect(el.open).toBe(false);
  });

  it('shows nothing without text or content', () => {
    const { el, trig } = mount({});
    trig.focus();
    el.show();
    expect(el.open).toBe(false);
  });

  it('placement sets the side and alignment of the bubble', () => {
    const { el } = mount();
    expect(pop(el).dataset.side).toBe('top');
    expect(pop(el).dataset.align).toBe('center');
    el.setAttribute('placement', 'bottom-end');
    el.renderNow();
    expect(pop(el).dataset.side).toBe('bottom');
    expect(pop(el).dataset.align).toBe('end');
    el.setAttribute('placement', 'top-start');
    el.renderNow();
    expect(pop(el).dataset.side).toBe('top');
    expect(pop(el).dataset.align).toBe('start');
  });

  it('keeps the bubble node across show / hide and leaves no listener behind', () => {
    const { el, trig } = mount();
    const node = pop(el);
    trig.focus();
    expect(pop(el)).toBe(node);
    const remove = vi.spyOn(document, 'removeEventListener');
    el.remove();
    expect(el.open).toBe(false);
    expect(remove.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(['keydown', 'scroll']));
    remove.mockRestore();
  });

  it('styles: origin-aware by side, 160/220ms open, 180ms exit with delayed visibility, gentle reduced motion', () => {
    expect(styles).toContain('transform-origin: bottom center; opacity: 0; visibility: hidden; pointer-events: none;');
    expect(styles).toContain('transform: translateY(4px) scale(0.96);');
    expect(styles).toContain(
      '.tt-pop[data-side="bottom"] { transform-origin: top center; transform: translateY(-4px) scale(0.96); }',
    );
    expect(styles).toContain('.tt-pop[data-align="start"] { transform-origin: bottom left; }');
    expect(styles).toContain('.tt-pop[data-side="bottom"][data-align="end"] { transform-origin: top right; }');
    expect(styles).toContain(
      'transition: opacity 160ms var(--ease-out), transform 220ms var(--ease-out), visibility 0s;',
    );
    expect(styles).toContain(
      'transition: opacity 180ms var(--ease-out), transform 180ms var(--ease-out), visibility 0s linear 180ms;',
    );
    expect(styles).toMatch(
      /prefers-reduced-motion: reduce\) \{\s*\.tt-pop, \.tt-pop\[data-side="bottom"\] \{ transform: none; transition: opacity 120ms ease/,
    );
    expect(styles).toContain(':host([variant="card"]) .tt-pop');
    expect(styles).not.toMatch(/scale\(0\)/);
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});
