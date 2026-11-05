import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { attrs, cls, esc, escAttr } from '../../core/html';
import { morphInto } from '../../core/morph';
import { lastEnabled, rovingIndex } from '../../core/roving';
import { hasIcon, type IconName, icon } from '../../icons/icons';
import { soundInput } from '../../sound/sound';
import { styles } from './styles';

/** active (it runs on schedule) · paused · running (a run is going now) · failed (the last run failed). */
export type ActionNodeStatus = 'active' | 'paused' | 'running' | 'failed';
export type ActionNodeLang = 'en' | 'ko';

/** One round chip in the chain: a channel, a model, a person the job touches. */
export interface ActionNodeChip {
  /** What the chip stands for (“#ops”, “sonnet”). Its title, and a word in the spoken sentence. */
  label: string;
  /** What the chip shows (one or two characters). Default: the initials of `label`. */
  mark?: string;
}

/** One round button in the fan. */
export interface ActionNodeAction {
  /** What `ui-action` carries back. */
  id: string;
  /** The button's name (its aria-label and title). */
  label: string;
  icon: IconName;
  /** A destructive action: drawn in the failure colour, and it asks for a second press. */
  tone?: 'danger';
}

export interface ActionNodeData {
  name: string;
  description?: string;
  /** The glyph in the mark. Default `clock`. */
  icon?: IconName;
  status?: ActionNodeStatus;
  /** Quiet facts under the description, one line (“Weekdays 09:00”, “Next in 2h 14m”, “sonnet”). */
  meta?: string[];
  chips?: ActionNodeChip[];
  /** How many more chips there are than the ones given: a “+N” chip. */
  more?: number;
  /** The fan's buttons, in order along the corner (top edge first). The first four are shown. */
  actions?: ActionNodeAction[];
}

/** `ui-action` detail. */
export interface ActionNodeActionDetail {
  id: string;
}

/** The card's corner radius (px): the fan hugs this corner. */
export const NODE_CORNER = 20;
/** How far the fan sits off the corner, in percent of 24 px (plus 6 px), as the source block's `reach`. */
export const NODE_REACH = 25;
/** A fan button's size (px). */
export const NODE_BUTTON = 36;
/** The distance between two buttons, along the arc (px). */
export const NODE_SPACING = 48;
/** The most buttons the fan holds. */
export const NODE_MAX_ACTIONS = 4;
/** The delay between two buttons as the fan opens (in order) and closes (in reverse). */
export const NODE_STAGGER_MS = 55;
/** How long the fan waits after the pointer leaves the card and the fan before it closes. */
export const NODE_LEAVE_MS = 120;
/** The window for the confirming second press of a danger action (the goal card's window). */
export const NODE_ARM_MS = 4000;
/** A second press sooner than this after arming is the same press (a double click), not a confirmation. */
export const NODE_ARM_GUARD_MS = 250;

/** Space kept around each button by the invisible reach region (px). */
const REACH_PAD = 6;
const STATUSES: readonly ActionNodeStatus[] = ['active', 'paused', 'running', 'failed'];
const TONE: Record<ActionNodeStatus, string> = { active: 'done', paused: 'idle', running: 'run', failed: 'fail' };

