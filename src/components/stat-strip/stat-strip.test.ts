import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UiSegmented } from '../segmented/segmented';
import type { UiTooltip } from '../tooltip/tooltip';
import {
  easeOutQuart,
  fmtMetric,
  metricFormat,
  rollValue,
  STAT_ROLL_MS,
  type StatStripData,
  statMetrics,
  type UiStatStrip,
} from './stat-strip';
import { styles } from './styles';

const XSS = '<img src=x onerror=alert(1)>';
const BREAK = '"><b>x</b>';

function mount(data: StatStripData, attrs: Record<string, string> = {}, panel?: HTMLElement): UiStatStrip {
  const el = document.createElement('ui-stat-strip') as UiStatStrip;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (panel) el.append(panel);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiStatStrip, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = <E extends Element = HTMLElement>(el: UiStatStrip, s: string) =>
  Array.from(el.shadowRoot!.querySelectorAll<E>(s));
const metric = (el: UiStatStrip, key: string) => qa(el, '.ss-m').find((m) => m.dataset.metric === key)!;
const fig = (el: UiStatStrip, key: string) => metric(el, key).querySelector<HTMLElement>('.ss-fig')!;
const seg = (el: UiStatStrip) => {
  const s = q<UiSegmented>(el, 'ui-segmented')!;
  s.renderNow();
  return s;
};
const segOpts = (el: UiStatStrip) => Array.from(seg(el).shadowRoot!.querySelectorAll<HTMLElement>('.sg-opt'));

const PERIOD = {
  value: '7d',
  options: [
    { value: 'today', label: 'Today' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
  ],
};
const DATA: StatStripData = {
  period: PERIOD,
  metrics: [
    { key: 'sessions', label: 'Sessions', value: 128 },
    {
      key: 'tokens',
      label: 'Tokens',
      value: 4_630_000,
      format: 'tokens',
      breakdown: {
        title: 'Tokens by environment',
        rows: [
          { label: 'dev', value: 1_210_000 },
          { label: 'prod', value: 3_420_000 },
          { label: 'share', value: 26, format: 'percent' },
        ],
      },
    },
    { key: 'cost', label: 'Cost', value: 38.2, format: 'usd', hint: 'Estimated from list prices' },
  ],
};

let frames: Map<number, FrameRequestCallback>;
let frameId: number;
let reduce: boolean;
const cancelled: number[] = [];
/** Run the frames queued so far at time `t`. */
const frame = (t: number) => {
  const run = Array.from(frames.values());
  frames.clear();
  for (const cb of run) cb(t);
};

beforeEach(() => {
  document.body.innerHTML = '';
  frames = new Map();
  frameId = 0;
  reduce = false;
  cancelled.length = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++frameId, cb);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    cancelled.push(id);
    frames.delete(id);
  });
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('helpers', () => {
  it('fmtMetric writes every format, "—" for anything but a finite number', () => {
    expect(fmtMetric(1234567)).toBe('1,234,567');
    expect(fmtMetric(12.6, 'int')).toBe('13');
    expect(fmtMetric(12_345, 'compact')).toBe('12.3K');
    expect(fmtMetric(1_230_000_000, 'compact')).toBe('1.2B');
    expect(fmtMetric(4_630_000, 'tokens')).toBe('4.6M');
    expect(fmtMetric(950, 'tokens')).toBe('950');
    expect(fmtMetric(38.2, 'usd')).toBe('$38.20');
    expect(fmtMetric(1234.5, 'usd')).toBe('$1,234.50');
    expect(fmtMetric(-2, 'usd')).toBe('-$2.00');
    expect(fmtMetric(42.4, 'percent')).toBe('42%');
    expect(fmtMetric(7.46, 'percent')).toBe('7.5%');
    expect(fmtMetric(3, 'percent')).toBe('3%');
    expect(fmtMetric(562_000, 'duration')).toBe('9m 22s');
    expect(fmtMetric(null)).toBe('—');
    expect(fmtMetric(undefined, 'usd')).toBe('—');
    expect(fmtMetric(Number.NaN)).toBe('—');
    expect(fmtMetric('12' as never)).toBe('—');
    expect(fmtMetric(5, 'weird' as never)).toBe('5');
    expect(metricFormat('weird')).toBe('int');
    expect(metricFormat('usd')).toBe('usd');
  });

  it('fmtMetric writes durations in Korean with lang ko', () => {
    expect(fmtMetric(42_000, 'duration', 'ko')).toBe('42초');
    expect(fmtMetric(562_000, 'duration', 'ko')).toBe('9분 22초');
    expect(fmtMetric(540_000, 'duration', 'ko')).toBe('9분');
    expect(fmtMetric(8_100_000, 'duration', 'ko')).toBe('2시간 15분');
    expect(fmtMetric(7_200_000, 'duration', 'ko')).toBe('2시간');
    expect(fmtMetric(1234, 'int', 'ko')).toBe('1,234');
  });

  it('rollValue eases out (quart) from → to and clamps progress', () => {
    expect(rollValue(100, 200, 0)).toBe(100);
    expect(rollValue(100, 200, 0.5)).toBeCloseTo(193.75);
    expect(rollValue(100, 200, 1)).toBe(200);
    expect(rollValue(100, 200, 2)).toBe(200);
    expect(rollValue(100, 200, -1)).toBe(100);
    expect(rollValue(200, 100, 0.5)).toBeCloseTo(106.25);
    expect(easeOutQuart(0.25)).toBeCloseTo(1 - 0.75 ** 4);
    expect(STAT_ROLL_MS).toBe(620);
  });

  it('statMetrics drops junk, gives a missing key an index key, keeps the first of each key', () => {
    const out = statMetrics({
      metrics: [{ key: 'a', label: 'A' }, null as never, { key: 'a', label: 'A2' }, { label: 'No key' } as never],
    });
    expect(out.map((m) => [m.key, m.label])).toEqual([
      ['a', 'A'],
      ['#3', 'No key'],
    ]);
    expect(statMetrics(undefined)).toEqual([]);
  });
});

describe('<ui-stat-strip> rendering', () => {
  it('renders a named group: segmented, label · figure pairs, formatted values', () => {
    const el = mount(DATA);
    const ss = q(el, '.ss')!;
    expect(ss.getAttribute('role')).toBe('group');
    expect(ss.getAttribute('aria-label')).toBe('Usage');
    expect(ss.hasAttribute('aria-busy')).toBe(false);
    expect(q(el, 'ui-segmented')?.getAttribute('size')).toBe('sm');
    expect(qa(el, '.ss-label').map((l) => l.textContent)).toEqual(['Sessions', 'Tokens', 'Cost']);
    expect(fig(el, 'sessions').textContent).toBe('128');
    expect(fig(el, 'tokens').textContent).toBe('4.6M');
    expect(fig(el, 'cost').textContent).toBe('$38.20');
    // The figure is aria-hidden; a screen-reader copy carries the final value.
    expect(fig(el, 'sessions').getAttribute('aria-hidden')).toBe('true');
    expect(metric(el, 'sessions').querySelector('.sr-only')?.textContent).toBe('128');
    expect(q(el, '.ss-more')).toBeNull();
    expect(q(el, '.ss-region')).toBeNull();
  });

  it('uses data.label, renders without a period, and renders nothing for empty data', () => {
    const el = mount({ label: 'Weekly usage', metrics: [{ key: 'a', label: 'Runs', value: 3 }] });
    expect(q(el, '.ss')?.getAttribute('aria-label')).toBe('Weekly usage');
    expect(q(el, 'ui-segmented')).toBeNull();
    expect(q(el, '.ss-row')?.hasAttribute('data-period')).toBe(false);
    expect(q(mount({ metrics: [] }), '.ss')).toBeNull();
  });

  it('shows "—" for a null value and says "No data" to screen readers', () => {
    const el = mount({ metrics: [{ key: 'cost', label: 'Cost', value: null, format: 'usd' }] });
    const f = fig(el, 'cost');
    expect(f.textContent).toBe('—');
    expect(f.classList.contains('is-none')).toBe(true);
    expect(metric(el, 'cost').querySelector('.sr-only')?.textContent).toBe('No data');
  });

  it('data.loading puts a skeleton in every figure, keeps the labels and sets aria-busy', () => {
    const el = mount({ ...DATA, loading: true });
    expect(q(el, '.ss')?.getAttribute('aria-busy')).toBe('true');
    expect(qa(el, '.ss-sk')).toHaveLength(3);
    expect(qa(el, '.ss-fig')).toHaveLength(0);
    expect(qa(el, 'ui-tooltip')).toHaveLength(0);
    expect(qa(el, '.ss-label').map((l) => l.textContent)).toEqual(['Sessions', 'Tokens', 'Cost']);
    expect(metric(el, 'tokens').querySelector('.sr-only')?.textContent).toBe('Loading');
  });

  it('a metric loading on its own gets the only skeleton; the strip is still busy', () => {
    const el = mount({
      metrics: [
        { key: 'a', label: 'Sessions', value: 3 },
        { key: 'b', label: 'Tokens', loading: true },
      ],
    });
    expect(qa(el, '.ss-sk')).toHaveLength(1);
    expect(metric(el, 'b').querySelector('.ss-sk')).not.toBeNull();
    expect(q(el, '.ss')?.getAttribute('aria-busy')).toBe('true');
    el.data = { metrics: [{ key: 'a', label: 'Sessions', value: 3 }] };
    el.renderNow();
    expect(q(el, '.ss')?.hasAttribute('aria-busy')).toBe(false);
  });

  it('passes theme on to the inner segmented and tooltips', () => {
    const el = mount(DATA, { theme: 'dark' });
    expect(q(el, 'ui-segmented')?.getAttribute('theme')).toBe('dark');
    expect(qa(el, 'ui-tooltip').every((t) => t.getAttribute('theme') === 'dark')).toBe(true);
    el.removeAttribute('theme');
    el.renderNow();
    expect(q(el, 'ui-segmented')?.hasAttribute('theme')).toBe(false);
  });
});

describe('<ui-stat-strip> period', () => {
  it('hands options, value and the default label to the inner segmented', () => {
    const el = mount(DATA);
    const s = seg(el);
    expect(s.data?.options).toBe(PERIOD.options);
    expect(s.data?.value).toBe('7d');
    expect(s.data?.label).toBe('Period');
    expect(segOpts(el).map((b) => b.textContent)).toEqual(['Today', 'Last 7 days', 'Last 30 days']);
  });

  it('turns the inner ui-change into a cancelable ui-period; the inner event never leaves', () => {
    const el = mount(DATA);
    const period = vi.fn();
    const change = vi.fn();
    el.addEventListener('ui-period', (e) => period((e as CustomEvent).detail, e.cancelable));
    el.addEventListener('ui-change', change);
    document.addEventListener('ui-change', change);
    segOpts(el)[2].click();
    document.removeEventListener('ui-change', change);
    expect(period).toHaveBeenCalledWith({ value: '30d', previous: '7d' }, true);
    expect(change).not.toHaveBeenCalled();
    // Optimistic: the strip and its control show the new period.
    expect(el.data?.period?.value).toBe('30d');
    el.renderNow();
    expect(seg(el).data?.value).toBe('30d');
    expect(segOpts(el)[2].getAttribute('aria-checked')).toBe('true');
  });

  it('a cancelled ui-period keeps the old period in the strip and in the control', () => {
    const el = mount(DATA);
    el.addEventListener('ui-period', (e) => e.preventDefault());
    segOpts(el)[0].click();
    el.renderNow();
    expect(el.data?.period?.value).toBe('7d');
    expect(seg(el).data?.value).toBe('7d');
    expect(segOpts(el)[1].getAttribute('aria-checked')).toBe('true');
  });

  it('a listener that sets a period of its own wins', () => {
    const el = mount(DATA);
    el.addEventListener('ui-period', () => {
      el.data = { ...DATA, period: { ...PERIOD, value: 'today' } };
    });
    segOpts(el)[2].click();
    expect(el.data?.period?.value).toBe('today');
    el.renderNow();
    expect(seg(el).data?.value).toBe('today');
  });

  it('leaves ui-change from slotted host content alone', () => {
    const panel = document.createElement('div');
    const el = mount({ ...DATA, more: true }, {}, panel);
    const heard = vi.fn();
    const period = vi.fn();
    el.addEventListener('ui-change', heard);
    el.addEventListener('ui-period', period);
    panel.dispatchEvent(new CustomEvent('ui-change', { bubbles: true, composed: true, detail: { value: 'x' } }));
    expect(heard).toHaveBeenCalledTimes(1);
    expect(period).not.toHaveBeenCalled();
  });
});

describe('<ui-stat-strip> rolling figures', () => {
  it('jumps on first paint (no frame requested)', () => {
    const el = mount(DATA);
    expect(fig(el, 'sessions').textContent).toBe('128');
    expect(frames.size).toBe(0);
  });

  it('rolls a changed value in place over 620 ms, ease-out quart, then stops', () => {
    const el = mount({ metrics: [{ key: 's', label: 'Sessions', value: 100 }] });
    const node = fig(el, 's');
    el.data = { metrics: [{ key: 's', label: 'Sessions', value: 200 }] };
    el.renderNow();
    expect(fig(el, 's')).toBe(node);
    expect(node.textContent).toBe('100');
    expect(metric(el, 's').querySelector('.sr-only')?.textContent).toBe('200');
    expect(frames.size).toBe(1);
    frame(1000); // first frame: the clock starts
    expect(node.textContent).toBe('100');
    frame(1000 + STAT_ROLL_MS / 2);
    expect(node.textContent).toBe(String(Math.round(rollValue(100, 200, 0.5))));
    frame(1000 + STAT_ROLL_MS);
    expect(node.textContent).toBe('200');
    expect(frames.size).toBe(0);
  });

  it('a re-render mid-roll keeps the shown value; a new target rolls on from there', () => {
    const el = mount({ metrics: [{ key: 's', label: 'Sessions', value: 0, format: 'int' }] });
    el.data = { metrics: [{ key: 's', label: 'Sessions', value: 1000 }] };
    el.renderNow();
    frame(0);
    frame(STAT_ROLL_MS / 2);
    const mid = fig(el, 's').textContent;
    el.data = { label: 'Other', metrics: [{ key: 's', label: 'Sessions', value: 1000 }] };
    el.renderNow();
    expect(fig(el, 's').textContent).toBe(mid);
    el.data = { metrics: [{ key: 's', label: 'Sessions', value: 2000 }] };
    el.renderNow();
    frame(STAT_ROLL_MS / 2 + 1);
    expect(fig(el, 's').textContent).toBe(mid);
    frame(STAT_ROLL_MS / 2 + 1 + STAT_ROLL_MS);
    expect(fig(el, 's').textContent).toBe('2,000');
  });

  it('jumps under reduced motion', () => {
    reduce = true;
    const el = mount({ metrics: [{ key: 's', label: 'Sessions', value: 100 }] });
    el.data = { metrics: [{ key: 's', label: 'Sessions', value: 200 }] };
    el.renderNow();
    expect(fig(el, 's').textContent).toBe('200');
    expect(frames.size).toBe(0);
  });

  it('jumps on a first value after loading or no data, and on a change of format', () => {
    const el = mount({ metrics: [{ key: 's', label: 'Sessions', value: 100 }] });
    el.data = { loading: true, metrics: [{ key: 's', label: 'Sessions', value: 100 }] };
    el.renderNow();
    el.data = { metrics: [{ key: 's', label: 'Sessions', value: 500 }] };
    el.renderNow();
    expect(fig(el, 's').textContent).toBe('500');
    expect(frames.size).toBe(0);
    el.data = { metrics: [{ key: 's', label: 'Sessions', value: null }] };
    el.renderNow();
    el.data = { metrics: [{ key: 's', label: 'Sessions', value: 900 }] };
    el.renderNow();
    expect(fig(el, 's').textContent).toBe('900');
    el.data = { metrics: [{ key: 's', label: 'Sessions', value: 1_500_000, format: 'tokens' }] };
    el.renderNow();
    expect(fig(el, 's').textContent).toBe('1.5M');
    expect(frames.size).toBe(0);
  });

  it("from: 'last' keeps a figure's value under its loading bar and rolls the answer from it", () => {
    const M = (value: number | null, extra: object = {}) => ({
      metrics: [{ key: 's', label: 'Sessions', value, from: 'last' as const, ...extra }],
    });
    const el = mount(M(100));
    el.data = { ...M(100), loading: true };
    el.renderNow();
    expect(metric(el, 's').querySelector('.ss-sk')).not.toBeNull();
    expect(frames.size).toBe(0);
    el.data = M(500);
    el.renderNow();
    // The answer is read at once; the figure starts from what it showed before the bar.
    expect(metric(el, 's').querySelector('.sr-only')?.textContent).toBe('500');
    expect(fig(el, 's').textContent).toBe('100');
    expect(frames.size).toBe(1);
    frame(0);
    frame(STAT_ROLL_MS / 2);
    expect(fig(el, 's').textContent).toBe(String(Math.round(rollValue(100, 500, 0.5))));
    frame(STAT_ROLL_MS);
    expect(fig(el, 's').textContent).toBe('500');
    // A metric's own loading flag keeps it too; a load started mid-roll keeps the value on screen.
    el.data = M(900);
    el.renderNow();
    frame(1000);
    frame(1000 + STAT_ROLL_MS / 2);
    const mid = fig(el, 's').textContent;
    el.data = M(900, { loading: true });
    el.renderNow();
    el.data = M(1200);
    el.renderNow();
    expect(fig(el, 's').textContent).toBe(mid);
    frame(3000);
    frame(3000 + STAT_ROLL_MS);
    expect(fig(el, 's').textContent).toBe('1,200');
    // No data forgets it: the next value appears at once.
    el.data = M(null);
    el.renderNow();
    el.data = { ...M(null), loading: true };
    el.renderNow();
    el.data = M(70);
    el.renderNow();
    expect(fig(el, 's').textContent).toBe('70');
    expect(frames.size).toBe(0);
  });

  it('from: a number rolls a figure with nothing on screen (first paint too); jumps without it', () => {
    const el = mount({ metrics: [{ key: 's', label: 'Cost', value: 38.2, format: 'usd', from: 12.5 }] });
    expect(fig(el, 's').textContent).toBe(fmtMetric(12.5, 'usd'));
    expect(frames.size).toBe(1);
    frame(0);
    frame(STAT_ROLL_MS);
    expect(fig(el, 's').textContent).toBe(fmtMetric(38.2, 'usd'));
    // A figure already on screen rolls on from its own value, never from `from`.
    el.data = { metrics: [{ key: 's', label: 'Cost', value: 40, format: 'usd', from: 0 }] };
    el.renderNow();
    expect(fig(el, 's').textContent).toBe(fmtMetric(38.2, 'usd'));
    frame(2000);
    frame(2000 + STAT_ROLL_MS);
    // Without from, a value after loading still appears at once (unchanged default).
    el.data = { loading: true, metrics: [{ key: 's', label: 'Cost', value: 40, format: 'usd' }] };
    el.renderNow();
    el.data = { metrics: [{ key: 's', label: 'Cost', value: 90, format: 'usd' }] };
    el.renderNow();
    expect(fig(el, 's').textContent).toBe(fmtMetric(90, 'usd'));
    expect(frames.size).toBe(0);
  });

  it('from jumps under reduced motion, on a change of format, and when it equals the value', () => {
    reduce = true;
    const a = mount({ metrics: [{ key: 's', label: 'S', value: 10, from: 2 }] });
    expect(fig(a, 's').textContent).toBe('10');
    reduce = false;
    const b = mount({ metrics: [{ key: 's', label: 'S', value: 10, from: 10 }] });
    expect(fig(b, 's').textContent).toBe('10');
    expect(frames.size).toBe(0);
    const c = mount({ metrics: [{ key: 's', label: 'S', value: 100, from: 'last' }] });
    c.data = { loading: true, metrics: [{ key: 's', label: 'S', value: 100, from: 'last' }] };
    c.renderNow();
    c.data = { metrics: [{ key: 's', label: 'S', value: 1_500_000, format: 'tokens', from: 'last' }] };
    c.renderNow();
    expect(fig(c, 's').textContent).toBe('1.5M');
    expect(frames.size).toBe(0);
  });

  it('cancels the frame on disconnect and lands on the target when reattached', () => {
    const el = mount({ metrics: [{ key: 's', label: 'Sessions', value: 100 }] });
    el.data = { metrics: [{ key: 's', label: 'Sessions', value: 200 }] };
    el.renderNow();
    expect(frames.size).toBe(1);
    el.remove();
    expect(cancelled.length).toBe(1);
    expect(frames.size).toBe(0);
    document.body.append(el);
    el.renderNow();
    expect(fig(el, 's').textContent).toBe('200');
    expect(frames.size).toBe(0);
  });
});

describe('<ui-stat-strip> breakdown', () => {
  it('wraps a breakdown figure in a card tooltip: title, label · value rows, described-by', () => {
    const el = mount(DATA);
    const tip = metric(el, 'tokens').querySelector('ui-tooltip')!;
    expect(tip.getAttribute('variant')).toBe('card');
    expect(tip.getAttribute('placement')).toBe('bottom-start');
    const btn = tip.querySelector<HTMLButtonElement>('button.ss-fig-btn')!;
    const bd = tip.querySelector<HTMLElement>('[slot="content"]')!;
    expect(bd.querySelector('.ss-bd-title')?.textContent).toBe('Tokens by environment');
    expect(Array.from(bd.querySelectorAll('dt')).map((d) => d.textContent)).toEqual(['dev', 'prod', 'share']);
    // Rows use the metric's format unless they set their own.
    expect(Array.from(bd.querySelectorAll('dd')).map((d) => d.textContent)).toEqual(['1.2M', '3.4M', '26%']);
    expect(btn.getAttribute('aria-describedby')).toBe(bd.id);
    expect(btn.textContent).toContain('4.6M');
  });

  it('a hint is a plain (ink) tooltip; a figure with neither is not a button', () => {
    const el = mount(DATA);
    const tip = metric(el, 'cost').querySelector('ui-tooltip')!;
    expect(tip.hasAttribute('variant')).toBe(false);
    expect(tip.querySelector('.ss-hint')?.textContent).toBe('Estimated from list prices');
    expect(metric(el, 'sessions').querySelector('button')).toBeNull();
  });

  it('keeps the tooltip, its content and the wiring across re-renders', async () => {
    const el = mount(DATA);
    await Promise.resolve();
    const tip = metric(el, 'tokens').querySelector<UiTooltip>('ui-tooltip')!;
    tip.renderNow();
    const btn = tip.querySelector('button')!;
    const bd = tip.querySelector('[slot="content"]')!;
    const described = btn.getAttribute('aria-describedby');
    el.data = { ...DATA, label: 'Usage this week' };
    el.renderNow();
    expect(metric(el, 'tokens').querySelector('ui-tooltip')).toBe(tip);
    expect(tip.querySelector('[slot="content"]')).toBe(bd);
    expect(btn.getAttribute('aria-describedby')).toBe(described);
    expect(bd.id).toBe(described);
  });

  it('a press toggles the breakdown (touch too); a press elsewhere hides it', () => {
    const el = mount(DATA);
    const tip = metric(el, 'tokens').querySelector<UiTooltip>('ui-tooltip')!;
    tip.renderNow();
    const btn = tip.querySelector<HTMLButtonElement>('button')!;
    const tap = () => {
      btn.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true, composed: true }));
      btn.click();
    };
    tap();
    expect(tip.open).toBe(true);
    tap();
    expect(tip.open).toBe(false);
    tap();
    expect(tip.open).toBe(true);
    document.body.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }));
    expect(tip.open).toBe(false);
    // Keyboard (Enter / Space → click without a press) toggles from the current state.
    btn.click();
    expect(tip.open).toBe(true);
    btn.click();
    expect(tip.open).toBe(false);
  });

  it('escapes the breakdown title, row labels and the hint', () => {
    const el = mount({
      metrics: [
        { key: 't', label: 'Tokens', value: 5, breakdown: { title: XSS, rows: [{ label: BREAK, value: 1 }] } },
        { key: 'c', label: 'Cost', value: 1, hint: XSS },
      ],
    });
    expect(q(el, 'img')).toBeNull();
    expect(q(el, 'b')).toBeNull();
    expect(q(el, '.ss-bd-title')?.textContent).toBe(XSS);
    expect(q(el, '.ss-bd-rows dt')?.textContent).toBe(BREAK);
    expect(q(el, '.ss-hint')?.textContent).toBe(XSS);
  });
});

