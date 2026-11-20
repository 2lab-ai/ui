import type { ComponentDoc } from '../../docs/types';
import './border-beam';
import type { BorderBeamColorVariant, BorderBeamData, UiBorderBeam } from './border-beam';

function beam(child: HTMLElement, data: BorderBeamData = {}, attrs: Record<string, string> = {}): UiBorderBeam {
  const el = document.createElement('ui-border-beam');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  el.append(child);
  return el;
}

function box(tag: string, css: string, text = ''): HTMLElement {
  const el = document.createElement(tag);
  el.style.cssText = css;
  if (text) el.textContent = text;
  return el;
}

/** A stage that centres what it holds and lets a pulse-outside halo spill. */
function stage(gap = 28, ...kids: HTMLElement[]): HTMLElement {
  const s = box(
    'div',
    `display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:${gap}px;padding:28px 12px;overflow:visible`,
  );
  s.append(...kids);
  return s;
}

function caption(text: string): HTMLElement {
  return box(
    'p',
    'margin:8px 0 0;font-size:12px;line-height:1.4;color:var(--ui-text-tertiary);text-align:center',
    text,
  );
}

function figure(el: HTMLElement, text: string): HTMLElement {
  const f = box('div', 'display:flex;flex-direction:column;align-items:center');
  f.append(el, caption(text));
  return f;
}

const CARD =
  'box-sizing:border-box;background:var(--ui-surface-raised);border-radius:16px;box-shadow:inset 0 0 0 1px var(--ui-border);color:var(--ui-text)';
const CHIP =
  'display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 10px;border-radius:999px;font-size:12px;color:var(--ui-text-secondary);background:color-mix(in srgb, var(--ui-text) 5%, transparent);box-shadow:inset 0 0 0 1px var(--ui-border)';

/** The dashboard's composer: a real textarea and send button — the beam only decorates them. */
function composer(placeholder = 'Ask the agent to change something…'): HTMLElement {
  const card = box('div', `${CARD};width:420px;max-width:100%;border-radius:20px;padding:10px 10px 10px 12px`);
  const ta = document.createElement('textarea');
  ta.placeholder = placeholder;
  ta.rows = 3;
  ta.setAttribute('aria-label', 'Message the agent');
  ta.style.cssText =
    'display:block;width:100%;resize:none;border:0;outline:0;background:transparent;color:var(--ui-text);font:inherit;font-size:14px;line-height:1.45;padding:4px 2px';
  const row = box('div', 'display:flex;align-items:center;gap:8px;margin-top:6px;position:relative;z-index:5');
  const send = document.createElement('button');
  send.type = 'button';
  send.textContent = 'Send';
  send.style.cssText =
    'margin-left:auto;height:28px;padding:0 12px;border:0;border-radius:999px;font:inherit;font-size:12.5px;color:var(--ui-bg);background:var(--ui-text);cursor:pointer';
  row.append(box('span', CHIP, 'Agent · sonnet'), box('span', CHIP, 'Auto-approve'), send);
  card.append(ta, row);
  return card;
}

/** A run card: what the agent is doing right now. */
function runCard(title: string, lines: string[], width = 300): HTMLElement {
  const card = box('div', `${CARD};width:${width}px;max-width:100%;padding:16px 18px`);
  card.append(box('div', 'font-size:13px;font-weight:600;margin-bottom:8px', title));
  for (const l of lines) card.append(box('div', 'font-size:12.5px;line-height:1.7;color:var(--ui-text-secondary)', l));
  return card;
}

function iconButton(): HTMLElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', 'Stop the run');
  b.style.cssText = `${CARD};width:36px;height:36px;border:0;border-radius:20px;display:grid;place-items:center;cursor:pointer;padding:0`;
  b.append(box('span', 'display:block;width:11px;height:11px;border-radius:2px;background:var(--ui-text-secondary)'));
  return b;
}

function search(width = 360, placeholder = 'Search runs, files and memory'): HTMLElement {
  const wrap = box(
    'label',
    `${CARD};display:flex;align-items:center;gap:10px;width:${width}px;max-width:100%;height:42px;padding:0 14px;border-radius:21px`,
  );
  const glass = box('span', 'font-size:15px;color:var(--ui-text-tertiary)', '⌕');
  glass.setAttribute('aria-hidden', 'true');
  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = placeholder;
  input.setAttribute('aria-label', 'Search');
  input.style.cssText =
    'flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--ui-text);font:inherit;font-size:14px';
  wrap.append(glass, input);
  return wrap;
}

