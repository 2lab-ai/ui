/**
 * The img-fx renderer (`src/engine/renderer.ts` of img-fx 0.5.2, MIT, © 2026 Jakub Antalik) on a raw WebGL 2 context
 * instead of three.js. What changed in the port:
 *
 *   - One context per element (the ui Effects contract), not one page-wide `THREE.WebGLRenderer`: an offscreen GL
 *     canvas sized to the element (iw × ih at `dpr` ≤ 1.25), drawn as one full-screen quad and copied into the
 *     visible 2D canvas each frame — the library's own GL → 2D pipeline, so the last frame stays on screen after the
 *     context is released (a still frame under reduced motion, the picture handoff, a long idle).
 *   - three's ShaderMaterial / WebGLRenderTarget / blending become a few GL calls: programs compiled per effect and
 *     pass on first use (`specializeEffect`), the two-pass mosaic's cell field in a grow-only float (or 8-bit)
 *     framebuffer, NormalBlending as `blendFuncSeparate(SRC_ALPHA, ONE_MINUS_SRC_ALPHA, ONE, ONE_MINUS_SRC_ALPHA)`
 *     over a cleared transparent buffer, `premultipliedAlpha: false`, three's per-render auto-clear.
 *   - The rAF loop, the visibility bookkeeping and the frame-rate cap live in the element; this module paints.
 *
 * The uniform upload, the card-linked palette remap, `effectiveCellSize`, the float32 `mosaicGrid` and the paint
 * order are the library's.
 */
import { type PresetMode, parseCssColor } from './presets';
import type { RevealState } from './reveal';
import { fragmentSource, UNIFORMS, type UniformName, VERT_SRC } from './shaders';

/** Maximum device-pixel-ratio of the GL framebuffer (fragment work scales with its square). */
export const MAX_GL_DPR = 1.25;
/** Maximum device-pixel-ratio of the visible 2D canvas (and the picture drawn into it). */
export const MAX_CANVAS_DPR = 2;
/** The library's default frame cap: 10 fps suits the slow-drift presets. */
export const FRAME_INTERVAL_MS = 1000 / 10;
/** Reference card edge (CSS px) of the shader's `gridCounts`. */
export const REF_DIM = 320;

type Vec = [number, number] | [number, number, number];

/** The one uniform block every program reads (three's `uniforms` object, as plain fields). */
export interface Uniforms {
  u_resolution: [number, number];
  u_dpr: number;
  u_time: number;
  u_color1: [number, number, number];
  u_color2: [number, number, number];
  u_color3: [number, number, number];
  u_color4: [number, number, number];
  u_color5: [number, number, number];
  u_color6: [number, number, number];
  u_color7: [number, number, number];
  u_cardBg: [number, number, number];
  u_alpha1: number;
  u_alpha2: number;
  u_alpha3: number;
  u_alpha4: number;
  u_alpha5: number;
  u_alpha6: number;
  u_alpha7: number;
  u_speed: number;
  u_intensity: number;
  u_scale: number;
  u_direction: number;
  u_softness: number;
  u_distortion: number;
  u_complexity: number;
  u_shape: number;
  u_flicker: number;
  u_vignette: number;
  u_vigOpacity: number;
  u_blur: number;
  u_highlight: number;
  u_shaderOpacity: number;
  u_cellSize: number;
  u_gap: number;
  u_dotSize: number;
  u_dotSoftness: number;
  u_dotOpacity: number;
  u_hlScale: number;
  u_fillOpacity: number;
  u_edgeFade: number;
  u_fadeStr: number;
  u_dotMode: number;
  u_effect: number;
  u_sweepEase: number;
  u_grid: [number, number];
  u_fieldSize: [number, number];
}

