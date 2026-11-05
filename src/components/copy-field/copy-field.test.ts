import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundSpy, soundSpy } from '../../sound/fixtures';
import {
  COPY_FAIL_MS,
  COPY_HOLD_MS,
  COPY_MASK,
  type CopyFieldCopyDetail,
  type CopyFieldData,
  copyLabel,
  copyMask,
  copyMiddle,
  copyView,
  type UiCopyField,
} from './copy-field';
import { doc } from './docs';
import { styles } from './styles';

const XSS = '<img src=x onerror=alert(1)>';
const URL1 = 'https://ui.2lab.ai/docs/components/slide-confirm';
const SESSION = '7f3c2a91-5e0b-4c1d-9a7e-2b6f8d4e1c03';
const TOKEN = 'whsec_5Kq2vR8mN1xT7bY4cH9eJ3wL6pD0fG2a';

function mount(data?: CopyFieldData, attrs: Record<string, string> = {}): UiCopyField {
  const el = document.createElement('ui-copy-field');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  if (data) el.data = data;
  el.renderNow();
  return el;
}
const q = <E extends Element = HTMLElement>(el: UiCopyField, s: string) => el.shadowRoot!.querySelector<E>(s);
const copyBtn = (el: UiCopyField) => q<HTMLButtonElement>(el, '.cf-copy')!;
const eye = (el: UiCopyField) => q<HTMLButtonElement>(el, '.cf-eye')!;
const field = (el: UiCopyField) => q(el, '.cf')!;
const live = (el: UiCopyField) => q(el, '[role="status"]')!.textContent!.trim();
const shown = (el: UiCopyField) => q(el, '.cf-val')!.textContent;
const press = (t: HTMLElement, detail = 1) =>
  t.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail }));
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function clipboard(write: (text: string) => Promise<void> = () => Promise.resolve()) {
  const writeText = vi.fn(write);
  vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({ writeText } as unknown as Clipboard);
  return writeText;
}
/** happy-dom has no execCommand: give the textarea fallback one that answers `ok`. */
function execCommand(ok: boolean) {
  const fn = vi.fn(() => ok);
  Object.defineProperty(document, 'execCommand', { value: fn, configurable: true, writable: true });
  return fn;
}
/** The Clipboard API refuses and so does the textarea. */
function refuse() {
  const writeText = clipboard(() => Promise.reject(new DOMException('denied', 'NotAllowedError')));
  return { writeText, exec: execCommand(false) };
}
function copies(el: UiCopyField, run?: (e: Event) => void): string[] {
  const seen: string[] = [];
  el.addEventListener('ui-copy', (e) => {
    seen.push((e as CustomEvent<CopyFieldCopyDetail>).detail.value);
    run?.(e);
  });
  return seen;
}

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (document as { execCommand?: unknown }).execCommand;
  getSelection()?.removeAllRanges();
});

