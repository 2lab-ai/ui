"""Cut the filler padding ("아아. [pause] … [pause] 아아.") off a Fish Speech take.

Why: a bare sentence starts and stops right at the model's edge, which can clip a plosive. With the filler the sentence
is mid-utterance on both sides; [pause] leaves a silence on each side that we cut inside, with short fades.

Strict on purpose: a take is cut only when it has the full pattern
    filler (short voiced run) | gap >= min_gap | speech | gap >= min_gap | filler (short voiced run)
A missing, merged or swallowed filler returns None, so the caller re-synthesises instead of guessing, because a guess
can drop a real word: a short final word after an internal pause looks like a filler. `removed()` gives the cut-off
pieces so a caller can also check by ear (whisper) that they hold only the filler.
"""
import re

import numpy as np

PAD_HEAD, PAD_TAIL = '아아. [pause] ', ' [pause] 아아.'
VOICED_DB = -40
FILLER_MIN, FILLER_MAX = 0.08, 0.95   # seconds of voice in "아아"
FILLER_TEXT = re.compile(r'^[\s.,!?…~\-]*[아어오와하음ㅏ][\s아어오와하음ㅏ.,!?…~\-]*$')   # at least one filler syllable, nothing else


def envelope_db(a, sr, ms=10):
    h = int(sr * ms / 1000); n = len(a) // h
    if n == 0: return np.full(1, -120.0), ms / 1000
    return 20 * np.log10(np.sqrt(np.mean(a[:n * h].reshape(n, h) ** 2, axis=1) + 1e-12)), ms / 1000


def runs(db, step, thr=VOICED_DB, min_gap=0.08):
    """voiced runs [(start, end)] in seconds; silences shorter than min_gap do not split a run."""
    voiced = db >= thr
    out, s = [], None
    for i, v in enumerate(list(voiced) + [False]):
        if v and s is None: s = i
        if not v and s is not None: out.append([s * step, i * step]); s = None
    merged = []
    for r in out:
        if merged and r[0] - merged[-1][1] < min_gap: merged[-1][1] = r[1]
        else: merged.append(r)
    return [tuple(r) for r in merged]


def cut(a, sr, min_gap=0.2, pre=0.05, post=0.08, fade=0.008):
    """returns (clip, info) or (None, reason). info has 'cut', 'head', 'tail' (filler runs, seconds) and the gaps."""
    db, step = envelope_db(a, sr)
    rs = runs(db, step)
    if len(rs) < 3: return None, f'{len(rs)} voiced runs (need filler, speech, filler)'
    head, tail = rs[0], rs[-1]
    nxt = next(r for r in rs[1:])          # first run after the head filler
    prv = rs[-2]                            # last run before the tail filler
    head_gap, tail_gap = nxt[0] - head[1], tail[0] - prv[1]
    if not FILLER_MIN <= head[1] - head[0] <= FILLER_MAX: return None, f'head filler {head[1] - head[0]:.2f}s'
    if not FILLER_MIN <= tail[1] - tail[0] <= FILLER_MAX: return None, f'tail filler {tail[1] - tail[0]:.2f}s'
    if head_gap < min_gap: return None, f'head gap {head_gap:.2f}s'
    if tail_gap < min_gap: return None, f'tail gap {tail_gap:.2f}s'
    s0 = max(head[1], nxt[0] - pre); s1 = min(tail[0], prv[1] + post)
    clip = a[int(s0 * sr):int(s1 * sr)].copy()
    f = min(int(fade * sr), len(clip) // 2); r = np.linspace(0, 1, f, dtype=np.float32)
    if f: clip[:f] *= r; clip[-f:] *= r[::-1]
    return clip, {'cut': (s0, s1), 'head': head, 'tail': tail,
                  'head_gap': round(head_gap, 2), 'tail_gap': round(tail_gap, 2)}


def removed(a, sr, info):
    """everything cut off: the whole prefix before and the whole suffix after the kept clip (exact cut samples)."""
    s0, s1 = info['cut']
    return a[:int(s0 * sr)], a[int(s1 * sr):]


def is_filler_text(text):
    """True only when the piece was positively heard as filler; empty or unsure output is a rejection."""
    return bool(FILLER_TEXT.match(text or ''))
