import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { doc } from './docs';
import { emptyReading, MoodCore, moodBaseline, moodReactTo } from './engine/core';
import { moodElementKey, moodFactsOf, moodIgnored, moodPath } from './engine/facts';
import { HOLD_MS, moodPick, pickMood, reactionFor, reactionState, stepReaction } from './engine/reaction';
import { createMoodReader } from './engine/reader';
import { disabledOf, fastSignals, orbitOf, orbitTurns, quickGap, rageOf, reversals, shakeOf } from './engine/signals';
import { emptyHistory, frustratedOf, lostOf, turnbacksOf } from './engine/slow';
import {
  DEFAULT_BASELINE,
  type MoodFacts,
  type MoodReading,
  NO_FACTS,
  noisyOr,
  type PointerSample,
  type PressSample,
} from './engine/types';
import {
  inBox,
  PAY_AGREE_AT,
  PAY_AT,
  PAY_LOOP_MS,
  payLayout,
  payPointerAt,
  payPointerGone,
  payPresses,
  payRoute,
} from './fixtures';
import { moodOptions, type UiMood } from './mood';

const XSS = '<img src=x onerror=alert(1)>';
const BASE = { ...DEFAULT_BASELINE };
const CONTROL: MoodFacts = {
  ...NO_FACTS,
  control: 'c1',
  target: { tag: 'button', id: 'go', role: '', disabled: false, invalid: false },
};
const DISABLED: MoodFacts = {
  ...CONTROL,
  control: 'c2',
  disabled: true,
  target: { tag: 'button', id: 'pay', role: '', disabled: true, invalid: false },
};

/** Samples every 16 ms from `from` to `to` (ms) along `at(t)`. */
function path(from: number, to: number, at: (t: number) => { x: number; y: number }): PointerSample[] {
  const out: PointerSample[] = [];
  for (let t = from; t <= to; t += 16) out.push({ ...at(t), t });
  return out;
}
const press = (t: number, facts: MoodFacts = CONTROL, x = 100, y = 100): PressSample => ({ x, y, t, facts });
const circle = (r: number, perSecond: number) => (t: number) => ({
  x: 300 + r * Math.cos((2 * Math.PI * perSecond * t) / 1000),
  y: 300 + r * Math.sin((2 * Math.PI * perSecond * t) / 1000),
});

