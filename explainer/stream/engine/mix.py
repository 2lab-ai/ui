"""events.json + voice clips + sfx -> mix.wav (48 kHz stereo). usage: python mix.py <build dir>
Where the voices, room sounds, BGM, donation TTS voice and the extra's whisper gain come from: events.json "mix" (build.py
fills it from the themes)."""
import json, math, os, subprocess, sys, wave
import numpy as np
SR = 48000
rng = np.random.default_rng(5)


def load(path, sr=SR, ch=1):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', str(ch), '-ar', str(sr), '-'], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.float32)
    return a.reshape(-1, ch) if ch > 1 else a


def onsets(a, thr_db=-38, min_gap=0.09):
    hop = 240; n = len(a) // hop
    db = np.array([20 * np.log10(np.sqrt(np.mean(a[i * hop:(i + 1) * hop] ** 2)) + 1e-9) for i in range(n)])
    out = []; last = -1e9
    for i in range(1, n):
        if db[i] > thr_db and db[i - 1] <= thr_db and (i - last) * hop / SR > min_gap: out.append(i * hop); last = i
    return out


def slices(path, length=0.16, thr=-38):
    a = load(path)
    a = a / (np.max(np.abs(a)) + 1e-9)
    res = []
    for o in onsets(a, thr):
        s = max(0, o - int(0.004 * SR)); e = s + int(length * SR)
        x = a[s:e].copy()
        if len(x) < int(0.05 * SR): continue
        fade = np.ones(len(x)); k = int(0.03 * SR); fade[-k:] = np.linspace(1, 0, k)
        x *= fade
        res.append(x / (np.max(np.abs(x)) + 1e-9))
    return res


def centroid(x):
    sp = np.abs(np.fft.rfft(x * np.hanning(len(x)))); f = np.fft.rfftfreq(len(x), 1 / SR)
    return float((sp * f).sum() / (sp.sum() + 1e-9))


def biquad_hp(x, fc):
    from scipy.signal import butter, sosfilt
    return sosfilt(butter(2, fc, 'highpass', fs=SR, output='sos'), x)


def lp(x, fc):
    from scipy.signal import butter, sosfilt
    return sosfilt(butter(2, fc, 'lowpass', fs=SR, output='sos'), x)


def place(track, clip, t, gain=1.0):
    i = int(round(t * SR))
    if i >= len(track): return
    if i < 0: clip = clip[-i:]; i = 0
    n = min(len(clip), len(track) - i)
    track[i:i + n] += clip[:n] * gain


def chime():
    t = np.arange(int(1.2 * SR)) / SR
    x = np.zeros_like(t)
    for f0, st, a in [(1318.5, 0.0, .5), (1760, 0.12, .45), (2637, 0.24, .35)]:
        tt = np.clip(t - st, 0, None); env = np.where(t >= st, np.exp(-tt * 5.5), 0)
        x += a * env * (np.sin(2 * np.pi * f0 * tt) + 0.3 * np.sin(2 * np.pi * 2 * f0 * tt))
    return x / np.max(np.abs(x)) * 0.5


def doorbell():
    """an apartment door chime heard from the next room: two soft tones (ding-dong), a little muffled"""
    t = np.arange(int(1.9 * SR)) / SR
    x = np.zeros_like(t)
    for f0, st in [(659.3, 0.0), (523.3, 0.55)]:
        tt = np.clip(t - st, 0, None); env = np.where(t >= st, np.exp(-tt * 3.2) * np.minimum(1, tt / 0.004), 0)
        x += env * (np.sin(2 * np.pi * f0 * tt) + 0.35 * np.sin(2 * np.pi * 2.01 * f0 * tt) + 0.12 * np.sin(2 * np.pi * 3.02 * f0 * tt))
    return lp(x / np.max(np.abs(x)), 2800)


def doorlock():
    """a digital door lock opening down the hall: four keypad beeps, the bolt, a short three-note jingle"""
    out = np.zeros(int(2.0 * SR))
    for k in range(4):
        i = int((0.0 + k * 0.17) * SR); n = int(0.07 * SR); t = np.arange(n) / SR
        out[i:i + n] += np.sin(2 * np.pi * 1850 * t) * np.exp(-t * 18) * 0.6
    i = int(0.85 * SR); n = int(0.06 * SR); out[i:i + n] += lp(rng.normal(0, 1, n), 1500) * np.exp(-np.arange(n) / SR * 60)
    for k, f0 in enumerate((1568, 1976, 2349)):
        i = int((1.0 + k * 0.12) * SR); n = int(0.22 * SR); t = np.arange(n) / SR
        out[i:i + n] += np.sin(2 * np.pi * f0 * t) * np.exp(-t * 9) * 0.5
    return lp(out / np.max(np.abs(out)), 3000)


