"""Music library: 120+ original underscore cues in 12 moods, composed as MIDI by code and rendered with fluidsynth and
the MIT-licensed MuseScore_General SoundFont (no Content ID risk: we own every note). A cue is a preset (mood, mode,
key, tempo, chord progression, instruments, texture pattern); compose() writes it to any exact length with an intro,
a varied repeat and a real final cadence, so nothing loops and every scene can get its own cue.

    python music_lib.py build            # writes explainer/music/cues.json (the catalogue, committed)
    python music_lib.py previews [ids]   # 20 s previews -> ~/.cache/2lab-explainer-music/preview/<id>.wav
    python music_lib.py check            # distinctness + loudness over all previews
    python music_lib.py render <id> <seconds> <out.wav> [--seed N]

Rules from the research (explainer/docent/REFERENCE.md "Music"): stay out of the voice band while someone speaks (no
sustained melody between G3 and C6; chords C3-C4 voiced close, bass C2-C3, sparkle above C5), at most 2 note starts
per beat in the middle register, end every cue on its home chord, normalise to -20 LUFS, high-pass 90 Hz and a 3 dB
dip at 2.5 kHz to leave room for the voice.
"""
import json, os, random, subprocess, sys, tempfile, wave, zlib
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
CAT = os.path.join(os.path.dirname(HERE), 'music', 'cues.json')
CACHE = os.path.expanduser('~/.cache/2lab-explainer-music')
SF2 = os.environ.get('EXPLAINER_SF2', os.path.expanduser('~/.cache/2lab-explainer-soundfonts/MuseScore_General.sf2'))
SF2_URL = 'https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/MuseScore_General.sf2'
SR = 48000

SCALES = {'major': [0, 2, 4, 5, 7, 9, 11], 'minor': [0, 2, 3, 5, 7, 8, 10], 'dorian': [0, 2, 3, 5, 7, 9, 10],
          'lydian': [0, 2, 4, 6, 7, 9, 11], 'mixolydian': [0, 2, 4, 5, 7, 9, 10], 'phrygian': [0, 1, 3, 5, 7, 8, 10],
          'harmonic': [0, 2, 3, 5, 7, 8, 11]}
