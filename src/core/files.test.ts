import { describe, expect, it } from 'vitest';
import { fileExt, fileKind, fileKindIcon, fmtBytes } from './files';
import { safeLink, safeSrc } from './html';
import { markdownHtml } from './markdown';

describe('files', () => {
  it('fileExt reads the last extension, ignoring query, hash and folders', () => {
    expect(fileExt('a/b/Report.Final.MD')).toBe('md');
    expect(fileExt('https://x.dev/p/shot.png?w=200#top')).toBe('png');
    expect(fileExt('.env')).toBe('');
    expect(fileExt('README')).toBe('');
    expect(fileExt(undefined)).toBe('');
  });

  it('fileKind prefers an explicit kind, then the MIME type, then the extension', () => {
    expect(fileKind({ kind: 'video', name: 'a.png' })).toBe('video');
    expect(fileKind({ kind: 'nope', name: 'a.png' })).toBe('image');
    expect(fileKind({ mime: 'text/markdown', name: 'a.txt' })).toBe('markdown');
    expect(fileKind({ type: 'audio/webm;codecs=opus' })).toBe('audio');
    expect(fileKind({ mime: 'application/json' })).toBe('code');
    expect(fileKind({ name: 'page.HTML' })).toBe('html');
    expect(fileKind({ name: 'main.rs' })).toBe('code');
    expect(fileKind({ mime: 'text/plain', name: 'notes' })).toBe('text');
    expect(fileKind({ name: 'blob.bin' })).toBe('file');
    expect(fileKind(null)).toBe('file');
  });

  it('fileKindIcon maps every kind to a glyph', () => {
    expect(fileKindIcon('image')).toBe('file-image');
    expect(fileKindIcon('markdown')).toBe('file-text');
    expect(fileKindIcon('html')).toBe('file-code');
    expect(fileKindIcon('file')).toBe('file');
  });

  it('fmtBytes', () => {
    expect(fmtBytes(820)).toBe('820 B');
    expect(fmtBytes(12_700)).toBe('12.4 KB');
    expect(fmtBytes(1024 * 1024 * 3.14)).toBe('3.1 MB');
    expect(fmtBytes(1024 * 1024 * 512)).toBe('512 MB');
    expect(fmtBytes(-1)).toBe('');
    expect(fmtBytes('x')).toBe('');
  });
});

describe('safeLink / safeSrc', () => {
  it('safeLink keeps http(s), mailto and relative links; drops script and other schemes', () => {
    expect(safeLink('https://ui.2lab.ai/x?a=1&b=2')).toBe('https://ui.2lab.ai/x?a=1&amp;b=2');
    expect(safeLink('/settings')).toBe('/settings');
    expect(safeLink('./a')).toBe('./a');
    expect(safeLink('#top')).toBe('#top');
    expect(safeLink('?tab=2')).toBe('?tab=2');
    expect(safeLink('docs/a:b')).toBe('docs/a:b');
    expect(safeLink('javascript:alert(1)')).toBe('#');
    expect(safeLink(' JavaScript:alert(1)')).toBe('#');
    expect(safeLink('data:text/html,x')).toBe('#');
    expect(safeLink('//evil.example')).toBe('#');
    expect(safeLink('/\\evil.example')).toBe('#');
    expect(safeLink('"><script>')).toBe('&quot;&gt;&lt;script&gt;');
    expect(safeLink('')).toBe('#');
  });

  it('safeSrc keeps http(s), relative, blob: and raster data images', () => {
    expect(safeSrc('https://x.dev/a.png')).toBe('https://x.dev/a.png');
    expect(safeSrc('blob:https://x.dev/1234')).toBe('blob:https://x.dev/1234');
    expect(safeSrc('/files/a.png')).toBe('/files/a.png');
    expect(safeSrc('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(safeSrc('data:image/svg+xml;base64,PHN2Zz4=')).toBe('');
    expect(safeSrc('javascript:alert(1)')).toBe('');
    expect(safeSrc('mailto:a@b.c')).toBe('');
    expect(safeSrc(undefined)).toBe('');
  });
});

describe('markdownHtml', () => {
  it('escapes raw HTML and links only http(s)', () => {
    const html = markdownHtml('# Hi <b>x</b>\n\n[ok](https://a.dev) [bad](javascript:alert(1))\n\n```js\n<i>\n```');
    expect(html).toContain('<h1>Hi &lt;b&gt;x&lt;/b&gt;</h1>');
    expect(html).toContain('href="https://a.dev"');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('<pre class="md-code"><code data-lang="js">&lt;i&gt;</code></pre>');
  });
});
