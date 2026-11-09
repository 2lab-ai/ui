import { define, UiElement } from '../../core/element';
import { clamp } from '../../core/format';
import { attrs, esc, escAttr } from '../../core/html';
import { morphInto } from '../../core/morph';
import {
  fmtLineTick,
  fmtLineValue,
  LINE_TONES,
  type LineChartData,
  type LineChartModel,
  type LineSelect,
  type LineSeriesModel,
  lineChartModel,
  linePct,
  nearestIndex,
} from './logic';
import { type LineChartStrings, lineChartStrings } from './strings';
import { styles } from './styles';

export type {
  LineBand,
  LineChartData,
  LineChartModel,
  LinePoint,
  LineSelect,
  LineSeries,
  LineSeriesModel,
  LineStyle,
  LineSummary,
  LineSummaryTone,
  LineTone,
  NiceTicks,
} from './logic';

/** Tooltip distance from the crosshair, and its inset from the element's box. */
const GAP = 12;
const EDGE = 4;

/** Who set the active point: a hovering pointer, a tap (sticky until a tap elsewhere), or the keyboard. */
type HotSource = '' | 'ptr' | 'tap' | 'key';

/**
 * `<ui-line-chart>` — how a number moved over time: a smooth line (monotone, so it never overshoots the data) for the
 * current period, dashed lines for a previous one, an optional soft band for the normal range and a row of figures on
 * top. The SVG stretches to any width without distorting its strokes; ticks and dates are HTML placed by percent.
 * Hover, tap or the arrow keys move a crosshair with a dot per series and a tooltip; the keyboard's point is also
 * spoken through a polite live region. A click, Enter or Space sends a cancelable `ui-select` { index, label }.
 */
