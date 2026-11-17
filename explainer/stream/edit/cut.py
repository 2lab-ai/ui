"""Live-stream VOD -> fast edit (편집본): cold open, title card with the channel jingle, the stream jump-cut to the lines that
matter, punch-in zooms, burned-in captions, the editor's jokes, chat bubbles, sped-up drawing, an end card.
usage: python cut.py <episode dir> <live build dir> <out dir> [--plan-only] [--jobs 8]
  <episode dir>: edit_plan.py, lines.json, subs_en.json (and the props the plan names)
  <live build dir>: final.mp4, mix_dry.wav (engine/mix.py), events.json, timeline.json, marks.json
  out: final_edit.mp4, subs_ko.srt, subs_en.srt, chapters_ko.txt, chapters_en.txt, edl.json (what review_edit.py reads)
How the main part is cut: every line the plan keeps stays whole; the silence between two kept lines goes, except for what is
worth seeing there — a donation alert, the walk-off and return, the extra coming and going (kept at 1x) and drawing or typing
(sped up 2-6x with a badge). Lines in DROP are cut with their pauses.
The editor's marks come from three reference edits (RESEARCH.md §4): a streamer's gag edit (caption voice by tone, state labels
over the head, handwritten narration, corner labels, a punch-in on the live chat, a result card, a bonus clip under the end
card), a calm book channel (real photos for every concrete example, a dark thesis card for the one line) and a live-stream
channel (a "생방송 내용입니다" label). Every mark is optional in edit_plan.py."""
import argparse, importlib.util, json, math, os, subprocess, sys, wave
from concurrent.futures import ThreadPoolExecutor
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FPS, SR = 30, 48000
CACHE = os.environ.get('STREAM_CACHE') or os.path.join(os.path.expanduser('~'), '.cache', '2lab-stream')
FONT = 'file://' + os.path.join(CACHE, 'fonts', 'pretendard') + '/'
EFONT = 'file://' + os.path.join(CACHE, 'fonts', 'edit') + '/'   # engine/setup_assets.py EDIT_FONTS (OFL)
PRE, POST = 0.06, 0.14          # air kept before and after a line
JOIN = 0.30                     # two kept lines closer than this play through (no cut)
TL_MIN, TL_ON = 3.0, 1.3        # drawing/typing in a gap: shorter clusters are cut out, longer ones play about TL_ON s sped up
PURPLE = '#7c3aed'


def load_plan(path):
    spec = importlib.util.spec_from_file_location('edit_plan', path)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


# ---------------------------------------------------------------------------------------------------- the cut list
class Cut:
    def __init__(self, ep, bd, plan):
        self.ep, self.bd, self.P = ep, bd, plan
        self.ev = json.load(open(os.path.join(bd, 'events.json')))
        self.tl = json.load(open(os.path.join(bd, 'timeline.json')))
        self.R = json.load(open(os.path.join(bd, 'marks.json'))) if os.path.exists(os.path.join(bd, 'marks.json')) else {}
        self.V = {lid: (who, t0, d) for who, lid, t0, d in self.ev['voices']}
        self.L = {l['id']: l for l in json.load(open(os.path.join(ep, 'lines.json')))}
        en = os.path.join(ep, 'subs_en.json'); self.EN = json.load(open(en)) if os.path.exists(en) else {}
        self.ZOOM = dict(plan.ZOOM)
        for lid in getattr(plan, 'CHATZOOM', ()): self.ZOOM[lid] = 'chat'   # reference A: cut to the live chat when it erupts
        ops = self.tl['ops']
        self.draw_t = np.array(sorted(o['f'] / FPS for o in ops if o['op'] in ('seg', 'tb')))

    def at(self, spec):
        k = spec[0]
        if k == 'line': _, t0, d = self.V[spec[1]]; return t0 + d * spec[2]
        if k == 'mark': return self.R[spec[1]] + (spec[2] if len(spec) > 2 else 0)
        if k == 't': return float(spec[1])
        raise ValueError(spec)

    def events(self):
        """moments worth keeping inside a cut gap: (t0, t1, label)"""
        ev = []
        for a in self.tl.get('alerts', []): ev.append((a['f0'] / FPS - 0.2, a['f0'] / FPS + 4.6, 'alert'))
        if self.ev.get('afk'):
            a0, a1 = self.ev['afk']; ev += [(a0 - 0.4, a0 + 2.4, 'walk-off'), (a1 - 1.6, a1 + 1.2, 'walk-in')]
        for s in self.ev.get('sis') or []:
            ev += [(s[0] - 0.2, s[0] + 1.8, 'extra in'), (s[1] - 0.9, s[1] + 0.6, 'extra out')]
        for t, kind, _ in self.ev['sfx']:
            if kind == 'bell': ev.append((t - 0.3, t + 1.3, 'doorbell'))
        return ev

    def activity(self, g0, g1):
        """drawing/typing clusters inside a gap -> [(t0, t1)]"""
        ts = self.draw_t[(self.draw_t > g0) & (self.draw_t < g1)]
        if len(ts) == 0: return []
        out = []; s = e = ts[0]
        for t in ts[1:]:
            if t - e > 0.7: out.append((s, e)); s = t
            e = t
        out.append((s, e))
        return [(max(g0, s - 0.15), min(g1, e + 0.25)) for s, e in out if e - s >= TL_MIN]

    def main_segments(self):
        keep = sorted([(t0, d, lid, who) for who, lid, t0, d in self.ev['voices'] if lid not in self.P.DROP])
        Zm = self.ZOOM
        units = []
        for t0, d, lid, who in keep:
            s, e = t0 - PRE, t0 + d + POST
            if units and s - units[-1]['s1'] <= JOIN and Zm.get(lid) == units[-1]['zoom'] and not units[-1].get('cold'):
                units[-1]['s1'] = max(units[-1]['s1'], e); units[-1]['lines'].append(lid)
            else:
                units.append({'s0': s, 's1': e, 'speed': 1.0, 'zoom': Zm.get(lid), 'lines': [lid]})
        ev = self.events(); segs = []
        for i, u in enumerate(units):
            if i > 0:
                g0, g1 = units[i - 1]['s1'], u['s0']
                fill = []
                for a, b, lab in ev:
                    if b > g0 and a < g1: fill.append([max(g0, a), min(g1, b), 1.0, lab])
                for a, b in self.activity(g0, g1):
                    if not any(f[0] <= a and b <= f[1] for f in fill):
                        raw = (b - a) / TL_ON   # about TL_ON s on screen, at a whole-number speed (the badge reads x3, not x2.3)
                        sp = float(next((v for v in (2, 3, 4, 6, 8, 12, 16) if v >= raw), 16))
                        fill.append([a, b, sp, 'timelapse'])
                fill.sort()
                merged = []
                for f in fill:   # a 1x window wins over the timelapse part that overlaps it
                    if merged and f[0] < merged[-1][1]:
                        if merged[-1][2] == 1.0 and f[2] > 1.0: f[0] = merged[-1][1]
                        elif f[2] == 1.0 and merged[-1][2] > 1.0: merged[-1][1] = f[0]
                        else: merged[-1][1] = max(merged[-1][1], f[1]); continue
                    if f[1] - f[0] > 0.3: merged.append(f)
                for a, b, sp, lab in merged:
                    segs.append({'s0': a, 's1': b, 'speed': sp, 'zoom': None, 'lines': [], 'fill': lab})
            segs.append(dict(u))
        # 1x neighbours that touch play as one
        out = []
        for s in segs:
            if out and s['speed'] == 1.0 and out[-1]['speed'] == 1.0 and s['zoom'] == out[-1]['zoom'] and abs(s['s0'] - out[-1]['s1']) < 0.05:
                out[-1]['s1'] = s['s1']; out[-1]['lines'] += s['lines']
                if out[-1]['lines'] and out[-1].get('fill'): out[-1]['fill'] = None   # a gap window merged into a spoken part is part of that part
            else: out.append(s)
        return out

    def cold_segments(self):
        out = []
        for sh in self.P.COLD_OPEN:
            if 'line' in sh:   # 'cut': stop this many seconds into the line (a hook that stops before the explanation)
                _, t0, d = self.V[sh['line']]   # 'from': start this many seconds into the line (drop a leading 그리고)
                s = {'s0': t0 + sh.get('from', 0.0) - sh.get('pre', 0.05), 's1': t0 + (sh['cut'] if 'cut' in sh else d + sh.get('post', 0.12)), 'lines': [sh['line']]}
            else:
                t = self.at(sh['at']); s = {'s0': t, 's1': t + sh.get('dur', 1.0), 'lines': []}
            s.update(speed=float(sh.get('speed', 1.0)), zoom=sh.get('zoom'), hold=sh.get('hold', 0.0), mute=sh.get('mute', False), cold=True, shot=sh)
            out.append(s)
        for s in out:   # 'fill': hold the freeze until the cold open is COLD_LEN long
            if s['hold'] == 'fill':
                rest = sum((x['s1'] - x['s0']) / x['speed'] + (x['hold'] if x is not s else 0) for x in out)
                s['hold'] = max(0.5, getattr(self.P, 'COLD_LEN', 10.0) - rest)
        return out


