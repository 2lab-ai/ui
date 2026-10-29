/**
 * Pure data helpers for `<ui-agent-queue>` — ported from the soma-work dashboard (`aq*`, `cap*`, `cron*` in
 * dash-main.ts, .prd/affectui/re-agent-queue.md D3·D8–D10·D13·D16–D19). No DOM, no clock: every function takes `now`.
 * Every time here is epoch **milliseconds**; seconds are converted once, at the boundary (`normalize`, `toMs`).
 */

// ── Data contract ────────────────────────────────────────────────────────────────────────────

/** Unit of every epoch field in the data (`now`, `fetchedAt`, `measuredAt`, `returnAt`, `refills[].at`, `nextRunAt`, `runs[].at`). */
export type TimeUnit = 'ms' | 's';

/** Pool state of a provider. `low` = the primary measure is under {@link LOW_PCT}% of the total. */
export type AqPoolState = 'ok' | 'low' | 'empty' | 'unknown';

/**
 * One account (a worker).
 * - `available` — usable now (its dot says which window binds first).
 * - `limited` — counted but blocked by a limit; shows the reason and the time left (`returnAt`).
 * - `paused` — held out of the totals (paused, auth failure …).
 * - `spent` — counted, not blocked, nothing usable now.
 * - `unmeasured` — counted, no 5-hour reading.
 * - `excluded` — not counted (no measurement, unknown tier …).
 */
export type AqAccountState = 'available' | 'limited' | 'paused' | 'spent' | 'unmeasured' | 'excluded';

/** Known reason keys (translated). Any other string is shown as given. */
export type AqReason =
  | 'weekly'
  | '5h'
  | 'model'
  | 'cooldown'
  | 'paused'
  | 'auth'
  | 'held'
  | 'noMeasure'
  | 'unknownTier';

export interface AqAccount {
  /** Stable identity (the open card, the roving stop and focus follow it across updates). */
  id: string;
  name: string;
  state: AqAccountState;
  /** Why it is limited / paused / excluded: a known key (translated) or free text. */
  reason?: AqReason | (string & {});
  /** When every block has lifted (epoch, see `timeUnit`). Limited accounts count down to it. */
  returnAt?: number;
  /** Which window binds a usable account first — colours its dot (5h teal, 7d violet). */
  binding?: '5h' | '7d';
  /** Plan label, e.g. `Max x5`. */
  tier?: string;
  /** The tier is assumed (no configured or reported plan). */
  tierAssumed?: boolean;
  /** This account's own 5-hour remaining, 0..1 (account card only). */
  fiveHour?: number;
  /** This account's own weekly remaining, 0..1 (account card only). */
  weekly?: number;
  /** A passed reset decides a number this account contributes. */
  estimated?: boolean;
}

/** A replayed reset: what comes back, and when. Gains are in accounts' worth. */
export interface AqRefill {
  at: number;
  /** `5h` reset (dot), `7d` weekly reset (diamond), or a block lifting. */
  cause: '5h' | '7d' | 'release';
  /** Gain to the 5-hour measure. */
  fiveHour?: number;
  /** Gain to the weekly measure. */
  weekly?: number;
  /** Account name (titles only). */
  account?: string;
}

export interface AqProvider {
  id: string;
  name: string;
  /** Where the numbers come from, e.g. `llmux`. */
  source?: string;
  /** Pool size in accounts' worth (tier-weighted). Nothing is computed without it. */
  total: number;
  /** Usable now (5-hour window), accounts' worth. Omit for providers without a 5-hour window. */
  fiveHour?: number;
  /** Left this week, accounts' worth. */
  weekly?: number;
  /** Pool state. Derived from the primary measure when omitted (see {@link poolState}). */
  state?: AqPoolState;
  /** Accounts in the pool (default `accounts.length`). */
  accountCount?: number;
  /** Accounts counted in the totals (default: accounts not paused / excluded). */
  countedAccounts?: number;
  /** Accounts left out of the totals, by reason (default: derived from `accounts`). */
  excluded?: { held?: number; unknownTier?: number; noMeasure?: number };
  /** Accounts whose numbers are estimated (default: derived). */
  estimated?: number;
  /** Accounts without a 5-hour reading (default: derived). */
  unmeasured5h?: number;
  /** Oldest measurement behind the numbers (epoch) — “measured 4h ago”, flagged past a day. */
  measuredAt?: number;
  /** Replayed resets in time order (next 7 days). */
  refills?: AqRefill[];
  accounts?: AqAccount[];
}

