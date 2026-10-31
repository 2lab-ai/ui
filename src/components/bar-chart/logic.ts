import { fmtDurationIn, fmtInt, fmtTokens, fmtUsd } from '../../core/format';

/** How values are written: 1,234 · 12.3K · 12.3K · $4.20 · 9m 22s (duration values are milliseconds). */
export type ChartFormat = 'int' | 'compact' | 'tokens' | 'usd' | 'duration';

/** A series colour: a token name, never a raw CSS colour. */
export type ChartColor = 'spark' | 'run' | 'done' | 'wait' | 'fail' | 'purple' | 'orange' | 'muted';

export interface BarSeries {
  /** Field of `BarDatum.values` this series reads. Stable across updates: the segment keeps its place by it. */
  key: string;
  label: string;
  /** Default: the next slot of the stacked palette (spark, wait, purple, done, orange, muted). */
  color?: ChartColor;
}

export interface BarDatum {
  /** What `ui-select` carries back and what keeps the bar's node across updates. Default: `label`. */
  key?: string;
  /** Short x-axis label ("Oct 17", "11/3"). */
  label: string;
  /** Tooltip heading and the start of the accessible label ("Fri 17 Oct"). Default: `label`. */
  title?: string;
  /** Single series: the value. Missing (undefined, null, NaN) = no data; negative reads as 0. */
  value?: number | null;
  /** Stacked: one value per series key. A missing key reads as 0; no finite value at all = no data. */
  values?: Record<string, number | null | undefined>;
}

export interface BarChartData {
  /** Heading and the chart's accessible name. */
  title?: string;
  /** 2+ series stack in this order (first at the baseline). Omitted = one series read from `BarDatum.value`. */
  series?: BarSeries[];
  bars: BarDatum[];
  /** Default 'int'. */
  format?: ChartFormat;
  /** Unit of a single-series value ("sessions") — used in the tooltip and each bar's accessible label. */
  unit?: string;
  /**
   * The colour of a single series read from `BarDatum.value` — no legend (a `series` entry draws one). Default
   * `spark`. Ignored when `series` is given (each series has its own colour).
   */
  color?: ChartColor;
  /** Empty-state text. Default “No data for this period”. */
  empty?: string;
  /** The host is fetching: skeleton bars before the first data, the old bars dimmed after. */
  loading?: boolean;
  /** Plot height in px (48–600). Default 140. */
  height?: number;
  /** Target number of gridlines above the baseline (1–8). Default 3. */
  ticks?: number;
  /**
   * Selection mode. Leave undefined for a read-only chart (bars still send `ui-select`). A string marks the bar
   * with that key; `null` = selection on, nothing marked. In selection mode `ui-select` moves the mark unless a
   * listener cancels it.
   */
  selected?: string | null;
}

/** `ui-select` detail. */
export interface BarSelect {
  /** `bar.key ?? bar.label`. */
  key: string;
  index: number;
}

export interface NiceScale {
  /** Top of the axis (≥ the data max). */
  max: number;
  step: number;
  /** 0, step, 2·step … max. */
  ticks: number[];
}

/** Token per colour name. Dark mode follows the tokens. */
export const BAR_COLORS: Record<ChartColor, string> = {
  spark: 'var(--ib-spark)',
  run: 'var(--st-run)',
  done: 'var(--st-done)',
  wait: 'var(--st-wait)',
  fail: 'var(--st-fail)',
  purple: 'var(--purple)',
  orange: 'var(--orange)',
  muted: 'var(--ib-muted)',
};

/**
 * Default series order. Validated as adjacent pairs (stacked segments touch) in light and dark: no neighbour pair
 * falls under OKLab ΔE 7.5 under protan / deutan simulation or 18 with normal vision. Spark and purple never touch
 * (indistinguishable for protans in dark), nor done and fail, nor orange and fail. Status red stays out of the
 * default set — it means failure; pass `color: 'fail'` for that.
 */
export const BAR_PALETTE: ChartColor[] = ['spark', 'wait', 'purple', 'done', 'orange', 'muted'];

