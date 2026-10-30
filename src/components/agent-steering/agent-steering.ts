import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { esc, escAttr } from '../../core/html';
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
  type SteeringRow,
  type SteeringSubmitDetail,
  type SteerMode,
  settleOverlays,
  steerEnterAction,
  steeringActions,
  steeringFocusIndex,
  steeringItemKey,
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
  /** Field text set through `value` before the composer exists. */
  #draft = '';
  /** A `<ui-composer slot="composer">` that is the field (its own field, attachments and tools step aside). */
  #composer: ComposerLike | null = null;
  /** The Enter that is about to make the composer send carried ⌘/Ctrl: steer. */
  #steerNext = false;

  #items: SteeringItem[] = [];
  #rows: SteeringRow[] = [];
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

  /** Keyboard landing: the field — or, when it is off (read-only, ended), the first note's first button. */
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
    const first = this.$<HTMLElement>('.as-item:not([data-leaving]) [data-act]');
    if (first) first.focus(options);
    else super.focus(options);
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
      this.#submit('queue');
      if (!this.#field.disabled) this.#field.focus();
      return;
    }
    if (act === 'save') {
      this.#save();
      return;
    }
    if (act === 'discard') {
      this.#stopEdit();
      return;
    }
    const key = (el.closest('.as-item') as HTMLElement | null)?.dataset.row;
    const row = this.#rows.find((r) => r.key === key);
    if (!row || !steeringActions(row, this.#acts(this.#d)).includes(act as SteeringAction)) return;
    if (act === 'promote') this.#promote(row);
    else if (act === 'retry') this.#retry(row);
    else if (act === 'edit') this.#startEdit(row);
    else if (act === 'cancel') this.#cancel(row);
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
      if (act !== 'queue' && act !== 'steer') return;
      e.preventDefault();
      this.#submit(act);
      return;
    }
    if (target?.matches?.('.as-edit')) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.#stopEdit();
        return;
      }
      if (steerEnterAction(e, { touch: isTouch() }) !== 'queue') return;
      e.preventDefault();
      this.#save();
    }
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
  #submit(mode: SteerMode): void {
    const d = this.#d;
    if (!this.#built || !this.#open(d) || this.#composer) return;
    const text = this.#field.value.trim();
    const files = Math.max(0, Math.floor(Number(d.attachments) || 0));
    if (!text && !files) return;
    if (this.#note(text, mode, files)) this.value = '';
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
  #note(text: string, mode: SteerMode, files: number, list?: File[]): boolean {
    const d = this.#d;
    const running = !!d.running;
    const m: SteerMode = running && mode === 'steer' ? 'steer' : 'queue';
    const ref = `as-${Date.now().toString(36)}-${++this.#seq}`;
    const detail: SteeringSubmitDetail = { text, mode: m, ref };
    if (list) detail.files = list;
    if (!this.emit<SteeringSubmitDetail>('ui-submit', detail)) return false;
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

  #promote(row: SteeringRow): void {
    const item = this.#hostItem(row);
    if (!item || !this.emit<SteeringItemDetail>('ui-promote', { id: item.id })) return;
    this.#overlays.set(item.id, { state: 'sending', base: steeringItemKey(item) });
    this.#say(this.#t.say.promoted(clipNote(row.text)));
    this.renderNow();
  }

  #retry(row: SteeringRow): void {
    if (!row.local) {
      this.#promote(row);
      return;
    }
    const at = this.#locals.findIndex((l) => l.ref === row.id);
    if (at < 0) return;
    const l = this.#locals[at];
    const running = !!this.#d.running;
    const mode: SteerMode = running ? l.mode : 'queue';
    if (!this.emit<SteeringSubmitDetail>('ui-submit', { text: l.text, mode, ref: l.ref })) return;
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

  #cancel(row: SteeringRow): void {
    const item = this.#hostItem(row);
    if (!this.emit<SteeringItemDetail>('ui-cancel', { id: row.id })) return;
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

  #save(): void {
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
    const inList = !!active && this.#list.contains(active);
    const key = inList ? active?.dataset.key : undefined;
    const sel =
      inList && active instanceof HTMLTextAreaElement ? ([active.selectionStart, active.selectionEnd] as const) : null;
    const items = inList ? this.#liveItems() : [];
    this.#lostIndex = inList ? items.findIndex((li) => li.contains(active)) : -1;
    this.#patchList();
    this.#patchComposer();
    this.updated();
    if (inList) {
      const now = this.#active();
      const kept = !!now && now === active && this.#list.contains(now) && !now.closest('[data-leaving]');
      if (!kept) {
        const next =
          key === undefined
            ? undefined
            : Array.from(this.#list.querySelectorAll<HTMLElement>('[data-key]')).find((el) => el.dataset.key === key);
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
    const items = this.#liveItems();
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
    if (this.#composer && this.#open()) return this.#composer as unknown as HTMLElement;
    return this.#built && !this.#field.disabled && !this.#composer ? this.#field : null;
  }

  protected override updated(): void {
    this.#scheduleAges();
  }

  protected render(): string {
    return `<div class="as"><div class="as-queue"><div class="as-queue-in"><div class="as-queue-pad"><div class="as-label" aria-hidden="true"><span class="as-label-text"></span><span class="as-count"></span></div><ul class="as-list"></ul></div></div></div><div class="as-compose"><slot name="composer"></slot><slot name="attachments"></slot><div class="as-field"><slot name="tools"></slot><textarea class="as-input" rows="1" dir="auto" autocomplete="off"></textarea><button type="button" class="as-send" data-act="send">${ICON.send}</button></div><div class="as-hint" id="as-hint"></div></div></div>`;
  }

  #build(): void {
    this.content.innerHTML = this.render();
    this.#wrap = this.$('.as') as HTMLElement;
    this.#queue = this.$('.as-queue') as HTMLElement;
    this.#labelText = this.$('.as-label-text') as HTMLElement;
    this.#count = this.$('.as-count') as HTMLElement;
    this.#list = this.$('.as-list') as HTMLElement;
    this.#fieldBox = this.$('.as-field') as HTMLElement;
    this.#field = this.$('.as-input') as HTMLTextAreaElement;
    this.#send = this.$('.as-send') as HTMLButtonElement;
    this.#hint = this.$('.as-hint') as HTMLElement;
    this.#field.value = this.#draft;
    this.#draft = '';
    this.#built = true;
  }

  #liveItems(): HTMLElement[] {
    return Array.from(this.#list.children).filter((el) => !this.#leaving.has(el)) as HTMLElement[];
  }

  #make(html: string): HTMLElement {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const el = tpl.content.firstElementChild as HTMLElement;
    this.#html.set(el, html);
    return el;
  }

  #patchList(): void {
    const d = this.#d;
    const t = this.#t;
    const opts = this.#acts(d);
    const now = Date.now();
    const live = new Map<string, HTMLElement>();
    for (const el of this.#liveItems()) live.set(s(el.dataset.row), el);
    let prev: Element | null = null;
    for (const row of this.#rows) {
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
      let want: Element | null = prev ? prev.nextElementSibling : this.#list.firstElementChild;
      while (want && this.#leaving.has(want)) want = want.nextElementSibling;
      if (el !== want) this.#list.insertBefore(el, want);
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
    const n = this.#rows.length;
    this.#queue.toggleAttribute('data-open', n > 0);
    const label = d.running ? t.queueRunning : t.queueIdle;
    if (this.#labelText.textContent !== label) this.#labelText.textContent = label;
    const count = String(n);
    if (this.#count.textContent !== count) this.#count.textContent = count;
    this.#list.setAttribute('aria-label', `${label} · ${t.count(n)}`);
    this.#rendered = true;
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
