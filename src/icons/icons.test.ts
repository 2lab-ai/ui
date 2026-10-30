import { describe, expect, it } from 'vitest';
import { hasIcon, ICON_ALIASES, ICON_NAMES, icon, iconName } from './icons';

const BRIEF = [
  'brand',
  'chevron-down',
  'chevron-up',
  'chevron-left',
  'chevron-right',
  'close',
  'plus',
  'search',
  'sun',
  'moon',
  'gear',
  'brain',
  'list',
  'user',
  'bot',
  'target',
  'star',
  'file',
  'file-text',
  'file-code',
  'file-image',
  'file-audio',
  'file-video',
  'attach',
  'mic',
  'image',
  'send',
  'check',
  'cross',
  'alert',
  'info',
  'external',
  'copy',
  'refresh',
  'more',
];

function parse(svg: string): SVGSVGElement {
  const box = document.createElement('div');
  box.innerHTML = svg;
  return box.firstElementChild as SVGSVGElement;
}

describe('icons', () => {
  it('ships every glyph the dashboard needs', () => {
    for (const n of BRIEF) expect(ICON_NAMES, n).toContain(n);
  });

  it('draws on the 16 grid with 1.5 round strokes in currentColor, decorative by default', () => {
    for (const n of ICON_NAMES) {
      const svg = parse(icon(n));
      expect(svg.tagName.toLowerCase()).toBe('svg');
      expect(svg.getAttribute('viewBox')).toBe('0 0 16 16');
      expect(svg.getAttribute('stroke')).toBe('currentColor');
      expect(svg.getAttribute('stroke-width')).toBe('1.5');
      expect(svg.getAttribute('stroke-linecap')).toBe('round');
      expect(svg.getAttribute('stroke-linejoin')).toBe('round');
      expect(svg.getAttribute('fill')).toBe('none');
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('data-icon')).toBe(n);
      expect(svg.children.length, n).toBeGreaterThan(0);
    }
  });

  it('never hard-codes a colour inside a glyph', () => {
    for (const n of ICON_NAMES) expect(icon(n), n).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  it('takes a size, a stroke and a class', () => {
    const svg = parse(icon('close', { size: 12, stroke: 1.75, class: 'x y' }));
    expect(svg.getAttribute('width')).toBe('12');
    expect(svg.getAttribute('height')).toBe('12');
    expect(svg.getAttribute('stroke-width')).toBe('1.75');
    expect(svg.getAttribute('class')).toBe('x y');
  });

  it('a label makes it an image with an escaped name', () => {
    const svg = parse(icon('alert', { label: 'Warn "<b>"' }));
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Warn "<b>"');
    expect(svg.getAttribute('aria-hidden')).toBeNull();
    expect(svg.querySelector('title')?.textContent).toBe('Warn "<b>"');
    expect(svg.querySelector('b')).toBeNull();
    const cls = parse(icon('alert', { class: '"><img src=x onerror=alert(1)>' }));
    expect(cls.querySelector('img')).toBeNull();
  });

  it('resolves aliases and returns nothing for unknown names', () => {
    expect(iconName('memory')).toBe('brain');
    expect(iconName('goal')).toBe('target');
    expect(hasIcon('settings')).toBe(true);
    expect(icon('settings')).toContain('data-icon="gear"');
    expect(icon('nope')).toBe('');
    expect(icon('__proto__')).toBe('');
    expect(hasIcon('constructor')).toBe(false);
    for (const target of Object.values(ICON_ALIASES)) expect(ICON_NAMES).toContain(target);
  });
});
