/**
 * The img-fx shaders (`src/engine/shaders.ts` of img-fx 0.5.2, MIT, © 2026 Jakub Antalik — lifted there from its
 * `image.html`), moved from three.js's ShaderMaterial (GLSL 1.00 with three's prelude) to plain GLSL ES 3.00 for a
 * raw WebGL 2 context: `#version 300 es` + precision, an `in vec2 position` quad instead of three's `position`
 * attribute, `out vec4` for `gl_FragColor`, `texture()` for `texture2D()`, and `IMGFX_PASS` set by the program
 * builder instead of three's `defines`. Every line of maths is the library's.
 *
 * Only the three effects the bundled presets draw are kept — 11 (Nebula), 22 (Chromium Flow) and 25 (Gradient
 * Sweep) — with the helpers they call; the library's other 23 branches are unreachable without its page-wide custom
 * fragment-shader escape hatch, which this port leaves out.
 */

export const VERT_SRC = /* glsl */ `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

/** The fragment stage, without its `#version` / pass header (see `fragmentSource`). */
export const FRAG_BODY = /* glsl */ `
  uniform vec2 u_resolution;
  uniform float u_dpr;
  uniform float u_time;
  uniform vec3 u_color1, u_color2, u_color3, u_color4, u_color5, u_color6, u_color7, u_cardBg;
  uniform float u_alpha1, u_alpha2, u_alpha3, u_alpha4, u_alpha5, u_alpha6, u_alpha7;
  uniform float u_speed, u_intensity, u_scale, u_direction;
  uniform float u_softness, u_distortion, u_complexity, u_shape, u_flicker;
  uniform float u_vignette, u_vigOpacity, u_blur, u_highlight, u_shaderOpacity;
  uniform float u_cellSize, u_gap, u_dotSize, u_dotSoftness, u_dotOpacity, u_hlScale, u_fillOpacity, u_edgeFade, u_fadeStr;
  uniform float u_dotMode;
  uniform int u_effect;
  uniform int u_sweepEase;
  // Two-pass mosaic (see the mosaic stages above main). Unused by IMGFX_PASS 0.
  uniform vec2 u_grid;
  uniform vec2 u_fieldSize;
  uniform highp sampler2D u_field;
  out vec4 imgfx_fragColor;

  // Reference card edge length (CSS px) at which the original preset cellSize
  // gives the canonical cell count. Cell PIXEL size stays constant across card
  // sizes by scaling gridSize proportionally to (currentCssDim / REF_DIM).
  const float REF_DIM = 320.0;

  /** Anisotropic cell count: returns the number of cells along x and y so that
   *  each cell stays SQUARE in screen space regardless of the card's aspect
   *  ratio. */
  vec2 gridCounts(float baseCount) {
    vec2 cssRes = u_resolution / max(u_dpr, 0.0001);
    return max(vec2(2.0), floor(baseCount * cssRes / REF_DIM));
  }

  vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec2 mod289v2(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289((x * 34.0 + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289v2(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x_) - 0.5;
    vec3 ox = floor(x_ + 0.5);
    vec3 a0 = x_ - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 p, float oct) {
    float val = 0.0, amp = 0.5;
    int n = int(oct);
    for (int i = 0; i < 4; i++) {
      if (i >= n) break;
      val += amp * snoise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return val;
  }

  float nfbm(vec2 p) { return fbm(p, 2.0 + u_complexity * 2.0); }

  vec3 palette(float t) {
    t = clamp(t, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    float k = 64.0;
    float w1 = u_alpha1 * exp(-k * t * t);
    float w2 = u_alpha2 * exp(-k * (t - 0.25) * (t - 0.25));
    float w3 = u_alpha3 * exp(-k * (t - 0.5)  * (t - 0.5));
    float w4 = u_alpha4 * exp(-k * (t - 0.75) * (t - 0.75));
    float w5 = u_alpha5 * exp(-k * (t - 1.0)  * (t - 1.0));
    float total = w1 + w2 + w3 + w4 + w5 + 0.0001;
    return (u_color1*w1 + u_color2*w2 + u_color3*w3 + u_color4*w4 + u_color5*w5) / total;
  }

  vec3 softBlend(float a, float b, float c) {
    a = clamp(a, 0.0, 1.0); a *= a;
    b = clamp(b, 0.0, 1.0); b *= b;
    c = clamp(c, 0.0, 1.0); c *= c;
    float d = clamp(a * 0.7 + c * 0.3, 0.0, 1.0); d *= d;
    float e = clamp(b * 0.5 + c * 0.5, 0.0, 1.0); e *= e;
    a *= u_alpha1; b *= u_alpha2; c *= u_alpha3; d *= u_alpha4; e *= u_alpha5;
    float total = a + b + c + d + e;
    float floorW = max(0.001 - total, 0.0);
    vec3 fallback = (u_color1 + u_color2 + u_color3 + u_color4 + u_color5) * 0.2;
    return (u_color1 * a + u_color2 * b + u_color3 * c + u_color4 * d + u_color5 * e + fallback * floorW) / (total + floorW);
  }

  vec2 warp(vec2 p, float t) {
    float str = u_distortion * 2.0;
    return vec2(
      nfbm(p + vec2(t * 0.1, 0.0)),
      nfbm(p + vec2(0.0, t * 0.12) + 5.0)
    ) * str;
  }

  float sweepEase(float x) {
    if (u_sweepEase == 1) return x * x * (3.0 - 2.0 * x);
    if (u_sweepEase == 2) {
      float p = 1.0 - x;
      return 1.0 - p * p * p;
    }
    if (u_sweepEase == 3) {
      return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) * 0.5;
    }
    if (u_sweepEase == 4) return 1.0 - pow(2.0, -10.0 * x) * (1.0 - x);
    return x;
  }

  vec3 computeEffect(vec2 uv, float aspect, float t, float dist, float soft, float cpx, float shp) {
    vec2 p = (uv - 0.5) * u_scale;
    p.x *= aspect;
    p += vec2(cos(u_direction), sin(u_direction)) * t * 0.15;
    vec3 col = vec3(0.0);

    if (u_effect == 11) {
      vec2 q = vec2(nfbm(p * 0.5 + vec2(t * 0.05, 0.0)), nfbm(p * 0.5 + vec2(0.0, t * 0.07)));
      vec2 r = vec2(nfbm(p * 0.6 + q * (1.0 + dist * 1.5) + vec2(1.7, 9.2) + t * 0.03), nfbm(p * 0.6 + q * (1.0 + dist * 1.5) + vec2(8.3, 2.8) + t * 0.04));
      float f = nfbm(p + r * 1.5);
      float f2 = nfbm(p * 0.7 + r + vec2(3.0, 7.0));
      col = softBlend((f * 0.5 + 0.5) * u_intensity, (f2 * 0.5 + 0.5) * u_intensity, (nfbm(p * 0.4 - t * 0.02) * 0.5 + 0.5) * u_intensity);

    } else if (u_effect == 22) {
      vec2 w  = warp(p * 0.7, t * 0.5);
      vec2 w2 = warp(p * 0.4 + w * 0.3, t * 0.3);
      vec2 wp = p + w * (0.4 + dist * 0.6);
      float n1 = snoise(wp * (1.4 + cpx * 1.6) + t * 0.14);
      float n2 = snoise((wp + w2 * dist * 0.4) * (2.0 + cpx * 2.0) + vec2(3.0, 7.0) - t * 0.1);
      float ridge1 = 1.0 - abs(n1);
      ridge1 = pow(ridge1, 5.0 + shp * 12.0);
      float ridge2 = 1.0 - abs(n2);
      ridge2 = pow(ridge2, 4.0 + shp * 10.0);
      float base = (n1 + n2) * 0.25 + 0.5;
      float w1 = (base * 0.6 + ridge1 * 1.2) * u_intensity;
      float w2c = ((1.0 - base) * 0.6 + ridge2 * 1.0) * u_intensity;
      float w3 = (ridge1 * 0.8 + ridge2 * 0.6) * u_intensity;
      col = softBlend(w1, w2c, w3);

    } else if (u_effect == 25) {
      float d = (uv.x + (1.0 - uv.y)) * 0.5;
      float w = 0.9 / max(u_scale, 0.25);
      float cyc = t * 0.08;
      float pA = mix(-w, 1.0 + w, sweepEase(fract(cyc)));
      float pB = mix(-w, 1.0 + w, sweepEase(fract(cyc + 0.5)));
      float band = max(
        clamp(1.0 - abs(d - pA) / w, 0.0, 1.0),
        clamp(1.0 - abs(d - pB) / w, 0.0, 1.0)
      );
      float v = band * u_intensity;

      vec2 ggs = gridCounts(6.0 + u_cellSize * 74.0);
      if (u_dotMode > 1.5) {
        ggs = max(vec2(2.0), floor(ggs * (1.0 - u_gap * 0.8)));
      }
      vec2 cell = floor(uv * ggs);
      float clk = t * 1.6;
      // Wrap the stepped clock to keep sin() arguments small. u_time grows
      // unbounded over a session; on mediump-float GPUs large hash inputs lose
      // precision and the flicker bands/freezes. mod(x, 1024) keeps the
      // crossfade continuous across the wrap.
      float step0 = mod(floor(clk), 1024.0);
      float step1 = mod(step0 + 1.0, 1024.0);
      float fz = smoothstep(0.0, 1.0, fract(clk));
      float cellSeed = dot(cell, vec2(127.1, 311.7));
      float r1 = fract(sin(cellSeed + step0 * 17.23) * 43758.5453);
      float r2 = fract(sin(cellSeed + step1 * 17.23) * 43758.5453);
      float rnd = mix(r1, r2, fz);
      v += (rnd - 0.5) * u_flicker * 0.9 * (0.15 + band * 0.85);

      col = palette(clamp(v, 0.0, 1.0));
    }

    return col;
  }

  // ── Mosaic stages ─────────────────────────────────────────────────────────
  // In the pixel mosaic everything except the per-pixel cell mask is constant
  // across a cell: the effect colour, its blur taps and the highlight wave are
  // all sampled at the cell centre. IMGFX_PASS 1 evaluates the cell field once
  // per cell into a tiny gridX×gridY target, IMGFX_PASS 2 shades every pixel
  // from it — the same image as the single pass (IMGFX_PASS 0).

  /** Mosaic grid (cells along x / y) of the active mosaic mode. */
  vec2 imgfx_mosaicGrid() {
    vec2 gs = gridCounts(6.0 + u_cellSize * 74.0);
    if (u_dotMode > 1.5) {
      gs = max(vec2(2.0), floor(gs * (1.0 - u_gap * 0.8)));
    }
    return gs;
  }

  /** Effect colour at sampleUV, with the optional 5-tap blur. */
  vec3 imgfx_effectColor(vec2 sampleUV, float aspect, float t) {
    float dist = u_distortion;
    float soft = u_softness;
    float cpx = u_complexity;
    float shp = u_shape;
    if (u_blur < 0.01) {
      return computeEffect(sampleUV, aspect, t, dist, soft, cpx, shp);
    }
    float r = u_blur * 0.02;
    vec3 col = computeEffect(sampleUV, aspect, t, dist, soft, cpx, shp) * 0.4;
    col += computeEffect(sampleUV + vec2( r,  0.0), aspect, t, dist, soft, cpx, shp) * 0.15;
    col += computeEffect(sampleUV + vec2(-r,  0.0), aspect, t, dist, soft, cpx, shp) * 0.15;
    col += computeEffect(sampleUV + vec2( 0.0,  r), aspect, t, dist, soft, cpx, shp) * 0.15;
    col += computeEffect(sampleUV + vec2( 0.0, -r), aspect, t, dist, soft, cpx, shp) * 0.15;
    return col;
  }

  /** Highlight wave weight of the cell centred at cellCenter. */
  float imgfx_cellHighlight(vec2 cellCenter, float aspect, float t) {
    if (u_highlight <= 0.01 && u_hlScale <= 0.01) return 0.0;
    vec2 cp2 = (cellCenter - 0.5) * u_scale;
    cp2.x *= aspect;
    float lw = sin(cp2.x * 3.0 + t * 1.5) * 0.5 + 0.5;
    lw *= sin(cp2.y * 2.5 - t * 1.1) * 0.5 + 0.5;
    lw += (snoise(cp2 * 2.0 + t * 0.6) * 0.5 + 0.5) * 0.3;
    float hlFactor = clamp(lw, 0.0, 1.0);
    return hlFactor * hlFactor;
  }

  /** Per-pixel stage: vignette, colour alpha and — in mosaic modes — the
   *  cell mask, highlight and edge fade. */
  vec4 imgfx_shade(vec2 uv, vec3 col, float hlFactor, vec2 gridSize) {
    vec3 baseCol = col;
    if (u_dotMode < 0.5) {
      col = pow(col, vec3(1.3));
    }

    // CSS-pixel distance to the nearest edge — keeps the vignette / edge-fade
    // bands a consistent physical width on every side of any aspect ratio.
    vec2 cssRes = u_resolution / max(u_dpr, 0.0001);
    vec2 cssCoord = uv * cssRes;
    float edgeDistPx = min(
      min(cssCoord.x, cssRes.x - cssCoord.x),
      min(cssCoord.y, cssRes.y - cssCoord.y)
    );
    float vigRangePx = 40.0 * (1.0 + u_vignette * 3.0);
    float vig = (edgeDistPx * edgeDistPx) / (vigRangePx * vigRangePx);
    vig = smoothstep(0.0, 1.0, vig);
    col *= mix(1.0, vig, u_vignette * u_vigOpacity);

    float colorAlpha = (u_alpha1 + u_alpha2 + u_alpha3 + u_alpha4 + u_alpha5) / 5.0;
    if (colorAlpha < 0.999) {
      vec3 c1d = col - u_color1, c2d = col - u_color2, c3d = col - u_color3, c4d = col - u_color4, c5d = col - u_color5;
      float prox1 = exp(-8.0 * dot(c1d, c1d));
      float prox2 = exp(-8.0 * dot(c2d, c2d));
      float prox3 = exp(-8.0 * dot(c3d, c3d));
      float prox4 = exp(-8.0 * dot(c4d, c4d));
      float prox5 = exp(-8.0 * dot(c5d, c5d));
      float pTotal = prox1 + prox2 + prox3 + prox4 + prox5 + 0.0001;
      colorAlpha = (prox1*u_alpha1 + prox2*u_alpha2 + prox3*u_alpha3 + prox4*u_alpha4 + prox5*u_alpha5) / pTotal;
    }
    float alpha = colorAlpha;

    if (u_dotMode > 0.5) {
      vec2 cellLocal = fract(uv * gridSize);

      float scaleBoost = 1.0 + smoothstep(0.2, 0.8, hlFactor) * u_hlScale * 1.2;

      float mask = 1.0;
      if (u_dotMode < 1.5) {
        float gapW = u_gap * 0.35 / scaleBoost;
        if (gapW > 0.003) {
          mask = step(gapW, cellLocal.x) * step(gapW, 1.0 - cellLocal.x)
               * step(gapW, cellLocal.y) * step(gapW, 1.0 - cellLocal.y);
        }
      } else {
        vec2 cellPx = u_resolution / gridSize;
        vec2 pxOffset = (cellLocal - 0.5) * cellPx;
        float dPx = length(pxOffset);
        float minCellPx = min(cellPx.x, cellPx.y);
        float radiusPx = u_dotSize * 0.5 * minCellPx * scaleBoost;
        float aaPx = 0.5;
        float softPx = u_dotSoftness * 0.2 * minCellPx;
        float edgePx = max(aaPx, softPx);
        mask = 1.0 - smoothstep(radiusPx - edgePx, radiusPx + edgePx, dPx);
      }

      if (u_highlight > 0.01) {
        float hl = hlFactor * u_highlight;
        col = col * (1.0 + hl * 2.5) + vec3(hl * hl * 0.3);
      }

      if (u_edgeFade > 0.5 && u_fadeStr > 0.005) {
        float ef = smoothstep(0.0, u_edgeFade, edgeDistPx);
        mask *= mix(1.0, ef, u_fadeStr);
      }

      float baseOpacity = (u_dotMode < 1.5) ? u_fillOpacity : 0.0;
      alpha = colorAlpha * mix(baseOpacity, u_dotOpacity, mask);

      float bgLum  = dot(u_cardBg, vec3(0.299, 0.587, 0.114));
      float colLum = dot(baseCol, vec3(0.299, 0.587, 0.114));
      alpha *= smoothstep(0.0, 0.33, abs(colLum - bgLum));
    }

    return vec4(col, alpha * u_shaderOpacity);
  }

  void main() {
    float aspect = u_resolution.x / u_resolution.y;
    float t = u_time * u_speed;
  #if IMGFX_PASS == 1
    // Cell field: one fragment per cell (viewport = u_grid), so the fragment
    // coordinate is the cell centre in grid units.
    vec2 cellCenter = gl_FragCoord.xy / u_grid;
    imgfx_fragColor = vec4(imgfx_effectColor(cellCenter, aspect, t), imgfx_cellHighlight(cellCenter, aspect, t));
  #elif IMGFX_PASS == 2
    // Composite: every pixel reads its cell's field texel.
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 field = texture(u_field, (floor(uv * u_grid) + 0.5) / u_fieldSize);
    imgfx_fragColor = imgfx_shade(uv, field.rgb, field.a, u_grid);
  #else
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 gridSize = imgfx_mosaicGrid();
    vec2 sampleUV = uv;
    float hlFactor = 0.0;
    if (u_dotMode > 0.5) {
      sampleUV = (floor(uv * gridSize) + vec2(0.5)) / gridSize;
      hlFactor = imgfx_cellHighlight(sampleUV, aspect, t);
    }
    imgfx_fragColor = imgfx_shade(uv, imgfx_effectColor(sampleUV, aspect, t), hlFactor, gridSize);
  #endif
  }
`;

