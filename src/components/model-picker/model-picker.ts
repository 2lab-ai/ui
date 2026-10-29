import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { esc, escAttr } from '../../core/html';
import { morphInto } from '../../core/morph';
import { styles } from './styles';

/** USD per million tokens. */
export interface ModelPrice {
  input: number;
  output: number;
}

/** One model the session can switch to. */
export interface PickerModel {
  /** What `ui-change` carries back (the host's switch key, e.g. `opus[1m]` or a full model id). */
  id: string;
  /** Display name, e.g. `Opus 5.5 (1M)`. */
  label: string;
  /** Compact name for the description line and the avatar letter (defaults: id / label). */
  short?: string;
  /** Context window in tokens. */
  window?: number;
  /** The model's own auto-compact threshold in tokens. */
  autoCompactAt?: number;
  /** Price per million tokens; `null` / missing = unknown (never guessed). */
  price?: ModelPrice | null;
  /** Effort levels this model runs, in order. Missing = the five standard levels; `[]` = no effort control. */
  effortLevels?: string[];
  /** Override the 5-segment meters (0–5, 0 draws "—"). By default they are measured against the largest in the list. */
  bars?: { window?: number; compaction?: number; cost?: number };
}

export interface ModelPickerValue {
  /** The session's model id. When it is not in `models` it is shown as a first, unselectable row. */
  model: string;
  /** The effort level that was set. */
  effort?: string;
  /** The level that actually runs when the model caps the set one (e.g. set Max → runs High). */
  effectiveEffort?: string;
  /**
   * The levels the session's model runs, in order — used by the effort control in place of the current row's
   * `effortLevels`, also when the model is outside `models` (which otherwise offers the standard five).
   * `[]` = no effort control. Dropped from the optimistic value of a model switch (the new model has its own).
   */
  effortLevels?: string[];
}

export interface ModelPickerData {
  models: PickerModel[];
  value: ModelPickerValue;
  /** Tokens in the session's context now: a row whose auto-compact point is below it says it switches after compaction. */
  contextTokens?: number;
  /** `true` = read-only; a string = read-only with that reason (tooltip + description). */
  disabled?: boolean | string;
  /** A write in flight. `model`: rows locked (a string replaces the "Switching model…" line); `effort`: levels locked. */
  busy?: { model?: boolean | string; effort?: boolean };
  /** Last write failed — announced with role="alert" (inside the open menu, or under the trigger). */
  error?: string;
}

/** `ui-change` detail. */
export interface ModelPickerChange {
  model: string;
  effort?: string;
  /** Which of the two the person changed. */
  changed: 'model' | 'effort';
}

export type ModelMenuSide = 'top' | 'bottom';
export type ModelMeters = [window: number, compaction: number, cost: number];

/** The standard effort levels, in order (the dashboard's MODEL_EFFORT_LEVELS). */
export const MODEL_EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'];
const EFFORT_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
};
const EFFORT_SHORT: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', xhigh: 'XHigh', max: 'Max' };
const ROLL_MS = 560;
const WATCH_MS = 150;

const STRINGS = {
  en: {
    model: 'Model',
    trigger: (name: string, level: string) => `Model ${name}${level ? `, effort ${level}` : ''} — change`,
    dialog: 'Model and effort for this session',
    head: 'This session model',
    cols: ['Window', 'Compact', 'Cost'],
    list: 'Models',
    after: 'switches after compaction',
    outside: 'Current · not in the switch list',
    outsideTray: 'Not in the switch list · price unknown',
    outsideSr: 'Not in the switch list, price unknown',
    win: (w: string) => `window ${w}`,
    winSr: (w: string) => `window ${w}`,
    tray: (i: string, o: string) => `Input ${i} · Output ${o} / M`,
    noPrice: 'Price —',
    priceWords: (i: string, o: string) => `input ${i} · output ${o} per million tokens`,
    noPriceWords: 'price unknown',
    switching: 'Switching model…',
    effort: 'Effort',
    cap: (set: string, runs: string) => `Set ${set} → this model runs ${runs}`,
  },
  ko: {
    model: '모델',
    trigger: (name: string, level: string) => `모델 ${name}${level ? `, effort ${level}` : ''} — 바꾸기`,
    dialog: '이 세션의 모델 · effort',
    head: '이 세션 모델',
    cols: ['창', '압축', '비용'],
    list: '모델',
    after: 'compact 후 전환',
    outside: '현재 · 전환 목록 밖',
    outsideTray: '전환 목록 밖 모델 · 가격 정보 없음',
    outsideSr: '전환 목록 밖 모델, 가격 정보 없음',
    win: (w: string) => `창 ${w}`,
    winSr: (w: string) => `창 ${w}`,
    tray: (i: string, o: string) => `입력 ${i} · 출력 ${o} / M`,
    noPrice: '가격 정보 없음',
    priceWords: (i: string, o: string) => `입력 ${i} · 출력 ${o} / 백만 토큰`,
    noPriceWords: '가격 정보 없음',
    switching: '모델 전환 중…',
    effort: 'Effort',
    cap: (set: string, runs: string) => `설정 ${set} → 이 모델은 ${runs}까지 실행`,
  },
};
type Strings = (typeof STRINGS)['en'];