/** The library's starting values (`createUniforms`). */
export function createUniforms(): Uniforms {
  const hex = (h: number): [number, number, number] => [
    ((h >> 16) & 255) / 255,
    ((h >> 8) & 255) / 255,
    (h & 255) / 255,
  ];
  return {
    u_resolution: [1, 1],
    u_dpr: 1,
    u_time: 0,
    u_color1: hex(0x1a1a1a),
    u_color2: hex(0x808080),
    u_color3: hex(0xd9d9d9),
    u_color4: hex(0x404040),
    u_color5: hex(0xc0c0c0),
    u_color6: hex(0x606060),
    u_color7: hex(0xa0a0a0),
    u_cardBg: hex(0x0f0f0f),
    u_alpha1: 1,
    u_alpha2: 1,
    u_alpha3: 1,
    u_alpha4: 1,
    u_alpha5: 1,
    u_alpha6: 1,
    u_alpha7: 1,
    u_speed: 1,
    u_intensity: 1,
    u_scale: 1.5,
    u_direction: 0,
    u_softness: 0.75,
    u_distortion: 0.3,
    u_complexity: 0.2,
    u_shape: 0.5,
    u_flicker: 0,
    u_vignette: 0.25,
    u_vigOpacity: 1,
    u_blur: 0,
    u_highlight: 0.4,
    u_shaderOpacity: 1,
    u_cellSize: 0.5,
    u_gap: 0.3,
    u_dotSize: 0.8,
    u_dotSoftness: 0.1,
    u_dotOpacity: 1,
    u_hlScale: 0,
    u_fillOpacity: 0,
    u_edgeFade: 16,
    u_fadeStr: 1,
    u_dotMode: 1,
    u_effect: 22,
    u_sweepEase: 0,
    u_grid: [2, 2],
    u_fieldSize: [1, 1],
  };
}

interface Program {
  program: WebGLProgram;
  locations: Map<UniformName, WebGLUniformLocation>;
}

interface FieldTarget {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  width: number;
  height: number;
  internal: number;
  format: number;
  type: number;
}

/** One element's GL side: an offscreen canvas, its context, the quad, the programs and the cell-field target. */
export interface SharedRenderer {
  glCanvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  quad: WebGLBuffer;
  vao: WebGLVertexArrayObject;
  programs: Map<string, Program>;
  fieldTarget: FieldTarget | null;
  uniforms: Uniforms;
  /** Instance whose uniforms are in `uniforms` (skip the full re-upload when it paints again, clean). */
  lastInstance: Instance | null;
  contextLost: boolean;
  /** Called once when the context is lost (the element falls back to CSS). */
  onLost: (() => void) | null;
  lostListener: (e: Event) => void;
}

/** A visible card: its 2D canvas, size, preset and overrides, and the reveal drawn over it. */
export interface Instance {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** CSS-px size. */
  cssWidth: number;
  cssHeight: number;
  /** GL render DPR (≤ MAX_GL_DPR). */
  dpr: number;
  /** Display DPR of the visible 2D canvas and the picture (≤ MAX_CANVAS_DPR). */
  canvasDpr: number;
  preset: PresetMode;
  /** Card colour override (any CSS colour) for `u_cardBg` and the reveal. */
  cardBgOverride: string | null;
  /** Per-slot palette override (up to 7 CSS colours; null keeps the preset slot). */
  colorsOverride: (string | null | undefined)[] | null;
  /** Strength 0..2: 0..1 is canvas opacity (the element sets it), above 1 boosts intensity and highlight. */
  strength: number;
  /** Clock multiplier on top of the preset's speed. */
  speedMul: number;
  /** Pixel-cell size multiplier (2 = chunkier). */
  pixelScale: number;
  uniformsDirty: boolean;
  reveal: RevealState | null;
  /** Per-instance clock (s), seeded at random so cards do not tick in lockstep. */
  accumulatedTime: number;
}

const devicePixelRatioNow = (): number =>
  typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;

/**
 * A WebGL 2 context on a fresh offscreen canvas, or null (no WebGL 2, a blocked GPU, any exception). Never throws.
 * `onLost` runs once if the browser takes the context away.
 */
