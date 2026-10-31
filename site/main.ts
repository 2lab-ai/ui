import '@2lab.ai/ui';
import { DARK, LIGHT, tokensCss } from '@2lab.ai/ui/core/tokens';
import { DOCS, docBySlug } from '@2lab.ai/ui/docs/registry';
import type { ComponentDoc, DemoDoc } from '@2lab.ai/ui/docs/types';
import { icon } from '@2lab.ai/ui/icons/icons';
import { kitCss } from '@2lab.ai/ui/kit/kit';
import { playSound } from '@2lab.ai/ui/sound/sound';
import pkg from '../package.json';
import { iconsPage, kitPage, wireKit } from './foundations';
import { setSiteSound, soundButton, soundNow, soundPage, startSiteSound, wireSoundPage } from './sound';
import './style.css';

// Page-level component tokens (each preview stage switches with data-theme) and the light-DOM kit the demos use.
const tok = document.createElement('style');
tok.textContent = `${tokensCss}\n${kitCss}`;
document.head.append(tok);

const app = document.getElementById('app')!;
const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const ICON = {
  sun: icon('sun'),
  moon: icon('moon'),
  menu: icon('menu'),
  replay: icon('refresh'),
  ext: icon('external', { size: 12 }),
};

const WIDE = new Set([
  'agent-run',
  'agent-inbox',
  'agent-queue',
  'app-bar',
  'stat-strip',
  'artifact-viewer',
  'settings-nav',
  'knowledge-pages',
]);

