import type { ComponentDoc } from '../../docs/types';
import './agent-tree';
import type { AgentTreeSelectDetail, AgentTreeToggleDetail } from './agent-tree';
import type { AgentTreeData, AgentTreeNode } from './logic';

type El = HTMLElementTagNameMap['ui-agent-tree'];

function tree(data: AgentTreeData, attrs: Record<string, string> = {}): El {
  const el = document.createElement('ui-agent-tree');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

function stage(el: HTMLElement, width = 520): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = `width:100%;max-width:${width}px;margin:0 auto`;
  box.append(el);
  return box;
}

/** A demo that moves on by itself; stops once the element is gone. */
function every(el: HTMLElement, ms: number, step: () => void): void {
  const id = window.setInterval(() => {
    if (!el.isConnected) return window.clearInterval(id);
    step();
  }, ms);
}

const S = 1000;
const M = 60 * S;

// A soma-work session as the dashboard carries it: the main agent (메인) is the root, every subagent hangs from the
// tool call that started it (DashboardAgent.parentId); name = A<n> + type, role = its description, summary = its
// current task (or the SDK summary), spend = AgentSpend (API-equivalent cost, all token kinds).
function session(t0: number): AgentTreeNode[] {
  return [
    {
      id: 'main',
      name: 'Main',
      role: 'opus-5-5[1m]',
      status: 'running',
      startedAt: t0,
      tokens: 412_800,
      costUsd: 3.41,
      toolCalls: 38,
      summary: '#T4 Wire <ui-agent-tree> into the panel',
    },
    {
      id: 'toolu_01A',
      parentId: 'main',
      name: 'A1 Explore',
      role: 'Find every caller of agentTreeOf',
      status: 'done',
      startedAt: t0 + 12 * S,
      endedAt: t0 + 1 * M + 4 * S,
      tokens: 88_310,
      costUsd: 0.21,
      toolCalls: 17,
      summary: 'Three call sites: renderAgentTree, renderPanelAgents, wlChildBlock',
    },
    {
      id: 'toolu_01B',
      parentId: 'main',
      name: 'A2 general-purpose',
      role: 'Port the tree renderer',
      status: 'running',
      startedAt: t0 + 40 * S,
      tokens: 191_420,
      costUsd: 0.86,
      toolCalls: 24,
      summary: '#T2 Writing the keyboard handler',
    },
    {
      id: 'toolu_01C',
      parentId: 'toolu_01B',
      name: 'A3 Explore',
      role: 'Read the WAI-ARIA tree pattern',
      status: 'done',
      startedAt: t0 + 52 * S,
      endedAt: t0 + 1 * M + 31 * S,
      tokens: 40_212,
      costUsd: 0.09,
      toolCalls: 6,
      summary: 'Roving tabindex, * expands siblings, type-ahead',
    },
    {
      id: 'toolu_01D',
      parentId: 'toolu_01B',
      name: 'A4 test-runner',
      role: 'Run vitest on agent-tree',
      status: 'failed',
      startedAt: t0 + 1 * M + 50 * S,
      endedAt: t0 + 2 * M + 22 * S,
      tokens: 12_904,
      costUsd: 0.04,
      toolCalls: 3,
      summary: 'npm test -- agent-tree',
      reason: 'happy-dom: 2 tests failed — focus did not survive the re-render',
    },
    {
      id: 'toolu_01E',
      parentId: 'main',
      name: 'A5 code-reviewer',
      role: 'Review the dashboard swap',
      status: 'needs_you',
      startedAt: t0 + 2 * M + 5 * S,
      tokens: 23_770,
      costUsd: 0.12,
      toolCalls: 4,
      summary: 'Wants to run the e2e suite',
      reason: 'Approve Bash: npx playwright test dashboard.spec.ts',
    },
  ];
}