describe('<ui-stat-strip> escaping', () => {
  it('escapes metric labels, keys, the strip label, the More label and period labels', () => {
    const el = mount({
      label: BREAK,
      period: { value: 'a', label: XSS, options: [{ value: 'a', label: XSS }] },
      more: { label: BREAK },
      metrics: [{ key: BREAK, label: XSS, value: 1 }],
    });
    expect(q(el, 'img')).toBeNull();
    expect(q(el, 'b')).toBeNull();
    expect(q(el, '.ss')?.getAttribute('aria-label')).toBe(BREAK);
    expect(q(el, '.ss-label')?.textContent).toBe(XSS);
    expect(q(el, '.ss-m')?.dataset.metric).toBe(BREAK);
    expect(q(el, '.ss-more-t')?.textContent).toBe(BREAK);
    const s = seg(el);
    expect(s.shadowRoot!.querySelector('img')).toBeNull();
    expect(s.shadowRoot!.querySelector('.sg-label')?.textContent).toBe(XSS);
    expect(s.shadowRoot!.querySelector('.sg')?.getAttribute('aria-label')).toBe(XSS);
  });
});

describe('<ui-stat-strip> more', () => {
  const panel = () => {
    const p = document.createElement('p');
    p.textContent = 'Turns 1,942';
    return p;
  };

  it('renders a quiet toggle controlling an inert region with the default slot', () => {
    const el = mount({ ...DATA, more: true }, {}, panel());
    const b = q(el, '.ss-more')!;
    expect(b.textContent).toBe('More');
    expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(b.getAttribute('aria-controls')).toBe('ss-region');
    expect(b.querySelector('svg[data-icon="chevron-down"]')).not.toBeNull();
    const r = q(el, '#ss-region')!;
    expect(r.hasAttribute('inert')).toBe(true);
    expect(r.querySelector('slot:not([name])')).not.toBeNull();
    expect(el.open).toBe(false);
  });

  it('a press sends a cancelable ui-more and opens optimistically', () => {
    const el = mount({ ...DATA, more: true }, {}, panel());
    const seen: Array<[unknown, boolean]> = [];
    el.addEventListener('ui-more', (e) => seen.push([(e as CustomEvent).detail, e.cancelable]));
    q(el, '.ss-more')!.click();
    el.renderNow();
    expect(seen).toEqual([[{ open: true }, true]]);
    expect(q(el, '.ss-more')?.getAttribute('aria-expanded')).toBe('true');
    expect(q(el, '.ss-region')?.hasAttribute('inert')).toBe(false);
    expect(q(el, '.ss')?.hasAttribute('data-open')).toBe(true);
    expect(el.hasAttribute('open')).toBe(true);
    q(el, '.ss-more')!.click();
    el.renderNow();
    expect(seen[1][0]).toEqual({ open: false });
    expect(q(el, '.ss-region')?.hasAttribute('inert')).toBe(true);
    expect(el.hasAttribute('open')).toBe(false);
  });

  it('a cancelled ui-more keeps the region as it is', () => {
    const el = mount({ ...DATA, more: true });
    el.addEventListener('ui-more', (e) => e.preventDefault());
    q(el, '.ss-more')!.click();
    el.renderNow();
    expect(q(el, '.ss-more')?.getAttribute('aria-expanded')).toBe('false');
    expect(el.open).toBe(false);
  });

  it('the open attribute and data.more.open set it without an event; opened on first paint is settled', () => {
    const fired = vi.fn();
    const a = document.createElement('ui-stat-strip') as UiStatStrip;
    a.addEventListener('ui-more', fired);
    a.setAttribute('open', '');
    document.body.append(a);
    a.data = { ...DATA, more: true };
    a.renderNow();
    expect(q(a, '.ss')?.hasAttribute('data-open')).toBe(true);
    expect(q(a, '.ss')?.hasAttribute('data-settled')).toBe(true);
    const b = mount({ ...DATA, more: { open: false } });
    b.addEventListener('ui-more', fired);
    b.data = { ...DATA, more: { open: true } };
    b.renderNow();
    expect(b.open).toBe(true);
    expect(q(b, '.ss-more')?.getAttribute('aria-expanded')).toBe('true');
    // An unrelated update with the same data.more.open does not undo the person's toggle.
    q(b, '.ss-more')!.click();
    b.data = { ...DATA, label: 'x', more: { open: true } };
    b.renderNow();
    expect(b.open).toBe(false);
    b.open = true;
    b.renderNow();
    expect(q(b, '.ss-more')?.getAttribute('aria-expanded')).toBe('true');
    expect(fired).toHaveBeenCalledTimes(1);
  });

  it('opening later waits for the region transition before it stops clipping', () => {
    const el = mount({ ...DATA, more: true });
    el.open = true;
    el.renderNow();
    const ss = q(el, '.ss')!;
    expect(ss.hasAttribute('data-settled')).toBe(false);
    const ev = new Event('transitionend', { bubbles: true }) as TransitionEvent;
    Object.defineProperty(ev, 'propertyName', { value: 'grid-template-rows' });
    q(el, '.ss-region')!.dispatchEvent(ev);
    expect(ss.hasAttribute('data-settled')).toBe(true);
  });

  it('uses a custom label; toggle() does nothing without more', () => {
    const el = mount({ ...DATA, more: { label: 'Details' } });
    expect(q(el, '.ss-more')?.textContent).toBe('Details');
    const none = mount(DATA);
    none.toggle();
    expect(none.open).toBe(false);
  });
});

