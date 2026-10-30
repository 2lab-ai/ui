import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import { doc } from './docs';
import {
  cleanHistory,
  filterPages,
  groupPages,
  isDirty,
  isoDay,
  KNOWLEDGE_ARM_GUARD_MS,
  KNOWLEDGE_ARM_MS,
  type KnowledgePage,
  type KnowledgePageSummary,
  type KnowledgePagesData,
  type KnowledgeSaveDetail,
  knowledgeAgo,
  knowledgeTime,
  parseAliases,
  type UiKnowledgePages,
} from './knowledge-pages';
import { styles } from './styles';

const XSS = '<img src=x onerror=alert(1)>';
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 9, 30, 12, 0, 0).getTime();

const GROUPS = [
  { id: 'runbooks', label: 'Runbooks' },
  { id: 'norms', label: 'Team norms' },
];
const PAGES: KnowledgePageSummary[] = [
  {
    id: 'deploy',
    title: 'Deploy checklist',
    aliases: ['ship list', 'go-live'],
    group: 'runbooks',
    updatedAt: NOW - 2 * HOUR,
  },
  { id: 'rollback', title: 'Rollback steps', aliases: ['revert'], group: 'runbooks', updatedAt: NOW - 3 * DAY },
  { id: 'review', title: 'Code review norms', aliases: ['PR review'], group: 'norms', updatedAt: '2026-08-01' },
  { id: 'glossary', title: 'Glossary', updatedAt: NOW - 9 * DAY },
];
const PAGE = (over: Partial<KnowledgePage> = {}): KnowledgePage => ({
  id: 'deploy',
  title: 'Deploy checklist',
  aliases: ['ship list', 'go-live'],
  group: 'runbooks',
  current: 'Use **release** branches.',
  history: [{ date: '2026-10-21', text: 'Canary window is 10 minutes.' }],
  revision: 7,
  ...over,
});
const BASE = (over: Partial<KnowledgePagesData> = {}): KnowledgePagesData => ({
  pages: PAGES,
  groups: GROUPS,
  selected: 'deploy',
  page: PAGE(),
  now: NOW,
  ...over,
});

