import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { esc, escAttr } from '../../core/html';
import {
  assignSlots,
  type BreakdownModel,
  type BreakdownOption,
  type BreakdownRow,
  type BreakdownUnit,
  type CompactBreakdownData,
  easeOut,
  fmtShare,
  fmtValue,
  foldParts,
  normUnit,
  safeColor,
  shareOf,
} from './logic';
import { type CompactBreakdownLang, type CompactBreakdownStrings, compactBreakdownStrings } from './strings';
import { styles } from './styles';

export interface CompactBreakdownChangeDetail {
  /** The option id the person picked. */
  value: string;
}

/** First data rolls up from zero in 900 ms; every later change (new data, hover) in 620 ms — one shared tween. */
export const ROLL_FIRST_MS = 900;
export const ROLL_MS = 620;
/** Rows slide to their new rank. */
export const FLIP_MS = 560;
const FLIP_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** Palette slots: four accent strengths, then one neutral every further part shares. */
const SLOTS = 5;
const TOTAL = '#total';
const FIGURE = '#figure';
/** Segments narrower than this share are not drawn (a 2px sliver would claim a part that is not there). */
const MIN_SEG = 0.05;
const DASH = '—';

type Mode = 'data' | 'empty' | 'error' | 'skeleton';

interface Drawn extends BreakdownRow {
  color: string;
  slot: number;
  leaving?: boolean;
}

interface Refs {
  val?: Text;
  share?: Text;
  seg?: HTMLElement;
}

const textOf = (el: Element | null | undefined): Text | undefined => {
  const n = el?.firstChild;
  return n && n.nodeType === Node.TEXT_NODE ? (n as Text) : undefined;
};

/**
 * `<ui-compact-breakdown>` — a total split into its parts in one small card: the total as a rolling number, a
 * segmented bar whose segments glide, and ranked rows (label, value, share) that trade places when the values change.
 * Hover or focus a row and its segment lights (and the other way round). The host may put a period or metric switch
 * in the header (`options` + `value` → `ui-change`).
 */
