/** Test helper (not shipped): a spy player for the elements' sound tests. */
import { resetSoundQueue, type SoundCue, type SoundOptions, setSound } from './sound';

export interface SoundSpy {
  /** Every cue the player got, with its options. */
  calls: Array<[SoundCue, SoundOptions | undefined]>;
  /** Just the cue names. */
  cues(): SoundCue[];
  /** Wait out the queue (a tap holds 24 ms for a richer cue), then start a fresh gesture. */
  settle(): Promise<void>;
  /** Silence the page again. */
  restore(): void;
}

/** Turn sound on with a recording player. Call `restore()` in afterEach. Works with real timers. */
export function soundSpy(opts: { typing?: boolean } = {}): SoundSpy {
  resetSoundQueue();
  const calls: SoundSpy['calls'] = [];
  setSound({ player: (cue, options) => calls.push([cue, options]), enabled: true, typing: !!opts.typing });
  return {
    calls,
    cues: () => calls.map((c) => c[0]),
    async settle() {
      await new Promise((r) => setTimeout(r, 40));
      resetSoundQueue();
    },
    restore() {
      setSound({ player: null, enabled: false, typing: false });
      resetSoundQueue();
    },
  };
}