function mount(data: KnowledgePagesData = BASE(), attrs: Record<string, string> = {}): UiKnowledgePages {
  const el = document.createElement('ui-knowledge-pages') as UiKnowledgePages;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const sr = (el: UiKnowledgePages) => el.shadowRoot!;
const q = <E extends Element = HTMLElement>(el: UiKnowledgePages, s: string) => sr(el).querySelector<E>(s);
const qa = <E extends Element = HTMLElement>(el: UiKnowledgePages, s: string) =>
  Array.from(sr(el).querySelectorAll<E>(s));
const byKey = (el: UiKnowledgePages, key: string) => qa(el, '[data-key]').find((b) => b.dataset.key === key) ?? null;
const click = (el: UiKnowledgePages, key: string) => {
  const b = byKey(el, key);
  if (!b) throw new Error(`no [data-key="${key}"]`);
  b.click();
  el.renderNow();
};
const field = <E extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement = HTMLInputElement>(
  el: UiKnowledgePages,
  f: string,
) => q<E>(el, `[data-f="${f}"]`)!;
const type = (el: UiKnowledgePages, f: string, value: string, target?: HTMLInputElement | HTMLTextAreaElement) => {
  const i = target ?? field(el, f);
  i.value = value;
  i.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  el.renderNow();
  return i;
};
const key = (target: Element, k: string, init: KeyboardEventInit = {}) => {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(ev);
  return ev;
};
const listen = <T = unknown>(el: UiKnowledgePages, name: string, prevent = false) => {
  const got: T[] = [];
  el.addEventListener(name, (e) => {
    got.push((e as CustomEvent<T>).detail);
    if (prevent) e.preventDefault();
  });
  return got;
};
const active = (el: UiKnowledgePages) => (sr(el).activeElement as HTMLElement | null)?.dataset?.key ?? null;
const rowTitles = (el: UiKnowledgePages) => qa(el, '.kp-row-title').map((r) => r.textContent);
const save = (el: UiKnowledgePages) => byKey(el, 'save')!;

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

// ── helpers ──

describe('helpers', () => {
  it('filterPages matches every word in the title or an alias, case-insensitively, keeping order', () => {
    expect(filterPages(PAGES, '').map((p) => p.id)).toEqual(['deploy', 'rollback', 'review', 'glossary']);
    expect(filterPages(PAGES, '  DEPLOY ').map((p) => p.id)).toEqual(['deploy']);
    expect(filterPages(PAGES, 'go-live').map((p) => p.id)).toEqual(['deploy']);
    expect(filterPages(PAGES, 'pr REV').map((p) => p.id)).toEqual(['review']);
    expect(filterPages(PAGES, 'deploy revert')).toEqual([]);
    expect(filterPages(PAGES, 'nothing')).toEqual([]);
    expect(filterPages(null as unknown as KnowledgePageSummary[], 'x')).toEqual([]);
  });

  it('groupPages follows the groups order, drops empty groups and lists the rest last', () => {
    const blocks = groupPages(PAGES, [
      { id: 'norms', label: 'Team norms' },
      ...GROUPS,
      { id: 'empty', label: 'Empty' },
    ]);
    expect(blocks.map((b) => [b.id, b.label, b.pages.map((p) => p.id)])).toEqual([
      ['norms', 'Team norms', ['review']],
      ['runbooks', 'Runbooks', ['deploy', 'rollback']],
      [null, null, ['glossary']],
    ]);
    expect(groupPages(PAGES).map((b) => [b.id, b.pages.length])).toEqual([[null, 4]]);
    expect(groupPages([], GROUPS)).toEqual([]);
  });

  it('isDirty compares what would be saved: trimmed title, cleaned aliases, Current without trailing space, non-empty history', () => {
    const p = PAGE();
    const same = {
      title: ' Deploy checklist ',
      aliases: 'ship list,  go-live, ship list',
      current: `${p.current}\n\n  `,
      history: [...p.history!, { date: ' ', text: '' }],
    };
    expect(isDirty(p, same)).toBe(false);
    expect(isDirty(p, { ...same, title: 'Deploy list' })).toBe(true);
    expect(isDirty(p, { ...same, aliases: ['ship list'] })).toBe(true);
    expect(isDirty(p, { ...same, current: 'Other' })).toBe(true);
    expect(isDirty(p, { ...same, history: [{ date: '2026-10-21', text: 'Canary window is 5 minutes.' }] })).toBe(true);
    expect(isDirty(null, { title: '', aliases: '', current: '', history: [] })).toBe(false);
    expect(isDirty(null, { title: '', aliases: '', current: 'x', history: [] })).toBe(true);
    expect(isDirty(p, null)).toBe(false);
  });

  it('parseAliases and cleanHistory clean what the editor holds', () => {
    expect(parseAliases(' a, b ,, a ,c ')).toEqual(['a', 'b', 'c']);
    expect(parseAliases([' x ', '', 'x', 'y'])).toEqual(['x', 'y']);
    expect(parseAliases(undefined)).toEqual([]);
    expect(cleanHistory([{ date: ' 2026-01-02 ', text: ' t ' }, { date: '', text: ' ' }, null, 'x'])).toEqual([
      { date: '2026-01-02', text: 't' },
    ]);
    expect(cleanHistory('nope')).toEqual([]);
  });

  it('reads times and words them relative to now, then as a date', () => {
    expect(knowledgeTime('2026-08-01')).toBe(new Date(2026, 7, 1).getTime());
    expect(knowledgeTime(5)).toBe(5);
    expect(knowledgeTime('garbage')).toBeNull();
    expect(knowledgeAgo(NOW - 2 * HOUR, NOW)).toBe('2h ago');
    expect(knowledgeAgo(NOW - 2 * HOUR, NOW, 'ko')).toBe('2시간 전');
    expect(knowledgeAgo(NOW - 3 * DAY, NOW, 'ko')).toBe('3일 전');
    expect(knowledgeAgo('2026-08-01', NOW)).toMatch(/Aug\s+1/);
    expect(knowledgeAgo('2025-03-04', NOW)).toMatch(/2025/);
    expect(knowledgeAgo('someday', NOW)).toBe('someday');
    expect(isoDay(new Date(2026, 0, 5, 23, 0).getTime())).toBe('2026-01-05');
  });
});

// ── rendering ──

describe('<ui-knowledge-pages> rendering', () => {
  it('renders nothing without data', () => {
    const el = document.createElement('ui-knowledge-pages') as UiKnowledgePages;
    document.body.append(el);
    el.renderNow();
    expect(q(el, '.kp')).toBeNull();
  });

  it('lists the pages under their group headings with counts, aliases and a dated relative time', () => {
    const el = mount();
    expect(qa(el, '.kp-gh .kp-gl').map((h) => h.textContent)).toEqual(['Runbooks', 'Team norms', 'Other']);
    expect(qa(el, '.kp-gh .kp-gn').map((h) => h.textContent)).toEqual(['2', '1', '1']);
    expect(rowTitles(el)).toEqual(['Deploy checklist', 'Rollback steps', 'Code review norms', 'Glossary']);
    expect(q(el, '.kp-row-alias')?.textContent).toBe('ship list · go-live');
    const t = q(el, '.kp-row time')!;
    expect(t.textContent).toBe('2h ago');
    expect(t.getAttribute('title')).toMatch(/2026/);
    expect(t.getAttribute('datetime')).toBe(new Date(NOW - 2 * HOUR).toISOString());
    expect(qa(el, '.kp-rows')[0].getAttribute('aria-labelledby')).toBe(q(el, '.kp-gh')!.id);
    expect(q(el, '[data-id="deploy"]')!.getAttribute('aria-current')).toBe('true');
  });

  it('is one flat list without groups', () => {
    const el = mount(BASE({ groups: undefined }));
    expect(q(el, '.kp-gh')).toBeNull();
    expect(qa(el, '.kp-rows')).toHaveLength(1);
    expect(q(el, '.kp-rows')!.getAttribute('aria-label')).toBe('Pages');
  });

  it('opens the page in the editor: fields hold its values, Save is the one primary and starts disabled', () => {
    const el = mount();
    expect(field(el, 'title').value).toBe('Deploy checklist');
    expect(field(el, 'aliases').value).toBe('ship list, go-live');
    expect(field<HTMLTextAreaElement>(el, 'current').value).toBe('Use **release** branches.');
    expect(field(el, 'hdate').value).toBe('2026-10-21');
    expect(field<HTMLTextAreaElement>(el, 'htext').value).toBe('Canary window is 10 minutes.');
    expect(q(el, '.kp-meta .kp-chip')?.textContent).toBe('Runbooks');
    expect(qa(el, '.is-primary')).toHaveLength(1);
    expect(save(el).getAttribute('aria-disabled')).toBe('true');
    expect(save(el).textContent).toBe('Save');
    expect(q(el, '.kp-detail')!.getAttribute('aria-label')).toBe('Deploy checklist');
  });

  it('shows an empty state with New page when there are no pages; read-only hides New', () => {
    const el = mount({ pages: [], now: NOW });
    expect(q(el, '.kp-empty-t')?.textContent).toBe('No pages yet');
    expect(byKey(el, 'new-empty')).not.toBeNull();
    const ro = mount({ pages: [], readOnly: true, now: NOW });
    expect(byKey(ro, 'new-empty')).toBeNull();
  });

  it('asks to pick a page when nothing is selected, and shows the status there', () => {
    const el = mount(BASE({ selected: null, page: null, status: 'Deleted “Glossary”' }));
    expect(q(el, '.kp-pick')?.textContent).toContain('Pick a page on the left');
    expect(q(el, '.kp-pick .kp-saved')?.textContent).toBe('Deleted “Glossary”');
    expect(q(el, '.kp')!.dataset.view).toBe('list');
  });

  it('shows a skeleton while the selected page is not loaded or loading', () => {
    const el = mount(BASE({ selected: 'rollback' }));
    expect(q(el, '.kp-skel')).not.toBeNull();
    expect(q(el, '.kp-skel [role="status"]')?.textContent).toBe('Loading page…');
    const l = mount(BASE({ loading: true }));
    expect(q(l, '.kp-skel')).not.toBeNull();
    expect(q(l, '.kp-edit')).toBeNull();
  });

  it('filters by search with a no-match line and Clear search', () => {
    const el = mount();
    type(el, 'q', 'revert');
    expect(rowTitles(el)).toEqual(['Rollback steps']);
    type(el, 'q', 'zzz');
    expect(q(el, '.kp-nomatch')?.textContent).toContain('No pages match “zzz”');
    click(el, 'clear-q');
    expect(rowTitles(el)).toHaveLength(4);
    expect(field(el, 'q').value).toBe('');
    type(el, 'q', 'deploy');
    key(field(el, 'q'), 'Escape');
    el.renderNow();
    expect(rowTitles(el)).toHaveLength(4);
  });

  it('previews Current as markdown and switches back to the editor', () => {
    const el = mount();
    click(el, 'mode-preview');
    expect(q(el, '.kp-preview .md-doc strong')?.textContent).toBe('release');
    expect(q(el, '.kp-cur')!.hidden).toBe(true);
    expect(byKey(el, 'mode-preview')!.getAttribute('aria-pressed')).toBe('true');
    click(el, 'mode-edit');
    expect(q(el, '.kp-preview')).toBeNull();
    expect(q(el, '.kp-cur')!.hidden).toBe(false);
  });

  it('read-only opens a reading view: rendered markdown, alias chips, history, no Save or New', () => {
    const el = mount(BASE({ readOnly: true }));
    expect(q(el, '.kp-read-title')?.textContent).toBe('Deploy checklist');
    expect(qa(el, '.kp-aliases li').map((a) => a.textContent)).toEqual(['ship list', 'go-live']);
    expect(q(el, '.kp-read .md-doc strong')?.textContent).toBe('release');
    expect(q(el, '.kp-read-hist .kp-read-date')?.textContent).toBe('2026-10-21');
    expect(byKey(el, 'save')).toBeNull();
    expect(byKey(el, 'new')).toBeNull();
    expect(q(el, 'input[data-f="title"]')).toBeNull();
  });

  it('shows the error as an alert and the status only while clean', () => {
    const el = mount(BASE({ error: 'Couldn’t save: 500', status: 'Saved' }));
    expect(q(el, '.kp-alert.is-fail')?.getAttribute('role')).toBe('alert');
    expect(q(el, '.kp-alert.is-fail .kp-alert-t')?.textContent).toBe('Couldn’t save: 500');
    expect(q(el, '.kp-foot .kp-saved')?.textContent).toBe('Saved');
    type(el, 'title', 'Deploy list');
    expect(q(el, '.kp-foot .kp-saved')).toBeNull();
    expect(q(el, '.kp-foot .kp-unsaved')?.textContent).toBe('Unsaved changes');
    expect(q(el, '[data-id="deploy"] .kp-dot')).not.toBeNull();
    expect(q(el, '[data-id="deploy"] .sr-only')?.textContent).toBe(', unsaved changes');
  });

  it('saving makes the fields read-only and Save says Saving…', () => {
    const el = mount();
    type(el, 'title', 'Deploy list');
    el.data = { ...BASE(), saving: true };
    el.renderNow();
    expect(field(el, 'title').hasAttribute('readonly')).toBe(true);
    expect(save(el).textContent).toBe('Saving…');
    expect(save(el).getAttribute('aria-busy')).toBe('true');
    expect(field(el, 'title').value).toBe('Deploy list');
  });
});

// ── escaping ──

describe('escaping', () => {
  it('escapes every host string: titles, aliases, group labels, markdown, history, error, conflict, status, query', () => {
    const page = PAGE({
      title: XSS,
      aliases: [XSS],
      current: `# ${XSS}\n\n${XSS} [x](javascript:alert(1))`,
      history: [{ date: XSS, text: XSS }],
    });
    const pages = [{ ...PAGES[0], title: XSS, aliases: [XSS], updatedAt: XSS }, ...PAGES.slice(1)];
    const data = BASE({
      pages,
      groups: [{ id: 'runbooks', label: XSS }],
      page,
      error: XSS,
      conflict: XSS,
      status: XSS,
    });
    const el = mount(data);
    click(el, 'mode-preview');
    type(el, 'q', `${XSS} zz`);
    const check = (e: UiKnowledgePages) => {
      expect(sr(e).querySelector('img')).toBeNull();
      expect(sr(e).querySelector('[onerror]')).toBeNull();
      expect(sr(e).querySelector('a[href^="javascript"]')).toBeNull();
    };
    check(el);
    expect(q(el, '.kp-alert.is-fail .kp-alert-t')?.textContent).toBe(XSS);
    expect(q(el, '.kp-alert.is-wait .kp-alert-t')?.textContent).toBe(XSS);
    expect(q(el, '.kp-nomatch')?.textContent).toContain(XSS);
    expect(q(el, '.kp-preview')?.textContent).toContain(XSS);
    expect(field(el, 'title').value).toBe(XSS);
    expect(field(el, 'hdate').value).toBe(XSS);
    click(el, 'clear-q');
    expect(q(el, '.kp-row-title')?.textContent).toBe(XSS);
    expect(q(el, '.kp-row-alias')?.textContent).toBe(XSS);
    expect(q(el, '.kp-gl')?.textContent).toBe(XSS);
    expect(q(el, '.kp-row .kp-ago')?.textContent).toBe(XSS);
    check(el);

    const ro = mount({ ...data, readOnly: true, error: undefined, conflict: undefined });
    check(ro);
    expect(q(ro, '.kp-read-title')?.textContent).toBe(XSS);
    expect(q(ro, '.kp-read-hist p')?.textContent).toBe(XSS);
    expect(q(ro, '.kp-read-date')?.textContent).toBe(XSS);
    expect(q(ro, '.kp-aliases li')?.textContent).toBe(XSS);

    const empty = mount({ pages: [], status: XSS, now: NOW });
    check(empty);
    expect(q(empty, '.kp-saved')?.textContent).toBe(XSS);
  });

  it('keeps a quote-breaking id inside its attribute', () => {
    const id = `x" onclick="alert(1)`;
    const el = mount({
      pages: [{ id, title: 'Odd' }],
      selected: id,
      page: { id, title: 'Odd', current: '' },
      now: NOW,
    });
    const row = q(el, '.kp-row')!;
    expect(row.dataset.id).toBe(id);
    expect(row.hasAttribute('onclick')).toBe(false);
    expect(q(el, '.kp-edit')).not.toBeNull();
  });
});

// ── events ──

describe('events', () => {
  it('a row click sends ui-select { id } and opens the page; preventDefault keeps the current one', () => {
    const el = mount();
    const got = listen(el, 'ui-select');
    click(el, 'row|rollback');
    expect(got).toEqual([{ id: 'rollback' }]);
    expect(q(el, '[data-id="rollback"]')!.getAttribute('aria-current')).toBe('true');
    expect(q(el, '.kp-skel')).not.toBeNull();

    const kept = mount();
    listen(kept, 'ui-select', true);
    click(kept, 'row|rollback');
    expect(q(kept, '[data-id="deploy"]')!.getAttribute('aria-current')).toBe('true');
    expect(field(kept, 'title').value).toBe('Deploy checklist');
  });

  it('New sends ui-new {} and opens an empty editor with the first group; preventDefault keeps the page', () => {
    const el = mount();
    const got = listen(el, 'ui-new');
    click(el, 'new');
    expect(got).toEqual([{}]);
    expect(field(el, 'title').value).toBe('');
    expect(q(el, '.kp-chip.is-new')?.textContent).toBe('New page');
    expect(field<HTMLSelectElement>(el, 'group').value).toBe('runbooks');
    expect(save(el).textContent).toBe('Create page');
    expect(active(el)).toBe('f|title');

    const kept = mount();
    listen(kept, 'ui-new', true);
    click(kept, 'new');
    expect(field(kept, 'title').value).toBe('Deploy checklist');
  });

  it('Save sends the cleaned draft with id, group and revision', () => {
    const el = mount();
    const got = listen<KnowledgeSaveDetail>(el, 'ui-save');
    click(el, 'save');
    expect(got).toHaveLength(0);
    type(el, 'title', '  Deploy list ');
    type(el, 'aliases', 'ship list, , release, ship list');
    type(el, 'current', 'Release branches only.\n\n');
    click(el, 'h-add');
    const added = qa<HTMLTextAreaElement>(el, '[data-f="htext"]')[0];
    expect(field(el, 'hdate').value).toBe('2026-10-30');
    type(el, 'htext', 'Renamed the page.', added);
    expect(save(el).getAttribute('aria-disabled')).toBe('false');
    click(el, 'save');
    expect(got).toEqual([
      {
        id: 'deploy',
        title: 'Deploy list',
        aliases: ['ship list', 'release'],
        group: 'runbooks',
        current: 'Release branches only.',
        history: [
          { date: '2026-10-30', text: 'Renamed the page.' },
          { date: '2026-10-21', text: 'Canary window is 10 minutes.' },
        ],
        revision: 7,
      },
    ]);
  });

  it('an emptied title is flagged at once and Save stays off', () => {
    const el = mount();
    const got = listen<KnowledgeSaveDetail>(el, 'ui-save');
    type(el, 'title', '   ');
    expect(q(el, '.kp-hint.is-bad')?.textContent).toBe('A page needs a title');
    expect(field(el, 'title').getAttribute('aria-describedby')).toBe('kp-title-req');
    expect(save(el).getAttribute('aria-disabled')).toBe('true');
    key(field(el, 'title'), 's', { metaKey: true });
    expect(got).toHaveLength(0);
  });

  it('removes a history entry', () => {
    const el = mount();
    const got = listen<KnowledgeSaveDetail>(el, 'ui-save');
    click(el, `hr|${q(el, '[data-act="h-remove"]')!.dataset.h}`);
    expect(q(el, '.kp-h')).toBeNull();
    expect(q(el, '.kp-h-none')?.textContent).toBe('No entries yet');
    click(el, 'save');
    expect(got[0].history).toEqual([]);
  });

  it('a new page saves with id null and the picked group', () => {
    const el = mount();
    const got = listen<KnowledgeSaveDetail>(el, 'ui-save');
    click(el, 'new');
    type(el, 'current', 'Body');
    expect(save(el).getAttribute('aria-disabled')).toBe('true');
    expect(q(el, '.kp-hint.is-bad')).toBeNull();
    click(el, 'save');
    expect(got).toHaveLength(0);
    expect(active(el)).toBe('f|title');
    expect(q(el, '.kp-hint.is-bad')?.textContent).toBe('A page needs a title');
    expect(field(el, 'title').getAttribute('aria-invalid')).toBe('true');
    type(el, 'title', 'Staging hosts');
    const g = field<HTMLSelectElement>(el, 'group');
    g.value = 'norms';
    g.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.renderNow();
    click(el, 'save');
    expect(got).toEqual([
      { id: null, title: 'Staging hosts', aliases: [], group: 'norms', current: 'Body', history: [] },
    ]);
  });

  it('the host answers a new page with selected + page: the new draft is done', () => {
    const el = mount();
    click(el, 'new');
    type(el, 'title', 'Staging hosts');
    click(el, 'save');
    const page: KnowledgePage = {
      id: 'staging',
      title: 'Staging hosts',
      group: 'runbooks',
      current: '',
      history: [],
      revision: 1,
    };
    el.data = {
      ...BASE(),
      pages: [...PAGES, { id: 'staging', title: 'Staging hosts' }],
      selected: 'staging',
      page,
      status: 'Page created',
    };
    el.renderNow();
    expect(el.dirty).toBe(false);
    expect(q(el, '[data-id="staging"]')!.getAttribute('aria-current')).toBe('true');
    expect(q(el, '.kp-foot .kp-saved')?.textContent).toBe('Page created');
    expect(byKey(el, 'delete')).not.toBeNull();
  });

  it('⌘S / Ctrl+S anywhere in the element saves an open page (never the browser’s Save page); not while saving', () => {
    const el = mount();
    const got = listen<KnowledgeSaveDetail>(el, 'ui-save');
    const t = type(el, 'title', 'Deploy list');
    const ev = key(t, 's', { metaKey: true });
    expect(ev.defaultPrevented).toBe(true);
    expect(got).toHaveLength(1);
    el.data = { ...BASE(), saving: true };
    el.renderNow();
    key(field(el, 'title'), 's', { ctrlKey: true });
    expect(got).toHaveLength(1);
    el.data = { ...BASE(), page: PAGE({ title: 'Deploy list', revision: 8 }), status: 'Saved' };
    el.renderNow();
    type(el, 'title', 'Deploy list 2');
    const fromSearch = key(field(el, 'q'), 's', { ctrlKey: true });
    expect(fromSearch.defaultPrevented).toBe(true);
    expect(got).toHaveLength(2);
    key(field(el, 'title'), 'S', { ctrlKey: true });
    expect(got).toHaveLength(3);
  });

  it('the saved answer clears the draft; a refused save keeps it', () => {
    const el = mount();
    type(el, 'title', 'Deploy list');
    click(el, 'save');
    el.data = { ...BASE(), saving: false, error: 'Couldn’t save: 500' };
    el.renderNow();
    expect(field(el, 'title').value).toBe('Deploy list');
    expect(el.dirty).toBe(true);
    click(el, 'save');
    el.data = { ...BASE(), page: PAGE({ title: 'Deploy list', revision: 8 }), status: 'Saved' };
    el.renderNow();
    expect(el.dirty).toBe(false);
    expect(field(el, 'title').value).toBe('Deploy list');
    expect(save(el).getAttribute('aria-disabled')).toBe('true');
  });

  it('a conflict keeps the draft and offers Reload (ui-reload drops it) and Overwrite', () => {
    const el = mount();
    const saves = listen<KnowledgeSaveDetail>(el, 'ui-save');
    const reloads = listen(el, 'ui-reload');
    type(el, 'current', 'Mine');
    click(el, 'save');
    el.data = { ...BASE(), conflict: 'Someone saved a newer version.' };
    el.renderNow();
    expect(q(el, '.kp-alert.is-wait')?.getAttribute('role')).toBe('alert');
    expect(field<HTMLTextAreaElement>(el, 'current').value).toBe('Mine');
    click(el, 'overwrite');
    expect(saves.at(-1)).toMatchObject({ id: 'deploy', current: 'Mine', revision: 7, overwrite: true });
    el.data = { ...BASE(), conflict: 'Someone saved a newer version.' };
    el.renderNow();
    click(el, 'reload');
    expect(reloads).toEqual([{ id: 'deploy' }]);
    expect(el.dirty).toBe(false);
    el.data = { ...BASE(), page: PAGE({ current: 'Theirs', revision: 8 }) };
    el.renderNow();
    expect(field<HTMLTextAreaElement>(el, 'current').value).toBe('Theirs');
  });
});

// ── dirty guard ──

describe('unsaved-changes guard', () => {
  it('switching with unsaved changes asks first; Esc and Keep editing keep the draft', () => {
    const el = mount();
    const got = listen(el, 'ui-select');
    type(el, 'title', 'Deploy list');
    click(el, 'row|rollback');
    expect(got).toHaveLength(0);
    expect(q(el, '.kp-guard p')?.textContent).toBe('Discard unsaved changes to “Deploy checklist”?');
    expect(active(el)).toBe('guard-keep');
    key(byKey(el, 'guard-keep')!, 'Escape');
    el.renderNow();
    expect(q(el, '.kp-guard')).toBeNull();
    expect(field(el, 'title').value).toBe('Deploy list');
    expect(active(el)).toBe('f|title');
    click(el, 'row|rollback');
    click(el, 'guard-keep');
    expect(q(el, '.kp-guard')).toBeNull();
    expect(got).toHaveLength(0);
  });

  it('Discard switches and drops the draft', () => {
    const el = mount();
    const got = listen(el, 'ui-select');
    type(el, 'title', 'Deploy list');
    click(el, 'row|rollback');
    click(el, 'guard-discard');
    expect(got).toEqual([{ id: 'rollback' }]);
    expect(el.dirty).toBe(false);
    expect(q(el, '.kp-guard')).toBeNull();
  });

  it('New with unsaved changes asks too; Cancel on a typed new page asks before dropping it', () => {
    const el = mount();
    const news = listen(el, 'ui-new');
    type(el, 'aliases', 'x');
    click(el, 'new');
    expect(news).toHaveLength(0);
    click(el, 'guard-discard');
    expect(news).toHaveLength(1);
    type(el, 'title', 'Draft page');
    click(el, 'cancel-new');
    expect(q(el, '.kp-guard p')?.textContent).toBe('Discard the new page?');
    click(el, 'guard-discard');
    expect(q(el, '.kp-chip.is-new')).toBeNull();
    expect(field(el, 'title').value).toBe('Deploy checklist');
  });

  it('a clean editor switches without asking', () => {
    const el = mount();
    const got = listen(el, 'ui-select');
    click(el, 'row|review');
    expect(got).toEqual([{ id: 'review' }]);
    expect(q(el, '.kp-guard')).toBeNull();
  });
});

// ── drafts survive data ──

describe('drafts survive data updates', () => {
  it('keeps the typed value, the node, focus and caret when the host sets data again', () => {
    const el = mount();
    const input = type(el, 'title', 'Deploy check list') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(6, 6);
    el.data = { ...BASE(), pages: PAGES.map((p) => ({ ...p })), page: PAGE() };
    el.renderNow();
    const now = field(el, 'title');
    expect(now).toBe(input);
    expect(now.value).toBe('Deploy check list');
    expect(active(el)).toBe('f|title');
    expect(now.selectionStart).toBe(6);
  });

  it('keeps a draft with changes over a newer version of the page, and per page across switches', () => {
    const el = mount();
    type(el, 'current', 'Mine');
    el.data = { ...BASE(), page: PAGE({ current: 'Theirs', revision: 8 }) };
    el.renderNow();
    expect(field<HTMLTextAreaElement>(el, 'current').value).toBe('Mine');
    // The host moves the selection: the draft stays in the element, marked in the list.
    el.data = { ...BASE(), selected: 'review', page: PAGE({ id: 'review', title: 'Code review norms', revision: 2 }) };
    el.renderNow();
    expect(field(el, 'title').value).toBe('Code review norms');
    expect(q(el, '[data-id="deploy"] .kp-dot')).not.toBeNull();
    expect(el.dirty).toBe(true);
    el.data = { ...BASE(), selected: 'deploy', page: PAGE({ current: 'Theirs', revision: 8 }) };
    el.renderNow();
    expect(field<HTMLTextAreaElement>(el, 'current').value).toBe('Mine');
  });

  it('a deleted page leaves with its draft once the host drops it from the list', () => {
    const el = mount();
    type(el, 'title', 'Deploy list');
    vi.advanceTimersByTime(1000);
    click(el, 'delete');
    vi.advanceTimersByTime(KNOWLEDGE_ARM_GUARD_MS + 10);
    click(el, 'delete');
    el.data = { ...BASE(), pages: PAGES.slice(1), page: null, selected: undefined };
    el.renderNow();
    expect(el.dirty).toBe(false);
    expect(q(el, '.kp-pick')).not.toBeNull();
  });
});

// ── delete ──

describe('two-press delete', () => {
  it('arms on the first press, deletes on the second within the window', () => {
    const el = mount();
    const got = listen(el, 'ui-delete');
    click(el, 'delete');
    const b = byKey(el, 'delete')!;
    expect(b.hasAttribute('data-armed')).toBe(true);
    expect(b.textContent).toBe('Delete?');
    expect(q(el, '.kp-foot [aria-live]')?.textContent).toContain('Delete “Deploy checklist”?');
    expect(got).toHaveLength(0);
    click(el, 'delete');
    expect(got).toHaveLength(0);
    vi.advanceTimersByTime(KNOWLEDGE_ARM_GUARD_MS + 10);
    click(el, 'delete');
    expect(got).toEqual([{ id: 'deploy', revision: 7 }]);
    expect(byKey(el, 'delete')!.hasAttribute('data-armed')).toBe(false);
  });

  it('disarms after the window, on Esc and on blur', () => {
    const el = mount();
    const got = listen(el, 'ui-delete');
    click(el, 'delete');
    vi.advanceTimersByTime(KNOWLEDGE_ARM_MS + 10);
    el.renderNow();
    expect(byKey(el, 'delete')!.hasAttribute('data-armed')).toBe(false);
    click(el, 'delete');
    key(byKey(el, 'delete')!, 'Escape');
    el.renderNow();
    expect(byKey(el, 'delete')!.hasAttribute('data-armed')).toBe(false);
    click(el, 'delete');
    byKey(el, 'delete')!.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, composed: true, relatedTarget: null }),
    );
    el.renderNow();
    expect(byKey(el, 'delete')!.hasAttribute('data-armed')).toBe(false);
    vi.advanceTimersByTime(KNOWLEDGE_ARM_GUARD_MS + 10);
    click(el, 'delete');
    expect(got).toHaveLength(0);
  });

  it('a held Enter never confirms', () => {
    const el = mount();
    click(el, 'delete');
    const ev = key(byKey(el, 'delete')!, 'Enter', { repeat: true });
    expect(ev.defaultPrevented).toBe(true);
  });

  it('preventDefault on ui-delete keeps the page and its draft', () => {
    const el = mount();
    listen(el, 'ui-delete', true);
    type(el, 'title', 'Deploy list');
    click(el, 'delete');
    vi.advanceTimersByTime(KNOWLEDGE_ARM_GUARD_MS + 10);
    click(el, 'delete');
    el.data = { ...BASE(), pages: PAGES.slice(1) };
    el.renderNow();
    expect(el.dirty).toBe(true);
  });
});