/**
 * A run record. `unknown` = a run whose result is not known — counted apart, never as success.
 * `running` / `waiting` = recorded, and its session is busy now (stacked as “in progress”).
 */
export type AqRunStatus = 'ok' | 'running' | 'waiting' | 'failed' | 'unknown';

export interface AqRun {
  at: number;
  status: AqRunStatus;
  /** Owning job (only needed in `lane.runs24h`). */
  jobId?: string;
  /** What the run was, e.g. a session headline or `Thread reply (no session)`. */
  label?: string;
  /** Error text of a failed run. */
  error?: string;
  /**
   * `false` = shown before its record exists (e.g. a live session's card drawn as a run): it is not one of the
   * job's kept records, so it never counts toward `historyCap`. Default: a record.
   */
  recorded?: boolean;
}

export interface AqJob {
  id: string;
  name: string;
  /** Schedule in words. Derived from `expression` for common shapes when omitted. */
  schedule?: string;
  /** Raw cron expression (shown as the schedule's tooltip). */
  expression?: string;
  /** Next fire (epoch). Jobs without one are left out of the up-next queue. */
  nextRunAt?: number;
  /** Kept run records, any order. */
  runs?: AqRun[];
  /** “Past runs N” (default `runs.length`). */
  pastRuns?: number;
  /** Live state now: a running session, or one waiting for a reply. */
  state?: 'running' | 'waiting' | 'idle';
  /**
   * History is FIFO-capped at this many records: when the kept records (`runs`, minus `recorded: false`) reach it
   * and the oldest is inside the last 24 hours, the 24-hour counts become “≥ n” and the chart is hatched before it —
   * also when `lane.runs24h` supplies the counts.
   */
  historyCap?: number;
  /**
   * A muted chip after the name with an optional tooltip — e.g. `{ text: 'No job info', title: 'Not a job of this
   * instance — deleted, or another instance’s job' }` for a group whose job the host does not know.
   */
  note?: { text: string; title?: string };
}

export interface AqLane {
  /** Lane title (default `CRON`). */
  title?: string;
  jobs: AqJob[];
  /** Run records of the last 24 hours for the stats and the chart. Default: every job's `runs`. */
  runs24h?: AqRun[];
}

/** A section of the element: provider capacity or the job lane. */
export type AqSection = 'capacity' | 'lane';

export interface AgentQueueData {
  /** Provider capacity. Omit to hide the section. */
  providers?: AqProvider[];
  /** Muted note beside the capacity title, e.g. `account = one top-plan account's worth · llmux`. */
  capacityNote?: string;
  /** When the capacity was read (epoch) — “updated 12s ago”, ticking. */
  fetchedAt?: number;
  /** The capacity could not be read: shown instead of the cards. */
  capacityError?: string;
  /** The scheduled-job lane. Omit to hide the section. */
  lane?: AqLane;
  /** The clock (epoch). Default `Date.now()`; countdowns tick on from it. */
  now?: number;
  /** Unit of every epoch field. Default `ms`. Capacity servers that speak epoch seconds pass `s`. */
  timeUnit?: TimeUnit;
  /** Draw a `Expand / Collapse` toggle in each section's head row (it sends `ui-collapse`). */
  collapsible?: boolean;
  /**
   * Fold state per section; a given value wins on every data set (the host keeps the reader's choice), a missing
   * one keeps the element's own. Collapsed capacity = its head plus one summary chip per provider; collapsed lane =
   * its head plus only the jobs waiting for a reply (no stats, queue or chart).
   */
  collapsed?: Partial<Record<AqSection, boolean>>;
}

// ── Units ────────────────────────────────────────────────────────────────────────────────────

export const SEC = 1000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;
export const H5 = 5 * HOUR;
export const D7 = 7 * DAY;
/** Under this % of the total a pool reads `low` (dashboard CAP_LOW_PCT = capacity-view CAPACITY_LOW_PCT). */
export const LOW_PCT = 20;
const EPS = 1e-9;

