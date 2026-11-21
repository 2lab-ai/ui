/**
 * Shared WebGL renderer — one offscreen GL canvas drives every metal element on the page.
 *
 * Ported from metal-fx 2.0.11 `src/engine/renderer/core.ts` (MIT, © Jakub Antalik — https://libraries.dev/metal).
 *
 * Architecture:
 *   1. A single offscreen GL canvas renders Paper's liquidMetal shader — at most one WebGL context for the whole page,
 *      created when the first element needs it and released (WEBGL_lose_context) when the last one disconnects or the
 *      loop has been idle for `IDLE_RELEASE_MS`.
 *   2. Each instance owns a visible 2D canvas that receives a cropped/scaled copy of the GL output with an inner
 *      "hole punch" mask (the ring), or a custom mask (metal text, the badge).
 *   3. Glow sampling reads from a pixel buffer (gl.readPixels) that is refreshed at most every 1500 ms.
 *   4. The animation loop composites at ~15 fps — the blur + slow material motion makes higher rates imperceptible.
 *
 * Changed in the port: the React library draws one preset for the whole page (the last `<MetalFx preset>` to mount
 * wins). Here each instance carries its own `presetKey` (`chromatic/dark`, `gold/light` …) and the loop renders one
 * frame per key in use, each with its own bitmap and readback buffer — so a silver and a gold element can sit side by
 * side. The instance registry outlives the GL objects, so the context can be released while elements stay on the page
 * (they keep their last composited frame) and re-created when one needs a fresh frame.
 */
import { CANONICAL_GL_SIZE, GL_DPR_CAP } from '../perfConfig';
import { PRESETS, type PresetMode, type PresetName, type PresetTheme } from '../presets';
import { compileShader, FRAG_SHADER_SRC, linkProgram, VERT_SHADER_SRC } from '../shaders';

export const CANONICAL_PILL_W = 140;
export const CANONICAL_PILL_H = 40;
export const PILL_SHADER_SCALE = 1.6;
export const CIRCLE_SHADER_SCALE = 1.3;

export interface ShaderRGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Vector deformation hook. Maps a point in the instance's CSS-px box (origin top-left, before any overscan) to its
 * displaced position, writing into `out`. When an instance carries one, the ring mask is built from displaced
 * rounded-rect outlines instead of `roundRect`, so stretch stays anti-aliased at any magnitude.
 */
export type DeformFn = (x: number, y: number, out: { x: number; y: number }) => void;

/**
 * Extra layers drawn into the canvas while deforming — things that live on CSS boxes (root background, `::after` rim,
 * `.mfx-inner` hairline) and therefore can't follow a vector deformation on their own.
 */
export interface DeformLayers {
  /** Fill colour behind the ring (the root background), or null. */
  fill?: string | null;
  /** Inset stroke drawn over the ring. `inset` is the band's inner edge from the outer outline; `width` the band
   *  thickness; CSS px. */
  rim?: { inset: number; width: number; color: string } | null;
  /** Thin stroke at `inset` from the outer outline, under the ring. */
  hairline?: { inset: number; width: number; color: string } | null;
}

/**
 * Custom alpha mask. Paints opaque shapes in *device* px onto a context whose origin is the instance's box top-left;
 * the engine keeps the shader only where the mask painted (`destination-in`). Replaces the ring punch — use it for
 * metal-filled text or glyphs.
 */
export type MaskFn = (ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number) => void;

