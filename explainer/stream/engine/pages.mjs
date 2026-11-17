// Prepared pages for the stream (edit/RESEARCH.md §4.3, reference C): one page per point, made before the stream and pasted
// whole onto the Paint canvas with B.paste_image; while talking the streamer only marks it (underline, circle, arrow, a short
// handwritten word). This file draws the pages and tells the beats where each marked phrase landed, so the marks hit it.
// usage: node pages.mjs <pages.json> <out dir> [--w 1100 --h 700]
//   pages.json = [{"id": "p1", "head": "a claim in red", "image": "props/x.jpg" (relative to pages.json), "src": "an English
//                  source line (optional)", "lines": ["two to four lines; **marked phrase** is red and bold"]}]
//   out: <id>.png (the page, canvas size) and <id>.boxes.json {"head": box, "image": box, "marks": [{"text", "x", "y", "w", "h"}]}
//        boxes in page px = canvas px when the page is pasted at (0, 0, w, h)
// In beats.py: B.clear_canvas(); B.paste_image('content/.../pages/p1.png', 0, 0, 1100, 700); then underline a mark with
//   m = boxes['marks'][0]; B.stroke([(m['x'] - 4, m['y'] + m['h'] + 6), (m['x'] + m['w'] + 4, m['y'] + m['h'] + 6)])
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
const W = opt('--w', 1100), H = opt('--h', 700);
const pages = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const base = path.dirname(path.resolve(specPath));
fs.mkdirSync(outDir, { recursive: true });

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const marked = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b class="m">$1</b>');

function html(p) {
  const img = p.image ? `<img id="img" src="file://${path.resolve(base, p.image)}">` : '';
  return `<meta charset="utf-8"><style>
@font-face{font-family:P;src:url(${FONT}Pretendard-Medium.woff2);font-weight:500}
@font-face{font-family:P;src:url(${FONT}Pretendard-Bold.woff2);font-weight:700}
html,body{margin:0;width:${W}px;height:${H}px;background:#fff;font-family:P,sans-serif;overflow:hidden}
#head{position:absolute;left:44px;top:34px;right:44px;font-weight:700;font-size:40px;color:#d42a2a;line-height:1.25;word-break:keep-all}
#img{position:absolute;left:44px;top:150px;width:${Math.round(W * 0.4)}px;height:${Math.round(H * 0.6)}px;object-fit:cover;border-radius:6px}
#txt{position:absolute;left:${p.image ? Math.round(W * 0.4) + 84 : 44}px;right:44px;top:156px}
#src{font-weight:500;font-size:22px;color:#777;line-height:1.35;margin-bottom:22px}
.ln{font-weight:500;font-size:32px;color:#222;line-height:1.45;margin-bottom:10px;word-break:keep-all}
.m{font-weight:700;color:#d42a2a}
</style><div id="head">${marked(p.head)}</div>${img}<div id="txt">${p.src ? `<div id="src">${esc(p.src)}</div>` : ''}${(p.lines || []).map(l => `<div class="ln">${marked(l)}</div>`).join('')}</div>`;
}

const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
for (const p of pages) {
  const f = path.join(outDir, p.id + '.html'); fs.writeFileSync(f, html(p));
  await page.goto('file://' + path.resolve(f)); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map(im => im.complete ? 1 : new Promise(r => { im.onload = im.onerror = r; }))));
  const boxes = await page.evaluate(() => {
    const b = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    return { head: b(document.getElementById('head')), image: b(document.getElementById('img')),
             marks: [...document.querySelectorAll('.m')].map(el => ({ text: el.textContent, ...b(el) })) };
  });
  await page.screenshot({ path: path.join(outDir, p.id + '.png') });
  fs.writeFileSync(path.join(outDir, p.id + '.boxes.json'), JSON.stringify(boxes, null, 1));
  fs.unlinkSync(f);
  console.log('page', p.id, boxes.marks.length, 'marks');
}
await browser.close();
