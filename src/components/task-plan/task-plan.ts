import { define, UiElement } from '../../core/element';
import { fmtDuration } from '../../core/format';
import { esc, escAttr } from '../../core/html';
import { morphInto } from '../../core/morph';
import {
  type PlanFate,
  type PlanLang,
  type PlanStep,
  type PlanStepStatus,
  planCss,
  planEarlierHtml,
  planFootHtml,
  planLeadFold,
  planListHtml,
  planStatus,
  planStrings,
} from '../../core/plan';
import { icon } from '../../icons/icons';
import { styles } from './styles';

export type { PlanFate as TaskPlanFate, PlanStep as TaskPlanStep, PlanStepStatus as TaskPlanStepStatus };

/** A plan the agent replaced: its steps keep the fate they had when it left (done / dropped / moved). */
export interface TaskPlanEarlier {
  id: string;
  title: string;
  steps: PlanStep[];
}

export interface TaskPlanData {
  /** Heading. Default `Plan` / `계획`; an empty string draws no heading. */
  title?: string;
  /** The current plan, in order. Sub-steps nest under `steps[i].steps`. */
  steps: PlanStep[];
  /** Plans this one replaced, oldest first — folded behind “Earlier plans”. */
  earlier?: TaskPlanEarlier[];
  /**
   * Words of the host's own: the earlier fold's label (`Dropped before they ran`) and its region's name, and the
   * line for a plan with no step left (`''` draws none — when the fold says it all).
   */
  labels?: { earlier?: string; earlierList?: string; noSteps?: string };
  /** The host's clock (epoch ms) when it built this data: running clocks correct for this device's clock skew. */
  now?: number;
  /**
   * Window mode (also the `max` attribute): at most this many step rows — when the plan is longer, the earliest
   * done steps leave first, then the latest pending ones from the end; the running step always stays. The rows
   * left out are one quiet "+N" button at the end (`more`) whose press is `ui-more`. No lead fold in a window.
   */
  max?: number;
  /** `'none'` (also the `foot` attribute): no phase foot — the host's face already says the phase and the time. */
  foot?: 'none';
  /** The window's "+N" button in the host's words (`+3 done · all 12 tasks →`). Default `+N more` / `+N개 더`. */
  more?: string;
}

/** `ui-toggle` detail: which fold the person opened or closed. */
export interface TaskPlanToggle {
  id: 'earlier-plans' | 'earlier-steps';
  open: boolean;
}

/** `ui-more` detail (notification): the person pressed the window's "+N" button — the host opens the whole plan. */
export interface TaskPlanMore {
  /** Steps the window left out. */
  hidden: number;
  /** Steps in the plan. */
  total: number;
}

/** What a window of `max` rows shows of a plan. */
export interface TaskPlanWindow {
  /** Indexes of the steps shown, in plan order. */
  shown: number[];
  /** Steps left out. */
  hidden: number;
}

const STRINGS = {
  en: {
    title: 'Plan',
    steps: 'Plan steps',
    empty: 'No plan yet',
    emptyHint: 'Steps show up here once the agent writes its plan.',
    noSteps: 'No steps in this plan yet',
    earlier: 'Earlier plans',
    earlierList: 'Earlier plans and how their steps ended',
    stepDone: (l: string) => `Step done: ${l}`,
    stepFailed: (l: string) => `Step failed: ${l}`,
    stepPaused: (l: string) => `Step paused: ${l}`,
    window: (n: number, total: number) => `Plan steps, ${n} of ${total}`,
    more: (n: number) => `+${n} more`,
    fateCount: {
      done: (n: number) => `${n} done`,
      dropped: (n: number) => `${n} dropped`,
      moved: (n: number) => `${n} moved`,
    } as Record<PlanFate, (n: number) => string>,
  },
  ko: {
    title: '계획',
    steps: '계획 단계',
    empty: '아직 계획이 없습니다',
    emptyHint: '에이전트가 계획을 세우면 단계가 여기에 표시됩니다.',
    noSteps: '이 계획에는 아직 단계가 없습니다',
    earlier: '이전 계획',
    earlierList: '이전 계획과 각 단계의 결과',
    stepDone: (l: string) => `단계 완료: ${l}`,
    stepFailed: (l: string) => `단계 실패: ${l}`,
    stepPaused: (l: string) => `단계 멈춤: ${l}`,
    window: (n: number, total: number) => `계획 단계, 전체 ${total}개 중 ${n}개`,
    more: (n: number) => `+${n}개 더`,
    fateCount: {
      done: (n: number) => `완료 ${n}`,
      dropped: (n: number) => `제외 ${n}`,
      moved: (n: number) => `이동 ${n}`,
    } as Record<PlanFate, (n: number) => string>,
  },
};
type Strings = (typeof STRINGS)['en'];

