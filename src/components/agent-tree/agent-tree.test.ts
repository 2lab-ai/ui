import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import type { UiAgentTree } from './agent-tree';
import './agent-tree';
import type { AgentTreeData, AgentTreeNode } from './logic';
import {
  agentInitials,
  buildTree,
  durationOf,
  fmtCost,
  idPart,
  nearestVisible,
  normAgentStatus,
  spanAxis,
  spanOf,
  ticks,
  treeKeyAction,
  typeaheadIndex,
  visibleItems,
  worseOf,
} from './logic';
import { morphChildren } from './morph';
import { agentTreeStrings } from './strings';

const XSS = '<img src=x onerror=alert(1)>';
const T0 = 1_800_000_000_000;

const N = (id: string, parentId: string | undefined, over: Partial<AgentTreeNode> = {}): AgentTreeNode => ({
  id,
  ...(parentId ? { parentId } : {}),
  name: `Agent ${id}`,
  status: 'done',
  ...over,
});

// main ─┬─ a ─┬─ a1 (running)
//       │     └─ a2 (failed)
//       ├─ b (needs_you)
//       └─ c
const NODES: AgentTreeNode[] = [
  N('main', undefined, { name: 'Main', status: 'running', startedAt: T0, costUsd: 1, tokens: 1000, toolCalls: 10 }),
  N('a', 'main', {
    name: 'Alpha',
    costUsd: 0.5,
    tokens: 500,
    toolCalls: 5,
    startedAt: T0 + 1000,
    endedAt: T0 + 61_000,
  }),
  N('a1', 'a', { name: 'Apple', status: 'running', costUsd: 0.25, startedAt: T0 + 2000, summary: 'Reading files' }),
  N('a2', 'a', {
    name: 'Avocado',
    status: 'failed',
    costUsd: 0.25,
    reason: 'Exit code 1',
    startedAt: T0 + 3000,
    endedAt: T0 + 9000,
  }),
  N('b', 'main', { name: 'Bravo', status: 'needs_you', reason: 'Approve Bash: rm -rf dist', startedAt: T0 + 4000 }),
  N('c', 'main', { name: 'Charlie', startedAt: T0 + 5000, endedAt: T0 + 6000 }),
];

