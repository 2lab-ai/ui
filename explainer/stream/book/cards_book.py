"""The streaming book's own title and end cards (HTML with window.setT for edit/cards.mjs): a different look from the live
stream's cards — the book's identity (night, serif title, one accent colour), not the stream's (photo, badges, the avatar).
Fonts from the asset cache: NanumMyeongjo ExtraBold (title), Pretendard (labels)."""
import os

CACHE = os.environ.get('STREAM_CACHE') or os.path.join(os.path.expanduser('~'), '.cache', '2lab-stream')
F1 = 'file://' + os.path.join(CACHE, 'fonts', 'edit', 'NanumMyeongjo-ExtraBold.ttf')
F2 = 'file://' + os.path.join(CACHE, 'fonts', 'pretendard', 'Pretendard-SemiBold.woff2')
F3 = 'file://' + os.path.join(CACHE, 'fonts', 'pretendard', 'Pretendard-ExtraBold.woff2')

HEAD = """<meta charset="utf-8"><style>
@font-face{font-family:T;src:url(%s)} @font-face{font-family:P;src:url(%s);font-weight:600} @font-face{font-family:P;src:url(%s);font-weight:800}
html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#0b0d1c;font-family:P}
#bg{position:absolute;inset:-40px;background-size:cover;background-position:center;filter:blur(14px) brightness(.42) saturate(1.1)}
#vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50%% 50%%,rgba(10,10,30,0) 30%%,rgba(6,6,18,.75) 100%%)}
.a{position:absolute;opacity:0}
</style>""" % (F1, F2, F3)

def _ease():
    return "const E=x=>x<0?0:x>1?1:1-Math.pow(1-x,3); const S=(t,a,b)=>E((t-a)/(b-a));"


def title_html(series, episode, title, sub, accent, bg, photo=None, author=''):
    ph = f"<div class='a' id='ph' style='left:250px;top:250px;width:420px;height:560px;background:#f4f0e8;padding:18px;box-sizing:border-box;box-shadow:0 30px 60px rgba(0,0,0,.55)'><div style=\"width:100%;height:100%;background:url('{photo}') center/cover\"></div></div>" if photo else ''
    x0 = 790 if photo else 260
    return HEAD + f"""<div id="bg" style="background-image:url('{bg}')"></div><div id="vig"></div>{ph}
<div class="a" id="lab" style="left:{x0}px;top:330px;font-weight:800;font-size:34px;letter-spacing:6px;color:{accent}">{series} · {episode}</div>
<div class="a" id="tt" style="left:{x0 - 6}px;top:392px;font-family:T;font-size:150px;color:#fff;letter-spacing:-2px;white-space:nowrap;text-shadow:0 6px 30px rgba(0,0,0,.6)">{title}</div>
<svg class="a" id="ln" style="left:{x0}px;top:600px" width="900" height="30"><path id="lp" d="M4 18 C 220 8, 520 26, 896 12" stroke="{accent}" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="1000" stroke-dashoffset="1000"/></svg>
<div class="a" id="sub" style="left:{x0}px;top:650px;font-weight:600;font-size:40px;color:rgba(255,255,255,.88)">{sub}</div>
<div class="a" id="au" style="left:{x0}px;top:716px;font-weight:600;font-size:30px;color:rgba(255,255,255,.55)">{author}</div>
<script>{_ease()}
window.setT=t=>{{const g=(id,o,y)=>{{const e=document.getElementById(id);if(!e)return;e.style.opacity=o;e.style.transform=`translateY(${{y}}px)`}};
g('ph',S(t,.1,.7),40*(1-S(t,.1,.9)));g('lab',S(t,.35,.9),18*(1-S(t,.35,1)));g('tt',S(t,.55,1.25),36*(1-S(t,.55,1.4)));
document.getElementById('ln').style.opacity=t>1.1?1:0;document.getElementById('lp').style.strokeDashoffset=1000*(1-S(t,1.15,2.1));
g('sub',S(t,1.6,2.2),14*(1-S(t,1.6,2.3)));g('au',S(t,1.9,2.5),10*(1-S(t,1.9,2.6)));
const out=1-S(t,4.45,4.95);document.body.style.opacity=out;document.getElementById('bg').style.transform=`scale(${{1.04+0.03*t/5}})`;}};setT(0)</script>"""


def end_html(title, lines, accent, bg, box_img=None, box_label=''):
    box = f"""<div class="a" id="bx" style="left:200px;top:300px;width:880px;height:495px;background:#000 url('{box_img}') center/cover;outline:4px solid {accent};outline-offset:8px"></div>
<div class="a" id="bl" style="left:200px;top:820px;font-weight:800;font-size:34px;color:#fff">{box_label}</div>""" if box_img else ''
    ls = ''.join(f'<div style="margin-bottom:18px">{l}</div>' for l in lines)
    return HEAD + f"""<div id="bg" style="background-image:url('{bg}')"></div><div id="vig"></div>{box}
<div class="a" id="t" style="left:1180px;top:290px;font-family:T;font-size:68px;line-height:1.2;color:#fff;width:680px;word-break:keep-all">{title}</div>
<div class="a" id="l" style="left:1184px;top:500px;font-weight:600;font-size:34px;line-height:1.35;color:rgba(255,255,255,.82);width:680px;word-break:keep-all">{ls}</div>
<div class="a" id="sc" style="left:1184px;top:820px;width:150px;height:150px;border-radius:50%;border:5px solid {accent};box-sizing:border-box"></div>
<div class="a" id="st" style="left:1360px;top:868px;font-weight:800;font-size:38px;color:{accent}">구독</div>
<script>{_ease()}
window.setT=t=>{{const g=(id,o,y)=>{{const e=document.getElementById(id);if(!e)return;e.style.opacity=o;e.style.transform=`translateY(${{y}}px)`}};
g('bx',S(t,.1,.7),30*(1-S(t,.1,.8)));g('bl',S(t,.5,1),0);g('t',S(t,.3,.9),24*(1-S(t,.3,1)));g('l',S(t,.8,1.4),14*(1-S(t,.8,1.5)));g('sc',S(t,1.2,1.7),0);g('st',S(t,1.3,1.8),0);
document.body.style.opacity=1-S(t,7.0,7.5);document.getElementById('bg').style.transform=`scale(${{1.03+0.02*t/7.5}})`;}};setT(0)</script>"""
