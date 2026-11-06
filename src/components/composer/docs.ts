import type { ComponentDoc } from '../../docs/types';
import type { UiComposer } from './composer';
import './composer';
import type {
  ComposerData,
  ComposerModeDetail,
  ComposerRejectDetail,
  ComposerSubmitDetail,
  ComposerToolDetail,
} from './logic';
import type { ComposerSuggestDetail, ComposerTrigger } from './suggest';

function make(data: ComposerData, attrs: Record<string, string> = {}): UiComposer {
  const el = document.createElement('ui-composer');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

function frame(...children: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:grid;gap:18px;max-width:640px;margin:0 auto';
  box.append(...children);
  return box;
}

function statusLine(): HTMLElement {
  const p = document.createElement('p');
  p.style.cssText =
    'margin:0 2px;font-size:12.5px;line-height:1.45;opacity:.72;min-height:1.45em;font-variant-numeric:tabular-nums';
  return p;
}

/** Echo what the host would receive — nothing is sent anywhere. */
function echoSubmit(el: HTMLElement, line: HTMLElement, ko = false): void {
  el.addEventListener('ui-submit', (e) => {
    const { text, files } = (e as CustomEvent<ComposerSubmitDetail>).detail;
    const words = text ? `“${text.length > 60 ? `${text.slice(0, 59)}…` : text}”` : ko ? '(텍스트 없음)' : '(no text)';
    line.textContent = ko
      ? `ui-submit · ${words} · 파일 ${files.length}개`
      : `ui-submit · ${words} · ${files.length} file${files.length === 1 ? '' : 's'}`;
  });
}

/** A small PNG drawn on a canvas (a bar chart), so the demo has a real image thumbnail without the network. */
function chartPng(): File | null {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 120;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = 'whitesmoke';
  g.fillRect(0, 0, 160, 120);
  const bars = [38, 64, 52, 88, 72, 96];
  bars.forEach((h, i) => {
    g.fillStyle = i === bars.length - 1 ? 'dimgray' : 'darkgray';
    g.fillRect(14 + i * 23, 108 - h, 15, h);
  });
  try {
    const url = c.toDataURL('image/png');
    const bin = atob(url.slice(url.indexOf(',') + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.length ? new File([bytes], 'weekly-signups.png', { type: 'image/png' }) : null;
  } catch {
    return null;
  }
}

/** A 1.2 s, 8 kHz mono WAV (a soft 440 Hz tone) built in memory: an audio chip with a working play button. */
function toneWav(): File {
  const rate = 8000;
  const n = 9600;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const tag = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++) v.setUint8(at + i, text.charCodeAt(i));
  };
  tag(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true); // bytes per second (8-bit mono)
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  tag(36, 'data');
  v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) {
    const fade = Math.min(1, i / 400, (n - i) / 400);
    v.setUint8(44 + i, 128 + Math.round(40 * fade * Math.sin((2 * Math.PI * 440 * i) / rate)));
  }
  return new File([buf], 'standup-memo.wav', { type: 'audio/wav' });
}

/** Real File objects made offline: a canvas PNG, a PDF-shaped blob, a WAV and a text file. */
function demoFiles(): File[] {
  const head = '%PDF-1.7\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n';
  const report = new File([head, new Uint8Array(186_400 - head.length), '\n%%EOF\n'], 'q3-report.pdf', {
    type: 'application/pdf',
  });
  const notes = new File(
    ['Release checklist\n- Freeze the branch\n- Run the migration on staging\n- Announce the window\n'],
    'release-notes.txt',
    { type: 'text/plain' },
  );
  const png = chartPng();
  return [...(png ? [png] : []), report, toneWav(), notes];
}

const NEW_TASK: ComposerData = {
  placeholder: 'What do you want done? Describe the task, drop files or record a voice note.',
  label: 'Task',
  hint: true,
  submitLabel: 'Start task',
  minRows: 3,
  // A long instruction: Enter is a new line, ⌘/Ctrl+Enter starts the task.
  enter: 'newline',
};

