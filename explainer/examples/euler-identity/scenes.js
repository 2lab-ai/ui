// scenes.js — one draw function per scene, keyed to timeline.json cues (sentence starts + word times).
// Topic-specific helpers (the eras timeline, small icons) live here, not in the engine.
'use strict';

// eras timeline (used by several scenes). Colours are role names, resolved when drawn: the theme loads after this file.
const ERAS = [
  { label: '아주 먼 옛날', sym: 'pi_sym', col: 'yellow' },
  { label: '1500년대', sym: 'i_sym', col: 'blue' },
  { label: '1600년대', sym: 'e_sym', col: 'green' },
  { label: '1748', sym: null, col: 'purple' },
  { label: '1800 무렵', sym: null, col: 'teal' },
  { label: '20세기', sym: null, col: 'orange' },
];
function timeline(y, { a = 1, p = 1, active = -1, x0 = 260, x1 = 1660, size = 28, lit = null, marker = null } = {}) {
  if (a <= 0) return;
  withAlpha(a, () => {
    line(x0, y, x1, y, C.grey, 3, p);
    ERAS.forEach((e, k) => {
      const x = lerp(x0, x1, k / (ERAS.length - 1));
      const pk = clamp01((p * (ERAS.length + 1) - k) / 1.5);
      if (pk <= 0) return;
      const on = lit ? lit(k) : (k === active ? 1 : 0.35);
      withAlpha(pk, () => {
        disc(x, y, 9 + 4 * (k === active ? 1 : 0), C[e.col], 0.35 + 0.65 * on);
        text(e.label, x, y + 38, { size, font: SANS, color: on > 0.6 ? C.text : C.dim, weight: 500 });
      });
    });
    if (marker != null) {
      const x = lerp(x0, x1, marker / (ERAS.length - 1));
      ctx.save(); ctx.fillStyle = C.text;
      ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x - 11, y - 36); ctx.lineTo(x + 11, y - 36); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  });
}
const eraX = (k, x0 = 260, x1 = 1660) => lerp(x0, x1, k / (ERAS.length - 1));

// tiny icons
function iconCircle(x, y, r, a = 1) { withAlpha(a, () => { circle(x, y, r, C.grey, 3); arc(x, y, r, 0, Math.PI, C.yellow, 5); runner(x - r, y, 1, 7); }); }
function iconCoin(x, y, r, a = 1, label = '₩') {
  withAlpha(a, () => { disc(x, y, r, mix(C.green, 0.18)); circle(x, y, r, C.green, 4); circle(x, y, r * 0.78, C.green, 1.5);
    text(label, x, y + 2, { size: r * 0.95, color: C.green, font: SANS, weight: 700 }); });
}
function iconQ(x, y, r, a = 1) { withAlpha(a, () => { disc(x, y, r, mix(C.blue, 0.15)); circle(x, y, r, C.blue, 4); text('?', x, y + 3, { size: r * 1.25, color: C.blue, font: SERIF, weight: 700 }); }); }

const PI = Math.PI;

// ============ 1 · 반 바퀴 ============
SCENES.intro = (t, q) => {
  // track + walking dot
  const move = prog(t, q.s(3) + 0.6, 1.4);
  const cx = lerp(960, 520, move), cy = lerp(470, 470, move), r = lerp(270, 190, move);
  const fadeTrack = 1 - 0.0 * move;
  withAlpha(fadeTrack, () => {
    circle(cx, cy, r + 26, C.grey, 1.5, prog(t, q.s(0), 1.6));
    circle(cx, cy, r - 26, C.grey, 1.5, prog(t, q.s(0) + 0.2, 1.6));
    circle(cx, cy, r, C.track, 3, prog(t, q.s(0), 1.4));
  });
  const walk = prog(t, q.s(1) + 0.4, 3.2);
  const ang = PI * walk;
  if (walk > 0) arc(cx, cy, r, 0, ang, C.yellow, 6);
  const dotA = prog(t, q.s(0) + 1.0, 0.6);
  runner(cx + r * Math.cos(ang), cy - r * Math.sin(ang), dotA);
  // start / opposite labels
  const lab = prog(t, q.s(2), 0.6) * (1 - prog(t, q.s(3), 0.6));
  disc(cx + r, cy, 6, C.text, lab); text('출발', cx + r + 4, cy + 46, { size: 32, font: SANS, a: lab, color: C.text });
  text('정반대편', cx - r, cy + 46, { size: 32, font: SANS, a: lab, color: C.yellow });
  // the one line
  const fx = 1360, fy = 500, fs = 128;
  const wp = lin(t, q.w('한', 3), 2.6);
  const dimF = 1 - 0.55 * prog(t, q.s(9), 0.8);
  formula('identity', fx, fy, fs, { p: wp, a: dimF,
    gScale: (k) => {   // s5: the letters pulse one after another (e, i, π)
      const base = q.s(5) + 1.0; let s = 1;
      [0, 1, 2].forEach((j, n) => { if (k === j) s += 0.18 * Math.sin(PI * clamp01((t - base - n * 0.45) / 0.6)); });
      return s;
    } });
  // underline for "most beautiful"
  line(fx - 300, fy + 40, fx + 300, fy + 40, C.grey, 2, prog(t, q.s(4), 1.0) * (1 - prog(t, q.s(5), 0.5)));
  // s6: three origins
  const boxesOut = 1 - prog(t, q.s(8), 0.7);
  const ox = [1640, 1360, 1080], oy = 760;
  const keys = [q.w('원을', 6), q.w('믿지', 6), q.w('돈', 6)];
  const glyphIdx = [2, 1, 0];
  const labels = ['원을 재다가', '믿지 않던 계산', '돈 계산'];
  [0, 1, 2].forEach(j => {
    const a = prog(t, keys[j] - 0.2, 0.6) * boxesOut;
    if (a <= 0) return;
    const gb = glyphBox('identity', glyphIdx[j], fx, fy, fs);
    line(gb.cx, gb.y + gb.h + 10, ox[j], oy - 70, [C.yellow, C.blue, C.green][j], 2.5, a, [6, 8]);
    if (j === 0) iconCircle(ox[j], oy - 12, 38, a);
    if (j === 1) iconQ(ox[j], oy - 12, 38, a);
    if (j === 2) iconCoin(ox[j], oy - 12, 38, a);
    text(labels[j], ox[j], oy + 60, { size: 30, font: SANS, a, color: [C.yellow, C.blue, C.green][j], weight: 500 });
  });
  // s7: the question
  const qa = prog(t, q.w('누가', 7) - 0.2, 0.6) * (1 - prog(t, q.s(9), 0.6));
  text('누가 만들었을까?', fx, 300, { size: 54, a: qa, weight: 500 });
  // s8: timeline + converging lines
  const tlA = prog(t, q.s(8) + 0.3, 0.8);
  timeline(870, { a: tlA, p: prog(t, q.s(8) + 0.3, 2.0), lit: () => 1 });
  const conv = prog(t, q.w('한', 8), 1.2) * (1 - prog(t, q.s(9) + 0.5, 0.8));
  if (conv > 0) ERAS.slice(0, 3).forEach((e, k) => line(eraX(k), 850, fx, fy + 60, C[e.col], 2, conv, [5, 7]));
  // s9: the guide
  const ga = prog(t, q.w('길잡이', 9), 0.6);
  if (ga > 0) {
    const pulse = 1 + 0.25 * Math.sin((t - q.s(9)) * 5) * ga;
    runner(cx - r, cy, 1, 13 * pulse);
    text('길잡이: 원 위를 걷는 점', cx, cy - r - 70, { size: 34, font: SANS, a: ga, color: C.yellow, weight: 500 });
  }
};

