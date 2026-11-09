import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UiLineChart } from './line-chart';
import './line-chart';
import {
  fmtLineTick,
  fmtLineValue,
  type LineChartData,
  type LinePoint,
  lineChartModel,
  lineRuns,
  monotoneArea,
  monotonePath,
  monotoneSlopes,
  nearestIndex,
  niceTicks,
  xLabelLevels,
} from './logic';
import { styles } from './styles';

function mount(data: LineChartData, attrs: Record<string, string> = {}): UiLineChart {
  const el = document.createElement('ui-line-chart') as UiLineChart;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = (el: UiLineChart, s: string) => el.shadowRoot!.querySelector<HTMLElement>(s);
const qa = (el: UiLineChart, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const plot = (el: UiLineChart) => q(el, '.lc-plot')!;
const tip = (el: UiLineChart) => q(el, '.lc-tip')!;
const live = (el: UiLineChart) => q(el, '.lc-live')!;
const key = (t: HTMLElement, k: string) => {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true });
  t.dispatchEvent(ev);
  return ev;
};
/** Give the plot a 300px box at x 0 so pointer positions map to points. */
function sized(el: UiLineChart, width = 300): void {
  plot(el).getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: width, bottom: 200, width, height: 200, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
}
const move = (t: Element, clientX: number, pointerType = 'mouse') =>
  t.dispatchEvent(new PointerEvent('pointermove', { clientX, pointerType, bubbles: true, composed: true }));

const RATE: LineChartData = {
  label: 'Resting rate',
  unit: 'bpm',
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  series: [
    { id: 'now', label: 'Rate', values: [62, 64, 61, 68, 63] },
    { id: 'before', label: '30 days before', values: [60, 61, 63, 62, 61] },
  ],
  band: { min: 55, max: 80 },
  summary: [
    { label: 'Average', value: '64', unit: 'bpm', tone: 'accent' },
    { label: 'Lowest', value: '61', unit: 'bpm' },
    { label: 'Days in range', value: '5', unit: 'of 5', tone: 'done' },
  ],
};

const XSS = '<img src=x onerror=alert(1)>';
const BREAK = '"><b>x</b>';

beforeEach(() => {
  document.body.innerHTML = '';
});

/** Every cubic segment of a path: [start y, control 1 y, control 2 y, end y]. */
function cubics(d: string): number[][] {
  const out: number[][] = [];
  let y = 0;
  for (const cmd of d.match(/[MLCh][^MLCh]*/g) ?? []) {
    const n = cmd.slice(1).split(/[ ,]/).filter(Boolean).map(Number);
    if (cmd[0] === 'C') {
      out.push([y, n[1], n[3], n[5]]);
      y = n[5];
    } else if (cmd[0] !== 'h') y = n[1];
  }
  return out;
}