/** An opaque card with the host's own button: pulse-outside blooms behind it and spills past its edge. */
function planCard(): HTMLElement {
  const card = box('div', `${CARD};width:250px;padding:16px 18px;display:flex;flex-direction:column;gap:10px`);
  card.append(
    box('div', 'font-size:13px;font-weight:600', 'The plan is ready'),
    box('div', 'font-size:12.5px;color:var(--ui-text-secondary)', '4 steps · about 6 minutes'),
  );
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ui-btn';
  b.textContent = 'Run the plan';
  b.style.alignSelf = 'flex-start';
  card.append(b);
  return card;
}

function variants(): HTMLElement {
  const all: BorderBeamColorVariant[] = ['colorful', 'mono', 'ocean', 'sunset', 'forest', 'candy', 'ice', 'gold'];
  const grid = box(
    'div',
    'display:grid;grid-template-columns:repeat(4, minmax(0, 150px));gap:22px;justify-content:center;padding:22px 8px',
  );
  for (const v of all) {
    const card = box('div', `${CARD};height:74px;display:grid;place-items:center;font-size:12.5px;font-weight:600`, v);
    grid.append(beam(card, { colorVariant: v }));
  }
  return grid;
}

/** Play / pause: the toggle is the host's own button; the events land in a log under it. */
function playPause(): HTMLElement {
  const wrap = box('div', 'display:flex;flex-direction:column;align-items:center;gap:14px;padding:24px 8px');
  const el = beam(
    runCard('Refactoring the billing module', ['Reading 14 files', 'Planning 3 edits', 'Waiting for approval']),
    {
      size: 'pulse-inner',
      active: false,
    },
  );
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ui-btn';
  btn.textContent = 'Start the run';
  btn.setAttribute('aria-pressed', 'false');
  const log = box(
    'div',
    'min-height:18px;font-size:12px;color:var(--ui-text-tertiary);font-variant-numeric:tabular-nums',
  );
  log.setAttribute('aria-live', 'polite');
  let on = false;
  btn.addEventListener('click', () => {
    on = !on;
    el.data = { ...el.data, active: on };
    btn.textContent = on ? 'Pause the run' : 'Start the run';
    btn.setAttribute('aria-pressed', String(on));
  });
  el.addEventListener('ui-activate', () => {
    log.textContent = 'ui-activate — the glow has faded in';
  });
  el.addEventListener('ui-deactivate', () => {
    log.textContent = 'ui-deactivate — the glow has faded out';
  });
  wrap.append(el, btn, log);
  return wrap;
}

