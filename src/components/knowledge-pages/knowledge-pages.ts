import { define, UiElement } from '../../core/element';
import { fmtAgo } from '../../core/format';
import { esc, escAttr } from '../../core/html';
import { markdownHtml } from '../../core/markdown';
import { morphInto } from '../../core/morph';
import { rovingIndex } from '../../core/roving';
import { icon } from '../../icons/icons';
import { typedKey } from '../../sound/sound';
import { styles } from './styles';

// ── types ──

/** Epoch ms, an ISO timestamp, or a plain `YYYY-MM-DD` date. Anything unparseable is shown as written. */
export type KnowledgeTime = number | string;

/** One row of the page list. */
export interface KnowledgePageSummary {
  /** Stable id, sent back in every event. */
  id: string;
  title: string;
  /** Other names the page goes by — searched with the title, listed under it. */
  aliases?: string[];
  /** A `groups[].id`. Pages without a known group are listed last. */
  group?: string;
  updatedAt?: KnowledgeTime;
}

/** One dated History entry. */
export interface KnowledgeHistoryEntry {
  /** As written — usually `YYYY-MM-DD`. */
  date: string;
  text: string;
}

/** The open page's full content, which the host loads after `ui-select`. */
export interface KnowledgePage {
  id: string;
  title: string;
  aliases?: string[];
  group?: string;
  /** Markdown: what is true now. */
  current: string;
  /** Dated changes, newest first. */
  history?: KnowledgeHistoryEntry[];
  /** Echoed in `ui-save` / `ui-delete` so the host can refuse a write over a newer version. */
  revision?: string | number;
  updatedAt?: KnowledgeTime;
}

export interface KnowledgePageGroup {
  id: string;
  label: string;
}

export interface KnowledgePagesData {
  pages: KnowledgePageSummary[];
  /** List headings, in order. Without groups the list is one flat list. */
  groups?: KnowledgePageGroup[];
  /** The open page id. A change of this value opens that page; leaving it as it was keeps the local selection. */
  selected?: string | null;
  /** The open page's content (its `id` must match the open page). */
  page?: KnowledgePage | null;
  /** The open page is loading — the editor shows a skeleton (unless it holds unsaved changes). */
  loading?: boolean;
  /** A `ui-save` is in flight: the fields are read-only and Save says “Saving…”. */
  saving?: boolean;
  /** The last refused write, as an alert in the editor. */
  error?: string;
  /** A quiet confirmation (“Saved”), shown while there are no unsaved changes. */
  status?: string;
  /** The page changed elsewhere: the draft stays and the editor offers Reload or Overwrite. */
  conflict?: string;
  /** No New, no editing: pages open in a reading view. */
  readOnly?: boolean;
  /** Clock for the relative times (tests). Without it the element reads Date.now() and refreshes every 30 s. */
  now?: number;
}

/** What an editor holds — the shape `isDirty` compares with a page. `aliases` may be the typed, comma-separated text. */
export interface KnowledgeDraft {
  title: string;
  aliases: string | readonly string[];
  current: string;
  history: readonly KnowledgeHistoryEntry[];
}

export interface KnowledgeSelectDetail {
  id: string;
}
export type KnowledgeNewDetail = Record<string, never>;
export interface KnowledgeSaveDetail {
  /** `null` = a new page (the host picks the id). */
  id: string | null;
  /** Trimmed, never empty. */
  title: string;
  /** Split at commas, trimmed, empties and repeats dropped. */
  aliases: string[];
  /** A new page: the group picked in the editor; an existing page: its group. */
  group?: string;
  /** Trailing whitespace trimmed. */
  current: string;
  /** Entries trimmed; empty ones dropped. */
  history: KnowledgeHistoryEntry[];
  /** The revision the draft started from. */
  revision?: string | number;
  /** “Overwrite” after a conflict: write even though the page changed since `revision`. */
  overwrite?: boolean;
}
export interface KnowledgeDeleteDetail {
  id: string;
  revision?: string | number;
}
export interface KnowledgeReloadDetail {
  id: string;
}

/** One heading of the list: a known group (in `groups` order) or the rest (`id: null`). */
export interface KnowledgeGroupBlock<T extends KnowledgePageSummary = KnowledgePageSummary> {
  id: string | null;
  label: string | null;
  pages: T[];
}

/** The window for the confirming second press of Delete. */
export const KNOWLEDGE_ARM_MS = 4000;
/** A second press sooner than this after arming is the same press (a double click), not a confirmation. */
export const KNOWLEDGE_ARM_GUARD_MS = 250;
/** Below this container width the list and the editor stack (one at a time). */
export const KNOWLEDGE_NARROW_PX = 640;
const TICK_MS = 30_000;
const FRESH_MS = 420;
const DAY_MS = 86_400_000;

type Lang = 'en' | 'ko';

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

