import { afterEach, describe, expect, it } from 'vitest';
import { doc } from './docs';
import {
  type MeterData,
  meterFraction,
  meterPercent,
  meterRange,
  meterShape,
  meterText,
  meterTone,
  meterValue,
  type UiMeter,
} from './meter';

const XSS = '<img src=x onerror=alert(1)>';
const LEFT = { low: 0.2, high: 0.5 };

function mount(data?: MeterData, attrs: Record<string, string> = {}): UiMeter {
  const el = document.createElement('ui-meter');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  if (data) el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiMeter, s: string) => el.shadowRoot!.querySelector<E>(s);
const meter = (el: UiMeter) => q(el, '.m')!;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('helpers', () => {
  it('reads numbers and numeric strings; anything else is unknown', () => {
    expect(meterValue(0.5)).toBe(0.5);
    expect(meterValue('72')).toBe(72);
    expect(meterValue('')).toBeNaN();
    expect(meterValue(null)).toBeNaN();
    expect(meterValue('soon')).toBeNaN();
    expect(meterValue(Number.POSITIVE_INFINITY)).toBeNaN();
    expect(meterShape('battery')).toBe('battery');
    expect(meterShape('pie')).toBe('bar');
  });

  it('fills the range in: 0 … 1 by default, optimum at max, max never below min', () => {
    expect(meterRange(undefined)).toEqual({ min: 0, max: 1, low: undefined, high: undefined, optimum: 1 });
    expect(meterRange({ max: 100, low: 20, high: 50 })).toEqual({ min: 0, max: 100, low: 20, high: 50, optimum: 100 });
    expect(meterRange({ min: 10, max: 5 })).toEqual({ min: 10, max: 10, low: undefined, high: undefined, optimum: 10 });
    expect(meterRange({ optimum: 7 }).optimum).toBe(1);
    expect(meterRange({ min: '2', max: '4', optimum: '3' } as never)).toMatchObject({ min: 2, max: 4, optimum: 3 });
  });

  it('turns a reading into a share and a whole percent, clamped', () => {
    expect(meterFraction(0.72)).toBe(0.72);
    expect(meterPercent(0.724)).toBe(72);
    expect(meterPercent(72, { max: 100 })).toBe(72);
    expect(meterPercent(1.4)).toBe(100);
    expect(meterPercent(-1)).toBe(0);
    expect(meterPercent(null)).toBeNaN();
    expect(meterPercent(3, { min: 3, max: 3 })).toBeNaN();
  });

  it('tone: the region shared with optimum is good, a neighbour fair, the far one bad; unknown is idle', () => {
    // What is left (optimum max): good from a half, fair from a fifth, bad below — the dashboard's battery.
    expect(meterTone(0.92, LEFT)).toBe('done');
    expect(meterTone(0.5, LEFT)).toBe('done');
    expect(meterTone(0.48, LEFT)).toBe('wait');
    expect(meterTone(0.2, LEFT)).toBe('wait');
    expect(meterTone(0.19, LEFT)).toBe('fail');
    expect(meterTone(null, LEFT)).toBe('idle');
    expect(meterTone('x', LEFT)).toBe('idle');
    // What is used (optimum min): good below low, fair up to high, bad from there.
    expect(meterTone(0.1, { low: 0.5, high: 0.8, optimum: 0 })).toBe('done');
    expect(meterTone(0.65, { low: 0.5, high: 0.8, optimum: 0 })).toBe('wait');
    expect(meterTone(0.82, { low: 0.5, high: 0.8, optimum: 0 })).toBe('fail');
    // One threshold makes two neighbouring regions: the far side is fair at most, never bad.
    expect(meterTone(0.82, { high: 0.8, optimum: 0 })).toBe('wait');
    // No thresholds: everything is the middle, so everything is good.
    expect(meterTone(0.01)).toBe('done');
    expect(meterTone(0.99)).toBe('done');
    // Only a low threshold with optimum at max: below it is a neighbour of the middle — fair, never bad.
    expect(meterTone(0.1, { low: 0.2 })).toBe('wait');
    // Optimum in the middle: both ends are fair.
    expect(meterTone(0.95, { low: 0.2, high: 0.8, optimum: 0.5 })).toBe('wait');
    expect(meterTone(0.05, { low: 0.2, high: 0.8, optimum: 0.5 })).toBe('wait');
  });

  it('words: your own, else the percent, else "?"', () => {
    expect(meterText({ value: 0.72 })).toBe('72%');
    expect(meterText({ value: 3, max: 5, text: '3 of 5 accounts' })).toBe('3 of 5 accounts');
    expect(meterText({ value: null })).toBe('?');
  });
});

