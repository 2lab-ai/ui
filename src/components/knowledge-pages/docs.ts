import type { ComponentDoc } from '../../docs/types';
import './knowledge-pages';
import type {
  KnowledgeDeleteDetail,
  KnowledgePage,
  KnowledgePageGroup,
  KnowledgePageSummary,
  KnowledgePagesData,
  KnowledgeReloadDetail,
  KnowledgeSaveDetail,
  KnowledgeSelectDetail,
  UiKnowledgePages,
} from './knowledge-pages';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

type Seed = Omit<KnowledgePage, 'updatedAt'> & { ago: number };

const GROUPS: KnowledgePageGroup[] = [
  { id: 'runbooks', label: 'Runbooks' },
  { id: 'norms', label: 'Team norms' },
  { id: 'reference', label: 'Reference' },
];

const PAGES: Seed[] = [
  {
    id: 'deploy-checklist',
    title: 'Deploy checklist',
    aliases: ['ship list', 'go-live'],
    group: 'runbooks',
    revision: 7,
    ago: 2 * HOUR,
    current: `Every production deploy goes through a \`release/*\` branch and the deploy workflow — never a direct push to \`main\`.

## Before
- CI green on the release branch, including the e2e suite
- Changelog entry merged; migrations reviewed by a second person
- Announce the window in **#deploys** 15 minutes ahead

## During
1. Run \`deploy start <tag>\` and watch the canary for 10 minutes
2. Promote only while the error rate stays under 0.5 %

## After
- Tag the release and close the milestone
- Roll back with the previous tag, not a revert: migrations only run forward`,
    history: [
      { date: '2026-10-21', text: 'Canary window raised from 5 to 10 minutes after the October rollback.' },
      { date: '2026-09-02', text: 'Migrations now need a second reviewer.' },
      { date: '2026-07-14', text: 'Page created from the old deploy runbook.' },
    ],
  },
  {
    id: 'rollback',
    title: 'Rollback steps',
    aliases: ['revert release'],
    group: 'runbooks',
    revision: 3,
    ago: 3 * DAY,
    current: `1. Freeze deploys: \`deploy freeze\`
2. Redeploy the previous tag from the deploy workflow
3. Post in **#status** every 15 minutes until the error rate is back to normal
4. Open the postmortem from the template within two working days`,
    history: [{ date: '2026-10-27', text: 'Step 3: status updates every 15 minutes, even when nothing changed.' }],
  },
  {
    id: 'on-call',
    title: 'On-call handover',
    aliases: ['pager', 'handoff'],
    group: 'runbooks',
    revision: 2,
    ago: 41 * DAY,
    current: `Handover happens Monday 10:00 in the team channel: open incidents, silenced alerts, anything flaky.

The outgoing person stays reachable until 12:00.`,
    history: [{ date: '2026-09-19', text: 'Handover moved from Friday to Monday morning.' }],
  },
  {
    id: 'code-review',
    title: 'Code review norms',
    aliases: ['PR review', 'review etiquette'],
    group: 'norms',
    revision: 5,
    ago: 26 * HOUR,
    current: `- Reviews within one working day; say so if you need longer
- Comment on the code, never the person
- **Blocking** comments start with \`must:\`; everything else is a suggestion
- Approve with nits when only nits are left — the author decides`,
    history: [
      { date: '2026-10-29', text: 'Added the `must:` prefix for blocking comments.' },
      { date: '2026-08-11', text: 'One working day instead of “as soon as possible”.' },
    ],
  },
  {
    id: 'naming',
    title: 'Naming conventions',
    aliases: ['branch names', 'commit style'],
    group: 'norms',
    revision: 1,
    ago: 64 * DAY,
    current: `Branches: \`feat/…\`, \`fix/…\`, \`chore/…\`. Commit subjects in English, imperative, under 72 characters.`,
    history: [],
  },
  {
    id: 'release-calendar',
    title: 'Release calendar',
    aliases: ['release train', 'freeze dates'],
    group: 'reference',
    revision: 4,
    ago: 12 * DAY,
    current: `| Release | Code freeze | Ships |
| --- | --- | --- |
| 2026.11 | Nov 6 | Nov 12 |
| 2026.12 | Dec 4 | Dec 10 |

No releases between Dec 21 and Jan 4.`,
    history: [{ date: '2026-10-18', text: 'December freeze moved one day earlier.' }],
  },
  {
    id: 'staging-hosts',
    title: 'Staging hosts',
    aliases: ['staging', 'preprod'],
    group: 'reference',
    revision: 9,
    ago: 5 * DAY,
    current: `- **api** — staging-api.internal, read-only database replica
- **web** — staging.example.com, resets every night at 03:00
- **jobs** — staging-jobs.internal, queue drained on deploy`,
    history: [
      { date: '2026-10-25', text: 'The web host now resets nightly.' },
      { date: '2026-10-02', text: 'Moved the API to the read-only replica.' },
    ],
  },
  {
    id: 'glossary',
    title: 'Glossary',
    aliases: ['terms'],
    revision: 1,
    ago: 9 * DAY,
    current: `**Canary** — the first 5 % of traffic on a new release.\n\n**Freeze** — no merges to the release branch.`,
    history: [],
  },
];

