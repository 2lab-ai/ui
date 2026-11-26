import type { ComponentDoc } from '../../docs/types';
import './goal-card';
import '../composer/composer';
import type { ComposerSubmitDetail } from '../composer/logic';
import type {
  GoalAddDetail,
  GoalCardData,
  GoalCurrent,
  GoalDeleteDetail,
  GoalEditDetail,
  GoalIdDetail,
  GoalMoveDetail,
  GoalPast,
  UiGoalCard,
} from './goal-card';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/**
 * A stand-in host: every intent is a short write (busy for 700 ms), then the data changes the way a server would
 * answer — Pause / Resume flip the status, Complete and Delete start the next queued goal, Add queues or starts.
 */
function wire(el: UiGoalCard): UiGoalCard {
  let seq = 0;
  const data = () => el.data ?? {};
  const set = (patch: Partial<GoalCardData>) => {
    el.data = { ...data(), ...patch };
  };
  const later = (fn: () => void) => window.setTimeout(fn, 700);
  const nextUp = (): Partial<GoalCardData> => {
    const [next, ...rest] = data().queue ?? [];
    const current: GoalCurrent | null = next
      ? {
          id: next.id,
          objective: next.objective,
          status: 'active',
          progress: { done: 0, total: 4 },
          startedAt: Date.now(),
        }
      : null;
    return { current, queue: rest };
  };
  el.addEventListener('ui-pause', () => {
    set({ busy: 'pause', error: undefined });
    later(() => {
      const c = data().current;
      set({ busy: null, current: c ? { ...c, status: 'paused', updatedAt: Date.now() } : c });
    });
  });
  el.addEventListener('ui-resume', () => {
    set({ busy: 'pause', error: undefined });
    later(() => {
      const c = data().current;
      set({ busy: null, current: c ? { ...c, status: 'active', updatedAt: Date.now() } : c });
    });
  });
  el.addEventListener('ui-complete', (e) => {
    const { id } = (e as CustomEvent<GoalIdDetail>).detail;
    set({ busy: 'complete', busyId: id, error: undefined });
    later(() => {
      const c = data().current;
      const past: GoalPast[] = c
        ? [{ id: c.id, objective: c.objective, status: 'complete', endedAt: Date.now() }, ...(data().history ?? [])]
        : (data().history ?? []);
      set({ busy: null, busyId: undefined, history: past, ...nextUp() });
    });
  });
  el.addEventListener('ui-delete', (e) => {
    const { id, queued } = (e as CustomEvent<GoalDeleteDetail>).detail;
    set({ busy: 'delete', busyId: id, error: undefined });
    later(() => {
      if (queued) set({ busy: null, busyId: undefined, queue: (data().queue ?? []).filter((q) => q.id !== id) });
      else set({ busy: null, busyId: undefined, ...nextUp() });
    });
  });
  // Move: the host shows the new order in its own data at once, then writes it.
  el.addEventListener('ui-move', (e) => {
    const { order } = (e as CustomEvent<GoalMoveDetail>).detail;
    const byId = new Map((data().queue ?? []).map((q) => [q.id, q]));
    set({ queue: order.map((id) => byId.get(id)).filter((q) => !!q), error: undefined });
  });
  // Edit: the host takes the save (the editor stays, Save spins) and answers with the new text.
  el.addEventListener('ui-edit', (e) => {
    e.preventDefault();
    const { id, objective } = (e as CustomEvent<GoalEditDetail>).detail;
    set({ busy: 'edit', busyId: id, error: undefined });
    later(() =>
      set({
        busy: null,
        busyId: undefined,
        queue: (data().queue ?? []).map((q) => (q.id === id ? { ...q, objective } : q)),
      }),
    );
  });
  el.addEventListener('ui-add', (e) => {
    const { objective } = (e as CustomEvent<GoalAddDetail>).detail;
    set({ busy: 'add', error: undefined });
    later(() => {
      const id = `new-${++seq}`;
      const c = data().current;
      if (!c || c.status === 'complete')
        set({ busy: null, current: { id, objective, status: 'active', startedAt: Date.now() } });
      else set({ busy: null, queue: [...(data().queue ?? []), { id, objective, addedAt: Date.now() }] });
    });
  });
  return el;
}

