import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  answerCopyText,
  answerLinkInfo,
  answerLinkify,
  answerMarkdown,
  answerTookLabel,
  renderAnswer,
  type UiAiAnswer,
} from './ai-answer';

function mount(data: UiAiAnswer['data'], attrs: Record<string, string> = {}): UiAiAnswer {
  const el = document.createElement('ui-ai-answer') as UiAiAnswer;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  el.data = data;
  el.renderNow();
  return el;
}
const q = (el: UiAiAnswer, s: string) => el.shadowRoot!.querySelector(s) as HTMLElement | null;
const qa = (el: UiAiAnswer, s: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(s));
const flush = () => new Promise((r) => setTimeout(r, 0));
const UiAiAnswerCtor = () => customElements.get('ui-ai-answer') as unknown as { styles: string[] };

const PR = 'https://github.com/2lab-ai/soma-work/pull/999';
const XSS = '<img src=x onerror=alert(1)>';

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('answerLinkify (dashboard ansLinkify)', () => {
  it('turns a bare URL into a markdown link and leaves trailing punctuation outside', () => {
    expect(answerLinkify('See https://a.dev/x.')).toBe('See [https://a.dev/x](https://a.dev/x).');
    expect(answerLinkify('(https://a.dev/x), next')).toBe('([https://a.dev/x](https://a.dev/x)), next');
    expect(answerLinkify('go https://a.dev/x?!*')).toBe('go [https://a.dev/x](https://a.dev/x)?!*');
  });
  it('keeps balanced parentheses in the URL, percent-encoded for the link target', () => {
    expect(answerLinkify('https://en.wikipedia.org/wiki/Foo_(bar).')).toBe(
      '[https://en.wikipedia.org/wiki/Foo_(bar)](https://en.wikipedia.org/wiki/Foo_%28bar%29).',
    );
  });
  it('reads <url> and <url|label>', () => {
    expect(answerLinkify('<https://a.dev/x|the [docs]>')).toBe('[the docs](https://a.dev/x)');
    expect(answerLinkify('<https://a.dev/x>')).toBe('[https://a.dev/x](https://a.dev/x)');
  });
  it('protects markdown links first — a code-span label keeps its URL, a parenthesised target is encoded', () => {
    expect(answerLinkify('See [`src/foo.ts`](https://github.com/o/r/blob/main/src/foo.ts)')).toBe(
      'See [`src/foo.ts`](https://github.com/o/r/blob/main/src/foo.ts)',
    );
    expect(answerLinkify('[Foo](https://en.wikipedia.org/wiki/Foo_(bar))')).toBe(
      '[Foo](https://en.wikipedia.org/wiki/Foo_%28bar%29)',
    );
  });
  it('leaves code spans, fences and non-http schemes alone', () => {
    expect(answerLinkify('run `curl https://a.dev/x` now')).toBe('run `curl https://a.dev/x` now');
    const fenced = '```sh\ncurl https://a.dev/x\n```\nafter https://b.dev';
    expect(answerLinkify(fenced)).toBe('```sh\ncurl https://a.dev/x\n```\nafter [https://b.dev](https://b.dev)');
    expect(answerLinkify('javascript:alert(1) ftp://x.dev/y')).toBe('javascript:alert(1) ftp://x.dev/y');
  });
  it('treats a fence inside a > quote as a fence, ended by the quote', () => {
    const quoted = '> ```sh\n> curl https://example.com\n> ```\nhttps://b.dev';
    expect(answerLinkify(quoted)).toBe('> ```sh\n> curl https://example.com\n> ```\n[https://b.dev](https://b.dev)');
    const open = '> ```\n> https://a.dev\nhttps://b.dev';
    expect(answerLinkify(open)).toBe('> ```\n> https://a.dev\n[https://b.dev](https://b.dev)');
  });
});

