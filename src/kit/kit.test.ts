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

  it('idle is the muted hollow dot; a leading svg replaces the dot in the tone colour (G1-2)', () => {
    expect(kitCss).toContain(
      '.ui-status[data-tone="idle"]::before { background: transparent; box-shadow: inset 0 0 0 1.5px var(--ui-tone); }',
    );
    // idle keeps the default muted tone and text-2 word (no status colour).
    expect(kitCss).not.toMatch(/\.ui-status\[data-tone="idle"\] \{/);
    expect(kitCss).toMatch(/\.ui-status > svg \{[^}]*color: var\(--ui-tone\)/);
    expect(kitCss).toContain('.ui-status:has(> svg)::before { content: none; }');
    expect(kitCss).toContain('.ui-status[data-live] > svg { animation: ui-pulse');
    const rm = kitCss.slice(kitCss.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rm).toContain('.ui-status[data-live] > svg { animation: none; }');
  });

  it('expands 0fr → 1fr and hides closed content from focus', () => {
    expect(kitCss).toContain('grid-template-rows: 0fr');
    expect(kitCss).toMatch(/\.ui-expand\.is-open, \.ui-expand\[data-open\] \{ grid-template-rows: 1fr; \}/);
    expect(kitCss).toMatch(/\.ui-expand > \* \{[^}]*visibility: hidden/);
  });

  it('has the section head: a 13px / 650 sentence-case row with trailing actions', () => {
    expect(KIT_CLASSES).toContain('ui-section-head');
    const head = /\.ui-section-head \{([^}]*)\}/.exec(kitCss)?.[1] ?? '';
    expect(head).toContain('font-size: 13px');
    expect(head).toContain('font-weight: 650');
    expect(head).toContain('text-transform: none');
    expect(head).not.toMatch(/uppercase/);
    expect(kitCss).toMatch(/\.ui-section-head > \.is-end \{[^}]*margin-left: auto/);
    expect(kitCss).toMatch(/\.ui-section-head:focus-visible \{ outline: 2px solid var\(--ui-border-focus\)/);
  });

  it('has the count badge: a tabular pill, tone tints, and a pop that is opacity-only under reduced motion', () => {
    expect(KIT_CLASSES).toContain('ui-count');
    const count = /\.ui-count \{([^}]*)\}/.exec(kitCss)?.[1] ?? '';
    expect(count).toContain('border-radius: 999px');
    expect(count).toContain('font-variant-numeric: tabular-nums');
    expect(count).toContain('font-size: 11px');
    for (const t of ['run', 'wait', 'done', 'fail'])
      expect(kitCss).toContain(
        `.ui-count[data-tone="${t}"] { background: color-mix(in srgb, var(--ui-st-${t}) 16%, var(--ui-ib-card));`,
      );
    expect(kitCss).toContain(
      '.ui-count[data-pop] { animation: ui-count-pop var(--ui-dur-move) var(--ui-ease-out) both; }',
    );
    expect(kitCss).toContain('@keyframes ui-count-pop { from { opacity: 0; transform: scale(0.9); } }');
    const rm = kitCss.slice(kitCss.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rm.slice(0, rm.indexOf('\n}\n'))).toContain(
      '.ui-count[data-pop] { animation: ui-fade-in 120ms ease both; }',
    );
    expect(kitCss).toContain('@keyframes ui-fade-in { from { opacity: 0; } }');
  });

  it('stops loops and movement under reduced motion', () => {
    const rm = kitCss.slice(kitCss.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rm).toContain('.ui-skeleton, .ui-status[data-live]::before { animation: none; }');
    expect(rm).toContain('.ui-expand { transition: none; }');
  });

  it('keeps Korean words whole in the prose classes under lang="ko" (D5 G4-4)', () => {
    expect(kitCss).toMatch(
      /:is\(\.ui-notice, \.ui-card, \.ui-row, \.ui-dl,[^)]*\):lang\(ko\) \{ word-break: keep-all; \}/,
    );
  });

  it('parses as CSS in the DOM', () => {
    const style = document.createElement('style');
    style.textContent = kitCss;
    document.head.append(style);
    expect(style.sheet?.cssRules.length ?? 0).toBeGreaterThan(40);
    style.remove();
  });
});
