import { afterEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import type { UiComposer } from './composer';
import './composer';
import type { ComposerData, ComposerSubmitDetail } from './logic';
import { composerStrings } from './strings';
import {
  COMPOSER_SUGGEST_MAX,
  type ComposerSuggestDetail,
  type ComposerSuggestion,
  type ComposerTrigger,
  composerSuggestApply,
  composerSuggestFilter,
  composerSuggestScore,
  composerSuggestToken,
  composerTriggers,
} from './suggest';

const XSS = '<img src=x onerror=alert(1)>';

const COMMANDS: ComposerSuggestion[] = [
  { value: '/new', description: 'Start a new session', example: '/new fix the login bug', group: 'Session' },
  { value: '/model', description: 'Switch the model', example: '/model opus', group: 'Session' },
  { value: '/compact', description: 'Summarise the conversation', example: '/compact', group: 'Context' },
  { value: '/cwd', description: 'Show the working folder', keywords: ['directory'], group: 'Context' },
];
const SKILLS: ComposerSuggestion[] = [
  { value: '$local:autoz', label: '$autoz', description: 'Autonomous pipeline' },
  { value: '$user:dev', description: 'Deploy to dev' },
  { value: '$zworkflow:z', description: 'Work controller' },
];
const TRIGGERS: ComposerTrigger[] = [
  { char: '/', at: 'start', label: 'Commands', items: COMMANDS },
  { char: '$', label: 'Skills', items: SKILLS },
];

// ── Pure helpers ──

describe('composerTriggers', () => {
  it('keeps one-character triggers (first wins) and rows with a value', () => {
    const out = composerTriggers([
      { char: '/', at: 'start', items: [{ value: '/a', description: ' A ', keywords: ['x', ''] }, { value: '  ' }, 7] },
      { char: '/', items: [{ value: '/dup' }] },
      { char: '$$', items: [] },
      { char: ' ', items: [] },
      { char: '$', items: 'nope', label: ' Skills ' },
      null,
    ]);
    expect(out).toEqual([
      { char: '/', at: 'start', items: [{ value: '/a', description: 'A', keywords: ['x'] }] },
      { char: '$', at: 'word', items: [], label: 'Skills' },
    ]);
    expect(composerTriggers(undefined)).toEqual([]);
  });
});

describe('composerSuggestToken', () => {
  const t = composerTriggers(TRIGGERS);
  it('opens on a start trigger only at the start of the message', () => {
    expect(composerSuggestToken('/mo', 3, t)).toMatchObject({ start: 0, end: 3, query: 'mo' });
    expect(composerSuggestToken('  /mo', 5, t)).toMatchObject({ start: 2, query: 'mo' });
    expect(composerSuggestToken('hi /mo', 6, t)).toBeNull();
  });
  it('opens on a word trigger anywhere a word starts', () => {
    const tok = composerSuggestToken('please run $aut now', 15, t);
    expect(tok).toMatchObject({ start: 11, end: 15, query: 'aut' });
    expect(tok?.trigger.char).toBe('$');
    expect(composerSuggestToken('a$b', 3, t)).toBeNull();
  });
  it('takes the whole word the caret is in and closes after a space', () => {
    expect(composerSuggestToken('$autoz x', 3, t)).toMatchObject({ start: 0, end: 6, query: 'au' });
    expect(composerSuggestToken('/model ', 7, t)).toBeNull();
    expect(composerSuggestToken('', 0, t)).toBeNull();
    expect(composerSuggestToken('/', 1, t)).toMatchObject({ query: '' });
  });
});

describe('composerSuggestScore / composerSuggestFilter', () => {
  it('ranks a name prefix, then a name part, then a substring, then an alias, then the description', () => {
    expect(composerSuggestScore(COMMANDS[1], 'mod', '/')).toBe(0);
    expect(composerSuggestScore(SKILLS[0], 'autoz', '$')).toBe(0); // the label `$autoz`
    expect(composerSuggestScore(SKILLS[1], 'dev', '$')).toBe(1); // user:dev → a part
    expect(composerSuggestScore(COMMANDS[2], 'pac', '/')).toBe(2);
    expect(composerSuggestScore(COMMANDS[3], 'direct', '/')).toBe(3);
    expect(composerSuggestScore(COMMANDS[0], 'session', '/')).toBe(4);
    expect(composerSuggestScore(COMMANDS[0], 'zzz', '/')).toBe(-1);
    // One letter matches names only: “c” is not every description with a c in it.
    expect(composerSuggestScore(COMMANDS[1], 'c', '/')).toBe(-1);
  });
  it('returns every row in order for an empty query, the matches best-first otherwise', () => {
    expect(composerSuggestFilter(COMMANDS, '', '/')).toEqual(COMMANDS);
    expect(composerSuggestFilter(COMMANDS, 'c', '/').map((s) => s.value)).toEqual(['/compact', '/cwd']);
    expect(composerSuggestFilter(SKILLS, 'dev', '$').map((s) => s.value)).toEqual(['$user:dev']);
    expect(composerSuggestFilter(COMMANDS, 'nothing', '/')).toEqual([]);
  });
  it('caps the list', () => {
    const many = Array.from({ length: COMPOSER_SUGGEST_MAX + 50 }, (_, i) => ({ value: `/c${i}` }));
    expect(composerSuggestFilter(many, '', '/')).toHaveLength(COMPOSER_SUGGEST_MAX);
  });
});

describe('composerSuggestApply', () => {
  it('replaces the token and adds one space', () => {
    expect(composerSuggestApply('/mo', { start: 0, end: 3 }, '/model')).toEqual({ text: '/model ', caret: 7 });
    // A new line after the token is not the space: the caret stays on the token's line, after one space.
    expect(composerSuggestApply('/mo\nnext', { start: 0, end: 3 }, '/model')).toEqual({
      text: '/model \nnext',
      caret: 7,
    });
    expect(composerSuggestApply('run $au now', { start: 4, end: 7 }, '$local:autoz')).toEqual({
      text: 'run $local:autoz now',
      caret: 17,
    });
  });
});

// ── The element ──

function mount(data: ComposerData = { triggers: TRIGGERS }, attrs: Record<string, string> = {}): UiComposer {
  const el = document.createElement('ui-composer');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiComposer, s: string) => el.shadowRoot!.querySelector<E>(s);
const qa = (el: UiComposer, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const field = (el: UiComposer) => q<HTMLTextAreaElement>(el, '.cp-field')!;
const pop = (el: UiComposer) => q(el, '.cp-sg')!;
const rows = (el: UiComposer) => qa(el, '.cp-sg [role="option"]');
const isOpen = (el: UiComposer) => !pop(el).hidden;
const activeRow = (el: UiComposer) => rows(el).find((r) => r.getAttribute('aria-selected') === 'true');
function type(el: UiComposer, text: string, caret = text.length): void {
  const f = field(el);
  f.focus();
  f.value = text;
  f.setSelectionRange(caret, caret);
  f.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}
function key(target: Element, k: string, init: KeyboardEventInit & { isComposing?: boolean } = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init });
  if (init.isComposing !== undefined) Object.defineProperty(e, 'isComposing', { value: init.isComposing });
  target.dispatchEvent(e);
  return e;
}
function events<D>(el: UiComposer, name: string, cancel = false): D[] {
  const out: D[] = [];
  el.addEventListener(name, (e) => {
    out.push((e as CustomEvent<D>).detail);
    if (cancel) e.preventDefault();
  });
  return out;
}

