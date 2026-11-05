import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

function execCommand(ok: boolean) {
  const fn = vi.fn(() => ok);
  Object.defineProperty(document, 'execCommand', { value: fn, configurable: true, writable: true });
  return fn;
}
function shadowHost(): { host: HTMLElement; root: ShadowRoot } {
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  document.body.append(host);
  return { host, root };
}

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  delete (document as { execCommand?: unknown }).execCommand;
});

describe('copyText', () => {
  it('writes through the Clipboard API first', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({ writeText } as unknown as Clipboard);
    const exec = execCommand(true);
    await expect(copyText('npm i @2lab.ai/ui', shadowHost().root)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('npm i @2lab.ai/ui');
    expect(exec).not.toHaveBeenCalled();
  });

  it('a refused write falls back to a hidden textarea; false when that fails too, or there is no execCommand', async () => {
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({
      writeText: () => Promise.reject(new Error('denied')),
    } as unknown as Clipboard);
    const { root } = shadowHost();
    const exec = execCommand(true);
    await expect(copyText('a', root)).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(root.querySelector('textarea')).toBeNull();
    execCommand(false);
    await expect(copyText('a', root)).resolves.toBe(false);
    delete (document as { execCommand?: unknown }).execCommand;
    await expect(copyText('a', root)).resolves.toBe(false);
  });

  it('the textarea gives focus back to where it was — also outside the root it copies from', async () => {
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue(undefined as unknown as Clipboard);
    execCommand(true);
    // Browsers focus a textarea on select(); happy-dom does not — do it here, so its removal drops focus.
    const select = HTMLTextAreaElement.prototype.select;
    vi.spyOn(HTMLTextAreaElement.prototype, 'select').mockImplementation(function (this: HTMLTextAreaElement) {
      this.focus();
      select.call(this);
    });
    const { root } = shadowHost();
    // In the page.
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    await copyText('x', root);
    expect(document.activeElement).toBe(input);
    // Inside another component's shadow root.
    const other = shadowHost();
    const button = document.createElement('button');
    other.root.append(button);
    button.focus();
    await copyText('y', root);
    expect(document.activeElement).toBe(other.host);
    expect(other.root.activeElement).toBe(button);
    // Inside the same root.
    const own = document.createElement('button');
    root.append(own);
    own.focus();
    await copyText('z', root);
    expect(root.activeElement).toBe(own);
    expect(root.querySelector('textarea')).toBeNull();
  });
});
