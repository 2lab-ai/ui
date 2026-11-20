import { define, UiElement } from '../../core/element';
import { GOOEY, type GooeyContext, isGooeyHost } from './context';
import {
  type BlobBox,
  type CornerRadii,
  measureRadius,
  normalizeRadius,
  offsetTo,
  roundedRectPath,
} from './engine/geometry';
import { IMAGE_MELT_DEFAULTS, type ImageMeltOptions } from './engine/image-melt';
import {
  type BlendConfig,
  EVOLVE_DEFAULTS,
  type EvolveOptions,
  type ItemDynamics,
  MOVE_DEFAULTS,
  type MoveOptions,
} from './engine/observer';
import { easingFunction, resolveTransition, type SpringConfig, type Transition } from './engine/spring';
import {
  type BendTuning,
  type DissolveOptions,
  type LiquidEffect,
  type MorphTuning,
  type MoveTuning,
  mapBend,
  mapDissolve,
  mapMorphSprings,
  mapMove,
} from './engine/tuning';
import { itemStyles } from './styles';

/** A liquid item: the knobs of liquid-gooey's `<Liquid.Item>`, one to one. */
export interface GooeyItemData {
  /** 'morph' (default), 'move', 'bend' or 'melt'. */
  effect?: LiquidEffect;
  /** Tuning for effect="morph" (`shape` turns on the jelly shape change). */
  morph?: MorphTuning;
  /** Tuning for effect="move". */
  move?: MoveTuning;
  /** Tuning for effect="bend". */
  bend?: BendTuning;
  /** Tuning for effect="melt": the image source (auto-detected from a child <img>) plus the melt's physics. */
  melt?: ImageMeltOptions & { src?: string };
  /** Melt this item's imagery into a touching neighbour (morph items): `true`, `0..1`, or raw DissolveOptions. */
  dissolve?: boolean | number | DissolveOptions;
  /** Component-driven position (px): the element and its liquid move in one clock, pixel-perfect. */
  x?: number;
  y?: number;
  scale?: number;
  /** 'snappy' | 'smooth' | 'bouncy', `{ stiffness, damping, mass }` or `{ duration, ease }`. Default 'smooth'. */
  transition?: Transition;
  /** Transition delay in ms (stagger). */
  delay?: number;
  /** Plain-merge items animated by YOUR code: the liquid follows the child's rendered rect. */
  observe?: boolean;
  /** Override the measured border-radius for the liquid (px, or [tl, tr, br, bl]). */
  radius?: number | CornerRadii;
}

/** Component-driven: the item element itself is the moving box; its blob mirrors the same transform. */
export interface MirrorPlan {
  kind: 'mirror';
  x: number;
  y: number;
  scale: number;
  duration: number;
  easing: string;
  delay: number;
  radius: CornerRadii | null;
}

/** Observed: the item's first element child is followed by the measurement engine. */
export interface ObservePlan {
  kind: 'observe';
  radius: number | null;
  blobInset: number | null;
  bridgeGrow: number | null;
  /** The resolved dissolve (null: none). */
  blend: Required<Omit<DissolveOptions, 'range' | 'zone' | 'fadeMs' | 'sink' | 'surface' | 'seamBlur'>> &
    Pick<DissolveOptions, 'range' | 'zone' | 'fadeMs' | 'sink' | 'surface' | 'seamBlur'>;
  hasBlend: boolean;
  dynamics: ItemDynamics | null;
  /** What forces a re-registration (anything but the live dissolve fields). */
  key: string;
}

/** effect="melt": the item's first element child is painted by the group's melt layer. */
export interface MeltPlan {
  kind: 'melt';
  src: string | null;
  opts: Required<ImageMeltOptions>;
}

export type GooeyItemPlan = MirrorPlan | ObservePlan | MeltPlan;