// ============ 2 · 원에서 온 수 ============
SCENES.pi = (t, q) => {
  const cx = 560, cy = 430, R = 180;
  const x0 = 290, yr = 790;   // ruler
  const a0 = prog(t, q.start + 2.4, 0.8);
  circle(cx, cy, R, C.track, 3, a0);
  // unroll progress (s4)
  const un = prog(t, q.w('펴', 4) - 0.3, 2.2);
  // arc / unrolled string
  const N = 80;
  ctx.save(); ctx.strokeStyle = C.yellow; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.globalAlpha *= a0;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const s = PI * i / N;
    const ax = cx + R * Math.cos(s), ay = cy - R * Math.sin(s);
    const lx = x0 + R * s, ly = yr;
    // keep a copy on the circle; the moving copy is the string
    const px = lerp(ax, lx, un), py = lerp(ay, ly, un);
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke(); ctx.restore();
  if (un > 0) arc(cx, cy, R, 0, PI, C.yellow, 6);   // the walk stays on the track
  runner(cx - R, cy, a0);
  // s1: radius = one step
  const ra = prog(t, q.s(1) + 0.3, 0.8);
  disc(cx, cy, 5, C.text, ra);
  line(cx, cy, cx + R, cy, C.text, 3, ra);
  text('한 걸음', cx + R / 2, cy - 28, { size: 30, font: SANS, a: ra });
  // s2: question
  const qa = prog(t, q.s(2), 0.5) * (1 - prog(t, q.s(4), 0.5));
  text('?', cx, cy - R - 60, { size: 90, color: C.yellow, a: qa });
  text('반 바퀴 = 몇 걸음?', cx, cy + R + 60, { size: 34, font: SANS, a: qa });
  // s3: ruler
  const rua = prog(t, q.s(3) - 0.2, 0.8);
  line(x0, yr, x0 + 4 * R, yr, C.grey, 3, rua);
  for (let k = 0; k <= 4; k++) {
    const x = x0 + k * R;
    withAlpha(rua, () => { line(x, yr - 14, x, yr + 14, C.dim, 3); text(String(k), x, yr + 48, { size: 34, color: C.dim }); });
  }
  const two = prog(t, q.w('두', 3), 0.5), four = prog(t, q.w('네', 3), 0.5);
  const rmOut = 1 - prog(t, q.s(5), 0.6);
  withAlpha(rmOut, () => {
    line(x0 + 2 * R, yr - 40, x0 + 2 * R, yr + 14, C.red, 5, two);
    text('모자람', x0 + 2 * R, yr - 64, { size: 28, font: SANS, color: C.red, a: two });
    line(x0 + 4 * R, yr - 40, x0 + 4 * R, yr + 14, C.red, 5, four);
    text('남음', x0 + 4 * R, yr - 64, { size: 28, font: SANS, color: C.red, a: four });
  });
  // after unroll: 3.14…
  const va = prog(t, q.w('세', 4), 0.6);
  text('3.14…', x0 + PI * R, yr - 46, { size: 40, color: C.yellow, a: va * un });
  // s5: many circles, same ratio
  const ma = prog(t, q.s(5) + 0.4, 0.8) * (1 - prog(t, q.s(7) - 0.2, 0.6));
  const cs = [[1180, 330, 50], [1385, 330, 85], [1660, 330, 130]];
  cs.forEach(([x, y, r], j) => {
    const aj = ma * prog(t, q.s(5) + 0.4 + j * 0.35, 0.6);
    circle(x, y + 60, r, C.track, 3, aj);
    withAlpha(aj, () => { arc(x, y + 60, r, 0, PI, C.yellow, 4); line(x, y + 60, x + r, y + 60, C.text, 2); });
  });
  const ratioA = prog(t, q.w('크든', 5), 0.6) * ma;
  text('반 바퀴 ÷ 반지름 = 3.14…', 1480, 640, { size: 38, a: ratioA });
  text('어떤 원이든 같다', 1480, 700, { size: 30, font: SANS, color: C.dim, a: ratioA });
  // s6: endless digits
  const dg = '3.14159265358979323846264338…';
  const dA = 1 - prog(t, q.s(7) + 1.2, 0.6);
  typed(dg, lin(t, q.s(6) + 0.6, 3.5), 1000, 200, { size: 40, align: 'left', a: dA });
  // s7: the name — π after the picture
  const nA = prog(t, q.w('파이', 7) - 0.1, 0.5);
  formula('pi_sym', 1480, 430, 260, { p: lin(t, q.w('파이', 7) - 0.15, 1.0) });
  formula('pi_val', 1480, 590, 70, { p: lin(t, q.w('파이', 7) + 0.6, 1.8) });
  // s8: meaning + legend
  const mA = prog(t, q.s(8) + 0.2, 0.7);
  text('π = 반 바퀴 동안 걸은 거리', cx, cy - R - 56, { size: 38, color: C.yellow, a: mA });
  const lg = prog(t, q.w('노란색', 8), 0.6);
  withAlpha(lg, () => { box(1300, 720, 400, 76, { r: 14 }); line(1330, 758, 1400, 758, C.yellow, 6); text('노랑 = 걸은 거리', 1540, 758, { size: 32, font: SANS }); });
};

