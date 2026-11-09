import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import tokens from './tokens.json';

// explainer/ (the 3Blue1Brown-style video kit) is outside the TS build. Its theme `mono-black` is read from the Modern
// Mono design by explainer/tools/new_video.py when a video project is made, so these token names are a contract.
const ROOT = resolve(__dirname, '../..');
const USED = ['bg', 'text', 'text-secondary', 'text-tertiary', 'surface', 'surface-raised', 'border'];
const HUES = ['yellow', 'green', 'red', 'orange', 'purple'];

describe('explainer kit', () => {
  it('finds every Modern Mono token the mono-black theme reads, as a #rrggbb value', () => {
    const design = (tokens.designs as Record<string, Record<string, string>>)['modern-mono'];
    for (const name of [...USED, ...HUES]) expect(design[name], name).toMatch(/^#[0-9a-f]{6}$/i);
    const script = readFileSync(resolve(ROOT, 'explainer/tools/new_video.py'), 'utf8');
    for (const name of [...USED, ...HUES]) expect(script, name).toContain(`t['${name}']`);
  });

  it('ships the engine, the player page and the pipeline tools', () => {
    for (const f of [
      'engine/engine.js',
      'engine/video.html',
      'tools/new_video.py',
      'tools/narrate_soma.py',
      'tools/padcut.py',
      'tools/ko_say.py',
      'tools/cwon_say.py',
      'tools/render_formulas.py',
      'tools/music.py',
      'tools/export.py',
      'examples/euler-identity/scenes.js',
      'examples/euler-identity/script.json',
    ])
      expect(existsSync(resolve(ROOT, 'explainer', f)), f).toBe(true);
  });

  it('keeps digits and Latin letters out of the hand-written say in the example (ko_say.py makes the rest)', () => {
    const script = JSON.parse(readFileSync(resolve(ROOT, 'explainer/examples/euler-identity/script.json'), 'utf8'));
    const says: string[] = script.scenes.flatMap((sc: { sentences: { say?: string }[] }) =>
      sc.sentences.map((s) => s.say).filter((s): s is string => typeof s === 'string'),
    );
    expect(says.length).toBeGreaterThan(0);
    expect(says.filter((s) => /[0-9A-Za-z]/.test(s))).toEqual([]);
  });

  it('keeps hard-coded colours out of the example scenes (they take the theme)', () => {
    const scenes = readFileSync(resolve(ROOT, 'explainer/examples/euler-identity/scenes.js'), 'utf8');
    expect(scenes.match(/'#[0-9a-f]{3,6}'|'rgba\(/gi) ?? []).toEqual([]);
  });
});
