import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatToolClock,
  formatToolMs,
  groupStats,
  highlightJson,
  lineCount,
  type ToolCallData,
  type ToolCallGroupData,
  toCodeText,
  toolIcon,
} from './logic';
import { STRINGS } from './strings';
import type { UiToolCallCard } from './tool-call-card';
import './tool-call-card';
import { callKeys, type UiToolCallGroup } from './tool-call-group';

const XSS = '<img src=x onerror=alert(1)>';

function mount(data: ToolCallData, attrs: Record<string, string> = {}): UiToolCallCard {
  const el = document.createElement('ui-tool-call-card');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
function mountGroup(data: ToolCallGroupData, attrs: Record<string, string> = {}): UiToolCallGroup {
  const el = document.createElement('ui-tool-call-group');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = (el: HTMLElement, s: string) => el.shadowRoot!.querySelector<HTMLElement>(s);
const qa = (el: HTMLElement, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const click = (el: HTMLElement, s: string) => q(el, s)!.click();
const set = (el: UiToolCallCard, patch: Partial<ToolCallData>) => {
  el.data = { ...el.data!, ...patch };
  el.renderNow();
};
const live = (el: HTMLElement) => q(el, '[role="status"]')?.textContent ?? '';
const flush = () => new Promise((r) => setTimeout(r, 0));

const READ: ToolCallData = {
  name: 'Read',
  summary: 'src/app.ts (lines 1-80)',
  status: 'success',
  duration: 412,
  args: { file_path: 'src/app.ts', limit: 80 },
  result: 'export const x = 1;',
};

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('formatToolMs', () => {
  it('shows tenths below a minute, ms for a short final value, then m ss and h mm', () => {
    expect(formatToolMs(400, true)).toBe('0.4s');
    expect(formatToolMs(12_345, true)).toBe('12.3s');
    expect(formatToolMs(12_399)).toBe('12.3s');
    expect(formatToolMs(350)).toBe('350ms');
    expect(formatToolMs(0)).toBe('1ms');
    expect(formatToolMs(0, true)).toBe('0.0s');
    expect(formatToolMs(125_000)).toBe('2m 05s');
    expect(formatToolMs(3_725_000)).toBe('1h 02m');
    expect(formatToolMs(-5, true)).toBe('0.0s');
    expect(formatToolMs(Number.NaN)).toBe('1ms');
  });
});

describe('formatToolClock', () => {
  it('prints HH:MM:SS (24h) and nothing for a missing time', () => {
    const at = new Date(2026, 9, 27, 17, 5, 9).getTime();
    expect(formatToolClock(at, 'en')).toBe('17:05:09');
    expect(formatToolClock(at, 'ko')).toBe('17:05:09');
    expect(formatToolClock(new Date(2026, 9, 27, 0, 0, 1).getTime())).toBe('00:00:01');
    expect(formatToolClock(undefined)).toBe('');
    expect(formatToolClock(Number.NaN)).toBe('');
    // Finite but outside the Date range (review R1): no time rather than "Invalid Date".
    expect(formatToolClock(8.64e15 + 1)).toBe('');
  });
});

describe('toCodeText', () => {
  it('pretty-prints objects, parses JSON strings and keeps other text as written', () => {
    expect(toCodeText({ a: 1 })).toEqual({ text: '{\n  "a": 1\n}', json: true });
    expect(toCodeText('  {"a":[1,true]}')).toEqual({ text: '{\n  "a": [\n    1,\n    true\n  ]\n}', json: true });
    expect(toCodeText('{not json')).toEqual({ text: '{not json', json: false });
    expect(toCodeText('plain output\nline 2')).toEqual({ text: 'plain output\nline 2', json: false });
    expect(toCodeText(42)).toEqual({ text: '42', json: true });
    expect(toCodeText(null)).toEqual({ text: 'null', json: true });
    expect(toCodeText(undefined)).toEqual({ text: '', json: false });
  });
  it('falls back to String() for values JSON cannot write', () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(toCodeText(loop)).toEqual({ text: '[object Object]', json: false });
    expect(toCodeText(10n)).toEqual({ text: '10', json: false });
    expect(toCodeText(() => 1).json).toBe(false);
  });
});

describe('highlightJson', () => {
  it('marks keys, strings, numbers and literals', () => {
    const html = highlightJson('{\n  "a": "b",\n  "n": -1.5e3,\n  "t": true,\n  "z": null\n}');
    expect(html).toContain('<span class="tc-k">"a"</span>:');
    expect(html).toContain('<span class="tc-s">"b"</span>');
    expect(html).toContain('<span class="tc-n">-1.5e3</span>');
    expect(html).toContain('<span class="tc-l">true</span>');
    expect(html).toContain('<span class="tc-l">null</span>');
  });
  it('escapes every token and every gap', () => {
    const text = JSON.stringify({ [XSS]: XSS, '</span><b>': ['&amp;', 1] }, null, 2);
    const html = highlightJson(text);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&amp;amp;');
    const box = document.createElement('div');
    box.innerHTML = html;
    expect(box.querySelector('img, b')).toBeNull();
    expect(box.textContent).toBe(text);
    expect(highlightJson('<script>1</script>')).toBe('&lt;script&gt;<span class="tc-n">1</span>&lt;/script&gt;');
  });
  it('keeps escaped quotes inside a string', () => {
    const html = highlightJson('{"q": "say \\"hi\\""}');
    expect(html).toContain('<span class="tc-s">"say \\"hi\\""</span>');
  });
});

describe('toolIcon / groupStats / lineCount', () => {
  it('maps tool names to tile icons', () => {
    expect(toolIcon('Read')).toBe('file');
    expect(toolIcon('Write')).toBe('file');
    expect(toolIcon('Edit')).toBe('edit');
    expect(toolIcon('Bash')).toBe('terminal');
    expect(toolIcon('Grep')).toBe('search');
    expect(toolIcon('Glob')).toBe('search');
    expect(toolIcon('WebSearch')).toBe('search');
    expect(toolIcon('WebFetch')).toBe('globe');
    expect(toolIcon('Agent')).toBe('agent');
    expect(toolIcon('Task')).toBe('agent');
    expect(toolIcon('TodoWrite')).toBe('list');
    expect(toolIcon('mcp__github__get_issue')).toBe('plug');
    expect(toolIcon('search_web')).toBe('wrench');
    expect(toolIcon('constructor')).toBe('wrench');
  });
  it('counts running and failed (interrupted is neither) and sums durations only when all have one', () => {
    const calls: ToolCallData[] = [
      { name: 'A', status: 'success', duration: 100 },
      { name: 'B', status: 'error', duration: 50 },
      { name: 'C', status: 'interrupted', duration: 10 },
    ];
    expect(groupStats(calls)).toEqual({ running: false, failed: 1, sum: 160 });
    expect(groupStats([...calls, { name: 'D', status: 'running' }])).toEqual({
      running: true,
      failed: 1,
      sum: undefined,
    });
    expect(groupStats([])).toEqual({ running: false, failed: 0, sum: undefined });
    expect(lineCount('a\nb\nc')).toBe(3);
  });
});

describe('<ui-tool-call-card>', () => {
  it('renders the header line: icon tile, mono name, summary with title, check and duration', () => {
    const el = mount(READ);
    expect(q(el, '.tc')?.dataset.status).toBe('success');
    expect(q(el, '.tc-name')?.textContent).toBe('Read');
    expect(q(el, '.tc-name')?.tagName).toBe('CODE');
    expect(q(el, '.tc-summary')?.getAttribute('title')).toBe('src/app.ts (lines 1-80)');
    expect(q(el, '.tc-icon svg')).not.toBeNull();
    expect(q(el, '.tc-ok')).not.toBeNull();
    expect(q(el, '.tc-time')?.textContent).toBe('412ms');
    expect(q(el, '.tc-status .sr-only')?.textContent).toBe('Finished, ');
    const head = q(el, '.tc-head')!;
    expect(head.tagName).toBe('BUTTON');
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(q(el, '.tc-body')?.hasAttribute('inert')).toBe(true);
    // A closed card keeps no body markup.
    expect(q(el, '.tc-sections')).toBeNull();
  });

  it('escapes name, summary, error, args, result, note and detailError', () => {
    const el = mount({
      name: XSS,
      summary: XSS,
      status: 'error',
      error: XSS,
      args: { [XSS]: XSS },
      result: XSS,
      note: XSS,
      detailError: XSS,
      defaultOpen: true,
    });
    expect(qa(el, 'img')).toHaveLength(0);
    expect(q(el, '.tc-name')?.textContent).toBe(XSS);
    expect(q(el, '.tc-summary')?.textContent).toBe(XSS);
    expect(q(el, '.tc-summary')?.getAttribute('title')).toBe(XSS);
    expect(q(el, '.tc-error-text')?.textContent).toBe(XSS);
    expect(q(el, '.tc-code[data-part="args"]')?.textContent).toContain(XSS);
    expect(q(el, '.tc-code[data-part="result"]')?.textContent).toBe(XSS);
    expect(q(el, '.tc-note')?.textContent).toBe(XSS);
    expect(q(el, '.tc-reload-row .tc-pending')?.textContent).toBe(XSS);
    expect(q(el, '.tc-name')?.innerHTML).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('opens on header press: ui-toggle {open}, aria-expanded, body no longer inert', () => {
    const el = mount({ ...READ, id: 'toolu_1' });
    const seen: unknown[] = [];
    el.addEventListener('ui-toggle', (e) => seen.push((e as CustomEvent).detail));
    click(el, '.tc-head');
    expect(seen).toEqual([{ open: true, id: 'toolu_1' }]);
    expect(el.isOpen).toBe(true);
    expect(q(el, '.tc-head')?.getAttribute('aria-expanded')).toBe('true');
    expect(q(el, '.tc')?.hasAttribute('data-open')).toBe(true);
    expect(q(el, '.tc-body')?.hasAttribute('inert')).toBe(false);
    expect(q(el, '.tc-body')?.hasAttribute('data-open')).toBe(true);
    expect(qa(el, '.tc-label').map((l) => l.textContent)).toEqual(['Arguments', 'Result']);
    expect(q(el, '.tc-code[data-part="args"]')?.hasAttribute('data-json')).toBe(true);
    expect(q(el, '.tc-k')?.textContent).toBe('"file_path"');
    click(el, '.tc-head');
    expect(seen.at(-1)).toEqual({ open: false, id: 'toolu_1' });
    expect(q(el, '.tc-body')?.hasAttribute('inert')).toBe(true);
  });

  it('a cancelled ui-toggle keeps the card as it is', () => {
    const el = mount(READ);
    el.addEventListener('ui-toggle', (e) => e.preventDefault());
    click(el, '.tc-head');
    expect(el.isOpen).toBe(false);
    expect(q(el, '.tc-head')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('controlled open: the press only asks, data.open decides', () => {
    const el = mount({ ...READ, open: false });
    const seen: boolean[] = [];
    el.addEventListener('ui-toggle', (e) => seen.push((e as CustomEvent).detail.open));
    click(el, '.tc-head');
    expect(seen).toEqual([true]);
    expect(q(el, '.tc-body')?.hasAttribute('inert')).toBe(true);
    set(el, { open: true });
    expect(q(el, '.tc-body')?.hasAttribute('inert')).toBe(false);
    expect(q(el, '.tc-head')?.getAttribute('aria-expanded')).toBe('true');
    click(el, '.tc-head');
    expect(seen).toEqual([true, false]);
    expect(el.isOpen).toBe(true);
  });

  it('defaultOpen opens the first render only', () => {
    const el = mount({ ...READ, defaultOpen: true });
    expect(el.isOpen).toBe(true);
    click(el, '.tc-head');
    set(el, { summary: 'changed' });
    expect(el.isOpen).toBe(false);
  });

  it('openOnError: opens when the call turns to error, closes on the next run, not after a hand toggle', () => {
    const el = mount({ name: 'WebFetch', status: 'running', args: { url: 'https://a.dev' } });
    set(el, { status: 'error', error: 'timed out' });
    expect(el.isOpen).toBe(true);
    expect(q(el, '.tc-error-text')?.textContent).toBe('timed out');
    set(el, { status: 'running', error: undefined });
    expect(el.isOpen).toBe(false);
    set(el, { status: 'error' });
    expect(el.isOpen).toBe(true);
    click(el, '.tc-head'); // closed by hand
    click(el, '.tc-head'); // and opened by hand: now it stays open
    set(el, { status: 'running' });
    expect(el.isOpen).toBe(true);
  });

  it('openOnError: a card that first appears failed stays closed; false turns it off; controlled is left alone', () => {
    expect(mount({ name: 'Bash', status: 'error' }).isOpen).toBe(false);
    const off = mount({ name: 'Bash', status: 'running', openOnError: false });
    set(off, { status: 'error' });
    expect(off.isOpen).toBe(false);
    const ctl = mount({ name: 'Bash', status: 'running', open: false });
    set(ctl, { status: 'error' });
    expect(ctl.isOpen).toBe(false);
  });

  it('error box: message (default text without one) and Retry → ui-retry {id}', () => {
    const el = mount({ name: 'Bash', status: 'error', defaultOpen: true, id: 'b1' });
    expect(q(el, '.tc-error-text')?.textContent).toBe('The tool call failed.');
    expect(q(el, '[data-act="retry"]')).toBeNull();
    expect(q(el, '.tc-time')?.textContent).toBe('Failed');
    set(el, { canRetry: true });
    const retry = vi.fn();
    el.addEventListener('ui-retry', (e) => retry((e as CustomEvent).detail));
    click(el, '[data-act="retry"]');
    expect(retry).toHaveBeenCalledWith({ id: 'b1' });
  });

  it('loading and detailError: a quiet line, then a message with Try again → ui-reload', () => {
    const el = mount({ name: 'Read', status: 'success', args: { a: 1 }, defaultOpen: true, loading: true });
    expect(q(el, '.tc-loading')?.textContent).toBe('Loading…');
    expect(q(el, '.tc-section[data-part="result"]')).toBeNull();
    set(el, { loading: false, detailError: 'Couldn’t load the output' });
    expect(q(el, '.tc-loading')).toBeNull();
    expect(q(el, '.tc-reload-row .tc-pending')?.textContent).toBe('Couldn’t load the output');
    const reload = vi.fn();
    el.addEventListener('ui-reload', (e) => reload((e as CustomEvent).detail));
    click(el, '[data-act="reload"]');
    expect(reload).toHaveBeenCalledWith({});
  });

  it('states: waiting while running, nothing when done without data, a note line', () => {
    const run = mount({ name: 'Bash', status: 'running', args: 'ls -la', defaultOpen: true });
    expect(q(run, '.tc-section .tc-pending')?.textContent).toBe('Waiting for result…');
    expect(q(run, '.tc-code[data-part="args"]')?.hasAttribute('data-json')).toBe(false);
    const none = mount({
      name: 'TodoWrite',
      status: 'success',
      defaultOpen: true,
      note: 'Showing the first 256 KiB of 1.2 MB',
    });
    expect(q(none, '.tc-pending')?.textContent).toBe('No arguments or result.');
    expect(q(none, '.tc-note')?.textContent).toBe('Showing the first 256 KiB of 1.2 MB');
  });

  it('interrupted: neutral “No result”, no timer, one muted line plus the arguments, duration only when given', () => {
    const el = mount({
      name: 'Task',
      status: 'running',
      startedAt: Date.now() - 3000,
      args: { a: 1 },
      defaultOpen: true,
    });
    set(el, { status: 'interrupted' });
    expect(q(el, '.tc')?.dataset.status).toBe('interrupted');
    expect(q(el, '.tc-stop')).not.toBeNull();
    expect(q(el, '.tc-spin')).toBeNull();
    expect(q(el, '.tc-time')?.textContent).toBe('No result');
    expect(q(el, '.tc-sections > .tc-pending')?.textContent).toBe('The run ended before this call returned.');
    expect(q(el, '.tc-section[data-part="args"]')).not.toBeNull();
    expect(q(el, '.tc-error')).toBeNull();
    expect(live(el)).toBe('Task ended without a result');
    set(el, { duration: 2500 });
    expect(q(el, '.tc-time')?.textContent).toBe('No result · 2.5s');
    // openOnError does not apply
    const closed = mount({ name: 'Task', status: 'running' });
    set(closed, { status: 'interrupted' });
    expect(closed.isOpen).toBe(false);
  });

  it('shows the start clock at the top right of the body', () => {
    const at = new Date(2026, 9, 27, 9, 4, 5).getTime();
    const el = mount({ ...READ, at, defaultOpen: true });
    // On the first line: the first section's head, next to its copy button …
    const time = q(el, '.tc-section[data-part="args"] .tc-head-end .tc-at')!;
    expect(time.textContent).toBe('09:04:05');
    expect(time.getAttribute('datetime')).toBe(new Date(at).toISOString());
    expect(qa(el, '.tc-at')).toHaveLength(1);
    expect(q(mount({ ...READ, defaultOpen: true }), '.tc-at')).toBeNull();
    // … a muted line …
    const cut = mount({ name: 'Task', status: 'interrupted', at, defaultOpen: true });
    expect(q(cut, '.tc-line .tc-at')?.textContent).toBe('09:04:05');
    // … or a line of its own above an error box.
    const err = mount({ name: 'Bash', status: 'error', args: { a: 1 }, at, defaultOpen: true });
    expect(q(err, '.tc-sections > .tc-top .tc-at')?.textContent).toBe('09:04:05');
    expect(qa(err, '.tc-at')).toHaveLength(1);
  });

  it('copy: ui-copy {part, text}, clipboard, a check for 1.4 s that survives a re-render', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({ writeText } as unknown as Clipboard);
    const el = mount({ ...READ, id: 'r1', defaultOpen: true });
    const seen: unknown[] = [];
    el.addEventListener('ui-copy', (e) => seen.push((e as CustomEvent).detail));
    vi.useFakeTimers();
    click(el, '.tc-copy[data-part="args"]');
    expect(seen).toEqual([{ part: 'args', text: '{\n  "file_path": "src/app.ts",\n  "limit": 80\n}', id: 'r1' }]);
    expect(writeText).toHaveBeenCalledWith('{\n  "file_path": "src/app.ts",\n  "limit": 80\n}');
    await vi.advanceTimersByTimeAsync(0);
    const btn = () => q(el, '.tc-copy[data-part="args"]')!;
    expect(btn().hasAttribute('data-copied')).toBe(true);
    expect(btn().getAttribute('aria-label')).toBe('Copied');
    set(el, { summary: 're-rendered' });
    expect(btn().hasAttribute('data-copied')).toBe(true);
    expect(q(el, '.tc-copy[data-part="result"]')?.hasAttribute('data-copied')).toBe(false);
    await vi.advanceTimersByTimeAsync(1400);
    expect(btn().hasAttribute('data-copied')).toBe(false);
    expect(btn().getAttribute('aria-label')).toBe('Copy arguments');
  });

  it('a cancelled ui-copy leaves the clipboard to the host; without a clipboard the text is selected', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({ writeText } as unknown as Clipboard);
    const el = mount({ ...READ, defaultOpen: true });
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('ui-copy', stop);
    click(el, '.tc-copy[data-part="result"]');
    expect(writeText).not.toHaveBeenCalled();
    el.removeEventListener('ui-copy', stop);
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue(undefined as unknown as Clipboard);
    click(el, '.tc-copy[data-part="result"]');
    await flush();
    expect(live(el)).toBe('Selected — press ⌘C / Ctrl+C to copy');
  });

  it('caps a tall block with Show all, and a re-render keeps it open', () => {
    const big = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`key${i}`, i]));
    const el = mount({
      name: 'mcp__github__get_issue',
      status: 'success',
      result: JSON.stringify(big),
      defaultOpen: true,
    });
    const pre = () => q(el, '.tc-code[data-part="result"]')!;
    const more = () => q(el, '.tc-more[data-part="result"]')!;
    expect(pre().hasAttribute('data-capped')).toBe(true);
    expect(pre().style.maxHeight).toBe('220px');
    expect(more().hidden).toBe(false);
    expect(more().textContent).toBe('Show all');
    click(el, '.tc-more[data-part="result"]');
    expect(more().textContent).toBe('Show less');
    expect(more().getAttribute('aria-expanded')).toBe('true');
    expect(pre().hasAttribute('data-capped')).toBe(false);
    set(el, { summary: 're-rendered' });
    expect(more().textContent).toBe('Show less');
    expect(pre().hasAttribute('data-capped')).toBe(false);
    // A short block is not capped.
    const small = mount({ ...READ, defaultOpen: true });
    expect(q(small, '.tc-more[data-part="args"]')?.hidden).toBe(true);
    // maxCodeHeight moves the cap.
    const low = mount({ ...READ, args: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }, maxCodeHeight: 60, defaultOpen: true });
    expect(q(low, '.tc-code[data-part="args"]')?.style.maxHeight).toBe('60px');
  });

  it('renders a ~200 KiB JSON result well under a second', () => {
    const rows = Array.from({ length: 2600 }, (_, i) => ({
      id: i,
      path: `src/file-${i}.ts`,
      ok: i % 3 !== 0,
      note: null,
      score: i / 7,
    }));
    const raw = JSON.stringify(rows);
    expect(raw.length).toBeGreaterThan(200_000);
    const t0 = performance.now();
    const el = mount({ name: 'Grep', status: 'success', result: raw, defaultOpen: true });
    const ms = performance.now() - t0;
    expect(q(el, '.tc-code[data-part="result"] .tc-k')?.textContent).toBe('"id"');
    expect(ms).toBeLessThan(1000);
    // Capped anyway, so only its first lines are in the DOM; copy uses the whole text.
    const code = q(el, '.tc-code[data-part="result"] > code')!;
    const full = JSON.stringify(rows, null, 2);
    expect(code.hasAttribute('data-partial')).toBe(true);
    expect(code.textContent!.length).toBeLessThan(10_000);
    expect(full.startsWith(code.textContent!)).toBe(true);
    let copied = '';
    el.addEventListener('ui-copy', (e) => {
      copied = (e as CustomEvent).detail.text;
      e.preventDefault();
    });
    click(el, '.tc-copy[data-part="result"]');
    expect(copied).toBe(full);
  });

  it('a block far taller than the cap renders its head; Show all and the select fallback put in the whole', async () => {
    const lines = Array.from({ length: 300 }, (_, i) => `line ${i} <b>`).join('\n');
    const el = mount({ name: 'Bash', status: 'success', result: lines, defaultOpen: true });
    const code = () => q(el, '.tc-code[data-part="result"] > code')!;
    expect(code().hasAttribute('data-partial')).toBe(true);
    expect(code().textContent!.split('\n').length).toBeLessThan(300);
    click(el, '.tc-more[data-part="result"]');
    expect(code().hasAttribute('data-partial')).toBe(false);
    expect(code().textContent).toBe(lines);
    expect(q(el, 'b')).toBeNull();
    click(el, '.tc-more[data-part="result"]'); // Show less keeps the whole text until the next render
    set(el, { summary: 're-rendered' });
    expect(code().hasAttribute('data-partial')).toBe(true);
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue(undefined as unknown as Clipboard);
    click(el, '.tc-copy[data-part="result"]');
    await flush();
    expect(code().textContent).toBe(lines);
  });

  it('live timer: ticks a text node every 100 ms while running, stops on status change and on disconnect', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 27, 12, 0, 0));
    const el = mount({ name: 'Bash', status: 'running', startedAt: Date.now() - 400 });
    const time = () => q(el, '.tc-time')!;
    expect(time().textContent).toBe('0.4s');
    const node = time().firstChild;
    vi.advanceTimersByTime(1000);
    expect(time().textContent).toBe('1.4s');
    expect(time().firstChild).toBe(node); // updated in place
    set(el, { status: 'success' });
    expect(time().textContent).toBe('1.4s'); // measured: no duration given
    vi.advanceTimersByTime(1000);
    expect(time().textContent).toBe('1.4s');
    set(el, { status: 'running', startedAt: Date.now() });
    vi.advanceTimersByTime(300);
    expect(time().textContent).toBe('0.3s');
    const clear = vi.spyOn(window, 'clearInterval');
    el.remove();
    expect(clear).toHaveBeenCalled();
    const before = time().textContent;
    vi.advanceTimersByTime(2000);
    expect(time().textContent).toBe(before);
  });

  it('announces status changes once; a card that first appears finished stays quiet', () => {
    const el = mount({ name: 'Read', status: 'running' });
    expect(live(el)).toBe('Read running');
    set(el, { status: 'success' });
    expect(live(el)).toBe('Read finished');
    set(el, { status: 'error', error: 'boom' });
    expect(live(el)).toBe('Read failed: boom');
    expect(live(mount(READ))).toBe('');
  });

  it('focus() focuses the header button; focusable=false takes it out of the tab order', () => {
    const el = mount(READ);
    el.focus();
    expect(el.shadowRoot!.activeElement).toBe(q(el, '.tc-head'));
    expect(q(el, '.tc-head')?.hasAttribute('tabindex')).toBe(false);
    set(el, { focusable: false });
    expect(q(el, '.tc-head')?.getAttribute('tabindex')).toBe('-1');
  });

  it('uses the icon from data, else from the name', () => {
    const a = mount({ name: 'Bash', status: 'success', icon: 'globe' });
    const b = mount({ name: 'WebFetch', status: 'success' });
    expect(q(a, '.tc-icon')?.innerHTML).toBe(q(b, '.tc-icon')?.innerHTML);
  });

  it('speaks Korean with lang="ko"', () => {
    const el = mount({ name: 'Bash', status: 'running', args: { command: 'ls' }, defaultOpen: true }, { lang: 'ko' });
    expect(q(el, '.tc-status .sr-only')?.textContent).toBe('실행 중, ');
    expect(qa(el, '.tc-label').map((l) => l.textContent)).toEqual(['입력', '결과']);
    expect(q(el, '.tc-section .tc-pending')?.textContent).toBe('결과 기다리는 중…');
    expect(q(el, '.tc-copy')?.getAttribute('aria-label')).toBe('입력 복사');
    expect(live(el)).toBe('Bash 실행 중');
    set(el, { status: 'error', canRetry: true });
    expect(q(el, '.tc-time')?.textContent).toBe('실패');
    expect(q(el, '[data-act="retry"]')?.textContent).toBe('다시 시도');
    set(el, { status: 'interrupted' });
    expect(q(el, '.tc-time')?.textContent).toBe('결과 없음');
    expect(q(el, '.tc-sections > .tc-pending')?.textContent).toBe('이 호출이 끝나기 전에 실행이 멈췄어요');
    set(el, { status: 'success', result: undefined, args: undefined });
    expect(q(el, '.tc-pending')?.textContent).toBe('입력과 결과 없음');
    set(el, { loading: true });
    expect(q(el, '.tc-loading')?.textContent).toBe('불러오는 중…');
  });
});