describe('monotone path', () => {
  it('draws two points straight and three or more as cubic segments', () => {
    expect(
      monotonePath([
        [0, 50],
        [100, 10],
      ]),
    ).toBe('M0,50L100,10');
    expect(
      monotonePath([
        [0, 100],
        [50, 0],
        [100, 100],
      ]),
    ).toBe('M0,100C16.67,50 33.33,0 50,0C66.67,0 83.33,50 100,100');
  });

  it('is flat at a peak, keeps a flat run flat and never overshoots the data', () => {
    expect(
      monotoneSlopes([
        [0, 10],
        [1, 30],
        [2, 5],
      ])[1],
    ).toBe(0);
    const flat = cubics(
      monotonePath([
        [0, 50],
        [50, 50],
        [100, 80],
      ]),
    );
    expect(flat[0]).toEqual([50, 50, 50, 50]);
    const ys = [62, 64, 61, 68, 63, 63, 90, 10, 12, 11, 50, 49, 51, 0, 100];
    const pts = ys.map((y, i): LinePoint => [i * 7, y]);
    for (const [y0, c1, c2, y1] of cubics(monotonePath(pts))) {
      const lo = Math.min(y0, y1) - 0.01;
      const hi = Math.max(y0, y1) + 0.01;
      expect(c1).toBeGreaterThanOrEqual(lo);
      expect(c1).toBeLessThanOrEqual(hi);
      expect(c2).toBeGreaterThanOrEqual(lo);
      expect(c2).toBeLessThanOrEqual(hi);
    }
  });

  it('breaks the line at a gap and draws a lone point as a zero-length subpath', () => {
    expect(monotonePath([[0, 10], [25, 20], null, [75, 30], [100, 40]])).toBe('M0,10L25,20M75,30L100,40');
    expect(monotonePath([[0, 10], null, [50, 20], null])).toBe('M0,10h0M50,20h0');
    expect(monotonePath([null, null])).toBe('');
    expect(lineRuns([[0, 1], [1, Number.NaN] as never, [2, 3]])).toEqual([[[0, 1]], [[2, 3]]]);
  });

  it('closes the area to the base per run, skipping lone points', () => {
    expect(
      monotoneArea(
        [
          [0, 50],
          [100, 20],
        ],
        100,
      ),
    ).toBe('M0,50L100,20L100,100L0,100Z');
    const gapped = monotoneArea([[0, 50], [20, 40], null, [60, 10], null, [100, 30]], 100);
    expect(gapped.match(/Z/g)).toHaveLength(1);
    expect(gapped).toBe('M0,50L20,40L20,100L0,100Z');
  });
});

describe('niceTicks', () => {
  it('picks 1 / 2 / 2.5 / 5 × 10ⁿ steps with ends at or beyond the data', () => {
    expect(niceTicks(61, 68, 4)).toEqual({ min: 60, max: 68, step: 2, ticks: [60, 62, 64, 66, 68] });
    expect(niceTicks(55, 80, 4).ticks).toEqual([50, 60, 70, 80]);
    expect(niceTicks(0, 1_830_000, 4).ticks).toEqual([0, 500_000, 1_000_000, 1_500_000, 2_000_000]);
    expect(niceTicks(0.12, 0.47, 3).ticks).toEqual([0, 0.2, 0.4, 0.6]);
    expect(niceTicks(-3.2, 4.1, 4).ticks).toEqual([-4, -2, 0, 2, 4, 6]);
  });

  it('opens room around a single value, swaps reversed ends and survives junk', () => {
    expect(niceTicks(5, 5).ticks).toEqual([4.5, 4.75, 5, 5.25, 5.5]);
    expect(niceTicks(0, 0).ticks).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(niceTicks(10, 2).ticks).toEqual([2, 4, 6, 8, 10]);
    expect(niceTicks(Number.NaN, Number.NaN).ticks).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(niceTicks(0, 10, 0).ticks).toHaveLength(5);
  });

  it('writes ticks short and values grouped', () => {
    expect([60, 62.5, 65].map((v) => fmtLineTick(v, 2.5))).toEqual(['60', '62.5', '65']);
    expect([0, 500_000, 1_500_000].map((v) => fmtLineTick(v, 500_000))).toEqual(['0', '500K', '1.5M']);
    expect(fmtLineTick(0.25, 0.05)).toBe('0.25');
    expect(fmtLineTick(1500, 500)).toBe('1,500');
    expect(fmtLineValue(1_204_000)).toBe('1,204,000');
    expect(fmtLineValue(182.456)).toBe('182.46');
    expect(fmtLineValue(4.2, 2)).toBe('4.20');
  });
});

