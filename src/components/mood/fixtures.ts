/**
 * The locked-Pay route, for the docs' replay and the tests: someone circles the locked Pay, unsure; presses it again
 * and again and shakes the pointer; ticks the terms; pays. Timings, layout and the pointer's path are those of
 * Libraries.dev's Mood recognition showcase (sites/home/src/mood-recognition.tsx, MIT, © 2026 Jakub Antalik). There
 * the HUD shows scripted readings; here the route is fed to the real reader, so what it shows is what the reader read.
 */

export const PAY_LOOP_MS = 15_800;
/** The stage the route is laid out on, px. */
export const PAY_STAGE = { w: 880, h: 520 };
const SCREEN_W = 460;
const SCREEN_H = 300;
const FORM_W = 338;
const PAY_H = 48;
const FORM_GAP = 19;
const BOX = 18;
const FORM_H = PAY_H + FORM_GAP + BOX;

const ORBIT = { from: 1600, to: 3800, turns: 2.1, radius: 30 };
export const PAY_PRESSES = [6000, 6350, 6650, 7500];
const SHAKE = { from: 6950, to: 7950 };
export const PAY_AGREE_AT = 10_100;
export const PAY_AT = 12_500;

export interface PayBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PayLayout {
  screen: { x: number; y: number; w: number; h: number };
  pay: PayBox;
  check: PayBox;
}

export interface PayPoint {
  x: number;
  y: number;
}

/** Where things sit on a stage `w` wide (the screen centred, the form centred in it). */
export function payLayout(w = PAY_STAGE.w): PayLayout {
  const screen = {
    x: Math.round((w - SCREEN_W) / 2),
    y: Math.round((PAY_STAGE.h - SCREEN_H) / 2 - 18),
    w: SCREEN_W,
    h: SCREEN_H,
  };
  const form = { x: screen.x + (SCREEN_W - FORM_W) / 2, y: screen.y + (SCREEN_H - FORM_H) / 2 + 8 };
  return {
    screen,
    pay: { x: form.x, y: form.y, w: FORM_W, h: PAY_H },
    check: { x: form.x, y: form.y + PAY_H + FORM_GAP, w: BOX, h: BOX },
  };
}

type Leg = [from: number, to: number, a: PayPoint, b: PayPoint];

/** The pointer's way through the loop. */
export function payRoute(l: PayLayout): Leg[] {
  const out = { x: l.screen.x + SCREEN_W + 60, y: l.screen.y + SCREEN_H + 50 };
  const round = { x: l.pay.x + l.pay.w / 2 + 40, y: l.pay.y - 52 };
  const onPay = { x: l.pay.x + l.pay.w / 2 + 22, y: l.pay.y + PAY_H / 2 + 4 };
  const onCheck = { x: l.check.x + BOX / 2 + 1, y: l.check.y + BOX / 2 + 2 };
  const onPay2 = { x: l.pay.x + l.pay.w / 2 - 14, y: l.pay.y + 12 };
  return [
    [0, 500, out, out],
    [500, 1500, out, round],
    [1500, 4700, round, round],
    [4700, 5500, round, onPay],
    [5500, 8900, onPay, onPay],
    [8900, 9800, onPay, onCheck],
    [9800, 11_400, onCheck, onCheck],
    [11_400, 12_200, onCheck, onPay2],
    [12_200, 13_800, onPay2, onPay2],
    [13_800, 14_800, onPay2, out],
    [14_800, PAY_LOOP_MS, out, out],
  ];
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Where the pointer is `t` ms into the loop: the legs eased, the circling above Pay, the shake on it. */
export function payPointerAt(route: Leg[], t: number): PayPoint {
  const leg = route.find(([a, b]) => t >= a && t < b) ?? route[route.length - 1];
  const [a, b, from, to] = leg;
  const k = ease(Math.min(1, Math.max(0, (t - a) / (b - a))));
  let x = from.x + (to.x - from.x) * k;
  let y = from.y + (to.y - from.y) * k;
  if (t > ORBIT.from && t < ORBIT.to) {
    const s = (t - ORBIT.from) / (ORBIT.to - ORBIT.from);
    const r = ORBIT.radius * Math.sin(Math.PI * s);
    const ang = Math.PI * 2 * ORBIT.turns * (s - 0.07 * Math.sin(Math.PI * 4 * s));
    x += Math.cos(ang) * r + Math.sin(ang * 2.3) * r * 0.22;
    y += Math.sin(ang) * r * 0.72 + Math.cos(ang * 1.7) * r * 0.16;
  }
  if (t > SHAKE.from && t < SHAKE.to) {
    const s = (t - SHAKE.from) / (SHAKE.to - SHAKE.from);
    x += Math.sin((t - SHAKE.from) / 27) * 18 * Math.sin(Math.PI * s);
  }
  return { x, y };
}

/** Every press in the loop: four on the locked Pay, the terms, then Pay. */
export function payPresses(): Array<{ at: number; on: 'pay' | 'check' }> {
  return [
    ...PAY_PRESSES.map((at) => ({ at, on: 'pay' as const })),
    { at: PAY_AGREE_AT, on: 'check' },
    { at: PAY_AT, on: 'pay' },
  ];
}

/** The pointer is off the stage at the start and the end of the loop. */
export const payPointerGone = (t: number): boolean => t < 300 || t > 14_700;

export const inBox = (p: PayPoint, b: PayBox, pad = 0): boolean =>
  p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;
