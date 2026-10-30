import type { ComponentDoc } from '../../docs/types';
import { icon } from '../../icons/icons';
import '../segmented/segmented';
import '../setting-row/setting-row';
import './settings-nav';
import type { UiSegmented } from '../segmented/segmented';
import type { SettingHint, SettingRowData, SettingRowLock, UiSettingRow } from '../setting-row/setting-row';
import { applySettingsFilter, type SettingsFilter, settingMatches, settingRowText } from './filter';
import type { SettingsFilterDetail, SettingsNavSection, UiSettingsNav } from './settings-nav';

type Lang = 'en' | 'ko';

/** Ids are unique per demo instance: a page may show the same demo twice (thumbnails, replays). */
let uid = 0;

/** One setting of the demo page. `value` / `def` are what the control shows (option label or On / Off). */
interface RowSpec {
  key: string;
  label: string;
  description?: string;
  hints?: SettingHint[];
  kind: 'select' | 'switch' | 'segmented' | 'text';
  options?: string[];
  def: string;
  value: string;
  badge?: string;
  locked?: SettingRowLock;
  /** A stand-in check for typed values: the error text, or null when fine. */
  check?: (v: string) => string | null;
  /** How a valid typed value is written back (“8000” → “8,000”). */
  format?: (v: string) => string;
  /** The first write fails (the server did not answer), the next one goes through. */
  flaky?: boolean;
}

interface SectionSpec {
  id: string;
  title: string;
  sub: string;
  rows: RowSpec[];
}

const COPY = {
  en: {
    on: 'On',
    off: 'Off',
    cmd: 'Command',
    saved: (v: string) => `Saved — ${v}`,
    timeout: 'Couldn’t save — the server didn’t answer. Try again.',
    noMatch: (q: string) => (q ? `No settings match “${q}”` : 'No modified settings'),
    noMatchHint: 'Try another word, or turn off Modified only.',
    pageLabel: 'Settings',
  },
  ko: {
    on: '켜짐',
    off: '꺼짐',
    cmd: '명령',
    saved: (v: string) => `저장했습니다 — ${v}`,
    timeout: '저장하지 못했습니다 — 서버가 응답하지 않습니다. 다시 시도해 주세요.',
    noMatch: (q: string) => (q ? `“${q}”에 맞는 설정이 없습니다` : '바꾼 설정이 없습니다'),
    noMatchHint: '다른 단어로 찾거나 ‘바꾼 것만’을 꺼 보세요.',
    pageLabel: '설정',
  },
};

