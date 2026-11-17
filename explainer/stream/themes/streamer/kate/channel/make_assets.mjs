// YouTube channel art for 「지구에서 온 Kate」: HTML templates -> PNG with headless Chromium.
// usage: node make_assets.mjs [only-name ...]     -> out/*.png
// Inputs in src/: Kate portraits (kit engine/portrait.mjs), the room photo (asset cache), a Paint crop from episode 1.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(process.env.HOME, '.cache', '2lab-stream');
const require = createRequire(path.join(CACHE, 'node', 'package.json'));
const { chromium } = require('playwright');
const SRC = 'file://' + path.join(HERE, 'src') + '/';
const FONT = 'file://' + path.join(CACHE, 'fonts', 'pretendard') + '/';
const ROOM = 'file://' + path.join(CACHE, 'rooms', 'kate_room.jpg');
const OUT = path.join(HERE, 'out'); fs.mkdirSync(OUT, { recursive: true });

const C = { night: '#10141f', night2: '#1b2233', moss: '#7fa877', moss2: '#a9c99c', amber: '#ffb35c', cream: '#fff3e0', purple: '#a349a4', purple2: '#c77dd0' };
const HEAD = `<meta charset="utf-8"><style>
@font-face{font-family:P;src:url(${FONT}Pretendard-Medium.woff2);font-weight:500}
@font-face{font-family:P;src:url(${FONT}Pretendard-SemiBold.woff2);font-weight:600}
@font-face{font-family:P;src:url(${FONT}Pretendard-Bold.woff2);font-weight:700}
@font-face{font-family:P;src:url(${FONT}Pretendard-ExtraBold.woff2);font-weight:800}
*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:P,sans-serif;overflow:hidden;background:transparent}
.abs{position:absolute}
</style>`;

// a stack of thick books drawn with CSS (the series' 'brick books')
function books(x, y, scale = 1) {
  const B = [['#7a4b2a', 330, 70, '총'], ['#3f5a3a', 300, 82, ''], ['#a349a4', 350, 64, ''], ['#2f3d5c', 310, 92, ''], ['#b8863b', 340, 74, '']];
  let top = 0, html = '';
  for (const [col, w, h] of B.slice().reverse()) {
    html += `<div class="abs" style="left:${(380 - w) / 2 + (Math.random() * 20 - 10)}px;top:${top}px;width:${w}px;height:${h}px;background:${col};border-radius:6px;
      box-shadow:inset 0 -6px 0 rgba(0,0,0,.18), inset 0 6px 0 rgba(255,255,255,.08), 0 6px 14px rgba(0,0,0,.35)">
      <div class="abs" style="left:26px;right:26px;top:${h / 2 - 3}px;height:6px;background:rgba(255,243,224,.55);border-radius:3px"></div>
      <div class="abs" style="right:-8px;top:6px;bottom:6px;width:10px;background:#efe6d2;border-radius:0 4px 4px 0"></div></div>`;
    top += h + 4;
  }
  return `<div class="abs" style="left:${x}px;top:${y}px;width:380px;height:${top}px;transform:scale(${scale});transform-origin:top left">${html}</div>`;
}

const A = {};

// ---------------- banner 2560x1440 (safe area for every device: centre 1546x423, i.e. x 507-2053, y 508-931)
const banner = (lang) => {
  const T = lang === 'ko'
    ? { kicker: '책듣는밤 · 매번 벽돌책 한 권', title: '지구에서 온 Kate', sub: '두꺼운 책, 꼭꼭 대신 읽고<br>소화하기 쉽게 말로 풀어 드려요', tag: '30분이면 한 권' }
    : { kicker: 'BOOK NIGHT · ONE BRICK OF A BOOK AT A TIME', title: 'Kate from Earth', sub: 'Thick books, read for you, chewed well,<br>told out loud so they go down easy', tag: 'One book in 30 minutes' };
  return { w: 2560, h: 1440, html: `${HEAD}<body style="width:2560px;height:1440px;position:relative;background:${C.night}">
  <img class="abs" src="${ROOM}" style="left:0;top:0;width:2560px;height:1440px;object-fit:cover;filter:saturate(.9) brightness(.62) blur(2px)">
  <div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(16,20,31,.92) 0%,rgba(16,20,31,.78) 38%,rgba(16,20,31,.25) 70%,rgba(16,20,31,.55) 100%)"></div>
  <div class="abs" style="inset:0;background:radial-gradient(ellipse at 74% 52%,rgba(255,179,92,.30),rgba(0,0,0,0) 45%)"></div>
  <div class="abs" style="left:0;right:0;top:508px;height:423px;border-top:2px solid rgba(169,201,156,.0)"></div>
  <img class="abs" src="${SRC}bust_smile_left.png" style="left:1470px;top:330px;width:700px;-webkit-mask-image:linear-gradient(180deg,#000 72%,transparent 96%)">
  <div class="abs" style="left:560px;top:540px;width:1000px">
    <div style="font-weight:700;font-size:34px;letter-spacing:${lang === 'ko' ? '4px' : '3px'};color:${C.moss2}">${T.kicker}</div>
    <div style="font-weight:800;font-size:${lang === 'ko' ? 128 : 120}px;line-height:1.08;color:${C.cream};margin-top:14px;text-shadow:0 6px 30px rgba(0,0,0,.5)">${T.title}</div>
    <div style="font-weight:600;font-size:40px;line-height:1.4;color:#e9dcc6;margin-top:18px">${T.sub}</div>
  </div>
  <div class="abs" style="left:560px;top:872px;padding:10px 22px;border-radius:30px;background:${C.amber};color:${C.night};font-weight:800;font-size:30px">📖 ${T.tag}</div>
  </body>` };
};
A.banner_ko = () => banner('ko');
A.banner_en = () => banner('en');

