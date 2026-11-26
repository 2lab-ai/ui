import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyReading } from '../mood/engine/core';
import type { MoodReading } from '../mood/engine/types';
import '../mood/mood';
import type { UiMood } from '../mood/mood';
import { doc } from './docs';
import { brackets, clearance, hudFmt, OneEuro, onSquare } from './engine/hud';
import { hudReadingOf, hudTargetText, type UiMoodHud } from './mood-hud';

const XSS = '<img src=x onerror=alert(1)>';

let frames: Map<number, FrameRequestCallback>;
let frameId = 0;
let clock = 0;
let reduce = false;

class FakeIO {
  static all: FakeIO[] = [];
  disconnected = false;
  constructor(readonly cb: IntersectionObserverCallback) {
    FakeIO.all.push(this);
  }
  observe() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
  disconnect() {
    this.disconnected = true;
  }
  fire(isIntersecting: boolean) {
    this.cb([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

beforeEach(() => {
  document.body.innerHTML = '';
  frames = new Map();
  frameId = 0;
  clock = 1000;
  reduce = false;
  FakeIO.all = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++frameId, cb);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('prefers-reduced-motion') ? reduce : false;
    },
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal('IntersectionObserver', FakeIO);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Run the frames that are queued, `ms` later. */
function flush(ms = 16) {
  clock += ms;
  const due = [...frames.entries()];
  frames.clear();
  for (const [, cb] of due) cb(clock);
}

function mount(
  html = '<ui-mood baseline-key=""><ui-mood-hud><button id="pay" disabled>Pay</button></ui-mood-hud></ui-mood>',
) {
  document.body.innerHTML = html;
  const hud = document.querySelector('ui-mood-hud') as UiMoodHud;
  hud.renderNow();
  return { hud, mood: document.querySelector('ui-mood') as UiMood };
}

const move = (el: Element, x = 40, y = 30) =>
  el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, composed: true, clientX: x, clientY: y }));

describe('HUD geometry', () => {
  it('draws four corners round a box and finds points on a square', () => {
    const d = brackets({ x: 0, y: 0, w: 20, h: 20 }, 6);
    expect(d.match(/M/g)).toHaveLength(4);
    expect(d.startsWith('M0 6V0H6')).toBe(true);
    const p = onSquare(Math.PI / 4, 10);
    expect(Math.max(Math.abs(p.x), Math.abs(p.y))).toBeCloseTo(10, 5);
    expect(clearance({ x: 20, y: -2, w: 4, h: 4 }, 0, 0, 10)).toBe(10);
    expect(clearance({ x: -2, y: -2, w: 4, h: 4 }, 0, 0, 10)).toBeLessThan(0);
    expect(hudFmt(0.4123)).toBe('.412');
  });

  it('smooths the pointer: steady when slow, catching up when fast', () => {
    const f = new OneEuro(3, 0.02);
    expect(f.filter(0, 1 / 60)).toBe(0);
    let v = 0;
    for (let i = 0; i < 60; i++) v = f.filter(100, 1 / 60);
    expect(v).toBeGreaterThan(95);
  });
});

describe('readout', () => {
  const reading = (over: Partial<MoodReading>): MoodReading => ({ ...emptyReading(0), ...over });

  it('maps a reading to L C A F and I, with the names in the HUD’s language', () => {
    const r = reading({ mood: 'lost', score: 0.5, scores: { frustrated: 0.1, confused: 0.2, lost: 0.5 }, fast: 0.3 });
    expect(hudReadingOf(r)).toMatchObject({ name: 'lost', lead: 'lost', probs: [0.5, 0.2, 0, 0.1], instant: 0.3 });
    expect(hudReadingOf(reading({ away: true, mood: 'away' }), 'ko')).toMatchObject({
      name: '자리 비움',
      probs: [0, 0, 1, 0],
    });
    expect(hudReadingOf(reading({}), 'ko').name).toBe('평온');
  });

  it('names a control by tag, id, role and state', () => {
    expect(hudTargetText({ tag: 'button', id: 'pay', role: '', disabled: true, invalid: false })).toBe(
      'button#pay · disabled',
    );
    expect(hudTargetText({ tag: 'span', id: '', role: 'button', disabled: false, invalid: true }, 'ko')).toBe(
      'span[button] · 잘못됨',
    );
    expect(hudTargetText(null)).toBeNull();
  });
});

describe('<ui-mood-hud>', () => {
  it('wraps the markup in a slot, with an aria-hidden layer that takes no pointer input', () => {
    const { hud, mood } = mount();
    expect(hud.shadowRoot?.querySelector('slot')).not.toBeNull();
    const layer = hud.shadowRoot?.querySelector('.hud-layer') as HTMLElement;
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(hud.shadowRoot?.querySelector('style')?.textContent).toContain('pointer-events: none');
    expect(hud.mood).toBe(mood);
  });

  it('binds to the mood named by `for`', async () => {
    document.body.innerHTML = '<ui-mood id="a" baseline-key=""></ui-mood><ui-mood-hud for="a"></ui-mood-hud>';
    const hud = document.querySelector('ui-mood-hud') as UiMoodHud;
    await Promise.resolve();
    expect(hud.mood?.id).toBe('a');
    hud.setAttribute('for', 'nope');
    expect(hud.mood).toBeNull();
  });

  it('draws only while the pointer is over it, and stops after it leaves and the dust settles', () => {
    const { hud } = mount();
    expect(hud.running).toBe(false);
    move(document.getElementById('pay') as HTMLElement);
    expect(hud.running).toBe(true);
    flush();
    const root = hud.shadowRoot?.querySelector('.mood-hud') as HTMLElement;
    expect(root.classList.contains('is-away')).toBe(false);
    expect(hud.shadowRoot?.querySelector('.hud-name')?.textContent).toBe('NEUTRAL-0.00');
    hud.dispatchEvent(new PointerEvent('pointerleave'));
    flush();
    expect(root.classList.contains('is-away')).toBe(true);
    for (let i = 0; i < 70; i++) flush();
    expect(hud.running).toBe(false);
  });

  it('stops while resting calm, off screen or in a hidden tab', () => {
    const { hud } = mount();
    move(hud);
    flush();
    for (let i = 0; i < 300; i++) flush();
    expect(hud.running).toBe(false);
    move(hud);
    expect(hud.running).toBe(true);
    FakeIO.all[0].fire(false);
    flush();
    expect(hud.running).toBe(false);
  });

  it('shows the reading and names the fought-with control as text, never as markup', () => {
    const { hud, mood } = mount();
    const btn = hud.querySelector('button') as HTMLButtonElement;
    btn.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: 10, clientY: 10, button: 0 }),
    );
    const reading: MoodReading = {
      ...emptyReading(0),
      mood: 'frustrated',
      score: 0.9,
      reaction: 1,
      scores: { frustrated: 0.9, confused: 0, lost: 0 },
      fast: 0.9,
      fastKind: 'disabled',
      alert: true,
      target: { tag: 'button', id: XSS, role: '', disabled: true, invalid: false },
    };
    mood.dispatchEvent(new CustomEvent('ui-mood-reading', { detail: reading }));
    flush();
    const at = hud.shadowRoot?.querySelector('.hud-at') as HTMLElement;
    expect(at.hidden).toBe(false);
    expect(at.textContent).toBe(`▸ button#${XSS} · disabled`);
    expect(hud.shadowRoot?.querySelector('img')).toBeNull();
    expect(hud.shadowRoot?.querySelector('.hud-name')?.textContent).toBe('FRUSTRATED-0.90');
    expect(hud.shadowRoot?.querySelector('.mood-hud')?.getAttribute('data-lead')).toBe('frustrated');
    // the press on the disabled control stays as a square with a dot
    expect(hud.shadowRoot?.querySelector('.hud-red-dots')?.getAttribute('d')).toMatch(/^M/);
  });

  it('draws no scan boxes, dust or waves with reduced motion', () => {
    reduce = true;
    const { hud } = mount();
    move(hud, 40, 30);
    flush();
    move(hud, 140, 30);
    hud.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 140, clientY: 30, button: 0 }));
    flush();
    expect(hud.shadowRoot?.querySelector('.hud-scan .hud-ink')?.getAttribute('d') ?? '').toBe('');
    const shown = [...(hud.shadowRoot?.querySelectorAll<SVGGElement>('.hud-wave, .hud-dust > g') ?? [])].filter(
      (g) => g.style.display !== 'none',
    );
    expect(shown).toHaveLength(0);
  });

  it('localises the readout with lang="ko"', () => {
    const { hud } = mount('<ui-mood baseline-key=""><ui-mood-hud lang="ko"><p>x</p></ui-mood-hud></ui-mood>');
    move(hud);
    flush();
    expect(hud.shadowRoot?.querySelector('.hud-name')?.textContent).toBe('평온-0.00');
  });

  it('draws again after it is moved in the DOM', () => {
    const { hud, mood } = mount();
    const other = document.createElement('div');
    document.body.append(other);
    other.append(mood);
    move(hud);
    expect(hud.running).toBe(true);
    flush();
    expect(hud.shadowRoot?.querySelectorAll('.mood-hud')).toHaveLength(1);
    expect(hud.shadowRoot?.querySelector('.hud-name')?.textContent).toBe('NEUTRAL-0.00');
  });

  it('starts calm under a <ui-mood> that is not upgraded yet', () => {
    document.body.innerHTML = '<ui-mood-later><ui-mood-hud><p>x</p></ui-mood-hud></ui-mood-later>';
    document.body.innerHTML = '<div id="w"></div>';
    const w = document.getElementById('w') as HTMLElement;
    const fake = document.createElement('ui-mood');
    Object.defineProperty(fake, 'reading', { value: undefined });
    const hud = document.createElement('ui-mood-hud');
    fake.append(hud);
    w.append(fake);
    expect(() => {
      move(hud);
      flush();
    }).not.toThrow();
  });

  it('a stale reading does not keep the frames going while the pointer rests', () => {
    const { hud, mood } = mount();
    move(hud);
    mood.dispatchEvent(
      new CustomEvent('ui-mood-reading', {
        detail: { ...emptyReading(clock), score: 0.2, scores: { frustrated: 0, confused: 0.2, lost: 0 } },
      }),
    );
    for (let i = 0; i < 300; i++) flush();
    expect(hud.running).toBe(false);
  });

  it('lets go of everything on disconnect', () => {
    const { hud, mood } = mount();
    move(hud);
    expect(hud.running).toBe(true);
    mood.remove();
    expect(hud.running).toBe(false);
    expect(FakeIO.all[0].disconnected).toBe(true);
    expect(hud.mood).toBeNull();
  });
});

describe('docs', () => {
  it('ships at least three demos', () => {
    expect(doc.tag).toBe('ui-mood-hud');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) {
      const el = d.create();
      document.body.append(el);
      expect(el.querySelector('ui-mood-hud')).not.toBeNull();
      el.remove();
    }
  });
});