/** An epoch in the given unit as milliseconds; `undefined` for anything not finite. */
export function toMs(v: unknown, unit: TimeUnit = 'ms'): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  const ms = unit === 's' ? n * 1000 : n;
  // Outside the Date range (±8.64e15 ms) toISOString() throws and would blank the whole element.
  return Math.abs(ms) <= 8.64e15 ? ms : undefined;
}

/** A copy of the data with every epoch in milliseconds — the one place units are converted. */
export function normalize(d: AgentQueueData): AgentQueueData {
  const u = d.timeUnit ?? 'ms';
  const ms = (v: unknown) => toMs(v, u);
  return {
    ...d,
    timeUnit: 'ms',
    now: ms(d.now),
    fetchedAt: ms(d.fetchedAt),
    providers: d.providers?.map((p) => ({
      ...p,
      measuredAt: ms(p.measuredAt),
      refills: (p.refills ?? [])
        .map((e) => ({ ...e, at: ms(e.at) ?? Number.NaN }))
        .filter((e) => Number.isFinite(e.at))
        .sort((a, b) => a.at - b.at),
      accounts: p.accounts?.map((a) => ({ ...a, state: accountState(a.state), returnAt: ms(a.returnAt) })),
    })),
    lane: d.lane && {
      ...d.lane,
      jobs: (d.lane.jobs ?? []).map((j) => ({
        ...j,
        nextRunAt: ms(j.nextRunAt),
        runs: (j.runs ?? []).map((r) => ({ ...r, at: ms(r.at) ?? Number.NaN })).filter((r) => Number.isFinite(r.at)),
      })),
      runs24h: d.lane.runs24h?.map((r) => ({ ...r, at: ms(r.at) ?? Number.NaN })).filter((r) => Number.isFinite(r.at)),
    },
  };
}

// ── Text helpers ─────────────────────────────────────────────────────────────────────────────

