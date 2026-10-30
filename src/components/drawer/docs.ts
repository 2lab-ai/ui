import { esc } from '../../core/html';
import type { ComponentDoc } from '../../docs/types';
import './drawer';
import type { DrawerCloseDetail, DrawerModeChange, DrawerResizeDetail, UiDrawer } from './drawer';

/** A trigger plus the quiet status line a host would show under it; the drawer itself takes no space. */
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

function drawer(attrs: Record<string, string>, html: string): UiDrawer {
  const el = document.createElement('ui-drawer');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  // The site's top bar is 56px tall: a docked drawer sits under it, as it would under an app bar.
  el.style.setProperty('--ui-drawer-top', '56px');
  el.innerHTML = html;
  return el;
}

/** Echo the drawer's events into the status line. */
function echo(
  el: UiDrawer,
  line: HTMLElement,
  words = { close: 'ui-close', resize: 'ui-resize', mode: 'ui-mode-change' },
) {
  el.addEventListener('ui-close', (e) => {
    line.textContent = `${words.close} → ${(e as CustomEvent<DrawerCloseDetail>).detail.reason}`;
  });
  el.addEventListener('ui-resize', (e) => {
    line.textContent = `${words.resize} → ${(e as CustomEvent<DrawerResizeDetail>).detail.width}px`;
  });
  el.addEventListener('ui-mode-change', (e) => {
    line.textContent = `${words.mode} → ${(e as CustomEvent<DrawerModeChange>).detail.mode}`;
  });
}

function onAct(el: UiDrawer, run: (act: string, target: HTMLElement) => void): void {
  el.addEventListener('click', (e) => {
    const t = (e.target as Element | null)?.closest?.<HTMLElement>('[data-act]');
    if (t) run(t.dataset.act ?? '', t);
  });
}

