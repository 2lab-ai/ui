/**
 * Per-instance reveal pipeline of img-fx 0.5.2 (`src/engine/reveal.ts`, MIT, © 2026 Jakub Antalik — a port of its
 * `image.html` `drawMaskedImage` / `getMaskValue`). The overlay canvas over the shader canvas fills with the picture
 * through a mask sampled from the live shader field, the pixel-cell dissolve turns chunky cells smooth, and the
 * shader canvas fades out over the same duration. The boil ("regenerate") breaks a held picture back into the cell
 * grid and churns it until the next picture dissolves in over it.
 *
 * The maths are the library's. What changed in the port: the uniform block is plain fields (`s.uniforms.u_dotMode`
 * for three's `.value`); the dot-mode branches (unreachable — no bundled preset draws dots) are left out; the cover
 * crop takes no edge inset, so the final `<img>` (object-fit: cover) lands on the overlay's last frame pixel for
 * pixel; the image cache is bounded; `startHold` puts a picture straight into the held phase (the element brings
 * the effect back for a picture it already shows); a missing 2D context returns null instead of throwing.
 */
import type { EasingKey, MaskShape, PresetMode } from './presets';
import { parseCssColor } from './presets';
import {
  drawShader,
  effectiveCardBg,
  effectiveCellSize,
  effectivePaletteColor,
  type Instance,
  REF_DIM,
  type SharedRenderer,
} from './renderer';
import { ease } from './tween';

/** Side length of the square buffer the reveal mask is evaluated in (and the live shader field sampled into). */
export const MASK_SIZE = 64;

/** Source rect for a cover-fit draw of a `w × h` image into `targetW × targetH` (CSS object-fit: cover). */
export function computeCoverSourceRect(
  img: { width: number; height: number },
  targetW: number,
  targetH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const targetAspect = targetW / Math.max(1, targetH);
  const imgAspect = img.width / Math.max(1, img.height);
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (imgAspect > targetAspect) {
    // Image is wider than target — crop left/right.
    sw = img.height * targetAspect;
    sx = (img.width - sw) / 2;
  } else {
    // Image is taller than target — crop top/bottom.
    sh = img.width / targetAspect;
    sy = (img.height - sh) / 2;
  }
  return { sx, sy, sw, sh };
}

/** Decoded images by URL, newest last; the oldest is dropped past IMAGE_CACHE_MAX. */
const IMAGE_CACHE = new Map<string, Promise<HTMLImageElement>>();
const IMAGE_CACHE_MAX = 24;

/**
 * Load (and cache) an image; resolves once it is decoded. No `crossOrigin` (as the library): a same-origin, blob: or
 * data: picture draws into a canvas without tainting it; a cross-origin one still reveals, only the regenerate tint
 * cannot sample it.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  const have = IMAGE_CACHE.get(src);
  if (have) {
    IMAGE_CACHE.delete(src);
    IMAGE_CACHE.set(src, have);
    return have;
  }
  const entry = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const done = (): void => resolve(img);
    img.onerror = (e) => {
      IMAGE_CACHE.delete(src);
      reject(e);
    };
    // Prefer `decode()`: it resolves once the bitmap is decoded off the main thread, so the first draw does not hitch.
    if (typeof img.decode === 'function') {
      img.src = src;
      img.decode().then(done, () => {
        // decode() can reject for reasons other than a load failure; a real failure still rejects via onerror.
        if (img.complete && img.naturalWidth > 0) done();
        else img.onload = done;
      });
    } else {
      img.onload = done;
      img.src = src;
    }
  });
  IMAGE_CACHE.set(src, entry);
  while (IMAGE_CACHE.size > IMAGE_CACHE_MAX) {
    const oldest = IMAGE_CACHE.keys().next().value;
    if (oldest === undefined) break;
    IMAGE_CACHE.delete(oldest);
  }
  return entry;
}

export interface RevealStartOptions {
  image: HTMLImageElement;
  cssWidth: number;
  cssHeight: number;
  onRevealComplete?: () => void;
}

export type RevealPhase = 'idle' | 'reveal' | 'hold' | 'hide' | 'boil';

export interface RevealState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Per-frame hook after the shader frame: paint the mask, hold, boil or fade. */
  afterShaderFrame: (s: SharedRenderer, inst: Instance, nowMs: number) => void;
  startReveal: (opts: RevealStartOptions) => void;
  startHide: (durationMs?: number) => void;
  /** Dissolve the held / revealing picture into the "generating" churn. No-op otherwise. */
  startBoil: () => void;
  /** Hold `image` fully shown (shader hidden), as a finished reveal would. */
  startHold: (image: HTMLImageElement) => void;
  clear: () => void;
  isActive: () => boolean;
  phase: () => RevealPhase;
  dispose: () => void;
}

interface CoverBitmap {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  img: HTMLImageElement | null;
  w: number;
  h: number;
}

interface RevealInternals {
  active: boolean;
  phase: RevealPhase;
  revealStartMs: number;
  hideStartMs: number;
  hideDurationMs: number;
  boilStartMs: number;
  boilPattern: Float32Array | null;
  boilPatternW: number;
  boilPatternH: number;
  boilField: Float32Array | null;
  boilHandoffStartMs: number;
  pendingReveal: RevealStartOptions | null;
  image: HTMLImageElement | null;
  onRevealComplete?: () => void;
  cssWidth: number;
  cssHeight: number;
  sampleCanvas: HTMLCanvasElement | null;
  sampleCtx: CanvasRenderingContext2D | null;
  sampleImgData: ImageData | null;
  sampleDataCache: Uint8ClampedArray | null;
  sampleFrameCounter: number;
  maskGrad: HTMLCanvasElement | null;
  maskGradCtx: CanvasRenderingContext2D | null;
  maskImgData: ImageData | null;
  gsFlickerTable: Float32Array | null;
  pixCanvas: HTMLCanvasElement | null;
  pixCtx: CanvasRenderingContext2D | null;
  pixDrop: HTMLCanvasElement | null;
  pixDropCtx: CanvasRenderingContext2D | null;
  pixDropImgData: ImageData | null;
  pixDropPattern: Float32Array | null;
  pixDropPatternW: number;
  pixDropPatternH: number;
  pixDropRevealStart: number;
  coverA: CoverBitmap | null;
  coverB: CoverBitmap | null;
  holdPaintedImg: HTMLImageElement | null;
  holdPaintedW: number;
  holdPaintedH: number;
  sampleGpuCanvas: HTMLCanvasElement | null;
  sampleGpuCtx: CanvasRenderingContext2D | null;
}

