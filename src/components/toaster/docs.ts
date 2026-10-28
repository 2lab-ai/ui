import type { ComponentDoc } from '../../docs/types';
import './toaster';
import type { ToasterData } from './logic';
import type { UiToaster } from './toaster';

/** A panel with an inline toaster and buttons that fire toasts at it (the page toaster is left alone). */
function panel(
  buttons: Array<[label: string, run: (t: UiToaster) => void]>,
  data: ToasterData = {},
  attrs: Record<string, string> = {},
  autoplay?: (t: UiToaster) => void,
): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText =
    'position:relative;height:100%;min-height:360px;display:grid;align-content:start;gap:12px;padding:20px';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
  const t = document.createElement('ui-toaster');
  t.setAttribute('inline', '');
  for (const [k, v] of Object.entries(attrs)) t.setAttribute(k, v);
  t.data = { placement: 'bottom-right', mobilePlacement: 'bottom-center', ...data };
  for (const [label, run] of buttons) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText =
      'font:500 13px/1 var(--font, system-ui);padding:9px 12px;border-radius:8px;border:1px solid var(--ui-border, rgba(127,127,127,.35));background:var(--ui-surface, transparent);color:var(--ui-text, #18181a);cursor:pointer';
    b.addEventListener('click', () => run(t));
    row.append(b);
  }
  box.append(row, t);
  if (autoplay) window.setTimeout(() => t.isConnected && autoplay(t), 400);
  return box;
}

const wait = <T>(ms: number, value: T, fail = false): Promise<T> =>
  new Promise((res, rej) =>
    window.setTimeout(() => (fail ? rej(new Error('HTTP 502 from the session')) : res(value)), ms),
  );

