import type { ComponentDoc } from '../../docs/types';
import { icon } from '../../icons/icons';
import './metal';
import type { MetalData, UiMetal } from './metal';

/** A `<ui-metal>` around a fresh child. */
function metal(child: HTMLElement, data: MetalData = {}, attrs: Record<string, string> = {}): UiMetal {
  const el = document.createElement('ui-metal');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  el.append(child);
  return el;
}

/** A plain button in the light DOM — the host's own markup, which the metal wraps. */
function button(text: string, css: string, label = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.style.cssText = `display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;cursor:pointer;font:500 14px/1 var(--ui-font, system-ui);color:var(--ui-text);background:var(--ui-surface-raised);box-shadow:inset 0 0 0 1px var(--ui-border);${css}`;
  if (text.startsWith('<svg')) b.innerHTML = text;
  else b.textContent = text;
  if (label) b.setAttribute('aria-label', label);
  return b;
}

const pill = (text: string) => button(text, 'height:40px;padding:0 22px;border-radius:999px;letter-spacing:-0.005em');
const circle = (svg: string, label: string, size = 36) =>
  button(svg, `width:${size}px;height:${size}px;padding:0;border-radius:50%`, label);

function row(gap = 14, ...kids: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = `display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:${gap}px`;
  box.append(...kids);
  return box;
}

function caption(text: string): HTMLElement {
  const p = document.createElement('p');
  p.style.cssText = 'margin:8px 0 0;font-size:12px;line-height:1.4;color:var(--ui-ib-muted);text-align:center';
  p.textContent = text;
  return p;
}

function figure(el: HTMLElement, text: string): HTMLElement {
  const f = document.createElement('div');
  f.style.cssText = 'display:flex;flex-direction:column;align-items:center';
  f.append(el, caption(text));
  return f;
}

/** A chip like the composer's model / mode pickers. */
function chip(text: string): HTMLElement {
  const c = document.createElement('div');
  c.style.cssText =
    'display:inline-flex;align-items:center;gap:4px;height:32px;padding:0 10px 0 12px;border-radius:999px;font-size:13px;color:var(--ui-text-secondary);background:var(--ui-ib-pill);box-shadow:inset 0 0 0 1px var(--ui-border)';
  c.innerHTML = `<span></span>${icon('chevron-down', { size: 14 })}`;
  (c.firstElementChild as HTMLElement).textContent = text;
  return c;
}

/** The composer from the Libraries.dev page: a circle send button with the rim, the bend and a reflection. */
function composer(): HTMLElement {
  const card = document.createElement('div');
  card.style.cssText =
    'width:min(520px,100%);box-sizing:border-box;padding:14px 14px 12px;border-radius:22px;background:var(--ui-ib-card);box-shadow:inset 0 0 0 1px var(--ui-border)';
  const field = document.createElement('textarea');
  field.rows = 2;
  field.placeholder = 'Ask the agent to review the failing deploy…';
  field.setAttribute('aria-label', 'Message');
  field.style.cssText =
    'display:block;width:100%;box-sizing:border-box;resize:none;border:0;outline:0;background:transparent;font:14px/1.5 var(--ui-font, system-ui);color:var(--ui-text);padding:2px 4px 10px';
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;gap:8px';
  const plus = button(
    icon('plus', { size: 16 }),
    'width:32px;height:32px;border-radius:50%;background:var(--ui-ib-pill);color:var(--ui-text-secondary)',
    'Attach',
  );
  const spacer = document.createElement('div');
  spacer.style.flex = '1';
  const agent = chip('Agent');
  const auto = chip('Auto');
  const send = metal(circle(icon('arrow-up', { size: 16, stroke: 1.75 }), 'Send'), {
    variant: 'circle',
    innerShadow: true,
    bend: true,
    strength: 0.81,
    reflectionTargets: [auto],
  });
  bar.append(plus, spacer, agent, auto, send);
  card.append(field, bar);
  return card;
}

