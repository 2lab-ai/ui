import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { clamp, fmtDuration, fmtInt, fmtTokens } from '../../core/format';
import { attrs, esc, escAttr } from '../../core/html';
import { morphInto } from '../../core/morph';
import { icon } from '../../icons/icons';
import '../segmented/segmented';
import type { SegmentedChange, SegmentedData, UiSegmented } from '../segmented/segmented';
import '../tooltip/tooltip';
import type { UiTooltip } from '../tooltip/tooltip';
import { styles } from './styles';

/** How a figure is written: 1,234 · 12.3K · 4.6M · $1,234.50 · 42% · 9m 22s. */
export type MetricFormat = 'int' | 'compact' | 'tokens' | 'usd' | 'percent' | 'duration';

export type StatLang = 'en' | 'ko';

/** One line of a figure's breakdown (label · value). */
export interface StatBreakdownRow {
  label: string;
  /** `null` = no data ("—"). */
  value: number | null;
  /** Defaults to the metric's format. */
  format?: MetricFormat;
}

/** What a figure is made of, shown in a card tooltip from the figure. */
export interface StatBreakdown {
  /** e.g. "Tokens by environment". */
  title?: string;
  rows: StatBreakdownRow[];
}

/** One figure on the strip. */
export interface StatMetric {
  /** Stable id: the figure rolls from its last value under the same key. Unique within the strip. */
  key: string;
  /** Short sentence-case label ("Sessions"). */
  label: string;
  /** `null` / missing = no data ("—"). */
  value?: number | null;
  /** Default `'int'`. `duration` takes milliseconds; `percent` takes 0–100. */
  format?: MetricFormat;
  /** A skeleton bar instead of the figure. */
  loading?: boolean;
  /** Makes the figure a button that shows this breakdown in a card tooltip. */
  breakdown?: StatBreakdown;
  /** Plain tooltip text for the figure when there is no breakdown. */
  hint?: string;
  /**
   * Where the figure rolls from when it lands a value with none on screen (first paint, after loading or no
   * data): a number, or `'last'` — the value it showed before its loading bar (kept under the bar). Without it
   * such a value appears at once. A figure that already shows a value always rolls on from it.
   */
  from?: number | 'last';
  /**
   * A free-form figure: the name of a slot whose light-DOM content is drawn in the figure's place ("+1,204 /
   * −318", a name: count list). No roll, no breakdown; `loading` still shows the bar.
   */
  slot?: string;
  /** `layout: 'cards'`: the card spans two columns (a long free-form figure). */
  wide?: boolean;
}

/** `line`: label · figure pairs on one line (default). `cards`: a grid of tiles — label above a large figure. */
export type StatLayout = 'line' | 'cards';

/** A period option (the inner `<ui-segmented>` option). */
export interface StatPeriodOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface StatPeriod {
  options: StatPeriodOption[];
  /** The chosen period's value. */
  value?: string;
  /** Accessible name of the period control. Default "Period" / "기간". */
  label?: string;
}

export interface StatMore {
  /** Toggle text. Default "More" / "자세히". */
  label?: string;
  /** Sets the region open or closed without an event (when it changes). */
  open?: boolean;
}

export interface StatStripData {
  /** The period control at the start of the line. Left out = no control. */
  period?: StatPeriod;
  metrics: StatMetric[];
  /** Every figure shows a skeleton. */
  loading?: boolean;
  /** Shows the More toggle at the end of the line; its region holds the element's default slot. */
  more?: boolean | StatMore;
  /** Accessible name of the strip. Default "Usage" / "사용량". */
  label?: string;
  /** Default `'line'`. `'cards'` draws each figure as a tile in a grid (the detail behind More, a dashboard row). */
  layout?: StatLayout;
}

/** `ui-period` detail. */
export interface StatPeriodChange {
  value: string;
  previous: string | undefined;
}

/** `ui-more` detail: the state the person asked for. */
export interface StatMoreToggle {
  open: boolean;
}

/** A figure's change rolls over this long (ease-out quart). */
export const STAT_ROLL_MS = 620;

