import type { ComponentDoc } from '../../docs/types';
import './bot-avatar';
import type { BotAvatarData, UiBotAvatar } from './bot-avatar';
import { botAvatarFor } from './bot-avatar';
import { botAvatarPresets, botAvatarTypes } from './engine/presets';
import type { BotAvatarState, BotAvatarType } from './engine/types';

function avatar(data: BotAvatarData = {}, attrs: Record<string, string> = {}): UiBotAvatar {
  const el = document.createElement('ui-bot-avatar');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.data = data;
  return el;
}

function text(tag: string, value: string, css: string): HTMLElement {
  const el = document.createElement(tag);
  el.style.cssText = css;
  el.textContent = value;
  return el;
}

const NAME = 'font-size:13px;font-weight:600;color:var(--ui-text);line-height:1.3';
const QUIET = 'font-size:12.5px;color:var(--ui-text-secondary);line-height:1.4';

/** Runs `fn` every `ms` while `el` is on the page; stops for good once it has left (the demo was switched). */
function every(el: HTMLElement, ms: number, fn: () => void): void {
  let seen = false;
  const id = setInterval(() => {
    if (el.isConnected) {
      seen = true;
      fn();
    } else if (seen) clearInterval(id);
  }, ms);
}

/** The team, large and idle; a hovered one gets to work. */
function team(): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:28px 40px;padding:28px 8px 12px';
  const seats: Array<[BotAvatarType, string, string?]> = [
    ['clover', 'Clover'],
    ['flower', 'Flower'],
    ['ghost', 'Ghost'],
    ['square', 'Square', botAvatarPresets.puddle.color],
  ];
  for (const [shape, name, color] of seats) {
    const seat = document.createElement('div');
    seat.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px';
    const bot = avatar({ shape, color, size: 96, label: name });
    seat.addEventListener('pointerenter', () => {
      bot.data = { ...bot.data, state: 'working' };
    });
    seat.addEventListener('pointerleave', () => {
      bot.data = { ...bot.data, state: 'default' };
    });
    seat.append(bot, text('span', name, QUIET));
    row.append(seat);
  }
  return row;
}

/** A roster: each agent's face comes from its name (botAvatarFor), its state from what it is doing. */
function roster(lang: 'en' | 'ko' = 'en'): HTMLElement {
  const list = document.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:2px;max-width:420px;margin:0 auto';
  if (lang === 'ko') list.lang = 'ko';
  const agents: Array<[string, BotAvatarState, string]> =
    lang === 'ko'
      ? [
          ['배포 담당', 'working', '배포 점검 실행 중 — 18개 중 12개'],
          ['받은편지함 정리', 'default', '받은편지함 0, 초안 3개 보관'],
          ['야간 근무', 'sleeping', '오전 9시에 돌아와요'],
        ]
      : [
          ['Release captain', 'working', 'Running the deploy checks — 12 of 18'],
          ['Code reviewer', 'working', 'Reviewing #482, 2 comments so far'],
          ['Inbox triage', 'default', 'Inbox at zero, 3 drafts parked'],
          ['Night shift', 'sleeping', 'Back at 09:00'],
        ];
  for (const [name, state, status] of agents) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:14px;padding:10px 12px;border-radius:10px';
    // The name and the status are written beside it: the avatar is decorative here.
    const bot = avatar({ ...botAvatarFor(name), state, size: 36, decorative: true }, lang === 'ko' ? { lang } : {});
    const words = document.createElement('div');
    words.style.cssText = 'display:flex;flex-direction:column;min-width:0';
    words.append(text('span', name, NAME), text('span', status, QUIET));
    row.append(bot, words);
    list.append(row);
  }
  return list;
}