// ---------------- profile picture 800x800 (shown as a circle)
A.icon = () => ({ w: 800, h: 800, html: `${HEAD}<body style="width:800px;height:800px;position:relative;background:${C.night}">
  <div class="abs" style="inset:0;background:radial-gradient(circle at 50% 62%,#3d5a3a 0%,#22303a 48%,${C.night} 78%)"></div>
  <div class="abs" style="left:0;right:0;bottom:0;height:250px;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(122,75,42,.55))"></div>
  <div class="abs" style="left:110px;top:112px;width:580px;height:580px;border-radius:50%;background:radial-gradient(circle at 50% 45%,rgba(255,179,92,.45),rgba(255,179,92,0) 70%)"></div>
  <img class="abs" src="${SRC}icon_face.png" style="left:-10px;top:30px;width:820px">
  </body>` });

// ---------------- video watermark 150x150 (transparent, round)
A.watermark = () => ({ w: 150, h: 150, transparent: true, html: `${HEAD}<body style="width:150px;height:150px;position:relative">
  <div class="abs" style="left:3px;top:3px;width:144px;height:144px;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 62%,#3d5a3a,#22303a 55%,${C.night});box-shadow:0 0 0 4px ${C.cream}">
    <img class="abs" src="${SRC}icon_face.png" style="left:-4px;top:4px;width:152px"></div></body>` });

// ---------------- episode 1 thumbnail 1280x720
const thumb1 = (lang) => {
  const T = lang === 'ko'
    ? { badge: '책듣는밤 1화', first: '첫 방송', title: '보랏빛 소가 온다', sub: '30분 대신 읽기', by: '세스 고딘' }
    : { badge: 'BOOK NIGHT #1', first: 'FIRST STREAM', title: 'PURPLE COW', sub: 'Read for you · 30 min', by: 'Seth Godin' };
  return { w: 1280, h: 720, html: `${HEAD}<body style="width:1280px;height:720px;position:relative;background:#1a1426">
  <img class="abs" src="${ROOM}" style="left:0;top:0;width:1280px;height:720px;object-fit:cover;filter:brightness(.45) saturate(.8) blur(3px)">
  <div class="abs" style="inset:0;background:radial-gradient(ellipse at 30% 50%,rgba(163,73,164,.45),rgba(0,0,0,0) 60%)"></div>
  <div class="abs" style="left:34px;top:116px;width:720px;height:352px;background:#fff;border-radius:10px;transform:rotate(-2deg);box-shadow:0 16px 40px rgba(0,0,0,.55);overflow:hidden;border:6px solid #f3f3f3">
    <img class="abs" src="${SRC}purple_cow_field.jpg" style="left:-6px;top:-118px;width:720px">
    <svg class="abs" style="left:0;top:0" width="708" height="340"><ellipse cx="437" cy="128" rx="92" ry="120" fill="none" stroke="#ffe14d" stroke-width="7" transform="rotate(-8 437 128)"/></svg></div>
  <img class="abs" src="${SRC}bust_surprise.png" style="left:790px;top:60px;width:560px">
  <div class="abs" style="left:40px;top:30px;display:flex;gap:12px">
    <div style="background:${C.amber};color:${C.night};font-weight:800;font-size:40px;padding:6px 20px;border-radius:10px">${T.badge}</div>
    <div style="background:#ff4f5e;color:#fff;font-weight:800;font-size:40px;padding:6px 20px;border-radius:10px">${T.first}</div>
  </div>
  <div class="abs" style="left:40px;top:${lang === 'ko' ? 486 : 470}px;white-space:nowrap;font-weight:800;font-size:${lang === 'ko' ? 112 : 136}px;line-height:1.0;color:#fff;
       -webkit-text-stroke:3px #2a0f33;text-shadow:0 0 0 #000,6px 8px 0 ${C.purple},0 12px 30px rgba(0,0,0,.6);letter-spacing:${lang === 'ko' ? '-2px' : '2px'}">${T.title}</div>
  <div class="abs" style="left:46px;top:622px;background:${C.purple};color:#fff;font-weight:800;font-size:44px;padding:6px 22px;border-radius:12px;box-shadow:0 6px 16px rgba(0,0,0,.4)">${T.sub}</div>
  </body>` };
};
// ---------------- episode 1 fast edit thumbnail 1280x720: the real purple cow, big
const thumbEdit = (lang) => {
  const T = lang === 'ko'
    ? { badge: '책듣는밤 1화', ed: '편집본', title: '보랏빛 소가 온다', sub: '30분 방송 → 13분', hook: '진짜 있음?' }
    : { badge: 'BOOK NIGHT #1', ed: 'EDIT', title: 'PURPLE COW', sub: '30-min stream → 13 min', hook: 'real?!' };
  return { w: 1280, h: 720, html: `${HEAD}<body style="width:1280px;height:720px;position:relative;background:#1a1426;overflow:hidden">
  <img class="abs" src="${SRC}purple_cow_field.jpg" style="left:-80px;top:-150px;width:1500px">
  <div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(20,8,40,.92) 0%,rgba(20,8,40,.55) 40%,rgba(20,8,40,0) 62%)"></div>
  <svg class="abs" style="left:0;top:0" width="1280" height="720"><ellipse cx="842" cy="300" rx="150" ry="215" fill="none" stroke="#ffe14d" stroke-width="10" transform="rotate(-8 842 300)"/></svg>
  <div class="abs" style="left:880px;top:40px;transform:rotate(6deg);font-weight:800;font-size:64px;color:#ffe14d;-webkit-text-stroke:3px #111;text-shadow:4px 6px 0 #111">${T.hook}</div>
  <img class="abs" src="${SRC}bust_surprise.png" style="left:930px;top:250px;width:470px">
  <div class="abs" style="left:40px;top:30px;display:flex;gap:12px">
    <div style="background:${C.amber};color:${C.night};font-weight:800;font-size:40px;padding:6px 20px;border-radius:10px">${T.badge}</div>
    <div style="background:#ff4f5e;color:#fff;font-weight:800;font-size:40px;padding:6px 20px;border-radius:10px">${T.ed}</div>
  </div>
  <div class="abs" style="left:40px;top:${lang === 'ko' ? 450 : 430}px;white-space:nowrap;font-weight:800;font-size:${lang === 'ko' ? 100 : 128}px;line-height:1.0;color:#fff;
       -webkit-text-stroke:3px #2a0f33;text-shadow:6px 8px 0 ${C.purple},0 12px 30px rgba(0,0,0,.6);letter-spacing:${lang === 'ko' ? '-2px' : '2px'}">${T.title}</div>
  <div class="abs" style="left:46px;top:600px;background:${C.purple};color:#fff;font-weight:800;font-size:44px;padding:6px 22px;border-radius:12px;box-shadow:0 6px 16px rgba(0,0,0,.4)">${T.sub}</div>
  </body>` };
};
A.thumb_ep01_edit_ko = () => thumbEdit('ko');
A.thumb_ep01_edit_en = () => thumbEdit('en');
A.thumb_ep01_ko = () => thumb1('ko');
A.thumb_ep01_en = () => thumb1('en');

