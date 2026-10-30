import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UiBarChart } from './bar-chart';
import './bar-chart';
import {
  BAR_PALETTE,
  type BarChartData,
  barChartModel,
  barLabelShown,
  barScale,
  fmtBarTick,
  fmtBarValue,
  labelStride,
  niceScale,
} from './logic';
import { styles } from './styles';

function mount(data: BarChartData, attrs: Record<string, string> = {}): UiBarChart {
  const el = document.createElement('ui-bar-chart') as UiBarChart;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = (el: UiBarChart, s: string) => el.shadowRoot!.querySelector<HTMLElement>(s);
const qa = (el: UiBarChart, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const bars = (el: UiBarChart) => qa(el, '.bc-bar');
const tip = (el: UiBarChart) => q(el, '.bc-tip')!;
const key = (t: HTMLElement, k: string) => {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true });
  t.dispatchEvent(ev);
  return ev;
};
const over = (t: Element, pointerType = 'mouse') =>
  t.dispatchEvent(new PointerEvent('pointerover', { pointerType, bubbles: true, composed: true }));

const SESSIONS: BarChartData = {
  title: 'Sessions · last 3 days',
  unit: 'sessions',
  bars: [
    { key: '2026-10-28', label: 'Oct 28', title: 'Wed 28 Oct', value: 5 },
    { key: '2026-10-29', label: 'Oct 29', title: 'Thu 29 Oct', value: 10 },
    { key: '2026-10-30', label: 'Oct 30', title: 'Fri 30 Oct', value: 15 },
  ],
};

const RUNS: BarChartData = {
  title: 'Runs',
  series: [
    { key: 'done', label: 'Done', color: 'done' },
    { key: 'failed', label: 'Failed', color: 'fail' },
  ],
  bars: [
    { label: 'Mon', title: 'Mon 3 Nov', values: { done: 7, failed: 5 } },
    { label: 'Tue', values: { done: 0, failed: 3 } },
    { label: 'Wed', values: { done: 4 } },
  ],
};

const XSS = '<img src=x onerror=alert(1)>';
const BREAK = '"><b>x</b>';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('niceScale', () => {
  it('picks 1 / 2 / 2.5 / 5 × 10ⁿ steps with the top at or above the max', () => {
    expect(niceScale(12, 3)).toEqual({ max: 15, step: 5, ticks: [0, 5, 10, 15] });
    expect(niceScale(100, 3)).toEqual({ max: 100, step: 50, ticks: [0, 50, 100] });
    expect(niceScale(7, 3).ticks).toEqual([0, 2.5, 5, 7.5]);
    expect(niceScale(272_300, 3).ticks).toEqual([0, 100_000, 200_000, 300_000]);
  });
  it('keeps count steps whole and fractional steps free of float noise', () => {
    expect(niceScale(7, 3, true).ticks).toEqual([0, 5, 10]);
    expect(niceScale(1, 3, true).ticks).toEqual([0, 1]);
    expect(niceScale(0.42, 3).ticks).toEqual([0, 0.2, 0.4, 0.6]);
    expect(niceScale(0.3, 3).ticks).toEqual([0, 0.1, 0.2, 0.3]);
  });
  it('gives a sensible scale for 0, negative or junk max, and clamps ticks', () => {
    expect(niceScale(0, 3)).toEqual({ max: 3, step: 1, ticks: [0, 1, 2, 3] });
    expect(niceScale(-5, 3).max).toBe(3);
    expect(niceScale(Number.NaN, 2).ticks).toEqual([0, 1, 2]);
    expect(niceScale(0, 0).ticks).toHaveLength(4);
    expect(niceScale(0, 99).ticks).toHaveLength(9);
  });
  it('counts a duration axis in whole minutes or hours', () => {
    const m = barScale(25 * 60_000, 3, 'duration');
    expect(m.ticks).toEqual([0, 600_000, 1_200_000, 1_800_000]);
    expect(m.ticks.map((t) => fmtBarTick(t, 'duration', m.max))).toEqual(['0', '10m', '20m', '30m']);
    const h = barScale(5_400_000, 3, 'duration');
    expect(h.ticks.map((t) => fmtBarTick(t, 'duration', h.max))).toEqual(['0', '0.5h', '1h', '1.5h']);
  });
});

