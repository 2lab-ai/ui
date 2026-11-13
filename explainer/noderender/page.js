// page.js — a headless "page" for the explainer engine without a browser: Node + Skia (@napi-rs/canvas).
// The tools speak to it through the playwright shim (shim/playwright): one JSON line in ({id, expr, arg}), one out.
// Used where Chromium cannot start (a macOS sandbox that denies Mach bootstrap_check_in).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), readline = require('readline');
const { createCanvas, GlobalFonts, Image: NImage, Path2D } = require('@napi-rs/canvas');
const dir = path.resolve(process.argv[2] || '.');
const errors = [];
const html = fs.readFileSync(path.join(dir, 'video.html'), 'utf8');
for (const m of html.matchAll(/@font-face\s*\{\s*font-family:\s*'([^']+)';\s*src:\s*url\('([^']+)'\)/g)) {
  const p = path.join(dir, m[2]);
  if (fs.existsSync(p)) { try { GlobalFonts.registerFromPath(p, m[1]); } catch (e) { errors.push('font ' + m[2] + ': ' + e.message); } }
}
const canvas = createCanvas(1920, 1080);
canvas.style = {};
const ctx2d = canvas.getContext('2d');
const _drawImage = ctx2d.drawImage.bind(ctx2d);
ctx2d.drawImage = (im, ...a) => _drawImage(im && im._im ? im._im : im, ...a);
canvas.getContext = () => ctx2d;
class Img {
  constructor() { this.onload = null; this.onerror = null; this.width = 0; this.height = 0; }
  set src(u) {
    this._src = u;
    fs.promises.readFile(path.join(dir, String(u).split('?')[0])).then((buf) => {
      const im = new NImage();
      im.onload = () => { this._im = im; this.width = im.width; this.height = im.height; this.onload && this.onload(); };
      im.onerror = (e) => { this.onerror && this.onerror(e); };
      im.src = buf;
    }).catch((e) => { this.onerror && this.onerror(e); });
  }
  get src() { return this._src; }
}
const stub = () => ({ style: {}, classList: { add() {} }, appendChild() {}, addEventListener() {}, setAttribute(k, v) { this[k] = v; } });
function pathLen(d) {   // rough outline length for formula write-on (SVG getTotalLength stand-in)
  const n = (String(d).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number); let L = 0;
  for (let i = 2; i + 1 < n.length; i += 2) L += Math.hypot(n[i] - n[i - 2], n[i + 1] - n[i - 1]);
  return L || 1;
}
const document = {
  title: '',
  getElementById: (id) => (id === 'c' ? canvas : stub()),
  body: stub(),
  createElement: (tag) => (tag === 'canvas' ? (() => { const c = createCanvas(300, 150); return c; })() : stub()),
  createElementNS: () => ({ ...stub(), getTotalLength() { return pathLen(this.d); } }),
  fonts: { load: async () => [], ready: Promise.resolve() },
};
async function fetchLocal(u) {
  const p = path.join(dir, String(u).split('?')[0]);
  try { const s = fs.readFileSync(p, 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(s), text: async () => s }; }
  catch (e) { return { ok: false, status: 404, json: async () => null, text: async () => '' }; }
}
const sandbox = {
  document, fetch: fetchLocal, Image: Img, Path2D, location: { search: '?export=1', href: 'file://' + dir + '/video.html?export=1' },
  URLSearchParams, console: { log: (...a) => process.stderr.write(a.join(' ') + '\n'), warn: (...a) => process.stderr.write(a.join(' ') + '\n'), error: (...a) => process.stderr.write(a.join(' ') + '\n') },
  performance, setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame: () => 0, queueMicrotask, structuredClone,
};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
const C = vm.createContext(sandbox);
process.on('unhandledRejection', (e) => errors.push(String(e && e.stack || e)));
process.on('uncaughtException', (e) => errors.push(String(e && e.stack || e)));
const scripts = [...html.matchAll(/<script(?:\s+src="([^"]+)")?\s*>([\s\S]*?)<\/script>/g)];
for (const m of scripts) {
  const file = m[1], code = file ? fs.readFileSync(path.join(dir, file), 'utf8') : m[2];
  try { new vm.Script(code, { filename: file || 'inline.js' }).runInContext(C); } catch (e) { errors.push(String(e && e.stack || e)); }
}
const out = (o) => { o.errors = errors.splice(0); process.stdout.write(JSON.stringify(o) + '\n'); };
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', async (line) => {
  let msg; try { msg = JSON.parse(line); } catch (e) { return; }
  try {
    let v = vm.runInContext('(' + msg.expr + '\n)', C);
    if (typeof v === 'function') v = v(msg.arg);
    if (v && typeof v.then === 'function') v = await v;
    out({ id: msg.id, value: v === undefined ? null : JSON.parse(JSON.stringify(v)) });
  } catch (e) { out({ id: msg.id, error: String(e && e.stack || e) }); }
});
rl.on('close', () => process.exit(0));
out({ id: 0, value: 'loaded' });
