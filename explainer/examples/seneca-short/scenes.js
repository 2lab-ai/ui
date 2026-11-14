// scenes.js — "인생은 짧지 않다" (Seneca, De Brevitate Vitae 1.3) as a vertical YouTube Short (project.json "format": "short").
// One scene, six beats keyed to its sentences: the question, Seneca and his reader, money locked / time given away,
// the day in pieces, two owners, the answer. Yellow is time throughout (the running example), green money, red waste,
// lavender (C.blue) Seneca's own words. Everything written stays inside FRAME.safe: the Shorts player covers the bottom
// 20 % and the right 15 %. The captions are drawn here (project.json "subtitles": "off") so that the question and the
// answer, already in the middle of the screen, are not repeated underneath.
'use strict';

const N_DAY = 16;   // the day as 16 slices

// ---------- helpers ----------
// beats: [[t0, draw(t, lt)], …]; the last beat that has started is drawn, cross-fading from the one before
function beats(t, list, fade = 0.4) {
  let i = -1;
  for (let k = 0; k < list.length; k++) if (t >= list[k][0]) i = k;
  if (i < 0) return;
  const f = i > 0 ? smooth((t - list[i][0]) / fade) : 1;
  if (f < 1) withAlpha(1 - f, () => list[i - 1][1](t, t - list[i - 1][0]));
  withAlpha(f, () => list[i][1](t, t - list[i][0]));
}
// the engine's subtitle box (bottom of the safe area), for every sentence but those in `skip`
function captions(t, sc, skip) {
  for (let k = 0; k < sc.sentences.length; k++) {
    const s = sc.sentences[k], end = s.start + s.dur;
    if (t >= s.start - 0.25 && t < end - 0.2) {
      if (!skip.includes(k)) subtitle(s.text, Math.min(prog(t, s.start - 0.25, 0.18), 1 - prog(t, end - 0.32, 0.12)));
      return;
    }
  }
}
const safeCx = () => (FRAME.safe.x0 + FRAME.safe.x1) / 2;
// the largest size up to `size` at which str fits maxW
function fit(str, maxW, size, weight = 700) { while (size > 20 && textW(str, size, SANS, weight) > maxW) size -= 2; return size; }
function wedge(cx, cy, r, a0, a1, fill) {
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a1); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = C.bg; ctx.lineWidth = 4; ctx.stroke();
}
const sliceA = (k, n) => -Math.PI / 2 + (k / n) * Math.PI * 2;   // clockwise from 12 o'clock

// a pie of n yellow slices; gone(k) in 0..1 = how far slice k has left, its direction from dir(k)
function pie(cx, cy, r, n, { draw = 1, gone = () => 0, dir = null, dist = 160, a = 1 } = {}) {
  withAlpha(a, () => {
    for (let k = 0; k < n; k++) {
      if (k / n >= draw) break;
      const a0 = sliceA(k, n), a1 = sliceA(k + 1, n), g = gone(k), mid = (a0 + a1) / 2;
      const [dx, dy] = dir ? dir(k, g) : [Math.cos(mid) * dist * g, Math.sin(mid) * dist * g];
      withAlpha(1 - g, () => wedge(cx + dx, cy + dy, r, a0, a1, mix(C.yellow, 0.62 - 0.3 * g)));   // handed over: gone
    }
    circle(cx, cy, r, C.yellow, 4, draw);
  });
}

// ---------- beat 0: the question ----------
function questionCard(t, q) {
  const S = FRAME.safe, cx = safeCx(), str = '인생은 정말 짧을까?';
  const a = prog(t, 0, 0.2);
  text(str, cx, 860, { size: fit(str, S.x1 - S.x0 - 40, 92), font: SANS, weight: 700, a });
  // the life line under it, drawn on, then shortened as the voice says 짧을까
  const short = prog(t, q.w('짧을', 0), 0.6);
  const half = lerp(300, 110, short);
  line(cx - half, 980, cx + half, 980, C.yellow, 10, prog(t, 0.15, 0.7));
}
// the first frames, before the scene body fades in (renderAt's title card slot)
TITLE_CARD = (sc, a, isFirst, lt) => { if (isFirst && lt < sc.lead - 0.15) questionCard(sc.start + lt, Q(sc.id)); };