function ctx2d(c: HTMLCanvasElement, opts?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', opts);
  if (!ctx) throw new Error('image-reveal: 2D context unavailable');
  return ctx;
}

/** `img` cover-fitted into a `w × h` canvas, resampled only when the image or the size changed for that slot. */
function getCoverBitmap(state: RevealInternals, slot: 'a' | 'b', img: HTMLImageElement, w: number, h: number) {
  let cb = slot === 'a' ? state.coverA : state.coverB;
  if (!cb) {
    const canvas = document.createElement('canvas');
    cb = { canvas, ctx: ctx2d(canvas), img: null, w: 0, h: 0 };
    if (slot === 'a') state.coverA = cb;
    else state.coverB = cb;
  }
  if (cb.img !== img || cb.w !== w || cb.h !== h) {
    cb.canvas.width = w;
    cb.canvas.height = h;
    cb.w = w;
    cb.h = h;
    cb.img = img;
    const { sx, sy, sw, sh } = computeCoverSourceRect(img, w, h);
    cb.ctx.clearRect(0, 0, w, h);
    cb.ctx.imageSmoothingEnabled = true;
    cb.ctx.imageSmoothingQuality = 'high';
    cb.ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  }
  return cb.canvas;
}

function getActiveRevealTiming(p: PresetMode): { duration: number; easingKey: EasingKey } {
  return { duration: Math.max(0.05, p.revealConfig.duration), easingKey: p.revealConfig.easing };
}

/** The geometric masks' value at row `r`, column `c` of a `size` grid (−1 for the shader-driven shapes). */
export function getMaskValue(shape: MaskShape, r: number, c: number, size: number): number {
  const nx = c / (size - 1);
  const ny = r / (size - 1);
  const cx = nx - 0.5;
  const cy = ny - 0.5;
  switch (shape) {
    case 'radialCenter':
      return 1 - Math.sqrt(cx * cx + cy * cy) * 2;
    case 'radialCorner':
      // biome-ignore lint/suspicious/noApproximativeNumericConstant: the library's constant, kept verbatim.
      return 1 - Math.sqrt(nx * nx + ny * ny) / 1.414;
    case 'linearTop':
      return 1 - ny;
    case 'linearBottom':
      return ny;
    case 'linearLeft':
      return 1 - nx;
    case 'linearRight':
      return nx;
    case 'diagonalTL':
      return 1 - (nx + ny) / 2;
    case 'diagonalBR':
      return (nx + ny) / 2;
    case 'diamond':
      return 1 - (Math.abs(cx) + Math.abs(cy));
    case 'blindsH':
      return 1 - ((ny * 8) % 1);
    case 'blindsV':
      return 1 - ((nx * 8) % 1);
    default:
      return -1;
  }
}

/** Cells along x / y of the reveal dissolve for a `cssW × cssH` card — the shader's `gridCounts`, so they line up. */
export function revealGrid(cellSize: number, cssW: number, cssH: number): { gridX: number; gridY: number } {
  const baseCount = 6 + cellSize * 74;
  return {
    gridX: Math.max(2, Math.floor((baseCount * Math.max(1, cssW)) / REF_DIM)),
    gridY: Math.max(2, Math.floor((baseCount * Math.max(1, cssH)) / REF_DIM)),
  };
}

