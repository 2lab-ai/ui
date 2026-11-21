import type { ImageMeltRegistry } from './engine/image-melt';
import type { ObserveEngine } from './engine/observer';

/** What a `<ui-gooey>` hands its items (liquid-gooey's React context). Internal: reached through the `GOOEY` symbol. */
export interface GooeyContext {
  /** The silhouette layer's `<g>` (goo filter + shadows): one blob per item lives here. */
  portal: SVGGElement;
  /** The melt overlay's `<g>`, above the content and masked to the liquid: dissolve copies live here. */
  meltPortal: SVGGElement;
  /** The group element (the coordinate space every blob is drawn in). */
  getGroup: () => HTMLElement | null;
  engine: ObserveEngine;
  imageMelt: ImageMeltRegistry;
  /** True when motion is reduced (the `motion` attribute, or the system setting under `motion="system"`). */
  reduced: () => boolean;
}

/** The group's internal hook for its items — a symbol, so it is not part of the element's public surface. */
export const GOOEY = Symbol('ui-gooey-context');

export interface GooeyHost extends HTMLElement {
  [GOOEY](): GooeyContext | null;
}

export function isGooeyHost(el: Element | null): el is GooeyHost {
  return !!el && typeof (el as Partial<GooeyHost>)[GOOEY] === 'function';
}
