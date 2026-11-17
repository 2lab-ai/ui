"""Beat script + themes -> timeline.json (per-frame stage state) + events.json (audio events, mix and review settings).
usage: python build.py --beats <beats.py> --audio <voice dir> --out <build dir>
                       [--streaming default] [--streamer kate] [--content reading-book]
The beats file is the content: it drives the Builder (say, Paint strokes, typing, chat, donation, AFK). The streaming theme
is the platform look (overlay CSS, strings, donation TTS), the streamer theme is who is on screen (models, rigs, voices,
room, motion), the content theme is what the stream does (activity layout, chat pools, review rubric lines)."""
import argparse, importlib.util, json, math, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from hangul import keys_for, simulate, SHIFT, decompose
from common import FPS, rng, ease, minjerk, Noise1D, EXIT_WALK, EXIT_GONE, RET_WALK, RET_PAUSE_END, RET_SIT_END, RET_END
from lipsync import voice_tracks
import themes as TH

L = {}    # merged layout (filled by configure() before the beats are imported, mutated in place so `from build import CV` works)
CV = {}   # the Paint canvas rectangle on screen


def configure(layout):
    L.clear(); L.update(layout); CV.clear(); CV.update(layout['canvas'])


class Builder:
    def __init__(self, audio_dir):
        self.audio_dir = audio_dir
        self.t = 0.0
        self.hand_t = 0.0
        self.cur = [CV['x'] + 640, CV['y'] + 300]
        self.samples = [(0.0, self.cur[0], self.cur[1])]   # cursor path (t, x, y)
        self.tool_ev = [(0.0, 'pencil')]
        self.ops = []          # (t, op dict)
        self.sfx = []          # (t, kind, extra)
        self.voices = []       # (who, id, t0, dur)
        self.gaze = []         # (t0, t1, target, who)
        self.expr = []         # (t0, t1, name, who)
        self.chat = []         # (t, user, msg)
        self.alerts = []
        self.brb = None
        self.main_out = []     # (t_out, t_in)
        self.sis_win = []      # (t_in, t_out)
        self.scratch = []      # (t0, t1)
        self.think = []        # (t0, t1)
        self.laughs = []       # (t, who, strength)
        self.typing = []       # (t0, t1, who)
        self.meta = {}
        self.text_boxes = {}
        self.tool = 'pencil'
        self.afk = None        # (t_leave, t_back)
        self.jumps = []        # (t, seconds skipped) edited-VOD jump cuts
        self.talk_busy = []

    # ---------------- voices
    def dur(self, lid):
        if lid not in self.meta:
            self.meta[lid] = json.load(open(os.path.join(self.audio_dir, lid + '.json')))
        return self.meta[lid]['dur']

    def say(self, lid, gap=0.35, gaze=None, expr=None, at=None):
        d = self.dur(lid)
        who = self.meta[lid].get('who') or ('sis' if lid.startswith('s') else 'main')
        t0 = self.t if at is None else at
        self.voices.append((who, lid, t0, d))
        if gaze: self.gaze.append((t0 - 0.25, t0 + d, gaze, who))
        if expr: self.expr.append((t0 - 0.1, t0 + d + 0.3, expr, who))
        self.t = t0 + d + gap
        return t0, t0 + d

    def wait(self, s): self.t += s

    def hand_at(self, t):
        self.hand_t = max(self.hand_t, t)

    def sync_hand(self, slack=0.2):
        self.t = max(self.t, self.hand_t + slack)

    # ---------------- mouse
    def _path(self, t0, pts_t):
        self.samples.extend(pts_t)

    def move(self, x, y, t0=None, dur=None, settle=True):
        t0 = max(self.hand_t, t0 if t0 is not None else self.hand_t)
        x0, y0 = self.cur
        dist = math.hypot(x - x0, y - y0)
        if dist < 1: self.hand_t = t0; return t0
        if dur is None: dur = 0.22 + 0.11 * math.log2(1 + dist / 25) + rng.uniform(-0.04, 0.06)
        # overshoot for long moves
        ov = 0.05 * rng.uniform(0.3, 1.0) if dist > 250 else 0.0
        tx, ty = x + (x - x0) * ov, y + (y - y0) * ov
        nx, ny = -(y - y0) / dist, (x - x0) / dist
        bow = dist * rng.uniform(-0.07, 0.07)
        n = max(3, int(dur * 120))
        pts = []
        for i in range(1, n + 1):
            s = minjerk(i / n)
            off = bow * math.sin(math.pi * s)
            pts.append((t0 + dur * i / n, x0 + (tx - x0) * s + nx * off + rng.normal(0, 0.25), y0 + (ty - y0) * s + ny * off + rng.normal(0, 0.25)))
        t1 = t0 + dur
        if ov > 0 and settle:
            cd = 0.13 + rng.uniform(0, 0.05); m = int(cd * 120)
            for i in range(1, m + 1):
                s = minjerk(i / m); pts.append((t1 + cd * i / m, tx + (x - tx) * s, ty + (y - ty) * s))
            t1 += cd
        self.samples.extend(pts); self.cur = [x, y]; self.hand_t = t1
        return t1

    def click(self, t=None, hold=0.075):
        t = self.hand_t if t is None else t
        self.sfx.append((t, 'mdown', None)); self.sfx.append((t + hold, 'mup', None))
        self.hand_t = t + hold + 0.05
        return t

    def pick_tool(self, name, t0=None):
        tx, ty = L['tools'][name]
        self.move(tx + rng.uniform(-3, 3), ty + rng.uniform(-3, 3), t0)
        self.hand_t += rng.uniform(0.08, 0.2)
        t = self.click()
        self.tool_ev.append((t, name)); self.ops.append((t, {'op': 'tool', 'name': name}))
        self.tool = name
        return self.hand_t

    # ---------------- drawing
    def stroke(self, path, speed=330.0, t0=None, width=4, wob=4.0, jit=0.9, snap=False, hook=False):
        """path in canvas coords (dense list). Mouse wobble added; drawn as 'seg' ops per frame."""
        p = np.array(path, float)
        # resample by arc length every 2 px
        seg = np.hypot(*np.diff(p, axis=0).T); cum = np.concatenate([[0], np.cumsum(seg)]); total = cum[-1]
        n = max(2, int(total / 2))
        s = np.linspace(0, total, n)
        P = np.stack([np.interp(s, cum, p[:, 0]), np.interp(s, cum, p[:, 1])], 1)
        # perpendicular wobble: low-frequency hand drift + tremor
        tang = np.gradient(P, axis=0); tn = np.hypot(*tang.T)[:, None] + 1e-6; tang /= tn
        nrm = np.stack([-tang[:, 1], tang[:, 0]], 1)
        ph = rng.uniform(0, 6.28, 3); wl = rng.uniform(40, 110, 3)
        w = sum(np.sin(s / wl[i] * 6.28 + ph[i]) * (wob / (i + 1)) for i in range(3))
        w *= np.clip(s / 25, 0, 1) * 0.7 + 0.3
        # not a filter: some stretches steady, some shaky
        wle = rng.uniform(70, 170); phe = rng.uniform(0, 6.28)
        w *= 0.3 + 1.25 * np.clip(0.5 + 0.5 * np.sin(s / wle * 6.28 + phe), 0, 1) ** 2
        drift = np.stack([np.cumsum(rng.normal(0, 0.35, n)), np.cumsum(rng.normal(0, 0.35, n))], 1)
        drift -= np.linspace(0, 1, n)[:, None] * drift[-1:] * 0.6
        P = P + nrm * w[:, None] + drift * 0.6 + rng.normal(0, jit, (n, 2))
        if hook and n > 8:   # the hand flicks at the end of a line
            d = P[-1] - P[-4]; d /= (np.hypot(*d) + 1e-6); side = np.array([-d[1], d[0]]) * rng.choice([-1, 1])
            L_ = rng.uniform(4, 9)
            P = np.concatenate([P, [P[-1] + d * L_ * 0.5 + side * L_ * 0.4, P[-1] + d * L_ * 0.6 + side * L_ * 0.9]])
            n = len(P)
        # time: bell velocity profile; mouse events at ~90 Hz -> polyline vertices
        dur = total / speed + 0.08
        t0 = max(self.hand_t, t0 if t0 is not None else self.hand_t)
        sx, sy = CV['x'] + P[0, 0], CV['y'] + P[0, 1]
        self.move(sx, sy, t0)
        self.hand_t += rng.uniform(0.05, 0.14)
        tstart = self.click(hold=0) ; self.sfx = self.sfx[:-1]   # mouse down only (up at the end)
        if snap: self.ops.append((tstart - 0.01, {'op': 'snap'}))
        k = max(2, int(dur * 90))
        # progress along the line: bell-shaped speed with an occasional mid-stroke hesitation
        u = np.linspace(0, 1, 400); v = np.sin(np.pi * np.clip(u, 0.02, 0.98)) ** 0.8 + 0.15
        if rng.random() < 0.45:
            p0 = rng.uniform(0.3, 0.7); v *= 1 - 0.85 * np.exp(-((u - p0) / 0.05) ** 2)
        v *= 1 + 0.25 * np.sin(u * rng.uniform(8, 15) + rng.uniform(0, 6))
        prog = np.cumsum(v); prog = (prog - prog[0]) / (prog[-1] - prog[0])
        idx = [min(n - 1, int(round(np.interp(i / k, u, prog) * (n - 1)))) for i in range(k + 1)]
        times = [tstart + dur * i / k for i in range(k + 1)]
        verts = [(times[i], P[idx[i], 0], P[idx[i], 1]) for i in range(k + 1)]
        # cursor follows, ops grouped per frame
        self.samples.extend((t, CV['x'] + x, CV['y'] + y) for t, x, y in verts)
        cur_f = None; buf = []; prev = None
        for t, x, y in verts:
            f = int(math.floor(t * FPS))
            if cur_f is None: cur_f = f
            if f != cur_f and buf:
                self.ops.append((cur_f / FPS, {'op': 'seg', 'pts': ([prev] if prev else []) + buf, 'w': width}))
                prev = buf[-1]; buf = []; cur_f = f
            buf.append([round(x, 1), round(y, 1)])
        if buf: self.ops.append((cur_f / FPS, {'op': 'seg', 'pts': ([prev] if prev else []) + buf, 'w': width}))
        tend = tstart + dur
        self.sfx.append((tend + 0.02, 'mup', None))
        self.cur = [CV['x'] + P[-1, 0], CV['y'] + P[-1, 1]]
        self.hand_t = tend + rng.uniform(0.06, 0.18)
        return tend

    def stickman(self, cx, cy, s=40, pose='stand', speed=300, parts=('head', 'body', 'arms', 'legs')):
        """cy = hip height. Head is lumpy and not closed, as drawn with a mouse. Structure is fixed per (cx, cy, s)
        so the parts can be drawn in separate calls (e.g. head+body, then an undo, then arms+legs)."""
        g = np.random.default_rng(int(cx * 7 + cy * 13 + s))
        hy = cy - 1.25 * s; r = 0.42 * s
        neck = (cx + g.normal(0, 1.5), hy + r * 0.95)
        a0 = g.uniform(-2.2, -0.8); sweep = 2 * math.pi + g.uniform(-0.45, 0.35)
        sq = g.uniform(0.86, 1.1)
        head = []
        for i in range(60):
            th = a0 + sweep * i / 59
            rr = r * (1 + 0.05 * math.sin(2 * th + 1.3) + 0.025 * math.sin(3 * th)) * (1 + 0.06 * i / 59)
            head.append((cx + rr * math.cos(th) * 1.08, hy + rr * math.sin(th) * sq))
        hipx = cx + g.normal(0, 3)
        body = [neck, (hipx, cy)]
        sh = (neck[0] + (hipx - neck[0]) * 0.28, neck[1] + (cy - neck[1]) * 0.28)
        arms = [[(sh[0] - 0.75 * s, sh[1] + 0.6 * s), sh, (sh[0] + 0.75 * s, sh[1] + 0.55 * s)]]
        legs = [[(hipx - 0.5 * s, cy + 1.05 * s), (hipx, cy), (hipx + 0.5 * s, cy + 1.05 * s)]]
        groups = {'head': [head], 'body': [body], 'arms': arms, 'legs': legs}
        end = 0
        for part in parts:
            for st in groups[part]:
                end = self.stroke(densify(st), speed=speed * rng.uniform(0.75, 1.25), wob=3.0 if part == 'head' else 3.2, jit=1.0, hook=part in ('arms', 'legs'))
        return end

    def stickman_parts(self, cx, cy, s=40, parts=('head', 'body'), speed=300):
        return self.stickman(cx, cy, s, speed=speed, parts=parts)

    # ---------------- typing
    def text_box(self, x, y, size=34, minw=300):
        if self.tool != 'text': self.pick_tool('text')
        self.move(CV['x'] + x + rng.uniform(2, 8), CV['y'] + y + rng.uniform(4, 10))
        self.hand_t += rng.uniform(0.1, 0.25)
        t = self.click()
        bid = len(self.text_boxes); self.text_boxes[bid] = {'x': x, 'y': y, 'size': size}
        self.ops.append((t + 0.06, {'op': 'tb_open', 'x': x, 'y': y, 'size': size, 'minw': minw}))
        self.hand_t = t + rng.uniform(0.3, 0.5)
        return bid

    def type(self, text, who='main', cps=1.0, typo=0.05, t0=None, prefix=''):
        """keystrokes with IME composition; prefix = text already in the box."""
        t = max(self.hand_t, t0 if t0 is not None else self.hand_t)
        tstart = t
        keys = keys_for(text)
        # typos only right after a space: a stray jamo is typed and backspaced while nothing else is composing,
        # so the finished text is exactly the intended one (a typo inside a syllable used to leave 'ㅂㅐ' behind)
        seq = []
        for i, k in enumerate(keys):
            seq.append((k, 'key'))
            if k == ' ' and rng.random() < typo * 3:
                wrong = rng.choice(list('ㅁㄴㅇㄹㅎㄱㅅ'))
                seq += [(wrong, 'typo'), ('\b', 'back')]
        ime_keys = []
        typed = []
        from hangul import IME
        ime = IME(); ime.done = ''
        for k, kind in seq:
            dt = rng.lognormal(math.log(0.135 / cps), 0.32)
            if k == ' ': dt += rng.uniform(0.03, 0.12)
            if k == '\n': dt += rng.uniform(0.25, 0.5)
            if kind == 'back': dt += rng.uniform(0.25, 0.45)
            if rng.random() < 0.04: dt += rng.uniform(0.3, 0.7)   # hesitation
            t += dt
            snd = 'space' if k == ' ' else 'enter' if k == '\n' else 'back' if k == '\b' else 'key'
            if k in SHIFT: self.sfx.append((t - 0.06, 'shift', None))
            self.sfx.append((t, snd, None))
            ime.key(k)
            done, comp = ime.state()
            self.ops.append((t, {'op': 'tb', 's': prefix + done, 'c': comp}))
        final = ime.state()[0] + ime.state()[1]
        assert final == text, (final, text)
        self.typing.append((tstart, t, who))
        self.hand_t = t + 0.15
        return prefix + final

    def commit_box(self, at=None):
        # click outside the box (on empty canvas) commits the text
        x, y = self.cur
        self.move(x + rng.uniform(80, 160), y + rng.uniform(60, 140), at)
        t = self.click()
        self.ops.append((t + 0.04, {'op': 'tb_commit'}))
        return t

    def undo(self, at=None):
        t = max(self.hand_t, at if at is not None else self.hand_t)
        self.sfx.append((t, 'ctrl', None)); self.sfx.append((t + 0.11, 'key', None))
        self.ops.append((t + 0.12, {'op': 'undo'}))
        self.hand_t = t + 0.35
        return t + 0.12

    def key(self, name, at=None):
        t = self.hand_t if at is None else at
        self.sfx.append((t, name, None)); self.hand_t = t + 0.12
        return t

    def drag_select(self, x0, y0, x1, y1):
        if self.tool != 'select': self.pick_tool('select')
        self.move(CV['x'] + x0, CV['y'] + y0)
        self.hand_t += 0.12
        t = self.hand_t; self.sfx.append((t, 'mdown', None))
        dur = 0.55; n = 40
        for i in range(1, n + 1):
            s = minjerk(i / n); x = x0 + (x1 - x0) * s; y = y0 + (y1 - y0) * s
            tt = t + dur * i / n
            self.samples.append((tt, CV['x'] + x + rng.normal(0, .3), CV['y'] + y + rng.normal(0, .3)))
            if i % 3 == 0 or i == n: self.ops.append((tt, {'op': 'sel', 'x': min(x0, x), 'y': min(y0, y), 'w': abs(x - x0), 'h': abs(y - y0)}))
        self.cur = [CV['x'] + x1, CV['y'] + y1]
        self.sfx.append((t + dur + 0.02, 'mup', None)); self.hand_t = t + dur + 0.2
        return self.hand_t

    # ---------------- overlays
    def msg(self, user, text, dt=0.0, at=None):
        self.chat.append(((self.t if at is None else at) + dt, user, text))

    def alert(self, user, amt, msg, dur=7.0, em='💪'):
        self.alerts.append({'t0': self.t, 't1': self.t + dur, 'user': user, 'amt': amt, 'msg': msg, 'em': em})
        self.sfx.append((self.t, 'alert', None)); self.sfx.append((self.t + 1.3, 'yuna', msg))
        t = self.t; self.t += dur * 0.62
        return t


