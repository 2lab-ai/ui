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
const DOCENT_KINDS = ['partial', 'ghost', 'zone', 'off', 'empty', 'wordy', 'cover', 'overflow', 'rig', 'tails', 'heads', 'mouths', 'figs', 'bubbles', 'tags', 'animals', 'people'];
const DOCENT = { t: 0, shot: null, slots: null, ghostOk: 0 };
function DOCENT_FRAME(t) { DOCENT.t = t; DOCENT.shot = null; for (const k of DOCENT_KINDS) DOCENT[k] = [];
  DOCENT.slots = { figs: [], heads: [], tags: [], bubbles: [] }; }   // slots: where things are or will be (placement)
DOCENT_FRAME(0);
function docentNote(kind, what) { if (DOCENT[kind].length < 40) DOCENT[kind].push(what); }
function docentReport() {
  const far = DOCENT.tails.filter(([tx, ty]) => !DOCENT.heads.some(([hx, hy, r]) => Math.hypot(tx - hx, ty - hy) < r + 70)
    && !DOCENT.mouths.some(([mx, my]) => Math.hypot(tx - mx, ty - my) < 90));
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
  return { t: DOCENT.t, shot: DOCENT.shot, partial: DOCENT.partial, ghost: DOCENT.ghost, zone: DOCENT.zone, off: DOCENT.off,
    empty: DOCENT.empty, wordy: DOCENT.wordy, cover: [...new Set(cover)], overflow: DOCENT.overflow, tailFar: far,
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
  if (p <= 0 || a <= 0 || pts.length < 2) return;
  if (round) pts = chaikin(pts, closed, round);
  if (p < 0.98) docentNote('partial', 'ink');
  const ea = a * ctx.globalAlpha;   // effective opacity, including withAlpha() from the drawing that contains this stroke
  if (ea < 0.55 && !ghostOk && !DOCENT.ghostOk) docentNote('ghost', `ink a=${ea.toFixed(2)}`);
  { const m = ctx.getTransform(); let lo = -1e9, l = 1e9, r = -1e9;   // full affine: rotation and mirroring included
    for (const [px, py] of pts) { const sx = m.a * px + m.c * py + m.e, sy = m.b * px + m.d * py + m.f; if (sy > lo) lo = sy; if (sx < l) l = sx; if (sx > r) r = sx; }
    let hi = 1e9; for (const [px, py] of pts) { const sy = m.b * px + m.d * py + m.f; if (sy < hi) hi = sy; }
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
function hand(str, x, y, { size = 54, color = null, p = 1, a = 1, align = 'center', weight = 700, rot = 0, base = 'middle', ghostOk = false } = {}) {
  if (p <= 0 || a <= 0 || !str) return;
  if (p < 0.98) docentNote('partial', 'hand:' + String(str).slice(0, 12));
  if (a * ctx.globalAlpha < 0.55 && !ghostOk && !DOCENT.ghostOk) docentNote('ghost', 'hand:' + String(str).slice(0, 12));
  { const m = ctx.getTransform(); ctx.font = `${weight} ${size}px ${HAND()}`;
    const tw = ctx.measureText(str).width, x0 = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
    const cs = Math.cos(rot), sn = Math.sin(rot), xs = [], ys = [];
    for (const [u, v] of [[x0 - x, -size * 0.5], [x0 - x + tw, -size * 0.5], [x0 - x, size * 0.45], [x0 - x + tw, size * 0.45]]) {
      const px = x + u * cs - v * sn, py = y + u * sn + v * cs; xs.push(m.a * px + m.c * py + m.e); ys.push(m.b * px + m.d * py + m.f); }
    if (Math.max(...ys) > SUB_Y) docentNote('zone', 'hand:' + String(str).slice(0, 12));
    if (Math.min(...xs) < -4 || Math.max(...xs) > W + 4 || Math.min(...ys) < -4) docentNote('off', 'hand:' + String(str).slice(0, 12)); }
  ctx.save();
  ctx.font = `${weight} ${size}px ${HAND()}`;
  const w = ctx.measureText(str).width;
  const x0 = align === 'center' ? -w / 2 : align === 'right' ? -w : 0;
  ctx.translate(x, y); if (rot) ctx.rotate(rot);
  if (p < 1) { ctx.beginPath(); ctx.rect(x0 - 4, -size, w * clamp01(p) + 8, size * 2); ctx.clip(); }
  ctx.globalAlpha *= clamp01(a); ctx.fillStyle = color || KEY(); ctx.textAlign = 'left'; ctx.textBaseline = base;
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
  const topY = hc[1] - R * (hat ? 2.2 : hair && hair !== 'bald' ? 1.25 : 1.05);
  const anchors = { head: hc, r: R, mouth: [hc[0] + dir * R * 0.15, hc[1] + R * 0.4], top: [hc[0], topY], dir,
    hands: [F(sh[0] + P.la[1][0] - (outfit ? 21 : 0), sh[1] + P.la[1][1]), F(sh[0] + P.ra[1][0] + (outfit ? 21 : 0), sh[1] + P.ra[1][1])],
    box: [x - 70 * s, topY, x + 70 * s, y] };
  // the name tag sits beside the chest on the side the figure turns away from, clear of every bubble above
  const tagS = Math.max(36, 42 * Math.min(1, s0)), tagW = tag ? handW(tag, tagS) / 2 + 6 : 0;
  let tagX = x - dir * (100 * s + tagW); if (tagX - tagW < 40 || tagX + tagW > W - 40) tagX = x + dir * (100 * s + tagW);
  const tagY = y - 205 * s, tagRect = [tagX - tagW, tagY - tagS * 0.6, tagX + tagW, tagY + tagS * 0.6];
  if (s > 0) { DOCENT.slots.figs.push(anchors.box); DOCENT.slots.heads.push([hc[0], hc[1], R]); if (tag) DOCENT.slots.tags.push(tagRect); }
  if (p <= 0 || a <= 0 || s <= 0) return anchors;
  if (o.ghostOk) DOCENT.ghostOk++;
  DOCENT.heads.push([hc[0], hc[1], R, topY]); DOCENT.mouths.push(anchors.mouth); DOCENT.figs.push(anchors.box);
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
    const fillOf = (k) => mix(acc || C.grey, k);
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
    if (outfit !== 'dress') inkLine(...F(...neck), ...F(...hip), { p: ph(1, 6), w: lw, color: ink });
    else inkLine(...F(...neck), ...F(0, -226 + slump), { p: ph(1, 6), w: lw, color: ink });
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
    // head (paper-filled so it covers what is behind it)
    if (snout) inkPath([F(head[0] + 30, head[1] - 4), F(head[0] + 118, head[1] + 18), F(head[0] + 116, head[1] + 30), F(head[0] + 30, head[1] + 22)], { p: ph(0, 6), w: lw, fill: PAPER(), color: ink });
    inkEllipse(hc[0], hc[1], R, (shell ? 40 * s0 * h : R), { p: ph(0, 6), w: lw, fill: PAPER(), color: ink });
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
      if (hatStyle === 'bowler') { inkArc(hc[0], hc[1] - R * 0.5, R * 0.85, R * 0.75, Math.PI, Math.PI * 2, { w: lw * 0.8, fill: ink, color: ink, closed: true }); inkLine(hc[0] - R * 1.25, hc[1] - R * 0.5, hc[0] + R * 1.25, hc[1] - R * 0.5, { w: lw * 1.2, color: ink }); }
      if (helmet) {   // Greek helmet: cap over the top of the head and a red crest
        inkArc(hc[0], hc[1], (hr + 4) * s, (hr + 4) * s, Math.PI * 1.02, Math.PI * 1.98, { w: lw * 1.1, color: ink });
        inkLine(hc[0] - (hr + 4) * s, hc[1] - 2 * s, hc[0] - (hr - 10) * s, hc[1] + 26 * s, { w: lw, color: ink });
        inkCurve([hc[0] - 34 * s, hc[1] - 50 * s], [hc[0] + 6 * s, hc[1] - 112 * s], [hc[0] + 56 * s, hc[1] - 40 * s], { w: lw * 2.6, color: C.red });
      }
      if (tag) { DOCENT.tags.push(tagRect); hand(tag, tagX, tagY, { size: tagS, color: acc || KEY() }); }
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
    const fur = o.fill || mix(C.grey, 0.6), dark = o.color || INK(), pale = C.paper || '#ffffff';
    const R = { ...o, round: 2 };
    // far legs (darker, behind the body)
    inkPath([T(-64, -70), T(-72, -2), T(-44, -2), T(-40, -70)], { ...R, closed: true, p: q(0), fill: mix(C.dim, 0.6), round: 1 });
    inkPath([T(30, -70), T(32, -2), T(60, -2), T(58, -70)], { ...R, closed: true, p: q(0), fill: mix(C.dim, 0.45), round: 1 });
    // the bushy tail: a long low flag as big as the body, long hair hanging from its underside
    const tail = [T(-104, -132), T(-170, -150), T(-250, -138), T(-330, -104), T(-344, -70), T(-300, -46), T(-220, -40), T(-150, -50), T(-112, -80)];
    inkPath(tail, { ...R, closed: true, p: q(1), fill: mix(C.dim, 0.7), jit: 1.8 });
    for (let i = 0; i < 11; i++) { const u = i / 10, [ax, ay] = T(-130 - u * 200, -46 + Math.sin(u * 3.1) * -6 + u * 2), k = (18 + 10 * Math.abs(Math.sin(i * 1.7))) * o.s;
      inkLine(ax, ay, ax - 10 * o.dir * o.s, ay + k, { ...o, p: q(1), w: o.w * 0.55, jit: 0.3 }); }
    for (let i = 0; i < 6; i++) { const u = i / 5, [ax, ay] = T(-170 - u * 150, -146 + u * 40); inkLine(ax, ay, ax - 16 * o.dir * o.s, ay - 10 * o.s, { ...o, p: q(1), w: o.w * 0.5, jit: 0.3 }); }
    // body, neck and the long tube snout in one outline
    const body = [T(-116, -104), T(-84, -150), T(-10, -160), T(58, -146), T(100, -120), T(132, -104), T(190, -90), T(246, -76), T(276, -68),
      T(278, -60), T(246, -62), T(186, -70), T(128, -76), T(92, -66), T(36, -56), T(-40, -54), T(-98, -66)];
    inkPath(body, { ...R, closed: true, p: q(2), fill: fur });
    // near legs: a dark hind leg, a pale front leg with a black wrist band and knuckle claws
    inkPath([T(-92, -70), T(-98, 0), T(-60, 0), T(-58, -74)], { ...R, closed: true, p: q(3), fill: mix(C.dim, 0.75), round: 1 });
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
    const fur = o.fill || mix(C.orange, 0.45);
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
    const fur = o.fill || mix(C.yellow, 0.4);
    inkCurve(T(-110, -120), T(-150, -170), T(-128, -200), { ...o, p: q(0), w: o.w * 1.8 });
    for (const [k, lx] of [-70, 64, -100, 36].entries()) inkPath([T(lx - 13, -90), T(lx - 13, 0), T(lx + 13, 0), T(lx + 13, -90)], { ...o, closed: true, p: q(1), fill: k < 2 ? mix(C.dim, 0.35) : fur });
    inkEllipse(...T(-5, -120), 118 * o.s, 50 * o.s, { ...o, p: q(1), fill: fur });
    inkPath([T(70, -150), T(96, -214), T(150, -216), T(200, -186), T(206, -164), T(150, -150), T(118, -132)], { ...o, closed: true, p: q(2), fill: fur, round: 2 });
    inkPath([T(112, -210), T(92, -206), T(80, -150), T(98, -146), T(112, -170)], { ...o, closed: true, p: q(3), fill: mix(C.dim, 0.7), round: 2 });
    const n = T(204, -176); disc(n[0], n[1], 9 * o.s, INK(), o.a * clamp01(q(3) * 2));
    const e = T(140, -194); disc(e[0], e[1], 5 * o.s, INK(), o.a * clamp01(q(3) * 2));
    inkLine(...T(80, -150), ...T(108, -128), { ...o, p: q(3), color: C.red, w: o.w * 2.2 });
    return { head: T(150, -184), r: 44 * o.s, mouth: T(196, -158), top: T(130, -220) };
  },
  bird: (T, o, q) => {   // perched bird: beak, wing on the body, fanned tail, two thin legs
    const f = o.fill || mix(C.teal, 0.45);
    for (const d of [-10, 10]) inkPoly([T(d, -40), T(d, 0), T(d + 12, 0)], { ...o, p: q(0), w: o.w * 0.7 });
    inkPath([T(-60, -86), T(-126, -60), T(-130, -96), T(-80, -108)], { ...o, closed: true, p: q(1), fill: f });
    inkEllipse(...T(0, -84), 66 * o.s, 46 * o.s, { ...o, p: q(1), fill: f });
    inkCircle(...T(52, -134), 34 * o.s, { ...o, p: q(2), fill: f });
    inkPath([T(82, -142), T(118, -132), T(84, -122)], { ...o, closed: true, p: q(3), fill: C.yellow });
    inkPath([T(-40, -100), T(30, -102), T(10, -66), T(-30, -60)], { ...o, closed: true, p: q(3), fill: mix(C.dim, 0.35) });
    const e = T(60, -142); disc(e[0], e[1], 5 * o.s, INK(), o.a * clamp01(q(3) * 2));
    return { head: T(52, -134), r: 34 * o.s, mouth: T(112, -132), top: T(52, -170) };
  },
  fish: (T, o, q) => {   // side view: tail fin, dorsal fin, gill arc, eye, a few scales
    const f = o.fill || mix(C.orange, 0.5);
    inkPath([T(-90, -90), T(-150, -130), T(-140, -90), T(-150, -50)], { ...o, closed: true, p: q(0), fill: f });
    inkPath([T(-20, -134), T(10, -170), T(40, -132)], { ...o, closed: true, p: q(0), fill: f });
    inkEllipse(...T(0, -90), 100 * o.s, 46 * o.s, { ...o, p: q(1), fill: f });
    inkArc(...T(48, -90), 22 * o.s, 34 * o.s, -Math.PI * 0.45, Math.PI * 0.45, { ...o, p: q(2) });
    for (const [sx, sy] of [[-30, -100], [-6, -80], [-50, -78], [-24, -60]]) inkArc(...T(sx, sy), 12 * o.s, 12 * o.s, -Math.PI * 0.4, Math.PI * 0.4, { ...o, p: q(2), w: o.w * 0.5 });
    const e = T(70, -100); disc(e[0], e[1], 6 * o.s, INK(), o.a * clamp01(q(2) * 2));
    return { head: T(66, -94), r: 34 * o.s, mouth: T(100, -86), top: T(10, -172) };
  },
  mouse: (T, o, q) => {   // big round ears, pointed nose with whiskers, long thin tail
    const f = o.fill || mix(C.grey, 0.6);
    inkCurve(T(-70, -20), T(-170, 10), T(-200, -60), { ...o, p: q(0), w: o.w * 0.6 });
    inkPath([T(-76, 0), T(-84, -46), T(-30, -84), T(40, -72), T(96, -32), T(116, -16), T(60, 0)], { ...o, closed: true, p: q(1), fill: f, round: 2 });
    inkCircle(...T(30, -86), 26 * o.s, { ...o, p: q(2), fill: mix(C.magenta, 0.25) });
    const n = T(112, -18); disc(n[0], n[1], 6 * o.s, INK(), o.a * clamp01(q(3) * 2));
    for (const k of [-1, 1]) inkLine(...T(100, -22), ...T(140, -22 + k * 14), { ...o, p: q(3), w: o.w * 0.4 });
    const e = T(64, -40); disc(e[0], e[1], 4 * o.s, INK(), o.a * clamp01(q(3) * 2));
    return { head: T(70, -38), r: 30 * o.s, mouth: T(108, -16), top: T(30, -112) };
  },
  rabbit: (T, o, q) => {   // sitting: two long upright ears, round tail, big hind foot
    const f = o.fill || mix(C.paper || '#ffffff', 0.95);
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
    const f = o.fill || mix(C.grey, 0.7);
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
  const xs = [x - 270 * s, x + 270 * s].sort((u, v) => u - v);
  anc.box = [xs[0], anc.top[1], xs[1], y]; anc.dir = dir;
  let tagRect = null, str = null;
  if (o.tag) { str = typeof o.tag === 'string' ? o.tag : kind; const tw = handW(str, 40) / 2 + 6;
    anc.top = [anc.top[0], anc.top[1] - 70]; anc.box[1] = anc.top[1]; tagRect = [anc.top[0] - tw, anc.top[1], anc.top[0] + tw, anc.top[1] + 48]; }
  DOCENT.slots.figs.push(anc.box); DOCENT.slots.heads.push([anc.head[0], anc.head[1], anc.r]); if (tagRect) DOCENT.slots.tags.push(tagRect);
  if (hidden) return anc;
  DOCENT.heads.push([anc.head[0], anc.head[1], anc.r]); DOCENT.mouths.push(anc.mouth); DOCENT.figs.push(anc.box); DOCENT.animals.push(kind);
  if (tagRect) { DOCENT.tags.push(tagRect); hand(str, anc.top[0], anc.top[1] + 24, { size: 40, p: oo.p, a: oo.a }); }
  return anc;
}
// Asset gallery: every cast look, animal and prop on one labelled sheet, for review before a scene uses them
// (make-docent-book §4 gate; tools/gallery.py renders it). kind: 'cast' | 'animals' | 'props' | 'figures'.
function docentGallery(kind, page = 0) {
  const items = kind === 'cast' ? Object.keys(CAST) : kind === 'animals' ? Object.keys(ANIMALS) : kind === 'props' ? Object.keys(PROPS) : ['short', 'spiky', 'curly', 'long', 'bun', 'ponytail', 'side', 'bald'];
  const per = kind === 'props' ? 12 : 8, cols = kind === 'props' ? 6 : 4, list = items.slice(page * per, page * per + per);
  list.forEach((id, i) => {
    const cy = i < cols ? 460 : 880;
    const x = cols === 6 ? 170 + (i % cols) * 316 : 250 + (i % cols) * 473;
    if (kind === 'cast') person(id, x, cy - 40, { s: 0.85, tag: true });
    else if (kind === 'animals') animal(id, x, cy - 60, { s: 0.62 });
    else if (kind === 'props') prop(id, x, cy - 90, 1);
    else figure(x, cy - 40, { s: 0.85, hair: id, accent: ['red', 'blue', 'green', 'orange', 'teal', 'magenta', 'yellow', 'grey'][i], outfit: ['suit', 'dress', 'tshirt', 'coat'][i % 4] });
    hand(id, x, cy + (kind === 'props' ? -40 : -10), { size: 34, color: C.dim });
  });
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
  DOCENT.slots.bubbles.push([x, y, x + w, y + h]);   // reserved even before it pops in, so later bubbles do not move
  if (p <= 0 || a <= 0) return;
  if (!str && !body) docentNote('empty', `bubble@${Math.round(x)},${Math.round(y)}`);
  if (str && String(str).trim().split(/\s+/).length > 8) docentNote('wordy', String(str).slice(0, 16));
  if (tail && !tailOk) DOCENT.tails.push(tail);
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
    for (const b of DOCENT.slots.bubbles) cost += hit(b, x, y) * 12 + (hit(b, x, y) > 0 ? 20000 : 0);
    for (const [cx, cy, cr] of DOCENT.slots.heads) cost += hit([cx - cr, cy - cr, cx + cr, cy + cr], x, y) * 12;
    const [mx0, my0] = kind === 'thought' ? [hx, hy - r * 0.2] : who.mouth;
    for (const g of DOCENT.slots.tags) if (bubbleCrosses(x, y, w, h, [mx0, my0], g)) cost += 50000;
    if (!best || cost < best.cost) best = { x, y, cost };
  }
  const { x, y } = best, bx = x + w / 2, by = y + h / 2;
  const [mx, my] = kind === 'thought' ? [hx, hy - r * 0.2] : who.mouth;
  // aim at the mouth but stop outside the head: the first point on the ray mouth -> bubble that clears the head by 8 px
  const ux = Math.cos(Math.atan2(by - my, bx - mx)), uy = Math.sin(Math.atan2(by - my, bx - mx));
  const R2 = r + (kind === 'thought' ? 26 : 8), fx = mx - hx, fy = my - hy, B = fx * ux + fy * uy, Cq = fx * fx + fy * fy - R2 * R2;
  const d = Math.max(kind === 'thought' ? 0 : r * 0.3, -B + Math.sqrt(Math.max(0, B * B - Cq)));
  let tail = [mx + ux * d, my + uy * d];
  if (uy < 0 && tail[1] > top - 8 && Math.abs(tail[0] - hx) < r * 1.2) { const e = (tail[1] - (top - 8)) / -uy; tail = [tail[0] + ux * e, tail[1] + uy * e]; }   // clear hair and hats
  bubble(x, y, w, h, { ...o, kind, size, text: str, tail });
  return [x, y, w, h];
}
// a board on a stand (Peter's "named idea" board); term is handwritten on it
function board(x, y, w, h, { term = null, size = 64, p = 1, a = 1, legs = true, color = null } = {}) {
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
  hand('“', x - w / 2 - 20, y - 40, { size: size * 2.2, p, a, color: C.dim });
  const hgt = handBlock(str, x, y, w, { size, p, a, color: INK() });
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
  tree: (x, y, s, o) => { inkLine(x, y, x, y - 90 * s, { ...o, w: 6 }); inkLine(x, y - 70 * s, x - 34 * s, y - 112 * s, o); inkLine(x, y - 80 * s, x + 30 * s, y - 120 * s, o); inkEllipse(x, y - 150 * s, 80 * s, 62 * s, { ...o, fill: o.fill || mix(C.green, 0.25) }); },
  balance: (x, y, s, o) => { inkLine(x, y, x, y - 150 * s, o); inkLine(x - 40 * s, y, x + 40 * s, y, o); inkLine(x - 100 * s, y - 140 * s, x + 100 * s, y - 140 * s, o);
    for (const d of [-1, 1]) { inkLine(x + d * 100 * s, y - 140 * s, x + d * 100 * s, y - 90 * s, o); inkArc(x + d * 100 * s, y - 90 * s, 40 * s, 20 * s, 0, Math.PI, o); } },
  bulb: (x, y, s, o) => { inkArc(x, y - 110 * s, 48 * s, 48 * s, Math.PI * 0.75, Math.PI * 2.25, { ...o, fill: o.fill || mix(C.yellow, 0.35) }); inkRect(x - 18 * s, y - 50 * s, 36 * s, 34 * s, o); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55; inkLine(x + Math.cos(a) * 66 * s, y - 110 * s + Math.sin(a) * 66 * s, x + Math.cos(a) * 88 * s, y - 110 * s + Math.sin(a) * 88 * s, o); } },
  clock: (x, y, s, o) => { inkCircle(x, y - 80 * s, 72 * s, { ...o, fill: o.fill }); const h = (o.t || 0) * 0.4; inkLine(x, y - 80 * s, x + Math.sin(h) * 40 * s, y - 80 * s - Math.cos(h) * 40 * s, o); inkLine(x, y - 80 * s, x + Math.sin(h * 12) * 58 * s, y - 80 * s - Math.cos(h * 12) * 58 * s, { ...o, w: 2.6 }); },
  calendar: (x, y, s, o) => { inkRect(x - 70 * s, y - 140 * s, 140 * s, 140 * s, { ...o, fill: o.fill }); for (let i = 0; i < 7; i++) inkCircle(x - 54 * s + i * 18 * s, y - 140 * s, 6 * s, { ...o, w: 2.4 }); if (o.label) hand(o.label, x, y - 66 * s, { size: 36 * s, p: o.p, a: o.a }); },
  signpost: (x, y, s, o) => { inkLine(x, y, x, y - 220 * s, { ...o, w: 6 }); inkPath([[x, y - 200 * s], [x + 120 * s, y - 200 * s], [x + 144 * s, y - 180 * s], [x + 120 * s, y - 160 * s], [x, y - 160 * s]], o); inkPath([[x, y - 150 * s], [x - 120 * s, y - 150 * s], [x - 144 * s, y - 130 * s], [x - 120 * s, y - 110 * s], [x, y - 110 * s]], o); },
  house: (x, y, s, o) => { inkRect(x - 80 * s, y - 110 * s, 160 * s, 110 * s, o); inkPoly([[x - 96 * s, y - 104 * s], [x, y - 180 * s], [x + 96 * s, y - 104 * s]], o); inkRect(x - 18 * s, y - 56 * s, 36 * s, 56 * s, o); },
  brain: (x, y, s, o) => { const cy = y - 80 * s, pts = []; for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; const r = (68 + 10 * Math.abs(Math.sin(a * 5))) * s; pts.push([x + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 0.9]); }
    inkPath(pts, { ...o, closed: true, color: o.color || C.magenta || C.purple, fill: o.fill }); inkCurve([x - 50 * s, cy - 20 * s], [x - 10 * s, cy + 30 * s], [x + 40 * s, cy - 10 * s], { ...o, color: o.color || C.magenta || C.purple, w: 2.6 }); inkLine(x, cy - 66 * s, x, cy + 50 * s, { ...o, color: o.color || C.magenta || C.purple, w: 2.6 }); },
  heart: (x, y, s, o) => { const pts = []; for (let i = 0; i <= 40; i++) { const t = (i / 40) * Math.PI * 2; pts.push([x + 4 * s * 16 * Math.sin(t) ** 3, y - 70 * s - 4 * s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]); } inkPath(pts, { ...o, closed: true, fill: o.fill || mix(C.red, 0.4), color: o.color || C.red }); },
  key: (x, y, s, o) => { inkCircle(x - 60 * s, y - 60 * s, 30 * s, o); inkLine(x - 30 * s, y - 60 * s, x + 80 * s, y - 60 * s, o); inkLine(x + 50 * s, y - 60 * s, x + 50 * s, y - 36 * s, o); inkLine(x + 74 * s, y - 60 * s, x + 74 * s, y - 40 * s, o); },
  lock: (x, y, s, o) => { inkRect(x - 56 * s, y - 100 * s, 112 * s, 100 * s, { ...o, fill: o.fill }); inkArc(x, y - 100 * s, 36 * s, 44 * s, Math.PI, Math.PI * 2, o); inkCircle(x, y - 56 * s, 10 * s, o); },
  box: (x, y, s, o) => { inkRect(x - 70 * s, y - 110 * s, 140 * s, 110 * s, { ...o, fill: o.fill }); inkPoly([[x - 70 * s, y - 110 * s], [x - 40 * s, y - 140 * s], [x + 100 * s, y - 140 * s], [x + 70 * s, y - 110 * s]], o); inkPoly([[x + 100 * s, y - 140 * s], [x + 100 * s, y - 30 * s], [x + 70 * s, y]], o); },
  coin: (x, y, s, o) => { inkEllipse(x, y - 50 * s, 50 * s, 50 * s, { ...o, fill: o.fill || mix(C.yellow, 0.4) }); hand('₩', x, y - 48 * s, { size: 54 * s, p: o.p, a: o.a, color: INK() }); },
  phone: (x, y, s, o) => { inkRect(x - 40 * s, y - 150 * s, 80 * s, 150 * s, o); inkRect(x - 30 * s, y - 136 * s, 60 * s, 110 * s, { ...o, w: 2.4 }); },
  laptop: (x, y, s, o) => { inkRect(x - 90 * s, y - 130 * s, 180 * s, 110 * s, o); inkPoly([[x - 110 * s, y], [x + 110 * s, y], [x + 90 * s, y - 20 * s], [x - 90 * s, y - 20 * s]], { ...o, closed: true }); },
  monitor: (x, y, s, o) => { inkRect(x - 100 * s, y - 170 * s, 200 * s, 130 * s, { ...o, fill: o.fill }); inkLine(x, y - 40 * s, x, y - 10 * s, o); inkLine(x - 50 * s, y - 6 * s, x + 50 * s, y - 6 * s, o); },
  camera: (x, y, s, o) => { inkRect(x - 70 * s, y - 100 * s, 140 * s, 86 * s, { ...o, fill: o.fill }); inkCircle(x, y - 57 * s, 28 * s, o); inkRect(x - 30 * s, y - 116 * s, 40 * s, 16 * s, o); inkLine(x, y - 14 * s, x - 30 * s, y + 0, o); inkLine(x, y - 14 * s, x + 30 * s, y + 0, o); },
  desk: (x, y, s, o) => { inkLine(x - 120 * s, y - 80 * s, x + 120 * s, y - 80 * s, { ...o, w: 6 }); inkLine(x - 100 * s, y - 80 * s, x - 100 * s, y, o); inkLine(x + 100 * s, y - 80 * s, x + 100 * s, y, o); },
  chair: (x, y, s, o) => { inkPoly([[x - 40 * s, y - 160 * s], [x - 40 * s, y], [x - 40 * s, y - 70 * s], [x + 40 * s, y - 70 * s], [x + 40 * s, y]], o); },
  bench: (x, y, s, o) => { for (const yy of [70, 90]) inkLine(x - 130 * s, y - yy * s, x + 130 * s, y - yy * s, o); inkLine(x - 130 * s, y - 120 * s, x + 130 * s, y - 120 * s, o); for (const d of [-1, 1]) inkLine(x + d * 110 * s, y - 120 * s, x + d * 110 * s, y, o); },
  flag: (x, y, s, o) => { inkLine(x, y, x, y - 200 * s, o); inkPath([[x, y - 200 * s], [x + 100 * s, y - 175 * s], [x, y - 150 * s]], { ...o, closed: true, fill: o.fill || mix(C.red, 0.45) }); },
  mountain: (x, y, s, o) => { inkPoly([[x - 170 * s, y], [x - 50 * s, y - 170 * s], [x + 10 * s, y - 90 * s], [x + 60 * s, y - 140 * s], [x + 170 * s, y]], o); },
  sun: (x, y, s, o) => { inkCircle(x, y - 80 * s, 40 * s, { ...o, fill: o.fill || mix(C.yellow, 0.4) }); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; inkLine(x + Math.cos(a) * 56 * s, y - 80 * s + Math.sin(a) * 56 * s, x + Math.cos(a) * 76 * s, y - 80 * s + Math.sin(a) * 76 * s, o); } },
  cloud: (x, y, s, o) => { const pts = []; for (let i = 0; i <= 60; i++) { const a = (i / 60) * Math.PI * 2; const r = 1 + 0.18 * Math.abs(Math.sin(a * 3.5)); pts.push([x + Math.cos(a) * 110 * s * r, y - 60 * s + Math.sin(a) * 46 * s * r]); } inkPath(pts, { ...o, closed: true, fill: o.fill || PAPER() }); },
  star: (x, y, s, o) => { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2, r = (i % 2 ? 30 : 72) * s; pts.push([x + Math.cos(a) * r, y - 76 * s + Math.sin(a) * r]); } inkPath(pts, { ...o, closed: true, fill: o.fill || mix(C.yellow, 0.4) }); },
  eye: (x, y, s, o) => { inkArc(x, y - 30 * s, 90 * s, 70 * s, Math.PI * 1.15, Math.PI * 1.85, o); inkArc(x, y - 130 * s, 90 * s, 70 * s, Math.PI * 0.15, Math.PI * 0.85, o); inkCircle(x, y - 80 * s, 28 * s, o); inkDot(x, y - 80 * s, 12 * s, o); },
  magnifier: (x, y, s, o) => { inkCircle(x - 20 * s, y - 100 * s, 50 * s, { ...o, fill: o.fill }); inkLine(x + 16 * s, y - 64 * s, x + 70 * s, y - 10 * s, { ...o, w: 8 }); },
  puzzle: (x, y, s, o) => { inkPath([[x - 60 * s, y], [x - 60 * s, y - 120 * s], [x - 14 * s, y - 120 * s], [x - 14 * s, y - 140 * s], [x + 14 * s, y - 140 * s], [x + 14 * s, y - 120 * s], [x + 60 * s, y - 120 * s], [x + 60 * s, y - 74 * s], [x + 80 * s, y - 74 * s], [x + 80 * s, y - 46 * s], [x + 60 * s, y - 46 * s], [x + 60 * s, y]], { ...o, closed: true, fill: o.fill }); },
  trophy: (x, y, s, o) => { inkPath([[x - 50 * s, y - 160 * s], [x + 50 * s, y - 160 * s], [x + 30 * s, y - 80 * s], [x - 30 * s, y - 80 * s]], { ...o, closed: true, fill: o.fill || mix(C.yellow, 0.4) }); inkLine(x, y - 80 * s, x, y - 30 * s, o); inkRect(x - 40 * s, y - 30 * s, 80 * s, 30 * s, o); },
  bridge: (x, y, s, o) => {   // a plank over a gap between two cliffs
    inkPoly([[x - 220 * s, y - 60 * s], [x - 90 * s, y - 60 * s], [x - 80 * s, y - 20 * s], [x - 100 * s, y + 10 * s]], o);
    inkPoly([[x + 220 * s, y - 60 * s], [x + 90 * s, y - 60 * s], [x + 84 * s, y - 24 * s], [x + 102 * s, y + 10 * s]], o);
    inkRect(x - 120 * s, y - 76 * s, 240 * s, 16 * s, { ...o, fill: o.fill || mix(C.orange, 0.35) }); },
  globe: (x, y, s, o) => { inkCircle(x, y - 80 * s, 76 * s, { ...o, fill: o.fill }); inkEllipse(x, y - 80 * s, 30 * s, 76 * s, o); inkLine(x - 76 * s, y - 80 * s, x + 76 * s, y - 80 * s, o); },
  note: (x, y, s, o) => { inkEllipse(x - 20 * s, y - 24 * s, 24 * s, 18 * s, { ...o, fill: o.color || INK() }); inkLine(x + 2 * s, y - 26 * s, x + 2 * s, y - 140 * s, o); inkCurve([x + 2 * s, y - 140 * s], [x + 50 * s, y - 120 * s], [x + 40 * s, y - 80 * s], o); },
  staff: (x, y, s, o) => { for (let i = 0; i < 5; i++) inkLine(x - 200 * s, y - (40 + i * 20) * s, x + 200 * s, y - (40 + i * 20) * s, { ...o, w: 2.4 }); },
  record: (x, y, s, o) => { inkCircle(x, y - 90 * s, 90 * s, { ...o, fill: o.fill || INK() }); inkCircle(x, y - 90 * s, 60 * s, { ...o, color: C.dim, w: 2 }); inkCircle(x, y - 90 * s, 26 * s, { ...o, fill: o.label || mix(C.red, 0.8), color: PAPER() }); },
  phonograph: (x, y, s, o) => { inkRect(x - 110 * s, y - 70 * s, 220 * s, 70 * s, { ...o, fill: o.fill }); inkEllipse(x - 10 * s, y - 70 * s, 84 * s, 18 * s, o); inkLine(x - 10 * s, y - 90 * s, x - 10 * s, y - 70 * s, o);
    inkPath([[x + 90 * s, y - 70 * s], [x + 90 * s, y - 150 * s], [x + 140 * s, y - 230 * s], [x + 40 * s, y - 230 * s], [x + 90 * s, y - 150 * s]], o); },
  doll: (x, y, s, o) => { inkPath([[x, y - 170 * s], [x - 34 * s, y - 150 * s], [x - 40 * s, y - 110 * s], [x - 60 * s, y - 60 * s], [x - 56 * s, y], [x + 56 * s, y], [x + 60 * s, y - 60 * s], [x + 40 * s, y - 110 * s], [x + 34 * s, y - 150 * s]], { ...o, closed: true, fill: o.fill || mix(C.red, 0.3) });
    inkCircle(x, y - 130 * s, 26 * s, { ...o, fill: PAPER() }); inkDot(x - 9 * s, y - 132 * s, 3 * s, o); inkDot(x + 9 * s, y - 132 * s, 3 * s, o); },
  pencil: (x, y, s, o) => { inkPath([[x - 14 * s, y - 180 * s], [x + 14 * s, y - 180 * s], [x + 14 * s, y - 40 * s], [x, y], [x - 14 * s, y - 40 * s]], { ...o, closed: true, fill: o.fill || mix(C.yellow, 0.4) }); },
  paper: (x, y, s, o) => { inkRect(x - 80 * s, y - 200 * s, 160 * s, 200 * s, { ...o, fill: o.fill || mix(C.paper || '#ffffff', 0.6) }); if (!o.blank) for (let i = 0; i < 6; i++) inkLine(x - 56 * s, y - (164 - i * 26) * s, x + 56 * s, y - (164 - i * 26) * s, { ...o, w: 2, color: C.dim }); },
  window: (x, y, s, o) => { inkRect(x - 90 * s, y - 200 * s, 180 * s, 200 * s, { ...o, fill: o.fill || mix(C.blue, 0.1) }); inkLine(x, y - 200 * s, x, y, o); inkLine(x - 90 * s, y - 100 * s, x + 90 * s, y - 100 * s, o); },
  fly: (x, y, s, o) => { inkDot(x, y, 9 * s, o); inkEllipse(x - 8 * s, y - 12 * s, 10 * s, 6 * s, { ...o, w: 2 }); inkEllipse(x + 8 * s, y - 12 * s, 10 * s, 6 * s, { ...o, w: 2 }); },
  rock: (x, y, s, o) => { inkPath([[x - 80 * s, y], [x - 70 * s, y - 50 * s], [x - 20 * s, y - 80 * s], [x + 50 * s, y - 70 * s], [x + 84 * s, y - 20 * s], [x + 76 * s, y]], { ...o, closed: true, fill: o.fill || mix(C.grey, 0.4) }); },
  puddle: (x, y, s, o) => { inkEllipse(x, y - 14 * s, 120 * s, 22 * s, { ...o, fill: o.fill || mix(C.blue, 0.3) }); },
  pawn: (x, y, s, o) => { inkCircle(x, y - 130 * s, 22 * s, { ...o, fill: o.fill || INK() }); inkPath([[x - 18 * s, y - 108 * s], [x + 18 * s, y - 108 * s], [x + 40 * s, y - 20 * s], [x - 40 * s, y - 20 * s]], { ...o, closed: true, fill: o.fill || INK() }); inkRect(x - 50 * s, y - 20 * s, 100 * s, 20 * s, { ...o, fill: o.fill || INK() }); },
  cap: (x, y, s, o) => { inkEllipse(x, y - 30 * s, 40 * s, 30 * s, { ...o, fill: o.fill || mix(C.yellow, 0.5) }); for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; inkLine(x + Math.cos(a) * 40 * s, y - 30 * s + Math.sin(a) * 30 * s, x + Math.cos(a) * 46 * s, y - 30 * s + Math.sin(a) * 34 * s, { ...o, w: 2 }); } },
  map: (x, y, s, o) => { inkPoly([[x - 120 * s, y], [x - 120 * s, y - 160 * s], [x - 40 * s, y - 140 * s], [x + 40 * s, y - 160 * s], [x + 120 * s, y - 140 * s], [x + 120 * s, y], [x + 40 * s, y - 20 * s], [x - 40 * s, y], [x - 120 * s, y]], { ...o, fill: o.fill || mix(C.paper || '#ffffff', 0.5) });
    inkPath([[x - 90 * s, y - 40 * s], [x - 50 * s, y - 90 * s], [x + 10 * s, y - 60 * s], [x + 80 * s, y - 120 * s]], { ...o, color: C.red, w: 3, dash: [10, 8] }); },
  stadium: (x, y, s, o) => { inkArc(x, y, 260 * s, 120 * s, Math.PI, Math.PI * 2, o); inkArc(x, y, 200 * s, 80 * s, Math.PI, Math.PI * 2, o); inkLine(x - 260 * s, y, x + 260 * s, y, o); },
};
function prop(name, x, y, s = 1, o = {}) {
  const f = PROPS[name]; if (!f) { MISS.add('prop:' + name); return; }
  const oo = { p: 1, a: 1, w: 4 * Math.max(0.7, Math.sqrt(s)), ...o };
  if (oo.p <= 0 || oo.a <= 0) return;
  f(x, y, s, oo);
}

