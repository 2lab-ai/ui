"""QA stills from the final video at the moments that matter -> qa/<name>.jpg + qa/sheet.jpg
usage: python qa_stills.py build"""
import json, os, subprocess, sys
from PIL import Image

B = sys.argv[1]; R = json.load(open(os.path.join(B, 'marks.json')))
ev = json.load(open(os.path.join(B, 'events.json')))
start = {lid: t0 for who, lid, t0, d in ev['voices']}
T = ev['T']
SHOTS = [('00 opening', start['o03'] + 1.0), ('01 title typed', R['title'] + 1.0), ('02 milk carton', start['b09'] + 0.5),
         ('03 cows', start['c11'] + 0.5), ('04 aurochs', start['c14'] + 2.0), ('05 think+scratch', R['think1'] + 1.6),
         ('06 donation 1', R['don1'] + 1.5), ('07 TV loop + X', start['t10'] + 1.0), ('08 doorbell', start['p01'] + 0.4),
         ('09 walk-off', R['afk0'] + 2.2), ('10 empty seat + parcel banner', R['afk0'] + 30.0), ('11 sister peeks', R['sis_in'] + 1.8),
         ('12 sister whisper', start['y04'] + 1.0), ('13 sister typing', start['y08'] - 2.0), ('14 sister runs', R['sis_out'] - 0.1),
         ('15 walk-in', R['afk1'] + 1.0), ('16 note found', start['p07'] + 0.6), ('17 curve + sneezer', start['i14'] + 0.5),
         ('18 donation 2', R['don2'] + 1.5), ('19 jug chair lift', start['x16'] + 1.0), ('20 camel', start['x28'] + 0.5),
         ('21 edges', start['g05'] + 1.0), ('22 donation 3', R['don3'] + 1.5), ('23 last page', start['z04'] + 1.0),
         ('24 goodnight', start['z08'] + 1.0), ('25 end', T - 0.5)]
os.makedirs('qa', exist_ok=True); ims = []
for name, t in SHOTS:
    p = f'qa/{name.replace(" ", "_")}.jpg'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{max(0, t):.2f}', '-i', os.path.join(B, 'final.mp4'), '-frames:v', '1', '-q:v', '3', p], check=True)
    ims.append((name, t, p))
W, H, C = 480, 270, 4
sheet = Image.new('RGB', (W * C, H * ((len(ims) + C - 1) // C)), (20, 20, 20))
from PIL import ImageDraw
for k, (name, t, p) in enumerate(ims):
    im = Image.open(p).resize((W, H)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 18], fill=(0, 0, 0)); d.text((4, 3), f'{name}  {int(t // 60):02d}:{int(t % 60):02d}', fill=(255, 255, 0))
    sheet.paste(im, ((k % C) * W, (k // C) * H))
sheet.save('qa/sheet.jpg', quality=82); print('qa/sheet.jpg', len(ims), 'stills')