export const doc: ComponentDoc = {
  slug: 'border-beam',
  name: 'Border Beam',
  tag: 'ui-border-beam',
  summary:
    'Is the agent working on this? — a soft glow that rides the border of the card, button or input it wraps while something is happening there, and fades away when it stops.',
  description:
    'Wraps one element of the host page (a slot: the element keeps its role, focus and events) and puts light on its edge. The rotate family travels: `md` a full-border beam for cards and composers, `sm` a compact one for buttons, `line` a glow that runs along the bottom edge of a search bar. The pulse family breathes instead: `pulse-inner` inside the border, `pulse-outside` blooming beyond it (it wants an opaque element and room to spill). Eight colour variants, a dark and a light palette — `theme="auto"` follows the page (data-theme / data-design above it, the OS) — and `active` fades it in and out, with `ui-activate` / `ui-deactivate` when a fade completes. Pure CSS: one stylesheet per element of layered gradients, masks and filters, its custom properties registered once per document so they glide; the pulses breathe from one shared ~30 fps loop. No canvas, no WebGL — nothing to fall back from. It reads the slotted element’s own corner radius.',
  usedIn:
    'soma-work dashboard: the composer while a run streams (`md`), the Stop button of a running task (`sm`), the command bar while a search runs (`line`), and the approval card waiting on the person (`pulse-inner`).',
  reference: { name: 'Libraries.dev — Border Beam', url: 'https://libraries.dev/beam' },
  group: 'Effects',
  props: [
    {
      name: 'size',
      type: 'attribute / data.size: "md" | "sm" | "line" | "pulse-inner" | "pulse-outside"',
      default: '"md"',
      description:
        'md — a full-border beam (cards). sm — compact, for buttons. line — a glow travelling the bottom edge (search bars). pulse-inner — breathes inside the border. pulse-outside — blooms outward behind the element (needs an opaque element; uses its 1px border as the hairline).',
    },
    {
      name: 'colorVariant',
      type: 'attribute color-variant / data.colorVariant',
      default: '"colorful"',
      description:
        '"colorful" · "mono" · "ocean" · "sunset" · "forest" · "candy" · "ice" · "gold". Every variant but mono drifts its hue.',
    },
    {
      name: 'theme',
      type: 'attribute / data.theme: "auto" | "dark" | "light"',
      default: '"auto"',
      description:
        'The palette for the surface under it. auto follows the page: the nearest data-design / data-theme / .dark|.light above it, else the --text token, else the OS — and switches live. (The React library defaults to "dark".)',
    },
    {
      name: 'active',
      type: 'attribute / data.active: boolean',
      default: 'true',
      description:
        'false fades the beam out (0.5 s) and stops every frame; true fades it back in (0.6 s). As an attribute: active="false" turns it off.',
    },
    {
      name: 'strength',
      type: 'attribute / data.strength: number',
      default: '1',
      description: 'The beam layers’ opacity, 0 … 1. The slotted element is never dimmed.',
    },
    {
      name: 'duration',
      type: 'attribute / data.duration: number (s)',
      default: '1.96 · 3.1 (line) · 2.3 (pulse)',
      description: 'One rotation / one run of the line / one breath, 0.2 … 60.',
    },
    {
      name: 'borderRadius',
      type: 'attribute border-radius / data.borderRadius: number (px)',
      description:
        'The beam’s corner radius, 0 … 1000. Unset: the slotted element’s own border-top-left-radius, re-read when it changes; else the preset’s (16, or 32 for sm).',
    },
    {
      name: 'brightness · saturation',
      type: 'data.brightness · data.saturation: number',
      default: 'the preset’s (1.3 · 1.2 on dark)',
      description: 'Glow brightness and saturation multipliers, 0 … 5.',
    },
    {
      name: 'hueRange · staticColors',
      type: 'attribute hue-range / data.hueRange: number (°) · attribute static-colors / data.staticColors',
      default: '30 · false',
      description:
        'How far the hue drifts (the line caps it at 13°), or no drift at all. The pulses turn the full circle.',
    },
    {
      name: 'glowSize',
      type: 'attribute glow-size / data.glowSize: number',
      default: '1',
      description: 'Multiplies every glow blur, 0.1 … 5: tighter below 1, wider and softer above.',
    },
    {
      name: 'motion',
      type: 'attribute / data.motion: "system" | "reduce" | "full"',
      default: '"system"',
      description:
        'system follows prefers-reduced-motion; reduce is always a still frame (the beam stops on the top-right corner, the line rests mid-edge, the pulse at rest; fades stay as a crossfade); full always moves.',
    },
    {
      name: 'css',
      type: 'data.css: string',
      description:
        'Extra CSS after the beam’s own sheet, inside the shadow root; `{id}` becomes the instance id (`[data-beam="{id}"]`, keyframes `*-{id}`). Set as text, never parsed as markup.',
    },
    {
      name: '--beam-strength · --beam-stroke-opacity · --beam-inner-opacity · --beam-bloom-opacity · --beam-hue-base · --beam-spike-mul · --pulse-glow-boost · --beam-core-blur · --beam-bloom-blur · --beam-glow-brightness · --beam-glow-saturate',
      type: 'CSS custom properties on the element',
      description:
        'Upstream’s tuning hooks, inherited into the shadow root: per-layer opacity, a base hue, spike length, pulse-outside glow scale and blur.',
    },
    {
      name: '::part(beam) · ::part(bloom)',
      type: 'CSS parts',
      description: 'The wrapper (its ::before / ::after are the inner glow and the stroke) and the bloom layer.',
    },
    {
      name: 'options · resolvedTheme · active · running',
      type: 'read-only',
      description:
        'What it draws with now (clamped), the substrate it resolved, whether it is on (or fading), and whether a frame loop runs (the pulse driver, or an onscreen rotate beam’s keyframes).',
    },
    {
      name: 'beamOptions · beamStyleOptions · beamDuration · pulseGlowScale · beamSheet · splitPropertyRules · stillCss · generateBeamCSS · getPulseDriverConfig · pingPong · colorIsLight · ancestorSubstrate',
      type: 'helpers',
      description:
        'Pure: option resolution and clamping, the engine’s options for a size and substrate, the default cycle, pulse-outside’s glow scale, the finished sheet for a motion mode, the @property lift, the still pose, upstream’s CSS engine and pulse oscillators, and the substrate detection.',
    },
  ],
  events: [
    {
      name: 'ui-activate',
      detail: '{ active: true }',
      description: 'The fade-in finished (on mount when active, and after active turns true).',
    },
    {
      name: 'ui-deactivate',
      detail: '{ active: false }',
      description: 'The fade-out finished; the beam is off and draws nothing.',
    },
  ],
  keyboard: [],
  a11y: [
    'Decorative: the stroke, the inner glow and the bloom are pseudo-elements or an aria-hidden layer with pointer-events: none. The slotted element keeps its role, name, focus order and events — the beam never takes them.',
    'It says nothing on its own. When the glow means something (“the agent is working on this”), say it in the host’s markup too — a status line, aria-busy on the region — the beam is the picture of it, not the text.',
    'Reduced motion (prefers-reduced-motion, or motion="reduce"): a still frame — the rotate beam stopped on the top-right corner, the line at rest mid-edge, the pulse at its rest pose — and the fades stay as a crossfade. motion="full" opts out.',
    'No idle frames: off (active false) it draws nothing; offscreen (256px margin) every animation pauses; the pulses’ shared loop runs at ~30 fps only for pulse beams that are on, onscreen and in a shown tab, and stops when none are.',
  ],
  usage: `<ui-border-beam size="md" color-variant="colorful">
  <form class="composer">…</form>
</ui-border-beam>

<ui-border-beam size="sm" style="width: fit-content">
  <button type="button" aria-label="Stop the run">■</button>
</ui-border-beam>

<script type="module">
  import '@2lab.ai/ui/border-beam';
  const beam = document.querySelector('ui-border-beam');
  // Glow while the run streams; fade out when it settles.
  run.on('status', (s) => { beam.data = { active: s === 'running' }; });
  beam.addEventListener('ui-deactivate', () => console.log('the glow has faded out'));
</script>`,
  demos: [
    {
      id: 'composer',
      title: 'The composer while a run streams',
      description:
        'size="md" around the dashboard’s composer. The textarea and the Send button are the host’s own — focus them, type: the beam only decorates. The chips row sits above the beam layers (z-index 5), as upstream’s demo does.',
      height: 300,
      create: () => stage(0, beam(composer())),
    },
    {
      id: 'sizes',
      title: 'The rotate family: md, sm, line',
      description:
        'A run card (md), the Stop button of a running task (sm, a real <button>), and the command bar while a search runs (line). Each reads its element’s own corner radius.',
      height: 340,
      create: () =>
        stage(
          30,
          figure(beam(runCard('Deploying web-app', ['Building 3 packages', 'Uploading assets'], 240)), 'md'),
          figure(beam(iconButton(), { size: 'sm' }), 'sm'),
          figure(beam(search(), { size: 'line' }), 'line'),
        ),
    },
    {
      id: 'pulse',
      title: 'The pulse family: inner and outside',
      description:
        'pulse-inner breathes inside an approval card that waits on the person; pulse-outside blooms behind an opaque plan card and spills past its edge (the card’s 1px border is the hairline).',
      height: 320,
      create: () =>
        stage(
          56,
          figure(
            beam(runCard('Approve 3 file edits?', ['src/billing/invoice.ts', 'src/billing/tax.ts', 'README.md'], 260), {
              size: 'pulse-inner',
            }),
            'pulse-inner',
          ),
          figure(beam(planCard(), { size: 'pulse-outside' }), 'pulse-outside'),
        ),
    },
    {
      id: 'variants',
      title: 'Eight colour variants',
      description:
        'colorful, mono, ocean, sunset, forest, candy, ice, gold — md on the same card. Mono never drifts its hue.',
      height: 300,
      create: variants,
    },
    {
      id: 'play-pause',
      title: 'Play and pause',
      description:
        'active=false to start: the host’s button flips data.active; the glow fades in or out and the events land below when the fade completes. Off, it draws nothing.',
      height: 330,
      create: playPause,
    },
    {
      id: 'still',
      title: 'Reduced motion: a still frame',
      description: 'motion="reduce" on md, line and pulse-inner: the beam holds one pose and only fades.',
      height: 300,
      create: () =>
        stage(
          30,
          figure(beam(runCard('Indexing memory', ['812 of 1,204 notes'], 180), {}, { motion: 'reduce' }), 'md'),
          figure(beam(search(240, 'Search runs'), { size: 'line' }, { motion: 'reduce' }), 'line'),
          figure(
            beam(runCard('Waiting for you', ['1 question'], 170), { size: 'pulse-inner' }, { motion: 'reduce' }),
            'pulse-inner',
          ),
        ),
    },
  ],
};
