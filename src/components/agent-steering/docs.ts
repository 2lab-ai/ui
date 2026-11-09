import type { ComponentDoc } from '../../docs/types';
import '../composer/composer';
import './agent-steering';
import type {
  AgentSteeringData,
  SteeringEditDetail,
  SteeringItem,
  SteeringItemDetail,
  SteeringSubmitDetail,
} from './logic';

type El = HTMLElementTagNameMap['ui-agent-steering'];

const MIN = 60_000;
const now = () => Date.now();

function steering(data: AgentSteeringData, attrs: Record<string, string> = {}): El {
  const el = document.createElement('ui-agent-steering');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

function stage(...els: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  // The dock floats above the element's top right: room for it over the first one.
  box.style.cssText = 'display:grid;gap:56px;max-width:520px;margin:0 auto;padding-top:48px';
  box.append(...els);
  return box;
}

interface HostOpts {
  /** Refuse the first Send now (another dispatch is in flight). */
  refuseOnce?: boolean;
  /** Refuse every edit (the note was handed over meanwhile). */
  refuseEdit?: boolean;
  /** The first message fails to reach the session; Retry works. */
  failFirst?: boolean;
  /** Refuse the first Cancel of a delivered note (the agent read it first). */
  lateCancel?: boolean;
  ko?: boolean;
}

/**
 * Plays the host: the dashboard over soma-work's FollowupQueue. A note sent while the agent runs shows up in the
 * list half a second later (queued, or steered for ⌘↵); Send now stops the current step and runs the note (it leaves);
 * a steered note the agent has not read yet can still be cancelled; Edit and Cancel are confirmed by the next list.
 */
function host(el: El, opts: HostOpts = {}): El {
  let seq = 40;
  let refused = false;
  let failed = false;
  let late = false;
  const later = (ms: number, fn: () => void) => window.setTimeout(() => el.isConnected && fn(), ms);
  const patch = (fn: (items: SteeringItem[]) => SteeringItem[]) => {
    if (!el.data) return;
    el.data = { ...el.data, items: fn([...(el.data.items ?? [])]) };
  };
  const without = (id: string) => patch((items) => items.filter((i) => i.id !== id));
  el.addEventListener('ui-submit', (e) => {
    const { text, mode, ref, files } = (e as CustomEvent<SteeringSubmitDetail>).detail;
    const names = files?.map((f) => f.name) ?? [];
    if (opts.failFirst && !failed) {
      failed = true;
      later(700, () =>
        el.setItemState(
          ref,
          'failed',
          opts.ko ? 'HTTP 502 — 세션에 닿지 못했습니다' : 'HTTP 502 — the session could not be reached',
        ),
      );
      return;
    }
    if (!el.data?.running) return; // Idle: the message starts a turn; the transcript shows it, not the queue.
    const id = `C0AKY7W2UGZ:1793008217#${++seq}`;
    later(500, () => {
      patch((items) => [
        ...items,
        {
          id,
          text,
          at: now(),
          state: mode === 'steer' ? 'steered' : 'queued',
          ...(names.length ? { files: names } : {}),
        },
      ]);
      if (mode === 'steer') later(2800, () => without(id));
    });
  });
  el.addEventListener('ui-promote', (e) => {
    const { id } = (e as CustomEvent<SteeringItemDetail>).detail;
    if (opts.refuseOnce && !refused) {
      refused = true;
      // Rolled back to the state the note had (a delivered one stays delivered).
      const was = el.data?.items?.find((i) => i.id === id)?.state ?? 'queued';
      later(700, () =>
        el.setItemState(
          id,
          was,
          opts.ko
            ? '다른 메시지를 보내는 중입니다 — 잠시 후 다시'
            : 'Another message is being sent — try again in a moment',
        ),
      );
      return;
    }
    // Running or idle, the note runs now: running, the host stops the current step for it first.
    later(el.data?.running ? 600 : 700, () => without(id));
  });
  el.addEventListener('ui-edit', (e) => {
    const { id, text } = (e as CustomEvent<SteeringEditDetail>).detail;
    if (opts.refuseEdit) {
      later(700, () =>
        el.setItemState(
          id,
          'queued',
          opts.ko ? '이미 에이전트에 전달되어 수정할 수 없습니다' : 'Already handed to the agent — it can’t be edited',
        ),
      );
      return;
    }
    later(600, () =>
      patch((items) => items.map((i) => (i.id === id ? { ...i, text, reason: opts.ko ? '편집됨' : 'edited' } : i))),
    );
  });
  el.addEventListener('ui-cancel', (e) => {
    const { id } = (e as CustomEvent<SteeringItemDetail>).detail;
    const note = el.data?.items?.find((i) => i.id === id);
    if (opts.lateCancel && !late && note?.state === 'steered') {
      // Too late: the agent read it first — the note comes back with why, then leaves as read.
      late = true;
      later(500, () =>
        el.setItemState(
          id,
          'steered',
          opts.ko ? '모델이 이미 읽어 취소하지 못했습니다' : 'The agent already read it — it couldn’t be cancelled',
        ),
      );
      later(2600, () => without(id));
      return;
    }
    later(300, () => without(id));
  });
  return el;
}

const queue = (): SteeringItem[] => [
  {
    id: 'C0AKY7W2UGZ:1793008217#31',
    text: 'Use Postgres 16 syntax — prod isn’t on 17 yet',
    at: now() - 3 * MIN,
    state: 'queued',
  },
  {
    id: 'C0AKY7W2UGZ:1793008217#32',
    text: 'Run npm run verify once more before opening the PR',
    at: now() - 40_000,
    state: 'queued',
    reason: 'edited',
  },
];

/** Inline-styled light-DOM tools, the way the dashboard slots its attach / image / mic buttons. */
function tools(): HTMLElement {
  const box = document.createElement('span');
  box.slot = 'tools';
  const tool = (label: string, d: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.style.cssText =
      'display:inline-grid;place-items:center;width:28px;height:28px;border:0;border-radius:6px;background:none;color:inherit;opacity:.6;cursor:pointer';
    b.innerHTML = `<svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
    return b;
  };
  box.append(
    tool(
      'Attach a file',
      'M15.5 9.5l-5.8 5.8a3.5 3.5 0 0 1-5-5l6.3-6.3a2.3 2.3 0 0 1 3.3 3.3l-6.2 6.2a1.1 1.1 0 0 1-1.6-1.6l5.6-5.6',
    ),
    tool('Record a voice note', 'M7.5 4.5a2.5 2.5 0 0 1 5 0v5a2.5 2.5 0 0 1-5 0zM4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5'),
  );
  return box;
}

function chip(name: string): HTMLElement {
  const c = document.createElement('div');
  c.slot = 'attachments';
  c.style.cssText =
    'display:inline-flex;align-items:center;gap:6px;margin:0 0 8px 2px;padding:3px 10px;border-radius:999px;font-size:12px;background:color-mix(in srgb,currentColor 8%,transparent)';
  c.textContent = `📎 ${name}`;
  return c;
}

export const doc: ComponentDoc = {
  slug: 'agent-steering',
  name: 'Agent Steering',
  tag: 'ui-agent-steering',
  group: 'Components',
  summary: 'Step into a running agent without stopping it — queue a note for its next step, or hand it over now.',
  description:
    'The composer plus the agent’s follow-up queue. While the agent works, Enter queues a note for its next step and ' +
    '⌘/Ctrl+Enter hands it to the running turn now; when it is idle, Enter simply sends. Queued notes are listed in ' +
    'order with Send now, Edit (inline: Enter saves, Esc cancels) and Cancel, and say what happened to them: sending, ' +
    'delivered (the agent reads it at its next tool call — until then Send now stops the current step for it and ' +
    'Cancel pulls it back), or failed with Retry. Every action shows at once and the ' +
    'host confirms it with its next list or rolls it back with setItemState(). Owner-only like Stop: canAct: false ' +
    'leaves a read-only list. The field never resets under a host update, so an IME composition survives a live queue. ' +
    'Docked (the default since 0.33): a note shows above the field only on its way in; once the list has it, it waits ' +
    'behind a round button at the top right with the count — hover peeks the queue open, a press pins it, and under ' +
    '640px it is a bottom sheet that follows the soft keyboard and closes when dragged down. queue: "inline" keeps ' +
    'every note above the field.',
  usedIn:
    'soma-work dashboard — the session panel composer (renderPanelComposer / sendCommand, .panel-command, #cmd-input) ' +
    'with the session’s FollowupQueue (list / promote / steer / editQueued / cancelItem) that Slack shows as Send now / Cancel.',
  reference: { name: 'affectUI Agent Steering', url: 'https://www.affectui.com/components/agent-steering' },
  props: [
    {
      name: 'data.running',
      type: 'boolean',
      default: 'false',
      description:
        'The agent is working: Enter queues for its next step, ⌘/Ctrl+Enter steers now, and a note sent shows in the queue until the list has it. Idle: Enter sends.',
    },
    {
      name: 'data.items',
      type: 'SteeringItem[]',
      description:
        '{ id, text, at?, state, author?, reason?, files?, canEdit? } in queue order. state: queued | sending | steered | failed | cancelled (hidden). FollowupQueue: paused → queued, reserved / claimed / dispatched → sending, uncertain → failed.',
    },
    {
      name: 'data.canAct',
      type: 'boolean',
      default: 'true',
      description: 'false (not the owner): read-only list, no buttons, the field is off.',
    },
    {
      name: 'data.disabled',
      type: 'boolean',
      default: 'false',
      description: 'The session ended: the field and the notes’ buttons are off.',
    },
    {
      name: 'data.placeholder',
      type: 'string',
      description: 'Field placeholder while it is open. Default “Steer the agent…” running, “Send a message…” idle.',
    },
    {
      name: 'data.attachments',
      type: 'number',
      default: '0',
      description: 'Files the host holds for the next message; above 0 a note with no text can be sent.',
    },
    {
      name: 'data.queue',
      type: "'dock' | 'inline'",
      default: "'dock'",
      description:
        'dock: the list’s notes wait behind a round count button at the top right (fail colour when one failed, a spinning ring while one is on its way); hover peeks them open (120ms intent, 240ms grace), a press pins them, Esc / a press outside / the button again close; under 640px a bottom sheet over a scrim, on the visual viewport (above the keyboard and the home bar; with the keyboard up it takes all but 8px of what is left, and a note being edited keeps its Save row in view), dragged down to close. Only a note on its way in (not in the list yet, or refused before it got there) shows above the field. inline: every note above the field.',
    },
    {
      name: 'openQueue({ focus? }) / closeQueue() / queueOpen',
      type: 'methods',
      description:
        'Pin the docked queue open (focus: true moves focus to its first note), close it (focus inside goes back to the button), or read whether it shows. Nothing opens while no note waits.',
    },
    {
      name: '--ui-steering-dock-gap / --ui-steering-dock-right / --ui-steering-pop-z',
      type: 'CSS',
      default: '8px / 0px / 160',
      description:
        'How far above the element’s top the dock floats and how far in from its right edge (the host knows what sits there); the open queue’s z-index (the scrim is one below). The dock sits outside the element’s box: leave gap + 32px (44px on touch) of unclipped room above it — an overflow: hidden ancestor that ends at the element’s top hides it (openQueue() still opens the queue).',
    },
    { name: 'value', type: 'string', description: 'The field’s text — read it, or prefill it (e.g. to resend).' },
    {
      name: 'slot="tools" / slot="attachments"',
      type: 'elements',
      description: 'The host’s own buttons inside the field (attach, voice) and its file chips above it.',
    },
    {
      name: 'slot="composer"',
      type: '<ui-composer>',
      description:
        'A <ui-composer slot="composer"> becomes the field: its attach / image / voice, chips, limits and camera replace the built-in field and the tools / attachments slots. This element sets the composer’s placeholder, label and disabled (and turns its own hint off — the key hints stay below); set the rest on the composer. Enter queues, ⌘/Ctrl+Enter steers; the composer’s ui-submit stops here and leaves as this element’s, with its files. value and focus() go to the composer.',
    },
    { name: 'lang', type: "'en' | 'ko'", default: 'en', description: 'Korean follows the dashboard and Slack queue.' },
  ],
  events: [
    {
      name: 'ui-submit',
      detail: "{ text, mode: 'queue' | 'steer', ref, files?: File[] }",
      description:
        'A note from the field (or Retry). Cancelable: cancelled → the text stays (with a composer: its files too). ref names the row it shows as until the list has it: setItemState(ref, "failed", why) offers Retry. files: the slotted composer’s attachments (a Retry resends the ref without them — keep them by ref).',
    },
    {
      name: 'ui-promote',
      detail: '{ id }',
      description:
        'Send now on a queued or delivered note (or Retry on a failed one): stop the running step and run it now, or run it now when idle. Cancelable; shows Sending… until the list changes — roll back with setItemState(id, its state, why).',
    },
    {
      name: 'ui-edit',
      detail: '{ id, text }',
      description: 'A queued note’s new text. Cancelable (the box stays open); shows the new text, Saving…',
    },
    {
      name: 'ui-cancel',
      detail: '{ id }',
      description:
        "Cancel a queued, delivered (steered — withdraw it before the agent reads it) or failed note (id may be a submit ref). Cancelable; the note leaves at once — a host that was too late brings it back with setItemState(id, 'steered', why), or lets its next list settle it.",
    },
  ],
  keyboard: [
    ['Enter', 'Queue the note for the next step (running) or send it (idle). Never on an IME composition Enter'],
    ['⌘/Ctrl + Enter', 'Hand the note to the running turn now (idle: send)'],
    ['Shift + Enter', 'New line (on touch screens Enter is a new line too; the button sends)'],
    ['Esc', 'Clear the field (an empty field lets Esc reach the page); in an edit box: stop editing'],
    [
      'Enter / Space held (a note’s button)',
      'Acts once: a held key does not repeat onto the next note (after a Cancel, focus is on its Send now)',
    ],
    ['Enter / Space (dock)', 'Open the queue pinned, focus on its first note; again closes it'],
    ['Esc (queue open)', 'Close the queue, focus back on the dock (the page sees the key as used)'],
    ['Enter / Esc (editing)', 'Save the edit / keep the original'],
    [
      'Tab',
      'The dock (while notes wait) and, when open, its ✕ and the queue’s notes; then a note on its way in, the host’s tools, the field and Send',
    ],
  ],
  a11y: [
    'The field is labelled (“Steer the agent” / “Message the session”) and described by the key hints.',
    'The queue is a list named by its heading and count; every button names its note (“Cancel “Use Postgres 16…””).',
    'Queuing, steering, sending, delivery, cancelling and failures are announced in a polite live region.',
    'Focus survives host updates; when a note’s control goes away it moves to the next note, the one before, or the field.',
    'With a slotted composer, its field carries this element’s name and placeholder; its chips, recorder and errors keep the composer’s own semantics.',
    'The dock is a button named by the count (“3 queued notes — some couldn’t be sent”) with aria-haspopup="dialog" and aria-expanded; the queue is a dialog named by its heading and count, inert while closed; the phone sheet (with its scrim) is aria-modal.',
    'Hover only peeks for a mouse or pen (a touch never does); acting inside a peek (a press, focus) pins it. A tap on the phone sheet moves focus into it, so the soft keyboard goes down and the sheet has the screen.',
    'Touch targets are 44px on coarse pointers (the dock too); reduced motion drops the enter/leave motion, the bump and the spinners — the dock, the queue and the sheet fade.',
    'Sound (opt-in, @2lab.ai/ui/sound): pressing the dock open plays open and closing the queue (dock, ✕, Esc, scrim, drag) a subtle close; sending, queuing, Send now and Retry tap, Cancel plays a subtle close and a saved edit a subtle tap — once their event is not prevented; keystrokes in the field and the edit box play type while typing sounds are on. Silent until the page turns sound on.',
  ],
  usage: `<ui-agent-steering lang="ko"></ui-agent-steering>
<script type="module">
  import '@2lab.ai/ui/agent-steering';
  const el = document.querySelector('ui-agent-steering');
  // FollowupQueue.list(sessionKey) → items (paused → queued, reserved/claimed/dispatched → sending, uncertain → failed)
  el.data = { running: session.activityState === 'working', canAct: session.ownerId === me, items };
  el.addEventListener('ui-submit', async (e) => {
    const res = await post('/session/' + key + '/command', { message: e.detail.text, mode: e.detail.mode });
    if (!res.ok) el.setItemState(e.detail.ref, 'failed', 'Could not send (' + res.status + ')');
  });
  el.addEventListener('ui-promote', async (e) => {
    const res = await post('/session/' + key + '/followup/' + e.detail.id + '/send-now');
    // Roll back and say why — to the state the list has NOW (a delivered note stays delivered; never a blind 'queued').
    const now = el.data.items.find((i) => i.id === e.detail.id);
    if (!res.ok && now) el.setItemState(e.detail.id, now.state, await res.text());
  });
  // ui-edit { id, text } → editQueued, ui-cancel { id } → cancelItem (a steered note: the SDK withdraws it first,
  // then cancelSteered — or it was read, and the next list settles it). The pushed list confirms each one.
</script>`,
  demos: [
    {
      id: 'running',
      title: 'While the agent works',
      description:
        'Two notes wait behind the round button at the top right. Type one and press Enter: it shows above the field until the list has it, then joins the count. Hover the button to peek, press it to pin the queue; Send now, Edit and Cancel on a note. Narrow the window under 640px for the bottom sheet.',
      height: 420,
      create: () => stage(host(steering({ running: true, items: queue() }))),
    },
    {
      id: 'states',
      title: 'Every state',
      description:
        'Queued, being sent, delivered to the running turn (not read yet: Send now stops the current step for it, Cancel pulls it back), failed (cut off by Stop — Retry runs it again), and one from Slack with a file.',
      height: 560,
      create: () =>
        stage(
          host(
            steering({
              running: true,
              items: [
                {
                  id: 'q1',
                  text: 'Keep the old users view for a week',
                  at: now() - 6 * MIN,
                  state: 'queued',
                },
                {
                  id: 'q2',
                  text: 'Skip the e2e suite, CI is down — unit tests only',
                  at: now() - 2 * MIN,
                  state: 'sending',
                },
                {
                  id: 'q3',
                  text: 'Also update the README table row',
                  at: now() - MIN,
                  state: 'steered',
                },
                {
                  id: 'q4',
                  text: 'Re-run the migration dry run on staging',
                  at: now() - 14 * MIN,
                  state: 'failed',
                  reason: 'Interrupted by Stop — it may have run partly',
                },
                {
                  id: 'q5',
                  text: 'Here is the schema dump from prod',
                  at: now() - 9 * MIN,
                  state: 'queued',
                  author: 'Slack · Zhuge',
                  files: ['schema-prod-2026-10-29.sql'],
                  canEdit: false,
                },
              ],
            }),
          ),
        ),
    },
    {
      id: 'inline',
      title: 'queue: "inline"',
      description: 'Every note above the field, as before 0.33 — for a host with room to spare.',
      height: 380,
      create: () => stage(host(steering({ running: true, items: queue(), queue: 'inline' }))),
    },
    {
      id: 'idle',
      title: 'Not running',
      description:
        'Idle, Enter just sends — no queue to show. Below: notes a Stop held back; Send now runs one, Cancel drops it.',
      height: 420,
      create: () =>
        stage(
          host(steering({ running: false, items: [] })),
          host(
            steering({
              running: false,
              items: [
                {
                  id: 'h1',
                  text: 'Then open the PR against main',
                  at: now() - 25 * MIN,
                  state: 'queued',
                  reason: 'Held after Stop — Send now runs it',
                },
                {
                  id: 'h2',
                  text: 'And post the summary in the thread',
                  at: now() - 24 * MIN,
                  state: 'queued',
                  reason: 'Held after Stop — Send now runs it',
                },
              ],
            }),
          ),
        ),
    },
    {
      id: 'refused',
      title: 'Refused and failed',
      description:
        'The host says no: the first Send now is refused (another dispatch is in flight), edits are refused (already handed over), the first message fails — Retry sends it — and the delivered note’s Cancel comes too late (the agent read it first).',
      height: 460,
      create: () =>
        stage(
          host(
            steering({
              running: true,
              items: [
                ...queue(),
                {
                  id: 'C0AKY7W2UGZ:1793008217#33',
                  text: 'Ignore my last note — sent by mistake',
                  at: now() - 20_000,
                  state: 'steered',
                },
              ],
            }),
            { refuseOnce: true, refuseEdit: true, failFirst: true, lateCancel: true },
          ),
        ),
    },
    {
      id: 'tools',
      title: 'With the host’s tools',
      description:
        'The dashboard keeps its attach and voice buttons (slot="tools") and file chips (slot="attachments"); with a file held, an empty note can be sent.',
      height: 360,
      create: () => {
        const el = host(steering({ running: true, attachments: 1, items: queue().slice(0, 1) }));
        el.append(tools(), chip('screenshot-panel.png'));
        el.addEventListener('ui-submit', () => {
          for (const c of Array.from(el.querySelectorAll('[slot="attachments"]'))) c.remove();
          if (el.data) el.data = { ...el.data, attachments: 0 };
        });
        return stage(el);
      },
    },
    {
      id: 'composer',
      title: 'With a composer',
      description:
        'A <ui-composer slot="composer"> is the field — attach, image, voice, chips and a 30 MB cap are the composer’s. Enter queues, ⌘/Ctrl+Enter steers; the note leaves as this element’s ui-submit with its files, and shows with its file count.',
      height: 420,
      create: () => {
        const el = host(steering({ running: true, items: queue().slice(0, 1) }));
        const c = document.createElement('ui-composer');
        c.slot = 'composer';
        c.data = { maxFiles: 4, maxTotalBytes: 30 * 1024 * 1024 };
        el.append(c);
        return stage(el);
      },
    },
    {
      id: 'readonly',
      title: 'Read-only · ended',
      description: 'Someone else’s session: the queue shows, nothing can be done (like Stop). Below: an ended session.',
      height: 420,
      create: () =>
        stage(
          steering({ running: true, canAct: false, items: queue() }),
          steering({ running: false, disabled: true, items: [] }),
        ),
    },
    {
      id: 'ko',
      title: '한국어 (lang="ko")',
      description:
        '대시보드와 Slack 큐 문구 — 다음 단계에 전달 대기, 지금 보내기(하던 작업을 멈추고 지금 바로 실행), 전달됨 · 모델이 다음 툴 호출에서 읽음 — 읽기 전엔 취소할 수 있음.',
      height: 460,
      create: () =>
        stage(
          host(
            steering(
              {
                running: true,
                items: [
                  {
                    id: 'k1',
                    text: '대시보드 패널 컴포저를 <ui-agent-steering>으로 바꿔줘',
                    at: now() - 4 * MIN,
                    state: 'queued',
                  },
                  {
                    id: 'k2',
                    text: '커밋 메시지는 conventional commits로',
                    at: now() - 2 * MIN,
                    state: 'queued',
                    reason: '편집됨',
                  },
                  { id: 'k3', text: '테스트는 happy-dom으로 돌려', at: now() - MIN, state: 'steered' },
                ],
              },
              { lang: 'ko' },
            ),
            { ko: true },
          ),
        ),
    },
  ],
};
