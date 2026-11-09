import { fmtTokens } from '../../core/format';

/** A series colour: a token name, never a raw CSS colour. */
export type LineTone = 'accent' | 'run' | 'done' | 'wait' | 'fail' | 'muted';
/** `area` — a line with a soft fill under it · `line` — a solid line · `dashed` — a dashed line (a previous period). */
export type LineStyle = 'area' | 'line' | 'dashed';
/** The tone a summary figure's value reads in. */
export type LineSummaryTone = 'accent' | 'done' | 'fail';

export interface LineSeries {
  /** Stable id: the series keeps its nodes across updates by it. */
  id: string;
  /** Legend, tooltip and accessible name of the series ("Tokens", "30 days before"). */
  label: string;
  /** One value per x label, oldest first. null (or anything not a finite number) breaks the line: a gap. */
  values: Array<number | null>;
  /** Default: the first series `area`, the others `dashed`. */
  style?: LineStyle;
  /** Default: the first series `accent`, then muted, wait, done, run. */
  tone?: LineTone;
}

/** A soft horizontal band for the normal range. */
export interface LineBand {
  min: number;
  max: number;
  /** Its name in the legend (default “Usual range”); the range and the unit follow it: “Usual range 120–220 ms”. */
  label?: string;
}

/** One figure in the row over the chart. */
export interface LineSummary {
  label: string;
  /** Already written by the host (“1.2M”, “184”, “27 of 30”). */
  value: string;
  unit?: string;
  tone?: LineSummaryTone;
}

export interface LineChartData {
  /** The chart's accessible name (“Tokens per day”). */
  label?: string;
  /** The values' unit (“tokens”, “ms”) — tooltip, legend band and spoken values. */
  unit?: string;
  /** X labels, one per point, oldest first (“13 Oct”). */
  labels: string[];
  series: LineSeries[];
  band?: LineBand;
  /** The axis reaches at least down to yMin / up to yMax (it never cuts data off): `yMin: 0` starts it at zero. */
  yMin?: number;
  yMax?: number;
  /** About how many steps the y axis has (1–10). Default 4. */
  ticks?: number;
  /** Fixed decimals for values in the tooltip and spoken text (0–6). Default: as given, up to 2. */
  decimals?: number;
  /** The figures row over the chart (Average / Lowest / Highest …). */
  summary?: LineSummary[];
  /** Empty-state text. Default “No data yet”. */
  empty?: string;
}

/** `ui-select` detail. */
export interface LineSelect {
  index: number;
  label: string;
}

export interface NiceTicks {
  min: number;
  max: number;
  step: number;
  /** min, min + step … max. */
  ticks: number[];
}

/** A point in the plot's 0…100 box: [x, y], y down. */
export type LinePoint = readonly [number, number];

/** Token per tone. Dark and mono follow the tokens. */
export const LINE_TONES: Record<LineTone, string> = {
  accent: 'var(--accent)',
  run: 'var(--st-run)',
  done: 'var(--st-done)',
  wait: 'var(--st-wait)',
  fail: 'var(--st-fail)',
  muted: 'var(--ib-muted)',
};

/** Default tones in series order (the first is the current period, the next its comparison). */
export const LINE_PALETTE: LineTone[] = ['accent', 'muted', 'wait', 'done', 'run'];

const STYLES: LineStyle[] = ['area', 'line', 'dashed'];
const SUMMARY_TONES: LineSummaryTone[] = ['accent', 'done', 'fail'];

/** Round to `d` decimals and write it short (no trailing zeros, no -0). */
function num(v: number, d = 2): string {
  const n = Number(v.toFixed(d));
  return String(n === 0 ? 0 : n);
}

