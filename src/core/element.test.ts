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
});
