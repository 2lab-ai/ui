import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { GOOEY, type GooeyContext, type GooeyHost } from './context';
import { cssColor, gooFilterMarkup, sanitizeFilterMarkup, splitShadows } from './engine/filter';
import { createImageMeltRegistry, type ImageMeltRegistry, MeltLayer } from './engine/image-melt';
import { ObserveEngine } from './engine/observer';
import { parseShadow } from './engine/shadow';
import { itemPlanChanged } from './item';
import { styles } from './styles';

/** How much motion: `system` follows prefers-reduced-motion, `reduce` / `full` force it. */
export type GooeyMotion = 'system' | 'reduce' | 'full';

export interface GooeyData {
  /** Goo blur sigma in px — how far apart pieces start bridging (0 … 40). Default 6. */
  blur?: number;
  /** Alpha-contrast slope — how sharp the liquid edge is (1 … 100). Default 18. */
  contrast?: number;
  /** Fill of the liquid surface: any CSS colour, `var(--…)` and `color-mix()` welcome. Default `var(--surface)`. */
  fill?: string;
  /** `box-shadow` syntax, rendered on the MERGED silhouette. `inset` layers paint inside the liquid edge. */
  shadow?: string;
  /** Extra filter-region slack in px for blobs travelling outside the group's box (0 … 400). Default 24. */
  filterPadding?: number;
  /** Max px the liquid boundary undulates (0 … 40). 0 (default) keeps the calm edge. */
  waviness?: number;
  /** Noise frequency of the undulation (0.001 … 0.2); lower = longer, lazier waves. Default 0.018. */
  wavinessFreq?: number;
  /** Escape hatch: raw SVG filter primitives that REPLACE the goo chain (input `SourceGraphic`, the last primitive
   *  paints). Only `fe*` elements survive, without event handlers, `style` or outside `href`s. */
  filter?: string;
}

/** What the group draws with now: `data` first, then the attributes, each clamped to its range. */
export interface GooeyOptions {
  blur: number;
  contrast: number;
  fill: string;
  shadow: string;
  filterPadding: number;
  waviness: number;
  wavinessFreq: number;
  filter: string;
  motion: GooeyMotion;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function num(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? clamp(n, lo, hi) : dflt;
}

export function motionOf(v: unknown): GooeyMotion {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return s === 'reduce' || s === 'full' ? s : 'system';
}

/**
 * A liquid shadow that reads on light and dark (liquid-gooey's "Figma soft" elevation, in theme tokens): a hairline
 * inner ring, a hairline outer ring in the border colour, a tight contact shadow and a wide soft one. Pass it as
 * `shadow`; it is rebuilt on the merged silhouette like any box-shadow.
 */
export const GOOEY_SHADOW =
  '0 0 0 1px color-mix(in srgb, var(--text) 5%, transparent) inset, ' +
  '0 0 0 1px color-mix(in srgb, var(--border) 70%, transparent), ' +
  '0 2px 6px color-mix(in srgb, black 6%, transparent), ' +
  '0 4px 42px color-mix(in srgb, black 16%, transparent)';

/** The options for a data object and an attribute reader (pure: the element and the tests share it). */
export function gooeyOptions(d: GooeyData = {}, attr: (name: string) => string | null = () => null): GooeyOptions {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return {
    blur: num(d.blur ?? attr('blur'), 0, 40, 6),
    contrast: num(d.contrast ?? attr('contrast'), 1, 100, 18),
    fill: cssColor(str(d.fill ?? attr('fill'))) || 'var(--surface)',
    shadow: str(d.shadow ?? attr('shadow')),
    filterPadding: num(d.filterPadding ?? attr('filter-padding'), 0, 400, 24),
    waviness: num(d.waviness ?? attr('waviness'), 0, 40, 0),
    wavinessFreq: num(d.wavinessFreq ?? attr('waviness-freq'), 0.001, 0.2, 0.018),
    filter: str(d.filter),
    motion: motionOf(attr('motion')),
  };
}

let groupCounter = 0;

interface Built {
  sil: SVGSVGElement;
  filter: SVGFilterElement;
  portal: SVGGElement;
  mask: SVGMaskElement;
  meltPortal: SVGGElement;
  melt: HTMLElement;
}

/**
 * `<ui-gooey>` — a liquid group. Pieces inside it (each wrapped in a `<ui-gooey-item>`) merge like goo where they
 * touch and change shape like jelly, while their text, icons and photos stay crisp: the goo runs on an SVG silhouette
 * layer behind the content (one blob per item, a blur → alpha-contrast filter, the shadow rebuilt on the MERGED
 * shape), and the host's own markup rides on top, unfiltered — focus rings, hit targets, ARIA and handlers intact.
 *
 * Decorative: the svg layers are aria-hidden and take no pointer; the group adds no role and no words. The measuring
 * loop runs only while something moves (it sleeps after ~0.5s of stillness) and stops off screen and in a hidden tab.
 * Reduced motion: component-driven moves snap, and observed items mirror their element 1:1 (no lag, tail or bend).
 *
 * Ported from liquid-gooey 0.2.2 (`<Liquid>` / `<Gooey>`, MIT, © 2026 Jakub Antalik — https://libraries.dev/gooey).
 * The filter, springs, geometry and shadow maths are verbatim under `./engine/`.
 */
export class UiGooey extends UiElement<GooeyData> implements GooeyHost {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return ['blur', 'contrast', 'fill', 'shadow', 'filter-padding', 'waviness', 'waviness-freq', 'motion'];
  }

