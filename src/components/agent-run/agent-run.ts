import { define, UiElement } from '../../core/element';
import { fmtClock, fmtDuration } from '../../core/format';
import { esc, escAttr } from '../../core/html';
import { PLAN_ICON, planFoldedSteps, planFootHtml, planListHtml, planPhase, planTimeOfDay } from '../../core/plan';
import { styles } from './styles';

/** The run's phase (the head chip). `running` and `waiting` are live: the elapsed clock ticks and Stop shows. */
export type AgentRunStatus = 'running' | 'waiting' | 'idle' | 'done' | 'failed' | 'stopped';
export type AgentRunStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';
export type AgentRunDecision = 'approve' | 'deny' | 'explain' | 'approve_disable_rule';

export interface AgentRunStep {
  id: string;
  label: string;
  status: AgentRunStepStatus;
  /** Short reference shown before the label, e.g. `#T3`. */
  ref?: string;
  /** Second line: what the step is doing now, or why it failed. */
  detail?: string;
  /** Epoch ms. A running step ticks from here; a finished one shows endedAt − startedAt. */
  startedAt?: number;
  endedAt?: number;
  /** Tool calls made while the step ran (chip; never shown on a pending step). */
  toolCalls?: number;
}

export interface AgentRunRule {
  id: string;
  label: string;
  description?: string;
}

/** One tool-permission request waiting on the person. */
export interface AgentRunApproval {
  id: string;
  /** Tool name (`Bash`, `gmail.send`). */
  tool: string;
  /** Card title. Default: `<tool> approval` / `<tool> 실행 승인`. */
  title?: string;
  /** One line under the title (e.g. the tool input's `description`). */
  summary?: string;
  /** The tool input as label → value rows. Non-string values are shown as pretty JSON. */
  fields?: Array<[label: string, value: unknown]>;
  /** The tool input as raw text, when it is not a key/value object (shown in a `<pre>`). */
  raw?: string;
  /** `raw` was cut by the host. */
  truncated?: boolean;
  /** Matched dangerous-command rules (drive the risk pill). */
  rules?: AgentRunRule[];
  /** Epoch ms the request was made (label line). */
  requestedAt?: number;
  /** Epoch ms the request expires (live countdown). */
  expiresAt?: number;
  /** Offer "Approve & disable rule". */
  canDisableRule?: boolean;
  /** Default `true`. `false` disables the answers; a string disables them and says why. */
  canAnswer?: boolean | string;
  /** The answer the host sent: the card becomes one resolved row. */
  answered?: AgentRunDecision;
  /** Why the last answer failed (the answers unlock again). */
  error?: string;
}

export interface AgentRunChoice {
  id: string;
  label: string;
  description?: string;
  /** The recommended choice goes first, as the card's one primary (⌘/Ctrl+Enter). */
  recommended?: boolean;
}

/** A single-choice question from the agent. */
export interface AgentRunQuestion {
  id: string;
  title: string;
  body?: string;
  choices: AgentRunChoice[];
  canAnswer?: boolean | string;
  /** Id of the choice the host sent: the card becomes one resolved row. */
  answered?: string;
  error?: string;
}

/** A details value: text, or a duration — live (`addMs + now − since`, ticking in place) when `since` is set, else `addMs`. */
export type AgentRunDetailValue = string | number | { since?: number; addMs?: number };

export interface AgentRunData {
  title: string;
  subtitle?: string;
  status: AgentRunStatus;
  /** Epoch ms this run (or turn) started: `Started 6:56 PM · 9m 22s`, live while running / waiting. */
  startedAt?: number;
  /** Epoch ms it ended: a finished run shows its run time instead of a clock. */
  endedAt?: number;
  /** Accumulated active time, shown as `Active …` when there is no start time. */
  activeMs?: number;
  plan?: { steps: AgentRunStep[] };
  approvals?: AgentRunApproval[];
  questions?: AgentRunQuestion[];
  details?: Array<[label: string, value: AgentRunDetailValue]>;
  /** `true` shows Stop while the run is live; a string shows it disabled with that reason. */
  canStop?: boolean | string;
  /** A stop request is in flight (Stop disabled, aria-busy). */
  stopping?: boolean;
}

export interface AgentRunApproveDetail {
  id: string;
  decision: AgentRunDecision;
}
export interface AgentRunAnswerDetail {
  questionId: string;
  choiceId: string;
}

