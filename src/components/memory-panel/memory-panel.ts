import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { fmtInt } from '../../core/format';
import { esc, escAttr } from '../../core/html';
import { styles } from './styles';

/** One memory store (a file the agent reads at the start of every session). */
export interface MemoryStore {
  /** Stable id, sent back as `store` in every event. */
  id: string;
  /** Group title and chip label (e.g. `Agent notes`). */
  label: string;
  /** File or source shown next to the label (e.g. `MEMORY.md`). */
  file?: string;
  /** Character budget of the store — drives the usage bar. 0 / absent: no bar, just the count. */
  limit: number;
  /** The entries, in store order. Entry `#n` is `entries[n - 1]`. */
  entries: string[];
  /** Longest single entry. Longer entries are flagged; the editors count against it. */
  perEntryLimit?: number;
  /** What the store puts between entries when it counts its usage (e.g. `'\n§\n'`). Default `''`. */
  separator?: string;
  /** The line shown while the store has no entries (writable panel). Default: “Empty — add an entry below.” */
  empty?: string;
}

export interface MemoryPanelData {
  stores: MemoryStore[];
  /** `true` hides every write action (edit, delete, add, clear); a string also says why, above the list. */
  readOnly?: boolean | string;
  /** Heading with a rolling entry count. Default: none (the host page titles the panel). */
  title?: string;
}

export interface MemoryAddDetail {
  store: string;
  /** As typed (the host decides whether to trim). */
  text: string;
}
export interface MemoryEditDetail {
  store: string;
  index: number;
  /** As typed. A change that only adds or removes surrounding whitespace is never sent. */
  text: string;
  /** The entry text the edit replaces — check it against your copy before writing. */
  previous: string;
}
export interface MemoryDeleteDetail {
  store: string;
  index: number;
  text: string;
}
/** The entry Undo brings back: `index` is where it was, `text` exactly what was deleted. */
export type MemoryRestoreDetail = MemoryDeleteDetail;
export interface MemoryClearDetail {
  store: string;
}

/** A write the host could not carry out: the `ui-*` event it received (or `{ type, detail }` with that detail). */
export interface MemoryWriteRefusal {
  type: string;
  detail?: unknown;
}

/** ok < 80% ≤ warn (amber) < 95% ≤ high (red bar) < 100% ≤ full (red text). */
export type UsageLevel = 'ok' | 'warn' | 'high' | 'full';

/** Two write details name the same write: store, index, text and previous agree (a cloned event's detail). */
function sameWrite(a: Record<string, unknown>, b: object): boolean {
  const o = b as Record<string, unknown>;
  return (['store', 'index', 'text', 'previous'] as const).every((k) => (a[k] ?? null) === (o[k] ?? null));
}

export const UNDO_MS = 5000;
export const FOLD_MS = 320;
const NOTICE_MS = 3000;
const ARM_MS = 4000;
const ROLL_MS = 520;
const SWAP_OUT_MS = 260;
const REVEAL_SCROLL_MS = 120;
const SHORT = 40;

const STRINGS = {
  en: {
    panel: 'Personal memory',
    stores: 'Stores',
    all: 'All',
    search: 'Search memories',
    searchPh: 'Search entries',
    closeSearch: 'Close search',
    usage: (l: string) => `${l} usage`,
    of: (u: string, l: string) => `${u} / ${l} chars`,
    chars: (n: string) => `${n} chars`,
    full: ' · full',
    empty: 'Empty — add an entry below.',
    emptyRo: 'Empty.',
    noMatch: (q: string) => `No entries match “${q}”`,
    over: 'over the per-entry limit',
    edit: 'Edit',
    del: 'Delete',
    editName: (s: string) => `Edit “${s}”`,
    delName: (s: string) => `Delete “${s}”`,
    editField: (l: string, n: number) => `Edit ${l} #${n}`,
    cancel: 'Cancel',
    save: 'Save',
    add: 'Add',
    addTo: (l: string) => `Add to ${l}`,
    clear: 'Clear all',
    clearN: (n: number) => `Clear ${n} ${n === 1 ? 'entry' : 'entries'}`,
    armed: 'This cannot be undone — press again to clear',
    armedSr: (l: string, n: number) =>
      `Clear all ${n} ${n === 1 ? 'entry' : 'entries'} in ${l}? This cannot be undone — press again to clear`,
    newLabel: (cap: string) => (cap ? `New entry (up to ${cap} chars)` : 'New entry'),
    after: (total: string, limit: string) =>
      limit ? `After adding: ${total} / ${limit} chars` : `After adding: ${total} chars`,
    overBy: (n: string) => ` — ${n} over`,
    tooLong: ' — over the per-entry limit',
    deleted: ['Deleted “', '”'],
    deletedSr: (s: string) => `Deleted “${s}” — Undo brings it back`,
    undo: 'Undo',
    saved: 'Saved',
    added: 'Added',
    restored: 'Restored',
    cleared: 'Cleared',
    failed: 'Couldn’t save',
    emptyEntry: 'An entry cannot be empty — use Delete to remove it',
    editHint: 'Enter to save · Shift+Enter for a new line · Esc to cancel',
    addHint: 'Enter to add · Shift+Enter for a new line · Esc to close',
    entries: (n: number): string => (n === 1 ? ' entry' : ' entries'),
  },
  ko: {
    panel: '개인 메모리',
    stores: '저장소',
    all: '전체',
    search: '개인 메모리 검색',
    searchPh: '항목 검색',
    closeSearch: '검색 닫기',
    usage: (l: string) => `${l} 사용량`,
    of: (u: string, l: string) => `${u} / ${l}자`,
    chars: (n: string) => `${n}자`,
    full: ' · 가득 참',
    empty: '비어 있음 — 아래에서 추가하세요.',
    emptyRo: '비어 있음.',
    noMatch: (q: string) => `“${q}” 검색 결과가 없습니다`,
    over: '한 항목 한도 초과',
    edit: '수정',
    del: '삭제',
    editName: (s: string) => `수정: “${s}”`,
    delName: (s: string) => `삭제: “${s}”`,
    editField: (l: string, n: number) => `${l} ${n}번 수정`,
    cancel: '취소',
    save: '저장',
    add: '추가',
    addTo: (l: string) => `${l}에 추가`,
    clear: '모두 지우기',
    clearN: (n: number) => `${n}개 모두 지우기`,
    armed: '되돌릴 수 없습니다 — 한 번 더 누르면 지웁니다',
    armedSr: (l: string, n: number) =>
      `${l} 항목 ${n}개를 모두 지울까요? 되돌릴 수 없습니다 — 한 번 더 누르면 지웁니다`,
    newLabel: (cap: string) => (cap ? `새 항목 (한 항목 최대 ${cap}자)` : '새 항목'),
    after: (total: string, limit: string) => (limit ? `추가하면 ${total} / ${limit}자` : `추가하면 ${total}자`),
    overBy: (n: string) => ` — ${n}자 초과`,
    tooLong: ' — 한 항목 한도 초과',
    deleted: ['삭제함 “', '”'],
    deletedSr: (s: string) => `삭제함 “${s}” — 되돌리기로 되돌릴 수 있습니다`,
    undo: '되돌리기',
    saved: '저장했습니다',
    added: '추가했습니다',
    restored: '되돌렸습니다',
    cleared: '모두 지웠습니다',
    failed: '저장하지 못했습니다',
    emptyEntry: '비어 있는 항목은 저장할 수 없습니다 — 지우려면 삭제를 쓰세요',
    editHint: 'Enter 저장 · Shift+Enter 줄바꿈 · Esc 취소',
    addHint: 'Enter 추가 · Shift+Enter 줄바꿈 · Esc 닫기',
    entries: (_n: number) => '개 항목',
  },
};
type Strings = (typeof STRINGS)['en'];

const SEARCH_SVG =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="4.25" stroke="currentColor" stroke-width="1.5"/><path d="M9.25 9.25 12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

