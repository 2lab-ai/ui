import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type ElapsedEndDetail,
  elapsedFormat,
  elapsedText,
  elapsedTicks,
  elapsedTime,
  fmtSince,
  fmtSpan,
  fmtStopwatch,
  type UiElapsed,
} from './elapsed';

const NOW = Date.UTC(2026, 9, 30, 5, 0, 0);

function mount(attrs: Record<string, string>): UiElapsed {
  const el = document.createElement('ui-elapsed') as UiElapsed;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.renderNow();
  return el;
}
const text = (el: UiElapsed) => el.shadowRoot!.querySelector('time')?.textContent ?? '';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('helpers', () => {
  it('reads epoch ms, numeric strings, ISO strings and Dates', () => {
    expect(elapsedTime(NOW)).toBe(NOW);
    expect(elapsedTime(String(NOW))).toBe(NOW);
    expect(elapsedTime(new Date(NOW).toISOString())).toBe(NOW);
    expect(elapsedTime(new Date(NOW))).toBe(NOW);
    expect(elapsedTime('soon')).toBeNaN();
    expect(elapsedTime(undefined)).toBeNaN();
    expect(elapsedFormat('nope')).toBe('duration');
    expect(elapsedFormat('ago')).toBe('ago');
  });

  it('formats spans, clocks and "ago" in en and ko', () => {
    expect(fmtSpan(42_000)).toBe('42s');
    expect(fmtSpan(562_000)).toBe('9m 22s');
    expect(fmtSpan(8_100_000)).toBe('2h 15m');
    expect(fmtSpan(562_000, 'ko')).toBe('9분 22초');
    expect(fmtSpan(-5)).toBe('0s');
    expect(fmtStopwatch(42_000)).toBe('0:42');
    expect(fmtStopwatch(8_107_000)).toBe('2:15:07');
    expect(fmtSince(10_000)).toBe('just now');
    expect(fmtSince(300_000)).toBe('5m ago');
    expect(fmtSince(3 * 3_600_000)).toBe('3h ago');
    expect(fmtSince(3 * 86_400_000)).toBe('3d ago');
    expect(fmtSince(300_000, 'ko')).toBe('5분 전');
    expect(fmtSince(1_000, 'ko')).toBe('방금');
  });

  it('says what a moment shows, and whether it still ticks', () => {
    expect(elapsedText({ since: NOW - 75_000 }, NOW)).toBe('1m 15s');
    expect(elapsedText({ since: NOW - 75_000, until: NOW - 15_000 }, NOW)).toBe('1m 00s');
    expect(elapsedText({ since: NOW - 75_000, format: 'clock' }, NOW)).toBe('1:15');
    expect(elapsedText({ until: NOW + 90_000, format: 'countdown' }, NOW)).toBe('1m 30s');
    expect(elapsedText({ format: 'countdown' }, NOW)).toBe('');
    expect(elapsedText({}, NOW)).toBe('');
    expect(elapsedTicks({ since: NOW }, NOW)).toBe(true);
    expect(elapsedTicks({ since: NOW, until: NOW + 1 }, NOW)).toBe(false);
    expect(elapsedTicks({ until: NOW + 1000, format: 'countdown' }, NOW)).toBe(true);
    expect(elapsedTicks({ until: NOW, format: 'countdown' }, NOW)).toBe(false);
  });
});

describe('<ui-elapsed>', () => {
  it('shows the running time and ticks in place on whole seconds', () => {
    const el = mount({ since: String(NOW - 59_000) });
    const node = el.shadowRoot!.querySelector('time')!;
    expect(text(el)).toBe('59s');
    expect(node.getAttribute('datetime')).toBe(new Date(NOW - 59_000).toISOString());
    expect(node.getAttribute('title')).toBeTruthy();
    // The shared ticker turns just past each whole second.
    vi.advanceTimersByTime(1010);
    expect(text(el)).toBe('1m 00s');
    // The same node, not a re-render.
    expect(el.shadowRoot!.querySelector('time')).toBe(node);
  });

  it('stops at until (a finished run)', () => {
    const el = mount({ since: new Date(NOW - 120_000).toISOString(), until: new Date(NOW - 60_000).toISOString() });
    expect(text(el)).toBe('1m 00s');
    vi.advanceTimersByTime(5000);
    expect(text(el)).toBe('1m 00s');
  });

  it('counts down and says so once at zero', () => {
    const el = mount({ until: String(NOW + 2_000), format: 'countdown' });
    const ends: ElapsedEndDetail[] = [];
    el.addEventListener('ui-end', (e) => ends.push((e as CustomEvent<ElapsedEndDetail>).detail));
    expect(text(el)).toBe('2s');
    vi.advanceTimersByTime(3000);
    expect(text(el)).toBe('0s');
    vi.advanceTimersByTime(3000);
    expect(ends).toEqual([{ until: NOW + 2_000 }]);
  });

  it('reads "ago" and speaks Korean with lang="ko"', () => {
    const el = mount({ since: String(NOW - 300_000), format: 'ago', lang: 'ko' });
    expect(text(el)).toBe('5분 전');
    el.setAttribute('lang', 'en');
    el.renderNow();
    expect(text(el)).toBe('5m ago');
  });

  it('takes data as well as attributes', () => {
    const el = mount({});
    expect(text(el)).toBe('');
    el.data = { since: NOW - 3_725_000, format: 'clock' };
    el.renderNow();
    expect(text(el)).toBe('1:02:05');
  });

  it('leaves the shared ticker when disconnected', () => {
    const el = mount({ since: String(NOW) });
    const spy = vi.spyOn(el, 'tick');
    el.remove();
    vi.advanceTimersByTime(3000);
    expect(spy).not.toHaveBeenCalled();
  });

  it('sits inline in the sentence and takes its font and colour', async () => {
    const { styles } = await import('./elapsed').then((m) => ({
      styles: (m.UiElapsed as unknown as { styles: string[] }).styles.join(''),
    }));
    expect(styles).toMatch(/:host \{ display: inline; font: inherit; color: inherit;/);
    expect(styles).toContain('.ui-root { display: inline; }');
    expect(styles).toContain('tabular-nums');
  });

  it('never renders markup from an attribute', () => {
    const el = mount({ since: '<img src=x onerror=alert(1)>' });
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    expect(text(el)).toBe('');
  });
});
