import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import { doc } from './docs';
import {
  type StepTrackData,
  type StepTrackStep,
  stepCaption,
  stepCurrent,
  stepProgress,
  stepStates,
  stepWake,
  type UiStepTrack,
} from './step-track';
import { styles } from './styles';

const XSS = '<img src=x onerror=alert(1)>';

const s = (label: string, status?: StepTrackStep['status'], id?: string): StepTrackStep => ({ label, status, id });
const FIVE = ['Plan', 'Build', 'Review', 'Approve', 'Deploy'].map((l) => s(l));

function mount(data?: StepTrackData, attrs: Record<string, string> = {}): UiStepTrack {
  const el = document.createElement('ui-step-track');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  if (data) el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiStepTrack, sel: string) => el.shadowRoot!.querySelector<E>(sel);
const qa = <E extends Element = HTMLElement>(el: UiStepTrack, sel: string) =>
  Array.from(el.shadowRoot!.querySelectorAll<E>(sel));
const states = (el: UiStepTrack) => qa(el, '.st-step').map((li) => li.dataset.st);
const said = (el: UiStepTrack) => qa(el, '.st-step .sr-only').map((x) => x.textContent);
const caption = (el: UiStepTrack) => q(el, '.st-cap')?.textContent;
const key = (t: HTMLElement, k: string) =>
  t.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true }));
const click = (t: HTMLElement, detail = 1) =>
  t.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail }));
const reduceMotion = () =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }));

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('helpers', () => {
  it('stepCurrent: a finite current wins (floored, outside = none); else the marked one, else the first not finished', () => {
    expect(stepCurrent(FIVE, 2)).toBe(2);
    expect(stepCurrent(FIVE, 2.7)).toBe(2);
    expect(stepCurrent(FIVE, -1)).toBe(-1);
    expect(stepCurrent(FIVE, 5)).toBe(-1);
    expect(stepCurrent(FIVE)).toBe(0);
    expect(stepCurrent(FIVE, null)).toBe(0);
    expect(stepCurrent(FIVE, Number.NaN)).toBe(0);
    expect(stepCurrent([s('a', 'done'), s('b', 'todo'), s('c', 'current')])).toBe(2);
    expect(stepCurrent([s('a', 'done'), s('b', 'skipped'), s('c', 'todo')])).toBe(2);
    // A failed step is not finished: it is the current one (a failed current).
    expect(stepCurrent([s('a', 'done'), s('b', 'failed'), s('c', 'todo')])).toBe(1);
    expect(stepCurrent([s('a', 'done'), s('b', 'skipped')])).toBe(-1);
    expect(stepCurrent([])).toBe(-1);
  });

  it('stepStates: the current index draws current (failed stays failed); unset steps by place; past the end = done', () => {
    expect(stepStates(FIVE, 2)).toEqual(['done', 'done', 'current', 'todo', 'todo']);
    expect(stepStates([s('a', 'done'), s('b', 'failed'), s('c')])).toEqual(['done', 'failed', 'todo']);
    expect(stepStates([s('a', 'skipped'), s('b', 'todo'), s('c', 'failed'), s('d', 'done')], 1)).toEqual([
      'skipped',
      'current',
      'failed',
      'done',
    ]);
    // A stray `current` away from the current index reads by its place; junk statuses too.
    expect(stepStates([s('a', 'current'), s('b'), s('c', 'nope' as never)], 1)).toEqual(['done', 'current', 'todo']);
    expect(stepStates(FIVE, 5)).toEqual(['done', 'done', 'done', 'done', 'done']);
    expect(stepStates(FIVE, -1)).toEqual(['todo', 'todo', 'todo', 'todo', 'todo']);
  });

  it('stepCaption: label · place; Failed at …; Done · n of n; To do; Korean', () => {
    expect(stepCaption(FIVE, 2)).toBe('Review · 3 of 5');
    expect(stepCaption(FIVE, 5)).toBe('Done · 5 of 5');
    expect(stepCaption([s('a', 'done'), s('b', 'skipped')])).toBe('Done · 2 of 2');
    expect(stepCaption([s('Build', 'done'), s('QA dev', 'failed'), s('Prod', 'todo')])).toBe('Failed at QA dev');
    expect(stepCaption([s('Build', 'failed'), s('QA', 'todo')], -1)).toBe('Failed at Build');
    expect(stepCaption(FIVE, -1)).toBe('To do · 0 of 5');
    expect(stepCaption([s(''), s('b')], 0)).toBe('1 of 2');
    expect(stepCaption([])).toBe('');
    expect(stepCaption(FIVE, 2, 'ko')).toBe('Review · 5단계 중 3');
    expect(stepCaption(FIVE, 5, 'ko')).toBe('완료 · 5단계 중 5');
    expect(stepCaption([s('dev QA', 'failed')], undefined, 'ko')).toBe('dev QA에서 실패');
  });

  it('stepWake: the dots crossed, in crossing order, at most `reach` back from the landing', () => {
    expect(stepWake(1, 2, 4)).toEqual([{ index: 1, order: 0 }]);
    expect(stepWake(1, 4, 7)).toEqual([
      { index: 1, order: 0 },
      { index: 2, order: 1 },
      { index: 3, order: 2 },
    ]);
    // Reach 1 (wake 0): only the dot beside the landing.
    expect(stepWake(0, 5, 1)).toEqual([{ index: 4, order: 0 }]);
    expect(stepWake(0, 6, 2)).toEqual([
      { index: 4, order: 0 },
      { index: 5, order: 1 },
    ]);
    // Backwards: crossed from the right.
    expect(stepWake(5, 1, 2)).toEqual([
      { index: 3, order: 0 },
      { index: 2, order: 1 },
    ]);
    expect(stepWake(3, 2)).toEqual([{ index: 3, order: 0 }]);
    expect(stepWake(2, 2, 4)).toEqual([]);
    expect(stepWake(-1, 2, 4)).toEqual([]);
    expect(stepWake(1, -1, 4)).toEqual([]);
    expect(stepWake(0, 3, Number.NaN)).toEqual([{ index: 2, order: 0 }]);
    expect(stepWake(0, 3, 0)).toEqual([{ index: 2, order: 0 }]);
  });

  it('stepProgress: 0 … 1 clamped, null when not a finite number', () => {
    expect(stepProgress(0.42)).toBe(0.42);
    expect(stepProgress(1.4)).toBe(1);
    expect(stepProgress(-0.2)).toBe(0);
    expect(stepProgress(null)).toBeNull();
    expect(stepProgress(undefined)).toBeNull();
    expect(stepProgress(Number.NaN)).toBeNull();
    expect(stepProgress('0.5')).toBeNull();
  });
});

