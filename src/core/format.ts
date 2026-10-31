/** Token counts the way the dashboard shows them: 950, 12.3K, 272.8K, 1M, 1.2M. */
export function fmtTokens(n: number): string {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${trim(v / 1_000_000)}M`;
  if (a >= 1_000) return `${trim(v / 1_000)}K`;
  return String(Math.round(v));
}

function trim(x: number): string {
  const s = x.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/** Grouped integer: 1,234,567. */
export function fmtInt(n: number): string {
  return Math.round(Number(n) || 0).toLocaleString('en-US');
}

/** Elapsed time: 42s, 9m 22s, 2h 15m. */
export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
}

/** Elapsed time in the surface's language: 42s · 9m 22s · 2h 15m; ko: 42초 · 9분 22초 · 2시간 15분 — the same words as
 *  <ui-elapsed lang="ko"> (a plan's step clocks, a run's time and the page's live times read alike). */
export function fmtDurationIn(ms: number, lang?: string): string {
  if (lang !== 'ko') return fmtDuration(ms);
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 ${String(s % 60).padStart(2, '0')}초`;
  const h = Math.floor(m / 60);
  return `${h}시간 ${String(m % 60).padStart(2, '0')}분`;
}

/** Duration in Korean: 42초, 7분 12초 (7분 on the minute), 2시간 3분 (2시간 on the hour). */
export function fmtDurationKo(ms: number): string {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m}분 ${s % 60}초` : `${m}분`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}시간 ${m % 60}분` : `${h}시간`;
}

/** Countdown / clock style m:ss (3:41). */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** US dollars with 2 decimals. */
export function fmtUsd(n: number): string {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

/** Relative past time: just now, 5m ago, 3h ago, 2d ago. */
export function fmtAgo(at: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Clamp to [lo, hi]. */
export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