function live(): HTMLElement {
  const t0 = Date.now() - 2 * M - 40 * S;
  let nodes = session(t0);
  const el = tree({ nodes, density: 'rich' });
  const patch = (id: string, p: Partial<AgentTreeNode>) => {
    nodes = nodes.map((n) => (n.id === id ? { ...n, ...p } : n));
  };
  // A small script: costs climb, A4 is retried as a new child, it passes, A2 finishes, then the run starts over.
  let step = 0;
  every(el, 2600, () => {
    step++;
    const now = Date.now();
    patch('main', { costUsd: 3.41 + step * 0.07, tokens: 412_800 + step * 9_100, toolCalls: 38 + step });
    if (step === 1)
      nodes = [
        ...nodes,
        {
          id: 'toolu_01F',
          parentId: 'toolu_01B',
          name: 'A6 test-runner',
          role: 'Run vitest again',
          status: 'running',
          startedAt: now,
          tokens: 3_100,
          costUsd: 0.01,
          toolCalls: 1,
          summary: 'npm test -- agent-tree',
        },
      ];
    if (step >= 1 && step < 3) patch('toolu_01B', { costUsd: 0.86 + step * 0.05, toolCalls: 24 + step });
    if (step === 2) patch('toolu_01F', { costUsd: 0.03, tokens: 11_480, toolCalls: 3 });
    if (step === 3) patch('toolu_01F', { status: 'done', endedAt: now, summary: '41 tests passed' });
    if (step === 4)
      patch('toolu_01B', {
        status: 'done',
        endedAt: now,
        summary: 'Keyboard, morph and roll-up done — 41 tests green',
      });
    if (step === 6) {
      step = 0;
      nodes = session(Date.now() - 2 * M - 40 * S);
    }
    el.data = { ...el.data!, nodes };
  });
  return stage(el);
}

function compact(): HTMLElement {
  return stage(tree({ nodes: session(Date.now() - 2 * M - 40 * S), density: 'compact', selectedId: null }), 440);
}

// A longer run with two folded branches: the badge counts what is hidden and takes the colour of the worst below.
function rollup(): HTMLElement {
  const t0 = Date.now() - 9 * M;
  const nodes: AgentTreeNode[] = [
    {
      id: 'm',
      name: 'Main',
      role: 'opus-5-5[1m]',
      status: 'running',
      startedAt: t0,
      costUsd: 6.2,
      tokens: 802_000,
      toolCalls: 71,
    },
    {
      id: 'a1',
      parentId: 'm',
      name: 'A1 Plan',
      role: 'Split the migration',
      status: 'done',
      startedAt: t0 + 20 * S,
      endedAt: t0 + 2 * M,
      costUsd: 0.44,
      tokens: 91_000,
      toolCalls: 9,
      summary: 'Four steps, one per table',
    },
    {
      id: 'a2',
      parentId: 'm',
      name: 'A2 general-purpose',
      role: 'Migrate sessions + agents',
      status: 'running',
      startedAt: t0 + 2 * M + 10 * S,
      costUsd: 1.12,
      tokens: 240_500,
      toolCalls: 33,
      summary: '#T3 Backfilling agent_registry',
    },
    {
      id: 'a3',
      parentId: 'a2',
      name: 'A3 Explore',
      role: 'Map the old schema',
      status: 'done',
      startedAt: t0 + 2 * M + 20 * S,
      endedAt: t0 + 3 * M,
      costUsd: 0.18,
      tokens: 52_000,
      toolCalls: 8,
    },
    {
      id: 'a4',
      parentId: 'a2',
      name: 'A4 general-purpose',
      role: 'Write the backfill',
      status: 'running',
      startedAt: t0 + 3 * M + 5 * S,
      costUsd: 0.61,
      tokens: 133_000,
      toolCalls: 19,
      summary: 'Batch 7 of 12',
    },
    {
      id: 'a5',
      parentId: 'a4',
      name: 'A5 test-runner',
      role: 'Check row counts',
      status: 'running',
      startedAt: t0 + 6 * M,
      costUsd: 0.05,
      tokens: 14_000,
      toolCalls: 2,
    },
    {
      id: 'a6',
      parentId: 'm',
      name: 'A6 general-purpose',
      role: 'Migrate usage + metrics',
      status: 'done',
      startedAt: t0 + 2 * M + 30 * S,
      endedAt: t0 + 7 * M,
      costUsd: 0.97,
      tokens: 201_000,
      toolCalls: 28,
      summary: 'Migrated 3 tables',
    },
    {
      id: 'a7',
      parentId: 'a6',
      name: 'A7 Explore',
      role: 'Find metric writers',
      status: 'done',
      startedAt: t0 + 2 * M + 40 * S,
      endedAt: t0 + 3 * M + 30 * S,
      costUsd: 0.12,
      tokens: 30_000,
      toolCalls: 5,
    },
    {
      id: 'a8',
      parentId: 'a6',
      name: 'A8 test-runner',
      role: 'Run the metric tests',
      status: 'failed',
      startedAt: t0 + 5 * M,
      endedAt: t0 + 5 * M + 50 * S,
      costUsd: 0.03,
      tokens: 9_000,
      toolCalls: 2,
      reason: 'usage.test.ts: expected 1,204 rows, got 1,198',
    },
    {
      id: 'a9',
      parentId: 'a6',
      name: 'A9 test-runner',
      role: 'Run them again',
      status: 'done',
      startedAt: t0 + 6 * M,
      endedAt: t0 + 6 * M + 40 * S,
      costUsd: 0.03,
      tokens: 9_400,
      toolCalls: 2,
      summary: 'All metric tests pass',
    },
  ];
  const el = tree({ nodes, density: 'rich', expanded: ['m'] });
  // Controlled folds: the host keeps the open ids (here: in memory; the dashboard keeps them per card).
  el.addEventListener('ui-toggle', (e) => {
    const { id, expanded } = (e as CustomEvent<AgentTreeToggleDetail>).detail;
    const cur = el.data!.expanded ?? [];
    el.data = { ...el.data!, expanded: expanded ? [...cur, id] : cur.filter((x) => x !== id) };
  });
  return stage(el);
}

