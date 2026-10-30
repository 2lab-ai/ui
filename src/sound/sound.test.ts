import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { define, UiElement } from '../core/element';
import {
  bindSound,
  playSound,
  SOUND_CUES,
  type SoundCue,
  type SoundOptions,
  type SoundPlayer,
  setSound,
  soundInput,
  soundOn,
  soundSettings,
  typedKey,
} from './sound';

type Call = [SoundCue, SoundOptions | undefined];
let calls: Call[];
let player: SoundPlayer;
let testNo = 0;

beforeEach(() => {
  // The queue reads performance.now(): fake it with the timers so gaps are exact.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
  // Each test starts a fresh gesture, far past the gesture and repeat windows of every test before it (the fake
  // clock restarts at zero per test; the queue remembers when cues last played).
  vi.advanceTimersByTime(60_000 * ++testNo);
  calls = [];
  player = vi.fn((cue: SoundCue, options?: SoundOptions) => {
    calls.push([cue, options]);
  });
  setSound({ player, enabled: true, typing: false });
  document.body.innerHTML = '';
});
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  setSound({ player: null, enabled: false, typing: false });
});

/** Let the queue decide (a tap waits 24 ms for a richer cue of the same gesture). */
const settle = () => vi.advanceTimersByTime(30);
const cues = () => calls.map((c) => c[0]);

describe('the cue set', () => {
  it('is Cuelume’s fourteen cues', () => {
    expect([...SOUND_CUES].sort()).toEqual(
      [
        'attention',
        'close',
        'count',
        'error',
        'loading',
        'navigate',
        'open',
        'ready',
        'select',
        'success',
        'tap',
        'toggle',
        'type',
        'warning',
      ].sort(),
    );
  });
});

describe('silent until a host turns it on', () => {
  it('plays nothing without a player', () => {
    setSound({ player: null, enabled: true });
    playSound('select');
    settle();
    expect(soundOn()).toBe(false);
    expect(cues()).toEqual([]);
  });
  it('plays nothing while disabled, then plays once enabled', () => {
    setSound({ enabled: false });
    playSound('select');
    settle();
    expect(cues()).toEqual([]);
    setSound({ enabled: true });
    playSound('select', { emphasis: 'subtle' });
    settle();
    expect(calls).toEqual([['select', { emphasis: 'subtle' }]]);
  });
  it('is off by default for a page that never called setSound', () => {
    setSound({ player: null, enabled: false });
    expect(soundSettings()).toEqual({ player: null, enabled: false, typing: false });
  });
  it('keeps the settings on one page-wide record, so two copies of the library share them', () => {
    const shared = (globalThis as Record<symbol, unknown>)[Symbol.for('@2lab.ai/ui/sound')] as {
      enabled: boolean;
      player: unknown;
    };
    expect(shared.enabled).toBe(true);
    expect(shared.player).toBe(player);
  });
  it('ignores junk settings and keeps the last good ones', () => {
    setSound({ player: 'nope' as never, enabled: 'yes' as never });
    expect(soundSettings().player).toBe(player);
    expect(soundSettings().enabled).toBe(true);
  });
  it('drops unknown cue names', () => {
    playSound('boing' as SoundCue);
    settle();
    expect(cues()).toEqual([]);
  });
  it('a player that throws never breaks the caller', () => {
    setSound({
      player: () => {
        throw new Error('no audio');
      },
    });
    playSound('select');
    expect(() => settle()).not.toThrow();
  });
});

describe('one interaction, one cue (the most specific wins)', () => {
  it('a tap waits for the open of the same click and yields to it', () => {
    playSound('tap');
    playSound('open');
    settle();
    expect(cues()).toEqual(['open']);
  });
  it('a tap after a richer cue of the same gesture is dropped', () => {
    playSound('select');
    settle();
    vi.advanceTimersByTime(100);
    playSound('tap');
    settle();
    expect(cues()).toEqual(['select']);
  });
  it('a tap on its own plays', () => {
    playSound('tap', { input: 'keyboard' });
    settle();
    expect(calls).toEqual([['tap', { input: 'keyboard' }]]);
  });
  it('an outcome beats an open, and a lower cue after a richer one waits its turn out', () => {
    playSound('open');
    playSound('success');
    playSound('select');
    settle();
    expect(cues()).toEqual(['success']);
  });
  it('the same cue again within 50 ms is dropped (a dragged slider ticks, never buzzes)', () => {
    playSound('select');
    settle();
    playSound('select');
    settle();
    vi.advanceTimersByTime(60);
    playSound('select');
    settle();
    expect(cues()).toEqual(['select', 'select']);
  });
});

