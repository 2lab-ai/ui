"""Original score per SPEC part 4: D major Dmaj9-Bm9-Gmaj7#11-Asus2, additive-sine piano arpeggio,
detuned pad, three cross-channel echoes. Writes score.wav (48 kHz stereo)."""
import json, os, sys, wave
import numpy as np

HERE = os.getcwd()   # the project folder
SR = 48000
CHORDS = [[50, 57, 62, 64, 66, 69], [47, 54, 62, 61, 66, 69], [43, 50, 59, 61, 66, 71], [45, 52, 59, 61, 64, 69]]
CHORD_LEN = 8.0
FIG = [0, 2, 3, 4, 5, 4, 3, 2]

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)

def piano_note(f, dur=3.2):
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for k, a in zip((1, 2, 3, 4), (1, 0.42, 0.18, 0.08)):
        out += a * np.sin(2 * np.pi * f * k * t) * np.exp(-t * (k - 1) * 0.9)
    env = np.exp(-1.6 * t)
    att = int(0.0025 * SR); env[:att] *= np.linspace(0, 1, att)
    return out * env / 1.68

def main(total):
    n = int(total * SR) + SR * 4
    L = np.zeros(n); R = np.zeros(n)
    rng = np.random.default_rng(7)
    cache = {}
    # arpeggio: eighth notes at 60 bpm = 0.5 s, figure twice per 8 s chord
    step = 0.5; t = 0.0; idx = 0
    while t < total:
        bar = int(t // 4)                       # 4 s per bar (2 figures per chord)
        chord = CHORDS[int(t // CHORD_LEN) % 4]
        pos = idx % 8
        note = chord[FIG[pos]]
        if bar % 8 >= 4 and FIG[pos] >= 4: note += 12   # bars 5-8 of every 8: top notes up an octave
        if rng.random() >= 0.12:
            if note not in cache: cache[note] = piano_note(hz(note))
            x = cache[note]
            amp = 0.11 if pos == 0 else 0.085
            pan = 0.5 + 0.35 * np.sin(2 * np.pi * t / 23.0)
            i0 = int(t * SR); i1 = min(n, i0 + len(x))
            L[i0:i1] += amp * (1 - pan) * 2 * x[:i1 - i0] * 0.5
            R[i0:i1] += amp * pan * 2 * x[:i1 - i0] * 0.5
        t += step; idx += 1
    # pad: lowest 3 notes an octave down, 3 detuned sines each, 2.5 s fades, 0.07 Hz swell
    tt = np.arange(int(CHORD_LEN * SR)) / SR
    fade = np.ones_like(tt); fl = int(2.5 * SR)
    fade[:fl] = np.linspace(0, 1, fl); fade[-fl:] = np.linspace(1, 0, fl)
    c = 0
    while c * CHORD_LEN < total + 4:
        chord = CHORDS[c % 4]
        seg = np.zeros_like(tt)
        for m in sorted(chord)[:3]:
            f = hz(m - 12)
            for dt in (-0.12, 0, 0.12):
                seg += np.sin(2 * np.pi * (f + dt) * tt + rng.random() * 6.28)
        seg = seg / 9 * fade
        i0 = int(c * CHORD_LEN * SR)
        lfo = 1 + 0.2 * np.sin(2 * np.pi * 0.07 * (i0 / SR + tt))
        i1 = min(n, i0 + len(seg))
        L[i0:i1] += 0.06 * (seg * lfo)[:i1 - i0]; R[i0:i1] += 0.06 * (seg * lfo)[:i1 - i0]
        c += 1
    # room: three cross-channel echoes
    dl, dr = L.copy(), R.copy()
    for ms, g in ((83, 0.28), (191, 0.20), (370, 0.13)):
        d = int(ms / 1000 * SR)
        L[d:] += g * dr[:-d]; R[d:] += g * dl[:-d]
    m = int(total * SR)
    L, R = L[:m], R[:m]
    if m <= 0: sys.exit('music: total must be positive')
    tin = min(int(3 * SR), m // 2); tout = min(int(5 * SR), m // 2)
    for ch in (L, R):
        ch[:tin] *= np.linspace(0, 1, tin); ch[-tout:] *= np.linspace(1, 0, tout)
    peak = max(np.abs(L).max(), np.abs(R).max())
    L, R = L / peak * 0.8, R / peak * 0.8
    pcm = (np.stack([L, R], 1) * 32767).astype(np.int16)
    with wave.open(os.path.join(HERE, 'score.wav'), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print(f'score.wav {total:.1f}s')

if __name__ == '__main__':
    total = float(sys.argv[1]) if len(sys.argv) > 1 else json.load(open(os.path.join(HERE, 'timeline.json')))['total']
    main(total)
