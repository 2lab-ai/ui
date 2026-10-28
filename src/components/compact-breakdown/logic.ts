import { fmtInt, fmtTokens, fmtUsd } from '../../core/format';

/** How every value of the card is written: $412.30 · 12.3M · 1,234. */
export type BreakdownUnit = 'usd' | 'tokens' | 'count';

/** One part of the total. */
export interface BreakdownPart {
  /** Stable id across updates (model id, user id …): the row and its segment keep their place and colour by it. */
  key: string;
  label: string;
  /** Raw number (no formatting). Non-finite or negative reads as 0; 0 leaves the part out. */
  value: number;
  /** Any CSS colour (hex, rgb(), var(--token), color-mix()). Default: the next free palette slot. */
  color?: string;
}

/** One option of the segmented switch the host owns (period or metric). */
export interface BreakdownOption {
  id: string;
  label: string;
}

export interface CompactBreakdownData {
  /** Card heading; names the group for screen readers. */
  title: string;
  /** Default 'count'. */
  unit?: BreakdownUnit;
  /** The big number when the parts do not add up to it — the gap is shown as Other. Default: the parts' sum. */
  total?: number;
  parts: BreakdownPart[];
  /** Rows at most, Other included: the smallest parts fold into Other. Default 5 (min 2). */
  maxRows?: number;
  /** A segmented switch in the header (shown with 2+ options). */
  options?: BreakdownOption[];
  /** Selected option id. Set → controlled (the card only emits ui-change); unset → the card keeps its own. */
  value?: string;
  /** Accessible name of the switch. Default “Period” / “기간”. */
  optionsLabel?: string;
  /** Line under the big number while nothing is hovered. Default “Total” / “합계”. */
  totalLabel?: string;
  /** The card's last line. Default “Largest: <part>”; null hides it. */
  footer?: string | null;
  /** The host is fetching: the numbers dim (a skeleton before the first data). */
  loading?: boolean;
  /** The host's fetch failed: a dash for the total and this message. */
  error?: string;
  /** Shown instead of the rows when nothing has a value. */
  emptyText?: string;
}

/** A row as drawn: a host part, or the Other fold (`other: true`, no host key). */
export interface BreakdownRow {
  /** Internal id — `p:<key>` for a part, `other` for the fold — never collides with a host key. */
  id: string;
  /** The host key (undefined for Other). */
  key?: string;
  label: string;
  value: number;
  color?: string;
  other?: boolean;
  /** Labels folded into Other, largest first. */
  folded?: string[];
}

export interface BreakdownModel {
  rows: BreakdownRow[];
  /** What 100% is: the parts' sum, or `total` when that is larger. */
  base: number;
}

export const DEFAULT_ROWS = 5;
export const OTHER_ID = 'other';

/** Finite and ≥ 0, else 0. */
export function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** The unit the card was given, or 'count'. */
export function normUnit(u: unknown): BreakdownUnit {
  return u === 'usd' || u === 'tokens' ? u : 'count';
}

/** One value in the card's unit — src/core/format.ts: fmtUsd · fmtTokens · fmtInt. */
export function fmtValue(unit: BreakdownUnit, n: number): string {
  if (unit === 'usd') return fmtUsd(n);
  if (unit === 'tokens') return fmtTokens(n);
  return fmtInt(n);
}

/** The smallest amount a unit shows (half its last digit): a remainder below it is rounding, not a part. */
export function resolution(unit: BreakdownUnit): number {
  return unit === 'usd' ? 0.005 : 0.5;
}

/** Share of the total as a whole percent; never “0%” for a part that has a value, never “100%” for one that does not hold it all. */
export function fmtShare(pct: number): string {
  const p = Number.isFinite(pct) ? pct : 0;
  if (p > 0 && p < 1) return '<1%';
  if (p > 99 && p < 100) return '>99%';
  return `${Math.round(Math.max(0, p))}%`;
}

/** Percent of `base` (0 when there is no base). */
export function shareOf(value: number, base: number): number {
  return base > 0 ? (value / base) * 100 : 0;
}

/**
 * Parts → ranked rows: zero parts left out, duplicate keys made unique (`key#2`), ranked by value (ties keep the
 * host's order), at most `maxRows` rows with the smallest folded into a last “Other” row; a `total` above the parts'
 * sum adds its remainder to Other as well.
 */
export function foldParts(
  parts: readonly BreakdownPart[] | undefined,
  maxRows: number | undefined,
  total: number | undefined,
  unit: BreakdownUnit,
): BreakdownModel {
  const seen = new Map<string, number>();
  const list: BreakdownRow[] = [];
  for (const p of Array.isArray(parts) ? parts : []) {
    if (!p || typeof p !== 'object') continue;
    const value = num(p.value);
    const raw = String(p.key ?? p.label ?? '');
    const n = (seen.get(raw) ?? 0) + 1;
    seen.set(raw, n);
    if (!(value > 0)) continue;
    const key = n > 1 ? `${raw}#${n}` : raw;
    list.push({ id: `p:${key}`, key, label: String(p.label ?? raw), value, color: p.color });
  }
  list.sort((a, b) => b.value - a.value);
  const sum = list.reduce((s, r) => s + r.value, 0);
  const t = num(total);
  const rest = t - sum > resolution(unit) ? t - sum : 0;
  const limit = Math.max(2, Math.floor(num(maxRows) || DEFAULT_ROWS));
  const fold = list.length > limit || rest > 0;
  const keep = fold ? Math.min(list.length, limit - 1) : list.length;
  const rows = list.slice(0, keep);
  if (fold) {
    const tail = list.slice(keep);
    rows.push({
      id: OTHER_ID,
      label: '',
      value: tail.reduce((s, r) => s + r.value, 0) + rest,
      other: true,
      folded: tail.map((r) => r.label),
    });
  }
  return { rows, base: sum + rest };
}

/**
 * Palette slots by id: an id keeps its slot while it is shown; a new id takes the lowest free slot (in the order
 * given — rank order, so the largest new part gets the strongest colour); past the last slot every id shares it.
 */
export function assignSlots(
  prev: ReadonlyMap<string, number>,
  ids: readonly string[],
  slots: number,
): Map<string, number> {
  const next = new Map<string, number>();
  for (const id of ids) if (prev.has(id)) next.set(id, prev.get(id)!);
  const used = new Set(next.values());
  let free = 0;
  for (const id of ids) {
    if (next.has(id)) continue;
    while (used.has(free) && free < slots - 1) free++;
    const slot = Math.min(free, slots - 1);
    next.set(id, slot);
    used.add(slot);
  }
  return next;
}

const COLOR_OK = /^[#a-z0-9(),.%\s/+-]+$/i;
const COLOR_BAD = /url|image|expression|attr|env|\\|\/\*/i;

/** A host colour that can only paint: hex, rgb()/hsl()/oklch(), named, var(--x), color-mix(). Else undefined. */
export function safeColor(c: unknown): string | undefined {
  if (typeof c !== 'string') return undefined;
  const s = c.trim();
  if (!s || s.length > 120 || !COLOR_OK.test(s) || COLOR_BAD.test(s)) return undefined;
  let depth = 0;
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')' && --depth < 0) return undefined;
  }
  return depth === 0 ? s : undefined;
}

/** easeOutQuart — the shared tween of every number and width. */
export function easeOut(p: number): number {
  return 1 - (1 - Math.min(1, Math.max(0, p))) ** 4;
}
