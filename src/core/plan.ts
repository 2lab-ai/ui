import { icon } from '../icons/icons';
import { fmtDurationIn } from './format';
import { esc, escAttr } from './html';

/**
 * The plan renderer shared by `<ui-agent-run>` and `<ui-task-plan>` (and the status chip `<ui-task-runs>` uses): a
 * marker per step on one rail (check · spinner · ring · ✕ · dash · pause · slash), the current step bold, a ref,
 * a detail line, a tool-call chip, an aside on the right (live clock, run time or a short note), nested sub-steps,
 * a fate badge for steps that left their plan, an optional status chip, the done-step fold, the "earlier" fold
 * (0fr → 1fr) and the phase foot. Pure functions returning HTML strings — every dynamic string is escaped here —
 * plus `planCss`, which a component puts in its `static styles`.
 *
 * Clocks are never in the markup: a running step's aside is `<span data-since="…">`, filled and ticked in place
 * by the component (1 Hz), so equal data renders equal HTML.
 */

export type PlanStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped' | 'paused' | 'dropped';
/** How a step left its plan: finished there, dropped by a newer plan, or carried into another plan. */
export type PlanFate = 'done' | 'dropped' | 'moved';
export type PlanLang = 'en' | 'ko';

export interface PlanStep {
  id: string;
  label: string;
  status: PlanStepStatus;
  /** Short reference shown before the label, e.g. `#T3`. */
  ref?: string;
  /** Second line: what the step is doing now, or why it failed. */
  detail?: string;
  /** Epoch ms. A running step ticks from here; a finished one shows endedAt − startedAt. */
  startedAt?: number;
  endedAt?: number;
  /** Tool calls made while the step ran (chip; never shown on a pending step). */
  toolCalls?: number;
  /** The aside when no clock runs: a short note (`~2 min`, `after review`). Wins over a finished run time. */
  note?: string;
  /** A badge after the label for a step that left its plan. */
  fate?: PlanFate;
  /** Where a moved step went (`Plan 2`), read with `fate: 'moved'`. */
  movedTo?: string;
  /** Sub-steps: a nested list under the step (ids unique across the whole plan). */
  steps?: PlanStep[];
}

export interface PlanPhase {
  /**
   * From the steps alone: any running → running; else any failed → failed; all done/skipped/dropped → done; else any
   * paused → paused; else idle.
   */
  phase: 'running' | 'paused' | 'done' | 'failed' | 'idle';
  done: number;
  total: number;
  /** Earliest start (the running clock counts from here), 0 when unknown. */
  since: number;
  /** Last end − first start once the plan is finished, 0 when the steps do not carry both. */
  tookMs: number;
}

/** The strings the renderer draws, per language. Components add their own (headings, empty states). */
export const PLAN_STRINGS = {
  en: {
    stepSr: {
      pending: 'pending',
      running: 'in progress',
      done: 'done',
      failed: 'failed',
      skipped: 'skipped',
      paused: 'paused',
      dropped: 'dropped',
    } as Record<PlanStepStatus, string>,
    status: {
      pending: 'Pending',
      running: 'Running',
      done: 'Done',
      failed: 'Failed',
      skipped: 'Skipped',
      paused: 'Paused',
      dropped: 'Dropped',
    } as Record<PlanStepStatus, string>,
    calls: (n: number) => (n === 1 ? '1 tool call' : `${n} tool calls`),
    foldShow: (n: number) => `Show ${n} more completed`,
    foldHide: 'Hide completed',
    phase: { running: 'Running', paused: 'Paused', done: 'Done', failed: 'Failed', idle: 'Idle' } as Record<
      PlanPhase['phase'],
      string
    >,
    fate: { done: 'Done', dropped: 'Dropped', moved: 'Moved' } as Record<PlanFate, string>,
    movedTo: (to: string) => `Moved to ${to}`,
    subSteps: (label: string) => `Sub-steps of ${label}`,
  },
  ko: {
    stepSr: {
      pending: '대기',
      running: '진행 중',
      done: '완료',
      failed: '실패',
      skipped: '건너뜀',
      paused: '멈춤',
      dropped: '제외됨',
    } as Record<PlanStepStatus, string>,
    status: {
      pending: '대기',
      running: '진행 중',
      done: '완료',
      failed: '실패',
      skipped: '건너뜀',
      paused: '멈춤',
      dropped: '제외됨',
    } as Record<PlanStepStatus, string>,
    calls: (n: number) => `툴 ${n}회`,
    foldShow: (n: number) => `완료 ${n}개 더 보기`,
    foldHide: '완료 숨기기',
    phase: { running: '실행 중', paused: '멈춤', done: '완료', failed: '실패', idle: '대기' } as Record<
      PlanPhase['phase'],
      string
    >,
    fate: { done: '완료', dropped: '제외됨', moved: '이동됨' } as Record<PlanFate, string>,
    movedTo: (to: string) => `이동 → ${to}`,
    subSteps: (label: string) => `${label} 하위 단계`,
  },
};
export type PlanStrings = (typeof PLAN_STRINGS)['en'];

