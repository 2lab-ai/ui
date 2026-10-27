import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AgentInboxData,
  agentDots,
  artifactKind,
  BOARD_HOLD_MS,
  boardCounts,
  columnsByStatus,
  holdLanes,
  type InboxCard,
  placeHolds,
  statusTone,
  type UiAgentInbox,
} from './agent-inbox';

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
    expect(card(el, 'digest').querySelector('.ib-tag')?.textContent).toBe('완료 · 4m 12s13시간 전');
    expect(card(el, 'notes').querySelector('[data-open]')?.textContent).toBe('작업 로그');
    expect(q(el, '[aria-live="polite"]')?.textContent).toBe('응답이 필요한 세션 1개, 실행 중 1개');
    const empty = mount({ columns: columnsByStatus([], 'ko') }, { lang: 'ko' });
    expect(q(empty, '.ib-empty')?.textContent).toBe('비어 있음');
  });
});