function sections(lang: Lang): SectionSpec[] {
  const ko = lang === 'ko';
  const c = COPY[lang];
  const time = (v: string) =>
    /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? null : ko ? '09:00처럼 입력해 주세요' : 'Use a time like 09:00';
  const tokens = (v: string) => {
    const n = Number(v.replace(/[,\s]/g, ''));
    return Number.isInteger(n) && n >= 1000 && n <= 64000
      ? null
      : ko
        ? '1,000에서 64,000 사이의 수를 넣어 주세요'
        : 'Use a number from 1,000 to 64,000';
  };
  return [
    {
      id: 'general',
      title: ko ? '일반' : 'General',
      sub: ko ? '앱의 모양과 말투입니다.' : 'How the app looks and talks to you.',
      rows: [
        {
          key: 'language',
          label: ko ? '언어' : 'Language',
          description: ko ? '메뉴와 메시지의 언어입니다.' : 'The language of menus and messages.',
          kind: 'select',
          options: ko ? ['영어', '한국어', '일본어'] : ['English', 'Korean', 'Japanese'],
          def: ko ? '영어' : 'English',
          value: ko ? '한국어' : 'English',
        },
        {
          key: 'theme',
          label: ko ? '테마' : 'Theme',
          kind: 'segmented',
          options: ko ? ['시스템', '라이트', '다크'] : ['System', 'Light', 'Dark'],
          def: ko ? '시스템' : 'System',
          value: ko ? '다크' : 'Dark',
        },
        {
          key: 'clock',
          label: ko ? '24시간제' : '24-hour clock',
          description: ko ? '오후 2:30 대신 14:30으로 보여 줍니다.' : 'Show times as 14:30 instead of 2:30 PM.',
          kind: 'switch',
          def: c.off,
          value: c.off,
        },
      ],
    },
    {
      id: 'models',
      title: ko ? '모델' : 'Models',
      sub: ko ? '새 대화를 시작할 때 쓰는 값입니다.' : 'What a new conversation starts with.',
      rows: [
        {
          key: 'model',
          label: ko ? '기본 모델' : 'Default model',
          description: ko ? '새 대화를 시작할 때 쓰는 모델입니다.' : 'The model a new conversation starts with.',
          hints: [{ label: c.cmd, code: '/model' }],
          kind: 'select',
          options: ['Sonnet', 'Opus', 'Haiku'],
          def: 'Sonnet',
          value: 'Opus',
        },
        {
          key: 'effort',
          label: ko ? '추론 강도' : 'Reasoning effort',
          description: ko
            ? '높을수록 더 오래 생각하고 더 많은 토큰을 씁니다.'
            : 'Higher effort thinks longer and spends more tokens.',
          hints: [{ label: c.cmd, code: '/effort' }],
          kind: 'segmented',
          options: ko ? ['낮음', '보통', '높음'] : ['Low', 'Medium', 'High'],
          def: ko ? '보통' : 'Medium',
          value: ko ? '보통' : 'Medium',
        },
        {
          key: 'maxTokens',
          label: ko ? '최대 출력 토큰' : 'Max output tokens',
          description: ko ? '한 번의 답이 쓸 수 있는 최대 길이입니다.' : 'The longest answer a single turn may write.',
          kind: 'text',
          def: '8,000',
          value: '8,000',
          check: tokens,
          format: (v) => Number(v.replace(/[,\s]/g, '')).toLocaleString('en-US'),
        },
      ],
    },
    {
      id: 'alerts',
      title: ko ? '알림' : 'Notifications',
      sub: ko ? '언제, 어떻게 알려 드릴지 정합니다.' : 'When we reach out, and how.',
      rows: [
        {
          key: 'digest',
          label: ko ? '일일 요약' : 'Daily digest',
          description: ko
            ? '매일 아침 지난 하루의 작업을 요약해 보냅니다.'
            : 'A summary of yesterday’s work, every morning.',
          kind: 'switch',
          def: c.off,
          value: c.on,
        },
        {
          key: 'digestTime',
          label: ko ? '요약 시각' : 'Digest time',
          description: ko ? '요약이 도착하는 시각입니다. Enter로 저장합니다.' : 'When the digest arrives. Enter saves.',
          hints: [ko ? '24시간제' : '24-hour clock'],
          kind: 'text',
          def: '09:00',
          value: '09:00',
          check: time,
        },
        {
          key: 'sound',
          label: ko ? '알림 소리' : 'Notification sound',
          description: ko ? '실행이 끝나거나 확인이 필요할 때 울립니다.' : 'Plays when a run finishes or needs you.',
          kind: 'select',
          options: ko ? ['차임', '팝', '없음'] : ['Chime', 'Pop', 'None'],
          def: ko ? '차임' : 'Chime',
          value: ko ? '차임' : 'Chime',
        },
      ],
    },
    {
      id: 'permissions',
      title: ko ? '권한' : 'Permissions',
      sub: ko ? '에이전트가 묻지 않고 할 수 있는 일입니다.' : 'What the agent may do without asking.',
      rows: [
        {
          key: 'autoApprove',
          label: ko ? '편집 자동 승인' : 'Auto-approve edits',
          description: ko ? '파일 편집을 묻지 않고 적용합니다.' : 'Apply file edits without asking first.',
          badge: ko ? '관리자' : 'Admin',
          kind: 'switch',
          def: c.off,
          value: c.off,
          locked: { value: c.off, reason: ko ? '워크스페이스 관리자가 정한 값입니다' : 'Set by your workspace admin' },
        },
        {
          key: 'web',
          label: ko ? '웹 접근' : 'Web access',
          description: ko
            ? '공개 웹 페이지를 검색하고 읽게 합니다.'
            : 'Let the agent search and read public web pages.',
          kind: 'switch',
          def: c.on,
          value: c.on,
          flaky: true,
        },
        {
          key: 'tools',
          label: ko ? '허용 도구' : 'Allowed tools',
          description: ko
            ? '이 워크스페이스에서 부를 수 있는 도구입니다.'
            : 'Tools the agent may call in this workspace.',
          kind: 'select',
          options: ko
            ? ['읽기와 검색', '읽기, 검색, 편집', '모두']
            : ['Read and search', 'Read, search and edit', 'Everything'],
          def: ko ? '읽기와 검색' : 'Read and search',
          value: ko ? '읽기, 검색, 편집' : 'Read, search and edit',
        },
      ],
    },
  ];
}