describe('model helpers', () => {
  it('thins x labels by count: about 10 wide, half of those narrow, the latest always shown', () => {
    const lv = xLabelLevels(30);
    expect(lv.filter((l) => l > 0)).toHaveLength(8);
    expect(lv.filter((l) => l === 2)).toHaveLength(4);
    expect(xLabelLevels(90).filter((l) => l > 0).length).toBeLessThanOrEqual(10);
    expect(xLabelLevels(90).filter((l) => l === 2).length).toBeLessThanOrEqual(5);
    expect(lv[29]).toBe(2);
    expect(xLabelLevels(5)).toEqual([2, 1, 2, 1, 2]);
    expect(xLabelLevels(0)).toEqual([]);
  });

  it('defaults styles and tones, pads short series with gaps and widens the axis to yMin and the band', () => {
    const m = lineChartModel({
      labels: ['a', 'b', 'c'],
      series: [
        { id: 'x', label: 'X', values: [3, 4] },
        { id: 'x', label: 'dup', values: [1, 'nope' as never, 2], tone: 'url(x)' as never, style: 'zigzag' as never },
      ],
      band: { min: 2, max: 9 },
      yMin: 0,
    });
    expect(m.series.map((s) => [s.id, s.style, s.tone])).toEqual([
      ['x', 'area', 'accent'],
      ['x#2', 'dashed', 'muted'],
    ]);
    expect(m.series[0].values).toEqual([3, 4, null]);
    expect(m.series[1].values).toEqual([1, null, 2]);
    expect(m.scale.min).toBe(0);
    expect(m.scale.max).toBeGreaterThanOrEqual(9);
    expect(m.decimals).toBe(0);
    expect(nearestIndex(0.49, 3)).toBe(1);
    expect(nearestIndex(2, 3)).toBe(2);
    expect(nearestIndex(Number.NaN, 3)).toBe(0);
  });
});

