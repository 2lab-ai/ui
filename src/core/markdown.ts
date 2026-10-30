import { esc, escAttr, safeHref } from './html';

/**
 * Safe markdown → HTML: the soma-work dashboard's `renderMarkdownDoc`, shared by `<ui-ai-answer>` (answers) and
 * `<ui-artifact-viewer>` (markdown documents). Everything is escaped before it is marked up; raw HTML never
 * survives; only http(s) targets become links. Style the output with `mdDocCss` on a `.md-doc` container.
 */
const HTTP = /^https?:\/\//i;
/** Placeholders (private-use code points, stripped from the input) for code spans and links while marks run. */
const CODE = '\uE000';
const LINK = '\uE001';

/** `&`-entities back to text (the inverse of esc / escAttr). */
export function unescHtml(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Builds the markup for one http(s) link: `href` is plain text, `labelHtml` is already safe HTML. */
export type LinkRenderer = (href: string, labelHtml: string) => string;

const plainLink: LinkRenderer = (href, label) =>
  `<a href="${safeHref(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;

/** Bold, italic and strike on already-escaped text. */
function marks(t: string): string {
  return t
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
}

/** Inline marks on one line: escape first, then code spans, links (http(s) only), bold, italic, strike. */
function mdInline(s: string, link: LinkRenderer): string {
  const codes: string[] = [];
  const rawCodes: string[] = [];
  const links: string[] = [];
  // Code HTML goes back only into text/label positions; a URL gets the raw backtick text back instead, so a code
  // span inside a link target can never place markup (or a quote) into the href attribute.
  const restoreCodes = (x: string) => x.replace(/\uE000(\d+)\uE000/g, (_m, i) => codes[Number(i)] ?? '');
  const restoreRaw = (x: string) => x.replace(/\uE000(\d+)\uE000/g, (_m, i) => `\`${rawCodes[Number(i)] ?? ''}\``);
  let t = String(s ?? '')
    .replace(/[\uE000\uE001]/g, '')
    .replace(/`([^`]+)`/g, (_m, c: string) => {
      codes.push(`<code>${escAttr(c)}</code>`);
      rawCodes.push(c);
      return `${CODE}${codes.length - 1}${CODE}`;
    });
  t = esc(t);
  // Links become placeholders so emphasis never reaches into an href.
  t = t.replace(/!?\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    const url = restoreRaw(unescHtml(href));
    if (!HTTP.test(url)) return label;
    links.push(link(url, restoreCodes(marks(label))));
    return `${LINK}${links.length - 1}${LINK}`;
  });
  t = marks(t);
  t = t.replace(/\uE001(\d+)\uE001/g, (_m, i) => links[Number(i)] ?? '');
  return restoreCodes(t);
}

/**
 * Markdown as a document — the dashboard’s `renderMarkdownDoc`: headings, paragraphs, nested lists, tables,
 * fenced code, quotes, rules. Everything is escaped before it is marked up; only http(s) links are links.
 */
export function markdownHtml(src: string, link: LinkRenderer = plainLink): string {
  const lines = String(src ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const out: string[] = [];
  let para: string[] = [];
  let i = 0;
  const inline = (s: string) => mdInline(s, link);
  const flush = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
    para = [];
  };
  const cells = (l: string) =>
    l
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());
  const listRe = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/);
    if (fence) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) {
        code.push(lines[i]);
        i++;
      }
      i++;
      out.push(
        `<pre class="md-code"><code${fence[2] ? ` data-lang="${escAttr(fence[2])}"` : ''}>${esc(code.join('\n'))}</code></pre>`,
      );
      continue;
    }
    if (!line.trim()) {
      flush();
      i++;
      continue;
    }
    const h = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) {
      flush();
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      out.push('<hr>');
      i++;
      continue;
    }
    if (/^\s{0,3}>/.test(line)) {
      flush();
      const quote: string[] = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s{0,3}>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${markdownHtml(quote.join('\n'), link)}</blockquote>`);
      continue;
    }
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(lines[i + 1])
    ) {
      flush();
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(cells(lines[i]));
        i++;
      }
      out.push(
        `<div class="md-table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${head.map((_c, k) => `<td>${inline(r[k] ?? '')}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`,
      );
      continue;
    }
    if (listRe.test(line)) {
      flush();
      const items: Array<{ indent: number; ordered: boolean; text: string }> = [];
      while (i < lines.length) {
        const m = lines[i].match(listRe);
        if (m) {
          items.push({ indent: m[1].replace(/\t/g, '    ').length, ordered: /\d/.test(m[2]), text: m[3] });
          i++;
          continue;
        }
        if (items.length && /^\s{2,}\S/.test(lines[i])) {
          items[items.length - 1].text += ` ${lines[i].trim()}`;
          i++;
          continue;
        }
        break;
      }
      let html = '';
      const stack: Array<{ indent: number; tag: string }> = [];
      for (const it of items) {
        while (stack.length > 1 && it.indent < stack[stack.length - 1].indent) html += `</li></${stack.pop()!.tag}>`;
        const top = stack[stack.length - 1];
        if (!top || it.indent > top.indent) {
          const tag = it.ordered ? 'ol' : 'ul';
          stack.push({ indent: it.indent, tag });
          html += `<${tag}><li>`;
        } else {
          html += '</li><li>';
        }
        html += inline(it.text);
      }
      while (stack.length) html += `</li></${stack.pop()!.tag}>`;
      out.push(html);
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flush();
  return out.join('\n');
}

/** Styles for markdownHtml() output inside a `.md-doc` container (component tokens only). */
export const mdDocCss = `
.md-doc { color: var(--text); word-break: break-word; }
.md-doc h1, .md-doc h2, .md-doc h3, .md-doc h4, .md-doc h5, .md-doc h6 { margin: 1.3em 0 0.5em; line-height: 1.3; letter-spacing: -0.01em; }
.md-doc h1, .md-doc h2 { font-size: 1.15em; }
.md-doc h3, .md-doc h4, .md-doc h5, .md-doc h6 { font-size: 1em; }
.md-doc > :first-child { margin-top: 0; }
.md-doc p, .md-doc ul, .md-doc ol, .md-doc blockquote, .md-doc pre, .md-doc .md-table { margin: 0 0 0.9em; }
.md-doc ul, .md-doc ol { padding-left: 1.4em; }
.md-doc li + li { margin-top: 0.2em; }
.md-doc li > ul, .md-doc li > ol { margin: 0.2em 0 0; }
.md-doc code { padding: 0.1em 0.35em; border-radius: 4px; background: var(--ib-pill); font: 0.88em var(--mono); }
.md-doc pre { padding: 12px 14px; overflow: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--ib-col); }
.md-doc pre code { padding: 0; background: none; font-size: 12.5px; line-height: 1.55; }
.md-doc blockquote { padding: 2px 0 2px 12px; border-left: 3px solid var(--border-focus); color: var(--text-secondary); }
.md-doc blockquote > :last-child { margin-bottom: 0; }
.md-doc hr { margin: 1.4em 0; border: 0; border-top: 1px solid var(--border); }
.md-doc a { color: var(--accent); }
.md-doc .md-table { overflow-x: auto; }
.md-doc table { border-collapse: collapse; font-size: 0.93em; }
.md-doc th, .md-doc td { padding: 6px 10px; border: 1px solid var(--border); text-align: left; vertical-align: top; }
.md-doc th { background: var(--ib-col); font-weight: 600; }
`;