describe('<ui-step-track>', () => {
  it('draws every status: done, current (the wide one), to do, failed, skipped — each in words for the reader', () => {
    const el = mount({
      label: 'Pipeline',
      steps: [s('Intake', 'done'), s('Plan', 'skipped'), s('Build', 'current'), s('Review', 'failed'), s('Deploy')],
      progress: 0.5,
    });
    expect(states(el)).toEqual(['done', 'skipped', 'current', 'failed', 'todo']);
    expect(said(el)).toEqual(['Intake, Done', 'Plan, Skipped', 'Build, Current', 'Review, Failed', 'Deploy, To do']);
    const list = q(el, 'ol.st-list')!;
    expect(list.getAttribute('aria-label')).toBe('Pipeline');
    const cur = qa(el, '.st-step')[2];
    expect(cur.getAttribute('aria-current')).toBe('step');
    expect(cur.hasAttribute('data-cur')).toBe(true);
    expect(qa(el, '[aria-current]')).toHaveLength(1);
    expect(qa(el, '[data-cur]')).toHaveLength(1);
    expect(caption(el)).toBe('Build · 3 of 5');
    expect(el.current).toBe(2);
    // Without a label the list is still named.
    expect(q(mount({ steps: FIVE }), 'ol')!.getAttribute('aria-label')).toBe('Steps');
  });

  it('the current fill is a progressbar at the progress: width and aria-valuenow 0 … 100', () => {
    const el = mount({ steps: FIVE, current: 1, progress: 0.426 });
    const bar = q(el, '[role="progressbar"]')!;
    expect(bar.classList.contains('st-fill')).toBe(true);
    expect(bar.closest('.st-step')).toBe(qa(el, '.st-step')[1]);
    expect(bar.getAttribute('aria-label')).toBe('Build');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-valuenow')).toBe('43');
    expect(bar.hasAttribute('aria-busy')).toBe(false);
    expect(bar.style.width).toBe('42.6%');
    expect(qa(el, '[role="progressbar"]')).toHaveLength(1);
    // A new progress patches the same node.
    el.data = { ...el.data!, progress: 0.9 };
    el.renderNow();
    expect(q(el, '[role="progressbar"]')).toBe(bar);
    expect(bar.style.width).toBe('90%');
    expect(bar.getAttribute('aria-valuenow')).toBe('90');
    el.data = { ...el.data!, progress: 3 };
    el.renderNow();
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
  });

  it('indeterminate: a busy progressbar with no value and a sweeping band', () => {
    const el = mount({ steps: FIVE, current: 3, progress: null });
    const bar = q(el, '[role="progressbar"]')!;
    expect(bar.classList.contains('st-busy')).toBe(true);
    expect(bar.getAttribute('aria-busy')).toBe('true');
    expect(bar.hasAttribute('aria-valuenow')).toBe(false);
    expect(bar.querySelector('.st-band')).not.toBeNull();
    expect(q(mount({ steps: FIVE, current: 0 }), '.st-busy')).not.toBeNull();
  });

  it('caption: all done, a failed current (no progressbar), and off with caption: false', () => {
    const done = mount({ steps: FIVE.map((x) => ({ ...x, status: 'done' as const })), progress: 0.5 });
    expect(caption(done)).toBe('Done · 5 of 5');
    expect(states(done)).toEqual(['done', 'done', 'done', 'done', 'done']);
    expect(q(done, '[role="progressbar"]')).toBeNull();
    expect(qa(done, '[aria-current]')).toHaveLength(0);
    const failed = mount({
      steps: [s('Build', 'done'), s('Test', 'done'), s('QA dev', 'failed'), s('Deploy prod', 'todo')],
      progress: 0.4,
    });
    expect(caption(failed)).toBe('Failed at QA dev');
    expect(q(failed, '.st-cap')!.hasAttribute('data-failed')).toBe(true);
    expect(q(failed, '[aria-current="step"]')!.dataset.st).toBe('failed');
    expect(q(failed, '[data-cur]')!.dataset.st).toBe('failed');
    expect(q(failed, '[role="progressbar"]')).toBeNull();
    expect(q(mount({ steps: FIVE, current: 1 }), '.st-cap')!.hasAttribute('data-failed')).toBe(false);
    expect(q(mount({ steps: FIVE, caption: false }), '.st-cap')).toBeNull();
  });

  it('renders nothing without steps; junk entries are dropped', () => {
    expect(q(mount({ steps: [] }), '.st')).toBeNull();
    expect(q(mount(), '.st')).toBeNull();
    expect(states(mount({ steps: [null as never, s('a'), 'x' as never] }))).toEqual(['current']);
  });

  it('a change of current keeps every node: the slots transition instead of re-entering', () => {
    const el = mount({ steps: FIVE, current: 1, progress: 1 });
    const lis = qa(el, '.st-step');
    const dots = qa(el, '.st-dot');
    el.data = { ...el.data!, current: 2, progress: 0 };
    el.renderNow();
    expect(qa(el, '.st-step')).toEqual(lis);
    expect(qa(el, '.st-dot')).toEqual(dots);
    expect(lis[1].hasAttribute('data-cur')).toBe(false);
    expect(lis[2].hasAttribute('data-cur')).toBe(true);
    expect(caption(el)).toBe('Review · 3 of 5');
    // Keyed by id when there is one.
    const ided = mount({ steps: [s('a', undefined, 'x'), s('b', undefined, 'y')] });
    expect(qa(ided, '.st-step').map((li) => li.dataset.mk)).toEqual(['id:x', 'id:y']);
    expect(qa(el, '.st-step').map((li) => li.dataset.mk)).toEqual(['i:0', 'i:1', 'i:2', 'i:3', 'i:4']);
  });

  it('escapes every host string: labels, the track name, ids', () => {
    const el = mount(
      { label: XSS, steps: [s(XSS, 'done', XSS), s(`B ${XSS}`, 'current', '"q"')], progress: 0.2 },
      { interactive: '' },
    );
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    expect(q(el, 'ol')!.getAttribute('aria-label')).toBe(XSS);
    expect(said(el)[0]).toBe(`${XSS}, Done`);
    expect(qa(el, '.st-hit')[0].title).toBe(XSS);
    expect(q(el, '[role="progressbar"]')!.getAttribute('aria-label')).toBe(`B ${XSS}`);
    expect(caption(el)).toBe(`B ${XSS} · 2 of 2`);
    expect(qa(el, '.st-step')[0].dataset.mk).toBe(`id:${XSS}`);
    expect(qa(el, '.st-step')[1].dataset.mk).toBe('id:"q"');
    const failed = mount({ steps: [s(XSS, 'failed')] });
    expect(caption(failed)).toBe(`Failed at ${XSS}`);
    expect(failed.shadowRoot!.querySelector('img')).toBeNull();
  });

  it('lang="ko": the status words and the caption', () => {
    const el = mount(
      {
        steps: [s('계획', 'done'), s('구현', 'current'), s('리뷰', 'todo'), s('승인', 'skipped'), s('배포', 'failed')],
        progress: 0.3,
      },
      { lang: 'ko' },
    );
    expect(said(el)).toEqual(['계획, 완료', '구현, 진행 중', '리뷰, 대기', '승인, 건너뜀', '배포, 실패']);
    expect(caption(el)).toBe('구현 · 5단계 중 2');
    expect(q(el, 'ol')!.getAttribute('aria-label')).toBe('단계');
    const failed = mount({ steps: [s('빌드', 'done'), s('dev QA', 'failed')] }, { lang: 'ko' });
    expect(caption(failed)).toBe('dev QA에서 실패');
    const done = mount({ steps: FIVE, current: 5 }, { lang: 'ko' });
    expect(caption(done)).toBe('완료 · 5단계 중 5');
  });

  it('size and interactive are attributes the styles read', () => {
    const el = mount({ steps: FIVE }, { size: 'sm' });
    expect(qa(el, '.st-hit')).toHaveLength(0);
    el.setAttribute('interactive', '');
    el.renderNow();
    expect(qa(el, 'button.st-hit')).toHaveLength(5);
    expect(styles).toContain(':host([size="sm"]) .st { --st-dot: 6px; --st-wide: 28px; --st-h: 6px;');
    expect(styles).toContain('--st-dot: 8px; --st-wide: 36px; --st-h: 8px;');
  });
});