describe('helpers', () => {
  it('copyMiddle: a URL keeps its last segment (with query and hash) as the tail', () => {
    expect(copyMiddle(URL1)).toEqual({ head: 'https://ui.2lab.ai/docs/components', tail: '/slide-confirm' });
    expect(copyMiddle('https://github.com/2lab-ai/soma-work/pull/1287').tail).toBe('/1287');
    expect(copyMiddle('https://x.dev/a/b/').tail).toBe('/b/');
    expect(copyMiddle('https://x.dev/a/b?tab=1#c').tail).toBe('/b?tab=1#c');
    expect(copyMiddle('https://x.dev?session=1').tail).toBe('?session=1');
    expect(copyMiddle('https://github.com/2lab-ai')).toEqual({ head: 'https://github.com', tail: '/2lab-ai' });
  });

  it('copyMiddle: no tail for a bare origin or for text; a long segment keeps its last max / 2 characters', () => {
    expect(copyMiddle('https://soma.2lab.ai')).toEqual({ head: 'https://soma.2lab.ai', tail: '' });
    expect(copyMiddle('https://soma.2lab.ai/')).toEqual({ head: 'https://soma.2lab.ai/', tail: '' });
    expect(copyMiddle('fix/flaky-upload-e2e')).toEqual({ head: 'fix/flaky-upload-e2e', tail: '' });
    expect(copyMiddle(`claude --resume ${SESSION}`).tail).toBe('');
    expect(copyMiddle('mailto:ops@2lab.ai').tail).toBe('');
    expect(copyMiddle(`https://soma.2lab.ai/s/${SESSION}`).tail).toBe(SESSION.slice(-12));
    expect(copyMiddle(URL1, 8).tail).toBe('firm');
    expect(copyMiddle(URL1, Number.NaN).tail).toBe('/slide-confirm');
    expect(copyMiddle('').tail).toBe('');
  });

  it('copyMiddle: head + tail is always the value', () => {
    for (const s of [URL1, `https://soma.2lab.ai/s/${SESSION}?panel=ctx#t`, 'plain text', '', 'https://a.b/c/d/e/'])
      for (const max of [1, 4, 24, 200]) {
        const { head, tail } = copyMiddle(s, max);
        expect(head + tail).toBe(s);
      }
  });

  it('copyMask: eight dots for any value — never its length; nothing for no value', () => {
    expect(copyMask('a')).toBe(COPY_MASK);
    expect(copyMask('x'.repeat(400))).toBe(COPY_MASK);
    expect(COPY_MASK).toHaveLength(8);
    expect(copyMask('')).toBe('');
    expect(copyMask('   ')).toBe('');
    expect(copyMask(undefined)).toBe('');
  });

  it('copyLabel / copyView', () => {
    expect(copyLabel('Permalink')).toBe('Copy Permalink');
    expect(copyLabel('  PR  ', 'en')).toBe('Copy PR');
    expect(copyLabel('')).toBe('Copy value');
    expect(copyLabel('퍼머링크', 'ko')).toBe('퍼머링크 복사');
    expect(copyLabel(undefined, 'ko')).toBe('값 복사');
    expect(copyView('block')).toBe('block');
    expect(copyView('pre')).toBe('inline');
    expect(copyView(undefined)).toBe('inline');
  });
});