describe('fast signals', () => {
  it('counts reversals only after a real swing', () => {
    expect(reversals([0, 10, 0, 10, 0])).toBe(3);
    expect(reversals([0, 3, 0, 3, 0])).toBe(0);
    expect(reversals([0, 5, 10, 15, 20])).toBe(0);
  });

  it('reads a shake at speed and not a straight move or a slow sway', () => {
    const shake = path(0, 900, (t) => ({ x: 400 + Math.sin(t / 27) * 30, y: 300 }));
    expect(shakeOf(shake, 900, BASE)).toBeGreaterThan(0.9);
    const straight = path(0, 900, (t) => ({ x: t, y: 300 }));
    expect(shakeOf(straight, 900, BASE)).toBe(0);
    // the same swings, ten times slower: back and forth, but not a shake
    const sway = path(0, 900, (t) => ({ x: 400 + Math.sin(t / 270) * 9, y: 300 }));
    expect(shakeOf(sway, 900, BASE)).toBeLessThan(0.1);
  });

  it('reads circling one spot as an orbit, and nothing for a line or a shake through the middle', () => {
    const loop = path(0, 2000, circle(30, 1));
    expect(orbitTurns(loop, 2000)).toBeGreaterThan(1.8);
    expect(orbitOf(loop, 2000)).toBeGreaterThan(0.95);
    expect(
      orbitOf(
        path(0, 2000, (t) => ({ x: t / 10, y: 300 })),
        2000,
      ),
    ).toBe(0);
    const shake = path(0, 2000, (t) => ({ x: 300 + Math.sin(t / 27) * 30, y: 300 }));
    expect(orbitOf(shake, 2000)).toBeLessThan(0.2);
    // a big loop round the whole screen is not circling one spot
    expect(orbitOf(path(0, 2000, circle(200, 1)), 2000)).toBe(0);
  });

  it('lets the orbit fade once the path stops bending', () => {
    const loop = path(0, 2000, circle(30, 1));
    const rest = path(2016, 4000, () => circle(30, 1)(2000));
    const all = [...loop, ...rest];
    expect(orbitOf(all, 2300)).toBeGreaterThan(0.9);
    expect(orbitOf(all, 3000)).toBeLessThan(0.6);
    expect(orbitOf(all, 3700)).toBe(0);
  });

  it('reads quick presses on one spot as rage; a triple-click on text is not', () => {
    expect(quickGap(BASE)).toBeCloseTo(495, 5);
    expect(rageOf([press(0), press(250), press(500)], 600, BASE)).toBe(0.75);
    expect(rageOf([press(0), press(250), press(500), press(700)], 800, BASE)).toBe(0.9);
    expect(rageOf([press(0), press(200), press(400), press(600), press(800)], 900, BASE)).toBe(1);
    const nothing = (t: number) => press(t, NO_FACTS);
    expect(rageOf([nothing(0), nothing(150), nothing(300)], 400, BASE)).toBe(0);
    expect(rageOf([nothing(0), nothing(150), nothing(300), nothing(450)], 500, BASE)).toBe(0.75);
    // slow presses are not quick
    expect(rageOf([press(0), press(700), press(1400)], 1450, BASE)).toBe(0);
    // presses spread over the control are not one spot
    expect(rageOf([press(0, CONTROL, 0), press(200, CONTROL, 100), press(400, CONTROL, 200)], 500, BASE)).toBe(0);
    // gone 1.5 s later
    expect(rageOf([press(0), press(250), press(500)], 2100, BASE)).toBe(0);
  });

  it('reads presses on a disabled control at once, holds them, then fades', () => {
    expect(disabledOf([press(0, DISABLED)], 0)).toBe(0.6);
    expect(disabledOf([press(0, DISABLED), press(800, DISABLED)], 900)).toBe(0.9);
    expect(disabledOf([press(0, DISABLED), press(800, DISABLED), press(1500, DISABLED)], 1600)).toBe(0.95);
    expect(disabledOf([press(0, DISABLED)], 1500)).toBe(0.6);
    expect(disabledOf([press(0, DISABLED)], 2250)).toBeCloseTo(0.3, 5);
    expect(disabledOf([press(0, DISABLED)], 3100)).toBe(0);
    expect(disabledOf([press(0)], 0)).toBe(0);
  });

  it('names the strongest fast signal from 0.3', () => {
    const f = fastSignals([], [press(0, DISABLED)], 10, BASE);
    expect(f.kind).toBe('disabled');
    expect(f.fast).toBe(0.6);
    expect(fastSignals([], [], 10, BASE)).toMatchObject({ fast: 0, kind: null });
  });
});

describe('reaction and the mood’s hold', () => {
  it('maps a score to a reaction: nothing to 0.30, full at the 0.65 alert line', () => {
    expect(reactionFor(0.2)).toBe(0);
    expect(reactionFor(0.3)).toBe(0);
    expect(reactionFor(0.475)).toBeCloseTo(0.5, 5);
    expect(reactionFor(0.65)).toBe(1);
    expect(reactionFor(0.9)).toBe(1);
  });

  it('rises within about a tenth of a second, holds a second, then eases back', () => {
    const s = reactionState(0);
    for (let t = 66; t <= 132; t += 66) stepReaction(s, 1, t, false);
    expect(s.value).toBeGreaterThan(0.9);
    stepReaction(s, 0, 132 + 500, false);
    expect(s.value).toBeGreaterThan(0.9);
    let t = 132 + HOLD_MS;
    stepReaction(s, 0, t, false);
    for (; t < 132 + HOLD_MS + 4000; t += 66) stepReaction(s, 0, t, false);
    expect(s.value).toBeLessThan(0.05);
  });

  it('eases back slowly while the pointer rests', () => {
    const fall = (resting: boolean) => {
      const s = reactionState(0);
      stepReaction(s, 1, 400, false);
      for (let t = 400; t <= 400 + HOLD_MS + 3000; t += 66) stepReaction(s, 0, t, resting);
      return s.value;
    };
    expect(fall(true)).toBeGreaterThan(0.6);
    expect(fall(false)).toBeLessThan(0.15);
  });

  it('holds a mood 1 s after its score falls, and switches only for a clearly stronger one', () => {
    const p = moodPick();
    expect(pickMood(p, { frustrated: 0.1, confused: 0.5, lost: 0 }, 0)).toBe('confused');
    expect(pickMood(p, { frustrated: 0.55, confused: 0.5, lost: 0 }, 100)).toBe('confused');
    expect(pickMood(p, { frustrated: 0.7, confused: 0.5, lost: 0 }, 200)).toBe('frustrated');
    expect(pickMood(p, { frustrated: 0, confused: 0, lost: 0 }, 300)).toBe('frustrated');
    expect(pickMood(p, { frustrated: 0, confused: 0, lost: 0 }, 1150)).toBe('frustrated');
    expect(pickMood(p, { frustrated: 0, confused: 0, lost: 0 }, 1250)).toBeNull();
  });

  it('combines hints with a noisy or', () => {
    expect(noisyOr(0.5, 0.5)).toBeCloseTo(0.75, 5);
    expect(noisyOr()).toBe(0);
    expect(noisyOr(2, Number.NaN)).toBe(1);
  });
});

