// scenes.js for 'Gödel, Escher, Bach' — docent video on theme sketch. Built from parts/*.js (common first).
// Shared helpers for the whole video live here; scene files prefix their own helpers with the scene id.
'use strict';
TITLE_CARD = signCard;

// stage positions (1920x1080; keep y > 900 free of text: subtitles live in the bottom 170 px)
const GROUND = 880;                 // feet line for full-size figures
const AX = 620, TX = 1300;          // default Achilles / Tortoise x
const ach = (t, o = {}) => achilles(o.x ?? AX, o.y ?? GROUND, { t, ...o });
const tor = (t, o = {}) => tortoise(o.x ?? TX, o.y ?? GROUND, { t, ...o });

// letter tiles for the MU puzzle: each letter in a hand-drawn box. hi = indexes to mark (red ring), dim = indexes faded
function tiles(str, x, y, { size = 72, p = 1, a = 1, hi = [], dim = [], color = null, gap = 10 } = {}) {
  const w = size * 0.95, n = str.length, x0 = x - (n * (w + gap) - gap) / 2;
  [...str].forEach((ch, i) => {
    const q = clamp01(p * n - i);
    if (q <= 0) return;
    const cx = x0 + i * (w + gap);
    const aa = a * (dim.includes(i) ? 0.3 : 1);
    inkRect(cx, y - size / 2, w, size, { p: q, a: aa, w: 3.4, fill: C.paper });
    hand(ch, cx + w / 2, y + 4, { size: size * 0.78, a: aa * q, color: color || (ch === 'M' ? INK() : ch === 'I' ? KEY() : C.green) });
    if (hi.includes(i)) ring(cx + w / 2, y, w * 0.72, size * 0.72, { a, p: q });
  });
  return n * (w + gap) - gap;
}
// a rule card "xI → xIU" written by hand
function ruleCard(x, y, n, left, right, { p = 1, a = 1, size = 52 } = {}) {
  hand(n, x - 230, y, { size: size * 0.8, p, a, color: C.dim, weight: 400 });
  hand(left, x - 60, y, { size, p, a, color: INK(), align: 'right' });
  inkArrow(x - 40, y, x + 40, y, { p, a, w: 4, color: KEY(), head: 16 });
  hand(right, x + 60, y, { size, p, a, color: INK(), align: 'left' });
}
// pq-system string: a bars, 'p', b bars, 'q', c bars
function pqString(a1, b1, c1, x, y, { p = 1, a = 1, s = 1, labels = false } = {}) {
  const bw = 34 * s, parts = [['bar', a1], ['p'], ['bar', b1], ['q'], ['bar', c1]];
  let w = 0; parts.forEach((pt) => { w += pt[0] === 'bar' ? pt[1] * bw + 16 * s : 64 * s; });
  let cx = x - w / 2, k = 0; const total = a1 + b1 + c1 + 2;
  parts.forEach((pt) => {
    if (pt[0] === 'bar') {
      for (let i = 0; i < pt[1]; i++) { const q = clamp01(p * total - k++); inkLine(cx + i * bw + 6 * s, y, cx + i * bw + 28 * s, y, { p: q, a, w: 7 * s }); }
      if (labels && p >= 1) hand(String(pt[1]), cx + (pt[1] * bw) / 2, y + 56 * s, { size: 40 * s, a, color: C.green });
      cx += pt[1] * bw + 16 * s;
    } else { const q = clamp01(p * total - k++); hand(pt[0], cx + 32 * s, y - 4 * s, { size: 70 * s, p: q, a, color: KEY() }); cx += 64 * s; }
  });
  return w;
}
// impossible staircase (our own drawing in the spirit of Escher's): a square ring of steps seen from above at an
// angle; walker = 0..1 position of a small figure going round; dir = 1 climbs clockwise
function penrose(x, y, s = 1, { p = 1, a = 1, walker = null, n = 14 } = {}) {
  const R = 300 * s, ry = 0.5;
  const pt = (u, h) => { const ang = u * Math.PI * 2 - Math.PI / 2; return [x + Math.cos(ang) * R, y + Math.sin(ang) * R * ry - h]; };
  // each step rises 10 px going round, but the ring closes: the "impossible" seam is hidden at the back
  for (let i = 0; i < n; i++) {
    const q = clamp01(p * n - i); if (q <= 0) continue;
    const u0 = i / n, u1 = (i + 1) / n, h = 12 * s * Math.sin(Math.PI * i / n) * 3;
    const [ax, ay] = pt(u0, h), [bx, by] = pt(u1, h);
    inkPoly([[ax, ay], [bx, by], [bx, by + 34 * s], [ax, ay + 34 * s]], { p: q, a, w: 3.4, fill: mix(C.paper, 0.9), closed: true });
    inkLine(bx, by, bx, by + 34 * s, { p: q, a, w: 3.4 });
  }
  if (walker != null) {
    const [wx, wy] = pt(walker % 1, 12 * s * Math.sin(Math.PI * (walker % 1)) * 3);
    figure(wx, wy, { s: 0.28 * s, walk: 1, t: walker * 40, a });
  }
}
// two hands drawing each other (simplified, our own drawing): left hand from the left, right hand from the right,
// each holding a pencil that touches the other's cuff
function drawingHands(x, y, s = 1, { p = 1, a = 1 } = {}) {
  const hand1 = (dx, flip) => {
    const f = (px, py) => [x + (flip ? -px : px) * s + dx * s, y + py * s];
    inkPath([f(-260, 40), f(-120, 30), f(-60, 0), f(-10, -20), f(30, -10), f(10, 10), f(-30, 20), f(-20, 40), f(-120, 70), f(-260, 80)], { p, a, w: 4, closed: true, fill: C.paper });
    inkLine(...f(-260, 40), ...f(-260, 80), { p, a, w: 4 });
    inkLine(...f(20, -16), ...f(90, 30), { p, a, w: 7, color: C.yellow });
  };
  hand1(-40, false); hand1(40, true);
  inkPath([[x - 200 * s, y + 160 * s], [x + 200 * s, y + 160 * s]], { p, a, w: 3, color: C.dim, dash: [10, 8] });
}
// video feedback: a screen inside a screen inside a screen, slowly turning
function screenLoop(x, y, s = 1, { p = 1, a = 1, t = 0, n = 7 } = {}) {
  for (let i = 0; i < n; i++) {
    const k = Math.pow(0.78, i), q = clamp01(p * n - i); if (q <= 0) continue;
    ctx.save(); ctx.translate(x, y); ctx.rotate(i * 0.12 + Math.sin(t * 0.6) * 0.02 * i);
    inkRect(-260 * s * k, -170 * s * k, 520 * s * k, 340 * s * k, { p: q, a: a * (1 - i * 0.08), w: 4 * Math.max(0.5, k), color: i % 2 ? KEY() : INK() });
    ctx.restore();
  }
}
// nested dolls: n dolls getting smaller left to right
function dolls(x, y, n = 5, { p = 1, a = 1, s = 1 } = {}) {
  let cx = x;
  for (let i = 0; i < n; i++) { const k = Math.pow(0.78, i) * s; prop('doll', cx, y, k, { p: clamp01(p * n - i), a }); cx += 130 * k + 30 * s; }
}
// little ants walking in a band (colony), each with its own phase; trail = draw dashed path
function antBand(x0, x1, y, n, t, { a = 1, s = 0.5, dir = 1, wobble = 18 } = {}) {
  for (let i = 0; i < n; i++) {
    const u = ((i / n) + t * 0.05 * dir) % 1, xx = lerp(x0, x1, (u + 1) % 1);
    ant(xx, y + Math.sin(i * 2.3 + t * 2) * wobble, { s, t: t + i, a, dir });
  }
}
// a numbered label in hand lettering at the top left of a shot ("1", "2"... for lists)
const tag = (str, x, y, o = {}) => hand(str, x, y, { size: 44, color: C.dim, weight: 400, ...o });

// ---------- intro (프롤로그): a 777-page book, three names, one question, two guides, one key word ----------
// small symbol portraits: 'math' = a formula card, 'art' = a staircase in a frame, 'music' = a staff with notes
function introIcon(kind, x, y, s = 1, { p = 1, a = 1 } = {}) {
  const w = 300 * s, h = 250 * s;
  inkRect(x - w / 2, y - h / 2, w, h, { p, a, w: 4, fill: C.paper });
  const q = clamp01((p - 0.3) / 0.7);
  if (q <= 0) return;
  if (kind === 'math') {
    ['1+1=2', 'x+0=x', 'a=b ?'].forEach((l, i) => hand(l, x, y - 70 * s + i * 70 * s, { size: 46 * s, p: clamp01(q * 3 - i), a, color: INK() }));
  } else if (kind === 'art') {
    prop('stairs', x + 6 * s, y + 90 * s, 1.0 * s, { p: q, a });
  } else if (kind === 'music') {
    prop('staff', x, y + 70 * s, 0.62 * s, { p: q, a });
    [[-90, 0], [-40, 20], [10, 40], [60, 60]].forEach(([dx, up], i) => prop('note', x + dx * s, y + (40 - up) * s, 0.42 * s, { p: clamp01(q * 4 - i), a }));
  }
}
// the glowing '나': a soft yellow halo with the word in the middle
function introMe(x, y, { p = 1, a = 1, size = 70, t = 0 } = {}) {
  if (p <= 0) return;
  const k = 1 + 0.06 * Math.sin(t * 3);
  for (const [r, al] of [[86, 0.16], [64, 0.24], [46, 0.36]]) disc(x, y, r * k * p * size / 70, C.yellow, a * al);
  hand('나', x, y + 4, { size, p, a, color: KEY() });
}
// a nerve cell: a small circle with a few dendrites; on = it is firing (yellow)
function introCell(x, y, r = 16, { p = 1, a = 1, on = false } = {}) {
  for (let i = 0; i < 5; i++) {
    const ang = i * 1.26 + 0.4;
    inkLine(x + Math.cos(ang) * r, y + Math.sin(ang) * r, x + Math.cos(ang) * r * 2, y + Math.sin(ang) * r * 2, { p, a, w: 2.4 });
  }
  inkCircle(x, y, r, { p, a, w: 3, fill: on ? C.yellow : C.paper });
}
// a tangle of path: the reader lost inside the book
function introTangle(x, y, s, { p = 1, a = 1 } = {}) {
  const pts = [];
  for (let i = 0; i <= 90; i++) {
    const u = i / 90, ang = u * Math.PI * 7;
    pts.push([x - 300 * s + u * 520 * s + Math.cos(ang) * 70 * s, y + Math.sin(ang * 1.3) * 90 * s]);
  }
  inkPath(pts, { p, a, w: 3, color: C.dim, dash: [12, 9] });
}
// a hand-drawn thick book standing up: cover + page block on the right
function introBigBook(x, y, w, h, { p = 1, a = 1, title = '괴델, 에셔, 바흐' } = {}) {
  const d = 120;
  inkPath([[x + w, y], [x + w + d, y - 50], [x + w + d, y + h - 50], [x + w, y + h]], { p, a, w: 4, closed: true, fill: C.paper });
  const q = clamp01((p - 0.3) / 0.7);
  for (let i = 1; i < 12; i++) inkLine(x + w + (d * i) / 12, y - (50 * i) / 12 + 6, x + w + (d * i) / 12, y + h - (50 * i) / 12 - 6, { p: q, a, w: 1.6, color: C.dim });
  inkPath([[x, y], [x + d, y - 50], [x + w + d, y - 50], [x + w, y]], { p, a, w: 4, closed: true, fill: C.paper });
  bookCover(x, y, w, h, { title, author: '호프스태터', p, a, size: 62 });
}

SCENES.intro = (t, q) => shots(t, [
  // 0 · a 777-page book
  [q.s(0), (t, lt) => {
    introBigBook(800, 210, 380, 560, { p: dp(lt, 0, 1.2) });
    figure(560, GROUND, { s: 1.05, pose: 'point', face: 'surprised', p: dp(lt, 0.2, 0.9) });
    hand('777쪽', 1500, 330, { size: 92, p: dp(lt, 1.2, 0.8) });
    inkArrow(1440, 380, 1330, 470, { p: dp(lt, 1.6, 0.5), color: KEY(), w: 4 });
  }],
  // 1 · 1979 → 1980 Pulitzer
  [q.s(1), (t, lt) => {
    prop('calendar', 540, 640, 2.5, { p: dp(lt, 0, 0.8), label: '1979', fill: C.paper });
    inkArrow(760, 480, 1060, 480, { p: dp(lt, 0.9, 0.6), color: KEY(), w: 5 });
    hand('이듬해', 910, 420, { size: 52, p: dp(lt, 1.1, 0.5), color: C.dim, weight: 400 });
    prop('trophy', 1320, 700, 2.7, { p: dp(lt, 1.4, 0.8) });
    hand('퓰리처상', 1320, 790, { size: 78, p: dp(lt, 2.0, 0.7) });
    hand('1980', 1320, 360, { size: 70, p: dp(lt, 2.2, 0.5), color: INK() });
  }],
  // 2 · the title: three names
  [q.s(2), (t, lt) => {
    bookCover(760, 150, 400, 520, { title: '', author: '', p: dp(lt, 0, 0.4) });
    [['괴델', 300], ['에셔', 410], ['바흐', 520]].forEach(([n, y], i) => hand(n, 975, y, { size: 96, p: dp(lt, 0.2 + i * 0.35, 0.4) }));
    hand('제목', 1380, 260, { size: 61, p: dp(lt, 0.3, 0.5), color: C.dim, weight: 400 });
    inkArrow(1330, 280, 1180, 330, { p: dp(lt, 0.5, 0.5), color: C.dim, w: 3 });
  }],
  [q.w('수학자', 2), (t, lt) => {
    [['math', '괴델', '수학자'], ['art', '에셔', '화가'], ['music', '바흐', '작곡가']].forEach(([k, n, r], i) => {
      const x = 480 + i * 480, l0 = i * 0.7;
      hand(n, x, 200, { size: 84, p: dp(lt, l0, 0.4) });
      introIcon(k, x, 460, 1.4, { p: dp(lt, l0 + 0.1, 0.8) });
      hand(r, x, 730, { size: 70, p: dp(lt, l0 + 0.5, 0.4), color: INK() });
    });
  }],
  // 3 · famously hard; readers get lost
  [q.s(3), (t, lt) => {
    figure(760, GROUND, { s: 1.15, pose: 'hold', face: 'worried', p: dp(lt, 0, 0.8) });
    prop('openbook', 760, 690, 1.5, { p: dp(lt, 0.4, 0.6), fill: C.paper });
    hand('어렵다!', 1260, 340, { size: 84, p: dp(lt, 1.0, 0.6) });
    for (let i = 0; i < 3; i++) inkLine(1040 + i * 30, 420 - i * 8, 1070 + i * 30, 380 - i * 8, { p: dp(lt, 1.4 + i * 0.1, 0.3), w: 3 });
  }],
  [q.w('펼쳤다가', 3), (t, lt) => {
    introTangle(820, 440, 1.35, { p: dp(lt, 0, 1.8) });
    figure(1380, GROUND, { s: 1.05, pose: 'shrug', face: 'worried', p: dp(lt, 0.4, 0.7) });
    ['?', '?', '?'].forEach((m, i) => hand(m, 1290 + i * 90, 470 - (i % 2) * 40, { size: 80, p: dp(lt, 1.2 + i * 0.25, 0.3), color: C.red }));
    hand('길을 잃다', 700, 700, { size: 71, p: dp(lt, 1.6, 0.6) });
  }],
  // 4 · "수학 책이야? 미술 책이야? 음악 책이야?"
  [q.s(4), (t, lt) => {
    figure(460, GROUND, { s: 1.15, pose: 'think', face: 'worried', p: dp(lt, 0, 0.6) });
    bubble(660, 120, 1140, 440, { kind: 'thought', tail: [520, 500], p: dp(lt, 0.2, 0.5), body: (x, y) => {
      [['math', '수학 책?'], ['art', '미술 책?'], ['music', '음악 책?']].forEach(([k, l], i) => {
        const tk = q.w(['수학', '미술', '음악'][i], 4);
        introIcon(k, x + 230 + i * 340, y + 190, 0.72, { p: dp(t, tk - 0.2, 0.5) });
        hand(l, x + 230 + i * 340, y + 350, { size: 59, p: dp(t, tk, 0.4) });
      });
    } });
  }],
  // 5 · none of the three
  [q.s(5), (t, lt) => {
    [['math', '수학'], ['art', '미술'], ['music', '음악']].forEach(([k, l], i) => {
      const x = 480 + i * 480;
      introIcon(k, x, 420, 1.35, { p: 1 });
      hand(l, x, 680, { size: 70, color: INK() });
      cross(x - 200, 255, 400, 330, { p: dp(lt, 0.3 + i * 0.25, 0.35), lw: 9 });
    });
    hand('셋 다 아니다', 960, 810, { size: 85, p: dp(lt, 1.0, 0.6) });
  }],
  // 6 · the author, twenty years later
  [q.s(6), (t, lt) => {
    figure(700, GROUND, { s: 1.15, pose: 'present', face: 'smile', glasses: true, hair: true, p: dp(lt, 0, 0.8) });
    hand('호프스태터', 700, 400, { size: 71, p: dp(lt, 0.6, 0.6) });
    prop('book', 1130, 800, 2.4, { p: dp(lt, 0.5, 0.6), fill: C.paper });
    hand('1979', 1150, 620, { size: 64, p: dp(lt, 0.8, 0.4), color: INK() });
    inkArrow(1290, 640, 1440, 640, { p: dp(lt, 1.4, 0.5), color: KEY(), w: 4 });
    hand('+20년', 1365, 580, { size: 59, p: dp(lt, 1.6, 0.4) });
    prop('calendar', 1640, 800, 2.1, { p: dp(lt, 1.9, 0.6), label: '1999', fill: C.paper });
  }],
  [q.w('가지', 6), (t, lt) => {
    figure(620, GROUND, { s: 1.15, pose: 'point', face: 'think', glasses: true, hair: true, p: 1 });
    bubble(820, 170, 620, 420, { tail: [700, 540], p: dp(lt, 0, 0.4), body: (x, y, w, h) => {
      hand('?', x + w / 2, y + h / 2 - 20, { size: 260, p: dp(lt, 0.3, 0.5) });
    } });
    hand('질문 딱 하나', 1130, 700, { size: 76, p: dp(lt, 0.9, 0.6) });
  }],
  // 7 · stone and puddle have no '나' — how does a '나' appear?
  [q.s(7), (t, lt) => {
    prop('rock', 560, 720, 1.9, { p: dp(lt, 0, 0.7) });
    hand('돌멩이', 560, 790, { size: 59, p: dp(lt, 0.5, 0.4), color: INK() });
    prop('puddle', 1260, 720, 1.6, { p: dp(lt, 0.5, 0.7) });
    hand('물웅덩이', 1260, 790, { size: 59, p: dp(lt, 0.9, 0.4), color: INK() });
    for (const [x, k] of [[560, 0], [1260, 1]]) {
      hand('나', x, 400, { size: 80, p: dp(lt, 1.4 + k * 0.3, 0.3), color: C.dim });
      cross(x - 55, 345, 110, 110, { p: dp(lt, 1.8 + k * 0.3, 0.4) });
    }
  }],
  [q.w('어떻게', 7), (t, lt) => {
    prop('rock', 380, 700, 1.2, { p: 1 });
    prop('puddle', 380, 800, 1.0, { p: 1 });
    inkArrow(560, 640, 1100, 640, { p: dp(lt, 0.2, 0.7), color: KEY(), w: 5 });
    hand('?', 830, 570, { size: 100, p: dp(lt, 0.6, 0.4), color: C.red });
    figure(1380, GROUND, { s: 1.15, pose: 'cheer', face: 'happy', p: dp(lt, 0.6, 0.8) });
    introMe(1380, 330, { p: dp(lt, 1.2, 0.6), t });
  }],
  // 8 · a brain made of cells, each knowing nothing
  [q.s(8), (t, lt) => {
    prop('brain', 900, 760, 4.0, { p: dp(lt, 0, 1.0) });
    for (let i = 0; i < 16; i++) {
      const ang = i * 2.4, r = 30 + (i * 37) % 220;
      introCell(900 + Math.cos(ang) * r * 1.3, 440 + Math.sin(ang) * r * 0.85, 24, { p: dp(lt, 0.8 + i * 0.06, 0.4) });
    }
    hand('세포', 1460, 380, { size: 78, p: dp(lt, 1.6, 0.5) });
    inkArrow(1400, 410, 1200, 460, { p: dp(lt, 1.8, 0.4), color: KEY(), w: 4 });
  }],
  [q.w('하나하나', 8), (t, lt) => {
    introCell(900, 470, 120, { p: dp(lt, 0, 0.8) });
    drawFace(900, 470, 80, 'neutral', {});
    ['?', '?'].forEach((m, i) => hand(m, 1100 + i * 70, 300 - i * 40, { size: 80, p: dp(lt, 0.8 + i * 0.2, 0.3), color: C.dim }));
    hand('아무것도 모름', 960, 760, { size: 76, p: dp(lt, 1.0, 0.6) });
  }],
  // 9 · fire or not
  [q.s(9), (t, lt) => {
    const blink = Math.sin(t * 7) > 0;
    introCell(620, 420, 105, { p: dp(lt, 0, 0.6), on: blink });
    if (blink) for (let i = 0; i < 6; i++) { const ang = i * 1.05; inkLine(620 + Math.cos(ang) * 230, 420 + Math.sin(ang) * 230, 620 + Math.cos(ang) * 270, 420 + Math.sin(ang) * 270, { w: 4, color: C.yellow, p: dp(lt, 0.5, 0.2) }); }
        hand('보낸다', 620, 760, { size: 73, p: dp(lt, 0.6, 0.5) });
    introCell(1300, 420, 105, { p: dp(lt, 0.8, 0.6) });
    hand('안 보낸다', 1300, 760, { size: 73, p: dp(lt, 1.4, 0.5), color: INK() });
    hand('또는', 960, 440, { size: 70, p: dp(lt, 1.2, 0.4), color: C.dim, weight: 400 });
  }],
  // 10 · somewhere among many cells, a feeling of '나'
  [q.s(10), (t, lt) => {
    const pts = [];
    for (let i = 0; i < 22; i++) pts.push([340 + ((i * 197) % 1240), 200 + ((i * 131) % 540)]);
    pts.forEach(([x, y], i) => { const j = (i * 7) % pts.length; if (i % 2 === 0) inkLine(x, y, pts[j][0], pts[j][1], { p: dp(lt, 0.4 + i * 0.03, 0.5), w: 2, color: C.dim }); });
    pts.forEach(([x, y], i) => introCell(x, y, 26, { p: dp(lt, i * 0.04, 0.4), on: Math.sin(t * 5 + i * 1.7) > 0.6 }));
    hand('세포들', 960, 830, { size: 68, p: dp(lt, 1.2, 0.5) });
  }],
  [q.w('영상', 10), (t, lt) => {
    prop('monitor', 1320, 800, 3.0, { p: dp(lt, 0, 0.6), fill: C.paper });
    prop('note', 1320, 560, 0.8, { p: dp(lt, 0.4, 0.4) });
    figure(700, GROUND, { s: 1.15, pose: 'stand', face: 'smile', look: 1, p: dp(lt, 0.1, 0.6) });
    for (let i = 0; i < 9; i++) inkDot(620 + (i % 3) * 80, 330 - Math.floor(i / 3) * 50 - (lt * 20) % 30, 7, { p: dp(lt, 0.6 + i * 0.05, 0.3), color: C.dim });
    introMe(700, 180, { p: dp(lt, 1.2, 0.6), t });
  }],
  // 11 · meaningless things → meaning → '나'?
  [q.s(11), (t, lt) => {
    for (let i = 0; i < 9; i++) introCell(300 + (i % 3) * 105, 360 + Math.floor(i / 3) * 105, 26, { p: dp(lt, i * 0.04, 0.3) });
    hand('뜻 없는 것들', 405, 720, { size: 59, p: dp(lt, 0.4, 0.5), color: C.dim });
    inkArrow(620, 460, 820, 460, { p: dp(lt, 0.9, 0.5), color: KEY(), w: 5 });
    hand('뜻', 960, 460, { size: 160, p: dp(lt, 1.3, 0.5) });
    inkArrow(1100, 460, 1300, 460, { p: dp(lt, 1.9, 0.5), color: KEY(), w: 5 });
    introMe(1480, 460, { p: dp(lt, 2.3, 0.5), size: 140, t });
    hand('?', 1680, 300, { size: 110, p: dp(lt, 2.8, 0.3), color: C.red });
  }],
  // 12 · thirty minutes, one question
  [q.s(12), (t, lt) => {
    prop('clock', 960, 540, 2.6, { p: dp(lt, 0, 0.6), t: t * 4, fill: C.paper });
    hand('30분', 1300, 250, { size: 83, p: dp(lt, 0.5, 0.5) });
    chapterMap(220, 720, 1480, ['고리', 'MU', '밖', '의미', '전축', '괴델', '구멍', '재귀', '개미', '나', '오늘'], 0, { p: dp(lt, 0.6, 1.4), size: 44 });
    hand('질문 하나', 560, 300, { size: 70, p: dp(lt, 1.6, 0.5), color: C.dim });
  }],
  // 13 · two friends: Achilles and the Tortoise
  [q.s(13), (t, lt) => {
    ach(t, { x: 680, pose: 'wave', face: 'happy', s: 1.15, p: dp(lt, 0, 0.8) });
    tor(t, { x: 1240, pose: 'stand', face: 'smile', p: dp(lt, 0.3, 0.8) });
    hand('두 친구', 960, 250, { size: 83, p: dp(lt, 0.9, 0.5) });
  }],
  [q.w('아킬레스', 13), (t, lt) => {
    const ax = 420 + ((lt * 140) % 260);
    ach(t, { x: ax, pose: 'stand', walk: 1, face: 'happy', s: 1.1 });
    for (let i = 0; i < 3; i++) inkLine(ax - 160 - i * 10, 640 + i * 40, ax - 80 - i * 10, 640 + i * 40, { w: 3, color: C.dim });
    hand('발 빠른 아킬레스', 560, 300, { size: 64, p: dp(lt, 0, 0.6) });
    tor(t, { x: 1340 + lt * 8, walk: 1, t: t * 0.25, face: 'sleepy' });
    hand('느긋한 거북이', 1360, 330, { size: 64, p: dp(t, q.w('느긋한', 13), 0.6) });
  }],
  // 14 · dialogues between the chapters
  [q.s(14), (t, lt) => {
    const items = ['1장', '대화', '2장', '대화', '3장'];
    items.forEach((it, i) => {
      const x = 360 + i * 300, d = it === '대화', pp = dp(lt, i * 0.4, 0.5);
      if (d) bubble(x - 120, 300, 240, 170, { p: pp, text: '대화', size: 60, color: KEY() });
      else { inkRect(x - 100, 260, 200, 260, { p: pp, w: 4, fill: C.paper }); hand(it, x, 390, { size: 64, p: pp, color: INK() }); }
    });
    ach(t, { x: 660, s: 0.65, pose: 'wave', face: 'happy', p: dp(lt, 2.4, 0.6), y: 860 });
    tor(t, { x: 1260, s: 0.65, face: 'smile', p: dp(lt, 2.6, 0.6), y: 860 });
    hand('주인공', 960, 760, { size: 66, p: dp(lt, 3.0, 0.5) });
  }],
  // 15 · Achilles rushes, the Tortoise steps back and asks
  [q.s(15), (t, lt) => {
    ach(t, { x: 560 + Math.sin(t * 6) * 10, pose: 'cheer', walk: 1, face: 'happy', s: 1.1 });
    for (let i = 0; i < 4; i++) prop('paper', 820 + i * 70, 420 - ((lt * 160 + i * 60) % 200), 0.4, { p: dp(lt, 0.2 + i * 0.1, 0.3) });
    hand('빨리빨리!', 560, 280, { size: 71, p: dp(lt, 0.4, 0.5) });
  }],
  [q.w('거북이는', 15), (t, lt) => {
    ach(t, { x: 520, pose: 'cheer', walk: 1, face: 'happy', s: 1.05, a: 0.6 });
    tor(t, { x: 1320 + 60 * dp(lt, 0, 1.2), pose: 'think', face: 'think' });
    bubble(1360, 150, 340, 200, { tail: [1380, 500], text: '왜?', size: 90, p: dp(lt, 0.8, 0.4) });
    inkArrow(1250, 860, 1150, 860, { p: dp(lt, 0.3, 0.5), w: 3, color: C.dim });
    hand('한 걸음 뒤로', 1000, 520, { size: 52, p: dp(lt, 1.2, 0.5), color: C.dim, weight: 400 });
  }],
  // 16 · we walk with them
  [q.s(16), (t, lt) => {
    inkLine(160, GROUND + 4, 1760, GROUND + 4, { p: dp(lt, 0, 0.6), w: 3, color: C.dim });
    const dx = lt * 40;
    ach(t, { x: 560 + dx, walk: 1, s: 1.05, face: 'happy', p: dp(lt, 0, 0.5) });
    figure(900 + dx, GROUND, { walk: 1, t, s: 1.05, face: 'smile', p: dp(lt, 0.2, 0.5) });
    tor(t, { x: 1240 + dx, walk: 1, s: 1.0, face: 'smile', p: dp(lt, 0.4, 0.5) });
    hand('우리', 900 + dx, 500, { size: 64, p: dp(lt, 0.9, 0.4) });
  }],
  // 17 · the key word: '이상한 고리'
  [q.s(17), (t, lt) => {
    prop('key', 960, 560, 2.6, { p: dp(lt, 0, 0.8), color: C.yellow });
    hand('열쇠말 하나', 960, 300, { size: 83, p: dp(lt, 0.6, 0.6) });
  }],
  [q.w('이상한', 17), (t, lt) => teach('이상한 고리', { y: 720, p: dp(lt, 0, 1.0), t })],
  // 18 · up, up — and back where you started
  [q.s(18), (t, lt) => {
    penrose(960, 560, 1.4, { p: dp(lt, 0, 1.0), walker: 0.02 + 0.98 * dp(lt, 0.8, 4.4) });
    hand('위로', 1440, 300, { size: 71, p: dp(lt, 0.6, 0.4) });
    hand('위로', 1560, 420, { size: 71, p: dp(lt, 1.2, 0.4) });
    inkArrow(1380, 340, 1460, 260, { p: dp(lt, 0.6, 0.4), color: KEY(), w: 4 });
  }],
  [q.w('처음', 18), (t, lt) => {
    penrose(960, 560, 1.4, { walker: 1.0 });
    ring(960, 290, 100, 130, { p: dp(lt, 0.2, 0.6) });
    hand('처음 자리', 1290, 220, { size: 76, p: dp(lt, 0.6, 0.5) });
  }],
  // 19 · the loop in music, pictures, maths and your head
  [q.s(19), (t, lt) => {
    const it = [['music', '음악'], ['art', '그림'], ['math', '수학'], ['brain', '머릿속']];
    it.forEach(([k, l], i) => {
      const x = 330 + i * 420, tk = q.w(l === '머릿속' ? '머릿속' : l, 19), pp = dp(t, tk - 0.3, 0.6);
      if (k === 'brain') prop('brain', x, 600, 2.1, { p: pp });
      else introIcon(k, x, 430, 1.05, { p: pp });
      prop('loop', x, 840, 0.9, { p: dp(t, tk, 0.5), color: KEY() });
      hand(l, x, 650, { size: 61, p: dp(t, tk, 0.4), color: INK() });
    });
  }],
  [q.w('그게', 19), (t, lt) => {
    bookCover(760, 170, 400, 540, { title: '괴델, 에셔, 바흐', author: '호프스태터', p: dp(lt, 0, 0.8) });
    inkArc(960, 440, 380, 330, -Math.PI * 0.4, Math.PI * 1.4, { p: dp(lt, 0.6, 1.2), w: 5, color: KEY() });
    inkArrow(960 + Math.cos(Math.PI * 1.4) * 380, 440 + Math.sin(Math.PI * 1.4) * 330, 960 + Math.cos(Math.PI * 1.55) * 380, 440 + Math.sin(Math.PI * 1.55) * 330, { p: dp(lt, 1.8, 0.3), color: KEY(), w: 5 });
  }],
]);

// ---------- loop (1 · 이상한 고리): a canon that climbs, stairs that close, hands that draw each other ----------
function loopIcon(kind, x, y, s = 1, { p = 1, a = 1 } = {}) {
  const w = 300 * s, h = 250 * s;
  inkRect(x - w / 2, y - h / 2, w, h, { p, a, w: 4, fill: C.paper });
  const q = clamp01((p - 0.3) / 0.7);
  if (q <= 0) return;
  if (kind === 'math') ['1+1=2', 'x+0=x', 'a=b ?'].forEach((l, i) => hand(l, x, y - 70 * s + i * 70 * s, { size: 46 * s, p: clamp01(q * 3 - i), a, color: INK() }));
  else if (kind === 'art') prop('stairs', x + 6 * s, y + 90 * s, 1.0 * s, { p: q, a });
  else if (kind === 'music') {
    prop('staff', x, y + 70 * s, 0.62 * s, { p: q, a });
    [[-90, 0], [-40, 20], [10, 40], [60, 60]].forEach(([dx, up], i) => prop('note', x + dx * s, y + (40 - up) * s, 0.42 * s, { p: clamp01(q * 4 - i), a }));
  } else if (kind === 'rps') loopRPS(x, y + 10 * s, 85 * s, { p: q, a, s: 0.42 * s });
}
// the rising canon: six steps on a spiral; each round the whole tune starts one step higher; step 7 sits right
// above step 1 (the same tune an octave up). k = steps reached so far (0..7)
function loopCanon(x, y, s = 1, { p = 1, a = 1, k = 7, octave = 0 } = {}) {
  const R = 330 * s, ry = 0.4, hs = 56 * s;
  const at = (i) => { const th = Math.PI / 2 + (i * Math.PI * 2) / 6; return [x + Math.cos(th) * R, y + Math.sin(th) * R * ry - i * hs]; };
  const path = [];
  for (let u = 0; u <= 6 * 12; u++) { const i = u / 12, th = Math.PI / 2 + (i * Math.PI * 2) / 6; path.push([x + Math.cos(th) * R, y + Math.sin(th) * R * ry - i * hs]); }
  inkPath(path, { p, a, w: 3, color: C.dim, dash: [10, 8] });
  for (let i = 0; i < 7; i++) {
    const q = clamp01(p * 7 - i); if (q <= 0) continue;
    const [sx, sy] = at(i), on = i < k, last = i === 6;
    const col = last ? KEY() : INK();
    inkPath([[sx - 80 * s, sy], [sx + 80 * s, sy], [sx + 80 * s, sy + 30 * s], [sx - 80 * s, sy + 30 * s]], { p: q, a: a * (on ? 1 : 0.45), w: 4, color: col, closed: true, fill: on ? (last ? mix(C.yellow, 0.5) : C.paper) : null });
    if (on) for (let j = 0; j < 3; j++) prop('note', sx - 44 * s + j * 40 * s, sy - 4 * s - j * 12 * s, 0.42 * s, { p: q, a, color: last ? KEY() : INK() });
    hand(String(i < 6 ? i + 1 : 1), sx - 112 * s, sy + 12 * s, { size: 42 * s, a: a * q * (on ? 1 : 0.5), color: last ? KEY() : C.dim });
  }
  if (octave > 0) {
    const [x0, y0] = at(0), [x6, y6] = at(6);
    inkArrow(x0 + 130 * s, y0, x6 + 130 * s, y6 + 30 * s, { p: octave, a, w: 4, color: KEY(), dash: [8, 8], head: 16 });
    hand('한 옥타브 위', x6 + 160 * s, (y0 + y6) / 2, { size: 44 * s, p: octave, a, align: 'left' });
    ring(x6, y6 - 10 * s, 120 * s, 56 * s, { p: octave, a });
  }
  return at;
}
// hand symbols for rock-paper-scissors
function loopHandSym(kind, x, y, s = 1, { p = 1, a = 1 } = {}) {
  const o = { p, a, w: 4, fill: C.paper };
  const finger = (x1, y1, x2, y2, r) => {
    const ang = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(ang) * r, ny = Math.cos(ang) * r;
    const pts = [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny]];
    for (let i = 0; i <= 6; i++) { const t2 = ang + Math.PI / 2 - (i / 6) * Math.PI; pts.push([x2 + Math.cos(t2) * r, y2 + Math.sin(t2) * r]); }
    pts.push([x2 - nx, y2 - ny], [x1 - nx, y1 - ny]);
    inkPath(pts, { ...o, closed: true });
  };
  if (kind === 'paper') {
    [-62, -30, 0, 30].forEach((dx, i) => finger(x + dx * s * 0.9 + 10 * s, y - 20 * s, x + dx * s * 1.2 + 14 * s, y - (100 - Math.abs(dx - 5) * 0.4) * s, 14 * s));
    finger(x + 40 * s, y + 20 * s, x + 96 * s, y - 20 * s, 14 * s);
    inkEllipse(x, y + 20 * s, 56 * s, 52 * s, o);
  } else if (kind === 'scissors') {
    finger(x - 10 * s, y - 20 * s, x - 48 * s, y - 120 * s, 14 * s);
    finger(x + 14 * s, y - 20 * s, x + 54 * s, y - 116 * s, 14 * s);
    inkEllipse(x, y + 20 * s, 54 * s, 48 * s, o);
    inkArc(x - 4 * s, y + 6 * s, 30 * s, 12 * s, Math.PI * 0.1, Math.PI * 0.9, { p, a, w: 3 });
  } else {   // rock: a fist
    inkEllipse(x, y, 64 * s, 54 * s, o);
    for (let i = 0; i < 3; i++) inkArc(x - 30 * s + i * 30 * s, y - 30 * s, 15 * s, 13 * s, Math.PI * 1.05, Math.PI * 1.95, { p, a, w: 3 });
    inkLine(x - 40 * s, y + 10 * s, x + 20 * s, y + 4 * s, { p, a, w: 3 });
  }
}
// scissors → rock → paper → scissors in a circle with arrows (n = arrows drawn so far, 0..3)
function loopRPS(x, y, r, { p = 1, a = 1, s = 1, n = 3, labels = false, hi = -1 } = {}) {
  const kinds = ['scissors', 'rock', 'paper'], names = ['가위', '바위', '보'];
  const pos = (i) => { const th = -Math.PI / 2 + (i * Math.PI * 2) / 3; return [x + Math.cos(th) * r, y + Math.sin(th) * r]; };
  kinds.forEach((k, i) => {
    const [hx, hy] = pos(i);
    loopHandSym(k, hx, hy + 30 * s, s, { p: clamp01(p * 3 - i), a });
    if (labels) hand(names[i], hx, hy + 130 * s, { size: 62 * s, p: clamp01(p * 3 - i), a, color: INK() });
    if (i === hi) ring(hx, hy + 50 * s, 125 * s, 150 * s, { a });   // tall ring: icon AND its label inside
  });
  for (let i = 0; i < 3; i++) {
    const q = clamp01(n - i); if (q <= 0) continue;
    const th0 = -Math.PI / 2 + (i * Math.PI * 2) / 3 + 0.5, th1 = th0 + (Math.PI * 2) / 3 - 1.0, R2 = r * 1.02;
    const mid = (th0 + th1) / 2, Rm = R2 * 1.25;
    inkArrow(x + Math.cos(th0) * R2, y + Math.sin(th0) * R2, x + Math.cos(th1) * R2, y + Math.sin(th1) * R2,
      { via: [x + Math.cos(mid) * Rm, y + Math.sin(mid) * Rm], p: q, a, w: 5, color: KEY(), head: 20 });
  }
}
// a small crown on a figure's head (the king)
function loopCrown(x, y, s = 1, { p = 1, a = 1 } = {}) {
  const hy = y - 292 * s - 40 * s;
  inkPath([[x - 40 * s, hy], [x - 44 * s, hy - 52 * s], [x - 20 * s, hy - 26 * s], [x, hy - 60 * s], [x + 20 * s, hy - 26 * s], [x + 44 * s, hy - 52 * s], [x + 40 * s, hy]], { p, a, w: 4, closed: true, fill: mix(C.yellow, 0.6) });
}

SCENES.loop = (t, q) => shots(t, [
  // 0 · the first question
  [q.s(0), (t, lt) => {
    tor(t, { x: 560, pose: 'think', face: 'think', p: dp(lt, 0, 0.8) });
    bubble(720, 140, 520, 260, { tail: [640, 520], text: '질문 1', size: 80, p: dp(lt, 0.5, 0.4) });
  }],
  [q.w('계속', 0), (t, lt) => {
    prop('stairs', 900, 800, 2.6, { p: dp(lt, 0, 0.8) });
    const u = dp(lt, 0.4, 2.2), fx = lerp(640, 1170, u), fy = lerp(800, 800 - 5 * 36 * 2.6, u);
    figure(fx, fy - 4, { s: 0.42, walk: 1, t, face: 'happy' });
    inkArrow(1260, 300, 560, 760, { via: [1500, 900], p: dp(lt, 2.4, 1.0), w: 5, color: KEY(), dash: [14, 10] });
    hand('제자리?', 1500, 560, { size: 78, p: dp(lt, 3.0, 0.5) });
    hand('위로', 820, 400, { size: 66, p: dp(lt, 0.8, 0.4), color: C.dim, weight: 400 });
  }],
  // 1 · music first
  [q.s(1), (t, lt) => {
    prop('staff', 960, 620, 2.2, { p: dp(lt, 0, 0.7) });
    [[-300, 0], [-150, 30], [0, 60], [150, 90], [300, 120]].forEach(([dx, up], i) => prop('note', 960 + dx, 560 - up, 1.0, { p: dp(lt, 0.4 + i * 0.15, 0.3) }));
    hand('음악', 960, 220, { size: 90, p: dp(lt, 0.5, 0.5) });
  }],
  // 2 · Bach, 1747, a gift for a king
  [q.s(2), (t, lt) => {
    image('bach', 700, 150, 420, 540, { a: dp(lt, 0, 0.6), r: 12 });
    hand('바흐', 1340, 330, { size: 96, p: dp(lt, 0.5, 0.5) });
    hand('1747', 1340, 470, { size: 76, p: dp(lt, 0.9, 0.5), color: INK() });
  }],
  [q.w('왕에게', 2), (t, lt) => {
    figure(720, GROUND, { s: 1.15, pose: 'reach', face: 'smile', hair: true, p: dp(lt, 0, 0.6) });
    prop('paper', 880, 620, 0.8, { p: dp(lt, 0.3, 0.6) });
    prop('note', 880, 560, 0.35, { p: dp(lt, 0.6, 0.3) });
    figure(1260, GROUND, { s: 1.0, pose: 'akimbo', face: 'happy', flip: true, p: dp(lt, 0.2, 0.6) });
    loopCrown(1260, GROUND, 1.0, { p: dp(lt, 0.7, 0.5) });
    hand('왕', 1420, 380, { size: 83, p: dp(lt, 1.0, 0.4) });
    hand('곡 모음', 880, 360, { size: 66, p: dp(lt, 1.2, 0.5) });
  }],
  // 3 · a strange round inside it
  [q.s(3), (t, lt) => {
    prop('paper', 960, 800, 3.0, { p: dp(lt, 0, 0.6), blank: true });
    prop('staff', 960, 500, 0.8, { p: dp(lt, 0.3, 0.5) });
    prop('staff', 960, 640, 0.8, { p: dp(lt, 0.4, 0.5) });
    prop('loop', 960, 780, 0.9, { p: dp(lt, 0.9, 0.6), color: KEY() });
    hand('돌림노래', 1460, 320, { size: 90, p: dp(lt, 1.0, 0.6) });
    hand('이상한', 1460, 220, { size: 59, p: dp(lt, 1.6, 0.5), color: C.red });
  }],
  // 4 · each round, one step higher
  [q.s(4), (t, lt) => {
    const k = 1 + Math.floor(dp(t, q.w('높은', 4), 0.01));
    loopCanon(960, 660, 1.2, { p: dp(lt, 0, 1.4), k });
    hand('한 바퀴 = 한 계단 위', 960, 130, { size: 68, p: dp(t, q.w('계단', 4), 0.7) });
  }],
  // 5 · two rounds, three rounds
  [q.s(5), (t, lt) => {
    const k = 2 + Math.floor(dp(t, q.w('세', 5), 0.01)) + Math.floor(dp(t, q.w('계속', 5) + 0.5, 0.01));
    loopCanon(960, 660, 1.2, { k });
    hand(String(k) + ' 바퀴', 1620, 300, { size: 78 });
  }],
  // 6 · after six, the same tune — an octave up
  [q.s(6), (t, lt) => {
    const k = Math.min(7, 4 + Math.floor(lt / 0.6));
    loopCanon(960, 660, 1.2, { k, octave: dp(t, q.w('똑같은', 6), 0.8) });
    hand('여섯 번', 1620, 300, { size: 73, p: dp(lt, 0.2, 0.5) });
    hand('같은 노래!', 1500, 160, { size: 73, p: dp(t, q.w('똑같은', 6) + 0.3, 0.5) });
  }],
  [q.w('도레미파솔라시도', 6), (t, lt) => {
    prop('staff', 960, 560, 2.0, { p: dp(lt, 0, 0.5) });
    inkLine(560, 520, 650, 520, { p: dp(lt, 0.3, 0.2), w: 2.4 });
    const nm = ['도', '레', '미', '파', '솔', '라', '시', '도'];
    nm.forEach((n, i) => {
      const x = 600 + i * 104, hy = 520 - i * 20;
      prop('note', x + 15, hy + 18, 0.75, { p: dp(lt, 0.2 + i * 0.18, 0.25), color: i === 0 || i === 7 ? KEY() : INK() });
      hand(n, x, 640, { size: 57, p: dp(lt, 0.2 + i * 0.18, 0.25), color: i === 0 || i === 7 ? KEY() : INK() });
    });
    const tk = q.w('같은', 6);
    ring(600, 645, 42, 42, { p: dp(t, tk, 0.4) }); ring(1328, 645, 42, 42, { p: dp(t, tk + 0.2, 0.4) });
    inkArrow(610, 700, 1318, 700, { via: [964, 840], p: dp(t, tk + 0.4, 0.7), w: 4, color: KEY() });
    hand('같은 음, 한 옥타브 위', 960, 200, { size: 71, p: dp(t, q.w('옥타브', 6) - 0.3, 0.6) });
  }],
  // 7 · to the ear it climbs for ever
  [q.s(7), (t, lt) => {
    figure(620, GROUND, { s: 1.15, pose: 'think', face: 'happy', p: dp(lt, 0, 0.6) });
    for (let i = 0; i < 7; i++) {
      const u = ((lt * 0.35 + i / 7) % 1);
      prop('note', 860 + i * 110, 860 - u * 700, 0.85, { a: Math.sin(u * Math.PI), color: i % 2 ? KEY() : INK() });
    }
    inkArrow(1680, 800, 1680, 160, { p: dp(lt, 0.4, 0.8), w: 6, color: KEY() });
    hand('끝없이 위로?', 1380, 120, { size: 71, p: dp(lt, 1.0, 0.6) });
  }],
  // 8 · now a picture: Escher's stairs
  [q.s(8), (t, lt) => {
    figure(560, GROUND, { s: 1.15, pose: 'reach', face: 'think', hat: true, p: dp(lt, 0, 0.6) });
    inkLine(860, 720, 800, GROUND, { p: dp(lt, 0.2, 0.4) }); inkLine(1340, 720, 1400, GROUND, { p: dp(lt, 0.2, 0.4) });
    inkRect(760, 240, 680, 480, { p: dp(lt, 0.2, 0.6), w: 5, fill: C.paper });
    penrose(1100, 500, 0.62, { p: dp(lt, 0.8, 1.6) });
    hand('그림', 1100, 170, { size: 83, p: dp(lt, 0.6, 0.4) });
    hand('에셔', 560, 400, { size: 78, p: dp(lt, 1.4, 0.5) });
  }],
  // 9 · stairs round a square roof; walk round and arrive where you set out
  [q.s(9), (t, lt) => {
    inkRect(660, 560, 600, 300, { p: dp(lt, 0, 0.6), w: 4, fill: mix(C.paper, 0.6) });
    for (let i = 0; i < 4; i++) inkRect(710 + i * 140, 620, 70, 90, { p: dp(lt, 0.4 + i * 0.1, 0.4), w: 3 });
    penrose(960, 470, 0.95, { p: dp(lt, 0.6, 1.4) });
    hand('지붕 위 계단', 1500, 300, { size: 71, p: dp(lt, 1.2, 0.5) });
  }],
  [q.w('사람들이', 9), (t, lt) => {
    const u = dp(lt, 0.2, 2.8);
    penrose(960, 500, 1.3, { walker: u * 0.999 });
    prop('flag', 1090, 350, 0.55, { p: dp(lt, 0, 0.5) });
    hand('출발', 1200, 240, { size: 66, p: dp(lt, 0.2, 0.4), color: INK() });
    if (u >= 1) { ring(960, 270, 90, 110, { p: dp(lt, 3.0, 0.4) }); hand('도착!', 760, 170, { size: 78, p: dp(lt, 3.1, 0.4) }); }
  }],
  // 10 · every step goes up, the whole goes nowhere
  [q.s(10), (t, lt) => {
    prop('stairs', 820, 720, 3.0, { p: dp(lt, 0, 0.7) });
    for (let i = 0; i < 4; i++) inkArrow(580 + i * 144, 690 - i * 108, 580 + i * 144, 610 - i * 108, { p: dp(lt, 0.6 + i * 0.25, 0.3), w: 4, color: C.green, head: 14 });
    hand('한 칸: 위로', 1420, 300, { size: 71, p: dp(lt, 1.2, 0.5), color: C.green });
  }],
  [q.w('전체로는', 10), (t, lt) => {
    penrose(760, 540, 1.05, { walker: (lt * 0.25) % 1 });
    prop('loop', 1480, 680, 1.9, { p: dp(lt, 0.2, 0.6), color: KEY() });
    hand('전체: 제자리', 1460, 330, { size: 73, p: dp(lt, 0.5, 0.5) });
  }],
  // 11 · two hands drawing each other
  [q.s(11), (t, lt) => {
    drawingHands(960, 440, 2.0, { p: dp(lt, 0, 1.4) });
    hand('서로를 그리는 두 손', 960, 180, { size: 71, p: dp(lt, 1.2, 0.7) });
  }],
  [q.w('왼손이', 11), (t, lt) => {
    drawingHands(960, 440, 2.0);
    hand('왼손', 440, 300, { size: 66, p: dp(lt, 0, 0.4), color: INK() });
    hand('오른손', 1480, 300, { size: 66, p: dp(t, q.w('오른손이', 11), 0.4), color: INK() });
    inkArrow(620, 330, 1300, 330, { via: [960, 160], p: dp(lt, 0.4, 0.7), w: 5, color: KEY() });
    inkArrow(1300, 700, 620, 700, { via: [960, 860], p: dp(t, q.w('오른손이', 11) + 0.3, 0.7), w: 5, color: KEY() });
  }],
  // 12 · who drew first? no answer
  [q.s(12), (t, lt) => {
    drawingHands(1180, 470, 1.15);
    ach(t, { x: 380, pose: 'think', face: 'worried', s: 1.05, p: dp(lt, 0, 0.6) });
    bubble(480, 130, 400, 180, { kind: 'thought', tail: [420, 470], text: '누가 먼저?', size: 54, p: dp(lt, 0.4, 0.4) });
    hand('답 없음', 1180, 760, { size: 73, p: dp(t, q.w('답이', 12), 0.5), color: C.red });
  }],
  [q.w('그리는', 12), (t, lt) => {
    hand('그리는 쪽', 600, 480, { size: 83, p: dp(lt, 0, 0.5) });
    hand('그려지는 쪽', 1320, 480, { size: 83, p: dp(lt, 0.4, 0.5) });
    inkArrow(700, 400, 1220, 400, { via: [960, 220], p: dp(lt, 0.8, 0.6), w: 5, color: INK() });
    inkArrow(1220, 560, 700, 560, { via: [960, 740], p: dp(lt, 1.2, 0.6), w: 5, color: INK() });
    hand('뒤엉킴', 960, 800, { size: 66, p: dp(lt, 1.8, 0.5), color: C.red });
  }],
  // 13 · up a level at a time, and back at the start: a strange loop
  [q.s(13), (t, lt) => {
    for (let i = 0; i < 4; i++) {
      const x = 520 + i * 260, y = 720 - i * 140, pp = dp(lt, i * 0.3, 0.4);
      inkRect(x - 100, y - 50, 200, 100, { p: pp, w: 4, fill: C.paper });
      hand(String(i + 1) + '층', x, y, { size: 59, p: pp, color: INK() });
      if (i < 3) inkArrow(x + 100, y - 30, x + 160, y - 100, { p: dp(lt, i * 0.3 + 0.3, 0.3), w: 4, color: KEY(), head: 14 });
    }
    inkArrow(1400, 270, 440, 660, { via: [1700, 900], p: dp(lt, 1.5, 1.2), w: 6, color: C.red });
    hand('어느새 처음으로', 1500, 140, { size: 64, p: dp(t, q.w('처음으로', 13), 0.5) });
  }],
  [q.w('호프스태터는', 13), (t, lt) => teach('이상한 고리', { y: 720, p: dp(lt, 0, 1.0), t, face: 'happy', fig: { glasses: true, hair: true } })],
  // 14 · not a plain circle: it went up, and still came back
  [q.s(14), (t, lt) => {
    inkCircle(960, 470, 200, { p: dp(lt, 0, 1.0), w: 5 });
    const ang = lt * 3; inkDot(960 + Math.cos(ang) * 200, 470 + Math.sin(ang) * 200, 14, { color: KEY() });
    hand('빙글빙글', 960, 470, { size: 71, p: dp(lt, 0.6, 0.5), color: INK() });
    cross(720, 230, 480, 480, { p: dp(lt, 1.6, 0.6), lw: 9 });
  }],
  [q.w('분명히', 14), (t, lt) => {
    prop('stairs', 400, 640, 1.6, { p: dp(lt, 0, 0.6) });
    hand('위로', 400, 700, { size: 57, p: dp(lt, 0.3, 0.4), color: INK() });
    plusSign(700, 520, { p: dp(lt, 0.7, 0.4) });
    prop('loop', 960, 640, 1.4, { p: dp(lt, 1.0, 0.6) });
    hand('돌아옴', 960, 700, { size: 57, p: dp(lt, 1.3, 0.4), color: INK() });
    eqSign(1220, 520, { p: dp(lt, 1.6, 0.4) });
    hand('이상한 고리', 1540, 520, { size: 87, p: dp(lt, 2.0, 0.6) });
    ring(1540, 520, 220, 80, { p: dp(t, q.w('이상한', 14), 0.6) });
  }],
  // 15 · rock-paper-scissors
  [q.s(15), (t, lt) => {
    figure(620, GROUND, { s: 1.1, pose: 'reach', face: 'happy', p: dp(lt, 0, 0.6) });
    figure(1300, GROUND, { s: 1.1, pose: 'reach', face: 'smile', flip: true, p: dp(lt, 0.2, 0.6) });
    loopHandSym('scissors', 820, 600, 0.9, { p: dp(lt, 0.6, 0.5) });
    loopHandSym('rock', 1100, 620, 0.9, { p: dp(lt, 0.8, 0.5) });
    hand('가위바위보', 960, 230, { size: 80, p: dp(lt, 1.0, 0.6) });
  }],
  // 16 · scissors < rock < paper < scissors
  [q.s(16), (t, lt) => {
    const n = dp(lt, 0.3, 0.8) + dp(t, q.w('바위보다', 16), 0.8);
    loopRPS(960, 490, 270, { p: dp(lt, 0, 1.0), s: 1.1, n, labels: true });
    hand('더 센 쪽', 1560, 300, { size: 64, p: dp(lt, 0.8, 0.5) });
  }],
  [q.w('그럼', 16), (t, lt) => {
    const n = 2 + dp(t, q.w('다시', 16), 0.8);
    loopRPS(960, 490, 270, { s: 1.1, n, labels: true, hi: t > q.w('다시', 16) + 0.8 ? 0 : -1 });
    if (t < q.w('다시', 16)) hand('?', 1360, 320, { size: 120, p: dp(lt, 0.3, 0.3), color: C.red });
    hand('다시 가위!', 1560, 300, { size: 68, p: dp(t, q.w('다시', 16) + 0.1, 0.4) });
  }],
  // 17 · always stronger, back at the start
  [q.s(17), (t, lt) => {
    const k = ['scissors', 'rock', 'paper', 'scissors'];
    k.forEach((kk, i) => {
      const x = 420 + i * 340, y = 760 - i * 150;
      inkLine(x - 130, y + 70, x + 130, y + 70, { p: dp(lt, i * 0.25, 0.3), w: 5 });
      loopHandSym(kk, x, y - 20, 1.05, { p: dp(lt, i * 0.25 + 0.1, 0.3) });
      if (i < 3) inkArrow(x + 90, y - 70, x + 220, y - 170, { p: dp(lt, i * 0.25 + 0.2, 0.3), w: 4, color: KEY(), head: 14 });
    });
    ring(420, 730, 110, 100, { p: dp(t, q.w('처음', 17), 0.5) });
    ring(1440, 280, 110, 100, { p: dp(t, q.w('처음', 17) + 0.2, 0.5) });
    hand('같은 자리', 960, 180, { size: 71, p: dp(t, q.w('처음', 17) + 0.4, 0.5) });
  }],
  [q.w('이것도', 17), (t, lt) => {
    loopRPS(680, 500, 240, { s: 0.95, n: 3 });
    eqSign(1060, 480, { p: dp(lt, 0.2, 0.4) });
    prop('loop', 1400, 600, 1.2, { p: dp(lt, 0.4, 0.6), color: KEY() });
    hand('작은 이상한 고리', 1400, 260, { size: 68, p: dp(lt, 0.8, 0.6) });
  }],
  // 18 · Achilles: "was all that climbing an illusion?"
  [q.s(18), (t, lt) => {
    ach(t, { x: 620, pose: 'shrug', face: 'surprised', p: dp(lt, 0, 0.6) });
    tor(t, { x: 1380, pose: 'stand', face: 'neutral', flip: true, p: dp(lt, 0.2, 0.6) });
    bubble(680, 100, 600, 220, { tail: [660, 470], text: '다 착각이었어?', size: 60, p: dp(t, q.w('그럼', 18), 0.4) });
  }],
  // 19 · Tortoise: "no — every step was real; the road itself was round"
  [q.s(19), (t, lt) => {
    ach(t, { x: 520, pose: 'stand', face: 'neutral', s: 1.05 });
    tor(t, { x: 1340, pose: 'present', face: 'smile', flip: true, look: Math.sin(lt * 6) * (lt < 1.6 ? 1 : 0) });
    bubble(780, 100, 520, 300, { tail: [1300, 520], p: dp(t, q.w('아니', 19), 0.4), body: (x, y, w, h) => {
      prop('stairs', x + w / 2, y + 230, 1.0, { p: dp(t, q.w('칸', 19), 0.6) });
      hand('진짜 올라감', x + w / 2, y + 60, { size: 54, p: dp(t, q.w('진짜로', 19), 0.5), color: INK() });
    } });
  }],
  [q.w('다만', 19), (t, lt) => {
    tor(t, { x: 1380, pose: 'present', face: 'happy', flip: true });
    bubble(420, 100, 760, 520, { tail: [1320, 560], p: dp(lt, 0, 0.3), body: (x, y, w, h) => {
      penrose(x + w / 2, y + h / 2 + 30, 0.7, { p: dp(lt, 0.2, 1.2), walker: (lt * 0.25) % 1 });
      hand('길 전체가 둥글게', x + w / 2, y + 70, { size: 61, p: dp(t, q.w('둥글게', 19) - 0.3, 0.6) });
    } });
  }],
  // 20 · up close: stairs; from afar: a loop
  [q.s(20), (t, lt) => {
    prop('stairs', 520, 640, 2.0, { p: dp(lt, 0, 0.6) });
    prop('magnifier', 560, 640, 2.2, { p: dp(lt, 0.4, 0.6) });
    hand('가까이: 계단', 520, 760, { size: 66, p: dp(t, q.w('가까이서', 20), 0.5) });
    inkLine(960, 180, 960, 820, { p: dp(lt, 0.2, 0.5), w: 3, color: C.dim, dash: [10, 10] });
  }],
  [q.w('멀리서', 20), (t, lt) => {
    prop('stairs', 520, 640, 2.0); prop('magnifier', 560, 640, 2.2);
    hand('가까이: 계단', 520, 760, { size: 66, color: C.dim });
    inkLine(960, 180, 960, 820, { w: 3, color: C.dim, dash: [10, 10] });
    penrose(1420, 520, 0.6, { p: dp(lt, 0, 0.8) });
    prop('loop', 1420, 450, 1.8, { p: dp(lt, 0.5, 0.6), color: KEY() });
    hand('멀리: 고리', 1420, 760, { size: 66, p: dp(lt, 0.6, 0.5) });
    ring(1420, 760, 160, 50, { p: dp(lt, 1.2, 0.5) });
  }],
  // 21 · Bach, Escher, rock-paper-scissors: all the same
  [q.s(21), (t, lt) => {
    const it = [['music', '바흐의 노래', '바흐의'], ['art', '에셔의 계단', '에셔의'], ['rps', '가위바위보', '가위바위보도']];
    it.forEach(([k, l, w], i) => {
      const x = 480 + i * 480, tk = q.w(w, 21);
      loopIcon(k, x, 420, 1.3, { p: dp(t, tk - 0.3, 0.6) });
      hand(l, x, 650, { size: 59, p: dp(t, tk, 0.4), color: INK() });
      prop('loop', x, 840, 0.7, { p: dp(t, tk + 0.3, 0.5), color: KEY() });
    });
  }],
  // 22 · third stage: mathematics
  [q.s(22), (t, lt) => {
    [['music', '음악'], ['art', '그림'], ['math', '수학']].forEach(([k, l], i) => {
      const x = 480 + i * 480, last = i === 2;
      loopIcon(k, x, 440, 1.3, { p: dp(lt, i * 0.3, 0.6), a: last ? 1 : 0.55 });
      hand(l, x, 680, { size: 66, p: dp(lt, i * 0.3 + 0.3, 0.4), color: last ? KEY() : INK() });
      if (!last) inkPath([[x + 140, 300], [x + 165, 330], [x + 215, 260]], { p: dp(lt, 0.9 + i * 0.2, 0.3), w: 6, color: C.green });
    });
    hand('세 번째 무대', 1440, 220, { size: 64, p: dp(lt, 1.2, 0.5) });
  }],
  [q.w('가장', 22), (t, lt) => {
    for (const [r, al] of [[300, 0.12], [230, 0.18], [170, 0.24]]) disc(960, 440, r * dp(lt, 0, 0.6), C.yellow, al);
    loopIcon('math', 960, 440, 1.6, { p: 1 });
    hand('가장 놀라운 고리', 960, 760, { size: 78, p: dp(lt, 0.5, 0.6) });
  }],
  // 23 · 1931: young Gödel makes maths talk about itself
  [q.s(23), (t, lt) => {
    figure(560, GROUND, { s: 1.15, pose: 'present', face: 'smile', glasses: true, p: dp(lt, 0, 0.6) });
    hand('괴델', 560, 390, { size: 78, p: dp(lt, 0.5, 0.4) });
    hand('1931', 560, 300, { size: 59, p: dp(lt, 0.8, 0.4), color: INK() });
    loopIcon('math', 1140, 540, 1.45, { p: dp(lt, 0.3, 0.7) });
    bubble(1340, 130, 420, 180, { tail: [1260, 340], text: '나는…', size: 64, p: dp(t, q.w('자기', 23), 0.4) });
  }],
  // 24 · from talking about numbers to talking about itself
  [q.s(24), (t, lt) => {
    loopIcon('math', 560, 470, 1.4, { p: dp(lt, 0, 0.5) });
    hand('수학', 560, 720, { size: 66, p: dp(lt, 0.2, 0.4), color: INK() });
    bubble(940, 200, 620, 240, { tail: [800, 420], p: dp(lt, 0.4, 0.4), body: (x, y, w, h) => {
      ['1', '2', '3', '…'].forEach((n, i) => hand(n, x + 130 + i * 120, y + h / 2, { size: 96, p: dp(lt, 0.4 + i * 0.2, 0.3), color: C.green }));
    } });
    hand('수에 대해서', 1180, 560, { size: 64, p: dp(lt, 1.2, 0.5) });
  }],
  [q.w('어느새', 24), (t, lt) => {
    loopIcon('math', 520, 470, 1.3, { p: 1 });
    prop('mirror', 1340, 820, 3.8, { p: dp(lt, 0, 0.7) });
    loopIcon('math', 1340, 450, 0.8, { p: dp(lt, 0.6, 0.6), a: 0.6 });
    inkArrow(740, 360, 1110, 360, { via: [925, 220], p: dp(lt, 0.8, 0.6), w: 5, color: KEY() });
    inkArrow(1110, 580, 740, 580, { via: [925, 720], p: dp(lt, 1.3, 0.6), w: 5, color: KEY() });
    hand('자기 자신에 대해', 920, 820, { size: 66, p: dp(t, q.w('자기', 24), 0.6) });
  }],
  [q.w('어떻게', 24), (t, lt) => {
    prop('signpost', 900, GROUND, 2.2, { p: dp(lt, 0, 0.7) });
    hand('조금 뒤에', 1090, 470, { size: 54, p: dp(lt, 0.6, 0.5) });
    tor(t, { x: 1380, pose: 'point', face: 'wink', flip: true, p: dp(lt, 0.2, 0.6) });
    ach(t, { x: 480, pose: 'think', face: 'think', s: 1.05, p: dp(lt, 0.3, 0.6) });
  }],
  // 25 · three people, three fields, one shape
  [q.s(25), (t, lt) => {
    [['music', '바흐', '1747'], ['art', '에셔', '1960'], ['math', '괴델', '1931']].forEach(([k, n, y], i) => {
      const x = 480 + i * 480;
      hand(n, x, 190, { size: 76, p: dp(lt, i * 0.4, 0.4) });
      loopIcon(k, x, 430, 1.3, { p: dp(lt, i * 0.4, 0.6) });
      hand(y, x, 660, { size: 54, p: dp(lt, i * 0.4 + 0.4, 0.4), color: INK() });
    });
  }],
  [q.w('같은', 25), (t, lt) => {
    [['music', '바흐'], ['art', '에셔'], ['math', '괴델']].forEach(([k, n], i) => {
      const x = 480 + i * 480;
      hand(n, x, 190, { size: 76 });
      loopIcon(k, x, 430, 1.3);
      prop('loop', x, 790, 0.9, { p: dp(lt, 0.2 + i * 0.25, 0.5), color: KEY() });
    });
    inkLine(560, 700, 1360, 700, { p: dp(lt, 1.0, 0.6), w: 3, color: KEY(), dash: [10, 8] });
    hand('같은 모양', 960, 860, { size: 61, p: dp(lt, 1.2, 0.5) });
  }],
  // 26 · so: 'Gödel, Escher, Bach'
  [q.s(26), (t, lt) => {
    const u = smooth(dp(lt, 0.5, 1.2));
    bookCover(760, 170, 400, 560, { title: '', author: '', p: dp(lt, 0, 0.6) });
    [['괴델', 360, 300], ['에셔', 960, 420], ['바흐', 1560, 540]].forEach(([n, x0, yt], i) => {
      hand(n, lerp(x0, 975, u), lerp(800, yt, u), { size: lerp(64, 92, u) });
    });
    hand(',', 1050, 315, { size: 80, a: dp(lt, 1.7, 0.3) }); hand(',', 1050, 435, { size: 80, a: dp(lt, 1.7, 0.3) });
    hand('호프스태터', 975, 660, { size: 52, a: dp(lt, 1.8, 0.3), color: INK(), weight: 400 });
  }],
  // 27 · but first: a strange game
  [q.s(27), (t, lt) => {
    prop('desk', 960, GROUND, 2.4, { p: dp(lt, 0, 0.5) });
    ach(t, { x: 500, pose: 'point', face: 'happy', s: 1.05, p: dp(lt, 0.1, 0.6) });
    tor(t, { x: 1420, pose: 'think', face: 'think', flip: true, s: 1.05, p: dp(lt, 0.2, 0.6) });
    tiles('MI', 960, 640, { size: 80, p: dp(lt, 0.6, 0.6) });
    hand('?', 1090, 520, { size: 90, p: dp(lt, 1.2, 0.3), color: C.red });
    hand('이상한 게임', 960, 260, { size: 85, p: dp(t, q.w('게임', 27), 0.6) });
  }],
]);

// ---------- miu (2 · 의미 없는 게임): the MU puzzle, a formal system, theorems, a computer that never stops ----------
// a step arrow between two tile strings with the rule number on it
function miuStep(x1, x2, y, n, { p = 1, a = 1 } = {}) {
  inkArrow(x1, y, x2, y, { p, a, w: 4, color: KEY(), head: 16 });
  if (n) hand(n, (x1 + x2) / 2, y - 34, { size: 52, p, a, color: C.dim, weight: 400 });
}
// the four rules as a small handwritten card list (for recaps)
const MIU_RULES = [['1', 'xI', 'xIU'], ['2', 'Mx', 'Mxx'], ['3', 'III', 'U'], ['4', 'UU', '']];
function miuRules(x, y, { p = 1, a = 1, size = 46, gap = 84 } = {}) {
  MIU_RULES.forEach(([n, l, r], i) => ruleCard(x, y + i * gap, n, l, r || '(지움)', { p: clamp01(p * 4 - i), a, size }));
}
// a chess board seen from above: n x n squares, dark squares hatched
function miuBoard(x, y, n, sq, { p = 1, a = 1 } = {}) {
  inkRect(x, y, n * sq, n * sq, { p, a, w: 4, fill: C.paper });
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2) {
    const q = clamp01(p * 2 - 1); if (q <= 0) continue;
    withAlpha(a * q * 0.35, () => { ctx.fillStyle = C.dim; ctx.fillRect(x + i * sq + 2, y + j * sq + 2, sq - 4, sq - 4); });
  }
}

SCENES.miu = (t, q) => shots(t, [
  // 0 · the first chapter starts with a puzzle
  [q.s(0), (t, lt) => {
    prop('openbook', 960, 760, 2.6, { p: dp(lt, 0, 0.7), fill: C.paper });
    prop('puzzle', 960, 420 - 30 * pop(lt, 0.6), 1.5, { p: dp(lt, 0.5, 0.6), fill: mix(C.yellow, 0.5) });
    hand('첫 장 = 퍼즐', 1480, 300, { size: 73, p: dp(lt, 1.2, 0.6) });
  }],
  // 1 · only three letters: M, I, U
  [q.s(1), (t, lt) => {
    ['M', 'I', 'U'].forEach((c, i) => tiles(c, 600 + i * 360, 450, { size: 170, p: dp(lt, 0.2 + i * 0.35, 0.4) }));
    hand('글자는 딱 세 개', 960, 720, { size: 76, p: dp(lt, 1.4, 0.6) });
  }],
  // 2 · the start: MI
  [q.s(2), (t, lt) => {
    prop('flag', 600, 640, 1.6, { p: dp(lt, 0, 0.5) });
    hand('출발', 640, 250, { size: 71, p: dp(lt, 0.3, 0.4), color: INK() });
    tiles('MI', 1080, 520, { size: 180, p: dp(lt, 0.2, 0.6) });
  }],
  // 3 · four rules
  [q.s(3), (t, lt) => {
    for (let i = 0; i < 4; i++) {
      const x = 420 + i * 360, pp = dp(lt, i * 0.25, 0.4);
      inkRect(x - 130, 300, 260, 320, { p: pp, w: 4, fill: C.paper });
      hand(String(i + 1), x, 460, { size: 130, p: pp, color: INK() });
    }
    hand('규칙 네 개', 960, 760, { size: 83, p: dp(lt, 0.9, 0.5) });
  }],
  // 4 · rule 1: xI → xIU;  MI → MIU
  [q.s(4), (t, lt) => {
    hand('규칙 1', 960, 150, { size: 59, p: dp(lt, 0, 0.4), color: C.dim });
    ruleCard(1000, 300, '', 'xI', 'xIU', { p: dp(lt, 0.2, 0.6), size: 90 });
    hand('끝이 I면 → U 붙이기', 960, 470, { size: 59, p: dp(lt, 1.0, 0.6) });
    tiles('MI', 620, 680, { size: 110, p: dp(t, q.w('엠아이는', 4), 0.4) });
    miuStep(780, 1000, 680, '', { p: dp(t, q.w('엠아이는', 4) + 0.4, 0.4) });
    tiles('MIU', 1240, 680, { size: 110, p: dp(t, q.w('엠아이유', 4), 0.5), hi: t > q.w('엠아이유', 4) + 0.5 ? [2] : [] });
  }],
  // 5 · rule 2: Mx → Mxx;  MI → MII
  [q.s(5), (t, lt) => {
    hand('규칙 2', 960, 150, { size: 59, p: dp(lt, 0, 0.4), color: C.dim });
    ruleCard(1000, 300, '', 'Mx', 'Mxx', { p: dp(lt, 0.2, 0.6), size: 90 });
    hand('M 뒤를 한 번 더', 960, 470, { size: 59, p: dp(lt, 1.0, 0.6) });
  }],
  [q.w('엠아이는', 5), (t, lt) => {
    ruleCard(1000, 220, '2', 'Mx', 'Mxx', { size: 70 });
    tiles('MI', 620, 560, { size: 130, p: dp(lt, 0, 0.4) });
    miuStep(800, 1010, 560, '', { p: dp(lt, 0.4, 0.4) });
    tiles('MII', 1260, 560, { size: 130, p: dp(lt, 0.7, 0.5), hi: lt > 1.4 ? [2] : [] });
    hand('통째로 복사', 1260, 760, { size: 61, p: dp(lt, 1.6, 0.5) });
  }],
  // 6 · rule 3: III → U
  [q.s(6), (t, lt) => {
    hand('규칙 3', 960, 150, { size: 59, p: dp(lt, 0, 0.4), color: C.dim });
    ruleCard(1000, 300, '', 'xIIIy', 'xUy', { p: dp(lt, 0.2, 0.6), size: 90 });
    tiles('III', 640, 600, { size: 120, p: dp(t, q.w('세', 6), 0.5), hi: lt > 2.2 ? [0, 1, 2] : [] });
    miuStep(860, 1060, 600, '', { p: dp(t, q.w('바꿀', 6) - 0.4, 0.4) });
    tiles('U', 1220, 600, { size: 120, p: dp(t, q.w('바꿀', 6), 0.4) });
  }],
  // 7 · rule 4: UU → (gone)
  [q.s(7), (t, lt) => {
    hand('규칙 4', 960, 150, { size: 59, p: dp(lt, 0, 0.4), color: C.dim });
    ruleCard(1000, 300, '', 'xUUy', 'xy', { p: dp(lt, 0.2, 0.6), size: 90 });
    tiles('UU', 960, 600, { size: 140, p: dp(lt, 0.8, 0.5) });
    cross(810, 510, 300, 180, { p: dp(t, q.w('지워', 7), 0.5), lw: 9 });
    hand('지워도 OK', 960, 800, { size: 66, p: dp(t, q.w('지워', 7) + 0.3, 0.5) });
  }],
  // 8 · the riddle: can we make MU?
  [q.s(8), (t, lt) => {
    inkRect(500, 120, 920, 480, { p: dp(lt, 0, 0.4), w: 4, fill: C.paper });
    hand('규칙 네 개', 960, 180, { size: 54, p: dp(lt, 0.2, 0.4), color: C.dim });
    miuRules(1010, 270, { p: dp(lt, 0.1, 0.6), size: 66, gap: 92 });
    hand('수수께끼', 960, 720, { size: 83, p: dp(lt, 0.8, 0.5) });
  }],
  [q.w('엠유를', 8), (t, lt) => {
    tiles('MI', 520, 460, { size: 150 });
    inkArrow(700, 460, 1180, 460, { p: dp(lt, 0, 0.6), w: 5, color: KEY(), dash: [14, 10] });
    hand('?', 940, 380, { size: 120, p: dp(lt, 0.4, 0.3), color: C.red });
    tiles('MU', 1400, 460, { size: 150, p: dp(lt, 0.3, 0.5) });
    ring(1400, 460, 200, 130, { p: dp(lt, 0.9, 0.6) });
  }],
  // 9 · Achilles jumps right in
  [q.s(9), (t, lt) => {
    ach(t, { x: 640, pose: 'cheer', face: 'happy', p: dp(lt, 0, 0.6) });
    for (let i = 0; i < 3; i++) inkLine(520 + i * 120, 380 - (i % 2) * 30, 540 + i * 120, 330 - (i % 2) * 30, { p: dp(lt, 0.5 + i * 0.1, 0.3), w: 4, color: C.yellow });
    tiles('MI', 1260, 560, { size: 130, p: dp(lt, 0.3, 0.5) });
    tor(t, { x: 1660, s: 0.85, face: 'smile', flip: true, p: dp(lt, 0.6, 0.6) });
    hand('시작!', 1260, 330, { size: 83, p: dp(lt, 0.9, 0.4) });
  }],
  // 10 · MI → MII → MIIII
  [q.s(10), (t, lt) => {
    const t1 = q.w('엠아이아이', 10), t2 = q.w('네', 10);
    tiles('MI', 340, 460, { size: 100, p: dp(lt, 0, 0.4) });
    miuStep(470, 600, 460, '2', { p: dp(t, t1 - 0.5, 0.4) });
    tiles('MII', 780, 460, { size: 100, p: dp(t, t1, 0.4) });
    miuStep(960, 1090, 460, '2', { p: dp(t, t1 + 1.0, 0.4) });
    tiles('MIIII', 1420, 460, { size: 100, p: dp(t, t2 - 0.6, 0.6) });
    ring(1474, 460, 230, 80, { p: dp(t, t2, 0.5) });
    hand('I 네 개', 1474, 600, { size: 64, p: dp(t, t2 + 0.2, 0.5) });
    ach(t, { x: 300, y: GROUND, s: 0.8, pose: 'point', face: 'happy' });
  }],
  // 11 · III → U gives MUI; one I is left over
  [q.s(11), (t, lt) => {
    const t1 = q.w('엠유아이', 11), t2 = q.w('남았네요', 11) - 0.8;
    tiles('MIIII', 560, 420, { size: 100, p: 1, hi: lt > 0.4 ? [1, 2, 3] : [] });
    miuStep(860, 1060, 420, '3', { p: dp(t, t1 - 0.5, 0.4) });
    tiles('MUI', 1300, 420, { size: 100, p: dp(t, t1, 0.4), hi: t > t2 ? [2] : [] });
    ach(t, { x: 1300, s: 0.8, pose: 'shrug', face: t > t2 ? 'surprised' : 'happy' });
    hand('아!', 1500, 560, { size: 83, p: dp(t, t2, 0.3), color: C.red });
  }],
  // 12 · again: eight I's, swap threes, drop UU
  [q.s(12), (t, lt) => {
    ach(t, { x: 360, s: 0.9, pose: 'carry', face: 'angry' });
    hand('다시!', 360, 420, { size: 71, p: dp(lt, 0.1, 0.4), color: C.red });
    tiles('MIIIIIIII', 1100, 460, { size: 92, p: dp(t, q.w('여덟', 12) - 0.3, 0.8) });
    hand('I 여덟 개', 1150, 620, { size: 64, p: dp(t, q.w('여덟', 12) + 0.4, 0.5) });
  }],
  [q.w('묶어서', 12), (t, lt) => {
    tiles('MIIIIIIII', 960, 220, { size: 80, hi: [] });
    ring(788, 220, 136, 58, { p: dp(lt, 0, 0.4) }); ring(1046, 220, 136, 58, { p: dp(lt, 0.2, 0.4) });
    inkArrow(960, 280, 960, 350, { p: dp(lt, 0.4, 0.3), w: 4, color: KEY(), head: 14 });
    hand('3', 1000, 315, { size: 52, p: dp(lt, 0.4, 0.3), color: C.dim, weight: 400 });
    const tu = q.w('유', 12);   // 'U 두 개를 지우고' — the last words, so draw early enough to finish
    tiles('MUUII', 960, 420, { size: 80, p: dp(lt, 0.6, 0.4), hi: t > tu ? [1, 2] : [] });
    inkArrow(960, 480, 960, 550, { p: dp(t, tu + 0.1, 0.25), w: 4, color: KEY(), head: 14 });
    hand('4', 1000, 515, { size: 52, p: dp(t, tu + 0.1, 0.25), color: C.dim, weight: 400 });
    tiles('MII', 960, 620, { size: 80, p: dp(t, tu + 0.3, 0.3) });
    hand('제자리…', 1300, 720, { size: 66, p: dp(t, tu + 0.6, 0.3), color: C.dim });
  }],
  // 13 · the idea: exactly three I's would do it
  [q.s(13), (t, lt) => {
    ach(t, { x: 760, pose: 'think', face: 'surprised', p: dp(lt, 0, 0.5) });
    prop('bulb', 960, 380, 1.6, { p: dp(lt, 0.4, 0.6) });
    hand('눈치챘다!', 1360, 360, { size: 78, p: dp(lt, 1.0, 0.5) });
  }],
  [q.w('딱', 13), (t, lt) => {
    tiles('MIII', 600, 460, { size: 130, p: dp(lt, 0, 0.5), hi: lt > 0.8 ? [1, 2, 3] : [] });
    miuStep(880, 1100, 460, '3', { p: dp(t, q.w('한', 13) + 0.1, 0.4) });
    tiles('MU', 1320, 460, { size: 130, p: dp(t, q.w('바꿔서', 13), 0.4) });
    ring(1320, 460, 170, 110, { p: dp(t, q.w('엠유가', 13), 0.5), color: C.green });
    hand('I 딱 세 개', 600, 640, { size: 68, p: dp(lt, 0.6, 0.5) });
  }],
  // 14 · "좋아, I 세 개만 만들면 끝이야!"
  [q.s(14), (t, lt) => {
    ach(t, { x: 640, pose: 'cheer', face: 'happy' });
    bubble(760, 120, 640, 240, { tail: [700, 470], text: 'I 세 개면 끝!', size: 70, p: dp(lt, 0.1, 0.4) });
    tiles('III', 1300, 640, { size: 100, p: dp(lt, 0.5, 0.5) });
  }],
  // 15 · the count of I's: 1, 2, 4, 8 … minus three: 5, 2
  [q.s(15), (t, lt) => {
    const ks = [['1', '한'], ['2', '두'], ['4', '네'], ['8', '여덟']];
    ks.forEach(([n, w], i) => {
      const x = 560 + i * 360, tk = i ? q.w(w, 15) : q.s(15);
      hand(n, x, 420, { size: 150, p: dp(t, tk - 0.1, 0.3), color: INK() });
      if (i < 3) { inkArrow(x + 80, 400, x + 300, 400, { via: [x + 190, 320], p: dp(t, q.w(ks[i + 1][1], 15) - 0.3, 0.4), w: 4, color: KEY(), head: 16 });
        hand('×2', x + 190, 300, { size: 52, p: dp(t, q.w(ks[i + 1][1], 15) - 0.2, 0.3), color: C.dim, weight: 400 }); }
    });
    tiles('I', 230, 420, { size: 150, p: dp(lt, 0, 0.4) });
    hand('I의 개수', 1100, 680, { size: 71, p: dp(lt, 0.4, 0.5) });
  }],
  [q.w('빼', 15), (t, lt) => {
    const xs = [520, 960, 1400], ns = ['8', '5', '2'];
    ns.forEach((n, i) => {
      hand(n, xs[i], 440, { size: 150, p: dp(lt, i * 0.6, 0.3), color: INK() });
      if (i < 2) { inkArrow(xs[i] + 80, 420, xs[i + 1] - 80, 420, { via: [(xs[i] + xs[i + 1]) / 2, 330], p: dp(lt, i * 0.6 + 0.2, 0.4), w: 4, color: KEY(), head: 16 });
        hand('−3', (xs[i] + xs[i + 1]) / 2, 310, { size: 54, p: dp(lt, i * 0.6 + 0.3, 0.3), color: C.dim, weight: 400 }); }
    });
    hand('세 개씩 빼기', 960, 680, { size: 68, p: dp(lt, 0.2, 0.5) });
  }],
  // 16 · three never shows up
  [q.s(16), (t, lt) => {
    ['1', '2', '4', '8', '5', '2', '4', '…'].forEach((n, i) => hand(n, 300 + i * 190, 260, { size: 104, p: dp(lt, i * 0.06, 0.2), color: INK() }));
    inkCircle(960, 600, 130, { p: dp(lt, 0.6, 0.6), w: 4, color: C.dim, dash: [14, 10] });
    hand('3', 960, 610, { size: 170, p: dp(lt, 0.8, 0.4), color: C.dim, a: 0.6 });
    cross(860, 500, 200, 200, { p: dp(lt, 1.3, 0.5), lw: 10 });
    hand('한 번도 안 나옴', 1460, 600, { size: 64, p: dp(lt, 1.6, 0.5) });
  }],
  // 17 · "조금만 더 하면 될 것 같은데."
  [q.s(17), (t, lt) => {
    ach(t, { x: 700, pose: 'think', face: 'worried' });
    bubble(860, 140, 600, 260, { kind: 'thought', tail: [780, 470], text: '조금만 더…', size: 70, p: dp(lt, 0.1, 0.4) });
  }],
  // 18 · hours of growing and shrinking strings
  [q.s(18), (t, lt) => {
    prop('desk', 760, GROUND, 2.2, { p: dp(lt, 0, 0.4) });
    figure(560, GROUND, { s: 1.05, sit: true, pose: 'slump', face: 'sleepy', helmet: true, p: dp(lt, 0, 0.5) });
    const n = 2 + Math.floor((Math.sin(lt * 2.2) * 0.5 + 0.5) * 7);
    tiles('M' + 'I'.repeat(n), 1060, 560, { size: 50 });
    prop('clock', 1500, 520, 1.4, { p: dp(lt, 0.3, 0.5), t: t * 40, fill: C.paper });
    hand('몇 시간째', 1500, 640, { size: 68, p: dp(lt, 0.8, 0.5) });
    for (let i = 0; i < 4; i++) prop('paper', 960 + i * 26, GROUND - 176 + i * 4, 0.3, { p: dp(lt, 0.2, 0.3) });
  }],
  // 19 · wait — what is this game?
  [q.s(19), (t, lt) => {
    ach(t, { x: 480, s: 1.0, pose: 'stand', face: 'neutral', a: 0.7 });
    tiles('MIUUI', 480, 360, { size: 60, a: 0.5 });
    tor(t, { x: 1240, pose: 'think', face: 'think', p: dp(lt, 0, 0.6) });
    bubble(1360, 120, 440, 260, { kind: 'thought', tail: [1300, 520], text: '이 게임은 뭘까?', size: 54, p: dp(lt, 0.5, 0.4) });
    hand('진짜 질문', 860, 760, { size: 68, p: dp(t, q.w('진짜', 19), 0.5) });
  }],
  // 20 · letters + rules = a formal system
  [q.s(20), (t, lt) => {
    tiles('MIU', 440, 470, { size: 100, p: dp(lt, 0, 0.5) });
    hand('글자', 440, 600, { size: 59, p: dp(lt, 0.3, 0.4), color: INK() });
    plusSign(730, 470, { p: dp(lt, 0.6, 0.3) });
    inkRect(860, 330, 360, 280, { p: dp(lt, 0.8, 0.4), w: 4, fill: C.paper });
    MIU_RULES.slice(0, 3).forEach(([n, l, r], i) => hand(n + '. ' + l + '→' + r, 1040, 390 + i * 70, { size: 52, p: dp(lt, 1.0 + i * 0.2, 0.3), color: INK() }));
    hand('규칙', 1040, 670, { size: 59, p: dp(lt, 1.0, 0.4), color: INK() });
    eqSign(1340, 470, { p: dp(lt, 1.4, 0.3) });
    hand('게임', 1580, 470, { size: 90, p: dp(lt, 1.6, 0.4) });
  }],
  [q.w('형식', 20), (t, lt) => teach('형식 체계', { y: 720, p: dp(lt, 0, 1.0), t })],
  // 21 · no meaning inside
  [q.s(21), (t, lt) => {
    inkRect(560, 220, 800, 420, { p: dp(lt, 0, 0.5), w: 5, fill: mix(C.paper, 0.6) });
    tiles('MIUII', 960, 430, { size: 110, p: dp(lt, 0.2, 0.5) });
    hand('뜻', 1560, 400, { size: 120, p: dp(t, q.w('뜻이', 21), 0.4) });
    cross(1480, 320, 160, 160, { p: dp(t, q.w('없다는', 21), 0.4), lw: 9 });
    hand('뜻 = 0', 960, 760, { size: 76, p: dp(t, q.w('없다는', 21) + 0.3, 0.5) });
  }],
  // 22 · nobody knows what M or I means — and nobody needs to
  [q.s(22), (t, lt) => {
    tiles('M', 600, 460, { size: 170, p: dp(lt, 0, 0.4) });
    hand('= ?', 820, 460, { size: 110, p: dp(lt, 0.4, 0.4), color: C.red });
    tiles('I', 1200, 460, { size: 170, p: dp(t, q.w('아이가', 22) - 0.2, 0.4) });
    hand('= ?', 1420, 460, { size: 110, p: dp(t, q.w('아이가', 22) + 0.2, 0.4), color: C.red });
  }],
  [q.w('아무도', 22), (t, lt) => {
    ach(t, { x: 640, pose: 'shrug', face: 'neutral', s: 1.1 });
    tor(t, { x: 1280, pose: 'shrug', face: 'smile', flip: true });
    hand('몰라도 돼', 960, 300, { size: 85, p: dp(t, q.w('알', 22), 0.5) });
  }],
  // 23 · chess: wood or bottle caps, the rules are what count
  [q.s(23), (t, lt) => {
    miuBoard(660, 200, 6, 100, { p: dp(lt, 0, 0.8) });
    [[1, 4], [3, 4], [4, 1], [2, 1]].forEach(([i, j], k) => prop('pawn', 660 + i * 100 + 50, 200 + j * 100 + 92, 0.6, { p: dp(lt, 0.6 + k * 0.15, 0.4) }));
    hand('체스', 1500, 300, { size: 80, p: dp(lt, 0.6, 0.5) });
  }],
  [q.w('나무', 23), (t, lt) => {
    prop('pawn', 560, 640, 2.2, { p: dp(lt, 0, 0.5), fill: mix(C.orange, 0.5) });
    hand('나무 조각', 560, 740, { size: 61, p: dp(lt, 0.3, 0.4), color: INK() });
    eqSign(960, 500, { p: dp(t, q.w('병뚜껑', 23), 0.4) });
    prop('cap', 1360, 600, 2.6, { p: dp(t, q.w('병뚜껑', 23), 0.5) });
    hand('병뚜껑', 1360, 740, { size: 61, p: dp(t, q.w('병뚜껑', 23) + 0.3, 0.4), color: INK() });
    hand('상관없다', 960, 260, { size: 76, p: dp(t, q.w('상관없죠', 23), 0.5) });
  }],
  [q.w('규칙대로만', 23), (t, lt) => {
    miuBoard(560, 200, 6, 100, { p: 1 });
    const u = smooth(dp(lt, 0.3, 0.8));
    prop('cap', 560 + 150, 200 + 4 * 100 + 86 - 200 * u, 0.9);
    prop('cap', 560 + 350, 200 + 1 * 100 + 86, 0.9);
    prop('cap', 560 + 450, 200 + 4 * 100 + 86, 0.9);
    inkArrow(560 + 190, 640, 560 + 190, 460, { p: dp(lt, 0, 0.4), w: 4, color: KEY(), head: 14, dash: [10, 8] });
    hand('규칙대로만', 1460, 400, { size: 78, p: dp(lt, 0.4, 0.5) });
  }],
  // 24 · a formal system = a chess-like game of meaningless symbols
  [q.s(24), (t, lt) => {
    tiles('MIU', 520, 480, { size: 110, p: dp(lt, 0, 0.5) });
    eqSign(860, 480, { p: dp(lt, 0.5, 0.4) });
    miuBoard(1040, 330, 3, 100, { p: dp(lt, 0.7, 0.5) });
    prop('cap', 1090, 420, 0.8, { p: dp(lt, 1.0, 0.3) }); prop('pawn', 1290, 620, 0.6, { p: dp(lt, 1.1, 0.3) });
    hand('형식 체계', 520, 300, { size: 73, p: dp(lt, 0.2, 0.5) });
    hand('체스 같은 게임', 1190, 260, { size: 66, p: dp(lt, 1.2, 0.5) });
    hand('뜻 없는 기호', 520, 640, { size: 54, p: dp(t, q.w('기호를', 24), 0.5), color: C.dim });
  }],
  // 25 · every string the rules make is a theorem
  [q.s(25), (t, lt) => {
    const tk = q.w('정리라고', 25);
    tiles('MI', 290, 460, { size: 92, p: dp(lt, 0, 0.3) });
    const rows = [['MIU', 230, '1'], ['MII', 460, '2'], ['MIIII', 690, '2']];
    inkArrow(390, 440, 560, 250, { p: dp(lt, 0.3, 0.3), w: 4, color: KEY(), head: 14 });
    inkArrow(400, 460, 560, 460, { p: dp(lt, 0.5, 0.3), w: 4, color: KEY(), head: 14 });
    tiles('MIU', 720, 230, { size: 92, p: dp(lt, 0.5, 0.4) });
    tiles('MII', 720, 460, { size: 92, p: dp(lt, 0.7, 0.4) });
    inkArrow(860, 470, 1010, 600, { p: dp(lt, 0.9, 0.3), w: 4, color: KEY(), head: 14 });
    tiles('MIIII', 1240, 680, { size: 92, p: dp(lt, 1.1, 0.4) });
    inkArrow(1250, 600, 1400, 470, { p: dp(lt, 1.4, 0.3), w: 4, color: KEY(), head: 14 });
    tiles('MUI', 1580, 400, { size: 92, p: dp(lt, 1.6, 0.4) });
    [[720, 230], [720, 460], [1240, 680], [1580, 400]].forEach(([x, y], i) => hand('정리', x, y + 92, { size: 52, p: dp(t, tk + i * 0.2, 0.3) }));
  }],
  [q.w('엠아이아이도', 25), (t, lt) => {
    tiles('MII', 620, 460, { size: 140, p: 1 });
    tiles('MUI', 1300, 460, { size: 140, p: dp(t, q.w('엠유아이도', 25) - 0.3, 0.4) });
    ring(620, 460, 260, 120, { p: dp(lt, 0.2, 0.5) });
    ring(1300, 460, 260, 120, { p: dp(t, q.w('엠유아이도', 25), 0.5) });
    hand('정리', 620, 660, { size: 83, p: dp(lt, 0.4, 0.4) });
    hand('정리', 1300, 660, { size: 83, p: dp(t, q.w('엠유아이도', 25) + 0.2, 0.4) });
  }],
  // 26 · a computer works exactly like this
  [q.s(26), (t, lt) => {
    prop('laptop', 760, 760, 2.6, { p: dp(lt, 0, 0.6), fill: C.paper });
    tiles('MI' + 'I'.repeat(Math.floor(lt * 2) % 4), 760, 560, { size: 62, p: dp(lt, 0.4, 0.3) });
    hand('뜻', 1320, 330, { size: 90, p: dp(t, q.w('뜻은', 26), 0.4), color: C.dim });
    cross(1250, 260, 140, 140, { p: dp(t, q.w('모르고', 26), 0.4) });
    hand('규칙만', 1420, 560, { size: 80, p: dp(t, q.w('규칙만', 26), 0.5) });
    inkPath([[1300, 640], [1330, 670], [1380, 610]], { p: dp(t, q.w('정확하게', 26), 0.3), w: 6, color: C.green });
  }],
  // 27 · when will Achilles make MU? a computer might try for ever
  [q.s(27), (t, lt) => {
    prop('desk', 760, GROUND, 2.2);
    figure(560, GROUND, { s: 1.05, sit: true, pose: 'slump', face: 'sleepy', helmet: true });
    prop('clock', 760, 560, 0.9, { t: t * 40, fill: C.paper });
    tiles('MU', 1360, 420, { size: 120, p: dp(lt, 0.3, 0.4) });
    hand('언제?', 1360, 580, { size: 83, p: dp(lt, 0.7, 0.4), color: C.red });
  }],
  [q.w('컴퓨터라면', 27), (t, lt) => {
    prop('laptop', 620, 780, 2.4, { fill: C.paper });
    for (let i = 0; i < 5; i++) {
      const u = (lt * 0.4 + i / 5) % 1;
      tiles('M' + 'IU'[i % 2] + 'I'.repeat((i * 3) % 5), lerp(1000, 1700, u), 360 + (i % 3) * 110, { size: 44, a: Math.sin(u * Math.PI) });
    }
    inkArc(620, 560, 300, 200, Math.PI * 1.1, Math.PI * 1.9, { p: dp(lt, 0.3, 0.6), w: 5, color: KEY() });
    hand('영원히…', 1280, 760, { size: 83, p: dp(t, q.w('영원히', 27), 0.5) });
  }],
]);

// ---------- outside: 3장 '체계 밖으로 뛰어나오기' — count the I's instead of making strings ----------
// I's as marbles in a row, grouped by three (grey rings); the leftover is highlighted (yellow + red ring).
// cut = index of a group to cross out (with progress cp). Returns the x of the first and last marble.
function outsideMarbles(n, x, y, { p = 1, a = 1, r = 34, gap = 14, gp = 1, hp = 1, cut = -1, cp = 0 } = {}) {
  const step = 2 * r + gap, gsp = 28, ng = Math.floor(n / 3);
  const xs = []; let cx = 0;
  for (let i = 0; i < n; i++) { if (i > 0 && i % 3 === 0) cx += gsp; xs.push(cx); cx += step; }
  const x0 = x - (cx - gap) / 2 + r;
  for (let i = 0; i < n; i++) {
    const q = clamp01(p * n - i); if (q <= 0) continue;
    const xx = x0 + xs[i];
    if (i >= ng * 3 && hp > 0) disc(xx, y, r + 13, mix(C.yellow, 0.5), a * hp);
    inkCircle(xx, y, r, { p: q, a, w: 3.6, fill: mix(KEY(), 0.7) });
  }
  for (let g = 0; g < ng; g++) {
    const xa = x0 + xs[g * 3], xb = x0 + xs[g * 3 + 2], gq = clamp01(gp * ng - g);
    ring((xa + xb) / 2, y, (xb - xa) / 2 + r + 14, r + 16, { p: gq, a, color: C.dim, lw: 3.4 });
    if (g === cut && cp > 0) cross(xa - r - 10, y - r - 14, xb - xa + 2 * r + 20, 2 * r + 28, { p: cp, a });
  }
  if (n % 3 && hp > 0) { const xa = x0 + xs[ng * 3], xb = x0 + xs[n - 1]; ring((xa + xb) / 2, y, (xb - xa) / 2 + r + 16, r + 18, { p: hp, a, lw: 5 }); }
  return [x0 - r, x0 + xs[Math.max(0, n - 1)] + r];
}
// tally marks: groups of five (four strokes and a slash)
function outsideTally(n, x, y, { p = 1, a = 1, h = 100, gap = 24, color = null } = {}) {
  const groupW = 4 * gap + 34, ng = Math.ceil(n / 5), W0 = ng * groupW - 34, x0 = x - W0 / 2;
  for (let i = 0; i < n; i++) {
    const q = clamp01(p * n - i); if (q <= 0) continue;
    const g = Math.floor(i / 5), k = i % 5, gx = x0 + g * groupW;
    if (k < 4) inkLine(gx + k * gap, y - h / 2, gx + k * gap + 3, y + h / 2, { p: q, a, w: 6, color: color || INK() });
    else inkLine(gx - 14, y + h * 0.3, gx + 3 * gap + 16, y - h * 0.3, { p: q, a, w: 6, color: color || C.red });
  }
  return W0;
}
// a small maze seen from above (walls as lines inside a frame)
function outsideMaze(x, y, w, h, { p = 1, a = 1 } = {}) {
  inkRect(x, y, w, h, { p, a, w: 6, fill: mix(C.paper, 0.4) });
  const cw = w / 6, ch = h / 4;
  const walls = [[1, 0, 1, 2], [2, 1, 4, 1], [3, 1, 3, 3], [5, 0, 5, 2], [0, 3, 2, 3], [4, 2, 6, 2], [4, 3, 4, 4], [1, 2, 2, 2]];
  walls.forEach((wl, i) => inkLine(x + wl[0] * cw, y + wl[1] * ch, x + wl[2] * cw, y + wl[3] * ch, { p: clamp01(p * walls.length - i), a, w: 6 }));
}
// a brick wall
function outsideWall(x, y, w, h, { p = 1, a = 1 } = {}) {
  inkRect(x, y, w, h, { p, a, w: 5, fill: mix(C.grey, 0.45) });
  for (let i = 1; i * 62 < h; i++) {
    inkLine(x, y + i * 62, x + w, y + i * 62, { w: 2.4, color: C.dim, p: clamp01(p * 2 - 1), a });
    inkLine(x + (i % 2 ? w / 2 : w / 4), y + (i - 1) * 62, x + (i % 2 ? w / 2 : w / 4), y + i * 62, { w: 2.4, color: C.dim, p: clamp01(p * 2 - 1), a });
  }
}

SCENES.outside = (t, q) => shots(t, [
  // 0 the Tortoise taps Achilles on the shoulder; strings everywhere
  [q.s(0), (t, lt) => {
    const scraps = [['MIIU', 250, 260, -0.12], ['MIIIIIIIU', 380, 420, 0.05], ['MIUIU', 220, 600, -0.06], ['MUUIIU', 420, 780, 0.1], ['MUIU', 1420, 250, 0.08], ['MIIIIU', 1600, 450, -0.04], ['MUIIU', 1450, 650, 0.07], ['MIUU', 1640, 800, -0.1]];
    scraps.forEach(([s, x, y, r], i) => hand(s, x, y, { size: 58, color: INK(), weight: 400, rot: r, p: dp(lt, 0.1 * i, 0.4) }));
    const tapped = lt > 1.6;
    ach(t, { x: 860, s: 1.15, pose: 'slump', face: tapped ? 'surprised' : 'sleepy' });
    tor(t, { x: 1040, s: 1.05, pose: 'reach', flip: true, face: 'smile', p: dp(lt, 0.3, 0.9) });
    if (lt > 1.2) hand('톡 톡', 960, 440, { size: 54, color: C.dim, weight: 400, p: dp(lt, 1.2, 0.4) });
    if (tapped) hand('!', 780, 400, { size: 110, color: C.red, p: dp(lt, 1.6, 0.2) });
  }],
  // 1 "세어 보면 어때?"
  [q.s(1), (t, lt) => {
    ach(t, { x: 520, s: 1.15, face: 'surprised', look: 1 });
    tor(t, { x: 1320, s: 1.05, pose: 'present', flip: true, face: 'happy' });
    bubble(820, 130, 760, 320, { tail: [1260, 500], p: dp(lt, 0.2, 0.5), body: (bx, by, bw, bh) => {
      hand('세어 보면 어때?', bx + bw / 2, by + 90, { size: 66, color: INK(), p: dp(lt, 0.5, 0.8) });
      outsideTally(4, bx + bw / 2, by + 215, { p: dp(lt, 1.2, 1.2), h: 90 });
    } });
  }],
  // 2a the question: MU?
  [q.s(2), (t, lt) => {
    ach(t, { x: 420, s: 1.15, pose: 'think', face: 'think' });
    tiles('MU', 1080, 400, { size: 180, p: dp(lt, 0.2, 0.6) });
    hand('?', 1440, 400, { size: 280, p: dp(lt, 0.9, 0.3) });
    hand('만들 수 있을까?', 1140, 640, { size: 72, color: INK(), p: dp(lt, 1.4, 0.8) });
  }],
  // 2b ... without trying to the very end? an endless road of strings
  [q.w('끝까지', 2), (t, lt) => {
    const pts = [[180, 840], [520, 780], [820, 670], [1100, 580], [1360, 490], [1580, 420]];
    inkPath(pts, { p: dp(lt, 0, 1.2), w: 5, color: C.dim, dash: [16, 12] });
    ['MI', 'MII', 'MIIII', 'MIIIIIIII', '…'].forEach((s, i) => hand(s, pts[i + 1][0] - 10, pts[i + 1][1] - 60, { size: 66 - i * 6, color: INK(), weight: 400, p: dp(lt, 0.3 + i * 0.3, 0.4) }));
    prop('flag', 1640, 440, 1.1, { p: dp(lt, 1.2, 0.5) });
    hand('MU?', 1700, 165, { size: 64, p: dp(lt, 1.4, 0.4) });
    achilles(190, 840, { s: 0.75, walk: 1, t, face: 'worried', p: dp(lt, 0, 0.5) });
    prop('clock', 1420, 870, 1.1, { p: dp(lt, 1.0, 0.5), t: lt * 3 });
    hand('끝까지?', 880, 280, { size: 90, p: dp(lt, 0.2, 0.5) });
  }],
  // 3 inside the game vs outside it
  [q.s(3), (t, lt) => {
    inkRect(150, 250, 840, 590, { p: dp(lt, 0, 0.7), w: 6, fill: mix(C.paper, 0.35) });
    achilles(360, 810, { s: 0.85, pose: 'hold', face: 'worried', t, p: dp(lt, 0.4, 0.6) });
    tiles('MIIU', 720, 600, { size: 86, p: dp(lt, 0.7, 0.6) });
    hand('게임 안', 300, 310, { size: 56, color: C.dim, p: dp(lt, 1.0, 0.5) });
    tor(t, { x: 1460, s: 1.15, flip: true, face: 'think', look: 1, p: dp(lt, 1.4, 0.6) });
    inkArrow(1350, 460, 1010, 520, { p: dp(lt, 2.2, 0.7), color: C.dim, dash: [12, 10], w: 4 });
    hand('게임 밖에서 보기', 1440, 270, { size: 72, p: dp(lt, 2.8, 0.8) });
  }],
  // 4 count only the I's: MI has one
  [q.s(4), (t, lt) => {
    ach(t, { x: 250, s: 1.15, pose: 'point', face: 'smile' });
    tiles('MI', 780, 430, { size: 170, p: dp(lt, 0.2, 0.5), hi: lt > 1.5 ? [1] : [] });
    inkArrow(1000, 430, 1220, 430, { p: dp(lt, 1.8, 0.5), color: KEY(), w: 6 });
    outsideTally(1, 1360, 430, { p: dp(lt, 2.3, 0.3), h: 170 });
    hand('I 1개', 1360, 640, { size: 80, p: dp(lt, 2.6, 0.5) });
  }],
  // 5a rule: Mx -> Mxx doubles
  [q.s(5), (t, lt) => {
    hand('이어 쓰기', 960, 170, { size: 56, color: C.dim, p: dp(lt, 0, 0.5) });
    ruleCard(1000, 300, '', 'Mx', 'Mxx', { size: 100, p: dp(lt, 0.2, 0.8) });
    tiles('MI', 620, 560, { size: 130, p: dp(lt, 0.8, 0.5) });
    inkArrow(820, 560, 1020, 560, { p: dp(lt, 1.3, 0.4), color: KEY(), w: 6 });
    tiles('MII', 1260, 560, { size: 130, p: dp(lt, 1.6, 0.5) });
    hand('두 배', 960, 770, { size: 86, p: dp(lt, 2.2, 0.6) });
  }],
  // 5b 1 -> 2 -> 4 -> 8 as rows of tiles
  [q.w('한', 5), (t, lt) => {
    const rows = [[1, 0], [2, q.wx('두', 5, 1)], [4, q.wx('네', 5, 0)], [8, q.wx('여덟', 5, 0)]];
    const T0 = q.w('한', 5);
    rows.forEach(([n, at], i) => {
      const y = 200 + i * 175, p = i === 0 ? dp(lt, 0, 0.4) : dp(t, Math.max(T0 + i * 0.5, at - 0.15), 0.4);
      if (p <= 0) return;
      hand(n + '개', 380, y, { size: 70, color: INK(), p });
      tiles('I'.repeat(n), 960, y, { size: 88, p });
      if (i > 0) { inkArrow(1420, y - 145, 1420, y - 35, { via: [1490, y - 90], p, color: KEY(), w: 5, head: 18 }); hand('×2', 1550, y - 90, { size: 60, p }); }
    });
  }],
  // 6 III -> U takes three I's away
  [q.s(6), (t, lt) => {
    tiles('MIIII', 680, 420, { size: 120, p: dp(lt, 0, 0.5) });
    ring(680, 420, 200, 82, { p: dp(lt, 0.8, 0.5) });
    inkArrow(1010, 420, 1180, 420, { p: dp(lt, 1.2, 0.4), color: KEY(), w: 6 });
    tiles('MUI', 1410, 420, { size: 120, p: dp(lt, 1.5, 0.5) });
    hand('−3', 1095, 330, { size: 84, color: C.red, p: dp(lt, 1.4, 0.4) });
    hand('I 4개', 680, 600, { size: 64, color: INK(), p: dp(lt, 1.9, 0.4) });
    hand('I 1개', 1410, 600, { size: 64, color: INK(), p: dp(lt, 2.1, 0.4) });
  }],
  // 7 adding or deleting U leaves the count alone
  [q.s(7), (t, lt) => {
    const row = (l, r, y, at) => {
      tiles(l, 500, y, { size: 104, p: dp(lt, at, 0.5) });
      inkArrow(730, y, 860, y, { p: dp(lt, at + 0.4, 0.3), color: KEY(), w: 5 });
      tiles(r, 1040, y, { size: 104, p: dp(lt, at + 0.6, 0.5) });
      hand('I 1개', 500, y + 100, { size: 48, color: C.dim, p: dp(lt, at + 1, 0.3) });
      hand('I 1개', 1040, y + 100, { size: 48, color: C.dim, p: dp(lt, at + 1.1, 0.3) });
    };
    row('MI', 'MIU', 270, 0);
    row('MUUI', 'MI', 580, 1.2);
    hand('I 개수', 1560, 400, { size: 72, p: dp(lt, 2.8, 0.5) });
    hand('그대로', 1560, 510, { size: 90, color: C.green, p: dp(lt, 3.2, 0.5) });
  }],
  // 8 the named idea
  [q.s(8), (t, lt) => teach('3으로 나눈 나머지', { y: 720, t, p: dp(lt, 0, 1.2) })],
  // 9a one marble: remainder 1
  [q.s(9), (t, lt) => {
    hand('1개', 470, 450, { size: 84, color: INK(), p: dp(lt, 0, 0.4) });
    outsideMarbles(1, 800, 450, { r: 54, p: dp(lt, 0.3, 0.3), hp: dp(lt, 1.3, 0.5) });
    hand('÷ 3', 800, 300, { size: 66, color: C.dim, p: dp(lt, 0.7, 0.4) });
    inkArrow(950, 450, 1150, 450, { p: dp(lt, 1.6, 0.4), color: KEY(), w: 6 });
    hand('나머지 1', 1410, 450, { size: 90, p: dp(lt, 2.0, 0.5) });
  }],
  // 9b doubling: 2 -> remainder 2, 4 -> remainder 1
  [q.w('두', 9), (t, lt) => {
    const T3 = q.w('또', 9);
    [[1, 0], [2, 0.2], [4, Math.max(1.4, T3 - q.w('두', 9))]].forEach(([n, at], i) => {
      const y = 220 + i * 220, p = dp(lt, at, 0.6);
      if (p <= 0) return;
      hand(n + '개', 380, y, { size: 72, color: INK(), p });
      outsideMarbles(n, 830, y, { r: 38, p, gp: dp(lt, at + 0.5, 0.4), hp: dp(lt, at + 0.8, 0.4) });
      hand('나머지 ' + (n % 3), 1430, y, { size: 74, p: dp(lt, at + 1, 0.4) });
    });
  }],
  // 10 the remainder only goes 1, 2, 1, 2 ... never 0
  [q.s(10), (t, lt) => {
    hand('1', 620, 440, { size: 230, color: INK(), p: dp(lt, 0, 0.4) });
    hand('2', 1080, 440, { size: 230, color: INK(), p: dp(lt, 0.2, 0.4) });
    const A = [[690, 310], [850, 180], [1010, 310]], B = [[1010, 580], [850, 710], [690, 580]];
    inkArrow(A[0][0], A[0][1], A[2][0], A[2][1], { via: A[1], p: dp(lt, 0.5, 0.5), color: KEY(), w: 6 });
    inkArrow(B[0][0], B[0][1], B[2][0], B[2][1], { via: B[1], p: dp(lt, 0.9, 0.5), color: KEY(), w: 6 });
    if (lt > 1.4) {
      const u = ((lt - 1.4) * 0.6) % 1, P = u < 0.5 ? A : B, s = u < 0.5 ? u * 2 : (u - 0.5) * 2;
      const bx = (1 - s) ** 2 * P[0][0] + 2 * (1 - s) * s * P[1][0] + s * s * P[2][0], by = (1 - s) ** 2 * P[0][1] + 2 * (1 - s) * s * P[1][1] + s * s * P[2][1];
      disc(bx, by, 18, C.red);
    }
    hand('오갈 뿐', 850, 810, { size: 74, p: dp(lt, 1.6, 0.5) });
    hand('0', 1540, 440, { size: 230, color: C.dim, p: dp(lt, 1.8, 0.4) });
    cross(1440, 320, 200, 250, { p: dp(t, q.w('절대', 10), 0.5), lw: 9 });
  }],
  // 11 taking three away keeps the remainder
  [q.s(11), (t, lt) => {
    const cutAt = Math.max(1.2, q.w('빼도', 11) - q.s(11));
    outsideMarbles(7, 900, 290, { r: 36, p: dp(lt, 0, 0.6), gp: dp(lt, 0.5, 0.4), hp: dp(lt, 0.8, 0.4), cut: 1, cp: dp(lt, cutAt, 0.5) });
    hand('7개', 360, 290, { size: 70, color: INK(), p: dp(lt, 0.2, 0.4) });
    hand('나머지 1', 1440, 290, { size: 66, p: dp(lt, 1.0, 0.4) });
    hand('−3', 940, 460, { size: 76, color: C.red, p: dp(lt, cutAt + 0.3, 0.3) });
    inkArrow(840, 400, 840, 520, { p: dp(lt, cutAt + 0.3, 0.3), color: KEY(), w: 5 });
    outsideMarbles(4, 900, 630, { r: 36, p: dp(lt, cutAt + 0.5, 0.4), gp: dp(lt, cutAt + 0.8, 0.3), hp: dp(lt, cutAt + 1.0, 0.3) });
    hand('4개', 360, 630, { size: 70, color: INK(), p: dp(lt, cutAt + 0.5, 0.4) });
    hand('나머지 1', 1440, 630, { size: 66, p: dp(lt, cutAt + 1.0, 0.3) });
    hand('그대로', 1700, 460, { size: 80, color: C.green, p: dp(lt, cutAt + 1.3, 0.4) });
  }],
  // 12 whatever you do: inside the fence only 1 and 2; 0 stays outside
  [q.s(12), (t, lt) => {
    ach(t, { x: 230, s: 1.1, pose: 'shrug', face: 'worried' });
    inkEllipse(900, 490, 400, 260, { p: dp(lt, 0, 0.8), w: 6, fill: mix(C.paper, 0.35) });
    hand('1', 750, 490, { size: 170, color: INK(), p: dp(lt, 0.5, 0.3) });
    hand('2', 1050, 490, { size: 170, color: INK(), p: dp(lt, 0.7, 0.3) });
    inkArrow(790, 380, 1010, 380, { via: [900, 310], p: dp(lt, 1.0, 0.4), color: KEY(), w: 5, head: 18 });
    inkArrow(1010, 600, 790, 600, { via: [900, 670], p: dp(lt, 1.3, 0.4), color: KEY(), w: 5, head: 18 });
    hand('×2   −3', 900, 290, { size: 50, color: C.dim, p: dp(lt, 1.6, 0.4) });
    hand('무슨 수를 써도', 900, 160, { size: 74, p: dp(lt, 1.9, 0.6) });
    hand('0', 1580, 490, { size: 210, color: C.dim, p: dp(lt, 2.2, 0.3) });
    cross(1480, 370, 200, 240, { p: dp(t, q.w('나머지', 12), 0.5), lw: 9 });
  }],
  // 13a MU has no I at all
  [q.s(13), (t, lt) => {
    tiles('MU', 760, 330, { size: 180, p: dp(lt, 0, 0.5) });
    inkEllipse(760, 650, 250, 105, { p: dp(lt, 0.8, 0.6), w: 5, color: C.dim, dash: [14, 12] });
    hand('I 0개', 760, 650, { size: 84, p: dp(lt, 1.4, 0.5) });
    tor(t, { x: 1420, s: 1.15, pose: 'point', flip: true, face: 'smile', p: dp(lt, 0.3, 0.6) });
  }],
  // 13b 0 divided by 3 leaves 0
  [q.w('나누면', 13), (t, lt) => {
    tiles('MU', 460, 270, { size: 120 });
    inkEllipse(520, 570, 270, 125, { w: 5, color: C.dim, dash: [14, 12] });
    hand('I 0개', 520, 570, { size: 76, color: INK() });
    hand('÷ 3', 920, 470, { size: 66, color: C.dim, p: dp(lt, 0.2, 0.4) });
    inkArrow(830, 570, 1060, 570, { p: dp(lt, 0.4, 0.4), color: KEY(), w: 6 });
    hand('나머지 0', 1400, 570, { size: 104, p: dp(lt, 0.8, 0.5) });
    ring(1400, 570, 240, 95, { p: dp(lt, 1.6, 0.5), lw: 6 });
  }],
  // 14 so MU can never be made: hours, years
  [q.s(14), (t, lt) => {
    tiles('MU', 960, 360, { size: 210, p: dp(lt, 0, 0.4) });
    cross(730, 230, 460, 270, { p: dp(lt, 0.6, 0.5), lw: 11 });
    prop('clock', 500, 870, 1.6, { p: dp(t, q.w('시간', 14), 0.5), t: lt * 30 });
    hand('몇 시간', 500, 570, { size: 66, color: INK(), p: dp(t, q.w('시간', 14) + 0.3, 0.4) });
    prop('calendar', 1420, 870, 1.6, { p: dp(t, q.w('년을', 14), 0.5), label: '…년' });
    hand('몇 년', 1420, 570, { size: 66, color: INK(), p: dp(t, q.w('년을', 14) + 0.3, 0.4) });
  }],
  // 15 once more: MI -> one I -> remainder 1
  [q.s(15), (t, lt) => {
    tor(t, { x: 260, s: 1.1, pose: 'point', face: 'smile' });
    hand('처음', 760, 280, { size: 58, color: C.dim, p: dp(lt, 0.2, 0.4) });
    tiles('MI', 760, 430, { size: 140, p: dp(lt, 0.3, 0.5) });
    inkArrow(930, 430, 1050, 430, { p: dp(lt, 1.0, 0.4), color: KEY(), w: 6 });
    outsideMarbles(1, 1140, 430, { r: 46, p: dp(lt, 1.3, 0.3), hp: dp(lt, 2.2, 0.4) });
    inkArrow(1230, 430, 1350, 430, { p: dp(lt, 2.4, 0.4), color: KEY(), w: 6 });
    hand('나머지 1', 1600, 430, { size: 82, p: dp(lt, 2.8, 0.5) });
  }],
  // 16a only 1 or 2: a closed cycle
  [q.s(16), (t, lt) => {
    const node = (n, x, at) => { inkCircle(x, 470, 115, { p: dp(lt, at, 0.5), w: 6, fill: mix(C.paper, 0.6) }); hand(n, x, 476, { size: 150, color: INK(), p: dp(lt, at + 0.3, 0.3) }); };
    node('1', 740, 0); node('2', 1180, 0.2);
    inkArrow(810, 370, 1110, 370, { via: [960, 220], p: dp(lt, 0.6, 0.5), color: KEY(), w: 6 });
    inkArrow(1110, 570, 810, 570, { via: [960, 720], p: dp(lt, 1.0, 0.5), color: KEY(), w: 6 });
    hand('×2', 960, 240, { size: 62, p: dp(lt, 1.0, 0.3) });
    hand('×2', 960, 700, { size: 62, p: dp(lt, 1.4, 0.3) });
    inkArrow(630, 420, 630, 520, { via: [480, 470], p: dp(lt, 1.6, 0.4), color: KEY(), w: 5, head: 16 });
    inkArrow(1290, 420, 1290, 520, { via: [1440, 470], p: dp(lt, 1.8, 0.4), color: KEY(), w: 5, head: 16 });
    hand('−3', 500, 360, { size: 60, p: dp(lt, 1.9, 0.3) });
    hand('−3', 1420, 360, { size: 60, p: dp(lt, 2.1, 0.3) });
    hand('1 아니면 2', 960, 830, { size: 74, p: dp(lt, 2.4, 0.6) });
  }],
  // 16b MU needs 0: across a gap that cannot be crossed
  [q.w('엠유', 16), (t, lt) => {
    inkPoly([[60, 880], [60, 620], [760, 620], [820, 880]], { p: dp(lt, 0, 0.6), w: 5, fill: mix(C.grey, 0.35) });
    inkPoly([[1100, 880], [1160, 620], [1860, 620], [1860, 880]], { p: dp(lt, 0.2, 0.6), w: 5, fill: mix(C.grey, 0.35) });
    achilles(290, 620, { s: 1.0, face: 'worried', look: 1, t, p: dp(lt, 0.3, 0.6) });
    hand('1 · 2', 590, 460, { size: 110, color: INK(), p: dp(lt, 0.6, 0.4) });
    tiles('MU', 1500, 520, { size: 120, p: dp(lt, 0.9, 0.5) });
    hand('0', 1500, 320, { size: 140, color: INK(), p: dp(lt, 1.3, 0.3) });
    ring(1500, 320, 85, 85, { p: dp(lt, 1.6, 0.4), lw: 6 });
    hand('?', 960, 740, { size: 150, color: C.red, p: dp(lt, 2.0, 0.3) });
  }],
  // 17 hours of strings vs a few numbers
  [q.s(17), (t, lt) => {
    inkLine(960, 160, 960, 870, { w: 3, color: C.dim, dash: [12, 10], p: dp(lt, 0, 0.5) });
    ach(t, { x: 330, s: 1.15, pose: 'slump', face: 'sad' });
    for (let i = 0; i < 9; i++) inkRect(560 + (i % 2) * 10, 830 - i * 46, 270, 44, { p: dp(lt, 0.2 + i * 0.08, 0.3), w: 3.4, fill: C.paper });
    hand('몇 시간', 480, 250, { size: 76, color: INK(), p: dp(lt, 1.0, 0.5) });
    tor(t, { x: 1540, s: 1.15, face: 'cool', pose: 'hold' });
    inkRect(1060, 470, 300, 140, { p: dp(lt, 1.4, 0.4), w: 4, fill: C.paper });
    hand('1, 2, 1, 2', 1210, 544, { size: 54, color: INK(), p: dp(lt, 1.7, 0.5) });
    hand('숫자 몇 개', 1440, 250, { size: 76, p: dp(lt, 2.2, 0.5) });
  }],
  // 18 the Tortoise grins
  [q.s(18), (t, lt) => {
    ach(t, { x: 540, s: 1.15, pose: 'facepalm', face: 'sad' });
    tor(t, { x: 1290, s: 1.1, pose: 'akimbo', flip: true, face: 'happy' });
    bubble(860, 140, 800, 230, { tail: [1250, 500], text: '세어 보는 게 더 빨랐지?', size: 60, p: dp(lt, q.w('글자를', 18) - q.s(18), 0.5) });
  }],
  // 19a inside the game: lost in the maze
  [q.s(19), (t, lt) => {
    outsideMaze(260, 230, 900, 580, { p: dp(lt, 0, 1.0) });
    const u = lt * 0.5;
    figure(710 + Math.cos(u * 2) * 130, 590 + Math.sin(u * 2) * 80, { s: 0.42, walk: 1, t, face: 'worried', p: dp(lt, 0.6, 0.4) });
    hand('게임 안', 710, 170, { size: 64, color: C.dim, p: dp(lt, 0.9, 0.4) });
    hand('답', 1500, 500, { size: 120, color: INK(), p: dp(lt, 1.4, 0.4) });
    cross(1410, 410, 180, 180, { p: dp(lt, 1.8, 0.5), lw: 8 });
  }],
  // 19b one step out: a figure stands above the maze and looks down at it
  [q.w('밖으로', 19), (t, lt) => {
    outsideMaze(100, 440, 720, 430, {});
    figure(470, 690, { s: 0.33, face: 'worried', t });
    inkRect(1060, 600, 600, 280, { p: dp(lt, 0, 0.4), w: 5, fill: mix(C.grey, 0.4) });
    inkArrow(500, 590, 1140, 570, { via: [840, 300], p: dp(lt, 0.2, 0.7), color: KEY(), w: 5, dash: [14, 10] });
    figure(1340, 600, { s: 1.0, pose: 'point', flip: true, face: 'happy', look: -1, t, p: dp(lt, 0.4, 0.6) });
    prop('bulb', 1530, 400, 1.0, { p: dp(lt, 1.0, 0.4) });
    hand('한 걸음 밖', 560, 250, { size: 76, p: dp(lt, 0.5, 0.5) });
  }],
  // 20 the named idea
  [q.s(20), (t, lt) => teach('체계 밖으로 뛰어나오기', { y: 720, t, p: dp(lt, 0, 1.2) })],
  // 21a the machine works on inside the rules, without end
  [q.s(21), (t, lt) => {
    inkRect(130, 220, 1100, 630, { p: dp(lt, 0, 0.6), w: 5, color: C.dim, dash: [16, 12] });
    hand('규칙 안', 270, 280, { size: 58, color: C.dim, p: dp(lt, 0.4, 0.4) });
    inkRect(280, 400, 440, 320, { p: dp(lt, 0.3, 0.6), w: 6, fill: mix(C.grey, 0.35) });
    for (const [gx, gy, gs, dir] of [[410, 680, 0.95, 1], [600, 620, 0.75, -1]]) {
      ctx.save(); ctx.translate(gx, gy - 80 * gs); ctx.rotate(lt * 1.6 * dir); ctx.translate(-gx, -(gy - 80 * gs));
      prop('gear', gx, gy, gs, { p: dp(lt, 0.6, 0.6) }); ctx.restore();
    }
    inkLine(720, 690, 1200, 690, { p: dp(lt, 0.8, 0.5), w: 6 });
    for (let i = 0; i < 4; i++) {
      const u = ((lt * 0.25 + i / 4) % 1);
      hand(['MIU', 'MIIU', 'MUIU', 'MIIIU'][i], 760 + u * 400, 645, { size: 46, color: INK(), weight: 400, a: dp(lt, 1.0, 0.4) * Math.min(1, (1 - u) * 5) });
    }
    hand('끝없이', 960, 450, { size: 90, p: dp(lt, 1.6, 0.6) });
    prop('loop', 1560, 720, 2.0, { p: dp(lt, 2.0, 0.6) });
  }],
  // 21b a person gets bored, steps out and notices
  [q.w('사람은', 21), (t, lt) => {
    inkRect(100, 220, 820, 630, { w: 5, color: C.dim, dash: [16, 12], a: 0.6 });
    inkRect(220, 420, 380, 280, { w: 6, fill: mix(C.grey, 0.35), a: 0.6 });
    const walkOut = dp(lt, 0, 1.6);
    figure(lerp(720, 1200, walkOut), GROUND, { s: 1.15, pose: walkOut < 1 ? 'stand' : 'think', face: walkOut < 1 ? 'sleepy' : 'surprised', walk: walkOut < 1 ? 1 : 0, t, look: -1 });
    bubble(1080, 130, 700, 240, { kind: 'thought', tail: [1200, 460], text: '이거 안 되는구나!', size: 62, p: dp(lt, 1.8, 0.5) });
  }],
  // 22 a fly hitting a window, again and again
  [q.s(22), (t, lt) => {
    prop('window', 960, 840, 3.1, { p: dp(lt, 0, 0.6) });
    const k = Math.abs(Math.sin(lt * 3.2)), fs = 2.4 + k * 2.2;
    const fx = 960 + Math.sin(lt * 1.3) * 80, fy = 540 + Math.cos(lt * 1.7) * 40;
    prop('fly', fx, fy, fs, { p: dp(lt, 0.4, 0.3) });
    if (k > 0.85 && lt > 0.6) for (let i = 0; i < 6; i++) { const ang = i * Math.PI / 3;
      inkLine(fx + Math.cos(ang) * 70, fy + Math.sin(ang) * 70, fx + Math.cos(ang) * 100, fy + Math.sin(ang) * 100, { w: 4, color: C.red }); }
    hand('탁! 탁!', 1520, 330, { size: 76, color: C.dim, p: dp(lt, 0.8, 0.5) });
  }],
  // 23a the open door right next to it
  [q.s(23), (t, lt) => {
    inkLine(140, 850, 1780, 850, { w: 5, p: dp(lt, 0, 0.4) });
    prop('window', 600, 800, 2.7, {});
    const k = Math.abs(Math.sin(lt * 3.2));
    prop('fly', 600 + Math.sin(lt * 1.3) * 50, 540, 2.2 + k * 1.6, {});
    prop('opendoor', 1260, 850, 3.5, { p: dp(lt, 0.3, 0.7) });
    hand('열린 문', 1260, 190, { size: 76, p: dp(lt, 1.2, 0.5) });
    hand('못 봐요', 600, 190, { size: 70, color: C.red, p: dp(lt, 2.0, 0.5) });
  }],
  // 23b seen from outside, the way out is obvious
  [q.w('밖에서', 23), (t, lt) => {
    inkRect(140, 210, 1140, 640, { w: 5, fill: mix(C.paper, 0.3) });
    prop('window', 460, 740, 1.9, {});
    prop('opendoor', 960, 850, 2.8, {});
    prop('fly', 460, 560, 1.8, {});
    inkArrow(490, 540, 920, 620, { via: [720, 380], p: dp(lt, 0.8, 0.8), color: C.green, w: 5, dash: [14, 10] });
    tor(t, { x: 1580, s: 1.15, flip: true, face: 'happy', look: 1, p: dp(lt, 0, 0.5) });
    hand('한 번에', 720, 300, { size: 72, color: C.green, p: dp(lt, 1.5, 0.5) });
  }],
  // 24a at work: banging into the same wall
  [q.s(24), (t, lt) => {
    outsideWall(1160, 190, 150, 690, { p: dp(lt, 0, 0.5) });
    const bump = Math.abs(Math.sin(lt * 2.4));
    figure(980 + bump * 40, GROUND, { s: 1.15, tie: true, pose: 'reach', face: 'angry', t });
    if (bump > 0.9) hand('쾅', 1100, 370, { size: 84, color: C.red });
    hand('같은 방법', 560, 300, { size: 80, p: dp(lt, 0.8, 0.5) });
  }],
  // 24b step back
  [q.w('물러서', 24), (t, lt) => {
    outsideWall(1160, 190, 150, 690, {});
    const back = dp(lt, 0, 1.4);
    figure(lerp(1000, 560, back), GROUND, { s: 1.15, tie: true, walk: back < 1 ? 1 : 0, face: back < 1 ? 'worried' : 'think', pose: back < 1 ? 'stand' : 'think', t, look: 1 });
    inkArrow(940, 330, 650, 330, { p: dp(lt, 0.4, 0.6), color: KEY(), w: 6 });
    hand('한 걸음 뒤로', 795, 240, { size: 70, p: dp(lt, 0.8, 0.5) });
    prop('bulb', 720, 470, 0.9, { p: dp(lt, 1.8, 0.4) });
  }],
  // 24c count what the rules change and what they leave alone
  [q.w('규칙이', 24), (t, lt) => {
    figure(290, GROUND, { s: 1.15, tie: true, pose: 'point', face: 'smile', t });
    inkRect(560, 190, 1120, 640, { p: dp(lt, 0, 0.5), w: 5, fill: C.paper });
    inkLine(1120, 230, 1120, 790, { p: dp(lt, 0.3, 0.4), w: 3.4, color: C.dim });
    hand('바뀌는 것', 840, 290, { size: 70, p: dp(lt, 0.5, 0.5) });
    hand('그대로인 것', 1400, 290, { size: 70, color: C.green, p: dp(lt, 0.9, 0.5) });
    outsideTally(7, 840, 530, { p: dp(lt, 1.4, 1.5), h: 130 });
    outsideTally(3, 1400, 530, { p: dp(lt, 2.0, 1.0), h: 130, color: C.green });
    ring(1400, 530, 170, 120, { p: dp(lt, 3.2, 0.6), lw: 6 });
  }],
  // 25 the book's first tool
  [q.s(25), (t, lt) => {
    ach(t, { x: 520, s: 1.15, pose: 'reach', face: 'happy' });
    tor(t, { x: 1260, s: 1.1, pose: 'reach', flip: true, face: 'smile' });
    inkRect(680, 560, 460, 160, { p: dp(lt, 0.2, 0.4), w: 5, fill: C.paper });
    outsideTally(4, 770, 640, { p: dp(lt, 0.5, 0.6), h: 90, gap: 18 });
    hand('세어 보기', 975, 640, { size: 62, color: INK(), p: dp(lt, 0.8, 0.5) });
    hand('첫 번째 도구', 910, 300, { size: 84, p: dp(lt, 1.2, 0.6) });
  }],
  // 26a a strange question
  [q.s(26), (t, lt) => {
    ach(t, { x: 620, s: 1.15, pose: 'think', face: 'think' });
    hand('?', 1220, 470, { size: 440, p: dp(lt, 0.4, 0.5) });
    hand('이상한 질문', 1220, 810, { size: 70, color: INK(), p: dp(lt, 1.0, 0.5) });
  }],
  // 26b meaningless letters talking about something?
  [q.w('아무', 26), (t, lt) => {
    tiles('MIU', 580, 600, { size: 160, p: dp(lt, 0, 0.5) });
    hand('뜻 없는 글자', 580, 790, { size: 64, color: C.dim, p: dp(lt, 0.5, 0.5) });
    bubble(820, 130, 720, 320, { tail: [680, 500], p: dp(lt, 1.2, 0.5), body: (bx, by, bw, bh) => {
      prop('globe', bx + bw / 2 - 110, by + 290, 1.35, { p: dp(lt, 1.5, 0.5) });
      hand('?', bx + bw / 2 + 140, by + bh / 2, { size: 170, p: dp(lt, 1.9, 0.3) });
    } });
    hand('말을 한다?', 1580, 640, { size: 74, p: dp(lt, 2.4, 0.5) });
  }],
]);

// ---------- meaning: 4장 '같은 모양' — the pq-system and isomorphism ----------
// x centres of the five parts of pqString(a1, b1, c1, x, y, {s}): [bars a, p, bars b, q, bars c]
function meaningPos(a1, b1, c1, x, s = 1) {
  const bw = 34 * s, parts = [a1, 'p', b1, 'q', c1];
  let w = 0; parts.forEach((pt) => { w += typeof pt === 'number' ? pt * bw + 16 * s : 64 * s; });
  let cx = x - w / 2; const out = [];
  parts.forEach((pt) => { if (typeof pt === 'number') { out.push(cx + (pt * bw) / 2); cx += pt * bw + 16 * s; } else { out.push(cx + 32 * s); cx += 64 * s; } });
  return out;
}
// an equation written under a pq-string, one symbol under each part (signs: '+', '=', '−')
function meaningEq(xs, y, syms, { p = 1, a = 1, size = 80, color = null } = {}) {
  syms.forEach((sy, i) => {
    const q = clamp01(p * 5 - i); if (q <= 0) return;
    if (sy === '+') plusSign(xs[i], y, { p: q, a, s: size / 90 });
    else if (sy === '=') eqSign(xs[i], y, { p: q, a, s: size / 90 });
    else if (sy === '−') inkLine(xs[i] - 30 * size / 90, y, xs[i] + 30 * size / 90, y, { p: q, a, w: 7 * size / 90, color: KEY() });
    else hand(sy, xs[i], y + 4, { size, p: q, a, color: color || INK() });
  });
}
// a green tick
function meaningCheck(x, y, { p = 1, a = 1, s = 1.3 } = {}) {
  inkPath([[x - 26 * s, y], [x - 6 * s, y + 22 * s], [x + 30 * s, y - 28 * s]], { p, a, w: 6 * s, color: C.green });
}
// an irregular six-cornered shape and its corners (for "same form")
const meaningShape = (x, y, s) => [[-150, 100], [-150, -20], [-60, -120], [40, -60], [150, -110], [130, 90]].map(([dx, dy]) => [x + dx * s, y + dy * s]);
// a puzzle piece: tab = sticks out to the right; otherwise a notch on its left side that the tab fits into
function meaningPiece(x, y, s, { p = 1, a = 1, tab = true, fill = null } = {}) {
  const P = tab
    ? [[-60, 0], [-60, -120], [60, -120], [60, -74], [92, -74], [92, -46], [60, -46], [60, 0]]
    : [[-60, 0], [-60, -46], [-28, -46], [-28, -74], [-60, -74], [-60, -120], [60, -120], [60, 0]];
  inkPath(P.map(([dx, dy]) => [x + dx * s, y + dy * s]), { p, a, closed: true, w: 5, fill: fill || mix(C.yellow, 0.35) });
}
// a sentence card: a paper strip (a pq-string or words go on it)
function meaningCard(x, y, w, h, { p = 1, a = 1 } = {}) { inkRect(x - w / 2, y - h / 2, w, h, { p, a, w: 5, fill: C.paper }); }

SCENES.meaning = (t, q) => shots(t, [
  // 0 a new game: a stick and two letters
  [q.s(0), (t, lt) => {
    tor(t, { x: 330, s: 1.15, pose: 'present', face: 'happy' });
    [['bar', 820], ['p', 1120], ['q', 1420]].forEach(([k, x], i) => {
      const at = k === 'bar' ? 0.4 : Math.max(0.8 + i * 0.3, q.w(k === 'p' ? '피와' : '큐만', 0) - q.s(0));
      inkRect(x - 110, 340, 220, 220, { p: dp(lt, at, 0.4), w: 5, fill: C.paper });
      if (k === 'bar') inkLine(x - 55, 450, x + 55, 450, { p: dp(lt, at + 0.3, 0.3), w: 12 });
      else hand(k, x, 442, { size: 160, p: dp(lt, at + 0.3, 0.3) });
    });
    hand('막대기', 820, 630, { size: 58, color: C.dim, p: dp(lt, 0.9, 0.4) });
    hand('새 게임', 1120, 210, { size: 84, p: dp(lt, 1.4, 0.5) });
  }],
  // 1 follow the rules and strings come out
  [q.s(1), (t, lt) => {
    inkRect(180, 270, 440, 380, { p: dp(lt, 0, 0.5), w: 6, fill: mix(C.grey, 0.3) });
    ctx.save(); ctx.translate(400, 510); ctx.rotate(lt * 1.5); ctx.translate(-400, -510);
    prop('gear', 400, 610, 1.15, { p: dp(lt, 0.2, 0.5) }); ctx.restore();
    hand('규칙', 400, 330, { size: 64, p: dp(lt, 0.4, 0.4) });
    inkArrow(650, 460, 850, 460, { p: dp(lt, 0.7, 0.4), color: KEY(), w: 6 });
    pqString(2, 3, 5, 1340, 470, { s: 1.55, p: dp(lt, 1.0, 1.4) });
  }],
  // 2 two bars, p, three bars, q, five bars
  [q.s(2), (t, lt) => {
    pqString(2, 3, 5, 960, 440, { s: 2.0, labels: true, p: dp(lt, 0.1, 2.6) });
  }],
  // 3 one, p, one, q, two: that works too
  [q.s(3), (t, lt) => {
    pqString(2, 3, 5, 960, 210, { s: 1.1, labels: true, a: 0.55 });
    pqString(1, 1, 2, 960, 520, { s: 2.0, labels: true, p: dp(lt, 0.1, 2.8) });
    const ok = q.w('이것도', 3);
    ring(960, 545, 400, 150, { color: C.green, p: dp(t, ok, 0.6), lw: 6 });
    meaningCheck(1460, 480, { p: dp(t, ok + 0.4, 0.4), s: 1.8 });
  }],
  // 4a two, p, two, q, five ...
  [q.s(4), (t, lt) => {
    pqString(2, 2, 5, 1000, 420, { s: 2.0, labels: true, p: dp(lt, 0.2, 3.4) });
    ach(t, { x: 230, s: 1.15, face: 'think', pose: 'think', p: dp(lt, 0.2, 0.6) });
  }],
  // 4b ... never comes out
  [q.w('아무리', 4), (t, lt) => {
    pqString(2, 2, 5, 1000, 420, { s: 2.0, labels: true });
    cross(500, 290, 1000, 300, { p: dp(lt, 0, 0.6), lw: 10 });
    ach(t, { x: 230, s: 1.15, face: 'worried', pose: 'shrug' });
    hand('안 나와요', 1000, 730, { size: 84, color: C.red, p: dp(lt, 0.6, 0.5) });
  }],
  // 5a see something?
  [q.s(5), (t, lt) => {
    [[2, 3, 5, 230, true], [1, 1, 2, 450, true], [2, 2, 5, 670, false]].forEach(([a1, b1, c1, y, ok], i) => {
      pqString(a1, b1, c1, 740, y, { s: 1.3, p: dp(lt, i * 0.4, 0.8) });
      if (ok) meaningCheck(1180, y, { p: dp(lt, 1.4 + i * 0.2, 0.4) });
      else cross(1140, y - 40, 80, 80, { p: dp(lt, 1.8, 0.4), lw: 8 });
    });
    tor(t, { x: 1560, s: 1.15, pose: 'think', face: 'think', flip: true });
    hand('?', 1690, 380, { size: 150, p: dp(lt, 1.2, 0.3) });
  }],
  // 5b symbols without meaning: when do they get one?
  [q.w('엠', 5), (t, lt) => {
    ach(t, { x: 320, s: 1.15, pose: 'think', face: 'think' });
    tiles('MIU', 1030, 620, { size: 130, p: dp(lt, 0, 0.5) });
    hand('p', 1370, 615, { size: 150, p: dp(lt, 0.4, 0.3) });
    hand('q', 1530, 615, { size: 150, p: dp(lt, 0.6, 0.3) });
    hand('뜻 없는 기호', 1220, 790, { size: 60, color: C.dim, p: dp(lt, 0.8, 0.5) });
    bubble(600, 130, 700, 260, { kind: 'thought', tail: [400, 470], text: '언제 뜻이 생길까?', size: 64, p: dp(t, q.w('언제', 5), 0.5) });
  }],
  // 6a read p as 'plus' and q as 'equals'
  [q.s(6), (t, lt) => {
    const xs = meaningPos(2, 3, 5, 960, 2.0);
    pqString(2, 3, 5, 960, 360, { s: 2.0 });
    inkArrow(xs[1], 450, xs[1], 540, { p: dp(lt, 0.3, 0.4), color: C.dim, w: 4, head: 16 });
    hand('더하기', xs[1], 620, { size: 78, p: dp(lt, 0.6, 0.5) });
    const tq = Math.max(1.4, q.w('큐는', 6) - q.s(6));
    inkArrow(xs[3], 450, xs[3], 540, { p: dp(lt, tq, 0.4), color: C.dim, w: 4, head: 16 });
    hand('같다', xs[3], 620, { size: 78, p: dp(lt, tq + 0.3, 0.5) });
  }],
  // 6b two plus three equals five
  [q.w('막대', 6), (t, lt) => {
    const xs = meaningPos(2, 3, 5, 960, 1.8);
    pqString(2, 3, 5, 960, 300, { s: 1.8 });
    hand('더하기', xs[1], 180, { size: 48, color: C.dim });
    hand('같다', xs[3], 180, { size: 48, color: C.dim });
    meaningEq(xs, 530, ['2', '+', '3', '=', '5'], { p: dp(lt, 0.2, 3.0), size: 130 });
  }],
  // 7 2+3=5, 1+1=2, but 2+2 is not 5
  [q.s(7), (t, lt) => {
    const rows = [[2, 3, 5, 0], [1, 1, 2, Math.max(1.2, q.w('일', 7) - q.s(7))], [2, 2, 5, Math.max(2.4, q.w('그리고', 7) - q.s(7))]];
    rows.forEach(([a1, b1, c1, at], i) => {
      const y = 240 + i * 220;
      pqString(a1, b1, c1, 600, y, { s: 1.1, p: dp(lt, at, 0.6) });
      hand(`${a1} + ${b1} = ${c1}`, 1270, y, { size: 96, color: INK(), p: dp(lt, at + 0.4, 0.6) });
      if (i < 2) meaningCheck(1620, y, { p: dp(lt, at + 1.0, 0.4) });
      else cross(1060, y - 60, 420, 120, { p: dp(lt, at + 1.4, 0.5), lw: 8 });
    });
  }],
  // 8 strings and sums pair up one by one
  [q.s(8), (t, lt) => {
    hand('게임', 560, 200, { size: 76, p: dp(lt, 0, 0.4) });
    hand('덧셈', 1400, 200, { size: 76, p: dp(lt, 0.2, 0.4) });
    [[2, 3, 5], [1, 1, 2], [3, 1, 4]].forEach(([a1, b1, c1], i) => {
      const y = 360 + i * 190, at = 0.4 + i * 0.6;
      pqString(a1, b1, c1, 560, y, { s: 1.1, p: dp(lt, at, 0.5) });
      hand(`${a1}+${b1}=${c1}`, 1400, y, { size: 84, color: INK(), p: dp(lt, at + 0.2, 0.5) });
      inkLine(890, y, 1210, y, { p: dp(lt, at + 0.6, 0.5), w: 4, color: KEY(), dash: [12, 10] });
      inkDot(890, y, 9, { p: dp(lt, at + 0.6, 0.2), color: KEY() }); inkDot(1210, y, 9, { p: dp(lt, at + 1.0, 0.2), color: KEY() });
    });
    hand('짝', 1050, 200, { size: 84, color: KEY(), p: dp(lt, 2.4, 0.4) });
  }],
  // 9a two shapes match corner by corner
  [q.s(9), (t, lt) => {
    const L = meaningShape(520, 520, 1.7), R = meaningShape(1400, 520, 1.7);
    inkPath(L, { closed: true, p: dp(lt, 0, 0.8), w: 6, fill: mix(C.paper, 0.6) });
    inkPath(R, { closed: true, p: dp(lt, 0.4, 0.8), w: 6, color: KEY(), fill: mix(KEY(), 0.12) });
    L.forEach((pt, i) => {
      const at = 1.2 + i * 0.3;
      inkLine(pt[0], pt[1], R[i][0], R[i][1], { p: dp(lt, at, 0.4), w: 3, color: C.dim, dash: [10, 10] });
      inkDot(pt[0], pt[1], 10, { p: dp(lt, at, 0.2) }); inkDot(R[i][0], R[i][1], 10, { p: dp(lt, at + 0.3, 0.2), color: KEY() });
    });
    hand('하나하나 들어맞다', 960, 190, { size: 72, p: dp(lt, 3.0, 0.6) });
  }],
  // 9b the named idea: isomorphism (same form)
  [q.w('동형', 9), (t, lt) => {
    figure(260, 870, { s: 1.1, pose: 'present', face: 'smile', t });
    board(430, 140, 1000, 480, { p: dp(lt, 0, 0.6) });
    hand('동형', 930, 235, { size: 116, p: dp(lt, 0.4, 0.5) });
    const L = meaningShape(720, 480, 0.9), R = meaningShape(1140, 480, 0.9);
    inkPath(L, { closed: true, p: dp(lt, 0.8, 0.5), w: 5 });
    inkPath(R, { closed: true, p: dp(lt, 1.0, 0.5), w: 5, color: KEY() });
    L.forEach((pt, i) => inkLine(pt[0], pt[1], R[i][0], R[i][1], { p: dp(lt, 1.4 + i * 0.1, 0.3), w: 2.6, color: C.dim, dash: [8, 8] }));
    hand('같은 꼴', 1650, 380, { size: 80, color: INK(), p: dp(t, q.w('같은', 9), 0.5) });
  }],
  // 10 Hofstadter's key claim
  [q.s(10), (t, lt) => {
    bookCover(230, 180, 450, 620, { title: '괴델, 에셔, 바흐', author: '호프스태터', p: dp(lt, 0, 0.6), size: 64 });
    figure(1000, 870, { s: 1.15, pose: 'present', face: 'happy', hair: true, glasses: true, t, p: dp(lt, 0.3, 0.6) });
    prop('key', 1520, 680, 2.2, { p: dp(lt, 0.9, 0.4), color: C.yellow });
    hand('핵심 주장', 1480, 360, { size: 84, p: dp(lt, 1.2, 0.5) });
  }],
  // 11a meaning is not hidden inside the symbol
  [q.s(11), (t, lt) => {
    inkRect(460, 280, 340, 340, { p: dp(lt, 0, 0.4), w: 6, fill: C.paper });
    hand('p', 630, 440, { size: 270, p: dp(lt, 0.2, 0.3) });
    prop('magnifier', 1040, 720, 2.7, { p: dp(lt, 0.6, 0.5) });
    hand('뜻?', 986, 450, { size: 80, color: C.dim, p: dp(lt, 1.2, 0.4) });
    cross(900, 380, 170, 150, { p: dp(t, q.w('아니라', 11), 0.4), lw: 8 });
    hand('기호 안', 630, 710, { size: 64, color: C.dim, p: dp(lt, 1.0, 0.4) });
  }],
  // 11b it appears when matching partners meet: piece + piece = meaning
  [q.w('모양이', 11), (t, lt) => {
    meaningPiece(360, 680, 2.4, { p: dp(lt, 0, 0.5) });
    plusSign(660, 540, { p: dp(lt, 0.5, 0.3), s: 1.3 });
    meaningPiece(940, 680, 2.4, { p: dp(lt, 0.7, 0.5), tab: false, fill: mix(KEY(), 0.2) });
    eqSign(1210, 540, { p: dp(lt, 1.2, 0.3), s: 1.3 });
    prop('bulb', 1430, 720, 1.9, { p: dp(lt, 1.5, 0.4) });
    hand('뜻', 1700, 540, { size: 140, p: dp(lt, 1.9, 0.4) });
  }],
  // 12 a map: the lines are just ink
  [q.s(12), (t, lt) => {
    prop('map', 860, 840, 3.5, { p: dp(lt, 0, 0.9) });
    const T = q.w('잉크', 12);
    inkArrow(1460, 360, 1150, 470, { p: dp(t, T - 0.4, 0.5), color: KEY(), w: 5 });
    hand('그냥 잉크', 1580, 300, { size: 84, p: dp(t, T - 0.1, 0.5) });
  }],
  // 13a the bends of the line match the bends of the road
  [q.s(13), (t, lt) => {
    prop('map', 960, 480, 1.9, { p: dp(lt, 0, 0.5) });
    const M = [[-90, -40], [-50, -90], [10, -60], [80, -120]].map(([dx, dy]) => [960 + dx * 1.9, 480 + dy * 1.9]);
    const R = [[470, 850], [700, 735], [1040, 800], [1440, 670]];
    inkPath(R, { p: dp(lt, 0.5, 0.8), w: 56, color: mix(C.grey, 0.7), jit: 0.6 });
    inkPath(R, { p: dp(lt, 0.9, 0.8), w: 4, color: C.paper, dash: [18, 16], jit: 0.6 });
    M.forEach((m, i) => inkLine(m[0], m[1], R[i][0], R[i][1], { p: dp(lt, 1.6 + i * 0.3, 0.4), w: 3, color: KEY(), dash: [10, 10] }));
    hand('지도', 1330, 300, { size: 66, color: INK(), p: dp(lt, 0.6, 0.4) });
    hand('실제 길', 1640, 760, { size: 66, color: INK(), p: dp(lt, 1.2, 0.4) });
  }],
  // 13b so we can read the map
  [q.w('우리는', 13), (t, lt) => {
    const R = [[300, 850], [640, 720], [1100, 800], [1640, 640]];
    inkPath(R, { w: 60, color: mix(C.grey, 0.7), jit: 0.6 });
    inkPath(R, { w: 4, color: C.paper, dash: [18, 16], jit: 0.6 });
    const u = dp(lt, 0, 3.5), k = Math.min(2, Math.floor(u * 3)), f = u * 3 - k;
    const fx = lerp(R[k][0], R[k + 1][0], f), fy = lerp(R[k][1], R[k + 1][1], f);
    figure(fx, fy, { s: 1.0, walk: 1, t, face: 'happy', pose: 'hold' });
    prop('map', fx, fy - 172, 0.5, {});
    hand('지도를 읽다', 960, 240, { size: 86, p: dp(lt, 0.6, 0.6) });
  }],
  // 14a sheet music: dots and lines on paper
  [q.s(14), (t, lt) => {
    prop('staff', 960, 560, 3.0, { p: dp(lt, 0, 0.6) });
    [[560, 440], [760, 380], [960, 320], [1160, 410], [1360, 350]].forEach(([hx, hy], i) => prop('note', hx + 30, hy + 36, 1.5, { p: dp(lt, 0.6 + i * 0.25, 0.3) }));
    hand('점과 선', 960, 690, { size: 84, p: dp(lt, 2.0, 0.5) });
  }],
  // 14b ... match pitch and length: they become music
  [q.w('소리의', 14), (t, lt) => {
    prop('staff', 500, 600, 1.9, {});
    [[260, 505], [380, 467], [500, 429], [620, 486], [740, 448]].forEach(([hx, hy]) => prop('note', hx + 18, hy + 22, 0.9, {}));
    inkArrow(900, 470, 1080, 470, { p: dp(lt, 0.2, 0.4), color: KEY(), w: 6 });
    figure(1520, 870, { s: 1.15, face: 'happy', t, p: dp(lt, 0.4, 0.5) });
    for (let i = 0; i < 3; i++) inkArc(1380, 560, 60 + i * 44, 84 + i * 56, Math.PI * 0.75, Math.PI * 1.25, { p: dp(lt, 0.9 + i * 0.2, 0.3), w: 5, color: KEY() });
    for (let i = 0; i < 3; i++) { const u = (lt * 0.4 + i / 3) % 1; prop('note', 1180 + i * 80, 560 - u * 260, 0.6, { a: dp(lt, 1.0, 0.4) * (1 - u) }); }
    hand('높낮이 · 길이', 500, 250, { size: 68, color: INK(), p: dp(lt, 0.5, 0.5) });
    hand('음악', 1520, 250, { size: 90, p: dp(t, q.w('음악이', 14), 0.5) });
  }],
  // 15 Bach's score wakes up again after centuries
  [q.s(15), (t, lt) => {
    prop('paper', 420, 850, 3.0, { p: dp(lt, 0, 0.5), blank: true, fill: C.paper });
    for (const yy of [360, 580]) { for (let i = 0; i < 5; i++) inkLine(230, yy + i * 22, 610, yy + i * 22, { w: 2.4, color: C.dim, p: dp(lt, 0.3, 0.4) }); }
    [[290, 384], [370, 362], [450, 406], [530, 340], [310, 604], [410, 626], [520, 582]].forEach(([hx, hy], i) => inkEllipse(hx, hy, 14, 10, { p: dp(lt, 0.5 + i * 0.08, 0.2), fill: INK(), w: 2 }));
    hand('바흐의 악보', 420, 190, { size: 66, p: dp(lt, 0.6, 0.4) });
    inkArrow(700, 540, 1200, 540, { p: dp(lt, 1.0, 0.6), color: KEY(), w: 6 });
    hand('몇백 년', 950, 460, { size: 76, p: dp(lt, 1.3, 0.5) });
    figure(1480, 870, { s: 1.15, face: 'happy', pose: 'cheer', t, p: dp(lt, 1.6, 0.5) });
    for (let i = 0; i < 4; i++) { const u = (lt * 0.35 + i / 4) % 1; prop('note', 1300 + i * 110, 560 - u * 300, 0.75, { a: dp(lt, 2.0, 0.4) * (1 - u) }); }
  }],
  // 16 a symbol with no partner is a scribble
  [q.s(16), (t, lt) => {
    inkRect(140, 250, 680, 560, { p: dp(lt, 0, 0.4), w: 5, fill: C.paper });
    const pts = []; for (let i = 0; i < 46; i++) pts.push([480 + Math.sin(i * 1.73) * 250 + Math.sin(i * 0.41) * 50, 530 + Math.cos(i * 2.31) * 190 + Math.sin(i * 0.9) * 26]);
    inkPath(pts, { p: dp(lt, 0.3, 1.4), w: 5, jit: 2.5 });
    inkRect(900, 330, 360, 360, { p: dp(lt, 1.4, 0.5), w: 5, color: C.dim, dash: [14, 12] });
    hand('?', 1080, 510, { size: 160, color: C.dim, p: dp(lt, 1.8, 0.3) });
    hand('짝 없음', 1080, 770, { size: 62, color: C.dim, p: dp(lt, 2.0, 0.4) });
    ach(t, { x: 1600, s: 1.15, pose: 'think', face: 'worried' });
    hand('낙서', 480, 180, { size: 96, p: dp(t, q.w('낙서', 16), 0.5) });
  }],
  // 17 no meaning at first; a matching partner gives one
  [q.s(17), (t, lt) => {
    inkRect(200, 330, 280, 280, { p: dp(lt, 0, 0.4), w: 5, fill: C.paper, a: 0.6 });
    hand('p', 340, 462, { size: 210, color: C.dim, p: dp(lt, 0.2, 0.3) });
    hand('뜻 없음', 340, 700, { size: 62, color: C.dim, p: dp(lt, 0.6, 0.4) });
    const T = Math.max(1.4, q.w('들어맞는', 17) - q.s(17));
    inkArrow(540, 470, 740, 470, { p: dp(lt, T, 0.4), color: KEY(), w: 6 });
    inkRect(800, 330, 280, 280, { p: dp(lt, T + 0.3, 0.4), w: 5, fill: C.paper });
    hand('p', 940, 462, { size: 210, p: dp(lt, T + 0.4, 0.3) });
    inkLine(1110, 470, 1290, 470, { p: dp(lt, T + 0.8, 0.4), w: 4, color: KEY(), dash: [12, 10] });
    hand('더하기', 1490, 470, { size: 90, p: dp(lt, T + 1.1, 0.5) });
    prop('bulb', 1490, 380, 1.1, { p: dp(lt, T + 1.6, 0.4) });
    hand('뜻!', 940, 710, { size: 96, p: dp(lt, T + 1.9, 0.4) });
  }],
  // 18a one more surprise
  [q.s(18), (t, lt) => {
    ach(t, { x: 700, s: 1.2, face: 'surprised', pose: 'cheer' });
    hand('!', 900, 380, { size: 230, color: C.red, p: dp(lt, 0.3, 0.3) });
    tor(t, { x: 1320, s: 1.15, pose: 'present', flip: true, face: 'smile' });
  }],
  // 18b one string, two readings at once
  [q.w('같은', 18), (t, lt) => {
    meaningCard(960, 270, 720, 170, { p: dp(lt, 0, 0.4) });
    pqString(2, 3, 5, 960, 270, { s: 1.2, p: dp(lt, 0.2, 0.8) });
    inkArrow(800, 370, 560, 580, { p: dp(lt, 1.0, 0.5), color: KEY(), w: 6 });
    inkArrow(1120, 370, 1360, 580, { p: dp(lt, 1.2, 0.5), color: KEY(), w: 6 });
    inkRect(300, 600, 460, 230, { p: dp(lt, 1.5, 0.4), w: 5, color: C.dim, dash: [14, 12] });
    inkRect(1160, 600, 460, 230, { p: dp(lt, 1.7, 0.4), w: 5, color: C.dim, dash: [14, 12] });
    hand('읽기 1', 530, 715, { size: 74, color: INK(), p: dp(lt, 1.9, 0.4) });
    hand('읽기 2', 1390, 715, { size: 74, color: INK(), p: dp(lt, 2.1, 0.4) });
    hand('동시에', 960, 560, { size: 80, p: dp(t, q.w('동시에', 18), 0.5) });
  }],
  // 19 the same string again
  [q.s(19), (t, lt) => {
    tor(t, { x: 250, s: 1.15, pose: 'point', face: 'smile' });
    hand('아까 그 줄', 1080, 200, { size: 66, color: C.dim, p: dp(lt, 0.2, 0.5) });
    pqString(2, 3, 5, 1090, 440, { s: 2.0, labels: true, p: dp(lt, 0.8, 3.2) });
  }],
  // 20 read as addition: 2 + 3 = 5
  [q.s(20), (t, lt) => {
    const xs = meaningPos(2, 3, 5, 1060, 1.8);
    pqString(2, 3, 5, 1060, 290, { s: 1.8 });
    meaningEq(xs, 530, ['2', '+', '3', '=', '5'], { p: dp(lt, 0.3, 2.0), size: 130 });
    hand('덧셈', 290, 530, { size: 86, p: dp(lt, 0, 0.4) });
  }],
  // 21a read backwards: 5 - 3 = 2
  [q.s(21), (t, lt) => {
    const xs = meaningPos(2, 3, 5, 1060, 1.8);
    meaningEq(xs, 200, ['2', '+', '3', '=', '5'], { size: 80, a: 0.45 });
    pqString(2, 3, 5, 1060, 390, { s: 1.8 });
    // reading right to left: 5 (c) − (q) 3 (b) = (p) 2 (a)
    const rx = [xs[4], xs[3], xs[2], xs[1], xs[0]];
    meaningEq(rx, 610, ['5', '−', '3', '=', '2'], { p: dp(lt, 0.4, 2.2), size: 130, color: C.green });
    inkArrow(xs[4] + 40, 730, xs[0] - 40, 730, { via: [(xs[0] + xs[4]) / 2, 830], p: dp(lt, 0.3, 0.8), color: C.green, w: 5 });
    hand('거꾸로', 280, 610, { size: 80, color: C.green, p: dp(lt, 0, 0.4) });
  }],
  // 21b every other string too
  [q.w('들어맞죠', 21), (t, lt) => {
    hand('더하기', 1080, 200, { size: 66, p: dp(lt, 0, 0.3) });
    hand('빼기', 1500, 200, { size: 66, color: C.green, p: dp(lt, 0.1, 0.3) });
    [[1, 1, 2], [3, 1, 4], [2, 2, 4]].forEach(([a1, b1, c1], i) => {
      const y = 350 + i * 190, at = 0.2 + i * 0.35;
      pqString(a1, b1, c1, 520, y, { s: 1.05, p: dp(lt, at, 0.3) });
      hand(`${a1}+${b1}=${c1}`, 1080, y, { size: 78, color: INK(), p: dp(lt, at + 0.15, 0.3) });
      hand(`${c1}−${b1}=${a1}`, 1500, y, { size: 78, color: INK(), p: dp(lt, at + 0.3, 0.3) });
      meaningCheck(1750, y, { p: dp(lt, at + 0.5, 0.25), s: 1.1 });
    });
  }],
  // 22a one string, two right readings
  [q.s(22), (t, lt) => {
    meaningCard(480, 470, 600, 180, { p: dp(lt, 0, 0.4) });
    pqString(2, 3, 5, 480, 470, { s: 1.05 });
    hand('줄 하나', 480, 630, { size: 70, color: INK(), p: dp(lt, 0.3, 0.4) });
    inkArrow(800, 430, 1100, 300, { p: dp(lt, 0.6, 0.5), color: KEY(), w: 6 });
    inkArrow(800, 510, 1100, 640, { p: dp(lt, 0.9, 0.5), color: C.green, w: 6 });
    hand('2 + 3 = 5', 1420, 290, { size: 96, color: INK(), p: dp(lt, 1.1, 0.5) });
    hand('5 − 3 = 2', 1420, 650, { size: 96, color: INK(), p: dp(lt, 1.4, 0.5) });
    hand('읽기 둘', 1420, 470, { size: 74, p: dp(lt, 2.0, 0.5) });
  }],
  // 22b the game unchanged, one more meaning
  [q.w('게임은', 22), (t, lt) => {
    prop('box', 540, 800, 2.7, { p: dp(lt, 0, 0.5), fill: C.paper });
    hand('게임', 540, 640, { size: 80, color: INK(), p: dp(lt, 0.3, 0.4) });
    hand('그대로', 560, 260, { size: 76, color: C.green, p: dp(lt, 0.6, 0.4) });
    const T = q.w('뜻이', 22);
    plusSign(1000, 560, { p: dp(t, T, 0.3), s: 1.3 });
    prop('bulb', 1340, 780, 1.9, { p: dp(t, T + 0.3, 0.4) });
    hand('뜻 +1', 1340, 290, { size: 88, p: dp(t, T + 0.6, 0.4) });
  }],
  // 23a a string with meaning may be called a sentence
  [q.s(23), (t, lt) => {
    meaningCard(700, 450, 860, 240, { p: dp(lt, 0, 0.4) });
    pqString(2, 3, 5, 700, 450, { s: 1.5 });
    eqSign(1260, 450, { p: dp(lt, 0.6, 0.3), s: 1.3 });
    hand('문장', 1520, 450, { size: 130, p: dp(lt, 0.9, 0.5) });
  }],
  // 23b two meanings: the surface one and the hidden one
  [q.w('겉뜻', 23), (t, lt) => {
    meaningCard(560, 330, 680, 190, {});
    pqString(2, 3, 5, 560, 330, { s: 1.2 });
    const wv = []; for (let i = 0; i <= 60; i++) wv.push([100 + i * 29, 520 + Math.sin(i * 0.7) * 10]);
    inkPath(wv, { p: dp(lt, 0, 0.6), w: 4, color: C.dim, jit: 0.4 });
    inkArrow(920, 320, 1190, 300, { p: dp(lt, 0.3, 0.4), color: KEY(), w: 5 });
    hand('2 + 3 = 5', 1480, 300, { size: 90, color: INK(), p: dp(lt, 0.5, 0.4) });
    hand('겉뜻', 1480, 185, { size: 76, p: dp(lt, 0.6, 0.4) });
    const S = q.w('속뜻', 23);
    inkArrow(700, 430, 1190, 700, { via: [900, 690], p: dp(t, S - 0.2, 0.5), color: C.green, w: 5, dash: [14, 10] });
    hand('5 − 3 = 2', 1480, 700, { size: 90, color: INK(), p: dp(t, S, 0.4) });
    hand('속뜻', 1480, 815, { size: 76, color: C.green, p: dp(t, S + 0.1, 0.4) });
  }],
  // 24a Goedel used exactly this
  [q.s(24), (t, lt) => {
    figure(540, 870, { s: 1.2, glasses: true, pose: 'present', face: 'smile', t, p: dp(lt, 0, 0.6) });
    hand('괴델', 540, 390, { size: 90, p: dp(lt, 0.6, 0.4) });
    meaningCard(1270, 430, 700, 200, { p: dp(lt, 0.8, 0.4) });
    pqString(2, 3, 5, 1270, 430, { s: 1.2, p: dp(lt, 1.0, 0.6) });
    hand('겉뜻 + 속뜻', 1270, 630, { size: 70, color: C.dim, p: dp(lt, 1.6, 0.5) });
  }],
  // 24b a sentence about numbers is also about something else
  [q.w('수에', 24), (t, lt) => {
    meaningCard(960, 240, 800, 160, { p: dp(lt, 0, 0.4) });
    hand('수에 대한 문장', 960, 244, { size: 76, color: INK(), p: dp(lt, 0.2, 0.5) });
    inkArrow(800, 330, 560, 520, { p: dp(lt, 0.7, 0.4), color: KEY(), w: 6 });
    hand('1  2  3 …', 500, 610, { size: 96, color: INK(), p: dp(lt, 1.0, 0.4) });
    hand('겉뜻', 500, 740, { size: 70, p: dp(lt, 1.1, 0.4) });
    const T = q.w('다른', 24);
    inkArrow(1120, 330, 1380, 500, { p: dp(t, T, 0.4), color: C.green, w: 6, dash: [14, 10] });
    prop('cloud', 1440, 700, 1.5, { p: dp(t, T + 0.2, 0.4) });
    hand('?', 1440, 614, { size: 110, p: dp(t, T + 0.4, 0.3) });
    hand('다른 무언가', 1440, 810, { size: 70, color: C.green, p: dp(t, T + 0.5, 0.4) });
  }],
  // 25a what if the hidden meaning points at the sentence itself?
  [q.s(25), (t, lt) => {
    meaningCard(800, 560, 760, 190, { p: dp(lt, 0, 0.4) });
    hand('이 문장은 …', 800, 566, { size: 86, color: INK(), p: dp(lt, 0.2, 0.5) });
    inkArrow(1180, 500, 600, 460, { via: [1000, 110], p: dp(t, q.w('가리키면', 25) - 0.5, 0.9), color: C.red, w: 6 });
    hand('자기 자신', 1450, 270, { size: 84, p: dp(t, q.w('자기', 25), 0.5) });
    hand('?', 1560, 610, { size: 220, p: dp(t, q.w('무슨', 25), 0.3) });
  }],
  // 25b the Tortoise will show it
  [q.w('거북이가', 25), (t, lt) => {
    ach(t, { x: 580, s: 1.15, face: 'surprised', look: 1 });
    tor(t, { x: 1330, s: 1.15, flip: true, pose: 'reach', face: 'wink' });
    prop('record', 1150, 790, 1.2, { p: dp(lt, 0.4, 0.5) });
    hand('?', 720, 380, { size: 120, p: dp(lt, 0.8, 0.3) });
  }],
]);

// ---------- record: 5장 '어떤 소리든 내는 전축' — the Crab's phonograph and self-reference ----------
// a phonograph with a record on its turntable and a small tag on the base
function recordPlayer(x, y, s, { p = 1, a = 1, tag = null, disc = true } = {}) {
  prop('phonograph', x, y, s, { p, a, fill: C.paper });
  if (disc && p > 0.6) inkEllipse(x - 10 * s, y - 74 * s, 70 * s, 13 * s, { a, fill: INK(), w: 2, p: clamp01((p - 0.6) / 0.4) });
  if (tag) hand(tag, x - 10 * s, y - 32 * s, { size: 26 * s, color: INK(), a, p: clamp01((p - 0.7) / 0.3) });
}
// sound waves coming out of a point to the right
function recordWaves(x, y, lt, { p = 1, a = 1, n = 3, color = null, k = 1 } = {}) {
  for (let i = 0; i < n; i++) {
    const r = (40 + i * 34 + ((lt * 40) % 34)) * k;
    inkArc(x, y, r, r * 1.2, -Math.PI * 0.3, Math.PI * 0.3, { p: clamp01(p * n - i), a: a * (1 - i / (n + 1)), w: 5, color: color || KEY() });
  }
}
// fragments of a broken phonograph flying apart from (x, y); u = 0..1 progress of the burst
function recordShards(x, y, u, { a = 1, s = 1 } = {}) {
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2 + 0.35 * Math.sin(i * 3.1), sp = (260 + 110 * Math.sin(i * 1.7)) * s;
    const cx = x + Math.cos(ang) * sp * u * 1.2, cy = Math.min(850, y + Math.sin(ang) * sp * u * 0.55 + 90 * s * u * u), rot = u * (i % 2 ? 3 : -3) + i;
    const k = (18 + 10 * Math.abs(Math.sin(i * 2.3))) * s;
    const pts = [[-k, -k * 0.6], [k * 0.8, -k], [k, k * 0.5], [-k * 0.4, k]].map(([dx, dy]) => [cx + dx * Math.cos(rot) - dy * Math.sin(rot), cy + dx * Math.sin(rot) + dy * Math.cos(rot)]);
    inkPath(pts, { closed: true, a, w: 3.6, fill: i % 3 ? C.paper : INK(), jit: 0.6 });
  }
  if (u < 0.45) for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2, r0 = 80 * s + u * 300 * s;
    inkLine(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0, x + Math.cos(ang) * (r0 + 60 * s), y + Math.sin(ang) * (r0 + 60 * s), { a: a * (1 - u / 0.45), w: 5, color: C.red });
  }
}
// a strip of paper (a sentence) with handwritten words
function recordStrip(x, y, w, h, str, { p = 1, a = 1, size = 54, color = null } = {}) {
  inkRect(x - w / 2, y - h / 2, w, h, { p, a, w: 5, fill: C.paper });
  if (str) hand(str, x, y + 4, { size, a, p: clamp01((p - 0.3) / 0.7), color: color || INK() });
}
// a "no" sign: red circle with a slash over a small loop arrow
function recordNoLoop(x, y, r, { p = 1, a = 1 } = {}) {
  prop('loop', x, y + 90 * r / 100, r / 100, { p, a });
  inkCircle(x, y, r, { p: clamp01(p * 1.5 - 0.3), a, w: 7, color: C.red });
  inkLine(x - r * 0.7, y - r * 0.7, x + r * 0.7, y + r * 0.7, { p: clamp01(p * 2 - 1), a, w: 7, color: C.red });
}
// a green tick
function recordCheck(x, y, p) { inkPath([[x - 34, y], [x - 8, y + 28], [x + 40, y - 36]], { p, w: 8, color: C.green }); }

SCENES.record = (t, q) => shots(t, [
  // 0a the Tortoise tells a story about his friend the Crab
  [q.s(0), (t, lt) => {
    ach(t, { x: 430, s: 1.15, face: 'smile', look: 1 });
    tor(t, { x: 1360, s: 1.1, pose: 'present', flip: true, face: 'happy' });
    bubble(620, 120, 780, 340, { kind: 'thought', tail: [1290, 480], p: dp(lt, 0.4, 0.5), body: (bx, by, bw, bh) => {
      crab(bx + 230, by + 300, { s: 0.95, t, p: dp(lt, 0.8, 0.5) });
      recordPlayer(bx + 550, by + 300, 1.0, { p: dp(lt, 1.2, 0.6) });
    } });
  }],
  // 0b the Crab shows off his new phonograph
  [q.w('게가', 0), (t, lt) => {
    crab(560, 860, { s: 1.6, t, p: dp(lt, 0, 0.5) });
    recordPlayer(1240, 870, 2.2, { p: dp(lt, 0.3, 0.6) });
    prop('star', 1620, 560, 0.6, { p: dp(lt, 1.0, 0.3) });
    prop('star', 900, 400, 0.45, { p: dp(lt, 1.2, 0.3) });
    hand('새 전축', 1240, 260, { size: 88, p: dp(lt, 1.0, 0.5) });
  }],
  // 1 "perfect: it can play any sound"
  [q.s(1), (t, lt) => {
    crab(500, 860, { s: 1.6, t });
    recordPlayer(1260, 870, 2.0, {});
    recordWaves(1550, 420, lt, { p: dp(lt, 0.6, 0.5), k: 1.3 });
    bubble(150, 140, 880, 240, { tail: [500, 590], text: '어떤 소리든 다 낸다!', size: 70, p: dp(lt, 0.2, 0.5) });
    hand('완벽', 1250, 260, { size: 84, p: dp(lt, 1.4, 0.4) });
  }],
  // 2 the question: a phonograph that plays any sound?
  [q.s(2), (t, lt) => {
    ach(t, { x: 300, s: 1.15, pose: 'think', face: 'think' });
    recordPlayer(1000, 860, 2.2, { p: dp(lt, 0, 0.6) });
    hand('?', 1540, 440, { size: 280, p: dp(lt, 0.8, 0.3) });
    hand('어떤 소리든?', 900, 230, { size: 84, p: dp(lt, 1.2, 0.5) });
  }],
  // 3a the Tortoise gives the Crab a record
  [q.s(3), (t, lt) => {
    crab(500, 860, { s: 1.5, t });
    tor(t, { x: 1380, s: 1.15, pose: 'reach', flip: true, face: 'wink' });
    prop('record', 1200, 800, 1.05, { p: dp(lt, 0.3, 0.5) });
    hand('선물', 980, 320, { size: 88, p: dp(lt, 1.0, 0.5) });
  }],
  // 3b its title
  [q.w('제목은', 3), (t, lt) => {
    prop('record', 1240, 830, 3.0, { p: dp(lt, 0, 0.5) });
    inkRect(460, 190, 660, 640, { p: dp(lt, 0.2, 0.5), w: 6, fill: C.paper });
    hand('제목', 790, 270, { size: 52, color: C.dim, p: dp(lt, 0.5, 0.3) });
    hand('전축 1호에서는', 790, 470, { size: 80, p: dp(lt, 0.7, 0.8) });
    hand('틀 수 없는 음반', 790, 610, { size: 80, p: dp(lt, 1.5, 0.8) });
  }],
  // 4a a very special sound in the grooves
  [q.s(4), (t, lt) => {
    prop('record', 470, 840, 3.0, { p: dp(lt, 0, 0.5) });
    inkLine(640, 470, 1030, 420, { p: dp(lt, 0.5, 0.4), w: 4, color: C.dim, dash: [12, 10] });
    inkCircle(1300, 460, 270, { p: dp(lt, 0.6, 0.5), w: 7, fill: C.paper });
    for (let i = 0; i < 3; i++) inkArc(1300, 1200, 560 + i * 70, 560 + i * 70, -Math.PI * 0.6, -Math.PI * 0.4, { p: dp(lt, 1.0, 0.4), w: 2.4, color: C.dim });
    const wv = []; for (let i = 0; i <= 36; i++) wv.push([1080 + i * 12.5, 470 + Math.sin(i * 1.3) * 70 * Math.sin(i * 0.18 + 0.4)]);
    inkPath(wv, { p: dp(lt, 1.3, 1.0), w: 6, color: C.red, jit: 0.4 });
    hand('특별한 소리', 1300, 810, { size: 78, p: dp(lt, 2.0, 0.5) });
  }],
  // 4b ... a vibration that shakes the phonograph to pieces
  [q.w('흔들어', 4), (t, lt) => {
    const sh = dp(lt, 0.3, 0.5), dx = Math.sin(lt * 47) * 9 * sh, dy = Math.cos(lt * 53) * 5 * sh;
    recordPlayer(860 + dx, 860 + dy, 2.4, {});
    recordWaves(1240 + dx, 330 + dy, lt, { p: dp(lt, 0.2, 0.5), color: C.red, n: 4, k: 1.3 });
    for (const d of [-1, 1]) for (let i = 0; i < 3; i++) inkLine(860 + d * (320 + i * 26), 640 + i * 50, 860 + d * (344 + i * 26), 690 + i * 50, { w: 5, p: dp(lt, 0.5, 0.3), color: C.dim });
    hand('떨림', 1600, 300, { size: 96, color: C.red, p: dp(lt, 0.8, 0.5) });
  }],
  // 5 it shatters within a few bars
  [q.s(5), (t, lt) => {
    crab(330, 860, { s: 1.3, t });
    const B = 1.1;
    if (lt < B) { recordPlayer(1080 + Math.sin(lt * 50) * 8, 860, 2.2, {}); recordWaves(1400, 380, lt, { color: C.red, n: 4, k: 1.3 }); }
    else recordShards(1080, 650, clamp01((lt - B) / 1.6), { s: 1.7 });
    hand('산산조각', 1080, 220, { size: 100, color: C.red, p: dp(lt, B + 0.4, 0.5) });
  }],
  // 6a the Crab buys a better phonograph
  [q.s(6), (t, lt) => {
    crab(440, 860, { s: 1.4, t });
    recordPlayer(1120, 870, 2.4, { p: dp(lt, 0, 0.6), tag: '2호' });
    prop('star', 1560, 560, 0.6, { p: dp(lt, 0.8, 0.3) });
    hand('더 좋은 전축', 1040, 230, { size: 84, p: dp(lt, 0.9, 0.5) });
  }],
  // 6b the Tortoise brings a new record made for it
  [q.w('거북이는', 6), (t, lt) => {
    recordPlayer(500, 870, 2.0, { tag: '2호' });
    const w = dp(lt, 0, 1.4), tx = lerp(1720, 1360, w);
    tor(t, { x: tx, s: 1.15, flip: true, walk: w < 1 ? 1 : 0, pose: 'reach', face: 'wink' });
    prop('record', tx - 175, 790, 1.0, {});
    inkRect(tx - 290, 500, 210, 90, { w: 4, fill: C.paper, p: dp(lt, 1.0, 0.3) });
    hand('2호용', tx - 185, 548, { size: 60, color: C.red, p: dp(lt, 1.2, 0.4) });
    hand('새 음반', 1060, 240, { size: 88, p: dp(lt, 1.4, 0.5) });
  }],
  // 7a the fight never ends: phonograph 1, 2, 3 ...
  [q.s(7), (t, lt) => {
    inkPoly([[100, 880], [540, 880], [540, 720], [960, 720], [960, 560], [1380, 560], [1380, 400], [1820, 400]], { p: dp(lt, 0, 1.0), w: 5, color: C.dim });
    [[320, 880], [750, 720], [1170, 560]].forEach(([x, y], i) => {
      const at = 0.4 + i * 0.6;
      recordPlayer(x, y, 1.05, { p: dp(lt, at, 0.4) });
      hand(`${i + 1}호`, x - 20, y - 290, { size: 64, color: INK(), p: dp(lt, at + 0.2, 0.3) });
      cross(x - 120, y - 240, 250, 230, { p: dp(lt, at + 0.5, 0.4), lw: 8 });
    });
    hand('…', 1600, 330, { size: 110, color: INK(), p: dp(lt, 2.4, 0.3) });
    hand('끝이 없다', 1600, 200, { size: 84, p: dp(lt, 2.6, 0.5) });
  }],
  // 7b the more perfect it is, the more exactly it plays the sound that breaks it
  [q.w('완벽할수록', 7), (t, lt) => {
    recordPlayer(360, 800, 1.8, { p: dp(lt, 0, 0.5) });
    prop('star', 640, 420, 0.5, { p: dp(lt, 0.4, 0.3) });
    hand('완벽할수록', 380, 250, { size: 76, p: dp(lt, 0.3, 0.5) });
    plusSign(800, 620, { p: dp(lt, 0.8, 0.3), s: 1.3 });
    prop('record', 1050, 800, 1.6, { p: dp(lt, 1.0, 0.4) });
    eqSign(1310, 620, { p: dp(lt, 1.5, 0.3), s: 1.3 });
    recordShards(1600, 620, 0.3, { s: 1.25, a: dp(lt, 1.7, 0.3) });
    hand('부서진다', 1600, 250, { size: 76, color: C.red, p: dp(lt, 2.0, 0.5) });
  }],
  // 8a a weak little phonograph survives
  [q.s(8), (t, lt) => {
    recordPlayer(820, 830, 1.4, { p: dp(lt, 0, 0.5) });
    prop('note', 1060, 520, 0.75, { p: dp(lt, 0.8, 0.3) });
    hand('엉성한 전축', 820, 330, { size: 84, p: dp(lt, 0.5, 0.5) });
    recordCheck(1290, 690, dp(lt, 1.4, 0.4));
    hand('안 부서짐', 1360, 690, { size: 74, color: C.green, p: dp(lt, 1.6, 0.4), align: 'left' });
  }],
  // 8b ... but it cannot play every record
  [q.w('그건', 8), (t, lt) => {
    recordPlayer(960, 875, 1.25, {});
    for (let i = 0; i < 6; i++) {
      const x = 380 + i * 232, at = 0.2 + i * 0.15;
      prop('record', x, 550, 0.95, { p: dp(lt, at, 0.3) });
      if (i === 0) recordCheck(x, 340, dp(lt, 1.0, 0.3));
      else cross(x - 80, 385, 160, 150, { p: dp(lt, 1.0 + i * 0.1, 0.25), lw: 7 });
    }
    hand('모든 음반?', 960, 230, { size: 84, color: C.red, p: dp(lt, 0.3, 0.5) });
  }],
  // 9a the trade-off: perfect breaks, weak plays only a little
  [q.s(9), (t, lt) => {
    inkLine(960, 170, 960, 870, { w: 4, color: C.dim, dash: [14, 12], p: dp(lt, 0, 0.4) });
    hand('완벽', 480, 230, { size: 84, p: dp(lt, 0.2, 0.4) });
    recordShards(480, 580, 0.3, { s: 1.3, a: dp(lt, 0.4, 0.4) });
    hand('엉성', 1440, 230, { size: 84, p: dp(lt, 0.8, 0.4) });
    recordPlayer(1420, 840, 1.6, { p: dp(lt, 1.0, 0.5) });
    prop('note', 1720, 520, 0.8, { p: dp(lt, 1.6, 0.3) });
  }],
  // 9b the weak one does not play just any sound
  [q.w('그건', 9), (t, lt) => {
    recordPlayer(420, 850, 1.6, {});
    prop('note', 700, 520, 0.8, {});
    prop('cloud', 1320, 680, 3.4, { p: dp(lt, 0, 0.5) });
    [[1000, 440], [1140, 400], [1290, 460], [1440, 390], [1600, 450], [1210, 560], [1380, 560], [1530, 560]].forEach(([x, y], i) => prop('note', x, y + 50, 0.62, { p: dp(lt, 0.3 + i * 0.08, 0.2) }));
    hand('어떤 소리든', 1320, 190, { size: 80, color: INK(), p: dp(lt, 0.8, 0.4) });
    cross(980, 290, 690, 400, { p: dp(lt, 1.4, 0.5), lw: 9 });
  }],
  // 10 so the answer: there is none
  [q.s(10), (t, lt) => {
    recordPlayer(860, 870, 2.4, { a: 0.7 });
    cross(560, 300, 640, 580, { p: dp(lt, 0.3, 0.6), lw: 11 });
    hand('답: 없다', 860, 200, { size: 104, p: dp(lt, 0.6, 0.5) });
    tor(t, { x: 1600, s: 1.15, face: 'smile', pose: 'akimbo', flip: true });
  }],
  // 11 the named idea
  [q.s(11), (t, lt) => teach('자기 지시', { y: 720, t, p: dp(lt, 0, 1.0) })],
  // 12 "this sentence is a lie" — the sentence points back at itself
  [q.s(12), (t, lt) => {
    recordStrip(800, 490, 1240, 210, '이 문장은 거짓말이다', { size: 100, p: dp(lt, 0, 1.2) });
    inkArrow(1380, 440, 400, 400, { via: [900, 30], p: dp(lt, 1.4, 0.8), color: C.red, w: 7, head: 28 });
    ach(t, { x: 1680, s: 1.1, face: 'think', pose: 'think' });
  }],
  // 13 true -> false -> true ...
  [q.s(13), (t, lt) => {
    inkCircle(640, 450, 140, { p: dp(lt, 0, 0.4), w: 6, fill: mix(C.green, 0.2) });
    hand('참', 640, 456, { size: 120, color: C.green, p: dp(lt, 0.2, 0.3) });
    inkCircle(1280, 450, 140, { p: dp(lt, 0.3, 0.4), w: 6, fill: mix(C.red, 0.15) });
    hand('거짓', 1280, 456, { size: 104, color: C.red, p: dp(lt, 0.5, 0.3) });
    inkArrow(740, 340, 1180, 340, { via: [960, 170], p: dp(lt, 0.6, 0.6), color: KEY(), w: 6 });
    const T = Math.max(1.6, q.w('거짓이면', 13) - q.s(13));
    inkArrow(1180, 560, 740, 560, { via: [960, 730], p: dp(lt, T, 0.6), color: KEY(), w: 6 });
    recordStrip(960, 815, 700, 100, '이 문장은 거짓말이다', { size: 54, p: dp(lt, 0.1, 0.5) });
  }],
  // 14 thoughts spin round and round: the strange loop
  [q.s(14), (t, lt) => {
    ach(t, { x: 640, s: 1.2, face: 'worried' });
    for (let i = 0; i < 2; i++) {
      const a0 = lt * 3 + i * Math.PI;
      inkArrow(640 + Math.cos(a0) * 120, 400 + Math.sin(a0) * 40, 640 + Math.cos(a0 + 2.2) * 120, 400 + Math.sin(a0 + 2.2) * 40, { via: [640 + Math.cos(a0 + 1.1) * 175, 400 + Math.sin(a0 + 1.1) * 58], color: C.red, w: 5, head: 18, p: dp(lt, 0.2, 0.4) });
    }
    prop('loop', 1380, 790, 2.6, { p: dp(lt, 1.0, 0.8) });
    hand('이상한 고리', 1380, 250, { size: 86, p: dp(t, q.w('이상한', 14), 0.5) });
  }],
  // 15 "oh, that's just wordplay"
  [q.s(15), (t, lt) => {
    figure(1220, 870, { s: 1.2, pose: 'shrug', face: 'smile', t, tie: true });
    bubble(380, 160, 860, 240, { tail: [1150, 470], text: '그냥 말장난이잖아', size: 74, p: dp(lt, 0.1, 0.4) });
  }],
  // 16 many people thought so: words are vague
  [q.s(16), (t, lt) => {
    [260, 600, 940, 1280, 1620].forEach((x, i) => figure(x, 870, { s: 0.85, pose: i % 2 ? 'shrug' : 'stand', face: i % 2 ? 'smile' : 'neutral', t, p: dp(lt, i * 0.15, 0.5) }));
    bubble(420, 350, 360, 130, { tail: [600, 560], text: '말장난', size: 58, p: dp(lt, 0.9, 0.4) });
    bubble(1100, 350, 360, 130, { tail: [1280, 560], text: '말장난', size: 58, p: dp(lt, 1.2, 0.4) });
    hand('말은 애매하니까', 960, 210, { size: 84, p: dp(t, q.w('애매하니까', 16) - 0.4, 0.6) });
  }],
  // 17a mathematicians push self-reference out of mathematics
  [q.s(17), (t, lt) => {
    inkRect(120, 210, 1140, 650, { p: dp(lt, 0, 0.6), w: 6, fill: mix(C.paper, 0.35) });
    hand('수학', 260, 280, { size: 80, p: dp(lt, 0.4, 0.4) });
    const u = dp(lt, 1.0, 2.6), cx = lerp(880, 1520, u);
    figure(cx - 320, 850, { s: 1.0, glasses: true, tie: true, pose: 'reach', face: 'angry', walk: u < 1 ? 1 : 0, t });
    figure(cx - 540, 850, { s: 1.0, glasses: true, pose: 'reach', face: 'angry', walk: u < 1 ? 1 : 0, t: t + 0.4 });
    recordStrip(cx, 560, 360, 120, '이 문장은…', { size: 56 });
    inkArrow(cx + 130, 505, cx - 80, 500, { via: [cx + 25, 380], color: C.red, w: 5, head: 18 });
  }],
  // 17b a rule (a fence and a sign) forbids self-reference
  [q.w('규칙까지', 17), (t, lt) => {
    for (let x = 140; x <= 1780; x += 164) inkLine(x, 640, x, 870, { p: dp(lt, 0, 0.3), w: 7 });
    inkLine(120, 700, 1800, 700, { p: dp(lt, 0.1, 0.3), w: 6 }); inkLine(120, 800, 1800, 800, { p: dp(lt, 0.15, 0.3), w: 6 });
    inkLine(960, 480, 960, 640, { p: dp(lt, 0.2, 0.2), w: 8 });
    inkRect(600, 170, 720, 310, { p: dp(lt, 0.25, 0.3), w: 6, fill: C.paper });
    recordNoLoop(770, 325, 105, { p: dp(lt, 0.4, 0.6) });
    hand('자기 지시', 1090, 270, { size: 68, color: INK(), p: dp(lt, 0.6, 0.4) });
    hand('금지', 1090, 390, { size: 100, color: C.red, p: dp(lt, 0.9, 0.3) });
    figure(1580, 880, { s: 1.1, glasses: true, tie: true, pose: 'akimbo', face: 'cool', t, p: dp(lt, 0.3, 0.5) });
  }],
  // 18a Goedel writes a self-referring sentence inside mathematics
  [q.s(18), (t, lt) => {
    inkRect(120, 210, 1200, 650, { w: 6, fill: mix(C.paper, 0.35), p: dp(lt, 0, 0.5) });
    hand('수학', 260, 280, { size: 80, p: dp(lt, 0.2, 0.4) });
    recordNoLoop(1200, 310, 55, { p: dp(lt, 0.3, 0.4) });
    figure(420, 850, { s: 1.1, glasses: true, pose: 'reach', face: 'smile', t, p: dp(lt, 0.3, 0.5) });
    hand('괴델', 420, 400, { size: 74, p: dp(lt, 0.8, 0.4) });
    recordStrip(880, 610, 560, 140, '이 문장은…', { size: 70, p: dp(lt, 1.0, 0.6) });
    inkArrow(1110, 545, 660, 540, { via: [890, 320], p: dp(lt, 1.8, 0.6), color: C.red, w: 6, head: 24 });
    hand('!', 1600, 480, { size: 260, color: C.red, p: dp(lt, 2.4, 0.3) });
  }],
  // 18b a self-breaking record for mathematics
  [q.w('수학을', 18), (t, lt) => {
    figure(420, 880, { s: 1.15, glasses: true, pose: 'reach', face: 'smile', t });
    hand('괴델', 420, 410, { size: 74 });
    const u = dp(lt, 0.2, 1.2);
    prop('record', lerp(620, 960, u), 790, 1.0, {});
    recordPlayer(1400, 870, 2.4, { p: dp(lt, 0, 0.5), tag: '수학' });
    hand('수학을 부수는 음반', 880, 220, { size: 80, p: dp(lt, 1.2, 0.6) });
  }],
  // 19 the trick: give every sentence a number
  [q.s(19), (t, lt) => {
    const rows = [['0 = 0', 250, '1'], ['1 + 1 = 2', 470, '2'], ['이 문장은…', 690, '3']];
    rows.forEach(([s, y, n], i) => {
      recordStrip(660, y, 720, 150, s, { size: 70, p: dp(lt, i * 0.3, 0.5) });
      const at = 1.2 + i * 0.5, k = pop(lt, at);
      if (lt > at) {
        ctx.save(); ctx.translate(1110, y - 40); ctx.rotate(0.12); ctx.scale(k, k);
        inkRect(-95, -50, 190, 100, { w: 5, fill: mix(C.yellow, 0.55) });
        hand(n + '번', 0, 4, { size: 64, color: INK() });
        ctx.restore();
      }
    });
    hand('번호 붙이기', 1570, 470, { size: 84, p: dp(lt, 1.8, 0.6) });
  }],
]);

// ===== 6 · godel: numbering the sentences (Gödel numbering, the sentence G, the incompleteness theorem) =====
// a paper card with a short handwritten line, centred on (x, y)
function godelCard(x, y, w, h, str, { p = 1, a = 1, size = 46, color = null, fill = null } = {}) {
  inkRect(x - w / 2, y - h / 2, w, h, { p, a, w: 4, fill: fill || C.paper });
  if (str) hand(str, x, y + 2, { size, p: clamp01((p - 0.45) / 0.55), a, color: color || INK() });
}
// a luggage tag (top at y) with a number; from = [x, y] where its string is tied
function godelTag(x, y, str, { p = 1, a = 1, s = 1, from = null } = {}) {
  const w = 74 * s, h = 84 * s;
  if (from) inkLine(from[0], from[1], x, y + 14 * s, { p, a, w: 2.6, color: C.dim });
  inkPath([[x - w / 2, y + 18 * s], [x - w / 2 + 18 * s, y], [x + w / 2 - 18 * s, y], [x + w / 2, y + 18 * s], [x + w / 2, y + h], [x - w / 2, y + h]],
    { closed: true, p, a, w: 3.2, fill: C.paper });
  inkCircle(x, y + 15 * s, 5 * s, { p, a, w: 2 });
  if (str) hand(str, x, y + h * 0.64, { size: 46 * s, p: clamp01((p - 0.5) * 2), a, color: INK() });
}
// centre x of tile i in a tiles() row of n
const godelTX = (n, i, x, size = 72, gap = 10) => { const w = size * 0.95; return x - (n * (w + gap) - gap) / 2 + i * (w + gap) + w / 2; };
// the numbering machine: intake on the left, slot on the right, a gear turning on top; (x, y) = bottom centre
function godelMachine(x, y, { p = 1, a = 1, t = 0 } = {}) {
  inkRect(x - 150, y - 230, 300, 230, { p, a, w: 4.4, fill: mix(C.grey, 0.25) });
  inkPoly([[x - 150, y - 190], [x - 205, y - 225], [x - 205, y - 95], [x - 150, y - 130]], { p, a, closed: true, w: 3.6, fill: C.paper });
  inkRect(x + 150, y - 150, 16, 74, { p, a, w: 3.6 });
  for (let i = 0; i < 3; i++) inkCircle(x - 70 + i * 70, y - 56, 14, { p, a, w: 3, fill: i === 1 ? mix(C.red, 0.6) : mix(C.green, 0.5) });
  ctx.save(); ctx.translate(x, y - 278); ctx.rotate(t * 1.2); prop('gear', 0, 48, 0.6, { p, a }); ctx.restore();
}
// a ticket with a (big) number
function godelTicket(x, y, str, { p = 1, a = 1, size = 64, w = 360 } = {}) {
  const h = size * 1.6;
  inkRect(x - w / 2, y - h / 2, w, h, { p, a, w: 4, fill: C.paper });
  inkLine(x - w / 2 + 40, y - h / 2 + 6, x - w / 2 + 40, y + h / 2 - 6, { p, a, w: 2.4, color: C.dim, dash: [8, 8] });
  hand(str, x + 20, y + 4, { size, p: clamp01((p - 0.4) / 0.6), a, color: KEY() });
}
// footprints along a polyline, left and right in turn; returns the position of the last print
function godelSteps(pts, { p = 1, a = 1, gap = 46 } = {}) {
  let L = 0; const seg = [0];
  for (let i = 1; i < pts.length; i++) { L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(L); }
  const n = Math.floor(L / gap); let last = pts[0];
  for (let k = 0; k <= n; k++) {
    if (p <= 0 || k / Math.max(1, n) > p) break;
    const d = k * gap; let i = 1; while (i < seg.length - 1 && seg[i] < d) i++;
    const f = (d - seg[i - 1]) / ((seg[i] - seg[i - 1]) || 1);
    const x = lerp(pts[i - 1][0], pts[i][0], f), y = lerp(pts[i - 1][1], pts[i][1], f);
    const ang = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]), side = k % 2 ? 1 : -1;
    const ox = -Math.sin(ang) * 11 * side, oy = Math.cos(ang) * 11 * side;
    withAlpha(a * 0.8, () => { ctx.save(); ctx.translate(x + ox, y + oy); ctx.rotate(ang); ctx.fillStyle = INK(); ctx.beginPath(); ctx.ellipse(0, 0, 12, 6.5, 0, 0, 7); ctx.fill(); ctx.restore(); });
    last = [x, y];
  }
  return last;
}
// the sentence G on a card: a big G, then what it says; loop = draw-on of the arrow that points back at itself
function godelG(x, y, { p = 1, a = 1, s = 1, text: str = 'G는 증명할 수 없다', loop = 0 } = {}) {
  const w = 620 * s, h = 150 * s;
  inkRect(x - w / 2, y - h / 2, w, h, { p, a, w: 4.4, fill: C.paper });
  hand('G', x - w / 2 + 62 * s, y + 4 * s, { size: 96 * s, p: clamp01((p - 0.3) / 0.4), a, color: KEY() });
  inkLine(x - w / 2 + 122 * s, y - h / 2 + 18 * s, x - w / 2 + 122 * s, y + h / 2 - 18 * s, { p, a, w: 2.4, color: C.dim });
  if (str) hand(str, x + 62 * s, y + 4 * s, { size: 52 * s, p: clamp01((p - 0.5) / 0.5), a, color: INK() });
  if (loop > 0) inkArrow(x + w / 2 - 50 * s, y - h / 2 - 8 * s, x - w / 2 + 62 * s, y - h / 2 - 12 * s,
    { via: [x + 20 * s, y - h / 2 - 230 * s], p: loop, a, w: 5, color: KEY(), head: 24 });
}
// the fork of the argument: a signpost, right arm "provable", left arm "unprovable"
function godelFork(x, y, s, { p = 1, a = 1 } = {}) {
  prop('signpost', x, y, s, { p, a, w: 4.4 });
  hand('증명 가능', x + 60 * s, y - 180 * s, { size: 46, p: clamp01(p * 2 - 0.8), a, color: INK() });
  hand('증명 불가', x - 60 * s, y - 130 * s, { size: 46, p: clamp01(p * 2 - 1), a, color: INK() });
}
// a classroom shot with custom content on the board; content(cx, cy, p)
function godelBoard(lt, content, { fig = {}, face = 'smile' } = {}) {
  const p = dp(lt, 0, 1.2);
  teach('', { y: 720, p, face, fig, t: lt });
  content(1000, 350, dp(lt, 0.7, 0.8));
}
// a small green tick
const godelTick = (x, y, { p = 1, a = 1, s = 1 } = {}) => inkPoly([[x - 26 * s, y], [x - 6 * s, y + 22 * s], [x + 30 * s, y - 26 * s]], { p, a, w: 7 * s, color: C.green });

// zoom a shot so its content box (x0, y0)-(x1, y1) fills the safe frame (x 80..1840, y 110..880), at most kmax
const godelFit = (x0, y0, x1, y1, fn, kmax = 1.5) => (t, lt) => {
  const k = Math.min(kmax, 1760 / (x1 - x0), 770 / (y1 - y0));
  ctx.save(); ctx.translate(960, 495); ctx.scale(k, k); ctx.translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
  fn(t, lt); ctx.restore();
};

SCENES.godel = (t, q) => { const F = godelFit; return shots(t, [
  // 0 — maths talks about numbers… how can it talk about itself?
  [q.s(0), F(500, 320, 1560, 885, (t, lt) => {
    inkRect(520, 400, 560, 420, { p: dp(lt, 0, 0.7), w: 4.4, fill: C.paper });
    hand('2 + 3 = 5', 800, 510, { size: 66, p: dp(lt, 0.5, 0.6), color: INK() });
    hand('7 × 6 = 42', 800, 610, { size: 66, p: dp(lt, 0.9, 0.6), color: INK() });
    hand('1, 2, 3, …', 800, 710, { size: 58, p: dp(lt, 1.3, 0.6), color: INK() });
    hand('수학', 800, 355, { size: 60, p: dp(lt, 1.6, 0.5) });
    tor(t, { x: 1420, pose: 'point', flip: true, face: 'think', p: dp(lt, 0.2, 1) });
    hand('수에 대한 말', 1420, 530, { size: 46, color: C.dim, p: dp(lt, 2, 0.6) });
  })],
  [q.w('어떻게', 0), F(400, 190, 1660, 770, (t, lt) => {
    inkRect(420, 340, 480, 360, { w: 4.4, fill: C.paper });
    hand('2 + 3 = 5', 660, 450, { size: 58, color: INK() });
    hand('7 × 6 = 42', 660, 550, { size: 58, color: INK() });
    bubble(1000, 200, 480, 170, { tail: [880, 400], text: '나 자신?', size: 66, p: dp(lt, 0.2, 0.5) });
    inkArrow(1420, 380, 920, 640, { via: [1460, 760], p: dp(lt, 0.8, 0.9), color: KEY(), w: 5 });
    hand('?', 1620, 560, { size: 120, color: C.red, p: dp(lt, 1.5, 0.4) });
  })],
  // 1 — arithmetic written like the MU puzzle: a formal system
  [q.s(1), F(260, 260, 1610, 610, (t, lt) => {
    hand('MU 퍼즐', 520, 300, { size: 54, p: dp(lt, 0.4, 0.5) });
    tiles('MIU', 520, 420, { size: 90, p: dp(lt, 0, 0.8) });
    ruleCard(600, 560, '', 'xI', 'xIU', { p: dp(lt, 0.6, 0.6), size: 48 });
    const T1 = q.w('덧셈과', 1);
    hand('처럼', 940, 480, { size: 52, color: C.dim, p: dp(t, T1 + 0.3, 0.4) });
    hand('덧셈 · 곱셈', 1360, 300, { size: 54, p: dp(t, T1, 0.5) });
    tiles('2+3=5', 1360, 420, { size: 90, p: dp(t, T1, 1), color: INK() });
    tiles('2×3=6', 1360, 560, { size: 90, p: dp(t, T1 + 0.6, 1), color: INK() });
  })],
  [q.w('형식', 1), F(330, 190, 1390, 885, (t, lt) => teach('형식 체계', { y: 720, p: dp(lt, 0, 1.2), t: lt }))],
  // 2 — start point, rules, new sentences
  [q.s(2), F(200, 380, 1740, 640, (t, lt) => {
    godelCard(360, 470, 300, 130, '0=0', { size: 62, p: dp(lt, 0, 0.6) });
    hand('출발점', 360, 600, { size: 56, p: dp(lt, 0.5, 0.5) });
    const Tr = q.w('규칙이', 2), Tn = q.w('새', 2);
    inkArrow(540, 470, 770, 470, { p: dp(t, Tr, 0.6), w: 5, color: KEY() });
    hand('규칙', 655, 410, { size: 46, color: C.dim, p: dp(t, Tr + 0.2, 0.4) });
    godelCard(960, 470, 320, 130, '0+0=0', { size: 62, p: dp(t, Tn, 0.6) });
    inkArrow(1150, 470, 1380, 470, { p: dp(t, Tn + 0.3, 0.4), w: 5, color: KEY() });
    hand('규칙', 1265, 410, { size: 46, color: C.dim, p: dp(t, Tn + 0.4, 0.3) });
    godelCard(1570, 470, 320, 130, '0×0=0', { size: 62, p: dp(t, Tn + 0.6, 0.5) });
    hand('새 문장', 1265, 610, { size: 56, p: dp(t, Tn + 0.4, 0.5) });
  })],
  // 3 — walking from the start to a sentence by the rules = proving it
  [q.s(3), F(180, 320, 1660, 870, (t, lt) => {
    godelCard(300, 740, 240, 100, '0=0', { size: 52, p: dp(lt, 0, 0.5) });
    hand('출발점', 300, 830, { size: 42, color: C.dim, p: dp(lt, 0.3, 0.4) });
    godelCard(1500, 380, 300, 110, '0×0=0', { size: 52, p: dp(lt, 0.4, 0.5) });
    const path = [[440, 740], [640, 690], [780, 590], [980, 620], [1160, 480], [1330, 410]];
    const at = godelSteps(path, { p: dp(lt, 0.6, 3.4) });
    figure(at[0], at[1] - 8, { s: 0.36, walk: dp(lt, 0.6, 3.4) < 1 ? 1 : 0, t: lt, face: 'happy' });
    const Tp = q.w('증명한다고', 3);
    hand('증명', 900, 790, { size: 86, p: dp(t, Tp, 0.5) });
    underline(820, 980, 840, { p: dp(t, Tp + 0.4, 0.4), color: KEY() });
    ring(1500, 380, 190, 80, { p: dp(t, Tp + 0.2, 0.6) });
  })],
  // 4 — 'provable' = 'can be made by the rules' (MI → MII)
  [q.s(4), F(490, 340, 1480, 690, (t, lt) => {
    tiles('MI', 620, 450, { size: 110, p: dp(lt, 0, 0.6) });
    inkArrow(800, 450, 1040, 450, { p: dp(lt, 0.7, 0.6), w: 6, color: KEY() });
    hand('규칙', 920, 390, { size: 46, color: C.dim, p: dp(lt, 0.9, 0.4) });
    tiles('MII', 1300, 450, { size: 110, p: dp(lt, 1.1, 0.8) });
    hand('증명할 수 있다?', 960, 650, { size: 60, p: dp(lt, 1.8, 0.7) });
  })],
  [q.w('규칙으로', 4), F(420, 250, 1590, 640, (t, lt) => {
    tiles('MI', 680, 300, { size: 72 }); inkArrow(800, 300, 1000, 300, { w: 5, color: KEY() }); tiles('MII', 1180, 300, { size: 72 });
    hand('증명 가능', 560, 560, { size: 66, p: dp(lt, 0, 0.6) });
    eqSign(960, 560, { p: dp(lt, 0.5, 0.4) });
    hand('만들 수 있음', 1360, 560, { size: 66, p: dp(lt, 0.8, 0.7) });
    ring(1360, 560, 220, 70, { p: dp(lt, 1.6, 0.6) });
  })],
  // 5 — Gödel puts a number on every symbol
  [q.s(5), F(380, 410, 1480, 885, (t, lt) => {
    figure(480, GROUND, { pose: 'reach', face: 'smile', glasses: true, t: lt, p: dp(lt, 0, 1) });
    hand('괴델', 480, 500, { size: 46, color: C.dim, p: dp(lt, 0.6, 0.4) });
    godelTag(620, 676, '#', { s: 0.8, p: dp(lt, 0.8, 0.5) });
    tiles('0+=×', 1260, 560, { size: 100, color: INK(), p: dp(lt, 0.4, 0.8) });
    const Tb = q.w('번호를', 5);
    for (let i = 0; i < 4; i++) { const x = godelTX(4, i, 1260, 100); godelTag(x, 670, '', { from: [x, 610], p: dp(t, Tb + i * 0.2, 0.4) }); }
    hand('번호 붙이기', 1260, 450, { size: 60, p: dp(t, Tb + 0.3, 0.6) });
  })],
  // 6 — 0 is 1, + is 2, = is 3
  [q.s(6), F(270, 450, 1240, 885, (t, lt) => {
    figure(330, GROUND, { pose: 'point', face: 'smile', glasses: true, s: 0.8, t: lt, p: dp(lt, 0, 0.8) });
    tiles('0+=', 960, 520, { size: 130, gap: 60, color: INK(), p: dp(lt, 0, 0.7) });
    const T = [q.wx('일', 6), q.wx('이', 6), q.wx('삼', 6)];
    ['1', '2', '3'].forEach((n, i) => { const x = godelTX(3, i, 960, 130, 60); godelTag(x, 640, n, { s: 1.4, from: [x, 585], p: dp(t, T[i] - 0.2, 0.5) }); });
    hand('번', 1220, 720, { size: 50, color: C.dim, p: dp(t, T[2] + 0.4, 0.3) });
  })],
  [q.w('이런', 6), F(240, 500, 1510, 885, (t, lt) => {
    figure(300, GROUND, { pose: 'present', face: 'happy', glasses: true, s: 0.8, t: lt });
    tiles('0+=×()', 1060, 560, { size: 100, gap: 30, color: INK() });
    for (let i = 0; i < 6; i++) { const x = godelTX(6, i, 1060, 100, 30); godelTag(x, 670, String(i + 1), { s: 1.1, from: [x, 610], p: i < 3 ? 1 : dp(lt, 0.1 + (i - 3) * 0.2, 0.3) }); }
    hand('…', 1470, 740, { size: 80, color: C.dim, p: dp(lt, 0.8, 0.3) });
  })],
  // 7 — the symbol numbers are packed into one big number
  [q.s(7), F(230, 360, 1610, 790, (t, lt) => {
    const Tb = q.w('묶어서', 7), mv = smooth(dp(t, Tb, 1.3)), fade = 1 - dp(t, Tb + 0.9, 0.5);
    const dx = lerp(0, 430, mv);
    tiles('0+0=0', 440 + dx, 400, { size: 74, color: INK(), p: dp(lt, 0, 0.6), a: fade });
    ['1', '2', '1', '3', '1'].forEach((n, i) => { const x = godelTX(5, i, 440, 74) + dx; godelTag(x, 480, n, { s: 0.8, from: [x, 437], p: dp(lt, 0.5 + i * 0.15, 0.4), a: fade }); });
    godelMachine(1060, 780, { p: dp(lt, 0.3, 0.8), t });
    const Tk = Tb + 1.5;
    if (t > Tk) godelTicket(lerp(1250, 1440, smooth(dp(t, Tk, 0.8))), 665, '339570', { p: dp(t, Tk, 0.6), size: 56, w: 320 });
  })],
  [q.w('커다란', 7), F(620, 210, 1300, 780, (t, lt) => {
    tiles('0+0=0', 960, 250, { size: 64, color: INK() });
    inkArrow(960, 310, 960, 420, { p: dp(lt, 0, 0.4), w: 5, color: KEY() });
    godelTicket(960, 540, '339570', { p: dp(lt, 0.2, 0.7), size: 120, w: 660 });
    hand('수 하나', 960, 740, { size: 64, p: dp(lt, 1, 0.5) });
  })],
  // 8 — every sentence gets its own number: the Gödel number
  [q.s(8), F(360, 260, 1480, 740, (t, lt) => {
    const row = (y, left, num, k) => {
      if (left[0] === '…') hand('…', 560, y, { size: 80, color: C.dim, p: dp(lt, k, 0.4) });
      else tiles(left, 560, y, { size: 70, color: INK(), p: dp(lt, k, 0.5) });
      inkArrow(800, y, 1040, y, { p: dp(lt, k + 0.4, 0.4), w: 5, color: KEY() });
      if (num === '…') hand('…', 1300, y, { size: 80, color: C.dim, p: dp(lt, k + 0.6, 0.4) });
      else godelTicket(1300, y, num, { p: dp(lt, k + 0.6, 0.5), size: 60, w: 340 });
    };
    row(320, '0=0', '270', 0); row(500, '0+0=0', '339570', 0.9); row(680, '…', '…', 1.8);
  })],
  [q.w('괴델', 8), F(330, 190, 1390, 885, (t, lt) => teach('괴델 수', { y: 720, p: dp(lt, 0, 1.2), t: lt, fig: { glasses: true } }))],
  // 9 — like a phone: letters are stored as numbers
  [q.s(9), F(700, 380, 1420, 885, (t, lt) => {
    figure(800, GROUND, { pose: 'reach', face: 'smile', t: lt, p: dp(lt, 0, 0.8) });
    prop('phone', 1100, 780, 2.6, { p: dp(lt, 0.3, 0.6), fill: C.paper });
    bubble(1030, 450, 140, 90, { tail: [1050, 560], text: '안녕', size: 46, p: dp(lt, 1, 0.4) });
    hand('문자', 1330, 520, { size: 56, p: dp(lt, 1.2, 0.5) });
  })],
  [q.w('기계', 9), F(340, 380, 1520, 790, (t, lt) => {
    prop('phone', 460, 780, 2.6, {});
    hand('안녕', 460, 560, { size: 56, color: INK() });
    inkArrow(640, 560, 900, 560, { p: dp(lt, 0, 0.5), w: 5, color: KEY() });
    hand('안 → 50504', 1320, 470, { size: 70, p: dp(lt, 0.4, 0.7) });
    hand('녕 → 45397', 1320, 590, { size: 70, p: dp(lt, 1, 0.7) });
    hand('숫자로 저장', 1320, 730, { size: 50, color: C.dim, p: dp(lt, 1.6, 0.5) });
  })],
  // 10 — and back: from the number to the sentence
  [q.s(10), F(270, 270, 1680, 690, (t, lt) => {
    godelTicket(480, 520, '339570', { size: 70, w: 400, p: dp(lt, 0, 0.5) });
    inkArrow(700, 470, 1180, 470, { via: [940, 300], p: dp(lt, 0.4, 0.8), w: 5, color: KEY() });
    hand('거꾸로', 940, 330, { size: 58, p: dp(lt, 0.8, 0.5) });
    tiles('0+0=0', 1420, 520, { size: 80, color: INK(), p: dp(lt, 1.1, 0.7) });
    const Tr = q.w('되살릴', 10);
    hand('되살리기', 1420, 650, { size: 50, color: C.dim, p: dp(t, Tr, 0.5) });
    ring(1420, 520, 250, 80, { p: dp(t, Tr + 0.2, 0.6) });
  })],
  // 11 — the MU puzzle numbered: M 3, I 1, U 0
  [q.s(11), F(200, 390, 1280, 885, (t, lt) => {
    ach(t, { x: 300, s: 0.8, pose: 'point', face: 'smile', p: dp(lt, 0, 0.8) });
    tiles('MIU', 1000, 470, { size: 140, gap: 70, p: dp(lt, 0.3, 0.8) });
    const T = [q.wx('삼', 11), q.wx('일', 11), q.w('영을', 11)];
    ['3', '1', '0'].forEach((n, i) => hand(n, godelTX(3, i, 1000, 140, 70), 670, { size: 120, p: dp(t, T[i] - 0.1, 0.4) }));
  })],
  [q.w('그러면', 11), F(400, 270, 1330, 710, (t, lt) => {
    const T1 = q.w('엠아이는', 11), T2 = q.w('엠아이유는', 11);
    tiles('MI', 560, 330, { size: 100 });
    ['3', '1'].forEach((n, i) => hand(n, godelTX(2, i, 560, 100), 420, { size: 50 }));
    inkArrow(720, 360, 1000, 360, { p: dp(t, T1, 0.4), w: 5, color: KEY() });
    hand('31', 1180, 360, { size: 120, p: dp(t, T1 + 0.3, 0.5) });
    tiles('MIU', 560, 590, { size: 100, p: dp(lt, 0.2, 0.6) });
    ['3', '1', '0'].forEach((n, i) => hand(n, godelTX(3, i, 560, 100), 680, { size: 50, p: dp(lt, 0.6 + i * 0.15, 0.3) }));
    inkArrow(770, 620, 1000, 620, { p: dp(t, T2, 0.4), w: 5, color: KEY() });
    hand('310', 1210, 620, { size: 120, p: dp(t, T2 + 0.3, 0.5) });
  })],
  // 12 — the rule xI → xIU is the sum "last digit 1 → ×10"
  [q.s(12), F(570, 170, 1400, 610, (t, lt) => {
    hand('규칙', 960, 200, { size: 46, color: C.dim, p: dp(lt, 0, 0.4) });
    ruleCard(1040, 300, '', 'xI', 'xIU', { p: dp(lt, 0.2, 0.7), size: 76 });
    tiles('MI', 680, 560, { size: 96, p: dp(lt, 1, 0.5) });
    inkArrow(820, 560, 1060, 560, { p: dp(lt, 1.4, 0.5), w: 5, color: KEY() });
    tiles('MIU', 1240, 560, { size: 96, p: dp(lt, 1.7, 0.6) });
  })],
  [q.w('끝자리가', 12), F(660, 190, 1260, 670, (t, lt) => {
    ruleCard(1040, 230, '', 'xI', 'xIU', { size: 60 });
    eqSign(960, 350, { p: dp(lt, 0, 0.4) });
    hand('끝자리 1 → × 10', 960, 480, { size: 70, p: dp(lt, 0.3, 1) });
    hand('31 → 310', 960, 630, { size: 64, color: INK(), p: dp(lt, 1.4, 0.7) });
  })],
  // 13 — "can we make MU?"
  [q.s(13), F(500, 350, 1460, 885, (t, lt) => {
    ach(t, { x: 600, pose: 'think', face: 'think', p: dp(lt, 0, 0.8) });
    bubble(880, 380, 560, 300, { kind: 'thought', tail: [700, 560], p: dp(lt, 0.4, 0.5),
      body: (x, y, w, h) => { tiles('MU', x + w / 2 - 50, y + h / 2, { size: 110 }); hand('?', x + w / 2 + 150, y + h / 2, { size: 120, color: C.red }); } });
  })],
  // 14 — a question about numbers: from 31 to 30?
  [q.s(14), F(520, 250, 1400, 620, (t, lt) => {
    tiles('MI', 620, 300, { size: 90, p: dp(lt, 0, 0.5) });
    tiles('MU', 1300, 300, { size: 90, p: dp(lt, 0.2, 0.5) });
    hand('31', 620, 480, { size: 130, p: dp(lt, 0.5, 0.5) });
    hand('30', 1300, 480, { size: 130, p: dp(lt, 1.6, 0.5) });
    inkArrow(780, 480, 1150, 480, { p: dp(lt, 1, 0.7), w: 5, color: INK(), dash: [14, 10] });
    hand('× 10 …', 965, 420, { size: 46, color: C.dim, p: dp(lt, 1.2, 0.5) });
    hand('?', 965, 560, { size: 100, color: C.red, p: dp(lt, 2, 0.4) });
  })],
  [q.w('질문이', 14), F(580, 260, 1340, 700, (t, lt) => {
    hand('31', 680, 420, { size: 160 });
    inkArrow(820, 420, 1100, 420, { w: 6, color: INK(), dash: [14, 10] });
    hand('30', 1240, 420, { size: 160 });
    hand('?', 960, 330, { size: 100, color: C.red });
    hand('수에 대한 질문', 960, 620, { size: 66, p: dp(lt, 0, 0.7) });
    underline(720, 1200, 670, { p: dp(lt, 0.7, 0.4), color: KEY() });
  })],
  // 15 — the magic: a sentence becomes a number
  [q.s(15), F(380, 380, 1480, 885, (t, lt) => {
    figure(460, GROUND, { pose: 'point', face: 'happy', glasses: true, t: lt, p: dp(lt, 0, 0.8) });
    inkLine(584, 648, 720, 560, { w: 6, p: dp(lt, 0.5, 0.3) });
    prop('star', 726, 600, 0.32, { p: dp(lt, 0.7, 0.3) });
    const k = smooth(dp(lt, 1.4, 0.8));
    godelCard(1180, 620, 400, 200, '', { p: dp(lt, 0.3, 0.5) });
    if (k < 1) tiles('MIU', 1180, 620, { size: 90, a: 1 - k, p: dp(lt, 0.5, 0.5) });
    hand('310', 1180, 625, { size: 120, a: k });
    for (const [sx, sy, d] of [[930, 540, 1.6], [1440, 540, 1.8], [1450, 800, 2], [920, 800, 2.2]]) prop('star', sx, sy, 0.26, { p: dp(lt, d, 0.3) });
    hand('마법', 1180, 440, { size: 64, p: dp(lt, 0.4, 0.5) });
  })],
  [q.w('성질이', 15), F(380, 360, 1540, 630, (t, lt) => {
    godelTicket(560, 440, '310', { size: 90, w: 340, p: dp(lt, 0, 0.5) });
    hand('수의 성질', 560, 600, { size: 56, p: dp(lt, 0.3, 0.5) });
    eqSign(960, 440, { p: dp(lt, 0.7, 0.4) });
    godelCard(1360, 440, 340, 150, '', { p: dp(lt, 0.9, 0.5) });
    tiles('MIU', 1360, 440, { size: 84, p: dp(lt, 1.1, 0.5) });
    hand('문장의 성질', 1360, 600, { size: 56, p: dp(lt, 1.4, 0.5) });
  })],
  // 16 — 'provable' becomes a statement about numbers
  [q.s(16), F(330, 360, 1660, 680, (t, lt) => {
    tiles('MI', 440, 420, { size: 100, p: dp(lt, 0, 0.5) });
    godelSteps([[580, 430], [760, 380], [960, 450], [1160, 390], [1340, 420]], { p: dp(lt, 0.4, 2) });
    tiles('MIU', 1500, 420, { size: 100, p: dp(lt, 2, 0.6) });
    hand('증명할 수 있다', 960, 620, { size: 64, p: dp(lt, 2.4, 0.7) });
  })],
  [q.w('번호를', 16), F(480, 230, 1440, 760, (t, lt) => {
    tiles('MI', 620, 290, { size: 70 }); inkArrow(740, 290, 1140, 290, { w: 5, color: C.dim }); tiles('MIU', 1300, 290, { size: 70 });
    hand('증명', 940, 250, { size: 44, color: C.dim });
    eqSign(960, 420, { p: dp(lt, 0, 0.4) });
    hand('31', 620, 560, { size: 100, p: dp(lt, 0.3, 0.4) });
    inkArrow(740, 560, 1140, 560, { p: dp(lt, 0.6, 0.5), w: 5, color: KEY() });
    hand('× 10', 940, 515, { size: 48, color: C.dim, p: dp(lt, 0.8, 0.4) });
    hand('310', 1300, 560, { size: 100, p: dp(lt, 1, 0.4) });
    const Tn = q.w('수에', 16);
    ring(960, 560, 470, 90, { p: dp(t, Tn, 0.6) });
    hand('수에 대한 말', 960, 720, { size: 62, p: dp(t, Tn + 0.3, 0.6) });
  })],
  // 17 — isomorphism again: outside about numbers, inside about sentences
  [q.s(17), F(330, 190, 1390, 885, (t, lt) => teach('동형', { y: 720, p: dp(lt, 0, 1.2), t: lt }))],
  [q.w('겉으로는', 17), F(410, 170, 1470, 750, (t, lt) => {
    const Ti = q.w('속으로는', 17), m = smooth(dp(t, Ti, 0.9));
    godelCard(1180, 360, 560, 260, '', { fill: mix(C.yellow, 0.18) });
    tiles('MIU', 1180, 360, { size: 80, a: m });
    hand('속: 문장', 1180, 200, { size: 54, p: dp(t, Ti + 0.4, 0.5) });
    const fx = lerp(1060, 700, m), fy = lerp(450, 560, m);
    godelCard(fx, fy, 560, 260, '', { p: dp(lt, 0, 0.5) });
    hand('31 × 10 = 310', fx, fy, { size: 62, color: INK(), p: dp(lt, 0.3, 0.7) });
    hand('겉: 수', fx, fy + 165, { size: 54, p: dp(lt, 0.8, 0.5) });
  })],
  // 18 — Gödel builds one clever sentence: G
  [q.s(18), F(380, 340, 1490, 885, (t, lt) => {
    figure(480, GROUND, { pose: 'present', face: 'wink', glasses: true, t: lt, p: dp(lt, 0, 0.8) });
    board(860, 420, 620, 340, { p: dp(lt, 0.3, 0.8) });
    hand('교묘한 문장', 1170, 375, { size: 50, color: C.dim, p: dp(lt, 0.8, 0.6) });
    hand('G', 1170, 600, { size: 230, p: dp(t, q.w('지라고', 18), 0.5) });
  })],
  // 19 — what G says inside: 'G cannot be proved in this system'
  [q.s(19), F(340, 260, 1620, 820, (t, lt) => {
    godelCard(460, 640, 220, 220, 'G', { size: 150, color: KEY(), p: dp(lt, 0, 0.5) });
    hand('속뜻', 460, 795, { size: 46, color: C.dim, p: dp(lt, 0.5, 0.4) });
    bubble(700, 280, 900, 240, { kind: 'thought', tail: [560, 540], p: dp(lt, 0.8, 0.5), text: 'G는 증명할 수 없다', size: 66 });
  })],
  // 20 — the liar sentence, one word changed
  [q.s(20), F(500, 470, 1650, 885, (t, lt) => {
    hand('거짓말쟁이 문장', 900, 505, { size: 50, color: C.dim, p: dp(lt, 0, 0.5) });
    godelCard(900, 640, 780, 150, '이 문장은 거짓이다', { size: 64, p: dp(lt, 0.3, 0.6) });
    tor(t, { x: 1560, pose: 'point', flip: true, face: 'think', p: dp(lt, 0.2, 0.8) });
  })],
  [q.w('거짓이다가', 20), F(460, 340, 1460, 770, (t, lt) => {
    inkRect(470, 450, 980, 150, { w: 4, fill: C.paper });
    hand('이 문장은', 860, 528, { size: 66, color: INK(), align: 'right' });
    const wf = handW('거짓이다', 66);
    hand('거짓이다', 900, 528, { size: 66, color: INK(), align: 'left' });
    inkLine(890, 528, 910 + wf, 524, { p: dp(lt, 0.2, 0.4), w: 7, color: C.red });
    const Tp = q.w('증명할', 20);
    hand('증명할 수 없다', 900 + wf / 2, 385, { size: 64, p: dp(t, Tp, 0.7) });
    inkPath([[880 + wf / 2, 436], [900 + wf / 2, 416], [920 + wf / 2, 436]], { p: dp(t, Tp + 0.5, 0.3), w: 4, color: KEY() });
    hand('= G', 960, 710, { size: 80, p: dp(t, Tp + 0.6, 0.4) });
  })],
  // 21 — not a spinning word game but a solid conclusion
  [q.s(21), F(390, 310, 1610, 740, (t, lt) => {
    ctx.save(); ctx.translate(540, 470); ctx.rotate(t * 2.2); prop('loop', 0, 162, 1.8, { p: dp(lt, 0, 0.6) }); ctx.restore();
    hand('말장난', 540, 700, { size: 56, color: C.dim, p: dp(lt, 0.4, 0.5) });
    const Td = q.w('대신', 21), Ts = q.w('단단한', 21);
    cross(400, 320, 280, 300, { p: dp(t, Td, 0.5) });
    inkArrow(800, 500, 1060, 500, { p: dp(t, Td + 0.3, 0.5), w: 5, color: KEY() });
    prop('rock', 1360, 620, 2.2, { p: dp(t, Ts, 0.6) });
    hand('단단한 결론', 1360, 712, { size: 60, p: dp(t, Ts + 0.4, 0.6) });
    ring(1360, 535, 250, 112, { p: dp(t, Ts + 0.9, 0.6) });
  })],
  // 22 — it points at itself, like the Tortoise's record
  [q.s(22), F(500, 380, 1680, 800, (t, lt) => {
    godelG(820, 600, { p: dp(lt, 0, 0.5), loop: dp(lt, 0.4, 1) });
    const Tr = q.w('음반', 22);
    prop('record', 1560, 720, 1.2, { p: dp(t, Tr - 0.3, 0.5) });
    hand('음반', 1560, 775, { size: 50, color: C.dim, p: dp(t, Tr, 0.4) });
  })],
  // 23 — the fork: what if G can be proved?
  [q.s(23), F(390, 370, 1620, 885, (t, lt) => {
    tor(t, { x: 480, pose: 'point', face: 'think', p: dp(lt, 0, 0.8) });
    godelFork(1100, 860, 2.2, { p: dp(lt, 0.2, 0.9) });
    const Tm = q.w('만약', 23);
    ring(1232, 464, 150, 52, { p: dp(t, Tm + 0.3, 0.6), color: KEY() });
    hand('만약?', 1530, 470, { size: 60, p: dp(t, Tm, 0.5) });
  })],
  // 24 — then it proved a false sentence: maths lied
  [q.s(24), F(580, 240, 1420, 640, (t, lt) => {
    godelG(900, 440, { p: dp(lt, 0, 0.5) });
    ctx.save(); const sc = pop(lt, 0.6); ctx.translate(1300, 300); ctx.rotate(-0.18); ctx.scale(sc, sc);
    if (lt > 0.6) { ring(0, 0, 110, 56, { color: C.green, lw: 6 }); hand('증명!', 0, 4, { size: 56, color: C.green }); }
    ctx.restore();
    const Tw = q.w('틀린', 24);
    underline(780, 1190, 492, { p: dp(t, Tw, 0.4) });
    hand('틀린 말', 980, 600, { size: 64, color: C.red, p: dp(t, Tw + 0.3, 0.5) });
  })],
  [q.w('방금', 24), F(320, 380, 1490, 540, (t, lt) => {
    ctx.save(); ctx.translate(460, 460); ctx.rotate(-0.12); ring(0, 0, 130, 62, { color: C.green, lw: 6, p: dp(lt, 0, 0.5) });
    hand('증명!', 0, 4, { size: 60, color: C.green, p: dp(lt, 0.2, 0.4) }); ctx.restore();
    plusSign(760, 460, { p: dp(lt, 0.5, 0.3) });
    godelCard(1080, 460, 340, 140, '틀린 말', { size: 64, color: C.red, p: dp(lt, 0.7, 0.5) });
    hand('?!', 1420, 460, { size: 110, color: C.red, p: dp(lt, 1.3, 0.4) });
  })],
  [q.w('수학이', 24), F(280, 420, 1370, 885, (t, lt) => {
    ach(t, { x: 380, pose: 'shrug', face: 'surprised', p: dp(lt, 0, 0.6) });
    godelCard(1080, 600, 560, 200, '거짓을 증명', { size: 76, p: dp(lt, 0.2, 0.5) });
    hand('수학이', 1080, 455, { size: 52, color: C.dim, p: dp(lt, 0.3, 0.4) });
    cross(820, 490, 520, 220, { p: dp(lt, 0.9, 0.6), lw: 9 });
  })],
  // 25 — maths does not prove falsehoods, so G cannot be proved
  [q.s(25), F(390, 370, 1430, 885, (t, lt) => {
    tor(t, { x: 480, pose: 'point', face: 'smile' });
    godelFork(1100, 860, 2.2, {});
    cross(1115, 425, 290, 80, { p: dp(lt, 0.4, 0.5) });
    ring(968, 574, 150, 52, { p: dp(lt, 1.6, 0.6) });
  })],
  // 26 — which is exactly what G says: so G is true
  [q.s(26), F(480, 220, 1320, 810, (t, lt) => {
    hand('증명 불가', 600, 260, { size: 60, p: dp(lt, 0, 0.5) });
    inkArrow(700, 300, 980, 410, { via: [880, 300], p: dp(lt, 0.4, 0.6), w: 5, color: KEY() });
    godelG(1000, 480, { p: dp(lt, 0.2, 0.5) });
    underline(1100 - 190, 1100 + 190, 530, { p: dp(lt, 1, 0.4), color: KEY() });
    const Tc = q.w('참이에요', 26);
    hand('참', 1000, 720, { size: 130, color: C.green, p: dp(t, Tc, 0.4) });
    ring(1000, 720, 110, 80, { color: C.green, p: dp(t, Tc + 0.3, 0.5) });
  })],
  // 27 — true but unprovable
  [q.s(27), F(330, 190, 1390, 885, (t, lt) => godelBoard(lt, (cx, cy, p) => {
    hand('참', cx - 210, cy, { size: 120, color: C.green, p: clamp01(p * 3) });
    eqSign(cx, cy, { p: clamp01(p * 3 - 1) });
    inkLine(cx + 22, cy - 46, cx - 22, cy + 46, { p: clamp01(p * 3 - 1.5), w: 7, color: C.red });
    hand('증명', cx + 220, cy, { size: 120, p: clamp01(p * 3 - 2) });
  }, { fig: { shell: true, s: 0.9 } }))],
  // 28 — Achilles: "how do we know it is true?"
  [q.s(28), F(560, 320, 1590, 885, (t, lt) => {
    ach(t, { x: 700, pose: 'facepalm', face: 'worried', p: dp(lt, 0, 0.8) });
    hand('?', 600, 470, { size: 70, color: C.red, p: dp(lt, 0.6, 0.3) });
    bubble(880, 330, 660, 180, { tail: [780, 540], text: '참인 걸 어떻게 알아?', size: 56, p: dp(lt, 0.8, 0.5) });
    tor(t, { x: 1500, face: 'neutral', p: dp(lt, 0.3, 0.8) });
  })],
  // 29 — Tortoise: "we stood outside the system, like with MU"
  [q.s(29), F(440, 290, 1440, 885, (t, lt) => {
    ach(t, { x: 520, face: 'surprised', look: 1, p: dp(lt, 0, 0.6) });
    tor(t, { x: 1340, pose: 'present', flip: true, face: 'smile', p: dp(lt, 0, 0.8) });
    bubble(640, 300, 740, 200, { tail: [1300, 560], text: ['체계 밖에서 봤잖아', 'MU 때처럼'], size: 54, p: dp(lt, 0.5, 0.5) });
  })],
  // 30 — inside you can't make it; from outside you see it is true
  [q.s(30), F(220, 340, 1700, 885, (t, lt) => {
    inkLine(220, 880, 1700, 880, { w: 3, color: C.dim, p: dp(lt, 0, 0.5) });
    inkRect(1040, 470, 70, 410, { p: dp(lt, 0.1, 0.6), w: 4.4, fill: mix(C.orange, 0.3) });
    for (let i = 1; i < 8; i++) inkLine(1040, 470 + i * 51, 1110, 470 + i * 51, { p: dp(lt, 0.3 + i * 0.05, 0.3), w: 2.4 });
    hand('안', 520, 400, { size: 70, color: C.dim, p: dp(lt, 0.4, 0.4) });
    hand('밖', 1520, 400, { size: 70, color: C.dim, p: dp(lt, 0.5, 0.4) });
    godelCard(860, 640, 200, 110, 'G', { size: 80, color: KEY(), p: dp(lt, 0.5, 0.5) });
    inkLine(860, 695, 860, 880, { w: 4, p: dp(lt, 0.6, 0.4) });
    godelCard(330, 830, 120, 90, '0=0', { size: 36, p: dp(lt, 0.6, 0.4) });
    godelCard(480, 830, 120, 90, '1=1', { size: 36, p: dp(lt, 0.7, 0.4) });
    const at = godelSteps([[320, 760], [530, 790], [680, 770]], { p: dp(lt, 0.8, 1.5), gap: 40 });
    figure(at[0], at[1] + 40, { s: 0.4, face: 'worried', walk: dp(lt, 0.8, 1.5) < 1 ? 1 : 0, t: lt });
    cross(735, 760, 50, 50, { p: dp(lt, 2.4, 0.4) });
    prop('ladder', 1260, 880, 1.9, { p: dp(lt, 0.6, 0.6) });
    tor(t, { x: 1260, y: 880 - 36 * 1.9 * 4, s: 0.7, look: -1, face: 'happy', p: dp(lt, 0.8, 0.8) });
    const To = q.w('밖에서', 30);
    inkArrow(1220, 420, 960, 600, { p: dp(t, To, 0.6), w: 4, color: KEY(), dash: [12, 10] });
    hand('참', 860, 530, { size: 72, color: C.green, p: dp(t, To + 0.5, 0.4) });
  })],
  // 31 — 1931: the incompleteness theorem
  [q.s(31), F(330, 190, 1390, 885, (t, lt) => {
    teach('불완전성 정리', { y: 720, p: dp(lt, 0, 1.2), t: lt, fig: { glasses: true } });
    hand('1931', 1290, 245, { size: 50, color: C.dim, p: dp(lt, 1, 0.5) });
  })],
  // 32 — the theorem as three conditions and a conclusion
  [q.s(32), F(320, 410, 1570, 885, (t, lt) => {
    figure(420, GROUND, { pose: 'present', face: 'smile', glasses: true, t: lt, p: dp(lt, 0, 0.8) });
    const items = ['1. 규칙이 분명', '2. 덧셈 · 곱셈', '3. 거짓 증명 안 함'];
    const pt = 0.25 * dp(lt, 0.2, 0.5) + 0.25 * dp(lt, 0.9, 0.6) + 0.25 * dp(t, q.w('덧셈과', 32), 0.6);
    scrollList(760, 420, 800, '조건 셋', items, { size: 54, p: 0.2 * dp(lt, 0, 0.4) + 0.8 * pt });
  })],
  [q.wx('그', 32), F(170, 210, 1600, 710, (t, lt) => {
    const items = ['1. 규칙이 분명', '2. 덧셈 · 곱셈', '3. 거짓 증명 안 함'];
    scrollList(180, 260, 560, '조건 셋', items, { size: 40, p: 0.2 + 0.8 * (0.75 + 0.25 * dp(lt, 0.2, 0.7)) });
    const Tb = q.w('반드시', 32);
    inkArrow(770, 400, 900, 400, { p: dp(t, Tb - 0.6, 0.5), w: 5, color: KEY() });
    inkRect(930, 220, 660, 480, { p: dp(t, Tb - 0.4, 0.6), w: 4.4 });
    hand('체계', 1000, 262, { size: 44, color: C.dim, p: dp(t, Tb - 0.2, 0.4) });
    godelCard(1260, 380, 300, 130, 'G', { size: 96, color: KEY(), p: dp(t, Tb, 0.5) });
    hand('참', 1110, 530, { size: 64, color: C.green, p: dp(t, Tb + 0.6, 0.4) });
    godelTick(1190, 530, { p: dp(t, Tb + 0.8, 0.3) });
    hand('증명', 1410, 530, { size: 64, p: dp(t, Tb + 1, 0.4) });
    cross(1350, 490, 120, 80, { p: dp(t, Tb + 1.3, 0.4) });
    hand('반드시', 1260, 640, { size: 60, p: dp(t, Tb + 0.3, 0.5) });
  })],
  // 33 — the perfect phonograph and the record that breaks it
  [q.s(33), F(270, 350, 1370, 870, (t, lt) => {
    const Tb = q.w('부수는', 33), sh = dp(t, Tb, 0.3) * (1 - dp(t, Tb + 2.2, 0.5)) * 6 * Math.sin(t * 42);
    hand('완벽한 전축', 520, 560, { size: 60, p: dp(lt, 0.3, 0.6) });
    crab(420, 860, { s: 0.8, t, p: dp(lt, 0, 0.6) });
    ctx.save(); ctx.translate(sh, 0);
    prop('phonograph', 1080, 820, 2, { p: dp(lt, 0, 0.8), fill: mix(C.orange, 0.3) });
    inkEllipse(1060, 680, 150, 30, { p: dp(lt, 0.6, 0.4), fill: INK() });
    hand('G', 1060, 682, { size: 40, color: C.paper, p: dp(lt, 0.9, 0.3) });
    inkPoly([[900, 760], [960, 790], [940, 815], [1010, 800]], { p: dp(t, Tb + 0.2, 0.3), w: 5, color: C.red });
    inkPoly([[1250, 720], [1210, 760], [1240, 780], [1200, 815]], { p: dp(t, Tb + 0.4, 0.3), w: 5, color: C.red });
    inkPoly([[1270, 520], [1230, 560], [1265, 590], [1235, 640]], { p: dp(t, Tb + 0.6, 0.3), w: 5, color: C.red });
    ctx.restore();
  })],
  // 34 — like the MU puzzle: step out of the game and look at all of it
  [q.s(34), F(270, 200, 1750, 800, (t, lt) => {
    inkRect(280, 330, 520, 310, { p: dp(lt, 0, 0.6), w: 4.4 });
    tiles('MIU', 540, 485, { size: 80, p: dp(lt, 0.4, 0.5) });
    prop('eye', 850, 330, 0.6, { p: dp(lt, 0.7, 0.5) });
    hand('MU 퍼즐', 540, 690, { size: 52, color: C.dim, p: dp(lt, 0.6, 0.4) });
    eqSign(960, 485, { p: dp(lt, 1, 0.4) });
    inkRect(1120, 330, 520, 310, { p: dp(lt, 1.2, 0.6), w: 4.4 });
    godelCard(1380, 485, 260, 130, 'G', { size: 90, color: KEY(), p: dp(lt, 1.5, 0.5) });
    prop('eye', 1690, 330, 0.6, { p: dp(lt, 1.8, 0.5) });
    hand('G', 1380, 690, { size: 52, color: C.dim, p: dp(lt, 1.7, 0.4) });
    hand('닮았다', 960, 770, { size: 60, p: dp(lt, 2.2, 0.5) });
  })],
  [q.w('게임', 34), F(230, 290, 1730, 885, (t, lt) => {
    inkRect(240, 300, 900, 520, { w: 4.4, fill: mix(C.paper, 0.4), p: dp(lt, 0, 0.5) });
    tiles('MI', 420, 400, { size: 60 }); tiles('MIU', 760, 480, { size: 60 }); tiles('MIIU', 520, 620, { size: 60 }); tiles('MII', 940, 700, { size: 60 });
    const m = smooth(dp(lt, 0.4, 1.6));
    ach(t, { x: lerp(960, 1380, m), y: 790 + 90 * m, s: 0.8, walk: m > 0 && m < 1 ? 1 : 0, face: 'happy', look: -1 });
    tor(t, { x: 1640, pose: 'point', flip: true, face: 'smile', p: dp(lt, 0.3, 0.6) });
    hand('게임 밖', 1500, 340, { size: 64, p: dp(lt, 1.6, 0.5) });
  })],
]); };

// ===== 7 · incomplete: the hole that cannot be filled =====
// a paper card with a short handwritten line, centred on (x, y)
function incompleteCard(x, y, w, h, str, { p = 1, a = 1, size = 46, color = null, fill = null } = {}) {
  inkRect(x - w / 2, y - h / 2, w, h, { p, a, w: 4, fill: fill || C.paper });
  if (str) hand(str, x, y + 2, { size, p: clamp01((p - 0.45) / 0.55), a, color: color || INK() });
}
// "G" with an optional small index (G2, G3 …)
function incompleteG(x, y, n, { size = 80, p = 1, a = 1, color = null } = {}) {
  hand('G', x - (n ? size * 0.12 : 0), y, { size, p, a, color: color || KEY() });
  if (n) hand(String(n), x + size * 0.32, y + size * 0.28, { size: size * 0.5, p, a, color: color || KEY() });
}
// a brick wall (x, y top left); rows draw on in turn
function incompleteWall(x, y, w, h, { p = 1, a = 1, bh = 50, bw = 120 } = {}) {
  inkRect(x, y, w, h, { p: clamp01(p * 2), a, w: 4.4, fill: mix(C.orange, 0.22) });
  const rows = Math.floor(h / bh);
  for (let r = 1; r < rows + 1; r++) {
    const q = clamp01(p * rows * 1.2 - r * 0.8); if (q <= 0) continue;
    const yy = y + r * bh;
    if (r < rows) inkLine(x, yy, x + w, yy, { p: q, a, w: 2.2, color: C.dim });
    for (let xx = x + (r % 2 ? bw / 2 : bw); xx < x + w - 10; xx += bw) inkLine(xx, yy - bh, xx, yy, { p: q, a, w: 2.2, color: C.dim });
  }
}
// a jagged hole (dark) with a label, and an optional patch over it (patch = 0..1)
function incompleteHole(x, y, r, { p = 1, a = 1, label = null, n = 0, patch = 0 } = {}) {
  if (p > 0) {
    const pts = []; for (let i = 0; i < 14; i++) { const ang = (i / 14) * Math.PI * 2, rr = r * (0.82 + 0.22 * Math.sin(i * 2.7 + x * 0.01)); pts.push([x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.8]); }
    inkPath(pts, { closed: true, p, a, w: 4, fill: INK() });
    if (label) incompleteG(x, y + 4, n, { size: r * 0.9, p: clamp01(p * 2 - 1), a, color: C.paper });
  }
  if (patch > 0) {
    const s = 0.7 + 0.3 * backOut(patch);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-0.08);
    inkRect(-r * 1.15, -r * 0.95, r * 2.3, r * 1.9, { a: a * clamp01(patch * 3), w: 4, fill: mix(C.paper, 1) });
    for (let i = -2; i <= 2; i++) { inkLine(-r * 1.15 + 4, i * r * 0.36, -r * 1.15 + 18, i * r * 0.36 + 6, { a: a * clamp01(patch * 3), w: 2.4, color: C.dim }); inkLine(r * 1.15 - 18, i * r * 0.36, r * 1.15 - 4, i * r * 0.36 + 6, { a: a * clamp01(patch * 3), w: 2.4, color: C.dim }); }
    ctx.restore();
  }
}
// a system as a box of small cards; extra = draw-on of a G card added inside
function incompleteSystem(x, y, w, h, { p = 1, a = 1, label = '체계', g = 0, gn = 0 } = {}) {
  inkRect(x - w / 2, y - h / 2, w, h, { p, a, w: 4.4, fill: mix(C.paper, 0.35) });
  const q = clamp01(p * 2 - 1);
  for (const [dx, dy, s] of [[-0.25, -0.2, '0=0'], [0.2, -0.22, '1+1'], [-0.2, 0.18, '×'], [0.22, 0.2, '…']]) incompleteCard(x + dx * w, y + dy * h, w * 0.3, h * 0.22, s, { p: q, a, size: Math.min(36, h * 0.12) });
  if (g > 0) { inkCircle(x, y, Math.min(w, h) * 0.16, { p: g, a, w: 4, fill: C.paper }); incompleteG(x, y + 2, gn, { size: Math.min(w, h) * 0.2, p: g, a }); }
  if (label) hand(label, x, y + h / 2 + 50, { size: 50, p: q, a, color: C.dim });
}
// a tall building on a few blocks (the dream of a complete mathematics); crack = draw-on of a red crack
function incompleteTower(x, y, s, { p = 1, a = 1, crack = 0, labels = true } = {}) {
  const bw = 140 * s, bh = 90 * s;
  for (let i = 0; i < 3; i++) {
    inkRect(x - 1.5 * bw + i * bw, y - bh, bw, bh, { p: clamp01(p * 3 - i * 0.3), a, w: 4, fill: mix(C.grey, 0.3) });
    if (labels) hand('규칙', x - bw + i * bw, y - bh / 2, { size: 34 * s, p: clamp01(p * 3 - 1), a, color: INK() });
  }
  const tw = 300 * s, th = 480 * s, ty = y - bh - th;
  inkRect(x - tw / 2, ty, tw, th, { p: clamp01(p * 2 - 0.5), a, w: 4.4, fill: mix(C.paper, 0.7) });
  for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) inkRect(x - tw / 2 + 30 * s + c * 90 * s, ty + 30 * s + r * 75 * s, 60 * s, 45 * s, { p: clamp01(p * 3 - 1.5 - r * 0.15), a, w: 2.6 });
  inkPoly([[x - tw / 2 - 10 * s, ty], [x, ty - 70 * s], [x + tw / 2 + 10 * s, ty]], { p: clamp01(p * 3 - 2), a, w: 4 });
  if (crack > 0) inkPoly([[x + 20 * s, ty - 50 * s], [x - 20 * s, ty + 60 * s], [x + 30 * s, ty + 140 * s], [x - 10 * s, ty + 230 * s], [x + 40 * s, ty + 330 * s]], { p: crack, a, w: 6, color: C.red });
}
// zoom a shot so its content box (x0, y0)-(x1, y1) fills the safe frame (x 80..1840, y 110..880), at most kmax
const incompleteFit = (x0, y0, x1, y1, fn, kmax = 1.5) => (t, lt) => {
  const k = Math.min(kmax, 1760 / (x1 - x0), 770 / (y1 - y0));
  ctx.save(); ctx.translate(960, 495); ctx.scale(k, k); ctx.translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
  fn(t, lt); ctx.restore();
};
// the recap: four panels in a 2 x 2 grid (screen coordinates), ps = draw-on of each
function incompleteRecap(t, ps, { ringAt = -1, ringP = 0 } = {}) {
  const caps = ['글자 게임', '뜻', '번호 붙은 문장', '구멍'], w = 680, h = 340;
  ps.forEach((p, i) => {
    if (p <= 0) return;
    const x0 = [250, 990][i % 2], y0 = [120, 520][i >> 1], cx = x0 + w / 2, cy = y0 + h / 2 + 30;
    inkRect(x0, y0, w, h, { p: clamp01(p * 2), w: 4, fill: mix(C.paper, 0.45) });
    hand(String(i + 1), x0 + 36, y0 + 44, { size: 44, color: C.dim, p: clamp01(p * 2) });
    hand(caps[i], cx, y0 + 50, { size: 54, p: clamp01(p * 2 - 0.4) });
    const q = clamp01(p * 2 - 0.8);
    if (i === 0) { tiles('MIU', cx - 120, cy + 10, { size: 90, p: q }); hand('xI → xIU', cx + 170, cy + 10, { size: 48, color: INK(), p: q }); }
    if (i === 1) { pqString(2, 3, 5, cx, cy - 20, { p: q, s: 0.8 }); hand('2 + 3 = 5', cx, cy + 80, { size: 56, color: C.green, p: q }); }
    if (i === 2) {
      incompleteCard(cx, cy + 40, 380, 110, '', { p: q });
      hand('G', cx - 140, cy + 44, { size: 76, p: q }); hand('#310…', cx + 40, cy + 44, { size: 50, color: INK(), p: q });
      inkArrow(cx + 160, cy - 20, cx - 140, cy - 18, { via: [cx, cy - 120], p: clamp01(q * 1.5 - 0.5), w: 4.4, color: KEY(), head: 20 });
    }
    if (i === 3) { incompleteWall(cx - 220, cy - 100, 440, 220, { p: q, bh: 44, bw: 88 }); incompleteHole(cx, cy + 10, 62, { p: clamp01(q * 2 - 1), label: true }); }
  });
  if (ringAt >= 0) ring([250, 990][ringAt % 2] + w / 2, [120, 520][ringAt >> 1] + h / 2, w / 2 + 10, h / 2 + 14, { p: ringP });
}
function incompleteTick(x, y, p) { inkPoly([[x - 26, y], [x - 6, y + 22], [x + 30, y - 26]], { p, w: 7, color: C.green }); }

SCENES.incomplete = (t, q) => { const F = incompleteFit; return shots(t, [
  // 0 — Achilles: "then just add G as a rule!"
  [q.s(0), F(450, 320, 1630, 885, (t, lt) => {
    ach(t, { x: 640, pose: 'cheer', face: 'happy', p: dp(lt, 0, 0.8) });
    prop('bulb', 500, 470, 0.7, { p: dp(lt, 0.5, 0.4) });
    tor(t, { x: 1540, flip: true, face: 'neutral', p: dp(lt, 0.3, 0.8) });
    bubble(800, 330, 620, 170, { tail: [720, 520], text: 'G를 규칙으로!', size: 70, p: dp(lt, 1.2, 0.5) });
  })],
  // 1 — G is like a hole in the system; fill it and we're done?
  [q.s(1), F(310, 370, 1690, 885, (t, lt) => {
    incompleteWall(760, 380, 740, 480, { p: dp(lt, 0, 1.2) });
    incompleteHole(1130, 620, 90, { p: dp(lt, 1, 0.6), label: true });
    hand('구멍', 1610, 450, { size: 66, p: dp(lt, 1.6, 0.5) });
    inkArrow(1590, 490, 1220, 590, { p: dp(lt, 1.9, 0.5), w: 5, color: KEY() });
    tor(t, { x: 400, face: 'think', look: 1, p: dp(lt, 0.2, 0.8) });
  })],
  [q.w('이번', 1), F(330, 360, 1510, 885, (t, lt) => {
    incompleteWall(760, 380, 740, 480, {});
    incompleteHole(1130, 620, 90, { label: true });
    ach(t, { x: 420, pose: 'reach', face: 'happy', p: dp(lt, 0, 0.6) });
    ctx.save(); ctx.translate(lerp(580, 700, dp(lt, 0.5, 1)), 660); ctx.rotate(-0.1);
    inkRect(-70, -55, 140, 110, { w: 4, fill: C.paper, p: dp(lt, 0.3, 0.5) }); ctx.restore();
    hand('메우면?', 640, 410, { size: 70, p: dp(lt, 1, 0.6) });
  })],
  // 2 — adding G gives a stronger new system
  [q.s(2), F(210, 200, 1610, 730, (t, lt) => {
    incompleteSystem(380, 470, 320, 280, { p: dp(lt, 0, 0.8) });
    const Ts = q.w('출발점에', 2), Tn = q.w('새', 2);
    plusSign(640, 470, { p: dp(t, Ts, 0.4) });
    incompleteCard(800, 470, 150, 150, '', { p: dp(t, Ts + 0.2, 0.5) }); incompleteG(800, 474, 0, { size: 100, p: dp(t, Ts + 0.4, 0.4) });
    eqSign(990, 470, { p: dp(t, Tn - 0.4, 0.4) });
    incompleteSystem(1380, 470, 440, 360, { p: dp(t, Tn - 0.2, 0.8), label: '새 체계', g: dp(t, Tn + 0.4, 0.5) });
    hand('힘 +', 1380, 245, { size: 56, color: C.green, p: dp(t, Tn + 0.4, 0.35) });
  })],
  // 3 — Gödel's method works again: a new G for the new system
  [q.s(3), F(300, 250, 1470, 885, (t, lt) => {
    figure(400, GROUND, { pose: 'reach', face: 'wink', glasses: true, t: lt, p: dp(lt, 0, 0.8) });
    hand('괴델의 방법', 400, 480, { size: 50, color: C.dim, p: dp(lt, 0.5, 0.5) });
    incompleteSystem(1180, 470, 560, 420, { label: '새 체계', g: 1, p: dp(lt, 0.2, 0.6) });
    for (let i = 0; i < 4; i++) {
      const u = smooth(dp(lt, 1 + i * 0.3, 0.6));
      const tx = lerp(540, [1000, 1340, 1010, 1350][i], u), ty = lerp(680, [350, 345, 540, 545][i], u);
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(-0.2 + i * 0.12);
      inkRect(-26, -20, 52, 40, { w: 3, fill: mix(C.yellow, 0.4), p: dp(lt, 1 + i * 0.3, 0.2) }); hand(String(i + 1), 0, 2, { size: 30, color: INK(), p: dp(lt, 1 + i * 0.3, 0.2) });
      ctx.restore();
    }
  })],
  [q.w('새로운', 3), F(570, 200, 1590, 810, (t, lt) => {
    incompleteSystem(960, 470, 760, 520, { label: '새 체계', g: 1 });
    const x = 1340, y = 470;
    inkCircle(x, y, 62, { p: dp(lt, 0, 0.4), w: 4, fill: INK() });
    incompleteG(x, y + 4, 2, { size: 76, p: dp(lt, 0.3, 0.4), color: C.paper });
    ring(x, y, 100, 90, { p: dp(lt, 0.7, 0.6) });
    hand('새 G', 1480, 330, { size: 64, p: dp(lt, 0.9, 0.5) });
  })],
  // 4 — like the Crab's new phonographs and the Tortoise's new records
  [q.s(4), F(200, 390, 1470, 885, (t, lt) => {
    crab(380, 860, { s: 1, t, p: dp(lt, 0, 0.6) });
    prop('phonograph', 720, 860, 1.4, { p: dp(lt, 0.3, 0.7), fill: mix(C.orange, 0.3) });
    hand('새 전축', 640, 450, { size: 54, p: dp(lt, 0.8, 0.5) });
    const Tg = q.w('거북이가', 4);
    tor(t, { x: 1380, pose: 'hold', flip: true, face: 'wink', p: dp(t, Tg - 0.4, 0.7) });
    prop('record', 1240, 780, 0.75, { p: dp(t, Tg, 0.4) });
    hand('새 음반', 1340, 420, { size: 54, p: dp(t, Tg + 0.4, 0.5) });
    ctx.save(); ctx.translate(1010, 560); ctx.rotate(t * 1.5); prop('loop', 0, 63, 0.7, { p: dp(t, Tg + 0.6, 0.5), color: C.dim }); ctx.restore();
  })],
  // 5 — fill a hole, a new one opens one floor up: an endless staircase
  [q.s(5), F(250, 170, 1670, 880, (t, lt) => {
    incompleteWall(260, 180, 1400, 690, { p: dp(lt, 0, 0.5), bh: 46, bw: 100 });
    const H = [[440, 760], [740, 620], [1040, 480], [1340, 340]];
    H.forEach(([x, y], k) => {
      const t0 = 0.4 + k * 1.1;
      incompleteHole(x, y, 70, { p: dp(lt, t0, 0.4), label: true, n: k + 1 });
      if (k < 3) incompleteHole(x, y, 70, { p: 0, patch: dp(lt, t0 + 0.7, 0.4) });
      if (k < 3) inkArrow(x + 60, y - 70, H[k + 1][0] - 70, H[k + 1][1] + 30, { p: dp(lt, t0 + 0.8, 0.4), w: 5, color: KEY(), dash: [10, 8] });
    });
    hand('…', 1560, 250, { size: 100, color: INK(), p: dp(lt, 4.6, 0.4) });
    const Te = q.w('끝이', 5);
    incompleteCard(600, 300, 400, 110, '', { p: dp(t, Te, 0.4) });
    hand('끝없는 계단', 600, 302, { size: 66, p: dp(t, Te + 0.2, 0.6) });
  })],
  // 6 — so the answer is no: no perfect system holds every truth
  [q.s(6), F(760, 400, 1160, 885, (t, lt) => {
    tor(t, { x: 960, face: 'neutral', look: Math.sin(lt * 6) * dp(lt, 0.5, 0.3) * (1 - dp(lt, 2.2, 0.3)), p: dp(lt, 0, 0.8) });
    hand('아니요', 960, 480, { size: 120, color: C.red, p: dp(lt, 0.4, 0.6) });
  })],
  [q.w('완벽한', 6), F(620, 140, 1300, 750, (t, lt) => {
    incompleteSystem(960, 450, 640, 440, { label: '완벽한 체계', p: dp(lt, 0, 0.6) });
    hand('모든 참', 960, 180, { size: 56, p: dp(lt, 0.4, 0.5) });
    cross(640, 230, 640, 440, { p: dp(lt, 1, 0.6), lw: 9 });
  })],
  // 7 — a look back at the road
  [q.s(7), F(200, 430, 1560, 885, (t, lt) => {
    const path = [[1300, 840], [1100, 760], [880, 800], [640, 700], [420, 740], [220, 640]];
    inkPath(path, { p: dp(lt, 0, 0.8), w: 4, color: C.dim, dash: [14, 10] });
    [[1100, 760], [880, 800], [640, 700], [420, 740]].forEach(([x, y], i) => inkCircle(x, y, 16, { p: dp(lt, 0.3 + i * 0.2, 0.3), w: 4, fill: KEY() }));
    figure(1480, GROUND, { flip: true, look: -1, face: 'smile', pose: 'stand', p: dp(lt, 0, 0.6) });
    hand('돌아보기', 1480, 470, { size: 58, p: dp(lt, 0.6, 0.5) });
  })],
  // 8, 9 — recap in four panels: game, meaning, numbered sentence, hole
  [q.s(8), (t, lt) => incompleteRecap(t, [dp(lt, 0, 1), dp(t, q.w('짝을', 8), 1), 0, 0])],
  [q.s(9), (t, lt) => incompleteRecap(t, [1, 1, dp(lt, 0, 1.2), 0])],
  [q.w('그리고', 9), (t, lt) => incompleteRecap(t, [1, 1, 1, dp(lt, 0, 1.2)], { ringAt: 3, ringP: dp(lt, 1.6, 0.6) })],
  // 10 — one question left: how does this loop become "I"?
  [q.s(10), F(440, 330, 1460, 885, (t, lt) => {
    ctx.save(); ctx.translate(560, 460); ctx.rotate(t * 1.2); prop('loop', 0, 144, 1.6, { p: dp(lt, 0, 0.6) }); ctx.restore();
    hand('고리', 560, 700, { size: 54, color: C.dim, p: dp(lt, 0.4, 0.4) });
    inkArrow(780, 460, 1120, 460, { p: dp(lt, 0.8, 0.6), w: 5, color: KEY() });
    hand('?', 950, 380, { size: 90, color: C.red, p: dp(lt, 1.2, 0.3) });
    figure(1360, GROUND, { pose: 'think', face: 'think', p: dp(lt, 1, 0.8) });
    hand('나', 1360, 470, { size: 90, p: dp(lt, 1.8, 0.4) });
  })],
  // 11 — the news shocked the mathematicians
  [q.s(11), F(530, 430, 1390, 885, (t, lt) => {
    figure(620, GROUND, { s: 0.85, face: 'surprised', glasses: true, pose: 'shrug', p: dp(lt, 0, 0.5) });
    figure(960, GROUND, { s: 0.85, face: 'surprised', tie: true, pose: 'hold', p: dp(lt, 0.1, 0.5) });
    prop('paper', 960, 830, 0.6, { p: dp(lt, 0.3, 0.4) });
    hand('1931', 960, 760, { size: 40, p: dp(lt, 0.6, 0.3) });
    figure(1300, GROUND, { s: 0.85, face: 'surprised', hair: true, pose: 'facepalm', p: dp(lt, 0.2, 0.5) });
    for (const x of [620, 960, 1300]) hand('!', x, 480, { size: 80, color: C.red, p: dp(lt, 0.8, 0.2) });
  })],
  // 12 — the dream: all of maths on a few rules, no gaps
  [q.s(12), F(320, 230, 1660, 885, (t, lt) => {
    figure(420, GROUND, { pose: 'think', face: 'happy', glasses: true, p: dp(lt, 0, 0.6) });
    bubble(620, 250, 600, 440, { kind: 'thought', tail: [480, 540], p: dp(lt, 0.4, 0.5), body: (x, y, w, h) => incompleteTower(x + w / 2, y + h - 20, 0.6, { p: dp(lt, 0.8, 1.6), labels: false }) });
    hand('수학자들의 꿈', 1480, 780, { size: 56, p: dp(lt, 1.4, 0.6) });
  })],
  [q.w('빈틈없이', 12), F(320, 130, 1600, 865, (t, lt) => {
    incompleteTower(960, 860, 1.12, { p: dp(lt, 0, 1), crack: dp(t, q.e(12) - 1.2, 0.6) });
    hand('빈틈없이', 460, 380, { size: 70, p: dp(lt, 0.4, 0.6) });
    hand('수학 전체', 1460, 380, { size: 56, color: C.dim, p: dp(lt, 0.8, 0.5) });
  })],
  // 13 — two common misreadings
  [q.s(13), F(330, 190, 1390, 885, (t, lt) => teach('흔한 오해 둘', { y: 720, p: dp(lt, 0, 1.2), t: lt, face: 'wink' }))],
  // 14 — misreading 1: "maths can't be trusted" — no
  [q.s(14), F(290, 350, 1510, 885, (t, lt) => {
    hand('첫째', 380, 430, { size: 64, color: C.dim, p: dp(lt, 0, 0.3) });
    figure(480, GROUND, { face: 'worried', pose: 'shrug', p: dp(lt, 0, 0.6) });
    bubble(680, 360, 820, 200, { tail: [580, 580], text: '수학은 믿을 수 없다', size: 62, p: dp(lt, 0.4, 0.5) });
    cross(740, 350, 700, 220, { p: dp(t, q.w('아니에요', 14), 0.6), lw: 9 });
  })],
  // 15 — proved theorems stay solid; some truths are just out of reach
  [q.s(15), F(290, 180, 1520, 870, (t, lt) => {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3 - r; c++) inkRect(560 + c * 160 + r * 80, 780 - r * 80, 150, 80, { p: dp(lt, 0.1 * (r * 3 + c), 0.4), w: 4, fill: mix(C.grey, 0.35) });
    hand('증명된 정리', 420, 820, { size: 50, color: C.dim, p: dp(lt, 0.8, 0.5) });
    hand('단단', 1260, 700, { size: 70, p: dp(lt, 1, 0.5) });
    incompleteTick(1260, 790, dp(lt, 1.3, 0.3));
    const Td = q.w('다만', 15);
    prop('ladder', 800, 620, 0.9, { p: dp(t, Td, 0.5) });
    prop('star', 1000, 330, 0.8, { p: dp(t, Td + 0.4, 0.4) });
    hand('닿지 않는 참', 1340, 280, { size: 56, p: dp(t, Td + 0.8, 0.6) });
    ring(1000, 270, 90, 80, { p: dp(t, Td + 1.2, 0.6) });
  })],
  // 16 — misreading 2: "so nothing can be known" — no
  [q.s(16), F(290, 350, 1510, 885, (t, lt) => {
    hand('둘째', 380, 430, { size: 64, color: C.dim, p: dp(lt, 0, 0.3) });
    figure(480, GROUND, { face: 'sad', pose: 'shrug', p: dp(lt, 0, 0.6) });
    bubble(680, 360, 820, 200, { tail: [580, 580], text: '모든 건 알 수 없다', size: 62, p: dp(lt, 0.4, 0.5) });
    cross(740, 350, 700, 220, { p: dp(t, q.w('아니에요', 16), 0.6), lw: 9 });
  })],
  // 17 — a precise theorem: formal systems with + and ×, not love or politics
  [q.s(17), F(240, 230, 1710, 820, (t, lt) => {
    inkRect(620, 240, 680, 460, { p: dp(lt, 0, 0.7), w: 5, fill: mix(C.paper, 0.4) });
    hand('덧셈 + 곱셈', 960, 300, { size: 58, p: dp(t, q.w('덧셈과', 17), 0.6) });
    hand('+  ×  =', 960, 420, { size: 70, color: INK(), p: dp(lt, 0.5, 0.5) });
    incompleteCard(960, 560, 200, 110, 'G', { size: 80, color: KEY(), p: dp(lt, 0.7, 0.5) });
    hand('정확한 이야기', 960, 790, { size: 54, color: C.dim, p: dp(lt, 0.3, 0.5) });
    const Tl = q.w('연애나', 17);
    prop('heart', 340, 600, 1.2, { p: dp(t, Tl, 0.4) });
    hand('연애', 340, 680, { size: 50, color: C.dim, p: dp(t, Tl + 0.2, 0.4) });
    cross(250, 420, 180, 180, { p: dp(t, Tl + 0.5, 0.4) });
    prop('flag', 1560, 640, 1.2, { p: dp(t, Tl + 0.5, 0.4) });
    hand('정치', 1600, 700, { size: 50, color: C.dim, p: dp(t, Tl + 0.7, 0.4) });
    cross(1500, 380, 200, 220, { p: dp(t, Tl + 1, 0.4) });
  })],
  // 18 — Hofstadter saw power more than limit
  [q.s(18), F(300, 300, 1530, 885, (t, lt) => {
    figure(400, GROUND, { pose: 'think', face: 'happy', hair: true, p: dp(lt, 0, 0.6) });
    hand('호프스태터', 400, 480, { size: 46, color: C.dim, p: dp(lt, 0.4, 0.4) });
    const ang = 0.22 * smooth(dp(lt, 1, 0.8)), cx = 1120, cy = 380, L = 300;
    inkLine(cx, cy, cx, 820, { w: 5, p: dp(lt, 0.2, 0.5) }); inkLine(cx - 90, 820, cx + 90, 820, { w: 5, p: dp(lt, 0.2, 0.5) });
    const lx = cx - Math.cos(ang) * L, ly = cy - Math.sin(ang) * L, rx = cx + Math.cos(ang) * L, ry = cy + Math.sin(ang) * L;
    inkLine(lx, ly, rx, ry, { w: 5, p: dp(lt, 0.4, 0.4) });
    for (const [px, py, word, col] of [[lx, ly, '한계', INK()], [rx, ry, '힘', KEY()]]) {
      inkLine(px, py, px, py + 120, { w: 3, p: dp(lt, 0.6, 0.3) });
      inkArc(px, py + 120, 100, 44, 0, Math.PI, { w: 4, p: dp(lt, 0.7, 0.3), fill: mix(C.paper, 0.6) });
      hand(word, px, py + 80, { size: word === '힘' ? 80 : 56, color: col, p: dp(lt, 0.8, 0.4) });
    }
  })],
  // 19 — the + and × system was rich enough to mirror itself
  [q.s(19), F(340, 250, 1530, 830, (t, lt) => {
    incompleteSystem(560, 470, 420, 340, { label: '덧셈 · 곱셈', p: dp(lt, 0, 0.7) });
    prop('mirror', 1340, 820, 3, { p: dp(lt, 0.4, 0.7) });
    incompleteSystem(1340, 520, 150, 130, { label: null, p: dp(lt, 1, 0.6), a: 0.6 });
    inkArrow(800, 470, 1190, 500, { p: dp(lt, 1, 0.5), w: 4, color: KEY(), dash: [12, 10] });
    hand('풍부함', 990, 720, { size: 66, p: dp(t, q.w('풍부했던', 19), 0.6) });
  })],
  // 20 — the power to mirror itself is why it can't hold all of itself: one body
  [q.s(20), F(340, 250, 1640, 830, (t, lt) => {
    incompleteSystem(560, 470, 420, 340, { label: null });
    prop('mirror', 1340, 820, 3, {});
    incompleteSystem(1340, 520, 150, 130, { label: null, a: 0.6 });
    inkRect(1255, 445, 170, 150, { w: 3.4, color: C.red, dash: [10, 8], p: dp(lt, 0.4, 0.5) });
    hand('?', 1580, 380, { size: 90, color: C.red, p: dp(lt, 0.9, 0.3) });
    hand('전부는 못 담음', 900, 760, { size: 58, p: dp(lt, 1.2, 0.6) });
  })],
  [q.w('힘과', 20), F(480, 240, 1440, 800, (t, lt) => {
    const ph = lt * 2.4, sx = Math.cos(ph), cx = 960, cy = 440, r = 190;
    inkEllipse(cx, cy, r * Math.max(0.06, Math.abs(sx)), r, { w: 5, fill: mix(C.yellow, 0.45), p: dp(lt, 0, 0.4) });
    ctx.save(); ctx.translate(cx, cy); ctx.scale(Math.max(0.06, Math.abs(sx)), 1);
    hand(sx >= 0 ? '힘' : '한계', 0, 6, { size: sx >= 0 ? 120 : 90, color: sx >= 0 ? KEY() : INK(), p: dp(lt, 0.2, 0.3) });
    ctx.restore();
    hand('힘', 560, 440, { size: 70, p: dp(lt, 0.5, 0.4) });
    hand('한계', 1360, 440, { size: 70, color: INK(), p: dp(lt, 0.7, 0.4) });
    hand('한 몸', 960, 760, { size: 70, p: dp(lt, 1.2, 0.5) });
  })],
  // 21 — an analogy, not a proof: we think about ourselves, but never all at once
  [q.s(21), F(460, 250, 1560, 885, (t, lt) => {
    ctx.save(); ctx.translate(1440, 300); ctx.rotate(0.06);
    inkRect(-110, -50, 220, 100, { w: 3.6, fill: mix(C.yellow, 0.35), p: dp(lt, 0, 0.4) });
    hand('비유', 0, 4, { size: 54, p: dp(lt, 0.2, 0.4) }); ctx.restore();
    figure(560, GROUND, { pose: 'think', face: 'think', p: dp(lt, 0.3, 0.7) });
    bubble(740, 340, 560, 380, { kind: 'thought', tail: [620, 560], p: dp(lt, 1, 0.5), body: (x, y, w, h) => figure(x + w / 2, y + h - 50, { s: 0.75, pose: 'think', face: 'think' }) });
  })],
  [q.w('한꺼번에', 21), F(290, 200, 1520, 885, (t, lt) => {
    figure(380, GROUND, { pose: 'think', face: 'worried' });
    bubble(520, 220, 520, 440, { kind: 'thought', tail: [440, 520] });
    figure(780, 620, { s: 0.6, pose: 'think', face: 'think' });
    bubble(880, 300, 360, 280, { kind: 'thought', tail: [820, 420], p: dp(lt, 0.2, 0.4) });
    figure(1060, 540, { s: 0.38, pose: 'think', face: 'think', p: dp(lt, 0.4, 0.4) });
    bubble(1260, 330, 240, 180, { kind: 'thought', tail: [1110, 380], p: dp(lt, 0.7, 0.4), a: 0.7 });
    hand('…', 1380, 420, { size: 70, color: C.dim, p: dp(lt, 1, 0.3) });
    hand('전부는 못 봄', 1100, 780, { size: 60, p: dp(lt, 1.3, 0.6) });
  })],
  // 22 — how is "mirroring itself" possible? look inside the inside
  [q.s(22), F(540, 215, 1440, 885, (t, lt) => {
    ach(t, { x: 640, pose: 'think', face: 'think', p: dp(lt, 0, 0.7) });
    prop('mirror', 1240, 820, 3.2, { p: dp(lt, 0.3, 0.6) });
    hand('어떻게?', 880, 420, { size: 66, p: dp(lt, 0.8, 0.5) });
  })],
  [q.w('안에', 22), F(550, 120, 1630, 820, (t, lt) => {
    for (let i = 0; i < 6; i++) {
      const k = Math.pow(0.74, i);
      ctx.save(); ctx.translate(900, 470); ctx.rotate(i * 0.08 + Math.sin(t * 0.7) * 0.02 * i);
      inkRect(-300 * k, -300 * k, 600 * k, 600 * k, { p: dp(lt, i * 0.25, 0.4), w: 4.4 * Math.max(0.6, k), color: i % 2 ? KEY() : INK() });
      ctx.restore();
    }
    prop('magnifier', 1430, 640, 1.4, { p: dp(lt, 0.5, 0.5) });
    hand('안에 안', 1500, 300, { size: 70, p: dp(lt, 0.7, 0.5) });
  })],
]); };

// ---------- 8 · recursion ("이야기 속의 이야기") ----------
// a doll split at the waist; open = 0..1 lifts the top half off and tilts it
function recursionDoll(x, y, s, { p = 1, a = 1, open = 0 } = {}) {
  if (p <= 0 || a <= 0) return;
  const cut = y - 84 * s, o = smooth(open);
  ctx.save(); ctx.beginPath(); ctx.rect(x - 130 * s, cut, 260 * s, 130 * s); ctx.clip();
  prop('doll', x, y, s, { p, a });
  ctx.restore();
  inkLine(x - 52 * s, cut, x + 52 * s, cut, { p, a, w: 3 });
  ctx.save(); ctx.translate(x - 34 * s * o, cut - 72 * s * o); ctx.rotate(-0.32 * o); ctx.translate(-x, -cut);
  ctx.beginPath(); ctx.rect(x - 130 * s, cut - 230 * s, 260 * s, 234 * s); ctx.clip();
  prop('doll', x, y, s, { p, a });
  if (o > 0) inkLine(x - 52 * s, cut, x + 52 * s, cut, { p, a, w: 3 });
  ctx.restore();
}
// the nested story pages (outer to inner)
const recursionPages = [
  { x: 280, y: 130, w: 1360, h: 740, fig: [[390, 852], [525, 852]], s: 0.75 },
  { x: 640, y: 290, w: 960, h: 540, fig: [[712, 814], [800, 814]], s: 0.45 },
  { x: 940, y: 420, w: 620, h: 370, fig: [[988, 776], [1045, 776]], s: 0.28 },
];
function recursionPage(k, { p = 1, a = 1 } = {}) {
  const P = recursionPages[k];
  inkRect(P.x, P.y, P.w, P.h, { p, a, w: 4.2 - k * 0.6, fill: mix(C.paper, 0.75) });
  const q = clamp01(p * 1.6 - 0.6);
  for (let j = 0; j < 3; j++) inkLine(P.x + 70, P.y + 36 + j * 26 * (1 - k * 0.2), P.x + P.w * (0.42 - j * 0.06), P.y + 36 + j * 26 * (1 - k * 0.2), { p: q, a: a * 0.6, w: 2, color: C.dim });
  tag(String(k + 1), P.x + 36, P.y + 40 - k * 4, { a: a * q, size: 44 - k * 8 });
}
function recursionPair(k, t, { a = 1, drop = 0, face = 'smile' } = {}) {
  const P = recursionPages[k], dy = -drop * 120 * P.s;
  achilles(P.fig[0][0], P.fig[0][1] + dy, { s: P.s, t, a, face, pose: 'stand' });
  tortoise(P.fig[1][0], P.fig[1][1] + dy, { s: P.s * 0.92, t, a, face, flip: true });
}
// books lying in a stack: i = 0 bottom ('책'), 1 ('사전'), 2 ('다른 책'); ribbons hang out of the front
const recursionBookNames = ['책', '사전', '다른 책'];
function recursionBook(i, x, y, { p = 1, a = 1, dy = 0 } = {}) {
  const w = 900 - i * 100, h = 124, by = y - i * 138 + dy;
  inkRect(x - w / 2, by - h, w, h, { p, a, w: 4, fill: i === 1 ? mix(C.yellow, 0.25) : mix(C.paper, 0.85) });
  inkLine(x - w / 2 + 22, by - h, x - w / 2 + 22, by, { p, a, w: 3 });
  for (let j = 1; j < 6; j++) inkLine(x + w / 2 - 10, by - h + j * 21, x + w / 2 - 90, by - h + j * 21, { p, a: a * 0.6, w: 2, color: C.dim });
  hand(recursionBookNames[i], x - 40, by - h / 2 + 2, { size: 68, p: clamp01(p * 2 - 1), a, color: INK() });
}
function recursionRibbon(i, x, y, { p = 1, a = 1, pull = 0, to = null } = {}) {
  const w = 900 - i * 100, by = y - i * 138, hx = x + w / 2 - 190, ht = by - 100;
  const m = smooth(pull), [tx, ty] = to || [hx, ht - 200];
  const rx = lerp(hx, tx, m), top = lerp(ht, ty, m) - Math.sin(Math.PI * m) * 120;
  const col = [C.red, C.green, C.yellow][i];
  inkPath([[rx, top], [rx + 2, top + 180], [rx + 17, top + 160], [rx + 32, top + 180], [rx + 30, top]], { p, a, w: 3, color: col, fill: col, closed: true });
}
// stairs going down to the right: n steps of sw x sh from (x0, y0); the floor runs on to the right
function recursionStairs(x0, y0, n, sw, sh, { p = 1, a = 1, floor = 1, floorColor = null } = {}) {
  const pts = [[x0, y0]];
  for (let i = 0; i < n; i++) { pts.push([x0 + (i + 1) * sw, y0 + i * sh]); pts.push([x0 + (i + 1) * sw, y0 + (i + 1) * sh]); }
  pts.push([x0, y0 + n * sh]);
  inkPath(pts, { p, a, w: 4, closed: true, fill: mix(C.paper, 0.55) });
  if (floor > 0) inkLine(x0 - 20, y0 + n * sh, x0 + n * sw + sw * 1.6, y0 + n * sh, { p: clamp01(p * 2 - 1) * floor, a, w: floorColor ? 9 : 5, color: floorColor || INK() });
}
const recursionStep = (x0, y0, sw, sh, n, k) => (k >= n ? [x0 + n * sw + sw * 0.7, y0 + n * sh] : [x0 + k * sw + sw * 0.5, y0 + k * sh]);
// the two-line rule on a card
function recursionRule(x, y, w, { p1 = 1, p2 = 1, a = 1, size = 64, loop = 0 } = {}) {
  inkRect(x, y, w, 300, { p: clamp01(p1 * 3), a, w: 4, fill: mix(C.paper, 0.85) });
  tag('1', x + 50, y + 95, { a: a * clamp01(p1 * 3) });
  hand('맨 아래면 멈춘다', x + 96, y + 95, { size, p: p1, a, align: 'left' });
  tag('2', x + 50, y + 210, { a: a * clamp01(p2 * 3) });
  hand('한 칸 내려가서 다시', x + 96, y + 210, { size, p: p2, a, align: 'left' });
  if (loop > 0) inkArrow(x + w - 40, y + 230, x + w - 40, y + 110, { via: [x + w + 10, y + 170], p: loop, a, color: C.red, w: 4, head: 18 });
}
function recursionTree(x, y, len, ang, d, D, P, o) {
  const q = clamp01(P * (D + 1) - d); if (q <= 0) return;
  const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
  inkLine(x, y, x2, y2, { a: o.a, p: q, w: Math.max(2, 10 - d * 1.35) });
  if (d === D) { if (o.leaves > 0) disc(x2, y2, 8, C.green, o.a * o.leaves); return; }
  recursionTree(x2, y2, len * 0.74, ang - 0.46 + 0.04 * Math.sin(d * 3.1 + x * 0.01), d + 1, D, P, o);
  recursionTree(x2, y2, len * 0.7, ang + 0.4 + 0.05 * Math.sin(d * 1.7 + y * 0.01), d + 1, D, P, o);
}
function recursionHTree(x, y, L, d, D, horiz, P, a) {
  if (d > D) return;
  const q = clamp01(P * (D + 1) - d); if (q <= 0) return;
  const dx = horiz ? L / 2 : 0, dy = horiz ? 0 : L / 2, w = Math.max(1.8, 5 - d * 0.5);
  inkLine(x, y, x - dx, y - dy, { p: q, a, w, color: KEY() }); inkLine(x, y, x + dx, y + dy, { p: q, a, w, color: KEY() });
  recursionHTree(x - dx, y - dy, L / Math.SQRT2, d + 1, D, !horiz, P, a);
  recursionHTree(x + dx, y + dy, L / Math.SQRT2, d + 1, D, !horiz, P, a);
}
function recursionSpiral(cx, cy, r0, turns, o) {
  const pts = []; const n = Math.round(turns * 40);
  for (let i = 0; i <= n; i++) { const u = i / n, ang = u * turns * Math.PI * 2, r = r0 * (1 - u * 0.92); pts.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.62]); }
  inkPath(pts, o);
}
const recursionCheck = (x, y, o = {}) => inkPath([[x - 22, y], [x - 6, y + 18], [x + 26, y - 22]], { w: 7, color: C.green, ...o });
// the music staff with notes stepping up and down (C G D G C)
const recursionNotes = [[360, 700, 'C'], [620, 620, 'G'], [880, 540, 'D'], [1140, 620, 'G'], [1400, 700, 'C']];
function recursionStaff(p, a = 1) {
  for (let i = 0; i < 5; i++) inkLine(200, 520 + i * 40, 1600, 520 + i * 40, { p, a, w: 2.6, color: C.dim });
}
function recursionNote(i, { p = 1, a = 1 } = {}) {
  const [x, y, k] = recursionNotes[i];
  if (y >= 700) inkLine(x - 52, 700, x + 30, 700, { p, a, w: 2.6 });
  prop('note', x + 22, y + 26, 1.1, { p, a });
  hand(k, x - 18, 800, { size: 56, p, a, color: C.dim });
}

SCENES.recursion = (t, q) => shots(t, [
  // 0 a doll opens; a smaller one comes out, and opens again
  [q.s(0), (t, lt) => {
    const xs = [380, 760, 1080, 1330, 1520], ss = [2.4, 1.85, 1.4, 1.05, 0.8];
    const T = [0, 1.0, 2.7, 3.7, 4.5], O = [0.5, 2.2, 3.3, 4.2, 99];
    for (let i = 0; i < 5; i++) {
      if (lt < T[i]) continue;
      const m = i ? smooth((lt - T[i]) / 0.6) : 1;
      const x = i ? lerp(xs[i - 1], xs[i], m) : xs[0];
      recursionDoll(x, 840 - (i ? 60 * Math.sin(Math.PI * m) : 0), ss[i], { p: i ? 1 : dp(lt, 0, 0.5), a: i ? clamp01(m * 3) : 1, open: (lt - O[i]) / 0.6 });
    }
    ach(t, { x: 1745, s: 0.9, face: lt > 3 ? 'surprised' : 'smile', p: dp(lt, 0.4, 0.8) });
  }],
  // 1 the name: recursion
  [q.s(1), (t, lt) => {
    teach('재귀', { y: 700, p: dp(lt, 0, 1.2), t });
    dolls(800, 468, 5, { s: 0.46, p: dp(lt, 1.6, 1.4) });
  }],
  // 2 Achilles and the Tortoise and a story that pulls them in
  [q.s(2), (t, lt) => {
    ach(t, { x: 560, pose: 'hold', face: 'happy', s: 1.1, p: dp(lt, 0, 1) });
    tor(t, { x: 1360, pose: 'hold', flip: true, s: 1.0, p: dp(lt, 0.2, 1) });
    prop('openbook', 960, 720, 2.4, { p: dp(lt, 0.5, 1), fill: C.paper });
    recursionSpiral(960, 550, 180, 3, { p: dp(lt, 1.5, 1.6), w: 4.4, color: KEY() });
    hand('이야기 속 이야기', 960, 240, { size: 76, p: dp(lt, 2.6, 1) });
  }],
  // 3 into a story, and into a story inside it
  [q.s(3), (t, lt) => {
    const k1 = q.w('들어가고', 3), k2 = q.w('다른', 3);
    const L = t >= k2 ? 2 : t >= k1 ? 1 : 0, tl = [q.s(3), k1, k2][L];
    for (let k = 0; k < 3; k++) {
      const pk = k === 0 ? dp(lt, 0, 0.8) : dp(t, [0, k1, k2][k] - 0.4, 0.8);
      if (pk <= 0) continue;
      recursionPage(k, { p: pk });
      if (k < L) recursionPair(k, t, { a: 0.22 });
      if (k === L) recursionPair(k, t, { drop: k ? 1 - smooth((t - tl) / 0.6) : 0, a: k ? clamp01((t - tl) * 4) : dp(lt, 0.3, 0.6), face: k ? 'surprised' : 'smile' });
    }
    hand('들어가기', 1440, 210, { size: 66, p: dp(t, k1, 0.8) });
  }],
  // 4 out again, one layer at a time, in reverse
  [q.s(4), (t, lt) => {
    const L = lt < 1.3 ? 2 : lt < 2.7 ? 1 : 0, tl = [2.7, 1.3, 0][L];
    for (let k = 0; k < 3; k++) {
      recursionPage(k);
      if (k === L) recursionPair(k, t, { a: L === 2 ? 1 : clamp01((lt - tl) * 4), face: L === 0 ? 'happy' : 'smile' });
    }
    inkArrow(1000, 455, 690, 330, { via: [820, 360], p: dp(lt, 0.9, 0.6), color: C.green, w: 5 });
    inkArrow(680, 320, 330, 175, { via: [480, 220], p: dp(lt, 2.3, 0.6), color: C.green, w: 5 });
    hand('거꾸로', 1440, 210, { size: 70, p: dp(lt, 0.3, 0.7) });
  }],
  // 5 a book, an unknown word
  [q.s(5), (t, lt) => {
    ach(t, { x: 720, pose: 'hold', s: 1.25, face: lt > 1.2 ? 'think' : 'smile', p: dp(lt, 0, 0.8) });
    prop('openbook', 722, 760, 1.2, { p: dp(lt, 0.3, 0.6), fill: C.paper });
    bubble(1000, 170, 560, 230, { kind: 'thought', tail: [800, 400], text: '모르는 말?', size: 66, p: dp(lt, 1.2, 0.5) });
  }],
  // 5b the dictionary on top, a bookmark in the book
  [q.w('사전', 5), (t, lt) => {
    recursionBook(0, 900, 780, { p: dp(lt, 0, 0.5) });
    recursionBook(1, 900, 780, { p: dp(lt, 0.3, 0.5), dy: -(1 - smooth(dp(lt, 0.3, 0.5))) * 90 });
    recursionRibbon(0, 900, 780, { p: dp(lt, 1.2, 0.6) });
    hand('책갈피', 1580, 600, { size: 74, p: dp(lt, 2.2, 0.6) });
    inkArrow(1500, 640, 1200, 790, { via: [1400, 770], p: dp(lt, 2.4, 0.5), color: KEY(), w: 4.4 });
  }],
  // 6 another book, another bookmark
  [q.s(6), (t, lt) => {
    recursionBook(0, 900, 780); recursionBook(1, 900, 780);
    recursionRibbon(0, 900, 780);
    recursionBook(2, 900, 780, { p: dp(lt, 1.2, 0.5), dy: -(1 - smooth(dp(lt, 1.2, 0.5))) * 90 });
    recursionRibbon(1, 900, 780, { p: dp(lt, 1.9, 0.6) });
    hand('+1', 1360, 600, { size: 84, p: dp(lt, 2.5, 0.5) });
    hand('책갈피 2개', 1600, 420, { size: 60, p: dp(lt, 2.9, 0.6), color: INK() });
  }],
  // 7 last in, first out: the pulled ribbons line up at the right
  [q.s(7), (t, lt) => {
    const b2 = smooth(dp(lt, 0.3, 0.7)), r1 = dp(lt, 1.0, 0.9), b1 = smooth(dp(lt, 2.0, 0.7)), r0 = dp(lt, 2.7, 0.9);
    recursionBook(0, 760, 780);
    if (b1 < 1) recursionBook(1, 760, 780, { dy: -b1 * 160, a: 1 - b1 });
    if (b2 < 1) recursionBook(2, 760, 780, { dy: -b2 * 160, a: 1 - b2 });
    recursionRibbon(1, 760, 780, { pull: r1, to: [1450, 330] });
    recursionRibbon(0, 760, 780, { pull: r0, to: [1640, 330] });
    hand('1', 1464, 560, { size: 76, p: dp(lt, 1.9, 0.3), color: C.green });
    hand('2', 1654, 560, { size: 76, p: dp(lt, 3.6, 0.3), color: C.green });
    hand('마지막 것부터', 760, 220, { size: 70, p: dp(lt, 0.4, 0.8) });
  }],
  // 8 a computer: a job calls a smaller job, which calls a smaller one
  [q.s(8), (t, lt) => {
    const kb = q.w('작은', 8);
    prop('monitor', 330, 700, 1.9, { p: dp(lt, 0, 0.6), fill: C.paper });
    if (lt > 0.5) drawFace(330, 500, 52, 'smile');
    inkRect(620, 200, 1220, 640, { p: dp(lt, 0.5, 0.7), w: 4.4, fill: mix(C.paper, 0.5) });
    hand('일', 690, 260, { size: 70, p: dp(lt, 1, 0.4) });
    inkArrow(530, 470, 610, 470, { p: dp(lt, 0.8, 0.5), color: KEY(), w: 4.4 });
    inkRect(760, 320, 940, 480, { p: dp(t, kb, 0.6), w: 4, fill: mix(C.paper, 0.6) });
    hand('작은 일', 900, 375, { size: 60, p: dp(t, kb + 0.4, 0.5) });
    inkRect(900, 440, 660, 320, { p: dp(t, kb + 1.2, 0.6), w: 3.6, fill: mix(C.paper, 0.75) });
    hand('더 작은 일', 1080, 495, { size: 54, p: dp(t, kb + 1.6, 0.5) });
    inkArrow(700, 300, 790, 400, { via: [700, 380], p: dp(t, kb + 0.2, 0.5), color: KEY(), w: 4 });
    inkArrow(830, 410, 930, 520, { via: [840, 500], p: dp(t, kb + 1.4, 0.5), color: KEY(), w: 4 });
  }],
  // 8b the smaller jobs finish and hand back
  [q.w('끝나면', 8), (t, lt) => {
    prop('monitor', 330, 700, 1.9, { fill: C.paper }); drawFace(330, 500, 52, 'happy');
    inkRect(620, 200, 1220, 640, { w: 4.4, fill: mix(C.paper, 0.5) }); hand('일', 690, 260, { size: 70 });
    inkRect(760, 320, 940, 480, { w: 4, fill: mix(C.paper, 0.6) }); hand('작은 일', 900, 375, { size: 60 });
    inkRect(900, 440, 660, 320, { w: 3.6, fill: mix(C.paper, 0.75) }); hand('더 작은 일', 1080, 495, { size: 54 });
    recursionCheck(1230, 630, { p: dp(lt, 0.2, 0.4) });
    inkArrow(1500, 560, 1610, 400, { via: [1590, 520], p: dp(lt, 0.7, 0.5), color: C.green, w: 5 });
    recursionCheck(1620, 720, { p: dp(lt, 1.3, 0.4) });
    inkArrow(1730, 680, 1790, 300, { via: [1800, 560], p: dp(lt, 1.8, 0.5), color: C.green, w: 5 });
    recursionCheck(1720, 255, { p: dp(lt, 2.4, 0.4) });
    inkArrow(610, 560, 540, 560, { p: dp(lt, 2.6, 0.5), color: C.green, w: 5 });
    hand('돌아오기', 330, 220, { size: 70, p: dp(lt, 2.8, 0.6), color: C.green });
  }],
  // 9 isn't it strange?
  [q.s(9), (t, lt) => {
    ach(t, { x: 480, pose: 'shrug', face: 'surprised', s: 1.1, p: dp(lt, 0, 0.8) });
    tor(t, { x: 1380, pose: 'think', face: 'think', flip: true, s: 1.05, p: dp(lt, 0.2, 0.8) });
    bubble(860, 130, 820, 260, { kind: 'thought', tail: [1360, 500], p: dp(lt, 0.8, 0.5), body: (x, y, w, h) => {
      dolls(x + 90, y + h - 45, 7, { s: 0.62, p: dp(lt, 1.1, 1.6) });
      hand('…?', x + w - 100, y + h / 2 + 10, { size: 80, p: dp(lt, 2.4, 0.4) });
    } });
  }],
  // 9b the chapter question
  [q.w('질문', 9), (t, lt) => {
    teach('왜 끝이 날까?', { y: 700, p: dp(lt, 0, 1.2), t, fig: { shell: true, s: 0.95 }, face: 'think' });
    dolls(760, 468, 6, { s: 0.42, p: dp(t, q.w('끝없이', 9), 1.2) });
    hand('…', 1300, 446, { size: 70, p: dp(t, q.w('끝없이', 9) + 1.2, 0.4), color: INK() });
  }],
  // 10 the bottom: the smallest doll does not open
  [q.s(10), (t, lt) => {
    const xs = [360, 720, 1010, 1240, 1420], ss = [2.0, 1.55, 1.2, 0.92, 0.7];
    for (let i = 0; i < 5; i++) recursionDoll(xs[i], 830, ss[i], { p: dp(lt, i * 0.25, 0.5), open: i < 4 ? 1 : 0 });
    const tr = q.w('가장', 10);
    ring(1420, 770, 82, 104, { p: dp(t, tr + 0.4, 0.6) });
    hand('바닥', 1420, 560, { size: 88, p: dp(t, tr + 1.1, 0.6) });
  }],
  // 11 good recursion gets smaller each time and reaches the bottom
  [q.s(11), (t, lt) => {
    const D = [[330, 480, 1.5], [640, 600, 1.15], [900, 700, 0.9], [1110, 780, 0.7], [1290, 840, 0.55]];
    inkLine(1150, 840, 1780, 840, { p: dp(lt, 0, 0.6), w: 9 });
    for (let i = 0; i < 6; i++) inkLine(1190 + i * 105, 846, 1162 + i * 105, 878, { p: dp(lt, 0.3, 0.6), w: 3, color: C.dim });
    D.forEach(([x, y, s], i) => {
      prop('doll', x, y, s, { p: dp(lt, 0.3 + i * 0.6, 0.5) });
      if (i) inkArrow(D[i - 1][0] + 70 * D[i - 1][2], D[i - 1][1] - 150 * D[i - 1][2], x - 40 * s, y - 170 * s, { via: [(D[i - 1][0] + x) / 2 + 30, D[i - 1][1] - 200 * D[i - 1][2]], p: dp(lt, 0.1 + i * 0.6, 0.5), color: KEY(), w: 4, head: 18 });
    });
    hand('바닥', 1620, 790, { size: 72, p: dp(lt, 2.8, 0.5) });
    hand('점점 작게', 820, 270, { size: 76, p: dp(lt, 1.4, 0.7) });
    recursionCheck(1390, 690, { p: dp(t, q.w('멈추는', 11), 0.4) });
    hand('멈춤', 1490, 680, { size: 66, color: C.green, p: dp(t, q.w('멈추는', 11) + 0.3, 0.4) });
  }],
  // 12 stairs, said recursively
  [q.s(12), (t, lt) => {
    recursionStairs(300, 420, 7, 170, 60, { p: dp(lt, 0, 1.2) });
    figure(385, 420, { s: 0.8, t, face: 'smile', p: dp(lt, 0.8, 0.6) });
    hand('계단', 1480, 330, { size: 86, p: dp(lt, 1.4, 0.6) });
  }],
  // 13 the two-line rule; the figure follows it step by step
  [q.s(13), (t, lt) => {
    const x0 = 90, y0 = 420, sw = 135, sh = 84, n = 5;
    recursionStairs(x0, y0, n, sw, sh, { p: dp(lt, 0, 0.6) });
    const k = Math.min(n, Math.max(0, (lt - 1.2) / 0.85)), k0 = Math.floor(k), f = smooth(k - k0);
    const [ax, ay] = recursionStep(x0, y0, sw, sh, n, k0), [bx, by] = recursionStep(x0, y0, sw, sh, n, Math.min(n, k0 + 1));
    figure(lerp(ax, bx, f), lerp(ay, by, f) - Math.sin(Math.PI * f) * 34, { s: 0.65, t, face: k >= n ? 'happy' : 'smile', p: dp(lt, 0.2, 0.5) });
    const k2 = q.w('아니면', 13);
    recursionRule(1010, 240, 830, { p1: dp(lt, 0.2, 1), p2: dp(t, k2, 1), loop: dp(t, q.w('처음', 13), 0.7) });
  }],
  // 14 ten steps or a hundred: the same two lines
  [q.s(14), (t, lt) => {
    recursionStairs(140, 380, 10, 56, 46, { p: dp(lt, 0, 0.8) });
    recursionStairs(880, 260, 40, 21, 14.5, { p: dp(lt, 0.3, 0.8) });
    const ka = Math.min(10, Math.max(0, (lt - 1) / 0.22)), kb = Math.min(40, Math.max(0, (lt - 1) / 0.06));
    const [ax, ay] = recursionStep(140, 380, 56, 46, 10, Math.floor(ka)), [bx, by] = recursionStep(880, 260, 21, 14.5, 40, Math.floor(kb));
    figure(ax, ay, { s: 0.4, t, p: dp(lt, 0.5, 0.4) });
    figure(bx, by, { s: 0.4, t, p: dp(lt, 0.7, 0.4) });
    hand('열 칸', 580, 430, { size: 74, p: dp(lt, 0.6, 0.5) });
    hand('백 칸', 1500, 400, { size: 74, p: dp(lt, 0.9, 0.5) });
    recursionCheck(790, 790, { p: dp(lt, 3.4, 0.4) });
    recursionCheck(1800, 790, { p: dp(lt, 3.6, 0.4) });
  }],
  // 14b each step down leaves one step fewer
  [q.wx('내려갈', 14, 1), (t, lt) => {
    const x0 = 160, y0 = 380, sw = 150, sh = 75, n = 6;
    recursionStairs(x0, y0, n, sw, sh);
    const k = Math.min(n, Math.max(0, (lt - 0.4) / 0.6)), k0 = Math.floor(k), f = smooth((k - k0) * 1.4);
    const [ax, ay] = recursionStep(x0, y0, sw, sh, n, k0), [bx, by] = recursionStep(x0, y0, sw, sh, n, Math.min(n, k0 + 1));
    figure(lerp(ax, bx, f), lerp(ay, by, f) - Math.sin(Math.PI * f) * 34, { s: 0.65, t });
    hand('남은 계단', 1500, 320, { size: 60, color: C.dim });
    hand(String(n - k0), 1500, 540, { size: 250 });
  }],
  // 15 the first line is the bottom
  [q.s(15), (t, lt) => {
    recursionRule(540, 130, 840, {});
    const lw = handW('맨 아래면 멈춘다', 64);
    ring(540 + 96 + lw / 2, 227, lw / 2 + 44, 52, { p: dp(lt, 0.5, 0.6) });
    recursionStairs(560, 560, 5, 120, 56, { floorColor: C.red, floor: dp(lt, 1.2, 0.6) });
    inkArrow(640, 280, 1220, 800, { via: [430, 660], p: dp(lt, 1.6, 0.7), color: C.red, w: 4.4 });
    hand('바닥', 1480, 780, { size: 84, p: dp(lt, 2.2, 0.6) });
  }],
  // 16 no bottom: stairs that never end
  [q.s(16), (t, lt) => {
    for (let i = 0; i < 9; i++) {
      const x = 260 + i * 150, y = 200 + i * 74, q2 = dp(lt, i * 0.12, 0.3), al = 1 - i * 0.1;
      inkLine(x, y, x + 150, y, { p: q2, a: al, w: 5 }); inkLine(x + 150, y, x + 150, y + 74, { p: q2, a: al, w: 5, dash: i > 5 ? [10, 10] : null });
    }
    figure(480, 274, { s: 0.62, t, face: 'worried', p: dp(lt, 0.4, 0.5) });
    hand('바닥', 1500, 360, { size: 90, p: dp(lt, 0.9, 0.5), color: INK() });
    cross(1410, 300, 180, 120, { p: dp(lt, 1.4, 0.5) });
  }],
  // 16b two mirrors facing each other: an endless row of frames
  [q.w('거울', 16), (t, lt) => {
    prop('mirror', 300, 840, 3.2, { p: dp(lt, 0, 0.6) });
    prop('mirror', 1620, 840, 3.2, { p: dp(lt, 0.2, 0.6) });
    const P = dp(lt, 0.8, 2.6);
    for (let i = 1; i < 11; i++) {
      const k = Math.pow(0.74, i), pq = clamp01(P * 10 - i + 1);
      for (const sd of [-1, 1]) inkEllipse(960 + sd * 660 * k, 520, 192 * k, 275 * k, { p: pq, a: 1 - i * 0.07, w: Math.max(1.4, 4 * k + 0.6), color: i % 2 ? KEY() : INK() });
    }
    hand('끝없이', 960, 160, { size: 80, p: dp(lt, 2.4, 0.6) });
  }],
  // 17 inner voice: isn't it just repetition?
  [q.s(17), (t, lt) => {
    ach(t, { x: 600, pose: 'shrug', face: 'worried', s: 1.15, p: dp(lt, 0, 0.7) });
    tor(t, { x: 1480, flip: true, face: 'neutral', s: 1.05, p: dp(lt, 0.2, 0.7) });
    bubble(740, 150, 760, 230, { tail: [680, 500], text: '그냥 반복 아니야?', size: 68, p: dp(lt, 0.5, 0.5) });
  }],
  // 18 no: one simple rule grows something complex
  [q.s(18), (t, lt) => {
    bubble(760, 120, 400, 140, { text: '반복?', size: 60, a: 1 - dp(lt, 1.6, 0.4) });
    cross(820, 130, 280, 120, { p: dp(lt, 0.2, 0.5), a: 1 - dp(lt, 1.6, 0.4) });
    const pe = dp(lt, 1.2, 0.6);
    inkRect(280, 390, 320, 250, { p: pe, w: 4, fill: mix(C.paper, 0.85) });
    recursionHTree(440, 515, 130, 0, 1, true, pe, 1);
    hand('단순', 440, 710, { size: 72, p: dp(lt, 1.6, 0.4) });
    inkArrow(650, 515, 870, 515, { p: dp(lt, 2, 0.5), color: KEY(), w: 5 });
    recursionHTree(1300, 500, 420, 0, 7, true, dp(lt, 2.3, 3.0), 1);
    hand('복잡', 1300, 820, { size: 72, p: dp(lt, 4.2, 0.5) });
  }],
  // 19 a tree: branches on branches
  [q.s(19), (t, lt) => {
    recursionTree(1040, 860, 205, -Math.PI / 2, 0, 6, dp(lt, 0.2, 5.4), { a: 1, leaves: 0 });
    tor(t, { x: 300, s: 0.95, face: 'happy', p: dp(lt, 0, 0.6) });
    hand('가지 속 가지', 380, 300, { size: 74, p: dp(lt, 2.8, 0.8) });
  }],
  // 20 one rule = a whole tree
  [q.s(20), (t, lt) => {
    inkRect(230, 390, 340, 280, { p: dp(lt, 0, 0.5), w: 4, fill: mix(C.paper, 0.85) });
    const py = dp(lt, 0.3, 0.6);
    inkLine(400, 630, 400, 540, { p: py, w: 7, color: KEY() });
    inkLine(400, 540, 335, 455, { p: py, w: 6, color: KEY() }); inkLine(400, 540, 465, 455, { p: py, w: 6, color: KEY() });
    inkArrow(485, 445, 485, 600, { via: [545, 520], p: dp(lt, 0.8, 0.5), color: C.dim, w: 3.4, head: 16 });
    hand('규칙 하나', 400, 320, { size: 70, p: dp(lt, 0.5, 0.6) });
    eqSign(720, 530, { p: dp(lt, 1.1, 0.4), s: 1.2 });
    recursionTree(1270, 860, 195, -Math.PI / 2, 0, 6, dp(lt, 1.2, 1.6), { a: 1, leaves: dp(lt, 2.6, 0.6) });
    hand('나무 한 그루', 1270, 165, { size: 70, p: dp(lt, 2.8, 0.6) });
  }],
  // 21 music: up into other keys …
  [q.s(21), (t, lt) => {
    recursionStaff(dp(lt, 0, 0.8));
    for (let i = 0; i < 3; i++) recursionNote(i, { p: dp(lt, 0.8 + i * 1.1, 0.5) });
    for (let i = 0; i < 2; i++) inkArrow(recursionNotes[i][0] + 50, recursionNotes[i][1] - 30, recursionNotes[i + 1][0] - 50, recursionNotes[i + 1][1] - 30, { via: [(recursionNotes[i][0] + recursionNotes[i + 1][0]) / 2, recursionNotes[i + 1][1] - 110], p: dp(lt, 1.3 + i * 1.1, 0.5), color: KEY(), w: 4.4 });
    hand('다른 조로', 960, 220, { size: 80, p: dp(lt, 1.2, 0.7) });
    tor(t, { x: 1720, s: 0.8, face: 'happy', flip: true, p: dp(lt, 0.3, 0.6) });
  }],
  // 21b … and back down, one at a time: nested like brackets
  [q.w('거꾸로', 21), (t, lt) => {
    recursionStaff(1);
    for (let i = 0; i < 5; i++) recursionNote(i, { p: i < 3 ? 1 : dp(lt, 0.1 + (i - 3) * 0.5, 0.4) });
    for (let i = 2; i < 4; i++) inkArrow(recursionNotes[i][0] + 50, recursionNotes[i][1] - 30, recursionNotes[i + 1][0] - 50, recursionNotes[i + 1][1] - 30, { via: [(recursionNotes[i][0] + recursionNotes[i + 1][0]) / 2, recursionNotes[i][1] - 20], p: dp(lt, 0.2 + (i - 2) * 0.5, 0.4), color: C.green, w: 4.4 });
    inkArc(880, 400, 100, 80, Math.PI, Math.PI * 2, { p: dp(lt, 1.0, 0.4), color: KEY(), w: 5 });
    inkArc(880, 460, 300, 170, Math.PI, Math.PI * 2, { p: dp(lt, 1.4, 0.5), color: KEY(), w: 5 });
    inkArc(880, 490, 560, 290, Math.PI, Math.PI * 2, { p: dp(lt, 1.9, 0.6), color: KEY(), w: 5 });
    ring(1382, 800, 46, 46, { p: dp(lt, 2.6, 0.5) });
    hand('처음 조', 1690, 800, { size: 64, p: dp(lt, 2.9, 0.5) });
  }],
  // 22 Gödel's sentence holds itself
  [q.s(22), (t, lt) => {
    figure(300, 860, { pose: 'point', glasses: true, face: 'smile', s: 1.05, t, p: dp(lt, 0, 0.8) });
    hand('괴델의 문장', 1000, 236, { size: 56, color: C.dim, p: dp(lt, 0.4, 0.5) });
    [[600, 170, 800, 600], [740, 300, 520, 380], [830, 385, 340, 230], [895, 440, 210, 130]].forEach(([x, y, w, h], i) => {
      if (i === 0) inkRect(x, y, w, h, { p: dp(lt, 0.2, 0.7), w: 4.4, fill: mix(C.paper, 0.85) });
      else inkRect(x, y, w, h, { p: dp(lt, 0.8 + i * 0.6, 0.5), w: 4.4 - i * 0.7, color: KEY() });
    });
    hand('자기 안에', 1640, 420, { size: 66, p: dp(lt, 2.8, 0.5) });
    hand('자기', 1640, 510, { size: 66, p: dp(lt, 3.2, 0.4) });
  }],
  // 22b not its number written out (crossed) …
  [q.w('그대로', 22), (t, lt) => {
    figure(300, 860, { pose: 'think', glasses: true, face: 'think', s: 1.05, t });
    inkRect(600, 170, 800, 600, { w: 4.4, fill: mix(C.paper, 0.85) });
    hand('괴델의 문장', 1000, 236, { size: 56, color: C.dim });
    hand('2 845 103 …', 1000, 470, { size: 100, p: dp(lt, 0.1, 0.8), color: INK() });
    hand('번호', 1000, 600, { size: 56, color: C.dim, p: dp(lt, 0.5, 0.4) });
    cross(700, 395, 600, 150, { p: dp(lt, 1.1, 0.5), w: 8 });
  }],
  // 22c … but a recipe that computes it
  [q.w('계산', 22), (t, lt) => {
    figure(300, 860, { pose: 'point', glasses: true, face: 'happy', s: 1.05, t });
    inkRect(600, 170, 800, 600, { w: 4.4, fill: mix(C.paper, 0.85) });
    hand('괴델의 문장', 1000, 236, { size: 56, color: C.dim });
    prop('gear', 860, 640, 1.5, { p: dp(lt, 0, 0.5), color: KEY() });
    prop('paper', 1150, 700, 1.15, { p: dp(lt, 0.2, 0.5) });
    hand('계산법', 1000, 330, { size: 72, p: dp(lt, 0.4, 0.4) });
    inkArrow(1420, 470, 1590, 470, { p: dp(lt, 0.8, 0.35), color: KEY(), w: 5 });
    hand('번호', 1710, 470, { size: 72, p: dp(lt, 1.05, 0.35), color: INK() });
    ring(1710, 470, 92, 60, { p: dp(lt, 1.35, 0.4), color: KEY() });
  }],
  // 23 the last piece: how does one level give rise to another?
  [q.s(23), (t, lt) => {
    ach(t, { x: 300, pose: 'think', face: 'think', s: 1.1, p: dp(lt, 0, 0.7) });
    const pl = (y, p) => inkPoly([[700, y], [1700, y], [1540, y + 170], [540, y + 170]], { p, closed: true, w: 4, fill: mix(C.paper, 0.5) });
    pl(630, dp(lt, 0.3, 0.6));
    if (lt > 0.8) antBand(640, 1540, 740, 9, t, { s: 0.7, a: dp(lt, 0.8, 0.5), wobble: 26 });
    hand('단순한 규칙', 1500, 590, { size: 56, color: C.dim, p: dp(lt, 1, 0.5) });
    pl(220, dp(lt, 1.4, 0.6));
    inkArrow(1110, 625, 1110, 400, { p: dp(lt, 2.0, 0.6), color: KEY(), w: 5, dash: [12, 10] });
    hand('?', 1110, 305, { size: 170, p: dp(lt, 2.6, 0.5) });
  }],
]);

// ---------- 9 · ants ("개미 언덕과의 대화") ----------
// an anthill: a sandy mound with an entrance hole on top; ants circle it when t is given
function antsHill(x, y, s, { p = 1, a = 1, t = null, n = 8 } = {}) {
  const pts = [];
  for (let i = 0; i <= 40; i++) { const u = i / 40, ang = Math.PI + u * Math.PI; pts.push([x + Math.cos(ang) * 210 * s, y + Math.sin(ang) * (130 + 10 * Math.sin(u * 19)) * s]); }
  inkPath(pts, { p, a, w: 4.4, closed: true, fill: mix(C.yellow, 0.3) });
  inkEllipse(x, y - 128 * s, 26 * s, 10 * s, { p, a, w: 3, fill: INK() });
  for (let i = 0; i < 7; i++) inkDot(x - 150 * s + i * 50 * s, y - 40 * s - 30 * s * Math.sin(i * 1.7) ** 2, 3.4, { p, a: a * 0.6 });
  if (t != null && p >= 1) antBand(x - 300 * s, x + 300 * s, y + 6, n, t, { s: 0.42 * s, a, wobble: 10 * s });
}
// a parallelogram "level" seen at an angle
function antsPlane(x, y, w, h, { p = 1, a = 1, off = 150 } = {}) {
  inkPoly([[x + off, y], [x + w + off, y], [x + w, y + h], [x, y + h]], { p, a, closed: true, w: 4, fill: mix(C.paper, 0.5) });
}
const antsCheck = (x, y, o = {}) => inkPath([[x - 24, y], [x - 6, y + 20], [x + 28, y - 24]], { w: 7, color: C.green, ...o });
// ants walking along a quadratic curve p0 -> c -> p1; only the first `reach` (0..1) of the path is used
function antsTrail(p0, c, p1, n, t, { s = 0.5, a = 1, reach = 1, speed = 0.05 } = {}) {
  const B = (u) => { const v = 1 - u; return [v * v * p0[0] + 2 * v * u * c[0] + u * u * p1[0], v * v * p0[1] + 2 * v * u * c[1] + u * u * p1[1]]; };
  for (let i = 0; i < n; i++) {
    const u = ((i / n) + t * speed) % 1; if (u > reach) continue;
    const [x, y] = B(u), [x2] = B(Math.min(1, u + 0.01));
    ant(x, y + Math.sin(i * 2.1) * 8, { s, t: t + i, a, dir: x2 >= x ? 1 : -1 });
  }
}
// a tiny spectator: seated (up = 0) or standing with arms up (up = 1)
function antsFan(x, y, up, { a = 1, k = 1 } = {}) {
  const h = (22 + up * 24) * k, hy = y - h - 9 * k, color = up > 0.5 ? KEY() : INK();
  inkCircle(x, hy, 9 * k, { a, w: 2.8, fill: PAPER(), color });
  inkLine(x, hy + 9 * k, x, y, { a, w: 3, color });
  if (up > 0.5) { inkLine(x, hy + 16 * k, x - 13 * k, hy - 8 * k, { a, w: 2.8, color }); inkLine(x, hy + 16 * k, x + 13 * k, hy - 8 * k, { a, w: 2.8, color }); }
  else { inkLine(x, hy + 18 * k, x - 10 * k, y - 4 * k, { a, w: 2.6 }); inkLine(x, hy + 18 * k, x + 10 * k, y - 4 * k, { a, w: 2.6 }); }
}
// the stadium with two rows of fans; wave = 0..1 position of the wave along the stands (null: nobody stands)
function antsStadium(cx, by, s, { p = 1, a = 1, wave = null } = {}) {
  prop('stadium', cx, by, s, { p, a });
  if (p < 0.6) return;
  const fa = a * clamp01((p - 0.6) / 0.4);
  for (const [rx, ry, n] of [[226, 100, 30], [250, 112, 34]]) {
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, ang = Math.PI + u * Math.PI;
      const x = cx + Math.cos(ang) * rx * s, y = by + Math.sin(ang) * ry * s + 8;
      const up = wave == null ? 0 : clamp01(1 - Math.abs(u - wave) / 0.07);
      antsFan(x, y, up, { a: fa, k: 1.25 });
    }
  }
}
// a brain cell: a round body with a few forked dendrites; on = lit
function antsCell(x, y, r, { p = 1, a = 1, on = 0, seed = 0 } = {}) {
  for (let i = 0; i < 6; i++) {
    const ang = seed + i * 1.05 + 0.3 * Math.sin(i * 2.7 + seed), x1 = x + Math.cos(ang) * r, y1 = y + Math.sin(ang) * r;
    const x2 = x + Math.cos(ang) * r * 2, y2 = y + Math.sin(ang) * r * 2;
    inkLine(x1, y1, x2, y2, { p, a, w: Math.max(2, r * 0.09) });
    inkLine(x2, y2, x2 + Math.cos(ang + 0.6) * r * 0.6, y2 + Math.sin(ang + 0.6) * r * 0.6, { p, a, w: Math.max(1.6, r * 0.07) });
    inkLine(x2, y2, x2 + Math.cos(ang - 0.6) * r * 0.6, y2 + Math.sin(ang - 0.6) * r * 0.6, { p, a, w: Math.max(1.6, r * 0.07) });
  }
  inkCircle(x, y, r, { p, a, w: Math.max(2.4, r * 0.1), fill: on > 0.5 ? mix(C.yellow, 0.75) : PAPER() });
  inkDot(x, y, r * 0.28, { p, a, color: on > 0.5 ? C.red : INK() });
}
// cells of the network (fixed layout)
const antsNet = [[230, 330], [410, 240], [570, 370], [320, 510], [510, 550], [700, 250], [740, 480], [220, 720], [420, 750], [630, 700], [840, 640], [880, 360]];
const antsNetLinks = [[0, 1], [1, 2], [0, 3], [3, 4], [2, 4], [1, 5], [5, 6], [2, 6], [3, 7], [7, 8], [4, 8], [8, 9], [9, 10], [6, 10], [6, 11], [5, 11], [4, 9], [10, 11]];
// a grandmother's face (head only): hair bun, glasses, smile
function antsGran(x, y, r, { p = 1, a = 1 } = {}) {
  inkCircle(x, y - r * 1.05, r * 0.42, { p, a, w: 4, fill: mix(C.grey, 0.6) });
  inkCircle(x, y, r, { p, a, w: 4.4, fill: PAPER() });
  inkArc(x, y - r * 0.15, r * 1.02, r * 0.95, Math.PI * 1.05, Math.PI * 1.95, { p, a, w: 7, color: C.grey });
  if (p >= 1) withAlpha(a, () => drawFace(x, y + 6, r, 'smile'));
  inkCircle(x - r * 0.32, y - r * 0.08, r * 0.24, { p, a, w: 3 }); inkCircle(x + r * 0.32, y - r * 0.08, r * 0.24, { p, a, w: 3 });
}

SCENES.ants = (t, q) => shots(t, [
  // 0 the Anteater
  [q.s(0), (t, lt) => {
    animal('anteater', 800, 860, { s: 1.25, t, p: dp(lt, 0, 1) });
    hand('개미핥기', 1400, 380, { size: 84, p: dp(lt, 1.3, 0.7) });
    inkArrow(1330, 430, 1060, 640, { via: [1240, 580], p: dp(lt, 1.8, 0.5), color: KEY(), w: 4.4 });
    if (lt > 1) ant(1300, 860, { s: 0.8, t, a: dp(lt, 1, 0.5) });
  }],
  // 1 his friend the anthill, which talks
  [q.s(1), (t, lt) => {
    animal('anteater', 560, 860, { s: 1.0, t, p: dp(lt, 0, 0.8) });
    antsHill(1300, 860, 1.7, { p: dp(lt, 0.4, 0.8), t });
    prop('heart', 860, 620, 0.9, { p: dp(lt, 1.2, 0.5) });
    hand('친구', 860, 470, { size: 70, p: dp(lt, 1.5, 0.5) });
    bubble(1100, 190, 440, 170, { tail: [1300, 600], tailOk: true, text: '반가워!', size: 64, p: dp(lt, 2.6, 0.5) });   // the anthill speaks
  }],
  // 2 Achilles: friends with something it eats?
  [q.s(2), (t, lt) => {
    const a = ach(t, { x: 560, pose: 'shrug', face: 'surprised', s: 1.2, p: dp(lt, 0, 0.7) });
    say(a, '먹는데… 친구?', { side: 'right', size: 70, p: dp(lt, 0.4, 0.5) });   // the tail ends at his mouth, not his helmet
    animal('anteater', 1380, 870, { s: 0.6, t, p: dp(lt, 0.8, 0.6) });
    antsHill(1700, 870, 0.75, { p: dp(lt, 1, 0.6), t, n: 5 });
    hand('?', 400, 330, { size: 90, p: dp(lt, 1.6, 0.3), color: C.red });
  }],
  // 3 one ant knows nothing
  [q.s(3), (t, lt) => {
    ant(900, 800, { s: 4.6, t, p: dp(lt, 0, 0.8) });
    bubble(1150, 200, 400, 230, { kind: 'thought', tail: [1100, 600], tailOk: true, text: '…', size: 100, p: dp(lt, 0.9, 0.5) });   // the ant's head (ant() is not a figure)
    hand('한 마리', 640, 380, { size: 84, p: dp(lt, 1.5, 0.6) });
  }],
  // 3b it follows a smell, bumps, turns
  [q.w('냄새', 3), (t, lt) => {
    const pts = []; for (let i = 0; i <= 30; i++) pts.push([200 + i * 38, 760 + 18 * Math.sin(i * 0.8)]);
    inkPath(pts, { p: dp(lt, 0, 1.2), color: C.green, w: 5, dash: [14, 12] });
    for (let i = 0; i < 4; i++) inkPath([[340 + i * 260, 700], [330 + i * 260, 670], [350 + i * 260, 640], [338 + i * 260, 610]], { p: dp(lt, 0.3 + i * 0.2, 0.4), color: C.green, w: 3.4 });
    hand('냄새', 300, 560, { size: 66, color: C.green, p: dp(lt, 0.6, 0.5) });
    prop('rock', 1540, 800, 1.7, { p: dp(lt, 0.2, 0.6) });
    const go = dp(lt, 0.3, 1.9), back = dp(lt, 2.4, 1.0), bumped = lt > 2.2;   // all done by 3.4 s: the shot is ~4 s
    const x = bumped ? lerp(1330, 1000, back) : lerp(300, 1330, go), y = bumped ? lerp(760, 610, back) : 760;
    ant(x, y, { s: 1.8, t, dir: bumped ? -1 : 1 });
    const bp = dp(lt, 2.1, 0.3) * (1 - dp(lt, 3.0, 0.3));
    if (bp > 0) for (let i = 0; i < 5; i++) { const ang = -Math.PI / 2 + (i - 2) * 0.5; inkLine(1420 + Math.cos(ang) * 40, 700 + Math.sin(ang) * 40, 1420 + Math.cos(ang) * 76, 700 + Math.sin(ang) * 76, { a: bp, color: C.red, w: 4 }); }
    hand('쿵!', 1440, 560, { size: 70, color: C.red, p: dp(lt, 2.2, 0.3), a: 1 - dp(lt, 3.1, 0.3) });
    inkArrow(1300, 690, 1080, 600, { via: [1230, 600], p: dp(lt, 2.6, 0.5), color: KEY(), w: 4.4 });
  }],
  // 4 the colony finds food, makes a path, faces danger
  [q.s(4), (t, lt) => {
    antsHill(330, 860, 1.25, { p: dp(lt, 0, 0.6) });
    const tr = dp(lt, 0.5, 1.6);
    inkCurve([500, 820], [980, 260], [1500, 790], { p: tr, w: 3.4, color: C.dim, dash: [10, 10] });
    antsTrail([500, 820], [980, 260], [1500, 790], 22, t, { s: 0.62, reach: tr });
    inkCircle(1600, 790, 70, { p: dp(lt, 0.3, 0.5), w: 4, fill: mix(C.yellow, 0.55) });
    for (const [dx, dy] of [[-24, -14], [18, -26], [8, 18], [-16, 24], [30, 10]]) inkDot(1600 + dx, 790 + dy, 6, { p: dp(lt, 0.6, 0.3) });
    hand('먹이', 1600, 660, { size: 72, p: dp(t, q.w('먹이', 4), 0.5) });
    hand('길', 980, 390, { size: 80, p: dp(t, q.w('길을', 4), 0.5) });
    const kd = q.w('위험', 4), pd = dp(t, kd, 0.5);
    if (pd > 0) {
      inkCircle(1300, 330, 34, { p: pd, w: 4, fill: INK() });
      for (let i = 0; i < 4; i++) for (const d of [-1, 1]) inkPoly([[1300 + d * 20, 320 + i * 8], [1300 + d * 62, 290 + i * 18], [1300 + d * 80, 340 + i * 16]], { p: pd, w: 3 });
      hand('위험', 1460, 260, { size: 64, color: C.red, p: dp(t, kd + 0.3, 0.5) });
    }
  }],
  // 5 the chapter question (the Tortoise holds it up)
  [q.s(5), (t, lt) => {
    tor(t, { x: 470, y: 900, pose: 'present', face: 'think', s: 1.4, p: dp(lt, 0, 0.7) });
    sign(720, 300, 760, 270, ['9장의 질문'], { p: dp(lt, 0.15, 0.7), size: 80 });
  }],
  // 5b thoughtless ants + ants … = something that thinks?
  [q.w('생각하지', 5), (t, lt) => {
    for (let r = 0; r < 3; r++) antBand(160, 760, 640 + r * 80, 6, t + r * 3, { s: 0.6, a: dp(lt, 0, 0.6), wobble: 12 });
    prop('brain', 460, 520, 0.9, { p: dp(lt, 0.4, 0.5), fill: mix(C.magenta || C.red, 0.25) });
    cross(340, 340, 240, 180, { p: dp(lt, 0.8, 0.5) });
    inkArrow(860, 620, 1080, 620, { p: dp(lt, 1.4, 0.5), color: KEY(), w: 5 });
    antsHill(1440, 840, 1.3, { p: dp(lt, 1.6, 0.6), t, n: 6 });
    bubble(1250, 180, 400, 260, { kind: 'thought', tail: [1430, 640], p: dp(lt, 2.2, 0.5), body: (x, y, w, h) => {
      prop('bulb', x + w / 2 - 50, y + h - 40, 1.05, {});
      hand('?', x + w / 2 + 90, y + h / 2 + 10, { size: 110 });
    } });
  }],
  // 6 the stadium
  [q.s(6), (t, lt) => {
    antsStadium(960, 790, 2.9, { p: dp(lt, 0, 1.2) });
    hand('파도타기', 960, 200, { size: 84, p: dp(lt, 1.2, 0.6) });
  }],
  // 7 one fan only stands when the next one does
  [q.s(7), (t, lt) => {
    inkLine(180, 796, 1740, 796, { p: dp(lt, 0, 0.5), w: 6 });
    const w = (lt - 0.9) * 1.6;
    for (let i = 0; i < 6; i++) {
      const x = 300 + i * 264, up = Math.abs(w - i) < 0.6;
      figure(x, up ? 870 : 870, up ? { s: 0.8, pose: 'cheer', face: 'happy', t, p: dp(lt, 0.1 * i, 0.5) } : { s: 0.8, sit: true, face: 'smile', t, p: dp(lt, 0.1 * i, 0.5) });
    }
    ring(300 + 3 * 264, 640, 120, 230, { p: dp(lt, 0.6, 0.5), color: KEY(), lw: 4 });
    hand('옆 사람 따라', 960, 220, { size: 76, p: dp(lt, 1.2, 0.6) });
  }],
  // 8 the whole stadium: a wave goes round
  [q.s(8), (t, lt) => {
    antsStadium(960, 790, 2.9, { wave: ((lt * 0.32) % 1.2) - 0.1 });
    hand('파도', 960, 200, { size: 84, p: dp(lt, 0.5, 0.5) });
  }],
  // 8b nobody planned it
  [q.w('계획', 8), (t, lt) => {
    antsStadium(960, 790, 2.9, { wave: ((lt * 0.32 + 0.5) % 1.2) - 0.1 });
    figure(960, 875, { s: 0.8, glasses: true, pose: 'hold', face: 'neutral', t, p: dp(lt, 0, 0.5) });
    prop('paper', 1012, 742, 0.6, { p: dp(lt, 0.2, 0.4) });
    cross(860, 590, 220, 280, { p: dp(lt, 0.7, 0.5), w: 8 });
    hand('계획한 사람 없음', 960, 200, { size: 76, p: dp(lt, 1, 0.7) });
  }],
  // 9 a moving swarm of ants
  [q.s(9), (t, lt) => {
    const cx = lerp(620, 1220, dp(lt, 0, 6)), cy = 540;
    for (let i = 0; i < 36; i++) {
      const ang = i * 2.399, r = 22 * Math.sqrt(i) * 2.0;
      ant(cx + Math.cos(ang) * r * 1.5, cy + Math.sin(ang) * r * 0.8 + 60, { s: 0.75, t: t + i, a: dp(lt, i * 0.02, 0.4) });
    }
    inkEllipse(cx, cy + 40, 420, 230, { p: dp(lt, 1, 0.8), color: KEY(), w: 4, dash: [14, 12] });
    inkArrow(cx + 440, cy + 40, cx + 560, cy + 40, { p: dp(lt, 1.6, 0.4), color: KEY(), w: 5 });
    hand('개미 떼', 560, 250, { size: 76, p: dp(lt, 0.8, 0.6) });
  }],
  // 9b three levels: ants -> signals -> symbols
  [q.w('신호', 9), (t, lt) => {
    const ks = q.w('기호', 9);
    antsPlane(560, 690, 980, 150, { p: dp(lt, 0, 0.5) });
    antBand(640, 1520, 790, 10, t, { s: 0.5, wobble: 26 });
    hand('개미', 420, 765, { size: 64, color: INK(), p: dp(lt, 0.2, 0.4) });
    antsPlane(560, 450, 980, 150, { p: dp(lt, 0.4, 0.5) });
    for (let i = 0; i < 4; i++) inkArrow(780 + i * 190, 525 + (i % 2) * 24, 900 + i * 190, 525 + (i % 2) * 24, { p: dp(lt, 0.8 + i * 0.15, 0.4), color: KEY(), w: 5 });
    hand('신호', 420, 525, { size: 64, color: INK(), p: dp(lt, 0.7, 0.4) });
    antsPlane(560, 210, 980, 150, { p: dp(t, ks - 0.3, 0.5) });
    hand('먹이!', 1130, 285, { size: 90, p: dp(t, ks, 0.6) });
    hand('기호', 420, 285, { size: 64, color: INK(), p: dp(t, ks, 0.4) });
    inkArrow(1700, 790, 1700, 300, { p: dp(t, ks + 0.3, 0.8), color: C.dim, w: 4, dash: [12, 10] });
  }],
  // 10 the name: levels
  [q.s(10), (t, lt) => {
    teach('층위', { y: 700, p: dp(lt, 0, 1.2), t });
  }],
  // 11 ant level: walking. hill level: thinking. both true.
  [q.s(11), (t, lt) => {
    const kw = q.w('걷기', 11), kh = q.w('언덕의', 11), kt = q.w('생각하기', 11), kb = q.w('둘', 11);
    antsPlane(300, 660, 1020, 170, { p: dp(lt, 0, 0.5) });
    antBand(380, 1300, 770, 9, t, { s: 0.62, wobble: 30 });
    hand('걷기', 1540, 750, { size: 80, p: dp(t, kw, 0.5) });
    antsPlane(300, 240, 1020, 300, { p: dp(t, kh - 0.2, 0.5) });
    antsHill(900, 500, 0.95, { p: dp(t, kh, 0.6) });
    bubble(1050, 150, 240, 140, { kind: 'thought', tail: [960, 360], text: '…', size: 70, p: dp(t, kh + 0.4, 0.4) });
    hand('생각하기', 1580, 400, { size: 80, p: dp(t, kt, 0.6) });
    antsCheck(1730, 740, { p: dp(t, kb, 0.4) });
    antsCheck(1790, 390, { p: dp(t, kb + 0.3, 0.4) });
  }],
  // 12 whole or parts?
  [q.s(12), (t, lt) => {
    ach(t, { x: 420, pose: 'shrug', face: 'worried', s: 1.15, p: dp(lt, 0, 0.7) });
    bubble(240, 140, 560, 200, { tail: [450, 450], text: '전체? 부분?', size: 72, p: dp(t, q.w('결국', 12), 0.5) });
    antsHill(1180, 840, 1.35, { p: dp(lt, 0.4, 0.6), t, n: 6 });
    hand('전체', 1180, 560, { size: 66, p: dp(lt, 1, 0.5) });
    ant(1640, 830, { s: 2.2, t, p: dp(lt, 0.8, 0.5) });
    hand('부분', 1640, 640, { size: 66, p: dp(lt, 1.4, 0.5) });
  }],
  // 13 the Tortoise answers MU
  [q.s(13), (t, lt) => {
    tiles('MU', 820, 400, { size: 230, p: dp(lt, 0.3, 0.8) });
    tor(t, { x: 1500, pose: 'point', flip: true, face: 'happy', s: 1.1, p: dp(lt, 0, 0.7) });
    const ka = q.w('앞에서', 13);
    tiles('MI', 560, 730, { size: 90, p: dp(t, ka, 0.5), a: 0.8 });
    inkArrow(680, 730, 960, 730, { p: dp(t, ka + 0.4, 0.5), color: C.dim, w: 4.4 });
    tiles('MU', 1090, 730, { size: 90, p: dp(t, ka + 0.6, 0.5), a: 0.8 });
    cross(770, 690, 120, 80, { p: dp(t, ka + 1.0, 0.4) });
  }],
  // 14 the monks' answer: 無, "nothing"
  [q.s(14), (t, lt) => {
    hand('無', 760, 450, { size: 360, p: dp(lt, 0.2, 1.4), color: INK(), weight: 400 });
    hand('없을 무', 760, 760, { size: 72, p: dp(t, q.w('없을', 14), 0.6) });
    figure(1360, 870, { s: 1.15, face: 'sleepy', pose: 'think', t, p: dp(lt, 0, 0.7) });
  }],
  // 14b put the question down
  [q.w('질문', 14), (t, lt) => {
    const m = smooth(dp(lt, 1.0, 1.0));
    figure(820, 870, { s: 1.15, pose: m < 0.5 ? 'carry' : 'stand', face: m < 1 ? 'worried' : 'happy', t });
    hand('?', lerp(820, 1200, m), lerp(380, 700, m), { size: lerp(260, 300, m), color: KEY() });
    if (m >= 1) for (const d of [-1, 1]) inkLine(1200 + d * 90, 860, 1200 + d * 150, 840, { color: C.dim, w: 3, a: 1 - dp(lt, 2.4, 0.6) });
    hand('내려놓기', 1500, 300, { size: 80, p: dp(lt, 1.3, 0.6) });
  }],
  // 15 climb between the levels instead of choosing
  [q.s(15), (t, lt) => {
    antsPlane(380, 660, 1000, 170, { p: dp(lt, 0, 0.5) });
    antBand(460, 1360, 770, 8, t, { s: 0.6, wobble: 26 });
    antsPlane(380, 170, 1000, 220, { p: dp(lt, 0.2, 0.5) });
    antsHill(1060, 370, 0.7, { p: dp(lt, 0.3, 0.5) });
    prop('ladder', 840, 790, 2.6, { p: dp(lt, 0.4, 0.6) });
    const yy = 760 - (0.5 - 0.5 * Math.cos(Math.max(0, lt - 0.8) * 1.6)) * 330;
    figure(840, yy, { s: 0.6, pose: 'carry', face: 'happy', t, p: dp(lt, 0.6, 0.4) });
    inkArrow(1500, 620, 1500, 420, { p: dp(lt, 1, 0.4), color: KEY(), w: 5 });
    inkArrow(1580, 420, 1580, 620, { p: dp(lt, 1.2, 0.4), color: KEY(), w: 5 });
    hand('오르내리기', 1710, 300, { size: 70, p: dp(lt, 1.4, 0.6) });
  }],
  // 16 this picture looks just like our brain
  [q.s(16), (t, lt) => {
    antsHill(520, 790, 1.4, { p: dp(lt, 0, 0.6), t, n: 7 });
    eqSign(960, 620, { p: dp(lt, 0.6, 0.4), s: 1.3 });
    prop('brain', 1420, 800, 2.6, { p: dp(lt, 0.8, 0.8), fill: mix(C.magenta || C.red, 0.25), color: C.magenta || INK() });
    hand('뇌', 1420, 330, { size: 84, p: dp(lt, 1.8, 0.5) });
  }],
  // 17 put brain cells where the ants were
  [q.s(17), (t, lt) => {
    antsPlane(260, 520, 1300, 260, { p: dp(lt, 0, 0.5) });
    const fo = dp(lt, 0.9, 0.8), fi = dp(lt, 1.3, 0.8);
    if (fo < 1) antBand(380, 1500, 660, 10, t, { s: 0.7, a: 1 - fo, wobble: 40 });
    for (let i = 0; i < 6; i++) antsCell(480 + i * 190, 650 + (i % 2 ? -36 : 36), 34, { a: fi, seed: i, on: 0 });
    hand('개미', 520, 420, { size: 66, color: INK(), p: dp(lt, 0.3, 0.4), a: 1 - fo });
    hand('뇌세포', 960, 400, { size: 80, p: dp(lt, 1.8, 0.6) });
    inkArrow(700, 420, 840, 420, { p: dp(lt, 1.4, 0.4), color: KEY(), w: 5 });
  }],
  // 17b one cell: fires or not. That is all.
  [q.w('하나는', 17), (t, lt) => {
    antsCell(640, 540, 100, { p: dp(lt, 0, 0.7), seed: 0.4, on: 1 });
    for (let i = 0; i < 6; i++) { const ang = i * 1.05; inkLine(640 + Math.cos(ang) * 120, 540 + Math.sin(ang) * 120, 640 + Math.cos(ang) * 150, 540 + Math.sin(ang) * 150, { p: dp(lt, 0.6, 0.3), color: C.yellow, w: 5 }); }
    inkArrow(880, 380, 1010, 300, { p: dp(lt, 0.8, 0.4), color: C.red, w: 5 });
    antsCell(1300, 540, 100, { p: dp(lt, 0.3, 0.7), seed: 2.1, on: 0 });
    hand('보낸다', 640, 820, { size: 72, p: dp(lt, 1.0, 0.5) });
    hand('안 보낸다', 1300, 820, { size: 72, p: dp(lt, 1.5, 0.5), color: C.dim });
    hand('이게 전부', 1580, 200, { size: 62, p: dp(lt, 2.6, 0.5), color: INK() });
  }],
  // 18 billions together: a grandmother's face, a song, "me"
  [q.s(18), (t, lt) => {
    antsNetLinks.forEach(([i, j], k) => inkLine(...antsNet[i], ...antsNet[j], { p: dp(lt, 0.1 + k * 0.03, 0.4), w: 2.4, color: C.dim }));
    antsNet.forEach(([x, y], i) => antsCell(x, y, 26, { p: dp(lt, i * 0.04, 0.4), seed: i, on: Math.sin(t * 3 + i * 1.9) > 0.3 ? 1 : 0 }));
    hand('수백억 개', 540, 150, { size: 70, p: dp(lt, 0.4, 0.6) });
    const kg = q.w('할머니', 18), kn = q.w('노래', 18), km = q.w('나라는', 18);
    inkArrow(960, 400, 1300, 250, { p: dp(t, kg, 0.4), color: KEY(), w: 5 });
    antsGran(1500, 260, 105, { p: dp(t, kg + 0.2, 0.6) });
    hand('할머니', 1720, 260, { size: 52, color: INK(), p: dp(t, kg + 0.6, 0.4) });
    inkArrow(980, 520, 1300, 520, { p: dp(t, kn, 0.4), color: KEY(), w: 5 });
    prop('note', 1480, 610, 1.3, { p: dp(t, kn + 0.2, 0.5) });
    prop('note', 1600, 580, 1.1, { p: dp(t, kn + 0.4, 0.5) });
    inkArrow(960, 650, 1300, 770, { p: dp(t, km, 0.4), color: KEY(), w: 5 });
    hand('나', 1500, 770, { size: 170, p: dp(t, km + 0.2, 0.5) });
  }],
  // 19 handover: on which level does "me" live?
  [q.s(19), (t, lt) => {
    ach(t, { x: 300, pose: 'think', face: 'think', s: 1.05, p: dp(lt, 0, 0.6) });
    antsPlane(820, 680, 820, 130, { p: dp(lt, 0.1, 0.4) });
    for (let i = 0; i < 5; i++) antsCell(940 + i * 150, 745, 18, { seed: i, on: i % 2 });
    antsPlane(820, 460, 820, 130, { p: dp(lt, 0.3, 0.4) });
    for (let i = 0; i < 3; i++) inkArrow(1000 + i * 210, 525, 1110 + i * 210, 525, { p: dp(lt, 0.5, 0.4), color: KEY(), w: 4.4 });
    antsPlane(820, 240, 820, 130, { p: dp(lt, 0.5, 0.4) });
    hand('생각', 1300, 305, { size: 64, p: dp(lt, 0.7, 0.4) });
    hand('나?', 590, 400, { size: 110, p: dp(lt, 0.8, 0.5) });
    for (const [yy, k] of [[305, 0], [525, 1], [745, 2]]) inkArrow(660, 420, 880, yy, { p: dp(lt, 1.2 + k * 0.25, 0.4), color: C.dim, w: 4, dash: [10, 10] });
  }],
]);

// ---------- self: 10장 '나'라는 고리 ----------
// Brain cells form groups one level up; a group that pairs with a thing is a symbol; one symbol points at the brain
// itself ('나'); the loop between the levels is the '나'. Camera filming its own TV, '나는 이상한 고리' (2007).

// a field of brain cells inside an ellipse (sunflower layout, stable); lit(x, y, i) picks cells that light up
function selfField(cx, cy, rx, ry, n, { p = 1, a = 1, r = 13, lit = null, litA = 1, links = true, skip = null } = {}) {
  const K = KEY(), pts = [];
  for (let i = 0; i < n; i++) { const u = Math.sqrt((i + 0.5) / n), g = i * 2.39996 + 0.7; pts.push([cx + Math.cos(g) * u * rx, cy + Math.sin(g) * u * ry]); }
  const keep = pts.map(([x, y]) => !(skip && skip(x, y)));
  const on = pts.map(([x, y], i) => keep[i] && !!(lit && lit(x, y, i)));
  if (links && litA > 0) pts.forEach(([x, y], i) => {
    if (!on[i]) return;
    let best = -1, bd = 1e9;
    pts.forEach(([x2, y2], j) => { if (j !== i && on[j]) { const d = Math.hypot(x2 - x, y2 - y); if (d < bd) { bd = d; best = j; } } });
    if (best >= 0) inkLine(x, y, pts[best][0], pts[best][1], { a: a * litA, w: 3, color: K, p: litA });
  });
  pts.forEach(([x, y], i) => {
    if (!keep[i]) return;
    const q = clamp01((p - (i / n) * 0.6) / 0.4), L = on[i] ? litA : 0;
    inkCircle(x, y, r, { p: q, a, w: 3, color: L > 0.5 ? K : INK(), fill: L > 0 ? mix(K, 0.15 + 0.65 * L) : PAPER() });
  });
  return pts;
}
// a symbol: a small cluster of cells firing together (7 cells, linked); ring and label optional
function selfSym(x, y, s = 1, { p = 1, a = 1, lit = 1, ring = false, ringP = null, ringColor = null, label = null, lpos = 'top', size = 56, lcolor = null } = {}) {
  if (p <= 0 || a <= 0) return;
  const K = KEY(), pts = [[0, 0]];
  for (let i = 0; i < 6; i++) { const g = i * Math.PI / 3 + 0.3; pts.push([Math.cos(g) * 34, Math.sin(g) * 34]); }
  if (lit > 0) for (let i = 1; i < 7; i++) inkLine(x, y, x + pts[i][0] * s, y + pts[i][1] * s, { p: clamp01(p * 2 - 0.8), a: a * lit, w: 3 * Math.max(0.8, s * 0.7), color: K });
  pts.forEach(([dx, dy], i) => inkCircle(x + dx * s, y + dy * s, 12 * s, { p: clamp01(p * 1.6 - i * 0.08), a, w: 3 * Math.max(0.8, Math.sqrt(s)), color: lit > 0.5 ? K : INK(), fill: lit > 0 ? mix(K, 0.15 + 0.65 * lit) : PAPER() }));
  const R = 62 * s;
  if (ring) inkCircle(x, y, R, { p: ringP ?? clamp01(p * 2 - 1), a, w: 4.6, color: ringColor || K });
  if (label) {
    const off = (ring ? R : 48 * s) + size * 0.62, q = clamp01(p * 2 - 1);
    if (lpos === 'top') hand(label, x, y - off, { size, p: q, a, color: lcolor });
    else if (lpos === 'bottom') hand(label, x, y + off, { size, p: q, a, color: lcolor });
    else hand(label, x + off - size * 0.3, y, { size, p: q, a, color: lcolor, align: 'left' });
  }
}
// a sitting cat: (x, y) bottom centre, s = 1 is about 220 px tall
function selfCat(x, y, s = 1, { p = 1, a = 1 } = {}) {
  if (p <= 0) return;
  const q1 = clamp01(p * 3), q2 = clamp01(p * 3 - 1), q3 = clamp01(p * 3 - 2), o = { a, w: 4 * Math.max(0.7, Math.sqrt(s)) };
  inkCurve([x + 40 * s, y - 14 * s], [x + 124 * s, y - 20 * s], [x + 98 * s, y - 104 * s], { ...o, p: q2 });
  inkEllipse(x, y - 55 * s, 52 * s, 56 * s, { ...o, p: q1, fill: PAPER() });
  const hy = y - 140 * s;
  for (const d of [-1, 1]) inkPath([[x + d * 40 * s, hy - 26 * s], [x + d * 38 * s, hy - 78 * s], [x + d * 8 * s, hy - 46 * s]], { ...o, p: q1, closed: true, fill: PAPER() });
  inkCircle(x, hy, 48 * s, { ...o, p: q1, fill: PAPER() });
  if (q3 > 0) withAlpha(q3, () => {
    inkDot(x - 17 * s, hy - 6 * s, 5.5 * s); inkDot(x + 17 * s, hy - 6 * s, 5.5 * s);
    inkPath([[x - 7 * s, hy + 8 * s], [x + 7 * s, hy + 8 * s], [x, hy + 16 * s]], { ...o, closed: true, fill: INK(), w: 2.4 });
    for (const d of [-1, 1]) for (let k = -1; k <= 1; k++) inkLine(x + d * 22 * s, hy + 14 * s + k * 5 * s, x + d * 76 * s, hy + 8 * s + k * 15 * s, { ...o, w: 2.6 });
  });
}
// rain: a cloud with falling drops; (x, y) = where the drops end
function selfRain(x, y, s = 1, { p = 1, a = 1, t = 0 } = {}) {
  if (p <= 0) return;
  prop('cloud', x, y - 100 * s, s, { p: clamp01(p * 1.6), a });
  const q = clamp01(p * 2 - 1);
  for (let i = 0; i < 5; i++) {
    const dx = (i - 2) * 40 * s, f = (t * 1.1 + i * 0.37) % 1, yy = y - 96 * s + f * 76 * s;
    inkLine(x + dx, yy, x + dx - 8 * s, yy + 24 * s, { a: a * q * (1 - f * 0.5), w: 4, color: C.dim });
  }
}
// magnifier held at (hx, hy), pointing along ang
function selfMag(hx, hy, ang, s = 1, { p = 1, a = 1 } = {}) {
  const c = Math.cos(ang), sn = Math.sin(ang), L = 70 * s, R = 50 * s;
  inkLine(hx, hy, hx + c * L, hy + sn * L, { p: clamp01(p * 2), a, w: 9 });
  inkCircle(hx + c * (L + R), hy + sn * (L + R), R, { p: clamp01(p * 2 - 0.6), a, w: 5, fill: mix(C.paper, 0.4) });
}
// Gödel's sentence as a card with a G, with an arrow pointing back at itself
function selfGCard(x, y, s = 1, { p = 1, a = 1, arrow = true } = {}) {
  if (p <= 0) return;
  inkRect(x - 60 * s, y - 80 * s, 120 * s, 160 * s, { p, a, w: 4.4, fill: mix(C.paper, 0.9) });
  hand('G', x, y + 4 * s, { size: 110 * s, p: clamp01(p * 2 - 0.6), a, color: KEY() });
  if (arrow) inkArrow(x + 64 * s, y - 10 * s, x + 18 * s, y - 86 * s, { via: [x + 150 * s, y - 140 * s], p: clamp01(p * 2 - 1), a, color: KEY(), w: 4.4, head: 18 });
}
// a round of notes on a spiral (the canon that climbs and comes back)
function selfNotes(cx, cy, s = 1, { p = 1, a = 1 } = {}) {
  if (p <= 0) return;
  const pts = [];
  for (let i = 0; i <= 60; i++) { const u = i / 60, g = u * Math.PI * 3.2, r = (24 + u * 110) * s; pts.push([cx + Math.cos(g) * r, cy + Math.sin(g) * r * 0.8]); }
  inkPath(pts, { p, a, w: 3, color: C.dim, dash: [8, 8] });
  for (let i = 0; i < 7; i++) {
    const u = (i + 0.7) / 7, g = u * Math.PI * 3.2, r = (24 + u * 110) * s;
    prop('note', cx + Math.cos(g) * r + 8 * s, cy + Math.sin(g) * r * 0.8 + 26 * s, 0.36 * s, { p: clamp01(p * 7 - i), a, color: KEY() });
  }
}
// an elliptical arrow going round (cx, cy)
function selfLoopAround(cx, cy, rx, ry, { p = 1, a = 1, color = null, w = 5, a0 = -Math.PI * 0.3, span = Math.PI * 1.7, dash = null, head = 26 } = {}) {
  if (p <= 0 || a <= 0) return;
  const c = color || KEY(), ps = clamp01(p / 0.85), ph = clamp01((p - 0.85) / 0.15);
  inkArc(cx, cy, rx, ry, a0, a0 + span, { p: ps, a, color: c, w, dash });
  if (ph <= 0) return;
  const g = a0 + span, x = cx + Math.cos(g) * rx, y = cy + Math.sin(g) * ry;
  const ang = Math.atan2(Math.cos(g) * ry, -Math.sin(g) * rx);
  inkPath([[x - Math.cos(ang - 0.45) * head, y - Math.sin(ang - 0.45) * head], [x, y], [x - Math.cos(ang + 0.45) * head, y - Math.sin(ang + 0.45) * head]], { p: ph, a, color: c, w });
}
// two levels: cells below, the '나' symbol above, an arrow up on the left and an arrow down on the right
function selfLevels(t, { cx = 960, top = 280, bot = 700, pBot = 1, pTop = 1, pUp = 1, pDown = 1, a = 1, up = null, down = null, side = true } = {}) {
  const K = KEY();
  for (let i = 0; i < 18; i++) {
    const row = i % 2, col = Math.floor(i / 2);
    const x = cx + (col - 4) * 92 + (row ? 23 : -23), y = bot - 28 + row * 56;
    const lit = Math.sin(i * 1.9 + t * 2.4) > 0.55 ? 1 : 0;
    inkCircle(x, y, 19, { p: clamp01(pBot * 2.5 - col * 0.15), a, w: 3.2, color: lit ? K : INK(), fill: lit ? mix(K, 0.7) : PAPER() });
  }
  selfSym(cx, top, 1.3, { p: pTop, a, ring: true, label: '나', size: 64 });
  inkArrow(cx - 400, bot - 60, cx - 100, top + 20, { via: [cx - 520, top - 10], p: pUp, a, w: 5.5, color: K, head: 26 });
  inkArrow(cx + 100, top + 20, cx + 400, bot - 60, { via: [cx + 520, top - 10], p: pDown, a, w: 5.5, color: K, head: 26 });
  if (up) hand(up, cx - 600, (top + bot) / 2 + 10, { size: 58, p: pUp, a });
  if (down) hand(down, cx + 610, (top + bot) / 2 + 10, { size: 58, p: pDown, a });
  if (side) {
    hand('위층', cx - 790, top, { size: 46, color: C.dim, weight: 400, p: pTop, a });
    hand('아래층', cx - 790, bot, { size: 46, color: C.dim, weight: 400, p: pBot, a });
  }
}

SCENES.self = (t, q) => {
  const K = KEY();
  const dashed = { dash: [14, 10], color: C.dim, w: 3.4 };
  // shared layouts drawn in more than one shot (keyed to absolute cue times, so a later shot shows them finished)
  const matchRows = (t) => {
    const xs = [520, 960, 1400], names = ['고양이', '비', '엄마'];
    const cues = [q.s(3), q.w('비', 3), q.w('엄마', 3)], mc = q.w('세상의', 3);
    xs.forEach((x, k) => {
      const c = cues[k];
      selfSym(x, 300, 1.3, { p: dp(t, c, 0.5), label: names[k], size: 60 });
      if (k === 0) selfCat(x, 850, 1.0, { p: dp(t, c + 0.2, 0.8) });
      if (k === 1) selfRain(x, 820, 1.25, { p: dp(t, c + 0.2, 0.8), t });
      if (k === 2) figure(x, 870, { s: 0.68, hair: true, face: 'smile', p: dp(t, c + 0.2, 0.8) });
      inkLine(x, 390, x, 590, { dash: [12, 9], color: K, w: 4, p: dp(t, mc + 0.25 * k, 0.5) });
    });
  };
  const camTV = (t, { ring1 = 0, ring2 = 0, sp = 1 } = {}) => {
    inkLine(480, 700, 480, 860, { w: 5 }); inkLine(410, 862, 550, 862, { w: 5 });
    prop('camera', 480, 700, 1.7);
    prop('monitor', 1400, 780, 2.3);
    screenLoop(1400, 780 - 105 * 2.3, 0.72, { t, n: 6, p: sp });
    if (ring1 > 0) { ring(480, 600, 180, 150, { p: ring1 }); cross(620, 400, 70, 70, { p: clamp01(ring1 * 2 - 1) }); }
    if (ring2 > 0) { ring(1400, 560, 290, 230, { p: ring2 }); cross(1640, 290, 70, 70, { p: clamp01(ring2 * 2 - 1) }); }
  };

  return shots(t, [
    // 0 — back to the first question
    [q.s(0), (t, lt) => {
      inkLine(220, 882, 1700, 882, { ...dashed, p: dp(lt, 0, 0.8) });
      board(240, 420, 460, 320, { term: '?', size: 190, p: dp(lt, 0.1, 1.0) });
      hand('처음의 질문', 470, 350, { size: 66, p: dp(lt, 0.9, 0.8) });
      inkArrow(1420, 330, 820, 300, { via: [1130, 170], color: K, w: 6, p: dp(lt, 0.5, 1.0) });
      const u = smooth(lt / 3.4);
      figure(lerp(1520, 1080, u), GROUND, { s: 1.1, walk: u < 1 ? 1 : 0, t: lt, flip: true, face: 'think', p: dp(lt, 0, 0.6) });
    }],
    [q.w('재료', 0), (t, lt) => {
      prop('rock', 380, 790, 1.7, { p: dp(lt, 0, 0.6) });
      prop('puddle', 690, 800, 1.2, { p: dp(lt, 0.3, 0.6) });
      hand('뜻 없는 재료', 530, 860, { size: 52, color: C.dim, p: dp(lt, 0.6, 0.6) });
      inkArrow(860, 640, 1200, 640, { color: K, w: 7, p: dp(lt, 0.9, 0.6), head: 30 });
      hand('?', 1030, 550, { size: 130, p: dp(lt, 1.3, 0.4) });
      figure(1480, 870, { s: 1.15, pose: 'wave', t, p: dp(lt, 1.4, 0.8), face: 'happy' });
      hand('나', 1480, 400, { size: 110, p: dp(lt, 2.0, 0.5) });
    }],
    // 1 — like the ant colony: one level up, cells move as groups
    [q.s(1), (t, lt) => {
      inkArc(960, 862, 460, 300, Math.PI, Math.PI * 2, { closed: true, fill: mix(C.yellow, 0.22), w: 4.6, p: dp(lt, 0, 0.9) });
      antBand(440, 1480, 880, 13, t, { s: 0.5, a: dp(lt, 0.4, 0.5) });
      for (let i = 0; i < 6; i++) {
        const g = Math.PI * (1.18 + i * 0.13), x = 960 + Math.cos(g) * 380, y = 862 + Math.sin(g) * 232;
        ant(x, y, { s: 0.42, t: t + i, a: dp(lt, 0.6 + i * 0.08, 0.3) });
      }
      hand('개미 언덕', 960, 400, { size: 80, p: dp(lt, 1.0, 0.7) });
    }],
    [q.w('뇌세포', 1), (t, lt) => {
      [560, 960, 1360].forEach((x, k) => {
        selfField(x, 700, 160, 100, 14, { p: dp(lt, 0.15 * k, 0.8), r: 14, lit: () => true, litA: dp(lt, 1.2 + 0.3 * k, 0.5) });
        inkEllipse(x, 700, 192, 132, { dash: [12, 9], w: 3.4, color: K, p: dp(lt, 1.4 + 0.3 * k, 0.6) });
        inkArrow(x, 556, x, 420, { color: K, w: 5, p: dp(lt, 1.8 + 0.3 * k, 0.5) });
        selfSym(x, 320, 1.3, { p: dp(lt, 2.1 + 0.3 * k, 0.5) });
      });
      hand('한 층 위', 200, 320, { size: 48, color: C.dim, weight: 400, p: dp(lt, 2.0, 0.5) });
      hand('세포', 200, 700, { size: 48, color: C.dim, weight: 400, p: dp(lt, 0.4, 0.5) });
      hand('무리', 960, 175, { size: 72, p: dp(lt, 2.8, 0.5) });
    }],
    // 2 — the cells that wake together when you think of a cat
    [q.s(2), (t, lt) => {
      figure(400, GROUND, { s: 1.1, pose: 'think', face: 'think', p: dp(lt, 0, 0.6) });
      bubble(200, 100, 480, 340, { kind: 'thought', tail: [430, 520], p: dp(lt, 0.4, 0.5), body: (x, y, w, h) => selfCat(x + w / 2, y + h - 34, 1.05, { p: dp(lt, 0.7, 1.0) }) });
      const cue = q.w('깨어나는', 2);
      inkEllipse(1250, 500, 520, 340, { ...dashed, p: dp(lt, 0.2, 0.8) });
      hand('뇌', 1720, 190, { size: 60, color: C.dim, p: dp(lt, 0.5, 0.4) });
      selfField(1250, 500, 450, 280, 46, { p: dp(lt, 0.3, 1.0), r: 15, lit: (x, y) => Math.hypot(x - 1340, y - 420) < 125, litA: dp(t, cue, 0.6) });
      ring(1340, 420, 160, 140, { p: dp(t, cue + 0.6, 0.6) });
      hand('고양이', 1600, 640, { size: 56, p: dp(t, cue + 0.9, 0.5) });
    }],
    [q.w('종이', 2), (t, lt) => {
      const r3 = q.w('무리도', 2);
      prop('paper', 600, 470, 1.7, { p: dp(lt, 0, 0.5), blank: true });
      hand('p', 600, 240, { size: 110, p: dp(lt, 0.3, 0.4) });
      hand('q', 600, 390, { size: 110, p: dp(lt, 0.5, 0.4) });
      inkLine(700, 245, 1110, 245, { ...dashed, p: dp(lt, 0.7, 0.5) });
      inkLine(700, 395, 1110, 395, { ...dashed, p: dp(lt, 0.9, 0.5) });
      hand('더하기', 1280, 245, { size: 70, color: INK(), p: dp(lt, 1.0, 0.5) });
      hand('같다', 1280, 395, { size: 70, color: INK(), p: dp(lt, 1.2, 0.5) });
      selfSym(600, 680, 1.4, { p: dp(t, r3, 0.5) });
      inkLine(700, 680, 1110, 680, { dash: [14, 10], color: K, w: 4, p: dp(t, r3 + 0.5, 0.5) });
      selfCat(1280, 860, 0.95, { p: dp(t, r3 + 0.8, 0.8) });
      hand('짝', 905, 630, { size: 64, p: dp(t, q.w('짝을', 2), 0.4) });
    }],
    [q.w('호프스태터는', 2), (t, lt) => {
      teach('뇌 속의 기호', { y: 720, p: dp(lt, 0, 1.0), t, fig: { glasses: true } });
      selfSym(1300, 300, 0.8, { p: dp(lt, 1.0, 0.5) });
    }],
    // 3 — cat, rain, mom: each symbol pairs with a thing (isomorphism)
    [q.s(3), (t, lt) => matchRows(t)],
    [q.w('앞에서', 3), (t, lt) => {
      matchRows(t);
      hand('동형', 1710, 480, { size: 90, p: dp(lt, 0, 0.5) });
      ring(1710, 484, 120, 70, { p: dp(lt, 0.5, 0.5) });
    }],
    // 4 — the brain looks at the world for a long time
    [q.s(4), (t, lt) => {
      figure(380, GROUND, { s: 1.1, pose: 'point', face: 'think', p: dp(lt, 0, 0.6) });
      selfMag(380 + 124 * 1.1, GROUND - 234 * 1.1, -0.3, 1.1, { p: dp(lt, 0.4, 0.5) });
      prop('globe', 920, 640, 1.4, { p: dp(lt, 0.8, 0.6) });
      prop('cloud', 1320, 360, 1.1, { p: dp(lt, 1.1, 0.6) });
      prop('tree', 1190, 870, 1.4, { p: dp(lt, 1.3, 0.6) });
      selfCat(1470, 870, 0.85, { p: dp(lt, 1.5, 0.6) });
      prop('house', 1700, 870, 1.0, { p: dp(lt, 1.7, 0.6) });
      hand('세상', 900, 230, { size: 80, p: dp(lt, 2.0, 0.5) });
    }],
    // 5 — ... and finally at itself
    [q.s(5), (t, lt) => {
      figure(700, GROUND, { s: 1.15, pose: 'present', face: 'surprised', p: dp(lt, 0, 0.5) });
      const hx = 700 + 118 * 1.15, hy = GROUND - 290 * 1.15;
      inkLine(hx, hy, 1060, 520, { w: 9, p: dp(lt, 0.2, 0.3) });
      inkCircle(1220, 450, 170, { w: 6, fill: mix(C.paper, 0.45), p: dp(lt, 0.3, 0.5) });
      figure(1220, 512, { s: 0.36, face: 'surprised', pose: 'present', p: dp(lt, 0.7, 0.6) });
      hand('자기 자신', 1220, 720, { size: 76, p: dp(lt, 1.2, 0.6) });
    }],
    // 6 — the brain makes a symbol that points at itself: '나'
    [q.s(6), (t, lt) => {
      inkEllipse(960, 470, 620, 330, { ...dashed, p: dp(lt, 0, 0.7) });
      hand('뇌', 1640, 170, { size: 60, color: C.dim, p: dp(lt, 0.3, 0.4) });
      [[620, 400, '고양이'], [960, 290, '비'], [1300, 400, '엄마']].forEach(([x, y, l], k) =>
        selfSym(x, y, 1.25, { p: dp(lt, 0.2 + 0.15 * k, 0.5), label: l, size: 50, lcolor: C.dim }));
      selfSym(960, 610, 1.3, { p: dp(lt, 0.7, 0.5), lit: dp(lt, 0.9, 1.0) });
      inkArrow(1050, 650, 1520, 610, { via: [1330, 820], color: K, w: 6, p: dp(lt, 1.8, 0.8), head: 28 });
      hand('자기 자신', 1730, 680, { size: 56, p: dp(lt, 2.4, 0.5) });
    }],
    [q.w('나라는', 6), (t, lt) => {
      selfField(960, 480, 820, 360, 64, { p: dp(lt, 0, 0.8), r: 12, a: 0.4, skip: (x, y) => Math.hypot(x - 960, (y - 470) * 1.1) < 300 || (y > 690 && Math.abs(x - 960) < 330) || y > 830 });
      selfSym(960, 470, 2.6, { p: dp(lt, 0, 0.5), ring: true, ringP: dp(lt, 0.3, 0.5) });
      hand('나', 960, 228, { size: 120, p: dp(lt, 0.2, 0.35) });
      hand("'나'라는 기호", 960, 760, { size: 64, color: INK(), p: dp(lt, 0.35, 0.4) });
    }],
    // 7 — a strange symbol: thinking of '나' changes the brain, the changed brain thinks of '나'
    [q.s(7), (t, lt) => {
      tor(t, { x: 600, s: 1.1, pose: 'think', face: 'think', p: dp(lt, 0, 0.6) });
      bubble(800, 110, 640, 380, { kind: 'thought', tail: [680, 520], p: dp(lt, 0.4, 0.5), body: (x, y, w, h) => {
        selfSym(x + 240, y + h / 2 + 20, 1.3, { ring: true, label: '나', size: 56 });
        hand('?', x + 470, y + h / 2, { size: 150 });
      } });
    }],
    [q.w('생각하면', 7), (t, lt) => {
      const cD = q.w('바뀌고', 7), cU = q.w('바뀐', 7), chg = dp(t, cD + 0.3, 0.6);
      selfSym(960, 270, 1.4, { p: dp(lt, 0, 0.5), ring: true, label: '나', size: 64 });
      selfField(960, 700, 330, 120, 30, { p: dp(lt, 0.2, 0.7), r: 15, lit: (x, y, i) => (chg > 0.5 ? i % 5 === 1 : i % 4 === 0), litA: 1 });
      inkArrow(1050, 330, 1220, 650, { via: [1440, 420], color: K, w: 6, p: dp(t, cD, 0.7), head: 28 });
      hand('뇌가 바뀜', 1560, 480, { size: 60, p: dp(t, cD + 0.3, 0.5) });
      inkArrow(700, 650, 870, 330, { via: [480, 420], color: K, w: 6, p: dp(t, cU, 0.7), head: 28 });
      hand('다시 생각', 360, 480, { size: 60, p: dp(t, cU + 0.3, 0.5) });
    }],
    // 8 — lower cells make the upper '나'; the upper '나' moves the lower cells
    [q.s(8), (t, lt) => selfLevels(t, { pBot: dp(lt, 0, 0.8), pUp: dp(lt, 0.8, 0.8), pTop: dp(lt, 1.4, 0.6), pDown: 0, up: '만든다', down: '움직인다' })],
    [q.w('다시', 8), (t, lt) => selfLevels(t, { pDown: dp(lt, 0.1, 0.8), up: '만든다', down: '움직인다' })],
    // 9 — "손을 들어야지" and the hand really goes up
    [q.s(9), (t, lt) => {
      figure(1200, GROUND, { s: 1.15, pose: 'stand', face: 'think', p: dp(lt, 0, 0.5) });
      bubble(420, 160, 620, 250, { kind: 'thought', tail: [1130, 520], text: '손을 들어야지', size: 64, p: dp(lt, 0.3, 0.5) });
    }],
    [q.w('수많은', 9), (t, lt) => {
      const up = t >= q.w('정말로', 9);
      figure(1200, GROUND, { s: 1.15, pose: up ? 'wave' : 'stand', face: up ? 'happy' : 'think', t });
      selfField(560, 470, 300, 220, 38, { p: dp(lt, 0, 0.6), r: 14, lit: (x, y, i) => ((i * 7) % 38) / 38 < dp(lt, 0.2, 1.2), litA: 1 });
      hand('수많은 세포', 560, 760, { size: 56, color: C.dim, p: dp(lt, 0.3, 0.5) });
      inkArrow(880, 460, 1255, 500, { via: [1120, 260], color: K, w: 6, dash: [16, 10], p: dp(lt, 0.9, 0.7), head: 28 });
      if (up) for (let k = 0; k < 3; k++) inkLine(1330 + k * 22, 470 - k * 30, 1360 + k * 22, 450 - k * 30, { w: 4, color: K, p: dp(t, q.w('정말로', 9) + 0.1 * k, 0.2) });
    }],
    // 10 — up, then back down: the same shape as the stairs, the canon, Gödel's sentence
    [q.s(10), (t, lt) => {
      selfLevels(t, { pBot: dp(lt, 0, 0.5), pTop: dp(lt, 0.1, 0.5), pUp: dp(lt, 0.3, 0.8), pDown: dp(lt, 1.1, 0.8), up: '올라감', down: '돌아옴', side: false });
      hand('고리', 960, 490, { size: 90, p: dp(lt, 1.9, 0.5) });
    }],
    [q.w('에셔의', 10), (t, lt) => {
      const e2 = q.w('바흐의', 10), e3 = q.w('괴델의', 10), e4 = q.w('같은', 10);
      penrose(330, 520, 0.56, { p: dp(lt, 0, 0.8), walker: lt * 0.12 });
      hand('계단', 320, 700, { size: 52, color: INK(), p: dp(lt, 0.5, 0.4) });
      selfNotes(740, 470, 1.25, { p: dp(t, e2, 0.8) });
      hand('돌림노래', 730, 700, { size: 52, color: INK(), p: dp(t, e2 + 0.5, 0.4) });
      selfGCard(1120, 490, 1.45, { p: dp(t, e3, 0.6) });
      hand('괴델 문장', 1110, 700, { size: 52, color: INK(), p: dp(t, e3 + 0.5, 0.4) });
      eqSign(1395, 480, { p: dp(t, e4, 0.4), s: 1.2 });
      selfSym(1640, 480, 1.75, { p: dp(t, e4 + 0.3, 0.5), ring: true, ringColor: C.red, label: '나', size: 80 });
    }],
    // 11 — the chapter question
    [q.s(11), (t, lt) => {
      board(540, 150, 840, 320, { term: "'나'는 어디에 있을까?", size: 78, p: dp(lt, 0, 0.8) });
      ach(t, { x: 360, s: 1.1, pose: 'shrug', face: 'think', p: dp(lt, 0.3, 0.6) });
      tor(t, { x: 1580, s: 1.0, pose: 'think', face: 'think', p: dp(lt, 0.5, 0.6) });
    }],
    // 12 — not in one cell: the loop itself is '나'
    [q.s(12), (t, lt) => {
      const pts = selfField(960, 740, 700, 90, 44, { p: dp(lt, 0, 0.7), r: 14 });
      let b = pts[0]; pts.forEach((pt) => { if (Math.hypot(pt[0] - 1100, pt[1] - 720) < Math.hypot(b[0] - 1100, b[1] - 720)) b = pt; });
      const zp = dp(lt, 0.6, 0.5);
      inkLine(b[0] - 12, b[1] - 10, 820, 470, { ...dashed, p: zp });
      inkLine(b[0] + 12, b[1] - 10, 1100, 470, { ...dashed, p: zp });
      inkCircle(b[0], b[1], 22, { w: 4, color: C.red, p: zp });
      inkCircle(960, 360, 180, { w: 6, fill: mix(C.paper, 0.5), p: zp });
      inkCircle(960, 360, 90, { w: 4.4, p: dp(lt, 0.9, 0.5) });
      hand('나?', 960, 362, { size: 76, p: dp(lt, 1.2, 0.4) });
      hand('세포 하나', 1330, 330, { size: 56, color: C.dim, p: dp(lt, 1.0, 0.5) });
      cross(810, 210, 300, 300, { p: dp(t, q.w('않아요', 12), 0.5), w: 8 });
    }],
    [q.w('고리', 12), (t, lt) => {
      selfLevels(t, { pBot: dp(lt, 0, 0.4), pTop: dp(lt, 0.1, 0.4), pUp: dp(lt, 0.2, 0.5), pDown: dp(lt, 0.5, 0.5), side: false });
      ring(960, 470, 650, 370, { p: dp(lt, 0.4, 0.6), w: 6 });
      hand('고리 = 나', 960, 490, { size: 84, p: dp(lt, 0.7, 0.5) });
    }],
    // 13 — a camera wired to a TV, filming that very TV
    [q.s(13), (t, lt) => {
      inkLine(480, 700, 480, 860, { w: 5, p: dp(lt, 0, 0.4) }); inkLine(410, 862, 550, 862, { w: 5, p: dp(lt, 0, 0.4) });
      prop('camera', 480, 700, 1.7, { p: dp(lt, 0, 0.6) });
      prop('monitor', 1400, 780, 2.3, { p: dp(lt, 0.4, 0.7) });
      inkCurve([480, 862], [940, 905], [1400, 766], { w: 3.6, color: C.dim, p: dp(lt, 1.0, 0.9) });
      hand('카메라', 480, 420, { size: 58, color: INK(), p: dp(lt, 0.6, 0.5) });
      hand('텔레비전', 1400, 320, { size: 58, color: INK(), p: dp(lt, 1.0, 0.5) });
      hand('연결', 940, 800, { size: 50, color: C.dim, p: dp(lt, 1.6, 0.5) });
    }],
    [q.w('찍는다고', 13), (t, lt) => {
      camTV(t, { sp: dp(lt, 0.8, 1.6) });
      const lx = 480 + 40, ly = 700 - 57 * 1.7;
      inkLine(lx, ly, 1170, 400, { dash: [14, 10], color: K, w: 3.6, p: dp(lt, 0, 0.6) });
      inkLine(lx, ly, 1170, 660, { dash: [14, 10], color: K, w: 3.6, p: dp(lt, 0.2, 0.6) });
      hand('찍는다', 830, 380, { size: 58, p: dp(lt, 0.6, 0.5) });
    }],
    // 14 — screens inside screens: a turning vortex
    [q.s(14), (t, lt) => {
      inkRect(500, 120, 920, 610, { w: 6, fill: mix(C.paper, 0.25), p: dp(lt, 0, 0.5) });
      inkLine(960, 730, 960, 800, { w: 6, p: dp(lt, 0.2, 0.3) }); inkLine(820, 806, 1100, 806, { w: 6, p: dp(lt, 0.2, 0.3) });
      screenLoop(960, 425, 1.42, { p: dp(lt, 0.2, 1.4), t: t * 2.5, n: 9 });
      selfLoopAround(960, 425, 48, 48, { a0: t * 1.6, span: 4.6, p: dp(lt, 1.2, 0.5), w: 6, head: 18 });
      prop('camera', 250, 820, 0.95, { p: dp(lt, 0, 0.5) });
      inkLine(300, 760, 500, 300, { ...dashed, p: dp(lt, 0.4, 0.5) });
      inkLine(300, 760, 500, 690, { ...dashed, p: dp(lt, 0.4, 0.5) });
      hand('소용돌이', 1650, 330, { size: 72, p: dp(t, q.w('소용돌이', 14), 0.6) });
    }],
    // 15 — the vortex is in neither; it is in the loop between them
    [q.s(15), (t, lt) => {
      camTV(t, { ring1: dp(t, q.w('카메라에도', 15), 0.5), ring2: dp(t, q.w('화면에도', 15), 0.5) });
      hand('소용돌이는?', 940, 190, { size: 66, p: dp(lt, 0, 0.6) });
    }],
    [q.w('둘이', 15), (t, lt) => {
      camTV(t);
      inkArrow(640, 470, 1150, 400, { via: [900, 250], color: K, w: 6, p: dp(lt, 0.1, 0.7), head: 28 });
      inkArrow(1150, 720, 640, 720, { via: [900, 880], color: K, w: 6, p: dp(lt, 0.6, 0.7), head: 28 });
      const cl = q.w('고리에', 15);
      ring(900, 570, 280, 240, { p: dp(t, cl, 0.6), w: 6 });
      hand('고리', 900, 580, { size: 84, p: dp(t, cl + 0.4, 0.5) });
    }],
    // 16 — the 2007 book: '나는 이상한 고리'
    [q.s(16), (t, lt) => {
      prop('calendar', 760, 700, 2.6, { label: '2007', p: dp(lt, 0, 0.7) });
      figure(1300, GROUND, { s: 1.15, glasses: true, pose: 'present', flip: true, face: 'smile', p: dp(lt, 0.3, 0.6) });
      hand('호프스태터', 1300, 440, { size: 56, color: INK(), p: dp(lt, 0.8, 0.5) });
    }],
    [q.w('제목을', 16), (t, lt) => {
      figure(520, GROUND, { s: 1.15, glasses: true, pose: 'present', face: 'happy', p: dp(lt, 0, 0.5) });
      bookCover(780, 140, 560, 680, { title: '나는 이상한 고리', author: '호프스태터', note: '2007', size: 80, p: dp(lt, 0.2, 1.4) });
      prop('loop', 1072, 640, 0.95, { color: K, p: dp(lt, 1.4, 0.6) });
    }],
    // 17 — Gödel's sentence speaks of itself in numbers; the brain, in cell signals
    [q.s(17), (t, lt) => {
      const r2 = q.w('우리', 17);
      hand('괴델', 250, 290, { size: 60, color: C.dim, p: dp(lt, 0, 0.4) });
      selfGCard(600, 290, 0.95, { p: dp(lt, 0.1, 0.6), arrow: false });
      selfLoopAround(600, 290, 130, 125, { p: dp(lt, 0.6, 0.8) });
      hand('수로', 1010, 290, { size: 70, align: 'right', p: dp(lt, 1.0, 0.4) });
      hand(' 자기를 말함', 1020, 290, { size: 70, align: 'left', color: INK(), p: dp(lt, 1.3, 0.7) });
      eqSign(600, 468, { p: dp(t, r2, 0.4) });
      hand('뇌', 250, 650, { size: 60, color: C.dim, p: dp(t, r2, 0.4) });
      selfSym(600, 650, 1.3, { p: dp(t, r2 + 0.1, 0.5) });
      selfLoopAround(600, 650, 130, 125, { p: dp(t, r2 + 0.5, 0.8) });
      hand('신호로', 1010, 650, { size: 70, align: 'right', p: dp(t, r2 + 0.9, 0.4) });
      hand(' 자기를 말함', 1020, 650, { size: 70, align: 'left', color: INK(), p: dp(t, r2 + 1.2, 0.7) });
    }],
    // 18 — the system cannot prove all its truths; '나' cannot see all of itself
    [q.s(18), (t, lt) => {
      inkEllipse(900, 470, 620, 330, { ...dashed, p: dp(lt, 0, 0.8) });
      hand('참인 말', 520, 290, { size: 56, color: C.dim, p: dp(lt, 0.3, 0.5) });
      inkRect(560, 360, 480, 310, { w: 4.4, fill: mix(C.paper, 0.5), p: dp(lt, 0.4, 0.6) });
      hand('증명됨', 800, 410, { size: 54, color: C.green, p: dp(lt, 0.8, 0.5) });
      for (let k = 0; k < 6; k++) {
        const x = 650 + (k % 3) * 150, y = 520 + Math.floor(k / 3) * 80, qq = dp(lt, 1.0 + k * 0.1, 0.3);
        inkPath([[x - 18, y], [x - 4, y + 16], [x + 22, y - 18]], { w: 5, color: C.green, p: qq });
      }
      const g = q.w('증명하지', 18);
      selfGCard(1270, 500, 1.0, { p: dp(t, g - 0.6, 0.6), arrow: false });
      hand('참', 1270, 360, { size: 60, color: C.green, p: dp(t, g - 0.3, 0.4) });
      ring(1270, 500, 110, 130, { p: dp(t, g, 0.5) });
      hand('증명 ✗', 1270, 690, { size: 54, color: C.red, p: dp(t, g + 0.4, 0.5) });
    }],
    [q.w('나도', 18), (t, lt) => {
      const s = 1.1, hy = 830 - 292 * s;
      figure(960, 830, { s, face: 'think', look: 1, p: dp(lt, 0, 0.6) });
      inkArrow(1014, hy - 6, 1004, 700, { via: [1290, 560], dash: [12, 9], color: C.dim, w: 4, p: dp(lt, 0.5, 0.8) });
      hand('?', 1085, 700, { size: 84, color: C.red, p: dp(lt, 1.2, 0.3) });
      hand('다 볼 수 없다', 390, 600, { size: 58, color: INK(), p: dp(lt, 1.4, 0.6) });
      const cl = q.w('고리', 18);
      selfLoopAround(960, 590, 350, 290, { p: dp(t, cl, 0.9), w: 6 });
      hand('고리 안', 1520, 330, { size: 72, p: dp(t, cl + 0.6, 0.5) });
    }],
    // 19 — closing chain: cells without meaning -> a symbol -> a symbol that points at itself = '나'
    [q.s(19), (t, lt) => {
      const c2 = q.w('기호가', 19), c3 = q.w('가리킬', 19), c4 = q.w('생겨요', 19);
      selfField(370, 470, 180, 130, 16, { p: dp(lt, 0, 0.8), r: 15 });
      hand('뜻 없는 세포', 370, 690, { size: 56, color: C.dim, p: dp(lt, 0.5, 0.5) });
      inkArrow(590, 470, 800, 470, { color: K, w: 6, p: dp(t, c2 - 0.3, 0.5), head: 28 });
      selfSym(960, 470, 1.7, { p: dp(t, c2, 0.6), lit: dp(t, c2 + 0.3, 0.5) });
      hand('기호', 960, 690, { size: 64, p: dp(t, c2 + 0.4, 0.5) });
      inkArrow(1120, 470, 1360, 470, { color: K, w: 6, p: dp(t, c3 - 0.3, 0.5), head: 28 });
      selfSym(1560, 470, 1.4, { p: dp(t, c3, 0.6), ring: true });
      selfLoopAround(1560, 470, 155, 155, { p: dp(t, c3 + 0.4, 0.8), w: 6 });
      hand('나', 1560, 700, { size: 90, p: dp(t, Math.min(c4 - 0.8, c3 + 0.6), 0.4) });
      ring(1560, 698, 78, 62, { p: dp(t, Math.min(c4 - 0.5, c3 + 1.0), 0.45) });
    }],
  ]);
};

// ---------- today: 에필로그 — 기계도 '나'를 가질까 ----------
// 1979 → can machines think? → shape, not material → wrong chess guess (1997) → 2023 fear → the question walks out
// of the book → today's AI crunches numbers below → will a loop, a '나', form? → recap chain → the reader's own loop.

// a robot: a stick figure with a square head and an antenna
function todayRobot(x, y, o = {}) {
  const s = o.s ?? 1, p = o.p ?? 1, a = o.a ?? 1;
  if (p <= 0 || a <= 0) return;
  figure(x, y, { ...o, face: 'neutral' });
  const hx = x, hy = y - 292 * s, h = 56 * s, lw = 4.2 * Math.max(0.7, Math.sqrt(s));
  withAlpha(a * clamp01(p * 6), () => { ctx.fillStyle = PAPER(); ctx.fillRect(hx - h - 3, hy - h - 3, 2 * h + 6, 2 * h + 6); });
  inkRect(hx - h, hy - h, 2 * h, 2 * h, { p: clamp01(p * 1.5), a, w: lw, fill: mix(C.paper, 0.35) });
  const f = clamp01(p * 2 - 1);
  if (f <= 0) return;
  inkRect(hx - 30 * s, hy - 20 * s, 18 * s, 16 * s, { a: a * f, w: 3, fill: INK() });
  inkRect(hx + 12 * s, hy - 20 * s, 18 * s, 16 * s, { a: a * f, w: 3, fill: INK() });
  inkLine(hx - 20 * s, hy + 24 * s, hx + 20 * s, hy + 24 * s, { a: a * f, w: 3.4 });
  inkLine(hx, hy - h, hx, hy - h - 32 * s, { a: a * f, w: lw });
  disc(hx, hy - h - 40 * s, 10 * s, C.red, a * f);
}
// brain cells in an ellipse (sunflower layout)
function todayCells(cx, cy, rx, ry, n, { p = 1, a = 1, r = 14, lit = null } = {}) {
  const K = KEY();
  for (let i = 0; i < n; i++) {
    const u = Math.sqrt((i + 0.5) / n), g = i * 2.39996 + 0.7, x = cx + Math.cos(g) * u * rx, y = cy + Math.sin(g) * u * ry;
    const on = lit && lit(i), q = clamp01((p - (i / n) * 0.6) / 0.4);
    inkCircle(x, y, r, { p: q, a, w: 3, color: on ? K : INK(), fill: on ? mix(K, 0.7) : PAPER() });
  }
}
// a circuit board chip with traces
function todayCircuit(x, y, s = 1, { p = 1, a = 1 } = {}) {
  if (p <= 0) return;
  const o = { a, w: 3.8 };
  inkRect(x - 120 * s, y - 90 * s, 240 * s, 180 * s, { ...o, p, fill: mix(C.green, 0.18) });
  const q = clamp01(p * 2 - 0.6);
  for (let i = 0; i < 6; i++) { const xx = x - 100 * s + i * 40 * s; inkLine(xx, y - 90 * s, xx, y - 118 * s, { ...o, p: q }); inkLine(xx, y + 90 * s, xx, y + 118 * s, { ...o, p: q }); }
  for (const tr of [[[-90, -50], [-30, -50], [-30, 0], [40, 0]], [[-90, 40], [10, 40], [10, -40], [90, -40]], [[40, 0], [90, 0], [90, 50]]]) {
    inkPoly(tr.map(([dx, dy]) => [x + dx * s, y + dy * s]), { ...o, p: q, w: 3 });
    inkDot(x + tr[0][0] * s, y + tr[0][1] * s, 7 * s, { a, p: q }); const e = tr[tr.length - 1]; inkDot(x + e[0] * s, y + e[1] * s, 7 * s, { a, p: q });
  }
}
// rows of digits that keep changing (number crunching)
function todayDigits(x, y, w, rows, { t = 0, p = 1, a = 1, size = 40, color = null } = {}) {
  const n = Math.max(3, Math.floor(w / (size * 0.78))), lh = size * 1.25, step = Math.floor(t * 5);
  for (let r = 0; r < rows; r++) {
    let str = '';
    for (let i = 0; i < n; i++) { const v = Math.abs(Math.sin((i + 1) * 12.9898 + (r + step) * 78.233) * 43758.5453) % 1; str += (i ? ' ' : '') + Math.floor(v * 10); }
    hand(str, x, y + (r - (rows - 1) / 2) * lh, { size, p: clamp01(p * rows - r), a, color: color || C.dim, weight: 400 });
  }
}
// a question mark with legs; (x, y) = feet
function todayQWalk(x, y, s, t, { p = 1, a = 1, walking = false } = {}) {
  if (p <= 0) return;
  hand('?', x, y - 120 * s, { size: 230 * s, a: a * clamp01(p * 3), color: KEY() });
  const sw = walking ? Math.sin(t * 9) : 0, q = clamp01(p * 2 - 0.5);
  for (const k of [-1, 1]) {
    const fx = x + k * 16 * s + sw * k * 20 * s;
    inkPoly([[x + k * 6 * s, y - 40 * s], [x + k * 10 * s + sw * k * 10 * s, y - 18 * s], [fx, y]], { a, w: 5.5 * s, p: q });
    inkLine(fx, y, fx + 16 * s, y, { a, w: 5.5 * s, p: q });
  }
}
// an elliptical arrow going round (cx, cy)
function todayLoopAround(cx, cy, rx, ry, { p = 1, a = 1, color = null, w = 5, a0 = -Math.PI * 0.3, span = Math.PI * 1.7, dash = null, head = 26 } = {}) {
  if (p <= 0 || a <= 0) return;
  const c = color || KEY(), ps = clamp01(p / 0.85), ph = clamp01((p - 0.85) / 0.15);
  inkArc(cx, cy, rx, ry, a0, a0 + span, { p: ps, a, color: c, w, dash });
  if (ph <= 0) return;
  const g = a0 + span, x = cx + Math.cos(g) * rx, y = cy + Math.sin(g) * ry;
  const ang = Math.atan2(Math.cos(g) * ry, -Math.sin(g) * rx);
  inkPath([[x - Math.cos(ang - 0.45) * head, y - Math.sin(ang - 0.45) * head], [x, y], [x - Math.cos(ang + 0.45) * head, y - Math.sin(ang + 0.45) * head]], { p: ph, a, color: c, w });
}
// a computer playing chess: a monitor with a board on its screen
function todayChessPC(x, y, s = 1, { p = 1, a = 1 } = {}) {
  if (p <= 0) return;
  prop('monitor', x, y, s, { p, a });
  const q = clamp01(p * 2 - 1);
  if (q <= 0) return;
  const x0 = x - 90 * s, y0 = y - 162 * s, cw = 36 * s, ch = 38 * s;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) if ((r + c) % 2 === 0) inkRect(x0 + c * cw, y0 + r * ch, cw, ch, { a: a * q, w: 1.6, fill: mix(INK(), 0.55), jit: 0.4 });
}
// magnifier held at (hx, hy), pointing along ang
function todayMag(hx, hy, ang, s = 1, { p = 1, a = 1 } = {}) {
  const c = Math.cos(ang), sn = Math.sin(ang), L = 70 * s, R = 50 * s;
  inkLine(hx, hy, hx + c * L, hy + sn * L, { p: clamp01(p * 2), a, w: 9 });
  inkCircle(hx + c * (L + R), hy + sn * (L + R), R, { p: clamp01(p * 2 - 0.6), a, w: 5, fill: mix(C.paper, 0.4) });
}
// three stacked layers (levels)
function todayLayers(x, y, s = 1, { p = 1, a = 1, t = 0 } = {}) {
  for (let k = 0; k < 3; k++) {
    const yy = y + (k - 1) * 130 * s, q = clamp01(p * 3 - (2 - k));
    if (q <= 0) continue;
    inkRect(x - 200 * s, yy - 50 * s, 400 * s, 100 * s, { p: q, a, w: 4.4, fill: mix(C.paper, 0.55) });
    if (k === 2) todayDigits(x, yy, 330 * s, 1, { t, p: q, a, size: 40 * s });
    if (k === 1) for (let i = 0; i < 5; i++) inkCircle(x - 120 * s + i * 60 * s, yy, 15 * s, { p: q, a, w: 3, color: KEY(), fill: mix(KEY(), 0.5) });
    if (k === 0) hand('?', x, yy + 4 * s, { size: 72 * s, p: q, a });
  }
}

SCENES.today = (t, q) => {
  const K = KEY();
  const dashed = { dash: [14, 10], color: C.dim, w: 3.4 };
  const labels = ['시작', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '끝'];
  // the closing picture (sentence 23): a figure thinking about its own thinking
  const thinkThink = (t, lt) => {
    figure(760, 720, { s: 0.8, pose: 'think', face: 'think', p: dp(lt, 0, 0.5) });
    bubble(880, 150, 520, 300, { kind: 'thought', tail: [790, 470], p: dp(lt, 0.3, 0.5), body: (x, y, w, h) => {
      figure(x + 160, y + h - 20, { s: 0.44, pose: 'think', face: 'think', p: dp(lt, 0.6, 0.5) });
      bubble(x + 240, y + 26, 200, 120, { kind: 'thought', tail: [x + 180, y + h - 150], p: dp(lt, 0.9, 0.4), body: (x2, y2, w2, h2) =>
        figure(x2 + w2 / 2, y2 + h2 - 8, { s: 0.2, pose: 'think', face: 'think', p: dp(lt, 1.1, 0.4) }) });
    } });
    hand('생각의 생각', 320, 230, { size: 58, p: dp(lt, 1.4, 0.5) });
  };

  return shots(t, [
    // 0 — 1979: thinking machines were far away
    [q.s(0), (t, lt) => {
      prop('calendar', 620, 720, 2.8, { label: '1979', p: dp(lt, 0, 0.8) });
      bookCover(1040, 180, 440, 580, { title: '괴델, 에셔, 바흐', author: '호프스태터', size: 66, p: dp(lt, 0.4, 1.2) });
    }],
    [q.w('생각하는', 0), (t, lt) => {
      figure(360, GROUND, { s: 1.15, pose: 'point', face: 'think', p: dp(lt, 0, 0.5) });
      inkLine(470, 880, 1260, 770, { ...dashed, p: dp(lt, 0.2, 0.6) });
      prop('mountain', 1460, 780, 1.5, { p: dp(lt, 0.3, 0.7) });
      todayRobot(1385, 780 - 170 * 1.5, { s: 0.34, p: dp(lt, 0.8, 0.6) });
      hand('?', 1480, 400, { size: 80, p: dp(lt, 1.2, 0.4) });
      hand('먼 이야기', 960, 300, { size: 80, p: dp(lt, 1.3, 0.6) });
    }],
    // 1 — at the end of the book he asked: can machines think?
    [q.s(1), (t, lt) => {
      figure(460, GROUND, { s: 1.15, glasses: true, pose: 'point', face: 'smile', p: dp(lt, 0, 0.5) });
      prop('openbook', 1200, 800, 2.8, { p: dp(lt, 0.2, 0.7) });
      inkLine(1440, 760, 1452, 860, { color: C.red, w: 9, p: dp(lt, 0.9, 0.4) });
      inkArrow(1420, 330, 1470, 410, { color: K, w: 5, p: dp(lt, 1.3, 0.4) });
      hand('책 끝부분', 1200, 290, { size: 72, p: dp(lt, 1.0, 0.6) });
    }],
    [q.w('기계가', 1), (t, lt) => {
      figure(480, GROUND, { s: 1.15, glasses: true, pose: 'point', face: 'think', p: dp(lt, 0, 0.5) });
      todayRobot(1220, GROUND, { s: 1.15, p: dp(lt, 0.2, 0.7) });
      hand('?', 1460, 360, { size: 220, p: dp(lt, 0.8, 0.4) });
      bubble(520, 130, 560, 190, { tail: [540, 500], text: '생각할 수 있을까?', size: 56, p: dp(lt, 0.6, 0.4) });
    }],
    // 2 — thought comes from a shape, not from a material
    [q.s(2), (t, lt) => {
      figure(560, GROUND, { s: 1.15, glasses: true, pose: 'think', face: 'think', p: dp(lt, 0, 0.5) });
      bubble(760, 120, 560, 370, { kind: 'thought', tail: [610, 510], p: dp(lt, 0.3, 0.5), body: (x, y, w, h) => prop('bulb', x + w / 2, y + h - 30, 1.35, { p: dp(lt, 0.5, 0.5) }) });
      hand('생각', 1040, 600, { size: 76, p: dp(lt, 0.9, 0.5) });
    }],
    [q.w('재료가', 2), (t, lt) => {
      prop('bulb', 960, 420, 1.4, { p: dp(lt, 0, 0.5) });
      hand('생각', 960, 470, { size: 64, p: dp(lt, 0.2, 0.4) });
      prop('rock', 520, 800, 1.6, { p: dp(lt, 0.2, 0.5) });
      hand('재료', 520, 852, { size: 60, color: INK(), p: dp(lt, 0.4, 0.4) });
      cross(380, 640, 280, 180, { p: dp(t, q.w('아니라', 2), 0.5), w: 8 });
      prop('loop', 1400, 800, 1.6, { p: dp(lt, 0.5, 0.6), color: K });
      hand('모양', 1400, 852, { size: 60, color: INK(), p: dp(lt, 0.7, 0.4) });
      ring(1400, 656, 150, 140, { p: dp(t, q.w('모양에서', 2), 0.5), w: 6 });
      inkArrow(1260, 600, 1080, 450, { color: K, w: 5, p: dp(t, q.w('모양에서', 2) + 0.4, 0.5) });
    }],
    // 3 — cells or circuits: layers + a self-pointing loop -> thought
    [q.s(3), (t, lt) => {
      todayCells(520, 480, 250, 180, 28, { p: dp(lt, 0, 0.8) });
      hand('세포', 520, 750, { size: 72, color: INK(), p: dp(lt, 0.4, 0.5) });
      const cr = q.w('회로든', 3);
      todayCircuit(1400, 480, 1.5, { p: dp(t, cr, 0.8) });
      hand('회로', 1400, 750, { size: 72, color: INK(), p: dp(t, cr + 0.4, 0.5) });
    }],
    [q.w('고리를', 3), (t, lt) => {
      todayCells(520, 540, 210, 150, 26, { lit: (i) => i % 3 === 0 });
      todayCircuit(1400, 540, 1.25);
      todayLoopAround(520, 540, 290, 220, { p: dp(lt, 0.1, 0.9), w: 6 });
      todayLoopAround(1400, 540, 290, 220, { p: dp(lt, 0.3, 0.9), w: 6 });
      eqSign(960, 540, { p: dp(lt, 0.9, 0.4), s: 1.3 });
      const cg = q.w('생각이', 3);
      prop('bulb', 960, 300, 1.0, { p: dp(t, cg, 0.5) });
      hand('생각', 960, 360, { size: 56, p: dp(t, cg + 0.3, 0.4) });
      hand('세포', 520, 820, { size: 52, color: INK(), weight: 400 });
      hand('회로', 1400, 820, { size: 52, color: INK(), weight: 400 });
    }],
    // 4 — but some of his guesses were wrong
    [q.s(4), (t, lt) => {
      figure(560, GROUND, { s: 1.15, glasses: true, pose: 'point', face: 'think', p: dp(lt, 0, 0.5) });
      inkCircle(1180, 540, 170, { w: 6, fill: mix(C.paper, 0.35), p: dp(lt, 0.2, 0.6) });
      inkPath([[1070, 700], [1290, 700], [1330, 790], [1030, 790]], { closed: true, w: 5, fill: mix(C.yellow, 0.3), p: dp(lt, 0.3, 0.5) });
      prop('pawn', 1180, 640, 1.0, { p: dp(lt, 0.6, 0.5) });
      hand('예측', 1180, 280, { size: 76, p: dp(lt, 0.8, 0.5) });
      cross(1030, 380, 300, 320, { p: dp(lt, 1.6, 0.5), w: 8 });
    }],
    // 5 — "a chess-only program won't beat everyone"... in 1997 one beat the world champion
    [q.s(5), (t, lt) => {
      figure(460, GROUND, { s: 1.15, glasses: true, pose: 'think', face: 'smile', p: dp(lt, 0, 0.5) });
      bubble(640, 110, 820, 400, { kind: 'thought', tail: [510, 510], p: dp(lt, 0.3, 0.5), body: (x, y, w, h) => {
        todayChessPC(x + 200, y + h - 50, 1.3, { p: dp(lt, 0.5, 0.6) });
        prop('pawn', x + 420, y + h - 50, 1.0, { p: dp(lt, 0.8, 0.4) });
        prop('trophy', x + 620, y + h - 50, 1.3, { p: dp(lt, 1.0, 0.5) });
        cross(x + 540, y + 100, 160, 220, { p: dp(t, q.w('못할', 5), 0.5), w: 7 });
      } });
    }],
    [q.w('천구백구십칠', 5), (t, lt) => {
      const win = q.w('이겼어요', 5), won = t >= win;
      prop('calendar', 300, 430, 1.5, { label: '1997', p: dp(lt, 0, 0.5) });
      todayChessPC(820, 800, 2.0, { p: dp(lt, 0.3, 0.6) });
      prop('pawn', 1100, 800, 1.0, { p: dp(lt, 0.5, 0.4) });
      figure(1480, GROUND, { s: 1.1, face: won ? 'sad' : 'neutral', pose: won ? 'slump' : 'akimbo', p: dp(lt, 0.4, 0.6) });
      hand('세계 챔피언', 1480, 430, { size: 52, color: INK(), p: dp(lt, 0.8, 0.5) });
      prop('trophy', 820, 430, 1.3, { p: dp(t, win, 0.5) });
      bubble(1200, 110, 470, 200, { kind: 'thought', text: '체스 최강? 못 돼', size: 50, p: dp(lt, 0.6, 0.4) });
      cross(1260, 120, 350, 180, { p: dp(t, win + 0.5, 0.5), w: 7 });
    }],
    // 6 — 2023: talking AIs pour out; he says in an interview that he is scared
    [q.s(6), (t, lt) => {
      prop('calendar', 300, 470, 1.5, { label: '2023', p: dp(lt, 0, 0.5) });
      prop('laptop', 960, 860, 2.2, { p: dp(lt, 0.2, 0.6) });
      const spots = [[620, 470], [1160, 450], [880, 320], [500, 270], [1400, 280], [700, 150], [1100, 150], [1500, 560]];
      spots.forEach(([tx, ty], i) => {
        const u = dp(lt, 0.8 + i * 0.32, 0.5); if (u <= 0) return;
        const e = smooth(u), bx = lerp(960, tx, e) - 120, by = lerp(640, ty, e) - 50;
        bubble(bx, by, 240, 100, { p: u, body: (x, y, w, h) => { for (let k = 0; k < 2; k++) inkLine(x + 34, y + 36 + k * 30, x + w - 34 - k * 50, y + 36 + k * 30, { w: 3.4, color: C.dim }); } });
      });
    }],
    [q.w('인터뷰에서', 6), (t, lt) => {
      prop('laptop', 480, 860, 1.7, { p: dp(lt, 0, 0.4) });
      [[300, 420], [560, 330], [380, 210]].forEach(([x, y], i) => bubble(x - 100, y - 45, 200, 90, { p: dp(lt, 0.1 + i * 0.1, 0.3), body: (bx, by, w, h) => inkLine(bx + 30, by + h / 2, bx + w - 40, by + h / 2, { w: 3.4, color: C.dim }) }));
      inkLine(1020, 870, 1020, 640, { w: 5, p: dp(lt, 0.2, 0.4) }); inkLine(970, 872, 1070, 872, { w: 5, p: dp(lt, 0.2, 0.4) });
      inkEllipse(1036, 618, 20, 28, { w: 5, fill: INK(), p: dp(lt, 0.3, 0.4) });
      figure(1260, GROUND, { s: 1.15, glasses: true, face: 'worried', pose: 'stand', p: dp(lt, 0.2, 0.5) });
      bubble(1330, 170, 400, 180, { tail: [1300, 500], text: '무섭다', size: 80, p: dp(lt, 0.7, 0.4) });
    }],
    // 7 — the fear: the mind may be less mysterious; humans may fall behind
    [q.s(7), (t, lt) => {
      figure(460, GROUND, { s: 1.15, glasses: true, face: 'worried', pose: 'think', p: dp(lt, 0, 0.5) });
      bubble(640, 110, 760, 420, { kind: 'thought', tail: [510, 510], p: dp(lt, 0.3, 0.5), body: (x, y, w, h) => {
        prop('heart', x + 270, y + h - 70, 2.0, { p: dp(lt, 0.5, 0.6) });
        const fade = 1 - 0.75 * dp(lt, 2.2, 1.0);
        [[x + 120, y + 110], [x + 420, y + 120], [x + 130, y + 320], [x + 430, y + 330]].forEach(([sx, sy], i) => prop('star', sx, sy, 0.5, { p: dp(lt, 0.8 + i * 0.12, 0.4), a: fade }));
        hand('신비?', x + 600, y + h / 2, { size: 84, p: dp(lt, 1.4, 0.5) });
      } });
    }],
    [q.w('인류가', 7), (t, lt) => {
      figure(460, GROUND, { s: 1.15, glasses: true, face: 'worried', pose: 'think' });
      bubble(640, 110, 840, 420, { kind: 'thought', tail: [510, 510], p: dp(lt, 0, 0.4), body: (x, y, w, h) => {
        const g = y + h - 40;
        for (let k = 0; k < 3; k++) figure(x + 120 + k * 80, g, { s: 0.5, face: 'sad', p: dp(lt, 0.3 + k * 0.1, 0.4) });
        const rx = x + 560 + 90 * smooth(dp(lt, 0.6, 2.0));
        todayRobot(rx, g, { s: 0.55, walk: 1, t: lt, p: dp(lt, 0.4, 0.5) });
        for (let k = 0; k < 3; k++) inkLine(rx - 150 - k * 20, g - 150 + k * 40, rx - 70 - k * 20, g - 150 + k * 40, { w: 3.4, color: C.dim, p: dp(lt, 0.8, 0.3) });
      } });
      hand('두려움', 1650, 640, { size: 76, p: dp(lt, 0.9, 0.5) });
    }],
    // 8 — the book's question walks out of the book
    [q.s(8), (t, lt) => {
      prop('openbook', 520, 760, 2.6, { p: dp(lt, 0, 0.6) });
      inkLine(800, 884, 1700, 884, { ...dashed, p: dp(lt, 0.2, 0.6) });
      const u = clamp01((lt - 0.5) / 2.8), x = 560 + 820 * smooth(u);
      const k = clamp01((u - 0.2) / 0.18), y = u < 0.2 ? 700 : u < 0.38 ? lerp(700, 880, k) - Math.sin(k * Math.PI) * 80 : 880;
      todayQWalk(x, y, 1.05, t, { p: dp(lt, 0.2, 0.5), walking: u > 0 && u < 1 });
      hand('책장 밖으로', 1300, 300, { size: 76, p: dp(lt, 1.6, 0.6) });
    }],
    // 9 — today's AI, one floor down: number crunching without meaning
    [q.s(9), (t, lt) => {
      prop('laptop', 900, 450, 2.0, { p: dp(lt, 0, 0.5) });
      bubble(1170, 110, 330, 130, { tail: [1080, 260], text: '안녕!', size: 60, p: dp(lt, 0.4, 0.4) });
      inkLine(300, 530, 1620, 530, { ...dashed, p: dp(lt, 0.6, 0.5) });
      hand('위층', 230, 330, { size: 50, color: C.dim, weight: 400, p: dp(lt, 0.5, 0.4) });
      hand('아래층', 230, 700, { size: 50, color: C.dim, weight: 400, p: dp(lt, 0.8, 0.4) });
      todayDigits(980, 700, 1150, 4, { t, p: dp(lt, 0.9, 0.8), size: 48 });
    }],
    [q.w('숫자', 9), (t, lt) => {
      prop('laptop', 900, 860, 3.3, { p: dp(lt, 0, 0.4) });
      todayDigits(900, 618, 450, 6, { t, p: dp(lt, 0.2, 0.6), size: 42 });
      const gx = 1560, gy = 520 - 80 * 1.2;
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(t * 1.2); ctx.translate(-gx, -gy);
      prop('gear', gx, 520, 1.2, { p: dp(lt, 0.3, 0.5) });
      ctx.restore();
      hand('되풀이', 1560, 650, { size: 60, color: INK(), p: dp(lt, 0.6, 0.4) });
      hand('뜻 모르는 계산', 900, 230, { size: 76, p: dp(lt, 0.8, 0.6) });
    }],
    // 10 — will it get a self-pointing loop? would there be a '나'?
    [q.s(10), (t, lt) => {
      todayRobot(960, GROUND, { s: 1.15, p: dp(lt, 0, 0.6) });
      todayLoopAround(960, GROUND - 300 * 1.15, 180, 150, { p: dp(lt, 0.6, 1.0), dash: [16, 10], w: 6 });
      hand('?', 1280, 400, { size: 180, p: dp(lt, 1.4, 0.4) });
      hand('고리?', 560, 420, { size: 80, p: dp(lt, 1.6, 0.5) });
    }],
    [q.w('생긴다면', 10), (t, lt) => {
      board(440, 140, 1040, 380, { p: dp(lt, 0, 0.6) });
      hand('고리가 생길까?', 960, 260, { size: 80, p: dp(lt, 0.3, 0.8) });
      hand("'나'가 있을까?", 960, 400, { size: 80, p: dp(t, q.w('나가', 10), 0.8) });
      todayRobot(260, GROUND, { s: 0.85, p: dp(lt, 0.2, 0.5) });
      tor(t, { x: 1650, pose: 'think', face: 'think', p: dp(lt, 0.4, 0.5) });
    }],
    // 11 — the book: 'it could' (shape, not material); but nobody knows yet
    [q.s(11), (t, lt) => {
      prop('openbook', 460, 800, 2.4, { p: dp(lt, 0, 0.5) });
      bubble(520, 130, 620, 200, { tail: [500, 460], text: "'그럴 수 있다'", size: 72, p: dp(lt, 0.4, 0.4) });
      ring(830, 232, 270, 80, { p: dp(lt, 1.2, 0.5) });
      const cm = q.w('재료가', 11);
      prop('rock', 1260, 760, 1.2, { p: dp(t, cm, 0.4) });
      hand('재료', 1260, 830, { size: 56, color: INK(), p: dp(t, cm + 0.2, 0.4) });
      cross(1150, 630, 220, 150, { p: dp(t, cm + 0.5, 0.4), w: 7 });
      prop('loop', 1600, 760, 1.2, { color: K, p: dp(t, cm + 0.7, 0.5) });
      hand('모양', 1600, 830, { size: 56, color: INK(), p: dp(t, cm + 0.9, 0.4) });
      ring(1600, 652, 110, 105, { p: dp(t, q.w('모양이', 11), 0.5) });
    }],
    [q.w('다만', 11), (t, lt) => {
      todayRobot(960, GROUND, { s: 1.15, p: dp(lt, 0, 0.5) });
      hand('?', 1150, 420, { size: 150, p: dp(lt, 0.4, 0.4) });
      ach(t, { x: 460, s: 1.1, pose: 'shrug', face: 'neutral', p: dp(lt, 0.3, 0.5) });
      tor(t, { x: 1460, s: 1.0, pose: 'shrug', face: 'neutral', p: dp(lt, 0.5, 0.5) });
      hand('아직 아무도 모름', 960, 200, { size: 80, p: dp(t, q.w('아무도', 11), 0.7) });
    }],
    // 12 — no answer key; it teaches how to ask
    [q.s(12), (t, lt) => {
      prop('paper', 760, 820, 2.6, { p: dp(lt, 0, 0.5), blank: true });
      hand('정답', 760, 420, { size: 100, color: INK(), p: dp(lt, 0.4, 0.5) });
      for (let k = 0; k < 4; k++) inkLine(640, 540 + k * 60, 880, 540 + k * 60, { w: 3, color: C.dim, p: dp(lt, 0.6 + k * 0.1, 0.3) });
      cross(580, 330, 360, 460, { p: dp(lt, 1.4, 0.5), w: 9 });
      figure(1340, GROUND, { s: 1.15, glasses: true, pose: 'shrug', face: 'smile', p: dp(lt, 0.3, 0.5) });
    }],
    [q.w('대신', 12), (t, lt) => {
      figure(400, GROUND, { s: 1.15, pose: 'present', face: 'happy', p: dp(lt, 0, 0.5) });
      prop('key', 1100, 720, 3.2, { p: dp(lt, 0.3, 0.7), color: C.yellow });
      hand('?', 1100 - 60 * 3.2, 720 - 60 * 3.2 + 4, { size: 130, p: dp(lt, 0.9, 0.4) });
      hand('질문 던지는 법', 1100, 280, { size: 80, p: dp(lt, 1.2, 0.6) });
    }],
    // 13 — look for levels and loops, not material
    [q.s(13), (t, lt) => {
      figure(460, GROUND, { s: 1.15, pose: 'point', face: 'think', p: dp(lt, 0, 0.5) });
      todayMag(460 + 124 * 1.15, GROUND - 234 * 1.15, -0.25, 1.2, { p: dp(lt, 0.3, 0.5) });
      todayLayers(1200, 470, 1.05, { p: dp(lt, 0.4, 0.9), t });
      todayLoopAround(1200, 470, 320, 260, { p: dp(lt, 1.2, 0.9), w: 6 });
      hand('층과 고리', 1200, 810, { size: 76, p: dp(lt, 1.8, 0.6) });
      hand('재료', 1690, 200, { size: 92, color: INK(), p: dp(lt, 0.8, 0.4) });
      cross(1580, 140, 220, 120, { p: dp(lt, 1.2, 0.4), w: 5 });
    }],
    // 14 — today's path at a glance
    [q.s(14), (t, lt) => {
      figure(440, GROUND, { s: 1.15, pose: 'point', face: 'happy', p: dp(lt, 0, 0.4) });
      prop('map', 1180, 800, 2.8, { p: dp(lt, 0.2, 0.8) });
      hand('오늘의 길', 1180, 250, { size: 80, p: dp(lt, 0.8, 0.5) });
    }],
    // 15 — rules -> symbols -> meaning -> loop = '나'
    [q.s(15), (t, lt) => {
      const c2 = q.w('기호를', 15), c3 = q.w('짝이', 15);
      prop('paper', 380, 620, 1.5, { p: dp(lt, 0, 0.5), blank: true });
      hand('xI → xIU', 380, 400, { size: 46, color: INK(), weight: 400, p: dp(lt, 0.3, 0.5) });
      hand('xIII → xU', 380, 480, { size: 46, color: INK(), weight: 400, p: dp(lt, 0.5, 0.5) });
      hand('규칙', 380, 720, { size: 80, p: dp(lt, 0.4, 0.5) });
      inkArrow(540, 470, 740, 470, { color: K, w: 6, p: dp(t, c2 - 0.2, 0.5), head: 28 });
      tiles('MIU', 960, 470, { size: 100, p: dp(t, c2, 0.6) });
      hand('기호', 960, 720, { size: 80, p: dp(t, c2 + 0.4, 0.5) });
      inkArrow(1150, 470, 1330, 470, { color: K, w: 6, p: dp(t, c3 - 0.2, 0.5), head: 28 });
      hand('p', 1430, 400, { size: 96, p: dp(t, c3, 0.4) });
      inkLine(1480, 405, 1590, 405, { dash: [12, 9], color: C.dim, w: 4, p: dp(t, c3 + 0.2, 0.4) });
      hand('+', 1640, 400, { size: 96, color: INK(), p: dp(t, c3 + 0.4, 0.4) });
      hand('q', 1430, 540, { size: 96, p: dp(t, c3 + 0.3, 0.4) });
      inkLine(1480, 545, 1590, 545, { dash: [12, 9], color: C.dim, w: 4, p: dp(t, c3 + 0.5, 0.4) });
      hand('=', 1640, 540, { size: 96, color: INK(), p: dp(t, c3 + 0.7, 0.4) });
      hand('뜻', 1540, 720, { size: 80, p: dp(t, c3 + 0.8, 0.5) });
    }],
    [q.w('자기', 15), (t, lt) => {
      const cl = q.w('고리가', 15), cn = q.w('나예요', 15);
      prop('paper', 250, 530, 0.85, { blank: true });
      for (let k = 0; k < 3; k++) inkLine(200, 400 + k * 30, 300, 400 + k * 30, { w: 3, color: C.dim });
      tiles('MIU', 610, 450, { size: 60 });
      hand('p', 920, 420, { size: 64 }); inkLine(950, 424, 1010, 424, { dash: [10, 8], color: C.dim, w: 3.4 }); hand('+', 1040, 420, { size: 64, color: INK() });
      hand('q', 920, 490, { size: 64 }); inkLine(950, 494, 1010, 494, { dash: [10, 8], color: C.dim, w: 3.4 }); hand('=', 1040, 490, { size: 64, color: INK() });
      inkArrow(330, 450, 500, 450, { color: K, w: 5 }); inkArrow(720, 450, 870, 450, { color: K, w: 5 });
      inkArrow(1090, 450, 1220, 450, { color: K, w: 5, p: dp(t, cl - 0.3, 0.4) });
      prop('loop', 1330, 450 + 90 * 1.25, 1.25, { color: K, p: dp(t, cl, 0.6) });
      [['규칙', 250], ['기호', 610], ['뜻', 980], ['고리', 1330]].forEach(([l, x], i) => hand(l, x, 640, { size: 72, p: i < 3 ? 1 : dp(t, cl + 0.4, 0.4) }));
      eqSign(1520, 450, { p: dp(t, cn - 0.5, 0.4), s: 1.2 });
      hand('나', 1700, 450, { size: 130, p: dp(t, cn - 0.3, 0.4) });
      ring(1700, 455, 95, 95, { p: dp(t, cn, 0.5), w: 6 });
    }],
    // 16 — 777 pages, drawing one loop
    [q.s(16), (t, lt) => {
      prop('book', 440, 690, 2.2, { p: dp(lt, 0, 0.4) });
      const k = smooth(dp(lt, 1.0, 1.4));
      for (let i = 0; i < 10; i++) {
        const kk = clamp01(k * 1.5 - i * 0.05); if (kk >= 1) continue;
        const x0 = 330 + i * 7, y0 = 380 - i * 7, sc = lerp(1, 0.12, kk);
        const x = lerp(x0, 1160 - 110 * sc, kk), y = lerp(y0, 470 - 140 * sc, kk);
        inkRect(x, y, 220 * sc, 280 * sc, { w: 3, fill: mix(C.paper, 0.9), a: (1 - kk) * dp(lt, i * 0.05, 0.3) });
      }
      hand('777쪽', 440, 780, { size: 72, color: INK(), p: dp(lt, 0.3, 0.5) });
      inkArrow(640, 470, 860, 470, { color: K, w: 6, p: dp(lt, 1.8, 0.5), head: 28 });
      todayLoopAround(1160, 470, 230, 230, { p: dp(lt, 1.6, 1.0), w: 8, head: 32 });
      hand('고리 하나', 1160, 800, { size: 80, p: dp(lt, 2.6, 0.6) });
    }],
    // 17 — remember the moment you saw MU can't be made
    [q.s(17), (t, lt) => {
      tiles('MU', 660, 450, { size: 150, p: dp(lt, 0, 0.6) });
      cross(500, 340, 320, 220, { p: dp(lt, 0.8, 0.5), w: 9 });
      figure(1300, GROUND, { s: 1.15, pose: 'cheer', face: 'surprised', p: dp(lt, 0.3, 0.5) });
      prop('bulb', 1300, 470, 1.1, { p: dp(lt, 1.0, 0.4) });
      hand('알아낸 순간', 660, 700, { size: 76, p: dp(lt, 1.3, 0.6) });
    }],
    // 18 — one step out of the game to see the whole game: the strange loop at work
    [q.s(18), (t, lt) => {
      inkRect(220, 280, 800, 590, { w: 5, fill: mix(C.paper, 0.25), p: dp(lt, 0, 0.6) });
      hand('게임', 300, 335, { size: 56, color: C.dim, align: 'left', p: dp(lt, 0.3, 0.4) });
      tiles('MI', 480, 440, { size: 64, p: dp(lt, 0.3, 0.4) });
      tiles('MIU', 780, 420, { size: 64, p: dp(lt, 0.4, 0.4) });
      tiles('MII', 860, 520, { size: 64, p: dp(lt, 0.5, 0.4) });
      const u = smooth(dp(lt, 0.8, 2.4)), out = u >= 1;
      figure(lerp(560, 1380, u), 860, { s: 0.95, walk: u > 0 && !out ? 1 : 0, t: lt, flip: out, pose: out ? 'point' : 'stand', face: out ? 'happy' : 'smile' });
      hand('한 걸음 밖으로', 1420, 430, { size: 66, p: dp(lt, 3.2, 0.6) });
    }],
    [q.w('그게', 18), (t, lt) => {
      figure(600, GROUND, { s: 1.15, pose: 'think', face: 'happy', p: dp(lt, 0, 0.5) });
      bubble(780, 110, 640, 400, { kind: 'thought', tail: [650, 500], p: dp(lt, 0.2, 0.5), body: (x, y, w, h) => {
        todayLoopAround(x + w / 2, y + h / 2, 150, 120, { p: dp(lt, 0.5, 0.9), w: 7 });
        hand('나', x + w / 2, y + h / 2 + 4, { size: 90, p: dp(lt, 1.0, 0.4) });
      } });
      hand('이상한 고리', 1100, 640, { size: 80, p: dp(lt, 1.2, 0.6) });
      underline(900, 1300, 690, { p: dp(lt, 1.8, 0.4) });
    }],
    // 19 — Achilles shuffled letters for hours; the Tortoise stepped back and counted
    [q.s(19), (t, lt) => {
      ach(t, { x: 420, s: 1.15, pose: 'hold', face: 'worried', p: dp(lt, 0, 0.5) });
      const seq = ['MI', 'MII', 'MIIII', 'MIIIIIII', 'MIIIIU', 'MIUIIU', 'MIU', 'MIIU'];
      tiles(seq[Math.floor(Math.max(0, lt - 0.4) * 1.5) % seq.length], 1180, 330, { size: 76, p: dp(lt, 0.3, 0.3) });
      prop('clock', 1500, 840, 1.3, { t: lt * 6, p: dp(lt, 0.4, 0.5) });
      hand('몇 시간', 1500, 590, { size: 64, color: INK(), p: dp(lt, 0.8, 0.5) });
    }],
    [q.w('거북이는', 19), (t, lt) => {
      const u = smooth(dp(lt, 0, 1.4));
      tor(t, { x: lerp(1040, 700, u), s: 1.05, walk: u < 1 ? 1 : 0, face: 'think', pose: u < 1 ? 'stand' : 'think' });
      tiles('MIII', 1360, 380, { size: 90 });
      const x0 = 1360 - (4 * 90 * 0.95 + 30) / 2;
      ['1', '2', '3'].forEach((n, i) => hand(n, x0 + (i + 1) * (90 * 0.95 + 10) + 90 * 0.95 / 2, 480, { size: 60, color: C.green, p: dp(lt, 0.8 + i * 0.3, 0.3) }));
      hand('세어 보기', 1360, 620, { size: 72, p: dp(lt, 1.8, 0.5) });
      hand('한 걸음 뒤로', 700, 400, { size: 60, color: INK(), p: dp(lt, 1.4, 0.5) });
    }],
    // 20 — both live in us
    [q.s(20), (t, lt) => {
      figure(560, GROUND, { s: 1.15, pose: 'think', face: 'smile', p: dp(lt, 0, 0.5) });
      bubble(760, 110, 780, 440, { kind: 'thought', tail: [610, 500], p: dp(lt, 0.3, 0.5), body: (x, y, w, h) => {
        achilles(x + 250, y + h - 30, { s: 0.8, face: 'happy', t, p: dp(lt, 0.6, 0.6) });
        tortoise(x + 530, y + h - 30, { s: 0.75, face: 'smile', t, p: dp(lt, 0.9, 0.6) });
      } });
      hand('우리 안에', 1150, 650, { size: 72, p: dp(lt, 1.3, 0.5) });
    }],
    // 21 — Achilles runs by the rules; the Tortoise looks up and asks
    [q.s(21), (t, lt) => {
      inkLine(140, 884, 1780, 884, { ...dashed, p: dp(lt, 0, 0.5) });
      const x = lerp(320, 1500, clamp01(lt / 3.8));
      ach(t, { x, s: 1.15, walk: 1, t: lt * 1.7, face: 'happy' });
      for (let k = 0; k < 3; k++) inkLine(x - 200 - k * 26, 560 + k * 70, x - 90 - k * 26, 560 + k * 70, { w: 4, color: C.dim });
      hand('규칙대로', 960, 250, { size: 80, p: dp(lt, 0.4, 0.5) });
      ruleCard(960, 360, '', 'xI', 'xIU', { size: 56, p: dp(lt, 0.8, 0.5) });
    }],
    [q.w('가끔', 21), (t, lt) => {
      ach(t, { x: 300, s: 0.75, walk: 1, t: lt * 1.7, face: 'happy', p: dp(lt, 0, 0.4) });
      tor(t, { x: 1300, s: 1.1, pose: 'think', face: 'think', p: dp(lt, 0, 0.5) });
      bubble(540, 120, 680, 280, { kind: 'thought', tail: [1260, 520], text: '잠깐, 지금 뭘 하고 있지?', size: 60, p: dp(lt, 0.4, 0.5) });
    }],
    // 22 — that is why the book calls the two between every chapter
    [q.s(22), (t, lt) => {
      [330, 790, 1250, 1710].forEach((x, i) => {
        const q0 = dp(lt, i * 0.3, 0.5);
        inkRect(x - 110, 360, 220, 300, { p: q0, w: 4.4, fill: mix(C.paper, 0.6) });
        hand(`${i + 1}장`, x, 425, { size: 60, color: INK(), p: q0 });
        for (let k = 0; k < 4; k++) inkLine(x - 75, 500 + k * 36, x + 75, 500 + k * 36, { w: 2.6, color: C.dim, p: q0 });
      });
      [560, 1020, 1480].forEach((x, i) => {
        const q1 = dp(lt, 0.4 + i * 0.3, 0.5);
        achilles(x - 48, 660, { s: 0.55, t, p: q1, face: 'happy' });
        tortoise(x + 50, 660, { s: 0.52, t, p: q1 });
        hand('대화', x, 730, { size: 48, color: C.dim, weight: 400, p: q1 });
      });
      hand('장과 장 사이마다', 960, 220, { size: 76, p: dp(lt, 1.2, 0.6) });
    }],
    // 23 — when you think about your own thinking, listen for the loop turning
    [q.s(23), (t, lt) => thinkThink(t, lt)],
    [q.w('고리가', 23), (t, lt) => {
      thinkThink(t, lt + 9);
      todayLoopAround(1000, 410, 560, 340, { p: dp(lt, 0, 1.2), w: 7, head: 32, a0: -Math.PI * 0.62, span: Math.PI * 1.8 });
      chapterMap(420, 826, 1080, labels, 11, { p: dp(lt, 0.6, 1.2), size: 40 });
    }],
  ]);
};
