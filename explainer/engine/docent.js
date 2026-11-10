// docent.js — @2lab.ai/ui explainer kit: the hand-drawn layer for book videos (explainer/README.md "Docent layer").
// Stick figures, bubbles, handwritten keywords, metaphor props and quick cuts, in the manner of book-summary channels
// such as Productive Peter: one figure lives through the idea, every idea gets a name on a board, an everyday picture
// and a picture equation, and the picture changes every few seconds. Everything is ink drawn from the clock alone
// (same rule as engine.js: any frame from t), with a slight deterministic wobble so lines look hand-drawn.
// Colours are theme roles: C.ink (lines), C.key (handwritten keywords), C.red (cross-outs and circles); on themes
// without them, ink falls back to C.text and key to C.blue, so the layer also works on mono-black.
'use strict';

// ---------- roles ----------
const INK = () => C.ink || C.text;
const KEY = () => C.key || C.blue;
const MARK = () => C.red || C.orange || C.text;
const PAPER = () => C.bg;
const HAND = () => (THEME.fonts && THEME.fonts.hand) || SERIF;

// ---------- per-frame check registry (tools/lint_scenes.py reads it) ----------
// Every primitive reports what it drew in the current frame: half-drawn parts, faded "ghost" parts, ink inside the
// subtitle zone or off the frame, empty bubbles, bubble tails, figure heads. engine.js calls DOCENT_FRAME(t) at the
// start of every renderAt, so the registry always describes exactly one frame.
const SUB_Y = 905;   // ink below this line sits under the subtitle box
const DOCENT_KINDS = ['partial', 'ghost', 'zone', 'off', 'empty', 'wordy', 'cover', 'overflow', 'rig', 'tails', 'heads', 'mouths', 'figs', 'bubbles', 'tags', 'animals', 'people', 'props', 'faces'];
const DOCENT = { t: 0, shot: null, slots: null, ghostOk: 0, seq: 0, ink: null, track: null };
function DOCENT_FRAME(t) { DOCENT.t = t; DOCENT.shot = null; DOCENT.seq = 0; DOCENT.ink = null; DOCENT.track = null; DOCENT.textBig = false; DOCENT.pendingTags = []; for (const k of DOCENT_KINDS) DOCENT[k] = [];
  DOCENT.slots = { figs: [], heads: [], tags: [], bubbles: [], things: [] }; }   // slots: where things are or will be (placement)