const EFFECTS: readonly LiquidEffect[] = ['morph', 'move', 'melt', 'bend'];
const PRESETS = ['snappy', 'smooth', 'bouncy'] as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
function num(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? clamp(n, lo, hi) : dflt;
}
/** A finite number in range, else undefined (so the engine default applies). */
function opt(v: unknown, lo: number, hi: number): number | undefined {
  const n = num(v, lo, hi, Number.NaN);
  return Number.isNaN(n) ? undefined : n;
}
const obj = <T extends object>(v: unknown): T | undefined =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : undefined;

/** Keep only the finite numbers of a raw options object (each clamped), so NaN never reaches the springs. */
function finite<T extends object>(v: T | undefined, lo = -1e5, hi = 1e5): Partial<T> {
  const out: Record<string, unknown> = {};
  if (!v) return out as Partial<T>;
  for (const [k, x] of Object.entries(v)) {
    if (typeof x === 'number') {
      if (Number.isFinite(x)) out[k] = clamp(x, lo, hi);
    } else if (typeof x === 'string' || typeof x === 'boolean') out[k] = x;
  }
  return out as Partial<T>;
}

export function effectOf(v: unknown): LiquidEffect {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return (EFFECTS as readonly string[]).includes(s) ? (s as LiquidEffect) : 'morph';
}

/** A transition from data or an attribute: a preset name, a spring or a timed curve — clamped; anything else is
 *  'smooth'. */
export function transitionOf(v: unknown): Transition {
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return (PRESETS as readonly string[]).includes(s) ? (s as Transition) : 'smooth';
  }
  const o = obj<Record<string, unknown>>(v);
  if (!o) return 'smooth';
  if ('duration' in o) {
    return {
      duration: num(o.duration, 0, 10000, 300),
      ...(typeof o.ease === 'string' && o.ease.trim() ? { ease: o.ease.trim() } : {}),
    };
  }
  const spring: SpringConfig = {};
  const k = opt(o.stiffness, 1, 5000);
  const c = opt(o.damping, 0, 500);
  const m = opt(o.mass, 0.05, 50);
  if (k !== undefined) spring.stiffness = k;
  if (c !== undefined) spring.damping = c;
  if (m !== undefined) spring.mass = m;
  return spring;
}

function radiusOf(v: unknown): CornerRadii | null {
  if (Array.isArray(v) && v.length === 4) {
    const r = v.map((x) => num(x, 0, 10000, 0)) as CornerRadii;
    return r;
  }
  const n = opt(v, 0, 10000);
  return n === undefined ? null : normalizeRadius(n);
}

/** The attributes an item reads (data wins). */
export interface GooeyItemAttrs {
  effect?: string | null;
  x?: string | null;
  y?: string | null;
  scale?: string | null;
  transition?: string | null;
  delay?: string | null;
  observe?: boolean;
  radius?: string | null;
  dissolve?: string | null;
}

/**
 * The plan for an item: which mode it runs in and with what — liquid-gooey's LiquidItem → GooeyItem mapping, verbatim
 * in its decisions. Reduced motion: component-driven moves snap (duration 0), observed items keep no dynamics (the
 * liquid mirrors the element 1:1 — no lag, tail, bend or shape travel) and the dissolve does not churn.
 */