export class UiLineChart extends UiElement<LineChartData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  #model: LineChartModel = lineChartModel(undefined);
  #hot = -1;
  #src: HotSource = '';
  #ro: ResizeObserver | null = null;
  /** Tooltip and live region live beside the rendered tree: a re-render never resets their place or text. */
  readonly #tip: HTMLElement;
  readonly #live: HTMLElement;

  attributeChangedCallback(): void {
    this.requestRender();
  }

  get #t(): LineChartStrings {
    return lineChartStrings(this.getAttribute('lang'));
  }

  /** The active point's index (-1 when none) — hovered, tapped or reached by the keyboard. */
  get activeIndex(): number {
    return this.#hot;
  }

  constructor() {
    super();
    this.#tip = document.createElement('div');
    this.#tip.className = 'lc-tip';
    this.#tip.setAttribute('aria-hidden', 'true');
    this.#live = document.createElement('p');
    this.#live.className = 'sr-only lc-live';
    this.#live.setAttribute('aria-live', 'polite');
    this.#live.setAttribute('aria-atomic', 'true');
    this.root.append(this.#tip, this.#live);
    this.root.addEventListener('pointermove', (e) => this.#onPointer(e as PointerEvent));
    this.root.addEventListener('pointerdown', (e) => {
      if ((e as PointerEvent).pointerType === 'touch') this.#onPointer(e as PointerEvent);
    });
    // On the host, not the shadow root: pointerleave does not bubble, so the root never hears it.
    this.addEventListener('pointerleave', () => {
      if (this.#src === 'ptr') this.#setHot(-1, '');
    });
    this.root.addEventListener('click', (e) => {
      const plot = this.#plotOf(e.target);
      if (!plot || this.#model.empty) return;
      const i = this.#indexAt(plot, (e as MouseEvent).clientX);
      if (this.#src !== 'tap') this.#setHot(i, 'ptr');
      this.#select(i);
    });
    this.root.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    this.root.addEventListener('focusout', (e) => {
      if (this.#src !== 'key' || this.#plotOf((e as FocusEvent).relatedTarget)) return;
      this.#setHot(-1, '');
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.#ro && typeof ResizeObserver === 'function') {
      this.#ro = new ResizeObserver(() => this.#applyHot());
      this.#ro.observe(this);
    }
  }

  override disconnectedCallback(): void {
    this.#ro?.disconnect();
    this.#ro = null;
    document.removeEventListener('pointerdown', this.#outside, true);
  }

  #outside = (e: Event): void => {
    if (!e.composedPath().includes(this) && this.#src === 'tap') this.#setHot(-1, '');
  };

  #plotOf(target: EventTarget | null): HTMLElement | null {
    const el = (target as Element | null)?.closest?.<HTMLElement>('.lc-plot');
    return el && this.root.contains(el) ? el : null;
  }

  #indexAt(plot: HTMLElement, clientX: number): number {
    const r = plot.getBoundingClientRect();
    return nearestIndex((clientX - r.left) / r.width, this.#model.count);
  }

  #onPointer(e: PointerEvent): void {
    const plot = this.#plotOf(e.target);
    if (!plot || this.#model.empty) {
      if (this.#src === 'ptr') this.#setHot(-1, '');
      return;
    }
    const touch = e.pointerType === 'touch';
    // A pen or mouse moving over a tapped point takes over; a moving finger keeps its tap sticky.
    if (!touch && this.#src === 'tap') return;
    this.#setHot(this.#indexAt(plot, e.clientX), touch ? 'tap' : 'ptr');
  }

  #setHot(i: number, src: HotSource): void {
    const was = this.#src;
    if (i === this.#hot && src === was) return;
    this.#hot = i;
    this.#src = i < 0 ? '' : src;
    if (this.#src === 'tap') document.addEventListener('pointerdown', this.#outside, true);
    else if (was === 'tap') document.removeEventListener('pointerdown', this.#outside, true);
    this.#applyHot();
  }

  #onKey(e: KeyboardEvent): void {
    const m = this.#model;
    if (e.key === 'Escape') {
      if (this.#hot < 0) return;
      e.stopPropagation();
      this.#setHot(-1, '');
      return;
    }
    if (!this.#plotOf(e.target) || m.empty || !m.count) return;
    const cur = this.#hot;
    let next: number;
    switch (e.key) {
      case 'ArrowRight':
        next = cur < 0 ? 0 : cur + 1;
        break;
      case 'ArrowLeft':
        next = cur < 0 ? m.count - 1 : cur - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = m.count - 1;
        break;
      case 'Enter':
      case ' ':
        if (cur < 0) return;
        e.preventDefault();
        this.#select(cur);
        return;
      default:
        return;
    }
    e.preventDefault();
    next = clamp(next, 0, m.count - 1);
    this.#setHot(next, 'key');
    this.#live.textContent = this.#say(next);
  }

  #select(i: number): void {
    const m = this.#model;
    if (i < 0 || i >= m.count) return;
    const detail: LineSelect = { index: i, label: m.labels[i] };
    this.emit('ui-select', detail);
  }

  /** Patched in place: paths keep their nodes (a new reading glides), focus and the live region stay. */
  protected override update(): void {
    morphInto(this.content, this.render());
    this.updated();
  }

  protected override updated(): void {
    this.#applyHot();
  }

  #v(v: number): string {
    return this.#t.withUnit(fmtLineValue(v, this.#model.decimals), this.#model.unit);
  }

  /** “13 Oct: Tokens 1,204,000 tokens, 30 days before 980,000 tokens”. */
  #say(i: number): string {
    const m = this.#model;
    const t = this.#t;
    return t.at(
      m.labels[i] ?? '',
      m.series.map((s) => {
        const v = s.values[i];
        return t.part(s.label, v === null ? t.noData : this.#v(v));
      }),
    );
  }

  #bandText(): string {
    const b = this.#model.band;
    if (!b) return '';
    const m = this.#model;
    const range = `${fmtLineValue(b.min, m.decimals)}–${fmtLineValue(b.max, m.decimals)}`;
    return `${b.label || this.#t.range} ${this.#t.withUnit(range, m.unit)}`;
  }

  protected render(): string {
    const d = this.data;
    const t = this.#t;
    const m = lineChartModel(d);
    this.#model = m;
    if (this.#hot >= m.count || m.empty) {
      if (this.#src === 'tap') document.removeEventListener('pointerdown', this.#outside, true);
      this.#hot = -1;
      this.#src = '';
    }
    const state = m.empty ? 'empty' : 'ready';
    const name = typeof d?.label === 'string' && d.label.trim() ? d.label : t.name;
    const sum = m.summary.length
      ? `<dl class="lc-sum">${m.summary
          .map(
            (f) =>
              `<div${attrs({ class: 'lc-fig', 'data-tone': f.tone })}><dt>${esc(f.label)}</dt><dd><span class="lc-fig-v">${esc(
                f.value,
              )}</span>${f.unit ? `<span class="lc-fig-u">${esc(f.unit)}</span>` : ''}</dd></div>`,
          )
          .join('')}</dl>`
      : '';
    const ticks = m.empty ? [] : m.scale.ticks;
    const top = Math.max(Math.abs(m.scale.min), Math.abs(m.scale.max));
    const tickText = ticks.map((v) => fmtLineTick(v, m.scale.step, top));
    const yw = m.empty ? 0 : Math.max(1, ...tickText.map((s) => s.length));
    let y = '';
    let grid = '';
    ticks.forEach((v, i) => {
      const at = linePct(v, m.scale);
      y += `<span class="lc-yl" style="bottom:${at}%">${esc(tickText[i])}</span>`;
      grid += `<i class="${i === 0 ? 'lc-gl is-base' : 'lc-gl'}" style="bottom:${at}%"></i>`;
    });
    let plot: string;
    let xs = '';
    let legend = '';
    if (m.empty) {
      plot = `<div class="lc-plot" data-key="plot"><p class="lc-empty">${esc(
        typeof d?.empty === 'string' && d.empty ? d.empty : t.empty,
      )}</p></div>`;
    } else {
      const band = m.band
        ? `<div class="lc-band" aria-hidden="true" style="bottom:${m.band.bottom}%;height:${m.band.height}%"></div>`
        : '';
      plot = `<div${attrs({
        class: 'lc-plot',
        'data-key': 'plot',
        tabindex: '0',
        role: 'group',
        'aria-label': name,
        'aria-describedby': 'lc-desc lc-hint',
      })}>${band}<div class="lc-grid" aria-hidden="true">${grid}</div>${this.#svg(m)}${this.#overlay(m)}</div>`;
      const last = m.count - 1;
      xs = `<div class="lc-x" aria-hidden="true">${m.labels
        .map(
          (label, i) =>
            `<span${attrs({
              class: 'lc-xl',
              'data-x': m.levels[i],
              'data-edge': m.count > 1 ? (i === 0 ? 'start' : i === last ? 'end' : undefined) : undefined,
              style: `left:${m.xs[i]}%`,
            })}>${esc(label)}</span>`,
        )
        .join('')}</div>`;
      const items = m.series
        .filter((s) => s.label)
        .map(
          (s) =>
            `<li data-mk="${escAttr(s.id)}"><i class="lc-sw" data-style="${s.style}" style="--c:${LINE_TONES[s.tone]}"></i><span>${esc(
              s.label,
            )}</span></li>`,
        );
      if (m.band)
        items.push(`<li class="lc-band-l"><i class="lc-sw is-band"></i><span>${esc(this.#bandText())}</span></li>`);
      legend = items.length ? `<ul class="lc-legend" aria-hidden="true">${items.join('')}</ul>` : '';
    }
    return `<div${attrs({
      class: 'lc',
      'data-state': state,
      style: `--lc-yw:${yw}`,
    })}>${sum}<div class="lc-chart"><div class="lc-y" aria-hidden="true">${y}</div>${plot}${xs}</div>${legend}<p class="sr-only" id="lc-desc">${esc(
      this.#describe(m, t),
    )}</p><p class="sr-only" id="lc-hint">${m.empty ? '' : esc(t.hint)}</p></div>`;
  }

  /** Areas first (under every line), then the lines with the first series on top. */
  #svg(m: LineChartModel): string {
    let defs = '';
    let areas = '';
    m.series.forEach((s, j) => {
      if (!s.area) return;
      defs += `<linearGradient id="lc-g-${j}" class="lc-grad" data-mk="g:${escAttr(s.id)}" x1="0" y1="0" x2="0" y2="1" style="--c:${
        LINE_TONES[s.tone]
      }"><stop class="lc-stop-0" offset="0"></stop><stop class="lc-stop-1" offset="1"></stop></linearGradient>`;
      areas += `<path class="lc-area" data-mk="a:${escAttr(s.id)}" fill="url(#lc-g-${j})" d="${s.area}"></path>`;
    });
    const lines = [...m.series]
      .reverse()
      .filter((s) => s.line)
      .map(
        (s) =>
          `<path class="lc-line" data-mk="l:${escAttr(s.id)}" data-style="${s.style}" style="--c:${LINE_TONES[s.tone]}" d="${s.line}"></path>`,
      )
      .join('');
    return `<svg class="lc-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">${
      defs ? `<defs>${defs}</defs>` : ''
    }${areas}${lines}</svg>`;
  }

  #overlay(m: LineChartModel): string {
    const dots = m.series
      .map(
        (s: LineSeriesModel, j) =>
          `<i class="lc-dot" data-mk="d:${escAttr(s.id)}" data-i="${j}" data-style="${s.style}" style="--c:${LINE_TONES[s.tone]}"></i>`,
      )
      .join('');
    return `<div class="lc-hot" aria-hidden="true"><i class="lc-cross"></i>${dots}</div>`;
  }

  /** “30 points, 13 Oct to 11 Nov. Tokens: low …, high …, latest …. Usual range 120–220 ms.” */
  #describe(m: LineChartModel, t: LineChartStrings): string {
    if (m.empty) return '';
    const parts = [t.points(m.count, m.labels[0] ?? '', m.labels[m.count - 1] ?? '')];
    for (const s of m.series) {
      parts.push(
        s.min === null || s.max === null || s.last === null
          ? t.seriesEmpty(s.label)
          : t.series(s.label, this.#v(s.min), this.#v(s.max), this.#v(s.last)),
      );
    }
    if (m.band) parts.push(`${this.#bandText()}.`);
    return parts.join(' ');
  }

  /** The active point lives outside the markup: crosshair, dots and the tooltip follow it in place. */
  #applyHot(): void {
    const tip = this.#tip;
    const m = this.#model;
    const i = this.#hot;
    const hot = this.$<HTMLElement>('.lc-hot');
    if (i < 0 || i >= m.count || m.empty || !hot) {
      hot?.removeAttribute('data-on');
      tip.classList.remove('is-open');
      return;
    }
    hot.setAttribute('data-on', '');
    hot.style.setProperty('--x', `${m.xs[i]}%`);
    let hiY = 100;
    let loY = 0;
    for (const dot of hot.querySelectorAll<HTMLElement>('.lc-dot')) {
      const p = m.series[Number(dot.dataset.i)]?.points[i];
      dot.hidden = !p;
      if (p) {
        dot.style.setProperty('--y', `${p[1]}%`);
        hiY = Math.min(hiY, p[1]);
        loY = Math.max(loY, p[1]);
      }
    }
    const fresh = !tip.classList.contains('is-open');
    tip.innerHTML = this.#tipHtml(i);
    // The side of the plot with more room above the highest dot or below the lowest, so the card covers no dot.
    this.#place(i, hiY >= 100 - loY ? 'top' : 'bottom', fresh);
    tip.classList.add('is-open');
  }

  #tipHtml(i: number): string {
    const m = this.#model;
    const t = this.#t;
    const head = m.labels[i] ? `<div class="lc-tip-h">${esc(m.labels[i])}</div>` : '';
    const rows = m.series
      .map((s) => {
        const v = s.values[i];
        return `<div${attrs({ class: 'lc-tip-row', 'data-none': v === null })}><i class="lc-sw" data-style="${s.style}" style="--c:${
          LINE_TONES[s.tone]
        }"></i><span class="lc-tip-l">${esc(s.label)}</span><span class="lc-tip-v">${esc(
          v === null ? t.noData : this.#v(v),
        )}</span></div>`;
      })
      .join('');
    return `${head}${rows}`;
  }

  /** Beside the crosshair (right when there is room, else left), at the top or the bottom of the plot. */
  #place(i: number, edge: 'top' | 'bottom', fresh: boolean): void {
    const tip = this.#tip;
    const plotEl = this.$<HTMLElement>('.lc-plot');
    if (!plotEl) return;
    const box = this.getBoundingClientRect();
    const plot = plotEl.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const x = plot.left - box.left + (plot.width * this.#model.xs[i]) / 100;
    let left = x + GAP;
    let side: 'right' | 'left' = 'right';
    if (left + w > box.width - EDGE) {
      left = x - GAP - w;
      side = 'left';
    }
    left = clamp(left, EDGE, Math.max(EDGE, box.width - w - EDGE));
    const top = edge === 'top' ? plot.top - box.top : Math.max(plot.top - box.top, plot.bottom - box.top - h);
    tip.dataset.side = side;
    tip.dataset.edge = edge;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
    tip.style.transformOrigin = `${side === 'right' ? '0' : '100%'} ${edge === 'top' ? '0' : '100%'}`;
    // Opening: commit the place first, so the pop starts here instead of gliding from the last point.
    if (fresh) void tip.offsetWidth;
  }
}

define('ui-line-chart', UiLineChart);

declare global {
  interface HTMLElementTagNameMap {
    'ui-line-chart': UiLineChart;
  }
}
