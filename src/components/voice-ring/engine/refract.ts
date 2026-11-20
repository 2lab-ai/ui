// Ported from Libraries.dev `voice-ring` 0.2.0 `src/engine/refract.ts` (MIT, © 2026 Jakub Antalik —
// https://libraries.dev/voice-ring), its shader verbatim; the lens is per element now (WebGL 2, released on disconnect).
// Refraction at the screen's edge: where a luminous orb presses on the edge,
// its pixels are drawn through a lens there, as a card is pulled into the
// edge of a carousel. Toward the edge the image is stretched out across the
// gap the orb rests short by and opened a little taller, red and blue part
// as glass disperses them, and it blurs, more the nearer the edge — a
// progressive blur drawn out toward the edge. A post-process on the canvas
// already painted, in WebGL 2 (the GLSL ES 1.0 shader runs there too); without it the orb is left as painted.

import type { OrbLens } from './core';

const VERTEX = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x + 1.0, 1.0 - aPos.y) * 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// Mirrored in swift/Sources/VoiceCore/Render/Refract.metal.
const FRAGMENT = `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uSize;
uniform float uWall, uSide, uZone, uGap, uFlare, uSplit, uBlur, uCy;
varying vec2 vUv;
const int TAPS = 16;
vec4 tap(vec2 p) { return texture2D(uTex, p / uSize); }
void main() {
  vec2 p = vUv * uSize;
  // 0 a zone back from the edge … 1 at it and past it
  float t = clamp(1.0 - (uWall - p.x) * uSide / uZone, 0.0, 1.0);
  if (t <= 0.0) { gl_FragColor = tap(p); return; }
  float w = t * t;
  // drawn out across the gap toward the edge, and opened a little taller
  float d = (uWall - p.x) * uSide + uGap * w;
  vec2 s = vec2(uWall - uSide * d, uCy + (p.y - uCy) / (1.0 + uFlare * w));
  // dispersion: red bent further out than blue, along the stretch and the flare
  vec2 split = vec2(uSide, 0.6 * (p.y - uCy) / uZone) * uSplit * w;
  // the blur grows toward the edge, drawn out along the stretch
  float b = uBlur * w;
  vec3 rgb = vec3(0.0);
  float a = 0.0;
  for (int i = 0; i < TAPS; i++) {
    float f = float(i);
    float r = sqrt((f + 0.5) / float(TAPS)) * b;
    vec2 o = vec2(cos(f * 2.39996) * 1.8, sin(f * 2.39996)) * r;
    vec4 cr = tap(s + o + split);
    vec4 cg = tap(s + o);
    vec4 cb = tap(s + o - split);
    rgb += vec3(cr.r, cg.g, cb.b);
    a += max(cg.a, max(cr.a, cb.a));
  }
  gl_FragColor = vec4(rgb, a) / float(TAPS);
}`;

interface LensGl {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  source: HTMLCanvasElement;
  tex: WebGLTexture;
  u: Record<string, WebGLUniformLocation | null>;
}

function makeLens(onLost: () => void): LensGl | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false, depth: false });
  } catch {
    gl = null;
  }
  if (!gl) return null;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    onLost();
  });
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  };
  const prog = gl.createProgram();
  const vs = compile(gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  if (!prog || !vs || !fs) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture();
  if (!tex) return null;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const u: LensGl['u'] = {};
  for (const n of ['uSize', 'uWall', 'uSide', 'uZone', 'uGap', 'uFlare', 'uSplit', 'uBlur', 'uCy']) {
    u[n] = gl.getUniformLocation(prog, n);
  }
  return { gl, canvas, source: document.createElement('canvas'), tex, u };
}

/**
 * One element's lens: a WebGL 2 context created the first time its orb presses on an edge, released with
 * `release()` (on disconnect, and when the element's loop stops). Without WebGL 2, or after a lost context, it
 * stays off and the orb is left as painted — never an exception.
 */
export class EdgeLens {
  #gl: LensGl | null = null;
  /** No WebGL 2 here, or the context was lost: the lens stays off. */
  #off = false;

  /** Whether a context is held now. */
  get active(): boolean {
    return this.#gl != null;
  }

  /** Whether the lens has given up (no WebGL 2, or a lost context). */
  get unavailable(): boolean {
    return this.#off;
  }

  /** Let the context go (WEBGL_lose_context); the next press creates a new one. */
  release(): void {
    const l = this.#gl;
    this.#gl = null;
    if (!l) return;
    try {
      l.gl.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      /* already gone */
    }
    l.canvas.width = 1;
    l.canvas.height = 1;
  }

  /**
   * Refract what `ctx` already holds where the orb meets the edge — `side` (−1 left, 1 right) at `x` — through `L`,
   * all in the context's current coordinates. Returns false when it could not (no WebGL 2, a lost context).
   */
  draw(ctx: CanvasRenderingContext2D, side: number, x: number, L: OrbLens): boolean {
    if (this.#off) return false;
    if (!this.#gl) {
      this.#gl = makeLens(() => {
        this.#off = true;
        this.#gl = null;
      });
      if (!this.#gl) {
        this.#off = true;
        return false;
      }
    }
    const { gl, canvas, source, tex, u } = this.#gl;
    if (gl.isContextLost()) {
      this.#off = true;
      this.#gl = null;
      return false;
    }
    const m = ctx.getTransform();
    const px = Math.hypot(m.a, m.b) || 1;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const wall = m.a * x + m.e;
    const zone = L.zone * px;
    const blur = L.blur * px;
    // the device pixels the lens covers and reads: a zone back from the edge, and the blur's reach beyond that, out
    // to the canvas's side
    const x0 = Math.max(0, Math.floor(side > 0 ? wall - zone - 2 * blur - 4 : 0));
    const x1 = Math.min(W, Math.ceil(side > 0 ? W : wall + zone + 2 * blur + 4));
    const w = x1 - x0;
    if (w < 2 || H < 2) return false;
    if (source.width !== w || source.height !== H) {
      source.width = w;
      source.height = H;
    }
    const s2 = source.getContext('2d');
    if (!s2) return false;
    s2.clearRect(0, 0, w, H);
    s2.drawImage(ctx.canvas, x0, 0, w, H, 0, 0, w, H);
    if (canvas.width !== w || canvas.height !== H) {
      canvas.width = w;
      canvas.height = H;
    }
    gl.viewport(0, 0, w, H);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform2f(u.uSize, w, H);
    gl.uniform1f(u.uWall, wall - x0);
    gl.uniform1f(u.uSide, side);
    gl.uniform1f(u.uZone, zone);
    gl.uniform1f(u.uGap, L.gap * px);
    gl.uniform1f(u.uFlare, L.flare);
    gl.uniform1f(u.uSplit, L.split * px);
    gl.uniform1f(u.uBlur, blur);
    gl.uniform1f(u.uCy, m.d * L.cy + m.f);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'copy';
    ctx.beginPath();
    ctx.rect(x0, 0, w, H);
    ctx.clip();
    ctx.drawImage(canvas, x0, 0);
    ctx.restore();
    return true;
  }
}
