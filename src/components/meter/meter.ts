import { define, UiElement } from '../../core/element';
import { attrs, esc } from '../../core/html';
import { morphInto } from '../../core/morph';

/** `bar` — a short track with a fill · `battery` — the battery glyph with the fill inside it. */
export type MeterShape = 'bar' | 'battery';
/** The colour a reading reads in: done (good) · wait (fair) · fail (bad) · idle (unknown). */
export type MeterTone = 'done' | 'wait' | 'fail' | 'idle';
export type MeterLang = 'en' | 'ko';

/** The scale a reading sits on (the native `<meter>`'s words). */
export interface MeterRange {
  /** The ends (default 0 … 1: fractions; `max: 100` for percentages). */
  min?: number;
  max?: number;
  /** Below `low` is the low region, from `high` up the high region, between them the middle. Without one, no such region. */
  low?: number;
  high?: number;
  /**
   * Which end is good (default `max`: more is better — what is left; `min`: less is better — what is used). The region the
   * reading shares with it is good; a neighbouring region is fair; the far one is bad.
   */
  optimum?: number;
}

export interface MeterData extends MeterRange {
  /** The reading. Missing, null or not a number: unknown (a "?" and no fill). */
  value?: number | null;
  /** The accessible name ("Remaining usage"). */
  label?: string;
  /** The words beside the glyph and the words read out, instead of the percent ("3 of 5 accounts"). */
  text?: string;
  shape?: MeterShape;
  /** The glyph alone, no words beside it (the name still carries the reading). */
  bare?: boolean;
}

const SHAPES: readonly MeterShape[] = ['bar', 'battery'];

const STRINGS = {
  en: { unknown: 'Unknown' },
  ko: { unknown: '미확인' },
};

