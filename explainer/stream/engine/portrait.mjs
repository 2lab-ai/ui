// A still of one cast member on a transparent background, for channel art (profile picture, banner, thumbnails).
// usage: node portrait.mjs <streamer theme> <role> <out.png> [--w 1600] [--h 1600] [--height 4200] [--focus 0.2] [--fx 0]
//                          [--expr smile|bigsmile|surprise|soft|neutral|wink] [--look cam|left|right|up] [--mouth 0..1] [--tint]
// --height: the whole model's height in px; --focus: which fraction of the model (from its top) sits at the image centre;
// --fx: horizontal shift in px. Physics runs ~2 s first so hair and clothes settle. Same model files and hidden parts as the stream.
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

const [themeId, role, out, ...rest] = process.argv.slice(2);
if (!out) { console.log('usage: node portrait.mjs <streamer theme> <role> <out.png> [options]'); process.exit(1); }
const opt = { w: 1600, h: 1600, height: 4200, focus: 0.2, fx: 0, expr: 'smile', look: 'cam', mouth: 0, tint: false };
for (let i = 0; i < rest.length; i++) {
  const k = rest[i].replace(/^--/, '');
  if (k === 'tint') opt.tint = true;
  else opt[k] = isNaN(+rest[i + 1]) ? rest[i + 1] : +rest[i + 1], i++;
}
const theme = JSON.parse(fs.readFileSync(path.join(KIT, 'themes', 'streamer', themeId, 'theme.json'), 'utf8'));
const cast = theme.cast[role];
if (!cast) { console.log(`no role "${role}" in streamer theme ${themeId}`); process.exit(1); }
const modelUrl = cast.model.startsWith('cache:') ? '/cache/' + cast.model.slice(6) : '/themes/streamer/' + themeId + '/' + cast.model;

// a face as Live2D parameters (the same parameter ids the rigs drive)
const EXPR = {
  neutral: { ParamMouthUp: 0.15 },
  soft: { ParamMouthUp: 0.6, ParamCheek: 0.2, ParamEyeLSmile: 0.1, ParamEyeRSmile: 0.1, ParamEyeLOpen: 0.9, ParamEyeROpen: 0.9 },
  smile: { ParamMouthUp: 0.86, ParamCheek: 0.31, ParamEyeLSmile: 0.2, ParamEyeRSmile: 0.2, ParamEyeLOpen: 0.82, ParamEyeROpen: 0.82 },
  bigsmile: { ParamMouthUp: 1, ParamCheek: 0.6, ParamEyeLSmile: 0.6, ParamEyeRSmile: 0.6, ParamEyeLOpen: 0.45, ParamEyeROpen: 0.45, ParamEyeEffect: 0.7 },
  surprise: { ParamEyeLOpen: 1.2, ParamEyeROpen: 1.2, ParamBrowLY: 1, ParamBrowRY: 1, ParamO: 0.45, ParamEyeBallForm: -0.8 },
  wink: { ParamMouthUp: 0.9, ParamCheek: 0.5, ParamEyeLOpen: 1, ParamEyeROpen: 0, ParamEyeRSmile: 1 },
};
const LOOK = { cam: [0, 0, 0, 0], left: [-14, 2, -0.6, 0], right: [14, 2, 0.6, 0], up: [-3, 14, -0.1, 0.8] };
const [ax, ay, ex, ey] = LOOK[opt.look] || LOOK.cam;
const params = Object.assign({ ParamAngleX: ax, ParamAngleY: ay, ParamEyeBallX: ex, ParamEyeBallY: ey, ParamBodyAngleX: ax * 0.4,
  ParamBreath: 0.5, PartArmLA: 1, PartArmLB: 0, ParamA: opt.mouth }, EXPR[opt.expr] || EXPR.smile);
if (role === 'sis') { delete params.PartArmLA; delete params.PartArmLB; params.ParamMouthForm = params.ParamMouthUp ?? 0.5; params.ParamMouthOpenY = opt.mouth; }

const ROOTS = { cache: CACHE, themes: path.join(KIT, 'themes') };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname).split('/').filter(Boolean);
  if (u.length === 0) { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
  const root = ROOTS[u[0]]; const file = root && path.join(root, ...u.slice(1));
  if (!file || !file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  const ct = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': ct }); fs.createReadStream(file).pipe(res);
});
const PAGE = `<!doctype html><html><head><style>html,body{margin:0;background:transparent;overflow:hidden}</style>
<script src="/cache/live2dcubismcore.min.js"></script>
<script src="/cache/node/node_modules/pixi.js/dist/browser/pixi.min.js"></script>
<script src="/cache/node/node_modules/pixi-live2d-display/dist/cubism4.min.js"></script></head>
<body><canvas id="c" width="${opt.w}" height="${opt.h}"></canvas></body></html>`;
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: opt.w, height: opt.h } });
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`);
await page.evaluate(async ([url, hide, tint, P, o]) => {
  const app = new PIXI.Application({ view: document.getElementById('c'), width: o.w, height: o.h, backgroundAlpha: 0, autoStart: false, preserveDrawingBuffer: true, antialias: true });
  const m = await PIXI.live2d.Live2DModel.from(url, { autoInteract: false, autoUpdate: false });
  m.internalModel.eyeBlink = undefined; m.internalModel.breath = undefined;
  const s = o.height / m.height; m.scale.set(s);
  m.x = o.w / 2 - m.width / 2 + o.fx; m.y = o.h / 2 - o.height * o.focus;
  if (tint) { const f = new PIXI.filters.ColorMatrixFilter(); f.matrix = tint; m.filters = [f]; }
  app.stage.addChild(m);
  m.internalModel.on('beforeModelUpdate', () => { const c = m.internalModel.coreModel; for (const id of hide || []) { try { c.setPartOpacityById(id, 0); } catch (e) {} } });
  m.internalModel.on('afterMotionUpdate', () => { const c = m.internalModel.coreModel; for (const k in P) { try { c.setParameterValueById(k, P[k]); } catch (e) {} } });
  for (let i = 0; i < 70; i++) m.update(1000 / 30);   // let the physics settle
  app.renderer.render(app.stage);
}, [modelUrl, cast.hide_parts || [], opt.tint ? cast.tint : null, params, opt]);
await page.screenshot({ path: out, omitBackground: true });
await browser.close(); srv.close();
console.log('portrait', out, `${opt.w}x${opt.h}`, opt.expr, opt.look);