const FORMATS: readonly MetricFormat[] = ['int', 'compact', 'tokens', 'usd', 'percent', 'duration'];

const STRINGS = {
  en: { label: 'Usage', period: 'Period', more: 'More', noData: 'No data', loading: 'Loading' },
  ko: { label: '사용량', period: '기간', more: '자세히', noData: '데이터 없음', loading: '불러오는 중' },
};
type Strings = (typeof STRINGS)['en'];

const NONE = '—';

/** The metric's slot name ('' = a plain figure). */
function slotOf(m: StatMetric): string {
  return typeof m.slot === 'string' ? m.slot.trim() : '';
}

/** A known format, else `'int'`. */
export function metricFormat(f: unknown): MetricFormat {
  return FORMATS.includes(f as MetricFormat) ? (f as MetricFormat) : 'int';
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function trim1(x: number): string {
  const s = x.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

function fmtCompact(v: number): string {
  return Math.abs(v) >= 1_000_000_000 ? `${trim1(v / 1_000_000_000)}B` : fmtTokens(v);
}

function fmtMoney(v: number): string {
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v < 0 && s !== '0.00' ? '-' : ''}$${s}`;
}

function fmtPercent(v: number): string {
  return `${Math.abs(v) < 10 ? trim1(v) : String(Math.round(v))}%`;
}

function fmtDurationKo(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m}분 ${s % 60}초` : `${m}분`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}시간 ${m % 60}분` : `${h}시간`;
}

/**
 * A figure as text. Anything but a finite number is "—" (no data).
 * int 1,234 · compact 12.3K / 1.2B · tokens 4.6M · usd $1,234.50 · percent 42% / 7.5% · duration (ms) 9m 22s / 9분 22초.
 */
export function fmtMetric(value: unknown, format: MetricFormat = 'int', lang: StatLang = 'en'): string {
  if (!isNum(value)) return NONE;
  switch (metricFormat(format)) {
    case 'compact':
      return fmtCompact(value);
    case 'tokens':
      return fmtTokens(value);
    case 'usd':
      return fmtMoney(value);
    case 'percent':
      return fmtPercent(value);
    case 'duration':
      return lang === 'ko' ? fmtDurationKo(value) : fmtDuration(value);
    default:
      return fmtInt(value);
  }
}

/** Ease-out quart: fast start, long soft landing. */
export function easeOutQuart(p: number): number {
  return 1 - (1 - clamp(p, 0, 1)) ** 4;
}

/** The value a rolling figure shows at progress `p` (0 → 1) between `from` and `to`. */
export function rollValue(from: number, to: number, p: number): number {
  return p >= 1 ? to : from + (to - from) * easeOutQuart(p);
}

/** The metrics worth drawing: objects, a key each (index fallback), first of each key. */
export function statMetrics(d: StatStripData | undefined): StatMetric[] {
  const seen = new Set<string>();
  const out: StatMetric[] = [];
  const list = Array.isArray(d?.metrics) ? d.metrics : [];
  list.forEach((m, i) => {
    if (!m || typeof m !== 'object') return;
    const key = typeof m.key === 'string' && m.key ? m.key : `#${i}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(key === m.key ? m : { ...m, key });
  });
  return out;
}

function moreOf(d: StatStripData | undefined): StatMore | null {
  const m = d?.more;
  if (m === true) return {};
  return m && typeof m === 'object' ? m : null;
}

function hasPeriod(d: StatStripData | undefined): d is StatStripData & { period: StatPeriod } {
  return !!d?.period && Array.isArray(d.period.options) && d.period.options.length > 0;
}

interface Roll {
  from: number;
  to: number;
  fmt: MetricFormat;
  /** rAF time of the first frame; -1 until it runs. */
  t0: number;
}

/**
 * `<ui-stat-strip>` — how much happened in this period: a period control, a few figures that roll to their new
 * value, a breakdown card behind any figure, and a More toggle that opens the host's detail below the line.
 * Choosing a period sends a cancelable `ui-period`; the toggle sends a cancelable `ui-more`.
 */