describe('quiet regions', () => {
  it('data-ui-sound="off" on an ancestor mutes everything inside, across shadow roots', () => {
    document.body.innerHTML = '<section data-ui-sound="off"><div id="host"></div></section><p id="out"></p>';
    const host = document.getElementById('host')!;
    const inner = document.createElement('button');
    host.attachShadow({ mode: 'open' }).append(inner);
    expect(soundOn(inner)).toBe(false);
    playSound('select', undefined, inner);
    settle();
    expect(cues()).toEqual([]);
    const out = document.getElementById('out')!;
    expect(soundOn(out)).toBe(true);
    playSound('select', undefined, out);
    settle();
    expect(cues()).toEqual(['select']);
  });
});

describe('typing is opt-in', () => {
  it('the type cue is silent unless typing is on', () => {
    playSound('type', { key: 'printable' });
    settle();
    expect(cues()).toEqual([]);
    setSound({ typing: true });
    playSound('type', { key: 'printable' });
    settle();
    expect(calls).toEqual([['type', { key: 'printable' }]]);
  });

  const field = (html: string) => {
    document.body.innerHTML = html;
    return document.body.firstElementChild as HTMLInputElement | HTMLTextAreaElement;
  };
  const down = (el: HTMLElement, init: KeyboardEventInit) => {
    const e = new KeyboardEvent('keydown', { bubbles: true, ...init });
    Object.defineProperty(e, 'target', { value: el });
    Object.defineProperty(e, 'currentTarget', { value: el });
    return e;
  };
  it('typedKey names the keys that edit text and nothing else', () => {
    const input = field('<input value="ab">') as HTMLInputElement;
    input.setSelectionRange(2, 2);
    expect(typedKey(down(input, { key: 'x' }))).toBe('printable');
    expect(typedKey(down(input, { key: ' ' }))).toBe('space');
    expect(typedKey(down(input, { key: 'Backspace' }))).toBe('delete');
    expect(typedKey(down(input, { key: 'Delete' }))).toBeUndefined(); // caret at the end: nothing to delete
    expect(typedKey(down(input, { key: 'Enter' }))).toBeUndefined(); // a one-line field submits
    expect(typedKey(down(input, { key: 'c', metaKey: true }))).toBeUndefined();
    expect(typedKey(down(input, { key: 'ArrowLeft' }))).toBeUndefined();
    expect(typedKey(down(input, { key: 'Shift' }))).toBeUndefined();
    const area = field('<textarea></textarea>');
    expect(typedKey(down(area, { key: 'Enter' }))).toBe('enter');
    expect(typedKey(down(area, { key: 'Backspace' }))).toBeUndefined(); // empty
    const pw = field('<input type="password">');
    expect(typedKey(down(pw, { key: 'x' }))).toBeUndefined();
    const ro = field('<input readonly>');
    expect(typedKey(down(ro, { key: 'x' }))).toBeUndefined();
    const composing = down(field('<input>'), { key: 'x' });
    Object.defineProperty(composing, 'isComposing', { value: true });
    expect(typedKey(composing)).toBeUndefined();
  });
});

