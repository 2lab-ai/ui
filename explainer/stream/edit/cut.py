"""Live-stream VOD -> fast edit (편집본): cold open, title card with the channel jingle, the stream jump-cut to the lines that
matter, punch-in zooms, burned-in captions, the editor's jokes, chat bubbles, sped-up drawing, an end card.
usage: python cut.py <episode dir> <live build dir> <out dir> [--plan-only] [--jobs 8]
  <episode dir>: edit_plan.py, lines.json, subs_en.json (and the props the plan names)
  <live build dir>: final.mp4, mix_dry.wav (engine/mix.py), events.json, timeline.json, marks.json
  out: final_edit.mp4, subs_ko.srt, subs_en.srt, chapters_ko.txt, chapters_en.txt, edl.json (what review_edit.py reads)
How the main part is cut: every line the plan keeps stays whole; the silence between two kept lines goes, except for what is
worth seeing there — a donation alert, the walk-off and return, the extra coming and going (kept at 1x) and drawing or typing
(sped up 2-6x with a badge). Lines in DROP are cut with their pauses."""
import argparse, importlib.util, json, math, os, subprocess, sys, wave
from concurrent.futures import ThreadPoolExecutor
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FPS, SR = 30, 48000
CACHE = os.environ.get('STREAM_CACHE') or os.path.join(os.path.expanduser('~'), '.cache', '2lab-stream')
FONT = 'file://' + os.path.join(CACHE, 'fonts', 'pretendard') + '/'
PRE, POST = 0.06, 0.14          # air kept before and after a line
JOIN = 0.30                     # two kept lines closer than this play through (no cut)
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
            a0, a1 = self.ev['afk']; ev += [(a0 - 0.6, a0 + 3.2, 'walk-off'), (a1 - 2.2, a1 + 1.4, 'walk-in')]
        for s in self.ev.get('sis') or []:
            ev += [(s[0] - 0.3, s[0] + 2.2, 'extra in'), (s[1] - 1.2, s[1] + 0.8, 'extra out')]
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
        return [(max(g0, s - 0.15), min(g1, e + 0.25)) for s, e in out if e - s >= 1.8]

    def main_segments(self):
        keep = sorted([(t0, d, lid, who) for who, lid, t0, d in self.ev['voices'] if lid not in self.P.DROP])
        units = []
        for t0, d, lid, who in keep:
            s, e = t0 - PRE, t0 + d + POST
            if units and s - units[-1]['s1'] <= JOIN and self.P.ZOOM.get(lid) == units[-1]['zoom'] and not units[-1].get('cold'):
                units[-1]['s1'] = max(units[-1]['s1'], e); units[-1]['lines'].append(lid)
            else:
                units.append({'s0': s, 's1': e, 'speed': 1.0, 'zoom': self.P.ZOOM.get(lid), 'lines': [lid]})
        ev = self.events(); segs = []
        for i, u in enumerate(units):
            if i > 0:
                g0, g1 = units[i - 1]['s1'], u['s0']
                fill = []
                for a, b, lab in ev:
                    if b > g0 and a < g1: fill.append([max(g0, a), min(g1, b), 1.0, lab])
                for a, b in self.activity(g0, g1):
                    if not any(f[0] <= a and b <= f[1] for f in fill):
                        sp = float(np.clip((b - a) / 1.7, 2.0, 8.0))
                        fill.append([a, b, round(sp, 1), 'timelapse'])
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
            else: out.append(s)
        return out

    def cold_segments(self):
        out = []
        for sh in self.P.COLD_OPEN:
            if 'line' in sh:
                _, t0, d = self.V[sh['line']]; s = {'s0': t0 - sh.get('pre', 0.05), 's1': t0 + d + sh.get('post', 0.12), 'lines': [sh['line']]}
            else:
                t = self.at(sh['at']); s = {'s0': t, 's1': t + sh.get('dur', 1.0), 'lines': []}
            s.update(speed=1.0, zoom=sh.get('zoom'), hold=sh.get('hold', 0.0), mute=sh.get('mute', False), cold=True, shot=sh)
            out.append(s)
        for s in out:   # 'fill': hold the freeze until the cold open is COLD_LEN long
            if s['hold'] == 'fill':
                rest = sum(x['s1'] - x['s0'] + (x['hold'] if x is not s else 0) for x in out)
                s['hold'] = max(0.5, getattr(self.P, 'COLD_LEN', 10.0) - rest)
        return out