// The panel: the host owns the selection (it opens that agent's work log) and logs what the tree asked for.
function controlled(): HTMLElement {
  const el = tree({ nodes: session(Date.now() - 2 * M - 40 * S), density: 'compact', selectedId: 'toolu_01B' });
  const log = document.createElement('ol');
  log.style.cssText =
    'margin:12px 0 0;padding:8px 10px 8px 28px;border-radius:8px;background:color-mix(in srgb,currentColor 5%,transparent);font:12px/18px var(--mono, ui-monospace, monospace);min-height:80px;opacity:.85';
  const write = (s: string) => {
    const li = document.createElement('li');
    li.textContent = s;
    log.prepend(li);
    while (log.children.length > 4) log.lastElementChild?.remove();
  };
  el.addEventListener('ui-select', (e) => {
    const { id } = (e as CustomEvent<AgentTreeSelectDetail>).detail;
    write(`ui-select { id: '${id}' } → open its work log`);
    el.data = { ...el.data!, selectedId: id };
  });
  el.addEventListener('ui-toggle', (e) => {
    const d = (e as CustomEvent<AgentTreeToggleDetail>).detail;
    write(`ui-toggle { id: '${d.id}', expanded: ${d.expanded} }`);
  });
  const box = stage(el, 440);
  box.append(log);
  return box;
}

function korean(): HTMLElement {
  const t0 = Date.now() - 4 * M;
  const nodes: AgentTreeNode[] = [
    {
      id: 'main',
      name: '메인',
      role: 'opus-5-5[1m]',
      status: 'running',
      startedAt: t0,
      costUsd: 2.18,
      tokens: 301_000,
      toolCalls: 27,
      summary: '#T2 대시보드 에이전트 트리 교체',
    },
    {
      id: 'b1',
      parentId: 'main',
      name: 'A1 Explore',
      role: '호출 지점 찾기',
      status: 'done',
      startedAt: t0 + 15 * S,
      endedAt: t0 + 58 * S,
      costUsd: 0.11,
      tokens: 40_100,
      toolCalls: 9,
      summary: '호출 지점 3곳 확인',
    },
    {
      id: 'b2',
      parentId: 'main',
      name: 'A2 general-purpose',
      role: '패널 렌더러 이식',
      status: 'running',
      startedAt: t0 + 1 * M,
      costUsd: 0.74,
      tokens: 152_000,
      toolCalls: 18,
      summary: '#T3 키보드 탐색 연결 중',
    },
    {
      id: 'b3',
      parentId: 'b2',
      name: 'A3 test-runner',
      role: '테스트 실행',
      status: 'failed',
      startedAt: t0 + 2 * M,
      endedAt: t0 + 2 * M + 35 * S,
      costUsd: 0.02,
      tokens: 6_200,
      toolCalls: 2,
      reason: '포커스 복원 테스트 2개 실패',
    },
    {
      id: 'b4',
      parentId: 'main',
      name: 'A4 code-reviewer',
      role: '변경 검토',
      status: 'needs_you',
      startedAt: t0 + 3 * M,
      costUsd: 0.06,
      tokens: 15_400,
      toolCalls: 3,
      reason: 'Bash 승인 필요: npm run e2e',
    },
    {
      id: 'b5',
      parentId: 'main',
      name: 'A5 Explore',
      role: '이전 스펙 확인',
      status: 'cancelled',
      startedAt: t0 + 3 * M + 10 * S,
      endedAt: t0 + 3 * M + 20 * S,
      costUsd: 0.01,
      tokens: 2_100,
      toolCalls: 1,
    },
  ];
  return stage(tree({ nodes, density: 'compact', title: '에이전트' }, { lang: 'ko' }), 440);
}

