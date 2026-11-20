import type { ComponentDoc } from '../../docs/types';
import './thinking-orb';
import type { OrbState, ThinkingOrbData, UiThinkingOrb } from './thinking-orb';

function orb(data: ThinkingOrbData = {}, attrs: Record<string, string> = {}, style = ''): UiThinkingOrb {
  const el = document.createElement('ui-thinking-orb');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (style) el.style.cssText = style;
  el.data = data;
  return el;
}

function box(tag: string, css: string, text = ''): HTMLElement {
  const el = document.createElement(tag);
  el.style.cssText = css;
  if (text) el.textContent = text;
  return el;
}

function caption(text: string, lang = ''): HTMLElement {
  const p = box(
    'p',
    'margin:6px 0 0;font-size:12px;line-height:1.35;color:var(--ui-text-tertiary);text-align:center',
    text,
  );
  if (lang) p.lang = lang;
  return p;
}

function figure(el: HTMLElement, text: string, lang = ''): HTMLElement {
  const f = box('div', 'display:flex;flex-direction:column;align-items:center;min-width:84px');
  f.append(el, caption(text, lang));
  return f;
}

function grid(cols: number, ...kids: HTMLElement[]): HTMLElement {
  const g = box(
    'div',
    `display:grid;grid-template-columns:repeat(${cols}, minmax(0, 1fr));gap:18px 12px;align-items:end;padding:18px 8px`,
  );
  g.append(...kids);
  return g;
}

function row(gap: number, ...kids: HTMLElement[]): HTMLElement {
  const r = box(
    'div',
    `display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:${gap}px;padding:18px 8px`,
  );
  r.append(...kids);
  return r;
}

const STATES: OrbState[] = [
  'working',
  'searching',
  'solving',
  'listening',
  'connecting',
  'weaving',
  'composing',
  'breathing',
  'shaping',
];

/**
 * The dashboard's status pill: the words are the host's own status (role="status" on the pill), so the orb beside
 * them is decorative — said once, not twice.
 */
function pill(state: OrbState, words: string, size: 20 | 64 = 20): HTMLElement {
  const p = box(
    'div',
    size === 64
      ? 'display:inline-flex;align-items:center;gap:10px;padding:6px 18px 6px 6px;border-radius:999px;background:var(--ui-surface-raised);box-shadow:inset 0 0 0 1px var(--ui-border);font-size:14px;font-weight:500;color:var(--ui-text)'
      : 'display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 12px 0 8px;border-radius:999px;background:var(--ui-surface-raised);box-shadow:inset 0 0 0 1px var(--ui-border);font-size:12.5px;color:var(--ui-text-secondary)',
  );
  p.setAttribute('role', 'status');
  p.append(
    orb({ state, size, decorative: true }, {}, size === 64 ? 'width:48px;height:48px' : ''),
    box('span', '', words),
  );
  return p;
}

/** A light and a dark panel side by side: the same orbs, auto, read the panel they sit on. */
function substrates(): HTMLElement {
  const wrap = box('div', 'display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 4px');
  for (const theme of ['light', 'dark'] as const) {
    const panel = box(
      'div',
      'display:flex;justify-content:center;gap:14px;padding:22px 10px;border-radius:14px;background:var(--ui-surface);box-shadow:inset 0 0 0 1px var(--ui-border)',
    );
    panel.setAttribute('data-theme', theme);
    panel.append(orb({ state: 'searching' }), orb({ state: 'connecting' }), orb({ state: 'weaving' }));
    wrap.append(figure(panel, `data-theme="${theme}" · theme auto`));
  }
  return wrap;
}

