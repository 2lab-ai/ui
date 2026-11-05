import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { attrs, cls, esc } from '../../core/html';
import { morphInto } from '../../core/morph';
import { type IconName, icon } from '../../icons/icons';
import { userGesture } from '../../sound/sound';
import { styles } from './styles';

/** `running` and `waiting` are live: the clock ticks until `endedAt`. */
export type IslandStatus = 'running' | 'waiting' | 'done' | 'failed';
/** `ink`: the pill is ink and inverts with the theme. `surface`: a raised card. */
export type IslandTone = 'ink' | 'surface';
export type IslandLang = 'en' | 'ko';

export interface IslandAction {
  id: string;
  label: string;
  /** A glyph from the icon set (`stop`, `external`, `check` …). Unknown names draw nothing. */
  icon?: IconName;
  /** `danger`: the round red button (Stop). With an icon its label is its name and tooltip. */
  tone?: 'danger';
}

export interface IslandProgress {
  done: number;
  total: number;
}

export interface AgentIslandData {
  /** The run's name: the compact face shows ~14 characters of it, the open card all of it. */
  title: string;
  status: IslandStatus;
  /** Epoch ms the run started: the elapsed clock counts from here. */
  startedAt?: number;
  /** Epoch ms it ended: the clock stops at the run's time. */
  endedAt?: number;
  /** What it is doing now (`Running npm test — 1,942 tests`), in the open card. */
  step?: string;
  /** Steps done of the plan: “3 of 7” and a thin rail in the open card. */
  progress?: IslandProgress;
  /** Other live runs not shown: a `+N` chip. */
  more?: number;
  /** Buttons in the open card (Stop, Open). */
  actions?: IslandAction[];
  /** The state the host wants. Applied when it changes, so a person's own toggle stays until the host says otherwise. */
  open?: boolean;
}

/** `ui-toggle` detail: the state the person asked for. */
export interface IslandToggleDetail {
  open: boolean;
}

/** `ui-action` detail. */
export interface IslandActionDetail {
  id: string;
}

/** The open card's width; it takes less when it has less room. */
export const ISLAND_OPEN_W = 340;
/** The compact pill's least width. */
export const ISLAND_MIN_W = 150;
/** How long the content's pop takes when the run changes (1.08 → 1). */
const POP_MS = 320;

const STATUSES: readonly IslandStatus[] = ['running', 'waiting', 'done', 'failed'];

const STRINGS = {
  en: {
    status: { running: 'Running', waiting: 'Needs you', done: 'Done', failed: 'Failed' } as Record<
      IslandStatus,
      string
    >,
    more: (n: number) => `${n} more`,
    open: 'Open',
    close: 'Close',
    progress: (done: number, total: number) => `${done} of ${total}`,
  },
  ko: {
    status: { running: '실행 중', waiting: '확인 필요', done: '완료', failed: '실패' } as Record<IslandStatus, string>,
    more: (n: number) => `${n}개 더`,
    open: '열기',
    close: '닫기',
    progress: (done: number, total: number) => `${total}개 중 ${done}`,
  },
};
type Strings = (typeof STRINGS)['en'];

const MARK: Record<IslandStatus, string> = {
  running: '<span class="ai-spin"></span>',
  waiting: '<span class="ai-dot"></span>',
  done: icon('check', { size: 14, stroke: 2 }),
  failed: icon('cross', { size: 14, stroke: 2 }),
};

// ── Pure helpers ────────────────────────────────────────────────────────────

/** Epoch ms, or NaN for anything that is not a positive finite number. */
const epoch = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : Number.NaN);

/** A known status, else `running`. */
export function islandStatus(v: unknown): IslandStatus {
  return STATUSES.includes(v as IslandStatus) ? (v as IslandStatus) : 'running';
}

