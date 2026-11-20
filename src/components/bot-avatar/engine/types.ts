/* The engine's types — bot-avatars 0.2.2 src/types.ts without the React props (MIT, © Jakub Antalik,
   https://libraries.dev/bots). The element's own data shape lives in ../bot-avatar.ts. */

/** The eighteen body shapes. */
export type BotAvatarType =
  | 'clover'
  | 'flower'
  | 'triangle'
  | 'square'
  | 'blob'
  | 'ghost'
  | 'circle'
  | 'drop'
  | 'star'
  | 'droid'
  | 'mech'
  | 'alien'
  | 'hexagon'
  | 'cat'
  | 'cloud'
  | 'pill'
  | 'pebble'
  | 'puddle';

/**
 * What the face is made of. The eyes alone by default; `mouth` adds a
 * small mouth that changes with the state.
 */
export type BotAvatarFace = 'eyes' | 'mouth';

/** What the bot is doing. Each state is a pose plus its own motion. */
export type BotAvatarState = 'default' | 'working' | 'sleeping';

/** How the landing squash of a jump plays out. */
export type BotAvatarSquashEase = 'sharp' | 'pulse' | 'soft' | 'bouncy';

/**
 * How the body is lit. `fabric` (default): a plush faux fur — a baked
 * pillow form under a studio light, fine strands combed down the form and
 * gathered into lit locks, the silhouette breaking into soft tufts with a
 * haze of hairs; the eyes turn into glossy beads. `plastic`: the same form
 * as a real glossy material shaded per pixel — a hot spot and a sheen, a
 * Fresnel rim, a window reflection, saturated shadows. `crisp`: a lit rim with
 * a clean edge round the front, vector-style. `smooth`: no edge, a soft
 * shadow and highlight across the whole form. `flat`: the depth alone, no
 * lighting.
 */
export type BotAvatarShading = 'crisp' | 'smooth' | 'plastic' | 'flat' | 'fabric';

/** Something to wear on the head. */
export type BotAvatarHat = 'none' | 'beret' | 'beanie' | 'party' | 'crown';

/** Something to wear over the eyes. */
export type BotAvatarGlasses = 'none' | 'round' | 'square' | 'shades';

export interface BotAvatarPreset {
  /** Display name, for labels and the default `aria-label`. */
  label: string;
  /** The type's own body colour. */
  color: string;
  /** The face the type ships with. */
  face: BotAvatarFace;
  /** Where the face sits, in the 100×100 body box. */
  faceX: number;
  faceY: number;
  /** Face scale: shapes with a small middle wear a smaller face. */
  faceScale: number;
  /** The type's own `brightness` and `saturation`, where the props leave
      them out (otherwise 1 and 1.5). */
  brightness?: number;
  saturation?: number;
}
