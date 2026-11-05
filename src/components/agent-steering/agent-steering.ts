import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { esc, escAttr } from '../../core/html';
import { positionFixed, watchViewport } from '../../core/popover';
import { readVisualViewport, watchVisualViewport } from '../../core/viewport';
import { typedKey } from '../../sound/sound';
import {
  type AgentSteeringData,
  claimLocals,
  clipNote,
  normSteeringItems,
  noteAge,
  STEERING_STATES,
  type SteeringAction,
  type SteeringEditDetail,
  type SteeringItem,
  type SteeringItemDetail,
  type SteeringItemState,
  type SteeringLocal,
  type SteeringOverlay,
  type SteeringQueueLayout,
  type SteeringRow,
  type SteeringSubmitDetail,
  type SteerMode,
  settleOverlays,
  sheetDismisses,
  splitSteeringRows,
  steerEnterAction,
  steeringActions,
  steeringDockBadge,
  steeringDockTone,
  steeringFocusIndex,
  steeringItemKey,
  steeringQueueLayout,
  steeringRows,
} from './logic';
import { type SteeringLang, type SteeringStrings, steeringStrings } from './strings';
import { styles } from './styles';

const MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(String(navigator.platform || navigator.userAgent));
const LEAVE_MS = 260;
const AGE_MS = 30_000;
const FIELD_MAX = 200;
const EDIT_MAX = 160;
const PENDING_MAX = 20;
/** Hover intent before the docked queue peeks open — a pointer crossing the button stays quiet. */
export const STEERING_PEEK_MS = 120;
/** Time to move the pointer from the button onto the queue (WCAG 1.4.13 hoverable) before a peek closes. */
export const STEERING_GRACE_MS = 240;
/** Narrower than this the docked queue is a bottom sheet (the dialog's `size-phone` width). */
const PHONE_MQ = '(max-width: 639px)';
const POP_GAP = 8;

/** How the docked queue is showing: not, on hover (it closes when the pointer leaves), or pinned by a press. */
type QueueMode = 'closed' | 'peek' | 'pinned';

const svg = (vb: number, body: string, cls = 'as-i') =>
  `<svg class="${cls}" viewBox="0 0 ${vb} ${vb}" aria-hidden="true">${body}</svg>`;
const ICON = {
  send: svg(16, '<path d="M8 12.6V3.7M4.3 7.4 8 3.7l3.7 3.7" stroke-width="1.6"/>'),
  now: svg(12, '<path d="M6.8 1.4 2.9 6.7h2.8l-.6 3.9 4-5.3H6.3l.5-3.9Z" fill="currentColor" stroke="none"/>'),
  edit: svg(12, '<path d="M7.9 2.4 9.6 4.1 4.4 9.3l-2.2.5.5-2.2 5.2-5.2ZM7 3.3l1.7 1.7"/>'),
  cancel: svg(12, '<path d="m3.5 3.5 5 5m0-5-5 5"/>'),
  retry: svg(12, '<path d="M2.5 6a3.5 3.5 0 1 0 1.1-2.5"/><path d="M2.4 1.9v1.9h1.9"/>'),
  check: svg(12, '<path d="m2.8 6.2 2 2 4.4-4.6" stroke-width="1.5"/>'),
  alert: svg(12, '<circle cx="6" cy="6" r="4.6"/><path d="M6 3.7v2.6m0 2v.1"/>'),
  file: svg(12, '<path d="M3.3 1.6h3.4l2 2v6.8H3.3zM6.6 1.7v2h2"/>'),
  spin: svg(
    12,
    '<circle cx="6" cy="6" r="4.4" stroke-opacity=".25"/><path d="M6 1.6A4.4 4.4 0 0 1 10.4 6"/>',
    'as-i as-spin',
  ),
};

/** The note being edited. `seed` is what the textarea started with (markup), `draft` what it holds now. */
interface Editing {
  id: string;
  key: string;
  seed: string;
  draft: string;
}

const isTouch = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** What this element needs of a slotted `<ui-composer>` (duck-typed: no import, no bundle weight). */
interface ComposerLike extends HTMLElement {
  value: string;
  data?: object;
}
/** The composer's `ui-submit` detail. */
interface ComposerSubmit {
  text: string;
  files: File[];
}
const s = (v: unknown) => (v === undefined || v === null ? '' : String(v));
const kbd = (...keys: string[]) => keys.map((k) => `<kbd>${esc(k)}</kbd>`).join('');

/**
 * `<ui-agent-steering>` — step into a running agent without stopping it. A composer (Enter sends, Shift+Enter is a
 * new line, never on an IME composition Enter, grows with its text; ⌘/Ctrl+Enter steers into the running turn) above
 * the agent's follow-up queue: the notes waiting for its next step, each with Send now, Edit (inline) and Cancel.
 * Every action is optimistic — the note shows sending / saving / gone at once — and the host confirms it by updating
 * `data.items`, or rolls it back with `setItemState(id, state, message)`.
 *
 * The composer is built once and patched in place, and notes are keyed rows that are only replaced when they change,
 * so a host update arriving while someone types (Korean IME included) never resets the field or the edit box.
 *
 * Docked (the default `data.queue`): once the host's list has a note it leaves the space above the field for a round
 * button at the element's top right with the number waiting. Hover peeks the queue open, a press pins it (Esc, a press
 * outside or the button again close it); under 640px it is a bottom sheet over a scrim that follows the visual
 * viewport (the soft keyboard) and closes when dragged down. Only a note on its way in shows above the field.
 */
