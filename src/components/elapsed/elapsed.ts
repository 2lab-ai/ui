import { define, UiElement } from '../../core/element';
import { esc, escAttr } from '../../core/html';

/**
 * duration: time since `since` (42s · 9m 22s · 2h 15m). clock: the same as a clock (0:42 · 9:22 · 2:15:07).
 * ago: how long ago (just now · 5m ago · 3h ago · 2d ago). countdown: time left until `until` (3m 12s → 0s, or
 * the host's words after the span and at zero: "3분 후", "24분 후 복귀", "곧 복귀").
 */
export type ElapsedFormat = 'duration' | 'clock' | 'ago' | 'countdown';
/** second: 42s · 9m 22s · 2h 15m. minute: the loose form — 42s · 24m · 1h 20m · 1d 5h (seconds only under a minute). */
export type ElapsedPrecision = 'second' | 'minute';
export type ElapsedLang = 'en' | 'ko';

export interface ElapsedData {
  /** The start (epoch ms, an ISO string or a Date). */
  since?: number | string | Date;
  /** The end: `duration` / `clock` stop here (a finished run's time); `countdown` counts down to it. */
  until?: number | string | Date;
  format?: ElapsedFormat;
  /**
   * `minute` (also the `precision` attribute): the loose form for a duration or countdown — whole minutes past a
   * minute, hours and minutes past an hour, days and hours past a day; seconds only under a minute (24m · 1h 20m ·
   * 1d 5h; ko 24분 · 1시간 20분 · 1일 5시간). Default `second` (9m 22s).
   */
  precision?: ElapsedPrecision;
  /** Words after the time (also the `after` attribute): `left` → "3m 12s left"; ko `후` → "3분 후", `후 복귀` → "24분 후 복귀". */
  after?: string;
  /**
   * A countdown's words from the moment it would read `0s` (under a second left) and after (also the `at-zero`
   * attribute): `now`; ko `곧`, `곧 복귀`. `after` is left off then — never "곧 후". `ui-end` still fires once.
   */
  atZero?: string;
}

/** `ui-end` detail (notification): a countdown reached zero. */
export interface ElapsedEndDetail {
  until: number;
}

const FORMATS: readonly ElapsedFormat[] = ['duration', 'clock', 'ago', 'countdown'];

/** Epoch ms from a number, a numeric string, an ISO string or a Date; NaN when there is none. */
export function elapsedTime(v: unknown): number {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return Number.isFinite(v) ? v : Number.NaN;
  if (typeof v !== 'string' || !v.trim()) return Number.NaN;
  const s = v.trim();
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return Date.parse(s);
}

export function elapsedFormat(v: unknown): ElapsedFormat {
  return FORMATS.includes(v as ElapsedFormat) ? (v as ElapsedFormat) : 'duration';
}

export function elapsedPrecision(v: unknown): ElapsedPrecision {
  return v === 'minute' ? 'minute' : 'second';
}

const UNITS = {
  en: { s: 's', m: 'm', h: 'h', d: 'd', ago: (x: string) => `${x} ago`, now: 'just now' },
  ko: { s: '초', m: '분', h: '시간', d: '일', ago: (x: string) => `${x} 전`, now: '방금' },
};

/** A span of time in words: 42s · 9m 22s · 2h 15m (ko: 42초 · 9분 22초 · 2시간 15분). */
export function fmtSpan(ms: number, lang: ElapsedLang = 'en'): string {
  const u = UNITS[lang] ?? UNITS.en;
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  if (s < 60) return `${s}${u.s}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}${u.m} ${String(s % 60).padStart(2, '0')}${u.s}`;
  const h = Math.floor(m / 60);
  return `${h}${u.h} ${String(m % 60).padStart(2, '0')}${u.m}`;
}

/**
 * The loose form, at minute precision: 42s · 24m · 1h 20m · 1d 5h (ko: 42초 · 24분 · 1시간 20분 · 1일 5시간) —
 * floored, seconds only under a minute, no zero padding. The dashboard's "time left" rule for a scheduled run.
 */
export function fmtSpanCoarse(ms: number, lang: ElapsedLang = 'en'): string {
  const u = UNITS[lang] ?? UNITS.en;
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  if (s < 60) return `${s}${u.s}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}${u.m}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}${u.h} ${m % 60}${u.m}`;
  return `${Math.floor(h / 24)}${u.d} ${h % 24}${u.h}`;
}

