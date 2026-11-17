// The edit's graphics, from HTML: captions, editor's jokes, chat pops, badges (transparent PNG) and the animated title and
// end cards (MP4, one screenshot per frame after window.setT(t)).
// usage: node cards.mjs <spec.json>
//   spec = {"png": [{"out", "w", "h", "html"}], "clips": [{"out", "w", "h", "fps", "dur", "html"}]}
// The HTML comes from cut.py; this file only turns it into pixels.
import { spawn } from 'child_process';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const CACHE = process.env.STREAM_CACHE || path.join(process.env.HOME, '.cache', '2lab-stream');
const require = createRequire(path.join(CACHE, 'node', 'package.json'));
const { chromium } = require('playwright');

const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });

async function pngs(items) {
  const page = await browser.newPage();
  for (const it of items) {
    await page.setViewportSize({ width: it.w, height: it.h });
    const f = it.out + '.html'; fs.writeFileSync(f, it.html);
    await page.goto('file://' + f); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: it.out, omitBackground: true });
    fs.unlinkSync(f);
  }
  await page.close();
}

async function clip(it) {
  const page = await browser.newPage({ viewport: { width: it.w, height: it.h } });
  page.on('pageerror', e => console.log('ERR', it.out, e.message));
  const f = it.out + '.html'; fs.writeFileSync(f, it.html);
  await page.goto('file://' + f);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map(im => im.complete ? 1 : new Promise(r => { im.onload = im.onerror = r; }))));
  const n = Math.round(it.dur * it.fps);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(it.fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(it.fps), it.out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let k = 0; k < n; k++) {
    await page.evaluate(t => window.setT(t), k / it.fps);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  fs.unlinkSync(f); await page.close();
  console.log('clip', path.basename(it.out), n, 'frames');
}

await pngs(spec.png || []);
for (const it of spec.clips || []) await clip(it);
await browser.close();
console.log('cards', (spec.png || []).length, 'png,', (spec.clips || []).length, 'clips');
