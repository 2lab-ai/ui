import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import { anchorHidden, type UiLogScroller } from '../log-scroller/log-scroller';
import { doc } from './docs';
import {
  agentStatus,
  entryKind,
  fmtLogTime,
  groupHeadHtml,
  normGroups,
  openGroups,
  toolSlotName,
  toolStatus,
  type WorkGroup,
  type WorkLogData,
} from './logic';
import { styles } from './styles';
import { type UiWorkLog, WORK_LOG_COPIED_MS } from './work-log';

const XSS = '<img src=x onerror=alert(1)>"\'&';
const T0 = new Date(2026, 9, 30, 14, 2, 7).getTime();

function mount(data: WorkLogData, attrs: Record<string, string> = {}): UiWorkLog {
  const el = document.createElement('ui-work-log');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiWorkLog, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = <E extends Element = HTMLElement>(el: UiWorkLog, s: string) =>
  Array.from(el.shadowRoot!.querySelectorAll<E>(s));
const scroller = (el: UiWorkLog) => q(el, 'ui-log-scroller') as unknown as UiLogScroller;
const entry = (el: UiWorkLog, id: string) =>
  qa(el, '[data-entry]').find((e) => e.dataset.entry === id) as HTMLElement | undefined;
const group = (el: UiWorkLog, id: string) =>
  qa(el, '.wl-group').find((e) => e.dataset.item === id) as HTMLElement | undefined;
const key = (el: UiWorkLog, k: string) => qa(el, '[data-key]').find((e) => e.dataset.key === k) as HTMLElement;
function press(target: HTMLElement, k: string): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true });
  target.dispatchEvent(ev);
  return ev;
}

