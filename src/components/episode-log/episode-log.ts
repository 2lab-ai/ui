import { define, UiElement } from '../../core/element';
import { esc, escAttr } from '../../core/html';
import { morphInto } from '../../core/morph';
import { icon } from '../../icons/icons';
import { typedKey } from '../../sound/sound';
import { styles } from './styles';

export type EpisodeLang = 'en' | 'ko';

/** One observation. */
export interface EpisodeEntry {
  /** Stable id. Without it an entry is known by its day, time and text. */
  id?: string;
  /** The time as the host shows it ("09:12"). Or `at`. */
  time?: string;
  /** The moment (epoch ms or ISO) — shown as the local HH:MM when `time` is not given. */
  at?: number | string;
  /** What was observed (plain text; line breaks kept). */
  text: string;
}

/** One day of the log. */
export interface EpisodeDay {
  /** YYYY-MM-DD. */
  date: string;
  entries: EpisodeEntry[];
  /** The day's revision; edits and deletes carry it back (for a conditional write). */
  revision?: string | number;
}

export interface EpisodeLogData {
  /** The days the host has loaded (any order; shown newest first). */
  days: EpisodeDay[];
  /** Every date that has entries — the filter's choices. Default: the loaded days' dates. */
  dates?: string[];
  /** The filter: one day (YYYY-MM-DD), or null / '' for every loaded day. */
  date?: string | null;
  /** YYYY-MM-DD the log calls "Today" (default: the local date). */
  today?: string;
  /** A word after each time ("UTC"). */
  timeLabel?: string;
  /** A day is on its way: skeleton entries. */
  loading?: boolean;
  /** A write is out: edit, delete and add wait (their buttons say so). */
  busy?: boolean;
  /** A quiet line ("Saved"). */
  status?: string;
  /** What went wrong (an alert line; drafts stay). */
  error?: string;
  /** Show entries only: no edit, delete or add. */
  readOnly?: boolean;
  /** Offer the note box. Default true (unless readOnly). */
  canAdd?: boolean;
  /** The note box's label. Default "Add a note to today’s log". */
  addLabel?: string;
  /** The note box's placeholder. */
  placeholder?: string;
  /** Empty-state text when there is nothing at all. */
  emptyText?: string;
}

/** `ui-date` detail (cancelable): the filter changed. Not prevented, a loaded day is shown at once. */
export interface EpisodeDateDetail {
  date: string | null;
}

/** `ui-edit` detail (cancelable): save the entry's new text. */
export interface EpisodeEditDetail {
  date: string;
  index: number;
  id?: string;
  /** The text the editor opened on (to find the entry if the day changed meanwhile). */
  original: string;
  text: string;
  revision?: string | number;
}

/** `ui-delete` detail (cancelable, after the two-press). */
export interface EpisodeDeleteDetail {
  date: string;
  index: number;
  id?: string;
  text: string;
  revision?: string | number;
}

/** `ui-add` detail (cancelable): add a note to today's log. */
export interface EpisodeAddDetail {
  text: string;
}

/** How long a first press on Delete stays armed. */
export const EPISODE_ARM_MS = 4000;