/** A command list and a skill list, the shape soma-work's dashboard sends (realistic rows, no network). */
const TRIGGERS: ComposerTrigger[] = [
  {
    char: '/',
    at: 'start',
    label: 'Commands',
    items: [
      {
        value: '/new',
        description: 'Start a fresh session in this thread',
        example: '/new fix the flaky login test',
        group: 'Session',
      },
      { value: '/model', description: 'Show or switch the model', example: '/model opus', group: 'Session' },
      { value: '/effort', description: 'Show or set the thinking effort', example: '/effort high', group: 'Session' },
      {
        value: '/compact',
        description: 'Summarise the conversation to free the context',
        example: '/compact',
        group: 'Context',
      },
      { value: '/cwd', description: 'Show the working folder', example: '/cwd', group: 'Context' },
      { value: '/help', description: 'Every command, with what it does', example: '/help', group: 'Help' },
    ],
  },
  {
    char: '$',
    label: 'Skills',
    items: [
      { value: '$local:autoz', description: 'Drive the whole pipeline on its own, no questions', group: 'Built-in' },
      {
        value: '$local:zcheck',
        description: 'Post-implementation gate: CI, review comments, coverage',
        group: 'Built-in',
      },
      { value: '$stv:debug', description: 'Follow the callstack to the cause of a bug', group: 'stv' },
      { value: '$user:dev', description: 'Deploy to the dev environment', group: 'Mine' },
    ],
  },
];

