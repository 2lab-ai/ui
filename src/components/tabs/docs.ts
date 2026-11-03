import type { ComponentDoc } from '../../docs/types';
import './tabs';
import type { TabsChange, TabsData, UiTabs } from './tabs';

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
    { id: 'tree', label: 'Agent tree', icon: 'tree' },
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
    {
      id: 'main',
      label: 'Main',
      meta: 'Opus 5.5',
      model: 'claude-opus-5-5',
      tone: 'run',
      pinned: true,
      title: 'Running',
    },
    { id: 'a1', label: 'A1', meta: 'Explore', model: 'gpt-5.5', tone: 'done', title: 'Done' },
    { id: 'a2', label: 'A2', meta: 'Review', model: 'grok-4', tone: 'run', title: 'Running' },
    { id: 'a3', label: 'A3', meta: 'Fix', tone: 'wait', badge: 1, title: 'Needs you' },
    { id: 'a4', label: 'A4', meta: 'Docs', tone: 'fail', title: 'Failed' },
    { id: 'a5', label: 'A5', meta: 'Bench', tone: 'rest', title: 'Idle' },
    { id: 'a6', label: 'A6', meta: 'Plan', tone: 'rest', disabled: true, title: 'Not started yet' },
  ],
};
const AGENT_TEXT: Record<string, string> = {
  main: 'Main agent — planning the fix, 3 subagents running.',
  a1: 'Explore finished: 14 files read, 2 candidates for the flaky upload.',
  a2: 'Review is reading the diff of upload-retry.ts.',
  a3: 'Waiting for your approval to run the integration suite.',
  a4: 'Docs failed: the changelog file is locked by another branch.',
  a5: 'Bench is idle until Fix lands.',
  a6: 'Not started.',
};

/** The agent strip: Main pinned, one shared panel the host repaints for the selected agent. */
function agentStrip(): HTMLElement {
  const el = document.createElement('ui-tabs') as UiTabs;
  el.setAttribute('shared-panel', '');
  const panel = document.createElement('div');
  panel.style.cssText = 'padding:14px 4px 4px;font-size:13.5px;line-height:1.55;color:var(--ui-ib-text-2)';
  const paint = (id: string) => {
    const t = AGENTS.tabs.find((x) => x.id === id);
    panel.textContent = `${t?.label ?? ''} · ${t?.meta ?? ''} — ${AGENT_TEXT[id] ?? ''}`;
  };
  paint('main');
  el.append(panel);
  el.addEventListener('ui-change', (e) => paint((e as CustomEvent<TabsChange>).detail.value));
  el.data = AGENTS;
  return el;
}

