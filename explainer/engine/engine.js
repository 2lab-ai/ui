// engine.js — @2lab.ai/ui explainer engine (explainer/README.md). Shared canvas helpers for a 3Blue1Brown-style
// explainer video. One clock: renderAt(t) draws any frame from the time alone, so preview, scrubbing and export agree.
'use strict';
const W = 1920, H = 1080, FPS = 30;
// Palette and fonts come from the project's theme.json (written by tools/new_video.py). The values below are the
// classic 3Blue1Brown look; theme "mono-black" maps them onto the Modern Mono design tokens of @2lab.ai/ui.
const C = {
  bg: '#101114', text: '#ECECEC', dim: '#6b6f78', grey: '#3a3d45',
  blue: '#58C4DD', yellow: '#FFFF00', green: '#83C167', red: '#FC6255',
  teal: '#5CD0B3', purple: '#C59BFF', orange: '#F9A65A', white: '#ECECEC',
  track: '#4a4e58', grid: '#1d2026', gridFaint: '#22252b',
  panel: 'rgba(8,9,11,0.78)', panelText: '#FFFFFF', boxFill: 'rgba(255,255,255,0.04)',
  paper: '#e9e4d6', paperLine: '#b9c3d6', paperInk: '#2a2a2a', paperMath: '#1f2a44',
};
let SERIF = 'LMRoman, NotoSerifKR, Georgia, serif';   // running text and titles
let SANS = 'NotoSansKR, "Apple SD Gothic Neo", sans-serif';   // labels, chips, subtitles
let FONT_LOADS = ['400 40px LMRoman', '400 40px NotoSerifKR', '500 40px NotoSerifKR', '500 40px NotoSansKR', '700 40px NotoSansKR'];
let THEME = { id: '3b1b', titleWeight: 500 };
function applyTheme(t) {
  if (!t) return;
  Object.assign(C, t.colors || {});
  if (t.fonts) { SERIF = t.fonts.text || SERIF; SANS = t.fonts.sans || SANS; FONT_LOADS = t.fonts.load || FONT_LOADS; }
  THEME = { ...THEME, ...t };
}
// colour with alpha, from a #rrggbb theme colour
function mix(hex, a) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

let canvas, ctx, TL, FORM, PROJECT = {}, IMG = {}, SC = {}, ORDER = [];
const MISS = new Set();

// ---------- math ----------
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, p) => a + (b - a) * p;
const prog = (t, a, d = 0.8) => smooth((t - a) / d);           // eased 0→1 starting at a over d
const lin = (t, a, d) => clamp01((t - a) / d);
const win = (t, a, b, fi = 0.5, fo = 0.5) => Math.min(prog(t, a, fi), 1 - prog(t, b - fo, fo)); // fade in at a, out by b

// ---------- timeline helpers ----------
function Q(id) {
  const sc = SC[id];
  return {
    start: sc.start, lead: sc.start + sc.lead, end: sc.start + sc.dur,
    s: k => sc.sentences[Math.min(k, sc.sentences.length - 1)].start,
    e: k => sc.sentences[Math.min(k, sc.sentences.length - 1)].end,
    // time of the first spoken word containing `sub`, at or after sentence k
    w: (sub, k = 0) => {
      const t0 = sc.sentences[Math.min(k, sc.sentences.length - 1)].start - 0.02;
      for (const w of sc.words) if (w.t >= t0 && w.w.includes(sub)) return w.t;
      MISS.add(id + ':' + k + ':' + sub);
      return sc.sentences[Math.min(k, sc.sentences.length - 1)].start;
    },
    // exact token match, n-th occurrence (0-based) at or after sentence k
    wx: (tok, k = 0, n = 0) => {
      const t0 = sc.sentences[Math.min(k, sc.sentences.length - 1)].start - 0.02; let c = 0;
      for (const w of sc.words) if (w.t >= t0 && w.w === tok) { if (c === n) return w.t; c++; }
      MISS.add(id + ':' + k + ':=' + tok + '#' + n);
      return sc.sentences[Math.min(k, sc.sentences.length - 1)].start;
    },
  };
}

// ---------- drawing primitives ----------
function alpha(a) { ctx.globalAlpha = clamp01(a); }
function withAlpha(a, fn) { const g = ctx.globalAlpha; ctx.globalAlpha = g * clamp01(a); fn(); ctx.globalAlpha = g; }

