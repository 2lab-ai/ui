import { define, UiElement } from '../../core/element';
import { fmtTokens } from '../../core/format';
import { attrs } from '../../core/html';
import { morphInto } from '../../core/morph';
import {
  LINE_TONES,
  type LinePoint,
  type LineTone,
  lineTone,
  lineValue,
  monotoneArea,
  monotonePath,
} from '../line-chart/logic';

/** The line's colour: a token name. Not set: currentColor — the row's own ink. */
export type SparkTone = LineTone;
export type SparkLang = 'en' | 'ko';

export interface SparklineData {
  /** Oldest first. null breaks the line (a gap); anything not a finite number is a gap too. */
  values: Array<number | null>;
  tone?: SparkTone;
  /** A soft fill under the line. */
  area?: boolean;
  /** The accessible name (“Tokens”), read before the summary. */
  label?: string;
  /** Fix the scale (e.g. 0 … 100 for a percentage). Default: the values' own low and high. Values outside are clamped. */
  min?: number;
  max?: number;
}

const STRINGS = {
  en: {
    summary: (label: string, n: number, lo: string, hi: string, last: string) =>
      `${label ? `${label}: ` : ''}${n} ${n === 1 ? 'point' : 'points'}, low ${lo}, high ${hi}, last ${last}`,
    empty: (label: string) => `${label ? `${label}: ` : ''}no data`,
  },
  ko: {
    summary: (label: string, n: number, lo: string, hi: string, last: string) =>
      `${label ? `${label}: ` : ''}${n}개 지점, 최저 ${lo}, 최고 ${hi}, 최근 ${last}`,
    empty: (label: string) => `${label ? `${label}: ` : ''}데이터 없음`,
  },
};

/** Room above and below the line (percent of the height), so the stroke and the last dot are never cut. */
const PAD = 8;

/** The `values` attribute: numbers split by commas or spaces; anything else (words, blanks, NaN, Infinity) is dropped. */
export function sparkValues(v: unknown): number[] {
  if (typeof v !== 'string') return [];
  return v
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
}

/** A value short: 950 · 3.1K · 1.2M · 12.5 · 0.042 (three significant digits under 1,000). */
export function fmtSpark(v: number): string {
  if (Math.abs(v) >= 1000) return fmtTokens(v);
  const n = Number(v.toPrecision(3));
  return String(n === 0 ? 0 : n);
}

/** Points in the 0…100 box (y down), null for gaps; a flat series sits in the middle. */
export function sparkPoints(values: ReadonlyArray<number | null>, min?: number, max?: number): Array<LinePoint | null> {
  const vs = values.map((v) => lineValue(v));
  const finite = vs.filter((v): v is number => v !== null);
  if (!finite.length) return vs.map(() => null);
  const lo0 = lineValue(min) ?? Math.min(...finite);
  const hi0 = lineValue(max) ?? Math.max(...finite);
  const lo = Math.min(lo0, hi0);
  const hi = Math.max(lo0, hi0);
  const n = vs.length;
  return vs.map((v, i) => {
    if (v === null) return null;
    const x = n > 1 ? Math.round((i / (n - 1)) * 100_000) / 1000 : 50;
    if (hi === lo) return [x, 50];
    const f = (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo);
    return [x, Math.round((PAD + (1 - f) * (100 - 2 * PAD)) * 1000) / 1000];
  });
}

/** The accessible summary: “Tokens: 12 points, low 3.1K, high 9.8K, last 7.2K” (ko: 최저 · 최고 · 최근). */
export function sparkSummary(values: ReadonlyArray<number | null>, label = '', lang?: string | null): string {
  const s = lang === 'ko' ? STRINGS.ko : STRINGS.en;
  const finite = values.map((v) => lineValue(v)).filter((v): v is number => v !== null);
  const name = String(label ?? '').trim();
  if (!finite.length) return s.empty(name);
  return s.summary(
    name,
    finite.length,
    fmtSpark(Math.min(...finite)),
    fmtSpark(Math.max(...finite)),
    fmtSpark(finite[finite.length - 1]),
  );
}