export function createRenderer(onLost?: () => void): SharedRenderer | null {
  try {
    if (typeof document === 'undefined') return null;
    const glCanvas = document.createElement('canvas');
    glCanvas.width = 8;
    glCanvas.height = 8;
    // The library's context flags: `preserveDrawingBuffer: false` is right because the frame is copied into the
    // visible 2D canvas in the same task it is drawn.
    const gl = glCanvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    }) as WebGL2RenderingContext | null;
    if (!gl) return null;
    const quad = gl.createBuffer();
    const vao = gl.createVertexArray();
    if (!quad || !vao) return null;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    const s: SharedRenderer = {
      glCanvas,
      gl,
      quad,
      vao,
      programs: new Map(),
      fieldTarget: null,
      uniforms: createUniforms(),
      lastInstance: null,
      contextLost: false,
      onLost: onLost ?? null,
      lostListener: () => {},
    };
    s.lostListener = (e: Event) => {
      e.preventDefault?.();
      if (s.contextLost) return;
      s.contextLost = true;
      const cb = s.onLost;
      s.onLost = null;
      cb?.();
    };
    glCanvas.addEventListener('webglcontextlost', s.lostListener, false);
    return s;
  } catch {
    return null;
  }
}

/** Free every GL object and release the context (`WEBGL_lose_context`). Safe twice; never throws. */
export function destroyRenderer(s: SharedRenderer): void {
  s.onLost = null;
  s.glCanvas.removeEventListener('webglcontextlost', s.lostListener, false);
  const gl = s.gl;
  try {
    if (!s.contextLost) {
      for (const p of s.programs.values()) gl.deleteProgram(p.program);
      if (s.fieldTarget) {
        gl.deleteFramebuffer(s.fieldTarget.fbo);
        gl.deleteTexture(s.fieldTarget.tex);
      }
      gl.deleteBuffer(s.quad);
      gl.deleteVertexArray(s.vao);
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    // Already gone.
  }
  s.programs.clear();
  s.fieldTarget = null;
  s.lastInstance = null;
  s.contextLost = true;
  s.glCanvas.width = 1;
  s.glCanvas.height = 1;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('image-reveal: createShader failed');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`image-reveal: shader compile failed: ${log ?? ''}`);
  }
  return sh;
}

/**
 * Program for `effect` at `pass` (0 = single pass, 1 = cell field, 2 = composite), built on first use. Throws on a
 * compile or link error (the element's paint catches it and falls back).
 */
function getProgram(s: SharedRenderer, effect: number, pass: 0 | 1 | 2): Program {
  const key = `${pass}:${effect}`;
  const have = s.programs.get(key);
  if (have) return have;
  const gl = s.gl;
  const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSource(effect, pass));
  const program = gl.createProgram();
  if (!program) throw new Error('image-reveal: createProgram failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, 'position');
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`image-reveal: program link failed: ${log ?? ''}`);
  }
  const locations = new Map<UniformName, WebGLUniformLocation>();
  for (const name of Object.keys(UNIFORMS) as UniformName[]) {
    const loc = gl.getUniformLocation(program, name);
    if (loc) locations.set(name, loc);
  }
  const p: Program = { program, locations };
  s.programs.set(key, p);
  return p;
}

/** Upload the whole uniform block to `p` (every program shares the one block, as three's materials did). */
function uploadUniforms(s: SharedRenderer, p: Program): void {
  const gl = s.gl;
  const u = s.uniforms as unknown as Record<string, number | Vec>;
  for (const [name, loc] of p.locations) {
    const kind = UNIFORMS[name];
    if (kind === 'sampler') {
      gl.uniform1i(loc, 0);
      continue;
    }
    const v = u[name];
    if (kind === 'float') gl.uniform1f(loc, v as number);
    else if (kind === 'int') gl.uniform1i(loc, (v as number) | 0);
    else if (kind === 'vec2') gl.uniform2f(loc, (v as Vec)[0], (v as Vec)[1]);
    else gl.uniform3f(loc, (v as Vec)[0], (v as Vec)[1], (v as Vec)[2] ?? 0);
  }
}

/** Resolve the effective `cellSize` (0..1 preset value) for an instance's `pixelScale` (library verbatim). */
export function effectiveCellSize(cellSize: number, pixelScale: number): number {
  if (!(pixelScale > 0) || pixelScale === 1) return cellSize;
  const baseCount = (6 + cellSize * 74) / pixelScale;
  return (baseCount - 6) / 74;
}

/**
 * Cells along x / y of the mosaic for a framebuffer of `resX × resY` px at `dpr` — the shader's `imgfx_mosaicGrid`
 * in float32, so the two-pass field and the single pass agree (library verbatim).
 */