const KO_GROUPS: KnowledgePageGroup[] = [
  { id: 'runbooks', label: '운영 절차' },
  { id: 'norms', label: '팀 규칙' },
  { id: 'reference', label: '참고' },
];

const KO_PAGES: Seed[] = [
  {
    id: 'deploy-checklist',
    title: '배포 체크리스트',
    aliases: ['출시 점검', 'go-live'],
    group: 'runbooks',
    revision: 7,
    ago: 2 * HOUR,
    current: `운영 배포는 항상 \`release/*\` 브랜치와 배포 워크플로로 나갑니다. \`main\`에 바로 푸시하지 않습니다.

## 배포 전
- 릴리스 브랜치 CI 통과 (e2e 포함)
- 마이그레이션은 두 번째 리뷰어 확인
- 15분 전에 **#deploys** 채널에 공지

## 배포 후
- 릴리스 태그를 달고 마일스톤을 닫습니다
- 되돌릴 때는 revert 대신 이전 태그로 다시 배포합니다`,
    history: [
      { date: '2026-10-21', text: '10월 롤백 이후 카나리 관찰 시간을 5분에서 10분으로 늘림.' },
      { date: '2026-07-14', text: '예전 배포 런북에서 옮겨 와 페이지를 만듦.' },
    ],
  },
  {
    id: 'rollback',
    title: '롤백 절차',
    aliases: ['되돌리기'],
    group: 'runbooks',
    revision: 2,
    ago: 3 * DAY,
    current: `1. \`deploy freeze\`로 배포를 멈춥니다\n2. 이전 태그를 다시 배포합니다\n3. 정상화될 때까지 15분마다 **#status**에 알립니다`,
    history: [],
  },
  {
    id: 'code-review',
    title: '코드 리뷰 원칙',
    aliases: ['PR 리뷰'],
    group: 'norms',
    revision: 5,
    ago: 26 * HOUR,
    current: `- 리뷰는 영업일 하루 안에 합니다\n- 사람이 아니라 코드에 대해 말합니다\n- 꼭 고쳐야 하는 코멘트는 \`must:\`로 시작합니다`,
    history: [{ date: '2026-10-29', text: '막는 코멘트에 `must:` 접두어를 쓰기로 함.' }],
  },
  {
    id: 'release-calendar',
    title: '릴리스 일정',
    aliases: ['코드 프리즈'],
    group: 'reference',
    revision: 4,
    ago: 12 * DAY,
    current: `| 릴리스 | 코드 프리즈 | 출시 |\n| --- | --- | --- |\n| 2026.11 | 11월 6일 | 11월 12일 |\n| 2026.12 | 12월 4일 | 12월 10일 |`,
    history: [],
  },
  {
    id: 'staging-hosts',
    title: '스테이징 서버',
    aliases: ['staging', '사전 운영'],
    group: 'reference',
    revision: 9,
    ago: 5 * DAY,
    current: `- **api** — staging-api.internal, 읽기 전용 DB 복제본\n- **web** — staging.example.com, 매일 03:00 초기화`,
    history: [{ date: '2026-10-25', text: 'web 서버를 매일 밤 초기화하도록 바꿈.' }],
  },
];

const summary = (p: KnowledgePage): KnowledgePageSummary => ({
  id: p.id,
  title: p.title,
  aliases: p.aliases,
  group: p.group,
  updatedAt: p.updatedAt,
});

interface HostOptions {
  seeds: Seed[];
  groups?: KnowledgePageGroup[];
  selected?: string | null;
  lang?: 'en' | 'ko';
  readOnly?: boolean;
  /** Pages the "server" already holds in a newer version than the one first shown (a save from elsewhere). */
  newer?: Record<string, Partial<KnowledgePage>>;
  /** A conflict message shown with the first data. */
  conflict?: string;
  height?: number;
  /** A phone-sized box instead of the wide preview. */
  maxWidth?: number;
}

/**
 * A tiny host: a page "server" in memory. Selecting loads the page after a short delay, Save writes it (and the
 * list), Delete removes it, Reload fetches the server's copy. A save over a stale revision is refused with a
 * conflict — like a 409 — and the editor keeps the draft.
 */