describe('render', () => {
  it('inline: label, the value split for a middle ellipsis (whole in the DOM), a Copy button', () => {
    const el = mount({ label: 'Docs', value: URL1 });
    expect(field(el).getAttribute('data-view')).toBe('inline');
    expect(q(el, '.cf-label')?.textContent).toBe('Docs');
    expect(q(el, '.cf-head')?.textContent).toBe('https://ui.2lab.ai/docs/components');
    expect(q(el, '.cf-tail')?.textContent).toBe('/slide-confirm');
    expect(shown(el)).toBe(URL1);
    expect(q(el, '.cf-val')?.getAttribute('title')).toBe(URL1);
    expect(copyBtn(el).type).toBe('button');
    expect(copyBtn(el).getAttribute('aria-label')).toBe('Copy Docs');
    expect(copyBtn(el).disabled).toBe(false);
    expect(copyBtn(el).querySelector('[data-icon="copy"]')).not.toBeNull();
    expect(q(el, '.cf-eye')).toBeNull();
    expect(q(el, '.cf-note')).toBeNull();
    expect(live(el)).toBe('');
    // Text has no tail: it ends in “…”.
    const text = mount({ value: 'fix/flaky-upload-e2e' });
    expect(q(text, '.cf-tail')).toBeNull();
    expect(copyBtn(text).getAttribute('aria-label')).toBe('Copy value');
  });

  it('block: a <pre> that keeps its lines, label above the box, a focusable scroller', () => {
    const value = 'git switch fix/flaky-upload-e2e\nnpx playwright test --repeat-each=20';
    const el = mount({ view: 'block', label: 'Run it locally', value });
    expect(field(el).getAttribute('data-view')).toBe('block');
    const pre = q(el, 'pre.cf-val')!;
    expect(pre.textContent).toBe(value);
    expect(pre.getAttribute('tabindex')).toBe('0');
    expect(pre.getAttribute('data-key')).toBe('value');
    expect(field(el).firstElementChild?.className).toBe('cf-label');
    expect(q(el, '.cf-box .cf-copy')).not.toBeNull();
    expect(q(el, '.cf-box')?.hasAttribute('data-two')).toBe(false);
  });

  it('attributes: value, label, view, href, copy-label, disabled — and data wins', () => {
    const el = mount(undefined, {
      value: 'npm i @2lab.ai/ui@0.29.0',
      label: 'Install',
      view: 'block',
      'copy-label': 'Copy the install line',
    });
    expect(q(el, 'pre.cf-val')?.textContent).toBe('npm i @2lab.ai/ui@0.29.0');
    expect(q(el, '.cf-label')?.textContent).toBe('Install');
    expect(copyBtn(el).getAttribute('aria-label')).toBe('Copy the install line');
    el.data = { value: 'npm i @2lab.ai/ui@0.28.0', label: 'Older', view: 'inline' };
    el.renderNow();
    expect(shown(el)).toBe('npm i @2lab.ai/ui@0.28.0');
    expect(q(el, '.cf-label')?.textContent).toBe('Older');
    expect(field(el).getAttribute('data-view')).toBe('inline');
    // copyLabel left out of data: the attribute still names the button.
    expect(copyBtn(el).getAttribute('aria-label')).toBe('Copy the install line');
    el.setAttribute('disabled', '');
    el.renderNow();
    expect(copyBtn(el).disabled).toBe(true);
    el.data = { ...el.data!, disabled: false };
    el.renderNow();
    expect(copyBtn(el).disabled).toBe(false);
    const link = mount(undefined, { value: URL1, href: URL1 });
    expect(q(link, 'a.cf-val')?.getAttribute('href')).toBe(URL1);
  });

  it('href: a link in a new tab, still copyable; unsafe targets draw plain text', () => {
    const el = mount({
      label: 'PR',
      value: 'https://github.com/2lab-ai/soma-work/pull/1287',
      href: 'https://github.com/2lab-ai/soma-work/pull/1287',
    });
    const a = q<HTMLAnchorElement>(el, 'a.cf-val')!;
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.textContent).toBe('https://github.com/2lab-ai/soma-work/pull/1287');
    expect(copyBtn(el).disabled).toBe(false);
    expect(q(mount({ value: 'x', href: '/dashboard/sessions/7f3c2a91' }), 'a.cf-val')?.getAttribute('href')).toBe(
      '/dashboard/sessions/7f3c2a91',
    );
    for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,hi', '//evil.example/x'])
      expect(q(mount({ value: 'x', href: bad }), 'a')).toBeNull();
    const block = mount({ view: 'block', value: URL1, href: URL1 });
    expect(q(block, 'pre.cf-val > a.cf-link')?.getAttribute('href')).toBe(URL1);
    expect(q(block, 'pre.cf-val')?.hasAttribute('tabindex')).toBe(false);
  });

  it('empty or disabled: a muted “—” (or the value) and a disabled button', () => {
    for (const value of ['', '   ']) {
      const el = mount({ label: 'Deploy key', value });
      expect(q(el, '.cf-val.is-empty [aria-hidden="true"]')?.textContent).toBe('—');
      expect(q(el, '.cf-val .sr-only')?.textContent).toBe('No value');
      expect(copyBtn(el).disabled).toBe(true);
      expect(field(el).hasAttribute('data-empty')).toBe(true);
    }
    expect(copyBtn(mount()).disabled).toBe(true);
    const off = mount({ value: 'fix/flaky-upload-e2e', disabled: true });
    expect(shown(off)).toBe('fix/flaky-upload-e2e');
    expect(copyBtn(off).disabled).toBe(true);
    expect(field(off).hasAttribute('data-disabled')).toBe(true);
  });

  it('escapes every host string: value, label, copyLabel, href', () => {
    const el = mount({ value: XSS, label: XSS, copyLabel: XSS, href: `https://x.dev/"${XSS}` });
    const root = el.shadowRoot!;
    expect(root.querySelector('img')).toBeNull();
    expect(shown(el)).toBe(XSS);
    expect(q(el, '.cf-label')?.textContent).toBe(XSS);
    expect(copyBtn(el).getAttribute('aria-label')).toBe(XSS);
    expect(q(el, 'a.cf-val')?.getAttribute('href')).toBe(`https://x.dev/"${XSS}`);
    const block = mount({ view: 'block', value: XSS, label: XSS });
    expect(block.shadowRoot!.querySelector('img')).toBeNull();
    expect(q(block, 'pre')?.textContent).toBe(XSS);
    const secret = mount({ value: XSS, label: XSS, secret: true });
    expect(secret.shadowRoot!.querySelector('img')).toBeNull();
    expect(eye(secret).getAttribute('aria-label')).toBe(`Show ${XSS}`);
  });
});