def zbox(Z, zoom):
    """the box a part starts on: a name, or (from, to) for a pan"""
    return Z[zoom] if isinstance(zoom, str) else Z[zoom[0]]


def crop(Z, zoom, dur):
    """ffmpeg crop+scale for a punch-in; a pair of box names pans from the first to the second over the part, eased (reference A
    follows the text being read down the screen). Both boxes of a pan must have the same size."""
    if isinstance(zoom, str):
        x, y, w, h = Z[zoom]; return f",crop={w}:{h}:{x}:{y},scale=1920:1080:flags=lanczos"
    (x0, y0, w, h), (x1, y1, w1, h1) = Z[zoom[0]], Z[zoom[1]]
    assert (w, h) == (w1, h1), f'pan boxes differ in size: {zoom}'
    e = f"(0.5-0.5*cos(PI*min(1\\,t/{max(0.1, dur):.3f})))"
    return f",crop={w}:{h}:x='{x0}+({x1 - x0})*{e}':y='{y0}+({y1 - y0})*{e}',scale=1920:1080:flags=lanczos"


def map_pt(Z, zoom, X, Y):
    """a point of the live frame -> where it lands in a punched-in part"""
    if not zoom: return X, Y
    x, y, w, h = zbox(Z, zoom); k = 1920 / w
    return (X - x) * k, (Y - y) * k


# ---------------------------------------------------------------------------------------------------- HTML for the graphics
HEAD = f"""<meta charset="utf-8"><style>
@font-face{{font-family:P;src:url({FONT}Pretendard-Bold.woff2);font-weight:700}}
@font-face{{font-family:P;src:url({FONT}Pretendard-ExtraBold.woff2);font-weight:800}}
@font-face{{font-family:P;src:url({FONT}Pretendard-SemiBold.woff2);font-weight:600}}
@font-face{{font-family:BH;src:url({EFONT}BlackHanSans-Regular.ttf)}}
@font-face{{font-family:JU;src:url({EFONT}Jua-Regular.ttf)}}
@font-face{{font-family:PEN;src:url({EFONT}NanumPenScript-Regular.ttf)}}
@font-face{{font-family:MJ;src:url({EFONT}NanumMyeongjo-ExtraBold.ttf)}}
*{{box-sizing:border-box}}html,body{{margin:0;padding:0;background:transparent;font-family:P,sans-serif;overflow:hidden}}
</style>"""


def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;')


def ring(px, color):
    """a solid outline from stacked text-shadows (px = radius)"""
    return ','.join(f'{x}px {y}px 0 {color}' for x in range(-px, px + 1) for y in range(-px, px + 1) if x * x + y * y <= px * px + 1)


def stacked(text, font, size, fill, line, px, extra=''):
    """outlined text whose fill may be a gradient: a dark copy with the outline underneath, the filled copy on top"""
    t = esc(text).replace('\n', '<br>')
    base = f'font-family:{font};font-size:{size}px;line-height:1.12;white-space:nowrap;text-align:center;{extra}'
    top = f'color:{fill}' if not fill.startswith('linear') else f'background:{fill};-webkit-background-clip:text;background-clip:text;color:transparent'
    return (f'<div style="position:relative"><div style="{base};color:{line};text-shadow:{ring(px, line)},0 10px 18px rgba(0,0,0,.45)">{t}</div>'
            f'<div style="{base};position:absolute;left:0;top:0;width:100%;{top}">{t}</div></div>')


def hl(text, sub):
    """the line with one key phrase coloured (a highlighted word in the caption)"""
    if not sub or sub not in text: return esc(text)
    i = text.index(sub)
    return esc(text[:i]) + f'<span style="color:#ffe14d">{esc(sub)}</span>' + esc(text[i + len(sub):])


def html_sub(text, who, tone='plain', key=''):
    """the burned-in caption; its look follows the voice (reference A: a streamer edit styles every caption by tone):
    plain = white on purple, shout = heavy display face, bigger, mutter = small handwriting in grey, chat = the line as a
    chat box (used while the picture is punched into the live chat), sis = the extra in pink, round face"""
    if tone == 'chat':
        return HEAD + f"""<body style="width:1920px;height:220px;display:flex;align-items:flex-end;justify-content:center">
<div style="margin-bottom:22px;display:flex;align-items:center;gap:18px;background:rgba(14,16,20,.92);border:4px solid #00ffa3;border-radius:20px;
padding:14px 34px;color:#fff;font-weight:800;font-size:50px;box-shadow:0 10px 26px rgba(0,0,0,.45);white-space:nowrap">
<span style="font-size:30px;background:#00ffa3;color:#06281c;border-radius:10px;padding:4px 12px">💬 방장</span>{esc(text)}</div></body>"""
    if tone == 'shout':
        return HEAD + f"""<body style="width:1920px;height:220px;display:flex;align-items:flex-end;justify-content:center">
<div style="padding-bottom:14px;max-width:1700px">{stacked(text, 'BH', 76, '#ffffff', '#2a0f57', 7)}</div></body>"""
    if tone == 'mutter':
        return HEAD + f"""<body style="width:1920px;height:220px;display:flex;align-items:flex-end;justify-content:center">
<div style="padding-bottom:16px">{stacked(text, 'PEN', 92, '#efeaf8', '#241d33', 6)}</div></body>"""
    fill, line, fam = ('#ffffff', '#3b1a6b', 'P') if who != 'sis' else ('#ffd6ea', '#7a1f4f', 'JU')
    wt = 'font-weight:800;' if fam == 'P' else ''
    return HEAD + f"""<body style="width:1920px;height:220px;display:flex;align-items:flex-end;justify-content:center">
<div style="max-width:1640px;text-align:center;font-family:{fam};{wt}font-size:{58 if fam == 'P' else 62}px;line-height:1.22;color:{fill};text-shadow:{ring(5, line)},0 8px 16px rgba(0,0,0,.45);
padding-bottom:18px;word-break:keep-all">{hl(text, key)}</div></body>"""