// ---------- cuts ----------
// Peter-style picture changes: list = [[t0, draw], ...] sorted by time; the last shot whose t0 <= t is drawn.
// draw(t, lt) gets the local time since its start. Each shot fades and settles in (0.22 s) and the previous shot
// fades out under it. Use 2.5 to 5 s per shot, keyed to cue times (q.s(k), q.w('단어', k)).
function shots(t, list, { fade = 0.22, settle = 0.035 } = {}) {
  let i = -1; for (let k = 0; k < list.length; k++) if (t >= list[k][0]) i = k;
  if (i < 0) return -1;
  const [t0, draw] = list[i], f = clamp01((t - t0) / fade);
  DOCENT.shot = { i, t0, t1: i + 1 < list.length ? list[i + 1][0] : null, n: list.length };
  const fresh = () => ({ figs: [], heads: [], tags: [], bubbles: [] });
  if (f < 1 && i > 0) { DOCENT.slots = fresh(); DOCENT.ghostOk++; withAlpha(1 - f, () => list[i - 1][1](t, t - list[i - 1][0])); DOCENT.ghostOk--; }
  DOCENT.slots = fresh();
  const fading = i > 0 && f < 1; if (fading) DOCENT.ghostOk++;
  withAlpha(i === 0 ? 1 : f, () => {
    const sc = 1 - settle * (1 - smooth(f));
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2);
    draw(t, t - t0);
    ctx.restore();
  });
  if (fading) DOCENT.ghostOk--;
  return i;
}
// draw-on progress helper: 0 before t0, 1 after t0 + d
const dp = (t, t0, d = 0.8) => clamp01((t - t0) / d);
