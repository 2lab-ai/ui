/**
 * `@2lab.ai/ui/sound-cuelume` — plays the elements' cues with Cuelume (MIT, Daniel Belyi —
 * https://github.com/danielwh2/cuelume): fourteen interface sounds synthesized live with Web Audio, no audio files.
 * Cuelume 0.2.8 is bundled into this module at build time, so the package keeps zero runtime dependencies and the
 * flat `dist/sound-cuelume.js` loads in a page without a bundler. Import this module only when the user turns sound
 * on: the policy in `@2lab.ai/ui/sound` loads nothing by itself.
 *
 * Mapping and button material follow Morphin UI's `sound-cuelume` (MIT, Ivan Oliinyk).
 */
import { play, setTheme, setVolume, unlock } from 'cuelume';
import type { SoundPlayer } from './sound';

/** Cuelume's materials for every cue. */
export type SoundTheme = 'default' | 'mech' | 'bubble' | 'press';
export const SOUND_THEMES: readonly SoundTheme[] = ['default', 'mech', 'bubble', 'press'];
/** A material of their own for button taps: `mech` a dry shutter click, `bubble` a playful knock. */
export type SoundButtonTheme = 'mech' | 'bubble';

let buttonTheme: SoundButtonTheme | undefined;

/**
 * The Cuelume player — pass it to `setSound({ player: cuelumeSound, enabled })`. A button's `tap` sounds like
 * Cuelume's `select`, the crisp woody detent the tabs use, in place of its glassy `tap`, unless
 * `setSoundButtonTheme` gives buttons a material of their own.
 */
export const cuelumeSound: SoundPlayer = (cue, options) => {
  if (cue !== 'tap') play(cue, options);
  else if (buttonTheme) play('tap', { ...options, theme: buttonTheme });
  else play('select', { ...options, emphasis: 'subtle' });
};

/** Gives every button press one material, whatever the rest of the sounds use; `undefined` goes back to the detent. */
export function setSoundButtonTheme(theme: SoundButtonTheme | undefined): void {
  buttonTheme = theme === 'mech' || theme === 'bubble' ? theme : undefined;
}

/**
 * Starts audio now. Call it from the click that turns sound on: some browsers only start audio inside a user
 * gesture, and a cue played later from code (a toast for a finished run) would stay silent. Resolves `true` once
 * cues can sound. Never rejects.
 */
export function unlockSound(): Promise<boolean> {
  return unlock();
}

/** The material of every cue: `default`, `mech`, `bubble` or `press`. Unknown names are ignored. */
export function setSoundTheme(theme: SoundTheme): void {
  if (SOUND_THEMES.includes(theme)) setTheme(theme);
}

/** A volume multiplier, 0 to 1, for every cue. */
export function setSoundVolume(volume: number): void {
  setVolume(volume);
}
