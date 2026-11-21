import { define, UiElement } from '../../core/element';
import { icon } from '../../icons/icons';
import { clamp01, type VoiceLevelSource } from '../voice-glow/engine/audio';
import { EnvWatch, motionOf, motionReduced, pageHidden } from '../voice-glow/engine/env';
import '../voice-ring/voice-ring';
import type { UiVoiceRing, VoiceRingData, VoiceRingState, VoiceRingType } from '../voice-ring/voice-ring';
import type { VoiceSide } from './engine/stereo';
import { styles } from './styles';

export type { VoiceSide } from './engine/stereo';
export type VoiceDistance = 'near' | 'far';
export type VoicePositionLang = 'en' | 'ko';

/** What a detector says about the voice — any detector: a model, a stereo estimate, a diarised speaker's seat. */
export interface VoicePositionData {
  /** Where the voice is: left, front or right (`ahead` / `center` read as front); null while detecting. */
  side?: VoiceSide | 'ahead' | 'center' | null;
  /** How far: near (the phone within reach, under ~70 cm) or far (`small` / `large` are accepted); null while detecting. */
  distance?: VoiceDistance | 'small' | 'large' | null;
  /** How sure the side is, 0–1. Absent with a side, it is taken as sure (1). */
  sideConfidence?: number;
  /** How sure the distance is, 0–1. */
  distanceConfidence?: number;
  /** An angle to show beside the side, degrees (−180 … 180), if the detector has one. */
  angle?: number;
  /** The level the ring follows, 0–1: a number or a getter read every frame (or set the `level` property). */
  level?: VoiceLevelSource;
  /** A MediaStream the host opened, for the ring to follow (or set the `stream` property). Never stopped here. */
  stream?: MediaStream | null;
  /** The ring's state. @default 'listening' */
  state?: VoiceRingState | 'thinking';
  /** The ring's type. @default 'ring' */
  type?: VoiceRingType;
  /** More `<ui-voice-ring>` fields (emotion, sensitivity, the lean's amounts …), passed through. */
  ring?: Omit<VoiceRingData, 'level' | 'stream' | 'state' | 'type' | 'direction' | 'directionBounds' | 'decorative'>;
}

/** What the tile shows, resolved and clamped. */
export interface VoicePositionReading {
  side: VoiceSide | null;
  distance: VoiceDistance | null;
  sideConfidence: number;
  distanceConfidence: number;
  angle: number | null;
  /** Where the ring leans: −1 left … 1 right. */
  pan: number;
}

const STRINGS = {
  en: {
    live: 'LIVE',
    title: 'VOICE POSITION',
    direction: 'DIRECTION',
    distance: 'DISTANCE',
    detecting: 'Detecting',
    listening: 'Listening',
    ask: 'Ask anything',
    src: 'SRC',
    sides: { left: 'Left', front: 'Front', right: 'Right' } as Record<VoiceSide, string>,
    distances: { near: 'Near', far: 'Far' } as Record<VoiceDistance, string>,
    ranges: { near: '< 70 cm', far: '≥ 70 cm' } as Record<VoiceDistance, string>,
    sideSentence: (side: string, pct: string) => `Voice from the ${side.toLowerCase()}${pct}`,
    frontSentence: (pct: string) => `Voice from the front${pct}`,
    distanceSentence: (d: string, range: string, pct: string) => `${d.toLowerCase()}, ${range}${pct}`,
    none: 'Detecting where the voice is',
  },
  ko: {
    live: '실시간',
    title: '음성 위치',
    direction: '방향',
    distance: '거리',
    detecting: '감지 중',
    listening: '듣는 중',
    ask: '무엇이든 물어보세요',
    src: '음원',
    sides: { left: '왼쪽', front: '정면', right: '오른쪽' } as Record<VoiceSide, string>,
    distances: { near: '가까움', far: '멂' } as Record<VoiceDistance, string>,
    ranges: { near: '70 cm 미만', far: '70 cm 이상' } as Record<VoiceDistance, string>,
    sideSentence: (side: string, pct: string) => `${side}에서 들리는 목소리${pct}`,
    frontSentence: (pct: string) => `정면에서 들리는 목소리${pct}`,
    distanceSentence: (d: string, range: string, pct: string) => `${d}, ${range}${pct}`,
    none: '목소리의 위치를 감지하는 중',
  },
};

const PAN: Record<VoiceSide, number> = { left: -1, front: 0, right: 1 };
const DOTS = 18;
const GLYPHS = '01·:+×#<>/';