describe('<ui-stat-strip> lang="ko"', () => {
  it('speaks Korean: 사용량, 기간, 자세히, 데이터 없음, 불러오는 중', () => {
    const el = mount(
      {
        period: { value: 'today', options: [{ value: 'today', label: '오늘' }] },
        more: true,
        metrics: [
          { key: 'a', label: '세션', value: null },
          { key: 'b', label: '토큰', loading: true },
          { key: 'c', label: '평균 시간', value: 562_000, format: 'duration' },
        ],
      },
      { lang: 'ko' },
    );
    expect(q(el, '.ss')?.getAttribute('aria-label')).toBe('사용량');
    expect(seg(el).data?.label).toBe('기간');
    expect(q(el, '.ss-more')?.textContent).toBe('자세히');
    expect(metric(el, 'a').querySelector('.sr-only')?.textContent).toBe('데이터 없음');
    expect(metric(el, 'b').querySelector('.sr-only')?.textContent).toBe('불러오는 중');
    expect(fig(el, 'c').textContent).toBe('9분 22초');
  });

  it('re-renders when lang changes', () => {
    const el = mount({ ...DATA, more: true });
    el.setAttribute('lang', 'ko');
    el.renderNow();
    expect(q(el, '.ss-more')?.textContent).toBe('자세히');
  });
});

describe('styles', () => {
  it('a 44px More on phone-width windows as well as coarse pointers', () => {
    expect(styles).toMatch(/@media \(max-width: 639px\) \{\s*\.ss-more \{ min-height: 44px; \}/);
  });

  it('tokens only, calm motion recipes, coarse-pointer targets', () => {
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    expect(styles).toContain('animation: ss-pulse 1.6s ease-in-out infinite');
    expect(styles).toContain('grid-template-rows: 0fr');
    expect(styles).toContain('transition: grid-template-rows var(--dur-expand) var(--ease-out)');
    expect(styles).toContain('transform: rotate(180deg)');
    expect(styles).toContain('font-variant-numeric: tabular-nums');
    expect(styles).toMatch(/@media \(hover: hover\) and \(pointer: fine\)/);
    expect(styles).toMatch(/@media \(pointer: coarse\)[^}]*min-height: 44px/);
    expect(styles).toContain('prefers-reduced-motion: reduce');
  });
});
