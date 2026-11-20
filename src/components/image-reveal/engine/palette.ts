/**
 * Image-palette sampling for the regenerate churn — img-fx 0.5.2 `src/engine/palette.ts` (MIT, © 2026 Jakub
 * Antalik), verbatim but for the source type (any drawable with a size: the picture itself, not only a canvas).
 *
 * The source is averaged down to a 24 × 24 grid, its pixels sorted by luminance, and each of the preset's seven
 * palette slots takes the image colour at the same luminance RANK the slot has inside the preset palette: the effect
 * keeps its authored contrast structure but wears the picture's colours.
 */
import { parseCssColor } from './presets';

export interface SampledPalette {
  /** One CSS hex colour per shader palette slot. */
  colors: string[];
  /** Average image colour — the card surface behind the churn. */
  cardBg: string;
}

const lum = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b;
const hex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Downsample grid edge: 576 samples is plenty for a 7-colour palette. */
const GRID = 24;

let scratchCtx: CanvasRenderingContext2D | null = null;

function getScratchCtx(): CanvasRenderingContext2D | null {
  if (scratchCtx) return scratchCtx;
  if (typeof document === 'undefined') return null;
  try {
    const scratch = document.createElement('canvas');
    scratch.width = GRID;
    scratch.height = GRID;
    scratchCtx = scratch.getContext('2d', { willReadFrequently: true });
  } catch {
    scratchCtx = null;
  }
  return scratchCtx;
}

/** The size of a drawable (an image's natural size first). */
function sizeOf(src: CanvasImageSource): { w: number; h: number } {
  const img = src as HTMLImageElement;
  const w = Number(img.naturalWidth || (src as { width?: number }).width || 0);
  const h = Number(img.naturalHeight || (src as { height?: number }).height || 0);
  return { w, h };
}

/**
 * A recolour for the running effect, sampled from `src`, mapped onto `presetColors` (the active preset mode's seven
 * slots) by luminance rank. Null when sampling is not possible: no DOM, an empty source, a tainted canvas
 * (cross-origin picture without CORS), or nothing opaque in it.
 */
export function samplePaletteFromCanvas(
  src: CanvasImageSource,
  presetColors: readonly string[],
): SampledPalette | null {
  const { w, h } = sizeOf(src);
  if (!(w > 0 && h > 0)) return null;
  const ctx = getScratchCtx();
  if (!ctx) return null;
  let data: Uint8ClampedArray;
  try {
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, GRID, GRID);
    ctx.drawImage(src, 0, 0, GRID, GRID);
    data = ctx.getImageData(0, 0, GRID, GRID).data;
  } catch {
    return null;
  }

  const px: Array<{ r: number; g: number; b: number; lum: number }> = [];
  let ar = 0;
  let ag = 0;
  let ab = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue; // skip fully transparent corners
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    px.push({ r, g, b, lum: lum(r, g, b) });
    ar += r;
    ag += g;
    ab += b;
  }
  if (px.length === 0) return null;
  px.sort((a, b) => a.lum - b.lum);
  const cardBg = hex(ar / px.length, ag / px.length, ab / px.length);

  // Preset slots ranked by luminance → image luminance quantile per rank (5th … 95th percentile).
  const ranked = presetColors
    .map((color, slot) => {
      const [r, g, b] = parseCssColor(color);
      return { slot, lum: lum(r, g, b) };
    })
    .sort((a, b) => a.lum - b.lum);
  const colors: string[] = new Array(ranked.length);
  for (let rank = 0; rank < ranked.length; rank++) {
    const q = 0.05 + (0.9 * rank) / Math.max(1, ranked.length - 1);
    const p = px[Math.min(px.length - 1, Math.round(q * (px.length - 1)))];
    colors[ranked[rank].slot] = hex(p.r, p.g, p.b);
  }
  return { colors, cardBg };
}