/** The side for a value: left · front · right (`ahead`, `center`, `centre` read as front); anything else is null. */
export function voiceSide(v: unknown): VoiceSide | null {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  if (s === 'left' || s === 'right' || s === 'front') return s;
  if (s === 'ahead' || s === 'center' || s === 'centre') return 'front';
  return null;
}

/** The distance for a value: near · far (`small` / `large` — the model's names — are accepted); else null. */
export function voiceDistance(v: unknown): VoiceDistance | null {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  if (s === 'near' || s === 'small') return 'near';
  if (s === 'far' || s === 'large') return 'far';
  return null;
}

function confidence(v: unknown, dflt: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? clamp01(n) : dflt;
}

/**
 * Where the ring leans for a side and how sure it is: full to the side when sure, half-way at no confidence, the
 * middle for front or nothing.
 */
export function leanFor(side: VoiceSide | null, sure = 1): number {
  if (!side) return 0;
  return PAN[side] * (0.5 + 0.5 * clamp01(sure));
}

/** Resolve the data and attributes into what the tile shows. */
export function readVoicePosition(
  d: VoicePositionData,
  attrs: { side?: unknown; distance?: unknown } = {},
): VoicePositionReading {
  const side = voiceSide(d.side === null ? null : (d.side ?? attrs.side));
  const distance = voiceDistance(d.distance === null ? null : (d.distance ?? attrs.distance));
  const sideConfidence = side ? confidence(d.sideConfidence, 1) : 0;
  const distanceConfidence = distance ? confidence(d.distanceConfidence, 1) : 0;
  const a = typeof d.angle === 'number' && Number.isFinite(d.angle) ? Math.max(-180, Math.min(180, d.angle)) : null;
  return {
    side,
    distance,
    sideConfidence,
    distanceConfidence,
    angle: side ? a : null,
    pan: leanFor(side, sideConfidence),
  };
}

/** A whole percentage, `··%` for nothing. */
export function percent(v: number): string {
  return v > 0 ? `${Math.round(clamp01(v) * 100)}%` : '··%';
}

