import type { ComponentDoc } from '../../docs/types';
import './tabs';
import type { TabsData } from './tabs';

/** Tabs plus one light-DOM panel per tab (`slot="<id>"`). */
function make(data: TabsData, panels: Record<string, string>, attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('ui-tabs');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const [id, text] of Object.entries(panels)) {
    const p = document.createElement('div');
    p.slot = id;
    p.style.cssText = 'padding:14px 4px 4px;font-size:13.5px;line-height:1.55;color:var(--ui-ib-text-2)';
    p.textContent = text;
    el.append(p);
  }
  el.data = data;
  return el;
}

const SECTIONS: TabsData = {
  label: 'Session sections',
  value: 'chat',
  tabs: [
    { id: 'chat', label: 'Chat', icon: 'chat' },
    { id: 'log', label: 'Work log', icon: 'list', badge: 42 },
    { id: 'tree', label: 'Agent tree', icon: 'bot' },
  ],
};
const SECTION_TEXT = {
  chat: 'Instructions and answers for this session, newest at the bottom.',
  log: '42 tool calls — Read, Edit, Bash … grouped by step, each with its input, output and time.',
  tree: 'Who started whom: the main agent and the subagents it spawned, with what each one costs.',
};

const AGENTS: TabsData = {
  label: 'Agents',
  value: 'main',
  tabs: [
    { id: 'main', label: 'Main', tone: 'run' },
    { id: 'a1', label: 'Explore · tests', tone: 'done' },
    { id: 'a2', label: 'Review · diff', tone: 'run' },
    { id: 'a3', label: 'Fix · upload retry', tone: 'wait', badge: 1 },
    { id: 'a4', label: 'Docs · changelog', tone: 'fail' },
    { id: 'a5', label: 'Bench · cold start', tone: 'rest', disabled: true, title: 'Not started yet' },
  ],
};

export const doc: ComponentDoc = {
  slug: 'tabs',
  name: 'Tabs',
  tag: 'ui-tabs',
  group: 'Primitives',
  summary: 'Which view of the same thing you are looking at — with an underline that glides to it.',
  description:
    'A tab list over panels the host slots in (each panel is a light-DOM child with slot="<tab id>", so the host can render only the active one). The selected label turns to ink and one underline glides to it on the hairline under the list; tabs keep their own widths and the list scrolls sideways when it runs out of room. Arrows move along the list with a roving tabindex and select as they go (activation="manual" waits for Enter / Space). Selecting sends a cancelable ui-change.',
  usedIn:
    'soma-work dashboard › session panel: agent tabs (Main + subagents with status dots, E-19) and section tabs (Chat · 작업 로그 · 에이전트 트리, E-24); settings page tabs (M-01).',
  reference: { name: 'WAI-ARIA APG Tabs', url: 'https://www.w3.org/WAI/ARIA/apg/patterns/tabs/' },
  props: [
    {
      name: 'data.tabs',
      type: "Array<{ id: string; label: string; icon?: IconName; tone?: 'run' | 'wait' | 'done' | 'fail' | 'rest'; badge?: string | number; disabled?: boolean; title?: string }>",
      required: true,
      description:
        'The tabs, in order. `id` is the slot name of its panel and what ui-change carries. `tone` draws a status dot (run pulses); `badge` a count.',
    },
    {
      name: 'data.value',
      type: 'string',
      description: 'The selected tab id. Missing, unknown or disabled → the first enabled tab.',
    },
    { name: 'data.label', type: 'string', description: 'Accessible name of the tab list.' },
    {
      name: 'activation',
      type: "'auto' | 'manual'",
      default: "'auto'",
      description: 'Attribute. auto: arrows select as they move; manual: arrows move focus, Enter / Space select.',
    },
    { name: 'value', type: 'string | undefined', description: 'Read-only property: the selected tab id.' },
    {
      name: 'slot="<id>"',
      type: 'light-DOM child',
      description: 'The panel of tab <id>. Only the selected one shows.',
    },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the theme (attribute). Default follows prefers-color-scheme or page tokens.',
    },
  ],
  events: [
    {
      name: 'ui-change',
      detail: '{ value: string; previous: string | undefined }',
      description:
        'Another tab was selected (click, arrows in auto mode, Enter / Space in manual mode). Cancelable: preventDefault() keeps the old tab.',
    },
  ],
  keyboard: [
    ['Tab', 'Into the list (the selected tab), then into the panel'],
    ['← / →', 'Previous / next tab (wraps, skips disabled); selects it unless activation="manual"'],
    ['Home / End', 'First / last tab'],
    ['Enter / Space', 'Select the focused tab (manual mode)'],
  ],
  a11y: [
    'role="tablist" named by data.label; tabs are role="tab" with aria-selected and aria-controls; panels are role="tabpanel" labelled by their tab and focusable.',
    'Roving tabindex: one tab stop in the list; disabled tabs use aria-disabled and are skipped.',
    'Status dots are decoration next to a text label — put the state in the label or title when it matters.',
    'The underline is aria-hidden; selection is also carried by the ink label colour, not colour alone.',
    'Reduced motion: the underline jumps, the panel does not fade, the running dot stops pulsing.',
  ],
  usage: `<ui-tabs id="sections">
  <section slot="chat">…</section>
  <section slot="log">…</section>
  <section slot="tree">…</section>
</ui-tabs>
<script type="module">
  import '@2lab.ai/ui/tabs';
  const tabs = document.getElementById('sections');
  tabs.data = {
    label: 'Session sections', value: 'chat',
    tabs: [{ id: 'chat', label: 'Chat' }, { id: 'log', label: 'Work log', badge: 42 }, { id: 'tree', label: 'Agent tree' }],
  };
  tabs.addEventListener('ui-change', (e) => localStorage.setItem('section', e.detail.value));
</script>`,
  demos: [
    {
      id: 'sections',
      title: 'Sections',
      description: 'Click or use ← / →: the underline glides, the panel fades in.',
      height: 240,
      create: () => make(SECTIONS, SECTION_TEXT),
    },
    {
      id: 'agents',
      title: 'Agents (scrolls)',
      description:
        'Main pinned first, subagents in spawn order with status dots; the list scrolls sideways when narrow.',
      height: 240,
      create: () =>
        make(AGENTS, {
          main: 'Main agent — planning the fix, 3 subagents running.',
          a1: 'Explore finished: 14 files read, 2 candidates for the flaky upload.',
          a2: 'Review is reading the diff of upload-retry.ts.',
          a3: 'Waiting for your approval to run the integration suite.',
          a4: 'Docs failed: the changelog file is locked by another branch.',
          a5: 'Not started.',
        }),
    },
    {
      id: 'manual',
      title: 'Manual activation',
      description: 'activation="manual": arrows move focus only; Enter or Space selects.',
      height: 240,
      create: () => make({ ...SECTIONS, value: 'log' }, SECTION_TEXT, { activation: 'manual' }),
    },
    {
      id: 'ko',
      title: '한국어',
      height: 240,
      create: () =>
        make(
          {
            label: '세션 섹션',
            value: 'chat',
            tabs: [
              { id: 'chat', label: 'Chat', icon: 'chat' },
              { id: 'log', label: '작업 로그', icon: 'list', badge: 42 },
              { id: 'tree', label: '에이전트 트리', icon: 'bot' },
            ],
          },
          {
            chat: '이 세션의 지시와 답변입니다.',
            log: '도구 호출 42개 — 단계별로 묶여 있습니다.',
            tree: '누가 누구를 시작했는지와 각 에이전트의 비용입니다.',
          },
          { lang: 'ko' },
        ),
    },
  ],
};