// ---------------- series cover, square 1280x1280 (playlist / podcast show art)
const cover = (lang) => {
  const T = lang === 'ko'
    ? { k: '지구에서 온 Kate', t: '책듣는밤', s: '벽돌책 꼭꼭 대신 읽고<br>소화하기 쉽게 말로 설명해 주는 밤' }
    : { k: 'Kate from Earth', t: 'Book Night', s: 'Brick-thick books, read for you<br>and told out loud, one night at a time' };
  return { w: 1280, h: 1280, html: `${HEAD}<body style="width:1280px;height:1280px;position:relative;background:${C.night}">
  <img class="abs" src="${ROOM}" style="left:-300px;top:0;width:2276px;height:1280px;object-fit:cover;filter:brightness(.5) saturate(.85) blur(3px)">
  <div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(16,20,31,.85) 0%,rgba(16,20,31,.35) 45%,rgba(16,20,31,.9) 100%)"></div>
  ${books(90, 640, 1.05)}
  <img class="abs" src="${SRC}bust_bigsmile_left.png" style="left:520px;top:330px;width:820px">
  <div class="abs" style="left:80px;top:90px;width:1120px">
    <div style="font-weight:700;font-size:44px;letter-spacing:3px;color:${C.moss2}">${T.k}</div>
    <div style="font-weight:800;font-size:200px;line-height:1.05;color:${C.cream};margin-top:6px;text-shadow:0 8px 30px rgba(0,0,0,.5)">${T.t}</div>
    <div style="font-weight:600;font-size:46px;line-height:1.35;color:#ecdcc4;margin-top:14px">${T.s}</div>
  </div>
  </body>` };
};
A.cover_series_ko = () => cover('ko');
A.cover_series_en = () => cover('en');

const only = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
for (const [name, fn] of Object.entries(A)) {
  if (only.length && !only.includes(name)) continue;
  const a = fn();
  const page = await browser.newPage({ viewport: { width: a.w, height: a.h } });
  const tmp = path.join(HERE, 'src', `_${name}.html`); fs.writeFileSync(tmp, '<!doctype html><html>' + a.html + '</html>');
  await page.goto('file://' + tmp); await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  const out = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: out, omitBackground: !!a.transparent });
  await page.close(); console.log(name, `${a.w}x${a.h}`, out);
}
await browser.close();