export interface MetalFxInstance {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cssWidth: number;
  cssHeight: number;
  cornerRadius: number;
  kind: 'pill' | 'circle';
  ringCssPx: number;
  shaderScale: number;
  opacityMul: number;
  /** Extra multiplier on the glow only (halo + catch-light), default 1. */
  glowGain: number;
  visible: boolean;
  /** Per-instance freeze flag. When true the instance's 2D canvas keeps the last copied frame; the shared GL loop
   *  continues for any other unpaused instance. */
  paused: boolean;
  /** Set after the first successful copy — an instance that mounts already paused still gets one frame. */
  everCopied: boolean;
  /** The shader frame this instance froze on when paused. */
  frozen: HTMLCanvasElement | null;
  dpr: number;
  /** Master scale multiplier for absolute-pixel internals (glow stroke widths, reflection stroke band …). */
  scale: number;
  /** Which preset frame this instance composites from: `${PresetName}/${PresetTheme}`. */
  presetKey: string;
  /** The catch-light faces the pointer while it is over this instance's element (the element's `cursorLight`). */
  cursorCatch: boolean;
  onAfterFrame?: () => void;
  /** Fired after every composite, synchronously — for layers that must track the ring exactly. */
  onComposite?: () => void;
  /** One-shot callback fired after the very first copy. */
  onFirstCopy?: () => void;
  /** See `MaskFn`. Takes precedence over the ring punch and over `deform`. */
  mask: MaskFn | null;
  /** Unmasked copy of the metal sheet for masked instances — what a mirror facing the glyphs would see. */
  rawCanvas: HTMLCanvasElement | null;
  wantRaw: boolean;
  /** Ring-only copy while a deform is active (for reflections). */
  ringCanvas: HTMLCanvasElement | null;
  wantRing: boolean;
  /** See `DeformFn`. Null = rigid rounded-rect mask. */
  deform: DeformFn | null;
  deformLayers: DeformLayers | null;
  /** Canvas margin beyond the CSS box, CSS px, so displaced geometry that bulges outward isn't clipped. */
  overscan: number;
  /** Pointer acting as a light source: the outline point nearest the cursor (box-local CSS px) and a 0..1 proximity
   *  weight. Set by the cursor-light tracker; the glow's hotspot faces it. Null when the pointer is away. */
  cursorLight: { x: number; y: number; w: number } | null;
  /** Set by the glow callback when its envelope is mid-fade: the loop then ticks the glow every animation frame. */
  glowFast: boolean;
}

/** One preset's last rendered frame and its readback buffer. */
export interface PresetFrame {
  key: string;
  mode: PresetMode;
  /** The frame, transferred from the OffscreenCanvas. */
  bitmap: ImageBitmap | null;
  /** The frame, copied from an HTML GL canvas (browsers without OffscreenCanvas WebGL). */
  snapshot: HTMLCanvasElement | null;
  pixels: Uint8Array;
  pixelsW: number;
  pixelsH: number;
  lastReadbackMs: number;
  drawn: boolean;
}

export interface SharedRenderer {
  glCanvas: HTMLCanvasElement | OffscreenCanvas;
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  buffer: WebGLBuffer;
  uniforms: Record<string, WebGLUniformLocation | null>;
  /** 1×1 placeholder bound to `u_image`; see buildGLPipeline. */
  dummyTexture: WebGLTexture | null;
  /** The preset whose uniforms are on the program now; another key re-uploads. */
  uploadedKey: string | null;
  contextLost: boolean;
  useOffscreen: boolean;
  startMs: number;
  pausedMs: number;
  pausedAtMs: number | null;
  rafId: number;
  dpr: number;
  instances: Set<MetalFxInstance>;
  frameCount: number;
  glowQueue: MetalFxInstance[];
  glowIdx: number;
  glowSkip: number;
  frames: Map<string, PresetFrame>;
}

export let SHARED: SharedRenderer | null = null;

/** Every live instance, whether or not the GL objects exist right now (they are released on long idle). */
export const INSTANCES: Set<MetalFxInstance> = new Set();
/** Instances with a glow, in registration order. */
export const GLOW_QUEUE: MetalFxInstance[] = [];

/** The page's animation clock starts once, so a released-and-recreated renderer keeps its time. */
let epochMs = -1;

export const presetKey = (name: PresetName, theme: PresetTheme): string => `${name}/${theme}`;

/** The preset mode a key names (`chromatic/dark` …); unknown keys fall back to chromatic/dark. */
export function presetModeFor(key: string): PresetMode {
  const [name, theme] = key.split('/') as [PresetName, PresetTheme];
  return PRESETS[name]?.modes[theme] ?? PRESETS.chromatic.modes.dark;
}

let _supported: boolean | null = null;
/**
 * Whether this browser can run the engine (WebGL2). Cached after the first call. The elements use it to choose the
 * CSS fallback instead of throwing.
 */