/** Steps that get a status chip (icon + word) next to their marker: the states a marker alone says least about. */
const CHIPS: readonly PlanStepStatus[] = ['paused', 'failed', 'skipped', 'dropped'];
const FATES: ReadonlySet<string> = new Set<PlanFate>(['done', 'dropped', 'moved']);
/** Done steps the current plan keeps in view before the rest fold behind “Show N more completed”. */
const KEEP_DONE = 3;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const list = (v: unknown): PlanStep[] => (Array.isArray(v) ? v.filter((s) => s && typeof s === 'object') : []);

// ── Pure helpers ────────────────────────────────────────────────────────────

/**
 * How a step of an earlier plan ended: its own `fate` when the host set one, else `moved` when it names where it
 * went, `done` when it was done, and `dropped` for anything else (the new plan left it behind).
 */
export function taskStepFate(step: Pick<PlanStep, 'fate' | 'movedTo' | 'status'>): PlanFate {
  if (step.fate && FATES.has(step.fate)) return step.fate;
  if (step.movedTo) return 'moved';
  return step.status === 'done' ? 'done' : 'dropped';
}

/**
 * An earlier plan's steps as drawn: each top-level step carries its fate, and nothing in a replaced plan runs —
 * a step (or sub-step) still marked running shows as paused, so no clock ticks there.
 */
export function taskEarlierSteps(steps: readonly PlanStep[]): PlanStep[] {
  const still = (s: PlanStep): PlanStep => ({
    ...s,
    status: s.status === 'running' ? 'paused' : planStatus(s.status),
    steps: s.steps ? list(s.steps).map(still) : undefined,
  });
  return list(steps).map((s) => ({ ...still(s), fate: taskStepFate(s) }));
}

/** How many top-level steps of a plan ended done, dropped or moved. */
export function taskFateCounts(steps: readonly PlanStep[]): Record<PlanFate, number> {
  const n: Record<PlanFate, number> = { done: 0, dropped: 0, moved: 0 };
  for (const s of list(steps)) n[taskStepFate(s)]++;
  return n;
}

/** `3 done · 1 dropped · 1 moved` (zero counts left out) / `완료 3 · 제외 1 · 이동 1`. */
export function taskFateSummary(counts: Record<PlanFate, number>, lang?: string): string {
  const t = lang === 'ko' ? STRINGS.ko : STRINGS.en;
  return (['done', 'dropped', 'moved'] as const)
    .filter((f) => num(counts[f]))
    .map((f) => t.fateCount[f](Math.round(num(counts[f]))))
    .join(' · ');
}

/**
 * The rows a window of `max` keeps (0 = every row): when the plan is longer, the earliest done steps leave first,
 * then the latest pending ones from the end, then anything else from the end — a running step never leaves, so a
 * window may run over `max` only when more steps than that run at once.
 */
