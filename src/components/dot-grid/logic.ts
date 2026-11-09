/**
 * Pure model for `<ui-dot-grid>`: the state normaliser, the rows the element draws, per-state totals, the summary line,
 * the legend and the 2D keyboard move. Nothing here touches the DOM, so a server render or a test can use it.
 */

/**
 * What one run did. done — went through (ink) · fail — failed · wait — waiting (queued, retrying) · run — running now ·
 * pending — still to come today (hatched) · empty — nothing there yet (an outline) · skip — skipped (a faint pill).
 */
export type DotState = 'done' | 'fail' | 'wait' | 'run' | 'pending' | 'empty' | 'skip';
export type DotSize = 'sm' | 'md' | 'lg';
export type DotLang = 'en' | 'ko';

/** One cell: its state and, optionally, its own words (the tooltip and what a reader hears). */
export interface DotCell {
  state: DotState;
  /** "Mon 3 Nov 09:00 — failed". Put the state in it; when it is missing the state word is added for readers. */
  label?: string;
}

export interface DotRow {
  /** What `ui-select` carries back as `rowId`. Unique within the grid. */
  id: string;
  /** The row's name, at its left (above it under 480px). */
  label: string;
  cells: Array<DotState | DotCell>;
}

export interface DotGridData {
  /** The grid's accessible name ("Cron runs, last 14 days"). */
  label?: string;
  /** Header labels over the cells (dates); may be sparse — '' or a hole draws nothing in that column. */
  columns?: Array<string | null | undefined>;
  rows: DotRow[];
  /** Draw the legend. Default: when more than one state is present. Only the present states are listed. */
  legend?: boolean;
  /** Your own words for the states (legend, tooltip, aria, summary): `{ done: 'Taken', fail: 'Missed' }`. */
  states?: Partial<Record<DotState, string>>;
  /** Show the summary line ("12 done · 2 failed · 1 to come") under the grid. It is always the grid's description. */
  summary?: boolean;
  /** Words when there are no rows. */
  empty?: string;
}

/** `ui-select` detail. */
export interface DotSelect {
  rowId: string;
  index: number;
  state: DotState;
}

/** How many cells are in each state, and all of them. */
export type DotCounts = Record<DotState, number> & { total: number };

export interface DotCellModel {
  state: DotState;
  /** The host's words for the cell, trimmed ('' when none). */
  label: string;
}

export interface DotRowModel {
  id: string;
  label: string;
  cells: DotCellModel[];
}

/** Every state in the order the legend and the summary list them. */
export const DOT_STATES: readonly DotState[] = ['done', 'fail', 'run', 'wait', 'pending', 'skip', 'empty'];
const SIZES: readonly DotSize[] = ['sm', 'md', 'lg'];

export interface DotStrings {
  /** The grid's name when the host gives none. */
  name: string;
  /** The state words (legend, tooltip, aria). */
  words: Record<DotState, string>;
  /** The words after a count in the summary ("12 done"). */
  counts: Record<DotState, string>;
  /** A cell's place when it has neither a label nor a column header. */
  nth: (i: number, n: number) => string;
  none: string;
}

export const DOT_STRINGS: Record<DotLang, DotStrings> = {
  en: {
    name: 'Run history',
    words: {
      done: 'Done',
      fail: 'Failed',
      run: 'Running',
      wait: 'Waiting',
      pending: 'To come',
      skip: 'Skipped',
      empty: 'No run',
    },
    counts: {
      done: 'done',
      fail: 'failed',
      run: 'running',
      wait: 'waiting',
      pending: 'to come',
      skip: 'skipped',
      empty: 'no run',
    },
    nth: (i, n) => `${i} of ${n}`,
    none: 'No runs yet',
  },
  ko: {
    name: '실행 기록',
    words: {
      done: '완료',
      fail: '실패',
      run: '실행 중',
      wait: '대기',
      pending: '예정',
      skip: '건너뜀',
      empty: '기록 없음',
    },
    counts: {
      done: '완료',
      fail: '실패',
      run: '실행 중',
      wait: '대기',
      pending: '예정',
      skip: '건너뜀',
      empty: '기록 없음',
    },
    nth: (i, n) => `${n}개 중 ${i}번째`,
    none: '아직 기록이 없습니다',
  },
};

