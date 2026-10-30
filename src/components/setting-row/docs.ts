import type { ComponentDoc } from '../../docs/types';
import { icon } from '../../icons/icons';
import '../segmented/segmented';
import './setting-row';
import type { UiSegmented } from '../segmented/segmented';
import type { SettingRowData, UiSettingRow } from './setting-row';

type Lang = 'en' | 'ko';

const COPY = {
  en: {
    on: 'On',
    off: 'Off',
    saved: (v: string) => `Saved — ${v}`,
    cmd: 'Command',
  },
  ko: {
    on: '켜짐',
    off: '꺼짐',
    saved: (v: string) => `저장했습니다 — ${v}`,
    cmd: '명령',
  },
};

function card(title: string, sub: string, rows: HTMLElement[], lang?: Lang): HTMLElement {
  const sec = document.createElement('section');
  sec.className = 'ui-card';
  sec.style.cssText = 'width:100%';
  if (lang) sec.lang = lang;
  const head = document.createElement('header');
  const h = document.createElement('h2');
  h.textContent = title;
  const p = document.createElement('p');
  p.textContent = sub;
  head.append(h, p);
  sec.append(head, ...rows);
  return sec;
}

function row(data: SettingRowData, control?: HTMLElement, lang?: Lang): UiSettingRow {
  const el = document.createElement('ui-setting-row');
  if (lang) el.setAttribute('lang', lang);
  if (control) el.append(control);
  el.data = data;
  return el;
}

function select(options: string[], value: string): HTMLSelectElement {
  const s = document.createElement('select');
  s.className = 'ui-input';
  for (const o of options) s.add(new Option(o, o, false, o === value));
  return s;
}

/** The kit switch. The state word is aria-hidden so the row's label names the switch (role="switch" says on / off). */
function toggle(on: boolean, lang: Lang = 'en'): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'ui-switch';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('role', 'switch');
  input.checked = on;
  const word = document.createElement('span');
  word.setAttribute('aria-hidden', 'true');
  word.textContent = on ? COPY[lang].on : COPY[lang].off;
  input.addEventListener('change', () => {
    word.textContent = input.checked ? COPY[lang].on : COPY[lang].off;
  });
  label.append(input, word);
  return label;
}

function segmented(label: string, options: string[], value: string): UiSegmented {
  const s = document.createElement('ui-segmented');
  s.data = { label, value, options: options.map((o) => ({ value: o, label: o })) };
  return s;
}

/** A stand-in save: Saving… for 700 ms, then Saved with the value (or the error `fail` returns). */
function save(el: UiSettingRow, value: string, patch: Partial<SettingRowData> = {}, fail?: () => string | null): void {
  const lang: Lang = el.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  el.data = { ...(el.data as SettingRowData), status: { state: 'pending' } };
  window.setTimeout(() => {
    const err = fail?.() ?? null;
    el.data = err
      ? { ...(el.data as SettingRowData), status: { state: 'error', text: err } }
      : { ...(el.data as SettingRowData), ...patch, status: { state: 'saved', text: COPY[lang].saved(value) } };
  }, 700);
}

