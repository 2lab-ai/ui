import { define, UiElement } from '../../core/element';
import { attrs, cls, esc, escAttr } from '../../core/html';
import {
  type DotAt,
  type DotGridData,
  type DotRowModel,
  type DotSelect,
  type DotSize,
  type DotState,
  type DotStrings,
  dotAria,
  dotColumns,
  dotCounts,
  dotLegend,
  dotMove,
  dotRows,
  dotSize,
  dotStrings,
  dotSummary,
  dotTip,
  dotWord,
  dotWrap,
} from './logic';
import { styles } from './styles';

export type {
  DotAt,
  DotCell,
  DotCellModel,
  DotCounts,
  DotGridData,
  DotLang,
  DotRow,
  DotRowModel,
  DotSelect,
  DotSize,
  DotState,
  DotStrings,
} from './logic';

/** Tooltip distance from its cell, and its inset from the element's box. */
const GAP = 6;
const EDGE = 4;

/** A cell's focus key: its index, then the row id (the first "@" ends the index, so no two cells share a key). */
const keyOf = (rowId: string, c: number): string => `${c}@${rowId}`;

/**
 * `<ui-dot-grid>` — a run history at a glance: one row per item (a cron job, a pipeline, an environment), a rounded
 * square per run — ink went through, red failed, amber waiting, blue running, hatched still to come, an outline
 * nothing yet, a faint pill skipped — and a legend of the states present. One tab stop (roving tabindex) moves in 2D
 * with the arrows; hover or focus shows a cell's words in a small bubble; Enter / Space or a click sends a cancelable
 * `ui-select` { rowId, index, state }. Attributes: `size` (sm · md · lg), `wrap` (cells per line), `lang`.
 */