function groups(): WorkGroup[] {
  return [
    {
      id: 'g1',
      ref: 'T-1',
      title: 'Set up the repository',
      at: T0,
      entries: [
        {
          id: 'e1',
          kind: 'instruction',
          text: 'Set up the repository and run the tests',
          at: T0,
          hasRaw: true,
          skills: [
            { name: 'code-review', text: 'Review the diff' },
            { name: 'release-notes', tokens: 950 },
          ],
        },
        { id: 'e2', kind: 'narration', text: 'Reading the config first', at: T0 + 1000 },
      ],
    },
    {
      id: 'g2',
      ref: 'T-2',
      title: 'Fix the router',
      at: T0 + 60_000,
      entries: [
        {
          id: 'e3',
          kind: 'tool',
          tool: { name: 'Read', status: 'success', summary: 'src/router.ts' },
          at: T0 + 61_000,
        },
        { id: 'e4', kind: 'system', system: { kind: 'compact' }, text: 'Context compacted', at: T0 + 62_000 },
        {
          id: 'e5',
          kind: 'agent',
          agent: {
            id: 'ag-1',
            name: 'Test runner',
            status: 'done',
            duration: 65_000,
            tools: 3,
            activity: 'Ran npm test',
          },
        },
        {
          id: 'e6',
          kind: 'final',
          text: 'The router handles the empty path now.',
          at: T0 + 70_000,
          raw: { state: 'ready', text: 'full output\nline 2', bytes: 2048 },
        },
        { id: 'e7', kind: 'notice', text: 'Rate limited for 20 s', at: T0 + 71_000 },
        { id: 'e8', kind: 'error', text: 'Build failed', at: T0 + 72_000, raw: { state: 'error' } },
      ],
    },
  ];
}

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('logic', () => {
  it('normalises kinds and statuses', () => {
    expect(entryKind('final')).toBe('final');
    expect(entryKind('weird')).toBe('narration');
    expect(entryKind(undefined)).toBe('narration');
    expect(['ok', 'failed', 'cancelled', 'running', 'x'].map(toolStatus)).toEqual([
      'success',
      'error',
      'interrupted',
      'running',
      'running',
    ]);
    expect(['completed', 'error', 'queued', 'interrupted', 'active', 'nope'].map(agentStatus)).toEqual([
      'done',
      'failed',
      'waiting',
      'stopped',
      'running',
      'unknown',
    ]);
    expect(toolSlotName('e:9')).toBe('tool-e:9');
  });

  it('formats local clock time with or without seconds', () => {
    expect(fmtLogTime(T0)).toBe('14:02:07');
    expect(fmtLogTime(T0, false)).toBe('14:02');
    expect(fmtLogTime(undefined)).toBe('');
    expect(fmtLogTime('nope')).toBe('');
  });

  it('keeps groups and entries with an id once (first wins), ids as strings', () => {
    const out = normGroups([
      null,
      { title: 'no id' },
      { id: 1, entries: [{ id: 2, kind: 'notice' }, { kind: 'notice' }, { id: 'a', kind: 'notice' }] },
      { id: '1', title: 'dup' },
      { id: 'g', entries: [{ id: 'a', kind: 'error' }, null, { id: 'b', kind: 'error' }] },
    ]);
    expect(out.map((g) => g.id)).toEqual(['1', 'g']);
    expect(out[0].entries?.map((e) => e.id)).toEqual(['2', 'a']);
    expect(out[1].entries?.map((e) => e.id)).toEqual(['b']);
    expect(normGroups('x')).toEqual([]);
  });

  it('opens the newest group unless the reader or the host chose', () => {
    const gs: WorkGroup[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect([...openGroups(gs).values()]).toEqual([false, false, true]);
    expect([
      ...openGroups(
        gs,
        new Map([
          ['a', true],
          ['c', false],
        ]),
      ).values(),
    ]).toEqual([true, false, false]);
    expect([
      ...openGroups([
        { id: 'a', open: true },
        { id: 'b', open: false },
      ]).values(),
    ]).toEqual([true, false]);
  });

  it('group head: ref (default id), title or Untitled, count (default entries), time', () => {
    const box = document.createElement('div');
    box.innerHTML = groupHeadHtml({ id: 'g9', at: T0, entries: [{ id: 'x', kind: 'notice' }] });
    expect(box.querySelector('.wl-g-ref')?.textContent).toBe('g9');
    expect(box.querySelector('.wl-g-title')?.textContent).toBe('Untitled');
    expect(box.querySelector('.wl-g-title')?.hasAttribute('data-empty')).toBe(true);
    expect(box.querySelector('.wl-g-count')?.textContent).toBe('1');
    expect(box.querySelector('.sr-only')?.textContent).toBe('1 entry');
    expect(box.querySelector('time')?.textContent).toBe('14:02');
    box.innerHTML = groupHeadHtml({ id: 'g9', ref: '', title: 'T', count: 12 }, 'ko');
    expect(box.querySelector('.wl-g-ref')).toBeNull();
    expect(box.querySelector('.sr-only')?.textContent).toBe('항목 12개');
    expect(box.querySelector('time')).toBeNull();
  });
});

describe('<ui-work-log> rendering', () => {
  it('puts each group in the log scroller as an item; the newest group is open, others closed', () => {
    const el = mount({ groups: groups() });
    const sc = scroller(el);
    expect(sc.items.map((i) => i.dataset.item)).toEqual(['g1', 'g2']);
    const [h1, h2] = qa(el, '.wl-gh');
    expect(h1.getAttribute('aria-expanded')).toBe('false');
    expect(h2.getAttribute('aria-expanded')).toBe('true');
    expect(group(el, 'g1')?.hasAttribute('data-open')).toBe(false);
    expect(group(el, 'g2')?.hasAttribute('data-open')).toBe(true);
    expect(q(el, `#${h1.getAttribute('aria-controls')}`)?.hasAttribute('inert')).toBe(true);
    expect(q(el, `#${h2.getAttribute('aria-controls')}`)?.hasAttribute('inert')).toBe(false);
    expect(h2.querySelector('.wl-g-ref')?.textContent).toBe('T-2');
    expect(h2.querySelector('.wl-g-title')?.textContent).toBe('Fix the router');
    expect(h2.querySelector('.wl-g-count')?.textContent).toBe('6');
    expect(h2.querySelector('.sr-only')?.textContent).toBe('6 entries');
    expect(h2.querySelector('.wl-g-time')?.textContent).toBe('14:03');
    expect(sc.getAttribute('lang')).toBeNull();
    expect(qa(el, '[data-anchor]').length).toBe(8);
  });

  it('entries that arrive inside a shown group count on the scroller pill (new groups count themselves)', () => {
    const el = mount({ groups: groups() });
    const sc = scroller(el);
    const note = vi.spyOn(sc, 'noteUnread');
    const next = groups();
    next[1].entries = [
      ...(next[1].entries ?? []),
      { id: 'n1', kind: 'narration', text: 'One more line', at: T0 },
      { id: 'n2', kind: 'notice', text: 'And a notice', at: T0 },
    ];
    el.data = { groups: next };
    el.renderNow();
    expect(note).toHaveBeenCalledTimes(1);
    expect(note).toHaveBeenCalledWith(2);
    el.data = { groups: next.map((g) => ({ ...g })) };
    el.renderNow();
    expect(note).toHaveBeenCalledTimes(1);
  });

  it('text kinds: icon + label + time + text', () => {
    const el = mount({ groups: groups() });
    const cases: Array<[string, string, string, string]> = [
      ['e1', 'Instruction', 'user', 'Set up the repository and run the tests'],
      ['e2', 'Progress', 'chat', 'Reading the config first'],
      ['e6', 'Response', 'check', 'The router handles the empty path now.'],
      ['e7', 'Notice', 'info', 'Rate limited for 20 s'],
      ['e8', 'Error', 'alert', 'Build failed'],
    ];
    for (const [id, label, glyph, text] of cases) {
      const e = entry(el, id)!;
      expect(e.querySelector('.wl-label')?.textContent).toBe(label);
      expect(e.querySelector(`.wl-head svg[data-icon="${glyph}"]`)).not.toBeNull();
      expect(e.querySelector('.wl-text')?.textContent).toBe(text);
    }
    expect(entry(el, 'e1')?.querySelector('time')?.textContent).toBe('14:02:07');
    expect(entry(el, 'e1')?.querySelector('time')?.getAttribute('datetime')).toBe(new Date(T0).toISOString());
    expect(entry(el, 'e1')?.dataset.kind).toBe('instruction');
    // A custom label replaces the word.
    const el2 = mount({ groups: [{ id: 'g', entries: [{ id: 'x', kind: 'final', label: 'Answer', text: 't' }] }] });
    expect(entry(el2, 'x')?.querySelector('.wl-label')?.textContent).toBe('Answer');
  });

  it('openable rows are buttons with aria-expanded / aria-controls; plain rows are not', () => {
    const el = mount({ groups: groups() });
    const row = entry(el, 'e6')!.querySelector('.wl-row')!;
    expect(row.getAttribute('role')).toBe('button');
    expect(row.getAttribute('aria-expanded')).toBe('false');
    const detail = q(el, `#${row.getAttribute('aria-controls')}`)!;
    expect(detail.hasAttribute('hidden')).toBe(true);
    expect(detail.getAttribute('aria-live')).toBe('off');
    expect(entry(el, 'e2')!.querySelector('.wl-row')?.hasAttribute('role')).toBe(false);
    expect(entry(el, 'e1')!.querySelector('.wl-row')?.getAttribute('role')).toBe('button');
  });

  it('system turn: badge (icon + word) and its line', () => {
    const el = mount({ groups: groups() });
    const e = entry(el, 'e4')!;
    const badge = e.querySelector('.sys-badge')!;
    expect(badge.getAttribute('data-kind')).toBe('compact');
    expect(badge.textContent).toBe('Compacted');
    expect(badge.querySelector('svg')).not.toBeNull();
    expect(e.querySelector('.wl-sys-line')?.textContent).toBe('Context compacted');
  });

  it('G2-1: a folded group’s entries sit under an inert region, so the scroller does not hold the reader’s place on them', () => {
    const el = mount({ groups: groups() });
    const g1 = group(el, 'g1')!;
    const g2 = group(el, 'g2')!;
    expect(g1.hasAttribute('data-open')).toBe(false);
    expect(g2.hasAttribute('data-open')).toBe(true);
    const folded = Array.from(g1.querySelectorAll<HTMLElement>('[data-anchor]'));
    const open = Array.from(g2.querySelectorAll<HTMLElement>('[data-anchor]'));
    expect(folded.length).toBeGreaterThan(0);
    expect(folded.every((e) => anchorHidden(e, g1))).toBe(true);
    expect(open.every((e) => !anchorHidden(e, g2))).toBe(true);
    // Opening the group makes its entries anchors again.
    key(el, 'g:g1').click();
    expect(folded.every((e) => !anchorHidden(e, g1))).toBe(true);
  });

  it('tool entry: a named slot with a plain line (status icon + word, name, summary) as fallback', () => {
    const el = mount({ groups: groups() });
    const slot = entry(el, 'e3')!.querySelector('slot')!;
    expect(slot.getAttribute('name')).toBe('tool-e3');
    const line = slot.querySelector('.wl-tool')!;
    expect(line.getAttribute('data-status')).toBe('success');
    expect(line.querySelector('.wl-st')?.textContent).toBe('Done');
    expect(line.querySelector('svg[data-icon="check"]')).not.toBeNull();
    expect(line.querySelector('.wl-tool-name')?.textContent).toBe('Read');
    expect(line.querySelector('.wl-tool-sum')?.textContent).toBe('src/router.ts');
    // The host's card goes into that slot.
    const card = document.createElement('div');
    card.slot = 'tool-e3';
    card.textContent = 'card';
    el.append(card);
    expect(slot.assignedElements()).toEqual([card]);
  });

  it('child agent: status icon + word, name, time, tools, activity, Open', () => {
    const el = mount({ groups: groups() });
    const btn = entry(el, 'e5')!.querySelector<HTMLButtonElement>('button.wl-agent')!;
    expect(btn.dataset.status).toBe('done');
    expect(btn.querySelector('.wl-ag-icon svg[data-icon="check"]')).not.toBeNull();
    expect(btn.querySelector('.wl-ag-st')?.textContent).toBe('Done');
    expect(btn.querySelector('.wl-ag-name')?.textContent).toBe('Test runner');
    expect(btn.querySelector('.wl-ag-time')?.textContent).toBe('1m 05s');
    expect(btn.querySelector('.wl-ag-tools')?.textContent).toBe('3 tools');
    expect(btn.querySelector('.wl-ag-act')?.textContent).toBe('Ran npm test');
    expect(btn.querySelector('.wl-ag-open')?.textContent).toBe('Open');
    expect(btn.getAttribute('aria-label')).toBe('Open Test runner — Done, 3 tools');
  });

  it('a running child agent counts its time up in place', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 10_000);
    const el = mount({
      groups: [
        {
          id: 'g',
          entries: [{ id: 'a', kind: 'agent', agent: { id: 'x', name: 'Scout', status: 'running', startedAt: T0 } }],
        },
      ],
    });
    const time = q(el, '.wl-ag-time')!;
    expect(time.textContent).toBe('10s');
    expect(q(el, '.wl-agent .wl-spin')).not.toBeNull();
    const btn = q(el, '.wl-agent');
    vi.advanceTimersByTime(2000);
    expect(q(el, '.wl-ag-time')).toBe(time);
    expect(time.textContent).toBe('12s');
    expect(q(el, '.wl-agent')).toBe(btn);
  });
});