DOCENT_FRAME(0);
// screen-space boxes: a slot remembers the transform it was recorded under (box.m), so tags placed and checked across
// translate()/scale() wrappers compare where things really are on screen (PR #56 review)
const withM = (b) => { b.m = ctx.getTransform(); return b; };
function scr(b, m = b.m) {
  if (!m) return b;
  const X = (x, y) => m.a * x + m.c * y + m.e, Y = (x, y) => m.b * x + m.d * y + m.f;
  const xs = [X(b[0], b[1]), X(b[2], b[1]), X(b[0], b[3]), X(b[2], b[3])], ys = [Y(b[0], b[1]), Y(b[2], b[1]), Y(b[0], b[3]), Y(b[2], b[3])];
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
// a colour blended onto the paper, fully opaque (mix() gives rgba, which lets lines underneath show through)
function opaqueMix(hex, k, base = C.paper || PAPER()) {
  const rgb = (h) => { const m = /^#([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const c = rgb(hex), b = rgb(base); if (!c || !b) return mix(hex, k);
  return `rgb(${c.map((v, i) => Math.round(b[i] + (v - b[i]) * k)).join(',')})`;
}
// Name tags are placed once the picture is complete: each tries its free side, the other side, then above the head,
// and takes the spot that covers the fewest other figures, animals, props, boards, bubbles and tags. shots() calls
// this at the end of every shot and engine.js at the end of the frame, so a tag never lands on someone drawn later.
// A name tag is written in the person's accent colour unless that colour is too light to read on the page (grey on
// the sketch page measured ~1.6:1: '엔지니어' and '도이치' tags were unreadable, 2026-11-10 v2 redraw); then a darker shade.
function docentTagInk(acc) {
  const rgb = (h) => { const m = /^#([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const a = rgb(acc), bg = rgb(PAPER()); if (!a || !bg) return acc;
  const dark = lum(bg) < 0.4;   // on a dark page (mono-black) lighten toward white instead (grey there was 1.8:1)
  let c = a; for (let i = 0; i < 8; i++) { const L1 = lum(c), L2 = lum(bg); if ((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05) >= 4.5) break; c = c.map((v) => Math.round(dark ? v + (255 - v) * 0.2 : v * 0.8)); }
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
function docentTags() {
  const list = DOCENT.pendingTags || []; if (!list.length) return; DOCENT.pendingTags = [];
  const S = DOCENT.slots, placed = [];
  const ov = (r, b) => Math.max(0, Math.min(b[2], r[2]) - Math.max(b[0], r[0])) * Math.max(0, Math.min(b[3], r[3]) - Math.max(b[1], r[1]));
  for (const g of list) {
    let best = null, bs = null, bc = Infinity;
    g.cands.forEach(([cx, cy], k) => {
      const loc = [cx - g.w, cy - g.size * 0.6, cx + g.w, cy + g.size * 0.6], r = scr(loc, g.m);   // compared on screen
      let c = (r[0] < 40 || r[2] > W - 40 || r[1] < 20 || r[3] > SUB_Y ? 1e9 : 0) + k * 400;   // prefer the free side
      for (const b of S.figs) if (b !== g.own) c += ov(r, scr(b));
      for (const b of S.things) c += ov(r, scr(b));
      for (const b of S.bubbles) c += 2 * ov(r, scr(b));
      for (const b of placed) c += 4 * ov(r, b);
      if (c < bc) { bc = c; best = loc; bs = r; }
    });
    placed.push(bs); const rec = [...best, g.own]; rec.m = g.m; DOCENT.tags.push(rec);
    ctx.save(); ctx.setTransform(g.m); ctx.globalAlpha = g.a; if (g.ghostOk) DOCENT.ghostOk++;
    hand(g.str, (best[0] + best[2]) / 2, (best[1] + best[3]) / 2, { size: g.size, color: g.color, halo: true });
    if (g.ghostOk) DOCENT.ghostOk--; ctx.restore();
  }
}
function docentNote(kind, what) { if (DOCENT[kind].length < 40) DOCENT[kind].push(what); }
function docentReport() {
  const far = DOCENT.tails.filter(([tx, ty]) => !DOCENT.heads.some(([hx, hy, r, top]) => Math.hypot(tx - hx, ty - hy) < r + 70
      || (top != null && tx > hx - r * 1.4 && tx < hx + r * 1.4 && ty > top - 40 && ty < hy))
    && !DOCENT.mouths.some(([mx, my]) => Math.hypot(tx - mx, ty - my) < 90));
  // a speech tail ends beside the mouth: one that stops at the top or side of a head above the eyes reads as pointing
  // at the hair or hat (seen in round 1 on 9/9 probes, again in the GEB anteater sample)
  const high = DOCENT.tails.filter(([tx, ty, kind]) => kind !== 'thought'
    && DOCENT.heads.some(([hx, hy, r, top]) => top != null   // people only: an animal's mouth is far from its head centre
      && Math.hypot(tx - hx, ty - hy) < r + 70 && ty < hy - 0.1 * r
      && !(ty <= top - 2 && Math.abs(tx - hx) < r * 1.3)   // the say() exit above the hair or hat, from a bubble right above
      && !DOCENT.mouths.some(([mx, my]) => Math.hypot(tx - mx, ty - my) < r * 0.9)));   // was max(70, 1.2 r): it excused tips at the temple
  // cover is judged on the finished frame, so drawing order cannot hide it
  const cover = [...DOCENT.cover];
  DOCENT.bubbles.forEach(([x0, y0, x1, y1, tip, own = []], i) => {
    DOCENT.heads.forEach(([hx, hy, hr, top], k) => {
      if (k >= own[0] && k < own[1]) return;   // a picture inside this bubble's own body
      if (hx + hr * 0.7 > x0 && hx - hr * 0.7 < x1 && hy + hr * 0.7 > y0 && hy - hr * 0.7 < y1) cover.push(`bubble over a head @${Math.round(hx)}`);
      if (tip && (Math.hypot(tip[0] - hx, tip[1] - hy) < hr - 2 || (top != null && tip[1] > top + 2 && tip[1] < hy && Math.abs(tip[0] - hx) < hr * 0.9)))
        cover.push(`tail inside a head, hair or hat @${Math.round(hx)}`);
    });
    for (const g of DOCENT.tags) if (bubbleCrosses(x0, y0, x1 - x0, y1 - y0, tip, g)) cover.push(`bubble or tail over a name tag @${Math.round(g[0])}`);
    DOCENT.bubbles.slice(i + 1).forEach((b) => { if (b[2] > x0 + 6 && b[0] < x1 - 6 && b[3] > y0 + 6 && b[1] < y1 - 6) cover.push(`bubble over bubble @${Math.round(b[0])}`); });
  });
  const propFace = [];
  for (const pr of DOCENT.props) for (const [hx, hy, hr, seq] of DOCENT.faces) {
    if (seq == null || pr.seq < seq) continue;   // only a prop drawn after (over) the face
    const [x0, y0, x1, y1] = pr.box, ov = Math.max(0, Math.min(x1, hx + hr) - Math.max(x0, hx - hr)) * Math.max(0, Math.min(y1, hy + hr) - Math.max(y0, hy - hr));
    if (ov > 0.4 * 4 * hr * hr) propFace.push(`prop '${pr.name}' may cover a face @${Math.round(hx)}`);   // box test: look at the frame
  }
  for (const g0 of DOCENT.tags) for (const b0 of DOCENT.figs) {   // g0[4] = the box of the one it names; compared on screen
    if (b0 === g0[4]) continue;
    const g = scr(g0), b = scr(b0);
    const ov = Math.max(0, Math.min(b[2], g[2]) - Math.max(b[0], g[0])) * Math.max(0, Math.min(b[3], g[3]) - Math.max(b[1], g[1]));
    if (ov > 0.3 * (g[2] - g[0]) * (g[3] - g[1])) cover.push(`name tag over another figure or animal @${Math.round(g[0])}`);
  }
  const tagsS = DOCENT.tags.map((g) => scr(g));   // on screen, like the figure check above
  tagsS.forEach((g, i) => tagsS.slice(i + 1).forEach((h) => { if (h[2] > g[0] && h[0] < g[2] && h[3] > g[1] && h[1] < g[3]) cover.push(`name tag over name tag @${Math.round(g[0])}`); }));
  return { t: DOCENT.t, shot: DOCENT.shot, ink: DOCENT.ink, textBig: DOCENT.textBig, propFace, partial: DOCENT.partial, ghost: DOCENT.ghost, zone: DOCENT.zone, off: DOCENT.off,
    empty: DOCENT.empty, wordy: DOCENT.wordy, cover: [...new Set(cover)], overflow: DOCENT.overflow, tailFar: far, tailHigh: high.map(([x, y]) => [Math.round(x), Math.round(y)]),
    rig: DOCENT.rig, people: DOCENT.people, figures: DOCENT.figs.length, bubbles: DOCENT.bubbles.length, animals: DOCENT.animals };
}

// ---------- small maths ----------
// back-out ease: overshoots a little, for things that pop in
const backOut = (x) => { x = clamp01(x); const c = 1.6; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
const pop = (t, t0, d = 0.32) => backOut((t - t0) / d);
// stable pseudo-noise in [-1, 1]: the wobble must not change from frame to frame
const nz = (seed, i) => 0.6 * Math.sin(i * 0.9 + seed * 12.9898) + 0.4 * Math.sin(i * 0.37 + seed * 78.233);
const seedOf = (pts) => ((pts[0][0] * 0.0137 + pts[0][1] * 0.0291 + pts.length * 0.71) % 97) + 1;

// ---------- ink strokes ----------
// Resample a polyline to ~step px segments and push each inner point off the line by a small stable amount.
function wobble(pts, closed, jit, seed, step = 14) {
  const src = closed ? [...pts, pts[0]] : pts;
  const out = [src[0]];
  for (let k = 1; k < src.length; k++) {
    const [x0, y0] = src[k - 1], [x1, y1] = src[k];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let j = 1; j <= n; j++) out.push([lerp(x0, x1, j / n), lerp(y0, y1, j / n)]);
  }
  if (!jit) return out;
  return out.map(([x, y], i) => {
    if (!closed && (i === 0 || i === out.length - 1)) return [x, y];
    const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const o = jit * nz(seed, i);
    return [x - (dy / l) * o, y + (dx / l) * o];
  });
}
// Draw a polyline in ink. p = draw-on progress (0..1) along its length; fill fades in over the last 40 %.
// Chaikin corner cutting: round = 1..3 passes turn a polygon of guide points into a soft organic outline (animals).
function chaikin(pts, closed, n) {
  let q = pts;
  for (let k = 0; k < n; k++) {
    const out = closed ? [] : [q[0]], m = closed ? q.length : q.length - 1;
    for (let i = 0; i < m; i++) { const a = q[i], b = q[(i + 1) % q.length]; out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
    if (!closed) out.push(q[q.length - 1]);
    q = out;
  }
  return q;
}
function inkPath(pts, { color = null, w = 4, p = 1, closed = false, jit = 1.4, seed = null, fill = null, fillA = 1, a = 1, dash = null, ghostOk = false, round = 0 } = {}) {
  if (DOCENT.measure) {   // prop() measuring a prop that is not drawn yet: extend its local box, draw nothing
    const t = DOCENT.track; if (t) for (const [px, py] of pts) t.local = t.local ? [Math.min(t.local[0], px), Math.min(t.local[1], py), Math.max(t.local[2], px), Math.max(t.local[3], py)] : [px, py, px, py];
    return;
  }
  if (p <= 0 || a <= 0 || pts.length < 2) return;
  if (round) pts = chaikin(pts, closed, round);
  if (p < 0.98) docentNote('partial', 'ink');
  const ea = a * ctx.globalAlpha;   // effective opacity, including withAlpha() from the drawing that contains this stroke
  if (ea < 0.55 && !ghostOk && !DOCENT.ghostOk) docentNote('ghost', `ink a=${ea.toFixed(2)}`);
  { const m = ctx.getTransform(); let lo = -1e9, l = 1e9, r = -1e9;   // full affine: rotation and mirroring included
    for (const [px, py] of pts) { const sx = m.a * px + m.c * py + m.e, sy = m.b * px + m.d * py + m.f; if (sy > lo) lo = sy; if (sx < l) l = sx; if (sx > r) r = sx; }
    let hi = 1e9; for (const [px, py] of pts) { const sy = m.b * px + m.d * py + m.f; if (sy < hi) hi = sy; }
    const box = (b) => b ? [Math.min(b[0], l), Math.min(b[1], hi), Math.max(b[2], r), Math.max(b[3], lo)] : [l, hi, r, lo];
    if (!DOCENT.ghostOk) DOCENT.ink = box(DOCENT.ink);
    if (DOCENT.track) { DOCENT.track.box = box(DOCENT.track.box);   // screen space; faces are kept in screen space too
      let a0 = 1e9, b0 = 1e9, a1 = -1e9, b1 = -1e9; for (const [px, py] of pts) { a0 = Math.min(a0, px); b0 = Math.min(b0, py); a1 = Math.max(a1, px); b1 = Math.max(b1, py); }
      const t = DOCENT.track.local; DOCENT.track.local = t ? [Math.min(t[0], a0), Math.min(t[1], b0), Math.max(t[2], a1), Math.max(t[3], b1)] : [a0, b0, a1, b1]; }   // local: for layout
    if (lo > SUB_Y) docentNote('zone', Math.round(lo)); if (l < -4 || r > W + 4 || hi < -4) docentNote('off', [Math.round(l), Math.round(r), Math.round(hi)]); }
  const q = wobble(pts, closed, jit, seed == null ? seedOf(pts) : seed);
  withAlpha(a, () => {
    ctx.save();
    if (fill && p > 0.6) {
      const g = ctx.globalAlpha;
      ctx.globalAlpha = g * fillA * smooth((p - 0.6) / 0.4);
      ctx.fillStyle = fill; ctx.beginPath(); q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = g;
    }
    ctx.strokeStyle = color || INK(); ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (dash) ctx.setLineDash(dash);
    let L = 0; const seg = [0];
    for (let i = 1; i < q.length; i++) { L += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]); seg.push(L); }
    const stop = L * clamp01(p);
    ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]);
    for (let i = 1; i < q.length; i++) {
      if (seg[i] <= stop) { ctx.lineTo(q[i][0], q[i][1]); continue; }
      const f = (stop - seg[i - 1]) / ((seg[i] - seg[i - 1]) || 1);
      ctx.lineTo(lerp(q[i - 1][0], q[i][0], f), lerp(q[i - 1][1], q[i][1], f)); break;
    }
    ctx.stroke(); ctx.restore();
  });
}
const inkLine = (x1, y1, x2, y2, o = {}) => inkPath([[x1, y1], [x2, y2]], o);
const inkPoly = (pts, o = {}) => inkPath(pts, o);
function inkRect(x, y, w, h, o = {}) { inkPath([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { ...o, closed: true }); }
// screen angles (radians, clockwise from +x, y down)
function inkArc(cx, cy, rx, ry, a0, a1, o = {}) {
  const n = Math.max(10, Math.ceil(Math.abs(a1 - a0) * Math.max(rx, ry) / 10));
  const pts = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  inkPath(pts, o);
}
function inkEllipse(cx, cy, rx, ry, o = {}) {
  const n = Math.max(18, Math.ceil((rx + ry) / 7)); const s = (o.start ?? -Math.PI / 2);
  const pts = []; for (let i = 0; i < n; i++) { const a = s + (i / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  inkPath(pts, { ...o, closed: true });
}
const inkCircle = (cx, cy, r, o = {}) => inkEllipse(cx, cy, r, r, o);
function inkCurve(p0, p1, p2, o = {}) {   // quadratic Bézier through control p1
  const pts = []; for (let i = 0; i <= 24; i++) { const s = i / 24, u = 1 - s; pts.push([u * u * p0[0] + 2 * u * s * p1[0] + s * s * p2[0], u * u * p0[1] + 2 * u * s * p1[1] + s * s * p2[1]]); }
  inkPath(pts, o);
}
// arrow along a straight line or a curve (via = control point); the head draws after the shaft
function inkArrow(x1, y1, x2, y2, { via = null, head = 22, p = 1, ...o } = {}) {
  const ps = clamp01(p / 0.8), ph = clamp01((p - 0.8) / 0.2);
  if (via) inkCurve([x1, y1], via, [x2, y2], { ...o, p: ps }); else inkLine(x1, y1, x2, y2, { ...o, p: ps });
  if (ph <= 0) return;
  const [fx, fy] = via || [x1, y1];
  const ang = Math.atan2(y2 - fy, x2 - fx);
  inkPath([[x2 - Math.cos(ang - 0.45) * head, y2 - Math.sin(ang - 0.45) * head], [x2, y2], [x2 - Math.cos(ang + 0.45) * head, y2 - Math.sin(ang + 0.45) * head]], { ...o, p: ph });
}
const inkDot = (x, y, r = 5, o = {}) => disc(x, y, r, o.color || INK(), (o.a ?? 1) * clamp01((o.p ?? 1) * 2));

// ---------- handwritten text ----------
// Written on left to right (clip reveal) as p goes 0 -> 1. Default colour is the keyword colour.
function hand(str, x, y, { size = 54, color = null, p = 1, a = 1, align = 'center', weight = 700, rot = 0, base = 'middle', ghostOk = false, halo = false } = {}) {
  if (p <= 0 || a <= 0 || !str) return;
  if (p < 0.98) docentNote('partial', 'hand:' + String(str).slice(0, 12));
  if (a * ctx.globalAlpha < 0.55 && !ghostOk && !DOCENT.ghostOk) docentNote('ghost', 'hand:' + String(str).slice(0, 12));
  if (size >= 56 && !DOCENT.ghostOk) DOCENT.textBig = true;   // a lettering shot is not a 'small subject'
  { const m = ctx.getTransform(); ctx.font = `${weight} ${size}px ${HAND()}`; ctx.textBaseline = base;
    const tm = ctx.measureText(str), tw = tm.width, x0 = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
    const asc = tm.actualBoundingBoxAscent ?? size * 0.5, desc = tm.actualBoundingBoxDescent ?? size * 0.45;
    const cs = Math.cos(rot), sn = Math.sin(rot), xs = [], ys = [];
    for (const [u, v] of [[x0 - x, -asc], [x0 - x + tw, -asc], [x0 - x, desc], [x0 - x + tw, desc]]) {
      const px = x + u * cs - v * sn, py = y + u * sn + v * cs; xs.push(m.a * px + m.c * py + m.e); ys.push(m.b * px + m.d * py + m.f); }
    if (Math.max(...ys) > SUB_Y) docentNote('zone', 'hand:' + String(str).slice(0, 12));
    if (!DOCENT.ghostOk) { const b = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], k = DOCENT.ink; DOCENT.ink = k ? [Math.min(k[0], b[0]), Math.min(k[1], b[1]), Math.max(k[2], b[2]), Math.max(k[3], b[3])] : b; }
    if (Math.min(...xs) < -4 || Math.max(...xs) > W + 4 || Math.min(...ys) < -4) docentNote('off', 'hand:' + String(str).slice(0, 12)); }
  ctx.save();
  ctx.font = `${weight} ${size}px ${HAND()}`;
  const w = ctx.measureText(str).width;
  const x0 = align === 'center' ? -w / 2 : align === 'right' ? -w : 0;
  ctx.translate(x, y); if (rot) ctx.rotate(rot);
  if (p < 1) { ctx.beginPath(); ctx.rect(x0 - 4, -size, w * clamp01(p) + 8, size * 2); ctx.clip(); }
  ctx.globalAlpha *= clamp01(a); ctx.fillStyle = color || KEY(); ctx.textAlign = 'left'; ctx.textBaseline = base;
  if (halo) { ctx.lineWidth = size * 0.22; ctx.lineJoin = 'round'; ctx.strokeStyle = C.paper || PAPER(); ctx.strokeText(str, x0, 0); }
  ctx.fillText(str, x0, 0);
  ctx.restore();
}
const handW = (str, size = 54, weight = 700) => { ctx.font = `${weight} ${size}px ${HAND()}`; return ctx.measureText(str).width; };
function handLines(str, maxW, size = 54, weight = 700) {
  ctx.font = `${weight} ${size}px ${HAND()}`;
  const out = []; let cur = '';
  for (let word of String(str).split(' ')) {
    while (ctx.measureText(word).width > maxW && word.length > 1) {   // a word wider than the line: break it by width
      let k = word.length - 1; while (k > 1 && ctx.measureText(word.slice(0, k)).width > maxW) k--;
      if (cur) { out.push(cur); cur = ''; }
      out.push(word.slice(0, k)); word = word.slice(k);
    }
    const t = cur ? cur + ' ' + word : word;
    if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = word; } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}
// several lines, written one after another; returns the block height
function handBlock(str, x, y, maxW, { size = 50, lh = 1.25, p = 1, ...o } = {}) {
  const lines = Array.isArray(str) ? str : handLines(str, maxW, size, o.weight || 700);
  const n = lines.length; const y0 = y - ((n - 1) * size * lh) / 2;
  lines.forEach((l, i) => hand(l, x, y0 + i * size * lh, { size, ...o, p: clamp01(p * n - i) }));
  return n * size * lh;
}

// ---------- the stick figure ----------
// (x, y) is the point between the feet. s = scale (s = 1 is about 340 px tall). Poses move arms and legs; faces
// carry the mood. Accessories mark roles. All parts draw on with p.
const POSES = {
  //          left arm [elbow, hand]          right arm [elbow, hand]          (relative to the shoulder, y down)
  stand:   { la: [[-18, 52], [-28, 108]], ra: [[18, 52], [28, 108]] },
  wave:    { la: [[-18, 52], [-28, 108]], ra: [[58, -18], [82, -88]] },
  point:   { la: [[-18, 52], [-28, 108]], ra: [[62, 2], [124, -6]] },
  present: { la: [[-18, 52], [-28, 108]], ra: [[58, -20], [118, -62]] },
  think:   { la: [[-22, 46], [26, 52]], ra: [[44, 40], [12, -24]] },
  shrug:   { la: [[-56, 14], [-92, -24]], ra: [[56, 14], [92, -24]] },
  cheer:   { la: [[-44, -48], [-62, -112]], ra: [[44, -48], [62, -112]] },
  hold:    { la: [[-38, 44], [-66, 26]], ra: [[38, 44], [66, 26]] },
  akimbo:  { la: [[-50, 44], [-12, 92]], ra: [[50, 44], [12, 92]] },
  reach:   { la: [[-18, 52], [-28, 108]], ra: [[60, 20], [118, 40]] },
  slump:   { la: [[-12, 58], [-14, 116]], ra: [[12, 58], [14, 116]] },
  facepalm:{ la: [[-18, 52], [-28, 108]], ra: [[40, 30], [4, -40]] },
  carry:   { la: [[-46, -30], [-40, -100]], ra: [[46, -30], [40, -100]] },
};
// Looks (all optional, combine freely; use cast() to fix one look per person):
//   hair: 'short' | 'spiky' | 'curly' | 'long' | 'bun' | 'ponytail' | 'side' | 'bald'  (true = 'long', the old look)
//   beard, mustache: true;  glasses: true | 'round' | 'square';  hat: true | 'top' | 'cap' | 'beanie' | 'bowler'
//   outfit: 'suit' | 'dress' | 'coat' | 'tshirt';  accent: a colour role ('red', 'blue', 'green', …) for tie/outfit/cap
//   h: height scale (0.8 short … 1.15 tall);  tag: a name written above the head (first appearance)
// Returns anchors for bubbles and layout: { head: [x, y], r, mouth: [x, y], top, hands: [[x,y],[x,y]], box, dir }.
function figure(x, y, o = {}) {
  const { s: s0 = 1, pose = 'stand', face = 'smile', p = 1, a = 1, flip = false, t = 0, walk = 0, sit = false,
    tie = false, glasses = false, hair = false, helmet = false, shell = false, snout = false, hat = false,
    beard = false, mustache = false, outfit = null, accent = null, h = 1, tag = null,
    blindfold = false, look = 0, color = null, w = 4.2 } = o;
  const s = s0 * h;
  const P = POSES[pose] || POSES.stand;
  const ink = color || INK();
  const acc = accent ? (C[accent] || accent) : null;
  const F = (dx, dy) => [x + (flip ? -dx : dx) * s, y + dy * s];   // local -> screen
  const slump = pose === 'slump' ? 16 : 0;
  const hip = sit ? [0, -100] : [0, -122], sh = [0, -228 + slump], neck = [0, -246 + slump];
  const head = [slump * 0.6, -292 + slump * 1.4], hr = 44;
  const hc = F(...head), R = hr * s, dir = flip ? -1 : 1;
  const hatH = { top: 2.2, true: 2.2, bowler: 1.3, cap: 1.5, beanie: 1.5, crown: 1.75, laurel: 1.2 }, hairH = { bun: 1.6, spiky: 1.45, curly: 1.32, ponytail: 1.25, long: 1.25, short: 1.25, side: 1.25 };
  const topY = hc[1] - R * (hat ? (hatH[hat] || 2.2) : (hair && hair !== 'bald' ? (hairH[hair === true ? 'long' : hair] || 1.25) : 1.05));
  const anchors = { head: hc, r: R, mouth: [hc[0] + dir * R * 0.15, hc[1] + R * 0.4], top: [hc[0], topY], dir,
    brim: hat === 'cap' ? dir : 0,   // a cap's brim reaches 1.7 R on the facing side: say() keeps upper bubbles off that side
    hands: [F(sh[0] + P.la[1][0] - (outfit ? 21 : 0), sh[1] + P.la[1][1]), F(sh[0] + P.ra[1][0] + (outfit ? 21 : 0), sh[1] + P.ra[1][1])],
    box: [x - 70 * s, topY, x + 70 * s, y] };
  // the name tag sits beside the waist on the free side (not between two people), clear of every bubble above.
  // This spot is provisional (bubbles keep clear of it); docentTags() places the tag when the shot is complete, so
  // people, animals, props and bubbles drawn AFTER this figure count too (2026-11-10: a tag landed on a later figure).
  const tagS = Math.max(42, 48 * Math.min(1, s0)), tagW = tag ? handW(tag, tagS) / 2 + 8 : 0;
  const tagY = y - 165 * s;
  const tagCost = (tx) => (tx - tagW < 40 || tx + tagW > W - 40 ? 1e9 : 0) + DOCENT.slots.figs.reduce((c, b) =>
    c + Math.max(0, Math.min(b[2], tx + tagW) - Math.max(b[0], tx - tagW)) * Math.max(0, Math.min(b[3], tagY + tagS) - Math.max(b[1], tagY - tagS)), 0);
  const away = x - dir * (92 * s + tagW), toward = x + dir * (92 * s + tagW);   // close enough to belong (112 read as floating)
  const tagX = o.tagSide === 'left' ? Math.min(away, toward) : o.tagSide === 'right' ? Math.max(away, toward)
    : tagCost(toward) < tagCost(away) ? toward : away;   // the free side (ties: the side it turns away from), or tagSide
  const tagRect = [tagX - tagW, tagY - tagS * 0.6, tagX + tagW, tagY + tagS * 0.6];
  if (s > 0) { DOCENT.slots.figs.push(withM(anchors.box)); DOCENT.slots.heads.push([hc[0], hc[1], R]); if (tag) DOCENT.slots.tags.push(tagRect); }
  if (p <= 0 || a <= 0 || s <= 0) return anchors;
  if (o.ghostOk) DOCENT.ghostOk++;
  DOCENT.heads.push([hc[0], hc[1], R, topY, ++DOCENT.seq]);
  { const m = ctx.getTransform(); DOCENT.faces.push([m.a * hc[0] + m.c * hc[1] + m.e, m.b * hc[0] + m.d * hc[1] + m.f, R * Math.hypot(m.a, m.b), DOCENT.seq]); } DOCENT.mouths.push(anchors.mouth); DOCENT.figs.push(anchors.box);
  DOCENT.people.push({ id: o._cast || null, crowd: !!o.crowd, sig: [hair, hat, outfit, accent, glasses, beard, mustache, helmet, shell, h, color].join('|') });
  if (snout) docentNote('rig', 'figure(snout): an animal on the stick-figure rig — use animal()');
  const ph = (k, n) => clamp01((p * n - k) / 1.4);   // staged draw-on: head, body, arms, legs, face
  const lw = w * Math.max(0.7, Math.sqrt(s));
  withAlpha(a, () => {
    // shell (tortoise): an oval behind the torso, drawn first so the body sits on it
    if (shell) {
      const c = F(0, -175 + slump);
      inkEllipse(c[0], c[1], 92 * s, 104 * s, { p: ph(0, 6), w: lw, fill: mix(C.green, 0.28), color: ink });
      const q = ph(0.5, 6);
      if (q > 0) for (const [dx, dy] of [[-48, -40], [48, -40], [-52, 34], [52, 34], [0, -84], [0, 76]]) {
        const cc = F(dx, -175 + slump + dy); inkCircle(cc[0], cc[1], 20 * s, { p: q, w: lw * 0.6, color: ink });
      }
    }
    // outfits sit behind the arms: suit/coat = jacket with a V neck, dress = a skirt from the chest, tshirt = sleeves
    const fillOf = (k) => opaqueMix(acc || C.grey, k);   // opaque: the body line under it does not show through
    if (outfit && outfit !== 'dress') inkLine(...F(...neck), ...F(...hip), { p: ph(1, 6), w: lw, color: ink });   // body first, clothes over it
    if (outfit === 'suit' || outfit === 'coat') {
      const L = outfit === 'coat' ? -96 : -118;
      inkPath([F(-30, -230 + slump), F(30, -230 + slump), F(34, L), F(-34, L)], { closed: true, p: ph(1, 6), w: lw * 0.8, fill: fillOf(0.45), color: ink });
      inkPoly([F(-14, -230 + slump), F(0, -196 + slump), F(14, -230 + slump)], { p: ph(1.5, 6), w: lw * 0.6, color: ink });
    } else if (outfit === 'dress') {
      inkPath([F(-18, -226 + slump), F(18, -226 + slump), F(52, -92), F(-52, -92)], { closed: true, p: ph(1, 6), w: lw * 0.8, fill: fillOf(0.5), color: ink });
    } else if (outfit === 'tshirt') {
      inkPath([F(-24, -228 + slump), F(24, -228 + slump), F(26, -150), F(-26, -150)], { closed: true, p: ph(1, 6), w: lw * 0.7, fill: fillOf(0.4), color: ink });
    }
    // body
    if (!outfit) inkLine(...F(...neck), ...F(...hip), { p: ph(1, 6), w: lw, color: ink });
    else if (outfit === 'dress') inkLine(...F(...neck), ...F(0, -226 + slump), { p: ph(1, 6), w: lw, color: ink });
    // legs
    const legs = sit
      ? [[[18, 4], [70, 4]], [[30, 6], [78, 8]]].map((l) => [l[0], [l[1][0], l[1][1] + 98]])
      : walk ? [[[-14 + 22 * Math.sin(t * 6), 60], [-26 + 40 * Math.sin(t * 6), 122]], [[14 - 22 * Math.sin(t * 6), 60], [26 - 40 * Math.sin(t * 6), 122]]]
        : [[[-14, 60], [-26, 122]], [[14, 60], [26, 122]]];
    legs.forEach((lg, k) => {
      const knee = [hip[0] + lg[0][0], hip[1] + lg[0][1]];
      const foot = [hip[0] + lg[1][0], hip[1] + lg[1][1]];
      if (sit) { const k1 = [hip[0] + 64 + k * 10, hip[1] + 2]; inkPoly([F(...hip), F(...k1), F(k1[0], k1[1] + 96)], { p: ph(3, 6), w: lw, color: ink }); }
      else if (outfit === 'dress') inkPoly([F(-20 + 40 * k, -92), F(foot[0] * 0.8, foot[1])], { p: ph(3, 6), w: lw, color: ink });
      else inkPoly([F(...hip), F(...knee), F(...foot)], { p: ph(3, 6), w: lw, color: ink });
    });
    // arms (wave swings the raised hand)
    const arm = (A, k) => {
      let [el, hd] = A;
      if (pose === 'wave' && k === 1) hd = [hd[0] + 14 * Math.sin(t * 9), hd[1]];
      if (walk && pose === 'stand') { const sw = 24 * Math.sin(t * 6) * (k ? -1 : 1); el = [el[0] + sw * 0.4, el[1]]; hd = [hd[0] + sw, hd[1]]; }
      const ox = (outfit === 'dress' ? 16 : outfit ? 26 : 0) * (k ? 1 : -1), oy = outfit ? 6 : 0;   // arms hang outside the jacket
      inkPoly([F(sh[0] + ox, sh[1] + oy), F(sh[0] + el[0] + ox, sh[1] + el[1] + oy), F(sh[0] + hd[0] + ox * 0.8, sh[1] + hd[1] + oy)], { p: ph(2, 6), w: lw, color: ink });
    };
    arm(P.la, 0); arm(P.ra, 1);
    // hair behind the head (long, ponytail)
    const hp = ph(0.3, 6);
    const style = hair === true ? 'long' : hair;
    if (style === 'long') for (const side of [-1, 1]) inkPath([[hc[0] + side * R * 0.2, hc[1] - R * 1.0], [hc[0] + side * R * 1.25, hc[1] - R * 0.5], [hc[0] + side * R * 1.2, hc[1] + R * 1.15], [hc[0] + side * R * 0.7, hc[1] + R * 1.1]], { p: hp, w: lw * 0.8, fill: ink, fillA: 0.85, closed: true, color: ink });
    if (style === 'ponytail') inkCurve([hc[0] - dir * R * 0.7, hc[1] - R * 0.6], [hc[0] - dir * R * 1.9, hc[1] - R * 0.2], [hc[0] - dir * R * 1.4, hc[1] + R * 1.0], { p: hp, w: lw * 2.2, color: ink });
    // head: filled a shade lighter than the page so it reads as a face, not a hole (2026-11-10 review: 'unfilled heads')
    const headFill = C.paper ? opaqueMix(C.paper, 0.75, PAPER()) : PAPER();   // not `face`: that is the expression
    if (snout) inkPath([F(head[0] + 30, head[1] - 4), F(head[0] + 118, head[1] + 18), F(head[0] + 116, head[1] + 30), F(head[0] + 30, head[1] + 22)], { p: ph(0, 6), w: lw, fill: PAPER(), color: ink });
    inkEllipse(hc[0], hc[1], R, (shell ? 40 * s0 * h : R), { p: ph(0, 6), w: lw, fill: headFill, color: ink });
    const pf = ph(4.5, 6);
    if (pf > 0) withAlpha(pf, () => drawFace(hc[0], hc[1], R, face, { look: flip ? -look : look, ink, t, blindfold }));
    // hair on top of the head
    const cap = (inner = 0.45) => {   // a filled cap over the top of the head, fringe at inner*R above the centre
      const pts = [];
      for (let i = 0; i <= 16; i++) { const ang = Math.PI * (1.04 + 0.92 * i / 16); pts.push([hc[0] + Math.cos(ang) * R * 1.07, hc[1] + Math.sin(ang) * R * 1.07]); }
      pts.push([hc[0] + R * 0.82, hc[1] - R * inner], [hc[0] + R * 0.3, hc[1] - R * (inner + 0.12)], [hc[0] - R * 0.2, hc[1] - R * inner], [hc[0] - R * 0.82, hc[1] - R * (inner - 0.05)]);
      inkPath(pts, { p: hp, closed: true, fill: ink, color: ink, w: lw * 0.6, jit: 0.6 });
    };
    if (style === 'short' || style === 'long' || style === 'ponytail' || style === 'bun') cap(style === 'short' ? 0.5 : 0.4);
    if (style === 'side') { cap(0.35); inkLine(hc[0] - dir * R * 0.2, hc[1] - R * 1.05, hc[0] - dir * R * 0.05, hc[1] - R * 0.4, { p: hp, w: lw * 0.7, color: PAPER() }); }
    if (style === 'bun') inkCircle(hc[0], hc[1] - R * 1.25, R * 0.32, { p: hp, fill: ink, color: ink, w: lw * 0.6 });
    if (style === 'spiky') { cap(0.5); const pts = []; for (let i = 0; i <= 10; i++) { const ang = Math.PI * (1.08 + 0.84 * i / 10), rr = i % 2 ? R * 1.42 : R * 1.0; pts.push([hc[0] + Math.cos(ang) * rr, hc[1] + Math.sin(ang) * rr]); }
      for (let i = 10; i >= 0; i--) { const ang = Math.PI * (1.08 + 0.84 * i / 10); pts.push([hc[0] + Math.cos(ang) * R * 0.86, hc[1] + Math.sin(ang) * R * 0.86]); }
      inkPath(pts, { p: hp, closed: true, fill: ink, color: ink, w: lw * 0.6, jit: 0.4 }); }
    if (style === 'curly') for (let i = 0; i < 7; i++) { const ang = Math.PI * (1.08 + 0.84 * i / 6); inkCircle(hc[0] + Math.cos(ang) * R * 0.98, hc[1] + Math.sin(ang) * R * 0.98, R * 0.3, { p: hp, fill: ink, color: ink, w: lw * 0.5 }); }
    // accessories
    const pa = ph(4, 6);
    if (pa > 0) withAlpha(pa, () => {
      if (tie) { const a1 = F(0, -230 + slump), a2 = F(-9, -214 + slump), a3 = F(0, -170 + slump), a4 = F(9, -214 + slump);
        inkPath([a1, a2, a3, a4], { closed: true, w: lw * 0.6, color: ink, fill: acc || ink }); }
      if (beard) inkPath([[hc[0] - R * 0.92, hc[1] + R * 0.05], [hc[0] - R * 0.7, hc[1] + R * 0.75], [hc[0], hc[1] + R * 1.12], [hc[0] + R * 0.7, hc[1] + R * 0.75], [hc[0] + R * 0.92, hc[1] + R * 0.05], [hc[0] + R * 0.45, hc[1] + R * 0.5], [hc[0] - R * 0.45, hc[1] + R * 0.5]], { closed: true, fill: ink, fillA: 0.85, color: ink, w: lw * 0.5 });
      if (mustache) inkPath([[hc[0] - R * 0.42, hc[1] + R * 0.32], [hc[0], hc[1] + R * 0.2], [hc[0] + R * 0.42, hc[1] + R * 0.32], [hc[0], hc[1] + R * 0.3]], { closed: true, fill: ink, color: ink, w: lw * 0.5 });
      if (glasses) {
        const sq = glasses === 'square', gx = 15 * s * h, gr = 11 * s * h, gy = hc[1] - 4 * s * h;
        for (const d of [-1, 1]) { if (sq) inkRect(hc[0] + d * gx - gr, gy - gr * 0.8, gr * 2, gr * 1.6, { w: lw * 0.6, color: ink }); else inkCircle(hc[0] + d * gx, gy, gr, { w: lw * 0.6, color: ink }); }
        inkLine(hc[0] - gx + gr, gy - 2, hc[0] + gx - gr, gy - 2, { w: lw * 0.6, color: ink });
      }
      const hatStyle = hat === true ? 'top' : hat;
      if (hatStyle === 'top') { inkRect(hc[0] - 30 * s, hc[1] - 96 * s, 60 * s, 52 * s, { w: lw * 0.8, fill: ink, color: ink }); inkLine(hc[0] - 52 * s, hc[1] - 44 * s, hc[0] + 52 * s, hc[1] - 44 * s, { w: lw, color: ink }); }
      if (hatStyle === 'cap') { inkArc(hc[0], hc[1] - R * 0.3, R * 1.02, R * 0.85, Math.PI, Math.PI * 2, { w: lw * 0.8, fill: acc || ink, color: ink, closed: true }); inkLine(hc[0] + dir * R * 0.2, hc[1] - R * 0.3, hc[0] + dir * R * 1.7, hc[1] - R * 0.22, { w: lw * 1.6, color: ink }); }
      if (hatStyle === 'beanie') { inkArc(hc[0], hc[1] - R * 0.25, R * 1.05, R * 0.95, Math.PI, Math.PI * 2, { w: lw * 0.8, fill: acc || ink, color: ink, closed: true }); inkCircle(hc[0], hc[1] - R * 1.28, R * 0.2, { fill: acc || ink, color: ink, w: lw * 0.5 }); }
      if (hatStyle === 'crown') { const b = hc[1] - R * 0.82, pts = [[hc[0] - R * 0.82, b]]; for (let i = 0; i <= 4; i++) { const x = hc[0] - R * 0.82 + i * R * 0.41; pts.push([x, i % 2 ? b - R * 0.42 : b - R * 0.92]); } pts.push([hc[0] + R * 0.82, b]);
        inkPath(pts, { closed: true, w: lw * 0.7, fill: C.yellow || acc || ink, color: ink }); for (const k of [-1, 0, 1]) inkCircle(hc[0] + k * R * 0.41, b - R * 0.2, R * 0.08, { w: 1, fill: C.red || ink, color: C.red || ink }); }
      if (hatStyle === 'laurel') for (const d of [-1, 1]) for (let i = 0; i < 5; i++) { const ang = Math.PI * (1.5 + d * (0.08 + i * 0.085)), lx = hc[0] + Math.cos(ang) * R * 1.0, ly = hc[1] + Math.sin(ang) * R * 1.0;
        inkEllipse(lx, ly, R * 0.2, R * 0.1, { w: lw * 0.4, fill: C.green || acc || ink, color: ink, start: ang }); }
      if (hatStyle === 'bowler') { inkArc(hc[0], hc[1] - R * 0.5, R * 0.85, R * 0.75, Math.PI, Math.PI * 2, { w: lw * 0.8, fill: ink, color: ink, closed: true }); inkLine(hc[0] - R * 1.25, hc[1] - R * 0.5, hc[0] + R * 1.25, hc[1] - R * 0.5, { w: lw * 1.2, color: ink }); }
      if (helmet) {   // Greek helmet: cap over the top of the head and a red crest
        inkArc(hc[0], hc[1], (hr + 4) * s, (hr + 4) * s, Math.PI * 1.02, Math.PI * 1.98, { w: lw * 1.1, color: ink });
        inkLine(hc[0] - (hr + 4) * s, hc[1] - 2 * s, hc[0] - (hr - 10) * s, hc[1] + 26 * s, { w: lw, color: ink });
        inkCurve([hc[0] - 34 * s, hc[1] - 50 * s], [hc[0] + 6 * s, hc[1] - 112 * s], [hc[0] + 56 * s, hc[1] - 40 * s], { w: lw * 2.6, color: C.red });
      }
      if (tag) DOCENT.pendingTags.push({ str: tag, size: tagS, color: docentTagInk(acc) || KEY(), w: tagW, own: anchors.box, m: ctx.getTransform(), a: ctx.globalAlpha, ghostOk: !!o.ghostOk,
        cands: o.tagSide ? [[tagX, tagY]] : [[tagX, tagY], [tagX === toward ? away : toward, tagY], [x, topY - tagS * 0.75]] });
    });
  });
  if (o.ghostOk) DOCENT.ghostOk--;
  return anchors;
}
// ---------- cast: one fixed look per person ----------
// cast('musk', { hair: 'short', outfit: 'suit', accent: 'red', name: '머스크' }); person('musk', 600, 880, { pose: 'point' })
// The look is the same in every shot, so viewers can tell people apart. Give every person in a book a different
// silhouette (hair or hat), and a different accent colour; show the name tag the first time they appear (tag: true).
const CAST = {};
function cast(id, look) { CAST[id] = look; return look; }
function person(id, x, y, o = {}) {
  const look = CAST[id]; if (!look) { MISS.add('cast:' + id); return figure(x, y, o); }
  const { name, ...rest } = look; const { tag, ...oo } = o;
  return figure(x, y, { ...rest, ...oo, _cast: id, tag: tag ? (typeof tag === 'string' ? tag : name || id) : null });
}
function drawFace(cx, cy, r, face, { look = 0, ink = null, t = 0, blindfold = false } = {}) {
  const k = r / 44, ex = 14 * k, ey = -6 * k, lx = look * 6 * k;
  const o = { w: 3.4 * Math.max(0.7, Math.sqrt(k)), color: ink || INK() };
  const dot = (x, y) => disc(x, y, 4.2 * Math.max(0.7, k), ink || INK());
  if (blindfold) { inkRect(cx - r * 0.98, cy - 16 * k, r * 1.96, 18 * k, { ...o, fill: ink || INK() }); }
  else if (face === 'happy') { inkArc(cx - ex + lx, cy + ey + 4 * k, 8 * k, 6 * k, Math.PI * 1.1, Math.PI * 1.9, o); inkArc(cx + ex + lx, cy + ey + 4 * k, 8 * k, 6 * k, Math.PI * 1.1, Math.PI * 1.9, o); }
  else if (face === 'cool') { inkRect(cx - 30 * k, cy - 14 * k, 60 * k, 16 * k, { ...o, fill: ink || INK() }); }
  else if (face === 'sleepy' || face === 'wink') { inkLine(cx - ex - 7 * k + lx, cy + ey, cx - ex + 7 * k + lx, cy + ey, o); if (face === 'wink') dot(cx + ex + lx, cy + ey); else inkLine(cx + ex - 7 * k + lx, cy + ey, cx + ex + 7 * k + lx, cy + ey, o); }
  else { dot(cx - ex + lx, cy + ey); dot(cx + ex + lx, cy + ey); }
  const my = cy + 16 * k;
  switch (face) {
    case 'smile': case 'wink': inkArc(cx + lx * 0.5, my - 8 * k, 14 * k, 10 * k, Math.PI * 0.15, Math.PI * 0.85, o); break;
    case 'happy': case 'cool': inkArc(cx + lx * 0.5, my - 10 * k, 18 * k, 14 * k, Math.PI * 0.1, Math.PI * 0.9, { ...o, fill: ink || INK(), closed: true }); break;
    case 'sad': inkArc(cx + lx * 0.5, my + 8 * k, 13 * k, 9 * k, Math.PI * 1.15, Math.PI * 1.85, o); break;
    case 'surprised': inkCircle(cx + lx * 0.5, my, 7 * k, o); inkLine(cx - ex - 8 * k, cy - 20 * k, cx - ex + 6 * k, cy - 24 * k, o); inkLine(cx + ex - 6 * k, cy - 24 * k, cx + ex + 8 * k, cy - 20 * k, o); break;
    case 'worried': inkPath([[cx - 12 * k, my], [cx - 4 * k, my - 4 * k], [cx + 4 * k, my], [cx + 12 * k, my - 4 * k]], o); inkLine(cx - ex - 8 * k, cy - 18 * k, cx - ex + 6 * k, cy - 22 * k, o); inkLine(cx + ex - 6 * k, cy - 22 * k, cx + ex + 8 * k, cy - 18 * k, o); break;
    case 'angry': inkLine(cx - 12 * k, my, cx + 12 * k, my, o); inkLine(cx - ex - 8 * k, cy - 22 * k, cx - ex + 8 * k, cy - 14 * k, o); inkLine(cx + ex - 8 * k, cy - 14 * k, cx + ex + 8 * k, cy - 22 * k, o); break;
    case 'think': inkLine(cx + 2 * k + lx, my, cx + 14 * k + lx, my - 3 * k, o); break;
    case 'sleepy': inkCircle(cx, my, 5 * k, o); break;
    default: inkLine(cx - 9 * k + lx * 0.5, my, cx + 9 * k + lx * 0.5, my, o);   // neutral
  }
}
// characters used often in book videos
const tortoise = (x, y, o = {}) => figure(x, y, { shell: true, s: 0.9, ...o });
const achilles = (x, y, o = {}) => figure(x, y, { helmet: true, ...o });
function crab(x, y, { s = 1, p = 1, a = 1, t = 0 } = {}) {
  const o = { p, a, w: 4 * s };
  inkEllipse(x, y - 60 * s, 90 * s, 48 * s, { ...o, fill: mix(C.red, 0.28) });
  for (const d of [-1, 1]) {
    inkLine(x + d * 22 * s, y - 104 * s, x + d * 26 * s, y - 140 * s, o); disc(x + d * 26 * s, y - 146 * s, 8 * s, INK(), a * p);
    for (let i = 0; i < 3; i++) inkPoly([[x + d * (60 + i * 10) * s, y - 40 * s], [x + d * (100 + i * 12) * s, y - 20 * s], [x + d * (110 + i * 12) * s, y]], o);
    const cl = 6 * Math.sin(t * 5);
    inkPoly([[x + d * 80 * s, y - 84 * s], [x + d * 130 * s, y - 130 * s]], o);
    inkArc(x + d * 146 * s, y - 148 * s, 26 * s, 26 * s, d > 0 ? Math.PI * 0.6 : Math.PI * 0.1 + cl * 0.01, d > 0 ? Math.PI * 2.4 : Math.PI * 1.9, o);
  }
  inkArc(x, y - 66 * s, 22 * s, 12 * s, Math.PI * 0.15, Math.PI * 0.85, o);
}
function ant(x, y, { s = 1, p = 1, a = 1, t = 0, dir = 1, color = null } = {}) {
  const o = { p, a, w: 3 * s, color, jit: 0.6 };
  const ink = color || INK();
  for (const [dx, r] of [[-26, 13], [0, 10], [24, 15]]) withAlpha(a * p, () => disc(x + dir * dx * s, y - 16 * s, r * s, ink));
  for (const k of [-1, 0, 1]) {
    const sw = 5 * Math.sin(t * 14 + k * 2);
    inkPoly([[x + k * 10 * s, y - 16 * s], [x + (k * 16 + sw) * s, y - 32 * s], [x + (k * 22 + sw) * s, y - 2 * s]], o);
    inkPoly([[x + k * 10 * s, y - 16 * s], [x + (k * 16 - sw) * s, y], [x + (k * 22 - sw) * s, y + 6 * s]], o);
  }
  inkCurve([x + dir * 34 * s, y - 24 * s], [x + dir * 46 * s, y - 50 * s], [x + dir * 58 * s, y - 44 * s], o);
}

// ---------- animals ----------
// animal(kind, x, y, o): (x, y) = the point under the body on the ground; o: { s (1 = about 300 px long), dir (1 faces
// right), p, a, t, color, fill, tag }. Each animal is built from ovals with the 3 or 4 features people name it by
// (anteater: long tube snout, tiny head and eye, bushy tail as big as the body, thick clawed front legs, dark
// shoulder stripe). Never draw an animal with the stick-figure rig (figure()). Check new kinds on a gallery sheet
// (docentGallery('animals')) before a scene uses them. Returns { head: [x, y], r, mouth, top, box, dir } like figure().
const ANIMALS = {
  anteater: (T, o, q) => {
    const fur = o.fill || opaqueMix(C.grey, 0.6), dark = o.color || INK(), pale = C.paper || '#ffffff';
    const R = { ...o, round: 2 };
    // far legs (darker, behind the body)
    inkPath([T(-64, -70), T(-72, -2), T(-44, -2), T(-40, -70)], { ...R, closed: true, p: q(0), fill: opaqueMix(C.dim, 0.6), round: 1 });
    inkPath([T(30, -70), T(32, -2), T(60, -2), T(58, -70)], { ...R, closed: true, p: q(0), fill: opaqueMix(C.dim, 0.45), round: 1 });
    // the bushy tail: a long low flag as big as the body, long hair hanging from its underside
    const tail = [T(-104, -132), T(-170, -150), T(-250, -138), T(-330, -104), T(-344, -70), T(-300, -46), T(-220, -40), T(-150, -50), T(-112, -80)];
    inkPath(tail, { ...R, closed: true, p: q(1), fill: opaqueMix(C.dim, 0.7), jit: 1.8 });
    for (let i = 0; i < 11; i++) { const u = i / 10, [ax, ay] = T(-130 - u * 200, -46 + Math.sin(u * 3.1) * -6 + u * 2), k = (18 + 10 * Math.abs(Math.sin(i * 1.7))) * o.s;
      inkLine(ax, ay, ax - 10 * o.dir * o.s, ay + k, { ...o, p: q(1), w: o.w * 0.55, jit: 0.3 }); }
    for (let i = 0; i < 6; i++) { const u = i / 5, [ax, ay] = T(-170 - u * 150, -146 + u * 40); inkLine(ax, ay, ax - 16 * o.dir * o.s, ay - 10 * o.s, { ...o, p: q(1), w: o.w * 0.5, jit: 0.3 }); }
    // body, neck and the long tube snout in one outline
    const body = [T(-116, -104), T(-84, -150), T(-10, -160), T(58, -146), T(100, -120), T(132, -104), T(190, -90), T(246, -76), T(276, -68),
      T(278, -60), T(246, -62), T(186, -70), T(128, -76), T(92, -66), T(36, -56), T(-40, -54), T(-98, -66)];
    inkPath(body, { ...R, closed: true, p: q(2), fill: fur });
    // near legs: a dark hind leg, a pale front leg with a black wrist band and knuckle claws
    inkPath([T(-92, -70), T(-98, 0), T(-60, 0), T(-58, -74)], { ...R, closed: true, p: q(3), fill: opaqueMix(C.dim, 0.75), round: 1 });
    inkPath([T(52, -70), T(54, 0), T(94, 0), T(92, -78)], { ...R, closed: true, p: q(3), fill: pale, round: 1 });
    inkPath([T(53, -34), T(93, -36), T(93, -24), T(53, -22)], { ...o, closed: true, p: q(3), fill: dark, w: o.w * 0.5 });
    for (const k of [0, 1, 2]) inkCurve(T(94 - k * 11, -2), T(108 - k * 11, -8), T(104 - k * 11, 6), { ...o, p: q(3), w: o.w * 0.8 });
    // the shoulder stripe: a black wedge from the throat over the shoulder, edged in white
    const stripe = [T(114, -80), T(76, -66), T(26, -116), T(-18, -158), T(32, -162), T(86, -124)];
    inkPath(stripe, { ...o, closed: true, p: q(4), fill: dark, w: o.w * 0.6, round: 1 });
    inkCurve(T(114, -82), T(84, -126), T(44, -158), { ...o, p: q(4), color: pale, w: o.w * 1.3, jit: 0.4 });
    // small round ear, tiny eye, mouth at the very tip
    inkArc(...T(118, -112), 10 * o.s, 9 * o.s, Math.PI, Math.PI * 2, { ...o, p: q(4), w: o.w * 0.8 });
    const e = T(150, -94); disc(e[0], e[1], 4.5 * o.s, dark, o.a * clamp01(q(4) * 2));
    return { head: T(150, -86), r: 28 * o.s, mouth: T(276, -64), top: T(40, -172) };
  },
  cat: (T, o, q) => {   // sitting cat, three-quarter view: pointed ears, whiskers, slit eyes, tail curled round the feet
    const fur = o.fill || opaqueMix(C.orange, 0.45);
    inkCurve(T(-40, -10), T(-120, -20), T(-96, -110), { ...o, p: q(0), w: o.w * 2.2 });
    inkPath([T(-50, 0), T(-62, -70), T(-30, -132), T(30, -132), T(62, -70), T(50, 0)], { ...o, closed: true, p: q(1), fill: fur, round: 2 });
    inkPath([T(-60, -176), T(-48, -244), T(-14, -206), T(14, -206), T(48, -244), T(60, -176), T(48, -140), T(0, -128), T(-48, -140)], { ...o, closed: true, p: q(2), fill: fur });
    for (const d of [-1, 1]) {
      inkPath([T(d * 18, -168), T(d * 34, -176)], { ...o, p: q(3), w: o.w * 1.2 });
      for (const k of [-1, 0, 1]) inkLine(...T(d * 18, -152), ...T(d * 74, -158 + k * 12), { ...o, p: q(3), w: o.w * 0.5 });
    }
    inkPath([T(-6, -154), T(6, -154), T(0, -146)], { ...o, closed: true, p: q(3), fill: C.red, w: o.w * 0.6 });
    for (const d of [-1, 1]) inkLine(...T(d * 20, -2), ...T(d * 20, -36), { ...o, p: q(3), w: o.w * 0.7 });
    return { head: T(0, -180), r: 58 * o.s, mouth: T(0, -144), top: T(0, -246) };
  },
  dog: (T, o, q) => {   // standing dog, side view: muzzle with a black nose, floppy ear, raised tail, collar
    const fur = o.fill || opaqueMix(C.yellow, 0.4);
    inkCurve(T(-110, -120), T(-150, -170), T(-128, -200), { ...o, p: q(0), w: o.w * 1.8 });
    for (const [k, lx] of [-70, 64, -100, 36].entries()) inkPath([T(lx - 14, -92), T(lx - 10, -10), T(lx - 15, 0), T(lx + 16, 0), T(lx + 11, -10), T(lx + 14, -92)], { ...o, closed: true, round: 1, p: q(1), fill: k < 2 ? opaqueMix(C.dim, 0.35) : fur });   // tapered legs, small paws
    inkEllipse(...T(-5, -120), 118 * o.s, 50 * o.s, { ...o, p: q(1), fill: fur });
    inkPath([T(70, -150), T(96, -214), T(150, -216), T(200, -186), T(206, -164), T(150, -150), T(118, -132)], { ...o, closed: true, p: q(2), fill: fur, round: 2 });
    inkPath([T(112, -210), T(92, -206), T(80, -150), T(98, -146), T(112, -170)], { ...o, closed: true, p: q(3), fill: opaqueMix(C.dim, 0.7), round: 2 });
    const n = T(204, -176); disc(n[0], n[1], 9 * o.s, INK(), o.a * clamp01(q(3) * 2));
    const e = T(140, -194); disc(e[0], e[1], 5 * o.s, INK(), o.a * clamp01(q(3) * 2));
    inkLine(...T(80, -150), ...T(108, -128), { ...o, p: q(3), color: C.red, w: o.w * 2.2 });
    return { head: T(150, -184), r: 44 * o.s, mouth: T(196, -158), top: T(130, -220) };
  },
  bird: (T, o, q) => {   // perched bird: beak, wing on the body, fanned tail, two thin legs
    const f = o.fill || opaqueMix(C.teal, 0.45);
    for (const d of [-10, 10]) inkPoly([T(d, -40), T(d, 0), T(d + 12, 0)], { ...o, p: q(0), w: o.w * 0.7 });
    inkPath([T(-60, -86), T(-126, -60), T(-130, -96), T(-80, -108)], { ...o, closed: true, p: q(1), fill: f });
    inkEllipse(...T(0, -84), 66 * o.s, 46 * o.s, { ...o, p: q(1), fill: f });
    inkCircle(...T(52, -134), 34 * o.s, { ...o, p: q(2), fill: f });
    inkPath([T(82, -142), T(118, -132), T(84, -122)], { ...o, closed: true, p: q(3), fill: C.yellow });
    inkPath([T(-40, -100), T(30, -102), T(10, -66), T(-30, -60)], { ...o, closed: true, p: q(3), fill: opaqueMix(C.dim, 0.35) });
    const e = T(60, -142); disc(e[0], e[1], 5 * o.s, INK(), o.a * clamp01(q(3) * 2));
    return { head: T(52, -134), r: 34 * o.s, mouth: T(112, -132), top: T(52, -170) };
  },
  fish: (T, o, q) => {   // side view: tail fin, dorsal fin, gill arc, eye, a few scales
    const f = o.fill || opaqueMix(C.orange, 0.5);
    inkPath([T(-90, -90), T(-150, -130), T(-140, -90), T(-150, -50)], { ...o, closed: true, p: q(0), fill: f });
    inkPath([T(-20, -134), T(10, -170), T(40, -132)], { ...o, closed: true, p: q(0), fill: f });
    inkEllipse(...T(0, -90), 100 * o.s, 46 * o.s, { ...o, p: q(1), fill: f });
    inkArc(...T(48, -90), 22 * o.s, 34 * o.s, -Math.PI * 0.45, Math.PI * 0.45, { ...o, p: q(2) });
    for (const [sx, sy] of [[-30, -100], [-6, -80], [-50, -78], [-24, -60]]) inkArc(...T(sx, sy), 12 * o.s, 12 * o.s, -Math.PI * 0.4, Math.PI * 0.4, { ...o, p: q(2), w: o.w * 0.5 });
    const e = T(70, -100); disc(e[0], e[1], 6 * o.s, INK(), o.a * clamp01(q(2) * 2));
    return { head: T(66, -94), r: 34 * o.s, mouth: T(100, -86), top: T(10, -172) };
  },
  mouse: (T, o, q) => {   // big round ears, pointed nose with whiskers, long thin tail
    const f = o.fill || opaqueMix(C.grey, 0.6);
    inkCurve(T(-70, -20), T(-170, 10), T(-200, -60), { ...o, p: q(0), w: o.w * 0.6 });
    inkPath([T(-76, 0), T(-84, -46), T(-30, -84), T(40, -72), T(96, -32), T(116, -16), T(60, 0)], { ...o, closed: true, p: q(1), fill: f, round: 2 });
    inkCircle(...T(30, -86), 26 * o.s, { ...o, p: q(2), fill: opaqueMix(C.magenta, 0.25) });
    const n = T(112, -18); disc(n[0], n[1], 6 * o.s, INK(), o.a * clamp01(q(3) * 2));
    for (const k of [-1, 1]) inkLine(...T(100, -22), ...T(140, -22 + k * 14), { ...o, p: q(3), w: o.w * 0.4 });
    const e = T(64, -40); disc(e[0], e[1], 4 * o.s, INK(), o.a * clamp01(q(3) * 2));
    return { head: T(70, -38), r: 30 * o.s, mouth: T(108, -16), top: T(30, -112) };
  },
  rabbit: (T, o, q) => {   // sitting: two long upright ears, round tail, big hind foot
    const f = o.fill || opaqueMix(C.paper || '#ffffff', 0.95);
    inkCircle(...T(-74, -50), 18 * o.s, { ...o, p: q(0), fill: f });
    inkEllipse(...T(-10, -66), 70 * o.s, 62 * o.s, { ...o, p: q(1), fill: f });
    inkEllipse(...T(10, -6), 46 * o.s, 12 * o.s, { ...o, p: q(1), fill: f });
    for (const d of [-14, 14]) inkEllipse(...T(46 + d, -222), 13 * o.s, 50 * o.s, { ...o, p: q(2), fill: f });
    inkCircle(...T(52, -150), 40 * o.s, { ...o, p: q(2), fill: f });
    const e = T(66, -158); disc(e[0], e[1], 5 * o.s, INK(), o.a * clamp01(q(3) * 2));
    const n = T(90, -144); disc(n[0], n[1], 4 * o.s, C.red, o.a * clamp01(q(3) * 2));
    return { head: T(52, -150), r: 40 * o.s, mouth: T(88, -138), top: T(52, -272) };
  },
  elephant: (T, o, q) => {   // big body, pillar legs, large ear, trunk, tusk
    const f = o.fill || opaqueMix(C.grey, 0.7);
    for (const lx of [-90, -50, 40, 80]) inkPath([T(lx - 18, -80), T(lx - 18, 0), T(lx + 18, 0), T(lx + 18, -80)], { ...o, closed: true, p: q(0), fill: f });
    inkEllipse(...T(-5, -130), 130 * o.s, 80 * o.s, { ...o, p: q(1), fill: f });
    inkCurve(T(-132, -150), T(-150, -110), T(-146, -80), { ...o, p: q(1), w: o.w * 0.8 });
    inkCircle(...T(120, -170), 56 * o.s, { ...o, p: q(2), fill: f });
    inkPath([T(160, -150), T(186, -100), T(188, -40), T(204, -30), T(208, -46), T(198, -110), T(176, -168)], { ...o, closed: true, p: q(2), fill: f, round: 1 });
    inkPath([T(100, -214), T(60, -200), T(48, -150), T(70, -104), T(104, -112), T(112, -160)], { ...o, closed: true, p: q(3), fill: f, round: 2 });
    inkCurve(T(150, -130), T(180, -112), T(196, -128), { ...o, p: q(3), color: C.paper || '#ffffff', w: o.w * 1.8 });
    const e = T(140, -186); disc(e[0], e[1], 5 * o.s, INK(), o.a * clamp01(q(3) * 2));
    return { head: T(120, -170), r: 56 * o.s, mouth: T(150, -136), top: T(110, -226) };
  },
};
function animal(kind, x, y, o = {}) {
  const f = ANIMALS[kind]; if (!f) { MISS.add('animal:' + kind); return null; }
  const oo = { s: 1, dir: 1, p: 1, a: 1, t: 0, color: null, ...o }; const s = oo.s, dir = oo.dir < 0 ? -1 : 1;
  oo.dir = dir; oo.w = (o.w || 4) * Math.max(0.7, Math.sqrt(s));
  const T = (px, py) => [x + dir * px * s, y + py * s];
  const q = (k) => clamp01((oo.p * 5.6 - k) / 1.4);   // staged draw-on in five steps; every step is complete at p = 1
  const hidden = oo.p <= 0 || oo.a <= 0;
  const io = { p: hidden ? 0 : oo.p, a: oo.a, color: oo.color, w: oo.w, s, dir, fill: oo.fill };
  let anc = null;
  withAlpha(hidden ? 0 : 1, () => { anc = f(T, io, hidden ? () => 0 : q); });   // p = 0 draws nothing but still yields the anchors
  const half = (anc.half || 270) * s, xs = [x - half, x + half].sort((u, v) => u - v);
  anc.box = [xs[0], anc.top[1], xs[1], y]; anc.dir = dir; anc.animal = kind;
  let tagRect = null, str = null;
  if (o.tag) { str = typeof o.tag === 'string' ? o.tag : kind; const tw = handW(str, 40) / 2 + 6;
    anc.top = [anc.top[0], anc.top[1] - 70]; anc.box[1] = anc.top[1]; tagRect = [anc.top[0] - tw, anc.top[1], anc.top[0] + tw, anc.top[1] + 48]; }
  DOCENT.slots.figs.push(withM(anc.box)); DOCENT.slots.heads.push([anc.head[0], anc.head[1], anc.r]); if (tagRect) DOCENT.slots.tags.push(tagRect);
  if (hidden) return anc;
  DOCENT.heads.push([anc.head[0], anc.head[1], anc.r, null, ++DOCENT.seq]); DOCENT.mouths.push(anc.mouth);
  { const m = ctx.getTransform(); DOCENT.faces.push([m.a * anc.head[0] + m.c * anc.head[1] + m.e, m.b * anc.head[0] + m.d * anc.head[1] + m.f, anc.r * Math.hypot(m.a, m.b), DOCENT.seq]); } DOCENT.figs.push(anc.box); DOCENT.animals.push(kind);
  if (tagRect) { const rec = [...tagRect, anc.box]; rec.m = anc.box.m; DOCENT.tags.push(rec); hand(str, anc.top[0], anc.top[1] + 24, { size: 40, p: oo.p, a: oo.a }); }
  return anc;
}
// Asset gallery: every cast look, animal and prop on one labelled sheet, for review before a scene uses them
// (make-docent-book §4 gate; tools/gallery.py renders it). kind: 'cast' | 'animals' | 'props' | 'figures'.
function docentGallery(kind, page = 0) {
  const items = kind === 'cast' ? Object.keys(CAST) : kind === 'animals' ? Object.keys(ANIMALS) : kind === 'props' ? Object.keys(PROPS) : ['short', 'spiky', 'curly', 'long', 'bun', 'ponytail', 'side', 'bald'];
  const per = 8, cols = 4, list = items.slice(page * per, page * per + per);   // wide props (ship, stadium) need a 473 px cell
  list.forEach((id, i) => {
    const cy = i < cols ? 460 : 880;
    const x = 250 + (i % cols) * 473;
    if (kind === 'cast') person(id, x, cy - 40, { s: 0.85, tag: true });
    else if (kind === 'animals') animal(id, x, cy - 60, { s: 0.62 });
    else if (kind === 'props') prop(id, x, cy - 90, 0.75);
    else figure(x, cy - 40, { s: 0.85, hair: id, accent: ['red', 'blue', 'green', 'orange', 'teal', 'magenta', 'yellow', 'grey'][i], outfit: ['suit', 'dress', 'tshirt', 'coat'][i % 4] });
    hand(id, x, cy - 10, { size: 34, color: C.dim });
  });
  docentTags();
  return items.length;
}

// ---------- bubbles, boards, cards ----------
// Speech bubble (rounded box) or thought bubble (cloud). tail = [x, y] the bubble points at: the tail leaves from the
// edge nearest that point, so a bubble left of a head gets a tail on its right side. body(x, y, w, h) draws what is
// inside, or pass text. Prefer say()/think() below: they place the bubble next to a figure and aim the tail for you.
function bubblePath(x, y, w, h, r, tail) {
  const pts = [];
  const corner = (ccx, ccy, a0) => { for (let i = 0; i <= 6; i++) { const ang = a0 + (i / 6) * Math.PI / 2; pts.push([ccx + Math.cos(ang) * r, ccy + Math.sin(ang) * r]); } };
  let edge = null, tx = 0, ty = 0;
  if (tail) {
    [tx, ty] = tail;
    const cx = x + w / 2, cy = y + h / 2, dx = (tx - cx) / (w / 2), dy = (ty - cy) / (h / 2);
    edge = Math.abs(dy) >= Math.abs(dx) ? (dy > 0 ? 'b' : 't') : (dx > 0 ? 'r' : 'l');
  }
  const bw = Math.min(44, (edge === 'l' || edge === 'r' ? h : w) * 0.28) / 2;
  const along = (lo, hi, v) => Math.max(lo + bw, Math.min(hi - bw, v));
  corner(x + r, y + r, Math.PI);                                                       // top-left
  if (edge === 't') { const c = along(x + r, x + w - r, lerp(x + w / 2, tx, 0.6)); pts.push([c - bw, y], [tx, ty], [c + bw, y]); }
  corner(x + w - r, y + r, -Math.PI / 2);                                              // top-right
  if (edge === 'r') { const c = along(y + r, y + h - r, lerp(y + h / 2, ty, 0.6)); pts.push([x + w, c - bw], [tx, ty], [x + w, c + bw]); }
  corner(x + w - r, y + h - r, 0);                                                     // bottom-right
  if (edge === 'b') { const c = along(x + r, x + w - r, lerp(x + w / 2, tx, 0.6)); pts.push([c + bw, y + h], [tx, ty], [c - bw, y + h]); }
  corner(x + r, y + h - r, Math.PI / 2);                                               // bottom-left
  if (edge === 'l') { const c = along(y + r, y + h - r, lerp(y + h / 2, ty, 0.6)); pts.push([x, c + bw], [tx, ty], [x, c - bw]); }
  return pts;
}
// does the bubble [x, y, w, h] or its tail toward `tip` cross rect g = [x0, y0, x1, y1]?
function bubbleCrosses(x, y, w, h, tip, g) {
  if (g[2] > x && g[0] < x + w && g[3] > y && g[1] < y + h) return true;
  if (!tip) return false;
  const bx = Math.max(x, Math.min(x + w, lerp(x + w / 2, tip[0], 0.6))), by = Math.max(y, Math.min(y + h, lerp(y + h / 2, tip[1], 0.6)));
  for (let i = 0; i <= 14; i++) { const u = i / 14, px = lerp(bx, tip[0], u), py = lerp(by, tip[1], u); if (px > g[0] - 4 && px < g[2] + 4 && py > g[1] - 4 && py < g[3] + 4) return true; }
  return false;
}
function bubble(x, y, w, h, { tail = null, kind = 'speech', text: str = null, size = 44, p = 1, a = 1, body = null, color = null, tailOk = false, ghostOk: o_ghostOk = false } = {}) {
  DOCENT.slots.bubbles.push(withM([x, y, x + w, y + h]));   // reserved even before it pops in, so later bubbles do not move
  if (p <= 0 || a <= 0) return;
  if (!str && !body) docentNote('empty', `bubble@${Math.round(x)},${Math.round(y)}`);
  if (str && String(str).trim().split(/\s+/).length > 8) docentNote('wordy', String(str).slice(0, 16));
  if (tail && !tailOk) DOCENT.tails.push([tail[0], tail[1], kind]);
  if (p < 0.98) docentNote('partial', 'bubble');
  if (o_ghostOk) DOCENT.ghostOk++;
  const entry = [x, y, x + w, y + h, tailOk ? null : tail, [0, 0]]; DOCENT.bubbles.push(entry);
  if (str) { const n = handLines(str, w - 50, size).length; if (n * size * 1.25 > h - 16) docentNote('overflow', String(str).slice(0, 16)); }
  const sc = 0.6 + 0.4 * backOut(p);
  withAlpha(a * clamp01(p * 2.5), () => {
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(sc, sc); ctx.translate(-(x + w / 2), -(y + h / 2));
    const cx = x + w / 2, cy = y + h / 2;
    if (kind === 'thought') {
      const n = Math.max(8, Math.round((w + h) / 70)), pts = [];
      for (let i = 0; i <= n * 6; i++) {
        const u = i / (n * 6), ang = u * Math.PI * 2, bump = Math.abs(Math.sin(u * n * Math.PI));
        pts.push([cx + Math.cos(ang) * (w / 2 + 14 * bump), cy + Math.sin(ang) * (h / 2 + 14 * bump)]);
      }
      inkPath(pts, { closed: true, fill: PAPER(), w: 3.6, jit: 0.8, color });
      if (tail) {   // three shrinking puffs from the cloud's edge toward the head
        const [tx, ty] = tail, th = Math.atan2(ty - cy, tx - cx);
        const ex = cx + Math.cos(th) * (w / 2 + 16), ey = cy + Math.sin(th) * (h / 2 + 16);
        for (const [f, r] of [[0.2, 13], [0.55, 9], [0.85, 6]]) inkCircle(lerp(ex, tx, f), lerp(ey, ty, f), r, { w: 3, fill: PAPER(), color });
      }
    } else {
      inkPath(bubblePath(x, y, w, h, Math.min(40, h / 2.2), tail), { closed: true, fill: PAPER(), w: 3.6, jit: 0.8, color });
    }
    if (str) handBlock(str, cx, cy, w - 50, { size, color: color || INK() });
    if (body) { const k0 = DOCENT.heads.length; body(x, y, w, h); entry[5] = [k0, DOCENT.heads.length]; }
    ctx.restore();
  });
  if (o_ghostOk) DOCENT.ghostOk--;
}
// say(who, text, o) / think(who, text, o): a bubble next to a figure, placed where it covers no face, no other figure
// and no earlier bubble, inside the safe frame (x 60..1860, y 70..860, above the subtitles), on the side the figure
// faces when possible. who = what figure()/person() returned (draw every figure of the shot first, then the bubbles).
// The tail stops just short of the mouth (comics rule: aim at the mouth, never touch it). o: { p, a, size, side:
// 'auto' | 'left' | 'right' | 'up', w, h, body, color }. Returns the bubble rect [x, y, w, h].
function say(who, str, o = {}) { return placeBubble(who, str, { ...o, kind: o.kind || 'speech' }); }
function think(who, str, o = {}) { return placeBubble(who, str, { ...o, kind: 'thought' }); }
function placeBubble(who, str, { side = 'auto', size = 46, w: w0 = null, h: h0 = null, kind = 'speech', ...o } = {}) {
  if (!who || !who.head) { if ((o.p ?? 1) > 0) MISS.add('say:no-figure'); return null; }
  const [hx, hy] = who.head, r = who.r, top = who.top[1];
  let w = w0, h = h0;
  if (!w || !h) {
    const pad = kind === 'thought' ? 110 : 76;
    if (!w) { const one = str ? handW(str, size) : 220; const ls = str ? (one + pad > 620 ? handLines(str, 620 - pad, size) : [str]) : [''];
      w = Math.max(kind === 'thought' ? 260 : 200, Math.min(620, Math.max(...ls.map((l) => (l ? handW(l, size) : 220))) + pad)); }
    const lines = str ? handLines(str, w - 50, size) : [''];   // the same wrap bubble() uses
    h = h || Math.max(kind === 'thought' ? 130 : 100, lines.length * size * 1.25 + (kind === 'thought' ? 64 : 40));
  }
  const gap = kind === 'thought' ? 70 : 46;
  const cand = {
    upR: [hx + r * 0.3, top - h - gap * 0.6], upL: [hx - r * 0.3 - w, top - h - gap * 0.6],
    up: [hx - w / 2, top - h - gap], right: [hx + r + gap, hy - h * 0.85], left: [hx - r - gap - w, hy - h * 0.85],
    upR2: [hx + r + gap, top - h * 0.6], upL2: [hx - r - gap - w, top - h * 0.6],
    high: [hx - w / 2, top - h - gap - 150], highL: [hx - w * 0.9, top - h - gap - 120], highR: [hx - w * 0.1, top - h - gap - 120],
  };
  const all = who.dir < 0 ? ['upL', 'left', 'upL2', 'up', 'upR', 'right', 'upR2', 'highL', 'high', 'highR'] : ['upR', 'right', 'upR2', 'up', 'upL', 'left', 'upL2', 'highR', 'high', 'highL'];
  const want = side === 'left' ? ['left', 'upL', 'upL2'] : side === 'right' ? ['right', 'upR', 'upR2'] : side === 'up' ? ['up', 'high'] : all;
  const order = [...want, ...all.filter((k) => !want.includes(k))];   // a side that does not fit falls through to the others
  const hit = (b, x, y) => Math.max(0, Math.min(b[2], x + w) - Math.max(b[0], x)) * Math.max(0, Math.min(b[3], y + h) - Math.max(b[1], y));
  let best = null;
  for (const [k, key] of order.entries()) {
    let [x, y] = cand[key];
    const dx = Math.max(60 - x, 0) - Math.max(x + w - 1860, 0), dy = Math.max(70 - y, 0) - Math.max(y + h - 860, 0);
    x += dx; y += dy;   // slide inside the safe frame, then score what the slide made it cover
    let cost = k * 400 + (k >= want.length ? 3000 : 0) + (Math.abs(dx) + Math.abs(dy)) * 2;
    for (const b of DOCENT.slots.figs) if (b !== who.box) cost += hit(b, x, y) * 0.5;
    if (kind !== 'thought' && !who.animal && Math.abs(x + w / 2 - hx) < r * 1.2) cost += 1500;   // right above the head: the tail would hit the scalp
    if (kind !== 'thought' && who.brim && Math.sign(x + w / 2 - hx) === who.brim) cost += 2600;   // the brim side: the tail crosses or hugs the cap's brim (PR #58 review); the back of the head is free
    for (const b of DOCENT.slots.things) cost += hit(b, x, y) * 3;   // a bubble over a prop or a board hides the picture
    for (const b of DOCENT.slots.bubbles) cost += hit(b, x, y) * 12 + (hit(b, x, y) > 0 ? 20000 : 0);
    for (const [cx, cy, cr] of DOCENT.slots.heads) cost += hit([cx - cr, cy - cr, cx + cr, cy + cr], x, y) * 12;
    const [mx0, my0] = kind === 'thought' ? [hx, hy - r * 0.2] : who.mouth;
    for (const g of DOCENT.slots.tags) if (bubbleCrosses(x, y, w, h, [mx0, my0], g)) cost += 50000;
    if (kind !== 'thought' && !who.animal) {   // a tail that has to cross the whole head reads as aimed at the scalp
      const th = Math.atan2(y + h / 2 - my0, x + w / 2 - mx0), ux = Math.cos(th), uy = Math.sin(th), fx = mx0 - hx, fy = my0 - hy;
      const B = fx * ux + fy * uy, exit = -B + Math.sqrt(Math.max(0, B * B - (fx * fx + fy * fy - r * r)));
      cost += Math.max(0, exit / r - 0.9) * 2500;
    }
    if (!best || cost < best.cost) best = { x, y, cost };
  }
  const { x, y } = best, bx = x + w / 2, by = y + h / 2;
  const [mx, my] = kind === 'thought' ? [hx, hy - r * 0.2] : who.mouth;
  // aim at the mouth but stop outside the head: the first point on the ray mouth -> bubble that clears the head by 8 px
  const ux = Math.cos(Math.atan2(by - my, bx - mx)), uy = Math.sin(Math.atan2(by - my, bx - mx));
  const R2 = r + (kind === 'thought' ? 26 : 8), fx = mx - hx, fy = my - hy, B = fx * ux + fy * uy, Cq = fx * fx + fy * fy - R2 * R2;
  const d = Math.max(kind === 'thought' ? 0 : r * 0.3, -B + Math.sqrt(Math.max(0, B * B - Cq)));
  let tail = [mx + ux * d, my + uy * d];
  if (!who.animal && top < hy - r * 1.1) {   // hair or a hat rises above the bare head: keep the tip out of that band
    const band = r * 1.1;
    if (tail[1] > top - 8 && tail[1] < my - r * 0.2 && Math.abs(tail[0] - hx) < band) {   // hair also fills the temples (curls)
      // a bubble right above leaves by the top (going round the side grazed a top hat's brim); any other bubble ends
      // beside the face at mouth height, so the tail never reads as aimed at the hair (2026-11-10 lab frame: tip on curls)
      const sd = Math.sign(bx - hx || 1), reach = who.brim && sd === who.brim ? r * 1.7 + 14 : band + 12;   // past a cap's brim (PR #58 review round 2)
      tail = Math.abs(bx - hx) < band ? [tail[0], top - 8] : [hx + sd * reach, Math.max(tail[1], my - r * 0.1)];
    }
  }
  // a side bubble ends beside the face at mouth height, whatever the hair: the ray from the mouth to an upper bubble
  // left the head at the temple, which read as a tail into the hair or a cap brim (2026-11-10 v2 redraw: 14 tails in
  // 9 blind reviews, none caught by the lint)
  if (kind !== 'thought' && !who.animal && Math.abs(bx - hx) >= r * 1.1 && tail[1] < my - r * 0.2)
    tail = [hx + Math.sign(bx - hx) * ((who.brim && Math.sign(bx - hx) === who.brim ? r * 1.7 : r) + 14), my - r * 0.1];
  bubble(x, y, w, h, { ...o, kind, size, text: str, tail });
  return [x, y, w, h];
}
// a board on a stand (Peter's "named idea" board); term is handwritten on it
function board(x, y, w, h, { term = null, size = 64, p = 1, a = 1, legs = true, color = null } = {}) {
  DOCENT.slots.things.push(withM([x, y, x + w, y + h + (legs ? 120 : 0)]));
  inkRect(x, y, w, h, { p, a, w: 4.4, fill: mix(C.paper || '#ffffff', 0.35) });
  if (legs) { inkLine(x + w * 0.2, y + h, x + w * 0.12, y + h + 120, { p, a }); inkLine(x + w * 0.8, y + h, x + w * 0.88, y + h + 120, { p, a }); }
  if (term) handBlock(term, x + w / 2, y + h / 2, w - 60, { size, p: clamp01((p - 0.5) * 2), a, color });
}
// a row of students seen from behind (heads and shoulders at desks)
function students(x, y, n = 4, { s = 1, p = 1, a = 1, gap = 120 } = {}) {
  for (let i = 0; i < n; i++) {
    const cx = x + (i - (n - 1) / 2) * gap * s, q = clamp01(p * n - i * 0.6);
    if (q <= 0) continue;
    inkCircle(cx, y - 70 * s, 28 * s, { p: q, a, w: 3.6, fill: PAPER() });
    inkArc(cx, y - 2 * s, 34 * s, 30 * s, Math.PI, Math.PI * 2, { p: q, a, w: 3.6 });
    if (i % 2 === 0) inkLine(cx - 50 * s, y + 4 * s, cx + 50 * s, y + 4 * s, { p: q, a, w: 3.6 });
  }
}
// the named-idea classroom: presenter at the left pointing at a board with the term, students in front
// y 720: the students end ~880 px, above the subtitle box
function teach(term, { x = 960, y = 720, p = 1, a = 1, t = 0, face = 'smile', fig = {} } = {}) {
  const bw = 760, bh = 300;
  figure(x - bw / 2 - 120, y + 10, { pose: 'present', face, p, a, t, ...fig });
  board(x - bw / 2 + 40, y - 520, bw, bh, { term, p: clamp01(p * 1.4 - 0.2), a });
  students(x + 40, y + 160, 5, { s: 0.9, p: clamp01(p * 1.6 - 0.5), a });
}
// sign held by a figure (chapter cards): lines are handwritten, first line smaller
function sign(x, y, w, h, lines, { p = 1, a = 1, size = 54 } = {}) {
  inkRect(x, y, w, h, { p, a, w: 4.4, fill: C.paper || PAPER() });   // opaque: it hides the body behind it
  const L = Array.isArray(lines) ? lines : [lines];
  const pt = clamp01((p - 0.35) / 0.65);
  L.forEach((l, i) => hand(l, x + w / 2, y + h / 2 + (i - (L.length - 1) / 2) * size * 1.25, { size: i === 0 && L.length > 1 ? size * 0.8 : size, p: clamp01(pt * L.length - i), a }));
}
// title card hook for engine.js (set TITLE_CARD = signCard in scenes.js): a figure holds the chapter sign
function signCard(sc, a, isFirst, lt = 9) {
  if (a <= 0) return;
  const p = clamp01(lt / 1.1);   // the card draws on over the first second of the lead
  if (isFirst) {
    hand(sc.title, W / 2, H / 2 - 40, { size: 112, a, p, color: INK() });
    if (sc.subtitle) hand(sc.subtitle, W / 2, H / 2 + 70, { size: 52, a, p: clamp01(p * 1.5 - 0.5) });
    return;
  }
  const lines = [sc.subtitle || '', `"${sc.title}"`].filter(Boolean);
  const w = Math.max(560, handW(lines[lines.length - 1], 64) + 140);
  // the head sits above the sign, the sign covers the torso, the legs show below (s = 1.6: feet at 1010)
  figure(W / 2, 1010, { pose: 'hold', face: 'happy', a, s: 1.6, p });
  sign(W / 2 - w / 2, 640, w, 240, lines, { a, size: 64, p });
  for (const d of [-1, 1]) inkCircle(W / 2 + d * (w / 2 - 6), 700, 16, { a, p, fill: PAPER(), w: 4 });   // hands on the edges
}
// red marks
function cross(x, y, w, h, { p = 1, a = 1, color = null, lw: lw0 = 6, w: wq = null } = {}) {
  const lw = wq ?? lw0;
  inkLine(x, y, x + w, y + h, { p: clamp01(p * 2), a, w: lw, color: color || MARK() });
  inkLine(x + w, y, x, y + h, { p: clamp01(p * 2 - 1), a, w: lw, color: color || MARK() });
}
const ring = (cx, cy, rx, ry, { p = 1, a = 1, color = null, lw = 5, w = null } = {}) => inkEllipse(cx, cy, rx, ry, { p, a, w: w ?? lw, color: color || MARK(), start: -2.4 });
const underline = (x1, x2, y, { p = 1, a = 1, color = null, lw = 5, w = null } = {}) => inkLine(x1, y, x2, y + 3, { p, a, w: w ?? lw, color: color || MARK() });
// picture-equation signs
function eqSign(x, y, { p = 1, a = 1, s = 1, color = null } = {}) {
  inkLine(x - 34 * s, y - 14 * s, x + 34 * s, y - 14 * s, { p: clamp01(p * 2), a, w: 7 * s, color: color || KEY() });
  inkLine(x - 34 * s, y + 14 * s, x + 34 * s, y + 14 * s, { p: clamp01(p * 2 - 1), a, w: 7 * s, color: color || KEY() });
}
function plusSign(x, y, { p = 1, a = 1, s = 1, color = null } = {}) {
  inkLine(x - 30 * s, y, x + 30 * s, y, { p: clamp01(p * 2), a, w: 7 * s, color: color || KEY() });
  inkLine(x, y - 30 * s, x, y + 30 * s, { p: clamp01(p * 2 - 1), a, w: 7 * s, color: color || KEY() });
}
// a handwritten list on a paper scroll; items written in turn as p goes 0 -> 1, mark = indexes to ring
function scrollList(x, y, w, title, items, { p = 1, a = 1, size = 40, mark = [], strike = [] } = {}) {
  const lh = size * 1.35, h = 110 + items.length * lh;
  inkPath([[x, y], [x + w, y], [x + w - 10, y + h], [x + 8, y + h]], { closed: true, p: clamp01(p * 3), a, w: 4, fill: mix(C.paper || '#ffffff', 0.5) });
  const pt = clamp01((p - 0.2) / 0.8);
  if (title) hand(title, x + w / 2, y + 52, { size: size * 1.15, p: clamp01(pt * (items.length + 1)), a });
  items.forEach((it, i) => {
    const q = clamp01(pt * (items.length + 1) - i - 1); const yy = y + 110 + i * lh;
    hand(it, x + 40, yy, { size, p: q, a, align: 'left', color: INK(), weight: 400 });
    if (q >= 1 && mark.includes(i)) ring(x + w / 2, yy, w / 2 - 14, lh * 0.48, { a });
    if (q >= 1 && strike.includes(i)) inkLine(x + 30, yy, x + 40 + handW(it, size, 400), yy, { a, color: C.red, w: 4 });
  });
}
// a drawn book cover (no real cover images: those are copyrighted)
function bookCover(x, y, w, h, { title = '', author = '', note = '', p = 1, a = 1, color = null, size = 58 } = {}) {
  const c = color || KEY();
  inkRect(x, y, w, h, { p, a, w: 5, fill: mix(C.paper || '#ffffff', 0.55) });
  inkLine(x + 26, y, x + 26, y + h, { p, a, w: 3 });
  const q = clamp01((p - 0.4) / 0.6);
  handBlock(title, x + w / 2 + 12, y + h * 0.36, w - 80, { size, p: q, a, color: c });
  if (author) hand(author, x + w / 2 + 12, y + h * 0.78, { size: size * 0.55, p: q, a, color: INK(), weight: 400 });
  if (note) hand(note, x + w / 2 + 12, y + h * 0.88, { size: size * 0.42, p: q, a, color: INK(), weight: 400 });
}
// a short quote in hand lettering with a who-line (keep quotes short: copyright)
function quote(x, y, w, str, { who = '', p = 1, a = 1, size = 52 } = {}) {
  const lines = handLines(str, w, size), lw = Math.max(...lines.map((l) => handW(l, size)));
  const hgt = handBlock(lines, x, y, w, { size, p, a, color: INK() });
  hand('“', x - lw / 2 - size * 0.45, y - hgt / 2 + size * 0.1, { size: size * 2.0, p, a, color: C.dim });
  if (who) hand('— ' + who, x + w / 2, y + hgt / 2 + size * 0.9, { size: size * 0.7, p: clamp01(p * 1.5 - 0.5), a, align: 'right' });
}
// progress map of the chapters (dots + the current one ringed), for long videos
function chapterMap(x, y, w, labels, cur, { p = 1, a = 1, size = 30 } = {}) {
  const n = labels.length;
  inkLine(x, y, x + w, y, { p, a, w: 3, color: C.dim });
  labels.forEach((l, i) => {
    const xx = n > 1 ? x + (w * i) / (n - 1) : x + w / 2, q = clamp01(p * n - i);
    if (q <= 0) return;
    disc(xx, y, i === cur ? 13 : 8, i <= cur ? KEY() : C.dim, a * q);
    if (i === cur) { ring(xx, y, 26, 26, { a: a * q, color: KEY(), lw: 3.5 }); hand(l, xx, y - 52, { size: size * 1.25, a: a * q }); }
    else hand(l, xx, y + 44, { size, a: a * q * 0.8, color: INK(), weight: 400 });
  });
}

// ---------- props: everyday things as metaphors ----------
// prop(name, x, y, s, o): (x, y) is the bottom centre; s = 1 is about 160 px tall. o: { p, a, color, fill, t }.
const PROPS = {
  book: (x, y, s, o) => { inkRect(x - 60 * s, y - 150 * s, 120 * s, 150 * s, { ...o, fill: o.fill }); inkLine(x - 46 * s, y - 150 * s, x - 46 * s, y, o); },
  openbook: (x, y, s, o) => { inkPath([[x, y - 20 * s], [x - 110 * s, y - 40 * s], [x - 110 * s, y - 140 * s], [x, y - 120 * s], [x + 110 * s, y - 140 * s], [x + 110 * s, y - 40 * s]], { ...o, closed: true }); inkLine(x, y - 120 * s, x, y - 20 * s, o);
    for (const d of [-1, 1]) for (let i = 0; i < 3; i++) inkLine(x + d * 20 * s, y - (105 - i * 22) * s, x + d * 90 * s, y - (118 - i * 22) * s, { ...o, w: 2.4 }); },
  door: (x, y, s, o) => { inkRect(x - 55 * s, y - 170 * s, 110 * s, 170 * s, o); inkDot(x + 34 * s, y - 85 * s, 6 * s, o); },
  opendoor: (x, y, s, o) => { inkRect(x - 55 * s, y - 170 * s, 110 * s, 170 * s, o); inkPath([[x - 55 * s, y - 170 * s], [x - 5 * s, y - 150 * s], [x - 5 * s, y - 14 * s], [x - 55 * s, y]], { ...o, closed: true, fill: PAPER() }); },
  ladder: (x, y, s, o) => { inkLine(x - 40 * s, y, x - 30 * s, y - 220 * s, o); inkLine(x + 40 * s, y, x + 30 * s, y - 220 * s, o); for (let i = 1; i < 6; i++) inkLine(x - 38 * s + i, y - i * 36 * s, x + 38 * s - i, y - i * 36 * s, o); },
  stairs: (x, y, s, o) => { const pts = [[x - 120 * s, y]]; for (let i = 0; i < 5; i++) { pts.push([x - 120 * s + i * 48 * s, y - (i + 1) * 36 * s]); pts.push([x - 120 * s + (i + 1) * 48 * s, y - (i + 1) * 36 * s]); } inkPoly(pts, o); },
  mirror: (x, y, s, o) => { inkEllipse(x, y - 100 * s, 60 * s, 86 * s, { ...o, fill: mix(C.blue, 0.12) }); inkLine(x - 20 * s, y - 140 * s, x - 2 * s, y - 160 * s, { ...o, w: 2.4 }); inkLine(x, y - 14 * s, x, y, o); inkLine(x - 40 * s, y, x + 40 * s, y, o); },
  loop: (x, y, s, o) => { inkArc(x, y - 90 * s, 70 * s, 70 * s, -Math.PI * 0.35, Math.PI * 1.45, o); inkArrow(x + 40 * s, y - 147 * s, x + 64 * s, y - 128 * s, { ...o, head: 18 * s }); },
  gear: (x, y, s, o) => { const pts = []; const cy = y - 80 * s; for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2, r = (i % 5 < 2 ? 80 : 62) * s; pts.push([x + Math.cos(a) * r, cy + Math.sin(a) * r]); } inkPath(pts, { ...o, closed: true, jit: 0.4 }); inkCircle(x, cy, 22 * s, o); },
  tree: (x, y, s, o) => { inkLine(x, y, x, y - 90 * s, { ...o, w: 6 }); inkLine(x, y - 70 * s, x - 34 * s, y - 112 * s, o); inkLine(x, y - 80 * s, x + 30 * s, y - 120 * s, o); inkEllipse(x, y - 150 * s, 80 * s, 62 * s, { ...o, fill: (o.paperFill ? null : o.fill) || mix(C.green, 0.25) }); },
  balance: (x, y, s, o) => { inkLine(x, y, x, y - 150 * s, o); inkLine(x - 40 * s, y, x + 40 * s, y, o); inkLine(x - 100 * s, y - 140 * s, x + 100 * s, y - 140 * s, o);
    for (const d of [-1, 1]) { inkLine(x + d * 100 * s, y - 140 * s, x + d * 100 * s, y - 90 * s, o); inkArc(x + d * 100 * s, y - 90 * s, 40 * s, 20 * s, 0, Math.PI, o); } },
  bulb: (x, y, s, o) => {   // glass and neck are one closed shape that sits on the screw base (2026-11-10: the base floated 26 px under an open glass)
    const g = []; for (let k = 0; k <= 24; k++) { const a = Math.PI * (0.75 + 1.5 * k / 24); g.push([x + Math.cos(a) * 48 * s, y - 110 * s + Math.sin(a) * 48 * s]); }
    inkPath([...g, [x + 18 * s, y - 50 * s], [x - 18 * s, y - 50 * s]], { ...o, closed: true, fill: (o.paperFill ? null : o.fill) || opaqueMix(C.yellow, 0.35) }); inkRect(x - 18 * s, y - 50 * s, 36 * s, 34 * s, { ...o, fill: (o.paperFill ? null : o.fill) || opaqueMix(C.grey, 0.5) }); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55; inkLine(x + Math.cos(a) * 66 * s, y - 110 * s + Math.sin(a) * 66 * s, x + Math.cos(a) * 88 * s, y - 110 * s + Math.sin(a) * 88 * s, o); } },
  clock: (x, y, s, o) => { inkCircle(x, y - 80 * s, 72 * s, { ...o, fill: o.fill }); const h = (o.t || 0) * 0.4; inkLine(x, y - 80 * s, x + Math.sin(h) * 40 * s, y - 80 * s - Math.cos(h) * 40 * s, o); inkLine(x, y - 80 * s, x + Math.sin(h * 12) * 58 * s, y - 80 * s - Math.cos(h * 12) * 58 * s, { ...o, w: 2.6 }); },
  calendar: (x, y, s, o) => { inkRect(x - 70 * s, y - 140 * s, 140 * s, 140 * s, { ...o, fill: o.fill }); for (let i = 0; i < 7; i++) inkCircle(x - 54 * s + i * 18 * s, y - 140 * s, 6 * s, { ...o, w: 2.4 }); if (o.label) hand(o.label, x, y - 66 * s, { size: 36 * s, p: o.p, a: o.a }); },
  signpost: (x, y, s, o) => { inkLine(x, y, x, y - 220 * s, { ...o, w: 6 }); inkPath([[x, y - 200 * s], [x + 120 * s, y - 200 * s], [x + 144 * s, y - 180 * s], [x + 120 * s, y - 160 * s], [x, y - 160 * s]], o); inkPath([[x, y - 150 * s], [x - 120 * s, y - 150 * s], [x - 144 * s, y - 130 * s], [x - 120 * s, y - 110 * s], [x, y - 110 * s]], o); },
  house: (x, y, s, o) => { inkRect(x - 80 * s, y - 110 * s, 160 * s, 110 * s, o); inkPoly([[x - 96 * s, y - 104 * s], [x, y - 180 * s], [x + 96 * s, y - 104 * s]], o); inkRect(x - 18 * s, y - 56 * s, 36 * s, 56 * s, o); },
  brain: (x, y, s, o) => { const cy = y - 80 * s, pts = []; for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; const r = (68 + 10 * Math.abs(Math.sin(a * 5))) * s; pts.push([x + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 0.9]); }
    inkPath(pts, { ...o, closed: true, color: o.color || C.magenta || C.purple, fill: o.fill }); inkCurve([x - 50 * s, cy - 20 * s], [x - 10 * s, cy + 30 * s], [x + 40 * s, cy - 10 * s], { ...o, color: o.color || C.magenta || C.purple, w: 2.6 }); inkLine(x, cy - 66 * s, x, cy + 50 * s, { ...o, color: o.color || C.magenta || C.purple, w: 2.6 }); },
  heart: (x, y, s, o) => { const pts = []; for (let i = 0; i <= 40; i++) { const t = (i / 40) * Math.PI * 2; pts.push([x + 4 * s * 16 * Math.sin(t) ** 3, y - 70 * s - 4 * s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]); } inkPath(pts, { ...o, closed: true, fill: (o.paperFill ? null : o.fill) || mix(C.red, 0.4), color: o.color || C.red }); },
  key: (x, y, s, o) => { inkCircle(x - 60 * s, y - 60 * s, 30 * s, o); inkLine(x - 30 * s, y - 60 * s, x + 80 * s, y - 60 * s, o); inkLine(x + 50 * s, y - 60 * s, x + 50 * s, y - 36 * s, o); inkLine(x + 74 * s, y - 60 * s, x + 74 * s, y - 40 * s, o); },
  lock: (x, y, s, o) => { inkRect(x - 56 * s, y - 100 * s, 112 * s, 100 * s, { ...o, fill: o.fill }); inkArc(x, y - 100 * s, 36 * s, 44 * s, Math.PI, Math.PI * 2, o); inkCircle(x, y - 56 * s, 10 * s, o); },
  box: (x, y, s, o) => { inkRect(x - 70 * s, y - 110 * s, 140 * s, 110 * s, { ...o, fill: o.fill }); inkPoly([[x - 70 * s, y - 110 * s], [x - 40 * s, y - 140 * s], [x + 100 * s, y - 140 * s], [x + 70 * s, y - 110 * s]], o); inkPoly([[x + 100 * s, y - 140 * s], [x + 100 * s, y - 30 * s], [x + 70 * s, y]], o); },
  coin: (x, y, s, o) => { inkEllipse(x, y - 50 * s, 50 * s, 50 * s, { ...o, fill: (o.paperFill ? null : o.fill) || mix(C.yellow, 0.4) }); hand('₩', x, y - 48 * s, { size: 54 * s, p: o.p, a: o.a, color: INK() }); },
  phone: (x, y, s, o) => { inkRect(x - 40 * s, y - 150 * s, 80 * s, 150 * s, o); inkRect(x - 30 * s, y - 136 * s, 60 * s, 110 * s, { ...o, w: 2.4 }); },
  laptop: (x, y, s, o) => { inkRect(x - 90 * s, y - 130 * s, 180 * s, 110 * s, o); inkPoly([[x - 110 * s, y], [x + 110 * s, y], [x + 90 * s, y - 20 * s], [x - 90 * s, y - 20 * s]], { ...o, closed: true }); },
  monitor: (x, y, s, o) => { inkRect(x - 100 * s, y - 170 * s, 200 * s, 130 * s, { ...o, fill: o.fill }); inkLine(x, y - 40 * s, x, y - 10 * s, o); inkLine(x - 50 * s, y - 6 * s, x + 50 * s, y - 6 * s, o); },
  camera: (x, y, s, o) => { inkRect(x - 70 * s, y - 100 * s, 140 * s, 86 * s, { ...o, fill: o.fill }); inkCircle(x, y - 57 * s, 28 * s, o); inkRect(x - 30 * s, y - 116 * s, 40 * s, 16 * s, o); inkLine(x, y - 14 * s, x - 30 * s, y + 0, o); inkLine(x, y - 14 * s, x + 30 * s, y + 0, o); },
  desk: (x, y, s, o) => { inkLine(x - 120 * s, y - 80 * s, x + 120 * s, y - 80 * s, { ...o, w: 6 }); inkLine(x - 100 * s, y - 80 * s, x - 100 * s, y, o); inkLine(x + 100 * s, y - 80 * s, x + 100 * s, y, o); },
  chair: (x, y, s, o) => { inkPoly([[x - 40 * s, y - 160 * s], [x - 40 * s, y], [x - 40 * s, y - 70 * s], [x + 40 * s, y - 70 * s], [x + 40 * s, y]], o); },
  bench: (x, y, s, o) => { for (const yy of [70, 90]) inkLine(x - 130 * s, y - yy * s, x + 130 * s, y - yy * s, o); inkLine(x - 130 * s, y - 120 * s, x + 130 * s, y - 120 * s, o); for (const d of [-1, 1]) inkLine(x + d * 110 * s, y - 120 * s, x + d * 110 * s, y, o); },
  flag: (x, y, s, o) => { inkLine(x, y, x, y - 200 * s, o); inkPath([[x, y - 200 * s], [x + 100 * s, y - 175 * s], [x, y - 150 * s]], { ...o, closed: true, fill: (o.paperFill ? null : o.fill) || mix(C.red, 0.45) }); },
  mountain: (x, y, s, o) => { inkPoly([[x - 170 * s, y], [x - 50 * s, y - 170 * s], [x + 10 * s, y - 90 * s], [x + 60 * s, y - 140 * s], [x + 170 * s, y]], o); },
  sun: (x, y, s, o) => { inkCircle(x, y - 80 * s, 40 * s, { ...o, fill: (o.paperFill ? null : o.fill) || mix(C.yellow, 0.4) }); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; inkLine(x + Math.cos(a) * 56 * s, y - 80 * s + Math.sin(a) * 56 * s, x + Math.cos(a) * 76 * s, y - 80 * s + Math.sin(a) * 76 * s, o); } },
  cloud: (x, y, s, o) => { const pts = []; for (let i = 0; i <= 60; i++) { const a = (i / 60) * Math.PI * 2; const r = 1 + 0.18 * Math.abs(Math.sin(a * 3.5)); pts.push([x + Math.cos(a) * 110 * s * r, y - 60 * s + Math.sin(a) * 46 * s * r]); } inkPath(pts, { ...o, closed: true, fill: (o.paperFill ? null : o.fill) || PAPER() }); },
  star: (x, y, s, o) => { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2, r = (i % 2 ? 30 : 72) * s; pts.push([x + Math.cos(a) * r, y - 76 * s + Math.sin(a) * r]); } inkPath(pts, { ...o, closed: true, fill: (o.paperFill ? null : o.fill) || mix(C.yellow, 0.4) }); },
  eye: (x, y, s, o) => { inkArc(x, y - 30 * s, 90 * s, 70 * s, Math.PI * 1.15, Math.PI * 1.85, o); inkArc(x, y - 130 * s, 90 * s, 70 * s, Math.PI * 0.15, Math.PI * 0.85, o); inkCircle(x, y - 80 * s, 28 * s, o); inkDot(x, y - 80 * s, 12 * s, o); },
  magnifier: (x, y, s, o) => { inkCircle(x - 20 * s, y - 100 * s, 50 * s, { ...o, fill: o.fill }); inkLine(x + 16 * s, y - 64 * s, x + 70 * s, y - 10 * s, { ...o, w: 8 }); },
  puzzle: (x, y, s, o) => { inkPath([[x - 60 * s, y], [x - 60 * s, y - 120 * s], [x - 14 * s, y - 120 * s], [x - 14 * s, y - 140 * s], [x + 14 * s, y - 140 * s], [x + 14 * s, y - 120 * s], [x + 60 * s, y - 120 * s], [x + 60 * s, y - 74 * s], [x + 80 * s, y - 74 * s], [x + 80 * s, y - 46 * s], [x + 60 * s, y - 46 * s], [x + 60 * s, y]], { ...o, closed: true, fill: o.fill }); },
  trophy: (x, y, s, o) => {   // a cup with two handles on a stepped base (the handle-less cup read as a table lamp: 2026-11-10, two reviews)
    const f = (o.paperFill ? null : o.fill) || opaqueMix(C.yellow, 0.55);
    for (const d of [-1, 1]) inkPath([[x + d * 46 * s, y - 150 * s], [x + d * 82 * s, y - 150 * s], [x + d * 78 * s, y - 116 * s], [x + d * 40 * s, y - 104 * s]], { ...o, w: o.w * 0.9 });
    inkPath([[x - 52 * s, y - 162 * s], [x + 52 * s, y - 162 * s], [x + 44 * s, y - 116 * s], [x + 14 * s, y - 88 * s], [x - 14 * s, y - 88 * s], [x - 44 * s, y - 116 * s]], { ...o, closed: true, fill: f });
    inkRect(x - 8 * s, y - 88 * s, 16 * s, 46 * s, { ...o, fill: f });
    inkRect(x - 40 * s, y - 42 * s, 80 * s, 20 * s, { ...o, fill: f }); inkRect(x - 54 * s, y - 22 * s, 108 * s, 22 * s, { ...o, fill: (o.paperFill ? null : o.fill) || opaqueMix(C.orange, 0.5) });
    if (!o.paperFill) { const st = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = (k % 2 ? 8 : 18) * s; st.push([x + Math.cos(a) * r, y - 130 * s + Math.sin(a) * r]); }
      inkPath(st, { ...o, closed: true, w: o.w * 0.5, fill: opaqueMix(C.orange, 0.8) }); } },
  bridge: (x, y, s, o) => {   // a plank over a gap between two cliffs
    inkPoly([[x - 220 * s, y - 60 * s], [x - 90 * s, y - 60 * s], [x - 80 * s, y - 20 * s], [x - 100 * s, y + 10 * s]], o);
    inkPoly([[x + 220 * s, y - 60 * s], [x + 90 * s, y - 60 * s], [x + 84 * s, y - 24 * s], [x + 102 * s, y + 10 * s]], o);
    inkRect(x - 120 * s, y - 76 * s, 240 * s, 16 * s, { ...o, fill: (o.paperFill ? null : o.fill) || mix(C.orange, 0.35) }); },
  globe: (x, y, s, o) => { inkCircle(x, y - 80 * s, 76 * s, { ...o, fill: o.fill }); inkEllipse(x, y - 80 * s, 30 * s, 76 * s, o); inkLine(x - 76 * s, y - 80 * s, x + 76 * s, y - 80 * s, o); },
  note: (x, y, s, o) => { inkEllipse(x - 20 * s, y - 24 * s, 24 * s, 18 * s, { ...o, fill: o.color || INK() }); inkLine(x + 2 * s, y - 26 * s, x + 2 * s, y - 140 * s, o); inkCurve([x + 2 * s, y - 140 * s], [x + 50 * s, y - 120 * s], [x + 40 * s, y - 80 * s], o); },
  staff: (x, y, s, o) => { for (let i = 0; i < 5; i++) inkLine(x - 200 * s, y - (40 + i * 20) * s, x + 200 * s, y - (40 + i * 20) * s, { ...o, w: 2.4 }); },
  record: (x, y, s, o) => { inkCircle(x, y - 90 * s, 90 * s, { ...o, fill: (o.paperFill ? null : o.fill) || INK() }); inkCircle(x, y - 90 * s, 60 * s, { ...o, color: C.dim, w: 2 }); inkCircle(x, y - 90 * s, 26 * s, { ...o, fill: o.label || mix(C.red, 0.8), color: PAPER() }); },
  phonograph: (x, y, s, o) => { inkRect(x - 110 * s, y - 70 * s, 220 * s, 70 * s, { ...o, fill: o.fill }); inkEllipse(x - 10 * s, y - 70 * s, 84 * s, 18 * s, o); inkLine(x - 10 * s, y - 90 * s, x - 10 * s, y - 70 * s, o);
    inkPath([[x + 90 * s, y - 70 * s], [x + 90 * s, y - 150 * s], [x + 140 * s, y - 230 * s], [x + 40 * s, y - 230 * s], [x + 90 * s, y - 150 * s]], o); },
  doll: (x, y, s, o) => { inkPath([[x, y - 170 * s], [x - 34 * s, y - 150 * s], [x - 40 * s, y - 110 * s], [x - 60 * s, y - 60 * s], [x - 56 * s, y], [x + 56 * s, y], [x + 60 * s, y - 60 * s], [x + 40 * s, y - 110 * s], [x + 34 * s, y - 150 * s]], { ...o, closed: true, fill: (o.paperFill ? null : o.fill) || mix(C.red, 0.3) });
    inkCircle(x, y - 130 * s, 26 * s, { ...o, fill: PAPER() }); inkDot(x - 9 * s, y - 132 * s, 3 * s, o); inkDot(x + 9 * s, y - 132 * s, 3 * s, o); },
  pencil: (x, y, s, o) => { inkPath([[x - 14 * s, y - 180 * s], [x + 14 * s, y - 180 * s], [x + 14 * s, y - 40 * s], [x, y], [x - 14 * s, y - 40 * s]], { ...o, closed: true, fill: (o.paperFill ? null : o.fill) || mix(C.yellow, 0.4) }); },
  paper: (x, y, s, o) => { inkRect(x - 80 * s, y - 200 * s, 160 * s, 200 * s, { ...o, fill: (o.paperFill ? null : o.fill) || mix(C.paper || '#ffffff', 0.6) }); if (!o.blank) for (let i = 0; i < 6; i++) inkLine(x - 56 * s, y - (164 - i * 26) * s, x + 56 * s, y - (164 - i * 26) * s, { ...o, w: 2, color: C.dim }); },
  window: (x, y, s, o) => { inkRect(x - 90 * s, y - 200 * s, 180 * s, 200 * s, { ...o, fill: (o.paperFill ? null : o.fill) || mix(C.blue, 0.1) }); inkLine(x, y - 200 * s, x, y, o); inkLine(x - 90 * s, y - 100 * s, x + 90 * s, y - 100 * s, o); },
  fly: (x, y, s, o) => { inkDot(x, y, 9 * s, o); inkEllipse(x - 8 * s, y - 12 * s, 10 * s, 6 * s, { ...o, w: 2 }); inkEllipse(x + 8 * s, y - 12 * s, 10 * s, 6 * s, { ...o, w: 2 }); },
  rock: (x, y, s, o) => { inkPath([[x - 80 * s, y], [x - 70 * s, y - 50 * s], [x - 20 * s, y - 80 * s], [x + 50 * s, y - 70 * s], [x + 84 * s, y - 20 * s], [x + 76 * s, y]], { ...o, closed: true, fill: (o.paperFill ? null : o.fill) || mix(C.grey, 0.4) }); },
  puddle: (x, y, s, o) => { inkEllipse(x, y - 14 * s, 120 * s, 22 * s, { ...o, fill: (o.paperFill ? null : o.fill) || mix(C.blue, 0.3) }); },
  pawn: (x, y, s, o) => { inkCircle(x, y - 130 * s, 22 * s, { ...o, fill: (o.paperFill ? null : o.fill) || INK() }); inkPath([[x - 18 * s, y - 108 * s], [x + 18 * s, y - 108 * s], [x + 40 * s, y - 20 * s], [x - 40 * s, y - 20 * s]], { ...o, closed: true, fill: (o.paperFill ? null : o.fill) || INK() }); inkRect(x - 50 * s, y - 20 * s, 100 * s, 20 * s, { ...o, fill: (o.paperFill ? null : o.fill) || INK() }); },
  cap: (x, y, s, o) => { inkEllipse(x, y - 30 * s, 40 * s, 30 * s, { ...o, fill: (o.paperFill ? null : o.fill) || mix(C.yellow, 0.5) }); for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; inkLine(x + Math.cos(a) * 40 * s, y - 30 * s + Math.sin(a) * 30 * s, x + Math.cos(a) * 46 * s, y - 30 * s + Math.sin(a) * 34 * s, { ...o, w: 2 }); } },
  map: (x, y, s, o) => { inkPoly([[x - 120 * s, y], [x - 120 * s, y - 160 * s], [x - 40 * s, y - 140 * s], [x + 40 * s, y - 160 * s], [x + 120 * s, y - 140 * s], [x + 120 * s, y], [x + 40 * s, y - 20 * s], [x - 40 * s, y], [x - 120 * s, y]], { ...o, fill: (o.paperFill ? null : o.fill) || mix(C.paper || '#ffffff', 0.5) });
    inkPath([[x - 90 * s, y - 40 * s], [x - 50 * s, y - 90 * s], [x + 10 * s, y - 60 * s], [x + 80 * s, y - 120 * s]], { ...o, color: C.red, w: 3, dash: [10, 8] }); },
  stadium: (x, y, s, o) => { inkArc(x, y, 260 * s, 120 * s, Math.PI, Math.PI * 2, o); inkArc(x, y, 200 * s, 80 * s, Math.PI, Math.PI * 2, o); inkLine(x - 260 * s, y, x + 260 * s, y, o); },
};
function prop(name, x, y, s = 1, o = {}) {
  const f = PROPS[name]; if (!f) { MISS.add('prop:' + name); return; }
  const oo = { p: 1, a: 1, w: 4 * Math.max(0.7, Math.sqrt(s)), ...o };
  if (oo.p <= 0 || oo.a <= 0) {   // not drawn yet: still reserve its box, so tags and bubbles do not jump when it appears
    const tr = DOCENT.track = { box: null, local: null }; DOCENT.measure = true;
    ctx.save(); ctx.globalAlpha = 0; DOCENT.ghostOk++;   // anything not drawn through inkPath stays invisible
    try { f(x, y, s, { ...oo, p: 1, a: 1 }); } finally { DOCENT.measure = false; DOCENT.track = null; DOCENT.ghostOk--; ctx.restore(); }
    if (tr.local) DOCENT.slots.things.push(withM(tr.local));
    return;
  }
  // solid: true first paints the prop's shape in the page colour (every part filled, thick paper strokes), then draws
  // the prop as usual on top: what is behind it is hidden, its own parts and colours are untouched
  if (oo.solid) { DOCENT.ghostOk++; f(x, y, s, { ...oo, fill: PAPER(), paperFill: true, color: PAPER(), w: oo.w * 2.2 }); DOCENT.ghostOk--; }
  const tr = DOCENT.track = { box: null, local: null };
  f(x, y, s, oo);
  DOCENT.track = null;
  if (tr.local) DOCENT.slots.things.push(withM(tr.local));   // say()/think() keep clear of props too
  if (tr.box && !DOCENT.ghostOk && !oo.faceOk) DOCENT.props.push({ name, box: tr.box, seq: ++DOCENT.seq });   // faceOk: covering a face is the joke
}