// ── sound ──

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    spy = soundSpy({ typing: true });
  });
  afterEach(() => spy.restore());
  // Fake timers (performance.now too): advancing them plays the queue and starts a fresh gesture.
  const settle = () => vi.advanceTimersByTime(300);
  const press = (el: UiKnowledgePages, k: string, detail = 1) => {
    byKey(el, k)!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail }));
    el.renderNow();
  };

  it('choosing a page plays select, New a tap; a guarded switch plays when Discard lets it through', () => {
    const el = mount();
    press(el, 'row|rollback');
    settle();
    press(el, 'new');
    settle();
    type(el, 'title', 'Draft page');
    press(el, 'row|review');
    settle();
    press(el, 'guard-discard', 0);
    settle();
    expect(spy.calls).toEqual([
      ['select', { input: 'mouse' }],
      ['tap', { input: 'mouse' }],
      ['select', { input: 'keyboard' }],
    ]);
  });

  it('Save (the button or ⌘S) plays a tap, Reload a subtle one', () => {
    const el = mount({ ...BASE(), conflict: 'Someone saved a newer version.' });
    type(el, 'title', 'Deploy list');
    press(el, 'save');
    settle();
    key(field(el, 'title'), 's', { metaKey: true });
    settle();
    press(el, 'reload');
    settle();
    expect(spy.calls).toEqual([
      ['tap', { input: 'mouse' }],
      ['tap', { input: 'keyboard' }],
      ['tap', { emphasis: 'subtle', input: 'mouse' }],
    ]);
  });

  it('Delete: the arming press is a subtle tap, the confirming press a strong close', () => {
    const el = mount();
    press(el, 'delete');
    settle();
    press(el, 'delete');
    settle();
    expect(spy.calls).toEqual([
      ['tap', { emphasis: 'subtle', input: 'mouse' }],
      ['close', { emphasis: 'strong', input: 'mouse' }],
    ]);
  });

  it('keystrokes that edit the title, aliases or markdown play type', () => {
    const el = mount();
    key(field(el, 'title'), 'a');
    settle();
    key(field(el, 'aliases'), ' ');
    settle();
    key(field<HTMLTextAreaElement>(el, 'current'), 'Enter');
    settle();
    key(field(el, 'title'), 'Enter');
    key(field(el, 'title'), 'ArrowLeft');
    key(field(el, 'title'), 'Escape');
    settle();
    expect(spy.calls).toEqual([
      ['type', { key: 'printable', input: 'keyboard' }],
      ['type', { key: 'space', input: 'keyboard' }],
      ['type', { key: 'enter', input: 'keyboard' }],
    ]);
  });

  it('cancelled events, a prevented keystroke or data from code play nothing (the arming press still taps)', () => {
    const el = mount({ ...BASE(), conflict: 'Someone saved a newer version.' });
    for (const n of ['ui-select', 'ui-new', 'ui-save', 'ui-reload', 'ui-delete']) listen(el, n, true);
    el.data = { ...BASE(), conflict: 'Someone saved a newer version.', now: NOW + MIN };
    el.renderNow();
    press(el, 'row|rollback');
    press(el, 'new');
    press(el, 'reload');
    type(el, 'title', 'Deploy list');
    press(el, 'save');
    field(el, 'title').addEventListener('keydown', (e) => e.preventDefault());
    key(field(el, 'title'), 'a');
    settle();
    expect(spy.calls).toEqual([]);
    press(el, 'delete');
    settle();
    press(el, 'delete');
    settle();
    expect(spy.calls).toEqual([['tap', { emphasis: 'subtle', input: 'mouse' }]]);
  });

  it('is silent inside data-ui-sound="off"', () => {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-ui-sound', 'off');
    document.body.append(wrap);
    const el = mount();
    wrap.append(el);
    el.renderNow();
    press(el, 'row|rollback');
    press(el, 'new');
    key(field(el, 'title'), 'a');
    settle();
    expect(spy.calls).toEqual([]);
  });
});

