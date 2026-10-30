import type { ComponentDoc } from '../../docs/types';
import './memory-panel';
import type {
  MemoryAddDetail,
  MemoryDeleteDetail,
  MemoryEditDetail,
  MemoryPanelData,
  MemoryRestoreDetail,
  MemoryStore,
  UiMemoryPanel,
} from './memory-panel';
import { storeUsed } from './memory-panel';

const SEP = '\n§\n';

const NOTES = [
  'Repo uses pnpm workspaces — run `pnpm -w test` from the root; `npm install` rewrites the lockfile and breaks CI.',
  'Deploys go out through a release/* branch and the deploy workflow. Never push straight to main, even for a one-line hotfix.',
  'The staging database is read-only for agents. Ask in #infra before any migration, including reversible ones, and link the PR.',
  'Biome replaces ESLint and Prettier here: `npm run check` must pass before every commit, and CI treats warnings as errors.',
  'The e2e checkout spec flakes about once a week on CI (payment sandbox timeout). Rerun it once before investigating; if it fails twice in a row, it is a real failure.',
  'Feature flags live in config/flags.yaml and ship with the code — a flag flip is a normal PR with a reviewer, not a console change.',
  'Release notes are bilingual (EN/KO) and generated from conventional commits, so commit subjects stay in English, imperative, under 72 characters.',
  'Jobs longer than ten minutes go to the background queue and post progress every five minutes — never a silent wait in the thread.',
  'Screenshots for UI reviews: light and dark, desktop 1440 and phone 390, attached to the PR description rather than to comments.',
  'API errors are reported with the request id from the x-request-id header; without it the on-call team cannot trace anything.',
  'When a PR touches the billing module, add the payments team as reviewers and run the invoice snapshot tests locally first.',
  'Tokens and secrets never go into issue comments or logs. Use the vault path and say which key, not its value.',
  'Weekly dependency updates arrive from Renovate on Mondays; merge patch updates after green CI, leave majors for a human.',
  'Database changes need a down migration and a backfill plan in the PR body; the reviewer checks both before approving.',
  'Search the internal wiki before asking the team — runbooks for deploys, rollbacks and on-call live under /eng/runbooks.',
];

const PROFILE = [
  'Prefers short answers first, details only when asked.',
  'Writes Korean in Slack threads and English in code, commits and PR descriptions.',
  'Timezone Asia/Seoul; daily standup at 10:00, no meetings after 18:00.',
  'Reviews PRs in the morning and wants a summary table at the top of every PR description.',
  'Likes diagrams for architecture questions — Excalidraw or Mermaid, not ASCII art.',
  'Uses VS Code with Vim keybindings on macOS and zsh.',
];

const LONG_NOTE =
  'Incident checklist for the payments service, saved from the 2026-09 outage review: 1) page the payments on-call through the incident bot, not a direct message; 2) freeze deploys with `deploy freeze payments` before touching anything; 3) capture the failing request ids and the provider status page in the incident doc; 4) roll back with the previous release tag instead of reverting commits, because migrations run forward only; 5) post an update in #status every 15 minutes, even when nothing changed; 6) once resolved, unfreeze deploys, close the incident in the bot and open the postmortem from the template within two working days, linking every PR that was part of the fix.';

const notes = (entries: string[], limit = 2200): MemoryStore => ({
  id: 'memory',
  label: 'Agent notes',
  file: 'MEMORY.md',
  limit,
  perEntryLimit: 660,
  separator: SEP,
  entries,
});
const profile = (entries: string[]): MemoryStore => ({
  id: 'user',
  label: 'User profile',
  file: 'USER.md',
  limit: 1375,
  perEntryLimit: 412,
  separator: SEP,
  entries,
});

/** A server check: a refusal message, or '' when the write goes through. */
type Check = (name: string, detail: MemoryAddDetail & Partial<MemoryEditDetail>, model: MemoryPanelData) => string;

/**
 * A tiny host: every event is applied to its own copy right away and the copy comes back as `data` a moment
 * later — like a server write followed by a reload. The panel shows the change optimistically in between.
 * With `check`, a write the "server" refuses is answered with `el.refuse(event, message)` instead.
 */
