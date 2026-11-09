import { afterEach, describe, expect, it } from 'vitest';
import { doc } from './docs';
import type { UiDotGrid } from './dot-grid';
import './dot-grid';
import {
  DOT_STATES,
  type DotGridData,
  type DotSelect,
  dotAria,
  dotColumns,
  dotCounts,
  dotLegend,
  dotMove,
  dotRows,
  dotSize,
  dotState,
  dotStrings,
  dotSummary,
  dotTip,
  dotWord,
  dotWrap,
} from './logic';
import { styles } from './styles';

const XSS = '<img src=x onerror=alert(1)>';

function mount(data?: DotGridData, attrs: Record<string, string> = {}): UiDotGrid {
  const el = document.createElement('ui-dot-grid');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  if (data) el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiDotGrid, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = (el: UiDotGrid, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const cells = (el: UiDotGrid) => qa(el, '.dg-cell');
const rowCells = (el: UiDotGrid, r: number) => qa(el, `.dg-cell[data-r="${r}"]`);
const focused = (el: UiDotGrid) => el.shadowRoot!.activeElement as HTMLElement | null;
const key = (t: HTMLElement, k: string, init: KeyboardEventInit = {}) => {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init });
  t.dispatchEvent(ev);
  return ev;
};
const tip = (el: UiDotGrid) => q(el, '.dg-tip')!;

