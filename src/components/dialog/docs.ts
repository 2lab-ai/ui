import { esc } from '../../core/html';
import type { ComponentDoc } from '../../docs/types';
import { type IconName, icon } from '../../icons/icons';
import './dialog';
import type { DialogCloseDetail, UiDialog } from './dialog';

/** A trigger row plus the quiet status line a host would show under it; the dialog itself takes no space. */
function stage(): { box: HTMLElement; line: HTMLElement } {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:10px';
  const line = document.createElement('p');
  line.className = 'ui-status-line';
  line.setAttribute('role', 'status');
  return { box, line };
}

function trigger(text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ui-btn';
  b.textContent = text;
  return b;
}

function dialog(attrs: Record<string, string>, html: string): UiDialog {
  const el = document.createElement('ui-dialog');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.innerHTML = html;
  return el;
}

/** Echo every ui-close into the status line. */
function echo(el: UiDialog, line: HTMLElement, say = (r: string) => `ui-close → ${r}`): void {
  el.addEventListener('ui-close', (e) => {
    line.textContent = say((e as CustomEvent<DialogCloseDetail>).detail.reason);
  });
}

/** Footer buttons carry data-act; the host decides what each does. */
function onAct(el: UiDialog, run: (act: string) => void): void {
  el.addEventListener('click', (e) => {
    const act = (e.target as Element | null)?.closest?.('[data-act]')?.getAttribute('data-act');
    if (act) run(act);
  });
}

/** A kit icon button for the viewer toolbar (slot="actions"). */
function tool(name: IconName, label: string, act: string): string {
  return `<button type="button" class="ui-icon-btn" slot="actions" data-act="${act}" aria-label="${esc(label)}">${icon(name)}</button>`;
}

const ARTIFACTS: Array<{ name: string; meta: string; body: string }> = [
  {
    name: 'report.html',
    meta: 'HTML · 18 KB · 2 min ago',
    body: '<h3 style="margin:0 0 6px;font-size:15px;color:var(--ui-ib-text)">Upload flake — findings</h3><p style="margin:0">The 40 MB fixture times out on the shared ARM pool: 28–31 s in waitForResponse versus 6–9 s elsewhere. The retry delay doubles each attempt and hits the 30 s test timeout on the third.</p>',
  },
  {
    name: 'retries.png',
    meta: 'PNG · 1280×720 · 2 min ago',
    body: '<div role="img" data-chart aria-label="Bar chart of retry delays: 1 s, 2 s, 4 s, 8 s, 16 s" style="display:flex;align-items:flex-end;gap:12px;height:220px;padding:16px;box-sizing:border-box;border-radius:12px;background:var(--ui-ib-pill)"></div>',
  },
  {
    name: 'notes.md',
    meta: 'Markdown · 2 KB · 1 min ago',
    body: '<p style="margin:0 0 8px"><b>Next</b></p><ul style="margin:0;padding-left:18px"><li>Cap the retry delay at 4 s.</li><li>Run the spec 50× throttled.</li><li>Watch two full CI runs before merging.</li></ul>',
  },
];

const FIELD =
  'display:block;box-sizing:border-box;width:100%;min-height:112px;resize:vertical;padding:10px 12px;border:1px solid var(--ui-ib-card-border);border-radius:10px;background:var(--ui-ib-card);color:var(--ui-ib-text);font:inherit;font-size:14px;line-height:1.5';
const HINT = 'margin-right:auto;display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--ui-ib-muted)';

/** Escaped text with `code` spans. */
const code = (s: string): string => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

