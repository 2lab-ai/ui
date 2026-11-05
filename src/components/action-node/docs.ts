import type { ComponentDoc } from '../../docs/types';
import './action-node';
import type { ActionNodeAction, ActionNodeActionDetail, ActionNodeData, UiActionNode } from './action-node';

function node(data: ActionNodeData, attrs: Record<string, string> = {}): UiActionNode {
  const el = document.createElement('ui-action-node');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  // The demo host opens nothing: it keeps the page where it is.
  el.addEventListener('ui-open', (e) => e.preventDefault());
  return el;
}

/** Room for the fan: it reaches about 48px above the card and to its right. */
function stage(...els: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-wrap:wrap;align-items:flex-start;gap:24px 72px;padding:56px 64px 24px 24px';
  box.append(...els);
  return box;
}

function col(...els: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:4px';
  box.append(...els);
  return box;
}

function logLine(text: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = 'ui-status-line';
  p.style.padding = '0 24px 16px';
  p.textContent = text;
  return p;
}

const RUN: ActionNodeAction = { id: 'run', label: 'Run now', icon: 'play' };
const PAUSE: ActionNodeAction = { id: 'pause', label: 'Pause', icon: 'pause' };
const RESUME: ActionNodeAction = { id: 'resume', label: 'Resume', icon: 'play' };
const EDIT: ActionNodeAction = { id: 'edit', label: 'Edit', icon: 'edit' };
const DELETE: ActionNodeAction = { id: 'delete', label: 'Delete', icon: 'trash', tone: 'danger' };

const STANDUP: ActionNodeData = {
  name: 'Daily standup digest',
  description: 'Reads yesterday’s threads in #dev-soma and posts a short digest to #ops before the morning sync.',
  icon: 'clock',
  status: 'active',
  meta: ['Weekdays 09:00 KST', 'Next in 2h 14m', 'sonnet'],
  chips: [{ label: '#ops' }, { label: '#dev-soma' }, { label: '#release' }],
  more: 3,
  actions: [RUN, PAUSE, EDIT, DELETE],
};

const AUDIT: ActionNodeData = {
  name: 'Nightly dependency audit',
  description: 'Runs npm audit across the soma-work repos and opens one issue per new advisory.',
  icon: 'shield',
  status: 'running',
  meta: ['Daily 02:00 KST', 'Started 4m ago', 'haiku'],
  chips: [{ label: '#security' }, { label: '#dev-soma' }, { label: 'haiku', mark: 'H' }],
  actions: [{ id: 'stop', label: 'Stop run', icon: 'stop' }, { id: 'log', label: 'Open log', icon: 'file-text' }, EDIT],
};

const SMOKE: ActionNodeData = {
  name: 'Prod smoke test',
  description: 'Signs in, starts a session and sends one prompt against production — last run failed 03:12.',
  icon: 'target',
  status: 'failed',
  meta: ['Every 6h', 'Failed 03:12 KST · exit 1', 'opus'],
  chips: [{ label: '#prod-alerts' }, { label: '#oncall' }],
  more: 1,
  actions: [{ id: 'retry', label: 'Run again', icon: 'refresh' }, PAUSE, EDIT, DELETE],
};

const COSTS_KO: ActionNodeData = {
  name: '주간 비용 리포트',
  description: '지난주 모델별 토큰 사용량과 비용을 정리해 #finance 채널에 올립니다.',
  icon: 'list',
  status: 'paused',
  meta: ['매주 월요일 10:00 KST', '다음 실행 없음', 'sonnet'],
  chips: [{ label: '#finance' }, { label: '#ops' }, { label: 'sonnet', mark: 'S' }],
  actions: [
    { id: 'resume', label: '재개', icon: 'play' },
    { id: 'edit', label: '편집', icon: 'edit' },
    { id: 'delete', label: '삭제', icon: 'trash', tone: 'danger' },
  ],
};

const RELEASE: ActionNodeData = {
  name: 'Release notes draft',
  description: 'Collects the PRs merged since the last tag and drafts bilingual release notes in #release.',
  icon: 'file-text',
  status: 'active',
  meta: ['Fridays 17:00 KST', 'Next in 3d 6h', 'opus'],
  chips: [{ label: '#release' }, { label: '#dev-soma' }, { label: 'opus', mark: 'O' }],
  actions: [RUN, PAUSE, EDIT, DELETE],
};

/**
 * A stand-in host for the standup job: Run now runs it for 2.5 s, Pause and Resume swap the status and the button,
 * Delete greys the card out. Every `ui-action` is logged on the line under the card.
 */