function themeNow(): 'light' | 'dark' {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function shell(active: string, body: string): string {
  const link = (href: string, label: string, extra = '') =>
    `<a href="${href}" data-link${active === href ? ' aria-current="page"' : ''}>${label}${extra}</a>`;
  const screens = DOCS.filter((d) => d.group === 'Screens');
  const comps = DOCS.filter((d) => d.group === 'Components');
  const pages = DOCS.filter((d) => d.group === 'Pages');
  const prims = DOCS.filter((d) => d.group === 'Primitives');
  return `<header class="top">
  <button class="icon-btn menu-btn" id="menu" aria-label="Menu">${ICON.menu}</button>
  <a class="brand" href="/" data-link><img src="/favicon.svg" alt="" />2lab<span>/ui</span></a>
  <nav>${link('/components', 'Components')}${link('/docs/installation', 'Docs')}</nav>
  <div class="grow"></div>
  <span class="ver">v${esc(pkg.version)}</span>
  ${soundButton()}
  <button class="icon-btn" id="theme" aria-label="Toggle site theme">${themeNow() === 'dark' ? ICON.sun : ICON.moon}</button>
</header>
<div class="layout">
  <aside class="side" aria-label="Sections">
    <h4>Getting started</h4>
    ${link('/', 'Introduction')}${link('/docs/installation', 'Installation')}${link('/docs/theming', 'Theming')}
    <h4>Foundations</h4>
    ${link('/docs/icons', 'Icons')}${link('/docs/kit', 'UI kit', '<small>css</small>')}${link('/docs/sound', 'Sound', '<small>opt-in</small>')}
    <h4>Screens</h4>
    ${screens.map((d) => link(`/components/${d.slug}`, esc(d.name), '<small>screen</small>')).join('')}
    <h4>Components</h4>
    ${comps.map((d) => link(`/components/${d.slug}`, esc(d.name))).join('')}
    <h4>Page parts</h4>
    ${pages.map((d) => link(`/components/${d.slug}`, esc(d.name))).join('')}
    <h4>Primitives</h4>
    ${prims.map((d) => link(`/components/${d.slug}`, esc(d.name))).join('')}
  </aside>
  <main id="main" tabindex="-1"><div class="page">${body}
    <div class="foot">@2lab.ai/ui v${esc(pkg.version)} · Web Components, zero runtime dependencies · built from the soma-work dashboard · interaction patterns studied from <a href="https://www.affectui.com" target="_blank" rel="noopener">affectUI</a> (no code or assets copied)</div>
  </div></main>
</div>`;
}

function codeBlock(code: string, id: string): string {
  return `<div class="code-wrap"><pre class="code" id="${id}">${esc(code)}</pre><button class="copy" data-copy="${id}">Copy</button></div>`;
}

const NUMBER_WORDS = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
  'Twenty',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty'];
/** 20 → "Twenty", 23 → "Twenty-three" (the hero counts the documented components). */
function countWord(n: number): string {
  if (n <= 20) return NUMBER_WORDS[n] ?? String(n);
  if (n >= 50) return String(n);
  const t = TENS[Math.floor(n / 10)];
  return n % 10 ? `${t}-${NUMBER_WORDS[n % 10].toLowerCase()}` : t;
}

const GROUP_LABEL: Record<ComponentDoc['group'], string> = {
  Screens: 'Screen',
  Components: 'Component',
  Pages: 'Page part',
  Primitives: 'Primitive',
};

function homePage(): string {
  const cards = DOCS.map(
    (d) => `<a class="card" href="/components/${d.slug}" data-link>
      <div class="thumb" data-thumb="${d.slug}"><div></div></div>
      <div class="meta"><em>${GROUP_LABEL[d.group]}</em><b>${esc(d.name)}</b><span>${esc(d.summary)}</span></div></a>`,
  ).join('');
  const prims = DOCS.filter((d) => d.group === 'Primitives').length;
  const parts = DOCS.filter((d) => d.group === 'Pages').length;
  return `<section class="hero">
    <div class="crumb">@2lab.ai/ui</div>
    <h1>Agent UI components that show what the agent is doing — and what it needs from you.</h1>
    <p class="lede">${countWord(DOCS.length)} Web Components lifted from the 2lab soma-work dashboard: the app bar, the run screen, the inbox board, the agent tree, the conversation and the work log, approvals, questions and steering, the composer, answer cards, tool calls, files, the pictures grid and the artifact viewer, goals, plans and runs, provider capacity, context usage, spend, the stats strip and bar chart, toasts, memory, the model picker, the session status row and the card deck nav; ${parts} parts for the pages around them (settings rows and their side nav, a knowledge-pages editor, an observation log, the sign-in card) — plus the ${prims} primitives they share (segmented control, tabs, menu, tooltip, hovercard, dialog, drawer, disclosure, log scroller, live time, meter), an icon set and a light-DOM CSS kit. Data in, events out, zero runtime dependencies, light and dark, keyboard-first.</p>
    <div class="cta"><a class="btn primary" href="/components/${DOCS[0]?.slug ?? ''}" data-link>Browse components</a><a class="btn" href="/docs/installation" data-link>Install</a></div>
  </section>
  <h2 id="components">Components <span class="chip">${DOCS.length}</span></h2>
  <div class="grid">${cards}</div>`;
}

function componentsPage(): string {
  return homePage().replace(
    /<section class="hero">[\s\S]*?<\/section>/,
    '<div class="crumb">Components</div><h1>Components</h1><p class="lede">Every component is a custom element. Set <code>el.data</code>, listen for <code>ui-*</code> events.</p>',
  );
}

function table(head: string[], rows: string[][]): string {
  if (!rows.length) return '<p class="desc">None.</p>';
  return `<div class="tbl"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;
}

function componentPage(d: ComponentDoc): string {
  const demos = d.demos
    .map((m, i) => `<button role="tab" data-demo="${esc(m.id)}" aria-selected="${i === 0}">${esc(m.title)}</button>`)
    .join('');
  const props = table(
    ['Prop', 'Type', 'Default', 'Description'],
    d.props.map((p) => [
      `<code>${esc(p.name)}</code>${p.required ? '<span class="req">required</span>' : ''}`,
      `<code class="type">${esc(p.type)}</code>`,
      p.default ? `<code>${esc(p.default)}</code>` : '—',
      esc(p.description),
    ]),
  );
  const events = table(
    ['Event', 'detail', 'When'],
    d.events.map((e) => [
      `<code>${esc(e.name)}</code>`,
      `<code class="type">${esc(e.detail)}</code>`,
      esc(e.description),
    ]),
  );
  const keys = table(
    ['Keys', 'Action'],
    d.keyboard.map(([k, a]) => [
      k
        .split(/\s*\/\s*/)
        .map((x) => `<kbd>${esc(x)}</kbd>`)
        .join(' '),
      esc(a),
    ]),
  );
  return `<div class="crumb"><a href="/components" data-link>${d.group}</a> / ${esc(d.name)}</div>
  <h1>${esc(d.name)}</h1>
  <p class="lede">${esc(d.summary)}</p>
  <div class="chips"><span class="chip"><code>&lt;${esc(d.tag)}&gt;</code></span><span class="chip">Web Component</span><span class="chip">Light · Dark</span>
    <a class="chip link" href="${esc(d.reference.url)}" target="_blank" rel="noopener">Pattern: ${esc(d.reference.name)} ${ICON.ext}</a></div>
  <section class="preview" aria-label="Live preview">
    <div class="pv-bar">
      <div class="seg" role="tablist" aria-label="Examples">${demos}</div>
      <div class="grow"></div>
      <div class="seg" aria-label="Width"><button data-width="desk" aria-pressed="true">Desktop</button><button data-width="mobile" aria-pressed="false">Mobile</button></div>
      <div class="seg" aria-label="Preview theme"><button data-pv-theme="light" aria-pressed="${themeNow() === 'light'}">Light</button><button data-pv-theme="dark" aria-pressed="${themeNow() === 'dark'}">Dark</button></div>
      <button class="icon-btn" id="replay" aria-label="Replay example">${ICON.replay}</button>
    </div>
    <div class="pv-stage" id="stage" data-theme="${themeNow()}"><div class="pv-frame${WIDE.has(d.slug) ? ' wide' : ''}" id="frame"></div></div>
    <div class="pv-note" id="note"></div>
  </section>
  <p class="desc" style="margin-top:22px">${esc(d.description)}</p>
  <h2>Usage</h2>
  ${codeBlock(`npm i @2lab.ai/ui\nimport '@2lab.ai/ui/${d.slug}';`, 'inst')}
  <div style="height:12px"></div>
  ${codeBlock(d.usage, 'usage')}
  <h2>Properties</h2>${props}
  <h2>Events</h2>${events}
  <h2>Keyboard</h2>${keys}
  <h2>Accessibility</h2><ul class="plain">${d.a11y.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
  <h2>In soma-work</h2><p class="desc">${esc(d.usedIn)}</p>`;
}

function installPage(): string {
  const origin = location.origin;
  return `<div class="crumb">Getting started</div><h1>Installation</h1>
  <p class="lede">The package is published to npm as <a href="https://www.npmjs.com/package/@2lab.ai/ui"><code>@2lab.ai/ui</code></a>. For a page without a build step, load the same files from this site.</p>
  <h2>npm</h2>
  ${codeBlock(`npm i @2lab.ai/ui`, 'npmi')}
  <h2>Import</h2>
  ${codeBlock(`// everything\nimport '@2lab.ai/ui';\n\n// or one component (registers only that element)\nimport '@2lab.ai/ui/context-window';\n\n// optional page tokens (data-theme="dark" on any ancestor switches)\nimport '@2lab.ai/ui/tokens.css';\n\n// optional light-DOM classes (buttons, chips, status …) and the icon set\nimport '@2lab.ai/ui/ui-kit.css';\nimport { icon } from '@2lab.ai/ui/icons';\n\n// on a server (ESM or CommonJS, no DOM, no element): the auth card as markup\nimport { authCardHtml } from '@2lab.ai/ui/server';`, 'imp')}
  <h2>No build step</h2>
  ${codeBlock(`<script type="module" src="${origin}/lib/index.js"></script>\n<link rel="stylesheet" href="${origin}/lib/tokens.css">\n<link rel="stylesheet" href="${origin}/lib/ui-kit.css">\n\n<ui-context-window lang="en"></ui-context-window>`, 'cdn')}
  <h2>Data in, events out</h2>
  <p class="desc">Every element takes plain data (<code>el.data = {...}</code>) and reports what the person did with a bubbling <code>ui-*</code> event. Elements never fetch — the host app owns the network and passes the result back in.</p>
  ${codeBlock(`const picker = document.querySelector('ui-model-picker');\npicker.addEventListener('ui-change', (e) => save(e.detail));`, 'evt')}
  <h2>Frameworks</h2>
  <p class="desc">Custom elements work in React 19, Vue, Svelte and plain HTML. In React 19 pass objects as properties (<code>&lt;ui-context-window data={data} /&gt;</code>) and listen with <code>onui-compact</code>, or attach listeners in an effect.</p>`;
}

function themingPage(): string {
  const rows = Object.keys(LIGHT)
    .map(
      (k) =>
        `<div class="sw"><i style="background:${esc(LIGHT[k])}"></i><i style="background:${esc(DARK[k])}"></i><code>--ui-${esc(k)}</code><span>${esc(LIGHT[k])}</span></div>`,
    )
    .join('');
  return `<div class="crumb">Getting started</div><h1>Theming</h1>
  <p class="lede">Components follow <code>prefers-color-scheme</code> out of the box. Pin one with <code>theme="light|dark"</code>, or theme the whole page with <code>--ui-*</code> custom properties.</p>
  <h2>Three ways</h2>
  <ul class="plain"><li><b>Nothing</b> — each element follows the OS theme.</li><li><b>Attribute</b> — <code>&lt;ui-agent-inbox theme="dark"&gt;</code>.</li><li><b>Page tokens</b> — load <code>@2lab.ai/ui/tokens.css</code> and set <code>data-theme="dark"</code> on any ancestor, or override single tokens.</li></ul>
  ${codeBlock(`:root {\n  --ui-accent: #7c3aed;\n  --ui-st-run: #7c3aed;\n}\n[data-theme="dark"] {\n  --ui-surface: #111113;\n}`, 'ov')}
  <p class="desc">Set <code>--ui-*</code> on an ancestor (<code>:root</code>, a wrapper), not on the element itself. Inside, each element defines <code>--border: var(--ui-border, …)</code> on its host, so a page that maps <code>--ui-border: var(--border)</code> on that same element makes a cycle and every token goes blank. On a wrapper the values arrive already resolved:</p>
  ${codeBlock(`/* the page already has --surface, --border, --text … */\n.tool-calls {\n  --ui-surface: var(--surface);\n  --ui-border: var(--border);\n  --ui-text: var(--text);\n}`, 'map')}
  <div class="callout">Language: every component speaks English by default and Korean with <code>lang="ko"</code>.</div>
  <h2>Tokens <span class="chip">light · dark</span></h2>
  <div class="swatches">${rows}</div>`;
}

let current: { doc: ComponentDoc; demo: DemoDoc } | null = null;

function mountDemo(): void {
  if (!current) return;
  const frame = document.getElementById('frame');
  const note = document.getElementById('note');
  if (!frame) return;
  frame.innerHTML = '';
  const el = current.demo.create();
  const framed = current.demo.frame ?? current.doc.group !== 'Screens';
  if (framed) {
    const card = document.createElement('div');
    card.className = 'pv-card';
    card.append(el);
    frame.append(card);
  } else frame.append(el);
  const stage = document.getElementById('stage');
  if (stage) stage.style.minHeight = `${current.demo.height ?? 420}px`;
  if (note) {
    note.textContent = current.demo.description ?? '';
    note.hidden = !current.demo.description;
  }
}

function mountThumbs(): void {
  for (const box of Array.from(document.querySelectorAll<HTMLElement>('[data-thumb]'))) {
    const d = docBySlug(box.dataset.thumb!);
    const inner = box.firstElementChild as HTMLElement;
    if (!d || !d.demos[0] || !inner) continue;
    try {
      const el = d.demos[0].create();
      if (d.demos[0].frame ?? d.group !== 'Screens') {
        const card = document.createElement('div');
        card.className = 'pv-card';
        card.append(el);
        inner.append(card);
      } else inner.append(el);
    } catch (e) {
      console.error(e);
    }
  }
}

function route(): void {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  current = null;
  let body: string;
  let active = path;
  const m = path.match(/^\/components\/([a-z-]+)$/);
  const doc = m ? docBySlug(m[1]) : undefined;
  if (doc) {
    body = componentPage(doc);
    current = { doc, demo: doc.demos[0] };
    document.title = `${doc.name} — 2lab/ui`;
  } else if (path === '/components') {
    body = componentsPage();
    document.title = 'Components — 2lab/ui';
  } else if (path === '/docs/installation') {
    body = installPage();
    document.title = 'Installation — 2lab/ui';
  } else if (path === '/docs/theming') {
    body = themingPage();
    document.title = 'Theming — 2lab/ui';
  } else if (path === '/docs/icons') {
    body = iconsPage(codeBlock);
    document.title = 'Icons — 2lab/ui';
  } else if (path === '/docs/kit') {
    body = kitPage(codeBlock);
    document.title = 'UI kit — 2lab/ui';
  } else if (path === '/docs/sound') {
    body = soundPage(codeBlock);
    document.title = 'Sound — 2lab/ui';
  } else {
    body = homePage();
    active = '/';
    document.title = '2lab/ui — Agent UI components';
  }
  app.innerHTML = shell(active, body);
  document.body.classList.remove('nav-open');
  if (current) mountDemo();
  else if (path === '/docs/kit') wireKit(app);
  else if (path === '/docs/sound') wireSoundPage(app, route);
  else mountThumbs();
}

document.addEventListener('click', (e) => {
  const t = e.target as Element;
  const a = t.closest('a[data-link]') as HTMLAnchorElement | null;
  if (a && !(e as MouseEvent).metaKey && !(e as MouseEvent).ctrlKey && a.origin === location.origin) {
    e.preventDefault();
    if (a.pathname !== location.pathname) {
      history.pushState(null, '', a.pathname);
      route();
      window.scrollTo(0, 0);
      (document.getElementById('main') as HTMLElement | null)?.focus({ preventScroll: true });
    }
    return;
  }
  if (t.closest('#theme')) {
    const next = themeNow() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('2lab-ui-theme', next);
    } catch {}
    route();
    return;
  }
  if (t.closest('#sound')) {
    const on = !soundNow();
    void setSiteSound(on).then(() => {
      if (on) playSound('toggle', { direction: 'forward' });
      route();
    });
    return;
  }
  if (t.closest('#menu')) {
    document.body.classList.toggle('nav-open');
    return;
  }
  const demoBtn = t.closest('[data-demo]') as HTMLElement | null;
  if (demoBtn && current) {
    const demo = current.doc.demos.find((x) => x.id === demoBtn.dataset.demo);
    if (demo) {
      current.demo = demo;
      for (const b of Array.from(document.querySelectorAll('[data-demo]')))
        b.setAttribute('aria-selected', String(b === demoBtn));
      mountDemo();
    }
    return;
  }
  const w = t.closest('[data-width]') as HTMLElement | null;
  if (w) {
    for (const b of Array.from(document.querySelectorAll('[data-width]')))
      b.setAttribute('aria-pressed', String(b === w));
    document.getElementById('frame')?.classList.toggle('mobile', w.dataset.width === 'mobile');
    return;
  }
  const th = t.closest('[data-pv-theme]') as HTMLElement | null;
  if (th) {
    for (const b of Array.from(document.querySelectorAll('[data-pv-theme]')))
      b.setAttribute('aria-pressed', String(b === th));
    document.getElementById('stage')?.setAttribute('data-theme', th.dataset.pvTheme!);
    return;
  }
  if (t.closest('#replay')) {
    mountDemo();
    return;
  }
  const ct = t.closest('[data-copy-text]') as HTMLElement | null;
  if (ct) {
    void navigator.clipboard?.writeText(ct.dataset.copyText ?? '').then(() => {
      ct.classList.add('is-copied');
      setTimeout(() => ct.classList.remove('is-copied'), 900);
    });
    return;
  }
  const cp = t.closest('[data-copy]') as HTMLElement | null;
  if (cp) {
    const pre = document.getElementById(cp.dataset.copy!);
    if (pre)
      void navigator.clipboard?.writeText(pre.textContent ?? '').then(() => {
        cp.textContent = 'Copied';
        setTimeout(() => (cp.textContent = 'Copy'), 1200);
      });
  }
});
window.addEventListener('popstate', route);
startSiteSound();
route();