describe('formatting', () => {
  it('writes ticks short', () => {
    expect([0, 950, 1500, 2_000_000].map((v) => fmtBarTick(v))).toEqual(['0', '950', '1.5K', '2M']);
    expect([0.5, 2, 1200].map((v) => fmtBarTick(v, 'usd'))).toEqual(['$0.50', '$2', '$1.2K']);
    expect(fmtBarTick(2.5)).toBe('2.5');
  });
  it('writes values in full for the tooltip and labels', () => {
    expect(fmtBarValue(1234)).toBe('1,234');
    expect(fmtBarValue(12_345, 'compact')).toBe('12.3K');
    expect(fmtBarValue(272_300, 'tokens')).toBe('272.3K');
    expect(fmtBarValue(4.2, 'usd')).toBe('$4.20');
    expect(fmtBarValue(562_000, 'duration')).toBe('9m 22s');
  });
});

describe('x labels', () => {
  it('labelStride thins only when labels do not fit', () => {
    expect(labelStride(14, 420, 30)).toBe(1);
    expect(labelStride(30, 300, 34)).toBe(4);
    expect(labelStride(14, 100, 45)).toBe(7);
    expect(labelStride(1, 10, 40)).toBe(1);
    expect(labelStride(14, 0, 40)).toBe(1);
  });
  it('barLabelShown counts back from the latest, keeps the first, and drops one crowding it', () => {
    const shown = (n: number, s: number) =>
      Array.from({ length: n }, (_, i) => i).filter((i) => barLabelShown(i, n, s));
    expect(shown(14, 2)).toEqual([0, 3, 5, 7, 9, 11, 13]);
    expect(shown(5, 1)).toEqual([0, 1, 2, 3, 4]);
    expect(shown(2, 9)).toEqual([0, 1]);
    expect(shown(14, 7)).toEqual([0, 13]);
  });
});

describe('barChartModel', () => {
  it('gives duplicate keys unique ids, reads missing as no data and negatives as 0', () => {
    const m = barChartModel({ bars: [{ label: 'a', value: 2 }, { label: 'a', value: -4 }, { label: 'b' }] });
    expect(m.bars.map((b) => b.id)).toEqual(['a', 'a#2', 'b']);
    expect(m.bars.map((b) => b.key)).toEqual(['a', 'a', 'b']);
    expect(m.bars.map((b) => b.total)).toEqual([2, 0, 0]);
    expect(m.bars.map((b) => b.missing)).toEqual([false, false, true]);
    expect(m.empty).toBe(false);
    expect(barChartModel({ bars: [{ label: 'x', value: null }] }).empty).toBe(true);
  });
  it('drops junk series, never takes a raw colour, and fills slots from the palette in order', () => {
    const m = barChartModel({
      series: [
        { key: 'a', label: 'A' },
        { key: 'a', label: 'dup' },
        { key: 'b', label: 'B', color: 'red;background:url(x)' as never },
        { key: 'c', label: 'C', color: 'fail' },
        null as never,
      ],
      bars: [],
      format: 'nope' as never,
    });
    expect(m.series.map((s) => [s.key, s.color])).toEqual([
      ['a', BAR_PALETTE[0]],
      ['b', BAR_PALETTE[1]],
      ['c', 'fail'],
    ]);
    expect(m.stacked).toBe(true);
    expect(m.format).toBe('int');
  });
});