const STRINGS = {
  en: {
    panel: 'Knowledge pages',
    pages: 'Pages',
    search: 'Search pages',
    newShort: 'New',
    newPage: 'New page',
    other: 'Other',
    emptyTitle: 'No pages yet',
    emptyText: 'Pages keep what should outlast a single session: what is true now, and how it changed.',
    emptyList: 'No pages yet',
    noMatch: (q: string) => `No pages match “${q}”`,
    clearSearch: 'Clear search',
    pick: 'Pick a page on the left',
    back: 'All pages',
    untitled: 'Untitled',
    editor: (title: string) => `Edit “${title}”`,
    updated: 'Updated',
    title: 'Title',
    titlePh: 'Page title',
    titleReq: 'A page needs a title',
    aliases: 'Aliases',
    aliasesHint: 'Other names, comma-separated',
    aliasesPh: 'e.g. ship list, go-live',
    group: 'Group',
    current: 'Current',
    currentHint: 'What is true now · markdown',
    view: 'Current view',
    edit: 'Edit',
    preview: 'Preview',
    nothing: 'Nothing to preview yet',
    history: 'History',
    historyHint: 'Dated notes, newest first',
    addEntry: 'Add entry',
    noEntries: 'No entries yet',
    entryDate: (n: number) => `Date of entry ${n}`,
    entryText: (n: number) => `Entry ${n}`,
    removeEntry: (n: number, date: string) => (date ? `Remove entry ${n} (${date})` : `Remove entry ${n}`),
    datePh: 'YYYY-MM-DD',
    save: 'Save',
    create: 'Create page',
    saving: 'Saving…',
    saveTip: (k: string) => `Save (${k})`,
    cancel: 'Cancel',
    del: 'Delete',
    armed: 'Delete?',
    armedSr: (title: string) => `Delete “${title}”? Press Delete again within 4 seconds — this cannot be undone.`,
    unsaved: 'Unsaved changes',
    unsavedSr: ', unsaved changes',
    guard: (title: string) => `Discard unsaved changes to “${title}”?`,
    guardNew: 'Discard the new page?',
    keep: 'Keep editing',
    discard: 'Discard',
    reload: 'Reload',
    overwrite: 'Overwrite with mine',
    conflictKeep: 'Your draft is still here. Reload drops it; Overwrite saves it over the newer version.',
    loading: 'Loading page…',
    readOnly: 'Read only',
    ago: (ms: number, now: number) => fmtAgo(ms, now),
    locale: 'en-US',
  },
  ko: {
    panel: '지식 페이지',
    pages: '페이지',
    search: '페이지 검색',
    newShort: '새 페이지',
    newPage: '새 페이지',
    other: '기타',
    emptyTitle: '아직 페이지가 없습니다',
    emptyText: '한 세션보다 오래 남길 지식을 정리합니다. 지금의 이해와 그동안 바뀐 기록을 함께 둡니다.',
    emptyList: '아직 페이지가 없습니다',
    noMatch: (q: string) => `“${q}”와 맞는 페이지가 없습니다`,
    clearSearch: '검색 지우기',
    pick: '왼쪽에서 페이지를 고르세요',
    back: '모든 페이지',
    untitled: '제목 없음',
    editor: (title: string) => `“${title}” 편집`,
    updated: '수정',
    title: '제목',
    titlePh: '페이지 제목',
    titleReq: '제목을 넣으세요',
    aliases: '별칭',
    aliasesHint: '다른 이름, 쉼표로 구분',
    aliasesPh: '예: 배포 목록, 출시 점검',
    group: '분류',
    current: '현재 내용',
    currentHint: '지금의 이해 · markdown',
    view: '현재 내용 보기 방식',
    edit: '편집',
    preview: '미리보기',
    nothing: '아직 미리 볼 내용이 없습니다',
    history: '변경 기록',
    historyHint: '날짜별 기록, 최신이 위',
    addEntry: '기록 추가',
    noEntries: '아직 기록이 없습니다',
    entryDate: (n: number) => `${n}번 기록 날짜`,
    entryText: (n: number) => `${n}번 기록`,
    removeEntry: (n: number, date: string) => (date ? `${n}번 기록 빼기 (${date})` : `${n}번 기록 빼기`),
    datePh: 'YYYY-MM-DD',
    save: '저장',
    create: '만들기',
    saving: '저장 중…',
    saveTip: (k: string) => `저장 (${k})`,
    cancel: '취소',
    del: '삭제',
    armed: '삭제할까요?',
    armedSr: (title: string) => `“${title}” 페이지를 지울까요? 4초 안에 삭제를 한 번 더 누르세요. 되돌릴 수 없습니다.`,
    unsaved: '저장하지 않은 변경',
    unsavedSr: ', 저장하지 않은 변경 있음',
    guard: (title: string) => `“${title}”의 저장하지 않은 변경을 버릴까요?`,
    guardNew: '새 페이지를 버릴까요?',
    keep: '계속 편집',
    discard: '버리기',
    reload: '다시 불러오기',
    overwrite: '내 수정본으로 덮어쓰기',
    conflictKeep: '작성하던 내용은 그대로 있습니다. 다시 불러오면 버려지고, 덮어쓰면 최신 내용 위에 저장됩니다.',
    loading: '페이지를 불러오는 중…',
    readOnly: '읽기 전용',
    ago: (ms: number, now: number) => agoKo(ms, now),
    locale: 'ko-KR',
  },
};
type Strings = (typeof STRINGS)['en'];

function agoKo(at: number, now: number): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 45) return '방금';
  const m = Math.floor(s / 60);
  if (m < 60) return `${Math.max(1, m)}분 전`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

// ── pure helpers (exported, unit-tested) ──

/** Aliases from a list or from typed text: split at commas, trimmed, empties and repeats dropped. */
export function parseAliases(value: string | readonly unknown[] | null | undefined): string[] {
  const list: readonly unknown[] = Array.isArray(value) ? value : String(value ?? '').split(',');
  const out: string[] = [];
  for (const a of list) {
    const s = String(a ?? '').trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

/** History entries trimmed, the empty ones (no date and no text) dropped. */
export function cleanHistory(history: unknown): KnowledgeHistoryEntry[] {
  if (!Array.isArray(history)) return [];
  const out: KnowledgeHistoryEntry[] = [];
  for (const e of history) {
    if (!e || typeof e !== 'object') continue;
    const r = e as { date?: unknown; text?: unknown };
    const date = String(r.date ?? '').trim();
    const text = String(r.text ?? '').trim();
    if (date || text) out.push({ date, text });
  }
  return out;
}

/**
 * Pages whose title or an alias contains every word of the query (case-insensitive). An empty query keeps
 * every page. Order is kept.
 */
export function filterPages<T extends KnowledgePageSummary>(pages: readonly T[], query: string): T[] {
  const list = Array.isArray(pages) ? pages.filter((p) => p && p.id != null) : [];
  const terms = String(query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!terms.length) return list;
  return list.filter((p) => {
    const hay = [p.title, ...(Array.isArray(p.aliases) ? p.aliases : [])]
      .map((s) => String(s ?? '').toLowerCase())
      .join('\n');
    return terms.every((t) => hay.includes(t));
  });
}

/**
 * The list's headings: one block per group that has pages (in `groups` order), then the pages without a known
 * group (`id: null`). Pages keep their order inside a block.
 */
export function groupPages<T extends KnowledgePageSummary>(
  pages: readonly T[],
  groups?: readonly KnowledgePageGroup[] | null,
): Array<KnowledgeGroupBlock<T>> {
  const blocks: Array<KnowledgeGroupBlock<T>> = [];
  const byId = new Map<string, KnowledgeGroupBlock<T>>();
  for (const g of Array.isArray(groups) ? groups : []) {
    if (!g || g.id == null || byId.has(String(g.id))) continue;
    const b = { id: String(g.id), label: String(g.label ?? g.id), pages: [] as T[] };
    byId.set(b.id, b);
    blocks.push(b);
  }
  const rest: T[] = [];
  for (const p of Array.isArray(pages) ? pages : []) {
    if (!p || p.id == null) continue;
    const b = p.group == null ? undefined : byId.get(String(p.group));
    if (b) b.pages.push(p);
    else rest.push(p);
  }
  const out = blocks.filter((b) => b.pages.length);
  if (rest.length) out.push({ id: null, label: null, pages: rest });
  return out;
}

interface Norm {
  title: string;
  aliases: string[];
  current: string;
  history: KnowledgeHistoryEntry[];
}

function norm(
  src: { title?: unknown; aliases?: unknown; current?: unknown; history?: unknown } | null | undefined,
): Norm {
  return {
    title: String(src?.title ?? '').trim(),
    aliases: parseAliases(src?.aliases as string | string[] | undefined),
    current: String(src?.current ?? '').trimEnd(),
    history: cleanHistory(src?.history),
  };
}

const normKey = (n: Norm): string => JSON.stringify([n.title, n.aliases, n.current, n.history]);

/**
 * True when the draft would change the page once saved: the title (trimmed), the aliases (as a cleaned list),
 * Current (trailing whitespace ignored) or the History entries (trimmed, empties ignored) differ. A `null` page
 * is a new page: dirty as soon as anything is typed.
 */
export function isDirty(
  page: Pick<KnowledgePage, 'title' | 'aliases' | 'current' | 'history'> | null | undefined,
  draft: KnowledgeDraft | null | undefined,
): boolean {
  if (!draft) return false;
  return normKey(norm(page)) !== normKey(norm(draft));
}

/** Epoch ms of a time value; a bare `YYYY-MM-DD` is local midnight. `null` when it cannot be read. */
export function knowledgeTime(at: KnowledgeTime | null | undefined): number | null {
  if (typeof at === 'number') return Number.isFinite(at) ? at : null;
  if (typeof at !== 'string' || !at.trim()) return null;
  const s = at.trim();
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])).getTime();
  const n = Date.parse(s);
  return Number.isFinite(n) ? n : null;
}

