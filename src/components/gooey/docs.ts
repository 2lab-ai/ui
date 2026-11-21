import type { ComponentDoc } from '../../docs/types';
import { icon } from '../../icons/icons';
import './gooey';
import { GOOEY_SHADOW, type GooeyData, type UiGooey } from './gooey';
import type { GooeyItemData, UiGooeyItem } from './item';

/** Light-DOM styles for the demos (the host's own CSS: the library only draws the liquid). */
const DEMO_CSS = `
.gd-wrap { display: grid; place-items: center; min-height: 100%; padding: 12px; }
.gd-note { margin: 10px 0 0; font-size: 12px; line-height: 1.45; color: var(--ui-text-tertiary); text-align: center; }
.gd-pm { width: 200px; height: 140px; }
.gd-pm ui-gooey-item { position: absolute; left: 80px; top: 80px; }
.gd-btn { width: 40px; height: 40px; border: 0; padding: 0; border-radius: 50%; background: transparent;
  display: grid; place-items: center; cursor: pointer; color: var(--ui-surface); -webkit-tap-highlight-color: transparent; }
.gd-btn:focus-visible { outline: 2px solid var(--ui-border-focus); outline-offset: 2px; }
.gd-sat { pointer-events: none; }
.gd-pm.is-open .gd-sat { pointer-events: auto; }
.gd-sat > span { display: grid; place-items: center; opacity: 0; filter: blur(2px); transition: opacity 120ms ease, filter 120ms ease; }
.gd-pm.is-open .gd-sat > span { opacity: 1; filter: blur(0); transition-duration: 180ms; }
.gd-plus { display: grid; place-items: center; transition: transform 250ms ease-in-out; }
.gd-pm.is-open .gd-plus { transform: rotate(45deg); }
.gd-sl { width: 240px; height: 80px; }
.gd-track { position: absolute; left: 14px; right: 14px; top: 38px; height: 8px; border-radius: 4px; z-index: -2;
  background: color-mix(in srgb, var(--ui-text-tertiary) 22%, transparent); }
.gd-thumb { position: absolute; left: 14px; top: 30px; width: 24px; height: 24px; border-radius: 50%; cursor: grab;
  touch-action: none; user-select: none; -webkit-user-select: none; }
.gd-thumb:active { cursor: grabbing; }
.gd-thumb:focus-visible { outline: 2px solid var(--ui-border-focus); outline-offset: 4px; }
.gd-readout { font-size: 12.5px; color: var(--ui-text-secondary); font-variant-numeric: tabular-nums; text-align: center; }
.gd-dgc { width: 100%; max-width: 560px; height: 210px; }
.gd-card { position: absolute; left: 50%; top: 50%; width: 261px; height: 46px; margin: -23px 0 0 -130.5px;
  border-radius: 54px; display: flex; align-items: center; gap: 8px; padding: 0 16px 0 8px; color: var(--ui-surface);
  cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; --gd-cb: 0.3; }
.gd-card:active { cursor: grabbing; }
.gd-chip { flex: none; width: 32px; height: 32px; border-radius: 40px; display: grid; place-items: center;
  background: color-mix(in srgb, var(--ui-surface) 10%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ui-surface) 14%, transparent); }
.gd-title { font-size: 13px; font-weight: 500; white-space: nowrap; }
.gd-count { font-size: 13px; opacity: 0.6; white-space: nowrap; margin-left: auto; }
.gd-card > * {
  --gd-k: calc(var(--gd-cb, 0) * var(--gd-arc, 1));
  transform: translate(calc(var(--lg-bend-x, 0px) * var(--gd-k) * 2.4), calc(var(--lg-bend-y, 0px) * var(--gd-k) * 2.4))
    rotate(calc(var(--lg-bend-yn, 0) * var(--gd-rot, 0) * var(--gd-cb, 0) * 1deg))
    skewX(calc(var(--lg-bend-xn, 0) * var(--gd-cb, 0) * -0.55deg));
}
.gd-card > :nth-child(1) { --gd-arc: 0.45; --gd-rot: 1.6; }
.gd-card > :nth-child(2) { --gd-arc: 1; --gd-rot: 0; }
.gd-card > :nth-child(3) { --gd-arc: 0.6; --gd-rot: -1.6; }
.gd-mp { width: min(100%, 420px); height: 200px; }
.gd-photo { position: absolute; width: 84px; height: 84px; border-radius: 16px; overflow: hidden; cursor: grab;
  touch-action: none; user-select: none; -webkit-user-select: none; }
.gd-photo img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
.gd-isl { width: 320px; height: 200px; }
.gd-island { position: absolute; left: 50%; top: 24px; transform: translateX(-50%); width: 168px; height: 36px;
  border-radius: 18px; display: flex; align-items: center; gap: 8px; padding: 0 14px; color: var(--ui-surface);
  font-size: 12.5px; overflow: hidden; border: 0; background: transparent; text-align: left; cursor: pointer;
  transition: width 420ms cubic-bezier(0.3, 1.05, 0.4, 1), height 420ms cubic-bezier(0.3, 1.05, 0.4, 1),
    border-radius 420ms cubic-bezier(0.3, 1.05, 0.4, 1); }
.gd-island:focus-visible { outline: 2px solid var(--ui-border-focus); outline-offset: 3px; }
.gd-island.is-open { width: 288px; height: 132px; border-radius: 22px; align-items: flex-start; padding-top: 12px; }
.gd-island .gd-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--ui-st-run); }
.gd-island .gd-body { display: grid; gap: 6px; min-width: 0; }
.gd-island .gd-more { opacity: 0; transition: opacity 200ms ease; line-height: 1.45;
  color: color-mix(in srgb, var(--ui-surface) 72%, transparent); }
.gd-island.is-open .gd-more { opacity: 1; transition-delay: 160ms; }
@media (prefers-reduced-motion: reduce) { .gd-sat > span, .gd-plus, .gd-island, .gd-island .gd-more { transition: none !important; } }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

function gooey(data: GooeyData, className: string): UiGooey {
  const g = document.createElement('ui-gooey');
  g.className = className;
  g.data = data;
  return g;
}

function item(data: GooeyItemData, child: HTMLElement): UiGooeyItem {
  const i = document.createElement('ui-gooey-item');
  i.data = data;
  i.append(child);
  return i;
}

/** The demo's frame: its own styles, the group, a caption. */
function stage(group: HTMLElement, note: string, ...extra: HTMLElement[]): HTMLElement {
  const wrap = el('div', 'gd-wrap');
  const style = el('style');
  style.textContent = DEMO_CSS;
  const col = el('div');
  col.style.cssText = 'display:grid;justify-items:center;gap:6px;width:100%';
  col.append(group, ...extra, el('p', 'gd-note', note));
  wrap.append(style, col);
  return wrap;
}

/** Inverse ink: the liquid is the text colour, its content the surface colour — a dark goo on light, light on dark. */
const INK = 'var(--text)';

/** Morph: the plus menu that splits into three droplets (liquid-gooey's PlusMenu, its geometry and timings). */
function plusMenu(): HTMLElement {
  const g = gooey({ fill: INK, shadow: GOOEY_SHADOW }, 'gd-pm');
  const sats = [
    { label: 'New session', x: -54, y: -34, glyph: 'chat' },
    { label: 'Attach file', x: 0, y: -64, glyph: 'attach' },
    { label: 'Schedule a run', x: 54, y: -34, glyph: 'clock' },
  ];
  let open = false;
  const items: UiGooeyItem[] = [];
  const buttons: HTMLButtonElement[] = [];
  const main = el('button', 'gd-btn');
  main.type = 'button';
  main.setAttribute('aria-expanded', 'false');
  main.setAttribute('aria-label', 'Open menu');
  main.innerHTML = `<span class="gd-plus">${icon('plus', { size: 20 })}</span>`;
  const set = (next: boolean) => {
    open = next;
    g.classList.toggle('is-open', open);
    main.setAttribute('aria-expanded', String(open));
    main.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    sats.forEach((s, i) => {
      // Opens on a bouncy curve with a 40ms stagger, closes faster on a snappy one.
      const t = open
        ? { duration: 550, ease: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
        : { duration: 250, ease: 'cubic-bezier(0.22, 1, 0.36, 1)' };
      items[i].data = { x: open ? s.x : 0, y: open ? s.y : 0, transition: t, delay: open ? i * 40 : 0 };
      buttons[i].tabIndex = open ? 0 : -1;
      const span = buttons[i].firstElementChild as HTMLElement;
      span.style.transitionDelay = open ? `${120 + i * 40}ms` : '0ms';
    });
  };
  sats.forEach((s) => {
    const b = el('button', 'gd-btn gd-sat');
    b.type = 'button';
    b.tabIndex = -1;
    b.setAttribute('aria-label', s.label);
    b.innerHTML = `<span>${icon(s.glyph, { size: 16 })}</span>`;
    b.addEventListener('click', () => set(false));
    buttons.push(b);
    const it = item({ x: 0, y: 0 }, b);
    items.push(it);
    g.append(it);
  });
  main.addEventListener('click', () => set(!open));
  g.append(item({}, main));
  return stage(g, 'Press + — three droplets split off and merge back. The buttons stay real buttons.');
}

/** Move: the liquid slider (liquid-gooey's Slider): the thumb is yours, the liquid trails it with a droplet tail. */
function slider(): HTMLElement {
  const MAX = 188;
  let x = 112;
  const g = gooey({ fill: 'color-mix(in srgb, var(--text) 78%, var(--surface))', shadow: GOOEY_SHADOW }, 'gd-sl');
  const track = el('div', 'gd-track');
  track.setAttribute('aria-hidden', 'true');
  const thumb = el('div', 'gd-thumb');
  thumb.tabIndex = 0;
  thumb.setAttribute('role', 'slider');
  thumb.setAttribute('aria-label', 'Reasoning effort');
  thumb.setAttribute('aria-valuemin', '0');
  thumb.setAttribute('aria-valuemax', '100');
  const readout = el('div', 'gd-readout');
  const paint = () => {
    const v = Math.round((x / MAX) * 100);
    thumb.style.transform = `translateX(${x}px)`;
    thumb.setAttribute('aria-valuenow', String(v));
    readout.textContent = `Reasoning effort · ${v}%`;
  };
  let grab: number | null = null;
  thumb.addEventListener('pointerdown', (e) => {
    try {
      thumb.setPointerCapture(e.pointerId);
    } catch {
      // A synthetic event has no active pointer.
    }
    grab = e.clientX - x;
  });
  thumb.addEventListener('pointermove', (e) => {
    if (grab === null) return;
    x = Math.min(MAX, Math.max(0, e.clientX - grab));
    paint();
  });
  const end = () => {
    grab = null;
  };
  thumb.addEventListener('pointerup', end);
  thumb.addEventListener('pointercancel', end);
  thumb.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 47 : 18.8;
    const to =
      e.key === 'ArrowRight' || e.key === 'ArrowUp'
        ? x + step
        : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
          ? x - step
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? MAX
              : null;
    if (to === null) return;
    e.preventDefault();
    x = Math.min(MAX, Math.max(0, to));
    paint();
  });
  paint();
  g.append(track, item({ effect: 'move', move: { springiness: 0.5, wobble: 0.5, stretch: 0.6, trail: 0.35 } }, thumb));
  return stage(
    g,
    'Drag the thumb, or use the arrow keys: the liquid lags it like rubber, with a droplet tail.',
    readout,
  );
}

/** Bend: the drag card (liquid-gooey's DragCard): the body bows with velocity, the content leans with it. */
function dragCard(): HTMLElement {
  const g = gooey({ fill: INK, shadow: GOOEY_SHADOW }, 'gd-dgc');
  const card = el('div', 'gd-card');
  card.innerHTML =
    `<span class="gd-chip" aria-hidden="true">${icon('bot', { size: 16 })}</span>` +
    '<span class="gd-title">deploy-agent</span><span class="gd-count">12 runs</span>';
  let pos = { x: 0, y: 0 };
  let grab: { id: number; dx: number; dy: number } | null = null;
  const place = (release: boolean) => {
    card.style.transition = release ? 'transform 400ms cubic-bezier(0.34, 1.40, 0.64, 1)' : 'none';
    card.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
  };
  card.addEventListener('pointerdown', (e) => {
    try {
      card.setPointerCapture(e.pointerId);
    } catch {
      // A synthetic event has no active pointer.
    }
    grab = { id: e.pointerId, dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  });
  card.addEventListener('pointermove', (e) => {
    if (!grab || e.pointerId !== grab.id) return;
    const gr = g.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    const lx = Math.max(0, (gr.width - cr.width) / 2);
    const ly = Math.max(0, (gr.height - cr.height) / 2);
    pos = {
      x: Math.max(-lx, Math.min(lx, e.clientX - grab.dx)),
      y: Math.max(-ly, Math.min(ly, e.clientY - grab.dy)),
    };
    place(false);
  });
  const end = () => {
    if (!grab) return;
    grab = null;
    // Release: the card flies home on an overshooting curve and lands with a bounce.
    pos = { x: 0, y: 0 };
    place(true);
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
  g.append(item({ effect: 'bend', bend: { vertical: 0.6, horizontal: 0.35 } }, card));
  return stage(g, 'Drag the card around and let go: its body bows with the speed, the words lean along.');
}

/** A picture drawn on a canvas (no network): two soft colour fields and a horizon. */
function picture(a: string, b: string, c: string): string {
  if (typeof document === 'undefined') return '';
  const cv = document.createElement('canvas');
  cv.width = 168;
  cv.height = 168;
  const x = cv.getContext?.('2d');
  if (!x) return '';
  const g = x.createLinearGradient(0, 0, 168, 168);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  x.fillStyle = g;
  x.fillRect(0, 0, 168, 168);
  x.fillStyle = c;
  x.beginPath();
  x.arc(118, 56, 26, 0, Math.PI * 2);
  x.fill();
  x.globalAlpha = 0.55;
  x.fillStyle = b;
  x.beginPath();
  x.moveTo(0, 120);
  x.quadraticCurveTo(60, 92, 168, 128);
  x.lineTo(168, 168);
  x.lineTo(0, 168);
  x.fill();
  try {
    return cv.toDataURL('image/png');
  } catch {
    return '';
  }
}

/** Melt: two photos running molten into each other where they touch (liquid-gooey's MeltPair). */
function melt(): HTMLElement {
  const g = gooey({}, 'gd-mp');
  const pics = [picture('#ff7a59', '#7b2ff7', '#ffd166'), picture('#00b4d8', '#0b3d91', '#caf0f8')];
  const pos = [
    { x: 116, y: 58 },
    { x: 220, y: 58 },
  ];
  pics.forEach((src, i) => {
    const card = el('div', 'gd-photo');
    const img = el('img');
    img.alt = i ? 'Blue dusk' : 'Orange dusk';
    img.draggable = false;
    if (src) img.src = src;
    card.append(img);
    const p = pos[i];
    card.style.left = `${p.x}px`;
    card.style.top = `${p.y}px`;
    let grab: { id: number; dx: number; dy: number } | null = null;
    card.addEventListener('pointerdown', (e) => {
      grab = { id: e.pointerId, dx: e.clientX - p.x, dy: e.clientY - p.y };
      try {
        card.setPointerCapture(e.pointerId);
      } catch {
        // A synthetic event has no active pointer.
      }
    });
    card.addEventListener('pointermove', (e) => {
      if (!grab || e.pointerId !== grab.id) return;
      const box = g.getBoundingClientRect();
      p.x = Math.max(0, Math.min(box.width - 84, e.clientX - grab.dx));
      p.y = Math.max(0, Math.min(box.height - 84, e.clientY - grab.dy));
      card.style.left = `${p.x}px`;
      card.style.top = `${p.y}px`;
    });
    const end = () => {
      grab = null;
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
    g.append(item({ effect: 'melt' }, card));
  });
  return stage(g, 'Drag one photo into the other: their colours average through the goo and marble at the seam.');
}

/** Morph with `shape`: an agent pill that opens into a card — the liquid travels as a droplet, then settles. */
function island(): HTMLElement {
  const g = gooey({ fill: INK, shadow: GOOEY_SHADOW }, 'gd-isl');
  const pill = el('button', 'gd-island');
  pill.type = 'button';
  pill.setAttribute('aria-expanded', 'false');
  pill.innerHTML =
    '<span class="gd-dot" aria-hidden="true"></span><span class="gd-body"><span>Agent is working…</span>' +
    '<span class="gd-more">Reading 14 files in src/runs. Next: update the retry policy, then run the tests.</span></span>';
  pill.addEventListener('click', () => {
    const open = !pill.classList.contains('is-open');
    pill.classList.toggle('is-open', open);
    pill.setAttribute('aria-expanded', String(open));
  });
  g.append(item({ morph: { shape: true } }, pill));
  return stage(g, 'Press the pill: the liquid flows toward the new shape first, then size and corners settle.');
}

export const doc: ComponentDoc = {
  slug: 'gooey',
  name: 'Gooey',
  tag: 'ui-gooey',
  summary:
    'Did these pieces come from one another? — pieces that merge like goo where they touch and change shape like jelly, while their text, icons and photos stay crisp.',
  description:
    'A liquid group. Wrap each piece of your own markup in a `<ui-gooey-item>` inside a `<ui-gooey>`: the group draws one blob per item on an SVG silhouette layer behind the content, runs a blur → alpha-contrast filter over it so touching blobs bridge and merge, and rebuilds the shadow on the MERGED shape. Your elements ride on top, never filtered — text stays sharp, focus rings, hit targets, ARIA and handlers stay yours. Four effects, with liquid-gooey’s knobs one to one: morph (the default — merging, and with `morph.shape` a jelly shape change; with `dissolve`, imagery melts into a touching neighbour), move (the liquid trails your moving element as rubber with a droplet tail), bend (the body bows with velocity and publishes `--lg-bend-*` so the content can lean) and melt (two photos running molten into each other). Component-driven items take `x` / `y` / `scale` and move with their liquid on one clock; observed items follow whatever moves their child. The measuring loop sleeps when nothing moves and stops off screen.',
  usedIn:
    'Not yet in the dashboard — the natural spot is the agent island (a working pill that opens into a card with `morph.shape`) and the composer’s “+” attachments menu.',
  reference: { name: 'Libraries.dev — Liquid Gooey (liquid-gooey)', url: 'https://libraries.dev/gooey' },
  group: 'Effects',
  props: [
    {
      name: 'blur',
      type: 'attribute / data.blur: number (px)',
      default: '6',
      description:
        'Goo blur sigma, 0 … 40. Bridging is a ratio of blur to gap: neighbours merge once blur ≳ the gap between them.',
    },
    {
      name: 'contrast',
      type: 'attribute / data.contrast: number',
      default: '18',
      description: 'Alpha-contrast slope, 1 … 100. Larger = a sharper liquid edge.',
    },
    {
      name: 'fill',
      type: 'attribute / data.fill: CSS colour',
      default: 'var(--surface)',
      description:
        'The liquid surface. Any CSS colour; `var(--text)`, `var(--surface-raised)` and `color-mix()` follow the theme.',
    },
    {
      name: 'shadow',
      type: 'attribute / data.shadow: box-shadow syntax',
      description:
        'Rendered on the MERGED silhouette, multi-layer; `inset` layers paint inside the liquid edge. Blurred outer layers run as CSS drop-shadow() on the compositor. `GOOEY_SHADOW` is a token-built elevation for light and dark.',
    },
    {
      name: 'waviness / waviness-freq',
      type: 'attribute / data.waviness, data.wavinessFreq: number',
      default: '0 / 0.018',
      description: 'Max px the liquid edge undulates (0 … 40) and its noise frequency — fluid instead of geometric.',
    },
    {
      name: 'filter-padding',
      type: 'attribute / data.filterPadding: number (px)',
      default: '24',
      description:
        'Extra filter-region slack if blobs travel outside the group’s box. Size the group to contain its items’ travel.',
    },
    {
      name: 'data.filter',
      type: 'string (SVG filter primitives)',
      description:
        'Escape hatch: raw primitives that REPLACE the goo chain. Sanitized: only fe* elements, no on* / style / outside href.',
    },
    {
      name: 'motion',
      type: '"system" | "reduce" | "full"',
      default: '"system"',
      description:
        'Reduced motion: component-driven moves snap, observed items mirror their element 1:1 (no lag, tail, bend or droplet travel), the dissolve does not churn.',
    },
    {
      name: '<ui-gooey-item> effect',
      type: 'attribute / data.effect: "morph" | "move" | "bend" | "melt"',
      default: '"morph"',
      description:
        'How this piece’s surface behaves. move / bend / melt follow the item’s first element child, which your code moves.',
    },
    {
      name: '<ui-gooey-item> x / y / scale / transition / delay',
      type: 'attribute or data: number · "snappy" | "smooth" | "bouncy" | { stiffness, damping, mass } | { duration, ease } · ms',
      default: '0 / 0 / 1 / "smooth" / 0',
      description:
        'Component-driven position: the item element and its liquid move on one JS clock along the spring curve (compiled to linear()), so they can never tear apart.',
    },
    {
      name: '<ui-gooey-item> data.morph',
      type: '{ shape?, speed?, bounce?, contentBlur?, advanced?: { evolve?, blobInset?, bridgeGrow? } }',
      description:
        '`shape: true` turns on the jelly shape change: the mass leads, size follows, corners settle last; the content cross-blurs up to `contentBlur` px while it moves.',
    },
    {
      name: '<ui-gooey-item> data.move / data.bend',
      type: '{ springiness, wobble, stretch, trail, advanced? } / { vertical, horizontal, advanced? }',
      default: '0.5 / 0.5 / 0.36 / 0.575 · 0.6 / 0.35',
      description:
        'All 0 … 1. Bend publishes --lg-bend-x / -y (px) and --lg-bend-xn / -yn (unitless) on the child for the content to lean with.',
    },
    {
      name: '<ui-gooey-item> dissolve',
      type: 'attribute (number) / data.dissolve: true | 0 … 1 | DissolveOptions',
      description:
        'Morph items: imagery melts into a touching neighbour at the contact point (a turbulence warp, not a blur). Wire `active` to your drag. Ignored with move.',
    },
    {
      name: '<ui-gooey-item> data.melt',
      type: '{ src?, blur, contrast, reach, fade, warp, mix, mixBlur, gravity, waviness }',
      description:
        'effect="melt": the first two melt items of a group form the pair. The source is the child’s first <img> (or `src`: http(s), relative, blob: or a base64 raster).',
    },
    {
      name: '<ui-gooey-item> observe / radius',
      type: 'boolean attribute / number | [tl, tr, br, bl]',
      description:
        'observe: plain-merge items animated by your code follow the child’s rect. radius: override the measured border-radius.',
    },
    {
      name: 'options / running / engine / wake()',
      type: 'GooeyOptions / boolean / GooeyEngine | null / method',
      description:
        'What it draws with now (clamped), whether a loop is scheduled, the engine (raw escape hatch), and a manual wake after WAAPI moves.',
    },
    {
      name: 'gooFilterMarkup · gooeySplitShadows · gooeyParseShadow · sanitizeGooeyFilter · gooeyResolveTransition · gooeyEasing · gooeyMapMove · gooeyMapBend · gooeyMapMorphSprings · gooeyMapDissolve · gooeyMeltPairMarkup · gooeyRoundedRectPath · gooeyItemPlan',
      type: 'helpers',
      description:
        'Pure: the filter chain, the GPU / svg shadow split, the box-shadow parser, the spring compiler and easing evaluator, the knob mappings, the melt svg, the blob path and an item’s plan.',
    },
  ],
  events: [],
  keyboard: [
    [
      'Your own keys',
      'The items wrap your elements, so their keyboard is yours (the demos: Enter / Space on the buttons, arrows / Home / End on the slider).',
    ],
  ],
  a11y: [
    'Decorative: both svg layers are aria-hidden, focusable="false" and take no pointer. The group adds no role and no words — the content is the host’s real DOM, with its own roles, names, focus rings and handlers, never filtered.',
    'Text and icons stay crisp: only the silhouette behind them runs through the goo filter. (morph.shape cross-blurs the content for a moment while it moves; contentBlur: 0 turns that off.)',
    'Reduced motion (prefers-reduced-motion, or motion="reduce"): component-driven moves snap to place, observed items mirror their element without lag, tail, bend or droplet travel, and the dissolve stays still.',
    'No idle CPU: the measuring loop runs only while something moves and sleeps after ~0.5s of stillness; it and its 300ms safety check stop off screen and in a hidden tab.',
    'An effect="melt" card is painted by the melt layer (the element itself is transparent but stays in place): give its <img> an alt, as the demo does.',
  ],
  usage: `<ui-gooey class="menu" fill="var(--ui-text)">
  <ui-gooey-item class="slot" transition="bouncy"><button aria-label="New session">…</button></ui-gooey-item>
  <ui-gooey-item class="slot"><button aria-label="Open menu" aria-expanded="false">+</button></ui-gooey-item>
</ui-gooey>
<script type="module">
  import '@2lab.ai/ui/gooey';
  const [sat] = document.querySelectorAll('ui-gooey-item');
  // Component-driven: the item and its liquid move together; touching blobs merge.
  openButton.onclick = () => { sat.data = { x: open ? -54 : 0, y: open ? -34 : 0, transition: 'bouncy' }; };
</script>

<!-- Move: you move the thumb, the liquid trails it -->
<ui-gooey>
  <ui-gooey-item effect="move"><div class="thumb" role="slider" style="transform: translateX(84px)"></div></ui-gooey-item>
</ui-gooey>`,
  demos: [
    { id: 'plus-menu', title: 'Morph — a menu that splits like droplets', height: 300, create: plusMenu },
    { id: 'slider', title: 'Move — a liquid slider', height: 260, create: slider },
    { id: 'drag-card', title: 'Bend — a card that bows as you drag it', height: 320, create: dragCard },
    { id: 'shape', title: 'Morph shape — an agent pill that opens into a card', height: 320, create: island },
    { id: 'melt', title: 'Melt — two photos running molten into each other', height: 320, create: melt },
  ],
};