describe('<ui-work-log> escaping', () => {
  it('escapes every host and model string', () => {
    const el = mount({
      legacy: XSS,
      groups: [
        {
          id: XSS,
          ref: XSS,
          title: XSS,
          entries: [
            { id: XSS, kind: 'instruction', label: XSS, text: XSS, skills: [{ name: XSS, text: XSS }], hasRaw: true },
            { id: `${XSS}t`, kind: 'tool', tool: { name: XSS, status: 'error', summary: XSS } },
            { id: `${XSS}s`, kind: 'system', system: { kind: XSS, label: XSS }, text: XSS },
            {
              id: `${XSS}a`,
              kind: 'agent',
              agent: { id: XSS, name: XSS, status: 'failed', activity: XSS },
            },
            { id: `${XSS}r`, kind: 'final', text: XSS, raw: { state: 'ready', text: XSS, note: XSS } },
          ],
        },
      ],
    });
    // Open the skill pane and both raw viewers.
    q(el, '.skill-badge')!.click();
    for (const row of qa(el, '.wl-row[role="button"]')) row.click();
    const root = el.shadowRoot!;
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('[onerror]')).toBeNull();
    expect(q(el, '.wl-legacy')?.textContent).toBe(XSS);
    expect(q(el, '.wl-g-ref')?.textContent).toBe(XSS);
    expect(q(el, '.wl-g-title')?.textContent).toBe(XSS);
    expect(group(el, XSS)).toBeDefined();
    expect(entry(el, XSS)?.querySelector('.wl-label')?.textContent).toBe(XSS);
    expect(entry(el, XSS)?.querySelector('.wl-text')?.textContent).toBe(XSS);
    expect(entry(el, XSS)?.querySelector('.skill-pane pre')?.textContent).toBe(XSS);
    expect(entry(el, `${XSS}t`)?.querySelector('slot')?.getAttribute('name')).toBe(`tool-${XSS}t`);
    expect(entry(el, `${XSS}t`)?.querySelector('.wl-tool-name')?.textContent).toBe(XSS);
    expect(entry(el, `${XSS}t`)?.querySelector('.wl-tool-sum')?.textContent).toBe(XSS);
    expect(entry(el, `${XSS}s`)?.querySelector('.sys-badge')?.textContent).toBe(XSS);
    expect(entry(el, `${XSS}s`)?.querySelector('.wl-sys-line')?.textContent).toBe(XSS);
    const agent = entry(el, `${XSS}a`)!.querySelector('.wl-agent')!;
    expect(agent.getAttribute('data-agent')).toBe(XSS);
    expect(agent.querySelector('.wl-ag-name')?.textContent).toBe(XSS);
    expect(agent.querySelector('.wl-ag-act')?.textContent).toBe(XSS);
    expect(agent.getAttribute('aria-label')).toContain(XSS);
    const raw = entry(el, `${XSS}r`)!;
    expect(raw.querySelector('pre.raw-text')?.textContent).toBe(XSS);
    expect(raw.querySelector('.raw-note')?.textContent).toBe(XSS);
  });

  it('escapes the denied and empty texts', () => {
    const a = mount({ denied: XSS });
    expect(a.shadowRoot!.querySelector('img')).toBeNull();
    expect(q(a, '.wl-empty-text')?.textContent).toBe(XSS);
    const b = mount({ groups: [], emptyText: XSS });
    expect(b.shadowRoot!.querySelector('img')).toBeNull();
    expect(q(b, '.wl-empty-text')?.textContent).toBe(XSS);
  });
});