describe('answerMarkdown (dashboard renderMarkdownDoc)', () => {
  it('renders headings, lists, emphasis, code, tables, quotes and rules', () => {
    const html = answerMarkdown(
      '## Title\n\n**bold** *it* ~~old~~ `code`\n\n- a\n  - b\n\n1. c\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n> quote\n\n---\n\n```ts\nconst x = 1 < 2;\n```',
    );
    expect(html).toContain('<h2>Title</h2>');
    expect(html).toContain('<strong>bold</strong> <em>it</em> <del>old</del> <code>code</code>');
    expect(html).toContain('<ul><li>a<ul><li>b</li></ul></li></ul>');
    expect(html).toContain('<ol><li>c</li></ol>');
    expect(html).toContain('<th>A</th><th>B</th>');
    expect(html).toContain('<td>1</td><td>2</td>');
    expect(html).toContain('<blockquote><p>quote</p></blockquote>');
    expect(html).toContain('<hr>');
    expect(html).toContain('<pre class="md-code"><code data-lang="ts">const x = 1 &lt; 2;</code></pre>');
  });
  it('a code span inside a link target cannot break out of the href (review P1)', () => {
    const md = '[x](https://example.com/`"onmouseover="globalThis.__x=1"data-x="`)';
    const host = document.createElement('div');
    host.innerHTML = answerMarkdown(md);
    const a = host.querySelector('a');
    expect(host.querySelector('[onmouseover]')).toBeNull();
    expect(a?.getAttributeNames().sort()).toEqual(['href', 'rel', 'target']);
    expect(a?.getAttribute('href')).toContain('example.com/');
    const el = mount({ markdown: md });
    expect(el.shadowRoot!.querySelector('[onmouseover]')).toBeNull();
  });

  it('escapes raw HTML and links only http(s)', () => {
    const html = answerMarkdown(`**a** <script>x</script> [x](javascript:alert(1)) [y](https://y.dev) ${XSS}`);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('<a href="https://y.dev" target="_blank" rel="noopener noreferrer">y</a>');
  });
  it('never lets emphasis reach into an href, and keeps a quote out of the attribute', () => {
    const html = answerMarkdown('[a](https://x.dev/*b*/c) [q"](https://x.dev/a"onmouseover=1)');
    expect(html).toContain('href="https://x.dev/*b*/c"');
    expect(html).toContain('href="https://x.dev/a&quot;onmouseover=1"');
  });
});

