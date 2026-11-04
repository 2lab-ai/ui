/**
 * Composer trigger menus — pure helpers (no DOM). A trigger character (`/` for commands, `$` for skills, `@` for
 * people …) typed at the start of the message or of a word opens a list of what the host offers there; the text
 * after it filters the list. Everything here is exported and unit-tested.
 */

/** One row of a trigger menu: a command, a skill, a person. */
export interface ComposerSuggestion {
  /** What replaces the typed token when the row is picked (`/model`, `$local:autoz`). A space follows it. */
  value: string;
  /** The row's name (default: `value`). */
  label?: string;
  /** One line on what it does. */
  description?: string;
  /** A typical use, drawn in grey under the description (`/model opus`). */
  example?: string;
  /** The section it sits under while nothing is typed after the trigger (rows of one group should be adjacent). */
  group?: string;
  /** More words the typed text matches (aliases). */
  keywords?: string[];
}

/** A character that opens a menu (`ComposerData.triggers`). */
export interface ComposerTrigger {
  /** One character: `/`, `$`, `@` … */
  char: string;
  /** `start`: only as the first thing in the message (commands). `word` (default): at the start of any word. */
  at?: 'start' | 'word';
  /** The list's accessible name (“Commands”). */
  label?: string;
  items: ComposerSuggestion[];
}

/** The token under the caret that opened a menu. */
export interface ComposerSuggestToken {
  trigger: ComposerTrigger;
  /** Where the token starts (the trigger character) … */
  start: number;
  /** … and ends (the end of the word the caret is in). */
  end: number;
  /** What was typed after the trigger, up to the caret. */
  query: string;
}

/** `ui-suggest` (cancelable): a row was picked. Unless prevented, the composer puts `value` in place of the token. */
export interface ComposerSuggestDetail {
  /** The trigger character. */
  char: string;
  value: string;
  /** What had been typed after the trigger. */
  query: string;
}

/** At most this many rows are drawn (the list scrolls); a longer query narrows it. */
export const COMPOSER_SUGGEST_MAX = 200;

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));
const SPACE = /\s/;

/** The host's triggers made safe: one character each (first one wins), rows with a string value. */
export function composerTriggers(raw: unknown): ComposerTrigger[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ComposerTrigger[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const char = str(o.char);
    // One character (one code point), not a space.
    if (Array.from(char).length !== 1 || SPACE.test(char) || seen.has(char)) continue;
    seen.add(char);
    const items: ComposerSuggestion[] = [];
    for (const it of Array.isArray(o.items) ? o.items : []) {
      if (!it || typeof it !== 'object') continue;
      const s = it as Record<string, unknown>;
      const value = str(s.value);
      if (!value.trim()) continue;
      const row: ComposerSuggestion = { value };
      for (const k of ['label', 'description', 'example', 'group'] as const) {
        const v = str(s[k]).trim();
        if (v) row[k] = v;
      }
      if (Array.isArray(s.keywords)) {
        const kw = s.keywords.map(str).filter((w) => w.trim());
        if (kw.length) row.keywords = kw;
      }
      items.push(row);
    }
    const t: ComposerTrigger = { char, at: o.at === 'start' ? 'start' : 'word', items };
    const label = str(o.label).trim();
    if (label) t.label = label;
    out.push(t);
  }
  return out;
}

/**
 * The trigger token the caret is in, or null. The token runs from the last space before the caret; it opens a menu
 * when it starts with a trigger character — for an `at: 'start'` trigger only when nothing but spaces comes before
 * it. A space typed after the token closes it (the command takes its arguments).
 */
export function composerSuggestToken(
  text: string,
  caret: number,
  triggers: ComposerTrigger[],
): ComposerSuggestToken | null {
  const s = str(text);
  const at = Math.max(0, Math.min(Math.floor(Number(caret) || 0), s.length));
  let start = at;
  while (start > 0 && !SPACE.test(s[start - 1])) start--;
  if (start === at) return null;
  const char = String.fromCodePoint(s.codePointAt(start) ?? 0);
  const trigger = triggers.find((t) => t.char === char);
  if (!trigger) return null;
  if (trigger.at === 'start' && s.slice(0, start).trim()) return null;
  let end = at;
  while (end < s.length && !SPACE.test(s[end])) end++;
  return { trigger, start, end, query: s.slice(start + char.length, at) };
}

/** A name without its trigger character, in lower case (`/Model` → `model`). */
function bare(name: string, char: string): string {
  const n = name.toLowerCase();
  return char && n.startsWith(char.toLowerCase()) ? n.slice(char.length) : n;
}

/**
 * How well a row matches `query` (lower case), lower is better, -1 for no match: 0 its name starts with it, 1 a part
 * of its name does (`local:autoz` for `autoz`), 2 its name has it, 3 an alias has it, 4 its description has it.
 * A single letter matches names only.
 */
export function composerSuggestScore(item: ComposerSuggestion, query: string, char = ''): number {
  const q = str(query).toLowerCase();
  if (!q) return 0;
  const names = [bare(item.value, char), bare(str(item.label), char)].filter(Boolean);
  if (names.some((n) => n.startsWith(q))) return 0;
  if (names.some((n) => n.split(/[:/._\-\s]+/).some((part) => part.startsWith(q)))) return 1;
  if (names.some((n) => n.includes(q))) return 2;
  if (q.length < 2) return -1;
  if ((item.keywords ?? []).some((k) => bare(k, char).includes(q))) return 3;
  if (str(item.description).toLowerCase().includes(q)) return 4;
  return -1;
}

/** The rows that match `query`, best first (ties keep the host's order); all of them, in order, for an empty query. */
export function composerSuggestFilter(
  items: ComposerSuggestion[],
  query: string,
  char = '',
  max = COMPOSER_SUGGEST_MAX,
): ComposerSuggestion[] {
  const q = str(query).toLowerCase();
  const list = Array.isArray(items) ? items : [];
  if (!q) return list.slice(0, max);
  return list
    .map((item, i) => ({ item, i, score: composerSuggestScore(item, q, char) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .slice(0, max)
    .map((r) => r.item);
}

/**
 * The field after picking `value` for `token`: the token is replaced and one space follows (none added when a space
 * is already there). `caret` lands after that space.
 */
export function composerSuggestApply(
  text: string,
  token: Pick<ComposerSuggestToken, 'start' | 'end'>,
  value: string,
): { text: string; caret: number } {
  const s = str(text);
  const before = s.slice(0, token.start);
  const after = s.slice(token.end);
  const insert = after.startsWith(' ') || after.startsWith('\n') ? value : `${value} `;
  const caret = before.length + insert.length + (insert === value ? 1 : 0);
  return { text: before + insert + after, caret: Math.min(caret, before.length + insert.length + after.length) };
}