describe('the wake', () => {
  beforeEach(() => vi.useFakeTimers());
  const waking = (el: UiStepTrack) =>
    qa(el, '.st-dot[data-wake]').map((d) => [
      Number(d.closest<HTMLElement>('.st-step')!.dataset.i),
      d.dataset.wake,
      d.style.getPropertyValue('--i').trim(),
    ]);
  const STEPS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((l) => s(l));

  it('none on the first render', () => {
    const el = mount({ steps: STEPS, current: 3 });
    expect(waking(el)).toEqual([]);
  });

  it('a change of current: the dots crossed get data-wake + --i in crossing order, the landing pill last', () => {
    const el = mount({ steps: STEPS, current: 1, progress: 1 });
    el.data = { ...el.data!, current: 2, progress: 0 };
    el.renderNow();
    expect(waking(el)).toEqual([
      [1, 'cross', '0'],
      [2, 'land', '1'],
    ]);
    // A progress tick mid-wake keeps it.
    el.data = { ...el.data!, progress: 0.1 };
    el.renderNow();
    expect(waking(el)).toHaveLength(2);
    // A jump crosses at most four dots back from the landing.
    el.data = { ...el.data!, current: 7 };
    el.renderNow();
    expect(waking(el)).toEqual([
      [3, 'cross', '0'],
      [4, 'cross', '1'],
      [5, 'cross', '2'],
      [6, 'cross', '3'],
      [7, 'land', '4'],
    ]);
    // Backwards.
    el.data = { ...el.data!, current: 6 };
    el.renderNow();
    expect(waking(el)).toEqual([
      [6, 'land', '1'],
      [7, 'cross', '0'],
    ]);
  });

  it('each dot leaves the wake on animationend; the timeout clears what is left', () => {
    const el = mount({ steps: STEPS, current: 0 });
    el.data = { ...el.data!, current: 3 };
    el.renderNow();
    expect(waking(el)).toHaveLength(4);
    const first = q(el, '.st-dot[data-wake="cross"]')!;
    first.dispatchEvent(new Event('animationend', { bubbles: true, composed: true }));
    expect(first.hasAttribute('data-wake')).toBe(false);
    expect(first.hasAttribute('style')).toBe(false);
    expect(waking(el)).toHaveLength(3);
    // A re-render does not bring it back.
    el.renderNow();
    expect(waking(el)).toHaveLength(3);
    vi.advanceTimersByTime(2000);
    expect(waking(el)).toEqual([]);
    el.renderNow();
    expect(waking(el)).toEqual([]);
  });

  it('no wake into or out of "none", and none under reduced motion', () => {
    const el = mount({ steps: STEPS, current: 2 });
    el.data = { ...el.data!, current: -1 };
    el.renderNow();
    expect(waking(el)).toEqual([]);
    el.data = { ...el.data!, current: 4 };
    el.renderNow();
    expect(waking(el)).toEqual([]);
    reduceMotion();
    el.data = { ...el.data!, current: 5 };
    el.renderNow();
    expect(waking(el)).toEqual([]);
    expect(qa(el, '.st-step')[5].hasAttribute('data-cur')).toBe(true);
  });

  it('disconnecting clears the wake and its timer', () => {
    const el = mount({ steps: STEPS, current: 0 });
    el.data = { ...el.data!, current: 1 };
    el.renderNow();
    expect(vi.getTimerCount()).toBe(1);
    el.remove();
    expect(vi.getTimerCount()).toBe(0);
    expect(qa(el, '.st-dot[data-wake]')).toHaveLength(0);
  });
});

