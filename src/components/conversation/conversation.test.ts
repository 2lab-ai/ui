import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UiAiAnswer } from '../ai-answer/ai-answer';
import type { UiLogScroller } from '../log-scroller/log-scroller';
import { CONVERSATION_COPIED_MS, type UiConversation } from './conversation';
import {
  type ConversationData,
  type ConversationTurn,
  clampLinesOf,
  clampOverflows,
  clockText,
  initialOf,
  normalizeTurns,
  PENDING_KEY,
  planTurns,
  progressState,
  summaryLine,
  summaryText,
  tookText,
  turnAnswerData,
  turnSignature,
  turnSource,
  turnTime,
} from './logic';

const AT = new Date(2026, 9, 30, 14, 5, 0).getTime();
const X = `<img src=x onerror=alert(1)>"'&`;

const USER: ConversationTurn = {
  id: 'u1',
  role: 'user',
  name: 'dana',
  at: AT,
  text: 'Fix the flaky date test in the billing module.',
  skills: [{ name: 'review', text: 'Read the diff before you change anything.' }],
};
const BOT: ConversationTurn = {
  id: 'a1',
  role: 'assistant',
  at: AT + 42_000,
  markdown: 'Fixed — the test now **pins the clock**.',
  responseMs: 42_000,
  summary: { title: 'Pinned the clock', text: 'The test read the wall clock.' },
};
const SYS: ConversationTurn = {
  id: 's1',
  role: 'system',
  at: AT + 60_000,
  kind: 'compact',
  text: 'Context compacted',
  facts: [
    ['Before', '182,400 tokens'],
    ['After', '41,050 tokens'],
  ],
  raw: '/compact keep the test plan',
};

