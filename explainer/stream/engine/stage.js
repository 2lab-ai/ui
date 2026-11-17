// Stage renderer: everything on screen is a pure function of the frame index (plus Live2D physics, stepped in order).
const $ = id => document.getElementById(id);
let L, TL, app, mainM, sisM, sisBox, sisMask, sisBg, art, actx;
let mainCur = {}, sisCur = {};
let opIdx = 0, lastChatN = -1, curTool = '';

const ICON = {
  select: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" fill="none" stroke="#333" stroke-width="1.6" stroke-dasharray="3 2"/></svg>',
  crop: '<svg viewBox="0 0 24 24"><path d="M6 2v16h16M2 6h16v16" fill="none" stroke="#333" stroke-width="1.6"/></svg>',
  resize: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="12" height="12" fill="none" stroke="#333" stroke-width="1.6"/><path d="M11 3h10v10" fill="none" stroke="#333" stroke-width="1.6"/></svg>',
  rotate: '<svg viewBox="0 0 24 24"><path d="M5 12a7 7 0 1 0 2-5" fill="none" stroke="#333" stroke-width="1.6"/><path d="M4 3v5h5" fill="none" stroke="#333" stroke-width="1.6"/></svg>',
  pencil: '<svg viewBox="0 0 24 24"><path d="M4 20l1.5-5L16 4.5l3.5 3.5L9 18.5z" fill="#ffd36b" stroke="#333" stroke-width="1.3"/><path d="M4 20l1.5-5 3.5 3.5z" fill="#f2c9a0" stroke="#333" stroke-width="1"/></svg>',
  fill: '<svg viewBox="0 0 24 24"><path d="M5 11l7-7 7 7-7 7z" fill="#cfe3ff" stroke="#333" stroke-width="1.4"/><path d="M19 14c1.5 2.5 1.5 4 0 4s-1.5-1.5 0-4z" fill="#3b82f6"/></svg>',
  text: '<svg viewBox="0 0 24 24"><text x="5" y="19" font-size="17" font-family="serif" fill="#333">A</text></svg>',
  eraser: '<svg viewBox="0 0 24 24"><path d="M4 15l8-8 7 7-5 5H8z" fill="#ffb3c7" stroke="#333" stroke-width="1.3"/><path d="M4 21h16" stroke="#333" stroke-width="1.2"/></svg>',
  picker: '<svg viewBox="0 0 24 24"><path d="M5 19l9-9 3 3-9 9H5z" fill="none" stroke="#333" stroke-width="1.4"/><path d="M14 7l3-3 3 3-3 3z" fill="#555"/></svg>',
  zoom: '<svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6" fill="none" stroke="#333" stroke-width="1.6"/><path d="M14.5 14.5L20 20" stroke="#333" stroke-width="2"/></svg>',
  brush: '<svg viewBox="0 0 24 24"><path d="M14 3l7 7-6 3-4-4z" fill="#8fb8ff" stroke="#333" stroke-width="1.2"/><path d="M11 9l4 4c-2 4-5 6-11 7 1-6 3-9 7-11z" fill="#555"/></svg>',
  size: '<svg viewBox="0 0 24 24"><path d="M3 5h18" stroke="#333" stroke-width="1"/><path d="M3 10h18" stroke="#333" stroke-width="2"/><path d="M3 16h18" stroke="#333" stroke-width="3.2"/></svg>',
  layers: '<svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5z" fill="#dce7ff" stroke="#333" stroke-width="1.2"/><path d="M3 13l9 5 9-5" fill="none" stroke="#333" stroke-width="1.2"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M4 4h13l3 3v13H4z" fill="none" stroke="#333" stroke-width="1.5"/><rect x="8" y="4" width="7" height="5" fill="none" stroke="#333" stroke-width="1.3"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M9 7L4 11l5 4" fill="none" stroke="#333" stroke-width="1.6"/><path d="M4 11h10a5 5 0 0 1 0 10h-3" fill="none" stroke="#333" stroke-width="1.6"/></svg>',
  redo: '<svg viewBox="0 0 24 24"><path d="M15 7l5 4-5 4" fill="none" stroke="#333" stroke-width="1.6"/><path d="M20 11H10a5 5 0 0 0 0 10h3" fill="none" stroke="#333" stroke-width="1.6"/></svg>',
};
const CUR = [
  // 0 arrow (hotspot 1,1)
  '<path d="M1.5 1.5v22l5.6-5.4 3.7 8.4 3.6-1.6-3.6-8.2h7.6z" fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round"/>',
  // 1 pencil: Win11 Paint shows a round outline the size of the tip (hotspot 16,16)
  '<circle cx="16" cy="16" r="5.5" fill="none" stroke="#fff" stroke-width="3"/><circle cx="16" cy="16" r="5.5" fill="none" stroke="#000" stroke-width="1.3"/>',
  // 2 i-beam (hotspot 16,16)
  '<path d="M12 4h3l1 1 1-1h3M16 5v22M12 28h3l1-1 1 1h3" fill="none" stroke="#fff" stroke-width="3.2"/><path d="M12 4h3l1 1 1-1h3M16 5v22M12 28h3l1-1 1 1h3" fill="none" stroke="#000" stroke-width="1.3"/>',
  // 3 crosshair (selection) hotspot 16,16
  '<path d="M16 4v24M4 16h24" stroke="#fff" stroke-width="3"/><path d="M16 4v24M4 16h24" stroke="#000" stroke-width="1.2"/>',
];
const HOT = [[1, 1], [16, 16], [16, 16], [16, 16]];
const PAL = ['#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4',
  '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7'];