describe('slow reading', () => {
  it('counts slowing down and turning back, not a fast reversal', () => {
    // out 120 px slowly, back again, three times
    const slow = path(0, 6000, (t) => {
      const k = (t % 2000) / 2000;
      return { x: 300 + 120 * Math.sin(Math.PI * k), y: 300 + 10 * k };
    });
    expect(turnbacksOf(slow, 6000, BASE)).toBeGreaterThanOrEqual(2);
    expect(
      turnbacksOf(
        path(0, 6000, (t) => ({ x: t / 10, y: 300 })),
        6000,
        BASE,
      ),
    ).toBe(0);
  });

  it('reads section after section without progress as lost, and progress clears it', () => {
    const h = emptyHistory(0);
    for (let i = 0; i < 6; i++) h.sections.push({ control: `s${i}`, t: 1000 + i * 1500 });
    expect(lostOf(h, 12_000)).toBeGreaterThan(0.3);
    h.lastProgress = 11_000;
    expect(lostOf(h, 12_000)).toBe(0);
  });

  it('reads sending a form again after it failed as frustrated, until a send goes through', () => {
    const h = emptyHistory(0);
    h.failedSends.push(1000, 4000);
    expect(frustratedOf(h, 5000)).toBeCloseTo(0.7, 5);
    h.failedSends.push(8000);
    expect(frustratedOf(h, 9000)).toBeCloseTo(0.9, 5);
    h.lastSent = 9500;
    expect(frustratedOf(h, 10_000)).toBe(0);
  });

  it('reads a blocked step as frustrated, until something works', () => {
    const h = emptyHistory(0);
    h.presses.push(press(1000, DISABLED), press(5000, DISABLED), press(9000, DISABLED));
    expect(frustratedOf(h, 10_000)).toBeCloseTo(0.8, 5);
    h.lastProgress = 9500;
    expect(frustratedOf(h, 10_000)).toBe(0);
  });
});

/** The locked-Pay route through the core: what it reads at each moment. */
function replayPay(core: MoodCore): Map<number, MoodReading> {
  const l = payLayout();
  const route = payRoute(l);
  const presses = payPresses();
  const facts = (p: { x: number; y: number }, t: number): MoodFacts => {
    const agreed = t >= PAY_AGREE_AT;
    if (inBox(p, l.pay))
      return {
        ...NO_FACTS,
        control: 'pay',
        disabled: !agreed,
        submit: true,
        target: { tag: 'button', id: 'pay', role: '', disabled: !agreed, invalid: false },
      };
    if (inBox(p, l.check, 4))
      return {
        ...NO_FACTS,
        control: 'terms',
        target: { tag: 'input', id: 'terms', role: '', disabled: false, invalid: false },
      };
    return NO_FACTS;
  };
  const out = new Map<number, MoodReading>();
  let next = 0;
  for (let t = 0; t < PAY_LOOP_MS; t += 16) {
    const p = payPointerAt(route, t);
    if (!payPointerGone(t)) core.pointer(p.x, p.y, t, facts(p, t));
    while (next < presses.length && presses[next].at <= t) {
      const q = payPointerAt(route, presses[next].at);
      core.press(q.x, q.y, presses[next].at, facts(q, presses[next].at));
      if (presses[next].at === PAY_AGREE_AT) core.change(presses[next].at);
      next++;
    }
    if (t % 64 === 0) out.set(t, core.step(t));
  }
  return out;
}

