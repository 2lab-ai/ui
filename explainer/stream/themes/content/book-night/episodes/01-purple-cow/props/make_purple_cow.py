"""One cow in a real herd photo turns purple (the book's symbol, on screen as a photo).
Source: "Herd of Hereford cattle in Canada" by Quintin Soloviev, CC BY 4.0,
https://commons.wikimedia.org/wiki/File:Herd_of_Hereford_cattle_in_Canada.jpg (colour of one cow changed).
Usage: python make_purple_cow.py hereford_src.jpg out_dir
"""
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
W, H = im.size
k = W / 1280.0
# cow 4 (centre right, ears out), traced on the 1280-wide preview
poly = [(676,290),(700,280),(735,266),(760,254),(790,249),(815,260),(840,274),(860,270),(889,282),(886,306),
        (862,320),(852,326),(872,360),(890,392),(896,430),(894,490),(882,535),(866,568),(862,640),(856,676),
        (808,677),(812,622),(800,592),(752,598),(738,662),(698,664),(704,600),(698,560),(694,480),(698,400),
        (702,342),(700,320),(680,306)]
poly = [(x*k, y*k) for x, y in poly]
region = Image.new('L', (W, H), 0)
ImageDraw.Draw(region).polygon(poly, fill=255)
noses = [(770,374,822,416)]
for x0,y0,x1,y1 in noses:
    ImageDraw.Draw(region).ellipse((x0*k,y0*k,x1*k,y1*k), fill=0)
region = np.asarray(region.filter(ImageFilter.GaussianBlur(2*k)), dtype=np.float32) / 255.0

hsv = np.asarray(im.convert('HSV'), dtype=np.float32)
h, s, v = hsv[...,0]*360/255, hsv[...,1]/255, hsv[...,2]/255
# brown/red fur: hue 330..45 deg, saturated enough; white fur and grass stay
hd = np.minimum(np.abs(((h - 15) + 180) % 360 - 180), 90)
w_h = np.clip((45 - hd) / 15, 0, 1)
w_s = np.clip((s - 0.18) / 0.15, 0, 1)
mask = w_h * w_s * region
mask = np.asarray(Image.fromarray((mask*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8*k)), dtype=np.float32)/255

# recolour: hue -> 282 deg (violet), saturation up, lift the dark fur a little so it reads purple
nh = np.full_like(h, 276.0)
ns = np.clip(s*0.9 + 0.10, 0, 0.82)
nv = np.clip(v*1.18 + 0.04, 0, 1)
new = Image.fromarray(np.stack([nh/360*255, ns*255, nv*255], -1).astype(np.uint8), 'HSV').convert('RGB')
a = np.asarray(im, dtype=np.float32); b = np.asarray(new, dtype=np.float32)
res = a*(1-mask[...,None]) + b*mask[...,None]
outim = Image.fromarray(res.clip(0,255).astype(np.uint8))
outim.resize((2560, int(2560*H/W)), Image.LANCZOS).save(f'{out}/purple_cow_field_full.jpg', quality=86)   # title card / full-screen insert
outim.resize((1280, int(1280*H/W)), Image.LANCZOS).save(f'{out}/purple_cow_field.jpg', quality=90)
Image.fromarray((mask*255).astype(np.uint8)).resize((1280, int(1280*H/W))).save(f'{out}/mask_preview.png')

# the whole field turns purple ('다들 따라서 보라색으로 칠하면, 그 들판은 또 보라색 소 천지예요'): the same recolour on every brown coat
yy = np.arange(H)[:, None] / H
field = (yy > 0.25).astype(np.float32)                       # the cows stand below the sky line; the sky has no brown
mall = w_h * w_s * field
from scipy import ndimage                                     # keep the coats, drop brown flecks of soil in the grass
lab, nlab = ndimage.label(mall > 0.5); sizes = ndimage.sum(np.ones_like(mall), lab, range(1, nlab + 1))
keep = np.isin(lab, 1 + np.flatnonzero(sizes > 6000 * (W / 3840) ** 2))
mall = mall * ndimage.binary_dilation(keep, iterations=int(4 * k)).astype(np.float32)
mall = np.asarray(Image.fromarray((mall*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8*k)), dtype=np.float32)/255
res2 = a*(1-mall[...,None]) + b*mall[...,None]
Image.fromarray(res2.clip(0,255).astype(np.uint8)).resize((2560, int(2560*H/W)), Image.LANCZOS).save(f'{out}/purple_field_all.jpg', quality=86)
print('ok', outim.size)