describe('copy', () => {
  it('a press sends ui-copy, writes the value and shows the proof — back to rest after 1.6 s', async () => {
    const writeText = clipboard();
    const el = mount({ label: 'Permalink', value: URL1 });
    const seen = copies(el);
    vi.useFakeTimers();
    press(copyBtn(el));
    expect(seen).toEqual([URL1]);
    expect(writeText).toHaveBeenCalledWith(URL1);
    await flush();
    expect(field(el).getAttribute('data-state')).toBe('done');
    expect(copyBtn(el).getAttribute('aria-label')).toBe('Copied');
    expect(copyBtn(el).getAttribute('title')).toBe('Copied');
    expect(live(el)).toBe('Copied');
    expect(el.copied).toBe(true);
    expect(q(el, '.cf-note')).toBeNull();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(COPY_HOLD_MS - 1);
    expect(el.copied).toBe(true);
    vi.advanceTimersByTime(1);
    expect(COPY_HOLD_MS).toBe(1600);
    expect(field(el).hasAttribute('data-state')).toBe(false);
    expect(copyBtn(el).getAttribute('aria-label')).toBe('Copy Permalink');
    expect(live(el)).toBe('');
    expect(el.copied).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('one timer: a new press starts it again, and the live words change so they are said again', async () => {
    clipboard();
    const el = mount({ value: 'fix/flaky-upload-e2e' });
    vi.useFakeTimers();
    press(copyBtn(el));
    await flush();
    const first = q(el, '[role="status"]')!.textContent;
    vi.advanceTimersByTime(1000);
    press(copyBtn(el));
    await flush();
    expect(vi.getTimerCount()).toBe(1);
    const second = q(el, '[role="status"]')!.textContent;
    expect(second).not.toBe(first);
    expect(second!.trim()).toBe('Copied');
    vi.advanceTimersByTime(1000);
    expect(el.copied).toBe(true);
    vi.advanceTimersByTime(600);
    expect(el.copied).toBe(false);
  });

  it('a copy that fails says so, selects the value, and rests after 4 s', async () => {
    const { writeText, exec } = refuse();
    const el = mount({ label: 'Branch', value: 'fix/flaky-upload-e2e' });
    vi.useFakeTimers();
    press(copyBtn(el));
    await flush();
    expect(writeText).toHaveBeenCalled();
    expect(exec).toHaveBeenCalledWith('copy');
    expect(el.shadowRoot!.querySelector('textarea')).toBeNull();
    expect(field(el).getAttribute('data-state')).toBe('fail');
    expect(copyBtn(el).getAttribute('aria-label')).toBe('Copy failed — select the text');
    expect(q(el, '.cf-note')?.textContent).toBe('Copy failed — select the text');
    expect(live(el)).toBe('Copy failed — select the text');
    expect(el.copied).toBe(false);
    expect(getSelection()?.toString()).toBe('fix/flaky-upload-e2e');
    vi.advanceTimersByTime(COPY_FAIL_MS);
    expect(field(el).hasAttribute('data-state')).toBe(false);
    expect(q(el, '.cf-note')).toBeNull();
  });

  it('without the Clipboard API the hidden textarea copies it', async () => {
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue(undefined as unknown as Clipboard);
    const exec = execCommand(true);
    const el = mount({ value: 'npm i @2lab.ai/ui@0.29.0' });
    await expect(el.copy()).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(el.copied).toBe(true);
  });

  it('a prevented ui-copy writes nothing; confirm() shows the host’s outcome', async () => {
    const writeText = clipboard();
    const el = mount({ label: 'Context', value: 'session 7f3c2a91 · 48 turns', copyLabel: 'Copy full context' });
    copies(el, (e) => e.preventDefault());
    vi.useFakeTimers();
    press(copyBtn(el));
    await flush();
    expect(writeText).not.toHaveBeenCalled();
    expect(field(el).hasAttribute('data-state')).toBe(false);
    expect(copyBtn(el).getAttribute('aria-label')).toBe('Copy full context');
    el.confirm(true);
    expect(el.copied).toBe(true);
    expect(live(el)).toBe('Copied');
    el.confirm();
    expect(el.copied).toBe(true);
    el.confirm(false);
    expect(field(el).getAttribute('data-state')).toBe('fail');
    // The element does not know what the host copied: no “select the text”, nothing selected.
    expect(copyBtn(el).getAttribute('aria-label')).toBe('Copy failed');
    expect(q(el, '.cf-note')?.textContent).toBe('Copy failed');
    expect(getSelection()?.toString() ?? '').toBe('');
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(COPY_FAIL_MS);
    expect(copyBtn(el).getAttribute('aria-label')).toBe('Copy full context');
  });

  it('copy(): as if pressed — true when it copied, false when prevented, empty or disabled', async () => {
    const writeText = clipboard();
    const el = mount({ value: `claude --resume ${SESSION}` });
    const seen = copies(el);
    await expect(el.copy()).resolves.toBe(true);
    expect(seen).toEqual([`claude --resume ${SESSION}`]);
    expect(writeText).toHaveBeenCalledWith(`claude --resume ${SESSION}`);
    expect(el.copied).toBe(true);
    el.addEventListener('ui-copy', (e) => e.preventDefault());
    await expect(el.copy()).resolves.toBe(false);
    expect(writeText).toHaveBeenCalledTimes(1);
    const empty = mount({ value: ' ' });
    const none = copies(empty);
    await expect(empty.copy()).resolves.toBe(false);
    expect(none).toEqual([]);
    await expect(mount({ value: 'x', disabled: true }).copy()).resolves.toBe(false);
    refuse();
    await expect(mount({ value: 'x' }).copy()).resolves.toBe(false);
  });

  it('a new value drops the proof (it was the old value’s); a copy that lands after the change shows nothing', async () => {
    clipboard();
    const el = mount({ value: 'fix/a' });
    vi.useFakeTimers();
    await el.copy();
    expect(el.copied).toBe(true);
    el.data = { value: 'fix/b' };
    el.renderNow();
    expect(el.copied).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    // The same value set again keeps the proof.
    await el.copy();
    el.data = { value: 'fix/b', label: 'Branch' };
    expect(el.copied).toBe(true);
    let done: () => void = () => {};
    clipboard(() => new Promise<void>((r) => (done = r)));
    const slow = mount({ value: 'one' });
    const p = slow.copy();
    slow.setAttribute('value', 'two');
    slow.data = { value: 'two' };
    done();
    await expect(p).resolves.toBe(true);
    expect(slow.copied).toBe(false);
  });

  it('disconnecting clears the timer and the outcome', async () => {
    clipboard();
    const el = mount({ value: 'x' });
    vi.useFakeTimers();
    await el.copy();
    expect(vi.getTimerCount()).toBe(1);
    el.remove();
    expect(vi.getTimerCount()).toBe(0);
    expect(el.copied).toBe(false);
  });
});

describe('secret', () => {
  it('shows eight dots and never the value or its length', () => {
    const a = mount({ label: 'Signing secret', value: TOKEN, secret: true });
    const b = mount({ label: 'Signing secret', value: 'ab', secret: true });
    for (const el of [a, b]) {
      expect(q(el, '.cf-val.is-masked [aria-hidden="true"]')?.textContent).toBe(COPY_MASK);
      expect(q(el, '.cf-val .sr-only')?.textContent).toBe('Hidden');
      expect(q(el, '.cf-val')?.hasAttribute('title')).toBe(false);
    }
    expect(a.shadowRoot!.innerHTML).not.toContain(TOKEN);
    expect(a.shadowRoot!.innerHTML.replace(/<style>[\s\S]*?<\/style>/, '')).not.toContain('whsec');
    expect(q(a, '.ui-root')!.innerHTML).toBe(q(b, '.ui-root')!.innerHTML);
  });

  it('Show is a toggle (aria-pressed) with a fixed name; the copy is always the real value', async () => {
    const writeText = clipboard();
    const el = mount({ label: 'Signing secret', value: TOKEN, secret: true });
    expect(eye(el).getAttribute('aria-pressed')).toBe('false');
    expect(eye(el).getAttribute('aria-label')).toBe('Show Signing secret');
    expect(eye(el).querySelector('[data-icon="lock"]')).not.toBeNull();
    await el.copy();
    expect(writeText).toHaveBeenLastCalledWith(TOKEN);
    press(eye(el));
    expect(eye(el).getAttribute('aria-pressed')).toBe('true');
    expect(eye(el).getAttribute('aria-label')).toBe('Show Signing secret');
    expect(eye(el).querySelector('[data-icon="shield"]')).not.toBeNull();
    expect(shown(el)).toBe(TOKEN);
    press(eye(el));
    expect(eye(el).getAttribute('aria-pressed')).toBe('false');
    expect(shown(el)).not.toContain(TOKEN);
  });

  it('masks again when the value changes (data or attribute) and when it leaves the page', () => {
    const el = mount({ value: TOKEN, secret: true });
    press(eye(el));
    el.data = { value: TOKEN, secret: true, label: 'Signing secret' };
    el.renderNow();
    expect(shown(el)).toBe(TOKEN);
    el.data = { value: 'whsec_rotated', secret: true };
    el.renderNow();
    expect(eye(el).getAttribute('aria-pressed')).toBe('false');
    expect(el.shadowRoot!.innerHTML).not.toContain('whsec_rotated');
    const attr = mount(undefined, { value: TOKEN, secret: '' });
    press(eye(attr));
    expect(shown(attr)).toBe(TOKEN);
    attr.setAttribute('value', 'whsec_next');
    attr.renderNow();
    expect(attr.shadowRoot!.innerHTML).not.toContain('whsec_next');
    press(eye(attr));
    attr.remove();
    document.body.append(attr);
    attr.renderNow();
    expect(eye(attr).getAttribute('aria-pressed')).toBe('false');
  });

  it('a failed copy shows the secret first, so the selection holds the real value', async () => {
    refuse();
    const el = mount({ value: TOKEN, secret: true });
    press(copyBtn(el));
    await flush();
    expect(eye(el).getAttribute('aria-pressed')).toBe('true');
    expect(getSelection()?.toString()).toBe(TOKEN);
  });

  it('never a link; disabled turns Show off too; a block makes room for two buttons; empty has no Show', () => {
    const el = mount({
      value: 'https://hooks.slack.com/services/T0/B0/x',
      href: 'https://hooks.slack.com/x',
      secret: true,
    });
    press(eye(el));
    expect(q(el, 'a')).toBeNull();
    expect(eye(mount({ value: TOKEN, secret: true, disabled: true })).disabled).toBe(true);
    expect(q(mount({ view: 'block', value: TOKEN, secret: true }), '.cf-box')?.hasAttribute('data-two')).toBe(true);
    expect(q(mount({ value: '', secret: true }), '.cf-eye')).toBeNull();
  });
});

describe('lang="ko"', () => {
  it('every built-in word in Korean', async () => {
    refuse();
    const el = mount({ label: '퍼머링크', value: URL1 }, { lang: 'ko' });
    expect(copyBtn(el).getAttribute('aria-label')).toBe('퍼머링크 복사');
    press(copyBtn(el));
    await flush();
    expect(copyBtn(el).getAttribute('aria-label')).toBe('복사 실패 — 직접 선택하세요');
    expect(q(el, '.cf-note')?.textContent).toBe('복사 실패 — 직접 선택하세요');
    el.confirm(false);
    expect(live(el)).toBe('복사 실패');
    el.confirm(true);
    expect(live(el)).toBe('복사됨');
    expect(copyBtn(el).getAttribute('aria-label')).toBe('복사됨');
    const secret = mount({ label: '서명 키', value: TOKEN, secret: true }, { lang: 'ko' });
    expect(eye(secret).getAttribute('aria-label')).toBe('서명 키 보기');
    expect(q(secret, '.cf-val .sr-only')?.textContent).toBe('숨김');
    const empty = mount({ value: '' }, { lang: 'ko' });
    expect(q(empty, '.cf-val .sr-only')?.textContent).toBe('값 없음');
    expect(copyBtn(empty).getAttribute('aria-label')).toBe('값 복사');
  });
});

describe('keyboard, focus and motion', () => {
  it('real buttons (Enter / Space press them); focus survives a new data and the outcome', async () => {
    clipboard();
    const el = mount({ label: 'Install', value: 'npm i @2lab.ai/ui@0.29.0', secret: true });
    for (const b of [copyBtn(el), eye(el)]) {
      expect(b.tagName).toBe('BUTTON');
      expect(b.getAttribute('type')).toBe('button');
    }
    const btn = copyBtn(el);
    btn.focus();
    el.data = { ...el.data!, label: 'Install the kit' };
    el.renderNow();
    expect(el.shadowRoot!.activeElement).toBe(btn);
    expect(btn.getAttribute('data-key')).toBe('copy');
    press(btn, 0);
    await flush();
    expect(el.copied).toBe(true);
    expect(el.shadowRoot!.activeElement).toBe(btn);
    const toggle = eye(el);
    toggle.focus();
    press(toggle, 0);
    expect(el.shadowRoot!.activeElement).toBe(toggle);
    expect(toggle.getAttribute('data-key')).toBe('reveal');
  });

  it('reduced motion: no scale and no cross-fade — the icons swap at once', () => {
    const reduced = styles.slice(styles.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toContain('.cf-ic, .cf-box { transition: none; }');
    expect(reduced).toContain('scale: none');
    // The settle: from 0.6 to 1 on --ease-out.
    expect(styles).toContain('scale: 0.6');
    expect(styles).toContain('scale 200ms var(--ease-out)');
    expect(styles).toMatch(/@media \(pointer: coarse\)[\s\S]*width: 44px; height: 44px;/);
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});

describe('sound', () => {
  let spy: SoundSpy;
  beforeEach(() => {
    spy = soundSpy();
  });
  afterEach(() => spy.restore());

  it('a press that copied → success (subtle); one that failed → error (subtle); Show / Hide → toggle', async () => {
    clipboard();
    const el = mount({ value: TOKEN, secret: true });
    press(copyBtn(el));
    await flush();
    await spy.settle();
    expect(spy.calls).toEqual([['success', { emphasis: 'subtle', input: 'mouse' }]]);
    press(copyBtn(el), 0);
    await flush();
    await spy.settle();
    expect(spy.calls.at(-1)).toEqual(['success', { emphasis: 'subtle', input: 'keyboard' }]);
    press(eye(el));
    await spy.settle();
    press(eye(el));
    await spy.settle();
    expect(spy.calls.slice(-2)).toEqual([
      ['toggle', { direction: 'forward', input: 'mouse' }],
      ['toggle', { direction: 'back', input: 'mouse' }],
    ]);
    refuse();
    press(copyBtn(el));
    await flush();
    await spy.settle();
    expect(spy.calls.at(-1)).toEqual(['error', { emphasis: 'subtle', input: 'mouse' }]);
    expect(spy.calls).toHaveLength(5);
  });

  it('nothing for a prevented press, copy(), confirm(), data the app sets, or a data-ui-sound="off" region', async () => {
    clipboard();
    const el = mount({ value: 'x' });
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('ui-copy', stop);
    press(copyBtn(el));
    await flush();
    el.confirm(true);
    el.confirm(false);
    el.removeEventListener('ui-copy', stop);
    await el.copy();
    refuse();
    await el.copy();
    el.data = { value: 'y', secret: true };
    el.renderNow();
    await spy.settle();
    expect(spy.calls).toEqual([]);
    clipboard();
    const quiet = document.createElement('div');
    quiet.setAttribute('data-ui-sound', 'off');
    document.body.append(quiet);
    const off = mount({ value: 'z' });
    quiet.append(off);
    press(copyBtn(off));
    await flush();
    await spy.settle();
    expect(off.copied).toBe(true);
    expect(spy.calls).toEqual([]);
  });
});

describe('docs', () => {
  it('names the element, its group and the sound line; every demo builds', () => {
    expect(doc.slug).toBe('copy-field');
    expect(doc.tag).toBe('ui-copy-field');
    expect(doc.name).toBe('Copy Field');
    expect(doc.group).toBe('Primitives');
    expect(doc.reference).toEqual({
      name: 'soma-work dashboard — copy permalink / copy context',
      url: 'https://github.com/2lab-ai/soma-work',
    });
    expect(doc.usedIn).toMatch(/permalink/);
    expect(doc.events.map((e) => e.name)).toEqual(['ui-copy']);
    expect(doc.a11y.some((l) => l.startsWith('Sound (opt-in'))).toBe(true);
    expect(JSON.stringify(doc).toLowerCase()).not.toContain('bencho');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) {
      const node = d.create();
      expect(node).toBeInstanceOf(HTMLElement);
      document.body.append(node);
      expect(node.querySelector('ui-copy-field')).not.toBeNull();
    }
  });

  it('the full-context demo: the host prevents ui-copy, writes the Markdown itself and confirms', async () => {
    const writeText = clipboard();
    vi.stubGlobal('ClipboardItem', undefined);
    vi.useFakeTimers();
    const node = doc.demos.find((d) => d.id === 'context')!.create();
    document.body.append(node);
    const el = node.querySelector('ui-copy-field')!;
    el.renderNow();
    press(copyBtn(el));
    await flush();
    expect(el.copied).toBe(false);
    vi.advanceTimersByTime(700);
    await flush();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('# Fix flaky upload e2e');
    expect(el.copied).toBe(true);
  });
});