// ============ 3 · 아무도 믿지 않던 수 ============
SCENES.imag = (t, q) => {
  // mini timeline: from ancient to 1500s
  const mk = lerp(0, 1, prog(t, q.start + 2.6, 1.2));
  timeline(130, { a: 1 - prog(t, q.s(2), 0.8), size: 24, marker: mk, active: 1 });
  // the book of solutions
  const ba = prog(t, q.s(1) - 0.2, 0.8) * (1 - prog(t, q.s(6), 0.8));
  const z = 1 + 0.05 * lin(t, q.s(1), 30);
  image('arsmagna', 170, 250, 420, 640, { a: ba, zoom: z, panY: -20 * lin(t, q.s(1), 30) });
  text('1500년대의 풀이 책', 380, 930, { size: 26, font: SANS, color: C.dim, a: ba });
  // right column
  const X = 1250;
  const colOut = 1 - prog(t, q.s(4) - 0.3, 0.5);
  withAlpha(colOut, () => {
    formula('cubic', X, 360, 84, { p: lin(t, q.s(1) + 0.8, 1.6) });
    text('어려운 식 (예)', X, 270, { size: 28, font: SANS, color: C.dim, a: prog(t, q.s(1) + 0.8, 0.6) });
    const ca = q.w('튀어', 2);
    arrow(X, 400, X, 470, C.dim, 3, prog(t, ca - 0.6, 0.5));
    formula('cardano', X, 560, 70, { p: lin(t, ca - 0.3, 1.8),
      gScale: k => (FORM.cardano.glyphs[k].c === 'blue' ? 1 + 0.25 * Math.sin(PI * clamp01((t - ca - 1.6) / 0.7)) : 1) });
    formula('qq', X, 740, 84, { p: lin(t, q.w('제곱', 2), 1.4) });
    text('?', X + 260, 730, { size: 90, color: C.blue, a: prog(t, q.s(3), 0.5) });
  });
  // s4: squares are never negative
  const sqOut = 1 - prog(t, q.s(5) - 0.3, 0.5);
  withAlpha(sqOut, () => {
    formula('sq_pos', X, 380, 84, { p: lin(t, q.s(4), 1.2) });
    formula('sq_neg', X, 520, 84, { p: lin(t, q.w('마이너스', 4) - 0.2, 1.6) });
    formula('qq', X, 720, 84, { p: lin(t, q.w('자기', 4) - 0.2, 1.2) });
    const xa = prog(t, q.w('없어', 4), 0.4);
    line(X - 230, 650, X + 230, 760, C.red, 7, xa); line(X - 230, 760, X + 230, 650, C.red, 7, xa);
  });
  // s5: computation where the strange number cancels
  const cA = 1 - prog(t, q.s(6) + 0.2, 0.6);
  withAlpha(cA, () => {
    formula('cardano', X, 380, 70, { p: lin(t, q.s(5), 1.4) });
    text('=', X - 330, 520, { size: 70, a: prog(t, q.s(5) + 1.2, 0.4) });
    formula('bombelli', X + 20, 545, 76, { p: lin(t, q.s(5) + 1.4, 2.0) });
    const kill = prog(t, q.w('사라지고', 5), 0.6);
    [3, 9].forEach(k => { const b = glyphBox('bombelli', k, X + 20, 545, 76); line(b.x - 40, b.cy + 8, b.x + b.w + 6, b.cy - 8, C.red, 6, kill); });
    const ans = prog(t, q.w('정답', 5), 0.5);
    const b4 = glyphBox('bombelli', 12, X + 20, 545, 76);
    circle(b4.cx, b4.cy, 50, C.green, 4, ans);
    text('진짜 정답', b4.cx, b4.cy + 100, { size: 30, font: SANS, color: C.green, a: ans });
  });
  // s6: the mocking name
  const nm = prog(t, q.s(6) + 0.6, 0.8) * (1 - prog(t, q.s(7), 0.6));
  text('상상의 수', W / 2, 470, { size: 96, color: C.blue, a: nm * 0.75, weight: 500, italic: false });
  text('"그냥 상상일 뿐"', W / 2, 580, { size: 36, font: SANS, color: C.dim, a: nm });
  // s7: the name i (term)
  const ia = q.w('허수', 7);
  formula('i_sym', 760, 560, 300, { p: lin(t, ia - 0.3, 1.0) });
  text('허수', 760, 680, { size: 48, color: C.blue, font: SANS, weight: 500, a: prog(t, ia, 0.5) });
  formula('ixi', 1300, 520, 100, { p: lin(t, q.w('아이라고', 7) + 0.3, 1.6) });
  // s8: link to our dot is 250 years away
  const la = prog(t, q.s(8) + 1.2, 0.8);
  withAlpha(la, () => {
    timeline(790, { size: 24, active: 1, marker: lerp(1, 4, prog(t, q.w('이백오십', 8), 1.6)), x0: 360, x1: 1560 });
    circle(1640, 300, 70, C.grey, 2); runner(1710, 300, 1, 9);
    text('?', 1640, 302, { size: 60, color: C.blue });
    line(1440, 470, 1585, 340, C.blue, 2, 1, [6, 8]);
  });
  // s9: one sentence to keep
  const ka = prog(t, q.s(9) + 0.3, 0.6);
  text('제곱하면 −1이 되는 수', 1300, 640, { size: 40, font: SERIF, color: C.text, a: ka });
};