// ── keyboard ──

describe('keyboard', () => {
  it('the list has one tab stop; arrows, Home and End move it (wrapping)', () => {
    const el = mount();
    const rows = () => qa<HTMLButtonElement>(el, '.kp-row');
    expect(rows().map((r) => r.tabIndex)).toEqual([0, -1, -1, -1]);
    rows()[0].focus();
    key(rows()[0], 'ArrowDown');
    expect(active(el)).toBe('row|rollback');
    expect(rows().map((r) => r.tabIndex)).toEqual([-1, 0, -1, -1]);
    key(rows()[1], 'End');
    expect(active(el)).toBe('row|glossary');
    key(rows()[3], 'ArrowDown');
    expect(active(el)).toBe('row|deploy');
    key(rows()[0], 'ArrowUp');
    expect(active(el)).toBe('row|glossary');
    key(rows()[3], 'Home');
    expect(active(el)).toBe('row|deploy');
    el.renderNow();
    expect(rows().map((r) => r.tabIndex)).toEqual([0, -1, -1, -1]);
  });

  it('↓ from search enters the list at the roving row', () => {
    const el = mount(BASE({ selected: 'review', page: null }));
    const s = field(el, 'q');
    s.focus();
    key(s, 'ArrowDown');
    expect(active(el)).toBe('row|review');
  });

  it('the roving row survives a re-render', () => {
    const el = mount();
    const rows = qa<HTMLButtonElement>(el, '.kp-row');
    rows[0].focus();
    key(rows[0], 'ArrowDown');
    el.data = { ...BASE() };
    el.renderNow();
    expect(active(el)).toBe('row|rollback');
    expect(qa<HTMLButtonElement>(el, '.kp-row')[1].tabIndex).toBe(0);
  });

  it('back returns to the list column', () => {
    const el = mount();
    expect(q(el, '.kp')!.dataset.view).toBe('detail');
    click(el, 'back');
    expect(q(el, '.kp')!.dataset.view).toBe('list');
    expect(active(el)).toBe('row|deploy');
  });
});

