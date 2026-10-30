import { afterEach, describe, expect, it, vi } from 'vitest';

const engine = vi.hoisted(() => ({
  play: vi.fn(),
  setTheme: vi.fn(),
  setVolume: vi.fn(),
  setEnabled: vi.fn(),
  unlock: vi.fn(async () => true),
}));
vi.mock('cuelume', () => engine);

import { cuelumeSound, SOUND_THEMES, setSoundButtonTheme, setSoundTheme, setSoundVolume, unlockSound } from './cuelume';

afterEach(() => {
  vi.clearAllMocks();
  setSoundButtonTheme(undefined);
});

describe('cuelumeSound — the Cuelume player', () => {
  it('passes every cue but tap straight to Cuelume, with its options', () => {
    cuelumeSound('open', { emphasis: 'subtle' });
    cuelumeSound('toggle', { direction: 'back' });
    cuelumeSound('type', { key: 'space' });
    expect(engine.play.mock.calls).toEqual([
      ['open', { emphasis: 'subtle' }],
      ['toggle', { direction: 'back' }],
      ['type', { key: 'space' }],
    ]);
  });
  it('a button tap is the tabs’ woody detent (subtle select) unless buttons have a material of their own', () => {
    cuelumeSound('tap', { input: 'mouse' });
    expect(engine.play).toHaveBeenLastCalledWith('select', { input: 'mouse', emphasis: 'subtle' });
    setSoundButtonTheme('mech');
    cuelumeSound('tap', { input: 'touch' });
    expect(engine.play).toHaveBeenLastCalledWith('tap', { input: 'touch', theme: 'mech' });
    setSoundButtonTheme('nope' as never);
    cuelumeSound('tap');
    expect(engine.play).toHaveBeenLastCalledWith('select', { emphasis: 'subtle' });
  });
  it('theme, volume and unlock go to the engine; unknown themes are ignored', async () => {
    expect([...SOUND_THEMES]).toEqual(['default', 'mech', 'bubble', 'press']);
    setSoundTheme('bubble');
    setSoundTheme('loud' as never);
    setSoundVolume(0.6);
    expect(engine.setTheme.mock.calls).toEqual([['bubble']]);
    expect(engine.setVolume).toHaveBeenCalledWith(0.6);
    await expect(unlockSound()).resolves.toBe(true);
    expect(engine.unlock).toHaveBeenCalledTimes(1);
  });
});