const PLAN = [
  [
    'Goal',
    'Make `web/upload.spec.ts` pass on CI every run. It times out in about one run in five, always on the 40 MB fixture.',
  ],
  [
    'What the logs say',
    'The failing runs spend 28–31 s in `waitForResponse(/\\/api\\/upload/)`. The passing runs finish the same step in 6–9 s. The runner image is the same; the slow runs land on the shared ARM pool.',
  ],
  [
    'Hypothesis',
    'The test waits for the first upload response, but the client retries a chunk when the first PUT takes longer than 10 s. The retry’s response is the one we should wait for, and the first one never arrives on the slow pool.',
  ],
  [
    'Step 1 — reproduce',
    'Throttle the fixture server to 2 MB/s locally and run the spec 20 times. Expect 3–5 failures with the same 30 s stack.',
  ],
  [
    'Step 2 — fix the wait',
    'Wait for the upload-complete event the page already emits (`upload:done`) instead of the first network response. No timeout change.',
  ],
  [
    'Step 3 — keep the fixture honest',
    'Keep the 40 MB fixture; it is the only one that crosses the chunk boundary twice. Add a 2 MB fixture for the fast path so the suite stays under two minutes.',
  ],
  [
    'Step 4 — prove it',
    'Run the spec 50 times throttled and 50 times unthrottled. Zero failures in both, then push and watch two full CI runs.',
  ],
  [
    'Out of scope',
    'The retry policy itself (10 s first-chunk timeout) is product behaviour; flag it in the PR, do not change it here.',
  ],
  [
    'Risks',
    'If `upload:done` fires before the server commits, the follow-up assertion on the file list could race. Step 4 will show it; the fallback is polling the list for up to 5 s.',
  ],
  [
    'Rollback',
    'One file changes (`web/upload.spec.ts`) plus one fixture. Reverting the commit restores the old behaviour.',
  ],
];