describe('<ui-composer> trigger menu', () => {
  let spy: SoundSpy | null = null;
  afterEach(() => {
    spy?.restore();
    spy = null;
    document.body.innerHTML = '';
  });

  it('is closed until a trigger is typed', () => {
    const el = mount();
    expect(isOpen(el)).toBe(false);
    expect(field(el).getAttribute('aria-expanded')).toBe('false');
    expect(field(el).getAttribute('aria-autocomplete')).toBe('list');
  });

  it('“/” at the start lists every command with its description and a grey example', () => {
    const el = mount();
    type(el, '/');
    expect(isOpen(el)).toBe(true);
    expect(rows(el)).toHaveLength(COMMANDS.length);
    const first = rows(el)[0];
    expect(first.querySelector('.cp-sg-name')?.textContent).toBe('/new');
    expect(first.querySelector('.cp-sg-desc')?.textContent).toBe('Start a new session');
    expect(first.querySelector('.cp-sg-ex')?.textContent).toBe('/new fix the login bug');
    // Grouped while nothing is typed after the trigger.
    expect(qa(el, '.cp-sg-head').map((h) => h.textContent)).toEqual(['Session', 'Context']);
    const list = q(el, '.cp-sg [role="listbox"]')!;
    expect(list.getAttribute('aria-label')).toBe('Commands');
    expect(field(el).getAttribute('aria-expanded')).toBe('true');
    expect(field(el).getAttribute('aria-controls')).toBe(list.id);
    expect(field(el).getAttribute('aria-activedescendant')).toBe(first.id);
  });

  it('filters as you type and closes when nothing matches', () => {
    const el = mount();
    type(el, '/mo');
    expect(rows(el).map((r) => r.querySelector('.cp-sg-name')?.textContent)).toEqual(['/model']);
    expect(qa(el, '.cp-sg-head')).toHaveLength(0);
    type(el, '/zzz');
    expect(isOpen(el)).toBe(false);
    expect(field(el).hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('a start trigger mid-sentence does not open; a word trigger does', () => {
    const el = mount();
    type(el, 'hello /mo');
    expect(isOpen(el)).toBe(false);
    type(el, 'hello $de');
    expect(isOpen(el)).toBe(true);
    expect(rows(el).map((r) => r.querySelector('.cp-sg-name')?.textContent)).toEqual(['$user:dev']);
  });

  it('arrows move the active row (wrapping); Enter picks it instead of sending', () => {
    const el = mount();
    const sent = events<ComposerSubmitDetail>(el, 'ui-submit');
    const picked = events<ComposerSuggestDetail>(el, 'ui-suggest');
    const inputs = events<{ value: string }>(el, 'ui-input');
    type(el, '/');
    expect(activeRow(el)?.dataset.i).toBe('0');
    expect(key(field(el), 'ArrowDown').defaultPrevented).toBe(true);
    expect(activeRow(el)?.dataset.i).toBe('1');
    expect(field(el).getAttribute('aria-activedescendant')).toBe(activeRow(el)?.id);
    key(field(el), 'ArrowUp');
    key(field(el), 'ArrowUp');
    expect(activeRow(el)?.dataset.i).toBe(String(COMMANDS.length - 1));
    key(field(el), 'ArrowDown');
    key(field(el), 'ArrowDown');
    const enter = key(field(el), 'Enter');
    expect(enter.defaultPrevented).toBe(true);
    expect(sent).toEqual([]);
    expect(picked).toEqual([{ char: '/', value: '/model', query: '' }]);
    expect(el.value).toBe('/model ');
    expect(field(el).selectionStart).toBe(7);
    expect(inputs.at(-1)).toEqual({ value: '/model ' });
    expect(isOpen(el)).toBe(false);
  });

  it('Tab picks too, inside a sentence', () => {
    const el = mount();
    type(el, 'please $aut now', 11);
    key(field(el), 'Tab');
    expect(el.value).toBe('please $local:autoz now');
    expect(field(el).selectionStart).toBe(20);
  });

  it('Enter on a command typed in full sends as usual', () => {
    const el = mount();
    const sent = events<ComposerSubmitDetail>(el, 'ui-submit');
    type(el, '/new');
    expect(isOpen(el)).toBe(true);
    key(field(el), 'Enter');
    expect(sent.map((d) => d.text)).toEqual(['/new']);
    expect(isOpen(el)).toBe(false);
  });

  it('Shift+Enter, ⌘+Enter and an IME Enter are not picks', () => {
    const el = mount();
    const picked = events<ComposerSuggestDetail>(el, 'ui-suggest');
    type(el, '/mo');
    key(field(el), 'Enter', { isComposing: true });
    key(field(el), 'Enter', { shiftKey: true });
    expect(picked).toEqual([]);
    const sent = events<ComposerSubmitDetail>(el, 'ui-submit');
    key(field(el), 'Enter', { metaKey: true });
    expect(picked).toEqual([]);
    expect(sent.map((d) => d.text)).toEqual(['/mo']);
  });

  it('after Esc, the same trigger typed again opens it (deleted and retyped, or the next message)', () => {
    const el = mount();
    type(el, '/');
    key(field(el), 'Escape');
    expect(isOpen(el)).toBe(false);
    type(el, '');
    type(el, '/');
    expect(isOpen(el)).toBe(true);
    key(field(el), 'Escape');
    el.clear();
    type(el, '/');
    expect(isOpen(el)).toBe(true);
  });

  it('a row named exactly what was typed is the active one, so Enter sends it', () => {
    const el = mount({
      triggers: [
        {
          char: '%',
          at: 'start',
          items: [
            { value: '%model', description: 'session model' },
            { value: '%', description: 'session settings' },
          ],
        },
      ],
    });
    const sent = events<ComposerSubmitDetail>(el, 'ui-submit');
    type(el, '%');
    expect(activeRow(el)?.querySelector('.cp-sg-name')?.textContent).toBe('%');
    key(field(el), 'Enter');
    expect(sent.map((d) => d.text)).toEqual(['%']);
    // Moved off it with the arrows, Enter picks the row moved to.
    type(el, '%');
    key(field(el), 'ArrowUp');
    key(field(el), 'Enter');
    expect(el.value).toBe('%model ');
  });

  it('Esc closes the menu without reaching the page, and typing opens it again', () => {
    const el = mount();
    let reached = 0;
    document.addEventListener('keydown', () => reached++);
    type(el, '/m');
    const esc = key(field(el), 'Escape');
    expect(esc.defaultPrevented).toBe(true);
    expect(reached).toBe(0);
    expect(isOpen(el)).toBe(false);
    expect(el.value).toBe('/m');
    type(el, '/mo');
    expect(isOpen(el)).toBe(true);
    // Closed, Esc is the page's again.
    type(el, 'plain');
    key(field(el), 'Escape');
    expect(reached).toBe(1);
  });

  it('a click picks a row and the field keeps focus', async () => {
    spy = soundSpy();
    const el = mount();
    type(el, '/');
    const row = rows(el)[2];
    const down = new MouseEvent('mousedown', { bubbles: true, composed: true, cancelable: true });
    row.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    row.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(el.value).toBe('/compact ');
    await spy.settle();
    expect(spy.cues()).toEqual(['select']);
  });

  it('hovering a row makes it the active one', () => {
    const el = mount();
    type(el, '/');
    rows(el)[3].dispatchEvent(new MouseEvent('mousemove', { bubbles: true, composed: true }));
    expect(activeRow(el)?.dataset.i).toBe('3');
  });

  it('a cancelled ui-suggest leaves the text to the host', () => {
    const el = mount();
    events<ComposerSuggestDetail>(el, 'ui-suggest', true);
    type(el, '/mo');
    key(field(el), 'Enter');
    expect(el.value).toBe('/mo');
    expect(isOpen(el)).toBe(false);
  });

  it('closes on send, on clear, when disabled, and when the field loses focus', () => {
    const el = mount();
    type(el, '$');
    el.clear();
    expect(isOpen(el)).toBe(false);
    type(el, '$');
    el.data = { ...el.data, disabled: true };
    el.renderNow();
    expect(isOpen(el)).toBe(false);
    el.data = { ...el.data, disabled: false };
    el.renderNow();
    type(el, '$');
    field(el).dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true, relatedTarget: null }));
    expect(isOpen(el)).toBe(false);
  });

  it('no triggers, no menu', () => {
    const el = mount({});
    type(el, '/');
    expect(isOpen(el)).toBe(false);
    expect(field(el).hasAttribute('aria-autocomplete')).toBe(false);
  });

  it('escapes every host string', () => {
    const el = mount({
      triggers: [
        {
          char: '/',
          label: XSS,
          items: [{ value: `/x${XSS}`, label: XSS, description: XSS, example: XSS, group: XSS }],
        },
      ],
    });
    type(el, '/');
    expect(q(el, '.cp-sg img')).toBeNull();
    expect(rows(el)[0].querySelector('.cp-sg-desc')?.textContent).toBe(XSS);
    expect(rows(el)[0].querySelector('.cp-sg-ex')?.textContent).toBe(XSS);
  });

  it('speaks Korean with lang="ko"', () => {
    const el = mount({ triggers: [{ char: '/', items: COMMANDS }] }, { lang: 'ko' });
    type(el, '/');
    const ko = composerStrings.ko;
    expect(q(el, '.cp-sg [role="listbox"]')?.getAttribute('aria-label')).toBe(ko.suggestions);
    expect(q(el, '.cp-sg-foot')?.textContent).toBe(ko.suggestHint);
  });
});

