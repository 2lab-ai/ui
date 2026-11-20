import type { ComponentDoc } from '../../docs/types';
import './metal-text';
import type { MetalTextData, UiMetalText } from './metal-text';

function metalText(text: string, data: MetalTextData = {}, attrs: Record<string, string> = {}): UiMetalText {
  const el = document.createElement('ui-metal-text');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  el.textContent = text;
  return el;
}

/** The plan card from Libraries.dev: "Plan" in plain text catches the reflection of the metal "Pro" beside it. */
function planCard(): HTMLElement {
  const card = document.createElement('div');
  card.style.cssText =
    'display:flex;flex-direction:column;gap:10px;width:min(360px,100%);box-sizing:border-box;padding:20px 22px;border-radius:18px;background:var(--ui-ib-card);box-shadow:inset 0 0 0 1px var(--ui-border)';
  const line = document.createElement('div');
  line.style.cssText =
    'display:flex;align-items:baseline;gap:7px;font:500 24px/1.2 var(--ui-font, system-ui);letter-spacing:-0.01em';
  const plan = document.createElement('span');
  plan.textContent = 'Plan';
  plan.style.color = 'var(--ui-text-secondary)';
  const pro = metalText('Pro', {
    font: '500 24px/1.2 var(--ui-font, system-ui)',
    strength: 0.9,
    reflectionTargets: [{ el: plan, strength: 0.64, glyphs: true }],
  });
  line.append(plan, pro);
  const meta = document.createElement('p');
  meta.style.cssText = 'margin:0;font-size:13px;line-height:1.5;color:var(--ui-ib-muted)';
  meta.textContent = '5× the agent hours, priority queue, and the long-context models. Renews on the 1st.';
  card.append(line, meta);
  return card;
}

function caption(text: string, lang = ''): HTMLElement {
  const p = document.createElement('p');
  p.style.cssText = 'margin:6px 0 0;font-size:12px;color:var(--ui-ib-muted);text-align:center';
  if (lang) p.lang = lang;
  p.textContent = text;
  return p;
}

function figure(el: HTMLElement, text: string): HTMLElement {
  const f = document.createElement('div');
  f.style.cssText = 'display:flex;flex-direction:column;align-items:center';
  f.append(el, caption(text));
  return f;
}

function row(...kids: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:center;gap:28px';
  box.append(...kids);
  return box;
}

const HEADLINE = '600 40px/1.1 var(--ui-font, system-ui)';