// ============ 4 · 저절로 자라는 수 ============
SCENES.e = (t, q) => {
  timeline(130, { a: 1 - prog(t, q.s(1) + 1.0, 0.8), size: 24, marker: lerp(1, 2, prog(t, q.start + 2.6, 1.2)), active: 2 });
  // bar chart of money
  const base = 820, unit = 190, cols = [370, 590, 810, 1030], bw = 130;
  const chartA = 1 - prog(t, q.s(8) - 0.2, 0.6);
  const ca = prog(t, q.s(1), 0.7) * chartA;
  withAlpha(ca, () => {
    line(250, base, 1200, base, C.grey, 3);
    for (let v = 1; v <= 3; v++) { line(250, base - v * unit, 1200, base - v * unit, C.gridFaint, 1.5); text(v + '원', 222, base - v * unit, { size: 26, color: C.dim, align: 'right', font: SANS }); }
  });
  iconCoin(cols[0], base - unit - 60, 34, prog(t, q.w('일', 1), 0.5) * (1 - prog(t, q.w('뒤면', 1), 0.4)) * chartA, '1');
  const data = [
    { n: 1, v: 2.0, label: '1년', t0: q.w('뒤면', 1) - 0.3, val: '2원' },
    { n: 2, v: 2.25, label: '반년', t0: q.w('반년', 2), val: '2.25원' },
    { n: 12, v: Math.pow(1 + 1 / 12, 12), label: '한 달', t0: q.w('한', 3), val: '2.61원' },
    { n: 365, v: Math.pow(1 + 1 / 365, 365), label: '하루', t0: q.w('하루', 3), val: '2.71원' },
  ];
  data.forEach((d, j) => {
    const a = prog(t, d.t0, 0.5) * chartA; if (a <= 0) return;
    const grow = prog(t, d.t0 + 0.2, 1.2);
    const x = cols[j] - bw / 2, v = lerp(1, d.v, grow);
    withAlpha(a, () => {
      // the 1원 we put in (grey) and the interest on top (green)
      rrect(x, base - unit, bw, unit, 6); ctx.fillStyle = mix(C.text, 0.1); ctx.fill(); ctx.strokeStyle = C.dim; ctx.lineWidth = 2; ctx.stroke();
      if (v > 1.001) { rrect(x, base - unit * v, bw, unit * (v - 1), 6); ctx.fillStyle = mix(C.green, 0.3); ctx.fill(); ctx.strokeStyle = C.green; ctx.lineWidth = 3; ctx.stroke(); }
      // interest-on-interest: the payments as thin slices
      const steps = Math.min(d.n, 24);
      if (d.n > 1 && grow > 0.5) for (let s = 1; s < steps; s++) { const m = Math.pow(1 + 1 / d.n, d.n * s / steps); line(x + 8, base - unit * m, x + bw - 8, base - unit * m, mix(C.green, 0.45), 1.2); }
    });
    text(d.label, cols[j], base + 40, { size: 30, font: SANS, color: C.dim, a });
    text(d.val, cols[j], base - unit * d.v - 34, { size: 32, color: C.green, a: prog(t, d.t0 + 1.0, 0.5) * chartA, font: SERIF });
  });
  // s4: question
  const qa = prog(t, q.s(4) + 0.2, 0.5) * (1 - prog(t, q.s(5), 0.5));
  withAlpha(qa, () => { arrow(1450, 700, 1450, 330, C.green, 5); text('끝없이 불어날까?', 1450, 270, { size: 44, font: SANS, weight: 500 }); });
  // s5: limit line
  const la = prog(t, q.s(5) + 0.3, 1.0) * chartA;
  line(250, base - unit * Math.E, 1200, base - unit * Math.E, C.green, 3, la, [14, 10]);
  text('2.718…', 1210, base - unit * Math.E, { size: 34, color: C.green, align: 'left', a: la });
  text('매 순간', 1120, base + 40, { size: 30, font: SANS, color: C.dim, a: 0 });
  // s6: the name
  const ea = q.w('이', 6);
  formula('e_val', 1560, 470, 96, { p: lin(t, q.s(6) - 0.1, 1.6) });
  // s7: grows at the speed of what it has
  const ga = prog(t, q.s(7), 0.8) * chartA;
  withAlpha(ga, () => {
    const gx = 1380, gy = 800, gw = 380, gh = 230;
    line(gx, gy, gx + gw, gy, C.grey, 2); line(gx, gy, gx, gy - gh, C.grey, 2);
    ctx.save(); ctx.strokeStyle = C.green; ctx.lineWidth = 4; ctx.beginPath();
    for (let i = 0; i <= 60; i++) { const u = i / 60; const x = gx + u * gw; const y = gy - (Math.exp(u * 1.2) - 0.7) / (Math.exp(1.2) - 0.7) * gh; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.restore();
    [0.2, 0.55, 0.9].forEach((u, j) => {
      const a = prog(t, q.s(7) + 0.8 + j * 0.6, 0.5);
      const x = gx + u * gw, v = (Math.exp(u * 1.2) - 0.7) / (Math.exp(1.2) - 0.7), y = gy - v * gh;
      const slope = 1.2 * Math.exp(u * 1.2) / (Math.exp(1.2) - 0.7) * gh / gw;
      const L = 40 + 70 * v; const nx = 1 / Math.hypot(1, slope), ny = slope / Math.hypot(1, slope);
      arrow(x, y, x + nx * L, y - ny * L, C.green, 3, a, 12);
    });
    text('많을수록 더 빨리', gx + gw / 2, gy + 40, { size: 28, font: SANS, color: C.dim });
  });
  // s8–s10: the dot on a straight line
  const nl = prog(t, q.s(8) + 0.2, 0.8);
  const X0 = 260, U = 420, Y = 600;
  withAlpha(nl, () => {
    line(180, Y, 1800, Y, C.grey, 3);
    for (let k = 0; k <= 3; k++) { const x = X0 + k * U; line(x, Y - 14, x, Y + 14, C.dim, 3); text(String(k), x, Y + 50, { size: 38, color: C.dim }); }
  });
  const run = clamp01((t - q.w('도착', 9) + 2.6) / 2.6);     // 1 "second" of the story = 2.6 s of film
  const tau = run;   // story time 0..1
  const pos = Math.exp(tau);
  const dx = X0 + pos * U;
  runner(dx, Y, nl);
  const arA = prog(t, q.w('빠르기는', 8), 0.6);
  const pulse = 1 + 0.12 * Math.sin(PI * clamp01((t - q.s(10) - 0.3) / 0.8)) * 2;
  arrow(dx + 18, Y - 46, dx + 18 + pos * 150 * pulse, Y - 46, C.green, 6, arA, 22);
  text('빠르기 = 0에서 떨어진 거리', dx + 18 + pos * 75, Y - 100, { size: 30, font: SANS, color: C.green, a: arA * (1 - prog(t, q.s(9) + 0.2, 0.4)) });
  // clock
  const ck = prog(t, q.s(9), 0.5) * nl;
  text(`${tau.toFixed(2)}초`, 1700, 300, { size: 44, color: C.text, a: ck, align: 'right' });
  const arrive = prog(t, q.w('도착', 9), 0.5);
  formula('e_sym', X0 + Math.E * U, Y + 120, 80, { p: arrive });
  line(X0 + Math.E * U, Y + 20, X0 + Math.E * U, Y + 56, C.green, 3, arrive);
  // exponent meaning
  const e1 = prog(t, q.w('작은', 9), 0.6), e2 = prog(t, q.w('이를', 9), 0.6);
  formula('e1', 420, 300, 90, { p: e1 });
  text('→ 1초 동안', 520, 290, { size: 36, font: SANS, align: 'left', a: e1 });
  formula('e2', 420, 410, 90, { p: e2 });
  text('→ 2초 동안', 520, 400, { size: 36, font: SANS, align: 'left', a: e2 });
  const rem = prog(t, q.s(10) + 0.4, 0.6);
  text('언제나 바깥쪽, 길이 = 지금 거리', 960, 820, { size: 36, font: SANS, color: C.green, a: rem, weight: 500 });
};

// ============ 5 · 다리를 놓은 사람 ============
SCENES.euler = (t, q) => {
  // three cards
  const up = prog(t, q.s(1) - 0.4, 1.0);
  const cardsOut = 1 - prog(t, q.s(3) - 0.2, 0.6);
  const cy = lerp(470, 210, up), sc = lerp(1, 0.62, up);
  const cards = [
    { x: lerp(560, 760, up), sym: 'pi_sym', col: C.yellow, lab: '원', who: '널리 퍼뜨림', key: q.w('파이', 0) },
    { x: lerp(960, 960, up), sym: 'i_sym', col: C.blue, lab: '식 풀이', who: '처음 씀', key: q.w('아이', 0) },
    { x: lerp(1360, 1160, up), sym: 'e_sym', col: C.green, lab: '돈 계산', who: '처음 씀', key: q.wx('이', 0) },
  ];
  cards.forEach((c, j) => {
    const a = prog(t, Math.min(c.key, q.s(0) + 1 + j) - 0.2, 0.5) * cardsOut; if (a <= 0) return;
    withAlpha(a, () => {
      box(c.x - 120 * sc, cy - 130 * sc, 240 * sc, 260 * sc, { stroke: c.col, fill: mix(C.text, 0.03) });
      formula(c.sym, c.x, cy + 40 * sc, 150 * sc, {});
      text(c.lab, c.x, cy + 100 * sc, { size: 30 * sc, font: SANS, color: C.dim });
    });
    const wa = prog(t, q.s(2) + 0.8 + j * 0.5, 0.5) * cardsOut;
    text(c.who, c.x, cy + 170 * sc, { size: 26, font: SANS, color: c.col, a: wa });
  });
  // dashed separators "no relation"
  const sep = prog(t, q.w('관계가', 0), 0.5) * (1 - up);
  [760, 1160].forEach(x => line(x, 360, x, 580, C.red, 3, sep, [8, 10]));
  // portrait + book
  const pa = prog(t, q.s(1) - 0.5, 0.8) * (1 - prog(t, q.s(3) - 0.2, 0.6));
  image('euler', 150, 330, 400, 520, { a: pa, zoom: 1.05 + 0.04 * lin(t, q.s(1), 15), panY: 30 });
  text('1748', 350, 890, { size: 34, color: C.purple, a: pa });
  image('introductio', 1370, 330, 400, 520, { a: pa * prog(t, q.s(1) + 1.2, 0.6), zoom: 1.0 + 0.04 * lin(t, q.s(1), 15) });
  text('1748년의 책', 1570, 890, { size: 28, font: SANS, color: C.dim, a: pa * prog(t, q.s(1) + 1.2, 0.6) });
  // s3: the strange question
  const s3 = prog(t, q.s(3), 0.6) * (1 - prog(t, q.s(4) - 0.2, 0.5));
  formula('e_i', 960, 420, 200, { a: s3, p: lin(t, q.s(3), 1.2) });
  text('e를 ‘허수 번’ 곱하면?', 960, 560, { size: 44, font: SANS, a: s3, weight: 500 });
  const tm = prog(t, q.w('세', 3), 0.5) * s3;
  text('e × e × e  = 세 번 곱하기', 960, 690, { size: 38, a: tm, color: C.text });
  const hm = prog(t, q.w('허수', 3) + 1.2, 0.5) * s3;
  text('허수 번 곱하기 = ???', 960, 760, { size: 38, a: hm, color: C.red });
  // s4: the endless sum
  const sA = prog(t, q.s(4) + 0.2, 0.5) * (1 - prog(t, q.s(5) + 0.2, 0.5));
  formula('series', 960, 360, 74, { a: sA, p: lin(t, q.w('일', 4) - 0.5, 3.0) });
  text('오늘날 흔히 보여 주는 방식', 960, 230, { size: 28, font: SANS, color: C.dim, a: prog(t, q.w('오늘날', 4), 0.5) * sA });
  formula('xi', 960, 560, 90, { a: sA, p: lin(t, q.w('넣어', 4) - 0.6, 1.4) });
  // s5: tiles split into two groups
  const tiles = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'];
  const tA = prog(t, q.s(5) - 0.6, 0.6) * (1 - prog(t, q.s(6) - 0.1, 0.5));
  const split = prog(t, q.w('갈라졌습니다', 5) - 0.4, 1.6);
  const ts = 72;
  let rowX = 360; const pos0 = tiles.map(id => { const w = formulaW(id, ts); const x = rowX; rowX += w + 34; return x; });
  let rx = 560, ix = 560; const real = [], imag = [];
  tiles.forEach((id, j) => {
    const isI = FORM[id].glyphs[0].c === 'blue' || (id !== 't0' && FORM[id].glyphs.some(g => g.ch === 'i'));
    const w = formulaW(id, ts);
    let tx, ty;
    if (id === 't7') { tx = rx; ty = 470; }
    else if (isI) { tx = ix; ty = 700; ix += w + 30; } else { tx = rx; ty = 470; rx += w + 30; }
    const x = lerp(pos0[j], tx, split), y = lerp(600, ty, split);
    formula(id, x, y, ts, { align: 'left', a: tA, p: lin(t, q.s(5) - 0.6 + j * 0.15, 0.8) });
  });
  const hl = prog(t, q.w('가로', 5), 0.5) * tA, vl = prog(t, q.w('세로', 5), 0.5) * tA;
  text('가로 위치', 330, 450, { size: 38, font: SANS, color: C.teal, a: hl, weight: 500 });
  text('세로 위치', 330, 680, { size: 38, font: SANS, color: C.blue, a: vl, weight: 500 });
  // s6–s7: the result line + the circle
  const rA = prog(t, q.s(6) + 0.2, 0.6);
  const rOut = 1 - prog(t, q.s(8) - 0.2, 0.6);
  const fy = 250, fs = 104;
  formula('euler', 960, fy, fs, { a: rOut, p: lin(t, q.s(6) + 0.3, 2.4) });
  const cosB = glyphBox('euler', 5, 960, fy, fs), sinB = glyphBox('euler', 11, 960, fy, fs), thB = glyphBox('euler', 2, 960, fy, fs);
  text('가로 위치', cosB.cx, fy + 70, { size: 32, font: SANS, color: C.teal, a: prog(t, q.w('가로', 6), 0.5) * rOut });
  text('세로 위치', sinB.cx, fy + 70, { size: 32, font: SANS, color: C.blue, a: prog(t, q.w('세로', 6), 0.5) * rOut });
  text('걸은 거리', thB.cx + 10, fy - 120, { size: 28, font: SANS, color: C.yellow, a: prog(t, q.w('걸은', 6), 0.5) * rOut });
  const cA = prog(t, q.s(6) + 1.6, 0.8) * rOut;
  const ccx = 720, ccy = 680, cr = 170;
  const th = lerp(0.9, PI, prog(t, q.w('반', 7), 2.0)) * (t > q.s(6) ? 1 : 0) + (t <= q.s(6) ? 0.9 : 0);
  withAlpha(cA, () => {
    line(ccx - cr - 60, ccy, ccx + cr + 60, ccy, C.grey, 2); line(ccx, ccy - cr - 50, ccx, ccy + cr + 50, C.grey, 2);
    circle(ccx, ccy, cr, C.track, 3);
    arc(ccx, ccy, cr, 0, th, C.yellow, 6);
    const px = ccx + cr * Math.cos(th), py = ccy - cr * Math.sin(th);
    line(ccx, ccy, px, ccy, C.teal, 6); line(px, ccy, px, py, C.blue, 6);
    runner(px, py, 1);
  });
  // s7 values
  const vA = prog(t, q.w('마이너스', 7), 0.5) * rOut;
  text('가로 위치 = −1', 1340, 600, { size: 42, color: C.teal, a: vA, align: 'left' });
  text('세로 위치 = 0', 1340, 670, { size: 42, color: C.blue, a: prog(t, q.w('영', 7), 0.5) * rOut, align: 'left' });
  formula('eipi', 1340, 800, 92, { align: 'left', a: rOut, p: lin(t, q.w('결과는', 7), 1.6) });
  // s8: what Euler wrote vs what came later
  const mA = prog(t, q.s(8), 0.6) * (1 - prog(t, q.s(9) + 0.8, 0.6));
  image('introductio', 170, 280, 330, 440, { a: mA, dim: 0.15 });
  withAlpha(mA, () => {
    formula('euler', 1000, 400, 80, {});
    text('1748년에 적힌 것', 1000, 300, { size: 30, font: SANS, color: C.dim });
    arrow(1000, 460, 1000, 600, C.dim, 3, prog(t, q.w('나중', 8), 0.8));
    formula('identity', 1000, 720, 100, { p: lin(t, q.w('나중', 8) + 0.4, 1.4) });
    text('나중 사람들이 꺼낸 것', 1000, 800, { size: 30, font: SANS, color: C.dim, a: prog(t, q.w('꺼낸', 8), 0.5) });
  });
  // s9: no picture yet
  const nA = prog(t, q.s(9) + 0.2, 0.6);
  withAlpha(nA, () => {
    formula('euler', 960, 420, 96, {});
    circle(960, 690, 120, C.grey, 3, 1, [10, 12]);
    text('계산은 있었지만, 그림은 아직', 960, 880, { size: 36, font: SANS, color: C.dim });
  });
};

// ============ 6 · 수가 사는 평면 ============
SCENES.plane = (t, q) => {
  timeline(130, { a: 1 - prog(t, q.s(1), 0.8), size: 24, marker: lerp(3, 4, prog(t, q.start + 2.6, 1.2)), active: 4 });
  // surveyor: a measured plot of land
  const sv = prog(t, q.w('땅을', 0) - 0.3, 0.8) * (1 - prog(t, q.s(1) + 0.4, 0.6));
  withAlpha(sv, () => {
    const pts = [[700, 760], [1060, 620], [1240, 820], [880, 900]];
    ctx.save(); ctx.strokeStyle = C.teal; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.stroke(); ctx.restore();
    pts.forEach(p => disc(p[0], p[1], 7, C.teal));
    text('땅을 재던 사람', 970, 560, { size: 32, font: SANS, color: C.dim });
  });
  // the plane
  const cx = 960, cy = 560, U = 210;
  const hl = prog(t, q.s(1) - 0.2, 1.0);
  const vl = prog(t, q.w('평면', 1) - 0.1, 1.0);
  const planeDim = 1 - 0.55 * prog(t, q.s(9), 0.8);
  withAlpha(planeDim, () => {
    withAlpha(vl * 0.9, () => {
      for (let k = -4; k <= 4; k++) { line(cx + k * U, cy - 2.4 * U, cx + k * U, cy + 2.4 * U, C.grid, 1.5); }
      for (let k = -2; k <= 2; k++) { line(cx - 4.2 * U, cy + k * U, cx + 4.2 * U, cy + k * U, C.grid, 1.5); }
    });
    line(cx - 4.2 * U, cy, cx + 4.2 * U, cy, C.teal, 3, hl);
    line(cx, cy + 2.3 * U, cx, cy - 2.3 * U, C.blue, 3, vl);
    const la = prog(t, q.s(2), 0.6);
    [[-2, '−2'], [-1, '−1'], [1, '1'], [2, '2']].forEach(([k, s]) => { withAlpha(hl, () => line(cx + k * U, cy - 10, cx + k * U, cy + 10, C.text, 3)); text(s, cx + k * U, cy + 44, { size: 38, a: la * hl }); });
    text('0', cx - 26, cy + 40, { size: 34, color: C.dim, a: la });
    const ia = prog(t, q.w('위로', 2), 0.6);
    disc(cx, cy - U, 9, C.blue, ia); formula('i_sym', cx + 34, cy - U + 12, 64, { align: 'left', p: ia });
    disc(cx, cy + U, 7, C.blue, ia * 0.7); formula('mi', cx + 30, cy + U + 12, 56, { align: 'left', p: ia * 0.7 });
  });
  // s3: multiply by i = rotate
  const r1 = prog(t, q.wx('아이', 3, 0) - 0.5, 1.0), r2 = prog(t, q.w('다시', 3), 1.0);
  const rotOut = 1 - prog(t, q.s(5) - 0.2, 0.5);
  const rotA = prog(t, q.s(3) + 0.3, 0.5) * rotOut;
  const ang = PI / 2 * (r1 + r2);
  withAlpha(rotA, () => {
    arrow(cx, cy, cx + U * Math.cos(ang), cy - U * Math.sin(ang), C.text, 6, 1, 24);
    if (r1 > 0) { arc(cx, cy, 70, 0, PI / 2 * r1, C.blue, 4); formula('times_i', cx + 64, cy - 78, 48, { align: 'left', p: r1 }); }
    if (r2 > 0) { arc(cx, cy, 90, PI / 2, PI / 2 + PI / 2 * r2, C.blue, 4); formula('times_i', cx - 160, cy - 84, 48, { align: 'left', p: r2 }); }
    text('90°', cx + 108, cy - 20, { size: 30, color: C.blue, a: r1 });
  });
  // s4: i = rotate 90°
  const ca = prog(t, q.w('돌리기', 4) - 0.3, 0.6) * rotOut;
  withAlpha(ca, () => { box(1360, 210, 440, 96, { stroke: C.blue, r: 16 }); formula('i_sym', 1430, 275, 64, {}); text('= 90° 돌리기', 1610, 258, { size: 40, font: SANS, color: C.blue, weight: 500 }); });
  formula('ixi', 1580, 400, 64, { a: prog(t, q.s(4) + 1.0, 0.6) * rotOut });
  text('단순하게 줄인 그림', 1580, 470, { size: 28, font: SANS, color: C.dim, a: prog(t, q.w('단순하게', 4), 0.5) * rotOut });
  // s5–s8: the green arrow turns sideways, the dot walks the circle
  const wA = prog(t, q.s(5) + 0.2, 0.6);
  const circA = prog(t, q.s(5) + 0.4, 1.0);
  withAlpha(planeDim, () => circle(cx, cy, U, C.track, 3, circA));
  const turn = prog(t, q.w('화살표가', 6), 1.0);
  const walkStart = q.s(7) + 0.3, walkEnd = q.w('정반대편', 8);
  const th = PI * smooth((t - walkStart) / Math.max(0.5, walkEnd - walkStart));
  const px = cx + U * Math.cos(th), py = cy - U * Math.sin(th);
  if (th > 0) arc(cx, cy, U, 0, th, C.yellow, 7);
  runner(px, py, wA);
  const L = 150;
  const dirOut = th;  // outward direction angle
  const dir = dirOut + PI / 2 * turn;
  const arrA = wA * (1 - prog(t, walkEnd + 0.6, 0.6));
  arrow(px, py, px + L * Math.cos(dir), py - L * Math.sin(dir), C.green, 7, arrA, 26);
  text('바깥으로', px + 110, py - 50, { size: 30, font: SANS, color: C.green, a: arrA * (1 - turn) * prog(t, q.s(5) + 0.8, 0.5) });
  if (turn > 0 && th < 0.05) { arc(px, py, 60, 0, PI / 2 * turn, C.blue, 3); formula('times_i', px + 50, py - 64, 44, { align: 'left', a: turn * (1 - prog(t, walkStart, 0.4)) }); }
  text('옆으로', px + 70, py - 180, { size: 30, font: SANS, color: C.green, a: turn * (1 - prog(t, walkStart, 0.5)) });
  // walked distance readout
  const rd = prog(t, walkStart, 0.5) * (1 - prog(t, q.s(9), 0.5));
  text(`걸은 거리 = ${th.toFixed(2)}`, 1480, 840, { size: 40, color: C.yellow, a: rd, align: 'left' });
  const arrive = prog(t, walkEnd, 0.5);
  formula('pi_sym', cx + (U + 60) * Math.cos(2.25), cy - (U + 60) * Math.sin(2.25) + 25, 80, { p: arrive });
  text('−1', cx - U - 60, cy - 50, { size: 54, color: C.text, a: arrive, weight: 500 });
  // s9: write the line
  const f1 = lin(t, q.s(9), 1.4);
  const sw = prog(t, q.w('더하면', 9) - 0.6, 0.6);
  formula('eipi', 960, 150, 100, { p: f1, a: 1 - sw });
  formula('identity', 960, 150, 100, { p: sw > 0 ? 1 : 0, a: sw });
  // s10: the name
  const nm = prog(t, q.w('오일러', 10) - 0.1, 0.6);
  text('오일러 항등식', 1480, 150, { size: 56, color: C.purple, a: nm, weight: 500, align: 'left' });
  line(1470, 150, 1270, 150, C.purple, 2, nm, [6, 8]);
  const cb = prog(t, q.w('맨', 10), 0.8);
  withAlpha(cb, () => { box(1440, 690, 380, 230, { r: 16 }); circle(1630, 805, 70, C.grey, 2); arc(1630, 805, 70, 0, PI, C.yellow, 5); runner(1560, 805, 1, 9); text('처음 본 반 바퀴', 1630, 900, { size: 26, font: SANS, color: C.dim }); });
};

// ============ 7 · 가장 아름다운 한 줄 ============
SCENES.beauty = (t, q) => {
  const fx = 960, fy = 300, fs = 120;
  const fA = 1 - prog(t, q.s(1) - 0.6, 0.5) + prog(t, q.s(3) - 0.4, 0.6);
  const fPos = prog(t, q.s(3) - 0.4, 0.01);
  const Y = fPos > 0 ? 470 : fy, S = fPos > 0 ? 140 : fs;
  const out8 = 1 - prog(t, q.s(8) - 0.3, 0.6);
  formula('identity', fx, Y, S, { a: clamp01(fA) * out8,
    gScale: k => {
      // s4: highlight 0, 1, π, e, i one by one (order of speech)
      const order = [6, 4, 2, 0, 1]; const idx = order.indexOf(k); if (idx < 0) return 1;
      const keys = [q.w('영', 4), q.w('일', 4), q.w('파이', 4), q.wx('이', 4), q.w('아이가', 4)];
      return 1 + 0.25 * Math.sin(PI * clamp01((t - keys[idx] + 0.1) / 0.6));
    } });
  // s1: the notebook
  const nA = prog(t, q.s(1) - 0.7, 0.6) * (1 - prog(t, q.s(2) - 0.2, 0.5));
  image('feynman', 260, 260, 360, 450, { a: nA, zoom: 1.02 });
  text('열네 살의 공책', 440, 760, { size: 30, font: SANS, color: C.dim, a: nA });
  withAlpha(nA, () => {
    box(820, 300, 860, 380, { fill: C.paper, stroke: null, r: 10 });
    for (let k = 0; k < 7; k++) line(850, 360 + k * 46, 1650, 360 + k * 46, C.paperLine, 1.5);
    text('수학에서 가장 놀라운 공식', 1250, 400, { size: 44, color: C.paperInk, font: SERIF, weight: 500 });
    formula('identity', 1250, 560, 110, { color: C.paperMath, p: lin(t, q.s(1) + 0.5, 1.8) });
  });
  // s2: the poll
  const pA = prog(t, q.s(2) - 0.1, 0.6) * (1 - prog(t, q.s(3) - 0.4, 0.5));
  withAlpha(pA, () => {
    text('어느 수식이 가장 아름다운가? (점수)', 960, 250, { size: 40, font: SANS, weight: 500 });
    const bars = [[0.77, true], [0.72, false], [0.70, false], [0.66, false]];
    bars.forEach(([v, top], j) => {
      const y = 370 + j * 120, w = 1000 * v * prog(t, q.s(2) + 0.6 + j * 0.2, 0.8);
      box(420, y - 40, w, 80, { fill: top ? mix(C.purple, 0.25) : mix(C.text, 0.05), stroke: top ? C.purple : C.grey, r: 10 });
      text(String(j + 1) + '위', 380, y, { size: 32, font: SANS, color: top ? C.purple : C.dim, align: 'right' });
      if (top) formula('identity', 440, y + 22, 60, { align: 'left', a: prog(t, q.w('일', 2), 0.5) });
    });
  });
  // s3: why
  const wA = prog(t, q.w('왜', 3), 0.5) * (1 - prog(t, q.s(4), 0.4));
  text('왜?', fx, 260, { size: 70, a: wA, weight: 500 });
  // s4: five numbers labels
  const labs = [[6, '0', C.text], [4, '1', C.text], [2, 'π', C.yellow], [0, 'e', C.green], [1, 'i', C.blue]];
  const l4 = prog(t, q.s(4) + 0.4, 0.5) * (1 - prog(t, q.s(5) + 0.2, 0.5));
  const five = [[q.w('영', 4), '0', C.text], [q.w('일', 4), '1', C.text], [q.w('파이', 4), 'π', C.yellow], [q.wx('이', 4), 'e', C.green], [q.w('아이가', 4), 'i', C.blue]];
  five.forEach(([tk, s, col], j) => {
    const a = l4 * prog(t, tk - 0.1, 0.4);
    text(s, 700 + j * 130, 640, { size: 64, color: col, a, font: SERIF });
  });
  text('다섯 개의 중요한 수', 960, 730, { size: 32, font: SANS, color: C.dim, a: l4 * prog(t, q.s(4) + 0.3, 0.5) });
  // s5: origins
  const o5 = prog(t, q.s(5) - 0.2, 0.5) * (1 - prog(t, q.s(7) - 0.2, 0.5));
  const ox = [1360, 960, 560], oy = 780;
  const oKeys = [q.w('파이', 5), q.w('아이', 5), q.wx('이', 5)];
  const gIdx = [2, 1, 0];
  ['원을 재다가', '믿지 않던 계산', '돈 계산'].forEach((s, j) => {
    const a = o5 * prog(t, oKeys[j] - 0.3, 0.5);
    const col = [C.yellow, C.blue, C.green][j];
    const b = glyphBox('identity', gIdx[j], fx, 470, 140);
    line(b.cx, b.y + b.h + 30, ox[j], oy - 70, col, 2.5, a, [6, 8]);
    if (j === 0) iconCircle(ox[j], oy - 10, 40, a); if (j === 1) iconQ(ox[j], oy - 10, 40, a); if (j === 2) iconCoin(ox[j], oy - 10, 40, a);
    text(s, ox[j], oy + 64, { size: 30, font: SANS, color: col, a, weight: 500 });
  });
  // s6: all eras, one circle
  const tA = prog(t, q.s(6), 0.6) * (1 - prog(t, q.s(8) - 0.3, 0.5));
  timeline(250, { a: tA, size: 26, lit: k => prog(t, q.s(6) + 0.3 + k * 0.35, 0.4) });
  // s7: many eras, one sentence
  const s7 = prog(t, q.s(7) + 0.4, 0.6) * (1 - prog(t, q.s(8) - 0.3, 0.5));
  text('여러 시대가 함께 쓴 한 문장', fx, 640, { size: 46, color: C.text, a: s7, weight: 500 });
  // s8–s9: the final walk
  const fA2 = prog(t, q.s(8) - 0.1, 0.8);
  const ccx = 960, ccy = 520, R = 250;
  withAlpha(fA2, () => {
    circle(ccx, ccy, R + 24, C.grey, 1.5); circle(ccx, ccy, R - 24, C.grey, 1.5); circle(ccx, ccy, R, C.track, 3);
    formula('identity', ccx, 130, 80, {});
  });
  const st = q.w('출발해', 8), en = q.w('정반대편', 8);
  const th = PI * smooth((t - st + 0.3) / Math.max(1, en - st + 0.3));
  if (fA2 > 0 && th > 0) arc(ccx, ccy, R, 0, th, C.yellow, 7);
  runner(ccx + R * Math.cos(th), ccy - R * Math.sin(th), fA2);
  text('1', ccx + R + 56, ccy, { size: 50, a: fA2 * prog(t, q.w('일에서', 8) - 0.2, 0.5) });
  text('−1', ccx - R - 64, ccy, { size: 50, a: prog(t, en, 0.5) });
  formula('pi_sym', ccx, ccy - R - 50, 70, { p: prog(t, q.w('파이만큼', 8), 0.8) * fA2 });
  const last = prog(t, q.s(9), 0.8);
  text('반 바퀴', ccx, ccy + 20, { size: 88, color: C.yellow, a: last, weight: 500 });
};
