"""The edit's own sounds, synthesised so they carry no licence: the channel's signature jingle (about 5 s, under the title
card) and the editor's effects (whoosh on a punch-in, pop on a caption, ding on a key line, boing on a gag, record scratch
at the end of the cold open, whip into the title).
usage: python sound.py <out dir> [--seed 7]  ->  jingle.wav + sfx_<name>.wav (48 kHz stereo)
The jingle is one fixed tune per channel: the same notes every episode, so viewers learn it."""
import argparse, os, wave
import numpy as np
from scipy.signal import fftconvolve, butter, lfilter

SR = 48000


def t_(sec): return np.arange(int(sec * SR)) / SR


def env(n, a=0.004, d=0.6, sustain=0.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / a) * (sustain + (1 - sustain) * np.exp(-t / d))
    return e


def note_hz(name):
    names = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
    k = names[name[0]] + (1 if '#' in name else -1 if 'b' in name[1:] else 0)
    octv = int(name[-1])
    return 440.0 * 2 ** ((k - 9) / 12 + (octv - 4))


def celesta(f, dur=1.2, gain=1.0):
    t = t_(dur)
    x = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.25)
         + 0.12 * np.sin(2 * np.pi * 4.2 * f * t) * np.exp(-t / 0.08))
    return x * env(len(t), 0.003, 0.55) * gain


def pad(fs, dur, gain=1.0, seed=0):
    r = np.random.default_rng(seed); t = t_(dur); x = np.zeros_like(t)
    for f in fs:
        for det in (-0.006, 0.0, 0.007):
            ph = r.uniform(0, 1)
            x += ((t * f * (1 + det) + ph) % 1.0) * 2 - 1     # saw
    b, a = butter(2, 1400 / (SR / 2)); x = lfilter(b, a, x)
    att = np.minimum(1, t / 0.25); rel = np.minimum(1, (dur - t) / 0.6).clip(0, 1)
    return x * att * rel * gain / (len(fs) * 3)


def bass(f, dur, gain=1.0):
    t = t_(dur)
    x = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
    return x * np.minimum(1, t / 0.01) * np.exp(-t / 0.9) * np.minimum(1, (dur - t) / 0.05).clip(0, 1) * gain


def kick(gain=1.0):
    t = t_(0.35); f = 45 + 85 * np.exp(-t / 0.04)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12) * gain


def snap(seed, gain=1.0):
    r = np.random.default_rng(seed); t = t_(0.18)
    b, a = butter(2, [1200 / (SR / 2), 5000 / (SR / 2)], 'band')
    return lfilter(b, a, r.normal(0, 1, len(t))) * np.exp(-t / 0.035) * gain


def shaker(seed, gain=1.0):
    r = np.random.default_rng(seed); t = t_(0.06)
    b, a = butter(2, 6000 / (SR / 2), 'high')
    return lfilter(b, a, r.normal(0, 1, len(t))) * np.exp(-t / 0.015) * gain


def reverb(x, sec=1.1, mix=0.22, seed=3):
    r = np.random.default_rng(seed); t = t_(sec)
    ir = r.normal(0, 1, len(t)) * np.exp(-t / (sec / 5)); ir /= np.sqrt(np.sum(ir ** 2))
    b, a = butter(1, 5000 / (SR / 2)); ir = lfilter(b, a, ir)
    wet = fftconvolve(x, ir)[:len(x)]
    return x * (1 - mix) + wet * mix * 2.2


def place(buf, clip, at):
    i = int(at * SR); j = min(len(buf), i + len(clip))
    if j > i: buf[i:j] += clip[:j - i]