// ---------- library additions: research-skill make-docent-book, 2026-11-10 ----------
// Drawn by the probe authors from scenes.js (the extension route in TEMPLATES.md "Adding an asset"), checked on
// their gallery sheets and by the blind reviewers. Source probe in brackets.
const DOCENT_WOOD = () => mix(C.orange, 0.45);
const docentShade = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
const DOCENT_LEVER_L = 120;
const docentLeverTip = (x, y, s, pull = 0) => { const a = lerp(-0.5, 0.5, pull); return [x + Math.sin(a) * DOCENT_LEVER_L * s, y - 40 * s - Math.cos(a) * DOCENT_LEVER_L * s]; };
// swans on water: boat body, raised wing, S-neck; the black swan has a red beak and eye [The Black Swan]
function docentSwan(T, o, q, black) {
  const s = o.s, body = black ? '#2a2a30' : C.paper, wing = black ? '#45454f' : opaqueMix(C.paper, 0.8);
  inkLine(...T(-176, 0), ...T(-70, 0), { ...o, p: q(0), color: C.teal, w: o.w * 0.8 });
  inkLine(...T(-30, 2), ...T(132, 2), { ...o, p: q(0), color: C.teal, w: o.w * 0.8 });
  inkPath([T(-152, -76), T(-118, -44), T(-60, -18), T(30, -16), T(92, -34), T(116, -60), T(92, -84), T(24, -96), T(-50, -98), T(-112, -94)], { ...o, closed: true, round: 2, p: q(1), fill: body });
  inkPath([T(-126, -86), T(-70, -126), T(-4, -122), T(58, -92), T(0, -72), T(-82, -68)], { ...o, closed: true, round: 2, p: q(2), fill: wing });
  for (let k = 0; k < 2; k++) inkCurve(T(-100 + k * 56, -88), T(-70 + k * 56, -106), T(-34 + k * 56, -84), { ...o, p: q(2), w: o.w * 0.6, jit: 0.2, color: black ? C.grey : C.dim });
  const front = [T(106, -70), T(120, -122), T(98, -172), T(94, -208), T(102, -232)];
  const back = [T(76, -84), T(92, -126), T(70, -174), T(68, -210), T(76, -238)];
  inkPath([...front, ...back.reverse()], { ...o, closed: true, round: 2, p: q(3), fill: body });
  inkEllipse(...T(90, -234), 22 * s, 18 * s, { ...o, p: q(3), fill: body });
  inkPath([T(106, -241), T(142, -224), T(106, -224)], { ...o, closed: true, p: q(4), fill: black ? C.red : C.orange, w: o.w * 0.7 });
  if (black) inkLine(...T(128, -232), ...T(128, -224), { ...o, p: q(4), color: C.paper, w: o.w * 0.8 });
  else { const k = T(104, -240); disc(k[0], k[1], 6 * s, INK(), o.a * clamp01(q(4) * 2)); }
  const e = T(92, -238); disc(e[0], e[1], 4.5 * s, black ? C.red : INK(), o.a * clamp01(q(4) * 2));
  return { head: T(90, -234), r: 22 * s, mouth: T(138, -226), top: T(90, -258) };
}
Object.assign(ANIMALS, {
  whale: (T, o, q) => {
  const skin = (o.paperFill ? null : o.fill) || C.paper || '#ffffff', R = { ...o, round: 2 };
  // tail flukes raised behind the body
  inkPath([T(-238, -214), T(-272, -238), T(-312, -262), T(-352, -294), T(-302, -292), T(-266, -278), T(-240, -256),
    T(-212, -278), T(-176, -292), T(-126, -294), T(-166, -262), T(-206, -238)], { ...R, closed: true, p: q(0), fill: skin });
  // body: block head on the right, a low hump, the tail stock curling up into the flukes
  inkPath([T(170, -186), T(246, -182), T(272, -160), T(278, -112), T(270, -66), T(240, -52), T(150, -44), T(60, -36),
    T(-40, -40), T(-120, -62), T(-182, -98), T(-226, -150), T(-250, -216), T(-224, -226), T(-204, -168), T(-160, -138),
    T(-100, -152), T(-20, -176), T(80, -188)], { ...R, closed: true, p: q(1), fill: skin });
  // where the head block meets the body, and the thin lower jaw with teeth
  inkCurve(T(122, -186), T(98, -120), T(120, -46), { ...o, p: q(2), w: o.w * 0.6, color: C.dim });
  inkPath([T(256, -60), T(196, -50), T(124, -44)], { ...o, p: q(2), w: o.w * 0.9 });
  for (let i = 0; i < 5; i++) { const xx = 236 - i * 22; inkLine(...T(xx, -57 + i * 1.6), ...T(xx - 3, -68 + i * 1.6), { ...o, p: q(2), w: o.w * 0.5 }); }
  const e = T(196, -84); disc(e[0], e[1], 6 * o.s, INK(), o.a * clamp01(q(2) * 2));
  inkArc(e[0], e[1] - 2 * o.s, 12 * o.s, 8 * o.s, Math.PI * 1.15, Math.PI * 1.85, { ...o, p: q(2), w: o.w * 0.5 });
  // wrinkled skin on the back half
  [[-30, -112], [-80, -98], [20, -126], [-130, -88], [60, -140]].forEach(([wx, wy]) =>
    inkCurve(T(wx - 18, wy), T(wx, wy - 8), T(wx + 18, wy), { ...o, p: q(3), w: o.w * 0.45, color: C.dim }));
  // two old harpoon poles stuck in the back (Moby Dick carries the irons of earlier hunts)
  for (const [hx, hy, dx] of [[-60, -164, -34], [10, -182, -22]]) inkLine(...T(hx, hy), ...T(hx + dx, hy - 70), { ...o, p: q(3), w: o.w * 1.1 });
  // the spout from the blowhole at the front of the head
  const jet = { ...o, p: q(4), color: C.teal, w: o.w * 0.9 };
  inkCurve(T(248, -188), T(240, -252), T(204, -282), jet);
  inkCurve(T(256, -188), T(266, -252), T(304, -280), jet);
  inkLine(...T(252, -188), ...T(252, -298), jet);
  for (const [dx, dy] of [[-58, -268], [58, -266], [-30, -300], [34, -302]]) { const d = T(252 + dx, dy); disc(d[0], d[1], 5 * o.s, C.teal, o.a * clamp01(q(4) * 2)); }
  return { head: T(210, -120), r: 64 * o.s, mouth: T(262, -62), top: T(252, -304) };
},   // [Moby-Dick]
  turkey: (T, o, q) => {
  const s = o.s, brown = (o.paperFill ? null : o.fill) || opaqueMix(C.orange, 0.78), skin = opaqueMix(C.paper, 0.92);
  for (const lx of [-14, 14]) {
    inkPoly([T(lx, -44), T(lx + 4, 0)], { ...o, p: q(0), w: o.w * 0.9, color: C.orange });
    inkPoly([T(lx - 12, 2), T(lx + 4, 0), T(lx + 20, 2)], { ...o, p: q(0), w: o.w * 0.8, color: C.orange });
  }
  const cx = -40, cy = -110;
  const feather = (a, r0, r1, wd, fill, k) => {
    const P = (r, off) => T(cx + Math.cos(a) * r - Math.sin(a) * off, cy + Math.sin(a) * r + Math.cos(a) * off);
    const rm = (r0 + r1) / 2;
    inkPath([P(r0, 0), P(rm, wd), P(r1 - 8, wd * 0.7), P(r1, 0), P(r1 - 8, -wd * 0.7), P(rm, -wd)], { ...o, closed: true, round: 1, p: q(k), fill, w: o.w * 0.7 });
  };
  for (let i = 0; i < 9; i++) feather(Math.PI * (0.94 + i * 0.085), 40, 156, 22, i % 2 ? opaqueMix(C.yellow, 0.75) : opaqueMix(C.orange, 0.9), 1);
  for (let i = 0; i < 9; i++) feather(Math.PI * (0.94 + i * 0.085), 34, 104, 18, opaqueMix(C.dim, 0.85), 1);
  inkEllipse(...T(-4, -96), 70 * s, 58 * s, { ...o, p: q(2), fill: brown });
  inkPath([T(-52, -102), T(-8, -126), T(40, -108), T(12, -78), T(-40, -76)], { ...o, closed: true, round: 2, p: q(3), fill: opaqueMix(C.dim, 0.75) });
  inkPath([T(34, -128), T(52, -176), T(70, -196), T(88, -182), T(66, -146), T(58, -110)], { ...o, closed: true, round: 1, p: q(3), fill: skin });
  inkCircle(...T(76, -190), 20 * s, { ...o, p: q(3), fill: skin });
  inkPath([T(92, -196), T(116, -187), T(92, -180)], { ...o, closed: true, p: q(4), fill: C.yellow, w: o.w * 0.7 });
  inkCurve(T(86, -206), T(102, -200), T(98, -170), { ...o, p: q(4), w: o.w * 1.7, color: C.red });
  inkPath([T(80, -178), T(94, -174), T(94, -152), T(86, -142), T(76, -152)], { ...o, closed: true, round: 1, p: q(4), fill: C.red, w: o.w * 0.7 });
  const e = T(78, -195); disc(e[0], e[1], 4.5 * s, INK(), o.a * clamp01(q(4) * 2));
  return { head: T(76, -190), r: 22 * s, mouth: T(112, -187), top: T(-40, -270) };
},   // [The Black Swan]
  mammoth: (T, o, q) => {
  const fur = (o.paperFill ? null : o.fill) || '#9a6a45', dark = '#6e4528', ivory = '#f3ead2';
  // legs (far pair darker), then the body over their tops
  for (const [lx, f] of [[-96, dark], [58, dark], [-128, fur], [92, fur]]) inkPath([T(lx - 20, -96), T(lx - 22, 0), T(lx + 20, 0), T(lx + 20, -96)], { ...o, closed: true, p: q(0), fill: f, round: 1 });
  const body = [T(-168, -96), T(-178, -150), T(-150, -200), T(-90, -230), T(-20, -254), T(40, -270), T(90, -252),
    T(112, -222), T(126, -150), T(110, -96), T(40, -84), T(-60, -84), T(-130, -88)];
  inkPath(body, { ...o, closed: true, p: q(1), fill: fur, round: 2 });
  // the hanging fringe of long hair under the belly and on the upper legs
  for (let i = 0; i < 13; i++) { const u = i / 12, [ax, ay] = T(-160 + u * 270, -90 + Math.sin(u * 3.1) * 6);
    inkLine(ax, ay, ax - 6 * o.dir * o.s, ay + (38 + 16 * Math.abs(Math.sin(i * 1.9))) * o.s, { ...o, p: q(2), w: o.w * 0.9, color: dark, jit: 0.4 }); }
  for (let i = 0; i < 5; i++) { const [ax, ay] = T(112 + i * 14, -170 + i * 4); inkLine(ax, ay, ax - 4 * o.dir * o.s, ay + 44 * o.s, { ...o, p: q(2), w: o.w * 0.9, color: dark, jit: 0.4 }); }   // throat fringe
  for (const [hx, hy] of [[-110, -200], [-50, -224], [20, -236], [-130, -150], [-60, -170]]) inkCurve(T(hx, hy), T(hx + 14, hy + 16), T(hx + 6, hy + 34), { ...o, p: q(2), w: o.w * 0.6, color: dark });
  // high domed head and the trunk
  inkPath([T(92, -236), T(104, -298), T(140, -322), T(182, -302), T(200, -240), T(196, -176), T(150, -152), T(108, -176)], { ...o, closed: true, p: q(2), fill: fur, round: 2 });
  inkPath([T(176, -180), T(206, -120), T(208, -46), T(226, -30), T(232, -48), T(222, -122), T(198, -186)], { ...o, closed: true, p: q(3), fill: fur, round: 1 });
  // small ear, eye
  inkEllipse(...T(118, -228), 11 * o.s, 18 * o.s, { ...o, p: q(3), fill: dark });
  const e = T(170, -256); disc(e[0], e[1], 5 * o.s, INK(), o.a * clamp01(q(3) * 2));
  // the long tusk: out of the mouth, forward, curling up and back (ink outline, ivory inside)
  const tusk = [T(184, -158), T(250, -108), T(312, -150), T(300, -222)];
  inkPath(tusk, { ...o, p: q(4), w: o.w * 3.4, round: 2 });
  inkPath(tusk, { ...o, p: q(4), w: o.w * 2.0, color: ivory, round: 2 });
  return { head: T(150, -240), r: 64 * o.s, mouth: T(190, -164), top: T(140, -322) };
},   // [Sapiens]
  pig: (T, o, q) => {
  const skin = (o.paperFill ? null : o.fill) || '#f0b2bf', R = { ...o, round: 1 };
  for (const lx of [-62, 58]) inkPath([T(lx - 13, -66), T(lx - 13, -2), T(lx + 13, -2), T(lx + 13, -66)], { ...R, closed: true, p: q(0), fill: docentShade(skin, 0.78) });
  const curl = [T(-132, -116)];
  for (let i = 0; i <= 22; i++) { const u = i / 22, a = Math.PI * (0.9 - 2.4 * u), r = 20 - 9 * u; curl.push(T(-156 + Math.cos(a) * r, -130 - Math.sin(a) * r)); }
  inkPath(curl, { ...o, p: q(0), w: o.w * 1.1, jit: 0.3 });
  for (const lx of [-92, 30]) inkPath([T(lx - 14, -66), T(lx - 14, 0), T(lx + 14, 0), T(lx + 14, -66)], { ...R, closed: true, p: q(1), fill: skin });
  for (const lx of [-92, 30]) inkPath([T(lx - 14, -12), T(lx + 14, -12), T(lx + 14, 0), T(lx - 14, 0)], { ...o, closed: true, p: q(1), fill: INK(), w: o.w * 0.5 });
  inkEllipse(...T(-8, -106), 138 * o.s, 72 * o.s, { ...o, p: q(1), fill: skin });
  inkCircle(...T(118, -122), 58 * o.s, { ...o, p: q(2), fill: skin });
  inkPath([T(90, -166), T(108, -208), T(146, -172)], { ...R, closed: true, p: q(3), fill: docentShade(skin, 0.85) });
  inkEllipse(...T(176, -112), 20 * o.s, 27 * o.s, { ...o, p: q(3), fill: docentShade(skin, 0.9) });
  for (const ny of [-121, -103]) { const n = T(180, ny); disc(n[0], n[1], 4.5 * o.s, INK(), o.a * clamp01(q(4) * 2)); }
  const e = T(136, -140); disc(e[0], e[1], 6 * o.s, INK(), o.a * clamp01(q(4) * 2));
  inkCurve(T(138, -84), T(150, -76), T(164, -86), { ...o, p: q(4), w: o.w * 0.7 });
  return { head: T(118, -122), r: 58 * o.s, mouth: T(164, -86), top: T(110, -210) };
},   // [Animal Farm]
  horse: (T, o, q) => {
  const coat = (o.paperFill ? null : o.fill) || '#b98258', dark = docentShade(coat, 0.42), far = docentShade(coat, 0.78), R = { ...o, round: 1 };
  for (const lx of [-92, 72]) inkPath([T(lx - 11, -178), T(lx - 11, -2), T(lx + 11, -2), T(lx + 11, -178)], { ...R, closed: true, p: q(0), fill: far });
  inkPath([T(-150, -236), T(-188, -216), T(-206, -150), T(-198, -80), T(-178, -74), T(-176, -146), T(-152, -200)], { ...o, closed: true, p: q(0), fill: dark, round: 2, jit: 1.6 });
  for (const lx of [-118, 44]) inkPath([T(lx - 13, -180), T(lx - 13, 0), T(lx + 13, 0), T(lx + 13, -180)], { ...R, closed: true, p: q(1), fill: coat });
  for (const lx of [-118, 44, -92, 72]) inkPath([T(lx - 13, -18), T(lx + 13, -18), T(lx + 13, 0), T(lx - 13, 0)], { ...o, closed: true, p: q(1), fill: INK(), w: o.w * 0.5 });
  inkEllipse(...T(-22, -214), 146 * o.s, 60 * o.s, { ...o, p: q(1), fill: coat });
  inkPath([T(70, -250), T(150, -350), T(196, -326), T(128, -196)], { ...o, closed: true, p: q(2), fill: coat, round: 2 });
  inkPath([T(146, -348), T(176, -366), T(258, -302), T(264, -276), T(244, -262), T(206, -270), T(166, -310)], { ...o, closed: true, p: q(2), fill: coat, round: 2 });
  inkPath([T(66, -244), T(96, -292), T(130, -336), T(152, -362), T(166, -350), T(142, -318), T(112, -276), T(92, -236)], { ...o, closed: true, p: q(3), fill: dark, round: 1 });
  inkPath([T(160, -358), T(166, -398), T(186, -362)], { ...o, closed: true, p: q(3), fill: coat });
  inkLine(...T(194, -340), ...T(248, -290), { ...o, p: q(4), color: C.paper, w: o.w * 2.4, jit: 0.3 });
  const e = T(186, -330); disc(e[0], e[1], 6 * o.s, INK(), o.a * clamp01(q(4) * 2));
  const n = T(250, -278); disc(n[0], n[1], 4.5 * o.s, INK(), o.a * clamp01(q(4) * 2));
  return { head: T(205, -314), r: 52 * o.s, mouth: T(248, -266), top: T(166, -400) };
},   // [Animal Farm]
  hen: (T, o, q) => {
  const f = (o.paperFill ? null : o.fill) || '#f7f4ec';
  for (const d of [-14, 14]) inkPoly([T(d, -46), T(d, 0), T(d + 16, 0)], { ...o, p: q(0), color: C.yellow, w: o.w * 0.9 });
  inkPath([T(-56, -96), T(-104, -160), T(-90, -110), T(-118, -128), T(-84, -76)], { ...o, closed: true, p: q(1), fill: f, round: 1 });
  inkEllipse(...T(-4, -84), 74 * o.s, 48 * o.s, { ...o, p: q(1), fill: f });
  inkCircle(...T(52, -138), 30 * o.s, { ...o, p: q(2), fill: f });
  inkPath([T(32, -164), T(38, -186), T(48, -172), T(56, -192), T(64, -172), T(74, -184), T(76, -160)], { ...o, closed: true, p: q(3), fill: C.red, round: 1 });
  inkPath([T(80, -142), T(104, -134), T(80, -126)], { ...o, closed: true, p: q(3), fill: C.yellow });
  inkEllipse(...T(76, -112), 8 * o.s, 12 * o.s, { ...o, p: q(3), fill: C.red });
  inkCurve(T(-40, -96), T(-6, -70), T(30, -90), { ...o, p: q(4), w: o.w * 0.7 });
  const e = T(60, -146); disc(e[0], e[1], 5 * o.s, INK(), o.a * clamp01(q(4) * 2));
  return { head: T(52, -138), r: 30 * o.s, mouth: T(98, -134), top: T(54, -192) };
},   // [Animal Farm]
  swan: (T, o, q) => docentSwan(T, o, q, false),   // [The Black Swan]
  blackswan: (T, o, q) => docentSwan(T, o, q, true),
});
Object.assign(PROPS, {
  ship: (x, y, s, o) => {
  const P = (px, py) => [x + px * s, y + py * s], w = o.w || 4;
  const masts = [[-150, -400], [10, -452], [170, -382]];
  masts.forEach(([mx, top]) => inkLine(...P(mx, -96), ...P(mx, top), { ...o, w: w * 1.3 }));
  inkLine(...P(10, -452), ...P(340, -160), { ...o, w: 1.8, color: C.dim });     // stays
  inkLine(...P(10, -452), ...P(-262, -112), { ...o, w: 1.8, color: C.dim });
  inkLine(...P(170, -382), ...P(340, -160), { ...o, w: 1.8, color: C.dim });
  const sail = (mx, ty, hw, h) => {   // a square sail on its yard, bellied by the wind
    inkLine(...P(mx - hw - 12, ty), ...P(mx + hw + 12, ty), { ...o, w: w * 1.1 });
    const pts = [P(mx - hw, ty), P(mx + hw, ty), P(mx + hw * 1.1, ty + h)];
    for (let i = 1; i < 8; i++) { const u = i / 8; pts.push(P(mx + hw * 1.1 * (1 - 2 * u), ty + h + 16 * Math.sin(Math.PI * u))); }
    pts.push(P(mx - hw * 1.1, ty + h));
    inkPath(pts, { ...o, closed: true, fill: C.paper, w: w * 0.8 });
  };
  masts.forEach(([mx, top]) => { sail(mx, top + 22, 48, 92); sail(mx, top + 132, 62, 112); });
  inkPath([P(10, -452), P(64, -440), P(10, -428)], { ...o, closed: true, fill: mix(C.red, 0.7), w: w * 0.6 });   // pennant
  inkLine(...P(250, -112), ...P(340, -160), { ...o, w: w * 1.1 });     // bowsprit
  inkPath([P(-272, -116), P(-232, -98), P(196, -98), P(262, -122), P(242, -62), P(202, -14), P(-182, -8), P(-252, -50)],
    { ...o, closed: true, round: 1, fill: (o.paperFill ? null : o.fill) || mix(C.dim, 0.85) });   // dark weathered hull
  inkLine(...P(-244, -78), ...P(236, -82), { ...o, w: w * 0.6, color: C.paper });   // painted stripe
},   // [Moby-Dick]
  whaleboat: (x, y, s, o) => {
  const P = (px, py) => [x + px * s, y + py * s], w = o.w || 4;
  const hull = [P(-186, -70), P(-120, -44), P(120, -44), P(186, -70), P(150, -22), P(100, 0), P(-100, 0), P(-150, -22)];
  inkPath(hull, { ...o, closed: true, round: 1, fill: C.bg, color: 'rgba(0,0,0,0)' });     // opaque under the wood tint
  inkPath(hull, { ...o, closed: true, round: 1, fill: (o.paperFill ? null : o.fill) || DOCENT_WOOD() });
  inkLine(...P(-150, -38), ...P(150, -38), { ...o, w: w * 0.5, color: C.paper });
  for (const d of [-1, 1]) inkLine(...P(d * 70, -50), ...P(d * 160, 26), { ...o, w: w * 0.9 });   // oars, near side
},   // [Moby-Dick]
  harpoon: (x, y, s, o) => {
  const P = (px, py) => [x + px * s, y + py * s], w = o.w || 4;
  inkLine(...P(0, 0), ...P(0, -282), { ...o, w: w * 1.3, color: o.color || INK() });   // wooden pole
  inkLine(...P(0, -282), ...P(0, -312), { ...o, w: w * 0.9 });                            // iron shank
  inkPath([P(0, -342), P(-16, -300), P(-3, -308), P(0, -304), P(3, -308), P(16, -300)], { ...o, closed: true, fill: INK(), w: w * 0.6 });
},   // [Moby-Dick]
  flask: (x, y, s, o) => {
  const P = (px, py) => [x + px * s, y + py * s];
  inkPath([P(-44, -10), P(44, -10), P(28, -58), P(-28, -58)], { ...o, closed: true, fill: mix(C.green, 0.5), color: 'rgba(0,0,0,0)' });
  inkPath([P(-18, -170), P(-18, -112), P(-62, 0), P(62, 0), P(18, -112), P(18, -170)], o);
  inkLine(...P(-26, -170), ...P(26, -170), o);
},   // [Madame Curie]
  testtubes: (x, y, s, o) => {
  const P = (px, py) => [x + px * s, y + py * s];
  [[-70, C.red], [0, C.yellow], [70, C.blue]].forEach(([dx, c]) => {
    inkPath([P(dx - 14, -62), P(dx + 14, -62), P(dx + 14, -14), P(dx - 14, -14)], { ...o, closed: true, fill: mix(c, 0.55), color: 'rgba(0,0,0,0)' });
    inkPath([P(dx - 16, -150), P(dx - 16, -14), P(dx, -2), P(dx + 16, -14), P(dx + 16, -150)], { ...o, round: 1 });
  });
  inkRect(...P(-110, -100), 220 * s, 22 * s, { ...o, fill: DOCENT_WOOD() });
  inkLine(...P(-100, -78), ...P(-100, 0), o); inkLine(...P(100, -78), ...P(100, 0), o);
},   // [Madame Curie]
  medal: (x, y, s, o) => {
  const P = (px, py) => [x + px * s, y + py * s];
  inkPath([P(-70, -270), P(-26, -270), P(14, -150), P(-20, -140)], { ...o, closed: true, fill: mix(C.blue, 0.55) });
  inkPath([P(70, -270), P(26, -270), P(-14, -150), P(20, -140)], { ...o, closed: true, fill: mix(C.red, 0.55) });
  inkCircle(...P(0, -76), 76 * s, { ...o, fill: mix(C.yellow, 0.7) });
  inkCircle(...P(0, -76), 56 * s, { ...o, w: (o.w || 4) * 0.6 });
  for (const d of [-1, 1]) {
    inkArc(...P(0, -76), 40 * s, 40 * s, d < 0 ? Math.PI * 0.55 : Math.PI * 0.05, d < 0 ? Math.PI * 0.95 : Math.PI * 0.45, { ...o, w: (o.w || 4) * 0.6 });
    for (let i = 0; i < 3; i++) { const a = (d < 0 ? Math.PI * 0.62 : Math.PI * 0.12) + i * 0.13 * Math.PI; const [lx, ly] = P(Math.cos(a) * 40, -76 + Math.sin(a) * 40);
      inkEllipse(lx, ly, 9 * s, 4.5 * s, { ...o, w: 1.6, fill: C.green }); }
  }
},   // [Madame Curie]
  moon: (x, y, s, o) => {
  const cx = x, cy = y - 80 * s, R = 70 * s, pts = [];
  for (let i = 0; i <= 24; i++) { const a = -Math.PI * 0.5 + (i / 24) * Math.PI; pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }      // outer edge (right half)
  for (let i = 24; i >= 0; i--) { const a = -Math.PI * 0.5 + (i / 24) * Math.PI; pts.push([cx + Math.cos(a) * R * 0.45, cy + Math.sin(a) * R]); } // inner edge
  inkPath(pts, { ...o, closed: true, fill: (o.paperFill ? null : o.fill) || mix(C.yellow, 0.45) });
},   // [윤동주]
  wind: (x, y, s, o) => {
  [[-30, 0, 220], [20, 55, 260], [-10, 110, 180]].forEach(([dx, dy, L], i) => {
    const y0 = y - 140 * s + dy * s, x0 = x - 130 * s + dx * s, x1 = x0 + L * s;
    inkPath([[x0, y0], [x0 + L * 0.5 * s, y0 - 10 * s], [x1, y0], [x1 + 24 * s, y0 - 22 * s], [x1 + 6 * s, y0 - 44 * s], [x1 - 14 * s, y0 - 26 * s]],
      { ...o, round: 2, p: clamp01((o.p ?? 1) * 3 - i) });
  });
},   // [윤동주]
  frame: (x, y, s, o) => {
  const w = 220 * s, h = 150 * s, x0 = x - w / 2, y0 = y - h;
  inkLine(x, y0 - 50 * s, x0 + w * 0.2, y0, { ...o, w: 2.5 }); inkLine(x, y0 - 50 * s, x0 + w * 0.8, y0, { ...o, w: 2.5 });
  inkDot(x, y0 - 50 * s, 6 * Math.sqrt(s), o);
  inkRect(x0, y0, w, h, { ...o, w: 9 * Math.sqrt(s), fill: mix(C.paper, 0.9) });
  inkRect(x0 + 14 * s, y0 + 14 * s, w - 28 * s, h - 28 * s, { ...o, w: 3, fill: o.sky || mix(C.ink, 0.85) });
  if (o.inside) o.inside(x0 + 14 * s, y0 + 14 * s, w - 28 * s, h - 28 * s, clamp01(((o.p ?? 1) - 0.4) / 0.6));
},   // [윤동주]
  trolley: (x, y, s, o) => {
  inkPath([[x - 20 * s, y - 168 * s], [x - 70 * s, y - 214 * s], [x - 92 * s, y - 214 * s]], { ...o, w: 3 });   // trolley pole
  inkPath([[x - 140 * s, y - 150 * s], [x + 140 * s, y - 150 * s], [x + 118 * s, y - 172 * s], [x - 118 * s, y - 172 * s]], { ...o, closed: true, fill: mix(C.ink, 0.85) });   // roof
  inkRect(x - 132 * s, y - 150 * s, 264 * s, 118 * s, { ...o, fill: (o.paperFill ? null : o.fill) || mix(C.orange, 0.6) });   // body
  for (const dx of [-100, -36, 28]) inkRect(x + dx * s, y - 138 * s, 50 * s, 44 * s, { ...o, w: 3, fill: C.paper });   // windows
  inkRect(x + 92 * s, y - 138 * s, 30 * s, 92 * s, { ...o, w: 3 });   // door
  inkCircle(x + 126 * s, y - 62 * s, 9 * s, { ...o, w: 3, fill: mix(C.yellow, 0.9) });   // headlight
  for (const dx of [-82, 82]) inkCircle(x + dx * s, y - 20 * s, 20 * s, { ...o, fill: C.paper });   // wheels
},   // [Justice]
  lever: (x, y, s, o) => {
  const [tx, ty] = docentLeverTip(x, y, s, o.pull || 0);
  inkLine(x, y - 40 * s, tx, ty, { ...o, w: 7 * Math.sqrt(s) });
  inkCircle(tx, ty, 15 * s, { ...o, fill: C.red });
  inkRect(x - 48 * s, y - 40 * s, 96 * s, 40 * s, { ...o, fill: mix(C.grey, 0.7) });
},   // [Justice]
  bowl: (x, y, s, o) => {
  inkPath([[x - 86 * s, y - 50 * s], [x + 86 * s, y - 50 * s], [x + 60 * s, y], [x - 60 * s, y]], { ...o, closed: true, round: 1, fill: (o.paperFill ? null : o.fill) || mix(C.red, 0.45) });
  inkArc(x, y - 50 * s, 74 * s, 26 * s, Math.PI, Math.PI * 2, { ...o, fill: mix(C.yellow, 0.7) });
},   // [The Black Swan]
  garage: (x, y, s, o) => {
  const w = 300 * s, hw = 120 * s, rf = 40 * s, L = x - w / 2, R = x + w / 2, top = y - hw;
  const dw = w * 0.8, dh = hw * 0.82, dl = x - dw / 2;
  inkPoly([[L - 16 * s, top + 2 * s], [x, top - rf], [R + 16 * s, top + 2 * s]], { ...o, closed: true, fill: mix(C.red, 0.35) });   // roof (first: walls overdraw its eave)
  inkRect(L, top, w, hw, { ...o, fill: (o.paperFill ? null : o.fill) || '#dfe4ea' });                                   // walls (opaque)
  inkRect(dl, y - dh, dw, dh, { ...o, fill: mix(C.dim, 0.22) });                                // the open door: shaded interior, light enough for name tags
  for (let i = 0; i < 3; i++) inkLine(dl, y - dh + (8 + i * 8) * s, dl + dw, y - dh + (8 + i * 8) * s, { ...o, w: (o.w || 4) * 0.6 });   // rolled-up door slats
  inkLine(L - 40 * s, y, R + 40 * s, y, { ...o, w: (o.w || 4) * 1.1 });                           // driveway line
},   // [Steve Jobs]
  pcb: (x, y, s, o) => {
  const w = 200 * s, h = 120 * s, L = x - w / 2, T = y - h;
  inkRect(L, T, w, h, { ...o, fill: mix(C.green, 0.75) });
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) inkRect(L + 22 * s + c * 44 * s, T + 20 * s + r * 44 * s, 30 * s, 26 * s, { ...o, w: (o.w || 4) * 0.5, fill: INK() });
  for (let i = 0; i < 9; i++) inkLine(L + 24 * s + i * 19 * s, y, L + 24 * s + i * 19 * s, y - 10 * s, { ...o, w: (o.w || 4) * 0.8, color: C.yellow });
},   // [Steve Jobs]
  fire: (x, y, s, o) => {
  const t = o.t || 0, fl = Math.sin(t * 9) * 6 * s, wood = '#6e4528';
  inkLine(x - 80 * s, y - 6 * s, x + 80 * s, y - 34 * s, { ...o, w: 14 * Math.sqrt(s), color: wood });
  inkLine(x - 80 * s, y - 34 * s, x + 80 * s, y - 6 * s, { ...o, w: 14 * Math.sqrt(s), color: wood });
  inkPath([[x - 52 * s, y - 30 * s], [x - 62 * s, y - 84 * s], [x - 30 * s, y - 120 * s], [x - 18 * s, y - 96 * s], [x + fl, y - 166 * s],
    [x + 24 * s, y - 104 * s], [x + 40 * s, y - 128 * s], [x + 62 * s, y - 78 * s], [x + 52 * s, y - 30 * s]], { ...o, closed: true, fill: C.orange, color: C.red, round: 1 });
  inkPath([[x - 26 * s, y - 32 * s], [x - 30 * s, y - 70 * s], [x - fl * 0.5, y - 116 * s], [x + 30 * s, y - 70 * s], [x + 26 * s, y - 32 * s]], { ...o, closed: true, fill: C.yellow, color: C.yellow, w: 2, round: 1 });
},   // [Sapiens]
  barn: (x, y, s, o) => {
  inkPath([[x - 130 * s, y], [x - 130 * s, y - 150 * s], [x - 152 * s, y - 150 * s], [x - 118 * s, y - 232 * s], [x, y - 282 * s],
    [x + 118 * s, y - 232 * s], [x + 152 * s, y - 150 * s], [x + 130 * s, y - 150 * s], [x + 130 * s, y]], { ...o, closed: true, fill: (o.paperFill ? null : o.fill) || '#c4574a' });
  inkLine(x - 152 * s, y - 150 * s, x + 152 * s, y - 150 * s, o);
  inkRect(x - 54 * s, y - 118 * s, 108 * s, 118 * s, { ...o, fill: '#efe6d2' });
  inkLine(x - 54 * s, y - 118 * s, x + 54 * s, y, { ...o, w: o.w * 0.7 }); inkLine(x + 54 * s, y - 118 * s, x - 54 * s, y, { ...o, w: o.w * 0.7 });
},   // [Animal Farm]
  crate: (x, y, s, o) => {
  inkRect(x - 150 * s, y - 100 * s, 300 * s, 100 * s, { ...o, fill: (o.paperFill ? null : o.fill) || '#c99a62' });
  for (const k of [1, 2]) inkLine(x - 150 * s, y - k * 33 * s, x + 150 * s, y - k * 33 * s, { ...o, w: 2.4 });
},   // [Animal Farm]
});
POSES.pray = { la: [[-30, 52], [17, 22]], ra: [[30, 52], [-17, 22]] };   // [윤동주]