describe('interactive', () => {
  const DATA: StepTrackData = {
    label: 'Goal iterations',
    steps: [s('It 1', 'done', 'i1'), s('It 2', 'done', 'i2'), s('It 3', 'current', 'i3'), s('It 4'), s('It 5')],
    progress: null,
  };
  const hits = (el: UiStepTrack) => qa(el, '.st-hit');
  const active = (el: UiStepTrack) => el.shadowRoot!.activeElement;

  it('dots are buttons with title = label, the words inside, aria-current on the current one, one tab stop', () => {
    const el = mount(DATA, { interactive: '' });
    const b = hits(el);
    expect(b.map((x) => x.getAttribute('type'))).toEqual(['button', 'button', 'button', 'button', 'button']);
    expect(b.map((x) => x.title)).toEqual(['It 1', 'It 2', 'It 3', 'It 4', 'It 5']);
    expect(b.map((x) => x.getAttribute('tabindex'))).toEqual(['-1', '-1', '0', '-1', '-1']);
    expect(b[2].getAttribute('aria-current')).toBe('step');
    expect(qa(el, 'li[aria-current]')).toHaveLength(0);
    expect(b[0].textContent).toBe('It 1, Done');
    // The progressbar stays outside the button (a button's children are presentational).
    expect(q(el, '[role="progressbar"]')!.closest('button')).toBeNull();
    // No current (all done): the stop is the first dot.
    const done = mount({ steps: [s('a', 'done'), s('b', 'done')] }, { interactive: '' });
    expect(hits(done).map((x) => x.getAttribute('tabindex'))).toEqual(['0', '-1']);
  });

  it('roving: ← / → move (wrapping), Home / End jump; the stop follows focus across renders', () => {
    const el = mount(DATA, { interactive: '' });
    hits(el)[2].focus();
    key(hits(el)[2], 'ArrowRight');
    expect(active(el)).toBe(hits(el)[3]);
    expect(hits(el).map((x) => x.getAttribute('tabindex'))).toEqual(['-1', '-1', '-1', '0', '-1']);
    key(hits(el)[3], 'End');
    expect(active(el)).toBe(hits(el)[4]);
    key(hits(el)[4], 'ArrowRight');
    expect(active(el)).toBe(hits(el)[0]);
    key(hits(el)[0], 'ArrowLeft');
    expect(active(el)).toBe(hits(el)[4]);
    key(hits(el)[4], 'Home');
    expect(active(el)).toBe(hits(el)[0]);
    key(hits(el)[0], 'ArrowRight');
    // A render from the host (same current) keeps the stop where focus is.
    el.data = { ...DATA, progress: 0.3 };
    el.renderNow();
    expect(active(el)).toBe(hits(el)[1]);
    expect(hits(el).map((x) => x.getAttribute('tabindex'))).toEqual(['-1', '0', '-1', '-1', '-1']);
    // Other keys pass through.
    expect(key(hits(el)[1], 'a')).toBe(true);
    expect(key(hits(el)[1], 'ArrowRight')).toBe(false);
  });

  it('a pick sends a cancelable ui-select { index, id } and changes nothing here', () => {
    const el = mount(DATA, { interactive: '' });
    const fired = vi.fn();
    el.addEventListener('ui-select', (e) => fired((e as CustomEvent).detail));
    hits(el)[1].click();
    expect(fired).toHaveBeenCalledWith({ index: 1, id: 'i2' });
    el.renderNow();
    expect(el.current).toBe(2);
    const noId = mount({ steps: [s('a'), s('b')] }, { interactive: '' });
    const got = vi.fn();
    noId.addEventListener('ui-select', (e) => got((e as CustomEvent).detail));
    hits(noId)[0].click();
    expect(got).toHaveBeenCalledWith({ index: 0, id: undefined });
    // Not interactive: no buttons, nothing to pick.
    expect(qa(mount(DATA), 'button')).toHaveLength(0);
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    spy = soundSpy();
  });
  afterEach(() => spy.restore());

  it('a pick that goes through plays a subtle select; a prevented one and data the host sets are silent', async () => {
    const el = mount({ steps: FIVE, current: 1, progress: 0.2 }, { interactive: '' });
    click(qa(el, '.st-hit')[3]);
    await spy.settle();
    expect(spy.calls).toEqual([['select', { emphasis: 'subtle', input: 'mouse' }]]);
    el.addEventListener('ui-select', (e) => e.preventDefault(), { once: true });
    click(qa(el, '.st-hit')[0], 0);
    el.data = { ...el.data!, current: 2, progress: 0.8 };
    el.renderNow();
    el.data = { ...el.data!, current: 5 };
    el.renderNow();
    await spy.settle();
    expect(spy.calls).toHaveLength(1);
  });
});