const CRON: DotGridData = {
  label: 'Cron runs, last 5 days',
  rows: [
    {
      id: 'backup',
      label: 'Nightly backup',
      cells: ['done', 'done', { state: 'fail', label: 'Thu 6 Nov 02:00 — failed' }, 'done', 'pending'],
    },
    { id: 'digest', label: 'Digest mail', cells: ['done', 'skip', 'done', 'run', 'pending'] },
    { id: 'reindex', label: 'Search reindex', cells: ['done', 'done', 'wait', 'empty', 'pending'] },
  ],
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('helpers', () => {
  it('dotState: a state word or a { state } cell; junk is empty', () => {
    for (const s of DOT_STATES) expect(dotState(s)).toBe(s);
    expect(dotState({ state: 'fail', label: 'x' })).toBe('fail');
    expect(dotState(' DONE ')).toBe('done');
    expect(dotState('ok')).toBe('empty');
    expect(dotState('')).toBe('empty');
    expect(dotState(null)).toBe('empty');
    expect(dotState(3)).toBe('empty');
    expect(dotState({ state: 7 })).toBe('empty');
    expect(dotState({})).toBe('empty');
    expect(dotState(XSS)).toBe('empty');
  });

  it('dotSize and dotWrap read their attributes', () => {
    expect(dotSize('sm')).toBe('sm');
    expect(dotSize('lg')).toBe('lg');
    expect(dotSize('xl')).toBe('md');
    expect(dotSize(null)).toBe('md');
    expect(dotWrap('5')).toBe(5);
    expect(dotWrap(4.7)).toBe(4);
    expect(dotWrap('0')).toBe(0);
    expect(dotWrap('-2')).toBe(0);
    expect(dotWrap('x')).toBe(0);
    expect(dotWrap(null)).toBe(0);
  });

  it('dotRows: drops junk rows, keeps the first of each id, a label stands in for a missing id; cells normalised', () => {
    const rows = dotRows({
      rows: [
        null,
        'x',
        { id: 'a', label: 'A', cells: ['done', { state: 'fail', label: '  late  ' }, 'nope', 5] },
        { id: 'a', label: 'dup', cells: ['done'] },
        { label: 'Only label', cells: 'not an array' },
        { cells: ['done'] },
        { id: 7, label: 3, cells: [] },
      ],
    } as never);
    expect(rows.map((r) => r.id)).toEqual(['a', 'Only label', '7']);
    expect(rows[0].cells).toEqual([
      { state: 'done', label: '' },
      { state: 'fail', label: 'late' },
      { state: 'empty', label: '' },
      { state: 'empty', label: '' },
    ]);
    expect(rows[1].cells).toEqual([]);
    expect(rows[2].label).toBe('3');
    expect(dotRows(undefined)).toEqual([]);
    expect(dotRows({ rows: 'x' } as never)).toEqual([]);
    expect(dotColumns({ columns: ['Mon', null, '', 4, {}] } as never)).toEqual(['Mon', '', '', '4', '']);
    expect(dotColumns({})).toEqual([]);
  });

  it('dotCounts: per-state totals over every row', () => {
    const c = dotCounts(CRON.rows);
    expect(c).toEqual({ done: 7, fail: 1, run: 1, wait: 1, pending: 3, skip: 1, empty: 1, total: 15 });
    expect(dotCounts(null).total).toBe(0);
    expect(dotCounts([{ cells: ['junk', 'done'] }, null]).empty).toBe(1);
  });

  it('dotSummary: the present states in legend order, en and ko, your own words; nothing → none', () => {
    const c = dotCounts([{ cells: [...Array(12).fill('done'), 'fail', 'fail', 'pending'] }]);
    expect(dotSummary(c)).toBe('12 done · 2 failed · 1 to come');
    expect(dotSummary(c, 'ko')).toBe('완료 12 · 실패 2 · 예정 1');
    expect(dotSummary(c, 'en', { done: 'Taken', fail: 'Missed', pending: 'Later today' })).toBe(
      '12 taken · 2 missed · 1 later today',
    );
    expect(dotSummary({ done: 3 }, 'en', { done: 'CI green' })).toBe('3 CI green');
    expect(dotSummary({ done: 3 }, 'ko', { done: '통과' })).toBe('통과 3');
    expect(dotSummary(dotCounts([]))).toBe('No runs yet');
    expect(dotSummary(undefined, 'ko')).toBe('아직 기록이 없습니다');
    expect(dotSummary({ run: 1, wait: 2, skip: 1, empty: 4 })).toBe('1 running · 2 waiting · 1 skipped · 4 no run');
  });

  it('dotWord: your word when given, else the language’s', () => {
    expect(dotWord('fail')).toBe('Failed');
    expect(dotWord('fail', 'ko')).toBe('실패');
    expect(dotWord('fail', 'en', { fail: ' Missed ' })).toBe('Missed');
    expect(dotWord('fail', 'en', { fail: '  ' })).toBe('Failed');
    expect(dotWord('pending', 'en', { fail: 'x' })).toBe('To come');
  });

  it('dotLegend: only the present states; by default only when 2+; legend true / false win', () => {
    expect(dotLegend(CRON.rows)).toEqual(['done', 'fail', 'run', 'wait', 'pending', 'skip', 'empty']);
    expect(dotLegend([{ cells: ['done', 'pending', 'done'] }])).toEqual(['done', 'pending']);
    expect(dotLegend([{ cells: ['done', 'done'] }])).toEqual([]);
    expect(dotLegend([{ cells: ['done', 'done'] }], true)).toEqual(['done']);
    expect(dotLegend(CRON.rows, false)).toEqual([]);
  });

  it('dotMove: arrows in 2D stop at the edges; Home / End in the row, with Ctrl the grid', () => {
    const L = [5, 5, 5];
    expect(dotMove(L, { r: 0, c: 0 }, 'ArrowRight')).toEqual({ r: 0, c: 1 });
    expect(dotMove(L, { r: 0, c: 4 }, 'ArrowRight')).toEqual({ r: 0, c: 4 });
    expect(dotMove(L, { r: 0, c: 0 }, 'ArrowLeft')).toEqual({ r: 0, c: 0 });
    expect(dotMove(L, { r: 0, c: 2 }, 'ArrowDown')).toEqual({ r: 1, c: 2 });
    expect(dotMove(L, { r: 2, c: 2 }, 'ArrowDown')).toEqual({ r: 2, c: 2 });
    expect(dotMove(L, { r: 0, c: 3 }, 'ArrowUp')).toEqual({ r: 0, c: 3 });
    expect(dotMove(L, { r: 1, c: 3 }, 'Home')).toEqual({ r: 1, c: 0 });
    expect(dotMove(L, { r: 1, c: 1 }, 'End')).toEqual({ r: 1, c: 4 });
    expect(dotMove(L, { r: 1, c: 3 }, 'Home', { ctrl: true })).toEqual({ r: 0, c: 0 });
    expect(dotMove(L, { r: 1, c: 1 }, 'End', { ctrl: true })).toEqual({ r: 2, c: 4 });
    expect(dotMove(L, { r: 0, c: 1 }, 'ArrowRight', { rtl: true })).toEqual({ r: 0, c: 0 });
    expect(dotMove(L, { r: 0, c: 1 }, 'ArrowLeft', { rtl: true })).toEqual({ r: 0, c: 2 });
    expect(dotMove(L, { r: 0, c: 1 }, 'x')).toBeNull();
    expect(dotMove([], { r: 0, c: 0 }, 'ArrowDown')).toBeNull();
  });

  it('dotMove: rows share one width (28 under 14 lands on the same spot); empty rows are stepped over', () => {
    expect(dotMove([14, 28], { r: 0, c: 13 }, 'ArrowDown')).toEqual({ r: 1, c: 27 });
    expect(dotMove([14, 28], { r: 0, c: 0 }, 'ArrowDown')).toEqual({ r: 1, c: 1 });
    expect(dotMove([14, 28], { r: 1, c: 27 }, 'ArrowUp')).toEqual({ r: 0, c: 13 });
    expect(dotMove([14, 28], { r: 1, c: 10 }, 'ArrowUp')).toEqual({ r: 0, c: 5 });
    expect(dotMove([3, 0, 3], { r: 0, c: 1 }, 'ArrowDown')).toEqual({ r: 2, c: 1 });
    expect(dotMove([3, 0, 3], { r: 2, c: 1 }, 'ArrowUp')).toEqual({ r: 0, c: 1 });
    expect(dotMove([0, 3], { r: 0, c: 0 }, 'ArrowRight')).toEqual({ r: 1, c: 0 });
  });

  it('dotMove with wrap: Up / Down step a line inside the row before leaving it', () => {
    // 10 cells in lines of 4: [0-3] [4-7] [8-9]; then a row of 4.
    const L = [10, 4];
    expect(dotMove(L, { r: 0, c: 1 }, 'ArrowDown', { wrap: 4 })).toEqual({ r: 0, c: 5 });
    expect(dotMove(L, { r: 0, c: 7 }, 'ArrowDown', { wrap: 4 })).toEqual({ r: 0, c: 9 });
    expect(dotMove(L, { r: 0, c: 9 }, 'ArrowDown', { wrap: 4 })).toEqual({ r: 1, c: 1 });
    expect(dotMove(L, { r: 0, c: 5 }, 'ArrowUp', { wrap: 4 })).toEqual({ r: 0, c: 1 });
    expect(dotMove(L, { r: 1, c: 1 }, 'ArrowUp', { wrap: 4 })).toEqual({ r: 0, c: 9 });
    expect(dotMove(L, { r: 1, c: 3 }, 'ArrowUp', { wrap: 4 })).toEqual({ r: 0, c: 9 });
    expect(dotMove(L, { r: 0, c: 0 }, 'ArrowUp', { wrap: 4 })).toEqual({ r: 0, c: 0 });
  });

  it('dotAria / dotTip: the row, the cell’s words (state word added when missing), else column or place', () => {
    const s = dotStrings('en');
    expect(dotAria('Backup', { state: 'fail', label: 'Thu 02:00 — failed' }, 2, 5, '', 'Failed', s)).toBe(
      'Backup, Thu 02:00 — failed',
    );
    expect(dotAria('Backup', { state: 'fail', label: 'Thu 02:00' }, 2, 5, 'Thu', 'Failed', s)).toBe(
      'Backup, Thu 02:00: Failed',
    );
    expect(dotAria('Backup', { state: 'done', label: '' }, 2, 5, 'Thu', 'Done', s)).toBe('Backup, Thu: Done');
    expect(dotAria('Backup', { state: 'done', label: '' }, 2, 5, '', 'Done', s)).toBe('Backup, 3 of 5: Done');
    expect(dotAria('', { state: 'done', label: '' }, 0, 1, '', '완료', dotStrings('ko'))).toBe('1개 중 1번째: 완료');
    expect(dotTip({ state: 'fail', label: 'late' }, 'Thu', 'Failed')).toBe('late');
    expect(dotTip({ state: 'fail', label: '' }, 'Thu', 'Failed')).toBe('Thu · Failed');
    expect(dotTip({ state: 'fail', label: '' }, '', 'Failed')).toBe('Failed');
  });
});

describe('<ui-dot-grid> rendering', () => {
  it('draws a grid: a row per item with its rowheader, a gridcell per run, the state on each cell', () => {
    const el = mount(CRON);
    const grid = q(el, '[role="grid"]')!;
    expect(grid.getAttribute('aria-label')).toBe('Cron runs, last 5 days');
    expect(grid.getAttribute('aria-describedby')).toBe('dg-sum');
    const rows = qa(el, '[role="row"]');
    expect(rows).toHaveLength(3);
    expect(qa(el, '[role="rowheader"]').map((h) => h.textContent)).toEqual([
      'Nightly backup',
      'Digest mail',
      'Search reindex',
    ]);
    expect(cells(el)).toHaveLength(15);
    expect(rowCells(el, 0).map((c) => c.dataset.state)).toEqual(['done', 'done', 'fail', 'done', 'pending']);
    expect(rowCells(el, 1).map((c) => c.dataset.state)).toEqual(['done', 'skip', 'done', 'run', 'pending']);
    expect(rowCells(el, 2).map((c) => c.dataset.state)).toEqual(['done', 'done', 'wait', 'empty', 'pending']);
    for (const c of cells(el)) {
      expect(c.getAttribute('role')).toBe('gridcell');
      expect(c.classList.contains('dg-mark')).toBe(true);
    }
    expect(q(el, '.dg')!.dataset.size).toBe('md');
    expect(el.size).toBe('md');
    // The cells share the row width: as many columns as cells, capped by the densest row.
    expect(q(el, '.dg-row .dg-cells')!.getAttribute('style')).toContain('--dg-cols:5');
    expect(q(el, '.dg')!.getAttribute('style')).toContain('--dg-cols-max:5');
  });

  it('every state paints from a token; junk states become empty', () => {
    const el = mount({
      // Junk on purpose (a host's untyped JSON): the cells are cast past the type.
      rows: [{ id: 'x', label: 'X', cells: ['done', 'bogus', { state: 'nope' }, null, 'FAIL'] as never }],
    });
    expect(rowCells(el, 0).map((c) => c.dataset.state)).toEqual(['done', 'empty', 'empty', 'empty', 'fail']);
    for (const s of DOT_STATES) expect(styles).toContain(`.dg-mark[data-state="${s}"]`);
    expect(styles).toContain('var(--st-fail)');
    expect(styles).toContain('var(--st-wait)');
    expect(styles).toContain('var(--st-run)');
    expect(styles).toContain('repeating-linear-gradient');
    expect(styles).toMatch(/dg-pulse/);
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(styles).not.toMatch(/rgba?\(/i);
    expect(styles).toContain('@container dg (max-width: 479px)');
  });

  it('labels each cell: row + cell label, or row + column / place + state word', () => {
    const el = mount({ ...CRON, columns: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] });
    const r0 = rowCells(el, 0);
    expect(r0[2].getAttribute('aria-label')).toBe('Nightly backup, Thu 6 Nov 02:00 — failed');
    expect(r0[0].getAttribute('aria-label')).toBe('Nightly backup, Mon: Done');
    expect(r0[4].getAttribute('aria-label')).toBe('Nightly backup, Fri: To come');
    const bare = mount({ rows: [{ id: 'a', label: 'Deploy', cells: ['done', 'skip'] }] });
    expect(rowCells(bare, 0)[1].getAttribute('aria-label')).toBe('Deploy, 2 of 2: Skipped');
  });

  it('draws the sparse column headers over the cells, hidden from readers (the cells carry them)', () => {
    const el = mount({ ...CRON, columns: ['3 Nov', '', null, '6 Nov', ''] });
    const head = q(el, '.dg-head')!;
    expect(head.getAttribute('aria-hidden')).toBe('true');
    expect(qa(el, '.dg-col').map((c) => c.textContent)).toEqual(['3 Nov', '', '', '6 Nov', '']);
    expect(mount(CRON).shadowRoot!.querySelector('.dg-head')).toBeNull();
    expect(mount({ ...CRON, columns: ['', ''] }).shadowRoot!.querySelector('.dg-head')).toBeNull();
  });

  it('the legend lists only the states present, in order, by default only when 2+', () => {
    const el = mount({ rows: [{ id: 'a', label: 'A', cells: ['done', 'pending', 'fail', 'done'] }] });
    const legend = q(el, '.dg-legend')!;
    expect(legend.getAttribute('aria-hidden')).toBe('true');
    expect(qa(el, '.dg-legend li').map((l) => l.textContent)).toEqual(['Done', 'Failed', 'To come']);
    expect(qa(el, '.dg-legend .dg-sw').map((s) => s.dataset.state)).toEqual(['done', 'fail', 'pending']);
    expect(
      mount({ rows: [{ id: 'a', label: 'A', cells: ['done', 'done'] }] }).shadowRoot!.querySelector('.dg-legend'),
    ).toBeNull();
    expect(
      mount({ legend: true, rows: [{ id: 'a', label: 'A', cells: ['done'] }] }).shadowRoot!.querySelectorAll(
        '.dg-legend li',
      ),
    ).toHaveLength(1);
    expect(mount({ ...CRON, legend: false }).shadowRoot!.querySelector('.dg-legend')).toBeNull();
  });

  it('custom state words reach the legend, the labels and the summary', () => {
    const el = mount({
      summary: true,
      states: { done: 'Taken', fail: 'Missed', pending: 'Later today' },
      rows: [{ id: 'iron', label: 'Iron', cells: ['done', 'fail', 'pending'] }],
    });
    expect(qa(el, '.dg-legend li').map((l) => l.textContent)).toEqual(['Taken', 'Missed', 'Later today']);
    expect(rowCells(el, 0)[1].getAttribute('aria-label')).toBe('Iron, 2 of 3: Missed');
    expect(q(el, '.dg-sum')!.textContent).toBe('1 taken · 1 missed · 1 later today');
  });

  it('the summary is the grid’s description: read-only by default, shown with summary: true', () => {
    const el = mount(CRON);
    const sum = q(el, '#dg-sum')!;
    expect(sum.classList.contains('sr-only')).toBe(true);
    expect(sum.textContent).toBe('7 done · 1 failed · 1 running · 1 waiting · 3 to come · 1 skipped · 1 no run');
    const shown = mount({ ...CRON, summary: true });
    expect(q(shown, '#dg-sum')!.classList.contains('sr-only')).toBe(false);
    expect(q(shown, '.dg-foot #dg-sum')).not.toBeNull();
  });

  it('no rows: the empty words (yours or the default), no grid', () => {
    const el = mount({ rows: [] });
    expect(q(el, '[role="grid"]')).toBeNull();
    expect(q(el, '.dg-empty')!.textContent).toBe('No runs yet');
    expect(q(mount({ rows: [], empty: 'No cron jobs' }), '.dg-empty')!.textContent).toBe('No cron jobs');
    expect(q(mount(undefined), '.dg-empty')!.textContent).toBe('No runs yet');
  });

  it('size sm / lg and wrap: the size on the root, lg stacks the label, wrap sets the line length', () => {
    expect(q(mount(CRON, { size: 'sm' }), '.dg')!.dataset.size).toBe('sm');
    expect(q(mount(CRON, { size: 'sm' }), '.dg')!.hasAttribute('data-stack')).toBe(false);
    const tally: DotGridData = {
      label: 'Review rounds',
      rows: [{ id: 'rounds', label: 'Review rounds', cells: [...Array(4).fill('done'), ...Array(6).fill('pending')] }],
    };
    const el = mount(tally, { size: 'lg', wrap: '5' });
    const root = q(el, '.dg')!;
    expect(root.dataset.size).toBe('lg');
    expect(root.hasAttribute('data-stack')).toBe(true);
    expect(root.dataset.wrap).toBe('5');
    expect(root.getAttribute('style')).toContain('--dg-cols-max:5');
    expect(q(el, '.dg-row .dg-cells')!.getAttribute('style')).toContain('--dg-cols:5');
    expect(cells(el)).toHaveLength(10);
    // Wrap draws no column header (lines of tiles have no shared columns).
    el.data = { ...tally, columns: ['a', 'b'] };
    el.renderNow();
    expect(q(el, '.dg-head')).toBeNull();
    // Keyboard steps a line inside the row.
    const first = cells(el)[1];
    first.focus();
    key(first, 'ArrowDown');
    expect(focused(el)?.dataset.c).toBe('6');
    // Without wrap, lg still stacks.
    expect(q(mount(tally, { size: 'lg' }), '.dg')!.hasAttribute('data-stack')).toBe(true);
    expect(q(mount(tally, { size: 'lg' }), '.dg')!.hasAttribute('data-wrap')).toBe(false);
  });
});

describe('<ui-dot-grid> keyboard, tooltip and ui-select', () => {
  it('is one tab stop: the first cell, and the stop follows focus', () => {
    const el = mount(CRON);
    const stops = cells(el).filter((c) => c.getAttribute('tabindex') === '0');
    expect(stops).toHaveLength(1);
    expect(stops[0].dataset.key).toBe('0@backup');
    const c = rowCells(el, 1)[2];
    c.focus();
    expect(cells(el).filter((x) => x.getAttribute('tabindex') === '0')).toEqual([c]);
    // A new render keeps the stop on the same row id and index.
    el.data = { ...CRON };
    el.renderNow();
    expect(cells(el).filter((x) => x.getAttribute('tabindex') === '0')[0].dataset.key).toBe('2@digest');
  });

  it('arrows move in 2D and stop at the edges; Home / End and Ctrl+Home / End', () => {
    const el = mount(CRON);
    const start = cells(el)[0];
    start.focus();
    const at = () => [Number(focused(el)?.dataset.r), Number(focused(el)?.dataset.c)];
    expect(key(focused(el)!, 'ArrowLeft').defaultPrevented).toBe(true);
    expect(at()).toEqual([0, 0]);
    key(focused(el)!, 'ArrowUp');
    expect(at()).toEqual([0, 0]);
    key(focused(el)!, 'ArrowRight');
    key(focused(el)!, 'ArrowRight');
    expect(at()).toEqual([0, 2]);
    key(focused(el)!, 'ArrowDown');
    expect(at()).toEqual([1, 2]);
    key(focused(el)!, 'ArrowDown');
    key(focused(el)!, 'ArrowDown');
    expect(at()).toEqual([2, 2]);
    key(focused(el)!, 'End');
    expect(at()).toEqual([2, 4]);
    key(focused(el)!, 'ArrowRight');
    expect(at()).toEqual([2, 4]);
    key(focused(el)!, 'Home');
    expect(at()).toEqual([2, 0]);
    key(focused(el)!, 'End', { ctrlKey: true });
    expect(at()).toEqual([2, 4]);
    key(focused(el)!, 'Home', { ctrlKey: true });
    expect(at()).toEqual([0, 0]);
    expect(cells(el).filter((x) => x.getAttribute('tabindex') === '0')).toEqual([focused(el)]);
    // Keys the grid does not use pass through.
    expect(key(focused(el)!, 'a').defaultPrevented).toBe(false);
    expect(key(focused(el)!, 'Tab').defaultPrevented).toBe(false);
  });

  it('Enter, Space and a click send a cancelable, composed ui-select { rowId, index, state }', () => {
    const el = mount(CRON);
    const got: Array<CustomEvent<DotSelect>> = [];
    el.addEventListener('ui-select', (e) => got.push(e as CustomEvent<DotSelect>));
    const fail = rowCells(el, 0)[2];
    fail.focus();
    expect(key(fail, 'Enter').defaultPrevented).toBe(true);
    key(fail, ' ');
    rowCells(el, 1)[3].click();
    expect(got.map((e) => e.detail)).toEqual([
      { rowId: 'backup', index: 2, state: 'fail' },
      { rowId: 'backup', index: 2, state: 'fail' },
      { rowId: 'digest', index: 3, state: 'run' },
    ]);
    expect(got.every((e) => e.bubbles && e.composed && e.cancelable)).toBe(true);
    // A listener may cancel it; the grid holds no selection, so nothing changes either way.
    const before = q(el, '.dg')!.outerHTML;
    el.addEventListener('ui-select', (e) => e.preventDefault(), { once: true });
    rowCells(el, 2)[0].click();
    expect(q(el, '.dg')!.outerHTML).toBe(before);
  });

  it('a hover or focus bubble shows the row and the cell’s words; Escape and leaving close it', () => {
    const el = mount({ ...CRON, columns: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] });
    const t = tip(el);
    expect(t.getAttribute('aria-hidden')).toBe('true');
    expect(t.classList.contains('is-open')).toBe(false);
    const fail = rowCells(el, 0)[2];
    fail.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, composed: true }));
    expect(t.classList.contains('is-open')).toBe(true);
    expect(t.querySelector('.dg-tip-h')!.textContent).toBe('Nightly backup');
    expect(t.querySelector('.dg-tip-t')!.textContent).toBe('Thu 6 Nov 02:00 — failed');
    expect(t.querySelector<HTMLElement>('.dg-sw')!.dataset.state).toBe('fail');
    el.dispatchEvent(new PointerEvent('pointerleave'));
    expect(t.classList.contains('is-open')).toBe(false);
    const done = rowCells(el, 1)[0];
    done.focus();
    expect(t.classList.contains('is-open')).toBe(true);
    expect(t.querySelector('.dg-tip-t')!.textContent).toBe('Mon · Done');
    const esc = key(done, 'Escape');
    expect(t.classList.contains('is-open')).toBe(false);
    expect(esc.defaultPrevented).toBe(false);
    key(done, 'ArrowRight');
    expect(t.querySelector('.dg-tip-t')!.textContent).toBe('Tue · Skipped');
  });

  it('focus survives a re-render (the cell keeps its key) and a state change patches the node in place', () => {
    const el = mount(CRON);
    const run = rowCells(el, 1)[3];
    run.focus();
    const rows = CRON.rows.map((r) => ({ ...r, cells: [...r.cells] }));
    rows[1].cells[3] = 'done';
    el.data = { ...CRON, rows };
    el.renderNow();
    expect(rowCells(el, 1)[3]).toBe(run);
    expect(run.dataset.state).toBe('done');
    expect(focused(el)).toBe(run);
    // The focused row goes away: focus moves to the tab stop instead of leaving the grid.
    el.data = { ...CRON, rows: [rows[0], rows[2]] };
    el.renderNow();
    expect(focused(el)?.getAttribute('tabindex')).toBe('0');
  });
});

