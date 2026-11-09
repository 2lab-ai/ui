import { beforeEach, describe, expect, it } from 'vitest';
import { doc } from './docs';
import type { SparklineData, UiSparkline } from './sparkline';
import { fmtSpark, sparkPoints, sparkSummary, sparkValues } from './sparkline';

function mount(attrs: Record<string, string> = {}, data?: SparklineData): UiSparkline {
  const el = document.createElement('ui-sparkline');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  if (data) el.data = data;
  el.renderNow();
  return el;
}
const q = (el: UiSparkline, s: string) => el.shadowRoot!.querySelector<HTMLElement>(s);
const img = (el: UiSparkline) => q(el, '[role="img"]')!;
const line = (el: UiSparkline) => el.shadowRoot!.querySelector('.sp-line');

/** 12 readings: low 3.1K, high 9.8K, last 7.2K. */
const TOKENS = '4200, 5100, 3100, 6600, 7400, 9800, 8800, 6100, 5900, 7000, 8100, 7200';
const XSS = '<img src=x onerror=alert(1)>';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('helpers', () => {
  it('parses values split by commas or spaces and drops junk', () => {
    expect(sparkValues('1, 2,3 4')).toEqual([1, 2, 3, 4]);
    expect(sparkValues('1,x,,NaN, Infinity,-2.5;3')).toEqual([1, -2.5, 3]);
    expect(sparkValues('')).toEqual([]);
    expect(sparkValues(null)).toEqual([]);
    expect(sparkValues(42)).toEqual([]);
  });

  it('writes values short', () => {
    expect([950, 3100, 1_240_000, 12.54, 0.0421, 0].map(fmtSpark)).toEqual([
      '950',
      '3.1K',
      '1.2M',
      '12.5',
      '0.0421',
      '0',
    ]);
  });

  it('maps values into the padded box, flat in the middle, null as a gap, min / max clamped', () => {
    expect(sparkPoints([0, 10])).toEqual([
      [0, 92],
      [100, 8],
    ]);
    expect(sparkPoints([5, 5, 5]).map((p) => p?.[1])).toEqual([50, 50, 50]);
    expect(sparkPoints([1, null, 3])[1]).toBeNull();
    expect(sparkPoints([50, 150], 0, 100).map((p) => p?.[1])).toEqual([50, 8]);
    expect(sparkPoints([null, null])).toEqual([null, null]);
  });

  it('summarises en and ko', () => {
    expect(sparkSummary(sparkValues(TOKENS), 'Tokens')).toBe('Tokens: 12 points, low 3.1K, high 9.8K, last 7.2K');
    expect(sparkSummary(sparkValues(TOKENS), '토큰', 'ko')).toBe('토큰: 12개 지점, 최저 3.1K, 최고 9.8K, 최근 7.2K');
    expect(sparkSummary([4], '')).toBe('1 point, low 4, high 4, last 4');
    expect(sparkSummary([], 'Tokens')).toBe('Tokens: no data');
    expect(sparkSummary([null], '토큰', 'ko')).toBe('토큰: 데이터 없음');
  });
});