/** A kit control for a row: the element, how to read and set its value, and when the person commits a change. */
interface Control {
  el: HTMLElement;
  get(): string;
  set(v: string): void;
}

function control(spec: RowSpec, lang: Lang, commit: () => void): Control {
  const c = COPY[lang];
  if (spec.kind === 'select') {
    const s = document.createElement('select');
    s.className = 'ui-input';
    for (const o of spec.options ?? []) s.add(new Option(o, o, false, o === spec.value));
    s.addEventListener('change', commit);
    return { el: s, get: () => s.value, set: (v) => (s.value = v) };
  }
  if (spec.kind === 'segmented') {
    const s = document.createElement('ui-segmented') as UiSegmented;
    s.data = {
      label: spec.label,
      value: spec.value,
      options: (spec.options ?? []).map((o) => ({ value: o, label: o })),
    };
    // ui-change fires before the segmented takes the value: read it once the event is done.
    s.addEventListener('ui-change', () => queueMicrotask(commit));
    return {
      el: s,
      get: () => s.data?.value ?? '',
      set: (v) => {
        if (s.data) s.data = { ...s.data, value: v };
      },
    };
  }
  if (spec.kind === 'switch') {
    const label = document.createElement('label');
    label.className = 'ui-switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('role', 'switch');
    input.checked = spec.value === c.on;
    // The state word is aria-hidden: the row names the switch, role="switch" reads on / off.
    const word = document.createElement('span');
    word.setAttribute('aria-hidden', 'true');
    const paint = () => {
      word.textContent = input.checked ? c.on : c.off;
    };
    paint();
    input.addEventListener('change', () => {
      paint();
      commit();
    });
    label.append(input, word);
    return {
      el: label,
      get: () => (input.checked ? c.on : c.off),
      set: (v) => {
        input.checked = v === c.on;
        paint();
      },
    };
  }
  const input = document.createElement('input');
  input.className = 'ui-input';
  input.type = 'text';
  input.value = spec.value;
  input.inputMode = 'numeric';
  input.autocomplete = 'off';
  input.style.width = '132px';
  input.addEventListener('change', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
  });
  return { el: input, get: () => input.value.trim(), set: (v) => (input.value = v) };
}

const SAVE_MS = 650;
const SAVED_FADE_MS = 3200;