/** Marker glyphs (16-unit viewBox, 2px strokes so they read at 10px inside an 18px marker). */
export const PLAN_ICON = {
  check:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>',
  cross:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>',
  dot: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="8" cy="8" r="3"/></svg>',
  dash: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 8h6"/></svg>',
  pause:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 5v6M10 5v6"/></svg>',
  slash:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 11l6-6"/></svg>',
  spin: '<span class="pl-spin" aria-hidden="true"></span>',
};

const STATUSES: ReadonlySet<string> = new Set<PlanStepStatus>([
  'pending',
  'running',
  'done',
  'failed',
  'skipped',
  'paused',
  'dropped',
]);
const FATES: ReadonlySet<string> = new Set<PlanFate>(['done', 'dropped', 'moved']);
const FOLD_LIMIT = 3;
const MAX_DEPTH = 4;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** A known status, else `pending`. */
export function planStatus(s: unknown): PlanStepStatus {
  return typeof s === 'string' && STATUSES.has(s) ? (s as PlanStepStatus) : 'pending';
}

/** The strings for `lang` (anything but `ko` is English). */
export function planStrings(lang?: string): PlanStrings {
  return lang === 'ko' ? PLAN_STRINGS.ko : PLAN_STRINGS.en;
}

// ── Pure helpers ────────────────────────────────────────────────────────────

/** The plan footer: phase, done/total and the time — since the first start while running, the total once finished. */
export function planPhase(steps: ReadonlyArray<Pick<PlanStep, 'status' | 'startedAt' | 'endedAt'>>): PlanPhase {
  let done = 0;
  let finished = 0;
  let running = false;
  let failed = false;
  let paused = false;
  let first = 0;
  let last = 0;
  for (const s of steps) {
    if (s.status === 'done') done++;
    if (s.status === 'done' || s.status === 'skipped' || s.status === 'dropped') finished++;
    if (s.status === 'running') running = true;
    if (s.status === 'failed') failed = true;
    if (s.status === 'paused') paused = true;
    const st = num(s.startedAt);
    if (st && (!first || st < first)) first = st;
    const en = num(s.endedAt);
    if (en > last) last = en;
  }
  const total = steps.length;
  const phase = running
    ? 'running'
    : failed
      ? 'failed'
      : total > 0 && finished === total
        ? 'done'
        : paused
          ? 'paused'
          : 'idle';
  const tookMs = (phase === 'done' || phase === 'failed') && first && last > first ? last - first : 0;
  return { phase, done, total, since: phase === 'running' ? first : 0, tookMs };
}

/** Indexes of the done steps folded away: every done step but the last `limit` (earliest first). */
export function planFoldedSteps(steps: ReadonlyArray<Pick<PlanStep, 'status'>>, limit = FOLD_LIMIT): number[] {
  const doneAt: number[] = [];
  steps.forEach((s, i) => {
    if (s.status === 'done') doneAt.push(i);
  });
  return doneAt.slice(0, Math.max(0, doneAt.length - limit));
}