function mount(data: ConversationData, attrs: Record<string, string> = {}): UiConversation {
  const el = document.createElement('ui-conversation');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const sr = (el: UiConversation) => el.shadowRoot as ShadowRoot;
const q = <E extends Element = HTMLElement>(el: UiConversation, s: string) => sr(el).querySelector<E>(s);
const qa = (el: UiConversation, s: string) => Array.from(sr(el).querySelectorAll<HTMLElement>(s));
const logOf = (el: UiConversation) => q<UiLogScroller>(el, 'ui-log-scroller') as UiLogScroller;
const keys = (el: UiConversation) => logOf(el).items.map((n) => n.dataset.item);
const node = (el: UiConversation, id: string) => el.turnElement(id) as HTMLElement;
const answerOf = (el: UiConversation, id: string) => node(el, id).querySelector('ui-ai-answer') as UiAiAnswer;
const click = (n: Element | null | undefined) => (n as HTMLElement).click();

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('logic', () => {
  it('normalizes turns: ids required and unique, unknown roles read as system, the writing row split off', () => {
    const out = normalizeTurns(
      [
        { id: 'a', role: 'user' },
        { role: 'user' },
        { id: 'a', role: 'assistant' },
        { id: 2, role: 'robot' },
        { id: 'p', role: 'pending' },
        null,
      ],
      false,
    );
    expect(out.regular.map((t) => [t.id, t.role])).toEqual([
      ['a', 'user'],
      ['2', 'system'],
    ]);
    expect(out.pending?.id).toBe('p');
    expect(normalizeTurns([], true).pending?.id).toBe(PENDING_KEY);
    expect(normalizeTurns('nope', false)).toEqual({ regular: [], pending: null });
  });

  it('plans a turn list by id: first page, history, live, between, removed, another conversation', () => {
    expect(planTurns([], ['a', 'b'])).toMatchObject({ first: true, reset: false, append: ['a', 'b'] });
    expect(planTurns(['c', 'd'], ['a', 'b', 'c', 'd', 'e'])).toMatchObject({
      first: false,
      prepend: ['a', 'b'],
      append: ['e'],
      insert: [],
      remove: [],
    });
    expect(planTurns(['a', 'c'], ['a', 'b', 'c']).insert).toEqual([['b', 'c']]);
    expect(planTurns(['a', 'b', 'c'], ['a', 'c']).remove).toEqual(['b']);
    expect(planTurns(['a'], ['x', 'y'])).toMatchObject({ first: true, reset: true, remove: ['a'], append: ['x', 'y'] });
  });

  it('measures progress against the estimate', () => {
    expect(progressState({ startedAt: 1000 }, 31_000)).toMatchObject({ elapsed: 30_000, pct: null, over: false });
    expect(progressState({ startedAt: 0, estimateMs: 120_000 }, 60_000)).toMatchObject({ pct: 50, over: false });
    expect(progressState({ startedAt: 0, estimateMs: 120_000 }, 130_000)).toMatchObject({ pct: 99, over: true });
    expect(progressState({ startedAt: 5000, estimateMs: 1000 }, 0).elapsed).toBe(0);
  });

  it('formats times, initials, clocks and the response chip', () => {
    const t = turnTime(AT);
    expect(t?.short).toBe('14:05');
    expect(t?.iso).toBe(new Date(AT).toISOString());
    expect(turnTime(String(AT))?.short).toBe('14:05');
    expect(turnTime('not a date')).toBeNull();
    expect(turnTime(undefined)).toBeNull();
    expect(initialOf('dana')).toBe('D');
    expect(initialOf('  김민지')).toBe('김');
    expect(initialOf('')).toBe('?');
    expect(clockText(0)).toBe('0:00');
    expect(clockText(95_400)).toBe('1:35');
    expect(clockText(3_725_000)).toBe('1:02:05');
    expect(tookText(0)).toBe('');
    expect(tookText(400)).toBe('<1s');
    expect(tookText(42_000)).toBe('42s');
    expect(tookText(65_000)).toBe('1m 5s');
    expect(tookText(7_380_000)).toBe('2h 3m');
    expect(tookText(65_000, 'ko')).toBe('1분 5초');
  });

  it('reads overflow, summaries, sources, clamp lines and signatures', () => {
    expect(clampOverflows(300, 120)).toBe(true);
    expect(clampOverflows(121, 120)).toBe(false);
    expect(summaryLine({ title: ' A ', text: 'b\n c' })).toBe('A — b c');
    expect(summaryText({ title: 'A', text: 'b' })).toBe('A\n\nb');
    expect(summaryText(undefined)).toBe('');
    expect(turnSource({ id: 'x', role: 'assistant', markdown: 'md', source: 'src' })).toBe('src');
    expect(turnSource({ id: 'x', role: 'assistant', markdown: 'md' })).toBe('md');
    expect(clampLinesOf(0)).toBe(12);
    expect(clampLinesOf(3.7)).toBe(3);
    expect(clampLinesOf(999)).toBe(200);
    expect(turnSignature({ ...USER })).toBe(turnSignature(USER));
    const loop: ConversationTurn & { self?: unknown } = { id: 'l', role: 'user' };
    loop.self = loop;
    expect(turnSignature(loop)).not.toBe(turnSignature(loop));
  });

  it('feeds the nested answer: summary heads an empty answer, animate only when live', () => {
    const empty = turnAnswerData({ id: 'x', role: 'assistant', summary: { title: 'T', text: 'S' } }, false);
    expect(empty).toMatchObject({ markdown: '', animate: false, title: 'T — S' });
    expect(empty.responseMs).toBeUndefined();
    const live = turnAnswerData({ ...BOT, streaming: true, error: 'HTTP 500', canRetry: true }, true);
    expect(live).toMatchObject({ streaming: true, error: 'HTTP 500', canRetry: true, animate: true });
    expect(live.title).toBeUndefined();
  });
});

describe('<ui-conversation> rendering', () => {
  it('live passes to the scroller: a polite log by default, a plain region with live: false', () => {
    const on = mount({ turns: [] });
    on.renderNow();
    expect(logOf(on).data?.live).toBeUndefined();
    const off = mount({ turns: [], live: false });
    off.renderNow();
    expect(logOf(off).data?.live).toBe(false);
  });

  it('renders a user turn: initial, name, time, words, skills; media only when the host has some', () => {
    const el = mount({ turns: [USER, { ...USER, id: 'u2', media: true, skills: [] }] });
    const u = node(el, 'u1');
    expect(u.tagName).toBe('ARTICLE');
    expect(u.dataset.role).toBe('user');
    expect(u.querySelector('.cv-av')?.textContent).toBe('D');
    expect(u.querySelector('.cv-name')?.textContent).toBe('dana');
    const time = u.querySelector('time') as HTMLTimeElement;
    expect(time.textContent).toBe('14:05');
    expect(time.getAttribute('datetime')).toBe(new Date(AT).toISOString());
    expect(time.getAttribute('title')).toContain('2026');
    expect(u.querySelector('.cv-text')?.textContent).toBe(USER.text);
    expect((u.querySelector('.cv-more') as HTMLElement).hidden).toBe(true);
    expect(u.querySelector('.skill-badge')?.textContent).toContain('review');
    expect(u.querySelector('slot')).toBeNull();
    expect(node(el, 'u2').querySelector('.cv-media slot')?.getAttribute('name')).toBe('media-u2');
    expect(u.getAttribute('aria-labelledby')?.split(' ').length).toBe(2);
  });

  it('opens a skill chip to its text', () => {
    const el = mount({ turns: [USER] });
    click(q(el, '.skill-badge'));
    expect(q(el, '.skill-badge')?.getAttribute('aria-expanded')).toBe('true');
    expect(q(el, '.skill-pane .skill-text')?.textContent).toBe('Read the diff before you change anything.');
    click(q(el, '.skill-badge'));
    expect(q(el, '.skill-pane')).toBeNull();
  });

  it('renders an assistant turn: glyph avatar, response-time chip, the answer, files slot, Raw', async () => {
    const el = mount({ turns: [{ ...BOT, attachments: true, source: 'Fixed — raw source' }], assistantName: 'Helper' });
    const a = node(el, 'a1');
    expect(a.querySelector('.cv-av svg')?.getAttribute('data-icon')).toBe('bot');
    expect(a.querySelector('.cv-name')?.textContent).toBe('Helper');
    expect(a.querySelector('.cv-took-n')?.textContent).toBe('42s');
    expect(a.querySelector('.cv-took .sr-only')?.textContent).toBe('Responded in 42s');
    const ans = answerOf(el, 'a1');
    expect(ans.hasAttribute('flat')).toBe(true);
    expect(ans.data).toMatchObject({ markdown: BOT.markdown, animate: false });
    ans.renderNow();
    expect(ans.shadowRoot?.querySelector('.ans-body strong')?.textContent).toBe('pins the clock');
    expect(a.querySelector('.cv-files slot')?.getAttribute('name')).toBe('attachments-a1');
    // Raw: closed and empty until asked for; then Source (default) ↔ Summary.
    const raw = a.querySelector('[data-act="raw"]') as HTMLElement;
    expect(raw.getAttribute('aria-expanded')).toBe('false');
    expect(a.querySelector('.cv-region')?.hasAttribute('inert')).toBe(true);
    expect(a.querySelector('.cv-region-in')?.childElementCount).toBe(0);
    click(raw);
    expect(raw.getAttribute('aria-expanded')).toBe('true');
    expect(a.querySelector('.cv-dbox')?.hasAttribute('data-open')).toBe(true);
    expect(a.querySelector('.cv-region')?.hasAttribute('inert')).toBe(false);
    expect(a.querySelector('.cv-rawview')?.getAttribute('data-from')).toBe('source');
    expect(a.querySelector('.raw-text')?.textContent).toBe('Fixed — raw source');
    click(a.querySelector('.cv-tab[data-view="summary"]'));
    expect(a.querySelector('.raw-text')?.textContent).toBe('Pinned the clock\n\nThe test read the wall clock.');
    expect(a.querySelector('.cv-tab[data-view="summary"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows no Raw while the answer streams, and the answer’s loading / error states', () => {
    const el = mount({
      turns: [
        { id: 'a1', role: 'assistant', markdown: 'Half', streaming: true },
        { id: 'a2', role: 'assistant', loading: true },
        { id: 'a3', role: 'assistant', error: 'HTTP 404', canRetry: true },
      ],
    });
    expect(node(el, 'a1').querySelector('[data-act="raw"]')).toBeNull();
    expect(node(el, 'a1').getAttribute('aria-busy')).toBe('true');
    const loading = answerOf(el, 'a2');
    loading.renderNow();
    expect(loading.shadowRoot?.querySelector('.ans-loading')?.textContent).toBe('Loading…');
    const failed = answerOf(el, 'a3');
    failed.renderNow();
    expect(failed.shadowRoot?.querySelector('.ans-error')?.textContent).toContain('HTTP 404');
    expect(failed.shadowRoot?.querySelector('.ans-retry')).not.toBeNull();
  });

  it('renders a system turn as one line that opens to its facts and raw text', () => {
    const el = mount({ turns: [SYS, { id: 's2', role: 'system', kind: 'deploy', text: 'Shipped' }] });
    const s = node(el, 's1');
    expect(s.querySelector('.cv-av svg')?.getAttribute('data-icon')).toBe('gear');
    expect(s.querySelector('.cv-name')?.textContent).toBe('System');
    expect(s.querySelector('.sys-badge')?.getAttribute('data-kind')).toBe('compact');
    expect(s.querySelector('.sys-badge')?.textContent).toBe('Compacted');
    expect(s.querySelector('.cv-line')?.textContent).toBe('Context compacted');
    const row = s.querySelector('button.cv-sys') as HTMLElement;
    expect(row.getAttribute('aria-expanded')).toBe('false');
    click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(Array.from(s.querySelectorAll('.cv-facts dt')).map((d) => d.textContent)).toEqual(['Before', 'After']);
    expect(s.querySelector('.cv-facts dd')?.textContent).toBe('182,400 tokens');
    expect(s.querySelector('.cv-rawview[data-from="raw"] .raw-text')?.textContent).toBe('/compact keep the test plan');
    // Any word is a kind; nothing to open → a plain row.
    const s2 = node(el, 's2');
    expect(s2.querySelector('.sys-badge')?.textContent).toBe('deploy');
    expect(s2.querySelector('button')).toBeNull();
    expect(s2.querySelector('div.cv-sys')).not.toBeNull();
  });

  it('keeps the writing row last and drops it when the answer is done', () => {
    const el = mount({ turns: [USER], pending: true });
    expect(keys(el)).toEqual(['u1', PENDING_KEY]);
    const row = node(el, PENDING_KEY);
    expect(row.dataset.role).toBe('pending');
    expect(row.getAttribute('aria-busy')).toBe('true');
    const ans = answerOf(el, PENDING_KEY);
    expect(ans.data).toMatchObject({ markdown: '', streaming: true });
    ans.renderNow();
    expect(ans.shadowRoot?.querySelector('.ans-writing')?.textContent).toContain('Writing the answer');
    el.data = { turns: [USER, BOT], pending: true };
    el.renderNow();
    expect(keys(el)).toEqual(['u1', 'a1', PENDING_KEY]);
    expect(node(el, PENDING_KEY)).toBe(row);
    el.data = { turns: [USER, BOT] };
    el.renderNow();
    expect(keys(el)).toEqual(['u1', 'a1']);
    // A { role: 'pending' } turn keys by its own id; when that id becomes the answer, the row gives way.
    el.data = { turns: [USER, BOT, { id: 'a2', role: 'pending' }] };
    el.renderNow();
    expect(keys(el)).toEqual(['u1', 'a1', 'a2']);
    expect(node(el, 'a2').dataset.role).toBe('pending');
    el.data = { turns: [USER, BOT, { id: 'a2', role: 'assistant', markdown: 'Done' }] };
    el.renderNow();
    expect(keys(el)).toEqual(['u1', 'a1', 'a2']);
    expect(node(el, 'a2').dataset.role).toBe('assistant');
  });

  it('shows skeleton turns while the first page loads, then the empty text', () => {
    const el = mount({ turns: [], loading: true });
    const log = logOf(el);
    log.renderNow();
    expect(log.shadowRoot?.querySelector<HTMLElement>('.ls-loading')?.hidden).toBe(false);
    expect(qa(el, '.cv-sk .cv-sk-turn').length).toBe(3);
    expect(q(el, '.cv-sk')?.getAttribute('slot')).toBe('loading');
    el.data = { turns: [] };
    el.renderNow();
    log.renderNow();
    expect(log.shadowRoot?.querySelector<HTMLElement>('.ls-empty')?.hidden).toBe(false);
    expect(q(el, '[slot="empty"] .cv-state')?.textContent).toBe('No messages yet');
    el.data = { turns: [], emptyText: 'Ask anything to start' };
    el.renderNow();
    expect(q(el, '[slot="empty"]')?.textContent).toBe('Ask anything to start');
  });

  it('shows an error as the whole box without turns, and as a bar above them', () => {
    const el = mount({ turns: [], error: 'HTTP 502', loading: true });
    const log = logOf(el);
    log.renderNow();
    const box = q(el, '[slot="empty"] .cv-fail') as HTMLElement;
    expect(box.getAttribute('role')).toBe('alert');
    expect(box.textContent).toContain('Couldn’t load the conversation (HTTP 502)');
    expect(box.querySelector('[data-act="retry"]')?.textContent).toBe('Try again');
    expect(log.data?.loading).toBe(false);
    expect(q(el, '.cv-errbar')?.hidden).toBe(true);
    el.data = { turns: [USER], error: 'HTTP 502', canRetry: false };
    el.renderNow();
    const bar = q(el, '.cv-errbar') as HTMLElement;
    expect(bar.hidden).toBe(false);
    expect(bar.textContent).toBe('Couldn’t load some turns (HTTP 502)');
    expect(bar.querySelector('button')).toBeNull();
    el.data = { turns: [USER] };
    el.renderNow();
    expect(bar.hidden).toBe(true);
  });
});

describe('<ui-conversation> escaping', () => {
  it('escapes every user and model string', () => {
    const el = mount({
      turns: [
        {
          id: `u${X}`,
          role: 'user',
          name: X,
          text: X,
          media: true,
          skills: [{ name: X, text: X }],
        },
        {
          id: 'a1',
          role: 'assistant',
          name: X,
          markdown: X,
          source: X,
          summary: { title: X, text: X },
          attachments: true,
          linkTitles: { 'https://x.dev': X },
        },
        { id: 'a2', role: 'assistant', error: X, canRetry: true, summary: { title: X } },
        { id: 's1', role: 'system', name: X, kind: X, text: X, facts: [[X, X]], raw: X },
        { id: 's2', role: 'system', label: X, progress: { startedAt: Date.now(), verb: X } },
      ],
      label: X,
      assistantName: X,
      error: X,
    });
    click(q(el, '.skill-badge'));
    click(node(el, 'a1').querySelector('[data-act="raw"]'));
    click(node(el, 's1').querySelector('[data-act="sys"]'));
    const root = sr(el);
    expect(root.querySelectorAll('img').length).toBe(0);
    for (const a of Array.from(root.querySelectorAll<UiAiAnswer>('ui-ai-answer'))) {
      a.renderNow();
      expect(a.shadowRoot?.querySelectorAll('img').length).toBe(0);
    }
    const u = node(el, `u${X}`);
    expect(u.querySelector('.cv-name')?.textContent).toBe(X);
    expect(u.querySelector('.cv-text')?.textContent).toBe(X);
    expect(u.querySelector('.skill-text')?.textContent).toBe(X);
    expect(u.querySelector('.cv-media slot')?.getAttribute('name')).toBe(`media-u${X}`);
    expect(node(el, 'a1').querySelector('.raw-text')?.textContent).toBe(X);
    expect(answerOf(el, 'a1').shadowRoot?.querySelector('.ans-body')?.textContent).toContain(X);
    expect(answerOf(el, 'a2').shadowRoot?.textContent).toContain(X);
    const s = node(el, 's1');
    expect(s.querySelector('.cv-name')?.textContent).toBe(X);
    expect(s.querySelector('.sys-badge')?.textContent).toBe(X);
    expect(s.querySelector('.sys-badge')?.getAttribute('data-kind')).toBe(X);
    expect(s.querySelector('.cv-line')?.textContent).toBe(X);
    expect(s.querySelector('.cv-facts dt')?.textContent).toBe(X);
    expect(s.querySelector('.cv-facts dd')?.textContent).toBe(X);
    expect(s.querySelector('.raw-text')?.textContent).toBe(X);
    const p = node(el, 's2');
    expect(p.querySelector('.sys-badge')?.textContent).toBe(X);
    expect(p.querySelector('.cv-prog')?.getAttribute('aria-label')).toBe(X);
    expect(p.querySelector('.cv-prog-verb')?.textContent).toBe(X);
    expect(q(el, '.cv-errbar')?.textContent).toContain(X);
    expect(logOf(el).data?.label).toBe(X);
  });

  it('escapes the empty text and the whole-box error', () => {
    const a = mount({ turns: [], emptyText: X });
    expect(q(a, '[slot="empty"]')?.textContent).toBe(X);
    const b = mount({ turns: [], error: X });
    expect(q(b, '.cv-fail')?.textContent).toContain(X);
    expect(sr(a).querySelectorAll('img').length + sr(b).querySelectorAll('img').length).toBe(0);
  });
});

describe('<ui-conversation> keyed updates', () => {
  it('rebuilds only the turn whose data changed and carries its answer over', () => {
    const el = mount({ turns: [USER, BOT, SYS] });
    const before = { u1: node(el, 'u1'), a1: node(el, 'a1'), s1: node(el, 's1') };
    const answer = answerOf(el, 'a1');
    const upsert = vi.spyOn(logOf(el), 'upsertItem');
    // Equal data in new objects: nothing moves.
    el.data = { turns: [{ ...USER }, { ...BOT }, { ...SYS }] };
    el.renderNow();
    expect(upsert).not.toHaveBeenCalled();
    expect(node(el, 'u1')).toBe(before.u1);
    // One turn changed: only that node is new; its <ui-ai-answer> is the same element with the new text.
    el.data = { turns: [{ ...USER }, { ...BOT, markdown: 'Fixed, and added a regression test.' }, { ...SYS }] };
    el.renderNow();
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toBe('a1');
    expect(node(el, 'u1')).toBe(before.u1);
    expect(node(el, 's1')).toBe(before.s1);
    expect(node(el, 'a1')).not.toBe(before.a1);
    expect(answerOf(el, 'a1')).toBe(answer);
    expect(answer.data?.markdown).toBe('Fixed, and added a regression test.');
    expect(keys(el)).toEqual(['u1', 'a1', 's1']);
  });

  it('keeps what the reader opened and the focused control across a rebuild', () => {
    const el = mount({ turns: [USER, BOT] });
    const toggle = node(el, 'a1').querySelector('[data-act="raw"]') as HTMLElement;
    click(toggle);
    toggle.focus();
    el.data = { turns: [USER, { ...BOT, responseMs: 50_000 }] };
    el.renderNow();
    const fresh = node(el, 'a1').querySelector('[data-act="raw"]') as HTMLElement;
    expect(fresh).not.toBe(toggle);
    expect(fresh.getAttribute('aria-expanded')).toBe('true');
    expect(node(el, 'a1').querySelector('.raw-text')).not.toBeNull();
    expect(sr(el).activeElement).toBe(fresh);
  });

  it('prepends history without motion and appends live turns with it', () => {
    const el = mount({ turns: [USER, BOT], hasMore: true });
    const log = logOf(el);
    const prepend = vi.spyOn(log, 'prependItems');
    const append = vi.spyOn(log, 'appendItems');
    const older: ConversationTurn[] = [
      { id: 'u0', role: 'user', text: 'Earlier question' },
      { id: 'a0', role: 'assistant', markdown: 'Earlier answer' },
    ];
    el.data = { turns: [...older, USER, BOT], hasMore: false };
    el.renderNow();
    expect(prepend).toHaveBeenCalledTimes(1);
    expect((prepend.mock.calls[0][0] as HTMLElement[]).map((n) => n.dataset.item)).toEqual(['u0', 'a0']);
    expect(prepend.mock.calls[0][1]).toEqual({ hasMore: false });
    expect(append).not.toHaveBeenCalled();
    expect(keys(el)).toEqual(['u0', 'a0', 'u1', 'a1']);
    expect(node(el, 'u0').hasAttribute('data-ls-enter')).toBe(false);
    expect(answerOf(el, 'a0').data?.animate).toBe(false);

    el.data = {
      turns: [
        ...older,
        USER,
        BOT,
        { id: 'u2', role: 'user', text: 'Next' },
        { id: 'a2', role: 'assistant', markdown: 'Sure' },
      ],
    };
    el.renderNow();
    expect(append).toHaveBeenCalledTimes(1);
    expect(append.mock.calls[0][1]).toEqual({ animate: true });
    expect(keys(el)).toEqual(['u0', 'a0', 'u1', 'a1', 'u2', 'a2']);
    expect(node(el, 'a2').hasAttribute('data-ls-enter')).toBe(true);
    expect(answerOf(el, 'a2').data?.animate).toBe(true);
  });

  it('removes turns that went away, inserts between kept ones, and starts over for another conversation', () => {
    const el = mount({ turns: [USER, BOT, SYS] });
    const log = logOf(el);
    el.data = { turns: [USER, SYS] };
    el.renderNow();
    expect(keys(el)).toEqual(['u1', 's1']);
    el.data = { turns: [USER, BOT, SYS] };
    el.renderNow();
    expect(keys(el)).toEqual(['u1', 'a1', 's1']);
    const clear = vi.spyOn(log, 'clearItems');
    el.data = { turns: [{ id: 'x1', role: 'user', text: 'Other chat' }] };
    el.renderNow();
    expect(clear).toHaveBeenCalledTimes(1);
    expect(keys(el)).toEqual(['x1']);
  });
});

describe('<ui-conversation> events', () => {
  it('sends ui-retry with id null from the error bar and the error box', () => {
    const el = mount({ turns: [USER], error: 'HTTP 500' });
    const seen: Array<CustomEvent> = [];
    el.addEventListener('ui-retry', (e) => seen.push(e as CustomEvent));
    click(q(el, '.cv-errbar [data-act="retry"]'));
    el.data = { turns: [], error: 'HTTP 500' };
    el.renderNow();
    click(q(el, '.cv-fail [data-act="retry"]'));
    expect(seen.map((e) => e.detail)).toEqual([{ id: null }, { id: null }]);
    expect(seen[0].bubbles && seen[0].composed && seen[0].cancelable).toBe(true);
  });

  it('turns a nested answer’s Try again into ui-retry with the turn id (cancelable through)', () => {
    const el = mount({ turns: [{ id: 'a9', role: 'assistant', error: 'HTTP 404', canRetry: true }] });
    const ans = answerOf(el, 'a9');
    ans.renderNow();
    const seen: unknown[] = [];
    el.addEventListener('ui-retry', (e) => {
      seen.push((e as CustomEvent).detail);
      e.preventDefault();
    });
    let inner: Event | null = null;
    ans.addEventListener('ui-retry', (e) => {
      inner = e;
    });
    click(ans.shadowRoot?.querySelector('.ans-retry'));
    expect(seen).toEqual([{ id: 'a9' }]);
    expect((inner as Event | null)?.defaultPrevented).toBe(true);
  });

  it('copies Raw text and the answer, reporting ui-copy with the turn id', async () => {
    vi.useFakeTimers();
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const el = mount({ turns: [{ ...BOT, source: 'raw **source**' }, SYS] });
    const seen: CustomEvent[] = [];
    el.addEventListener('ui-copy', (e) => seen.push(e as CustomEvent));
    const a = node(el, 'a1');
    click(a.querySelector('[data-act="raw"]'));
    click(a.querySelector('.raw-copy'));
    await vi.waitFor(() => expect(seen.length).toBe(1));
    expect(write).toHaveBeenCalledWith('raw **source**');
    expect(seen[0].detail).toEqual({ id: 'a1', text: 'raw **source**', from: 'source' });
    expect(seen[0].cancelable).toBe(false);
    expect(a.querySelector('.raw-copy')?.hasAttribute('data-copied')).toBe(true);
    expect(a.querySelector('.raw-copy')?.textContent).toBe('Copied');
    vi.advanceTimersByTime(CONVERSATION_COPIED_MS);
    expect(a.querySelector('.raw-copy')?.hasAttribute('data-copied')).toBe(false);

    click(node(el, 's1').querySelector('[data-act="sys"]'));
    click(node(el, 's1').querySelector('.raw-copy'));
    await vi.waitFor(() => expect(seen.length).toBe(2));
    expect(seen[1].detail).toEqual({ id: 's1', text: '/compact keep the test plan', from: 'raw' });

    const ans = answerOf(el, 'a1');
    ans.renderNow();
    click(ans.shadowRoot?.querySelector('.ans-copy'));
    expect(seen.length).toBe(3);
    expect(seen[2].detail).toMatchObject({ id: 'a1', from: 'answer' });
    expect(seen[2].detail.text).toContain('pins the clock');
  });

  it('passes ui-load-older through from the scroller (cancelable)', () => {
    const el = mount({ turns: [USER, BOT], hasMore: true });
    const log = logOf(el);
    log.renderNow();
    const seen: CustomEvent[] = [];
    const targets: unknown[] = [];
    el.addEventListener('ui-load-older', (e) => {
      seen.push(e as CustomEvent);
      targets.push(e.target);
    });
    click(log.shadowRoot?.querySelector('.ls-older'));
    expect(seen.length).toBe(1);
    expect(seen[0].detail).toEqual({ oldest: 'u1' });
    expect(seen[0].bubbles && seen[0].composed).toBe(true);
    expect(targets[0]).toBe(el);
    // Cancelled by the host: the scroller does not show Loading older….
    const el2 = mount({ turns: [USER], hasMore: true });
    const log2 = logOf(el2);
    log2.renderNow();
    el2.addEventListener('ui-load-older', (e) => e.preventDefault());
    click(log2.shadowRoot?.querySelector('.ls-older'));
    expect(log2.shadowRoot?.querySelector('.ls-older')?.getAttribute('aria-busy')).toBeNull();
    expect(log.shadowRoot?.querySelector('.ls-older')?.getAttribute('aria-busy')).toBe('true');
  });

  it('clamps a long instruction with Show more / Show less only when it overflows', () => {
    vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) {
      return this.classList.contains('cv-text') && (this.textContent ?? '').length > 100 ? 600 : 100;
    });
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100);
    const long = { id: 'u5', role: 'user' as const, text: 'Step. '.repeat(60) };
    const el = mount({ turns: [USER, long], clampLines: 6 });
    expect((node(el, 'u1').querySelector('.cv-more') as HTMLElement).hidden).toBe(true);
    const text = node(el, 'u5').querySelector('.cv-text') as HTMLElement;
    const more = node(el, 'u5').querySelector('.cv-more') as HTMLElement;
    expect(text.getAttribute('style')).toContain('--cv-clamp:6');
    expect(more.hidden).toBe(false);
    expect(more.textContent).toBe('Show more');
    expect(more.getAttribute('aria-controls')).toBe(text.id);
    click(more);
    expect(text.classList.contains('is-full')).toBe(true);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(more.textContent).toBe('Show less');
    click(more);
    expect(text.classList.contains('is-full')).toBe(false);
    expect(more.textContent).toBe('Show more');
    expect(more.hidden).toBe(false);
  });
});

describe('<ui-conversation> keyboard', () => {
  it('Escape closes the open Raw or system detail and returns focus to its toggle', () => {
    const el = mount({ turns: [BOT, SYS] });
    const a = node(el, 'a1');
    const toggle = a.querySelector('[data-act="raw"]') as HTMLElement;
    click(toggle);
    const copy = a.querySelector('.raw-copy') as HTMLElement;
    copy.focus();
    copy.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(a.querySelector('.cv-dbox')?.hasAttribute('data-open')).toBe(false);
    expect(a.querySelector('.cv-region')?.hasAttribute('inert')).toBe(true);
    expect(sr(el).activeElement).toBe(toggle);

    const row = node(el, 's1').querySelector('[data-act="sys"]') as HTMLElement;
    click(row);
    row.focus();
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    expect(row.getAttribute('aria-expanded')).toBe('false');
  });

  it('every control is a real button with its state', () => {
    const el = mount({ turns: [USER, BOT, SYS] });
    for (const b of qa(el, '[data-act="raw"], [data-act="sys"], .cv-more')) {
      expect(b.tagName).toBe('BUTTON');
      expect(b.getAttribute('type')).toBe('button');
      expect(b.hasAttribute('aria-expanded')).toBe(true);
      expect(sr(el).getElementById(b.getAttribute('aria-controls') ?? '')).not.toBeNull();
    }
  });
});

describe('<ui-conversation> lang="ko"', () => {
  it('speaks Korean everywhere it speaks', () => {
    const el = mount(
      { turns: [{ ...USER, name: '' }, BOT, SYS, { id: 'a3', role: 'assistant', responseMs: 65_000, markdown: 'x' }] },
      { lang: 'ko' },
    );
    expect(node(el, 'u1').querySelector('.cv-name')?.textContent).toBe('사용자');
    expect(node(el, 'a1').querySelector('.cv-name')?.textContent).toBe('어시스턴트');
    expect(node(el, 's1').querySelector('.cv-name')?.textContent).toBe('시스템');
    expect(node(el, 's1').querySelector('.sys-badge')?.textContent).toBe('압축');
    expect(node(el, 'a1').querySelector('[data-act="raw"]')?.textContent).toBe('원본');
    expect(node(el, 'a3').querySelector('.cv-took-n')?.textContent).toBe('1분 5초');
    expect(node(el, 'a3').querySelector('.cv-took .sr-only')?.textContent).toBe('응답 1분 5초');
    expect(node(el, 'u1').querySelector('.cv-more')?.textContent).toBe('더 보기');
    expect(answerOf(el, 'a1').getAttribute('lang')).toBe('ko');
    expect(logOf(el).getAttribute('lang')).toBe('ko');
    expect(logOf(el).data?.label).toBe('대화');
    expect(logOf(el).data?.startText).toBe('대화의 시작');
    click(node(el, 'a1').querySelector('[data-act="raw"]'));
    expect(Array.from(node(el, 'a1').querySelectorAll('.cv-tab')).map((b) => b.textContent)).toEqual(['요약', '원문']);
  });

  it('switches language in place', () => {
    const el = mount({ turns: [], error: 'HTTP 500' });
    expect(q(el, '.cv-fail')?.textContent).toContain('Try again');
    el.setAttribute('lang', 'ko');
    el.renderNow();
    expect(q(el, '.cv-fail')?.textContent).toContain('대화를 불러오지 못했습니다');
    expect(q(el, '.cv-fail')?.textContent).toContain('다시 시도');
    el.data = { turns: [USER], error: 'HTTP 500' };
    el.renderNow();
    expect(q(el, '.cv-errbar .cv-err-text')?.textContent).toBe('일부 대화를 불러오지 못했습니다 (HTTP 500)');
    el.data = { turns: [] };
    el.renderNow();
    expect(q(el, '[slot="empty"]')?.textContent).toBe('아직 메시지가 없습니다');
  });
});

describe('<ui-conversation> progress', () => {
  const T0 = new Date(2026, 9, 30, 15, 0, 0).getTime();
  const running = (p: Partial<ConversationTurn['progress']> = {}): ConversationTurn => ({
    id: 'c1',
    role: 'system',
    kind: 'compact',
    at: T0 - 30_000,
    progress: { startedAt: T0 - 30_000, estimateMs: 120_000, ...p },
  });

  it('ticks elapsed time and percent in place, then sweeps past the estimate', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const el = mount({ turns: [running()] });
    const turn = node(el, 'c1');
    const prog = turn.querySelector('.cv-prog') as HTMLElement;
    expect(prog.getAttribute('role')).toBe('progressbar');
    expect(turn.querySelector('.cv-prog-verb')?.textContent).toBe('Compacting…');
    const elapsed = turn.querySelector('.cv-elapsed') as HTMLElement;
    const textNode = elapsed.firstChild;
    expect(elapsed.textContent).toBe('0:30');
    expect(turn.querySelector('.cv-est')?.textContent).toBe('/ ~2:00');
    expect(turn.querySelector('.cv-pct')?.textContent).toBe('25%');
    expect(prog.getAttribute('aria-valuenow')).toBe('25');
    vi.advanceTimersByTime(5000);
    expect(node(el, 'c1')).toBe(turn);
    expect(elapsed.firstChild).toBe(textNode);
    expect(textNode?.nodeValue).toBe('0:35');
    expect(turn.querySelector('.cv-pct')?.textContent).toBe('29%');
    expect((turn.querySelector('.cv-bar > i') as HTMLElement).style.width).toBe('29%');
    vi.advanceTimersByTime(100_000);
    expect(textNode?.nodeValue).toBe('2:15');
    expect(turn.querySelector('.cv-bar')?.hasAttribute('data-indet')).toBe(true);
    expect((turn.querySelector('.cv-over') as HTMLElement).hidden).toBe(false);
    expect((turn.querySelector('.cv-pct') as HTMLElement).hidden).toBe(true);
    expect(prog.hasAttribute('aria-valuenow')).toBe(false);
    expect(prog.getAttribute('aria-valuetext')).toContain('Taking longer than expected');
  });

  it('reads the host clock, has no percent without an estimate, and stops when done', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const el = mount({ turns: [running({ estimateMs: 0, verb: 'Restarting…' })], now: T0 + 10_000 });
    const turn = node(el, 'c1');
    expect(turn.querySelector('.cv-elapsed')?.textContent).toBe('0:40');
    expect(turn.querySelector('.cv-est')).toBeNull();
    expect((turn.querySelector('.cv-pct') as HTMLElement).hidden).toBe(true);
    expect(turn.querySelector('.cv-bar')?.hasAttribute('data-indet')).toBe(true);
    expect(turn.querySelector('.cv-prog-verb')?.textContent).toBe('Restarting…');
    el.data = { turns: [running({ done: true })] };
    el.renderNow();
    const done = node(el, 'c1');
    expect(done.querySelector('.cv-prog')).toBeNull();
    expect(done.querySelector('.cv-line')?.textContent).toBe('Done');
    vi.advanceTimersByTime(3000);
    expect(done.querySelector('.cv-prog')).toBeNull();
  });

  it('stops ticking when disconnected', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const el = mount({ turns: [running()] });
    const elapsed = node(el, 'c1').querySelector('.cv-elapsed') as HTMLElement;
    el.remove();
    vi.advanceTimersByTime(4000);
    expect(elapsed.textContent).toBe('0:30');
  });
});

describe('docs', () => {
  it('builds every demo without the network', async () => {
    vi.useFakeTimers();
    const { doc } = await import('./docs');
    expect(doc.tag).toBe('ui-conversation');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const demo of doc.demos) {
      const el = demo.create();
      document.body.append(el);
      expect(el).toBeInstanceOf(HTMLElement);
    }
    const live = document.querySelector('ui-conversation') as UiConversation;
    live.renderNow();
    expect(logOf(live).items.length).toBeGreaterThan(3);
    vi.advanceTimersByTime(6000);
    live.renderNow();
    expect(keys(live)).toContain('a-23');
    vi.clearAllTimers();
  });
});