/** One working settings page: nav + cards of rows, filter and Modified only, and stand-in saves (no network). */
function settingsPage(lang: Lang): HTMLElement {
  const n = ++uid;
  const c = COPY[lang];
  const specs = sections(lang);
  const id = (s: string) => `snd${n}-${s}`;

  const page = document.createElement('div');
  page.className = 'snd-page';
  const style = document.createElement('style');
  style.textContent = `
.snd-page { display: grid; gap: 14px; width: 100%; min-width: 0; }
.snd-scroll {
  display: flex; flex-direction: column; gap: 14px; height: 470px; min-width: 0; padding: 2px 2px 16px;
  overflow: auto; overscroll-behavior: contain;
}
.snd-scroll > .ui-card { flex: none; }
.snd-scroll > .ui-card[hidden] { display: none; }
@media (min-width: 840px) {
  .snd-page { grid-template-columns: 168px minmax(0, 1fr); gap: 20px; align-items: start; }
  .snd-scroll { height: 560px; }
}`;
  const nav = document.createElement('ui-settings-nav') as UiSettingsNav;
  if (lang === 'ko') nav.setAttribute('lang', 'ko');
  const scroll = document.createElement('div');
  scroll.className = 'snd-scroll';
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', c.pageLabel);
  scroll.tabIndex = 0;

  // What the page says when the filter leaves nothing (the nav says it too, next to Clear filters).
  const empty = document.createElement('div');
  empty.className = 'ui-card';
  empty.hidden = true;
  const emptyBody = document.createElement('div');
  emptyBody.className = 'ui-empty';
  const emptyTitle = document.createElement('strong');
  const emptyHint = document.createElement('span');
  emptyHint.textContent = c.noMatchHint;
  emptyBody.innerHTML = icon('search');
  emptyBody.append(emptyTitle, emptyHint);
  empty.append(emptyBody);

  let filter: SettingsFilter = { query: '', modifiedOnly: false };
  const rows: Array<{ spec: RowSpec; el: UiSettingRow; sec: string }> = [];

  const refresh = () => {
    const r = applySettingsFilter(scroll, filter);
    const filtering = !!(filter.query ?? '').trim() || !!filter.modifiedOnly;
    const navSecs: SettingsNavSection[] = specs.map((s) => ({
      id: id(s.id),
      label: s.title,
      count: filtering ? (r.sections[id(s.id)] ?? 0) : undefined,
      modified: rows.filter((x) => x.sec === s.id && x.el.data?.modified).length,
    }));
    const none = r.shown === 0;
    empty.hidden = !none;
    emptyTitle.textContent = c.noMatch((filter.query ?? '').trim());
    nav.data = { ...nav.data, sections: navSecs, query: filter.query, modifiedOnly: filter.modifiedOnly, empty: none };
  };

  for (const s of specs) {
    const sec = document.createElement('section');
    sec.className = 'ui-card';
    sec.id = id(s.id);
    sec.setAttribute('aria-labelledby', `${sec.id}-h`);
    const head = document.createElement('header');
    const h = document.createElement('h2');
    h.id = `${sec.id}-h`;
    h.textContent = s.title;
    const p = document.createElement('p');
    p.textContent = s.sub;
    head.append(h, p);
    sec.append(head);
    for (const spec of s.rows) {
      const el = document.createElement('ui-setting-row') as UiSettingRow;
      if (lang === 'ko') el.setAttribute('lang', 'ko');
      const base = (): SettingRowData => ({
        key: spec.key,
        label: spec.label,
        description: spec.description,
        hints: spec.hints,
        defaultText: spec.def,
        badge: spec.badge,
        modified: spec.value !== spec.def,
        canReset: !spec.locked,
        locked: spec.locked ?? null,
      });
      let tries = 0;
      let fade = 0;
      let last = spec.value;
      const ctl = control(spec, lang, () => write(ctl.get()));
      const write = (v: string) => {
        if (v === last && el.data?.status?.state !== 'error') return;
        last = v;
        window.clearTimeout(fade);
        el.data = { ...base(), status: { state: 'pending' } };
        window.setTimeout(() => {
          tries++;
          const err = spec.check?.(v) ?? (spec.flaky && tries === 1 ? c.timeout : null);
          if (spec.check) ctl.el.setAttribute('aria-invalid', String(!!err));
          if (err) {
            // A failed write keeps the old value: the control goes back to it (a typed value stays to be fixed).
            if (!spec.check) {
              ctl.set(spec.value);
              last = spec.value;
            }
            el.data = { ...base(), status: { state: 'error', text: err } };
            return;
          }
          const value = spec.format ? spec.format(v) : v;
          if (value !== v) ctl.set(value);
          spec.value = value;
          last = value;
          el.data = { ...base(), status: { state: 'saved', text: c.saved(value) } };
          fade = window.setTimeout(() => {
            if (el.data?.status?.state === 'saved') el.data = { ...base(), status: null };
          }, SAVED_FADE_MS);
          refresh();
        }, SAVE_MS);
      };
      el.addEventListener('ui-reset', () => {
        ctl.set(spec.def);
        write(spec.def);
      });
      if (!spec.locked) el.append(ctl.el);
      el.data = base();
      sec.append(el);
      rows.push({ spec, el, sec: s.id });
    }
    scroll.append(sec);
  }
  scroll.append(empty);

  nav.addEventListener('ui-filter', (e) => {
    const d = (e as CustomEvent<SettingsFilterDetail>).detail;
    filter = { query: d.query, modifiedOnly: d.modifiedOnly };
    refresh();
  });
  page.append(style, nav, scroll);
  // The rows render first (their data was set first), so the nav finds a page that scrolls when it starts tracking.
  refresh();
  return page;
}

