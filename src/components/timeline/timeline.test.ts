import { afterEach, describe, expect, it } from 'vitest';
import { soundSpy } from '../../sound/fixtures';
import { doc } from './docs';
import {
  type TimelineActionDetail,
  type TimelineCheck,
  type TimelineData,
  timelineDone,
  timelineItems,
  timelineMarker,
  timelineProgress,
  timelineStatus,
  timelineStrings,
  timelineTone,
} from './logic';
import { styles } from './styles';
import type { UiTimeline } from './timeline';
import './timeline';

const XSS = '<img src=x onerror=alert(1)>';

function mount(data?: TimelineData, attrs: Record<string, string> = {}): UiTimeline {
  const el = document.createElement('ui-timeline');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  if (data) el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiTimeline, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = (el: UiTimeline, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const items = (el: UiTimeline) => qa(el, '.tl-item');
const box = (el: UiTimeline, i: number) => items(el)[i].querySelector<HTMLElement>('.tl-check');
const focused = (el: UiTimeline) => el.shadowRoot!.activeElement as HTMLElement | null;

const JOBS: TimelineData = {
  label: 'Scheduled jobs today',
  items: [
    {
      id: 'sync',
      time: '07:00',
      title: 'sync-calendars',
      detail: 'Every day · 42 s',
      tone: 'done',
      status: { text: 'Ran 07:01', tone: 'done' },
    },
    {
      id: 'digest',
      time: '09:30',
      title: 'digest-mail',
      detail: 'Runner was offline',
      tone: 'fail',
      overdue: true,
      status: { text: 'Missed', tone: 'fail' },
      actions: [
        { id: 'run', label: 'Run now' },
        { id: 'skip', label: 'Skip' },
      ],
    },
    {
      id: 'reindex',
      time: '13:00',
      title: 'reindex-search',
      tone: 'run',
      current: true,
      status: { text: 'Running', tone: 'run' },
    },
    {
      id: 'report',
      time: '18:00',
      title: 'token-spend-report',
      status: { text: 'Later' },
      actions: [{ id: 'skip', label: 'Skip' }],
    },
  ],
};

const STEPS: TimelineData = {
  label: 'Release checklist',
  items: [
    { id: 'freeze', title: 'Freeze main', checkable: true, checked: true },
    { id: 'bump', title: 'Bump version', checkable: true, checked: true },
    { id: 'verify', title: 'npm run verify', checkable: true },
    { id: 'tag', title: 'Tag and push', checkable: true, overdue: true },
    { id: 'publish', title: 'Publish to npm', checkable: true },
  ],
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('helpers', () => {
  it('timelineItems: drops junk, keeps order, first of each id; trims; status and actions normalised', () => {
    const got = timelineItems({
      items: [
        null,
        'x',
        { id: 'a', title: '  A  ', time: ' 08:00 ', detail: 3, tone: 'nope', status: 'Later', checkable: 'yes' },
        { id: 'a', title: 'dup' },
        { id: '', title: 'no id' },
        { id: 'b' },
        { id: 'c', title: 'C', status: { text: '  ' }, tone: 'run', checked: true, overdue: true, current: true },
        {
          id: 'd',
          title: 'D',
          status: { text: 'Missed', tone: 'bad' },
          actions: [null, { id: 'run', label: 'Run' }, { id: 'run', label: 'again' }, { id: 'x' }, { label: 'y' }],
        },
      ],
    } as never);
    expect(got.map((it) => it.id)).toEqual(['a', 'c', 'd']);
    expect(got[0]).toMatchObject({ title: 'A', time: '08:00', detail: '3', tone: undefined, checkable: false });
    expect(got[0].status).toEqual({ text: 'Later', tone: undefined });
    expect(got[1]).toMatchObject({ status: undefined, tone: 'run', checked: true, overdue: true, current: true });
    expect(got[2].status).toEqual({ text: 'Missed', tone: undefined });
    expect(got[2].actions).toEqual([{ id: 'run', label: 'Run' }]);
    expect(timelineItems(undefined)).toEqual([]);
    expect(timelineItems({ items: 'x' } as never)).toEqual([]);
    expect(timelineTone('wait')).toBe('wait');
    expect(timelineTone('red')).toBeUndefined();
  });

  it('timelineDone / timelineProgress: checkable items by their box, others by a done tone; the rail split', () => {
    expect(timelineDone({ checkable: true, checked: true, tone: undefined })).toBe(true);
    expect(timelineDone({ checkable: true, checked: false, tone: 'done' })).toBe(false);
    expect(timelineDone({ checkable: false, checked: false, tone: 'done' })).toBe(true);
    expect(timelineProgress(timelineItems(STEPS))).toEqual({ done: 2, total: 5, split: 1 });
    expect(timelineProgress(timelineItems(JOBS))).toEqual({ done: 1, total: 4, split: 0 });
    // The split is the LAST done item, even with a gap before it.
    const gap = timelineItems({
      items: [
        { id: 'a', title: 'A', checkable: true, checked: true },
        { id: 'b', title: 'B', checkable: true },
        { id: 'c', title: 'C', checkable: true, checked: true },
        { id: 'd', title: 'D', checkable: true },
      ],
    });
    expect(timelineProgress(gap)).toEqual({ done: 2, total: 4, split: 2 });
    expect(timelineProgress([])).toEqual({ done: 0, total: 0, split: -1 });
    expect(timelineProgress(null)).toEqual({ done: 0, total: 0, split: -1 });
  });

  it('timelineStatus: the item’s own, else Done when ticked, else Overdue while late; local ticks override', () => {
    const s = timelineStrings('en');
    const [freeze, , verify, tag] = timelineItems(STEPS);
    const [, digest, , report] = timelineItems(JOBS);
    expect(timelineStatus(digest, false, s)).toEqual({ text: 'Missed', tone: 'fail' });
    expect(timelineStatus(report, false, s)).toEqual({ text: 'Later', tone: 'idle' });
    expect(timelineStatus(freeze, true, s)).toEqual({ text: 'Done', tone: 'done' });
    expect(timelineStatus(verify, false, s)).toBeUndefined();
    expect(timelineStatus(tag, false, s)).toEqual({ text: 'Overdue', tone: 'fail' });
    // A local tick: Done; a local untick of a late item: Overdue again; of an on-time item: nothing.
    expect(timelineStatus(tag, true, s)).toEqual({ text: 'Done', tone: 'done' });
    expect(timelineStatus(freeze, false, s)).toBeUndefined();
    const lateDone = timelineItems({
      items: [{ id: 'x', title: 'X', checkable: true, checked: true, overdue: true, status: { text: 'Taken 8:40' } }],
    })[0];
    expect(timelineStatus(lateDone, true, s)).toEqual({ text: 'Taken 8:40', tone: 'idle' });
    expect(timelineStatus(lateDone, false, s)).toEqual({ text: 'Overdue', tone: 'fail' });
    // Korean words.
    expect(timelineStatus(tag, false, timelineStrings('ko'))).toEqual({ text: '지남', tone: 'fail' });
    expect(timelineStatus(tag, true, timelineStrings('ko'))).toEqual({ text: '완료', tone: 'done' });
  });

  it('timelineMarker: the item’s tone, else fail while late and not done, else idle', () => {
    const [freeze, , , tag] = timelineItems(STEPS);
    expect(timelineMarker(tag, false)).toBe('fail');
    expect(timelineMarker(tag, true)).toBe('idle');
    expect(timelineMarker(freeze, true)).toBe('idle');
    expect(timelineMarker(timelineItems(JOBS)[2], false)).toBe('run');
  });

  it('strings: en and ko', () => {
    expect(timelineStrings('en').check('Freeze main')).toBe('Mark Freeze main done');
    expect(timelineStrings('ko').check('메인 동결')).toBe('메인 동결 완료 표시');
    expect(timelineStrings('ko')).toMatchObject({ overdue: '지남', done: '완료', empty: '예정된 일이 없습니다' });
    expect(timelineStrings('fr')).toMatchObject({ overdue: 'Overdue', done: 'Done', empty: 'Nothing scheduled' });
  });
});

describe('<ui-timeline> rendering', () => {
  it('draws an ordered list: time, rail marker, title, detail, status pill, actions', () => {
    const el = mount(JOBS);
    const list = q(el, 'ol.tl-list')!;
    expect(list.getAttribute('aria-label')).toBe('Scheduled jobs today');
    expect(items(el)).toHaveLength(4);
    expect(qa(el, '.tl-time').map((t) => t.textContent)).toEqual(['07:00', '09:30, Overdue', '13:00', '18:00']);
    expect(qa(el, '.tl-title').map((t) => t.textContent)).toEqual([
      'sync-calendars',
      'digest-mail',
      'reindex-search',
      'token-spend-report',
    ]);
    expect(qa(el, '.tl-detail').map((t) => t.textContent)).toEqual(['Every day · 42 s', 'Runner was offline']);
    expect(qa(el, '.tl-rail').every((r) => r.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(items(el).map((li) => li.dataset.tone)).toEqual(['done', 'fail', 'run', 'idle']);
    expect(items(el).map((li) => li.hasAttribute('data-done'))).toEqual([true, false, false, false]);
    const acts = qa(el, '.tl-act');
    expect(acts.map((a) => a.textContent)).toEqual(['Run now', 'Skip', 'Skip']);
    expect(acts.every((a) => a.getAttribute('type') === 'button')).toBe(true);
    // Non-checkable items draw no box.
    expect(qa(el, '.tl-check')).toHaveLength(0);
    expect(q(el, '.tl')!.hasAttribute('data-compact')).toBe(false);
    expect(q(el, '.tl')!.hasAttribute('data-notime')).toBe(false);
  });

  it('status pills carry their tone; a status without one takes the item’s (else idle)', () => {
    const el = mount(JOBS);
    expect(qa(el, '.tl-status').map((p) => [p.textContent, p.dataset.tone])).toEqual([
      ['Ran 07:01', 'done'],
      ['Missed', 'fail'],
      ['Running', 'run'],
      ['Later', 'idle'],
    ]);
    const t = mount({ items: [{ id: 'a', title: 'A', tone: 'wait', status: { text: 'Queued' } }] });
    expect(q(t, '.tl-status')!.dataset.tone).toBe('wait');
    for (const tone of ['done', 'run', 'wait', 'fail']) expect(styles).toContain(`.tl-status[data-tone="${tone}"]`);
    expect(styles).toContain('calc(14% * var(--chroma))');
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(styles).not.toMatch(/rgba?\(/i);
  });

  it('overdue: the row is marked (outline + fail time in CSS), the marker fails, readers hear Overdue', () => {
    const el = mount(JOBS);
    const late = items(el)[1];
    expect(late.hasAttribute('data-overdue')).toBe(true);
    expect(late.dataset.tone).toBe('fail');
    expect(late.querySelector('.tl-time .sr-only')!.textContent).toBe(', Overdue');
    expect(items(el).filter((li) => li.hasAttribute('data-overdue'))).toHaveLength(1);
    expect(styles).toContain('.tl-item[data-overdue] .tl-card { border-color: var(--st-fail); }');
    expect(styles).toContain('.tl-item[data-overdue] .tl-time { color: var(--st-fail-text)');
    // The default Overdue pill already says it: no second word for readers.
    const steps = mount(STEPS);
    const tag = items(steps)[3];
    expect(tag.querySelector('.tl-status')!.textContent).toBe('Overdue');
    expect(tag.querySelector('.tl-status')!.getAttribute('data-tone')).toBe('fail');
    expect(tag.dataset.tone).toBe('fail');
    expect(q(steps, '.tl')!.hasAttribute('data-notime')).toBe(true);
    expect(qa(steps, '.tl-time')).toHaveLength(0);
  });

  it('the current row is aria-current="time"', () => {
    const el = mount(JOBS);
    expect(items(el).map((li) => li.getAttribute('aria-current'))).toEqual([null, null, 'time', null]);
  });

  it('compact: the attribute marks the root (hairline rows, no cards)', () => {
    const el = mount(STEPS, { compact: '' });
    expect(q(el, '.tl')!.hasAttribute('data-compact')).toBe(true);
    expect(styles).toContain('.tl[data-compact] .tl-item + .tl-item { border-top: 1px solid var(--ib-card-border); }');
    el.removeAttribute('compact');
    el.renderNow();
    expect(q(el, '.tl')!.hasAttribute('data-compact')).toBe(false);
  });

  it('the rail is ink from the first item down to the last done one', () => {
    const el = mount(STEPS);
    expect(items(el).map((li) => [li.hasAttribute('data-up'), li.hasAttribute('data-down')])).toEqual([
      [false, true],
      [true, false],
      [false, false],
      [false, false],
      [false, false],
    ]);
    expect(el.progress).toEqual({ done: 2, total: 5, split: 1 });
    box(el, 3)!.click();
    expect(el.progress).toEqual({ done: 3, total: 5, split: 3 });
    expect(items(el).map((li) => [li.hasAttribute('data-up'), li.hasAttribute('data-down')])).toEqual([
      [false, true],
      [true, true],
      [true, true],
      [true, false],
      [false, false],
    ]);
  });

  it('no items: the empty words (yours or the default)', () => {
    expect(q(mount({ items: [] }), '.tl-empty')!.textContent).toBe('Nothing scheduled');
    expect(q(mount(undefined), '.tl-empty')!.textContent).toBe('Nothing scheduled');
    expect(q(mount({ items: [], empty: 'No jobs today' }), '.tl-empty')!.textContent).toBe('No jobs today');
    expect(q(mount({ items: [{ id: 'x' } as never] }), 'ol')).toBeNull();
  });
});

describe('<ui-timeline> checking and actions', () => {
  it('a checkbox is a button role="checkbox" with aria-checked and a "Mark … done" name', () => {
    const el = mount(STEPS);
    const b = box(el, 0)!;
    expect(b.tagName).toBe('BUTTON');
    expect(b.getAttribute('type')).toBe('button');
    expect(b.getAttribute('role')).toBe('checkbox');
    expect(b.getAttribute('aria-checked')).toBe('true');
    expect(b.getAttribute('aria-label')).toBe('Mark Freeze main done');
    expect(box(el, 2)!.getAttribute('aria-checked')).toBe('false');
    expect(qa(el, '.tl-check')).toHaveLength(5);
  });

  it('ticking sends a cancelable ui-check { id, checked } and shows it at once', () => {
    const el = mount(STEPS);
    const got: Array<CustomEvent<TimelineCheck>> = [];
    el.addEventListener('ui-check', (e) => got.push(e as CustomEvent<TimelineCheck>));
    box(el, 2)!.click();
    expect(got.map((e) => e.detail)).toEqual([{ id: 'verify', checked: true }]);
    expect(got[0].bubbles && got[0].composed && got[0].cancelable).toBe(true);
    expect(box(el, 2)!.getAttribute('aria-checked')).toBe('true');
    expect(items(el)[2].hasAttribute('data-done')).toBe(true);
    expect(items(el)[2].querySelector('.tl-status')!.textContent).toBe('Done');
    // Unticking a box the data says is checked.
    box(el, 0)!.click();
    expect(got[1].detail).toEqual({ id: 'freeze', checked: false });
    expect(box(el, 0)!.getAttribute('aria-checked')).toBe('false');
    expect(items(el)[0].querySelector('.tl-status')).toBeNull();
    // Ticking the late one clears its overdue look.
    box(el, 3)!.click();
    expect(items(el)[3].hasAttribute('data-overdue')).toBe(false);
    expect(items(el)[3].querySelector('.tl-status')!.textContent).toBe('Done');
    // The next data assignment is the truth again.
    el.data = { ...STEPS };
    el.renderNow();
    expect(qa(el, '.tl-check').map((b) => b.getAttribute('aria-checked'))).toEqual([
      'true',
      'true',
      'false',
      'false',
      'false',
    ]);
    expect(items(el)[3].hasAttribute('data-overdue')).toBe(true);
  });

  it('a prevented ui-check leaves the box as it was', () => {
    const el = mount(STEPS);
    el.addEventListener('ui-check', (e) => e.preventDefault());
    box(el, 2)!.click();
    box(el, 0)!.click();
    el.renderNow();
    expect(box(el, 2)!.getAttribute('aria-checked')).toBe('false');
    expect(box(el, 0)!.getAttribute('aria-checked')).toBe('true');
    expect(el.progress.done).toBe(2);
  });

  it('a listener that sets data during ui-check wins over the optimistic tick', () => {
    const el = mount(STEPS);
    el.addEventListener('ui-check', () => {
      el.data = { ...STEPS, items: STEPS.items.map((it) => (it.id === 'verify' ? { ...it, checked: false } : it)) };
    });
    box(el, 2)!.click();
    el.renderNow();
    expect(box(el, 2)!.getAttribute('aria-checked')).toBe('false');
  });

  it('an action sends a cancelable ui-action { id, action }', () => {
    const el = mount(JOBS);
    const got: Array<CustomEvent<TimelineActionDetail>> = [];
    el.addEventListener('ui-action', (e) => got.push(e as CustomEvent<TimelineActionDetail>));
    const [run, skip, skip2] = qa(el, '.tl-act');
    run.click();
    skip.click();
    skip2.click();
    expect(got.map((e) => e.detail)).toEqual([
      { id: 'digest', action: 'run' },
      { id: 'digest', action: 'skip' },
      { id: 'report', action: 'skip' },
    ]);
    expect(got.every((e) => e.bubbles && e.composed && e.cancelable)).toBe(true);
  });

  it('sound: toggle forward / back for a tick that went through, tap for an action; nothing when prevented', async () => {
    const spy = soundSpy();
    try {
      const el = mount(STEPS);
      box(el, 2)!.click();
      await spy.settle();
      box(el, 2)!.click();
      await spy.settle();
      expect(spy.calls.map(([c, o]) => [c, o?.direction])).toEqual([
        ['toggle', 'forward'],
        ['toggle', 'back'],
      ]);
      el.addEventListener('ui-check', (e) => e.preventDefault());
      box(el, 3)!.click();
      await spy.settle();
      expect(spy.calls).toHaveLength(2);
      const jobs = mount(JOBS);
      q(jobs, '.tl-act')!.click();
      await spy.settle();
      expect(spy.cues().at(-1)).toBe('tap');
      jobs.addEventListener('ui-action', (e) => e.preventDefault());
      q(jobs, '.tl-act')!.click();
      await spy.settle();
      expect(spy.calls).toHaveLength(3);
      // Data the app sets is silent.
      jobs.data = { ...JOBS };
      jobs.renderNow();
      expect(spy.calls).toHaveLength(3);
    } finally {
      spy.restore();
    }
  });

  it('focus survives a re-render: the checkbox and the action keep their keys (even when the rows move)', () => {
    const el = mount({ items: [...STEPS.items, ...JOBS.items] });
    const b = box(el, 2)!;
    b.focus();
    expect(focused(el)).toBe(b);
    const key = b.dataset.key;
    el.data = { items: [...[...STEPS.items].reverse(), ...JOBS.items] };
    el.renderNow();
    expect(focused(el)?.dataset.key).toBe(key);
    expect(focused(el)?.dataset.id).toBe('verify');
    const act = qa(el, '.tl-act')[1];
    act.focus();
    el.data = { items: [...JOBS.items] };
    el.renderNow();
    expect(focused(el)?.classList.contains('tl-act')).toBe(true);
    expect(focused(el)?.dataset.action).toBe('skip');
    expect(focused(el)?.dataset.id).toBe('digest');
    // A tick re-renders too and keeps focus on the box.
    const steps = mount(STEPS);
    box(steps, 2)!.focus();
    box(steps, 2)!.click();
    expect(focused(steps)?.dataset.id).toBe('verify');
  });
});

describe('<ui-timeline> escaping and Korean', () => {
  it('escapes the title, detail, status, action labels, time, ids, the label and the empty words', () => {
    const el = mount({
      label: XSS,
      items: [
        {
          id: XSS,
          time: XSS,
          title: XSS,
          detail: XSS,
          status: { text: XSS, tone: 'fail' },
          checkable: true,
          overdue: true,
          actions: [{ id: XSS, label: XSS }],
        },
      ],
    });
    const root = el.shadowRoot!;
    expect(root.querySelector('img')).toBeNull();
    expect(q(el, 'ol')!.getAttribute('aria-label')).toBe(XSS);
    expect(q(el, '.tl-title')!.textContent).toBe(XSS);
    expect(q(el, '.tl-detail')!.textContent).toBe(XSS);
    expect(q(el, '.tl-status')!.textContent).toBe(XSS);
    expect(q(el, '.tl-act')!.textContent).toBe(XSS);
    expect(q(el, '.tl-time')!.firstChild!.textContent).toBe(XSS);
    expect(q(el, '.tl-check')!.getAttribute('aria-label')).toBe(`Mark ${XSS} done`);
    const got: unknown[] = [];
    el.addEventListener('ui-check', (e) => got.push((e as CustomEvent).detail));
    el.addEventListener('ui-action', (e) => got.push((e as CustomEvent).detail));
    q(el, '.tl-check')!.click();
    q(el, '.tl-act')!.click();
    expect(got).toEqual([
      { id: XSS, checked: true },
      { id: XSS, action: XSS },
    ]);
    expect(root.querySelector('img')).toBeNull();
    expect(mount({ items: [], empty: XSS }).shadowRoot!.querySelector('img')).toBeNull();
  });

  it('lang="ko": Overdue → 지남, Done → 완료, the empty words and the checkbox name', () => {
    const el = mount(STEPS, { lang: 'ko' });
    expect(box(el, 0)!.getAttribute('aria-label')).toBe('Freeze main 완료 표시');
    expect(items(el)[0].querySelector('.tl-status')!.textContent).toBe('완료');
    expect(items(el)[3].querySelector('.tl-status')!.textContent).toBe('지남');
    expect(q(el, 'ol')!.getAttribute('aria-label')).toBe('Release checklist');
    const jobs = mount(JOBS, { lang: 'ko' });
    expect(items(jobs)[1].querySelector('.tl-time .sr-only')!.textContent).toBe(', 지남');
    expect(q(mount({ items: [] }, { lang: 'ko' }), '.tl-empty')!.textContent).toBe('예정된 일이 없습니다');
    expect(q(mount({ items: [{ id: 'a', title: 'A' }] }, { lang: 'ko' }), 'ol')!.getAttribute('aria-label')).toBe(
      '일정',
    );
  });
});

describe('docs', () => {
  it('ships three or more demos that build, a Halvi reference and the Components group', () => {
    expect(doc.tag).toBe('ui-timeline');
    expect(doc.group).toBe('Components');
    expect(doc.reference.url).toBe('https://demo.codeandchill.store/halvi/');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) {
      const node = d.create();
      document.body.append(node);
      expect(node).toBeInstanceOf(HTMLElement);
    }
    expect(doc.demos.map((d) => d.id)).toEqual(expect.arrayContaining(['jobs', 'release', 'compact']));
    expect(doc.a11y.join(' ')).toMatch(/Sound \(opt-in/);
  });
});
