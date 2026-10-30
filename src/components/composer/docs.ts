import type { ComponentDoc } from '../../docs/types';
import type { UiComposer } from './composer';
import './composer';
import type { ComposerData, ComposerRejectDetail, ComposerSubmitDetail, ComposerToolDetail } from './logic';

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
};

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
      name: 'data.attach / data.image / data.voice',
      type: 'boolean',
      default: 'true',
      description:
        'Built-in tools: file picker, image picker (`accept="image/*"`), voice recorder. Voice is hidden where getUserMedia or MediaRecorder is missing.',
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
      name: 'data.hint',
      type: 'boolean',
      default: 'false',
      description: '“Enter to send · Shift+Enter for a new line” in the toolbar (hidden on touch and narrow cards).',
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
      detail: "{ name: string; reason: 'count' | 'size' | 'type' | 'empty'; file: File }",
      description: 'One per file that was not attached; the error line says why (role="alert").',
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
  ],
  keyboard: [
    ['Enter', 'Send (desktop). Never during an IME composition'],
    ['Shift+Enter / Alt+Enter', 'New line'],
    ['⌘/Ctrl+Enter', 'Send (also on touch screens)'],
    ['Enter on a touch screen', 'New line — the send button sends'],
    ['Esc (while recording)', 'Discard the recording'],
    ['Tab', 'Field → chip buttons (play, remove) → tools → send'],
  ],
  a11y: [
    'The textarea has an accessible name (data.label, default “Message”) and is described by the counter, hint, disabled reason and error line.',
    'Icon-only buttons carry aria-label and a tooltip; remove buttons say “Remove {name}”; a voice note’s play button says Play / Stop {name}.',
    'The error line is role="alert"; attaching and removing files is announced in a polite status region that the patched markup never re-creates.',
    'Send uses aria-disabled (it stays in the tab order) and aria-busy while busy; host toggles use aria-pressed.',
    'Recording moves focus to Done; the recorder row is a group named “Recording” with a role="timer" clock; ending it returns focus to the field.',
    'Touch: every control is 44px under (pointer: coarse); the field uses 16px text so iOS does not zoom.',
    'Reduced motion: chip, error and recorder enters switch at once; the drop wash keeps a short fade; the send spinner keeps turning.',
    'Sound (opt-in, @2lab.ai/ui/sound): sending taps once ui-submit is not prevented; a tool plays select (a toggle tool toggle, by its new state); starting a voice note taps, Done taps subtly, Cancel or Esc closes subtly; removing an attachment closes subtly and a refused file plays a subtle error; keystrokes play type while typing sounds are on. Silent until the page turns sound on.',
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
        'Placeholder, key hint, attach / image / voice and a labelled send. The line below echoes ui-submit — nothing is sent.',
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
      id: 'busy-disabled',
      title: 'Busy & disabled',
      description: 'busy: the send spins and the text stays editable. disabled with a reason: read-only.',
      height: 340,
      create: () =>
        frame(
          make({ value: 'Draft the migration plan for the billing tables.', busy: true, minRows: 1 }),
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
      id: 'limits',
      title: 'Limits',
      description:
        'accept="image/*,.pdf", at most 3 files of 2 MB. Drop something else, or a fourth file, to see ui-reject and the error line.',
      height: 280,
      create: () => {
        const el = make({ accept: 'image/*,.pdf', maxFiles: 3, maxFileSize: 2 * 1024 * 1024, voice: false });
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
            tools: [{ id: 'plan', label: '계획 먼저', icon: 'list', showLabel: true, pressed: false }],
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
