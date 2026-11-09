import type { ComponentDoc } from '../../docs/types';
import type { TimelineActionDetail, TimelineCheck, TimelineData } from './logic';
import './timeline';
import type { UiTimeline } from './timeline';

function timeline(data: TimelineData, attrs: Record<string, string> = {}): UiTimeline {
  const el = document.createElement('ui-timeline');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

/** A light-DOM card head, the timeline and a status line that says what the last event carried. */
function card(title: string, sub: string, el: UiTimeline, said: (el: UiTimeline) => string): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:12px;padding:18px 20px;min-width:0';
  const head = document.createElement('div');
  const h = document.createElement('div');
  h.style.cssText = 'font-size:14px;font-weight:650;color:var(--ui-ib-text)';
  h.textContent = title;
  const s = document.createElement('div');
  s.style.cssText = 'font-size:12.5px;color:var(--ui-ib-muted)';
  s.textContent = sub;
  head.append(h, s);
  const line = document.createElement('p');
  line.className = 'ui-status-line';
  line.style.margin = '0';
  line.textContent = said(el);
  el.addEventListener('ui-check', (e) => {
    const d = (e as CustomEvent<TimelineCheck>).detail;
    // After the event: the element shows the tick once nobody prevented it.
    queueMicrotask(() => {
      line.textContent = `ui-check → ${d.id} · ${d.checked ? 'checked' : 'unchecked'} — ${said(el)}`;
    });
  });
  el.addEventListener('ui-action', (e) => {
    const d = (e as CustomEvent<TimelineActionDetail>).detail;
    line.textContent = `ui-action → ${d.id} · ${d.action}`;
  });
  box.append(head, el, line);
  return box;
}

const progress = (el: UiTimeline) => `${el.progress.done} of ${el.progress.total} done`;

const RUN_SKIP = [
  { id: 'run-now', label: 'Run now' },
  { id: 'skip', label: 'Skip' },
];

const JOBS: TimelineData = {
  label: 'Scheduled jobs today',
  items: [
    {
      id: 'sync-calendars',
      time: '07:00',
      title: 'sync-calendars',
      detail: 'Every day · pulled 214 events in 42 s',
      tone: 'done',
      status: { text: 'Ran 07:01', tone: 'done' },
    },
    {
      id: 'digest-mail',
      time: '09:30',
      title: 'digest-mail',
      detail: 'Weekdays · the runner was offline at 09:30',
      tone: 'fail',
      overdue: true,
      status: { text: 'Missed', tone: 'fail' },
      actions: RUN_SKIP,
    },
    {
      id: 'reindex-search',
      time: '13:00',
      title: 'reindex-search',
      detail: 'Twice a day · 18,240 of 31,002 docs',
      tone: 'run',
      current: true,
      status: { text: 'Running', tone: 'run' },
    },
    {
      id: 'token-spend-report',
      time: '18:00',
      title: 'token-spend-report',
      detail: 'Every day · posts to #ops-costs',
      status: { text: 'Later' },
      actions: RUN_SKIP,
    },
    {
      id: 'prune-worktrees',
      time: '23:30',
      title: 'prune-worktrees',
      detail: 'Every day · keeps the last 20 per agent',
      status: { text: 'Later' },
      actions: RUN_SKIP,
    },
  ],
};

const RELEASE: TimelineData = {
  label: 'Release checklist, v0.41.0',
  items: [
    { id: 'freeze', title: 'Freeze main', detail: 'No merges after 10:00', checkable: true, checked: true },
    {
      id: 'bump',
      title: 'Bump version to 0.41.0',
      detail: 'package.json · CHANGELOG',
      checkable: true,
      checked: true,
    },
    {
      id: 'verify',
      title: 'npm run verify',
      detail: 'check · typecheck · test · build:site · consumer-check',
      checkable: true,
      checked: true,
      status: { text: 'Passed 4 m 10 s', tone: 'done' },
    },
    {
      id: 'tag',
      title: 'Tag and push v0.41.0',
      detail: 'git tag -s v0.41.0 && git push --tags',
      checkable: true,
      current: true,
    },
    { id: 'publish', title: 'Publish to npm', detail: 'npm publish --access public', checkable: true },
    {
      id: 'notes',
      title: 'Post the release notes',
      detail: '#releases and the docs changelog',
      checkable: true,
      actions: [{ id: 'draft', label: 'Draft' }],
    },
  ],
};

const ONCALL: TimelineData = {
  label: 'On-call checks today',
  items: [
    {
      id: 'budget',
      time: '08:00',
      title: 'Error budget',
      detail: 'Checked 8:04 · 71% left this month',
      checkable: true,
      checked: true,
    },
    {
      id: 'alerts',
      time: '08:00',
      title: 'Overnight alerts',
      detail: 'Checked 8:12 · 2 paged, both resolved',
      checkable: true,
      checked: true,
    },
    {
      id: 'keys',
      time: '09:00',
      title: 'Rotate the staging API keys',
      detail: 'Vault → staging/agents',
      checkable: true,
      overdue: true,
      tone: 'fail',
    },
    {
      id: 'latency',
      time: '14:00',
      title: 'p95 latency on /api/chat',
      detail: 'Under 1.2 s',
      checkable: true,
      tone: 'wait',
      current: true,
    },
    { id: 'handover', time: '18:00', title: 'Hand over', detail: 'Notes in #oncall', checkable: true, tone: 'run' },
  ],
};