const FACTS = (rows: Array<[string, string]>) =>
  `<dl class="ui-dl">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;

const RUNS: Array<[tone: string, word: string, when: string, took: string]> = [
  ['run', 'Running', 'Today 14:00', '1m 12s so far'],
  ['done', 'Succeeded', 'Today 13:00', '2m 41s'],
  ['done', 'Succeeded', 'Today 12:00', '2m 38s'],
  ['fail', 'Failed — exit 1', 'Today 11:00', '0m 09s'],
  ['done', 'Succeeded', 'Today 10:00', '2m 52s'],
  ['wait', 'Skipped — previous run still going', 'Today 09:00', '—'],
  ['done', 'Succeeded', 'Today 08:00', '2m 44s'],
];

const NAV: Array<[id: string, label: string]> = [
  ['inbox', 'Inbox'],
  ['board', 'Board'],
  ['sessions', 'Sessions'],
  ['cron', 'Cron jobs'],
  ['memory', 'Memory'],
  ['settings', 'Settings'],
];

const ROW =
  'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--ui-ib-card-border)';
const NAV_BTN =
  'display:flex;width:100%;align-items:center;min-height:36px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--ui-ib-text);font:inherit;font-size:14px;text-align:left;cursor:pointer';

export const doc: ComponentDoc = {
  slug: 'drawer',
  name: 'Drawer',
  tag: 'ui-drawer',
  group: 'Primitives',
  summary:
    'A side panel for detail next to the work — docked beside the page when there is room, a sheet when there is not.',
  description:
    'A native <dialog> as a side panel. On wide screens (≥ dock-at, 840px) it docks beside the page: opened with show(), no scrim, the page stays live. Narrower, it is a modal sheet over a scrim (showModal(): focus trapped, page inert). Either way it slides in from its edge on the drawer curve (320ms) and leaves the same way; open it again mid-exit and it turns around. When the breakpoint is crossed while it is open it switches in place: the same dialog, its DOM and form state, focus and the caret, every scroll place in the panel — and the panel’s box morphs to the new mode in 320ms (retargeting if the window keeps moving) while the scrim fades; under reduced motion it switches at once. resizable adds a separator on the inner edge: drag it, or focus it and use the arrows. Escape, the scrim and the close button send a cancelable ui-close; show(), hide(), toggle() and open send nothing.',
  usedIn:
    'soma-work dashboard › session detail slide panel (docked beside the board under the top bar, resizable; a full sheet on phones) and the cron run drawer (right sheet).',
  reference: {
    name: 'WAI-ARIA APG Dialog (Modal) · Window Splitter',
    url: 'https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/',
  },
  props: [
    {
      name: 'open',
      type: 'boolean',
      description:
        'Attribute and property. Reflects the state (false from the moment a close starts). Setting it sends no event.',
    },
    { name: 'heading', type: 'string', description: 'Attribute. The title (an <h2>); the drawer is labelled by it.' },
    { name: 'label', type: 'string', description: 'Attribute. Accessible name when there is no heading.' },
    {
      name: 'mode',
      type: "'auto' | 'sheet' | 'dock'",
      default: "'auto'",
      description: 'Attribute. auto docks when the viewport is at least dock-at wide, else sheet.',
    },
    { name: 'dock-at', type: 'number', default: '840', description: 'Attribute. The auto-mode breakpoint in px.' },
    { name: 'side', type: "'right' | 'left'", default: "'right'", description: 'Attribute. The edge it slides from.' },
    {
      name: 'resizable',
      type: 'boolean',
      description: 'Attribute. A resize separator on the inner edge (hidden under 640px).',
    },
    {
      name: 'width',
      type: 'number',
      default: '480',
      description:
        'Attribute and property, px. Clamped to [min-width, min(max-width, viewport − 48)]; a resize writes it back. A sheet is never wider than the viewport.',
    },
    { name: 'min-width', type: 'number', default: '320', description: 'Attribute, px.' },
    { name: 'max-width', type: 'number', default: '960', description: 'Attribute, px.' },
    { name: 'hide-close', type: 'boolean', description: 'Attribute. No close button.' },
    {
      name: 'viewport',
      type: "'visual' | 'layout'",
      default: "'visual'",
      description:
        'Attribute. visual: while open the drawer box follows window.visualViewport in both modes, so the panel’s foot (a composer) stays above the iOS soft keyboard. layout: it does not.',
    },
    {
      name: 'lang',
      type: "'en' | 'ko'",
      default: "'en'",
      description: 'Attribute. Language of the close and resize labels.',
    },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the theme (attribute). Default follows prefers-color-scheme or page tokens.',
    },
    { name: 'docked', type: 'boolean', description: 'Read-only property: the effective mode is dock.' },
    {
      name: 'show() / hide() / toggle()',
      type: '() => void',
      description: 'Open, close (with the exit), or flip. No event.',
    },
    {
      name: '--ui-drawer-top',
      type: 'CSS length',
      default: '0px',
      description: 'Where a docked panel starts, e.g. under a 56px app bar. Sheets always take the full height.',
    },
    {
      name: '--ui-vv-h / --ui-vv-top',
      type: 'CSS length',
      default: '100dvh / 0px',
      description:
        'Height and top of the visible area. The element writes them while open (from window.visualViewport); with viewport="layout" a host may set them itself.',
    },
    {
      name: '--ui-drawer-z',
      type: 'CSS integer',
      default: '30',
      description: 'z-index of a docked panel (sheets are in the top layer).',
    },
    { name: 'slot (default)', type: 'content', description: 'The body. Scrolls under a fixed header and footer.' },
    { name: 'slot="header"', type: 'content', description: 'Replaces the heading text. Give the host a label then.' },
    { name: 'slot="footer"', type: 'content', description: 'Actions, end-aligned. Hidden while nothing is slotted.' },
  ],
  events: [
    {
      name: 'ui-close',
      detail: "{ reason: 'escape' | 'scrim' | 'close-button' }",
      description: 'The person asked to close. Cancelable: preventDefault() keeps it open; otherwise it closes.',
    },
    {
      name: 'ui-resize',
      detail: '{ width: number }',
      description:
        'The width changed by the separator: once at the end of a drag, after each arrow / Home / End step. A notification — not cancelable.',
    },
    {
      name: 'ui-mode-change',
      detail: "{ mode: 'sheet' | 'dock' }",
      description:
        'The effective mode flipped (breakpoint crossed, or mode / dock-at changed) — make room for a docked panel. A notification — not cancelable.',
    },
  ],
  keyboard: [
    ['Escape', 'Ask to close (in dock mode only while focus is in the drawer)'],
    ['Tab / Shift+Tab', 'Move through the drawer (trapped inside in sheet mode)'],
    ['← / → on the separator', 'Resize by 16px (Shift: 64px); the key toward the page widens'],
    ['Home / End on the separator', 'Narrowest / widest'],
  ],
  a11y: [
    'Sheet mode is a native modal <dialog> (page inert, focus trapped); dock mode is a non-modal <dialog> beside a live page.',
    'Labelled by its heading (aria-labelledby) or the label attribute (aria-label).',
    'On open, focus goes to the first [autofocus] element in your content, else the panel; after the close it returns to the opener — unless the person has moved on into the page (docked).',
    'The resize handle is role="separator" (aria-orientation vertical) with aria-valuenow / min / max, focusable, named “Resize panel” / “패널 크기 조절”.',
    'A mode switch while open keeps focus (and the caret) where it was and puts every scroll place in the panel back.',
    'Reduced motion: nothing slides — the panel and scrim fade in 120ms.',
    'Sound (opt-in, @2lab.ai/ui/sound): Escape, the scrim or the close button plays close unless ui-close is cancelled; show() / hide() / toggle() / open play open / close only inside a click or key press (never from a timer, never when it starts open). A mode switch and resizing are silent. Silent until the page turns sound on.',
  ],
  usage: `<button id="open-detail">Open detail</button>