describe('soundInput', () => {
  it('reads what did the activating', () => {
    const p = (pointerType: string) => Object.assign(new MouseEvent('click', { detail: 1 }), { pointerType });
    expect(soundInput(p('mouse'))).toBe('mouse');
    expect(soundInput(p('touch'))).toBe('touch');
    expect(soundInput(p('pen'))).toBe('pen');
    expect(soundInput(new MouseEvent('click', { detail: 0 }))).toBe('keyboard');
    expect(soundInput(new MouseEvent('click', { detail: 1 }))).toBe('mouse');
    expect(soundInput(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe('keyboard');
    expect(soundInput(undefined)).toBeUndefined();
  });
});

describe('bindSound — light-DOM controls of the host page', () => {
  it('a click on [data-ui-sound] plays its cue; the innermost marked element decides', () => {
    document.body.innerHTML =
      '<div data-ui-sound="open"><button id="a" data-ui-sound="tap">Save</button><button id="b">Menu</button></div>';
    const off = bindSound(document);
    document.getElementById('a')!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    settle();
    vi.advanceTimersByTime(300);
    document.getElementById('b')!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    settle();
    expect(cues()).toEqual(['tap', 'open']);
    off();
    vi.advanceTimersByTime(300);
    document.getElementById('a')!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    settle();
    expect(cues()).toEqual(['tap', 'open']);
  });
  it('an empty value plays tap; emphasis comes from the nearest data-ui-sound-emphasis', () => {
    document.body.innerHTML = '<nav data-ui-sound-emphasis="subtle"><a id="a" href="#x" data-ui-sound>Go</a></nav>';
    bindSound();
    document.getElementById('a')!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    settle();
    expect(calls).toEqual([['tap', { emphasis: 'subtle', input: 'keyboard' }]]);
  });
  it('a toggle reads which way it switched; a disabled control and an "off" region stay silent', () => {
    document.body.innerHTML = `
      <button id="t" data-ui-sound="toggle" aria-pressed="false">Star</button>
      <button id="d" data-ui-sound="tap" disabled>No</button>
      <button id="ad" data-ui-sound="tap" aria-disabled="true">No</button>
      <div data-ui-sound="off"><button id="m" data-ui-sound="tap">Muted</button></div>`;
    bindSound();
    const t = document.getElementById('t')!;
    t.addEventListener('click', () => t.setAttribute('aria-pressed', 'true'));
    t.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    settle();
    for (const id of ['d', 'ad', 'm']) {
      vi.advanceTimersByTime(300);
      document.getElementById(id)!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      settle();
    }
    expect(calls).toEqual([['toggle', { direction: 'forward', input: 'mouse' }]]);
  });
  it('a native checkbox or switch sounds on change, by its new state', () => {
    document.body.innerHTML =
      '<label class="ui-switch"><input id="s" type="checkbox" role="switch" data-ui-sound="toggle" checked></label>';
    bindSound();
    const s = document.getElementById('s') as HTMLInputElement;
    s.checked = false;
    s.dispatchEvent(new Event('change', { bubbles: true }));
    settle();
    expect(calls).toEqual([['toggle', { direction: 'back' }]]);
    // A user's click flips it and fires change: one toggle for the change, nothing for the click itself.
    vi.advanceTimersByTime(300);
    s.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    settle();
    expect(s.checked).toBe(true);
    expect(calls).toEqual([
      ['toggle', { direction: 'back' }],
      ['toggle', { direction: 'forward' }],
    ]);
  });
  it('a field marked type sounds keystrokes only when typing is on', () => {
    document.body.innerHTML = '<input id="f" data-ui-sound="type">';
    bindSound();
    const f = document.getElementById('f') as HTMLInputElement;
    f.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    settle();
    expect(cues()).toEqual([]);
    setSound({ typing: true });
    f.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    settle();
    expect(calls).toEqual([['type', { key: 'printable' }]]);
  });
  it('binding the same root twice listens once', () => {
    document.body.innerHTML = '<button id="a" data-ui-sound="select">x</button>';
    const off1 = bindSound();
    const off2 = bindSound();
    document.getElementById('a')!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    settle();
    expect(cues()).toEqual(['select']);
    off1();
    off2();
  });
});

class UiSoundProbe extends UiElement<{ n: number }> {
  protected render(): string {
    return '<button id="go">go</button>';
  }
  protected override updated(): void {
    this.$('#go')?.addEventListener('click', (e) => this.sound('select', { emphasis: 'subtle' }, e));
  }
}
define('ui-sound-probe', UiSoundProbe);

describe('UiElement.sound', () => {
  it('plays through the page settings with the input read from the event, and respects quiet regions', () => {
    document.body.innerHTML = '<div id="wrap"></div>';
    const el = document.createElement('ui-sound-probe') as UiSoundProbe;
    document.getElementById('wrap')!.append(el);
    el.data = { n: 1 };
    el.renderNow();
    el.shadowRoot!.querySelector<HTMLElement>('#go')!.dispatchEvent(new MouseEvent('click', { detail: 0 }));
    settle();
    expect(calls).toEqual([['select', { emphasis: 'subtle', input: 'keyboard' }]]);
    document.getElementById('wrap')!.setAttribute('data-ui-sound', 'off');
    vi.advanceTimersByTime(300);
    el.shadowRoot!.querySelector<HTMLElement>('#go')!.dispatchEvent(new MouseEvent('click', { detail: 1 }));
    settle();
    expect(calls).toHaveLength(1);
  });
});