export function gooeyItemPlan(d: GooeyItemData = {}, a: GooeyItemAttrs = {}, reduced = false): GooeyItemPlan {
  const effect = effectOf(d.effect ?? a.effect);
  if (effect === 'melt') {
    const m = obj<ImageMeltOptions & { src?: string }>(d.melt) ?? {};
    const { src, ...tuning } = m;
    return {
      kind: 'melt',
      src: typeof src === 'string' && src.trim() ? src.trim() : null,
      opts: { ...IMAGE_MELT_DEFAULTS, ...finite(tuning, -1000, 1000) },
    };
  }
  const radius = radiusOf(d.radius ?? a.radius);
  const rawDissolve: unknown = d.dissolve ?? (a.dissolve == null ? undefined : a.dissolve === '' ? true : a.dissolve);
  const dissolve =
    typeof rawDissolve === 'boolean'
      ? rawDissolve
      : typeof rawDissolve === 'number' || typeof rawDissolve === 'string'
        ? num(rawDissolve, 0, 1, 1)
        : obj<DissolveOptions>(rawDissolve);
  let moveOpts: MoveOptions | null = null;
  let evolveOpts: EvolveOptions | null = null;
  let contactBlur: DissolveOptions | undefined;
  let observe = !!(d.observe ?? a.observe);
  let adv: MorphTuning['advanced'];
  if (effect === 'bend') {
    moveOpts = mapBend(finiteTuning(obj<BendTuning>(d.bend)));
    observe = true;
  } else if (effect === 'move') {
    // `dissolve` is ignored with move: the melt is drawn from the element's MEASURED rect while move's liquid lags
    // on a spring, so the two would visibly disagree.
    moveOpts = mapMove(finiteTuning(obj<MoveTuning>(d.move)));
    observe = true;
  } else {
    const morph = finiteTuning(obj<MorphTuning>(d.morph));
    adv = obj<NonNullable<MorphTuning['advanced']>>(morph?.advanced);
    const shape = !!morph?.shape;
    const wants = dissolve !== undefined && dissolve !== false;
    contactBlur = wants
      ? typeof dissolve === 'object'
        ? { ...mapDissolve(true), ...finite(dissolve) }
        : mapDissolve(dissolve as boolean | number)
      : undefined;
    if (shape) evolveOpts = { ...mapMorphSprings(morph), ...finite(obj<EvolveOptions>(adv?.evolve), 0, 1e5) };
    observe = observe || shape || !!contactBlur;
  }
  if (!observe) {
    const t = resolveTransition(transitionOf(d.transition ?? a.transition), reduced);
    return {
      kind: 'mirror',
      x: num(d.x ?? a.x, -1e5, 1e5, 0),
      y: num(d.y ?? a.y, -1e5, 1e5, 0),
      scale: num(d.scale ?? a.scale, 0, 100, 1),
      duration: t.duration,
      easing: t.easing,
      delay: reduced ? 0 : num(d.delay ?? a.delay, 0, 1e5, 0),
      radius,
    };
  }
  const o = contactBlur ?? {};
  const blend: ObservePlan['blend'] = {
    blur: o.blur ?? 8,
    warp: o.warp ?? 26,
    pull: o.pull ?? 4,
    range: o.range,
    zone: o.zone,
    mix: o.mix ?? 0,
    gravity: o.gravity ?? 60,
    taper: o.taper ?? 1,
    warpFreq: o.warpFreq ?? 1.7,
    flowSpeed: reduced ? 0 : (o.flowSpeed ?? 22),
    warpStyle: o.warpStyle === 'turbulence' ? 'turbulence' : 'fractalNoise',
    detail: o.detail ?? 2,
    active: o.active !== false,
    releaseMs: o.releaseMs ?? 240,
    fadeMs: o.fadeMs,
    strength: o.strength ?? 1,
    sink: o.sink,
    surface: o.surface === 'image' ? 'image' : o.surface === 'liquid' ? 'liquid' : undefined,
    seamBlur: o.seamBlur,
  };
  const effects: Array<'evolve' | 'move'> = [];
  if (!reduced && evolveOpts) effects.push('evolve');
  if (!reduced && moveOpts) effects.push('move');
  const dynamics: ItemDynamics | null = effects.length
    ? {
        evolve: effects.includes('evolve'),
        move: effects.includes('move'),
        evolveOpts: { ...EVOLVE_DEFAULTS, ...(evolveOpts ?? {}) },
        moveOpts: { ...MOVE_DEFAULTS, ...(moveOpts ?? {}) },
      }
    : null;
  const blobInset = opt(adv?.blobInset, -1000, 1000) ?? null;
  const bridgeGrow = opt(adv?.bridgeGrow, 0, 1000) ?? null;
  // `active` (and the other live fields) are NOT in the key: they change every drag and must not tear down the melt
  // structure — the engine reads them live.
  const blendKey = contactBlur
    ? `${blend.blur}/${blend.warp}/${blend.pull}/${blend.range ?? 'auto'}/${blend.zone ?? 'auto'}/${blend.mix}/${blend.gravity}/${blend.taper}/${blend.warpFreq}/${blend.flowSpeed}/${blend.warpStyle}/${blend.detail}/${blend.surface ?? 'liquid'}/${(blend.seamBlur ?? 1) > 0 ? 'seam' : 'noseam'}`
    : '';
  const effectKey =
    effects.join(',') +
    (dynamics?.evolve ? JSON.stringify(dynamics.evolveOpts) : '') +
    (dynamics?.move ? JSON.stringify(dynamics.moveOpts) : '');
  return {
    kind: 'observe',
    radius: radius ? radius[0] : null,
    blobInset,
    bridgeGrow,
    blend,
    hasBlend: !!contactBlur,
    dynamics,
    key: `${radius ? radius.join(',') : ''}|${blendKey}|${effectKey}|${blobInset}|${bridgeGrow}`,
  };
}