describe('<ui-bar-chart> rendering', () => {
  it('draws one bar per datum, heights proportional to the nice scale', () => {
    const el = mount(SESSIONS);
    expect(bars(el)).toHaveLength(3);
    expect(qa(el, '.bc-seg').map((s) => s.style.height)).toEqual(['33.333%', '66.667%', '100%']);
    expect(qa(el, '.bc-yl').map((s) => s.textContent)).toEqual(['0', '5', '10', '15']);
    expect(qa(el, '.bc-gl')).toHaveLength(4);
    expect(qa(el, '.bc-gl.is-base')).toHaveLength(1);
    expect(qa(el, '.bc-xt').map((s) => s.textContent)).toEqual(['Oct 28', 'Oct 29', 'Oct 30']);
    expect(q(el, '.bc')?.style.getPropertyValue('--bc-h')).toBe('140px');
  });

  it('is a group named by its title, described by a summary, with labelled bars in a list', () => {
    const el = mount(SESSIONS);
    const g = q(el, '.bc')!;
    expect(g.getAttribute('role')).toBe('group');
    expect(q(el, `#${g.getAttribute('aria-labelledby')}`)?.textContent).toBe('Sessions · last 3 days');
    expect(q(el, `#${g.getAttribute('aria-describedby')}`)?.textContent).toBe(
      '3 bars · highest Fri 30 Oct, 15 sessions · total 30 sessions',
    );
    expect(q(el, '.bc-bars')?.getAttribute('role')).toBe('list');
    expect(qa(el, '.bc-slot').every((s) => s.getAttribute('role') === 'listitem')).toBe(true);
    expect(bars(el).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Wed 28 Oct: 5 sessions',
      'Thu 29 Oct: 10 sessions',
      'Fri 30 Oct: 15 sessions',
    ]);
    const untitled = mount({ bars: [{ label: 'a', value: 1 }] });
    expect(q(untitled, '.bc')?.getAttribute('aria-label')).toBe('Bar chart');
  });

  it('gives a tiny value a visible minimum, leaves 0 flat and marks a missing bar', () => {
    const el = mount({
      bars: [{ label: 'a', value: 1000 }, { label: 'b', value: 1 }, { label: 'c', value: 0 }, { label: 'd' }],
    });
    const segs = qa(el, '.bc-seg');
    expect(segs.map((s) => s.hasAttribute('data-nz'))).toEqual([true, true, false, false]);
    expect(bars(el)[3].hasAttribute('data-missing')).toBe(true);
    expect(bars(el)[3].getAttribute('aria-label')).toBe('d: No data');
  });

  it('stacks series bottom to top: only the top segment rounds, upper segments carry the gap', () => {
    const el = mount(RUNS);
    const first = qa(el, '.bc-bar')[0].querySelectorAll<HTMLElement>('.bc-seg');
    expect(Array.from(first).map((s) => s.dataset.mk)).toEqual(['s:done', 's:failed']);
    expect(first[0].style.getPropertyValue('--c')).toBe('var(--st-done)');
    expect(first[1].style.getPropertyValue('--c')).toBe('var(--st-fail)');
    expect([first[0].hasAttribute('data-top'), first[1].hasAttribute('data-top')]).toEqual([false, true]);
    expect([first[0].hasAttribute('data-gap'), first[1].hasAttribute('data-gap')]).toEqual([false, true]);
    // Tue: done 0, failed 3 → the failed segment is on the baseline: no gap, rounded.
    const tue = qa(el, '.bc-bar')[1].querySelectorAll<HTMLElement>('.bc-seg');
    expect([tue[1].hasAttribute('data-gap'), tue[1].hasAttribute('data-top')]).toEqual([false, true]);
    expect(qa(el, '.bc-legend li').map((li) => li.textContent)).toEqual(['Done', 'Failed']);
    expect(bars(el)[0].getAttribute('aria-label')).toBe('Mon 3 Nov: 7 Done, 5 Failed, 12 total');
    expect(bars(el)[2].getAttribute('aria-label')).toBe('Wed: 4 Done, 0 Failed, 4 total');
  });

  it('uses the default palette for stacked series and spark for one series, no legend without series', () => {
    const el = mount({
      series: [
        { key: 'a', label: 'A' },
        { key: 'b', label: 'B' },
      ],
      bars: [{ label: 'x', values: { a: 1, b: 2 } }],
    });
    expect(qa(el, '.bc-seg').map((s) => s.style.getPropertyValue('--c'))).toEqual([
      'var(--ib-spark)',
      'var(--st-wait)',
    ]);
    const one = mount(SESSIONS);
    expect(q(one, '.bc-seg')?.style.getPropertyValue('--c')).toBe('var(--ib-spark)');
    expect(q(one, '.bc-legend')).toBeNull();
  });

  it('data.color colours a single series without a legend; series wins; raw CSS is never taken', () => {
    const one = mount({ ...SESSIONS, color: 'purple' });
    expect(qa(one, '.bc-seg').every((s) => s.style.getPropertyValue('--c') === 'var(--purple)')).toBe(true);
    expect(q(one, '.bc-legend')).toBeNull();
    const raw = mount({ ...SESSIONS, color: 'red; background: url(x)' as never });
    expect(q(raw, '.bc-seg')?.style.getPropertyValue('--c')).toBe('var(--ib-spark)');
    const given = mount({ ...SESSIONS, color: 'purple', series: [{ key: 'v', label: 'V', color: 'done' }] });
    expect(
      barChartModel({ ...SESSIONS, color: 'purple', series: [{ key: 'v', label: 'V', color: 'done' }] }).series[0]
        .color,
    ).toBe('done');
    expect(q(given, '.bc-legend')).not.toBeNull();
  });

  it('shows the empty state inside the plot with the axis hidden', () => {
    for (const data of [{ bars: [] }, { bars: [{ label: 'a' }, { label: 'b', value: null }] }] as BarChartData[]) {
      const el = mount(data);
      expect(q(el, '.bc')?.dataset.state).toBe('empty');
      expect(q(el, '.bc-empty')?.textContent).toBe('No data for this period');
      expect(bars(el)).toHaveLength(0);
      expect(qa(el, '.bc-yl')).toHaveLength(0);
      expect(qa(el, '.bc-gl')).toHaveLength(0);
      expect(q(el, '.bc-x')).toBeNull();
    }
    expect(q(mount({ bars: [], empty: 'Nothing yet' }), '.bc-empty')?.textContent).toBe('Nothing yet');
  });

  it('pulses skeleton bars while loading, and dims the old bars during a refetch', () => {
    const el = mount({ bars: [], loading: true });
    expect(q(el, '.bc')?.getAttribute('aria-busy')).toBe('true');
    expect(q(el, '.bc')?.dataset.state).toBe('loading');
    expect(qa(el, '.bc-sk').length).toBeGreaterThanOrEqual(4);
    expect(bars(el)).toHaveLength(0);
    expect(q(el, '#bc-sum')?.textContent).toBe('Loading…');
    const refetch = mount({ ...SESSIONS, loading: true });
    expect(q(refetch, '.bc')?.dataset.state).toBe('ready');
    expect(q(refetch, '.bc')?.getAttribute('aria-busy')).toBe('true');
    expect(bars(refetch)).toHaveLength(3);
  });

  it('keeps bar nodes across data changes, so heights glide; transitions turn on after the first paint', async () => {
    const el = mount(SESSIONS);
    expect(q(el, '.bc')?.hasAttribute('data-anim')).toBe(false);
    const before = bars(el)[1];
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(q(el, '.bc')?.hasAttribute('data-anim')).toBe(true);
    el.data = { ...SESSIONS, bars: SESSIONS.bars.map((b, i) => ({ ...b, value: i === 1 ? 30 : b.value })) };
    el.renderNow();
    expect(bars(el)[1]).toBe(before);
    expect(q(el, '.bc')?.hasAttribute('data-anim')).toBe(true);
    expect(before.querySelector<HTMLElement>('.bc-seg')?.style.height).toBe('100%');
  });

  it('thins x labels from the measured plot width', () => {
    const labels = Array.from({ length: 14 }, (_, i) => ({ label: `Oct ${i + 10}`, value: i }));
    const el = mount({ bars: labels });
    expect(qa(el, '.bc-xl[data-off]')).toHaveLength(0);
    Object.defineProperty(q(el, '.bc-bars')!, 'clientWidth', { value: 100, configurable: true });
    el.renderNow();
    const shown = qa(el, '.bc-xl').flatMap((x, i) => (x.hasAttribute('data-off') ? [] : [i]));
    expect(shown).toEqual([0, 13]);
  });
});