def html_emph(text, style):
    """the editor's marks: key (purple box, the book's point), tag (pink pill), gag (tilted yellow reaction), narr (the editor's
    third-person aside in handwriting, reference A), result (two-line tally card, reference A), thesis (the one line on a dark
    full screen in a serif, reference B)"""
    if style == 'key':
        return HEAD + f"""<body style="width:1400px;height:200px;display:flex;align-items:center;justify-content:center">
<div style="background:{PURPLE};color:#fff;font-weight:800;font-size:62px;padding:18px 40px;border-radius:22px;border:5px solid #fff;
box-shadow:0 10px 30px rgba(0,0,0,.35);white-space:nowrap">{esc(text)}</div></body>"""
    if style == 'tag':
        return HEAD + f"""<body style="width:900px;height:140px;display:flex;align-items:center;justify-content:center">
<div style="background:#ff5fa2;color:#fff;font-weight:800;font-size:46px;padding:10px 28px;border-radius:999px;border:4px solid #fff;
box-shadow:0 8px 20px rgba(0,0,0,.3);white-space:nowrap">{esc(text)}</div></body>"""
    if style == 'narr':
        return HEAD + f"""<body style="width:1100px;height:200px;display:flex;align-items:center;justify-content:center">
<div style="transform:rotate(-2deg)">{stacked(text, 'PEN', 106, 'linear-gradient(180deg,#fff27a 10%,#ffb000 90%)', '#2a1300', 7)}</div></body>"""
    if style == 'result':   # its own card: the frame dims so the tally is the only thing to read
        a, b = (text.split('\n', 1) + [''])[:2]
        return HEAD + f"""<body style="width:1920px;height:1080px;background:#140824;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px">
{stacked(a, 'JU', 62, '#ffffff', '#1d0b3a', 5)}{stacked(b, 'BH', 92, 'linear-gradient(180deg,#fff27a 10%,#ffb000 90%)', '#1d0b3a', 7)}</body>"""
    if style == 'thesis':   # 'label|line' puts a small label over the line (default: 오늘의 한 줄)
        lab, text = text.split('|', 1) if '|' in text else ('오늘의 한 줄', text)
        return HEAD + f"""<body style="width:1920px;height:1080px;background:#08050f;display:flex;flex-direction:column;align-items:center;justify-content:center">
<div style="font-weight:700;font-size:34px;color:#ffb35c;letter-spacing:6px;margin-bottom:34px">{esc(lab)}</div>
<div style="font-family:MJ;font-size:104px;color:#fff;letter-spacing:2px;text-shadow:0 6px 30px rgba(0,0,0,.6);white-space:nowrap">{esc(text)}</div></body>"""
    sh = ','.join(f'{x}px {y}px 0 #111' for x in range(-6, 7) for y in range(-6, 7) if x * x + y * y <= 38)
    return HEAD + f"""<body style="width:1000px;height:220px;display:flex;align-items:center;justify-content:center">
<div style="transform:rotate(-4deg);color:#ffe14d;font-weight:800;font-size:84px;text-shadow:{sh},0 10px 18px rgba(0,0,0,.5);white-space:nowrap">{esc(text)}</div></body>"""


def html_state(text):
    """a bracket label that sits over the streamer's head while a state lasts (reference A: (움찔), (위기), (슬픈생각))"""
    return HEAD + f"""<body style="width:700px;height:130px;display:flex;align-items:center;justify-content:center">
{stacked('(' + text + ')', 'JU', 62, '#ffe14d', '#2a1600', 6)}</body>"""


def html_corner(text, n=None):
    """the corner label at the start of each part (reference A: 또다시 돌아온 웃음 참기 컨텐츠 / 공포영화 클리셰): a fixed bar top left,
    purple with an orange tab, so it never reads as one of the yellow jokes"""
    tab = f'<span style="background:#ffb35c;color:#2a1600;border-radius:12px;padding:2px 16px;margin-right:18px;font-size:40px">{n}</span>' if n else ''
    return HEAD + f"""<body style="width:1200px;height:130px;display:flex;align-items:center">
<div style="display:flex;align-items:center;background:{PURPLE};border:4px solid #fff;border-radius:20px;padding:12px 30px 12px 18px;
box-shadow:0 10px 26px rgba(0,0,0,.4);font-family:BH;font-size:56px;color:#fff;white-space:nowrap">{tab}{esc(text)}</div></body>"""


def html_live(text):
    """the live-date label at the start of the stream part (reference C: 2026. 9. 6(일) 생방송 내용입니다.)"""
    return HEAD + f"""<body style="width:900px;height:90px;display:flex;align-items:center">
<div style="font-weight:800;font-size:40px;color:#ffe14d;text-shadow:{ring(4, '#111')}">{esc(text)}</div></body>"""


def html_photo_card(src, label, w=640, h=480, tilt=3, crop=(0.5, 0.5)):
    """a real photo as a tilted card with a label (reference A's meme inserts; reference B's 'show the real thing');
    crop = which part of the photo the card keeps (x, y fractions, like CSS object-position)"""
    cx, cy = crop
    return HEAD + f"""<body style="width:{w + 120}px;height:{h + 190}px;display:flex;align-items:center;justify-content:center">
<div style="transform:rotate({tilt}deg);background:#fff;padding:16px 16px 70px;border-radius:10px;box-shadow:0 18px 40px rgba(0,0,0,.45);position:relative">
<img src="{src}" style="display:block;width:{w}px;height:{h}px;object-fit:cover;object-position:{cx * 100:.0f}% {cy * 100:.0f}%;border-radius:4px">
<div style="position:absolute;left:0;right:0;bottom:12px;text-align:center;font-family:JU;font-size:{min(44, int(w / max(1, len(label)) * 1.15))}px;color:#2a1650;white-space:nowrap">{esc(label)}</div></div></body>"""


def html_chat(text):
    return HEAD + f"""<body style="width:1000px;height:130px;display:flex;align-items:center">
<div style="display:flex;align-items:center;gap:16px;background:rgba(20,16,32,.9);border:3px solid #a78bfa;border-radius:24px;padding:14px 28px;
box-shadow:0 10px 26px rgba(0,0,0,.4);color:#fff;font-weight:700;font-size:44px;white-space:nowrap">
<span style="font-size:28px;font-weight:800;background:#a78bfa;color:#1b1030;border-radius:10px;padding:4px 12px">채팅</span>{esc(text)}</div></body>"""


def html_count(n):
    return HEAD + f"""<body style="width:140px;height:140px;display:flex;align-items:center;justify-content:center">
<div style="width:82px;height:82px;border-radius:50%;background:#ffe14d;border:6px solid #111;display:flex;align-items:center;justify-content:center;
font-weight:800;font-size:48px;color:#111;box-shadow:0 5px 12px rgba(0,0,0,.35)">{n}</div></body>"""


def html_badge(text, w=360):
    return HEAD + f"""<body style="width:{w}px;height:110px;display:flex;align-items:center">
<div style="background:rgba(0,0,0,.72);color:#fff;font-weight:800;font-size:46px;padding:8px 24px;border-radius:16px;border:3px solid #ffe14d">{esc(text)}</div></body>"""