export class UiAgentSteering extends UiElement<AgentSteeringData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  readonly #live: HTMLElement;
  #built = false;
  #wrap!: HTMLElement;
  #queue!: HTMLElement;
  #labelText!: HTMLElement;
  #count!: HTMLElement;
  #list!: HTMLElement;
  #fieldBox!: HTMLElement;
  #field!: HTMLTextAreaElement;
  #send!: HTMLButtonElement;
  #hint!: HTMLElement;
  #dock!: HTMLButtonElement;
  #dockNum!: HTMLElement;
  #pop!: HTMLElement;
  #popHead!: HTMLElement;
  #popTitle!: HTMLElement;
  #popCount!: HTMLElement;
  #popClose!: HTMLButtonElement;
  #dockList!: HTMLElement;
  #scrim!: HTMLElement;
  #probe!: HTMLElement;
  /** Where the dock sits, untransformed (its press and pop scale it): what the open queue is placed against. */
  #anchor!: HTMLElement;
  /** Field text set through `value` before the composer exists. */
  #draft = '';
  /** A `<ui-composer slot="composer">` that is the field (its own field, attachments and tools step aside). */
  #composer: ComposerLike | null = null;
  /** The Enter that is about to make the composer send carried ⌘/Ctrl: steer. */
  #steerNext = false;

  #items: SteeringItem[] = [];
  #rows: SteeringRow[] = [];
  #layout: SteeringQueueLayout = 'dock';
  /** Rows drawn above the field, and rows behind the dock. */
  #inlineRows: SteeringRow[] = [];
  #dockRows: SteeringRow[] = [];
  #queueMode: QueueMode = 'closed';
  /** The open queue is the phone's bottom sheet. */
  #sheet = false;
  #placed = false;
  #peekTimer: ReturnType<typeof setTimeout> | undefined;
  #graceTimer: ReturnType<typeof setTimeout> | undefined;
  #unwatch: (() => void) | null = null;
  #phone: MediaQueryList | null = null;
  /** The number the dock showed last (a new note bumps it). */
  #dockShown = 0;
  /** A drag of the sheet's head: pointer, start y, the last y / time, how far down, the speed (px/ms). */
  #drag: { id: number; y: number; ly: number; lt: number; dy: number; v: number } | null = null;
  #overlays = new Map<string, SteeringOverlay>();
  #locals: SteeringLocal[] = [];
  /** Idle sends: not drawn (they become a turn), kept so a reported failure can still offer Retry. */
  #pending = new Map<string, SteeringLocal>();
  #known: Set<string> | null = null;
  #seen = new Map<string, SteeringItemState>();
  #running = false;
  #editing: Editing | null = null;
  #focusEdit = false;
  #lostIndex = -1;
  #lostList: HTMLElement | null = null;

  #html = new WeakMap<Element, string>();
  #leaving = new Map<Element, number>();
  #rendered = false;
  #ageTimer = 0;
  #seq = 0;

  constructor() {
    super();
    // Outside the patched markup, so no update ever re-creates (or re-reads) the live region.
    this.#live = document.createElement('span');
    this.#live.className = 'sr-only';
    this.#live.setAttribute('role', 'status');
    this.#live.setAttribute('aria-live', 'polite');
    this.root.append(this.#live);
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    this.root.addEventListener('input', (e) => this.#onInput(e));
    this.root.addEventListener('slotchange', (e) => {
      if ((e.target as Element | null)?.getAttribute?.('name') === 'composer') this.requestRender();
    });
    // The slotted composer: its Enter is seen here before it sends (capture on the host runs first); its send
    // becomes this element's ui-submit.
    this.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Enter' && this.#fromComposer(e)) this.#steerNext = e.metaKey || e.ctrlKey;
      },
      true,
    );
    // …and on the way back up the composer has had it (it prevents every Enter): a ⌘/Ctrl that did not send is spent.
    this.addEventListener('keydown', (e) => {
      if (this.#fromComposer(e)) this.#steerNext = false;
    });
    this.addEventListener('ui-submit', (e) => this.#onComposerSubmit(e as CustomEvent<ComposerSubmit>));
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override disconnectedCallback(): void {
    if (this.#built) this.#closeQueue(false);
    this.#stopAges();
    for (const [el, timer] of this.#leaving) {
      clearTimeout(timer);
      el.remove();
    }
    this.#leaving.clear();
  }

  /** The field's text (the host may prefill it, e.g. to resend) — the slotted composer's, when there is one. */
  get value(): string {
    if (this.#composer) return s(this.#composer.value);
    return this.#built ? this.#field.value : this.#draft;
  }

  set value(v: string) {
    const text = s(v);
    if (this.#composer) {
      this.#composer.value = text;
      return;
    }
    if (!this.#built) {
      this.#draft = text;
      return;
    }
    this.#field.value = text;
    this.#autosize(this.#field, FIELD_MAX);
    this.#syncSend();
  }

  /** Keyboard landing: the field — or, when it is off (read-only, ended), a note's first button or the dock. */
  override focus(options?: FocusOptions): void {
    if (!this.#built && this.isConnected) this.renderNow();
    if (this.#composer && this.#open()) {
      this.#composer.focus(options);
      return;
    }
    if (this.#built && !this.#field.disabled && !this.#composer) {
      this.#field.focus(options);
      return;
    }
    // A note above the field, else the dock (the queue's notes are behind it).
    const inline = this.$<HTMLElement>('.as-queue .as-item:not([data-leaving]) [data-act]');
    const first = inline ?? (this.#dock?.hasAttribute('data-shown') ? this.#dock : null);
    if (first) first.focus(options);
    else super.focus(options);
  }

  /** Whether the docked queue is showing (hovered open or pinned). */
  get queueOpen(): boolean {
    return this.#queueMode !== 'closed';
  }

  /** Show the docked queue, pinned (as a press does). `focus`: into its first note. Nothing while no note waits. */
  openQueue(options: { focus?: boolean } = {}): void {
    if (!this.#built && this.isConnected) this.renderNow();
    if (this.#built) this.#openQueue('pinned', !!options.focus);
  }

  /** Hide the docked queue (focus inside it goes back to the button). */
  closeQueue(): void {
    if (this.#built) this.#closeQueue(true);
  }

  /**
   * The host's answer to an action before its list catches up. A note in `data.items`: roll it back
   * (`'queued'`, with why), or mark it `'failed'` / `'cancelled'` / `'sending'`; the same state as the list with no
   * message clears what this element showed. A `ui-submit` ref: `'failed'` (with why) offers Retry and Cancel,
   * `'cancelled'` drops it.
   */
  setItemState(id: string, state: SteeringItemState, message?: string): void {
    if (!STEERING_STATES.includes(state)) return;
    const key = s(id);
    const msg = s(message) || undefined;
    this.#sync();
    const t = this.#t;
    const item = this.#items.find((i) => i.id === key);
    if (item) {
      if (state === item.state && !msg) this.#overlays.delete(key);
      else this.#overlays.set(key, { state, message: msg, base: steeringItemKey(item) });
      if (state === 'failed') this.#say(t.say.failed(clipNote(item.text), msg ?? ''));
      this.requestRender();
      return;
    }
    const at = this.#locals.findIndex((l) => l.ref === key);
    if (at >= 0) {
      const l = this.#locals[at];
      if (state === 'cancelled') this.#locals.splice(at, 1);
      else this.#locals[at] = { ...l, state, message: msg };
      if (state === 'failed') this.#say(t.say.failed(clipNote(l.text), msg ?? ''));
      this.requestRender();
      return;
    }
    const sent = this.#pending.get(key);
    if (!sent) return;
    if (state === 'sending') return;
    this.#pending.delete(key);
    if (state !== 'failed') return;
    this.#locals.push({ ...sent, state: 'failed', message: msg });
    this.#say(t.say.failed(clipNote(sent.text), msg ?? ''));
    this.requestRender();
  }

  get #lang(): SteeringLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #t(): SteeringStrings {
    return steeringStrings(this.#lang);
  }

  get #d(): AgentSteeringData {
    return this.data ?? {};
  }

  #open(d: AgentSteeringData = this.#d): boolean {
    return d.canAct !== false && !d.disabled;
  }

  #say(text: string): void {
    if (this.#live.textContent === text) this.#live.textContent = '';
    this.#live.textContent = text;
  }

  // ── State ─────────────────────────────────────────────────────────────────

  /** Fold the host's list into the local state. Idempotent: running it twice on the same data changes nothing. */
  #sync(): void {
    const d = this.#d;
    const items = normSteeringItems(d.items);
    if (this.#known === null) this.#known = new Set(items.map((i) => i.id));
    else {
      const claimed = claimLocals(this.#locals, items, this.#known);
      this.#locals = claimed.locals;
      this.#known = claimed.known;
    }
    const running = !!d.running;
    // The turn ended: a note still in flight either became that turn's input or will show up in the list.
    if (this.#running && !running) this.#locals = this.#locals.filter((l) => l.state === 'failed');
    this.#running = running;
    this.#overlays = settleOverlays(this.#overlays, items);
    if (this.#rendered) {
      const t = this.#t;
      for (const i of items) {
        const prev = this.#seen.get(i.id);
        if (!prev || prev === i.state) continue;
        if (i.state === 'steered') this.#say(t.say.delivered(clipNote(i.text)));
        else if (i.state === 'failed') this.#say(t.say.failed(clipNote(i.text), i.reason ?? ''));
      }
    }
    this.#seen = new Map(items.map((i) => [i.id, i.state]));
    this.#items = items;
    this.#rows = steeringRows(items, this.#overlays, this.#locals);
    this.#layout = steeringQueueLayout(d.queue);
    const split = splitSteeringRows(this.#rows, this.#layout);
    this.#inlineRows = split.inline;
    this.#dockRows = split.docked;
    const ed = this.#editing;
    if (ed) {
      const row = this.#rows.find((r) => r.key === ed.key);
      if (!row || row.saving || !steeringActions(row, this.#acts(d)).includes('edit')) this.#editing = null;
    }
  }

  #acts(d: AgentSteeringData): { canAct: boolean; disabled: boolean } {
    return { canAct: d.canAct !== false, disabled: !!d.disabled };
  }

  // ── Intent ────────────────────────────────────────────────────────────────

  #onClick(e: Event): void {
    const target = e.target as Element | null;
    const el = target?.closest?.('[data-act]') as HTMLElement | null;
    // Slotted light-DOM content (the host's tools) is not ours, nor are the host page's own [data-act] ancestors.
    if (!el || !this.root.contains(el)) {
      if (target === this.#fieldBox && !this.#field.disabled && !this.#composer) this.#field.focus();
      return;
    }
    if (el.getAttribute('aria-disabled') === 'true') return;
    const act = el.dataset.act;
    if (act === 'send') {
      this.#submit('queue', e);
      if (!this.#field.disabled) this.#field.focus();
      return;
    }
    if (act === 'save') {
      this.#save(e);
      return;
    }
    if (act === 'discard') {
      this.#stopEdit();
      return;
    }
    if (act === 'dock') {
      this.#pressDock(e as MouseEvent);
      return;
    }
    if (act === 'close-queue' || act === 'scrim') {
      if (this.#queueMode !== 'closed') this.sound('close', { emphasis: 'subtle' }, e);
      this.#closeQueue(true);
      return;
    }
    const key = (el.closest('.as-item') as HTMLElement | null)?.dataset.row;
    const row = this.#rows.find((r) => r.key === key);
    if (!row || !steeringActions(row, this.#acts(this.#d)).includes(act as SteeringAction)) return;
    if (act === 'promote') this.#promote(row, e);
    else if (act === 'retry') this.#retry(row, e);
    else if (act === 'edit') this.#startEdit(row);
    else if (act === 'cancel') this.#cancel(row, e);
  }

  #onKey(e: KeyboardEvent): void {
    if (e.defaultPrevented || this.#fromComposer(e)) return;
    const target = e.target as HTMLElement | null;
    if (this.#built && target === this.#field) {
      if (e.key === 'Escape') {
        // Clears a typed note; on an empty field Esc still reaches the page (a panel closes).
        if (!this.#field.value) return;
        e.preventDefault();
        e.stopPropagation();
        this.value = '';
        return;
      }
      const act = steerEnterAction(e, { touch: isTouch(), running: !!this.#d.running });
      if (act !== 'queue' && act !== 'steer') {
        this.#typed(e, target);
        return;
      }
      e.preventDefault();
      this.#submit(act, e);
      return;
    }
    if (target?.matches?.('.as-edit')) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.#stopEdit();
        return;
      }
      if (steerEnterAction(e, { touch: isTouch() }) !== 'queue') {
        this.#typed(e, target);
        return;
      }
      e.preventDefault();
      this.#save(e);
    }
  }

  /** A keystroke that edits a note plays `type` (silent unless the page turned typing sounds on). */
  #typed(e: KeyboardEvent, field: HTMLElement): void {
    const key = typedKey(e, field);
    if (key) this.sound('type', { key }, e);
  }

  #onInput(e: Event): void {
    const target = e.target as HTMLElement | null;
    if (this.#built && target === this.#field) {
      this.#autosize(this.#field, FIELD_MAX);
      this.#syncSend();
    } else if (target instanceof HTMLTextAreaElement && target.matches('.as-edit') && this.#editing) {
      this.#editing.draft = target.value;
      this.#autosize(target, EDIT_MAX);
      this.$('[data-act="save"]')?.setAttribute('aria-disabled', String(!target.value.trim()));
    }
  }

  /** Emit the note; not cancelled → the field clears and, while the agent runs, the note shows until the list has it. */
  #submit(mode: SteerMode, e?: Event): void {
    const d = this.#d;
    if (!this.#built || !this.#open(d) || this.#composer) return;
    const text = this.#field.value.trim();
    const files = Math.max(0, Math.floor(Number(d.attachments) || 0));
    if (!text && !files) return;
    if (this.#note(text, mode, files, undefined, e)) this.value = '';
  }

  /**
   * The slotted composer sent: its ui-submit stops here and leaves as this element's (mode from the Enter's
   * ⌘/Ctrl, the composer's files along). Cancelled — or the field is off — the composer keeps its text and files.
   */
  #onComposerSubmit(e: CustomEvent<ComposerSubmit>): void {
    if (!this.#composer || e.target !== this.#composer) return;
    // Not even a listener on this element hears the composer's own send: this element's ui-submit replaces it.
    e.stopImmediatePropagation();
    const steer = this.#steerNext;
    this.#steerNext = false;
    const text = s(e.detail?.text).trim();
    const files = Array.isArray(e.detail?.files) ? e.detail.files : [];
    if (!this.#open() || (!text && !files.length) || !this.#note(text, steer ? 'steer' : 'queue', files.length, files))
      e.preventDefault();
  }

  /** Send a note (ui-submit); false when the host cancelled it. While the agent runs it shows until the list has it. */
  #note(text: string, mode: SteerMode, files: number, list?: File[], ev?: Event): boolean {
    const d = this.#d;
    const running = !!d.running;
    const m: SteerMode = running && mode === 'steer' ? 'steer' : 'queue';
    const ref = `as-${Date.now().toString(36)}-${++this.#seq}`;
    const detail: SteeringSubmitDetail = { text, mode: m, ref };
    if (list) detail.files = list;
    if (!this.emit<SteeringSubmitDetail>('ui-submit', detail)) return false;
    this.sound('tap', undefined, ev);
    const local: SteeringLocal = { ref, text, mode: m, at: Date.now(), state: 'sending' };
    if (files) local.attachments = files;
    const t = this.#t;
    const said = clipNote(text) || t.filesOnly;
    if (running) {
      this.#locals.push(local);
      this.#say(m === 'steer' ? t.say.steer(said) : t.say.queued(said));
    } else {
      this.#pending.set(ref, local);
      if (this.#pending.size > PENDING_MAX) this.#pending.delete(this.#pending.keys().next().value as string);
      this.#say(t.say.sent(said));
    }
    this.requestRender();
    return true;
  }

  #hostItem(row: SteeringRow): SteeringItem | undefined {
    return row.local ? undefined : this.#items.find((i) => i.id === row.id);
  }

  #promote(row: SteeringRow, e?: Event): void {
    const item = this.#hostItem(row);
    if (!item || !this.emit<SteeringItemDetail>('ui-promote', { id: item.id })) return;
    this.sound('tap', undefined, e);
    this.#overlays.set(item.id, { state: 'sending', base: steeringItemKey(item) });
    this.#say(this.#t.say.promoted(clipNote(row.text)));
    this.renderNow();
  }

  #retry(row: SteeringRow, e?: Event): void {
    if (!row.local) {
      this.#promote(row, e);
      return;
    }
    const at = this.#locals.findIndex((l) => l.ref === row.id);
    if (at < 0) return;
    const l = this.#locals[at];
    const running = !!this.#d.running;
    const mode: SteerMode = running ? l.mode : 'queue';
    if (!this.emit<SteeringSubmitDetail>('ui-submit', { text: l.text, mode, ref: l.ref })) return;
    this.sound('tap', undefined, e);
    const next: SteeringLocal = { ...l, mode, state: 'sending', message: undefined };
    if (running) this.#locals[at] = next;
    else {
      this.#locals.splice(at, 1);
      this.#pending.set(l.ref, next);
    }
    const t = this.#t;
    this.#say(
      (running ? (mode === 'steer' ? t.say.steer : t.say.queued) : t.say.sent)(clipNote(l.text) || t.filesOnly),
    );
    this.renderNow();
  }

  #cancel(row: SteeringRow, e?: Event): void {
    const item = this.#hostItem(row);
    if (!this.emit<SteeringItemDetail>('ui-cancel', { id: row.id })) return;
    this.sound('close', { emphasis: 'subtle' }, e);
    if (item) this.#overlays.set(item.id, { state: 'cancelled', base: steeringItemKey(item) });
    else this.#locals = this.#locals.filter((l) => l.ref !== row.id);
    this.#say(this.#t.say.cancelled(clipNote(row.text) || this.#t.filesOnly));
    this.renderNow();
  }

  #startEdit(row: SteeringRow): void {
    this.#editing = { id: row.id, key: row.key, seed: row.text, draft: row.text };
    this.#focusEdit = true;
    this.renderNow();
  }

  #stopEdit(): void {
    if (!this.#editing) return;
    this.#editing = null;
    // The Edit button carries the edit box's data-key, so focus lands back on it.
    this.renderNow();
  }

  #save(e?: Event): void {
    const ed = this.#editing;
    if (!ed) return;
    const row = this.#rows.find((r) => r.key === ed.key);
    const item = row && this.#hostItem(row);
    const text = ed.draft.trim();
    if (!row || !item || text === row.text.trim()) {
      this.#stopEdit();
      return;
    }
    if (!text) return;
    if (!this.emit<SteeringEditDetail>('ui-edit', { id: item.id, text })) return;
    this.sound('tap', { emphasis: 'subtle' }, e);
    this.#overlays.set(item.id, { state: item.state, text, saving: true, base: steeringItemKey(item) });
    this.#editing = null;
    this.#say(this.#t.say.saved(clipNote(text)));
    this.renderNow();
  }

  // ── Render cycle ──────────────────────────────────────────────────────────

  /**
   * Not a full re-render: the composer is patched in place and notes are reconciled by key, so the field and an edit
   * box keep their text, caret and IME composition across host updates. Focus inside the list follows `data-key`;
   * when its control is gone it moves to the note now at that place, the one before, or the field.
   */
  protected override update(): void {
    if (!this.#built) this.#build();
    this.#sync();
    const active = this.#active();
    const home = active ? ([this.#dockList, this.#list].find((l) => l.contains(active)) ?? null) : null;
    const inList = !!home;
    const key = inList ? active?.dataset.key : undefined;
    const sel =
      inList && active instanceof HTMLTextAreaElement ? ([active.selectionStart, active.selectionEnd] as const) : null;
    const items = home ? this.#liveItems(home) : [];
    this.#lostIndex = inList ? items.findIndex((li) => li.contains(active)) : -1;
    this.#lostList = home;
    this.#patchList(this.#dockList, this.#dockRows);
    this.#patchList(this.#list, this.#inlineRows);
    this.#patchQueue();
    this.#rendered = true;
    this.#patchComposer();
    this.updated();
    if (home) {
      const now = this.#active();
      const kept = !!now && now === active && home.contains(now) && !now.closest('[data-leaving]');
      if (!kept) {
        const next =
          key === undefined
            ? undefined
            : Array.from(this.root.querySelectorAll<HTMLElement>('.as-list [data-key]')).find(
                (el) => el.dataset.key === key,
              );
        (next ?? this.focusFallback())?.focus({ preventScroll: true });
        if (next instanceof HTMLTextAreaElement && sel) next.setSelectionRange(sel[0], sel[1]);
      }
    }
    if (this.#focusEdit) {
      this.#focusEdit = false;
      const box = this.$<HTMLTextAreaElement>('.as-edit');
      if (box) {
        box.focus({ preventScroll: true });
        box.setSelectionRange(box.value.length, box.value.length);
      }
    }
  }

  /** What has focus in this shadow tree (null while focus is in the slotted composer's own tree). */
  #active(): HTMLElement | null {
    try {
      return this.root.activeElement as HTMLElement | null;
    } catch {
      // Some DOMs throw for focus inside a slotted element's shadow root: that focus is not in this tree.
      return null;
    }
  }

  /** A note whose control went away: the note now at its place (or the one before) — else the field. */
  protected override focusFallback(): HTMLElement | null {
    const items = this.#liveItems(this.#lostList ?? this.#list);
    const from = steeringFocusIndex(items.length, this.#lostIndex);
    if (from >= 0) {
      for (let i = from; i < items.length; i++) {
        const b = items[i].querySelector<HTMLElement>('[data-act]');
        if (b) return b;
      }
      for (let i = from - 1; i >= 0; i--) {
        const b = items[i].querySelector<HTMLElement>('[data-act]');
        if (b) return b;
      }
    }
    if (this.#lostList === this.#dockList && this.#queueMode !== 'closed') return this.#popClose;
    if (this.#composer && this.#open()) return this.#composer as unknown as HTMLElement;
    return this.#built && !this.#field.disabled && !this.#composer ? this.#field : null;
  }

  protected override updated(): void {
    this.#scheduleAges();
  }

  protected render(): string {
    return `<div class="as"><button type="button" class="as-dock" data-act="dock" aria-haspopup="dialog" aria-expanded="false" aria-controls="as-pop" inert><span class="as-dock-ring" aria-hidden="true"></span><span class="as-dock-n" aria-hidden="true"></span></button><i class="as-probe" aria-hidden="true"></i><i class="as-anchor" aria-hidden="true"></i><div class="as-scrim" data-act="scrim" aria-hidden="true"></div><div class="as-pop" id="as-pop" role="dialog" tabindex="-1" inert><div class="as-pop-head"><span class="as-grab" aria-hidden="true"></span><span class="as-pop-title"></span><span class="as-count as-pop-count"></span><button type="button" class="as-btn is-icon as-pop-close" data-act="close-queue">${ICON.cancel}</button></div><div class="as-pop-body"><ul class="as-list is-docked"></ul></div></div><div class="as-queue"><div class="as-queue-in"><div class="as-queue-pad"><div class="as-label" aria-hidden="true"><span class="as-label-text"></span><span class="as-count"></span></div><ul class="as-list"></ul></div></div></div><div class="as-compose"><slot name="composer"></slot><slot name="attachments"></slot><div class="as-field"><slot name="tools"></slot><textarea class="as-input" rows="1" dir="auto" autocomplete="off"></textarea><button type="button" class="as-send" data-act="send">${ICON.send}</button></div><div class="as-hint" id="as-hint"></div></div></div>`;
  }

  #build(): void {
    this.content.innerHTML = this.render();
    this.#wrap = this.$('.as') as HTMLElement;
    this.#queue = this.$('.as-queue') as HTMLElement;
    this.#labelText = this.$('.as-label-text') as HTMLElement;
    this.#count = this.$('.as-queue .as-count') as HTMLElement;
    this.#fieldBox = this.$('.as-field') as HTMLElement;
    this.#field = this.$('.as-input') as HTMLTextAreaElement;
    this.#send = this.$('.as-send') as HTMLButtonElement;
    this.#hint = this.$('.as-hint') as HTMLElement;
    this.#dock = this.$('.as-dock') as HTMLButtonElement;
    this.#dockNum = this.$('.as-dock-n') as HTMLElement;
    this.#pop = this.$('.as-pop') as HTMLElement;
    this.#popHead = this.$('.as-pop-head') as HTMLElement;
    this.#popTitle = this.$('.as-pop-title') as HTMLElement;
    this.#popCount = this.$('.as-pop-count') as HTMLElement;
    this.#popClose = this.$('.as-pop-close') as HTMLButtonElement;
    this.#dockList = this.$('.as-list.is-docked') as HTMLElement;
    this.#list = this.$('.as-queue .as-list') as HTMLElement;
    this.#scrim = this.$('.as-scrim') as HTMLElement;
    this.#probe = this.$('.as-probe') as HTMLElement;
    this.#anchor = this.$('.as-anchor') as HTMLElement;
    this.#wireQueue();
    this.#field.value = this.#draft;
    this.#draft = '';
    this.#built = true;
  }

  #liveItems(list: HTMLElement): HTMLElement[] {
    return Array.from(list.children).filter((el) => !this.#leaving.has(el)) as HTMLElement[];
  }

  #make(html: string): HTMLElement {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const el = tpl.content.firstElementChild as HTMLElement;
    this.#html.set(el, html);
    return el;
  }

  /** Reconcile one list with its rows by key: unchanged rows stay, changed ones are replaced, gone ones leave. */
  #patchList(list: HTMLElement, rows: readonly SteeringRow[]): void {
    const d = this.#d;
    const t = this.#t;
    const opts = this.#acts(d);
    const now = Date.now();
    const live = new Map<string, HTMLElement>();
    for (const el of this.#liveItems(list)) live.set(s(el.dataset.row), el);
    let prev: Element | null = null;
    for (const row of rows) {
      const html = this.#rowHtml(row, opts, t, now);
      let el = live.get(row.key);
      live.delete(row.key);
      let fresh = false;
      if (el && this.#html.get(el) !== html) {
        const next = this.#make(html);
        el.replaceWith(next);
        el = next;
        fresh = true;
      } else if (!el) {
        el = this.#make(html);
        fresh = true;
        if (this.#rendered && !prefersReducedMotion()) {
          const enter = el;
          enter.classList.add('is-enter');
          enter.addEventListener('animationend', () => enter.classList.remove('is-enter'), { once: true });
        }
      }
      // Leaving rows hold their place; moving a node would blur whatever it holds focused, so only move when needed.
      let want: Element | null = prev ? prev.nextElementSibling : list.firstElementChild;
      while (want && this.#leaving.has(want)) want = want.nextElementSibling;
      if (el !== want) list.insertBefore(el, want);
      if (fresh && this.#editing?.key === row.key) {
        const box = el.querySelector<HTMLTextAreaElement>('.as-edit');
        if (box) {
          box.value = this.#editing.draft;
          this.#autosize(box, EDIT_MAX);
        }
      }
      prev = el;
    }
    for (const el of live.values()) this.#leave(el);
  }

  /** The inline queue's label and count, the dock's number, tone and name, the open queue's head. */
  #patchQueue(): void {
    const d = this.#d;
    const t = this.#t;
    const label = d.running ? t.queueRunning : t.queueIdle;
    const n = this.#inlineRows.length;
    this.#queue.toggleAttribute('data-open', n > 0);
    if (this.#labelText.textContent !== label) this.#labelText.textContent = label;
    const count = String(n);
    if (this.#count.textContent !== count) this.#count.textContent = count;
    this.#list.setAttribute('aria-label', `${label} · ${t.count(n)}`);

    const m = this.#dockRows.length;
    const shown = this.#layout === 'dock' && m > 0;
    const tone = steeringDockTone(this.#dockRows);
    const dock = this.#dock;
    if (dock.hasAttribute('data-shown') !== shown) {
      if (!shown && this.#active() === dock) this.focusFallback()?.focus({ preventScroll: true });
      dock.toggleAttribute('data-shown', shown);
      dock.toggleAttribute('inert', !shown);
    }
    dock.setAttribute('data-tone', tone);
    const badge = steeringDockBadge(m);
    if (this.#dockNum.textContent !== badge) this.#dockNum.textContent = badge;
    const name = t.dock(m, tone === 'fail');
    dock.setAttribute('aria-label', name);
    dock.title = name;
    if (this.#rendered && shown && m > this.#dockShown && !prefersReducedMotion()) {
      dock.classList.remove('is-bump');
      void dock.offsetWidth; // restart the animation
      dock.classList.add('is-bump');
    }
    this.#dockShown = shown ? m : 0;
    if (this.#popTitle.textContent !== label) this.#popTitle.textContent = label;
    const mc = String(m);
    if (this.#popCount.textContent !== mc) this.#popCount.textContent = mc;
    const popName = `${label} · ${t.count(m)}`;
    this.#pop.setAttribute('aria-label', popName);
    this.#dockList.setAttribute('aria-label', popName);
    this.#popClose.setAttribute('aria-label', t.closeQueue);
    this.#popClose.title = t.closeQueue;
    if (!shown) this.#closeQueue(false);
    else this.#placeQueue();
  }

  // ── The docked queue: hover peek, press pin, phone sheet ─────────────────

  #wireQueue(): void {
    const dock = this.#dock;
    const pop = this.#pop;
    const head = this.#popHead;
    const mouse = (e: PointerEvent) => e.pointerType !== 'touch';
    dock.addEventListener('pointerenter', (e) => {
      if (!mouse(e)) return;
      clearTimeout(this.#graceTimer);
      if (this.#queueMode !== 'closed') return;
      clearTimeout(this.#peekTimer);
      this.#peekTimer = setTimeout(() => this.#openQueue('peek'), STEERING_PEEK_MS);
    });
    dock.addEventListener('pointerleave', (e) => {
      if (!mouse(e)) return;
      clearTimeout(this.#peekTimer);
      this.#graceClose();
    });
    pop.addEventListener('pointerenter', (e) => {
      if (mouse(e)) clearTimeout(this.#graceTimer);
    });
    pop.addEventListener('pointerleave', (e) => {
      if (mouse(e)) this.#graceClose();
    });
    // Acting inside a peek keeps it: a press or focus there pins it.
    pop.addEventListener('pointerdown', (e) => {
      if (this.#queueMode === 'peek') this.#queueMode = 'pinned';
      this.#startDrag(e);
    });
    pop.addEventListener('focusin', () => {
      if (this.#queueMode === 'peek') this.#queueMode = 'pinned';
    });
    // iOS Safari sends no click for a tap on a plain element unless a listener sits on it (or it shows a pointer):
    // the scrim's own listener is what makes its tap close the sheet there. The delegated handler sees it too.
    this.#scrim.addEventListener('click', () => {});
    head.addEventListener('pointermove', (e) => this.#moveDrag(e));
    head.addEventListener('pointerup', (e) => this.#endDrag(e));
    head.addEventListener('pointercancel', (e) => this.#endDrag(e));
  }

  /** The dock pressed: open and pin (a peek is pinned), or close a pinned queue. A keyboard press moves focus in. */
  #pressDock(e: MouseEvent): void {
    if (this.#queueMode === 'pinned') {
      this.sound('close', { emphasis: 'subtle' }, e);
      this.#closeQueue(true);
      return;
    }
    const was = this.#queueMode;
    this.#openQueue('pinned', e.detail === 0);
    if (was === 'closed' && this.queueOpen) this.sound('open', undefined, e);
  }

  #graceClose(): void {
    clearTimeout(this.#graceTimer);
    if (this.#queueMode !== 'peek') return;
    this.#graceTimer = setTimeout(() => {
      if (this.#queueMode === 'peek') this.#closeQueue(false);
    }, STEERING_GRACE_MS);
  }

  /** The width query, watched only while the queue is open (a foldable crossing 640px then switches it in place). */
  #watchPhone(on: boolean): void {
    if (on && !this.#phone && typeof matchMedia === 'function') {
      this.#phone = matchMedia(PHONE_MQ);
      this.#phone.addEventListener?.('change', this.#onPhone);
    } else if (!on && this.#phone) {
      this.#phone.removeEventListener?.('change', this.#onPhone);
      this.#phone = null;
    }
  }

  #openQueue(mode: Exclude<QueueMode, 'closed'>, focusIn = false): void {
    clearTimeout(this.#peekTimer);
    clearTimeout(this.#graceTimer);
    if (this.#layout !== 'dock' || !this.#dockRows.length || !this.isConnected) return;
    const was = this.#queueMode;
    if (!(was === 'pinned' && mode === 'peek')) this.#queueMode = mode;
    if (was === 'closed') {
      this.#watchPhone(true);
      this.#sheet = !!this.#phone?.matches;
      this.#placed = false;
      this.#pop.toggleAttribute('data-sheet', this.#sheet);
      this.#syncModal();
      this.#pop.removeAttribute('inert');
      document.addEventListener('pointerdown', this.#onDocDown, true);
      document.addEventListener('keydown', this.#onDocKey, true);
      const stopViewport = watchViewport(() => this.#placeQueue());
      const stopVisual = watchVisualViewport(() => this.#placeQueue());
      this.#unwatch = () => {
        stopViewport();
        stopVisual();
      };
      this.#placeQueue();
      this.#pop.setAttribute('data-open', '');
      this.#scrim.toggleAttribute('data-open', this.#sheet);
      this.#dock.setAttribute('aria-expanded', 'true');
    }
    if (focusIn) {
      const first = this.#dockList.querySelector<HTMLElement>('.as-item:not([data-leaving]) [data-act]');
      (first ?? this.#popClose).focus({ preventScroll: true });
    } else if (was === 'closed' && this.#sheet) {
      // The sheet takes focus from the field, so the soft keyboard goes down and the sheet has the screen.
      this.#pop.focus({ preventScroll: true });
    }
  }

  #closeQueue(returnFocus: boolean): void {
    clearTimeout(this.#peekTimer);
    clearTimeout(this.#graceTimer);
    if (this.#queueMode === 'closed') return;
    this.#queueMode = 'closed';
    this.#watchPhone(false);
    this.#cancelDrag();
    document.removeEventListener('pointerdown', this.#onDocDown, true);
    document.removeEventListener('keydown', this.#onDocKey, true);
    this.#unwatch?.();
    this.#unwatch = null;
    // Focus leaves before the queue goes inert (an inert subtree drops it on the body).
    const a = this.#active();
    if (a && (this.#pop.contains(a) || a === this.#pop)) {
      const to = returnFocus && this.#dock.hasAttribute('data-shown') ? this.#dock : this.#fieldTarget();
      to?.focus({ preventScroll: true });
    }
    this.#pop.removeAttribute('data-open');
    this.#scrim.removeAttribute('data-open');
    this.#pop.setAttribute('inert', '');
    this.#dock.setAttribute('aria-expanded', 'false');
  }

  /** The field, as a focus target (the slotted composer's when there is one), or null when it is off. */
  #fieldTarget(): HTMLElement | null {
    if (this.#composer && this.#open()) return this.#composer as unknown as HTMLElement;
    return this.#built && !this.#field.disabled && !this.#composer ? this.#field : null;
  }

  /** A press outside the queue and its button closes it (the scrim's own click does, so its tap never falls through). */
  readonly #onDocDown = (e: PointerEvent): void => {
    if (this.#queueMode === 'closed') return;
    const path = e.composedPath();
    if (path.includes(this.#pop) || path.includes(this.#dock) || path.includes(this.#scrim)) return;
    // Focus inside goes to the dock, never the field (a tap there would raise the soft keyboard); a focusable
    // target of this press takes it right after.
    this.#closeQueue(true);
  };

  /** Esc closes the queue first (marked used, so a drawer under it stays) — not while a note's edit box has it. */
  readonly #onDocKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || e.isComposing || e.defaultPrevented || this.#queueMode === 'closed') return;
    if (e.composedPath().some((n) => n instanceof HTMLTextAreaElement && n.classList.contains('as-edit'))) return;
    e.preventDefault();
    this.sound('close', { emphasis: 'subtle' }, e);
    this.#closeQueue(true);
  };

  /** The width crossed 640px while the queue is open (a foldable opened or closed): popover ↔ sheet in place. */
  readonly #onPhone = (): void => {
    if (!this.#built || this.#queueMode === 'closed') return;
    const sheet = !!this.#phone?.matches;
    if (sheet === this.#sheet) return;
    this.#sheet = sheet;
    this.#cancelDrag();
    this.#pop.toggleAttribute('data-sheet', sheet);
    this.#syncModal();
    this.#scrim.toggleAttribute('data-open', sheet);
    for (const k of ['left', 'top', 'width', 'max-height']) this.#pop.style.removeProperty(k);
    this.#placed = false;
    this.#placeQueue();
  };

  /** The sheet is modal (a scrim under it, focus in it): it says so; the popover beside the dock is not. */
  #syncModal(): void {
    if (this.#sheet) this.#pop.setAttribute('aria-modal', 'true');
    else this.#pop.removeAttribute('aria-modal');
  }

  #placeQueue(): void {
    if (this.#queueMode === 'closed' || !this.isConnected) return;
    if (this.#sheet) {
      this.#placeSheet();
      return;
    }
    this.#pop.style.removeProperty('width');
    // Measured at its natural height: the card scrolls its body, not itself, so a capped card would report the cap
    // and the next placement would lift it — the height would flip every tick.
    this.#pop.style.maxHeight = 'none';
    const p = positionFixed(this.#anchor, this.#pop, this.#probe, 'top', 'end', POP_GAP);
    if (!p) {
      // The button scrolled away (or was never laid out — then there is nothing to follow yet).
      if (this.#placed) this.#closeQueue(false);
      return;
    }
    this.#placed = true;
  }

  /**
   * The sheet spans the screen's width and sits on the visual viewport's bottom — above the soft keyboard — with
   * the scrim over the visible area. The probe maps viewport px into a transformed ancestor's (a drawer's) space.
   */
  #placeSheet(): void {
    const pop = this.#pop;
    const o = this.#probe.getBoundingClientRect();
    const k = o.width > 0 ? o.width / 100 : 1;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const box = readVisualViewport();
    const vh = box ? box.height : window.innerHeight;
    const vt = box ? box.top : 0;
    pop.toggleAttribute('data-kb', !!box && window.innerHeight - box.height > 120);
    const left = `${Math.round(-o.left / k)}px`;
    const width = `${Math.round(vw / k)}px`;
    pop.style.left = left;
    pop.style.width = width;
    pop.style.maxHeight = `${Math.floor((vh - Math.max(56, Math.round(vh * 0.12))) / k)}px`;
    pop.style.top = `${Math.round((vt + vh - o.top) / k - pop.offsetHeight)}px`;
    const sc = this.#scrim.style;
    sc.left = left;
    sc.width = width;
    sc.top = `${Math.round((vt - o.top) / k)}px`;
    sc.height = `${Math.round(vh / k)}px`;
    this.#placed = true;
  }

  #startDrag(e: PointerEvent): void {
    if (!this.#sheet || this.#drag || e.button !== 0) return;
    const target = e.target as Element | null;
    if (!target || !this.#popHead.contains(target) || target.closest('button')) return;
    this.#drag = { id: e.pointerId, y: e.clientY, ly: e.clientY, lt: e.timeStamp, dy: 0, v: 0 };
    try {
      this.#popHead.setPointerCapture(e.pointerId);
    } catch {}
    this.#pop.setAttribute('data-drag', '');
  }

  #moveDrag(e: PointerEvent): void {
    const d = this.#drag;
    if (!d || e.pointerId !== d.id) return;
    const dt = Math.max(1, e.timeStamp - d.lt);
    d.v = (e.clientY - d.ly) / dt;
    d.ly = e.clientY;
    d.lt = e.timeStamp;
    d.dy = Math.max(0, e.clientY - d.y);
    this.#pop.style.transform = `translateY(${d.dy}px)`;
  }

  /** Released: past the mark (or flicked) the sheet goes, from where it is; else it springs back. */
  #endDrag(e: PointerEvent): void {
    const d = this.#drag;
    if (!d || e.pointerId !== d.id) return;
    const gone = e.type === 'pointerup' && sheetDismisses(d.dy, d.v, this.#pop.offsetHeight);
    this.#cancelDrag();
    if (gone) {
      this.sound('close', { emphasis: 'subtle' }, e);
      this.#closeQueue(true);
    }
  }

  #cancelDrag(): void {
    if (!this.#drag) return;
    this.#drag = null;
    this.#pop.removeAttribute('data-drag');
    this.#pop.style.removeProperty('transform');
  }

  #leave(el: HTMLElement): void {
    if (!this.isConnected || prefersReducedMotion()) {
      el.remove();
      return;
    }
    el.classList.remove('is-enter');
    el.setAttribute('data-leaving', '');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('inert', '');
    for (const k of Array.from(el.querySelectorAll('[data-key]'))) k.removeAttribute('data-key');
    const timer = window.setTimeout(() => {
      this.#leaving.delete(el);
      el.remove();
    }, LEAVE_MS);
    this.#leaving.set(el, timer);
  }

  #rowHtml(row: SteeringRow, opts: { canAct: boolean; disabled: boolean }, t: SteeringStrings, now: number): string {
    const acts = steeringActions(row, opts);
    const k = escAttr(row.key);
    const ed = this.#editing?.key === row.key && acts.includes('edit') ? this.#editing : null;
    // The edit box and the Edit button share a data-key on purpose: focus moves between them by itself.
    const editKey = escAttr(`edit:${row.key}`);
    if (ed)
      return `<li class="as-item" data-row="${k}"><div class="as-clip"><div class="as-row is-editing" data-state="queued"><textarea class="as-edit" rows="1" dir="auto" data-key="${editKey}" aria-label="${escAttr(
        t.editLabel,
      )}"></textarea><div class="as-edit-foot"><span class="as-edit-hint" aria-hidden="true">${esc(
        t.editHint,
      )}</span><button type="button" class="as-btn" data-act="discard" data-key="${escAttr(`discard:${row.key}`)}">${esc(
        t.stopEditing,
      )}</button><button type="button" class="as-btn is-primary" data-act="save" data-key="${escAttr(
        `save:${row.key}`,
      )}"${ed.seed.trim() ? '' : ' aria-disabled="true"'}>${esc(t.save)}</button></div></div></div></li>`;

    const name = clipNote(row.text) || t.filesOnly;
    const meta: string[] = [];
    if (row.author) meta.push(`<span class="as-author">${esc(row.author)}</span>`);
    const state = (tone: string, icon: string, label: string) =>
      `<span class="as-state" data-tone="${tone}">${icon}${esc(label)}</span>`;
    if (row.saving) meta.push(state('run', ICON.spin, t.state.saving));
    else if (row.state === 'sending')
      meta.push(state('run', ICON.spin, row.local && row.mode === 'queue' ? t.state.queuing : t.state.sending));
    else if (row.state === 'steered') meta.push(state('done', ICON.check, t.state.steered));
    else if (row.state === 'failed') meta.push(state('fail', ICON.alert, t.state.failed));
    else if (row.at !== undefined)
      meta.push(`<span class="as-age" data-at="${row.at}">${esc(noteAge(row.at, now, this.#lang))}</span>`);
    if (row.message) meta.push(`<span class="as-msg">${esc(row.message)}</span>`);
    else if (row.reason) meta.push(`<span class="as-reason">${esc(row.reason)}</span>`);
    if (row.fileCount)
      meta.push(
        `<span class="as-files"${row.files.length ? ` title="${escAttr(row.files.join(', '))}"` : ''}>${ICON.file}${esc(
          t.files(row.fileCount),
        )}</span>`,
      );

    const lock = row.saving ? ' aria-disabled="true"' : '';
    const btn = (act: SteeringAction, cls: string, icon: string, label: string, aria: string, title = '') =>
      `<button type="button" class="as-btn ${cls}" data-act="${act}" data-key="${
        act === 'edit' ? editKey : escAttr(`${act}:${row.key}`)
      }" aria-label="${escAttr(aria)}"${title ? ` title="${escAttr(title)}"` : ''}${lock}>${icon}${
        label ? `<span>${esc(label)}</span>` : ''
      }</button>`;
    const buttons = acts
      .map((a) =>
        a === 'promote'
          ? btn(a, 'is-go', ICON.now, t.sendNow, t.aria.promote(name), this.#running ? t.sendNowRunning : t.sendNowIdle)
          : a === 'retry'
            ? btn(a, 'is-go', ICON.retry, t.retry, t.aria.retry(name))
            : a === 'edit'
              ? btn(a, 'is-icon', ICON.edit, '', t.aria.edit(name), t.edit)
              : btn(a, 'is-icon', ICON.cancel, '', t.aria.cancel(name), t.cancel),
      )
      .join('');
    const text = row.text.trim()
      ? `<p class="as-text" dir="auto">${esc(row.text)}</p>`
      : `<p class="as-text is-empty">${esc(t.filesOnly)}</p>`;
    return `<li class="as-item" data-row="${k}"><div class="as-clip"><div class="as-row" data-state="${row.state}"${
      row.saving ? ' data-saving' : ''
    }><div class="as-body">${text}${meta.length ? `<div class="as-meta"><div class="as-meta-in">${meta.join('')}</div></div>` : ''}</div>${
      buttons ? `<div class="as-acts">${buttons}</div>` : ''
    }</div></div></li>`;
  }

  /** The event came from inside the slotted composer. */
  #fromComposer(e: Event): boolean {
    return !!this.#composer && e.composedPath().includes(this.#composer);
  }

  /** The first `slot="composer"` child that looks like a composer (value, focus, data) — else none. */
  #findComposer(): ComposerLike | null {
    const el = Array.from(this.children).find((c) => c.getAttribute('slot') === 'composer') as ComposerLike | undefined;
    return el && typeof el.focus === 'function' ? el : null;
  }

  /** The composer's words and state follow this element's: placeholder, name, off when the field is, no own hint. */
  #syncSlotted(c: ComposerLike, placeholder: string, label: string, open: boolean): void {
    const cur = (c.data ?? {}) as Record<string, unknown>;
    const want: Record<string, unknown> = { placeholder, label, disabled: !open, hint: false };
    if (Object.keys(want).some((k) => cur[k] !== want[k])) c.data = { ...cur, ...want };
  }

  #patchComposer(): void {
    const d = this.#d;
    const t = this.#t;
    const open = this.#open(d);
    const running = !!d.running;
    this.#composer = this.#findComposer();
    this.#wrap.toggleAttribute('data-composer', !!this.#composer);
    this.#wrap.toggleAttribute('data-running', running);
    this.#wrap.toggleAttribute('data-closed', !open);
    const placeholder = !open
      ? d.disabled
        ? t.ended
        : t.readOnly
      : s(d.placeholder) || (running ? t.placeholderRunning : t.placeholderIdle);
    if (this.#composer) this.#syncSlotted(this.#composer, placeholder, running ? t.fieldRunning : t.fieldIdle, open);
    const f = this.#field;
    if (f.placeholder !== placeholder) f.placeholder = placeholder;
    if (f.disabled === open) f.disabled = !open;
    f.setAttribute('aria-label', running ? t.fieldRunning : t.fieldIdle);
    if (open) f.setAttribute('aria-describedby', 'as-hint');
    else f.removeAttribute('aria-describedby');
    const sendLabel = running ? t.sendRunning : t.sendIdle;
    this.#send.setAttribute('aria-label', sendLabel);
    this.#send.title = sendLabel;
    const hint = !open
      ? ''
      : running
        ? `<span>${kbd('↵')} ${esc(t.hintNext)}</span><span>${kbd(MAC ? '⌘' : 'Ctrl', '↵')} ${esc(
            t.hintSteer,
          )}</span><span>${kbd('⇧', '↵')} ${esc(t.hintNewline)}</span>`
        : `<span>${kbd('↵')} ${esc(t.hintSend)}</span><span>${kbd('⇧', '↵')} ${esc(t.hintNewline)}</span>`;
    if (this.#hint.innerHTML !== hint) this.#hint.innerHTML = hint;
    this.#hint.hidden = !open;
    this.#syncSend();
  }

  #syncSend(): void {
    const d = this.#d;
    const files = Number(d.attachments) > 0;
    const off = !this.#open(d) || (!this.#field.value.trim() && !files);
    if (this.#send.disabled !== off) this.#send.disabled = off;
  }

  #autosize(el: HTMLTextAreaElement, max: number): void {
    el.style.height = 'auto';
    const h = el.scrollHeight;
    if (h > 0) el.style.height = `${Math.min(h, max)}px`;
    else el.style.removeProperty('height');
  }

  // ── Ages (“2m ago”): one timer for the element, text nodes patched in place ──

  #scheduleAges(): void {
    this.#stopAges();
    if (!this.isConnected || !this.$('.as-age')) return;
    this.#ageTimer = window.setTimeout(() => {
      this.#ageTimer = 0;
      const now = Date.now();
      for (const el of this.$$('.as-age')) {
        const label = noteAge(Number(el.dataset.at), now, this.#lang);
        if (el.textContent !== label) el.textContent = label;
      }
      this.#scheduleAges();
    }, AGE_MS);
  }

  #stopAges(): void {
    if (this.#ageTimer) clearTimeout(this.#ageTimer);
    this.#ageTimer = 0;
  }
}

define('ui-agent-steering', UiAgentSteering);

declare global {
  interface HTMLElementTagNameMap {
    'ui-agent-steering': UiAgentSteering;
  }
}