describe('<ui-line-chart> rendering', () => {
  it('draws one line per series, an area for the first, and dashed for the rest', () => {
    const el = mount(RATE);
    expect(qa(el, '.lc-line')).toHaveLength(2);
    expect(qa(el, '.lc-area')).toHaveLength(1);
    expect(qa(el, '.lc-grad')).toHaveLength(1);
    expect(q(el, '.lc-area')?.getAttribute('fill')).toBe('url(#lc-g-0)');
    // The current period is drawn last, so it sits on top.
    expect(qa(el, '.lc-line').map((l) => l.dataset.mk)).toEqual(['l:before', 'l:now']);
    expect(q(el, '.lc-line[data-mk="l:before"]')?.dataset.style).toBe('dashed');
    expect(q(el, '.lc-line[data-mk="l:now"]')?.dataset.style).toBe('area');
    expect(q(el, '.lc-line[data-mk="l:now"]')?.style.getPropertyValue('--c')).toBe('var(--accent)');
    const svg = el.shadowRoot!.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 100 100');
    expect(svg.getAttribute('preserveAspectRatio')).toBe('none');
    expect(styles).toContain('vector-effect: non-scaling-stroke');
    expect(qa(el, '.lc-legend .lc-sw').map((s) => s.dataset.style)).toEqual(['area', 'dashed', undefined]);
  });

  it('places nice y ticks on gridlines and every x label by percent', () => {
    const el = mount(RATE);
    expect(qa(el, '.lc-yl').map((s) => s.textContent)).toEqual(['50', '60', '70', '80']);
    expect(qa(el, '.lc-gl')).toHaveLength(4);
    expect(qa(el, '.lc-gl.is-base')).toHaveLength(1);
    const xs = qa(el, '.lc-xl');
    expect(xs.map((x) => x.textContent)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    expect(xs.map((x) => x.style.left)).toEqual(['0%', '25%', '50%', '75%', '100%']);
    expect([xs[0].dataset.edge, xs[2].dataset.edge, xs[4].dataset.edge]).toEqual(['start', undefined, 'end']);
    expect(styles).toContain('container-type: inline-size');
    expect(styles).toMatch(/@container \(max-width: 479px\)[^}]*\.lc-xl\[data-x="1"\]/);
  });

  it('draws the band and names it in the legend with its range and unit', () => {
    const el = mount(RATE);
    const band = q(el, '.lc-band')!;
    expect(band.style.bottom).toBe('16.667%');
    expect(band.style.height).toBe('83.333%');
    expect(q(el, '.lc-band-l')?.textContent).toBe('Usual range 55–80 bpm');
    const named = mount({ ...RATE, band: { min: 120, max: 220, label: 'Normal' }, unit: 'ms' });
    expect(q(named, '.lc-band-l')?.textContent).toBe('Normal 120–220 ms');
    expect(q(mount({ ...RATE, band: undefined }), '.lc-band')).toBeNull();
  });

  it('shows the summary figures row with tones', () => {
    const el = mount(RATE);
    const figs = qa(el, '.lc-fig');
    expect(figs.map((f) => f.querySelector('dt')?.textContent)).toEqual(['Average', 'Lowest', 'Days in range']);
    expect(figs.map((f) => f.querySelector('.lc-fig-v')?.textContent)).toEqual(['64', '61', '5']);
    expect(figs.map((f) => f.querySelector('.lc-fig-u')?.textContent)).toEqual(['bpm', 'bpm', 'of 5']);
    expect(figs.map((f) => f.dataset.tone)).toEqual(['accent', undefined, 'done']);
    expect(q(mount({ ...RATE, summary: undefined }), '.lc-sum')).toBeNull();
  });

  it('is a focusable group named by the label and described by a summary and a hint', () => {
    const el = mount(RATE);
    const p = plot(el);
    expect(p.getAttribute('role')).toBe('group');
    expect(p.getAttribute('tabindex')).toBe('0');
    expect(p.getAttribute('aria-label')).toBe('Resting rate');
    expect(q(el, '#lc-desc')?.textContent).toBe(
      '5 points, Mon to Fri. Rate: low 61 bpm, high 68 bpm, latest 63 bpm. 30 days before: low 60 bpm, high 63 bpm, latest 61 bpm. Usual range 55–80 bpm.',
    );
    expect(q(el, '#lc-hint')?.textContent).toContain('arrow keys');
    expect(p.getAttribute('aria-describedby')).toBe('lc-desc lc-hint');
    expect(live(el).getAttribute('aria-live')).toBe('polite');
    expect(plot(mount({ ...RATE, label: undefined })).getAttribute('aria-label')).toBe('Line chart');
  });

  it('breaks the line on null and says no data for that point', () => {
    const el = mount({
      unit: 's',
      labels: ['01:00', '02:00', '03:00', '04:00', '05:00'],
      series: [{ id: 'run', label: 'Duration', values: [42, 45, null, 41, 44], style: 'line', tone: 'run' }],
    });
    expect(q(el, '.lc-line')?.getAttribute('d')?.match(/M/g)).toHaveLength(2);
    expect(q(el, '.lc-area')).toBeNull();
    plot(el).focus();
    key(plot(el), 'ArrowRight');
    key(plot(el), 'ArrowRight');
    key(plot(el), 'ArrowRight');
    expect(el.activeIndex).toBe(2);
    expect(q(el, '.lc-tip-row')?.hasAttribute('data-none')).toBe(true);
    expect(q(el, '.lc-tip-v')?.textContent).toBe('no data');
    expect(q(el, '.lc-dot')?.hidden).toBe(true);
    expect(live(el).textContent).toBe('03:00: Duration no data');
  });

  it('shows the empty state when no value is finite', () => {
    for (const data of [
      { labels: [], series: [] },
      { labels: ['a', 'b'], series: [{ id: 'x', label: 'X', values: [null, null] }] },
    ] as LineChartData[]) {
      const el = mount(data);
      expect(q(el, '.lc')?.dataset.state).toBe('empty');
      expect(q(el, '.lc-empty')?.textContent).toBe('No data yet');
      expect(qa(el, '.lc-yl')).toHaveLength(0);
      expect(qa(el, '.lc-line')).toHaveLength(0);
      expect(q(el, '.lc-x')).toBeNull();
      expect(q(el, '.lc-legend')).toBeNull();
      expect(plot(el).hasAttribute('tabindex')).toBe(false);
    }
    expect(q(mount({ labels: [], series: [], empty: 'No cron runs yet' }), '.lc-empty')?.textContent).toBe(
      'No cron runs yet',
    );
  });

  it('patches in place: a new reading keeps the path nodes', () => {
    const el = mount(RATE);
    const line = q(el, '.lc-line[data-mk="l:now"]');
    const before = line?.getAttribute('d');
    el.data = { ...RATE, series: [{ ...RATE.series[0], values: [70, 64, 61, 68, 63] }, RATE.series[1]] };
    el.renderNow();
    expect(q(el, '.lc-line[data-mk="l:now"]')).toBe(line);
    expect(line?.getAttribute('d')).not.toBe(before);
  });
});