const CHECK = '&#x2713;';

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Filled segments of a 5-segment meter: `v` against the largest of the list, at least 1; 0 when unknown. */
export function meterSegments(v: unknown, max: unknown): number {
  const a = num(v);
  const m = num(max);
  if (!(a > 0) || !(m > 0)) return 0;
  return Math.max(1, Math.min(5, Math.round((5 * a) / m)));
}

function barOr(v: unknown, fallback: number): number {
  if (v === undefined || v === null) return fallback;
  return Math.max(0, Math.min(5, Math.round(num(v))));
}

/** A price both of whose numbers are real, else null (unknown stays unknown). */
export function validModelPrice(p: ModelPrice | null | undefined): ModelPrice | null {
  if (!p) return null;
  const input = Number(p.input);
  const output = Number(p.output);
  return Number.isFinite(input) && Number.isFinite(output) && input >= 0 && output >= 0 ? { input, output } : null;
}

/** Window · compaction · cost meters per model: the host's `bars`, else against the list's largest value. */
export function modelMeters(models: PickerModel[]): ModelMeters[] {
  let win = 0;
  let ac = 0;
  let out = 0;
  for (const m of models) {
    win = Math.max(win, num(m.window));
    ac = Math.max(ac, num(m.autoCompactAt));
    out = Math.max(out, validModelPrice(m.price)?.output ?? 0);
  }
  return models.map((m) => {
    const p = validModelPrice(m.price);
    return [
      barOr(m.bars?.window, meterSegments(m.window, win)),
      barOr(m.bars?.compaction, meterSegments(m.autoCompactAt, ac)),
      barOr(m.bars?.cost, p ? meterSegments(p.output, out) : 0),
    ];
  });
}

/** Token counts the way the dashboard's model menu shows them: 950 · 450.0K · 1.0M. */
export function fmtModelTokens(n: unknown): string {
  let v = Math.max(0, num(n));
  if (v < 999.5) return String(Math.round(v));
  for (const unit of ['K', 'M', 'B', 'T']) {
    v /= 1000;
    if (v < 999.95) return `${v.toFixed(1)}${unit}`;
  }
  return '999.9T+';
}

/** Dollars, whole when the target is whole: $5, $2.50 (a rolling value keeps its target's form). */
export function fmtModelPrice(v: unknown, ref?: unknown): string {
  const n = num(v);
  const t = ref === undefined ? n : num(ref);
  return `$${Math.round(t) === t ? String(Math.round(n)) : n.toFixed(2)}`;
}