function el(tag, cls, html, style) { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; if (style) Object.assign(e.style, style); return e; }
function px(v) { return v + 'px'; }

function buildUI() {
  const w = L.win, W = $('win');
  Object.assign(W.style, { left: px(w.x), top: px(w.y), width: px(w.w), height: px(w.h) });
  $('titlebar').style.height = px(w.title);
  const mb = $('menubar'); Object.assign(mb.style, { top: px(w.title), height: px(w.menu) });
  const rel = (p) => [p[0] - w.x, p[1] - w.y];
  for (const [k, lab] of [['file', '파일'], ['edit', '편집'], ['view', '보기']]) { const [x, y] = rel(L.menu[k]); mb.appendChild(el('span', 'm', lab, { left: px(x), top: px(y - w.title) })); }
  for (const k of ['save', 'undo', 'redo']) { const [x, y] = rel(L.menu[k]); const e = el('span', 'i', ICON[k], { left: px(x), top: px(y - w.title) }); mb.appendChild(e); }
  mb.appendChild(el('span', 'm', '⚙', { left: px(w.w - 30), top: px(w.menu / 2), fontSize: '16px', color: '#444' }));
  const tb = $('toolbar'); const ty = w.title + w.menu; Object.assign(tb.style, { top: px(ty), height: px(w.tool) });
  const T = (k, big) => { const [x, y] = rel(L.tools[k]); const e = el('div', 'tbtn' + (big ? ' big' : ''), ICON[k], { left: px(x), top: px(y - ty) }); e.id = 'tb_' + k; tb.appendChild(e); return e; };
  T('select', 1); T('crop'); T('resize'); T('rotate'); T('pencil'); T('fill'); T('text'); T('eraser'); T('picker'); T('zoom'); T('brush', 1);
  // shapes gallery
  const sg = el('div', '', '', { position: 'absolute', left: px(470), top: px(14), width: px(150), height: px(52), border: '1px solid #ddd', borderRadius: '4px', background: '#fff' });
  const shapes = ['<path d="M3 17L17 3" stroke="#333" stroke-width="1.3"/>', '<path d="M3 15c4-12 8 4 14-10" fill="none" stroke="#333" stroke-width="1.3"/>', '<ellipse cx="10" cy="10" rx="7" ry="5" fill="none" stroke="#333" stroke-width="1.3"/>', '<rect x="3" y="5" width="14" height="10" fill="none" stroke="#333" stroke-width="1.3"/>', '<rect x="3" y="5" width="14" height="10" rx="3" fill="none" stroke="#333" stroke-width="1.3"/>', '<path d="M10 3l7 14H3z" fill="none" stroke="#333" stroke-width="1.3"/>', '<path d="M3 10h10l-3-4M13 10l-3 4" fill="none" stroke="#333" stroke-width="1.3"/>', '<path d="M10 3l2 5h5l-4 3 2 6-5-4-5 4 2-6-4-3h5z" fill="none" stroke="#333" stroke-width="1.1"/>', '<path d="M4 4h12v9H9l-4 3v-3H4z" fill="none" stroke="#333" stroke-width="1.2"/>', '<path d="M10 17s-7-4-7-9a3.5 3.5 0 0 1 7-1 3.5 3.5 0 0 1 7 1c0 5-7 9-7 9z" fill="none" stroke="#333" stroke-width="1.2"/>', '<path d="M3 10l7-7 7 7-7 7z" fill="none" stroke="#333" stroke-width="1.2"/>', '<path d="M5 3h10l3 7-3 7H5l-3-7z" fill="none" stroke="#333" stroke-width="1.2"/>'];
  shapes.forEach((s, i) => sg.appendChild(el('span', '', `<svg viewBox="0 0 20 20" width="20" height="20">${s}</svg>`, { position: 'absolute', left: px(4 + (i % 6) * 24), top: px(4 + Math.floor(i / 6) * 24) })));
  tb.appendChild(sg);
  T('size', 1);
  // colors
  const [cx, cy] = rel(L.tools.color1);
  tb.appendChild(el('div', '', '', { position: 'absolute', left: px(cx - 18), top: px(cy - ty - 18), width: '36px', height: '36px', borderRadius: '50%', background: '#000', boxShadow: '0 0 0 2px #fff,0 0 0 3.5px #3b82f6' }));
  tb.appendChild(el('div', '', '', { position: 'absolute', left: px(cx + 16), top: px(cy - ty + 2), width: '22px', height: '22px', borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 1px #aaa' }));
  PAL.forEach((c, i) => { const [bx, by] = rel(L.tools.black); tb.appendChild(el('span', 'sw', '', { left: px(bx + (i % 10) * 26), top: px(by - ty + Math.floor(i / 10) * 26), background: c })); });
  for (let i = 0; i < 10; i++) { const [bx, by] = rel(L.tools.black); tb.appendChild(el('span', 'sw', '', { left: px(bx + i * 26), top: px(by - ty + 52), background: '#fff', boxShadow: '0 0 0 1px #ddd' })); }
  tb.appendChild(el('div', 'tbtn', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#666" stroke-width="1.3"/><path d="M12 7v10M7 12h10" stroke="#666" stroke-width="1.4"/></svg>', { left: px(rel(L.tools.black)[0] + 10 * 26 + 6), top: px(rel(L.tools.black)[1] - ty + 26) }));
  tb.appendChild(el('div', 'tbtn big', ICON.layers, { left: px(w.w - 70), top: px(38) }));
  // group labels + separators
  for (const [x, lab] of [[47, '선택'], [150, '이미지'], [270, '도구'], [377, '브러시'], [520, '도형'], [652, '크기'], [880, '색'], [w.w - 70, '레이어']]) tb.appendChild(el('span', 'grp-label', lab, { left: px(x) }));
  for (const x of [88, 210, 330, 420, 620, 690, w.w - 112]) tb.appendChild(el('div', 'sep', '', { left: px(x) }));
  // workspace + canvas
  const ws = $('workspace'); const wy = w.title + w.menu + w.tool; Object.assign(ws.style, { top: px(wy), height: px(w.h - wy - w.status) });
  art = $('art'); art.width = L.canvas.w; art.height = L.canvas.h;
  Object.assign(art.style, { left: px(L.canvas.x - w.x), top: px(L.canvas.y - w.y - wy), width: px(L.canvas.w), height: px(L.canvas.h) });
  actx = art.getContext('2d'); actx.fillStyle = '#fff'; actx.fillRect(0, 0, L.canvas.w, L.canvas.h);
  // resize handles
  for (const [hx, hy] of []) ws.appendChild(el('div', '', '', { position: 'absolute', left: px(L.canvas.x - w.x + hx - 3), top: px(L.canvas.y - w.y - wy + hy - 3), width: '6px', height: '6px', background: '#fff', border: '1px solid #666' }));
  const sb = $('statusbar'); sb.style.height = px(w.status);
  sb.appendChild(el('span', 's', '<svg viewBox="0 0 24 24"><path d="M5 3v15l4-4 3 7 2.5-1-3-7h6z" fill="none" stroke="#333" stroke-width="1.4"/></svg><span id="sb_pos"></span>', { left: '18px' }));
  sb.appendChild(el('span', 's', '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" fill="none" stroke="#333" stroke-width="1.4" stroke-dasharray="3 2"/></svg><span id="sb_sel"></span>', { left: '210px' }));
  sb.appendChild(el('span', 's', `<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" fill="none" stroke="#333" stroke-width="1.4"/></svg><span>${L.canvas.w} × ${L.canvas.h}px</span>`, { left: '390px' }));
  sb.appendChild(el('span', 's', '<span>100%</span><span style="display:inline-block;width:120px;height:3px;background:#ccc;border-radius:2px;position:relative"><span style="position:absolute;left:58px;top:-5px;width:12px;height:12px;border-radius:50%;background:#3b82f6"></span></span>', { right: '60px' }));
  sb.appendChild(el('span', 's', '<span>−</span>', { right: '196px' }));
  sb.appendChild(el('span', 's', '<span>+</span>', { right: '40px' }));
  // overlays
  Object.assign($('chat').style, { left: px(L.chat.x), top: px(L.chat.y), width: px(L.chat.w), height: px(L.chat.h) });
  Object.assign($('label').style, { left: px(L.label.x), top: px(L.label.y), width: px(L.label.w), height: px(L.label.h) });
  const tbar = $('textbar'); Object.assign(tbar.style, { left: px(L.canvas.x - w.x + 10), top: px(L.canvas.y - w.y - 46) });
}

async function loadModel(url) {
  const m = await PIXI.live2d.Live2DModel.from(url, { autoInteract: false, autoUpdate: false });
  m.internalModel.eyeBlink = undefined;
  m.internalModel.breath = undefined;
  return m;
}

const STR = k => (TL.stage.strings || {})[k] || '';
async function applyTheme() {
  // overlay CSS from the streaming (and content) theme, strings, title, the streamer's room
  for (const href of TL.stage.css || []) {
    await new Promise(res => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.onload = l.onerror = res; document.head.appendChild(l); });
  }
  $('chattitle').textContent = STR('chat_title'); $('title').textContent = TL.stage.title || '';
  $('al_word').textContent = STR('donation_word'); $('brb_title').textContent = STR('brb_title');
  await new Promise(res => { const b = $('bg'); b.onload = b.onerror = res; b.src = TL.stage.bg; });
}

window.setup = async function (layout, timeline) {
  L = layout; TL = timeline;
  buildUI();
  await applyTheme();
  const MD = TL.stage.models;
  app = new PIXI.Application({ view: $('pixi'), width: 1920, height: 1080, backgroundAlpha: 0, autoStart: false, preserveDrawingBuffer: true, antialias: true });
  mainM = await loadModel(MD.main.model);
  sisM = await loadModel((MD.sis || MD.main).model);
  // main placement: scale so the full model is L.main.height px tall
  const mh = mainM.height; const ms = L.main.height / mh; mainM.scale.set(ms); mainM._ms = ms;
  mainM.x = L.main.cx - mainM.width / 2; mainM.y = L.main.top; mainM._baseY = mainM.y;
  app.stage.addChild(mainM);
  // sis: composited into the same room, leaning in from the right edge (no panel)
  sisBox = new PIXI.Container(); app.stage.addChild(sisBox);
  const S = L.sis;
  const ss = S.height / sisM.height; sisM.scale.set(ss); sisM._ss = ss; sisM._w0 = sisM.width;
  sisBox.addChild(sisM); sisBox.visible = false;
  // the room's light on the avatars (a colour matrix per model, from the streamer theme)
  const tint = m => { if (!m || !m.tint) return []; const f = new PIXI.filters.ColorMatrixFilter(); f.matrix = m.tint; return [f]; };
  try { mainM.filters = tint(MD.main); sisM.filters = tint(MD.sis); } catch (e) {}
  const hook = (m, cur) => m.internalModel.on('afterMotionUpdate', () => { const c = m.internalModel.coreModel; for (const k in cur) c.setParameterValueById(k, cur[k]); });
  // parts the streamer theme hides (Mao: the wand and the colour-sample blob that showed as a white bloom)
  const hide = (m, ids) => m.internalModel.on('beforeModelUpdate', () => { const c = m.internalModel.coreModel; for (const pid of ids || []) { try { c.setPartOpacityById(pid, 0); } catch (e) {} } });
  hide(mainM, MD.main.hide_parts); if (MD.sis) hide(sisM, MD.sis.hide_parts);
  hook(mainM, mainCur); hook(sisM, sisCur);
  document.fonts && await document.fonts.ready;
  return { mainH: mh, sisH: sisM.height / ss };
};

function setParams(cur, src, f) { for (const k in src) cur[k] = src[k][f]; }

function applyOps(f) {
  const ops = TL.ops;
  while (opIdx < ops.length && ops[opIdx].f <= f) { doOp(ops[opIdx]); opIdx++; }
}
let tbState = null; const undoStack = [];
function doOp(o) {
  if (o.op === 'seg') {
    actx.strokeStyle = o.c || '#000'; actx.lineWidth = o.w || 4; actx.lineCap = 'round'; actx.lineJoin = 'round';
    actx.beginPath(); actx.moveTo(o.pts[0][0], o.pts[0][1]);
    for (let i = 1; i < o.pts.length; i++) actx.lineTo(o.pts[i][0], o.pts[i][1]);
    if (o.pts.length === 1) actx.lineTo(o.pts[0][0] + 0.1, o.pts[0][1]);
    actx.stroke();
  } else if (o.op === 'tool') {
    curTool = o.name;
    document.querySelectorAll('.tbtn.on').forEach(e => e.classList.remove('on'));
    const e = $('tb_' + o.name); if (e) e.classList.add('on');

  } else if (o.op === 'tb_open') {
    tbState = { x: o.x, y: o.y, size: o.size, s: '', c: '' }; $('textbar').style.display = 'flex';
    const tb = $('textbox'); const w = L.win; const wy = w.title + w.menu + w.tool;
    Object.assign(tb.style, { display: 'block', left: px(L.canvas.x - w.x + o.x), top: px(L.canvas.y - w.y - wy + o.y), fontSize: px(o.size), minWidth: px(o.minw || 260), minHeight: px(o.size * 1.3) });
    renderTB();
  } else if (o.op === 'tb') { tbState.s = o.s; tbState.c = o.c || ''; renderTB(); }
  else if (o.op === 'tb_commit') {
    const s = tbState; actx.fillStyle = '#000'; actx.font = `${s.size}px Pret`; actx.textBaseline = 'top';
    const lines = (s.s + (s.c || '')).split('\n'); lines.forEach((ln, i) => actx.fillText(ln, s.x + 4, s.y + 3 + i * s.size * 1.25 + s.size * 0.06));
    $('textbox').style.display = 'none'; tbState = null; $('textbar').style.display = 'none';
  } else if (o.op === 'erase') { actx.fillStyle = '#fff'; actx.fillRect(o.x, o.y, o.w, o.h); }
  else if (o.op === 'sel') {
    let s = $('selrect'); if (!s) { s = el('div', '', '', { position: 'absolute', border: '1px dashed #1a73e8', background: 'rgba(26,115,232,.06)' }); s.id = 'selrect'; $('workspace').appendChild(s); }
    const w = L.win; const wy = w.title + w.menu + w.tool;
    if (o.w <= 0) { s.style.display = 'none'; $('sb_sel').textContent = ''; }
    else { Object.assign(s.style, { display: 'block', left: px(L.canvas.x - w.x + o.x), top: px(L.canvas.y - w.y - wy + o.y), width: px(o.w), height: px(o.h) }); $('sb_sel').textContent = `${Math.round(o.w)} × ${Math.round(o.h)}px`; }
  } else if (o.op === 'title') { $('wtitle').textContent = o.s; }
  else if (o.op === 'snap') { undoStack.push(actx.getImageData(0, 0, L.canvas.w, L.canvas.h)); }
  else if (o.op === 'undo') { const im = undoStack.pop(); if (im) actx.putImageData(im, 0, 0); }
}
let caretOn = true;
function renderTB() {
  if (!tbState) return;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('textbox').innerHTML = esc(tbState.s) + (tbState.c ? `<span class="comp">${esc(tbState.c)}</span>` : '') + (caretOn ? '<span class="caret"></span>' : '<span class="caret" style="opacity:0"></span>');
}

function fmtClock(sec) { const h = Math.floor(sec / 3600) % 24, m = Math.floor(sec / 60) % 60, s = Math.floor(sec) % 60; const ap = h < 12 ? '오전' : '오후'; const hh = h % 12 === 0 ? 12 : h % 12; return `${ap} ${hh}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }

function renderChat(f) {
  const ms = TL.chat; let n = 0; while (n < ms.length && ms[n].f <= f) n++;
  const list = $('chatinner');
  if (n !== lastChatN) {
    list.innerHTML = '';
    for (const m of ms.slice(Math.max(0, n - 14), n)) {
      const d = el('div', 'msg'); d.appendChild(el('span', 'dot', '', { background: m.c })); d.appendChild(document.createTextNode(m.m)); list.appendChild(d);
    }
    lastChatN = n;
  }
  if (n > 0) { const last = list.lastChild; const p = Math.min(1, (f - ms[n - 1].f) / 5); const h = last ? last.offsetHeight + 7 : 0; list.style.transform = `translateY(${(1 - p) * h}px)`; last && (last.style.opacity = String(Math.min(1, p * 1.5))); }
}

window.renderFrame = function (f) {
  const fps = L.fps;
  applyOps(f);
  // text caret blink (530 ms like Windows)
  const c = Math.floor(f / fps * 1000 / 530) % 2 === 0; if (c !== caretOn) { caretOn = c; renderTB(); }
  // cursor
  const cu = TL.cursor; const k = cu.k[f];
  const cs = $('cursor');
  if (k < 0) cs.style.display = 'none';
  else { cs.style.display = 'block'; cs.innerHTML = CUR[k]; cs.style.transform = `translate(${cu.x[f] - HOT[k][0]}px,${cu.y[f] - HOT[k][1]}px)`; }
  const lx = Math.round(cu.x[f] - L.canvas.x), ly = Math.round(cu.y[f] - L.canvas.y);
  $('sb_pos').textContent = (lx >= 0 && ly >= 0 && lx < L.canvas.w && ly < L.canvas.h) ? `${lx}, ${ly}px` : '';
  // overlays
  const jadd = (TL.jumps || []).filter(j => j.f <= f).reduce((a, j) => a + j.add, 0);
  $('clock').textContent = fmtClock(TL.clock0 + f / fps + jadd);
  renderChat(f);
  const jc = (TL.jumps || []).find(j => TL.showJumpCaption && f >= j.f && f < j.f + 75); const JC = $('jumpcap');
  if (jc) { JC.style.display = 'block'; JC.style.opacity = String(Math.min(1, (f - jc.f) / 6, (jc.f + 75 - f) / 10)); JC.textContent = STR('jump_caption').replace('{min}', Math.round(jc.add / 60)); } else JC.style.display = 'none';
  const al = TL.alerts.find(a => f >= a.f0 && f < a.f1);
  const A = $('alert');
  if (al) { A.style.display = 'block'; $('al_amt').textContent = al.amt; $('al_msg').textContent = al.msg; A.querySelector('.em').textContent = al.em || '💪'; const p = Math.min(1, (f - al.f0) / 7), q = Math.min(1, (al.f1 - f) / 10); A.style.opacity = String(Math.min(p, q)); A.style.transform = `translate(-50%,0) scale(${0.85 + 0.15 * easeOutBack(p)})`; }
  else A.style.display = 'none';
  const b = TL.brb; const B = $('brb');
  if (b && f >= b.f0 && f < b.f1) { B.style.display = 'block'; const p = Math.min(1, (f - b.f0) / 12), q = Math.min(1, (b.f1 - f) / 12); B.style.opacity = String(Math.min(p, q)); $('brb_cd').style.display = 'block'; const jb = (TL.jumps || []).filter(j => j.f <= f && j.f >= b.f0).reduce((a, j) => a + j.add, 0); const left = b.secs ? Math.max(0, b.secs - (f - b.f0) / fps - jb) : (f - b.f0) / fps + jb; $('brb_cd').textContent = (b.secs ? '' : STR('brb_elapsed') + ' ') + `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(Math.floor(left % 60)).padStart(2, '0')}`; }
  else B.style.display = 'none';
  // Live2D
  setParams(mainCur, TL.main.p, f);
  if (TL.main.sc) mainM.scale.set(mainM._ms * TL.main.sc[f]);
  mainM.y = mainM._baseY + TL.main.dy[f]; mainM.x = L.main.cx - mainM.width / 2 + TL.main.dx[f];
  mainM.alpha = TL.main.a ? TL.main.a[f] : 1; mainM.visible = TL.main.dy[f] < 700 && mainM.alpha > 0.01;
  mainM.update(1000 / fps);
  const sx = TL.sis.px[f];
  const vis = sx < 600;
  sisBox.visible = vis;
  const SH = $('sisshadow'); SH.style.display = vis ? 'block' : 'none';
  if (vis) {
    setParams(sisCur, TL.sis.p, f);
    const sc = TL.sis.sc ? TL.sis.sc[f] : 1; sisM.scale.set(sisM._ss * sc);
    sisM.x = -sisM._w0 * sc / 2; sisM.y = -L.sis.neck * sc + (TL.sis.sy ? TL.sis.sy[f] : 0);
    sisBox.x = L.sis.cx + sx + (TL.sis.mx ? TL.sis.mx[f] : 0); sisBox.y = L.sis.neckY; sisBox.rotation = TL.sis.rot ? TL.sis.rot[f] : 0;
    sisM.update(1000 / fps);
    // her shadow on the wall beside the lamp (the lamp is on her right, so it falls to her left)
    SH.style.left = (sisBox.x - 360) + 'px'; SH.style.top = (L.sis.neckY - 420) + 'px';
  }
  app.renderer.render(app.stage);
};
// warm-up seek: replay ops and step physics without rendering screenshots
window.seek = function (f0, warm) {
  for (let f = Math.max(0, f0 - warm); f < f0; f++) window.renderFrame(f);
};
function easeOutBack(x) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