def html_title(T, bg, portrait):
    """5 s: the purple-cow photo pushes in, the channel / series / title come in, a hand-drawn ring circles the purple cow.
    T['cow'] = the purple cow's centre and radii as fractions of the photo (x, y, rx, ry)."""
    cx, cy, rx, ry = T.get('cow', [0.615, 0.42, 0.10, 0.15])
    W, H, X0, Y0 = 2100, 1500, -40, -230          # the photo's box on the card: the cow lands right of the title
    ex, ey, erx, ery = X0 + cx * W, Y0 + cy * H, rx * W, ry * H
    return HEAD + f"""<body style="width:1920px;height:1080px;background:#140b24">
<div style="position:absolute;inset:0;overflow:hidden"><div id="ph" style="position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:{ex}px {ey}px">
 <img src="{bg}" style="position:absolute;left:{X0}px;top:{Y0}px;width:{W}px;height:{H}px;object-fit:cover">
 <svg style="position:absolute;left:0;top:0" width="1920" height="1080"><ellipse id="el" cx="{ex}" cy="{ey}" rx="{erx}" ry="{ery}" fill="none" stroke="#ffe14d"
  stroke-width="11" stroke-linecap="round" stroke-dasharray="2600" stroke-dashoffset="2600" transform="rotate(-8 {ex} {ey})"/></svg></div></div>
<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(20,8,40,.94) 0%,rgba(20,8,40,.8) 32%,rgba(20,8,40,0) 52%)"></div>
<div id="ch" style="position:absolute;left:110px;top:170px;font-weight:700;font-size:40px;color:#e9ddff;letter-spacing:1px">{esc(T['channel'])}</div>
<div id="se" style="position:absolute;left:110px;top:240px"><span style="background:#ffb35c;color:#2a1600;font-weight:800;font-size:54px;padding:8px 26px;border-radius:16px">{esc(T['series'])} {esc(T['ep'])}</span></div>
<div id="ti" style="position:absolute;left:100px;top:360px;font-weight:800;font-size:132px;line-height:1.05;color:#fff;text-shadow:0 8px 0 {PURPLE},0 18px 40px rgba(0,0,0,.5);white-space:nowrap;transform-origin:left center">{esc(T['title'])}</div>
<div id="su" style="position:absolute;left:110px;top:540px;font-weight:700;font-size:44px;color:#d8c8ff">{esc(T['sub'])}</div>
<img id="ka" src="{portrait}" style="position:absolute;left:1420px;top:1080px;width:600px">
<div id="fl" style="position:absolute;inset:0;background:#fff;opacity:0"></div>
<script>
const $=id=>document.getElementById(id); const cl=(x)=>Math.max(0,Math.min(1,x)); const eo=x=>1-Math.pow(1-x,3);
const back=x=>{{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2)}};
window.setT=t=>{{
 $('ph').style.transform=`scale(${{1.0+0.1*eo(cl(t/5))}})`; $('ph').style.filter=`blur(${{8*(1-eo(cl(t/0.35)))}}px)`;
 const s=(id,t0,dx,dy)=>{{const p=eo(cl((t-t0)/0.45));$(id).style.opacity=p;$(id).style.transform=`translate(${{dx*(1-p)}}px,${{dy*(1-p)}}px)`}};
 s('ch',0.15,-60,0); s('se',0.3,-80,0); s('su',0.95,-60,0);
 const q=cl((t-0.5)/0.5); $('ti').style.opacity=cl(q*2); $('ti').style.transform=`scale(${{0.7+0.3*back(q)}})`;
 $('el').setAttribute('stroke-dashoffset', String(2600*(1-eo(cl((t-1.6)/0.7)))));
 const k=eo(cl((t-1.0)/0.6)); $('ka').style.transform=`translateY(${{-470*k}}px)`; $('ka').style.opacity=k;
 $('fl').style.opacity = t<0.12 ? 1-t/0.12 : (t>4.82 ? (t-4.82)/0.18 : 0);
}}; setT(0);
</script></body>"""


def html_end(E, room, portrait, bg):
    return HEAD + f"""<body style="width:1920px;height:1080px;background:#140b24">
<img src="{bg}" style="position:absolute;inset:-60px;width:2040px;height:1200px;object-fit:cover;filter:blur(16px) brightness(.55) saturate(1.05)">
<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(20,8,40,.85) 0%,rgba(20,8,40,.55) 45%,rgba(20,8,40,.35) 100%)"></div>
<div id="nx" style="position:absolute;left:110px;top:120px">
 <div style="font-weight:700;font-size:40px;color:#ffb35c">{esc(E['next'])}</div>
 <div style="font-weight:800;font-size:92px;color:#fff;margin-top:6px">{esc(E['next_title'])}</div>
 <div style="font-weight:700;font-size:40px;color:#d8c8ff;margin-top:8px">{esc(E['next_sub'])}</div></div>
<div id="vb" style="position:absolute;left:980px;top:300px;width:860px;height:484px;border:4px dashed rgba(255,255,255,.55);border-radius:18px;
 display:flex;align-items:flex-end;justify-content:center;padding-bottom:16px;color:#fff;font-weight:700;font-size:36px;overflow:hidden">
 <img src="{bg}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55">
 <span style="position:relative;background:rgba(0,0,0,.6);padding:6px 18px;border-radius:10px">▶ {esc(E['full'])}</span></div>
<div id="sb" style="position:absolute;left:660px;top:560px;width:280px;height:280px;border-radius:50%;border:4px dashed rgba(255,255,255,.55);
 display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:40px">구독</div>
<img id="ka" src="{portrait}" style="position:absolute;left:40px;top:470px;width:560px">
<div id="by" style="position:absolute;left:110px;top:345px;font-weight:800;font-size:50px;color:#fff">{esc(E['bye'])}</div>
<script>
const $=id=>document.getElementById(id); const cl=x=>Math.max(0,Math.min(1,x)); const eo=x=>1-Math.pow(1-x,3);
window.setT=t=>{{ const s=(id,t0,dy)=>{{const p=eo(cl((t-t0)/0.5));$(id).style.opacity=p;$(id).style.transform=`translateY(${{dy*(1-p)}}px)`}};
 s('nx',0.1,30); s('vb',0.4,30); s('sb',0.6,30); s('ka',0.2,80); s('by',0.9,20);
 document.body.style.opacity = t>9.3 ? Math.max(0,1-(t-9.3)/0.7) : 1; }}; setT(0);
</script></body>"""


def html_end_over(E, bg):
    """the end card drawn over a bonus clip from the stream (reference A ends on a playful clip of the streamer peeking in,
    with a handwritten 'subscribe, like, notifications' line). With END['clip_pip'] the clip plays in a window in the left
    half: the next episode and the handwritten ask sit above it, and the right ~40% stays free for YouTube's end-screen
    elements (the full live VOD and subscribe), placed in Studio. No guides are burned in."""
    x, y, w = E.get('clip_pip', (110, 430, 760))
    return HEAD + f"""<body style="width:1920px;height:1080px">
<div style="position:absolute;left:110px;top:70px">
 <div style="font-weight:700;font-size:40px;color:#ffb35c">{esc(E['next'])}</div>
 <div style="font-weight:800;font-size:84px;color:#fff;margin-top:6px;text-shadow:0 6px 18px rgba(0,0,0,.5)">{esc(E['next_title'])}</div>
 <div style="font-weight:700;font-size:38px;color:#e9ddff;margin-top:8px">{esc(E['next_sub'])}</div></div>
<div style="position:absolute;left:96px;top:{y - 112}px">{stacked(E.get('ask', '구독 · 좋아요 · 알림설정 부탁드려요'), 'PEN', 74, '#ffffff', '#1d0b3a', 5)}</div>
<div style="position:absolute;left:{x - 6}px;top:{y - 6}px;width:{w + 12}px;height:{round(w * 9 / 16) + 12}px;border:6px solid #fff;border-radius:16px;box-shadow:0 16px 40px rgba(0,0,0,.5)"></div>
</body>"""


# ---------------------------------------------------------------------------------------------------- render
def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode: raise RuntimeError(' '.join(map(str, cmd))[:400] + '\n' + r.stderr[-2000:])
    return r


