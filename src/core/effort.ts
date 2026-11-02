/**
 * Effort levels — the words and the text effects shared by `<ui-model-picker>` (shadow DOM) and the kit's
 * `.ui-effort` (light DOM), so a level reads the same on the trigger, in the menu and on a host page.
 *
 * The three strongest levels stand out by their text alone:
 *   - `xhigh` — a red single-hue gradient (still)
 *   - `max`   — a gold foil: a metallic sweep across the word
 *   - `ultra` — a holographic foil: an iridescent sweep across the word
 * Every stop is a `color-mix()` of the theme's tokens, so one rule holds in light and dark. The sweep stops under
 * reduced motion (the gradient stays), and forced colours get plain system text (a transparent fill would vanish).
 */

/** Every effort level, weakest first — the five standard ones, then `ultra` (offered only by models that list it). */
export const EFFORT_ORDER = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'];

/** Full names (sentences, aria labels). */
export const EFFORT_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
  ultra: 'Ultra',
};
/** Segment text (one short word). */
export const EFFORT_SHORT: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'XHigh',
  max: 'Max',
  ultra: 'Ultra',
};
/** Korean (lang="ko"): one word per level, the same in the segment and in sentences. */
export const EFFORT_LABELS_KO: Record<string, string> = {
  low: '낮음',
  medium: '보통',
  high: '높음',
  xhigh: '매우 높음',
  max: '최대',
  ultra: '울트라',
};

/**
 * `effort` carried over to a model that runs `levels`: unchanged when it runs it (or when nothing is known), else
 * the strongest level it runs that is not stronger, else its weakest — so a model switch never keeps a level the
 * new model cannot take.
 */
export function fitEffortLevel(levels: readonly string[], effort: string | undefined): string | undefined {
  if (!effort || levels.length === 0 || levels.includes(effort)) return effort;
  // `none` and `minimal` (codex) rank below `low`, so a model that runs them is never pushed up past them.
  const rank = (l: string): number => ['none', 'minimal', ...EFFORT_ORDER].indexOf(l);
  const known = levels.filter((l) => rank(l) >= 0).sort((a, b) => rank(a) - rank(b));
  if (known.length === 0) return levels[0];
  const below = known.filter((l) => rank(l) <= rank(effort));
  return below.length ? below[below.length - 1] : known[0];
}

/** The levels that carry a text effect. */
export const EFFORT_FX_LEVELS = ['xhigh', 'max', 'ultra'];

/**
 * The effect rules for `selector(level)`, reading tokens through `v(name)` (`var(--name)` inside a shadow root,
 * `var(--ui-name)` on a page). `prefix` names the keyframes so two copies never collide.
 */
export function effortTextCss(
  selector: (level: string) => string,
  v: (name: string) => string,
  prefix: string,
): string {
  const mix = (a: string, pct: number, b: string): string => `color-mix(in srgb, ${a} ${pct}%, ${b})`;
  const red = v('red');
  const text = v('ib-text');
  const card = v('ib-card');
  // Red, one hue: deep (pulled to ink) → the red → lighter (a fifth toward the card, so the tail stays legible).
  const xhigh = `linear-gradient(90deg, ${mix(red, 72, text)} 0%, ${red} 55%, ${mix(red, 80, card)} 100%)`;
  // Gold foil: amber → gold → a pale glint → gold → amber; the first and last stops match so the sweep loops.
  const goldDeep = mix(v('orange'), 55, v('yellow'));
  const gold = mix(v('yellow'), 80, text);
  const glint = mix(v('yellow'), 85, card);
  const max = `linear-gradient(105deg, ${goldDeep} 0%, ${gold} 22%, ${glint} 34%, ${gold} 46%, ${goldDeep} 62%, ${gold} 82%, ${goldDeep} 100%)`;
  // Holographic foil: the theme's hues in spectrum order, each pulled a little toward ink so the word stays legible.
  const holo = (name: string): string => mix(v(name), 78, text);
  const ultra = `linear-gradient(105deg, ${holo('purple')} 0%, ${holo('accent')} 17%, ${holo('green')} 33%, ${holo('yellow')} 50%, ${holo('orange')} 67%, ${holo('red')} 83%, ${holo('purple')} 100%)`;
  const clip =
    'color: transparent; -webkit-text-fill-color: transparent; -webkit-background-clip: text; background-clip: text;';
  const sel = (levels: string[]): string => levels.map(selector).join(', ');
  return `
${sel(EFFORT_FX_LEVELS)} { ${clip} background-repeat: repeat-x; }
${selector('xhigh')} { background-image: ${xhigh}; background-size: 100% 100%; }
${selector('max')} { background-image: ${max}; background-size: 200% 100%; animation: ${prefix}-foil 5.2s linear infinite; }
${selector('ultra')} { background-image: ${ultra}; background-size: 200% 100%; animation: ${prefix}-foil 3.6s linear infinite; }
@keyframes ${prefix}-foil { from { background-position: 0% 50%; } to { background-position: -200% 50%; } }
@media (prefers-reduced-motion: reduce) { ${sel(['max', 'ultra'])} { animation: none; } }
@media (forced-colors: active) {
  ${sel(EFFORT_FX_LEVELS)} { background: none; color: CanvasText; -webkit-text-fill-color: CanvasText; animation: none; }
}
`;
}