function make(data: MemoryPanelData, attrs: Record<string, string> = {}, check?: Check): HTMLElement {
  const el = document.createElement('ui-memory-panel') as UiMemoryPanel;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  const model: MemoryPanelData = structuredClone(data);
  const store = (id: string) => model.stores.find((s) => s.id === id)!;
  let timer = 0;
  const persist = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      el.data = structuredClone(model);
    }, 260);
  };
  const on = <T>(name: string, fn: (d: T) => void) =>
    el.addEventListener(name, (e) => {
      const d = (e as CustomEvent<T>).detail;
      const why = check?.(name, d as MemoryAddDetail & Partial<MemoryEditDetail>, model) ?? '';
      if (why) {
        window.setTimeout(() => el.refuse(e, why), 420);
        return;
      }
      fn(d);
      persist();
    });
  on<MemoryAddDetail>('ui-add', (d) => store(d.store).entries.push(d.text.trim()));
  on<MemoryEditDetail>('ui-edit', (d) => {
    store(d.store).entries[d.index] = d.text.trim();
  });
  on<MemoryDeleteDetail>('ui-delete', (d) => store(d.store).entries.splice(d.index, 1));
  on<MemoryRestoreDetail>('ui-restore', (d) => {
    const s = store(d.store);
    s.entries.splice(Math.min(d.index, s.entries.length), 0, d.text);
  });
  on<{ store: string }>('ui-clear', (d) => {
    store(d.store).entries = [];
  });
  el.data = structuredClone(data);
  return el;
}

