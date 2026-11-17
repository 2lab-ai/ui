"""QA stills of an edit (편집본): the cold open and title strip, then one still per editor mark found in edl.json — corner and
state labels, the live-date label, photos (inserts, B-roll, cards), chat bubbles and chat punch-ins, pans, every caption tone
other than plain, every EMPH mark, the end card. Look at every sheet before a review: boxes that cut words, marks that cover
each other, unreadable captions.
usage: python qa_edit.py <edit dir> <out prefix>   ->  <out prefix>_00.jpg, _01.jpg, ... (16 stills a sheet, labelled kind @ m:ss)"""
import json, subprocess, sys, io, os
from PIL import Image, ImageDraw, ImageFont
D, OUTP = sys.argv[1], sys.argv[2]
E = json.load(open(os.path.join(D, 'edl.json'))); V = os.path.join(D, 'final_edit.mp4')
F = ImageFont.truetype('/System/Library/Fonts/AppleSDGothicNeo.ttc', 22)
def fr(t):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.3f}', '-i', V, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], capture_output=True).stdout
    return Image.open(io.BytesIO(raw)).convert('RGB').resize((640, 360))
picks = []
c1 = E['title'][0]
for t in [0.5, 1.6, 2.6, 3.6, 4.6, 5.6, 6.8, 8.0, 9.5, c1 + 0.6, c1 + 2.6, c1 + 4.5]: picks.append(('cold/title', t))
ov = E['overlays']
for kind in ('live', 'corner', 'state', 'broll', 'insert', 'chat', 'end'):
    xs = [o for o in ov if o.get('kind') == kind and (o.get('anim') or kind == 'broll')]
    for o in xs[:12]: picks.append((kind + ' ' + (o.get('text') or os.path.basename(o.get('png', o.get('video', ''))))[:18], o['t0'] + min(1.0, (o['t1'] - o['t0']) / 2)))
for o in ov:
    if o.get('kind') == 'emph': picks.append(('emph ' + o.get('style', '') + ' ' + o.get('line', ''), o['t0'] + 0.6))
    if o.get('kind') == 'sub' and o.get('tone') not in (None, 'plain'): picks.append(('tone ' + o['tone'], o['t0'] + 0.3))
for m in E['main']:
    if m.get('zoom') == 'chat' or isinstance(m.get('zoom'), list): picks.append(('zoom ' + str(m['zoom']), (m['o0'] + m['o1']) / 2))
picks.append(('end+3', E['end'][0] + 3)); picks.append(('end+10', E['end'][0] + 10))
picks.sort(key=lambda x: x[1])
per = 16
for k in range(0, len(picks), per):
    grp = picks[k:k + per]; S = Image.new('RGB', (2560, 1440)); d = ImageDraw.Draw(S)
    for i, (lab, t) in enumerate(grp):
        x, y = (i % 4) * 640, (i // 4) * 360; S.paste(fr(t), (x, y))
        txt = f'{lab} @{int(t // 60)}:{t % 60:04.1f}'; d.rectangle([x, y, x + d.textlength(txt, font=F) + 10, y + 28], fill='black'); d.text((x + 5, y + 2), txt, fill='yellow', font=F)
    S.save(f'{OUTP}_{k // per:02d}.jpg', quality=82)
print(len(picks), 'stills')