/** m:ss under an hour, h:mm:ss from one: 0:42 · 12:05 · 1:02:09. Negative or not a number: 0:00. */
export function islandClock(ms: number): string {
  const n = Number(ms);
  const s = Math.max(0, Math.floor((Number.isFinite(n) ? n : 0) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** How long it has run: `startedAt` to `endedAt`, or to `now` while it has not ended. NaN without a start. */
export function islandElapsed(d: Pick<AgentIslandData, 'startedAt' | 'endedAt'> | undefined, now: number): number {
  const start = epoch(d?.startedAt);
  if (Number.isNaN(start)) return Number.NaN;
  const end = epoch(d?.endedAt);
  return Math.max(0, (Number.isNaN(end) ? now : end) - start);
}

/** Whether the clock moves: running or waiting, with a start and no end. */
export function islandTicks(d: Pick<AgentIslandData, 'status' | 'startedAt' | 'endedAt'> | undefined): boolean {
  if (!d) return false;
  const st = islandStatus(d.status);
  return (st === 'running' || st === 'waiting') && !Number.isNaN(epoch(d.startedAt)) && Number.isNaN(epoch(d.endedAt));
}

/** A progress worth drawing: whole numbers, total ≥ 1, done within 0 … total. Null otherwise. */
export function islandProgress(p: unknown): IslandProgress | null {
  if (!p || typeof p !== 'object') return null;
  const { done, total } = p as Record<string, unknown>;
  const t = Math.floor(Number(total));
  const n = Math.floor(Number(done));
  if (!Number.isFinite(t) || t < 1 || !Number.isFinite(n)) return null;
  return { done: Math.min(t, Math.max(0, n)), total: t };
}

/** The `+N` count: a whole number above zero, else 0. */
export function islandMore(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** What `#fit` measured: the room (the box at ISLAND_OPEN_W, clamped), its border, and the two faces' natural sizes. */
export interface IslandMeasure {
  open: boolean;
  room: number;
  /** Border of the box on both sides (offsetWidth − clientWidth). */
  edge?: number;
  faceW: number;
  faceH: number;
  cardH: number;
}

/**
 * The box's size for a state: open — the room (ISLAND_OPEN_W, or less) by the card's natural height; compact — the
 * face's natural width, at least ISLAND_MIN_W and at most the room, by its height. Null when nothing was laid out.
 */
export function islandFit(m: IslandMeasure): { w: number; h: number } | null {
  const room = Math.round(Number(m.room) || 0);
  const edge = Math.max(0, Number(m.edge) || 0);
  const tall = Number(m.open ? m.cardH : m.faceH) || 0;
  if (room <= 0 || tall <= 0) return null;
  const h = Math.ceil(tall + edge);
  if (m.open) return { w: room, h };
  return { w: Math.min(room, Math.max(ISLAND_MIN_W, Math.ceil((Number(m.faceW) || 0) + edge))), h };
}

/** A duration for `<time datetime>`: PT42S · PT4M12S · PT1H2M9S. */
function isoSpan(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `PT${h ? `${h}H` : ''}${h || m ? `${m}M` : ''}${s % 60}S`;
}

/** Fill an element's text without replacing its text node. */
function setText(el: Element, txt: string): void {
  const n = el.firstChild;
  if (n && n.nodeType === 3 && !n.nextSibling) {
    if (n.nodeValue !== txt) n.nodeValue = txt;
  } else if (el.textContent !== txt) el.textContent = txt;
}

/**
 * `<ui-agent-island>` — a live run you are not looking at, as one pill: its status mark, a short title and the
 * elapsed clock; pressed, it grows into a card with the status, the big clock, the current step, the progress and the
 * host's actions (Stop, Open). Width, height and corners move together on one spring, anchored at the top edge; the
 * compact row and the card crossfade through a little blur and scale. The clock ticks in place once a second while
 * the run is live. Esc closes the card and gives focus back to the pill.
 *
 * Ported from bencho.dev's “Dynamic island” (MIT, © 2026 Lorenzo Cabra — https://bencho.dev/blocks/dynamic-island).
 */
export class UiAgentIsland extends UiElement<AgentIslandData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return ['open', 'tone', 'lang'];
  }

  readonly #live: HTMLElement;
  #open = false;
  #reflecting = false;
  /** The last `data.open` applied: a new value from the host wins, the same one again does not undo a person's toggle. */
  #dataOpen: boolean | undefined;
  #seen: AgentIslandData | undefined;
  #prev: { status: IslandStatus; title: string } | undefined;
  #popNext = false;
  /** The box's last size (null: not measured — the box takes its face's natural size). */
  #size: { w: number; h: number; card: number } | null = null;
  #timer: ReturnType<typeof setInterval> | 0 = 0;
  #clockLen = 0;

  constructor() {
    super();
    this.#live = document.createElement('div');
    this.#live.className = 'sr-only';
    this.#live.setAttribute('role', 'status');
    this.#live.setAttribute('aria-live', 'polite');
    this.root.append(this.#live);
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.addEventListener('keydown', (e) => this.#onKey(e));
  }

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('resize', this.#onResize);
    // A web font that arrives after the first measure changes the pill's width.
    document.fonts?.ready.then(() => this.isConnected && this.#fit(false));
  }

  override disconnectedCallback(): void {
    window.removeEventListener('resize', this.#onResize);
    this.#stopTimer();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === 'open') {
      if (!this.#reflecting) this.#set(value !== null);
      return;
    }
    this.requestRender();
  }

  /** Whether the card is open. Setting it opens or closes without an event. */
  get open(): boolean {
    return this.#open;
  }

  set open(v: boolean) {
    this.#set(!!v);
  }

  /** Open the card (no event). */
  show(): void {
    this.#host(true);
  }

  /** Close the card (no event). */
  hide(): void {
    this.#host(false);
  }

  /** Open or close the card (no event). */
  toggle(): void {
    this.#host(!this.#open);
  }

  get #t(): Strings {
    return this.getAttribute('lang') === 'ko' ? STRINGS.ko : STRINGS.en;
  }

  // ── State ─────────────────────────────────────────────────────────────────

  #set(v: boolean): void {
    if (v === this.#open) return;
    this.#open = v;
    this.#reflect();
    this.requestRender();
  }

  #reflect(): void {
    if (this.hasAttribute('open') === this.#open) return;
    this.#reflecting = true;
    this.toggleAttribute('open', this.#open);
    this.#reflecting = false;
  }

  /** The host's own open / close: a cue only inside a person's click or key press. */
  #host(v: boolean): void {
    if (v === this.#open) return;
    this.#set(v);
    if (userGesture()) this.sound(v ? 'open' : 'close');
  }

  /** The person asked (the pill, the card's head, Esc): a cancelable `ui-toggle` first. */
  #ask(next: boolean, e: Event): void {
    if (!this.emit<IslandToggleDetail>('ui-toggle', { open: next })) return;
    this.#set(next);
    this.sound(next ? 'open' : 'close', undefined, e);
  }

  // ── Intent ────────────────────────────────────────────────────────────────

  #onClick(e: Event): void {
    const t = e.target as Element | null;
    // The face on its way out is inert; an engine that ignores inert still must not act on it.
    if (!t?.closest || t.closest('[inert]')) return;
    if (t.closest('.ai-toggle')) {
      this.#ask(!this.#open, e);
      return;
    }
    const id = (t.closest('.ai-act') as HTMLElement | null)?.dataset.id;
    if (id === undefined) return;
    if (this.emit<IslandActionDetail>('ui-action', { id })) this.sound('tap', undefined, e);
  }

  #onKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape' || !this.#open || e.defaultPrevented) return;
    e.preventDefault();
    e.stopPropagation();
    this.#ask(false, e);
  }

  readonly #onResize = (): void => this.#fit(false);

  #say(msg: string): void {
    this.#live.textContent = msg;
  }

  // ── Render cycle ──────────────────────────────────────────────────────────

  /** Patch in place: the box keeps its node so its size springs, the faces crossfade, the clock keeps its text node. */
  protected override update(): void {
    const d = this.data;
    if (d !== this.#seen) this.#observe(d);
    const a = this.root.activeElement;
    const focused = !!a && this.content.contains(a);
    morphInto(this.content, this.render());
    this.#fit(true);
    if (focused) this.#keepFocus();
    if (this.#popNext) this.#pop();
    this.#popNext = false;
    this.#syncTimer();
    this.updated();
  }

  /** New data: apply a new `open`, say a status change (never the first one), pop when the run changes. */
  #observe(d: AgentIslandData | undefined): void {
    this.#seen = d;
    if (!d) return;
    const status = islandStatus(d.status);
    const title = String(d.title ?? '');
    const prev = this.#prev;
    if (prev && status !== prev.status) this.#say([this.#t.status[status], title].filter(Boolean).join(': '));
    if (prev && (status !== prev.status || title !== prev.title)) this.#popNext = true;
    this.#prev = { status, title };
    if (typeof d.open === 'boolean' && d.open !== this.#dataOpen) {
      this.#dataOpen = d.open;
      this.#open = d.open;
      this.#reflect();
    }
  }

  protected render(): string {
    const d = this.data;
    if (!d) return '';
    const t = this.#t;
    const st = islandStatus(d.status);
    const word = t.status[st];
    const title = String(d.title ?? '');
    const more = islandMore(d.more);
    const name = [word, title, more ? t.more(more) : ''].filter(Boolean).join(', ');
    const ms = islandElapsed(d, Date.now());
    const timed = !Number.isNaN(ms);
    const clock = timed ? islandClock(ms) : '';
    this.#clockLen = clock.length;
    const open = this.#open;
    const s = this.#size;
    const mark = `<span class="ai-mark" data-mk="mark-${st}" aria-hidden="true">${MARK[st]}</span>`;
    const chip = more ? `<span class="ai-more" aria-hidden="true">+${more}</span>` : '';
    const toggle = (klass: string, key: string, tip: string, inner: string) =>
      `<button${attrs({
        type: 'button',
        class: `ai-toggle ${klass}`,
        part: 'toggle',
        'aria-expanded': String(open),
        'aria-controls': 'ai-card',
        'aria-label': name,
        title: tip,
        'data-key': key,
      })}>${inner}</button>`;

    const end =
      chip || timed
        ? `<span class="ai-end">${chip}${timed ? `<span class="ai-clock" data-tick aria-hidden="true">${clock}</span>` : ''}</span>`
        : '';
    const compact = `<div${attrs({ class: 'ai-face ai-compact', 'data-on': !open, inert: open })}>${toggle(
      'ai-pill',
      'ai-pill',
      t.open,
      `${mark}<span class="ai-title">${esc(title)}</span>${end}`,
    )}</div>`;

    const step = String(d.step ?? '').trim();
    const p = islandProgress(d.progress);
    const progress = p
      ? `<div class="ai-prog" part="progress"><span class="ai-count">${esc(t.progress(p.done, p.total))}</span><span class="ai-rail" aria-hidden="true"><span class="ai-fill" style="width: ${((p.done / p.total) * 100).toFixed(2)}%"></span></span></div>`
      : '';
    const actions = this.#actions(d);
    const card = `<div${attrs({ class: 'ai-face ai-card', id: 'ai-card', part: 'card', 'data-on': open, inert: !open })}><div class="ai-top">${toggle(
      'ai-head',
      'ai-head',
      t.close,
      `${mark}<span class="ai-word">${esc(word)}</span>${chip}`,
    )}${timed ? `<time class="ai-big" data-tick datetime="${isoSpan(ms)}">${clock}</time>` : ''}</div><div class="ai-body"><p class="ai-name">${esc(
      title,
    )}</p>${step ? `<p class="ai-step">${esc(step)}</p>` : ''}${progress}</div>${
      actions ? `<div class="ai-actions" part="actions">${actions}</div>` : ''
    }</div>`;

    return `<div${attrs({
      class: 'ai',
      part: 'island',
      'data-tone': this.getAttribute('tone') === 'surface' ? 'surface' : 'ink',
      'data-status': st,
      'data-open': open,
      style: s ? `width: ${s.w}px; height: ${s.h}px; --ai-card-w: ${s.card}px;` : undefined,
    })}><div class="ai-in">${compact}${card}</div></div>`;
  }

  #actions(d: AgentIslandData): string {
    let out = '';
    for (const a of Array.isArray(d.actions) ? d.actions : []) {
      if (!a || typeof a.id !== 'string') continue;
      const label = String(a.label ?? '');
      const danger = a.tone === 'danger';
      const glyph = a.icon ? icon(a.icon, { size: danger ? 18 : 14 }) : '';
      const round = danger && !!glyph;
      out += `<button${attrs({
        type: 'button',
        class: cls('ai-act', danger && 'is-danger', round && 'is-round'),
        'data-id': a.id,
        'data-key': `ai-act:${a.id}`,
        'data-mk': `ai-act:${a.id}`,
        'aria-label': round ? label : undefined,
        title: round ? label : undefined,
      })}>${glyph}${round ? '' : `<span class="ai-act-t">${esc(label)}</span>`}</button>`;
    }
    return out;
  }

  /**
   * Size the box for its state. The pill's natural width (its face is max-content) and the card's natural height (at
   * the width it will have) are measured with the box's transitions off, then the box goes back to the size and corners
   * it has this moment — mid-flight, too — and springs to the new ones. `animate` false (a resize, a font) or reduced motion:
   * the new size at once.
   */
  #fit(animate: boolean): void {
    const box = this.$('.ai');
    const face = this.$('.ai-compact');
    const card = this.$('.ai-card');
    if (!box || !face || !card) return;
    // Where the shape is this moment (mid-flight, too). Reading it also starts the corners' change toward the new state,
    // which turning transitions off below would cut short: the radius is held inline and let go with the size.
    const from =
      animate && this.#size && !prefersReducedMotion()
        ? { w: box.offsetWidth, h: box.offsetHeight, r: getComputedStyle(box).borderTopLeftRadius }
        : null;
    box.setAttribute('data-measure', '');
    // At the open width the box's max-width clamps it to the room it has.
    box.style.width = `${ISLAND_OPEN_W}px`;
    const room = box.offsetWidth;
    const edge = Math.max(0, room - box.clientWidth);
    box.style.setProperty('--ai-card-w', `${Math.max(0, room - edge)}px`);
    const size = islandFit({
      open: this.#open,
      room,
      edge,
      faceW: face.offsetWidth,
      faceH: face.offsetHeight,
      cardH: card.offsetHeight,
    });
    if (!size) {
      // Not laid out (display: none, no layout engine): the box takes its face's natural size until the next fit.
      this.#size = null;
      box.removeAttribute('style');
      box.removeAttribute('data-measure');
      return;
    }
    const set = (z: { w: number; h: number }) => {
      box.style.width = `${z.w}px`;
      box.style.height = `${z.h}px`;
    };
    set(from ?? size);
    if (from?.r) box.style.borderRadius = from.r;
    void box.offsetWidth; // the start (or, standing still, the end) lands while transitions are off
    box.removeAttribute('data-measure');
    if (from) {
      set(size);
      box.style.removeProperty('border-radius');
    }
    this.#size = { ...size, card: Math.max(0, room - edge) };
  }

  /** Focus that was in the island and is now in the hidden face (or gone) goes to the toggle on screen. */
  #keepFocus(): void {
    const a = this.root.activeElement as HTMLElement | null;
    if (a && this.content.contains(a) && !a.closest('[inert]')) return;
    this.$(this.#open ? '.ai-head' : '.ai-pill')?.focus({ preventScroll: true });
  }

  /** The content pops (1.08 → 1) when the run changes — status or title. Not under reduced motion. */
  #pop(): void {
    const el = this.$('.ai-in');
    if (!el || prefersReducedMotion() || typeof el.animate !== 'function') return;
    el.animate([{ scale: '1.08' }, { scale: '1' }], { duration: POP_MS, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  }

  // ── The clock ─────────────────────────────────────────────────────────────

  /** One 1 s interval, only while connected and the run is live. */
  #syncTimer(): void {
    const live = this.isConnected && islandTicks(this.data);
    if (live && !this.#timer) this.#timer = setInterval(() => this.#tick(), 1000);
    else if (!live) this.#stopTimer();
  }

  #stopTimer(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = 0;
  }

  /** 1 Hz: the clocks' text nodes change in place — never a re-render. A longer clock (9:59 → 10:00) refits the pill. */
  #tick(): void {
    const ms = islandElapsed(this.data, Date.now());
    if (Number.isNaN(ms)) return;
    const text = islandClock(ms);
    for (const el of this.$$('[data-tick]')) {
      setText(el, text);
      if (el.localName === 'time') el.setAttribute('datetime', isoSpan(ms));
    }
    if (text.length !== this.#clockLen) {
      this.#clockLen = text.length;
      this.#fit(true);
    }
  }
}

define('ui-agent-island', UiAgentIsland);

declare global {
  interface HTMLElementTagNameMap {
    'ui-agent-island': UiAgentIsland;
  }
}