describe('<ui-line-chart> interaction', () => {
  it('moves the active point with ← → Home End, shows the tooltip and speaks it', () => {
    const el = mount(RATE);
    plot(el).focus();
    expect(tip(el).classList.contains('is-open')).toBe(false);
    const ev = key(plot(el), 'ArrowRight');
    expect(ev.defaultPrevented).toBe(true);
    expect(el.activeIndex).toBe(0);
    expect(tip(el).classList.contains('is-open')).toBe(true);
    expect(tip(el).getAttribute('aria-hidden')).toBe('true');
    expect(q(el, '.lc-tip-h')?.textContent).toBe('Mon');
    expect(qa(el, '.lc-tip-row').map((r) => r.textContent)).toEqual(['Rate62 bpm', '30 days before60 bpm']);
    expect(live(el).textContent).toBe('Mon: Rate 62 bpm, 30 days before 60 bpm');
    expect(q(el, '.lc-hot')?.hasAttribute('data-on')).toBe(true);
    expect(q(el, '.lc-hot')?.style.getPropertyValue('--x')).toBe('0%');
    key(plot(el), 'End');
    expect(el.activeIndex).toBe(4);
    expect(live(el).textContent).toBe('Fri: Rate 63 bpm, 30 days before 61 bpm');
    key(plot(el), 'ArrowRight');
    expect(el.activeIndex).toBe(4);
    key(plot(el), 'ArrowLeft');
    expect(el.activeIndex).toBe(3);
    expect(q(el, '.lc-dot')?.style.getPropertyValue('--y')).not.toBe('');
    key(plot(el), 'Home');
    expect(el.activeIndex).toBe(0);
  });

  it('puts the tooltip on the side of the plot away from the dots', () => {
    const el = mount({
      labels: ['a', 'b', 'c'],
      series: [{ id: 'x', label: 'X', values: [10, 90, 10] }],
      yMin: 0,
      yMax: 100,
    });
    plot(el).focus();
    key(plot(el), 'Home');
    expect(tip(el).dataset.edge).toBe('top');
    key(plot(el), 'ArrowRight');
    expect(tip(el).dataset.edge).toBe('bottom');
  });

  it('starts from the end with ←, keeps the point through a re-render, and hides on Esc', () => {
    const el = mount(RATE);
    const outer = vi.fn();
    const onKey = (e: Event) => {
      if ((e as KeyboardEvent).key === 'Escape') outer();
    };
    document.body.addEventListener('keydown', onKey);
    plot(el).focus();
    key(plot(el), 'ArrowLeft');
    expect(el.activeIndex).toBe(4);
    el.data = { ...RATE };
    el.renderNow();
    expect(tip(el).classList.contains('is-open')).toBe(true);
    expect(el.shadowRoot!.activeElement).toBe(plot(el));
    key(plot(el), 'Escape');
    expect(tip(el).classList.contains('is-open')).toBe(false);
    expect(el.activeIndex).toBe(-1);
    expect(outer).not.toHaveBeenCalled();
    key(plot(el), 'Escape');
    expect(outer).toHaveBeenCalledTimes(1);
    document.body.removeEventListener('keydown', onKey);
  });

  it('hides the keyboard point when focus leaves', () => {
    const el = mount(RATE);
    const outside = document.createElement('button');
    document.body.append(outside);
    plot(el).focus();
    key(plot(el), 'ArrowRight');
    outside.focus();
    expect(el.activeIndex).toBe(-1);
    expect(tip(el).classList.contains('is-open')).toBe(false);
  });

  it('follows the pointer to the nearest point and hides when it leaves', () => {
    const el = mount(RATE);
    sized(el);
    move(plot(el), 160);
    expect(el.activeIndex).toBe(2);
    expect(q(el, '.lc-tip-h')?.textContent).toBe('Wed');
    move(plot(el), 290);
    expect(el.activeIndex).toBe(4);
    el.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    expect(el.activeIndex).toBe(-1);
    expect(tip(el).classList.contains('is-open')).toBe(false);
  });

  it('keeps a tapped point after the finger lifts, until a tap outside', () => {
    const el = mount(RATE);
    sized(el);
    plot(el).dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 80, pointerType: 'touch', bubbles: true, composed: true }),
    );
    el.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'touch' }));
    expect(el.activeIndex).toBe(1);
    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true, composed: true }),
    );
    expect(el.activeIndex).toBe(-1);
  });

  it('sends a cancelable, composed ui-select { index, label } on Enter, Space and click', () => {
    const el = mount(RATE);
    sized(el);
    const got: CustomEvent[] = [];
    el.addEventListener('ui-select', (e) => got.push(e as CustomEvent));
    plot(el).focus();
    key(plot(el), 'Enter');
    expect(got).toHaveLength(0);
    key(plot(el), 'ArrowRight');
    key(plot(el), 'ArrowRight');
    const enter = key(plot(el), 'Enter');
    expect(enter.defaultPrevented).toBe(true);
    key(plot(el), ' ');
    plot(el).dispatchEvent(new MouseEvent('click', { clientX: 300, bubbles: true, composed: true }));
    expect(got.map((e) => e.detail)).toEqual([
      { index: 1, label: 'Tue' },
      { index: 1, label: 'Tue' },
      { index: 4, label: 'Fri' },
    ]);
    expect(got.every((e) => e.cancelable && e.composed && e.bubbles)).toBe(true);
  });

  it('ignores keys and clicks on an empty chart', () => {
    const el = mount({ labels: [], series: [] });
    const got = vi.fn();
    el.addEventListener('ui-select', got);
    plot(el).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    key(plot(el), 'ArrowRight');
    expect(got).not.toHaveBeenCalled();
    expect(el.activeIndex).toBe(-1);
  });
});

