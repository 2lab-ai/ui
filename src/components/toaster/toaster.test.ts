import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  errorText,
  messageFields,
  normTone,
  parsePlacement,
  swipeDismisses,
  toastDuration,
  visibleCount,
} from './logic';
import { toasterStrings } from './strings';
import type { UiToaster } from './toaster';
import { pageToaster, toast } from './toaster';
import './toaster';

const XSS = '<img src=x onerror=alert(1)>';

function mount(attrs: Record<string, string> = {}): UiToaster {
  const el = document.createElement('ui-toaster');
  el.setAttribute('inline', '');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.renderNow();
  return el;
}
const items = (el: UiToaster) => [...(el.shadowRoot?.querySelectorAll<HTMLElement>('.ts-toast') ?? [])];
function events(el: UiToaster, name: string): unknown[] {
  const out: unknown[] = [];
  el.addEventListener(name, (e) => out.push((e as CustomEvent).detail));
  return out;
}
const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('logic', () => {
  it('toastDuration: loading never times out, errors stay twice as long, 0/Infinity keep it open', () => {
    expect(toastDuration('loading', 1000)).toBe(Number.POSITIVE_INFINITY);
    expect(toastDuration('error', undefined, 4000)).toBe(8000);
    expect(toastDuration('success', undefined, 4000)).toBe(4000);
    expect(toastDuration('success', 1500)).toBe(1500);
    expect(toastDuration('neutral', 0)).toBe(Number.POSITIVE_INFINITY);
    expect(toastDuration('neutral', Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
  });

  it('normTone / parsePlacement / visibleCount refuse unknown input', () => {
    expect(normTone('error')).toBe('error');
    expect(normTone('boom')).toBe('neutral');
    expect(visibleCount(0)).toBe(3);
    expect(visibleCount('5')).toBe(5);
    expect(parsePlacement('top-center')).toBeTruthy();
  });

  it('messageFields: string, object or function of the value; errorText reads an Error', () => {
    expect(messageFields('Done', 1, 'x')).toMatchObject({ title: 'Done' });
    expect(messageFields((v: number) => ({ title: `got ${v}` }), 7, 'x')).toMatchObject({ title: 'got 7' });
    expect(messageFields(undefined, 1, 'Fallback')).toMatchObject({ title: 'Fallback' });
    expect(errorText(new Error('HTTP 502'))).toBe('HTTP 502');
    expect(errorText('plain')).toBe('plain');
  });

  it('swipeDismisses needs a real fling or distance', () => {
    expect(swipeDismisses([{ t: 0, x: 0, y: 0 } as never], 'x', 1)).toBe(false);
  });
});

describe('<ui-toaster>', () => {
  it('show() renders a toast with title, description, tone and returns its id', () => {
    const el = mount();
    const id = el.show('Session stopped', { tone: 'success', description: 'model picker bars' });
    expect(id).toMatch(/^toast-/);
    const li = items(el)[0];
    expect(li.dataset.tone).toBe('success');
    expect(li.textContent).toContain('Session stopped');
    expect(li.textContent).toContain('model picker bars');
    expect(el.toasts).toEqual([
      expect.objectContaining({ id, title: 'Session stopped', tone: 'success', description: 'model picker bars' }),
    ]);
  });

  it('escapes every host string; a link only takes http(s)/mailto', () => {
    const el = mount();
    el.show(XSS, {
      description: XSS,
      action: { id: XSS, label: XSS },
      link: { label: XSS, href: 'javascript:alert(1)' },
      id: `"${XSS}`,
    });
    expect(el.shadowRoot?.querySelector('img')).toBeNull();
    expect(el.shadowRoot?.innerHTML).toContain('&lt;img');
    const a = el.shadowRoot?.querySelector<HTMLAnchorElement>('a');
    expect(a?.getAttribute('href') ?? '').not.toContain('javascript');
  });

  it('show() with an existing id updates that toast in place', () => {
    const el = mount();
    const id = el.show('Sending…', { tone: 'loading' });
    el.show({ id, title: 'Sent', tone: 'success' });
    expect(el.toasts).toHaveLength(1);
    expect(el.toasts[0]).toMatchObject({ id, title: 'Sent', tone: 'success' });
    expect(el.update(id, { title: 'Sent again' })).toBe(true);
    expect(el.update('nope', { title: 'x' })).toBe(false);
  });

  it('times out after its duration (errors twice as long) and emits ui-dismiss { reason: timeout }', () => {
    vi.useFakeTimers();
    const el = mount();
    el.data = { duration: 1000 };
    el.renderNow();
    const got = events(el, 'ui-dismiss');
    const ok = el.show('Saved', { tone: 'success' });
    const bad = el.show('Failed', { tone: 'error' });
    vi.advanceTimersByTime(1100);
    expect(got).toContainEqual({ id: ok, reason: 'timeout' });
    expect(got).not.toContainEqual({ id: bad, reason: 'timeout' });
    vi.advanceTimersByTime(1100);
    expect(got).toContainEqual({ id: bad, reason: 'timeout' });
  });

  it('dismiss(id) and dismiss() close with reason api', () => {
    const el = mount();
    const got = events(el, 'ui-dismiss');
    const a = el.show('A');
    el.show('B');
    el.dismiss(a);
    expect(got).toEqual([{ id: a, reason: 'api' }]);
    el.dismiss();
    expect(got).toHaveLength(2);
    expect(el.toasts).toHaveLength(0);
  });

  it('an action emits ui-action and closes the toast; cancelled, it stays', () => {
    const el = mount();
    const acts = events(el, 'ui-action');
    const gone = events(el, 'ui-dismiss');
    const id = el.show('Couldn’t stop', { tone: 'error', action: { id: 'retry' } });
    const btn = el.shadowRoot?.querySelector<HTMLButtonElement>('[data-act="action"]');
    expect(btn?.textContent).toContain('Retry');
    btn?.click();
    expect(acts).toEqual([{ id, actionId: 'retry' }]);
    expect(gone).toEqual([{ id, reason: 'action' }]);
    const id2 = el.show('Deleted', { action: { id: 'undo' } });
    el.addEventListener('ui-action', (e) => e.preventDefault(), { once: true });
    el.shadowRoot?.querySelector<HTMLButtonElement>(`[data-id="${id2}"] [data-act="action"]`)?.click();
    expect(el.toasts.map((t) => t.id)).toContain(id2);
  });

  it('the close button and Esc dismiss', () => {
    const el = mount();
    const got = events(el, 'ui-dismiss');
    const a = el.show('A');
    el.shadowRoot?.querySelector<HTMLButtonElement>(`[data-id="${a}"] [data-act="close"]`)?.click();
    expect(got).toEqual([{ id: a, reason: 'close' }]);
    const b = el.show('B');
    items(el)[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    expect(got).toContainEqual({ id: b, reason: 'escape' });
  });

  it('promise(): a spinner that turns into success — or error with the reason', async () => {
    const el = mount();
    const p = el.promise(Promise.resolve('opus'), { loading: 'Switching…', success: (m) => `Switched to ${m}` });
    expect(el.toasts[0]).toMatchObject({ title: 'Switching…', tone: 'loading' });
    await p;
    await flush();
    expect(el.toasts[0]).toMatchObject({ title: 'Switched to opus', tone: 'success' });
    const q = el.promise(Promise.reject(new Error('HTTP 502')), { loading: 'Sending…' });
    await q.catch(() => {});
    await flush();
    expect(el.toasts[0]).toMatchObject({ tone: 'error', title: 'Something went wrong', description: 'HTTP 502' });
  });

  it('more than `visible` toasts wait behind “+N”', () => {
    const el = mount();
    el.data = { visible: 3 };
    el.renderNow();
    for (let i = 0; i < 5; i++) el.show(`T${i}`);
    const more = el.shadowRoot?.querySelector<HTMLElement>('.ts-more');
    expect(more?.hidden).toBe(false);
    expect(more?.textContent).toContain('+2');
  });

  it('toasts waiting behind “+N” keep their time: the shown ones time out first, then the waiting ones (review)', () => {
    vi.useFakeTimers();
    const el = mount();
    el.data = { duration: 1000, visible: 3 };
    el.renderNow();
    const gone: string[] = [];
    el.addEventListener('ui-dismiss', (e) => gone.push((e as CustomEvent).detail.id));
    for (const id of ['T0', 'T1', 'T2', 'T3', 'T4']) el.show({ id, title: id });
    const waiting = items(el)
      .filter((li) => li.hasAttribute('inert'))
      .map((li) => li.dataset.id);
    expect(waiting).toEqual(['T1', 'T0']);
    vi.advanceTimersByTime(1100);
    expect(gone).toEqual(['T2', 'T3', 'T4']);
    expect(el.toasts.map((t) => t.id)).toEqual(['T1', 'T0']);
    vi.advanceTimersByTime(1500);
    expect(gone.slice(3).sort()).toEqual(['T0', 'T1']);
  });

  it('timers stop when the toaster leaves the page', () => {
    vi.useFakeTimers();
    const el = mount();
    el.data = { duration: 500 };
    el.renderNow();
    const got = events(el, 'ui-dismiss');
    el.show('X');
    el.remove();
    vi.advanceTimersByTime(2000);
    expect(got).toHaveLength(0);
  });

  it('lang="ko" uses the dashboard wording', () => {
    const el = mount({ lang: 'ko' });
    el.show('휴지통으로 옮기지 못했어요', { tone: 'error', action: { id: 'retry' } });
    expect(el.shadowRoot?.querySelector('[data-act="action"]')?.textContent).toContain('다시 시도');
    expect(el.shadowRoot?.querySelector('[data-act="close"]')?.getAttribute('aria-label')).toBe('닫기');
    expect(toasterStrings('ko').done).toBe('완료했어요');
  });
});

describe('toast() helper', () => {
  it('finds or creates the page toaster and shows on it', () => {
    const id = toast.success('Goal updated');
    const page = pageToaster();
    expect(document.querySelectorAll('ui-toaster:not([inline])')).toHaveLength(1);
    expect(page.toasts.map((t) => t.id)).toContain(id);
    toast.dismiss(id);
    expect(page.toasts.map((t) => t.id)).not.toContain(id);
  });
});
