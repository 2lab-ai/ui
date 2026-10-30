/**
 * Next enabled index from `from` in direction `dir` (wrapping); `dir` 0 = the first enabled index at or after
 * `from`. -1 when nothing is enabled. Shared by the roving-tabindex primitives (segmented, tabs, menu).
 */
export function rovingIndex(disabled: boolean[], from: number, dir: -1 | 0 | 1): number {
  const n = disabled.length;
  if (!n) return -1;
  const step = dir === 0 ? 1 : dir;
  let i = dir === 0 ? from : from + dir;
  for (let k = 0; k < n; k++, i += step) {
    const j = ((i % n) + n) % n;
    if (!disabled[j]) return j;
  }
  return -1;
}

/** The last enabled index (-1 when none). */
export function lastEnabled(disabled: boolean[]): number {
  for (let i = disabled.length - 1; i >= 0; i--) if (!disabled[i]) return i;
  return -1;
}