export function mosaicGrid(
  resX: number,
  resY: number,
  dprIn: number,
  cellSize: number,
  dotMode = 1,
  gapIn = 0,
): { gx: number; gy: number } {
  const f = Math.fround;
  const dpr = f(Math.max(dprIn, 0.0001));
  const base = f(6 + f(f(cellSize) * 74));
  let gx = Math.max(2, Math.floor(f(f(base * f(f(resX) / dpr)) / REF_DIM)));
  let gy = Math.max(2, Math.floor(f(f(base * f(f(resY) / dpr)) / REF_DIM)));
  if (dotMode > 1.5) {
    const k = f(1 - f(f(gapIn) * 0.8));
    gx = Math.max(2, Math.floor(f(gx * k)));
    gy = Math.max(2, Math.floor(f(gy * k)));
  }
  return { gx, gy };
}

/**
 * Palette colour `index` (0–6) as [r,g,b] in 0–1, after the card-linked remap: a preset colour authored equal to the
 * preset's own `cardBg` is a "card variable" and follows an overridden card colour (library verbatim).
 */
export function effectivePaletteColor(
  inst: Pick<Instance, 'preset' | 'cardBgOverride'>,
  index: number,
): [number, number, number] {
  const p = inst.preset;
  const [r, g, b] = parseCssColor(p.colors[index]);
  if (inst.cardBgOverride == null) return [r, g, b];
  const [pbr, pbg, pbb] = parseCssColor(p.cardBg);
  const chan = (v: number): number => Math.round(v * 255);
  if (chan(r) === chan(pbr) && chan(g) === chan(pbg) && chan(b) === chan(pbb)) {
    return parseCssColor(inst.cardBgOverride);
  }
  return [r, g, b];
}

/** The card colour in effect for this instance (override > preset). */
export function effectiveCardBg(inst: Pick<Instance, 'preset' | 'cardBgOverride'>): string {
  return inst.cardBgOverride ?? inst.preset.cardBg;
}

/** Fill the uniform block from an instance's preset and overrides (library `uploadInstanceUniforms`). */
export function writeInstanceUniforms(u: Uniforms, inst: Instance): void {
  const p = inst.preset;
  u.u_effect = p.effectIndex;
  u.u_speed = p.speed;
  // Strength above 1 boosts the shader's palette intensity and highlight (canvas opacity is already 1 there); the
  // 2.2 slope makes strength = 2 roughly a 3× intensity push.
  const boost = 1 + Math.max(0, inst.strength - 1) * 2.2;
  u.u_intensity = p.intensity * boost;
  u.u_scale = p.scale;
  u.u_direction = (p.direction * Math.PI) / 180;
  u.u_softness = p.softness;
  u.u_distortion = p.distortion;
  u.u_complexity = p.complexity;
  u.u_shape = p.shape;
  u.u_flicker = p.flicker ?? 0;
  u.u_vignette = p.vignette;
  u.u_vigOpacity = p.vigOpacity;
  u.u_blur = p.blur;
  u.u_highlight = p.highlight * boost;
  u.u_shaderOpacity = p.shaderOpacity;
  u.u_dotMode = p.dotMode;
  u.u_sweepEase = p.sweepEase != null ? Math.floor(p.sweepEase) : 0;

  const mosaic = p.pixelConfig;
  u.u_cellSize = effectiveCellSize(mosaic.cellSize, inst.pixelScale);
  u.u_gap = mosaic.gap;
  // Disc size and softness are only read when u_dotMode > 1.5, which no bundled preset sets; the library's pixel
  // blocks carry these values.
  u.u_dotSize = 0.8;
  u.u_dotSoftness = 0.1;
  u.u_dotOpacity = mosaic.dotOpacity;
  u.u_hlScale = mosaic.hlScale;
  u.u_fillOpacity = mosaic.fillOpacity;
  u.u_edgeFade = mosaic.edgeFade;
  u.u_fadeStr = mosaic.fadeStr;

  const bg = parseCssColor(inst.cardBgOverride ?? p.cardBg);
  const colors = [u.u_color1, u.u_color2, u.u_color3, u.u_color4, u.u_color5, u.u_color6, u.u_color7];
  const alphas: Array<'u_alpha1' | 'u_alpha2' | 'u_alpha3' | 'u_alpha4' | 'u_alpha5' | 'u_alpha6' | 'u_alpha7'> = [
    'u_alpha1',
    'u_alpha2',
    'u_alpha3',
    'u_alpha4',
    'u_alpha5',
    'u_alpha6',
    'u_alpha7',
  ];
  for (let i = 0; i < 7; i++) {
    const override = inst.colorsOverride?.[i];
    const rgb = override != null ? parseCssColor(override) : effectivePaletteColor(inst, i);
    colors[i][0] = rgb[0];
    colors[i][1] = rgb[1];
    colors[i][2] = rgb[2];
    u[alphas[i]] = p.alphas[i];
  }
  u.u_cardBg[0] = bg[0];
  u.u_cardBg[1] = bg[1];
  u.u_cardBg[2] = bg[2];
  inst.uniformsDirty = false;
}