function line(x1, y1, x2, y2, color = C.text, w = 4, p = 1, dash = null) {
  if (p <= 0) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(lerp(x1, x2, p), lerp(y1, y2, p)); ctx.stroke(); ctx.restore();
}
function arrow(x1, y1, x2, y2, color = C.text, w = 5, p = 1, head = 20) {
  if (p <= 0) return;
  const x = lerp(x1, x2, p), y = lerp(y1, y2, p);
  const ang = Math.atan2(y - y1, x - x1), len = Math.hypot(x - x1, y - y1);
  const hh = Math.min(head, len * 0.6);
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x - Math.cos(ang) * hh * 0.8, y - Math.sin(ang) * hh * 0.8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y);
  ctx.lineTo(x - Math.cos(ang - 0.42) * hh, y - Math.sin(ang - 0.42) * hh);
  ctx.lineTo(x - Math.cos(ang + 0.42) * hh, y - Math.sin(ang + 0.42) * hh);
  ctx.closePath(); ctx.fill(); ctx.restore();
}
// math-convention arc: angles counter-clockwise from +x, y up
function arc(cx, cy, r, a0, a1, color = C.text, w = 4, dash = null) {
  if (Math.abs(a1 - a0) < 1e-4) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.arc(cx, cy, r, -a0, -a1, a1 > a0); ctx.stroke(); ctx.restore();
}
function circle(cx, cy, r, color = C.grey, w = 3, p = 1, dash = null) { if (p > 0) arc(cx, cy, r, 0, Math.PI * 2 * p, color, w, dash); }
function disc(x, y, r, color, a = 1) { withAlpha(a, () => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }); }
function runner(x, y, a = 1, r = 13) {   // the running example: our walking dot
  withAlpha(a, () => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
    g.addColorStop(0, mix(C.yellow, 0.35)); g.addColorStop(1, mix(C.yellow, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, 7); ctx.fill();
    disc(x, y, r, C.yellow);
  });
}
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function box(x, y, w, h, { fill = C.boxFill, stroke = C.grey, r = 18, lw = 2, a = 1 } = {}) {
  withAlpha(a, () => { rrect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } });
}