/** Play / pause from outside, through the element's methods. */
function playPause(): HTMLElement {
  const el = metal(pill('Upgrade to Pro'), { paused: true });
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'ui-btn';
  toggle.style.cssText = 'height:30px;padding:0 12px;border-radius:8px;font-size:12.5px';
  toggle.textContent = 'Play';
  toggle.setAttribute('aria-pressed', 'false');
  toggle.addEventListener('click', () => {
    const on = el.paused;
    if (on) el.play();
    else el.pause();
    toggle.textContent = on ? 'Pause' : 'Play';
    toggle.setAttribute('aria-pressed', String(on));
  });
  return row(
    18,
    figure(el, 'paused (starts still) · play() / pause()'),
    figure(toggle, 'the host’s control'),
    figure(metal(pill('Upgrade to Pro'), {}, { motion: 'reduce' }), 'motion="reduce" · a still frame'),
    figure(metal(pill('Upgrade to Pro'), { strength: 0.5 }), 'strength 0.5'),
  );
}

/** One pill pinned dark and one pinned light, side by side. */
function themes(): HTMLElement {
  const stage = (theme: 'dark' | 'light') => {
    const s = document.createElement('div');
    s.setAttribute('data-theme', theme);
    s.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:14px;padding:22px 26px;border-radius:16px;background:var(--ui-ib-col);color:var(--ui-text)';
    s.append(
      metal(pill('Upgrade to Pro'), { theme }),
      metal(circle(icon('mic', { size: 16 }), 'Voice input'), { theme, variant: 'circle', innerShadow: true }),
    );
    const c = caption(`theme="${theme}"`);
    c.style.margin = '0';
    s.append(c);
    return s;
  };
  return row(16, stage('dark'), stage('light'));
}