/** An angle as the readout shows it: `+58°`, `−62°`, `±0°`, or `—`. */
export function angleText(a: number | null): string {
  if (a == null) return '—';
  const r = Math.round(a);
  return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r)}°`;
}

/** How many of the meter's 18 dots a confidence lights. */
export function litDots(v: number): number {
  return Math.round(clamp01(v) * DOTS);
}

/**
 * `<ui-voice-position>` — hear where the voice is: the voice ring on a voice screen leans toward where the voice comes
 * from (left / front / right), the composer bar under it grows when the voice is far, a marker shows the source, and
 * a readout gives the side and the distance with how sure each is.
 *
 * Data-driven: the host sets `{ side, distance, sideConfidence, distanceConfidence }` from any detector. The Voice
 * position model behind the Libraries.dev tile (`VoicePosition.mfxl`, iOS, Libraries.dev Model License) is not
 * shipped or downloaded; `createVoiceStereoSide()` (exported beside this) is a plain level-difference estimate for hosts
 * with a stereo microphone. The ring is a composed `<ui-voice-ring>` (its lean is voice-ring's `lean.ts`), held toward
 * the committed side until the next reading.
 *
 * Ported from Libraries.dev's Voice position page (MIT, © 2026 Jakub Antalik — https://libraries.dev/voice-position).
 */
export class UiVoicePosition extends UiElement<VoicePositionData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return ['side', 'distance', 'lang', 'theme', 'motion', 'paused'];
  }

  #root: HTMLElement | null = null;
  #ring: UiVoiceRing | null = null;
  #reading: VoicePositionReading = readVoicePosition({});
  #level: VoiceLevelSource | null = null;
  #stream: MediaStream | null = null;
  #seen: VoicePositionData | undefined;
  #visible = true;
  #io: IntersectionObserver | null = null;
  #env: EnvWatch;
  #scramble = new Map<HTMLElement, number>();

  constructor() {
    super();
    this.#env = new EnvWatch(this, () => this.requestRender());
  }

  attributeChangedCallback(_name: string, old: string | null, value: string | null): void {
    if (old !== value) this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#env.connect();
    if (typeof IntersectionObserver === 'function') {
      this.#io = new IntersectionObserver((entries) => {
        const e = entries[entries.length - 1];
        if (!e) return;
        this.#visible = e.isIntersecting;
        this.#still();
      });
      this.#io.observe(this);
    }
  }

  override disconnectedCallback(): void {
    this.#env.disconnect();
    this.#io?.disconnect();
    this.#io = null;
    for (const id of this.#scramble.values()) cancelAnimationFrame(id);
    this.#scramble.clear();
    super.disconnectedCallback();
  }

  /** The level the ring follows: a number, or a getter read every frame. Passed to the ring without a re-render. */
  get level(): VoiceLevelSource | null {
    return this.#level;
  }
  set level(value: VoiceLevelSource | null) {
    this.#level = value ?? null;
    if (this.#ring) this.#ring.level = this.#level;
  }

  /** A MediaStream the host opened, for the ring (which opens its own analyser and never stops the tracks). */
  get stream(): MediaStream | null {
    return this.#stream;
  }
  set stream(value: MediaStream | null) {
    this.#stream = value ?? null;
    if (this.#ring) this.#ring.stream = this.#stream;
  }

  get paused(): boolean {
    return this.hasAttribute('paused');
  }
  set paused(on: boolean) {
    this.toggleAttribute('paused', !!on);
  }

  /** What the tile shows now. */
  get reading(): VoicePositionReading {
    return this.#reading;
  }

  /** The composed ring. */
  get ring(): UiVoiceRing | null {
    return this.#ring;
  }

  get #lang(): VoicePositionLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #reduced(): boolean {
    return motionReduced(motionOf(this.getAttribute('motion')));
  }

  protected render(): string {
    const dots = Array.from({ length: DOTS }, () => '<i></i>').join('');
    return `<div class="vp" part="root">
  <div class="stage" part="stage" aria-hidden="true">
    <div class="screen" part="screen">
      <div class="ring"></div>
      <p class="status"></p>
      <div class="composer"><span class="ask"><span></span></span><span class="glass">${icon('mic', { size: 20 })}</span><span class="end">${icon('close', { size: 20 })}</span></div>
    </div>
    <div class="src" hidden><span class="line"></span><span class="box"></span><span class="tag"></span></div>
  </div>
  <div class="readout" part="readout" aria-hidden="true">
    <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
    <div class="head"><span class="live"></span><span class="title"></span></div>
    <div class="row"><span class="key" data-k="direction"></span><span class="value" data-v="side"></span><span class="read" data-r="side"></span></div>
    <div class="meter" data-m="side">${dots}<span class="pct"></span></div>
    <div class="row"><span class="key" data-k="distance"></span><span class="value" data-v="distance"></span><span class="read" data-r="distance"></span></div>
    <div class="meter" data-m="distance">${dots}<span class="pct"></span></div>
  </div>
  <span class="sr-only" role="status" aria-live="polite"></span>