/** Field target with room for a gx×gy grid, grow-only: RGBA32F where it can be rendered to, else RGBA8. */
function ensureFieldTarget(s: SharedRenderer, gx: number, gy: number): FieldTarget | null {
  const gl = s.gl;
  const cur = s.fieldTarget;
  if (cur && cur.width >= gx && cur.height >= gy) return cur;
  const w = Math.max(gx, cur?.width ?? 64);
  const h = Math.max(gy, cur?.height ?? 64);
  if (cur) {
    gl.bindTexture(gl.TEXTURE_2D, cur.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, cur.internal, w, h, 0, cur.format, cur.type, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    cur.width = w;
    cur.height = h;
    return cur;
  }
  const formats: Array<[number, number, number]> = [];
  if (gl.getExtension('EXT_color_buffer_float')) formats.push([gl.RGBA32F, gl.RGBA, gl.FLOAT]);
  formats.push([gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE]);
  for (const [internal, format, type] of formats) {
    const tex = gl.createTexture();
    const fbo = gl.createFramebuffer();
    if (!tex || !fbo) return null;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    if (ok) {
      s.fieldTarget = { fbo, tex, width: w, height: h, internal, format, type };
      return s.fieldTarget;
    }
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(tex);
  }
  return null;
}

/** Bind `p`, upload the block, clear the current target and draw the quad (three's auto-clear + one mesh). */
function drawPass(s: SharedRenderer, p: Program): void {
  const gl = s.gl;
  gl.useProgram(p.program);
  uploadUniforms(s, p);
  gl.bindVertexArray(s.vao);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

/**
 * Draw the shader for the current uniforms into the GL canvas (viewport = u_resolution). Mosaic modes
 * (`u_dotMode` > 0.5) take the two-pass path; raw mode — and a device with no renderable field target — draw in a
 * single pass. Also used by the reveal sampler, which re-draws with patched uniforms.
 */
export function drawShader(s: SharedRenderer): void {
  const gl = s.gl;
  const u = s.uniforms;
  const effect = u.u_effect;
  const [iw, ih] = u.u_resolution;
  const mosaic = u.u_dotMode > 0.5;
  let rt: FieldTarget | null = null;
  if (mosaic) {
    const { gx, gy } = mosaicGrid(iw, ih, u.u_dpr, u.u_cellSize, u.u_dotMode, u.u_gap);
    u.u_grid[0] = gx;
    u.u_grid[1] = gy;
    rt = ensureFieldTarget(s, gx, gy);
  }
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, null);
  if (!rt) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, iw, ih);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    drawPass(s, getProgram(s, effect, 0));
    return;
  }
  // Pass 1: the cell field, raw colour + highlight weight, no blending (it would fold the weight into the colour).
  gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo);
  gl.viewport(0, 0, u.u_grid[0], u.u_grid[1]);
  gl.disable(gl.BLEND);
  drawPass(s, getProgram(s, effect, 1));
  // Pass 2: every pixel reads its cell's texel.
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, iw, ih);
  u.u_fieldSize[0] = rt.width;
  u.u_fieldSize[1] = rt.height;
  gl.bindTexture(gl.TEXTURE_2D, rt.tex);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  drawPass(s, getProgram(s, effect, 2));
  gl.bindTexture(gl.TEXTURE_2D, null);
}