/** Finite number or undefined (no data). */
function finite(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Shorten to one decimal: 1.0 → 1, 2.5 → 2.5. */
function trim(x: number): string {
  const s = x.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/** Formats whose values are counts: their axis never shows a fractional step. */
export function integerBarFormat(format: ChartFormat): boolean {
  return format === 'int' || format === 'compact' || format === 'tokens';
}

const HOUR = 3_600_000;
const MINUTE = 60_000;
const SECOND = 1000;

/** The unit a duration axis counts in (ms per unit): hours from 1h, minutes from 1m, else seconds. */
function durationUnit(maxMs: number): number {
  return maxMs >= HOUR ? HOUR : maxMs >= MINUTE ? MINUTE : SECOND;
}

/**
 * A clean axis for values 0…max: about `ticks` steps of 1 / 2 / 2.5 / 5 × 10ⁿ, the top the first step at or
 * above max. `integer` keeps steps whole (counts). max ≤ 0 (or not a number) gives 0…ticks in steps of 1.
 */
export function niceScale(max: number, ticks = 3, integer = false): NiceScale {
  const n = Math.min(8, Math.max(1, Math.round(Number(ticks)) || 3));
  const m = Number.isFinite(max) && max > 0 ? max : 0;
  let step = 1;
  if (m > 0) {
    const raw = m / n;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const pick = [1, 2, 2.5, 5, 10]
      .map((f) => f * mag)
      .filter((s) => !integer || Number.isInteger(Math.round(s * 1e9) / 1e9))
      .find((s) => s >= raw * (1 - 1e-9));
    step = pick ?? 10 * mag;
    if (integer) step = Math.max(1, Math.round(step));
  }
  const count = m > 0 ? Math.max(1, Math.ceil(m / step - 1e-9)) : n;
  const out: number[] = [];
  for (let i = 0; i <= count; i++) out.push(Number((i * step).toPrecision(12)));
  return { max: out[out.length - 1], step, ticks: out };
}

/** The axis for a format: duration axes count in whole seconds, minutes or hours. */
export function barScale(max: number, ticks: number, format: ChartFormat): NiceScale {
  if (format !== 'duration') return niceScale(max, ticks, integerBarFormat(format));
  const unit = durationUnit(max);
  const s = niceScale(max / unit, ticks, false);
  return {
    max: s.max * unit,
    step: s.step * unit,
    ticks: s.ticks.map((t) => Number((t * unit).toPrecision(12))),
  };
}

/** A value as the tooltip and the accessible label write it. */
export function fmtBarValue(v: number, format: ChartFormat = 'int', lang?: string): string {
  switch (format) {
    case 'compact':
    case 'tokens':
      return fmtTokens(v);
    case 'usd':
      return fmtUsd(v);
    case 'duration':
      return fmtDurationIn(v, lang);
    default:
      return fmtInt(v);
  }
}

/**
 * An axis tick, written short: 0 · 950 · 1.5K · 2M · $0.50 · $1.2K · 30s · 15m · 1.5h. A duration axis writes
 * every tick in the unit of its top (`axisMax`): 0.5h · 1h · 1.5h.
 */
export function fmtBarTick(v: number, format: ChartFormat = 'int', axisMax = 0): string {
  if (format === 'usd') {
    if (v >= 1000) return `$${fmtTokens(v)}`;
    return Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`;
  }
  if (format === 'duration') {
    const unit = durationUnit(Math.max(v, axisMax));
    if (v === 0) return '0';
    return `${trim(v / unit)}${unit === HOUR ? 'h' : unit === MINUTE ? 'm' : 's'}`;
  }
  if (Math.abs(v) >= 1000) return fmtTokens(v);
  return Number.isInteger(v) ? String(v) : trim(v);
}

/**
 * Show every `stride`-th x label so labels `minLabelPx` wide fit bars `plotWidthPx / count` apart.
 * 1 when there is room, or when the width is unknown (not laid out yet).
 */
export function labelStride(count: number, plotWidthPx: number, minLabelPx: number): number {
  if (!(count > 1) || !(plotWidthPx > 0) || !(minLabelPx > 0)) return 1;
  return Math.max(1, Math.ceil(minLabelPx / (plotWidthPx / count)));
}

/**
 * Whether label `i` of `count` shows at `stride`: counted back from the last bar (the latest day keeps its
 * label), the first always shows, and a label too close to the first gives way.
 */
export function barLabelShown(i: number, count: number, stride: number): boolean {
  const last = count - 1;
  if (i === 0 || i === last) return true;
  const s = Math.max(1, Math.floor(stride));
  return (last - i) % s === 0 && i >= s;
}

/** A series as drawn. */
export interface BarSeriesModel {
  key: string;
  label: string;
  color: ChartColor;
}

/** A bar as drawn. */
export interface BarModel {
  /** Internal id, unique within the chart (duplicate keys get `#2`, `#3` …). */
  id: string;
  /** Public key: `bar.key ?? bar.label`. */
  key: string;
  index: number;
  label: string;
  /** Tooltip heading: `title ?? label`. */
  title: string;
  /** One value per series (≥ 0). */
  values: number[];
  total: number;
  /** No value at all: drawn as an empty slot, “No data” in the tooltip. */
  missing: boolean;
}

export interface BarChartModel {
  series: BarSeriesModel[];
  stacked: boolean;
  bars: BarModel[];
  /** No bars, or no bar with a value. */
  empty: boolean;
  format: ChartFormat;
  scale: NiceScale;
}

const FORMATS: ChartFormat[] = ['int', 'compact', 'tokens', 'usd', 'duration'];

/** A known colour name, else undefined (raw CSS from the host never reaches the markup). */
export function barColor(c: unknown): ChartColor | undefined {
  return typeof c === 'string' && Object.hasOwn(BAR_COLORS, c) ? (c as ChartColor) : undefined;
}

/** Normalise host data into what the chart draws. */
export function barChartModel(d: BarChartData | undefined): BarChartModel {
  const format = FORMATS.includes(d?.format as ChartFormat) ? (d?.format as ChartFormat) : 'int';
  const given = Array.isArray(d?.series) ? d.series.filter((s) => s && typeof s.key === 'string' && s.key !== '') : [];
  const seen = new Set<string>();
  const series: BarSeriesModel[] = [];
  for (const s of given) {
    if (seen.has(s.key)) continue;
    seen.add(s.key);
    const slot = BAR_PALETTE[Math.min(series.length, BAR_PALETTE.length - 1)];
    series.push({ key: s.key, label: String(s.label ?? s.key), color: barColor(s.color) ?? slot });
  }
  const single = series.length <= 1;
  if (!series.length) series.push({ key: '', label: '', color: barColor(d?.color) ?? 'spark' });
  const ids = new Map<string, number>();
  const bars: BarModel[] = [];
  for (const b of Array.isArray(d?.bars) ? d.bars : []) {
    if (!b || typeof b !== 'object') continue;
    const label = String(b.label ?? '');
    const key = typeof b.key === 'string' && b.key !== '' ? b.key : label;
    const n = (ids.get(key) ?? 0) + 1;
    ids.set(key, n);
    let raw: Array<number | undefined>;
    if (single) {
      const own = series[0].key ? finite(b.values?.[series[0].key]) : undefined;
      raw = [own ?? finite(b.value)];
    } else {
      raw = series.map((s) => finite(b.values?.[s.key]));
    }
    const missing = raw.every((v) => v === undefined);
    const values = raw.map((v) => Math.max(0, v ?? 0));
    bars.push({
      id: n > 1 ? `${key}#${n}` : key,
      key,
      index: bars.length,
      label,
      title: typeof b.title === 'string' && b.title !== '' ? b.title : label,
      values,
      total: values.reduce((s, v) => s + v, 0),
      missing,
    });
  }
  const max = bars.reduce((m, b) => Math.max(m, b.total), 0);
  return {
    series,
    stacked: !single,
    bars,
    empty: !bars.length || bars.every((b) => b.missing),
    format,
    scale: barScale(max, d?.ticks ?? 3, format),
  };
}

/** Percent of the plot height, 3 decimals. */
export function pct(v: number, max: number): number {
  return max > 0 ? Math.round((Math.min(v, max) / max) * 100_000) / 1000 : 0;
}
