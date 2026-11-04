/**
 * The owner badge — a name pill in one of eight hues, shared by `<ui-agent-inbox>`'s card head (shadow DOM) and the
 * kit's `.ui-owner-badge` (light DOM), so a person's pill reads the same on the board and on a host's own surface
 * (the dashboard's detail card).
 *
 * `.is-self` marks the viewer's own pill: a ring in its hue at rest (2px), and a bright arc that keeps orbiting the ring —
 * the one moving pill on a board of everyone's work. Under reduced motion the arc goes and the ring stays, stronger; forced
 * colours get a system outline (backgrounds and the arc are dropped there). Every colour is a `color-mix()` of the
 * theme's tokens, so one rule holds in light and dark.
 */

/** Owner badge colour slots (`data-hue` 0–7). */
export const OWNER_BADGE_HUES = 8;

/** One orbit of the self arc. */
export const OWNER_BADGE_ORBIT_MS = 2400;

/**
 * The orbit keyframes this package draws — the board's (`ib-badge`) and the kit's (`ui-owner-badge`). A host that calls
 * `ownerBadgeCss` with its own prefix passes its own `<prefix>-orbit` to `syncOwnerBadgeOrbit`.
 */
export const OWNER_BADGE_ORBITS: readonly string[] = ['ib-badge-orbit', 'ui-owner-badge-orbit'];

/**
 * Puts a self pill's arc on the document's shared orbit: every orbit animation on `el` (its ::before) starts at the
 * timeline's origin, so its turn is `document.timeline.currentTime % OWNER_BADGE_ORBIT_MS` wherever and whenever the
 * pill was drawn — every self pill on the page moves in step (the board's and a host's), and one drawn again mid-orbit
 * carries on from where the old one was. Call it once the pill is in the document (a detached element has no CSS
 * animation yet), and again whenever the browser may have restarted the arc: the pill was moved (re-inserted) or shown
 * again after display: none. Nothing without the Web Animations API or under reduced motion (no arc, no animation);
 * only the named orbits are touched — any other animation on the pill is left alone.
 */
export function syncOwnerBadgeOrbit(el: Element, names: readonly string[] = OWNER_BADGE_ORBITS): void {
  if (typeof el.getAnimations !== 'function') return;
  for (const a of el.getAnimations({ subtree: true })) {
    if (names.includes((a as CSSAnimation).animationName)) a.startTime = 0;
  }
}

/**
 * The badge's look for `selector` (its layout — margins, the width cap — stays with the host), reading tokens
 * through `v(name)` (`var(--name)` inside a shadow root, `var(--ui-name)` on a page). `prefix` names the custom
 * properties and the keyframes so two copies never collide. A selector list (`.a, .b`) is wrapped in `:is()` so the
 * state and pseudo-element suffixes apply to every member.
 */
export function ownerBadgeCss(selectorList: string, v: (name: string) => string, prefix: string): string {
  const selector = selectorList.includes(',') ? `:is(${selectorList})` : selectorList;
  const hue = `--${prefix}-hue`;
  const H = `var(${hue})`;
  const card = v('ib-card');
  const text = v('ib-text');
  const mix = (a: string, pct: number, b: string): string => `color-mix(in srgb, ${a} ${pct}%, ${b})`;
  // The arc's head: the hue pulled toward ink — deeper than the ring in light, brighter than it in dark.
  const head = mix(H, 70, text);
  const hues = [
    v('accent'),
    v('yellow'),
    v('green'),
    v('red'),
    mix(v('accent'), 50, v('green')),
    v('orange'),
    v('purple'),
    mix(v('yellow'), 55, v('green')),
  ];
  return `
${selector} {
  padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; line-height: 1.35;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  ${hue}: ${hues[0]};
  background: ${mix(H, 18, card)};
  color: ${mix(H, 55, text)};
}
${hues
  .slice(1)
  .map((c, i) => `${selector}[data-hue="${i + 1}"] { ${hue}: ${c}; }`)
  .join('\n')}
/* Yours: the pill's own background is the ring (a light step of its hue, so the arc stands out on it); ::after lays the tint inside it, 2px in, and
   ::before is the arc — a comet of the hue pulled toward ink, turning under the tint, so only the ring shows it. The text stays on
   top (isolation: the pseudo-elements sit below the pill's content, above its background). */
${selector}.is-self {
  position: relative; isolation: isolate;
  background: ${mix(H, 32, card)};
}
${selector}.is-self::after {
  content: ''; position: absolute; inset: 2px; z-index: -1; border-radius: inherit;
  background: ${mix(H, 22, card)};
}
${selector}.is-self::before {
  content: ''; position: absolute; z-index: -1; left: 50%; top: 50%; width: calc(100% + 24px); aspect-ratio: 1;
  background: conic-gradient(from 0turn, transparent 0turn 0.35turn, ${mix(head, 30, 'transparent')} 0.65turn, ${head} 0.95turn, transparent 0.95turn);
  transform: translate(-50%, -50%) rotate(0turn);
  animation: ${prefix}-orbit ${OWNER_BADGE_ORBIT_MS}ms linear infinite;
}
@keyframes ${prefix}-orbit { to { transform: translate(-50%, -50%) rotate(1turn); } }
/* Reduced motion: no arc; the ring alone, stronger, still says "yours". */
@media (prefers-reduced-motion: reduce) {
  ${selector}.is-self { background: ${mix(H, 60, card)}; }
  ${selector}.is-self::before { animation: none; display: none; }
}
@media (forced-colors: active) {
  ${selector}.is-self { outline: 2px solid Highlight; outline-offset: -2px; }
  ${selector}.is-self::before, ${selector}.is-self::after { display: none; }
}
`;
}