describe('<ui-tool-call-card> focus and big output (review R1)', () => {
  it('a card with an out-of-range start time still renders (no RangeError)', () => {
    const el = mount({ name: 'Read', status: 'success', at: 8.64e15 + 1, defaultOpen: true, args: { a: 1 } });
    expect(el.shadowRoot?.querySelector('.tc-head')).not.toBeNull();
    expect(el.shadowRoot?.querySelector('time.tc-at')).toBeNull();
  });

  it('Retry goes away with the new run: focus stays on the card header, not <body>', () => {
    const el = mount({ name: 'WebFetch', status: 'error', error: 'timeout', canRetry: true, open: true });
    const retry = el.shadowRoot?.querySelector<HTMLButtonElement>('[data-act="retry"]');
    expect(retry).toBeTruthy();
    retry?.focus();
    expect(el.shadowRoot?.activeElement).toBe(retry);
    el.data = { ...(el.data as ToolCallData), status: 'running' };
    el.renderNow();
    expect(el.shadowRoot?.querySelector('[data-act="retry"]')).toBeNull();
    expect((el.shadowRoot?.activeElement as HTMLElement | null)?.classList.contains('tc-head')).toBe(true);
  });

  it('a 200 KB single-line result renders only its first screen until Show all', () => {
    const long = 'x'.repeat(200_000);
    const el = mount({ name: 'Bash', status: 'success', result: long, open: true });
    const code = el.shadowRoot?.querySelector('pre.tc-code[data-part="result"] > code');
    expect(code?.hasAttribute('data-partial')).toBe(true);
    expect((code?.textContent ?? '').length).toBeLessThan(long.length);
  });
});

