import type { SettingRowData } from '../setting-row/setting-row';

/** What the host filters by (the `ui-filter` detail of `<ui-settings-nav>`). */
export interface SettingsFilter {
  query?: string;
  modifiedOnly?: boolean;
}

/** `applySettingsFilter` result: rows shown / all rows, and rows shown per section id. */
export interface SettingsFilterResult {
  shown: number;
  total: number;
  sections: Record<string, number>;
}

/**
 * Does `text` match the query? Case-insensitive; every word of the trimmed query must appear somewhere in `text`
 * (“model default” finds “Default model”). An empty query matches everything.
 */
export function settingMatches(text: string, query: string): boolean {
  const words = String(query ?? '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return true;
  const hay = String(text ?? '').toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** The text a row is searched by: label, description, hints (label and code) and key. */
export function settingRowText(d: Partial<SettingRowData> | null | undefined): string {
  if (!d) return '';
  const hints = (Array.isArray(d.hints) ? d.hints : []).map((h) =>
    typeof h === 'string' ? h : h && typeof h === 'object' ? `${h.label ?? ''} ${h.code ?? ''}` : '',
  );
  return [d.label, d.description, ...hints, d.key].filter((s) => s != null && String(s).trim()).join(' ');
}

type RowEl = HTMLElement & { data?: Partial<SettingRowData> };

/**
 * Filter the `<ui-setting-row>`s inside `container`: a row stays when it matches the query (label, description,
 * hints, key) and — with `modifiedOnly` — is modified; the others get `hidden`. A `<section>` whose rows are all
 * hidden is hidden too (and shown again once one matches); sections without rows are left alone. The first shown
 * row of each parent gets `data-first` (no top hairline under the card header). Returns the counts for the nav.
 */
export function applySettingsFilter(container: ParentNode, filter: SettingsFilter = {}): SettingsFilterResult {
  const rows = Array.from(container.querySelectorAll<RowEl>('ui-setting-row'));
  const out: SettingsFilterResult = { shown: 0, total: rows.length, sections: {} };
  const firsts = new Set<Element>();
  const query = String(filter.query ?? '');
  for (const row of rows) {
    const d = row.data;
    const text = d ? settingRowText(d) : (row.textContent ?? '');
    const hit = settingMatches(text, query) && (!filter.modifiedOnly || !!d?.modified);
    row.hidden = !hit;
    if (hit) out.shown++;
    const parent = row.parentElement;
    const first = hit && !!parent && !firsts.has(parent);
    if (first && parent) firsts.add(parent);
    row.toggleAttribute('data-first', first);
  }
  for (const sec of Array.from(container.querySelectorAll<HTMLElement>('section'))) {
    const mine = rows.filter((r) => r.parentElement?.closest('section') === sec);
    if (!mine.length) continue;
    const n = mine.filter((r) => !r.hidden).length;
    sec.hidden = n === 0;
    if (sec.id) out.sections[sec.id] = n;
  }
  return out;
}