/**
 * The host's own add box: a `<ui-composer collapse>` in slot "add" — one line until it gets focus, then the whole
 * composer (files, images, voice). Its send becomes the card's add (the stand-in host keeps the files' names).
 */
function withComposer(el: UiGoalCard, ko = false): UiGoalCard {
  const c = document.createElement('ui-composer');
  c.slot = 'add';
  c.setAttribute('collapse', '');
  if (ko) c.setAttribute('lang', 'ko');
  c.data = {
    label: ko ? '목표 추가' : 'Add a goal',
    placeholder: ko ? '목표 추가 — 지금 목표 다음에 시작' : 'Add a goal — starts after the current one',
    submitLabel: ko ? '추가' : 'Add',
    hint: true,
    minRows: 2,
    maxRows: 8,
    maxLength: 4000,
  };
  c.addEventListener('ui-submit', (e) => {
    const { text, files } = (e as CustomEvent<ComposerSubmitDetail>).detail;
    if (!text) {
      e.preventDefault();
      return;
    }
    const objective = files.length ? `${text}\n(${files.map((f) => f.name).join(', ')})` : text;
    el.dispatchEvent(new CustomEvent('ui-add', { detail: { objective }, cancelable: true }));
  });
  el.append(c);
  return el;
}

function make(data: GoalCardData, attrs: Record<string, string> = {}, live = true): UiGoalCard {
  const el = document.createElement('ui-goal-card');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return live ? wire(el) : el;
}

function stack(...els: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:20px;width:100%';
  box.append(...els);
  return box;
}

const LONG =
  'Migrate the billing service to the new payments API. Keep the old webhooks answering until every customer has moved, and write a rollback runbook for each step.\nEvery step passes the integration suite on staging before it ships to production; record the cut-over checklist in the repository wiki and link it from the release notes so support can follow along.';

function activeData(): GoalCardData {
  const now = Date.now();
  return {
    current: {
      id: 'g-billing',
      objective: LONG,
      status: 'active',
      progress: { done: 3, total: 5 },
      startedAt: now - 2 * HOUR - 14 * MIN,
      updatedAt: now - 6 * MIN,
    },
    queue: [
      {
        id: 'g-docs',
        objective: 'Write the v2 migration guide with one worked example per endpoint.',
        addedAt: now - 40 * MIN,
      },
      {
        id: 'g-contrast',
        objective: 'Audit colour contrast on the settings page (both themes).',
        addedAt: now - 12 * MIN,
      },
    ],
    history: [
      {
        id: 'g-flaky',
        objective: 'Find and fix the flaky checkout test on CI.',
        status: 'complete',
        endedAt: now - 3 * HOUR,
      },
      {
        id: 'g-cache',
        objective: 'Cut cold-start time of the search API below 300 ms.',
        status: 'failed',
        endedAt: now - DAY - 2 * HOUR,
      },
      {
        id: 'g-i18n',
        objective: 'Translate the onboarding emails into Korean.',
        status: 'complete',
        endedAt: now - 3 * DAY,
      },
    ],
  };
}