def step(g):
    # a soft footstep on a floor, through a closed-ish room: a low thump + a short muffled scuff
    n = int(0.16 * SR); t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * g.uniform(62, 85) * t) * np.exp(-t * g.uniform(38, 55))
    scuff = lp(g.normal(0, 1, n), g.uniform(500, 900)) * np.exp(-t * g.uniform(25, 40)) * 2.2
    x = thump + scuff
    return x / (np.max(np.abs(x)) + 1e-9)


def rustle(g, dur=0.45):
    from scipy.signal import butter, sosfilt
    n = int(dur * SR); t = np.arange(n) / SR
    x = sosfilt(butter(2, [1200, 5200], 'bandpass', fs=SR, output='sos'), g.normal(0, 1, n))
    env = np.sin(np.pi * t / dur) ** 1.5 * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * t + 1))
    x *= env
    return x / (np.max(np.abs(x)) + 1e-9)


def donation_voice(text, out, cfg):
    # the platform's donation reader: macOS `say` (Yuna by default) — a flat machine voice on purpose
    aiff = out + '.aiff'
    subprocess.run(['say', '-v', cfg.get('voice', 'Yuna'), '-r', str(cfg.get('rate', 205)), '-o', aiff, text], check=True)
    return load(aiff)


def gate(x, thr_db=-48, floor_db=-30, att=0.002, rel=0.16):
    env = 0.0; g = np.ones(len(x)); a_a = math.exp(-1 / (att * SR)); a_r = math.exp(-1 / (rel * SR))
    thr = 10 ** (thr_db / 20); fl = 10 ** (floor_db / 20); cur = fl
    hop = 64
    for i in range(0, len(x), hop):
        lvl = np.max(np.abs(x[i:i + hop]))
        tgt = 1.0 if lvl > thr else fl
        c = a_a if tgt > cur else a_r
        cur = tgt + (cur - tgt) * (c ** hop)
        g[i:i + hop] = cur
    return x * g