export function dotLang(v: unknown): DotLang {
  return v === 'ko' ? 'ko' : 'en';
}

export function dotStrings(lang: unknown): DotStrings {
  return DOT_STRINGS[dotLang(lang)];
}

/** A state from a state word or a `{ state }` cell (case and spaces forgiven); anything else is 'empty'. */
export function dotState(v: unknown): DotState {
  const s = v && typeof v === 'object' ? (v as { state?: unknown }).state : v;
  if (typeof s !== 'string') return 'empty';
  const k = s.trim().toLowerCase();
  return (DOT_STATES as readonly string[]).includes(k) ? (k as DotState) : 'empty';
}

export function dotSize(v: unknown): DotSize {
  return SIZES.includes(v as DotSize) ? (v as DotSize) : 'md';
}

/** Cells per line (a whole number from 1 up), or 0 — no wrapping. */
export function dotWrap(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) && n >= 1 ? Math.min(400, Math.floor(n)) : 0;
}

const text = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

/** The rows worth drawing: objects with an id (or a label to stand for it), first of each id; cells normalised. */
export function dotRows(d: { rows?: unknown } | null | undefined): DotRowModel[] {
  const out: DotRowModel[] = [];
  const seen = new Set<string>();
  const rows = d && Array.isArray(d.rows) ? d.rows : [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const row = r as { id?: unknown; label?: unknown; cells?: unknown };
    const label = text(row.label).trim();
    const id = text(row.id).trim() || label;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const cells = Array.isArray(row.cells) ? row.cells : [];
    out.push({
      id,
      label,
      cells: cells.map((c) => ({
        state: dotState(c),
        label: c && typeof c === 'object' ? text((c as { label?: unknown }).label).trim() : '',
      })),
    });
  }
  return out;
}

/** The header labels as strings ('' for a hole or junk). */
export function dotColumns(d: { columns?: unknown } | null | undefined): string[] {
  return d && Array.isArray(d.columns) ? Array.from(d.columns, (c) => text(c).trim()) : [];
}

/** Per-state totals over every cell of every row (raw rows or `dotRows` models). */
export function dotCounts(rows: ReadonlyArray<{ cells?: unknown } | null | undefined> | null | undefined): DotCounts {
  const out = { done: 0, fail: 0, run: 0, wait: 0, pending: 0, skip: 0, empty: 0, total: 0 } as DotCounts;
  for (const r of Array.isArray(rows) ? rows : []) {
    const cells = r && Array.isArray(r.cells) ? r.cells : [];
    for (const c of cells) {
      out[dotState(c)]++;
      out.total++;
    }
  }
  return out;
}

/** The host's word for a state when it gave one, else the language's. */
export function dotWord(state: DotState, lang?: unknown, words?: Partial<Record<DotState, string>> | null): string {
  const w = words?.[state];
  const own = typeof w === 'string' ? w.trim() : '';
  return own || dotStrings(lang).words[state];
}

/** "Taken" → "taken" (a capital that only starts a sentence); "CI" and "OK" stay. */
function lowerFirst(s: string): string {
  return s.length > 1 && s[1] === s[1].toLowerCase() && s[1] !== s[1].toUpperCase()
    ? s[0].toLowerCase() + s.slice(1)
    : s;
}

/**
 * The summary line: "12 done · 2 failed · 1 to come" (Korean: "완료 12 · 실패 2 · 예정 1"), the present states in
 * legend order; your own state words when given. No cells: "No runs yet".
 */
export function dotSummary(
  counts: Partial<Record<DotState, number>> | null | undefined,
  lang?: unknown,
  words?: Partial<Record<DotState, string>> | null,
): string {
  const l = dotLang(lang);
  const s = DOT_STRINGS[l];
  const parts: string[] = [];
  for (const st of DOT_STATES) {
    const n = Number(counts?.[st]) || 0;
    if (n <= 0) continue;
    const w = words?.[st];
    const own = typeof w === 'string' ? w.trim() : '';
    if (l === 'ko') parts.push(`${own || s.counts[st]} ${n}`);
    else parts.push(`${n} ${own ? lowerFirst(own) : s.counts[st]}`);
  }
  return parts.length ? parts.join(' · ') : s.none;
}