describe('MoodCore', () => {
  it('reads the locked-Pay route: confused while circling, frustrated on the presses, calm once the terms are agreed', () => {
    const r = replayPay(new MoodCore({ now: 0 }));
    const at = (t: number) => r.get(t - (t % 64)) as MoodReading;
    expect(at(1280).mood).toBeNull();
    expect(at(2880)).toMatchObject({ mood: 'confused', fastKind: 'orbit' });
    expect(at(2880).reaction).toBeGreaterThan(0.9);
    expect(at(6400)).toMatchObject({ mood: 'frustrated', fastKind: 'disabled', alert: true });
    expect(at(6400).target).toMatchObject({ tag: 'button', id: 'pay', disabled: true });
    expect(at(7680).scores.frustrated).toBeGreaterThan(0.9);
    // the terms agreed at 10.1 s: the score is gone, the mood holds a second, the reaction eases back
    expect(at(10_560).score).toBe(0);
    expect(at(11_520).mood).toBeNull();
    expect(at(PAY_AT + 1000).reaction).toBeLessThan(0.5);
    expect(at(15_744).reaction).toBeLessThan(0.1);
  });

  it('reports away for a hidden tab, a pointer out of the window or a minute without input — and never raises the reaction for it', () => {
    const c = new MoodCore({ now: 0 });
    c.hidden(true, 10);
    expect(c.step(20)).toMatchObject({ mood: 'away', away: true, reaction: 0 });
    c.hidden(false, 30);
    expect(c.step(40).mood).toBeNull();
    c.pointer(10, 10, 50);
    c.windowOut(true, 60);
    expect(c.step(70).mood).toBe('away');
    c.pointer(10, 10, 80);
    expect(c.step(90).mood).toBeNull();
    expect(c.step(90 + 60_000).mood).toBe('away');
  });

  it('clears away on any input in the scope, not only a pointer move (someone typing with the mouse parked)', () => {
    const c = new MoodCore({ now: 0 });
    c.windowOut(true, 10);
    expect(c.step(20).mood).toBe('away');
    c.key(true, 30);
    expect(c.step(40)).toMatchObject({ away: false, mood: null });
    c.windowOut(true, 50);
    c.sent(60, false);
    expect(c.step(70).away).toBe(false);
  });

  it('does not go idle while a score under the line is still draining', () => {
    const c = new MoodCore({ now: 0 });
    const section = (k: string): MoodFacts => ({ ...NO_FACTS, control: k, section: true });
    c.press(10, 10, 100, section('a'));
    c.press(10, 10, 600, section('b'));
    c.press(10, 10, 1100, section('c'));
    const r = c.step(8000);
    expect(r.mood).toBeNull();
    expect(r.score).toBeGreaterThan(0.005);
    expect(c.idle(8000)).toBe(false);
    expect(c.step(40_000).score).toBe(0);
    expect(c.idle(40_000)).toBe(true);
  });

  it('names the disabled control for a disabled reading, even after another press', () => {
    const c = new MoodCore({ now: 0 });
    c.press(10, 10, 100, DISABLED);
    c.press(300, 300, 400, CONTROL);
    const r = c.step(500);
    expect(r.fastKind).toBe('disabled');
    expect(r.target?.id).toBe('pay');
  });

  it('reacts only to the moods in reactTo, but still reports the others', () => {
    const c = new MoodCore({ now: 0, reactTo: ['lost'] });
    c.press(100, 100, 10, DISABLED);
    const r = c.step(20);
    expect(r.mood).toBe('frustrated');
    expect(r.reaction).toBe(0);
  });

  it('learns the person’s pace only while calm, and forgets what it saw on reset', () => {
    const c = new MoodCore({ now: 0 });
    for (let t = 0; t <= 2000; t += 16) c.pointer(t / 4, 100, t);
    c.step(2000);
    expect(c.baseline.speed).toBeLessThan(DEFAULT_BASELINE.speed);
    expect(c.baselineDirty).toBe(true);
    const learned = c.baseline.speed;
    c.press(10, 10, 2100, DISABLED);
    c.step(2400);
    expect(c.baseline.speed).toBe(learned);
    c.reset(3000);
    expect(c.history.presses).toHaveLength(0);
    expect(c.baseline.speed).toBe(learned);
    expect(c.step(3010).mood).toBeNull();
  });

  it('goes idle when calm and still, so the reader can stop its timer', () => {
    const c = new MoodCore({ now: 0 });
    c.pointer(1, 1, 0);
    c.step(100);
    expect(c.idle(100)).toBe(false);
    c.step(3200);
    expect(c.idle(3200)).toBe(true);
  });

  it('cleans its inputs: baseline clamps, reactTo parses', () => {
    expect(moodBaseline({ speed: 1e9, pressGap: -5 })).toEqual({ speed: 3000, pressGap: 250, n: 0 });
    expect(moodBaseline(null)).toEqual({ speed: 700, pressGap: 900, n: 0 });
    expect(moodReactTo('lost, frustrated away bogus')).toEqual(['lost', 'frustrated']);
    expect(moodReactTo('')).toEqual(['frustrated', 'confused', 'lost']);
    expect(moodReactTo(['confused', 'confused'])).toEqual(['confused']);
    expect(emptyReading(5)).toMatchObject({ mood: null, reaction: 0, at: 5 });
  });
});

