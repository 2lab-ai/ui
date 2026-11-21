/** Image melt (effect="melt"): two image-filled cards whose surfaces run molten where they touch — colours averaged
 *  through the goo, the crisp faces dissolving at the seam, and a marbling pass folding the two palettes into streaks
 *  in the touch area.
 *
 *  The participating items' DOM stays interactive but paints nothing (opacity 0); an SVG layer in the group re-renders
 *  their imagery as pattern-filled rounded rects through the melt's filter stack, following the live rects. Pairwise by
 *  design — the first two melt items in a group form the pair; the seam maths is two-body.
 *
 *  Ported from liquid-gooey 0.2.2 (`src/imageMelt.tsx`, MIT, © 2026 Jakub Antalik — https://libraries.dev/gooey). The
 *  pair's markup and maths are verbatim (`meltPairMarkup`); the React state became `MeltLayer`, a loop that sleeps once
 *  the pair is still (the original measured every frame while a pair existed) and patches the svg in place. */

import { escAttr, safeSrc } from '../../../core/html';
import { morphInto } from '../../../core/morph';
import { gooIntercept } from './filter';

export interface ImageMeltOptions {
  /** Goo sigma: how far the bodies reach for each other AND how wide the colour averaging runs. Default 7. */
  blur?: number;
  /** Alpha-contrast slope of the liquid boundary. Default 40. */
  contrast?: number;
  /** How far each crisp face dissolves back before the neighbour, as a factor of the half-diagonal. Default 0.8. */
  reach?: number;
  /** Softness of that dissolve (mask blur sigma). Default 17. */
  fade?: number;
  /** Turbulence displacement of the molten layer, px. Default 0. */
  warp?: number;
  /** 0..1 two-liquid marbling strength in the touch area. Default 1. */
  mix?: number;
  /** Blur of the marble pass's source colours. Default 8. */
  mixBlur?: number;
  /** How deep the marble zone reaches into each card. Default 1.9. */
  gravity?: number;
  /** Wavelength control of the warp noise. Default 12. */
  waviness?: number;
}

export const IMAGE_MELT_DEFAULTS: Required<ImageMeltOptions> = {
  blur: 7,
  contrast: 40,
  reach: 0.8,
  fade: 17,
  warp: 0,
  mix: 1,
  mixBlur: 8,
  gravity: 1.9,
  waviness: 12,
};

export interface ImageMeltEntry {
  el: HTMLElement;
  src: string;
  opts: Required<ImageMeltOptions>;
}

/** The melt items of one group register here; the group's layer paints the first two. */
export interface ImageMeltRegistry {
  register(entry: ImageMeltEntry): () => void;
  subscribe(fn: () => void): () => void;
  entries(): ImageMeltEntry[];
}

export function createImageMeltRegistry(): ImageMeltRegistry {
  const set = new Set<ImageMeltEntry>();
  const subs = new Set<() => void>();
  const notify = () => {
    for (const f of subs) f();
  };
  return {
    register(entry) {
      set.add(entry);
      notify();
      return () => {
        set.delete(entry);
        notify();
      };
    },
    subscribe(fn) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
    entries: () => [...set],
  };
}