/** Kind of every uniform the fragment stage reads, by name — what the renderer uploads and how. */
export const UNIFORMS = {
  u_resolution: 'vec2',
  u_dpr: 'float',
  u_time: 'float',
  u_color1: 'vec3',
  u_color2: 'vec3',
  u_color3: 'vec3',
  u_color4: 'vec3',
  u_color5: 'vec3',
  u_color6: 'vec3',
  u_color7: 'vec3',
  u_cardBg: 'vec3',
  u_alpha1: 'float',
  u_alpha2: 'float',
  u_alpha3: 'float',
  u_alpha4: 'float',
  u_alpha5: 'float',
  u_alpha6: 'float',
  u_alpha7: 'float',
  u_speed: 'float',
  u_intensity: 'float',
  u_scale: 'float',
  u_direction: 'float',
  u_softness: 'float',
  u_distortion: 'float',
  u_complexity: 'float',
  u_shape: 'float',
  u_flicker: 'float',
  u_vignette: 'float',
  u_vigOpacity: 'float',
  u_blur: 'float',
  u_highlight: 'float',
  u_shaderOpacity: 'float',
  u_cellSize: 'float',
  u_gap: 'float',
  u_dotSize: 'float',
  u_dotSoftness: 'float',
  u_dotOpacity: 'float',
  u_hlScale: 'float',
  u_fillOpacity: 'float',
  u_edgeFade: 'float',
  u_fadeStr: 'float',
  u_dotMode: 'float',
  u_sweepEase: 'int',
  u_grid: 'vec2',
  u_fieldSize: 'vec2',
  u_field: 'sampler',
} as const;

