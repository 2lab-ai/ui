import { define, UiElement } from '../../core/element';
import { attrs, esc } from '../../core/html';
import { morphInto } from '../../core/morph';
import { type MeterTone, meterTone, meterValue } from '../meter/meter';
import {
  DIAL_RING_RADIUS,
  type DialData,
  type DialLang,
  dialArc,
  dialArcLength,
  dialArcPath,
  dialDeltaText,
  dialDeltaTone,
  dialFilled,
  dialFraction,
  dialNumber,
  dialRange,
  dialShape,
  dialSize,
  dialStagger,
  dialTickCount,
  dialTickGeometry,
  dialTone,
} from './logic';
import { styles } from './styles';

export const STRINGS = {
  en: {
    unknown: 'Unknown',
    outOf: (max: string) => `out of ${max}`,
    valueText: (main: string, caption: string) => (caption ? `${main} ${caption}` : main),
  },
  ko: {
    unknown: '미확인',
    outOf: (max: string) => `${max}점 만점`,
    valueText: (main: string, caption: string) => (caption ? `${main}, ${caption}` : main),
  },
};

/** Words in the middle longer than this get the smaller type. */
const SHORT_WORDS = 5;

/**
 * `<ui-dial>` — one bounded score at a glance: a gauge of short radial ticks on a 270° arc (filled up to the value,
 * the rest muted) or a thick ring with its value arc, a big number in the middle with a small caption under it
 * ("out of 100"), and an optional change chip below ("+4 since last week") toned by whether it moved toward `optimum`.
 * The tone is the meter's (`low` / `high` / `optimum`). Set attributes (`value`, `min`, `max`, `low`, `high`,
 * `optimum`, `label`, `text`, `caption`, `unit`, `shape`, `ticks`, `arc`, `tone`, `size`, `lang`) or `data` (wins).
 * A new value patches in place: the ring's arc slides on --dur-move, the ticks change one after another. An unknown
 * reading is a "?" with nothing filled, role="img" "<label>: Unknown"; otherwise role="meter".
 */
