/**
 * How a gallery tile frames its demo — the way a product shot is framed (Stageshow's framing rules), not a
 * screenshot pasted onto a plate. The demo shrink-wraps (at most `THUMB_W` wide), then scales to fill the tile:
 *
 * - never above 1:1, so its type stays at its real size;
 * - never below `THUMB_MIN` (13px text stays about 8px or more — a fixed 0.56 drew 7px type);
 * - what fits whole sits centred in the tile, as large as it can be;
 * - what does not fit keeps its top edge (and its left edge when it is wider than the tile) and runs off the
 *   bottom (and right) — cropped with intent, not shrunk into a strip under an empty band;
 * - wide but short (a bar, a strip): centred in the height, cropped on the right only.
 */

/** The width a demo lays out at before it is scaled (wide screens use all of it, small parts shrink-wrap). */
export const THUMB_W = 560;
/**
 * A shrink-wrapped demo narrower than this, and much taller than wide, has collapsed (it sizes to its container,
 * which has no width of its own, so its text stacks a word per line) — it lays out at `THUMB_CARD_W`, a card's
 * width, instead. A small part that is simply small (a trigger button) is wider than tall and keeps its size.
 */
export const THUMB_COLLAPSED = 160;
export const THUMB_CARD_W = 420;

/** True when a shrink-wrapped box of this size is a collapsed container part rather than a small one. */
export function looksCollapsed(box: Box): boolean {
  const w = Number.isFinite(box.w) ? box.w : 0;
  const h = Number.isFinite(box.h) ? box.h : 0;
  return w < THUMB_COLLAPSED && h > Math.max(w, 1) * 2;
}
/** The smallest scale: below it the type is too small to read. */
export const THUMB_MIN = 0.62;
/** The inset a demo keeps from the tile's edges it does not run off. */
export const THUMB_PAD = 18;

export interface Box {
  w: number;
  h: number;
}

export interface ThumbFrame {
  /** Scale applied to the demo (transform-origin: top left). */
  scale: number;
  /** Left and top of the scaled demo inside the tile, in px. */
  x: number;
  y: number;
  /** True when the demo runs off the tile's bottom or right edge. */
  cropped: boolean;
}

/** The frame for `content` (its unscaled size) inside `tile`. Degenerate sizes give a 1:1 frame at the inset. */
export function thumbFit(tile: Box, content: Box): ThumbFrame {
  const n = (v: number, min: number) => (Number.isFinite(v) ? Math.max(min, v) : min);
  const tw = n(tile.w, 0);
  const th = n(tile.h, 0);
  const cw = n(content.w, 1);
  const ch = n(content.h, 1);
  if (tw <= THUMB_PAD * 2 || th <= THUMB_PAD * 2) return { scale: 1, x: THUMB_PAD, y: THUMB_PAD, cropped: true };
  const room = { w: tw - THUMB_PAD * 2, h: th - THUMB_PAD * 2 };
  const whole = Math.min(1, room.w / cw, room.h / ch);
  if (whole >= THUMB_MIN) {
    // It fits whole at a readable size: centred, as large as the tile allows (never past 1:1).
    return { scale: whole, x: (tw - cw * whole) / 2, y: (th - ch * whole) / 2, cropped: false };
  }
  // Too tall or too wide to fit whole: fill the width (readable), keep the top, crop the rest.
  const scale = Math.max(THUMB_MIN, Math.min(1, room.w / cw));
  const sw = cw * scale;
  const sh = ch * scale;
  const x = sw <= room.w ? (tw - sw) / 2 : THUMB_PAD;
  // Wide but short (a bar, a strip): it runs off the right edge only, so it sits centred in the height — not a
  // strip at the top of an empty tile.
  const y = sh <= room.h ? (th - sh) / 2 : THUMB_PAD;
  return { scale, x, y, cropped: true };
}