/** A finite number, else null (a gap). */
export function lineValue(v: unknown): number | null {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Split points into runs of consecutive finite points: a null (or junk) point ends a run. */
export function lineRuns(points: ReadonlyArray<LinePoint | null | undefined>): LinePoint[][] {
  const out: LinePoint[][] = [];
  let cur: LinePoint[] = [];
  for (const p of points) {
    if (p && Number.isFinite(p[0]) && Number.isFinite(p[1])) cur.push(p);
    else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * Tangent slopes for a monotone cubic through `run` (Steffen 1990, the method behind d3's monotoneX): 0 at a peak or a
 * valley, never steeper than three times the gentler neighbouring secant — so each Bézier's control points stay inside
 * its segment's y range and the curve never overshoots the data. Two points: the straight secant.
 */
export function monotoneSlopes(run: readonly LinePoint[]): number[] {
  const n = run.length;
  if (n < 2) return n ? [0] : [];
  const h: number[] = [];
  const s: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(run[i + 1][0] - run[i][0]);
    s.push(h[i] ? (run[i + 1][1] - run[i][1]) / h[i] : 0);
  }
  if (n === 2) return [s[0], s[0]];
  const m: number[] = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const s0 = s[i - 1];
    const s1 = s[i];
    const w = h[i - 1] + h[i];
    const p = w ? (s0 * h[i] + s1 * h[i - 1]) / w : 0;
    m[i] = (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
  }
  m[0] = (3 * s[0] - m[1]) / 2;
  m[n - 1] = (3 * s[n - 2] - m[n - 2]) / 2;
  return m;
}

function runPath(run: readonly LinePoint[], d: number): string {
  const [x0, y0] = run[0];
  let out = `M${num(x0, d)},${num(y0, d)}`;
  if (run.length === 1) return `${out}h0`;
  if (run.length === 2) return `${out}L${num(run[1][0], d)},${num(run[1][1], d)}`;
  const m = monotoneSlopes(run);
  for (let i = 0; i < run.length - 1; i++) {
    const [ax, ay] = run[i];
    const [bx, by] = run[i + 1];
    const dx = (bx - ax) / 3;
    out += `C${num(ax + dx, d)},${num(ay + dx * m[i], d)} ${num(bx - dx, d)},${num(by - dx * m[i + 1], d)} ${num(bx, d)},${num(by, d)}`;
  }
  return out;
}

/**
 * The SVG path `d` of a smooth line through `points` (monotone cubic: no overshoot). A null point breaks the line —
 * each run of points is its own subpath (`M…`); a lone point is a zero-length subpath (`M x,y h0`) that a round cap
 * draws as a dot. `decimals` rounds the coordinates.
 */
export function monotonePath(points: ReadonlyArray<LinePoint | null | undefined>, decimals = 2): string {
  return lineRuns(points)
    .map((r) => runPath(r, decimals))
    .join('');
}

/** The filled area under a smooth line down to `baseY`: one closed subpath per run of 2+ points (gaps stay open). */
export function monotoneArea(points: ReadonlyArray<LinePoint | null | undefined>, baseY = 100, decimals = 2): string {
  return lineRuns(points)
    .filter((r) => r.length > 1)
    .map(
      (r) =>
        `${runPath(r, decimals)}L${num(r[r.length - 1][0], decimals)},${num(baseY, decimals)}L${num(r[0][0], decimals)},${num(baseY, decimals)}Z`,
    )
    .join('');
}

/**
 * A clean y axis covering lo…hi: about `count` steps of 1 / 2 / 2.5 / 5 × 10ⁿ, the ends the nearest steps at or beyond
 * the data (so 61…68 in 4 steps reads 60 · 62 · 64 · 66 · 68). lo = hi opens a little room around the value; junk
 * reads as 0…1.
 */
export function niceTicks(lo: number, hi: number, count = 4): NiceTicks {
  const n = Math.min(10, Math.max(1, Math.round(Number(count)) || 4));
  let a = Number.isFinite(lo) ? lo : Number.isFinite(hi) ? hi : 0;
  let b = Number.isFinite(hi) ? hi : a;
  if (b < a) [a, b] = [b, a];
  if (a === b) {
    const pad = Math.abs(a) * 0.1 || 1;
    a = a >= 0 && a - pad < 0 ? 0 : a - pad;
    b += pad;
  }
  const raw = (b - a) / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw * (1 - 1e-9)) ?? 10 * mag;
  const first = Math.floor(a / step + 1e-9);
  const last = Math.ceil(b / step - 1e-9);
  const ticks: number[] = [];
  for (let i = first; i <= last; i++) ticks.push(Number((i * step).toPrecision(12)));
  return { min: ticks[0], max: ticks[ticks.length - 1], step, ticks };
}

/** Decimals a step needs (2.5 → 1, 0.25 → 2, 50 → 0), at most 4. */
function stepDecimals(step: number): number {
  const s = String(Number(step.toPrecision(12)));
  const e = s.indexOf('e-');
  if (e >= 0) return Math.min(4, Number(s.slice(e + 2)));
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : Math.min(4, s.length - dot - 1);
}

/** A y tick, short: 60 · 62.5 · 0.25 · 1,500 · and from 10,000 up 12.5K · 1.5M (every tick compact when the top is). */
export function fmtLineTick(v: number, step: number, axisMax = v): string {
  if (Math.max(Math.abs(v), Math.abs(axisMax)) >= 10_000) return fmtTokens(v);
  return v.toLocaleString('en-US', { maximumFractionDigits: stepDecimals(step) });
}

/** A value as the tooltip and spoken text write it: grouped, `decimals` fixed when given, else up to 2. */
export function fmtLineValue(v: number, decimals?: number): string {
  const fixed = decimals !== undefined && Number.isFinite(decimals);
  const d = fixed ? Math.min(6, Math.max(0, Math.round(decimals))) : 2;
  return v.toLocaleString('en-US', { minimumFractionDigits: fixed ? d : 0, maximumFractionDigits: d });
}

/**
 * Which x labels show: 0 never, 1 only when the chart is wide (≥ 480px), 2 always. At most about 10 show wide and
 * half of those narrow, counted back from the latest point so the last label always shows.
 */
export function xLabelLevels(count: number, wide = 10): Array<0 | 1 | 2> {
  const n = Math.max(0, Math.floor(Number(count)) || 0);
  if (!n) return [];
  const last = n - 1;
  const stride = Math.max(1, Math.ceil(last / Math.max(1, Math.floor(wide) - 1)));
  const out: Array<0 | 1 | 2> = [];
  for (let i = 0; i < n; i++) {
    const k = last - i;
    out.push(k % stride ? 0 : (k / stride) % 2 ? 1 : 2);
  }
  return out;
}

export function lineTone(v: unknown): LineTone | undefined {
  return typeof v === 'string' && Object.hasOwn(LINE_TONES, v) ? (v as LineTone) : undefined;
}

export function lineStyle(v: unknown): LineStyle | undefined {
  return STYLES.includes(v as LineStyle) ? (v as LineStyle) : undefined;
}

/** A series as drawn. */
export interface LineSeriesModel {
  /** Unique within the chart (duplicate ids get `#2`, `#3` …). */
  id: string;
  label: string;
  style: LineStyle;
  tone: LineTone;
  /** One per point (null = no data). */
  values: Array<number | null>;
  /** In the plot's 0…100 box (null = gap). */
  points: Array<LinePoint | null>;
  line: string;
  area: string;
  min: number | null;
  max: number | null;
  /** The latest finite value. */
  last: number | null;
}

export interface LineBandModel {
  min: number;
  max: number;
  label: string;
  /** Bottom and height in percent of the plot. */
  bottom: number;
  height: number;
}

export interface LineChartModel {
  count: number;
  labels: string[];
  /** X of each point in percent of the plot. */
  xs: number[];
  levels: Array<0 | 1 | 2>;
  series: LineSeriesModel[];
  band: LineBandModel | null;
  scale: NiceTicks;
  /** No point has a finite value. */
  empty: boolean;
  decimals: number | undefined;
  unit: string;
  summary: Array<Required<Pick<LineSummary, 'label' | 'value'>> & { unit: string; tone?: LineSummaryTone }>;
}

/** Percent from the bottom of the plot for `v` on `scale`, 3 decimals. */
export function linePct(v: number, scale: Pick<NiceTicks, 'min' | 'max'>): number {
  const span = scale.max - scale.min;
  if (!(span > 0)) return 50;
  return Math.round(((v - scale.min) / span) * 100_000) / 1000;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v);
}

/** Normalise host data into what the chart draws. */
export function lineChartModel(d: LineChartData | undefined): LineChartModel {
  const given = Array.isArray(d?.series) ? d.series.filter((s) => s && typeof s === 'object') : [];
  const rawLabels = Array.isArray(d?.labels) ? d.labels.map(str) : [];
  const count =
    rawLabels.length || given.reduce((m, s) => Math.max(m, Array.isArray(s.values) ? s.values.length : 0), 0);
  const labels = Array.from({ length: count }, (_, i) => rawLabels[i] ?? '');
  const xs = labels.map((_, i) => (count > 1 ? Math.round((i / (count - 1)) * 100_000) / 1000 : 50));
  const ids = new Map<string, number>();
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  let integer = true;
  const pre = given.map((s, j) => {
    const base = str(s.id) || `s${j}`;
    const k = (ids.get(base) ?? 0) + 1;
    ids.set(base, k);
    const values = labels.map((_, i) => lineValue(Array.isArray(s.values) ? s.values[i] : null));
    let min: number | null = null;
    let max: number | null = null;
    let last: number | null = null;
    for (const v of values) {
      if (v === null) continue;
      min = min === null ? v : Math.min(min, v);
      max = max === null ? v : Math.max(max, v);
      last = v;
      if (!Number.isInteger(v)) integer = false;
    }
    if (min !== null && max !== null) {
      lo = Math.min(lo, min);
      hi = Math.max(hi, max);
    }
    return {
      id: k > 1 ? `${base}#${k}` : base,
      label: str(s.label),
      style: lineStyle(s.style) ?? (j === 0 ? 'area' : 'dashed'),
      tone: lineTone(s.tone) ?? LINE_PALETTE[j % LINE_PALETTE.length],
      values,
      min,
      max,
      last,
    };
  });
  const empty = !Number.isFinite(lo);
  const bmin = lineValue(d?.band?.min);
  const bmax = lineValue(d?.band?.max);
  const hasBand = bmin !== null && bmax !== null;
  let a = empty ? 0 : lo;
  let b = empty ? 1 : hi;
  if (!empty && hasBand) {
    a = Math.min(a, bmin, bmax);
    b = Math.max(b, bmin, bmax);
  }
  const yMin = lineValue(d?.yMin);
  const yMax = lineValue(d?.yMax);
  if (yMin !== null) a = Math.min(a, yMin);
  if (yMax !== null) b = Math.max(b, yMax);
  const scale = niceTicks(a, b, d?.ticks ?? 4);
  const y = (v: number) => Math.round((100 - linePct(v, scale)) * 1000) / 1000;
  const series: LineSeriesModel[] = pre.map((s) => {
    const points = s.values.map((v, i): LinePoint | null => (v === null ? null : [xs[i], y(v)]));
    return {
      ...s,
      points,
      line: monotonePath(points),
      area: s.style === 'area' ? monotoneArea(points, 100) : '',
    };
  });
  let band: LineBandModel | null = null;
  if (hasBand && !empty) {
    const top = Math.max(bmin, bmax);
    const bottom = Math.min(bmin, bmax);
    const b0 = linePct(bottom, scale);
    band = {
      min: bottom,
      max: top,
      label: str(d?.band?.label),
      bottom: b0,
      height: Math.round((linePct(top, scale) - b0) * 1000) / 1000,
    };
  }
  const dec = lineValue(d?.decimals);
  const summary = (Array.isArray(d?.summary) ? d.summary : [])
    .filter((f) => f && typeof f === 'object')
    .map((f) => ({
      label: str(f.label),
      value: str(f.value),
      unit: str(f.unit),
      tone: SUMMARY_TONES.includes(f.tone as LineSummaryTone) ? f.tone : undefined,
    }));
  return {
    count,
    labels,
    xs,
    levels: xLabelLevels(count),
    series,
    band,
    scale,
    empty,
    decimals: dec !== null ? Math.min(6, Math.max(0, Math.round(dec))) : integer ? 0 : undefined,
    unit: str(d?.unit),
    summary,
  };
}

/** The index of the point nearest `fraction` (0 … 1 across the plot). */
export function nearestIndex(fraction: number, count: number): number {
  if (!(count > 1) || !Number.isFinite(fraction)) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(fraction * (count - 1))));
}
