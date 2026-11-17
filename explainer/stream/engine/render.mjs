// Timeline -> MP4: headless Chromium draws stage.html frame by frame (deterministic), CDP screenshots go to ffmpeg.
// usage: node render.mjs <build dir> <slices>            whole video in <slices> parallel browsers -> <build dir>/video.mp4
//        node render.mjs <build dir> <k> <f0> <f1>       one slice (frames f0..f1-1) -> <build dir>/seg_<k>.mp4
// It serves the kit itself: /engine/ and /themes/ from this repo, /cache/ from the asset cache (setup_assets.py).
import { spawn } from 'child_process';
import { createRequire } from 'module';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.dirname(HERE);
const CACHE = process.env.STREAM_CACHE || path.join(process.env.HOME, '.cache', '2lab-stream');
const require = createRequire(path.join(CACHE, 'node', 'package.json'));
const { chromium } = require('playwright');

const [dir, slicesArg, a0, a1] = process.argv.slice(2);
const TLtext = fs.readFileSync(path.join(dir, 'timeline.json'), 'utf8');
const TLmeta = JSON.parse(TLtext);
const N = TLmeta.frames, L = TLmeta.layout;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.moc3': 'application/octet-stream' };
const ROOTS = { engine: HERE, themes: path.join(KIT, 'themes'), cache: CACHE };

function serve() {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname).split('/').filter(Boolean);
    const root = ROOTS[u[0]];
    const file = root && path.join(root, ...u.slice(1));
    if (!file || !file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(res => srv.listen(0, '127.0.0.1', () => res(srv)));
}

async function renderSlice(k, f0, f1) {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--disable-background-timer-throttling'] });
  const page = await browser.newPage({ viewport: { width: L.w || 1920, height: L.h || 1080 } });
  page.on('pageerror', e => console.log(k, 'ERR', e.message));
  await page.goto(base + '/engine/stage.html');
  await page.evaluate(([l, t]) => window.setup(l, JSON.parse(t)), [L, TLtext]);
  await page.evaluate(([f, w]) => window.seek(f, w), [f0, 90]);   // 90 frames of physics warm-up before the first written frame
  const client = await page.context().newCDPSession(page);
  const out = path.join(dir, `seg_${String(k).padStart(2, '0')}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(L.fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    await page.evaluate(f => window.renderFrame(f), f);
    const r = await client.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, optimizeForSpeed: true });
    if (!ff.stdin.write(Buffer.from(r.data, 'base64'))) await new Promise(res => ff.stdin.once('drain', res));
    if ((f - f0) % 300 === 0) console.log(`slice ${k}: ${f - f0}/${f1 - f0} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  ff.stdin.end();
  await new Promise(res => ff.on('close', res));
  await browser.close();
  srv.close();
  return out;
}

if (a0 !== undefined) {
  await renderSlice(+slicesArg, +a0, +a1);
} else {
  const S = +slicesArg;
  const per = Math.ceil(N / S);
  const procs = [];
  for (let k = 0; k < S; k++) {
    const f0 = k * per, f1 = Math.min(N, (k + 1) * per);
    procs.push(new Promise(res => { const p = spawn('node', [fileURLToPath(import.meta.url), dir, String(k), String(f0), String(f1)], { stdio: 'inherit' }); p.on('close', res); }));
  }
  await Promise.all(procs);
  const list = path.join(dir, 'segs.txt');
  fs.writeFileSync(list, Array.from({ length: S }, (_, k) => `file 'seg_${String(k).padStart(2, '0')}.mp4'`).join('\n'));
  await new Promise(res => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(dir, 'video.mp4')], { stdio: 'inherit' }).on('close', res));
  console.log('done', path.join(dir, 'video.mp4'));
}
