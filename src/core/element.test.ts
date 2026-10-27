import { describe, expect, it } from 'vitest';
import { define, UiElement } from './element';

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
});