const STRINGS = {
  en: {
    chip: 'Run',
    status: {
      running: 'Running',
      waiting: 'Needs input',
      idle: 'Idle',
      done: 'Done',
      failed: 'Failed',
      stopped: 'Stopped',
    } as Record<AgentRunStatus, string>,
    statusSay: (w: string) => `Status: ${w}`,
    started: (t: string) => `Started ${t}`,
    liveTitle: 'This run: started · elapsed',
    ranTitle: 'Started · run time',
    active: 'Active',
    activeTitle: 'Active time',
    stop: 'Stop',
    stopLabel: 'Stop — stop the run',
    plan: 'Plan',
    planSteps: 'Plan steps',
    noSteps: 'No steps yet',
    stepDone: (l: string) => `Step done: ${l}`,
    stepFailed: (l: string) => `Step failed: ${l}`,
    needs: 'Needs input',
    apTitle: (tool: string) => `${tool} approval`,
    requested: (t: string) => `requested ${t}`,
    risk: 'Risk',
    riskWord: ' rules',
    toolPill: 'Tool approval',
    questionPill: 'Question',
    rules: (n: number) => (n > 1 ? 'Matched dangerous-command rules' : 'Matched dangerous-command rule'),
    truncated: 'Showing the beginning only',
    btn: { explain: 'Explain', approve_disable_rule: 'Approve & disable rule', deny: 'Deny', approve: 'Approve' },
    expiresIn: (c: string) => `Expires in ${c}`,
    expired: 'Expired',
    expiresAt: (t: string) => `Expires at ${t}`,
    answered: {
      approve: 'Approved',
      deny: 'Denied',
      explain: 'Explanation requested',
      approve_disable_rule: 'Approved · rule disabled',
    } as Record<AgentRunDecision, string>,
    sent: {
      approve: 'Approval sent',
      deny: 'Denial sent',
      explain: 'Explanation requested',
      approve_disable_rule: 'Approval sent · rule disabled',
    } as Record<AgentRunDecision, string>,
    arrived: (tool: string) => `Approval request — ${tool}`,
    recommended: 'Recommended',
    asked: (title: string) => `Question — ${title}`,
    answeredQ: 'Answered',
    answerSent: (label: string) => `Answer sent — ${label}`,
    details: 'Details',
  },
  ko: {
    chip: '세션',
    status: {
      running: '실행 중',
      waiting: '입력 대기',
      idle: '대기',
      done: '완료',
      failed: '실패',
      stopped: '중단',
    } as Record<AgentRunStatus, string>,
    statusSay: (w: string) => `상태: ${w}`,
    started: (t: string) => `시작 ${t}`,
    liveTitle: '이번 턴 시작 · 경과',
    ranTitle: '시작 · 실행 시간',
    active: '활성',
    activeTitle: '활성 시간',
    stop: 'Stop',
    stopLabel: 'Stop — 세션 중지',
    plan: '계획',
    planSteps: '계획 단계',
    noSteps: '아직 작업 목록이 없습니다',
    stepDone: (l: string) => `단계 완료: ${l}`,
    stepFailed: (l: string) => `단계 실패: ${l}`,
    needs: '입력 필요',
    apTitle: (tool: string) => `${tool} 실행 승인`,
    requested: (t: string) => `${t} 요청`,
    risk: '위험',
    riskWord: ' 규칙',
    toolPill: '도구 승인',
    questionPill: '질문',
    rules: (n: number) => (n > 1 ? 'Matched dangerous-command rules' : 'Matched dangerous-command rule'),
    truncated: '앞부분만 표시합니다',
    btn: { explain: 'Explain', approve_disable_rule: 'Approve & disable rule', deny: 'Deny', approve: 'Approve' },
    expiresIn: (c: string) => `만료까지 ${c}`,
    expired: '만료됨',
    expiresAt: (t: string) => `${t}에 만료`,
    answered: {
      approve: '승인함',
      deny: '거부함',
      explain: '설명 요청함',
      approve_disable_rule: '승인함 · 규칙 끔',
    } as Record<AgentRunDecision, string>,
    sent: {
      approve: '승인을 보냈습니다',
      deny: '거부를 보냈습니다',
      explain: '설명을 요청했습니다',
      approve_disable_rule: '승인을 보냈습니다 · 규칙 끔',
    } as Record<AgentRunDecision, string>,
    arrived: (tool: string) => `승인 요청 — ${tool}`,
    recommended: '추천',
    asked: (title: string) => `질문 — ${title}`,
    answeredQ: '답함',
    answerSent: (label: string) => `답을 보냈습니다 — ${label}`,
    details: '세부',
  },
};
type Strings = (typeof STRINGS)['en'];
type Lang = keyof typeof STRINGS;

const ICON = {
  check: PLAN_ICON.check,
  cross: PLAN_ICON.cross,
  stop: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="4.5" y="4.5" width="7" height="7" rx="1.2"/></svg>',
  clock:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.2l2 1.3"/></svg>',
  dot: PLAN_ICON.dot,
  /** The run's own spinner (`.ar-spin`), also drawn in the plan's running marker and foot. */
  spin: '<span class="ar-spin" aria-hidden="true"></span>',
  lock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>',
  ask: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M6.3 6.3a1.8 1.8 0 0 1 3.4.7c0 1.2-1.7 1.5-1.7 2.6M8 11.3v.1"/></svg>',
};

const STATUS_ICON: Record<AgentRunStatus, string> = {
  running: ICON.spin,
  waiting: ICON.clock,
  idle: ICON.dot,
  done: ICON.check,
  failed: ICON.cross,
  stopped: ICON.stop,
};