/**
 * How many leading steps fold behind the "earlier" toggle: the run of done steps the plan starts with, less the
 * last `keep` of them (so the fold never reorders the list). 0 = nothing to fold.
 */
export function planLeadFold(steps: ReadonlyArray<Pick<PlanStep, 'status'>>, keep = FOLD_LIMIT): number {
  let lead = 0;
  while (lead < steps.length && steps[lead].status === 'done') lead++;
  return Math.max(0, lead - Math.max(0, keep));
}

/** The fate badge's words: `Done`, `Dropped`, `Moved to Plan 2` (`Moved` without a target). */
export function planFateLabel(fate: PlanFate, movedTo?: string, lang?: string): string {
  const t = planStrings(lang);
  if (fate === 'moved' && movedTo) return t.movedTo(movedTo);
  return t.fate[fate] ?? '';
}

/** Time of day: `6:56 PM` (en) / `오후 06:56` (ko). */
export function planTimeOfDay(ts: number, lang: PlanLang = 'en'): string {
  if (!num(ts)) return '';
  return lang === 'ko'
    ? new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ── Markup ──────────────────────────────────────────────────────────────────

export interface PlanStepOptions {
  lang?: PlanLang;
  /** Ids of steps whose state just changed: their marker pops (and a done rail draws down). */
  pop?: ReadonlySet<string>;
  /** Markup of the running marker / foot icon. Default `PLAN_ICON.spin`. */
  spin?: string;
  /** Statuses that also get a status chip (icon + word) after the label; `true` = every status. Default none. */
  chips?: boolean | readonly PlanStepStatus[];
}

export interface PlanListOptions extends PlanStepOptions {
  /** The list's accessible name. */
  label: string;
  /**
   * The done-step fold: every done step but the last `limit` (default 3) leaves the list behind one
   * "Show N more completed" toggle (`.pl-fold-btn`, data-key `pl-fold`). Off when absent.
   */
  fold?: { expanded: boolean; limit?: number };
  /** Extra class names on the `<ol>`. */
  className?: string;
}

/** The marker glyph for a status. */
export function planMarker(status: PlanStepStatus, spin: string = PLAN_ICON.spin): string {
  switch (status) {
    case 'done':
      return PLAN_ICON.check;
    case 'running':
      return spin;
    case 'failed':
      return PLAN_ICON.cross;
    case 'skipped':
      return PLAN_ICON.dash;
    case 'paused':
      return PLAN_ICON.pause;
    case 'dropped':
      return PLAN_ICON.slash;
    default:
      return '';
  }
}

/** A status chip: icon + word (`.pl-state[data-st]`). Decorative next to text that already says it (`hidden`). */
export function planStateHtml(
  status: PlanStepStatus,
  o: { lang?: string; spin?: string; hidden?: boolean } = {},
): string {
  const st = planStatus(status);
  const glyph = st === 'pending' ? PLAN_ICON.dot : planMarker(st, o.spin ?? PLAN_ICON.spin);
  return `<span class="pl-state" data-st="${st}"${o.hidden ? ' aria-hidden="true"' : ''}>${glyph}<span class="pl-state-word">${esc(
    planStrings(o.lang).status[st],
  )}</span></span>`;
}

/** A fate badge (`.pl-fate[data-fate]`): a glyph + the words. Empty for an unknown fate. */
export function planFateHtml(fate: PlanFate | undefined, movedTo?: string, lang?: string): string {
  if (!fate || !FATES.has(fate)) return '';
  const glyph = icon(fate === 'done' ? 'check' : fate === 'moved' ? 'arrow-right' : 'minus', { size: 10, stroke: 2 });
  return `<span class="pl-fate" data-fate="${fate}">${glyph}${esc(planFateLabel(fate, movedTo, lang))}</span>`;
}

function chipFor(st: PlanStepStatus, chips: PlanStepOptions['chips']): boolean {
  if (!chips) return false;
  return chips === true || chips.includes(st);
}

function stepHtml(s: PlanStep, o: PlanStepOptions, depth: number): string {
  const t = planStrings(o.lang);
  const lang = o.lang ?? 'en';
  const st = planStatus(s.status);
  const marker = planMarker(st, o.spin);
  const calls =
    st !== 'pending' && s.toolCalls !== undefined
      ? `<span class="pl-chip">${esc(t.calls(Math.round(num(s.toolCalls))))}</span>`
      : '';
  const start = num(s.startedAt);
  const end = num(s.endedAt);
  let aside = '';
  if (st === 'running' && start) aside = `<span data-since="${start}"></span>`;
  else if (s.note) aside = esc(s.note);
  else if (st !== 'running' && start && end > start) aside = esc(fmtDurationIn(end - start, lang));
  const times = [start ? planTimeOfDay(start, lang) : '', end ? planTimeOfDay(end, lang) : '']
    .filter(Boolean)
    .join(' → ');
  const fate = planFateHtml(s.fate, s.movedTo, lang);
  const chip = chipFor(st, o.chips) ? planStateHtml(st, { lang, spin: o.spin, hidden: true }) : '';
  const kids = depth < MAX_DEPTH && Array.isArray(s.steps) ? s.steps.filter(Boolean) : [];
  const subs = kids.length
    ? `<ol class="pl-list pl-subs" aria-label="${escAttr(t.subSteps(s.label))}">${kids
        .map((c) => stepHtml(c, o, depth + 1))
        .join('')}</ol>`
    : '';
  return `<li class="pl-step${o.pop?.has(s.id) ? ' pl-pop' : ''}" data-step="${st}"${
    st === 'running' ? ' aria-current="step"' : ''
  }${times ? ` title="${escAttr(times)}"` : ''}><span class="pl-marker" aria-hidden="true">${marker}</span><span class="pl-main"><span class="pl-line">${
    s.ref ? `<span class="pl-ref">${esc(s.ref)}</span>` : ''
  }<span class="pl-text">${esc(s.label)}</span>${fate}${chip}${calls}</span>${
    s.detail ? `<span class="pl-sub" title="${escAttr(s.detail)}">${esc(s.detail)}</span>` : ''
  }<span class="sr-only">, ${esc(t.stepSr[st])}</span>${subs}</span><span class="pl-aside">${aside}</span></li>`;
}

/** One step (`<li class="pl-step">`), with its sub-steps nested. */
export function planStepHtml(s: PlanStep, o: PlanStepOptions = {}): string {
  return stepHtml(s, o, 0);
}

/** The steps as one `<ol class="pl-list">`, with the done-step fold when asked for. */
export function planListHtml(steps: readonly PlanStep[], o: PlanListOptions): string {
  const t = planStrings(o.lang);
  const fold = o.fold ? planFoldedSteps(steps, o.fold.limit) : [];
  const expanded = !!o.fold?.expanded;
  const hidden = new Set(expanded ? [] : fold);
  let rows = '';
  steps.forEach((s, i) => {
    if (fold.length && i === fold[0]) {
      rows += `<li class="pl-fold"><button type="button" class="pl-fold-btn" data-key="pl-fold" aria-expanded="${expanded}">${esc(
        expanded ? t.foldHide : t.foldShow(fold.length),
      )}</button></li>`;
    }
    if (!hidden.has(i)) rows += planStepHtml(s, o);
  });
  return `<ol class="pl-list${o.className ? ` ${escAttr(o.className)}` : ''}" aria-label="${escAttr(o.label)}">${rows}</ol>`;
}

/** The phase foot: `◌ Running · 2/4` and the time on the right (live since the first start, or the total). */
export function planFootHtml(
  steps: ReadonlyArray<Pick<PlanStep, 'status' | 'startedAt' | 'endedAt'>>,
  o: { lang?: PlanLang; spin?: string } = {},
): string {
  const t = planStrings(o.lang);
  const p = planPhase(steps);
  const icon =
    p.phase === 'running'
      ? (o.spin ?? PLAN_ICON.spin)
      : p.phase === 'done'
        ? PLAN_ICON.check
        : p.phase === 'failed'
          ? PLAN_ICON.cross
          : p.phase === 'paused'
            ? PLAN_ICON.pause
            : PLAN_ICON.dot;
  const time =
    p.phase === 'running' && p.since
      ? `<span data-since="${p.since}"></span>`
      : p.tookMs
        ? esc(fmtDurationIn(p.tookMs, o.lang))
        : '';
  return `<div class="pl-foot" data-phase="${p.phase}"><span class="pl-foot-st"><span class="pl-foot-icon" aria-hidden="true">${icon}</span>${esc(
    t.phase[p.phase],
  )} · ${p.done}/${p.total}</span>${time ? `<span class="pl-foot-time" aria-hidden="true">${time}</span>` : ''}</div>`;
}

export interface PlanEarlierOptions {
  /** Identity: the toggle's `data-earlier` + data-key `pl-earlier-<id>`, the region id. Letters, digits, - and _. */
  id: string;
  open: boolean;
  /** The toggle's words (`Earlier plans`, `Show 4 more completed`). */
  label: string;
  /** A count chip after the words. */
  count?: number;
  /** Quiet text after the count (`3 done · 1 dropped`). */
  meta?: string;
  /** The folded content (markup the caller already escaped). */
  body: string;
}

/**
 * The "earlier" fold: a toggle with a chevron that turns, and a region that grows 0fr → 1fr with a fade and is
 * inert while closed. The component owns `open` and re-renders with morphInto so the transition runs.
 */
export function planEarlierHtml(o: PlanEarlierOptions): string {
  const id = String(o.id).replace(/[^A-Za-z0-9_-]/g, '-');
  const count = Number.isFinite(o.count) && (o.count as number) > 0 ? Math.round(o.count as number) : 0;
  return `<div class="pl-earlier" data-earlier="${id}"${o.open ? ' data-open' : ''}><button type="button" class="pl-earlier-btn" data-earlier="${id}" data-key="pl-earlier-${id}" aria-expanded="${o.open}" aria-controls="pl-earlier-${id}">${icon(
    'chevron-right',
    { size: 12, class: 'pl-earlier-chev' },
  )}<span class="pl-earlier-label">${esc(o.label)}</span>${count ? `<span class="pl-earlier-count">${count}</span>` : ''}${
    o.meta ? `<span class="pl-earlier-meta">${esc(o.meta)}</span>` : ''
  }</button><div class="pl-earlier-region" id="pl-earlier-${id}"${o.open ? '' : ' inert'}><div class="pl-earlier-in">${o.body}</div></div></div>`;
}

/**
 * The plan's look. Markers sit on `--pl-bg` (default `--surface`) so the rail passes behind them — a host on
 * another surface sets `--pl-bg`. State rules use child combinators so a step's state never leaks into its
 * sub-steps.
 */
export const planCss = `
/* ── PLAN: a marker per step (check · spinner · ring · ✕ · dash · pause · slash) on one rail, time on the right ── */
.pl-list { position: relative; margin: 0; padding: 0; list-style: none; }
.pl-empty { margin: 0; padding: 2px 0 4px; font-size: 12px; color: var(--text-tertiary); }
.pl-step { position: relative; display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; column-gap: 10px; align-items: start; padding: 5px 0; font-size: 12.5px; line-height: 18px; }
.pl-marker { position: relative; z-index: 1; display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--pl-bg, var(--surface)); box-shadow: inset 0 0 0 1px var(--ib-card-border); color: var(--text-secondary); }
.pl-step[data-step="done"] > .pl-marker { background: var(--ib-pill); box-shadow: none; color: var(--text); }
.pl-step[data-step="running"] > .pl-marker { box-shadow: none; color: var(--st-run); }
.pl-step[data-step="failed"] > .pl-marker { background: color-mix(in srgb, var(--st-fail) calc(16% * var(--chroma)), var(--pl-bg, var(--surface))); box-shadow: none; color: color-mix(in srgb, var(--st-fail-text) calc(100% * var(--chroma)), var(--st-fail)); }
.pl-step[data-step="skipped"] > .pl-marker { box-shadow: none; border: 1px dashed var(--text-tertiary); color: var(--text-tertiary); }
.pl-step[data-step="paused"] > .pl-marker { background: color-mix(in srgb, var(--st-wait) calc(16% * var(--chroma)), var(--pl-bg, var(--surface))); box-shadow: none; color: color-mix(in srgb, var(--st-wait) calc(70% + 30% * (1 - var(--chroma))), var(--text)); }
.pl-step[data-step="dropped"] > .pl-marker { color: var(--text-tertiary); }
.pl-marker svg { width: 10px; height: 10px; }
.pl-marker .pl-spin { width: 11px; height: 11px; }
.pl-step.pl-pop > .pl-marker > * { animation: pl-pop var(--dur-move) var(--ease-out) both; }
@keyframes pl-pop { from { opacity: 0; transform: scale(0.6); } }
.pl-list > .pl-step:not(:last-child)::before { content: ""; position: absolute; left: 8.5px; top: 25px; bottom: -3px; width: 1px; background: var(--ib-card-border); }
.pl-list > .pl-step[data-step="done"]:not(:last-child)::after { content: ""; position: absolute; left: 8.5px; top: 25px; bottom: -3px; width: 1px; background: var(--text-tertiary); transform-origin: top; }
.pl-list > .pl-step.pl-pop[data-step="done"]:not(:last-child)::after { animation: pl-rail 560ms var(--ease-out) both; }
@keyframes pl-rail { from { transform: scaleY(0); } }
.pl-main { min-width: 0; }
.pl-line { display: block; overflow-wrap: anywhere; }
.pl-ref { margin-right: 6px; font-size: 11px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
.pl-text { color: var(--text-secondary); }
.pl-step[data-step="running"] > .pl-main > .pl-line > .pl-text { font-weight: 600; color: var(--text); }
.pl-step[data-step="failed"] > .pl-main > .pl-line > .pl-text, .pl-step[data-step="paused"] > .pl-main > .pl-line > .pl-text { color: var(--text); }
.pl-step[data-step="skipped"] > .pl-main > .pl-line > .pl-text { color: var(--text-tertiary); }
.pl-step[data-step="dropped"] > .pl-main > .pl-line > .pl-text { color: var(--text-tertiary); text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--text-tertiary) 55%, transparent); }
.pl-chip { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 6px; background: var(--ib-pill); color: var(--text-secondary); font-size: 11px; font-weight: 400; line-height: 16px; white-space: nowrap; font-variant-numeric: tabular-nums; vertical-align: 1px; }
.pl-sub { display: block; margin-top: 1px; overflow: hidden; font-size: 12px; color: var(--text-tertiary); text-overflow: ellipsis; white-space: nowrap; }
.pl-step[data-step="failed"] > .pl-main > .pl-sub { color: var(--st-fail-text); white-space: normal; overflow-wrap: anywhere; }
.pl-aside { min-height: 18px; font-size: 12px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; white-space: nowrap; }
.pl-step[data-step="running"] > .pl-aside { color: var(--text); }
.pl-fold { padding: 0 0 0 28px; }
.pl-fold-btn { min-height: 28px; padding: 4px 0; border: 0; background: none; color: var(--accent); font-size: 11.5px; font-weight: 600; }
.pl-fold-btn:hover { text-decoration: underline; }

/* Fate badge (a step that left its plan) and status chip: glyph + word, never colour alone. */
.pl-fate, .pl-state { display: inline-flex; align-items: center; gap: 4px; margin-left: 6px; padding: 0 6px 0 5px; border-radius: 6px; background: var(--ib-pill); color: var(--text-secondary); font-size: 11px; font-weight: 600; line-height: 16px; white-space: nowrap; font-variant-numeric: tabular-nums; vertical-align: 1px; text-decoration: none; }
.pl-fate > svg, .pl-state > svg { flex: none; width: 10px; height: 10px; }
.pl-fate[data-fate="done"] > svg { color: color-mix(in srgb, currentColor calc(100% * var(--chroma)), var(--st-done)); }
.pl-fate[data-fate="done"] { background: color-mix(in srgb, var(--st-done) calc(14% * var(--chroma)), color-mix(in srgb, var(--pl-bg, var(--surface)) calc(100% * var(--chroma)), var(--ib-pill))); color: color-mix(in srgb, var(--st-done) calc(70% * var(--chroma)), var(--text)); }
.pl-state { --pl-tone: var(--text-tertiary); border-radius: 999px; padding: 0 7px 0 5px; }
.pl-state > svg { color: var(--pl-tone); }
.pl-state > .pl-spin { width: 9px; height: 9px; border-width: 1.5px; }
.pl-state[data-st="running"] { --pl-tone: var(--st-run); background: color-mix(in srgb, var(--st-run) calc(14% * var(--chroma)), color-mix(in srgb, var(--pl-bg, var(--surface)) calc(100% * var(--chroma)), var(--ib-pill))); color: color-mix(in srgb, var(--st-run) calc(70% * var(--chroma)), var(--text)); }
.pl-state[data-st="paused"] { --pl-tone: var(--st-wait); background: color-mix(in srgb, var(--st-wait) calc(16% * var(--chroma)), color-mix(in srgb, var(--pl-bg, var(--surface)) calc(100% * var(--chroma)), var(--ib-pill))); color: color-mix(in srgb, var(--st-wait) calc(70% * var(--chroma)), var(--text)); }
.pl-state[data-st="done"] { --pl-tone: var(--st-done); background: color-mix(in srgb, var(--st-done) calc(14% * var(--chroma)), color-mix(in srgb, var(--pl-bg, var(--surface)) calc(100% * var(--chroma)), var(--ib-pill))); color: color-mix(in srgb, var(--st-done) calc(70% * var(--chroma)), var(--text)); }
.pl-state[data-st="failed"] { --pl-tone: color-mix(in srgb, var(--st-fail-text) calc(100% * var(--chroma)), var(--st-fail)); background: color-mix(in srgb, var(--st-fail) calc(14% * var(--chroma)), color-mix(in srgb, var(--pl-bg, var(--surface)) calc(100% * var(--chroma)), var(--ib-pill))); color: var(--st-fail-text); }

/* Sub-steps: a smaller rail inside the step's text column. */
.pl-subs { margin-top: 3px; }
.pl-subs > .pl-step { grid-template-columns: 14px minmax(0, 1fr) auto; column-gap: 8px; padding: 3px 0; font-size: 12px; line-height: 16px; }
.pl-subs > .pl-step > .pl-marker { width: 14px; height: 14px; margin-top: 1px; }
.pl-subs > .pl-step > .pl-marker svg { width: 8px; height: 8px; }
.pl-subs > .pl-step > .pl-marker .pl-spin { width: 9px; height: 9px; border-width: 1.5px; }
.pl-subs > .pl-step:not(:last-child)::before, .pl-subs > .pl-step[data-step="done"]:not(:last-child)::after { left: 6.5px; top: 20px; bottom: -2px; }
.pl-subs > .pl-step > .pl-aside { min-height: 16px; font-size: 11.5px; }
.pl-subs > .pl-step > .pl-main > .pl-sub { font-size: 11.5px; }

/* The "earlier" fold: chevron + words + count; the region grows 0fr → 1fr with a fade, inert while closed. */
.pl-earlier { min-width: 0; }
.pl-earlier-btn { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; min-height: 28px; margin: 0 0 0 -6px; padding: 4px 8px 4px 6px; border: 0; border-radius: 8px; background: none; color: var(--text-secondary); font-size: 12px; font-weight: 600; line-height: 16px; text-align: left; -webkit-tap-highlight-color: transparent; transition: background-color var(--dur-press) ease, color var(--dur-press) ease, transform var(--dur-press) var(--ease-out); }
.pl-earlier-btn:active:not(:focus-visible) { transform: scale(0.97); }
.pl-earlier-chev { flex: none; width: 12px; height: 12px; color: var(--text-tertiary); transition: transform var(--dur-press) var(--ease-out); }
.pl-earlier[data-open] > .pl-earlier-btn .pl-earlier-chev { transform: rotate(90deg); }
.pl-earlier-label { min-width: 0; overflow-wrap: anywhere; }
.pl-earlier-count { flex: none; min-width: 18px; padding: 0 6px; border-radius: 999px; background: var(--ib-pill); color: var(--text-secondary); font-size: 11px; font-weight: 600; text-align: center; font-variant-numeric: tabular-nums; }
.pl-earlier-meta { min-width: 0; font-weight: 500; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
.pl-earlier-region { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--dur-expand) var(--ease-out); }
.pl-earlier[data-open] > .pl-earlier-region { grid-template-rows: 1fr; }
.pl-earlier-in { min-height: 0; overflow: hidden; opacity: 0; visibility: hidden; transition: opacity var(--dur-expand) var(--ease-out), visibility 0s linear var(--dur-expand); }
.pl-earlier[data-open] > .pl-earlier-region > .pl-earlier-in { opacity: 1; visibility: visible; transition: opacity var(--dur-expand) var(--ease-out), visibility 0s; }

/* The phase foot. A host places it (sticky, bleeding to its padding) with its own rule. */
.pl-foot { display: flex; align-items: center; gap: 8px; margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--border); background: var(--pl-bg, var(--surface)); font-size: 12.5px; color: var(--text-secondary); }
.pl-foot-st { display: inline-flex; align-items: center; gap: 7px; min-width: 0; color: var(--text); font-variant-numeric: tabular-nums; }
.pl-foot-icon { display: inline-grid; place-items: center; width: 14px; height: 14px; color: var(--text-tertiary); }
.pl-foot[data-phase="running"] .pl-foot-icon { color: var(--st-run); }
.pl-foot[data-phase="paused"] .pl-foot-icon { color: color-mix(in srgb, var(--st-wait) calc(70% + 30% * (1 - var(--chroma))), var(--text)); }
.pl-foot[data-phase="done"] .pl-foot-icon { color: var(--st-done); }
.pl-foot[data-phase="failed"] .pl-foot-icon { color: color-mix(in srgb, var(--st-fail-text) calc(100% * var(--chroma)), var(--st-fail)); }
.pl-foot-icon svg { width: 12px; height: 12px; }
.pl-foot-icon .pl-spin { width: 11px; height: 11px; }
.pl-foot-time { margin-left: auto; font-variant-numeric: tabular-nums; white-space: nowrap; }

/* ── Spinner ── */
.pl-spin { display: inline-block; flex: none; width: 12px; height: 12px; border: 2px solid var(--ib-pill); border-top-color: var(--st-run); border-right-color: var(--st-run); border-radius: 50%; vertical-align: -1px; animation: pl-spin 0.9s linear infinite; }
@keyframes pl-spin { to { transform: rotate(360deg); } }

@media (hover: hover) and (pointer: fine) {
  .pl-earlier-btn:hover { background: var(--ib-pill); color: var(--text); }
}
@media (pointer: coarse), (max-width: 639px) {
  .pl-earlier-btn { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .pl-step.pl-pop > .pl-marker > *, .pl-list > .pl-step.pl-pop[data-step="done"]:not(:last-child)::after { animation: none; }
  .pl-earlier-btn, .pl-earlier-chev, .pl-earlier-region { transition: none !important; }
  .pl-earlier-btn:active:not(:focus-visible) { transform: none; }
  .pl-earlier-in { transition: opacity 120ms ease, visibility 0s linear 120ms !important; }
  .pl-earlier[data-open] > .pl-earlier-region > .pl-earlier-in { transition: opacity 120ms ease, visibility 0s !important; }
}
`;