# GM programs (0-based). pads = sustained chords, tex = the moving texture, bass = the low line.
MOODS = {
    'wonder':     dict(modes=['lydian', 'major'], bpm=(64, 80), progs=[[0, 1, 0, 4], [0, 5, 3, 1], [0, 4, 5, 3]],
                       pads=[89, 88, 94, 49], tex=[8, 46, 9, 98], pats=['arpud', 'sparkle'], bass=[43], bpat=['whole']),
    'curious':    dict(modes=['dorian', 'major'], bpm=(88, 104), progs=[[0, 3, 0, 3], [0, 6, 3, 0], [0, 1, 3, 4]],
                       pads=[4, 11, 0, 89], tex=[45, 12, 108, 13], pats=['broken', 'sparkle'], bass=[32, 33], bpat=['half']),
    'tension':    dict(modes=['minor', 'phrygian'], bpm=(70, 90), progs=[[0, 1, 0, 5], [0, 5, 1, 4], [0, 0, 5, 6]],
                       pads=[50, 92, 48, 95], tex=[45, 12, 14, 11], pats=['ostinato', 'pulse'], bass=[43, 42], bpat=['pulse']),
    'triumph':    dict(modes=['major'], bpm=(96, 112), progs=[[0, 4, 5, 3], [3, 4, 0, 0], [0, 3, 4, 0]],
                       pads=[48, 61, 60, 49], tex=[46, 9, 47, 13], pats=['arpup', 'broken'], bass=[32, 58], bpat=['half'], perc='soft'),
    'melancholy': dict(modes=['minor'], bpm=(58, 72), progs=[[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 4]],
                       pads=[49, 89, 42, 52], tex=[0, 46, 11, 8], pats=['bell', 'arpud'], bass=[43], bpat=['whole']),
    'playful':    dict(modes=['major', 'mixolydian'], bpm=(104, 120), progs=[[0, 3, 4, 0], [0, 6, 3, 0], [0, 5, 1, 4]],
                       pads=[4, 0, 11, 24], tex=[45, 12, 13, 108], pats=['broken', 'pulse'], bass=[58, 70, 32], bpat=['stac'], perc='shaker'),
    'reflective': dict(modes=['major', 'lydian'], bpm=(58, 70), progs=[[0, 3, 0, 3], [3, 0, 4, 5], [0, 2, 3, 0]],
                       pads=[88, 0, 89, 4], tex=[46, 11, 8, 24], pats=['sparkle', 'bell'], bass=[43, 32], bpat=['whole']),
    'urgent':     dict(modes=['minor', 'harmonic'], bpm=(112, 128), progs=[[0, 5, 6, 0], [0, 6, 5, 4], [0, 3, 4, 4]],
                       pads=[50, 48, 81, 92], tex=[45, 38, 12, 11], pats=['ostinato', 'pulse'], bass=[38, 33], bpat=['pulse'], perc='hat'),
    'warm':       dict(modes=['major'], bpm=(72, 88), progs=[[0, 4, 5, 3], [0, 3, 1, 4], [0, 5, 3, 4]],
                       pads=[89, 48, 4, 52], tex=[24, 46, 25, 11], pats=['arpup', 'broken'], bass=[32, 43], bpat=['half']),
    'mystery':    dict(modes=['phrygian', 'harmonic', 'dorian'], bpm=(60, 76), progs=[[0, 1, 0, 6], [0, 6, 5, 6], [0, 3, 0, 1]],
                       pads=[91, 94, 95, 92], tex=[98, 14, 11, 8], pats=['sparkle', 'bell'], bass=[43], bpat=['whole']),
    'epic-calm':  dict(modes=['major', 'mixolydian'], bpm=(66, 80), progs=[[0, 5, 3, 4], [0, 6, 3, 0], [0, 3, 5, 4]],
                       pads=[48, 52, 60, 49], tex=[46, 9, 8, 47], pats=['arpud', 'arpup'], bass=[43, 32], bpat=['whole']),
    'nostalgic':  dict(modes=['major', 'mixolydian'], bpm=(70, 84), progs=[[0, 2, 3, 4], [0, 5, 1, 4], [0, 3, 2, 5]],
                       pads=[4, 0, 89, 11], tex=[10, 24, 11, 46], pats=['bell', 'arpud'], bass=[32], bpat=['whole']),
}
KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
GM = {0: 'piano', 4: 'e-piano', 8: 'celesta', 9: 'glockenspiel', 10: 'music box', 11: 'vibraphone', 12: 'marimba', 13: 'xylophone',
      14: 'tubular bells', 24: 'nylon guitar', 25: 'steel guitar', 32: 'acoustic bass', 33: 'finger bass', 38: 'synth bass',
      42: 'cello', 43: 'contrabass', 45: 'pizzicato', 46: 'harp', 47: 'timpani', 48: 'strings', 49: 'slow strings', 50: 'synth strings',
      52: 'choir', 58: 'tuba', 60: 'horn', 61: 'brass', 70: 'bassoon', 81: 'saw lead', 88: 'new-age pad', 89: 'warm pad',
      91: 'choir pad', 92: 'bowed pad', 94: 'halo pad', 95: 'sweep pad', 98: 'crystal', 108: 'kalimba'}

# ---------- catalogue ----------
def build(per=10):
    """Deterministic catalogue: per mood, `per` presets that differ in key, tempo, progression, pad, texture and
    pattern. Keys walk the circle of fifths per mood so neighbouring presets are not in the same key."""
    out = []
    for mi, (mood, M) in enumerate(MOODS.items()):
        rng = random.Random(1000 + mi); seen = set(); k = 0; tries = 0
        while k < per and tries < 500:
            tries += 1
            p = {'mode': M['modes'][k % len(M['modes'])], 'key': (mi * 5 + k * 7) % 12,
                 'bpm': int(M['bpm'][0] + (M['bpm'][1] - M['bpm'][0]) * ((k * 3) % per) / max(1, per - 1)),
                 'prog': M['progs'][rng.randrange(len(M['progs']))], 'pad': M['pads'][rng.randrange(len(M['pads']))],
                 'tex': M['tex'][rng.randrange(len(M['tex']))], 'pat': M['pats'][rng.randrange(len(M['pats']))],
                 'bass': M['bass'][rng.randrange(len(M['bass']))], 'bpat': M['bpat'][0], 'perc': M.get('perc')}
            if p['tex'] == p['pad']: continue
            fp = (p['pad'], p['tex'], p['pat'], tuple(p['prog']))
            if fp in seen: continue
            seen.add(fp); k += 1
            p.update(id=f'{mood}-{k:02d}', mood=mood,
                     name=f"{KEY_NAMES[p['key']]} {p['mode']}, {p['bpm']} bpm, {GM.get(p['tex'], p['tex'])} {p['pat']} over {GM.get(p['pad'], p['pad'])}")
            out.append(p)
    return out

