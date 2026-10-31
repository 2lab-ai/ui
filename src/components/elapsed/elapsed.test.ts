import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type ElapsedEndDetail,
  elapsedFormat,
  elapsedPrecision,
  elapsedText,
  elapsedTicks,
  elapsedTime,
  fmtSince,
  fmtSpan,
  fmtSpanCoarse,
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

  it('pins the Korean short forms: 1분 05초 · 3분 전 · 방금 (one voice with the page’s formatDuration)', () => {
    expect(fmtSpan(65_000, 'ko')).toBe('1분 05초');
    expect(fmtSpan(42_000, 'ko')).toBe('42초');
    expect(fmtSpan(2 * 3_600_000 + 15 * 60_000, 'ko')).toBe('2시간 15분');
    expect(fmtSince(180_000, 'ko')).toBe('3분 전');
    expect(fmtSince(1_000, 'ko')).toBe('방금');
    expect(fmtSince(44_000, 'ko')).toBe('방금');
    expect(fmtSince(3 * 3_600_000, 'ko')).toBe('3시간 전');
    expect(fmtSince(3 * 86_400_000, 'ko')).toBe('3일 전');
    expect(elapsedText({ since: NOW - 65_000 }, NOW, 'ko')).toBe('1분 05초');
    expect(elapsedText({ since: NOW - 180_000, format: 'ago' }, NOW, 'ko')).toBe('3분 전');
  });

  it('puts the host’s words after the time, and a countdown’s at-zero words instead of 0s — never “곧 후”', () => {
    const cd = (ms: number, extra: Record<string, unknown> = {}) =>
      elapsedText({ until: NOW + ms, format: 'countdown', ...extra }, NOW, 'ko');
    expect(cd(192_000, { after: '후' })).toBe('3분 12초 후');
    expect(cd(192_000, { after: '후', precision: 'minute' })).toBe('3분 후');
    expect(cd(24 * 60_000 + 41_000, { after: '후 복귀', precision: 'minute' })).toBe('24분 후 복귀');
    expect(cd(0, { after: '후 복귀', atZero: '곧 복귀' })).toBe('곧 복귀');
    expect(cd(-5_000, { after: '후', atZero: '곧' })).toBe('곧');
    // "0s" is the moment the at-zero words begin (under a second left reads 0초 floored).
    expect(cd(990, { after: '후', atZero: '곧' })).toBe('곧');
    expect(cd(1_000, { after: '후', atZero: '곧' })).toBe('1초 후');
    expect(cd(0, { after: '후' })).toBe('0초 후');
    expect(cd(0, {})).toBe('0초');
    expect(cd(90_000, { after: '  ', atZero: ' ' })).toBe('1분 30초');
    expect(elapsedText({ until: NOW + 192_000, format: 'countdown', after: 'left', atZero: 'now' }, NOW)).toBe(
      '3m 12s left',
    );
    expect(elapsedText({ until: NOW, format: 'countdown', after: 'left', atZero: 'now' }, NOW)).toBe('now');
    // The loose form: seconds under a minute, whole minutes, hours and minutes, days and hours — floored, unpadded.
    expect(fmtSpanCoarse(42_000, 'ko')).toBe('42초');
    expect(fmtSpanCoarse(24 * 60_000 + 59_000, 'ko')).toBe('24분');
    expect(fmtSpanCoarse(80 * 60_000, 'ko')).toBe('1시간 20분');
    expect(fmtSpanCoarse(29 * 3_600_000, 'ko')).toBe('1일 5시간');
    expect(fmtSpanCoarse(65 * 60_000)).toBe('1h 5m');
    expect(fmtSpanCoarse(-5)).toBe('0s');
    expect(elapsedPrecision('minute')).toBe('minute');
    expect(elapsedPrecision('hour')).toBe('second');
    expect(elapsedText({ since: NOW - 192_000, precision: 'minute' }, NOW, 'ko')).toBe('3분');
    expect(elapsedText({ since: NOW - 192_000, format: 'clock', precision: 'minute' }, NOW)).toBe('3:12');
    // `after` follows any format; `atZero` is the countdown's alone; nothing follows an empty text.
    expect(elapsedText({ since: NOW - 65_000, after: '동안' }, NOW, 'ko')).toBe('1분 05초 동안');
    expect(elapsedText({ since: NOW - 65_000, format: 'clock', after: 'in' }, NOW)).toBe('1:05 in');
    expect(elapsedText({ since: NOW - 300_000, format: 'ago', atZero: 'now' }, NOW)).toBe('5m ago');
    expect(elapsedText({ format: 'countdown', after: '후', atZero: '곧' }, NOW)).toBe('');
    expect(elapsedText({ after: '후' }, NOW)).toBe('');
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

  it('counts down in the host’s words (after / at-zero attributes, data wins) and still says ui-end once', () => {
    const el = mount({
      until: String(NOW + 3_000),
      format: 'countdown',
      lang: 'ko',
      after: '후 복귀',
      'at-zero': '곧 복귀',
    });
    const ends: ElapsedEndDetail[] = [];
    el.addEventListener('ui-end', (e) => ends.push((e as CustomEvent<ElapsedEndDetail>).detail));
    expect(text(el)).toBe('3초 후 복귀');
    vi.advanceTimersByTime(1010);
    expect(text(el)).toBe('1초 후 복귀'); // 1.99 s left, floored
    vi.advanceTimersByTime(1000);
    expect(text(el)).toBe('곧 복귀'); // 0.99 s left would read 0초: the at-zero words begin
    vi.advanceTimersByTime(1000);
    expect(text(el)).toBe('곧 복귀');
    expect(ends).toEqual([{ until: NOW + 3_000 }]);
    vi.advanceTimersByTime(3000);
    expect(ends.length).toBe(1);
    // Data over attributes; a changed attribute re-renders.
    const now = Date.now();
    el.data = { until: now + 192_000, format: 'countdown', precision: 'minute', after: '후' };
    el.renderNow();
    expect(text(el)).toBe('3분 후');
    el.data = undefined;
    el.setAttribute('after', '후');
    el.setAttribute('precision', 'minute');
    el.setAttribute('until', String(now + 24 * 60_000 + 41_000));
    el.renderNow();
    expect(text(el)).toBe('24분 후');
    el.removeAttribute('precision');
    el.setAttribute('until', String(now + 60_000));
    el.renderNow();
    expect(text(el)).toBe('1분 00초 후');
    // The words never render markup.
    el.setAttribute('after', '<b>후</b>');
    el.renderNow();
    expect(el.shadowRoot!.querySelector('b')).toBeNull();
    expect(text(el)).toBe('1분 00초 <b>후</b>');
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