/** Framebuffer pixel size an instance needs (CSS px × DPR, floored, min 1). */
export function instancePixelSize(inst: Pick<Instance, 'cssWidth' | 'cssHeight' | 'dpr'>): { iw: number; ih: number } {
  return {
    iw: Math.max(1, Math.floor(inst.cssWidth * inst.dpr)),
    ih: Math.max(1, Math.floor(inst.cssHeight * inst.dpr)),
  };
}

/**
 * Render one frame of `inst` and copy it into its visible 2D canvas, then let the reveal paint its overlay (library
 * `paintInstance`). The GL canvas is the instance's size, so the frame fills it.
 */
export function paintInstance(s: SharedRenderer, inst: Instance, nowMs: number): void {
  if (s.contextLost) return;
  const { iw, ih } = instancePixelSize(inst);
  if (s.glCanvas.width !== iw || s.glCanvas.height !== ih) {
    s.glCanvas.width = iw;
    s.glCanvas.height = ih;
  }
  s.uniforms.u_resolution[0] = iw;
  s.uniforms.u_resolution[1] = ih;
  s.uniforms.u_dpr = inst.dpr || 1;
  if (!(s.lastInstance === inst && !inst.uniformsDirty)) {
    writeInstanceUniforms(s.uniforms, inst);
    s.lastInstance = inst;
  }
  s.uniforms.u_time = inst.accumulatedTime;

  drawShader(s);

  const dispW = Math.max(1, Math.floor(inst.cssWidth * inst.canvasDpr));
  const dispH = Math.max(1, Math.floor(inst.cssHeight * inst.canvasDpr));
  if (inst.canvas.width !== dispW || inst.canvas.height !== dispH) {
    inst.canvas.width = dispW;
    inst.canvas.height = dispH;
  }
  inst.ctx.clearRect(0, 0, dispW, dispH);
  // Nearest-neighbour for the GL → visible upscale: the mosaic's block edges stay crisp.
  inst.ctx.imageSmoothingEnabled = false;
  inst.ctx.drawImage(s.glCanvas, 0, s.glCanvas.height - ih, iw, ih, 0, 0, dispW, dispH);

  // Sampling inside `afterShaderFrame` patches u_dotMode / u_fillOpacity, so drop the uniform cache after it runs.
  inst.reveal?.afterShaderFrame(s, inst, nowMs);
  if (inst.reveal?.isActive()) s.lastInstance = null;
}

export interface CreateInstanceOptions {
  canvas: HTMLCanvasElement;
  cssWidth: number;
  cssHeight: number;
  preset: PresetMode;
  strength?: number;
  speed?: number;
  cardBg?: string | null;
  pixelScale?: number;
}

/** An instance on a visible 2D canvas, or null when the canvas gives no 2D context. */
export function createInstance(opts: CreateInstanceOptions): Instance | null {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = opts.canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return null;
  const dpr = devicePixelRatioNow();
  return {
    canvas: opts.canvas,
    ctx,
    cssWidth: opts.cssWidth,
    cssHeight: opts.cssHeight,
    dpr: Math.min(dpr, MAX_GL_DPR),
    canvasDpr: Math.min(dpr, MAX_CANVAS_DPR),
    preset: opts.preset,
    cardBgOverride: opts.cardBg ?? null,
    colorsOverride: null,
    strength: Math.max(0, Math.min(2, opts.strength ?? 1)),
    speedMul: opts.speed != null && opts.speed > 0 ? opts.speed : 1,
    pixelScale: opts.pixelScale != null && opts.pixelScale > 0 ? opts.pixelScale : 1,
    uniformsDirty: true,
    reveal: null,
    accumulatedTime: Math.random() * 1000,
  };
}

/** New CSS size (and a fresh look at devicePixelRatio: a monitor swap or zoom moves it). */
export function updateInstanceSize(inst: Instance, cssWidth: number, cssHeight: number): void {
  inst.cssWidth = cssWidth;
  inst.cssHeight = cssHeight;
  const dpr = devicePixelRatioNow();
  inst.dpr = Math.min(dpr, MAX_GL_DPR);
  inst.canvasDpr = Math.min(dpr, MAX_CANVAS_DPR);
  inst.uniformsDirty = true;
}