const STRINGS = {
  en: {
    label: 'Observation log',
    filter: 'Day',
    allDays: 'All days',
    today: 'Today',
    yesterday: 'Yesterday',
    entries: (n: number) => (n === 1 ? '1 entry' : `${n} entries`),
    edit: 'Edit',
    del: 'Delete',
    delArmed: 'Delete?',
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    add: 'Add note',
    adding: 'Adding…',
    addLabel: 'Add a note to today’s log',
    placeholder: 'Something the agent should remember about today',
    empty: 'No entries yet. They collect here as the agent works.',
    emptyDay: 'Nothing recorded on this day.',
    blank: 'An empty entry can’t be saved — delete it instead.',
    editOf: (t: string) => `Edit the ${t} entry`,
    kept: (t: string) => `Your unsaved edit of the ${t} entry moved to the note box.`,
    keys: '⌘↵ to save · Esc to cancel',
  },
  ko: {
    label: '관찰 기록',
    filter: '날짜',
    allDays: '모든 날짜',
    today: '오늘',
    yesterday: '어제',
    entries: (n: number) => `${n}개`,
    edit: '수정',
    del: '삭제',
    delArmed: '삭제할까요?',
    save: '저장',
    saving: '저장 중…',
    cancel: '취소',
    add: '메모 추가',
    adding: '추가 중…',
    addLabel: '오늘 기록에 메모 추가',
    placeholder: '에이전트가 오늘에 대해 기억할 내용',
    empty: '아직 기록이 없습니다. 에이전트가 일하는 동안 여기에 쌓입니다.',
    emptyDay: '이 날의 기록이 없습니다.',
    blank: '비어 있는 기록은 저장할 수 없습니다 — 지우려면 삭제하세요.',
    editOf: (t: string) => `${t} 기록 수정`,
    kept: (t: string) => `저장하지 않은 ${t} 기록 수정본을 메모 칸에 옮겼습니다.`,
    keys: '⌘↵ 저장 · Esc 취소',
  },
};
export type EpisodeStrings = (typeof STRINGS)['en'];

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** YYYY-MM-DD of a moment in local time. */
export function episodeDateOf(at: number | Date = Date.now()): string {
  const d = at instanceof Date ? at : new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A day's heading: "Today" / "Yesterday" / "Thu, Oct 30" (ko: 오늘 / 어제 / 10월 30일 (목)); a year when it is not this one. */
export function fmtEpisodeDay(date: string, lang: EpisodeLang = 'en', today: string = episodeDateOf()): string {
  const t = lang === 'ko' ? STRINGS.ko : STRINGS.en;
  const m = DATE_RE.exec(date);
  if (!m) return date;
  if (date === today) return t.today;
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const tm = DATE_RE.exec(today);
  if (tm) {
    const td = new Date(Number(tm[1]), Number(tm[2]) - 1, Number(tm[3]));
    if (Math.round((td.getTime() - day.getTime()) / 86_400_000) === 1) return t.yesterday;
  }
  const sameYear = tm ? tm[1] === m[1] : true;
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  if (!sameYear) opts.year = 'numeric';
  return new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : 'en-US', opts).format(day);
}

