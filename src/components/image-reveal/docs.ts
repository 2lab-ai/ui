import type { ComponentDoc } from '../../docs/types';
import './image-reveal';
import type { ImageRevealData, ImageRevealPhaseDetail, UiImageReveal } from './image-reveal';

/*
 * Offline "generated images" for the demos: SVG scenes drawn here, handed to the element as blob: URLs (safeSrc takes
 * http(s), relative, blob: and raster data:image — not SVG data URIs). The colours are picture content, not UI.
 */
const urls = new Map<string, string>();
function blobUrl(key: string, body: string, type: string): string {
  let url = urls.get(key);
  if (url === undefined) {
    try {
      url = URL.createObjectURL(new Blob([body], { type }));
    } catch {
      url = '';
    }
    urls.set(key, url);
  }
  return url;
}

const svg = (w: number, h: number, defs: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;
const lin = (id: string, stops: Array<[number, string]>, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const rad = (id: string, stops: Array<[number, string]>) =>
  `<radialGradient id="${id}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</radialGradient>`;

/** "A lighthouse on a cliff at dusk, a beam across the water." */
function lighthouse(): string {
  const defs =
    lin('sky', [
      [0, '#2b1d4f'],
      [0.45, '#8a3f6d'],
      [0.75, '#f08a5d'],
      [1, '#ffd29a'],
    ]) +
    lin('sea', [
      [0, '#3c2f5c'],
      [1, '#120f24'],
    ]) +
    lin(
      'beam',
      [
        [0, 'rgba(255,240,200,0.75)'],
        [1, 'rgba(255,240,200,0)'],
      ],
      1,
      0,
    ) +
    rad('sun', [
      [0, 'rgba(255,214,150,0.95)'],
      [1, 'rgba(255,214,150,0)'],
    ]);
  let body = `<rect width="768" height="768" fill="url(#sky)"/><circle cx="520" cy="470" r="190" fill="url(#sun)"/>`;
  body += `<rect y="470" width="768" height="298" fill="url(#sea)"/>`;
  for (let i = 0; i < 9; i++) {
    const y = 488 + i * 30;
    body += `<rect x="${380 + i * 14}" y="${y}" width="${260 - i * 22}" height="3" rx="1.5" fill="rgba(255,200,150,${0.5 - i * 0.05})"/>`;
  }
  body += `<path d="M0 420 L120 380 L230 400 L300 470 L320 768 L0 768 Z" fill="#160f22"/>`;
  body += `<polygon points="172,232 206,232 214,392 164,392" fill="#efe6dc"/>`;
  body += `<rect x="168" y="270" width="42" height="18" fill="#b8423a"/><rect x="166" y="330" width="46" height="18" fill="#b8423a"/>`;
  body += `<rect x="174" y="206" width="30" height="26" fill="#2a2235"/><rect x="179" y="211" width="20" height="16" fill="#ffe8a8"/>`;
  body += `<polygon points="169,206 189,184 209,206" fill="#2a2235"/>`;
  body += `<polygon points="200,214 768,120 768,320" fill="url(#beam)"/>`;
  return svg(768, 768, defs, body);
}

/** "Still mountain lake at sunrise, mist between the ridges." */
function lake(): string {
  const defs =
    lin('sky2', [
      [0, '#9cc7e8'],
      [0.6, '#f6d7c3'],
      [1, '#fbe9d7'],
    ]) +
    lin('water', [
      [0, '#a9c9dc'],
      [1, '#47708c'],
    ]) +
    rad('sun2', [
      [0, 'rgba(255,248,226,1)'],
      [1, 'rgba(255,248,226,0)'],
    ]);
  let body = `<rect width="1024" height="576" fill="url(#sky2)"/><circle cx="700" cy="250" r="140" fill="url(#sun2)"/>`;
  body += `<path d="M0 330 L150 190 L260 280 L400 140 L560 300 L700 210 L860 320 L1024 230 L1024 380 L0 380 Z" fill="#7d95b5"/>`;
  body += `<path d="M0 360 L120 290 L300 350 L470 260 L640 350 L820 290 L1024 340 L1024 390 L0 390 Z" fill="#56708f"/>`;
  body += `<rect y="300" width="1024" height="60" fill="rgba(255,255,255,0.28)"/>`;
  body += `<rect y="384" width="1024" height="192" fill="url(#water)"/>`;
  body += `<path d="M0 392 L120 446 L300 400 L470 470 L640 400 L820 446 L1024 404 L1024 384 L0 384 Z" fill="rgba(86,112,143,0.55)"/>`;
  for (let i = 0; i < 7; i++) {
    body += `<rect x="${560 + i * 9}" y="${420 + i * 20}" width="${280 - i * 30}" height="2.5" fill="rgba(255,250,235,${0.6 - i * 0.07})"/>`;
  }
  body += `<path d="M60 576 L60 470 L48 470 L70 420 L92 470 L80 470 L80 576 Z" fill="#26384a"/>`;
  return svg(1024, 576, defs, body);
}

/** "A ceramic mug on a wooden desk, soft window light, product photo." */
function mug(): string {
  const defs =
    lin('wall', [
      [0, '#e9e4dc'],
      [1, '#d6cfc4'],
    ]) +
    lin('desk', [
      [0, '#b07c4f'],
      [1, '#7a5233'],
    ]) +
    lin(
      'cup',
      [
        [0, '#2f5d62'],
        [0.55, '#3f7f84'],
        [1, '#24474b'],
      ],
      1,
      0,
    ) +
    rad('light', [
      [0, 'rgba(255,252,240,0.9)'],
      [1, 'rgba(255,252,240,0)'],
    ]);
  let body = `<rect width="768" height="768" fill="url(#wall)"/><circle cx="560" cy="180" r="320" fill="url(#light)"/>`;
  body += `<rect y="520" width="768" height="248" fill="url(#desk)"/>`;
  for (let i = 0; i < 6; i++) body += `<rect y="${548 + i * 38}" width="768" height="2" fill="rgba(60,35,20,0.18)"/>`;
  body += `<ellipse cx="384" cy="604" rx="170" ry="26" fill="rgba(40,25,15,0.35)"/>`;
  body += `<path d="M254 380 L514 380 L500 590 Q384 622 268 590 Z" fill="url(#cup)"/>`;
  body += `<ellipse cx="384" cy="380" rx="130" ry="26" fill="#1d3a3d"/><ellipse cx="384" cy="384" rx="116" ry="20" fill="#4a2f22"/>`;
  body += `<path d="M512 420 Q600 420 596 488 Q590 552 500 552" fill="none" stroke="#2f5d62" stroke-width="22"/>`;
  body += `<path d="M330 330 Q312 290 340 252 Q366 214 344 176" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="6" stroke-linecap="round"/>`;
  body += `<path d="M412 336 Q392 296 420 262" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="5" stroke-linecap="round"/>`;
  return svg(768, 768, defs, body);
}

/** "Isometric city block at night, neon signs." */
function city(): string {
  const defs = lin('night', [
    [0, '#0b1026'],
    [1, '#26204a'],
  ]);
  let body = `<rect width="768" height="768" fill="url(#night)"/>`;
  const towers: Array<[number, number, number, string]> = [
    [40, 300, 120, '#1b2346'],
    [170, 210, 110, '#232c58'],
    [290, 330, 140, '#1a2142'],
    [440, 170, 120, '#2a2f60'],
    [570, 280, 160, '#1d2550'],
  ];
  for (const [x, y, w, c] of towers) {
    body += `<rect x="${x}" y="${y}" width="${w}" height="${768 - y}" fill="${c}"/>`;
    for (let r = y + 24; r < 700; r += 34) {
      for (let k = x + 14; k < x + w - 14; k += 26) {
        const lit = (r * 7 + k * 3) % 5 < 2;
        body += `<rect x="${k}" y="${r}" width="12" height="16" fill="${lit ? '#ffd27a' : '#323a6e'}"/>`;
      }
    }
  }
  body += `<rect x="300" y="390" width="120" height="34" rx="6" fill="#ff4fa3"/><rect x="452" y="250" width="96" height="28" rx="6" fill="#36e0d0"/>`;
  body += `<rect y="700" width="768" height="68" fill="#090c1c"/>`;
  return svg(768, 768, defs, body);
}

const SCENES = {
  lighthouse: { make: lighthouse, prompt: 'A lighthouse on a cliff at dusk, a beam across the water' },
  lake: { make: lake, prompt: 'Still mountain lake at sunrise, mist between the ridges' },
  mug: { make: mug, prompt: 'A ceramic mug on a wooden desk, soft window light' },
  city: { make: city, prompt: 'A city block at night, neon signs' },
};
type Scene = keyof typeof SCENES;

const picture = (scene: Scene) => blobUrl(scene, SCENES[scene].make(), 'image/svg+xml');
/** A blob that is not an image: the element shows "No preview". */
const broken = () => blobUrl('broken', 'not an image', 'image/png');

function reveal(data: ImageRevealData = {}, attrs: Record<string, string> = {}, style = ''): UiImageReveal {
  const el = document.createElement('ui-image-reveal');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (style) el.style.cssText = style;
  el.data = data;
  return el;
}

/** Run `fn` after `ms`, unless the demo has been taken off the page by then. */
function later(el: Element, ms: number, fn: () => void): void {
  setTimeout(() => {
    if (el.isConnected) fn();
  }, ms);
}

function caption(text: string, lang = ''): HTMLElement {
  const p = document.createElement('p');
  p.style.cssText = 'margin:8px 0 0;font-size:12px;line-height:1.45;color:var(--ui-ib-muted);text-align:center';
  if (lang) p.lang = lang;
  p.textContent = text;
  return p;
}

function figure(el: HTMLElement, text: string, lang = '', basis = '180px'): HTMLElement {
  const f = document.createElement('div');
  f.style.cssText = `flex:1 1 ${basis};min-width:0;max-width:280px`;
  f.append(el, caption(text, lang));
  return f;
}

function row(...kids: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-wrap:wrap;gap:16px;justify-content:center;width:100%';
  box.append(...kids);
  return box;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.style.cssText =
    'font:inherit;font-size:12.5px;padding:6px 12px;border-radius:999px;border:1px solid var(--ui-border);background:var(--ui-surface);color:var(--ui-text);cursor:pointer';
  b.addEventListener('click', onClick);
  return b;
}

/**
 * The tool-call card: a prompt, the loader while the model works (progress in the status), the picture when it
 * arrives — and Regenerate, which churns the picture back into the mosaic until the next one dissolves in.
 */
function generation(): HTMLElement {
  const order: Scene[] = ['lighthouse', 'mug', 'city'];
  let at = 0;
  const card = document.createElement('div');
  card.style.cssText =
    'width:min(100%,320px);display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:16px;background:var(--ui-surface);border:1px solid var(--ui-border)';
  const prompt = document.createElement('p');
  prompt.style.cssText = 'margin:0;font-size:13px;line-height:1.45;color:var(--ui-text)';
  const el = reveal({ state: 'loading', progress: 0 });
  const status = document.createElement('p');
  status.style.cssText = 'margin:0;font-size:12px;color:var(--ui-text-secondary);font-variant-numeric:tabular-nums';
  el.addEventListener('ui-phase-change', (e) => {
    status.textContent = `phase: ${(e as CustomEvent<ImageRevealPhaseDetail>).detail.phase}`;
  });
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  let run = 0;
  /** The model "works" for ~2.4 s, reporting progress, then the picture arrives. */
  const generate = (regen: boolean) => {
    const scene = order[at % order.length];
    at++;
    const mine = ++run;
    prompt.textContent = `“${SCENES[scene].prompt}”`;
    if (regen) el.regenerate();
    else el.data = { state: 'loading', progress: 0 };
    for (let i = 1; i <= 4; i++) {
      later(el, i * 600, () => {
        if (mine !== run) return;
        if (i < 4) el.data = { ...el.data, progress: i / 4 };
        else el.data = { src: picture(scene), alt: SCENES[scene].prompt, state: 'auto' };
      });
    }
  };
  bar.append(
    button('Regenerate', () => generate(el.phase === 'done' || el.phase === 'revealing')),
    button('Start over', () => generate(false)),
  );
  card.append(prompt, el, bar, status);
  queueMicrotask(() => generate(false));
  return card;
}

export const doc: ComponentDoc = {
  slug: 'image-reveal',
  name: 'Image Reveal',
  tag: 'ui-image-reveal',
  summary:
    'Is my picture coming? — a pixel mosaic that keeps moving while an image is being made, then dissolves into the real picture when it arrives.',
  description:
    'A loader that becomes the image. While a picture is being generated (or loaded) a WebGL pixel mosaic cycles in its frame — Chromium Flow (pixels-organic), Nebula (pixels-mechanic) or a diagonal gradient sweep — in the theme’s greys or a palette. When the picture arrives it dissolves in through the mosaic, cell by cell along the shader’s own field, and then the canvas goes away: what stays is a real `<img>` with its alt text (selectable, readable, the WebGL context released). The host sets `src` and, if it knows more than “the URL loads”, a `state` (`loading` · `done` · `error`) and a `progress`. `regenerate()` breaks the picture back into churning cells, tinted with its own colours, until the next `src` dissolves in over them. A picture that fails is “No preview”, never an endless loader. Without WebGL 2 the loader is a CSS mosaic and the picture fades in; under reduced motion the mosaic is one still frame and the picture cross-fades.',
  usedIn:
    'soma-work dashboard: an image-generation tool call in the conversation — the card shows the loader while the tool runs and the generated picture when its result lands (Regenerate re-runs the tool). Past results in the history use state="done": the picture, no loader and no WebGL.',
  reference: { name: 'Libraries.dev — img-fx (Image generation)', url: 'https://libraries.dev/image' },
  group: 'Effects',
  props: [
    {
      name: 'src',
      type: 'attribute / data.src: string',
      description:
        'The picture: http(s), a relative URL, blob: or a base64 raster data:image (anything else is no picture). In state="auto" the element reveals it as soon as it loads; a new src while a picture is shown churns the old one until the new one arrives.',
    },
    {
      name: 'alt',
      type: 'attribute / data.alt: string',
      required: true,
      description:
        'What the picture shows — the final <img>’s text (the prompt is a good alt). Without it: “Generated image”.',
    },
    {
      name: 'state',
      type: 'attribute / data.state: "auto" | "loading" | "done" | "error"',
      default: '"auto"',
      description:
        'auto — the loader until src loads, then the reveal. loading — keep the loader even if src has loaded (the model is still working). done — the picture: revealed if the loader is on screen, else shown at once with no loader and no WebGL (past results). error — “No preview”.',
    },
    {
      name: 'progress',
      type: 'attribute / data.progress: number',
      description: 'How far the generation is, 0 … 1 — spoken in the status (“Generating image, 40%”).',
    },
    {
      name: 'preset',
      type: 'attribute / data.preset: "pixels-organic" | "pixels-mechanic" | "sweep-gradient"',
      default: '"pixels-organic"',
      description:
        'The library’s three presets: Chromium Flow ridges, the Nebula mosaic, or a fast diagonal sweep with flickering cells. Each has a dark and a light tuning, picked from the surface it sits on.',
    },
    {
      name: 'palette',
      type: 'attribute / data.palette: "preset" | "accent" | "ocean" | "ember"',
      default: '"preset"',
      description:
        'The colours the mosaic wears: the preset’s greys, a ramp of the theme’s --accent, or the Ocean / Ember palettes — mapped onto the preset’s slots by brightness, so the effect keeps its structure.',
    },
    {
      name: 'data.colors',
      type: '(string | null)[]',
      description: 'Per-slot override of the seven shader colours (CSS colours; null keeps a slot). Wins over palette.',
    },
    {
      name: 'card-bg',
      type: 'attribute / data.cardBg: string',
      default: 'var(--bg)',
      description:
        'The card colour behind the effect (opaque CSS colour). By default the frame is the page colour (--bg), which sits where the library tuned its presets (#1B1B1B dark, #f5f5f5 light); the shader fades cells close to it. CSS: --image-reveal-bg does the same.',
    },
    {
      name: 'pixel-scale',
      type: 'attribute / data.pixelScale: number',
      default: '1',
      description: 'Cell size, 0.25 … 4: 0.5 is a finer grid, 2 chunkier. The reveal’s dissolve follows the same grid.',
    },
    {
      name: 'speed',
      type: 'attribute / data.speed: number',
      default: '1',
      description: 'Animation speed on top of the preset’s tempo, 0.1 … 4.',
    },
    {
      name: 'strength',
      type: 'attribute / data.strength: number',
      default: '1',
      description: 'Effect strength, 0 … 2: below 1 fades the mosaic, above 1 pushes its intensity and highlights.',
    },
    {
      name: 'aspect',
      type: 'attribute / data.aspect: string | number',
      default: '"1 / 1"',
      description:
        'The frame’s ratio (“16 / 9”, “4:3”, 1.5 — clamped to 1:5 … 5:1); the frame takes the host’s width. "fill" fills the host’s own box instead (give the host a height).',
    },
    {
      name: 'motion',
      type: 'attribute: "system" | "reduce" | "full"',
      default: '"system"',
      description:
        'system follows prefers-reduced-motion; reduce draws one still frame and cross-fades the picture; full animates regardless.',
    },
    {
      name: 'paused',
      type: 'boolean attribute / data.paused',
      description: 'Freeze the mosaic on its frame (no frames drawn). A picture arriving while paused cross-fades in.',
    },
    {
      name: 'label',
      type: 'attribute / data.label: string',
      description: 'The status text while loading, instead of “Generating image”.',
    },
    {
      name: 'reveal-ms',
      type: 'attribute / data.revealMs: number (ms)',
      description:
        'How long the loader takes to become the picture, 120 … 10000, instead of the preset’s 3 s dissolve (and the 600 ms cross-fade without WebGL). A short one — 280 — suits a picture that was only downloading: <ui-artifact-viewer> uses it so a fast load is never slowed. The dissolve then draws at up to 60 fps.',
    },
    { name: 'lang', type: '"en" | "ko"', default: '"en"', description: 'The built-in words in Korean.' },
    {
      name: '--image-reveal-radius / --image-reveal-bg',
      type: 'CSS custom properties',
      default: 'calc(var(--radius) + 4px) / var(--bg)',
      description: 'The frame’s corners and surface. ::part(frame), ::part(image), ::part(empty) style the rest.',
    },
    {
      name: 'regenerate()',
      type: 'method → boolean',
      description:
        'Break the picture on screen back into the mosaic (tinted with its own colours) and churn until the host sets a new src, which then dissolves in over the churn. False when there is no picture.',
    },
    {
      name: 'phase / rendering / running / options',
      type: 'read-only',
      description:
        'Where it is (loading · revealing · done · error), how the effect is drawn (webgl · still · css · none), whether the frame loop is scheduled, and the clamped options.',
    },
    {
      name: 'imageRevealTarget · imageRevealAspect · imageRevealStatusText · imageRevealPaletteColors · imageRevealIsColor · imageRevealRankPalette · imageRevealAccentRamp · imageRevealSamplePalette · imageRevealCellSize · imageRevealMosaicGrid · imageRevealCoverRect · imageRevealTiming · IMAGE_REVEAL_PRESETS',
      type: 'helpers (package exports)',
      description:
        'Pure, from the element and the ported engine, each named with the element’s prefix: the state machine’s decision, the ratio, the status words, palette mapping (by name, by brightness rank, an accent ramp, from a picture), the mosaic grid and cell size, the cover crop, the reveal timing, and the presets.',
    },
  ],
  events: [
    {
      name: 'ui-phase-change',
      detail: '{ phase: "loading" | "revealing" | "done" | "error"; src: string }',
      description: 'The element moved to a new phase (not cancelable: it reports what happened).',
    },
  ],
  keyboard: [],
  a11y: [
    'Loading: a role="status" region says “Generating image” (이미지를 만드는 중 with lang="ko", or `label`), with the progress as a percentage; the frame is aria-busy until the picture is in.',
    'Done: a real <img> with the alt text — selectable and read like any image. After a reveal the status says “Image ready” once; a picture shown at once (state="done") announces nothing.',
    '“No preview” (미리보기 없음) when the picture fails or is missing: spoken by the status, drawn in the frame — never an endless loader.',
    'Every canvas is aria-hidden; the element is not focusable and has no keyboard path — controls (Regenerate) belong to the host.',
    'Reduced motion (or motion="reduce"): one still frame of the mosaic, and the picture cross-fades in; the CSS fallback stands still.',
    'No idle cost: no frames off screen, in a hidden tab, while paused, or once the picture is in; one WebGL context per element, made only when its loader first runs on screen (twenty loaders down a page make none until scrolled to) and released when the picture lands, on disconnect, and after 15 s without a frame. No WebGL 2 switches to the CSS mosaic for good; a context the browser evicted, until the loader next comes back on screen — never an exception.',
    'A picture never waits behind a frozen loader: pausing or scrolling away mid-reveal finishes the reveal at once (the status leaves aria-busy).',
    'Sound: none — it follows data, not a person’s action.',
  ],
  usage: `<ui-image-reveal id="art" alt="A lighthouse on a cliff at dusk" state="loading"></ui-image-reveal>
<script type="module">
  import '@2lab.ai/ui/image-reveal';
  const art = document.querySelector('#art');
  tool.on('progress', (p) => { art.data = { ...art.data, progress: p }; });
  // The picture is in: it dissolves out of the mosaic, then stays as a plain <img>.
  tool.on('result', (url) => { art.data = { ...art.data, src: url, state: 'auto' }; });
  tool.on('error', () => { art.data = { ...art.data, state: 'error' }; });
  regenerateButton.onclick = () => { art.regenerate(); tool.run(); };
</script>`,
  demos: [
    {
      id: 'generate',
      title: 'An image being made',
      description:
        'The tool-call card: the loader while the model works (the status carries the progress), the picture when it arrives. Regenerate breaks the picture back into churning cells until the next one dissolves in.',
      height: 520,
      create: generation,
    },
    {
      id: 'presets',
      title: 'Three presets',
      description: 'pixels-organic (Chromium Flow), pixels-mechanic (Nebula) and sweep-gradient, still generating.',
      height: 340,
      create: () =>
        row(
          figure(reveal({ preset: 'pixels-organic', state: 'loading' }), 'pixels-organic'),
          figure(reveal({ preset: 'pixels-mechanic', state: 'loading' }), 'pixels-mechanic'),
          figure(reveal({ preset: 'sweep-gradient', state: 'loading' }), 'sweep-gradient'),
        ),
    },
    {
      id: 'palettes',
      title: 'Palettes, cell size and ratio',
      description:
        'palette="accent" at pixel-scale 0.6, Ocean at 16 / 9 revealing a landscape, Ember with chunky cells at strength 1.4.',
      height: 340,
      create: () => {
        const ocean = reveal({ palette: 'ocean', aspect: '16 / 9', state: 'loading' });
        later(ocean, 2600, () => {
          ocean.data = { ...ocean.data, src: picture('lake'), alt: SCENES.lake.prompt, state: 'auto' };
        });
        return row(
          figure(reveal({ palette: 'accent', pixelScale: 0.6, state: 'loading' }), 'accent · pixel-scale 0.6'),
          figure(ocean, 'ocean · 16 / 9 · reveals', '', '260px'),
          figure(
            reveal({ palette: 'ember', preset: 'pixels-mechanic', pixelScale: 1.8, strength: 1.4, state: 'loading' }),
            'ember · pixel-scale 1.8 · strength 1.4',
          ),
        );
      },
    },
    {
      id: 'states',
      title: 'No preview, still, Korean, past results',
      description:
        'A picture that fails to load says “No preview”; motion="reduce" draws one still frame; lang="ko" speaks Korean; state="done" shows a past result at once — no loader, no WebGL.',
      height: 340,
      create: () =>
        row(
          figure(reveal({ src: broken(), alt: 'A broken file' }), 'a picture that fails → No preview', '', '150px'),
          figure(
            reveal({ state: 'loading', preset: 'pixels-mechanic' }, { motion: 'reduce' }),
            'motion="reduce"',
            '',
            '150px',
          ),
          figure(
            reveal({ state: 'loading', label: '썸네일을 만드는 중', progress: 0.4 }, { lang: 'ko' }),
            'lang="ko" · 썸네일을 만드는 중, 40%',
            'ko',
            '150px',
          ),
          figure(reveal({ src: picture('city'), alt: SCENES.city.prompt, state: 'done' }), 'state="done"', '', '150px'),
        ),
    },
  ],
};