export const doc: ComponentDoc = {
  slug: 'dialog',
  name: 'Dialog',
  tag: 'ui-dialog',
  group: 'Primitives',
  summary: 'A modal question or form over a dimmed page — it rises in, settles out, and is a bottom sheet on phones.',
  description:
    'A native <dialog> opened with showModal(), so the focus trap, the inert page and the top layer come from the browser. The element draws its own scrim and panel inside it, which gives both a real exit: the panel rises in from 8px lower at 97% (240ms) and settles back out in 180ms while the scrim fades. Under 640px it becomes a bottom sheet that slides up on the drawer curve. Escape, a click on the scrim and the close button each send a cancelable ui-close with the reason; call preventDefault() to keep it open (unsaved changes). show(), hide() and the open attribute open and close it without an event.',
  usedIn:
    'soma-work dashboard › New task composer (centred, sheet on phones), the artifact viewer, and the session lifecycle policy dialog — three dialogs built three ways, now one.',
  reference: { name: 'WAI-ARIA APG Dialog (Modal)', url: 'https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/' },
  props: [
    {
      name: 'open',
      type: 'boolean',
      description:
        'Attribute and property. Reflects the state (false from the moment a close starts). Setting it opens or closes without ui-close.',
    },
    {
      name: 'heading',
      type: 'string',
      description: 'Attribute. The title (an <h2>); the dialog is labelled by it.',
    },
    {
      name: 'label',
      type: 'string',
      description: 'Attribute. Accessible name when there is no heading (e.g. with a custom header slot).',
    },
    {
      name: 'size',
      type: "'sm' | 'md' | 'lg' | 'xl' | 'full'",
      default: "'md'",
      description:
        'Attribute. Panel width 400 · 560 · 720 · 960 px (never wider than the viewport less 32px); full = viewport less 16px each side, and edge to edge under 640px whatever sheet says (no rounding, safe areas inside).',
    },
    {
      name: 'sheet',
      type: "'auto' | 'never'",
      default: "'auto'",
      description: 'Attribute. Under 640px the panel is a bottom sheet unless never.',
    },
    {
      name: 'hide-close',
      type: 'boolean',
      description: 'Attribute. No close button (Escape and the scrim still ask).',
    },
    {
      name: 'viewport',
      type: "'visual' | 'layout'",
      default: "'visual'",
      description:
        'Attribute. visual: while open the dialog follows window.visualViewport (height and offsetTop), so a sheet’s bottom stays above the iOS soft keyboard. layout: it does not.',
    },
    {
      name: 'lang',
      type: "'en' | 'ko'",
      default: "'en'",
      description: 'Attribute. Language of the close button label.',
    },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the theme (attribute). Default follows prefers-color-scheme or page tokens.',
    },
    {
      name: 'show()',
      type: '() => void',
      description: 'Open (no event). Focus goes to the first [autofocus] element, else the panel.',
    },
    {
      name: 'hide()',
      type: '() => void',
      description: 'Close with the exit motion (no event). Focus returns to where it was.',
    },
    {
      name: '--ui-vv-h / --ui-vv-top',
      type: 'CSS length',
      default: '100dvh / 0px',
      description:
        'Height and top of the visible area. The element writes them while open (from window.visualViewport); with viewport="layout" a host may set them itself.',
    },
    { name: 'slot (default)', type: 'content', description: 'The body. Scrolls when it is taller than the panel.' },
    { name: 'slot="header"', type: 'content', description: 'Replaces the heading text. Give the host a label then.' },
    {
      name: 'slot="actions"',
      type: 'content',
      description:
        'A toolbar beside the close button, outside the heading (paging, open in a new tab, download). Hidden while nothing is slotted; ::part(actions).',
    },
    {
      name: 'slot="footer"',
      type: 'content',
      description: 'Actions, end-aligned with an 8px gap above a hairline. The row is hidden while nothing is slotted.',
    },
  ],
  events: [
    {
      name: 'ui-close',
      detail: "{ reason: 'escape' | 'scrim' | 'close-button' }",
      description:
        'The person asked to close. Cancelable: preventDefault() keeps it open; otherwise it closes. Not sent for show() / hide() / open.',
    },
  ],
  keyboard: [
    ['Tab / Shift+Tab', 'Move through the dialog; focus stays inside while it is open'],
    ['Escape', 'Ask to close (ui-close, reason escape)'],
    ['Enter / Space on ×', 'Ask to close (reason close-button)'],
  ],
  a11y: [
    'A native modal <dialog>: the rest of the page is inert and focus is trapped inside by the browser.',
    'Labelled by its heading (aria-labelledby), or by the label attribute (aria-label).',
    'On open, focus goes to the first [autofocus] element in your content, else the panel (no ring on the panel itself); after the close it returns to the element that had it.',
    'The close button is a 32px target (44px on touch and narrow screens) named “Close” / “닫기”.',
    'Escape while a control inside uses it (an open menu, an IME composition) is left to that control.',
    'slot="actions" sits outside the <h2>, so toolbar buttons and links are not read as part of the dialog’s name; give icon buttons their own labels.',
    'Reduced motion: nothing moves — the scrim and panel fade in 120ms.',
    'Sound (opt-in, @2lab.ai/ui/sound): Escape, the scrim or the close button plays close unless ui-close is cancelled; show() / hide() / open play open / close only while the browser reports a recent click or key press (its user activation — a timer that fires seconds after a click can still sound; wrap such regions in data-ui-sound="off"), never when it starts open. Silent until the page turns sound on.',
  ],
  usage: `<button id="stop">Stop session…</button>
<ui-dialog id="confirm" size="sm" heading="Stop this session?">
  <p>Stopping ends the agent’s turn now. The transcript is kept.</p>
  <button class="ui-btn" slot="footer" data-act="cancel">Cancel</button>
  <button class="ui-btn is-danger is-primary" slot="footer" data-act="stop">Stop session</button>
</ui-dialog>
<script type="module">
  import '@2lab.ai/ui/dialog';
  const dlg = document.getElementById('confirm');
  document.getElementById('stop').onclick = () => dlg.show();
  dlg.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'stop') stopSession();
    if (act) dlg.hide();
  });
  dlg.addEventListener('ui-close', (e) => {
    if (hasUnsavedChanges()) e.preventDefault(); // keep it open
  });
</script>`,
  demos: [
    {
      id: 'confirm',
      title: 'Confirm',
      description:
        'size="sm" with a danger action. Cancel and Stop call hide(); ×, Escape and the scrim send ui-close.',
      height: 200,
      create: () => {
        const { box, line } = stage();
        const open = trigger('Stop session…');
        const el = dialog(
          { size: 'sm', heading: 'Stop this session?' },
          `<p>T-1842 is mid-run (step 14 of about 20). Stopping ends the agent’s turn now; the transcript and the files it wrote so far are kept.</p>
<button type="button" class="ui-btn" slot="footer" data-act="cancel">Cancel</button>
<button type="button" class="ui-btn is-danger is-primary" slot="footer" data-act="stop">Stop session</button>`,
        );
        open.addEventListener('click', () => el.show());
        onAct(el, (act) => {
          line.textContent = act === 'stop' ? 'Stopped T-1842' : 'Kept running';
          el.hide();
        });
        echo(el, line);
        box.append(open, line, el);
        return box;
      },
    },
    {
      id: 'new-task',
      title: 'New task',
      description:
        'The composer: focus lands in the [autofocus] textarea; ⌘/Ctrl + Enter starts. A bottom sheet under 640px that follows the visual viewport, so Start stays above the soft keyboard.',
      height: 200,
      create: () => {
        const { box, line } = stage();
        const open = trigger('New task');
        const el = dialog(
          { heading: 'New task' },
          `<textarea autofocus rows="5" aria-label="Task" placeholder="Fix the flaky upload test in web/upload.spec.ts — it times out on CI about one run in five." style="${FIELD}"></textarea>
<span slot="footer" style="${HINT}"><kbd class="ui-kbd">⌘</kbd><kbd class="ui-kbd">↵</kbd> to start</span>
<button type="button" class="ui-btn is-primary" slot="footer" data-act="start" disabled>Start</button>`,
        );
        const ta = el.querySelector('textarea')!;
        const start = el.querySelector<HTMLButtonElement>('[data-act="start"]')!;
        const go = () => {
          const text = ta.value.trim();
          if (!text) return;
          line.textContent = `Started: ${text.length > 60 ? `${text.slice(0, 60)}…` : text}`;
          ta.value = '';
          start.disabled = true;
          el.hide();
        };
        ta.addEventListener('input', () => {
          start.disabled = !ta.value.trim();
        });
        ta.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            go();
          }
        });
        onAct(el, (act) => {
          if (act === 'start') go();
        });
        open.addEventListener('click', () => el.show());
        echo(el, line);
        box.append(open, line, el);
        return box;
      },
    },
    {
      id: 'long',
      title: 'Long content',
      description: 'size="lg": the body scrolls inside the panel (overscroll contained); header and footer stay put.',
      height: 200,
      create: () => {
        const { box, line } = stage();
        const open = trigger('Open plan.md');
        const body = PLAN.map(
          ([h, p]) =>
            `<h3 style="margin:18px 0 4px;font-size:13.5px;font-weight:600;color:var(--ui-ib-text)">${esc(h)}</h3><p style="margin:0">${code(p)}</p>`,
        ).join('');
        const el = dialog(
          { size: 'lg', heading: 'plan.md · T-1842' },
          `<div>${body}</div><button type="button" class="ui-btn" slot="footer" data-act="close">Close</button>`,
        );
        open.addEventListener('click', () => el.show());
        onAct(el, () => el.hide());
        echo(el, line);
        box.append(open, line, el);
        return box;
      },
    },
    {
      id: 'viewer',
      title: 'Viewer',
      description:
        'size="full" with a header toolbar in slot="actions": ‹ n/m ›, open, download beside ×. Edge to edge on phones; ← / → page.',
      height: 200,
      create: () => {
        const { box, line } = stage();
        const open = trigger('Open artifacts');
        let at = 0;
        const el = dialog(
          { size: 'full', label: 'Artifact viewer' },
          `<span slot="header" style="display:flex;flex-direction:column;gap:2px"><span data-name></span><span data-meta style="font-size:12px;font-weight:500;color:var(--ui-ib-muted)"></span></span>
<div data-body style="max-width:720px;margin:0 auto"></div>
${tool('chevron-left', 'Previous', 'prev')}<span slot="actions" data-count style="min-width:40px;text-align:center;font-size:12.5px;color:var(--ui-ib-text-2);font-variant-numeric:tabular-nums"></span>${tool('chevron-right', 'Next', 'next')}${tool('external', 'Open in a new tab', 'tab')}${tool('download', 'Download', 'download')}`,
        );
        const paint = () => {
          const a = ARTIFACTS[at];
          el.querySelector('[data-name]')!.textContent = a.name;
          el.querySelector('[data-meta]')!.textContent = a.meta;
          el.querySelector('[data-count]')!.textContent = `${at + 1}/${ARTIFACTS.length}`;
          el.querySelector('[data-body]')!.innerHTML = a.body;
          const chart = el.querySelector('[data-chart]');
          if (chart) {
            chart.innerHTML = [1, 2, 4, 8, 16]
              .map(
                (n) =>
                  `<span style="flex:1;height:${n * 10 + 12}px;border-radius:6px 6px 2px 2px;background:color-mix(in srgb, var(--ui-accent) 70%, var(--ui-ib-card))"></span>`,
              )
              .join('');
          }
        };
        const page = (d: number) => {
          at = (at + d + ARTIFACTS.length) % ARTIFACTS.length;
          paint();
        };
        paint();
        onAct(el, (act) => {
          if (act === 'prev') page(-1);
          else if (act === 'next') page(1);
          else line.textContent = `${act === 'tab' ? 'Opened' : 'Downloaded'} ${ARTIFACTS[at].name}`;
        });
        el.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft') page(-1);
          if (e.key === 'ArrowRight') page(1);
        });
        open.addEventListener('click', () => el.show());
        echo(el, line);
        box.append(open, line, el);
        return box;
      },
    },
    {
      id: 'ko',
      title: '한국어 · 닫기 막기',
      description:
        '“변경 사항 있음”이 켜져 있으면 호스트가 ui-close를 preventDefault()로 막고 그 사실을 알립니다. 저장·취소 버튼은 hide()로 닫습니다.',
      height: 200,
      create: () => {
        const { box, line } = stage();
        const open = trigger('세션 정책');
        const el = dialog(
          { lang: 'ko', heading: '세션 정책' },
          `<p style="margin:0 0 12px">활동이 없는 세션을 언제 보관할지 정합니다. 보관한 세션은 보드에서 사라지고 검색으로 다시 열 수 있습니다.</p>
<fieldset style="display:grid;gap:8px;margin:0 0 14px;padding:0;border:0">
  <legend style="margin-bottom:6px;font-weight:600;color:var(--ui-ib-text)">유휴 후 보관</legend>
  <label style="display:flex;gap:8px;align-items:center"><input type="radio" name="ko-policy" value="30m" checked> 30분</label>
  <label style="display:flex;gap:8px;align-items:center"><input type="radio" name="ko-policy" value="2h"> 2시간</label>
  <label style="display:flex;gap:8px;align-items:center"><input type="radio" name="ko-policy" value="never"> 보관하지 않음</label>
</fieldset>
<label style="display:flex;gap:8px;align-items:center;font-weight:500;color:var(--ui-ib-text)"><input type="checkbox" data-dirty> 변경 사항 있음</label>
<p class="ui-status-line" role="status" data-tone="wait" data-note style="margin-top:10px"></p>
<button type="button" class="ui-btn" slot="footer" data-act="discard">변경 취소</button>
<button type="button" class="ui-btn is-primary" slot="footer" data-act="save">저장</button>`,
        );
        const dirty = el.querySelector<HTMLInputElement>('[data-dirty]')!;
        const note = el.querySelector<HTMLElement>('[data-note]')!;
        el.addEventListener('change', (e) => {
          if ((e.target as HTMLInputElement).type === 'radio') dirty.checked = true;
          note.textContent = '';
        });
        el.addEventListener('ui-close', (e) => {
          const reason = (e as CustomEvent<DialogCloseDetail>).detail.reason;
          if (dirty.checked) {
            e.preventDefault();
            note.textContent = '저장하지 않은 변경 사항이 있어 닫지 않았어요. 저장하거나 변경을 취소하세요.';
            line.textContent = `ui-close → ${reason} · 막음 (변경 사항 있음)`;
          } else line.textContent = `ui-close → ${reason}`;
        });
        onAct(el, (act) => {
          line.textContent = act === 'save' ? '정책을 저장했어요' : '변경을 취소했어요';
          dirty.checked = false;
          note.textContent = '';
          el.hide();
        });
        open.addEventListener('click', () => el.show());
        box.append(open, line, el);
        return box;
      },
    },
  ],
};