describe('styles', () => {
  it('slots ease on 520ms --ease-out, the wake staggers by --i, reduced motion stills the band, 44px on touch', () => {
    expect(styles).toContain('transition: width 520ms var(--ease-out)');
    expect(styles).toContain('.st-step[data-cur] .st-dot { width: var(--st-wide); }');
    expect(styles).toContain('animation: st-wake 420ms ease-in-out calc(var(--i, 0) * 60ms) both;');
    expect(styles).toContain('@keyframes st-wake { 50% { transform: scaleY(1.34); } }');
    expect(styles).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.st-band \{ animation: none !important;/);
    expect(styles).toContain('.st-dot[data-wake] { animation: none !important; }');
    expect(styles).toMatch(/@media \(pointer: coarse\) \{[^}]*\.st-list \{ gap: 0; \}/);
    expect(styles).toContain('min-width: 44px; min-height: 44px;');
    expect(styles).toContain(
      '.st-hit:focus-visible + .st-dot { outline: 2px solid var(--border-focus); outline-offset: 2px; }',
    );
    expect(styles).toContain('.st-step[data-st="failed"] .st-dot { background: var(--st-fail); }');
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});

describe('docs', () => {
  it('ships ≥ 3 demos that build without the network, in the Primitives group, crediting bencho.dev', () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('no network in demos');
    });
    vi.stubGlobal('fetch', fetchSpy);
    expect(doc.slug).toBe('step-track');
    expect(doc.tag).toBe('ui-step-track');
    expect(doc.group).toBe('Primitives');
    expect(doc.reference).toEqual({
      name: 'bencho.dev — Step player (MIT)',
      url: 'https://bencho.dev/blocks/step-player',
    });
    expect(doc.a11y.some((l) => l.startsWith('Sound (opt-in'))).toBe(true);
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) {
      const el = d.create();
      document.body.append(el);
      const tracks = el.matches('ui-step-track') ? [el] : Array.from(el.querySelectorAll('ui-step-track'));
      expect(tracks.length).toBeGreaterThan(0);
      for (const t of tracks) {
        (t as UiStepTrack).renderNow();
        expect(t.shadowRoot!.querySelector('.st-list')).not.toBeNull();
      }
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('the pipeline demo advances on its own and stops once it is gone', () => {
    vi.useFakeTimers();
    const box = doc.demos.find((d) => d.id === 'pipeline')!.create();
    document.body.append(box);
    const el = box.querySelector('ui-step-track') as UiStepTrack;
    el.renderNow();
    expect(el.current).toBe(2);
    vi.advanceTimersByTime(160 * 14);
    el.renderNow();
    expect(el.current).toBe(3);
    box.remove();
    vi.advanceTimersByTime(160);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('the goal-loop demo logs ui-select in its line', () => {
    const box = doc.demos.find((d) => d.id === 'goal-loop')!.create();
    document.body.append(box);
    const el = box.querySelector('ui-step-track') as UiStepTrack;
    el.renderNow();
    expect(el.getAttribute('size')).toBe('sm');
    expect(q(el, '.st-busy')).not.toBeNull();
    el.shadowRoot!.querySelectorAll<HTMLElement>('.st-hit')[2].click();
    expect(box.querySelector('.ui-status-line')!.textContent).toBe('ui-select → Iteration 3 (index 2, id iteration-3)');
  });
});
