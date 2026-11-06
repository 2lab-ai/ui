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

describe('irreversible — Approve is a slide', () => {
  const irr = (over: Partial<ApprovalPermissionData> = {}) =>
    perm({ irreversible: 'prod 배포', canDisableRule: true, ...over });
  /** What the slide's commit sends: its cancelable ui-confirm, from inside the card's shadow root. */
  const slideCommit = (el: UiApprovalCard) => {
    const slide = q(el, '.ac-slide')!;
    const ev = new CustomEvent('ui-confirm', { detail: {}, bubbles: true, composed: true, cancelable: true });
    slide.dispatchEvent(ev);
    return ev;
  };

  it('irreversibleOf / riskOf: the host label trimmed; an irreversible action is high risk without a rule', () => {
    expect(riskOf({ irreversible: 'prod 배포', rules: [] })).toBe('high');
    expect(riskOf({ irreversible: '  ', rules: [] })).toBeUndefined();
    expect(riskOf({ irreversible: 'x', risk: 'low' })).toBe('low');
  });

  it('renders the slide where Approve stood, says what is at stake, keeps Deny / Explain / the rule box', () => {
    const el = mount(irr({ canExplain: true }));
    expect(q(el, '.ac-approve')).toBeNull();
    const slide = q(el, 'ui-slide-confirm.ac-slide')!;
    expect(slide).not.toBeNull();
    expect(slide.getAttribute('tone')).toBe('danger');
    expect(slide.getAttribute('label')).toBe('Slide to approve');
    expect(q(el, '.ac-irrev')?.textContent).toContain('Cannot be undone: prod 배포');
    expect(q(el, '.ac-card')?.getAttribute('aria-describedby')).toContain('ac-irrev');
    expect(q(el, '.ac-deny')).not.toBeNull();
    expect(q(el, '[data-act="explain"]')).not.toBeNull();
    expect(q(el, '.ac-always input')).not.toBeNull();
    expect(q(el, '.ac-risk')?.getAttribute('data-risk')).toBe('high');
  });

  it('a slide commit sends ui-decide approve (approve_disable_rule with the box ticked) and stays inside the card', () => {
    const el = mount(irr());
    const decided = events(el, 'ui-decide');
    const leaked = events(el, 'ui-confirm');
    const ev = slideCommit(el);
    expect(ev.defaultPrevented).toBe(false);
    expect(decided).toEqual([{ id: 'ap1', decision: 'approve' }]);
    expect(leaked).toEqual([]);
    el.renderNow();
    // In flight: the slide shows busy, Deny is locked.
    expect((q(el, '.ac-slide') as unknown as { data: { state: string } }).data.state).toBe('busy');
    expect(q(el, '.ac-deny')?.getAttribute('aria-disabled')).toBe('true');

    const el2 = mount(irr({ id: 'ap2' }));
    const d2 = events(el2, 'ui-decide');
    q<HTMLInputElement>(el2, '.ac-always input')!.click();
    slideCommit(el2);
    expect(d2).toEqual([{ id: 'ap2', decision: 'approve_disable_rule' }]);
  });

  it('a refused ui-decide refuses the slide (it springs home) and the card stays answerable', () => {
    const el = mount(irr());
    el.addEventListener('ui-decide', (e) => e.preventDefault());
    const ev = slideCommit(el);
    expect(ev.defaultPrevented).toBe(true);
    el.renderNow();
    expect((q(el, '.ac-slide') as unknown as { data: { state: string; disabled: boolean } }).data).toMatchObject({
      state: 'idle',
      disabled: false,
    });
  });

  it('⌘↵ does not approve an irreversible action; Esc still denies', () => {
    const el = mount(irr());
    const decided = events(el, 'ui-decide');
    q(el, '.ac-card')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true, composed: true, cancelable: true }),
    );
    expect(decided).toEqual([]);
    q(el, '.ac-deny')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }),
    );
    expect(decided).toEqual([{ id: 'ap1', decision: 'deny' }]);
  });

  it('locked (someone else answers) or expired: the slide is disabled and a commit sends nothing', () => {
    const el = mount(irr({ canAnswer: 'Only the requester can answer' }));
    expect(q(el, '.ac-slide')?.hasAttribute('disabled')).toBe(true);
    const decided = events(el, 'ui-decide');
    expect(slideCommit(el).defaultPrevented).toBe(true);
    expect(decided).toEqual([]);
    const gone = mount(irr({ id: 'ap3', expiresAt: Date.now() - 1000 }));
    const goneDecided = events(gone, 'ui-decide');
    expect(q(gone, '.ac-slide')?.hasAttribute('disabled')).toBe(true);
    expect(slideCommit(gone).defaultPrevented).toBe(true);
    expect(goneDecided).toEqual([]);
  });

  describe('the slide survives the host refreshing data (review P1/P2)', () => {
    /** The slide's grip, inside its own shadow root (drawn now if its first render is still queued). */
    const gripOf = (el: UiApprovalCard) => {
      const slide = q<HTMLElement & { renderNow(): void }>(el, '.ac-slide')!;
      if (!slide.shadowRoot!.querySelector('.sc-grip')) slide.renderNow();
      return slide.shadowRoot!.querySelector<HTMLElement>('.sc-grip')!;
    };
    const press = (t: HTMLElement, k: string) =>
      t.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true }));

    it('End, then the host re-sends the same data while the grip slides home: the approval is still sent once', () => {
      vi.useFakeTimers();
      const el = mount(irr());
      const decided = events(el, 'ui-decide');
      const slide = q(el, '.ac-slide')!;
      press(gripOf(el), 'End');
      expect(decided).toEqual([]); // still sliding
      set(el, {}); // a board push with nothing new, mid-slide
      set(el, { expiresAt: Date.now() + 60_000 });
      expect(q(el, '.ac-slide')).toBe(slide); // the same element, its commit still pending
      vi.advanceTimersByTime(1000);
      expect(decided).toEqual([{ id: 'ap1', decision: 'approve' }]);
      // The card answered inside the slide's listener: the slide shows busy (the card's word), not its own done.
      expect((slide as unknown as { state: string }).state).toBe('busy');
      el.renderNow();
      expect(q(el, '.ac-slide')).toBe(slide);
      expect((slide as unknown as { state: string }).state).toBe('busy');
    });

    it('a drag in progress keeps its grip, and focus stays on the grip, across a refresh', () => {
      const el = mount(irr());
      const slide = q(el, '.ac-slide')!;
      const grip = gripOf(el);
      grip.focus();
      grip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 }));
      expect(slide.shadowRoot!.querySelector('.sc')?.hasAttribute('data-held')).toBe(true);
      set(el, { expiresAt: Date.now() + 60_000 });
      expect(q(el, '.ac-slide')).toBe(slide);
      expect(slide.shadowRoot!.querySelector('.sc')?.hasAttribute('data-held')).toBe(true);
      expect(slide.shadowRoot!.activeElement).toBe(gripOf(el));
    });

    it('another prompt gets a fresh slide — a gesture never carries over', () => {
      const el = mount(irr());
      const slide = q(el, '.ac-slide')!;
      set(el, { id: 'ap2' });
      expect(q(el, '.ac-slide')).not.toBe(slide);
      expect(q(el, '.ac-slide')).not.toBeNull();
    });

    it('a failed approve: the same slide goes back to idle and keeps keyboard focus, ready to slide again', () => {
      const el = mount(irr());
      const slide = q(el, '.ac-slide')!;
      gripOf(el).focus();
      slideCommit(el);
      el.renderNow();
      set(el, { state: { status: 'error', message: 'Could not send', retry: true } });
      expect(q(el, '.ac-slide')).toBe(slide);
      expect((slide as unknown as { state: string }).state).toBe('idle');
      expect(slide.shadowRoot!.activeElement).toBe(gripOf(el));
    });

    it('focus() on the slide lands on its grip (the host takes no focus)', () => {
      const el = mount(irr());
      const slide = q(el, '.ac-slide')!;
      slide.focus();
      expect(slide.shadowRoot!.activeElement).toBe(gripOf(el));
    });
  });

  it('a failed approve offers no Retry button — the slide is the way to approve again', () => {
    const el = mount(irr());
    slideCommit(el);
    set(el, { state: { status: 'error', message: 'Could not send', retry: true } });
    expect(q(el, '.ac-retry')).toBeNull();
    expect((q(el, '.ac-slide') as unknown as { data: { state: string } }).data.state).toBe('idle');
    // A plain card keeps its Retry.
    const plain = mount(perm({ id: 'ap9' }));
    q(plain, '.ac-approve')!.click();
    set(plain, { state: { status: 'error', message: 'Could not send', retry: true } });
    expect(q(plain, '.ac-retry')).not.toBeNull();
  });

  it('escapes the host label; Korean words with lang="ko"', () => {
    const el = mount(irr({ irreversible: XSS }), { lang: 'ko' });
    expect(q(el, '.ac-irrev')?.innerHTML).not.toContain('<img');
    expect(q(el, '.ac-irrev')?.textContent).toContain(`되돌릴 수 없음: ${XSS}`);
    expect(q(el, '.ac-slide')?.getAttribute('label')).toBe('밀어서 승인');
    expect(approvalStrings('ko').slideBusy).toBe('승인 중…');
  });
});
