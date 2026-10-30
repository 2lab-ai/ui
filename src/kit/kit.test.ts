import { describe, expect, it } from 'vitest';
import tokens from '../core/tokens.json';
import { KIT_CLASSES, kitCss } from './kit';

const KNOWN = new Set([...Object.keys(tokens.light), ...Object.keys(tokens.shared), 'tone']);

describe('ui-kit.css', () => {
  it('defines every class it lists', () => {
    for (const c of KIT_CLASSES) expect(kitCss, c).toContain(`.${c}`);
  });

  it('never hard-codes a colour: every value is a --ui-* token or a color-mix of tokens', () => {
    // Strip comments, then look for hex and rgb()/hsl() literals.
    const css = kitCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(rgba?|hsla?)\(/i);
    for (const m of css.matchAll(/var\(--ui-([a-z0-9-]+)/g)) expect(KNOWN.has(m[1]), m[1]).toBe(true);
  });

  it('has the button family, the press scale and 44px coarse targets', () => {
    for (const mod of ['is-primary', 'is-quiet', 'is-danger', 'is-sm', 'is-lg'])
      expect(kitCss).toContain(`.ui-btn.${mod}`);
    expect(kitCss).toMatch(/:active[^{]*\{ transform: scale\(0\.97\); \}/);
    expect(kitCss).toMatch(/@media \(pointer: coarse\)[^{]*\{\s*\.ui-btn, \.ui-btn\.is-sm \{ min-height: 44px;/);
    // The ink primary: text-coloured fill, card-coloured label.
    expect(kitCss).toContain(
      '.ui-btn.is-primary { background: var(--ui-ib-text); border-color: var(--ui-ib-text); color: var(--ui-ib-card); }',
    );
  });

  it('gates hover to fine pointers and never moves on hover', () => {
    const hover = kitCss.slice(kitCss.indexOf('@media (hover: hover)'));
    const block = hover.slice(0, hover.indexOf('\n}\n'));
    expect(block).not.toMatch(/transform|translate|scale\(/);
    expect(kitCss.slice(0, kitCss.indexOf('@media (hover: hover)'))).not.toMatch(/:hover/);
  });

  it('tints status tones with color-mix in both text and pill', () => {
    for (const t of ['run', 'wait', 'done', 'fail']) {
      expect(kitCss).toContain(`.ui-status[data-tone="${t}"]`);
      expect(kitCss).toContain(
        `.ui-status.is-pill[data-tone="${t}"] { background: color-mix(in srgb, var(--ui-st-${t}) 16%, var(--ui-ib-card)); }`,
      );
      expect(kitCss).toContain(`.ui-status-line[data-tone="${t}"]`);
    }
  });

  it('expands 0fr → 1fr and hides closed content from focus', () => {
    expect(kitCss).toContain('grid-template-rows: 0fr');
    expect(kitCss).toMatch(/\.ui-expand\.is-open, \.ui-expand\[data-open\] \{ grid-template-rows: 1fr; \}/);
    expect(kitCss).toMatch(/\.ui-expand > \* \{[^}]*visibility: hidden/);
  });

  it('stops loops and movement under reduced motion', () => {
    const rm = kitCss.slice(kitCss.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rm).toContain('.ui-skeleton, .ui-status[data-live]::before { animation: none; }');
    expect(rm).toContain('.ui-expand { transition: none; }');
  });

  it('parses as CSS in the DOM', () => {
    const style = document.createElement('style');
    style.textContent = kitCss;
    document.head.append(style);
    expect(style.sheet?.cssRules.length ?? 0).toBeGreaterThan(40);
    style.remove();
  });
});
