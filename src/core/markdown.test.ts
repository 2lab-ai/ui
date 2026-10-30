import { describe, expect, it } from 'vitest';
import { MAX_QUOTE_DEPTH, markdownHtml } from './markdown';

const ms = (f: () => void) => {
  const t = performance.now();
  f();
  return performance.now() - t;
};

describe('markdownHtml on hostile input', () => {
  it('stays linear on unclosed link brackets (no backtracking blow-up)', () => {
    const open = '[a]('.repeat(12_500); // 50K characters of links that never close
    const brackets = '['.repeat(50_000);
    const pad = `[a](${'x'.repeat(2040)}`.repeat(25); // long targets that never close
    expect(ms(() => markdownHtml(open))).toBeLessThan(500);
    expect(ms(() => markdownHtml(brackets))).toBeLessThan(500);
    expect(ms(() => markdownHtml(pad))).toBeLessThan(500);
  });

  it('still links a normal http(s) link and drops a javascript: one', () => {
    expect(markdownHtml('[docs](https://ui.2lab.ai/docs)')).toContain('href="https://ui.2lab.ai/docs"');
    expect(markdownHtml('[x](javascript:alert(1))')).not.toContain('href=');
    expect(markdownHtml('[w](https://en.wikipedia.org/wiki/Foo_(bar))')).toContain(
      'href="https://en.wikipedia.org/wiki/Foo_(bar)"',
    );
  });

  it('stops nesting quotes at MAX_QUOTE_DEPTH instead of overflowing the stack', () => {
    const deep = `${'> '.repeat(5000)}deep`;
    let html = '';
    expect(() => {
      html = markdownHtml(deep);
    }).not.toThrow();
    expect(html.split('<blockquote>').length - 1).toBe(MAX_QUOTE_DEPTH);
    expect(html).toContain('deep');
    expect(html).not.toContain('<script');
  });

  it('nests shallow quotes as before', () => {
    expect(markdownHtml('> a\n> > b').replace(/\n/g, '')).toBe(
      '<blockquote><p>a</p><blockquote><p>b</p></blockquote></blockquote>',
    );
  });
});