export const doc: ComponentDoc = {
  slug: 'thinking-orb',
  name: 'Thinking Orb',
  tag: 'ui-thinking-orb',
  summary:
    'What is the agent doing while I wait? — a small dotted orb that shows it in motion (searching, solving, listening …) and says it to a screen reader.',
  description:
    'A loader with nine verbs, each its own hand-tuned animation of a depth-shaded dotted sphere: working (particles on tilted orbits), searching (a scan meridian sweeps a globe), solving (bands scramble, then click back solved), listening (a waveform rolls through the rings), connecting (a constellation wires itself), weaving (three strands plait around the sphere), composing (an undulating sash), breathing (a ring slowly morphing — “Thinking…”) and shaping (a dotted outline: circle → triangle → square). Three tuned sizes — 64 for an avatar, 32 for a compact avatar, 20 for inline text — each its own design, not a scale. One plain 2D canvas: no WebGL, no filters, the same pixels everywhere. Every orb reads one shared clock so a page of them stays in phase; the loop stops offscreen, in a hidden tab and when paused. Light ink on a dark page, dark ink on a light one, following the page live; `color` tints the ink with its depth ramp intact.',
  usedIn:
    'soma-work dashboard: the live run’s status line and the conversation’s “agent is …” row (20, decorative beside the words), the agent avatar while a turn streams (64), and the task list rows of running tasks.',
  reference: { name: 'Libraries.dev — Thinking Orbs', url: 'https://libraries.dev/orbs' },
  group: 'Effects',
  props: [
    {
      name: 'state',
      type: 'attribute / data.state',
      default: '"working"',
      description:
        '"working" · "searching" · "solving" · "listening" · "connecting" · "weaving" · "composing" · "breathing" · "shaping". Unknown names are working.',
    },
    {
      name: 'size',
      type: 'attribute / data.size: 64 | 32 | 20',
      default: '64',
      description:
        'The tuned design (dot count, dot size, speed) and the default box in px. Other numbers snap to the nearest. Set the element’s own width / height to draw a design larger or smaller: it scales to fit, centred, crisp at any devicePixelRatio (up to 2).',
    },
    {
      name: 'theme',
      type: 'attribute / data.theme: "auto" | "dark" | "light"',
      default: '"auto"',
      description:
        'auto follows the page — the nearest data-design / data-theme / .dark|.light above it, else the --text token, else the OS — and switches live. dark pins light ink, light pins dark ink.',
    },
    {
      name: 'speed',
      type: 'attribute / data.speed: number',
      default: '1',
      description: 'A multiplier on the preset’s baked speed, 0 … 10.',
    },
    {
      name: 'paused',
      type: 'boolean attribute / data.paused',
      default: 'false',
      description: 'Holds the frame it is on (no loop); a theme switch redraws the same instant.',
    },
    {
      name: 'color',
      type: 'attribute / data.color: "#rgb" | "#rrggbb" | "rgb()"',
      description:
        'Tints the ink, keeping the depth ramp: toward black with depth on dark pages, toward white on light ones. Anything else is the grayscale ink.',
    },
    {
      name: 'dots · dotSize',
      type: 'attribute dots, dot-size / data.dots, data.dotSize: number',
      default: '1 · 1',
      description:
        'Density and dot-radius multipliers, 0.1 … 4, applied with the presets’ own paired scalers so a mode keeps its balance.',
    },
    {
      name: 'opts',
      type: 'data.opts: Record<string, number>',
      description:
        'Advanced: the engine’s raw knobs merged last — ghostA, particles (working), scanMul, dimBase (searching), thr, signals, lineW, spread (connecting), turns (weaving), wobMul, bandMul, spin (composing, breathing), spread, shape 0 | 1 | 2 (shaping holds one outline). Non-numbers are dropped.',
    },
    {
      name: 'frame',
      type: 'data.frame: (size, t, opts) => OrbFrame',
      description:
        'Escape hatch: your own geometry, built from the exported parts (orbMakeProj, orbFibDir, orbFinalizeFrame …). The painter, theme, tint, pause and offscreen handling stay the element’s. A throwing frame draws nothing.',
    },
    {
      name: 'label',
      type: 'attribute / data.label: string',
      description: 'The announced label, instead of the state’s (“Analysing the repository…”).',
    },
    {
      name: 'decorative',
      type: 'boolean attribute / data.decorative',
      description: 'No role, aria-hidden: for an orb beside words that already say what is happening.',
    },
    {
      name: 'motion',
      type: 'attribute / data.motion: "system" | "reduce" | "full"',
      default: '"system"',
      description:
        'system follows prefers-reduced-motion; reduce is always the still frame (t = 0.6, upstream’s); full always moves.',
    },
    { name: 'lang', type: '"en" | "ko"', default: '"en"', description: 'The per-state labels in Korean.' },
    {
      name: 'options · label · resolvedTheme · running',
      type: 'read-only',
      description:
        'What it draws with now (clamped), the label it announces, the substrate it resolved, and whether the frame loop is scheduled.',
    },
    {
      name: 'orbOptions · orbPlan · orbFit · orbSizeOf · orbParseTint · resolveOrbPreset · ORB_MODE_FRAMES · ORB_PRESETS · orbScaleCounts · orbScaleRadii · orbCountDots · orbFinalizeFrame · orbMakeProj · orbPaintFrame …',
      type: 'helpers',
      description:
        'Pure: option resolution, the draw plan for a state × size, the fit in a box, the tint parser, and upstream’s whole engine — nine frame functions returning z-sorted dot (and line) lists, the presets and their scalers — to drive your own canvas.',
    },
  ],
  events: [],
  keyboard: [],
  a11y: [
    'A loader: role="status" named by the state’s label (Searching…, 검색 중… with lang="ko"), or `label`; the same words sit inside as visually hidden text, so a change of state is announced politely.',
    '`decorative`: no role and aria-hidden — use it when words beside the orb already carry the status (and put role="status" on them, once).',
    'Not focusable and nothing to operate. The canvas is aria-hidden; the words are the meaning.',
    'Reduced motion (prefers-reduced-motion, or motion="reduce"): one still, representative frame (t = 0.6) that still follows the theme. motion="full" opts out.',
    'No idle frames: the loop runs only onscreen, in a shown tab and unpaused; every orb reads one shared clock, so pausing and resuming lands back in phase.',
  ],
  usage: `<ui-thinking-orb state="searching"></ui-thinking-orb>
<ui-thinking-orb state="solving" size="20" lang="ko"></ui-thinking-orb>

<!-- Beside words that already say it: decorative, and the status on the words. -->
<span role="status"><ui-thinking-orb state="composing" size="20" decorative></ui-thinking-orb> Composing a reply…</span>

<script type="module">
  import '@2lab.ai/ui/thinking-orb';
  const orb = document.querySelector('ui-thinking-orb');
  // The run's phase picks the verb.
  run.on('phase', (p) => { orb.data = { state: p === 'tool' ? 'working' : p === 'search' ? 'searching' : 'breathing' }; });
</script>`,
  demos: [
    {
      id: 'states',
      title: 'Nine states',
      description: 'Every state at 64, with the label it announces.',
      height: 380,
      create: () =>
        grid(
          3,
          ...STATES.map((s) => {
            const el = orb({ state: s });
            return figure(el, `${s} · ${el.label}`);
          }),
        ),
    },
    {
      id: 'pills',
      title: 'In the dashboard’s status pills',
      description:
        'The run’s status line: a 64 orb drawn at 48px in a hero pill, and 20s in compact chips. The words carry the status (role="status" on the pill), so each orb is decorative.',
      height: 300,
      create: () => {
        const top = row(
          14,
          pill('solving', 'Solving the failing test…', 64),
          pill('composing', 'Composing a reply…', 64),
        );
        const chips = row(
          10,
          pill('listening', 'Agent listening…'),
          pill('searching', 'Searching 3 repos…'),
          pill('connecting', 'Connecting to GitHub…'),
          pill('weaving', 'Planning…'),
          pill('breathing', 'Thinking…'),
          pill('shaping', 'Shaping the UI…'),
        );
        const w = box('div', '');
        w.append(top, chips);
        return w;
      },
    },
    {
      id: 'sizes',
      title: 'Three tuned sizes',
      description:
        '64, 32 and 20 — separate designs, each with its own dot count, dot size and speed — and a 20 design drawn at 64px, still crisp.',
      height: 260,
      create: () =>
        row(
          26,
          figure(orb({ state: 'searching', size: 64 }), '64'),
          figure(orb({ state: 'searching', size: 32 }), '32'),
          figure(orb({ state: 'searching', size: 20 }), '20'),
          figure(orb({ state: 'searching', size: 20 }, {}, 'width:64px;height:64px'), '20 at 64px'),
          figure(orb({ state: 'working', size: 32 }), 'working · 32'),
          figure(orb({ state: 'working', size: 20 }), 'working · 20'),
        ),
    },
    {
      id: 'tint',
      title: 'Tint, density and dot size',
      description:
        'color keeps the depth ramp on the tint; dots and dotSize rescale with the presets’ own scalers. speed 0.5 on the last.',
      height: 260,
      create: () =>
        row(
          22,
          figure(orb({ state: 'listening', color: '#7cd4ff' }), '#7cd4ff'),
          figure(orb({ state: 'composing', color: '#ffd28f' }), '#ffd28f'),
          figure(orb({ state: 'connecting', color: '#ff9ec9' }), '#ff9ec9'),
          figure(orb({ state: 'searching', dots: 2, dotSize: 0.7 }), 'dots 2 · dotSize 0.7'),
          figure(orb({ state: 'weaving', dots: 0.5, dotSize: 1.5, speed: 0.5 }), 'dots 0.5 · dotSize 1.5'),
        ),
    },
    {
      id: 'theme',
      title: 'It reads the surface',
      description: 'theme="auto" in a light and a dark panel on the same page: light ink on dark, dark ink on light.',
      height: 240,
      create: substrates,
    },
    {
      id: 'ko-still',
      title: 'Korean, paused and still',
      description:
        'lang="ko" labels; a paused orb holds its frame; motion="reduce" is the still frame; a custom label names the work.',
      height: 240,
      create: () => {
        const ko = orb({ state: 'solving' }, { lang: 'ko' });
        const paused = orb({ state: 'listening', paused: true }, { lang: 'ko' });
        const still = orb({ state: 'shaping' }, { lang: 'ko', motion: 'reduce' });
        const named = orb({ state: 'searching', label: '저장소를 분석하는 중…' }, { lang: 'ko' });
        return row(
          26,
          figure(ko, `solving · ${ko.label}`, 'ko'),
          figure(paused, 'paused', 'ko'),
          figure(still, 'motion="reduce"', 'ko'),
          figure(named, named.label, 'ko'),
        );
      },
    },
  ],
};