export class UiDotGrid extends UiElement<DotGridData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return ['lang', 'size', 'wrap'];
  }

  #rows: DotRowModel[] = [];
  /** The roving tab stop, by row id and cell index (kept across data changes while that row and cell exist). */
  #stop: { id: string; c: number } | null = null;
  /** Cell keys: under a pointer, focused. */
  #ptr = '';
  #foc = '';
  /** The tooltip lives beside the drawn tree, so a re-render never resets its place or open state. */
  readonly #tip: HTMLElement;

  attributeChangedCallback(): void {
    this.requestRender();
  }

  constructor() {
    super();
    this.#tip = document.createElement('div');
    this.#tip.className = 'dg-tip';
    this.#tip.setAttribute('aria-hidden', 'true');
    this.root.append(this.#tip);
    this.root.addEventListener('pointerover', (e) => {
      const k = this.#cellOf(e.target)?.dataset.key ?? '';
      if (k === this.#ptr) return;
      this.#ptr = k;
      this.#applyHot();
    });
    // On the host: pointerleave does not bubble, so the shadow root never hears it.
    this.addEventListener('pointerleave', () => {
      if (!this.#ptr) return;
      this.#ptr = '';
      this.#applyHot();
    });
    this.root.addEventListener('click', (e) => {
      const cell = this.#cellOf(e.target);
      if (cell) this.#select(Number(cell.dataset.r), Number(cell.dataset.c));
    });
    this.root.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    this.root.addEventListener('focusin', (e) => {
      const cell = this.#cellOf(e.target);
      if (!cell) return;
      this.#rove(Number(cell.dataset.r), Number(cell.dataset.c));
      this.#foc = cell.dataset.key ?? '';
      this.#applyHot();
    });
    this.root.addEventListener('focusout', (e) => {
      if (this.#cellOf((e as FocusEvent).relatedTarget) || !this.#foc) return;
      this.#foc = '';
      this.#applyHot();
    });
  }

  /** The size drawn now (the `size` attribute; md by default). */
  get size(): DotSize {
    return dotSize(this.getAttribute('size'));
  }

  get #s(): DotStrings {
    return dotStrings(this.getAttribute('lang'));
  }

  /** Patched in place: a cell that changes state keeps its node, so its colour fades and focus stays put. */
  protected override patchesInPlace(): boolean {
    return true;
  }

  protected render(): string {
    const d = this.data;
    const s = this.#s;
    const lang = this.getAttribute('lang');
    const rows = dotRows(d);
    this.#rows = rows;
    const size = this.size;
    const wrap = dotWrap(this.getAttribute('wrap'));
    const stack = size === 'lg' || wrap > 0;
    const name = (typeof d?.label === 'string' && d.label.trim()) || s.name;
    if (!rows.length) {
      const empty = (typeof d?.empty === 'string' && d.empty.trim()) || s.none;
      return `<div class="dg" data-size="${size}" data-state="empty"><p class="dg-empty">${esc(empty)}</p></div>`;
    }
    const words = d?.states;
    const word = (st: DotState) => dotWord(st, lang, words);
    const cols = wrap ? [] : dotColumns(d);
    const nmax = Math.max(1, cols.length, ...rows.map((r) => r.cells.length));
    const colsMax = wrap ? wrap : nmax;
    const stop = this.#stopAt(rows);
    const head = cols.some(Boolean)
      ? `<div class="dg-row dg-head" aria-hidden="true"><div class="dg-cells" style="--dg-cols:${cols.length}">${cols
          .map((c) => `<span class="dg-col">${esc(c)}</span>`)
          .join('')}</div></div>`
      : '';
    const body = rows
      .map((row, r) => {
        const n = row.cells.length;
        const cells = row.cells
          .map((cell, c) => {
            const w = word(cell.state);
            return `<span${attrs({
              class: 'dg-cell dg-mark',
              role: 'gridcell',
              tabindex: stop && stop.r === r && stop.c === c ? '0' : '-1',
              'data-state': cell.state,
              'data-key': keyOf(row.id, c),
              'data-r': r,
              'data-c': c,
              'aria-label': dotAria(row.label, cell, c, n, cols[c] ?? '', w, s),
            })}></span>`;
          })
          .join('');
        // A row without a name (a one-row tally named by the grid) draws no header; its cells keep their column.
        const label = row.label
          ? `<span class="dg-label" role="rowheader" title="${escAttr(row.label)}">${esc(row.label)}</span>`
          : '';
        return `<div class="dg-row" role="row" data-mk="${escAttr(row.id)}">${label}<div class="dg-cells" role="none" style="--dg-cols:${wrap || n || 1}">${cells}</div></div>`;
      })
      .join('');
    const legend = dotLegend(rows, d?.legend);
    const legendHtml = legend.length
      ? `<ul class="dg-legend" aria-hidden="true">${legend
          .map((st) => `<li><i class="dg-sw dg-mark" data-state="${st}"></i><span>${esc(word(st))}</span></li>`)
          .join('')}</ul>`
      : '';
    const summary = dotSummary(dotCounts(rows), lang, words);
    const shown = d?.summary === true;
    const sum = `<p class="${cls('dg-sum', !shown && 'sr-only')}" id="dg-sum">${esc(summary)}</p>`;
    return `<div${attrs({
      class: 'dg',
      'data-size': size,
      'data-stack': stack,
      'data-wrap': wrap || undefined,
      style: `--dg-cols-max:${colsMax}`,
    })}><div${attrs({
      class: 'dg-grid',
      role: 'grid',
      'aria-label': name,
      'aria-describedby': 'dg-sum',
      'aria-readonly': 'true',
    })}>${head}${body}</div>${legendHtml || shown ? `<div class="dg-foot">${legendHtml}${shown ? sum : ''}</div>` : ''}${shown ? '' : sum}</div>`;
  }

  /** The tab stop's place: the remembered cell while it exists, else the first cell of the first row with cells. */
  #stopAt(rows: DotRowModel[]): DotAt | null {
    if (this.#stop) {
      const { id, c } = this.#stop;
      const r = rows.findIndex((row) => row.id === id);
      if (r >= 0 && rows[r].cells.length) return { r, c: Math.min(c, rows[r].cells.length - 1) };
    }
    const r = rows.findIndex((row) => row.cells.length > 0);
    return r < 0 ? null : { r, c: 0 };
  }

  protected override updated(): void {
    this.#applyHot();
  }

  /** The focused cell's row went away: focus the tab stop, so the grid keeps the focus. */
  protected override focusFallback(): HTMLElement | null {
    return this.$<HTMLElement>('.dg-cell[tabindex="0"]');
  }

  #cellOf(target: EventTarget | null): HTMLElement | null {
    const el = (target as Element | null)?.closest?.<HTMLElement>('.dg-cell');
    return el && this.root.contains(el) ? el : null;
  }

  #cells(): HTMLElement[] {
    return this.$$<HTMLElement>('.dg-cell');
  }

  /** Move the tab stop to cell (r, c), in place — no re-render. */
  #rove(r: number, c: number): void {
    const row = this.#rows[r];
    if (!row) return;
    this.#stop = { id: row.id, c };
    const key = keyOf(row.id, c);
    for (const el of this.#cells()) el.setAttribute('tabindex', el.dataset.key === key ? '0' : '-1');
  }

  #onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (!(this.#ptr || this.#foc) || !this.#tip.classList.contains('is-open')) return;
      e.stopPropagation();
      this.#ptr = '';
      this.#foc = '';
      this.#applyHot();
      return;
    }
    const cell = this.#cellOf(e.target);
    if (!cell) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.#select(r, c);
      return;
    }
    const rtl = getComputedStyle(this).direction === 'rtl';
    const to = dotMove(
      this.#rows.map((row) => row.cells.length),
      { r, c },
      e.key,
      { wrap: dotWrap(this.getAttribute('wrap')), ctrl: e.ctrlKey || e.metaKey, rtl },
    );
    if (!to) return;
    e.preventDefault();
    const row = this.#rows[to.r];
    const key = row ? keyOf(row.id, to.c) : '';
    const target = this.#cells().find((el) => el.dataset.key === key);
    if (!target) return;
    this.#rove(to.r, to.c);
    target.focus();
  }

  /** Send `ui-select` for cell (r, c). The grid holds no selection of its own: the host decides what it opens. */
  #select(r: number, c: number): void {
    const row = this.#rows[r];
    const cell = row?.cells[c];
    if (!row || !cell) return;
    const detail: DotSelect = { rowId: row.id, index: c, state: cell.state };
    this.emit('ui-select', detail);
  }

  /** Hover / focus live outside the markup: the bubble follows the hot cell. */
  #applyHot(): void {
    const tip = this.#tip;
    const key = this.#ptr || this.#foc;
    const cell = key ? this.#cells().find((el) => el.dataset.key === key) : undefined;
    const row = cell ? this.#rows[Number(cell.dataset.r)] : undefined;
    const model = row?.cells[Number(cell?.dataset.c)];
    if (!cell || !row || !model) {
      tip.classList.remove('is-open');
      return;
    }
    const c = Number(cell.dataset.c);
    const lang = this.getAttribute('lang');
    const column = dotColumns(this.data)[c] ?? '';
    const w = dotWord(model.state, lang, this.data?.states);
    const fresh = !tip.classList.contains('is-open');
    tip.innerHTML = `${row.label ? `<div class="dg-tip-h">${esc(row.label)}</div>` : ''}<div class="dg-tip-b"><i class="dg-sw dg-mark" data-state="${model.state}"></i><span class="dg-tip-t">${esc(
      dotTip(model, dotWrap(this.getAttribute('wrap')) ? '' : column, w),
    )}</span></div>`;
    this.#place(tip, cell, fresh);
    tip.classList.add('is-open');
  }

  /**
   * Above the cell, centred on it and clamped to the element's box; below it when the box has no room above but has
   * room below (the first row of a tall grid). A single row with room on neither side keeps it above.
   */
  #place(tip: HTMLElement, cell: HTMLElement, fresh: boolean): void {
    const box = this.getBoundingClientRect();
    const at = cell.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const cx = at.left + at.width / 2 - box.left;
    const above = at.top - box.top - GAP - h;
    const below = at.bottom - box.top + GAP;
    const down = above < EDGE && below + h <= box.height - EDGE;
    const top = down ? below : above;
    const side = down ? 'below' : 'above';
    const left = Math.min(Math.max(EDGE, cx - w / 2), Math.max(EDGE, box.width - w - EDGE));
    tip.dataset.side = side;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
    tip.style.transformOrigin = `${Math.round(Math.min(Math.max(cx - left, 0), w))}px ${side === 'above' ? '100%' : '0'}`;
    // Opening: commit the place first, so the bubble pops here instead of gliding from the last cell.
    if (fresh) void tip.offsetWidth;
  }
}

define('ui-dot-grid', UiDotGrid);

declare global {
  interface HTMLElementTagNameMap {
    'ui-dot-grid': UiDotGrid;
  }
}