/** The library's flicker hash: a cell index and a clock step → [0, 1). */
export function flickerHash(i: number, s: number): number {
  const x = Math.sin(i * 127.1 + s * 17.23) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Sample the current shader frame into a maskSize² RGBA buffer for the reveal mask. Pixel presets sample the RAW
 * smooth field (u_dotMode = 0, no fill), so the reveal silhouette never inherits the cells; the uniforms are put back.
 */
function sampleShaderField(
  state: RevealInternals,
  s: SharedRenderer,
  inst: Instance,
  scratchCtx: CanvasRenderingContext2D,
  maskSize: number,
): Uint8ClampedArray {
  const origDotMode = s.uniforms.u_dotMode;
  const origFillOpacity = s.uniforms.u_fillOpacity;
  s.uniforms.u_dotMode = 0;
  s.uniforms.u_fillOpacity = 0;
  drawShader(s);

  const iw = Math.max(1, Math.floor(inst.cssWidth * inst.dpr));
  const ih = Math.max(1, Math.floor(inst.cssHeight * inst.dpr));
  const sy = Math.max(0, s.glCanvas.height - ih);
  // Two-stage copy: GL → small GPU-backed canvas, then that maskSize² canvas → the CPU-side scratch, so only the tiny
  // intermediate is read back.
  if (!state.sampleGpuCanvas) {
    state.sampleGpuCanvas = document.createElement('canvas');
    state.sampleGpuCtx = ctx2d(state.sampleGpuCanvas);
  }
  const gpuCanvas = state.sampleGpuCanvas;
  const gpuCtx = state.sampleGpuCtx as CanvasRenderingContext2D;
  if (gpuCanvas.width !== maskSize || gpuCanvas.height !== maskSize) {
    gpuCanvas.width = maskSize;
    gpuCanvas.height = maskSize;
  }
  gpuCtx.clearRect(0, 0, maskSize, maskSize);
  gpuCtx.drawImage(s.glCanvas, 0, sy, iw, ih, 0, 0, maskSize, maskSize);
  scratchCtx.clearRect(0, 0, maskSize, maskSize);
  scratchCtx.drawImage(gpuCanvas, 0, 0);
  s.uniforms.u_dotMode = origDotMode;
  s.uniforms.u_fillOpacity = origFillOpacity;
  state.sampleImgData = scratchCtx.getImageData(0, 0, maskSize, maskSize);
  state.sampleDataCache = state.sampleImgData.data;
  return state.sampleDataCache;
}

function ensureScratch(state: RevealInternals, maskSize: number): void {
  if (!state.sampleCanvas) {
    state.sampleCanvas = document.createElement('canvas');
    state.sampleCtx = ctx2d(state.sampleCanvas, { willReadFrequently: true });
  }
  if (state.sampleCanvas.width !== maskSize || state.sampleCanvas.height !== maskSize) {
    state.sampleCanvas.width = maskSize;
    state.sampleCanvas.height = maskSize;
    state.sampleImgData = null;
    state.sampleDataCache = null;
    state.sampleFrameCounter = 0;
  }
  if (!state.maskGrad) {
    state.maskGrad = document.createElement('canvas');
    state.maskGradCtx = ctx2d(state.maskGrad);
  }
  if (state.maskGrad.width !== maskSize || state.maskGrad.height !== maskSize) {
    state.maskGrad.width = maskSize;
    state.maskGrad.height = maskSize;
    state.maskImgData = null;
  }
  if (!state.maskImgData && state.maskGradCtx) {
    state.maskImgData = state.maskGradCtx.createImageData(maskSize, maskSize);
  }
}

function ensurePixScratch(state: RevealInternals, gridX: number, gridY: number): void {
  if (!state.pixCanvas) {
    state.pixCanvas = document.createElement('canvas');
    state.pixCtx = ctx2d(state.pixCanvas);
  }
  if (state.pixCanvas.width !== gridX || state.pixCanvas.height !== gridY) {
    state.pixCanvas.width = gridX;
    state.pixCanvas.height = gridY;
  }
  if (!state.pixDrop) {
    state.pixDrop = document.createElement('canvas');
    state.pixDropCtx = ctx2d(state.pixDrop);
  }
  if (state.pixDrop.width !== gridX || state.pixDrop.height !== gridY || !state.pixDropImgData) {
    state.pixDrop.width = gridX;
    state.pixDrop.height = gridY;
    state.pixDropImgData = (state.pixDropCtx as CanvasRenderingContext2D).createImageData(gridX, gridY);
    const dd0 = state.pixDropImgData.data;
    for (let i = 0; i < dd0.length; i += 4) {
      dd0[i] = 255;
      dd0[i + 1] = 255;
      dd0[i + 2] = 255;
    }
  }
}

function paintMaskedFrame(state: RevealInternals, s: SharedRenderer, inst: Instance, ctx: CanvasRenderingContext2D) {
  if (!state.image) return;
  const preset = inst.preset;
  const targetW = inst.canvas.width;
  const targetH = inst.canvas.height;
  if (ctx.canvas.width !== targetW || ctx.canvas.height !== targetH) {
    ctx.canvas.width = targetW;
    ctx.canvas.height = targetH;
  }
  ctx.clearRect(0, 0, targetW, targetH);

  const { duration, easingKey } = getActiveRevealTiming(preset);
  const elapsed = (performance.now() - state.revealStartMs) / 1000;
  const progress = Math.min(elapsed / duration, 1);
  const eased = ease(easingKey, progress);
  const img = state.image;

  // CSS blur fade
  const maxBlur = preset.revealConfig.blur;
  if (progress < 1 && maxBlur > 0) {
    const b = maxBlur * (1 - eased);
    ctx.canvas.style.filter = b > 0.1 ? `blur(${b.toFixed(1)}px)` : 'none';
  } else {
    ctx.canvas.style.filter = 'none';
  }

  if (progress >= 1) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(getCoverBitmap(state, 'a', img, targetW, targetH), 0, 0);
    return;
  }

  const maskSize = MASK_SIZE;
  ensureScratch(state, maskSize);
  const sampleCtx = state.sampleCtx as CanvasRenderingContext2D;
  const maskGrad = state.maskGrad as HTMLCanvasElement;
  const maskGradCtx = state.maskGradCtx as CanvasRenderingContext2D;

  const maskShape = preset.revealConfig.maskShape;
  const softBand = preset.revealConfig.softness;
  const useShader = maskShape.startsWith('shader');

  let sampleData: Uint8ClampedArray | null = null;
  let targetColor: [number, number, number] | null = null;
  let highlightColors: Array<[number, number, number]> | null = null;

  if (useShader) {
    // Re-sample the shader every 2nd reveal frame: the field drifts slowly and the soft band absorbs the staleness.
    const counter = state.sampleFrameCounter++;
    const shouldSample = state.sampleDataCache == null || (counter & 1) === 0;
    sampleData = shouldSample ? sampleShaderField(state, s, inst, sampleCtx, maskSize) : state.sampleDataCache;
    const colorMap: Record<string, number> = {
      shaderColor1: 0,
      shaderColor2: 1,
      shaderColor3: 2,
      shaderColor4: 3,
      shaderColor5: 4,
    };
    if (colorMap[maskShape] != null) {
      targetColor = effectivePaletteColor(inst, colorMap[maskShape]);
    }
    if (maskShape === 'shaderHighlight') {
      const bg = parseCssColor(effectiveCardBg(inst));
      highlightColors = [];
      for (let i = 0; i < 5; i++) {
        const c = effectivePaletteColor(inst, i);
        const dr = c[0] - bg[0];
        const dg = c[1] - bg[1];
        const db = c[2] - bg[2];
        if (Math.sqrt(dr * dr + dg * dg + db * db) > 0.15) highlightColors.push(c);
      }
      if (highlightColors.length === 0) highlightColors = [effectivePaletteColor(inst, 0)];
    }
  }

  const threshold = 1 - eased * (1 + softBand);
  const isGradientSweep = maskShape === 'gradientSweep';
  let gsW = 0;
  let gsPos = 0;
  let gsGrid = 2;
  // Per-cell flicker on the mask's transition edge: cells mid-transition pop in and out with the shader's flicker
  // clock/hash, so the image materialises cell by cell. Driven by `preset.flicker`.
  const gsAmp = preset.flicker ?? 0;
  let gsTable: Float32Array | null = null;
  let gsHashFn: ((i: number, s: number) => number) | null = null;
  let gsStep = 0;
  let gsStep1 = 0;
  let gsFz = 0;
  if (gsAmp > 0.003) {
    gsGrid = Math.max(2, Math.floor(6 + effectiveCellSize(preset.pixelConfig.cellSize, inst.pixelScale) * 74));
    // Clamp the flicker clock to at least the sweep preset's cadence so slow presets still re-roll fast enough.
    const gsT = inst.accumulatedTime * Math.max(preset.speed, 2) * 1.6;
    const rawStep = Math.floor(gsT);
    gsStep = rawStep % 1024;
    gsStep1 = (gsStep + 1) % 1024;
    gsFz = gsT - rawStep;
    gsFz = gsFz * gsFz * (3 - 2 * gsFz);
    gsHashFn = flickerHash;
    const cellCount = gsGrid * gsGrid;
    if (!state.gsFlickerTable || state.gsFlickerTable.length !== cellCount) {
      state.gsFlickerTable = new Float32Array(cellCount);
    }
    gsTable = state.gsFlickerTable;
    for (let i = 0; i < cellCount; i++) {
      const rnd = flickerHash(i, gsStep) * (1 - gsFz) + flickerHash(i, gsStep1) * gsFz;
      gsTable[i] = (rnd - 0.5) * gsAmp * 1.6;
    }
  }
  if (isGradientSweep) {
    gsW = 0.9 / Math.max(preset.scale, 0.25);
    gsPos = -gsW + eased * (1 + 2 * gsW);
  }

  const maskImgData = state.maskImgData as ImageData;
  const md = maskImgData.data;
  for (let r = 0; r < maskSize; r++) {
    for (let c = 0; c < maskSize; c++) {
      let val: number;
      if (useShader && sampleData) {
        const i = (r * maskSize + c) * 4;
        const pr = sampleData[i] / 255;
        const pg = sampleData[i + 1] / 255;
        const pb = sampleData[i + 2] / 255;
        if (highlightColors) {
          let maxProx = 0;
          for (const hc of highlightColors) {
            const dr = pr - hc[0];
            const dg = pg - hc[1];
            const db = pb - hc[2];
            const prox = Math.exp(-10 * (dr * dr + dg * dg + db * db));
            if (prox > maxProx) maxProx = prox;
          }
          val = maxProx;
        } else if (targetColor) {
          const dr = pr - targetColor[0];
          const dg = pg - targetColor[1];
          const db = pb - targetColor[2];
          val = Math.exp(-8 * (dr * dr + dg * dg + db * db));
        } else {
          val = (sampleData[i] * 0.299 + sampleData[i + 1] * 0.587 + sampleData[i + 2] * 0.114) / 255;
        }
      } else if (!isGradientSweep) {
        val = getMaskValue(maskShape, r, c, maskSize);
      } else {
        val = 0;
      }
      let a: number;
      if (isGradientSweep) {
        const nx = c / (maskSize - 1);
        const ny = r / (maskSize - 1);
        const dd = (nx + ny) * 0.5;
        a = (gsPos + gsW - dd) / (2 * gsW);
      } else {
        a = (val - threshold) / softBand;
      }
      if (gsTable && a > -0.5 && a < 1.5) {
        // Edge-localised jitter: strongest mid-transition, zero where fully hidden or revealed.
        const at = Math.min(1, Math.max(0, a));
        const edge = at * (1 - at) * 4;
        if (edge > 0.001) {
          const nx = c / (maskSize - 1);
          const ny = r / (maskSize - 1);
          const ci = Math.floor(ny * gsGrid) * gsGrid + Math.floor(nx * gsGrid);
          a += gsTable[ci] * edge;
        }
      }
      if (a < 0) a = 0;
      else if (a > 1) a = 1;
      a = a * a * (3 - 2 * a);
      const idx = (r * maskSize + c) * 4;
      md[idx] = 255;
      md[idx + 1] = 255;
      md[idx + 2] = 255;
      md[idx + 3] = (a * 255 + 0.5) | 0;
    }
  }
  maskGradCtx.putImageData(maskImgData, 0, 0);

  if (preset.dotMode === 1) {
    paintPixelMasked(
      state,
      ctx,
      img,
      preset,
      elapsed,
      targetW,
      targetH,
      inst,
      // The gradientSweep mask already flickers along its band edge; skip the dissolve flicker there.
      isGradientSweep ? 0 : gsAmp,
      gsHashFn,
      gsStep,
      gsStep1,
      gsFz,
    );
  } else {
    // A raw (non-mosaic) preset keeps the smooth photo for the revealed region.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(getCoverBitmap(state, 'a', img, targetW, targetH), 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskGrad, 0, 0, targetW, targetH);
    ctx.globalCompositeOperation = 'source-over';
  }
}