<ui-drawer id="detail" heading="T-1842 · Fix the flaky upload test" resizable
  style="--ui-drawer-top: 56px">
  <dl class="ui-dl">…</dl>
  <button class="ui-btn is-primary" slot="footer">Resume</button>
</ui-drawer>
<script type="module">
  import '@2lab.ai/ui/drawer';
  const drawer = document.getElementById('detail');
  document.getElementById('open-detail').onclick = () => drawer.show();
  drawer.addEventListener('ui-resize', (e) => localStorage.setItem('detail-w', e.detail.width));
  drawer.addEventListener('ui-mode-change', (e) => board.classList.toggle('beside-drawer', e.detail.mode === 'dock'));
</script>`,
  demos: [
    {
      id: 'session',
      title: 'Session detail',
      description:
        'mode="auto" + resizable: docked under the top bar on a wide window (drag or arrow the left edge), a sheet on a narrow one — resize the window across 840px while it is open and it morphs in place. Either way it ends at the visible bottom, above a soft keyboard.',
      height: 200,
      create: () => {
        const { box, line } = stage();
        const open = trigger('Open T-1842');
        const el = drawer(
          { heading: 'T-1842 · Fix the flaky upload test', resizable: '' },
          `${FACTS([
            ['Model', 'Opus 5.5 (1M) · effort high'],
            ['Started', 'Today 14:02 · 38 min ago'],
            ['Tokens', '412,880 in · 18,204 out'],
            ['Cost', '$3.84'],
          ])}
