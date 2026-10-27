import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AgentRunApproval,
  type AgentRunData,
  type AgentRunQuestion,
  type AgentRunStep,
  runApprovalFields,
  runChoiceOrder,
  runDomKey,
  runFoldedSteps,
  runNeedsCount,
  runPlanPhase,
  runQuestionKey,
  type UiAgentRun,
} from './agent-run';

const XSS = '<img src=x onerror=alert(1)>';
const dkey = (...parts: string[]) => runDomKey(JSON.stringify(parts));
const NOW = Date.UTC(2026, 9, 27, 9, 0, 0);

function mount(data: AgentRunData, attrs: Record<string, string> = {}): UiAgentRun {
  const el = document.createElement('ui-agent-run') as UiAgentRun;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiAgentRun, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = (el: UiAgentRun, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const active = (el: UiAgentRun) => el.shadowRoot!.activeElement as HTMLElement | null;
const live = (el: UiAgentRun) => el.shadowRoot!.querySelector('[aria-live]')!.textContent ?? '';
const key = (target: Element, init: KeyboardEventInit) => {
  const ev = new KeyboardEvent('keydown', { bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(ev);
  return ev;
};

const STEPS: AgentRunStep[] = [
  { id: 's1', label: 'Pull revenue', status: 'done', startedAt: NOW - 300_000, endedAt: NOW - 262_000, toolCalls: 4 },
  { id: 's2', label: 'Read memo', status: 'done', startedAt: NOW - 262_000, endedAt: NOW - 239_000, toolCalls: 2 },
  {
    id: 's3',
    label: 'Send the draft',
    detail: 'Writing the cover email',
    status: 'running',
    startedAt: NOW - 68_000,
    toolCalls: 1,
  },
  { id: 's4', label: 'Book a review', status: 'pending', toolCalls: 0 },
];

const AP: AgentRunApproval = {
  id: 'ap_1',
  tool: 'Bash',
  summary: 'Run the users split on production',
  fields: [
    ['command', 'psql "$PROD_URL" -f 0042.sql'],
    ['timeout', 600000],
  ],
  rules: [{ id: 'prod-db-write', label: 'production write', description: 'Writes to production' }],
  canDisableRule: true,
  requestedAt: NOW - 20_000,
  expiresAt: NOW + 221_000,
};

const QUESTION: AgentRunQuestion = {
  id: 'q1',
  title: 'Run the migration on production now?',
  choices: [
    { id: 'run', label: 'Run on production', description: 'Applies 0042' },
    { id: 'wait', label: 'Wait for the backup', description: 'Retry after 02:00', recommended: true },
  ],
};

const BASE: AgentRunData = {
  title: 'Migrate users table',
  subtitle: 'Split users into accounts/profiles',
  status: 'waiting',
  startedAt: NOW - 300_000,
  canStop: true,
  plan: { steps: STEPS },
  approvals: [AP],
  questions: [QUESTION],
  details: [
    ['Agent', 'opus-4-5'],
    ['Tool calls', 13],
    ['Active time', { since: NOW - 60_000, addMs: 120_000 }],
  ],
};

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('pure helpers', () => {
  it('derives the plan phase, done/total and the time from the steps alone', () => {
    expect(runPlanPhase(STEPS)).toEqual({ phase: 'running', done: 2, total: 4, since: NOW - 300_000, tookMs: 0 });
    const done = STEPS.map((s, i) => ({
      ...s,
      status: 'done' as const,
      startedAt: NOW + i * 1000,
      endedAt: NOW + i * 1000 + 500,
    }));
    expect(runPlanPhase(done)).toMatchObject({ phase: 'done', done: 4, total: 4, tookMs: 3500 });
    expect(
      runPlanPhase([
        { id: 'a', label: 'a', status: 'failed' },
        { id: 'b', label: 'b', status: 'skipped' },
      ]).phase,
    ).toBe('failed');
    expect(
      runPlanPhase([
        { id: 'a', label: 'a', status: 'done' },
        { id: 'b', label: 'b', status: 'skipped' },
      ]).phase,
    ).toBe('done');
    expect(runPlanPhase([{ id: 'a', label: 'a', status: 'pending' }]).phase).toBe('idle');
    expect(runPlanPhase([]).phase).toBe('idle');
  });

  it('folds every done step but the last three, earliest first', () => {
    const steps = Array.from({ length: 6 }, (_, i) => ({ id: `d${i}`, label: `d${i}`, status: 'done' as const }));
    expect(runFoldedSteps(steps)).toEqual([0, 1, 2]);
    expect(runFoldedSteps(steps.slice(0, 3))).toEqual([]);
    expect(runFoldedSteps([...steps.slice(0, 4), { id: 'p', label: 'p', status: 'pending' }])).toEqual([0]);
  });

  it('turns a JSON object input into rows (description becomes the summary); anything else stays raw', () => {
    expect(runApprovalFields('{"command":"ls -la","timeout":5,"description":"List files"}')).toEqual({
      summary: 'List files',
      fields: [
        ['command', 'ls -la'],
        ['timeout', '5'],
      ],
    });
    expect(runApprovalFields('{"opts":{"a":1}}')?.fields[0][1]).toBe('{\n  "a": 1\n}');
    expect(runApprovalFields('{"command":"ls"}', true)).toBeNull();
    expect(runApprovalFields('not json')).toBeNull();
    expect(runApprovalFields('[1,2]')).toBeNull();
    expect(runApprovalFields('"text"')).toBeNull();
  });

  it('puts the recommended choice first', () => {
    expect(runChoiceOrder(QUESTION.choices).map((c) => c.id)).toEqual(['wait', 'run']);
    expect(runChoiceOrder([{ id: 'a', label: 'A' }]).map((c) => c.id)).toEqual(['a']);
  });

  it('keys a question by its whole meaning', () => {
    const a = runQuestionKey(QUESTION);
    expect(runQuestionKey({ ...QUESTION })).toBe(a);
    const relabeled = { ...QUESTION, choices: [{ ...QUESTION.choices[0], label: 'Run it' }, QUESTION.choices[1]] };
    expect(runQuestionKey(relabeled)).not.toBe(a);
    // A separator-joined key would collide here; the JSON one does not.
    const x = { id: 'q', title: 'a|b', choices: [] };
    const y = { id: 'q', title: 'a', body: 'b', choices: [] };
    expect(runQuestionKey(x)).not.toBe(runQuestionKey(y));
  });

  it('makes DOM keys that are exact, injective and selector-safe', () => {
    expect(runDomKey('ap|x')).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(runDomKey('a_b')).not.toBe(runDomKey('a-b'));
    expect(runDomKey('a|b')).not.toBe(runDomKey('a_3g-b'));
    expect(runDomKey('한')).toBe(`_${'한'.charCodeAt(0).toString(36)}-`);
    // Parts are serialized: an id containing the separator never collides with another request's answer.
    expect(dkey('ap', 'x|approve')).not.toBe(dkey('ap', 'x', 'approve'));
  });

  it('counts only what still waits on the person', () => {
    expect(runNeedsCount(BASE)).toBe(2);
    expect(runNeedsCount({ approvals: [{ ...AP, answered: 'approve' }], questions: [] })).toBe(0);
  });
});

describe('<ui-agent-run> rendering', () => {
  it('renders nothing without data', () => {
    const el = document.createElement('ui-agent-run') as UiAgentRun;
    document.body.append(el);
    el.renderNow();
    expect(q(el, '.ar')).toBeNull();
  });

  it('draws the head: title, subtitle, status pill, live start/elapsed, Stop', () => {
    const el = mount(BASE);
    expect(q(el, '.ar-title')?.textContent).toBe('Migrate users table');
    expect(q(el, '.ar-sub')?.textContent).toBe('Split users into accounts/profiles');
    expect(q(el, '.ps-chip')?.className).toContain('is-waiting');
    expect(q(el, '.ps-word')?.textContent).toBe('Needs input');
    expect(q(el, '.ps-time')?.textContent).toContain('Started ');
    expect(q(el, '.ps-tick')?.textContent).toBe('5m 00s');
    expect(q(el, '.ar-stop')?.getAttribute('aria-label')).toBe('Stop — stop the run');
  });

  it('ticks the clocks in place once a second and stops ticking when disconnected', () => {
    const el = mount(BASE);
    const tick = q(el, '.ps-tick')!;
    vi.advanceTimersByTime(3000);
    expect(q(el, '.ps-tick')).toBe(tick);
    expect(tick.textContent).toBe('5m 03s');
    expect(q(el, '.ap-expires')?.textContent).toBe('Expires in 3:38');
    el.remove();
    vi.advanceTimersByTime(5000);
    expect(tick.textContent).toBe('5m 03s');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows a finished run’s run time and no Stop; Stop with a reason is disabled', () => {
    const done = mount({ ...BASE, status: 'done', endedAt: NOW - 100_000, approvals: [], questions: [] });
    expect(q(done, '.ps-time')?.textContent).toContain('3m 20s');
    expect(q(done, '.ps-tick')).toBeNull();
    expect(q(done, '.ar-stop')).toBeNull();
    const ro = mount({ ...BASE, canStop: 'Read-only — not your run' });
    const stop = q<HTMLButtonElement>(ro, '.ar-stop')!;
    expect(stop.disabled).toBe(true);
    expect(stop.title).toBe('Read-only — not your run');
    const active = mount({ ...BASE, status: 'idle', startedAt: undefined, activeMs: 360_000 });
    expect(q(active, '.ps-time')?.textContent).toBe('Active 6m 00s');
  });

  it('draws the plan in order: a marker per state, the current step, chips, times and the foot', () => {
    const el = mount(BASE);
    const rows = qa(el, '.pl-step');
    expect(rows.map((r) => r.dataset.step)).toEqual(['done', 'done', 'running', 'pending']);
    expect(rows[2].getAttribute('aria-current')).toBe('step');
    expect(rows.filter((r) => r.hasAttribute('aria-current'))).toHaveLength(1);
    expect(rows[0].querySelector('.pl-marker svg')).not.toBeNull();
    expect(rows[2].querySelector('.pl-marker .ar-spin')).not.toBeNull();
    expect(rows[3].querySelector('.pl-marker')?.innerHTML).toBe('');
    expect(rows[0].querySelector('.pl-chip')?.textContent).toBe('4 tool calls');
    expect(rows[3].querySelector('.pl-chip')).toBeNull();
    expect(rows[0].querySelector('.pl-aside')?.textContent).toBe('38s');
    expect(rows[2].querySelector('.pl-aside')?.textContent).toBe('1m 08s');
    expect(rows[2].querySelector('.pl-sub')?.textContent).toBe('Writing the cover email');
    expect(rows.map((r) => r.querySelector('.sr-only')?.textContent)).toEqual([
      ', done',
      ', done',
      ', in progress',
      ', pending',
    ]);
    expect(q(el, '.pl-foot')?.dataset.phase).toBe('running');
    expect(q(el, '.pl-foot-st')?.textContent).toBe('Running · 2/4');
    expect(q(el, '.pl-foot-time')?.textContent).toBe('5m 00s');
  });

  it('marks failed and skipped steps; an empty plan says so', () => {
    const el = mount({
      ...BASE,
      status: 'failed',
      plan: {
        steps: [
          { id: 'a', label: 'A', status: 'failed', detail: 'connection refused', startedAt: NOW - 9000, endedAt: NOW },
          { id: 'b', label: 'B', status: 'skipped' },
        ],
      },
    });
    expect(qa(el, '.pl-step').map((r) => r.dataset.step)).toEqual(['failed', 'skipped']);
    expect(q(el, '.pl-foot-st')?.textContent).toBe('Failed · 0/2');
    expect(q(el, '.pl-foot-time')?.textContent).toBe('9s');
    const empty = mount({ ...BASE, plan: { steps: [] } });
    expect(q(empty, '.pl-empty')?.textContent).toBe('No steps yet');
    expect(q(mount({ ...BASE, plan: undefined }), '.ar-plan')).toBeNull();
  });

  it('folds the earliest done steps past three behind one toggle', () => {
    const steps: AgentRunStep[] = Array.from({ length: 5 }, (_, i) => ({
      id: `d${i}`,
      label: `Step ${i}`,
      status: 'done',
    }));
    const el = mount({ ...BASE, plan: { steps } });
    expect(qa(el, '.pl-step').map((r) => r.textContent?.split(',')[0])).toEqual(['Step 2', 'Step 3', 'Step 4']);
    const btn = q(el, '.pl-fold-btn')!;
    expect(btn.textContent).toBe('Show 2 more completed');
    btn.click();
    el.renderNow();
    expect(qa(el, '.pl-step')).toHaveLength(5);
    expect(q(el, '.pl-fold-btn')?.textContent).toBe('Hide completed');
    expect(q(el, '.pl-fold-btn')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('draws an approval card: label, title, summary, risk pill, rows, rules, four answers, expiry', () => {
    const el = mount(BASE);
    const card = q(el, '.ap-card[data-kind="perm"]')!;
    expect(card.getAttribute('role')).toBe('group');
    expect(card.dataset.key).toBe(dkey('ap', 'ap_1'));
    expect(card.querySelector('.ap-label')?.textContent).toMatch(/^Bash · requested /);
    expect(card.querySelector('.ap-title')?.textContent).toBe('Bash approval');
    expect(card.querySelector('.ap-desc')?.textContent).toBe('Run the users split on production');
    expect(card.querySelector('.ap-pill')?.textContent).toBe('Risk rules 1');
    expect(card.querySelector('.ap-pill')?.getAttribute('data-kind')).toBe('rule');
    expect(Array.from(card.querySelectorAll('.ap-detail dt')).map((n) => n.textContent)).toEqual([
      'command',
      'timeout',
    ]);
    expect(card.querySelectorAll('.ap-detail dd')[1].textContent).toBe('600000');
    expect(card.querySelector('.ap-rule')?.textContent).toBe('prod-db-write — production write: Writes to production');
    expect(
      Array.from(card.querySelectorAll<HTMLElement>('button[data-decision]')).map((b) => b.dataset.decision),
    ).toEqual(['explain', 'approve_disable_rule', 'deny', 'approve']);
    expect(card.querySelectorAll('.ap-primary')).toHaveLength(1);
    expect(card.querySelector('.ap-approve')?.getAttribute('aria-keyshortcuts')).toBe('Meta+Enter Control+Enter');
    expect(card.querySelector('.ap-deny')?.getAttribute('aria-keyshortcuts')).toBe('Escape');
    expect(card.querySelector('.ap-deny .ap-kbd')?.getAttribute('aria-hidden')).toBe('true');
    expect(card.querySelector('.ap-expires')?.textContent).toBe('Expires in 3:41');
    const described = card.getAttribute('aria-describedby')!.split(' ');
    expect(described).toHaveLength(2);
    expect(el.shadowRoot!.getElementById(described[1])?.textContent).toMatch(/^Expires at /);
  });

  it('without rules says “Tool approval”, hides Approve & disable rule, shows raw input in a <pre>', () => {
    const el = mount({
      ...BASE,
      approvals: [{ id: 'x', tool: 'Bash', raw: 'echo hi', truncated: true }],
      questions: [],
    });
    expect(q(el, '.ap-pill')?.textContent).toBe('Tool approval');
    expect(q(el, '[data-decision="approve_disable_rule"]')).toBeNull();
    expect(q(el, 'pre.ap-raw')?.textContent).toBe('echo hi');
    expect(q(el, '.ap-truncated')).not.toBeNull();
  });

  it('counts what waits in the Needs input head and hides the section when nothing does', () => {
    const el = mount(BASE);
    expect(q(el, '.ar-needs-head')?.textContent).toBe('Needs input2');
    expect(q(el, '.pn-count')?.textContent).toBe('2');
    expect(q(mount({ ...BASE, approvals: [], questions: [] }), '.ar-needs')).toBeNull();
  });

  it('draws the question card: recommended choice first as the primary with ⌘↵', () => {
    const el = mount(BASE);
    const card = q(el, '.ap-card[data-kind="question"]')!;
    expect(card.querySelector('.ap-title')?.textContent).toBe('Run the migration on production now?');
    expect(card.querySelector('.ap-pill')?.textContent).toBe('Question');
    const choices = Array.from(card.querySelectorAll<HTMLElement>('.ap-choice'));
    expect(choices.map((c) => c.dataset.choice)).toEqual(['wait', 'run']);
    expect(choices[0].classList.contains('ap-rec')).toBe(true);
    expect(choices[0].querySelector('.ap-choice-tag')?.textContent).toBe('Recommended');
    expect(choices[0].getAttribute('aria-keyshortcuts')).toBe('Meta+Enter Control+Enter');
    expect(choices[1].querySelector('.ap-choice-desc')?.textContent).toBe('Applies 0042');
    expect(card.dataset.key).toBe(dkey('q', runQuestionKey(QUESTION)));
    expect(choices[0].dataset.key).toBe(dkey('q', runQuestionKey(QUESTION), 'wait'));
  });

  it('draws the details list, with a live duration', () => {
    const el = mount(BASE);
    const rows = qa(el, '.pi-details > div');
    expect(rows.map((r) => r.querySelector('dt')?.textContent)).toEqual(['Agent', 'Tool calls', 'Active time']);
    expect(rows[1].querySelector('dd')?.textContent).toBe('13');
    expect(rows[2].querySelector('dd')?.textContent).toBe('3m 00s');
  });

  it('chooses the wide layout side by what is there', () => {
    expect(q(mount(BASE), '.ar-body')?.dataset.side).toBe('needs');
    expect(q(mount({ ...BASE, approvals: [], questions: [] }), '.ar-body')?.dataset.side).toBe('details');
    expect(q(mount({ ...BASE, approvals: [], questions: [], details: [] }), '.ar-body')?.dataset.side).toBeUndefined();
  });
});

describe('escaping', () => {
  it('escapes every user / model / tool string', () => {
    const el = mount({
      title: XSS,
      subtitle: XSS,
      status: 'waiting',
      startedAt: NOW - 1000,
      canStop: XSS,
      plan: { steps: [{ id: XSS, ref: XSS, label: XSS, detail: XSS, status: 'running', startedAt: NOW - 1000 }] },
      approvals: [
        {
          id: XSS,
          tool: XSS,
          title: XSS,
          summary: XSS,
          fields: [[XSS, XSS]],
          rules: [{ id: XSS, label: XSS, description: XSS }],
          canAnswer: XSS,
          error: XSS,
        },
        { id: 'raw', tool: XSS, raw: XSS },
        { id: 'done', tool: XSS, title: XSS, answered: 'approve' },
      ],
      questions: [
        { id: XSS, title: XSS, body: XSS, choices: [{ id: XSS, label: XSS, description: XSS, recommended: true }] },
        { id: 'q2', title: XSS, choices: [{ id: 'c', label: XSS }], answered: 'c' },
      ],
      details: [[XSS, XSS]],
    });
    const html = el.shadowRoot!.innerHTML;
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    const all = Array.from(el.shadowRoot!.querySelectorAll('*'));
    expect(all.some((n) => n.getAttributeNames().some((a) => a.startsWith('on')))).toBe(false);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(q(el, '.ap-card[data-kind="perm"]')?.dataset.id).toBe(XSS);
    expect(q(el, '.ap-lock')?.textContent).toBe(XSS);
  });
});

describe('events', () => {
  it('emits ui-approve for each answer and locks the card until the host settles it', () => {
    for (const decision of ['approve', 'deny', 'explain', 'approve_disable_rule'] as const) {
      const el = mount(BASE);
      const fired = vi.fn();
      el.addEventListener('ui-approve', (e) => fired((e as CustomEvent).detail));
      q(el, `[data-decision="${decision}"]`)!.click();
      expect(fired).toHaveBeenCalledWith({ id: 'ap_1', decision });
      el.renderNow();
      const btns = qa(el, '.ap-card[data-kind="perm"] button');
      expect(btns.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
      expect(q(el, `[data-decision="${decision}"]`)?.getAttribute('aria-busy')).toBe('true');
      // A second press sends nothing.
      q(el, '[data-decision="approve"]')!.click();
      expect(fired).toHaveBeenCalledTimes(1);
    }
  });

  it('unlocks on an error, turns into a resolved row once answered, and announces it once', () => {
    const el = mount(BASE);
    q(el, '.ap-approve')!.click();
    el.renderNow();
    el.data = { ...BASE, approvals: [{ ...AP, error: 'Network error — try again' }] };
    el.renderNow();
    expect((q(el, '.ap-approve') as HTMLButtonElement).disabled).toBe(false);
    expect(q(el, '.ap-note')?.textContent).toBe('Network error — try again');
    expect(live(el)).toBe('Network error — try again');
    el.data = { ...BASE, approvals: [{ ...AP, answered: 'approve' }] };
    el.renderNow();
    const row = q(el, '.ap-card.is-resolved')!;
    expect(row.querySelector('.ap-row-status')?.textContent).toBe('Approved');
    expect(row.querySelector('.ap-resolved')?.classList.contains('is-enter')).toBe(true);
    expect(row.querySelector('button')).toBeNull();
    expect(live(el)).toBe('Approval sent — Bash');
    expect(q(el, '.pn-count')?.textContent).toBe('1');
    el.data = { ...el.data! };
    el.renderNow();
    expect(q(el, '.ap-resolved')?.classList.contains('is-enter')).toBe(false);
  });

  it('a cancelled ui-approve keeps the card unlocked; locked cards send nothing', () => {
    const el = mount(BASE);
    el.addEventListener('ui-approve', (e) => e.preventDefault());
    q(el, '.ap-approve')!.click();
    el.renderNow();
    expect((q(el, '.ap-approve') as HTMLButtonElement).disabled).toBe(false);

    const ro = mount({ ...BASE, approvals: [{ ...AP, canAnswer: 'Only the requester can answer' }] });
    const fired = vi.fn();
    ro.addEventListener('ui-approve', fired);
    const btn = q<HTMLButtonElement>(ro, '.ap-approve')!;
    expect(btn.disabled).toBe(true);
    expect(btn.title).toBe('Only the requester can answer');
    btn.click();
    key(btn, { key: 'Enter', metaKey: true });
    expect(fired).not.toHaveBeenCalled();
  });

  it('emits ui-answer for a choice; the answered question becomes a resolved row', () => {
    const el = mount(BASE);
    const fired = vi.fn();
    el.addEventListener('ui-answer', (e) => fired((e as CustomEvent).detail));
    q(el, '[data-choice="run"]')!.click();
    expect(fired).toHaveBeenCalledWith({ questionId: 'q1', choiceId: 'run' });
    el.renderNow();
    expect(qa(el, '.ap-choice').every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    el.data = { ...BASE, questions: [{ ...QUESTION, answered: 'run' }] };
    el.renderNow();
    expect(q(el, '.ap-card[data-kind="question"] .ap-row-status')?.textContent).toBe('Answered · Run on production');
    expect(live(el)).toBe('Answer sent — Run on production');
  });

  it('emits ui-stop once while live; host-owned stopping keeps it busy', () => {
    const el = mount(BASE);
    const fired = vi.fn();
    el.addEventListener('ui-stop', (e) => fired((e as CustomEvent).detail));
    q(el, '.ar-stop')!.click();
    expect(fired).toHaveBeenCalledWith({});
    el.renderNow();
    expect((q(el, '.ar-stop') as HTMLButtonElement).disabled).toBe(true);
    q(el, '.ar-stop')!.click();
    expect(fired).toHaveBeenCalledTimes(1);
    el.data = { ...BASE, stopping: true };
    el.renderNow();
    expect(q(el, '.ar-stop')?.getAttribute('aria-busy')).toBe('true');
  });
});

describe('keyboard', () => {
  it('⌘/Ctrl+Enter anywhere in an approval card approves', () => {
    for (const mod of [{ metaKey: true }, { ctrlKey: true }]) {
      const el = mount(BASE);
      const fired = vi.fn();
      el.addEventListener('ui-approve', (e) => fired((e as CustomEvent).detail));
      const card = q(el, '.ap-card[data-kind="perm"]')!;
      const ev = key(card.querySelector('.ap-ghost')!, { key: 'Enter', ...mod });
      expect(ev.defaultPrevented).toBe(true);
      expect(fired).toHaveBeenCalledWith({ id: 'ap_1', decision: 'approve' });
    }
    const el = mount(BASE);
    const fired = vi.fn();
    el.addEventListener('ui-approve', fired);
    key(q(el, '.ap-card[data-kind="perm"]')!, { key: 'Enter', metaKey: true });
    expect(fired).toHaveBeenCalledTimes(1);
    key(q(el, '.ar-title')!, { key: 'Enter', metaKey: true });
    expect(fired).toHaveBeenCalledTimes(1);
  });

  it('Esc denies only from a card button and does not reach the page; Esc on the card passes through', () => {
    const el = mount(BASE);
    const fired = vi.fn();
    const page = vi.fn();
    el.addEventListener('ui-approve', (e) => fired((e as CustomEvent).detail));
    document.addEventListener('keydown', page);
    key(q(el, '.ap-card[data-kind="perm"]')!, { key: 'Escape' });
    expect(fired).not.toHaveBeenCalled();
    expect(page).toHaveBeenCalledTimes(1);
    const ev = key(q(el, '.ap-approve')!, { key: 'Escape' });
    expect(fired).toHaveBeenCalledWith({ id: 'ap_1', decision: 'deny' });
    expect(ev.defaultPrevented).toBe(true);
    expect(page).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', page);
  });

  it('⌘/Ctrl+Enter in a question card picks the recommended choice, and nothing without one', () => {
    const el = mount(BASE);
    const fired = vi.fn();
    el.addEventListener('ui-answer', (e) => fired((e as CustomEvent).detail));
    key(q(el, '[data-choice="run"]')!, { key: 'Enter', ctrlKey: true });
    expect(fired).toHaveBeenCalledWith({ questionId: 'q1', choiceId: 'wait' });
    const plain = mount({
      ...BASE,
      questions: [{ ...QUESTION, choices: QUESTION.choices.map((c) => ({ ...c, recommended: false })) }],
    });
    const none = vi.fn();
    plain.addEventListener('ui-answer', none);
    const ev = key(q(plain, '.ap-card[data-kind="question"]')!, { key: 'Enter', metaKey: true });
    expect(none).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });
});

describe('focus safety on live updates', () => {
  const B: AgentRunApproval = { id: 'ap_2', tool: 'Write', fields: [['file_path', '/tmp/x']] };

  it('keeps focus on the same request’s button when the list changes around it', () => {
    const el = mount({ ...BASE, approvals: [AP, B] });
    q(el, `[data-key="${dkey('ap', 'ap_2', 'approve')}"]`)!.focus();
    el.data = { ...BASE, approvals: [B, AP] };
    el.renderNow();
    expect(active(el)?.dataset.key).toBe(dkey('ap', 'ap_2', 'approve'));
  });

  it('never rebinds a focused Approve to another request: focus goes to the Needs input head, ⌘↵ sends nothing', () => {
    const el = mount({ ...BASE, approvals: [AP, B], questions: [] });
    const fired = vi.fn();
    el.addEventListener('ui-approve', fired);
    const a = q(el, `[data-key="${dkey('ap', 'ap_1', 'approve')}"]`)!;
    a.focus();
    el.data = { ...BASE, approvals: [B], questions: [] };
    el.renderNow();
    expect(a.isConnected).toBe(false);
    expect(active(el)?.classList.contains('ar-needs-head')).toBe(true);
    key(active(el)!, { key: 'Enter', metaKey: true });
    expect(fired).not.toHaveBeenCalled();
  });

  it('falls back to the title when no card is left, and to the resolved row of the same request', () => {
    const el = mount({ ...BASE, approvals: [AP], questions: [] });
    q(el, '.ap-approve')!.focus();
    el.data = { ...BASE, approvals: [{ ...AP, answered: 'approve' }], questions: [] };
    el.renderNow();
    expect(active(el)?.dataset.key).toBe(dkey('ap', 'ap_1'));
    expect(active(el)?.classList.contains('is-resolved')).toBe(true);
    el.data = { ...BASE, approvals: [], questions: [] };
    el.renderNow();
    expect(active(el)?.classList.contains('ar-title')).toBe(true);
  });

  it('a question rewritten in place is another card: its focused choice leaves, focus goes to the head', () => {
    const el = mount({ ...BASE, approvals: [] });
    const fired = vi.fn();
    el.addEventListener('ui-answer', fired);
    q(el, '.ap-rec')!.focus();
    const rewritten = {
      ...QUESTION,
      choices: [QUESTION.choices[0], { ...QUESTION.choices[1], label: 'Run now anyway' }],
    };
    el.data = { ...BASE, approvals: [], questions: [rewritten] };
    el.renderNow();
    expect(active(el)?.classList.contains('ar-needs-head')).toBe(true);
    key(active(el)!, { key: 'Enter', metaKey: true });
    expect(fired).not.toHaveBeenCalled();
    // The same meaning keeps the node's identity: focus stays on the choice.
    q(el, '.ap-rec')!.focus();
    el.data = { ...BASE, approvals: [], questions: [{ ...rewritten }] };
    el.renderNow();
    expect(active(el)?.classList.contains('ap-rec')).toBe(true);
  });
});

describe('keyboard landing', () => {
  it('focusNeeds() lands on the first unanswered card itself, not a button', () => {
    // (happy-dom cannot read a shadow root's activeElement while focus sits in another connected shadow root,
    // so the empty case goes first and leaves the page before its queued render.)
    const none = mount({ ...BASE, approvals: [], questions: [] });
    expect(none.focusNeeds()).toBe(false);
    none.remove();
    const el = mount({
      ...BASE,
      approvals: [
        { ...AP, answered: 'approve' },
        { id: 'ap_2', tool: 'Write' },
      ],
    });
    expect(el.focusNeeds()).toBe(true);
    expect(active(el)?.dataset.id).toBe('ap_2');
    expect(active(el)?.tagName).toBe('DIV');
  });
});

describe('announcements', () => {
  it('is silent on the first render, then says what changed', () => {
    const el = mount(BASE);
    expect(live(el)).toBe('');
    const next = STEPS.map((s) => (s.id === 's3' ? { ...s, status: 'done' as const, endedAt: NOW } : s));
    el.data = { ...BASE, plan: { steps: next } };
    el.renderNow();
    expect(live(el)).toBe('Step done: Send the draft');
    expect(q(el, '.pl-step.pl-pop')?.dataset.step).toBe('done');
    el.data = { ...el.data!, status: 'running', approvals: [AP, { id: 'ap_9', tool: 'Write' }] };
    el.renderNow();
    expect(live(el)).toBe('Status: Running. Approval request — Write');
    expect(q(el, '.pl-pop')).toBeNull();
  });

  it('an emptied and refilled plan is a new list, not changes', () => {
    const el = mount(BASE);
    el.data = { ...BASE, plan: { steps: [] } };
    el.renderNow();
    el.data = { ...BASE, plan: { steps: STEPS.map((s) => ({ ...s, status: 'done' as const })) } };
    el.renderNow();
    expect(live(el)).toBe('');
  });
});

describe('lang="ko"', () => {
  it('uses the dashboard’s Korean strings', () => {
    const el = mount(BASE, { lang: 'ko' });
    expect(q(el, '.ps-label')?.textContent).toBe('세션');
    expect(q(el, '.ps-word')?.textContent).toBe('입력 대기');
    expect(q(el, '.ps-time')?.textContent).toMatch(/^시작 /);
    expect(q(el, '.ar-stop')?.getAttribute('aria-label')).toBe('Stop — 세션 중지');
    expect(q(el, '.ar-sec-h')?.textContent).toBe('계획');
    expect(q(el, '.pl-list')?.getAttribute('aria-label')).toBe('계획 단계');
    expect(qa(el, '.pl-chip')[0].textContent).toBe('툴 4회');
    expect(q(el, '.pl-foot-st')?.textContent).toBe('실행 중 · 2/4');
    expect(q(el, '.ar-needs-head')?.firstChild?.textContent).toBe('입력 필요');
    expect(q(el, '.ap-title')?.textContent).toBe('Bash 실행 승인');
    expect(q(el, '.ap-label')?.textContent).toMatch(/^Bash · .* 요청$/);
    expect(q(el, '.ap-pill')?.textContent).toBe('위험 규칙 1');
    expect(q(el, '.ap-expires')?.textContent).toBe('만료까지 3:41');
    expect(q(el, '.ap-choice-tag')?.textContent).toBe('추천');
    expect(q(el, '.ap-card[data-kind="question"] .ap-pill')?.textContent).toBe('질문');
    expect(qa(el, '.ar-sec-h')[1].textContent).toBe('세부');
    el.data = { ...BASE, approvals: [{ ...AP, answered: 'deny' }] };
    el.renderNow();
    expect(q(el, '.ap-row-status')?.textContent).toBe('거부함');
    expect(live(el)).toBe('거부를 보냈습니다 — Bash');
  });

  it('switches language when the attribute changes', async () => {
    const el = mount(BASE);
    el.setAttribute('lang', 'ko');
    await Promise.resolve();
    expect(q(el, '.ps-word')?.textContent).toBe('입력 대기');
  });
});
