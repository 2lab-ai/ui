"""Cut the filler padding ("아아. [pause] … [pause] 아아.") off a Fish Speech take.

Why: a bare sentence starts and stops right at the model's edge, which can clip a plosive. With the filler the sentence
is mid-utterance on both sides; [pause] leaves a silence on each side that we cut inside, with short fades.

Strict on purpose: a take is cut only when it has the full pattern
    filler (short voiced run) | gap >= min_gap | speech | gap >= min_gap | filler (short voiced run)
A missing, merged or swallowed filler returns None, so the caller re-synthesises instead of guessing, because a guess
can drop a real word: a short final word after an internal pause looks like a filler. `removed()` gives the cut-off
pieces so a caller can also check by ear (whisper) that they hold only the filler.

Where to cut (v3): not at the -40 dB run edge plus a fixed margin. A Korean sentence often ends in a soft decay
(the vowel of -다 fading at -41..-56 dB for 100-300 ms) and often starts with a soft consonant (ㅎ ㅅ ㅈ) that never
crosses -40 dB; v2 cut them off, and the +13 dB loudness gain afterwards made the chop audible ("…였습" with 다
gone). v3 measures each gap's own noise floor and follows the sound that is continuous with the sentence (frames
above floor + SETTLE_DB, dips up to MAX_DIP allowed) until it settles, then adds a short margin. A breath separated
from the sentence by silence stays out. Sound still continuing at the middle of a gap is rejected (re-synthesised).
"""
import re

import numpy as np

PAD_HEAD, PAD_TAIL = '아아. [pause] ', ' [pause] 아아.'
VOICED_DB = -40
FILLER_MIN, FILLER_MAX = 0.08, 0.95   # seconds of voice in "아아"
SETTLE_DB = 12          # a decay or breath louder than the gap's noise floor + this still belongs to the sentence
FLOOR_MAX_DB = -50      # a gap whose floor is louder than this is not a silence: reject
MAX_DIP = 0.06          # a dip below floor + SETTLE_DB shorter than this does not end the sound (stop closures)
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


def follow(db, start, stop, thr, max_dip):
    """walk frame by frame from `start` toward `stop` (exclusive) while the sound continues: frames above `thr`, dips
    up to `max_dip` frames allowed. Returns the last sounding frame, or None when the sound runs into `stop`."""
    d = 1 if stop > start else -1
    last, dip, k = start - d, 0, start
    while k != stop:
        if db[k] > thr: last, dip = k, 0
        else:
            dip += 1
            if dip > max_dip: return last
        k += d
    return last if dip else None


def cut(a, sr, min_gap=0.2, pre=0.04, post=0.05, fade=0.008):
    """returns (clip, info) or (None, reason). info has 'cut', 'head', 'tail' (filler runs, seconds), the gaps, the gap
    floors and where the sentence's sound really starts and settles ('onset', 'settled')."""
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
    fr = lambda t: int(round(t / step))
    h0, h1 = fr(head[1]), fr(nxt[0]); hm = (h0 + h1) // 2      # head gap frames, its middle
    t0, t1 = fr(prv[1]), fr(tail[0]); tm = (t0 + t1) // 2      # tail gap frames, its middle
    hfloor = float(np.percentile(db[h0:h1], 20)); tfloor = float(np.percentile(db[t0:t1], 20))
    if hfloor > FLOOR_MAX_DB or tfloor > FLOOR_MAX_DB:
        return None, f'gaps are not silent (floor {hfloor:.0f} / {tfloor:.0f} dB)'
    dip = max(1, int(round(MAX_DIP / step)))
    first = follow(db, h1 - 1, hm - 1, hfloor + SETTLE_DB, dip)    # walk back from the speech into the head gap
    if first is None: return None, 'sound continues past the middle of the head gap'
    last = follow(db, t0, tm, tfloor + SETTLE_DB, dip)             # walk on from the speech into the tail gap
    if last is None: return None, 'the sentence is still sounding at the middle of the tail gap'
    onset, settled = first * step, (last + 1) * step      # first == h1 / last == t0 - 1: nothing extra on that side
    s0 = max(hm * step, onset - pre); s1 = min(tm * step, settled + post)
    clip = a[int(s0 * sr):int(s1 * sr)].copy()
    f = min(int(fade * sr), len(clip) // 2); r = np.linspace(0, 1, f, dtype=np.float32)
    if f: clip[:f] *= r; clip[-f:] *= r[::-1]
    return clip, {'cut': (s0, s1), 'head': head, 'tail': tail, 'onset': round(onset, 3), 'settled': round(settled, 3),
                  'floors': (round(hfloor, 1), round(tfloor, 1)), 'head_gap': round(head_gap, 2), 'tail_gap': round(tail_gap, 2)}


def removed(a, sr, info):
    """everything cut off: the whole prefix before and the whole suffix after the kept clip (exact cut samples)."""
    s0, s1 = info['cut']
    return a[:int(s0 * sr)], a[int(s1 * sr):]


def edge_db(clip, sr, ms=30):
    """(start, end): level of the first and last `ms` of a clip relative to its speech level (90th percentile of 10 ms
    frames), in dB. A clean cut sits on silence (-35 dB or lower); a chopped syllable reads -15..-25 dB. Whisper cannot
    see this: it completes a clipped "…였습" to "…였습니다" from context."""
    db, step = envelope_db(clip, sr)
    speech = float(np.percentile(db, 90))
    w = max(1, int(round(ms / 1000 / step)))
    lvl = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
    n = int(sr * ms / 1000)
    return round(lvl(clip[:n]) - speech, 1), round(lvl(clip[-n:]) - speech, 1)


def edges_ok(clip, sr, limit_db=-30):
    s, e = edge_db(clip, sr)
    return s <= limit_db and e <= limit_db


def is_filler_text(text):
    """True only when the piece was positively heard as filler; empty or unsure output is a rejection."""
    return bool(FILLER_TEXT.match(text or ''))


# a merged multi-turn result (narrate_soma http mode): turns joined by a fixed run of digital silence
def split_at_silence(a, sr, n, min_s, max_s=None):
    """a: int16 samples of a merged result; the n - 1 all-zero runs of min_s..max_s are the turn boundaries (a longer
    run is two gaps around an empty turn: no cut, so the count fails). Returns n pieces, or None when the count of such
    runs is not n - 1."""
    z = np.concatenate([[0], (a == 0).astype(np.int8), [0]])
    d = np.diff(z); st, en = np.where(d == 1)[0], np.where(d == -1)[0]
    runs = [(b, e) for b, e in zip(st, en)
            if e - b >= min_s * sr and (max_s is None or e - b <= max_s * sr) and b > 0 and e < len(a)]
    if len(runs) != n - 1: return None
    cuts = [0] + [x for b, e in runs for x in (b, e)] + [len(a)]
    return [a[cuts[2 * i]:cuts[2 * i + 1]] for i in range(n)]