const LIVE: ReadonlySet<AgentRunStatus> = new Set(['running', 'waiting']);
const STEP_STATUSES: ReadonlySet<string> = new Set<AgentRunStepStatus>([
  'pending',
  'running',
  'done',
  'failed',
  'skipped',
]);

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// ── Pure helpers ────────────────────────────────────────────────────────────

export interface AgentRunPlanPhase {
  /** From the steps alone: any running → running; else any failed → failed; all done/skipped → done; else idle. */
  phase: 'running' | 'done' | 'failed' | 'idle';
  done: number;
  total: number;
  /** Earliest start (the running clock counts from here), 0 when unknown. */
  since: number;
  /** Last end − first start once the plan is finished, 0 when the steps do not carry both. */
  tookMs: number;
}

/** A run step with a status this element knows (anything else is drawn and counted as pending). */
const runStep = (s: AgentRunStep): AgentRunStep => (STEP_STATUSES.has(s.status) ? s : { ...s, status: 'pending' });

/** The plan footer: phase, done/total and the time — since the first start while running, the total once finished. */
export function runPlanPhase(steps: AgentRunStep[]): AgentRunPlanPhase {
  // Run steps are never paused or dropped, so the shared phase is one of this element's four.
  return planPhase(steps.map(runStep)) as AgentRunPlanPhase;
}

/** Indexes of the done steps folded away: every done step but the last `limit` (earliest first). */
export function runFoldedSteps(steps: AgentRunStep[], limit?: number): number[] {
  return planFoldedSteps(steps, limit);
}

/**
 * A tool input as approval-card rows. A JSON object becomes label → value rows (its string `description` becomes
 * the summary); anything else — cut, not JSON, not an object — returns null so the host shows it as `raw`.
 */
export function runApprovalFields(
  input: string,
  truncated = false,
): { summary: string; fields: Array<[string, string]> } | null {
  if (truncated) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(input);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const rec = obj as Record<string, unknown>;
  const summary = typeof rec.description === 'string' ? rec.description : '';
  const fields = Object.keys(rec)
    .filter((k) => !(k === 'description' && summary))
    .map((k): [string, string] => [k, runFieldText(rec[k])]);
  return { summary, fields };
}

/** A field value as text: strings as they are, anything else as pretty JSON. */
export function runFieldText(v: unknown): string {
  if (typeof v === 'string') return v;
  const s = JSON.stringify(v, null, 2);
  return s === undefined ? String(v) : s;
}

/** The recommended choice first, the rest in their order. */
export function runChoiceOrder(choices: AgentRunChoice[]): AgentRunChoice[] {
  const rec = choices.find((c) => c.recommended);
  return rec ? [rec, ...choices.filter((c) => c !== rec)] : choices.slice();
}

/**
 * A question card's identity: its whole meaning serialized (id, text and every choice's id, label, description,
 * recommendation). A question rewritten in place is another card, so a focused choice is never rebound to it.
 */
export function runQuestionKey(q: AgentRunQuestion): string {
  return `q|${JSON.stringify([
    q.id,
    q.title,
    q.body ?? '',
    (q.choices ?? []).map((c) => [c.id, c.label, c.description ?? '', !!c.recommended]),
  ])}`;
}

/** Things still waiting on the person: unanswered approvals + unanswered questions. */
export function runNeedsCount(d: Pick<AgentRunData, 'approvals' | 'questions'>): number {
  return (d.approvals ?? []).filter((a) => !a.answered).length + (d.questions ?? []).filter((q) => !q.answered).length;
}

/** Time of day: `6:56 PM` (en) / `오후 06:56` (ko). */
export function runTimeOfDay(ts: number, lang: Lang = 'en'): string {
  return planTimeOfDay(ts, lang);
}

const answerable = (v: boolean | string | undefined) => v === undefined || v === true;
const lockReason = (v: boolean | string | undefined) => (typeof v === 'string' ? v : '');
const approvalKey = (id: string) => `ap|${id}`;

/**
 * A DOM-safe, injective form of an identity string: [A-Za-z0-9] stay, every other UTF-16 unit becomes
 * `_<base36 code>-`. Focus is restored by `data-key`, so a key must be exact (no hashing — two identities never
 * share one) and plain enough for any selector engine.
 */
export function runDomKey(identity: string): string {
  return identity.replace(/[^A-Za-z0-9]/g, (ch) => `_${ch.charCodeAt(0).toString(36)}-`);
}
/** The data-key of a card or answer: its identity parts, serialized (so `a|b` + `c` never equals `a` + `b|c`). */
const domKey = (...parts: string[]) => runDomKey(JSON.stringify(parts));

const KBD_APPROVE =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(String(navigator.platform || navigator.userAgent))
    ? '⌘↵'
    : 'Ctrl ↵';

interface ApSeen {
  answered: string;
  error: string;
}