describe('<ui-sparkline>', () => {
  it('draws a smooth line from the values attribute with a dot on the last point', () => {
    const el = mount({ values: TOKENS, label: 'Tokens' });
    const d = line(el)?.getAttribute('d') ?? '';
    expect(d.startsWith('M0,')).toBe(true);
    expect(d).toContain('C');
    expect(el.shadowRoot!.querySelector('svg')?.getAttribute('preserveAspectRatio')).toBe('none');
    expect(img(el).getAttribute('aria-label')).toBe('Tokens: 12 points, low 3.1K, high 9.8K, last 7.2K');
    const dot = q(el, '.sp-dot')!;
    expect(dot.style.left).toBe('100%');
    expect(dot.getAttribute('aria-hidden')).toBe('true');
    expect(q(el, '.sp-area')).toBeNull();
  });

  it('ignores junk in values', () => {
    const el = mount({ values: '3, five, 4,, 8, NaN' });
    expect(img(el).getAttribute('aria-label')).toBe('3 points, low 3, high 8, last 8');
    expect(line(el)?.getAttribute('d')?.match(/M/g)).toHaveLength(1);
  });

  it('reads data over attributes; null breaks the line', () => {
    const el = mount(
      { values: '1,2,3', label: 'Attr' },
      { values: [4, 6, null, 5, 7], label: 'Sessions', tone: 'run' },
    );
    expect(line(el)?.getAttribute('d')?.match(/M/g)).toHaveLength(2);
    expect(img(el).getAttribute('aria-label')).toBe('Sessions: 4 points, low 4, high 7, last 7');
    expect(img(el).dataset.tone).toBe('run');
  });

  it('takes known tones only, inherits currentColor without one, and adds the area on request', () => {
    const el = mount({ values: '1,3,2', tone: 'red; x: url(y)', area: '' });
    expect(img(el).hasAttribute('data-tone')).toBe(false);
    expect(el.shadowRoot!.innerHTML).not.toContain('url(y)');
    expect(q(el, '.sp-area')?.getAttribute('fill')).toBe('url(#sp-g)');
    expect(q(el, '.sp-area')?.getAttribute('d')).toMatch(/Z$/);
    el.setAttribute('tone', 'accent');
    el.renderNow();
    expect(img(el).dataset.tone).toBe('accent');
    const css = el.shadowRoot!.querySelector('style')!.textContent!;
    expect(css).toMatch(/:host \{[^}]*color: inherit/);
    expect(css).toContain('--sp-c: currentColor');
    expect(css).toContain('var(--spark-w, 72px)');
    expect(css).toContain('var(--spark-h, 24px)');
    expect(css).toContain('vector-effect: non-scaling-stroke');
    expect(css.slice(css.indexOf('.sp {'))).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });

  it('says no data and draws nothing for no values', () => {
    const el = mount({ label: 'Tokens' });
    expect(img(el).getAttribute('aria-label')).toBe('Tokens: no data');
    expect(line(el)).toBeNull();
    expect(q(el, '.sp-dot')).toBeNull();
  });

  it('escapes the label', () => {
    const el = mount({ values: '1,2', label: XSS });
    expect(q(el, 'img')).toBeNull();
    expect(img(el).getAttribute('aria-label')).toBe(`${XSS}: 2 points, low 1, high 2, last 2`);
    const viaData = mount({}, { values: [1, 2], label: `"><img src=x onerror=alert(1)>` });
    expect(q(viaData, 'img')).toBeNull();
  });

  it('speaks Korean with lang="ko"', () => {
    const el = mount({ values: TOKENS, label: '토큰', lang: 'ko' });
    expect(img(el).getAttribute('aria-label')).toBe('토큰: 12개 지점, 최저 3.1K, 최고 9.8K, 최근 7.2K');
    expect(img(mount({ label: '토큰', lang: 'ko' })).getAttribute('aria-label')).toBe('토큰: 데이터 없음');
  });

  it('patches in place: a new reading keeps the svg, the line and the dot', async () => {
    const el = mount({ values: '1,2,3,4', label: 'Runs' });
    const svg = el.shadowRoot!.querySelector('svg');
    const path = line(el);
    const dot = q(el, '.sp-dot');
    const before = path?.getAttribute('d');
    el.setAttribute('values', '4,3,2,1');
    await Promise.resolve();
    expect(el.shadowRoot!.querySelector('svg')).toBe(svg);
    expect(line(el)).toBe(path);
    expect(q(el, '.sp-dot')).toBe(dot);
    expect(path?.getAttribute('d')).not.toBe(before);
    el.data = { values: [2, 9, 4], area: true };
    el.renderNow();
    expect(el.shadowRoot!.querySelector('svg')).toBe(svg);
    expect(q(el, '.sp-area')).not.toBeNull();
  });
});

describe('docs', () => {
  it('builds every demo without injecting markup', () => {
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const demo of doc.demos) {
      const box = demo.create();
      document.body.append(box);
      const sparks = box.localName === 'ui-sparkline' ? [box] : Array.from(box.querySelectorAll('ui-sparkline'));
      expect(sparks.length).toBeGreaterThan(0);
      for (const s of sparks as UiSparkline[]) {
        s.renderNow();
        expect(s.shadowRoot!.querySelector('[role="img"]')?.getAttribute('aria-label')).toBeTruthy();
      }
    }
  });
});
