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
  // D1 gaps (G1-1): the dashboard's remaining inline glyphs.
  'pause',
  'archive',
  'shield',
  'camera',
  'tree',
  'ban',
  'dot',
  'circle-dashed',
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

  it('play and pause share one hand (same height on the grid) for a toggle', () => {
    const box = (n: string) => parse(icon(n)).innerHTML;
    expect(box('play')).toContain('3.25v9.5');
    expect(box('pause').match(/y="3.25"[^>]*height="9.5"/g)).toHaveLength(2);
  });

  it('dot is a filled currentColor disc; circle-dashed is eight arcs; ban crosses the ring', () => {
    const dot = parse(icon('dot')).querySelector('circle');
    expect(dot?.getAttribute('fill')).toBe('currentColor');
    const dashed = parse(icon('circle-dashed')).querySelector('path')?.getAttribute('d') ?? '';
    expect(dashed.match(/M/g)).toHaveLength(8);
    expect(dashed.match(/a|A/g)).toHaveLength(8);
    expect(parse(icon('ban')).querySelector('circle')?.getAttribute('r')).toBe('5.75');
  });

  it('the D1 aliases resolve: branch → tree, circle-slash → ban, shield-check → shield', () => {
    expect(iconName('branch')).toBe('tree');
    expect(iconName('circle-slash')).toBe('ban');
    expect(iconName('shield-check')).toBe('shield');
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
