import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { attrs, esc, safeSrc } from '../../core/html';
import { morphInto } from '../../core/morph';
import { icon } from '../../icons/icons';
import { styles } from './styles';

/** One side of the comparison. */
export interface CompareImage {
  /** The picture: http(s), a relative URL, `blob:` or a base64 raster `data:image/…` (anything else: "No preview"). */
  src: string;
  /** What the picture shows ("The session card before the owner badge"). */
  alt: string;
  /** The corner tag (default Before / After): a version, a branch, a date. */
  label?: string;
}

/** `cover` fills the box and crops; `contain` shows each picture whole. */
export type ImageCompareFit = 'cover' | 'contain';
export type ImageCompareLang = 'en' | 'ko';

export interface ImageCompareData {
  before: CompareImage;
  after: CompareImage;
  /** Where the line sits, 0 … 1: the share of the box that shows BEFORE, from the left (default 0.5). */
  position?: number;
  /** The box's CSS aspect-ratio (default `16 / 10`). */
  ratio?: string;
  fit?: ImageCompareFit;
}

/** `ui-change` detail: where the line settled, 0 … 1. */
export interface ImageCompareChange {
  position: number;
}

/** The words for the two sides. */
export interface CompareLabels {
  before: string;
  after: string;
}

/** Arrow keys move the line 5%, Page Up / Page Down 20%. */
export const COMPARE_STEP = 0.05;
export const COMPARE_PAGE = 0.2;
/** A release faster than this (px/ms, over the last 80ms) is a flick: the line glides on. */
export const COMPARE_FLICK = 0.5;
/** A flick carries the line as far as its speed would in this long — a scroll view's normal deceleration. */
export const COMPARE_THROW_MS = 500;
/** The glide: this long, ease-out. */
export const COMPARE_GLIDE_MS = 420;
/** The speed at release is measured over this window. */
const VELOCITY_MS = 80;
/** A press that moves the line less than this is not a jump (no tap). */
const JUMP = 0.01;
/** A tag fades when the line comes within this many px of it. */
const TAG_GAP = 8;
/**
 * A press gives the knob focus without a ring (the ring is for the keyboard): `focusVisible` — Chrome, Firefox,
 * Safari 18.4; older browsers ignore it. Not in TypeScript's DOM types yet.
 */
const PRESS_FOCUS = { preventScroll: true, focusVisible: false } as FocusOptions;
const RATIO = /^\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?$/;

export const COMPARE_STRINGS = {
  en: { before: 'Before', after: 'After', label: 'Compare before and after', none: 'No preview' },
  ko: { before: '이전', after: '이후', label: '이전과 이후 비교', none: '미리보기 없음' },
};

/** A finite number clamped to 0 … 1; the middle for anything else. */
function unit(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5;
}

/** A position from data or an attribute, clamped — or undefined when it is not a number. */
function readPosition(v: unknown): number | undefined {
  if (v === null || v === undefined || (typeof v === 'string' && !v.trim())) return undefined;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? unit(n) : undefined;
}

/** The line's place under a pointer at `clientX` over a box at `rect`, 0 … 1 (clamped; the middle for a box with no width). */
export function comparePosition(clientX: number, rect: { left: number; width: number }): number {
  if (!(rect.width > 0) || !Number.isFinite(clientX)) return 0.5;
  return unit((clientX - rect.left) / rect.width);
}

/**
 * Where a release sends the line: a flick (faster than `COMPARE_FLICK` px/ms) glides on toward the edge it was
 * thrown at, as far as its speed carries it in `COMPARE_THROW_MS` — a quick one reaches the edge — clamped 0 … 1.
 * Slower than that, the line stays where it was let go.
 */
export function compareGlide(position: number, velocityPxPerMs: number, width: number): number {
  const p = unit(position);
  if (!(width > 0) || !(Math.abs(velocityPxPerMs) >= COMPARE_FLICK)) return p;
  return unit(p + (velocityPxPerMs * COMPARE_THROW_MS) / width);
}

/**
 * The slider's keys: ← / ↓ 5% toward After, → / ↑ 5% toward Before, Page Down / Page Up 20%, Home 0, End 1 — on
 * whole percents, clamped. null for any other key.
 */
export function compareKey(key: string, position: number): number | null {
  const p = unit(position);
  const by = (d: number) => unit(Math.round((p + d) * 100) / 100);
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return by(-COMPARE_STEP);
    case 'ArrowRight':
    case 'ArrowUp':
      return by(COMPARE_STEP);
    case 'PageDown':
      return by(-COMPARE_PAGE);
    case 'PageUp':
      return by(COMPARE_PAGE);
    case 'Home':
      return 0;
    case 'End':
      return 1;
    default:
      return null;
  }
}

