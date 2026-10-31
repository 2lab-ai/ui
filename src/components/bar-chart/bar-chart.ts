import { define, UiElement } from '../../core/element';
import { clamp } from '../../core/format';
import { attrs, esc, escAttr } from '../../core/html';
import { morphInto } from '../../core/morph';
import {
  BAR_COLORS,
  type BarChartData,
  type BarChartModel,
  type BarModel,
  type BarSelect,
  barChartModel,
  barLabelShown,
  fmtBarTick,
  fmtBarValue,
  labelStride,
  pct,
} from './logic';
import { type BarChartStrings, barChartStrings } from './strings';
import { styles } from './styles';

export type {
  BarChartData,
  BarChartModel,
  BarDatum,
  BarModel,
  BarSelect,
  BarSeries,
  BarSeriesModel,
  ChartColor,
  ChartFormat,
  NiceScale,
} from './logic';

/** Skeleton heights (% of the plot), repeated: varied so the shape reads as “bars are coming”. */
const SKELETON = [42, 64, 36, 78, 56, 70, 30, 60, 48, 84, 52, 66, 40, 74];
export const BAR_CHART_HEIGHT = 140;
/** Tooltip distance from its bar, and its inset from the chart's box. */
const GAP = 8;
const EDGE = 4;
/** Focus this soon after a pointer press came from that press (no tooltip: the pointer already shows one). */
const POINTER_FOCUS_MS = 400;

/**
 * `<ui-bar-chart>` — a small time-series bar chart (one series, or several stacked) read by hover, focus or
 * keyboard: nice y ticks on dashed hairlines, thinned x labels, one tooltip that follows the hot bar while the
 * others dim. Bars glide to new heights when the data changes (never on first paint). Enter / Space or a click
 * sends a cancelable `ui-select`.
 */