describe('element facts', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('knows a disabled button, a section opener, a send with an invalid form — never their text', () => {
    document.body.innerHTML = `
      <form><input id="dob" aria-invalid="true"><button id="go">Send ${XSS}</button></form>
      <button id="pay" disabled>Pay</button>
      <div aria-disabled="true"><span role="button" id="soft">Soft</span></div>
      <details><summary id="s">Section</summary></details>
      <p id="plain">text</p>`;
    const facts = (id: string) => moodFactsOf(moodPath(null, document.getElementById(id)));
    expect(facts('pay')).toMatchObject({ disabled: true, target: { tag: 'button', id: 'pay', disabled: true } });
    expect(facts('soft').disabled).toBe(true);
    expect(facts('s')).toMatchObject({ section: true, disabled: false });
    expect(facts('go')).toMatchObject({ submit: true, invalid: true });
    expect(facts('plain')).toEqual(NO_FACTS);
    expect(JSON.stringify(facts('go'))).not.toContain('Send');
  });

  it('keys each element once, and sees data-mood-ignore anywhere on the path', () => {
    document.body.innerHTML = '<aside data-mood-ignore><button id="help">?</button></aside><button id="b">b</button>';
    const help = document.getElementById('help') as HTMLElement;
    expect(moodElementKey(help)).toBe(moodElementKey(help));
    expect(moodElementKey(help)).not.toBe(moodElementKey(document.getElementById('b') as HTMLElement));
    expect(moodIgnored(moodPath(null, help))).toBe(true);
    expect(moodIgnored(moodPath(null, document.getElementById('b')))).toBe(false);
  });
});