// ── lang ──

describe('lang="ko"', () => {
  it('switches every string', () => {
    const el = mount(BASE(), { lang: 'ko' });
    expect(q(el, '.kp')!.getAttribute('aria-label')).toBe('지식 페이지');
    expect(field(el, 'q').placeholder).toBe('페이지 검색');
    expect(q(el, '.kp-gh .kp-gl')?.textContent).toBe('Runbooks');
    expect(qa(el, '.kp-gh .kp-gl').at(-1)?.textContent).toBe('기타');
    expect(q(el, '.kp-row time')?.textContent).toBe('2시간 전');
    expect(save(el).textContent).toBe('저장');
    expect(q(el, 'label[for="kp-title"]')?.textContent).toBe('제목');
    type(el, 'title', '배포 목록');
    expect(q(el, '.kp-unsaved')?.textContent).toBe('저장하지 않은 변경');
    click(el, 'row|rollback');
    expect(q(el, '.kp-guard p')?.textContent).toBe('“Deploy checklist”의 저장하지 않은 변경을 버릴까요?');
    click(el, 'guard-keep');
    click(el, 'delete');
    expect(byKey(el, 'delete')!.textContent).toBe('삭제할까요?');
  });

  it('follows a lang change after mount', () => {
    const el = mount();
    el.setAttribute('lang', 'ko');
    el.renderNow();
    expect(byKey(el, 'back')!.textContent).toBe('모든 페이지');
    el.setAttribute('lang', 'en');
    el.renderNow();
    expect(byKey(el, 'back')!.textContent).toBe('All pages');
  });
});