function make(o: HostOptions): HTMLElement {
  const el = document.createElement('ui-knowledge-pages') as UiKnowledgePages;
  if (o.lang) el.setAttribute('lang', o.lang);
  el.style.height = `${o.height ?? 600}px`;
  if (o.maxWidth) {
    el.style.maxWidth = `${o.maxWidth}px`;
    el.style.margin = '0 auto';
  }
  const ko = o.lang === 'ko';
  const T = ko
    ? {
        saved: '저장했습니다',
        created: '페이지를 만들었습니다',
        deleted: (t: string) => `“${t}” 페이지를 지웠습니다`,
        conflict: '다른 곳에서 이 페이지를 먼저 고쳤습니다.',
      }
    : {
        saved: 'Saved',
        created: 'Page created',
        deleted: (t: string) => `Deleted “${t}”`,
        conflict: 'Someone saved a newer version of this page while you were editing.',
      };
  const now = Date.now();
  const server = new Map<string, KnowledgePage>();
  for (const { ago, ...p } of o.seeds) server.set(p.id, { ...structuredClone(p), updatedAt: now - ago });
  const shown = (id: string | null | undefined) => (id ? (structuredClone(server.get(id)) ?? null) : null);
  const first = shown(o.selected);
  for (const [id, patch] of Object.entries(o.newer ?? {})) {
    const p = server.get(id);
    if (p) server.set(id, { ...p, ...patch, updatedAt: now - 4 * MIN });
  }
  const list = () => [...server.values()].map(summary);
  let data: KnowledgePagesData = {
    pages: list(),
    groups: o.groups,
    selected: o.selected ?? null,
    page: first,
    readOnly: o.readOnly,
    conflict: o.conflict,
  };
  const push = (patch: Partial<KnowledgePagesData>) => {
    data = { ...data, ...patch };
    el.data = data;
  };
  let seq = 0;
  let loadTimer = 0;
  const load = (id: string, after = 360) => {
    clearTimeout(loadTimer);
    loadTimer = window.setTimeout(() => {
      if (data.selected === id) push({ page: shown(id), loading: false });
    }, after);
  };

  el.addEventListener('ui-select', (e) => {
    const { id } = (e as CustomEvent<KnowledgeSelectDetail>).detail;
    push({ selected: id, loading: true, status: undefined, error: undefined, conflict: undefined });
    load(id);
  });
  el.addEventListener('ui-new', () => push({ status: undefined, error: undefined, conflict: undefined }));
  el.addEventListener('ui-reload', (e) => {
    const { id } = (e as CustomEvent<KnowledgeReloadDetail>).detail;
    push({ loading: true, conflict: undefined, error: undefined, status: undefined });
    load(id, 300);
  });
  el.addEventListener('ui-save', (e) => {
    const d = (e as CustomEvent<KnowledgeSaveDetail>).detail;
    push({ saving: true, status: undefined, error: undefined });
    window.setTimeout(() => {
      const old = d.id ? server.get(d.id) : undefined;
      if (old && !d.overwrite && d.revision != null && String(d.revision) !== String(old.revision ?? '')) {
        push({ saving: false, conflict: T.conflict });
        return;
      }
      const id = d.id ?? `page-${++seq}`;
      const page: KnowledgePage = {
        id,
        title: d.title,
        aliases: d.aliases,
        group: d.group ?? old?.group,
        current: d.current,
        history: d.history,
        revision: Number(old?.revision ?? 0) + 1,
        updatedAt: Date.now(),
      };
      server.set(id, page);
      push({
        pages: list(),
        selected: id,
        page: structuredClone(page),
        saving: false,
        conflict: undefined,
        status: d.id ? T.saved : T.created,
      });
    }, 520);
  });
  el.addEventListener('ui-delete', (e) => {
    const { id } = (e as CustomEvent<KnowledgeDeleteDetail>).detail;
    const title = server.get(id)?.title ?? '';
    window.setTimeout(() => {
      server.delete(id);
      push({
        pages: list(),
        selected: null,
        page: null,
        status: T.deleted(title),
        conflict: undefined,
        error: undefined,
      });
    }, 260);
  });
  el.data = data;
  return el;
}