/** The section strip: the tree tab at the far end; each panel is its own focusable scroll box. */
function sectionStrip(lang?: string): HTMLElement {
  const ko = lang === 'ko';
  const el = document.createElement('ui-tabs') as UiTabs;
  el.setAttribute('panel-focus', 'none');
  if (lang) el.setAttribute('lang', lang);
  const rows: Record<string, string[]> = {
    chat: ko
      ? [
          '지시: 업로드 재시도를 고쳐 줘',
          '답변: 원인은 3초 타임아웃입니다',
          '지시: 테스트도 추가해 줘',
          '답변: 통합 테스트 2개 추가',
        ]
      : [
          'You: fix the upload retry',
          'Main: the 3s timeout is the cause',
          'You: add tests too',
          'Main: added 2 integration tests',
        ],
    log: Array.from({ length: 12 }, (_, i) => `${['Read', 'Edit', 'Bash', 'Grep'][i % 4]} · step ${i + 1}`),
    tree: ko
      ? ['Main', '├ A1 Explore', '├ A2 Review', '└ A3 Fix']
      : ['Main', '├ A1 Explore', '├ A2 Review', '└ A3 Fix'],
  };
  for (const [id, lines] of Object.entries(rows)) {
    const box = document.createElement('div');
    box.slot = id;
    box.tabIndex = 0;
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', id);
    box.style.cssText =
      'height:120px;overflow:auto;margin-top:8px;padding:8px 10px;border-radius:10px;background:var(--ui-ib-pill);font-size:13px;line-height:1.7;color:var(--ui-ib-text-2)';
    for (const line of lines) {
      const p = document.createElement('div');
      p.textContent = line;
      box.append(p);
    }
    el.append(box);
  }
  el.data = {
    label: ko ? '세션 섹션' : 'Session sections',
    value: 'log',
    tabs: [
      { id: 'chat', label: 'Chat', icon: 'chat' },
      { id: 'log', label: ko ? '작업 로그' : 'Work log', icon: 'list', badge: 12 },
      { id: 'tree', label: ko ? '에이전트 트리' : 'Agent tree', icon: 'tree', end: true },
    ],
  };
  return el;
}

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
      type: "Array<{ id: string; label: string; meta?: string; model?: string; icon?: IconName; tone?: 'run' | 'wait' | 'done' | 'fail' | 'rest'; badge?: string | number; pinned?: boolean; end?: boolean; disabled?: boolean; title?: string }>",
      required: true,
      description:
        'The tabs, in order. `id` is the slot name of its panel and what ui-change carries. `tone` draws a status dot (run pulses); `badge` a count; `meta` a muted second label (part of the tab’s name); `model` leads the tab with its maker’s mark in the maker’s colour (drawn, not read — no model, no mark). `pinned` (the leading run of tabs) sticks at the start edge while the rest scroll under it, with a fade once they do. `end` puts that tab and the ones after it at the far end of the list.',
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
    {
      name: 'shared-panel',
      type: 'boolean',
      description:
        'Attribute. One panel for every tab: the default slot, which every tab aria-controls and the selected tab labels. The host repaints it on ui-change (an agent strip over one agent view).',
    },
    {
      name: 'panel-focus',
      type: "'none'",
      description:
        'Attribute. "none": the panel wrapper is no tab stop — the host’s slotted child is (a scroll box with its own tabindex, so Tab lands on it and arrows scroll it).',
    },
    { name: 'value', type: 'string | undefined', description: 'Read-only property: the selected tab id.' },
    {
      name: 'slot="<id>"',
      type: 'light-DOM child',
      description: 'The panel of tab <id>. Only the selected one shows. With shared-panel: the default slot instead.',
    },
    {
      name: '--ui-tabs-bg',
      type: 'CSS color',
      default: 'var(--ib-card)',
      description:
        'The surface under the list: pinned tabs paint it so the tabs scrolling under them do not show through.',
    },
    {
      name: '::part(tab | tab selected | tab pinned | tab end | panel | list | indicator)',
      type: 'CSS parts',
      description:
        'Style hooks: every tab, the selected one, the pinned ones, the first end tab; the panel, the scrolling list, the underline.',
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
    [
      'Tab',
      'Into the list (the selected tab), then into the panel (with panel-focus="none": into the panel’s own focusable content)',
    ],
    ['← / →', 'Previous / next tab (wraps, skips disabled); selects it unless activation="manual"'],
    ['Home / End', 'First / last tab'],
    ['Enter / Space', 'Select the focused tab (manual mode)'],
  ],
  a11y: [
    'role="tablist" named by data.label; tabs are role="tab" with aria-selected and aria-controls; panels are role="tabpanel" labelled by their tab and focusable.',
    'Roving tabindex: one tab stop in the list; disabled tabs use aria-disabled and are skipped. Pinned and end tabs keep their place in the arrow order (the data order).',
    'shared-panel: one role="tabpanel" every tab aria-controls, labelled by the selected tab. panel-focus="none" removes the panel’s tabindex — give the slotted child one (and a name) so the panel content stays reachable.',
    'meta is read as part of the tab’s name (“Main opus-5-5”); keep the status word in title when a tone dot carries it.',
    'Status dots are decoration next to a text label — put the state in the label or title when it matters.',
    'A model mark (`model`) is aria-hidden: it is drawn, not read, so name the model in meta or title when the reader needs it. It sits between the status dot and an `icon`; set one leading glyph, not both, unless both mean something.',
    'The underline is aria-hidden; selection is also carried by the ink label colour, not colour alone.',
    'Reduced motion: the underline jumps, the panel does not fade, the running dot stops pulsing.',
    'Sound (opt-in, @2lab.ai/ui/sound): choosing another tab plays a subtle select, forward to a later tab and back to an earlier one. Silent until the page turns sound on.',
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
      title: 'Agents',
      description:
        'Main is pinned: scroll the strip (narrow it) and the subagents slide under it behind a fade. Each tab has a muted type label (meta) and a status dot with the word in its title. shared-panel: one panel the host repaints on ui-change.',
      height: 240,
      create: agentStrip,
    },
    {
      id: 'section-strip',
      title: 'Section strip',
      description:
        'Agent tree sits at the far end (end: true). panel-focus="none": Tab goes from the list straight into the section’s own scroll box, where the arrows scroll it.',
      height: 260,
      create: () => sectionStrip(),
    },
    {
      id: 'manual',
      title: 'Manual',
      description: 'activation="manual": arrows move focus only; Enter or Space selects.',
      height: 240,
      create: () => make({ ...SECTIONS, value: 'log' }, SECTION_TEXT, { activation: 'manual' }),
    },
    {
      id: 'ko',
      title: '한국어',
      description: '섹션 탭: 에이전트 트리는 오른쪽 끝, 각 섹션은 자체 스크롤 상자(panel-focus="none").',
      height: 260,
      create: () => sectionStrip('ko'),
    },
  ],
};
