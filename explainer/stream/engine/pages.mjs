// Prepared pages for the stream (edit/RESEARCH.md §4.3, reference C; book/RESEARCH.md): one page per point, made before the
// stream and pasted whole onto the Paint canvas with B.paste_image; while talking the streamer only marks it (underline,
// circle, arrow, a short handwritten word). This file draws the pages and tells the beats where each marked phrase landed,
// so the marks hit it.
// usage: node pages.mjs <pages.json> <out dir> [--w 1100 --h 700]
//   pages.json = [{"id": "p1", "kind": "photo" (default) | "article" | "quote" | "list" | "versus" | "big" | "blank",
//                  "head": "a claim in red", "image": "props/x.jpg" (relative to pages.json), "src": "a source line",
//                  "lines": ["lines; **marked phrase** is red and bold"], "foot": "credit / source at the bottom"}]
//     photo   : photo left, source line + 2-4 lines right (슈카월드's page)
//     article : a news clipping — "outlet" + "date" masthead, "title" (the article's headline), "lines" = excerpt; photo optional
//     quote   : the book's own words — "en" (original, grey) and "lines" (Korean), "by" (attribution); "image" = the cover
//     list    : numbered "items" (two columns over 5), "image" optional (top right)
//     versus  : "left" / "right" = {"label", "image", "lines"}: before and after, side by side with an arrow
//     big     : one "big" number or word in the middle, "lines" under it
//     blank   : the headline only; the rest is free for a hand drawing
//   out: <id>.png (the page, canvas size) and <id>.boxes.json {"head", "image", "images": [...], "items": [...],
//        "big", "free", "marks": [{"text", "x", "y", "w", "h"}]} — boxes in page px = canvas px when pasted at (0, 0, w, h)
// In beats.py: B.clear_canvas(); B.paste_image('content/.../pages/out/p1.png', 0, 0, 1100, 700); then mark with
//   engine/marks.py: underline(B, boxes['marks'][0]), circle(B, boxes['big']), arrow(B, (x0, y0), (x1, y1)), cross(B, box)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const CACHE = process.env.STREAM_CACHE || path.join(process.env.HOME, '.cache', '2lab-stream');
const require = createRequire(path.join(CACHE, 'node', 'package.json'));
const { chromium } = require('playwright');
const FONT = 'file://' + path.join(CACHE, 'fonts', 'pretendard') + '/';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? Number(args[i + 1]) : d; };
const [specPath, outDir] = args;
const only = (() => { const i = args.indexOf('--only'); return i >= 0 ? new Set(args[i + 1].split(',')) : null; })();
const W = opt('--w', 1100), H = opt('--h', 700);
const pages = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const base = path.dirname(path.resolve(specPath));
fs.mkdirSync(outDir, { recursive: true });

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const marked = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b class="m">$1</b>');
const src = f => `file://${path.resolve(base, f)}`;
const img = (f, cls = 'img', style = '') => f ? `<img class="${cls}" src="${src(f)}" style="${style}">` : '';
const lines = (ls, cls = 'ln') => (ls || []).map(l => `<div class="${cls}">${marked(l)}</div>`).join('');

