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
function inkPath(pts, { color = null, w = 4, p = 1, closed = false, jit = 1.4, seed = null, fill = null, fillA = 1, a = 1, dash = null } = {}) {
  if (p <= 0 || a <= 0 || pts.length < 2) return;
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
function hand(str, x, y, { size = 54, color = null, p = 1, a = 1, align = 'center', weight = 700, rot = 0, base = 'middle' } = {}) {
  if (p <= 0 || a <= 0 || !str) return;
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
  for (const word of String(str).split(' ')) {
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
function figure(x, y, o = {}) {
  const { s = 1, pose = 'stand', face = 'smile', p = 1, a = 1, flip = false, t = 0, walk = 0, sit = false,
    tie = false, glasses = false, hair = false, helmet = false, shell = false, snout = false, hat = false,
    blindfold = false, look = 0, color = null, w = 4.2 } = o;
  if (p <= 0 || a <= 0 || s <= 0) return;
  const P = POSES[pose] || POSES.stand;
  const ink = color || INK();
  const F = (dx, dy) => [x + (flip ? -dx : dx) * s, y + dy * s];   // local -> screen
  const slump = pose === 'slump' ? 16 : 0;
  const hip = sit ? [0, -100] : [0, -122], sh = [0, -228 + slump], neck = [0, -246 + slump];
  const head = [slump * 0.6, -292 + slump * 1.4], hr = 44;
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
    // body
    inkLine(...F(...neck), ...F(...hip), { p: ph(1, 6), w: lw, color: ink });
    // legs
    const legs = sit
      ? [[[18, 4], [70, 4]], [[30, 6], [78, 8]]].map((l) => [l[0], [l[1][0], l[1][1] + 98]])
      : walk ? [[[-14 + 22 * Math.sin(t * 6), 60], [-26 + 40 * Math.sin(t * 6), 122]], [[14 - 22 * Math.sin(t * 6), 60], [26 - 40 * Math.sin(t * 6), 122]]]
        : [[[-14, 60], [-26, 122]], [[14, 60], [26, 122]]];
    legs.forEach((lg, k) => {
      const knee = sit ? [hip[0] + lg[1][0] * 0.0 + lg[0][0], hip[1] + lg[0][1]] : [hip[0] + lg[0][0], hip[1] + lg[0][1]];
      const foot = sit ? [hip[0] + lg[1][0], hip[1] + lg[1][1]] : [hip[0] + lg[1][0], hip[1] + lg[1][1]];
      if (sit) { const k1 = [hip[0] + 64 + k * 10, hip[1] + 2]; inkPoly([F(...hip), F(...k1), F(k1[0], k1[1] + 96)], { p: ph(3, 6), w: lw, color: ink }); }
      else inkPoly([F(...hip), F(...knee), F(...foot)], { p: ph(3, 6), w: lw, color: ink });
    });
    // arms (wave swings the raised hand)
    const arm = (A, k) => {
      let [el, hd] = A;
      if (pose === 'wave' && k === 1) hd = [hd[0] + 14 * Math.sin(t * 9), hd[1]];
      if (walk && pose === 'stand') { const sw = 24 * Math.sin(t * 6) * (k ? -1 : 1); el = [el[0] + sw * 0.4, el[1]]; hd = [hd[0] + sw, hd[1]]; }
      inkPoly([F(sh[0], sh[1]), F(sh[0] + el[0], sh[1] + el[1]), F(sh[0] + hd[0], sh[1] + hd[1])], { p: ph(2, 6), w: lw, color: ink });
    };
    arm(P.la, 0); arm(P.ra, 1);
    // head (paper-filled so it covers what is behind it)
    const hc = F(...head);
    if (snout) inkPath([F(head[0] + 30, head[1] - 4), F(head[0] + 118, head[1] + 18), F(head[0] + 116, head[1] + 30), F(head[0] + 30, head[1] + 22)], { p: ph(0, 6), w: lw, fill: PAPER(), color: ink });
    inkEllipse(hc[0], hc[1], hr * s, (shell ? 40 : hr) * s, { p: ph(0, 6), w: lw, fill: PAPER(), color: ink });
    const pf = ph(4.5, 6);
    if (pf > 0) withAlpha(pf, () => drawFace(hc[0], hc[1], hr * s, face, { look: flip ? -look : look, ink, t, blindfold }));
    // accessories
    const pa = ph(4, 6);
    if (pa > 0) withAlpha(pa, () => {
      if (tie) { const a1 = F(0, -240 + slump), a2 = F(-9, -222 + slump), a3 = F(0, -178 + slump), a4 = F(9, -222 + slump);
        inkPath([a1, a2, a3, a4], { closed: true, w: lw * 0.7, color: ink }); }
      if (glasses) { inkCircle(hc[0] - 15 * s, hc[1] - 4 * s, 11 * s, { w: lw * 0.6, color: ink }); inkCircle(hc[0] + 15 * s, hc[1] - 4 * s, 11 * s, { w: lw * 0.6, color: ink });
        inkLine(hc[0] - 4 * s, hc[1] - 6 * s, hc[0] + 4 * s, hc[1] - 6 * s, { w: lw * 0.6, color: ink }); }
      if (hair) for (const side of [-1, 1]) inkCurve([hc[0] + side * 12 * s, hc[1] - 44 * s], [hc[0] + side * 60 * s, hc[1] - 30 * s], [hc[0] + side * 52 * s, hc[1] + 50 * s], { w: lw * 0.8, color: ink });
      if (hat) { inkRect(hc[0] - 30 * s, hc[1] - 96 * s, 60 * s, 52 * s, { w: lw * 0.8, fill: ink, color: ink }); inkLine(hc[0] - 52 * s, hc[1] - 44 * s, hc[0] + 52 * s, hc[1] - 44 * s, { w: lw, color: ink }); }
      if (helmet) {   // Greek helmet: cap over the top of the head and a red crest
        inkArc(hc[0], hc[1], (hr + 4) * s, (hr + 4) * s, Math.PI * 1.02, Math.PI * 1.98, { w: lw * 1.1, color: ink });
        inkLine(hc[0] - (hr + 4) * s, hc[1] - 2 * s, hc[0] - (hr - 10) * s, hc[1] + 26 * s, { w: lw, color: ink });
        inkCurve([hc[0] - 34 * s, hc[1] - 50 * s], [hc[0] + 6 * s, hc[1] - 112 * s], [hc[0] + 56 * s, hc[1] - 40 * s], { w: lw * 2.6, color: C.red });
      }
    });
  });
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

// ---------- bubbles, boards, cards ----------
// speech bubble (rounded box) or thought bubble (cloud) with a tail pointing at (tx, ty). body(x, y, w, h) draws
// what is inside, or pass text.
function bubble(x, y, w, h, { tail = null, kind = 'speech', text: str = null, size = 44, p = 1, a = 1, body = null, color = null } = {}) {
  if (p <= 0 || a <= 0) return;
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
      if (tail) {
        const [tx, ty] = tail;
        for (const [f, r] of [[0.55, 13], [0.75, 9], [0.9, 6]]) inkCircle(lerp(cx, tx, f), lerp(cy + h * 0.3, ty, f), r, { w: 3, fill: PAPER(), color });
      }
    } else {
      const r = Math.min(40, h / 2.2);
      const pts = [];
      const corner = (ccx, ccy, a0) => { for (let i = 0; i <= 6; i++) { const ang = a0 + (i / 6) * Math.PI / 2; pts.push([ccx + Math.cos(ang) * r, ccy + Math.sin(ang) * r]); } };
      corner(x + w - r, y + r, -Math.PI / 2); corner(x + w - r, y + h - r, 0);
      if (tail) { const [tx, ty] = tail; const bx = clamp01((tx - x) / w) * (w - 2 * r - 50) + x + r;
        pts.push([bx + 50, y + h], [tx, ty], [bx + 12, y + h]); }
      corner(x + r, y + h - r, Math.PI / 2); corner(x + r, y + r, Math.PI);
      inkPath(pts, { closed: true, fill: PAPER(), w: 3.6, jit: 0.8, color });
    }
    if (str) handBlock(str, cx, cy, w - 50, { size, color: color || INK() });
    if (body) body(x, y, w, h);
    ctx.restore();
  });
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
function teach(term, { x = 960, y = 760, p = 1, a = 1, t = 0, face = 'smile', fig = {} } = {}) {
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
  if (f < 1 && i > 0) withAlpha(1 - f, () => list[i - 1][1](t, t - list[i - 1][0]));
  withAlpha(i === 0 ? 1 : f, () => {
    const sc = 1 - settle * (1 - smooth(f));
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2);
    draw(t, t - t0);
    ctx.restore();
  });
  return i;
}
// draw-on progress helper: 0 before t0, 1 after t0 + d
const dp = (t, t0, d = 0.8) => clamp01((t - t0) / d);