/** A Storage that keeps strings in a Map. */
class FakeStorage {
  #m = new Map<string, string>();
  get length() {
    return this.#m.size;
  }
  getItem(k: string) {
    return this.#m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.#m.set(k, String(v));
  }
  removeItem(k: string) {
    this.#m.delete(k);
  }
  clear() {
    this.#m.clear();
  }
  key(i: number) {
    return [...this.#m.keys()][i] ?? null;
  }
}

describe('createMoodReader', () => {
  let clock = 0;
  let localStorage: FakeStorage;
  beforeEach(() => {
    document.body.innerHTML = '';
    clock = 1000;
    vi.useFakeTimers();
    localStorage = new FakeStorage();
    vi.stubGlobal('localStorage', localStorage);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const down = (el: Element, x = 50, y = 50) =>
    el.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: x, clientY: y, button: 0 }),
    );

  it('reads presses inside its scope, ignores the rest, and stops cleanly', () => {
    document.body.innerHTML =
      '<section id="scope"><button id="pay" disabled>Pay</button><aside data-mood-ignore><button id="help">?</button></aside></section><button id="out">x</button>';
    const readings: MoodReading[] = [];
    const scope = document.getElementById('scope') as HTMLElement;
    const r = createMoodReader({ scope, baselineKey: null, now: () => clock, onReading: (x) => readings.push(x) });
    r.start();
    expect(r.running).toBe(true);
    down(document.getElementById('out') as HTMLElement);
    down(document.getElementById('help') as HTMLElement);
    vi.advanceTimersByTime(100);
    expect(readings.every((x) => x.mood === null)).toBe(true);
    down(document.getElementById('pay') as HTMLElement);
    clock += 70;
    vi.advanceTimersByTime(70);
    expect(r.reading).toMatchObject({ mood: 'frustrated', fastKind: 'disabled' });
    r.stop();
    const n = readings.length;
    down(document.getElementById('pay') as HTMLElement);
    vi.advanceTimersByTime(500);
    expect(readings.length).toBe(n);
    expect(r.running).toBe(false);
  });

  it('stops its timer when calm and still, and wakes on the next input', () => {
    const readings: MoodReading[] = [];
    const r = createMoodReader({ baselineKey: null, now: () => clock, onReading: (x) => readings.push(x) });
    r.start();
    document.body.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 5, clientY: 5 }));
    for (let i = 0; i < 80; i++) {
      clock += 66;
      vi.advanceTimersByTime(66);
    }
    const n = readings.length;
    clock += 5000;
    vi.advanceTimersByTime(5000);
    expect(readings.length).toBe(n);
    document.body.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 9, clientY: 9 }));
    vi.advanceTimersByTime(10);
    expect(readings.length).toBe(n + 1);
    r.stop();
  });

  it('wakes once a minute without input to say away', () => {
    const r = createMoodReader({ baselineKey: null, now: () => clock });
    r.start();
    document.body.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 5, clientY: 5 }));
    for (let i = 0; i < 60; i++) {
      clock += 66;
      vi.advanceTimersByTime(66);
    }
    expect(r.reading.mood).toBeNull();
    clock += 60_000;
    vi.advanceTimersByTime(60_000);
    expect(r.reading.mood).toBe('away');
    r.stop();
  });

  it('says away a minute after start even with no input at all, and only once in a hidden tab', () => {
    const readings: MoodReading[] = [];
    const r = createMoodReader({ baselineKey: null, now: () => clock, onReading: (x) => readings.push(x) });
    r.start();
    for (let i = 0; i < 60; i++) {
      clock += 66;
      vi.advanceTimersByTime(66);
    }
    clock += 60_000;
    vi.advanceTimersByTime(60_000);
    expect(r.reading.mood).toBe('away');
    r.stop();

    const hidden: MoodReading[] = [];
    const h = createMoodReader({ baselineKey: null, now: () => clock, onReading: (x) => hidden.push(x) });
    h.start();
    vi.advanceTimersByTime(10);
    const vis = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    const n = hidden.length;
    expect(hidden.at(-1)?.mood).toBe('away');
    clock += 120_000;
    vi.advanceTimersByTime(120_000);
    expect(hidden.length).toBe(n);
    vis.mockRestore();
    h.stop();
  });

  it('counts a failed send from the browser’s own check', () => {
    document.body.innerHTML = '<form><input required id="f"></form>';
    const r = createMoodReader({ baselineKey: null, now: () => clock });
    r.start();
    const f = document.getElementById('f') as HTMLInputElement;
    clock += 500;
    f.dispatchEvent(new Event('invalid'));
    clock += 1000;
    f.dispatchEvent(new Event('invalid'));
    clock += 10;
    vi.advanceTimersByTime(10);
    expect(r.core.history.failedSends).toHaveLength(2);
    expect(r.reading.scores.frustrated).toBeCloseTo(0.7, 5);
    r.stop();
  });

  it('keeps the person’s pace in localStorage under its key, and nowhere with a null key', () => {
    localStorage.setItem('pace', JSON.stringify({ v: 1, speed: 420, pressGap: 600, n: 3 }));
    const r = createMoodReader({ baselineKey: 'pace', now: () => clock });
    expect(r.core.baseline).toMatchObject({ speed: 420, pressGap: 600, n: 3 });
    r.start();
    r.core.baseline.speed = 500;
    r.core.baselineDirty = true;
    r.stop();
    expect(JSON.parse(localStorage.getItem('pace') as string)).toMatchObject({ v: 1, speed: 500 });
    const m = createMoodReader({ baselineKey: null, now: () => clock });
    m.start();
    m.core.baselineDirty = true;
    m.stop();
    expect(localStorage.length).toBe(1);
  });

  it('survives a stored pace that is not JSON', () => {
    localStorage.setItem('mood-baseline', '{nope');
    expect(createMoodReader({ now: () => clock }).core.baseline.speed).toBe(DEFAULT_BASELINE.speed);
  });
});