/** “Delete” → “delete”, “Delete job” → “delete job”; an acronym (“PR”) or another script stays as it is. */
const lowerFirst = (s: string) => (/^\p{Lu}\p{Ll}/u.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

const STRINGS = {
  en: {
    actions: (name: string) => (name ? `Actions for ${name}` : 'Actions'),
    status: { active: 'Active', paused: 'Paused', running: 'Running', failed: 'Last run failed' },
    again: (label: string) => `Press again to ${lowerFirst(label)}`,
    more: (n: number) => `${n} more`,
  },
  ko: {
    actions: (name: string) => (name ? `${name} 동작` : '동작'),
    status: { active: '활성', paused: '일시 정지', running: '실행 중', failed: '마지막 실행 실패' },
    again: (label: string) => `한 번 더 누르면 ${label}`,
    more: (n: number) => `${n}개 더`,
  },
};
type Strings = (typeof STRINGS)['en'];

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
/** Two decimals, and never “-0”. */
const r2 = (v: number) => Math.round(v * 100) / 100 + 0;

/**
 * Where the fan's buttons sit (their centres), in px from the card's top-right corner (x right, y down). They run
 * along a quarter circle around the corner's own arc — its radius is the corner radius plus 6 px, plus `reach`% of
 * 24 px, plus half a button — `NODE_SPACING` apart and centred on its 45° point. A fan too long for the quarter
 * circle carries on along the straight edges (left along the top, down the right side). At most four.
 */
export function nodeFanPoints(
  count: number,
  cornerRadius: number = NODE_CORNER,
  reach: number = NODE_REACH,
): Array<{ x: number; y: number }> {
  const n = Math.min(NODE_MAX_ACTIONS, Math.max(0, Math.floor(num(count, 0))));
  const corner = Math.min(32, Math.max(0, num(cornerRadius, NODE_CORNER)));
  const off = 6 + (Math.min(100, Math.max(0, num(reach, NODE_REACH))) / 100) * 24 + NODE_BUTTON / 2;
  const r = corner + off;
  const quarter = (r * Math.PI) / 2;
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i++) {
    const s = quarter / 2 + (i - (n - 1) / 2) * NODE_SPACING;
    let x: number;
    let y: number;
    if (s <= 0) {
      x = -corner + s;
      y = -off;
    } else if (s >= quarter) {
      x = off;
      y = corner + (s - quarter);
    } else {
      const a = Math.PI / 2 - s / r;
      x = -corner + r * Math.cos(a);
      y = corner - r * Math.sin(a);
    }
    out.push({ x: r2(x), y: r2(y) });
  }
  return out;
}

/** A chip's letters: the first letter of the first two words (“#dev-soma” → “DS”, “#ops” → “O”), upper-cased. */
export function nodeInitials(label: unknown): string {
  const s = String(label ?? '').trim();
  const words = s.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!words.length) return Array.from(s)[0] ?? '';
  return words
    .slice(0, 2)
    .map((w) => Array.from(w)[0])
    .join('')
    .toUpperCase();
}

/** The delay (ms) of button `index` of `count`: opening runs in order, closing in reverse, `ms` apart. */
export function nodeStagger(index: number, count: number, open: boolean, ms: number = NODE_STAGGER_MS): number {
  const n = Math.max(0, Math.floor(num(count, 0)));
  if (!n) return 0;
  const i = Math.min(n - 1, Math.max(0, Math.floor(num(index, 0))));
  return Math.max(0, num(ms, 0)) * (open ? i : n - 1 - i);
}

function nodeStatus(v: unknown): ActionNodeStatus | null {
  return STATUSES.includes(v as ActionNodeStatus) ? (v as ActionNodeStatus) : null;
}

/**
 * The invisible region that bridges the card and the fan, so the hover holds while the pointer travels to a button:
 * the box around the buttons (plus a little), without the part the card itself covers.
 */
function reachStyle(points: Array<{ x: number; y: number }>, corner: number): string {
  const h = NODE_BUTTON / 2 + REACH_PAD;
  let l = 0;
  let r = 0;
  let t = 0;
  let d = 0;
  for (const p of points) {
    l = Math.min(l, p.x - h);
    r = Math.max(r, p.x + h);
    t = Math.min(t, p.y - h);
    d = Math.max(d, p.y + h);
  }
  const w = r2(r - l);
  const ht = r2(d - t);
  const cutX = r2(Math.max(0, -l - corner));
  const cutY = r2(Math.min(ht, -t + corner));
  return `left:${r2(l)}px;top:${r2(t)}px;width:${w}px;height:${ht}px;clip-path:polygon(0 0, ${w}px 0, ${w}px ${ht}px, ${cutX}px ${ht}px, ${cutX}px ${cutY}px, 0 ${cutY}px)`;
}