describe('<ui-composer> trigger menu — placement', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  /** A layout: the card 380–505 in a 760px viewport, a 100px probe at 0,0, the menu's rows 602px tall. */
  function layout(el: UiComposer, rowsHeight = 602): void {
    const rect = (top: number, bottom: number, left: number, right: number) =>
      ({ top, bottom, left, right, width: right - left, height: bottom - top, x: left, y: top }) as DOMRect;
    const card = q(el, '.cp-card')!;
    const probe = q(el, '.cp-sg-probe')!;
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(rect(380, 505, 40, 760));
    vi.spyOn(probe, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 0, 100));
    Object.defineProperty(pop(el), 'scrollHeight', { configurable: true, get: () => rowsHeight });
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(760);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(800);
  }

  it('sits over the card, as wide as it, capped, and the same every time it is measured', () => {
    const el = mount();
    layout(el);
    type(el, '/');
    const first = pop(el).getAttribute('style');
    expect(pop(el).style.top).toBe('14px');
    expect(pop(el).style.maxHeight).toBe('360px');
    expect(pop(el).style.width).toBe('720px');
    expect(pop(el).dataset.side).toBe('top');
    // Re-measured (the viewport watcher, a re-filter): no flip between two sizes.
    for (let i = 0; i < 3; i++) type(el, '/');
    expect(pop(el).getAttribute('style')).toBe(first);
  });

  it('a short list is as tall as its rows, right over the card', () => {
    const el = mount();
    layout(el, 120);
    type(el, '/mo');
    expect(pop(el).style.maxHeight).toBe('120px');
    expect(pop(el).style.top).toBe(`${380 - 6 - 120}px`);
  });
});