/** A number from a number or a numeric string; NaN for anything else (null, '', 'soon'). */
export function meterValue(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : Number.NaN;
  if (typeof v !== 'string' || !v.trim()) return Number.NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function meterShape(v: unknown): MeterShape {
  return SHAPES.includes(v as MeterShape) ? (v as MeterShape) : 'bar';
}

/** The range with its defaults in: min 0, max 1 (max never below min), optimum max. */
export function meterRange(
  r: Record<string, unknown> | MeterRange | null | undefined,
): Required<Pick<MeterRange, 'min' | 'max' | 'optimum'>> & Pick<MeterRange, 'low' | 'high'> {
  const d = (r ?? {}) as Record<string, unknown>;
  let min = meterValue(d.min);
  if (Number.isNaN(min)) min = 0;
  let max = meterValue(d.max);
  if (Number.isNaN(max)) max = Math.max(1, min);
  if (max < min) max = min;
  const low = meterValue(d.low);
  const high = meterValue(d.high);
  let optimum = meterValue(d.optimum);
  if (Number.isNaN(optimum)) optimum = max;
  return {
    min,
    max,
    low: Number.isNaN(low) ? undefined : low,
    high: Number.isNaN(high) ? undefined : high,
    optimum: Math.min(max, Math.max(min, optimum)),
  };
}

/** The reading as a share of the range, 0 … 1 (clamped); NaN when unknown or the range is empty. */
export function meterFraction(value: unknown, range?: MeterRange | null): number {
  const v = meterValue(value);
  const { min, max } = meterRange(range);
  if (Number.isNaN(v) || max === min) return Number.NaN;
  return Math.min(1, Math.max(0, (v - min) / (max - min)));
}

/** The reading as a whole percent (72), or NaN when unknown. */
export function meterPercent(value: unknown, range?: MeterRange | null): number {
  const f = meterFraction(value, range);
  return Number.isNaN(f) ? f : Math.round(f * 100);
}

/** 0 below `low`, 2 from `high` up, 1 between (and everywhere when a threshold is not given). */
function region(x: number, low: number | undefined, high: number | undefined): 0 | 1 | 2 {
  if (low !== undefined && x < low) return 0;
  if (high !== undefined && x >= high) return 2;
  return 1;
}

/**
 * The tone a reading reads in: the region it shares with `optimum` is good (done), a neighbouring region is fair
 * (wait), the far one is bad (fail); an unknown reading is idle.
 */
export function meterTone(value: unknown, range?: MeterRange | null): MeterTone {
  const v = meterValue(value);
  if (Number.isNaN(v)) return 'idle';
  const { min, max, low, high, optimum } = meterRange(range);
  const r = region(Math.min(max, Math.max(min, v)), low, high);
  const o = region(optimum, low, high);
  if (r === o) return 'done';
  return Math.abs(r - o) === 2 ? 'fail' : 'wait';
}

/** The words for a reading: `text` as given, else "72%", else "?" (unknown). */
export function meterText(d: { value?: unknown; text?: unknown } & MeterRange): string {
  const own = String(d.text ?? '').trim();
  if (own) return own;
  const pct = meterPercent(d.value, d);
  return Number.isNaN(pct) ? '?' : `${pct}%`;
}

const css = `
:host { display: inline-flex; vertical-align: middle; font: inherit; line-height: 1; }
.ui-root { display: inline-flex; min-width: 0; }
.m {
  --m-ink: var(--ib-muted);
  display: inline-flex; align-items: center; gap: 6px; min-width: 0; color: var(--m-ink);
  font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap;
  transition: color 300ms ease;
}
.m[data-tone="done"] { --m-ink: color-mix(in srgb, var(--st-done) 70%, var(--ib-text)); }
.m[data-tone="wait"] { --m-ink: color-mix(in srgb, var(--st-wait) 70%, var(--ib-text)); }
.m[data-tone="fail"] { --m-ink: color-mix(in srgb, var(--st-fail-text) 70%, var(--ib-text)); }
.m-glyph { position: relative; display: inline-block; flex: none; box-sizing: border-box; overflow: hidden; }
.m-bar .m-glyph { width: var(--meter-w, 48px); height: 6px; border-radius: 3px; background: color-mix(in srgb, currentColor 18%, transparent); }
.m-battery .m-glyph { width: 24px; height: 12px; padding: 1px; border: 1.5px solid currentColor; border-radius: 3px; overflow: visible; }
.m-battery .m-glyph::after { content: ''; position: absolute; right: -4px; top: 2px; width: 2px; height: 4px; border-radius: 0 1px 1px 0; background: currentColor; }
.m-fill { display: block; width: 0; height: 100%; border-radius: inherit; background: currentColor; transition: width var(--dur-move) var(--ease-out), background-color 300ms ease; }
.m-battery .m-fill { border-radius: 1px; }
.m-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
`;

/**
 * `<ui-meter>` — how much is left (or used) of a bounded thing: a short bar or a battery glyph with its fill, a
 * percent (or your own words) beside it, in a tone the thresholds decide (`low` / `high` / `optimum`, the native
 * `<meter>`'s words). Set attributes (`value`, `min`, `max`, `low`, `high`, `optimum`, `label`, `text`, `shape`,
 * `bare`, `lang`) or `data`. A new value moves the fill on --dur-move in place (the nodes stay; nothing re-enters) and
 * changes the words; an unknown reading is a "?" with no fill. role="meter" with the percent as its value and words.
 */
export class UiMeter extends UiElement<MeterData> {
  static override styles = [css];
  static get observedAttributes(): string[] {
    return ['value', 'min', 'max', 'low', 'high', 'optimum', 'label', 'text', 'shape', 'bare', 'lang'];
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  /** What it shows, from `data` first, then the attributes. */
  get reading(): MeterData {
    const d = this.data ?? {};
    const attr = (n: string) => this.getAttribute(n) ?? undefined;
    return {
      value: d.value !== undefined ? d.value : attr('value') === undefined ? undefined : meterValue(attr('value')),
      min: d.min ?? meterValue(attr('min')),
      max: d.max ?? meterValue(attr('max')),
      low: d.low ?? meterValue(attr('low')),
      high: d.high ?? meterValue(attr('high')),
      optimum: d.optimum ?? meterValue(attr('optimum')),
      label: d.label ?? attr('label'),
      text: d.text ?? attr('text'),
      shape: meterShape(d.shape ?? attr('shape')),
      bare: d.bare ?? this.hasAttribute('bare'),
    };
  }

  /** The tone the reading reads in now. */
  get tone(): MeterTone {
    const r = this.reading;
    return meterTone(r.value, r);
  }

  get #lang(): MeterLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  /** Patched in place, so a new value slides the fill and keeps the words' node. */
  protected override update(): void {
    morphInto(this.content, this.render());
    this.updated();
  }

  protected render(): string {
    const r = this.reading;
    const s = STRINGS[this.#lang];
    const tone = meterTone(r.value, r);
    const pct = meterPercent(r.value, r);
    const words = meterText(r);
    const label = String(r.label ?? '').trim();
    const unknown = Number.isNaN(pct);
    // An unknown reading has no value to report: an image named "<label>: unknown" instead of a meter at nothing.
    const a = unknown
      ? attrs({ role: 'img', 'aria-label': label ? `${label}: ${s.unknown}` : s.unknown })
      : attrs({
          role: 'meter',
          'aria-label': label || undefined,
          'aria-valuemin': 0,
          'aria-valuemax': 100,
          'aria-valuenow': pct,
          'aria-valuetext': words,
        });
    const fill = unknown ? 0 : pct;
    return `<span class="m m-${r.shape}" part="meter" data-tone="${tone}"${a}><span class="m-glyph" part="glyph" aria-hidden="true"><span class="m-fill" part="fill" style="width: ${fill}%"></span></span>${
      r.bare ? '' : `<span class="m-text" part="text" aria-hidden="true">${esc(words)}</span>`
    }</span>`;
  }
}

define('ui-meter', UiMeter);

declare global {
  interface HTMLElementTagNameMap {
    'ui-meter': UiMeter;
  }
}