describe('<ui-meter>', () => {
  it('is a meter: the percent as its value, the words as its text, the tone on the node, the fill at the percent', () => {
    const el = mount({ value: 0.72, ...LEFT, label: 'Remaining usage' });
    const m = meter(el);
    expect(m.getAttribute('role')).toBe('meter');
    expect(m.getAttribute('aria-label')).toBe('Remaining usage');
    expect(m.getAttribute('aria-valuemin')).toBe('0');
    expect(m.getAttribute('aria-valuemax')).toBe('100');
    expect(m.getAttribute('aria-valuenow')).toBe('72');
    expect(m.getAttribute('aria-valuetext')).toBe('72%');
    expect(m.dataset.tone).toBe('done');
    expect(m.classList.contains('m-bar')).toBe(true);
    expect(q(el, '.m-fill')!.style.width).toBe('72%');
    expect(q(el, '.m-text')!.textContent).toBe('72%');
    expect(q(el, '.m-text')!.getAttribute('aria-hidden')).toBe('true');
    expect(el.tone).toBe('done');
  });

  it('reads attributes too (data wins), the battery shape and bare', () => {
    const el = mount(undefined, { value: '0.12', low: '0.2', high: '0.5', label: 'Left', shape: 'battery', bare: '' });
    const m = meter(el);
    expect(m.classList.contains('m-battery')).toBe(true);
    expect(m.dataset.tone).toBe('fail');
    expect(m.getAttribute('aria-valuenow')).toBe('12');
    expect(q(el, '.m-text')).toBeNull();
    el.data = { value: 0.9 };
    el.renderNow();
    expect(meter(el).dataset.tone).toBe('done');
    expect(meter(el).getAttribute('aria-valuenow')).toBe('90');
    expect(meter(el).classList.contains('m-battery')).toBe(true);
    // A percent range through attributes.
    const pct = mount(undefined, { value: '82', max: '100', low: '50', high: '80', optimum: '0' });
    expect(meter(pct).getAttribute('aria-valuenow')).toBe('82');
    expect(meter(pct).dataset.tone).toBe('fail');
  });

  it('P3-4: a meter without a label is still named — by its words (the percent, or your text); the docs say to give one', () => {
    expect(meter(mount({ value: 0.72, ...LEFT })).getAttribute('aria-label')).toBe('72%');
    expect(meter(mount(undefined, { value: '0.5' })).getAttribute('aria-label')).toBe('50%');
    expect(meter(mount({ value: 3, max: 5, text: '3 of 5 accounts' })).getAttribute('aria-label')).toBe(
      '3 of 5 accounts',
    );
    expect(meter(mount({ value: 1, text: XSS })).getAttribute('aria-label')).toBe(XSS);
    // A label still wins; unknown stays "Unknown".
    expect(meter(mount({ value: 0.5, label: 'Left' })).getAttribute('aria-label')).toBe('Left');
    expect(meter(mount({ value: null })).getAttribute('aria-label')).toBe('Unknown');
    const a11y = doc.a11y.join(' ');
    expect(a11y).toMatch(/under low/i);
    expect(a11y).toMatch(/at or over high/i);
    expect(a11y).toMatch(/give it a label/i);
  });

  it('unknown: an image named "<label>: Unknown" (미확인 in Korean), a "?" and no fill', () => {
    const el = mount({ value: null, ...LEFT, label: 'Remaining usage' });
    const m = meter(el);
    expect(m.getAttribute('role')).toBe('img');
    expect(m.getAttribute('aria-label')).toBe('Remaining usage: Unknown');
    expect(m.hasAttribute('aria-valuenow')).toBe(false);
    expect(m.dataset.tone).toBe('idle');
    expect(q(el, '.m-fill')!.style.width).toBe('0%');
    expect(q(el, '.m-text')!.textContent).toBe('?');
    const ko = mount({ value: undefined, label: '모델 잔여량' }, { lang: 'ko' });
    expect(meter(ko).getAttribute('aria-label')).toBe('모델 잔여량: 미확인');
    const bare = mount({}, { lang: 'ko' });
    expect(meter(bare).getAttribute('aria-label')).toBe('미확인');
  });

  it('a new value patches in place: the same nodes, the fill moved, the words changed, the tone turned', () => {
    const el = mount({ value: 0.72, ...LEFT, label: 'Remaining usage' });
    const m = meter(el);
    const fill = q(el, '.m-fill')!;
    const text = q(el, '.m-text')!;
    el.data = { ...el.data, value: 0.15 };
    el.renderNow();
    expect(meter(el)).toBe(m);
    expect(q(el, '.m-fill')).toBe(fill);
    expect(q(el, '.m-text')).toBe(text);
    expect(fill.style.width).toBe('15%');
    expect(text.textContent).toBe('15%');
    expect(m.dataset.tone).toBe('fail');
    expect(m.getAttribute('aria-valuenow')).toBe('15');
    expect(m.getAttribute('aria-valuetext')).toBe('15%');
  });

  it('your own words stand beside the glyph and are what is read out; every string is escaped', () => {
    const el = mount({ value: 3, max: 5, low: 1, high: 3, label: `Free ${XSS}`, text: `3 of 5 ${XSS}` });
    const m = meter(el);
    expect(m.getAttribute('aria-valuetext')).toBe(`3 of 5 ${XSS}`);
    expect(m.getAttribute('aria-label')).toBe(`Free ${XSS}`);
    expect(q(el, '.m-text')!.textContent).toBe(`3 of 5 ${XSS}`);
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    expect(m.getAttribute('aria-valuenow')).toBe('60');
    expect(m.dataset.tone).toBe('done');
  });

  it('styles: the fill rides --dur-move, the tones are color-mixed toward ink, the bar width is --meter-w', () => {
    const css = (document.createElement('ui-meter') as UiMeter).shadowRoot!.querySelector('style')!.textContent ?? '';
    expect(css).toContain('transition: width var(--dur-move) var(--ease-out)');
    expect(css).toContain('.m[data-tone="done"] { --m-ink: color-mix(in srgb, var(--st-done) 70%, var(--ib-text)); }');
    expect(css).toContain(
      '.m[data-tone="fail"] { --m-ink: color-mix(in srgb, var(--st-fail-text) 70%, var(--ib-text)); }',
    );
    expect(css).toContain('width: var(--meter-w, 48px)');
    expect(css).not.toMatch(/@keyframes|infinite/);
  });
});