def humanize(pts, rng, over=(6, 12)):
    """a mouse hand overshoots most corners a little and comes back"""
    out = [pts[0]]
    for a, b, c in zip(pts, pts[1:], pts[2:]):
        dx, dy = b[0] - a[0], b[1] - a[1]; L_ = math.hypot(dx, dy) or 1
        if rng.random() < 0.7:
            o = rng.uniform(*over); out += [(b[0] + dx / L_ * o, b[1] + dy / L_ * o), (b[0] + rng.normal(0, 1.5), b[1] + rng.normal(0, 1.5))]
        else: out.append(b)
    out.append(pts[-1]); return out


def densify(pts, step=3.0):
    out = [pts[0]]
    for a, b in zip(pts, pts[1:]):
        d = math.hypot(b[0] - a[0], b[1] - a[1]); n = max(1, int(d / step))
        for i in range(1, n + 1): out.append((a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n))
    return out


def load_beats(path):
    spec = importlib.util.spec_from_file_location('beats', path)
    mod = importlib.util.module_from_spec(spec); sys.modules['beats'] = mod
    sys.path.insert(0, os.path.dirname(os.path.abspath(path)))
    spec.loader.exec_module(mod)
    return mod


def build(beats_path, audio_dir, outdir, cfg):
    os.makedirs(outdir, exist_ok=True)
    sys.modules['build'] = sys.modules[__name__]   # beats do `from build import CV`: one module, also when run as __main__
    configure(cfg['layout'])
    mod = load_beats(beats_path)
    cast = cfg['streamer']['cast']
    B = Builder(audio_dir)
    B.lip_floor = {role: c.get('lip_floor', 0.82) for role, c in cast.items()}
    mod.script(B, rng)
    T = max(B.t, B.hand_t) + mod.TAIL
    N = int(T * FPS)
    # cursor per frame
    S = sorted(B.samples, key=lambda s: s[0])
    st = np.array([s[0] for s in S]); sx = np.array([s[1] for s in S]); sy = np.array([s[2] for s in S])
    ft = np.arange(N) / FPS
    idx = np.clip(np.searchsorted(st, ft, side='right') - 1, 0, len(S) - 1)
    # interpolate between sample idx and idx+1
    cx = np.interp(ft, st, sx); cy = np.interp(ft, st, sy)
    # idle micro drift when the hand is resting
    drift = Noise1D(99); drift2 = Noise1D(98)
    cx += np.array([1.2 * drift(t * 0.7) for t in ft]); cy += np.array([1.0 * drift2(t * 0.7) for t in ft])
    tools = sorted(B.tool_ev)
    kind = []
    hidden = set()
    for i in range(N):
        t = ft[i]
        tool = [tl for tt, tl in tools if tt <= t]; tool = tool[-1] if tool else 'pencil'
        inside = CV['x'] <= cx[i] < CV['x'] + CV['w'] and CV['y'] <= cy[i] < CV['y'] + CV['h']
        k = 0
        if inside: k = {'pencil': 1, 'text': 2, 'select': 3}.get(tool, 0)
        kind.append(k)
    vt = voice_tracks(B, N)
    rig = lambda role: importlib.import_module('rigs.' + cast[role]['rig'])
    PM = rig('main').synth(B, N, vt, list(zip(cx, cy)), cast['main'].get('motion'))
    PS, sis_sc, sis_sy = rig('sis').synth(B, N, vt, cast['sis'].get('motion')) if 'sis' in cast else ({}, np.ones(N), np.zeros(N))
    # main slide out / in, sis panel
    dy = np.zeros(N); dx = np.zeros(N); alpha = np.ones(N)
    msc = np.ones(N)
    if B.afk:
        tl, tb = B.afk   # she stands up, turns and walks off to the right; later she walks back in, stops at the seat and sits
        for i in range(N):
            t = ft[i]
            if tl <= t < tl + EXIT_GONE:
                r = t - tl
                up = ease(r / 0.9)
                dy[i] = -88 * up; dx[i] = 18 * up
                if r >= EXIT_WALK:   # walking: speeds up over ~0.6 s then a steady pace; the bob runs at step rate, not in lockstep with the travel
                    w = r - EXIT_WALK
                    travel = 1150 * (w ** 2 / (2 * 0.6) if w < 0.6 else 0.3 + (w - 0.6)) / (0.3 + (EXIT_GONE - EXIT_WALK - 0.6))
                    dx[i] = 18 + travel
                    dy[i] = -88 + 15 * abs(math.sin(w * 2 * math.pi * 0.95 + 0.4)) * min(1, w / 0.3)
                    msc[i] = 1 - 0.16 * min(1, w / (EXIT_GONE - EXIT_WALK))   # walking away from the webcam
            elif tl + EXIT_GONE <= t < tb: dy[i] = -88; dx[i] = 1300; msc[i] = 0.84
            elif tb <= t < tb + RET_END:
                r = t - tb
                if r < RET_WALK:   # walking in, slowing down to stop at the seat
                    u = r / RET_WALK; pos = 1 - (1 - u) ** 2.2
                    dx[i] = 1300 * (1 - pos); dy[i] = -88 + 15 * abs(math.sin(r * 2 * math.pi * 0.95)) * (1 - ease(u))
                    msc[i] = 0.84 + 0.16 * ease(u)
                elif r < RET_PAUSE_END: dy[i] = -88
                elif r < RET_SIT_END:   # sitting down: drops a little past the seat, then up
                    u = (r - RET_PAUSE_END) / (RET_SIT_END - RET_PAUSE_END)
                    dy[i] = -88 * (1 - ease(u)) + 9 * math.sin(math.pi * min(1, max(0, (u - 0.55) / 0.45)))
                else:
                    u = (r - RET_SIT_END) / (RET_END - RET_SIT_END)
                    dy[i] = 3 * math.sin(math.pi * u) * (1 - u); dx[i] = -6 * math.sin(math.pi * min(1, u * 1.6))   # shuffling the chair in
    px_ = np.full(N, 999.0); sis_mx = np.zeros(N); sis_rot = np.zeros(N); rn = Noise1D(77)
    def seg(t, pts):   # piecewise minimum-jerk through (time, value) keys
        if t <= pts[0][0]: return pts[0][1]
        for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
            if t0 <= t < t1: return v0 + (v1 - v0) * minjerk((t - t0) / (t1 - t0))
        return pts[-1][1]
    for t_in, t_out in B.sis_win:
        mxk = [(t_in, 340), (t_in + 0.35, 340), (t_in + 0.85, 280), (t_in + 1.0, 280), (t_in + 1.55, 210), (t_in + 2.0, 214), (t_in + 2.25, 206),
               (t_in + 2.75, 240), (t_in + 3.35, 175), (t_in + 3.7, 188), (t_out - 0.55, 188), (t_out - 0.4, 204), (t_out - 0.25, 198), (t_out + 0.12, 400)]
        rk = [(t_in, -0.58), (t_in + 2.75, -0.55), (t_in + 3.35, -0.31), (t_in + 3.7, -0.36), (t_out - 0.4, -0.36), (t_out + 0.12, -0.66)]
        if getattr(B, 'sis_keys', None):   # where she is and why: whispering a bit further in, checking the door, ...
            mxk = [k for k in mxk if not (t_in + 3.7 < k[0] < t_out - 0.55)] + [(t, m) for t, m, r_ in B.sis_keys if t_in + 3.7 < t < t_out - 0.55]
            rk = [k for k in rk if not (t_in + 3.7 < k[0] < t_out - 0.4)] + [(t, r_) for t, m, r_ in B.sis_keys if t_in + 3.7 < t < t_out - 0.55]
            mxk.sort(); rk.sort()
        # while she types on her sister's PC she leans in towards the keyboard (more of her in frame, more upright), then snaps back to the edge
        for a_, b_, w_ in B.typing:
            if w_ == 'sis' and t_in < a_ < t_out:
                ins_m = [(a_ - 0.9, 188), (a_ - 0.2, 105), (b_ + 0.15, 112), (b_ + 0.5, 190)]
                ins_r = [(a_ - 0.9, -0.36), (a_ - 0.2, -0.13), (b_ + 0.15, -0.15), (b_ + 0.5, -0.37)]
                mxk = sorted([k for k in mxk if not (a_ - 0.9 <= k[0] <= b_ + 0.5)] + ins_m)
                rk = sorted([k for k in rk if not (a_ - 0.9 <= k[0] <= b_ + 0.5)] + ins_r)
        for i in range(N):
            t = ft[i]
            if t_in <= t < t_out + 0.2:
                px_[i] = 0
                sis_mx[i] = seg(t, mxk) + (6 * rn(t * 0.6) if t_in + 3.7 <= t < t_out - 0.55 else 0)
                if t_out - 0.25 <= t: sis_mx[i] = 198 + (400 - 198) * ((t - t_out + 0.25) / 0.37) ** 2   # accelerating duck-out
                sis_rot[i] = seg(t, rk) + (0.04 * rn(t * 0.8) if t_in + 3.7 <= t < t_out - 0.4 else 0)
    vel = np.gradient(sis_mx) * FPS
    PS['ParamAngleX'] = np.clip(PS['ParamAngleX'] + vel * 0.035, -30, 30); PS['ParamBodyAngleX'] = np.clip(PS['ParamBodyAngleX'] + vel * 0.02, -10, 10)
    PS['ParamAngleZ'] = np.clip(PS['ParamAngleZ'] - np.gradient(sis_rot) * FPS * 8, -30, 30)
    ops = sorted(B.ops, key=lambda o: o[0])
    viewers = []; v = 287
    for s in range(int(T) + 2):
        v += int(rng.integers(-2, 4)) if s % 3 == 0 else 0; viewers.append(v)
    BADGE = getattr(mod, 'BADGES', {})
    COLORS = ['#ffb86b', '#8be9fd', '#50fa7b', '#ff79c6', '#bd93f9', '#f1fa8c', '#ff6e6e', '#7ee0c3', '#ffd0a8', '#a6b8ff']
    ucol = {}
    def col(u):
        if u not in ucol: ucol[u] = COLORS[len(ucol) % len(COLORS)]
        return ucol[u]
    r = lambda a: [round(float(x), 3) for x in a]
    tl = {
        'clock0': mod.CLOCK0, 'viewers': viewers,
        'chat': [dict({'f': int(t * FPS), 'u': '', 'c': col(u), 'm': m}, **({'b': BADGE[u][0], 'bc': BADGE[u][1]} if u in BADGE else {})) for t, u, m in sorted(B.chat)],
        'alerts': [{'f0': int(a['t0'] * FPS), 'f1': int(a['t1'] * FPS), 'user': a['user'], 'amt': a['amt'], 'msg': a['msg'], 'em': a['em']} for a in B.alerts],
        'brb': {'f0': int(B.brb[0] * FPS), 'f1': int(B.brb[1] * FPS), 'secs': getattr(mod, 'BRB_SECS', 300)} if B.brb else None,
        'cursor': {'x': r(cx), 'y': r(cy), 'k': kind},
        'ops': [dict(o, f=int(math.floor(t * FPS))) for t, o in ops],
        'main': {'p': {k: r(v) for k, v in PM.items()}, 'dx': r(dx), 'dy': r(dy), 'a': r(alpha), 'sc': r(msc)},
        'sis': {'p': {k: r(v) for k, v in PS.items()}, 'px': r(px_), 'sc': r(sis_sc), 'sy': r(sis_sy), 'mx': r(sis_mx), 'rot': r(sis_rot)},
        'jumps': [{'f': int(round(t * FPS)), 'add': a} for t, a in B.jumps],
        'frames': N,
        'layout': L,
        'stage': dict(TH.stage_config(cfg), title=getattr(mod, 'STREAM_TITLE', '')),
    }
    json.dump(tl, open(os.path.join(outdir, 'timeline.json'), 'w'), separators=(',', ':'), ensure_ascii=False)
    st, sr, ct = cfg['streaming'], cfg['streamer'], cfg['content']
    mix = {'audio_dir': os.path.abspath(audio_dir), 'sfx': {k: TH.cache_path(v) for k, v in sr['room'].get('sfx', {}).items()},
           'bgm': TH.cache_path(sr['room']['bgm']['file']), 'bgm_db': sr['room']['bgm'].get('db', -27),
           'donation_tts': st.get('donation_tts', {}), 'extra': dict(cast.get('sis', {}).get('whisper', {}), hard_drop=getattr(mod, 'WHISPER_HARD_DROP', []))}
    review = dict(getattr(mod, 'REVIEW', {}), rubric=st.get('review', []) + sr.get('review', []) + ct.get('review', []),
                  facts=st.get('review_facts', []) + sr.get('review_facts', []) + ct.get('review_facts', []),
                  roles={role: c.get('label', role) for role, c in cast.items()}, themes={k: cfg[k]['_id'] for k in TH.KINDS})
    ev = {'T': T, 'jumps': B.jumps, 'voices': B.voices, 'sfx': sorted(B.sfx, key=lambda s: s[0]), 'afk': B.afk, 'brb': B.brb, 'sis': B.sis_win,
          'mix': mix, 'review': review}
    json.dump(ev, open(os.path.join(outdir, 'events.json'), 'w'), ensure_ascii=False, indent=0)
    print(f'frames {N} ({T:.1f}s), ops {len(ops)}, chat {len(B.chat)}, sfx {len(B.sfx)}, voices {len(B.voices)}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--beats', required=True); ap.add_argument('--audio', required=True); ap.add_argument('--out', required=True)
    for k in TH.KINDS: ap.add_argument('--' + k, default=TH.DEFAULTS[k])
    a = ap.parse_args()
    build(a.beats, a.audio, a.out, TH.load(a.streaming, a.streamer, a.content))