export const doc: ComponentDoc = {
  slug: 'composer',
  name: 'Composer',
  tag: 'ui-composer',
  group: 'Components',
  summary: 'What do you want to say? — write it, drop in files or a voice note, and send.',
  description:
    'One calm field card for a message: the text grows with its content, files come in by picker, paste or drop and show as chips (image thumbnails, a play button for voice notes), a voice recorder takes the toolbar row with a live level meter, and the ink send button hands the host the text and the File objects. Limits reject with an inline error. The element never touches the network, and nothing re-renders while someone types, so focus, selection and an IME composition survive host updates.',
  usedIn:
    'soma-work dashboard › New task dialog (H-02…H-09) and the session panel composer (E-30: slot tools, attachments, recorder, drag state)',
  reference: {
    name: 'MDN — MediaStream Recording API',
    url: 'https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API',
  },
  props: [
    {
      name: 'data.value',
      type: 'string',
      description:
        'Fills the field (a restored draft, a resend). Applied when it differs from the value applied last — not on every render, so host updates never reset what is being typed. Use the `value` property to set the same text again.',
    },
    { name: 'data.placeholder', type: 'string', default: '“Write a message…”', description: 'Field placeholder.' },
    { name: 'data.label', type: 'string', default: '“Message”', description: 'The field’s accessible name.' },
    {
      name: 'data.busy',
      type: 'boolean',
      default: 'false',
      description: 'Sending: the send button spins (0.9s, aria-busy) and is off; the text stays editable.',
    },
    {
      name: 'data.disabled',
      type: 'boolean | string',
      default: 'false',
      description:
        'Read-only: the field is readonly, tools, chip removal and send are off, paste / drop are ignored, a recording is discarded. A string is the reason, shown quietly under the card and linked to the field.',
    },
    {
      name: 'data.maxLength',
      type: 'number',
      description:
        'Character limit (UTF-16 units, like `maxlength`). Shows a “120 / 4,000” counter: warn tone from 90 %; past the limit the counter turns red and send is off (a soft limit — nothing is cut).',
    },
    {
      name: 'data.accept',
      type: 'string',
      default: 'any',
      description:
        'File types taken, in `accept` syntax (`.pdf`, `image/*`, `text/plain`). Applies to every path: picker, paste, drop, addFiles().',
    },
    { name: 'data.maxFiles', type: 'number', default: '10', description: 'Attachments at most (a voice note counts).' },
    { name: 'data.maxFileSize', type: 'number', default: '26214400 (25 MB)', description: 'Bytes per file.' },
    {
      name: 'data.maxTotalBytes',
      type: 'number',
      description:
        'Bytes all attachments may take together (your server’s request cap, a voice note included). A file that would cross it sends the cancelable ui-over-cap; unless you prevent it, the file is rejected (ui-reject, reason total) and the error line says “Too large together (max 30 MB in all)”. Default: no cap.',
    },
    {
      name: 'data.attach / data.image / data.voice',
      type: 'boolean',
      default: 'true',
      description:
        'Built-in tools: file picker, image picker (`accept="image/*"`), voice recorder. Voice is hidden where getUserMedia or MediaRecorder is missing.',
    },
    {
      name: 'data.camera',
      type: "boolean | 'environment' | 'user'",
      default: 'false',
      description:
        'A camera tool on touch screens: takes a photo with the back camera (true / environment) or the front one (user) through capture, and attaches it like the image tool. Hidden on fine pointers, where the image picker covers it.',
    },
    {
      name: 'data.progress',
      type: 'number (0–1)',
      description:
        'Upload progress while you send (with busy): a thin ink line above the toolbar, role="progressbar" named “Uploading”. Leave it unset when nothing is uploading.',
    },
    {
      name: 'fill',
      type: 'boolean attribute',
      description:
        'The card takes the composer’s height — give the host one (flex: 1 in a phone sheet): the field grows into it and the toolbar sits at the bottom; maxRows no longer caps the field.',
    },
    {
      name: 'slot="end"',
      type: 'content',
      description:
        'The host’s own controls on the composer’s row (0.36.0): a light-DOM child with `slot="end"` sits first on the row’s end — before the hint, the counter, the mode switch and Send — and, while a voice note records, before Cancel and Done, so it never leaves the row. It shrinks before the composer’s own items (give it `min-width: 0` and let its text truncate). Its clicks, keys and pastes are its own: they never send, never move the caret, never end a recording (Esc on it is its own) and never attach a pasted file. A session’s model picker goes here.',
    },
    {
      name: 'data.maxRecordMs',
      type: 'number',
      default: '600000 (10 min)',
      description: 'A recording stops and is kept at this length.',
    },
    {
      name: 'data.tools',
      type: 'Array<{ id; label; icon?; showLabel?; pressed?; disabled? }>',
      description:
        'Extra host tools after the built-in ones → `ui-tool`. With `pressed` (boolean) the tool is a toggle (aria-pressed, the raised chip when on); without an icon, or with `showLabel`, the label shows as text.',
    },
    {
      name: 'data.submitLabel',
      type: 'string',
      description:
        'Text on the send button (e.g. “Start task”, with an arrow). Without it the button is a 32px ink arrow-up icon named “Send”.',
    },
    {
      name: 'data.mode',
      type: '{ id; label; on; text?; submitLabel?; disabled? }',
      description:
        'A switch right beside the send button that changes what sending does (“Plan first”), drawn as day and night: off is the sun on a warm track, on is the moon on a night track with two stars. While it is on the send button takes the night colour and `mode.submitLabel` (unset: `submitLabel`; empty: the arrow alone). A press flips it at once → `ui-mode`. The night entrance (the label rising, one light sweep, a soft ring) plays only after a flip, never on first paint. `text` hides on cards under 400px; `label` always names the switch, so start it with `text`.',
    },
    {
      name: 'data.hint',
      type: 'boolean',
      default: 'false',
      description:
        '“Enter to send · Shift+Enter for a new line” in the toolbar (hidden on touch and narrow cards); in newline mode “⌘+Enter to send · Enter for a new line” (Ctrl off Apple keyboards).',
    },
    {
      name: 'data.enter · enter',
      type: "'send' | 'newline'",
      default: "'send'",
      description:
        'What a plain Enter does. send — Enter sends, Shift+Enter is a new line. newline — for long instructions: Enter (and Shift+Enter) is a new line, ⌘/Ctrl+Enter sends. The enter attribute wins over data.enter; el.enter reads the mode in force.',
    },
    {
      name: 'data.triggers',
      type: "Array<{ char; at?: 'start' | 'word'; label?; items: Array<{ value; label?; description?; example?; group?; keywords? }> }>",
      description:
        'Menus a character opens: `/` for commands (`at: start` — only as the first thing in the message), `$` for skills (`at: word`, the default — at the start of any word). Each row shows its name, one line on what it does and a typical use in grey; rows group under `group` while nothing is typed after the character. The text after it filters: a name that starts with it first, then a part of a name (`autoz` finds `$local:autoz`), then names that contain it, aliases (`keywords`) and descriptions. Nothing matching closes the menu. Picking puts `value` and a space in place of the token → `ui-suggest`.',
    },
    {
      name: 'data.minRows / data.maxRows',
      type: 'number',
      default: '2 / 10',
      description: 'Autosize bounds in rows; past maxRows the field scrolls.',
    },
    {
      name: 'value',
      type: 'string',
      description: 'Property: the field’s text (get / set; setting sends no ui-input).',
    },
    { name: 'files', type: 'File[]', description: 'Property (read-only): the attached files, a copy.' },
    {
      name: 'addFiles(list) / removeFile(index) / clear() / focus()',
      type: 'methods',
      description:
        'Attach files (checked against the limits; returns the ones taken), remove one (its object URL is revoked), empty everything (text, files, error, a recording), focus the field.',
    },
    {
      name: 'pause() / cancelRecording()',
      type: 'methods',
      description:
        'Stop a voice note’s preview (no event) — done for you when the composer is disabled, hidden (a closed sheet, display: none) or removed. Discard a recording in progress or a pending microphone prompt (ui-record cancel) while the text and files stay — call both when your sheet closes.',
    },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'UI language (attribute).' },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the theme (attribute). Default follows prefers-color-scheme or page tokens.',
    },
  ],
  events: [
    {
      name: 'ui-submit',
      detail: '{ text: string; files: File[] }',
      description:
        'Enter, ⌘/Ctrl+Enter or the send button with something to send. `text` is trimmed at both ends (inner spaces and new lines kept). Cancelable: unless prevented the composer clears (text + files, URLs revoked) and keeps focus in the field. To keep the draft until your request succeeds, call preventDefault() and later clear(). Sending while recording files the recording first, then submits.',
    },
    {
      name: 'ui-input',
      detail: '{ value: string }',
      description:
        'The text changed by typing, or by the composer itself (cleared after a send, clear()). Not debounced — save drafts from it directly. Not sent for `value` / `data.value` sets.',
    },
    {
      name: 'ui-files',
      detail: '{ files: File[] }',
      description: 'The attachments changed (added, removed, cleared).',
    },
    {
      name: 'ui-reject',
      detail: "{ name: string; reason: 'count' | 'size' | 'type' | 'empty' | 'total'; file: File }",
      description: 'One per file that was not attached; the error line says why (role="alert").',
    },
    {
      name: 'ui-over-cap',
      detail: '{ name: string; file: File; size: number; total: number; max: number }',
      description:
        'This file would take the attachments past maxTotalBytes (total = bytes already attached, this batch’s earlier files included). Cancelable: preventDefault() takes it anyway — you will compress it, or upload it apart. Otherwise it is rejected with reason total.',
    },
    {
      name: 'ui-record',
      detail: "{ state: 'start' | 'stop' | 'cancel' | 'error'; error?: string; file?: File; durationMs?: number }",
      description:
        '`start` when recording begins; `stop` with the attached voice note; `cancel` when discarded (Cancel, Esc, clear, disconnect); `error` when the microphone is denied or missing (the DOMException name).',
    },
    {
      name: 'ui-tool',
      detail: '{ id: string; pressed?: boolean }',
      description:
        'A host tool was pressed. For toggles `pressed` is the state asked for and the chip flips at once; preventDefault() keeps it as it was. The local flip lasts until `data.tools` changes.',
    },
    {
      name: 'ui-mode',
      detail: '{ id: string; on: boolean }',
      description:
        'The mode switch was pressed; `on` is the state asked for. It flips at once (switch, send label, night); preventDefault() keeps it as it was. The local flip lasts until `data.mode` changes — answer with a new `data.mode`.',
    },
    {
      name: 'ui-suggest',
      detail: '{ char: string; value: string; query: string }',
      description:
        'A row of a trigger menu was picked (Enter, Tab or a click); `query` is what had been typed after the character. Cancelable: unless prevented the composer puts `value` and a space in place of the token (ui-input follows) — prevent it to act on the pick yourself.',
    },
  ],
  keyboard: [
    ['Space / Enter on the mode switch', 'Flip it (a native button with role="switch")'],
    ['Enter', 'Send (desktop); a new line with enter="newline". Never during an IME composition'],
    ['Shift+Enter / Alt+Enter', 'New line'],
    ['⌘/Ctrl+Enter', 'Send (also on touch screens)'],
    ['Enter on a touch screen', 'New line — the send button sends'],
    ['/ (first thing) · $ (start of a word)', 'Open the trigger menu (data.triggers); typing filters it'],
    ['↑ / ↓ (menu open)', 'Move the active row (wraps)'],
    [
      'Enter / Tab (menu open)',
      'Pick the active row. Enter on a name already typed in full sends (or is a new line) as usual',
    ],
    ['Esc (menu open)', 'Close the menu; it stays closed until the text changes'],
    ['Esc (while recording)', 'Discard the recording'],
    ['Tab', 'Field → chip buttons (play, remove) → tools → slot="end" → mode → send'],
  ],
  a11y: [
    'The textarea has an accessible name (data.label, default “Message”) and is described by the counter, hint, disabled reason and error line.',
    'Icon-only buttons carry aria-label and a tooltip; remove buttons say “Remove {name}”; a voice note’s play button says Play / Stop {name}.',
    'The error line is role="alert"; attaching and removing files is announced in a polite status region that the patched markup never re-creates.',
    'Send uses aria-disabled (it stays in the tab order) and aria-busy while busy; host toggles use aria-pressed.',
    'The mode switch is a button with role="switch" and aria-checked, named by data.mode.label (also its tooltip); its short text is aria-hidden, so the name holds when narrow cards hide it. Day and night differ in position and glyph, not colour alone.',
    'A control in slot="end" keeps its own name and keys; it is in the row’s tab order before the mode switch and Send.',
    'Recording moves focus to Done; the recorder row is a group named “Recording” with a role="timer" clock; ending it returns focus to the field.',
    'Touch: every control is 44px under (pointer: coarse); the field uses 16px text so iOS does not zoom. The camera tool (data.camera) shows only there.',
    'Upload progress (data.progress) is a role="progressbar" named “Uploading” with aria-valuenow in percent.',
    'Trigger menus: the field carries aria-autocomplete="list", aria-expanded, aria-controls and aria-activedescendant (focus never leaves the field); the list is a role="listbox" named by the trigger’s label, its rows role="option" with aria-selected, grouped in role="group" sections; the number of matches is announced in the polite status region. Pressing a row never takes focus from the field.',
    'Reduced motion: chip, error and recorder enters switch at once; the drop wash keeps a short fade; the send spinner keeps turning.',
    'Sound (opt-in, @2lab.ai/ui/sound): sending taps once ui-submit is not prevented; a tool plays select (a toggle tool toggle, by its new state); the mode switch plays toggle by its new state; starting a voice note taps, Done taps subtly, Cancel or Esc closes subtly; removing an attachment closes subtly and a refused file plays a subtle error; picking a trigger-menu row plays select; keystrokes play type while typing sounds are on. Silent until the page turns sound on.',
  ],
  usage: `<ui-composer></ui-composer>
<script type="module">
  import '@2lab.ai/ui/composer';
  const el = document.querySelector('ui-composer');
  el.data = { placeholder: 'What do you want done?', hint: true, maxLength: 4000, value: localStorage.draft ?? '' };
  el.addEventListener('ui-input', (e) => { localStorage.draft = e.detail.value; });
  el.addEventListener('ui-submit', async (e) => {
    e.preventDefault(); // keep the draft until the request succeeds
    const { text, files } = e.detail;
    const body = new FormData();
    body.append('text', text);
    for (const f of files) body.append('files', f, f.name);
    el.data = { ...el.data, busy: true };
    try {
      const res = await fetch('/api/messages', { method: 'POST', body });
      if (res.ok) el.clear();
    } finally {
      el.data = { ...el.data, busy: false };
    }
  });
</script>`,
  demos: [
    {
      id: 'new-task',
      title: 'New task',
      description:
        'Placeholder, key hint, attach / image / voice and a labelled send. enter: newline — the instruction is long, so Enter is a new line and ⌘/Ctrl+Enter starts the task. The line below echoes ui-submit — nothing is sent.',
      height: 300,
      create: () => {
        const el = make(NEW_TASK);
        const line = statusLine();
        echoSubmit(el, line);
        return frame(el, line);
      },
    },
    {
      id: 'attachments',
      title: 'With attachments',
      description:
        'Pre-filled with addFiles(): a canvas PNG (thumbnail), a PDF, a WAV (play button) and a text file — all made in the page. Paste or drop more; remove with ×.',
      height: 300,
      create: () => {
        const el = make({ value: 'Summarise the report and flag anything unusual in the chart.', hint: true });
        el.addFiles(demoFiles());
        const line = statusLine();
        echoSubmit(el, line);
        return frame(el, line);
      },
    },
    {
      id: 'end-slot',
      title: 'A control on the row (slot end)',
      description:
        'The host slots its own control into slot="end" — here a model chip — and it sits left of Send on the composer’s row. Narrow the frame: the chip truncates before Send moves. Start a voice note: the chip stays on the row, before Cancel and Done.',
      height: 220,
      create: () => {
        const el = make({ placeholder: 'Steer the session…', minRows: 1 });
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.slot = 'end';
        chip.className = 'ui-chip';
        chip.style.cssText = 'min-width:0;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis';
        chip.textContent = 'Opus 5.5 (1M) · Extra high';
        chip.setAttribute('aria-label', 'Model: Opus 5.5 (1M), effort Extra high');
        el.append(chip);
        const line = statusLine();
        echoSubmit(el, line);
        return frame(el, line);
      },
    },
    {
      id: 'busy-disabled',
      title: 'Busy & disabled',
      description:
        'busy with progress: 0.64 — the send spins, a thin line shows the upload, the text stays editable. disabled with a reason: read-only.',
      height: 340,
      create: () =>
        frame(
          make({ value: 'Draft the migration plan for the billing tables.', busy: true, progress: 0.64, minRows: 1 }),
          make({
            value: 'Rerun the nightly import with the new mapping.',
            disabled: 'This conversation has ended — start a new one to continue.',
            minRows: 1,
          }),
        ),
    },
    {
      id: 'host-tools',
      title: 'Host tools',
      description:
        'Two extra tools: a “Plan first” toggle (the host owns pressed) and a “Pick a model” action; a 2,000-character counter.',
      height: 300,
      create: () => {
        const el = make({
          placeholder: 'Ask for a change…',
          maxLength: 2000,
          tools: [
            { id: 'plan', label: 'Plan first', icon: 'list', showLabel: true, pressed: true },
            { id: 'model', label: 'Pick a model', icon: 'bot' },
          ],
        });
        const line = statusLine();
        el.addEventListener('ui-tool', (e) => {
          const { id, pressed } = (e as CustomEvent<ComposerToolDetail>).detail;
          const d = el.data ?? {};
          if (id === 'plan') {
            el.data = { ...d, tools: (d.tools ?? []).map((t) => (t.id === 'plan' ? { ...t, pressed: !!pressed } : t)) };
            line.textContent = `ui-tool · plan → ${pressed ? 'on' : 'off'}`;
          } else line.textContent = 'ui-tool · model — a model picker would open here';
        });
        echoSubmit(el, line);
        return frame(el, line);
      },
    },
    {
      id: 'mode',
      title: 'Mode switch — plan first',
      description:
        'data.mode beside the send button: day (off) sends “Start task”; flip it and night falls — the moon turns in, two stars come out, and the send button goes night with “Start plan” rising into place. The host answers ui-mode with a new data.mode.',
      height: 300,
      create: () => {
        const el = make({
          ...NEW_TASK,
          mode: { id: 'plan', label: 'Plan first', text: 'Plan', on: false, submitLabel: 'Start plan' },
        });
        const line = statusLine();
        el.addEventListener('ui-mode', (e) => {
          const { on } = (e as CustomEvent<ComposerModeDetail>).detail;
          const d = el.data ?? {};
          if (d.mode) el.data = { ...d, mode: { ...d.mode, on } };
          line.textContent = `ui-mode · plan → ${on ? 'on (Start plan)' : 'off (Start task)'}`;
        });
        echoSubmit(el, line);
        return frame(el, line);
      },
    },
    {
      id: 'triggers',
      title: 'Commands (/) and skills ($)',
      description:
        'Type / at the start for commands, or $ anywhere a word starts for skills: each row has what it does and, for commands, a typical use in grey. ↑↓ move, Enter or Tab picks, Esc closes. The line echoes ui-suggest.',
      height: 460,
      create: () => {
        const el = make({
          placeholder: 'Type / for commands, $ for skills…',
          hint: true,
          triggers: TRIGGERS,
          minRows: 3,
        });
        const line = statusLine();
        el.addEventListener('ui-suggest', (e) => {
          const { value, query } = (e as CustomEvent<ComposerSuggestDetail>).detail;
          line.textContent = `ui-suggest · ${value}${query ? ` (typed “${query}”)` : ''}`;
        });
        echoSubmit(el, line);
        const box = frame(el, line);
        box.style.paddingTop = '300px';
        return box;
      },
    },
    {
      id: 'limits',
      title: 'Limits',
      description:
        'accept="image/*,.pdf", at most 3 files of 2 MB, 3 MB together (maxTotalBytes). Drop something else, a fourth file, or two big ones, to see ui-over-cap, ui-reject and the error line.',
      height: 280,
      create: () => {
        const el = make({
          accept: 'image/*,.pdf',
          maxFiles: 3,
          maxFileSize: 2 * 1024 * 1024,
          maxTotalBytes: 3 * 1024 * 1024,
          voice: false,
        });
        const line = statusLine();
        el.addEventListener('ui-reject', (e) => {
          const { name, reason } = (e as CustomEvent<ComposerRejectDetail>).detail;
          line.textContent = `ui-reject · ${name} · ${reason}`;
        });
        return frame(el, line);
      },
    },
    {
      id: 'ko',
      title: '한국어 (lang="ko")',
      height: 300,
      create: () => {
        const el = make(
          {
            placeholder: '무엇을 할까요? 할 일을 쓰거나 파일을 끌어다 놓으세요.',
            hint: true,
            maxLength: 4000,
            submitLabel: '작업 시작',
            mode: { id: 'plan', label: '계획 먼저', text: '계획', on: true, submitLabel: '계획 시작' },
          },
          { lang: 'ko' },
        );
        const line = statusLine();
        echoSubmit(el, line, true);
        return frame(el, line);
      },
    },
  ],
};