/** The slider's words: "Before 40% · After 60%" (whole percents that add up to 100). */
export function compareText(position: number, labels: Partial<CompareLabels> = {}): string {
  const b = Math.round(unit(position) * 100);
  const s = COMPARE_STRINGS.en;
  return `${labels.before ?? s.before} ${b}% · ${labels.after ?? s.after} ${100 - b}%`;
}

/** A CSS aspect-ratio the box may take ("16 / 10", "9/16", "1.6"); the default for anything else. */
function ratioOf(v: unknown): string {
  const s = String(v ?? '').trim();
  return RATIO.test(s) ? s.replace(/\s*\/\s*/, ' / ') : '16 / 10';
}

/** The `--pos` value: a percent with two decimals at most. */
function pct(p: number): string {
  return `${Math.round(p * 10000) / 100}%`;
}

/** Where the tags end and begin in the box (px), measured at the start of each press and after each render. */
interface TagEdges {
  width: number;
  before: number;
  after: number;
}

/** Which tags the line is near (they fade): within 8px of them — before there is a layout, in the outer fifth. */
function tagsNear(p: number, e: TagEdges | null): { before: boolean; after: boolean } {
  if (!e) return { before: p < 0.2, after: p > 0.8 };
  const x = p * e.width;
  return { before: x < e.before + TAG_GAP, after: x > e.after - TAG_GAP };
}

/** The speed (px/ms) over the last 80ms of a drag: 0 when the pointer rested there. */
function releaseSpeed(samples: Array<{ x: number; t: number }>): number {
  const last = samples[samples.length - 1];
  const first = samples.find((s) => last.t - s.t <= VELOCITY_MS);
  if (!first || first === last) return 0;
  const dt = last.t - first.t;
  return dt > 0 ? (last.x - first.x) / dt : 0;
}

interface Drag {
  id: number;
  rect: { left: number; width: number };
  /** Where the line was when the press began: a cancelled press puts it back. */
  from: number;
  /** A press on the knob keeps its grip: the line does not jump under it. */
  offset: number;
  /** A touch waits for its first move (or a tap's release) to move the line — a vertical swipe scrolls the page. */
  touch: boolean;
  moved: boolean;
  samples: Array<{ x: number; t: number }>;
}

/**
 * `<ui-image-compare>` — two pictures of the same thing in one box, split by a line: Before on the left of it,
 * After on the right. Press anywhere and the line jumps there and follows the pointer; let go with a flick and it
 * glides on toward that edge (ease-out, 420ms; not under reduced motion). The knob is a slider (arrows 5%, Page keys
 * 20%, Home / End). The corner tags (Before / After, or the host's labels) fade when the line comes near them. A
 * picture whose source is unsafe or fails to load shows "No preview". `ui-change { position }` reports where the
 * line settled — once per drag, glide or key, never on every move.
 *
 * Ported from bencho.dev's “Image compare” (MIT, © 2026 Lorenzo Cabra — https://bencho.dev/blocks/image-compare).
 */