function mount(data: AgentTreeData, attrs: Record<string, string> = {}): UiAgentTree {
  const el = document.createElement('ui-agent-tree');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <T extends Element = HTMLElement>(el: UiAgentTree, sel: string) =>
  el.shadowRoot?.querySelector<T>(sel) ?? null;
const qa = (el: UiAgentTree, sel: string) => [...(el.shadowRoot?.querySelectorAll<HTMLElement>(sel) ?? [])];
const item = (el: UiAgentTree, id: string) => qa(el, '.at-item').find((li) => li.dataset.id === id) ?? null;
const row = (el: UiAgentTree, id: string) => item(el, id)?.querySelector<HTMLElement>(':scope > .at-row') ?? null;
const ids = (el: UiAgentTree) => qa(el, '.at-item').map((li) => li.dataset.id);
const active = (el: UiAgentTree) => (el.shadowRoot?.activeElement as HTMLElement | null)?.dataset?.id;
function events<T>(el: UiAgentTree, name: string): T[] {
  const out: T[] = [];
  el.addEventListener(name, (e) => out.push((e as CustomEvent<T>).detail));
  return out;
}
function key(el: UiAgentTree, id: string, k: string): void {
  item(el, id)?.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true }),
  );
}
const set = (el: UiAgentTree, patch: Partial<AgentTreeData>) => {
  el.data = { ...el.data!, ...patch };
  el.renderNow();
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('logic', () => {
  it('normAgentStatus keeps the seven statuses, maps the common aliases and reads anything else as unknown', () => {
    expect(normAgentStatus('needs_you')).toBe('needs_you');
    expect(normAgentStatus('completed')).toBe('done');
    expect(normAgentStatus('stopped')).toBe('cancelled');
    expect(normAgentStatus('queued')).toBe('waiting');
    expect(normAgentStatus('exploded')).toBe('unknown');
    expect(normAgentStatus(undefined)).toBe('unknown');
  });

  it('buildTree hangs nodes from parentId in spawn order; orphans go to the top, duplicates and empty ids are skipped', () => {
    const m = buildTree([
      N('r', undefined),
      N('x', 'r'),
      N('o', 'ghost'),
      N('x', 'o'),
      { id: '', name: 'nobody' },
      N('y', 'r'),
      7,
    ]);
    expect(m.roots.map((r) => r.id)).toEqual(['r', 'o']);
    expect(m.byId.get('r')?.children.map((c) => c.id)).toEqual(['x', 'y']);
    expect(m.all.map((i) => i.id)).toEqual(['r', 'x', 'y', 'o']);
    expect(m.byId.get('y')?.index).toBe(1);
    expect(m.byId.get('x')?.depth).toBe(1);
  });

  it('buildTree breaks cycles and self-parents safely', () => {
    const m = buildTree([N('a', 'b'), N('b', 'a'), N('s', 's'), N('c', 'a')]);
    expect(m.all).toHaveLength(4);
    expect(m.byId.get('s')?.parent).toBeNull();
    // Every node is reachable exactly once from a root.
    expect(new Set(m.all.map((i) => i.id)).size).toBe(4);
    expect(m.roots.length).toBeGreaterThanOrEqual(2);
    const long = Array.from({ length: 3000 }, (_, i) => N(`n${i}`, i ? `n${i - 1}` : undefined));
    const deep = buildTree(long);
    expect(deep.depth).toBe(2999);
    expect(deep.byId.get('n0')?.branch.below).toBe(2999);
  });

  it('rolls up tokens, cost and tool calls per branch; absent stays absent; worst status and counts below', () => {
    const m = buildTree(NODES);
    const main = m.byId.get('main')!;
    expect(main.branch.costUsd).toBeCloseTo(2);
    expect(main.branch.tokens).toBe(1500);
    expect(main.branch.toolCalls).toBe(15);
    expect(main.branch.below).toBe(5);
    expect(main.branch.worst).toBe('needs_you');
    expect(main.branch.live).toBe(true);
    const a = m.byId.get('a')!;
    expect(a.branch.costUsd).toBeCloseTo(1);
    expect(a.branch.worst).toBe('failed');
    expect(a.branch.counts).toEqual({ running: 1, failed: 1 });
    expect(m.byId.get('c')!.branch.tokens).toBeUndefined();
    expect(m.counts).toMatchObject({ running: 2, failed: 1, needs_you: 1, done: 2 });
    expect(m.total.costUsd).toBeCloseTo(2);
    expect(worseOf('done', 'running')).toBe('running');
    expect(worseOf(undefined, 'failed')).toBe('failed');
  });

  it('visibleItems skips closed branches; nearestVisible walks up', () => {
    const m = buildTree(NODES);
    const vis = visibleItems(m, (it) => it.id !== 'a');
    expect(vis.map((v) => v.id)).toEqual(['main', 'a', 'b', 'c']);
    const set = new Set(vis.map((v) => v.id));
    expect(nearestVisible(m.byId.get('a2'), set)?.id).toBe('a');
  });

  it('durations run while open, spans sit on one axis', () => {
    const m = buildTree(NODES);
    const now = T0 + 100_000;
    expect(durationOf(m.byId.get('a')!.node, now)).toBe(60_000);
    expect(durationOf(m.byId.get('a1')!.node, now)).toBe(98_000);
    expect(durationOf(N('z', undefined, { status: 'done', startedAt: T0 }) as never, now)).toBeUndefined();
    expect(ticks(m.byId.get('a1')!.node)).toBe(true);
    expect(ticks(m.byId.get('c')!.node)).toBe(false);
    const axis = spanAxis(
      m.all.map((i) => i.node),
      now,
    )!;
    expect(axis).toEqual({ t0: T0, t1: now });
    expect(spanOf(m.byId.get('main')!.node, axis, now)).toEqual({ left: 0, width: 100, open: true });
    const c = spanOf(m.byId.get('c')!.node, axis, now)!;
    expect(c.left).toBe(5);
    expect(c.width).toBe(1.5);
    expect(spanAxis([], now)).toBeNull();
  });

  it('treeKeyAction follows the WAI-ARIA tree pattern; typeaheadIndex wraps', () => {
    const leaf = { hasKids: false, open: false, hasParent: true };
    expect(treeKeyAction('ArrowRight', { ...leaf, hasKids: true })).toBe('expand');
    expect(treeKeyAction('ArrowRight', { ...leaf, hasKids: true, open: true })).toBe('child');
    expect(treeKeyAction('ArrowRight', leaf)).toBe('');
    expect(treeKeyAction('ArrowLeft', { ...leaf, hasKids: true, open: true })).toBe('collapse');
    expect(treeKeyAction('ArrowLeft', leaf)).toBe('parent');
    expect(treeKeyAction('ArrowLeft', { ...leaf, hasParent: false })).toBe('');
    expect(treeKeyAction('*', leaf)).toBe('siblings');
    expect(treeKeyAction(' ', leaf)).toBe('select');
    const names = ['Main', 'Alpha', 'Apple', 'Bravo'];
    expect(typeaheadIndex(names, 0, 'a')).toBe(1);
    expect(typeaheadIndex(names, 2, 'a')).toBe(1);
    expect(typeaheadIndex(names, 1, 'ap')).toBe(2);
    expect(typeaheadIndex(names, 0, 'z')).toBe(-1);
  });

  it('fmtCost, initials and idPart', () => {
    expect(fmtCost(0.004)).toBe('<$0.01');
    expect(fmtCost(0)).toBe('$0.00');
    expect(fmtCost(3.456)).toBe('$3.46');
    expect(agentInitials('A3 general-purpose')).toBe('AG');
    expect(agentInitials('메인')).toBe('메');
    expect(agentInitials('')).toBe('·');
    expect(idPart('a-b')).not.toBe(idPart('a_b'));
    expect(idPart('x"<y')).toMatch(/^[A-Za-z0-9_]+$/);
  });

  it('morphChildren keeps keyed nodes, reorders and removes', () => {
    const a = document.createElement('div');
    a.innerHTML = '<p data-key="1">one</p><p data-key="2">two</p><span class="x">s</span>';
    const one = a.children[0];
    const two = a.children[1];
    const b = document.createElement('div');
    b.innerHTML = '<p data-key="2" class="on">TWO</p><p data-key="1">one</p><p data-key="3">three</p>';
    morphChildren(a, b);
    expect(a.innerHTML).toBe('<p data-key="2" class="on">TWO</p><p data-key="1">one</p><p data-key="3">three</p>');
    expect(a.children[0]).toBe(two);
    expect(a.children[1]).toBe(one);
  });
});

describe('<ui-agent-tree>', () => {
  it('renders a WAI-ARIA tree: levels, set sizes, one tab stop, everything open by default', () => {
    const el = mount({ nodes: NODES, now: T0 + 70_000 });
    expect(q(el, '[role="tree"]')?.getAttribute('aria-label')).toBe('Agents');
    expect(ids(el)).toEqual(['main', 'a', 'a1', 'a2', 'b', 'c']);
    expect(item(el, 'a1')?.getAttribute('aria-level')).toBe('3');
    expect(item(el, 'b')?.getAttribute('aria-posinset')).toBe('2');
    expect(item(el, 'b')?.getAttribute('aria-setsize')).toBe('3');
    expect(item(el, 'a')?.getAttribute('aria-expanded')).toBe('true');
    expect(item(el, 'c')?.hasAttribute('aria-expanded')).toBe(false);
    expect(qa(el, '[role="treeitem"][tabindex="0"]').map((li) => li.dataset.id)).toEqual(['main']);
    expect(item(el, 'a1')?.parentElement?.getAttribute('role')).toBe('group');
    // G1-1: every row is a place-keeping anchor for a <ui-log-scroller> that holds the tree as one item.
    expect(qa(el, '.at-item').every((li) => li.hasAttribute('data-anchor'))).toBe(true);
    expect(el.expanded).toEqual(['main', 'a']);
  });

  it('rich: cards with pill, summary, reason on needs_you / failed, branch cost, time and the waterfall', () => {
    const el = mount({ nodes: NODES, now: T0 + 70_000 });
    expect(q(el, '.at')?.getAttribute('data-density')).toBe('rich');
    expect(row(el, 'a1')?.querySelector('.at-task')?.textContent).toBe('Reading files');
    expect(row(el, 'b')?.querySelector('.at-reason')?.textContent).toBe('Approve Bash: rm -rf dist');
    expect(row(el, 'a2')?.querySelector('.at-pill')?.textContent).toBe('Failed');
    // A parent shows its branch; a leaf its own.
    expect(row(el, 'a')?.querySelector('.at-cost')?.textContent).toBe('$1.00');
    expect(row(el, 'a2')?.querySelector('.at-cost')?.textContent).toBe('$0.25');
    expect(row(el, 'a')?.querySelector('.at-time')?.textContent).toBe('1m 00s');
    expect(row(el, 'a1')?.querySelector('.at-time')?.textContent).toBe('1m 08s');
    expect(row(el, 'a')?.querySelector('.at-fold')?.textContent).toBe('2');
    expect(qa(el, '.at-span > i')).toHaveLength(6);
    expect(item(el, 'a')?.getAttribute('aria-label')).toContain(
      '$1.00 for this branch with its sub-agents (own $0.50)',
    );
    expect(item(el, 'a1')?.getAttribute('aria-describedby')).toBe(row(el, 'a1')?.querySelector('.at-time')?.id);
    // The bar
    const sum = q(el, '.at-sum')?.textContent ?? '';
    expect(sum).toContain('6 agents');
    expect(sum).toContain('2 running');
    expect(sum).toContain('1 needs you');
    expect(sum).toContain('1 failed');
    expect(sum).toContain('$2.00');
  });

  it('compact: rows with status words; the line only on live / failed ones, the reason first', () => {
    const el = mount({ nodes: NODES, density: 'compact', now: T0 + 70_000 });
    expect(q(el, '.at-card')).toBeNull();
    expect(row(el, 'a1')?.querySelector('.at-line')?.textContent).toBe('Reading files');
    expect(row(el, 'a2')?.querySelector('.at-line.is-reason')?.textContent).toBe('Exit code 1');
    expect(row(el, 'c')?.querySelector('.at-line')).toBeNull();
    expect(row(el, 'b')?.querySelector('.at-st')?.textContent).toBe('Needs you');
    expect(qa(el, '.at-span')).toHaveLength(0);
  });

  it('escapes every host string', () => {
    const nodes: AgentTreeNode[] = [
      { id: XSS, name: XSS, role: XSS, status: 'running', summary: XSS, startedAt: T0 },
      { id: `${XSS}2`, parentId: XSS, name: XSS, role: XSS, status: 'failed', reason: XSS, summary: XSS },
      { id: `${XSS}3`, parentId: XSS, name: XSS, status: 'needs_you', reason: XSS },
    ];
    for (const density of ['rich', 'compact'] as const) {
      const el = mount({ nodes, density, title: XSS, now: T0 + 5000 });
      expect(q(el, 'img')).toBeNull();
      expect(qa(el, '[onerror]')).toHaveLength(0);
      expect(q(el, '.at-title')?.textContent).toBe(XSS);
      expect(qa(el, '.at-name').every((n) => n.textContent === XSS)).toBe(true);
      expect(item(el, XSS)?.dataset.id).toBe(XSS);
      expect(item(el, XSS)?.getAttribute('aria-label')).toContain(XSS);
      // Folded, the badge and label still escape.
      set(el, { expanded: [] });
      expect(q(el, 'img')).toBeNull();
      el.remove();
    }
  });

  it('click selects (ui-select, cancelable); uncontrolled the tree moves its own selection', () => {
    const el = mount({ nodes: NODES, now: T0 });
    const got = events<{ id: string }>(el, 'ui-select');
    row(el, 'b')?.click();
    expect(got).toEqual([{ id: 'b' }]);
    expect(item(el, 'b')?.getAttribute('aria-selected')).toBe('true');
    expect(el.selectedId).toBe('b');
    el.addEventListener('ui-select', (e) => e.preventDefault(), { once: true });
    row(el, 'c')?.click();
    expect(el.selectedId).toBe('b');
    // A click in the area of a parent's children selects nothing of the parent.
    item(el, 'a')?.querySelector<HTMLElement>(':scope > .at-kids')?.click();
    expect(got.at(-1)).toEqual({ id: 'c' });
  });

  it('controlled selection: only emits, the host answers with selectedId', () => {
    const el = mount({ nodes: NODES, selectedId: 'c', now: T0 });
    const got = events<{ id: string }>(el, 'ui-select');
    row(el, 'b')?.click();
    expect(got).toEqual([{ id: 'b' }]);
    expect(item(el, 'c')?.getAttribute('aria-selected')).toBe('true');
    expect(item(el, 'b')?.getAttribute('aria-selected')).toBe('false');
    set(el, { selectedId: 'b' });
    expect(el.selectedId).toBe('b');
    set(el, { selectedId: null });
    expect(qa(el, '[aria-selected="true"]')).toHaveLength(0);
  });

  it('the fold control toggles (ui-toggle); folded shows +N with the worst status below and keeps the branch cost', () => {
    const el = mount({ nodes: NODES, density: 'compact', now: T0 });
    const got = events<{ id: string; expanded: boolean }>(el, 'ui-toggle');
    row(el, 'a')?.querySelector<HTMLElement>('[data-toggle]')?.click();
    expect(got).toEqual([{ id: 'a', expanded: false }]);
    expect(item(el, 'a')?.getAttribute('aria-expanded')).toBe('false');
    expect(item(el, 'a1')).toBeNull();
    const more = row(el, 'a')?.querySelector('.at-more');
    expect(more?.textContent).toBe('+2');
    expect(more?.getAttribute('data-worst')).toBe('failed');
    expect(item(el, 'a')?.getAttribute('aria-label')).toContain('2 sub-agents folded, failed below');
    expect(row(el, 'a')?.querySelector('.at-cost')?.textContent).toBe('$1.00');
    // Cancelled → stays.
    el.addEventListener('ui-toggle', (e) => e.preventDefault(), { once: true });
    row(el, 'a')?.querySelector<HTMLElement>('[data-toggle]')?.click();
    expect(item(el, 'a')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('controlled folds: only emits until the host answers with expanded', () => {
    const el = mount({ nodes: NODES, expanded: ['main'], now: T0 });
    expect(item(el, 'a')?.getAttribute('aria-expanded')).toBe('false');
    const fold = row(el, 'a')?.querySelector('.at-fold');
    expect(fold?.textContent).toBe('+2');
    const got = events<{ id: string; expanded: boolean }>(el, 'ui-toggle');
    (fold as HTMLElement).click();
    expect(got).toEqual([{ id: 'a', expanded: true }]);
    expect(item(el, 'a1')).toBeNull();
    set(el, { expanded: ['main', 'a'] });
    expect(item(el, 'a1')).not.toBeNull();
  });

  it('keyboard: arrows, Home / End, ← / → fold and move, * opens siblings, Enter selects', () => {
    const el = mount({ nodes: NODES, expanded: ['main'], now: T0 });
    el.focus();
    expect(active(el)).toBe('main');
    key(el, 'main', 'ArrowDown');
    expect(active(el)).toBe('a');
    expect(item(el, 'a')?.tabIndex).toBe(0);
    expect(item(el, 'main')?.tabIndex).toBe(-1);
    const toggles = events<{ id: string; expanded: boolean }>(el, 'ui-toggle');
    el.addEventListener('ui-toggle', (e) => {
      const d = (e as CustomEvent<{ id: string; expanded: boolean }>).detail;
      const cur = el.data!.expanded!;
      el.data = { ...el.data!, expanded: d.expanded ? [...cur, d.id] : cur.filter((x) => x !== d.id) };
    });
    key(el, 'a', 'ArrowRight');
    el.renderNow();
    expect(toggles).toEqual([{ id: 'a', expanded: true }]);
    expect(active(el)).toBe('a');
    key(el, 'a', 'ArrowRight');
    expect(active(el)).toBe('a1');
    key(el, 'a1', 'ArrowLeft');
    expect(active(el)).toBe('a');
    key(el, 'a', 'ArrowLeft');
    el.renderNow();
    expect(toggles.at(-1)).toEqual({ id: 'a', expanded: false });
    key(el, 'a', 'End');
    expect(active(el)).toBe('c');
    key(el, 'c', 'Home');
    expect(active(el)).toBe('main');
    key(el, 'main', 'ArrowUp');
    expect(active(el)).toBe('main');
    // * on a child of main opens every sibling branch (a).
    key(el, 'main', 'ArrowDown');
    key(el, 'a', '*');
    el.renderNow();
    expect(item(el, 'a')?.getAttribute('aria-expanded')).toBe('true');
    const sel = events<{ id: string }>(el, 'ui-select');
    key(el, 'a', 'Enter');
    key(el, 'a', ' ');
    expect(sel).toEqual([{ id: 'a' }, { id: 'a' }]);
  });

  it('type-ahead jumps to the next name; the same letter cycles; a pause starts a new query', () => {
    let clock = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    const el = mount({ nodes: NODES, now: T0 });
    el.focus();
    key(el, 'main', 'a');
    expect(active(el)).toBe('a');
    clock += 100;
    key(el, 'a', 'a');
    expect(active(el)).toBe('a1');
    clock += 100;
    key(el, 'a1', 'a');
    expect(active(el)).toBe('a2');
    clock += 100;
    key(el, 'a2', 'b');
    expect(active(el)).toBe('a2');
    clock += 600;
    key(el, 'a2', 'b');
    expect(active(el)).toBe('b');
    clock += 600;
    key(el, 'b', 'a');
    clock += 100;
    key(el, 'a', 'v');
    expect(active(el)).toBe('a2');
    vi.restoreAllMocks();
  });

  it('a live update morphs: the focused item stays the same element; a removed one hands focus to its parent', () => {
    const el = mount({ nodes: NODES, now: T0 });
    item(el, 'a2')?.focus();
    const before = item(el, 'a2');
    const spinner = row(el, 'a1')?.querySelector('.at-spin');
    set(el, { nodes: NODES.map((n) => (n.id === 'a2' ? { ...n, status: 'done' } : n)) });
    expect(item(el, 'a2')).toBe(before);
    expect(active(el)).toBe('a2');
    expect(row(el, 'a1')?.querySelector('.at-spin')).toBe(spinner);
    set(el, { nodes: NODES.filter((n) => n.id !== 'a2') });
    expect(active(el)).toBe('a');
    expect(item(el, 'a')?.tabIndex).toBe(0);
    // Folding the branch above the focused item (host side) also lands on the ancestor.
    item(el, 'a1')?.focus();
    set(el, { expanded: ['main'] });
    expect(active(el)).toBe('a');
  });

  it('the bar jumps to agents that need you or failed: reveals, selects and focuses them', () => {
    const el = mount({ nodes: NODES, expanded: ['main'], now: T0 });
    const sel = events<{ id: string }>(el, 'ui-select');
    const tog = events<{ id: string; expanded: boolean }>(el, 'ui-toggle');
    el.addEventListener('ui-toggle', (e) => {
      const d = (e as CustomEvent<{ id: string; expanded: boolean }>).detail;
      el.data = { ...el.data!, expanded: [...el.data!.expanded!, d.id] };
    });
    q<HTMLElement>(el, '[data-jump="failed"]')?.click();
    expect(tog).toEqual([{ id: 'a', expanded: true }]);
    expect(sel).toEqual([{ id: 'a2' }]);
    expect(active(el)).toBe('a2');
    q<HTMLElement>(el, '[data-jump="needs_you"]')?.click();
    expect(sel.at(-1)).toEqual({ id: 'b' });
    expect(active(el)).toBe('b');
  });

  it('running times tick on one shared timer, stop when nothing runs and on disconnect', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 100_000);
    const el = mount({ nodes: NODES });
    const time = () => row(el, 'a1')?.querySelector('.at-time')?.textContent;
    expect(time()).toBe('1m 38s');
    const bar = row(el, 'c')?.querySelector<HTMLElement>('.at-span > i');
    const left = bar?.style.left;
    vi.advanceTimersByTime(3000);
    expect(time()).toBe('1m 41s');
    expect(bar?.style.left).not.toBe(left);
    const other = mount({ nodes: NODES });
    expect(vi.getTimerCount()).toBe(1);
    other.remove();
    expect(vi.getTimerCount()).toBe(1);
    el.remove();
    expect(vi.getTimerCount()).toBe(0);
    document.body.append(el);
    el.renderNow();
    expect(vi.getTimerCount()).toBe(1);
    set(el, { nodes: NODES.map((n) => ({ ...n, status: 'done' })) });
    expect(vi.getTimerCount()).toBe(0);
    set(el, { nodes: NODES, now: T0 + 20_000 });
    expect(vi.getTimerCount()).toBe(0);
    expect(time()).toBe('18s');
  });

  it('announces count changes politely, not the first render', () => {
    const el = mount({ nodes: NODES, now: T0 });
    const live = el.shadowRoot?.querySelector('[role="status"]');
    expect(live?.textContent).toBe('');
    set(el, { nodes: NODES.map((n) => (n.id === 'b' ? { ...n, status: 'running' } : n)) });
    expect(live?.textContent).toBe('6 agents, 3 running, 1 failed');
  });

  it('new agents rise in after the first render; empty and title-less states', () => {
    const el = mount({ nodes: NODES.slice(0, 2), now: T0 });
    expect(qa(el, '.is-new')).toHaveLength(0);
    set(el, { nodes: NODES });
    expect(qa(el, '.is-new').map((li) => li.dataset.id)).toEqual(['a1', 'a2', 'b', 'c']);
    set(el, { nodes: [] });
    expect(q(el, '.at-empty')?.textContent).toBe('No agents yet.');
    set(el, { nodes: NODES, title: null });
    expect(q(el, '.at-bar')).toBeNull();
    expect(q(el, '[role="tree"]')?.getAttribute('aria-label')).toBe('Agents');
  });

  it('Korean with lang="ko" — the dashboard wording', () => {
    const el = mount({ nodes: NODES, density: 'compact', now: T0 }, { lang: 'ko' });
    expect(q(el, '.at-title')?.textContent).toBe('에이전트');
    expect(row(el, 'a1')?.querySelector('.at-st')?.textContent).toBe('실행 중');
    expect(row(el, 'b')?.querySelector('.at-st')?.textContent).toBe('입력 대기');
    expect(row(el, 'c')?.querySelector('.at-st')?.textContent).toBe('완료');
    const sum = q(el, '.at-sum')?.textContent ?? '';
    expect(sum).toContain('에이전트 6');
    expect(sum).toContain('실행 2');
    expect(sum).toContain('실패 1');
    set(el, { expanded: ['main'] });
    expect(item(el, 'a')?.getAttribute('aria-label')).toContain('하위 2 접힘');
    expect(agentTreeStrings('ko').status.cancelled).toBe('중단');
    expect(agentTreeStrings('fr').title).toBe('Agents');
  });

  // The element's own work per update — the tree model, the roll-ups and the markup — for 200 agents. (The DOM
  // parse + morph is the browser's: happy-dom is 10–50× slower than a real one, so that is measured in Chromium.)
  it('renders 200 agents in under 16 ms', () => {
    const nodes: AgentTreeNode[] = [N('r', undefined, { status: 'running', startedAt: T0, costUsd: 1 })];
    for (let i = 1; i < 200; i++)
      nodes.push(
        N(`n${i}`, i < 10 ? 'r' : `n${Math.floor(i / 10)}`, {
          status: i % 7 ? 'done' : 'running',
          startedAt: T0 + i * 1000,
          endedAt: i % 7 ? T0 + i * 2000 : undefined,
          costUsd: i / 100,
          tokens: i * 1000,
          toolCalls: i % 9,
          summary: `Step ${i}`,
        }),
      );
    for (const density of ['rich', 'compact'] as const) {
      const el = mount({ nodes, density, now: T0 + 500_000 });
      expect(qa(el, '.at-item')).toHaveLength(200);
      const render = (el as unknown as { render(): string }).render.bind(el);
      let best = Number.POSITIVE_INFINITY;
      for (let k = 0; k < 7; k++) {
        el.data = { ...el.data!, nodes: [...nodes], now: T0 + 500_000 + k };
        const t = performance.now();
        const html = render();
        best = Math.min(best, performance.now() - t);
        expect(html.length).toBeGreaterThan(50_000);
      }
      expect(best).toBeLessThan(16);
      el.remove();
    }
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    spy = soundSpy();
  });
  afterEach(() => spy.restore());
  const tap = (n: Element | null | undefined, detail = 1) =>
    (n as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail }));
  const fold = (el: UiAgentTree, id: string) => row(el, id)?.querySelector('[data-toggle]');

  it('fold control and ← / → / * open and close; a pick that changes the selection → select', async () => {
    const el = mount({ nodes: NODES, now: T0 });
    tap(fold(el, 'a'));
    await spy.settle();
    key(el, 'a', 'ArrowRight');
    await spy.settle();
    key(el, 'a', 'ArrowLeft');
    await spy.settle();
    key(el, 'a', '*');
    await spy.settle();
    tap(row(el, 'b'));
    await spy.settle();
    tap(row(el, 'b')); // already selected: nothing changed
    await spy.settle();
    key(el, 'c', 'Enter');
    await spy.settle();
    const subtle = (cue: string, input: string) => [cue, { emphasis: 'subtle', input }];
    expect(spy.calls).toEqual([
      subtle('close', 'mouse'),
      subtle('open', 'keyboard'),
      subtle('close', 'keyboard'),
      subtle('open', 'keyboard'),
      ['select', { input: 'mouse' }],
      ['select', { input: 'keyboard' }],
    ]);
  });

  it('the bar’s jump sounds its pick only (the folds it opens on the way are silent)', async () => {
    const el = mount({ nodes: NODES, expanded: ['main'], now: T0 });
    tap(q(el, '[data-jump="failed"]'));
    await spy.settle();
    expect(spy.calls).toEqual([['select', { input: 'mouse' }]]);
  });

  it('nothing for reveal(), a prevented event, data the app sets, or a data-ui-sound="off" region', async () => {
    const el = mount({ nodes: NODES, expanded: ['main'], now: T0 });
    el.reveal('a1');
    set(el, { expanded: [], selectedId: 'c' });
    await spy.settle();
    expect(spy.calls).toEqual([]);
    for (const n of ['ui-toggle', 'ui-select']) el.addEventListener(n, (e) => e.preventDefault());
    tap(fold(el, 'main'));
    tap(row(el, 'main'));
    await spy.settle();
    expect(spy.calls).toEqual([]);
    const quiet = document.createElement('div');
    quiet.setAttribute('data-ui-sound', 'off');
    document.body.append(quiet);
    const off = mount({ nodes: NODES, now: T0 });
    quiet.append(off);
    tap(fold(off, 'a'));
    tap(row(off, 'b'));
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });
});