export const doc: ComponentDoc = {
  slug: 'knowledge-pages',
  name: 'Knowledge Pages',
  tag: 'ui-knowledge-pages',
  group: 'Components',
  summary:
    'Long-lived notes, one page per topic — find a page, fix what is true now, and keep the dated record of how it changed.',
  description:
    'A master-detail editor: a searchable page list (title and aliases, grouped under headings, each with its last update) beside the open page — title, aliases, a markdown Current with an Edit / Preview toggle, and dated History entries to add, edit or remove. Save is the one primary (also ⌘S / Ctrl+S); Delete takes two presses. Unsaved changes are kept per page and never lost to a data update; switching away asks first. The host loads the open page after `ui-select` and answers every write by sending new `data` — including a conflict, which keeps the draft and offers Reload.',
  usedIn: 'soma-work dashboard › 설정 › 기억 › 지식 페이지 (page list, page editor, raw mode, history, 409 conflict)',
  reference: {
    name: 'Apple HIG — Split views',
    url: 'https://developer.apple.com/design/human-interface-guidelines/split-views',
  },
  props: [
    {
      name: 'data.pages',
      type: 'KnowledgePageSummary[]',
      required: true,
      description:
        'The list: `{ id, title, aliases?, group?, updatedAt? }`. `updatedAt` is epoch ms, ISO or `YYYY-MM-DD`.',
    },
    {
      name: 'data.groups',
      type: '{ id: string; label: string }[]',
      description:
        'List headings, in order. Pages without a known group go under “Other”. Without groups the list is flat.',
    },
    {
      name: 'data.selected',
      type: 'string | null',
      description: 'The open page. A changed value opens that page; an unchanged one keeps the local selection.',
    },
    {
      name: 'data.page',
      type: 'KnowledgePage | null',
      description:
        'The open page’s content: `{ id, title, aliases?, group?, current, history?: { date, text }[], revision?, updatedAt? }`. Load it after `ui-select`.',
    },
    {
      name: 'data.loading',
      type: 'boolean',
      default: 'false',
      description: 'The open page is loading: a skeleton (an editor holding unsaved changes stays).',
    },
    {
      name: 'data.saving',
      type: 'boolean',
      default: 'false',
      description: 'A write is in flight: fields are read-only, Save says “Saving…”, switching waits.',
    },
    {
      name: 'data.error',
      type: 'string',
      description: 'The last refused write, as an alert in the editor (fail tone).',
    },
    {
      name: 'data.status',
      type: 'string',
      description: 'A quiet confirmation (“Saved”) shown while there are no unsaved changes.',
    },
    {
      name: 'data.conflict',
      type: 'string',
      description:
        'The page changed elsewhere (409). The draft stays; the alert offers Reload (drops the draft, `ui-reload`) and, with unsaved changes, Overwrite (`ui-save` with `overwrite: true`).',
    },
    {
      name: 'data.readOnly',
      type: 'boolean',
      default: 'false',
      description: 'No New, no editing: pages open in a reading view.',
    },
    {
      name: 'data.now',
      type: 'number',
      description: 'Clock for the relative times (tests). Default: Date.now(), refreshed every 30 s.',
    },
    {
      name: 'dirty',
      type: 'boolean',
      description: 'Read-only property: some page (or the new page) holds unsaved changes.',
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
      name: 'ui-select',
      detail: '{ id: string }',
      description:
        'A page was opened (after the unsaved-changes question, if any). Load it into `data.page`. preventDefault() keeps the current page.',
    },
    { name: 'ui-new', detail: '{}', description: 'New page. preventDefault() keeps the current editor.' },
    {
      name: 'ui-save',
      detail:
        '{ id: string | null; title: string; aliases: string[]; group?: string; current: string; history: { date, text }[]; revision?: string | number; overwrite?: true }',
      description:
        'Save or ⌘S with unsaved changes and a title. `id: null` = a new page (pick the id, then send it as `selected` + `page`). Cleaned: title trimmed, aliases split and de-duplicated, empty history entries dropped. Answer with `saving`, then the saved page — or `error` / `conflict`.',
    },
    {
      name: 'ui-delete',
      detail: '{ id: string; revision?: string | number }',
      description: 'Second press of Delete within 4 s. Remove the page from `pages`; its draft goes with it.',
    },
    {
      name: 'ui-reload',
      detail: '{ id: string }',
      description: 'Reload after a conflict: the draft is dropped; send the current page.',
    },
  ],
  keyboard: [
    ['↑ / ↓', 'Move through the page list (one tab stop, roving tabindex); ↓ from search enters the list'],
    ['Home / End', 'First / last page'],
    ['Enter', 'Open the focused page'],
    ['⌘S / Ctrl+S', 'Save, anywhere in the editor'],
    ['Esc', 'Keep editing (unsaved-changes question) · disarm Delete · clear the search'],
    ['Enter (held)', 'Repeats never activate a button — a held key cannot confirm Delete'],
  ],
  a11y: [
    'A labelled section; the list column is a group with a search box and one list per heading (aria-labelledby the heading).',
    'The open page row carries aria-current; a row with unsaved changes says so to screen readers, not by its dot alone.',
    'Fields have visible labels; an empty title is aria-invalid with a described hint. Save stays focusable when it cannot act (aria-disabled).',
    'The unsaved-changes question is an inline group that takes focus (Keep editing first); Esc keeps editing.',
    'Delete arms with the word “Delete?” and a polite announcement; Esc, blur or 4 s disarm. Errors and conflicts are role="alert" with icon + words.',
    'Below 640 px container width one column shows at a time, with “All pages” to go back; targets are 44 px on touch and narrow screens.',
    'Reduced motion: no press scale; new history rows fade only.',
  ],
  usage: `<ui-knowledge-pages style="height: 640px"></ui-knowledge-pages>
<script type="module">
  import '@2lab.ai/ui/knowledge-pages';
  const el = document.querySelector('ui-knowledge-pages');
  let data = { pages: await api('GET', '/pages'), groups: [{ id: 'runbooks', label: 'Runbooks' }] };
  const push = (patch) => { data = { ...data, ...patch }; el.data = data; };
  push({});
  el.addEventListener('ui-select', async (e) => {
    push({ selected: e.detail.id, loading: true, status: '' });
    push({ page: await api('GET', '/pages/' + e.detail.id), loading: false });
  });
  el.addEventListener('ui-save', async (e) => {
    push({ saving: true, error: '', status: '' });
    const r = await fetch('/pages/' + (e.detail.id ?? ''), { method: e.detail.id ? 'PUT' : 'POST', body: JSON.stringify(e.detail) });
    if (r.status === 409) return push({ saving: false, conflict: 'Someone saved a newer version.' });
    if (!r.ok) return push({ saving: false, error: 'Couldn’t save: ' + r.status });
    const page = await r.json();
    push({ saving: false, conflict: '', status: 'Saved', page, selected: page.id, pages: await api('GET', '/pages') });
  });
  el.addEventListener('ui-delete', async (e) => {
    await api('DELETE', '/pages/' + e.detail.id);
    push({ pages: await api('GET', '/pages'), selected: null, page: null, status: 'Deleted' });
  });
  el.addEventListener('ui-reload', async (e) => push({ conflict: '', page: await api('GET', '/pages/' + e.detail.id) }));
</script>`,
  demos: [
    {
      id: 'default',
      title: 'Default',
      description:
        'A live editor over an in-memory "server": open a page (it loads in ~0.4 s), edit, ⌘S — the list updates and says Saved. Switch with unsaved changes to see the question; Delete takes two presses.',
      height: 640,
      frame: false,
      create: () => make({ seeds: PAGES, groups: GROUPS, selected: 'deploy-checklist' }),
    },
    {
      id: 'conflict',
      title: 'Changed elsewhere',
      description:
        'The page was saved from another tab after this one loaded it. Edit and Save: the server refuses the stale revision, the draft stays, and Reload or Overwrite decide.',
      height: 640,
      frame: false,
      create: () =>
        make({
          seeds: PAGES,
          groups: GROUPS,
          selected: 'staging-hosts',
          newer: {
            'staging-hosts': {
              revision: 10,
              current: `${PAGES[6].current}\n- **search** — staging-search.internal, rebuilt on deploy`,
            },
          },
          conflict: 'Someone saved a newer version of this page 4 minutes ago.',
        }),
    },
    {
      id: 'ko',
      title: '한국어 (lang="ko")',
      height: 600,
      frame: false,
      create: () => make({ seeds: KO_PAGES, groups: KO_GROUPS, selected: 'code-review', lang: 'ko' }),
    },
    {
      id: 'narrow',
      title: 'Narrow',
      description: 'Under 640 px of width the list and the page stack: open a page, then “All pages” to go back.',
      height: 600,
      frame: false,
      create: () => make({ seeds: PAGES, groups: GROUPS, selected: null, maxWidth: 360, height: 560 }),
    },
    {
      id: 'empty',
      title: 'No pages yet',
      description: 'Nothing saved yet: New page opens an empty editor; Create page adds the first page to the list.',
      height: 460,
      frame: false,
      create: () => make({ seeds: [], groups: GROUPS, height: 420 }),
    },
    {
      id: 'readonly',
      title: 'Read only',
      description: 'readOnly: no New, no Save or Delete — pages open in a reading view with the rendered markdown.',
      height: 600,
      frame: false,
      create: () => make({ seeds: PAGES, groups: GROUPS, selected: 'code-review', readOnly: true }),
    },
  ],
};