describe('<ui-work-log> updates', () => {
  it('a new data object touches only what changed', () => {
    const data = groups();
    const el = mount({ groups: data });
    const g1 = group(el, 'g1');
    const g2 = group(el, 'g2');
    const before = Object.fromEntries(
      ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8'].map((id) => [id, entry(el, id)]),
    );
    const head2 = q(el, '.wl-group[data-item="g2"] .wl-gh');
    const next = groups();
    next[1].entries![4] = { ...next[1].entries![4], text: 'Rate limited for 40 s' };
    next[1].entries!.push({ id: 'e9', kind: 'narration', text: 'Retrying now', at: T0 + 80_000 });
    el.data = { groups: next };
    el.renderNow();
    expect(group(el, 'g1')).toBe(g1);
    expect(group(el, 'g2')).toBe(g2);
    expect(q(el, '.wl-group[data-item="g2"] .wl-gh')).toBe(head2);
    for (const id of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e8']) expect(entry(el, id)).toBe(before[id]);
    expect(entry(el, 'e7')).not.toBe(before.e7);
    expect(entry(el, 'e7')?.querySelector('.wl-text')?.textContent).toBe('Rate limited for 40 s');
    expect(entry(el, 'e9')?.previousElementSibling).toBe(entry(el, 'e8'));
    expect(head2?.querySelector('.wl-g-count')?.textContent).toBe('7');
    // The same data again changes nothing.
    el.data = { groups: next.map((g) => ({ ...g })) };
    el.renderNow();
    expect(entry(el, 'e7')?.isConnected).toBe(true);
    expect(entry(el, 'e1')).toBe(before.e1);
  });

  it('a newer group is appended; the old newest closes unless the reader opened it', () => {
    const el = mount({ groups: groups() });
    const g2 = group(el, 'g2');
    const next = [
      ...groups(),
      { id: 'g3', title: 'Ship it', entries: [{ id: 'e10', kind: 'notice' as const, text: 'x' }] },
    ];
    el.data = { groups: next };
    el.renderNow();
    expect(scroller(el).items.map((i) => i.dataset.item)).toEqual(['g1', 'g2', 'g3']);
    expect(group(el, 'g2')).toBe(g2);
    expect(g2?.hasAttribute('data-open')).toBe(false);
    expect(group(el, 'g3')?.hasAttribute('data-open')).toBe(true);
    // The reader opens g1: it stays open through later updates.
    q(el, '.wl-group[data-item="g1"] .wl-gh')!.click();
    el.data = { groups: [...next, { id: 'g4', entries: [] }] };
    el.renderNow();
    expect(group(el, 'g1')?.hasAttribute('data-open')).toBe(true);
  });

  it('a step landing in a shown group rises in once; first-render entries do not', () => {
    const el = mount({ groups: groups() });
    expect(qa(el, '.wl-entry[data-enter]')).toHaveLength(0);
    const next = groups();
    next[1].entries!.push({ id: 'e9', kind: 'narration', text: 'More', at: T0 + 90_000 });
    el.data = { groups: next };
    el.renderNow();
    const e9 = entry(el, 'e9')!;
    expect(e9.hasAttribute('data-enter')).toBe(true);
    e9.dispatchEvent(new Event('animationend', { bubbles: true }));
    expect(e9.hasAttribute('data-enter')).toBe(false);
  });

  it('a newer group does not fold the group the reader is focused in', () => {
    const el = mount({ groups: groups() });
    // happy-dom throws reading activeElement of a shadow root whose slotted (outer-tree) node has focus; browsers
    // answer null there, as this stub does.
    Object.defineProperty(scroller(el).shadowRoot!, 'activeElement', { get: () => null, configurable: true });
    key(el, 'e:e6').focus();
    el.data = { groups: [...groups(), { id: 'g3', entries: [{ id: 'x1', kind: 'notice', text: 'n' }] }] };
    el.renderNow();
    expect(group(el, 'g2')?.hasAttribute('data-open')).toBe(true);
    expect(group(el, 'g3')?.hasAttribute('data-open')).toBe(true);
    expect(el.shadowRoot!.activeElement).toBe(key(el, 'e:e6'));
  });

  it('removes entries and groups that left; moves an entry between groups', () => {
    const el = mount({ groups: groups() });
    const next = groups();
    const moved = next[1].entries!.shift()!;
    next[0].entries!.push(moved);
    next[1].entries = next[1].entries!.filter((e) => e.id !== 'e7');
    el.data = { groups: next };
    el.renderNow();
    expect(entry(el, 'e7')).toBeUndefined();
    expect(entry(el, 'e3')?.closest('.wl-group')?.getAttribute('data-item')).toBe('g1');
    el.data = { groups: [next[1]] };
    el.renderNow();
    expect(scroller(el).items.map((i) => i.dataset.item)).toEqual(['g2']);
    expect(entry(el, 'e1')).toBeUndefined();
  });

  it('older groups go above without touching the ones shown; ui-load-older passes through', async () => {
    const el = mount({ groups: groups(), hasMore: true });
    const older = vi.fn();
    el.addEventListener('ui-load-older', (e) => older((e as CustomEvent).detail));
    const sc = scroller(el);
    const btn = sc.shadowRoot!.querySelector<HTMLButtonElement>('.ls-older')!;
    btn.click();
    expect(older).toHaveBeenCalledWith({ oldest: 'g1' });
    await Promise.resolve();
    expect(sc.shadowRoot!.querySelector('.ls-older')?.getAttribute('aria-busy')).toBe('true');
    const g1 = group(el, 'g1');
    const e1 = entry(el, 'e1');
    el.data = {
      groups: [{ id: 'g0', title: 'Plan', entries: [{ id: 'e0', kind: 'instruction', text: 'Plan it' }] }, ...groups()],
      hasMore: false,
    };
    el.renderNow();
    expect(sc.items.map((i) => i.dataset.item)).toEqual(['g0', 'g1', 'g2']);
    expect(group(el, 'g1')).toBe(g1);
    expect(entry(el, 'e1')).toBe(e1);
    expect(group(el, 'g0')?.hasAttribute('data-open')).toBe(false);
    sc.renderNow();
    expect(sc.shadowRoot!.querySelector('.ls-older')).toBeNull();
    expect(sc.shadowRoot!.querySelector('.ls-start')?.textContent).toBe('Start of history');
  });

  it('a host answer without a page ends the loading row', async () => {
    const el = mount({ groups: groups(), hasMore: true });
    const sc = scroller(el);
    sc.shadowRoot!.querySelector<HTMLButtonElement>('.ls-older')!.click();
    await Promise.resolve();
    expect(sc.shadowRoot!.querySelector('.ls-older')?.getAttribute('aria-busy')).toBe('true');
    el.data = { groups: groups(), hasMore: true };
    el.renderNow();
    sc.renderNow();
    expect(sc.shadowRoot!.querySelector('.ls-older')?.hasAttribute('aria-busy')).toBe(false);
  });

  it('forwards hasMore / loading / label / startText to the scroller', () => {
    const el = mount({ groups: groups(), hasMore: true, label: 'Agent work', startText: '' });
    const d = scroller(el).data!;
    expect(d.hasMore).toBe(true);
    expect(d.label).toBe('Agent work');
    expect(d.startText).toBe('');
    const first = mount({ loading: true });
    expect(scroller(first).data?.loading).toBe(true);
    expect(mount({}).shadowRoot && scroller(mount({})).data?.label).toBe('Work log');
  });
});

describe('<ui-work-log> group disclosure and keyboard', () => {
  it('a head click toggles the group and sends ui-toggle (cancelable)', () => {
    const el = mount({ groups: groups() });
    const toggles: unknown[] = [];
    el.addEventListener('ui-toggle', (e) => toggles.push((e as CustomEvent).detail));
    const head = q(el, '.wl-group[data-item="g1"] .wl-gh')!;
    head.click();
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(group(el, 'g1')?.hasAttribute('data-open')).toBe(true);
    expect(q(el, `#${head.getAttribute('aria-controls')}`)?.hasAttribute('inert')).toBe(false);
    expect(el.isOpen('g1')).toBe(true);
    expect(toggles).toEqual([{ kind: 'group', id: 'g1', group: 'g1', open: true }]);
    el.addEventListener('ui-toggle', (e) => e.preventDefault(), { once: true });
    head.click();
    expect(head.getAttribute('aria-expanded')).toBe('true');
  });

  it('a controlled group only asks; the host answers with data', () => {
    const data = groups();
    data[0].open = false;
    const el = mount({ groups: data });
    const head = q(el, '.wl-group[data-item="g1"] .wl-gh')!;
    const fired = vi.fn();
    el.addEventListener('ui-toggle', fired);
    head.click();
    expect(fired).toHaveBeenCalledTimes(1);
    expect(head.getAttribute('aria-expanded')).toBe('false');
    data[0].open = true;
    el.data = { groups: data };
    el.renderNow();
    expect(head.getAttribute('aria-expanded')).toBe('true');
  });

  it('one tab stop (the newest row); arrows, Home and End walk the visible heads and rows', () => {
    const el = mount({ groups: groups() });
    const stops = () => qa(el, '[data-nav]').filter((n) => n.getAttribute('tabindex') === '0');
    expect(stops()).toHaveLength(1);
    expect(stops()[0].dataset.key).toBe('e:e8');
    const h1 = key(el, 'g:g1');
    h1.focus();
    expect(stops()[0]).toBe(h1);
    // g1 is closed: its rows are skipped.
    press(h1, 'ArrowDown');
    expect(el.shadowRoot!.activeElement).toBe(key(el, 'g:g2'));
    press(key(el, 'g:g2'), 'ArrowDown');
    expect(el.shadowRoot!.activeElement).toBe(key(el, 'a:e5'));
    press(key(el, 'a:e5'), 'End');
    expect(el.shadowRoot!.activeElement).toBe(key(el, 'e:e8'));
    const ev = press(key(el, 'e:e8'), 'Home');
    expect(ev.defaultPrevented).toBe(true);
    expect(el.shadowRoot!.activeElement).toBe(h1);
    press(h1, 'ArrowUp');
    expect(el.shadowRoot!.activeElement).toBe(h1);
    // Right opens a closed head, Left closes an open one.
    press(h1, 'ArrowRight');
    expect(h1.getAttribute('aria-expanded')).toBe('true');
    press(h1, 'ArrowDown');
    expect(el.shadowRoot!.activeElement).toBe(key(el, 'e:e1'));
    h1.focus();
    press(h1, 'ArrowLeft');
    expect(h1.getAttribute('aria-expanded')).toBe('false');
  });

  it('closing a group with focus inside moves focus to its head', () => {
    const el = mount({ groups: groups() });
    key(el, 'e:e6').focus();
    q(el, '.wl-group[data-item="g2"] .wl-gh')!.click();
    expect(el.shadowRoot!.activeElement).toBe(key(el, 'g:g2'));
  });

  it('Enter and Space on a row open its raw output; focus stays on the row', () => {
    const el = mount({ groups: groups() });
    const row = key(el, 'e:e6');
    row.focus();
    expect(press(row, 'Enter').defaultPrevented).toBe(true);
    const open = key(el, 'e:e6');
    expect(open.getAttribute('aria-expanded')).toBe('true');
    expect(el.shadowRoot!.activeElement).toBe(open);
    press(open, ' ');
    expect(key(el, 'e:e6').getAttribute('aria-expanded')).toBe('false');
  });
});

describe('<ui-work-log> raw output, skills and actions', () => {
  it('a row opens its raw output (ui-toggle) with size, Copy and the text; it fades in once', () => {
    const el = mount({ groups: groups() });
    const fired = vi.fn();
    el.addEventListener('ui-toggle', (e) => fired((e as CustomEvent).detail));
    entry(el, 'e6')!.querySelector<HTMLElement>('.wl-row')!.click();
    expect(fired).toHaveBeenCalledWith({ kind: 'entry', id: 'e6', group: 'g2', open: true });
    const e = entry(el, 'e6')!;
    const detail = e.querySelector('.wl-detail')!;
    expect(detail.hasAttribute('hidden')).toBe(false);
    expect(detail.hasAttribute('data-enter')).toBe(true);
    expect(detail.querySelector('.raw-size')?.textContent).toBe('2.0 KiB');
    expect(detail.querySelector('pre.raw-text')?.textContent).toBe('full output\nline 2');
    expect(e.querySelector('.wl-row')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('a row with hasRaw but no output shows Loading until the host sets it', () => {
    const el = mount({ groups: groups() });
    const asked: string[] = [];
    el.addEventListener('ui-toggle', (e) => {
      const d = (e as CustomEvent).detail;
      if (d.kind === 'entry' && d.open) asked.push(d.id);
    });
    q(el, '.wl-group[data-item="g1"] .wl-gh')!.click();
    entry(el, 'e1')!.querySelector<HTMLElement>('.wl-row')!.click();
    expect(asked).toEqual(['e1']);
    expect(entry(el, 'e1')?.querySelector('.raw')?.getAttribute('data-state')).toBe('loading');
    expect(entry(el, 'e1')?.textContent).toContain('Loading output…');
    const data = groups();
    data[0].entries![0] = { ...data[0].entries![0], raw: { state: 'ready', text: 'stored prompt' } };
    el.data = { groups: data };
    el.renderNow();
    expect(entry(el, 'e1')?.querySelector('pre')?.textContent).toBe('stored prompt');
    expect(entry(el, 'e1')?.querySelector('.wl-detail')?.hasAttribute('data-enter')).toBe(false);
  });

  it('Copy writes the clipboard, tells the host (not cancelable) and reads Copied for a moment', async () => {
    vi.useFakeTimers();
    const write = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
    const el = mount({ groups: groups() });
    const copies: CustomEvent[] = [];
    el.addEventListener('ui-copy', (e) => copies.push(e as CustomEvent));
    entry(el, 'e6')!.querySelector<HTMLElement>('.wl-row')!.click();
    const copy = entry(el, 'e6')!.querySelector<HTMLButtonElement>('.raw-copy')!;
    copy.focus();
    copy.click();
    expect(write).toHaveBeenCalledWith('full output\nline 2');
    await vi.advanceTimersByTimeAsync(0); // the write settles
    expect(copies).toHaveLength(1);
    expect(copies[0].detail).toEqual({ id: 'e6', group: 'g2', text: 'full output\nline 2' });
    expect(copies[0].cancelable).toBe(false);
    expect(copies[0].composed).toBe(true);
    const now = entry(el, 'e6')!.querySelector('.raw-copy')!;
    expect(now.textContent).toBe('Copied');
    expect(el.shadowRoot!.activeElement).toBe(now);
    vi.advanceTimersByTime(WORK_LOG_COPIED_MS + 10);
    expect(entry(el, 'e6')!.querySelector('.raw-copy')?.textContent).toBe('Copy');
  });

  it('a failed copy says nothing: no Copied, no ui-copy', async () => {
    const write = vi.fn(() => Promise.reject(new Error('denied')));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
    const exec = document.execCommand;
    (document as unknown as { execCommand?: unknown }).execCommand = undefined;
    try {
      const el = mount({ groups: groups() });
      const copies: CustomEvent[] = [];
      el.addEventListener('ui-copy', (e) => copies.push(e as CustomEvent));
      entry(el, 'e6')!.querySelector<HTMLElement>('.wl-row')!.click();
      entry(el, 'e6')!.querySelector<HTMLButtonElement>('.raw-copy')!.click();
      await new Promise((r) => setTimeout(r, 0));
      expect(write).toHaveBeenCalled();
      expect(copies).toHaveLength(0);
      expect(entry(el, 'e6')!.querySelector('.raw-copy')?.textContent).toBe('Copy');
    } finally {
      (document as unknown as { execCommand?: unknown }).execCommand = exec;
    }
  });

  it('Retry sends a cancelable ui-retry; unprevented it shows Loading until the host answers', () => {
    const data = groups();
    const el = mount({ groups: data });
    entry(el, 'e8')!.querySelector<HTMLElement>('.wl-row')!.click();
    const e8 = () => entry(el, 'e8')!;
    expect(e8().querySelector('.raw')?.getAttribute('data-state')).toBe('error');
    const retries: unknown[] = [];
    el.addEventListener('ui-retry', (e) => {
      retries.push((e as CustomEvent).detail);
      if (retries.length === 1) e.preventDefault();
    });
    e8().querySelector<HTMLButtonElement>('.raw-retry')!.click();
    expect(retries).toEqual([{ id: 'e8', group: 'g2' }]);
    expect(e8().querySelector('.raw')?.getAttribute('data-state')).toBe('error');
    e8().querySelector<HTMLButtonElement>('.raw-retry')!.click();
    expect(e8().querySelector('.raw')?.getAttribute('data-state')).toBe('loading');
    // Unrelated updates keep it loading; the entry's new output ends it.
    el.data = { groups: data };
    el.renderNow();
    expect(e8().querySelector('.raw')?.getAttribute('data-state')).toBe('loading');
    data[1].entries![5] = { ...data[1].entries![5], raw: { state: 'ready', text: 'error log' } };
    el.data = { groups: data };
    el.renderNow();
    expect(e8().querySelector('pre')?.textContent).toBe('error log');
  });

  it('Open on a child agent sends a cancelable ui-open with its id', () => {
    const el = mount({ groups: groups() });
    const opened: CustomEvent[] = [];
    el.addEventListener('ui-open', (e) => opened.push(e as CustomEvent));
    q(el, '.wl-agent')!.click();
    expect(opened).toHaveLength(1);
    expect(opened[0].detail).toEqual({ id: 'ag-1', entry: 'e5' });
    expect(opened[0].cancelable).toBe(true);
    expect(opened[0].bubbles).toBe(true);
  });

  it('a skill chip opens its pane; again closes it; focus stays on the chip', () => {
    const data = groups();
    data[0].open = true;
    const el = mount({ groups: data });
    const chip = () => entry(el, 'e1')!.querySelectorAll<HTMLButtonElement>('.skill-badge')[0];
    expect(entry(el, 'e1')!.querySelector('.skill-badges')?.getAttribute('aria-label')).toBe('Skills used: 2');
    chip().focus();
    chip().click();
    expect(chip().getAttribute('aria-expanded')).toBe('true');
    expect(entry(el, 'e1')!.querySelector('.skill-pane pre')?.textContent).toBe('Review the diff');
    expect(q(el, `#${chip().getAttribute('aria-controls')}`)?.classList.contains('skill-pane')).toBe(true);
    expect(el.shadowRoot!.activeElement).toBe(chip());
    chip().click();
    expect(entry(el, 'e1')!.querySelector('.skill-pane')).toBeNull();
  });
});

describe('<ui-work-log> states', () => {
  it('empty: the empty text in the scroller (custom text too)', () => {
    const el = mount({ groups: [] });
    expect(scroller(el).items).toHaveLength(0);
    const empty = q(el, '.wl-empty')!;
    expect(empty.getAttribute('slot')).toBe('empty');
    expect(empty.dataset.state).toBe('empty');
    expect(empty.textContent).toBe('No work logged yet');
    el.data = { groups: [], emptyText: 'Nothing yet' };
    el.renderNow();
    expect(q(el, '.wl-empty')?.textContent).toBe('Nothing yet');
  });

  it('denied: groups go, the owner-only notice shows, no paging', () => {
    const el = mount({ groups: groups(), hasMore: true, legacy: true });
    el.data = { groups: groups(), hasMore: true, legacy: true, denied: true };
    el.renderNow();
    expect(scroller(el).items).toHaveLength(0);
    expect(q(el, '.wl-empty')?.dataset.state).toBe('denied');
    expect(q(el, '.wl-empty')?.textContent).toBe('Only the owner can see this work log');
    expect(scroller(el).data?.hasMore).toBe(false);
    expect(q(el, '.wl-legacy')?.hidden).toBe(true);
    // Allowed again: the groups come back.
    el.data = { groups: groups() };
    el.renderNow();
    expect(scroller(el).items).toHaveLength(2);
  });

  it('legacy: a note above the log', () => {
    const el = mount({ groups: groups(), legacy: true });
    const note = q(el, '.wl-legacy')!;
    expect(note.hidden).toBe(false);
    expect(note.getAttribute('role')).toBe('note');
    expect(note.textContent).toContain('older log');
    el.data = { groups: groups(), legacy: 'Imported log' };
    el.renderNow();
    expect(note.textContent).toBe('Imported log');
    el.data = { groups: groups() };
    el.renderNow();
    expect(note.hidden).toBe(true);
  });
});

describe('<ui-work-log> lang="ko"', () => {
  it('Korean strings, mirrored to the scroller; a lang switch re-renders in place', () => {
    const el = mount({ groups: groups(), legacy: true }, { lang: 'ko', theme: 'dark' });
    const sc = scroller(el);
    expect(sc.getAttribute('lang')).toBe('ko');
    expect(sc.getAttribute('theme')).toBe('dark');
    expect(sc.data?.label).toBe('작업 로그');
    expect(entry(el, 'e1')?.querySelector('.wl-label')?.textContent).toBe('지시');
    expect(entry(el, 'e2')?.querySelector('.wl-label')?.textContent).toBe('진행');
    expect(entry(el, 'e6')?.querySelector('.wl-label')?.textContent).toBe('응답');
    expect(entry(el, 'e7')?.querySelector('.wl-label')?.textContent).toBe('알림');
    expect(entry(el, 'e8')?.querySelector('.wl-label')?.textContent).toBe('오류');
    expect(entry(el, 'e3')?.querySelector('.wl-st')?.textContent).toBe('완료');
    expect(entry(el, 'e4')?.querySelector('.sys-badge')?.textContent).toBe('압축');
    expect(entry(el, 'e5')?.querySelector('.wl-ag-tools')?.textContent).toBe('툴 3개');
    expect(entry(el, 'e5')?.querySelector('.wl-ag-open')?.textContent).toBe('열기');
    expect(q(el, '.wl-group[data-item="g2"] .sr-only')?.textContent).toBe('항목 6개');
    expect(q(el, '.wl-legacy')?.textContent).toContain('이전 형식');
    entry(el, 'e6')!.querySelector<HTMLElement>('.wl-row')!.click();
    expect(entry(el, 'e6')?.querySelector('.raw-copy')?.textContent).toBe('복사');
    const ko = mount({ denied: true }, { lang: 'ko' });
    expect(q(ko, '.wl-empty')?.textContent).toBe('작업 로그는 소유자만 볼 수 있어요');
    // Switch back to English: the same groups, re-rendered.
    el.removeAttribute('lang');
    el.renderNow();
    expect(sc.getAttribute('lang')).toBeNull();
    expect(entry(el, 'e1')?.querySelector('.wl-label')?.textContent).toBe('Instruction');
    expect(entry(el, 'e6')?.querySelector('.wl-row')?.getAttribute('aria-expanded')).toBe('true');
    expect(sc.items.map((i) => i.dataset.item)).toEqual(['g1', 'g2']);
  });
});

describe('styles', () => {
  it('tokens and color-mix only; hover gated; weights 500–650; reduced motion', () => {
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(styles).not.toMatch(/rgba?\(/);
    const hover = styles.indexOf('@media (hover: hover) and (pointer: fine)');
    expect(hover).toBeGreaterThan(-1);
    expect(styles.indexOf(':hover')).toBeGreaterThan(hover);
    for (const w of styles.match(/font-weight: (\d+)/g) ?? []) {
      const n = Number(w.split(': ')[1]);
      expect(n >= 500 && n <= 650).toBe(true);
    }
    expect(styles).toContain('grid-template-rows: 0fr');
    // A settled group shows overflow; its column must still not grow past the log (nowrap tool lines ellipsize).
    expect(styles).toContain('.wl-g-region { display: grid; grid-template-columns: minmax(0, 1fr);');
    expect(styles).toContain('var(--dur-expand) var(--ease-out)');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).not.toMatch(/:hover[^{]*\{[^}]*transform/);
  });
});

describe('docs', () => {
  it('every demo builds without the network; cards fill their slots; older pages arrive on ui-load-older', async () => {
    vi.useFakeTimers();
    expect(doc.tag).toBe('ui-work-log');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    const built = Object.fromEntries(
      doc.demos.map((d) => {
        const el = d.create();
        document.body.append(el);
        return [d.id, el];
      }),
    );
    for (const el of document.querySelectorAll('ui-work-log')) (el as UiWorkLog).renderNow();
    const cards = built.cards as UiWorkLog;
    const slot = cards.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="tool-c-2"]')!;
    expect(slot.assignedElements()[0]?.tagName).toBe('UI-TOOL-CALL-CARD');
    expect(cards.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="tool-c-4"]')?.assignedElements()).toEqual([]);
    const older = built.older as UiWorkLog;
    older.dispatchEvent(new CustomEvent('ui-load-older', { detail: { oldest: null } }));
    vi.advanceTimersByTime(800);
    older.renderNow();
    expect(scroller(older).items.length).toBe(5); // three shown + a page of two
    const run = built.run as UiWorkLog;
    run.renderNow();
    expect(run.shadowRoot!.querySelector('img')).toBeNull();
    expect(q(run, '.wl-agent[data-status="running"]')).not.toBeNull();
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    spy = soundSpy();
  });
  afterEach(() => spy.restore());
  const tap = (n: Element | null | undefined, detail = 1) =>
    (n as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail }));
  const head = (el: UiWorkLog, g: string) => q(el, `.wl-group[data-item="${g}"] .wl-gh`);
  const row = (el: UiWorkLog, id: string) => entry(el, id)?.querySelector('.wl-row');

  it('groups and rows: open / close by click or key', async () => {
    const el = mount({ groups: groups() });
    tap(head(el, 'g1'));
    await spy.settle();
    press(head(el, 'g2')!, 'ArrowLeft');
    await spy.settle();
    tap(row(el, 'e6'));
    await spy.settle();
    press(key(el, 'e:e6'), 'Enter');
    await spy.settle();
    expect(spy.calls).toEqual([
      ['open', { emphasis: 'subtle', input: 'mouse' }],
      ['close', { emphasis: 'subtle', input: 'keyboard' }],
      ['open', { emphasis: 'subtle', input: 'mouse' }],
      ['close', { emphasis: 'subtle', input: 'keyboard' }],
    ]);
  });

  it('a copy that lands → success; Retry → tap; Open on a child agent → navigate', async () => {
    const write = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
    const el = mount({ groups: groups() });
    tap(row(el, 'e6'));
    tap(row(el, 'e8'));
    await spy.settle();
    spy.calls.length = 0;
    tap(entry(el, 'e6')?.querySelector('.raw-copy'));
    await spy.settle();
    tap(entry(el, 'e8')?.querySelector('.raw-retry'), 0);
    await spy.settle();
    tap(q(el, '.wl-agent'));
    await spy.settle();
    expect(spy.calls).toEqual([
      ['success', { emphasis: 'subtle', input: 'mouse' }],
      ['tap', { input: 'keyboard' }],
      ['navigate', { input: 'mouse' }],
    ]);
  });

  it('nothing for a prevented event, data the app sets, or a data-ui-sound="off" region', async () => {
    const data = groups();
    const el = mount({ groups: data });
    tap(row(el, 'e8'));
    await spy.settle();
    spy.calls.length = 0;
    for (const n of ['ui-toggle', 'ui-retry', 'ui-open']) el.addEventListener(n, (e) => e.preventDefault());
    tap(head(el, 'g1'));
    tap(row(el, 'e6'));
    tap(entry(el, 'e8')?.querySelector('.raw-retry'));
    tap(q(el, '.wl-agent'));
    data[0].open = true;
    el.data = { groups: data };
    el.renderNow();
    await spy.settle();
    expect(spy.calls).toEqual([]);
    const quiet = document.createElement('div');
    quiet.setAttribute('data-ui-sound', 'off');
    document.body.append(quiet);
    const off = mount({ groups: groups() });
    quiet.append(off);
    tap(head(off, 'g1'));
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });
});
