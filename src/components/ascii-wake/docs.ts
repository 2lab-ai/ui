import type { ComponentDoc } from '../../docs/types';
import './ascii-wake';
import type { AsciiWakeData, UiAsciiWake } from './ascii-wake';

function wake(data: AsciiWakeData = {}, attrs: Record<string, string> = {}, style = ''): UiAsciiWake {
  const el = document.createElement('ui-ascii-wake');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (style) el.style.cssText = style;
  el.data = data;
  return el;
}

/** A quiet caption under a field, in the light DOM. */
function caption(text: string, lang = ''): HTMLElement {
  const p = document.createElement('p');
  p.style.cssText = 'margin:6px 0 0;font-size:12px;line-height:1.45;color:var(--ui-ib-muted);text-align:center';
  if (lang) p.lang = lang;
  p.textContent = text;
  return p;
}

function figure(el: HTMLElement, text: string, lang = ''): HTMLElement {
  const f = document.createElement('div');
  f.style.cssText = 'flex:1 1 150px;min-width:0';
  f.append(el, caption(text, lang));
  return f;
}

function row(...kids: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px';
  box.append(...kids);
  return box;
}

/** The sign-in page: the field fills the box behind the words; only the slider takes the pointer from it. */
function backdrop(): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText =
    'position:relative;height:260px;border-radius:12px;overflow:hidden;background:var(--ui-surface-raised)';
  const field = wake(
    { shape: 'field', activity: 0.35 },
    { decorative: '' },
    'position:absolute;inset:0;height:auto;color:color-mix(in srgb, var(--ui-text-tertiary) 38%, transparent)',
  );
  const words = document.createElement('div');
  words.style.cssText =
    'position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:0 20px;text-align:center;pointer-events:none';
  const h = document.createElement('h2');
  h.style.cssText = 'margin:0;font-size:22px;font-weight:650;letter-spacing:-0.01em;color:var(--ui-text)';
  h.textContent = 'Sign in to soma-work';
  const p = document.createElement('p');
  p.style.cssText = 'margin:0 0 10px;font-size:13.5px;color:var(--ui-text-secondary)';
  p.textContent = 'Your agents keep working while you are away.';
  const pill = document.createElement('div');
  pill.style.cssText =
    'pointer-events:auto;display:flex;align-items:center;gap:10px;padding:6px 12px;border-radius:999px;font-size:12.5px;color:var(--ui-text-secondary);background:color-mix(in srgb, var(--ui-surface) 82%, transparent)';
  const label = document.createElement('label');
  label.style.cssText = 'display:flex;align-items:center;gap:10px';
  const range = document.createElement('input');
  range.type = 'range';
  range.min = '0';
  range.max = '100';
  range.value = '35';
  range.style.width = '140px';
  // The slider says its own value; the figure beside it is for the eye.
  const said = document.createElement('span');
  said.setAttribute('aria-hidden', 'true');
  said.style.cssText = 'min-width:4ch;font-variant-numeric:tabular-nums';
  said.textContent = '0.35';
  range.addEventListener('input', () => {
    const v = Number(range.value) / 100;
    field.data = { ...field.data, activity: v };
    said.textContent = v.toFixed(2);
  });
  label.append('Agent activity', range);
  pill.append(label, said);
  words.append(h, p, pill);
  box.append(field, words);
  return box;
}

