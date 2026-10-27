import { define, prefersReducedMotion, UiElement } from '../../core/element';
import { esc, escAttr, safeHref } from '../../core/html';
import { styles } from './styles';

/**
 * One assistant reply. Links are read out of the markdown itself — they are links the answer contains, not
 * proven sources, so the UI calls them “links” (never “sources” / “citations”).
 */
export interface AiAnswerData {
  /** The answer as the model wrote it (markdown). Rendered safely: raw HTML never survives. */
  markdown: string;
  /** Time from the instruction to the answer, in ms. Shown in the footer; nothing when absent or ≤ 0. */
  responseMs?: number;
  /** More text is coming: shows the writing row, hides Copy, marks the card `aria-busy`. */
  streaming?: boolean;
  /** The host is fetching a recorded answer (no text yet). */
  loading?: boolean;
  /** Optional heading above the card (e.g. the question or the turn’s summary title). */
  title?: string;
  /** Failure detail (e.g. `HTTP 404`). Without text it replaces the answer; with text it shows in the footer. */
  error?: string;
  /** Show “Try again” next to an error (emits `ui-retry`). Default false. */
  canRetry?: boolean;
  /** Titles the host already knows for some URLs (e.g. the PR this session opened). Beat labels and URL-derived titles. */
  linkTitles?: Record<string, string>;
}

/** A link found in the answer, numbered by first appearance (one per URL; a trailing slash is the same URL). */
export interface AnswerLink {
  /** 1-based number shown on the card. */
  n: number;
  href: string;
  /** Site: `GitHub` or the host without `www.`. */
  name: string;
  title: string;
  /** Short chip label: `#123`, a 7-char sha, `GitHub` or the host. */
  chip: string;
}

export type AnswerLang = 'en' | 'ko';

export interface AnswerRender {
  html: string;
  links: AnswerLink[];
}

const COPIED_MS = 1500;
/** Upper bound of a smooth row scroll; a reveal inside it measures from the glide's target. */
const GLIDE_MS = 600;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const STRINGS = {
  en: {
    label: (n: number) => (n ? `Answer · ${plural(n, 'link', 'links')}` : 'Answer'),
    list: (n: number) => `${plural(n, 'link', 'links')} in this answer`,
    cite: (n: number, title: string, name: string) => `Link ${n}: ${title} (${name})`,
    issue: 'Issue',
    commit: 'Commit',
    linksHead: 'Links:',
    copy: 'Copy',
    copied: 'Copied',
    copiedSay: (n: number) => (n ? `Copied the answer and ${plural(n, 'link', 'links')}` : 'Copied the answer'),
    selected: 'Selected — press ⌘C / Ctrl+C to copy',
    writing: 'Writing the answer',
    loading: 'Loading…',
    empty: 'No answer text was recorded',
    failed: 'Couldn’t get the answer',
    retry: 'Try again',
    under: 'Responded in under 1s',
    secs: (s: number) => `Responded in ${s}s`,
    mins: (m: number, s: number) => `Responded in ${m}m ${s}s`,
    hours: (h: number, m: number) => `Responded in ${h}h ${m}m`,
  },
  ko: {
    label: (n: number) => (n ? `답변 · 링크 ${n}` : '답변'),
    list: (n: number) => `답변에 포함된 링크 ${n}개`,
    cite: (n: number, title: string, name: string) => `링크 ${n}: ${title} (${name})`,
    issue: '이슈',
    commit: '커밋',
    linksHead: '링크:',
    copy: '복사',
    copied: '복사됨',
    copiedSay: (n: number) => (n ? `답변과 링크 ${n}개를 복사했습니다` : '답변을 복사했습니다'),
    selected: '선택했습니다 — ⌘C / Ctrl+C로 복사',
    writing: '응답 작성 중',
    loading: '불러오는 중…',
    empty: '기록된 답변 내용이 없습니다',
    failed: '답변을 불러오지 못했습니다',
    retry: '다시 시도',
    under: '응답 1초 미만',
    secs: (s: number) => `응답 ${s}초`,
    mins: (m: number, s: number) => `응답 ${m}분 ${s}초`,
    hours: (h: number, m: number) => `응답 ${h}시간 ${m}분`,
  },
};
type Strings = (typeof STRINGS)['en'];
const strings = (lang?: string): Strings => (lang === 'ko' ? STRINGS.ko : STRINGS.en);