describe('<ui-bar-chart> hover and focus', () => {
  it('shows the tooltip on hover: the hot bar stays, the others dim; leaving hides it', () => {
    const el = mount(SESSIONS);
    over(bars(el)[1]);
    expect(tip(el).classList.contains('is-open')).toBe(true);
    expect(tip(el).getAttribute('aria-hidden')).toBe('true');
    expect(q(el, '.bc-tip-h')?.textContent).toBe('Thu 29 Oct');
    expect(q(el, '.bc-tip-l')?.textContent).toBe('sessions');
    expect(q(el, '.bc-tip-v')?.textContent).toBe('10');
    expect(q(el, '.bc-bars')?.hasAttribute('data-hot')).toBe(true);
    expect(bars(el).map((b) => b.hasAttribute('data-on'))).toEqual([false, true, false]);
    over(bars(el)[2]);
    expect(q(el, '.bc-tip-h')?.textContent).toBe('Fri 30 Oct');
    el.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    expect(tip(el).classList.contains('is-open')).toBe(false);
    expect(q(el, '.bc-bars')?.hasAttribute('data-hot')).toBe(false);
  });

  it('lists every series and the total for a stacked bar, and says No data for a missing one', () => {
    const el = mount({ ...RUNS, bars: [...RUNS.bars, { label: 'Thu' }] });
    over(bars(el)[0]);
    expect(qa(el, '.bc-tip-row').map((r) => r.textContent)).toEqual(['Done7', 'Failed5', 'Total12']);
    expect(q(el, '.bc-tip-row.is-total .bc-sw')).toBeNull();
    over(bars(el)[3]);
    expect(q(el, '.bc-tip-none')?.textContent).toBe('No data');
  });

  it('keeps the hover through a re-render (live data) without closing the tooltip', () => {
    const el = mount(SESSIONS);
    over(bars(el)[0]);
    el.data = { ...SESSIONS, bars: SESSIONS.bars.map((b) => ({ ...b, value: (b.value ?? 0) + 1 })) };
    el.renderNow();
    expect(tip(el).classList.contains('is-open')).toBe(true);
    expect(q(el, '.bc-tip-v')?.textContent).toBe('6');
    expect(bars(el)[0].hasAttribute('data-on')).toBe(true);
  });

  it('shows the tooltip on keyboard focus and hides it when focus leaves', () => {
    const el = mount(SESSIONS);
    const outside = document.createElement('button');
    document.body.append(outside);
    bars(el)[0].focus();
    expect(tip(el).classList.contains('is-open')).toBe(true);
    expect(q(el, '.bc-tip-h')?.textContent).toBe('Wed 28 Oct');
    outside.focus();
    expect(tip(el).classList.contains('is-open')).toBe(false);
  });

  it('does not open a focus tooltip for a pointer press (the pointer shows its own)', () => {
    const el = mount(SESSIONS);
    bars(el)[1].dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', bubbles: true, composed: true }));
    bars(el)[1].focus();
    expect(tip(el).classList.contains('is-open')).toBe(false);
  });

  it('keeps a tapped bar’s tooltip after the finger lifts, until a tap outside', () => {
    const el = mount(SESSIONS);
    const b = bars(el)[2];
    over(b, 'touch');
    b.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true, composed: true }));
    el.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'touch' }));
    expect(tip(el).classList.contains('is-open')).toBe(true);
    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true, composed: true }),
    );
    expect(tip(el).classList.contains('is-open')).toBe(false);
  });

  it('Esc hides a shown tooltip (and stops there); otherwise it passes through', () => {
    const el = mount(SESSIONS);
    const outer = vi.fn();
    document.body.addEventListener('keydown', outer);
    bars(el)[0].focus();
    key(bars(el)[0], 'Escape');
    expect(tip(el).classList.contains('is-open')).toBe(false);
    expect(outer).not.toHaveBeenCalled();
    key(bars(el)[0], 'Escape');
    expect(outer).toHaveBeenCalledTimes(1);
    document.body.removeEventListener('keydown', outer);
  });
});