// ---------- cuts ----------
// Peter-style picture changes: list = [[t0, draw], ...] sorted by time; the last shot whose t0 <= t is drawn.
// draw(t, lt) gets the local time since its start. Cuts are hard by default: the old picture is gone the moment the
// new one starts drawing (research 2026-11-10: a 0.22 s cross-fade read as a double exposure in every probe), and the
// new shot settles in with a 3.5 % zoom over `settleT`. Pass fade > 0 for a cross-fade (the old shot fades out first,
// then the new one draws). Use 2.5 to 5 s per shot, keyed to cue times (q.s(k), q.w('단어', k)).
function shots(t, list, { fade = 0, settle = 0.035, settleT = 0.22, lead = 0.3 } = {}) {
  // lead: every shot after the first cuts in `lead` s before its listed time, so the picture is already drawing when
  // the voice says the word (2026-11-10 review: shots opened on a blank page while the subject was being named)
  const st = (k) => list[k][0] - (k > 0 ? Math.max(0, Math.min(lead, (list[k][0] - list[k - 1][0]) * 0.5)) : 0);   // a short shot keeps half its time
  let i = -1; for (let k = 0; k < list.length; k++) if (t >= st(k)) i = k;
  if (i < 0) return -1;
  const t0 = st(i), draw = list[i][1];
  DOCENT.shot = { i, t0, t1: i + 1 < list.length ? st(i + 1) : null, n: list.length };
  const fresh = () => ({ figs: [], heads: [], tags: [], bubbles: [], things: [] });
  if (fade > 0 && i > 0 && t - t0 < fade) {   // optional cross-fade: only the old picture, fading out
    const lp = t - st(i - 1) - (i - 1 > 0 ? fade : 0);   // the old shot's own clock, as when it was current
    DOCENT.slots = fresh(); DOCENT.ghostOk++; withAlpha(1 - (t - t0) / fade, () => { list[i - 1][1](t, lp); docentTags(); }); DOCENT.ghostOk--;
    return i;
  }
  DOCENT.slots = fresh();
  const lt = t - t0 - (fade > 0 && i > 0 ? fade : 0), f = clamp01(lt / settleT);
  ctx.save();
  if (i > 0 && f < 1) { const sc = 1 - settle * (1 - smooth(f)); ctx.translate(W / 2, H / 2); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2); }
  draw(t, lt);
  docentTags();
  ctx.restore();
  return i;
}
// draw-on progress helper: 0 before t0, 1 after t0 + d
const dp = (t, t0, d = 0.8) => clamp01((t - t0) / d);