const HTTP = /^https?:\/\//i;
/** Placeholders (private-use code points, stripped from the input) for code spans and links while marks run. */
const CODE = '\uE000';
const LINK = '\uE001';

/** `&`-entities back to text (the inverse of esc / escAttr). */
function unesc(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Plain text of a rendered label. */
const textOf = (html: string) => unesc(html.replace(/<[^>]*>/g, ''));

/** One link per URL: a trailing slash does not make another page. */
export function answerLinkKey(href: string): string {
  return String(href ?? '').replace(/\/+$/, '');
}

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Parens inside a URL travel percent-encoded (a markdown link target stops at the first `)`), read back later. */
const encodeParens = (u: string) => u.replace(/\(/g, '%28').replace(/\)/g, '%29');
const decodeParens = (u: string) => u.replace(/%28/gi, '(').replace(/%29/gi, ')');

/**
 * One stretch of prose (no code span, no markdown link): `<url>`, `<url|label>` and bare http(s) URLs become
 * `[label](url)`. A bare URL leaves trailing `.,;:!?*` and an unmatched `)` outside the link.
 */
function linkifyText(s: string): string {
  return s.replace(
    /<(https?:\/\/[^\s<>|]+)(?:\|([^<>]*))?>|https?:\/\/[^\s<>[\]"'`]+/gi,
    (m: string, url?: string, label?: string) => {
      if (url) {
        const l = String(label ?? '')
          .replace(/[[\]]/g, '')
          .trim();
        return `[${l || url}](${encodeParens(url)})`;
      }
      let u = m;
      let tail = '';
      for (let guard = 0; guard < 8; guard++) {
        const p = u.match(/[.,;:!?*]+$/);
        if (p) {
          tail = p[0] + tail;
          u = u.slice(0, u.length - p[0].length);
          continue;
        }
        if (u.endsWith(')') && u.split('(').length < u.split(')').length) {
          tail = `)${tail}`;
          u = u.slice(0, -1);
          continue;
        }
        break;
      }
      return `[${u}](${encodeParens(u)})${tail}`;
    },
  );
}

/**
 * The dashboard’s `ansLinkify`: every link in the answer as a markdown link. Markdown links are protected first
 * (a label may be a code span, a target may hold balanced parens — encoded), code spans and fenced blocks (also
 * inside a `>` quote; a quoted fence ends with the quote) stay as written, only http(s) is linked.
 */
export function answerLinkify(raw: string): string {
  let fence = '';
  let fenceQuoted = false;
  return String(raw ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => {
      const quoted = /^\s{0,3}>/.test(line);
      const body = line.replace(/^(\s{0,3}>\s?)+/, '');
      if (fence && fenceQuoted && !quoted) fence = '';
      if (fence) {
        if (body.trim().startsWith(fence)) fence = '';
        return line;
      }
      const f = body.match(/^\s{0,3}(`{3,}|~{3,})/);
      if (f) {
        fence = f[1];
        fenceQuoted = quoted;
        return line;
      }
      return line
        .split(/(!?\[[^\]]+\]\((?:[^()\s]|\([^()\s]*\))+\)|`[^`]+`)/)
        .map((part, i) => {
          if (!(i % 2)) return linkifyText(part);
          if (part.startsWith('`')) return part;
          const at = part.indexOf('](');
          return `${part.slice(0, at + 2)}${encodeParens(part.slice(at + 2, -1))})`;
        })
        .join('');
    })
    .join('\n');
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
    const url = restoreRaw(unesc(href));
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
export function answerMarkdown(src: string, link: LinkRenderer = plainLink): string {
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
      out.push(`<blockquote>${answerMarkdown(quote.join('\n'), link)}</blockquote>`);
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

/** What a link card is called — name (site), title and chip label (the dashboard’s `ansSourceOf`). */
export function answerLinkInfo(
  href: string,
  label = '',
  lang: AnswerLang = 'en',
  titles?: Record<string, string>,
): Omit<AnswerLink, 'n'> {
  const t = strings(lang);
  const url = String(href ?? '');
  const m = url.match(/^https?:\/\/([^/?#]+)([^?#]*)(\?[^#]*)?/i);
  const host = m ? m[1].toLowerCase().replace(/^www\./, '') : url;
  const path = m ? m[2] : '';
  let name = host;
  let chip = host;
  let title = '';
  if (host === 'github.com') {
    name = 'GitHub';
    chip = 'GitHub';
    const seg = path.split('/').filter(Boolean);
    const repo = seg.slice(0, 2).join('/');
    const num = seg.length >= 4 && /^\d+$/.test(seg[3]) ? seg[3] : '';
    if (num && seg[2] === 'pull') {
      title = `PR #${num} · ${repo}`;
      chip = `#${num}`;
    } else if (num && seg[2] === 'issues') {
      title = `${t.issue} #${num} · ${repo}`;
      chip = `#${num}`;
    } else if (seg.length >= 4 && seg[2] === 'commit' && /^[0-9a-f]{7,40}$/i.test(seg[3])) {
      chip = seg[3].slice(0, 7);
      title = `${t.commit} ${chip} · ${repo}`;
    } else title = repo ? repo + (seg.length > 2 ? ` · ${decode(seg.slice(2).join('/'))}` : '') : 'github.com';
  } else {
    title = decode((path + (m?.[3] ?? '')).replace(/\/+$/, '')) || host;
  }
  if (label) title = label;
  if (titles) {
    const key = answerLinkKey(url);
    for (const [u, known] of Object.entries(titles)) if (known && answerLinkKey(u) === key) title = String(known);
  }
  return { href: url, name, title, chip };
}

/** A link chip, named after its card. */
function citeHtml(link: AnswerLink, k: number, t: Strings): string {
  return `<a class="ans-cite" data-n="${link.n}" data-key="cite-${k}" href="${safeHref(link.href)}" target="_blank" rel="noopener noreferrer" aria-label="${escAttr(
    t.cite(link.n, link.title, link.name),
  )}">${esc(link.chip)}</a>`;
}

/**
 * The answer as a document plus its links (the dashboard’s `renderAnswer`). Links are numbered by first appearance;
 * every link becomes a chip — a bare URL only the chip, a labelled link its words then the chip. A `[1]` the answer
 * writes without a URL stays text (no invented citations).
 */
export function renderAnswer(
  markdown: string,
  opts: { lang?: AnswerLang; titles?: Record<string, string> } = {},
): AnswerRender {
  const t = strings(opts.lang);
  const md = answerLinkify(markdown);
  const byKey = new Map<string, { href: string; label: string; n: number }>();
  const found: Array<{ href: string; label: string; n: number }> = [];
  answerMarkdown(md, (url, labelHtml) => {
    const href = decodeParens(url);
    const text = textOf(labelHtml);
    const key = answerLinkKey(href);
    const label = text && text !== href ? text : '';
    const seen = byKey.get(key);
    if (!seen) {
      const f = { href, label, n: found.length + 1 };
      byKey.set(key, f);
      found.push(f);
    } else if (!seen.label && label) seen.label = label;
    return '';
  });
  const links = found.map((f) => ({ ...answerLinkInfo(f.href, f.label, opts.lang, opts.titles), n: f.n }));
  let k = 0;
  const html = answerMarkdown(md, (url, labelHtml) => {
    const href = decodeParens(url);
    const link = links[(byKey.get(answerLinkKey(href))?.n ?? 1) - 1];
    return (textOf(labelHtml) === href ? '' : labelHtml) + citeHtml(link, k++, t);
  });
  // Punctuation or a particle written right after a link stays on the chip's line: “(commit 3f9c2e1).”, “#999가”.
  return {
    html: html.replace(
      /(<a class="ans-cite"[^>]*>[^<]*<\/a>)([^\s<]{1,12})(?![^\s<])/g,
      '<span class="ans-nb">$1$2</span>',
    ),
    links,
  };
}

/** What Copy puts on the clipboard: the answer as written (markdown kept) plus its numbered links. */
export function answerCopyText(markdown: string, links: AnswerLink[], lang: AnswerLang = 'en'): string {
  const text = String(markdown ?? '').trim();
  if (!links.length) return text;
  return `${text}\n\n${strings(lang).linksHead}\n${links.map((l) => `[${l.n}] ${l.title} – ${l.href}`).join('\n')}`;
}

/** “Responded in 4m 12s” / “응답 4분 12초”; empty for ≤ 0 or not a number. */
export function answerTookLabel(ms: number, lang: AnswerLang = 'en'): string {
  const t = strings(lang);
  const v = Number(ms);
  if (!Number.isFinite(v) || v <= 0) return '';
  if (v < 1000) return t.under;
  const sec = Math.floor(v / 1000);
  if (sec < 60) return t.secs(sec);
  const min = Math.floor(sec / 60);
  if (min < 60) return t.mins(min, sec % 60);
  return t.hours(Math.floor(min / 60), min % 60);
}

const CHECK_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>';

/**
 * `<ui-ai-answer>` — an assistant reply as a card: the markdown rendered safely, the links it contains as a
 * numbered row of link cards plus chips in the text (hover / focus lights the pair), Copy (`ui-copy`), the response
 * time, a writing state while it streams, and loading / empty / failed states.
 */
export class UiAiAnswer extends UiElement<AiAnswerData> {
  static override styles = [styles];
  static get observedAttributes() {
    return ['lang'];
  }

  #links: AnswerLink[] = [];
  #lit = 0;
  #copied = false;
  #status = '';
  #timer = 0;
  #shownMd = '';
  #glide: { left: number; until: number } | null = null;

  constructor() {
    super();
    this.root.addEventListener('mouseover', (e) => this.#hover(e, true));
    this.root.addEventListener('mouseout', (e) => this.#hover(e, false));
    this.root.addEventListener('focusin', (e) => this.#hover(e, true));
    this.root.addEventListener('focusout', (e) => this.#hover(e, false));
    this.root.addEventListener('click', (e) => {
      const t = e.target as Element | null;
      const a = t?.closest?.('a[data-n]');
      if (a) {
        this.#follow(e, a);
        return;
      }
      if (t?.closest?.('.ans-copy')) this.#copy();
      else if (t?.closest?.('.ans-retry')) this.emit('ui-retry', {});
    });
  }

  attributeChangedCallback(): void {
    this.requestRender();
  }

  override disconnectedCallback(): void {
    clearTimeout(this.#timer);
    this.#copied = false;
    this.#status = '';
  }

  /** The links of the last render, in card order. */
  get links(): AnswerLink[] {
    return this.#links.slice();
  }

  get #lang(): AnswerLang {
    return this.getAttribute('lang') === 'ko' ? 'ko' : 'en';
  }

  protected override update(): void {
    // A streaming re-render must not throw the link row back to its start.
    const left = this.$('.ans-srcs')?.scrollLeft ?? 0;
    super.update();
    const row = this.$('.ans-srcs');
    if (row && left) row.scrollLeft = left;
  }

  protected render(): string {
    const d = this.data;
    if (!d) {
      this.#links = [];
      return '';
    }
    const lang = this.#lang;
    const t = strings(lang);
    const md = String(d.markdown ?? '');
    const has = md.trim() !== '';
    const streaming = !!d.streaming;
    const error = d.error ? String(d.error) : '';
    const title = d.title ? `<h3 class="ans-title">${esc(d.title)}</h3>` : '';
    const retry =
      error && d.canRetry
        ? `<button type="button" class="ans-btn ans-retry" data-key="retry">${esc(t.retry)}</button>`
        : '';
    const failed = `<span class="ans-error">${esc(t.failed)}${error ? ` (${esc(error)})` : ''}</span>`;

    // Entry motion runs once per answer — not for a streamed continuation, not for a re-render of the same text.
    const prev = this.#shownMd;
    this.#shownMd = md;
    const enter = has && !streaming && !(prev && md.startsWith(prev));

    if (!has && !streaming) {
      this.#links = [];
      const state = error
        ? `<div class="ans-state">${failed}${retry}</div>`
        : d.loading
          ? `<p class="ans-state ans-loading">${esc(t.loading)}</p>`
          : `<p class="ans-state ans-empty">${esc(t.empty)}</p>`;
      return `<section class="ans-card" aria-label="${escAttr(t.label(0))}"${d.loading && !error ? ' aria-busy="true"' : ''}>${title}${state}</section>`;
    }

    const a = has ? renderAnswer(md, { lang, titles: d.linkTitles }) : { html: '', links: [] };
    this.#links = a.links;
    const n = a.links.length;
    const srcs = n
      ? `<ol class="ans-srcs" aria-label="${escAttr(t.list(n))}">${a.links
          .map(
            (l, i) =>
              `<li style="--ans-i:${Math.min(i, 6)}"><a class="ans-src" data-n="${l.n}" data-key="src-${l.n}" href="${safeHref(
                l.href,
              )}" target="_blank" rel="noopener noreferrer" title="${escAttr(l.href)}"><span class="ans-src-site"><span class="ans-src-name">${esc(
                l.name,
              )}</span><span class="ans-src-num">${l.n}</span></span><span class="ans-src-title">${esc(l.title)}</span></a></li>`,
          )
          .join('')}</ol>`
      : '';
    const body = has ? `<div class="ans-body md-doc">${a.html}</div>` : '';
    let foot: string;
    if (streaming) {
      foot = `<div class="ans-foot is-writing"><span class="ans-writing"><span class="ans-shimmer">${esc(
        t.writing,
      )}</span><i class="ans-dot" aria-hidden="true"></i></span></div>`;
    } else {
      const took = answerTookLabel(Number(d.responseMs), lang);
      const right = error ? `${failed}${retry}` : took ? `<span class="ans-took">${esc(took)}</span>` : '';
      foot = `<div class="ans-foot"><button type="button" class="ans-btn ans-copy" data-key="copy"${
        this.#copied ? ' data-copied' : ''
      }>${this.#copyLabel(t)}</button><span class="ans-status" role="status" aria-live="polite">${esc(
        this.#status,
      )}</span>${right ? `<span class="ans-end">${right}</span>` : ''}</div>`;
    }
    return `<section class="ans-card${enter ? ' is-in' : ''}" aria-labelledby="ans-label"${streaming ? ' aria-busy="true"' : ''}>${title}${srcs}<div class="ans-label" id="ans-label">${esc(
      t.label(n),
    )}</div>${body}${foot}</section>`;
  }

  #copyLabel(t: Strings): string {
    return this.#copied ? `${CHECK_SVG}<span>${esc(t.copied)}</span>` : `<span>${esc(t.copy)}</span>`;
  }

  protected override updated(): void {
    if (this.#lit && !this.#links.some((l) => l.n === this.#lit)) this.#lit = 0;
    this.#paintLit();
  }

  /** Hover / focus on a chip or card lights its number (D8); leaving clears. */
  #hover(e: Event, on: boolean): void {
    const el = (e.target as Element | null)?.closest?.('[data-n]');
    if (!el) return;
    const to = (e as MouseEvent | FocusEvent).relatedTarget as Element | null;
    if (!on && to?.closest?.('[data-n]') === el) return;
    const n = on ? Number(el.getAttribute('data-n')) : 0;
    if (n === this.#lit) return;
    this.#lit = n;
    this.#paintLit();
    if (n) this.#reveal(n);
  }

  #paintLit(): void {
    const key = String(this.#lit);
    for (const el of this.$$('[data-n]'))
      el.classList.toggle('is-lit', !!this.#lit && el.getAttribute('data-n') === key);
  }

  /** A lit card outside the row slides the row sideways — never the page (no scrollIntoView). */
  #reveal(n: number): void {
    const row = this.$('.ans-srcs');
    const src = row?.querySelector(`.ans-src[data-n="${n}"]`);
    if (!row || !src || typeof row.scrollTo !== 'function') return;
    // Measure against where a glide still in flight will land, so fast Tab presses are not skipped.
    const now = Date.now();
    const at = this.#glide && now < this.#glide.until ? this.#glide.left : row.scrollLeft;
    const shift = row.scrollLeft - at;
    const rr = row.getBoundingClientRect();
    const sr = src.getBoundingClientRect();
    const l = sr.left + shift;
    const r = sr.right + shift;
    const target = r > rr.right ? at + (r - rr.right) + 16 : l < rr.left ? at - (rr.left - l) - 16 : null;
    if (target === null) return;
    const left = Math.max(0, Math.min(target, row.scrollWidth - row.clientWidth));
    const smooth = !prefersReducedMotion();
    this.#glide = smooth ? { left, until: now + GLIDE_MS } : null;
    row.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
  }

  #follow(e: Event, a: Element): void {
    const n = Number(a.getAttribute('data-n'));
    const link = this.#links[n - 1];
    if (!link) return;
    const from = a.classList.contains('ans-cite') ? 'chip' : 'card';
    if (!this.emit('ui-link', { url: link.href, index: n - 1, from })) e.preventDefault();
  }

  #copy(): void {
    const d = this.data;
    const md = String(d?.markdown ?? '');
    if (!d || d.streaming || !md.trim()) return;
    const text = answerCopyText(md, this.#links, this.#lang);
    if (!this.emit('ui-copy', { text })) return;
    const done = () => this.#flash(true, strings(this.#lang).copiedSay(this.#links.length));
    const fallback = () => (this.#viaTextarea(text) ? done() : this.#selectBody());
    try {
      const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
      if (clip && typeof clip.writeText === 'function') clip.writeText(text).then(done, fallback);
      else fallback();
    } catch {
      fallback();
    }
  }

  /** Without the Clipboard API (plain http): copy the raw text from a hidden textarea. */
  #viaTextarea(text: string): boolean {
    if (typeof document.execCommand !== 'function') return false;
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.setAttribute('aria-hidden', 'true');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
      this.root.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      this.$<HTMLButtonElement>('.ans-copy')?.focus({ preventScroll: true });
      return !!ok;
    } catch {
      return false;
    }
  }

  /** Last resort: select the rendered answer so ⌘C / Ctrl+C copies it. */
  #selectBody(): void {
    const body = this.$('.ans-body');
    try {
      const sel = typeof getSelection === 'function' ? getSelection() : null;
      if (body && sel) {
        const range = document.createRange();
        range.selectNodeContents(body);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch {
      /* selection is best effort */
    }
    this.#flash(false, strings(this.#lang).selected);
  }

  /** Copy feedback lives in place (no re-render) and clears after 1.5 s. */
  #flash(copied: boolean, message: string): void {
    this.#copied = copied;
    this.#status = message;
    this.#paintCopy();
    clearTimeout(this.#timer);
    this.#timer = window.setTimeout(() => {
      this.#copied = false;
      this.#status = '';
      this.#paintCopy();
    }, COPIED_MS);
  }

  #paintCopy(): void {
    const b = this.$('.ans-copy');
    if (b) {
      b.innerHTML = this.#copyLabel(strings(this.#lang));
      b.toggleAttribute('data-copied', this.#copied);
    }
    const s = this.$('.ans-status');
    if (s) s.textContent = this.#status;
  }
}

define('ui-ai-answer', UiAiAnswer);

declare global {
  interface HTMLElementTagNameMap {
    'ui-ai-answer': UiAiAnswer;
  }
}
