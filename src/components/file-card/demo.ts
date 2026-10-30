/**
 * Offline demo content for the file-card and artifact-viewer docs: images drawn on a canvas at runtime
 * (`toDataURL('image/png')`), a short tone as a WAV object URL, and inline markdown / code / HTML. The colours
 * below are picture content, not UI.
 */
import type { FileItem } from './render';

type Pic = 'screen' | 'chart' | 'photo';

const cache = new Map<string, string>();

/** A small generated picture as a PNG data URL ('' where there is no canvas). */
export function demoImage(pic: Pic, w = 640, h = 400): string {
  const key = `${pic}:${w}x${h}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let url = '';
  try {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    if (g) {
      const s = w / 640;
      if (pic === 'screen') drawScreen(g, w, h, s);
      else if (pic === 'chart') drawChart(g, w, h, s);
      else drawPhoto(g, w, h);
      url = c.toDataURL('image/png');
    }
  } catch {
    url = '';
  }
  cache.set(key, url);
  return url;
}

function box(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string): void {
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
}

function drawScreen(g: CanvasRenderingContext2D, w: number, h: number, s: number): void {
  g.fillStyle = '#f4f4f5';
  g.fillRect(0, 0, w, h);
  box(g, 0, 0, w, 44 * s, 0, '#ffffff');
  box(g, 20 * s, 14 * s, 90 * s, 16 * s, 4 * s, '#18181b');
  for (let i = 0; i < 3; i++) box(g, (360 + i * 80) * s, 16 * s, 60 * s, 12 * s, 6 * s, '#d4d4d8');
  box(g, 20 * s, 64 * s, 150 * s, h - 84 * s, 10 * s, '#ffffff');
  for (let i = 0; i < 6; i++)
    box(g, 34 * s, (84 + i * 30) * s, (i === 1 ? 110 : 90) * s, 12 * s, 6 * s, i === 1 ? '#2f63e0' : '#e4e4e7');
  box(g, 190 * s, 64 * s, w - 210 * s, 120 * s, 10 * s, '#ffffff');
  box(g, 210 * s, 86 * s, 180 * s, 18 * s, 4 * s, '#18181b');
  box(g, 210 * s, 116 * s, 300 * s, 10 * s, 5 * s, '#d4d4d8');
  box(g, 210 * s, 136 * s, 240 * s, 10 * s, 5 * s, '#d4d4d8');
  box(g, w - 130 * s, 142 * s, 100 * s, 28 * s, 8 * s, '#18181b');
  for (let i = 0; i < 3; i++) {
    const x = (190 + i * 146) * s;
    box(g, x, 200 * s, 136 * s, h - 220 * s, 10 * s, '#ffffff');
    box(g, x + 14 * s, 216 * s, 108 * s, 70 * s, 6 * s, ['#dbe7ff', '#dcfce7', '#fef3c7'][i]);
    box(g, x + 14 * s, 300 * s, 80 * s, 10 * s, 5 * s, '#a1a1aa');
    box(g, x + 14 * s, 318 * s, 100 * s, 10 * s, 5 * s, '#e4e4e7');
  }
}

function drawChart(g: CanvasRenderingContext2D, w: number, h: number, s: number): void {
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#18181b';
  g.font = `600 ${18 * s}px system-ui, sans-serif`;
  g.fillText('p95 latency by day (ms)', 28 * s, 40 * s);
  const base = h - 50 * s;
  g.strokeStyle = '#e4e4e7';
  g.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = base - i * 64 * s;
    g.beginPath();
    g.moveTo(28 * s, y);
    g.lineTo(w - 28 * s, y);
    g.stroke();
  }
  const vals = [212, 198, 240, 186, 172, 168, 150, 146, 139, 131, 128, 122];
  const bw = (w - 80 * s) / vals.length;
  vals.forEach((v, i) => {
    const bh = (v / 260) * (base - 70 * s);
    box(g, 40 * s + i * bw, base - bh, bw * 0.62, bh, 4 * s, i >= vals.length - 4 ? '#2f63e0' : '#a9bdf3');
  });
}

function drawPhoto(g: CanvasRenderingContext2D, w: number, h: number): void {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#9cc3f0');
  sky.addColorStop(0.6, '#f7d9b8');
  sky.addColorStop(1, '#f2b58c');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff4d6';
  g.beginPath();
  g.arc(w * 0.72, h * 0.42, h * 0.1, 0, Math.PI * 2);
  g.fill();
  const ridge = (y: number, amp: number, color: string, seed: number) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8)
      g.lineTo(x, y + Math.sin(x / (60 + seed * 13) + seed) * amp + Math.sin(x / 23 + seed) * amp * 0.25);
    g.lineTo(w, h);
    g.fill();
  };
  ridge(h * 0.62, h * 0.06, '#7d8fb3', 1);
  ridge(h * 0.72, h * 0.05, '#4f6286', 2);
  ridge(h * 0.84, h * 0.04, '#2c3a57', 3);
}

/** A two-note chime as a 16-bit mono WAV object URL ('' without Blob / URL.createObjectURL). */
export function demoTone(): string {
  const hit = cache.get('tone');
  if (hit !== undefined) return hit;
  let url = '';
  try {
    const rate = 22050;
    const n = Math.floor(rate * 1.6);
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const str = (o: number, t: string) => {
      for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i));
    };
    str(0, 'RIFF');
    v.setUint32(4, 36 + n * 2, true);
    str(8, 'WAVEfmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    str(36, 'data');
    v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      const f = t < 0.8 ? 659.25 : 880;
      const local = t < 0.8 ? t : t - 0.8;
      const amp = Math.exp(-local * 4) * 0.35;
      v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * f * t) * amp * 32767), true);
    }
    url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  } catch {
    url = '';
  }
  cache.set('tone', url);
  return url;
}

const MIN = 60_000;

const NOTES_EN = `# Release notes — 2.14

The export job no longer times out on large workspaces.

## What changed
- Exports stream in **8 MB chunks** instead of one request
- Failed chunks retry up to 3 times with backoff
- The progress bar shows real bytes, not a guess

## Numbers
| Workspace | Before | After |
| --- | --- | --- |
| 2 GB | 4m 10s | 1m 52s |
| 18 GB | timed out | 14m 05s |

> Rollout is gradual: 10% today, everyone by Friday.

\`\`\`bash
npm run export -- --chunk 8mb
\`\`\`
`;

const NOTES_KO = `# 릴리스 노트 — 2.14

큰 워크스페이스에서도 내보내기가 더 이상 시간 초과되지 않아요.

## 바뀐 점
- 한 번에 보내지 않고 **8 MB 단위**로 나눠 보내요
- 실패한 조각은 최대 3번까지 다시 시도해요
- 진행 표시줄이 실제 전송량을 보여 줘요

| 워크스페이스 | 이전 | 이후 |
| --- | --- | --- |
| 2 GB | 4분 10초 | 1분 52초 |
| 18 GB | 시간 초과 | 14분 05초 |
`;

const CODE = `import { setTimeout as sleep } from 'node:timers/promises';

/** Retry a chunk upload with exponential backoff (250ms, 500ms, 1s). */
export async function withRetry<T>(run: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await run();
    } catch (err) {
      last = err;
      await sleep(250 * 2 ** i);
    }
  }
  throw last;
}
`;

const LOG = `12:04:01  migrate  start  target=orders_v7
12:04:01  migrate  lock acquired (orders)
12:04:03  migrate  copy   1,000,000 / 4,812,330 rows
12:04:09  migrate  copy   2,000,000 / 4,812,330 rows
12:04:15  migrate  copy   3,000,000 / 4,812,330 rows
12:04:21  migrate  copy   4,000,000 / 4,812,330 rows
12:04:26  migrate  copy   4,812,330 / 4,812,330 rows
12:04:27  migrate  index  orders_v7_customer_id (2.1s)
12:04:29  migrate  swap   orders -> orders_v7
12:04:29  migrate  done   in 28.4s, 0 errors
`;

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;font:16px/1.5 system-ui,sans-serif;color:#18181b;background:#fff}
header{display:flex;justify-content:space-between;align-items:center;padding:20px 48px;border-bottom:1px solid #eee}
.logo{font-weight:700}.nav a{margin-left:24px;color:#555;text-decoration:none}
.hero{padding:72px 48px;max-width:720px}h1{font-size:44px;line-height:1.1;margin:0 0 16px;letter-spacing:-.02em}
p{color:#555;font-size:18px}.cta{display:inline-block;margin-top:16px;padding:12px 20px;border-radius:10px;background:#18181b;color:#fff;text-decoration:none}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:0 48px 48px}.card{padding:20px;border:1px solid #eee;border-radius:12px}
</style></head><body><header><span class="logo">Northwind</span><nav class="nav"><a href="#">Product</a><a href="#">Pricing</a><a href="#">Docs</a></nav></header>
<section class="hero"><h1>Ship reports your team actually reads</h1><p>Northwind turns raw exports into a weekly brief — charts, highlights and the three numbers that moved.</p><a class="cta" href="#">Start free</a></section>
<section class="grid"><div class="card"><b>Weekly brief</b><p>Every Monday, 9:00.</p></div><div class="card"><b>Alerts</b><p>Only when a number moves.</p></div><div class="card"><b>Exports</b><p>CSV, PDF, Sheets.</p></div></section>
</body></html>`;

/** Seven mixed artifacts a run might leave behind (fresh times on every call). */
export function demoFiles(lang: 'en' | 'ko' = 'en'): FileItem[] {
  const now = Date.now();
  const ko = lang === 'ko';
  return [
    {
      id: 'shot',
      name: ko ? '결제-화면.png' : 'checkout-flow.png',
      size: 184_320,
      time: now - 2 * MIN,
      thumb: demoImage('screen', 320, 200),
      url: demoImage('screen', 1280, 800),
      meta: ko ? '빌드 에이전트가 만듦' : 'from Build agent',
    },
    {
      id: 'notes',
      name: ko ? '릴리스-노트.md' : 'release-notes.md',
      size: 2_410,
      time: now - 4 * MIN,
      text: ko ? NOTES_KO : NOTES_EN,
      url: '/files/release-notes.md',
    },
    {
      id: 'page',
      name: 'landing-preview.html',
      size: 12_700,
      time: now - 6 * MIN,
      text: PAGE,
      url: '/files/landing-preview.html',
    },
    {
      id: 'chart',
      name: 'latency-p95.png',
      size: 96_256,
      time: now - 9 * MIN,
      thumb: demoImage('chart', 320, 200),
      url: demoImage('chart', 1280, 800),
    },
    {
      id: 'code',
      name: 'retry.ts',
      size: 1_180,
      time: now - 12 * MIN,
      text: CODE,
      url: '/files/retry.ts',
    },
    {
      id: 'log',
      name: 'migration-run.log',
      size: 7_940,
      time: now - 15 * MIN,
      text: LOG,
      url: '/files/migration-run.log',
    },
    {
      id: 'memo',
      name: ko ? '스탠드업-요약.wav' : 'standup-summary.wav',
      size: 70_600,
      time: now - 21 * MIN,
      url: demoTone(),
    },
    {
      id: 'invoice',
      name: 'invoice-2026-10.pdf',
      size: 318_464,
      time: now - 3 * 60 * MIN,
      url: '/files/invoice-2026-10.pdf',
      meta: ko ? '청구 에이전트가 만듦' : 'from Billing agent',
    },
  ];
}

/** A photo-like image item (for kind galleries). */
export function demoPhoto(): FileItem {
  return {
    id: 'photo',
    name: 'site-visit.jpg',
    size: 2_340_000,
    time: Date.now() - 50 * MIN,
    thumb: demoImage('photo', 320, 200),
    url: demoImage('photo', 1280, 800),
  };
}
