import { describe, expect, it } from 'vitest';
import { ICON_NAMES, icon } from '../icons/icons';
import { KIT_CLASSES, kitCss } from './kit';

/** The block a rule list sits in: from the selector's `{` to its matching `}` (rules here never nest). */
function rule(selector: string): string {
  const at = kitCss.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  const open = kitCss.indexOf('{', at);
  return kitCss.slice(open + 1, kitCss.indexOf('}', open));
}

/** The last `@media <query> { … }` block (the page-kit block comes after the base kit's). */
function lastMedia(query: string): string {
  const at = kitCss.lastIndexOf(`@media ${query} {`);
  expect(at, query).toBeGreaterThanOrEqual(0);
  const rest = kitCss.slice(at);
  return rest.slice(0, rest.indexOf('\n}\n'));
}

describe('ui-kit.css — page parts (inputs, switch, card, notice, row)', () => {
  it('lists the new classes', () => {
    for (const c of ['ui-input', 'ui-switch', 'ui-card', 'ui-notice', 'ui-row']) expect(KIT_CLASSES).toContain(c);
  });

  it('draws fields at 34px / radius 8 on the raised surface, 44px and 16px type on touch', () => {
    const input = rule('.ui-input');
    expect(input).toContain('min-height: 34px');
    expect(input).toContain('border-radius: 8px');
    expect(input).toContain('background: var(--ui-surface-raised)');
    expect(kitCss).toContain('textarea.ui-input { display: block; width: 100%;');
    // A select draws its chevron from tokens (two gradient triangles), never a data-URI with a hard-coded colour.
    const select = rule('select.ui-input');
    expect(select).toContain('appearance: none');
    expect(select).toContain('var(--ui-ib-muted) 50%');
    expect(select).not.toContain('url(');
    expect(lastMedia('(pointer: coarse), (max-width: 639px)')).toContain(
      '.ui-input, .ui-input.is-sm { min-height: 44px; }',
    );
    expect(lastMedia('(pointer: coarse)')).toContain('.ui-input, .ui-input.is-sm { font-size: 16px; }');
    expect(kitCss).toContain('.ui-input[aria-invalid="true"] { border-color: var(--ui-st-fail); }');
  });

  it('turns the switch ink when on and slides its knob on the press duration (still under reduced motion)', () => {
    expect(rule('.ui-switch > input:checked')).toContain('background: var(--ui-ib-text)');
    expect(rule('.ui-switch > input:checked::before')).toContain('transform: translateX(14px)');
    expect(rule('.ui-switch > input::before')).toContain(
      'transition: transform var(--ui-dur-press) var(--ui-ease-out)',
    );
    expect(lastMedia('(prefers-reduced-motion: reduce)')).toContain('.ui-switch > input::before');
    expect(kitCss).toContain(
      '.ui-switch > input:focus-visible { outline: 2px solid var(--ui-border-focus); outline-offset: 2px; }',
    );
  });

  it('makes the card a 12px surface with the whisper shadow and a 15 / 650 heading', () => {
    const card = rule('.ui-card');
    expect(card).toContain('border-radius: 12px');
    expect(card).toContain('box-shadow: var(--ui-ib-shadow)');
    expect(kitCss).toMatch(/\.ui-card > header > :is\(h1, h2, h3, h4\) \{[^}]*font-size: 15px; font-weight: 650;/);
  });

  it('tints notices and run rows per tone with color-mix', () => {
    for (const t of ['run', 'wait', 'done', 'fail']) {
      expect(kitCss).toContain(
        `.ui-notice[data-tone="${t}"] { --ui-tone: var(--ui-st-${t}); border-color: color-mix(in srgb, var(--ui-st-${t}) 35%, var(--ui-ib-card-border)); background: color-mix(in srgb, var(--ui-st-${t}) 16%, var(--ui-ib-card));`,
      );
      expect(kitCss).toContain(`.ui-row[data-tone="${t}"] { --ui-tone: var(--ui-st-${t}); }`);
    }
    expect(rule('.ui-row > svg')).toContain('color: var(--ui-tone)');
    expect(kitCss).toContain('.ui-row + .ui-row { border-top: 1px solid var(--ui-ib-card-border); }');
  });

  it('keeps page-part hovers to colour on fine pointers', () => {
    const hover = lastMedia('(hover: hover) and (pointer: fine)');
    expect(hover).toContain('.ui-input:hover');
    expect(hover).toContain(':is(a, button).ui-row:hover { background: var(--ui-ib-pill); }');
    expect(hover).not.toMatch(/transform|translate|scale\(/);
  });

  it('parses in the DOM', () => {
    const style = document.createElement('style');
    style.textContent = kitCss;
    document.head.append(style);
    const text = Array.from(style.sheet?.cssRules ?? [])
      .map((r) => r.cssText)
      .join('\n');
    expect(text).toContain('.ui-notice');
    expect(text).toContain('.ui-row');
    style.remove();
  });
});

describe('lock glyph', () => {
  it('ships a padlock on the 16 grid for locked settings', () => {
    expect(ICON_NAMES).toContain('lock');
    const svg = icon('lock', { label: 'Locked' });
    expect(svg).toContain('data-icon="lock"');
    expect(svg).toContain('aria-label="Locked"');
  });
});