describe('<ui-dot-grid> escaping and Korean', () => {
  it('escapes every label, column, state word, cell label and the empty words', () => {
    const el = mount({
      label: XSS,
      columns: [XSS, XSS],
      summary: true,
      states: { done: XSS, fail: XSS },
      rows: [
        { id: XSS, label: XSS, cells: [{ state: 'done', label: XSS }, 'fail'] },
        { id: 'b', label: 'B', cells: ['done', XSS as never] },
      ],
    });
    const root = el.shadowRoot!;
    expect(root.querySelector('img')).toBeNull();
    expect(q(el, '[role="grid"]')!.getAttribute('aria-label')).toBe(XSS);
    expect(q(el, '[role="rowheader"]')!.textContent).toBe(XSS);
    expect(q(el, '.dg-col')!.textContent).toBe(XSS);
    expect(q(el, '.dg-legend li')!.textContent).toBe(XSS);
    expect(q(el, '.dg-sum')!.textContent).toContain(XSS);
    expect(cells(el)[0].getAttribute('aria-label')).toBe(`${XSS}, ${XSS}`);
    expect(cells(el)[3].dataset.state).toBe('empty');
    cells(el)[0].focus();
    expect(tip(el).querySelector('img')).toBeNull();
    expect(tip(el).querySelector('.dg-tip-h')!.textContent).toBe(XSS);
    expect(tip(el).querySelector('.dg-tip-t')!.textContent).toBe(XSS);
    const got: DotSelect[] = [];
    el.addEventListener('ui-select', (e) => got.push((e as CustomEvent<DotSelect>).detail));
    cells(el)[1].click();
    expect(got[0].rowId).toBe(XSS);
    expect(mount({ rows: [], empty: XSS }).shadowRoot!.querySelector('img')).toBeNull();
  });

  it('lang="ko": the legend, the labels, the summary and the default name in Korean', () => {
    const el = mount({ rows: CRON.rows }, { lang: 'ko' });
    expect(q(el, '[role="grid"]')!.getAttribute('aria-label')).toBe('실행 기록');
    expect(qa(el, '.dg-legend li').map((l) => l.textContent)).toEqual([
      '완료',
      '실패',
      '실행 중',
      '대기',
      '예정',
      '건너뜀',
      '기록 없음',
    ]);
    expect(q(el, '#dg-sum')!.textContent).toBe(
      '완료 7 · 실패 1 · 실행 중 1 · 대기 1 · 예정 3 · 건너뜀 1 · 기록 없음 1',
    );
    expect(rowCells(el, 1)[1].getAttribute('aria-label')).toBe('Digest mail, 5개 중 2번째: 건너뜀');
    expect(q(mount({ rows: [] }, { lang: 'ko' }), '.dg-empty')!.textContent).toBe('아직 기록이 없습니다');
    el.setAttribute('lang', 'en');
    el.renderNow();
    expect(q(el, '.dg-legend li')!.textContent).toBe('Done');
  });
});

describe('docs', () => {
  it('ships three or more demos that build, a Halvi reference and the Components group', () => {
    expect(doc.tag).toBe('ui-dot-grid');
    expect(doc.group).toBe('Components');
    expect(doc.reference.url).toBe('https://demo.codeandchill.store/halvi/');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) {
      const node = d.create();
      document.body.append(node);
      expect(node).toBeInstanceOf(HTMLElement);
    }
    expect(doc.demos.map((d) => d.id)).toEqual(expect.arrayContaining(['cron', 'ci', 'tally', 'compact']));
  });
});