</div>`;
  }

  /** Drawn once; every later render patches text and attributes in place, so the ring keeps running. */
  protected override update(): void {
    if (!this.#root) {
      this.content.innerHTML = this.render();
      this.#root = this.content.querySelector<HTMLElement>('.vp');
      const ring = document.createElement('ui-voice-ring');
      this.content.querySelector('.ring')?.append(ring);
      this.#ring = ring;
    }
    const d = this.data ?? {};
    if (d !== this.#seen) {
      this.#seen = d;
      if ('level' in d) this.#level = d.level ?? null;
      if ('stream' in d) this.#stream = d.stream ?? null;
    }
    const r = readVoicePosition(d, { side: this.getAttribute('side'), distance: this.getAttribute('distance') });
    const was = this.#reading;
    this.#reading = r;
    const t = STRINGS[this.#lang];
    const root = this.#root as HTMLElement;
    const q = <E extends Element = HTMLElement>(s: string) => root.querySelector<E>(s) as E;

    // The ring: held toward the committed side, bounded by the screen, hidden from assistive tech (the readout says it).
    const ring = this.#ring as UiVoiceRing;
    const theme = this.getAttribute('theme');
    if (theme) ring.setAttribute('theme', theme);
    else ring.removeAttribute('theme');
    const motion = this.getAttribute('motion');
    if (motion) ring.setAttribute('motion', motion);
    else ring.removeAttribute('motion');
    ring.toggleAttribute('paused', this.paused);
    ring.data = {
      directionMargin: 10,
      ...(d.ring ?? {}),
      size: 116,
      state: d.state ?? 'listening',
      type: d.type ?? 'ring',
      directionBounds: q('.screen'),
      holdDirection: true,
      decorative: true,
    };
    ring.level = this.#level;
    ring.stream = this.#stream;
    ring.direction = r.pan;

    q('.status').textContent = t.listening;
    q('.ask > span').textContent = t.ask;
    q('.composer').toggleAttribute('data-far', r.distance === 'far');

    // The source marker.
    const src = q('.src');
    const side = r.side ?? was.side;
    src.hidden = !side;
    if (side) src.dataset.side = side;
    src.toggleAttribute('data-detecting', !r.side);
    q('.tag').textContent = r.side
      ? `${t.src} · ${t.sides[r.side].toUpperCase()}${r.distance ? ` · ${t.distances[r.distance].toUpperCase()}` : ''}`
      : `${t.src} · ${t.detecting.toUpperCase()}`;

    // The readout.
    q('.live').textContent = t.live;
    q('.title').textContent = t.title;
    q('[data-k="direction"]').textContent = t.direction;
    q('[data-k="distance"]').textContent = t.distance;
    this.#value(q('[data-v="side"]'), r.side ? t.sides[r.side] : t.detecting, !r.side);
    this.#value(q('[data-v="distance"]'), r.distance ? t.distances[r.distance] : t.detecting, !r.distance);
    q('[data-r="side"]').textContent = angleText(r.angle);
    q('[data-r="distance"]').textContent = r.distance ? t.ranges[r.distance] : '—';
    this.#meter(q('[data-m="side"]'), r.sideConfidence);
    this.#meter(q('[data-m="distance"]'), r.distanceConfidence);

    // The text equivalent: one sentence, said only when the side or the distance changes — a detector's confidence
    // moves with every estimate, and a live region rewritten that often is noise. The confidence it carries is the
    // one at the change.
    const said = `${this.#lang}|${r.side ?? ''}|${r.distance ?? ''}`;
    if (said !== this.#saidKey) {
      this.#saidKey = said;
      q('[role="status"]').textContent = this.#sentence(r);
    }
    this.#still();
    this.updated();
  }

  #saidKey = '';

  /** The sentence for a reading: side, then distance, each with how sure. */
  #sentence(r: VoicePositionReading): string {
    const t = STRINGS[this.#lang];
    const pct = (v: number) => (v > 0 ? ` (${percent(v)})` : '');
    let sentence: string = t.none;
    if (r.side) {
      sentence =
        r.side === 'front'
          ? t.frontSentence(pct(r.sideConfidence))
          : t.sideSentence(t.sides[r.side], pct(r.sideConfidence));
      if (r.distance)
        sentence += `; ${t.distanceSentence(t.distances[r.distance], t.ranges[r.distance], pct(r.distanceConfidence))}`;
      sentence += '.';
    }
    return sentence;
  }

  #still(): void {
    const root = this.#root;
    if (!root) return;
    root.toggleAttribute('data-still', this.paused || !this.#visible || pageHidden());
    root.toggleAttribute('data-reduce', this.#reduced);
  }

  #meter(m: HTMLElement, v: number): void {
    const lit = litDots(v);
    const dots = m.querySelectorAll('i');
    dots.forEach((dot, i) => {
      dot.toggleAttribute('data-on', i < lit);
      dot.style.transitionDelay = `${i * 22}ms`;
    });
    const pct = m.querySelector('.pct');
    if (pct) pct.textContent = percent(v);
  }

  /** A value that decodes into place: each character cycles a few glyphs, then settles (text nodes only). */
  #value(el: HTMLElement, text: string, pending: boolean): void {
    el.toggleAttribute('data-pending', pending);
    if (el.dataset.text === text) return;
    el.dataset.text = text;
    const running = this.#scramble.get(el);
    if (running) cancelAnimationFrame(running);
    this.#scramble.delete(el);
    if (this.#reduced || !this.isConnected) {
      el.textContent = text;
      el.removeAttribute('data-scrambling');
      return;
    }
    const start = performance.now();
    const chars = Array.from(text);
    const tick = (now: number) => {
      const t = now - start;
      const done = Math.min(chars.length, Math.floor(Math.max(0, t - 60) / 42));
      let out = chars.slice(0, done).join('');
      for (let i = done; i < chars.length; i++) {
        out += chars[i] === ' ' ? ' ' : GLYPHS[Math.floor((t / 50 + i * 7) % GLYPHS.length)];
      }
      el.textContent = out;
      el.toggleAttribute('data-scrambling', done < chars.length);
      if (done < chars.length) this.#scramble.set(el, requestAnimationFrame(tick));
      else this.#scramble.delete(el);
    };
    this.#scramble.set(el, requestAnimationFrame(tick));
  }
}

define('ui-voice-position', UiVoicePosition);

declare global {
  interface HTMLElementTagNameMap {
    'ui-voice-position': UiVoicePosition;
  }
}