// ── source mode (D5 G3-1) ──

const SRC =
  '---\ntitle: Deploy checklist\naliases: [ship list, go-live]\n---\nUse **release** branches.\n\n## 2026-10-21\nCanary window is 10 minutes.\n';

describe('source mode', () => {
  it('isDirty compares only the source of a source draft, trailing whitespace ignored', () => {
    const page = PAGE({ source: SRC });
    expect(isDirty(page, { title: 'x', aliases: '', current: '', history: [], source: SRC })).toBe(false);
    expect(isDirty(page, { title: 'x', aliases: '', current: '', history: [], source: `${SRC}\n\n` })).toBe(false);
    expect(isDirty(page, { title: 'x', aliases: '', current: '', history: [], source: `${SRC}more` })).toBe(true);
    expect(
      isDirty(page, { ...PAGE(), aliases: 'ship list, go-live', history: PAGE().history ?? [], source: null }),
    ).toBe(false);
    expect(isDirty(PAGE(), { title: 'Deploy checklist', aliases: '', current: '', history: [], source: '' })).toBe(
      false,
    );
  });

  it('offers “Edit as source” only for a page that carries one; the switch shows one box over the whole page', () => {
    expect(byKey(mount(), 'src')).toBeNull();
    const el = mount(BASE({ page: PAGE({ source: SRC }) }));
    const link = byKey(el, 'src')!;
    expect(link.textContent).toBe('Edit as source');
    expect(link.getAttribute('aria-pressed')).toBe('false');
    expect(link.closest('.kp-meta')).not.toBeNull();
    click(el, 'src');
    expect(byKey(el, 'src')!.textContent).toBe('Back to the form');
    expect(byKey(el, 'src')!.getAttribute('aria-pressed')).toBe('true');
    expect(active(el)).toBe('src');
    expect(q(el, '.kp-edit')!.hasAttribute('data-source')).toBe(true);
    expect(field<HTMLTextAreaElement>(el, 'source').value).toBe(SRC);
    expect(q(el, '.kp-src')!.getAttribute('data-v')).toBe(SRC);
    expect(q(el, '[data-f="title"]')).toBeNull();
    expect(q(el, '[data-f="current"]')).toBeNull();
    expect(q(el, '.kp-sec-src .kp-label')?.textContent).toBe('Source');
    expect(q(el, '.kp-src-note')).toBeNull();
    expect(save(el).getAttribute('aria-disabled')).toBe('true');
    click(el, 'src');
    expect(field(el, 'title').value).toBe('Deploy checklist');
    expect(q(el, '[data-f="source"]')).toBeNull();
  });

  it('a typed source is a draft: Save sends the whole text with the page’s own fields, id and revision', () => {
    const el = mount(BASE({ page: PAGE({ source: SRC }) }));
    const saves = listen<KnowledgeSaveDetail>(el, 'ui-save');
    click(el, 'src');
    type(el, 'source', `${SRC}\n## 2026-10-30\nNew note.\n\n`);
    expect(el.dirty).toBe(true);
    expect(q(el, '.kp-unsaved')).not.toBeNull();
    expect(q(el, '.kp-row[aria-current="true"] .kp-dot')).not.toBeNull();
    expect(save(el).getAttribute('aria-disabled')).toBe('false');
    click(el, 'save');
    expect(saves).toEqual([
      {
        id: 'deploy',
        title: 'Deploy checklist',
        aliases: ['ship list', 'go-live'],
        group: 'runbooks',
        current: 'Use **release** branches.',
        history: [{ date: '2026-10-21', text: 'Canary window is 10 minutes.' }],
        revision: 7,
        source: `${SRC}\n## 2026-10-30\nNew note.`,
      },
    ]);
    // The host answers with the saved page: the draft is done and the editor stays in source mode.
    el.data = BASE({ page: PAGE({ source: `${SRC}\n## 2026-10-30\nNew note.\n`, revision: 8 }), status: 'Saved' });
    el.renderNow();
    expect(el.dirty).toBe(false);
    expect(field<HTMLTextAreaElement>(el, 'source').value).toBe(`${SRC}\n## 2026-10-30\nNew note.\n`);
    expect(q(el, '.kp-foot .kp-saved')?.textContent).toBe('Saved');
  });

  it('a source draft survives a data update and gets the same conflict handling: Overwrite, Reload', () => {
    const el = mount(BASE({ page: PAGE({ source: SRC }) }));
    const saves = listen<KnowledgeSaveDetail>(el, 'ui-save');
    const reloads = listen(el, 'ui-reload');
    click(el, 'src');
    const ta = type(el, 'source', 'mine');
    el.data = BASE({ page: PAGE({ source: SRC }), status: 'x' });
    el.renderNow();
    expect(field<HTMLTextAreaElement>(el, 'source')).toBe(ta);
    expect(ta.value).toBe('mine');
    click(el, 'save');
    el.data = BASE({ page: PAGE({ source: SRC }), conflict: 'Someone saved a newer version.' });
    el.renderNow();
    expect(q(el, '.kp-alert.is-wait')).not.toBeNull();
    expect(field<HTMLTextAreaElement>(el, 'source').value).toBe('mine');
    click(el, 'overwrite');
    expect(saves.at(-1)).toMatchObject({ id: 'deploy', source: 'mine', revision: 7, overwrite: true });
    el.data = BASE({ page: PAGE({ source: SRC }), conflict: 'Someone saved a newer version.' });
    el.renderNow();
    click(el, 'reload');
    expect(reloads).toEqual([{ id: 'deploy' }]);
    expect(el.dirty).toBe(false);
    el.data = BASE({ page: PAGE({ source: 'theirs', revision: 8 }) });
    el.renderNow();
    expect(field<HTMLTextAreaElement>(el, 'source').value).toBe('theirs');
  });

  it('switching modes with unsaved changes asks first; Keep stays, Discard switches and drops the draft', () => {
    const el = mount(BASE({ page: PAGE({ source: SRC }) }));
    type(el, 'title', 'Deploy list');
    click(el, 'src');
    expect(q(el, '.kp-guard p')?.textContent).toBe('Discard unsaved changes to “Deploy checklist”?');
    expect(field(el, 'title').value).toBe('Deploy list');
    click(el, 'guard-keep');
    expect(q(el, '.kp-guard')).toBeNull();
    expect(field(el, 'title').value).toBe('Deploy list');
    click(el, 'src');
    click(el, 'guard-discard');
    expect(q(el, '.kp-guard')).toBeNull();
    expect(field<HTMLTextAreaElement>(el, 'source').value).toBe(SRC);
    expect(el.dirty).toBe(false);
    type(el, 'source', 'changed');
    click(el, 'src');
    expect(q(el, '.kp-guard')).not.toBeNull();
    click(el, 'guard-discard');
    expect(field(el, 'title').value).toBe('Deploy checklist');
    expect(el.dirty).toBe(false);
  });

  it('a sourceOnly page opens as source with no way to the form, and says why', () => {
    const el = mount(BASE({ page: PAGE({ source: SRC, sourceOnly: true }) }));
    expect(byKey(el, 'src')).toBeNull();
    expect(field<HTMLTextAreaElement>(el, 'source').value).toBe(SRC);
    expect(q(el, '[data-f="title"]')).toBeNull();
    expect(q(el, '.kp-src-note')?.textContent).toBe(
      'This page holds markdown the form cannot show, so it is edited as source.',
    );
    // Without a source string the flag means nothing: the form it is.
    const form = mount(BASE({ page: PAGE({ sourceOnly: true }) }));
    expect(q(form, '[data-f="source"]')).toBeNull();
    expect(field(form, 'title').value).toBe('Deploy checklist');
  });

  it('the source text is set, never rendered as markup; the switch is off while saving and in read-only', () => {
    const el = mount(BASE({ page: PAGE({ source: `${XSS}\n` }) }));
    click(el, 'src');
    expect(sr(el).querySelector('img')).toBeNull();
    expect(field<HTMLTextAreaElement>(el, 'source').value).toBe(`${XSS}\n`);
    expect(q(el, '.kp-src')!.getAttribute('data-v')).toBe(`${XSS}\n`);
    el.data = BASE({ page: PAGE({ source: `${XSS}\n` }), saving: true });
    el.renderNow();
    expect(byKey(el, 'src')!.getAttribute('aria-disabled')).toBe('true');
    expect(field<HTMLTextAreaElement>(el, 'source').hasAttribute('readonly')).toBe(true);
    const ro = mount(BASE({ page: PAGE({ source: SRC }), readOnly: true }));
    expect(byKey(ro, 'src')).toBeNull();
    expect(q(ro, '.kp-read')).not.toBeNull();
  });

  it('speaks Korean and plays select forward / back on the switch', () => {
    const spy = soundSpy();
    try {
      const el = mount(BASE({ page: PAGE({ source: SRC }) }), { lang: 'ko' });
      expect(byKey(el, 'src')!.textContent).toBe('원문(markdown)으로 편집');
      byKey(el, 'src')!.dispatchEvent(
        new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail: 1 }),
      );
      el.renderNow();
      expect(byKey(el, 'src')!.textContent).toBe('폼으로 돌아가기');
      expect(q(el, '.kp-sec-src .kp-label')?.textContent).toBe('원문');
      expect(q(el, '.kp-sec-src .kp-sub')?.textContent).toBe('페이지 전체 · markdown');
      vi.advanceTimersByTime(300);
      byKey(el, 'src')!.dispatchEvent(
        new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail: 1 }),
      );
      el.renderNow();
      vi.advanceTimersByTime(300);
      expect(spy.calls).toEqual([
        ['select', { direction: 'forward', input: 'mouse' }],
        ['select', { direction: 'back', input: 'mouse' }],
      ]);
      const only = mount(BASE({ page: PAGE({ source: SRC, sourceOnly: true }) }), { lang: 'ko' });
      expect(q(only, '.kp-src-note')?.textContent).toBe('폼에 담을 수 없는 markdown이 있어 원문으로 편집합니다.');
    } finally {
      spy.restore();
    }
  });
});