/** Drop the non-finite numbers of a tuning object (one level deep; `advanced` keeps its own objects). */
function finiteTuning<T extends object>(t: T | undefined): T | undefined {
  if (!t) return t;
  const out: Record<string, unknown> = { ...finite(t) };
  const adv = obj<Record<string, unknown>>((t as Record<string, unknown>).advanced);
  if (adv) {
    const a: Record<string, unknown> = { ...finite(adv) };
    const ev = obj<Record<string, unknown>>(adv.evolve);
    if (ev) a.evolve = finite(ev);
    out.advanced = a;
  }
  return out as T;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function sameBox(a: BlobBox | null, b: BlobBox): boolean {
  return !!a && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h && a.r.every((v, i) => v === b.r[i]);
}

/** Tell an item (if it is one) that the group's motion setting changed. */
export function itemPlanChanged(el: Element): void {
  if (el instanceof UiGooeyItem) el.requestRender();
}

/**
 * `<ui-gooey-item>` — one piece of a `<ui-gooey>` group. It wraps the host's own element (a button, a slider thumb, a
 * card, a photo) and mirrors it into the liquid layer behind: the item never takes over the markup inside it.
 *
 * Two modes, picked from its knobs exactly as liquid-gooey picks them:
 * - component-driven (`x` / `y` / `scale`): the item element itself is the moving box (inline-block); it and its blob
 *   are moved by one JS clock along the same spring curve, so they can never tear apart;
 * - observed (`effect="move"` / `"bend"`, `morph.shape`, `dissolve`, `observe`): the item is `display: contents`
 *   and its first element child — moved by your own code — is followed by the group's measuring loop.
 * `effect="melt"` hands its first element child (with an `<img>`) to the group's image melt.
 */
export class UiGooeyItem extends UiElement<GooeyItemData> {
  static override styles = [itemStyles];
  static get observedAttributes(): string[] {
    return ['effect', 'x', 'y', 'scale', 'transition', 'delay', 'observe', 'radius', 'dissolve'];
  }

  #mode: HTMLStyleElement | null = null;
  #modeCss = '';
  #ctx: GooeyContext | null = null;
  #plan: GooeyItemPlan | null = null;
  // Component-driven
  #blob: SVGRectElement | SVGPathElement | null = null;
  #box: BlobBox | null = null;
  #cur: { x: number; y: number; s: number } | null = null;
  #goal = '';
  #raf = 0;
  #ro: ResizeObserver | null = null;
  // Observed
  #remove: (() => void) | null = null;
  #obsBlob: SVGRectElement | null = null;
  #meltHost: SVGGElement | null = null;
  #blend: BlendConfig | null = null;
  #obsTarget: HTMLElement | null = null;
  #key = '';
  // Melt
  #unmelt: (() => void) | null = null;
  #meltTarget: HTMLElement | null = null;
  #meltKey = '';

  override disconnectedCallback(): void {
    this.#teardown();
    this.#ctx = null;
    super.disconnectedCallback();
  }

  attributeChangedCallback(_name: string, old: string | null, value: string | null): void {
    if (old !== value) this.requestRender();
  }

  /** The plan it runs now (null before it found its group). */
  get plan(): GooeyItemPlan | null {
    return this.#plan;
  }

  /** The blob that stands for it in the silhouette layer (null while it has none). */
  get blob(): SVGElement | null {
    return this.#blob ?? this.#obsBlob;
  }

  protected render(): string {
    return '<slot></slot>';
  }

  protected override update(): void {
    if (!this.#mode) {
      this.content.innerHTML = this.render();
      this.#mode = document.createElement('style');
      this.root.append(this.#mode);
      this.content.querySelector('slot')?.addEventListener('slotchange', () => this.requestRender());
    }
    const group = this.closest('ui-gooey');
    const ctx = isGooeyHost(group) ? group[GOOEY]() : null;
    if (ctx !== this.#ctx) {
      this.#teardown();
      this.#ctx = ctx;
    }
    if (!ctx) return;
    const plan = gooeyItemPlan(this.data ?? {}, this.#attrs(), ctx.reduced());
    const prev = this.#plan;
    if (prev && prev.kind !== plan.kind) this.#teardown();
    this.#plan = plan;
    this.#setModeCss(
      plan.kind === 'mirror'
        ? ':host { display: inline-block; will-change: transform; }'
        : ':host { display: contents; }',
    );
    if (plan.kind === 'mirror') this.#mirror(ctx, plan);
    else if (plan.kind === 'observe') this.#observe(ctx, plan);
    else this.#meltItem(ctx, plan);
    this.updated();
  }

  #attrs(): GooeyItemAttrs {
    const g = (n: string) => this.getAttribute(n);
    return {
      effect: g('effect'),
      x: g('x'),
      y: g('y'),
      scale: g('scale'),
      transition: g('transition'),
      delay: g('delay'),
      observe: this.hasAttribute('observe'),
      radius: g('radius'),
      dissolve: g('dissolve'),
    };
  }

  #setModeCss(css: string): void {
    if (css === this.#modeCss || !this.#mode) return;
    this.#modeCss = css;
    this.#mode.textContent = css;
  }

  #teardown(): void {
    // Component-driven
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    this.#ro?.disconnect();
    this.#ro = null;
    this.#blob?.remove();
    this.#blob = null;
    this.#box = null;
    if (this.#plan?.kind === 'mirror') this.style.removeProperty('transform');
    this.#cur = null;
    this.#goal = '';
    // Observed
    this.#remove?.();
    this.#remove = null;
    this.#obsBlob?.remove();
    this.#obsBlob = null;
    this.#meltHost?.remove();
    this.#meltHost = null;
    this.#blend = null;
    this.#obsTarget = null;
    this.#key = '';
    // Melt
    this.#unmelt?.();
    this.#unmelt = null;
    this.#meltTarget = null;
    this.#meltKey = '';
    this.#plan = null;
  }

  // ── Component-driven (liquid-gooey's MirroredItem) ─────────────────────────────────────────────────────────────

  #mirror(ctx: GooeyContext, plan: MirrorPlan): void {
    if (!this.#ro && typeof ResizeObserver === 'function') {
      this.#ro = new ResizeObserver(() => this.#measureMirror());
      this.#ro.observe(this);
      const group = ctx.getGroup();
      if (group) this.#ro.observe(group);
    }
    this.#measureMirror();
    this.#animate(plan);
  }

  #measureMirror(): void {
    const ctx = this.#ctx;
    const plan = this.#plan;
    const group = ctx?.getGroup();
    if (!ctx || !group || plan?.kind !== 'mirror') return;
    const base = offsetTo(this, group);
    const w = this.offsetWidth;
    const h = this.offsetHeight;
    const target = (this.firstElementChild as HTMLElement | null) ?? this;
    const r: CornerRadii = plan.radius ?? measureRadius(target, w, h);
    const next: BlobBox = { x: base.x, y: base.y, w, h, r };
    if (sameBox(this.#box, next) && this.#blob?.isConnected) return;
    this.#box = next;
    const uniform = r[0] === r[1] && r[1] === r[2] && r[2] === r[3];
    const tag = uniform ? 'rect' : 'path';
    if (!this.#blob || this.#blob.localName !== tag || !this.#blob.isConnected) {
      this.#blob?.remove();
      const el = document.createElementNS(SVG_NS, tag) as SVGRectElement | SVGPathElement;
      el.style.setProperty('transform-box', 'fill-box');
      el.style.setProperty('transform-origin', 'center');
      el.style.setProperty('will-change', 'transform');
      ctx.portal.append(el);
      this.#blob = el;
    }
    const el = this.#blob;
    if (uniform) {
      // Clamp to min(w,h)/2: SVG clamps rx and ry independently, so a large radius on a wide short box (the
      // `border-radius: 999px` pill idiom) would degenerate into an ellipse instead of a pill.
      const rx = Math.max(0, Math.min(r[0], Math.min(w, h) / 2));
      el.setAttribute('x', String(next.x));
      el.setAttribute('y', String(next.y));
      el.setAttribute('width', String(w));
      el.setAttribute('height', String(h));
      el.setAttribute('rx', String(rx));
    } else {
      el.setAttribute('d', roundedRectPath(next.x, next.y, w, h, r));
    }
    // The blob (re)mounts whenever the measured box changes: catch it up to the rendered value.
    const c = this.#cur ?? { x: plan.x, y: plan.y, s: plan.scale };
    el.style.transform = transformOf(c.x, c.y, c.s);
  }

  /** Content and blob are animated by ONE JS clock — no CSS transition on the wrapper: a compositor transition keeps
   *  playing through a main-thread stall while the blob (written from JS) freezes, which reads as the content sailing
   *  away from its own liquid. Retargets like a CSS transition: from the rendered value, full duration. */
  #animate(plan: MirrorPlan): void {
    const { x, y, scale, duration, easing, delay } = plan;
    // A render that leaves the goal as it was (a slot change, another attribute) must not restart a move in flight.
    const goal = `${x},${y},${scale},${duration},${easing},${delay}`;
    if (goal === this.#goal && this.#cur) return;
    this.#goal = goal;
    const from = this.#cur;
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    if (!from || duration <= 0 || (from.x === x && from.y === y && from.s === scale)) {
      this.#cur = { x, y, s: scale };
      this.#write(x, y, scale);
      return;
    }
    const f = { ...from };
    const ease = easingFunction(easing);
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / duration));
      const e = ease(p);
      const cx = f.x + (x - f.x) * e;
      const cy = f.y + (y - f.y) * e;
      const cs = f.s + (scale - f.s) * e;
      this.#cur = { x: cx, y: cy, s: cs };
      this.#write(cx, cy, cs);
      this.#raf = p < 1 ? requestAnimationFrame(tick) : 0;
    };
    this.#raf = requestAnimationFrame(tick);
  }

  #write(x: number, y: number, s: number): void {
    const t = transformOf(x, y, s);
    this.style.transform = t;
    if (this.#blob) this.#blob.style.transform = t;
  }

  /** True while a component-driven move is in flight. */
  get animating(): boolean {
    return this.#raf !== 0;
  }

  // ── Observed (liquid-gooey's ObservedItem) ─────────────────────────────────────────────────────────────────────

  #observe(ctx: GooeyContext, plan: ObservePlan): void {
    const target = this.firstElementChild as HTMLElement | null;
    const key = `${plan.key}|${ctx.reduced()}`;
    if (!target) {
      this.#remove?.();
      this.#remove = null;
      this.#obsTarget = null;
      this.#key = '';
      return;
    }
    if (this.#remove && key === this.#key && target === this.#obsTarget) {
      // `active` / `releaseMs` / `fadeMs` / `strength` / `sink` / `seamBlur` go straight into the live config, so a
      // drag release (or a strength slider) updates the melt without rebuilding its SVG structure.
      const live = this.#blend;
      if (live) {
        live.active = plan.blend.active;
        live.releaseMs = plan.blend.releaseMs;
        live.fadeMs = plan.blend.fadeMs;
        live.strength = plan.blend.strength;
        live.sink = plan.blend.sink;
        live.seamBlur = plan.blend.seamBlur;
      }
      ctx.engine.wake();
      return;
    }
    this.#remove?.();
    this.#remove = null;
    if (!this.#obsBlob) {
      const rect = document.createElementNS(SVG_NS, 'rect') as SVGRectElement;
      for (const a of ['x', 'y', 'width', 'height']) rect.setAttribute(a, '0');
      rect.style.setProperty('will-change', 'transform');
      // Dynamics scale (stretch / squash) about the blob's own centre.
      rect.style.setProperty('transform-box', 'fill-box');
      rect.style.setProperty('transform-origin', 'center');
      ctx.portal.append(rect);
      this.#obsBlob = rect;
    }
    if (plan.hasBlend && !this.#meltHost) {
      const g = document.createElementNS(SVG_NS, 'g') as SVGGElement;
      g.setAttribute('opacity', '0');
      ctx.meltPortal.append(g);
      this.#meltHost = g;
    } else if (!plan.hasBlend && this.#meltHost) {
      this.#meltHost.remove();
      this.#meltHost = null;
    }
    const b = plan.blend;
    this.#blend =
      plan.hasBlend && this.#meltHost
        ? {
            host: this.#meltHost,
            blur: b.blur,
            warp: b.warp,
            pull: b.pull,
            range: b.range,
            zone: b.zone,
            mix: b.mix,
            gravity: b.gravity,
            taper: b.taper,
            warpFreq: b.warpFreq,
            flowSpeed: b.flowSpeed,
            warpStyle: b.warpStyle,
            detail: b.detail,
            active: b.active,
            releaseMs: b.releaseMs,
            fadeMs: b.fadeMs,
            strength: b.strength,
            sink: b.sink,
            surface: b.surface,
            seamBlur: b.seamBlur,
          }
        : null;
    this.#key = key;
    this.#obsTarget = target;
    this.#remove = ctx.engine.add({
      target,
      blob: this.#obsBlob,
      radius: plan.radius ?? undefined,
      blobInset: plan.blobInset ?? undefined,
      bridgeGrow: plan.bridgeGrow ?? undefined,
      blend: this.#blend ?? undefined,
      dynamics: plan.dynamics ?? undefined,
    });
  }

  // ── Melt (liquid-gooey's ImageMeltItem) ────────────────────────────────────────────────────────────────────────

  #meltItem(ctx: GooeyContext, plan: MeltPlan): void {
    const target = this.firstElementChild as HTMLElement | null;
    const img =
      plan.src ?? (target?.querySelector('img')?.src || (target instanceof HTMLImageElement ? target.src : '') || null);
    const key = `${img}|${JSON.stringify(plan.opts)}`;
    if (key === this.#meltKey && target === this.#meltTarget && this.#unmelt) return;
    this.#unmelt?.();
    this.#unmelt = null;
    this.#meltKey = key;
    this.#meltTarget = target;
    if (!target || !img) return;
    // The DOM element stays for layout + interaction; the svg paints it.
    const prevOpacity = target.style.opacity;
    target.style.opacity = '0';
    const unregister = ctx.imageMelt.register({ el: target, src: img, opts: plan.opts });
    this.#unmelt = () => {
      target.style.opacity = prevOpacity;
      unregister();
    };
  }
}

function transformOf(x: number, y: number, s: number): string {
  return `translate(${x}px, ${y}px)${s !== 1 ? ` scale(${s})` : ''}`;
}

define('ui-gooey-item', UiGooeyItem);

declare global {
  interface HTMLElementTagNameMap {
    'ui-gooey-item': UiGooeyItem;
  }
}