export interface CardGeom {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

/** A card's rect in the group's layout px, with its corner radius (clamped to a pill). */
export function readGeom(group: HTMLElement, el: HTMLElement): CardGeom {
  const gr = group.getBoundingClientRect();
  const k = group.offsetWidth > 0 && gr.width > 0 ? gr.width / group.offsetWidth : 1;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const rad = Number.parseFloat(cs.borderTopLeftRadius) || 0;
  const w = r.width / k;
  const h = r.height / k;
  return {
    x: (r.left - gr.left) / k,
    y: (r.top - gr.top) / k,
    w,
    h,
    r: Math.min(rad, w / 2, h / 2),
  };
}

export const geomKey = (g: CardGeom): string =>
  `${Math.round(g.x * 2)},${Math.round(g.y * 2)},${Math.round(g.w)},${Math.round(g.h)},${Math.round(g.r)}`;

/** How near the pair is, 0 (apart past the reach) … 1 (touching), smoothstepped: the target the eased proximity
 *  chases. */
export function meltProximity(a: CardGeom, b: CardGeom, gooBlur: number): number {
  const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const gap = Math.max(
    0,
    Math.hypot(
      Math.max(Math.abs(ca.x - cb.x) - (a.w + b.w) / 2, 0),
      Math.max(Math.abs(ca.y - cb.y) - (a.h + b.h) / 2, 0),
    ),
  );
  const near = Math.max(0, Math.min(1, 1 - gap / Math.max(8, gooBlur * 2.6)));
  return near * near * (3 - 2 * near);
}

/** One step of the exponential chase toward a target (rate 14/s, dt capped at 50ms, snapping within 0.004) — the
 *  eased proximity that keeps the melt growing in over ~200ms instead of popping at the goo threshold. */
export function easeToward(value: number, target: number, dtSeconds: number, rate = 14): number {
  const dt = Math.min(0.05, Math.max(0, dtSeconds));
  const next = value + (target - value) * (1 - Math.exp(-rate * dt));
  return Math.abs(next - target) < 0.004 ? target : next;
}

export interface MeltPairInput {
  a: CardGeom;
  b: CardGeom;
  srcA: string;
  srcB: string;
  opts: Required<ImageMeltOptions>;
  width: number;
  height: number;
  /** The eased proximity, 0 … 1. */
  prox: number;
  /** Id prefix for this pair's defs. */
  uid: string;
}

const r1 = (v: number) => Math.round(v * 1000) / 1000;

/** The melt svg for one pair: a pure function of the two geometries, sources, tuning and proximity. Image sources go
 *  through `safeSrc` (http(s), relative, blob: or a base64 raster); anything else draws nothing. */
export function meltPairMarkup({ a, b, srcA, srcB, opts, width, height, prox, uid }: MeltPairInput): string {
  const { blur: gooBlur, contrast, reach, fade, warp, mix, mixBlur, gravity, waviness } = opts;
  const id = escAttr(uid);
  const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const intercept = gooIntercept(contrast);
  const rA = (Math.hypot(a.w, a.h) / 2) * reach * prox;
  const rB = (Math.hypot(b.w, b.h) / 2) * reach * prox;
  const seam = { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 };
  const dxc = cb.x - ca.x;
  const dyc = cb.y - ca.y;
  const dc = Math.max(1e-3, Math.hypot(dxc, dyc));
  const tx = -dyc / dc;
  const ty = dxc / dc;
  const ovx = Math.max(0, (a.w + b.w) / 2 - Math.abs(dxc));
  const ovy = Math.max(0, (a.h + b.h) / 2 - Math.abs(dyc));
  const tanHalf = 0.5 * (ovx * Math.abs(tx) + ovy * Math.abs(ty)) * prox;
  const seamDeg = Math.round((Math.atan2(ty, tx) * 180) / Math.PI);
  const mixAmt = Math.round(mix * prox * 100) / 100;
  const blurEff = Math.round((2 + (gooBlur - 2) * prox) * 10) / 10;
  const warpEff = Math.round(warp * prox * 10) / 10;
  const colorBlur = Math.round(blurEff * 2.5 * 10) / 10;
  const edgeSoft = Math.round((0.4 + (2 + gooBlur * 0.8) * prox) * 10) / 10;
  const waveF = (2 + waviness * 1.2) / 1000;
  const goo = `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${contrast} ${intercept}`;
  const gA = `translate(${r1(a.x)}, ${r1(a.y)})`;
  const gB = `translate(${r1(b.x)}, ${r1(b.y)})`;
  const rot = `rotate(${seamDeg}, ${r1(seam.x)}, ${r1(seam.y)})`;
  const card = (g: CardGeom, fill: string) =>
    `<rect width="${r1(g.w)}" height="${r1(g.h)}" rx="${r1(g.r)}" fill="${fill}"></rect>`;
  const pa = `url(#${id}-pa)`;
  const pb = `url(#${id}-pb)`;
  const marble = mixAmt > 0.01;
  // No x/y on the patterns: the rects referencing them already sit inside a translated <g>, and userSpaceOnUse
  // resolves in that transformed space — an origin here shifted the tile a second time.
  let defs =
    `<pattern id="${id}-pa" patternUnits="userSpaceOnUse" width="${r1(a.w)}" height="${r1(a.h)}">` +
    `<image href="${safeSrc(srcA)}" width="${r1(a.w)}" height="${r1(a.h)}" preserveAspectRatio="xMidYMid slice"></image></pattern>` +
    `<pattern id="${id}-pb" patternUnits="userSpaceOnUse" width="${r1(b.w)}" height="${r1(b.h)}">` +
    `<image href="${safeSrc(srcB)}" width="${r1(b.w)}" height="${r1(b.h)}" preserveAspectRatio="xMidYMid slice"></image></pattern>` +
    // Goo on colour: blur mixes both images, contrast re-solidifies only alpha; colours come from a wider blur
    // clipped into that shape, so internal edges average away while the boundary stays liquid.
    `<filter id="${id}-goo" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">` +
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${blurEff}" result="b"></feGaussianBlur>` +
    `<feColorMatrix in="b" type="matrix" values="${goo}" result="goo"></feColorMatrix>` +
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${colorBlur}" result="bc"></feGaussianBlur>` +
    `<feComposite in="bc" in2="goo" operator="in" result="mix"></feComposite>` +
    `<feTurbulence type="fractalNoise" baseFrequency="${waveF}" numOctaves="2" seed="4" result="wn"></feTurbulence>` +
    `<feDisplacementMap in="mix" in2="wn" scale="${warpEff}" xChannelSelector="R" yChannelSelector="G" result="warped"></feDisplacementMap>` +
    // Solidify by self-compositing (premultiplied-safe), then restore the anti-aliased edge with a sub-pixel blur.
    `<feComposite in="warped" in2="warped" operator="over" result="s1"></feComposite>` +
    `<feComposite in="s1" in2="s1" operator="over" result="s2"></feComposite>` +
    `<feComposite in="s2" in2="s2" operator="over" result="solid"></feComposite>` +
    `<feGaussianBlur in="solid" stdDeviation="0.6"></feGaussianBlur></filter>` +
    `<filter id="${id}-soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${fade}"></feGaussianBlur></filter>`;
  // Marbling: nested large-scale displacements fold the molten colours into streaks, clipped to the goo silhouette.
  if (marble) {
    defs +=
      `<filter id="${id}-marble" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">` +
      `<feGaussianBlur in="SourceGraphic" stdDeviation="${mixBlur}" result="c"></feGaussianBlur>` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="2" seed="5" result="n1"></feTurbulence>` +
      `<feDisplacementMap in="c" in2="n1" scale="${r1(mixAmt * 90)}" xChannelSelector="R" yChannelSelector="G" result="d1"></feDisplacementMap>` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.019" numOctaves="2" seed="11" result="n2"></feTurbulence>` +
      `<feDisplacementMap in="d1" in2="n2" scale="${r1(mixAmt * 50)}" xChannelSelector="R" yChannelSelector="G" result="d2"></feDisplacementMap>` +
      `<feComposite in="d2" in2="d2" operator="over" result="m1"></feComposite>` +
      `<feComposite in="m1" in2="m1" operator="over" result="m2"></feComposite>` +
      `<feGaussianBlur in="m2" stdDeviation="0.6" result="marble"></feGaussianBlur>` +
      `<feGaussianBlur in="SourceGraphic" stdDeviation="${blurEff}" result="mb"></feGaussianBlur>` +
      `<feColorMatrix in="mb" type="matrix" values="${goo}" result="mg"></feColorMatrix>` +
      `<feTurbulence type="fractalNoise" baseFrequency="${waveF}" numOctaves="2" seed="4" result="mwn"></feTurbulence>` +
      `<feDisplacementMap in="mg" in2="mwn" scale="${warpEff}" xChannelSelector="R" yChannelSelector="G" result="mshape"></feDisplacementMap>` +
      `<feComposite in="marble" in2="mshape" operator="in"></feComposite></filter>` +
      `<mask id="${id}-marblemask" maskUnits="userSpaceOnUse" x="0" y="0" width="${r1(width)}" height="${r1(height)}">` +
      `<g filter="url(#${id}-soft)"><ellipse cx="${r1(seam.x)}" cy="${r1(seam.y)}" rx="${r1((rA + rB) / 2 + tanHalf)}" ry="${r1(((rA + rB) / 2) * gravity)}" transform="${rot}" fill="#fff"></ellipse></g></mask>`;
  }
  // Crisp faces: each is its plain card minus a blurred seam-spanning erase ellipse — apart, a card is exactly a card.
  const face = (key: string, g: CardGeom, tr: string, r: number) =>
    `<mask id="${id}-${key}" maskUnits="userSpaceOnUse" x="0" y="0" width="${r1(width)}" height="${r1(height)}">` +
    `<g filter="url(#${id}-edge)"><g transform="${tr}">${card(g, '#fff')}</g></g>` +
    `<g filter="url(#${id}-soft)"><ellipse cx="${r1(seam.x)}" cy="${r1(seam.y)}" rx="${r1(r + tanHalf)}" ry="${r1(r)}" transform="${rot}" fill="#000"></ellipse></g></mask>`;
  defs +=
    `<filter id="${id}-edge" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${edgeSoft}"></feGaussianBlur></filter>` +
    face('ma', a, gA, rB) +
    face('mb', b, gB, rA);
  const both = `<g transform="${gA}">${card(a, pa)}</g><g transform="${gB}">${card(b, pb)}</g>`;
  return (
    `<svg aria-hidden="true" focusable="false" data-gooey-imagemelt="" width="${r1(width)}" height="${r1(height)}" viewBox="0 0 ${r1(width)} ${r1(height)}">` +
    `<defs>${defs}</defs>` +
    // MOLTEN layer
    `<g class="molten" filter="url(#${id}-goo)">${both}</g>` +
    // MARBLE layer
    (marble ? `<g class="marble" mask="url(#${id}-marblemask)"><g filter="url(#${id}-marble)">${both}</g></g>` : '') +
    // CRISP layer
    `<g class="crisp-a" mask="url(#${id}-ma)"><g transform="${gA}">${card(a, pa)}</g></g>` +
    `<g class="crisp-b" mask="url(#${id}-mb)"><g transform="${gB}">${card(b, pb)}</g></g>` +
    '</svg>'
  );
}

let pairCounter = 0;

/**
 * The group's melt painter: watches the registry and, while two melt items exist, measures them and patches the
 * pair's svg into `host`. The loop runs while the rects or the eased proximity change and sleeps after half a second
 * of stillness; `wake()` (the group calls it on pointer, mutation and transition events) starts it again.
 */
export class MeltLayer {
  #raf = 0;
  #clean = 0;
  #last = 0;
  #key = '';
  #prox = 0;
  #target = 0;
  #active = true;
  #off: () => void;
  readonly uid = `lgm-${++pairCounter}`;

