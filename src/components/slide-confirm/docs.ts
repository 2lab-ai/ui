import type { ComponentDoc } from '../../docs/types';
import './slide-confirm';
import type { SlideConfirmData, UiSlideConfirm } from './slide-confirm';

function slide(data: SlideConfirmData, attrs: Record<string, string> = {}): UiSlideConfirm {
  const el = document.createElement('ui-slide-confirm');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

function col(...kids: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:12px;padding:18px 20px';
  box.append(...kids);
  return box;
}

/** A quiet line of context above the slider: what it acts on. */
function context(text: string): HTMLElement {
  const p = document.createElement('p');
  p.style.cssText = 'margin:0;font-size:13px;line-height:1.5;color:var(--ui-ib-text-2)';
  p.textContent = text;
  return p;
}

/** The host's status line under the slider. */
function said(text: string): HTMLElement {
  const p = document.createElement('p');
  p.className = 'ui-status-line';
  p.style.margin = '0';
  p.textContent = text;
  return p;
}

function button(text: string, run: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ui-btn is-sm';
  b.style.alignSelf = 'flex-start';
  b.textContent = text;
  b.addEventListener('click', run);
  return b;
}

const clock = () => new Date().toTimeString().slice(0, 8);

export const doc: ComponentDoc = {
  slug: 'slide-confirm',
  name: 'Slide to Confirm',
  tag: 'ui-slide-confirm',
  group: 'Primitives',
  summary: 'Whether to go ahead with something that cannot be taken back — decided by a deliberate slide, not a slip.',
  description:
    'A track with a grip. Drag the grip across: it follows the finger exactly, and the offset is taken at the first move, never at the press — so a press away from the grip does nothing until it moves, and the grip never jumps. The words in the track fade over the first 55% of the way, an ink wash fills in behind the grip, and the arrow fades out near the end. Let go past the mark (85% by default) and the grip takes over to the end on a critically damped spring and sends a cancelable ui-confirm. If it goes through, the grip opens out behind itself to fill the track — its width and its place move together, so its right edge stays put and the corner radius stays round — and shows the done words; the track squashes a little. The host then owns the outcome: state busy (a spinner and its words), done, or failed (a short shake, a fail tint, and the grip goes home with the failed words). Let go short of the mark, press Escape, or prevent ui-confirm, and it springs home with a small overshoot spent as a squash against the start.',
  usedIn:
    'soma-work dashboard: the actions that cannot be taken back — deploy to prod, Stop a running session, delete a session or a memory page, approve a high-risk devops-broker request.',
  reference: { name: 'bencho.dev — Slide to confirm (MIT)', url: 'https://bencho.dev/blocks/slide-confirm' },
  props: [
    {
      name: 'data.label / label',
      type: 'string',
      default: '"Slide to confirm"',
      description: 'What sliding does (“Slide to deploy to prod”). Shown in the track and the slider’s name.',
    },
    {
      name: 'data.doneLabel / done-label',
      type: 'string',
      default: '"Confirmed"',
      description: 'The words in the filled grip once it went through (“Deployed”).',
    },
    {
      name: 'data.busyLabel',
      type: 'string',
      default: '"Working…"',
      description: 'The words beside the spinner while state is busy (“Deploying v0.28.0…”).',
    },
    {
      name: 'data.state',
      type: "'idle' | 'busy' | 'done' | 'failed'",
      description:
        'The host’s word on the action, heard when you set data: a new value counts, and after a commit any value counts (it is the answer to that commit). busy and done fill the grip; idle closes it; failed shakes, tints and goes home, then the slider is idle with the failed words in the track until the next try. Leave it out and the slider keeps what it shows.',
    },
    {
      name: 'data.tone / tone',
      type: "'neutral' | 'danger'",
      default: "'neutral'",
      description: 'danger: the grip and its wash in the fail colour mixed toward ink, for actions that destroy.',
    },
    {
      name: 'data.disabled / disabled',
      type: 'boolean',
      description:
        'No pointer, no keys; the grip shows a lock. Say why in the label (“Deploys are frozen until 18:00”).',
    },
    {
      name: 'data.threshold / threshold',
      type: 'number',
      default: '0.85',
      description: 'The share of the travel past which a release takes over to the end. Clamped to 0.5 … 1.',
    },
    { name: 'lang', type: '"en" | "ko"', default: '"en"', description: 'The built-in words in Korean.' },
    {
      name: '--slide-w',
      type: 'CSS property on the element',
      default: '320px',
      description: 'Its widest; it fills its container up to this, and never goes under 220px.',
    },
    {
      name: 'state',
      type: 'SlideState (read-only)',
      description: 'What it shows now: idle, busy, done — or failed while it shakes.',
    },
    { name: 'reset()', type: 'method', description: 'Back to the start, idle, whatever state said last.' },
    {
      name: 'slideThreshold / slideProgress / slideCommits / slideKeyStep',
      type: 'helpers',
      description:
        'Pure: the threshold clamped, a distance as a share of the travel, whether a release goes through, the value a key moves it to.',
    },
  ],
  events: [
    {
      name: 'ui-confirm',
      detail: '{}',
      description:
        'The person slid past the mark and let go (or pressed End), and the grip reached the end. Cancelable: preventDefault() springs it home and it stays idle. Not prevented, it shows done; set state busy while you work, then done or failed.',
    },
  ],
  keyboard: [
    ['Tab', 'Focus the grip'],
    ['→ / ↑', 'Ten percent further'],
    ['← / ↓', 'Ten percent back'],
    ['Page Up / Page Down', 'Twenty-five percent further / back'],
    ['Home', 'Back to the start'],
    ['End', 'To the end: confirms (ui-confirm), as a release past the mark does'],
    ['Esc', 'Back to the start — also stops a take-over that has not asked yet'],
    ['Tab away', 'A grip left part of the way springs home'],
  ],
  a11y: [
    'The grip is role="slider" named by the label, aria-valuemin 0, aria-valuemax 100, aria-valuenow the percent of the travel and aria-valuetext “<label>: 40%”. The words in the track are a picture of the name (aria-hidden).',
    'Busy and done: aria-disabled="true", and the value text is the busy or done words. Disabled: aria-disabled="true" and still focusable, so the reason in its label can be found.',
    'A visually hidden role="status" says the done words when it is done and the failed words when it fails. The tint is never the only sign of a failure: the words stay in the track until the next try.',
    'The track is 56px tall and the grip 48px: both past 44px for a finger. touch-action: none on the track, so a slide never scrolls the page.',
    'Reduced motion: no springs, squash, scale or shake — the grip still follows the pointer, and a release jumps.',
    'Sound (opt-in, @2lab.ai/ui/sound): the person’s commit plays success (normal emphasis) once ui-confirm is not prevented. Nothing on grab, release or home, and nothing for a busy, done or failed the host sets.',
  ],
  usage: `<ui-slide-confirm label="Slide to deploy to prod" done-label="Deployed" tone="danger"></ui-slide-confirm>
<script type="module">
  import '@2lab.ai/ui/slide-confirm';
  const el = document.querySelector('ui-slide-confirm');
  el.addEventListener('ui-confirm', async () => {
    el.data = { ...el.data, state: 'busy', busyLabel: 'Deploying v0.28.0…' };
    const ok = await deploy();                                  // your call
    el.data = { ...el.data, state: ok ? 'done' : 'failed' };   // failed: a shake, then home to try again
  });
</script>`,
  demos: [
    {
      id: 'deploy',
      title: 'Slide to deploy to prod',
      description:
        'tone danger. The host answers ui-confirm with busy, and done 1.2 s later; Reset calls reset(). Let go before the mark and it springs home.',
      height: 240,
      create: () => {
        const el = slide({
          label: 'Slide to deploy to prod',
          doneLabel: 'Deployed to prod',
          busyLabel: 'Deploying v0.28.0…',
          tone: 'danger',
        });
        const line = said('main @ 4f2c9e1 is green — 212 checks passed.');
        let timer: ReturnType<typeof setTimeout> | undefined;
        el.addEventListener('ui-confirm', () => {
          el.data = { ...el.data, state: 'busy' };
          line.textContent = `${clock()} ui-confirm → deploying v0.28.0`;
          timer = setTimeout(() => {
            el.data = { ...el.data, state: 'done' };
            line.textContent = `${clock()} v0.28.0 is live on prod (ap-northeast-2)`;
          }, 1200);
        });
        const reset = button('Reset', () => {
          clearTimeout(timer);
          el.reset();
          line.textContent = 'main @ 4f2c9e1 is green — 212 checks passed.';
        });
        return col(context('2lab-ai/soma-work · main @ 4f2c9e1 → prod'), el, line, reset);
      },
    },
    {
      id: 'stop',
      title: 'Slide to stop the session',
      description:
        'Neutral. The line logs every ui-confirm. The host says done, and idle 2.4 s later: the grip closes back home. Tick “hold” and the host prevents it: the grip springs home and nothing stops.',
      height: 260,
      create: () => {
        const el = slide({ label: 'Slide to stop the session', doneLabel: 'Session stopped' });
        const log = said('No ui-confirm yet.');
        const hold = document.createElement('label');
        hold.className = 'ui-switch';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.setAttribute('role', 'switch');
        const word = document.createElement('span');
        word.textContent = 'Hold — a tool call is writing a file (preventDefault)';
        hold.append(box, word);
        el.addEventListener('ui-confirm', (e) => {
          if (box.checked) {
            e.preventDefault();
            log.textContent = `${clock()} ui-confirm {} · prevented — the tool call finishes first`;
            return;
          }
          log.textContent = `${clock()} ui-confirm {} · stop sent to “Fix flaky upload e2e”`;
          el.data = { ...el.data, state: 'done' };
          setTimeout(() => {
            el.data = { ...el.data, state: 'idle' };
          }, 2400);
        });
        return col(context('“Fix flaky upload e2e” · running 14m · tool call 9 of ~20'), el, log, hold);
      },
    },
    {
      id: 'ko',
      title: '한국어 — 실패 후 다시',
      description:
        'lang="ko", tone danger. The first try fails (the session is still writing): a shake, the fail tint, and home with 실패 — 다시 시도. The second goes through.',
      height: 240,
      create: () => {
        const el = slide(
          { label: '밀어서 세션 삭제', doneLabel: '세션 삭제됨', busyLabel: '삭제 중…', tone: 'danger' },
          { lang: 'ko' },
        );
        const line = said('세션 “업로드 e2e 수정” · 대화 48개 · 아티팩트 3개');
        let tries = 0;
        el.addEventListener('ui-confirm', () => {
          tries++;
          el.data = { ...el.data, state: 'busy' };
          line.textContent = `${clock()} 삭제 요청 (${tries}번째)`;
          setTimeout(() => {
            const ok = tries > 1;
            el.data = { ...el.data, state: ok ? 'done' : 'failed' };
            line.textContent = ok
              ? `${clock()} 세션을 삭제했습니다.`
              : `${clock()} 실패: 세션이 아직 파일을 쓰는 중입니다.`;
          }, 900);
        });
        const again = button('처음부터', () => {
          tries = 0;
          el.reset();
          line.textContent = '세션 “업로드 e2e 수정” · 대화 48개 · 아티팩트 3개';
        });
        return col(el, line, again);
      },
    },
    {
      id: 'disabled',
      title: 'Disabled',
      description: 'A release freeze: no pointer, no keys, a lock on the grip — and the reason is the label.',
      height: 180,
      create: () =>
        col(
          context('Release freeze · set by @zhuge · ends 18:00 KST'),
          slide({ label: 'Deploys are frozen until 18:00', tone: 'danger', disabled: true }),
        ),
    },
  ],
};