// ── pure helpers (exported, unit-tested) ──

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Characters a store uses: its entries joined with its separator (what the store itself counts). */
export function storeUsed(entries: readonly string[], separator = ''): number {
  if (!entries.length) return 0;
  let n = separator.length * (entries.length - 1);
  for (const e of entries) n += String(e).length;
  return n;
}

/** The usage band against the store's limit. */
export function usageLevel(used: number, limit: number): UsageLevel {
  if (!(limit > 0)) return 'ok';
  const r = used / limit;
  return r >= 1 ? 'full' : r >= 0.95 ? 'high' : r >= 0.8 ? 'warn' : 'ok';
}

/** The store's usage once `text` is added — trimmed, as the store saves it, plus one separator. */
export function usageAfterAdd(entries: readonly string[], separator: string, text: string): number {
  const n = String(text ?? '').trim().length;
  return storeUsed(entries, separator) + (n ? n + (entries.length ? separator.length : 0) : 0);
}

/** An edit is "the same" when both sides match once trimmed — the store trims what it saves, so no write is needed. */
export function isSameEdit(next: string, previous: string): boolean {
  return String(next ?? '').trim() === String(previous ?? '').trim();
}

/** `text` cut to `max` characters with an ellipsis (spoken names, the undo sentence). */
export function shortText(text: string, max = SHORT): string {
  const s = String(text ?? '');
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** Search: the trimmed query, case-insensitive, inside the entry — or inside the store's label / file name. */
export function entryMatches(text: string, q: string, store?: { label?: string; file?: string }): boolean {
  const needle = String(q ?? '')
    .trim()
    .toLowerCase();
  if (!needle) return true;
  if (
    String(text ?? '')
      .toLowerCase()
      .includes(needle)
  )
    return true;
  return !!store && `${store.label ?? ''} ${store.file ?? ''}`.toLowerCase().includes(needle);
}

/** Escaped `text` with each case-insensitive occurrence of the trimmed query wrapped in `<mark>`. */
export function highlight(text: string, q: string): string {
  const s = String(text ?? '');
  const needle = String(q ?? '')
    .trim()
    .toLowerCase();
  const lower = s.toLowerCase();
  // (a lower-casing that changes the length — rare Unicode — would misplace the marks: no marks then)
  if (!needle || lower.length !== s.length) return esc(s);
  let out = '';
  let at = 0;
  for (let i = lower.indexOf(needle); i >= 0; i = lower.indexOf(needle, at)) {
    out += `${esc(s.slice(at, i))}<mark>${esc(s.slice(i, i + needle.length))}</mark>`;
    at = i + needle.length;
  }
  return out + esc(s.slice(at));
}

function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Stable row keys: a content hash plus the occurrence. A row keeps its key when rows above it are deleted or
 * restored, so focus stays on the same entry when the host's next `data` shifts the indices.
 */
export function entryKeys(entries: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return entries.map((e) => {
    const h = hash(String(e));
    const n = seen.get(h) ?? 0;
    seen.set(h, n + 1);
    return n ? `${h}.${n}` : h;
  });
}

// ── element ──

interface WorkStore {
  id: string;
  label: string;
  file: string;
  limit: number;
  per: number;
  sep: string;
  empty: string;
  entries: string[];
}
interface View {
  store: string | null;
  q: string;
  searching: boolean;
}
interface Editing {
  store: string;
  index: number;
  orig: string;
  draft: string;
}
interface Undo {
  store: string;
  index: number;
  text: string;
  seq: number;
  left: number;
  started: number;
  timer: number;
  /** Shared by the delete's rollback and its Undo's: whichever is refused, the row ends up on screen once. */
  link: UndoLink;
}
/** `restored`: Undo put the deleted text back (its restore is still on screen); `refused`: the delete was refused. */
interface UndoLink {
  restored: boolean;
  refused: boolean;
}
/** An optimistic write still on screen: its kind (`edit`, `delete` …), the detail it was sent with, its rollback. */
interface Pending {
  kind: string;
  rollback: () => void;
}
interface Notice {
  text: string;
  seq: number;
  fail: boolean;
}
interface TrayState {
  key: string;
  html: string;
  live: string;
  tone?: string;
  total?: number;
  cap?: string;
}

function fold(el: Element | null | undefined, open: boolean): void {
  if (!el) return;
  el.toggleAttribute('data-open', open);
  el.toggleAttribute('inert', !open);
}

function grow(el: HTMLTextAreaElement | null | undefined): void {
  if (!el) return;
  el.style.height = 'auto';
  const h = el.scrollHeight;
  if (h > 0) el.style.height = `${h}px`;
}

/**
 * `<ui-memory-panel>` — the agent's personal memory stores in one panel: store chips (a radiogroup), search with
 * highlight, one group per store with its usage bar, in-place edit, a delete that folds away at once with a 5 s
 * Undo on the tray, add per store, a two-press "Clear all". Every write leaves as a cancelable `ui-*` event and
 * shows optimistically until the host's next `data`, which is always the truth.
 */
export class UiMemoryPanel extends UiElement<MemoryPanelData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  #work: WorkStore[] = [];
  /** Entry texts as the DOM shows them (a delete's fold can outlive the working copy by FOLD_MS). */
  #painted = new Map<string, string[]>();
  #view: View = { store: null, q: '', searching: false };
  #editing: Editing | null = null;
  #adding: Record<string, boolean> = {};
  #drafts: Record<string, string> = {};
  #undo: Undo | null = null;
  #notice: Notice | null = null;
  #armed: { store: string; n: number; seq: number } | null = null;
  #holds = { hover: false, panel: false };
  #seq = 0;
  #chrome = '';
  #trayKey = '';
  #trayItem: HTMLElement | null = null;
  #rolls = new Map<Element, { n: number; raf: number }>();
  #timers = { notice: 0, armed: 0, settle: 0, scroll: 0 };
  #swaps = new Set<number>();
  /** Optimistic writes still on screen (until the next `data`), in the order they were sent: detail → rollback. */
  #pending = new Map<object, Pending>();
  /** The write being dispatched right now, and a refusal that arrived while it was. */
  #emitting: { kind: string; detail: object } | null = null;
  #refusedNow = '';

  constructor() {
    super();
    const r = this.root;
    r.addEventListener('click', (e) => this.#onClick(e));
    r.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    r.addEventListener('input', (e) => this.#onInput(e));
    r.addEventListener('focusin', () => this.#hold('panel', true));
    r.addEventListener('focusout', (e) => {
      const to = (e as FocusEvent).relatedTarget as Node | null;
      this.#hold('panel', !!to && this.content.contains(to));
    });
  }

  override get data(): MemoryPanelData | undefined {
    return super.data;
  }

  /** Setting data ends every optimistic change: the panel shows exactly the stores you pass. */
  override set data(value: MemoryPanelData | undefined) {
    this.#adopt(value);
    super.data = value;
  }

  attributeChangedCallback(): void {
    this.#chrome = '';
    this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.#undo && !this.#undo.timer) this.#armUndo();
  }

  override disconnectedCallback(): void {
    for (const k of ['notice', 'armed', 'settle', 'scroll'] as const) {
      clearTimeout(this.#timers[k]);
      this.#timers[k] = 0;
    }
    const u = this.#undo;
    if (u?.timer) {
      clearTimeout(u.timer);
      u.timer = 0;
      u.left = Math.max(0, u.left - (Date.now() - u.started));
    }
    for (const id of this.#swaps) clearTimeout(id);
    this.#swaps.clear();
    for (const st of this.#rolls.values()) cancelAnimationFrame(st.raf);
    this.#rolls.clear();
    this.#notice = null;
    this.#armed = null;
    this.#holds = { hover: false, panel: false };
  }

  get #t(): Strings {
    return (this.getAttribute('lang') ?? '').toLowerCase().startsWith('ko') ? STRINGS.ko : STRINGS.en;
  }

  get #ro(): boolean {
    const r = this.data?.readOnly;
    return r === true || typeof r === 'string';
  }

  #store(id: string | null | undefined): WorkStore | undefined {
    return id == null ? undefined : this.#work.find((s) => s.id === id);
  }

  // ── data ──

  #adopt(d: MemoryPanelData | undefined): void {
    // New data is the truth: every optimistic change on screen ends here.
    this.#pending.clear();
    const list = Array.isArray(d?.stores) ? d.stores : [];
    this.#work = list
      .filter((s) => s && s.id != null)
      .map((s) => ({
        id: String(s.id),
        label: String(s.label ?? s.id),
        file: s.file ? String(s.file) : '',
        limit: num(s.limit),
        per: num(s.perEntryLimit),
        sep: typeof s.separator === 'string' ? s.separator : '',
        empty: typeof s.empty === 'string' ? s.empty : '',
        entries: (Array.isArray(s.entries) ? s.entries : []).map((e) => String(e ?? '')),
      }));
    const ro = d?.readOnly === true || typeof d?.readOnly === 'string';
    // An open editor is re-attached to its entry (found by its text, only when unique); else a changed draft
    // moves to that store's add box — nothing typed is lost.
    const e = this.#editing;
    if (e) {
      const s = this.#store(e.store);
      const at = s ? s.entries.indexOf(e.orig) : -1;
      if (!ro && s && at >= 0 && s.entries.lastIndexOf(e.orig) === at) e.index = at;
      else {
        this.#editing = null;
        if (s && !ro && e.draft !== e.orig) this.#keepDraft(s.id, e.draft);
      }
    }
    if (ro) {
      this.#adding = {};
      this.#armed = null;
      this.#dropUndo();
    }
    if (this.#view.store && !this.#store(this.#view.store)) this.#view = { ...this.#view, store: null };
    if (this.#undo && !this.#store(this.#undo.store)) this.#dropUndo();
    const a = this.#armed;
    if (a && this.#store(a.store)?.entries.length !== a.n) this.#armed = null;
  }

  // ── rendering ──

  /** The static chrome: chips, search, tray. The groups are painted into `.mm-list`. */
  protected render(): string {
    const d = this.data;
    const t = this.#t;
    const title = d?.title ? String(d.title) : '';
    const reason = typeof d?.readOnly === 'string' ? d.readOnly : '';
    let chips = `<button type="button" class="mm-chip" role="radio" data-act="chip" data-all data-key="chip-all" aria-checked="false" tabindex="-1">${esc(t.all)} <span class="mm-chip-n"></span></button>`;
    for (const s of this.#work)
      chips += `<button type="button" class="mm-chip" role="radio" data-act="chip" data-pick="${escAttr(s.id)}" data-key="${escAttr(`chip|${s.id}`)}" aria-checked="false" tabindex="-1">${esc(s.label)} <span class="mm-chip-n"></span></button>`;
    return `<section class="mm" role="group" ${title ? 'aria-labelledby="mm-title"' : `aria-label="${escAttr(t.panel)}"`}>
${title ? `<div class="mm-head"><span class="mm-title" id="mm-title">${esc(title)}</span><span class="mm-count" aria-hidden="true"></span></div>` : ''}<div class="mm-filters">
<div class="mm-chips" role="radiogroup" aria-label="${escAttr(t.stores)}">${chips}</div>
<div class="mm-search" id="mm-search" inert>${SEARCH_SVG}<input type="search" class="mm-q" data-key="q" placeholder="${escAttr(t.searchPh)}" aria-label="${escAttr(t.search)}" autocomplete="off" spellcheck="false"><button type="button" class="mm-icon" data-act="search-close" data-key="search-close" aria-label="${escAttr(t.closeSearch)}"><span aria-hidden="true">×</span></button></div>
<button type="button" class="mm-icon mm-search-open" data-act="search-open" data-key="search-open" aria-label="${escAttr(t.search)}" aria-expanded="false" aria-controls="mm-search">${SEARCH_SVG}</button>
</div>${reason ? `<p class="mm-note">${esc(reason)}</p>` : ''}
<div class="mm-list"></div>
<div class="mm-foot"><span class="mm-caption" aria-hidden="true"></span><span class="sr-only mm-live" role="status" aria-live="polite" aria-atomic="true">${esc(this.#trayState().live)}</span><button type="button" class="mm-undo" data-act="undo" data-key="undo" hidden>${esc(t.undo)}</button></div>
</section>`;
  }

  /** Renders are deferred while a deleted row folds away, so the host's answer never cuts the fold short. */
  protected override update(): void {
    if (this.#timers.settle) return;
    this.#paintAll();
  }

  #sig(): string {
    const d = this.data;
    return JSON.stringify([
      this.#t.all,
      d?.title ?? '',
      typeof d?.readOnly === 'string' ? d.readOnly : '',
      this.#work.map((s) => [s.id, s.label]),
    ]);
  }

  #paintAll(): void {
    if (this.#timers.settle) {
      clearTimeout(this.#timers.settle);
      this.#timers.settle = 0;
    }
    if (!this.data || !Array.isArray(this.data.stores)) {
      this.content.innerHTML = '';
      this.#chrome = '';
      this.#trayItem = null;
      return;
    }
    this.#keepFocus(() => {
      const sig = this.#sig();
      if (sig !== this.#chrome) this.#buildChrome(sig);
      this.#paintList();
    });
    this.#applyView();
  }

  #buildChrome(sig: string): void {
    for (const st of this.#rolls.values()) cancelAnimationFrame(st.raf);
    this.#rolls.clear();
    this.#trayKey = '';
    this.#trayItem = null;
    this.#holds.hover = false;
    this.content.innerHTML = this.render();
    this.#chrome = sig;
    const q = this.$<HTMLInputElement>('.mm-q');
    if (q) q.value = this.#view.q;
    const foot = this.$('.mm-foot');
    foot?.addEventListener('pointerenter', (e) => {
      if ((e as PointerEvent).pointerType !== 'touch') this.#hold('hover', true);
    });
    foot?.addEventListener('pointerleave', () => this.#hold('hover', false));
  }

  #paintList(): void {
    const list = this.$('.mm-list');
    if (!list) return;
    const t = this.#t;
    const ro = this.#ro;
    let html = '';
    this.#work.forEach((s, si) => {
      html += this.#groupHtml(s, si, t, ro);
    });
    html +=
      '<div class="mm-fold mm-nomatch-f" inert><div class="mm-clip"><p class="mm-empty mm-nomatch"></p></div></div>';
    list.innerHTML = html;
    this.#painted = new Map(this.#work.map((s) => [s.id, s.entries.slice()]));
    // Values are set, not rendered: a textarea's leading newline would not survive the parser.
    for (const s of this.#work) {
      const box = this.#byKey(`new|${s.id}`) as HTMLTextAreaElement | null;
      if (box) {
        box.value = this.#drafts[s.id] ?? '';
        this.#paintCount(s);
        if (this.#adding[s.id]) grow(box);
      }
    }
    const e = this.#editing;
    if (e) {
      const ta = this.#byKey(`edit|${e.store}`) as HTMLTextAreaElement | null;
      if (ta) {
        ta.value = e.draft;
        grow(ta);
      }
    }
  }

  #groupHtml(s: WorkStore, si: number, t: Strings, ro: boolean): string {
    const v = this.#view;
    const q = v.q.trim();
    const keys = entryKeys(s.entries);
    const used = storeUsed(s.entries, s.sep);
    const level = usageLevel(used, s.limit);
    let rows = '';
    let shown = 0;
    s.entries.forEach((text, i) => {
      const show = this.#rowShown(s, i, text);
      if (show) shown++;
      const editing = !ro && this.#editing?.store === s.id && this.#editing.index === i;
      rows += `<li><div class="mm-fold mm-rowf" data-row="${keys[i]}" data-i="${i}"${show ? ' data-open' : ' inert'}><div class="mm-clip">${
        editing ? this.#editorHtml(s, i, t) : this.#rowHtml(s, i, text, keys[i], t, ro)
      }</div></div></li>`;
    });
    const open = (!v.store || v.store === s.id) && (shown > 0 || !q);
    const val =
      s.limit > 0 ? t.of(fmtInt(used), fmtInt(s.limit)) + (level === 'full' ? t.full : '') : t.chars(fmtInt(used));
    const bar =
      s.limit > 0
        ? `<span class="mm-bar" role="meter" aria-valuemin="0" aria-valuemax="${s.limit}" aria-valuenow="${Math.min(used, s.limit)}" aria-valuetext="${escAttr(val)}" aria-label="${escAttr(t.usage(s.label))}"><i style="width:${Math.min(100, (used / s.limit) * 100).toFixed(2)}%"></i></span>`
        : '';
    let html = `<section class="mm-group mm-fold" data-store="${escAttr(s.id)}"${open ? ' data-open' : ' inert'} aria-labelledby="mm-h-${si}"><div class="mm-clip">
<div class="mm-ghead"><h3 id="mm-h-${si}">${esc(s.label)}${s.file ? ` <span class="mm-file">${esc(s.file)}</span>` : ''}</h3><div class="mm-usage" data-level="${level}">${bar}<span class="mm-uval"${bar ? ' aria-hidden="true"' : ''}>${esc(val)}</span></div></div>`;
    if (!s.entries.length) html += `<p class="mm-empty">${esc(ro ? t.emptyRo : s.empty || t.empty)}</p>`;
    html += `<ol class="mm-items">${rows}</ol>`;
    if (!ro) {
      const adding = !!this.#adding[s.id];
      const armed = this.#armed?.store === s.id;
      html += `<div class="mm-fold mm-addf" data-addline${adding ? ' inert' : ' data-open'}><div class="mm-clip"><div class="mm-addline"><button type="button" class="mm-add" data-act="add-open" data-key="${escAttr(`add|${s.id}`)}" aria-expanded="${adding}" aria-controls="mm-new-${si}"><span aria-hidden="true">+</span> ${esc(t.addTo(s.label))}</button>${
        s.entries.length
          ? `<button type="button" class="mm-clear" data-act="clear" data-key="${escAttr(`clear|${s.id}`)}"${armed ? ' data-armed' : ''}>${esc(armed ? t.clearN(s.entries.length) : t.clear)}</button>`
          : ''
      }</div></div></div>
<div class="mm-fold mm-newf" id="mm-new-${si}" data-newbox${adding ? ' data-open' : ' inert'}><div class="mm-clip"><div class="mm-new"><label class="mm-label" for="mm-ta-${si}">${esc(
        t.newLabel(s.per > 0 ? fmtInt(s.per) : ''),
      )}</label><textarea id="mm-ta-${si}" class="mm-edit" data-key="${escAttr(`new|${s.id}`)}" rows="2"></textarea><div class="mm-line"><span class="mm-counter" data-count></span><span class="mm-acts is-on"><button type="button" class="mm-act" data-act="add-close" data-key="${escAttr(`addc|${s.id}`)}">${esc(t.cancel)}</button><button type="button" class="mm-act mm-act-main" data-act="add-save" data-key="${escAttr(`adds|${s.id}`)}">${esc(t.add)}</button></span></div></div></div></div>`;
    }
    return `${html}</div></section>`;
  }

  #rowHtml(s: WorkStore, i: number, text: string, key: string, t: Strings, ro: boolean): string {
    const len = text.length;
    const short = shortText(text);
    const acts = ro
      ? ''
      : `<span class="mm-acts"><button type="button" class="mm-act" data-act="edit" data-key="${escAttr(`ed|${s.id}|${key}`)}" aria-label="${escAttr(t.editName(short))}">${esc(t.edit)}</button><button type="button" class="mm-act mm-act-del" data-act="delete" data-key="${escAttr(`del|${s.id}|${key}`)}" aria-label="${escAttr(t.delName(short))}">${esc(t.del)}</button></span>`;
    return `<div class="mm-row"><p class="mm-text">${esc(text)}</p><div class="mm-meta"><span class="mm-src">#${i + 1} · ${esc(t.chars(fmtInt(len)))}${
      s.per > 0 && len > s.per ? ` · <span class="mm-over">${esc(t.over)}</span>` : ''
    }</span>${acts}</div></div>`;
  }

  #editorHtml(s: WorkStore, i: number, t: Strings): string {
    const c = this.#editCount(s, this.#editing?.draft ?? '');
    return `<div class="mm-row" data-editing><textarea class="mm-edit" data-key="${escAttr(`edit|${s.id}`)}" rows="1" aria-label="${escAttr(t.editField(s.label, i + 1))}"></textarea><div class="mm-meta"><span class="mm-counter${c.over ? ' is-over' : ''}" data-ecount>${esc(c.text)}</span><span class="mm-acts is-on"><button type="button" class="mm-act" data-act="cancel" data-key="${escAttr(`cancel|${s.id}`)}">${esc(t.cancel)}</button><button type="button" class="mm-act mm-act-main" data-act="save" data-key="${escAttr(`save|${s.id}`)}">${esc(t.save)}</button></span></div></div>`;
  }

  #editCount(s: WorkStore, draft: string): { text: string; over: boolean } {
    const n = draft.trim().length;
    return {
      text: s.per > 0 ? `${fmtInt(n)} / ${this.#t.chars(fmtInt(s.per))}` : this.#t.chars(fmtInt(n)),
      over: s.per > 0 && n > s.per,
    };
  }

  #paintCount(s: WorkStore): void {
    const el = this.#group(s.id)?.querySelector<HTMLElement>('[data-count]');
    if (!el) return;
    const t = this.#t;
    const draft = this.#drafts[s.id] ?? '';
    const total = usageAfterAdd(s.entries, s.sep, draft);
    const over = s.limit > 0 && total > s.limit ? total - s.limit : 0;
    const long = s.per > 0 && draft.trim().length > s.per;
    el.textContent =
      t.after(fmtInt(total), s.limit > 0 ? fmtInt(s.limit) : '') +
      (over ? t.overBy(fmtInt(over)) : '') +
      (long ? t.tooLong : '');
    el.classList.toggle('is-over', !!over || long);
  }

  #rowShown(s: WorkStore, i: number, text: string): boolean {
    const v = this.#view;
    if (v.store && v.store !== s.id) return false;
    if (this.#editing?.store === s.id && this.#editing.index === i) return true;
    return entryMatches(text, v.q, s);
  }

  /** Fold rows and groups to the chip + search without repainting (what is typed stays put). */
  #applyView(): void {
    const v = this.#view;
    const q = v.q.trim();
    let any = false;
    for (const g of this.$$('.mm-group')) {
      const s = this.#store(g.dataset.store);
      if (!s) continue;
      const texts = this.#painted.get(s.id) ?? [];
      let shown = 0;
      for (const f of Array.from(g.querySelectorAll<HTMLElement>('.mm-rowf'))) {
        if (f.hasAttribute('data-leaving')) continue;
        const i = Number(f.dataset.i);
        const text = texts[i] ?? '';
        const show = this.#rowShown(s, i, text);
        if (show) shown++;
        fold(f, show);
        const p = f.querySelector('.mm-text');
        const hl = show ? q : '';
        if (p && (f.dataset.hl ?? '') !== hl) {
          p.innerHTML = hl ? highlight(text, hl) : esc(text);
          f.dataset.hl = hl;
        }
      }
      if (shown) any = true;
      fold(g, (!v.store || v.store === s.id) && (shown > 0 || !q));
    }
    fold(this.$('.mm-nomatch-f'), !!q && !any);
    const nm = this.$('.mm-nomatch');
    if (nm && q) nm.textContent = this.#t.noMatch(q);
    this.#sync();
  }

  /** Chrome after any change: chip state (one tab stop) and counts, search state, head count, tray. */
  #sync(): void {
    if (!this.$('.mm')) return;
    const v = this.#view;
    const total = this.#work.reduce((n, s) => n + s.entries.length, 0);
    for (const chip of this.$$('.mm-chip')) {
      const id = chip.hasAttribute('data-all') ? null : (chip.dataset.pick ?? null);
      const on = id === v.store;
      chip.setAttribute('aria-checked', on ? 'true' : 'false');
      chip.tabIndex = on ? 0 : -1;
      const n = chip.querySelector('.mm-chip-n');
      if (n) n.textContent = fmtInt(id === null ? total : (this.#store(id)?.entries.length ?? 0));
    }
    this.$('.mm-filters')?.toggleAttribute('data-searching', v.searching);
    this.$('.mm-chips')?.toggleAttribute('inert', v.searching);
    this.$('.mm-search')?.toggleAttribute('inert', !v.searching);
    const opener = this.$('.mm-search-open');
    if (opener) {
      opener.setAttribute('aria-expanded', v.searching ? 'true' : 'false');
      opener.toggleAttribute('inert', v.searching);
    }
    this.#roll(this.$('.mm-count'), total);
    this.#paintTray();
  }

  // ── focus ──

  #byKey(key: string): HTMLElement | null {
    return this.$$('[data-key]').find((el) => el.dataset.key === key) ?? null;
  }

  #group(id: string): HTMLElement | null {
    return this.$$('.mm-group').find((g) => g.dataset.store === id) ?? null;
  }

  #chip(id: string | null): HTMLElement | null {
    return id === null ? this.#byKey('chip-all') : this.#byKey(`chip|${id}`);
  }

  #focus(el: Element | null | undefined): boolean {
    const h = el as HTMLElement | null | undefined;
    if (!h || h.closest('[inert]') || (h as HTMLButtonElement).disabled) return false;
    h.focus({ preventScroll: true });
    return true;
  }

  #focusKey(key: string): boolean {
    return this.#focus(this.#byKey(key));
  }

  #focusRow(kind: 'ed' | 'del', s: WorkStore, i: number): void {
    const key = entryKeys(s.entries)[i];
    if (!key || !this.#focusKey(`${kind}|${s.id}|${key}`))
      this.#focusKey(`add|${s.id}`) || this.#focus(this.#chip(this.#view.store));
  }

  /**
   * Repaint without losing focus: the focused key comes back (rows are keyed by content, so a host answer that
   * shifts indices keeps focus on the same entry); a key that is gone falls back to the same action on the row
   * now at that place, then the store's add button, then the selected chip.
   */
  #keepFocus(fn: () => void): void {
    // (asked of the host's root first: focus inside another shadow tree is not ours)
    const a =
      (this.getRootNode() as Document | ShadowRoot).activeElement === this
        ? (this.root.activeElement as HTMLElement | null)
        : null;
    const key = a?.dataset?.key ?? '';
    const field = a as HTMLInputElement | null;
    const sel = a && 'selectionStart' in a ? [field!.selectionStart, field!.selectionEnd] : null;
    const store = a?.closest<HTMLElement>('.mm-group')?.dataset.store;
    const at = Number(a?.closest<HTMLElement>('.mm-rowf')?.dataset.i ?? 0);
    fn();
    if (!a || a.isConnected || !key) return;
    let next = this.#byKey(key);
    if (!next || next.closest('[inert]')) {
      next = null;
      const kind = key.split('|')[0];
      const s = this.#store(store);
      if (s && (kind === 'ed' || kind === 'del')) {
        const keys = entryKeys(s.entries);
        for (let j = Math.min(at, s.entries.length - 1); j >= 0 && !next; j--) {
          const el = this.#byKey(`${kind}|${s.id}|${keys[j]}`);
          if (el && !el.closest('[inert]')) next = el;
        }
      }
      if (!next && s) {
        const add = this.#byKey(`add|${s.id}`);
        if (add && !add.closest('[inert]')) next = add;
      }
      next ??= this.#chip(this.#view.store);
    }
    if (!next) return;
    next.focus({ preventScroll: true });
    if (sel && sel[0] != null && 'setSelectionRange' in next) {
      try {
        (next as HTMLInputElement).setSelectionRange(sel[0], sel[1]);
      } catch {
        /* not a text field */
      }
    }
  }

  // ── events from the shadow tree ──

  #onClick(e: Event): void {
    const b = (e.target as Element | null)?.closest?.<HTMLElement>('[data-act]');
    if (!b || (b as HTMLButtonElement).disabled) return;
    const sid = b.closest<HTMLElement>('.mm-group')?.dataset.store ?? '';
    const row = b.closest<HTMLElement>('.mm-rowf')?.dataset.row ?? '';
    switch (b.dataset.act) {
      case 'chip':
        this.#pick(b.hasAttribute('data-all') ? null : (b.dataset.pick ?? null));
        break;
      case 'search-open':
        this.#searchOpen();
        break;
      case 'search-close':
        this.#searchClose();
        break;
      case 'edit':
        this.#editStart(sid, row);
        break;
      case 'delete':
        this.#delete(sid, row);
        break;
      case 'cancel':
        this.#editCancel();
        break;
      case 'save':
        this.#editSave();
        break;
      case 'add-open':
        this.#addOpen(sid);
        break;
      case 'add-close':
        this.#addClose(sid);
        break;
      case 'add-save':
        this.#add(sid);
        break;
      case 'clear':
        this.#clear(sid);
        break;
      case 'undo':
        this.#restore();
        break;
    }
  }

  #onKey(e: KeyboardEvent): void {
    const el = e.target as HTMLElement;
    // Key guard: a held Enter repeats the click — on a Delete that the next row's Delete replaces, that would
    // delete row after row. Repeats never activate a button.
    if (e.repeat && e.key === 'Enter' && el.tagName === 'BUTTON') {
      e.preventDefault();
      return;
    }
    if (el.closest('.mm-chips')) {
      this.#chipKey(e);
      return;
    }
    if (el.closest('.mm-search')) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.#searchClose();
      }
      return;
    }
    const key = el.dataset?.key ?? '';
    const isEdit = key.startsWith('edit|');
    if (isEdit || key.startsWith('new|')) {
      // Never while an IME is composing: Korean input commits its syllable with Enter.
      if (e.isComposing || e.keyCode === 229) return;
      const sid = el.closest<HTMLElement>('.mm-group')?.dataset.store ?? '';
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (isEdit) this.#editSave();
        else this.#add(sid);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (isEdit) this.#editCancel();
        else this.#addClose(sid);
      }
      return;
    }
    if (e.key === 'Escape' && this.#armed) {
      e.stopPropagation();
      this.#disarm();
    }
  }

  #onInput(e: Event): void {
    const el = e.target as HTMLInputElement | HTMLTextAreaElement;
    const key = el.dataset?.key ?? '';
    if (key === 'q') {
      this.#view = { store: null, q: el.value, searching: true };
      this.#applyView();
      return;
    }
    const sid = el.closest<HTMLElement>('.mm-group')?.dataset.store ?? '';
    const s = this.#store(sid);
    if (!s) return;
    if (key.startsWith('edit|') && this.#editing?.store === sid) {
      this.#editing.draft = el.value;
      grow(el as HTMLTextAreaElement);
      const c = this.#editCount(s, el.value);
      const out = el.closest('.mm-row')?.querySelector<HTMLElement>('[data-ecount]');
      if (out) {
        out.textContent = c.text;
        out.classList.toggle('is-over', c.over);
      }
    } else if (key.startsWith('new|')) {
      this.#drafts[sid] = el.value;
      grow(el as HTMLTextAreaElement);
      this.#paintCount(s);
    }
  }

  // ── chips + search ──

  #pick(id: string | null): void {
    this.#view = { ...this.#view, store: id && this.#store(id) ? id : null };
    this.#applyView();
  }

  /** One tab stop; arrows move and select (wrapping), Home / End. */
  #chipKey(e: KeyboardEvent): void {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const order: Array<string | null> = [null, ...this.#work.map((s) => s.id)];
    const cur = Math.max(0, order.indexOf(this.#view.store));
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? order.length - 1 : (cur + step + order.length) % order.length;
    this.#pick(order[next]);
    const chip = this.#chip(order[next]);
    if (chip) {
      chip.focus();
      chip.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }
  }

  #searchOpen(): void {
    this.#view = { store: null, q: '', searching: true };
    const q = this.$<HTMLInputElement>('.mm-q');
    if (q) q.value = '';
    this.#applyView();
    q?.focus();
  }

  #searchClose(): void {
    this.#view = { store: null, q: '', searching: false };
    const q = this.$<HTMLInputElement>('.mm-q');
    if (q) q.value = '';
    this.#applyView();
    this.#focusKey('search-open');
  }

  // ── edit ──

  /** The open editor's index, re-checked against its text (rows above may have moved). */
  #editIndex(s: WorkStore, e: Editing): number {
    if (s.entries[e.index] === e.orig) return e.index;
    return s.entries.indexOf(e.orig);
  }

  #editStart(sid: string, key: string): void {
    const s = this.#store(sid);
    if (!s || this.#ro) return;
    const i = entryKeys(s.entries).indexOf(key);
    if (i < 0) return;
    const prev = this.#editing;
    if (prev && prev.draft !== prev.orig && !(prev.store === sid && prev.index === i))
      this.#keepDraft(prev.store, prev.draft);
    this.#editing = { store: sid, index: i, orig: s.entries[i], draft: s.entries[i] };
    this.#disarm(false);
    this.#paintAll();
    const ta = this.#byKey(`edit|${sid}`) as HTMLTextAreaElement | null;
    if (ta) {
      ta.focus();
      ta.setSelectionRange?.(ta.value.length, ta.value.length);
      grow(ta);
    }
  }

  #editCancel(): void {
    const e = this.#editing;
    if (!e) return;
    this.#editing = null;
    const s = this.#store(e.store);
    this.#paintAll();
    if (s) this.#focusRow('ed', s, Math.max(0, this.#indexOfText(s, e.orig, e.index)));
  }

  #indexOfText(s: WorkStore, text: string, near: number): number {
    return s.entries[near] === text ? near : s.entries.indexOf(text);
  }

  #editSave(): void {
    const e = this.#editing;
    const s = e ? this.#store(e.store) : undefined;
    if (!e || !s) return;
    const ta = this.#byKey(`edit|${s.id}`) as HTMLTextAreaElement | null;
    const text = ta ? ta.value : e.draft;
    const t = this.#t;
    if (!text.trim()) {
      this.#say(t.emptyEntry, true);
      return;
    }
    const i = this.#editIndex(s, e);
    if (i < 0) return;
    // Unchanged once both sides are trimmed (the store trims what it saves): close without an event.
    if (isSameEdit(text, e.orig)) {
      this.#editing = null;
      this.#paintAll();
      this.#focusRow('ed', s, i);
      return;
    }
    const detail: MemoryEditDetail = { store: s.id, index: i, text, previous: e.orig };
    if (!this.#emitWrite('ui-edit', detail)) return;
    s.entries[i] = text;
    this.#pend('edit', detail, () => {
      const at = s.entries[i] === text ? i : s.entries.indexOf(text);
      if (at >= 0) s.entries[at] = detail.previous;
    });
    this.#editing = null;
    this.#say(t.saved);
    this.#paintAll();
    this.#focusRow('ed', s, i);
  }

  // ── delete + undo ──

  #delete(sid: string, key: string): void {
    if (this.#ro) return;
    if (this.#timers.settle) this.#paintAll(); // a previous fold still running: finish it first
    const s = this.#store(sid);
    if (!s) return;
    const i = entryKeys(s.entries).indexOf(key);
    if (i < 0) return;
    const text = s.entries[i];
    const detail: MemoryDeleteDetail = { store: sid, index: i, text };
    if (!this.#emitWrite('ui-delete', detail)) return;
    const link: UndoLink = { restored: false, refused: false };
    this.#pend('delete', detail, () => {
      link.refused = true;
      // Undo already put the text back (its restore is still on screen): the row is there once — never twice.
      if (link.restored) return;
      const at = Math.min(i, s.entries.length);
      s.entries.splice(at, 0, text);
      const ed = this.#editing;
      if (ed?.store === sid && ed.index >= at) ed.index++;
    });
    const g = this.#group(sid);
    const row = g?.querySelector<HTMLElement>(`.mm-rowf[data-i="${i}"]`) ?? null;
    if (row) {
      row.setAttribute('data-leaving', '');
      fold(row, false);
    }
    if (g && row) this.#focusAfterDelete(g, row);
    s.entries.splice(i, 1);
    const e = this.#editing;
    if (e?.store === sid && e.index > i) e.index--;
    this.#dropUndo();
    this.#undo = { store: sid, index: i, text, seq: ++this.#seq, left: UNDO_MS, started: 0, timer: 0, link };
    this.#armUndo();
    this.#disarm(false);
    this.#sync();
    // The row folds away (rows 320 ms, opacity + blur 200 ms); the groups repaint after the fold.
    if (row && !prefersReducedMotion())
      this.#timers.settle = window.setTimeout(() => {
        this.#timers.settle = 0;
        this.#paintAll();
      }, FOLD_MS);
    else this.#paintAll();
  }

  /**
   * Focus after a delete: the next row the view shows, else the nearest shown row before it, else the store's add
   * button, else the search box / the selected chip.
   */
  #focusAfterDelete(g: HTMLElement, row: HTMLElement): void {
    const rows = Array.from(g.querySelectorAll<HTMLElement>('.mm-rowf'));
    const at = rows.indexOf(row);
    const del = (f: HTMLElement) =>
      f !== row && !f.hasAttribute('data-leaving') && this.#focus(f.querySelector('[data-act="delete"]'));
    for (let j = at + 1; j < rows.length; j++) if (del(rows[j])) return;
    for (let j = at - 1; j >= 0; j--) if (del(rows[j])) return;
    if (!g.hasAttribute('inert')) {
      if (this.#focus(g.querySelector('[data-act="add-open"]'))) return;
      if (this.#focus(g.querySelector('textarea[data-key^="new|"]'))) return;
    }
    if (this.#view.searching && this.#focus(this.$('.mm-q'))) return;
    this.#focus(this.#chip(this.#view.store));
  }

  #held(): boolean {
    return this.#holds.hover || this.#holds.panel;
  }

  /** The undo window: 5 s, paused while the pointer rests on the tray or focus is anywhere in the panel. */
  #armUndo(): void {
    const u = this.#undo;
    if (!u) return;
    clearTimeout(u.timer);
    u.timer = 0;
    u.started = Date.now();
    if (this.#held() || !this.isConnected) return;
    u.timer = window.setTimeout(
      () => {
        u.timer = 0;
        if (this.#undo !== u) return;
        this.#undo = null;
        this.#paintTray();
      },
      Math.max(0, u.left),
    );
  }

  #hold(kind: 'hover' | 'panel', on: boolean): void {
    const was = this.#held();
    this.#holds[kind] = on;
    const held = this.#held();
    const u = this.#undo;
    if (held === was || !u) return;
    if (!held) this.#armUndo();
    else if (u.timer) {
      clearTimeout(u.timer);
      u.timer = 0;
      u.left = Math.max(0, u.left - (Date.now() - u.started));
    }
  }

  #dropUndo(): void {
    if (this.#undo?.timer) clearTimeout(this.#undo.timer);
    this.#undo = null;
  }

  #restore(): void {
    const u = this.#undo;
    if (!u || this.#ro) return;
    const s = this.#store(u.store);
    this.#dropUndo();
    if (!s) return;
    const detail: MemoryRestoreDetail = { store: u.store, index: u.index, text: u.text };
    if (!this.#emitWrite('ui-restore', detail)) {
      // refused: the text is not lost — it waits in the store's add box
      this.#keepDraft(s.id, u.text);
      this.#paintAll();
      this.#focusKey(`new|${s.id}`);
      return;
    }
    const at = Math.min(u.index, s.entries.length);
    s.entries.splice(at, 0, u.text);
    const e = this.#editing;
    if (e?.store === s.id && e.index >= at) e.index++;
    const link = u.link;
    link.restored = true;
    this.#pend('restore', detail, () => {
      link.restored = false;
      // The delete it undid was refused: the entry never left — what Undo put back stays.
      if (link.refused) return;
      const j = s.entries[at] === u.text ? at : s.entries.indexOf(u.text);
      if (j < 0) return;
      s.entries.splice(j, 1);
      const ed = this.#editing;
      if (ed?.store === s.id && ed.index > j) ed.index--;
    });
    this.#say(this.#t.restored);
    this.#paintAll();
    this.#reveal(s, at, true);
  }

  /** A row that came back or was added: shown under the view (else the view resets), unfolded, scrolled to. */
  #reveal(s: WorkStore, i: number, focusEdit: boolean): void {
    const text = s.entries[i];
    if (text === undefined) return;
    const v = this.#view;
    if ((v.store && v.store !== s.id) || !entryMatches(text, v.q, s)) {
      this.#view = { store: null, q: '', searching: false };
      const q = this.$<HTMLInputElement>('.mm-q');
      if (q) q.value = '';
      this.#applyView();
    }
    const key = entryKeys(s.entries)[i];
    const f = this.#group(s.id)?.querySelector<HTMLElement>(`.mm-rowf[data-i="${i}"]`);
    const reduced = prefersReducedMotion();
    if (f && !reduced) {
      f.removeAttribute('data-open');
      void f.offsetHeight; // start the unfold from closed
      f.setAttribute('data-open', '');
    }
    clearTimeout(this.#timers.scroll);
    if (f)
      this.#timers.scroll = window.setTimeout(() => {
        this.#timers.scroll = 0;
        f.scrollIntoView?.({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      }, REVEAL_SCROLL_MS);
    if (focusEdit) this.#focusKey(`ed|${s.id}|${key}`);
  }

  // ── add + clear ──

  /** A draft that has to leave its editor waits in the store's add box (appended when the box has text). */
  #keepDraft(sid: string, text: string): void {
    if (!text.trim()) return;
    const cur = this.#drafts[sid] ?? '';
    if (cur === text) return;
    this.#drafts[sid] = cur.trim() ? `${cur}\n\n${text}` : text;
    this.#adding[sid] = true;
  }

  #addOpen(sid: string): void {
    const s = this.#store(sid);
    const g = this.#group(sid);
    if (!s || !g || this.#ro) return;
    this.#adding[sid] = true;
    fold(g.querySelector('[data-addline]'), false);
    fold(g.querySelector('[data-newbox]'), true);
    g.querySelector('[data-act="add-open"]')?.setAttribute('aria-expanded', 'true');
    const ta = g.querySelector<HTMLTextAreaElement>('textarea[data-key^="new|"]');
    grow(ta);
    ta?.focus();
    this.#disarm(false);
    this.#paintTray();
  }

  /** Closing keeps the draft in the box. */
  #addClose(sid: string): void {
    const g = this.#group(sid);
    this.#adding[sid] = false;
    if (!g) return;
    fold(g.querySelector('[data-newbox]'), false);
    fold(g.querySelector('[data-addline]'), true);
    const b = g.querySelector<HTMLElement>('[data-act="add-open"]');
    b?.setAttribute('aria-expanded', 'false');
    b?.focus();
    this.#paintTray();
  }

  #add(sid: string): void {
    const s = this.#store(sid);
    if (!s || this.#ro) return;
    const ta = this.#byKey(`new|${sid}`) as HTMLTextAreaElement | null;
    const text = ta ? ta.value : (this.#drafts[sid] ?? '');
    if (!text.trim()) return;
    const detail: MemoryAddDetail = { store: sid, text };
    if (!this.#emitWrite('ui-add', detail)) return;
    s.entries.push(text);
    this.#pend('add', detail, () => {
      const at = s.entries.lastIndexOf(text);
      if (at >= 0) s.entries.splice(at, 1);
    });
    this.#drafts[sid] = '';
    this.#adding[sid] = false;
    this.#say(this.#t.added);
    this.#paintAll();
    this.#reveal(s, s.entries.length - 1, false);
    this.#focusKey(`add|${sid}`);
  }

  /** Two presses within 4 s: the first names the count, the second sends `ui-clear`. No undo. */
  #clear(sid: string): void {
    const s = this.#store(sid);
    if (!s || this.#ro || !s.entries.length) return;
    const a = this.#armed;
    if (!a || a.store !== sid || a.n !== s.entries.length) {
      this.#armed = { store: sid, n: s.entries.length, seq: ++this.#seq };
      clearTimeout(this.#timers.armed);
      this.#timers.armed = window.setTimeout(() => {
        this.#timers.armed = 0;
        this.#disarm();
      }, ARM_MS);
      this.#paintClear();
      this.#paintTray();
      return;
    }
    this.#disarm(false);
    const detail: MemoryClearDetail = { store: sid };
    if (!this.#emitWrite('ui-clear', detail)) {
      this.#paintClear();
      this.#paintTray();
      return;
    }
    const e = this.#editing;
    if (e?.store === sid) {
      this.#editing = null;
      if (e.draft !== e.orig) this.#keepDraft(sid, e.draft);
    }
    const before = s.entries;
    s.entries = [];
    this.#pend('clear', detail, () => {
      s.entries = before.concat(s.entries);
    });
    this.#say(this.#t.cleared);
    this.#paintAll();
    if (!this.#focusKey(`add|${sid}`)) this.#focusKey(`new|${sid}`);
  }

  #disarm(paint = true): void {
    clearTimeout(this.#timers.armed);
    this.#timers.armed = 0;
    if (!this.#armed) return;
    this.#armed = null;
    if (paint) {
      this.#paintClear();
      this.#paintTray();
    }
  }

  #paintClear(): void {
    const t = this.#t;
    for (const b of this.$$('.mm-clear')) {
      const s = this.#store(b.closest<HTMLElement>('.mm-group')?.dataset.store);
      const armed = !!s && this.#armed?.store === s.id;
      b.toggleAttribute('data-armed', armed);
      b.textContent = armed && s ? t.clearN(s.entries.length) : t.clear;
    }
  }

  // ── refused writes ──

  #pend(kind: string, detail: object, rollback: () => void): void {
    this.#pending.set(detail, { kind, rollback });
  }

  /** Emit a write. A `refuse()` for it while it is being dispatched counts as preventDefault() plus its message. */
  #emitWrite(name: string, detail: object): boolean {
    this.#emitting = { kind: name.replace(/^ui-/, ''), detail };
    this.#refusedNow = '';
    let ok: boolean;
    try {
      ok = this.emit(name, detail);
    } finally {
      this.#emitting = null;
    }
    const msg = this.#refusedNow;
    this.#refusedNow = '';
    if (!msg) return ok;
    this.#say(msg, true);
    return false;
  }

  /**
   * The host could not carry out a write it accepted (409, over the limit, a lock…). Pass the `ui-*` event you
   * received (or `{ type, detail }` with that detail — or a copy of it: matched by type, store, index, text and
   * previous) and the message to show. Whatever the person typed comes
   * back: an edit to its entry's editor (when `previous` is still there, once, and no other editor is open), else to
   * the store's add box; an add or a restore to the add box (opened). A refused delete withdraws its Undo; when Undo
   * already went out, the row stays on screen once whichever of the two is refused. An
   * optimistic change still on screen is rolled back; `data` set in between already is the truth. The message
   * replaces the optimistic “Saved” in the fail tone. Call it before or after you send the reloaded `data`.
   * Returns false for anything that is not a memory write.
   */
  refuse(write: MemoryWriteRefusal, message?: string): boolean {
    const d = (write?.detail ?? null) as Record<string, unknown> | null;
    const kind = String(write?.type ?? '').replace(/^ui-/, '');
    if (!d || typeof d !== 'object' || !['add', 'edit', 'delete', 'restore', 'clear'].includes(kind)) return false;
    const text = String(message ?? '').trim() || this.#t.failed;
    const now = this.#emitting;
    if (now && now.kind === kind && (d === now.detail || sameWrite(d, now.detail))) {
      this.#refusedNow = text;
      return true;
    }
    // The same detail object, else (a host that cloned the event) the oldest pending write of this kind whose
    // store, index, text and previous match.
    let key: object | undefined = this.#pending.has(d) ? d : undefined;
    if (!key)
      for (const [k, p] of this.#pending)
        if (p.kind === kind && sameWrite(d, k)) {
          key = k;
          break;
        }
    if (key) {
      this.#pending.get(key)?.rollback();
      this.#pending.delete(key);
    }
    const s = this.#store(String(d.store ?? ''));
    let focus = '';
    if (s && !this.#ro) {
      const typed = String(d.text ?? '');
      if (kind === 'edit') {
        const prev = String(d.previous ?? '');
        const at = s.entries.indexOf(prev);
        const other = this.#editing;
        if (!other && at >= 0 && s.entries.lastIndexOf(prev) === at) {
          this.#editing = { store: s.id, index: at, orig: prev, draft: typed };
          focus = `edit|${s.id}`;
        } else if (typed.trim()) {
          this.#keepDraft(s.id, typed);
          focus = `new|${s.id}`;
        }
      } else if (kind === 'add' || kind === 'restore') {
        if (typed.trim()) {
          this.#keepDraft(s.id, typed);
          focus = `new|${s.id}`;
        }
      } else if (kind === 'delete') {
        const u = this.#undo;
        if (u && u.store === s.id && u.text === typed && u.index === Number(d.index)) this.#dropUndo();
      }
    }
    if (s && kind === 'clear' && this.#armed?.store === s.id) this.#disarm(false);
    this.#say(text, true);
    if (this.isConnected) {
      const inside = this.#holds.panel;
      this.#paintAll();
      if (focus && inside) {
        const ta = this.#byKey(focus) as HTMLTextAreaElement | null;
        if (ta && this.#focus(ta)) {
          ta.setSelectionRange?.(ta.value.length, ta.value.length);
          grow(ta);
        }
      }
    } else this.requestRender();
    return true;
  }

  // ── tray ──

  #say(text: string, fail = false): void {
    const n: Notice = { text, seq: ++this.#seq, fail };
    this.#notice = n;
    clearTimeout(this.#timers.notice);
    this.#timers.notice = window.setTimeout(() => {
      this.#timers.notice = 0;
      if (this.#notice !== n) return;
      this.#notice = null;
      this.#paintTray();
    }, NOTICE_MS);
    this.#paintTray();
  }

  /** The tray line by priority: Clear armed > Deleted + Undo > a 3 s notice > editing / adding hints > counts. */
  #trayState(): TrayState {
    const t = this.#t;
    const a = this.#armed;
    const as = a ? this.#store(a.store) : undefined;
    if (a && as) return { key: `armed-${a.seq}`, html: esc(t.armed), live: t.armedSr(as.label, a.n), tone: 'warn' };
    const u = this.#undo;
    if (u)
      return {
        key: `undo-${u.seq}`,
        html: `<span class="mm-forgot"><span class="mm-flat">${esc(t.deleted[0])}</span><b class="mm-quote">${esc(u.text)}</b><span class="mm-flat">${esc(t.deleted[1])}</span></span>`,
        live: t.deletedSr(shortText(u.text)),
      };
    const n = this.#notice;
    if (n) return { key: `notice-${n.seq}`, html: esc(n.text), live: n.text, tone: n.fail ? 'fail' : '' };
    if (this.#editing) return { key: 'editing', html: esc(t.editHint), live: t.editHint };
    if (!this.#ro && this.#work.some((s) => this.#adding[s.id]))
      return { key: 'adding', html: esc(t.addHint), live: t.addHint };
    const total = this.#work.reduce((sum, s) => sum + s.entries.length, 0);
    const cap = this.#work
      .map((s) => {
        const used = fmtInt(storeUsed(s.entries, s.sep));
        return ` · ${s.label} ${s.limit > 0 ? t.of(used, fmtInt(s.limit)) : t.chars(used)}`;
      })
      .join('');
    return {
      key: 'rest',
      total,
      cap,
      html: `<b class="mm-n">${fmtInt(total)}</b>${esc(t.entries(total))}<span class="mm-cap">${esc(cap)}</span>`,
      live: `${fmtInt(total)}${t.entries(total)}${cap}`,
    };
  }

  /** Swap the caption only when the state changes (in 320 ms / out 220 ms); the same state rolls its count. */
  #paintTray(): void {
    const cap = this.$('.mm-caption');
    if (!cap) return;
    const s = this.#trayState();
    const undo = this.$<HTMLButtonElement>('.mm-undo');
    if (undo) undo.hidden = !s.key.startsWith('undo-');
    const live = this.$('.mm-live');
    if (live && live.textContent !== s.live) live.textContent = s.live;
    const cur = this.#trayItem;
    if (cur && cur.isConnected && this.#trayKey === s.key) {
      if (s.key === 'rest') {
        this.#roll(cur.querySelector('.mm-n'), s.total ?? 0);
        const c = cur.querySelector('.mm-cap');
        if (c && c.textContent !== s.cap) c.textContent = s.cap ?? '';
      }
      return;
    }
    this.#trayKey = s.key;
    if (cur) {
      cur.setAttribute('data-out', '');
      const id = window.setTimeout(
        () => {
          this.#swaps.delete(id);
          cur.remove();
        },
        prefersReducedMotion() ? 0 : SWAP_OUT_MS,
      );
      this.#swaps.add(id);
    }
    const item = document.createElement('span');
    item.className = `mm-swap${s.tone ? ` is-${s.tone}` : ''}`;
    item.innerHTML = s.html;
    cap.append(item);
    this.#trayItem = item;
    // Drop roll state of count nodes that left the DOM (each tray swap replaces its node).
    for (const [node, st] of this.#rolls) {
      if (!node.isConnected) {
        cancelAnimationFrame(st.raf);
        this.#rolls.delete(node);
      }
    }
    const nb = item.querySelector('.mm-n');
    if (nb) this.#rolls.set(nb, { n: s.total ?? 0, raf: 0 });
  }

  /** Counts roll to their new value: 520 ms, ease-out quart; at once on first paint and with reduced motion. */
  #roll(el: Element | null, to: number): void {
    if (!el) return;
    const st = this.#rolls.get(el) ?? { n: Number.NaN, raf: 0 };
    if (st.raf && st.n === to) return; // already rolling there: a second repaint must not cut it short
    const from = Number.isFinite(st.n) ? st.n : to;
    st.n = to;
    if (st.raf) cancelAnimationFrame(st.raf);
    st.raf = 0;
    this.#rolls.set(el, st);
    if (from === to || prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      el.textContent = fmtInt(to);
      return;
    }
    let t0 = 0;
    const step = (now: number) => {
      if (!t0) t0 = now;
      const p = Math.min(1, (now - t0) / ROLL_MS);
      el.textContent = fmtInt(Math.round(from + (to - from) * (1 - (1 - p) ** 4)));
      st.raf = p < 1 ? requestAnimationFrame(step) : 0;
    };
    st.raf = requestAnimationFrame(step);
  }
}

define('ui-memory-panel', UiMemoryPanel);

declare global {
  interface HTMLElementTagNameMap {
    'ui-memory-panel': UiMemoryPanel;
  }
}