describe('<ui-tool-call-group>', () => {
  const CALLS: ToolCallData[] = [
    { id: 'a', name: 'Grep', status: 'success', duration: 200 },
    { id: 'b', name: 'Read', status: 'success', duration: 40 },
    { id: 'c', name: 'Bash', status: 'error', duration: 2160, error: 'exit 1' },
    { id: 'd', name: 'WebFetch', status: 'success', duration: 0 },
  ];

  it('one line: the last three icons, “Used 4 tools · 1 failed · 2.4s”', () => {
    const el = mountGroup({ calls: CALLS });
    expect(qa(el, '.tcg-stack .tc-icon')).toHaveLength(3);
    expect(q(el, '.tcg-label')?.textContent).toBe('Used 4 tools');
    expect(q(el, '.tcg-failed')?.textContent).toBe('· 1 failed');
    expect(q(el, '.tcg-time')?.textContent).toBe('· 2.4s');
    expect(q(el, '.tcg-label')?.classList.contains('tc-shine')).toBe(false);
    expect(el.cards).toHaveLength(4);
    expect(el.cards.map((c) => c.data?.name)).toEqual(['Grep', 'Read', 'Bash', 'WebFetch']);
    expect(el.cards[2].getAttribute('role')).toBe('listitem');
  });

  it('while a call runs: “Using tools…” with the sweep, no failed count, a live time', () => {
    vi.useFakeTimers();
    const el = mountGroup({
      calls: [...CALLS, { id: 'e', name: 'Bash', status: 'running', startedAt: Date.now() - 1000 }],
    });
    const label = q(el, '.tcg-label')!;
    expect(label.textContent).toBe('Using tools…');
    expect(label.classList.contains('tc-shine')).toBe(true);
    expect(label.dataset.text).toBe('Using tools…');
    expect(q(el, '.tcg-failed')).toBeNull();
    expect(q(el, '.tcg-time')?.textContent).toBe('· 1.0s');
    vi.advanceTimersByTime(500);
    expect(q(el, '.tcg-time')?.textContent).toBe('· 1.5s');
    expect(live(el)).toBe('Using tools…');
    const custom = mountGroup({
      calls: [{ name: 'Read', status: 'success' }],
      label: 'Read the work log',
      duration: 900,
    });
    expect(q(custom, '.tcg-label')?.textContent).toBe('Read the work log');
    expect(q(custom, '.tcg-time')?.textContent).toBe('· 900ms');
  });

  it('an interrupted call is neither running nor failed', () => {
    const el = mountGroup({
      calls: [
        { name: 'Task', status: 'interrupted' },
        { name: 'Read', status: 'success' },
      ],
    });
    expect(q(el, '.tcg-label')?.textContent).toBe('Used 2 tools');
    expect(q(el, '.tcg-failed')).toBeNull();
  });

  it('reconciles cards by id: same element instances across re-renders, only changes created or removed', () => {
    const el = mountGroup({ calls: CALLS, defaultOpen: true });
    const [a, b, c, d] = el.cards;
    c.renderNow();
    q(c, '.tc-head')!.click(); // opened by hand: must survive the group re-render
    const list = q(el, '.tcg-list')!;
    el.data = { calls: [CALLS[0], { ...CALLS[1], summary: 'now with a summary' }, CALLS[2], CALLS[3]] };
    el.renderNow();
    expect(el.cards).toEqual([a, b, c, d]);
    expect(q(el, '.tcg-list')).toBe(list);
    expect(b.data?.summary).toBe('now with a summary');
    expect(c.isOpen).toBe(true);
    // Reorder + remove + add: kept instances move, new ones are created.
    el.data = { calls: [CALLS[3], { id: 'z', name: 'Glob', status: 'running' }, CALLS[0]] };
    el.renderNow();
    const next = el.cards;
    expect(next[0]).toBe(d);
    expect(next[2]).toBe(a);
    expect([a, b, c, d]).not.toContain(next[1]);
    expect(Array.from(list.children)).toEqual(next);
    expect(b.isConnected).toBe(false);
  });

  it('does not re-assign a card whose call did not change', () => {
    const el = mountGroup({ calls: CALLS });
    const card = el.cards[0];
    const spy = vi.spyOn(card, 'requestRender');
    el.data = { calls: CALLS.map((c) => ({ ...c })) };
    el.renderNow();
    expect(spy).not.toHaveBeenCalled();
  });

  it('keys calls without id by index, and de-duplicates ids', () => {
    expect(
      callKeys([
        { name: 'A', status: 'success' },
        { name: 'B', status: 'success', id: 'x' },
        { name: 'C', status: 'success', id: 'x' },
      ]),
    ).toEqual(['i:0', 'id:x', 'id:x#2']);
  });

  it('toggles with ui-toggle {open}; cancel and controlled behave like the card', () => {
    const el = mountGroup({ calls: CALLS });
    const body = () => el.shadowRoot!.querySelector('.tcg-body')!;
    expect(body().hasAttribute('inert')).toBe(true);
    const seen: boolean[] = [];
    const onToggle = (e: Event) => {
      if (e.composedPath()[0] === el) seen.push((e as CustomEvent).detail.open);
    };
    el.addEventListener('ui-toggle', onToggle);
    click(el, '.tcg-head');
    expect(seen).toEqual([true]);
    expect(el.isOpen).toBe(true);
    expect(body().hasAttribute('inert')).toBe(false);
    expect(q(el, '.tcg-head')?.getAttribute('aria-expanded')).toBe('true');
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('ui-toggle', stop);
    click(el, '.tcg-head');
    expect(el.isOpen).toBe(true);
    el.removeEventListener('ui-toggle', stop);
    const ctl = mountGroup({ calls: CALLS, open: false });
    click(ctl, '.tcg-head');
    expect(ctl.isOpen).toBe(false);
  });

  it('card events bubble out of the group, with the call id', () => {
    const el = mountGroup({
      calls: [{ id: 'x1', name: 'Bash', status: 'error', canRetry: true, defaultOpen: true }],
      defaultOpen: true,
    });
    const retry = vi.fn();
    document.body.addEventListener('ui-retry', (e) => retry((e as CustomEvent).detail));
    const card = el.cards[0];
    card.renderNow();
    q(card, '[data-act="retry"]')!.click();
    expect(retry).toHaveBeenCalledWith({ id: 'x1' });
  });

  it('passes lang, theme and focusable=false to its cards', () => {
    const el = mountGroup({ calls: CALLS, focusable: false }, { lang: 'ko', theme: 'dark' });
    expect(q(el, '.tcg-label')?.textContent).toBe('툴 4개 사용');
    expect(q(el, '.tcg-failed')?.textContent).toBe('· 1개 실패');
    expect(q(el, '.tcg-head')?.getAttribute('tabindex')).toBe('-1');
    const card = el.cards[2];
    expect(card.getAttribute('lang')).toBe('ko');
    expect(card.getAttribute('theme')).toBe('dark');
    expect(card.data?.focusable).toBe(false);
    card.renderNow();
    expect(q(card, '.tc-time')?.textContent).toBe('실패');
    el.setAttribute('lang', 'en');
    el.renderNow();
    expect(card.getAttribute('lang')).toBe('en');
    const running = mountGroup({ calls: [{ name: 'Bash', status: 'running' }] }, { lang: 'ko' });
    expect(q(running, '.tcg-label')?.textContent).toBe('툴 사용 중…');
  });

  it('focus() focuses the group header', () => {
    const el = mountGroup({ calls: CALLS });
    el.focus();
    expect(el.shadowRoot!.activeElement).toBe(q(el, '.tcg-head'));
  });

  it('announces running → done once', () => {
    const el = mountGroup({ calls: [{ name: 'Bash', status: 'running' }] });
    expect(live(el)).toBe('Using tools…');
    el.data = { calls: [{ name: 'Bash', status: 'error' }] };
    el.renderNow();
    expect(live(el)).toBe('Used 1 tool, 1 failed');
    expect(live(mountGroup({ calls: CALLS }))).toBe('');
  });
});

describe('STRINGS', () => {
  it('ko has every en key', () => {
    expect(Object.keys(STRINGS.ko).sort()).toEqual(Object.keys(STRINGS.en).sort());
    expect(STRINGS.ko.used(3)).toBe('툴 3개 사용');
    expect(STRINGS.ko.sayRunning('Read')).toBe('Read 실행 중');
  });
});