export class UiBarChart extends UiElement<BarChartData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  #model: BarChartModel = barChartModel(undefined);
  /** Bar ids (BarModel.id): under a mouse / pen, tapped (sticky until a tap elsewhere), keyboard-focused. */
  #ptr = '';
  #tap = '';
  #foc = '';
  /** The roving tab stop. */
  #stop = '';
  #downAt = Number.NEGATIVE_INFINITY;
  /** Heights transition only after the first paint. */
  #anim = false;
  #animRaf = 0;
  #ro: ResizeObserver | null = null;
  /** Last x-label stride, re-applied right after a render before anything measures. */
  #stride = 1;
  /** The tooltip lives beside the rendered tree, so a re-render never resets its place, content or open state. */
  readonly #tip: HTMLElement;

  attributeChangedCallback(): void {
    this.requestRender();
  }

  get #t(): BarChartStrings {
    return barChartStrings(this.getAttribute('lang'));
  }

  constructor() {
    super();
    this.#tip = document.createElement('div');
    this.#tip.className = 'bc-tip';
    this.#tip.setAttribute('aria-hidden', 'true');
    this.root.append(this.#tip);
    this.root.addEventListener('pointerover', (e) => {
      const id = this.#barOf(e.target)?.dataset.key ?? '';
      if (id === this.#ptr) return;
      this.#ptr = id;
      this.#applyHot();
    });
    // On the host, not the shadow root: pointerleave does not bubble, so the root never hears it.
    this.addEventListener('pointerleave', () => {
      if (!this.#ptr) return;
      this.#ptr = '';
      this.#applyHot();
    });
    this.root.addEventListener('pointerdown', () => {
      this.#downAt = performance.now();
    });
    // A tap keeps its tooltip after the finger lifts (touch pointers leave on lift) until a tap elsewhere.
    this.root.addEventListener('pointerup', (e) => {
      if ((e as PointerEvent).pointerType !== 'touch') return;
      this.#setTap(this.#barOf(e.target)?.dataset.key ?? '');
    });
    this.root.addEventListener('click', (e) => {
      const bar = this.#barOf(e.target);
      if (bar) this.#select(Number(bar.dataset.i));
    });
    this.root.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    this.root.addEventListener('focusin', (e) => {
      const bar = this.#barOf(e.target);
      if (!bar) return;
      this.#rove(bar.dataset.key ?? '');
      const fromPointer = performance.now() - this.#downAt < POINTER_FOCUS_MS;
      if (!fromPointer && bar.dataset.key !== this.#foc) {
        this.#foc = bar.dataset.key ?? '';
        this.#applyHot();
      }
    });
    this.root.addEventListener('focusout', (e) => {
      if (this.#barOf((e as FocusEvent).relatedTarget) || !this.#foc) return;
      this.#foc = '';
      this.#applyHot();
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.#ro && typeof ResizeObserver === 'function') {
      this.#ro = new ResizeObserver(() => {
        this.#thin();
        this.#applyHot();
      });
      this.#ro.observe(this);
    }
  }

  override disconnectedCallback(): void {
    this.#ro?.disconnect();
    this.#ro = null;
    if (this.#animRaf) cancelAnimationFrame(this.#animRaf);
    this.#animRaf = 0;
    this.#setTap('');
  }

  #outside = (e: Event): void => {
    if (!e.composedPath().includes(this)) this.#setTap('');
  };

  #setTap(id: string): void {
    if (id === this.#tap) return;
    this.#tap = id;
    if (id) document.addEventListener('pointerdown', this.#outside, true);
    else document.removeEventListener('pointerdown', this.#outside, true);
    this.#applyHot();
  }

  #barOf(target: EventTarget | null): HTMLElement | null {
    const el = (target as Element | null)?.closest?.<HTMLElement>('.bc-bar');
    return el && this.root.contains(el) ? el : null;
  }

  #bars(): HTMLElement[] {
    return this.$$<HTMLElement>('.bc-bar');
  }

  /** Move the tab stop to bar `id` (in place: no re-render). */
  #rove(id: string): void {
    this.#stop = id;
    for (const b of this.#bars()) b.setAttribute('tabindex', b.dataset.key === id ? '0' : '-1');
  }

  #onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (!(this.#ptr || this.#tap || this.#foc)) return;
      e.stopPropagation();
      this.#ptr = '';
      this.#foc = '';
      this.#setTap('');
      this.#applyHot();
      return;
    }
    const bar = this.#barOf(e.target);
    if (!bar) return;
    this.#downAt = Number.NEGATIVE_INFINITY;
    const n = this.#model.bars.length;
    const at = Number(bar.dataset.i);
    const rtl = getComputedStyle(this).direction === 'rtl';
    let next = -1;
    switch (e.key) {
      case 'ArrowRight':
        next = at + (rtl ? -1 : 1);
        break;
      case 'ArrowLeft':
        next = at + (rtl ? 1 : -1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = n - 1;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.#select(at);
        return;
      default:
        return;
    }
    e.preventDefault();
    const target = this.#bars()[clamp(next, 0, n - 1)];
    if (!target) return;
    this.#rove(target.dataset.key ?? '');
    target.focus();
  }

  /** Send `ui-select`; in selection mode move the mark unless a listener cancels. */
  #select(i: number): void {
    const b = this.#model.bars[i];
    const d = this.data;
    if (!b || !d) return;
    const detail: BarSelect = { key: b.key, index: b.index };
    // Optimistic on top of the LATEST data: a listener that set a selection of its own wins.
    if (
      this.emit('ui-select', detail) &&
      this.data &&
      this.data.selected !== undefined &&
      this.data.selected === d.selected &&
      d.selected !== b.key
    )
      this.data = { ...this.data, selected: b.key };
  }

  /** Patch the live tree: bars and segments keep their nodes by key, so new heights glide; focus stays put. */
  protected override update(): void {
    morphInto(this.content, this.render());
    this.updated();
  }

  protected render(): string {
    const d = this.data;
    const t = this.#t;
    const m = barChartModel(d);
    this.#model = m;
    const loading = !!d?.loading;
    const state = m.empty ? (loading ? 'loading' : 'empty') : 'ready';
    const height = clamp(Math.round(Number(d?.height) || BAR_CHART_HEIGHT), 48, 600);
    const title = typeof d?.title === 'string' ? d.title : '';
    const unit = this.#unit(d, m);
    const ticks = state === 'ready' ? m.scale.ticks : [];
    const tickText = ticks.map((v) => fmtBarTick(v, m.format, m.scale.max));
    const yw = state === 'empty' ? 0 : state === 'loading' ? 3 : Math.max(1, ...tickText.map((s) => s.length));
    const legend = m.series[0].key
      ? `<ul class="bc-legend" aria-hidden="true">${m.series
          .map((s) => `<li><i class="bc-sw" style="--c:${BAR_COLORS[s.color]}"></i><span>${esc(s.label)}</span></li>`)
          .join('')}</ul>`
      : '';
    let y = '';
    let grid = state === 'empty' ? '' : '<i class="bc-gl is-base"></i>';
    ticks.forEach((v, i) => {
      const at = pct(v, m.scale.max);
      y += `<span class="bc-yl" style="bottom:${at}%">${esc(tickText[i])}</span>`;
      if (v > 0) grid += `<i class="bc-gl" style="bottom:${at}%"></i>`;
    });
    let plot = '';
    let xs = '';
    if (state === 'ready') {
      const stop = (m.bars.find((b) => b.id === this.#stop) ?? m.bars.find((b) => b.key === d?.selected) ?? m.bars[0])
        .id;
      const bars = m.bars.map((b) => this.#bar(b, m, stop, d?.selected, unit, t)).join('');
      plot = `<div class="bc-bars" role="list">${bars}</div>`;
      xs = `<div class="bc-x" aria-hidden="true">${m.bars
        .map(
          (b) =>
            `<span${attrs({ class: 'bc-xl', 'data-mk': b.id, 'data-sel': d?.selected === b.key })}><span class="bc-xt">${esc(
              b.label,
            )}</span></span>`,
        )
        .join('')}</div>`;
    } else if (state === 'loading') {
      const n = clamp(m.bars.length || 12, 4, 60);
      let sk = '';
      for (let i = 0; i < n; i++)
        sk += `<span class="bc-sk"><i style="height:${SKELETON[i % SKELETON.length]}%"></i></span>`;
      plot = `<div class="bc-skel" aria-hidden="true">${sk}</div>`;
    } else {
      plot = `<p class="bc-empty">${esc(d?.empty || t.empty)}</p>`;
    }
    return `<section${attrs({
      class: 'bc',
      role: 'group',
      'aria-labelledby': title ? 'bc-title' : undefined,
      'aria-label': title ? undefined : t.name,
      'aria-describedby': 'bc-sum',
      'aria-busy': loading ? 'true' : undefined,
      'data-state': state,
      'data-select': d?.selected !== undefined,
      'data-anim': this.#anim,
      style: `--bc-h:${height}px;--bc-yw:${yw}`,
    })}>${title ? `<div class="bc-title" id="bc-title">${esc(title)}</div>` : ''}${legend}<div class="bc-chart"><div class="bc-y" aria-hidden="true">${y}</div><div class="bc-plot"><div class="bc-grid" aria-hidden="true">${grid}</div>${plot}</div>${xs}</div><p class="sr-only" id="bc-sum">${esc(
      this.#summary(m, state, unit, t),
    )}</p></section>`;
  }

  /** The single-series unit: `unit`, else the one series' label. */
  #unit(d: BarChartData | undefined, m: BarChartModel): string {
    if (m.stacked) return '';
    return typeof d?.unit === 'string' && d.unit ? d.unit : m.series[0].label;
  }

  #bar(
    b: BarModel,
    m: BarChartModel,
    stop: string,
    selected: string | null | undefined,
    unit: string,
    t: BarChartStrings,
  ): string {
    const max = m.scale.max;
    const top = b.values.reduce((last, v, j) => (v > 0 ? j : last), -1);
    let below = false;
    const segs = m.series
      .map((s, j) => {
        const v = b.values[j];
        const nz = v > 0;
        const seg = `<span${attrs({
          class: 'bc-seg',
          'data-mk': `s:${s.key}`,
          'data-nz': nz,
          'data-gap': nz && below,
          'data-top': j === top,
          style: `height:${pct(v, max)}%;--c:${BAR_COLORS[s.color]}`,
        })}></span>`;
        if (nz) below = true;
        return seg;
      })
      .join('');
    return `<div class="bc-slot" role="listitem" data-mk="${escAttr(b.id)}"><button${attrs({
      type: 'button',
      class: 'bc-bar',
      'data-key': b.id,
      'data-i': b.index,
      tabindex: b.id === stop ? '0' : '-1',
      'aria-label': this.#say(b, m, unit, t),
      'aria-current': selected !== undefined && selected !== null && selected === b.key ? 'true' : undefined,
      'data-missing': b.missing,
    })}><span class="bc-col">${segs}</span></button></div>`;
  }

  /** “Mon 3 Nov: 12 sessions” · “Mon 3 Nov: 7 done, 5 failed, 12 total” · “Mon 3 Nov: No data”. */
  #say(b: BarModel, m: BarChartModel, unit: string, t: BarChartStrings): string {
    if (b.missing) return t.bar(b.title, t.noData);
    if (!m.stacked)
      return t.bar(
        b.title,
        t.withUnit(fmtBarValue(b.values[0], m.format, this.getAttribute('lang') ?? undefined), unit),
      );
    const parts = m.series.map((s, j) =>
      t.part(fmtBarValue(b.values[j], m.format, this.getAttribute('lang') ?? undefined), s.label),
    );
    parts.push(t.partTotal(fmtBarValue(b.total, m.format, this.getAttribute('lang') ?? undefined)));
    return t.bar(b.title, parts.join(', '));
  }

  #summary(m: BarChartModel, state: string, unit: string, t: BarChartStrings): string {
    if (state === 'loading') return t.loading;
    if (state === 'empty') return '';
    let hi = m.bars[0];
    let sum = 0;
    for (const b of m.bars) {
      if (b.total > hi.total) hi = b;
      sum += b.total;
    }
    const v = (n: number) => t.withUnit(fmtBarValue(n, m.format, this.getAttribute('lang') ?? undefined), unit);
    return t.summary(m.bars.length, hi.title, v(hi.total), v(sum));
  }

  protected override updated(): void {
    // Marks first, measuring after: a layout read between the patch and the marks would restart the dim fade.
    this.#marks();
    this.#applyHot();
    this.#thin();
    if (this.#anim || this.#animRaf || this.#model.empty || typeof requestAnimationFrame !== 'function') return;
    this.#animRaf = requestAnimationFrame(() => {
      this.#animRaf = 0;
      this.#anim = true;
      this.$('.bc')?.setAttribute('data-anim', '');
    });
  }

  /** Thin the x labels so they never overlap (first and last always show). In place, from measured widths. */
  #thin(): void {
    const xs = this.$$<HTMLElement>('.bc-xl');
    if (!xs.length) return;
    const width = this.$('.bc-bars')?.clientWidth ?? 0;
    let label = 0;
    for (const x of xs) label = Math.max(label, x.firstElementChild?.getBoundingClientRect().width ?? 0);
    // Not laid out (or no layout engine): estimate from the longest label at 11px.
    if (!label) label = Math.max(...this.#model.bars.map((b) => b.label.length)) * 6.2;
    const stride = labelStride(xs.length, width, label + 8);
    if (stride === this.#stride) return;
    this.#stride = stride;
    this.#marks();
  }

  /** The hot bar, the dimmed rest and the thinned labels as attributes on the live nodes (no measuring). */
  #marks(): void {
    const id = this.#hotId();
    this.$('.bc-bars')?.toggleAttribute('data-hot', !!id && this.#bars().some((b) => b.dataset.key === id));
    for (const b of this.#bars()) b.toggleAttribute('data-on', !!id && b.dataset.key === id);
    const xs = this.$$<HTMLElement>('.bc-xl');
    xs.forEach((x, i) => {
      x.toggleAttribute('data-off', !barLabelShown(i, xs.length, this.#stride));
    });
  }

  #hotId(): string {
    return this.#ptr || this.#tap || this.#foc;
  }

  /** Hover / focus live outside the markup: the hot bar stays, the others dim, the tooltip follows it. */
  #applyHot(): void {
    const tip = this.#tip;
    const id = this.#hotId();
    const btn = id ? this.#bars().find((b) => b.dataset.key === id) : undefined;
    const bar = btn ? this.#model.bars[Number(btn.dataset.i)] : undefined;
    this.#marks();
    if (!btn || !bar) {
      tip.classList.remove('is-open');
      return;
    }
    const fresh = !tip.classList.contains('is-open');
    tip.innerHTML = this.#tipHtml(bar);
    this.#place(tip, btn, bar, fresh);
    tip.classList.add('is-open');
  }

  #tipHtml(b: BarModel): string {
    const m = this.#model;
    const t = this.#t;
    const head = b.title ? `<div class="bc-tip-h">${esc(b.title)}</div>` : '';
    if (b.missing) return `${head}<div class="bc-tip-none">${esc(t.noData)}</div>`;
    const row = (color: string, label: string, value: string, cls = '') =>
      `<div class="bc-tip-row${cls}">${color ? `<i class="bc-sw" style="--c:${color}"></i>` : ''}<span class="bc-tip-l">${esc(
        label,
      )}</span><span class="bc-tip-v">${esc(value)}</span></div>`;
    if (!m.stacked)
      return `${head}${row(BAR_COLORS[m.series[0].color], this.#unit(this.data, m), fmtBarValue(b.values[0], m.format, this.getAttribute('lang') ?? undefined))}`;
    const rows = m.series
      .map((s, j) =>
        row(BAR_COLORS[s.color], s.label, fmtBarValue(b.values[j], m.format, this.getAttribute('lang') ?? undefined)),
      )
      .join('');
    return `${head}${rows}${row('', t.total, fmtBarValue(b.total, m.format, this.getAttribute('lang') ?? undefined), ' is-total')}`;
  }

  /**
   * Above the bar's top, centred on it and clamped to the chart's box; when there is no room above (a tall bar),
   * beside the bar on the side with room. The pop grows from the point nearest the bar.
   */
  #place(tip: HTMLElement, btn: HTMLElement, b: BarModel, fresh: boolean): void {
    const box = this.getBoundingClientRect();
    const slot = btn.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const cx = slot.left + slot.width / 2 - box.left;
    const by = slot.bottom - (slot.height * pct(b.total, this.#model.scale.max)) / 100 - box.top;
    let side: 'top' | 'right' | 'left' = 'top';
    let left = cx - w / 2;
    let top = by - GAP - h;
    if (top < EDGE) {
      const right = slot.right - box.left + GAP;
      side = right + w <= box.width - EDGE ? 'right' : 'left';
      left = side === 'right' ? right : slot.left - box.left - GAP - w;
      top = clamp(by, EDGE, Math.max(EDGE, box.height - h - EDGE));
    }
    left = clamp(left, EDGE, Math.max(EDGE, box.width - w - EDGE));
    tip.dataset.side = side;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
    tip.style.transformOrigin =
      side === 'top'
        ? `${Math.round(clamp(cx - left, 0, w))}px 100%`
        : `${side === 'right' ? '0' : '100%'} ${Math.round(clamp(by - top, 0, h))}px`;
    // Opening: commit the place before the open state, so the pop starts here instead of gliding from the last bar.
    if (fresh) void tip.offsetWidth;
  }
}

define('ui-bar-chart', UiBarChart);

declare global {
  interface HTMLElementTagNameMap {
    'ui-bar-chart': UiBarChart;
  }
}