export const doc: ComponentDoc = {
  slug: 'timeline',
  name: 'Timeline',
  tag: 'ui-timeline',
  summary:
    'Today’s schedule as a checklist — what ran, what is late, what is next — with a box to tick and a few quiet actions per row.',
  description:
    'A time column, a vertical rail with a round marker per item (filled when done, a ring while to do, coloured by the item’s tone), and a row card with the title, one detail line, a status pill at the right (“Ran 07:01” in the done tone, “Missed” in fail, “Later” muted), quiet text actions (Run now, Skip) and a checkbox at the far right. The rail is one continuous line, ink from the first marker down to the last done one and muted after it. An overdue row is outlined in the fail colour and its time turns with it; the “now” row gets a soft highlight. Ticking a box sends a cancelable ui-check and — unless a listener prevents it — shows the new state at once, from a local note that the next data assignment clears (data stays the truth). compact drops the cards for hairline-separated rows. Under 480px of its own width the pill and actions drop under the title and the time column narrows; nothing overflows at 390px. The element never fetches.',
  usedIn:
    'Fits the soma-work dashboard as the “today” view of scheduled jobs and as a release or on-call checklist beside the agent runs (not wired yet).',
  reference: {
    name: 'Halvi (Code and Chill) — pattern studied, no code used',
    url: 'https://demo.codeandchill.store/halvi/',
  },
  group: 'Components',
  props: [
    {
      name: 'data.items',
      type: 'TimelineItem[]',
      required: true,
      description:
        'In order. An item needs an `id` (unique; ui-check / ui-action carry it back) and a `title`; anything else is dropped.',
    },
    {
      name: 'data.items[].time',
      type: 'string',
      description: 'The time column (“08:00”). No item with a time: no column.',
    },
    { name: 'data.items[].detail', type: 'string', description: 'One quiet line under the title (truncates).' },
    {
      name: 'data.items[].tone',
      type: "'done' | 'run' | 'wait' | 'fail' | 'idle'",
      description:
        'The marker’s colour, and the status pill’s when its status has no tone. Without one: ink when done, fail while overdue, muted otherwise. A running marker breathes.',
    },
    {
      name: 'data.items[].status',
      type: '{ text: string; tone?: TimelineTone }',
      description:
        'The pill at the right. Without one: “Done” for a ticked box, “Overdue” while late. After a local tick the data’s words are stale, so the pill says Done (or Overdue / nothing when unticked).',
    },
    {
      name: 'data.items[].checkable / checked',
      type: 'boolean',
      description:
        'Draw a checkbox (a button role="checkbox"). A checkable item is done when checked; any other item when its tone is done.',
    },
    {
      name: 'data.items[].overdue',
      type: 'boolean',
      description: 'Late: the card is outlined in the fail colour and the time drawn in it — until the item is done.',
    },
    {
      name: 'data.items[].actions',
      type: 'Array<{ id: string; label: string }>',
      description: 'Quiet text buttons beside the pill; each sends ui-action.',
    },
    {
      name: 'data.items[].current',
      type: 'boolean',
      description: 'The “now” row: a soft highlight and aria-current="time".',
    },
    { name: 'data.label', type: 'string', default: '"Schedule"', description: 'The list’s accessible name.' },
    {
      name: 'data.empty',
      type: 'string',
      default: '"Nothing scheduled"',
      description: 'Words when there are no items.',
    },
    {
      name: 'compact',
      type: 'boolean attribute',
      description: 'No row cards: hairline-separated rows, small markers, plain tinted status words.',
    },
    {
      name: 'lang',
      type: '"en" | "ko"',
      default: '"en"',
      description: 'Overdue / 지남, Done / 완료, the empty words, the box names.',
    },
    {
      name: '--timeline-bg',
      type: 'CSS property on the element',
      default: 'var(--ui-ib-card)',
      description: 'The surface behind the rail (the ring that parts the line around each marker).',
    },
    {
      name: 'progress',
      type: '{ done: number; total: number; split: number } (read-only)',
      description: 'Done now (local ticks included), of how many, and the last done index.',
    },
    {
      name: 'timelineItems(data) / timelineProgress(items) / timelineStatus(item, checked, strings)',
      type: 'helpers',
      description:
        'Pure: the items drawn (junk dropped, order kept), { done, total, split } for a header count or the rail, and the status a row shows.',
    },
  ],
  events: [
    {
      name: 'ui-check',
      detail: '{ id: string; checked: boolean }',
      description:
        'A box was ticked or unticked (checked is the new state). Bubbling, composed, cancelable: prevent it and the box stays as it was; set new data in the listener and your data wins.',
    },
    {
      name: 'ui-action',
      detail: '{ id: string; action: string }',
      description: 'An action button (Run now, Skip). Bubbling, composed, cancelable.',
    },
  ],
  keyboard: [
    ['Tab / Shift+Tab', 'Through the actions and checkboxes in reading order.'],
    ['Space', 'Tick or untick the focused box (Enter works too: it is a button).'],
    ['Enter / Space', 'Press the focused action.'],
  ],
  a11y: [
    'An ordered list named by data.label; each row reads as its time, title, detail, status and controls in order. The rail and markers are aria-hidden.',
    'Each box is a <button role="checkbox"> with aria-checked and the name “Mark <title> done” (“<title> 완료 표시”). Focus stays on it through the re-render a tick causes (data-key).',
    'Overdue is never colour alone: the pill says Overdue (or your words), and when your status says something else readers hear “, Overdue” after the time.',
    'The “now” row is aria-current="time". A running marker’s ring breathes gently; under reduced motion it is still.',
    'On a coarse pointer the checkbox and the actions are 44px targets; nothing overflows at 390px.',
    'Sound (opt-in, @2lab.ai/ui/sound): a tick that went through plays toggle (forward when checked, back when unchecked), an action that went through plays tap; a prevented event and data the app sets are silent. Silent until the page turns sound on.',
  ],
  usage: `<ui-timeline></ui-timeline>
<script type="module">
  import '@2lab.ai/ui/timeline';
  const tl = document.querySelector('ui-timeline');
  tl.data = {
    label: 'Scheduled jobs today',
    items: [
      { id: 'sync', time: '07:00', title: 'sync-calendars', tone: 'done', status: { text: 'Ran 07:01', tone: 'done' } },
      { id: 'digest', time: '09:30', title: 'digest-mail', overdue: true, tone: 'fail', status: { text: 'Missed', tone: 'fail' },
        actions: [{ id: 'run-now', label: 'Run now' }, { id: 'skip', label: 'Skip' }] },
      { id: 'reindex', time: '13:00', title: 'reindex-search', tone: 'run', current: true, status: { text: 'Running', tone: 'run' } },
    ],
  };
  tl.addEventListener('ui-action', (e) => api.cron(e.detail.id, e.detail.action));
  tl.addEventListener('ui-check', (e) => { if (!canTick(e.detail.id)) e.preventDefault(); });
</script>
<ui-timeline compact lang="ko"></ui-timeline>`,
  demos: [
    {
      id: 'jobs',
      title: 'Scheduled jobs today',
      description:
        'Five cron jobs: one ran, one missed while the runner was offline (outlined, its time in the fail colour), one running now, two later. Run now / Skip send ui-action.',
      height: 480,
      create: () => card('Today', 'Mon 9 Nov · scheduled jobs', timeline({ ...JOBS }), () => 'Press Run now or Skip.'),
    },
    {
      id: 'release',
      title: 'Release checklist',
      description:
        'Checkable steps with no times (no time column). Tick a step: the box, the marker and the rail move at once — the rail is ink down to the last done step — and ui-check reports it.',
      height: 520,
      create: () => card('Release v0.41.0', 'Six steps · tick as you go', timeline({ ...RELEASE }), progress),
    },
    {
      id: 'compact',
      title: 'Compact — on-call checks',
      description:
        'compact: no cards, hairline rows and small markers — the short list beside a dashboard. The overdue key rotation shows Overdue in the fail tone.',
      height: 400,
      create: () => card('On-call checks', '3 of 5 left', timeline({ ...ONCALL }, { compact: '' }), progress),
    },
    {
      id: 'ko',
      title: 'Korean',
      description: 'lang="ko": 지남 for overdue, 완료 for a ticked box, and the box names in Korean.',
      height: 420,
      create: () =>
        card(
          '온콜 점검',
          '오늘 · 5개 중 3개 남음',
          timeline(
            {
              label: '오늘의 온콜 점검',
              items: [
                {
                  id: 'budget',
                  time: '08:00',
                  title: '에러 예산 확인',
                  detail: '이번 달 71% 남음',
                  checkable: true,
                  checked: true,
                },
                {
                  id: 'alerts',
                  time: '08:00',
                  title: '야간 알림 검토',
                  detail: '호출 2건, 모두 해결',
                  checkable: true,
                  checked: true,
                },
                {
                  id: 'keys',
                  time: '09:00',
                  title: '스테이징 API 키 교체',
                  detail: 'Vault → staging/agents',
                  checkable: true,
                  overdue: true,
                },
                {
                  id: 'latency',
                  time: '14:00',
                  title: '/api/chat p95 지연',
                  detail: '1.2초 이하',
                  checkable: true,
                  current: true,
                },
                { id: 'handover', time: '18:00', title: '인수인계', detail: '#oncall 채널에 메모', checkable: true },
              ],
            },
            { lang: 'ko' },
          ),
          (el) => `${el.progress.total}개 중 ${el.progress.done}개 완료`,
        ),
    },
  ],
};