describe('links (dashboard renderAnswer · ansSourceOf)', () => {
  it('numbers links by first appearance, one per URL (trailing slash ignored), later label fills the title', () => {
    const { links } = renderAnswer('https://a.dev/x and https://b.dev then [Docs](https://a.dev/x/)');
    expect(links.map((l) => [l.n, l.href, l.title])).toEqual([
      [1, 'https://a.dev/x', 'Docs'],
      [2, 'https://b.dev', 'b.dev'],
    ]);
  });
  it('leaves an undefined [1] as text and invents no chip', () => {
    const r = renderAnswer('As said [1] and [1,2].');
    expect(r.links).toEqual([]);
    expect(r.html).toContain('[1]');
    expect(r.html).not.toContain('ans-cite');
  });
  it('a bare URL becomes only the chip; a labelled link keeps its words then the chip', () => {
    const bare = renderAnswer(`PR: ${PR}`, { titles: { [PR]: 'feat(dashboard): model picker' } });
    expect(bare.html).toContain('aria-label="Link 1: feat(dashboard): model picker (GitHub)">#999</a>');
    expect(bare.html).not.toContain(`>${PR}<`);
    const labelled = renderAnswer('[the docs](https://a.dev/d)');
    expect(labelled.html).toMatch(/<p>the docs<a class="ans-cite" data-n="1"[^>]*>a\.dev<\/a><\/p>/);
  });
  it('keeps short punctuation or a particle written after a link on the chip’s line', () => {
    expect(renderAnswer('(commit https://github.com/o/r/commit/3f9c2e1b7a04).').html).toMatch(
      /<span class="ans-nb"><a class="ans-cite"[^>]*>3f9c2e1<\/a>\)\.<\/span>/,
    );
    expect(renderAnswer('[파일](https://a.dev/f)가 바뀜').html).toMatch(
      /<span class="ans-nb"><a [^>]*>a\.dev<\/a>가<\/span> 바뀜/,
    );
    expect(renderAnswer('https://a.dev/x then').html).not.toContain('ans-nb');
    expect(renderAnswer('[x](https://a.dev/x)/a/very/long/path/that/never/ends').html).not.toContain('ans-nb');
  });
  it('restores parentheses of an encoded URL in href and title', () => {
    const r = renderAnswer('https://en.wikipedia.org/wiki/Latency_(engineering).');
    expect(r.links[0].href).toBe('https://en.wikipedia.org/wiki/Latency_(engineering)');
    expect(r.links[0].title).toBe('/wiki/Latency_(engineering)');
    expect(r.html).toContain('href="https://en.wikipedia.org/wiki/Latency_(engineering)"');
  });
  it('names GitHub PRs, issues, commits and repo paths; other hosts by host and path', () => {
    const info = (u: string, lang: 'en' | 'ko' = 'en') => {
      const { name, title, chip } = answerLinkInfo(u, '', lang);
      return [name, title, chip];
    };
    expect(info(PR)).toEqual(['GitHub', 'PR #999 · 2lab-ai/soma-work', '#999']);
    expect(info('https://github.com/o/r/issues/12')).toEqual(['GitHub', 'Issue #12 · o/r', '#12']);
    expect(info('https://github.com/o/r/issues/12', 'ko')).toEqual(['GitHub', '이슈 #12 · o/r', '#12']);
    expect(info('https://github.com/o/r/commit/3f9c2e1b7a04')).toEqual(['GitHub', 'Commit 3f9c2e1 · o/r', '3f9c2e1']);
    expect(info('https://github.com/o/r/commit/3f9c2e1b7a04', 'ko')[1]).toBe('커밋 3f9c2e1 · o/r');
    expect(info('https://github.com/o/r/blob/main/a%20b.ts')).toEqual(['GitHub', 'o/r · blob/main/a b.ts', 'GitHub']);
    expect(info('https://github.com/o/r')).toEqual(['GitHub', 'o/r', 'GitHub']);
    expect(info('https://www.Example.com/docs/a/?q=1')).toEqual(['example.com', '/docs/a/?q=1', 'example.com']);
    expect(info('https://example.com/')).toEqual(['example.com', 'example.com', 'example.com']);
    expect(answerLinkInfo('https://a.dev/x', 'Label').title).toBe('Label');
    expect(answerLinkInfo(`${PR}/`, 'Label', 'en', { [PR]: 'Known' }).title).toBe('Known');
  });
});

describe('answerCopyText · answerTookLabel', () => {
  it('copies the markdown as written plus numbered links', () => {
    const { links } = renderAnswer(`**Done** ${PR}`, { titles: { [PR]: 'feat: picker' } });
    expect(answerCopyText(`  **Done** ${PR}\n`, links)).toBe(`**Done** ${PR}\n\nLinks:\n[1] feat: picker – ${PR}`);
    expect(answerCopyText('plain', [], 'ko')).toBe('plain');
    expect(answerCopyText('x', links, 'ko')).toBe(`x\n\n링크:\n[1] feat: picker – ${PR}`);
  });
  it('formats the response time like the dashboard', () => {
    const rows: Array<[number, string, string]> = [
      [0, '', ''],
      [-5, '', ''],
      [Number.NaN, '', ''],
      [500, 'Responded in under 1s', '응답 1초 미만'],
      [42_000, 'Responded in 42s', '응답 42초'],
      [252_000, 'Responded in 4m 12s', '응답 4분 12초'],
      [3_780_000, 'Responded in 1h 3m', '응답 1시간 3분'],
    ];
    for (const [ms, en, ko] of rows) {
      expect(answerTookLabel(ms)).toBe(en);
      expect(answerTookLabel(ms, 'ko')).toBe(ko);
    }
  });
});

