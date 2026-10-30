import { beforeEach, describe, expect, it, vi } from 'vitest';
import './disclosure';
import type { DisclosureData, UiDisclosure } from './disclosure';
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

  it('carries Korean text with lang="ko"', () => {
    const el = mount({ summary: '자세히', meta: '3' }, { lang: 'ko' });
    expect(q(el, '.dc-summary')?.textContent).toBe('자세히');
  });
});