// ---------- library additions: v2 redraw of 'Elon Musk' and '생각을 바꾸는 책 10권', 2026-11-10 ----------
// Registered from the projects' common.js, checked on their gallery sheets and on Gate A stills before any scene used
// them. Props follow TEMPLATES "A" ((x, y) = bottom centre, s = 1 ≈ 160 px tall); animals s = 1 ≈ 300 px.
const docentFillOf = (o, c) => (o.paperFill ? null : o.fill) || c;   // a prop's own colour unless solid: true paints it in paper
// slim rocket; s = 1 ≈ 160 px tall (use s 2.4-3 for a hero rocket). o.flame 0..1 (hangs ≤ 46*s px below y), o.t, o.tilt, o.legs
PROPS.rocket = (x, y, s, o) => {
  const k = s * 0.38, P = (dx, dy) => [x + dx * k, y + dy * k], tilt = o.tilt || 0;
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.translate(-x, -y);
  if (o.flame > 0 && !o.paperFill) { const f = o.flame * (1 + 0.12 * Math.sin((o.t || 0) * 31)), pts = [];
    for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push(P(-26 + 52 * u, -6 + Math.sin(u * Math.PI) * 120 * f)); }
    inkPath(pts, { ...o, w: o.w * 0.8, color: C.red, fill: opaqueMix(C.yellow, 0.6), closed: true }); }
  inkPath([P(-34, -10), P(-34, -330), P(-26, -372), P(0, -420), P(26, -372), P(34, -330), P(34, -10)], { ...o, closed: true, fill: docentFillOf(o, C.paper) });
  inkLine(...P(-34, -150), ...P(34, -150), { ...o, w: o.w * 0.7 });
  inkCircle(...P(0, -280), 13 * k, { ...o, w: o.w * 0.7, fill: docentFillOf(o, opaqueMix(C.teal, 0.4)) });
  for (const d of [-1, 1]) inkPath([P(d * 34, -80), P(d * 70, -6), P(d * 34, -10)], { ...o, closed: true, fill: docentFillOf(o, opaqueMix(C.red, 0.55)) });
  if (o.legs) for (const d of [-1, 1]) inkLine(...P(d * 30, -50), ...P(d * 92, 0), { ...o });
  ctx.restore();
};
// electric car, side view; s = 1 ≈ 160 px long
PROPS.car = (x, y, s, o) => {
  const k = s * 0.45, P = (dx, dy) => [x + dx * k, y + dy * k];
  inkPath([P(-180, -34), P(-176, -78), P(-120, -92), P(-66, -146), P(60, -150), P(124, -96), P(180, -82), P(184, -34)], { ...o, closed: true, fill: docentFillOf(o, opaqueMix(C.red, 0.5)) });
  inkPath([P(-54, -136), P(-14, -136), P(-14, -98), P(-104, -98)], { ...o, w: o.w * 0.7, closed: true, fill: docentFillOf(o, opaqueMix(C.teal, 0.3)) });
  inkPath([P(0, -138), P(52, -140), P(104, -98), P(0, -98)], { ...o, w: o.w * 0.7, closed: true, fill: docentFillOf(o, opaqueMix(C.teal, 0.3)) });
  for (const d of [-110, 110]) { const c = P(d, -32); inkCircle(c[0], c[1], 34 * k, { ...o, fill: docentFillOf(o, INK()) }); inkCircle(c[0], c[1], 13 * k, { ...o, w: o.w * 0.6, fill: docentFillOf(o, C.paper) }); }
};
// planet Mars, sitting on (x, y); s = 1 ≈ 160 px across
PROPS.mars = (x, y, s, o) => {
  const r = 80 * s, cy = y - r;
  inkCircle(x, cy, r, { ...o, fill: docentFillOf(o, opaqueMix(C.red, 0.6)) });
  for (const [dx, dy, rr] of [[-0.35, -0.2, 0.18], [0.3, 0.25, 0.13], [0.1, -0.45, 0.09], [-0.1, 0.45, 0.1]])
    inkCircle(x + dx * r, cy + dy * r, rr * r, { ...o, w: o.w * 0.6, fill: docentFillOf(o, opaqueMix(C.red, 0.85)) });
};
// factory: saw-tooth roof and a chimney; s = 1 ≈ 160 px tall, 300 px wide. o.smoke 0..1 + o.t
PROPS.factory = (x, y, s, o) => {
  const k = s * 0.62, P = (dx, dy) => [x + dx * k, y + dy * k], roof = [P(-230, 0), P(-230, -140)];
  for (let i = 0; i < 4; i++) { roof.push(P(-230 + i * 100, -200)); roof.push(P(-230 + (i + 1) * 100, -140)); }
  roof.push(P(230, -140), P(230, 0));
  inkRect(...P(170, -258), 40 * k, 120 * k, { ...o, fill: docentFillOf(o, C.paper) });
  inkPath(roof, { ...o, closed: true, fill: docentFillOf(o, opaqueMix(C.grey, 0.5)) });
  for (let i = 0; i < 4; i++) inkRect(...P(-205 + i * 105, -100), 60 * k, 50 * k, { ...o, w: o.w * 0.6, fill: docentFillOf(o, opaqueMix(C.yellow, 0.45)) });
  if (o.smoke > 0 && !o.paperFill) for (let i = 0; i < 3; i++) { const u = (((o.t || 0) * 0.4 + i / 3) % 1);
    inkCircle(...P(190 + 40 * u, -300 - 110 * u), (14 + 22 * u) * k, { ...o, w: o.w * 0.6, fill: opaqueMix(C.grey, 0.4) }); }
};
// money bag with '$'; s = 1 ≈ 160 px tall. Write its amount with hand() under or beside it.
PROPS.moneybag = (x, y, s, o) => {
  const P = (dx, dy) => [x + dx * s, y + dy * s];
  inkPath([P(-30, -128), P(-74, -88), P(-88, -36), P(-64, 0), P(64, 0), P(88, -36), P(74, -88), P(30, -128)], { ...o, closed: true, fill: docentFillOf(o, opaqueMix(C.yellow, 0.5)) });
  inkPath([P(-32, -128), P(-20, -156), P(20, -156), P(32, -128)], { ...o, closed: true, fill: docentFillOf(o, opaqueMix(C.yellow, 0.5)) });
  if (!o.paperFill) hand('$', x, y - 60 * s, { size: 70 * s, p: o.p, a: o.a, color: INK() });
};
// a small satellite with two solar panels; s = 1 ≈ 160 px wide (it floats: draw it in the sky)
PROPS.satellite = (x, y, s, o) => {
  const P = (dx, dy) => [x + dx * s, y + dy * s];
  inkRect(...P(-24, -56), 48 * s, 40 * s, { ...o, fill: docentFillOf(o, opaqueMix(C.grey, 0.5)) });
  for (const d of [-1, 1]) { inkLine(...P(d * 24, -36), ...P(d * 36, -36), o);
    inkRect(...P(d > 0 ? 36 : -80, -52), 44 * s, 32 * s, { ...o, fill: docentFillOf(o, opaqueMix(C.teal, 0.45)) }); }
  inkLine(...P(0, -56), ...P(0, -76), o); inkCircle(...P(0, -80), 5 * s, o);
};


