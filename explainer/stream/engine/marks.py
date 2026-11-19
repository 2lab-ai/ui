"""Live marks on a prepared page (book/RESEARCH.md; edit/RESEARCH.md §4.3): what the streamer does by hand while she talks
over a page pasted with B.paste_image — underline a phrase, circle a number, an arrow, an X, a bracket, a tick, a typed note.
Boxes come from engine/pages.mjs (<id>.boxes.json, canvas px). Every mark is a mouse stroke (B.stroke), so it wobbles,
makes mouse sounds and moves the cursor; the colour is Paint's colour 1 (B.pick_color) — red by default.
usage in beats.py:  from marks import Marker;  K = Marker(B);  K.underline(box); K.circle(box); K.arrow(p0, p1)"""
import math, random
from build import densify


def _quad(p0, p1, p2, n=24):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in (i / n for i in range(n + 1))]


class Marker:
    """No two marks alike (a hand never repeats itself): every call draws its own start point, size, tilt, overshoot,
    speed and ending from its own random stream; underlines follow the text line by line when a phrase wraps."""
    def __init__(self, B, color='red', width=4, seed=20261119):
        self.B = B; self.color = color; self.width = width; self.R = random.Random(seed)

    def _pen(self, color=None):
        B = self.B; c = color or self.color
        if B.tool != 'pencil': B.pick_tool('pencil')
        want = {'red': '#ed1c24', 'black': '#000000', 'blue': '#00a2e8', 'purple': '#a349a4', 'darkred': '#880015', 'green': '#22b14c', 'orange': '#ff7f27'}.get(c)
        if want and B.color != want: B.pick_color(c)

    def _go(self, pts, speed=420, wob=2.2, jit=0.5, hook=False, color=None, width=None):
        self._pen(color)
        return self.B.stroke(densify(pts), speed=speed, wob=wob, jit=jit, hook=hook, width=width or self.width)

    @staticmethod
    def _union(box):
        rs = box.get('rects') or [box]
        x0 = min(r['x'] for r in rs); y0 = min(r['y'] for r in rs); x1 = max(r['x'] + r['w'] for r in rs); y1 = max(r['y'] + r['h'] for r in rs)
        return {'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0}

    def underline(self, box, color=None, pad=4, gap=5, double=False):
        """under the text itself, one stroke per line the phrase wraps to (the pen lifts and jumps to the next line);
        each line its own start, length, slope and bow; now and then a flick at the end, a wavy line or a second line"""
        R = self.R; rs = box.get('rects') or [box]; t = None
        for i, r in enumerate(rs):
            y = r['y'] + r['h'] - r['h'] * R.uniform(0.02, 0.12) + R.uniform(1, 5)
            x0 = r['x'] - R.uniform(-3, pad + 6); x1 = r['x'] + r['w'] + R.uniform(-10, pad + 8)
            slope = R.uniform(-5, 2.5) * (x1 - x0) / 300; bow = R.uniform(-3, 3)
            if len(rs) == 1 and r['w'] < 260 and R.random() < 0.05:      # wavy, rarely and only under a short word
                n = max(6, int((x1 - x0) / 11)); amp = R.uniform(2, 3.5)
                pts = [(x0 + (x1 - x0) * k / n, y + slope * k / n + (amp if k % 2 else -amp)) for k in range(n + 1)]
            else:
                pts = _quad((x0, y), ((x0 + x1) / 2 + R.uniform(-20, 20), y + slope / 2 + bow), (x1, y + slope))
            t = self._go(pts, speed=R.uniform(470, 820), wob=R.uniform(1.0, 2.6), jit=R.uniform(0.3, 0.7), hook=R.random() < 0.4, color=color)
            if (double and i == len(rs) - 1) or (not double and len(rs) == 1 and R.random() < 0.08):
                a = x0 + R.uniform(0, (x1 - x0) * 0.25); b = x1 - R.uniform(0, (x1 - x0) * 0.3); dy = R.uniform(5, 9)
                t = self._go(_quad((a, y + dy), ((a + b) / 2, y + dy + R.uniform(-2, 2)), (b, y + dy + slope * 0.8)), speed=R.uniform(600, 900), color=color)
        return t

    def circle(self, box, color=None, pad=12, seed=0):
        """an ellipse around a word, drawn in one go: its own start (mostly upper left), direction, size, tilt, lumps,
        a spiral drift so the end misses the start, and an overshoot (now and then a second loop)"""
        R = self.R; b = self._union(box)
        cx = b['x'] + b['w'] / 2 + R.uniform(-4, 4); cy = b['y'] + b['h'] / 2 + R.uniform(-3, 3)
        # snug like a hand: the oval clears the letters (the text box has air above and below the glyphs) without
        # swallowing the neighbours
        ry = b['h'] / 2 + R.uniform(4, 10) + min(pad, 12) * 0.2
        rx = b['w'] / 2 * R.uniform(1.06, 1.17) + R.uniform(6, 14) + min(pad, 12) * 0.3
        tilt = R.uniform(-0.08, 0.08) * min(1, 80 / max(40, b['w'])); d = 1 if R.random() < 0.7 else -1
        a0 = R.uniform(-2.9, -1.5) if R.random() < 0.65 else R.uniform(-math.pi, math.pi)
        sweep = 2 * math.pi + R.uniform(0.15, 0.85) if R.random() < 0.9 else 4 * math.pi - R.uniform(0.4, 1.4)
        spiral = R.uniform(-0.04, 0.12); egg = R.uniform(0, 0.06); ph = [R.uniform(0, 6.28) for _ in range(3)]
        h2, h3 = R.uniform(0.01, 0.06), R.uniform(0.0, 0.035)
        n = int(60 * sweep / (2 * math.pi)); pts = []
        for i in range(n + 1):
            u = i / n; th = a0 + d * sweep * u
            k = (1 + spiral * u) * (1 + h2 * math.sin(2 * th + ph[0]) + h3 * math.sin(3 * th + ph[1]) + egg * math.cos(th - ph[2]))
            ex, ey = rx * k * math.cos(th), ry * k * math.sin(th)
            pts.append((cx + ex * math.cos(tilt) - ey * math.sin(tilt), cy + ex * math.sin(tilt) + ey * math.cos(tilt)))
        return self._go(pts, speed=R.uniform(470, 760), wob=R.uniform(1.2, 2.4), color=color)

    def box(self, box, color=None, pad=8):
        """four sides in one stroke from a random corner, corners a little over- or undershot, the end crossing the start"""
        R = self.R; b = self._union(box)
        x0, y0, x1, y1 = b['x'] - pad - R.uniform(0, 5), b['y'] - pad - R.uniform(0, 4), b['x'] + b['w'] + pad + R.uniform(0, 6), b['y'] + b['h'] + pad + R.uniform(0, 4)
        cs = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]; k = R.randrange(4); cs = cs[k:] + cs[:k]
        if R.random() < 0.3: cs = cs[::-1]
        pts = [(x + R.uniform(-4, 4), y + R.uniform(-3, 3)) for x, y in cs] + [(cs[0][0] + R.uniform(-3, 8), cs[0][1] + R.uniform(-8, 3))]
        return self._go(pts, speed=R.uniform(480, 700), color=color)

    def arrow(self, p0, p1, color=None, head=18):
        R = self.R; bend = R.uniform(-0.12, 0.12)
        mid = ((p0[0] + p1[0]) / 2 + (p1[1] - p0[1]) * bend, (p0[1] + p1[1]) / 2 - (p1[0] - p0[0]) * bend)
        t = self._go(_quad(p0, mid, p1, 16), speed=R.uniform(420, 700), color=color)
        a = math.atan2(p1[1] - mid[1], p1[0] - mid[0]); hd = head * R.uniform(0.75, 1.25); sp = R.uniform(0.38, 0.62)
        q1 = (p1[0] - hd * math.cos(a - sp), p1[1] - hd * math.sin(a - sp)); q2 = (p1[0] - hd * math.cos(a + sp) * R.uniform(0.8, 1.1), p1[1] - hd * math.sin(a + sp) * R.uniform(0.8, 1.1))
        if R.random() < 0.5: return self._go([q1, p1, q2], speed=R.uniform(380, 560), color=color)   # one V stroke
        self._go([q1, p1], speed=R.uniform(380, 560), color=color)
        return self._go([p1, q2], speed=R.uniform(380, 560), color=color)

    def cross(self, box, color=None, pad=6):
        R = self.R; b = self._union(box)
        x0, y0, x1, y1 = b['x'] - pad, b['y'] - pad, b['x'] + b['w'] + pad, b['y'] + b['h'] + pad
        j = lambda: R.uniform(-6, 6)
        self._go([(x0 + j(), y0 + j()), (x1 + j(), y1 + j())], speed=R.uniform(550, 800), color=color)
        return self._go([(x1 + j(), y0 + j()), (x0 + j(), y1 + j())], speed=R.uniform(550, 800), color=color)

    def strike(self, box, color=None):
        R = self.R; t = None
        for r in box.get('rects') or [box]:
            y = r['y'] + r['h'] * R.uniform(0.48, 0.62)
            t = self._go([(r['x'] - R.uniform(0, 7), y + R.uniform(-1, 3)), (r['x'] + r['w'] + R.uniform(-2, 8), y + R.uniform(-4, 1))], speed=R.uniform(520, 760), color=color)
        return t

    def tick(self, x, y, s=26, color=None):
        R = self.R; s *= R.uniform(0.8, 1.2)
        return self._go([(x, y), (x + s * R.uniform(0.28, 0.42), y + s * R.uniform(0.38, 0.55)), (x + s * R.uniform(0.9, 1.15), y - s * R.uniform(0.5, 0.75))], speed=R.uniform(380, 560), color=color)

    def bracket(self, box, side='left', color=None, pad=14):
        x = box['x'] - pad if side == 'left' else box['x'] + box['w'] + pad
        d = -10 if side == 'left' else 10
        return self._go([(x - d, box['y']), (x, box['y'] + 8), (x, box['y'] + box['h'] - 8), (x - d, box['y'] + box['h'])], color=color)

    def note(self, x, y, text, size=30, color=None):
        """a few words typed in colour 1 with Paint's text tool (her 'handwriting': "장난?", "x14", "???")"""
        self._pen(color)
        B = self.B
        B.text_box(x, y, size=size, minw=max(80, int(len(text) * size * 0.9)))
        B.type(text, cps=1.3, typo=0.0)
        return B.commit_box()

    def curve(self, pts, color=None, speed=360):
        """a free hand line through points (a sketched graph, a bell curve)"""
        return self._go(pts, speed=speed, wob=2.6, jit=0.6, color=color)


def bell(x0, x1, base, height, n=60, skew=0.0):
    """points of a bell curve (the idea diffusion curve) from x0 to x1 on a base line"""
    pts = []
    for i in range(n + 1):
        u = i / n; z = (u - 0.5 - skew) / 0.17
        pts.append((x0 + (x1 - x0) * u, base - height * math.exp(-0.5 * z * z)))
    return pts