export function isMetalFxSupported(): boolean {
  if (_supported !== null) return _supported;
  if (typeof document === 'undefined') {
    _supported = false;
    return _supported;
  }
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') as WebGL2RenderingContext | null;
    _supported = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    _supported = false;
  }
  return _supported;
}

/** Forget the cached support answer (tests, or after the page regained a GPU). */
export function resetMetalFxSupport(): void {
  _supported = null;
}

// Called by the contextrestored listener to restart the loop after the browser restored the context.
let _onContextRestored: (() => void) | null = null;
export function setContextRestoredCallback(cb: (() => void) | null): void {
  _onContextRestored = cb;
}

// Called when the browser takes the context away; the loop uses it to stop and to start a recovery (re-create the
// context itself if the browser never restores it).
let _onContextLost: (() => void) | null = null;
export function setContextLostCallback(cb: (() => void) | null): void {
  _onContextLost = cb;
}

/** Whether the renderer can draw: false after a lost context or a failed (re)creation, true again once it can. */
type RendererListener = (ok: boolean) => void;
const rendererListeners = new Set<RendererListener>();
let rendererOk = true;

/** Subscribe to renderer health — the elements switch to their CSS fallback while it is false. */
export function onRendererState(fn: RendererListener): () => void {
  rendererListeners.add(fn);
  return () => {
    rendererListeners.delete(fn);
  };
}

export function rendererHealthy(): boolean {
  return rendererOk;
}

export function setRendererState(ok: boolean): void {
  if (ok === rendererOk) return;
  rendererOk = ok;
  for (const fn of rendererListeners) {
    try {
      fn(ok);
    } catch {
      /* a listener must not break the others */
    }
  }
}

const UNIFORM_NAMES = [
  // Fragment stage (Paper liquidMetal)
  'u_resolution',
  'u_time',
  'u_pixelRatio',
  'u_colorBack',
  'u_colorTint',
  'u_repetition',
  'u_softness',
  'u_shiftRed',
  'u_shiftBlue',
  'u_distortion',
  'u_contour',
  'u_angle',
  'u_shape',
  'u_isImage',
  'u_image',
  // Vertex stage (Paper sizing)
  'u_originX',
  'u_originY',
  'u_worldWidth',
  'u_worldHeight',
  'u_fit',
  'u_scale',
  'u_rotation',
  'u_offsetX',
  'u_offsetY',
  'u_imageAspectRatio',
];

/**
 * Paper's shader writes premultiplied color (`color *= opacity` before the backdrop composite), so the blend func has
 * to be ONE / 1-SRC_ALPHA. Pairing premultiplied output with the classic SRC_ALPHA factor double-darkens every
 * partially-transparent pixel — which on a 1px ring is the whole thing.
 */
function buildGLPipeline(gl: WebGL2RenderingContext): {
  program: WebGLProgram;
  buffer: WebGLBuffer;
  uniforms: Record<string, WebGLUniformLocation | null>;
  dummyTexture: WebGLTexture | null;
} {
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SHADER_SRC);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SHADER_SRC);
  const program = linkProgram(gl, vert, frag);
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  if (!buffer) throw new Error('ui-metal: gl.createBuffer returned null');
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  // Paper declares `a_position` as vec4; feeding 2 floats leaves z=0, w=1, the full-screen quad the shader expects.
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const n of UNIFORM_NAMES) uniforms[n] = gl.getUniformLocation(program, n);

  // `u_image` is dead at u_isImage=false, but an unbound sampler2D is undefined behaviour and renders black on some
  // drivers. Bind 1×1 opaque black to texture unit 0 and leave it there for the life of the program.
  const dummyTexture = gl.createTexture();
  if (dummyTexture) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, dummyTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (uniforms.u_image) gl.uniform1i(uniforms.u_image, 0);
  }

  return { program, buffer, uniforms, dummyTexture };
}

/** The per-preset frame for `key`, created on first use. Null while the renderer is released. */
export function presetFrame(key: string): PresetFrame | null {
  if (!SHARED) return null;
  let f = SHARED.frames.get(key);
  if (!f) {
    const w = SHARED.glCanvas.width;
    const h = SHARED.glCanvas.height;
    f = {
      key,
      mode: presetModeFor(key),
      bitmap: null,
      snapshot: null,
      pixels: new Uint8Array(w * h * 4),
      pixelsW: w,
      pixelsH: h,
      lastReadbackMs: 0,
      drawn: false,
    };
    SHARED.frames.set(key, f);
  }
  return f;
}