// Sixty agents, four levels deep — tens of nodes is soma's scale; the tree renders them without virtualising.
function scale(): HTMLElement {
  const t0 = Date.now() - 20 * M;
  const nodes: AgentTreeNode[] = [
    { id: 'r', name: 'Main', role: 'opus-5-5[1m]', status: 'running', startedAt: t0, costUsd: 4.1, toolCalls: 120 },
  ];
  const kinds = ['Explore', 'general-purpose', 'test-runner', 'code-reviewer', 'Plan'];
  const st: AgentTreeNode['status'][] = ['done', 'done', 'running', 'done', 'failed', 'done', 'waiting', 'done'];
  for (let i = 1; i < 60; i++) {
    const parent = i < 6 ? 'r' : i < 20 ? `a${(i % 5) + 1}` : i < 45 ? `a${(i % 14) + 6}` : `a${(i % 25) + 20}`;
    const status = st[i % st.length];
    const start = t0 + i * 17 * S;
    nodes.push({
      id: `a${i}`,
      parentId: parent,
      name: `A${i} ${kinds[i % kinds.length]}`,
      role: `Shard ${i} of the reindex`,
      status,
      startedAt: start,
      endedAt: status === 'running' || status === 'waiting' ? undefined : start + (30 + (i % 7) * 25) * S,
      costUsd: Math.round((0.02 + (i % 9) * 0.031) * 100) / 100,
      toolCalls: 2 + (i % 11),
      summary: status === 'running' ? `Reindexing batch ${i}` : undefined,
      reason: status === 'failed' ? `Shard ${i}: lock timeout after 30s` : undefined,
    });
  }
  const el = tree({ nodes, density: 'compact' });
  const box = stage(el, 480);
  box.style.cssText += ';max-height:520px;overflow:auto';
  return box;
}