describe('<ui-mood>', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const mount = (html: string) => {
    document.body.innerHTML = html;
    return document.querySelector('ui-mood') as UiMood;
  };
  const down = (el: Element) =>
    el.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: 10, clientY: 10, button: 0 }),
    );
  const settle = () => new Promise((r) => setTimeout(r, 90));

  it('renders a slot and reads the markup inside it', async () => {
    const el = mount('<ui-mood baseline-key=""><button id="pay" disabled>Pay</button></ui-mood>');
    el.renderNow();
    expect(el.shadowRoot?.querySelector('slot')).not.toBeNull();
    expect(el.reader?.running).toBe(true);
    const changes: MoodReading[] = [];
    let bubbled = 0;
    let readingsOnBody = 0;
    el.addEventListener('ui-mood-change', (e) => changes.push((e as CustomEvent<MoodReading>).detail));
    document.body.addEventListener('ui-mood-change', () => bubbled++);
    document.body.addEventListener('ui-mood-reading', () => readingsOnBody++);
    down(document.getElementById('pay') as HTMLElement);
    await settle();
    expect(el.mood).toBe('frustrated');
    expect(el.getAttribute('mood')).toBe('frustrated');
    expect(Number(el.style.getPropertyValue('--mood'))).toBeGreaterThan(0.5);
    expect(changes.at(-1)?.mood).toBe('frustrated');
    expect(bubbled).toBeGreaterThan(0);
    expect(readingsOnBody).toBe(0);
  });

  it('ignores input outside itself unless scope="page"', async () => {
    const el = mount('<ui-mood baseline-key=""></ui-mood><button id="b" disabled>b</button>');
    down(document.getElementById('b') as HTMLElement);
    await settle();
    expect(el.mood).toBeNull();
    el.setAttribute('scope', 'page');
    down(document.getElementById('b') as HTMLElement);
    await settle();
    expect(el.mood).toBe('frustrated');
  });

  it('resolves its options from data first, then attributes', () => {
    const attrs: Record<string, string> = { scope: 'page', 'react-to': 'lost', 'baseline-key': 'k', paused: '' };
    const a = (n: string) => attrs[n] ?? null;
    expect(moodOptions(undefined, a)).toEqual({ scope: 'page', reactTo: ['lost'], baselineKey: 'k', paused: true });
    expect(moodOptions({ scope: 'self', reactTo: ['confused'], baselineKey: null, paused: false }, a)).toEqual({
      scope: 'self',
      reactTo: ['confused'],
      baselineKey: null,
      paused: false,
    });
    expect(moodOptions(undefined, () => null)).toEqual({
      scope: 'self',
      reactTo: ['frustrated', 'confused', 'lost'],
      baselineKey: 'mood-baseline',
      paused: false,
    });
    expect(moodOptions(undefined, (n) => (n === 'baseline-key' ? '' : null)).baselineKey).toBeNull();
  });

  it('paused stops reading and clears the reading; disconnecting stops the reader', async () => {
    const el = mount('<ui-mood baseline-key=""><button id="pay" disabled>Pay</button></ui-mood>');
    down(document.getElementById('pay') as HTMLElement);
    await settle();
    expect(el.mood).toBe('frustrated');
    el.paused = true;
    expect(el.reader).toBeNull();
    expect(el.mood).toBeNull();
    expect(el.hasAttribute('mood')).toBe(false);
    expect(el.style.getPropertyValue('--mood')).toBe('0.000');
    el.paused = false;
    const reader = el.reader;
    expect(reader?.running).toBe(true);
    el.remove();
    expect(reader?.running).toBe(false);
  });

  it('keeps the host’s type and colour for the markup it wraps', () => {
    const el = mount('<ui-mood></ui-mood>');
    const css = el.shadowRoot?.querySelector('style')?.textContent ?? '';
    expect(css).toContain('font: inherit');
    expect(css).toContain('color-scheme: inherit');
  });
});

describe('docs', () => {
  it('ships at least three demos that build without the network', () => {
    expect(doc.tag).toBe('ui-mood');
    expect(doc.group).toBe('Effects');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) {
      const el = d.create();
      document.body.append(el);
      expect(el.querySelector('ui-mood') ?? (el.localName === 'ui-mood' ? el : null)).not.toBeNull();
      el.remove();
    }
  });
});