export const doc: ComponentDoc = {
  slug: 'metal',
  name: 'Liquid Metal',
  tag: 'ui-metal',
  summary:
    'Which button is the one that matters? — a ring of liquid metal around the host’s own button or icon, with a halo that finds the bright spot, a light that faces the pointer and a soft reflection on its neighbours.',
  description:
    'Wraps the host’s own button, chip or icon (the default slot) and draws an animated ring of liquid metal around it — Paper Shaders’ liquidMetal material, cropped from one shared WebGL canvas and punched into a ring on the element’s own 2D canvas. A halo finds the brightest point on the ring and moves there with a fade (never a slide); while the pointer is over the element the catch-light faces it (`cursor-light`). `inner-shadow` adds a hairline of light along the ring’s top inside edge, `bend` dents the ring like liquid under the pointer, and in a dark theme `reflect` lets neighbouring chips catch a mirrored, blurred echo of the metal. Three presets (chromatic, silver, gold), each tuned for light and dark; the theme follows the page (its data-theme / tokens) unless `theme` pins it. The wrapped element keeps its semantics, focus, events and text — everything added is aria-hidden and lets the pointer through. One WebGL2 context serves every metal element on the page; frames stop off screen, in a hidden tab, while paused and under reduced motion (a still frame), and the context is released when the last element leaves or after 10 s with nothing to draw. Without WebGL2 the wrapped element shows as it is with a CSS metallic ring.',
  usedIn:
    'soma-work dashboard: the composer’s send button while a run is ready to go (circle, inner-shadow, bend, reflect onto the model chip), and the one upgrade / primary action on a settings page.',
  reference: { name: 'Libraries.dev — Liquid Metal (metal-fx)', url: 'https://libraries.dev/metal' },
  group: 'Effects',
  props: [
    {
      name: 'variant',
      type: 'attribute / data.variant: "button" | "circle"',
      default: '"button"',
      description:
        'button — a pill: the wrapped element’s own radius, a 1px ring, shader scale 1.6. circle — a true circle (min(w,h)/2 whatever the CSS says), a 2px ring, scale 1.3.',
    },
    {
      name: 'preset',
      type: 'attribute / data.preset: "chromatic" | "silver" | "gold"',
      default: '"chromatic"',
      description:
        'The material’s tint, each with a dark and a light tuning (metal-fx’s presets, unchanged). Every element draws its own preset — a silver and a gold one can sit side by side.',
    },
    {
      name: 'theme',
      type: 'attribute / data.theme: "auto" | "dark" | "light"',
      default: 'auto',
      description:
        'auto follows the page — data-theme on an ancestor (with @2lab.ai/ui/tokens.css), else prefers-color-scheme — and switches live. dark / light pin the tuning (and, as the attribute, the element’s tokens).',
    },
    {
      name: 'strength',
      type: 'attribute / data.strength: number',
      default: '1',
      description: 'The metal’s and the glow’s opacity, 0 … 1. The material keeps moving at any value.',
    },
    {
      name: 'paused',
      type: 'boolean attribute / data.paused',
      description: 'Freeze on the current frame; the ring stays. Only this element stops — the others keep moving.',
    },
    {
      name: 'motion',
      type: 'attribute / data.motion: "system" | "reduce" | "full"',
      default: '"system"',
      description:
        'system follows prefers-reduced-motion; reduce is always a still frame (no flow, no bend, no pointer light); full always moves.',
    },
    {
      name: 'inner-shadow',
      type: 'boolean attribute / data.innerShadow: boolean | { offsetY, blur, alpha, color }',
      description:
        'A hairline of light along the ring’s top inside edge (white 90 %, offset 1px, blur 0.5px). The object tunes it: offsetY −4 … 4px, blur 0 … 4px, alpha 0 … 1, color #rrggbb.',
    },
    {
      name: 'bend',
      type: 'boolean attribute / data.bend',
      description:
        'The cursor-driven liquid dent (metal-fx’s useMetalBend): the ring presses in under the pointer, stretches around it and springs back. Only while the pointer is over the element; off under reduced motion.',
    },
    {
      name: 'reflect',
      type: 'attribute (ids) / data.reflectionTargets: Array<HTMLElement | { el, strength?, glyphs? }>',
      description:
        'Neighbours that catch a soft reflection of the metal — dark theme only (no DOM work in light). `strength` 0 … 2 keeps a container faint; `glyphs` lights a word’s letterforms instead of its box. The reflection is a canvas the element puts inside the target (aria-hidden, pointer-events: none) and removes when it goes.',
    },
    {
      name: 'cursor-light',
      type: 'attribute / data.cursorLight: boolean',
      default: 'true',
      description:
        'While the pointer is over the element, the ring’s catch-light faces it. "false" turns it off. Nothing is read or drawn for a pointer elsewhere on the page.',
    },
    {
      name: 'data.glowGain · data.disableGlow',
      type: 'number (0 … 10) · boolean',
      default: '1 · false',
      description: 'A multiplier on the glow only, on top of strength — or no halo at all (the ring still draws).',
    },
    {
      name: 'data.borderRadius · data.normalizeHostStyles',
      type: 'number (px) · boolean',
      default: 'the child’s radius · true',
      description:
        'An explicit corner radius; and whether the wrapped element’s own border, outline, shadow and background are cleared so they don’t fight the ring (a keyboard focus ring stays).',
    },
    {
      name: 'data.shaderScale · data.ringCssPx · data.scale',
      type: 'number',
      default: 'the variant’s · the variant’s · 1',
      description:
        'The pattern’s zoom (0.1 … 10), the ring’s thickness (0 … 20px) and a master scale (0.25 … 8) for every absolute-pixel constant — for a CSS-zoomed or doubled layout.',
    },
    {
      name: 'data.mask · data.glowMode',
      type: '(ctx, w, h, dpr) => void · "mask" | "ring"',
      description:
        'A custom alpha mask (device px) — metal inside a shape instead of a ring; the glow then samples inside the mask (mask) or keeps to the edge (ring). <ui-metal-text> and <ui-metal-badge> are built on it.',
    },
    {
      name: '--metal-fill',
      type: 'CSS custom property',
      default: 'var(--surface)',
      description:
        'The fill under the ring and the child (the library’s #272727 / #ffffff map to the theme’s surface).',
    },
    {
      name: 'play() · pause() · paused · rendering · UiMetal.supported',
      type: 'methods / read-only',
      description:
        'Move or freeze from code; whether it is frozen now (paused or reduced motion); "webgl" or "fallback"; whether the browser has WebGL2.',
    },
    {
      name: 'setMetalGlowConfig · setMetalCursorLightConfig · setMetalCursorSprite · setMetalBendConfig · setMetalReflectionOccluderConfig · METAL_PRESET_MODES',
      type: 'engine exports',
      description:
        'metal-fx’s live-tunable singletons and presets, unchanged and page-wide, under a metal prefix (setGlowConfig → setMetalGlowConfig …). setMetalCursorSprite (a raster of the OS pointer, which the ring then lights while over the element) is opt-in and ships no artwork.',
    },
  ],
  events: [],
  keyboard: [],
  a11y: [
    'Decorative: the canvas, the glow, the rim and the fallback ring are aria-hidden and pointer-events: none. The wrapped button keeps its role, name, focus and events — name it as you would without the metal (aria-label on an icon button).',
    'Normalising the child clears its outline, so the element draws its own focus-visible ring (2px var(--border-focus), offset 3px) around the metal.',
    'Reduced motion (prefers-reduced-motion, or motion="reduce"): one still frame — no flow, no halo travel, no bend, no pointer light.',
    'Forced colours: no painted metal; the wrapped control gets a ButtonText edge back.',
    'No frames while idle: off screen (IntersectionObserver), in a hidden tab, while paused or reduced; the pointer is read only while it is over the element. One WebGL context for the page, released with the last element or after 10 s idle.',
    'Without WebGL2 (or after a lost context) the wrapped element shows as it is, with a CSS metallic ring — nothing is lost and nothing throws.',
  ],
  usage: `<ui-metal variant="circle" inner-shadow bend>
  <button type="button" aria-label="Send">↑</button>
</ui-metal>

<ui-metal preset="gold">
  <button type="button" class="upgrade">Upgrade to Pro</button>
</ui-metal>

<script type="module">
  import '@2lab.ai/ui/metal';
  const send = document.querySelector('ui-metal[variant="circle"]');
  // A neighbour catches the reflection (dark theme only).
  send.data = { reflectionTargets: [document.querySelector('.model-chip')] };
</script>`,
  demos: [
    {
      id: 'composer',
      title: 'Composer send button',
      description:
        'The Libraries.dev composer: variant="circle" with inner-shadow and bend — move the pointer over it to dent the ring and turn the catch-light toward it. In the dark preview the Auto chip catches the reflection.',
      height: 260,
      create: composer,
    },
    {
      id: 'presets',
      title: 'Three presets',
      description:
        'chromatic, silver and gold on the same pill — each element draws its own preset from the one shared WebGL context.',
      height: 200,
      create: () =>
        row(
          18,
          figure(metal(pill('Upgrade to Pro')), 'chromatic'),
          figure(metal(pill('Upgrade to Pro'), { preset: 'silver' }), 'silver'),
          figure(metal(pill('Upgrade to Pro'), { preset: 'gold' }), 'gold'),
        ),
    },
    {
      id: 'themes',
      title: 'Dark and light tunings',
      description:
        'theme pins the tuning: the dark one glows at 0.7; the light one multiplies a saturated, fainter halo onto white.',
      height: 300,
      create: themes,
    },
    {
      id: 'still',
      title: 'Paused, still and faint',
      description:
        'paused starts on a still frame and play() / pause() move it from the host’s own control; motion="reduce" is always still; strength 0.5 lets the fill show through.',
      height: 300,
      create: playPause,
    },
  ],
};