// ── layout="page" (D5 G3-2) ──

describe('layout="page"', () => {
  it('is as tall as its content: no fixed height, the list sticky, the editor not its own scroll box', () => {
    expect(styles).toContain(
      ':host([layout="page"]) .ui-root, :host([layout="page"]) .kp, :host([layout="page"]) .kp-grid { height: auto; min-height: 0; }',
    );
    expect(styles).toContain(':host([layout="page"]) .kp { overflow: visible; }');
    expect(styles).toMatch(
      /:host\(\[layout="page"\]\) \.kp-list \{ position: sticky; top: var\(--kp-sticky-top, 0px\); max-height: calc\(100dvh - var\(--kp-sticky-top, 0px\)\);/,
    );
    expect(styles).toContain(':host([layout="page"]) :is(.kp-edit, .kp-read) { overflow: visible; }');
    const el = mount(BASE(), { layout: 'page' });
    expect(q(el, '.kp')).not.toBeNull();
  });
});

// ── docs ──

describe('docs', () => {
  it('ships at least three demos that build without the network', () => {
    expect(doc.tag).toBe('ui-knowledge-pages');
    expect(doc.group).toBe('Pages');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) {
      const node = d.create();
      document.body.append(node);
      const el = (
        node.matches('ui-knowledge-pages') ? node : node.querySelector('ui-knowledge-pages')
      ) as UiKnowledgePages;
      expect(el).not.toBeNull();
      el.renderNow();
      expect(sr(el).querySelector('.kp')).not.toBeNull();
    }
    expect(doc.demos.some((d) => d.title.includes('ko'))).toBe(true);
    expect(doc.demos.some((d) => d.id === 'source')).toBe(true);
    expect(doc.demos.some((d) => d.id === 'page')).toBe(true);
  });

  it('the source demo opens as source and its host saves the whole text', () => {
    const node = doc.demos.find((d) => d.id === 'source')!.create();
    document.body.append(node);
    const el = (
      node.matches('ui-knowledge-pages') ? node : node.querySelector('ui-knowledge-pages')
    ) as UiKnowledgePages;
    el.renderNow();
    expect(q(el, '[data-f="source"]')).not.toBeNull();
    expect(q(el, '.kp-src-note')).not.toBeNull();
    type(el, 'source', '# Replaced\n');
    click(el, 'save');
    vi.advanceTimersByTime(600);
    el.renderNow();
    expect(q(el, '.kp-foot .kp-saved')?.textContent).toBe('Saved');
    expect(field<HTMLTextAreaElement>(el, 'source').value).toBe('# Replaced\n');
    const page = doc.demos.find((d) => d.id === 'page')!.create();
    expect(page.querySelector('ui-knowledge-pages')?.getAttribute('layout')).toBe('page');
  });

  it('the demo host loads a selected page after a short delay and saves into the list', () => {
    const node = doc.demos[0].create();
    document.body.append(node);
    const el = (
      node.matches('ui-knowledge-pages') ? node : node.querySelector('ui-knowledge-pages')
    ) as UiKnowledgePages;
    el.renderNow();
    click(el, 'row|rollback');
    expect(q(el, '.kp-skel')).not.toBeNull();
    vi.advanceTimersByTime(500);
    el.renderNow();
    expect(field(el, 'title').value).toBe('Rollback steps');
    type(el, 'title', 'Rollback runbook');
    click(el, 'save');
    vi.advanceTimersByTime(600);
    el.renderNow();
    expect(rowTitles(el)).toContain('Rollback runbook');
    expect(q(el, '.kp-foot .kp-saved')?.textContent).toBe('Saved');
  });
});
