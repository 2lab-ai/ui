import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import { doc } from './docs';
import {
  SLIDE_THRESHOLD,
  type SlideConfirmData,
  slideCommits,
  slideKeyStep,
  slideProgress,
  slideSquash,
  slideState,
  slideThreshold,
  slideTone,
  type UiSlideConfirm,
} from './slide-confirm';
import { SLIDE_MOTION, SLIDE_SPRINGS, slideEasing, slideSpring, styles } from './styles';

const XSS = '<img src=x onerror=alert(1)>';
const TAKE = SLIDE_MOTION.take.ms;
/** The failed shake, then home; and the tint (slide-confirm.ts). */
const SHAKE = 320;
const TINT = 1100;
/** A 320px track at x = 100: the travel is 320 − 4 − 4 − 48 = 264px; the grip's middle at rest is x = 128. */
const LEFT = 100;
const TRAVEL = 264;

function mount(data?: SlideConfirmData, attrs: Record<string, string> = {}): UiSlideConfirm {
  const el = document.createElement('ui-slide-confirm');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  if (data) el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiSlideConfirm, s: string) => el.shadowRoot!.querySelector<E>(s);
const track = (el: UiSlideConfirm) => q(el, '.sc')!;
const grip = (el: UiSlideConfirm) => q(el, '.sc-grip')!;
const status = (el: UiSlideConfirm) => q(el, '[role="status"]')!.textContent;
const at = (el: UiSlideConfirm) => Number(track(el).style.getPropertyValue('--sc-p'));
const now = (el: UiSlideConfirm) => grip(el).getAttribute('aria-valuenow');
const key = (t: EventTarget, k: string) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true });
  t.dispatchEvent(e);
  return e;
};
const ptr = (t: EventTarget, type: string, clientX: number, init: PointerEventInit = {}) =>
  t.dispatchEvent(
    new PointerEvent(type, {
      pointerId: 1,
      clientX,
      pointerType: 'mouse',
      bubbles: true,
      composed: true,
      cancelable: true,
      ...init,
    }),
  );