export function taskWindow(steps: ReadonlyArray<Pick<PlanStep, 'status'>>, max: number): TaskPlanWindow {
  const n = steps.length;
  const cap = Math.floor(num(max));
  const st = steps.map((s) => planStatus(s.status));
  const keep: boolean[] = new Array(n).fill(true);
  let over = cap ? Math.max(0, n - cap) : 0;
  const drop = (i: number) => {
    keep[i] = false;
    over--;
  };
  for (let i = 0; i < n && over > 0; i++) if (st[i] === 'done') drop(i);
  for (let i = n - 1; i >= 0 && over > 0; i--) if (keep[i] && st[i] === 'pending') drop(i);
  for (let i = n - 1; i >= 0 && over > 0; i--) if (keep[i] && st[i] !== 'running') drop(i);
  const shown: number[] = [];
  keep.forEach((k, i) => {
    if (k) shown.push(i);
  });
  return { shown, hidden: n - shown.length };
}

/** Every step of a plan with its sub-steps, depth first (ids → statuses for announcing changes). */
function flatten(steps: readonly PlanStep[], out: PlanStep[] = [], depth = 0): PlanStep[] {
  for (const s of list(steps)) {
    out.push(s);
    if (depth < 4 && s.steps) flatten(s.steps, out, depth + 1);
  }
  return out;
}

/**
 * `<ui-task-plan>` — the agent's plan for a task: a marker per step on one rail (sub-steps nested), the running
 * step bold with a live clock, status chips for paused / failed / skipped / dropped steps, earlier completed steps
 * and earlier plans folded behind toggles (each earlier step with its fate), and the phase foot
 * (`Running · 3/7 · 4m 12s`). Read-only: the only intents are opening a fold (`ui-toggle`) and, in a window
 * (`max`), asking for the whole plan with the "+N" button (`ui-more`).
 */
export class UiTaskPlan extends UiElement<TaskPlanData> {
  static override styles = [planCss, styles];
  static get observedAttributes() {
    return ['lang', 'max', 'foot'];
  }

  readonly #live: HTMLElement;
  #timer: ReturnType<typeof setInterval> | 0 = 0;
  #open = { 'earlier-plans': false, 'earlier-steps': false };
  #skew = 0;
  #seen: TaskPlanData | undefined;
  #prev: Map<string, PlanStepStatus> | null = null;
  #pop = new Set<string>();