/** The Models / Notifications card every demo shares, in either language. */
function preferences(lang: Lang = 'en'): HTMLElement {
  const ko = lang === 'ko';
  const c = COPY[lang];
  const MODELS = ['Sonnet', 'Opus', 'Haiku'];
  const EFFORT = ko ? ['낮음', '보통', '높음'] : ['Low', 'Medium', 'High'];

  const model = select(MODELS, 'Opus');
  const modelRow = row(
    {
      key: 'model',
      label: ko ? '기본 모델' : 'Default model',
      description: ko ? '새 대화를 시작할 때 쓰는 모델입니다.' : 'The model a new conversation starts with.',
      hints: [{ label: c.cmd, code: '/model' }],
      defaultText: 'Sonnet',
      modified: true,
      canReset: true,
    },
    model,
    lang,
  );
  model.addEventListener('change', () =>
    save(modelRow, model.value, { modified: model.value !== 'Sonnet', canReset: true }),
  );
  modelRow.addEventListener('ui-reset', () => {
    model.value = 'Sonnet';
    save(modelRow, 'Sonnet', { modified: false });
  });

  const effort = segmented(ko ? '추론 강도' : 'Reasoning effort', EFFORT, EFFORT[1]);
  const effortRow = row(
    {
      key: 'effort',
      label: ko ? '추론 강도' : 'Reasoning effort',
      description: ko
        ? '높을수록 더 오래 생각하고 더 많은 토큰을 씁니다.'
        : 'Higher effort thinks longer and spends more tokens.',
      hints: [{ label: c.cmd, code: '/effort' }],
      defaultText: EFFORT[1],
      canReset: true,
    },
    effort,
    lang,
  );
  effort.addEventListener('ui-change', (e) => {
    const v = (e as CustomEvent<{ value: string }>).detail.value;
    save(effortRow, v, { modified: v !== EFFORT[1] });
  });
  effortRow.addEventListener('ui-reset', () => {
    effort.data = { ...effort.data!, value: EFFORT[1] };
    save(effortRow, EFFORT[1], { modified: false });
  });

  const digest = toggle(true, lang);
  const digestRow = row(
    {
      key: 'digest',
      label: ko ? '일일 요약' : 'Daily digest',
      description: ko
        ? '매일 아침 지난 하루의 작업을 요약해 보냅니다.'
        : 'A summary of yesterday’s work, every morning.',
      defaultText: c.off,
      modified: true,
      canReset: true,
    },
    digest,
    lang,
  );
  const box = digest.querySelector('input')!;
  box.addEventListener('change', () => save(digestRow, box.checked ? c.on : c.off, { modified: box.checked }));
  digestRow.addEventListener('ui-reset', () => {
    box.checked = false;
    box.dispatchEvent(new Event('change'));
  });

  const approve = row(
    {
      key: 'autoApprove',
      label: ko ? '편집 자동 승인' : 'Auto-approve edits',
      description: ko ? '파일 편집을 묻지 않고 적용합니다.' : 'Apply file edits without asking first.',
      badge: ko ? '관리자' : 'Admin',
      locked: { value: c.off, reason: ko ? '워크스페이스 관리자가 정한 값입니다' : 'Set by your workspace admin' },
    },
    toggle(false, lang),
    lang,
  );

  return card(
    ko ? '모델과 알림' : 'Models and notifications',
    ko ? '선택하는 항목은 바로 저장됩니다.' : 'Choices save as soon as you make them.',
    [modelRow, effortRow, digestRow, approve],
    lang,
  );
}

function states(): HTMLElement {
  const time = document.createElement('input');
  time.className = 'ui-input';
  time.type = 'text';
  time.value = '9am';
  time.inputMode = 'numeric';
  time.style.width = '120px';
  time.setAttribute('aria-invalid', 'true');
  const timeRow = row(
    {
      key: 'digestTime',
      label: 'Digest time',
      description: 'When the daily digest arrives, in your time zone. Enter saves.',
      hints: ['24-hour clock'],
      defaultText: '09:00',
      status: { state: 'error', text: 'Use a time like 09:00' },
    },
    time,
  );
  time.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const ok = /^([01]\d|2[0-3]):[0-5]\d$/.test(time.value.trim());
    time.setAttribute('aria-invalid', String(!ok));
    save(timeRow, time.value.trim(), { modified: time.value.trim() !== '09:00', canReset: true }, () =>
      ok ? null : 'Use a time like 09:00',
    );
  });
  timeRow.addEventListener('ui-reset', () => {
    time.value = '09:00';
    time.setAttribute('aria-invalid', 'false');
    save(timeRow, '09:00', { modified: false });
  });

  const sound = select(['Chime', 'Pop', 'None'], 'Pop');
  const soundRow = row(
    {
      key: 'sound',
      label: 'Notification sound',
      description: 'Plays when a run finishes or needs you.',
      defaultText: 'Chime',
      modified: true,
      canReset: true,
      status: { state: 'pending' },
    },
    sound,
  );
  sound.addEventListener('change', () => save(soundRow, sound.value, { modified: sound.value !== 'Chime' }));
  soundRow.addEventListener('ui-reset', () => {
    sound.value = 'Chime';
    save(soundRow, 'Chime', { modified: false });
  });

  const theme = segmented('Theme', ['System', 'Light', 'Dark'], 'Dark');
  const themeRow = row(
    {
      key: 'theme',
      label: 'Theme',
      defaultText: 'System',
      modified: true,
      status: { state: 'saved', text: 'Saved — Dark' },
    },
    theme,
  );
  theme.addEventListener('ui-change', (e) => {
    const v = (e as CustomEvent<{ value: string }>).detail.value;
    save(themeRow, v, { modified: v !== 'System' });
  });

  return card('Save states', 'Saving…, Saved and an error — each row reports its own write.', [
    timeRow,
    soundRow,
    themeRow,
  ]);
}