export class UiImageCompare extends UiElement<ImageCompareData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return ['lang', 'position'];
  }

  /** The line while a drag or a glide moves it (painted in place, no render); null when it rests on `data`. */
  #live: number | null = null;
  #drag: Drag | null = null;
  #raf = 0;
  #edges: TagEdges | null = null;
  /** Sources that failed to load: "No preview" from then on. */
  readonly #broken = new Set<string>();

  constructor() {
    super();
    const r = this.root;
    r.addEventListener('pointerdown', (e) => this.#onDown(e as PointerEvent));
    r.addEventListener('pointermove', (e) => this.#onMove(e as PointerEvent));
    r.addEventListener('pointerup', (e) => this.#onUp(e as PointerEvent));
    r.addEventListener('pointercancel', (e) => this.#onCancel(e as PointerEvent));
    r.addEventListener('lostpointercapture', (e) => this.#onLost(e as PointerEvent));
    r.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    // `error` does not bubble: catch it on the way down.
    r.addEventListener(
      'error',
      (e) => {
        const el = e.target as Element | null;
        if (el?.tagName !== 'IMG') return;
        // The attribute reads decoded (`&`); the render compares the escaped form `safeSrc` drew (`&amp;`).
        const raw = el.getAttribute('src') ?? '';
        const src = safeSrc(raw) || raw;
        if (!src || this.#broken.has(src)) return;
        this.#broken.add(src);
        this.requestRender();
      },
      true,
    );
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stop();
    this.#drag = null;
    this.#live = null;
  }

  /** Where the line is now, 0 … 1 — mid-drag and mid-glide too. */
  get position(): number {
    return this.#live ?? this.#source;
  }

  /** Where `data` (then the `position` attribute, then the middle) puts the line. */
  get #source(): number {
    return readPosition(this.data?.position) ?? readPosition(this.getAttribute('position')) ?? 0.5;
  }

  get #lang(): ImageCompareLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #labels(): CompareLabels {
    const s = COMPARE_STRINGS[this.#lang];
    const d = this.data;
    return {
      before: String(d?.before?.label ?? '').trim() || s.before,
      after: String(d?.after?.label ?? '').trim() || s.after,
    };
  }

  /** Patched in place: the nodes stay, so focus, a held knob and the tags' fades survive a new `data`. */
  protected override update(): void {
    morphInto(this.content, this.render());
    this.updated();
  }

  protected override updated(): void {
    this.#measure();
    this.#paintTags(this.position);
  }

  protected render(): string {
    const d = this.data;
    if (!d) return '';
    const s = COMPARE_STRINGS[this.#lang];
    const labels = this.#labels;
    const p = this.position;
    const near = tagsNear(p, this.#edges);
    const knob = attrs({
      class: 'cmp-knob',
      part: 'knob',
      role: 'slider',
      tabindex: 0,
      'data-key': 'knob',
      'aria-label': s.label,
      'aria-orientation': 'horizontal',
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'aria-valuenow': Math.round(p * 100),
      'aria-valuetext': compareText(p, labels),
    });
    const tag = (side: 'before' | 'after') =>
      `<span class="cmp-tag is-${side}" part="tag ${side}-tag"${near[side] ? ' data-near' : ''}>${esc(labels[side])}</span>`;
    const box = attrs({
      class: 'cmp',
      part: 'box',
      'data-fit': d.fit === 'contain' ? 'contain' : 'cover',
      style: `--pos: ${pct(p)}; aspect-ratio: ${ratioOf(d.ratio)}`,
    });
    // Each tag comes right before its picture, so a reader hears "Before", then what the picture shows.
    return [
      `<div${box}>`,
      tag('before'),
      `<div class="cmp-before" part="before">${this.#image(d.before, s.none)}</div>`,
      tag('after'),
      `<div class="cmp-after" part="after">${this.#image(d.after, s.none)}</div>`,
      '<span class="cmp-line" part="line" aria-hidden="true"></span>',
      `<span${knob}>${icon('chevron-left')}${icon('chevron-right')}</span>`,
      '</div>',
    ].join('');
  }

  #image(img: Partial<CompareImage> | undefined, none: string): string {
    const safe = safeSrc(img?.src);
    const src = safe && !this.#broken.has(safe) ? safe : '';
    const alt = String(img?.alt ?? '');
    if (!src) {
      const name = alt.trim() ? `${alt} — ${none}` : none;
      return `<span class="cmp-none" part="none" role="img"${attrs({ 'aria-label': name })}><span class="cmp-none-in">${icon('image')}<span>${esc(none)}</span></span></span>`;
    }
    return `<img class="cmp-img" src="${src}"${attrs({ alt })} loading="lazy" decoding="async" draggable="false">`;
  }

  // ── painting in place ─────────────────────────────────────────────────────

  /** Read the box and the tags (one layout read): at a press, a key and after a render — never per move. */
  #measure(): void {
    const box = this.$('.cmp');
    const b = this.$('.cmp-tag.is-before');
    const a = this.$('.cmp-tag.is-after');
    const width = box?.clientWidth ?? 0;
    this.#edges =
      width > 0 && b && a && b.offsetWidth > 0
        ? { width, before: b.offsetLeft + b.offsetWidth, after: a.offsetLeft }
        : null;
  }

  /** Move the line, the knob's value and the tags without a render. */
  #paint(p: number): void {
    const box = this.$('.cmp');
    if (!box) return;
    box.style.setProperty('--pos', pct(p));
    const knob = this.$('.cmp-knob');
    if (knob) {
      const now = String(Math.round(p * 100));
      if (knob.getAttribute('aria-valuenow') !== now) {
        knob.setAttribute('aria-valuenow', now);
        knob.setAttribute('aria-valuetext', compareText(p, this.#labels));
      }
    }
    this.#paintTags(p);
  }

  #paintTags(p: number): void {
    const near = tagsNear(p, this.#edges);
    this.$('.cmp-tag.is-before')?.toggleAttribute('data-near', near.before);
    this.$('.cmp-tag.is-after')?.toggleAttribute('data-near', near.after);
  }

  #set(p: number): void {
    this.#live = p;
    this.#paint(p);
  }

  /** The line came to rest: keep it in `data` and report it — once, and only when it moved. */
  #settle(): void {
    const p = this.#live;
    this.#live = null;
    if (p === null || p === this.#source) return;
    // On top of the latest data; a ui-change listener that sets a position of its own wins.
    if (this.data) this.data = { ...this.data, position: p };
    this.notify<ImageCompareChange>('ui-change', { position: p });
  }

  // ── glide ─────────────────────────────────────────────────────────────────

  #glide(from: number, to: number): void {
    const t0 = performance.now();
    const step = (t: number): void => {
      const k = Math.min(1, Math.max(0, (t - t0) / COMPARE_GLIDE_MS));
      this.#set(k >= 1 ? to : from + (to - from) * (1 - (1 - k) ** 3));
      if (k < 1) {
        this.#raf = requestAnimationFrame(step);
        return;
      }
      this.#raf = 0;
      this.#settle();
    };
    this.#raf = requestAnimationFrame(step);
  }

  /** Stop a glide where it is (a new press, a key, disconnect). */
  #stop(): void {
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#raf = 0;
  }

  // ── pointer ───────────────────────────────────────────────────────────────

  #onDown(e: PointerEvent): void {
    if (this.#drag || e.button !== 0) return;
    const t = e.target as Element | null;
    const box = t?.closest?.<HTMLElement>('.cmp');
    if (!box || box.getRootNode() !== this.root) return;
    const rect = box.getBoundingClientRect();
    if (!(rect.width > 0)) return;
    this.#stop();
    this.#measure();
    const from = this.position;
    const offset = t?.closest?.('.cmp-knob') ? rect.left + from * rect.width - e.clientX : 0;
    const touch = e.pointerType === 'touch';
    try {
      box.setPointerCapture(e.pointerId);
    } catch {
      // a synthetic or already-gone pointer: the drag still works while the pointer stays on the box
    }
    const x = e.clientX + offset;
    this.#drag = {
      id: e.pointerId,
      rect: { left: rect.left, width: rect.width },
      from,
      offset,
      touch,
      moved: false,
      samples: [{ x, t: performance.now() }],
    };
    this.#live = from;
    box.setAttribute('data-held', '');
    if (touch) return;
    // No text selection, no native image drag; the knob takes focus so the keys carry on from here.
    e.preventDefault();
    this.$('.cmp-knob')?.focus(PRESS_FOCUS);
    const p = comparePosition(x, this.#drag.rect);
    this.#set(p);
    if (Math.abs(p - from) >= JUMP) this.sound('tap', { emphasis: 'subtle' }, e);
  }

  #onMove(e: PointerEvent): void {
    const d = this.#drag;
    if (!d || e.pointerId !== d.id) return;
    const x = e.clientX + d.offset;
    const t = performance.now();
    d.samples.push({ x, t });
    while (d.samples.length > 2 && t - d.samples[0].t > VELOCITY_MS * 2) d.samples.shift();
    d.moved = true;
    this.#set(comparePosition(x, d.rect));
  }

  #onUp(e: PointerEvent): void {
    const d = this.#drag;
    if (!d || e.pointerId !== d.id) return;
    this.#end(d);
    const x = e.clientX + d.offset;
    d.samples.push({ x, t: performance.now() });
    const p = comparePosition(x, d.rect);
    const tap = d.touch && !d.moved;
    this.#set(p);
    if (d.touch) this.$('.cmp-knob')?.focus(PRESS_FOCUS);
    if (tap && Math.abs(p - d.from) >= JUMP) this.sound('tap', { emphasis: 'subtle' }, e);
    const still = tap || prefersReducedMotion() || typeof requestAnimationFrame !== 'function';
    const to = still ? p : compareGlide(p, releaseSpeed(d.samples), d.rect.width);
    if (to !== p) this.#glide(p, to);
    else this.#settle();
  }

  /** The page took the touch (a scroll): the line goes back to where the press found it. */
  #onCancel(e: PointerEvent): void {
    const d = this.#drag;
    if (!d || e.pointerId !== d.id) return;
    this.#end(d);
    this.#set(d.from);
    this.#settle();
  }

  /** Capture lost without a release: the line stays where it is. */
  #onLost(e: PointerEvent): void {
    const d = this.#drag;
    if (!d || e.pointerId !== d.id) return;
    this.#end(d);
    this.#settle();
  }

  #end(d: Drag): void {
    this.#drag = null;
    const box = this.$('.cmp');
    box?.removeAttribute('data-held');
    try {
      box?.releasePointerCapture(d.id);
    } catch {
      // not captured
    }
  }

  // ── keyboard ──────────────────────────────────────────────────────────────

  #onKey(e: KeyboardEvent): void {
    if (e.altKey || e.ctrlKey || e.metaKey || this.#drag) return;
    if (!(e.target as Element | null)?.closest?.('.cmp-knob')) return;
    const next = compareKey(e.key, this.position);
    if (next === null) return;
    e.preventDefault();
    this.#stop();
    this.#measure();
    this.#set(next);
    this.#settle();
  }
}

define('ui-image-compare', UiImageCompare);

declare global {
  interface HTMLElementTagNameMap {
    'ui-image-compare': UiImageCompare;
  }
}