function text(str, x, y, { size = 40, color = C.text, font = SERIF, align = 'center', base = 'middle', a = 1, weight = 400, italic = false } = {}) {
  if (a <= 0) return;
  withAlpha(a, () => {
    ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`;
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(str, x, y);
  });
}
function textW(str, size, font = SERIF, weight = 400) { ctx.font = `${weight} ${size}px ${font}`; return ctx.measureText(str).width; }
// typewriter: reveal characters with progress p
function typed(str, p, x, y, opts) { const n = Math.round(str.length * clamp01(p)); if (n > 0) text(str.slice(0, n), x, y, opts); }

// ---------- images ----------
function image(name, x, y, w, h, { a = 1, zoom = 1, panX = 0, panY = 0, r = 22, dim = 0, cover = true } = {}) {
  const im = IMG[name]; if (!im || a <= 0) return;
  withAlpha(a, () => {
    ctx.save(); rrect(x, y, w, h, r); ctx.clip();
    const s = (cover ? Math.max(w / im.width, h / im.height) : Math.min(w / im.width, h / im.height)) * zoom;
    const iw = im.width * s, ih = im.height * s;
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);
    ctx.drawImage(im, x + (w - iw) / 2 + panX, y + (h - ih) / 2 + panY, iw, ih);
    if (dim > 0) { ctx.fillStyle = mix(C.bg, dim); ctx.fillRect(x, y, w, h); }
    ctx.restore();
    rrect(x, y, w, h, r); ctx.strokeStyle = C.grey; ctx.lineWidth = 2; ctx.stroke();
  });
}

// ---------- formulas: glyph outlines from matplotlib mathtext ----------
function prepFormulas(raw) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg'); svg.style.position = 'absolute'; svg.style.left = '-9999px';
  document.body.appendChild(svg);
  const pathEl = document.createElementNS(svgNS, 'path'); svg.appendChild(pathEl);
  for (const f of Object.values(raw)) {
    for (const g of f.glyphs) {
      g.path = new Path2D(g.d);
      pathEl.setAttribute('d', g.d);
      try { g.len = pathEl.getTotalLength() || 1; } catch (e) { g.len = 1; }
    }
  }
  return raw;
}
const colorOf = c => C[c] || c;
// Draw formula `id` with font size `size` px. Anchor: (x, y) = baseline, align center/left/right.
// p = write-on progress (glyph by glyph: outline draws on, fill fades in, outline fades out).
function formula(id, x, y, size, { p = 1, a = 1, align = 'center', glow = null, gAlpha = null, gScale = null, color = null } = {}) {
  const f = FORM[id]; if (!f || a <= 0 || p <= 0) return;
  const ox = align === 'center' ? x - f.w * size / 2 : align === 'right' ? x - f.w * size : x;
  const n = f.glyphs.length + f.rects.length;
  const span = 2.2;  // each glyph spans this many "slots"
  withAlpha(a, () => {
    f.glyphs.forEach((g, k) => {
      const pk = clamp01((p * (n + span) - k) / span);
      if (pk <= 0) return;
      const ga = gAlpha ? gAlpha(k, g) : 1; if (ga <= 0) return;
      const sc = gScale ? gScale(k, g) : 1;
      const col = color || colorOf(g.c);
      ctx.save();
      ctx.translate(ox + g.x * size, y + g.y * size);
      if (sc !== 1) {   // scale around glyph's visual center
        const cx = 0.25, cy = -0.35; ctx.translate(cx * size, cy * size); ctx.scale(sc, sc); ctx.translate(-cx * size, -cy * size);
      }
      ctx.scale(size, size);
      ctx.globalAlpha *= ga;
      const sProg = clamp01(pk * 2), fProg = clamp01(pk * 2 - 1);
      if (fProg > 0) { ctx.fillStyle = col; ctx.globalAlpha *= 1; withAlpha(fProg, () => ctx.fill(g.path)); }
      if (pk < 1) {
        ctx.lineWidth = 2.2 / size; ctx.strokeStyle = col;
        ctx.setLineDash([g.len, g.len]); ctx.lineDashOffset = g.len * (1 - sProg);
        withAlpha(1 - fProg, () => ctx.stroke(g.path));
      }
      ctx.restore();
    });
    f.rects.forEach((r, j) => {
      const k = f.glyphs.length + j;
      const pk = clamp01((p * (n + span) - k) / span); if (pk <= 0) return;
      ctx.fillStyle = color || colorOf(r.c);
      ctx.fillRect(ox + r.x * size, y + r.y * size, r.w * size * pk, Math.max(r.h * size, 2));
    });
  });
}
function formulaW(id, size) { return FORM[id].w * size; }
// bounding box of glyph k (approx: from path bounds stored as x and next glyph x)
function glyphBox(id, k, x, y, size, align = 'center') {
  const f = FORM[id]; const ox = align === 'center' ? x - f.w * size / 2 : align === 'right' ? x - f.w * size : x;
  const g = f.glyphs[k]; const nx = k + 1 < f.glyphs.length && f.glyphs[k + 1].x > g.x ? f.glyphs[k + 1].x : f.w;
  const sup = g.y < -0.2;
  const hgt = sup ? 0.55 : 0.8;
  return { x: ox + g.x * size, y: y + (g.y - hgt) * size, w: (nx - g.x) * size, h: hgt * size * 1.15, cx: ox + (g.x + (nx - g.x) / 2) * size, cy: y + (g.y - hgt / 2) * size };
}

// ---------- shared furniture ----------
function chip(str, a) { text(str, 60, 58, { size: 26, color: C.dim, font: SANS, align: 'left', a, weight: 500 }); }

function wrapLines(str, maxW, size, font) {
  ctx.font = `500 ${size}px ${font}`;
  const words = str.split(' '); const lines = []; let cur = '';
  for (const w of words) {
    const tryS = cur ? cur + ' ' + w : w;
    if (ctx.measureText(tryS).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tryS;
  }
  if (cur) lines.push(cur);
  return lines;
}
function subtitle(str, a) {
  if (!str || a <= 0) return;
  const size = 36, lh = 50, maxW = 1480;
  const lines = wrapLines(str, maxW, size, SANS);
  ctx.font = `500 ${size}px ${SANS}`;
  const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 56;
  const h = lines.length * lh + 26;
  const y = H - 44 - h;
  withAlpha(a, () => {
    rrect(W / 2 - w / 2, y, w, h, 16); ctx.fillStyle = C.panel; ctx.fill();
    lines.forEach((l, i) => text(l, W / 2, y + 13 + lh / 2 + i * lh + 1, { size, font: SANS, color: C.panelText, weight: 500 }));
  });
}

// ---------- scene registry & clock ----------
const SCENES = {};   // id -> draw(t, q, local)
// Optional title card: scenes.js may set TITLE_CARD = (sc, a, isFirst, lt) => {...} to draw its own card during the lead
// (a = fade, lt = seconds since the scene started)
// (docent.js offers signCard: a figure holding the chapter sign). Unset, the default centred title below is drawn.
let TITLE_CARD = null;
// Optional YouTube cover: scenes.js may set COVER = () => {...} to draw one composed frame, not a still of the video
// (REFERENCE §10, TEMPLATES "Cover"). export.py cover calls renderCover() at 1920x1080 and saves it at 1280x720.
let COVER = null;
var COVER_B = null, COVER_C = null;   // var: a strict-mode scenes.js can assign them, and renderCover finds them on window
// renderCover('COVER_B') draws a second cover for Test & Compare (export.py cover renders every COVER, COVER_B, COVER_C)
function renderCover(name = 'COVER') {
  const fn = name === 'COVER' ? COVER : (typeof window[name] === 'function' ? window[name] : null);
  if (typeof DOCENT_FRAME === 'function') DOCENT_FRAME(0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  if (typeof fn !== 'function') return false;
  if (typeof COVER_INFO === 'object') COVER_INFO.texts = [];
  // ink lines 1.6x as thick: firm enough at 168 px wide, still the video's line (2.4x made the cover look like another video)
  if (typeof DOCENT === 'object') DOCENT.lw = 1.6;
  ctx.save(); try { fn(); if (typeof docentTags === 'function') docentTags(); } finally { ctx.restore(); if (typeof DOCENT === 'object') DOCENT.lw = 1; }
  return true;
}
// What the cover drew, for export.py cover's warnings: the coverText() calls and the ink's bounding box.
function coverReport() {
  const ink = typeof DOCENT === 'object' && DOCENT.ink ? DOCENT.ink : null;
  return { texts: typeof COVER_INFO === 'object' ? COVER_INFO.texts : [], ink, W, H };
}
function sceneAt(t) {
  for (let i = ORDER.length - 1; i >= 0; i--) if (t >= SC[ORDER[i]].start) return SC[ORDER[i]];
  return SC[ORDER[0]];
}
function renderAt(t) {
  if (typeof DOCENT_FRAME === 'function') DOCENT_FRAME(t);   // docent.js per-frame check registry (tools/lint_scenes.py)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const sc = sceneAt(t); const q = Q(sc.id);
  const end = sc.start + sc.dur;
  // title card during the lead
  const tc = win(t, sc.start, sc.start + sc.lead, 0.35, 0.45);
  const isFirst = sc.id === ORDER[0];
  if (tc > 0 && typeof TITLE_CARD === 'function') { ctx.save(); try { TITLE_CARD(sc, tc, isFirst, t - sc.start); } finally { ctx.restore(); } }
  else if (tc > 0) {
    const big = isFirst ? 92 : 76;
    text(sc.title, W / 2, H / 2 - (sc.subtitle ? 30 : 0), { size: big, a: tc, weight: THEME.titleWeight || 500 });
    if (sc.subtitle) text(sc.subtitle, W / 2, H / 2 + (isFirst ? 62 : 52), { size: isFirst ? 38 : 36, color: isFirst ? C.dim : C.orange, a: tc, font: isFirst ? SERIF : SANS, weight: isFirst ? 400 : 500 });
  }
  // scene body: fades in after the title card, fades out over the tail
  const body = Math.min(prog(t, sc.start + sc.lead - 0.15, 0.5), 1 - prog(t, end - 0.55, 0.5));
  if (body > 0) {
    ctx.save(); ctx.globalAlpha = body;
    SCENES[sc.id](t, q, sc);
    if (typeof docentTags === 'function') docentTags();   // name tags not placed by shots() yet
    ctx.restore();
    if (PROJECT.chip !== false) chip(sc.chip, body * 0.95);   // docent projects: false (the reference has no chapter chip)
  }
  // subtitles: burned in unless project.json "subtitles": "off" (docent: the narration goes to YouTube as captions,
  // export.py srt; a sentence on screen under a drawing is the 'too much on screen' the owner called AI slop, 2026-11-13)
  if (PROJECT.subtitles === 'off') return;
  const sents = sc.sentences;
  for (let k = 0; k < sents.length; k++) {
    const s = sents[k]; const sEnd = s.start + s.dur;
    if (t >= s.start - 0.25 && t < sEnd - 0.2) {
      const a = Math.min(prog(t, s.start - 0.25, 0.18), 1 - prog(t, sEnd - 0.32, 0.12));
      subtitle(s.text, a);
      break;
    }
  }
}

// ---------- loading ----------
async function loadAll() {
  canvas = document.getElementById('c'); ctx = canvas.getContext('2d');
  const get = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [tl, fm, theme, project] = await Promise.all([get('timeline.json'), get('formulas.json'), get('theme.json'), get('project.json')]);
  applyTheme(theme); PROJECT = project || {};
  TL = tl; FORM = prepFormulas(fm || {});
  TL.scenes.forEach(s => { SC[s.id] = s; ORDER.push(s.id); });
  const imgs = PROJECT.images || [];
  await Promise.all(imgs.map(n => new Promise(res => { const im = new Image(); im.onload = () => { IMG[n] = im; res(); }; im.onerror = res; im.src = 'img/' + n + '.jpg'; })));
  await Promise.all(FONT_LOADS.map(f => document.fonts.load(f, '가a1').catch(() => null)));
  await document.fonts.ready;
  window.TOTAL = TL.total;
  window.READY = true;
}
