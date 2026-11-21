import type { ComponentDoc } from '../../docs/types';
import './metal-badge';
import type { MetalBadgeData, UiMetalBadge } from './metal-badge';

function badge(word: string, data: MetalBadgeData = {}, attrs: Record<string, string> = {}): UiMetalBadge {
  const el = document.createElement('ui-metal-badge');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  if (word) el.textContent = word;
  return el;
}

/** The Libraries.dev card: “Live mode” and its New badge. */
function liveMode(): HTMLElement {
  const card = document.createElement('div');
  card.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;gap:14px;width:min(380px,100%);box-sizing:border-box;padding:16px 18px;border-radius:16px;background:var(--ui-ib-card);box-shadow:inset 0 0 0 1px var(--ui-border)';
  const left = document.createElement('div');
  left.style.cssText =
    'display:flex;align-items:center;gap:10px;font:500 15px/1.3 var(--ui-font, system-ui);color:var(--ui-text)';
  const name = document.createElement('span');
  name.textContent = 'Live mode';
  left.append(name, badge('New', { strength: 0.9 }));
  const toggle = document.createElement('label');
  toggle.className = 'ui-switch';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('role', 'switch');
  input.setAttribute('aria-label', 'Live mode');
  toggle.append(input);
  card.append(left, toggle);
  return card;
}

/** A settings nav where one entry is new. */
function nav(lang = ''): HTMLElement {
  const list = document.createElement('nav');
  list.setAttribute('aria-label', lang === 'ko' ? '설정' : 'Settings');
  if (lang) list.lang = lang;
  list.style.cssText =
    'display:flex;flex-direction:column;gap:2px;width:min(260px,100%);padding:8px;border-radius:14px;background:var(--ui-ib-card);box-shadow:inset 0 0 0 1px var(--ui-border)';
  const items =
    lang === 'ko' ? ['일반', '에이전트', '메모리', '음성 입력'] : ['General', 'Agents', 'Memory', 'Voice input'];
  items.forEach((text, i) => {
    const a = document.createElement('a');
    a.href = '#';
    a.addEventListener('click', (e) => e.preventDefault());
    a.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;gap:10px;height:36px;padding:0 10px;border-radius:9px;font-size:13.5px;color:var(--ui-text);text-decoration:none';
    const label = document.createElement('span');
    label.textContent = text;
    a.append(label);
    if (i === 3) a.append(badge('', {}, lang ? { lang } : {}));
    list.append(a);
  });
  return list;
}

function row(...kids: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:22px';
  box.append(...kids);
  return box;
}