// A person in a wheelchair (Hawking in the ten-books video): chair back and seat, the seated person, then the big
// wheel in front (outline only, so the legs show through the spokes). Returns the person's anchors.
function seated(id, x, y, o = {}) {
  const s = o.s ?? 1, p = o.p ?? 1, a = o.a ?? 1, d = o.flip ? -1 : 1;
  inkLine(x - d * 26 * s, y - 104 * s, x - d * 40 * s, y - 250 * s, { p, a, w: 5 });                      // backrest
  inkLine(x - d * 40 * s, y - 250 * s, x - d * 70 * s, y - 250 * s, { p, a, w: 5 });                      // push handle
  inkLine(x - d * 30 * s, y - 100 * s, x + d * 70 * s, y - 100 * s, { p, a, w: 5 });                       // seat
  const f = person(id, x, y - 4 * s, { ...o, sit: true });
  inkCircle(x, y - 62 * s, 62 * s, { p, a, w: 4.5 });                                                       // big wheel (outline only)
  for (let k = 0; k < 3; k++) { const an = k * Math.PI / 3; inkLine(x - Math.cos(an) * 56 * s, y - 62 * s - Math.sin(an) * 56 * s, x + Math.cos(an) * 56 * s, y - 62 * s + Math.sin(an) * 56 * s, { p, a, w: 2 }); }
  inkCircle(x + d * 104 * s, y - 16 * s, 16 * s, { p, a, w: 4, fill: INK() });                             // front castor
  inkLine(x + d * 70 * s, y - 100 * s, x + d * 104 * s, y - 32 * s, { p, a, w: 4 });
  return f;
}

