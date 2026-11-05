import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fmtDurationKo } from '../../core/format';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import {
  type AgentInboxData,
  ATTENTION_BEAT_MS,
  agentDots,
  artifactKind,
  BOARD_HOLD_MS,
  boardCounts,
  columnsByStatus,
  holdLanes,
  type InboxCard,
  type InboxStringOverrides,
  placeHolds,
  statusTone,
  type UiAgentInbox,
} from './agent-inbox';
import { styles as monoStyles } from './styles';

const NOW = Date.UTC(2026, 9, 27, 9, 0, 0);
const MIN = 60_000;

function mount(data: AgentInboxData | undefined, attrs: Record<string, string> = {}): UiAgentInbox {
  const el = document.createElement('ui-agent-inbox');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = (el: UiAgentInbox, s: string) => el.shadowRoot!.querySelector<HTMLElement>(s);
const qa = (el: UiAgentInbox, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const card = (el: UiAgentInbox, id: string) => q(el, `li.ib-card[data-card="${id}"]`)!;
const colOf = (el: UiAgentInbox, id: string) => card(el, id)?.closest('section')?.getAttribute('data-col');
const key = (target: Element, k: string, init: KeyboardEventInit = {}) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init }),
  );

const WAIT: InboxCard = {
  id: 'migrate',
  title: 'Migrate users table',
  summary: 'Wants to run it on production.',
  status: 'waiting',
  since: NOW - 6 * MIN,
  details: ['Dry run on staging – no errors', 'Wants to run it on production'],
  actions: [{ id: 'reject', label: 'Reject' }],
  primary: { id: 'approve', label: 'Approve' },
};
const RUN: InboxCard = {
  id: 'notes',
  title: 'Release notes v2.4',
  status: 'running',
  since: NOW - 3 * MIN - 49_000,
  task: { id: 'T3', label: 'Drafting the highlights', startedAt: NOW - 58_000 },
  agents: { total: 40, running: 2, done: 37, failed: 1 },
  tokens: 35_129_938,
  costUsd: 61.33,
  artifacts: ['a.png', 'b.html', 'c.md', 'd.pdf', 'e.txt', 'f.bin'],
  steps: { done: 0, total: 4 },
  contextPct: 72,
};
const DONE: InboxCard = {
  id: 'digest',
  title: 'Weekly metrics digest',
  status: 'done',
  since: NOW - 13 * 60 * MIN,
  elapsedMs: 4 * MIN + 12_000,
};
const board = (...cards: InboxCard[]): AgentInboxData => ({ columns: columnsByStatus(cards) });

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('pure helpers', () => {
  it('holds a card whose column changed until the deadline, then lets it go', () => {
    const first = holdLanes({ a: 'done' }, { a: 'running' }, {}, 1000, true);
    expect(first.lanes.a).toBe('running');
    expect(first.holds.a).toEqual({ from: 'running', to: 'done', until: 1000 + BOARD_HOLD_MS });
    expect(first.wakeAt).toBe(1000 + BOARD_HOLD_MS);
    // A new target keeps the first deadline.
    const retarget = holdLanes({ a: 'needs' }, { a: 'running' }, first.holds, 1500, true);
    expect(retarget.lanes.a).toBe('running');
    expect(retarget.holds.a.until).toBe(1000 + BOARD_HOLD_MS);
    // Past the deadline it moves.
    const late = holdLanes({ a: 'done' }, { a: 'running' }, first.holds, 1000 + BOARD_HOLD_MS, true);
    expect(late.lanes.a).toBe('done');
    expect(late.wakeAt).toBe(0);
  });

  it('drops the hold when the data returns, and never holds without motion or for a new card', () => {
    const h = holdLanes({ a: 'done' }, { a: 'running' }, {}, 0, true).holds;
    expect(holdLanes({ a: 'running' }, { a: 'running' }, h, 10, true).holds).toEqual({});
    expect(holdLanes({ a: 'done' }, { a: 'running' }, {}, 0, false).lanes.a).toBe('done');
    expect(holdLanes({ b: 'done' }, {}, {}, 0, true).lanes.b).toBe('done');
  });

  it('puts held cards back at their place, keeping the order of cards that leave together', () => {
    const r = placeHolds({ x: [], y: ['a', 'b'], z: ['q'] }, { a: 'x', b: 'x', q: 'z' }, { x: ['a', 'b', 'c'] });
    expect(r.slots.x).toEqual(['a', 'b']);
    expect(r.slots.y).toEqual([]);
    const withC = placeHolds({ x: ['c'], y: ['a', 'b'] }, { a: 'x', b: 'x', c: 'x' }, { x: ['a', 'b', 'c'] });
    expect(withC.slots.x).toEqual(['a', 'b', 'c']);
    const gone = placeHolds({ y: ['a'] }, { a: 'x' }, {});
    expect(gone.slots.y).toEqual(['a']);
    expect(gone.dropped).toEqual(['a']);
  });

  it('maps status to tone, extension to glyph, counts to dots', () => {
    expect(['waiting', 'running', 'done', 'failed', 'idle'].map((s) => statusTone(s as never))).toEqual([
      'wait',
      'run',
      'done',
      'fail',
      'rest',
    ]);
    expect(['x.PNG', 'r.html', 'n.md', 'p.pdf', 'v.mp4', 'l.log', 'z', 'a.zip'].map(artifactKind)).toEqual([
      'image',
      'html',
      'markdown',
      'pdf',
      'video',
      'text',
      'file',
      'file',
    ]);
    expect(agentDots({ total: 40, running: 2, failed: 1, done: 37 })).toEqual({
      dots: ['running', 'running', 'failed', 'done', 'done', 'done'],
      more: 34,
    });
    expect(agentDots({ total: 3, done: 1 }).dots).toEqual(['done', 'unknown', 'unknown']);
    expect(agentDots({ total: 0 })).toEqual({ dots: [], more: 0 });
  });

  it('counts what needs the person and what runs, once per card', () => {
    const cols = columnsByStatus([WAIT, RUN, DONE, { id: 'f', title: 'F', status: 'failed' }]);
    expect(cols.map((c) => [c.id, c.cards.map((x) => x.id)])).toEqual([
      ['needs-you', ['migrate', 'f']],
      ['running', ['notes']],
      ['done', ['digest']],
    ]);
    expect(boardCounts([...cols, { id: 'dup', label: 'Dup', cards: [RUN] }])).toEqual({ needs: 2, running: 1 });
    expect(columnsByStatus([], 'ko').map((c) => c.label)).toEqual(['응답 필요', '실행 중', '완료']);
  });
});