/** Hover opens the fan only for a mouse on a device that hovers. */
function hoverPointer(e: PointerEvent): boolean {
  if (e.pointerType && e.pointerType !== 'mouse') return false;
  return typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/** What opened the fan: the hover, a click or tap on the trigger, the keyboard, or the host (`open`). */
type Via = 'hover' | 'pointer' | 'key' | 'host';

/**
 * `<ui-action-node>` — an automation step as a card: a mark and the name, what it does, a quiet line of facts,
 * and the chain of channels / models it touches. Its actions are folded into the top-right corner: on hover (a
 * mouse) or from the corner trigger they fan out around the corner, popping in one after another, and fold back
 * when the pointer leaves. A danger action asks for a second press. Choosing sends a cancelable `ui-action`;
 * pressing the name sends `ui-open`.
 *
 * Ported from bencho.dev's “Action node” (MIT, © 2026 Lorenzo Cabra — https://bencho.dev/blocks/action-node).
 */
export class UiActionNode extends UiElement<ActionNodeData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang', 'open'];
  }

  #open = false;
  #via: Via | null = null;
  #reflecting = false;
  /** The fan button that holds the tab stop (roving tabindex). */
  #current = 0;
  #leaveTimer = 0;
  #armed: string | null = null;
  #armedAt = 0;
  #armTimer = 0;
  #attached = false;

  constructor() {
    super();
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    this.root.addEventListener('focusin', (e) => this.#onFocusIn(e));
    this.root.addEventListener('focusout', (e) => this.#onFocusOut(e as FocusEvent));
    // On the host, not the shadow root: these do not bubble. The open fan is a descendant, so it counts as inside.
    this.addEventListener('pointerenter', (e) => this.#onEnter(e as PointerEvent));
    this.addEventListener('pointerleave', (e) => this.#onLeave(e as PointerEvent));
  }

  /** Whether the fan is open. Setting it opens / closes the way the `open` attribute does (pinned, silent). */
  get open(): boolean {
    return this.#open;
  }

  set open(v: boolean) {
    this.#setOpen(!!v, { via: 'host' });
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === 'open') {
      if (!this.#reflecting) this.#setOpen(value !== null, { via: 'host' });
      return;
    }
    this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.#open) this.#attach();
  }

  override disconnectedCallback(): void {
    clearTimeout(this.#leaveTimer);
    this.#leaveTimer = 0;
    // A fan the person opened folds when the node leaves the page (a moved row comes back closed); a pinned one stays.
    if (this.#open && this.#via !== 'host') this.#setOpen(false, { via: 'hover', returnFocus: false });
    this.#disarm(false);
    this.#detach();
  }

  get #t(): Strings {
    return this.getAttribute('lang') === 'ko' ? STRINGS.ko : STRINGS.en;
  }

  /** The shown actions: objects with an id (first of a repeated id wins), at most four. */
  #actions(): ActionNodeAction[] {
    const raw = this.data?.actions;
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const out: ActionNodeAction[] = [];
    for (const a of raw) {
      if (!a || typeof a !== 'object') continue;
      const id = typeof a.id === 'string' || typeof a.id === 'number' ? String(a.id) : '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ ...a, id, label: typeof a.label === 'string' && a.label ? a.label : id });
      if (out.length === NODE_MAX_ACTIONS) break;
    }
    return out;
  }

  #buttons(): HTMLButtonElement[] {
    return this.$$<HTMLButtonElement>('.an-act');
  }

  #trigger(): HTMLButtonElement | null {
    return this.$<HTMLButtonElement>('.an-trigger');
  }

  #active(): HTMLElement | null {
    try {
      return this.root.activeElement as HTMLElement | null;
    } catch {
      return null;
    }
  }

  #focusInFan(): boolean {
    const a = this.#active();
    return !!a && !!this.$('.an-fan')?.contains(a);
  }

  // ── open / close ──────────────────────────────────────────────────────────

  /**
   * `o.event`: the person's click or key that did it (it sounds); hover, focus moving away and the host are silent.
   * Closing gives focus back to the trigger when it was in the fan (it turns inert), unless `returnFocus` is false.
   */
  #setOpen(v: boolean, o: { via: Via; event?: Event; focusFirst?: boolean; returnFocus?: boolean }): void {
    clearTimeout(this.#leaveTimer);
    this.#leaveTimer = 0;
    if (v === this.#open) {
      // Already open: the host pins it; a keyboard user keeps it from closing on a pointer leave.
      if (v && (o.via === 'host' || (o.via === 'key' && this.#via !== 'host'))) this.#via = o.via;
      if (v && o.focusFirst) this.#focusAt(0);
      return;
    }
    if (v) {
      this.#open = true;
      this.#via = o.via;
      this.#current = 0;
      this.#reflect(true);
      if (this.isConnected) {
        this.renderNow();
        this.#attach();
        if (o.focusFirst) this.#focusAt(0);
      }
    } else {
      if (o.returnFocus ?? this.#focusInFan()) this.#trigger()?.focus({ preventScroll: true });
      this.#open = false;
      this.#via = null;
      this.#disarm(false);
      this.#reflect(false);
      this.#detach();
      if (this.isConnected) this.renderNow();
    }
    if (o.event) this.sound(v ? 'open' : 'close', { emphasis: 'subtle' }, o.event);
  }

  #reflect(v: boolean): void {
    if (this.hasAttribute('open') === v) return;
    this.#reflecting = true;
    this.toggleAttribute('open', v);
    this.#reflecting = false;
  }

  /** A press outside closes a fan the person opened (a pinned one stays). */
  readonly #onOutside = (e: Event): void => {
    if (!this.#open || this.#via === 'host' || e.composedPath().includes(this)) return;
    this.#setOpen(false, { via: 'pointer', event: this.#via === 'hover' ? undefined : e, returnFocus: false });
  };

  #attach(): void {
    if (this.#attached || !this.#open || !this.isConnected) return;
    this.#attached = true;
    document.addEventListener('pointerdown', this.#onOutside, true);
  }

  #detach(): void {
    if (!this.#attached) return;
    this.#attached = false;
    document.removeEventListener('pointerdown', this.#onOutside, true);
  }

  #onEnter(e: PointerEvent): void {
    clearTimeout(this.#leaveTimer);
    this.#leaveTimer = 0;
    if (this.#open || !this.#actions().length || !hoverPointer(e)) return;
    this.#setOpen(true, { via: 'hover' });
  }

  /** The mouse left the card and the fan: fold back after a beat (re-entering cancels). */
  #onLeave(e: PointerEvent): void {
    // A finger or pen "leaves" as it lifts: never a reason to close.
    if (e.pointerType && e.pointerType !== 'mouse') return;
    if (!this.#open || this.#via === 'host' || this.#via === 'key') return;
    clearTimeout(this.#leaveTimer);
    this.#leaveTimer = window.setTimeout(() => {
      this.#leaveTimer = 0;
      this.#setOpen(false, { via: 'hover' });
    }, NODE_LEAVE_MS);
  }

  // ── input ─────────────────────────────────────────────────────────────────

  #onClick(e: Event): void {
    const b = (e.target as Element | null)?.closest?.<HTMLElement>('button');
    if (!b || !this.content.contains(b)) return;
    if (b.classList.contains('an-trigger')) {
      const key = soundInput(e) === 'keyboard';
      if (this.#open && this.#via === 'hover') {
        // The mouse opened the fan on its way to the trigger: the press keeps it — and takes it over (a key moves
        // focus into the fan and holds it past a pointer leave) — instead of folding it under the pointer.
        this.#via = key ? 'key' : 'pointer';
        if (key) this.#focusAt(0);
        return;
      }
      this.#setOpen(!this.#open, { via: key ? 'key' : 'pointer', event: e, focusFirst: key });
    } else if (b.classList.contains('an-name')) {
      if (this.emit('ui-open', {})) this.sound('navigate', undefined, e);
    } else if (b.classList.contains('an-act')) this.#press(b, e);
  }

  #onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    if (e.key === 'Escape') {
      if (!this.#open) return;
      e.preventDefault();
      e.stopPropagation();
      this.#setOpen(false, { via: 'key', event: e });
      return;
    }
    const acts = this.#buttons();
    const at = acts.indexOf(t as HTMLButtonElement);
    if (at < 0) return;
    // A held Enter repeats the click: on an armed button that would confirm on its own.
    if (e.repeat && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      return;
    }
    const off = acts.map(() => false);
    let next: number;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = rovingIndex(off, at, 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = rovingIndex(off, at, -1);
    else if (e.key === 'Home') next = rovingIndex(off, 0, 0);
    else if (e.key === 'End') next = lastEnabled(off);
    else return;
    e.preventDefault();
    // The keyboard is in the fan now: a mouse wandering off the card does not close it under the focus.
    if (this.#via !== 'host') this.#via = 'key';
    this.#focusAt(next);
  }

  /** Move the tab stop to button `i` (in place, no render) and focus it. */
  #focusAt(i: number): void {
    const acts = this.#buttons();
    if (!acts.length || i < 0) return;
    this.#current = Math.min(i, acts.length - 1);
    this.#syncTabStop();
    acts[this.#current].focus({ preventScroll: true });
  }

  #syncTabStop(): void {
    this.#buttons().forEach((b, j) => {
      b.tabIndex = this.#open && j === this.#current ? 0 : -1;
    });
  }

  #onFocusIn(e: Event): void {
    const i = this.#buttons().indexOf(e.target as HTMLButtonElement);
    if (i < 0 || i === this.#current) return;
    this.#current = i;
    this.#syncTabStop();
  }

  #onFocusOut(e: FocusEvent): void {
    const to = e.relatedTarget as Node | null;
    // Focus leaving the armed button disarms it (Tab away, a click elsewhere): a later Enter must not confirm.
    if (this.#armed) {
      const from = (e.target as Element | null)?.closest?.('[data-armed]');
      if (from && !(to && from.contains(to))) this.#disarm();
    }
    // Tab past the fan (focus lands outside the node): it folds, quietly, and focus goes where it was going.
    if (this.#open && this.#via !== 'host' && to && to !== this && !this.root.contains(to))
      this.#setOpen(false, { via: 'key', returnFocus: false });
  }

  /** A plain action emits at once; a danger action arms on the first press and emits on the second. */
  #press(b: HTMLElement, e: Event): void {
    if (!this.#open) return;
    const a = this.#actions().find((x) => x.id === b.dataset.id);
    if (!a) return;
    if (a.tone === 'danger') {
      this.#pressDanger(a, e);
      return;
    }
    this.#disarm();
    if (this.emit<ActionNodeActionDetail>('ui-action', { id: a.id })) this.sound('tap', undefined, e);
  }

  #pressDanger(a: ActionNodeAction, e: Event): void {
    const now = Date.now();
    if (this.#armed === a.id) {
      const since = now - this.#armedAt;
      if (since < NODE_ARM_GUARD_MS) return;
      if (since < NODE_ARM_MS) {
        this.#disarm();
        if (this.emit<ActionNodeActionDetail>('ui-action', { id: a.id })) this.sound('tap', undefined, e);
        return;
      }
    }
    this.#armed = a.id;
    this.#armedAt = now;
    clearTimeout(this.#armTimer);
    this.#armTimer = window.setTimeout(() => this.#disarm(), NODE_ARM_MS);
    this.sound('warning', { emphasis: 'subtle' }, e);
    this.requestRender();
  }

  #disarm(render = true): void {
    const was = !!this.#armed;
    this.#armed = null;
    this.#armedAt = 0;
    clearTimeout(this.#armTimer);
    this.#armTimer = 0;
    if (render && was) this.requestRender();
  }

  // ── render ────────────────────────────────────────────────────────────────

  /**
   * Patch the live tree instead of replacing it: the buttons keep their nodes (keyed by action id), so opening
   * and closing run their transitions and a focused button keeps its focus. When the focused button's action is
   * gone, focus lands on the trigger instead of falling to the page.
   */
  protected override update(): void {
    this.#reconcile();
    const a = this.#active();
    const had = !!a && this.content.contains(a);
    morphInto(this.content, this.render());
    this.updated();
    if (had && !this.#active()) (this.#trigger() ?? this.$<HTMLElement>('.an-name'))?.focus({ preventScroll: true });
  }

  /** State that no longer matches the data: an armed action that left or is no longer a danger; the tab stop. */
  #reconcile(): void {
    const acts = this.#actions();
    if (this.#current >= acts.length) this.#current = Math.max(0, acts.length - 1);
    if (this.#armed && !acts.some((x) => x.id === this.#armed && x.tone === 'danger')) this.#disarm(false);
  }

  protected render(): string {
    const d = this.data;
    if (!d || typeof d !== 'object') return '';
    const t = this.#t;
    const name = String(d.name ?? '');
    const acts = this.#actions();
    const open = this.#open && acts.length > 0;
    const armed = this.#armed ? acts.find((x) => x.id === this.#armed) : undefined;
    const again = armed ? t.again(armed.label) : '';
    const status = nodeStatus(d.status);
    const glyph = typeof d.icon === 'string' && hasIcon(d.icon) ? d.icon : 'clock';

    const st = status
      ? `<span class="an-st" data-tone="${TONE[status]}"${armed ? ' hidden' : ''}>${
          status === 'running'
            ? '<i class="an-spin" aria-hidden="true"></i>'
            : '<i class="an-dot" aria-hidden="true"></i>'
        }<span class="an-st-t">${esc(t.status[status])}</span></span>`
      : '';
    // The armed prompt stands where the status was; the live region below says it once.
    const hint = `<span class="an-hint" aria-hidden="true"${armed ? '' : ' hidden'}>${icon('alert', { size: 12 })}<span>${esc(
      again,
    )}</span></span>`;
    const top = `<div class="an-top"><span class="an-mark" part="mark" aria-hidden="true">${icon(glyph, {
      size: 18,
    })}</span><div class="an-head"><button type="button" class="an-name" part="name" id="an-name" data-key="name">${esc(
      name,
    )}</button>${st}${hint}</div></div>`;

    const desc = typeof d.description === 'string' && d.description.trim() ? d.description.trim() : '';
    const say = desc ? `<p class="an-say" part="description">${esc(desc)}</p>` : '';

    const meta = (Array.isArray(d.meta) ? d.meta : [])
      .filter((m): m is string => typeof m === 'string' && !!m.trim())
      .map((m) => `<span class="an-m">${esc(m.trim())}</span>`)
      .join('<span class="an-sep" aria-hidden="true">·</span>');
    const metaHtml = meta ? `<p class="an-meta" part="meta">${meta}</p>` : '';

    const chips = (Array.isArray(d.chips) ? d.chips : []).filter(
      (c): c is ActionNodeChip => !!c && typeof c === 'object' && typeof c.label === 'string' && !!c.label.trim(),
    );
    const more = Math.max(0, Math.floor(num(d.more, 0)));
    let chain = '';
    if (chips.length || more) {
      // Each chip sits over the next one: the earlier chip's letters stay whole.
      const z = (i: number) => chips.length + 1 - i;
      const marks = chips
        .map((c, i) => {
          const own = typeof c.mark === 'string' ? Array.from(c.mark.trim()).slice(0, 2).join('') : '';
          return `<span class="an-chip" title="${escAttr(c.label.trim())}" style="z-index:${z(i)}">${esc(
            own || nodeInitials(c.label),
          )}</span>`;
        })
        .join('');
      const plus = more
        ? `<span class="an-chip is-more" title="${escAttr(t.more(more))}" style="z-index:${z(chips.length)}">+${more}</span>`
        : '';
      const said = [...chips.map((c) => c.label.trim()), more ? t.more(more) : ''].filter(Boolean).join(', ');
      chain = `<div class="an-chain" part="chips" aria-hidden="true">${marks}${plus}</div><span class="an-chain-sr sr-only">${esc(
        said,
      )}</span>`;
    }

    const label = t.actions(name);
    const trigger = acts.length
      ? `<button type="button" class="an-trigger" part="trigger" data-key="trigger" aria-expanded="${open}" aria-controls="an-fan" aria-label="${escAttr(
          label,
        )}">${icon('more', { size: 16 })}</button>`
      : '';

    let fan = '';
    if (acts.length) {
      const pts = nodeFanPoints(acts.length);
      const step = prefersReducedMotion() ? 0 : NODE_STAGGER_MS;
      const buttons = acts
        .map((a, i) => {
          const p = pts[i];
          const on = a.id === this.#armed;
          const named = on ? again : a.label;
          const ic = icon(a.icon, { size: 16 }) || icon('dot', { size: 16 });
          return `<button type="button"${attrs({
            class: cls('an-act', a.tone === 'danger' && 'is-danger'),
            part: 'action',
            'data-mk': `act:${a.id}`,
            'data-key': `act:${a.id}`,
            'data-id': a.id,
            'data-armed': on,
            tabindex: open && i === this.#current ? 0 : -1,
            'aria-label': named,
            title: named,
            style: `--an-x:${p.x}px;--an-y:${p.y}px;--an-d:${nodeStagger(i, acts.length, open, step)}ms`,
          })}><span class="an-ic" aria-hidden="true">${ic}</span></button>`;
        })
        .join('');
      fan = `<div${attrs({
        class: 'an-fan',
        part: 'fan',
        id: 'an-fan',
        role: 'toolbar',
        'aria-label': label,
        inert: !open,
      })}><i class="an-reach" aria-hidden="true" style="${reachStyle(pts, NODE_CORNER)}"></i>${buttons}</div>`;
    }

    return `<div${attrs({
      class: 'an',
      part: 'node',
      'data-status': status ?? undefined,
      'data-open': open,
      'data-armed': !!armed,
    })}><div class="an-card" part="card" role="group" aria-labelledby="an-name">${top}${say}${metaHtml}${chain}${trigger}</div>${fan}<span class="an-live sr-only" aria-live="polite">${esc(
      again,
    )}</span></div>`;
  }
}

define('ui-action-node', UiActionNode);

declare global {
  interface HTMLElementTagNameMap {
    'ui-action-node': UiActionNode;
  }
}
