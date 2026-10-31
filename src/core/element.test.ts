import { describe, expect, it } from 'vitest';
import { define, UiElement } from './element';
import { baseCss } from './tokens';

class UiProbe extends UiElement<{ n: number }> {
  renders = 0;
  protected render(): string {
    this.renders++;
    return `<button data-key='k:"1"/x'>${this.data?.n ?? 0}</button>`;
  }
}
define('ui-probe', UiProbe);

describe('UiElement', () => {
  it('batches renders and renderNow cancels the queued one', async () => {
    const el = document.createElement('ui-probe') as UiProbe;
    document.body.append(el);
    el.data = { n: 1 };
    el.data = { n: 2 };
    el.renderNow();
    await Promise.resolve();
    await Promise.resolve();
    expect(el.renders).toBe(1);
    expect(el.shadowRoot!.querySelector('button')?.textContent).toBe('2');
  });

  it('keeps focus on the element with the same data-key, whatever characters the key holds', () => {
    const el = document.createElement('ui-probe') as UiProbe;
    document.body.append(el);
    el.data = { n: 1 };
    el.renderNow();
    el.shadowRoot!.querySelector('button')!.focus();
    el.data = { n: 2 };
    el.renderNow();
    expect(el.shadowRoot!.activeElement?.textContent).toBe('2');
  });
  it('data set before the element is defined is not lost once it upgrades (a late module script)', async () => {
    const el = document.createElement('ui-late-probe') as HTMLElement & { data?: { n: number } };
    el.data = { n: 7 }; // plain own property: the class does not exist yet
    document.body.append(el);
    class UiLateProbe extends UiElement<{ n: number }> {
      protected render(): string {
        return `<b>${this.data?.n ?? 'none'}</b>`;
      }
    }
    define('ui-late-probe', UiLateProbe);
    await Promise.resolve();
    await Promise.resolve();
    expect(Object.hasOwn(el, 'data')).toBe(false);
    expect((el as UiLateProbe).data).toEqual({ n: 7 });
    expect(el.shadowRoot?.querySelector('b')?.textContent).toBe('7');
  });
  it('restores focus after updated() (a subclass may unhide the focused element there), else to focusFallback()', () => {
    class UiFocusProbe extends UiElement<{ keep: boolean }> {
      seenDuringUpdated: string | undefined = 'unset';
      protected render(): string {
        return `<button class="head" data-key="head">h</button>${this.data?.keep ? '<button data-key="k" hidden>k</button>' : ''}`;
      }
      protected override updated(): void {
        const b = this.root.querySelector<HTMLElement>('[data-key="k"]');
        if (b) b.hidden = false;
        // happy-dom throws reading activeElement while the old focused node is detached — that is "nothing focused".
        try {
          this.seenDuringUpdated = (this.root.activeElement as HTMLElement | null)?.dataset?.key;
        } catch {
          this.seenDuringUpdated = undefined;
        }
      }
      protected override focusFallback(): HTMLElement | null {
        return this.root.querySelector<HTMLElement>('.head');
      }
    }
    define('ui-focus-probe', UiFocusProbe);
    const el = document.createElement('ui-focus-probe') as UiFocusProbe;
    document.body.append(el);
    el.data = { keep: true };
    el.renderNow();
    el.shadowRoot?.querySelector<HTMLElement>('[data-key="k"]')?.focus();
    el.data = { keep: true };
    el.renderNow();
    expect(el.seenDuringUpdated).toBeUndefined(); // not restored yet while updated() runs
    expect((el.shadowRoot?.activeElement as HTMLElement | null)?.dataset.key).toBe('k');
    el.data = { keep: false };
    el.renderNow();
    expect((el.shadowRoot?.activeElement as HTMLElement | null)?.dataset.key).toBe('head');
  });

  it('adopts a declarative shadow root (server-rendered) and hydrates its nodes in place on the first render', () => {
    // happy-dom does not parse <template shadowrootmode>; stand in for the parser: the root exists before the
    // constructor runs, with the server's <style> and .ui-root already in it.
    const donor = document.createElement('div');
    const declared = donor.attachShadow({ mode: 'open' });
    declared.innerHTML = '<style>old</style><div part="root" class="ui-root"><b class="card">7</b><i>x</i></div>';
    class UiSsrProbe extends UiElement<{ n: number }> {
      override get shadowRoot(): ShadowRoot {
        return declared;
      }
      get isDeclarative(): boolean {
        return this.declarative;
      }
      protected render(): string {
        return `<b class="card">${this.data?.n ?? 'none'}</b>`;
      }
    }
    define('ui-ssr-probe', UiSsrProbe);
    const style = declared.querySelector('style')!;
    const root = declared.querySelector('.ui-root')!;
    const card = declared.querySelector('.card')!;
    const el = document.createElement('ui-ssr-probe') as UiSsrProbe;
    expect(el.isDeclarative).toBe(true);
    // The parser's nodes stay; the sheet is brought up to date in place.
    expect(declared.querySelector('style')).toBe(style);
    expect(style.textContent).toBe(baseCss);
    expect(declared.querySelector('.ui-root')).toBe(root);
    expect(declared.children).toHaveLength(2);
    document.body.append(el);
    el.data = { n: 8 };
    el.renderNow();
    // First render: hydrated — the card node is the same one, patched; the node the markup lacks is gone.
    expect(declared.querySelector('.card')).toBe(card);
    expect(card.textContent).toBe('8');
    expect(declared.querySelector('i')).toBeNull();
    // Later renders are the usual replace.
    el.data = { n: 9 };
    el.renderNow();
    expect(declared.querySelector('.card')).not.toBe(card);
    expect(declared.querySelector('.card')?.textContent).toBe('9');
    const plain = document.createElement('ui-probe') as UiProbe;
    expect(plain.shadowRoot?.children).toHaveLength(2);
  });

  it('keeps Korean words whole in every element (base sheet)', () => {
    expect(baseCss).toContain(':host([lang="ko"]), :host(:lang(ko)) { word-break: keep-all; }');
  });
});
