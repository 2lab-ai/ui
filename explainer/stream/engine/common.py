"""shared motion helpers: clock, easing, smooth noise, springs, segment lookup."""
import math, wave
import numpy as np

FPS = 30
rng = np.random.default_rng(11)   # one seeded stream for the whole build, so a build is reproducible
# the main streamer's walk off / back in (seconds): the body path lives in build.py, the pose in the rig
EXIT_WALK, EXIT_GONE = 1.15, 3.3          # she starts walking 1.15 s after rising, gone at 3.3 s
RET_WALK, RET_PAUSE_END, RET_SIT_END, RET_END = 1.9, 2.25, 2.9, 3.7   # walk in, stand at the seat, sit, settle




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


def seg_at(segs, t, who, default):
    val = default
    for t0, t1, v, w in segs:
        if w == who and t0 <= t < t1: val = v
    return val


