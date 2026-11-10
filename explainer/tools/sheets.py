"""Contact sheets (12 stills per page) for reviewing renders: python sheets.py ['out/still_*.jpg' [out/sheet]]"""
import sys, os, glob
from PIL import Image, ImageDraw, ImageFont
files = sorted(glob.glob(sys.argv[1] if len(sys.argv) > 1 else 'out/still_*.jpg'))   # default: every still in out/
out = sys.argv[2] if len(sys.argv) > 2 else 'out/sheet'; per = 12; cols = 4; tw, th = 480, 270
if not files: sys.exit('no stills: run export.py stills <t...> first')
try:
    font = ImageFont.truetype(next(p for p in ('fonts/Pretendard.ttf', 'fonts/NotoSansKR.ttf') if os.path.exists(p)), 20)
except StopIteration:
    font = ImageFont.load_default()
for n in range(0, len(files), per):
    sheet = Image.new('RGB', (cols * tw, 3 * th), 'black'); d = ImageDraw.Draw(sheet)
    for j, f in enumerate(files[n:n + per]):
        im = Image.open(f).resize((tw, th)); x, y = (j % cols) * tw, (j // cols) * th
        sheet.paste(im, (x, y)); d.rectangle([x, y, x + 110, y + 28], fill='black'); d.text((x + 6, y + 2), os.path.basename(f)[6:13], fill='white', font=font)
    sheet.save(f'{out}_{n // per}.jpg', quality=85)
    print(f'{out}_{n // per}.jpg')