function sized(el: UiSlideConfirm): void {
  const box = { left: LEFT, width: 320, top: 0, height: 56, right: LEFT + 320, bottom: 56, x: LEFT, y: 0 };
  vi.spyOn(track(el), 'getBoundingClientRect').mockReturnValue({ ...box, toJSON() {} } as DOMRect);
}
function confirms(el: UiSlideConfirm, run?: (e: Event) => void): Event[] {
  const seen: Event[] = [];
  el.addEventListener('ui-confirm', (e) => {
    seen.push(e);
    run?.(e);
  });
  return seen;
}
/** Press, the first move (the offset), then a move to `share` of the travel from there. */
function drag(el: UiSlideConfirm, share: number, from = LEFT + 28): void {
  ptr(grip(el), 'pointerdown', from);
  ptr(track(el), 'pointermove', from + 2);
  ptr(track(el), 'pointermove', from + 2 + share * TRAVEL);
}
const reduce = () =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }));
const fakeAnimate = (node: HTMLElement) => {
  const fn = vi.fn((_frames: Keyframe[], _opts: KeyframeAnimationOptions) => ({ cancel: vi.fn() }) as unknown);
  node.animate = fn as unknown as HTMLElement['animate'];
  return fn;
};

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('helpers', () => {
  it('slideThreshold: numbers and numeric strings, clamped to 0.5 … 1; 0.85 for anything else', () => {
    expect(SLIDE_THRESHOLD).toBe(0.85);
    expect(slideThreshold(0.7)).toBe(0.7);
    expect(slideThreshold('0.9')).toBe(0.9);
    expect(slideThreshold(0.2)).toBe(0.5);
    expect(slideThreshold(3)).toBe(1);
    expect(slideThreshold(undefined)).toBe(0.85);
    expect(slideThreshold('')).toBe(0.85);
    expect(slideThreshold('soon')).toBe(0.85);
    expect(slideThreshold(Number.NaN)).toBe(0.85);
  });

  it('slideProgress: a share of the travel, 0 … 1; 0 without travel', () => {
    expect(slideProgress(132, 264)).toBe(0.5);
    expect(slideProgress(-20, 264)).toBe(0);
    expect(slideProgress(900, 264)).toBe(1);
    expect(slideProgress(10, 0)).toBe(0);
    expect(slideProgress(10, -4)).toBe(0);
    expect(slideProgress(Number.NaN, 264)).toBe(0);
  });

  it('slideCommits: at or past the threshold', () => {
    expect(slideCommits(0.85)).toBe(true);
    expect(slideCommits(0.84)).toBe(false);
    expect(slideCommits(1, 1)).toBe(true);
    expect(slideCommits(0.6, 0.6)).toBe(true);
    expect(slideCommits(0.55, 0.2)).toBe(true); // clamped to 0.5
    expect(slideCommits(Number.NaN)).toBe(false);
  });

  it('slideKeyStep: arrows ±10, Page Up / Down ±25, Home 0, End 100, clamped; null for other keys', () => {
    expect(slideKeyStep('ArrowRight', 40)).toBe(50);
    expect(slideKeyStep('ArrowUp', 40)).toBe(50);
    expect(slideKeyStep('ArrowLeft', 40)).toBe(30);
    expect(slideKeyStep('ArrowDown', 40)).toBe(30);
    expect(slideKeyStep('PageUp', 40)).toBe(65);
    expect(slideKeyStep('PageDown', 20)).toBe(0);
    expect(slideKeyStep('ArrowRight', 95)).toBe(100);
    expect(slideKeyStep('ArrowRight', 39.6)).toBe(50);
    expect(slideKeyStep('Home', 70)).toBe(0);
    expect(slideKeyStep('End', 0)).toBe(100);
    expect(slideKeyStep('Enter', 40)).toBeNull();
    expect(slideKeyStep('Tab', 40)).toBeNull();
    expect(slideKeyStep('Escape', 40)).toBeNull();
  });

  it('slideState / slideTone', () => {
    expect(slideState('busy')).toBe('busy');
    expect(slideState('failed')).toBe('failed');
    expect(slideState('error')).toBeUndefined();
    expect(slideState(undefined)).toBeUndefined();
    expect(slideTone('danger')).toBe('danger');
    expect(slideTone('red')).toBe('neutral');
  });

  it('springs: the take-over is critically damped (no overshoot); home passes the start by 8%', () => {
    const take = SLIDE_SPRINGS.take;
    expect(slideSpring(take, 0)).toBe(0);
    expect(slideSpring(take, 1)).toBeCloseTo(1, 4);
    let most = 0;
    for (let t = 0; t <= 1; t += 0.001) most = Math.max(most, slideSpring(take, t));
    expect(most).toBeLessThanOrEqual(1);
    let past = 0;
    for (let t = 0; t <= 1; t += 0.001) past = Math.max(past, slideSpring(SLIDE_SPRINGS.home, t) - 1);
    expect(past).toBeCloseTo(0.0835, 3);
    // An overdamped spring comes in without passing it, too.
    const slow = { stiffness: 100, damping: 60, mass: 1 };
    expect(slideSpring(slow, 0)).toBeCloseTo(0, 9);
    expect(slideSpring(slow, 0.5)).toBeLessThan(1);
    expect(slideSpring(slow, 20)).toBeCloseTo(1, 4);
  });

  it('slideEasing: the spring as a duration and a linear() curve from 0 to 1', () => {
    const take = slideEasing(SLIDE_SPRINGS.take);
    expect(take.ms).toBeGreaterThan(300);
    expect(take.ms).toBeLessThan(360);
    const pts = take.easing.slice('linear('.length, -1).split(', ').map(Number);
    expect(pts).toHaveLength(17);
    expect(pts[0]).toBe(0);
    expect(pts[16]).toBe(1);
    for (let i = 1; i < pts.length; i++) expect(pts[i]).toBeGreaterThanOrEqual(pts[i - 1]);
    // Pinned: home ends the moment it reaches the start — the overshoot is the squash's.
    const home = slideEasing(SLIDE_SPRINGS.home, true);
    expect(home.ms).toBeGreaterThan(100);
    expect(home.ms).toBeLessThan(125);
    expect(
      home.easing
        .slice('linear('.length, -1)
        .split(', ')
        .map(Number)
        .every((v) => v <= 1),
    ).toBe(true);
    expect(SLIDE_MOTION.home).toEqual(home);
    expect(SLIDE_MOTION.morph).toEqual(take);
  });

  it('slideSquash: up to 8% narrower and as much taller while the spring would be past the start', () => {
    expect(slideSquash(0)).toBeNull();
    expect(slideSquash(1)).toBeNull();
    const full = slideSquash(TRAVEL)!;
    expect(full.delay).toBe(SLIDE_MOTION.home.ms);
    expect(full.duration).toBeGreaterThan(140);
    expect(full.frames[0]).toEqual({ transform: 'scale(1, 1)' });
    expect(full.frames.at(-1)).toEqual({ transform: 'scale(1, 1)' });
    const xs = full.frames.map((f) => Number(/scale\(([\d.]+)/.exec(String(f.transform))![1]));
    expect(Math.min(...xs)).toBe(0.92);
    const short = slideSquash(40)!;
    const sx = short.frames.map((f) => Number(/scale\(([\d.]+)/.exec(String(f.transform))![1]));
    expect(Math.min(...sx)).toBeGreaterThan(0.96);
  });
});

describe('<ui-slide-confirm>', () => {
  it('is a slider named by its label: 0 … 100, the value in words, focusable, a status for what happened', () => {
    const el = mount();
    const g = grip(el);
    expect(g.getAttribute('role')).toBe('slider');
    expect(g.getAttribute('tabindex')).toBe('0');
    expect(g.dataset.key).toBe('grip');
    expect(g.getAttribute('aria-label')).toBe('Slide to confirm');
    expect(g.getAttribute('aria-valuemin')).toBe('0');
    expect(g.getAttribute('aria-valuemax')).toBe('100');
    expect(g.getAttribute('aria-valuenow')).toBe('0');
    expect(g.getAttribute('aria-valuetext')).toBe('Slide to confirm: 0%');
    expect(g.hasAttribute('aria-disabled')).toBe(false);
    expect(q(el, '.sc-say')!.textContent).toBe('Slide to confirm');
    expect(q(el, '.sc-say')!.getAttribute('aria-hidden')).toBe('true');
    expect(q(el, '.sc-arrow svg')!.getAttribute('data-icon')).toBe('arrow-right');
    expect(q(el, '[role="status"]')!.classList.contains('sr-only')).toBe(true);
    expect(status(el)).toBe('');
    expect(track(el).dataset.tone).toBe('neutral');
    expect(at(el)).toBe(0);
    expect(el.state).toBe('idle');
  });

  it('reads attributes (label, done-label, tone, threshold, disabled); data wins', () => {
    const el = mount(undefined, { label: 'Slide to stop', 'done-label': 'Stopped', tone: 'danger', threshold: '0.6' });
    expect(grip(el).getAttribute('aria-label')).toBe('Slide to stop');
    expect(q(el, '.sc-done')!.textContent).toBe('Stopped');
    expect(track(el).dataset.tone).toBe('danger');
    sized(el);
    const seen = confirms(el);
    drag(el, 0.62);
    ptr(track(el), 'pointerup', 0);
    vi.advanceTimersByTime(TAKE);
    expect(seen).toHaveLength(1);
    const data = mount({ label: 'From data', tone: 'neutral', disabled: false }, { label: 'From attr', disabled: '' });
    expect(grip(data).getAttribute('aria-label')).toBe('From data');
    expect(track(data).dataset.tone).toBe('neutral');
    expect(grip(data).hasAttribute('aria-disabled')).toBe(false);
  });

  it('pointer: the offset is taken at the first move (no jump), the grip follows exactly, a release past the mark takes over and confirms', () => {
    const el = mount();
    sized(el);
    const anim = fakeAnimate(track(el));
    const seen = confirms(el);
    ptr(grip(el), 'pointerdown', LEFT + 28);
    expect(track(el).hasAttribute('data-held')).toBe(true);
    expect(at(el)).toBe(0);
    // First move, 20px on: the offset is taken here; the grip does not move.
    ptr(track(el), 'pointermove', LEFT + 48);
    expect(at(el)).toBe(0);
    expect(now(el)).toBe('0');
    expect(track(el).dataset.motion).toBe('drag');
    ptr(track(el), 'pointermove', LEFT + 48 + TRAVEL / 2);
    expect(at(el)).toBe(0.5);
    expect(now(el)).toBe('50');
    expect(grip(el).getAttribute('aria-valuetext')).toBe('Slide to confirm: 50%');
    ptr(track(el), 'pointermove', 5000);
    expect(at(el)).toBe(1);
    // Another pointer is not this drag.
    ptr(track(el), 'pointermove', LEFT, { pointerId: 2 });
    expect(at(el)).toBe(1);
    ptr(track(el), 'pointerup', 5000);
    expect(track(el).hasAttribute('data-held')).toBe(false);
    expect(track(el).dataset.motion).toBe('take');
    expect(seen).toHaveLength(0); // the take-over first …
    vi.advanceTimersByTime(TAKE);
    expect(seen).toHaveLength(1); // … then ui-confirm
    const e = seen[0] as CustomEvent;
    expect(e.detail).toEqual({});
    expect(e.cancelable).toBe(true);
    expect(e.bubbles && e.composed).toBe(true);
    // Done: the grip opened out (place to 0, width to the full track, together), the done words, the squash.
    expect(el.state).toBe('done');
    expect(track(el).hasAttribute('data-filled')).toBe(true);
    expect(track(el).dataset.motion).toBe('morph');
    expect(track(el).dataset.show).toBe('done');
    expect(track(el).style.getPropertyValue('--sc-q').trim()).toBe('1');
    expect(at(el)).toBe(0);
    expect(grip(el).getAttribute('aria-disabled')).toBe('true');
    expect(grip(el).getAttribute('aria-valuenow')).toBe('100');
    expect(grip(el).getAttribute('aria-valuetext')).toBe('Confirmed');
    expect(q(el, '.sc-done svg')!.getAttribute('data-icon')).toBe('check');
    expect(status(el)).toBe('Confirmed');
    expect(anim).toHaveBeenCalledTimes(1);
    expect(anim.mock.calls[0][0][1]).toMatchObject({ transform: 'scale(0.974)', offset: 0.62 });
    expect(anim.mock.calls[0][1]).toEqual({ duration: 420, delay: 100 });
    // Filled, it takes no more drags.
    ptr(grip(el), 'pointerdown', LEFT + 28);
    expect(track(el).hasAttribute('data-held')).toBe(false);
  });

  it('a press on the track away from the grip does nothing until it moves; then the grip moves with it', () => {
    const el = mount();
    sized(el);
    ptr(track(el), 'pointerdown', LEFT + 300);
    expect(at(el)).toBe(0);
    ptr(track(el), 'pointermove', LEFT + 302);
    expect(at(el)).toBe(0);
    ptr(track(el), 'pointermove', LEFT + 302 + TRAVEL / 4);
    expect(at(el)).toBe(0.25);
  });

  it('a grip caught on its way home is taken from where it is drawn, not from where it was going', () => {
    const el = mount();
    sized(el);
    // Drawn 66px along (a quarter): the grip's own box says so.
    vi.spyOn(grip(el), 'getBoundingClientRect').mockReturnValue({ left: LEFT + 4 + 66, width: 48 } as DOMRect);
    ptr(grip(el), 'pointerdown', LEFT + 100);
    ptr(track(el), 'pointermove', LEFT + 101);
    expect(at(el)).toBe(0.25);
    ptr(track(el), 'pointermove', LEFT + 101 + 66);
    expect(at(el)).toBe(0.5);
  });

  it('a release short of the mark springs home (with the squash) and sends nothing; so does a cancel', () => {
    const el = mount();
    sized(el);
    const squash = fakeAnimate(grip(el));
    const seen = confirms(el);
    drag(el, 0.8);
    expect(at(el)).toBe(0.8);
    ptr(track(el), 'pointerup', 0);
    expect(at(el)).toBe(0);
    expect(now(el)).toBe('0');
    expect(track(el).dataset.motion).toBe('home');
    expect(squash).toHaveBeenCalledTimes(1);
    expect(squash.mock.calls[0][1]).toMatchObject({ delay: SLIDE_MOTION.home.ms });
    drag(el, 1);
    ptr(track(el), 'pointercancel', 0);
    expect(at(el)).toBe(0);
    vi.advanceTimersByTime(2000);
    expect(seen).toHaveLength(0);
    expect(el.state).toBe('idle');
    // A press with no move leaves it where it is.
    ptr(grip(el), 'pointerdown', LEFT + 28);
    ptr(grip(el), 'pointerup', LEFT + 28);
    expect(seen).toHaveLength(0);
  });

  it('prevented: the grip springs home and stays idle', () => {
    const el = mount();
    sized(el);
    const seen = confirms(el, (e) => e.preventDefault());
    drag(el, 1);
    ptr(track(el), 'pointerup', 0);
    vi.advanceTimersByTime(TAKE);
    expect(seen).toHaveLength(1);
    expect(el.state).toBe('idle');
    expect(track(el).hasAttribute('data-filled')).toBe(false);
    expect(track(el).dataset.motion).toBe('home');
    expect(at(el)).toBe(0);
    expect(status(el)).toBe('');
    expect(grip(el).hasAttribute('aria-disabled')).toBe(false);
  });

  it('keyboard: arrows, Page Up / Down, Home; End confirms the same way', () => {
    const el = mount();
    const seen = confirms(el);
    const g = grip(el);
    expect(key(g, 'ArrowRight').defaultPrevented).toBe(true);
    expect(now(el)).toBe('10');
    expect(track(el).dataset.motion).toBe('take');
    key(g, 'ArrowUp');
    expect(now(el)).toBe('20');
    key(g, 'PageUp');
    expect(now(el)).toBe('45');
    expect(g.getAttribute('aria-valuetext')).toBe('Slide to confirm: 45%');
    key(g, 'ArrowLeft');
    expect(now(el)).toBe('35');
    key(g, 'ArrowDown');
    expect(now(el)).toBe('25');
    key(g, 'PageDown');
    expect(now(el)).toBe('0');
    expect(key(g, 'ArrowLeft').defaultPrevented).toBe(true);
    expect(now(el)).toBe('0');
    key(g, 'PageUp');
    key(g, 'Home');
    expect(now(el)).toBe('0');
    expect(key(g, 'Enter').defaultPrevented).toBe(false);
    expect(key(g, 'Tab').defaultPrevented).toBe(false);
    key(g, 'End');
    expect(now(el)).toBe('100');
    expect(seen).toHaveLength(0);
    vi.advanceTimersByTime(TAKE);
    expect(seen).toHaveLength(1);
    expect(el.state).toBe('done');
    // Filled: keys do nothing.
    expect(key(g, 'Home').defaultPrevented).toBe(false);
    expect(el.state).toBe('done');
  });

  it('reaching 100 with the arrows confirms too', () => {
    const el = mount();
    const seen = confirms(el);
    for (let i = 0; i < 10; i++) key(grip(el), 'ArrowRight');
    vi.advanceTimersByTime(TAKE);
    expect(seen).toHaveLength(1);
  });

  it('Escape: home when it has moved (or stops a take-over before it asks); left to the page at 0', () => {
    const el = mount();
    const seen = confirms(el);
    const g = grip(el);
    expect(key(g, 'Escape').defaultPrevented).toBe(false);
    key(g, 'PageUp');
    key(g, 'ArrowRight');
    expect(now(el)).toBe('35');
    expect(key(g, 'Escape').defaultPrevented).toBe(true);
    expect(now(el)).toBe('0');
    expect(track(el).dataset.motion).toBe('home');
    key(g, 'End');
    vi.advanceTimersByTime(TAKE - 10);
    expect(key(g, 'Escape').defaultPrevented).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(seen).toHaveLength(0);
    expect(now(el)).toBe('0');
    expect(el.state).toBe('idle');
  });

  it('blur with a value part of the way springs home', () => {
    const el = mount();
    const g = grip(el);
    key(g, 'PageUp');
    expect(now(el)).toBe('25');
    g.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
    expect(now(el)).toBe('0');
    expect(track(el).dataset.motion).toBe('home');
  });

  it('disabled: aria-disabled, a lock, and neither pointer nor keys move it', () => {
    const el = mount({ label: 'Deploys are frozen until 18:00', disabled: true });
    sized(el);
    const seen = confirms(el);
    const g = grip(el);
    expect(g.getAttribute('aria-disabled')).toBe('true');
    expect(g.getAttribute('tabindex')).toBe('0');
    expect(track(el).hasAttribute('data-disabled')).toBe(true);
    expect(q(el, '.sc-arrow svg')!.getAttribute('data-icon')).toBe('lock');
    drag(el, 1);
    expect(track(el).hasAttribute('data-held')).toBe(false);
    expect(at(el)).toBe(0);
    ptr(track(el), 'pointerup', 0);
    for (const k of ['End', 'ArrowRight', 'PageUp']) expect(key(g, k).defaultPrevented).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(now(el)).toBe('0');
    expect(seen).toHaveLength(0);
    // The attribute works the same; turned on mid-drag, it lets go and goes home.
    const attr = mount(undefined, { disabled: '' });
    expect(grip(attr).getAttribute('aria-disabled')).toBe('true');
    const live = mount();
    sized(live);
    drag(live, 0.5);
    live.setAttribute('disabled', '');
    live.renderNow();
    expect(at(live)).toBe(0);
    expect(track(live).hasAttribute('data-held')).toBe(false);
  });

  it('busy and done fill the grip with their words; done is announced', () => {
    const el = mount({
      label: 'Slide to deploy',
      busyLabel: 'Deploying v0.28.0…',
      doneLabel: 'Deployed',
      state: 'busy',
    });
    const g = grip(el);
    expect(el.state).toBe('busy');
    expect(track(el).hasAttribute('data-filled')).toBe(true);
    expect(track(el).dataset.show).toBe('busy');
    expect(q(el, '.sc-busy .sc-spin')).not.toBeNull();
    expect(q(el, '.sc-busy')!.textContent).toBe('Deploying v0.28.0…');
    expect(g.getAttribute('aria-disabled')).toBe('true');
    expect(g.getAttribute('aria-valuenow')).toBe('100');
    expect(g.getAttribute('aria-valuetext')).toBe('Deploying v0.28.0…');
    expect(g.getAttribute('aria-label')).toBe('Slide to deploy');
    expect(status(el)).toBe('');
    el.data = { ...el.data, state: 'done' };
    el.renderNow();
    expect(grip(el)).toBe(g);
    expect(track(el).dataset.show).toBe('done');
    expect(g.getAttribute('aria-valuetext')).toBe('Deployed');
    expect(status(el)).toBe('Deployed');
    // The host's idle closes it home.
    el.data = { ...el.data, state: 'idle' };
    el.renderNow();
    expect(el.state).toBe('idle');
    expect(track(el).hasAttribute('data-filled')).toBe(false);
    expect(track(el).dataset.motion).toBe('close');
    expect(status(el)).toBe('');
    expect(g.getAttribute('aria-valuetext')).toBe('Slide to deploy: 0%');
  });

  it('failed: a shake and a tint with the failed words, then home; idle with the words until the next try', () => {
    const el = mount({ state: 'busy' });
    sized(el);
    const fx = fakeAnimate(track(el));
    el.data = { ...el.data, state: 'failed' };
    el.renderNow();
    expect(el.state).toBe('failed');
    expect(track(el).dataset.show).toBe('fail');
    expect(track(el).hasAttribute('data-tint')).toBe(true);
    expect(track(el).hasAttribute('data-filled')).toBe(true);
    expect(q(el, '.sc-fail svg')!.getAttribute('data-icon')).toBe('cross');
    expect(grip(el).getAttribute('aria-valuetext')).toBe('Failed — try again');
    expect(status(el)).toBe('Failed — try again');
    expect(fx).toHaveBeenCalledTimes(1);
    expect(String(fx.mock.calls[0][0][1].transform)).toContain('translateX');
    vi.advanceTimersByTime(SHAKE);
    el.renderNow();
    expect(el.state).toBe('idle');
    expect(track(el).hasAttribute('data-filled')).toBe(false);
    expect(track(el).dataset.motion).toBe('close');
    expect(track(el).hasAttribute('data-note')).toBe(true);
    expect(q(el, '.sc-say')!.textContent).toBe('Failed — try again');
    expect(status(el)).toBe('Failed — try again');
    expect(grip(el).hasAttribute('aria-disabled')).toBe(false);
    vi.advanceTimersByTime(TINT - SHAKE);
    el.renderNow();
    expect(track(el).hasAttribute('data-tint')).toBe(false);
    // Setting data again with the same state replays nothing.
    el.data = { ...el.data, label: 'Slide to delete' };
    el.renderNow();
    expect(el.state).toBe('idle');
    expect(fx).toHaveBeenCalledTimes(1);
    // The next try clears the words.
    ptr(grip(el), 'pointerdown', LEFT + 28);
    ptr(track(el), 'pointermove', LEFT + 30);
    expect(track(el).hasAttribute('data-note')).toBe(false);
    expect(q(el, '.sc-say')!.textContent).toBe('Slide to delete');
    expect(status(el)).toBe('');
  });

  it('after a commit the host’s answer counts even when it is the same as last time (failed, then failed again)', () => {
    const el = mount({ state: 'failed' });
    vi.advanceTimersByTime(TINT);
    expect(el.state).toBe('idle');
    const seen = confirms(el);
    key(grip(el), 'End');
    vi.advanceTimersByTime(TAKE);
    expect(seen).toHaveLength(1);
    expect(el.state).toBe('done');
    el.data = { state: 'failed' };
    expect(el.state).toBe('failed');
    vi.advanceTimersByTime(SHAKE);
    expect(el.state).toBe('idle');
  });

  it('a host that answers inside its listener has the last word (busy, not done)', () => {
    const el = mount({ busyLabel: 'Stopping…' });
    confirms(el, () => {
      el.data = { ...el.data, state: 'busy' };
    });
    key(grip(el), 'End');
    vi.advanceTimersByTime(TAKE);
    expect(el.state).toBe('busy');
    expect(track(el).dataset.show).toBe('busy');
    expect(status(el)).toBe('');
  });

  it('reset() goes home and idle from done, whatever state said last', () => {
    const el = mount();
    key(grip(el), 'End');
    vi.advanceTimersByTime(TAKE);
    el.data = { state: 'done' };
    el.reset();
    el.renderNow();
    expect(el.state).toBe('idle');
    expect(track(el).hasAttribute('data-filled')).toBe(false);
    expect(track(el).dataset.motion).toBe('close');
    expect(status(el)).toBe('');
    // A new round: busy then done from the host count again.
    key(grip(el), 'End');
    vi.advanceTimersByTime(TAKE);
    el.data = { state: 'busy' };
    expect(el.state).toBe('busy');
  });

  it('escapes the label, the done words and the busy words — from data and attributes', () => {
    const el = mount({ label: XSS, doneLabel: XSS, busyLabel: XSS });
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    expect(q(el, '.sc-say')!.textContent).toBe(XSS);
    expect(grip(el).getAttribute('aria-label')).toBe(XSS);
    expect(grip(el).getAttribute('aria-valuetext')).toBe(`${XSS}: 0%`);
    expect(q(el, '.sc-done')!.textContent).toBe(XSS);
    expect(q(el, '.sc-busy')!.textContent).toBe(XSS);
    el.data = { ...el.data, state: 'done' };
    el.renderNow();
    expect(status(el)).toBe(XSS);
    expect(grip(el).getAttribute('aria-valuetext')).toBe(XSS);
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    const attr = mount(undefined, { label: XSS, 'done-label': XSS });
    expect(attr.shadowRoot!.querySelector('img')).toBeNull();
    expect(q(attr, '.sc-say')!.textContent).toBe(XSS);
    expect(q(attr, '.sc-done')!.textContent).toBe(XSS);
  });

  it('speaks Korean with lang="ko"', () => {
    const el = mount(undefined, { lang: 'ko' });
    expect(grip(el).getAttribute('aria-label')).toBe('밀어서 확인');
    expect(grip(el).getAttribute('aria-valuetext')).toBe('밀어서 확인: 0%');
    expect(q(el, '.sc-done')!.textContent).toBe('확인됨');
    expect(q(el, '.sc-busy')!.textContent).toBe('처리 중…');
    expect(q(el, '.sc-fail')!.textContent).toBe('실패 — 다시 시도');
    el.data = { state: 'failed' };
    el.renderNow();
    expect(status(el)).toBe('실패 — 다시 시도');
    el.data = { state: 'done' };
    el.renderNow();
    expect(status(el)).toBe('확인됨');
  });

  it('focus stays on the grip across renders (the node is patched, not replaced)', () => {
    const el = mount();
    const g = grip(el);
    g.focus();
    expect(el.shadowRoot!.activeElement).toBe(g);
    el.data = { label: 'Slide to stop the session' };
    el.renderNow();
    el.data = { label: 'Slide to stop the session', state: 'busy' };
    el.renderNow();
    expect(grip(el)).toBe(g);
    expect(el.shadowRoot!.activeElement).toBe(g);
  });

  it('removed mid take-over: nothing fires later', () => {
    const el = mount();
    const seen = confirms(el);
    key(grip(el), 'End');
    el.remove();
    vi.advanceTimersByTime(5000);
    expect(seen).toHaveLength(0);
  });

  it('reduced motion: no take-over wait, no squash, no shake — the grip still follows the pointer', () => {
    reduce();
    const el = mount();
    sized(el);
    const fx = fakeAnimate(track(el));
    const squash = fakeAnimate(grip(el));
    const seen = confirms(el);
    drag(el, 0.5);
    expect(at(el)).toBe(0.5);
    ptr(track(el), 'pointerup', 0);
    expect(at(el)).toBe(0);
    expect(squash).not.toHaveBeenCalled();
    key(grip(el), 'End');
    expect(seen).toHaveLength(1);
    expect(el.state).toBe('done');
    expect(fx).not.toHaveBeenCalled();
    el.data = { state: 'failed' };
    el.renderNow();
    expect(el.state).toBe('idle');
    expect(fx).not.toHaveBeenCalled();
    expect(status(el)).toBe('Failed — try again');
  });

  it('styles: the place and the width share one transition, a drag has none, tokens only', () => {
    expect(styles).toContain('max-width: var(--slide-w, 320px)');
    expect(styles).toContain('min-width: 220px');
    expect(styles).toContain('touch-action: none');
    expect(styles).toContain('user-select: none');
    expect(styles).toContain('left: calc(4px + var(--sc-p) * (100% - 56px))');
    expect(styles).toContain('width: calc(48px + var(--sc-q) * (100% - 56px))');
    expect(styles).toContain('transition: left var(--sc-dur) var(--sc-ease), width var(--sc-dur) var(--sc-ease)');
    expect(styles).toContain(`.sc[data-motion="take"] { --sc-dur: ${TAKE}ms; --sc-ease: linear(0, `);
    expect(styles).not.toContain('data-motion="drag"');
    expect(styles).toContain('--sc-dur: 0ms');
    expect(styles).toContain('.sc-grip:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }');
    expect(styles).toContain('(prefers-reduced-motion: no-preference)');
    expect(styles).toContain('color-mix(in srgb, var(--st-fail) calc(82% * var(--chroma)), var(--ib-text))');
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    vi.useRealTimers();
    reduce();
    spy = soundSpy();
  });
  afterEach(() => spy.restore());

  it('the person’s commit plays success once ui-confirm goes through — by key or by pointer', async () => {
    const el = mount();
    key(grip(el), 'End');
    await spy.settle();
    expect(spy.calls).toEqual([['success', { emphasis: 'normal', input: 'keyboard' }]]);
    el.reset();
    el.renderNow();
    sized(el);
    drag(el, 1);
    ptr(track(el), 'pointerup', 0);
    await spy.settle();
    expect(spy.calls).toEqual([
      ['success', { emphasis: 'normal', input: 'keyboard' }],
      ['success', { emphasis: 'normal', input: 'mouse' }],
    ]);
  });

  it('no success cue when the host refuses inside its listener (failed); a busy answer still sounds', async () => {
    const el = mount();
    el.addEventListener('ui-confirm', () => (el.data = { state: 'failed' }), { once: true });
    key(grip(el), 'End');
    await spy.settle();
    expect(spy.calls).toEqual([]);
    el.reset();
    el.renderNow();
    el.addEventListener('ui-confirm', () => (el.data = { state: 'busy' }), { once: true });
    key(grip(el), 'End');
    await spy.settle();
    expect(spy.calls).toEqual([['success', { emphasis: 'normal', input: 'keyboard' }]]);
  });

  it('silent when prevented, on grab and release, going home, and for every state the host sets', async () => {
    const el = mount();
    el.addEventListener('ui-confirm', (e) => e.preventDefault(), { once: true });
    key(grip(el), 'End');
    sized(el);
    drag(el, 0.5);
    ptr(track(el), 'pointerup', 0);
    key(grip(el), 'PageUp');
    key(grip(el), 'Escape');
    el.data = { state: 'busy' };
    el.data = { state: 'done' };
    el.data = { state: 'failed' };
    el.data = { state: 'idle' };
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });
});

describe('docs', () => {
  it('names the block, its group and the sound line; every demo builds', () => {
    expect(doc.slug).toBe('slide-confirm');
    expect(doc.tag).toBe('ui-slide-confirm');
    expect(doc.name).toBe('Slide to Confirm');
    expect(doc.group).toBe('Primitives');
    expect(doc.reference).toEqual({
      name: 'bencho.dev — Slide to confirm (MIT)',
      url: 'https://bencho.dev/blocks/slide-confirm',
    });
    expect(doc.events.map((e) => e.name)).toEqual(['ui-confirm']);
    expect(doc.a11y.some((l) => l.startsWith('Sound (opt-in'))).toBe(true);
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) {
      const node = d.create();
      expect(node).toBeInstanceOf(HTMLElement);
      document.body.append(node);
      expect(node.querySelector('ui-slide-confirm')).not.toBeNull();
    }
  });

  it('the deploy demo: busy on ui-confirm, done 1.2 s later, Reset goes home', () => {
    const node = doc.demos.find((d) => d.id === 'deploy')!.create();
    document.body.append(node);
    const el = node.querySelector('ui-slide-confirm')!;
    el.renderNow();
    expect(track(el).dataset.tone).toBe('danger');
    key(grip(el), 'End');
    vi.advanceTimersByTime(TAKE);
    expect(el.state).toBe('busy');
    vi.advanceTimersByTime(1200);
    expect(el.state).toBe('done');
    node.querySelector('button')!.click();
    expect(el.state).toBe('idle');
  });

  it('the Korean demo fails first, then goes through', () => {
    const node = doc.demos.find((d) => d.id === 'ko')!.create();
    document.body.append(node);
    const el = node.querySelector('ui-slide-confirm')!;
    el.renderNow();
    key(grip(el), 'End');
    vi.advanceTimersByTime(TAKE + 900);
    expect(el.state).toBe('failed');
    vi.advanceTimersByTime(SHAKE);
    expect(el.state).toBe('idle');
    key(grip(el), 'End');
    vi.advanceTimersByTime(TAKE + 900);
    expect(el.state).toBe('done');
  });
});