function body(p) {
  const k = p.kind || 'photo';
  if (k === 'photo') return `${p.image ? img(p.image, 'img main', `left:44px;top:150px;width:${Math.round(W * 0.4)}px;height:${Math.round(H * 0.6)}px`) : ''}
    <div class="txt" style="left:${p.image ? Math.round(W * 0.4) + 84 : 44}px;right:44px;top:156px">${p.src ? `<div class="src">${esc(p.src)}</div>` : ''}${lines(p.lines)}</div>`;
  if (k === 'article') {
    const iw = p.image ? Math.round(W * 0.34) : 0;
    return `${p.image ? img(p.image, 'img main', `left:44px;top:156px;width:${iw}px;height:${Math.round(H * 0.5)}px`) : ''}
    <div class="clip" style="left:${p.image ? iw + 76 : 60}px;right:${p.image ? 40 : 60}px;top:150px">
      <div class="mast"><span class="outlet">${esc(p.outlet || '')}</span><span class="date">${esc(p.date || '')}</span></div>
      <div class="atitle"><span class="att">${marked(p.title || '')}</span></div>${lines(p.lines, 'aln')}</div>`;
  }
  if (k === 'quote') {
    const iw = p.image ? Math.round(W * 0.24) : 0;
    return `${p.image ? img(p.image, 'img main cover', `left:50px;top:160px;width:${iw}px;height:${Math.round(iw * 1.45)}px`) : ''}
    <div class="txt" style="left:${p.image ? iw + 100 : 70}px;right:60px;top:150px"><div class="qm">“</div>
      ${p.en ? `<div class="en">${esc(p.en)}</div>` : ''}${lines(p.lines, 'qln')}${p.by ? `<div class="by">${esc(p.by)}</div>` : ''}</div>`;
  }
  if (k === 'list') {
    const items = p.items || []; const two = items.length > 5; const right = p.image ? 300 : 44;
    return `${p.image ? img(p.image, 'img main', `right:44px;top:150px;width:236px;height:236px`) : ''}
    <div class="list${two ? ' two' : ''}" style="left:44px;right:${right}px;top:${p.sub ? 196 : 150}px">${items.map((t, i) => `<div class="it"><span class="no">${i + 1}</span><span class="itx">${marked(t)}</span></div>`).join('')}</div>
    ${p.sub ? `<div class="sub" style="left:44px;top:146px">${marked(p.sub)}</div>` : ''}`;
  }
  if (k === 'versus') {
    const col = (c, x) => `<div class="vs" style="left:${x}px;width:${Math.round(W / 2) - 90}px"><div class="vlab">${marked(c.label || '')}</div>${img(c.image, 'img vimg')}${lines(c.lines, 'vln')}</div>`;
    return col(p.left || {}, 44) + `<div class="varrow">→</div>` + col(p.right || {}, Math.round(W / 2) + 46);
  }
  if (k === 'big') return `${p.image ? img(p.image, 'img main', `left:44px;top:150px;width:${Math.round(W * 0.36)}px;height:${Math.round(H * 0.6)}px`) : ''}
    <div class="bigw" style="left:${p.image ? Math.round(W * 0.36) + 70 : 44}px;right:44px"><div class="big"><span class="bigt">${marked(p.big || '')}</span></div>${lines(p.lines, 'bln')}</div>`;
  if (k === 'blank') return `<div id="free" style="position:absolute;left:30px;right:30px;top:140px;bottom:${p.foot ? 44 : 20}px"></div>${p.lines ? `<div class="txt" style="left:44px;right:44px;top:150px">${lines(p.lines)}</div>` : ''}`;
  throw new Error('unknown page kind ' + k);
}