describe('<ui-bar-chart> keyboard and ui-select', () => {
  it('has one tab stop and moves it with ← → Home End', () => {
    const el = mount(SESSIONS);
    const stops = () => bars(el).map((b) => b.getAttribute('tabindex'));
    expect(stops()).toEqual(['0', '-1', '-1']);
    bars(el)[0].focus();
    key(bars(el)[0], 'ArrowRight');
    expect(el.shadowRoot!.activeElement).toBe(bars(el)[1]);
    expect(stops()).toEqual(['-1', '0', '-1']);
    expect(q(el, '.bc-tip-h')?.textContent).toBe('Thu 29 Oct');
    key(bars(el)[1], 'End');
    expect(el.shadowRoot!.activeElement).toBe(bars(el)[2]);
    key(bars(el)[2], 'ArrowRight');
    expect(el.shadowRoot!.activeElement).toBe(bars(el)[2]);
    key(bars(el)[2], 'Home');
    expect(el.shadowRoot!.activeElement).toBe(bars(el)[0]);
    const ev = key(bars(el)[0], 'ArrowLeft');
    expect(ev.defaultPrevented).toBe(true);
    expect(el.shadowRoot!.activeElement).toBe(bars(el)[0]);
  });

  it('keeps focus and the tab stop on the same bar through a re-render', () => {
    const el = mount(SESSIONS);
    bars(el)[0].focus();
    key(bars(el)[0], 'ArrowRight');
    el.data = { ...SESSIONS };
    el.renderNow();
    expect(el.shadowRoot!.activeElement).toBe(bars(el)[1]);
    expect(bars(el)[1].getAttribute('tabindex')).toBe('0');
  });

  it('sends a cancelable, composed ui-select on Enter, Space and click', () => {
    const el = mount(SESSIONS);
    const got: CustomEvent[] = [];
    el.addEventListener('ui-select', (e) => got.push(e as CustomEvent));
    key(bars(el)[1], 'Enter');
    key(bars(el)[2], ' ');
    bars(el)[0].click();
    expect(got.map((e) => e.detail)).toEqual([
      { key: '2026-10-29', index: 1 },
      { key: '2026-10-30', index: 2 },
      { key: '2026-10-28', index: 0 },
    ]);
    expect(got.every((e) => e.cancelable && e.composed && e.bubbles)).toBe(true);
    const labelOnly = mount({ bars: [{ label: 'Mon', value: 1 }] });
    let detail: unknown;
    labelOnly.addEventListener('ui-select', (e) => {
      detail = (e as CustomEvent).detail;
    });
    bars(labelOnly)[0].click();
    expect(detail).toEqual({ key: 'Mon', index: 0 });
  });

  it('moves the selection mark in selection mode unless the listener cancels', () => {
    const el = mount({ ...SESSIONS, selected: '2026-10-28' });
    const current = () => bars(el).map((b) => b.getAttribute('aria-current'));
    expect(current()).toEqual(['true', null, null]);
    expect(qa(el, '.bc-xl[data-sel]')).toHaveLength(1);
    bars(el)[2].click();
    el.renderNow();
    expect(current()).toEqual([null, null, 'true']);
    expect(el.data?.selected).toBe('2026-10-30');
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('ui-select', stop);
    bars(el)[1].click();
    el.renderNow();
    expect(current()).toEqual([null, null, 'true']);
    el.removeEventListener('ui-select', stop);
  });

  it('marks nothing on select when selection mode is off', () => {
    const el = mount(SESSIONS);
    bars(el)[1].click();
    el.renderNow();
    expect(bars(el).some((b) => b.hasAttribute('aria-current'))).toBe(false);
    expect(el.data?.selected).toBeUndefined();
    expect(q(el, '.bc')?.hasAttribute('data-select')).toBe(false);
  });
});

