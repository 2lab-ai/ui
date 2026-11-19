"""Main-video cover, Direction A of research_thumb.md: one Paint page in a yellow frame — thick Paint cows, one purple, a red
marker circle, a 3-word hook in Black Han Sans; the book is a small tag; Kate a small sticker. The opposite of the live cover."""
import json, os, sys
C = os.path.expanduser('~/.cache/2lab-stream/fonts/')
BUST = os.path.expanduser('~/2lab.ai/ARTIFACTS/stream/youtube-kate-from-earth/src/bust_surprise.png')
def cow(x, y, s, stroke, fill, spots, sw=12):
    # a Paint-style cow facing left: body, head, ears, horns, legs, tail, spots (thick round strokes)
    g = f'<g transform="translate({x},{y}) scale({s})" stroke="{stroke}" stroke-width="{sw / s:.1f}" stroke-linecap="round" stroke-linejoin="round" fill="{fill}">'
    g += '<path d="M40 40 C 60 10, 210 12, 228 40 C 246 70, 240 118, 214 126 C 160 138, 80 136, 50 124 C 26 112, 24 64, 40 40 Z"/>'          # body
    g += '<path d="M44 52 C 14 40, -24 52, -30 82 C -34 104, -16 120, 8 118 C 30 116, 46 100, 50 84" />'                                    # head
    g += '<path d="M-6 50 L -20 30 M 22 46 L 34 26" fill="none"/>'                                                                            # horns
    g += '<path d="M-18 60 C -36 56, -44 64, -38 70 M 34 60 C 50 54, 58 62, 50 68" fill="none"/>'                                            # ears
    g += '<circle cx="-6" cy="78" r="4" fill="#111" stroke="none"/><path d="M-26 104 C -18 110, -6 110, 2 104" fill="none"/>'               # eye, nose
    g += '<path d="M70 130 L 66 186 M 104 134 L 104 190 M 172 134 L 176 190 M 206 128 L 214 184 M 228 50 C 250 60, 256 90, 248 118" fill="none"/>'  # legs, tail
    for sx, sy, r in spots: g += f'<ellipse cx="{sx}" cy="{sy}" rx="{r}" ry="{r * 0.75}" fill="{spots and stroke}" stroke="none"/>'
    return g + '</g>'
def html():
    cows = cow(640, 150, 0.62, '#8a4f22', '#e9c7a2', [(120, 70, 18), (180, 96, 12)]) + cow(830, 120, 0.56, '#8a4f22', '#d9a77a', [(100, 60, 16)]) \
        + cow(1015, 160, 0.52, '#8a4f22', '#e9c7a2', [(150, 80, 20)]) + cow(830, 330, 0.95, '#5b1f99', '#9b4ddb', [(110, 70, 22), (178, 98, 14)], sw=13)
    ell = '<path d="M 790 352 C 900 290, 1170 300, 1196 420 C 1220 540, 1040 590, 900 572 C 760 552, 724 470, 760 400 C 772 378, 800 356, 838 342" stroke="#e5222b" stroke-width="12" fill="none" stroke-linecap="round"/>'
    return f'''<meta charset="utf-8"><style>
@font-face{{font-family:BH;src:url(file://{C}edit/BlackHanSans-Regular.ttf)}} @font-face{{font-family:Pen;src:url(file://{C}edit/NanumPenScript-Regular.ttf)}}
@font-face{{font-family:P;src:url(file://{C}pretendard/Pretendard-ExtraBold.woff2);font-weight:800}} @font-face{{font-family:P;src:url(file://{C}pretendard/Pretendard-Bold.woff2);font-weight:700}}
html,body{{margin:0;width:1280px;height:720px;background:#FFD400;overflow:hidden;font-family:P}}
#card{{position:absolute;left:36px;top:36px;width:1196px;height:636px;background:#fff;border:6px solid #111;border-radius:8px;box-shadow:12px 12px 0 #111;box-sizing:border-box;overflow:hidden}}
#strip{{position:absolute;left:0;right:0;top:0;height:44px;background:#E9ECF2;border-bottom:3px solid #111}}
#strip i{{position:absolute;top:12px;width:20px;height:20px;border-radius:50%}}
#tag{{position:absolute;left:262px;top:104px;color:#111}}
#tag .a{{font-weight:800;font-size:34px}} #tag .b{{font-weight:700;font-size:28px;margin-top:4px}}
#hook{{position:absolute;left:64px;top:318px;font-family:BH;font-size:150px;line-height:1.02;color:#111;letter-spacing:-3px}}
#hook .hl{{position:relative;z-index:1}} #hook .hl::before{{content:'';position:absolute;left:-8px;right:-10px;top:52%;height:45%;background:#FFD400;transform:skewX(-8deg) rotate(-2deg);z-index:-1}}
#note{{position:absolute;left:985px;top:252px;font-family:Pen;font-size:72px;color:#e5222b;transform:rotate(-6deg)}}
#kate{{position:absolute;left:40px;top:56px;width:200px;height:200px;border-radius:50%;background:#fff url(file://{BUST}) no-repeat;background-size:430px 491px;background-position:-115px -128px;box-shadow:0 0 0 8px #fff,0 0 0 13px #111;transform:rotate(-6deg)}}
svg{{position:absolute;left:0;top:0}}
</style>
<div id="card"><div id="strip"><i style="left:20px;background:#111"></i><i style="left:48px;background:#E5222B"></i><i style="left:76px;background:#FFD400;box-shadow:0 0 0 2px #111 inset"></i><i style="left:104px;background:#7B2FBE"></i></div></div>
<svg width="1280" height="720">{cows}{ell}</svg>
<div id="tag"><div class="a">세스 고딘 『보랏빛 소가 온다』</div><div class="b">30분 완독 · 책듣는밤</div></div>
<div id="hook">평범하면<br><span class="hl">안 보인다</span></div>
<div id="note">얘만 보임!</div>
<div id="kate"></div>'''
out = sys.argv[1]
json.dump({'png': [{'out': out, 'w': 1280, 'h': 720, 'html': html()}]}, open(out + '.json', 'w'), ensure_ascii=False)