/** A thread: the bot works on the question, then answers — on a loop, so the switch between states shows. */
function chat(): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:14px;max-width:440px;margin:0 auto;padding:12px 4px';
  const ask = text(
    'div',
    'Can you summarise the thread with Acme?',
    'align-self:flex-end;max-width:80%;padding:8px 12px;border-radius:14px;font-size:13.5px;line-height:1.45;color:var(--ui-text);background:var(--ui-surface-raised)',
  );
  const turn = document.createElement('div');
  turn.style.cssText = 'display:flex;align-items:flex-start;gap:12px';
  const bot = avatar({ shape: 'flower', state: 'working', size: 32, label: 'Acme assistant' });
  const reply = text('p', 'Thinking…', `margin:6px 0 0;min-height:60px;font-size:13.5px;${QUIET}`);
  reply.setAttribute('aria-live', 'polite');
  turn.append(bot, reply);
  box.append(ask, turn);
  const answer =
    'They only sign annual, Dana approves, and pricing is the same thread as last quarter. I answered without waiting on you.';
  let working = true;
  every(box, 2900, () => {
    working = !working;
    bot.data = { ...bot.data, state: working ? 'working' : 'default' };
    reply.textContent = working ? 'Thinking…' : answer;
    reply.style.color = working ? 'var(--ui-text-secondary)' : 'var(--ui-text)';
  });
  return box;
}

/** One avatar, the three states and a hop: the switch is a cross-animation, never a snap. */
function states(): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:22px;padding:30px 8px 8px';
  const bot = avatar({ shape: 'circle', face: 'mouth', size: 120 });
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:8px';
  const buttons: HTMLButtonElement[] = [];
  const choices: Array<[BotAvatarState, string]> = [
    ['default', 'Idle'],
    ['working', 'Working'],
    ['sleeping', 'Sleeping'],
  ];
  for (const [state, label] of choices) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ui-btn is-sm';
    b.textContent = label;
    b.setAttribute('aria-pressed', String(state === 'default'));
    b.classList.toggle('is-primary', state === 'default');
    b.addEventListener('click', () => {
      bot.data = { ...bot.data, state };
      for (const x of buttons) {
        x.setAttribute('aria-pressed', String(x === b));
        x.classList.toggle('is-primary', x === b);
      }
    });
    buttons.push(b);
    bar.append(b);
  }
  const hop = document.createElement('button');
  hop.type = 'button';
  hop.className = 'ui-btn is-sm is-quiet';
  hop.textContent = 'Hop';
  hop.addEventListener('click', () => bot.poke());
  bar.append(hop);
  box.append(bot, bar);
  return box;
}

/** Every shape, still, at the palette's colours. */
function shapes(): HTMLElement {
  const grid = document.createElement('div');
  grid.style.cssText =
    'display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:20px 8px;padding:18px 4px 4px';
  for (const shape of botAvatarTypes) {
    const cell = document.createElement('div');
    cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px';
    cell.append(
      avatar({ shape, size: 48, paused: true, interactive: false, label: botAvatarPresets[shape].label }),
      text('span', shape, `font-family:var(--ui-mono);${QUIET}`),
    );
    grid.append(cell);
  }
  return grid;
}

/** The materials, and the things it can wear. */
function looks(): HTMLElement {
  const grid = document.createElement('div');
  grid.style.cssText =
    'display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:22px 8px;padding:22px 4px 4px';
  const items: Array<[string, BotAvatarData]> = [
    ['fabric', { shape: 'clover' }],
    ['plastic', { shape: 'clover', shading: 'plastic' }],
    ['crisp', { shape: 'clover', shading: 'crisp' }],
    ['smooth', { shape: 'clover', shading: 'smooth' }],
    ['flat', { shape: 'clover', shading: 'flat' }],
    ['plastic · beanie · round', { shape: 'triangle', shading: 'plastic', hat: 'beanie', glasses: 'round' }],
    ['crown · bow tie', { shape: 'star', hat: 'crown', bowTie: true }],
    ['headphones', { shape: 'flower', headphones: true, accessoryColor: '#f4efe6' }],
  ];
  for (const [name, data] of items) {
    const cell = document.createElement('div');
    cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center';
    cell.append(avatar({ size: 64, ...data }), text('span', name, QUIET));
    grid.append(cell);
  }
  return grid;
}