describe('<ui-line-chart> escaping, language, tokens', () => {
  it('escapes the label, x labels, series labels and ids, unit, band label, summary and empty text', () => {
    const el = mount({
      label: XSS,
      unit: BREAK,
      labels: [XSS, BREAK],
      series: [
        { id: BREAK, label: XSS, values: [1, 2] },
        { id: 'b', label: BREAK, values: [2, 1] },
      ],
      band: { min: 1, max: 2, label: XSS },
      summary: [{ label: XSS, value: BREAK, unit: XSS }],
    });
    plot(el).focus();
    key(plot(el), 'ArrowRight');
    expect(q(el, 'img')).toBeNull();
    expect(q(el, 'b')).toBeNull();
    expect(plot(el).getAttribute('aria-label')).toBe(XSS);
    expect(qa(el, '.lc-xl').map((x) => x.textContent)).toEqual([XSS, BREAK]);
    expect(qa(el, '.lc-legend li span').map((s) => s.textContent)).toEqual([XSS, BREAK, `${XSS} 1–2 ${BREAK}`]);
    expect(q(el, '.lc-tip-h')?.textContent).toBe(XSS);
    expect(qa(el, '.lc-tip-l').map((s) => s.textContent)).toEqual([XSS, BREAK]);
    expect(q(el, '.lc-tip-v')?.textContent).toBe(`1 ${BREAK}`);
    expect(q(el, '.lc-fig dt')?.textContent).toBe(XSS);
    expect(q(el, '.lc-fig-v')?.textContent).toBe(BREAK);
    expect(q(el, '.lc-fig-u')?.textContent).toBe(XSS);
    expect(q(el, '.lc-line[data-style="area"]')?.dataset.mk).toBe(`l:${BREAK}`);
    expect(live(el).textContent).toBe(`${XSS}: ${XSS} 1 ${BREAK}, ${BREAK} 2 ${BREAK}`);
    const empty = mount({ labels: [], series: [], empty: XSS });
    expect(q(empty, 'img')).toBeNull();
    expect(q(empty, '.lc-empty')?.textContent).toBe(XSS);
  });

  it('speaks Korean with lang="ko"', () => {
    const el = mount(
      {
        label: '일별 토큰',
        unit: '토큰',
        labels: ['11/7', '11/8', '11/9'],
        series: [
          { id: 'now', label: '이번 기간', values: [1200, null, 1800] },
          { id: 'prev', label: '이전 30일', values: [900, 1000, 1100] },
        ],
        band: { min: 800, max: 2000 },
      },
      { lang: 'ko' },
    );
    expect(q(el, '#lc-desc')?.textContent).toBe(
      '3개 지점, 11/7부터 11/9까지. 이번 기간: 최저 1,200 토큰, 최고 1,800 토큰, 최근 1,800 토큰. 이전 30일: 최저 900 토큰, 최고 1,100 토큰, 최근 1,100 토큰. 정상 범위 800–2,000 토큰.',
    );
    expect(q(el, '#lc-hint')?.textContent).toBe('왼쪽·오른쪽 화살표 키로 각 지점의 값을 읽을 수 있습니다.');
    expect(q(el, '.lc-band-l')?.textContent).toBe('정상 범위 800–2,000 토큰');
    plot(el).focus();
    key(plot(el), 'ArrowRight');
    key(plot(el), 'ArrowRight');
    expect(live(el).textContent).toBe('11/8: 이번 기간 데이터 없음, 이전 30일 1,000 토큰');
    expect(q(el, '.lc-tip-v')?.textContent).toBe('데이터 없음');
    expect(q(mount({ labels: [], series: [] }, { lang: 'ko' }), '.lc-empty')?.textContent).toBe(
      '아직 데이터가 없습니다',
    );
    expect(plot(mount({ ...RATE, label: undefined }, { lang: 'ko' })).getAttribute('aria-label')).toBe('꺾은선 차트');
  });

  it('re-renders when lang changes', async () => {
    const el = mount({ labels: [], series: [] });
    el.setAttribute('lang', 'ko');
    await Promise.resolve();
    expect(q(el, '.lc-empty')?.textContent).toBe('아직 데이터가 없습니다');
  });

  it('uses token colours only and never takes a raw colour', () => {
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    expect(styles).toContain('--line-chart-h, 220px');
    const el = mount({
      labels: ['a', 'b'],
      series: [{ id: 'x', label: 'X', values: [1, 2], tone: 'red;x:url(y)' as never }],
    });
    expect(el.shadowRoot!.innerHTML).not.toContain('url(y)');
    expect(q(el, '.lc-line')?.style.getPropertyValue('--c')).toBe('var(--accent)');
  });
});

describe('docs', () => {
  it('builds every demo, each with a chart that renders', async () => {
    const { doc } = await import('./docs');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const demo of doc.demos) {
      const box = demo.create();
      document.body.append(box);
      const charts = (
        box.localName === 'ui-line-chart' ? [box] : Array.from(box.querySelectorAll('ui-line-chart'))
      ) as UiLineChart[];
      expect(charts).toHaveLength(1);
      charts[0].renderNow();
      expect(charts[0].shadowRoot!.querySelector('.lc')).not.toBeNull();
    }
  });
});