export const doc: ComponentDoc = {
  slug: 'metal-text',
  name: 'Metal Text',
  tag: 'ui-metal-text',
  summary:
    'Which word names the tier? — liquid metal inside the glyphs of the host’s own words, with a rim of light along each letter, so a plan name or a headline reads as metal while staying plain, selectable text.',
  description:
    'The host’s words are the slotted text; the element paints the liquid metal (the same engine as <ui-metal>) masked to them — the text run drawn with the DOM’s own font and position — and composites it over the live text at `metalOpacity`, so the text’s colour is the tone the metal blends onto. A rim of light runs along the top inside edge of each letter (computed from the glyphs: their alpha minus itself shifted down a pixel, blurred and clipped back). A halo on the glyphs is opt-in (`glow`). Next to plain words in a dark theme, `reflectionTargets` with `glyphs: true` lets a neighbouring word catch the metal on its letterforms. One line of text; font and colour inherit, or come from `data.font` / `data.color`. Without WebGL2 the words show in a CSS metallic gradient.',
  usedIn:
    'soma-work dashboard: the plan name in the account menu and on the billing settings page (“Plan Pro”) — the one word that says which tier the workspace is on.',
  reference: { name: 'Libraries.dev — Liquid Metal (MetalText)', url: 'https://libraries.dev/metal' },
  group: 'Effects',
  props: [
    {
      name: 'text',
      type: 'slotted text',
      description:
        'The words — the host’s own text node(s), on one line. They stay in the light DOM: selectable, searchable and the accessible name.',
    },
    {
      name: 'data.font · data.color',
      type: 'CSS font shorthand · CSS colour',
      default: 'inherited',
      description:
        'The text’s font and colour (the metal composites over that colour). Set through CSSOM, never markup. Or style the element itself — both inherit.',
    },
    {
      name: 'preset · theme · strength · paused · motion',
      type: 'attributes / data',
      default: 'chromatic · auto · 1 · — · system',
      description:
        'As on <ui-metal>: the tint, the tuning (follows the page unless pinned), the opacity, a freeze, reduced motion.',
    },
    {
      name: 'data.metalOpacity',
      type: 'number',
      default: '0.62',
      description: 'How much metal shows over the text’s colour, 0 … 1, multiplied with strength.',
    },
    {
      name: 'data.shaderScale',
      type: 'number',
      default: '2.8',
      description: 'Zoom of the metal inside the glyphs, 0.1 … 10 — bigger type wants a bigger pattern.',
    },
    {
      name: 'data.innerShadow',
      type: '{ offsetY, blur, alpha } | null',
      default: '{ offsetY: 1, blur: 0.5, alpha: 0.9 }',
      description: 'The rim of light inside the glyphs; null turns it off. offsetY and blur 0 … 4px, alpha 0 … 1.',
    },
    {
      name: 'glow · data.glowGain',
      type: 'boolean attribute / data.glow · number',
      default: 'off · 2.5',
      description: 'A halo on the glyphs (clipped to them, with a soft skirt), and its gain 0 … 10.',
    },
    {
      name: 'reflect · data.reflectionTargets',
      type: 'ids / Array<HTMLElement | { el, strength?, glyphs? }>',
      description:
        'Neighbours that catch the metal (dark theme). For a word beside it, pass `{ el, glyphs: true }` (or mark the target data-metal-fx-text) so only its letterforms are lit, with the metal sheet mirrored rather than the thin glyphs.',
    },
    {
      name: 'cursor-light',
      type: 'attribute / data.cursorLight: boolean',
      default: 'true',
      description:
        'While the pointer is over the words, a glint follows it (with setCursorSprite); off under reduced motion.',
    },
    {
      name: 'play() · pause() · paused · rendering',
      type: 'methods / read-only',
      description: 'As on <ui-metal>.',
    },
  ],
  events: [],
  keyboard: [],
  a11y: [
    'The words are the host’s own text, in the light DOM: read, selected, found and translated as text. The metal canvas, the glow and the glyph rim over them are aria-hidden and let the pointer through.',
    'Contrast is the text’s own colour under at most `metalOpacity` × strength of metal (0.62 by default): pick the colour for contrast as if the metal were not there.',
    'Reduced motion (prefers-reduced-motion, or motion="reduce"): one still frame.',
    'Forced colours: no painted metal; the fallback gradient gives way to CanvasText.',
    'Without WebGL2 (or after a lost context) the words show in a CSS metallic gradient; nothing throws.',
  ],
  usage: `<span class="plan">Plan</span>
<ui-metal-text style="font: 500 24px/1.2 Inter, sans-serif; color: #e2e2e2">Pro</ui-metal-text>

<script type="module">
  import '@2lab.ai/ui/metal-text';
  const pro = document.querySelector('ui-metal-text');
  // "Plan" catches the metal on its letterforms (dark theme only).
  pro.data = { reflectionTargets: [{ el: document.querySelector('.plan'), strength: 0.64, glyphs: true }] };
</script>`,
  demos: [
    {
      id: 'plan',
      title: 'Plan Pro',
      description:
        'The Libraries.dev card: “Pro” in metal at 24px. In the dark preview the plain “Plan” beside it catches the metal on its letters.',
      height: 240,
      create: planCard,
    },
    {
      id: 'presets',
      title: 'Headlines in three presets',
      description: 'chromatic, silver and gold at 40px with shaderScale 3.2 — the pattern scales with the type.',
      height: 220,
      create: () =>
        row(
          figure(metalText('Opus', { font: HEADLINE, shaderScale: 3.2 }), 'chromatic'),
          figure(metalText('Sonnet', { font: HEADLINE, shaderScale: 3.2, preset: 'silver' }), 'silver'),
          figure(metalText('Max', { font: HEADLINE, shaderScale: 3.2, preset: 'gold' }), 'gold'),
        ),
    },
    {
      id: 'ko',
      title: 'Korean, a glow, and a still frame',
      description:
        'Korean words (lang="ko") with the glyph halo on; the same text under motion="reduce" stays on one still frame.',
      height: 220,
      create: () => {
        const ko = metalText('프로 요금제', { font: HEADLINE, glow: true, metalOpacity: 0.7 }, { lang: 'ko' });
        const still = metalText('프로 요금제', { font: HEADLINE }, { lang: 'ko', motion: 'reduce' });
        return row(figure(ko, 'glow · metalOpacity 0.7'), figure(still, 'motion="reduce"'));
      },
    },
  ],
};