export const doc: ComponentDoc = {
  slug: 'bot-avatar',
  name: 'Bot Avatar',
  tag: 'ui-bot-avatar',
  summary:
    'Which agent is this, and is it working? — a soft 3D face per agent that idles, hops while it works and dozes when it sleeps.',
  description:
    'An animated avatar for an AI agent: one of eighteen soft 3D shapes with a living face — round eyes that blink and glance, an optional mouth — in one of three states: `default` (idle: it turns to look around, blinks, and now and then jumps and turns right round), `working` (it hops, every third hop a spin, with a wide smile and the odd laugh) and `sleeping` (head down, lids shut, slow breaths and the odd nod). A state change is a cross-animation from the old pose to the new on a timed curve. Plush fur by default, glossy plastic with `shading="plastic"`, or crisp, smooth and flat vector looks; a hat, glasses, headphones and a bow tie to wear. The eyes follow a pointer that comes near and a click makes it hop. `botAvatarFor(name)` gives an agent a stable face from its name. Drawn on a 2D canvas (no WebGL) by the bot-avatars engine; every avatar on the page shares one frame loop, which runs only while an avatar animates on screen in a shown tab.',
  usedIn:
    'Not yet in the dashboard. Its natural place: the agent’s face in the session list and the conversation header (working while a run streams, idle when it waits, sleeping when the session is parked), and the roster of agents in agent-inbox.',
  reference: { name: 'Libraries.dev — Bot avatars (bot-avatars 0.2.2, MIT)', url: 'https://libraries.dev/bots' },
  group: 'Effects',
  props: [
    {
      name: 'shape',
      type: 'attribute / data.shape: clover · flower · triangle · square · blob · ghost · circle · drop · star · droid · mech · alien · hexagon · cat · cloud · pill · pebble · puddle',
      default: '"clover"',
      description:
        'The body, each with its own colour and face placement. data.type (the React prop’s name) is read too. An unknown name is clover.',
    },
    {
      name: 'state',
      type: 'attribute / data.state: "default" | "working" | "sleeping"',
      default: '"default"',
      description:
        'What the agent is doing. "idle" means "default". A change eases from the old pose to the new (0.7 s to working, 1.2 s back to idle, 1.4 s to sleep).',
    },
    {
      name: 'color',
      type: 'attribute / data.color: string',
      default: 'the shape’s palette colour',
      description:
        'The body colour: #rgb, #rrggbb, rgb() or hsl(), or a shape’s name to borrow its palette colour (color="puddle"). Anything else is the shape’s own. The face ink follows (light on a dark body) unless data.ink is set.',
    },
    {
      name: 'size',
      type: 'attribute / data.size: number (px)',
      default: '64',
      description:
        'The box, 12 … 512. The element lays out exactly that square; the canvas overscans it (1.5×) so a hop or a flip is never clipped.',
    },
    {
      name: 'face',
      type: 'attribute / data.face: "eyes" | "mouth"',
      default: 'the shape’s ("eyes")',
      description: 'mouth adds a small mouth that changes with the state: a smile, an open mouth, a sleeping “o”.',
    },
    {
      name: 'shading',
      type: 'attribute / data.shading: "fabric" | "plastic" | "crisp" | "smooth" | "flat"',
      default: '"fabric"',
      description:
        'fabric — a plush faux fur under a studio light; plastic — glossy, shaded per pixel; crisp — a lit rim with a clean edge; smooth — a soft shadow and highlight; flat — the depth alone. fabric and plastic bake their material once per shape on idle time (shared by every avatar): the avatar waits invisible until it is made — 4 s at most — then fades in with the others.',
    },
    {
      name: 'label',
      type: 'attribute / data.label: string',
      description:
        'The accessible name — the agent’s (“Release captain”). The state is said after it: “Release captain, working”. Default “AI agent avatar” (AI 에이전트 아바타).',
    },
    {
      name: 'decorative',
      type: 'boolean attribute / data.decorative',
      description:
        'Hidden from assistive tech (aria-hidden, no role): use it where the name and status are written beside it.',
    },
    {
      name: 'paused · interactive · seed',
      type: 'attributes / data.paused: boolean · data.interactive: boolean (default true) · data.seed: 0 … 1',
      description:
        'paused freezes it on the current frame (and leaves the loop). interactive="false" turns off pointer play (the eyes following the pointer, the hop on click). seed offsets the blink and glance loops; by default each instance has its own, so a row never blinks in unison — pass the same seed to two to move them in step.',
    },
    {
      name: 'motion',
      type: 'attribute / data.motion: "system" | "reduce" | "full"',
      default: '"system"',
      description:
        'system follows prefers-reduced-motion; reduce draws the state’s still pose (no loop, no hop); full always moves.',
    },
    {
      name: 'theme',
      type: 'attribute / data.theme: "auto" | "dark" | "light"',
      default: '"auto"',
      description:
        'The surface it sits on, for the whirl’s colour (white on dark, black on light). auto reads the nearest data-theme (through shadow roots), then prefers-color-scheme.',
    },
    {
      name: 'lang',
      type: '"en" | "ko"',
      default: '"en"',
      description: 'The built-in name and the state words in Korean.',
    },
    {
      name: 'data.ink · data.brightness · data.saturation',
      type: 'string · number (0 … 2) · number (0 … 2.5)',
      description:
        'The face ink; the body colour’s lightness (1 as the palette has it) and saturation (default 1.5, or the shape’s own; past 1.5 more vivid, the light keeps its colour).',
    },
    {
      name: 'data.hat · data.glasses · data.headphones · data.bowTie · data.accessoryColor',
      type: '"none" | "beret" | "beanie" | "party" | "crown" · "none" | "round" | "square" | "shades" · boolean · boolean · string',
      description:
        'Things to wear, each a small lit 3D object that turns with the head. accessoryColor colours the hat, headphones and bow tie (a soft black by default; the crown stays gold).',
    },
    {
      name: 'data.speed · data.turn · data.pose · data.path',
      type: 'number (0 … 5) · number (0 … 2) · { yaw?, pitch?, roll? } (radians) · string',
      description:
        'speed multiplies every animation (0 holds it still); turn scales how far the head turns while idle; pose holds the body at an orientation over the animation; path is a custom outline (SVG path data in the 100×100 body box, centred on 50, 50).',
    },
    {
      name: 'data.shadow · highlight · light · depth · roundness · rim · spread · backLight · lightFront · shine · sheen · backSoftness',
      type: 'numbers',
      description:
        'The light, as in bot-avatars: strengths 0 … 2, light and backLight in degrees clockwise from the top, depth 0.2 … 2, roundness 0 … 1, spread 0.4 … 2.5, lightFront 0 … 85°. Defaults depend on the material.',
    },
    {
      name: 'data.furLength · furDensity · furFuzz · furClumps · furCurl · furGravity',
      type: 'numbers',
      default: '1 · 1.6 · 0.9 · 0.4 · 0.7 · 0.9',
      description: 'The plush pile’s style (fabric): each style bakes once per shape and is shared.',
    },
    {
      name: 'data.whirl · whirlSize · whirlWidth · whirlLength · whirlTilt',
      type: 'numbers',
      default: '0 (off) · 1 · 1 · 1 · 1',
      description: 'A puff of motion round a spin, in the body’s own material.',
    },
    {
      name: 'data.jumpHeight · jumpTime · jumpStretch · jumpSquash · jumpSquashTime · jumpSquashEase · jumpGroundTime · jumpGroundEase · jumpRiseTime · jumpRiseEase · jumpClickSquashTime · jumpSpin · jumpLean · jumpEvery · jumpLand',
      type: 'numbers; eases "sharp" | "pulse" | "soft" | "bouncy"',
      default: '26 · 0.68 · 1 · 1.15 · 0.37 · pulse · 0.11 · pulse · 0.33 · pulse · 0.24 · 1 · 6 · 8 · 0',
      description: 'The jump (an idle flip, a click): as in bot-avatars. jumpEvery 0 turns the idle jumps off.',
    },
    {
      name: 'poke()',
      type: 'method',
      description: 'A hop and a full turn, now, in any state (what a click does). Nothing while paused, held or still.',
    },
    {
      name: 'options · running · shown · fallback',
      type: 'BotAvatarOptions · boolean · boolean · boolean (read-only)',
      description:
        'What it draws with now (clamped); whether it is in the shared frame loop; whether it is on screen (its material made); whether the still SVG stands in (no 2D canvas).',
    },
    {
      name: 'botAvatarFor(name)',
      type: '(name: string) => { shape, color, seed }',
      description:
        'A stable face for an agent or a model: the same name (trimmed, any case) always gives the same shape, palette colour and blink seed. el.data = { ...botAvatarFor(agent.name), state }. Not in bot-avatars, which seeds only the blink timing from the React id.',
    },
    {
      name: 'botAvatarSvg(options) · botAvatarColor · botAvatarBody',
      type: 'helpers',
      description:
        'Pure: the still SVG the element shows without a canvas (escaped, for a static or server-drawn avatar); a colour the engine can shade (or a shape’s palette colour); the body colour after brightness and saturation.',
    },
  ],
  events: [],
  keyboard: [],
  a11y: [
    'role="img" named by label and the state — “Release captain, working” — or “AI agent avatar, idle” by default (lang="ko": “AI 에이전트 아바타, 대기 중”). A state change renames it in place; the canvas itself is aria-hidden.',
    '`decorative` hides it (aria-hidden="true", no role): the right choice in a roster or a message where the agent’s name and status are written beside it.',
    'Not focusable and no keyboard path: the click hop is play, carrying no information. The click is the host element’s own, so the overscanned canvas never covers a neighbour’s target.',
    'Reduced motion (prefers-reduced-motion, or motion="reduce"): the state’s still pose, no loop, no hop; the fade-in is instant.',
    'No idle CPU: all avatars share one frame loop; an avatar joins it only while it animates (not paused, motion not reduced) and is on screen, and the loop stops while none does and in a hidden tab. A disconnected avatar leaves the loop, drops its observers and bake waits, and lets its canvas’s backing store go.',
    'Without a 2D canvas (or should the engine ever fail) a still SVG of the shape, its colour and its resting face stands in — never an error.',
    'Sound (opt-in, @2lab.ai/ui/sound): a click that makes it hop plays a subtle tap; state changes the app makes are silent.',
  ],
  usage: `<ui-bot-avatar shape="clover" state="working" label="Release captain"></ui-bot-avatar>
<ui-bot-avatar shape="ghost" state="sleeping" size="32" decorative></ui-bot-avatar>
<script type="module">
  import { botAvatarFor } from '@2lab.ai/ui/bot-avatar';
  const face = document.querySelector('#agent-face');
  // A stable face from the agent's name; the state follows the run.
  face.data = { ...botAvatarFor(agent.name), label: agent.name, size: 36, state: 'default' };
  run.on('start', () => { face.data = { ...face.data, state: 'working' }; });
  run.on('done', () => { face.data = { ...face.data, state: 'default' }; });
</script>`,
  demos: [
    {
      id: 'team',
      title: 'The team',
      description:
        'Four of them at 96 px, idle: they look around, blink and now and then jump and turn. Hover one and it gets to work; move the pointer near and the eyes follow; click one to make it hop.',
      height: 260,
      create: team,
    },
    {
      id: 'roster',
      title: 'An agent roster, faces from names',
      description:
        'Each face comes from botAvatarFor(agent name) — the same name, the same face, on every page. Two agents working, one idle, one asleep; the avatars are decorative because the name and the status are written beside them.',
      height: 320,
      create: () => roster('en'),
    },
    {
      id: 'chat',
      title: 'Thinking, then answering',
      description:
        'A thread: the bot works on the question (hopping), then settles back to idle with the answer — on a loop, so the cross-animation between the states shows.',
      height: 240,
      create: chat,
    },
    {
      id: 'states',
      title: 'States, a mouth and a hop',
      description:
        'face="mouth" at 120 px. Switch the state: a smile at idle, an open mouth while it works, an “o” while it sleeps — each switch eases from one pose to the next. Hop calls poke().',
      height: 320,
      create: states,
    },
    {
      id: 'shapes',
      title: 'Eighteen shapes',
      description: 'Every shape at its palette colour, paused at 48 px — paused avatars take no frames.',
      height: 420,
      create: shapes,
    },
    {
      id: 'looks',
      title: 'Plush or glossy, and things to wear',
      description:
        'The five shadings on one clover — fabric (the default), plastic, crisp, smooth, flat — then a beanie and round glasses on glossy plastic, a crown and a bow tie, and light headphones.',
      height: 380,
      create: looks,
    },
    {
      id: 'ko',
      title: '한국어',
      description:
        'lang="ko": the names and the state words in Korean. These are decorative beside their written names; on its own an avatar is named “AI 에이전트 아바타, 작업 중”.',
      height: 260,
      create: () => roster('ko'),
    },
  ],
};
