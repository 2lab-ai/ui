import type { ComponentDoc } from '../../docs/types';
import './step-track';
import type { StepTrackData, StepTrackSelect, UiStepTrack } from './step-track';

function track(data: StepTrackData, attrs: Record<string, string> = {}): UiStepTrack {
  const el = document.createElement('ui-step-track');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

/** A light-DOM line with a quiet word before the track: what it is the progress of. */
function line(word: string, el: HTMLElement): HTMLElement {
  const p = document.createElement('div');
  p.style.cssText =
    'display:flex;flex-wrap:wrap;align-items:flex-start;gap:6px 14px;margin:0;font-size:13px;line-height:1.5;color:var(--ui-ib-text-2)';
  const w = document.createElement('span');
  w.style.cssText = 'min-width:min(160px,40%);color:var(--ui-ib-muted)';
  w.textContent = word;
  p.append(w, el);
  return p;
}

function col(...kids: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:18px;padding:18px 20px';
  box.append(...kids);
  return box;
}

const step = (label: string, status?: StepTrackData['steps'][number]['status']) => ({
  id: label.toLowerCase().replace(/\s+/g, '-'),
  label,
  status,
});

/** The z phases of a session, as its card shows them. No statuses: before the current step reads done. */
const Z = ['Intake', 'Plan', 'Build', 'Review', 'Approve', 'Deploy'].map((l) => step(l));

/** The z pipeline running: the fill moves, the step advances every few seconds (the wake), then it starts over. */
function pipeline(): HTMLElement {
  let current = 2;
  let progress = 0.35;
  let hold = 0;
  const el = track({ label: 'z phases', steps: Z, current, progress });
  let seen = false;
  const timer = window.setInterval(() => {
    if (!el.isConnected) {
      if (seen) window.clearInterval(timer);
      return;
    }
    seen = true;
    if (current >= Z.length) {
      // Done · 6 of 6 for a moment, then the next session picks up at Build.
      if (++hold < 14) return;
      hold = 0;
      current = 2;
      progress = 0;
    } else if (progress >= 1) {
      current++;
      progress = 0;
    } else progress = Math.min(1, progress + 0.06);
    el.data = { ...el.data, steps: Z, current, progress: current < Z.length ? progress : null };
  }, 160);
  return col(line('fix-login-redirect', el));
}

const DEPLOY = ['Build', 'Test', 'Deploy dev', 'QA dev', 'Deploy prod'];

/** The goal loop's iterations: the third one broke the tests, the fifth is running for as long as it takes. */
const LOOP: StepTrackData = {
  label: 'Goal iterations',
  steps: [
    step('Iteration 1', 'done'),
    step('Iteration 2', 'done'),
    step('Iteration 3', 'failed'),
    step('Iteration 4', 'done'),
    step('Iteration 5', 'current'),
    step('Iteration 6', 'todo'),
    step('Iteration 7', 'todo'),
    step('Iteration 8', 'todo'),
  ],
  progress: null,
};

export const doc: ComponentDoc = {
  slug: 'step-track',
  name: 'Step Track',
  tag: 'ui-step-track',
  group: 'Primitives',
  summary:
    'Where a pipeline is and how far into the current step — one dot per step, the current one a wide pill that fills.',
  description:
    'A row of dots, one per step, 6px apart: done in ink, to do faint, failed red, skipped a hollow ring. The current step is the dot whose slot is wide (36px; 28px at size sm), and its fill is the progress — or, when the host does not know how far it is, a soft band sweeping across it. Under it a caption says the place: “Review · 3 of 5”, “Done · 5 of 5”, “Failed at QA dev”. When the current step changes, the two slot widths change and every edge eases to its new place on 520ms; the dots the bar crossed stand up and settle in the order it crossed them, and the landing pill answers last with a small squash (the wake — not on the first render, not under reduced motion). Data in: the host owns the steps, the current index and the progress. With interactive the dots are buttons on a roving tabindex that send a cancelable ui-select; nothing moves here — the host decides what a pick opens.',
  usedIn:
    'soma-work dashboard: a session’s z phases (plan → build → review → approve → deploy) on its card, a deploy’s stages (dev → QA → prod), the goal loop’s iterations — where it is, and how far into the current one.',
  reference: { name: 'bencho.dev — Step player (MIT)', url: 'https://bencho.dev/blocks/step-player' },
  props: [
    {
      name: 'data.steps',
      type: "Array<{ id?: string; label: string; status?: 'done' | 'current' | 'todo' | 'failed' | 'skipped' }>",
      required: true,
      description:
        'The steps, in order. A step without a status is done before the current step and to do after it. id keeps the step’s node across renders and comes back in ui-select. Nothing renders without steps.',
    },
    {
      name: 'data.current',
      type: 'number',
      description:
        'Index of the step under way. Default: the first step marked current, else the first not done or skipped (a failed one counts — a failed current); all done → none. A number outside the steps is none; steps.length means all done.',
    },
    {
      name: 'data.progress',
      type: 'number | null',
      description:
        'How far into the current step, 0 … 1 (clamped). null or missing: under way, amount unknown — a band sweeps the pill.',
    },
    {
      name: 'data.label',
      type: 'string',
      default: '“Steps” / “단계”',
      description: 'The accessible name of the whole track (“Pipeline”, “Deploy”).',
    },
    {
      name: 'data.caption',
      type: 'boolean',
      default: 'true',
      description: 'The line under the dots. false when the card already says the phase.',
    },
    {
      name: 'size',
      type: '"sm" | "md"',
      default: '"md"',
      description: 'Attribute. md: 8px dots, the current slot 36px. sm: 6px dots, 28px.',
    },
    {
      name: 'interactive',
      type: 'boolean attribute',
      description: 'The dots become buttons (title = the label) that send ui-select.',
    },
    { name: 'lang', type: '"en" | "ko"', default: '"en"', description: 'The status words and the caption.' },
    { name: 'current', type: 'number (read-only)', description: 'The index of the step under way now; -1 for none.' },
    {
      name: 'stepCurrent / stepStates / stepCaption / stepWake / stepProgress',
      type: 'helpers',
      description:
        'Pure: the current index (or -1), what each dot draws, the caption (steps, current, lang), the dots a move crosses ({ index, order }[]), progress clamped to 0 … 1 or null.',
    },
  ],
  events: [
    {
      name: 'ui-select',
      detail: '{ index: number; id: string | undefined }',
      description:
        'Interactive only: the person picked a dot (click, Enter or Space). Cancelable; nothing changes here either way — the host opens that step or moves on.',
    },
  ],
  keyboard: [
    ['← / →', 'Interactive: the previous / next dot (wraps)'],
    ['Home / End', 'The first / last dot'],
    ['Enter / Space', 'Pick the focused dot (ui-select)'],
  ],
  a11y: [
    'An <ol> named by label; each step carries a visually hidden “<label>, <status>” (“Build, Current”, “구현, 진행 중”) and the current one aria-current="step". Colour is never the only signal.',
    'The current pill’s fill is role="progressbar" named by the step, with aria-valuenow 0 … 100; unknown progress is aria-busy="true" with no value.',
    'Interactive: one tab stop (the current dot), the arrows rove, Home / End jump; each button’s title is its label. The focus ring sits on the dot; on a coarse pointer each dot gets a 44px target (they spread out, the dot stays small).',
    'Motion: the slot widths ease on 520ms and the wake bumps once. Under reduced motion there is no wake, the widths jump and the sweeping band stands still as a faint tint over the whole pill (never a fill that reads as an amount).',
    'Sound (opt-in, @2lab.ai/ui/sound): a subtle select when a picked dot’s ui-select is not prevented. Progress the host sets never sounds. Silent until the page turns sound on.',
  ],
  usage: `<ui-step-track></ui-step-track>
<script type="module">
  import '@2lab.ai/ui/step-track';
  const t = document.querySelector('ui-step-track');
  t.data = {
    label: 'z phases',
    steps: [{ label: 'Plan' }, { label: 'Build' }, { label: 'Review' }, { label: 'Approve' }, { label: 'Deploy' }],
    current: 1,
    progress: 0.4,          // null: under way, amount unknown
  };
  t.data = { ...t.data, current: 2, progress: 0 };   // the slots ease over, the wake runs
</script>
<ui-step-track interactive size="sm"></ui-step-track>   <!-- dots send ui-select { index, id } -->`,
  demos: [
    {
      id: 'pipeline',
      title: 'A session’s z phases',
      description:
        'Intake → Deploy with Build under way. The fill moves; every few seconds the step advances — the slots ease over and the wake runs — until Done · 6 of 6, then the next session starts at Build.',
      height: 160,
      create: pipeline,
    },
    {
      id: 'deploy',
      title: 'A deploy’s stages',
      description:
        'A release whose QA on dev failed (a failed current: “Failed at QA dev”), a hotfix that skipped dev (hollow rings) and is 64% into prod, and a release that went all the way.',
      height: 260,
      create: () =>
        col(
          line(
            'v2.14.0',
            track({
              label: 'Deploy v2.14.0',
              steps: [
                step('Build', 'done'),
                step('Test', 'done'),
                step('Deploy dev', 'done'),
                step('QA dev', 'failed'),
                step('Deploy prod', 'todo'),
              ],
            }),
          ),
          line(
            'hotfix 2.13.2',
            track({
              label: 'Deploy hotfix 2.13.2',
              steps: [
                step('Build', 'done'),
                step('Test', 'done'),
                step('Deploy dev', 'skipped'),
                step('QA dev', 'skipped'),
                step('Deploy prod', 'current'),
              ],
              progress: 0.64,
            }),
          ),
          line('v2.13.0', track({ label: 'Deploy v2.13.0', steps: DEPLOY.map((l) => step(l, 'done')) })),
        ),
    },
    {
      id: 'goal-loop',
      title: 'The goal loop’s iterations',
      description:
        'size="sm", interactive. Iteration 5 runs with no known end (the band sweeps); iteration 3 failed. Pick a dot — with the mouse, or Tab in and use the arrows and Enter — and the host’s line logs the ui-select.',
      height: 200,
      create: () => {
        const el = track(LOOP, { size: 'sm', interactive: '' });
        const said = document.createElement('p');
        said.className = 'ui-status-line';
        said.setAttribute('role', 'status');
        said.textContent = 'Pick an iteration.';
        el.addEventListener('ui-select', (e) => {
          const { index, id } = (e as CustomEvent<StepTrackSelect>).detail;
          said.textContent = `ui-select → ${LOOP.steps[index]?.label ?? ''} (index ${index}, id ${id ?? '—'})`;
        });
        return col(line('p95 latency under 200 ms', el), said);
      },
    },
    {
      id: 'ko',
      title: 'Korean',
      description:
        'lang="ko": the status words and the caption — “리뷰 · 6단계 중 4”, “dev QA에서 실패”, “완료 · 5단계 중 5”.',
      height: 260,
      create: () =>
        col(
          line(
            '세션 단계',
            track(
              {
                label: 'z 단계',
                steps: ['접수', '계획', '구현', '리뷰', '승인', '배포'].map((l) => ({ label: l })),
                current: 3,
                progress: 0.6,
              },
              { lang: 'ko' },
            ),
          ),
          line(
            '배포 v2.14.0',
            track(
              {
                label: '배포 v2.14.0',
                steps: [
                  { label: '빌드', status: 'done' },
                  { label: '테스트', status: 'done' },
                  { label: 'dev 배포', status: 'done' },
                  { label: 'dev QA', status: 'failed' },
                  { label: 'prod 배포', status: 'todo' },
                ],
              },
              { lang: 'ko' },
            ),
          ),
          line(
            '배포 v2.13.0',
            track(
              {
                label: '배포 v2.13.0',
                steps: ['빌드', '테스트', 'dev 배포', 'dev QA', 'prod 배포'].map((l) => ({
                  label: l,
                  status: 'done' as const,
                })),
              },
              { lang: 'ko' },
            ),
          ),
        ),
    },
  ],
};