  constructor(
    private readonly registry: ImageMeltRegistry,
    private readonly getGroup: () => HTMLElement | null,
    private readonly host: HTMLElement,
    /** Reduced motion: the proximity snaps instead of easing in. */
    private readonly reduced: () => boolean = () => false,
  ) {
    this.#off = registry.subscribe(() => this.#changed());
  }

  /** True while the measuring loop is scheduled. */
  get running(): boolean {
    return this.#raf !== 0;
  }

  get pair(): ImageMeltEntry[] {
    return this.registry.entries().slice(0, 2);
  }

  #changed(): void {
    this.#key = '';
    if (this.pair.length < 2) {
      this.#stop();
      this.host.textContent = '';
      this.#prox = 0;
      return;
    }
    this.wake();
  }

  /** Park (false) or resume (true): off screen or a hidden tab runs no frames. */
  setActive(on: boolean): void {
    this.#active = on;
    if (!on) this.#stop();
    else this.wake();
  }

  wake = (): void => {
    this.#clean = 0;
    if (this.#raf || !this.#active || this.pair.length < 2) return;
    this.#last = 0;
    this.#raf = requestAnimationFrame(this.#tick);
  };

  #stop(): void {
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#raf = 0;
  }

  #tick = (now: number): void => {
    this.#raf = 0;
    const changed = this.measure(now);
    this.#clean = changed ? 0 : this.#clean + 1;
    if (this.#clean <= 30) this.#raf = requestAnimationFrame(this.#tick);
  };

  /** One frame: read both rects, ease the proximity, patch the svg when anything moved. True when it changed. */
  measure(now: number): boolean {
    const group = this.getGroup();
    const pair = this.pair;
    if (!group || pair.length < 2) return false;
    const a = readGeom(group, pair[0].el);
    const b = readGeom(group, pair[1].el);
    const opts = pair[0].opts;
    this.#target = meltProximity(a, b, opts.blur);
    const dt = this.#last ? (now - this.#last) / 1000 : 1 / 60;
    this.#last = now;
    const prox = this.reduced() ? this.#target : easeToward(this.#prox, this.#target, dt);
    const key = `${geomKey(a)}|${geomKey(b)}|${prox.toFixed(4)}|${group.offsetWidth}x${group.offsetHeight}`;
    if (key === this.#key) return false;
    this.#key = key;
    this.#prox = prox;
    morphInto(
      this.host,
      meltPairMarkup({
        a,
        b,
        srcA: pair[0].src,
        srcB: pair[1].src,
        opts,
        width: group.offsetWidth,
        height: group.offsetHeight,
        prox,
        uid: this.uid,
      }),
    );
    return true;
  }

  dispose(): void {
    this.#stop();
    this.#off();
    this.host.textContent = '';
  }
}