/** The states the legend lists: none when `legend` is false; else the present ones — with `legend` unset, only if 2+. */
export function dotLegend(rows: ReadonlyArray<{ cells?: unknown }> | null | undefined, legend?: unknown): DotState[] {
  if (legend === false) return [];
  const c = dotCounts(rows);
  const present = DOT_STATES.filter((s) => c[s] > 0);
  return legend === true || present.length > 1 ? present : [];
}

export interface DotAt {
  r: number;
  c: number;
}

/**
 * Where a key moves the focus from cell `at` (rows of `lengths` cells; rows with no cells are stepped over). Arrows
 * move in 2D and stop at the edges; Home / End go to the row's ends, with Ctrl the grid's. Rows share one width, so
 * Up / Down land on the cell under the same spot (a row of 28 under a row of 14: the matching half). With `wrap`,
 * a row runs in lines of `wrap` cells and Up / Down step a line inside the row before leaving it. `null`: not a key
 * the grid uses.
 */
export function dotMove(
  lengths: readonly number[],
  at: DotAt,
  key: string,
  opts: { wrap?: number; ctrl?: boolean; rtl?: boolean } = {},
): DotAt | null {
  const live = lengths.map((n, i) => (n > 0 ? i : -1)).filter((i) => i >= 0);
  if (!live.length) return null;
  const w = dotWrap(opts.wrap);
  const len = lengths[at.r] ?? 0;
  if (!len) return { r: live[0], c: 0 };
  const r = at.r;
  const c = Math.min(len - 1, Math.max(0, at.c));
  const pos = live.indexOf(r);
  const clampTo = (row: number, col: number): DotAt => ({ r: row, c: Math.min(lengths[row] - 1, Math.max(0, col)) });
  /** The column in a row of `to` cells under cell `c` of this one (same spot along the shared width). */
  const across = (to: number): number => (w ? c % w : Math.floor(((c + 0.5) * to) / len));
  switch (key) {
    case 'ArrowRight':
      return clampTo(r, c + (opts.rtl ? -1 : 1));
    case 'ArrowLeft':
      return clampTo(r, c + (opts.rtl ? 1 : -1));
    case 'Home':
      return opts.ctrl ? { r: live[0], c: 0 } : { r, c: 0 };
    case 'End': {
      const last = live[live.length - 1];
      return opts.ctrl ? { r: last, c: lengths[last] - 1 } : { r, c: len - 1 };
    }
    case 'ArrowDown': {
      if (w && Math.floor(c / w) < Math.floor((len - 1) / w)) return clampTo(r, c + w);
      const next = live[pos + 1];
      return next === undefined ? { r, c } : clampTo(next, across(lengths[next]));
    }
    case 'ArrowUp': {
      if (w && c >= w) return clampTo(r, c - w);
      const prev = live[pos - 1];
      if (prev === undefined) return { r, c };
      const n = lengths[prev];
      return clampTo(prev, w ? Math.floor((n - 1) / w) * w + across(n) : across(n));
    }
    default:
      return null;
  }
}

/** What a reader hears for a cell: "Nightly backup, Mon 3 Nov: Failed" (the state word added when the label lacks it). */
export function dotAria(
  row: string,
  cell: DotCellModel,
  index: number,
  count: number,
  column: string,
  word: string,
  s: DotStrings,
): string {
  const where = cell.label || column || s.nth(index + 1, count);
  const said = cell.label && cell.label.toLowerCase().includes(word.toLowerCase()) ? where : `${where}: ${word}`;
  return row ? `${row}, ${said}` : said;
}

/** The tooltip's line for a cell: its label, else "column · word", else the word. */
export function dotTip(cell: DotCellModel, column: string, word: string): string {
  if (cell.label) return cell.label;
  return column ? `${column} · ${word}` : word;
}
