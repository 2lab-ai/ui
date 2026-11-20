import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reducedMotionOf, type UiDistortionWave, waveTypeOf } from './distortion-wave';
import { doc } from './docs';
import { defaultStyle, duration, PALETTES, singlePalette, waveFront } from './engine/model';
import {
  cssColorHex,
  mostlyOnScreen,
  playStatusWave,
  STATUS_WAVE_LOUD_MAX,
  STATUS_WAVE_MAX,
  type StatusWaveStatus,
  spectrumPalette,
  statusWaveOptions,
  statusWavesRunning,
  statusWaveTone,
  transitionWeight,
} from './status-wave';
import { styles } from './styles';

const XSS = '<img src=x onerror=alert(1)>';
const STATUSES: StatusWaveStatus[] = ['waiting', 'running', 'done', 'failed', 'idle'];

let reduce = false;
const realMatchMedia = window.matchMedia;
beforeEach(() => {
  document.body.innerHTML = '';
  reduce = false;
  window.matchMedia = ((q: string) => ({
    matches: q.includes('reduce') ? reduce : false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  document.body.innerHTML = '';
  window.matchMedia = realMatchMedia;
  vi.restoreAllMocks();
});

function mount(html = '<div>first</div>'): UiDistortionWave {
  const el = document.createElement('ui-distortion-wave');
  el.innerHTML = html;
  document.body.append(el);
  el.renderNow();
  return el;
}

/** A card the page shows (happy-dom lays nothing out: the box is given). */
function onScreenCard(id: string): HTMLElement {
  const card = document.createElement('div');
  card.id = id;
  card.style.position = 'relative';
  card.getBoundingClientRect = () =>
    ({ x: 10, y: 10, left: 10, top: 10, right: 310, bottom: 110, width: 300, height: 100, toJSON() {} }) as DOMRect;
  document.body.append(card);
  return card;
}

describe('engine (ported maths)', () => {
  it('every type has tuned defaults with a positive duration, center its own colours', () => {
    for (const t of ['vertical', 'horizontal', 'center'] as const) expect(duration(defaultStyle(t))).toBeGreaterThan(1);
    expect(defaultStyle('center').palette).toBe(PALETTES.green);
    expect(defaultStyle('vertical').palette).toBe(PALETTES.colorful);
  });

  it('the front clears the area by the end of its run and not at its start', () => {
    const s = defaultStyle('center');
    const src = { x: 100, y: 40, w: 20, h: 20 };
    expect(waveFront(0, src, 600, 160, s).hasCleared).toBe(false);
    expect(waveFront(1, src, 600, 160, s).hasCleared).toBe(true);
  });

  it('a single colour palette is lighter ahead of the front and deeper behind it', () => {
    const p = singlePalette([200, 100, 50]);
    expect(p.ahead[0]).toBeGreaterThan(200);
    expect(p.behind[0]).toBeLessThan(200);
  });
});

describe('helpers', () => {
  it('motion maps to the engine’s reduced-motion setting', () => {
    expect(reducedMotionOf('reduce')).toBe('always');
    expect(reducedMotionOf('full')).toBe('never');
    expect(reducedMotionOf('system')).toBe('system');
    expect(reducedMotionOf(null)).toBe('system');
    expect(reducedMotionOf(XSS)).toBe('system');
  });

  it('type falls back to vertical', () => {
    expect(waveTypeOf('center')).toBe('center');
    expect(waveTypeOf('horizontal')).toBe('horizontal');
    expect(waveTypeOf('spiral')).toBe('vertical');
    expect(waveTypeOf(undefined)).toBe('vertical');
  });

  it('cssColorHex reads hex and rgb() and refuses anything else', () => {
    expect(cssColorHex('#abc')).toBe('#aabbcc');
    expect(cssColorHex(' #2F63E0 ')).toBe('#2f63e0');
    expect(cssColorHex('#2f63e080')).toBe('#2f63e0');
    expect(cssColorHex('rgb(47, 99, 224)')).toBe('#2f63e0');
    expect(cssColorHex('rgba(300 2 10 / 0.5)')).toBe('#ff020a');
    expect(cssColorHex('oklch(0.6 0.1 250)')).toBeNull();
    expect(cssColorHex(XSS)).toBeNull();
    expect(cssColorHex(null)).toBeNull();
  });

  it('a card’s tone is its --st-color, else the status’s own colour', () => {
    const card = document.createElement('div');
    card.style.setProperty('--st-color', '#137a3e');
    document.body.append(card);
    expect(statusWaveTone(card, 'done')).toBe('#137a3e');
    expect(statusWaveTone(null, 'failed')).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('status wave presets', () => {
  it('ranks the transitions: needs you, failed, done, running, parked', () => {
    expect(transitionWeight('running', 'waiting')).toBeGreaterThan(transitionWeight('running', 'failed'));
    expect(transitionWeight('running', 'failed')).toBeGreaterThan(transitionWeight('running', 'done'));
    expect(transitionWeight('running', 'done')).toBeGreaterThan(transitionWeight('waiting', 'running'));
    expect(transitionWeight('waiting', 'running')).toBeGreaterThan(transitionWeight('done', 'idle'));
    for (const from of ['', ...STATUSES] as const)
      for (const to of STATUSES) {
        const w = transitionWeight(from, to);
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(1);
      }
  });

  it('loud is the event (longer, louder edge, dots where it celebrates); quiet is a glance (colour only, no dots)', () => {
    const len = (o: ReturnType<typeof statusWaveOptions>) =>
      duration({ ...defaultStyle(o?.type ?? 'center'), ...o?.waveStyle } as never);
    for (const to of STATUSES) {
      const loud = statusWaveOptions('loud', 'running', to);
      const quiet = statusWaveOptions('quiet', 'running', to);
      expect(loud).not.toBeNull();
      if (to === 'idle') {
        expect(quiet).toBeNull(); // a quiet card put to sleep gets no wave
        continue;
      }
      expect(quiet!.capture).toBe(false);
      expect(quiet!.waveStyle?.particleCount).toBe(0);
      expect(quiet!.waveStyle?.particleLife).toBe(0);
      expect(len(loud)).toBeGreaterThanOrEqual(len(quiet));
      expect(loud!.waveStyle?.rimStrength ?? 0).toBeGreaterThan(quiet!.waveStyle?.rimStrength ?? 0);
      // One family: the same ring, in CSS pixels, never following the views while out, no context made at rest.
      for (const o of [loud!, quiet!]) {
        expect(o.type).toBe('center');
        expect(o.scale).toBe(1);
        expect(o.live).toBe(false);
        expect(o.prewarm).toBe(false);
      }
      expect(len(quiet)).toBeLessThanOrEqual(1.4 + 1e-9);
      expect(len(loud)).toBeLessThanOrEqual(2.5 + 1e-9);
    }
    // The lens for the moments that matter; the most frequent change stays light even when loud.
    expect(statusWaveOptions('loud', 'running', 'waiting')!.capture).toBe(true);
    expect(statusWaveOptions('loud', 'running', 'done')!.capture).toBe(true);
    expect(statusWaveOptions('loud', 'waiting', 'running')!.capture).toBe(false);
    // A failure is serious, not festive: no dots, no colour split.
    const failed = statusWaveOptions('loud', 'running', 'failed')!;
    expect(failed.waveStyle?.particleCount).toBe(0);
    expect(failed.waveStyle?.aberration).toBe(0);
    // The celebration throws the most dots.
    const done = statusWaveOptions('loud', 'running', 'done')!;
    expect(done.waveStyle?.particleCount).toBeGreaterThan(
      statusWaveOptions('loud', 'x' as never, 'waiting')!.waveStyle!.particleCount!,
    );
  });

  it('a quiet wave is drawn in the new status’s colour; a loud one laces it with the spectrum (but not a failure)', () => {
    const q = statusWaveOptions('quiet', 'running', 'failed', '#d43a3a')!;
    expect(q.palette).toEqual(singlePalette([0xd4, 0x3a, 0x3a]));
    const l = statusWaveOptions('loud', 'running', 'done', '#137a3e')!;
    expect(l.palette).toEqual(spectrumPalette([0x13, 0x7a, 0x3e]));
    expect((l.palette as { colors: number[][] }).colors.filter((c) => c[0] === 0x13).length).toBe(4);
    const f = statusWaveOptions('loud', 'running', 'failed', '#d43a3a')!;
    expect(f.palette).toEqual(singlePalette([0xd4, 0x3a, 0x3a]));
  });

  it('theme, mono and a folded card adjust the numbers', () => {
    const light = statusWaveOptions('loud', 'running', 'waiting', '#c2780a', { dark: false })!;
    const dark = statusWaveOptions('loud', 'running', 'waiting', '#f5a524', { dark: true })!;
    expect(light.waveStyle!.strength!).toBeGreaterThan(dark.waveStyle!.strength!);
    expect(light.waveStyle!.strength!).toBeLessThanOrEqual(0.7);
    expect(light.waveStyle!.hairlineWhite).toBe(0.15);
    expect(dark.waveStyle!.hairlineWhite).toBe(0.9);
    const mono = statusWaveOptions('loud', 'running', 'waiting', '#c2780a', { chroma: 0 })!;
    expect(mono.waveStyle!.strength!).toBeCloseTo(light.waveStyle!.strength! / 2, 5);
    const folded = statusWaveOptions('loud', 'running', 'done', '#137a3e', { folded: true })!;
    expect(folded.capture).toBe(false);
    expect(folded.waveStyle!.rimWidth!).toBeLessThanOrEqual(2.5);
    expect(folded.waveStyle!.particleCount).toBe(0);
  });
});

describe('playStatusWave', () => {
  it('is null for a card off screen, a hidden tab, reduced motion, or no card', () => {
    const off = document.createElement('div');
    document.body.append(off);
    expect(playStatusWave({ card: off, emphasis: 'loud', to: 'done' })).toBeNull();
    const card = onScreenCard('c');
    reduce = true;
    expect(playStatusWave({ card, emphasis: 'loud', to: 'done' })).toBeNull();
    expect(playStatusWave({ card, emphasis: 'loud', to: 'done', motion: 'reduce' })).toBeNull();
    reduce = false;
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    expect(playStatusWave({ card, emphasis: 'quiet', to: 'done' })).toBeNull();
    hidden.mockRestore();
    const loose = document.createElement('div');
    expect(playStatusWave({ card: loose, emphasis: 'quiet', to: 'done' })).toBeNull();
  });

  it('runs at most STATUS_WAVE_MAX at once and STATUS_WAVE_LOUD_MAX loud; a loud one displaces a quiet one', () => {
    const runs = Array.from({ length: STATUS_WAVE_MAX }, (_, i) =>
      playStatusWave({ card: onScreenCard(`q${i}`), emphasis: 'quiet', to: 'running' }),
    );
    expect(runs.every(Boolean)).toBe(true);
    expect(statusWavesRunning()).toBe(STATUS_WAVE_MAX);
    expect(playStatusWave({ card: onScreenCard('late'), emphasis: 'quiet', to: 'done' })).toBeNull();
    const louds = Array.from({ length: STATUS_WAVE_LOUD_MAX }, (_, i) =>
      playStatusWave({ card: onScreenCard(`l${i}`), emphasis: 'loud', to: 'waiting' }),
    );
    expect(louds.every(Boolean)).toBe(true);
    expect(statusWavesRunning()).toBe(STATUS_WAVE_MAX);
    expect(playStatusWave({ card: onScreenCard('l-more'), emphasis: 'loud', to: 'done' })).toBeNull();
    for (const r of [...runs, ...louds]) r?.cancel();
    expect(statusWavesRunning()).toBe(0);
  });

  it('no wave for a quiet card put to sleep, or a card less than half on screen', () => {
    expect(playStatusWave({ card: onScreenCard('sleep'), emphasis: 'quiet', to: 'idle' })).toBeNull();
    const half = onScreenCard('half');
    half.getBoundingClientRect = () =>
      ({ x: 0, y: -80, left: 0, top: -80, right: 300, bottom: 20, width: 300, height: 100, toJSON() {} }) as DOMRect;
    expect(mostlyOnScreen(half)).toBe(false);
    expect(playStatusWave({ card: half, emphasis: 'loud', to: 'done' })).toBeNull();
  });

  it('a new wave on the same card replaces the one running there; cancel takes its canvas and calls onDone once', () => {
    const card = onScreenCard('same');
    const done = vi.fn();
    const first = playStatusWave({ card, emphasis: 'loud', to: 'running', onDone: done });
    const second = playStatusWave({ card, emphasis: 'quiet', to: 'done' });
    expect(done).toHaveBeenCalledTimes(1);
    expect(statusWavesRunning()).toBe(1);
    second?.cancel();
    first?.cancel();
    expect(done).toHaveBeenCalledTimes(1);
    expect(card.querySelector('canvas')).toBeNull();
  });

  it('puts back what the host set on the card (inert, aria-hidden, opacity) after the engine touched it', () => {
    const card = onScreenCard('kept');
    card.setAttribute('inert', '');
    card.setAttribute('aria-hidden', 'true');
    card.style.opacity = '0.5';
    const run = playStatusWave({ card, emphasis: 'quiet', to: 'done' });
    expect(card.hasAttribute('inert')).toBe(true);
    expect(card.getAttribute('aria-hidden')).toBe('true');
    expect(card.style.opacity).toBe('0.5');
    run?.cancel();
    expect(card.hasAttribute('inert')).toBe(true);
    expect(card.style.opacity).toBe('0.5');
  });
});

describe('<ui-distortion-wave>', () => {
  it('draws one stage: the first view, the revealed view (hidden without one) and the overlay, left out of the picture', () => {
    const el = mount();
    const root = el.shadowRoot!;
    expect(root.querySelector('.dw[part="wave"]')).not.toBeNull();
    expect(root.querySelector('[data-dw-layer="content"] slot:not([name])')).not.toBeNull();
    const b = root.querySelector<HTMLElement>('[data-dw-layer="revealed"]')!;
    expect(b.hidden).toBe(true);
    const over = root.querySelector('[data-dw-layer="overlay"]')!;
    expect(over.hasAttribute('data-dw-skip')).toBe(true);
    expect(over.querySelector('slot[name="overlay"]')).not.toBeNull();
  });

  it('shows the revealed layer once the host gives a second view', () => {
    const el = mount('<div>review</div><div slot="revealed">receipt</div>');
    expect(el.shadowRoot!.querySelector<HTMLElement>('[data-dw-layer="revealed"]')!.hidden).toBe(false);
  });

  it('never writes the host’s strings into its own markup', () => {
    const el = mount(`<div>${XSS}</div>`);
    el.setAttribute('palette', XSS);
    el.setAttribute('type', XSS);
    el.renderNow();
    expect(el.shadowRoot!.innerHTML).not.toContain('onerror');
  });

  it('without WebGL 2 a change of view is a crossfade that ends with ui-finished', async () => {
    const el = mount('<div>review</div><div slot="revealed">receipt</div>');
    const finished = new Promise<boolean>((resolve) =>
      el.addEventListener('ui-finished', (e) => resolve((e as CustomEvent<{ revealed: boolean }>).detail.revealed)),
    );
    el.data = { revealed: true };
    el.renderNow();
    expect(el.controller).not.toBeNull();
    expect(await finished).toBe(true);
    const b = el.shadowRoot!.querySelector<HTMLElement>('[data-dw-layer="revealed"]')!;
    const a = el.shadowRoot!.querySelector<HTMLElement>('[data-dw-layer="content"]')!;
    expect(b.hasAttribute('inert')).toBe(false);
    expect(a.hasAttribute('inert')).toBe(true);
  });

  it('the revealed attribute drives it too; removing it returns to the first view', async () => {
    const el = mount('<div>review</div><div slot="revealed">receipt</div>');
    const seen: boolean[] = [];
    el.addEventListener('ui-finished', (e) => seen.push((e as CustomEvent<{ revealed: boolean }>).detail.revealed));
    el.setAttribute('revealed', '');
    el.renderNow();
    await vi.waitFor(() => expect(seen).toEqual([true]));
    el.removeAttribute('revealed');
    el.renderNow();
    await vi.waitFor(() => expect(seen).toEqual([true, false]));
  });

  it('play / reverse / reset / prepare never throw, connected or not', async () => {
    const loose = document.createElement('ui-distortion-wave');
    expect(() => loose.play()).not.toThrow();
    await expect(loose.prepare()).resolves.toBeUndefined();
    const el = mount();
    expect(() => el.play({ source: 'div' })).not.toThrow();
    expect(() => el.play({ source: '::bad[' })).not.toThrow();
    expect(() => el.reverse()).not.toThrow();
    expect(() => el.reset()).not.toThrow();
    await expect(el.prepare()).resolves.toBeUndefined();
  });

  it('a change to a slotted view marks that layer, so the next wave pictures it afresh', async () => {
    const el = mount(
      '<div id="r">review</div><div slot="revealed"><b id="tx">TX-?</b></div><button slot="overlay">Go</button>',
    );
    const a = el.shadowRoot!.querySelector<HTMLElement>('[data-dw-layer="content"]')!;
    const b = el.shadowRoot!.querySelector<HTMLElement>('[data-dw-layer="revealed"]')!;
    el.querySelector('#tx')!.textContent = 'TX-48211';
    await vi.waitFor(() => expect(b.hasAttribute('data-dw-changed')).toBe(true));
    expect(a.hasAttribute('data-dw-changed')).toBe(false);
    el.querySelector('#r')!.setAttribute('title', 'x');
    await vi.waitFor(() => expect(a.hasAttribute('data-dw-changed')).toBe(true));
    const before = b.getAttribute('data-dw-changed');
    el.querySelector('button')!.textContent = 'Sent';
    await new Promise((r) => setTimeout(r, 10));
    expect(b.getAttribute('data-dw-changed')).toBe(before); // the overlay is not pictured
  });

  it('no context until a wave asks (prewarm off by default)', () => {
    const el = mount();
    el.data = {};
    el.renderNow();
    expect(el.shadowRoot!.querySelector('canvas')).toBeNull();
  });

  it('a renderer that throws never reaches the host: the status wave ends and leaves nothing', async () => {
    const card = onScreenCard('throws');
    const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...a: unknown[]) => unknown };
    const real = proto.getContext;
    proto.getContext = () => {
      throw new Error('driver refused');
    };
    const done = vi.fn();
    let run: ReturnType<typeof playStatusWave> = null;
    expect(() => {
      run = playStatusWave({ card, emphasis: 'loud', to: 'done', onDone: done });
    }).not.toThrow();
    proto.getContext = real;
    expect(run).toBeNull();
    expect(done).toHaveBeenCalledTimes(1);
    expect(statusWavesRunning()).toBe(0);
    const el = mount('<div>a</div><div slot="revealed">b</div>');
    proto.getContext = () => {
      throw new Error('driver refused');
    };
    expect(() => el.play()).not.toThrow();
    proto.getContext = real;
  });

  it('disconnecting destroys the engine; connecting again makes a new one', () => {
    const el = mount();
    const first = el.controller;
    expect(first).not.toBeNull();
    el.remove();
    expect(el.controller).toBeNull();
    document.body.append(el);
    el.renderNow();
    expect(el.controller).not.toBeNull();
    expect(el.controller).not.toBe(first);
  });

  it('styles: two views in one grid cell, the overlay above taking no clicks but its children', () => {
    const css = styles.replace(/\s+/g, ' ');
    expect(css).toContain('.dw-layer { grid-area: 1 / 1;');
    expect(css).toContain('pointer-events: none; }');
    expect(css).toContain('::slotted([slot="overlay"]) { pointer-events: auto; }');
  });
});

describe('docs', () => {
  it('is an Effect with four demos that build without the network', () => {
    expect(doc.group).toBe('Effects');
    expect(doc.tag).toBe('ui-distortion-wave');
    expect(doc.reference.url).toBe('https://libraries.dev/waves');
    expect(doc.demos.length).toBeGreaterThanOrEqual(3);
    for (const d of doc.demos) expect(d.create()).toBeInstanceOf(HTMLElement);
  });
});