# ---------------------------------------------------------------------------------------------------- HTML for the graphics
HEAD = f"""<meta charset="utf-8"><style>
@font-face{{font-family:P;src:url({FONT}Pretendard-Bold.woff2);font-weight:700}}
@font-face{{font-family:P;src:url({FONT}Pretendard-ExtraBold.woff2);font-weight:800}}
@font-face{{font-family:P;src:url({FONT}Pretendard-SemiBold.woff2);font-weight:600}}
*{{box-sizing:border-box}}html,body{{margin:0;padding:0;background:transparent;font-family:P,sans-serif;overflow:hidden}}
</style>"""


def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;')


def html_sub(text, who):
    fill, line = ('#ffffff', '#3b1a6b') if who != 'sis' else ('#ffe0f0', '#7a1f4f')
    sh = ','.join(f'{x}px {y}px 0 {line}' for x in range(-5, 6, 1) for y in range(-5, 6, 1) if x * x + y * y <= 26)
    return HEAD + f"""<body style="width:1920px;height:220px;display:flex;align-items:flex-end;justify-content:center">
<div style="max-width:1560px;text-align:center;font-weight:800;font-size:54px;line-height:1.22;color:{fill};text-shadow:{sh},0 8px 16px rgba(0,0,0,.45);
padding-bottom:18px;word-break:keep-all">{esc(text)}</div></body>"""


def html_emph(text, style):
    if style == 'key':
        return HEAD + f"""<body style="width:1400px;height:200px;display:flex;align-items:center;justify-content:center">
<div style="background:{PURPLE};color:#fff;font-weight:800;font-size:62px;padding:18px 40px;border-radius:22px;border:5px solid #fff;
box-shadow:0 10px 30px rgba(0,0,0,.35);white-space:nowrap">{esc(text)}</div></body>"""
    if style == 'tag':
        return HEAD + f"""<body style="width:900px;height:140px;display:flex;align-items:center;justify-content:center">
<div style="background:#ff5fa2;color:#fff;font-weight:800;font-size:46px;padding:10px 28px;border-radius:999px;border:4px solid #fff;
box-shadow:0 8px 20px rgba(0,0,0,.3);white-space:nowrap">{esc(text)}</div></body>"""
    sh = ','.join(f'{x}px {y}px 0 #111' for x in range(-6, 7) for y in range(-6, 7) if x * x + y * y <= 38)
    return HEAD + f"""<body style="width:1000px;height:220px;display:flex;align-items:center;justify-content:center">
<div style="transform:rotate(-4deg);color:#ffe14d;font-weight:800;font-size:84px;text-shadow:{sh},0 10px 18px rgba(0,0,0,.5);white-space:nowrap">{esc(text)}</div></body>"""


def html_chat(text):
    return HEAD + f"""<body style="width:1000px;height:130px;display:flex;align-items:center">
<div style="display:flex;align-items:center;gap:16px;background:rgba(20,16,32,.9);border:3px solid #a78bfa;border-radius:24px;padding:14px 28px;
box-shadow:0 10px 26px rgba(0,0,0,.4);color:#fff;font-weight:700;font-size:44px;white-space:nowrap">
<span style="font-size:28px;font-weight:800;background:#a78bfa;color:#1b1030;border-radius:10px;padding:4px 12px">채팅</span>{esc(text)}</div></body>"""


def html_count(n):
    return HEAD + f"""<body style="width:140px;height:140px;display:flex;align-items:center;justify-content:center">
<div style="width:82px;height:82px;border-radius:50%;background:#ffe14d;border:6px solid #111;display:flex;align-items:center;justify-content:center;
font-weight:800;font-size:48px;color:#111;box-shadow:0 5px 12px rgba(0,0,0,.35)">{n}</div></body>"""