/** Tool- or user-written text as one plain line for the live region: control chars / whitespace runs → one space, capped. */
export function plain(s: unknown, max = 0): string {
  const t = Array.from(String(s ?? ''), (c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? ' ' : c))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return max && t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** `HH:MM` today, `M/D HH:MM` on another day (viewer's zone). */
export function clockLabel(atMs: number, nowMs: number): string {
  const d = new Date(atMs);
  const n = new Date(nowMs);
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return d.toDateString() === n.toDateString() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

/** `HH:MM` (chart bins). */
export function hm(ms: number): string {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Elapsed span, minutes floored: `<1m`, `11m`, `3h 5m`, `1d 6h` (the dashboard's capCountdown). */
export function spanShort(secs: number): string {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  if (s < 60) return '<1m';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/** One decimal: `3.5`. */
export function fmt1(x: number): string {
  return (Math.round((Number(x) || 0) * 10) / 10).toFixed(1);
}

/** “2.37 / 2.4”, never “2.4 / 2.4 99%”: a value that rounds to the total but is not full keeps two decimals. */
export function fmtCount(v: number, total: number): string {
  return fmt1(v) === fmt1(total) && v < total - 0.005 ? (Math.round(v * 100) / 100).toFixed(2) : fmt1(v);
}

/** % from the raw ratio: 100% only when full; `—` without a total. */
export function fmtPct(v: number, total: number): string {
  if (!(total > 0)) return '—';
  const p = (v / total) * 100;
  return `${p >= 99.95 ? 100 : Math.min(99, Math.round(p))}%`;
}

// ── Capacity ─────────────────────────────────────────────────────────────────────────────────

export type MeasureKey = 'fiveHour' | 'weekly';

const gainOf = (e: AqRefill, key: MeasureKey) => Number(e[key]) || 0;

/** The provider has a 5-hour window (two bars) — otherwise the weekly measure is primary. */
export function has5h(p: AqProvider): boolean {
  return p.fiveHour !== undefined && p.fiveHour !== null;
}

/** The measure that decides empty / low: 5-hour when present, else weekly. */
export function primaryKey(p: AqProvider): MeasureKey {
  return has5h(p) ? 'fiveHour' : 'weekly';
}

/** The pool's state: given, else ok / low (< 20%) / empty / unknown from the primary measure. */
const POOL_STATES: readonly AqPoolState[] = ['ok', 'low', 'empty', 'unknown'];
const ACCOUNT_STATES: readonly AqAccountState[] = ['available', 'limited', 'paused', 'spent', 'unmeasured', 'excluded'];

/** Host-supplied enums are checked at the boundary: an unknown value never reaches markup. */
export function accountState(v: unknown): AqAccountState {
  return ACCOUNT_STATES.includes(v as AqAccountState) ? (v as AqAccountState) : 'unmeasured';
}

export function poolState(p: AqProvider): AqPoolState {
  if (p.state && POOL_STATES.includes(p.state)) return p.state;
  const total = Number(p.total) || 0;
  const primary = Number(p[primaryKey(p)]) || 0;
  if (total <= EPS) return 'unknown';
  if (primary <= EPS) return 'empty';
  return (primary / total) * 100 < LOW_PCT ? 'low' : 'ok';
}

/** Refills whose time has come are folded into the measures they moved, so nothing past reads as “to come”. */
export function advanceProvider(p: AqProvider, nowMs: number): AqProvider {
  const evs = p.refills ?? [];
  const due = evs.filter((e) => e.at <= nowMs);
  if (!due.length) return p;
  const out: AqProvider = { ...p, refills: evs.filter((e) => e.at > nowMs) };
  if (has5h(p)) out.fiveHour = due.reduce((t, e) => t + gainOf(e, 'fiveHour'), Number(p.fiveHour) || 0);
  if (p.weekly !== undefined) out.weekly = due.reduce((t, e) => t + gainOf(e, 'weekly'), Number(p.weekly) || 0);
  return out;
}

/** The first gain ≥ 0.05 within 7 days that raises this measure, or null. */
export function nextRefill(p: AqProvider, key: MeasureKey, nowMs: number): AqRefill | null {
  for (const e of p.refills ?? []) {
    if (e.at > nowMs + D7) break;
    if (e.at > nowMs && gainOf(e, key) >= 0.05) return e;
  }
  return null;
}

/** Sum of the gains to this measure within the span (small gains are summed, never dropped). */
export function gainWithin(p: AqProvider, key: MeasureKey, nowMs: number, span = D7): number {
  return (p.refills ?? []).filter((e) => e.at > nowMs && e.at <= nowMs + span).reduce((t, e) => t + gainOf(e, key), 0);
}

/** Accounts that are counted but limited right now. */
export function limitedAccounts(p: AqProvider): AqAccount[] {
  return (p.accounts ?? []).filter((a) => a.state === 'limited');
}

/** The earliest return among the limited accounts (epoch ms), or null. */
export function firstReturn(p: AqProvider): number | null {
  let at: number | null = null;
  for (const a of limitedAccounts(p)) if (a.returnAt && (at === null || a.returnAt < at)) at = a.returnAt;
  return at;
}

/** When an empty pool gets something back: the first return, else the first refill of the primary measure. */
export function emptyReturnAt(p: AqProvider, nowMs: number): number | null {
  return firstReturn(p) ?? nextRefill(p, primaryKey(p), nowMs)?.at ?? null;
}

/** Accounts counted in the totals (not paused, not excluded). */
export function countedAccounts(p: AqProvider): number {
  if (p.countedAccounts !== undefined) return p.countedAccounts;
  return (p.accounts ?? []).filter((a) => a.state !== 'paused' && a.state !== 'excluded').length;
}

/** Exclusions by reason: given, else from the accounts (paused → held; excluded by its reason key). */
export function exclusions(p: AqProvider): { held: number; unknownTier: number; noMeasure: number } {
  if (p.excluded)
    return {
      held: p.excluded.held ?? 0,
      unknownTier: p.excluded.unknownTier ?? 0,
      noMeasure: p.excluded.noMeasure ?? 0,
    };
  const out = { held: 0, unknownTier: 0, noMeasure: 0 };
  for (const a of p.accounts ?? []) {
    if (a.state === 'paused') out.held++;
    else if (a.state === 'excluded') {
      if (a.reason === 'unknownTier') out.unknownTier++;
      else out.noMeasure++;
    }
  }
  return out;
}

/** now → 24h takes 55% of the axis (0·1·3·6·12·24h), then days to 7d. Offset in ms → 0..1. */
export function axisPos(offsetMs: number): number {
  const s = (Number(offsetMs) || 0) / 1000;
  if (s <= 0) return 0;
  if (s >= D7 / 1000) return 1;
  if (s <= 86400) {
    const st = [0, 3600, 10800, 21600, 43200, 86400];
    for (let i = 1; i < st.length; i++) {
      if (s <= st[i]) return (i - 1 + (s - st[i - 1]) / (st[i] - st[i - 1])) * 0.11;
    }
  }
  return 0.55 + ((s - 86400) / (6 * 86400)) * 0.45;
}

export interface TimelineMark {
  /** `h5` = 5-hour reset (dot, label above), `wk` = weekly reset (diamond, label below). */
  c: 'h5' | 'wk';
  x0: number;
  x1: number;
  gain: number;
  n: number;
  names: string[];
  at: number;
}

/**
 * The 7-day timeline's marks at width W (px): refills that raise a measure (5h by the 5-hour gain, weekly by the
 * weekly gain); same-type marks closer than a label merge into one with a short span.
 */
export function timelineMarks(p: AqProvider, W: number, nowMs: number, pad = 16): TimelineMark[] {
  const X = (at: number) => pad + axisPos(at - nowMs) * (W - 2 * pad);
  const LW = W < 420 ? 46 : 64;
  const out: TimelineMark[] = [];
  for (const e of p.refills ?? []) {
    if (e.at <= nowMs || e.at > nowMs + D7) continue;
    const c = e.cause === '7d' ? 'wk' : 'h5';
    const d = c === 'wk' ? gainOf(e, 'weekly') : gainOf(e, 'fiveHour');
    if (d < 0.05) continue;
    const x = X(e.at);
    let last: TimelineMark | undefined;
    for (const q of out) if (q.c === c) last = q;
    if (last && x - (last.x0 + last.x1) / 2 < LW) {
      last.gain += d;
      last.n++;
      last.x1 = x;
      if (e.account) last.names.push(e.account);
    } else out.push({ c, x0: x, x1: x, gain: d, n: 1, names: e.account ? [e.account] : [], at: e.at });
  }
  return out;
}

// ── Lane ─────────────────────────────────────────────────────────────────────────────────────

export type RunKind = 'ok' | 'run' | 'fail' | 'unknown';

/** ok → ok, running / waiting → in progress, failed → fail, anything else → unknown (never ok). */
export function runKind(status: unknown): RunKind {
  if (status === 'ok') return 'ok';
  if (status === 'failed') return 'fail';
  if (status === 'running' || status === 'waiting') return 'run';
  return 'unknown';
}

export interface DayRuns {
  from: number;
  runs: Array<{ at: number; kind: 'ok' | 'run' | 'fail' }>;
  n: number;
  ok: number;
  fail: number;
  run: number;
  /** Runs with an unknown result: counted apart, never drawn, never success. */
  unknown: number;
  /** Jobs whose capped history starts inside the window: counts are lower bounds from `from`. */
  cut: Array<{ name: string; from: number; cap: number }>;
  cutFrom: number;
}

/** The last 24 hours of run records: `lane.runs24h` when given, else every job's runs; `cut` from the kept records. */
export function dayRuns(lane: AqLane, nowMs: number): DayRuns {
  const from = nowMs - DAY;
  const src = lane.runs24h ?? (lane.jobs ?? []).flatMap((j) => j.runs ?? []);
  const runs: DayRuns['runs'] = [];
  let unknown = 0;
  for (const r of src) {
    if (!(r.at >= from) || r.at > nowMs) continue;
    const k = runKind(r.status);
    if (k === 'unknown') unknown++;
    else runs.push({ at: r.at, kind: k });
  }
  // The kept records decide where the counts become lower bounds — also when runs24h supplies the counts.
  const cut: DayRuns['cut'] = [];
  for (const j of lane.jobs ?? []) {
    const kept = (j.runs ?? []).filter((r) => r.recorded !== false);
    const cap = Number(j.historyCap) || 0;
    if (cap > 0 && kept.length >= cap) {
      const oldest = Math.min(...kept.map((r) => r.at));
      if (oldest > from) cut.push({ name: j.name, from: oldest, cap });
    }
  }
  const count = (k: string) => runs.filter((r) => r.kind === k).length;
  return {
    from,
    runs,
    n: runs.length,
    ok: count('ok'),
    fail: count('fail'),
    run: count('run'),
    unknown,
    cut,
    cutFrom: cut.reduce((t, c) => Math.max(t, c.from), 0),
  };
}

export interface RunBin {
  at: number;
  ok: number;
  run: number;
  fail: number;
}

/** 24 rolling one-hour bins ending now (each labelled by its start). */
export function runBins(day: DayRuns, nowMs: number): RunBin[] {
  const start = nowMs - DAY;
  const bins: RunBin[] = [];
  for (let k = 0; k < 24; k++) bins.push({ at: start + k * HOUR, ok: 0, run: 0, fail: 0 });
  for (const r of day.runs) {
    const i = Math.max(0, Math.min(23, Math.floor((r.at - start) / HOUR)));
    bins[i][r.kind]++;
  }
  return bins;
}

export const NICE = [
  4, 6, 8, 10, 12, 16, 20, 24, 30, 40, 50, 60, 80, 100, 120, 160, 200, 300, 400, 500, 600, 800, 1000,
];

/** Chart y max: max(peak, 4) rounded up to a nice value. */
export function niceMax(peak: number): number {
  const top = Math.max(Number(peak) || 0, 4);
  return NICE.find((v) => v >= top) ?? Math.ceil(top / 500) * 500;
}

const newest = (j: AqJob) => (j.runs ?? []).reduce((t, r) => Math.max(t, r.at), 0);

/** Lane order: waiting for a reply, then running, then the newest run, then the next fire, then the name. */
export function orderJobs(jobs: AqJob[]): AqJob[] {
  return jobs.slice().sort((a, b) => {
    const aw = a.state === 'waiting';
    const bw = b.state === 'waiting';
    if (aw !== bw) return aw ? -1 : 1;
    const ar = a.state === 'running';
    const br = b.state === 'running';
    if (ar !== br) return ar ? -1 : 1;
    const al = newest(a);
    const bl = newest(b);
    if (al !== bl) return bl - al;
    const an = a.nextRunAt ?? Number.POSITIVE_INFINITY;
    const bn = b.nextRunAt ?? Number.POSITIVE_INFINITY;
    if (an !== bn) return an - bn;
    return String(a.name).localeCompare(String(b.name));
  });
}

/** The up-next queue: jobs with a next fire, soonest first. */
export function upNext(jobs: AqJob[]): AqJob[] {
  return jobs
    .filter((j) => j.nextRunAt !== undefined && Number.isFinite(j.nextRunAt))
    .sort((a, b) => (a.nextRunAt as number) - (b.nextRunAt as number));
}

/** A job's runs, newest first. */
export function jobRuns(j: AqJob): AqRun[] {
  return (j.runs ?? []).slice().sort((a, b) => b.at - a.at);
}

/**
 * Schedule in words for the common cron shapes; anything else stays the raw expression. Clock times read in
 * the viewer's zone from the next fire (the expression is UTC).
 */
export function scheduleLabel(
  expr: string | undefined,
  nextRunAt: number | undefined,
  lang: 'en' | 'ko' = 'en',
): string {
  const raw = String(expr ?? '').trim();
  const f = raw.split(/ +/);
  if (f.length !== 5) return raw;
  const [min, hour, dom, mon, dow] = f;
  const every = /^[*][/]([0-9]+)$/;
  const num = /^[0-9]+$/;
  const ko = lang === 'ko';
  let m: RegExpExecArray | null;
  if (hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    m = every.exec(min);
    if (m) return ko ? `${m[1]}분마다` : `Every ${m[1]} min`;
    if (min === '*') return ko ? '매분' : 'Every minute';
    if (num.test(min))
      return Number(min) === 0
        ? ko
          ? '매시 정각'
          : 'Hourly'
        : ko
          ? `매시 ${Number(min)}분`
          : `Hourly at :${pad2(Number(min))}`;
  }
  if (dom === '*' && mon === '*' && dow === '*' && num.test(min)) {
    m = every.exec(hour);
    if (m) return ko ? `${m[1]}시간마다` : `Every ${m[1]} h`;
  }
  if (dom === '*' && mon === '*' && num.test(min) && num.test(hour) && nextRunAt) {
    const d = new Date(nextRunAt);
    const t = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    if (dow === '*') return ko ? `매일 ${t}` : `Daily ${t}`;
    // A weekday set only reads in local words when the zone shift keeps the day.
    if (dow === '1-5' && d.getDay() === d.getUTCDay()) return ko ? `평일 ${t}` : `Weekdays ${t}`;
  }
  return raw;
}