export class UiDial extends UiElement<DialData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return [
      'value',
      'min',
      'max',
      'low',
      'high',
      'optimum',
      'label',
      'text',
      'caption',
      'unit',
      'shape',
      'ticks',
      'arc',
      'tone',
      'size',
      'lang',
    ];
  }

  /** The filled tick count on screen, so the next sweep staggers from there. */
  #shown: number | undefined;
  #next: number | undefined;

  attributeChangedCallback(): void {
    this.requestRender();
  }

  /** What it shows, from `data` first, then the attributes. */
  get reading(): DialData & { shape: NonNullable<DialData['shape']>; ticks: number; arc: number } {
    const d = this.data ?? {};
    const attr = (n: string) => this.getAttribute(n) ?? undefined;
    const num = (n: string) => (attr(n) === undefined ? undefined : meterValue(attr(n)));
    const shape = dialShape(d.shape ?? attr('shape'));
    return {
      value: d.value !== undefined ? d.value : num('value'),
      min: d.min ?? num('min'),
      max: d.max ?? num('max'),
      low: d.low ?? num('low'),
      high: d.high ?? num('high'),
      optimum: d.optimum ?? num('optimum'),
      label: d.label ?? attr('label'),
      text: d.text ?? attr('text'),
      caption: d.caption ?? attr('caption'),
      unit: d.unit ?? attr('unit'),
      delta: d.delta,
      shape,
      ticks: dialTickCount(d.ticks ?? attr('ticks')),
      arc: dialArc(d.arc ?? attr('arc'), shape),
      tone: dialTone(d.tone ?? attr('tone')),
      size: d.size ?? attr('size'),
    };
  }

  /** The tone the thresholds give the reading now (done · wait · fail · idle) — under tone="accent" too. */
  get tone(): MeterTone {
    const r = this.reading;
    return meterTone(r.value, dialRange(r));
  }

  get #lang(): DialLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  /** Patched in place, so a new value slides the arc and turns the ticks on the nodes that are there. */
  protected override update(): void {
    morphInto(this.content, this.render());
    this.#shown = this.#next;
    this.updated();
  }

  protected render(): string {
    const r = this.reading;
    const lang = this.#lang;
    const s = STRINGS[lang];
    const range = dialRange(r);
    const f = dialFraction(r.value, range);
    const unknown = Number.isNaN(f);
    const tone = unknown ? 'idle' : r.tone === 'accent' ? 'accent' : meterTone(r.value, range);
    const value = meterValue(r.value);
    const unit = String(r.unit ?? '').trim();
    const words = String(r.text ?? '').trim();
    const shown = words || (unknown ? '?' : `${dialNumber(value, lang)}${unit}`);
    const caption =
      r.caption !== undefined && r.caption !== null
        ? String(r.caption).trim()
        : words || unit
          ? ''
          : s.outOf(dialNumber(range.max, lang));
    const valueText = s.valueText(shown, caption);
    const label = String(r.label ?? '').trim();
    const a = unknown
      ? attrs({ role: 'img', 'aria-label': label ? `${label}: ${s.unknown}` : s.unknown })
      : attrs({
          role: 'meter',
          'aria-label': label || valueText,
          'aria-valuemin': range.min,
          'aria-valuemax': range.max,
          'aria-valuenow': Math.min(range.max, Math.max(range.min, value)),
          'aria-valuetext': valueText,
        });
    const size = dialSize(r.size);
    const filled = unknown ? 0 : dialFilled(f, r.ticks);
    this.#next = filled;
    const marks = r.shape === 'ring' ? this.#ring(r.arc, unknown ? 0 : f) : this.#ticks(r.ticks, r.arc, filled);
    const middle = words
      ? `<span class="d-num is-words"${words.length > SHORT_WORDS ? ' data-long' : ''}>${esc(words)}</span>`
      : `<span class="d-num">${esc(unknown ? '?' : dialNumber(value, lang))}${
          unit && !unknown ? `<span class="d-unit">${esc(unit)}</span>` : ''
        }</span>`;
    return `<div class="d d-${r.shape}" part="dial" data-tone="${tone}"><div class="d-face" part="face"${a}${
      size ? ` style="--dial-size: ${size}"` : ''
    }><svg class="d-svg" part="svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${marks}</svg><div class="d-center" aria-hidden="true">${middle}${
      caption ? `<span class="d-cap" part="caption">${esc(caption)}</span>` : ''
    }</div></div>${this.#delta(r, range, lang)}</div>`;
  }

  #ticks(n: number, arc: number, filled: number): string {
    const { width, ticks } = dialTickGeometry(n, arc);
    const from = this.#shown ?? filled;
    const lines = ticks
      .map((t, i) => {
        const delay = dialStagger(i, from, filled);
        return `<line class="d-tick${i < filled ? ' is-on' : ''}" x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}"${
          delay ? ` style="transition-delay: ${delay}ms"` : ''
        }/>`;
      })
      .join('');
    return `<g class="d-ticks" stroke-width="${width}">${lines}</g>`;
  }

  #ring(arc: number, f: number): string {
    const d = dialArcPath(arc, DIAL_RING_RADIUS);
    const len = dialArcLength(arc, DIAL_RING_RADIUS);
    const offset = Math.round(len * (1 - f) * 100) / 100;
    return `<g class="d-rings"><path class="d-track" d="${d}"/><path class="d-arc${f > 0 ? '' : ' is-zero'}" d="${d}" style="stroke-dasharray: ${len} ${len}; stroke-dashoffset: ${offset}"/></g>`;
  }

  #delta(r: DialData, range: ReturnType<typeof dialRange>, lang: DialLang): string {
    const v = meterValue(r.delta?.value);
    if (Number.isNaN(v)) return '';
    const tone = dialDeltaTone(v, range.optimum, range);
    const unit = String(r.unit ?? '').trim();
    const text = String(r.delta?.text ?? '').trim();
    return `<p class="d-delta" part="delta" data-tone="${tone}"><span class="d-delta-n">${esc(dialDeltaText(v, lang))}${esc(
      v !== 0 ? unit : '',
    )}</span>${text ? `<span class="d-delta-t">${esc(text)}</span>` : ''}</p>`;
  }
}

define('ui-dial', UiDial);

declare global {
  interface HTMLElementTagNameMap {
    'ui-dial': UiDial;
  }
}

export type { DialData, DialDelta, DialDeltaTone, DialLang, DialShape, DialTick, DialTone } from './logic';