function locked(): HTMLElement {
  const notice = document.createElement('div');
  notice.className = 'ui-notice';
  notice.dataset.tone = 'wait';
  notice.innerHTML = `${icon('info')}<span><strong>Read-only until approved.</strong> An admin has to accept your workspace before these settings can change.</span>`;
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:12px;width:100%';
  const tools = select(['Read and search', 'Read, search and edit', 'Everything'], 'Read and search');
  box.append(
    notice,
    card('Permissions', 'What the agent may do without asking.', [
      row({
        key: 'autoApprove',
        label: 'Auto-approve edits',
        description: 'Apply file edits without asking first.',
        badge: 'Admin',
        locked: { value: 'Off', reason: 'Set by your workspace admin' },
      }),
      row({
        key: 'retention',
        label: 'History retention',
        description: 'How long finished conversations are kept.',
        hints: [{ label: 'Command', code: '/retention' }],
        locked: { value: '30 days', reason: 'Your plan keeps history for 30 days' },
      }),
      row(
        {
          key: 'tools',
          label: 'Allowed tools',
          description: 'Tools the agent may call in this workspace.',
          badge: 'Admin',
          defaultText: 'Read and search',
          locked: { value: 'Read and search', reason: 'Read-only until an admin accepts your workspace' },
        },
        tools,
      ),
    ]),
  );
  return box;
}