def catalogue():
    return json.load(open(CAT))['cues']

# ---------- composer ----------
def chord_of(scale, root, deg, n=3):
    return [root + scale[(deg + 2 * i) % 7] + 12 * ((deg + 2 * i) // 7) for i in range(n)]

def voice(prev, tones, lo=48, hi=67):
    """Close voicing in [lo, hi] nearest to the previous chord (smooth voice leading)."""
    best = None
    for inv in range(len(tones)):
        base = sorted(((t - tones[inv]) % 12) + tones[inv] for t in tones)
        for o in range(-3, 4):
            v = [x + 12 * o for x in base]
            v = sorted((x - 12 if x > hi else x + 12 if x < lo else x) for x in v)
            if min(v) < lo or max(v) > hi: continue
            cost = sum(abs(a - b) for a, b in zip(v, prev)) if prev else abs(sum(v) / len(v) - (lo + hi) / 2)
            if best is None or cost < best[0]: best = (cost, v)
    return best[1] if best else sorted(tones)

def compose(p, dur, seed=0):
    """-> list of (start_s, dur_s, channel, program, pitch, velocity). Bars fill `dur`; the last bar is the home chord."""
    rng = random.Random(zlib.crc32(f"{p['id']}:{seed}".encode()))
    spb = 60.0 / p['bpm']; bar = 4 * spb
    scale = SCALES[p['mode']]; root = 48 + p['key'] if p['key'] < 8 else 36 + p['key']   # chords sit around C3-C4
    nb = max(3, int(round((dur - 1.5) / bar)))                       # bars of music; the rest is the final ring-out
    prog = list(p['prog'])
    seq = [prog[i % len(prog)] for i in range(nb - 1)]
    if seq and seq[-1] == 0: seq[-1] = 4 if p['mode'] not in ('phrygian',) else 1   # approach the cadence
    seq.append(0)
    ev = []; prev = None
    tex_on = lambda b: b >= 1 and not (b == nb - 1)                   # texture enters after the intro bar
    var = nb // 2                                                     # the varied repeat starts here
    for b, deg in enumerate(seq):
        t0 = b * bar; last = b == nb - 1
        tones = chord_of(scale, root, deg, 4 if p['mood'] in ('wonder', 'reflective', 'warm', 'nostalgic') and b % 2 else 3)
        v = voice(prev, tones); prev = v
        L = bar * (2.2 if last else 1.0)
        for x in v: ev.append((t0, L, 0, p['pad'], x, 46 if not last else 40))
        # bass
        br = root - 12 + scale[deg % 7]
        while br > 47: br -= 12
        while br < 34: br += 12
        bp = p['bpat']
        if last or bp == 'whole': ev.append((t0, L, 1, p['bass'], br, 52))
        elif bp == 'half': ev += [(t0, 2 * spb, 1, p['bass'], br, 54), (t0 + 2 * spb, 2 * spb, 1, p['bass'], br + 7 if br + 7 <= 50 else br - 5, 48)]
        elif bp == 'stac': ev += [(t0 + i * spb, spb * 0.45, 1, p['bass'], (br + 7 if br + 7 <= 50 else br - 5) if i % 2 else br, 58) for i in range(4)]
        elif bp == 'pulse': ev += [(t0 + i * spb / 2, spb * 0.4, 1, p['bass'], br, 50 + (8 if i % 4 == 0 else 0)) for i in range(8)]
        # texture (above C5 unless it is staccato), denser in the varied repeat
        if tex_on(b):
            hi = [x + 24 for x in v] if max(v) + 24 <= 96 else [x + 12 for x in v]
            pat = p['pat']; dense = b >= var
            if pat in ('arpup', 'arpud'):
                cyc = hi + [hi[0] + 12] if pat == 'arpup' else hi + [hi[0] + 12] + hi[::-1][1:-1]
                step = spb / 2
                for i in range(8): ev.append((t0 + i * step, step * 1.6, 2, p['tex'], cyc[i % len(cyc)], 38 + (6 if i % 4 == 0 else 0) + (4 if dense else 0)))
            elif pat == 'broken':
                order = [0, 2, 1, 2] if not dense else [0, 2, 1, 2, 0, 3 % len(hi), 1, 2]
                step = 4 * spb / len(order)
                for i, k in enumerate(order): ev.append((t0 + i * step, step * 1.2, 2, p['tex'], hi[k % len(hi)], 40 + (5 if i == 0 else 0)))
            elif pat == 'sparkle':
                for i in range(8):
                    if rng.random() < (0.45 if dense else 0.3): ev.append((t0 + i * spb / 2, spb * 1.5, 2, p['tex'], rng.choice(hi) + rng.choice([0, 12]), rng.randint(30, 44)))
            elif pat == 'bell':   # a slow stepwise line above C6: melody without masking the voice
                top = 84 + p['key'] % 12
                degs = [scale.index(x % 12 - p['key']) if (x % 12 - p['key']) in scale else 0 for x in hi[:1]]
                d = degs[0]
                for i in range(2 if not dense else 4):
                    d = max(0, min(9, d + rng.choice([-1, 1, 1, -2, 2])))
                    pitch = top - (p['key'] % 12) + p['key'] + scale[d % 7] + 12 * (d // 7) - 12
                    ev.append((t0 + i * bar / (2 if not dense else 4), bar / 2, 2, p['tex'], min(100, pitch), 42))
            elif pat == 'pulse':
                for i in range(8): ev.append((t0 + i * spb / 2, spb * 0.35, 2, p['tex'], hi[0] if i % 2 == 0 else hi[-1], 36 + (6 if i % 4 == 0 else 0)))
            elif pat == 'ostinato':
                cell = [hi[0], hi[1], hi[0], hi[-1]]
                for i in range(16 if dense else 8):
                    st = spb / 4 if dense else spb / 2
                    ev.append((t0 + i * st, st * 0.8, 2, p['tex'], cell[i % 4], 32 + (8 if i % 4 == 0 else 0)))   # above C5, out of the voice band
        # soft percussion (channel 9) in the main part only
        if p.get('perc') and 1 <= b < nb - 1:
            if p['perc'] == 'hat':
                for i in range(8): ev.append((t0 + i * spb / 2, 0.1, 9, 0, 42, 30 + (10 if i % 2 == 0 else 0)))
                ev.append((t0, 0.2, 9, 0, 36, 46)); ev.append((t0 + 2 * spb, 0.2, 9, 0, 36, 40))
            elif p['perc'] == 'shaker':
                for i in range(8): ev.append((t0 + i * spb / 2, 0.1, 9, 0, 70, 26 + (10 if i % 2 else 0)))
            elif p['perc'] == 'soft':
                ev.append((t0, 0.4, 9, 0, 36, 40));
                if b % 2: ev.append((t0 + 3.5 * spb, 0.2, 9, 0, 41, 34))
    return ev, nb * bar + bar * 1.2

def write_midi(ev, path):
    import mido
    mid = mido.MidiFile(ticks_per_beat=480); tr = mido.MidiTrack(); mid.tracks.append(tr)
    tempo = 500000; tr.append(mido.MetaMessage('set_tempo', tempo=tempo))   # 120 bpm: 1 s = 960 ticks
    tps = 960
    progs = {}
    for _, _, ch, prog, _, _ in ev:
        if ch != 9: progs[ch] = prog
    msgs = []
    for ch, prog in progs.items():
        msgs.append((0, 0, mido.Message('program_change', channel=ch, program=prog)))
        msgs.append((0, 0, mido.Message('control_change', channel=ch, control=91, value=70)))   # reverb send
        msgs.append((0, 0, mido.Message('control_change', channel=ch, control=7, value={0: 92, 1: 96, 2: 84}.get(ch, 90))))
    for st, d, ch, _, pitch, vel in ev:
        a = int(st * tps); b = int((st + d) * tps)
        msgs.append((a, 1, mido.Message('note_on', channel=ch, note=int(pitch), velocity=int(vel))))
        msgs.append((b, 0, mido.Message('note_off', channel=ch, note=int(pitch), velocity=0)))
    msgs.sort(key=lambda m: (m[0], m[1]))
    now = 0
    for t, _, m in msgs: tr.append(m.copy(time=t - now)); now = t
    mid.save(path)

def wav_read(path):
    with wave.open(path) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        return a.reshape(-1, w.getnchannels()), w.getframerate()

def wav_write(path, a):
    a = np.clip(a, -1, 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(a.shape[1]); w.setsampwidth(2); w.setframerate(SR); w.writeframes((a * 32767).astype(np.int16).tobytes())

def ensure_sf2():
    if os.path.exists(SF2) and os.path.getsize(SF2) > 200_000_000: return
    sys.exit(f'SoundFont missing: {SF2}\n  mkdir -p {os.path.dirname(SF2)} && curl -L -o {SF2} {SF2_URL}   # MIT, 216 MB\n  brew install fluidsynth')

def render(p, dur, out, seed=0, lufs=-20.0, master=True):
    """Render preset p to exactly `dur` seconds (+ its ring-out trimmed to dur, 1.5 s fade at the end)."""
    ensure_sf2()
    ev, _ = compose(p, dur, seed)
    with tempfile.TemporaryDirectory() as td:
        mid, raw = os.path.join(td, 'c.mid'), os.path.join(td, 'c.wav')
        write_midi(ev, mid)
        subprocess.run(['fluidsynth', '-ni', '-q', '-g', '0.6', '-r', str(SR), '-F', raw, SF2, mid], check=True, capture_output=True)
        flt = f'atrim=0:{dur:.3f},afade=t=in:d=0.6,afade=t=out:st={max(0, dur - 1.5):.3f}:d=1.5'
        if master: flt = 'highpass=f=90,equalizer=f=2500:t=q:w=1.2:g=-3,' + flt + f',loudnorm=I={lufs}:TP=-3:LRA=11'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', flt, '-ar', str(SR), '-ac', '2', out], check=True)
    return out

# ---------- checks ----------
def features(path):
    a, _ = wav_read(path); x = a.mean(axis=1)
    n = 1 << 15; hop = n // 2; chroma = np.zeros(12); cent = []; on = []
    freqs = np.fft.rfftfreq(n, 1 / SR); valid = (freqs > 60) & (freqs < 5000)
    midi = np.round(69 + 12 * np.log2(np.maximum(freqs[valid], 1) / 440)).astype(int) % 12
    prev = None
    for i in range(0, len(x) - n, hop):
        S = np.abs(np.fft.rfft(x[i:i + n] * np.hanning(n)))
        np.add.at(chroma, midi, S[valid] ** 2)
        cent.append((freqs * S).sum() / (S.sum() + 1e-9))
        if prev is not None: on.append(np.maximum(S - prev, 0).sum())
        prev = S
    chroma /= chroma.sum() + 1e-9
    return np.concatenate([chroma * 3, [np.mean(cent) / 2000, np.mean(on) / (np.mean(on) + 50)]])

def check(ids=None):
    cues = [c for c in catalogue() if not ids or c['id'] in ids]
    F = {}; worst = []
    for c in cues:
        pth = os.path.join(CACHE, 'preview', c['id'] + '.wav')
        if os.path.exists(pth): F[c['id']] = features(pth)
    keys = list(F)
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            d = float(np.linalg.norm(F[keys[i]] - F[keys[j]])); worst.append((d, keys[i], keys[j]))
    worst.sort()
    fps = {(c['pad'], c['tex'], c['pat'], tuple(c['prog']), c['key'], c['mode']) for c in cues}
    print(f'{len(cues)} cues, {len(fps)} distinct fingerprints, {len(F)} previews')
    print('closest pairs (feature distance):', [(round(d, 3), a, b) for d, a, b in worst[:8]])
    return worst

if __name__ == '__main__':
    a = sys.argv[1:]
    cmd = a[0] if a else 'build'
    if cmd == 'build':
        cues = build()
        os.makedirs(os.path.dirname(CAT), exist_ok=True)
        json.dump({'soundfont': 'MuseScore_General.sf2 (MIT)', 'moods': list(MOODS), 'cues': cues}, open(CAT, 'w'), ensure_ascii=False, indent=1)
        print(f'{len(cues)} cues -> {CAT}')
    elif cmd == 'previews':
        os.makedirs(os.path.join(CACHE, 'preview'), exist_ok=True)
        for c in catalogue():
            if a[1:] and c['id'] not in a[1:]: continue
            render(c, 20.0, os.path.join(CACHE, 'preview', c['id'] + '.wav')); print(c['id'], c['name'], flush=True)
    elif cmd == 'check': check(a[1:])
    elif cmd == 'render':
        cid, dur, out = a[1], float(a[2]), a[3]; seed = int(a[a.index('--seed') + 1]) if '--seed' in a else 0
        render(next(c for c in catalogue() if c['id'] == cid), dur, out, seed); print(out)