// ---------- beat 1: Seneca and his reader ----------
function senecaBeat(t, q) {
  const cx = safeCx();
  const m = prog(t, q.s(2) - 0.2, 0.9);                       // s2: the portrait steps up for the letter
  const w = lerp(560, 330, m), h = w * 1525 / 960, y = lerp(175, 150, m);
  image('seneca', cx - w / 2, y, w, h, { a: prog(t, q.s(1) - 0.15, 0.5), zoom: 1 + 0.04 * clamp01((t - q.s(1)) / 9), r: 16, dim: 0.08 });
  const na = prog(t, q.w('세네카', 1), 0.4) * (1 - m);        // the name after the picture
  text('세네카', cx, 1150, { size: 68, font: SANS, weight: 700, a: na });
  text('로마의 철학자', cx, 1222, { size: 32, font: SANS, weight: 500, color: C.dim, a: na });
  if (m <= 0) return;
  arrow(cx, y + h + 22, cx, 818, C.grey, 4, prog(t, q.s(2) + 0.3, 0.5), 16);
  const lx = cx - 190, ly = 840, lw = 380, lh = 250, pl = prog(t, q.s(2) + 0.5, 0.6);
  box(lx, ly, lw, lh, { fill: C.paper, stroke: C.grey, r: 14, a: pl });
  text('서기 49년 무렵', cx, ly + 44, { size: 28, font: SANS, weight: 500, color: C.dim, a: pl });
  for (let i = 0; i < 4; i++) line(lx + 44, ly + 96 + i * 34, lx + lw - 44 - (i === 3 ? 130 : 0), ly + 96 + i * 34, C.track, 4, prog(t, q.s(2) + 0.8 + i * 0.22, 0.4));
  disc(lx + lw - 54, ly + lh - 42, 20, C.blue, prog(t, q.s(2) + 1.8, 0.3));
  const pa = prog(t, q.w('파울리누스', 2), 0.4);
  text('파울리누스', cx, 1180, { size: 62, font: SANS, weight: 700, color: C.blue, a: pa });
  text('로마의 곡물 공급 책임자', cx, 1248, { size: 32, font: SANS, weight: 500, color: C.dim, a: pa });
}

// ---------- beat 2: money locked, time given away ----------
function padlock(cx, cy, close, a) {
  const bw = 300, bh = 220, top = cy - bh / 2, lift = 70 * (1 - close);
  withAlpha(a, () => {
    ctx.save(); ctx.strokeStyle = C.green; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 92, top + 20 - lift); ctx.lineTo(cx - 92, top - 70 - lift);
    ctx.arc(cx, top - 70 - lift, 92, Math.PI, 0); ctx.lineTo(cx + 92, top + 20 - (close < 1 ? lift + 30 * (1 - close) : 0));
    ctx.stroke(); ctx.restore();
    box(cx - bw / 2, top, bw, bh, { fill: C.bg, stroke: null, r: 26 });
    box(cx - bw / 2, top, bw, bh, { fill: mix(C.green, 0.12), stroke: C.green, r: 26, lw: 5 });
    disc(cx, cy + 6, 64, mix(C.green, 0.3)); circle(cx, cy + 6, 64, C.green, 5); circle(cx, cy + 6, 46, C.green, 2);
  });
}
function moneyTimeBeat(t, q) {
  const cx = safeCx(), S = FRAME.safe;
  const la = prog(t, q.w('돈', 3) - 0.1, 0.4);
  padlock(cx, 470, prog(t, q.w('지키', 3) + 0.1, 0.35), la);
  // the clock: twelve hours, each handed over to whoever asks, drifting off to the right
  const ca = prog(t, q.w('시간', 3) - 0.1, 0.4), t0 = q.w('달라는', 3);
  const gone = (k) => smooth((t - t0 - k * 0.17) / 0.9);
  withAlpha(ca, () => {
    pie(cx, 960, 170, 12, { gone, dir: (k, g) => { const m = (sliceA(k, 12) + sliceA(k + 1, 12)) / 2; return [g * (250 + 90 * Math.cos(m)), g * 90 * Math.sin(m)]; } });
    for (let k = 0; k < 12; k++) { const a0 = sliceA(k, 12); line(cx + Math.cos(a0) * 150, 960 + Math.sin(a0) * 150, cx + Math.cos(a0) * 170, 960 + Math.sin(a0) * 170, C.yellow, 3); }
  });
  // s4, Seneca's sentence: a quotation mark, then the two verdicts
  text('“', S.x0 + 40, 250, { size: 220, font: SANS, weight: 700, color: C.blue, a: prog(t, q.s(4) - 0.2, 0.4) });
  text('엄격', cx, 650, { size: 50, font: SANS, weight: 700, color: C.green, a: prog(t, q.w('엄격', 4), 0.35) });
  text('관대', cx, 1192, { size: 50, font: SANS, weight: 700, color: C.red, a: prog(t, q.w('관대', 4), 0.35) });
}