export const doc: ComponentDoc = {
  slug: 'ascii-wake',
  name: 'ASCII Wake',
  tag: 'ui-ascii-wake',
  summary:
    'Is anything happening yet? — a quiet field of ink dots that stirs under the pointer and while the agent works, and lies still when nothing does.',
  description:
    'An ambient surface for the quiet states: a cube drawn in ink dots (or, with shape="field", the whole box as a backdrop that fades out at its edges). The pointer drags a wake through it — cells under the hand warm into characters that thicken toward its centre and lean toward it, then cool back to dots behind it over `trail` seconds — and a press sends a ring out. `activity` (0 … 1) lets the agent stir it on its own: two or three slow virtual hands on Lissajous paths lay heat in proportion to it, so bound to the live run’s token rate the field moves while the agent works and settles when it stops. One canvas at the box’s size × devicePixelRatio; the frame loop runs only while something moves and pauses offscreen or in a hidden tab. The ink is the host’s `color` (--text-tertiary by default), and the cube’s faces shade by it, so the lit face reads lit on light and dark.',
  usedIn:
    'soma-work dashboard quiet states: the empty board, a conversation waiting for its first token, the sign-in page’s backdrop — with `activity` following the live run’s token rate, so the field stirs while the agent works.',
  reference: { name: 'bencho.dev — ASCII wake (MIT)', url: 'https://bencho.dev/blocks/ascii-wake' },
  group: 'Primitives',
  props: [
    {
      name: 'shape',
      type: 'attribute / data.shape: "cube" | "field"',
      default: '"cube"',
      description:
        'cube — the ink cube, centred and scaled with the box (min(w/360, h/240)). field — the whole box, fading out over its last 48px (a quarter of a small box’s short side): a backdrop.',
    },
    {
      name: 'activity',
      type: 'attribute / data.activity: number',
      default: '0',
      description:
        'The agent’s own activity, 0 … 1: slow virtual hands stir the field in proportion (two, three past 0.5). 0 is still — back at 0 the wake cools and the loop stops. Bind it to the live run’s token rate.',
    },
    {
      name: 'glyphs',
      type: 'attribute / data.glyphs: "classic" | "blocks" | "dots" | "binary"',
      default: '"classic"',
      description: 'The ramp a warm cell climbs: “ .:-=+*#%@” · “ ·░▒▓█” · “ ·•●” · “ .:01”.',
    },
    {
      name: 'trail',
      type: 'attribute / data.trail: number (s)',
      default: '1.2',
      description: 'How long the wake takes to cool back to dots (0.2 … 4).',
    },
    {
      name: 'reach',
      type: 'attribute / data.reach: number',
      default: '50',
      description: 'How wide the hand is, 0 … 100 — a radius of 12 … 70px. Also the virtual hands’ width.',
    },
    {
      name: 'pull',
      type: 'attribute / data.pull: number',
      default: '40',
      description: 'How far the glyphs lean toward the hand, 0 … 100 (within twice its radius).',
    },
    {
      name: 'size',
      type: 'attribute / data.size: number (px)',
      default: '10',
      description:
        'The glyph size, 8 … 20; the cells follow it (0.62 × 0.82 of it). The cube scales, the glyphs do not.',
    },
    {
      name: 'label',
      type: 'attribute / data.label: string',
      description: 'The accessible name for its place (“Waiting for the first token”), instead of the built-in one.',
    },
    {
      name: 'decorative',
      type: 'boolean attribute / data.decorative',
      description: 'Hidden from assistive tech (aria-hidden, no role). Use it for a backdrop behind words.',
    },
    { name: 'lang', type: '"en" | "ko"', default: '"en"', description: 'The built-in name in Korean.' },
    {
      name: 'color / height',
      type: 'CSS on the element',
      default: 'var(--text-tertiary) / 240px',
      description:
        'The ink and the box. The ink is read once and again when the theme may have changed (the theme attribute, data-theme on the page, the colour scheme, the element’s style or class).',
    },
    {
      name: 'options / running',
      type: 'AsciiWakeOptions / boolean (read-only)',
      description: 'What it draws with now (clamped), and whether the frame loop is scheduled.',
    },
    {
      name: 'asciiRamp · asciiCubeMask · asciiFieldMask · asciiGrid · asciiCool · asciiRing · asciiHash · asciiGlyphIndex',
      type: 'helpers',
      description:
        'Pure: the ramps, the cube’s and the field’s masks, the grid for a box, cooling, a ring’s radius and heat, the dither hash and the glyph a heat picks.',
    },
  ],
  events: [],
  keyboard: [],
  a11y: [
    'role="img" named “A field of dots stirred by the pointer” (포인터에 반응하는 점 무늬 with lang="ko"); `label` names it for its place. The canvas itself is aria-hidden.',
    '`decorative` hides it (aria-hidden="true", no role) — the right choice behind a headline, where the words carry the page.',
    'Not focusable, and no keyboard path: it is ambient — the field carries no information and nothing in it needs doing.',
    'Touch never blocks the page: touch-action: pan-y lets a vertical swipe scroll through it, and a touch sends a ring only when it lifts where it landed (a scroll sends none). The crosshair shows to a fine pointer only.',
    'Reduced motion: one still frame — the cold mask — with no wake, no ring and no stirring.',
    'No idle CPU: the frame loop runs only while a cell is warm, a ring is out, the hand is settling or activity is above 0; it pauses offscreen and in a hidden tab, and allocates nothing per frame.',
    'Sound (opt-in, @2lab.ai/ui/sound): a press that sends a ring plays a subtle tap; moving through it and the agent’s activity are silent. Silent until the page turns sound on.',
  ],
  usage: `<ui-ascii-wake label="Waiting for the first token"></ui-ascii-wake>
<ui-ascii-wake shape="field" decorative style="height: 100%; color: var(--ui-text-tertiary)"></ui-ascii-wake>
<script type="module">
  import '@2lab.ai/ui/ascii-wake';
  const field = document.querySelector('ui-ascii-wake[shape="field"]');
  // The live run's token rate, 0 … 1: the field stirs while the agent works and settles when it stops.
  run.on('tokens', (perSecond) => { field.data = { activity: Math.min(1, perSecond / 80) }; });
</script>`,
  demos: [
    {
      id: 'cube',
      title: 'The cube',
      description:
        'Classic glyphs. Move the pointer through it: the dots warm into characters under the hand and cool back behind it. Press for a ring.',
      height: 320,
      create: () => wake({}, {}, 'height:280px'),
    },
    {
      id: 'backdrop',
      title: 'A backdrop that stirs while the agent works',
      description:
        'shape="field" behind a sign-in headline, decorative. The slider stands in for the live run’s token rate: at 0 the field cools and stops; above it the agent’s hands stir it. The words let the pointer through, so the wake runs under them.',
      height: 320,
      create: backdrop,
    },
    {
      id: 'glyphs',
      title: 'Glyph ramps',
      description: 'Blocks, dots and binary at size 8, stirred at half activity so the ramps show without a pointer.',
      height: 240,
      create: () =>
        row(
          figure(wake({ glyphs: 'blocks', size: 8, activity: 0.5 }, {}, 'height:150px'), 'blocks  ·░▒▓█'),
          figure(wake({ glyphs: 'dots', size: 8, activity: 0.5 }, {}, 'height:150px'), 'dots  ·•●'),
          figure(wake({ glyphs: 'binary', size: 8, activity: 0.5 }, {}, 'height:150px'), 'binary  .:01'),
        ),
    },
    {
      id: 'ko',
      title: 'Named, or decorative',
      description:
        'lang="ko": the built-in name in Korean, a label for its place (a conversation waiting for its first token), and a decorative one that assistive tech skips.',
      height: 260,
      create: () =>
        row(
          figure(wake({}, { lang: 'ko' }, 'height:170px'), 'role="img" · 포인터에 반응하는 점 무늬', 'ko'),
          figure(
            wake({ label: '첫 토큰을 기다리는 중', glyphs: 'dots' }, { lang: 'ko' }, 'height:170px'),
            'label · 첫 토큰을 기다리는 중',
            'ko',
          ),
          figure(wake({ decorative: true }, { lang: 'ko' }, 'height:170px'), 'decorative · aria-hidden', 'ko'),
        ),
    },
  ],
};