/** The two shapes side by side, on fixed data: no page to scroll, so tracking is off. */
function layouts(): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:grid;gap:22px;width:100%';
  const secs: SettingsNavSection[] = [
    { id: 'l-general', label: 'General' },
    { id: 'l-models', label: 'Models', modified: 1 },
    { id: 'l-alerts', label: 'Notifications', modified: 2 },
    { id: 'l-permissions', label: 'Permissions' },
    { id: 'l-privacy', label: 'Privacy and data' },
    { id: 'l-billing', label: 'Billing' },
  ];
  const cap = (text: string) => {
    const p = document.createElement('p');
    p.style.cssText = 'margin:0 0 8px;font-size:12px;color:var(--ui-ib-muted)';
    const code = document.createElement('code');
    code.textContent = text;
    p.append(code);
    return p;
  };
  const side = document.createElement('ui-settings-nav') as UiSettingsNav;
  side.setAttribute('layout', 'side');
  side.style.cssText = 'width:200px';
  side.data = { sections: secs, current: 'l-models', track: false };
  const top = document.createElement('ui-settings-nav') as UiSettingsNav;
  top.setAttribute('layout', 'top');
  top.data = { sections: secs, current: 'l-alerts', track: false };
  const a = document.createElement('div');
  a.append(cap('layout="side"'), side);
  const b = document.createElement('div');
  b.style.minWidth = '0';
  b.append(cap('layout="top"'), top);
  box.append(a, b);
  return box;
}

/** A read-only workspace: the notice slot, a search that finds nothing, and counts from the helpers (no DOM rows). */
function notice(lang: Lang = 'en'): HTMLElement {
  const ko = lang === 'ko';
  const specs = sections(lang);
  const nav = document.createElement('ui-settings-nav') as UiSettingsNav;
  nav.setAttribute('layout', 'side');
  if (ko) nav.setAttribute('lang', 'ko');
  nav.style.cssText = 'width:240px';
  const banner = document.createElement('div');
  banner.className = 'ui-notice';
  banner.dataset.tone = 'wait';
  banner.slot = 'notice';
  banner.innerHTML = icon('lock');
  const words = document.createElement('span');
  const strong = document.createElement('strong');
  strong.textContent = ko ? '승인 전까지 읽기 전용입니다.' : 'Read-only until approved.';
  words.append(
    strong,
    ko ? ' 관리자가 워크스페이스를 수락하면 바꿀 수 있습니다.' : ' An admin has to accept your workspace first.',
  );
  banner.append(words);
  nav.append(banner);
  const apply = (f: SettingsFilter) => {
    const filtering = !!(f.query ?? '').trim() || !!f.modifiedOnly;
    let shown = 0;
    const secs = specs.map((s) => {
      const hits = s.rows.filter(
        (r) =>
          settingMatches(
            settingRowText({ key: r.key, label: r.label, description: r.description, hints: r.hints }),
            f.query ?? '',
          ) &&
          (!f.modifiedOnly || r.value !== r.def),
      ).length;
      shown += hits;
      return {
        id: `nt-${s.id}`,
        label: s.title,
        count: filtering ? hits : undefined,
        modified: s.rows.filter((r) => r.value !== r.def).length,
      };
    });
    nav.data = {
      sections: secs,
      current: 'nt-general',
      query: f.query,
      modifiedOnly: f.modifiedOnly,
      empty: !shown,
      track: false,
    };
  };
  nav.addEventListener('ui-filter', (e) => apply((e as CustomEvent<SettingsFilterDetail>).detail));
  // ui-navigate: there is no page here — keep the default (it only moves the current link).
  apply({ query: 'webhook', modifiedOnly: false });
  return nav;
}