function paintPixelMasked(
  state: RevealInternals,
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  preset: PresetMode,
  elapsed: number,
  targetW: number,
  targetH: number,
  inst: Instance,
  flickerAmp: number,
  flickerHashFn: ((i: number, s: number) => number) | null,
  flickerStep: number,
  flickerStep1: number,
  flickerFz: number,
): void {
  // Per-cell random dissolve on an anisotropic grid — square cells, the shader's own grid.
  const cellSize = effectiveCellSize(preset.pixelConfig.cellSize, inst.pixelScale);
  const { gridX, gridY } = revealGrid(cellSize, inst.cssWidth, inst.cssHeight);
  const cellCount = gridX * gridY;

  const pixDur = Math.max(0.05, preset.revealConfig.pixDuration);
  const fadeRaw = Math.max(0, Math.min(1, elapsed / pixDur));
  const fadeT = ease(preset.revealConfig.pixEasing, fadeRaw);

  ensurePixScratch(state, gridX, gridY);
  const pixCanvas = state.pixCanvas as HTMLCanvasElement;
  const pixCtx = state.pixCtx as CanvasRenderingContext2D;
  const pixDrop = state.pixDrop as HTMLCanvasElement;
  const pixDropCtx = state.pixDropCtx as CanvasRenderingContext2D;

  const softBand = 0.07;
  const invBand2 = 1 / (2 * softBand);
  if (
    !state.pixDropPattern ||
    state.pixDropPatternW !== gridX ||
    state.pixDropPatternH !== gridY ||
    state.pixDropRevealStart !== state.revealStartMs
  ) {
    state.pixDropPattern = new Float32Array(cellCount);
    const lo = softBand;
    const span = 1 - 2 * softBand;
    for (let i = 0; i < state.pixDropPattern.length; i++) {
      state.pixDropPattern[i] = lo + Math.random() * span;
    }
    state.pixDropPatternW = gridX;
    state.pixDropPatternH = gridY;
    state.pixDropRevealStart = state.revealStartMs;
  }
  const dd = (state.pixDropImgData as ImageData).data;
  const pattern = state.pixDropPattern;
  const hash = flickerAmp > 0.003 ? flickerHashFn : null;
  for (let i = 0; i < pattern.length; i++) {
    const dt = pattern[i];
    let a = 0.5 + (dt - fadeT) * invBand2;
    if (a < 0) a = 0;
    else if (a > 1) a = 1;
    // Cells whose drop time is near the dissolve position pop in and out instead of fading monotonically.
    if (hash) {
      const prox = 1 - Math.abs(fadeT - dt) * 6.25;
      if (prox > 0) {
        const rnd = hash(i, flickerStep) * (1 - flickerFz) + hash(i, flickerStep1) * flickerFz;
        a += (rnd - 0.5) * flickerAmp * 1.6 * prox;
        if (a < 0) a = 0;
        else if (a > 1) a = 1;
      }
    }
    dd[i * 4 + 3] = (a * 255 + 0.5) | 0;
  }
  pixDropCtx.putImageData(state.pixDropImgData as ImageData, 0, 0);

  // 1. Downsample the picture into the cell grid.
  pixCtx.globalCompositeOperation = 'source-over';
  pixCtx.clearRect(0, 0, gridX, gridY);
  pixCtx.imageSmoothingEnabled = true;
  pixCtx.imageSmoothingQuality = 'high';
  pixCtx.drawImage(getCoverBitmap(state, 'a', img, targetW, targetH), 0, 0, targetW, targetH, 0, 0, gridX, gridY);
  // 2. Drop the cells whose threshold has passed.
  pixCtx.globalCompositeOperation = 'destination-in';
  pixCtx.imageSmoothingEnabled = false;
  pixCtx.drawImage(pixDrop, 0, 0);
  pixCtx.globalCompositeOperation = 'source-over';
  // 3. The smooth picture as the base — it shows through every dropped cell.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(getCoverBitmap(state, 'a', img, targetW, targetH), 0, 0);
  // 4. The cells still standing, upscaled nearest-neighbour (chunky blocks).
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pixCanvas, 0, 0, gridX, gridY, 0, 0, targetW, targetH);
  ctx.imageSmoothingEnabled = true;
  // 5. Quantise the reveal mask to the same grid, so the silhouette is cell-stepped, and clip to it.
  pixCtx.globalCompositeOperation = 'source-over';
  pixCtx.clearRect(0, 0, gridX, gridY);
  pixCtx.imageSmoothingEnabled = true;
  pixCtx.imageSmoothingQuality = 'high';
  pixCtx.drawImage(state.maskGrad as HTMLCanvasElement, 0, 0, gridX, gridY);
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(pixCanvas, 0, 0, gridX, gridY, 0, 0, targetW, targetH);
  ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = 'source-over';
}