export const doc: ComponentDoc = {
  slug: 'goal-card',
  name: 'Goal Card',
  tag: 'ui-goal-card',
  group: 'Components',
  summary:
    'What the agent is working toward, how far it got, and what comes next — with the calls to finish, pause or drop it.',
  description:
    'The current goal with its status (icon + word), progress and when it started; the objective folds to three lines with More / Less shown only when the text actually runs past them. Complete, Pause / Resume and Delete hand the decision to the host (`actions` limits them to what the host answers); Complete and Delete (and removing a queued goal) ask for a second press within 4 s. Below: the goals queued after it, an add box (Enter adds, Shift+Enter is a new line), and the goals that ended, collapsed. The card never writes anything itself — it sends cancelable events and draws the data it is given.',
  usedIn: 'soma-work dashboard › session panel › goal (`.panel-goal`, the goal editor)',
  reference: { name: 'WAI-ARIA APG Disclosure', url: 'https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/' },
  props: [
    {
      name: 'data.current',
      type: '{ id, objective, status, progress?, startedAt?, updatedAt? } | null',
      description:
        'The goal being worked on. Without it the card says “No goal yet” (or “No current goal” when a queue or history exists).',
    },
    {
      name: 'data.current.status',
      type: "'active' | 'paused' | 'complete' | 'failed' | 'cancelled' | string",
      description:
        'Drawn as icon + word in the st-* tones: Active (run), Paused (wait), Complete (done), Failed (fail), Cancelled (neutral). Aliases: running, completed, done, error, canceled. An unknown word is shown as written, neutral. Decides the actions: active → Complete · Pause · Delete; paused → Complete · Resume · Delete; ended → Delete.',
    },
    {
      name: 'data.current.progress',
      type: 'number | { done: number; total: number }',
      description:
        'A fraction 0..1 (clamped) → a bar and “60%”; or steps → a bar and “3 / 5 · 60%”. The percent reaches 100 only when finished. Anything else draws no bar.',
    },
    {
      name: 'data.current.startedAt / updatedAt',
      type: 'number (epoch ms) | ISO string',
      description: '“Started 2h ago · Updated 5m ago”. Updated is left out when it is within a minute of the start.',
    },
    {
      name: 'data.current.meta',
      type: 'Array<string | { label: string; value: string }>',
      description:
        'Budget and bookkeeping that is not progress — the auto-continue count `{ label: "Continues", value: "3/10" }`, a cost — one quiet line after the times (label, then the value in tabular figures).',
    },
    {
      name: 'data.current.note',
      type: 'string',
      description:
        'A note under the goal: what the evaluator says is left, why it paused. Quiet prose behind a hairline, newlines kept.',
    },
    {
      name: 'data.queue',
      type: 'Array<{ id, objective, addedAt? }>',
      description:
        'Goals waiting their turn, numbered in order. Each has a drag handle (two or more goals; `ui-move`), an Edit that opens the text in place (`ui-edit`) and a two-press remove (`ui-delete`, `queued: true`). A move shows the new order at once, until the next data — so put the new order in your next data (the card’s order gives way to it).',
    },
    {
      name: 'data.history',
      type: 'Array<{ id, objective, status, endedAt?, meta?, note? }>',
      description:
        'Goals that ended, in the order given (newest first, usually). Collapsed under “Past goals”. `meta` is one quiet line per goal (active time, tokens, cost, how it closed — strings or label · value pairs); `note` the evaluator’s reason under it.',
    },
    {
      name: 'data.canEdit',
      type: 'boolean',
      default: 'true',
      description: '`false` = read-only: no actions, no add box. The fold and the history still open.',
    },
    {
      name: 'data.actions',
      type: "Array<'complete' | 'pause' | 'resume' | 'delete' | 'move' | 'edit'>",
      default: 'every action',
      description:
        'The goal actions the host answers. Of what the status allows, only these are drawn — a host whose route takes add and delete passes `["delete"]`; `[]` draws no goal action. Without `delete` the queued goals lose their remove (it is a delete), without `move` their drag handle, without `edit` their Edit. The add box stays with `canEdit`. `goalActions(status, actions)` is the current goal’s rule as a function.',
    },
    {
      name: 'data.busy',
      type: "'complete' | 'pause' | 'delete' | 'add' | 'move' | 'edit' | null",
      description:
        'A goal write in flight: that button spins with “Deleting…” etc. and every goal action waits (aria-disabled — a focused button keeps its focus), the drag handles and Edit too. The add box stays editable. `pause` covers Resume too.',
    },
    {
      name: 'data.busyId',
      type: 'string',
      description:
        'The goal `busy` is about — a queued goal’s id makes its remove, its handle (`move`) or its editor’s Save (`edit`) spin. Default: the current goal.',
    },
    {
      name: 'data.error',
      type: 'string',
      description:
        'The last refused goal action, as an alert (role="alert", fail tint) under the head. Clear it on the next success.',
    },
    {
      name: 'data.now',
      type: 'number (epoch ms)',
      description:
        'Clock for the relative times. Without it the card reads Date.now() and refreshes the times every 30 s in place.',
    },
    {
      name: 'data.maxLength',
      type: 'number',
      description: 'Longest objective the add box takes; shows a “120 / 4000” counter.',
    },
    {
      name: 'draft',
      type: 'string (property)',
      description: 'The add box’s text. Set it to clear the box after a prevented `ui-add` went through.',
    },
    {
      name: 'slot "add"',
      type: 'element',
      description:
        'A host element with `slot="add"` takes the add box’s place (the built-in box is the fallback) — e.g. a `<ui-composer collapse>`: one line until it gets focus, then the whole composer with files, images, voice and the host’s tools. The host turns its send into its own add; `draft`, `busy: "add"` and `ui-add` are the built-in box’s.',
    },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'UI language (attribute).' },
    {
      name: 'variant',
      type: "'card'",
      description:
        'Attribute: draws the 12px card (border, surface, shadow). Default: no chrome — the host’s section is the surface.',
    },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the theme (attribute). Default follows prefers-color-scheme or page tokens.',
    },
  ],
  events: [
    {
      name: 'ui-complete',
      detail: '{ id: string }',
      description: 'Second press of Complete within 4 s. Set `busy: "complete"`, then move the goal to history.',
    },
    {
      name: 'ui-pause',
      detail: '{ id: string }',
      description: 'Pause pressed (one press — it can be undone with Resume).',
    },
    { name: 'ui-resume', detail: '{ id: string }', description: 'Resume pressed on a paused goal.' },
    {
      name: 'ui-delete',
      detail: '{ id: string; queued: boolean }',
      description:
        'Second press of Delete (current goal, `queued: false`) or of a queued goal’s remove (`queued: true`) within 4 s.',
    },
    {
      name: 'ui-move',
      detail: '{ id: string; from: number; to: number; order: string[] }',
      description:
        'A queued goal dropped in a new place (drag its handle) or moved one step (↑ ↓ on the handle). `from` / `to` are 0-based; `order` is the queue’s ids in the new order. Unless prevented, the card shows that order until the next data.',
    },
    {
      name: 'ui-edit',
      detail: '{ id: string; objective: string }',
      description:
        'A queued goal’s editor saved with a changed, non-empty (trimmed) text. Not prevented: the editor closes and the row shows the text until the next data. Prevented: the editor stays (Save spins while `busy` is `edit`) and closes once the data carries the new text — a refusal leaves the text to fix.',
    },
    {
      name: 'ui-add',
      detail: '{ objective: string }',
      description:
        'Enter or Add with a non-empty (trimmed) objective. The box clears unless a listener calls preventDefault() — then the text stays (set `draft = ""` once the write succeeded).',
    },
  ],
  keyboard: [
    ['Tab', 'More / Less, the actions, each queued goal’s remove, the add box, Add, Past goals'],
    ['Enter / Space on Complete, Delete, remove', 'First press arms (“Delete?”), a second within 4 s confirms'],
    ['Esc', 'Disarm an armed action'],
    ['Tab away (focus leaves the armed button)', 'Disarm'],
    ['Enter in the add box', 'Add the goal (never while an IME is composing)'],
    ['Shift+Enter in the add box', 'New line'],
    ['Enter / Space on Past goals', 'Show or hide the goals that ended'],
    ['↑ / ↓ on a queued goal’s handle', 'Move it one place up or down (focus stays on its handle)'],
    ['Enter / Space on Edit', 'Open the queued goal’s text in place, focused'],
    ['Enter in the editor', 'Save (never while an IME is composing); Shift+Enter is a new line'],
    ['Esc in the editor', 'Cancel — the text is as it was, focus is back on Edit'],
  ],
  a11y: [
    'role="group" labelled by the title. Status is icon + word, never colour alone.',
    'The progress bar is role="progressbar" with aria-valuenow and a spoken “3 of 5 done, 60%”.',
    'More / Less is a real button with aria-expanded + aria-controls on the objective; the objective stays plain, selectable text. The toggle exists only when the fold cuts the text (measured after render and on resize).',
    'Arming announces the consequence once through a polite live region (“Press again to delete the goal — the next one starts”); a held Enter never confirms (key repeat is ignored) and a double click counts as one press.',
    'Busy actions use aria-disabled + aria-busy instead of disabled, so the focused button keeps focus. When the focused control’s goal leaves (deleted, finished), focus moves to the card, not to another goal’s button.',
    'Errors use role="alert". Past goals is a disclosure (aria-expanded) whose region is inert while closed.',
    'Each queued goal’s handle is a button named “Move queued goal 2”, described by “Drag, or press ↑ ↓ to move it”; a move is announced (“Moved to 1 of 3”) and focus stays on the moved goal’s handle. A drag works with a mouse, a pen or a finger (pointer events, touch-action: none on the handle). Edit opens a labelled text box in place; Esc stays in the card.',
    'Reduced motion: the chevrons and progress fill jump, the history region only fades, the spinner holds still.',
    'Sound (opt-in, @2lab.ai/ui/sound): Add taps; Pause and Resume play toggle (back, forward); the first press of Complete, Delete or Remove plays a subtle tap, the confirming press a tap for Complete and a strong close for a delete — each once its event is not prevented; keystrokes in the add box play type while typing sounds are on. Silent until the page turns sound on.',
  ],
  usage: `<ui-goal-card></ui-goal-card>
<script type="module">
  import '@2lab.ai/ui/goal-card';
  const el = document.querySelector('ui-goal-card');
  el.data = {
    current: { id: 'g1', objective: 'Ship the v2 migration guide', status: 'active',
               progress: { done: 2, total: 5 }, startedAt: Date.now() - 3_600_000 },
    queue: [{ id: 'g2', objective: 'Audit colour contrast' }],
  };
  el.addEventListener('ui-add', async (e) => {
    el.data = { ...el.data, busy: 'add', error: undefined };
    const res = await fetch('/goals', { method: 'POST', body: JSON.stringify(e.detail) });
    el.data = { ...el.data, busy: null, error: res.ok ? undefined : 'Could not add the goal.' };
  });
  el.addEventListener('ui-delete', (e) => { /* e.detail.id, e.detail.queued */ });
</script>`,
  demos: [
    {
      id: 'active',
      title: 'Active goal, a queue and past goals',
      description:
        'A long objective folds to three lines (More / Less). Try Pause, Complete (press twice), remove a queued goal, add one with Enter, open Past goals. The stand-in host answers after 700 ms.',
      height: 560,
      create: () => make(activeData()),
    },
    {
      id: 'composer-queue',
      title: 'A composer as the add box; reorder and edit the queue',
      description:
        'slot="add" holds a <ui-composer collapse>: one line until you click it, then the whole composer (attach, image, voice). Drag a queued goal by its handle (or focus it and press ↑ ↓), and press Edit to change its text in place — Enter saves, Esc cancels.',
      height: 620,
      create: () => {
        const d = activeData();
        d.queue = [
          { id: 'g-docs', objective: 'Write the v2 migration guide — one example per endpoint.' },
          { id: 'g-contrast', objective: 'Audit colour contrast in the settings screens (light and dark).' },
          { id: 'g-notes', objective: 'Draft the release notes for support.' },
        ];
        return withComposer(make(d));
      },
    },
    {
      id: 'paused-error',
      title: 'Paused, with an error',
      description: 'A paused goal (muted fill, Resume), a 0..1 progress, and the last refused action as an alert.',
      height: 440,
      create: () => {
        const now = Date.now();
        return make({
          current: {
            id: 'g-search',
            objective: 'Cut cold-start time of the search API below 300 ms without raising the memory limit.',
            status: 'paused',
            progress: 0.4,
            startedAt: now - 5 * HOUR,
            updatedAt: now - 25 * MIN,
          },
          queue: [{ id: 'g-alerts', objective: 'Add latency alerts for the search API.' }],
          error: 'Could not resume the goal: the session has ended. Start a new session to continue.',
        });
      },
    },
    {
      id: 'busy',
      title: 'A write in flight',
      description:
        'busy: "delete" with busyId on the second queued goal — its remove spins and every other action waits; the add box stays editable.',
      height: 400,
      create: () => {
        const d = activeData();
        return make({ ...d, history: [], busy: 'delete', busyId: 'g-contrast' }, {}, false);
      },
    },
    {
      id: 'host-actions',
      title: 'Only what the host answers, with budget meta and notes',
      description:
        'actions: ["delete"] — the host’s goal route takes add and delete, so Complete and Pause are not drawn (nothing is dead). The current goal carries a continue budget (meta) and the evaluator’s note of what is left; each past goal its own quiet line and reason.',
      height: 600,
      create: () => {
        const d = activeData();
        const now = Date.now();
        return make({
          ...d,
          actions: ['delete'],
          current: {
            ...d.current!,
            meta: [{ label: 'Continues', value: '3/10' }, '$0.42'],
            note: 'Left: the rollback runbook for step 4 and the cut-over checklist in the wiki.',
          },
          history: [
            {
              id: 'g-flaky',
              objective: 'Find and fix the flaky checkout test on CI.',
              status: 'complete',
              endedAt: now - 3 * HOUR,
              meta: [
                '2h 10m active',
                '48.2K tokens',
                '$0.31',
                { label: 'Continued', value: '2×' },
                'closed by the evaluator',
              ],
              note: 'The retry loop in checkout.spec.ts masked a race; the fix landed with a regression test.',
            },
            {
              id: 'g-cache',
              objective: 'Cut cold-start time of the search API below 300 ms.',
              status: 'failed',
              endedAt: now - DAY - 2 * HOUR,
              meta: ['6h 02m active', '$1.90', { label: 'Continued', value: '10/10' }],
              note: 'Budget spent at 410 ms: the index warm-up alone takes 350 ms on the small instance.',
            },
          ],
        });
      },
    },
    {
      id: 'empty-readonly',
      title: 'Empty, and read-only',
      description:
        'No goal yet: a calm line and the add box (starts now). Below, canEdit: false — the same goal for a viewer: no actions, no add box; the fold and the history still open.',
      height: 520,
      create: () => stack(make({ maxLength: 4000 }), make({ ...activeData(), canEdit: false }, {}, false)),
    },
    {
      id: 'korean',
      title: 'Korean, as a card',
      description: 'lang="ko" and variant="card" on the canvas.',
      height: 520,
      frame: false,
      create: () => {
        const now = Date.now();
        return make(
          {
            current: {
              id: 'k-1',
              objective:
                '결제 서비스를 새 결제 API로 옮기기. 모든 고객이 옮겨 갈 때까지 기존 웹훅은 계속 응답하게 두고, 단계마다 되돌리는 절차를 문서로 남긴다.\n각 단계는 스테이징에서 통합 테스트를 통과한 뒤에만 배포한다. 전환 체크리스트는 저장소 위키에 정리하고 릴리스 노트에서 연결한다.',
              status: 'active',
              progress: { done: 1, total: 4 },
              startedAt: now - 47 * MIN,
              updatedAt: now - 3 * MIN,
              meta: [{ label: '이어하기', value: '3/10' }],
              note: '남은 것: 4단계의 되돌리기 절차와 위키의 전환 체크리스트.',
            },
            queue: [
              { id: 'k-2', objective: 'v2 마이그레이션 가이드 작성 — 엔드포인트마다 예시 하나씩.' },
              { id: 'k-3', objective: '설정 화면 색 대비 점검 (라이트·다크 모두).' },
            ],
            history: [
              {
                id: 'k-0',
                objective: 'CI에서 가끔 실패하는 결제 테스트 원인 찾아 고치기.',
                status: 'complete',
                endedAt: now - 2 * HOUR,
                meta: ['소요 2시간 10분', '48.2K 토큰', '$0.31', { label: '이어하기', value: '2회' }, '평가 모델 완료'],
                note: 'checkout.spec.ts의 재시도 루프가 경쟁 상태를 가리고 있었음. 회귀 테스트와 함께 수정.',
              },
            ],
          },
          { lang: 'ko', variant: 'card' },
        );
      },
    },
  ],
};