export const doc: ComponentDoc = {
  slug: 'agent-tree',
  name: 'Agent Tree',
  tag: 'ui-agent-tree',
  group: 'Components',
  summary: 'Who started whom, what each agent is doing, and which branch costs what.',
  description:
    'An orchestrator and its sub-agents as a live tree, built from a flat list by parentId. Every node shows its status, its running time and its spend; a node with sub-agents shows the whole branch (tokens, cost and tool calls rolled up), and a folded branch says how many agents it hides and carries the most urgent status among them — needs you, failed or running. Why an agent needs you, or what went wrong, sits on the node. Compact is one row per agent (who is doing what now); rich is a card per agent with a waterfall bar on one time axis shared by the whole tree. Running times tick on one shared clock without re-rendering, and a live update morphs the markup so focus, spinners and the fold state stay put.',
  usedIn:
    'soma-work dashboard — the Spec 12 agent tree in its three places: the open card (compact; renderAgentTree / agentNodeRow / anTreeHtml), the panel’s agents section (rich, with the waterfall spans; renderPanelAgents / agentSpanStyle) and the work log’s child blocks (wlChildBlock), all fed by KanbanSession.agents (DashboardAgent: parentId, status, startedAt / endedAt, toolCalls, spend, summary)',
  reference: { name: 'affectUI Agent Tree', url: 'https://www.affectui.com/components/agent-tree' },
  props: [
    {
      name: 'data.nodes',
      type: 'AgentTreeNode[]',
      required: true,
      description:
        'Every agent, flat, in spawn order: { id, parentId?, name, role?, status, startedAt?, endedAt?, tokens?, costUsd?, toolCalls?, summary?, reason? }. Pass the whole list on every change — ids keep each node’s place, focus and fold. A missing or unknown parent puts the node at the top level, a cycle is broken there, a repeated id is ignored.',
    },
    {
      name: 'node.status',
      type: "'running' | 'waiting' | 'needs_you' | 'done' | 'failed' | 'cancelled' | 'unknown'",
      required: true,
      description:
        'needs_you = waits for a person (a permission, a question); waiting = waits for anything else. completed, stopped / canceled and queued are read as done, cancelled and waiting; anything else as unknown.',
    },
    {
      name: 'node.tokens · node.costUsd · node.toolCalls',
      type: 'number',
      description:
        'This agent’s own numbers — not its sub-agents’: the tree adds each branch up (a node with sub-agents shows the branch, its tooltip and accessible name say its own share). Omit what you do not know; an absent field stays absent in the sum.',
    },
    {
      name: 'node.startedAt · node.endedAt',
      type: 'number (epoch ms)',
      description:
        'The node’s time: endedAt − startedAt, or a running clock while it is running, waiting or needs_you without an end. Rich density draws both on the shared waterfall axis.',
    },
    {
      name: 'node.summary · node.reason',
      type: 'string',
      description:
        'summary: what it is doing or did (rich: every card, two lines; compact: the line under a live or failed row). reason: why it needs you or what went wrong — shown, tinted, on needs_you and failed nodes only.',
    },
    {
      name: 'node.role',
      type: 'string',
      description: 'A second line under the name — the model, the agent type or its brief.',
    },
    {
      name: 'data.density',
      type: "'compact' | 'rich'",
      default: "'rich'",
      description:
        'compact: rows (chevron · status icon · name · status word · time · cost). rich: cards with status pill, summary, reason, cost · time · tokens · tools and a waterfall bar.',
    },
    {
      name: 'data.expanded',
      type: 'string[]',
      description:
        'Ids of the open branches. Set → controlled: the tree only emits ui-toggle and you answer with a new array. Unset → every branch starts open and the tree folds itself.',
    },
    {
      name: 'data.selectedId',
      type: 'string | null',
      description:
        'The selected agent. Set (null = none) → controlled: the tree only emits ui-select. Unset → the tree keeps its own selection.',
    },
    {
      name: 'data.now',
      type: 'number (epoch ms)',
      description:
        'The clock for running times. Set → nothing ticks (a replay, a test). Unset → one shared 1 s tick while an agent runs.',
    },
    {
      name: 'data.title',
      type: 'string | null',
      default: '“Agents” / “에이전트”',
      description:
        'Heading of the bar (agents · running · needs you · failed · cost). null hides the bar — for a surface with its own header.',
    },
    {
      name: 'el.focus() · el.reveal(id) · el.selectedId · el.expanded',
      type: 'methods / read-only',
      description:
        'focus(): the tree’s tab stop. reveal(id): opens the folded branches above it (each a ui-toggle) and focuses it. selectedId / expanded: the state now.',
    },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'UI language (attribute).' },
    { name: 'theme', type: "'light' | 'dark'", description: 'Pins the theme (attribute).' },
  ],
  events: [
    {
      name: 'ui-select',
      detail: '{ id: string }',
      description:
        'An agent was picked: click on its row or card, Enter / Space, or a needs you / failed jump in the bar. Cancelable: preventDefault() keeps the selection. Fires again on the selected agent (open it again).',
    },
    {
      name: 'ui-toggle',
      detail: '{ id: string; expanded: boolean }',
      description:
        'A branch should open or fold (chevron or fold badge, ← / →, *, reveal). Cancelable. Controlled: answer with data.expanded.',
    },
  ],
  keyboard: [
    ['Tab', 'Into the tree: one tab stop (the agent you were on, else the selected one, else the first)'],
    ['↓ / ↑', 'Next / previous visible agent'],
    ['→', 'Folded branch: open it · open branch: its first sub-agent'],
    ['←', 'Open branch: fold it · otherwise: its parent'],
    ['Home / End', 'First / last visible agent'],
    ['*', 'Open every branch next to the focused one'],
    ['Enter / Space', 'Select the agent (ui-select)'],
    ['a–z, 가–힣 …', 'Type-ahead: jump to the next agent whose name starts with what you typed'],
  ],
  a11y: [
    'role=tree with nested role=group; every agent is a treeitem with aria-level, aria-setsize / aria-posinset, aria-expanded on branches and aria-selected.',
    'Each row carries data-anchor: as the one item of a <ui-log-scroller>, a page of older agents that grows the tree above the reader does not move the rows they see.',
    'Each item’s name says it in one sentence: name, role, status, the reason (or what it is doing), the cost — for a branch “… for this branch with its sub-agents (own …)” — and, folded, how many it hides and “needs you / failed / running below”. The ticking time is its description (aria-describedby), not its name.',
    'Status is a word and an icon, never colour alone. The bar’s “needs you” / “failed” are buttons that show, select and focus the next such agent.',
    'A polite live region outside the re-rendered markup says the counts (agents, running, needs you, failed) when they change — not every cent.',
    'Focus survives live updates (the markup is morphed, items keyed by id); an agent that left or was folded away hands focus to its nearest ancestor on screen.',
    'Touch: compact rows are 44px tall and the fold targets reach 44px on coarse pointers. Reduced motion: no spinner, shimmer or rise.',
    'Sound (opt-in, @2lab.ai/ui/sound): a quiet open / close when the person folds or unfolds a branch (not for reveal()), a select when a pick moves the selection. Silent until the page turns sound on.',
  ],
  usage: `<ui-agent-tree></ui-agent-tree>
<script type="module">
  import '@2lab.ai/ui/agent-tree';
  const tree = document.querySelector('ui-agent-tree');
  const STATUS = { running: 'running', completed: 'done', failed: 'failed', stopped: 'cancelled', unknown: 'unknown' };

  // KanbanSession → nodes: the main agent is the root, each DashboardAgent hangs from its parentId
  function paint(s, waitingFor) {
    const nodes = [{ id: 'main', name: 'Main', role: s.model, status: waitingFor ? 'needs_you' : 'running',
                     reason: waitingFor, startedAt: s.activeLegStartedAtMs, toolCalls: s.agentRoot?.toolCalls }];
    for (const a of s.agents ?? []) nodes.push({
      id: a.id, parentId: a.parentId ?? 'main', name: 'A' + a.n + ' ' + (a.type ?? 'agent'), role: a.description,
      status: STATUS[a.status] ?? 'unknown', startedAt: a.startedAt, endedAt: a.endedAt, toolCalls: a.toolCalls,
      costUsd: a.spend?.costUsd, summary: a.summary,
      tokens: a.spend && a.spend.inputTokens + a.spend.outputTokens + a.spend.cacheReadTokens + a.spend.cacheCreateTokens,
    });
    tree.data = { ...tree.data, nodes, density: 'rich' };
  }

  tree.addEventListener('ui-select', (e) => openPanelAgent(sessionKey, e.detail.id));
</script>`,
  demos: [
    {
      id: 'live',
      title: 'Live run',
      description:
        'Rich density: costs climb and shimmer, a failed test run is retried as a new child, then the branch finishes. Every bar sits on one time axis. Click a card, or use the arrow keys.',
      height: 640,
      frame: false,
      create: live,
    },
    {
      id: 'compact',
      title: 'Compact',
      description: 'The open card’s density: who is doing what now — one line under the live and failed ones.',
      height: 340,
      frame: false,
      create: compact,
    },
    {
      id: 'rollup',
      title: 'Folded branches',
      description:
        'Controlled folds: two branches start folded. A parent shows its branch’s cost; the badge counts what it hides and turns red when one below failed. Open them with the badge or →.',
      height: 520,
      frame: false,
      create: rollup,
    },
    {
      id: 'controlled',
      title: 'Selection',
      description:
        'The host owns the selection (the panel opens that agent’s work log) and every request is logged. Try the “1 needs you” and “1 failed” buttons in the bar.',
      height: 440,
      frame: false,
      create: controlled,
    },
    {
      id: 'ko',
      title: '한국어',
      description: 'lang="ko" — the dashboard’s wording: 실행 중 · 완료 · 실패 · 중단 · 입력 대기.',
      height: 340,
      frame: false,
      create: korean,
    },
    {
      id: 'scale',
      title: '60 agents',
      description: 'Four levels deep; the indent shrinks so the deepest level still fits. Type a letter to jump.',
      height: 560,
      frame: false,
      create: scale,
    },
  ],
};