describe('<ui-bar-chart> escaping, language, tokens', () => {
  it('escapes title, labels, bar titles, series labels, unit and empty text', () => {
    const el = mount({
      title: XSS,
      unit: BREAK,
      bars: [{ key: BREAK, label: XSS, title: BREAK, value: 3 }],
    });
    over(bars(el)[0]);
    expect(q(el, 'img')).toBeNull();
    expect(q(el, 'b')).toBeNull();
    expect(q(el, '.bc-title')?.textContent).toBe(XSS);
    expect(q(el, '.bc-xt')?.textContent).toBe(XSS);
    expect(q(el, '.bc-tip-h')?.textContent).toBe(BREAK);
    expect(q(el, '.bc-tip-l')?.textContent).toBe(BREAK);
    expect(bars(el)[0].getAttribute('aria-label')).toBe(`${BREAK}: 3 ${BREAK}`);
    expect(bars(el)[0].dataset.key).toBe(BREAK);

    const st = mount({
      series: [
        { key: BREAK, label: XSS },
        { key: 'b', label: BREAK },
      ],
      bars: [{ label: 'x', values: { [BREAK]: 1, b: 2 } }],
    });
    over(bars(st)[0]);
    expect(q(st, 'img')).toBeNull();
    expect(q(st, 'b')).toBeNull();
    expect(qa(st, '.bc-legend li').map((li) => li.textContent)).toEqual([XSS, BREAK]);
    expect(qa(st, '.bc-tip-l').map((s) => s.textContent)).toEqual([XSS, BREAK, 'Total']);

    const empty = mount({ bars: [], empty: XSS });
    expect(q(empty, 'img')).toBeNull();
    expect(q(empty, '.bc-empty')?.textContent).toBe(XSS);
  });

  it('speaks Korean with lang="ko"', () => {
    const el = mount(
      {
        title: '세션 · 최근 7일',
        unit: '세션',
        bars: [
          { label: '10/29 (목)', title: '10월 29일 (목)', value: 12 },
          { label: '10/30 (금)', title: '10월 30일 (금)', value: 9 },
        ],
      },
      { lang: 'ko' },
    );
    expect(bars(el)[1].getAttribute('aria-label')).toBe('10월 30일 (금): 세션 9');
    expect(q(el, '#bc-sum')?.textContent).toBe('막대 2개 · 가장 높은 막대 10월 29일 (목), 세션 12 · 합계 세션 21');
    const st = mount(RUNS, { lang: 'ko' });
    expect(bars(st)[0].getAttribute('aria-label')).toBe('Mon 3 Nov: Done 7, Failed 5, 합계 12');
    over(bars(st)[0]);
    expect(q(st, '.bc-tip-row.is-total .bc-tip-l')?.textContent).toBe('합계');
    expect(q(mount({ bars: [] }, { lang: 'ko' }), '.bc-empty')?.textContent).toBe('이 기간에 데이터가 없습니다');
    expect(q(mount({ bars: [{ label: 'a', value: 1 }] }, { lang: 'ko' }), '.bc')?.getAttribute('aria-label')).toBe(
      '막대 차트',
    );
    expect(
      qa(mount({ bars: [{ label: 'a' }, { label: 'b', value: 1 }] }, { lang: 'ko' }), '.bc-bar')[0].getAttribute(
        'aria-label',
      ),
    ).toBe('a: 데이터 없음');
    expect(q(mount({ bars: [], loading: true }, { lang: 'ko' }), '#bc-sum')?.textContent).toBe('불러오는 중…');
  });

  it('re-renders when lang changes', async () => {
    const el = mount({ bars: [] });
    el.setAttribute('lang', 'ko');
    await Promise.resolve();
    expect(q(el, '.bc-empty')?.textContent).toBe('이 기간에 데이터가 없습니다');
  });

  it('uses token colours only', () => {
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    const el = mount({ ...RUNS, series: [{ key: 'done', label: 'Done', color: 'url(javascript:x)' as never }] });
    expect(el.shadowRoot!.innerHTML).not.toContain('javascript');
  });

  it('clamps the plot height', () => {
    expect(q(mount({ ...SESSIONS, height: 220 }), '.bc')?.style.getPropertyValue('--bc-h')).toBe('220px');
    expect(q(mount({ ...SESSIONS, height: 5 }), '.bc')?.style.getPropertyValue('--bc-h')).toBe('48px');
  });
});