  readonly filterId = `gooey-${++groupCounter}`;
  #built: Built | null = null;
  #engine: ObserveEngine | null = null;
  #registry: ImageMeltRegistry = createImageMeltRegistry();
  #melt: MeltLayer | null = null;
  #ctx: GooeyContext | null = null;
  #opts: GooeyOptions | null = null;
  #markup = '';
  #w = 0;
  #h = 0;
  #pad = 0;
  #reduced = false;
  #visible = true;
  #ro: ResizeObserver | null = null;
  #io: IntersectionObserver | null = null;
  #motion: MediaQueryList | null = null;
  #wakeOff: Array<() => void> = [];
  #registryOff: (() => void) | null = null;

  attributeChangedCallback(_name: string, old: string | null, value: string | null): void {
    if (old !== value) this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#reduced = this.#computeReduced();
    this.#visible = true;
    this.#engine = new ObserveEngine(() => this);
    this.#ctx = null;
    const b = this.#ensure();
    this.#melt = new MeltLayer(
      this.#registry,
      () => this,
      b.melt,
      () => this.#reduced,
    );
    this.#registryOff = this.#registry.subscribe(this.#meltSources);
    this.#meltSources();
    if (typeof ResizeObserver === 'function') {
      this.#ro = new ResizeObserver(() => this.#measure());
      this.#ro.observe(this);
    }
    if (typeof IntersectionObserver === 'function') {
      this.#io = new IntersectionObserver((entries) => {
        const e = entries[entries.length - 1];
        if (!e) return;
        this.#visible = e.isIntersecting;
        this.#syncActive();
      });
      this.#io.observe(this);
    }
    if (typeof matchMedia === 'function') {
      this.#motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.#motion.addEventListener?.('change', this.#onMotion);
    }
    document.addEventListener('visibilitychange', this.#syncActive);
    this.#syncActive();
  }

  override disconnectedCallback(): void {
    this.#engine?.dispose();
    this.#engine = null;
    this.#ctx = null;
    this.#melt?.dispose();
    this.#melt = null;
    this.#registryOff?.();
    this.#registryOff = null;
    for (const off of this.#wakeOff) off();
    this.#wakeOff = [];
    this.#ro?.disconnect();
    this.#io?.disconnect();
    this.#motion?.removeEventListener?.('change', this.#onMotion);
    this.#ro = null;
    this.#io = null;
    this.#motion = null;
    document.removeEventListener('visibilitychange', this.#syncActive);
    super.disconnectedCallback();
  }

  /** What it draws with now (clamped). */
  get options(): GooeyOptions {
    return gooeyOptions(this.data ?? {}, (n) => this.getAttribute(n));
  }

  /** True while motion is reduced (the `motion` attribute, or the system setting under `motion="system"`). */
  get reducedMotion(): boolean {
    return this.#reduced;
  }

  /** True while the measuring loop (observed items) or the image melt is scheduled. */
  get running(): boolean {
    return !!this.#engine?.running || !!this.#melt?.running;
  }

  /** The measurement engine of the observed items (null while disconnected) — the advanced escape hatch. */
  get engine(): ObserveEngine | null {
    return this.#engine;
  }

  /** Wake the measuring loop now — after moving an item with something the wake sources cannot see (WAAPI). */
  wake(): void {
    this.#engine?.wake();
    this.#melt?.wake();
  }

  [GOOEY](): GooeyContext | null {
    if (!this.isConnected || !this.#engine) return null;
    const b = this.#ensure();
    if (!this.#ctx) {
      this.#ctx = {
        portal: b.portal,
        meltPortal: b.meltPortal,
        getGroup: () => this,
        engine: this.#engine,
        imageMelt: this.#registry,
        reduced: () => this.#reduced,
      };
    }
    return this.#ctx;
  }

  /** The image melt's own wake sources — a drag (pointer, style writes), a transition — only while a pair exists. */
  #meltSources = (): void => {
    const melt = this.#melt;
    const want = !!melt && this.#registry.entries().length >= 2;
    if (!want) {
      for (const off of this.#wakeOff) off();
      this.#wakeOff = [];
      return;
    }
    if (this.#wakeOff.length || !melt) return;
    const wake = melt.wake;
    for (const type of ['pointerdown', 'pointermove', 'transitionrun', 'animationstart']) {
      this.addEventListener(type, wake, true);
      this.#wakeOff.push(() => this.removeEventListener(type, wake, true));
    }
    if (typeof MutationObserver === 'function') {
      const mo = new MutationObserver(() => wake());
      mo.observe(this, { attributes: true, childList: true, subtree: true, attributeFilter: ['style', 'class'] });
      this.#wakeOff.push(() => mo.disconnect());
    }
  };

  protected render(): string {
    const id = this.filterId;
    return (
      `<svg class="gy-sil" part="silhouette" data-gooey-svg="" aria-hidden="true" focusable="false">` +
      `<defs><filter id="${id}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB" x="0" y="0" width="0" height="0"></filter></defs>` +
      `<g id="${id}-sil" class="gy-portal" filter="url(#${id})"></g></svg>` +
      // Melt overlay: warped-image copies render here, ABOVE the content layer. The mask re-renders the goo-filtered
      // silhouette (<use> across the two svgs), so the copies are clipped to the merged surface.
      `<svg class="gy-overlay" part="overlay" data-gooey-overlay="" aria-hidden="true" focusable="false">` +
      `<defs><mask id="${id}-meltmask" maskUnits="userSpaceOnUse" x="0" y="0" width="0" height="0"><use href="#${id}-sil"></use></mask></defs>` +
      `<g mask="url(#${id}-meltmask)"><g class="gy-melt-portal"></g></g></svg>` +
      '<slot></slot><div class="gy-melt" part="melt" aria-hidden="true"></div>'
    );
  }

  /** The layers are built once and patched: the items' blobs live in them. */
  protected override update(): void {
    const b = this.#ensure();
    const prev = this.#opts;
    const o = this.options;
    this.#opts = o;
    const reduced = this.#computeReduced();
    if (reduced !== this.#reduced) {
      this.#reduced = reduced;
      this.#replanItems();
    }
    if (this.#engine) this.#engine.gooBlur = o.blur;
    const shadows = parseShadow(o.shadow);
    const split = splitShadows(shadows, o.blur, o.filterPadding);
    const markup = o.filter
      ? sanitizeFilterMarkup(o.filter)
      : gooFilterMarkup({
          blur: o.blur,
          contrast: o.contrast,
          shadows: split.svg,
          waviness: o.waviness,
          wavinessFreq: o.wavinessFreq,
        });
    if (markup !== this.#markup) {
      this.#markup = markup;
      b.filter.innerHTML = markup;
    }
    // The GPU half of the shadow stack (see splitShadows).
    if (!prev || prev.shadow !== o.shadow || prev.blur !== o.blur || prev.filterPadding !== o.filterPadding) {
      b.sil.style.filter = o.filter ? '' : split.css;
    }
    if (!prev || prev.fill !== o.fill) {
      b.portal.style.fill = '';
      b.portal.style.fill = o.fill;
      if (!b.portal.style.fill) b.portal.style.fill = 'var(--surface)';
    }
    this.#pad = split.pad;
    if (!this.#ro || !prev) this.#measure();
    else this.#region();
    if (prev && prev.blur !== o.blur) this.wake();
    this.updated();
  }

  #ensure(): Built {
    if (this.#built) return this.#built;
    this.content.innerHTML = this.render();
    const q = <E extends Element>(s: string) => this.content.querySelector(s) as E;
    this.#built = {
      sil: q<SVGSVGElement>('.gy-sil'),
      filter: q<SVGFilterElement>('filter'),
      portal: q<SVGGElement>('.gy-portal'),
      mask: q<SVGMaskElement>('mask'),
      meltPortal: q<SVGGElement>('.gy-melt-portal'),
      melt: q<HTMLElement>('.gy-melt'),
    };
    return this.#built;
  }

  #measure = (): void => {
    this.#w = this.offsetWidth;
    this.#h = this.offsetHeight;
    this.#region();
  };

  /** The filter (and melt mask) region: the group's box plus the pad, in user space. */
  #region(): void {
    const b = this.#built;
    if (!b) return;
    const pad = this.#pad;
    const set = (el: Element) => {
      el.setAttribute('x', String(-pad));
      el.setAttribute('y', String(-pad));
      el.setAttribute('width', String(this.#w + pad * 2));
      el.setAttribute('height', String(this.#h + pad * 2));
    };
    set(b.filter);
    set(b.mask);
  }

  #computeReduced(): boolean {
    const m = motionOf(this.getAttribute('motion'));
    return m === 'reduce' || (m === 'system' && prefersReducedMotion());
  }

  #onMotion = (): void => {
    this.requestRender();
  };

  /** The items plan their mode with the motion setting: tell them it changed. */
  #replanItems(): void {
    for (const el of Array.from(this.querySelectorAll('ui-gooey-item'))) itemPlanChanged(el);
  }

  #isActive(): boolean {
    return this.#visible && !(typeof document !== 'undefined' && document.hidden);
  }

  #syncActive = (): void => {
    const on = this.#isActive();
    this.#engine?.setActive(on);
    this.#melt?.setActive(on);
  };
}

define('ui-gooey', UiGooey);

declare global {
  interface HTMLElementTagNameMap {
    'ui-gooey': UiGooey;
  }
}
