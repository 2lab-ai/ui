"""shared motion helpers: clock, easing, smooth noise, springs, segment lookup."""
import math, wave
import numpy as np

FPS = 30
rng = np.random.default_rng(11)   # one seeded stream for the whole build, so a build is reproducible
# the main streamer's walk off / back in (seconds): the body path lives in build.py, the pose in the rig
AFK_TIMING = {   # seconds from standing up (exit_*) / from coming back (ret_*); the streamer theme picks a style
    # walk: she turns and walks out of frame, later walks back in
    'walk': dict(exit_walk=1.35, exit_gone=2.65, ret_walk=1.3, ret_pause_end=1.85, ret_sit_end=2.5, ret_end=3.3),
    # track_lost: she turns and steps toward the frame edge, face tracking is lost (the model freezes), then the model hides
    # (VTube Studio-style); coming back, tracking catches her face, the model appears and follows her into the seat
    'track_lost': dict(exit_walk=1.1, exit_gone=1.65, lost_fade=(2.1, 2.4), ret_walk=1.0, ret_pause_end=1.25, ret_sit_end=1.8,
                       ret_end=2.6, back_fade=0.25),
}
_W = AFK_TIMING['walk']
EXIT_WALK, EXIT_GONE = _W['exit_walk'], _W['exit_gone']
RET_WALK, RET_PAUSE_END, RET_SIT_END, RET_END = _W['ret_walk'], _W['ret_pause_end'], _W['ret_sit_end'], _W['ret_end']




def rd(p):
    with wave.open(p) as w: n = w.getnframes(); d = w.readframes(n); sr = w.getframerate()
    return np.frombuffer(d, dtype=np.int16).astype(np.float32) / 32768, sr


def ease(x): x = min(1, max(0, x)); return x * x * (3 - 2 * x)
def minjerk(x): x = min(1, max(0, x)); return 10 * x ** 3 - 15 * x ** 4 + 6 * x ** 5


class Noise1D:
    """smooth value noise"""
    def __init__(self, seed, n=4096):
        r = np.random.default_rng(seed); self.v = r.uniform(-1, 1, n); self.n = n
    def __call__(self, t):
        i = math.floor(t); f = t - i; a = self.v[i % self.n]; b = self.v[(i + 1) % self.n]
        return a + (b - a) * (f * f * (3 - 2 * f))


class Spring:
    def __init__(self, x=0.0, k=0.25): self.x = x; self.k = k
    def __call__(self, tgt, k=None): self.x += (tgt - self.x) * (k or self.k); return self.x


_SEG = {}   # (id(list), who) -> (len, {second: [(t0, t1, v), ...] in list order}): a 30-minute stream has ~1000 cues


def seg_at(segs, t, who, default):
    """the value of the last cue in `segs` (t0, t1, value, who) that covers t, else default. Cues are bucketed per
    second once per list, so a long stream does not rescan every cue on every frame."""
    key = (id(segs), who)
    c = _SEG.get(key)
    if c is None or c[0] != len(segs) or c[2] is not segs:
        bins = {}
        for t0, t1, v, w in segs:
            if w != who: continue
            for b in range(int(math.floor(t0)), int(math.floor(min(t1, t0 + 7200))) + 1):
                bins.setdefault(b, []).append((t0, t1, v))
        c = (len(segs), bins, segs); _SEG[key] = c
    val = default
    for t0, t1, v in c[1].get(int(math.floor(t)), ()):
        if t0 <= t < t1: val = v
    return val