def read_wav(p):
    w = wave.open(p); n = w.getnframes(); ch = w.getnchannels(); sr = w.getframerate()
    a = np.frombuffer(w.readframes(n), np.int16).astype(np.float32) / 32768
    a = a.reshape(-1, ch)
    if ch == 1: a = np.repeat(a, 2, 1)
    assert sr == SR, (p, sr)
    return a


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('ep'); ap.add_argument('bd'); ap.add_argument('out')
    ap.add_argument('--plan-only', action='store_true'); ap.add_argument('--jobs', type=int, default=8)
    ap.add_argument('--portrait', default=''); ap.add_argument('--portrait-end', default='')
    a = ap.parse_args()
    a.ep, a.bd, a.out = (os.path.abspath(x) for x in (a.ep, a.bd, a.out))
    P = load_plan(os.path.join(a.ep, 'edit_plan.py')); C = Cut(a.ep, a.bd, P)
    os.makedirs(a.out, exist_ok=True); G = os.path.join(a.out, 'gfx'); os.makedirs(G, exist_ok=True)
    cold, main_ = C.cold_segments(), C.main_segments()
    E_ = P.END; TITLE_D, END_D = 5.0, float(E_.get('dur', 10.0))

    # timeline (frame-exact): cold open, title, main, end
    parts = []; f = 0
    def add(seg):
        nonlocal f
        n = int(round((seg['s1'] - seg['s0']) / seg['speed'] * FPS)) if seg.get('kind', 'src') == 'src' else int(round(seg['dur'] * FPS))
        h = int(round(seg.get('hold', 0) * FPS))
        seg.update(f0=f, n=n, nh=h, o0=f / FPS, o1=(f + n + h) / FPS); f += n + h; parts.append(seg)
    for s in cold: add(s)
    add({'kind': 'clip', 'name': 'title', 'dur': TITLE_D})
    t_main = f / FPS
    if main_: main_[0]['s0'] -= getattr(P, 'MAIN_LEAD', 0.0)   # a breath between the jingle and the first word
    for s in main_: add(s)
    if E_.get('clip'):   # reference A: the end card over a playful clip from the stream (muted; the music carries it)
        t = C.at(E_['clip']); add({'s0': t, 's1': t + END_D, 'speed': 1.0, 'zoom': E_.get('clip_zoom'), 'lines': [], 'mute': True, 'end': True,
                                   'pip': E_.get('clip_pip')})
    else: add({'kind': 'clip', 'name': 'end', 'dur': END_D})
    total = f / FPS
    srcs = [p for p in parts if p.get('kind', 'src') == 'src']

    def out_t(src_t, cold_ok=False):
        for p in srcs:
            if (p.get('cold') and not cold_ok) or p.get('end') or p['speed'] != 1.0: continue
            if p['s0'] - 1e-6 <= src_t <= p['s1'] + 1e-6: return p['o0'] + (src_t - p['s0'])
        return None

    kept = [lid for p in main_ for lid in p['lines']]
    speech = sum(C.V[l][2] for l in kept)
    fills = {}
    for p in main_:
        if p.get('fill'): fills[p['fill']] = fills.get(p['fill'], 0) + (p['s1'] - p['s0']) / p['speed']
    cuts = sum(1 for i in range(1, len(main_)) if abs(main_[i]['s0'] - main_[i - 1]['s1']) > 0.05)
    print(f'cold {parts[len(cold)]["o0"]:.2f}s | title {TITLE_D}s | main {sum(p["n"] for p in main_) / FPS / 60:.2f} min ({len(kept)} lines, speech {speech / 60:.2f} min, '
          f'{cuts} cuts, fills {", ".join(f"{k} {v:.0f}s" for k, v in fills.items())}) | end {END_D}s | total {total / 60:.2f} min')
    if a.plan_only: return

    # overlays in output time
    OV = []; SND = []; PNG = []
    def png(name, html, w, h):
        it = {'out': os.path.join(G, name + '.png'), 'w': w, 'h': h, 'html': html}; PNG.append(it); return it
    def busy(t0, t1, *kinds): return any(o.get('kind') in kinds and o['t0'] < t1 and t0 < o['t1'] for o in OV)
    def part_at(o): return next((p for p in srcs if p['o0'] - 1e-6 <= o < p['o1']), None)
    Z, EMPH = P.Z, P.EMPH
    TONE, HLW, CZ = getattr(P, 'TONE', {}), getattr(P, 'HL', {}), set(getattr(P, 'CHATZOOM', ()))
    THESIS_L = {l for l, v in EMPH.items() if v[1] == 'thesis'}
    bg = 'file://' + os.path.join(a.ep, P.TITLE['bg'])
    # real photos: the book's symbol (INSERTS) and the real thing behind each concrete example (BROLL, reference B)
    INS = list(getattr(P, 'INSERTS', [])); BRL = list(getattr(P, 'BROLL', []))
    for k, ins in enumerate(INS + BRL):
        kind = 'insert' if k < len(INS) else 'broll'
        src_t = C.at(ins['at']); o = out_t(src_t)
        if o is None: print('insert outside kept footage', ins); continue
        img = os.path.join(a.ep, ins['image'])
        if not os.path.exists(img): print('MISSING image, insert skipped:', ins['image']); continue
        if ins.get('layout') == 'card':   # a tilted photo card beside the drawing
            w_, h_ = ins.get('size', (640, 480))
            it = png(f'card_{k}', html_photo_card('file://' + img, ins.get('label', ''), w_, h_, ins.get('tilt', 3), ins.get('crop', (0.5, 0.5))), w_ + 120, h_ + 190)
            cx, cy = ins.get('pos', (1400, 500))
            OV.append({'png': it['out'], 'x': int(cx - it['w'] / 2), 'y': int(cy - it['h'] / 2), 't0': o, 't1': o + ins['dur'], 'anim': 'pop', 'kind': kind})
            if ins.get('sfx', 'pop'): SND.append((o, ins.get('sfx', 'pop'), 0.4))
            continue
        fx, fy = ins.get('focus', [0.5, 0.5]); n = int(round(ins['dur'] * FPS)); z0 = ins.get('zoom0', 1.0)
        ccx, ccy = ins.get('crop', [0.5, 0.5])
        clip = os.path.join(G, f'insert_{k}.mp4')
        z = f"zoompan=z='{z0}+0.22*on/{n}':x='iw*{fx}-iw/zoom*{fx}':y='ih*{fy}-ih/zoom*{fy}':d={n}:s=1920x1080:fps={FPS}"
        run(['ffmpeg', '-y', '-loglevel', 'error', '-loop', '1', '-i', img, '-vf',
             f"scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160:(iw-3840)*{ccx}:(ih-2160)*{ccy},{z},format=yuv420p",
             '-frames:v', str(n), '-c:v', 'libx264', '-crf', '16', clip])
        OV.append({'video': clip, 'x': 0, 'y': 0, 't0': o, 't1': o + ins['dur'], 'anim': 'fade' if ins.get('fade', kind == 'broll') else None, 'kind': kind})
        sfx = ins.get('sfx', 'whoosh' if kind == 'insert' else None)   # B-roll dissolves in silently (reference B)
        if sfx: SND.append((o - 0.1, sfx, 0.3 if kind == 'insert' else 0.18))
        if ins.get('label'):
            it = png(f'inslabel_{k}', html_badge(ins['label'], 900), 900, 110)
            OV.append({'png': it['out'], 'x': 70, 'y': 190, 't0': o + 0.25, 't1': o + ins['dur'], 'anim': 'slide', 'kind': kind})
        if ins.get('chat'):
            it = png(f'inschat_{k}', html_chat(ins['chat']), 1000, 130)
            OV.append({'png': it['out'], 'x': 120, 'y': 110, 't0': o + ins['dur'] * 0.45, 't1': o + ins['dur'], 'anim': 'slide', 'kind': 'chat'})
    subs = []; SUBTXT = {}   # (o0, o1, lid, who); a cold-open shot may cut a line short and show its own text
    for p in srcs:
        if p.get('end'): continue
        for lid in p['lines']:
            who, t0, d = C.V[lid]
            o0 = max(p['o0'], p['o0'] + (t0 - p['s0']) / p['speed']); o1 = min(p['o0'] + (t0 + d - p['s0']) / p['speed'], p['o1'])
            if p.get('cold') and p['shot'].get('text'): SUBTXT[len(subs)] = (p['shot']['text'], p['shot'].get('text_en'))
            subs.append((o0, o1, lid, who))
    sub_at = {lid: (o0, o1) for o0, o1, lid, who in subs if o0 >= t_main}
    def first_kept(lid):   # a dropped line: the first kept line after it in the source
        if lid in sub_at: return sub_at[lid]
        t = C.V[lid][1]; later = sorted((C.V[x][1], x) for x in sub_at if C.V[x][1] >= t)
        return sub_at[later[0][1]] if later else None
    # captions, styled by the voice (reference A)
    nosub = {l for p in cold if p['shot'].get('sub') is False for l in p['lines']}
    for k, (o0, o1, lid, who) in enumerate(subs):
        if lid in THESIS_L and o0 >= t_main: continue   # the thesis card carries this line
        if lid in nosub and o0 < t_main: continue       # a cold-open shot whose picture is the line (sub: False)
        tone = 'chat' if lid in CZ else TONE.get(lid, 'plain')
        it = png(f'sub_{k:03d}', html_sub(SUBTXT.get(k, (C.L[lid]['text'],))[0], who, tone, HLW.get(lid, '')), 1920, 220)
        OV.append({'png': it['out'], 'x': 0, 'y': 860, 't0': o0, 't1': o1 + 0.05, 'anim': 'pop' if tone == 'shout' else None, 'kind': 'sub', 'tone': tone})
    # corner labels at the start of each part (reference A)
    for n, (lid, text) in enumerate(getattr(P, 'CORNERS', {}).items()):
        at = first_kept(lid)
        if not at: print('corner line not kept:', lid); continue
        ta = max(t_main + 0.1, at[0] - 0.15)
        it = png(f'corner_{lid}', html_corner(text, f'#{n + 1}'), 1200, 130)
        OV.append({'png': it['out'], 'x': 50, 'y': 40, 't0': ta, 't1': ta + 3.0, 'anim': 'slide', 'kind': 'corner', 'text': text})
        SND.append((ta, 'whip', 0.3))
    # the live-date label (reference C)
    if getattr(P, 'LIVE', None):
        it = png('live', html_live(P.LIVE), 900, 90)
        OV.append({'png': it['out'], 'x': 60, 'y': 30, 't0': t_main + 0.2, 't1': t_main + 3.8, 'anim': 'pop', 'kind': 'live'})
    # chat bubbles, jump cards
    for k, (o0, o1, lid, who) in enumerate(subs):
        if o0 < t_main: continue
        if lid in P.CHAT:
            it = png(f'chat_{lid}', html_chat(P.CHAT[lid]), 1000, 130)
            t0, t1 = max(t_main, o0 - 0.9), o0 + min(2.6, o1 - o0 + 0.4)
            pz = part_at(t0)
            if pz and pz.get('zoom') == 'chat' and not pz['o0'] <= o0 < pz['o1']: t0 = pz['o1']   # the real chat is on screen: the bubble waits
            OV.append({'png': it['out'], 'x': 110, 'y': 660, 't0': t0, 't1': t1, 'anim': 'slide', 'kind': 'chat'})
        if lid in getattr(P, 'JUMP_CARDS', {}):
            it = png(f'jump_{lid}', html_badge(P.JUMP_CARDS[lid]), 360, 110)
            seg = part_at(o0)
            OV.append({'png': it['out'], 'x': 50, 'y': 40, 't0': seg['o0'], 't1': seg['o0'] + 1.6, 'anim': 'pop', 'kind': 'jump'})
            SND.append((seg['o0'], 'whip', 0.4))
    # the editor's marks
    SIZE = {'key': (1400, 200), 'tag': (900, 140), 'narr': (1100, 200), 'result': (1920, 1080), 'thesis': (1920, 1080)}
    for k, (o0, o1, lid, who) in enumerate(subs):
        if lid not in EMPH or o0 < t_main: continue
        text, style, sfx = EMPH[lid]
        w_, h_ = SIZE.get(style, (1000, 220))
        it = png(f'emph_{lid}', html_emph(text, style), w_, h_)
        zm = (part_at(o0) or {}).get('zoom')
        if style == 'thesis': ta, t1, cx, cy = o0 - 0.1, o1 + 0.9, 960, 540
        elif style == 'result': ta, t1, cx, cy = o0 + 0.1, max(o1 + 0.8, o0 + 3.4), 960, 540
        elif style == 'narr':
            ta = o0 + (o1 - o0) * 0.45; t1 = max(o1 + 0.8, ta + 2.0); cx, cy = 1520, 250   # over the chat column, never over the drawing
        else:
            ta = o0 + (o1 - o0) * (0.55 if style == 'gag' else 0.15); t1 = max(o1 + 0.6, ta + 1.6)
            cx, cy = ((960, 150) if style == 'key' else (1300, 300) if style == 'tag' else (640, 300) if zm in ('face', 'kate') else (1320, 250))
        OV.append({'png': it['out'], 'x': cx - w_ // 2, 'y': cy - h_ // 2, 't0': ta, 't1': t1, 'anim': 'fade' if style in ('thesis', 'result') else 'pop',
                   'kind': 'emph', 'style': style, 'line': lid})
        if sfx: SND.append((ta, sfx, 0.55))
    # state labels over the streamer's head while a state lasts (reference A); they follow the punch-ins, hidden when she is out of frame
    for j, (la, lb, text) in enumerate(getattr(P, 'STATE', [])):
        ra, rb = first_kept(la), first_kept(lb)
        if not ra or not rb: print('state lines not kept:', la, lb); continue
        t0, t1 = ra[0] + 0.1, rb[1] + 0.3
        it = png(f'state_{j}', html_state(text), 700, 130); first = True
        for p in srcs:
            if p.get('end') or p.get('cold') or p['o1'] <= t0 or p['o0'] >= t1: continue
            x, y = map_pt(Z, p.get('zoom'), *P.HEAD)
            if not (160 < x < 1760 and -60 < y < 980): continue
            y = max(70, y)
            OV.append({'png': it['out'], 'x': int(x - 350), 'y': int(y - 65), 't0': max(t0, p['o0']), 't1': min(t1, p['o1']), 'anim': 'pop' if first else None,
                       'kind': 'state', 'text': text})
            first = False
    for p in main_:
        if p['speed'] > 1.0:
            it = png(f'ff_{p["f0"]}', html_badge(f'▶▶ ×{p["speed"]:g}'), 360, 110)
            OV.append({'png': it['out'], 'x': 50, 'y': 40, 't0': p['o0'], 't1': p['o1'], 'anim': None, 'kind': 'ff'})
    for ci, p in enumerate(cold):
        c = p['shot'].get('caption')
        if c:   # one file per shot: two captioned shots must not overwrite each other
            it = png(f'cold_cap_{ci}', html_emph(c['text'], c.get('style', 'gag')), 1000, 220)
            ta = p['o0'] + c.get('at', 0.2)
            OV.append({'png': it['out'], 'x': c['x'] - 500, 'y': c['y'] - 110, 't0': ta, 't1': p['o1'], 'anim': 'pop', 'kind': 'cold'})
            if c.get('sfx', 'pop'): SND.append((ta, c.get('sfx', 'pop'), 0.6))
        cnt = p['shot'].get('count')   # numbers popping over what the joke is about (her five legs), one by one
        if cnt:
            for j, x in enumerate(cnt['xs']):
                it = png(f'count_{ci}_{j}', html_count(j + 1), 140, 140)
                ta = p['o0'] + cnt['at'] + j * cnt['step']
                OV.append({'png': it['out'], 'x': x - 70, 'y': cnt['y'] - 70, 't0': ta, 't1': p['o1'], 'anim': 'pop', 'kind': 'cold'})
                SND.append((ta, cnt.get('sfx', 'pop'), 0.45))
        if p['shot'].get('end_sfx'): SND.append((p['o1'] - 0.42, p['shot']['end_sfx'], 0.7))
    # punch-ins: a cut into a closer frame needs no sound (reference A cuts straight); a punch into the chat pops; ZOOM_SFX brings back the whoosh
    prevz = None
    for p in srcs:
        z = p.get('zoom')
        if z and z != prevz and p['o0'] >= t_main and not p.get('end'):
            if z == 'chat': SND.append((p['o0'], 'pop', 0.35))
            elif getattr(P, 'ZOOM_SFX', False) and not any(l in EMPH for l in p['lines']): SND.append((max(t_main, p['o0'] - 0.12), 'whoosh', 0.16))
        prevz = z
    SND.append((parts[len(cold)]['o0'] - 0.15, 'whip', 0.5))
    if E_.get('clip'):
        endp = parts[-1]; it = png('end_over', html_end_over(E_, bg), 1920, 1080)
        OV.append({'png': it['out'], 'x': 0, 'y': 0, 't0': endp['o0'] + 0.25, 't1': endp['o1'], 'anim': 'fade', 'kind': 'end'})
    CLIPS = []
    # title + end cards
    T = P.TITLE; room = 'file://' + os.path.join(CACHE, 'rooms', 'kate_room.jpg')
    CLIPS += [{'out': os.path.join(G, 'title.mp4'), 'w': 1920, 'h': 1080, 'fps': FPS, 'dur': TITLE_D, 'html': html_title(T, bg, 'file://' + a.portrait)}]
    if not E_.get('clip'):
        CLIPS.append({'out': os.path.join(G, 'end.mp4'), 'w': 1920, 'h': 1080, 'fps': FPS, 'dur': END_D, 'html': html_end(E_, room, 'file://' + (a.portrait_end or a.portrait), bg)})
    spec = os.path.join(G, 'spec.json'); json.dump({'png': PNG, 'clips': CLIPS}, open(spec, 'w'), ensure_ascii=False)
    print('cards ...', flush=True); r = run(['node', os.path.join(HERE, 'cards.mjs'), spec]); print(r.stdout.strip().splitlines()[-1])

    # per-part video
    VID = os.path.join(a.bd, 'final.mp4'); jobs = []
    for i, p in enumerate(parts):
        o = os.path.join(G, f'part_{i:03d}.mp4'); p['file'] = o
        if p.get('kind') == 'clip': p['file'] = os.path.join(G, p['name'] + '.mp4'); continue
        ins = ['-ss', f"{p['s0']:.3f}", '-i', VID]; fc = []; k = 1
        chain = f"[0:v]setpts=(PTS-STARTPTS)/{p['speed']},fps={FPS}"
        if p.get('zoom'): chain += crop(P.Z, p['zoom'], p['n'] / FPS)
        if p.get('pip'):   # the clip as a window (x, y, w) on the channel's plain dark purple: the right of the frame stays free
            px, py, pw = p['pip']
            chain += f",split[pa][pb];[pa]drawbox=x=0:y=0:w=iw:h=ih:color=0x1a0d2e:t=fill[pc];[pb]scale={pw}:-2[pd];[pc][pd]overlay={px}:{py}"
        if p['nh']: chain += f",trim=end_frame={p['n']},tpad=stop_mode=clone:stop=0:stop_duration={p['nh'] / FPS:.3f}"
        fc.append(chain + '[b0]'); last = 'b0'; dur = (p['n'] + p['nh']) / FPS
        for ov in OV:
            if ov['t1'] <= p['o0'] + 1e-6 or ov['t0'] >= p['o1'] - 1e-6: continue
            a0, a1 = max(0.0, ov['t0'] - p['o0']), min(dur, ov['t1'] - p['o0'])
            if 'png' in ov:
                ins += ['-loop', '1', '-framerate', str(FPS), '-t', f'{dur:.3f}', '-i', ov['png']]
                lab = f'o{k}'; pre = f"[{k}:v]format=rgba"
                starts_here = ov['t0'] >= p['o0'] - 1e-6; ends_here = ov['t1'] <= p['o1'] + 1e-6
                fd = 0.3 if ov['anim'] == 'fade' else 0.12
                if ov['anim'] and starts_here: pre += f",fade=t=in:st={a0:.3f}:d={fd}:alpha=1"
                if ov['anim'] == 'fade' and ends_here and a1 - a0 > 0.8: pre += f",fade=t=out:st={a1 - 0.3:.3f}:d=0.3:alpha=1"
                fc.append(pre + f'[{lab}]')
                yx = str(ov['y'])
                if ov['anim'] == 'pop' and starts_here: yx = f"{ov['y']}-36*max(0\\,1-(t-{a0:.3f})/0.14)"
                if ov['anim'] == 'slide' and starts_here: xx = f"{ov['x']}-60*max(0\\,1-(t-{a0:.3f})/0.18)"
                else: xx = str(ov['x'])
                fc.append(f"[{last}][{lab}]overlay=x='{xx}':y='{yx}':enable='between(t,{a0:.3f},{a1:.3f})':eof_action=pass[v{k}]")
            else:
                off = max(0.0, p['o0'] - ov['t0'])
                ins += ['-ss', f'{off:.3f}', '-i', ov['video']]
                fv = ''
                if ov.get('anim') == 'fade':   # a dissolve in and out (reference B's B-roll)
                    fv = ',format=yuva420p'
                    if ov['t0'] >= p['o0'] - 1e-6: fv += f",fade=t=in:st={a0:.3f}:d=0.3:alpha=1"
                    if ov['t1'] <= p['o1'] + 1e-6: fv += f",fade=t=out:st={a1 - 0.3:.3f}:d=0.3:alpha=1"
                fc.append(f"[{k}:v]setpts=PTS-STARTPTS+{a0:.3f}/TB{fv}[o{k}]")
                fc.append(f"[{last}][o{k}]overlay=x=0:y=0:enable='between(t,{a0:.3f},{a1:.3f})':eof_action=pass[v{k}]")
            last = f'v{k}'; k += 1
        cmd = ['ffmpeg', '-y', '-loglevel', 'error'] + ins + ['-filter_complex', ';'.join(fc), '-map', f'[{last}]', '-frames:v', str(p['n'] + p['nh']),
               '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', str(FPS), '-video_track_timescale', '15360', o]
        jobs.append(cmd)
    print(f'parts {len(jobs)} ...', flush=True)
    with ThreadPoolExecutor(a.jobs) as ex: list(ex.map(run, jobs))
    for c in [p for p in parts if p.get('kind') == 'clip']:   # cards: same timescale for a clean concat
        fixed = c['file'][:-4] + '_ts.mp4'
        run(['ffmpeg', '-y', '-loglevel', 'error', '-i', c['file'], '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', str(FPS),
             '-frames:v', str(c['n']), '-video_track_timescale', '15360', fixed]); c['file'] = fixed
    lst = os.path.join(G, 'parts.txt'); open(lst, 'w').write('\n'.join(f"file '{p['file']}'" for p in parts))
    vid = os.path.join(a.out, 'video_edit.mp4')
    run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', vid])

    # audio: the live mix without its music, cut the same way; the edit's own music, jingle and effects on top
    dry = read_wav(os.path.join(a.bd, 'mix_dry.wav'))
    snd_dir = os.path.join(a.out, 'snd'); run([sys.executable, os.path.join(HERE, 'sound.py'), snd_dir])
    SFXW = {n: read_wav(os.path.join(snd_dir, f'sfx_{n}.wav')) for n in ('whoosh', 'pop', 'ding', 'boing', 'scratch', 'whip')}
    N = int(round(total * SR)); voice = np.zeros((N, 2), np.float32); fx = np.zeros((N, 2), np.float32); mus = np.zeros((N, 2), np.float32)
    fade = int(0.004 * SR)
    for p in srcs:
        i0 = int(round(p['o0'] * SR)); n = int(round(p['n'] / FPS * SR))
        if p.get('mute'): continue
        if p['speed'] == 1.0:
            j0 = int(round(p['s0'] * SR)); seg = dry[j0:j0 + n].copy()
        else:
            idx = p['s0'] * SR + np.arange(n) * p['speed']; idx = np.clip(idx, 0, len(dry) - 2)
            seg = np.stack([np.interp(idx, np.arange(len(dry)), dry[:, c]) for c in (0, 1)], 1).astype(np.float32) * 0.3
        if len(seg) < n: seg = np.pad(seg, ((0, n - len(seg)), (0, 0)))
        r = np.ones(n, np.float32); r[:fade] = np.linspace(0, 1, fade); r[-fade:] = np.linspace(1, 0, fade)
        voice[i0:i0 + n] += seg * r[:, None]
    on = np.abs(voice).max(1) > 0.02
    rms = float(np.sqrt(np.mean(voice[on] ** 2))) if on.any() else 0.05
    def put(buf, clip, t, g):
        i = int(round(t * SR)); j = min(len(buf), i + len(clip))
        if j > i and i >= 0: buf[i:j] += clip[:j - i] * g
    for t, name, g in SND:
        if name: put(fx, SFXW[name], t, g * rms * 3.2)
    jw = os.path.join(snd_dir, 'jingle.wav')
    if getattr(P, 'JINGLE', None):   # the channel's chosen signature tune on real instruments (edit/jingles.py) replaces sound.py's
        sys.path.insert(0, HERE); import jingles; jingles.render(P.JINGLE, jw)
    jing = read_wav(jw); put(mus, jing, parts[len(cold)]['o0'], rms * 2.6)
    bgm = read_wav_any(os.path.join(CACHE, 'bgm', 'tokyo_sunset.mp3'))
    m0, m1 = int(max(0, t_main - 0.25) * SR), N
    loop = np.concatenate([bgm] * (int((m1 - m0) / len(bgm)) + 2))[:m1 - m0]
    brms = float(np.sqrt(np.mean(bgm ** 2))) + 1e-9
    g = np.full(m1 - m0, rms / brms * 10 ** (-19 / 20), np.float32)
    e0 = int((total - END_D) * SR) - m0; g[e0:] *= np.linspace(1, 2.2, len(g) - e0)
    k = int(0.25 * SR); g[:k] *= np.linspace(0, 1, k); g[-int(0.9 * SR):] *= np.linspace(1, 0, int(0.9 * SR))
    mus[m0:m1] += loop * g[:, None]
    mix = voice + fx + mus
    mix = mix / max(1e-6, float(np.abs(mix).max())) * 0.9
    wav = os.path.join(a.out, 'mix_edit.wav')
    with wave.open(wav, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
    final = os.path.join(a.out, 'final_edit.mp4')
    run(['ffmpeg', '-y', '-loglevel', 'error', '-i', vid, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
         '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final])

    # captions, chapters, edit list
    def ts(t):
        ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
        return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'
    for lang in ('ko', 'en'):
        rows = []
        for k, (o0, o1, lid, who) in enumerate(subs):
            txt = C.L[lid]['text'] if lang == 'ko' else C.EN.get(lid, '')
            if k in SUBTXT: txt = SUBTXT[k][0] if lang == 'ko' else (SUBTXT[k][1] or txt)
            if who == 'sis': txt = '— ' + txt
            rows.append(f'{k + 1}\n{ts(o0)} --> {ts(o1 + 0.05)}\n{txt}\n')
        open(os.path.join(a.out, f'subs_{lang}.srt'), 'w').write('\n'.join(rows))
    mmss = lambda t: f'{int(t // 60):02d}:{int(t % 60):02d}'
    starts = {lid: o0 for o0, o1, lid, who in subs if o0 >= t_main}
    def chap_t(l):   # a dropped line: the first kept line after it in the source
        if l in starts: return starts[l]
        t = C.V[l][1]; later = sorted((C.V[x][1], o) for x, o in starts.items() if C.V[x][1] >= t)
        print('chapter line dropped, using the next kept line:', l)
        return later[0][1] if later else None
    chk = ['00:00 하이라이트 + 타이틀'] + [f'{mmss(chap_t(l))} {name}' for l, name in P.CHAPTERS if chap_t(l) is not None]
    che = ['00:00 Highlight + title'] + [f'{mmss(chap_t(l))} {name}' for (l, _), name in zip(P.CHAPTERS, P.CHAPTERS_EN) if chap_t(l) is not None]
    open(os.path.join(a.out, 'chapters_ko.txt'), 'w').write('\n'.join(chk) + '\n'); open(os.path.join(a.out, 'chapters_en.txt'), 'w').write('\n'.join(che) + '\n')
    edl = {'total': total, 't_main': t_main, 'title': [parts[len(cold)]['o0'], parts[len(cold)]['o1']], 'end': [parts[-1]['o0'], parts[-1]['o1']],
           'cold': [{'o0': p['o0'], 'o1': p['o1'], 'lines': p['lines'], 'zoom': p.get('zoom'), 'hold': p.get('hold', 0)} for p in cold],
           'main': [{'o0': p['o0'], 'o1': p['o1'], 's0': p['s0'], 's1': p['s1'], 'speed': p['speed'], 'zoom': p.get('zoom'), 'fill': p.get('fill'), 'lines': p['lines']} for p in main_],
           'subs': subs, 'sub_text': {k: v[0] for k, v in SUBTXT.items()}, 'overlays': [{k: v for k, v in o.items() if k != 'html'} for o in OV], 'sounds': SND, 'jingle_at': parts[len(cold)]['o0'], 'jingle': getattr(P, 'JINGLE', None),
           'stats': {'source_min': C.ev['T'] / 60, 'lines_kept': len(kept), 'lines_total': len(C.V), 'speech_min': speech / 60, 'cuts': cuts, 'fills': fills,
                     'zooms': sum(1 for p in srcs if p.get('zoom') and not p.get('cold')), 'emph': sum(1 for o in OV if o.get('kind') == 'emph'),
                     'chat': sum(1 for o in OV if 'chat_' in o.get('png', '')), 'inserts': len(INS), 'broll': len(BRL),
                     'states': len(getattr(P, 'STATE', [])), 'corners': sum(1 for o in OV if o.get('kind') == 'corner'),
                     'chatzoom': len(CZ), 'tones': {t: sum(1 for o in OV if o.get('tone') == t) for t in ('shout', 'mutter', 'chat')},
                     'narr': sum(1 for o in OV if o.get('style') == 'narr'), 'end_clip': bool(E_.get('clip')), 'sfx': len(SND)},
           'chapters_ko': chk, 'chapters_en': che}
    json.dump(edl, open(os.path.join(a.out, 'edl.json'), 'w'), ensure_ascii=False, indent=1)
    print('edit ->', final, f'{total / 60:.2f} min')


def read_wav_any(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 's16le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True).stdout
    return (np.frombuffer(raw, np.int16).astype(np.float32) / 32768).reshape(-1, 2)


if __name__ == '__main__':
    main()