/** The effort levels a model runs: its own list (deduped), the standard five when it has none, [] = no control. */
export function modelEffortLevels(model?: PickerModel | null): string[] {
  if (!model || !Array.isArray(model.effortLevels)) return MODEL_EFFORT_LEVELS.slice();
  const out: string[] = [];
  for (const l of model.effortLevels) {
    const s = String(l ?? '');
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

export function modelEffortLabel(level?: string): string {
  return level ? (EFFORT_LABELS[level] ?? level) : '';
}

/** The avatar letter: first character of the short name (or label), upper-cased. */
export function modelGlyph(m: { short?: string; label?: string; id?: string }): string {
  const src = String(m.short || m.label || m.id || '?');
  return (Array.from(src)[0] ?? '?').toUpperCase();
}

/** Below this much room on the chosen side the menu covers its trigger instead of turning into a short scroller. */
const MIN_ROOM = 180;

/**
 * Where the menu goes (viewport px): under (`bottom`) or over (`top`) the trigger, flipped when that side
 * has no room and the other has more, left edge on the trigger's, kept 12px inside the viewport. When the
 * chosen side is too short for the whole menu it gets that side's height and scrolls (`maxHeight`), so the
 * trigger stays visible; only when even that is under 180px does it slide over the trigger.
 */
export function placeModelMenu(
  r: { top: number; bottom: number; left: number },
  w: number,
  h: number,
  vw: number,
  vh: number,
  side: ModelMenuSide = 'bottom',
): { left: number; top: number; side: ModelMenuSide; maxHeight: number } {
  const gap = 6;
  const edge = 12;
  const below = vh - r.bottom - gap - edge;
  const above = r.top - gap - edge;
  const s: ModelMenuSide =
    side === 'top' ? (h > above && below > above ? 'bottom' : 'top') : h > below && above > below ? 'top' : 'bottom';
  const room = s === 'top' ? above : below;
  const full = Math.max(0, vh - 2 * edge);
  const fit = h > room && room >= MIN_ROOM ? room : Math.min(h, full);
  const left = Math.max(edge, Math.min(r.left, vw - edge - w));
  let top = s === 'top' ? r.top - gap - fit : r.bottom + gap;
  top = Math.max(edge, Math.min(top, vh - edge - fit));
  return {
    left: Math.round(left),
    top: Math.round(top),
    side: s,
    maxHeight: Math.floor(h > room && room >= MIN_ROOM ? room : full),
  };
}

export interface AnchorSpot {
  left: number;
  top: number;
}

function flatParent(n: Element): Element | null {
  if (n.assignedSlot) return n.assignedSlot;
  const p = n.parentNode;
  if (!p) return null;
  if (p.nodeType === 11) return (p as ShadowRoot).host ?? null;
  return p.nodeType === 1 ? (p as Element) : null;
}

/**
 * The trigger's place in its layout: its viewport position plus the scroll offsets of every ancestor up to
 * (and including) the first `position: fixed` one, crossing shadow roots. Scrolling leaves it unchanged —
 * also a page scroll under a fixed panel — so only a layout move (a card that changed column) changes it.
 */
export function anchorSpot(el: Element): AnchorSpot {
  const r = el.getBoundingClientRect();
  let x = r.left;
  let y = r.top;
  for (let n = flatParent(el); n; n = flatParent(n)) {
    x += n.scrollLeft || 0;
    y += n.scrollTop || 0;
    if (getComputedStyle(n).position === 'fixed') break;
  }
  return { left: x, top: y };
}

/** The anchor moved more than 2px in its layout. */
export function anchorMoved(at: AnchorSpot | null, now: AnchorSpot | null): boolean {
  if (!at || !now) return false;
  return Math.abs(now.left - at.left) > 2 || Math.abs(now.top - at.top) > 2;
}

interface Opt {
  /** The model id; '' for the session's own model when it is outside the list. */
  key: string;
  model: PickerModel;
  listed: boolean;
  meters: ModelMeters;
}

/** The rows: the session's model first when it is not in the list (current, not selectable), then the list. */
function pickerOptions(d: ModelPickerData): Opt[] {
  const seen = new Set<string>();
  const models: PickerModel[] = [];
  for (const m of Array.isArray(d.models) ? d.models : []) {
    if (!m || typeof m.id !== 'string' || !m.id || seen.has(m.id)) continue;
    seen.add(m.id);
    models.push(m);
  }
  const meters = modelMeters(models);
  const cur = d.value?.model ?? '';
  const out: Opt[] = [];
  if (cur && !seen.has(cur)) out.push({ key: '', model: { id: cur, label: cur }, listed: false, meters: [0, 0, 0] });
  models.forEach((m, i) => {
    out.push({ key: m.id, model: m, listed: true, meters: meters[i] });
  });
  return out;
}

function currentIndex(opts: Opt[], cur: string): number {
  if (!cur) return -1;
  return opts.findIndex((o) => o.key === '' || o.key === cur);
}

/**
 * `<ui-model-picker>` — one trigger (avatar · model · effort · chevron) that opens the session's model menu:
 * every model with its window, auto-compact point and cost as 5-segment meters, the effort levels that model
 * runs, and a tray with the price. Picking a model or a level sends a cancelable `ui-change`.
 */
export class UiModelPicker extends UiElement<ModelPickerData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang', 'open', 'side'];
  }

  #open = false;
  #reflecting = false;
  #activeKey: string | null = null;
  #pointing = false;
  #shown: ModelPrice | null = null;
  #raf = 0;
  #placeRaf = 0;
  #watch = 0;
  #attached = false;
  #at: AnchorSpot | null = null;
  #last: AnchorSpot | null = null;
  #pos: { left: number; top: number; side: ModelMenuSide; maxHeight: number } | null = null;

  constructor() {
    super();
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    this.root.addEventListener('pointerover', (e) => this.#onPointer(e as PointerEvent));
    this.root.addEventListener('pointerout', (e) => this.#onPointerOut(e as PointerEvent));
  }

  /** Whether the menu is open. Setting it opens/closes without moving focus and without `ui-open-change`. */
  get open(): boolean {
    return this.#open;
  }

  set open(v: boolean) {
    this.#setOpen(!!v, { user: false });
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === 'open') {
      if (!this.#reflecting) this.#setOpen(value !== null, { user: false });
      return;
    }
    this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.#open) this.#attach();
  }

  override disconnectedCallback(): void {
    this.#detach();
  }

  get #t(): Strings {
    return this.getAttribute('lang') === 'ko' ? STRINGS.ko : STRINGS.en;
  }

  get #side(): ModelMenuSide {
    return this.getAttribute('side') === 'top' ? 'top' : 'bottom';
  }

  #off(): boolean {
    return !!this.data?.disabled;
  }

  #opts(): Opt[] {
    return this.data ? pickerOptions(this.data) : [];
  }

  /** The active row: the model last pointed at while it is still listed, else the session's model. */
  #activeIndex(opts: Opt[], cur: number): number {
    const i = this.#activeKey === null ? -1 : opts.findIndex((o) => o.key === this.#activeKey);
    return i >= 0 ? i : Math.max(cur, 0);
  }

  // ── open / close ──────────────────────────────────────────────────────────

  #setOpen(v: boolean, o: { user: boolean; focusList?: boolean; returnFocus?: boolean }): void {
    if (v === this.#open) {
      if (v && o.focusList) this.#focusList();
      return;
    }
    if (v) {
      if (this.#off()) {
        this.#reflect(false); // a read-only picker never opens, also not by attribute
        return;
      }
      // Every open starts on the session's model, unlit.
      this.#open = true;
      this.#activeKey = null;
      this.#pointing = false;
      this.#shown = null;
      this.#at = null;
      this.#last = null;
      this.#reflect(true);
      if (this.isConnected) {
        this.renderNow();
        if (!this.#open) return; // it closed itself while placing (the trigger is off-screen)
        this.#attach();
        if (o.focusList) this.#focusList();
      }
    } else {
      // Focus goes home first, while the menu is still open (no focus lost when it turns inert under it).
      if (o.returnFocus) this.$('.mp-trigger')?.focus();
      this.#open = false;
      this.#pointing = false;
      this.#at = null;
      this.#last = null;
      this.#reflect(false);
      this.#detach();
      if (this.isConnected) this.renderNow();
    }
    if (o.user) this.emit('ui-open-change', { open: v });
  }

  #reflect(v: boolean): void {
    if (this.hasAttribute('open') === v) return;
    this.#reflecting = true;
    this.toggleAttribute('open', v);
    this.#reflecting = false;
  }

  #focusList(): void {
    this.$('.mp-list')?.focus({ preventScroll: true });
  }

  readonly #onOutside = (e: Event): void => {
    if (this.#open && !e.composedPath().includes(this)) this.#setOpen(false, { user: true });
  };

  readonly #onViewport = (): void => this.#queuePlace();

  readonly #tick = (): void => {
    if (!this.#open) return;
    const trig = this.$('.mp-trigger');
    if (!trig) return;
    if (!this.#at) {
      this.#place();
      return;
    }
    const r = trig.getBoundingClientRect();
    if ((!r.width && !r.height) || anchorMoved(this.#at, anchorSpot(trig))) {
      // The anchor left its place (another column, a reflow): close instead of pointing at the old spot.
      this.#setOpen(false, { user: true });
      return;
    }
    // A scroll the document never heard of (inside another shadow root) still moves the menu along.
    if (!this.#last || r.left !== this.#last.left || r.top !== this.#last.top) this.#place();
  };

  #attach(): void {
    if (this.#attached || !this.#open || !this.isConnected) return;
    this.#attached = true;
    document.addEventListener('pointerdown', this.#onOutside, true);
    document.addEventListener('focusin', this.#onOutside);
    document.addEventListener('scroll', this.#onViewport, { capture: true, passive: true });
    window.addEventListener('resize', this.#onViewport);
    this.#watch = window.setInterval(this.#tick, WATCH_MS);
    this.#queuePlace();
  }

  #detach(): void {
    if (this.#attached) {
      document.removeEventListener('pointerdown', this.#onOutside, true);
      document.removeEventListener('focusin', this.#onOutside);
      document.removeEventListener('scroll', this.#onViewport, { capture: true });
      window.removeEventListener('resize', this.#onViewport);
      this.#attached = false;
    }
    clearInterval(this.#watch);
    this.#watch = 0;
    if (this.#placeRaf) cancelAnimationFrame(this.#placeRaf);
    this.#placeRaf = 0;
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#raf = 0;
  }

  #queuePlace(): void {
    if (!this.#open || this.#placeRaf || typeof requestAnimationFrame !== 'function') return;
    this.#placeRaf = requestAnimationFrame(() => {
      this.#placeRaf = 0;
      this.#place();
    });
  }

  /**
   * Fixed positioning from the trigger's rect. The menu is `position: fixed`, so the open card's clip never
   * cuts it; when an ancestor is a containing block for fixed elements (a transform, a filter) the probe —
   * a fixed 100px box at 0,0 — tells its origin and scale and the viewport position is mapped into it.
   */
  #place(): void {
    if (!this.#open || !this.isConnected) return;
    const trig = this.$('.mp-trigger');
    const pop = this.$('.mp-pop');
    const probe = this.$('.mp-probe');
    if (!trig || !pop) return;
    const r = trig.getBoundingClientRect();
    if (!r.width && !r.height) {
      if (this.#at) this.#setOpen(false, { user: true });
      return; // not laid out yet — the watch tries again
    }
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) {
      this.#setOpen(false, { user: true });
      return;
    }
    const o = probe?.getBoundingClientRect();
    const k = o && o.width > 0 ? o.width / 100 : 1;
    const ox = o?.left ?? 0;
    const oy = o?.top ?? 0;
    // scrollHeight: the whole menu, also while a max-height from the last placement caps it.
    const p = placeModelMenu(r, pop.offsetWidth * k, pop.scrollHeight * k, vw, vh, this.#side);
    this.#pos = {
      left: Math.round((p.left - ox) / k),
      top: Math.round((p.top - oy) / k),
      side: p.side,
      maxHeight: Math.floor(p.maxHeight / k),
    };
    pop.style.left = `${this.#pos.left}px`;
    pop.style.top = `${this.#pos.top}px`;
    pop.style.maxHeight = `${this.#pos.maxHeight}px`;
    pop.setAttribute('data-side', p.side);
    this.#last = { left: r.left, top: r.top };
    if (!this.#at) this.#at = anchorSpot(trig);
  }

  // ── picks ─────────────────────────────────────────────────────────────────

  /** A row picks its model — by id, never by position. The current row only closes; locked rows do nothing. */
  #pickKey(key: string): void {
    const d = this.data;
    if (!d || this.#off()) return;
    const opts = this.#opts();
    const i = opts.findIndex((o) => o.key === key);
    if (i < 0) return;
    if (i === currentIndex(opts, d.value?.model ?? '')) {
      this.#setOpen(false, { user: true, returnFocus: true });
      return;
    }
    const o = opts[i];
    if (!o.listed || d.busy?.model) return;
    this.#setOpen(false, { user: true, returnFocus: true });
    const detail: ModelPickerChange = { model: o.model.id, effort: d.value?.effort, changed: 'model' };
    // Optimistic value on top of the LATEST data: a listener may have set busy/error synchronously; if it set a
    // value of its own, that value wins.
    if (this.emit('ui-change', detail) && this.data && this.data.value === d.value)
      this.data = { ...this.data, value: { model: o.model.id, effort: d.value?.effort } };
  }

  /** A level keeps the menu open (it is a setting of the same choice). */
  #pickEffort(level: string): void {
    const d = this.data;
    if (!d || this.#off() || d.busy?.effort || !level || level === d.value?.effort) return;
    const model = d.value?.model ?? '';
    const detail: ModelPickerChange = { model, effort: level, changed: 'effort' };
    if (this.emit('ui-change', detail) && this.data && this.data.value === d.value)
      this.data = { ...this.data, value: { model, effort: level, effortLevels: d.value?.effortLevels } };
  }

  // ── input ─────────────────────────────────────────────────────────────────

  #onClick(e: Event): void {
    const t = e.target as Element | null;
    if (!t?.closest) return;
    if (t.closest('.mp-trigger')) {
      if (this.#off()) return;
      const opening = !this.#open;
      this.#setOpen(opening, { user: true, focusList: opening, returnFocus: !opening });
      return;
    }
    if (!this.#open) return;
    const opt = t.closest('.mp-opt');
    if (opt) {
      this.#pickKey(opt.getAttribute('data-k') ?? '');
      return;
    }
    const b = t.closest('.mp-seg-btn');
    if (b && b.parentElement?.getAttribute('aria-disabled') !== 'true')
      this.#pickEffort(b.getAttribute('data-effort') ?? '');
  }

  #onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (!t?.closest) return;
    if (t.closest('.mp-trigger')) {
      this.#triggerKey(e);
      return;
    }
    if (!t.closest('.mp-pop') || !this.#open) return;
    // Every key inside the menu stays in it (no page shortcut, no outer Escape).
    e.stopPropagation();
    const onList = t.classList.contains('mp-list');
    if (e.key === 'Escape') {
      e.preventDefault();
      this.#setOpen(false, { user: true, returnFocus: true });
    } else if (e.key === 'Tab') {
      // Two stops, moved by the menu itself: the list, then the checked level. Past either end the menu closes,
      // back on its trigger — a non-modal menu never keeps focus, and a later Esc still lands on the trigger.
      e.preventDefault();
      const level = this.$('.mp-seg-btn[tabindex="0"]');
      const list = this.$('.mp-list');
      if (onList && !e.shiftKey && level) level.focus();
      else if (!onList && e.shiftKey && list) list.focus();
      else this.#setOpen(false, { user: true, returnFocus: true });
    } else if (onList) {
      this.#listKey(e);
    } else {
      const radio = t.closest<HTMLElement>('.mp-seg-btn');
      if (radio) this.#effortKey(e, radio);
    }
  }

  /** ↓ / ↑ on the trigger open the menu (Enter and Space are the button's own click); Esc closes it. */
  #triggerKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.#open) {
      e.preventDefault();
      e.stopPropagation();
      this.#setOpen(false, { user: true, returnFocus: true });
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    if (this.#off()) return;
    this.#setOpen(true, { user: true, focusList: true });
  }

  /** ↑ ↓ (wrapping) · Home · End point at a row; Enter · Space pick it. */
  #listKey(e: KeyboardEvent): void {
    const opts = this.#opts();
    const n = opts.length;
    if (!n) return;
    const k = e.key;
    const cur = currentIndex(opts, this.data?.value?.model ?? '');
    if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Home' || k === 'End') {
      e.preventDefault();
      const i = k === 'Home' ? 0 : k === 'End' ? n - 1 : this.#activeIndex(opts, cur) + (k === 'ArrowDown' ? 1 : -1);
      this.#activeKey = opts[((i % n) + n) % n].key;
      this.#pointing = true;
      this.renderNow();
      // A menu capped to the room it has scrolls: keep the active row in view.
      this.$('.mp-opt[data-active]')?.scrollIntoView?.({ block: 'nearest' });
    } else if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      this.#pickKey(opts[this.#activeIndex(opts, cur)].key);
    }
  }

  /** Effort: the arrows move and select at once (radio pattern); Home · End. */
  #effortKey(e: KeyboardEvent, radio: HTMLElement): void {
    const group = radio.parentElement;
    if (!group) return;
    const btns = Array.from(group.querySelectorAll<HTMLElement>('.mp-seg-btn'));
    const n = btns.length;
    const i = btns.indexOf(radio);
    const k = e.key;
    const j =
      k === 'ArrowRight' || k === 'ArrowDown'
        ? i + 1
        : k === 'ArrowLeft' || k === 'ArrowUp'
          ? i - 1
          : k === 'Home'
            ? 0
            : k === 'End'
              ? n - 1
              : null;
    if (j === null || !n) return;
    e.preventDefault();
    if (group.getAttribute('aria-disabled') === 'true') return;
    const next = btns[((j % n) + n) % n];
    next.focus();
    this.#pickEffort(next.getAttribute('data-effort') ?? '');
  }

  /** The mouse points at a row: it lights, the others step back; leaving the list lets go. */
  #onPointer(e: PointerEvent): void {
    if (!this.#open || (e.pointerType && e.pointerType !== 'mouse')) return;
    const opt = (e.target as Element | null)?.closest?.('.mp-opt');
    if (!opt) return;
    const key = opt.getAttribute('data-k') ?? '';
    if (this.#pointing && this.#activeKey === key) return;
    this.#activeKey = key;
    this.#pointing = true;
    this.renderNow();
  }

  #onPointerOut(e: PointerEvent): void {
    if (!this.#open || !this.#pointing || (e.pointerType && e.pointerType !== 'mouse')) return;
    const list = this.$('.mp-list');
    const to = e.relatedTarget as Node | null;
    if (!list || !list.contains(e.target as Node) || (to && list.contains(to))) return;
    this.#pointing = false;
    this.renderNow();
  }

  // ── render ────────────────────────────────────────────────────────────────

  /** Patch the live tree instead of replacing it: the open/close transition, the thumb and focus survive. */
  protected override update(): void {
    morphInto(this.content, this.render());
    this.updated();
  }

  protected render(): string {
    const d = this.data;
    if (!d) return '';
    const t = this.#t;
    const v = d.value ?? { model: '' };
    const opts = pickerOptions(d);
    const cur = currentIndex(opts, v.model ?? '');
    const curOpt = cur >= 0 ? opts[cur] : null;
    const open = this.#open;
    const off = !!d.disabled;
    const why = typeof d.disabled === 'string' ? d.disabled : '';
    const busy = !!(d.busy?.model || d.busy?.effort);
    const name = curOpt ? curOpt.model.label || curOpt.model.id : t.model;
    const level = modelEffortLabel(v.effectiveEffort || v.effort);
    const pending = typeof d.busy?.model === 'string' ? d.busy.model : '';

    const trigger = `<button type="button" class="mp-trigger" part="trigger" data-key="mp-trigger" aria-haspopup="dialog" aria-expanded="${
      open ? 'true' : 'false'
    }" aria-controls="mp-menu" aria-label="${escAttr(t.trigger(name, level))}"${busy ? ' aria-busy="true"' : ''}${
      off ? ` aria-disabled="true"${why ? ` title="${escAttr(why)}" aria-describedby="mp-why"` : ''}` : ''
    }><span class="mp-glyph" aria-hidden="true">${esc(modelGlyph(curOpt ? curOpt.model : { label: name }))}</span><span class="mp-name">${esc(
      name,
    )}</span>${level ? `<span class="mp-level">&middot; ${esc(level)}</span>` : ''}<span class="mp-chev" aria-hidden="true"></span></button>`;

    return `<div class="mp">${trigger}${why ? `<span class="sr-only" id="mp-why">${esc(why)}</span>` : ''}
<div class="mp-note" role="status">${!open && pending ? esc(pending) : ''}</div>
<div class="mp-note is-error" role="alert">${!open && d.error ? esc(d.error) : ''}</div>
<i class="mp-probe" aria-hidden="true"></i>${this.#menu(d, opts, cur, t)}</div>`;
  }

  #menu(d: ModelPickerData, opts: Opt[], cur: number, t: Strings): string {
    const open = this.#open;
    const active = opts.length ? this.#activeIndex(opts, cur) : -1;
    const lit = this.#pointing ? active : cur;
    const used = num(d.contextTokens);
    const locked = !!d.busy?.model;
    const wait = typeof d.busy?.model === 'string' && d.busy.model ? d.busy.model : t.switching;
    const pos = this.#pos;
    let rows = '';
    opts.forEach((o, i) => {
      const m = o.model;
      const isCur = i === cur;
      const name = m.label || m.id;
      const ac = num(m.autoCompactAt);
      const win = num(m.window);
      const price = validModelPrice(m.price);
      const desc = o.listed
        ? [
            m.short || m.id,
            ac > 0 ? `autocompact ${fmtModelTokens(ac)}` : '',
            !isCur && ac > 0 && used > ac ? t.after : '',
          ]
            .filter(Boolean)
            .join(' · ')
        : t.outside;
      const facts = o.listed
        ? [
            win > 0 ? t.winSr(fmtModelTokens(win)) : '',
            price ? t.priceWords(fmtModelPrice(price.input), fmtModelPrice(price.output)) : t.noPriceWords,
          ]
            .filter(Boolean)
            .join(', ')
        : '';
      const label = `${name}, ${desc}${facts ? `. ${facts}` : ''}`;
      rows += `<div class="mp-opt" id="mp-opt-${i}" role="option" data-mk="opt:${escAttr(o.key)}" data-k="${escAttr(o.key)}" aria-selected="${
        isCur ? 'true' : 'false'
      }"${locked || !o.listed ? ' aria-disabled="true"' : ''}${i === active ? ' data-active=""' : ''}${
        i === lit ? ' data-lit=""' : ''
      } aria-label="${escAttr(label)}"><span class="mp-glyph" aria-hidden="true">${esc(modelGlyph(m))}</span><span class="mp-title"><span class="mp-title-name">${esc(
        name,
      )}</span>${isCur ? `<span class="mp-check" aria-hidden="true">${CHECK}</span>` : ''}</span>${meters(o.meters)}<span class="mp-desc">${esc(desc)}</span></div>`;
    });
    const tray = this.#tray(lit >= 0 ? opts[lit] : undefined, t);
    return `<div class="mp-pop${open ? ' is-open' : ''}" part="menu" id="mp-menu" role="dialog" aria-label="${escAttr(t.dialog)}"${
      open ? '' : ' inert'
    } data-side="${pos?.side ?? this.#side}"${
      pos ? ` style="left:${pos.left}px;top:${pos.top}px;max-height:${pos.maxHeight}px"` : ''
    }><div class="mp-card"><div class="mp-head" aria-hidden="true"><span class="mp-head-t">${esc(
      t.head,
    )}</span><span class="mp-cols">${t.cols.map((c) => `<span>${esc(c)}</span>`).join('')}</span></div>${
      locked ? `<div class="mp-wait" id="mp-wait">${esc(wait)}</div>` : ''
    }<div class="mp-list" role="listbox" aria-label="${escAttr(t.list)}" tabindex="0" data-key="mp-list"${
      active >= 0 ? ` aria-activedescendant="mp-opt-${active}"` : ''
    }${locked ? ' aria-disabled="true" aria-describedby="mp-wait"' : ''}${this.#pointing ? ' data-pointing=""' : ''}>${rows}</div>${this.#effort(
      d,
      cur >= 0 ? opts[cur] : undefined,
      t,
    )}<div class="mp-err" role="alert">${open && d.error ? esc(d.error) : ''}</div></div><div class="mp-foot"><span class="mp-caption" aria-hidden="true">${
      tray.html
    }</span><span class="mp-keys" aria-hidden="true"><kbd>&#x2191;&#x2193;</kbd><kbd>&#x21B5;</kbd></span><span class="sr-only mp-sr" aria-live="polite">${esc(
      tray.sr,
    )}</span></div></div>`;
  }

  /** Effort as a radiogroup with one tab stop; checked = the level that runs; only the model's levels. */
  #effort(d: ModelPickerData, cur: Opt | undefined, t: Strings): string {
    const own = d.value?.effortLevels;
    const levels = modelEffortLevels(
      Array.isArray(own) ? { id: '', label: '', effortLevels: own } : cur?.listed ? cur.model : null,
    );
    if (!levels.length) return '';
    const v = d.value ?? { model: '' };
    const on = v.effectiveEffort || v.effort || '';
    const idx = levels.indexOf(on);
    const capped = !!(v.effectiveEffort && v.effort && v.effectiveEffort !== v.effort);
    const busy = !!d.busy?.effort;
    let btns = '';
    levels.forEach((l, i) => {
      const checked = l === on;
      btns += `<button type="button" class="mp-seg-btn" role="radio" data-mk="eff:${escAttr(l)}" data-key="eff:${escAttr(
        l,
      )}" data-effort="${escAttr(l)}" aria-checked="${checked ? 'true' : 'false'}" tabindex="${
        checked || (idx < 0 && i === 0) ? '0' : '-1'
      }" aria-label="${escAttr(modelEffortLabel(l))}">${esc(EFFORT_SHORT[l] ?? l)}</button>`;
    });
    return `<div class="mp-settings"><div class="mp-effort-head"><span class="mp-effort-label" id="mp-effort-label">${esc(
      t.effort,
    )}</span>${capped ? `<span class="mp-effort-cap">${esc(t.cap(modelEffortLabel(v.effort), modelEffortLabel(v.effectiveEffort)))}</span>` : ''}</div><div class="mp-seg-ctl" role="radiogroup" aria-labelledby="mp-effort-label"${
      busy ? ' aria-disabled="true" aria-busy="true"' : ''
    } style="--i:${Math.max(0, idx)};--n:${levels.length}">${idx >= 0 ? '<span class="mp-thumb" aria-hidden="true"></span>' : ''}${btns}</div></div>`;
  }

  /** The tray of the lit row, and the sentence the live region reads once. */
  #tray(o: Opt | undefined, t: Strings): { html: string; sr: string } {
    if (!o) return { html: '', sr: '' };
    if (!o.listed) return { html: esc(t.outsideTray), sr: t.outsideSr };
    const m = o.model;
    const p = validModelPrice(m.price);
    const win = num(m.window) > 0 ? fmtModelTokens(m.window) : '';
    const html = [
      p
        ? t.tray(
            `<b class="mp-roll" data-roll="input">${fmtModelPrice(p.input)}</b>`,
            `<b class="mp-roll" data-roll="output">${fmtModelPrice(p.output)}</b>`,
          )
        : esc(t.noPrice),
      win ? esc(t.win(win)) : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const sr = `${m.label || m.id}: ${[
      p ? t.priceWords(fmtModelPrice(p.input), fmtModelPrice(p.output)) : t.noPriceWords,
      win ? t.winSr(win) : '',
    ]
      .filter(Boolean)
      .join(', ')}`;
    return { html, sr };
  }

  protected override updated(): void {
    if (!this.#open) {
      if (this.#raf) cancelAnimationFrame(this.#raf);
      this.#raf = 0;
      return;
    }
    if (this.#off()) {
      this.#setOpen(false, { user: true });
      return;
    }
    this.#place();
    this.#rollTray();
  }

  /** The tray's prices roll from what is shown to the lit row's (560ms, ease-out quart); reduced motion jumps. */
  #rollTray(): void {
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    const opts = this.#opts();
    const cur = currentIndex(opts, this.data?.value?.model ?? '');
    const lit = this.#pointing ? this.#activeIndex(opts, cur) : cur;
    const o = lit >= 0 ? opts[lit] : undefined;
    const to = o?.listed ? validModelPrice(o.model.price) : null;
    const from = this.#shown;
    this.#shown = to;
    if (!to || !from || (from.input === to.input && from.output === to.output)) return;
    if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') return;
    const els = this.$$('.mp-roll');
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / ROLL_MS));
      const e = 1 - (1 - p) ** 4;
      const at = {
        input: from.input + (to.input - from.input) * e,
        output: from.output + (to.output - from.output) * e,
      };
      this.#shown = p < 1 ? at : to;
      for (const el of els) {
        const k = el.getAttribute('data-roll') === 'input' ? 'input' : 'output';
        el.textContent = fmtModelPrice(at[k], to[k]);
      }
      this.#raf = p < 1 ? requestAnimationFrame(step) : 0;
    };
    step(t0);
  }
}

function meters(vals: ModelMeters): string {
  let html = '<span class="mp-bars" aria-hidden="true">';
  vals.forEach((v, c) => {
    if (!v) {
      html += '<span class="mp-meter is-none">&mdash;</span>';
      return;
    }
    html += `<span class="mp-meter" style="--c:${c}">`;
    for (let k = 0; k < 5; k++) html += `<span class="mp-seg" style="--s:${k}"${k < v ? ' data-on=""' : ''}></span>`;
    html += '</span>';
  });
  return `${html}</span>`;
}

define('ui-model-picker', UiModelPicker);

declare global {
  interface HTMLElementTagNameMap {
    'ui-model-picker': UiModelPicker;
  }
}