// ---------- beat 3: the day in pieces ----------
const CHUNKS = [['부탁', [0, 1, 2, 3]], ['다툼', [4, 5, 6, 7]], ['기다림', [8, 9, 10, 11]], ['조각조각', [12, 13]]];
function dayBeat(t, q) {
  const cx = safeCx(), cy = 720, r = 300;
  const when = {};
  CHUNKS.forEach(([w, ks]) => { const tw = q.w(w, 5); ks.forEach((k, j) => { when[k] = tw + (w === '조각조각' ? j * 0.25 : 0); }); });
  const fadeAway = prog(t, q.s(6) + 0.2, 1.0);           // s6: what was given away is gone
  const gone = (k) => (k in when ? smooth((t - when[k]) / 0.7) : 0);
  // a chunk leaves along its own middle direction, as one piece
  const dir = (k, g) => {
    const ch = CHUNKS.find(([, ks]) => ks.includes(k)); if (!ch) return [0, 0];
    const ks = ch[1], m = (sliceA(ks[0], N_DAY) + sliceA(ks[ks.length - 1] + 1, N_DAY)) / 2;
    return [Math.cos(m) * 150 * g, Math.sin(m) * 150 * g];
  };
  {   // the given-away slices fade with fadeAway; the kept two stay
    for (const pass of ['given', 'kept']) {
      const keep = (k) => !(k in when);
      withAlpha(pass === 'given' ? 1 - 0.85 * fadeAway : 1, () => {
        for (let k = 0; k < N_DAY; k++) {
          if ((pass === 'kept') !== keep(k)) continue;
          if (k / N_DAY >= prog(t, q.s(5) - 0.3, 1.0)) continue;
          const a0 = sliceA(k, N_DAY), a1 = sliceA(k + 1, N_DAY), g = gone(k), [dx, dy] = dir(k, g);
          const pulse = keep(k) ? 1 + 0.06 * Math.sin(Math.PI * clamp01((t - q.w('조금', 6)) / 0.7)) : 1;
          withAlpha(1 - 0.45 * g, () => wedge(cx + dx, cy + dy, r * pulse, a0, a1, mix(C.yellow, 0.62 - 0.32 * g)));
        }
      });
    }
    circle(cx, cy, r, mix(C.yellow, 0.5), 3, prog(t, q.s(5) - 0.3, 1.0) * (1 - 0.6 * fadeAway));
  }
  text('하루', cx, 1090, { size: 46, font: SANS, weight: 700, color: C.dim, a: prog(t, q.w('하루', 5), 0.4) * (1 - fadeAway) });
  // the slice that is left: 10:30 to 12 on the dial; its name once the voice says 조금
  const m = (sliceA(14, N_DAY) + sliceA(16, N_DAY)) / 2;
  text('내 시간', cx + Math.cos(m) * (r + 80), cy + Math.sin(m) * (r + 80) + 10, { size: 52, font: SANS, weight: 700, color: C.yellow, a: prog(t, q.w('온전히', 6), 0.4) });
}