export const doc: ComponentDoc = {
  slug: 'memory-panel',
  name: 'Memory Panel',
  tag: 'ui-memory-panel',
  group: 'Components',
  summary: 'What the agent remembers about you — fix a wrong entry or forget it on the spot, with Undo.',
  description:
    'The personal memory stores an agent reads at the start of every session, in one panel: store chips to narrow, search with highlight, one group per store with its usage bar (amber from 80 %, red near and at the limit), entries numbered the way the store numbers them. Edit happens in place; Delete folds the row away at once and offers Undo on the tray for 5 s — the clock stops while focus is in the panel or the pointer rests on the tray. Every write leaves as a cancelable event and shows optimistically until the host sends the next data.',
  usedIn: 'soma-work dashboard › 설정 › 기억 › 개인 메모리 (에이전트 노트 MEMORY.md · 사용자 프로필 USER.md)',
  reference: { name: 'affectUI Memory Panel', url: 'https://www.affectui.com/components/memory-panel' },
  props: [
    {
      name: 'data.stores',
      type: 'MemoryStore[]',
      required: true,
      description: 'The stores, in display order. Each gets a chip and a group.',
    },
    { name: 'data.stores[].id', type: 'string', required: true, description: 'Stable id, sent back as `store`.' },
    { name: 'data.stores[].label', type: 'string', required: true, description: 'Chip label and group title.' },
    { name: 'data.stores[].file', type: 'string', description: 'File or source name shown next to the title.' },
    {
      name: 'data.stores[].limit',
      type: 'number',
      required: true,
      description:
        'Character budget. Drives the usage bar: amber ≥ 80 %, red bar ≥ 95 %, “full” ≥ 100 %. 0 hides the bar.',
    },
    {
      name: 'data.stores[].entries',
      type: 'string[]',
      required: true,
      description: 'Entries in store order. Entry “#n” is `entries[n − 1]`; text is shown as given (line breaks kept).',
    },
    {
      name: 'data.stores[].perEntryLimit',
      type: 'number',
      description: 'Longest single entry. Longer entries are flagged; the editors count against it.',
    },
    {
      name: 'data.stores[].separator',
      type: 'string',
      default: "''",
      description: 'What the store puts between entries when it counts usage (soma-work: `\\n§\\n`).',
    },
    {
      name: 'data.stores[].empty',
      type: 'string',
      default: '“Empty — add an entry below.”',
      description:
        'The line shown while the store has no entries, e.g. how else entries get there (“say “remember this” in Slack”). A read-only panel keeps “Empty.”.',
    },
    {
      name: 'refuse(write, message?)',
      type: '(write: { type: string; detail }, message?: string) => boolean',
      description:
        'Method. A write you accepted failed on the server (409, over the limit, a lock): pass the `ui-*` event (or `{ type, detail }` — the same detail object, or a copy: a cloned detail is matched by type, store, index, text and previous) and the message. What was typed comes back — an edit to its entry’s editor (when `previous` is still there once and no other editor is open), else to the add box; an add or a restore to the store’s add box, opened. A refused delete withdraws its Undo; when Undo already went out, the row stays on screen once (never a duplicate), whichever of the two is refused. An optimistic change still on screen rolls back. The message replaces “Saved” in the fail tone (default “Couldn’t save”). Works before or after you send the reloaded data; called inside the listener it acts as preventDefault(). Busy handling stays yours: preventDefault() while a write is out.',
    },
    {
      name: 'data.readOnly',
      type: 'boolean | string',
      default: 'false',
      description: 'Hides Edit, Delete, Add and Clear all. A string is also shown above the list as the reason.',
    },
    { name: 'data.title', type: 'string', description: 'Heading with a rolling entry count. Default: none.' },
    { name: 'lang', type: "'en' | 'ko'", default: "'en'", description: 'UI language (attribute).' },
    {
      name: 'theme',
      type: "'light' | 'dark'",
      description: 'Pins the theme (attribute). Default follows prefers-color-scheme or page tokens.',
    },
  ],
  events: [
    {
      name: 'ui-add',
      detail: '{ store: string; text: string }',
      description: 'Enter or Add in a store’s new-entry editor. Text as typed (the soma-work store trims it).',
    },
    {
      name: 'ui-edit',
      detail: '{ store: string; index: number; text: string; previous: string }',
      description:
        'An in-place edit was saved. Never sent when the change is only surrounding whitespace (both sides compared trimmed). Check `previous` against your copy.',
    },
    {
      name: 'ui-delete',
      detail: '{ store: string; index: number; text: string }',
      description: 'Delete, sent at once — the row folds away and Undo is offered for 5 s. Delete for real.',
    },
    {
      name: 'ui-restore',
      detail: '{ store: string; index: number; text: string }',
      description:
        'Undo: put `text` back (exactly what was deleted). `index` is where it was; appending is fine — the next data decides. Refused (preventDefault): the text waits in the add box.',
    },
    {
      name: 'ui-clear',
      detail: '{ store: string }',
      description: 'Second press of “Clear all” within 4 s (the first press names the count). No undo.',
    },
  ],
  keyboard: [
    ['Tab', 'Selected store chip → search → each entry’s Edit · Delete → Add · Clear all → Undo'],
    ['← / → / ↑ / ↓', 'Move between store chips and select (wraps)'],
    ['Home / End', 'First / last store chip'],
    ['Enter', 'Save the edit / add the new entry (ignored while an IME is composing)'],
    ['Shift+Enter', 'New line in an editor'],
    ['Esc', 'Cancel the edit · close the new-entry editor (draft kept) · close search (clears it) · disarm Clear all'],
    ['Enter (held)', 'Repeats never activate a button — a held key cannot delete row after row'],
  ],
  a11y: [
    'role="group" named by the title (or “Personal memory”); each store is a section named by its heading.',
    'Store chips are a radiogroup with one tab stop (roving tabindex); selection follows focus.',
    'The usage bar is role="meter" with the numbers as aria-valuetext; the visible copy is not read twice.',
    'Edit and Delete are named with the entry (“Delete “Prefers short…””) — visible label first; they show on hover and on keyboard focus, always on touch.',
    'Filtered or folded rows and groups are inert; the search box and chips swap with inert as well.',
    'One polite status line speaks state changes only (deleted, saved, hints, counts) — the rolling caption is aria-hidden.',
    'After Delete focus moves to the next shown row (then previous, the add button, search, chip); Undo focuses the restored entry. Undo’s 5 s pause while focus is in the panel or the pointer is on the tray (WCAG 2.2.1).',
    'Touch: targets are 44 px; reduced motion: folds, cross-fades and number rolls are instant.',
    'Sound (opt-in, @2lab.ai/ui/sound): a tap for Add and Save, close for Delete, a soft navigate back for Undo; Clear all taps softly when it arms and closes strongly when the second press clears; keystrokes in the fields sound only with typing sounds on. A refused or prevented write stays quiet. Silent until the page turns sound on.',
  ],
  usage: `<ui-memory-panel lang="en"></ui-memory-panel>
<script type="module">
  import '@2lab.ai/ui/memory-panel';
  const el = document.querySelector('ui-memory-panel');
  // { stores: [{ id: 'memory', label: 'Agent notes', file: 'MEMORY.md', limit: 2200,
  //              perEntryLimit: 660, separator: '\\n§\\n', entries: ['…'] }, …] }
  const reload = async () => { el.data = await (await fetch('/api/memory')).json(); };
  // The panel shows each change at once; reload sends the truth. A refused write hands the typed text back.
  const api = async (e, method, path, body) => {
    const r = await fetch('/api/memory/' + path, {
      method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    await reload();
    if (!r.ok) el.refuse(e, 'Couldn’t save: ' + ((await r.json()).error ?? r.status));
  };
  await reload();
  el.addEventListener('ui-add', (e) => api(e, 'POST', e.detail.store, { text: e.detail.text }));
  el.addEventListener('ui-edit', (e) => api(e, 'PUT', e.detail.store + '/' + e.detail.index, e.detail));
  el.addEventListener('ui-delete', (e) => api(e, 'DELETE', e.detail.store + '/' + e.detail.index, e.detail));
  el.addEventListener('ui-restore', (e) => api(e, 'POST', e.detail.store, { text: e.detail.text, restore: true }));
  el.addEventListener('ui-clear', (e) => api(e, 'DELETE', e.detail.store));
</script>`,
  demos: [
    {
      id: 'default',
      title: 'Default',
      description:
        'Agent notes at 88 % of 2,200 chars (amber). Hover or Tab to an entry for Edit · Delete; Delete, then Undo on the tray.',
      height: 720,
      frame: false,
      create: () => make({ title: 'Personal memory', stores: [notes(NOTES), profile(PROFILE)] }),
    },
    {
      id: 'full',
      title: 'At the limit',
      description:
        'Past 2,200 chars: the bar and the total turn red. An entry longer than the 660-char per-entry limit is flagged.',
      height: 720,
      frame: false,
      create: () => make({ stores: [notes([...NOTES.slice(0, 12), LONG_NOTE]), profile(PROFILE.slice(0, 3))] }),
    },
    {
      id: 'empty',
      title: 'Empty',
      description:
        'A new user: both stores empty, each with its own add editor. Agent notes carries the host’s own empty line (stores[].empty).',
      height: 420,
      frame: false,
      create: () =>
        make({
          stores: [
            { ...notes([]), empty: 'Empty — say “remember this” in Slack, or add an entry below.' },
            profile([]),
          ],
        }),
    },
    {
      id: 'refused',
      title: 'Refused by the server',
      description:
        'Agent notes is at 97 %. The “server” refuses an add or edit that would pass the limit and answers with refuse() 0.4 s later: the optimistic row rolls back, the text is back in its editor or the add box, the tray says why.',
      height: 640,
      frame: false,
      create: () =>
        make({ stores: [notes(NOTES, 1990), profile(PROFILE.slice(0, 3))] }, {}, (name, d, model) => {
          const s = model.stores.find((x) => x.id === d.store);
          if (!s || (name !== 'ui-add' && name !== 'ui-edit')) return '';
          const next = s.entries.slice();
          if (name === 'ui-add') next.push(d.text.trim());
          else next[d.index ?? 0] = d.text.trim();
          const used = storeUsed(next, s.separator);
          return used > s.limit
            ? `Couldn’t save: ${s.label} would be ${used.toLocaleString('en-US')} / ${s.limit.toLocaleString('en-US')} chars`
            : '';
        }),
    },
    {
      id: 'readonly',
      title: 'Read-only',
      description: 'readOnly with a reason: no write actions, chips and search still work.',
      height: 520,
      frame: false,
      create: () =>
        make({
          readOnly: 'Read-only — this workspace’s memory is managed by an admin.',
          stores: [notes(NOTES.slice(0, 4)), profile(PROFILE.slice(0, 3))],
        }),
    },
    {
      id: 'ko',
      title: '한국어 (lang="ko")',
      height: 560,
      frame: false,
      create: () =>
        make(
          {
            stores: [
              {
                ...notes([
                  '저장소는 pnpm 워크스페이스를 씁니다 — 테스트는 루트에서 `pnpm -w test`로 돌립니다.',
                  '배포는 release/* 브랜치와 deploy 워크플로로만 나갑니다. main에 바로 푸시하지 않습니다.',
                  '스테이징 DB는 에이전트에게 읽기 전용입니다. 마이그레이션 전에는 #infra 채널에 먼저 묻습니다.',
                  'e2e checkout 스펙은 CI에서 일주일에 한 번꼴로 흔들립니다 — 한 번 다시 돌려 보고, 두 번 실패하면 진짜 문제로 봅니다.',
                ]),
                label: '에이전트 노트',
              },
              {
                ...profile([
                  '답은 짧게 먼저, 자세한 내용은 물어볼 때만.',
                  'Slack에서는 한국어, 코드·커밋·PR 설명은 영어로 씁니다.',
                  '시간대 Asia/Seoul — 매일 10:00 스탠드업, 18:00 이후 회의 없음.',
                ]),
                label: '사용자 프로필',
              },
            ],
          },
          { lang: 'ko' },
        ),
    },
  ],
};