/** The frame an instance composites from, if it has been drawn. */
export function frameSource(inst: MetalFxInstance): CanvasImageSource | null {
  const f = SHARED?.frames.get(inst.presetKey);
  if (!f || !f.drawn) return null;
  return f.bitmap ?? f.snapshot;
}

/** Drop frames no instance uses any more. */
export function pruneFrames(): void {
  if (!SHARED) return;
  const used = new Set<string>();
  for (const inst of INSTANCES) used.add(inst.presetKey);
  for (const [key, f] of SHARED.frames) {
    if (used.has(key)) continue;
    f.bitmap?.close();
    SHARED.frames.delete(key);
  }
}

export function ensureSharedRenderer(): SharedRenderer {
  if (SHARED) return SHARED;

  const dpr = Math.min(GL_DPR_CAP, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const size = Math.round(CANONICAL_GL_SIZE * dpr);
  const useOffscreen = typeof OffscreenCanvas !== 'undefined';

  let glCanvas: HTMLCanvasElement | OffscreenCanvas;
  let gl: WebGL2RenderingContext | null;

  // WebGL2 is required, not preferred: Paper's shaders are `#version 300 es` and use textureSize/fwidth/textureGrad.
  if (useOffscreen) {
    glCanvas = new OffscreenCanvas(size, size);
    gl = glCanvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    }) as WebGL2RenderingContext | null;
  } else {
    const htmlCanvas = document.createElement('canvas');
    htmlCanvas.width = size;
    htmlCanvas.height = size;
    gl = htmlCanvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
    }) as WebGL2RenderingContext | null;
    glCanvas = htmlCanvas;
  }
  if (!gl) throw new Error('ui-metal: WebGL2 not supported');

  let pipeline: ReturnType<typeof buildGLPipeline>;
  try {
    pipeline = buildGLPipeline(gl);
  } catch (err) {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    throw err;
  }
  const { program, buffer, uniforms, dummyTexture } = pipeline;

  const onContextLost = (e: Event) => {
    e.preventDefault();
    if (SHARED && SHARED.gl === gl) {
      SHARED.contextLost = true;
      setRendererState(false);
      _onContextLost?.();
    }
  };
  const onContextRestored = () => {
    if (!SHARED || SHARED.gl !== gl) return;
    try {
      const rebuilt = buildGLPipeline(SHARED.gl);
      SHARED.program = rebuilt.program;
      SHARED.buffer = rebuilt.buffer;
      SHARED.uniforms = rebuilt.uniforms;
      SHARED.dummyTexture = rebuilt.dummyTexture;
      SHARED.uploadedKey = null;
      SHARED.contextLost = false;
      setRendererState(true);
      _onContextRestored?.();
    } catch {
      /* stays lost: the elements keep their CSS fallback */
    }
  };
  glCanvas.addEventListener('webglcontextlost', onContextLost as EventListener, false);
  glCanvas.addEventListener('webglcontextrestored', onContextRestored as EventListener, false);

  const now = performance.now();
  if (epochMs < 0) epochMs = now;
  SHARED = {
    glCanvas,
    gl,
    program,
    buffer,
    uniforms,
    dummyTexture,
    uploadedKey: null,
    contextLost: false,
    useOffscreen,
    startMs: epochMs,
    pausedMs: 0,
    pausedAtMs: null,
    rafId: 0,
    dpr,
    instances: INSTANCES,
    frameCount: 0,
    glowQueue: GLOW_QUEUE,
    glowIdx: 0,
    glowSkip: 0,
    frames: new Map(),
  };
  setRendererState(true);
  return SHARED;
}

/** Release the GL objects and the context. Instances stay registered and keep their last composited frame. */
export function teardownSharedRenderer(): void {
  if (!SHARED) return;
  const { gl, program, buffer, frames, dummyTexture } = SHARED;
  try {
    for (const f of frames.values()) f.bitmap?.close();
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    if (dummyTexture) gl.deleteTexture(dummyTexture);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    /* swallow */
  }
  SHARED = null;
}