describe('<ui-agent-inbox>', () => {
  it('draws each column as a section labelled by its name and count, with an empty text', () => {
    const el = mount(board(WAIT, RUN));
    const sections = qa(el, 'section.ib-col');
    expect(sections.map((s) => s.getAttribute('data-col'))).toEqual(['needs-you', 'running', 'done']);
    const [nameId, countId] = sections[0].getAttribute('aria-labelledby')!.split(' ');
    expect(el.shadowRoot!.getElementById(nameId)?.textContent).toBe('Needs you');
    expect(el.shadowRoot!.getElementById(countId)?.textContent).toBe('1');
    expect(q(el, '[data-col="done"] .ib-empty')?.textContent).toBe('Nothing here');
    expect(q(el, '[data-col="done"] .ib-empty')?.hidden).toBe(false);
    expect(q(el, '[data-col="running"] .ib-empty')?.hidden).toBe(true);
    el.data = { columns: [{ id: 'x', label: 'Queue', emptyText: 'No runs yet', cards: [] }] };
    el.renderNow();
    expect(qa(el, 'section.ib-col')).toHaveLength(1);
    expect(q(el, '.ib-empty')?.textContent).toBe('No runs yet');
  });

  it('a column head is its name and count — no decorative sparkle before the name (0.21.0)', () => {
    const el = mount(board(WAIT, RUN));
    for (const head of qa(el, '.ib-col-head')) {
      expect(Array.from(head.children).map((c) => c.className)).toEqual(['ib-col-name', 'ib-count']);
      expect(head.querySelector('svg')).toBeNull();
    }
  });

  it('renders the face: task, sub-agents, tokens · cost, files, status tag with a live clock, metrics', () => {
    const el = mount(board(RUN, DONE));
    const c = card(el, 'notes');
    expect(c.getAttribute('data-status')).toBe('running');
    expect(c.querySelector('.ib-title')?.textContent).toBe('Release notes v2.4');
    expect(c.querySelector('.ib-task')?.textContent).toBe('#T3Drafting the highlights58s');
    expect(c.querySelector('.ib-agents-text')?.textContent).toBe('Sub-agents 40 · running 2 · failed 1');
    expect(c.querySelectorAll('.ib-adot')).toHaveLength(6);
    expect(c.querySelector('.ib-dots-more')?.textContent).toBe('+34');
    expect(c.querySelector('.ib-usage')?.textContent).toBe('35,129,938tok·$61.33');
    expect(c.querySelectorAll('.ib-chip')).toHaveLength(4);
    expect(c.querySelector('.ib-arts-n')?.textContent).toBe('6');
    expect(c.querySelector('.ib-arts-more')?.textContent).toBe('+2');
    expect(c.querySelector('.ib-tag')?.getAttribute('data-tone')).toBe('run');
    expect(c.querySelector('.ib-tag')?.textContent).toBe('Running · 3m 49s');
    expect(c.querySelector('.ib-spin')).not.toBeNull();
    expect(c.querySelector('.ib-metrics')?.textContent).toBe('0/472%');
    expect(c.querySelector('.ib-metric.is-warn')).not.toBeNull();
    // The clock ticks in place, once a second.
    vi.advanceTimersByTime(2000);
    expect(c.querySelector('.ib-tag')?.textContent).toBe('Running · 3m 51s');
    const d = card(el, 'digest');
    expect(d.querySelector('.ib-tag')?.getAttribute('data-tone')).toBe('done');
    expect(d.querySelector('.ib-tag')?.textContent).toBe('Done in 4m 12s13h ago');
  });

  it('shows only what the data carries', () => {
    const el = mount(board({ id: 'bare', title: 'Bare', status: 'running' }));
    const c = card(el, 'bare');
    expect(c.querySelector('.ib-tag')?.textContent).toBe('Running');
    expect(c.querySelector('[data-clock]')).toBeNull();
    for (const s of ['.ib-summary', '.ib-task', '.ib-agents', '.ib-usage', '.ib-arts', '.ib-metrics'])
      expect(c.querySelector(s)).toBeNull();
    const zero = mount(board({ id: 'z', title: 'Z', status: 'done', tokens: 0, costUsd: 0 }));
    expect(card(zero, 'z').querySelector('.ib-usage')?.textContent).toBe('0tok·$0.00');
    expect(card(zero, 'z').querySelector('.ib-tag')?.textContent).toBe('Done');
  });

  it('escapes every user and model string', () => {
    const X = '<img src=x onerror=alert(1)>';
    const el = mount({
      columns: [
        {
          id: X,
          label: X,
          emptyText: X,
          cards: [
            {
              id: X,
              title: X,
              summary: X,
              status: 'idle',
              statusText: X,
              since: NOW - MIN,
              task: { id: X, label: X, elapsedMs: 1000 },
              artifacts: [X, `${X}.png`],
              model: X,
              details: [X, { label: X, meta: X }],
              actions: [{ id: X, label: X, disabled: X }],
              primary: { id: `${X}p`, label: X },
            },
          ],
        },
        { id: 'empty', label: 'Empty', emptyText: X, cards: [] },
      ],
      expanded: [X],
      openLabel: X,
    });
    expect(q(el, 'img')).toBeNull();
    expect(q(el, '[onerror]')).toBeNull();
    const c = q(el, 'li.ib-card')!;
    expect(c.getAttribute('data-card')).toBe(X);
    expect(c.querySelector('.ib-title')?.textContent).toBe(X);
    expect(c.querySelector('.ib-title')?.innerHTML).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(c.querySelector('.ib-summary')?.textContent).toBe(X);
    expect(c.querySelector('.ib-tag-text')?.textContent).toContain(X);
    expect(c.querySelector('.ib-task')?.textContent).toContain(`#${X}`);
    expect(c.querySelector('.ib-chip')?.getAttribute('title')).toBe(X);
    expect(c.querySelector('.ib-model')?.textContent).toBe(X);
    expect(qa(el, '.ib-step-text').map((s) => s.textContent)).toEqual([X, X]);
    expect(c.querySelector('.ib-step-meta')?.textContent).toBe(X);
    const act = c.querySelector('[data-act]')!;
    expect(act.getAttribute('data-act')).toBe(X);
    expect(act.getAttribute('title')).toBe(X);
    expect(c.querySelector('[data-open]')?.textContent).toBe(X);
    expect(q(el, '.ib-col-name')?.textContent).toBe(X);
    expect(q(el, '[data-col="empty"] .ib-empty')?.textContent).toBe(X);
  });

  it('opens a card in place on click and says so (ui-toggle); a prevented toggle stays put', () => {
    const el = mount(board(WAIT));
    const fired = vi.fn();
    el.addEventListener('ui-toggle', (e) => fired((e as CustomEvent).detail));
    const c = card(el, 'migrate');
    const face = c.querySelector<HTMLElement>('.ib-face')!;
    const expand = c.querySelector<HTMLElement>('.ib-expand')!;
    expect(face.getAttribute('role')).toBe('button');
    expect(face.getAttribute('aria-controls')).toBe(expand.id);
    expect(face.getAttribute('aria-expanded')).toBe('false');
    expect(expand.hasAttribute('inert')).toBe(true);
    face.click();
    expect(fired).toHaveBeenLastCalledWith({ cardId: 'migrate', expanded: true });
    expect(face.getAttribute('aria-expanded')).toBe('true');
    expect(expand.hasAttribute('inert')).toBe(false);
    expect(c.classList.contains('is-open')).toBe(true);
    // A data render keeps it open and keeps the node.
    el.data = board({ ...WAIT, summary: 'Still waiting.' });
    el.renderNow();
    expect(card(el, 'migrate')).toBe(c);
    expect(c.classList.contains('is-open')).toBe(true);
    el.addEventListener('ui-toggle', (e) => e.preventDefault(), { once: true });
    face.click();
    expect(c.classList.contains('is-open')).toBe(true);
  });

  it('sends ui-action for the primary and secondary actions, ui-open for Open, nothing for a disabled action', () => {
    const el = mount({
      columns: columnsByStatus([WAIT, { ...RUN, actions: [{ id: 'stop', label: 'Stop', disabled: 'Not your run' }] }]),
      expanded: ['migrate', 'notes'],
    });
    const acts: unknown[] = [];
    const opens: unknown[] = [];
    el.addEventListener('ui-action', (e) => acts.push((e as CustomEvent).detail));
    el.addEventListener('ui-open', (e) => opens.push((e as CustomEvent).detail));
    card(el, 'migrate').querySelector<HTMLElement>('[data-act="approve"]')!.click();
    card(el, 'migrate').querySelector<HTMLElement>('[data-act="reject"]')!.click();
    card(el, 'migrate').querySelector<HTMLElement>('[data-open]')!.click();
    const stop = card(el, 'notes').querySelector<HTMLElement>('[data-act="stop"]')!;
    expect(stop.getAttribute('aria-disabled')).toBe('true');
    expect(stop.textContent).toBe('Stop — Not your run');
    stop.click();
    expect(acts).toEqual([
      { cardId: 'migrate', actionId: 'approve' },
      { cardId: 'migrate', actionId: 'reject' },
    ]);
    expect(opens).toEqual([{ cardId: 'migrate' }]);
  });

  it('gives each open card one ink button: the live decision, else Open', () => {
    const el = mount({
      columns: columnsByStatus([
        WAIT,
        RUN,
        { ...DONE, primary: { id: 'approve', label: 'Approve', disabled: 'Only the requester can approve' } },
      ]),
    });
    const ink = (id: string) => Array.from(card(el, id).querySelectorAll('.ib-btn.is-primary'));
    expect(ink('migrate').map((b) => b.getAttribute('data-act'))).toEqual(['approve']);
    expect(ink('notes').map((b) => b.hasAttribute('data-open'))).toEqual([true]);
    expect(ink('digest').map((b) => b.hasAttribute('data-open'))).toEqual([true]);
    expect(card(el, 'digest').querySelector('[data-act="approve"]')?.getAttribute('aria-disabled')).toBe('true');
    const noOpen = mount({ columns: columnsByStatus([RUN]), openLabel: false });
    expect(card(noOpen, 'notes').querySelector('.ib-btn')).toBeNull();
    expect(card(noOpen, 'notes').querySelector('.ib-face')?.hasAttribute('role')).toBe(false);
  });

  it('Enter and Space toggle the focused card; Esc closes it and returns focus to its face', () => {
    const el = mount(board(WAIT));
    const c = card(el, 'migrate');
    const face = c.querySelector<HTMLElement>('.ib-face')!;
    face.focus();
    key(face, 'Enter');
    expect(c.classList.contains('is-open')).toBe(true);
    key(face, ' ');
    expect(c.classList.contains('is-open')).toBe(false);
    key(face, ' ');
    const approve = c.querySelector<HTMLElement>('[data-act="approve"]')!;
    approve.focus();
    const outside = vi.fn();
    el.addEventListener('keydown', outside);
    key(approve, 'Escape');
    expect(c.classList.contains('is-open')).toBe(false);
    expect(el.shadowRoot!.activeElement).toBe(face);
    expect(outside).not.toHaveBeenCalled();
    // A closed card leaves Escape alone (a panel around it can close).
    key(face, 'Escape');
    expect(outside).toHaveBeenCalledTimes(1);
  });

  it('leaves Escape to a text field or select inside an open card', () => {
    const el = mount({ ...board(WAIT), expanded: ['migrate'] });
    const c = card(el, 'migrate');
    for (const tag of ['input', 'textarea', 'select']) {
      const field = document.createElement(tag);
      c.querySelector('.ib-body')!.append(field);
      key(field, 'Escape');
      expect(c.classList.contains('is-open')).toBe(true);
      field.remove();
    }
  });

  it('keeps focus on a face across data renders', () => {
    const el = mount(board(WAIT, RUN));
    const face = card(el, 'notes').querySelector<HTMLElement>('.ib-face')!;
    face.focus();
    el.data = board(WAIT, { ...RUN, summary: 'Grouping 23 merged pull requests.' });
    el.renderNow();
    expect(el.shadowRoot!.activeElement).toBe(face);
  });

  it('shows a new status in place first and moves the card after 900 ms; badges count drawn cards', () => {
    const el = mount(board(WAIT, RUN, DONE));
    const node = card(el, 'notes');
    el.data = board(WAIT, { ...RUN, status: 'done', since: NOW, elapsedMs: 5 * MIN }, DONE);
    el.renderNow();
    expect(colOf(el, 'notes')).toBe('running');
    expect(node.getAttribute('data-status')).toBe('done');
    expect(node.querySelector('.ib-tag')?.getAttribute('data-tone')).toBe('done');
    expect(q(el, '[data-col="running"] .ib-count')?.textContent).toBe('1');
    expect(q(el, '[data-col="done"] .ib-count')?.textContent).toBe('1');
    expect(q(el, '[data-col="running"] .ib-empty')?.hidden).toBe(true);
    vi.setSystemTime(NOW + BOARD_HOLD_MS + 50);
    el.renderNow();
    expect(colOf(el, 'notes')).toBe('done');
    expect(card(el, 'notes')).toBe(node);
    expect(q(el, '[data-col="done"] .ib-count')?.textContent).toBe('2');
    expect(qa(el, '[data-col="done"] li.ib-card').map((li) => li.dataset.card)).toEqual(['notes', 'digest']);
    expect(q(el, '[data-col="running"] .ib-empty')?.hidden).toBe(false);
  });

  it('re-renders on its own when the hold ends', async () => {
    const el = mount(board(RUN));
    el.data = board({ ...RUN, status: 'done' });
    el.renderNow();
    expect(colOf(el, 'notes')).toBe('running');
    vi.advanceTimersByTime(BOARD_HOLD_MS + 40);
    await Promise.resolve();
    expect(colOf(el, 'notes')).toBe('done');
  });

  it('moves at once with reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }));
    const el = mount(board(RUN));
    el.data = board({ ...RUN, status: 'done' });
    el.renderNow();
    expect(colOf(el, 'notes')).toBe('done');
    vi.unstubAllGlobals();
  });

  it('announces counts politely, then only changes, naming a single card that changed', () => {
    const el = mount(board(WAIT, RUN));
    const live = q(el, '[aria-live="polite"]')!;
    expect(live.getAttribute('role')).toBe('status');
    expect(live.textContent).toBe('1 needs you, 1 running');
    el.data = board(WAIT, { ...RUN, summary: 'x' });
    el.renderNow();
    vi.advanceTimersByTime(2000);
    expect(live.textContent).toBe('1 needs you, 1 running');
    el.data = board(WAIT, { ...RUN, status: 'done' });
    el.renderNow();
    expect(live.textContent).toBe('1 needs you, 1 running');
    vi.advanceTimersByTime(1000);
    expect(live.textContent).toBe('Release notes v2.4: Done. 1 needs you, 0 running');
  });

  it('leaves no timer running after it is removed', () => {
    const el = mount(board(WAIT, RUN));
    el.data = board(WAIT, { ...RUN, status: 'done' });
    el.renderNow();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    el.remove();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('folds steps past five and draws the last as current', () => {
    const el = mount({
      ...board({ ...RUN, details: ['1', '2', '3', '4', '5', '6', '7'] }),
      expanded: ['notes'],
    });
    const c = card(el, 'notes');
    expect(c.querySelector('.ib-more')?.textContent).toBe('+2 earlier');
    expect(Array.from(c.querySelectorAll('.ib-step')).map((s) => s.textContent)).toEqual(['3', '4', '5', '6', '7']);
    expect(c.querySelector('.ib-step:last-child')?.classList.contains('is-current')).toBe(true);
  });

  it('speaks Korean with lang="ko"', () => {
    const el = mount(
      { columns: columnsByStatus([WAIT, RUN, { ...DONE, statusText: undefined }], 'ko'), openLabel: '작업 로그' },
      { lang: 'ko' },
    );
    expect(q(el, '.ib-col-name')?.textContent).toBe('응답 필요');
    expect(card(el, 'migrate').querySelector('.ib-tag')?.textContent).toBe('입력 대기6분 전');
    expect(card(el, 'notes').querySelector('.ib-agents-text')?.textContent).toBe('서브에이전트 40 · 실행 2 · 실패 1');
    // The ko table's own duration (D2 G6-1): 4분 12초, not 4m 12s.
    expect(card(el, 'digest').querySelector('.ib-tag')?.textContent).toBe('완료 · 4분 12초13시간 전');
    expect(card(el, 'notes').querySelector('.ib-tag')?.textContent).toBe('실행 중 · 3분 49초');
    expect(card(el, 'notes').querySelector('[data-open]')?.textContent).toBe('작업 로그');
    expect(q(el, '[aria-live="polite"]')?.textContent).toBe('응답이 필요한 세션 1개, 실행 중 1개');
    // The token count's unit in Korean too (0.14.0): one language on the card.
    expect(qa(el, '.ib-unit').length).toBeGreaterThan(0);
    for (const u of qa(el, '.ib-unit')) expect(u.textContent).toBe('토큰');
    const empty = mount({ columns: columnsByStatus([], 'ko') }, { lang: 'ko' });
    expect(q(empty, '.ib-empty')?.textContent).toBe('비어 있음');
  });
});

describe('Korean duration (D2 G6-1)', () => {
  it('the Korean board clock is zero-padded like the panel and <ui-elapsed> — 23분 04초, 7분 00초 (0.21.0)', () => {
    const run = (id: string, ms: number): InboxCard => ({ ...RUN, id, since: NOW - ms });
    const el = mount(
      { columns: columnsByStatus([run('a', 23 * MIN + 4_000), run('b', 7 * MIN), run('c', 42_000)], 'ko') },
      { lang: 'ko' },
    );
    expect(card(el, 'a').querySelector('.ib-tag')?.textContent).toBe('실행 중 · 23분 04초');
    expect(card(el, 'b').querySelector('.ib-tag')?.textContent).toBe('실행 중 · 7분 00초');
    expect(card(el, 'c').querySelector('.ib-tag')?.textContent).toBe('실행 중 · 42초');
  });

  it('fmtDurationKo: 초 under a minute, 분 초, then 시간 분; whole units drop the zero', () => {
    expect(fmtDurationKo(0)).toBe('0초');
    expect(fmtDurationKo(42_400)).toBe('42초');
    expect(fmtDurationKo(432_000)).toBe('7분 12초');
    expect(fmtDurationKo(420_000)).toBe('7분');
    expect(fmtDurationKo(7_380_000)).toBe('2시간 3분');
    expect(fmtDurationKo(7_200_000)).toBe('2시간');
    expect(fmtDurationKo(-5)).toBe('0초');
    expect(fmtDurationKo(Number.NaN)).toBe('0초');
  });
});

// ── Host gaps for the dashboard swap (0.4.2) ────────────────────────────────

describe('host gaps', () => {
  const OLD: InboxCard = { ...DONE, id: 'old', title: 'Old digest', since: NOW - 4 * 24 * 60 * MIN };
  const grouped = (open = false, extra: InboxCard[] = []): AgentInboxData => ({
    columns: [
      { id: 'running', label: 'Running', cards: [RUN, ...extra] },
      {
        id: 'done',
        label: 'Done',
        cards: [],
        groups: [
          { id: '2026-10-27', label: 'Today', open: true, cards: [DONE] },
          { id: '2026-10-23', label: '10월 23일 (금)', open, cards: [OLD] },
        ],
      },
    ],
  });
  const heads = (el: UiAgentInbox) => qa(el, '.ib-group:not(.is-stale) > .ib-group-head');

  it('does not toggle when a click finishes a text selection inside the face', () => {
    const el = mount(board(WAIT));
    const c = card(el, 'migrate');
    let selected = 'Migrate users';
    const sel = () => ({ toString: () => selected, isCollapsed: !selected }) as unknown as Selection;
    vi.spyOn(window, 'getSelection').mockImplementation(sel);
    vi.spyOn(document, 'getSelection').mockImplementation(sel);
    const fired = vi.fn();
    el.addEventListener('ui-toggle', fired);
    c.querySelector<HTMLElement>('.ib-face')!.click();
    expect(fired).not.toHaveBeenCalled();
    expect(c.classList.contains('is-open')).toBe(false);
    selected = '';
    c.querySelector<HTMLElement>('.ib-face')!.click();
    expect(c.classList.contains('is-open')).toBe(true);
    vi.restoreAllMocks();
  });

  it('announces the host counts (data.announce), and nothing with announce: false', () => {
    const el = mount({ ...board(WAIT, RUN), announce: { needs: 3, running: 2 } });
    const live = q(el, '[aria-live="polite"]')!;
    expect(live.textContent).toBe('3 need you, 2 running');
    const quiet = mount({ ...board(WAIT, RUN), announce: false });
    const qlive = q(quiet, '[aria-live="polite"]')!;
    expect(qlive.textContent).toBe('');
    quiet.data = { ...board(WAIT, { ...RUN, status: 'done' }), announce: false };
    quiet.renderNow();
    vi.advanceTimersByTime(2000);
    expect(qlive.textContent).toBe('');
  });

  it('load: loading draws skeletons with no counts or empty hints; failed keeps cards and makes no claims', () => {
    const el = mount({ columns: columnsByStatus([]), load: 'loading' });
    expect(q(el, '.ib-board')?.getAttribute('aria-busy')).toBe('true');
    expect(qa(el, '[data-col="running"] .ib-skel-card').length).toBeGreaterThan(0);
    for (const e of qa(el, '.ib-empty')) expect(e.hidden).toBe(true);
    for (const n of qa(el, '.ib-count')) expect(n.textContent).toBe('');
    expect(q(el, '[aria-live="polite"]')?.textContent).toBe('');
    // Failed first load: this instance's cards under the host's retry bar, no skeleton, no counts, no announcement.
    el.data = { columns: columnsByStatus([RUN]), load: 'failed' };
    el.renderNow();
    expect(q(el, '.ib-board')?.getAttribute('aria-busy')).toBe('false');
    expect(qa(el, '.ib-skel-card')).toHaveLength(0);
    expect(card(el, 'notes')).not.toBeNull();
    for (const e of qa(el, '.ib-empty')) expect(e.hidden).toBe(true);
    for (const n of qa(el, '.ib-count')) expect(n.textContent).toBe('');
    expect(q(el, '[aria-live="polite"]')?.textContent).toBe('');
    // Certified: counts, empty hints and the first sentence at once.
    el.data = { columns: columnsByStatus([RUN]) };
    el.renderNow();
    expect(q(el, '[data-col="running"] .ib-count')?.textContent).toBe('1');
    expect(q(el, '[data-col="done"] .ib-empty')?.hidden).toBe(false);
    expect(q(el, '[aria-live="polite"]')?.textContent).toBe('0 need you, 1 running');
  });

  it('merges data.strings over the language table: status words, agents, titles, clock, announcement', () => {
    const el = mount(
      {
        ...board(WAIT, RUN, DONE),
        strings: {
          status: { running: 'Running' },
          agents: '서브에이전트',
          agentsRunning: (n: number) => `실행 ${n}`,
          agentsFailed: (n: number) => `실패 ${n}`,
          announce: (w: number, r: number) => `응답이 필요한 세션 ${w}개, 실행 중 ${r}개`,
          changed: () => '',
          duration: (ms: number) =>
            `${Math.floor(ms / 60_000)}m ${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}s`,
          empty: 7 as unknown as string,
        },
      },
      { lang: 'ko' },
    );
    expect(card(el, 'notes').querySelector('.ib-agents-text')?.textContent).toBe('서브에이전트 40 · 실행 2 · 실패 1');
    expect(card(el, 'notes').querySelector('.ib-tag')?.textContent).toBe('Running · 3m 49s');
    expect(card(el, 'notes').querySelector('.ib-task-time')?.textContent).toBe('0m 58s');
    expect(card(el, 'migrate').querySelector('.ib-tag')?.textContent).toBe('입력 대기6분 전');
    expect(card(el, 'digest').querySelector('.ib-tag')?.textContent).toBe('완료 · 4m 12s13시간 전');
    const live = q(el, '[aria-live="polite"]')!;
    expect(live.textContent).toBe('응답이 필요한 세션 1개, 실행 중 1개');
    el.data = { ...el.data!, columns: columnsByStatus([WAIT, { ...RUN, status: 'done' }, DONE]) };
    el.renderNow();
    vi.advanceTimersByTime(1000);
    // `changed` returning '' drops the "title: word." prefix.
    expect(live.textContent).toBe('응답이 필요한 세션 1개, 실행 중 0개');
    // A value of the wrong type falls back to the table.
    el.data = { columns: [{ id: 'x', label: 'X', cards: [] }], strings: { empty: 7 as unknown as string } };
    el.renderNow();
    expect(q(el, '.ib-empty')?.textContent).toBe('비어 있음');
  });

  it('sees data.strings changed in place on the next render (status words too)', () => {
    const strings: InboxStringOverrides = { empty: 'Nothing yet', status: { running: 'Busy' } };
    const el = mount({ ...board(RUN), strings });
    expect(q(el, '.ib-empty')?.textContent).toBe('Nothing yet');
    expect(card(el, 'notes').querySelector('.ib-tag')?.textContent).toMatch(/^Busy · /);
    strings.empty = 'Quiet';
    strings.status!.running = 'Working';
    el.data = { ...el.data!, columns: columnsByStatus([RUN]) };
    el.renderNow();
    expect(q(el, '.ib-empty')?.textContent).toBe('Quiet');
    expect(card(el, 'notes').querySelector('.ib-tag')?.textContent).toMatch(/^Working · /);
    delete strings.empty;
    el.renderNow();
    expect(q(el, '.ib-empty')?.textContent).toBe('Nothing here');
  });

  // 0.22.0 — the model as icons (2lab-ai/soma-work#805): the maker's mark in the model's colour and the effort as a
  // 5-bar gauge, no name on the face (the name is the chip's title and accessible name).
  it('draws an icon-only model metric: the mark in its colour, the effort gauge, the name as title and label', () => {
    const el = mount(
      board({
        ...RUN,
        metrics: [
          {
            text: '',
            glyph: 'claude',
            effort: 'high',
            color: '#d97757',
            title: 'Opus 5.5 (1M) · 추론 강도 높음',
            label: '모델 Opus 5.5 (1M), 추론 강도 높음',
          },
        ],
      }),
    );
    const m = card(el, 'notes').querySelector('.ib-metric.is-model') as HTMLElement;
    expect(m).not.toBeNull();
    expect(m.textContent).toBe('');
    expect(m.getAttribute('role')).toBe('img');
    expect(m.getAttribute('aria-label')).toBe('모델 Opus 5.5 (1M), 추론 강도 높음');
    expect(m.getAttribute('title')).toBe('Opus 5.5 (1M) · 추론 강도 높음');
    expect(m.style.getPropertyValue('--ib-model-hue')).toBe('#d97757');
    const gauge = m.querySelector('.ib-eff')!;
    expect(gauge.getAttribute('data-effort')).toBe('high');
    expect(gauge.querySelectorAll('.ib-eff-bar').length).toBe(5);
    expect(gauge.querySelectorAll('.ib-eff-bar.is-on').length).toBe(3);
  });

  // 0.23.0 — the maker's colour by default (2lab-ai/soma-work#813): a vendor mark with no colour takes its maker's
  // (Claude clay, Gemini blue); OpenAI's and xAI's black marks take the ink. A host colour still wins.
  it("colours a vendor mark with its maker's colour when the host gives none; OpenAI and Grok take the ink", () => {
    const el = mount(
      board({
        ...RUN,
        metrics: [
          { text: 'Opus 5.5', glyph: 'claude' },
          { text: '', glyph: 'openai', label: '모델 GPT-5.5' },
          { text: '', glyph: 'grok', label: '모델 Grok 4.6' },
          { text: '', glyph: 'gemini', label: '모델 Gemini 3' },
          { text: '', glyph: 'claude', color: '#8b6fd6', label: '모델 Sonnet' },
          { text: '', glyph: 'model', label: '모델 llama' },
        ],
      }),
    );
    const ms = Array.from(card(el, 'notes').querySelectorAll<HTMLElement>('.ib-metric.is-host'));
    expect(ms.map((m) => [m.style.getPropertyValue('--ib-model-hue'), m.classList.contains('is-ink')])).toEqual([
      ['#d97757', false],
      ['', true],
      ['', true],
      ['#4285f4', false],
      ['#8b6fd6', false],
      ['', false],
    ]);
    expect(ms[0].classList.contains('is-model')).toBe(true);
    expect(ms[0].textContent).toBe('Opus 5.5');
  });

  it('fills the effort gauge by level (low 1 … max 5, ultra 5 with its foil); no gauge for an unknown level', () => {
    const levels: Array<[string, number]> = [
      ['low', 1],
      ['medium', 2],
      ['high', 3],
      ['xhigh', 4],
      ['max', 5],
      ['ultra', 5],
    ];
    const el = mount(
      board({
        ...RUN,
        metrics: [
          ...levels.map(([effort]) => ({ text: '', glyph: 'claude' as const, effort, label: effort })),
          {
            text: '',
            glyph: 'openai' as const,
            effort: 'turbo',
            label: 'unknown',
          },
        ],
      }),
    );
    const ms = Array.from(card(el, 'notes').querySelectorAll('.ib-metric.is-model'));
    expect(ms.map((m) => m.querySelectorAll('.ib-eff-bar.is-on').length)).toEqual([...levels.map(([, n]) => n), 0]);
    expect(ms.map((m) => m.querySelector('.ib-eff')?.getAttribute('data-effort') ?? '')).toEqual([
      'low',
      'medium',
      'high',
      'xhigh',
      'max',
      'ultra',
      '',
    ]);
    // The last still shows its mark (an icon-only metric needs a mark or a gauge).
    expect(ms[6].querySelector('svg')).not.toBeNull();
  });

  it('takes only a hex colour (no CSS injection); an icon-only metric without a mark or a gauge is dropped', () => {
    const el = mount(
      board({
        ...RUN,
        metrics: [
          { text: '', glyph: 'gemini', color: 'red;background:url(x)', label: 'a' },
          { text: '', glyph: 'grok', color: '#abc', label: 'b' },
          { text: '', label: 'nothing to draw' },
        ],
      }),
    );
    const ms = Array.from(card(el, 'notes').querySelectorAll<HTMLElement>('.ib-metric.is-model'));
    expect(ms.length).toBe(2);
    // The injected value is refused: the mark keeps its maker's colour (0.23.0), nothing else reaches the style.
    expect(ms[0].getAttribute('style')).toBe('--ib-model-hue:#4285f4');
    expect(ms[1].style.getPropertyValue('--ib-model-hue')).toBe('#abc');
  });

  it('draws face extras: lead, owner badge, host metrics, titles, context level, artifact count and chip buttons', () => {
    const el = mount(
      board({
        ...RUN,
        lead: { text: 'CRON', glyph: 'clock', title: '크론 잡: nightly' },
        badge: { text: 'zhuge', hue: 3, title: 'Zhuge Liang' },
        metrics: [
          { text: '#12 머지됨', glyph: 'pr', tone: 'done', title: 'PR #12 머지됨 — Fix the board' },
          { text: '2', glyph: 'attach', title: '지시 첨부 2개', label: '지시 첨부 2개' },
        ],
        titles: {
          tokens: '총 토큰 (task 합계: 메인 + 서브에이전트 4개)',
          cost: 'API 환산 비용',
          context: '컨텍스트 72% · 자동 압축 750K까지 120K',
        },
        contextLevel: 'danger',
        artifactsCount: 9,
        artifacts: [
          { id: 'a1', name: 'shot.png' },
          { id: 'a2', name: 'report', kind: 'html' },
        ],
        agents: { total: 4, running: 1, done: 1, failed: 1, dots: ['done', 'stopped', 'running', 'failed'] },
      }),
    );
    const c = card(el, 'notes');
    expect(c.querySelector('.ib-spark')).toBeNull();
    const lead = c.querySelector('.ib-lead')!;
    expect(lead.textContent).toBe('CRON');
    expect(lead.getAttribute('title')).toBe('크론 잡: nightly');
    const badge = c.querySelector('.ib-head .ib-badge')!;
    expect(badge.textContent).toBe('zhuge');
    expect(badge.getAttribute('data-hue')).toBe('3');
    expect(badge.getAttribute('title')).toBe('Zhuge Liang');
    const metrics = Array.from(c.querySelectorAll('.ib-metric'));
    expect(metrics.map((m) => m.textContent)).toEqual(['0/4', '72%', '#12 머지됨', '2']);
    expect(metrics[1].classList.contains('is-danger')).toBe(true);
    expect(metrics[1].getAttribute('title')).toBe('컨텍스트 72% · 자동 압축 750K까지 120K');
    expect(metrics[2].getAttribute('data-tone')).toBe('done');
    expect(metrics[3].getAttribute('aria-label')).toBe('지시 첨부 2개');
    expect(Array.from(c.querySelectorAll('.ib-use')).map((u) => u.getAttribute('title'))).toEqual([
      '총 토큰 (task 합계: 메인 + 서브에이전트 4개)',
      'API 환산 비용',
    ]);
    expect(c.querySelector('.ib-arts-n')?.textContent).toBe('9');
    expect(c.querySelector('.ib-arts-more')?.textContent).toBe('+7');
    const chips = Array.from(c.querySelectorAll<HTMLElement>('button.ib-chip'));
    expect(chips.map((b) => b.getAttribute('data-art'))).toEqual(['a1', 'a2']);
    expect(chips[1].classList.contains('is-html')).toBe(true);
    expect(chips[0].getAttribute('aria-label')).toBe('Open shot.png');
    expect(Array.from(c.querySelectorAll('.ib-adot')).map((d) => d.className)).toEqual([
      'ib-adot is-done',
      'ib-adot is-stopped',
      'ib-adot is-running',
      'ib-adot is-failed',
    ]);
    const arts: unknown[] = [];
    const toggles = vi.fn();
    el.addEventListener('ui-artifact', (e) => arts.push((e as CustomEvent).detail));
    el.addEventListener('ui-toggle', toggles);
    chips[0].click();
    expect(arts).toEqual([{ cardId: 'notes', artifactId: 'a1' }]);
    expect(toggles).not.toHaveBeenCalled();
    // An explicit empty level overrides the bands; no level falls back to them.
    el.data = board({ ...RUN, contextLevel: '' });
    el.renderNow();
    expect(card(el, 'notes').querySelector('.ib-metric.is-warn, .ib-metric.is-danger')).toBeNull();
  });

  it('badge.self (0.28.0): the viewer’s own pill gets the moving ring, "(you)" for a screen reader, the shared orbit', () => {
    // happy-dom has no Web Animations: each connected element gets an orbit animation (its ::before) and a fade,
    // recorded here. A detached element has none — as in a browser, where a CSS animation exists only once connected.
    type Anim = { animationName: string; startTime: number | null };
    const anims = new Map<Element, Anim[]>();
    const proto = HTMLElement.prototype as unknown as { getAnimations?: (this: Element) => Anim[] };
    const had = Object.getOwnPropertyDescriptor(proto, 'getAnimations');
    proto.getAnimations = function (this: Element) {
      if (!this.isConnected) return [];
      if (!anims.has(this))
        anims.set(this, [
          { animationName: 'ib-badge-orbit', startTime: null },
          { animationName: 'ib-fade', startTime: 7 },
        ]);
      return anims.get(this)!;
    };
    try {
      const el = mount(
        board(
          { ...RUN, id: 'mine', badge: { text: 'zhuge', hue: 2, self: true } },
          { ...WAIT, id: 'theirs', badge: { text: 'elon', hue: 5 } },
          { ...RUN, id: 'truthy', badge: { text: 'pang', self: 'yes' as unknown as boolean } },
          { ...RUN, id: 'titled', badge: { text: 'zhuge', self: true, title: 'Zhuge Liang — 내 작업' } },
        ),
      );
      const mine = card(el, 'mine').querySelector<HTMLElement>('.ib-badge')!;
      expect(mine.classList.contains('is-self')).toBe(true);
      expect(mine.getAttribute('data-hue')).toBe('2');
      expect(mine.querySelector('.sr-only')?.textContent).toBe(' (you)');
      expect(mine.textContent).toBe('zhuge (you)');
      expect(mine.getAttribute('title')).toBe('zhuge (you)');
      // On the document's shared orbit: the arc starts at the timeline's origin; any other animation is left alone.
      expect(anims.get(mine)?.map((a) => a.startTime)).toEqual([0, 7]);
      // Only `true` marks it; everyone else's pill stays still and says nothing more.
      for (const id of ['theirs', 'truthy']) {
        const b = card(el, id).querySelector<HTMLElement>('.ib-badge')!;
        expect(b.classList.contains('is-self'), id).toBe(false);
        expect(b.querySelector('.sr-only'), id).toBeNull();
        expect(anims.has(b), id).toBe(false);
      }
      // The host's title wins over the default.
      expect(card(el, 'titled').querySelector('.ib-badge')?.getAttribute('title')).toBe('Zhuge Liang — 내 작업');

      // A rewritten face (new tokens) draws a new pill that takes the phase again — the arc carries on, never restarts.
      el.data = board(
        { ...RUN, id: 'mine', tokens: 99_999, badge: { text: 'zhuge', hue: 2, self: true } },
        { ...WAIT, id: 'theirs', badge: { text: 'elon', hue: 5 } },
      );
      el.renderNow();
      const again = card(el, 'mine').querySelector<HTMLElement>('.ib-badge')!;
      expect(again).not.toBe(mine);
      expect(anims.get(again)?.[0].startTime).toBe(0);

      // The browser restarted the arc (the card moved, or was shown again): the next render puts it back on the
      // orbit, even when nothing on the face changed.
      anims.get(again)![0].startTime = 1234;
      el.data = board(
        { ...RUN, id: 'mine', tokens: 99_999, badge: { text: 'zhuge', hue: 2, self: true } },
        { ...WAIT, id: 'theirs', badge: { text: 'elon', hue: 5 } },
      );
      el.renderNow();
      expect(card(el, 'mine').querySelector('.ib-badge')).toBe(again);
      expect(anims.get(again)?.[0].startTime).toBe(0);

      // Korean.
      const ko = mount(board({ ...RUN, id: 'mine', badge: { text: 'zhuge', self: true } }), { lang: 'ko' });
      const kb = card(ko, 'mine').querySelector<HTMLElement>('.ib-badge')!;
      expect(kb.querySelector('.sr-only')?.textContent).toBe(' (나)');
      expect(kb.getAttribute('title')).toBe('zhuge (나)');
    } finally {
      if (had) Object.defineProperty(proto, 'getAnimations', had);
      else delete proto.getAnimations;
    }
  });

  it('badge.self styles: an orbiting arc under the tint, the ring alone under reduced motion, an outline in forced colours', () => {
    const css = monoStyles.replace(/\s+/g, ' ');
    expect(css).toMatch(/\.ib-badge\.is-self \{ position: relative; isolation: isolate;/);
    expect(css).toMatch(
      /\.ib-badge\.is-self::before \{[^}]*conic-gradient\([^}]*animation: ib-badge-orbit 2400ms linear infinite; \}/,
    );
    expect(css).toMatch(/\.ib-badge\.is-self::after \{[^}]*inset: 2px; z-index: -1;/);
    expect(css).toContain('@keyframes ib-badge-orbit { to { transform: translate(-50%, -50%) rotate(1turn); } }');
    expect(css).toMatch(
      /prefers-reduced-motion: reduce\) \{ \.ib-badge\.is-self \{ background: [^}]+\} \.ib-badge\.is-self::before \{ animation: none; display: none; \}/,
    );
    expect(css).toMatch(/forced-colors: active\) \{ \.ib-badge\.is-self \{ outline: 2px solid Highlight;/);
    // Eight hues, as before.
    for (let h = 1; h < 8; h++) expect(css).toContain(`.ib-badge[data-hue="${h}"] { --ib-badge-hue:`);
  });

  it('escapes every host string of the face extras and groups', () => {
    const X = '<img src=x onerror=alert(1)>';
    const el = mount({
      columns: [
        {
          id: X,
          label: X,
          cards: [],
          groups: [
            {
              id: X,
              label: X,
              open: true,
              cards: [
                {
                  id: 'c',
                  title: 't',
                  status: 'done',
                  lead: { text: X, title: X },
                  badge: { text: X, title: X, hue: X as unknown as number },
                  metrics: [{ text: X, title: X, label: X, tone: X as never, glyph: X as never }],
                  titles: { tokens: X, cost: X, context: X },
                  tokens: 1,
                  costUsd: 1,
                  contextPct: 50,
                  artifacts: [{ id: X, name: X, kind: X as never }],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(q(el, 'img')).toBeNull();
    expect(q(el, '[onerror]')).toBeNull();
    const c = card(el, 'c');
    expect(c.querySelector('.ib-lead')?.textContent).toBe(X);
    expect(c.querySelector('.ib-badge')?.textContent).toBe(X);
    expect(c.querySelector('.ib-badge')?.getAttribute('data-hue')).toBe('0');
    expect(c.querySelector('.ib-metric[title]')?.getAttribute('title')).toBe(X);
    expect(c.querySelector('button.ib-chip')?.getAttribute('data-art')).toBe(X);
    expect(c.querySelector('button.ib-chip')?.classList.contains('is-file')).toBe(true);
    expect(q(el, '.ib-group-label')?.textContent).toBe(X);
  });

  it('bodyMode slot: the open card shows the host light-DOM body, keeps Esc, and never reads host buttons as its own', () => {
    const el = mount({ columns: columnsByStatus([{ ...WAIT, bodyMode: 'slot' }]) });
    const host = document.createElement('div');
    host.slot = 'body:migrate';
    host.innerHTML = '<button type="button" data-act="stop" data-open>Stop</button><textarea></textarea>';
    el.append(host);
    const c = card(el, 'migrate');
    const face = c.querySelector<HTMLElement>('.ib-face')!;
    const slot = c.querySelector<HTMLSlotElement>('.ib-expand slot')!;
    expect(slot.getAttribute('name')).toBe('body:migrate');
    // The slot replaces the built-in steps and buttons.
    expect(c.querySelector('.ib-body')).toBeNull();
    expect(face.getAttribute('role')).toBe('button');
    expect(c.querySelector('.ib-expand')?.hasAttribute('inert')).toBe(true);
    face.click();
    expect(c.querySelector('.ib-expand')?.hasAttribute('inert')).toBe(false);
    const acts = vi.fn();
    el.addEventListener('ui-action', acts);
    el.addEventListener('ui-open', acts);
    const toggles = vi.fn();
    el.addEventListener('ui-toggle', toggles);
    host.querySelector('button')!.click();
    expect(acts).not.toHaveBeenCalled();
    expect(toggles).not.toHaveBeenCalled();
    key(host.querySelector('textarea')!, 'Escape');
    expect(c.classList.contains('is-open')).toBe(true);
    key(host.querySelector('button')!, 'Escape');
    expect(c.classList.contains('is-open')).toBe(false);
    expect(el.shadowRoot!.activeElement).toBe(face);
    // A data render keeps the slot node (the host's body is never re-slotted).
    el.data = { columns: columnsByStatus([{ ...WAIT, bodyMode: 'slot', summary: 'Still waiting.' }]) };
    el.renderNow();
    expect(c.querySelector('.ib-expand slot')).toBe(slot);
  });

  it('groups: a disclosure head per group, a closed group draws no cards, the column counts every group', () => {
    const el = mount(grouped());
    const hs = heads(el);
    expect(hs.map((h) => h.querySelector('.ib-group-label')?.textContent)).toEqual(['Today', '10월 23일 (금)']);
    expect(hs.map((h) => h.getAttribute('aria-expanded'))).toEqual(['true', 'false']);
    expect(hs.map((h) => h.querySelector('.ib-count')?.textContent)).toEqual(['1', '1']);
    expect(el.shadowRoot!.getElementById(hs[0].getAttribute('aria-controls')!)?.hidden).toBe(false);
    expect(card(el, 'digest')).not.toBeNull();
    expect(card(el, 'old')).toBeNull();
    expect(q(el, '[data-col="done"] .ib-col-head .ib-count')?.textContent).toBe('2');
    expect(q(el, '[data-col="done"] .ib-empty')?.hidden).toBe(true);
    const fired: unknown[] = [];
    el.addEventListener('ui-group-toggle', (e) => fired.push((e as CustomEvent).detail));
    hs[1].click();
    expect(fired).toEqual([{ columnId: 'done', groupId: '2026-10-23', open: true }]);
    expect(hs[1].getAttribute('aria-expanded')).toBe('true');
    expect(card(el, 'old')).not.toBeNull();
    // The person's choice rules over `open` afterwards.
    el.data = grouped(false);
    el.renderNow();
    expect(card(el, 'old')).not.toBeNull();
    hs[0].click();
    expect(card(el, 'digest')).toBeNull();
    expect(q(el, '[data-col="done"] .ib-col-head .ib-count')?.textContent).toBe('2');
    el.addEventListener('ui-group-toggle', (e) => e.preventDefault(), { once: true });
    hs[0].click();
    expect(hs[0].getAttribute('aria-expanded')).toBe('false');
    // A group that leaves goes; the empty hint stays hidden while any group is there.
    el.data = { columns: [{ id: 'done', label: 'Done', cards: [], groups: [{ id: 'g', label: 'G', cards: [] }] }] };
    el.renderNow();
    expect(heads(el).map((h) => h.querySelector('.ib-group-label')?.textContent)).toEqual(['G']);
    expect(q(el, '[data-col="done"] .ib-empty')?.hidden).toBe(true);
  });

  it('holds a card that moves into a group in place first, then moves it there', () => {
    const el = mount(grouped());
    const node = card(el, 'notes');
    const next = grouped();
    next.columns[0].cards = [];
    next.columns[1].groups![0].cards = [{ ...RUN, status: 'done', since: NOW }, DONE];
    el.data = next;
    el.renderNow();
    expect(colOf(el, 'notes')).toBe('running');
    expect(q(el, '[data-col="running"] .ib-col-head .ib-count')?.textContent).toBe('1');
    expect(q(el, '[data-col="done"] .ib-col-head .ib-count')?.textContent).toBe('2');
    vi.setSystemTime(NOW + BOARD_HOLD_MS + 50);
    el.renderNow();
    expect(card(el, 'notes')).toBe(node);
    expect(node.closest('.ib-group')?.getAttribute('data-group')).toBe('2026-10-27');
    expect(q(el, '[data-col="done"] .ib-col-head .ib-count')?.textContent).toBe('3');
  });

  it('reveal(): opens a drawn card and scrolls it to centre, opens its closed group first, false for an unknown id', () => {
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    const el = mount(grouped());
    const toggles: unknown[] = [];
    el.addEventListener('ui-toggle', (e) => toggles.push((e as CustomEvent).detail));
    el.addEventListener('ui-group-toggle', (e) => toggles.push((e as CustomEvent).detail));
    expect(el.reveal('old')).toBe(true);
    expect(card(el, 'old').classList.contains('is-open')).toBe(true);
    expect(toggles).toEqual([
      { columnId: 'done', groupId: '2026-10-23', open: true },
      { cardId: 'old', expanded: true },
    ]);
    expect(scroll).toHaveBeenLastCalledWith({ block: 'center' });
    expect(scroll.mock.contexts.at(-1)).toBe(card(el, 'old'));
    // Already open: stays open, no second toggle; scroll: false leaves the page.
    scroll.mockClear();
    expect(el.reveal('old', { scroll: false })).toBe(true);
    expect(toggles).toHaveLength(2);
    expect(scroll).not.toHaveBeenCalled();
    expect(el.reveal('nope')).toBe(false);
    // Data set in the same task: reveal renders it first.
    el.data = grouped(undefined, [{ ...WAIT, id: 'fresh' }]);
    expect(el.reveal('fresh', { open: false })).toBe(true);
    expect(card(el, 'fresh').classList.contains('is-open')).toBe(false);
    scroll.mockRestore();
  });

  it('reveal() is false when the host prevents the card from opening; a card with nothing to open is revealed', () => {
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    const el = mount(grouped(true));
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('ui-toggle', stop);
    expect(el.reveal('old')).toBe(false);
    expect(card(el, 'old').classList.contains('is-open')).toBe(false);
    expect(scroll).not.toHaveBeenCalled();
    // Not asked to open: nothing to prevent.
    expect(el.reveal('old', { open: false })).toBe(true);
    el.removeEventListener('ui-toggle', stop);
    // No body (no details, no actions, no Open): nothing opens, and it is still revealed.
    el.data = { ...grouped(true), openLabel: false };
    expect(el.reveal('digest')).toBe(true);
    expect(card(el, 'digest').hasAttribute('role')).toBe(false);
    scroll.mockRestore();
  });

  it('a group that leaves fades out with its cards; reveal is false when the host keeps a group closed', () => {
    const el = mount(grouped());
    const anim = vi
      .spyOn(HTMLElement.prototype, 'animate')
      .mockImplementation(() => ({ cancel() {}, onfinish: null, oncancel: null }) as unknown as Animation);
    const today = q(el, '.ib-group[data-group="2026-10-27"]')!;
    const node = card(el, 'digest');
    const next = grouped();
    next.columns[1].groups = next.columns[1].groups!.slice(1);
    el.data = next;
    el.renderNow();
    // Still on screen, fading, inert, its card inside it; no longer a group or a card of the board.
    expect(today.classList.contains('is-stale')).toBe(true);
    expect(today.hasAttribute('inert')).toBe(true);
    expect(node.parentElement?.closest('.ib-group')).toBe(today);
    expect(card(el, 'digest')).toBeNull();
    expect(anim.mock.contexts).toContain(today);
    anim.mockRestore();
    el.addEventListener('ui-group-toggle', (e) => e.preventDefault());
    expect(el.reveal('old')).toBe(false);
    expect(card(el, 'old')).toBeNull();
  });

  it('counts cards in groups for the sentence, open or closed', () => {
    const cols = grouped().columns;
    cols[1].groups![1].cards = [{ ...OLD, status: 'failed' }];
    expect(boardCounts(cols)).toEqual({ needs: 1, running: 1 });
  });

  it('a bare column is just its list: no head, no tint, no empty hint (a CRON job section)', () => {
    const el = mount(
      { columns: [{ id: 'cron:nightly', label: 'nightly', bare: true, cards: [RUN] }], announce: false },
      {
        view: 'list',
      },
    );
    const sec = q(el, 'section.ib-col')!;
    expect(sec.classList.contains('is-bare')).toBe(true);
    expect(sec.querySelector('.ib-col-head')).toBeNull();
    expect(sec.getAttribute('aria-label')).toBe('nightly');
    expect(card(el, 'notes')).not.toBeNull();
    el.data = { columns: [{ id: 'cron:nightly', label: 'nightly', bare: true, cards: [] }], announce: false };
    el.renderNow();
    expect(sec.querySelector<HTMLElement>('.ib-empty')?.hidden ?? true).toBe(true);
  });

  describe('motion for host layout changes', () => {
    // A fake layout: board = three columns side by side, list = stacked. Cards are 100×80.
    function fakeLayout() {
      const spot = (node: Element): { x: number; y: number } => {
        const view = node.closest('.ib')?.getAttribute('data-view') === 'list' ? 'list' : 'board';
        const col = node.closest('section.ib-col');
        const ci = col ? Array.from(col.parentElement!.children).indexOf(col) : 0;
        const li = node.closest('li.ib-card');
        const ri = li ? Array.from(li.parentElement!.children).indexOf(li) + 1 : 0;
        const shift = Number(node.closest('.ib')?.getAttribute('data-shift') ?? 0);
        return view === 'list' ? { x: 10 + shift, y: ci * 300 + ri * 90 } : { x: 10 + ci * 320 + shift, y: ri * 90 };
      };
      return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const p = spot(this);
        return {
          left: p.x,
          top: p.y,
          right: p.x + 100,
          bottom: p.y + 80,
          width: 100,
          height: 80,
          x: p.x,
          y: p.y,
        } as DOMRect;
      });
    }
    // A stub animation: happy-dom rejects `finished` on cancel() without marking it handled (the spec marks it).
    const spyAnimate = () =>
      vi
        .spyOn(HTMLElement.prototype, 'animate')
        .mockImplementation(
          () => ({ cancel() {}, finish() {}, onfinish: null, oncancel: null }) as unknown as Animation,
        );
    const moves = (anim: { mock: { calls: unknown[][]; contexts: unknown[] } }) =>
      anim.mock.calls
        .map((call, i) => ({ el: anim.mock.contexts[i] as Element, frames: call[0] as Keyframe[] }))
        .filter((m) => String(m.frames?.[0]?.transform ?? '').startsWith('translate('));

    it('FLIPs the cards and column heads when view changes', () => {
      const rect = fakeLayout();
      const el = mount(board(WAIT, RUN));
      const anim = spyAnimate();
      el.setAttribute('view', 'list');
      expect(q(el, '.ib')?.getAttribute('data-view')).toBe('list');
      const m = moves(anim);
      // RUNNING's card and head moved from x 330 to x 10 and down a column.
      const run = m.find((x) => x.el === card(el, 'notes'))!;
      expect(run.frames[0].transform).toBe('translate(320px, -300px)');
      expect(m.some((x) => x.el === q(el, '[data-col="running"] .ib-col-head'))).toBe(true);
      // NEEDS YOU's card stayed put: no move.
      expect(m.some((x) => x.el === card(el, 'migrate'))).toBe(false);
      anim.mockRestore();
      rect.mockRestore();
    });

    it('measure() before a host layout change, flipFrom() after it, glides every card from where it was', () => {
      const rect = fakeLayout();
      const el = mount(board(WAIT, RUN));
      const snap = el.measure();
      expect(Object.keys(snap.spots).sort()).toEqual(['c:migrate', 'c:notes', 'h:done', 'h:needs-you', 'h:running']);
      // The host docks a panel: everything moves 40px left.
      q(el, '.ib')!.setAttribute('data-shift', '-40');
      const anim = spyAnimate();
      el.flipFrom(snap);
      const m = moves(anim);
      expect(m.find((x) => x.el === card(el, 'notes'))?.frames[0].transform).toBe('translate(40px, 0px)');
      expect(m.filter((x) => x.el.matches('.ib-col-head'))).toHaveLength(3);
      anim.mockClear();
      // Nothing moved since: nothing to play.
      el.flipFrom(el.measure());
      expect(moves(anim)).toHaveLength(0);
      anim.mockRestore();
      rect.mockRestore();
    });

    it('a second flipFrom() during a glide starts from where the card is drawn, not from the older snapshot', () => {
      const rect = fakeLayout();
      const el = mount(board(WAIT, RUN));
      // A host that re-flips from its last settled snapshot (a resize burst: the second change lands mid-glide).
      const settled = el.measure();
      const anim = vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(
        () =>
          ({
            cancel() {},
            finish() {},
            onfinish: null,
            oncancel: null,
            // Half-way through the glide (eased progress).
            effect: { getComputedTiming: () => ({ progress: 0.5 }) },
          }) as unknown as Animation,
      );
      q(el, '.ib')!.setAttribute('data-shift', '-40');
      el.flipFrom(settled);
      expect(moves(anim).find((x) => x.el === card(el, 'notes'))?.frames[0].transform).toBe('translate(40px, 0px)');
      anim.mockClear();
      // Mid-glide the notes card is drawn at 290 + 20 = 310. The layout moves again, to 230.
      q(el, '.ib')!.setAttribute('data-shift', '-100');
      el.flipFrom(settled);
      const m = moves(anim);
      // From 310, not from the snapshot's 330 (that would jump the card back before gliding).
      expect(m.find((x) => x.el === card(el, 'notes'))?.frames[0].transform).toBe('translate(80px, 0px)');
      // The heads re-aim the same way.
      expect(m.find((x) => x.el === q(el, '[data-col="running"] .ib-col-head'))?.frames[0].transform).toBe(
        'translate(80px, 0px)',
      );
      anim.mockRestore();
      rect.mockRestore();
    });

    it('a re-aim mid-glide counts a page scroll since the glide began, once', () => {
      const rect = fakeLayout();
      const el = mount(board(WAIT, RUN));
      const settled = el.measure();
      const anim = vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(
        () =>
          ({
            cancel() {},
            finish() {},
            onfinish: null,
            oncancel: null,
            effect: { getComputedTiming: () => ({ progress: 0.5 }) },
          }) as unknown as Animation,
      );
      const ib = q(el, '.ib')!;
      ib.setAttribute('data-shift', '-40');
      el.flipFrom(settled);
      anim.mockClear();
      // The page scrolls 50px mid-glide: the card is now drawn at 310 − 50 = 260 …
      window.scrollTo(50, 0);
      try {
        // … and the layout moves again: its box is now 230 − 50 = 180.
        ib.setAttribute('data-shift', '-150');
        el.flipFrom(settled);
        expect(moves(anim).find((x) => x.el === card(el, 'notes'))?.frames[0].transform).toBe('translate(80px, 0px)');
      } finally {
        window.scrollTo(0, 0);
        anim.mockRestore();
        rect.mockRestore();
      }
    });

    it('a card in a group that leaves stops its glide (the group fades out with it)', () => {
      const rect = fakeLayout();
      const el = mount(grouped());
      const node = card(el, 'digest');
      const snap = el.measure();
      q(el, '.ib')!.setAttribute('data-shift', '-40');
      const anim = vi
        .spyOn(HTMLElement.prototype, 'animate')
        .mockImplementation(
          () => ({ cancel: vi.fn(), finish() {}, onfinish: null, oncancel: null }) as unknown as Animation,
        );
      el.flipFrom(snap);
      const i = anim.mock.contexts.indexOf(node);
      expect(i).toBeGreaterThanOrEqual(0);
      const glide = anim.mock.results[i].value as { cancel: ReturnType<typeof vi.fn> };
      expect(glide.cancel).not.toHaveBeenCalled();
      // The Today group leaves while the card still glides.
      const next = grouped();
      next.columns[1].groups = next.columns[1].groups!.slice(1);
      el.data = next;
      el.renderNow();
      expect(node.closest('.ib-group')?.classList.contains('is-stale')).toBe(true);
      expect(glide.cancel).toHaveBeenCalledTimes(1);
      anim.mockRestore();
      rect.mockRestore();
    });
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    vi.useRealTimers(); // settle() waits real time
    spy = soundSpy();
  });
  afterEach(() => spy.restore());
  const tap = (n: Element | null | undefined, detail = 1) =>
    (n as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail }));
  const face = (el: UiAgentInbox, id: string) => card(el, id).querySelector<HTMLElement>('.ib-face')!;
  const OLD: InboxCard = { ...DONE, id: 'old', title: 'Old digest' };
  const grouped = (): AgentInboxData => ({
    columns: [
      { id: 'needs', label: 'Needs you', cards: [WAIT, { ...RUN, artifacts: [{ id: 'a1', name: 'shot.png' }] }] },
      { id: 'done', label: 'Done', cards: [], groups: [{ id: 'g', label: 'Older', open: false, cards: [OLD] }] },
    ],
  });

  it('a card opens / closes (click, Enter, Esc); a group head opens / closes', async () => {
    const el = mount(grouped());
    tap(face(el, 'migrate'));
    await spy.settle();
    key(face(el, 'migrate'), 'Enter');
    await spy.settle();
    key(face(el, 'migrate'), ' ');
    await spy.settle();
    key(card(el, 'migrate').querySelector('[data-act="approve"]')!, 'Escape');
    await spy.settle();
    const head = q(el, '.ib-group-head')!;
    tap(head);
    await spy.settle();
    tap(head, 0);
    await spy.settle();
    const open = ['open', { emphasis: 'subtle', input: 'mouse' }];
    const close = ['close', { emphasis: 'subtle', input: 'keyboard' }];
    expect(spy.calls).toEqual([open, close, ['open', { emphasis: 'subtle', input: 'keyboard' }], close, open, close]);
  });

  it('an action → tap, Open → navigate, a file chip → a subtle navigate', async () => {
    const el = mount({ ...grouped(), expanded: ['migrate'] });
    tap(card(el, 'migrate').querySelector('[data-act="reject"]'));
    await spy.settle();
    tap(card(el, 'migrate').querySelector('[data-open]'), 0);
    await spy.settle();
    tap(card(el, 'notes').querySelector('button.ib-chip'));
    await spy.settle();
    expect(spy.calls).toEqual([
      ['tap', { input: 'mouse' }],
      ['navigate', { input: 'keyboard' }],
      ['navigate', { emphasis: 'subtle', input: 'mouse' }],
    ]);
  });

  it('nothing for reveal(), a prevented event, data the app sets, or a data-ui-sound="off" region', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    const el = mount(grouped());
    expect(el.reveal('old')).toBe(true);
    el.data = { ...grouped(), expanded: ['migrate'] };
    el.renderNow();
    await spy.settle();
    expect(spy.calls).toEqual([]);
    for (const n of ['ui-toggle', 'ui-group-toggle', 'ui-action', 'ui-open', 'ui-artifact'])
      el.addEventListener(n, (e) => e.preventDefault());
    tap(face(el, 'migrate'));
    tap(q(el, '.ib-group-head'));
    tap(card(el, 'notes').querySelector('button.ib-chip'));
    await spy.settle();
    expect(spy.calls).toEqual([]);
    const quiet = document.createElement('div');
    quiet.setAttribute('data-ui-sound', 'off');
    document.body.append(quiet);
    const off = mount(grouped());
    quiet.append(off);
    tap(face(off, 'migrate'));
    await spy.settle();
    expect(spy.calls).toEqual([]);
    vi.restoreAllMocks();
  });
});

// 0.16.0 — the star is a toggle on the face, the face's kind and vendor glyphs (soma-work 2026-11-01).
describe('face star toggle, kind and vendor glyphs (0.16.0)', () => {
  const faceOf = (el: UiAgentInbox, id: string) => card(el, id).querySelector<HTMLElement>('.ib-face')!;

  it('a star on the face is a toggle button that sends ui-star and never toggles the card', () => {
    const el = mount(board({ ...RUN, star: { on: false } }));
    const star = card(el, 'notes').querySelector<HTMLButtonElement>('button.ib-star')!;
    expect(star).not.toBeNull();
    expect(star.getAttribute('aria-pressed')).toBe('false');
    expect(star.getAttribute('data-star')).toBe('');
    // A toggle names the thing (fixed), aria-pressed says the state (review: fable P3).
    expect(star.hasAttribute('aria-label')).toBe(false);
    expect(star.textContent).toBe('Star');
    // It sits in the head, after the title.
    expect(star.parentElement?.classList.contains('ib-head')).toBe(true);
    const stars: unknown[] = [];
    const toggles = vi.fn();
    el.addEventListener('ui-star', (e) => stars.push((e as CustomEvent).detail));
    el.addEventListener('ui-toggle', toggles);
    star.click();
    expect(stars).toEqual([{ cardId: 'notes', starred: true }]);
    expect(toggles).not.toHaveBeenCalled();
    expect(faceOf(el, 'notes').getAttribute('aria-expanded')).not.toBe('true');
    // On: pressed, the filled star, the word to take it off.
    el.data = board({ ...RUN, star: { on: true, title: '즐겨찾기 — 항상 맨 위' } });
    el.renderNow();
    const on = card(el, 'notes').querySelector<HTMLButtonElement>('button.ib-star')!;
    expect(on.getAttribute('aria-pressed')).toBe('true');
    expect(on.getAttribute('title')).toBe('즐겨찾기 — 항상 맨 위');
    on.click();
    expect(stars[1]).toEqual({ cardId: 'notes', starred: false });
  });

  it('a disabled star says why and sends nothing; Enter on the star is the star’s, not the face’s', () => {
    const el = mount(board({ ...RUN, star: { on: true, disabled: '다른 인스턴스의 세션' } }));
    const star = card(el, 'notes').querySelector<HTMLButtonElement>('button.ib-star')!;
    expect(star.getAttribute('aria-disabled')).toBe('true');
    expect(star.getAttribute('title')).toBe('다른 인스턴스의 세션');
    // The reason reaches a screen reader too, not only the tooltip.
    expect(star.textContent).toBe('Star — 다른 인스턴스의 세션');
    const stars = vi.fn();
    el.addEventListener('ui-star', stars);
    star.click();
    expect(stars).not.toHaveBeenCalled();
    const toggles = vi.fn();
    el.addEventListener('ui-toggle', toggles);
    key(star, 'Enter');
    expect(toggles).not.toHaveBeenCalled();
  });

  it('Korean names the star in Korean; no star without data', () => {
    const el = mount(board({ ...RUN, star: { on: false } }), { lang: 'ko' });
    expect(card(el, 'notes').querySelector('button.ib-star')?.textContent).toBe('즐겨찾기');
    el.data = board({ ...RUN, star: { on: true } });
    el.renderNow();
    const on = card(el, 'notes').querySelector('button.ib-star')!;
    expect(on.textContent).toBe('즐겨찾기');
    expect(on.getAttribute('aria-pressed')).toBe('true');
    expect(on.getAttribute('title')).toBe('즐겨찾기 해제');
    el.data = board(RUN);
    el.renderNow();
    expect(card(el, 'notes').querySelector('button.ib-star')).toBeNull();
  });

  it('a glyph-only lead draws the glyph with its title as the name — an epic and a plain task tell apart', () => {
    const el = mount(
      board(
        { ...RUN, lead: { glyph: 'epic', text: 'EPIC', title: '에픽' } },
        { ...WAIT, lead: { glyph: 'task', title: '일반 작업' } },
      ),
    );
    const epic = card(el, 'notes').querySelector<HTMLElement>('.ib-lead')!;
    expect(epic.querySelector('svg')).not.toBeNull();
    expect(epic.textContent).toBe('EPIC');
    const task = card(el, 'migrate').querySelector<HTMLElement>('.ib-lead')!;
    expect(task.classList.contains('is-icon')).toBe(true);
    expect(task.querySelector('svg')).not.toBeNull();
    expect(task.getAttribute('role')).toBe('img');
    expect(task.getAttribute('aria-label')).toBe('일반 작업');
    expect(card(el, 'migrate').querySelector('.ib-spark')).toBeNull();
    // An unknown glyph with no text is no lead: the spark.
    el.data = board({ ...WAIT, lead: { glyph: 'nope' as never } });
    el.renderNow();
    expect(card(el, 'migrate').querySelector('.ib-spark')).not.toBeNull();
  });

  it('vendor glyphs mark a model metric: claude, openai, grok, gemini and any other model', () => {
    const vendors = ['claude', 'openai', 'grok', 'gemini', 'model'] as const;
    const el = mount(board({ ...RUN, metrics: vendors.map((v) => ({ text: v, glyph: v, title: `${v} model` })) }));
    const ms = Array.from(card(el, 'notes').querySelectorAll<HTMLElement>('.ib-metric.is-host'));
    expect(ms.map((m) => m.textContent)).toEqual([...vendors]);
    const svgs = ms.map((m) => m.querySelector('svg')?.outerHTML ?? '');
    for (const s of svgs) expect(s).not.toBe('');
    // Five different marks.
    expect(new Set(svgs).size).toBe(5);
  });
});

describe('face row order (0.17.0)', () => {
  const rowsOf = (el: UiAgentInbox, id: string) =>
    Array.from(card(el, id).querySelectorAll<HTMLElement>('.ib-face > div'))
      .map((d) => d.className.split(' ')[0])
      .filter((c) => c !== 'ib-head' && c !== 'ib-foot');
  const FULL: InboxCard = { ...RUN, summary: 'Why it is here' };

  it('without rows: every row, in the default order', () => {
    const el = mount(board(FULL));
    expect(rowsOf(el, 'notes')).toEqual(['ib-summary', 'ib-task', 'ib-agents', 'ib-usage', 'ib-arts']);
  });

  it('rows draws only the rows it names, in its order', () => {
    const el = mount(board({ ...FULL, rows: ['artifacts', 'task', 'summary'] }));
    expect(rowsOf(el, 'notes')).toEqual(['ib-arts', 'ib-task', 'ib-summary']);
    // The foot (status, metrics) is not a row: it stays.
    expect(card(el, 'notes').querySelector('.ib-foot .ib-metrics')).not.toBeNull();
  });

  it('an empty list draws no rows; unknown names and repeats are skipped', () => {
    const none = mount(board({ ...FULL, rows: [] }));
    expect(rowsOf(none, 'notes')).toEqual([]);
    document.body.innerHTML = '';
    const odd = mount(board({ ...FULL, rows: ['usage', 'nope' as never, 'usage', 'agents'] }));
    expect(rowsOf(odd, 'notes')).toEqual(['ib-usage', 'ib-agents']);
  });
});

describe('linked issues, PRs and wikis on the face (0.19.0)', () => {
  const LINKS: InboxCard['links'] = [
    {
      kind: 'issue',
      href: 'https://acme.atlassian.net/browse/PROJ-12',
      text: 'PROJ-12',
      status: '진행 중',
      tone: 'run',
      title: 'PROJ-12 — 결제 폼',
    },
    { kind: 'pr', href: 'https://github.com/acme/app/pull/733', text: '#733', status: '머지됨', tone: 'done' },
    { kind: 'wiki', href: 'https://acme.atlassian.net/wiki/spaces/ENG/pages/1/Design', text: 'Design' },
  ];
  const rowsOf = (el: UiAgentInbox, id: string) =>
    Array.from(card(el, id).querySelectorAll<HTMLElement>('.ib-face > div'))
      .map((d) => d.className.split(' ')[0])
      .filter((c) => c !== 'ib-head' && c !== 'ib-foot');

  it('draws each link as a chip that opens its page in a new tab, with its kind mark and its status', () => {
    const el = mount(board({ ...RUN, links: LINKS }));
    const chips = Array.from(card(el, 'notes').querySelectorAll<HTMLAnchorElement>('.ib-links a.ib-link'));
    expect(chips.map((a) => a.className)).toEqual(['ib-link is-issue', 'ib-link is-pr', 'ib-link is-wiki']);
    expect(chips.map((a) => a.getAttribute('href'))).toEqual(LINKS!.map((l) => l.href));
    for (const a of chips) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
      expect(a.querySelector('svg')).not.toBeNull();
    }
    expect(chips[0].querySelector('.ib-link-text')?.textContent).toBe('PROJ-12');
    const st = chips[0].querySelector<HTMLElement>('.ib-link-st')!;
    expect([st.textContent, st.getAttribute('data-tone')]).toEqual(['진행 중', 'run']);
    expect(chips[1].querySelector('.ib-link-st')?.getAttribute('data-tone')).toBe('done');
    expect(chips[2].querySelector('.ib-link-st')).toBeNull(); // a wiki has no status
    expect(chips[0].getAttribute('title')).toBe('PROJ-12 — 결제 폼');
  });

  it('only http(s) links are drawn; the rest of the list survives a bad entry', () => {
    const el = mount(
      board({
        ...RUN,
        links: [
          { kind: 'issue', href: 'javascript:alert(1)', text: 'x' },
          { kind: 'pr', href: '/relative', text: 'y' },
          { kind: 'nope' as never, href: 'https://e.test/a', text: 'z' },
          { kind: 'wiki', href: 'https://e.test/w', text: '' },
          ...LINKS!,
        ],
      }),
    );
    expect(card(el, 'notes').querySelectorAll('.ib-links a.ib-link')).toHaveLength(3);
  });

  it('a click on a link opens it and tells the host (ui-link); the card does not open', () => {
    const el = mount(board({ ...RUN, links: LINKS }));
    const seen: unknown[] = [];
    el.addEventListener('ui-link', (e) => seen.push((e as CustomEvent).detail));
    const a = card(el, 'notes').querySelector<HTMLAnchorElement>('a.ib-link.is-pr')!;
    a.addEventListener('click', (e) => e.preventDefault()); // jsdom: no navigation
    a.click();
    expect(seen).toEqual([{ cardId: 'notes', href: 'https://github.com/acme/app/pull/733', kind: 'pr' }]);
    expect(card(el, 'notes').classList.contains('is-open')).toBe(false);
  });

  it('without rows the links follow the task; rows can place them anywhere; many links end in +N', () => {
    const full = mount(board({ ...RUN, summary: 'Why', links: LINKS }));
    expect(rowsOf(full, 'notes')).toEqual(['ib-summary', 'ib-task', 'ib-links', 'ib-agents', 'ib-usage', 'ib-arts']);
    document.body.innerHTML = '';
    const placed = mount(board({ ...RUN, links: LINKS, rows: ['links', 'task'] }));
    expect(rowsOf(placed, 'notes')).toEqual(['ib-links', 'ib-task']);
    document.body.innerHTML = '';
    const many = Array.from({ length: 9 }, (_, i) => ({
      kind: 'pr' as const,
      href: `https://e.test/p/${i}`,
      text: `#${i}`,
    }));
    const lots = mount(board({ ...RUN, links: many }));
    expect(card(lots, 'notes').querySelectorAll('.ib-links a.ib-link')).toHaveLength(6);
    expect(card(lots, 'notes').querySelector('.ib-links-more')?.textContent).toBe('+3');
  });

  it('no links, no row; issue and wiki marks are host glyphs too', () => {
    const el = mount(
      board({
        ...RUN,
        links: [],
        metrics: [
          { text: 'PROJ-1', glyph: 'issue' },
          { text: 'Doc', glyph: 'wiki' },
        ],
      }),
    );
    expect(card(el, 'notes').querySelector('.ib-links')).toBeNull();
    expect(card(el, 'notes').querySelectorAll('.ib-metric.is-host svg')).toHaveLength(2);
  });
});

// 0.20.0 — a TL;DR on the face (soma-work 2026-11-02: the Executive Summary's three lines), dismissible with ×.
describe('face TL;DR row (0.20.0)', () => {
  const faceOf = (el: UiAgentInbox, id: string) => card(el, id).querySelector<HTMLElement>('.ib-face')!;
  const TLDR = {
    lines: ['PR #771 merged — the viewer fills the screen.', 'CI green on main.', 'Next: deploy to dev.'],
  };

  it('draws the lines under the summary by default, labelled, each line escaped', () => {
    const el = mount(
      board({ ...RUN, summary: 'Why it is here', tldr: { lines: [...TLDR.lines, '<img src=x onerror=alert(1)>'] } }),
    );
    const box = card(el, 'notes').querySelector<HTMLElement>('.ib-tldr')!;
    expect(box).not.toBeNull();
    expect(box.querySelector('.ib-tldr-label')?.textContent).toBe('TL;DR');
    const lines = Array.from(box.querySelectorAll('li')).map((li) => li.textContent);
    expect(lines).toEqual([...TLDR.lines, '<img src=x onerror=alert(1)>']);
    expect(box.querySelector('img')).toBeNull();
    // Default order: summary, then the TL;DR, then the task.
    const rows = Array.from(faceOf(el, 'notes').children).map((d) => d.className.split(' ')[0]);
    expect(rows.indexOf('ib-tldr')).toBe(rows.indexOf('ib-summary') + 1);
    expect(rows.indexOf('ib-task')).toBe(rows.indexOf('ib-tldr') + 1);
  });

  it('× sends ui-dismiss { cardId, what: "tldr" } and never toggles the card; the host owns the state', () => {
    const el = mount(board({ ...RUN, tldr: TLDR }));
    const x = card(el, 'notes').querySelector<HTMLButtonElement>('button.ib-tldr-x')!;
    expect(x).not.toBeNull();
    expect(x.getAttribute('data-dismiss')).toBe('tldr');
    expect(x.getAttribute('aria-label')).toBe('Dismiss TL;DR');
    const got: unknown[] = [];
    const toggles = vi.fn();
    el.addEventListener('ui-dismiss', (e) => got.push((e as CustomEvent).detail));
    el.addEventListener('ui-toggle', toggles);
    x.click();
    expect(got).toEqual([{ cardId: 'notes', what: 'tldr' }]);
    expect(toggles).not.toHaveBeenCalled();
    expect(faceOf(el, 'notes').getAttribute('aria-expanded')).not.toBe('true');
    // Enter on × is the button's (the face does not take it).
    key(x, 'Enter');
    expect(toggles).not.toHaveBeenCalled();
    // Still drawn until the host drops it.
    expect(card(el, 'notes').querySelector('.ib-tldr')).not.toBeNull();
    el.data = board(RUN);
    el.renderNow();
    expect(card(el, 'notes').querySelector('.ib-tldr')).toBeNull();
  });

  it('focus on × goes to the card’s face when the host drops the box (review: astra P2)', () => {
    const el = mount(board({ ...RUN, tldr: TLDR }));
    card(el, 'notes').querySelector<HTMLButtonElement>('button.ib-tldr-x')!.focus();
    el.data = board(RUN);
    el.renderNow();
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.classList.contains('ib-face')).toBe(true);
  });

  it('dismissible: false draws no ×; a host title replaces the label; at most five lines, blanks dropped', () => {
    const el = mount(
      board({
        ...RUN,
        tldr: { title: 'Executive Summary', dismissible: false, lines: ['1', ' ', '2', '3', '4', '5', '6'] },
      }),
    );
    const box = card(el, 'notes').querySelector<HTMLElement>('.ib-tldr')!;
    expect(box.querySelector('button')).toBeNull();
    expect(box.querySelector('.ib-tldr-label')?.textContent).toBe('Executive Summary');
    expect(Array.from(box.querySelectorAll('li')).map((li) => li.textContent)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('no row without lines, and rows can leave it out; Korean names the ×', () => {
    const empty = mount(board({ ...RUN, tldr: { lines: [' ', ''] } }));
    expect(card(empty, 'notes').querySelector('.ib-tldr')).toBeNull();
    document.body.innerHTML = '';
    const left = mount(board({ ...RUN, tldr: TLDR, rows: ['summary', 'task'] }));
    expect(card(left, 'notes').querySelector('.ib-tldr')).toBeNull();
    document.body.innerHTML = '';
    const ko = mount(board({ ...RUN, tldr: TLDR }), { lang: 'ko' });
    const x = card(ko, 'notes').querySelector<HTMLButtonElement>('button.ib-tldr-x')!;
    expect(x.getAttribute('aria-label')).toBe('TL;DR 닫기');
    expect(x.getAttribute('title')).toBe('TL;DR 닫기');
  });
});

// 0.25.0 — the mono palette (--chroma 0): a state shows its colour on its mark only.
describe('mono palette rules', () => {
  const css = monoStyles.replace(/\s+/g, ' ');
  it('the status tag: the card and ink in colour, the neutral pill and secondary ink in mono; the icon keeps the tone', () => {
    expect(css).toContain(
      '--ib-tone-base: color-mix(in srgb, var(--ib-card) calc(100% * var(--chroma)), var(--ib-pill));',
    );
    expect(css).toContain(
      '--ib-tone-ink: color-mix(in srgb, var(--ib-text) calc(100% * var(--chroma)), var(--ib-text-2));',
    );
    for (const t of ['run', 'wait', 'done'])
      expect(css).toContain(
        `--ib-${t}-bg: color-mix(in srgb, var(--st-${t}) calc(16% * var(--chroma)), var(--ib-tone-base));`,
      );
    expect(css).toContain(
      '.ib-tag[data-tone="run"], .ib-metric.is-host[data-tone="run"] { --ib-tone-c: var(--st-run); }',
    );
    expect(css).toContain(
      '.ib-tag-icon, .ib-metric.is-host[data-tone] > svg { color: color-mix(in srgb, currentColor calc(100% * var(--chroma)), var(--ib-tone-c, currentColor)); }',
    );
  });

  it('the TL;DR: no wash in mono, and its status border grows from 22% to 70%', () => {
    expect(css).toContain('background: color-mix(in srgb, var(--st-color) calc(7% * var(--chroma)), var(--ib-card));');
    expect(css).toContain(
      'box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--st-color) calc(22% + 48% * (1 - var(--chroma))), transparent);',
    );
    expect(css).toContain('color: color-mix(in srgb, var(--st-color) calc(55% * var(--chroma)), var(--ib-text));');
  });

  it("the model mark: the maker's colour in colour, the metric's ink in mono", () => {
    expect(css).toContain(
      'color: color-mix(in srgb, var(--ib-model-hue, currentColor) calc(100% * var(--chroma)), currentColor);',
    );
  });
});

// SSOT 2026-11-05 (Z): "응답 필요 상태인 "내꺼" 작업 카드(collapsed 상태)는 추가 ui 표시해줘 10초에 한번씩 어텐션을
// 요구하는 뭔가 행동 추가해줘. 이건 리서치해서 현재의 모노톤 톤앤 매너에 맞게 개선"
describe('attention (0.32.0) — a collapsed card that waits on the viewer', () => {
  const css = monoStyles.replace(/\s+/g, ' ');
  // happy-dom has no Web Animations: each connected card gets its ping (its ::after) and an unrelated fade.
  type Anim = { animationName: string; startTime: number | null };
  let anims: Map<Element, Anim[]>;
  let had: PropertyDescriptor | undefined;
  const proto = HTMLElement.prototype as unknown as { getAnimations?: (this: Element) => Anim[] };
  beforeEach(() => {
    anims = new Map();
    had = Object.getOwnPropertyDescriptor(proto, 'getAnimations');
    proto.getAnimations = function (this: Element) {
      if (!this.isConnected) return [];
      if (!anims.has(this))
        anims.set(this, [
          { animationName: 'ib-attn-ping', startTime: null },
          { animationName: 'ib-fade', startTime: 7 },
        ]);
      return anims.get(this)!;
    };
  });
  afterEach(() => {
    if (had) Object.defineProperty(proto, 'getAnimations', had);
    else delete proto.getAnimations;
  });

  it('marks only `attention: true` cards; dropping it takes the mark away; the card keeps its node', () => {
    const el = mount(
      board(
        { ...WAIT, id: 'mine', attention: true },
        { ...WAIT, id: 'theirs' },
        { ...WAIT, id: 'truthy', attention: 'yes' as unknown as boolean },
      ),
    );
    const mine = card(el, 'mine');
    expect(mine.classList.contains('is-attention')).toBe(true);
    for (const id of ['theirs', 'truthy']) expect(card(el, id).classList.contains('is-attention'), id).toBe(false);
    el.data = board({ ...WAIT, id: 'mine' }, { ...WAIT, id: 'theirs', attention: true });
    el.renderNow();
    expect(card(el, 'mine')).toBe(mine);
    expect(mine.classList.contains('is-attention')).toBe(false);
    expect(card(el, 'theirs').classList.contains('is-attention')).toBe(true);
  });

  it('every attention card nudges on one shared 10 s beat: the ping starts at the document timeline’s origin', () => {
    expect(ATTENTION_BEAT_MS).toBe(10_000);
    const el = mount(board({ ...WAIT, id: 'a', attention: true }, { ...WAIT, id: 'b', attention: true }, RUN));
    for (const id of ['a', 'b'])
      expect(
        anims.get(card(el, id))?.map((a) => a.startTime),
        id,
      ).toEqual([0, 7]);
    // A card without attention is never touched.
    expect(anims.has(card(el, 'notes'))).toBe(false);
    // The browser restarted the ping (the card moved, or was shown again): the next render puts it back on the beat.
    anims.get(card(el, 'a'))![0].startTime = 1234;
    el.data = board(
      { ...WAIT, id: 'a', attention: true, summary: 'Still waiting.' },
      { ...WAIT, id: 'b', attention: true },
    );
    el.renderNow();
    expect(anims.get(card(el, 'a'))?.[0].startTime).toBe(0);
  });

  it('opening the card stops the cue (CSS); closing it again puts the ping back on the shared beat at once', () => {
    const el = mount(board({ ...WAIT, attention: true }));
    const c = card(el, 'migrate');
    const face = c.querySelector<HTMLElement>('.ib-face')!;
    face.click();
    expect(c.classList.contains('is-open')).toBe(true);
    // The browser drops the ping while open and starts a new one when it closes — off the beat until synced.
    anims.get(c)![0].startTime = 4321;
    face.click();
    expect(c.classList.contains('is-open')).toBe(false);
    expect(anims.get(c)?.[0].startTime).toBe(0);
    // Every visible mark of the cue is scoped to the collapsed card.
    const rules = css.match(/[^{}]*\.is-attention[^{}]*\{/g) ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules)
      for (const sel of r.replace(/\{$/, '').split(','))
        if (sel.includes('.is-attention')) expect(sel, sel).toContain('.ib-card.is-attention:not(.is-open)');
  });

  it('styles: a static mark plus a 10 s ping; mono-safe; still under reduced motion; a system colour in forced colours', () => {
    // The mark's colour: the waiting status in the colour themes, the ink in mono (it follows --chroma).
    expect(css).toContain('--ib-attn: color-mix(in srgb, var(--st-wait) calc(100% * var(--chroma)), var(--ib-text));');
    // The ping: one infinite 10 s animation on the card's ::after; its keyframes exist.
    expect(css).toMatch(
      /\.ib-card\.is-attention:not\(\.is-open\)::after \{[^}]*animation: ib-attn-ping 10000ms [^;}]*infinite;/,
    );
    expect(css).toMatch(/@keyframes ib-attn-ping \{/);
    // No layout property is animated (the ring is a box-shadow: paint only, no layout — not compositor-only).
    const frames = /@keyframes ib-attn-ping \{(.*?\}) \}/.exec(css)?.[1] ?? '';
    expect(frames).not.toBe('');
    expect(frames).not.toMatch(/\b(width|height|top|left|right|bottom|margin|padding|inset)\s*:/);
    // Reduced motion: the ping goes, the static mark stays.
    expect(css).toMatch(
      /prefers-reduced-motion: reduce\) \{[^@]*\.ib-card\.is-attention:not\(\.is-open\)::after \{ animation: none; display: none; \}/,
    );
    // Held, never stuck: hover only on pointer devices (a tap's sticky :hover would hide it on touch), and a keyboard
    // focus, not any focus (a face clicked closed keeps the focus — its ping must come back).
    expect(css).not.toMatch(/\.ib-card\.is-attention[^{]*:focus-within/);
    expect(css).toMatch(
      /\.ib-card\.is-attention:not\(\.is-open\):is\(:has\(:focus-visible\), \.is-flying\)::after \{ visibility: hidden; \}/,
    );
    const hoverBlock = /@media \(hover: hover\) and \(pointer: fine\) \{(.*?)\} \/\* 44px/.exec(css)?.[1] ?? '';
    expect(hoverBlock).toContain('.ib-card.is-attention:not(.is-open):hover::after { visibility: hidden; }');
    expect(hoverBlock).toContain('.ib-card.is-attention:not(.is-open):hover { border-color: var(--ib-attn); }');
    const outside = css.replace(/@media \(hover: hover\) and \(pointer: fine\) \{.*?\} \/\* 44px/, '');
    expect(outside).not.toMatch(/\.ib-card\.is-attention[^{]*:hover/);
    // Forced colours: the mark in a system colour.
    expect(css).toMatch(/forced-colors: active\) \{[^@]*\.ib-card\.is-attention:not\(\.is-open\)[^{]*\{[^}]*Highlight/);
  });
});