export class UiCompactBreakdown extends UiElement<CompactBreakdownData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  #value: string | undefined;
  #slots = new Map<string, number>();
  #shown = new Map<string, number>();
  #to = new Map<string, number>();
  #raf = 0;
  #rolled = false;
  #unit: BreakdownUnit | undefined;
  #mode: Mode = 'empty';
  #model: BreakdownModel = { rows: [], base: 0 };
  #drawn: Drawn[] = [];
  #refs = new Map<string, Refs>();
  #hot = '';
  #hotBy: 'pointer' | 'focus' | '' = '';
  #zone: 'switch' | 'rows' = 'rows';
  #flip = new Map<string, number>();
  #pillFrom: { transform: string; width: string; height: string } | null = null;
  #swWidth = -1;
  #ro: ResizeObserver | undefined;
  #anims: Animation[] = [];
  #capKey = '';
  #footKey = '';
  #sayFor: string | undefined;
  readonly #live: HTMLElement;

  constructor() {
    super();
    // Outside the re-rendered markup, so a render never re-creates (or re-reads) the live region.
    this.#live = document.createElement('span');
    this.#live.className = 'sr-only';
    this.#live.setAttribute('role', 'status');
    this.#live.setAttribute('aria-live', 'polite');
    this.root.append(this.#live);
    this.root.addEventListener('click', (e) => {
      const opt = (e.target as Element | null)?.closest?.<HTMLElement>('.cb-opt[data-opt]');
      if (opt) this.#choose(opt.dataset.opt ?? '', false);
    });
    this.root.addEventListener('keydown', (e) => this.#keydown(e as KeyboardEvent));
    this.root.addEventListener('pointerover', (e) => {
      const pe = e as PointerEvent;
      if (pe.pointerType && pe.pointerType !== 'mouse') return;
      const el = (e.target as Element | null)?.closest?.<HTMLElement>('.cb-item[data-id], .cb-seg[data-id]');
      const id = el?.dataset.id ?? '';
      if (id && this.#isLive(id)) this.#setHot(id, 'pointer');
      else if (this.#hotBy === 'pointer') this.#unhover();
    });
    this.addEventListener('pointerleave', () => {
      if (this.#hotBy === 'pointer') this.#unhover();
    });
    this.root.addEventListener('focusin', (e) => {
      const t = e.target as Element | null;
      const item = t?.closest?.<HTMLElement>('.cb-item[data-id]');
      if (item) {
        this.#zone = 'rows';
        if (this.#isLive(item.dataset.id ?? '')) this.#setHot(item.dataset.id ?? '', 'focus');
      } else if (t?.closest?.('.cb-switch')) this.#zone = 'switch';
    });
    this.root.addEventListener('focusout', (e) => {
      const next = (e as FocusEvent).relatedTarget as Element | null;
      if (next?.closest?.('.cb-item[data-id]') && this.root.contains(next)) return;
      if (this.#hotBy === 'focus') this.#setHot('', '');
    });
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override disconnectedCallback(): void {
    this.#stop();
    this.#ro?.disconnect();
    for (const a of this.#anims) a.cancel();
    this.#anims = [];
  }

  /** Focus the checked option of the switch, else the first row (for a host that moves focus into the card). */
  override focus(options?: FocusOptions): void {
    if (!this.$('.cb') && this.data && this.isConnected) this.renderNow();
    const target = this.$('.cb-opt[aria-checked="true"]') ?? this.$('.cb-item[tabindex="0"]');
    if (target) target.focus(options);
    else super.focus(options);
  }

  /** A focused row that folded away hands focus to the first row; a focused option that went, to the checked one. */
  protected override focusFallback(): HTMLElement | null {
    const opt = this.$<HTMLElement>('.cb-opt[aria-checked="true"]');
    const row = this.$<HTMLElement>('.cb-item[tabindex="0"]');
    return this.#zone === 'switch' ? (opt ?? row) : (row ?? opt);
  }

  /** The selected option id (controlled `data.value`, else the card's own; the first option by default). */
  get value(): string | undefined {
    const d = this.data;
    return d ? this.#current(d, this.#options(d)) : undefined;
  }

  get #lang(): CompactBreakdownLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #t(): CompactBreakdownStrings {
    return compactBreakdownStrings(this.#lang);
  }

  #options(d: CompactBreakdownData): BreakdownOption[] {
    if (!Array.isArray(d.options)) return [];
    const seen = new Set<string>();
    const out: BreakdownOption[] = [];
    for (const o of d.options) {
      const id = o && typeof o === 'object' ? String(o.id ?? '') : '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, label: String(o.label ?? id) });
    }
    return out;
  }

  #current(d: CompactBreakdownData, opts: BreakdownOption[]): string | undefined {
    const want = d.value ?? this.#value;
    return opts.find((o) => o.id === want)?.id ?? opts[0]?.id;
  }

  #isLive(id: string): boolean {
    return this.#drawn.some((r) => r.id === id && !r.leaving);
  }

  #shownOf(id: string): number {
    return this.#shown.get(id) ?? 0;
  }

  #fmt(n: number): string {
    return fmtValue(this.#unit ?? 'count', n);
  }

  protected render(): string {
    const d = this.data;
    if (!d) return '';
    this.#capture();
    const t = this.#t;
    const unit = normUnit(d.unit);
    const jump = this.#unit !== undefined && unit !== this.#unit;
    this.#unit = unit;
    const model = foldParts(d.parts, d.maxRows, d.total, unit);
    const error = d.error !== undefined && d.error !== null && String(d.error) !== '' ? String(d.error) : '';
    const mode: Mode = error ? 'error' : model.rows.length ? 'data' : d.loading ? 'skeleton' : 'empty';
    const motion = this.isConnected && !prefersReducedMotion() && typeof requestAnimationFrame === 'function';
    this.#model = model;
    this.#mode = mode;
    this.#drawn = this.#draw(model, mode, motion, t);

    // Targets of the shared tween; ids seen for the first time start from zero (or at their value without motion).
    const to = new Map<string, number>();
    for (const r of this.#drawn) to.set(r.id, r.leaving ? 0 : r.value);
    const base = mode === 'data' ? model.base : 0;
    to.set(TOTAL, base);
    const hot = this.#drawn.find((r) => r.id === this.#hot && !r.leaving);
    if (!hot) this.#hot = '';
    to.set(FIGURE, hot ? hot.value : base);
    for (const [k, v] of to) if (jump || !motion || !this.#shown.has(k)) this.#shown.set(k, jump || !motion ? v : 0);
    this.#to = to;

    const totalLabel = d.totalLabel ? String(d.totalLabel) : t.total;
    const busy = d.loading ? ' aria-busy="true"' : '';
    const title = d.title === undefined || d.title === null ? '' : String(d.title);
    const big =
      mode === 'skeleton'
        ? '<span class="cb-sk is-big" aria-hidden="true"></span>'
        : `<span class="cb-big" aria-hidden="true">${esc(mode === 'error' ? DASH : this.#fmt(this.#shownOf(FIGURE)))}</span>`;
    const cap = this.#caption(totalLabel, t);
    const capIn = cap.key !== this.#capKey && this.#capKey !== '';
    this.#capKey = cap.key;
    const say =
      mode === 'skeleton'
        ? t.loading
        : mode === 'error'
          ? `${totalLabel}: ${DASH}. ${error}`
          : t.sayTotal(totalLabel, this.#fmt(base));
    return `<section class="cb" role="group" aria-labelledby="cb-title" data-mode="${mode}"${busy}>
<div class="cb-body">
<div class="cb-head"><span class="cb-title" id="cb-title" title="${escAttr(title)}">${esc(title)}</span>${this.#switch(d, t)}</div>
<div class="cb-figure">${big}</div>
<p class="cb-caption" aria-hidden="true"><span class="cb-cap${capIn ? ' is-in' : ''}${mode === 'error' ? ' is-error' : ''}" data-k="${escAttr(cap.key)}">${cap.html}</span></p>
<p class="sr-only">${esc(say)}</p>
${this.#bar(mode)}
${this.#list(d, mode, t)}
</div>${this.#foot(d, mode, t)}</section>`;
  }

  /** Rows as drawn: ranked rows with their colours, then the rows that left and still fold away. */
  #draw(model: BreakdownModel, mode: Mode, motion: boolean, t: CompactBreakdownStrings): Drawn[] {
    const prev = this.#drawn;
    const now = new Set(model.rows.map((r) => r.id));
    const leaving =
      mode === 'data' && motion
        ? prev.filter((r) => !now.has(r.id) && this.#shownOf(r.id) > 0).map((r) => ({ ...r, leaving: true }))
        : [];
    const ids = [...model.rows, ...leaving].filter((r) => !r.other).map((r) => r.id);
    this.#slots = assignSlots(this.#slots, ids, SLOTS);
    const out: Drawn[] = model.rows.map((r) => {
      const slot = r.other ? SLOTS : (this.#slots.get(r.id) ?? SLOTS - 1);
      const color = r.other ? 'var(--cb-other)' : (safeColor(r.color) ?? `var(--cb-c${slot + 1})`);
      const label = r.other ? t.other(r.folded?.length ?? 0) : r.label;
      return { ...r, label, color, slot };
    });
    for (const r of leaving) if (!out.some((o) => o.id === r.id)) out.push(r);
    if (mode !== 'data') return [];
    return out;
  }

  #switch(d: CompactBreakdownData, t: CompactBreakdownStrings): string {
    const opts = this.#options(d);
    if (opts.length < 2) return '';
    const cur = this.#current(d, opts);
    const label = d.optionsLabel ? String(d.optionsLabel) : t.period;
    let html = `<div class="cb-switch" role="radiogroup" aria-label="${escAttr(label)}"><span class="cb-pill" aria-hidden="true"></span>`;
    for (const o of opts) {
      const on = o.id === cur;
      html += `<button type="button" class="cb-opt" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-opt="${escAttr(
        o.id,
      )}" data-key="opt:${escAttr(o.id)}" title="${escAttr(o.label)}">${esc(o.label)}</button>`;
    }
    return `${html}</div>`;
  }

  #bar(mode: Mode): string {
    if (mode !== 'data') return '<div class="cb-bar is-empty" aria-hidden="true"></div>';
    const total = this.#shownOf(TOTAL);
    const order = [...this.#drawn].sort((a, b) => a.slot - b.slot);
    let segs = '';
    for (const r of order) {
      const g = shareOf(this.#shownOf(r.id), total);
      segs += `<span class="cb-seg" data-id="${escAttr(r.id)}" style="--c:${escAttr(r.color)};flex-grow:${g.toFixed(3)}${
        g > MIN_SEG ? '' : ';display:none'
      }"></span>`;
    }
    return `<div class="cb-bar" aria-hidden="true">${segs}</div>`;
  }

  #list(d: CompactBreakdownData, mode: Mode, t: CompactBreakdownStrings): string {
    if (mode === 'error') return '';
    if (mode === 'skeleton') {
      const row = '<li class="cb-skrow"><span class="cb-sk is-row"></span><span class="cb-sk is-row"></span></li>';
      return `<ul class="cb-list" aria-hidden="true">${row}${row}${row}</ul>`;
    }
    if (mode === 'empty') return `<p class="cb-empty">${esc(d.emptyText ? String(d.emptyText) : t.empty)}</p>`;
    const total = this.#shownOf(TOTAL);
    const base = this.#model.base;
    let rows = '';
    for (const r of this.#drawn) {
      const v = this.#shownOf(r.id);
      const tip = r.other && r.folded?.length ? r.folded.join(', ') : r.label;
      const say = t.sayRow(r.label, this.#fmt(r.value), fmtShare(shareOf(r.value, base)));
      rows += `<li class="cb-row" data-id="${escAttr(r.id)}"${r.other ? ' data-other' : ''}${
        r.leaving ? ' data-leaving aria-hidden="true"' : ''
      }><div class="cb-item" data-id="${escAttr(r.id)}"${
        r.leaving ? ' tabindex="-1"' : ` tabindex="0" data-key="row:${escAttr(r.id)}"`
      } style="--c:${escAttr(r.color)}"><i class="cb-sw" aria-hidden="true"></i><span class="cb-label" aria-hidden="true" title="${escAttr(
        tip,
      )}">${esc(r.label)}</span><span class="cb-val" aria-hidden="true">${esc(this.#fmt(v))}</span><span class="cb-share" aria-hidden="true">${esc(
        fmtShare(shareOf(v, total)),
      )}</span><span class="sr-only">${esc(say)}</span></div></li>`;
    }
    return `<ul class="cb-list">${rows}</ul>`;
  }

  #caption(totalLabel: string, t: CompactBreakdownStrings): { key: string; html: string } {
    if (this.#mode === 'error') {
      const msg = this.data?.error ? String(this.data.error) : t.error;
      return { key: `error:${msg}`, html: esc(msg) };
    }
    if (this.#mode === 'skeleton') return { key: 'loading', html: esc(t.loading) };
    const row = this.#hot ? this.#drawn.find((r) => r.id === this.#hot && !r.leaving) : undefined;
    if (!row) return { key: 'total', html: esc(totalLabel) };
    return {
      key: row.id,
      html: `<i class="cb-sw" style="--c:${escAttr(row.color)}"></i><span class="cb-cap-label">${esc(
        row.label,
      )}</span><span class="cb-cap-share">· ${esc(fmtShare(shareOf(row.value, this.#model.base)))}</span>`,
    };
  }

  #foot(d: CompactBreakdownData, mode: Mode, t: CompactBreakdownStrings): string {
    let key = '';
    let html = '';
    if (d.footer === null || mode !== 'data') key = '';
    else if (d.footer !== undefined && String(d.footer) !== '') {
      key = `host:${String(d.footer)}`;
      html = esc(String(d.footer));
    } else {
      const top = this.#drawn.find((r) => !r.other && !r.leaving);
      if (top) {
        key = top.id;
        html = `${esc(t.largest)}: <b title="${escAttr(top.label)}">${esc(top.label)}</b>`;
      }
    }
    const fresh = key !== this.#footKey && this.#footKey !== '';
    this.#footKey = key;
    return key ? `<div class="cb-foot"><span class="cb-foot-in${fresh ? ' is-in' : ''}">${html}</span></div>` : '';
  }

  protected override updated(): void {
    this.#refs.clear();
    for (const item of this.$$<HTMLElement>('.cb-item[data-id]'))
      this.#refs.set(item.dataset.id ?? '', {
        val: textOf(item.querySelector('.cb-val')),
        share: textOf(item.querySelector('.cb-share')),
      });
    for (const seg of this.$$<HTMLElement>('.cb-seg[data-id]')) {
      const r = this.#refs.get(seg.dataset.id ?? '');
      if (r) r.seg = seg;
    }
    this.#applyHot(false);
    this.#playFlip();
    this.#placePill(true);
    this.#observe();
    const first = !this.#rolled && this.#mode === 'data';
    if (this.#mode === 'data') this.#rolled = true;
    this.#animate(first ? ROLL_FIRST_MS : ROLL_MS);
    this.#announce();
  }

  /** Before the markup is replaced: where every row and the switch's fill are on screen now. */
  #capture(): void {
    this.#flip.clear();
    for (const li of this.$$<HTMLElement>('.cb-row[data-id]'))
      this.#flip.set(li.dataset.id ?? '', li.getBoundingClientRect().top);
    const pill = this.$<HTMLElement>('.cb-pill');
    this.#pillFrom = null;
    if (pill?.style.width) {
      const cs = typeof getComputedStyle === 'function' ? getComputedStyle(pill) : null;
      this.#pillFrom = {
        transform: cs?.transform && cs.transform !== 'none' ? cs.transform : pill.style.transform,
        width: cs?.width && cs.width !== 'auto' ? cs.width : pill.style.width,
        height: pill.style.height,
      };
    }
  }

  /** Rows that changed rank slide from where they were (FLIP). */
  #playFlip(): void {
    const from = this.#flip;
    if (!from.size || prefersReducedMotion()) {
      from.clear();
      return;
    }
    this.#anims = this.#anims.filter((a) => a.playState === 'running');
    for (const li of this.$$<HTMLElement>('.cb-row[data-id]')) {
      const old = from.get(li.dataset.id ?? '');
      if (old === undefined || typeof li.animate !== 'function') continue;
      // A rank change mid-slide: drop this row's running slide (only ours — not its fold or transitions).
      for (const a of this.#anims) if ((a.effect as KeyframeEffect | null)?.target === li) a.cancel();
      const dy = old - li.getBoundingClientRect().top;
      if (Math.abs(dy) < 0.5) continue;
      this.#anims.push(
        li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
          duration: FLIP_MS,
          easing: FLIP_EASE,
        }),
      );
    }
    from.clear();
  }

  /** The switch's light fill sits under the checked option; after a change it slides there from where it was. */
  #placePill(slide: boolean): void {
    const sw = this.$<HTMLElement>('.cb-switch');
    const pill = this.$<HTMLElement>('.cb-pill');
    const on = sw?.querySelector<HTMLElement>('.cb-opt[aria-checked="true"]');
    if (!sw || !pill || !on) return;
    this.#swWidth = sw.offsetWidth;
    const to = {
      transform: `translate(${on.offsetLeft}px, ${on.offsetTop}px)`,
      width: `${on.offsetWidth}px`,
      height: `${on.offsetHeight}px`,
    };
    const from = slide && !prefersReducedMotion() ? this.#pillFrom : null;
    pill.style.transition = 'none';
    if (from) {
      Object.assign(pill.style, from);
      pill.style.opacity = '1';
      void pill.offsetWidth;
      pill.style.transition = '';
      Object.assign(pill.style, to);
    } else {
      Object.assign(pill.style, to);
      pill.style.opacity = on.offsetWidth ? '1' : '0';
      void pill.offsetWidth;
      pill.style.transition = '';
    }
    this.#pillFrom = null;
  }

  /** Re-place the fill when the switch is resized (fonts loading, a narrower container). */
  #observe(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.#ro ??= new ResizeObserver(() => {
      const sw = this.$<HTMLElement>('.cb-switch');
      if (sw && sw.offsetWidth !== this.#swWidth) this.#placePill(false);
    });
    this.#ro.disconnect();
    const sw = this.$('.cb-switch');
    if (sw && this.isConnected) this.#ro.observe(sw);
  }

  /** One tween moves every number and width from where it is to its target; reduced motion jumps. */
  #animate(ms: number): void {
    this.#stop();
    const to = this.#to;
    const from = new Map(this.#shown);
    let moves = false;
    for (const [k, v] of to) if ((from.get(k) ?? 0) !== v) moves = true;
    if (!moves || !this.isConnected || prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      for (const [k, v] of to) this.#shown.set(k, v);
      this.#paint();
      this.#settle();
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / ms));
      const e = easeOut(p);
      for (const [k, v] of to) {
        const f = from.get(k) ?? 0;
        this.#shown.set(k, p >= 1 ? v : f + (v - f) * e);
      }
      this.#paint();
      if (p < 1 && this.isConnected) this.#raf = requestAnimationFrame(step);
      else {
        this.#raf = 0;
        this.#settle();
      }
    };
    this.#raf = requestAnimationFrame(step);
  }

  /** Stop the tween where it is (a new one picks up from there); on disconnect, jump to the targets. */
  #stop(): void {
    if (!this.#raf) return;
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    if (!this.isConnected) for (const [k, v] of this.#to) this.#shown.set(k, v);
  }

  /** Writes the tweened numbers into their text nodes and the widths into the segments — no re-render. */
  #paint(): void {
    if (this.#mode !== 'data' && this.#mode !== 'empty') return;
    const big = textOf(this.$('.cb-big'));
    const fig = this.#fmt(this.#shownOf(FIGURE));
    if (big && big.data !== fig) big.data = fig;
    const total = this.#shownOf(TOTAL);
    for (const [id, r] of this.#refs) {
      const v = this.#shownOf(id);
      const g = shareOf(v, total);
      const val = this.#fmt(v);
      const share = fmtShare(g);
      if (r.val && r.val.data !== val) r.val.data = val;
      if (r.share && r.share.data !== share) r.share.data = share;
      if (r.seg) {
        r.seg.style.flexGrow = g.toFixed(3);
        r.seg.style.display = g > MIN_SEG ? '' : 'none';
      }
    }
  }

  /** The tween ended: rows that left are gone now. */
  #settle(): void {
    const gone = this.#drawn.filter((r) => r.leaving);
    if (!gone.length) return;
    const ids = new Set(gone.map((r) => r.id));
    for (const el of this.$$<HTMLElement>('.cb-row[data-leaving], .cb-seg[data-id]'))
      if (ids.has(el.dataset.id ?? '')) el.remove();
    this.#drawn = this.#drawn.filter((r) => !r.leaving);
    for (const id of ids) {
      this.#refs.delete(id);
      this.#shown.delete(id);
      this.#to.delete(id);
    }
  }

  #setHot(id: string, by: 'pointer' | 'focus' | ''): void {
    this.#hotBy = id ? by : '';
    if (id === this.#hot) return;
    this.#hot = id;
    this.#applyHot(true);
  }

  /** The pointer left: back to the focused row if there is one, else to the total. */
  #unhover(): void {
    const active = this.root.activeElement as HTMLElement | null;
    const item = active?.closest?.<HTMLElement>('.cb-item[data-id]');
    const id = item?.dataset.id ?? '';
    this.#setHot(id && this.#isLive(id) ? id : '', id ? 'focus' : '');
  }

  /** Hover lives outside the markup: the hot row lights, the others dim, its segment lifts, the figure rolls to it. */
  #applyHot(retarget: boolean): void {
    if (this.#hot && !this.#isLive(this.#hot)) this.#hot = '';
    const id = this.#hot;
    this.$('.cb-list')?.toggleAttribute('data-active', !!id);
    this.$('.cb-bar')?.toggleAttribute('data-active', !!id);
    for (const el of this.$$<HTMLElement>('.cb-item[data-id], .cb-seg[data-id]'))
      el.toggleAttribute('data-active', !!id && el.dataset.id === id);
    const cap = this.$<HTMLElement>('.cb-cap');
    const d = this.data;
    if (cap && d) {
      const c = this.#caption(d.totalLabel ? String(d.totalLabel) : this.#t.total, this.#t);
      if (cap.dataset.k !== c.key) {
        cap.innerHTML = c.html;
        cap.dataset.k = c.key;
        this.#capKey = c.key;
        cap.classList.remove('is-in');
        void cap.offsetWidth;
        cap.classList.add('is-in');
      }
    }
    if (!retarget || this.#mode !== 'data') return;
    const row = this.#drawn.find((r) => r.id === id);
    this.#to.set(FIGURE, row ? row.value : this.#model.base);
    this.#animate(ROLL_MS);
  }

  #keydown(e: KeyboardEvent): void {
    const opt = (e.target as Element | null)?.closest?.<HTMLElement>('.cb-opt[data-opt]');
    const d = this.data;
    if (!opt || !d) return;
    const opts = this.#options(d);
    const i = opts.findIndex((o) => o.id === opt.dataset.opt);
    if (i < 0) return;
    const n =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? i + 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? i - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? opts.length - 1
              : null;
    if (n === null) return;
    e.preventDefault();
    this.#choose(opts[(n + opts.length) % opts.length].id, true);
  }

  /** A pick leaves as ui-change (cancelable); uncontrolled, the card moves its own selection. */
  #choose(id: string, focus: boolean): void {
    const d = this.data;
    if (!d) return;
    const opts = this.#options(d);
    if (!opts.some((o) => o.id === id)) return;
    if (id !== this.#current(d, opts)) {
      if (!this.emit<CompactBreakdownChangeDetail>('ui-change', { value: id })) {
        if (focus) this.$<HTMLElement>('.cb-opt[aria-checked="true"]')?.focus();
        return;
      }
      this.#sayFor = id;
      if (this.data?.value === undefined) {
        this.#value = id;
        this.renderNow();
      }
    }
    if (focus)
      this.$$<HTMLElement>('.cb-opt[data-opt]')
        .find((b) => b.dataset.opt === id)
        ?.focus();
  }

  /** After a pick, the new total (or the error) is said once its data is in. */
  #announce(): void {
    const d = this.data;
    if (this.#sayFor === undefined || !d || d.loading) return;
    if (this.#current(d, this.#options(d)) !== this.#sayFor) return;
    this.#sayFor = undefined;
    const t = this.#t;
    const label = d.totalLabel ? String(d.totalLabel) : t.total;
    let text: string;
    if (this.#mode === 'error') text = String(d.error);
    else if (this.#mode === 'empty') text = d.emptyText ? String(d.emptyText) : t.empty;
    else {
      const top = this.#drawn.find((r) => !r.other && !r.leaving);
      text = `${t.sayTotal(label, this.#fmt(this.#model.base))}${top ? `, ${t.sayLargest(top.label)}` : ''}`;
    }
    if (this.#live.textContent !== text) this.#live.textContent = text;
  }
}

define('ui-compact-breakdown', UiCompactBreakdown);

declare global {
  interface HTMLElementTagNameMap {
    'ui-compact-breakdown': UiCompactBreakdown;
  }
}