/** The time an entry shows: its `time`, else the local HH:MM of `at`, else ''. */
export function episodeTime(e: EpisodeEntry): string {
  if (e.time) return String(e.time);
  if (e.at === undefined || e.at === null || e.at === '') return '';
  const ms = typeof e.at === 'number' ? e.at : Date.parse(String(e.at));
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** What identifies an entry across updates: its id, else its day, time and text. */
export function episodeKey(date: string, e: EpisodeEntry): string {
  return e.id ? `id:${e.id}` : `${date}|${episodeTime(e)}|${e.text}`;
}

/** The days to show, newest first: one day when the filter names it, else every loaded day. */
export function episodeDays(days: EpisodeDay[] | undefined, date?: string | null): EpisodeDay[] {
  const list = (Array.isArray(days) ? days : []).filter((d) => d && typeof d.date === 'string');
  const shown = date ? list.filter((d) => d.date === date) : list;
  return shown.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** The filter's choices, newest first, without repeats. */
export function episodeDates(data: Pick<EpisodeLogData, 'days' | 'dates'>): string[] {
  const all = Array.isArray(data.dates) && data.dates.length ? data.dates : (data.days ?? []).map((d) => d.date);
  return Array.from(new Set(all.filter((d) => typeof d === 'string' && d))).sort((a, b) =>
    a < b ? 1 : a > b ? -1 : 0,
  );
}

interface Editor {
  key: string;
  date: string;
  index: number;
  id?: string;
  original: string;
  time: string;
  draft: string;
  saving: boolean;
}

/**
 * `<ui-episode-log>` — a dated observation log: entries grouped by day under a day filter; edit an entry in place,
 * delete it with two presses, add a note to today. Data in (`days`, `dates`, `date` …), events out (`ui-date`,
 * `ui-edit`, `ui-delete`, `ui-add`). Drafts survive the host updating `data`: an open editor stays on its entry,
 * and if that entry changed meanwhile the draft moves to the note box instead of being lost.
 */
export class UiEpisodeLog extends UiElement<EpisodeLogData> {
  static override styles = [styles];
  static get observedAttributes(): string[] {
    return ['lang'];
  }

  #editor: Editor | null = null;
  #note = '';
  #notePending = '';
  #notice = '';
  #armed: string | null = null;
  #armTimer: ReturnType<typeof setTimeout> | undefined;
  #filter: string | null | undefined;
  #hostDate: string | null | undefined;
  #seen = new Set<string>();
  #painted = false;

  constructor() {
    super();
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('input', (e) => this.#onInput(e));
    this.root.addEventListener('change', (e) => this.#onChange(e));
    this.root.addEventListener('keydown', (e) => this.#onKey(e as KeyboardEvent));
    this.root.addEventListener('focusout', (e) => {
      const to = (e as FocusEvent).relatedTarget as Element | null;
      if (this.#armed && !to?.closest?.('[data-act="delete"]')) this.#disarm();
    });
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override set data(v: EpisodeLogData | undefined) {
    // A day the reader picked stays picked until the host names another one.
    const hostDate = v?.date ?? null;
    if (hostDate !== this.#hostDate) this.#filter = undefined;
    this.#hostDate = hostDate;
    this.#reconcile(v);
    super.data = v;
  }
  override get data(): EpisodeLogData | undefined {
    return super.data;
  }

  override disconnectedCallback(): void {
    clearTimeout(this.#armTimer);
    super.disconnectedCallback();
  }

  get #t(): EpisodeStrings {
    return this.getAttribute('lang') === 'ko' ? STRINGS.ko : STRINGS.en;
  }

  /** The note box's text (what `ui-add` would send). */
  get note(): string {
    return this.#note;
  }

  /** Empty the note box (after a note the host added). */
  clearNote(): void {
    this.#note = '';
    this.#notePending = '';
    const box = this.$<HTMLTextAreaElement>('.el-note');
    if (box) box.value = '';
    this.requestRender();
  }

  /** Close the open editor (its draft is dropped). */
  closeEditor(): void {
    this.#editor = null;
    this.requestRender();
  }

  /** The editor across an update: still there → keep; saved (the entry now reads the draft) → close; gone → note box. */
  #reconcile(next: EpisodeLogData | undefined): void {
    const ed = this.#editor;
    const days = next?.days ?? [];
    if (ed) {
      const day = days.find((d) => d.date === ed.date);
      const entries = day?.entries ?? [];
      const at = entries.findIndex((e) => episodeKey(ed.date, e) === ed.key);
      const cur = at >= 0 ? entries[at] : undefined;
      if (ed.saving && entries.some((e) => e.text === ed.draft && (!ed.id || e.id === ed.id))) {
        // Saved: the entry reads the draft now.
        this.#editor = null;
      } else if (cur && cur.text === ed.original) {
        // Still the entry it opened on: keep it open; a refused or unanswered save makes it editable again.
        ed.index = at;
        if (ed.saving && (next?.error || !next?.busy)) ed.saving = false;
      } else if (cur && ed.draft === ed.original) {
        // Changed elsewhere before anything was typed: follow the new text.
        ed.index = at;
        ed.original = cur.text;
        ed.draft = cur.text;
        ed.saving = false;
      } else if (day || !next?.loading) {
        // Changed or gone under the editor (or its day left the view): never lose what was typed.
        this.#keepDraft(ed);
        this.#editor = null;
      }
    }
    if (this.#notePending) {
      const today = next?.today ?? episodeDateOf();
      const landed = days.some((d) => d.date === today && d.entries.some((e) => e.text === this.#notePending));
      if (landed) {
        if (this.#note === this.#notePending) this.#note = '';
        this.#notePending = '';
      } else if (next?.error || !next?.busy) this.#notePending = '';
    }
  }

  #keepDraft(ed: Editor): void {
    if (ed.draft === ed.original || !ed.draft.trim()) return;
    this.#note = this.#note.trim() ? `${this.#note}\n\n${ed.draft}` : ed.draft;
    this.#notice = this.#t.kept(ed.time || ed.date);
  }

  #disarm(): void {
    clearTimeout(this.#armTimer);
    if (!this.#armed) return;
    this.#armed = null;
    this.requestRender();
  }

  protected render(): string {
    const d = this.data ?? { days: [] };
    const t = this.#t;
    const filter = this.#filter !== undefined ? this.#filter : (d.date ?? null);
    const dates = episodeDates(d);
    const days = episodeDays(d.days, filter);
    const today = d.today ?? episodeDateOf();
    const lang = this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
    const busy = !!d.busy;
    const ro = !!d.readOnly;
    const options = [`<option value="">${esc(t.allDays)}</option>`]
      .concat(
        dates.map(
          (x) =>
            `<option value="${escAttr(x)}"${x === filter ? ' selected' : ''}>${esc(fmtEpisodeDay(x, lang, today))}${x === today ? '' : ` · ${esc(x)}`}</option>`,
        ),
      )
      .join('');
    const bar = `<div class="el-bar"><label class="el-filter"><span>${esc(t.filter)}</span><select class="el-select" data-act="filter" data-key="filter"${dates.length ? '' : ' disabled'}>${options}</select></label>${
      d.status
        ? `<p class="el-status" role="status">${icon('check', { size: 12 })}<span>${esc(d.status)}</span></p>`
        : '<p class="el-status" role="status"></p>'
    }</div>`;
    const alert = d.error
      ? `<div class="el-alert" role="alert">${icon('alert', { size: 14 })}<span>${esc(d.error)}</span></div>`
      : '';
    const notice = this.#notice
      ? `<p class="el-notice" role="status">${icon('info', { size: 14 })}<span>${esc(this.#notice)}</span></p>`
      : '';
    let body: string;
    if (d.loading && !days.length) {
      body = `<div class="el-skel" aria-hidden="true">${[0, 1, 2]
        .map(
          (i) =>
            `<div class="el-sk-row" style="--i:${i}"><span class="el-sk is-time"></span><span class="el-sk"></span></div>`,
        )
        .join('')}</div>`;
    } else if (!days.length || days.every((x) => !x.entries?.length)) {
      const text = filter ? t.emptyDay : d.emptyText || t.empty;
      body = `<div class="el-empty">${icon('clock', { size: 20 })}<p>${esc(text)}</p></div>`;
    } else {
      body = days
        .map((day) => {
          const entries = Array.isArray(day.entries) ? day.entries : [];
          if (!entries.length && !filter) return '';
          const head = `<h3 class="el-day"><span>${esc(fmtEpisodeDay(day.date, lang, today))}</span><small>${esc(t.entries(entries.length))}</small></h3>`;
          const rows = entries.length
            ? entries.map((e, i) => this.#entry(day, e, i, { busy, ro, label: d.timeLabel })).join('')
            : `<li class="el-none">${esc(t.emptyDay)}</li>`;
          return `<section class="el-group" data-mk="day:${escAttr(day.date)}" aria-label="${escAttr(fmtEpisodeDay(day.date, lang, today))}">${head}<ol class="el-list">${rows}</ol></section>`;
        })
        .join('');
    }
    const canAdd = !ro && d.canAdd !== false;
    const adding = !!this.#notePending && busy;
    const add = canAdd
      ? `<div class="el-add"><label class="el-add-label" for="el-note">${esc(d.addLabel || t.addLabel)}</label><textarea id="el-note" class="el-note" data-key="note" rows="2" placeholder="${escAttr(d.placeholder || t.placeholder)}"${adding ? ' disabled' : ''}>${esc(this.#note)}</textarea><div class="el-add-row"><button type="button" class="el-btn is-primary" data-act="add" data-key="add"${!this.#note.trim() || busy ? ' disabled' : ''}>${esc(adding ? t.adding : t.add)}</button></div></div>`
      : '';
    return `<section class="el" aria-label="${escAttr(t.label)}">${bar}${alert}${notice}<div class="el-days">${body}</div>${add}</section>`;
  }

  #entry(day: EpisodeDay, e: EpisodeEntry, i: number, o: { busy: boolean; ro: boolean; label?: string }): string {
    const t = this.#t;
    const key = episodeKey(day.date, e);
    const time = episodeTime(e);
    const fresh = this.#painted && !this.#seen.has(key);
    const when = time
      ? `<span class="el-time">${esc(time)}${o.label ? ` <small>${esc(o.label)}</small>` : ''}</span>`
      : '';
    const ed = this.#editor;
    if (ed && ed.key === key && ed.date === day.date) {
      const blank = !ed.draft.trim();
      return `<li class="el-entry is-editing" data-mk="${escAttr(key)}">${when}<div class="el-main"><textarea class="el-edit" data-key="edit" rows="3" aria-label="${escAttr(t.editOf(time || day.date))}"${ed.saving ? ' disabled' : ''}>${esc(ed.draft)}</textarea>${
        blank ? `<p class="el-hint is-error" role="alert">${esc(t.blank)}</p>` : `<p class="el-hint">${esc(t.keys)}</p>`
      }<div class="el-actions"><button type="button" class="el-btn is-primary" data-act="save" data-key="save"${blank || ed.saving || ed.draft === ed.original ? ' disabled' : ''}>${esc(ed.saving ? t.saving : t.save)}</button><button type="button" class="el-btn" data-act="cancel" data-key="cancel"${ed.saving ? ' disabled' : ''}>${esc(t.cancel)}</button></div></div></li>`;
    }
    const armed = this.#armed === key;
    const actions = o.ro
      ? ''
      : `<div class="el-actions is-quiet"><button type="button" class="el-link" data-act="edit" data-i="${i}" data-date="${escAttr(day.date)}" data-key="edit:${escAttr(key)}"${o.busy ? ' disabled' : ''}>${icon('edit', { size: 12 })}${esc(t.edit)}</button><button type="button" class="el-link${armed ? ' is-armed' : ''}" data-act="delete" data-i="${i}" data-date="${escAttr(day.date)}" data-key="del:${escAttr(key)}"${o.busy ? ' disabled' : ''}${armed ? ' aria-live="polite"' : ''}>${icon('trash', { size: 12 })}${esc(armed ? t.delArmed : t.del)}</button></div>`;
    return `<li class="el-entry${fresh ? ' is-new' : ''}" data-mk="${escAttr(key)}">${when}<div class="el-main"><p class="el-text">${esc(e.text)}</p>${actions}</div></li>`;
  }

  protected override update(): void {
    // Morph so the open editor, the note box and their carets survive an update.
    const focus = this.root.activeElement as HTMLElement | null;
    const key = focus?.dataset?.key;
    const sel =
      focus && (focus.localName === 'textarea' || focus.localName === 'input')
        ? [(focus as HTMLTextAreaElement).selectionStart, (focus as HTMLTextAreaElement).selectionEnd]
        : null;
    morphInto(this.content, this.render());
    for (const ta of this.$$<HTMLTextAreaElement>('textarea')) {
      const want =
        ta.dataset.key === 'note' ? this.#note : ta.dataset.key === 'edit' ? (this.#editor?.draft ?? '') : ta.value;
      if (ta.value !== want) ta.value = want;
      this.#grow(ta);
    }
    if (key) {
      const next = this.$$<HTMLElement>('[data-key]').find((el) => el.dataset.key === key);
      if (next && next !== this.root.activeElement && !next.hasAttribute('disabled'))
        next.focus({ preventScroll: true });
      if (next && sel && 'setSelectionRange' in next) {
        try {
          (next as HTMLTextAreaElement).setSelectionRange(sel[0] ?? 0, sel[1] ?? 0);
        } catch {
          // not a text control any more
        }
      }
    }
    this.updated();
  }

  protected override updated(): void {
    for (const day of this.data?.days ?? []) for (const e of day.entries ?? []) this.#seen.add(episodeKey(day.date, e));
    if (this.isConnected) this.#painted = true;
  }

  #grow(ta: HTMLTextAreaElement): void {
    ta.style.height = 'auto';
    if (ta.scrollHeight) ta.style.height = `${ta.scrollHeight + 2}px`;
  }

  #entryAt(date: string, i: number): { day: EpisodeDay; entry: EpisodeEntry } | null {
    const day = (this.data?.days ?? []).find((d) => d.date === date);
    const entry = day?.entries?.[i];
    return day && entry ? { day, entry } : null;
  }

  #onInput(e: Event): void {
    const ta = e.target as HTMLTextAreaElement;
    if (ta.dataset?.key === 'note') {
      this.#note = ta.value;
      this.#grow(ta);
      const add = this.$<HTMLButtonElement>('[data-act="add"]');
      if (add) add.disabled = !this.#note.trim() || !!this.data?.busy;
    } else if (ta.dataset?.key === 'edit' && this.#editor) {
      const wasBlank = !this.#editor.draft.trim();
      this.#editor.draft = ta.value;
      this.#grow(ta);
      if (wasBlank !== !ta.value.trim()) this.requestRender();
      else {
        const save = this.$<HTMLButtonElement>('[data-act="save"]');
        if (save) save.disabled = !ta.value.trim() || ta.value === this.#editor.original || this.#editor.saving;
      }
    }
  }

  #onChange(e: Event): void {
    const sel = e.target as HTMLSelectElement;
    if (sel.dataset?.act !== 'filter') return;
    const date = sel.value || null;
    const was = this.#filter !== undefined ? this.#filter : (this.data?.date ?? null);
    if (!this.emit<EpisodeDateDetail>('ui-date', { date })) {
      // The host keeps the filter: put the picker back.
      this.requestRender();
      return;
    }
    // A later day is forward, an earlier one (or All days) back. No event: a select's change tells nothing of
    // what picked it.
    this.sound('navigate', { emphasis: 'subtle', direction: (date ?? '') > (was ?? '') ? 'forward' : 'back' });
    this.#filter = date;
    this.requestRender();
  }

  #onKey(e: KeyboardEvent): void {
    const el = e.target as HTMLElement;
    const mod = e.metaKey || e.ctrlKey;
    if (el.dataset?.key === 'edit') {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.#cancelEdit();
      } else if (e.key === 'Enter' && mod) {
        e.preventDefault();
        this.#save(e);
      }
    } else if (el.dataset?.key === 'note' && e.key === 'Enter' && mod) {
      e.preventDefault();
      this.#add(e);
    } else if (e.key === 'Escape' && this.#armed) {
      e.preventDefault();
      this.#disarm();
    }
    const box = el.dataset?.key === 'note' || el.dataset?.key === 'edit';
    const typed = box && !e.defaultPrevented ? typedKey(e, el) : undefined;
    if (typed) this.sound('type', { key: typed }, e);
  }

  #onClick(e: Event): void {
    const btn = (e.target as Element | null)?.closest?.<HTMLElement>('[data-act]');
    if (!btn || btn.hasAttribute('disabled') || btn.localName === 'select') return;
    const act = btn.dataset.act;
    if (act === 'add' || act === 'save' || act === 'cancel') {
      if (act === 'add') this.#add(e);
      else if (act === 'save') this.#save(e);
      else this.#cancelEdit();
      return;
    }
    const date = btn.dataset.date ?? '';
    const i = Number(btn.dataset.i);
    const hit = this.#entryAt(date, i);
    if (!hit) return;
    const key = episodeKey(date, hit.entry);
    if (act === 'edit') {
      this.#disarm();
      // Opening another entry keeps the one it replaces: its draft goes to the note box.
      if (this.#editor) this.#keepDraft(this.#editor);
      this.#editor = {
        key,
        date,
        index: i,
        id: hit.entry.id,
        original: hit.entry.text,
        time: episodeTime(hit.entry),
        draft: hit.entry.text,
        saving: false,
      };
      this.renderNow();
      const ta = this.$<HTMLTextAreaElement>('.el-edit');
      ta?.focus();
      ta?.setSelectionRange(ta.value.length, ta.value.length);
      return;
    }
    if (act === 'delete') {
      if (this.#armed !== key) {
        clearTimeout(this.#armTimer);
        this.#armed = key;
        this.#armTimer = setTimeout(() => this.#disarm(), EPISODE_ARM_MS);
        this.sound('tap', { emphasis: 'subtle' }, e);
        this.renderNow();
        return;
      }
      clearTimeout(this.#armTimer);
      this.#armed = null;
      const ok = this.emit<EpisodeDeleteDetail>('ui-delete', {
        date,
        index: i,
        id: hit.entry.id,
        text: hit.entry.text,
        revision: hit.day.revision,
      });
      if (ok) this.sound('close', { emphasis: 'strong' }, e);
      this.renderNow();
    }
  }

  #cancelEdit(): void {
    if (!this.#editor || this.#editor.saving) return;
    const key = this.#editor.key;
    this.#editor = null;
    this.renderNow();
    this.$$<HTMLElement>('[data-act="edit"]')
      .find((b) => b.dataset.key === `edit:${key}`)
      ?.focus();
  }

  #save(e: Event): void {
    const ed = this.#editor;
    if (!ed || ed.saving || this.data?.busy) return;
    if (!ed.draft.trim() || ed.draft === ed.original) return;
    const hit = this.#entryAt(ed.date, ed.index);
    const ok = this.emit<EpisodeEditDetail>('ui-edit', {
      date: ed.date,
      index: ed.index,
      id: ed.id,
      original: ed.original,
      text: ed.draft,
      revision: hit?.day.revision,
    });
    if (!ok) return;
    this.sound('tap', undefined, e);
    ed.saving = true;
    this.#notice = '';
    this.renderNow();
  }

  #add(e: Event): void {
    const text = this.#note;
    if (!text.trim() || this.data?.busy || this.#notePending) return;
    if (!this.emit<EpisodeAddDetail>('ui-add', { text })) return;
    this.sound('tap', undefined, e);
    this.#notePending = text;
    this.#notice = '';
    this.renderNow();
  }
}

define('ui-episode-log', UiEpisodeLog);

declare global {
  interface HTMLElementTagNameMap {
    'ui-episode-log': UiEpisodeLog;
  }
}