/**
 * `<ui-agent-run>` — one autonomous run as a screen: the head (status, started time with a live elapsed clock,
 * Stop), the plan (a marker per step on one rail, the current step bold, per-step time and tool calls, a phase
 * footer), "Needs input" (approval cards and question cards answered in place) and the details list.
 */
export class UiAgentRun extends UiElement<AgentRunData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  readonly #live: HTMLElement;
  #timer: ReturnType<typeof setInterval> | 0 = 0;
  #expanded = false;
  /** Answers this element emitted and the host has not settled yet (key → decision / choice id). */
  #sent = new Map<string, string>();
  #stopSent = false;
  // What the last data said, to announce and animate only what changed.
  #seen: AgentRunData | undefined;
  #prevStatus: AgentRunStatus | '' = '';
  #prevSteps: Map<string, AgentRunStepStatus> | null = null;
  #prevAps: Map<string, ApSeen> | null = null;
  #prevQs: Map<string, ApSeen> | null = null;
  #prevCount = 0;
  #pop = new Set<string>();
  #enter = new Set<string>();
  #badgePop = false;

  constructor() {
    super();
    this.#live = document.createElement('div');
    this.#live.className = 'sr-only';
    this.#live.setAttribute('role', 'status');
    this.#live.setAttribute('aria-live', 'polite');
    this.root.append(this.#live);
    this.root.addEventListener('click', (e) => this.#onClick(e));
    this.root.addEventListener('keydown', (e) => this.#onKeydown(e as KeyboardEvent));
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override disconnectedCallback(): void {
    this.#stopTimer();
  }

  get #lang(): Lang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  get #t(): Strings {
    return STRINGS[this.#lang];
  }

  // ── Intent ────────────────────────────────────────────────────────────────

  #onClick(e: Event): void {
    const btn = (e.target as Element | null)?.closest?.('button') as HTMLButtonElement | null;
    if (!btn || btn.disabled) return;
    const card = btn.closest<HTMLElement>('.ap-card');
    if (btn.dataset.decision && card?.dataset.id !== undefined) {
      this.#approve(card.dataset.id, btn.dataset.decision as AgentRunDecision);
    } else if (btn.dataset.choice !== undefined && card?.dataset.id !== undefined) {
      this.#answer(card.dataset.id, btn.dataset.choice);
    } else if (btn.classList.contains('ar-stop')) {
      this.#stop();
    } else if (btn.classList.contains('pl-fold-btn')) {
      this.#expanded = !this.#expanded;
      this.requestRender();
    }
  }

  /** ⌘/Ctrl+Enter anywhere in a card answers with its primary; Esc denies only from one of the card's buttons. */
  #onKeydown(e: KeyboardEvent): void {
    if (e.defaultPrevented) return;
    const target = e.target as Element | null;
    const card = target?.closest?.('.ap-card') as HTMLElement | null;
    if (!card || !target) return;
    let btn: HTMLButtonElement | null = null;
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      btn = card.querySelector<HTMLButtonElement>(card.dataset.kind === 'question' ? '.ap-rec' : '.ap-approve');
    } else if (e.key === 'Escape' && card.dataset.kind === 'perm') {
      const from = target.closest('button');
      if (from && card.contains(from)) btn = card.querySelector<HTMLButtonElement>('.ap-deny');
    }
    if (!btn || btn.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    btn.click();
  }

  #approve(id: string, decision: AgentRunDecision): void {
    const a = this.data?.approvals?.find((x) => x.id === id);
    const key = approvalKey(id);
    if (!a || a.answered || !answerable(a.canAnswer) || this.#sent.has(key)) return;
    if (decision === 'approve_disable_rule' && !a.canDisableRule) return;
    if (this.emit<AgentRunApproveDetail>('ui-approve', { id, decision })) {
      this.#sent.set(key, decision);
      this.requestRender();
    }
  }

  #answer(questionId: string, choiceId: string): void {
    const q = this.data?.questions?.find((x) => x.id === questionId);
    const key = `q|${questionId}`;
    if (!q || q.answered || !answerable(q.canAnswer) || this.#sent.has(key)) return;
    if (!q.choices?.some((c) => c.id === choiceId)) return;
    if (this.emit<AgentRunAnswerDetail>('ui-answer', { questionId, choiceId })) {
      this.#sent.set(key, choiceId);
      this.requestRender();
    }
  }

  #stop(): void {
    const d = this.data;
    if (!d || d.canStop !== true || d.stopping || this.#stopSent || !LIVE.has(d.status)) return;
    if (this.emit('ui-stop', {})) {
      this.#stopSent = true;
      this.requestRender();
    }
  }

  /**
   * Keyboard landing (the dashboard's panel opening): focus the first unanswered card — the card, not a button, so
   * Esc still reaches the page and ⌘/Ctrl+Enter is a deliberate second step. Returns false when nothing waits.
   */
  focusNeeds(): boolean {
    if (this.data) this.renderNow();
    const card = this.$<HTMLElement>('.ap-card:not(.is-resolved)');
    card?.focus();
    return !!card;
  }

  // ── Render cycle ──────────────────────────────────────────────────────────

  protected override update(): void {
    const d = this.data;
    if (d && d !== this.#seen) this.#observe(d);
    const active = this.root.activeElement as HTMLElement | null;
    const cardKey = (active?.closest?.('.ap-card') as HTMLElement | null)?.dataset.key ?? '';
    const fromNeeds = !!active?.closest?.('.ar-needs');
    super.update();
    this.#pop.clear();
    this.#enter.clear();
    this.#badgePop = false;
    if (active && !this.root.activeElement) this.#safeFocus(cardKey, fromNeeds);
  }

  /**
   * Focus whose node left the page lands where it answers nothing: its own card (now a resolved row), else the
   * "Needs input" head, else the title — never a decision button (a following ⌘↵ must not answer another request).
   */
  #safeFocus(cardKey: string, fromNeeds: boolean): void {
    const card = cardKey ? this.$$('.ap-card').find((c) => c.dataset.key === cardKey) : undefined;
    const to = card ?? (fromNeeds ? this.$<HTMLElement>('.ar-needs-head') : null) ?? this.$<HTMLElement>('.ar-title');
    to?.focus({ preventScroll: true });
  }

  /** Compare new data with the last: settle sent answers, collect what to announce and what to animate. */
  #observe(d: AgentRunData): void {
    const t = this.#t;
    const first = this.#seen === undefined;
    const said: string[] = [];
    if (!first && this.#prevStatus !== d.status) said.push(t.statusSay(t.status[d.status] ?? d.status));
    this.#prevStatus = d.status;
    this.#stopSent = false;

    const steps = d.plan?.steps ?? [];
    const prevSteps = this.#prevSteps;
    const nowSteps = new Map<string, AgentRunStepStatus>();
    for (const s of steps) {
      nowSteps.set(s.id, s.status);
      const was = prevSteps?.get(s.id);
      if (!was || was === s.status) continue;
      this.#pop.add(s.id);
      if (s.status === 'done') said.push(t.stepDone(s.label));
      else if (s.status === 'failed') said.push(t.stepFailed(s.label));
    }
    // An empty list is a baseline as well: the next list's steps are new, not changed.
    this.#prevSteps = nowSteps;

    const aps = d.approvals ?? [];
    const nowAps = new Map<string, ApSeen>();
    for (const a of aps) {
      const was = this.#prevAps?.get(a.id);
      const seen = { answered: a.answered ?? '', error: a.error ?? '' };
      nowAps.set(a.id, seen);
      if (this.#prevAps && !was && !a.answered) said.push(t.arrived(a.tool));
      if (was && a.answered && was.answered !== a.answered) {
        said.push(`${t.sent[a.answered] ?? a.answered} — ${a.tool}`);
        this.#enter.add(approvalKey(a.id));
      }
      if (a.error && (!was || was.error !== a.error) && !first) said.push(a.error);
      if (a.answered || a.error) this.#sent.delete(approvalKey(a.id));
    }
    this.#prevAps = nowAps;

    const qs = d.questions ?? [];
    const nowQs = new Map<string, ApSeen>();
    for (const q of qs) {
      const was = this.#prevQs?.get(q.id);
      nowQs.set(q.id, { answered: q.answered ?? '', error: q.error ?? '' });
      if (this.#prevQs && !was && !q.answered) said.push(t.asked(q.title));
      if (was && q.answered && was.answered !== q.answered) {
        const c = q.choices?.find((x) => x.id === q.answered);
        said.push(t.answerSent(c?.label ?? q.answered));
        this.#enter.add(`q|${q.id}`);
      }
      if (q.error && (!was || was.error !== q.error) && !first) said.push(q.error);
      if (q.answered || q.error) this.#sent.delete(`q|${q.id}`);
    }
    this.#prevQs = nowQs;

    for (const key of Array.from(this.#sent.keys())) {
      const id = key.slice(key.indexOf('|') + 1);
      const gone = key.startsWith('ap|') ? !nowAps.has(id) : !nowQs.has(id);
      if (gone) this.#sent.delete(key);
    }

    const count = runNeedsCount(d);
    this.#badgePop = count > this.#prevCount;
    this.#prevCount = count;
    this.#seen = d;
    if (said.length) this.#live.textContent = said.join('. ');
  }

  protected override updated(): void {
    this.#tick();
    const live = !!this.$('[data-since], [data-until]');
    if (live && !this.#timer && this.isConnected) this.#timer = setInterval(() => this.#tick(), 1000);
    else if (!live) this.#stopTimer();
  }

  #stopTimer(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = 0;
  }

  /** 1 Hz: every clock is a text node filled from its data-* attributes — the markup never carries `now`. */
  #tick(): void {
    const now = Date.now();
    const t = this.#t;
    for (const el of this.$$('[data-since]')) {
      const since = Number(el.dataset.since) || now;
      const txt = fmtDuration(now - since + (Number(el.dataset.add) || 0));
      if (el.textContent !== txt) el.textContent = txt;
    }
    for (const el of this.$$('[data-until]')) {
      const left = (Number(el.dataset.until) || 0) - now;
      const txt = left > 0 ? t.expiresIn(fmtClock(left)) : t.expired;
      if (el.textContent !== txt) el.textContent = txt;
      el.classList.toggle('is-low', left <= 60_000);
    }
  }

  protected render(): string {
    const d = this.data;
    if (!d) return '';
    const t = this.#t;
    const plan = d.plan ? this.#plan(d.plan.steps ?? [], t) : '';
    const needs = this.#needs(d, t);
    const details = this.#details(d, t);
    // Wide: the plan (+ details) on the left, the side column on the right — Needs input when there is any.
    const bands = [plan, needs, details].filter(Boolean).length;
    const side = bands > 1 ? (needs ? 'needs' : 'details') : '';
    return `<section class="ar" aria-labelledby="ar-title" data-status="${escAttr(d.status)}">
${this.#head(d, t)}${bands ? `<div class="ar-body"${side ? ` data-side="${side}"` : ''}>${plan}${needs}${details}</div>` : ''}
</section>`;
  }

  #head(d: AgentRunData, t: Strings): string {
    const st: AgentRunStatus = STATUS_ICON[d.status] ? d.status : 'idle';
    const live = LIVE.has(st);
    const start = num(d.startedAt);
    const end = num(d.endedAt);
    let time = '';
    if (live && start) {
      time = `<span class="ps-time" title="${escAttr(t.liveTitle)}"><span class="ps-clock">${ICON.clock}</span>${esc(
        t.started(runTimeOfDay(start, this.#lang)),
      )}<span class="ps-dot" aria-hidden="true">·</span><span class="ps-tick" data-since="${start}"></span></span>`;
    } else if (start && end > start) {
      time = `<span class="ps-time" title="${escAttr(t.ranTitle)}"><span class="ps-clock">${ICON.clock}</span>${esc(
        t.started(runTimeOfDay(start, this.#lang)),
      )}<span class="ps-dot" aria-hidden="true">·</span>${esc(fmtDuration(end - start))}</span>`;
    } else if (num(d.activeMs)) {
      time = `<span class="ps-time" title="${escAttr(t.activeTitle)}">${esc(t.active)} ${esc(fmtDuration(num(d.activeMs)))}</span>`;
    }
    let stop = '';
    if (live && d.canStop !== undefined && d.canStop !== false) {
      const why = lockReason(d.canStop);
      const busy = !!d.stopping || this.#stopSent;
      stop = `<span class="ps-actions"><button type="button" class="ar-stop" data-key="ar-stop" aria-label="${escAttr(
        t.stopLabel,
      )}"${why || busy ? ' disabled' : ''}${busy ? ' aria-busy="true"' : ''}${why ? ` title="${escAttr(why)}"` : ''}>${
        busy ? ICON.spin : ''
      }${esc(t.stop)}</button></span>`;
    }
    return `<header class="ar-head">
<h2 class="ar-title" id="ar-title" tabindex="-1" data-key="ar-title">${esc(d.title)}</h2>${
      d.subtitle ? `<p class="ar-sub">${esc(d.subtitle)}</p>` : ''
    }
<div class="ps-row"><span class="ps-chip is-${st}"><span class="ps-label">${esc(t.chip)}</span><span class="ps-icon" aria-hidden="true">${
      STATUS_ICON[st]
    }</span><span class="ps-word">${esc(t.status[st])}</span></span>${time}${stop}</div>
</header>`;
  }

  // ── Plan ──────────────────────────────────────────────────────────────────

  #plan(steps: AgentRunStep[], t: Strings): string {
    const head = `<h3 class="ar-sec-h" id="ar-plan-h">${esc(t.plan)}</h3>`;
    if (!steps.length)
      return `<section class="ar-band ar-plan" aria-labelledby="ar-plan-h">${head}<p class="pl-empty">${esc(t.noSteps)}</p></section>`;
    const known = steps.map(runStep);
    const o = { lang: this.#lang, pop: this.#pop, spin: ICON.spin };
    return `<section class="ar-band ar-plan" aria-labelledby="ar-plan-h">${head}${planListHtml(known, {
      ...o,
      label: t.planSteps,
      fold: { expanded: this.#expanded },
    })}${planFootHtml(known, o)}</section>`;
  }

  // ── Needs input ───────────────────────────────────────────────────────────

  #needs(d: AgentRunData, t: Strings): string {
    const aps = d.approvals ?? [];
    const qs = (d.questions ?? []).filter((q) => q && Array.isArray(q.choices));
    if (!aps.length && !qs.length) return '';
    const n = runNeedsCount({ approvals: aps, questions: qs });
    const cards =
      aps.map((a, i) => this.#approval(a, i, t)).join('') + qs.map((q, i) => this.#question(q, i, t)).join('');
    return `<section class="ar-band ar-needs" aria-labelledby="ar-needs-h"><h3 class="ar-needs-head" id="ar-needs-h" tabindex="-1" data-key="ar-needs-head">${esc(
      t.needs,
    )}${n ? `<span class="pn-count${this.#badgePop ? ' is-pop' : ''}">${n}</span>` : ''}</h3><div class="ap-list">${cards}</div></section>`;
  }

  #resolved(r: {
    key: string;
    enterKey: string;
    kind: 'perm' | 'question';
    id: string;
    titleId: string;
    title: string;
    status: string;
    mark: string;
    decision: string;
  }): string {
    return `<div class="ap-card is-resolved" role="group" tabindex="-1" data-kind="${r.kind}" data-id="${escAttr(
      r.id,
    )}" data-key="${r.key}" aria-labelledby="${r.titleId}"><div class="ap-resolved${
      this.#enter.has(r.enterKey) ? ' is-enter' : ''
    }" data-decision="${escAttr(r.decision)}"><span class="ap-mark" aria-hidden="true">${r.mark}</span><span class="ap-row-title" id="${
      r.titleId
    }">${esc(r.title)}</span><span class="ap-row-status">${esc(r.status)}</span></div></div>`;
  }

  #approval(a: AgentRunApproval, i: number, t: Strings): string {
    const key = approvalKey(a.id);
    const dk = domKey('ap', a.id);
    const tool = a.tool || 'tool';
    const title = a.title || t.apTitle(tool);
    const ids = { t: `ar-ap${i}-t`, d: `ar-ap${i}-d`, x: `ar-ap${i}-x` };
    if (a.answered) {
      const mark = a.answered === 'deny' ? ICON.cross : a.answered === 'explain' ? '?' : ICON.check;
      return this.#resolved({
        key: dk,
        enterKey: key,
        kind: 'perm',
        id: a.id,
        titleId: ids.t,
        title,
        status: t.answered[a.answered] ?? a.answered,
        mark,
        decision: a.answered,
      });
    }
    const why = lockReason(a.canAnswer);
    const sending = this.#sent.get(key) ?? '';
    const off = !answerable(a.canAnswer) || !!sending;
    const rules = a.rules ?? [];
    const pill = rules.length
      ? `<span class="ap-pill" data-kind="rule">${esc(t.risk)}<span class="ap-pill-word">${esc(t.riskWord)}</span> ${rules.length}</span>`
      : `<span class="ap-pill" data-kind="tool">${esc(t.toolPill)}</span>`;
    let body = '';
    if (a.fields?.length) {
      body = `<dl class="ap-details">${a.fields
        .map(([k, v]) => `<div class="ap-detail"><dt>${esc(k)}</dt><dd>${esc(runFieldText(v))}</dd></div>`)
        .join('')}</dl>`;
    } else if (a.raw !== undefined && a.raw !== '') {
      body = `<pre class="ap-raw">${esc(a.raw)}</pre>${a.truncated ? `<p class="ap-truncated">${esc(t.truncated)}</p>` : ''}`;
    }
    const rulesHtml = rules.length
      ? `<div class="ap-rules"><span class="ap-rules-label">${esc(t.rules(rules.length))}</span>${rules
          .map(
            (r) =>
              `<span class="ap-rule"><code>${esc(r.id)}</code> — ${esc(r.label)}${r.description ? `: ${esc(r.description)}` : ''}</span>`,
          )
          .join('')}</div>`
      : '';
    const btn = (decision: AgentRunDecision, cls: string, extra = '', kbd = '') => {
      const busy = sending === decision;
      return `<button type="button" class="ap-btn ${cls}${busy ? ' is-busy' : ''}" data-decision="${decision}" data-key="${domKey('ap', a.id, decision)}"${off ? ' disabled' : ''}${busy ? ' aria-busy="true"' : ''}${why ? ` title="${escAttr(why)}"` : ''}${extra}>${
        busy ? ICON.spin : ''
      }${esc(t.btn[decision])}${kbd ? `<span class="ap-kbd" aria-hidden="true">${esc(kbd)}</span>` : ''}</button>`;
    };
    const alts = btn('explain', 'ap-ghost') + (a.canDisableRule ? btn('approve_disable_rule', 'ap-ghost') : '');
    const main =
      btn('deny', 'ap-quiet ap-deny', ' aria-keyshortcuts="Escape"', 'Esc') +
      btn('approve', 'ap-primary ap-approve', ' aria-keyshortcuts="Meta+Enter Control+Enter"', KBD_APPROVE);
    const until = num(a.expiresAt);
    const expires = until
      ? `<span class="ap-expires" data-until="${until}" aria-hidden="true"></span><span class="sr-only" id="${ids.x}">${esc(
          t.expiresAt(runTimeOfDay(until, this.#lang)),
        )}</span>`
      : '';
    const described = [a.summary ? ids.d : '', until ? ids.x : ''].filter(Boolean).join(' ');
    const label = `${esc(tool)}${num(a.requestedAt) ? ` · ${esc(t.requested(runTimeOfDay(num(a.requestedAt), this.#lang)))}` : ''}`;
    return `<div class="ap-card" role="group" tabindex="-1" data-kind="perm" data-id="${escAttr(a.id)}" data-key="${dk}" aria-labelledby="${ids.t}"${described ? ` aria-describedby="${described}"` : ''}><div class="ap-label">${label}</div><div class="ap-body"><div class="ap-head"><span class="ap-icon" aria-hidden="true">${
      ICON.lock
    }</span><div class="ap-titles"><div class="ap-title" id="${ids.t}">${esc(title)}</div>${
      a.summary ? `<div class="ap-desc" id="${ids.d}" title="${escAttr(a.summary)}">${esc(a.summary)}</div>` : ''
    }</div>${pill}</div>${body}${rulesHtml}<div class="ap-alts">${alts}</div><div class="ap-foot">${expires}<div class="ap-actions">${main}</div></div>${
      why ? `<p class="ap-lock">${esc(why)}</p>` : ''
    }${a.error ? `<p class="ap-note">${esc(a.error)}</p>` : ''}</div></div>`;
  }

  #question(q: AgentRunQuestion, i: number, t: Strings): string {
    const meaning = runQuestionKey(q);
    const dk = domKey('q', meaning);
    const titleId = `ar-q${i}-t`;
    if (q.answered) {
      const c = q.choices.find((x) => x.id === q.answered);
      return this.#resolved({
        key: dk,
        enterKey: `q|${q.id}`,
        kind: 'question',
        id: q.id,
        titleId,
        title: q.title,
        status: `${t.answeredQ} · ${c?.label ?? q.answered}`,
        mark: ICON.check,
        decision: 'answer',
      });
    }
    const why = lockReason(q.canAnswer);
    const sending = this.#sent.get(`q|${q.id}`) ?? '';
    const off = !answerable(q.canAnswer) || !!sending;
    const ordered = runChoiceOrder(q.choices);
    const recId = ordered[0]?.recommended ? ordered[0].id : '';
    const choices = ordered
      .map((c) => {
        const rec = c.id === recId;
        const busy = sending === c.id;
        return `<button type="button" class="ap-choice${rec ? ' ap-rec' : ''}${busy ? ' is-busy' : ''}" data-choice="${escAttr(
          c.id,
        )}" data-key="${domKey('q', meaning, c.id)}"${off ? ' disabled' : ''}${busy ? ' aria-busy="true"' : ''}${
          why ? ` title="${escAttr(why)}"` : ''
        }${rec ? ' aria-keyshortcuts="Meta+Enter Control+Enter"' : ''}><span class="ap-choice-label">${busy ? ICON.spin : ''}${esc(
          c.label,
        )}${rec ? `<span class="ap-choice-tag">${esc(t.recommended)}</span>` : ''}</span>${
          c.description ? `<span class="ap-choice-desc">${esc(c.description)}</span>` : ''
        }${rec ? `<span class="ap-kbd" aria-hidden="true">${esc(KBD_APPROVE)}</span>` : ''}</button>`;
      })
      .join('');
    return `<div class="ap-card ap-question" role="group" tabindex="-1" data-kind="question" data-id="${escAttr(q.id)}" data-key="${dk}" aria-labelledby="${titleId}"><div class="ap-body"><div class="ap-head"><span class="ap-icon" aria-hidden="true">${
      ICON.ask
    }</span><div class="ap-titles"><div class="ap-title" id="${titleId}">${esc(q.title)}</div>${
      q.body ? `<div class="ap-qbody">${esc(q.body)}</div>` : ''
    }</div><span class="ap-pill" data-kind="question">${esc(t.questionPill)}</span></div><div class="ap-choices">${choices}</div>${
      why ? `<p class="ap-lock">${esc(why)}</p>` : ''
    }${q.error ? `<p class="ap-note">${esc(q.error)}</p>` : ''}</div></div>`;
  }

  // ── Details ───────────────────────────────────────────────────────────────

  #details(d: AgentRunData, t: Strings): string {
    const rows = (d.details ?? [])
      .filter((r) => Array.isArray(r) && r[1] !== undefined && r[1] !== null && r[1] !== '')
      .map(([label, v]) => {
        const value =
          typeof v !== 'object'
            ? esc(String(v))
            : num(v.since)
              ? `<span data-since="${num(v.since)}" data-add="${num(v.addMs)}"></span>`
              : esc(fmtDuration(num(v.addMs)));
        return `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
      })
      .join('');
    if (!rows) return '';
    return `<section class="ar-band ar-details" aria-labelledby="ar-det-h"><h3 class="ar-sec-h" id="ar-det-h">${esc(
      t.details,
    )}</h3><dl class="pi-details">${rows}</dl></section>`;
  }
}

define('ui-agent-run', UiAgentRun);

declare global {
  interface HTMLElementTagNameMap {
    'ui-agent-run': UiAgentRun;
  }
}