  constructor() {
    super();
    this.#live = document.createElement('div');
    this.#live.className = 'sr-only';
    this.#live.setAttribute('role', 'status');
    this.#live.setAttribute('aria-live', 'polite');
    this.root.append(this.#live);
    this.root.addEventListener('click', (e) => this.#onClick(e));
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override disconnectedCallback(): void {
    this.#stopTimer();
  }

  get #lang(): PlanLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #t(): Strings {
    return STRINGS[this.#lang];
  }

  /** The window's row cap: `data.max`, else the `max` attribute; 0 = the whole plan. */
  get #max(): number {
    const d = this.data?.max;
    return Math.floor(num(d !== undefined && d !== null ? d : this.getAttribute('max')));
  }

  /** No phase foot: `data.foot` / the `foot` attribute is `none`. */
  get #footOff(): boolean {
    return (this.data?.foot ?? this.getAttribute('foot')) === 'none';
  }

  /** Open or close a fold from the host (no event, no sound — its own choice): a “see every task” landing. */
  setOpen(id: TaskPlanToggle['id'], open: boolean): void {
    if (id !== 'earlier-plans' && id !== 'earlier-steps') return;
    if (this.#open[id] === !!open) return;
    this.#open[id] = !!open;
    this.requestRender();
  }

  /** Whether a fold is open now. */
  isOpen(id: TaskPlanToggle['id']): boolean {
    return id === 'earlier-plans' || id === 'earlier-steps' ? this.#open[id] : false;
  }

  #onClick(e: Event): void {
    const target = e.target as Element | null;
    if (target?.closest?.('.tp-more-btn')) {
      // The window's "+N": the host opens the whole plan (and its surface sounds); nothing changes here.
      const steps = list(this.data?.steps);
      this.notify<TaskPlanMore>('ui-more', { hidden: taskWindow(steps, this.#max).hidden, total: steps.length });
      return;
    }
    const btn = target?.closest?.('.pl-earlier-btn') as HTMLElement | null;
    const id = btn?.dataset.earlier;
    if (id !== 'earlier-plans' && id !== 'earlier-steps') return;
    const open = !this.#open[id];
    this.#open[id] = open;
    this.renderNow();
    this.notify<TaskPlanToggle>('ui-toggle', { id, open });
    this.sound(open ? 'open' : 'close', { emphasis: 'subtle' }, e);
  }

  // ── Render cycle ──────────────────────────────────────────────────────────

  /** Morph instead of replacing: the folds' 0fr → 1fr transition runs, focus and the ticking text nodes stay. */
  protected override update(): void {
    const d = this.data;
    if (d !== this.#seen) this.#observe(d);
    const key = (this.root.activeElement as HTMLElement | null)?.dataset?.key;
    morphInto(this.content, this.render());
    this.#pop.clear();
    this.updated();
    if (key && !this.root.activeElement) {
      this.$$('[data-key]')
        .find((el) => el.dataset.key === key)
        ?.focus({ preventScroll: true });
    }
  }

  /** Compare with the last data: which steps changed state (they pop) and what to announce. */
  #observe(d: TaskPlanData | undefined): void {
    this.#seen = d;
    this.#skew = d && num(d.now) ? num(d.now) - Date.now() : 0;
    if (!d) return;
    const t = this.#t;
    const prev = this.#prev;
    const now = new Map<string, PlanStepStatus>();
    const said: string[] = [];
    for (const s of flatten(d.steps ?? [])) {
      const st = planStatus(s.status);
      now.set(s.id, st);
      const was = prev?.get(s.id);
      if (!was || was === st) continue;
      this.#pop.add(s.id);
      if (st === 'done') said.push(t.stepDone(s.label));
      else if (st === 'failed') said.push(t.stepFailed(s.label));
      else if (st === 'paused') said.push(t.stepPaused(s.label));
    }
    // An empty plan is a baseline as well: the next plan's steps are new, not changed.
    this.#prev = now;
    if (said.length) this.#live.textContent = said.join('. ');
  }

  protected override updated(): void {
    this.#tick();
    const live = !!this.$('[data-since]');
    if (live && !this.#timer && this.isConnected) this.#timer = setInterval(() => this.#tick(), 1000);
    else if (!live) this.#stopTimer();
  }

  #stopTimer(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = 0;
  }

  /** 1 Hz: each clock is a text node filled from its `data-since` — the markup never carries `now`. */
  #tick(): void {
    const now = Date.now() + this.#skew;
    for (const el of this.$$('[data-since]')) {
      const txt = fmtDuration(now - (Number(el.dataset.since) || now));
      if (el.textContent !== txt) el.textContent = txt;
    }
  }

  protected render(): string {
    const d = this.data;
    if (!d) return '';
    const t = this.#t;
    const lang = this.#lang;
    const steps = list(d.steps);
    const earlier = (Array.isArray(d.earlier) ? d.earlier : []).filter((p) => p && list(p.steps).length);
    const title = d.title ?? t.title;
    const head = title ? `<header class="tp-head"><h3 class="tp-title" id="tp-title">${esc(title)}</h3></header>` : '';
    const label = title ? 'aria-labelledby="tp-title"' : `aria-label="${escAttr(t.title)}"`;
    if (!steps.length && !earlier.length) {
      return `<section class="tp is-empty" ${label}>${head}<div class="tp-empty">${icon('list', {
        size: 20,
        class: 'tp-empty-icon',
      })}<strong>${esc(t.empty)}</strong><span>${esc(t.emptyHint)}</span></div></section>`;
    }
    const noSteps = typeof d.labels?.noSteps === 'string' ? d.labels.noSteps.trim() : t.noSteps;
    return `<section class="tp" ${label}>${head}${this.#earlierPlans(earlier, t, lang)}${
      steps.length ? this.#current(steps, t, lang) : noSteps ? `<p class="pl-empty tp-none">${esc(noSteps)}</p>` : ''
    }</section>`;
  }

  /** Earlier plans, oldest first, each with its fate counts and its steps' fates. */
  #earlierPlans(earlier: TaskPlanEarlier[], t: Strings, lang: PlanLang): string {
    if (!earlier.length) return '';
    const counts: Record<PlanFate, number> = { done: 0, dropped: 0, moved: 0 };
    const groups = earlier
      .map((p, i) => {
        const c = taskFateCounts(p.steps);
        for (const f of ['done', 'dropped', 'moved'] as const) counts[f] += c[f];
        const meta = taskFateSummary(c, lang);
        return `<section class="tp-past" aria-labelledby="tp-past-${i}"><h4 class="tp-past-h"><span class="tp-past-title" id="tp-past-${i}">${esc(
          p.title,
        )}</span>${meta ? `<span class="tp-past-meta">${esc(meta)}</span>` : ''}</h4>${planListHtml(
          taskEarlierSteps(p.steps),
          { lang, label: p.title, className: 'tp-past-list' },
        )}</section>`;
      })
      .join('');
    const L = this.data?.labels;
    const label = (typeof L?.earlier === 'string' && L.earlier.trim()) || t.earlier;
    const listLabel = (typeof L?.earlierList === 'string' && L.earlierList.trim()) || t.earlierList;
    return planEarlierHtml({
      id: 'earlier-plans',
      open: this.#open['earlier-plans'],
      label,
      count: earlier.length,
      meta: taskFateSummary(counts, lang),
      body: `<div class="tp-pasts" role="group" aria-label="${escAttr(listLabel)}">${groups}</div>`,
    });
  }

  /** The phase foot, unless the host turned it off (`foot="none"`: its face already says the phase and time). */
  #foot(steps: PlanStep[], lang: PlanLang): string {
    return this.#footOff ? '' : planFootHtml(steps, { lang });
  }

  /**
   * The current plan. A window (`max`): the rows `taskWindow` keeps on one rail, no lead fold, and one quiet "+N"
   * button for the rest. Otherwise: leading done steps past three fold away, then the rest on one rail, then the foot.
   */
  #current(steps: PlanStep[], t: Strings, lang: PlanLang): string {
    const o = { lang, pop: this.#pop, chips: CHIPS };
    const max = this.#max;
    if (max > 0) {
      const w = taskWindow(steps, max);
      const own = typeof this.data?.more === 'string' ? this.data.more.trim() : '';
      const more = w.hidden
        ? `<div class="tp-more"><button type="button" class="tp-more-btn" data-key="tp-more">${esc(
            own || t.more(w.hidden),
          )}</button></div>`
        : '';
      return `${planListHtml(
        w.shown.map((i) => steps[i]),
        { ...o, label: w.hidden ? t.window(w.shown.length, steps.length) : t.steps, className: 'tp-list tp-window' },
      )}${more}${this.#foot(steps, lang)}`;
    }
    const lead = planLeadFold(steps, KEEP_DONE);
    const open = this.#open['earlier-steps'];
    const s = planStrings(lang);
    const fold = lead
      ? planEarlierHtml({
          id: 'earlier-steps',
          open,
          label: open ? s.foldHide : s.foldShow(lead),
          body: planListHtml(steps.slice(0, lead), { ...o, label: t.steps, className: 'tp-lead' }),
        })
      : '';
    return `${fold}${planListHtml(steps.slice(lead), { ...o, label: t.steps, className: 'tp-list' })}${this.#foot(
      steps,
      lang,
    )}`;
  }
}

define('ui-task-plan', UiTaskPlan);

declare global {
  interface HTMLElementTagNameMap {
    'ui-task-plan': UiTaskPlan;
  }
}