export const doc: ComponentDoc = {
  slug: 'toaster',
  name: 'Toaster',
  tag: 'ui-toaster',
  group: 'Components',
  summary: 'Did it work? — one calm stack of results for everything a person does on the page.',
  description:
    'One stack of toasts for a page. Toasts come in from the edge, the ones behind shrink and peek out, and the stack ' +
    'fans out on hover, keyboard focus or a tap. Timers pause while the pointer or focus is in the stack and while ' +
    'the tab is hidden; errors stay twice as long. A promise toast starts as a spinner and turns into a check or a ' +
    'cross with the result. An action (Retry, Undo, Open) or a link sits on the toast; swipe, Esc or the close ' +
    'button dismiss it, and F8 jumps to the newest. More than three wait behind a “+N”. Call it from anywhere with ' +
    '`toast(…)` — it finds or creates the page’s toaster.',
  usedIn:
    'soma-work dashboard — results of Stop / Close / Trash (silent today), permission and question answers, the ' +
    'model and effort switches and goal actions; replaces the multi-choice form’s alert() calls and the new-task toast.',
  reference: { name: 'affectUI Toaster', url: 'https://www.affectui.com/components/toaster' },
  props: [
    {
      name: 'data.placement',
      type: "'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'",
      default: "'bottom-right'",
      description: 'Corner or edge on screens 600px and wider.',
    },
    {
      name: 'data.mobilePlacement',
      type: "'top-center' | 'bottom-center'",
      default: "'top-center'",
      description: 'Edge under 600px, spanning the width.',
    },
    {
      name: 'data.duration',
      type: 'number (ms)',
      default: '4000',
      description: 'Default time on screen; errors stay twice as long; loading toasts until settled.',
    },
    {
      name: 'data.visible',
      type: 'number',
      default: '3',
      description: 'Toasts shown at once; the rest wait (timer paused) behind “+N”.',
    },
    { name: 'data.expand', type: 'boolean', description: 'Always fanned out.' },
    {
      name: 'data.hotkey',
      type: 'string | null',
      default: "'F8'",
      description: 'Key that moves focus to the newest toast; null turns it off.',
    },
    {
      name: 'data.closeButton / hairline',
      type: 'boolean',
      description: 'Close button (always on touch screens); a timer line along the bottom.',
    },
    {
      name: 'inline',
      type: 'attribute',
      description: 'Positions the stack inside its parent instead of the viewport (a panel’s own toaster).',
    },
    {
      name: 'lang',
      type: "'en' | 'ko'",
      default: 'en',
      description: 'Korean: 닫기, 다시 시도, 실행 취소, 처리 중…, 완료했어요, 실패했어요.',
    },
  ],
  events: [
    {
      name: 'ui-action',
      detail: '{ id, actionId }',
      description: 'A toast’s action was pressed. Cancelable: not cancelled → the toast closes.',
    },
    {
      name: 'ui-dismiss',
      detail: "{ id, reason: 'timeout' | 'close' | 'swipe' | 'escape' | 'action' | 'api' }",
      description: 'A toast left.',
    },
  ],
  keyboard: [
    ['F8', 'Focus the newest toast (configurable via data.hotkey)'],
    ['Tab / Shift+Tab', 'Move through the toasts’ actions, links and close buttons'],
    ['Esc', 'Dismiss the focused toast; focus returns where it was before F8'],
  ],
  a11y: [
    'The stack is a labelled region (“Notifications, F8”); each toast is a list item.',
    'Neutral and success toasts are announced politely, errors and warnings assertively, with the word “Error” / “Warning” spoken first — never colour alone.',
    'Timers pause while focus is inside, so a keyboard user can read and act.',
    'Reduced motion swaps the slide and fan for a fade.',
  ],
  usage: `import { toast } from '@2lab.ai/ui/toaster';

// a result
toast.success('Session stopped');
// a failure with a retry
const id = toast.error('Couldn’t stop the session', { description: 'HTTP 502', action: { id: 'retry' } });
document.addEventListener('ui-action', (e) => { if (e.detail.id === id) stop(); });
// a request that takes a moment
await toast.promise(fetch('/api/dashboard/session/' + key + '/stop', { method: 'POST' }), {
  loading: 'Stopping…', success: 'Stopped', error: (e) => ({ title: 'Couldn’t stop', description: String(e) }),
});`,
  demos: [
    {
      id: 'results',
      title: 'Results',
      description:
        'What a dashboard action reports: a success, a failure with Retry, a warning, a plain note with a link. Hover the stack to fan it out.',
      height: 420,
      frame: false,
      create: () =>
        panel(
          [
            [
              'Stop session',
              (t) => t.show('Session stopped', { tone: 'success', description: 'Dashboard — model picker bars' }),
            ],
            [
              'Trash fails',
              (t) =>
                t.show('Couldn’t move the session to Trash', {
                  tone: 'error',
                  description: 'HTTP 502 from the server',
                  action: { id: 'retry' },
                }),
            ],
            [
              'Warning',
              (t) => t.show('Context is 92% full', { tone: 'warning', description: 'Auto-compact runs at 95%.' }),
            ],
            [
              'With a link',
              (t) =>
                t.show('PR #500 merged', {
                  link: { label: 'Open', href: 'https://github.com/2lab-ai/soma-work/pull/500' },
                }),
            ],
          ],
          {},
          {},
          (t) => {
            t.show('Session stopped', { tone: 'success', description: 'Dashboard — model picker bars' });
            window.setTimeout(
              () =>
                t.show('Couldn’t move the session to Trash', {
                  tone: 'error',
                  description: 'HTTP 502 from the server',
                  action: { id: 'retry' },
                }),
              500,
            );
          },
        ),
    },
    {
      id: 'promise',
      title: 'Promise',
      description: 'A request that takes a moment: the spinner turns into a check — or a cross with the reason.',
      height: 420,
      frame: false,
      create: () =>
        panel(
          [
            [
              'Switch model (works)',
              (t) =>
                void t
                  .promise(wait(1400, 'claude-opus-5-5[1m]'), {
                    loading: 'Switching model…',
                    success: (m) => ({ title: 'Model switched', description: m }),
                    error: 'Couldn’t switch',
                  })
                  .catch(() => {}),
            ],
            [
              'Answer permission (fails)',
              (t) =>
                void t
                  .promise(wait(1400, 0, true), {
                    loading: 'Sending your answer…',
                    success: 'Approved',
                    error: (e) => ({ title: 'Couldn’t send your answer', description: String((e as Error).message) }),
                  })
                  .catch(() => {}),
            ],
          ],
          {},
          {},
          (t) =>
            void t
              .promise(wait(1600, 'claude-opus-5-5[1m]'), {
                loading: 'Switching model…',
                success: (m) => ({ title: 'Model switched', description: m }),
              })
              .catch(() => {}),
        ),
    },
    {
      id: 'stack',
      title: 'Stack and “+N”',
      description:
        'Six at once: three show, the rest wait behind “+3” with their timers paused. Swipe one away, or Esc it after F8.',
      height: 440,
      frame: false,
      create: () =>
        panel(
          [
            [
              'Fire six',
              (t) => {
                for (let i = 1; i <= 6; i++)
                  window.setTimeout(
                    () =>
                      t.show(`Task T${i} done`, {
                        tone: i % 3 === 0 ? 'warning' : 'success',
                        description: `${i * 7} tool calls · ${i}m ${10 + i}s`,
                      }),
                    i * 160,
                  );
              },
            ],
            ['Dismiss all', (t) => t.dismiss()],
          ],
          { duration: 9000 },
          {},
          (t) => {
            for (let i = 1; i <= 6; i++)
              window.setTimeout(
                () => t.show(`Task T${i} done`, { tone: 'success', description: `${i * 7} tool calls` }),
                i * 160,
              );
          },
        ),
    },
    {
      id: 'undo',
      title: 'Undo',
      description:
        'A destructive action that can be taken back: Undo is the toast’s action; pressing it closes the toast and the host restores.',
      height: 420,
      frame: false,
      create: () => {
        const box = panel(
          [['Delete memory entry', (t) => t.show('Memory entry deleted', { action: { id: 'undo' }, duration: 6000 })]],
          {},
          {},
          (t) => t.show('Memory entry deleted', { action: { id: 'undo' }, duration: 8000 }),
        );
        box.addEventListener('ui-action', (e) => {
          const t = (e.target as UiToaster) ?? null;
          if ((e as CustomEvent).detail.actionId === 'undo')
            window.setTimeout(() => t?.show?.('Restored', { tone: 'success' }), 200);
        });
        return box;
      },
    },
    {
      id: 'top',
      title: 'Top center',
      description: 'Placement for a phone, or a page whose bottom edge is busy.',
      height: 400,
      frame: false,
      create: () =>
        panel(
          [
            [
              'Show',
              (t) => t.show('Goal updated', { tone: 'success', description: 'Ship the work-log tool call cards' }),
            ],
          ],
          { placement: 'top-center' },
          {},
          (t) => t.show('Goal updated', { tone: 'success', description: 'Ship the work-log tool call cards' }),
        ),
    },
    {
      id: 'ko',
      title: '한국어 (lang="ko")',
      description: '대시보드 문구 — 다시 시도, 실행 취소, 처리 중…, 완료했어요, 실패했어요.',
      height: 420,
      frame: false,
      create: () =>
        panel(
          [
            ['세션 중지', (t) => t.show('세션을 중지했어요', { tone: 'success' })],
            [
              '휴지통 실패',
              (t) =>
                t.show('휴지통으로 옮기지 못했어요', {
                  tone: 'error',
                  description: '서버 응답 502',
                  action: { id: 'retry' },
                }),
            ],
            ['처리 중 → 완료', (t) => void t.promise(wait(1400, 1), {}).catch(() => {})],
          ],
          {},
          { lang: 'ko' },
          (t) => {
            t.show('세션을 중지했어요', { tone: 'success' });
            window.setTimeout(
              () =>
                t.show('휴지통으로 옮기지 못했어요', {
                  tone: 'error',
                  description: '서버 응답 502',
                  action: { id: 'retry' },
                }),
              500,
            );
          },
        ),
    },
  ],
};
