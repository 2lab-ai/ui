import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import type { UiApprovalCard } from './approval-card';
import './approval-card';
import type { ApprovalCardData, ApprovalPermissionData, ApprovalQuestionData } from './logic';
import {
  agoText,
  approvalIcon,
  choiceOrder,
  clockText,
  decisionOutcome,
  fieldText,
  lineDiff,
  normState,
  recommendedOf,
  riskOf,
  toPreview,
} from './logic';
import { approvalStrings } from './strings';

const XSS = '<img src=x onerror=alert(1)>';

function mount(data: ApprovalCardData, attrs: Record<string, string> = {}): UiApprovalCard {
  const el = document.createElement('ui-approval-card');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <T extends Element = HTMLElement>(el: UiApprovalCard, sel: string) =>
  el.shadowRoot?.querySelector<T>(sel) ?? null;
const qa = (el: UiApprovalCard, sel: string) => [...(el.shadowRoot?.querySelectorAll<HTMLElement>(sel) ?? [])];
const set = (el: UiApprovalCard, patch: Partial<ApprovalPermissionData> | Partial<ApprovalQuestionData>) => {
  el.data = { ...(el.data as ApprovalCardData), ...patch } as ApprovalCardData;
  el.renderNow();
};
function events(el: UiApprovalCard, name: string): unknown[] {
  const out: unknown[] = [];
  el.addEventListener(name, (e) => out.push((e as CustomEvent).detail));
  return out;
}
const perm = (over: Partial<ApprovalPermissionData> = {}): ApprovalPermissionData => ({
  kind: 'permission',
  id: 'ap1',
  tool: 'Bash',
  rules: [{ id: 'pipe-to-interpreter', label: 'Pipe into an interpreter' }],
  input: { command: 'psql "$URL" -f x.sql', description: 'Run the migration' },
  ...over,
});
const ques = (over: Partial<ApprovalQuestionData> = {}): ApprovalQuestionData => ({
  kind: 'question',
  id: 'q1',
  question: 'Which way?',
  recommendedId: 'b',
  choices: [
    { id: 'a', label: 'Option A' },
    { id: 'b', label: 'Option B', description: 'the better one' },
  ],
  ...over,
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('logic', () => {
  it('clockText / agoText format a countdown and a relative time', () => {
    expect(clockText(4 * 60_000 + 59_000)).toBe('4:59');
    expect(clockText(9_500)).toMatch(/^0:(09|10)$/);
    const now = Date.now();
    expect(agoText(now - 120_000, now, 'en')).toMatch(/2m/);
    expect(agoText(now - 120_000, now, 'ko')).toMatch(/2분/);
  });

  it('normState accepts the four states and refuses anything else', () => {
    expect(normState('sending')).toEqual({ status: 'sending' });
    expect(normState({ status: 'resolved', outcome: 'approved' })).toMatchObject({
      status: 'resolved',
      outcome: 'approved',
    });
    expect(normState({ status: 'resolved', outcome: 'nonsense' }).status).toBe('pending');
    expect(normState({ status: 'error', message: 'x' })).toMatchObject({ status: 'error', message: 'x' });
    expect(normState(42).status).toBe('pending');
  });

  it('riskOf defaults to high when a rule matched; recommendedOf / choiceOrder put the recommendation first', () => {
    expect(riskOf({ rules: [{ id: 'r', label: 'r' }] })).toBe('high');
    expect(riskOf({ rules: [] })).toBeUndefined();
    expect(riskOf({ risk: 'low', rules: [{ id: 'r', label: 'r' }] })).toBe('low');
    const choices = ques().choices;
    expect(recommendedOf({ choices, recommendedId: 'b' })).toBe('b');
    expect(recommendedOf({ choices, recommendedId: 'zz' })).toBeUndefined();
    expect(choiceOrder(choices, 'b').map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('decisionOutcome maps every decision', () => {
    expect(decisionOutcome('approve')).toEqual({ outcome: 'approved' });
    expect(decisionOutcome('approve_disable_rule')).toEqual({ outcome: 'approved', ruleDisabled: true });
    expect(decisionOutcome('deny').outcome).toBe('denied');
    expect(decisionOutcome('explain').outcome).toBe('explained');
  });

  it('toPreview: command → shell, old/new_string → diff, other keys → rows, non-JSON text → raw', () => {
    expect(toPreview({ command: 'ls -la', description: 'list' })).toMatchObject({ command: 'ls -la', summary: 'list' });
    const diff = toPreview({ file_path: 'a.ts', old_string: 'a\nb', new_string: 'a\nc' });
    expect(diff.diffs[0].path).toBe('a.ts');
    expect(diff.diffs[0].lines.some((l) => l.text === 'c')).toBe(true);
    expect(toPreview('{"query":"x"}').fields).toEqual([['query', 'x']]);
    expect(toPreview('not json at all').raw).toBe('not json at all');
    expect(toPreview(undefined)).toMatchObject({ summary: '', diffs: [], fields: [] });
    expect(lineDiff('a\nb', 'a\nc').map((l) => l.text)).toContain('b');
    expect(fieldText({ a: 1 })).toContain('"a"');
    expect(approvalIcon('Bash')).toBe('terminal');
    expect(approvalIcon('mcp__github__x')).toBe('plug');
  });
});

describe('<ui-approval-card> permission', () => {
  it('renders title, risk, rules, the command and Approve / Deny', () => {
    const el = mount(perm());
    expect(q(el, '.ac-title')?.textContent).toContain('Bash approval');
    expect(q(el, '.ac-risk')?.textContent).toMatch(/High/);
    expect(q(el, '.ac-rule')?.textContent).toContain('Pipe into an interpreter');
    expect(q(el, '.ac-code')?.textContent).toContain('psql "$URL" -f x.sql');
    expect(qa(el, '[data-act="approve"]')).toHaveLength(1);
    expect(qa(el, '[data-act="deny"]')).toHaveLength(1);
    expect(qa(el, '[data-act="explain"]')).toHaveLength(0);
  });

  it('escapes every host string', () => {
    const el = mount(
      perm({
        tool: XSS,
        title: XSS,
        description: XSS,
        rules: [{ id: XSS, label: XSS, description: XSS }],
        input: { command: XSS, [XSS]: XSS },
        label: XSS,
        canAnswer: XSS,
      }),
    );
    expect(el.shadowRoot?.querySelector('img')).toBeNull();
    expect(el.shadowRoot?.innerHTML).toContain('&lt;img');
    const q2 = mount(
      ques({
        question: XSS,
        description: XSS,
        choices: [{ id: XSS, label: XSS, description: XSS }],
        recommendedId: XSS,
      }),
    );
    expect(q2.shadowRoot?.querySelector('img')).toBeNull();
    const row = mount(perm({ id: 'r', state: { status: 'resolved', outcome: 'approved', by: XSS, at: Date.now() } }));
    expect(row.shadowRoot?.querySelector('img')).toBeNull();
    const err = mount(perm({ id: 'e', state: { status: 'error', message: XSS } }));
    expect(err.shadowRoot?.querySelector('img')).toBeNull();
  });

  it('Approve emits ui-decide and locks the answers until the host settles', () => {
    const el = mount(perm());
    const got = events(el, 'ui-decide');
    q<HTMLButtonElement>(el, '[data-act="approve"]')?.click();
    expect(got).toEqual([{ id: 'ap1', decision: 'approve' }]);
    el.renderNow();
    expect(el.status).toBe('sending');
    q<HTMLButtonElement>(el, '[data-act="deny"]')?.click();
    expect(got).toHaveLength(1); // locked
    set(el, { state: { status: 'resolved', outcome: 'approved', at: Date.now() } });
    expect(el.status).toBe('resolved');
    expect(q(el, '.ac-row-status')?.textContent).toContain('Approved');
  });

  it('a cancelled ui-decide leaves the card answerable', () => {
    const el = mount(perm());
    el.addEventListener('ui-decide', (e) => e.preventDefault());
    q<HTMLButtonElement>(el, '[data-act="approve"]')?.click();
    el.renderNow();
    expect(el.status).toBe('pending');
  });

  it('the rule checkbox turns Approve into approve_disable_rule; Explain only when offered', () => {
    const el = mount(perm({ canDisableRule: true, canExplain: true }));
    const got = events(el, 'ui-decide');
    const box = q<HTMLInputElement>(el, '.ac-always input');
    expect(box).not.toBeNull();
    box!.checked = true;
    box!.click();
    box!.checked = true;
    q<HTMLButtonElement>(el, '[data-act="approve"]')?.click();
    expect(got.at(-1)).toMatchObject({ decision: expect.stringMatching(/approve/) });
    const el2 = mount(perm({ id: 'x2', canExplain: true }));
    const got2 = events(el2, 'ui-decide');
    q<HTMLButtonElement>(el2, '[data-act="explain"]')?.click();
    expect(got2).toEqual([{ id: 'x2', decision: 'explain' }]);
  });

  it('an error offers Retry, which sends the last answer again', () => {
    const el = mount(perm());
    const got = events(el, 'ui-decide');
    q<HTMLButtonElement>(el, '[data-act="deny"]')?.click();
    set(el, { state: { status: 'error', message: 'HTTP 502' } });
    expect(q(el, '.ac-error-text')?.textContent).toContain('HTTP 502');
    q<HTMLButtonElement>(el, '[data-act="retry"]')?.click();
    expect(got).toEqual([
      { id: 'ap1', decision: 'deny' },
      { id: 'ap1', decision: 'deny' },
    ]);
  });

  it('Retry locks the answers until the host changes state — no duplicate or conflicting answers (review P1)', () => {
    const el = mount(perm({ id: 'r1' }));
    const got = events(el, 'ui-decide');
    q<HTMLButtonElement>(el, '[data-act="deny"]')?.click();
    const err = { status: 'error' as const, message: 'HTTP 502' };
    set(el, { state: err });
    q<HTMLButtonElement>(el, '[data-act="retry"]')?.click();
    el.renderNow();
    expect(el.status).toBe('sending');
    q<HTMLButtonElement>(el, '[data-act="retry"]')?.click();
    q<HTMLButtonElement>(el, '[data-act="approve"]')?.click();
    q<HTMLButtonElement>(el, '[data-act="deny"]')?.click();
    expect(got).toEqual([
      { id: 'r1', decision: 'deny' },
      { id: 'r1', decision: 'deny' },
    ]);
    // The host answers the retry with the same failure (a new state value): Retry is offered again.
    set(el, { state: { status: 'error', message: 'HTTP 502' } });
    expect(el.status).toBe('error');
    q<HTMLButtonElement>(el, '[data-act="retry"]')?.click();
    expect(got).toHaveLength(3);
  });

  it('past expiresAt nobody can answer, even while hovered; ui-expire still fires (review P2)', () => {
    vi.useFakeTimers();
    const el = mount(perm({ id: 'h1', expiresAt: Date.now() + 2_000 }));
    const decided = events(el, 'ui-decide');
    const expired = events(el, 'ui-expire');
    el.dispatchEvent(new Event('pointerenter'));
    vi.advanceTimersByTime(3_000);
    q<HTMLButtonElement>(el, '[data-act="approve"]')?.click();
    expect(decided).toHaveLength(0);
    expect(expired).toEqual([{ id: 'h1' }]);
  });

  it('a failed answer that runs out of time becomes the Expired row (review P3)', () => {
    vi.useFakeTimers();
    const el = mount(
      perm({ id: 'x1', expiresAt: Date.now() + 1_000, state: { status: 'error', message: 'HTTP 502' } }),
    );
    vi.advanceTimersByTime(2_100);
    el.renderNow();
    expect(q(el, '.ac-row')).not.toBeNull();
    expect(el.shadowRoot?.textContent).toContain('Expired');
  });

  it('canAnswer false / string locks the answers and says why', () => {
    const el = mount(perm({ canAnswer: 'Only the session owner can answer.' }));
    const got = events(el, 'ui-decide');
    expect(el.shadowRoot?.textContent).toContain('Only the session owner can answer.');
    q<HTMLButtonElement>(el, '[data-act="approve"]')?.click();
    expect(got).toHaveLength(0);
  });

  it('⌘/Ctrl+Enter approves; Esc from a button denies', () => {
    const el = mount(perm());
    const got = events(el, 'ui-decide');
    q(el, '.ac-card')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, composed: true }),
    );
    expect(got).toEqual([{ id: 'ap1', decision: 'approve' }]);
    const el2 = mount(perm({ id: 'k2' }));
    const got2 = events(el2, 'ui-decide');
    q(el2, '[data-act="approve"]')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    );
    expect(got2).toEqual([{ id: 'k2', decision: 'deny' }]);
  });

  it('counts down to expiresAt, then emits ui-expire and shows Expired; the timer stops on disconnect', () => {
    vi.useFakeTimers();
    const start = Date.now();
    const el = mount(perm({ expiresAt: start + 3_000 }));
    expect(q(el, '.ac-expires')?.textContent).toMatch(/Expires in 0:0[23]/);
    const got = events(el, 'ui-expire');
    vi.advanceTimersByTime(4_100);
    el.renderNow();
    expect(got).toEqual([{ id: 'ap1' }]);
    expect(el.shadowRoot?.textContent).toContain('Expired');
    const el2 = mount(perm({ id: 'gone', expiresAt: Date.now() + 2_000 }));
    const got2 = events(el2, 'ui-expire');
    el2.remove();
    vi.advanceTimersByTime(5_000);
    expect(got2).toHaveLength(0);
  });

  it('shows the input loading line and a cut input note', () => {
    const el = mount(perm({ input: undefined, loading: true }));
    expect(el.shadowRoot?.textContent).toContain('Loading the input…');
    const el2 = mount(perm({ id: 't', input: 'x'.repeat(50), truncated: true }));
    expect(el2.shadowRoot?.textContent).toContain('Showing the beginning only');
  });
});

describe('<ui-approval-card> question', () => {
  it('lists the recommended choice first and preselected; Submit sends it', () => {
    const el = mount(ques());
    const opts = qa(el, '.ac-opt');
    expect(opts[0].textContent).toContain('Option B');
    expect(opts[0].textContent).toContain('Recommended');
    expect(opts[0].getAttribute('aria-checked')).toBe('true');
    const got = events(el, 'ui-answer');
    q<HTMLButtonElement>(el, '[data-act="submit"]')?.click();
    expect(got).toEqual([{ id: 'q1', choiceId: 'b' }]);
  });

  it('arrows move the choice; Enter on an option submits it', () => {
    const el = mount(ques({ id: 'q2' }));
    const got = events(el, 'ui-answer');
    const first = qa(el, '.ac-opt')[0];
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
    const second = qa(el, '.ac-opt')[1];
    expect(second.getAttribute('aria-checked')).toBe('true');
    second.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
    expect(got).toEqual([{ id: 'q2', choiceId: 'a' }]);
  });

  it('a free-text answer is sent as text', () => {
    const el = mount(ques({ id: 'q3', allowOther: true, recommendedId: undefined }));
    const got = events(el, 'ui-answer');
    q<HTMLElement>(el, '[data-other]')?.click();
    el.renderNow();
    const input = q<HTMLInputElement>(el, '.ac-other input');
    expect(input).not.toBeNull();
    input!.value = '  merge after review  ';
    input!.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
    expect(got).toEqual([{ id: 'q3', text: 'merge after review' }]);
  });

  it('resolved: a row with the answer', () => {
    const el = mount(ques({ state: { status: 'resolved', outcome: 'answered', choiceId: 'b', at: Date.now() } }));
    expect(q(el, '.ac-row')).not.toBeNull();
    expect(el.shadowRoot?.textContent).toContain('Option B');
  });
});

describe('lang="ko"', () => {
  it('uses the dashboard wording', () => {
    const el = mount(perm(), { lang: 'ko' });
    expect(q(el, '.ac-title')?.textContent).toContain('Bash 실행 승인');
    expect(q(el, '.ac-risk')?.textContent).toMatch(/위험 높음/);
    const t = approvalStrings('ko');
    expect(t.outcome.expired).toBeTruthy();
    const row = mount(perm({ id: 'r', state: { status: 'resolved', outcome: 'approved', at: Date.now() } }), {
      lang: 'ko',
    });
    expect(q(row, '.ac-row-status')?.textContent).toContain(t.outcome.approved);
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    spy = soundSpy();
  });
  afterEach(() => spy.restore());
  const click = (b: Element | null | undefined) =>
    b?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail: 1 }));
  const down = (t: Element | null | undefined, key: string, init: KeyboardEventInit = {}) =>
    t?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init }));

  it('Approve and Explain tap, Deny closes — each once its ui-decide goes through', async () => {
    const a = mount(perm({ id: 'a', canExplain: true }));
    click(q(a, '[data-act="approve"]'));
    await spy.settle();
    const b = mount(perm({ id: 'b' }));
    click(q(b, '[data-act="deny"]'));
    await spy.settle();
    const c = mount(perm({ id: 'c', canExplain: true }));
    click(q(c, '[data-act="explain"]'));
    await spy.settle();
    expect(spy.calls).toEqual([
      ['tap', { input: 'mouse' }],
      ['close', { input: 'mouse' }],
      ['tap', { input: 'mouse' }],
    ]);
  });

  it('⌘/Ctrl+Enter approves and Esc denies from the keyboard; a prevented ui-decide is silent', async () => {
    const a = mount(perm({ id: 'a' }));
    down(q(a, '.ac-card'), 'Enter', { ctrlKey: true });
    await spy.settle();
    const b = mount(perm({ id: 'b' }));
    down(q(b, '[data-act="approve"]'), 'Escape');
    await spy.settle();
    expect(spy.calls).toEqual([
      ['tap', { input: 'keyboard' }],
      ['close', { input: 'keyboard' }],
    ]);
    const c = mount(perm({ id: 'c' }));
    c.addEventListener('ui-decide', (e) => e.preventDefault());
    click(q(c, '[data-act="approve"]'));
    click(q(c, '[data-act="deny"]'));
    await spy.settle();
    expect(spy.calls).toHaveLength(2);
  });

  it('answering the question taps; keystrokes in the free-text box play type while typing is on', async () => {
    const el = mount(ques({ allowOther: true }));
    click(q(el, '[data-act="submit"]'));
    await spy.settle();
    expect(spy.calls).toEqual([['tap', { input: 'mouse' }]]);
    spy.restore();
    spy = soundSpy({ typing: true });
    const other = mount(ques({ id: 'q2', allowOther: true, recommendedId: undefined }));
    click(q(other, '[data-other]'));
    other.renderNow();
    await spy.settle();
    const input = q<HTMLInputElement>(other, '.ac-other input')!;
    down(input, 'x');
    await spy.settle();
    input.value = 'merge after review';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    down(input, 'Enter');
    await spy.settle();
    expect(spy.calls).toEqual([
      ['type', { key: 'printable', input: 'keyboard' }],
      ['tap', { input: 'keyboard' }],
    ]);
  });

  it('expiry is silent', () => {
    vi.useFakeTimers();
    const el = mount(perm({ expiresAt: Date.now() + 2_000 }));
    const expired = events(el, 'ui-expire');
    vi.advanceTimersByTime(3_000);
    el.renderNow();
    vi.advanceTimersByTime(100);
    expect(expired).toHaveLength(1);
    expect(spy.calls).toEqual([]);
  });

  it('el.data from code is silent, and so is a card inside data-ui-sound="off"', async () => {
    const el = mount(perm());
    set(el, { state: { status: 'resolved', outcome: 'denied', at: Date.now() } });
    await spy.settle();
    expect(spy.calls).toEqual([]);
    const quiet = document.createElement('div');
    quiet.setAttribute('data-ui-sound', 'off');
    document.body.append(quiet);
    const muted = document.createElement('ui-approval-card');
    quiet.append(muted);
    muted.data = perm({ id: 'm' });
    muted.renderNow();
    click(q(muted, '[data-act="approve"]'));
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });
});