export type UniformName = keyof typeof UNIFORMS;

const EFFECT_BRANCH = /\bif\s*\(\s*u_effect\s*==\s*(\d+)\s*\)\s*\{/;
const EFFECT_ELSE_BRANCH = /^\s*else\s+if\s*\(\s*u_effect\s*==\s*(\d+)\s*\)\s*\{/;

/** Index of the `}` closing the `{` at `open`, or -1. */
function matchingBrace(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return i;
  }
  return -1;
}

/**
 * Specialise a fragment source to a single effect (img-fx's `specializeEffect`, verbatim). `u_effect` becomes a
 * compile-time constant and the `if (u_effect == N) {…} else if …` chain is cut down to the one branch that runs, so
 * the driver compiles one effect instead of all of them. A source without `uniform int u_effect;` comes back as is.
 */
export function specializeEffect(src: string, effect: number): string {
  const decl = /uniform\s+int\s+u_effect\s*;/;
  if (!decl.test(src)) return src;
  const out = src.replace(decl, `const int u_effect = ${effect | 0};`);

  const head = EFFECT_BRANCH.exec(out);
  if (!head) return out;
  const start = head.index;
  let open = start + head[0].length - 1;
  let body = '{}';
  let end = -1;
  let n = Number(head[1]);
  for (;;) {
    const close = matchingBrace(out, open);
    if (close < 0) return out;
    if (n === effect) body = out.slice(open, close + 1);
    end = close + 1;
    const next = EFFECT_ELSE_BRANCH.exec(out.slice(end));
    if (!next) break;
    n = Number(next[1]);
    open = end + next[0].length - 1;
  }
  // A trailing plain `else` can't be cut cleanly — the constant alone still lets the compiler fold the chain.
  if (/^\s*else\b/.test(out.slice(end))) return out;
  return out.slice(0, start) + body + out.slice(end);
}

/** The complete fragment program for `effect` at `pass` (0 single, 1 cell field, 2 composite). */
export function fragmentSource(effect: number, pass: 0 | 1 | 2): string {
  return `#version 300 es\nprecision highp float;\nprecision highp int;\n#define IMGFX_PASS ${pass}\n${specializeEffect(FRAG_BODY, effect)}`;
}