const docentAnimalFill = (o, c) => o.fill || c;
Object.assign(ANIMALS, {
  // octopus, front view: a big soft mantle with two eyes, eight curling arms with suckers on the ground
  octopus: (T, o, q) => {
    const f = docentAnimalFill(o, opaqueMix(C.orange, 0.7)), s = o.s;
    for (let i = 0; i < 8; i++) {                                   // arms first (behind the mantle): thick tubes, ink outline under a fill stroke
      const u = (i - 3.5) / 3.5, side = u >= 0 ? 1 : -1, pts = [];
      for (let k = 0; k <= 12; k++) { const v = k / 12;
        const x = u * 40 + (u * 190) * v + side * Math.sin(v * Math.PI * 1.2 + i) * 22 * (1 - Math.abs(u) * 0.4);
        const y = -112 + Math.min(1, v * 1.15) * 104 - (v > 0.82 ? Math.sin((v - 0.82) / 0.18 * Math.PI) * 26 : 0);
        pts.push(T(x, y)); }
      inkPath(pts, { ...o, w: 26 * s, p: q(0), color: INK(), jit: 0.6 });
      inkPath(pts, { ...o, w: 17 * s, p: q(0), color: f, jit: 0.6 });
      if (i === 1 || i === 6) for (let k = 4; k <= 10; k += 3) { const [px, py] = pts[k]; inkCircle(px, py + 3 * s, 4.5 * s, { ...o, w: o.w * 0.4, p: q(1), fill: opaqueMix(C.paper, 0.9) }); }
    }
    inkPath([T(-62, -110), T(-80, -190), T(-60, -262), T(0, -292), T(60, -262), T(80, -190), T(62, -110)], { ...o, closed: true, round: 3, p: q(1), fill: f });
    for (const d of [-1, 1]) { inkEllipse(...T(d * 30, -150), 17 * s, 14 * s, { ...o, w: o.w * 0.7, p: q(2), fill: opaqueMix(C.paper, 0.95) });
      const e = T(d * 30, -149); disc(e[0], e[1], 7 * s, INK(), o.a * clamp01(q(3) * 2)); }
    for (const [dx, dy] of [[-30, -232], [24, -248], [6, -206]]) inkCircle(...T(dx, dy), 7 * s, { ...o, w: o.w * 0.5, p: q(3), fill: opaqueMix(C.orange, 0.9) });
    return { head: T(0, -200), r: 70 * s, mouth: T(0, -118), top: T(0, -296), half: 240 };
  },
  // bat in flight, front view: scalloped wings with finger bones, pointed ears, small fangs
  bat: (T, o, q) => {
    const f = docentAnimalFill(o, opaqueMix(INK(), 0.6)), s = o.s;
    for (const d of [-1, 1]) {
      const W = [[16, -170], [70, -230], [150, -250], [240, -210], [210, -170], [180, -150], [140, -160], [110, -130], [70, -140], [36, -120]].map(([x, y]) => T(d * x, y));
      inkPath(W, { ...o, closed: true, p: q(0), fill: f });
      for (const [x, y] of [[150, -250], [210, -170], [110, -130]]) inkLine(...T(d * 30, -170), ...T(d * x, y), { ...o, w: o.w * 0.5, p: q(1), color: C.paper });
    }
    inkEllipse(...T(0, -150), 34 * s, 48 * s, { ...o, p: q(1), fill: f });
    for (const d of [-1, 1]) inkPath([T(d * 8, -218), T(d * 22, -256), T(d * 32, -210)], { ...o, closed: true, p: q(2), fill: f });
    inkCircle(...T(0, -206), 28 * s, { ...o, p: q(2), fill: f });
    for (const d of [-1, 1]) { const e = T(d * 11, -210); disc(e[0], e[1], 5 * s, C.paper, o.a * clamp01(q(3) * 2)); }
    for (const d of [-1, 1]) inkPath([T(d * 6, -190), T(d * 3, -180), T(d * 1, -190)], { ...o, closed: true, w: o.w * 0.4, p: q(4), fill: C.paper, color: C.paper });
    return { head: T(0, -206), r: 28 * s, mouth: T(0, -190), top: T(0, -260) };
  },
  // honeybee, side view: striped abdomen with a stinger, fuzzy thorax, round head with antennae, two clear wings
  bee: (T, o, q) => {
    const s = o.s, y = docentAnimalFill(o, opaqueMix(C.yellow, 0.75));
    for (const d of [-20, 10, 40]) inkLine(...T(d, -92), ...T(d - 14, -40), { ...o, w: o.w * 0.6, p: q(0) });
    inkPath([T(-186, -106), T(-150, -100), T(-152, -112)], { ...o, closed: true, p: q(1), fill: INK() });
    inkEllipse(...T(-90, -110), 72 * s, 52 * s, { ...o, p: q(1), fill: y });
    for (const dx of [-120, -86, -52]) inkPath([T(dx - 9, -158), T(dx + 9, -160), T(dx + 9, -60), T(dx - 9, -62)], { ...o, closed: true, w: o.w * 0.5, p: q(2), fill: INK() });
    inkCircle(...T(4, -112), 40 * s, { ...o, p: q(2), fill: opaqueMix(C.orange, 0.55) });
    inkCircle(...T(72, -118), 32 * s, { ...o, p: q(2), fill: INK() });
    for (const d of [0, 1]) inkCurve(T(84, -146), T(100 + d * 20, -196), T(124 + d * 22, -190), { ...o, w: o.w * 0.6, p: q(3) });
    inkEllipse(...T(-30, -196), 62 * s, 32 * s, { ...o, w: o.w * 0.7, p: q(3), fill: opaqueMix(C.paper, 0.85) });
    inkEllipse(...T(10, -186), 44 * s, 24 * s, { ...o, w: o.w * 0.7, p: q(3), fill: opaqueMix(C.paper, 0.85) });
    const e = T(84, -124); disc(e[0], e[1], 6 * s, C.paper, o.a * clamp01(q(4) * 2));
    return { head: T(72, -118), r: 32 * s, mouth: T(98, -104), top: T(72, -226) };
  },
  // sea turtle, side view: domed shell with plates, head with a beak, front flipper forward, back flipper behind
  turtle: (T, o, q) => {
    const s = o.s, sh = docentAnimalFill(o, opaqueMix(C.green, 0.6)), skin = opaqueMix(C.green, 0.35);
    inkPath([T(-120, -36), T(-176, -10), T(-130, -14)], { ...o, closed: true, p: q(0), fill: skin });
    inkPath([T(40, -40), T(120, -6), T(150, -4), T(70, -50)], { ...o, closed: true, p: q(0), fill: skin });
    inkPath([T(-150, -40), T(-130, -110), T(-60, -150), T(30, -150), T(100, -110), T(120, -40)], { ...o, closed: true, round: 2, p: q(1), fill: sh });
    inkLine(...T(-150, -40), ...T(120, -40), { ...o, p: q(1) });
    for (const [x0, x1] of [[-100, -40], [-40, 30], [30, 90]]) inkPath([T(x0, -46), T(x0 + 10, -110), T(x1 - 10, -116), T(x1, -46)], { ...o, w: o.w * 0.5, p: q(2) });
    inkPath([T(110, -60), T(150, -96), T(196, -92), T(214, -70), T(186, -54), T(130, -48)], { ...o, closed: true, round: 2, p: q(2), fill: skin });
    const e = T(184, -80); disc(e[0], e[1], 6 * s, INK(), o.a * clamp01(q(3) * 2));
    inkLine(...T(196, -64), ...T(212, -68), { ...o, w: o.w * 0.5, p: q(3) });
    return { head: T(178, -76), r: 30 * s, mouth: T(210, -66), top: T(0, -156) };
  },
  // tick, side view: a round flat body, a small pointed head with mouthparts, eight bent legs
  tick: (T, o, q) => {
    const s = o.s, f = docentAnimalFill(o, opaqueMix(C.red, 0.55));
    for (const far of [1, 0]) for (let i = 0; i < 4; i++) { const x = -50 + i * 34 + far * 12;   // eight legs: four far (darker), four near
      inkPath([T(x, -70), T(x + (i < 2 ? -30 : 30), -110 + far * 8), T(x + (i < 2 ? -50 : 54) + far * 10, -4)], { ...o, w: o.w * 0.7, p: q(0), color: far ? C.dim : o.color }); }
    inkEllipse(...T(0, -76), 86 * s, 56 * s, { ...o, p: q(1), fill: f });
    inkEllipse(...T(-6, -96), 46 * s, 22 * s, { ...o, w: o.w * 0.5, p: q(2), fill: opaqueMix(C.red, 0.8) });
    inkPath([T(80, -92), T(126, -78), T(80, -62)], { ...o, closed: true, p: q(2), fill: opaqueMix(INK(), 0.7) });
    inkLine(...T(124, -78), ...T(146, -74), { ...o, w: o.w * 0.6, p: q(3) });
    const e = T(96, -84); disc(e[0], e[1], 4 * s, C.paper, o.a * clamp01(q(4) * 2));
    return { head: T(98, -78), r: 24 * s, mouth: T(140, -74), top: T(0, -140) };
  },
});