function standup(): HTMLElement {
  const el = node(STANDUP);
  const log = logLine('ui-action · —');
  let running = 0;
  const set = (patch: Partial<ActionNodeData>) => {
    el.data = { ...(el.data ?? STANDUP), ...patch };
  };
  el.addEventListener('ui-action', (e) => {
    const { id } = (e as CustomEvent<ActionNodeActionDetail>).detail;
    log.textContent = `ui-action · ${id}`;
    if (id === 'run') {
      set({ status: 'running', meta: ['Weekdays 09:00 KST', 'Running now', 'sonnet'] });
      clearTimeout(running);
      running = window.setTimeout(() => set({ status: 'active', meta: STANDUP.meta }), 2500);
    } else if (id === 'pause') {
      set({ status: 'paused', meta: ['Weekdays 09:00 KST', 'Paused', 'sonnet'], actions: [RUN, RESUME, EDIT, DELETE] });
    } else if (id === 'resume') {
      set({ status: 'active', meta: STANDUP.meta, actions: STANDUP.actions });
    } else if (id === 'delete') {
      el.style.opacity = '0.45';
      log.textContent = 'ui-action · delete — the host removes the job';
    }
  });
  return col(stage(el), log);
}

export const doc: ComponentDoc = {
  slug: 'action-node',
  name: 'Action Node',
  tag: 'ui-action-node',
  summary:
    'What does this scheduled job do, when does it run, and what do I want to do with it? — its actions wait in the corner until you reach for them.',
  description:
    'One automation step as a card: a mark and the name, what it does, a quiet line of facts (when it runs, when it runs next, the model) and a chain of overlapping round chips for the channels and models it touches, with a “+N” for the rest. The status sits under the name: Active (a done dot), Paused (a hollow dot), Running (the working ring) or Last run failed. Its two to four actions are folded into the top-right corner. Reach for the card with a mouse — or press the corner trigger — and they fan out around the corner, on an arc just outside it, popping in one after another with a small overshoot; they fold back in reverse 120 ms after the pointer leaves the card and the fan (an invisible region bridges the gap, so the hover holds on the way to a button). A danger action (Delete) asks for a second press within 4 s. Choosing sends a cancelable ui-action; pressing the name sends ui-open — the card itself is not one big button. Under reduced motion the fan only fades.',
  usedIn:
    'soma-work scheduled jobs (cron): what a job runs, when it runs next, which channels and models it touches — with Run now / Pause / Edit / Delete folded into the corner until you reach for them.',
  reference: { name: 'bencho.dev — Action node (MIT)', url: 'https://bencho.dev/blocks/action-node' },
  group: 'Components',
  props: [
    { name: 'data.name', type: 'string', required: true, description: 'The job’s name: a button that sends ui-open.' },
    { name: 'data.description', type: 'string', description: 'What it does, one or two sentences.' },
    { name: 'data.icon', type: 'IconName', default: "'clock'", description: 'The glyph in the mark.' },
    {
      name: 'data.status',
      type: "'active' | 'paused' | 'running' | 'failed'",
      description: 'Active · Paused · Running · Last run failed, under the name. Without it, no status.',
    },
    {
      name: 'data.meta',
      type: 'string[]',
      description: 'Quiet facts on one line, dot-separated: ["Weekdays 09:00 KST", "Next in 2h 14m", "sonnet"].',
    },
    {
      name: 'data.chips',
      type: 'Array<{ label: string; mark?: string }>',
      description:
        'The chain: round 24px chips, overlapping. Each shows its mark (or the initials of its label) and has the label as its title.',
    },
    { name: 'data.more', type: 'number', description: 'How many chips are not shown: a “+N” chip at the end.' },
    {
      name: 'data.actions',
      type: "Array<{ id: string; label: string; icon: IconName; tone?: 'danger' }>",
      description:
        'The fan, in order along the corner (the top edge first). The first four are shown. tone "danger" draws it in the failure colour and asks for a second press.',
    },
    {
      name: 'open',
      type: 'boolean attribute / property (reflects)',
      description:
        'The fan is out. Set by the host it is pinned: it does not fold when the pointer leaves or a press lands outside (the trigger and Esc still close it). The person opening it sets it too.',
    },
    {
      name: 'lang',
      type: '"en" | "ko"',
      default: '"en"',
      description: 'The built-in words (status, labels, prompts).',
    },
    {
      name: 'width',
      type: 'CSS on the element',
      default: '296px',
      description:
        'An inline block 296px wide (max 100%); set your own width for a grid. The fan opens outside the card: leave about 56px above it and to its right.',
    },
    {
      name: 'nodeFanPoints(count, cornerRadius, reach) / nodeInitials(label) / nodeStagger(index, count, open, ms)',
      type: 'helpers',
      description:
        'Pure: where the buttons sit from the top-right corner (px), a chip’s letters, a button’s delay as the fan opens or closes.',
    },
  ],
  events: [
    {
      name: 'ui-action',
      detail: '{ id: string }',
      description:
        'A fan button was pressed (a danger one: pressed twice). Cancelable; the host does the work and answers with new data.',
    },
    { name: 'ui-open', detail: '{}', description: 'The name was pressed: open the job. Cancelable.' },
  ],
  keyboard: [
    ['Tab', 'The name, then the corner trigger, then (while open) the fan as one stop'],
    ['Enter / Space on the trigger', 'Open the fan with focus on its first button, or close it'],
    ['← → ↑ ↓', 'Move between the fan’s buttons (wrapping)'],
    ['Home / End', 'The first / last button'],
    ['Enter / Space on a button', 'Run the action; a danger action arms first, a second press within 4 s confirms'],
    ['Esc', 'Close the fan and return focus to the trigger'],
  ],
  a11y: [
    'The trigger is a real button named “Actions for <name>” with aria-expanded and aria-controls, always in the tab order; on touch its hit area is 44px, and so is each fan button’s.',
    'The fan is a toolbar with a roving tab stop. Closed, it is inert and its buttons are out of the tab order; opening from the keyboard moves focus to the first button, and Esc gives focus back to the trigger.',
    'Hover opens the fan only for a mouse on a device that hovers ((hover: hover) and (pointer: fine)); touch and keyboard use the trigger.',
    'Each fan button is named by its label (aria-label and title). An armed danger button says “Press again to delete” — in its name, beside the status, and once in a polite live region — and disarms after 4 s, when focus leaves it or when the fan closes.',
    'The chip chain is hidden from screen readers; one visually hidden sentence lists its labels (“#ops, #dev-soma, #release, 3 more”). The status is a word, never the dot alone.',
    'Reduced motion: no slide, overshoot, scale or stagger — the fan fades in and out where it stands; the running ring stands still with a dot in it.',
    'Sound (opt-in, @2lab.ai/ui/sound): opening the fan from the trigger plays a subtle open, closing it (the trigger, Esc, a press outside) a subtle close; an action that went through plays tap, arming a danger action a subtle warning, the name navigate. Hover, the open attribute and data are silent.',
  ],
  usage: `<ui-action-node></ui-action-node>
<script type="module">
  import '@2lab.ai/ui/action-node';
  const job = document.querySelector('ui-action-node');
  job.data = {
    name: 'Daily standup digest',
    description: 'Reads yesterday’s threads and posts a digest to #ops.',
    status: 'active',
    meta: ['Weekdays 09:00 KST', 'Next in 2h 14m', 'sonnet'],
    chips: [{ label: '#ops' }, { label: '#dev-soma' }, { label: '#release' }],
    more: 3,
    actions: [
      { id: 'run', label: 'Run now', icon: 'play' },
      { id: 'pause', label: 'Pause', icon: 'pause' },
      { id: 'edit', label: 'Edit', icon: 'edit' },
      { id: 'delete', label: 'Delete', icon: 'trash', tone: 'danger' },
    ],
  };
  job.addEventListener('ui-action', (e) => runCronAction(jobId, e.detail.id));
  job.addEventListener('ui-open', () => openJob(jobId));
</script>
<!-- Leave ~56px above and to the right of the card: the fan opens out there. -->`,
  demos: [
    {
      id: 'standup',
      title: 'A scheduled job',
      description:
        'Move the pointer onto the card (or Tab to the corner trigger and press Enter): Run now, Pause, Edit and Delete fan out around the corner. Delete asks for a second press. The line under the card logs each ui-action; the stand-in host answers Run now and Pause.',
      height: 340,
      create: standup,
    },
    {
      id: 'states',
      title: 'Running and failed',
      description:
        'A job running now (the working ring, three actions) beside one whose last run failed (four actions, a +1 chip).',
      height: 360,
      create: () => stage(node(AUDIT), node(SMOKE)),
    },
    {
      id: 'ko',
      title: 'Korean, paused',
      description: 'lang="ko" — 일시 정지, “주간 비용 리포트 동작”, and “한 번 더 누르면 삭제” on the armed Delete.',
      height: 320,
      create: () => stage(node(COSTS_KO, { lang: 'ko' })),
    },
    {
      id: 'pinned',
      title: 'Pinned open',
      description:
        'The open attribute pins the fan out — for a screenshot, or a host that wants the actions showing. The trigger or Esc still closes it.',
      height: 320,
      create: () => stage(node(RELEASE, { open: '' })),
    },
  ],
};
