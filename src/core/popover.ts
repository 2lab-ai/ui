/**
 * Shared placement for anchored overlays (`<ui-menu>`, `<ui-tooltip>`): the same rules as the model picker's menu
 * (`placeModelMenu`), with an alignment. The overlay is `position: fixed`, so no ancestor's overflow clip cuts it;
 * a fixed 100px probe inside the same shadow root maps viewport px into a transformed ancestor's coordinates.
 */
export type PopSide = 'top' | 'bottom';
export type PopAlign = 'start' | 'center' | 'end';

export interface PopRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PopPlace {
  left: number;
  top: number;
  side: PopSide;
  /** Height the overlay may take on its side before it scrolls. */
  maxHeight: number;
}

/** Below this much room a side is too short to scroll in: the overlay slides over the anchor instead. */
const MIN_ROOM = 120;

/**
 * Where an overlay of `w`×`h` goes (viewport px): under (`bottom`) or over (`top`) the anchor, flipped when that
 * side has no room and the other has more, aligned to the anchor's start / centre / end, kept `edge` px inside
 * the viewport. A side that is too short for the whole overlay gives it that side's height (`maxHeight`).
 */
export function placePopover(
  r: PopRect,
  w: number,
  h: number,
  vw: number,
  vh: number,
  side: PopSide = 'bottom',
  align: PopAlign = 'start',
  gap = 6,
  edge = 8,
): PopPlace {
  const below = vh - r.bottom - gap - edge;
  const above = r.top - gap - edge;
  const s: PopSide =
    side === 'top' ? (h > above && below > above ? 'bottom' : 'top') : h > below && above > below ? 'top' : 'bottom';
  const room = s === 'top' ? above : below;
  const full = Math.max(0, vh - 2 * edge);
  const fit = h > room && room >= MIN_ROOM ? room : Math.min(h, full);
  const x = align === 'end' ? r.right - w : align === 'center' ? (r.left + r.right) / 2 - w / 2 : r.left;
  const left = Math.max(edge, Math.min(x, vw - edge - w));
  let top = s === 'top' ? r.top - gap - fit : r.bottom + gap;
  top = Math.max(edge, Math.min(top, vh - edge - fit));
  return {
    left: Math.round(left),
    top: Math.round(top),
    side: s,
    maxHeight: Math.floor(h > room && room >= MIN_ROOM ? room : full),
  };
}

/** `placement="bottom-start"` → side + align (unknown values fall back to the defaults). */
export function parsePlacement(
  value: string | null,
  fallback: { side: PopSide; align: PopAlign },
): { side: PopSide; align: PopAlign } {
  const [s, a] = String(value ?? '').split('-');
  const side: PopSide = s === 'top' || s === 'bottom' ? s : fallback.side;
  const align: PopAlign = a === 'start' || a === 'center' || a === 'end' ? a : fallback.align;
  return { side, align };
}

/**
 * Position `pop` (fixed) from `anchor`'s rect. `probe` is a fixed 100px-wide box at 0,0 in the same containing
 * block: its rect gives the block's origin and scale when a transformed ancestor captures fixed elements.
 * Returns the placement, or null when the anchor is not laid out or is off-screen.
 */
export function positionFixed(
  anchor: Element,
  pop: HTMLElement,
  probe: Element | null,
  side: PopSide,
  align: PopAlign,
  gap = 6,
): PopPlace | null {
  const r = anchor.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const vh = window.innerHeight;
  if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return null;
  const o = probe?.getBoundingClientRect();
  const k = o && o.width > 0 ? o.width / 100 : 1;
  const ox = o?.left ?? 0;
  const oy = o?.top ?? 0;
  const p = placePopover(r, pop.offsetWidth * k, pop.scrollHeight * k, vw, vh, side, align, gap);
  const out: PopPlace = {
    left: Math.round((p.left - ox) / k),
    top: Math.round((p.top - oy) / k),
    side: p.side,
    maxHeight: Math.floor(p.maxHeight / k),
  };
  pop.style.left = `${out.left}px`;
  pop.style.top = `${out.top}px`;
  pop.style.maxHeight = `${out.maxHeight}px`;
  pop.setAttribute('data-side', out.side);
  pop.setAttribute('data-align', align);
  return out;
}

/**
 * While an overlay is open: re-place it on scroll (any scroller, capture) and resize, and every `ms` for scrolls
 * the document never hears of (inside another shadow root). Returns the disposer.
 */
export function watchViewport(onChange: () => void, ms = 150): () => void {
  let raf = 0;
  const queue = (): void => {
    if (raf || typeof requestAnimationFrame !== 'function') return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      onChange();
    });
  };
  document.addEventListener('scroll', queue, { capture: true, passive: true });
  window.addEventListener('resize', queue);
  const timer = window.setInterval(onChange, ms);
  return () => {
    document.removeEventListener('scroll', queue, { capture: true });
    window.removeEventListener('resize', queue);
    clearInterval(timer);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
}

/** The deepest focused element, through open shadow roots. */
export function deepActive(): Element | null {
  let a: Element | null = document.activeElement;
  while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
  return a;
}