def jingle(seed=7):
    """F major, 120 bpm, 5.0 s: a rising four-note call (C-F-A-G), an answer (F-C6), a turn through Dm-Bb-C and a held F chord
    with a sparkle on top. Music box lead, soft pad, round bass, light kit."""
    n = int(5.0 * SR); L = np.zeros(n); R = np.zeros(n)
    beat = 0.5
    lead = [('C5', 0.0), ('F5', 0.25), ('A5', 0.5), ('G5', 1.0), ('F5', 1.25), ('C6', 1.5),
            ('A5', 2.0), ('G5', 2.25), ('F5', 2.5), ('D5', 2.75), ('E5', 3.0), ('G5', 3.25), ('F5', 3.5)]
    ld = np.zeros(n)
    for nm, at in lead: place(ld, celesta(note_hz(nm), 1.4 if at >= 3.5 else 0.9, 0.85), at)
    chords = [(['F3', 'A3', 'C4', 'E4', 'G4'], 0.0, 2.0), (['D3', 'F3', 'A3', 'C4'], 2.0, 0.5), (['Bb2', 'D3', 'F3', 'A3'], 2.5, 0.5),
              (['C3', 'E3', 'G3', 'Bb3'], 3.0, 0.5), (['F3', 'A3', 'C4', 'E4'], 3.5, 1.5)]
    pd = np.zeros(n)
    for i, (ns, at, d) in enumerate(chords): place(pd, pad([note_hz(x) for x in ns], d + 0.15, 0.5, seed + i), at)
    bs = np.zeros(n)
    for nm, at, d in [('F2', 0.0, 1.0), ('F2', 1.0, 1.0), ('D2', 2.0, 0.5), ('Bb1', 2.5, 0.5), ('C2', 3.0, 0.5), ('F2', 3.5, 1.5)]:
        place(bs, bass(note_hz(nm), d, 0.28), at)
    dr = np.zeros(n)
    for k in range(7): place(dr, kick(0.32 if k % 2 == 0 else 0.2), k * beat)
    for k in (1, 3, 5): place(dr, snap(seed + k, 0.25), k * beat)
    for k in range(28): place(dr, shaker(seed + 100 + k, 0.05 if k % 2 else 0.08), k * beat / 2)
    place(dr, kick(0.4), 3.5)
    sp = np.zeros(n)   # sparkle: a quick bell run up over the last chord
    for i, nm in enumerate(['C6', 'E6', 'G6', 'C7', 'E7', 'G7']): place(sp, celesta(note_hz(nm), 1.0, 0.18), 3.52 + i * 0.045)
    mixm = reverb(ld + sp, 1.3, 0.3) + pd * 0.8 + bs + dr * 0.8
    side = reverb(ld + sp, 1.3, 0.3, seed=9) - (ld + sp)
    L = mixm + side * 0.25; R = mixm - side * 0.25
    fade = np.ones(n); k = int(0.35 * SR); fade[-k:] = np.linspace(1, 0, k) ** 1.5
    out = np.stack([L * fade, R * fade], 1)
    b, a = butter(2, 45 / (SR / 2), 'high'); out = lfilter(b, a, out, axis=0)
    return out / np.max(np.abs(out)) * 0.89


def whoosh(seed=1, dur=0.42):
    r = np.random.default_rng(seed); t = t_(dur); x = r.normal(0, 1, len(t)); y = np.zeros_like(x)
    fc = 300 * (10 ** (np.linspace(0, 1, len(t)) * 1.0)); blk = 480
    for i in range(0, len(t), blk):
        f = fc[i]; b, a = butter(2, [max(60, f * 0.6) / (SR / 2), min(SR / 2 - 100, f * 1.6) / (SR / 2)], 'band')
        y[i:i + blk] = lfilter(b, a, x[max(0, i - 2000):i + blk])[-len(x[i:i + blk]):]
    e = np.sin(np.pi * np.linspace(0, 1, len(t))) ** 2
    return y * e


def pop():
    t = t_(0.09); f = 500 + 900 * (t / 0.09)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.03)


def ding():
    f = note_hz('G6'); t = t_(1.0)
    return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / 0.2) + 0.2 * np.sin(2 * np.pi * 5.4 * f * t) * np.exp(-t / 0.08)) * np.exp(-t / 0.45) * np.minimum(1, t / 0.002)


def boing():
    t = t_(0.5); f = 180 + 160 * np.abs(np.sin(2 * np.pi * 7 * t)) * np.exp(-t / 0.25) + 60 * t
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22) * np.minimum(1, t / 0.005)


def scratch(seed=5):
    r = np.random.default_rng(seed); t = t_(0.45)
    rate = 1 + 0.9 * np.sin(2 * np.pi * 3.2 * t)                         # the hand pushes the record back and forth
    src = r.normal(0, 1, int(SR * 2)); b, a = butter(2, [400 / (SR / 2), 3500 / (SR / 2)], 'band'); src = lfilter(b, a, src)
    pos = np.cumsum(rate) % (len(src) - 1); y = src[pos.astype(int)]
    tone = np.sin(2 * np.pi * np.cumsum(220 * rate) / SR) * 0.6
    return (y * 0.6 + tone) * np.sin(np.pi * np.linspace(0, 1, len(t))) ** 0.5


def whip(seed=2):
    return whoosh(seed, 0.22)


def write(path, x):
    if x.ndim == 1: x = np.stack([x, x], 1)
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.89
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype(np.int16).tobytes())


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('out'); ap.add_argument('--seed', type=int, default=7); a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    write(os.path.join(a.out, 'jingle.wav'), jingle(a.seed))
    for name, fn in [('whoosh', whoosh), ('pop', pop), ('ding', ding), ('boing', boing), ('scratch', scratch), ('whip', whip)]:
        write(os.path.join(a.out, f'sfx_{name}.wav'), fn())
    print('sounds ->', a.out)