/** Boil tuning (library verbatim): pixelate-in, then the churn ramps to half the cells dropped. */
const BOIL_PIX_IN_MS = 800;
const BOIL_PIX_OVERLAP_MS = 300;
const BOIL_RAMP_S = 1.0;
const BOIL_LEVEL = 0.5;
const BOIL_BAND = 0.03;
const BOIL_FIELD_W = 0.6;
/** Handoff out of the boil: BLEND (cells morph to the new picture), then RESOLVE (base fades in, cells melt). */
const BOIL_BLEND_MS = 800;
const BOIL_BASE_MS = 400;
const BOIL_SHARPEN_MS = 1200;

/**
 * The sustained "generating" churn: the held picture broken into the dissolve's cell grid; each cell's keep/drop
 * threshold blends the live shader field at the cell with a persistent random pattern plus the flicker clock's jitter.
 * With a reveal pending, runs the BLEND → RESOLVE handoff and settles into `hold`.
 */
function paintBoilFrame(
  state: RevealInternals,
  s: SharedRenderer,
  inst: Instance,
  ctx: CanvasRenderingContext2D,
  shaderCanvas: HTMLCanvasElement,
  nowMs: number,
): void {
  const img = state.image;
  if (!img) return;
  const preset = inst.preset;
  const targetW = inst.canvas.width;
  const targetH = inst.canvas.height;
  if (ctx.canvas.width !== targetW || ctx.canvas.height !== targetH) {
    ctx.canvas.width = targetW;
    ctx.canvas.height = targetH;
  }
  ctx.canvas.style.filter = 'none';

  const cellSize = effectiveCellSize(preset.pixelConfig.cellSize, inst.pixelScale);
  const { gridX, gridY } = revealGrid(cellSize, inst.cssWidth, inst.cssHeight);
  const cellCount = gridX * gridY;

  const pending = state.pendingReveal;
  const hand = pending && state.boilHandoffStartMs > 0 ? nowMs - state.boilHandoffStartMs : -1;
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  const blendT = hand < 0 ? 0 : smooth(Math.min(1, hand / BOIL_BLEND_MS));
  const rt = hand < 0 ? -1 : hand - BOIL_BLEND_MS;
  const baseT = rt <= 0 ? 0 : smooth(Math.min(1, rt / BOIL_BASE_MS));
  const sharpRaw = rt <= 0 ? 0 : Math.min(1, rt / BOIL_SHARPEN_MS);
  const resolving = pending != null && rt > 0;

  const sinceStart = nowMs - state.boilStartMs;
  const inRaw = Math.min(1, sinceStart / BOIL_PIX_IN_MS);
  const inT = inRaw * inRaw * (3 - 2 * inRaw);
  const pixelatingIn = inRaw < 1;
  const baseOutRaw = Math.min(
    1,
    Math.max(0, sinceStart - (BOIL_PIX_IN_MS - BOIL_PIX_OVERLAP_MS)) / BOIL_PIX_OVERLAP_MS,
  );
  const pixInBaseAlpha = 1 - baseOutRaw * baseOutRaw * (3 - 2 * baseOutRaw);

  const rampRaw = Math.min(1, Math.max(0, sinceStart - (BOIL_PIX_IN_MS - BOIL_PIX_OVERLAP_MS)) / (BOIL_RAMP_S * 1000));
  const ramp = rampRaw * rampRaw * (3 - 2 * rampRaw);
  const boilT = ramp * BOIL_LEVEL;
  shaderCanvas.style.opacity = String(ramp);

  ensurePixScratch(state, gridX, gridY);
  const pixCanvas = state.pixCanvas as HTMLCanvasElement;
  const pixCtx = state.pixCtx as CanvasRenderingContext2D;
  const pixDrop = state.pixDrop as HTMLCanvasElement;
  const pixDropCtx = state.pixDropCtx as CanvasRenderingContext2D;

  if (!state.boilPattern || state.boilPatternW !== gridX || state.boilPatternH !== gridY) {
    state.boilPattern = new Float32Array(cellCount);
    for (let i = 0; i < cellCount; i++) state.boilPattern[i] = Math.random();
    state.boilPatternW = gridX;
    state.boilPatternH = gridY;
  }

  // Same flicker clock/hash as the reveal mask; a floor on the amplitude keeps the boil alive.
  const amp = Math.max(preset.flicker ?? 0, 0.5);
  const gsT = inst.accumulatedTime * Math.max(preset.speed, 2) * 1.6;
  const rawStep = Math.floor(gsT);
  const step = rawStep % 1024;
  const step1 = (step + 1) % 1024;
  let fz = gsT - rawStep;
  fz = fz * fz * (3 - 2 * fz);

  const dd = (state.pixDropImgData as ImageData).data;
  const pattern = state.boilPattern;

  // The live shader field (re-sampled every 3rd frame) makes the churn follow the effect's waves.
  const maskSize = MASK_SIZE;
  ensureScratch(state, maskSize);
  const counter = state.sampleFrameCounter++;
  const shouldSample = state.sampleDataCache == null || counter % 3 === 0;
  const fieldStale = !state.boilField || state.boilField.length !== cellCount;
  const sampleData = shouldSample
    ? sampleShaderField(state, s, inst, state.sampleCtx as CanvasRenderingContext2D, maskSize)
    : (state.sampleDataCache as Uint8ClampedArray);

  if (shouldSample || fieldStale) {
    if (fieldStale) state.boilField = new Float32Array(cellCount);
    const f = state.boilField as Float32Array;
    let fMin = 1;
    let fMax = 0;
    for (let cy = 0; cy < gridY; cy++) {
      const my = Math.min(maskSize - 1, (((cy + 0.5) * maskSize) / gridY) | 0);
      for (let cx = 0; cx < gridX; cx++) {
        const mx = Math.min(maskSize - 1, (((cx + 0.5) * maskSize) / gridX) | 0);
        const si = (my * maskSize + mx) * 4;
        const l = (sampleData[si] * 0.299 + sampleData[si + 1] * 0.587 + sampleData[si + 2] * 0.114) / 255;
        f[cy * gridX + cx] = l;
        if (l < fMin) fMin = l;
        if (l > fMax) fMax = l;
      }
    }
    const fSpan = fMax - fMin > 0.001 ? 1 / (fMax - fMin) : 0;
    for (let i = 0; i < cellCount; i++) {
      f[i] = fSpan > 0 ? (f[i] - fMin) * fSpan : 0.5;
    }
  }
  const field = state.boilField as Float32Array;

  const invBand2 = 1 / (2 * BOIL_BAND);
  const churn = amp * 0.6 * (1 - sharpRaw);
  const patW = 1 - BOIL_FIELD_W;
  const fadeT = resolving ? ease(preset.revealConfig.pixEasing, sharpRaw) : 0;
  const softBand = 0.07;
  const invBandS = 1 / (2 * softBand);
  const sAmp = preset.flicker ?? 0;
  for (let i = 0; i < cellCount; i++) {
    const rnd = flickerHash(i, step) * (1 - fz) + flickerHash(i, step1) * fz;
    const dtEff = field[i] * BOIL_FIELD_W + pattern[i] * patW + (rnd - 0.5) * churn;
    let a = 0.5 + (dtEff - boilT) * invBand2;
    if (a < 0) a = 0;
    else if (a > 1) a = 1;
    if (pixelatingIn) {
      const dt = pattern[i];
      let aIn = 0.5 + (inT - dt) * invBandS;
      if (aIn < 0) aIn = 0;
      else if (aIn > 1) aIn = 1;
      const prox = 1 - Math.abs(inT - dt) * 6.25;
      if (prox > 0) {
        aIn += (rnd - 0.5) * amp * 1.6 * prox;
        if (aIn < 0) aIn = 0;
        else if (aIn > 1) aIn = 1;
      }
      if (aIn < a) a = aIn;
    }
    if (resolving) {
      const dt = pattern[i];
      let a2 = 0.5 + (dt - fadeT) * invBandS;
      if (a2 < 0) a2 = 0;
      else if (a2 > 1) a2 = 1;
      if (sAmp > 0.003) {
        const prox = 1 - Math.abs(fadeT - dt) * 6.25;
        if (prox > 0) {
          a2 += (rnd - 0.5) * sAmp * 1.6 * prox;
          if (a2 < 0) a2 = 0;
          else if (a2 > 1) a2 = 1;
        }
      }
      if (a2 < a) a = a2;
    }
    dd[i * 4 + 3] = (a * 255 + 0.5) | 0;
  }
  pixDropCtx.putImageData(state.pixDropImgData as ImageData, 0, 0);

  // Mosaic source: the outgoing picture, cross-faded toward the incoming one during BLEND (in the downsampled grid,
  // so each chunky cell's colour morphs smoothly).
  pixCtx.globalCompositeOperation = 'source-over';
  pixCtx.clearRect(0, 0, gridX, gridY);
  pixCtx.imageSmoothingEnabled = true;
  pixCtx.imageSmoothingQuality = 'high';
  if (blendT < 1) {
    pixCtx.drawImage(getCoverBitmap(state, 'a', img, targetW, targetH), 0, 0, targetW, targetH, 0, 0, gridX, gridY);
  }
  if (pending && blendT > 0) {
    pixCtx.globalAlpha = blendT;
    pixCtx.drawImage(
      getCoverBitmap(state, 'b', pending.image, targetW, targetH),
      0,
      0,
      targetW,
      targetH,
      0,
      0,
      gridX,
      gridY,
    );
    pixCtx.globalAlpha = 1;
  }
  pixCtx.globalCompositeOperation = 'destination-in';
  pixCtx.imageSmoothingEnabled = false;
  pixCtx.drawImage(pixDrop, 0, 0);
  pixCtx.globalCompositeOperation = 'source-over';

  ctx.clearRect(0, 0, targetW, targetH);
  if (pixelatingIn && pixInBaseAlpha > 0) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = pixInBaseAlpha;
    ctx.drawImage(getCoverBitmap(state, 'a', img, targetW, targetH), 0, 0);
    ctx.globalAlpha = 1;
  } else if (resolving && pending && baseT > 0) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = baseT;
    ctx.drawImage(getCoverBitmap(state, 'b', pending.image, targetW, targetH), 0, 0);
    ctx.globalAlpha = 1;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pixCanvas, 0, 0, gridX, gridY, 0, 0, targetW, targetH);
  ctx.imageSmoothingEnabled = true;

  // Handoff complete: the new picture is sharp. Settle into `hold` like a finished reveal.
  if (resolving && pending && sharpRaw >= 1 && baseT >= 1) {
    state.image = pending.image;
    state.pendingReveal = null;
    state.boilHandoffStartMs = 0;
    state.holdPaintedImg = null;
    state.phase = 'hold';
    shaderCanvas.style.opacity = '0';
    state.onRevealComplete?.();
  }
}