export const doc: ComponentDoc = {
  slug: 'metal-badge',
  name: 'Metal Badge',
  tag: 'ui-metal-badge',
  summary:
    'What changed since I last looked? — a small white “New” pill with liquid metal creeping in at its rim, for the one entry that is new.',
  description:
    'The Figma “New” badge of metal-fx, applied verbatim: a 45 × 25 white pill with the liquid metal over it (the same engine as <ui-metal>, masked to the whole pill), a clean white core under the label so the metal shows at the rim, a soft inner glow and two hairline rims, and the word in dark ink on top. The word is the host’s own text (“New” / “신규” with lang="ko" when nothing is slotted); a longer word widens the pill. `scale` multiplies every metric. The pill is white in both themes by design; in a dark theme the glow and the reflection tuning switch with it. Without WebGL2 the metal is a CSS gradient under the same core.',
  usedIn:
    'soma-work dashboard: the settings nav entry and the app-bar item a release just added (“Voice input · New”), for a week or until it is opened.',
  reference: { name: 'Libraries.dev — Liquid Metal (MetalBadge)', url: 'https://libraries.dev/metal' },
  group: 'Effects',
  props: [
    {
      name: 'word',
      type: 'slotted text / data.label',
      default: '“New” · “신규” (lang="ko")',
      description: 'The badge’s word — the host’s own text; data.label (or the built-in word) when nothing is slotted.',
    },
    {
      name: 'scale',
      type: 'attribute / data.scale: number',
      default: '1',
      description: 'A multiplier on the Figma metrics (45 × 25, 12.222px semibold), 0.5 … 4.',
    },
    {
      name: 'preset · theme · strength · paused · motion · cursor-light',
      type: 'attributes / data',
      default: 'chromatic · auto · 1 · — · system · true',
      description: 'As on <ui-metal>.',
    },
    {
      name: 'data.metalOpacity · data.shaderScale',
      type: 'number',
      default: '0.8 · 1.6',
      description: 'How much metal shows over the white fill (0 … 1, × strength), and its zoom (0.1 … 10).',
    },
    {
      name: 'data.core',
      type: '{ r, blur, a, size }',
      default: '{ r: 46, blur: 100, a: 0.94, size: 49 }',
      description:
        'The clean white core under the label: its solid radius and ramp (% of the ellipse), opacity and ellipse size (% of the box). a: 0 shows metal edge to edge.',
    },
    {
      name: 'data.gradient · data.glow · data.textColor',
      type: 'number · number · CSS colour',
      default: '0 · 0.41 · #323232',
      description: 'A white top-to-bottom wash (0 … 1), the two soft inner glows (0 … 1), and the label’s ink.',
    },
    {
      name: 'reflect · data.reflectionTargets',
      type: 'ids / Array<HTMLElement | { el, strength?, glyphs? }>',
      description: 'Neighbours that catch the metal (dark theme only), as on <ui-metal>.',
    },
    {
      name: '--metal-badge-fill · --metal-badge-font',
      type: 'CSS custom properties',
      default: '#ffffff · var(--font)',
      description: 'The pill’s fill (white by design) and the label’s font family.',
    },
  ],
  events: [],
  keyboard: [],
  a11y: [
    'The word is text: read where it sits (inside a link it joins the link’s name — “Voice input New”). Everything painted is aria-hidden.',
    'Dark ink (#323232) on white in both themes: 12.6:1. The metal sits mostly at the rim, under at most metalOpacity × strength.',
    'Not focusable and no role of its own — it labels whatever it sits in.',
    'Reduced motion (prefers-reduced-motion, or motion="reduce"): a still frame. Forced colours: a Canvas pill with a CanvasText edge and ink.',
    'Without WebGL2 (or after a lost context) the metal is a CSS gradient under the same core; nothing throws.',
  ],
  usage: `<span>Live mode</span>
<ui-metal-badge>New</ui-metal-badge>

<!-- Korean, with the built-in word -->
<ui-metal-badge lang="ko"></ui-metal-badge>

<script type="module">
  import '@2lab.ai/ui/metal-badge';
</script>`,
  demos: [
    {
      id: 'live',
      title: 'Live mode · New',
      description: 'The Libraries.dev card: the badge beside a setting that just shipped.',
      height: 200,
      create: liveMode,
    },
    {
      id: 'nav',
      title: 'A new entry in a nav',
      description: 'In a settings nav, on the one entry a release added; the badge’s word joins the link’s name.',
      height: 280,
      create: () => nav(),
    },
    {
      id: 'scale',
      title: 'Scale, presets and Korean',
      description:
        'scale 1.5 in silver and gold, a longer word that widens the pill, and lang="ko" with the built-in “신규”.',
      height: 200,
      create: () =>
        row(
          badge('New', { scale: 1.5, preset: 'silver' }),
          badge('New', { scale: 1.5, preset: 'gold' }),
          badge('Beta', { scale: 1.5 }),
          badge('', { scale: 1.5 }, { lang: 'ko' }),
        ),
    },
    {
      id: 'ko-nav',
      title: '한국어',
      description: 'lang="ko": the nav in Korean and the badge’s built-in word.',
      height: 280,
      create: () => nav('ko'),
    },
  ],
};