function html(p) {
  return `<meta charset="utf-8"><style>
@font-face{font-family:P;src:url(${FONT}Pretendard-Medium.woff2);font-weight:500}
@font-face{font-family:P;src:url(${FONT}Pretendard-Bold.woff2);font-weight:700}
@font-face{font-family:P;src:url(${FONT}Pretendard-ExtraBold.woff2);font-weight:800}
html,body{margin:0;width:${W}px;height:${H}px;background:#fff;font-family:P,sans-serif;overflow:hidden}
#head{position:absolute;left:44px;top:34px;right:44px;font-weight:700;font-size:40px;color:#d42a2a;line-height:1.25;word-break:keep-all}
.img{position:absolute;object-fit:cover;border-radius:6px}
.txt,.clip,.list,.bigw,.vs,.sub{position:absolute}
.src{font-weight:500;font-size:22px;color:#777;line-height:1.35;margin-bottom:22px;word-break:keep-all}
.ln{font-weight:500;font-size:32px;color:#222;line-height:1.45;margin-bottom:10px;word-break:keep-all}
.m{font-weight:700;color:#d42a2a}
.clip{background:#f6f5f1;border:1px solid #e2dfd6;box-shadow:0 3px 10px rgba(0,0,0,.12);padding:22px 26px 18px;transform:rotate(-0.6deg)}
.mast{display:flex;justify-content:space-between;font-weight:700;font-size:19px;color:#555;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:14px}
.mast .outlet{color:#1d3d7a}
.atitle{font-weight:700;font-size:33px;color:#111;line-height:1.3;margin-bottom:14px;word-break:keep-all}
.aln{font-weight:500;font-size:24px;color:#333;line-height:1.5;margin-bottom:6px;word-break:keep-all}
.qm{font-weight:800;font-size:90px;color:#b18cff;line-height:.6;height:44px}
.en{font-weight:500;font-size:23px;color:#888;font-style:italic;line-height:1.4;margin-bottom:18px}
.qln{font-weight:500;font-size:34px;color:#222;line-height:1.45;margin-bottom:8px;word-break:keep-all}
.by{font-weight:500;font-size:20px;color:#888;margin-top:16px}
.cover{object-fit:contain;background:#f3f3f3;box-shadow:0 4px 14px rgba(0,0,0,.18)}
.sub{font-weight:500;font-size:24px;color:#777;word-break:keep-all}
.list .it{display:flex;align-items:flex-start;gap:14px;font-weight:500;font-size:30px;color:#222;line-height:1.35;margin-bottom:16px;word-break:keep-all}
.list.two{columns:2;column-gap:40px}
.list.two .it{break-inside:avoid;font-size:27px;margin-bottom:14px}
.list .no{flex:0 0 40px;height:40px;border-radius:50%;background:#d42a2a;color:#fff;font-weight:800;font-size:22px;display:flex;align-items:center;justify-content:center;margin-top:-1px}
.vs{top:146px;bottom:${p.foot ? 46 : 20}px}
.vlab{font-weight:700;font-size:28px;color:#222;margin-bottom:10px;word-break:keep-all}
.vimg{position:relative;display:block;width:100%;height:300px}
.vln{font-weight:500;font-size:24px;color:#333;line-height:1.4;margin-top:10px;word-break:keep-all}
.varrow{position:absolute;left:${Math.round(W / 2) - 26}px;top:300px;font-weight:800;font-size:56px;color:#d42a2a}
.bigw{top:150px;text-align:center}
.big{font-weight:800;font-size:${p.bigsize || 150}px;color:#d42a2a;line-height:1.1;margin:30px 0 24px;word-break:keep-all}
.big .m{font-weight:800}
.bln{font-weight:500;font-size:32px;color:#222;line-height:1.45;margin-bottom:8px;word-break:keep-all}
#foot{position:absolute;left:44px;right:44px;bottom:14px;font-weight:500;font-size:16px;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
</style><div id="head"><span id="headt">${marked(p.head || '')}</span></div>${body(p)}${p.foot ? `<div id="foot">${esc(p.foot)}</div>` : ''}`;
}

const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
for (const p of pages) {
  if (only && !only.has(p.id)) continue;
  const f = path.join(outDir, p.id + '.html'); fs.writeFileSync(f, html(p));
  await page.goto('file://' + path.resolve(f)); await page.evaluate(() => document.fonts.ready);
  // a picture that already failed has complete=true and naturalWidth=0: waiting for its events would hang forever
  const missing = await page.evaluate(() => Promise.all([...document.images].map(im => im.complete ? (im.naturalWidth ? null : im.src)
    : new Promise(r => { im.onload = () => r(im.naturalWidth ? null : im.src); im.onerror = () => r(im.src); setTimeout(() => r(im.src), 15000); })))).then(a => a.filter(Boolean));
  if (missing.length) throw new Error(`page ${p.id}: picture not found ${missing.join(', ')}`);
  const boxes = await page.evaluate(() => {
    const b = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const q = s => [...document.querySelectorAll(s)];
    return { head: b(document.getElementById('headt')), image: b(document.querySelector('.img.main')), images: q('.img').map(b),
             items: q('.it .itx').map(b), big: b(document.querySelector('.bigt')), title: b(document.querySelector('.att')),
             free: b(document.getElementById('free')), marks: q('.m').map(el => ({ text: el.textContent, ...b(el) })) };
  });
  // nothing may run off the page: every text block inside the canvas
  const over = await page.evaluate((H) => [...document.querySelectorAll('.ln,.aln,.qln,.it,.vln,.bln,.atitle,#head,.big')].filter(e => e.getBoundingClientRect().bottom > H - 4).map(e => e.textContent.slice(0, 30)), H);
  if (over.length) console.warn(`page ${p.id}: text runs off the bottom: ${over.join(' | ')}`);
  await page.screenshot({ path: path.join(outDir, p.id + '.png') });
  fs.writeFileSync(path.join(outDir, p.id + '.boxes.json'), JSON.stringify(boxes, null, 1));
  fs.unlinkSync(f);
  console.log('page', p.id, p.kind || 'photo', boxes.marks.length, 'marks');
}
await browser.close();