const ANSWER = `Shipped: ${PR}\n\n- see [the issue](https://github.com/o/r/issues/7) and https://example.com/docs\n- again ${PR}`;

describe('<ui-ai-answer>', () => {
  it('renders nothing without data', () => {
    const el = mount(undefined);
    expect(q(el, '.ans-card')).toBeNull();
  });

  it('renders the link row above the body, the label, chips and the footer', () => {
    const el = mount({ markdown: ANSWER, responseMs: 252_000, linkTitles: { [PR]: 'feat: picker' } });
    const card = q(el, '.ans-card')!;
    expect(Array.from(card.children).map((c) => c.className)).toEqual([
      'ans-srcs',
      'ans-label',
      'ans-body md-doc',
      'ans-foot',
    ]);
    expect(q(el, '.ans-srcs')?.getAttribute('aria-label')).toBe('3 links in this answer');
    expect(qa(el, '.ans-src').map((a) => a.textContent)).toEqual([
      'GitHub1feat: picker',
      'GitHub2the issue',
      'example.com3/docs',
    ]);
    expect(q(el, '.ans-src')?.getAttribute('title')).toBe(PR);
    expect(q(el, '.ans-label')?.textContent).toBe('Answer · 3 links');
    expect(qa(el, '.ans-cite').map((c) => `${c.dataset.n}:${c.textContent}`)).toEqual([
      '1:#999',
      '2:#7',
      '3:example.com',
      '1:#999',
    ]);
    for (const a of qa(el, 'a')) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    }
    expect(q(el, '.ans-took')?.textContent).toBe('Responded in 4m 12s');
    expect(q(el, '.ans-copy')?.textContent).toBe('Copy');
    expect(q(el, '.ans-card')?.classList.contains('is-in')).toBe(true);
  });

  it('says “Answer” and draws no row without links; no time without responseMs', () => {
    const el = mount({ markdown: 'Just **text** [1].', title: 'Why?' });
    expect(q(el, '.ans-title')?.textContent).toBe('Why?');
    expect(q(el, '.ans-srcs')).toBeNull();
    expect(q(el, '.ans-label')?.textContent).toBe('Answer');
    expect(q(el, '.ans-took')).toBeNull();
    expect(q(el, '.ans-body')?.innerHTML).toContain('<strong>text</strong> [1].');
  });

  it('escapes every model / host string', () => {
    const el = mount({
      title: XSS,
      markdown: `${XSS} [${XSS}](https://a.dev/x) [q"x](https://b.dev) \`${XSS}\`\n\n\`\`\`${XSS}\n${XSS}\n\`\`\``,
      error: XSS,
      linkTitles: { 'https://b.dev': XSS },
      responseMs: 1000,
    });
    expect(qa(el, 'img')).toHaveLength(0);
    expect(q(el, '.ans-title')?.textContent).toBe(XSS);
    expect(q(el, '.ans-error')?.textContent).toContain(XSS);
    expect(q(el, '.ans-src[data-n="2"] .ans-src-title')?.textContent).toBe(XSS);
    const chip = q(el, '.ans-cite[data-n="2"]')!;
    expect(chip.getAttribute('aria-label')).toBe(`Link 2: ${XSS} (b.dev)`);
    // Attribute values are serialized with a raw `<` — what matters is that no element or handler was created.
    expect(qa(el, 'script, [onerror]')).toHaveLength(0);
    expect(q(el, '.ans-body')?.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('streams: aria-busy, writing row instead of Copy, links found so far', () => {
    const el = mount({ markdown: `Checking ${PR} —`, streaming: true });
    const card = q(el, '.ans-card')!;
    expect(card.getAttribute('aria-busy')).toBe('true');
    expect(q(el, '.ans-shimmer')?.textContent).toBe('Writing the answer');
    expect(q(el, '.ans-dot')?.getAttribute('aria-hidden')).toBe('true');
    expect(q(el, '.ans-copy')).toBeNull();
    expect(qa(el, '.ans-src')).toHaveLength(1);
    expect(card.classList.contains('is-in')).toBe(false);
  });

  it('streaming with no text yet draws only the writing row: no label, no body, no footer rule', () => {
    const el = mount({ markdown: '', streaming: true });
    const card = q(el, '.ans-card')!;
    expect(card.getAttribute('aria-busy')).toBe('true');
    expect(card.classList.contains('is-pending')).toBe(true);
    expect(q(el, '.ans-label')).toBeNull();
    expect(q(el, '.ans-body')).toBeNull();
    expect(q(el, '.ans-foot')).toBeNull();
    expect(q(el, '.ans-copy')).toBeNull();
    expect(q(el, '.ans-shimmer')?.textContent).toBe('Writing the answer');
    expect(q(el, '.ans-dot')?.getAttribute('aria-hidden')).toBe('true');
    expect(card.getAttribute('aria-label')).toBe('Answer');
    // The first words arrive: the full card takes over.
    el.data = { markdown: 'Hello', streaming: true };
    el.renderNow();
    expect(q(el, '.ans-label')?.textContent).toBe('Answer');
    expect(q(el, '.ans-foot.is-writing .ans-writing')).not.toBeNull();
    const ko = mount({ markdown: '', streaming: true }, { lang: 'ko' });
    expect(q(ko, '.ans-shimmer')?.textContent).toBe('응답 작성 중');
  });

  it('animate: false paints the answer without the entry motion (a repaint from the host cache)', () => {
    expect(q(mount({ markdown: `Done: ${PR}` }), '.ans-card')?.classList.contains('is-in')).toBe(true);
    const el = mount({ markdown: `Done: ${PR}`, animate: false });
    expect(q(el, '.ans-card')?.classList.contains('is-in')).toBe(false);
    expect(qa(el, '.ans-src')).toHaveLength(1);
    el.data = { markdown: 'A different answer', animate: false };
    el.renderNow();
    expect(q(el, '.ans-card')?.classList.contains('is-in')).toBe(false);
  });

  it('flat drops the card frame: no border, radius, background, shadow or side padding', () => {
    const css = (UiAiAnswerCtor().styles as string[]).join('\n');
    const rule = /:host\(\[flat\]\) \.ans-card \{([^}]*)\}/.exec(css);
    expect(rule).not.toBeNull();
    const body = rule![1];
    for (const decl of ['border: 0', 'border-radius: 0', 'background: none', 'box-shadow: none', 'padding: 2px 0 0'])
      expect(body).toContain(decl);
    expect(css).toMatch(/:host\(\[flat\]\) \.ans-srcs \{[^}]*margin: -4px 0 8px; padding: 4px 0;/);
    const el = mount({ markdown: `Done: ${PR}` }, { flat: '' });
    expect(q(el, '.ans-card')).not.toBeNull();
  });

  it('does not replay the entry motion for a streamed continuation', () => {
    const el = mount({ markdown: 'Hello', streaming: true });
    el.data = { markdown: 'Hello world', streaming: false, responseMs: 900 };
    el.renderNow();
    expect(q(el, '.ans-card')?.classList.contains('is-in')).toBe(false);
    el.data = { markdown: 'A different answer' };
    el.renderNow();
    expect(q(el, '.ans-card')?.classList.contains('is-in')).toBe(true);
  });

  it('shows loading, empty and failed states', () => {
    const loading = mount({ markdown: '', loading: true });
    expect(q(loading, '.ans-loading')?.textContent).toBe('Loading…');
    expect(q(loading, '.ans-card')?.getAttribute('aria-busy')).toBe('true');
    expect(q(mount({ markdown: '  ' }), '.ans-empty')?.textContent).toBe('No answer text was recorded');
    const failed = mount({ markdown: '', error: 'HTTP 404' });
    expect(q(failed, '.ans-error')?.textContent).toBe('Couldn’t get the answer (HTTP 404)');
    expect(q(failed, '.ans-retry')).toBeNull();
  });

  it('emits ui-retry from “Try again” only when canRetry', () => {
    const el = mount({ markdown: '', error: 'HTTP 500', canRetry: true });
    const fired = vi.fn();
    el.addEventListener('ui-retry', fired);
    q(el, '.ans-retry')!.click();
    expect(fired).toHaveBeenCalledTimes(1);
    const partial = mount({ markdown: 'Half an answer', error: 'stream closed', canRetry: true });
    expect(q(partial, '.ans-foot .ans-error')?.textContent).toBe('Couldn’t get the answer (stream closed)');
    expect(q(partial, '.ans-foot .ans-retry')).not.toBeNull();
  });

  it('Copy emits ui-copy {text}, writes the clipboard and says Copied (then reverts)', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({ writeText } as unknown as Clipboard);
    const el = mount({ markdown: ANSWER, linkTitles: { [PR]: 'feat: picker' } });
    const seen: string[] = [];
    el.addEventListener('ui-copy', (e) => seen.push((e as CustomEvent<{ text: string }>).detail.text));
    vi.useFakeTimers();
    q(el, '.ans-copy')!.click();
    const expected = answerCopyText(ANSWER, el.links);
    expect(seen).toEqual([expected]);
    expect(expected).toContain('Links:\n[1] feat: picker – https://github.com/2lab-ai/soma-work/pull/999');
    expect(writeText).toHaveBeenCalledWith(expected);
    await Promise.resolve();
    await Promise.resolve();
    expect(q(el, '.ans-copy')?.textContent).toBe('Copied');
    expect(q(el, '.ans-copy')?.hasAttribute('data-copied')).toBe(true);
    expect(q(el, '.ans-status')?.textContent).toBe('Copied the answer and 3 links');
    vi.advanceTimersByTime(1500);
    expect(q(el, '.ans-copy')?.textContent).toBe('Copy');
    expect(q(el, '.ans-status')?.textContent).toBe('');
  });

  it('a cancelled ui-copy leaves the clipboard to the host', () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({ writeText } as unknown as Clipboard);
    const el = mount({ markdown: 'text' });
    el.addEventListener('ui-copy', (e) => e.preventDefault());
    q(el, '.ans-copy')!.click();
    expect(writeText).not.toHaveBeenCalled();
    expect(q(el, '.ans-copy')?.textContent).toBe('Copy');
  });

  it('without a clipboard it selects the answer and says how to copy', async () => {
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue(undefined as unknown as Clipboard);
    const el = mount({ markdown: 'text' }, { lang: 'ko' });
    q(el, '.ans-copy')!.click();
    await flush();
    expect(q(el, '.ans-status')?.textContent).toBe('선택했습니다 — ⌘C / Ctrl+C로 복사');
    expect(q(el, '.ans-copy')?.textContent).toBe('복사');
  });

  it('emits ui-link {url, index, from}; preventDefault keeps the page', () => {
    const el = mount({ markdown: ANSWER });
    const seen: unknown[] = [];
    el.addEventListener('ui-link', (e) => seen.push((e as CustomEvent).detail));
    const chip = qa(el, '.ans-cite')[2];
    const open = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true });
    chip.dispatchEvent(open);
    expect(seen[0]).toEqual({ url: 'https://example.com/docs', index: 2, from: 'chip' });
    expect(open.defaultPrevented).toBe(false);
    el.addEventListener('ui-link', (e) => e.preventDefault());
    const kept = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true });
    q(el, '.ans-src[data-n="1"]')!.dispatchEvent(kept);
    expect(seen[1]).toEqual({ url: PR, index: 0, from: 'card' });
    expect(kept.defaultPrevented).toBe(true);
  });

  it('lights the pair on chip / card hover and focus, and clears on leave', () => {
    const el = mount({ markdown: ANSWER });
    const lit = () =>
      qa(el, '.is-lit').map((x) => `${x.classList.contains('ans-src') ? 'card' : 'chip'}${x.dataset.n}`);
    const chip = qa(el, '.ans-cite')[0];
    chip.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
    expect(lit()).toEqual(['card1', 'chip1', 'chip1']);
    chip.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
    expect(lit()).toEqual([]);
    const card = q(el, '.ans-src[data-n="2"] .ans-src-title')!;
    card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }));
    expect(lit()).toEqual(['card2', 'chip2']);
    // Lit state lives outside the markup: a re-render keeps it.
    el.renderNow();
    expect(lit()).toEqual(['card2', 'chip2']);
    card.dispatchEvent(
      new MouseEvent('mouseout', { bubbles: true, composed: true, relatedTarget: q(el, '.ans-src[data-n="2"]') }),
    );
    expect(lit()).toEqual(['card2', 'chip2']);
    q(el, '.ans-src[data-n="2"]')!.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, composed: true }));
    expect(lit()).toEqual([]);
  });

  it('slides only the link row to a lit card outside it (never scrollIntoView)', () => {
    const el = mount({ markdown: ANSWER });
    const row = q(el, '.ans-srcs')!;
    const rect = (left: number, right: number) => ({ left, right, top: 0, bottom: 0 }) as DOMRect;
    row.getBoundingClientRect = () => rect(0, 300);
    Object.defineProperty(row, 'scrollWidth', { value: 1000 });
    Object.defineProperty(row, 'clientWidth', { value: 300 });
    q(el, '.ans-src[data-n="1"]')!.getBoundingClientRect = () => rect(14, 186);
    q(el, '.ans-src[data-n="3"]')!.getBoundingClientRect = () => rect(374, 546);
    const scrollTo = vi.fn();
    row.scrollTo = scrollTo as unknown as typeof row.scrollTo;
    const intoView = vi.fn();
    for (const x of qa(el, '*')) x.scrollIntoView = intoView;
    const over = (n: number) =>
      q(el, `.ans-cite[data-n="${n}"]`)!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }));
    over(1);
    expect(scrollTo).not.toHaveBeenCalled();
    over(3);
    expect(scrollTo).toHaveBeenCalledWith({ left: 262, behavior: expect.stringMatching(/smooth|auto/) });
    expect(intoView).not.toHaveBeenCalled();
  });

  it('tabs cards → chips → Copy, and keeps focus across a re-render', () => {
    const el = mount({ markdown: ANSWER });
    const order = qa(el, 'a, button').map((x) =>
      x.classList.contains('ans-src') ? 'card' : x.classList.contains('ans-cite') ? 'chip' : 'copy',
    );
    expect(order).toEqual(['card', 'card', 'card', 'chip', 'chip', 'chip', 'chip', 'copy']);
    qa(el, '.ans-cite')[1].focus();
    el.data = { markdown: `${ANSWER}\n\nMore.` };
    el.renderNow();
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset.key).toBe('cite-1');
  });

  it('speaks Korean with lang="ko"', () => {
    const el = mount({ markdown: ANSWER, responseMs: 252_000 }, { lang: 'ko' });
    expect(q(el, '.ans-label')?.textContent).toBe('답변 · 링크 3');
    expect(q(el, '.ans-srcs')?.getAttribute('aria-label')).toBe('답변에 포함된 링크 3개');
    expect(q(el, '.ans-cite')?.getAttribute('aria-label')).toBe('링크 1: PR #999 · 2lab-ai/soma-work (GitHub)');
    expect(q(el, '.ans-copy')?.textContent).toBe('복사');
    expect(q(el, '.ans-took')?.textContent).toBe('응답 4분 12초');
    expect(q(mount({ markdown: '' }, { lang: 'ko' }), '.ans-empty')?.textContent).toBe('기록된 답변 내용이 없습니다');
    expect(q(mount({ markdown: '', streaming: true }, { lang: 'ko' }), '.ans-shimmer')?.textContent).toBe(
      '응답 작성 중',
    );
  });

  it('clears the Copied timer when disconnected', async () => {
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({
      writeText: () => Promise.resolve(),
    } as unknown as Clipboard);
    const el = mount({ markdown: 'text' });
    vi.useFakeTimers();
    q(el, '.ans-copy')!.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(1);
    el.remove();
    expect(vi.getTimerCount()).toBe(0);
  });
});