/** As a clock: 0:42 · 9:22 · 2:15:07. */
export function fmtStopwatch(ms: number): string {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** How long ago: just now · 5m ago · 3h ago · 2d ago (ko: 방금 · 5분 전 · 3시간 전 · 2일 전). */
export function fmtSince(ms: number, lang: ElapsedLang = 'en'): string {
  const u = UNITS[lang] ?? UNITS.en;
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  if (s < 45) return u.now;
  const m = Math.floor(s / 60);
  if (m < 60) return u.ago(`${Math.max(1, m)}${u.m}`);
  const h = Math.floor(m / 60);
  if (h < 48) return u.ago(`${h}${u.h}`);
  return u.ago(`${Math.floor(h / 24)}${u.d}`);
}

const words = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * The words for a moment: what the element shows for `since` / `until` at `now` — at `precision`, with `after`
 * following the time and, for a countdown that would read 0s (under a second left) or is past, `atZero` alone.
 * Empty without the times it needs.
 */
export function elapsedText(
  d: { since?: unknown; until?: unknown; format?: unknown; precision?: unknown; after?: unknown; atZero?: unknown },
  now: number,
  lang: ElapsedLang = 'en',
): string {
  const format = elapsedFormat(d.format);
  const since = elapsedTime(d.since);
  const until = elapsedTime(d.until);
  const after = words(d.after);
  const span = elapsedPrecision(d.precision) === 'minute' ? fmtSpanCoarse : fmtSpan;
  const tail = (t: string): string => (t && after ? `${t} ${after}` : t);
  if (format === 'countdown') {
    if (Number.isNaN(until)) return '';
    const left = until - now;
    const atZero = words(d.atZero);
    return left < 1000 && atZero ? atZero : tail(span(Math.max(0, left), lang));
  }
  if (Number.isNaN(since)) return '';
  const end = Number.isNaN(until) ? now : until;
  if (format === 'clock') return tail(fmtStopwatch(end - since));
  if (format === 'ago') return tail(fmtSince(end - since, lang));
  return tail(span(end - since, lang));
}

/** Does this element still change with time? (A finished duration does not; a countdown at zero does not.) */
export function elapsedTicks(d: { since?: unknown; until?: unknown; format?: unknown }, now: number): boolean {
  const format = elapsedFormat(d.format);
  const until = elapsedTime(d.until);
  if (format === 'countdown') return !Number.isNaN(until) && until > now;
  return !Number.isNaN(elapsedTime(d.since)) && Number.isNaN(until);
}

// One ticker for every element on the page, on whole seconds, so all of them turn together.
const live = new Set<UiElapsed>();
let timer: ReturnType<typeof setTimeout> | undefined;
function tickAll(): void {
  timer = undefined;
  for (const el of live) el.tick();
  schedule();
}
function schedule(): void {
  if (timer !== undefined || !live.size) return;
  timer = setTimeout(tickAll, 1000 - (Date.now() % 1000) + 5);
}
function watch(el: UiElapsed, on: boolean): void {
  if (on) {
    live.add(el);
    schedule();
  } else {
    live.delete(el);
    if (!live.size && timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }
}

const css = `
:host { display: inline; font: inherit; color: inherit; letter-spacing: inherit; font-variant-numeric: tabular-nums;
  white-space: nowrap; }
.ui-root { display: inline; }
time { font: inherit; color: inherit; }
`;

/**
 * `<ui-elapsed>` — a live time: how long something has run, how long ago it happened, or how long is left. Set
 * attributes (`since`, `until`, `format`, `precision`, `after`, `at-zero`, `lang`) or `data`; it ticks on one shared
 * whole-second timer and changes
 * its text in place (never a re-render), stops by itself when the time is final, and inherits the font around it.
 */
export class UiElapsed extends UiElement<ElapsedData> {
  static override styles = [css];
  static get observedAttributes(): string[] {
    return ['since', 'until', 'format', 'lang', 'precision', 'after', 'at-zero'];
  }

  #ended = false;

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override disconnectedCallback(): void {
    watch(this, false);
    super.disconnectedCallback();
  }

  /** What it shows, from `data` first, then the attributes. */
  get value(): {
    since?: unknown;
    until?: unknown;
    format: ElapsedFormat;
    precision: ElapsedPrecision;
    after?: string;
    atZero?: string;
  } {
    const d = this.data ?? {};
    return {
      since: d.since ?? this.getAttribute('since') ?? undefined,
      until: d.until ?? this.getAttribute('until') ?? undefined,
      format: elapsedFormat(d.format ?? this.getAttribute('format')),
      precision: elapsedPrecision(d.precision ?? this.getAttribute('precision')),
      after: words(d.after ?? this.getAttribute('after')),
      atZero: words(d.atZero ?? this.getAttribute('at-zero')),
    };
  }

  get #lang(): ElapsedLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  protected render(): string {
    this.#ended = false;
    const v = this.value;
    const at = v.format === 'countdown' ? elapsedTime(v.until) : elapsedTime(v.since);
    const iso = Number.isNaN(at) ? '' : new Date(at).toISOString();
    const title = Number.isNaN(at) ? '' : new Date(at).toLocaleString(this.#lang === 'ko' ? 'ko-KR' : 'en-US');
    return `<time part="time"${iso ? ` datetime="${escAttr(iso)}" title="${escAttr(title)}"` : ''}>${esc(elapsedText(v, Date.now(), this.#lang))}</time>`;
  }

  protected override updated(): void {
    watch(this, this.isConnected && elapsedTicks(this.value, Date.now()));
  }

  /** One tick: the text node changes in place; a final time leaves the ticker; a countdown at zero says so once. */
  tick(): void {
    const node = this.root.querySelector('time');
    if (!node) return;
    const v = this.value;
    const now = Date.now();
    const text = elapsedText(v, now, this.#lang);
    if (node.textContent !== text) node.textContent = text;
    if (elapsedTicks(v, now)) return;
    watch(this, false);
    if (v.format === 'countdown' && !this.#ended) {
      this.#ended = true;
      this.notify<ElapsedEndDetail>('ui-end', { until: elapsedTime(v.until) });
    }
  }
}

define('ui-elapsed', UiElapsed);

declare global {
  interface HTMLElementTagNameMap {
    'ui-elapsed': UiElapsed;
  }
}