export class UiStatStrip extends UiElement<StatStripData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang', 'open', 'theme'];
  }

  #open = false;
  #reflecting = false;
  /** The region finished opening (stops clipping, so focus rings inside are whole). */
  #settled = false;
  /** Last `data.more.open` seen: only a change of it moves the region. */
  #dataOpen: boolean | undefined;
  /** The value each figure shows right now (mid-roll included), with the format it was written in. */
  #shown = new Map<string, { v: number; fmt: MetricFormat }>();
  /** What a figure showed when its loading bar came: `from: 'last'` rolls from it when the answer lands. */
  #kept = new Map<string, { v: number; fmt: MetricFormat }>();
  #rolls = new Map<string, Roll>();
  #raf = 0;
  /** The breakdown tooltip pressed, and whether it was open before the press hid it. */
  #down: { tip: UiTooltip; open: boolean } | null = null;
  /** A tooltip opened by a press: a press anywhere else closes it (touch has no hover to end it). */
  #pinned: UiTooltip | null = null;

  constructor() {
    super();
    this.root.addEventListener('ui-change', (e) => this.#onPeriod(e as CustomEvent<SegmentedChange>));
    // Capture: runs before the tooltip's own pointerdown on the trigger, which hides it.
    this.root.addEventListener('pointerdown', (e) => this.#onDown(e), true);
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('transitionend', (e) => this.#onTransitionEnd(e as TransitionEvent));
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === 'open') {
      if (!this.#reflecting) this.#set(value !== null);
      return;
    }
    this.requestRender();
  }

  override disconnectedCallback(): void {
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    // A roll cut short lands: reattached, the figure shows its value instead of resuming mid-way.
    for (const [key, r] of this.#rolls) this.#shown.set(key, { v: r.to, fmt: r.fmt });
    this.#rolls.clear();
    this.#unpin();
    this.#down = null;
  }

  /** Whether the More region is open. Setting it opens or closes without an event. */
  get open(): boolean {
    return this.#open;
  }

  set open(v: boolean) {
    this.#set(!!v);
  }

  /** The person asked to toggle the region: a cancelable `ui-more`, then the change unless a listener cancelled it. */
  toggle(): void {
    if (!moreOf(this.data)) return;
    const next = !this.#open;
    if (this.emit<StatMoreToggle>('ui-more', { open: next })) this.#set(next);
  }

  get #lang(): StatLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #t(): Strings {
    return STRINGS[this.#lang];
  }

  get #theme(): string | undefined {
    const v = this.getAttribute('theme');
    return v === 'light' || v === 'dark' ? v : undefined;
  }

  #apply(v: boolean): boolean {
    if (v === this.#open) return false;
    this.#open = v;
    // Under reduced motion there is no transition to wait for.
    this.#settled = v && prefersReducedMotion();
    this.#reflecting = true;
    this.toggleAttribute('open', v);
    this.#reflecting = false;
    return true;
  }

  #set(v: boolean): void {
    if (this.#apply(v)) this.requestRender();
  }

  /** `data.more.open` moves the region only when it changes, so a person's toggle survives unrelated updates. */
  #syncData(): void {
    const m = this.data?.more;
    const v = m && typeof m === 'object' && typeof m.open === 'boolean' ? m.open : undefined;
    if (v === this.#dataOpen) return;
    this.#dataOpen = v;
    if (v !== undefined) this.#apply(v);
  }

  /**
   * Patch the live tree: the inner segmented and tooltips keep their node (their thumb, their open bubble), a
   * figure's text node is rolled in place, and the region keeps its running transition.
   */
  protected override update(): void {
    this.#syncData();
    // A region drawn open from the start (first paint, More just enabled) has no transition to wait for.
    if (this.#open && !this.$('.ss-region')) this.#settled = true;
    morphInto(this.content, this.render());
    this.updated();
  }

  protected render(): string {
    const d = this.data;
    if (!d) return '';
    const t = this.#t;
    const metrics = statMetrics(d);
    const period = hasPeriod(d);
    const more = moreOf(d);
    if (!metrics.length && !period && !more) return '';
    const busy = !!d.loading || metrics.some((m) => m.loading);
    const seg = period
      ? `<ui-segmented${attrs({ class: 'ss-period', size: 'sm', part: 'period', theme: this.#theme })}></ui-segmented>`
      : '';
    const nums = metrics.map((m, i) => this.#metric(m, i, !!d.loading, t)).join('');
    const open = !!more && this.#open;
    const toggle = more
      ? `<button${attrs({
          type: 'button',
          class: 'ss-more',
          part: 'more',
          'data-key': 'more',
          'aria-expanded': String(open),
          'aria-controls': 'ss-region',
        })}><span class="ss-more-t">${esc(more.label || t.more)}</span>${icon('chevron-down', {
          class: 'ss-chev',
          size: 12,
        })}</button>`
      : '';
    const region = more
      ? `<div${attrs({ class: 'ss-region', id: 'ss-region', part: 'region', inert: !open })}><div class="ss-inner"><div class="ss-body" part="body"><slot></slot></div></div></div>`
      : '';
    return `<section${attrs({
      class: 'ss',
      role: 'group',
      'aria-label': d.label || t.label,
      'aria-busy': busy ? 'true' : undefined,
      'data-layout': d.layout === 'cards' ? 'cards' : undefined,
      'data-open': open,
      'data-settled': open && this.#settled,
    })}><div${attrs({ class: 'ss-row', 'data-period': period })}>${seg}${
      nums ? `<dl class="ss-nums">${nums}</dl>` : ''
    }${toggle}</div>${region}</section>`;
  }

  #metric(m: StatMetric, i: number, allLoading: boolean, t: Strings): string {
    const lang = this.#lang;
    const fmt = metricFormat(m.format);
    const loading = allLoading || !!m.loading;
    let fig: string;
    const slot = slotOf(m);
    if (loading) {
      fig = `<span class="ss-sk" aria-hidden="true"></span><span class="sr-only">${esc(t.loading)}</span>`;
    } else if (slot) {
      fig = `<span class="ss-free"><slot name="${escAttr(slot)}"><span class="ss-fig is-none">${NONE}</span></slot></span>`;
    } else if (!isNum(m.value)) {
      fig = `<span class="ss-fig is-none" aria-hidden="true">${NONE}</span><span class="sr-only">${esc(t.noData)}</span>`;
    } else {
      // Mid-roll the figure keeps the value it shows; the roll carries it on from there (updated()).
      const shown = this.#shown.get(m.key);
      const now = shown && shown.fmt === fmt ? shown.v : m.value;
      fig = `<span class="ss-fig" aria-hidden="true">${esc(fmtMetric(now, fmt, lang))}</span><span class="sr-only">${esc(
        fmtMetric(m.value, fmt, lang),
      )}</span>`;
    }
    const tip = loading || slot ? null : this.#tip(m, i, fmt, lang);
    const val = tip
      ? `<ui-tooltip${attrs({
          class: 'ss-tip',
          variant: tip.card ? 'card' : undefined,
          placement: 'bottom-start',
          theme: this.#theme,
        })}><button${attrs({
          type: 'button',
          class: 'ss-fig-btn',
          'data-key': `fig:${m.key}`,
          'aria-describedby': tip.id,
        })}>${fig}</button>${tip.html}</ui-tooltip>`
      : fig;
    return `<div class="ss-m" data-mk="m:${escAttr(m.key)}" data-metric="${escAttr(m.key)}"${
      m.wide ? ' data-wide' : ''
    } style="--i: ${i}"><dt class="ss-label">${esc(m.label)}</dt><dd class="ss-val">${val}</dd></div>`;
  }

  /**
   * The tooltip content, in light DOM of the inner `<ui-tooltip>` (so the button can point at it with
   * aria-describedby). It carries its own id, so a re-render never strips what the tooltip wired up.
   */
  #tip(
    m: StatMetric,
    i: number,
    fmt: MetricFormat,
    lang: StatLang,
  ): { id: string; html: string; card: boolean } | null {
    const id = `ss-tip-${i}`;
    const bd = m.breakdown;
    const rows = Array.isArray(bd?.rows) ? bd.rows.filter((r) => r && typeof r === 'object') : [];
    if (bd && (bd.title || rows.length)) {
      const list = rows
        .map(
          (r) =>
            `<div><dt>${esc(r.label)}</dt><dd>${esc(fmtMetric(r.value, metricFormat(r.format ?? fmt), lang))}</dd></div>`,
        )
        .join('');
      return {
        id,
        card: true,
        html: `<div class="ss-bd" slot="content" id="${id}">${
          bd.title ? `<p class="ss-bd-title">${esc(bd.title)}</p>` : ''
        }${list ? `<dl class="ss-bd-rows">${list}</dl>` : ''}</div>`,
      };
    }
    if (typeof m.hint === 'string' && m.hint)
      return { id, card: false, html: `<span class="ss-hint" slot="content" id="${id}">${esc(m.hint)}</span>` };
    return null;
  }

  protected override updated(): void {
    const seg = this.$<UiSegmented>('.ss-period');
    const p = this.data?.period;
    if (seg && p) {
      const label = p.label || this.#t.period;
      const cur = seg.data;
      if (!cur || cur.options !== p.options || cur.value !== p.value || cur.label !== label)
        seg.data = { options: p.options, value: p.value, label } satisfies SegmentedData;
    }
    this.#syncRolls();
  }

  // ── rolling figures ───────────────────────────────────────────────────────

  /** The figure's text element for a metric key (keys may hold any character: compared, never put in a selector). */
  #fig(key: string): HTMLElement | null {
    const row = this.$$<HTMLElement>('.ss-m').find((el) => el.dataset.metric === key);
    return row?.querySelector<HTMLElement>('.ss-fig:not(.is-none)') ?? null;
  }

  /**
   * Start, retarget or land each figure's roll. A figure jumps on first paint, on its first value (after loading
   * or no data), on a change of format and under reduced motion — unless its `from` gives it a start: a number,
   * or `'last'` (the value kept under its loading bar).
   */
  #syncRolls(): void {
    const d = this.data;
    const lang = this.#lang;
    const still = prefersReducedMotion() || typeof requestAnimationFrame !== 'function';
    const seen = new Set<string>();
    for (const m of statMetrics(d)) {
      seen.add(m.key);
      const fmt = metricFormat(m.format);
      if (d?.loading || m.loading || !isNum(m.value)) {
        // The loading bar hides the figure but keeps what it showed (mid-roll: the value on screen); no data
        // ("—") forgets it.
        const was = this.#shown.get(m.key);
        if (was && (d?.loading || m.loading)) this.#kept.set(m.key, was);
        else if (!(d?.loading || m.loading)) this.#kept.delete(m.key);
        this.#shown.delete(m.key);
        this.#rolls.delete(m.key);
        continue;
      }
      const to = m.value;
      const roll = this.#rolls.get(m.key);
      if (roll && roll.to === to && roll.fmt === fmt) continue;
      let prev = this.#shown.get(m.key);
      if (!prev) {
        const start = m.from === 'last' ? this.#kept.get(m.key) : isNum(m.from) ? { v: m.from, fmt } : undefined;
        if (start && start.fmt === fmt && start.v !== to && !still) {
          prev = start;
          this.#shown.set(m.key, start);
          // Drawn with the answer a moment ago: back to the start before the first frame paints.
          const el = this.#fig(m.key);
          if (el) el.textContent = fmtMetric(start.v, fmt, lang);
        }
      }
      this.#kept.delete(m.key);
      if (!prev || prev.fmt !== fmt || prev.v === to || still) {
        this.#rolls.delete(m.key);
        this.#shown.set(m.key, { v: to, fmt });
        const el = this.#fig(m.key);
        if (el) el.textContent = fmtMetric(to, fmt, lang);
        continue;
      }
      this.#rolls.set(m.key, { from: prev.v, to, fmt, t0: -1 });
    }
    for (const key of Array.from(this.#shown.keys())) if (!seen.has(key)) this.#shown.delete(key);
    for (const key of Array.from(this.#kept.keys())) if (!seen.has(key)) this.#kept.delete(key);
    for (const key of Array.from(this.#rolls.keys())) if (!seen.has(key)) this.#rolls.delete(key);
    if (this.#rolls.size && !this.#raf && this.isConnected) this.#raf = requestAnimationFrame(this.#tick);
    else if (!this.#rolls.size && this.#raf) {
      cancelAnimationFrame(this.#raf);
      this.#raf = 0;
    }
  }

  readonly #tick = (now: number): void => {
    this.#raf = 0;
    const lang = this.#lang;
    for (const [key, r] of this.#rolls) {
      if (r.t0 < 0) r.t0 = now;
      const p = Math.min(1, (now - r.t0) / STAT_ROLL_MS);
      const v = rollValue(r.from, r.to, p);
      this.#shown.set(key, { v, fmt: r.fmt });
      const el = this.#fig(key);
      if (el) el.textContent = fmtMetric(v, r.fmt, lang);
      if (p >= 1) this.#rolls.delete(key);
    }
    if (this.#rolls.size && this.isConnected) this.#raf = requestAnimationFrame(this.#tick);
  };

  // ── input ─────────────────────────────────────────────────────────────────

  /** Only events from our own shadow tree: slotted host content (the More region) keeps its events. */
  #hit(e: Event, selector: string): HTMLElement | null {
    const t = e.target as Element | null;
    if (!t || typeof t.closest !== 'function' || t.getRootNode() !== this.root) return null;
    return t.closest<HTMLElement>(selector);
  }

  /** The inner segmented's `ui-change` never leaves: it becomes a cancelable `ui-period`. */
  #onPeriod(e: CustomEvent<SegmentedChange>): void {
    const seg = this.$('.ss-period');
    if (!seg || e.target !== seg) return;
    e.stopPropagation();
    const { value, previous } = e.detail ?? ({} as SegmentedChange);
    if (!this.emit<StatPeriodChange>('ui-period', { value, previous })) {
      e.preventDefault(); // the segmented keeps the old value
      return;
    }
    // Optimistic on top of the LATEST data: a listener that set a period of its own wins.
    const d = this.data;
    if (d?.period && d.period.value === previous) this.data = { ...d, period: { ...d.period, value } };
  }

  #onDown(e: Event): void {
    const tip = this.#hit(e, '.ss-fig-btn')?.closest<UiTooltip>('ui-tooltip');
    this.#down = tip ? { tip, open: tip.open } : null;
  }

  #onClick(e: Event): void {
    const btn = this.#hit(e, '.ss-fig-btn');
    if (btn) {
      this.#toggleTip(btn);
      return;
    }
    if (this.#hit(e, '.ss-more')) this.toggle();
  }

  /** A press on a figure toggles its breakdown — the only way to see it on touch, where tooltips never show. */
  #toggleTip(btn: HTMLElement): void {
    const tip = btn.closest<UiTooltip>('ui-tooltip');
    if (!tip) return;
    const wasOpen = this.#down?.tip === tip ? this.#down.open : tip.open;
    this.#down = null;
    if (wasOpen) {
      tip.hide();
      this.#unpin();
      return;
    }
    tip.show();
    if (tip.open) this.#pin(tip);
  }

  readonly #onOutside = (e: Event): void => {
    const tip = this.#pinned;
    if (!tip) return;
    if (e.composedPath().includes(tip)) return; // the trigger's own press toggles it
    tip.hide();
    this.#unpin();
  };

  #pin(tip: UiTooltip): void {
    this.#pinned = tip;
    document.addEventListener('pointerdown', this.#onOutside, true);
  }

  #unpin(): void {
    this.#pinned = null;
    document.removeEventListener('pointerdown', this.#onOutside, true);
  }

  #onTransitionEnd(e: TransitionEvent): void {
    const t = e.target as Element | null;
    if (e.propertyName !== 'grid-template-rows' || t?.getRootNode?.() !== this.root) return;
    if (!t.classList.contains('ss-region')) return;
    if (!this.#open || this.#settled) return;
    this.#settled = true;
    this.$('.ss')?.setAttribute('data-settled', '');
  }
}

define('ui-stat-strip', UiStatStrip);

declare global {
  interface HTMLElementTagNameMap {
    'ui-stat-strip': UiStatStrip;
  }
}