def main(bdir):
    ev = json.load(open(os.path.join(bdir, 'events.json')))
    MX = ev['mix']; SFX = MX['sfx']; XW = MX.get('extra', {})
    T = ev['T']; n = int(T * SR) + SR
    voice = np.zeros(n); sis = np.zeros(n); keys = np.zeros(n); mouse = np.zeros(n); alert = np.zeros(n)
    for who, lid, t0, d in ev['voices']:
        clip = load(os.path.join(MX['audio_dir'], lid + '.wav')).copy()
        if who == 'main' and rng.random() < 0.1:   # the noise gate opens a little late: the first ~12 ms are lost
            k = int(0.012 * SR); clip[:k] = 0; clip[k:k + 240] *= np.linspace(0, 1, 240)
        if who == 'sis':   # a whisper sits right at the gate threshold: quiet bits drop out
            hop = 480; nf = len(clip) // hop
            db = np.array([20 * np.log10(np.sqrt(np.mean(clip[i * hop:(i + 1) * hop] ** 2)) + 1e-9) for i in range(nf)])
            hard = lid in XW.get('hard_drop', []); pk = np.percentile(db, 95); thr = pk - (18 if hard else 40)
            g = np.ones(nf); hold = 0
            for i in range(nf):
                if db[i] >= thr: hold = 11   # ~110 ms hold
                elif hold > 0: hold -= 1
                else: g[i] = 0.0 if hard else 0.35   # a soft expander; a hard drop only on the lines the beats name
            gs = np.repeat(g, hop)[:len(clip)]; gs = np.pad(gs, (0, len(clip) - len(gs)), constant_values=1)
            from scipy.ndimage import uniform_filter1d
            clip *= uniform_filter1d(gs, 96)
        place(sis if who == 'sis' else voice, clip, t0)
    ks = slices(SFX['keys'], 0.16)
    ks2 = slices(SFX['typing'], 0.12, thr=-30)
    allk = ks + ks2
    cents = [centroid(k) for k in allk]
    order = np.argsort(cents)
    heavy = [allk[i] for i in order[:max(2, len(allk) // 6)]]
    normal = [allk[i] for i in order[len(allk) // 6:]]
    clicks = slices(SFX['clicks'], 0.07, thr=-40) or [load(SFX['click'])]
    one = load(SFX['click']); one = one / (np.max(np.abs(one)) + 1e-9)
    print(f'key samples {len(allk)} (heavy {len(heavy)}), clicks {len(clicks)}')
    life = np.zeros(n); used = {}
    chair_a = load(SFX['chair_stand'])
    cr = load(SFX['chair_roll'])
    # the loudest 2.2 s of the roll/sit recording
    w = int(2.2 * SR); e = np.convolve(cr ** 2, np.ones(4800), 'same'); c0 = max(0, int(np.argmax(e)) - w // 3)
    chair_b = cr[c0:c0 + w] * np.concatenate([np.linspace(0, 1, 2400), np.ones(w - 4800), np.linspace(1, 0, 2400)])[:len(cr[c0:c0 + w])]
    door = lp(load(SFX['door']), 3500)
    for t, kind, extra in ev['sfx']:
        if kind in ('key', 'shift', 'ctrl'):
            place(keys, normal[rng.integers(len(normal))], t, 0.55 * 10 ** (rng.uniform(-4, 1) / 20))
        elif kind in ('space', 'enter', 'back', 'delete'):
            place(keys, heavy[rng.integers(len(heavy))], t, 0.7 * 10 ** (rng.uniform(-2, 1) / 20))
        elif kind == 'mdown':
            place(mouse, one, t, 0.33)
        elif kind == 'mup':
            place(mouse, one[::-1] * 0.6 if rng.random() < .5 else one, t, 0.18)
        elif kind == 'chair':
            c = chair_a if rng.random() < 2 and not used.setdefault('chair', 0) else chair_b
            used['chair'] = 1
            place(life, c, t, 0.5)
        elif kind == 'door':
            place(life, door, t, 0.28)
        elif kind == 'steps':   # extra: [count, interval, gain, with_rustle]
            cnt, dt_, g_, rs = extra
            for k in range(int(cnt)):
                place(life, step(rng), t + k * dt_ + rng.uniform(-0.03, 0.03), g_ * (1 - 0.12 * k) * 10 ** (rng.uniform(-2, 1) / 20))
            if rs: place(life, rustle(rng), t - 0.1, g_ * 0.35)
        elif kind == 'doorlock':
            place(life, doorlock(), t, 0.12 if extra is None else float(extra))
        elif kind == 'bell':
            place(life, doorbell(), t, 0.22 if extra is None else float(extra))
        elif kind == 'alert':
            place(alert, chime(), t, 0.5)
        elif kind == 'yuna':
            y = donation_voice(extra, os.path.join(bdir, 'donation'), MX.get('donation_tts', {}))
            place(alert, y / (np.max(np.abs(y)) + 1e-9), t, 0.42)
    # mic chain: voice + keyboard + mouse picked up by the same mic
    room = lp(rng.normal(0, 1, n), 1200) * 10 ** (-60 / 20)
    voice = biquad_hp(voice, 85)
    keys = lp(biquad_hp(keys, 150), 7500)
    mic = voice + keys * 0.55 + mouse * 0.35 + room + life
    mic = gate(mic, thr_db=-50, floor_db=-24)
    # sister: a different, closer mic (whisper), slightly brighter
    SIS_GAIN = XW.get('gain', 0.45)   # a whisper: about 7 dB under the main voice
    sis = biquad_hp(sis, 120) * SIS_GAIN + lp(rng.normal(0, 1, n), 3000) * 10 ** (-66 / 20) * (np.abs(sis) > 1e-4)
    # BGM loop
    bgm = load(MX['bgm'], ch=2)
    reps = int(math.ceil(n / len(bgm))) + 1
    xf = int(2 * SR)
    b = bgm.copy()
    for _ in range(reps):
        fade = np.linspace(0, 1, xf)[:, None]
        tail = b[-xf:] * (1 - fade) + bgm[:xf] * fade
        b = np.concatenate([b[:-xf], tail, bgm[xf:]])
    # an edited VOD: the music jumps ahead at each cut
    tot = sum(a for _, a in ev.get('jumps', []))
    need = n + int(tot * SR) + SR
    while len(b) < need: b = np.concatenate([b, bgm])
    out_b = np.zeros((n, 2)); src = 0; dst = 0
    for tj, add in sorted(ev.get('jumps', [])) + [(1e9, 0)]:
        e = min(n, int(tj * SR)); k = e - dst
        out_b[dst:e] = b[src:src + k]; src += k + int(add * SR); dst = e
        if dst >= n: break
    b = out_b * 10 ** (MX.get('bgm_db', -27) / 20)
    out = np.zeros((n, 2))
    out[:, 0] += mic + sis + alert; out[:, 1] += mic + sis + alert
    dry = out[:int(T * SR)].copy()   # the same mix without the music: an edit (edit/cut.py) lays its own music under its cuts
    out += b
    out = out[:int(T * SR)]
    pk = np.max(np.abs(out)); g = 0.89 / max(pk, 1e-9); out = out * g
    for name, x in (('mix.wav', out), ('mix_dry.wav', dry * g)):
        p = os.path.join(bdir, name)
        with wave.open(p, 'wb') as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
    print('mix', os.path.join(bdir, 'mix.wav'), f'{T:.1f}s (+ mix_dry.wav without music)')


if __name__ == '__main__':
    main(sys.argv[1])