// ---------- beat 4: two owners ----------
function coinStack(x, base, n, colour, a, drop = null) {
  withAlpha(a, () => {
    for (let i = 0; i < Math.ceil(n); i++) {
      const part = Math.min(1, n - i);                       // the top coin of a growing stack fades in
      const y = base - i * 36;
      const fall = drop ? drop(i) : 0;                       // a coin leaving: it lifts off and fades
      withAlpha(part * (1 - fall), () => {
        ctx.save(); ctx.translate(x, y - 70 * fall);
        ctx.beginPath(); ctx.ellipse(0, 0, 110, 30, 0, 0, Math.PI * 2);
        ctx.fillStyle = C.bg; ctx.fill(); ctx.fillStyle = mix(colour, 0.3); ctx.fill();
        ctx.strokeStyle = colour; ctx.lineWidth = 3.5; ctx.stroke(); ctx.restore();
      });
    }
  });
}
function ownersBeat(t, q) {
  const cx = safeCx(), base = 1000, lx = cx - 210, rx = cx + 210;
  const a = prog(t, q.s(7) - 0.1, 0.5);
  // s8: the spendthrift's coins leave from the top one by one; the careful owner's grow
  const tl = q.w('바닥', 8) - 0.3, left = 9;
  const drop = (i) => smooth((t - tl - (left - 1 - i) * 0.16) / 0.5) * (i >= 1 ? 1 : 0);
  const grow = 3 + 6 * prog(t, q.w('불어', 8) - 0.2, 1.3) + 4 * prog(t, q.w('충분히', 9), 1.0);
  // s9: money becomes time (green -> yellow)
  const toTime = prog(t, q.w('인생도', 9), 0.8);
  for (const [colour, w] of [[C.green, 1 - toTime], [C.yellow, toTime]]) {
    if (w <= 0) continue;
    coinStack(lx, base, left, colour, a * w, drop);
    coinStack(rx, base, grow, colour, a * w);
  }
  text('헤픈 주인', lx, 1090, { size: 40, font: SANS, weight: 500, color: C.dim, a: prog(t, q.w('헤픈', 8), 0.4) });
  text('알뜰한 주인', rx, 1090, { size: 40, font: SANS, weight: 500, color: C.dim, a: prog(t, q.w('알뜰', 8), 0.4) });
}

// ---------- beat 5: the answer ----------
function answerBeat(t, q) {
  const S = FRAME.safe, cx = safeCx(), k = 10;
  pie(cx, 620, 170, N_DAY, { draw: prog(t, q.s(k) - 0.2, 1.4) });   // the whole day, back
  const a1 = prog(t, q.s(k), 0.4), a2 = prog(t, q.w('낭비', k), 0.4);
  const p1 = '짧은 게 아니라, ', p2 = '낭비할 뿐';
  const size = fit(p1 + p2, S.x1 - S.x0 - 40, 76);
  const w1 = textW(p1, size, SANS, 700), w2 = textW(p2, size, SANS, 700), x0 = cx - (w1 + w2) / 2;
  text(p1, x0, 930, { size, font: SANS, weight: 700, align: 'left', a: a1 });   // one line, up at once; 낭비 turns red as it is said
  text(p2, x0 + w1, 930, { size, font: SANS, weight: 700, align: 'left', a: a1 * (1 - a2) });
  text(p2, x0 + w1, 930, { size, font: SANS, weight: 700, align: 'left', color: C.red, a: a1 * a2 });
  const la = prog(t, q.s(k) + 0.8, 0.6);
  text('Non exiguum temporis habemus,', cx, 1054, { size: 38, font: SANS, color: C.dim, italic: true, a: la });
  text('sed multum perdidimus.', cx, 1108, { size: 38, font: SANS, color: C.dim, italic: true, a: la });
  text('세네카, 『인생의 짧음에 대해』 1.3', cx, 1190, { size: 32, font: SANS, weight: 500, color: C.dim, a: prog(t, q.s(k) + 1.2, 0.6) });
}

SCENES.short = (t, q, sc) => {
  if (t < q.s(1)) ctx.globalAlpha = 1;   // the question is up from the first frames (TITLE_CARD): no body fade under it
  beats(t, [
    [0, (t) => questionCard(t, q)],
    [q.s(1) - 0.15, (t) => senecaBeat(t, q)],
    [q.s(3) - 0.15, (t) => moneyTimeBeat(t, q)],
    [q.s(5) - 0.15, (t) => dayBeat(t, q)],
    [q.s(7) - 0.15, (t) => ownersBeat(t, q)],
    [q.s(10) - 0.3, (t) => answerBeat(t, q)],
  ]);
  captions(t, sc, [0, 10]);   // the question and the answer are on screen already
};
