import { afterEach, describe, expect, it } from 'vitest';
import type { UiDial } from './dial';
import { doc } from './docs';
import {
  DIAL_RING_RADIUS,
  type DialData,
  dialArc,
  dialArcLength,
  dialArcPath,
  dialDeltaText,
  dialDeltaTone,
  dialFilled,
  dialFraction,
  dialNumber,
  dialPoint,
  dialRange,
  dialShape,
  dialSize,
  dialStagger,
  dialStartAngle,
  dialTickCount,
  dialTickGeometry,
  dialTone,
} from './index';

const XSS = '<img src=x onerror=alert(1)>';
const SCORE = { low: 60, high: 80 };
const USED = { low: 50, high: 80, optimum: 0 };

function mount(data?: DialData, attrs: Record<string, string> = {}): UiDial {
  const el = document.createElement('ui-dial');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  if (data) el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiDial, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = <E extends Element = HTMLElement>(el: UiDial, s: string) =>
  Array.from(el.shadowRoot!.querySelectorAll<E>(s));
const face = (el: UiDial) => q(el, '.d-face')!;
const dialNode = (el: UiDial) => q(el, '.d')!;
const ticks = (el: UiDial) => qa<SVGLineElement>(el, '.d-tick');
const on = (el: UiDial) => qa<SVGLineElement>(el, '.d-tick.is-on');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('helpers', () => {
  it('dialRange: the meter range with a 0 … 100 default scale', () => {
    expect(dialRange(undefined)).toEqual({ min: 0, max: 100, low: undefined, high: undefined, optimum: 100 });
    expect(dialRange({ max: 1 })).toMatchObject({ min: 0, max: 1, optimum: 1 });
    expect(dialRange({ min: 200 })).toMatchObject({ min: 200, max: 200 });
    expect(dialRange({ optimum: 0, low: 50 })).toMatchObject({ max: 100, optimum: 0, low: 50 });
  });

  it('dialFraction: a share of the scale, clamped; unknown or an empty scale is NaN', () => {
    expect(dialFraction(90)).toBe(0.9);
    expect(dialFraction(0.25, { max: 1 })).toBe(0.25);
    expect(dialFraction(15, { min: 10, max: 20 })).toBe(0.5);
    expect(dialFraction(140)).toBe(1);
    expect(dialFraction(-5)).toBe(0);
    expect(dialFraction('72')).toBe(0.72);
    expect(dialFraction(null)).toBeNaN();
    expect(dialFraction(undefined)).toBeNaN();
    expect(dialFraction('soon')).toBeNaN();
    expect(dialFraction(3, { min: 3, max: 3 })).toBeNaN();
  });

  it('dialTickCount: 40 by default, a whole number clamped to 12 … 80', () => {
    expect(dialTickCount(undefined)).toBe(40);
    expect(dialTickCount('x')).toBe(40);
    expect(dialTickCount(24)).toBe(24);
    expect(dialTickCount('30')).toBe(30);
    expect(dialTickCount(3)).toBe(12);
    expect(dialTickCount(500)).toBe(80);
    expect(dialTickCount(20.6)).toBe(21);
  });

  it('dialArc / dialShape / dialTone: defaults and clamps', () => {
    expect(dialArc(undefined)).toBe(270);
    expect(dialArc(undefined, 'ring')).toBe(360);
    expect(dialArc(90)).toBe(180);
    expect(dialArc(400, 'ring')).toBe(360);
    expect(dialArc('300')).toBe(300);
    expect(dialShape('ring')).toBe('ring');
    expect(dialShape('pie')).toBe('ticks');
    expect(dialTone('accent')).toBe('accent');
    expect(dialTone('loud')).toBe('auto');
  });

  it('dialFilled: none at 0, all at 1, a sliver still shows one and almost-full is never full', () => {
    expect(dialFilled(0.9, 40)).toBe(36);
    expect(dialFilled(0, 40)).toBe(0);
    expect(dialFilled(Number.NaN, 40)).toBe(0);
    expect(dialFilled(1, 40)).toBe(40);
    expect(dialFilled(0.001, 40)).toBe(1);
    expect(dialFilled(0.999, 40)).toBe(39);
  });

  it('geometry: an open arc is centred on the top (opening down); a full ring starts at the top', () => {
    expect(dialStartAngle(270)).toBe(-135);
    expect(dialStartAngle(360)).toBe(0);
    expect(dialPoint(40, 0)).toEqual([50, 10]);
    expect(dialPoint(40, 90)).toEqual([90, 50]);
    expect(dialPoint(40, 180)).toEqual([50, 90]);
    // 270°: from lower left round the top to lower right, the large arc, clockwise.
    const open = dialArcPath(270, 40);
    expect(open).toBe(`M ${dialPoint(40, -135).join(' ')} A 40 40 0 1 1 ${dialPoint(40, 135).join(' ')}`);
    const [sx, sy] = dialPoint(40, -135);
    expect(sx).toBeLessThan(50);
    expect(sy).toBeGreaterThan(50);
    // A half arc is not the large one; a full ring is two halves from the top.
    expect(dialArcPath(180, 40)).toContain(' 0 0 1 ');
    expect(dialArcPath(360, 40)).toBe('M 50 10 A 40 40 0 0 1 50 90 A 40 40 0 0 1 50 10');
    expect(dialArcLength(360, 10)).toBe(62.83);
    expect(dialArcLength(180, 10)).toBe(31.42);
  });

  it('dialTickGeometry: n ticks, ends on both sides of an open arc, evenly round a full ring, radial', () => {
    const g = dialTickGeometry(40, 270);
    expect(g.ticks).toHaveLength(40);
    expect(g.width).toBeGreaterThan(1);
    expect(g.width).toBeLessThanOrEqual(3.2);
    const first = g.ticks[0];
    const last = g.ticks[39];
    // Mirror images across the vertical axis: the opening faces down.
    expect(first.x1 + last.x1).toBeCloseTo(100, 1);
    expect(first.y1).toBeCloseTo(last.y1, 1);
    expect(first.y1).toBeGreaterThan(50);
    // Each tick runs outward along its radius: the outer end is further from the centre.
    const dist = (x: number, y: number) => Math.hypot(x - 50, y - 50);
    expect(dist(first.x2, first.y2)).toBeGreaterThan(dist(first.x1, first.y1));
    const ring = dialTickGeometry(12, 360);
    expect(ring.ticks).toHaveLength(12);
    expect(ring.ticks[0].x1).toBe(50);
    expect(ring.ticks[0].y1).toBeLessThan(50);
    // Clamped like the count; more ticks are thinner.
    expect(dialTickGeometry(5, 270).ticks).toHaveLength(12);
    expect(dialTickGeometry(80, 270).width).toBeLessThan(dialTickGeometry(20, 270).width);
  });

  it('dialStagger: the changed ticks wait in sweep order, the whole sweep under 240ms; others 0', () => {
    expect(dialStagger(5, 10, 10)).toBe(0);
    // Growing 10 → 20: tick 10 first, then up.
    expect(dialStagger(10, 10, 20)).toBe(0);
    expect(dialStagger(11, 10, 20)).toBeGreaterThan(0);
    expect(dialStagger(19, 10, 20)).toBeGreaterThan(dialStagger(11, 10, 20));
    expect(dialStagger(9, 10, 20)).toBe(0);
    expect(dialStagger(25, 10, 20)).toBe(0);
    // Shrinking 20 → 10: the top changed tick first, then down.
    expect(dialStagger(19, 20, 10)).toBe(0);
    expect(dialStagger(10, 20, 10)).toBeGreaterThan(dialStagger(18, 20, 10));
    // A long sweep is capped.
    const all = Array.from({ length: 80 }, (_, i) => dialStagger(i, 0, 80));
    expect(Math.max(...all)).toBeLessThan(240);
  });

  it('dialDeltaTone: toward optimum is good, away is bad; optimum = min flips it; zero or the middle is neutral', () => {
    expect(dialDeltaTone(4)).toBe('done');
    expect(dialDeltaTone(-4)).toBe('fail');
    expect(dialDeltaTone(4, 0)).toBe('fail');
    expect(dialDeltaTone(-6, 0)).toBe('done');
    expect(dialDeltaTone(-6, undefined, { optimum: 0 })).toBe('done');
    expect(dialDeltaTone(-0.1, 0, { max: 1 })).toBe('done');
    expect(dialDeltaTone(0)).toBe('idle');
    expect(dialDeltaTone(null)).toBe('idle');
    expect(dialDeltaTone(3, 50)).toBe('idle');
    expect(dialDeltaTone(3, 40)).toBe('fail');
  });

  it('numbers: whole, up to 2 decimals under 10, 1 from 10; the signed delta uses a true minus', () => {
    expect(dialNumber(90)).toBe('90');
    expect(dialNumber(1200)).toBe('1,200');
    expect(dialNumber(0.724)).toBe('0.72');
    expect(dialNumber(96.44)).toBe('96.4');
    expect(dialNumber(Number.NaN)).toBe('?');
    expect(dialDeltaText(4)).toBe('+4');
    expect(dialDeltaText(-2.5)).toBe('−2.5');
    expect(dialDeltaText(0)).toBe('0');
  });

  it('dialSize: px from a number (48 … 640), a px / rem / em length, otherwise nothing', () => {
    expect(dialSize(96)).toBe('96px');
    expect(dialSize('120')).toBe('120px');
    expect(dialSize(10)).toBe('48px');
    expect(dialSize(2000)).toBe('640px');
    expect(dialSize('8rem')).toBe('8rem');
    expect(dialSize('0')).toBe('');
    expect(dialSize('1px;color:red')).toBe('');
    expect(dialSize(undefined)).toBe('');
  });
});

describe('<ui-dial>', () => {
  it('ticks: 40 radial lines on a 270° arc, 36 filled at 90/100, the number and "out of 100", a meter', () => {
    const el = mount({ value: 90, ...SCORE, label: 'Review score' });
    expect(dialNode(el).classList.contains('d-ticks')).toBe(true);
    expect(ticks(el)).toHaveLength(40);
    expect(on(el)).toHaveLength(36);
    expect(q(el, '.d-num')!.textContent).toBe('90');
    expect(q(el, '.d-cap')!.textContent).toBe('out of 100');
    const f = face(el);
    expect(f.getAttribute('role')).toBe('meter');
    expect(f.getAttribute('aria-label')).toBe('Review score');
    expect(f.getAttribute('aria-valuemin')).toBe('0');
    expect(f.getAttribute('aria-valuemax')).toBe('100');
    expect(f.getAttribute('aria-valuenow')).toBe('90');
    expect(f.getAttribute('aria-valuetext')).toBe('90 out of 100');
    expect(q(el, 'svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(q(el, '.d-center')!.getAttribute('aria-hidden')).toBe('true');
    expect(dialNode(el).dataset.tone).toBe('done');
    expect(el.tone).toBe('done');
    // The ticks are SVG lines with round caps (in the styles) and one stroke width on their group.
    expect(ticks(el)[0].namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(Number(q(el, 'g.d-ticks')!.getAttribute('stroke-width'))).toBeGreaterThan(0);
  });

  it('ring: a track and a value arc whose dash offset leaves the rest of the length', () => {
    const el = mount({ value: 91, shape: 'ring', unit: '%', caption: 'taken', label: 'On time' });
    expect(dialNode(el).classList.contains('d-ring')).toBe(true);
    expect(ticks(el)).toHaveLength(0);
    const track = q<SVGPathElement>(el, '.d-track')!;
    const arc = q<SVGPathElement>(el, '.d-arc')!;
    const len = dialArcLength(360, DIAL_RING_RADIUS);
    expect(track.getAttribute('d')).toBe(dialArcPath(360, DIAL_RING_RADIUS));
    expect(arc.getAttribute('d')).toBe(track.getAttribute('d'));
    expect(arc.style.getPropertyValue('stroke-dasharray')).toBe(`${len} ${len}`);
    expect(Number(arc.style.getPropertyValue('stroke-dashoffset'))).toBeCloseTo(len * 0.09, 1);
    expect(arc.classList.contains('is-zero')).toBe(false);
    expect(q(el, '.d-num')!.textContent).toBe('91%');
    expect(q(el, '.d-unit')!.textContent).toBe('%');
    expect(q(el, '.d-cap')!.textContent).toBe('taken');
    expect(face(el).getAttribute('aria-valuetext')).toBe('91% taken');
    // An open ring arc (270) uses the open path.
    const open = mount({ value: 50, shape: 'ring', arc: 270 });
    expect(q(open, '.d-track')!.getAttribute('d')).toBe(dialArcPath(270, DIAL_RING_RADIUS));
    // Zero hides the arc (no round-cap dot).
    expect(q(mount({ value: 0, shape: 'ring' }), '.d-arc')!.classList.contains('is-zero')).toBe(true);
  });

  it('clamps: a reading past max fills everything (the number stays honest), ticks and arc clamp', () => {
    const over = mount({ value: 120, label: 'Score' });
    expect(on(over)).toHaveLength(40);
    expect(q(over, '.d-num')!.textContent).toBe('120');
    expect(face(over).getAttribute('aria-valuenow')).toBe('100');
    const under = mount({ value: -8 });
    expect(on(under)).toHaveLength(0);
    expect(face(under).getAttribute('aria-valuenow')).toBe('0');
    expect(ticks(mount({ value: 50, ticks: 4 }))).toHaveLength(12);
    expect(ticks(mount({ value: 50, ticks: 400 }))).toHaveLength(80);
    expect(on(mount({ value: 50, ticks: 24 }))).toHaveLength(12);
    // A sliver shows one tick.
    expect(on(mount({ value: 0.5 }))).toHaveLength(1);
  });

  it('unknown: "?" in the middle, nothing filled, role="img" "<label>: Unknown" (미확인 in Korean)', () => {
    const el = mount({ value: null, ...SCORE, label: 'Review score' });
    const f = face(el);
    expect(f.getAttribute('role')).toBe('img');
    expect(f.getAttribute('aria-label')).toBe('Review score: Unknown');
    expect(f.hasAttribute('aria-valuenow')).toBe(false);
    expect(on(el)).toHaveLength(0);
    expect(q(el, '.d-num')!.textContent).toBe('?');
    expect(dialNode(el).dataset.tone).toBe('idle');
    expect(el.tone).toBe('idle');
    const ring = mount({ value: undefined, shape: 'ring', unit: '%' });
    expect(q(ring, '.d-arc')!.classList.contains('is-zero')).toBe(true);
    expect(q(ring, '.d-unit')).toBeNull();
    expect(face(ring).getAttribute('aria-label')).toBe('Unknown');
    const ko = mount({ value: null, label: '크론 성공률' }, { lang: 'ko' });
    expect(face(ko).getAttribute('aria-label')).toBe('크론 성공률: 미확인');
  });

  it('tone by thresholds: the meter rule — score good/fair/bad, context used flips with optimum min; accent ink', () => {
    expect(dialNode(mount({ value: 90, ...SCORE })).dataset.tone).toBe('done');
    expect(dialNode(mount({ value: 70, ...SCORE })).dataset.tone).toBe('wait');
    expect(dialNode(mount({ value: 40, ...SCORE })).dataset.tone).toBe('fail');
    expect(dialNode(mount({ value: 30, ...USED })).dataset.tone).toBe('done');
    expect(dialNode(mount({ value: 72, ...USED })).dataset.tone).toBe('wait');
    expect(dialNode(mount({ value: 92, ...USED })).dataset.tone).toBe('fail');
    const accent = mount({ value: 40, ...SCORE, tone: 'accent' });
    expect(dialNode(accent).dataset.tone).toBe('accent');
    expect(accent.tone).toBe('fail');
    expect(dialNode(mount({ value: null, tone: 'accent' })).dataset.tone).toBe('idle');
  });

  it('delta: a chip under the dial, done when it moved toward optimum, fail away — optimum min flips it', () => {
    const up = mount({ value: 90, ...SCORE, delta: { value: 4, text: 'since last week' } });
    const chip = q(up, '.d-delta')!;
    expect(chip.dataset.tone).toBe('done');
    expect(q(up, '.d-delta-n')!.textContent).toBe('+4');
    expect(q(up, '.d-delta-t')!.textContent).toBe('since last week');
    expect(chip.getAttribute('aria-hidden')).toBeNull();
    expect(face(up).contains(chip)).toBe(false);
    expect(q(mount({ value: 90, delta: { value: -3 } }), '.d-delta')!.dataset.tone).toBe('fail');
    expect(q(mount({ value: 90, delta: { value: -3 } }), '.d-delta-n')!.textContent).toBe('−3');
    const used = mount({ value: 72, ...USED, unit: '%', delta: { value: -6, text: 'since compaction' } });
    expect(q(used, '.d-delta')!.dataset.tone).toBe('done');
    expect(q(used, '.d-delta-n')!.textContent).toBe('−6%');
    expect(q(mount({ value: 72, ...USED, delta: { value: 5 } }), '.d-delta')!.dataset.tone).toBe('fail');
    expect(q(mount({ value: 72, delta: { value: 0 } }), '.d-delta')!.dataset.tone).toBe('idle');
    expect(q(mount({ value: 72 }), '.d-delta')).toBeNull();
    expect(q(mount({ value: 72, delta: { value: Number.NaN } }), '.d-delta')).toBeNull();
  });

  it('caption: default only with the bare number; your own; "" hides it; the max follows the scale', () => {
    expect(q(mount({ value: 12, max: 14 }), '.d-cap')!.textContent).toBe('out of 14');
    expect(q(mount({ value: 72, unit: '%' }), '.d-cap')).toBeNull();
    expect(q(mount({ value: 12, text: '12 / 14' }), '.d-cap')).toBeNull();
    expect(q(mount({ value: 72, unit: '%', caption: 'used' }), '.d-cap')!.textContent).toBe('used');
    expect(q(mount({ value: 90, caption: '' }), '.d-cap')).toBeNull();
    expect(q(mount({ value: 90 }, { caption: '' }), '.d-cap')).toBeNull();
    const none = mount({ value: 90, caption: '' });
    expect(face(none).getAttribute('aria-valuetext')).toBe('90');
  });

  it('Korean: "{max}점 만점" under the number, read as "90, 100점 만점"', () => {
    const el = mount({ value: 90, label: '리뷰 점수' }, { lang: 'ko' });
    expect(q(el, '.d-cap')!.textContent).toBe('100점 만점');
    expect(face(el).getAttribute('aria-valuetext')).toBe('90, 100점 만점');
    expect(q(mount({ value: 12, max: 14 }, { lang: 'ko' }), '.d-cap')!.textContent).toBe('14점 만점');
  });

  it('words in the middle replace the number and are what is read; long words set smaller', () => {
    const el = mount({ value: 86, text: '12/14', label: 'Deploys green' });
    expect(q(el, '.d-num')!.textContent).toBe('12/14');
    expect(q(el, '.d-num')!.classList.contains('is-words')).toBe(true);
    expect(q(el, '.d-num')!.hasAttribute('data-long')).toBe(false);
    expect(face(el).getAttribute('aria-valuetext')).toBe('12/14');
    expect(on(el)).toHaveLength(34);
    expect(q(mount({ value: 86, text: '12 of 14 green' }), '.d-num')!.hasAttribute('data-long')).toBe(true);
    // Without a label it is still named — by its words.
    expect(face(mount({ value: 90 })).getAttribute('aria-label')).toBe('90 out of 100');
  });

  it('escapes label, text, caption, unit and delta text', () => {
    const el = mount({
      value: 50,
      label: `Score ${XSS}`,
      caption: `cap ${XSS}`,
      unit: XSS,
      delta: { value: 2, text: `since ${XSS}` },
    });
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    expect(face(el).getAttribute('aria-label')).toBe(`Score ${XSS}`);
    expect(q(el, '.d-cap')!.textContent).toBe(`cap ${XSS}`);
    expect(q(el, '.d-unit')!.textContent).toBe(XSS);
    expect(q(el, '.d-delta-n')!.textContent).toBe(`+2${XSS}`);
    expect(q(el, '.d-delta-t')!.textContent).toBe(`since ${XSS}`);
    const words = mount({ value: 50, text: XSS, label: XSS });
    expect(words.shadowRoot!.querySelector('img')).toBeNull();
    expect(q(words, '.d-num')!.textContent).toBe(XSS);
    expect(face(words).getAttribute('aria-valuetext')).toBe(XSS);
    const unknown = mount({ value: null, label: XSS });
    expect(unknown.shadowRoot!.querySelector('img')).toBeNull();
    expect(face(unknown).getAttribute('aria-label')).toBe(`${XSS}: Unknown`);
    // A size that tries to break out of the style attribute is dropped.
    const sized = mount({ value: 50 }, { size: '1px;background:url(x)' });
    expect(face(sized).getAttribute('style')).toBeNull();
  });

  it('reads attributes too; data wins over them', () => {
    const el = mount(undefined, {
      value: '72',
      low: '50',
      high: '80',
      optimum: '0',
      label: 'Context used',
      shape: 'ring',
      unit: '%',
      caption: 'used',
      size: '96',
    });
    expect(dialNode(el).classList.contains('d-ring')).toBe(true);
    expect(dialNode(el).dataset.tone).toBe('wait');
    expect(face(el).getAttribute('aria-valuetext')).toBe('72% used');
    expect(face(el).style.getPropertyValue('--dial-size')).toBe('96px');
    el.data = { value: 30, shape: 'ticks', caption: 'left' };
    el.renderNow();
    expect(dialNode(el).classList.contains('d-ticks')).toBe(true);
    expect(dialNode(el).dataset.tone).toBe('done');
    expect(face(el).getAttribute('aria-valuetext')).toBe('30% left');
    expect(face(el).getAttribute('aria-label')).toBe('Context used');
    const t = mount(undefined, { value: '50', ticks: '20', max: '200', arc: '200' });
    expect(ticks(t)).toHaveLength(20);
    expect(on(t)).toHaveLength(5);
    expect(q(t, '.d-cap')!.textContent).toBe('out of 200');
    // An explicit null in data beats a value attribute: unknown.
    el.data = { value: null };
    el.renderNow();
    expect(face(el).getAttribute('role')).toBe('img');
    // A new attribute re-renders.
    const live = mount(undefined, { value: '10' });
    live.setAttribute('value', '60');
    live.renderNow();
    expect(on(live)).toHaveLength(24);
  });

  it('a new value morphs in place: the same SVG, ticks and arc nodes; the ticks turn with a sweep stagger', () => {
    const el = mount({ value: 50, ...SCORE, label: 'Review score' });
    const svg = q(el, 'svg')!;
    const f = face(el);
    const num = q(el, '.d-num')!;
    const lines = ticks(el);
    expect(lines.some((l) => l.getAttribute('style'))).toBe(false); // first paint: nothing staggers
    el.data = { ...el.data, value: 90 };
    el.renderNow();
    expect(q(el, 'svg')).toBe(svg);
    expect(face(el)).toBe(f);
    expect(q(el, '.d-num')).toBe(num);
    expect(ticks(el)).toEqual(lines);
    expect(on(el)).toHaveLength(36);
    expect(num.textContent).toBe('90');
    expect(f.getAttribute('aria-valuenow')).toBe('90');
    // Ticks 20 … 35 turned on in order; the first of them waits 0, the later ones longer; the rest none.
    expect(lines[20].getAttribute('style')).toBeNull();
    expect(lines[21].style.transitionDelay).toMatch(/ms$/);
    expect(Number.parseFloat(lines[35].style.transitionDelay)).toBeGreaterThan(
      Number.parseFloat(lines[21].style.transitionDelay),
    );
    expect(Number.parseFloat(lines[35].style.transitionDelay)).toBeLessThan(240);
    expect(lines[5].getAttribute('style')).toBeNull();
    // Going down sweeps from the top: tick 35 first.
    el.data = { ...el.data, value: 40 };
    el.renderNow();
    expect(on(el)).toHaveLength(16);
    expect(lines[35].getAttribute('style')).toBeNull();
    expect(Number.parseFloat(lines[16].style.transitionDelay)).toBeGreaterThan(0);
    // The same value again: nothing staggers.
    el.data = { ...el.data, label: 'Score' };
    el.renderNow();
    expect(lines.some((l) => l.getAttribute('style'))).toBe(false);
    // A ring keeps its arc and patches the offset.
    const ring = mount({ value: 20, shape: 'ring' });
    const arc = q<SVGPathElement>(ring, '.d-arc')!;
    const before = Number(arc.style.getPropertyValue('stroke-dashoffset'));
    ring.data = { ...ring.data, value: 80 };
    ring.renderNow();
    expect(q(ring, '.d-arc')).toBe(arc);
    expect(Number(arc.style.getPropertyValue('stroke-dashoffset'))).toBeLessThan(before);
  });

  it('styles: the arc rides --dur-move on its dash offset, ticks fade, tones color-mix toward ink by --chroma', () => {
    const css = (document.createElement('ui-dial') as UiDial).shadowRoot!.querySelector('style')!.textContent ?? '';
    expect(css).toContain('transition: stroke-dashoffset var(--dur-move) var(--ease-out)');
    expect(css).toContain('transition: stroke var(--dur-fade) var(--ease-out)');
    expect(css).toContain('--d-fill: color-mix(in srgb, var(--d-mark) calc(100% * var(--chroma)), var(--ib-text))');
    expect(css).toContain('calc(70% * var(--chroma))');
    expect(css).toContain('width: var(--dial-size, 180px); max-width: 100%; aspect-ratio: 1');
    expect(css).toContain('stroke-linecap: round');
    expect(css).toContain('@media (prefers-reduced-motion: reduce) { .d-tick { transition-delay: 0s !important; } }');
    expect(css).not.toMatch(/@keyframes|infinite/);
    // No literal colours in the component's own styles.
    const own = (document.createElement('ui-dial').constructor as typeof UiDial).styles.join('\n');
    expect(own).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  it('docs: at least three demos that build, the Halvi reference, Primitives', () => {
    expect(doc.group).toBe('Primitives');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    expect(doc.reference.url).toBe('https://demo.codeandchill.store/halvi/');
    for (const d of doc.demos) {
      const el = d.create();
      document.body.append(el);
      expect(el.querySelector('ui-dial')).not.toBeNull();
    }
  });
});