export const doc: ComponentDoc = {
  slug: 'settings-nav',
  name: 'Settings nav',
  tag: 'ui-settings-nav',
  group: 'Components',
  summary: 'Where am I on the settings page, where is the one I want, and what did I change?',
  description:
    'The side nav of a settings page: one link per section (a quiet count while filtering, an ink dot when something in it differs from its default), a search box and Modified only, and a notice slot above them for a page-wide message. The current section follows the scroll; a link scrolls its section into view (smooth unless reduced motion) without touching the URL. The nav does not filter the page itself — it sends ui-filter and the host hides rows with applySettingsFilter, then sends back the counts and empty. From an 840px viewport it is a column; below that a filter row over a sideways-scrolling row of chips (layout="auto", or force side / top).',
  usedIn:
    'soma-work › settings: the left column of the settings page (section links, the search and the read-only notice of the preferences tab).',
  reference: {
    name: 'Apple HIG — Sidebars',
    url: 'https://developer.apple.com/design/human-interface-guidelines/sidebars',
  },
  props: [
    {
      name: 'data.sections',
      type: 'Array<{ id: string; label: string; count?: number; modified?: number }>',
      required: true,
      description:
        'One link per section. id is the section element’s id in the nav’s root node (document or shadow root). count: rows shown (drawn quietly, a zero is muted). modified: rows that differ from their defaults (an ink dot, “n modified” for screen readers).',
    },
    {
      name: 'data.current',
      type: 'string',
      description: 'The current section. Adopted when the host changes it; tracking and links move it too.',
    },
    { name: 'data.filter', type: 'boolean', default: 'true', description: 'Draw the search box and Modified only.' },
    {
      name: 'data.query',
      type: 'string',
      description:
        'The search text. Adopted when it changes — an echo of what the nav sent never overwrites what is being typed.',
    },
    { name: 'data.modifiedOnly', type: 'boolean', description: 'The Modified only box.' },
    { name: 'data.empty', type: 'boolean', description: 'Nothing matches: “No settings match” with Clear filters.' },
    { name: 'data.label', type: 'string', default: "'Settings sections'", description: 'The nav’s accessible name.' },
    { name: 'data.placeholder', type: 'string', default: "'Search settings'", description: 'The search placeholder.' },
    {
      name: 'data.track',
      type: 'boolean',
      default: 'true',
      description:
        'Follow the scroll with an IntersectionObserver over the sections (skipped when there is none, or no section is on the page).',
    },
    {
      name: 'layout',
      type: "'auto' | 'side' | 'top'",
      default: "'auto'",
      description: 'Attribute. auto: a column from an 840px viewport, chips below it. side / top force one shape.',
    },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'Attribute. Words the nav draws.' },
    {
      name: 'slot="notice"',
      type: 'light DOM',
      description: 'A page-wide message above the filter (a .ui-notice — read-only, plan limits).',
    },
    {
      name: 'navigate(id)',
      type: '(id: string) => boolean',
      description: 'Go to a section as if its link was pressed. False when cancelled or unknown.',
    },
    {
      name: 'current / query / modifiedOnly',
      type: 'string | undefined / string / boolean (read-only)',
      description: 'What the nav shows now (query may be ahead of the last ui-filter).',
    },
    {
      name: 'applySettingsFilter(container, { query, modifiedOnly })',
      type: '=> { shown, total, sections: Record<id, number> }',
      description:
        'Helper: hides the <ui-setting-row>s that do not match (label, description, hints, key; with modifiedOnly only modified rows) and every <section> left without rows; marks the first shown row of each card data-first.',
    },
    {
      name: 'settingMatches(text, query)',
      type: '=> boolean',
      description: 'Helper: every word of the query appears in text (any case). Empty query matches.',
    },
    { name: 'settingRowText(data)', type: '=> string', description: 'Helper: the text a row is searched by.' },
  ],
  events: [
    {
      name: 'ui-navigate',
      detail: '{ id: string }',
      description:
        'A link was pressed (or navigate() was called). Cancelable: preventDefault stops the scroll and keeps the current link. Default: scroll the section into view (smooth unless reduced motion) and make it current. location.hash is never touched.',
    },
    {
      name: 'ui-filter',
      detail: '{ query: string; modifiedOnly: boolean }',
      description:
        'Typing settles (120ms), Enter, Esc / clear, Modified only, or Clear filters. Apply it (applySettingsFilter) and send back counts and empty.',
    },
    {
      name: 'ui-section-change',
      detail: '{ id: string }',
      description:
        'Notification: the scroll moved the current section (not cancelable). Not sent for a link press — that is ui-navigate.',
    },
  ],
  keyboard: [
    ['Tab', 'Search, Modified only, then each section link'],
    ['Enter (search)', 'Send the filter now'],
    ['Esc (search)', 'Clear the search; on an empty box Esc passes through (to close a drawer around it)'],
    ['Enter / Space (link)', 'Go to the section'],
  ],
  a11y: [
    'A <nav> named “Settings sections” (data.label) around a list of buttons; the current one has aria-current="true".',
    'Modified is an ink dot (shape, not colour) plus “, n modified” read with the link; counts are plain numbers.',
    '“No settings match” sits in a role=status region so the result of a search is announced.',
    'Links never change the URL hash and never steal focus from the page; the scroll is instant under reduced motion.',
    'The search box is type="search" with an accessible name; its clear button is named “Clear search”. 44px targets on touch.',
  ],
  usage: `<div class="settings">
  <ui-settings-nav id="nav">
    <div slot="notice" class="ui-notice" data-tone="wait">Read-only until approved.</div>
  </ui-settings-nav>
  <main id="page">
    <section class="ui-card" id="models">
      <header><h2>Models</h2><p>What a new conversation starts with.</p></header>
      <ui-setting-row>…</ui-setting-row>
    </section>
  </main>
</div>
<script type="module">
  import '@2lab.ai/ui/settings-nav';
  import { applySettingsFilter } from '@2lab.ai/ui/settings-nav';
  const nav = document.getElementById('nav');
  const SECTIONS = [{ id: 'general', label: 'General' }, { id: 'models', label: 'Models' }];
  nav.data = { sections: SECTIONS };
  nav.addEventListener('ui-filter', (e) => {
    const r = applySettingsFilter(document.getElementById('page'), e.detail);
    nav.data = { ...nav.data, ...e.detail, empty: r.shown === 0,
      sections: SECTIONS.map((s) => ({ ...s, count: e.detail.query ? r.sections[s.id] : undefined })) };
  });
</script>`,
  demos: [
    {
      id: 'page',
      title: 'Settings page',
      description:
        'Scroll the page: the current section follows. Search (“model”, “sound”) or tick Modified only — rows and empty cards hide, the nav counts what is left. Change a value: Saving…, then Saved. Web access fails on the first try (the switch goes back), Max output tokens and Digest time check what you type.',
      height: 620,
      frame: false,
      create: () => settingsPage('en'),
    },
    {
      id: 'layouts',
      title: 'Side and top',
      description:
        'layout="side" is the column (the current link on the neutral chip); layout="top" is the filter row over a sideways-scrolling row of chips. layout="auto" picks by the 840px viewport.',
      height: 520,
      create: layouts,
    },
    {
      id: 'notice',
      title: 'Notice and no results',
      description:
        'A .ui-notice in slot="notice". The search finds nothing: “No settings match” with Clear filters. Counts here come from settingMatches over plain data — no rows on the page.',
      height: 480,
      create: () => notice('en'),
    },
    {
      id: 'ko',
      title: 'Korean',
      description: 'lang="ko" on the nav and each row.',
      height: 620,
      frame: false,
      create: () => settingsPage('ko'),
    },
  ],
};