/** “5m ago” / “5분 전”; a month and more ago: the date (“Mar 4”, “2025년 3월 4일”). Unreadable: as written. */
export function knowledgeAgo(at: KnowledgeTime | null | undefined, now: number, lang: Lang = 'en'): string {
  const ms = knowledgeTime(at);
  if (ms === null) return typeof at === 'string' ? at.trim() : '';
  const t = STRINGS[lang];
  if (now - ms < 30 * DAY_MS) return t.ago(ms, now);
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString(t.locale, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** Local calendar date as `YYYY-MM-DD` (the date a new History entry starts with). */
export function isoDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── element ──

interface HistRow {
  key: string;
  date: string;
  text: string;
}
interface Draft {
  /** The page it started from (`null` = a new page). */
  base: KnowledgePage | null;
  title: string;
  aliases: string;
  group: string;
  current: string;
  history: HistRow[];
}
type Pending = { kind: 'select'; id: string } | { kind: 'new' } | { kind: 'close' };

const pub = (d: Draft): KnowledgeDraft => ({
  title: d.title,
  aliases: d.aliases,
  current: d.current,
  history: d.history,
});

function clonePage(p: KnowledgePage): KnowledgePage {
  return {
    ...p,
    id: String(p.id),
    aliases: parseAliases(p.aliases),
    history: Array.isArray(p.history)
      ? p.history.map((h) => ({ date: String(h?.date ?? ''), text: String(h?.text ?? '') }))
      : [],
  };
}

/** Same version: the revisions agree (when either has one), else the same content. */
function samePage(a: KnowledgePage | null, b: KnowledgePage): boolean {
  if (!a) return false;
  if (a.revision != null || b.revision != null) return String(a.revision ?? '') === String(b.revision ?? '');
  return normKey(norm(a)) === normKey(norm(b));
}

/**
 * `<ui-knowledge-pages>` — a master-detail editor for knowledge pages: a searchable, grouped page list and an
 * editor (title, aliases, markdown Current with a preview, dated History). Save and a two-press Delete leave as
 * cancelable `ui-*` events; the host loads pages (`ui-select`) and writes them. Unsaved changes are never lost
 * to a re-render: drafts live in the element, keyed by page id, and switching away asks first.
 */
export class UiKnowledgePages extends UiElement<KnowledgePagesData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  #sel: string | null = null;
  #creating = false;
  /** The last `data.selected` / `data.page.id` seen — a change of either moves the selection. */
  #hostSel: string | null | undefined = undefined;
  #hostPage: string | null = null;
  #drafts = new Map<string, Draft>();
  #newDraft: Draft | null = null;
  /** The last `ui-save` that went out: whose, and what it carried. */
  #sent: { id: string | null; key: string } | null = null;
  /** Pages whose `ui-delete` went out: their draft goes once they leave `pages`. */
  #deleted = new Set<string>();
  #q = '';
  #preview = false;
  #view: 'list' | 'detail' = 'list';
  #pending: Pending | null = null;
  #armed: string | null = null;
  #armedAt = 0;
  #armTimer = 0;
  #rove: string | null = null;
  #lastField = '';
  #focusNext: { key: string; scroll: boolean } | null = null;
  #fresh = new Map<string, number>();
  /** Save was tried without a title: the hint shows (a new page starts without one — no hint before that). */
  #tried = false;
  #hseq = 0;
  #tick = 0;

  constructor() {
    super();
    const r = this.root;
    r.addEventListener('click', (e) => this.#onClick(e));
    r.addEventListener('input', (e) => this.#onInput(e));
    r.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    r.addEventListener('focusin', (e) => this.#onFocusIn(e));
    r.addEventListener('focusout', (e) => this.#onFocusOut(e as FocusEvent));
  }

  override get data(): KnowledgePagesData | undefined {
    return super.data;
  }

  /** Setting data never drops a draft that holds unsaved changes (see `isDirty`). */
  override set data(value: KnowledgePagesData | undefined) {
    this.#adopt(value);
    super.data = value;
  }

  /** True while any page (or the new page) holds unsaved changes — ask before leaving the screen. */
  get dirty(): boolean {
    if (this.#newDraft && isDirty(null, pub(this.#newDraft))) return true;
    for (const d of this.#drafts.values()) if (isDirty(d.base, pub(d))) return true;
    return false;
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    clearInterval(this.#tick);
    this.#tick = window.setInterval(() => this.#paintTimes(), TICK_MS);
  }

  override disconnectedCallback(): void {
    clearInterval(this.#tick);
    this.#tick = 0;
    this.#disarm(false);
  }

  get #lang(): Lang {
    return (this.getAttribute('lang') ?? '').toLowerCase().startsWith('ko') ? 'ko' : 'en';
  }

  get #t(): Strings {
    return STRINGS[this.#lang];
  }

  #now(): number {
    const n = Number(this.data?.now);
    return Number.isFinite(n) && n > 0 ? n : Date.now();
  }

  #pages(): KnowledgePageSummary[] {
    const p = this.data?.pages;
    return Array.isArray(p) ? p.filter((x) => x && x.id != null).map((x) => ({ ...x, id: String(x.id) })) : [];
  }

  /** The loaded content of page `id` (only when `data.page` is that page). */
  #pageFor(id: string | null): KnowledgePage | null {
    const p = this.data?.page;
    return id !== null && p && typeof p === 'object' && p.id != null && String(p.id) === id ? p : null;
  }

  #groups(): KnowledgePageGroup[] {
    const g = this.data?.groups;
    return Array.isArray(g) ? g.filter((x) => x && x.id != null) : [];
  }

  // ── data ──

  #adopt(d: KnowledgePagesData | undefined): void {
    const page = d?.page && typeof d.page === 'object' && d.page.id != null ? d.page : null;
    const pid = page ? String(page.id) : null;
    const answer = !!d && !d.saving && !d.error && !d.conflict;
    let moved = false;
    if (d && d.selected !== undefined) {
      const sel = d.selected === null ? null : String(d.selected);
      if (sel !== this.#hostSel) {
        this.#openLocal(sel);
        moved = true;
      }
      this.#hostSel = sel;
    } else if (pid !== null && pid !== this.#hostPage) {
      this.#openLocal(pid);
      moved = true;
    }
    this.#hostPage = pid;

    // A new page the host created from our `ui-save`: its draft is done.
    const s = this.#sent;
    if (moved && s && s.id === null && answer) {
      if (this.#newDraft && normKey(norm(pub(this.#newDraft))) === s.key) this.#newDraft = null;
      this.#sent = null;
    }
    // A newer version of a page that has a draft: rebase unless the draft holds changes the page does not.
    if (page && pid !== null) {
      const dr = this.#drafts.get(pid);
      if (dr && !samePage(dr.base, page)) {
        const sent = this.#sent;
        const answered = !!sent && sent.id === pid && answer && sent.key === normKey(norm(pub(dr)));
        if (answered || !isDirty(dr.base, pub(dr)) || !isDirty(page, pub(dr))) this.#drafts.delete(pid);
        if (answered) this.#sent = null;
      }
    }
    if (this.#sent && d && !d.saving && (d.error || d.conflict)) this.#sent = null;

    // Deleted pages that left the list take their draft (and the selection) with them.
    if (this.#deleted.size) {
      const ids = new Set(
        (Array.isArray(d?.pages) ? d.pages : []).filter((p) => p && p.id != null).map((p) => String(p.id)),
      );
      for (const id of this.#deleted) {
        if (ids.has(id)) continue;
        this.#deleted.delete(id);
        this.#drafts.delete(id);
        if (this.#sel === id && !this.#creating) {
          this.#sel = null;
          this.#view = 'list';
        }
      }
    }
    if (d?.readOnly) {
      this.#creating = false;
      this.#pending = null;
    }
    const p = this.#pending;
    if (p && p.kind === 'select' && !(Array.isArray(d?.pages) && d.pages.some((x) => x && String(x.id) === p.id)))
      this.#pending = null;
    if (this.#armed && (this.#creating || this.#armed !== this.#sel || d?.saving || d?.readOnly)) this.#disarm(false);
  }

  /** A selection that came from the host. */
  #openLocal(id: string | null): void {
    this.#sel = id;
    this.#creating = false;
    this.#pending = null;
    this.#disarm(false);
    this.#view = id ? 'detail' : 'list';
    if (id) this.#rove = id;
  }

  // ── drafts ──

  #fromPage(page: KnowledgePage | null): Draft {
    return {
      base: page ? clonePage(page) : null,
      title: String(page?.title ?? ''),
      aliases: parseAliases(page?.aliases).join(', '),
      group: page ? String(page.group ?? '') : (this.#groups()[0]?.id ?? ''),
      current: String(page?.current ?? ''),
      history: (Array.isArray(page?.history) ? page.history : []).map((h, i) => ({
        key: `p${i}`,
        date: String(h?.date ?? ''),
        text: String(h?.text ?? ''),
      })),
    };
  }

  /** The open editor's draft, created on the first edit. */
  #draft(): Draft | null {
    if (this.data?.readOnly) return null;
    if (this.#creating) {
      this.#newDraft ??= this.#fromPage(null);
      return this.#newDraft;
    }
    const page = this.#pageFor(this.#sel);
    if (!page) return null;
    const id = String(page.id);
    let dr = this.#drafts.get(id);
    if (!dr) {
      dr = this.#fromPage(page);
      this.#drafts.set(id, dr);
    }
    return dr;
  }

  /** What the open editor shows: its draft, else the page. */
  #values(): { page: KnowledgePage | null; dr: Draft | null; v: Draft } | null {
    if (this.#creating) return { page: null, dr: this.#newDraft, v: this.#newDraft ?? this.#fromPage(null) };
    const page = this.#pageFor(this.#sel);
    if (!page) return null;
    const dr = this.#drafts.get(String(page.id)) ?? null;
    return { page, dr, v: dr ?? this.#fromPage(page) };
  }

  #draftDirty(id: string): boolean {
    const d = this.#drafts.get(id);
    return !!d && isDirty(d.base, pub(d));
  }

  /** The open editor holds unsaved changes. */
  #openDirty(): boolean {
    if (this.#creating) return !!this.#newDraft && isDirty(null, pub(this.#newDraft));
    return this.#sel !== null && this.#draftDirty(this.#sel);
  }

  #dropOpenDraft(): void {
    if (this.#creating) this.#newDraft = null;
    else if (this.#sel !== null) this.#drafts.delete(this.#sel);
  }

  // ── rendering ──

  /** The focused element inside the shadow root (null when none, or when the DOM cannot tell). */
  #active(): HTMLElement | null {
    try {
      return this.root.activeElement as HTMLElement | null;
    } catch {
      return null;
    }
  }

  protected override update(): void {
    const active = this.#active();
    const had = !!active && this.content.contains(active);
    const key = had ? active?.dataset?.key : undefined;
    morphInto(this.content, this.render());
    this.#syncFields();
    const want = this.#focusNext;
    this.#focusNext = null;
    if (want && this.#focusKey(want.key, want.scroll)) return;
    if (had && active && !active.isConnected && key) this.#focusKey(key, false);
  }

  protected render(): string {
    const d = this.data;
    if (!d) return '';
    const t = this.#t;
    const ro = !!d.readOnly;
    const pages = this.#pages();
    if (!pages.length && !this.#creating) {
      return `<section class="kp kp-none" aria-label="${escAttr(t.panel)}"><div class="kp-empty">${icon('file-text', { size: 22, class: 'kp-empty-i' })}<p class="kp-empty-t">${esc(t.emptyTitle)}</p><p class="kp-empty-s">${esc(t.emptyText)}</p>${
        ro
          ? ''
          : `<button type="button" class="kp-btn is-primary" data-act="new" data-key="new-empty">${icon('plus', { size: 14 })}<span>${esc(t.newPage)}</span></button>`
      }${d.status ? `<p class="kp-saved" role="status">${icon('check', { size: 14 })}<span>${esc(d.status)}</span></p>` : ''}</div></section>`;
    }
    const view = this.#creating || this.#sel ? this.#view : 'list';
    return `<section class="kp" data-view="${view}" aria-label="${escAttr(t.panel)}"><div class="kp-grid">${this.#listHtml(t, ro, pages)}${this.#detailHtml(t, ro)}</div></section>`;
  }

  #agoHtml(at: KnowledgeTime | undefined, now: number): string {
    const ms = knowledgeTime(at);
    if (ms === null) return typeof at === 'string' && at.trim() ? `<span class="kp-ago">${esc(at.trim())}</span>` : '';
    const d = new Date(ms);
    const full = d.toLocaleString(this.#t.locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    return `<time class="kp-ago" data-ago="${ms}" datetime="${escAttr(d.toISOString())}" title="${escAttr(full)}">${esc(
      knowledgeAgo(ms, now, this.#lang),
    )}</time>`;
  }

  #listHtml(t: Strings, ro: boolean, pages: KnowledgePageSummary[]): string {
    const groups = this.#groups();
    const shown = filterPages(pages, this.#q);
    const blocks = groupPages(shown, groups);
    const open = this.#creating ? null : this.#sel;
    const ids = blocks.flatMap((b) => b.pages.map((p) => String(p.id)));
    const rove =
      this.#rove && ids.includes(this.#rove) ? this.#rove : open && ids.includes(open) ? open : (ids[0] ?? null);
    this.#rove = rove;
    const now = this.#now();
    let body = '';
    blocks.forEach((b, bi) => {
      const hid = `kp-g${bi}`;
      const head = groups.length
        ? `<h3 class="kp-gh" id="${hid}"><span class="kp-gl">${esc(b.label ?? t.other)}</span><span class="kp-gn">${b.pages.length}</span></h3>`
        : '';
      const rows = b.pages.map((p) => this.#rowHtml(p, open, rove, now, t)).join('');
      body += `<div class="kp-gb" data-mk="${escAttr(`g|${b.id ?? ''}`)}">${head}<ul class="kp-rows"${
        groups.length ? ` aria-labelledby="${hid}"` : ` aria-label="${escAttr(t.pages)}"`
      }>${rows}</ul></div>`;
    });
    if (!shown.length) {
      const q = this.#q.trim();
      body = q
        ? `<div class="kp-nomatch"><p>${esc(t.noMatch(q))}</p><button type="button" class="kp-link" data-act="clear-q" data-key="clear-q">${esc(t.clearSearch)}</button></div>`
        : `<p class="kp-nomatch">${esc(t.emptyList)}</p>`;
    }
    const neu = ro
      ? ''
      : `<button type="button" class="kp-new" data-act="new" data-key="new" title="${escAttr(t.newPage)}"${
          t.newShort === t.newPage ? '' : ` aria-label="${escAttr(t.newPage)}"`
        }${this.#creating ? ' aria-pressed="true"' : ''}>${icon('plus', { size: 14 })}<span>${esc(t.newShort)}</span></button>`;
    return `<div class="kp-list" role="group" aria-label="${escAttr(t.pages)}"><div class="kp-tools"><div class="kp-search">${icon('search', { size: 14, class: 'kp-search-i' })}<input type="search" class="kp-q" data-f="q" data-key="q" placeholder="${escAttr(t.search)}" aria-label="${escAttr(t.search)}" autocomplete="off" spellcheck="false"></div>${neu}</div><div class="kp-scroll">${body}</div></div>`;
  }

  #rowHtml(p: KnowledgePageSummary, open: string | null, rove: string | null, now: number, t: Strings): string {
    const id = String(p.id);
    const aliases = parseAliases(p.aliases);
    const dirty = this.#draftDirty(id);
    const title = String(p.title ?? '').trim() || t.untitled;
    return `<li data-mk="${escAttr(`r|${id}`)}"><button type="button" class="kp-row" data-act="open" data-id="${escAttr(id)}" data-key="${escAttr(
      `row|${id}`,
    )}" tabindex="${id === rove ? 0 : -1}"${id === open ? ' aria-current="true"' : ''}><span class="kp-row-top"><span class="kp-row-title">${esc(
      title,
    )}</span>${dirty ? `<span class="kp-dot" title="${escAttr(t.unsaved)}"></span><span class="sr-only">${esc(t.unsavedSr)}</span>` : ''}${this.#agoHtml(
      p.updatedAt,
      now,
    )}</span>${aliases.length ? `<span class="kp-row-alias">${esc(aliases.join(' · '))}</span>` : ''}</button></li>`;
  }

  #detailHtml(t: Strings, ro: boolean): string {
    const d = this.data as KnowledgePagesData;
    const back = `<button type="button" class="kp-back" data-act="back" data-key="back">${icon('chevron-left', { size: 14 })}<span>${esc(t.back)}</span></button>`;
    let inner: string;
    let label = t.panel;
    if (this.#creating && !ro) {
      inner = this.#editorHtml(t, null);
      label = t.newPage;
    } else if (!this.#sel) {
      inner = `<div class="kp-pick">${icon('file-text', { size: 20, class: 'kp-pick-i' })}<p>${esc(t.pick)}</p>${
        d.status
          ? `<p class="kp-saved" role="status">${icon('check', { size: 14 })}<span>${esc(d.status)}</span></p>`
          : ''
      }</div>`;
    } else {
      const page = this.#pageFor(this.#sel);
      const dr = this.#drafts.get(this.#sel) ?? null;
      if (!page || (d.loading && !dr)) {
        inner = `${d.error && !page ? `<div class="kp-pad">${this.#alertHtml('fail', d.error)}</div>` : ''}${this.#skeletonHtml(t)}`;
      } else {
        label = String(page.title ?? '').trim() || t.untitled;
        inner = ro ? this.#readHtml(t, page) : this.#editorHtml(t, page);
      }
    }
    return `<div class="kp-detail" role="region" aria-label="${escAttr(label)}">${back}${this.#guardHtml(t)}${inner}</div>`;
  }

  #guardHtml(t: Strings): string {
    if (!this.#pending) return '';
    let q = t.guardNew;
    if (!this.#creating) {
      const page = this.#pageFor(this.#sel);
      q = t.guard(String(page?.title ?? '').trim() || t.untitled);
    }
    return `<div class="kp-guard" role="group" aria-labelledby="kp-guard-q">${icon('alert', { size: 14, class: 'kp-guard-i' })}<p id="kp-guard-q">${esc(
      q,
    )}</p><span class="kp-guard-acts"><button type="button" class="kp-btn is-sm" data-act="keep" data-key="guard-keep">${esc(
      t.keep,
    )}</button><button type="button" class="kp-btn is-sm is-danger" data-act="discard" data-key="guard-discard">${esc(t.discard)}</button></span></div>`;
  }

  #alertHtml(tone: 'fail' | 'wait', text: string, extra = ''): string {
    return `<div class="kp-alert is-${tone}" role="alert">${icon('alert', { size: 14, class: 'kp-alert-i' })}<div class="kp-alert-b"><p class="kp-alert-t">${esc(
      text,
    )}</p>${extra}</div></div>`;
  }

  #skeletonHtml(t: Strings): string {
    return `<div class="kp-skel" aria-busy="true"><span class="sr-only" role="status">${esc(t.loading)}</span><span class="kp-sk is-meta"></span><span class="kp-sk is-title" style="--i:1"></span><span class="kp-sk is-field" style="--i:2"></span><span class="kp-sk is-line" style="--i:3"></span><span class="kp-sk is-line" style="--i:4"></span><span class="kp-sk is-line is-short" style="--i:5"></span><span class="kp-sk is-block" style="--i:6"></span></div>`;
  }

  #groupLabel(id: string | undefined): string {
    if (id == null || id === '') return '';
    return this.#groups().find((g) => String(g.id) === String(id))?.label ?? '';
  }

  #metaHtml(t: Strings, page: KnowledgePage | null, ro: boolean): string {
    if (!page) return `<div class="kp-meta"><span class="kp-chip is-new">${esc(t.newPage)}</span></div>`;
    const sum = this.#pages().find((p) => p.id === String(page.id));
    const group = this.#groupLabel(page.group ?? sum?.group);
    const ago = this.#agoHtml(page.updatedAt ?? sum?.updatedAt, this.#now());
    return `<div class="kp-meta">${group ? `<span class="kp-chip">${esc(group)}</span>` : ''}${
      ago ? `<span class="kp-upd">${esc(t.updated)} ${ago}</span>` : ''
    }${ro ? `<span class="kp-ro">${icon('lock', { size: 12 })}<span>${esc(t.readOnly)}</span></span>` : ''}</div>`;
  }

  #readHtml(t: Strings, page: KnowledgePage): string {
    const aliases = parseAliases(page.aliases);
    const hist = cleanHistory(page.history);
    const cur = String(page.current ?? '');
    return `<article class="kp-read">${this.#metaHtml(t, page, true)}<h2 class="kp-read-title">${esc(String(page.title ?? '').trim() || t.untitled)}</h2>${
      aliases.length
        ? `<ul class="kp-aliases" aria-label="${escAttr(t.aliases)}">${aliases.map((a) => `<li class="kp-chip">${esc(a)}</li>`).join('')}</ul>`
        : ''
    }<section class="kp-sec"><h3 class="kp-label">${esc(t.current)}</h3>${
      cur.trim() ? `<div class="kp-doc md-doc">${markdownHtml(cur)}</div>` : `<p class="kp-muted">${esc(t.nothing)}</p>`
    }</section><section class="kp-sec"><h3 class="kp-label">${esc(t.history)}</h3>${
      hist.length
        ? `<ol class="kp-read-hist">${hist.map((h) => `<li><span class="kp-read-date">${esc(h.date)}</span><p>${esc(h.text)}</p></li>`).join('')}</ol>`
        : `<p class="kp-muted">${esc(t.noEntries)}</p>`
    }</section></article>`;
  }

  #editorHtml(t: Strings, page: KnowledgePage | null): string {
    const d = this.data as KnowledgePagesData;
    const vals = this.#values();
    if (!vals) return '';
    const { dr, v } = vals;
    const isNew = !page;
    const dirty = !!dr && isDirty(page, pub(dr));
    const titleOk = v.title.trim() !== '';
    const saving = !!d.saving;
    const canSave = dirty && titleOk && !saving;
    const lock = saving ? ' readonly aria-readonly="true"' : '';
    // An emptied title says so at once; a new page's missing title only once Save was tried.
    const showReq = dirty && !titleOk && (this.#tried || String(page?.title ?? '').trim() !== '');
    const pageTitle = page ? String(page.title ?? '').trim() || t.untitled : t.newPage;

    let alerts = '';
    if (page && d.conflict) {
      const over =
        dr && dirty && titleOk
          ? `<button type="button" class="kp-btn is-sm is-danger" data-act="overwrite" data-key="overwrite"${saving ? ' aria-disabled="true"' : ''}>${esc(t.overwrite)}</button>`
          : '';
      alerts += this.#alertHtml(
        'wait',
        d.conflict,
        `${dr && dirty ? `<p class="kp-alert-s">${esc(t.conflictKeep)}</p>` : ''}<span class="kp-alert-acts"><button type="button" class="kp-btn is-sm" data-act="reload" data-key="reload"${
          saving ? ' aria-disabled="true"' : ''
        }>${icon('refresh', { size: 13 })}<span>${esc(t.reload)}</span></button>${over}</span>`,
      );
    }
    if (d.error) alerts += this.#alertHtml('fail', d.error);

    const groups = this.#groups();
    const groupField =
      isNew && groups.length
        ? `<div class="kp-field kp-field-group"><label class="kp-label" for="kp-group">${esc(t.group)}</label><select id="kp-group" class="kp-input kp-select" data-f="group" data-key="f|group"${
            saving ? ' disabled' : ''
          }>${groups.map((g) => `<option value="${escAttr(g.id)}">${esc(g.label ?? g.id)}</option>`).join('')}</select></div>`
        : '';

    const hist = v.history;
    const now = Date.now();
    const rows = hist
      .map((h, i) => {
        const n = i + 1;
        const fresh = (this.#fresh.get(h.key) ?? 0) > now - FRESH_MS;
        return `<li class="kp-h" data-mk="${escAttr(`h|${h.key}`)}"${fresh ? ' data-fresh' : ''}><input type="text" class="kp-input kp-h-date" data-f="hdate" data-h="${escAttr(
          h.key,
        )}" data-key="${escAttr(`hd|${h.key}`)}" aria-label="${escAttr(t.entryDate(n))}" placeholder="${escAttr(
          t.datePh,
        )}" autocomplete="off" spellcheck="false"${lock}><div class="kp-gw kp-h-text" data-v="${escAttr(h.text)}"><textarea class="kp-input" rows="1" data-f="htext" data-h="${escAttr(
          h.key,
        )}" data-key="${escAttr(`ht|${h.key}`)}" aria-label="${escAttr(t.entryText(n))}"${lock}></textarea></div><button type="button" class="kp-icon" data-act="h-remove" data-h="${escAttr(
          h.key,
        )}" data-key="${escAttr(`hr|${h.key}`)}" aria-label="${escAttr(t.removeEntry(n, h.date.trim()))}"${
          saving ? ' aria-disabled="true"' : ''
        }>${icon('close', { size: 14 })}</button></li>`;
      })
      .join('');

    const pv = this.#preview;
    const cur = v.current;
    const armed = !!page && this.#armed === String(page.id);
    const key = MAC ? '⌘S' : 'Ctrl+S';

    let state = '';
    if (dirty && !saving)
      state = `<span class="kp-unsaved"><span class="kp-dot" aria-hidden="true"></span>${esc(t.unsaved)}</span>`;
    else if (!dirty && !saving && d.status)
      state = `<span class="kp-saved">${icon('check', { size: 14 })}<span>${esc(d.status)}</span></span>`;

    const side = isNew
      ? `<button type="button" class="kp-btn is-quiet" data-act="cancel-new" data-key="cancel-new">${esc(t.cancel)}</button>`
      : `<button type="button" class="kp-btn kp-del" data-act="delete" data-key="delete"${armed ? ' data-armed' : ''}${
          saving ? ' aria-disabled="true"' : ''
        }>${icon('trash', { size: 14 })}<span>${esc(armed ? t.armed : t.del)}</span></button>`;

    // Alerts sit above the scrolling editor: a refused save is seen wherever the editor was scrolled to.
    return `${alerts ? `<div class="kp-alerts">${alerts}</div>` : ''}<div class="kp-edit" data-mk="${escAttr(isNew ? 'new' : `p|${String(page?.id)}`)}">${this.#metaHtml(t, page, false)}<div class="kp-field"><label class="kp-label" for="kp-title">${esc(
      t.title,
    )}</label><input type="text" id="kp-title" class="kp-input kp-title" data-f="title" data-key="f|title" placeholder="${escAttr(
      t.titlePh,
    )}" autocomplete="off" required${showReq ? ' aria-invalid="true" aria-describedby="kp-title-req"' : ''}${lock}>${
      showReq ? `<p class="kp-hint is-bad" id="kp-title-req">${esc(t.titleReq)}</p>` : ''
    }</div>${groupField}<div class="kp-field"><label class="kp-label" for="kp-aliases">${esc(
      t.aliases,
    )} <span class="kp-sub">${esc(t.aliasesHint)}</span></label><input type="text" id="kp-aliases" class="kp-input" data-f="aliases" data-key="f|aliases" placeholder="${escAttr(
      t.aliasesPh,
    )}" autocomplete="off"${lock}></div><section class="kp-sec" aria-labelledby="kp-cur-l"><div class="kp-sec-head"><h3 class="kp-label" id="kp-cur-l">${esc(
      t.current,
    )}</h3><span class="kp-sub">${esc(t.currentHint)}</span><span class="kp-seg" role="group" aria-label="${escAttr(
      t.view,
    )}"><button type="button" data-act="mode" data-mode="edit" data-key="mode-edit" aria-pressed="${!pv}">${esc(
      t.edit,
    )}</button><button type="button" data-act="mode" data-mode="preview" data-key="mode-preview" aria-pressed="${pv}">${esc(
      t.preview,
    )}</button></span></div><div class="kp-gw kp-cur" data-v="${escAttr(cur)}"${pv ? ' hidden' : ''}><textarea id="kp-current" class="kp-input" data-f="current" data-key="f|current" aria-labelledby="kp-cur-l" rows="8"${lock}></textarea></div>${
      pv
        ? `<div class="kp-preview" data-key="preview" tabindex="0" role="document" aria-labelledby="kp-cur-l">${
            cur.trim()
              ? `<div class="kp-doc md-doc">${markdownHtml(cur)}</div>`
              : `<p class="kp-muted">${esc(t.nothing)}</p>`
          }</div>`
        : ''
    }</section><section class="kp-sec" aria-labelledby="kp-his-l"><div class="kp-sec-head"><h3 class="kp-label" id="kp-his-l">${esc(
      t.history,
    )}</h3><span class="kp-sub">${esc(t.historyHint)}</span><button type="button" class="kp-btn is-sm is-quiet kp-h-add" data-act="h-add" data-key="h-add"${
      saving ? ' aria-disabled="true"' : ''
    }>${icon('plus', { size: 13 })}<span>${esc(t.addEntry)}</span></button></div>${
      rows
        ? `<ol class="kp-hist" aria-labelledby="kp-his-l">${rows}</ol>`
        : `<p class="kp-muted kp-h-none">${esc(t.noEntries)}</p>`
    }</section></div><div class="kp-foot"><span class="kp-state" role="status">${state}</span><span class="sr-only" aria-live="polite">${
      armed ? esc(t.armedSr(pageTitle)) : ''
    }</span><span class="kp-acts">${side}<button type="button" class="kp-btn is-primary kp-save" data-act="save" data-key="save" title="${escAttr(
      t.saveTip(key),
    )}" aria-disabled="${!canSave}"${saving ? ' aria-busy="true"' : ''}>${esc(saving ? t.saving : isNew ? t.create : t.save)}</button></span></div>`;
  }

  /** Field values are set, not rendered: a typed value (and its caret) is only touched when the draft says otherwise. */
  #syncFields(): void {
    const q = this.$<HTMLInputElement>('.kp-q');
    if (q && q.value !== this.#q) q.value = this.#q;
    const vals = this.#values();
    if (!vals || this.data?.readOnly) return;
    const { v } = vals;
    const set = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null, value: string) => {
      if (el && el.value !== value) el.value = value;
    };
    set(this.$<HTMLInputElement>('[data-f="title"]'), v.title);
    set(this.$<HTMLInputElement>('[data-f="aliases"]'), v.aliases);
    set(this.$<HTMLTextAreaElement>('[data-f="current"]'), v.current);
    const g = this.$<HTMLSelectElement>('[data-f="group"]');
    if (g) {
      set(g, v.group);
      if (g.value !== v.group && v.group === '' && g.options.length) set(g, g.options[0].value);
    }
    const byKey = new Map(v.history.map((h) => [h.key, h]));
    for (const el of this.$$<HTMLInputElement | HTMLTextAreaElement>('[data-h][data-f]')) {
      const h = byKey.get(el.dataset.h ?? '');
      if (!h) continue;
      set(el, el.dataset.f === 'hdate' ? h.date : h.text);
    }
  }

  /** The relative times tick in place (no re-render). */
  #paintTimes(): void {
    if (Number(this.data?.now) > 0) return;
    const now = Date.now();
    for (const el of this.$$<HTMLElement>('time[data-ago]')) {
      const text = knowledgeAgo(Number(el.dataset.ago), now, this.#lang);
      if (el.textContent !== text) el.textContent = text;
    }
  }

  // ── focus ──

  #byKey(key: string): HTMLElement | null {
    return this.$$<HTMLElement>('[data-key]').find((el) => el.dataset.key === key) ?? null;
  }

  #focusKey(key: string, scroll: boolean): boolean {
    const el = this.#byKey(key);
    if (!el || el.closest('[inert],[hidden]')) return false;
    el.focus({ preventScroll: !scroll });
    return this.#active() === el;
  }

  #want(key: string, scroll = true): void {
    this.#focusNext = { key, scroll };
  }

  /** The list column is out of view (the stacked layout shows one column at a time). */
  #narrow(): boolean {
    const w = this.$('.kp')?.getBoundingClientRect().width ?? 0;
    return w > 0 && w < KNOWLEDGE_NARROW_PX;
  }

  // ── events ──

  #onFocusIn(e: Event): void {
    const el = e.target as HTMLElement | null;
    const f = el?.dataset?.f;
    if (f && f !== 'q' && el?.dataset.key) this.#lastField = el.dataset.key;
  }

  #onFocusOut(e: FocusEvent): void {
    if (!this.#armed) return;
    const from = (e.target as Element | null)?.closest?.('[data-armed]');
    if (!from) return;
    const to = e.relatedTarget as Node | null;
    if (to && from.contains(to)) return;
    this.#disarm();
  }

  #onInput(e: Event): void {
    const el = e.target as HTMLInputElement | null;
    const f = el?.dataset?.f;
    if (!el || !f) return;
    if (f === 'q') {
      this.#q = el.value;
      this.requestRender();
      return;
    }
    if (this.data?.saving) return;
    const dr = this.#draft();
    if (!dr) return;
    switch (f) {
      case 'title':
        dr.title = el.value;
        break;
      case 'aliases':
        dr.aliases = el.value;
        break;
      case 'group':
        dr.group = el.value;
        break;
      case 'current':
        dr.current = el.value;
        break;
      case 'hdate':
      case 'htext': {
        const row = dr.history.find((h) => h.key === el.dataset.h);
        if (!row) return;
        if (f === 'hdate') row.date = el.value;
        else row.text = el.value;
        break;
      }
      default:
        return;
    }
    // The grow mirror follows at once (the render that follows would too, a microtask later).
    const gw = el.parentElement;
    if (el.tagName === 'TEXTAREA' && gw?.classList.contains('kp-gw')) gw.dataset.v = el.value;
    if (this.#armed) this.#disarm(false);
    this.requestRender();
  }

  #onClick(e: Event): void {
    const b = (e.target as Element | null)?.closest?.<HTMLElement>('[data-act]');
    if (!b || !this.content.contains(b)) return;
    if (b.getAttribute('aria-disabled') === 'true') {
      if (b.dataset.act === 'save' && !this.data?.saving) {
        const v = this.#values()?.v;
        if (v && !v.title.trim() && this.#openDirty()) {
          this.#tried = true;
          this.#want('f|title');
          this.requestRender();
        }
      }
      return;
    }
    switch (b.dataset.act) {
      case 'open':
        this.#request({ kind: 'select', id: b.dataset.id ?? '' }, e);
        break;
      case 'new':
        this.#request({ kind: 'new' }, e);
        break;
      case 'cancel-new':
        this.#request({ kind: 'close' }, e);
        break;
      case 'back':
        this.#back();
        break;
      case 'keep':
        this.#keep();
        break;
      case 'discard':
        this.#discard(e);
        break;
      case 'mode':
        this.#preview = b.dataset.mode === 'preview';
        this.requestRender();
        break;
      case 'h-add':
        this.#addEntry();
        break;
      case 'h-remove':
        this.#removeEntry(b.dataset.h ?? '');
        break;
      case 'save':
        this.#save(false, e);
        break;
      case 'overwrite':
        this.#save(true, e);
        break;
      case 'reload':
        this.#reload(e);
        break;
      case 'delete':
        this.#press(e);
        break;
      case 'clear-q':
        this.#q = '';
        this.#want('q');
        this.requestRender();
        break;
    }
  }

  #onKey(e: KeyboardEvent): void {
    const el = e.target as HTMLElement | null;
    if (!el) return;
    // A keystroke that edits one of the fields (shortcuts, Escape, arrows and read-only fields never do).
    const typed = el.dataset.f && !e.defaultPrevented ? typedKey(e, el) : undefined;
    if (typed) this.sound('type', { key: typed }, e);
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
      // Anywhere in the element while a page is open for editing (list and search too), so the browser never saves the page.
      if (!this.$('.kp-edit')) return;
      e.preventDefault();
      this.#save(false, e);
      return;
    }
    if (e.key === 'Escape') {
      if (this.#pending) {
        e.preventDefault();
        e.stopPropagation();
        this.#keep();
        return;
      }
      if (this.#armed) {
        e.stopPropagation();
        this.#disarm();
        return;
      }
      if (el.dataset.f === 'q' && this.#q) {
        e.preventDefault();
        e.stopPropagation();
        this.#q = '';
        this.requestRender();
      }
      return;
    }
    // A held Enter repeats the click: on an armed Delete that would confirm on its own.
    if (e.repeat && (e.key === 'Enter' || e.key === ' ') && el.tagName === 'BUTTON') {
      e.preventDefault();
      return;
    }
    if (el.dataset.f === 'q' && e.key === 'ArrowDown') {
      const row: HTMLElement | null =
        (this.#rove ? this.#byKey(`row|${this.#rove}`) : null) ?? this.$<HTMLElement>('.kp-row');
      if (row) {
        e.preventDefault();
        row.focus();
      }
      return;
    }
    if (!el.classList.contains('kp-row')) return;
    const rows = this.$$<HTMLButtonElement>('.kp-row');
    const i = rows.indexOf(el as HTMLButtonElement);
    if (i < 0) return;
    const off = rows.map(() => false);
    let j = -1;
    if (e.key === 'ArrowDown') j = rovingIndex(off, i, 1);
    else if (e.key === 'ArrowUp') j = rovingIndex(off, i, -1);
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = rows.length - 1;
    if (j < 0) return;
    e.preventDefault();
    rows.forEach((r, k) => {
      r.tabIndex = k === j ? 0 : -1;
    });
    this.#rove = rows[j].dataset.id ?? null;
    rows[j].focus();
  }

  // ── actions ──

  /** Switch the editor — unless it holds unsaved changes: then ask first. */
  #request(a: Pending, e: Event): void {
    const d = this.data;
    if (!d) return;
    if (a.kind === 'select' && !this.#creating && a.id === this.#sel) {
      this.#pending = null;
      this.#view = 'detail';
      this.#rove = a.id;
      if (this.#narrow()) this.#want('back');
      this.requestRender();
      return;
    }
    if (a.kind === 'new' && this.#creating) {
      this.#view = 'detail';
      this.#want('f|title');
      this.requestRender();
      return;
    }
    if (a.kind === 'new' && d.readOnly) return;
    // A save in flight holds the editor: its answer must land on the page it was sent from.
    if (d.saving) return;
    if (this.#openDirty() && a.kind !== 'close') {
      this.#pending = a;
      this.#disarm(false);
      this.#view = 'detail';
      this.#want('guard-keep');
      this.requestRender();
      return;
    }
    if (a.kind === 'close' && this.#openDirty()) {
      this.#pending = a;
      this.#want('guard-keep');
      this.requestRender();
      return;
    }
    this.#run(a, e);
  }

  /** Carry out a switch (the guard is answered or was not needed). False when the host prevented it. */
  #run(a: Pending, e: Event): boolean {
    if (a.kind === 'select') {
      const detail: KnowledgeSelectDetail = { id: a.id };
      if (!this.emit('ui-select', detail)) return false;
      this.sound('select', undefined, e);
      this.#dropOpenDraft();
      this.#sel = a.id;
      this.#creating = false;
      this.#view = 'detail';
      this.#rove = a.id;
      this.#want(this.#narrow() ? 'back' : `row|${a.id}`, false);
    } else if (a.kind === 'new') {
      const detail: KnowledgeNewDetail = {};
      if (!this.emit('ui-new', detail)) return false;
      this.sound('tap', undefined, e);
      this.#dropOpenDraft();
      this.#creating = true;
      this.#preview = false;
      this.#view = 'detail';
      this.#want('f|title');
    } else {
      this.#newDraft = null;
      this.#creating = false;
      this.#view = this.#sel ? 'detail' : 'list';
      this.#want(this.#sel && !this.#narrow() ? `row|${this.#sel}` : 'new');
    }
    this.#pending = null;
    this.#tried = false;
    this.#disarm(false);
    this.requestRender();
    return true;
  }

  #keep(): void {
    if (!this.#pending) return;
    this.#pending = null;
    this.#want(this.#lastField && this.#byKey(this.#lastField) ? this.#lastField : 'f|title');
    this.requestRender();
  }

  #discard(e: Event): void {
    const a = this.#pending;
    if (!a) return;
    if (!this.#run(a, e)) {
      this.#pending = null;
      this.#want('f|title');
      this.requestRender();
    }
  }

  #back(): void {
    this.#view = 'list';
    this.#pending = null;
    this.#want(this.#sel && !this.#creating ? `row|${this.#sel}` : 'q');
    this.requestRender();
  }

  #addEntry(): void {
    if (this.data?.saving) return;
    const dr = this.#draft();
    if (!dr) return;
    const key = `n${++this.#hseq}`;
    dr.history.unshift({ key, date: isoDay(this.#now()), text: '' });
    this.#fresh.set(key, Date.now());
    this.#want(`ht|${key}`);
    this.requestRender();
  }

  #removeEntry(key: string): void {
    if (this.data?.saving) return;
    const dr = this.#draft();
    if (!dr) return;
    const i = dr.history.findIndex((h) => h.key === key);
    if (i < 0) return;
    dr.history.splice(i, 1);
    const next = dr.history[i] ?? dr.history[i - 1];
    this.#want(next ? `hr|${next.key}` : 'h-add');
    this.requestRender();
  }

  #save(overwrite: boolean, e: Event): void {
    const d = this.data;
    if (!d || d.readOnly || d.saving) return;
    const isNew = this.#creating;
    const page = isNew ? null : this.#pageFor(this.#sel);
    if (!isNew && !page) return;
    const dr = isNew ? this.#newDraft : this.#drafts.get(String(page?.id));
    if (!dr || !isDirty(page, pub(dr))) return;
    const n = norm(pub(dr));
    if (!n.title) {
      this.#tried = true;
      this.#want('f|title');
      this.requestRender();
      return;
    }
    if (overwrite && !d.conflict) return;
    const detail: KnowledgeSaveDetail = {
      id: page ? String(page.id) : null,
      title: n.title,
      aliases: n.aliases,
      current: n.current,
      history: n.history,
    };
    const group = isNew ? dr.group : page?.group;
    if (group != null && group !== '') detail.group = String(group);
    const rev = dr.base?.revision;
    if (rev != null) detail.revision = rev;
    if (overwrite) detail.overwrite = true;
    this.#disarm(false);
    if (this.emit('ui-save', detail)) {
      this.#sent = { id: detail.id, key: normKey(n) };
      this.sound('tap', undefined, e);
    }
    this.requestRender();
  }

  #reload(e: Event): void {
    if (this.#creating || !this.#sel || this.data?.saving) return;
    const detail: KnowledgeReloadDetail = { id: this.#sel };
    if (!this.emit('ui-reload', detail)) return;
    this.sound('tap', { emphasis: 'subtle' }, e);
    this.#drafts.delete(this.#sel);
    this.#sent = null;
    this.requestRender();
  }

  /** First press arms (“Delete?”), a second within 4 s confirms; Esc, blur, typing or the timeout disarm. */
  #press(e: Event): void {
    const d = this.data;
    const page = this.#creating ? null : this.#pageFor(this.#sel);
    if (!d || !page || d.saving || d.readOnly) return;
    const id = String(page.id);
    const now = Date.now();
    if (this.#armed === id) {
      const since = now - this.#armedAt;
      if (since < KNOWLEDGE_ARM_GUARD_MS) return;
      if (since < KNOWLEDGE_ARM_MS) {
        this.#disarm(false);
        const detail: KnowledgeDeleteDetail = { id };
        if (page.revision != null) detail.revision = page.revision;
        if (this.emit('ui-delete', detail)) {
          this.#deleted.add(id);
          this.sound('close', { emphasis: 'strong' }, e);
        }
        this.requestRender();
        return;
      }
    }
    this.#armed = id;
    this.#armedAt = now;
    clearTimeout(this.#armTimer);
    this.#armTimer = window.setTimeout(() => this.#disarm(), KNOWLEDGE_ARM_MS);
    this.sound('tap', { emphasis: 'subtle' }, e);
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
}

define('ui-knowledge-pages', UiKnowledgePages);

declare global {
  interface HTMLElementTagNameMap {
    'ui-knowledge-pages': UiKnowledgePages;
  }
}
