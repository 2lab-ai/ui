import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audioHolds } from '../voice-glow/engine/audio';
import { type Clock, FakeAudioContext, fakeStream, stubAudio, stubFrames, XSS } from '../voice-glow/fixtures';
import { doc } from './docs';
import { bandPower, createStereoSide, estimateSide } from './engine/stereo';
import {
  angleText,
  leanFor,
  litDots,
  percent,
  readVoicePosition,
  type UiVoicePosition,
  type VoicePositionData,
  voiceDistance,
  voiceSide,
} from './voice-position';

let clock: Clock;

beforeEach(() => {
  document.body.innerHTML = '';
  clock = stubFrames();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount(attrs: Record<string, string> = {}, data?: VoicePositionData): UiVoicePosition {
  const el = document.createElement('ui-voice-position');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (data) el.data = data;
  document.body.append(el);
  el.renderNow();
  return el;
}
const q = (el: UiVoicePosition, s: string) => el.shadowRoot!.querySelector<HTMLElement>(s)!;
const status = (el: UiVoicePosition) => q(el, '[role="status"]').textContent;
/** Let the decode animation finish. */
const settle = () => clock.settle(200);

describe('the stereo estimate (not the model)', () => {
  it('equal levels read front; a louder channel reads its side, surer the bigger the difference', () => {
    const f = estimateSide(0.1, 0.1)!;
    expect(f.side).toBe('front');
    expect(f.ild).toBeCloseTo(0, 6);
    expect(f.confidence).toBeCloseTo(1, 6);
    const r = estimateSide(0.05, 0.1)!;
    expect(r.side).toBe('right');
    expect(r.ild).toBeCloseTo(6.02, 1);
    expect(r.pan).toBeGreaterThan(0);
    const l = estimateSide(0.3, 0.05)!;
    expect(l.side).toBe('left');
    expect(l.pan).toBeLessThan(0);
    expect(l.confidence).toBeGreaterThan(r.confidence);
    expect(l.confidence).toBeLessThanOrEqual(1);
    expect(estimateSide(0.1, 0.11)!.side).toBe('front');
  });

  it('silence and bad input have no side', () => {
    expect(estimateSide(0, 0)).toBeNull();
    expect(estimateSide(0.001, 0.0015)).toBeNull();
    expect(estimateSide(Number.NaN, 0.1)).toBeNull();
    expect(estimateSide(-1, 0.1)).toBeNull();
    expect(estimateSide(0.001, 0.0015, { floor: 0 })).not.toBeNull();
  });

  it('options: a wider dead band, a closer full side', () => {
    expect(estimateSide(0.05, 0.1, { deadband: 8 })!.side).toBe('front');
    expect(estimateSide(0.05, 0.1, { full: 6 })!.confidence).toBeGreaterThan(estimateSide(0.05, 0.1)!.confidence);
  });

  it('bandPower: dB bins to mean linear power over a band', () => {
    const db = new Float32Array(1024).fill(Number.NEGATIVE_INFINITY);
    db.fill(-20, 40, 180);
    // 48 kHz / 2048 → 23.4375 Hz a bin: 1–4 kHz reads bins 42…171
    expect(bandPower(db, 23.4375, 1000, 4000)).toBeCloseTo(0.01, 6);
    expect(bandPower(db, 0, 1000, 4000)).toBe(0);
    expect(bandPower(new Float32Array(0), 23.4, 1000, 4000)).toBe(0);
  });

  it('createStereoSide: a splitter and two analysers on the shared source; release closes, tracks stay', () => {
    expect(createStereoSide(fakeStream())).toBeNull();
    stubAudio();
    const s = fakeStream();
    const reader = createStereoSide(s)!;
    expect(reader).not.toBeNull();
    const ctx = FakeAudioContext.all[0];
    expect(ctx.splitters).toHaveLength(1);
    expect(ctx.analysers).toHaveLength(2);
    const [l, r] = ctx.analysers;
    (l as unknown as { getFloatFrequencyData: (o: Float32Array) => void }).getFloatFrequencyData = (o) => o.fill(-40);
    (r as unknown as { getFloatFrequencyData: (o: Float32Array) => void }).getFloatFrequencyData = (o) => o.fill(-30);
    const est = reader.read()!;
    expect(est.side).toBe('right');
    expect(est.ild).toBeCloseTo(10, 5);
    // a mono input: one live channel, one silent — no side
    (r as unknown as { getFloatFrequencyData: (o: Float32Array) => void }).getFloatFrequencyData = (o) =>
      o.fill(Number.NEGATIVE_INFINITY);
    expect(reader.read()).toBeNull();
    expect(audioHolds()).toBe(1);
    reader.release();
    reader.release();
    expect(audioHolds()).toBe(0);
    expect(ctx.closed).toBe(1);
    expect(s.tracks[0].stopped).toBe(0);
    expect(reader.read()).toBeNull();
  });
});

describe('reading helpers', () => {
  it('sides and distances, with the aliases', () => {
    expect(voiceSide('LEFT')).toBe('left');
    expect(voiceSide('ahead')).toBe('front');
    expect(voiceSide('center')).toBe('front');
    expect(voiceSide('up')).toBeNull();
    expect(voiceDistance('small')).toBe('near');
    expect(voiceDistance('Large')).toBe('far');
    expect(voiceDistance('70cm')).toBeNull();
  });

  it('the lean: full when sure, half at no confidence, none for front or nothing', () => {
    expect(leanFor('left', 1)).toBe(-1);
    expect(leanFor('right', 0)).toBe(0.5);
    expect(leanFor('front', 1)).toBe(0);
    expect(leanFor(null, 1)).toBe(0);
    expect(leanFor('right', 9)).toBe(1);
  });

  it('readVoicePosition clamps confidences, defaults them to sure, drops the angle without a side', () => {
    const r = readVoicePosition({ side: 'right', distance: 'large', sideConfidence: 4, angle: 400 });
    expect(r).toEqual({ side: 'right', distance: 'far', sideConfidence: 1, distanceConfidence: 1, angle: 180, pan: 1 });
    expect(readVoicePosition({}, { side: 'left' }).side).toBe('left');
    expect(readVoicePosition({ side: null }, { side: 'left' }).side).toBeNull();
    const none = readVoicePosition({ sideConfidence: 0.9, angle: 20 });
    expect(none.sideConfidence).toBe(0);
    expect(none.angle).toBeNull();
    expect(readVoicePosition({ side: 'left', sideConfidence: Number.NaN }).sideConfidence).toBe(1);
  });

  it('percent, angleText and litDots', () => {
    expect(percent(0.856)).toBe('86%');
    expect(percent(0)).toBe('··%');
    expect(angleText(58)).toBe('+58°');
    expect(angleText(-62.4)).toBe('−62°');
    expect(angleText(0)).toBe('±0°');
    expect(angleText(null)).toBe('—');
    expect(litDots(1)).toBe(18);
    expect(litDots(0.5)).toBe(9);
    expect(litDots(-1)).toBe(0);
  });
});

describe('<ui-voice-position>', () => {
  it('renders the screen with a composed, decorative ring, the readout, and a status sentence', () => {
    const el = mount();
    const ring = el.ring!;
    expect(ring.localName).toBe('ui-voice-ring');
    expect(q(el, '.screen').contains(ring)).toBe(true);
    expect(ring.data?.decorative).toBe(true);
    expect(ring.data?.holdDirection).toBe(true);
    expect(ring.data?.directionBounds).toBe(q(el, '.screen'));
    expect(q(el, '.stage').getAttribute('aria-hidden')).toBe('true');
    expect(q(el, '.readout').getAttribute('aria-hidden')).toBe('true');
    expect(status(el)).toBe('Detecting where the voice is');
    expect(q(el, '.src').hidden).toBe(true);
    expect(el.shadowRoot!.querySelectorAll('.meter i')).toHaveLength(36);
  });

  it('a reading: the ring leans that way, the readout and the sentence say it, the meter fills', () => {
    const el = mount(
      {},
      { side: 'left', distance: 'near', sideConfidence: 0.86, distanceConfidence: 0.74, angle: -62 },
    );
    settle();
    expect(el.ring!.direction).toBeCloseTo(-0.93, 6);
    expect(q(el, '[data-v="side"]').textContent).toBe('Left');
    expect(q(el, '[data-v="distance"]').textContent).toBe('Near');
    expect(q(el, '[data-r="side"]').textContent).toBe('−62°');
    expect(q(el, '[data-r="distance"]').textContent).toBe('< 70 cm');
    expect(q(el, '[data-m="side"] .pct').textContent).toBe('86%');
    expect(q(el, '[data-m="side"]').querySelectorAll('i[data-on]')).toHaveLength(15);
    expect(status(el)).toBe('Voice from the left (86%); near, < 70 cm (74%).');
    expect(q(el, '.src').dataset.side).toBe('left');
    expect(q(el, '.src').hasAttribute('data-detecting')).toBe(false);
    expect(q(el, '.composer').hasAttribute('data-far')).toBe(false);
  });

  it('far grows the bar; front centres the ring; back to detecting holds the marker where it was', () => {
    const el = mount({}, { side: 'right', distance: 'far' });
    expect(q(el, '.composer').hasAttribute('data-far')).toBe(true);
    expect(el.ring!.direction).toBe(1);
    el.data = { side: 'front', distance: 'far', sideConfidence: 0.7 };
    el.renderNow();
    expect(el.ring!.direction).toBe(0);
    settle();
    expect(status(el)).toBe('Voice from the front (70%); far, ≥ 70 cm (100%).');
    el.data = { side: null, distance: null };
    el.renderNow();
    expect(q(el, '.src').hidden).toBe(false);
    expect(q(el, '.src').dataset.side).toBe('front');
    expect(q(el, '.src').hasAttribute('data-detecting')).toBe(true);
    settle();
    expect(q(el, '[data-v="side"]').textContent).toBe('Detecting');
    expect(q(el, '[data-v="side"]').hasAttribute('data-pending')).toBe(true);
    expect(q(el, '[data-m="side"] .pct').textContent).toBe('··%');
  });

  it('attributes work too', () => {
    const el = mount({ side: 'right', distance: 'small' });
    expect(el.reading.side).toBe('right');
    expect(el.reading.distance).toBe('near');
  });

  it('values decode into place, and land as text', () => {
    const el = mount({}, { side: 'right' });
    const v = q(el, '[data-v="side"]');
    clock.step(80);
    expect(v.hasAttribute('data-scrambling')).toBe(true);
    expect(v.textContent).not.toBe('Right');
    settle();
    expect(v.textContent).toBe('Right');
    expect(v.hasAttribute('data-scrambling')).toBe(false);
  });

  it('reduced motion: no decoding, still loops', () => {
    clock.reduce = true;
    const el = mount({}, { side: 'right' });
    expect(q(el, '[data-v="side"]').textContent).toBe('Right');
    expect(q(el, '.vp').hasAttribute('data-reduce')).toBe(true);
    clock.reduce = false;
    const pinned = mount({ motion: 'reduce' }, { side: 'left' });
    expect(q(pinned, '[data-v="side"]').textContent).toBe('Left');
    expect(pinned.ring!.getAttribute('motion')).toBe('reduce');
  });

  it('lang="ko"', () => {
    const el = mount({ lang: 'ko' }, { side: 'left', distance: 'far', sideConfidence: 0.9, distanceConfidence: 0.8 });
    settle();
    expect(q(el, '[data-v="side"]').textContent).toBe('왼쪽');
    expect(q(el, '[data-k="direction"]').textContent).toBe('방향');
    expect(q(el, '.status').textContent).toBe('듣는 중');
    expect(status(el)).toBe('왼쪽에서 들리는 목소리 (90%); 멂, 70 cm 이상 (80%).');
  });

  it('host strings never become markup: unknown sides are ignored, ring fields pass as data', () => {
    const el = mount({}, { side: XSS as 'left', distance: XSS as 'near', ring: { label: XSS } });
    expect(el.reading.side).toBeNull();
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    expect(el.ring!.data?.label).toBe(XSS);
  });

  it('level and stream go to the ring; theme and paused too', () => {
    const el = mount({ theme: 'light', paused: '' });
    const getter = () => 0.4;
    el.level = getter;
    expect(el.ring!.level).toBe(getter);
    const s = fakeStream();
    el.stream = s;
    expect(el.ring!.stream).toBe(s);
    expect(el.ring!.getAttribute('theme')).toBe('light');
    expect(el.ring!.hasAttribute('paused')).toBe(true);
    expect(q(el, '.vp').hasAttribute('data-still')).toBe(true);
    const viaData = mount({}, { level: 0.3, stream: s, state: 'thinking', type: 'mono', ring: { emotion: 'calm' } });
    expect(viaData.ring!.level).toBe(0.3);
    expect(viaData.ring!.stream).toBe(s);
    expect(viaData.ring!.data?.state).toBe('thinking');
    expect(viaData.ring!.data?.type).toBe('mono');
    expect(viaData.ring!.data?.emotion).toBe('calm');
  });

  it('with a stream, disconnect closes the ring’s analyser and context, never the tracks', () => {
    stubAudio();
    const s = fakeStream();
    const el = mount({}, { stream: s });
    el.ring!.renderNow();
    expect(audioHolds()).toBe(1);
    el.remove();
    expect(audioHolds()).toBe(0);
    expect(FakeAudioContext.all[0].closed).toBe(1);
    expect(s.tracks[0].stopped).toBe(0);
  });

  it('disconnect cancels the decoding frames', () => {
    const el = mount({}, { side: 'left' });
    expect(clock.frames.size).toBeGreaterThan(0);
    el.remove();
    expect(clock.frames.size).toBe(0);
  });
});

describe('docs', () => {
  it('an Effects entry with a reference and at least three demos that build offline', () => {
    vi.useFakeTimers();
    try {
      expect(doc.group).toBe('Effects');
      expect(doc.tag).toBe('ui-voice-position');
      expect(doc.reference.url).toBe('https://libraries.dev/voice-position');
      expect(doc.demos.length).toBeGreaterThanOrEqual(3);
      for (const d of doc.demos) {
        const node = d.create();
        document.body.append(node);
        expect(node.localName === 'ui-voice-position' || node.querySelector('ui-voice-position')).toBeTruthy();
        node.remove();
      }
      vi.runOnlyPendingTimers();
    } finally {
      vi.useRealTimers();
    }
  });
});