export const doc: ComponentDoc = {
  slug: 'setting-row',
  name: 'Setting row',
  tag: 'ui-setting-row',
  group: 'Components',
  summary: 'What this setting does, what it is now, and whether the change was saved — one row.',
  description:
    'One preference in a settings card: a label, a description, quiet hints (the default value, the command that does the same thing), the control the host slots in (a kit input, select or switch, or a <ui-segmented>), and the result of the last write — Saving…, a check with Saved, or an alert with what went wrong. A value that differs from its default gets an ink dot before the label and, when the host allows it, a quiet Reset to default. A locked row hides the control and shows the value read-only with a lock and the reason. Rows stack inside a .ui-card with a hairline between them; at 560px of row width and up the description sits beside the control, below that above it.',
  usedIn:
    'soma-work › settings › preferences: every row of the preferences tab (.row / renderRow / renderControl / lockIfNotAccepted).',
  reference: {
    name: 'GOV.UK Design System — Summary list',
    url: 'https://design-system.service.gov.uk/components/summary-list/',
  },
  props: [
    {
      name: 'data.label',
      type: 'string',
      required: true,
      description: 'The setting’s name. Also names the slotted control when it has no name of its own.',
    },
    {
      name: 'data.key',
      type: 'string',
      description: 'Stable id: sent back in ui-reset and matched by applySettingsFilter.',
    },
    {
      name: 'data.description',
      type: 'string',
      description: 'One sentence under the label (also the control’s aria-description when it has none).',
    },
    {
      name: 'data.hints',
      type: 'Array<string | { label?: string; code: string }>',
      description: 'Quiet hints under the description; `code` is drawn in mono (a command).',
    },
    { name: 'data.defaultText', type: 'string', description: 'The default value as text — drawn as “Default: …”.' },
    {
      name: 'data.modified',
      type: 'boolean',
      description: 'The value differs from its default: an ink dot before the label and “Modified” for screen readers.',
    },
    { name: 'data.canReset', type: 'boolean', description: 'Show “Reset to default” while modified (sends ui-reset).' },
    { name: 'data.badge', type: 'string', description: 'A small neutral tag after the label (“Admin”).' },
    {
      name: 'data.status',
      type: "{ state: 'saved' | 'pending' | 'error'; text?: string } | null",
      description:
        'The last write: saved = check + “Saved” (role=status), pending = “Saving…” (role=status), error = alert + text (role=alert). Stays until the host clears it.',
    },
    {
      name: 'data.locked',
      type: '{ reason: string; value?: string } | null',
      description: 'Read-only: the control slot is not drawn; the value shows with a lock and the reason.',
    },
    {
      name: 'control',
      type: 'HTMLElement | null (read-only)',
      description: 'The first labelable element in the default slot — the one the row names.',
    },
    {
      name: 'lang',
      type: "'en' | 'ko'",
      default: "'en'",
      description: 'Attribute. Words the row draws (Default, Reset to default, Saved …).',
    },
    {
      name: 'data-first',
      type: 'boolean',
      description: 'Attribute. No top hairline (applySettingsFilter sets it on the first visible row of each card).',
    },
  ],
  events: [
    {
      name: 'ui-reset',
      detail: '{ key: string }',
      description:
        'The person pressed Reset to default. Write the default and send the new data (modified: false, a status).',
    },
  ],
  keyboard: [['Tab', 'The slotted control, then Reset to default when shown']],
  a11y: [
    'The label lives in the shadow root and cannot be a <label for> across it, so the first slotted control without a name of its own (no aria-label / labelledby, no <label> with words, no title) gets aria-label = label and aria-description = description. The row takes them off again when the label changes, the row locks or leaves the page, or the control is swapped — and never touches a name the host set.',
    'A switch whose <label> only says On / Off would be named “On”: mark that word aria-hidden="true" so the row names the switch (role="switch" already reads the state). <ui-segmented> names itself — pass data.label.',
    'Saved and Saving… are announced politely (role=status); an error is announced at once (role=alert). Each is an icon plus words, never colour alone.',
    'Modified is a dot (shape, not colour) plus “Modified” read after the label; Reset to default is named “Reset {label} to default”.',
    'Locked rows draw no control at all, so nothing unusable takes focus; the value and the reason are plain text.',
    'Reduced motion: status words appear without the rise.',
  ],
  usage: `<section class="ui-card">
  <header><h2>Models</h2><p>Choices save as soon as you make them.</p></header>
  <ui-setting-row id="model">
    <select class="ui-input"><option>Sonnet</option><option selected>Opus</option></select>
  </ui-setting-row>
</section>
<script type="module">
  import '@2lab.ai/ui/setting-row';
  const row = document.getElementById('model');
  row.data = { key: 'model', label: 'Default model', description: 'The model a new conversation starts with.',
    hints: [{ label: 'Command', code: '/model' }], defaultText: 'Sonnet', modified: true, canReset: true };
  row.querySelector('select').addEventListener('change', async (e) => {
    row.data = { ...row.data, status: { state: 'pending' } };
    const ok = await save('model', e.target.value);
    row.data = { ...row.data, modified: e.target.value !== 'Sonnet',
      status: ok ? { state: 'saved' } : { state: 'error', text: 'Couldn’t save — try again' } };
  });
  row.addEventListener('ui-reset', () => { /* write the default, then set data */ });
</script>`,
  demos: [
    {
      id: 'card',
      title: 'Preferences card',
      description:
        'Change a value: Saving…, then Saved. Default model and Daily digest differ from their defaults (the ink dot) and offer Reset to default. Auto-approve edits is locked by an admin.',
      height: 520,
      frame: false,
      create: () => preferences('en'),
    },
    {
      id: 'states',
      title: 'Save states',
      description:
        'An error (role=alert) on a typed value — fix it to 09:00 and press Enter; a write in flight; a saved choice. The words stay until the host clears them.',
      height: 440,
      frame: false,
      create: states,
    },
    {
      id: 'locked',
      title: 'Locked rows',
      description:
        'Read-only until approved: no control is drawn, the value shows with a lock and why. The banner is the kit .ui-notice.',
      height: 460,
      frame: false,
      create: locked,
    },
    {
      id: 'ko',
      title: 'Korean',
      description: 'lang="ko" on each row.',
      height: 520,
      frame: false,
      create: () => preferences('ko'),
    },
  ],
};
