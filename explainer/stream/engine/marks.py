"""Live marks on a prepared page (book/RESEARCH.md; edit/RESEARCH.md §4.3): what the streamer does by hand while she talks
over a page pasted with B.paste_image — underline a phrase, circle a number, an arrow, an X, a bracket, a tick, a typed note.
Boxes come from engine/pages.mjs (<id>.boxes.json, canvas px). Every mark is a mouse stroke (B.stroke), so it wobbles,
makes mouse sounds and moves the cursor; the colour is Paint's colour 1 (B.pick_color) — red by default.
usage in beats.py:  from marks import Marker;  K = Marker(B);  K.underline(box); K.circle(box); K.arrow(p0, p1)"""
import math
from build import densify


class Marker:
    def __init__(self, B, color='red', width=4):
        self.B = B; self.color = color; self.width = width

    def _pen(self, color=None):
        B = self.B; c = color or self.color
        if B.tool != 'pencil': B.pick_tool('pencil')
        want = {'red': '#ed1c24', 'black': '#000000', 'blue': '#00a2e8', 'purple': '#a349a4', 'darkred': '#880015', 'green': '#22b14c', 'orange': '#ff7f27'}.get(c)
        if want and B.color != want: B.pick_color(c)

    def _go(self, pts, speed=420, wob=2.2, jit=0.5, hook=False, color=None, width=None):
        self._pen(color)
        return self.B.stroke(densify(pts), speed=speed, wob=wob, jit=jit, hook=hook, width=width or self.width)

    def underline(self, box, color=None, pad=4, gap=5, double=False):
        """a slightly rising line under a phrase; double=True adds a second, shorter one"""
        x0, x1, y = box['x'] - pad, box['x'] + box['w'] + pad, box['y'] + box['h'] + gap
        t = self._go([(x0, y + 1.5), ((x0 + x1) / 2, y), (x1, y - 2)], hook=True, color=color)
        if double: t = self._go([(x0 + 6, y + 8), (x1 - 10, y + 6)], color=color)
        return t

    def circle(self, box, color=None, pad=12, seed=0):
        """an ellipse around a number or word, drawn in one go, not closed (the end overshoots the start)"""
        cx, cy = box['x'] + box['w'] / 2, box['y'] + box['h'] / 2
        rx, ry = box['w'] / 2 + pad, box['h'] / 2 + pad * 0.8
        a0 = -2.3 + 0.3 * math.sin(seed); sweep = 2 * math.pi + 0.45
        ths = [a0 + sweep * i / 50 for i in range(51)]
        pts = [(cx + rx * (1 + 0.04 * math.sin(3 * th + seed)) * math.cos(th), cy + ry * (1 + 0.05 * math.cos(2 * th)) * math.sin(th)) for th in ths]
        return self._go(pts, speed=520, wob=1.8, color=color)

    def box(self, box, color=None, pad=8):
        x0, y0, x1, y1 = box['x'] - pad, box['y'] - pad, box['x'] + box['w'] + pad, box['y'] + box['h'] + pad
        return self._go([(x0, y0), (x1 + 4, y0 - 1), (x1, y1), (x0 - 2, y1 + 1), (x0 + 1, y0 - 5)], speed=520, color=color)

    def arrow(self, p0, p1, color=None, head=18):
        t = self._go([p0, ((p0[0] + p1[0]) / 2 + (p1[1] - p0[1]) * 0.06, (p0[1] + p1[1]) / 2 - (p1[0] - p0[0]) * 0.06), p1], color=color)
        a = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
        for s in (1, -1):
            q = (p1[0] - head * math.cos(a - s * 0.5), p1[1] - head * math.sin(a - s * 0.5))
            t = self._go([q, p1] if s > 0 else [p1, q], speed=380, color=color)
        return t

    def cross(self, box, color=None, pad=6):
        x0, y0, x1, y1 = box['x'] - pad, box['y'] - pad, box['x'] + box['w'] + pad, box['y'] + box['h'] + pad
        self._go([(x0, y0), (x1, y1)], speed=600, color=color)
        return self._go([(x1, y0), (x0, y1)], speed=600, color=color)

    def strike(self, box, color=None):
        y = box['y'] + box['h'] * 0.55
        return self._go([(box['x'] - 4, y + 2), (box['x'] + box['w'] + 4, y - 2)], speed=560, color=color)

    def tick(self, x, y, s=26, color=None):
        return self._go([(x, y), (x + s * 0.35, y + s * 0.45), (x + s, y - s * 0.6)], speed=420, color=color)

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
