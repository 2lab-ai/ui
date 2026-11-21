/* Ported from metal-fx 2.0.11 `src/engine/textMask.ts` (MIT, © Jakub Antalik — https://libraries.dev/metal).
   Changed in the port: the font may come from another element than the text (`styleEl` — a shadow wrapper around a
   slot, whose computed style the slotted text inherits), the run is whitespace-collapsed like the DOM draws it, and a
   transform's scale on the way to the root is undone (the canvas is in layout px). */

/** The text a run draws: whitespace collapsed and trimmed, as `white-space: nowrap` lays it out. */
export function textRun(el: Node): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Paint an element's text run onto a canvas with the DOM's own font and metrics, so canvas glyphs land on the DOM
 * glyphs to within a device px. Shared by metal text's fill and the text reflection mask.
 *
 * `ctx` is expected in device px with origin at `root`'s top-left; the function scales by `dpr` internally.
 */
export function paintTextRun(
  ctx: CanvasRenderingContext2D,
  root: HTMLElement,
  textEl: HTMLElement,
  dpr: number,
  styleEl: Element = textEl,
): void {
  const text = textRun(textEl);
  if (!text) return;
  const cs = getComputedStyle(styleEl);
  const rr = root.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(textEl);
  const tr = range.getBoundingClientRect();
  range.detach();
  ctx.save();
  try {
    ctx.scale(dpr, dpr);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(text);
    const asc = m.fontBoundingBoxAscent ?? Number.parseFloat(cs.fontSize) * 0.9;
    const desc = m.fontBoundingBoxDescent ?? Number.parseFloat(cs.fontSize) * 0.2;
    // Rects are visual (after transforms); the canvas is in layout px — undo a transform's scale.
    const k = root.offsetWidth > 0 && rr.width > 0 ? rr.width / root.offsetWidth : 1;
    const x = (tr.left - rr.left) / k;
    const baseline = (tr.top - rr.top + (tr.height - k * (asc + desc)) / 2) / k + asc;
    ctx.fillText(text, x, baseline);
  } finally {
    ctx.restore();
  }
}

/** An element's layout size (transforms left out), or its bounding rect where there is no layout size. */
export function layoutBox(el: HTMLElement): { width: number; height: number } {
  if (el.offsetWidth > 0 && el.offsetHeight > 0) return { width: el.offsetWidth, height: el.offsetHeight };
  const r = el.getBoundingClientRect();
  return { width: r.width, height: r.height };
}

/** Render `textEl`'s glyphs white-on-transparent over `root`'s box → data URL (null without a 2D context). */
export function textMaskDataUrl(root: HTMLElement, textEl: HTMLElement): string | null {
  const dpr = window.devicePixelRatio || 1;
  const box = layoutBox(root);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(box.width * dpr));
  c.height = Math.max(1, Math.round(box.height * dpr));
  let g: CanvasRenderingContext2D | null = null;
  try {
    g = c.getContext('2d');
  } catch {
    g = null;
  }
  if (!g) return null;
  g.fillStyle = '#fff';
  paintTextRun(g, root, textEl, dpr);
  try {
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}