export interface CreateRevealOptions {
  /** The overlay canvas (sibling over the shader canvas). */
  canvas: HTMLCanvasElement;
  cssWidth: number;
  cssHeight: number;
  /** Shader canvas — its opacity is driven by the reveal so the picture cross-fades over it. */
  shaderCanvas: HTMLCanvasElement;
}

/** A reveal on `opts.canvas`, or null when it gives no 2D context. */
export function createReveal(opts: CreateRevealOptions): RevealState | null {
  let maybe: CanvasRenderingContext2D | null = null;
  try {
    maybe = opts.canvas.getContext('2d');
  } catch {
    maybe = null;
  }
  if (!maybe) return null;
  const ctx: CanvasRenderingContext2D = maybe;

  const state: RevealInternals = {
    active: false,
    phase: 'idle',
    revealStartMs: 0,
    hideStartMs: 0,
    hideDurationMs: 300,
    boilStartMs: 0,
    boilPattern: null,
    boilPatternW: 0,
    boilPatternH: 0,
    boilField: null,
    boilHandoffStartMs: 0,
    pendingReveal: null,
    image: null,
    cssWidth: opts.cssWidth,
    cssHeight: opts.cssHeight,
    sampleCanvas: null,
    sampleCtx: null,
    sampleImgData: null,
    sampleDataCache: null,
    sampleFrameCounter: 0,
    maskGrad: null,
    maskGradCtx: null,
    maskImgData: null,
    gsFlickerTable: null,
    pixCanvas: null,
    pixCtx: null,
    pixDrop: null,
    pixDropCtx: null,
    pixDropImgData: null,
    pixDropPattern: null,
    pixDropPatternW: 0,
    pixDropPatternH: 0,
    pixDropRevealStart: -1,
    coverA: null,
    coverB: null,
    holdPaintedImg: null,
    holdPaintedW: 0,
    holdPaintedH: 0,
    sampleGpuCanvas: null,
    sampleGpuCtx: null,
  };

  const shaderCanvas = opts.shaderCanvas;

  function beginReveal(revealOpts: RevealStartOptions): void {
    state.image = revealOpts.image;
    state.cssWidth = revealOpts.cssWidth;
    state.cssHeight = revealOpts.cssHeight;
    state.onRevealComplete = revealOpts.onRevealComplete;
    state.revealStartMs = performance.now();
    state.phase = 'reveal';
    state.active = true;
    state.boilHandoffStartMs = 0;
    state.pendingReveal = null;
    // The very first frame of a reveal always takes a fresh shader sample.
    state.sampleFrameCounter = 0;
    state.sampleDataCache = null;
    state.holdPaintedImg = null;
    ctx.canvas.style.opacity = '1';
  }

  return {
    canvas: opts.canvas,
    ctx,
    afterShaderFrame(s, inst, nowMs) {
      state.cssWidth = inst.cssWidth;
      state.cssHeight = inst.cssHeight;
      if (!state.active) {
        ctx.canvas.style.filter = 'none';
        return;
      }
      const { duration, easingKey } = getActiveRevealTiming(inst.preset);
      if (state.phase === 'reveal' && state.image) {
        const elapsed = (nowMs - state.revealStartMs) / 1000;
        const t = Math.min(elapsed / duration, 1);
        const eased = ease(easingKey, t);
        // Cross-fade: the shader's opacity drops as the overlay fills in.
        shaderCanvas.style.opacity = String(1 - eased);
        paintMaskedFrame(state, s, inst, ctx);
        if (t >= 1) {
          state.phase = 'hold';
          shaderCanvas.style.opacity = '0';
          state.onRevealComplete?.();
        }
      } else if (state.phase === 'hold' && state.image) {
        ctx.canvas.style.filter = 'none';
        const img = state.image;
        const w = inst.canvas.width;
        const h = inst.canvas.height;
        if (ctx.canvas.width !== w || ctx.canvas.height !== h) {
          ctx.canvas.width = w;
          ctx.canvas.height = h;
          state.holdPaintedImg = null;
        }
        // Paint once per image × size: the held frame is static.
        if (state.holdPaintedImg !== img || state.holdPaintedW !== w || state.holdPaintedH !== h) {
          ctx.clearRect(0, 0, w, h);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(getCoverBitmap(state, 'a', img, w, h), 0, 0);
          state.holdPaintedImg = img;
          state.holdPaintedW = w;
          state.holdPaintedH = h;
        }
        shaderCanvas.style.opacity = '0';
      } else if (state.phase === 'boil' && state.image) {
        paintBoilFrame(state, s, inst, ctx, shaderCanvas, nowMs);
      } else if (state.phase === 'hide') {
        const elapsed = nowMs - state.hideStartMs;
        const t = Math.min(elapsed / Math.max(1, state.hideDurationMs), 1);
        ctx.canvas.style.opacity = String(1 - t);
        shaderCanvas.style.opacity = String(t);
        if (t >= 1) {
          state.active = false;
          state.phase = 'idle';
          ctx.canvas.style.opacity = '1';
          ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
          shaderCanvas.style.opacity = '1';
          state.image = null;
        }
      }
    },
    startReveal(revealOpts) {
      if (state.phase === 'boil' && state.active) {
        // Hand the incoming picture to the boil: BLEND → RESOLVE, then it settles into `hold` itself.
        state.pendingReveal = revealOpts;
        state.onRevealComplete = revealOpts.onRevealComplete;
        state.cssWidth = revealOpts.cssWidth;
        state.cssHeight = revealOpts.cssHeight;
        if (state.boilHandoffStartMs === 0) state.boilHandoffStartMs = performance.now();
        return;
      }
      beginReveal(revealOpts);
    },
    startHide(durationMs = 300) {
      if (!state.active || state.phase === 'hide') return;
      state.phase = 'hide';
      state.hideStartMs = performance.now();
      state.hideDurationMs = durationMs;
    },
    startBoil() {
      if (!state.active || !state.image) return;
      if (state.phase !== 'hold' && state.phase !== 'reveal') return;
      state.phase = 'boil';
      state.boilStartMs = performance.now();
      state.boilHandoffStartMs = 0;
      state.pendingReveal = null;
      // A fresh cell pattern per regeneration, and a fresh shader sample on the first boil frame.
      state.boilPattern = null;
      state.sampleFrameCounter = 0;
      state.sampleDataCache = null;
      state.holdPaintedImg = null;
      ctx.canvas.style.opacity = '1';
    },
    startHold(image) {
      state.image = image;
      state.phase = 'hold';
      state.active = true;
      state.boilHandoffStartMs = 0;
      state.pendingReveal = null;
      state.holdPaintedImg = null;
      ctx.canvas.style.opacity = '1';
      ctx.canvas.style.filter = 'none';
      shaderCanvas.style.opacity = '0';
    },
    clear() {
      const wasActive = state.active;
      state.active = false;
      state.phase = 'idle';
      state.image = null;
      state.boilHandoffStartMs = 0;
      state.pendingReveal = null;
      state.holdPaintedImg = null;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      if (wasActive) {
        ctx.canvas.style.filter = 'none';
        ctx.canvas.style.opacity = '1';
        shaderCanvas.style.opacity = '1';
      }
    },
    isActive() {
      return state.active;
    },
    phase() {
      return state.phase;
    },
    dispose() {
      state.active = false;
      state.phase = 'idle';
      state.image = null;
      state.sampleCanvas = null;
      state.sampleCtx = null;
      state.sampleImgData = null;
      state.sampleDataCache = null;
      state.sampleFrameCounter = 0;
      state.maskGrad = null;
      state.maskGradCtx = null;
      state.maskImgData = null;
      state.gsFlickerTable = null;
      state.pixCanvas = null;
      state.pixCtx = null;
      state.pixDrop = null;
      state.pixDropCtx = null;
      state.pixDropImgData = null;
      state.pixDropPattern = null;
      state.boilPattern = null;
      state.boilField = null;
      state.pendingReveal = null;
      state.coverA = null;
      state.coverB = null;
      state.holdPaintedImg = null;
      state.sampleGpuCanvas = null;
      state.sampleGpuCtx = null;
    },
  };
}