const css = `
:host { display: inline-block; vertical-align: middle; width: var(--spark-w, 72px); height: var(--spark-h, 24px);
  color: inherit; line-height: 0; }
.ui-root { display: block; width: 100%; height: 100%; }
.sp { --sp-c: currentColor; position: relative; display: block; width: 100%; height: 100%; color: var(--sp-c);
  transition: color var(--dur-fade) ease; }
.sp[data-tone="accent"] { --sp-c: ${LINE_TONES.accent}; }
.sp[data-tone="run"] { --sp-c: ${LINE_TONES.run}; }
.sp[data-tone="done"] { --sp-c: ${LINE_TONES.done}; }
.sp[data-tone="wait"] { --sp-c: ${LINE_TONES.wait}; }
.sp[data-tone="fail"] { --sp-c: ${LINE_TONES.fail}; }
.sp[data-tone="muted"] { --sp-c: ${LINE_TONES.muted}; }
.sp-svg { position: absolute; inset: 0; display: block; width: 100%; height: 100%; overflow: visible; }
.sp-line { fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round;
  vector-effect: non-scaling-stroke; transition: d var(--dur-move) var(--ease-out); }
.sp-area { stroke: none; transition: d var(--dur-move) var(--ease-out); }
.sp-s0 { stop-color: color-mix(in srgb, currentColor 24%, transparent); }
.sp-s1 { stop-color: color-mix(in srgb, currentColor 2%, transparent); }
.sp-dot { position: absolute; width: 5px; height: 5px; margin: -2.5px 0 0 -2.5px; border-radius: 50%;
  background: currentColor; transition: left var(--dur-move) var(--ease-out), top var(--dur-move) var(--ease-out); }
@media (forced-colors: active) { .sp-line, .sp-area, .sp-dot { forced-color-adjust: none; } }
`;

/**
 * `<ui-sparkline>` — a tiny smooth line for a metric row: the trend at a glance beside the number, a dot on the
 * latest value. Set `values` (comma-separated), `tone`, `area`, `label`, `lang` — or `data`. Its size is CSS
 * (`--spark-w` × `--spark-h`, default 72 × 24); without a tone it draws in currentColor, so it reads inside an inverted
 * (selected) row. A new reading patches the nodes in place, so the line glides. role="img" named with a summary.
 */
export class UiSparkline extends UiElement<SparklineData> {
  static override styles = [css];
  static get observedAttributes(): string[] {
    return ['values', 'tone', 'area', 'label', 'lang'];
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  /** What it draws, from `data` first, then the attributes. */
  get reading(): SparklineData {
    const d = this.data;
    return {
      values: Array.isArray(d?.values) ? d.values.map((v) => lineValue(v)) : sparkValues(this.getAttribute('values')),
      tone: lineTone(d?.tone ?? this.getAttribute('tone')),
      area: d?.area ?? this.hasAttribute('area'),
      label: d?.label ?? this.getAttribute('label') ?? '',
      min: d?.min,
      max: d?.max,
    };
  }

  get #lang(): SparkLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  /** Patched in place: the svg, the paths and the dot keep their nodes, so a new reading glides. */
  protected override update(): void {
    morphInto(this.content, this.render());
    this.updated();
  }

  protected render(): string {
    const r = this.reading;
    const pts = sparkPoints(r.values, r.min, r.max);
    const line = monotonePath(pts);
    const area = r.area ? monotoneArea(pts, 100) : '';
    let last: LinePoint | null = null;
    for (const p of pts) if (p) last = p;
    return `<span${attrs({
      class: 'sp',
      part: 'sparkline',
      role: 'img',
      'aria-label': sparkSummary(r.values, r.label, this.#lang),
      'data-tone': r.tone,
    })}><svg class="sp-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">${
      area
        ? '<defs><linearGradient id="sp-g" class="sp-grad" x1="0" y1="0" x2="0" y2="1"><stop class="sp-s0" offset="0"></stop><stop class="sp-s1" offset="1"></stop></linearGradient></defs>'
        : ''
    }${area ? `<path class="sp-area" fill="url(#sp-g)" d="${area}"></path>` : ''}${
      line ? `<path class="sp-line" part="line" d="${line}"></path>` : ''
    }</svg>${last ? `<i class="sp-dot" part="dot" aria-hidden="true" style="left:${last[0]}%;top:${last[1]}%"></i>` : ''}</span>`;
  }
}

define('ui-sparkline', UiSparkline);

declare global {
  interface HTMLElementTagNameMap {
    'ui-sparkline': UiSparkline;
  }
}
