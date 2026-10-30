import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import type { UiComposer } from './composer';
import { composerCanRecord } from './composer';
import type {
  ComposerData,
  ComposerFilesDetail,
  ComposerInputDetail,
  ComposerRecordDetail,
  ComposerRejectDetail,
  ComposerSubmitDetail,
  ComposerToolDetail,
} from './logic';
import {
  COMPOSER_DEFAULTS,
  composerAccepts,
  composerAudioExt,
  composerCanSend,
  composerCheckFile,
  composerCounterTone,
  composerEnterAction,
  composerLevel,
  composerPastedName,
  composerRecorderMime,
  composerRows,
  composerSettings,
  composerStamp,
  composerTools,
  composerVoiceName,
} from './logic';
import { composerStrings } from './strings';
import { styles } from './styles';

const XSS = '<img src=x onerror=alert(1)>';
const T = composerStrings.en;
const KO = composerStrings.ko;
const STAMP = /^\d{8}-\d{6}$/;

// ── Helpers ──

function mount(data?: ComposerData, attrs: Record<string, string> = {}): UiComposer {
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
const sendBtn = (el: UiComposer) => q<HTMLButtonElement>(el, '.cp-send')!;
const act = (el: UiComposer, name: string) => q<HTMLButtonElement>(el, `[data-act="${name}"]`);
const errorText = (el: UiComposer) => {
  const p = q(el, '.cp-error')!;
  return p.hidden ? '' : (p.textContent ?? '');
};
const active = (el: UiComposer) => el.shadowRoot!.activeElement as HTMLElement | null;
const set = (el: UiComposer, patch: Partial<ComposerData>) => {
  el.data = { ...(el.data ?? {}), ...patch };
  el.renderNow();
};
function events<D = unknown>(el: UiComposer, name: string, cancel = false): D[] {
  const out: D[] = [];
  el.addEventListener(name, (e) => {
    out.push((e as CustomEvent<D>).detail);
    if (cancel) e.preventDefault();
  });
  return out;
}
function type(el: UiComposer, text: string): void {
  const f = field(el);
  f.value = text;
  f.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}
function key(
  target: Element,
  k: string,
  init: KeyboardEventInit & { keyCode?: number; isComposing?: boolean } = {},
): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init });
  if (init.keyCode !== undefined) Object.defineProperty(e, 'keyCode', { value: init.keyCode });
  if (init.isComposing !== undefined) Object.defineProperty(e, 'isComposing', { value: init.isComposing });
  target.dispatchEvent(e);
  return e;
}
const mk = (name: string, size = 10, mime = '') => new File([new Uint8Array(size)], name, { type: mime });
const png = (name = 'shot.png', size = 10) => mk(name, size, 'image/png');
const pdf = (name = 'report.pdf', size = 1234) => mk(name, size, 'application/pdf');
const txt = (name = 'notes.txt', size = 10) => mk(name, size, 'text/plain');
const wav = (name = 'memo.wav', size = 10) => mk(name, size, 'audio/wav');
/** DragEvent is missing in happy-dom: a plain event with a dataTransfer. */
function drag(kind: string, files: File[] = [], types: string[] = ['Files']): Event {
  const e = new Event(kind, { bubbles: true, composed: true, cancelable: true });
  Object.defineProperty(e, 'dataTransfer', { value: { types, files, dropEffect: 'none' } });
  return e;
}
function paste(files: File[], text = ''): Event {
  const e = new Event('paste', { bubbles: true, composed: true, cancelable: true });
  Object.defineProperty(e, 'clipboardData', {
    value: { files, getData: (t: string) => (t === 'text/plain' ? text : '') },
  });
  return e;
}
const tick = () => new Promise<void>((r) => setTimeout(r, 0));
async function until(check: () => boolean, tries = 300): Promise<void> {
  for (let i = 0; i < tries && !check(); i++) await new Promise<void>((r) => setTimeout(r, 15));
}
function touch(on: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: on && query.includes('coarse'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

// ── Microphone fakes ──

class FakeTrack {
  stopped = false;
  stop() {
    this.stopped = true;
  }
}
class FakeStream {
  readonly tracks = [new FakeTrack()];
  getTracks() {
    return this.tracks;
  }
}
class FakeRecorder {
  static last: FakeRecorder | null = null;
  static supported = ['audio/mp4'];
  static isTypeSupported(t: string): boolean {
    return FakeRecorder.supported.includes(t);
  }
  state: 'inactive' | 'recording' = 'inactive';
  mimeType: string;
  slice = 0;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(
    readonly stream: FakeStream,
    opts?: { mimeType?: string },
  ) {
    this.mimeType = opts?.mimeType ?? '';
    FakeRecorder.last = this;
  }
  start(slice = 0) {
    this.slice = slice;
    this.state = 'recording';
  }
  /** Like a browser: the last chunk and `stop` arrive in a later task. */
  stop() {
    this.state = 'inactive';
    setTimeout(() => {
      this.ondataavailable?.({ data: new Blob(['opus-bytes'], { type: this.mimeType }) });
      this.onstop?.();
    }, 0);
  }
}
class FakeAnalyser {
  fftSize = 2048;
  getByteTimeDomainData(buf: Uint8Array) {
    for (let i = 0; i < buf.length; i++) buf[i] = i % 2 ? 228 : 28;
  }
}
class FakeAudioContext {
  static last: FakeAudioContext | null = null;
  closed = false;
  constructor() {
    FakeAudioContext.last = this;
  }
  createAnalyser() {
    return new FakeAnalyser();
  }
  createMediaStreamSource() {
    return { connect() {} };
  }
  close() {
    this.closed = true;
    return Promise.resolve();
  }
}
let streams: FakeStream[] = [];
function stubMic(opts: { recorder?: boolean; gum?: boolean; fail?: unknown } = {}) {
  const getUserMedia = vi.fn(async () => {
    if (opts.fail !== undefined) throw opts.fail;
    const s = new FakeStream();
    streams.push(s);
    return s;
  });
  if (opts.recorder !== false) vi.stubGlobal('MediaRecorder', FakeRecorder);
  if (opts.gum !== false)
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true, writable: true });
  return getUserMedia;
}
async function startRec(el: UiComposer): Promise<void> {
  act(el, 'voice')!.click();
  await tick();
}

let created: string[] = [];
let revoked: string[] = [];