def html_badge(text):
    return HEAD + f"""<body style="width:360px;height:110px;display:flex;align-items:center">
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
    TITLE_D, END_D = 5.0, 10.0

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
    for s in main_: add(s)
    add({'kind': 'clip', 'name': 'end', 'dur': END_D})
    total = f / FPS
    srcs = [p for p in parts if p.get('kind', 'src') == 'src']

    def out_t(src_t, cold_ok=False):
        for p in srcs:
            if (p.get('cold') and not cold_ok) or p['speed'] != 1.0: continue
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
    OV = []; SND = []
    def png(name, html, w, h):
        return {'out': os.path.join(G, name + '.png'), 'w': w, 'h': h, 'html': html}
    PNG = []
    # inserts: the real purple-cow photo full screen, a slow push-in toward the cow (drawn under every caption)
    for k, ins in enumerate(getattr(P, 'INSERTS', [])):
        src_t = C.at(ins['at']); o = out_t(src_t)
        if o is None: print('insert outside kept footage', ins); continue
        img = os.path.join(a.ep, ins['image']); fx, fy = ins.get('focus', [0.5, 0.5]); n = int(round(ins['dur'] * FPS)); z0 = ins.get('zoom0', 1.0)
        clip = os.path.join(G, f'insert_{k}.mp4')
        z = f"zoompan=z='{z0}+0.22*on/{n}':x='iw*{fx}-iw/zoom*{fx}':y='ih*{fy}-ih/zoom*{fy}':d={n}:s=1920x1080:fps={FPS}"
        run(['ffmpeg', '-y', '-loglevel', 'error', '-loop', '1', '-i', img, '-vf', f"scale=3840:-2,crop=3840:2160,{z},format=yuv420p", '-frames:v', str(n), '-c:v', 'libx264', '-crf', '16', clip])
        OV.append({'video': clip, 'x': 0, 'y': 0, 't0': o, 't1': o + ins['dur'], 'anim': 'flash'})
        SND.append((o - 0.1, ins.get('sfx', 'whoosh'), 0.3))
        if ins.get('chat'):
            it = png(f'inschat_{k}', html_chat(ins['chat']), 1000, 130); PNG.append(it)
            OV.append({'png': it['out'], 'x': 120, 'y': 110, 't0': o + ins['dur'] * 0.45, 't1': o + ins['dur'], 'anim': 'slide'})
    subs = []   # (o0, o1, lid, who)
    for p in srcs:
        for lid in p['lines']:
            who, t0, d = C.V[lid]
            o0 = p['o0'] + (t0 - p['s0']) / p['speed']; o1 = o0 + d / p['speed']
            subs.append((o0, o1, lid, who))
    for k, (o0, o1, lid, who) in enumerate(subs):
        it = png(f'sub_{k:03d}', html_sub(C.L[lid]['text'], who), 1920, 220); PNG.append(it)
        OV.append({'png': it['out'], 'x': 0, 'y': 860, 't0': o0, 't1': o1 + 0.05, 'anim': None})
    for k, (o0, o1, lid, who) in enumerate(subs):
        if lid in P.EMPH and o0 >= t_main:
            text, style, sfx = P.EMPH[lid]
            it = png(f'emph_{lid}', html_emph(text, style), *( (1400, 200) if style == 'key' else (900, 140) if style == 'tag' else (1000, 220)))
            PNG.append(it)
            ta = o0 + (o1 - o0) * (0.55 if style == 'gag' else 0.15)
            zm = next((p.get('zoom') for p in srcs if p['o0'] <= o0 < p['o1']), None)
            cx, cy = ((960, 150) if style == 'key' else (1300, 300) if style == 'tag' else (640, 300) if zm in ('face', 'kate') else (1320, 250))
            OV.append({'png': it['out'], 'x': cx - it['w'] // 2, 'y': cy - it['h'] // 2, 't0': ta, 't1': max(o1 + 0.6, ta + 1.6), 'anim': 'pop'})
            SND.append((ta, sfx, 0.55))
        if lid in P.CHAT and o0 >= t_main:
            it = png(f'chat_{lid}', html_chat(P.CHAT[lid]), 1000, 130); PNG.append(it)
            OV.append({'png': it['out'], 'x': 110, 'y': 660, 't0': max(t_main, o0 - 0.9), 't1': o0 + min(2.6, o1 - o0 + 0.4), 'anim': 'slide'})
        if lid in getattr(P, 'JUMP_CARDS', {}) and o0 >= t_main:
            it = png(f'jump_{lid}', html_badge(P.JUMP_CARDS[lid]), 360, 110); PNG.append(it)
            seg = next(p for p in srcs if p['o0'] <= o0 < p['o1'])
            OV.append({'png': it['out'], 'x': 110, 'y': 230, 't0': seg['o0'], 't1': seg['o0'] + 1.6, 'anim': 'pop'})
            SND.append((seg['o0'], 'whip', 0.4))
    for p in main_:
        if p['speed'] > 1.0:
            it = png(f'ff_{p["f0"]}', html_badge(f'▶▶ ×{p["speed"]:g}'), 360, 110); PNG.append(it)
            OV.append({'png': it['out'], 'x': 110, 'y': 230, 't0': p['o0'], 't1': p['o1'], 'anim': None})
    for p in cold:
        c = p['shot'].get('caption')
        if c:
            it = png(f'cold_cap', html_emph(c['text'], c.get('style', 'gag')), 1000, 220); PNG.append(it)
            ta = p['o0'] + c.get('at', 0.2)
            OV.append({'png': it['out'], 'x': c['x'] - 500, 'y': c['y'] - 110, 't0': ta, 't1': p['o1'], 'anim': 'pop'})
            SND.append((ta, c.get('sfx', 'pop'), 0.6))
        cnt = p['shot'].get('count')   # numbers popping over what the joke is about (her five legs), one by one
        if cnt:
            for j, x in enumerate(cnt['xs']):
                it = png(f'count_{j}', html_count(j + 1), 140, 140); PNG.append(it)
                ta = p['o0'] + cnt['at'] + j * cnt['step']
                OV.append({'png': it['out'], 'x': x - 70, 'y': cnt['y'] - 70, 't0': ta, 't1': p['o1'], 'anim': 'pop'})
                SND.append((ta, cnt.get('sfx', 'pop'), 0.45))
        if p['shot'].get('end_sfx'): SND.append((p['o1'] - 0.42, p['shot']['end_sfx'], 0.7))
    # zoom-ins get a whoosh (a cut into a closer frame)
    prevz = None   # one effect per beat: a punch-in on a line that already has a caption gets no whoosh
    for p in srcs:
        if p.get('zoom') and p['zoom'] != prevz and p['o0'] >= t_main and not any(l in P.EMPH for l in p['lines']):
            SND.append((max(t_main, p['o0'] - 0.12), 'whoosh', 0.16))
        prevz = p.get('zoom')
    SND.append((parts[len(cold)]['o0'] - 0.15, 'whip', 0.5))
    CLIPS = []
    # title + end cards
    T = P.TITLE; E = P.END
    bg = 'file://' + os.path.join(a.ep, T['bg']); room = 'file://' + os.path.join(CACHE, 'rooms', 'kate_room.jpg')
    CLIPS += [{'out': os.path.join(G, 'title.mp4'), 'w': 1920, 'h': 1080, 'fps': FPS, 'dur': TITLE_D, 'html': html_title(T, bg, 'file://' + a.portrait)},
              {'out': os.path.join(G, 'end.mp4'), 'w': 1920, 'h': 1080, 'fps': FPS, 'dur': END_D, 'html': html_end(E, room, 'file://' + (a.portrait_end or a.portrait), bg)}]
    spec = os.path.join(G, 'spec.json'); json.dump({'png': PNG, 'clips': CLIPS}, open(spec, 'w'), ensure_ascii=False)
    print('cards ...', flush=True); r = run(['node', os.path.join(HERE, 'cards.mjs'), spec]); print(r.stdout.strip().splitlines()[-1])

    # per-part video
    VID = os.path.join(a.bd, 'final.mp4'); jobs = []
    for i, p in enumerate(parts):
        o = os.path.join(G, f'part_{i:03d}.mp4'); p['file'] = o
        if p.get('kind') == 'clip': p['file'] = os.path.join(G, p['name'] + '.mp4'); continue
        ins = ['-ss', f"{p['s0']:.3f}", '-i', VID]; fc = []; k = 1
        chain = f"[0:v]setpts=(PTS-STARTPTS)/{p['speed']},fps={FPS}"
        if p.get('zoom'):
            x, y, w, h = P.Z[p['zoom']]; chain += f",crop={w}:{h}:{x}:{y},scale=1920:1080:flags=lanczos"
        if p['nh']: chain += f",trim=end_frame={p['n']},tpad=stop_mode=clone:stop=0:stop_duration={p['nh'] / FPS:.3f}"
        fc.append(chain + '[b0]'); last = 'b0'; dur = (p['n'] + p['nh']) / FPS
        for ov in OV:
            if ov['t1'] <= p['o0'] + 1e-6 or ov['t0'] >= p['o1'] - 1e-6: continue
            a0, a1 = max(0.0, ov['t0'] - p['o0']), min(dur, ov['t1'] - p['o0'])
            if 'png' in ov:
                ins += ['-loop', '1', '-framerate', str(FPS), '-t', f'{dur:.3f}', '-i', ov['png']]
                lab = f'o{k}'; pre = f"[{k}:v]format=rgba"
                starts_here = ov['t0'] >= p['o0'] - 1e-6
                if ov['anim'] and starts_here: pre += f",fade=t=in:st={a0:.3f}:d=0.12:alpha=1"
                fc.append(pre + f'[{lab}]')
                yx = str(ov['y'])
                if ov['anim'] == 'pop' and starts_here: yx = f"{ov['y']}-36*max(0\\,1-(t-{a0:.3f})/0.14)"
                if ov['anim'] == 'slide' and starts_here: xx = f"{ov['x']}-60*max(0\\,1-(t-{a0:.3f})/0.18)"
                else: xx = str(ov['x'])
                fc.append(f"[{last}][{lab}]overlay=x='{xx}':y='{yx}':enable='between(t,{a0:.3f},{a1:.3f})':eof_action=pass[v{k}]")
            else:
                off = max(0.0, p['o0'] - ov['t0'])
                ins += ['-ss', f'{off:.3f}', '-i', ov['video']]
                fc.append(f"[{k}:v]setpts=PTS-STARTPTS+{a0:.3f}/TB[o{k}]")
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
    for t, name, g in SND: put(fx, SFXW[name], t, g * rms * 3.2)
    jing = read_wav(os.path.join(snd_dir, 'jingle.wav')); put(mus, jing, parts[len(cold)]['o0'], rms * 2.6)
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
           'subs': subs, 'overlays': [{k: v for k, v in o.items() if k != 'html'} for o in OV], 'sounds': SND, 'jingle_at': parts[len(cold)]['o0'],
           'stats': {'source_min': C.ev['T'] / 60, 'lines_kept': len(kept), 'lines_total': len(C.V), 'speech_min': speech / 60, 'cuts': cuts, 'fills': fills,
                     'zooms': sum(1 for p in srcs if p.get('zoom')), 'emph': sum(1 for o in OV if 'emph_' in o.get('png', '')),
                     'chat': sum(1 for o in OV if 'chat_' in o.get('png', '')), 'inserts': len(getattr(P, 'INSERTS', []))},
           'chapters_ko': chk, 'chapters_en': che}
    json.dump(edl, open(os.path.join(a.out, 'edl.json'), 'w'), ensure_ascii=False, indent=1)
    print('edit ->', final, f'{total / 60:.2f} min')


def read_wav_any(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 's16le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True).stdout
    return (np.frombuffer(raw, np.int16).astype(np.float32) / 32768).reshape(-1, 2)


if __name__ == '__main__':
    main()
