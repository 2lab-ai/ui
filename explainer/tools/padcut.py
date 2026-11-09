"""Cut the filler padding ("아아. [pause] … [pause] 아아.") off a Fish Speech take.
The filler makes the model start and stop mid-utterance, so the real sentence has no truncated plosive;
the [pause] leaves a silence we cut inside, with short fades."""
import numpy as np
PAD_HEAD, PAD_TAIL = '아아. [pause] ', ' [pause] 아아.'
def envelope_db(a, sr, ms=10):
    h = int(sr * ms / 1000); n = len(a) // h
    return 20 * np.log10(np.sqrt(np.mean(a[:n * h].reshape(n, h) ** 2, axis=1) + 1e-12)), ms / 1000
def silences(db, step, thr=-40, min_s=0.08):
    out, s = [], None
    for i, v in enumerate(list(db) + [0.0]):
        if v < thr and s is None: s = i
        if v >= thr and s is not None:
            if (i - s) * step >= min_s: out.append((s * step, i * step))
            s = None
    return out
def cut(a, sr, min_gap=0.2, max_filler=0.95, pre=0.05, post=0.08, fade=0.008):
    """returns (clip, info) or (None, reason) when the filler/gap pattern is not found."""
    db, step = envelope_db(a, sr); dur = len(a) / sr
    sil = silences(db, step)
    if not sil: return None, 'no silence'
    first_voice = next((i * step for i, v in enumerate(db) if v >= -40), None)
    if first_voice is None: return None, 'all silent'
    head = next((s for s in sil if s[1] - s[0] >= min_gap and s[0] > first_voice), None)
    if head is None or head[0] - first_voice > max_filler: return None, f'head gap not found (first voice {first_voice:.2f})'
    last_voice = max(i * step for i, v in enumerate(db) if v >= -40) + step
    tail = next((s for s in reversed(sil) if s[1] - s[0] >= min_gap and s[0] < last_voice and s[0] > head[1]), None)
    if tail is None: return None, 'tail gap not found'
    if last_voice - tail[1] > max_filler:      # what follows the last gap is too long to be the filler
        tail = (last_voice, dur)                # filler swallowed -> keep up to the last voice
    s0 = max(0.0, head[1] - pre); s1 = min(dur, tail[0] + post)
    clip = a[int(s0 * sr):int(s1 * sr)].copy()
    f = int(fade * sr); r = np.linspace(0, 1, f, dtype=np.float32)
    clip[:f] *= r; clip[-f:] *= r[::-1]
    return clip, {'cut': (round(s0, 2), round(s1, 2)), 'head_gap': round(head[1] - head[0], 2), 'tail_gap': round(tail[1] - tail[0], 2)}
def rise_ms(clip, sr):
    """onset rise time: from the first frame above -45 dB to the first above -20 dB (5 ms frames)."""
    db, step = envelope_db(clip, sr, 5)
    i0 = next((i for i, v in enumerate(db) if v > -45), None); i1 = next((i for i, v in enumerate(db) if v > -20), None)
    return None if i0 is None or i1 is None else (i1 - i0) * 5
def edge_db(clip, sr, ms=10):
    n = int(sr * ms / 1000)
    return round(20 * np.log10(np.abs(clip[:n]).max() + 1e-9), 1), round(20 * np.log10(np.abs(clip[-n:]).max() + 1e-9), 1)