Object.assign(PROPS, {
  // a wheelchair seen from the side (Hawking: use seated('hawking', …) which draws the chair around the person)
  wheelchair: (x, y, s, o) => {
    inkLine(x - 26 * s, y - 104 * s, x - 40 * s, y - 230 * s, { ...o, w: o.w * 1.2 }); inkLine(x - 40 * s, y - 230 * s, x - 66 * s, y - 230 * s, o);
    inkLine(x - 30 * s, y - 100 * s, x + 70 * s, y - 100 * s, { ...o, w: o.w * 1.2 }); inkLine(x + 70 * s, y - 100 * s, x + 104 * s, y - 32 * s, o);
    inkCircle(x, y - 62 * s, 62 * s, o); for (let k = 0; k < 3; k++) { const an = k * Math.PI / 3; inkLine(x - Math.cos(an) * 56 * s, y - 62 * s - Math.sin(an) * 56 * s, x + Math.cos(an) * 56 * s, y - 62 * s + Math.sin(an) * 56 * s, { ...o, w: o.w * 0.5 }); }
    inkCircle(x + 104 * s, y - 16 * s, 16 * s, { ...o, fill: docentFillOf(o, INK()) });
  },
  // a barbell: the bar with two big plates at the ends and nothing in the middle (Taleb's strategy)
  barbell: (x, y, s, o) => {
    inkLine(x - 190 * s, y - 70 * s, x + 190 * s, y - 70 * s, { ...o, w: o.w * 1.4 });
    for (const d of [-1, 1]) { inkRect(x + d * 150 * s - 18 * s, y - 140 * s, 36 * s, 140 * s, { ...o, fill: docentFillOf(o, opaqueMix(INK(), 0.75)) });
      inkRect(x + d * 118 * s - 12 * s, y - 120 * s, 24 * s, 100 * s, { ...o, fill: docentFillOf(o, opaqueMix(INK(), 0.55)) }); }
  },
  // a playing card (o.label: the corner mark, default 'A'), upright
  card: (x, y, s, o) => {
    inkRect(x - 56 * s, y - 160 * s, 112 * s, 160 * s, { ...o, fill: docentFillOf(o, C.paper) });
    if (!o.paperFill) { hand(o.label || 'A', x - 32 * s, y - 132 * s, { size: 36 * s, p: o.p, a: o.a, color: C.red });
      PROPS.heart && PROPS.heart(x, y - 46 * s, 0.4 * s, { ...o, fill: C.red }); }
  },
  // a seesaw: o.tilt -1..1 (positive = right side down); the pleasure-pain balance
  seesaw: (x, y, s, o) => {
    inkPath([[x - 40 * s, y], [x, y - 70 * s], [x + 40 * s, y]], { ...o, closed: true, fill: docentFillOf(o, opaqueMix(C.grey, 0.5)) });
    const ang = (o.tilt || 0) * 0.28, dx = Math.cos(ang) * 200 * s, dy = Math.sin(ang) * 200 * s;
    inkLine(x - dx, y - 70 * s - dy, x + dx, y - 70 * s + dy, { ...o, w: o.w * 1.6 });
  },
});
// Poses three authors drew on their own (a barbell overhead: swan, moonwalk, dopamine) and a hand held up to stop.
Object.assign(POSES, {
  lift: { la: [[-50, -55], [-56, -150]], ra: [[50, -55], [56, -150]] },   // both arms straight up
  stop: { la: [[-18, 52], [-28, 108]], ra: [[56, -6], [96, -40]] },     // one hand up, palm out
});
// A spiral notepad (an author's or a reporter's notebook). The kit's `note` is a music note: six authors of the
// Elon Musk v2 redraw asked for a notebook, got a quaver, and drew their own.
PROPS.notebook = (x, y, s, o) => {
  inkRect(x - 60 * s, y - 120 * s, 120 * s, 120 * s, { ...o, fill: docentFillOf(o, C.paper) });
  for (let i = 0; i < 5; i++) inkCircle(x - 44 * s + i * 22 * s, y - 120 * s, 5 * s, { ...o, w: o.w * 0.5 });
  for (let i = 0; i < 4; i++) inkLine(x - 44 * s, y - (92 - i * 22) * s, x + 44 * s, y - (92 - i * 22) * s, { ...o, w: o.w * 0.45, color: C.dim });
};
// cross() takes the top-left corner (like inkRect) while ring() takes the centre; one author placed every X off its
// target. crossAt() is the centred one: crossAt(cx, cy, w, h).
function crossAt(cx, cy, w, h, o = {}) { return cross(cx - w / 2, cy - h / 2, w, h, o); }   // a function: a project may redefine it