beforeEach(() => {
  created = [];
  revoked = [];
  streams = [];
  FakeRecorder.last = null;
  FakeRecorder.supported = ['audio/mp4'];
  FakeAudioContext.last = null;
  let n = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    const u = `blob:test/${++n}`;
    created.push(u);
    return u;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((u: string) => {
    revoked.push(u);
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (navigator as { mediaDevices?: unknown }).mediaDevices;
});

// ── Pure helpers ──

describe('logic', () => {
  it('composerSettings fills defaults', () => {
    const def = {
      maxFiles: 10,
      maxFileSize: 25 * 1024 * 1024,
      maxRecordMs: 600_000,
      maxLength: 0,
      accept: '',
      attach: true,
      image: true,
      voice: true,
      busy: false,
      disabled: false,
      reason: '',
      minRows: 2,
      maxRows: 10,
    };
    expect(composerSettings(undefined)).toEqual(def);
    expect(composerSettings(null)).toEqual(def);
    expect(composerSettings({})).toEqual(def);
    expect(COMPOSER_DEFAULTS).toMatchObject({ maxFiles: 10, minRows: 2, maxRows: 10 });
  });

  it('composerSettings ignores junk numbers and reads flags', () => {
    const junk = (v: unknown) => v as number;
    const s = composerSettings({
      maxFiles: 0,
      maxFileSize: -5,
      maxRecordMs: 10,
      maxLength: junk('abc'),
      accept: '  image/*,.pdf ',
      attach: false,
      image: false,
      voice: false,
      busy: true,
      disabled: '  Ended  ',
    });
    expect(s).toMatchObject({
      maxFiles: 10,
      maxFileSize: 25 * 1024 * 1024,
      maxRecordMs: 1000,
      maxLength: 0,
      accept: 'image/*,.pdf',
      attach: false,
      image: false,
      voice: false,
      busy: true,
      disabled: true,
      reason: 'Ended',
    });
    expect(composerSettings({ maxFiles: 2.7, maxLength: 120.9 })).toMatchObject({ maxFiles: 2, maxLength: 120 });
    expect(composerSettings({ maxFiles: junk('3') }).maxFiles).toBe(3);
    expect(composerSettings({ maxFiles: Number.NaN }).maxFiles).toBe(10);
    expect(composerSettings({ maxFiles: Number.POSITIVE_INFINITY }).maxFiles).toBe(10);
    expect(composerSettings({ maxFiles: junk(null) }).maxFiles).toBe(10);
    expect(composerSettings({ maxFiles: junk('') }).maxFiles).toBe(10);
    expect(composerSettings({ maxFiles: 0.4 }).maxFiles).toBe(1);
    expect(composerSettings({ disabled: true })).toMatchObject({ disabled: true, reason: '' });
    expect(composerSettings({ disabled: '' })).toMatchObject({ disabled: false, reason: '' });
    expect(composerSettings({ accept: 5 as unknown as string }).accept).toBe('');
  });

  it('composerTools keeps tools with an id (first wins) and normalises fields', () => {
    const out = composerTools([
      { id: 'plan', label: 'Plan first', icon: 'list', showLabel: 1, pressed: true, disabled: 'yes' },
      { id: 'plan', label: 'duplicate' },
      { label: 'no id' },
      null,
      'x',
      { id: 7 },
      { id: 'model', label: 'Model', icon: '', pressed: 'no' },
    ]);
    expect(out).toEqual([
      { id: 'plan', label: 'Plan first', icon: 'list', showLabel: true, pressed: true, disabled: true },
      { id: '7', label: '7' },
      { id: 'model', label: 'Model' },
    ]);
    expect(composerTools('nope')).toEqual([]);
    expect(composerTools(undefined)).toEqual([]);
  });

  it('composerRows clamps to whole rows, 1 ≤ min ≤ max ≤ 40', () => {
    expect(composerRows()).toEqual({ min: 2, max: 10 });
    expect(composerRows(3, 6)).toEqual({ min: 3, max: 6 });
    expect(composerRows(2.6, 4.4)).toEqual({ min: 3, max: 4 });
    expect(composerRows(5, 2)).toEqual({ min: 5, max: 5 });
    expect(composerRows(12)).toEqual({ min: 12, max: 12 });
    expect(composerRows(50, 90)).toEqual({ min: 40, max: 40 });
    expect(composerRows('abc', -1)).toEqual({ min: 2, max: 10 });
    expect(composerRows(0, 0)).toEqual({ min: 2, max: 10 });
    expect(composerRows(0.2, 1)).toEqual({ min: 1, max: 1 });
  });

  it('composerEnterAction: IME-safe, modifiers and touch', () => {
    const k = (over: Record<string, unknown> = {}) =>
      ({ key: 'Enter', shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, ...over }) as KeyboardEvent;
    expect(composerEnterAction(k())).toBe('send');
    expect(composerEnterAction(k({ isComposing: true }))).toBe('none');
    expect(composerEnterAction(k({ keyCode: 229 }))).toBe('none');
    expect(composerEnterAction(k({ keyCode: 229, metaKey: true }))).toBe('none');
    expect(composerEnterAction(k({ shiftKey: true }))).toBe('newline');
    expect(composerEnterAction(k({ altKey: true }))).toBe('newline');
    expect(composerEnterAction(k({ metaKey: true }))).toBe('send');
    expect(composerEnterAction(k({ ctrlKey: true }))).toBe('send');
    expect(composerEnterAction(k({ metaKey: true, shiftKey: true }))).toBe('send');
    expect(composerEnterAction(k(), { touch: true })).toBe('newline');
    expect(composerEnterAction(k({ metaKey: true }), { touch: true })).toBe('send');
    expect(composerEnterAction(k({ ctrlKey: true }), { touch: true })).toBe('send');
    expect(composerEnterAction(k({ key: 'a' }))).toBe('none');
    expect(composerEnterAction(null as unknown as KeyboardEvent)).toBe('none');
  });

  it('composerCanSend: non-space text or a file', () => {
    expect(composerCanSend('', 0)).toBe(false);
    expect(composerCanSend('  \n\t', 0)).toBe(false);
    expect(composerCanSend(undefined, 0)).toBe(false);
    expect(composerCanSend(' x ', 0)).toBe(true);
    expect(composerCanSend('', 1)).toBe(true);
  });

  it('composerAccepts: .ext, type/*, exact type, empty list', () => {
    const f = (name: string, type = '') => ({ name, type });
    expect(composerAccepts(f('a.bin'), '')).toBe(true);
    expect(composerAccepts(f('a.bin'), undefined)).toBe(true);
    expect(composerAccepts(f('a.bin'), ' , ')).toBe(true);
    expect(composerAccepts(f('Q3.PDF'), '.pdf')).toBe(true);
    expect(composerAccepts(f('q3.pdf.txt'), '.pdf')).toBe(false);
    expect(composerAccepts(f('.pdf'), '.pdf')).toBe(false);
    expect(composerAccepts(f('a', 'image/png'), 'image/*')).toBe(true);
    expect(composerAccepts(f('a', 'imagex/png'), 'image/*')).toBe(false);
    expect(composerAccepts(f('a.png', ''), 'image/*')).toBe(false);
    expect(composerAccepts(f('a', 'text/plain;charset=utf-8'), 'text/plain')).toBe(true);
    expect(composerAccepts(f('a', 'text/plainer'), 'text/plain')).toBe(false);
    expect(composerAccepts(f('a', 'TEXT/PLAIN'), ' Text/Plain ')).toBe(true);
    expect(composerAccepts(f('r.pdf'), 'image/*, .pdf')).toBe(true);
    expect(composerAccepts(f('r.doc', 'application/msword'), 'image/*, .pdf')).toBe(false);
  });

  it('composerCheckFile: count, then type, then empty, then size', () => {
    const opts = { count: 0, maxFiles: 3, maxFileSize: 10, accept: '.pdf' };
    expect(composerCheckFile({ name: 'a.txt', size: 0 }, { ...opts, count: 3 })).toBe('count');
    expect(composerCheckFile({ name: 'a.txt', size: 0 }, opts)).toBe('type');
    expect(composerCheckFile({ name: 'a.txt', size: 99 }, opts)).toBe('type');
    expect(composerCheckFile({ name: 'a.pdf', size: 0 }, opts)).toBe('empty');
    expect(composerCheckFile({ name: 'a.pdf', size: Number.NaN }, opts)).toBe('empty');
    expect(composerCheckFile({ name: 'a.pdf', size: 11 }, opts)).toBe('size');
    expect(composerCheckFile({ name: 'a.pdf', size: 10 }, opts)).toBeNull();
    expect(composerCheckFile({ name: 'a.txt', size: 1 }, { count: 0, maxFiles: 1, maxFileSize: 5 })).toBeNull();
  });

  it('composerCounterTone', () => {
    expect(composerCounterTone(5, 0)).toBe('');
    expect(composerCounterTone(5, Number.NaN)).toBe('');
    expect(composerCounterTone(89, 100)).toBe('');
    expect(composerCounterTone(90, 100)).toBe('warn');
    expect(composerCounterTone(100, 100)).toBe('warn');
    expect(composerCounterTone(101, 100)).toBe('over');
  });

  it('composerStamp, composerAudioExt and composerVoiceName', () => {
    const d = new Date(2026, 9, 30, 4, 5, 6);
    expect(composerStamp(d)).toBe('20261030-040506');
    expect(composerStamp(new Date(2027, 0, 1, 23, 59, 59))).toBe('20270101-235959');
    expect(composerAudioExt('audio/mp4')).toBe('m4a');
    expect(composerAudioExt('AUDIO/MP4;codecs=mp4a.40.2')).toBe('m4a');
    expect(composerAudioExt('audio/aac')).toBe('m4a');
    expect(composerAudioExt('audio/x-m4a')).toBe('m4a');
    expect(composerAudioExt('audio/ogg;codecs=opus')).toBe('ogg');
    expect(composerAudioExt('audio/webm;codecs=opus')).toBe('webm');
    expect(composerAudioExt('audio/mpeg')).toBe('mp3');
    expect(composerAudioExt('audio/wav')).toBe('wav');
    expect(composerAudioExt('')).toBe('webm');
    expect(composerAudioExt(undefined)).toBe('webm');
    expect(composerVoiceName(d, 'audio/mp4')).toBe('voice-20261030-040506.m4a');
    expect(composerVoiceName(d, 'audio/ogg;codecs=opus')).toBe('voice-20261030-040506.ogg');
  });

  it('composerRecorderMime: MP4 first, then Ogg, then WebM; a throwing check means no', () => {
    expect(composerRecorderMime(() => true)).toBe('audio/mp4');
    expect(composerRecorderMime((t) => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(composerRecorderMime((t) => t === 'audio/webm')).toBe('audio/webm');
    expect(composerRecorderMime(() => false)).toBe('');
    const picky = (t: string) => {
      if (t === 'audio/mp4') throw new Error('unsupported');
      return true;
    };
    expect(composerRecorderMime(picky)).toBe('audio/ogg;codecs=opus');
    expect(
      composerRecorderMime(() => {
        throw new Error('no');
      }),
    ).toBe('');
  });

  it('composerPastedName: generic clipboard images become screenshot-… names', () => {
    const d = new Date(2026, 9, 30, 4, 5, 6);
    expect(composerPastedName({ name: 'image.png', type: 'image/png' }, d)).toBe('screenshot-20261030-040506.png');
    expect(composerPastedName({ name: '', type: 'image/jpeg' }, d)).toBe('screenshot-20261030-040506.jpg');
    expect(composerPastedName({ name: 'IMAGE.JPG', type: '' }, d)).toBe('screenshot-20261030-040506.jpg');
    expect(composerPastedName({ name: 'image.webp', type: 'image/webp' }, d)).toBe('screenshot-20261030-040506.webp');
    expect(composerPastedName({ name: '', type: 'image/svg+xml' }, d)).toBe('screenshot-20261030-040506.svg');
    expect(composerPastedName({ name: '', type: '' }, d)).toBe('screenshot-20261030-040506.png');
    expect(composerPastedName({ name: 'diagram.png', type: 'image/png' }, d)).toBe('diagram.png');
    expect(composerPastedName({ name: 'notes.txt', type: 'text/plain' }, d)).toBe('notes.txt');
  });

  it('composerLevel: RMS of time-domain samples, scaled and clamped', () => {
    expect(composerLevel([])).toBe(0);
    expect(composerLevel(null as unknown as number[])).toBe(0);
    expect(composerLevel([128, 128, 128])).toBe(0);
    expect(composerLevel([140.8, 115.2, 140.8, 115.2])).toBeCloseTo(0.35, 5);
    expect(composerLevel(new Uint8Array([0, 255, 0, 255]))).toBe(1);
  });
});

// ── Rendering ──

describe('<ui-composer> render', () => {
  it('renders the field with its default name and placeholder, the built-in tools and an icon send button', () => {
    const el = mount();
    const f = field(el);
    expect(f.tagName).toBe('TEXTAREA');
    expect(f.getAttribute('aria-label')).toBe('Message');
    expect(f.placeholder).toBe('Write a message…');
    expect(f.getAttribute('rows')).toBe('2');
    expect(f.hasAttribute('readonly')).toBe(false);
    expect(f.hasAttribute('aria-describedby')).toBe(false);
    expect(q(el, '.cp-card')!.getAttribute('style')).toBe('--cp-min:2;--cp-max:10');
    expect(act(el, 'attach')?.getAttribute('aria-label')).toBe(T.attach);
    expect(act(el, 'attach')?.getAttribute('title')).toBe(T.attach);
    expect(act(el, 'image')?.getAttribute('aria-label')).toBe(T.image);
    expect(q(el, '.cp-in-image')!.getAttribute('accept')).toBe('image/*');
    expect(q(el, '.cp-in-file')!.hasAttribute('accept')).toBe(false);
    expect(sendBtn(el).getAttribute('aria-label')).toBe('Send');
    expect(sendBtn(el).getAttribute('aria-disabled')).toBe('true');
    expect(sendBtn(el).querySelector('[data-icon="arrow-up"]')).toBeTruthy();
    expect(q(el, '.cp-files')).toBeNull();
    expect(q(el, '.cp-error')!.hidden).toBe(true);
    expect(q(el, '.cp-count')).toBeNull();
    expect(q(el, '.cp-hint')).toBeNull();
    expect(q(el, '.cp-reason')).toBeNull();
    expect(q(el, '.cp-drop')!.textContent).toBe(T.drop);
  });

  it('custom placeholder, label, rows and an empty placeholder', () => {
    const el = mount({ placeholder: 'Ask for a change…', label: 'Task', minRows: 3, maxRows: 6 });
    expect(field(el).placeholder).toBe('Ask for a change…');
    expect(field(el).getAttribute('aria-label')).toBe('Task');
    expect(field(el).getAttribute('rows')).toBe('3');
    expect(q(el, '.cp-card')!.getAttribute('style')).toBe('--cp-min:3;--cp-max:6');
    set(el, { placeholder: '', minRows: 99, maxRows: 2 });
    expect(field(el).hasAttribute('placeholder')).toBe(false);
    expect(q(el, '.cp-card')!.getAttribute('style')).toBe('--cp-min:40;--cp-max:40');
    set(el, { minRows: Number.NaN, maxRows: -4 });
    expect(q(el, '.cp-card')!.getAttribute('style')).toBe('--cp-min:2;--cp-max:10');
  });

  it('built-in tools follow attach / image / voice; voice needs getUserMedia and MediaRecorder', () => {
    expect(composerCanRecord()).toBe(false);
    const el = mount({ attach: false });
    expect(act(el, 'attach')).toBeNull();
    expect(act(el, 'image')).toBeTruthy();
    expect(act(el, 'voice')).toBeNull();
    set(el, { image: false });
    expect(act(el, 'image')).toBeNull();
    expect(qa(el, '.cp-tool')).toHaveLength(0);

    stubMic({ recorder: false });
    expect(composerCanRecord()).toBe(false);
    el.renderNow();
    expect(act(el, 'voice')).toBeNull();
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    expect(composerCanRecord()).toBe(true);
    el.renderNow();
    expect(act(el, 'voice')?.getAttribute('aria-label')).toBe(T.voice);
    set(el, { voice: false });
    expect(act(el, 'voice')).toBeNull();
  });

  it('voice is hidden when only MediaRecorder exists', () => {
    stubMic({ gum: false });
    expect(composerCanRecord()).toBe(false);
    expect(act(mount(), 'voice')).toBeNull();
  });

  it('a labelled send button, the hint and its description', () => {
    const el = mount({ submitLabel: 'Start task', hint: true });
    const s = sendBtn(el);
    expect(s.classList.contains('has-label')).toBe(true);
    expect(s.hasAttribute('aria-label')).toBe(false);
    expect(s.querySelector('.cp-send-text')?.textContent).toBe('Start task');
    expect(s.querySelector('[data-icon="arrow-right"]')).toBeTruthy();
    expect(q(el, '.cp-hint')?.textContent).toBe(T.hint);
    expect(field(el).getAttribute('aria-describedby')).toBe('cp-hint');
    set(el, { submitLabel: '   ' });
    expect(sendBtn(el).getAttribute('aria-label')).toBe('Send');
  });

  it('on touch screens the hint does not describe the field', () => {
    touch(true);
    const el = mount({ hint: true });
    expect(field(el).hasAttribute('aria-describedby')).toBe(false);
  });

  it('data.value fills the field once; host updates never reset typing; value sets send no ui-input', () => {
    const el = mount({ value: 'draft' });
    const inputs = events<ComposerInputDetail>(el, 'ui-input');
    expect(field(el).value).toBe('draft');
    expect(el.value).toBe('draft');
    expect(sendBtn(el).getAttribute('aria-disabled')).toBe('false');
    type(el, 'changed');
    expect(inputs).toEqual([{ value: 'changed' }]);
    set(el, { busy: true });
    expect(field(el).value).toBe('changed');
    set(el, { busy: false, value: 'restored' });
    expect(field(el).value).toBe('restored');
    el.value = 'set by code';
    expect(field(el).value).toBe('set by code');
    expect(inputs).toHaveLength(1);
  });

  it('value set before the element is connected shows up on first render', () => {
    const el = document.createElement('ui-composer');
    el.value = 'early';
    el.data = { placeholder: 'x' };
    document.body.append(el);
    el.renderNow();
    expect(field(el).value).toBe('early');
  });

  it('typing updates the send state in place', () => {
    const el = mount();
    const before = field(el);
    type(el, '   ');
    expect(sendBtn(el).getAttribute('aria-disabled')).toBe('true');
    type(el, 'hi');
    expect(sendBtn(el).getAttribute('aria-disabled')).toBe('false');
    expect(field(el)).toBe(before);
  });
});

// ── Sending ──

describe('<ui-composer> sending', () => {
  it('Enter sends the trimmed text and the files, then the composer clears and keeps focus', () => {
    const el = mount();
    const sub = events<ComposerSubmitDetail>(el, 'ui-submit');
    const inputs = events<ComposerInputDetail>(el, 'ui-input');
    const filesEv = events<ComposerFilesDetail>(el, 'ui-files');
    const file = pdf();
    el.addFiles([file]);
    type(el, '  Summarise this\n  please  ');
    const e = key(field(el), 'Enter');
    expect(e.defaultPrevented).toBe(true);
    expect(sub).toHaveLength(1);
    expect(sub[0].text).toBe('Summarise this\n  please');
    expect(sub[0].files).toEqual([file]);
    expect(field(el).value).toBe('');
    expect(el.files).toEqual([]);
    expect(q(el, '.cp-files')).toBeNull();
    expect(inputs.at(-1)).toEqual({ value: '' });
    expect(filesEv.at(-1)).toEqual({ files: [] });
    expect(active(el)).toBe(field(el));
    expect(sendBtn(el).getAttribute('aria-disabled')).toBe('true');
  });

  it('the send button sends; ⌘/Ctrl+Enter sends', () => {
    const el = mount();
    const sub = events<ComposerSubmitDetail>(el, 'ui-submit');
    type(el, 'one');
    sendBtn(el).click();
    type(el, 'two');
    key(field(el), 'Enter', { metaKey: true });
    type(el, 'three');
    key(field(el), 'Enter', { ctrlKey: true });
    expect(sub.map((d) => d.text)).toEqual(['one', 'two', 'three']);
  });

  it('Shift+Enter, Alt+Enter and an IME composition Enter do not send', () => {
    const el = mount();
    const sub = events(el, 'ui-submit');
    type(el, '안녕');
    expect(key(field(el), 'Enter', { shiftKey: true }).defaultPrevented).toBe(false);
    expect(key(field(el), 'Enter', { altKey: true }).defaultPrevented).toBe(false);
    expect(key(field(el), 'Enter', { isComposing: true }).defaultPrevented).toBe(false);
    expect(key(field(el), 'Enter', { keyCode: 229 }).defaultPrevented).toBe(false);
    expect(sub).toHaveLength(0);
    expect(field(el).value).toBe('안녕');
  });

  it('on touch screens Enter is a new line, ⌘+Enter still sends', () => {
    touch(true);
    const el = mount();
    const sub = events(el, 'ui-submit');
    type(el, 'hello');
    expect(key(field(el), 'Enter').defaultPrevented).toBe(false);
    expect(sub).toHaveLength(0);
    key(field(el), 'Enter', { metaKey: true });
    expect(sub).toHaveLength(1);
  });

  it('nothing to send: no event, and Enter inserts no new line', () => {
    const el = mount();
    const sub = events(el, 'ui-submit');
    expect(key(field(el), 'Enter').defaultPrevented).toBe(true);
    type(el, '  \n ');
    key(field(el), 'Enter');
    sendBtn(el).click();
    expect(sub).toHaveLength(0);
  });

  it('files alone can be sent', () => {
    const el = mount();
    const sub = events<ComposerSubmitDetail>(el, 'ui-submit');
    const f = txt();
    el.addFiles([f]);
    expect(sendBtn(el).getAttribute('aria-disabled')).toBe('false');
    key(field(el), 'Enter');
    expect(sub).toEqual([{ text: '', files: [f] }]);
  });

  it('a cancelled ui-submit keeps the text and the files', () => {
    const el = mount();
    const sub = events<ComposerSubmitDetail>(el, 'ui-submit', true);
    const f = png();
    el.addFiles([f]);
    type(el, 'keep me');
    key(field(el), 'Enter');
    expect(sub).toHaveLength(1);
    expect(field(el).value).toBe('keep me');
    expect(el.files).toEqual([f]);
    expect(qa(el, '.cp-chip')).toHaveLength(1);
    el.clear();
    expect(field(el).value).toBe('');
    expect(el.files).toEqual([]);
  });

  it('busy: aria-busy spinner, send off, text editable', () => {
    const el = mount({ busy: true, value: 'Draft the plan' });
    const sub = events(el, 'ui-submit');
    const s = sendBtn(el);
    expect(q(el, '.cp')!.hasAttribute('data-busy')).toBe(true);
    expect(s.getAttribute('aria-busy')).toBe('true');
    expect(s.getAttribute('aria-disabled')).toBe('true');
    expect(s.querySelector('.cp-spin')).toBeTruthy();
    expect(field(el).hasAttribute('readonly')).toBe(false);
    expect(act(el, 'attach')!.disabled).toBe(false);
    key(field(el), 'Enter');
    s.click();
    expect(sub).toHaveLength(0);
    type(el, 'Draft the plan, then the tests');
    expect(field(el).value).toBe('Draft the plan, then the tests');
    expect(sendBtn(el).getAttribute('aria-disabled')).toBe('true');
    set(el, { submitLabel: 'Start task' });
    expect(sendBtn(el).querySelector('.cp-spin')).toBeTruthy();
    expect(sendBtn(el).querySelector('[data-icon="arrow-right"]')).toBeNull();
    set(el, { busy: false });
    expect(sendBtn(el).hasAttribute('aria-busy')).toBe(false);
    expect(sendBtn(el).getAttribute('aria-disabled')).toBe('false');
  });

  it('disabled: readonly field, tools off, the reason shown and linked, nothing sends', () => {
    const el = mount({
      value: 'Rerun the import',
      disabled: 'This conversation has ended.',
      tools: [{ id: 'plan', label: 'Plan', pressed: false }],
    });
    el.addFiles([txt()]);
    const sub = events(el, 'ui-submit');
    const toolEv = events(el, 'ui-tool');
    expect(q(el, '.cp')!.hasAttribute('data-disabled')).toBe(true);
    expect(field(el).hasAttribute('readonly')).toBe(true);
    expect(qa(el, '.cp-tool').every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    expect(q<HTMLButtonElement>(el, '.cp-remove')!.disabled).toBe(true);
    expect(q(el, '.cp-reason')?.textContent).toBe('This conversation has ended.');
    expect(field(el).getAttribute('aria-describedby')).toContain('cp-reason');
    expect(sendBtn(el).getAttribute('aria-disabled')).toBe('true');
    key(field(el), 'Enter');
    sendBtn(el).click();
    el.removeFile(5);
    expect(sub).toHaveLength(0);
    expect(toolEv).toHaveLength(0);
    set(el, { disabled: true });
    expect(q(el, '.cp-reason')).toBeNull();
    expect(field(el).hasAttribute('readonly')).toBe(true);
  });

  it('maxLength: a counter with warn and over tones; over the limit blocks send', () => {
    const el = mount({ maxLength: 10 });
    const sub = events(el, 'ui-submit');
    const count = () => q(el, '.cp-count')!;
    expect(count().textContent).toBe('0 / 10');
    expect(count().getAttribute('data-tone')).toBe('');
    expect(field(el).getAttribute('aria-describedby')).toBe('cp-count');
    type(el, 'abcdefgh');
    expect(count().textContent).toBe('8 / 10');
    expect(count().getAttribute('data-tone')).toBe('');
    type(el, 'abcdefghi');
    expect(count().getAttribute('data-tone')).toBe('warn');
    type(el, 'abcdefghijk');
    expect(count().textContent).toBe('11 / 10');
    expect(count().getAttribute('data-tone')).toBe('over');
    expect(sendBtn(el).getAttribute('aria-disabled')).toBe('true');
    key(field(el), 'Enter');
    expect(sub).toHaveLength(0);
    type(el, 'abcdefghij');
    key(field(el), 'Enter');
    expect(sub).toHaveLength(1);
    set(el, { maxLength: 4000 });
    expect(count().textContent).toBe('0 / 4,000');
  });
});

// ── Files ──

describe('<ui-composer> files', () => {
  it('chips show the name and ext · size; images get an object-URL thumbnail', () => {
    const el = mount();
    const filesEv = events<ComposerFilesDetail>(el, 'ui-files');
    const live = el.shadowRoot!.querySelector('[role="status"]')!;
    const taken = el.addFiles([png('chart.png'), pdf('q3-report.pdf', 1234), mk('README', 10), mk('', 5)]);
    expect(taken).toHaveLength(4);
    expect(filesEv).toHaveLength(1);
    expect(filesEv[0].files.map((f) => f.name)).toEqual(['chart.png', 'q3-report.pdf', 'README', '']);
    expect(live.textContent).toBe('4 files attached');
    const chips = qa(el, '.cp-chip');
    expect(chips).toHaveLength(4);
    expect(q(el, '.cp-files')!.getAttribute('aria-label')).toBe(T.attachments);
    expect(chips[0].querySelector('.cp-name')?.textContent).toBe('chart.png');
    expect(chips[0].querySelector('.cp-meta')?.textContent).toBe('PNG · 10 B');
    const thumb = chips[0].querySelector<HTMLImageElement>('img.cp-thumb')!;
    expect(thumb.getAttribute('src')).toBe('blob:test/1');
    expect(thumb.getAttribute('alt')).toBe('');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(chips[1].querySelector('.cp-meta')?.textContent).toBe('PDF · 1.2 KB');
    expect(chips[1].querySelector('img')).toBeNull();
    expect(chips[1].querySelector('.cp-tile [data-icon="file-text"]')).toBeTruthy();
    expect(chips[2].querySelector('.cp-meta')?.textContent).toBe('10 B');
    expect(chips[3].querySelector('.cp-name')?.textContent).toBe(T.untitled);
    expect(chips[0].querySelector('.cp-remove')?.getAttribute('aria-label')).toBe('Remove chart.png');
    expect(chips[0].querySelector('.cp-name')?.getAttribute('title')).toBe('chart.png');
    el.renderNow();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(el.addFiles([txt('one.txt')])).toHaveLength(1);
    expect(live.textContent).toBe('one.txt attached');
  });

  it('addFiles accepts up to the limits and rejects with ui-reject reasons and an inline error', () => {
    const el = mount({ maxFiles: 2, accept: 'image/*,.pdf', maxFileSize: 100 });
    const rej = events<ComposerRejectDetail>(el, 'ui-reject');
    const a = png('a.png');
    const b = pdf('b.pdf', 50);
    const c = png('c.png');
    expect(el.addFiles([a, b, c])).toEqual([a, b]);
    expect(rej).toEqual([{ name: 'c.png', reason: 'count', file: c }]);
    expect(errorText(el)).toBe('Too many files (max 2)');
    expect(q(el, '.cp-error')!.getAttribute('role')).toBe('alert');
    expect(field(el).getAttribute('aria-describedby')).toBe('cp-error');
    // Typing clears the error line.
    type(el, 'x');
    expect(errorText(el)).toBe('');
    expect(field(el).hasAttribute('aria-describedby')).toBe(false);
  });

  it('type, empty and size rejections name the file; more than one adds a count', () => {
    const el = mount({ accept: 'image/*,.pdf', maxFileSize: 100 });
    const rej = events<ComposerRejectDetail>(el, 'ui-reject');
    el.addFiles([txt('notes.txt')]);
    expect(errorText(el)).toBe('notes.txt — Unsupported file type');
    el.addFiles([png('blank.png', 0)]);
    expect(errorText(el)).toBe('blank.png — Empty file');
    el.addFiles([png('big.png', 200)]);
    expect(errorText(el)).toBe('big.png — File too large (max 100 B)');
    el.addFiles([png('big.png', 200), txt('x.txt'), png('ok.png')]);
    expect(errorText(el)).toBe('big.png — File too large (max 100 B) (+1 more)');
    expect(rej.map((r) => r.reason)).toEqual(['type', 'empty', 'size', 'size', 'type']);
    expect(el.files.map((f) => f.name)).toEqual(['ok.png']);
    // A clean add clears the error.
    el.addFiles([png('fine.png')]);
    expect(errorText(el)).toBe('');
    expect(el.addFiles(null)).toEqual([]);
    expect(el.addFiles([{} as File, 'x' as unknown as File])).toEqual([]);
  });

  it('files added later scroll the chip row to its end; files there on first paint start at the first chip', () => {
    const early = document.createElement('ui-composer');
    early.addFiles([
      new File(['a'], 'a.txt', { type: 'text/plain' }),
      new File(['b'], 'b.txt', { type: 'text/plain' }),
    ]);
    document.body.append(early);
    early.renderNow();
    const row = early.shadowRoot!.querySelector<HTMLElement>('.cp-files')!;
    Object.defineProperty(row, 'scrollWidth', { value: 900, configurable: true });
    expect(row.scrollLeft).toBe(0);
    early.addFiles([new File(['c'], 'c.txt', { type: 'text/plain' })]);
    early.renderNow();
    const after = early.shadowRoot!.querySelector<HTMLElement>('.cp-files')!;
    expect(after).toBe(row);
    expect(row.scrollLeft).toBeGreaterThan(0);
  });

  it('removeFile and the remove button send ui-files and revoke the object URL', () => {
    const el = mount();
    const filesEv = events<ComposerFilesDetail>(el, 'ui-files');
    el.addFiles([png('a.png'), txt('b.txt'), png('c.png')]);
    expect(created).toEqual(['blob:test/1', 'blob:test/2']);
    el.removeFile(0);
    expect(revoked).toEqual(['blob:test/1']);
    expect(filesEv.at(-1)!.files.map((f) => f.name)).toEqual(['b.txt', 'c.png']);
    el.removeFile(9);
    el.removeFile(-1);
    expect(filesEv).toHaveLength(2);
    q<HTMLButtonElement>(el, '.cp-remove')!.click();
    expect(filesEv.at(-1)!.files.map((f) => f.name)).toEqual(['c.png']);
    expect(el.shadowRoot!.querySelector('[role="status"]')!.textContent).toBe('b.txt removed');
    expect(qa(el, '.cp-chip')).toHaveLength(1);
  });

  it('removing with the keyboard moves focus to the next chip, then to the field', () => {
    const el = mount();
    el.addFiles([txt('a.txt'), txt('b.txt')]);
    const first = qa(el, '.cp-remove')[0];
    first.focus();
    expect(active(el)).toBe(first);
    first.click();
    expect(active(el)?.getAttribute('aria-label')).toBe('Remove b.txt');
    active(el)!.click();
    expect(active(el)).toBe(field(el));
  });

  it('object URLs are revoked on clear() and on disconnect', () => {
    const el = mount();
    el.addFiles([png('a.png'), png('b.png')]);
    el.clear();
    expect(revoked).toEqual(['blob:test/1', 'blob:test/2']);
    el.addFiles([png('c.png')]);
    expect(created.at(-1)).toBe('blob:test/3');
    el.remove();
    expect(revoked).toEqual(['blob:test/1', 'blob:test/2', 'blob:test/3']);
    // Re-attached: a fresh URL.
    document.body.append(el);
    el.renderNow();
    expect(q(el, 'img.cp-thumb')!.getAttribute('src')).toBe('blob:test/4');
  });

  it('an audio chip has a play button that toggles', () => {
    const el = mount();
    el.addFiles([wav('memo.wav')]);
    const play = () => q<HTMLButtonElement>(el, '.cp-play')!;
    expect(play().getAttribute('aria-label')).toBe('Play memo.wav');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    play().click();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(play().getAttribute('aria-label')).toBe('Stop memo.wav');
    play().click();
    expect(play().getAttribute('aria-label')).toBe('Play memo.wav');
    play().click();
    el.removeFile(0);
    expect(revoked).toEqual(['blob:test/1']);
  });

  it('paste attaches clipboard files under a screenshot-… name; plain text is left alone', () => {
    const el = mount();
    const filesEv = events<ComposerFilesDetail>(el, 'ui-files');
    const e = paste([png('image.png')]);
    field(el).dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    const name = el.files[0].name;
    expect(name).toMatch(/^screenshot-\d{8}-\d{6}\.png$/);
    expect(STAMP.test(name.slice(11, 26))).toBe(true);
    expect(el.files[0].type).toBe('image/png');
    expect(filesEv).toHaveLength(1);
    // Text that came with an image still pastes as text.
    const withText = paste([png('diagram.png')], 'Q3 chart');
    field(el).dispatchEvent(withText);
    expect(withText.defaultPrevented).toBe(false);
    expect(el.files.map((f) => f.name)[1]).toBe('diagram.png');
    // No files: the browser pastes the text.
    const plain = paste([], 'just text');
    field(el).dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
    expect(el.files).toHaveLength(2);
  });

  it('paste is ignored while disabled and goes through the limits', () => {
    const el = mount({ disabled: true });
    field(el).dispatchEvent(paste([png()]));
    expect(el.files).toHaveLength(0);
    set(el, { disabled: false, accept: '.pdf' });
    const rej = events<ComposerRejectDetail>(el, 'ui-reject');
    field(el).dispatchEvent(paste([png('image.png')]));
    expect(rej[0].reason).toBe('type');
    expect(rej[0].name).toMatch(/^screenshot-/);
  });

  it('dragging files shows the drop wash; dropping attaches them', () => {
    const el = mount();
    const card = () => q(el, '.cp-card')!;
    const enter = drag('dragenter');
    el.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(card().hasAttribute('data-drag')).toBe(true);
    // Entering a child first: the counter keeps the wash on.
    el.dispatchEvent(drag('dragenter'));
    el.dispatchEvent(drag('dragleave'));
    expect(card().hasAttribute('data-drag')).toBe(true);
    el.dispatchEvent(drag('dragleave'));
    expect(card().hasAttribute('data-drag')).toBe(false);
    const over = drag('dragover');
    el.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    expect((over as Event & { dataTransfer: { dropEffect: string } }).dataTransfer.dropEffect).toBe('copy');
    expect(card().hasAttribute('data-drag')).toBe(true);
    // A re-render keeps the wash while dragging.
    el.renderNow();
    expect(card().hasAttribute('data-drag')).toBe(true);
    const f = pdf('dropped.pdf');
    const drop = drag('drop', [f]);
    el.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(true);
    expect(card().hasAttribute('data-drag')).toBe(false);
    expect(el.files).toEqual([f]);
  });

  it('drags without files, and drags while disabled, are ignored', () => {
    const el = mount();
    const text = drag('dragenter', [], ['text/plain']);
    el.dispatchEvent(text);
    expect(text.defaultPrevented).toBe(false);
    expect(q(el, '.cp-card')!.hasAttribute('data-drag')).toBe(false);
    el.dispatchEvent(drag('drop', [pdf()], ['text/plain']));
    expect(el.files).toHaveLength(0);
    set(el, { disabled: 'Read only' });
    const enter = drag('dragenter');
    el.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    const drop = drag('drop', [pdf()]);
    el.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(false);
    expect(el.files).toHaveLength(0);
  });

  it('the picker inputs attach what was chosen', () => {
    const el = mount({ accept: '.pdf' });
    const input = q<HTMLInputElement>(el, '.cp-in-file')!;
    expect(input.getAttribute('accept')).toBe('.pdf');
    const clicked = vi.fn();
    input.addEventListener('click', clicked);
    act(el, 'attach')!.click();
    expect(clicked).toHaveBeenCalledTimes(1);
    const f = pdf();
    Object.defineProperty(input, 'files', { value: [f], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(el.files).toEqual([f]);
  });
});

// ── Host tools ──

describe('<ui-composer> host tools', () => {
  const tools = () => [
    { id: 'plan', label: 'Plan first', icon: 'list' as const, showLabel: true, pressed: false },
    { id: 'model', label: 'Pick a model', icon: 'bot' as const },
    { id: 'web', label: 'Web' },
    { id: 'off', label: 'Off', disabled: true },
    { id: 'plan', label: 'duplicate' },
  ];
  const tool = (el: UiComposer, id: string) =>
    qa(el, '[data-act="tool"]').find((b) => b.dataset.id === id) as HTMLButtonElement | undefined;

  it('renders toggles, icon tools and text tools after the built-in ones', () => {
    const el = mount({ tools: tools() });
    expect(qa(el, '[data-act="tool"]').map((b) => b.dataset.id)).toEqual(['plan', 'model', 'web', 'off']);
    expect(qa(el, '.cp-tool').map((b) => b.dataset.act)).toEqual(['attach', 'image', 'tool', 'tool', 'tool', 'tool']);
    const plan = tool(el, 'plan')!;
    expect(plan.getAttribute('aria-pressed')).toBe('false');
    expect(plan.textContent).toBe('Plan first');
    expect(plan.querySelector('[data-icon="list"]')).toBeTruthy();
    expect(plan.hasAttribute('aria-label')).toBe(false);
    const model = tool(el, 'model')!;
    expect(model.getAttribute('aria-label')).toBe('Pick a model');
    expect(model.getAttribute('title')).toBe('Pick a model');
    expect(model.hasAttribute('aria-pressed')).toBe(false);
    expect(model.classList.contains('is-icon')).toBe(true);
    expect(tool(el, 'web')!.textContent).toBe('Web');
    expect(tool(el, 'off')!.disabled).toBe(true);
  });

  it('ui-tool: actions send the id; toggles ask for the flip and show it at once', () => {
    const el = mount({ tools: tools() });
    const ev = events<ComposerToolDetail>(el, 'ui-tool');
    tool(el, 'model')!.click();
    expect(ev).toEqual([{ id: 'model' }]);
    tool(el, 'plan')!.click();
    expect(ev[1]).toEqual({ id: 'plan', pressed: true });
    expect(tool(el, 'plan')!.getAttribute('aria-pressed')).toBe('true');
    tool(el, 'plan')!.click();
    expect(ev[2]).toEqual({ id: 'plan', pressed: false });
    expect(tool(el, 'plan')!.getAttribute('aria-pressed')).toBe('false');
    tool(el, 'off')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(ev).toHaveLength(3);
  });

  it('a cancelled ui-tool keeps the toggle; new host tools are the truth again', () => {
    const el = mount({ tools: tools() });
    events(el, 'ui-tool', true);
    tool(el, 'plan')!.click();
    expect(tool(el, 'plan')!.getAttribute('aria-pressed')).toBe('false');
    const host = mount({ tools: tools() });
    tool(host, 'plan')!.click();
    expect(tool(host, 'plan')!.getAttribute('aria-pressed')).toBe('true');
    set(host, { tools: tools().map((t) => (t.id === 'plan' ? { ...t, pressed: false } : t)) });
    expect(tool(host, 'plan')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('a host that answers in its listener stays in charge', () => {
    const el = mount({ tools: tools() });
    el.addEventListener('ui-tool', (e) => {
      const { id, pressed } = (e as CustomEvent<ComposerToolDetail>).detail;
      const d = el.data ?? {};
      el.data = { ...d, tools: (d.tools ?? []).map((t) => (t.id === id ? { ...t, pressed: !!pressed } : t)) };
    });
    tool(el, 'plan')!.click();
    expect(tool(el, 'plan')!.getAttribute('aria-pressed')).toBe('true');
    tool(el, 'plan')!.click();
    expect(tool(el, 'plan')!.getAttribute('aria-pressed')).toBe('false');
  });
});

// ── Voice recorder ──

describe('<ui-composer> voice recorder', () => {
  it('start: waiting state, then the recorder bar with a timer, Cancel and Done; focus on Done', async () => {
    const gum = stubMic();
    const el = mount();
    const rec = events<ComposerRecordDetail>(el, 'ui-record');
    act(el, 'voice')!.click();
    expect(gum).toHaveBeenCalledWith({ audio: true });
    expect(act(el, 'voice')!.getAttribute('aria-busy')).toBe('true');
    expect(act(el, 'voice')!.getAttribute('aria-label')).toBe(T.waiting);
    await tick();
    expect(rec).toEqual([{ state: 'start' }]);
    const bar = q(el, '.cp-rec')!;
    expect(bar.getAttribute('role')).toBe('group');
    expect(bar.getAttribute('aria-label')).toBe('Recording');
    const time = q(el, '.cp-rec-time')!;
    expect(time.getAttribute('role')).toBe('timer');
    expect(time.textContent).toBe('0:00');
    expect(act(el, 'rec-cancel')!.textContent).toBe('Cancel');
    expect(act(el, 'rec-done')!.textContent).toBe('Done');
    expect(q(el, '.cp-bar')).toBeNull();
    expect(active(el)).toBe(act(el, 'rec-done'));
    expect(FakeRecorder.last!.mimeType).toBe('audio/mp4');
    expect(FakeRecorder.last!.state).toBe('recording');
    expect(FakeRecorder.last!.slice).toBe(1000);
  });

  it('Done files a voice-….m4a note and reports ui-record stop with the file', async () => {
    stubMic();
    const el = mount();
    const rec = events<ComposerRecordDetail>(el, 'ui-record');
    const filesEv = events<ComposerFilesDetail>(el, 'ui-files');
    await startRec(el);
    act(el, 'rec-done')!.click();
    expect(streams[0].tracks[0].stopped).toBe(true);
    expect(q(el, '.cp-rec')).toBeNull();
    expect(q(el, '.cp-bar')).toBeTruthy();
    expect(active(el)).toBe(field(el));
    await tick();
    expect(el.files).toHaveLength(1);
    const f = el.files[0];
    expect(f.name).toMatch(/^voice-\d{8}-\d{6}\.m4a$/);
    expect(f.type).toBe('audio/mp4');
    expect(f.size).toBeGreaterThan(0);
    expect(rec.map((r) => r.state)).toEqual(['start', 'stop']);
    expect(rec[1].file).toBe(f);
    expect(rec[1].durationMs).toBeGreaterThanOrEqual(0);
    expect(filesEv.at(-1)!.files).toEqual([f]);
    expect(q(el, '.cp-chip .cp-meta')!.textContent).toBe(`${T.voiceNote} · 0:01`);
    expect(q(el, '.cp-chip .cp-play')!.getAttribute('aria-label')).toBe(`Play ${f.name}`);
  });

  it('a browser without MP4 records Ogg and names the note .ogg', async () => {
    stubMic();
    FakeRecorder.supported = ['audio/ogg;codecs=opus'];
    const el = mount();
    await startRec(el);
    act(el, 'rec-done')!.click();
    await tick();
    expect(el.files[0].name).toMatch(/^voice-\d{8}-\d{6}\.ogg$/);
    expect(el.files[0].type).toBe('audio/ogg');
  });

  it('Cancel discards the recording', async () => {
    stubMic();
    const el = mount();
    const rec = events<ComposerRecordDetail>(el, 'ui-record');
    const filesEv = events(el, 'ui-files');
    await startRec(el);
    act(el, 'rec-cancel')!.click();
    await tick();
    expect(rec.map((r) => r.state)).toEqual(['start', 'cancel']);
    expect(el.files).toHaveLength(0);
    expect(filesEv).toHaveLength(0);
    expect(streams[0].tracks[0].stopped).toBe(true);
    expect(q(el, '.cp-rec')).toBeNull();
    expect(act(el, 'voice')).toBeTruthy();
  });

  it('Escape discards the recording', async () => {
    stubMic();
    const el = mount();
    const rec = events<ComposerRecordDetail>(el, 'ui-record');
    await startRec(el);
    const e = key(act(el, 'rec-done')!, 'Escape');
    expect(e.defaultPrevented).toBe(true);
    await tick();
    expect(rec.map((r) => r.state)).toEqual(['start', 'cancel']);
    expect(el.files).toHaveLength(0);
    // Not recording: Escape is left alone.
    expect(key(field(el), 'Escape').defaultPrevented).toBe(false);
  });

  it('a denied microphone reports ui-record error and the inline error', async () => {
    stubMic({ fail: Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }) });
    const el = mount();
    const rec = events<ComposerRecordDetail>(el, 'ui-record');
    await startRec(el);
    expect(rec).toEqual([{ state: 'error', error: 'NotAllowedError' }]);
    expect(errorText(el)).toBe('Microphone unavailable');
    expect(q(el, '.cp-rec')).toBeNull();
    expect(act(el, 'voice')!.hasAttribute('aria-busy')).toBe(false);
    expect(act(el, 'voice')!.getAttribute('aria-label')).toBe(T.voice);
  });

  it('sending while recording files the note first, then submits text and note together', async () => {
    stubMic();
    const el = mount();
    const sub = events<ComposerSubmitDetail>(el, 'ui-submit');
    await startRec(el);
    type(el, 'Listen to this');
    key(field(el), 'Enter');
    expect(sub).toHaveLength(0);
    await tick();
    expect(sub).toHaveLength(1);
    expect(sub[0].text).toBe('Listen to this');
    expect(sub[0].files).toHaveLength(1);
    expect(sub[0].files[0].name).toMatch(/^voice-/);
    expect(field(el).value).toBe('');
    expect(el.files).toHaveLength(0);
  });

  it('the timer counts up in place; maxRecordMs stops and keeps the note', async () => {
    const realNow = Date.now.bind(Date);
    let offset = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + offset);
    stubMic();
    const el = mount({ maxRecordMs: 5000 });
    const rec = events<ComposerRecordDetail>(el, 'ui-record');
    await startRec(el);
    const time = q(el, '.cp-rec-time')!;
    offset = 2100;
    await until(() => time.textContent === '0:02');
    expect(time.textContent).toBe('0:02');
    expect(q(el, '.cp-rec-time')).toBe(time);
    offset = 6000;
    await until(() => rec.some((r) => r.state === 'stop'));
    expect(rec.map((r) => r.state)).toEqual(['start', 'stop']);
    expect(rec[1].durationMs).toBeGreaterThanOrEqual(5000);
    expect(el.files).toHaveLength(1);
    expect(q(el, '.cp-chip .cp-meta')!.textContent).toMatch(/^Voice note · 0:0[67]$/);
  });

  it('the level meter follows the microphone', async () => {
    stubMic();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const el = mount();
    await startRec(el);
    const level = q(el, '.cp-level')!;
    await until(() => level.getAttribute('style') === 'transform:scaleX(1.000)');
    expect(level.getAttribute('style')).toBe('transform:scaleX(1.000)');
    act(el, 'rec-cancel')!.click();
    expect(FakeAudioContext.last!.closed).toBe(true);
  });

  it('disabling the composer discards a recording; disconnecting does too', async () => {
    stubMic();
    const el = mount();
    const rec = events<ComposerRecordDetail>(el, 'ui-record');
    await startRec(el);
    set(el, { disabled: true });
    expect(rec.map((r) => r.state)).toEqual(['start', 'cancel']);
    expect(q(el, '.cp-rec')).toBeNull();
    expect(streams[0].tracks[0].stopped).toBe(true);
    set(el, { disabled: false });
    await startRec(el);
    el.remove();
    await tick();
    expect(rec.map((r) => r.state)).toEqual(['start', 'cancel', 'start', 'cancel']);
    expect(streams[1].tracks[0].stopped).toBe(true);
    expect(el.files).toHaveLength(0);
  });

  it('a microphone that answers after the composer left is released at once', async () => {
    let answer: (s: FakeStream) => void = () => {};
    const gum = vi.fn(
      () =>
        new Promise<FakeStream>((r) => {
          answer = r;
        }),
    );
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: gum }, configurable: true });
    const el = mount();
    const rec = events(el, 'ui-record');
    act(el, 'voice')!.click();
    el.remove();
    const late = new FakeStream();
    answer(late);
    await tick();
    expect(late.tracks[0].stopped).toBe(true);
    expect(rec).toHaveLength(0);
    expect(FakeRecorder.last).toBeNull();
  });

  it('clear() discards a recording', async () => {
    stubMic();
    const el = mount();
    const rec = events<ComposerRecordDetail>(el, 'ui-record');
    await startRec(el);
    el.clear();
    await tick();
    expect(rec.map((r) => r.state)).toEqual(['start', 'cancel']);
    expect(el.files).toHaveLength(0);
  });
});

// ── Escaping ──

describe('<ui-composer> escaping', () => {
  it('escapes placeholder, label, file names, tool labels and ids, the reason and the send label', () => {
    const el = mount({
      placeholder: XSS,
      label: XSS,
      disabled: XSS,
      submitLabel: XSS,
      tools: [
        { id: XSS, label: XSS, icon: 'list', showLabel: true, pressed: false },
        { id: 'icon-only', label: XSS, icon: 'bot' },
      ],
    });
    el.addFiles([txt(XSS), wav(`${XSS}.wav`)]);
    const root = el.shadowRoot!;
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('[onerror]')).toBeNull();
    expect(root.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(field(el).placeholder).toBe(XSS);
    expect(field(el).getAttribute('aria-label')).toBe(XSS);
    expect(q(mount({ accept: `${XSS}"'` }), '.cp-in-file')!.getAttribute('accept')).toBe(`${XSS}"'`);
    expect(q(el, '.cp-reason span')!.textContent).toBe(XSS);
    expect(q(el, '.cp-send-text')!.textContent).toBe(XSS);
    const names = qa(el, '.cp-name');
    expect(names[0].textContent).toBe(XSS);
    expect(names[0].getAttribute('title')).toBe(XSS);
    expect(qa(el, '.cp-remove')[0].getAttribute('aria-label')).toBe(`Remove ${XSS}`);
    expect(q(el, '.cp-play')!.getAttribute('aria-label')).toBe(`Play ${XSS}.wav`);
    const tools = qa(el, '[data-act="tool"]');
    expect(tools[0].dataset.id).toBe(XSS);
    expect(tools[0].textContent).toBe(XSS);
    expect(tools[1].getAttribute('aria-label')).toBe(XSS);
    expect(tools[1].getAttribute('title')).toBe(XSS);
    expect(root.querySelector('[role="status"]')!.textContent).toBe('2 files attached');
  });

  it('escapes file names in the error line and the status region; tool ids round-trip', () => {
    const el = mount({ accept: '.pdf', tools: [{ id: XSS, label: 'x' }] });
    const ev = events<ComposerToolDetail>(el, 'ui-tool');
    el.addFiles([txt(XSS)]);
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    expect(q(el, '.cp-error span')!.textContent).toBe(`${XSS} — Unsupported file type`);
    set(el, { accept: '' });
    el.addFiles([txt(XSS)]);
    expect(el.shadowRoot!.querySelector('[role="status"]')!.textContent).toBe(`${XSS} attached`);
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    q<HTMLButtonElement>(el, '[data-act="tool"]')!.click();
    expect(ev).toEqual([{ id: XSS }]);
  });
});

// ── Korean ──

describe('<ui-composer> lang="ko"', () => {
  it('Korean field, tools, send, hint, remove and error texts', () => {
    const el = mount({ hint: true, maxFiles: 1 }, { lang: 'ko' });
    expect(field(el).placeholder).toBe('메시지 입력…');
    expect(field(el).getAttribute('aria-label')).toBe('메시지');
    expect(sendBtn(el).getAttribute('aria-label')).toBe('보내기');
    expect(act(el, 'attach')!.getAttribute('aria-label')).toBe('파일 첨부');
    expect(act(el, 'image')!.getAttribute('aria-label')).toBe('이미지 추가');
    expect(q(el, '.cp-hint')!.textContent).toBe('Enter로 보내기 · Shift+Enter로 줄바꿈');
    expect(q(el, '.cp-drop')!.textContent).toBe(KO.drop);
    el.addFiles([txt('메모.txt'), txt('b.txt')]);
    expect(q(el, '.cp-remove')!.getAttribute('aria-label')).toBe('메모.txt 삭제');
    expect(q(el, '.cp-files')!.getAttribute('aria-label')).toBe('첨부 파일');
    expect(errorText(el)).toBe('파일은 최대 1개');
    expect(el.shadowRoot!.querySelector('[role="status"]')!.textContent).toBe('메모.txt 첨부됨');
  });

  it('Korean rejections, multiple-file notes and the microphone error', async () => {
    const el = mount({ accept: '.pdf', maxFileSize: 5 }, { lang: 'ko' });
    el.addFiles([txt('메모.txt')]);
    expect(errorText(el)).toBe('메모.txt — 지원하지 않는 형식');
    el.addFiles([pdf('큰.pdf', 50), pdf('b.pdf', 50)]);
    expect(errorText(el)).toBe('큰.pdf — 파일이 너무 큽니다 (최대 5 B) (외 1개)');
    el.addFiles([pdf('빈.pdf', 0)]);
    expect(errorText(el)).toBe('빈.pdf — 빈 파일입니다');
    stubMic({ fail: new Error('nope') });
    el.renderNow();
    expect(act(el, 'voice')!.getAttribute('aria-label')).toBe('음성 녹음');
    await startRec(el);
    expect(errorText(el)).toBe('마이크를 쓸 수 없습니다');
  });

  it('Korean recorder bar, and the lang attribute switches the copy', async () => {
    stubMic();
    const el = mount(undefined, { lang: 'ko' });
    await startRec(el);
    expect(q(el, '.cp-rec')!.getAttribute('aria-label')).toBe('녹음 중');
    expect(act(el, 'rec-cancel')!.textContent).toBe('취소');
    expect(act(el, 'rec-done')!.textContent).toBe('완료');
    act(el, 'rec-done')!.click();
    await tick();
    expect(q(el, '.cp-chip .cp-meta')!.textContent).toBe('음성 메모 · 0:01');
    el.setAttribute('lang', 'en');
    el.renderNow();
    expect(field(el).placeholder).toBe('Write a message…');
    expect(q(el, '.cp-chip .cp-meta')!.textContent).toBe('Voice note · 0:01');
  });
});

// ── Styles ──

describe('styles', () => {
  it('tokens and color-mix() only; hover changes colour, never motion; press 0.97; spinner 0.9s', () => {
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    expect(styles).not.toMatch(/:hover[^}]*(transform|translate|scale)/);
    const hover = styles.match(/@media \(hover: hover\) and \(pointer: fine\) \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(hover).toContain('.cp-send:not([aria-disabled="true"]):hover');
    expect(hover).not.toMatch(/transform|translate|scale/);
    // Every :hover rule sits inside the gated block.
    expect(styles.replace(hover, '')).not.toContain(':hover');
    expect(styles).toContain('transform: scale(0.97)');
    expect(styles).toContain('animation: cp-spin 0.9s linear infinite');
    expect(styles).toMatch(/\.cp-send \{[^}]*background: var\(--ib-text\); color: var\(--ib-card\)/);
    expect(styles).toContain('color-mix(in srgb');
  });

  it('44px targets on coarse pointers', () => {
    const coarse = styles.match(/@media \(pointer: coarse\) \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(coarse).toContain('.cp-tool { min-width: 44px; height: 44px; }');
    expect(coarse).toContain('.cp-send { width: 44px; height: 44px; }');
    expect(coarse).toContain('.cp-remove, .cp-play { width: 44px; height: 44px; }');
    expect(coarse).toMatch(/\.cp-rec-btn \{ min-width: 44px; height: 44px;/);
    expect(coarse).toContain('.cp-field { font-size: 16px; }');
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    spy = soundSpy();
  });
  afterEach(() => spy.restore());
  const click = (b: Element | null | undefined) =>
    b?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail: 1 }));
  const tool = (el: UiComposer, id: string) => qa(el, '[data-act="tool"]').find((b) => b.dataset.id === id);

  it('sending taps — Enter or the send button; a prevented ui-submit is silent', async () => {
    const el = mount();
    type(el, 'Hello');
    key(field(el), 'Enter');
    await spy.settle();
    type(el, 'Again');
    click(sendBtn(el));
    await spy.settle();
    expect(spy.calls).toEqual([
      ['tap', { input: 'keyboard' }],
      ['tap', { input: 'mouse' }],
    ]);
    el.addEventListener('ui-submit', (e) => e.preventDefault());
    type(el, 'Kept');
    key(field(el), 'Enter');
    await spy.settle();
    expect(spy.calls).toHaveLength(2);
  });

  it('keystrokes play type only while typing sounds are on; the Enter that sends taps instead', async () => {
    const el = mount();
    key(field(el), 'a');
    await spy.settle();
    expect(spy.calls).toEqual([]);
    spy.restore();
    spy = soundSpy({ typing: true });
    key(field(el), 'a');
    await spy.settle();
    key(field(el), 'Enter', { shiftKey: true });
    await spy.settle();
    type(el, 'Hello');
    key(field(el), 'Enter');
    await spy.settle();
    expect(spy.calls).toEqual([
      ['type', { key: 'printable', input: 'keyboard' }],
      ['type', { key: 'enter', input: 'keyboard' }],
      ['tap', { input: 'keyboard' }],
    ]);
  });

  it('a tool plays select, a toggle tool toggle by its new state; a prevented ui-tool is silent', async () => {
    const el = mount({
      tools: [
        { id: 'plan', label: 'Plan first', pressed: false },
        { id: 'model', label: 'Model' },
      ],
    });
    click(tool(el, 'model'));
    await spy.settle();
    click(tool(el, 'plan'));
    await spy.settle();
    click(tool(el, 'plan'));
    await spy.settle();
    expect(spy.calls).toEqual([
      ['select', { input: 'mouse' }],
      ['toggle', { direction: 'forward', input: 'mouse' }],
      ['toggle', { direction: 'back', input: 'mouse' }],
    ]);
    el.addEventListener('ui-tool', (e) => e.preventDefault());
    click(tool(el, 'model'));
    click(tool(el, 'plan'));
    await spy.settle();
    expect(spy.calls).toHaveLength(3);
  });

  it('removing an attachment closes subtly; a refused file plays a subtle error; the file API is silent', async () => {
    const el = mount({ maxFiles: 1 });
    el.addFiles([pdf(), txt()]);
    el.renderNow();
    await spy.settle();
    expect(spy.calls).toEqual([]);
    click(q(el, '[data-act="remove"]'));
    await spy.settle();
    field(el).dispatchEvent(paste([png(), png('two.png')]));
    await spy.settle();
    el.removeFile(0);
    await spy.settle();
    expect(spy.calls).toEqual([
      ['close', { emphasis: 'subtle', input: 'mouse' }],
      ['error', { emphasis: 'subtle' }],
    ]);
  });

  it('voice: start taps, Done taps subtly, Cancel and Esc close subtly', async () => {
    stubMic();
    const el = mount();
    click(act(el, 'voice'));
    await spy.settle();
    click(act(el, 'rec-done'));
    await spy.settle();
    click(act(el, 'voice'));
    await spy.settle();
    click(act(el, 'rec-cancel'));
    await spy.settle();
    click(act(el, 'voice'));
    await spy.settle();
    key(act(el, 'rec-done')!, 'Escape');
    await spy.settle();
    const start = ['tap', { input: 'mouse' }];
    expect(spy.calls).toEqual([
      start,
      ['tap', { emphasis: 'subtle', input: 'mouse' }],
      start,
      ['close', { emphasis: 'subtle', input: 'mouse' }],
      start,
      ['close', { emphasis: 'subtle', input: 'keyboard' }],
    ]);
  });

  it('sending while recording: the press stops it (subtle tap), the send that follows is silent', async () => {
    stubMic();
    const el = mount();
    const sub = events<ComposerSubmitDetail>(el, 'ui-submit');
    click(act(el, 'voice'));
    await spy.settle();
    type(el, 'Listen to this');
    key(field(el), 'Enter');
    await spy.settle();
    expect(sub).toHaveLength(1);
    expect(spy.calls.slice(1)).toEqual([['tap', { emphasis: 'subtle', input: 'keyboard' }]]);
  });

  it('a recording stopped by maxRecordMs, by data or by clear() is silent', async () => {
    const realNow = Date.now.bind(Date);
    let offset = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + offset);
    stubMic();
    const el = mount({ maxRecordMs: 5000 });
    const rec = events<ComposerRecordDetail>(el, 'ui-record');
    click(act(el, 'voice'));
    await spy.settle();
    offset = 6000;
    await until(() => rec.some((r) => r.state === 'stop'));
    await spy.settle();
    click(act(el, 'voice'));
    await spy.settle();
    set(el, { maxRecordMs: 5000, disabled: true });
    set(el, { disabled: false });
    click(act(el, 'voice'));
    await spy.settle();
    el.clear();
    await spy.settle();
    expect(rec.map((r) => r.state)).toEqual(['start', 'stop', 'start', 'cancel', 'start', 'cancel']);
    expect(spy.cues()).toEqual(['tap', 'tap', 'tap']);
  });

  it('el.data from code is silent, and so is a composer inside data-ui-sound="off"', async () => {
    const el = mount();
    set(el, { value: 'From the host', busy: true });
    set(el, { busy: false, disabled: 'Ended' });
    await spy.settle();
    expect(spy.calls).toEqual([]);
    const quiet = document.createElement('div');
    quiet.setAttribute('data-ui-sound', 'off');
    document.body.append(quiet);
    const muted = document.createElement('ui-composer');
    quiet.append(muted);
    muted.data = { tools: [{ id: 'model', label: 'Model' }] };
    muted.renderNow();
    click(qa(muted, '[data-act="tool"]').find((b) => b.dataset.id === 'model'));
    muted.value = 'Hello';
    key(muted.shadowRoot!.querySelector('.cp-field')!, 'Enter');
    await spy.settle();
    expect(spy.calls).toEqual([]);
  });
});