<p style="margin:16px 0 0">Reproduced the timeout with the fixture server throttled to 2 MB/s (4 of 20 runs). The spec waits for the first upload response, but the client retries the first chunk after 10 s — the retry’s response is the one that arrives. Switching the wait to the page’s <code>upload:done</code> event; 50 throttled runs next.</p>
<button type="button" class="ui-btn" slot="footer" data-act="slack">Open in Slack</button>
<button type="button" class="ui-btn is-primary" slot="footer" data-act="resume">Resume</button>`,
        );
        open.addEventListener('click', () => el.toggle());
        echo(el, line);
        onAct(el, (act) => {
          line.textContent = act === 'resume' ? 'Resumed T-1842' : 'Opening the Slack thread…';
          if (act === 'resume') el.hide();
        });
        box.append(open, line, el);
        return box;
      },
    },
    {
      id: 'cron',
      title: 'Cron runs',
      description: 'mode="sheet": always modal over the scrim, at any width. Tone dots from ui-kit’s ui-status.',
      height: 200,
      create: () => {
        const { box, line } = stage();
        const open = trigger('Runs · nightly-digest');
        const rows = RUNS.map(
          ([tone, word, when, took]) =>
            `<li style="${ROW}"><span class="ui-status" data-tone="${tone}">${esc(word)}</span><span style="text-align:right;font-variant-numeric:tabular-nums;color:var(--ui-ib-muted)">${esc(when)} · ${esc(took)}</span></li>`,
        ).join('');
        const el = drawer(
          { heading: 'nightly-digest · runs', mode: 'sheet', width: '440' },
          `<p style="margin:0 0 8px">Every hour on the hour · next run 15:00.</p><ul style="margin:0;padding:0;list-style:none">${rows}</ul>`,
        );
        open.addEventListener('click', () => el.show());
        echo(el, line);
        box.append(open, line, el);
        return box;
      },
    },
    {
      id: 'nav',
      title: 'Left navigation',
      description: 'side="left" mode="sheet" width="300": a nav sheet; choosing a place closes it with hide().',
      height: 200,
      create: () => {
        const { box, line } = stage();
        const open = trigger('Menu');
        const items = NAV.map(
          ([id, label], i) =>
            `<li><button type="button" data-act="${id}" style="${NAV_BTN}"${i === 1 ? ' aria-current="page"' : ''}>${esc(label)}</button></li>`,
        ).join('');
        const el = drawer(
          { label: 'Navigation', side: 'left', mode: 'sheet', width: '300', 'min-width': '260' },
          `<nav aria-label="Main"><ul style="display:grid;gap:2px;margin:0;padding:0;list-style:none">${items}</ul></nav>`,
        );
        const mark = () => {
          for (const b of Array.from(el.querySelectorAll<HTMLElement>('[data-act]')))
            b.style.background = b.getAttribute('aria-current') ? 'var(--ui-ib-pill)' : 'transparent';
        };
        mark();
        onAct(el, (act, t) => {
          for (const b of Array.from(el.querySelectorAll('[data-act]'))) b.removeAttribute('aria-current');
          t.setAttribute('aria-current', 'page');
          mark();
          line.textContent = `Go to ${act}`;
          el.hide();
        });
        open.addEventListener('click', () => el.show());
        echo(el, line);
        box.append(open, line, el);
        return box;
      },
    },
    {
      id: 'ko',
      title: '한국어',
      description: '세션 상세 — 넓은 창에서는 상단 바 아래에 붙고, 좁은 창에서는 시트로 열립니다.',
      height: 200,
      create: () => {
        const { box, line } = stage();
        const open = trigger('세션 상세');
        const el = drawer(
          { lang: 'ko', heading: 'T-1842 · 업로드 테스트 간헐 실패 수정', resizable: '' },
          `${FACTS([
            ['모델', 'Opus 5.5 (1M) · effort high'],
            ['시작', '오늘 14:02 · 38분 전'],
            ['토큰', '입력 412,880 · 출력 18,204'],
            ['비용', '$3.84'],
          ])}
<p style="margin:16px 0 0">픽스처 서버를 2 MB/s로 제한해 타임아웃을 재현했습니다(20회 중 4회). 테스트는 첫 업로드 응답을 기다리지만, 클라이언트는 첫 청크가 10초를 넘기면 다시 보냅니다. 실제로 도착하는 건 재전송의 응답입니다. 대기 조건을 페이지의 <code>upload:done</code> 이벤트로 바꾸는 중입니다.</p>
<button type="button" class="ui-btn" slot="footer" data-act="slack">Slack에서 열기</button>
<button type="button" class="ui-btn is-primary" slot="footer" data-act="resume">재개</button>`,
        );
        open.addEventListener('click', () => el.toggle());
        echo(el, line, { close: '닫기 요청', resize: '너비', mode: '모드' });
        onAct(el, (act) => {
          line.textContent = act === 'resume' ? 'T-1842를 재개했어요' : 'Slack 스레드를 여는 중…';
          if (act === 'resume') el.hide();
        });
        box.append(open, line, el);
        return box;
      },
    },
  ],
};
