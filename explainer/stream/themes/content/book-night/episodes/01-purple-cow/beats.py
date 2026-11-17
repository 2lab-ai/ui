"""책듣는밤 1화 『보랏빛 소가 온다』 — a 30-minute book-night stream (content theme book-night, streamer kate, streaming default).
The channel's first stream ever: few viewers at the start, chat that knows nothing yet, a nervous first hello.
Owner rules: no nicknames anywhere; she never narrates her own actions; natural exits and entrances; the lore is only implied;
not every question is answered. Owner (2026-11-17): no bathroom break — she steps out 120 s for a parcel and her younger
sister drops in for a little while.
Pages in Paint (Ctrl+A, Delete between topics): 1 title + milk carton, 2 cows, 3 remarkable, 4 the TV formula / sliced
bread / P's, 5 who listens (curve, sneezer, otaku), 6 real purple cows (paint jug, chair, lift, safe is risky, camel),
7 edges + closing."""
import json, math, os, re
from build import densify, humanize, CV

TAIL = 6.0
CLOCK0 = 22 * 3600 + 2 * 60 + 14          # 오후 10:02:14
BRB_SECS = 0                               # the banner counts up
BADGES = {}
STREAM_TITLE = '📖 책듣는밤 1화 · 보랏빛 소가 온다 · 첫 방송'
STRINGS = {'brb_title': '택배 받으러 잠깐!', 'brb_emoji': '📦'}
VIEWERS = (38, 142)                        # a first stream: starts small, grows
WHISPER_HARD_DROP = ['y03']                # the one whisper the noise gate chops (chat: '소리 끊겨요')
HERE = os.path.dirname(os.path.abspath(__file__))
LINES = {l['id']: l for l in json.load(open(os.path.join(HERE, 'lines.json')))}
U = [chr(97 + i) for i in range(26)] + ['u' + str(i) for i in range(40)]   # internal ids only, never shown

# --------------------------------------------------------------------------------------------- chat
# reusable short reactions (never the same one twice within 45 s)
GENERIC = ['ㅋㅋㅋ', 'ㅋㅋ', 'ㅎㅎ', '오', '오오', 'ㄹㅇ', 'ㅇㅈ', '👍', '👏', '와', '굿', '😂', '공감', 'ㄷㄷ', '메모함', 'ㅇㅇ', '맞아요',
           '헐', '👀', 'ㅋㅋㅋㅋ', '오 신기', '그렇네', '😮', 'ㅎㅎㅎ']
# once each, anywhere: (message, not before this line id, reply)
FILLER = [('처음 왔어요', None, None), ('목소리 좋다', 'o06', None), ('그림판 오랜만에 봄', 'o13', None), ('키보드 소리 좋다', 'o07', 'ㄴ ASMR 같음'),
          ('자기 전에 틀어놓기 딱이네', 'o12', None), ('퇴근길에 듣는 중', None, None), ('과제하면서 듣는 중', None, None), ('배고프다', None, None),
          ('브금 뭐에요?', 'o16', None), ('자막 있으면 좋겠다', 'b03', None), ('방송 몇 시에 해요?', 'o20', None), ('구독 눌렀어요', 'o04', None),
          ('알림 설정함', 'o04', None), ('첫방인데 차분하시네', 'o18', None), ('이 채널 뜰 듯', 'b09', None), ('모자 귀엽다', None, None),
          ('방 분위기 좋다', 'o15', None), ('조명 따뜻하다', None, None), ('잠 온다 ㅋㅋ', 'o12', 'ㄴ 자도 된다잖아요 ㅋㅋ'), ('물 드시면서 하세요', 'c10', None),
          ('오늘 몇 시까지 해요?', 'o21', None), ('책 사러 감', 'b18', None), ('리스닝 중', None, None), ('공부하면서 틀어놓음', None, None),
          ('야식 먹는 중', None, None), ('친구한테 링크 보냄', 'i14', None), ('이거 회사 단톡에 올림', 'i16', 'ㄴ 재채기 ㅋㅋㅋ'), ('설명 쉽다', 'r04', None),
          ('필기하는 중', 'r04', None), ('방금 옴 무슨 책이에요?', 'b02', 'ㄴ 보랏빛 소가 온다'), ('그림 은근 잘 그리심', 'c12', 'ㄴ 은근은 아님 ㅋㅋ'),
          ('이 책 집에 있음', 'b02', None), ('마케팅팀인데 뼈 맞는 중', 't24', None), ('회사에서 이거 읽으라 했는데 여기서 들음', 'b03', 'ㄴ 개꿀'),
          ('알고리즘 고마워', 'o06', None), ('오늘 첫방 맞음?', 'o04', 'ㄴ ㅇㅇ 1화'), ('1화 박제', 'o07', None), ('목소리 ASMR', 'o16', None),
          ('저도 첫 책으로 딱인 듯', 'b15', None), ('다들 어디서 왔어요?', 'o06', 'ㄴ 알고리즘 ㅋㅋ'), ('이 시간에 딱이다', None, None),
          ('졸린데 계속 듣게 됨', 'r12', None), ('보라색 소 그림 진짜 귀엽다', 'c12', None), ('식빵 그림 ㅋㅋ', 't14', None),
          ('오타쿠 손', 'i19', None), ('엘리베이터 그거 신기했음', 'x16', None), ('낙타 ㅋㅋㅋ 아직도 웃김', 'x29', None), ('2화 언제에요?', 'z05', None)]
BURST = {'first': ['첫방 축하해요!!', '🎉', '1화!', '첫방 ㄷㄷ', '축하드려요', '첫 시청자 등장'],
         'cows': ['ㅋㅋㅋ 20분 ㄹㅇ', '나도 소 보다 잠듦', 'ㅋㅋㅋㅋ', '익숙해짐 ㅋㅋ', 'ㄹㅇ 소는 소지'],
         'sis_in': ['????', '누구야 ㅋㅋㅋ', '동생?', 'ㅋㅋㅋㅋㅋ', '헐', '누구세요 ㅋㅋ', '자매 방송?', 'ㄷㄷ'],
         'sis_mid': ['ㅋㅋㅋ', '안 들려요', '언니한테 이를 거임', '열 번 ㅋㅋㅋ', '😂', '귀엽다', '쉿 ㅋㅋ', '비밀 지켜드림'],
         'doodle': ['ㅋㅋㅋㅋㅋㅋ', '다리 다섯 개 ㅋㅋㅋ', '박제', '캡처함', '동생 최고', 'ㅋㅋㅋ 이거 남겨요'],
         'back': ['오셨다', '왔다!!', '동생 왔다 갔어요!', '2분 넘음 ㅋㅋ', '다녀오셨어요', '택배 뭐에요?', '그림판 보세요 ㅋㅋ'],
         'laugh': ['ㅋㅋㅋㅋㅋ', 'ㅋㅋㅋㅋㅋㅋ', '😂', 'ㅋㅋㅋ'],
         'don1': ['첫 후원 ㄷㄷ', '👏👏', '축하해요', '첫 후원 박제'],
         'don2': ['여섯 개 ㄷㄷ', '오타쿠 인정', 'ㅋㅋㅋ 키보드', '👏'],
         'don3': ['총균쇠 ㄱㄱ', '벽돌 ㅋㅋ', '👏', '찬성'],
         'end': ['잘자요~', '수고하셨어요', '2화 기다림', '첫방 축하해요 🎉', '구독 박음', '좋은 방송 감사해요', '다음 책 기대', '굿밤']}


LAST_END = {}


def S(B, lid, gap=0.4, gaze=None, expr=None, at=None):
    """one line: who comes from lines.json; a [laughs] tag inside the line also moves the face. A line never starts
    before the same speaker's previous line has ended (a line timed to the typing could otherwise overlap)."""
    who = LINES[lid]['who']
    at = B.t if at is None else at
    at = max(at, LAST_END.get(who, -1e9) + 0.15)
    t0, t1 = B.say(lid, gap=gap, gaze=gaze, expr=expr, at=at)
    LAST_END[who] = t1
    L = LINES[lid]; tts = L.get('tts') or ''
    for m in re.finditer(r'\[(laughs[^\]]*)\]', tts):
        before = re.sub(r'<[^>]+>|\[[^\]]+\]', '', tts[:m.start()])
        nb = len(re.sub(r'[^가-힣0-9]', '', before)); na = len(re.sub(r'[^가-힣0-9]', '', L['text']))
        B.laughs.append((t0 + (t1 - t0) * nb / max(1, na), L['who'], 0.75 if 'softly' in m.group(1) else 1.0))
    return t0, t1


def M(B, rng, text, dt=0.0, at=None):
    B.msg(U[int(rng.integers(len(U)))], text, dt=dt, at=at)


def burst(B, rng, t0, kind, n, dur):
    msgs = list(BURST[kind]); rng.shuffle(msgs)
    for k in range(min(n, len(msgs))):
        M(B, rng, msgs[k], at=t0 + rng.uniform(0.6, dur))


def fill_chat(B, rng, T, skip):
    """the quiet baseline: a message every few seconds, lulls of 10-25 s now and then, short reactions reused sparingly,
    longer messages once each and never before the line they talk about"""
    said = {lid: t0 for w, lid, t0, d in B.voices}
    used = set(); last_g = {}; t = 4.0; next_lull = rng.uniform(70, 140)
    while t < T:
        if t > next_lull:
            t += rng.uniform(10, 25); next_lull = t + rng.uniform(80, 170); continue
        busy = any(a <= t < b for a, b in skip) or any(abs(t - c[0]) < 0.6 for c in B.chat)
        if not busy:
            ok = [k for k, (m_, g_, r_) in enumerate(FILLER) if k not in used and (g_ is None or said.get(g_, 1e9) + 1.5 <= t)]
            if ok and rng.random() < 0.45:
                k = ok[int(rng.integers(len(ok)))]; used.add(k); m_, g_, r_ = FILLER[k]
                M(B, rng, m_, at=t)
                if r_: M(B, rng, r_, at=t + rng.uniform(1.3, 2.6))
            else:
                g = [m for m in GENERIC if t - last_g.get(m, -1e9) > 45]
                if g:
                    m = g[int(rng.integers(len(g)))]; last_g[m] = t; M(B, rng, m, at=t)
        t += rng.exponential(3.2) + 0.8


# --------------------------------------------------------------------------------------------- Paint drawings
def loop_pts(cx, cy, rx, ry, a0=-2.0, sweep=None, n=44, wob=0.05, seed=1):
    import numpy as np
    g = np.random.default_rng(seed)
    sweep = sweep if sweep is not None else 2 * math.pi + g.uniform(-0.4, 0.25)
    out = []
    for i in range(n):
        th = a0 + sweep * i / (n - 1)
        rr = 1 + wob * math.sin(2 * th + 1.1) + 0.6 * wob * math.sin(3 * th)
        out.append((cx + rx * rr * math.cos(th), cy + ry * rr * math.sin(th)))
    return out


def line(B, pts, speed=320, wob=2.5, jit=0.6, hook=False, t0=None):
    return B.stroke(densify(pts), speed=speed, wob=wob, jit=jit, hook=hook, t0=t0)


def arrow(B, p0, p1, head=16, speed=340):
    line(B, [p0, p1], speed=speed, wob=2.0)
    ang = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
    for s_ in (+1, -1):
        a = ang + math.pi - s_ * 0.5
        line(B, [p1, (p1[0] + head * math.cos(a), p1[1] + head * math.sin(a))], speed=200, wob=0.6, jit=0.4)


def cow(B, rng, x, y, s=1.0, legs=4, tail=True, horns=True, speed=330):
    """a mouse-drawn cow: lumpy body, a little head with horns, stick legs, a tail. legs=5 is the one she gets wrong."""
    w, h = 150 * s, 66 * s
    body = [(x + 12 * s, y), (x + w * 0.5, y - 3 * s), (x + w - 10 * s, y + 2 * s), (x + w, y + h * 0.5), (x + w - 8 * s, y + h),
            (x + w * 0.5, y + h + 2 * s), (x + 10 * s, y + h - 2 * s), (x - 2 * s, y + h * 0.5), (x + 9 * s, y + 5 * s)]
    B.stroke(densify(humanize(body, rng, over=(2, 5))), speed=speed, wob=2.6, jit=0.5)
    hx, hy = x + w + 22 * s, y - 6 * s
    B.stroke(densify(loop_pts(hx, hy, 22 * s, 18 * s, seed=int(x + y))), speed=speed * 0.8, wob=1.6, jit=0.5)
    if horns:
        line(B, [(hx - 12 * s, hy - 15 * s), (hx - 17 * s, hy - 30 * s)], speed=180, wob=0.6)
        line(B, [(hx + 9 * s, hy - 16 * s), (hx + 15 * s, hy - 31 * s)], speed=180, wob=0.6)
    xs = [x + 20 * s, x + 44 * s, x + 104 * s, x + 128 * s] if legs == 4 else [x + 18 * s, x + 40 * s, x + 74 * s, x + 106 * s, x + 130 * s]
    for lx in xs:
        line(B, [(lx, y + h - 1 * s), (lx + rng.uniform(-4, 4) * s, y + h + 50 * s)], speed=300, wob=1.2, hook=True)
    if tail:
        line(B, [(x + 2 * s, y + 12 * s), (x - 14 * s, y + 26 * s), (x - 18 * s, y + 46 * s)], speed=220, wob=1.0)


def carton(B, x, y):
    """a gable-top milk carton"""
    B.stroke(densify([(x, y + 60), (x, y + 250), (x + 140, y + 250), (x + 140, y + 60), (x + 2, y + 62)]), speed=320, wob=2.0, jit=0.5)
    line(B, [(x - 2, y + 60), (x + 70, y + 8), (x + 142, y + 60)], speed=300, wob=1.5)
    line(B, [(x + 48, y + 8), (x + 92, y + 8), (x + 92, y - 14), (x + 48, y - 14), (x + 48, y + 6)], speed=220, wob=0.8)


def loaf(B, rng, x, y):
    B.stroke(densify([(x, y + 110), (x + 190, y + 110), (x + 192, y + 40)] + loop_pts(x + 96, y + 40, 96, 42, a0=0, sweep=-math.pi, n=24, seed=7)
                     + [(x, y + 110)]), speed=320, wob=2.2, jit=0.5)
    for k in range(1, 6):
        sx = x + 32 * k
        line(B, [(sx + rng.uniform(-3, 3), y + 6 + abs(sx - x - 96) * 0.25), (sx + rng.uniform(-4, 4), y + 108)], speed=360, wob=0.8)


def jug(B, x, y):
    """Dutch Boy's plastic paint jug: a squarish body, a handle, a twist-off spout"""
    B.stroke(densify([(x + 20, y + 30), (x + 150, y + 30), (x + 160, y + 50), (x + 160, y + 210), (x + 10, y + 210), (x + 8, y + 52), (x + 22, y + 32)]),
             speed=320, wob=2.0, jit=0.5)
    line(B, [(x + 160, y + 70), (x + 205, y + 92), (x + 205, y + 150), (x + 160, y + 170)], speed=260, wob=1.4)
    line(B, [(x + 30, y + 30), (x + 30, y + 4), (x + 66, y + 4), (x + 66, y + 30)], speed=200, wob=0.8)


def camel(B, rng, x, y):
    back = [(x, y + 70), (x + 18, y + 38), (x + 48, y), (x + 76, y + 36), (x + 104, y + 4), (x + 136, y + 40), (x + 172, y + 36),
            (x + 196, y - 18), (x + 222, y - 22), (x + 230, y - 8), (x + 206, y - 2), (x + 192, y + 52), (x + 168, y + 84), (x + 20, y + 86), (x, y + 70)]
    B.stroke(densify(humanize(back, rng, over=(2, 5))), speed=310, wob=2.4, jit=0.5)
    for lx in (x + 26, x + 50, x + 130, x + 156):
        line(B, [(lx, y + 84), (lx + rng.uniform(-4, 4), y + 150)], speed=300, wob=1.0, hook=True)


def airplane(B, x, y):
    B.stroke(densify(loop_pts(x + 160, y, 165, 24, a0=3.0, seed=41)), speed=340, wob=1.6, jit=0.5)
    line(B, [(x + 150, y - 14), (x + 92, y - 88), (x + 128, y - 90), (x + 214, y - 18)], speed=300, wob=1.0)
    line(B, [(x + 150, y + 16), (x + 104, y + 84), (x + 140, y + 86), (x + 214, y + 20)], speed=300, wob=1.0)
    line(B, [(x + 12, y - 8), (x - 12, y - 56), (x + 18, y - 56), (x + 52, y - 16)], speed=260, wob=0.8)


def chair(B, x, y):
    line(B, [(x + 10, y + 80), (x + 14, y), (x + 100, y), (x + 106, y + 80)], speed=280, wob=1.2)
    line(B, [(x - 4, y + 82), (x + 120, y + 84)], speed=300, wob=0.8)
    line(B, [(x + 56, y + 86), (x + 56, y + 134)], speed=240, wob=0.5)
    line(B, [(x + 8, y + 140), (x + 106, y + 140)], speed=280, wob=0.7)
    for wx in (x + 10, x + 56, x + 104):
        line(B, [(wx, y + 140), (wx + 2, y + 152)], speed=140, wob=0.3)


def lift(B, x, y):
    B.stroke(densify([(x, y), (x + 110, y + 2), (x + 112, y + 160), (x + 2, y + 158), (x, y + 4)]), speed=330, wob=1.4, jit=0.4)
    line(B, [(x + 56, y + 4), (x + 57, y + 156)], speed=300, wob=0.5)
    arrow(B, (x + 140, y + 110), (x + 140, y + 40), head=12)
    arrow(B, (x + 164, y + 40), (x + 164, y + 110), head=12)


def bell_curve(B, x0, x1, base, peak):
    pts = []
    for i in range(60):
        u = i / 59; xx = x0 + (x1 - x0) * u
        pts.append((xx, base - (base - peak) * math.exp(-((u - 0.5) / 0.17) ** 2)))
    line(B, [(x0 - 20, base + 4), (x1 + 20, base + 2)], speed=420, wob=1.6)
    B.stroke(densify(pts), speed=300, wob=2.2, jit=0.5)


def xmark(B, cx, cy, r):
    line(B, [(cx - r, cy - r * 0.6), (cx + r, cy + r * 0.6)], speed=420, wob=1.2)
    line(B, [(cx + r, cy - r * 0.6), (cx - r, cy + r * 0.6)], speed=420, wob=1.2)


def typed(B, x, y, text, size=38, minw=300, t0=None, commit=True, cps=1.0):
    B.hand_at(B.t if t0 is None else t0)
    B.text_box(x, y, size=size, minw=minw)
    out = B.type(text, cps=cps)
    if commit: B.commit_box()
    return out


def look_screen(B, t0, t1):
    B.gaze.append((t0, t1, 'screen', 'main'))


# --------------------------------------------------------------------------------------------- the stream
def script(B, rng):
    R = {}   # times the review panel anchors to
    # ---- the stream is already live; she is checking the mic
    B.gaze.append((0.0, 2.2, 'screen', 'main'))
    B.pick_tool('pencil', 0.4)
    B.move(720, 560)
    B.t = 2.4
    S(B, 'o01', gaze='cam', expr='neutral', gap=0.9)
    M(B, rng, '들려요', at=B.t - 0.6); M(B, rng, '잘 들려요!', at=B.t + 0.1)
    S(B, 'o02', gaze='down', expr='soft', gap=0.6)
    S(B, 'o03', gaze='cam', expr='embarrassed', gap=0.5)
    S(B, 'o04', gaze='cam', expr='smile', gap=0.4)
    burst(B, rng, B.t - 1.0, 'first', 5, 4.0)
    B.t += 1.6
    S(B, 'o05', gaze='chat', expr='soft', gap=0.5)
    M(B, rng, '알고리즘 타고 왔어요', at=B.t - 0.4)
    S(B, 'o06', gaze='cam', expr='bigsmile', gap=0.6)
    S(B, 'o17', gaze='away', expr='embarrassed', gap=0.4)
    S(B, 'o18', gaze='cam', expr='soft', gap=0.8)
    # the series name, typed without a word; then the name and the concept
    t = B.t; look_screen(B, t - 0.2, t + 4.5)
    typed(B, 40, 30, '책듣는밤 1화', size=44, minw=330, t0=t + 0.2)
    B.sync_hand(0.4)
    S(B, 'o07', gaze='cam', expr='smile', gap=0.4)
    S(B, 'o08', gaze='cam', expr='sneaky', gap=0.5)
    M(B, rng, 'ㅋㅋㅋ 찔림', at=B.t - 0.3); M(B, rng, '제 방에 벽돌 세 권 있음', at=B.t + 1.1)
    S(B, 'o09', gaze='cam', expr='soft', gap=0.2)
    S(B, 'o10', gaze='cam', expr='smile', gap=0.5)
    S(B, 'o11', gaze='cam', expr='earnest', gap=0.6)
    M(B, rng, '오 컨셉 좋다', at=B.t - 0.2)
    S(B, 'o12', gaze='cam', expr='soft', gap=0.6)
    S(B, 'o21', gaze='cam', expr='smile', gap=0.7)
    S(B, 'o13', gaze='screen', expr='deadpan', gap=0.5)
    M(B, rng, '그림 기대함', at=B.t - 0.2); M(B, rng, '그림판 ㅋㅋㅋ', at=B.t + 0.5)
    S(B, 'o14', gaze='chat', expr='pout', gap=0.8)
    M(B, rng, '근데 배경에 화분 엄청 많네', at=B.t - 0.1)
    B.t += 1.2
    S(B, 'o15', gaze='chat', expr='soft', gap=0.6)
    S(B, 'o19', gaze='chat', expr='smile', gap=0.4)
    S(B, 'o20', gaze='cam', expr='soft', gap=0.8)
    M(B, rng, '목소리 진짜 좋다', at=B.t - 0.3)
    S(B, 'o16', gaze='chat', expr='embarrassed', gap=1.0)
    M(B, rng, '방금 들어옴 늦었다', at=B.t - 0.6)
    S(B, 'o22', gaze='chat', expr='surprise', gap=0.4)
    S(B, 'o23', gaze='cam', expr='smile', gap=1.0)

    # ---- page 1: the book
    t = B.t; look_screen(B, t - 0.2, t + 7.0)
    B.hand_at(t)
    B.text_box(40, 108, size=44, minw=430)
    B.type('보랏빛 소가 온다', t0=t + 0.3)
    S(B, 'b01', gaze='screen', expr='smile', at=B.hand_t - 0.6, gap=0.3)
    B.type('\n- 세스 고딘', prefix='보랏빛 소가 온다')
    B.commit_box(); B.sync_hand(0.3)
    R['title'] = B.t
    S(B, 'b02', gaze='cam', expr='soft', gap=0.6)
    M(B, rng, '오 이거 회사에서 읽으라고 준 책', at=B.t - 0.4); M(B, rng, '제목만 앎 ㅋㅋ', at=B.t + 0.6)
    S(B, 'b03', gaze='chat', expr='sneaky', gap=0.5)
    S(B, 'b19', gaze='cam', expr='neutral', gap=0.4)
    S(B, 'b20', gaze='cam', expr='deadpan', gap=0.4)
    S(B, 'b21', gaze='cam', expr='sneaky', gap=0.9)
    M(B, rng, '근데 벽돌책이라면서 얇지 않아요?', at=B.t - 0.3)
    B.t += 1.6
    S(B, 'b04', gaze='chat', expr='embarrassed', gap=0.4)
    S(B, 'b05', gaze='cam', expr='smile', gap=0.7)
    M(B, rng, 'ㅋㅋㅋ 워밍업', at=B.t - 0.6)
    S(B, 'b06', gaze='cam', expr='earnest', gap=0.5)
    M(B, rng, '우유팩??', at=B.t - 0.2); M(B, rng, '진짜요?', at=B.t + 0.4)
    S(B, 'b07', gaze='cam', expr='neutral', gap=0.4)
    S(B, 'b08', gaze='cam', expr='soft', gap=0.6)
    # the milk carton, drawn in silence
    t = B.t; look_screen(B, t - 0.3, t + 9)
    B.hand_at(t); B.pick_tool('pencil')
    R['carton0'] = B.hand_t
    carton(B, 720, 210)
    typed(B, 640, 480, '초판은 우유팩', size=38, minw=280)
    B.sync_hand(0.5)
    M(B, rng, 'ㅋㅋㅋ 우유팩 그림', at=B.t - 1.0)
    S(B, 'b09', gaze='cam', expr='soft', gap=0.6)
    M(B, rng, '마케팅 책을 마케팅으로 ㅋㅋ', at=B.t - 0.2)
    S(B, 'b22', gaze='cam', expr='neutral', gap=0.4)
    S(B, 'b23', gaze='cam', expr='neutral', gap=0.3)
    S(B, 'b24', gaze='cam', expr='soft', gap=0.3)
    S(B, 'b25', gaze='cam', expr='sneaky', gap=0.6)
    S(B, 'b10', gaze='cam', expr='neutral', gap=0.3)
    S(B, 'b11', gaze='cam', expr='surprise', gap=0.5)
    M(B, rng, '15만 부 ㄷㄷ', at=B.t - 0.3)
    S(B, 'b12', gaze='cam', expr='neutral', gap=0.6)
    M(B, rng, '저 옛날 판 있음', at=B.t - 0.4); M(B, rng, '표지 보라색이죠?', at=B.t + 0.9)
    B.t += 1.0
    S(B, 'b13', gaze='chat', expr='smile', gap=0.7)
    S(B, 'b14', gaze='cam', expr='soft', gap=0.3)
    S(B, 'b15', gaze='cam', expr='embarrassed', gap=0.6)
    S(B, 'b16', gaze='cam', expr='earnest', gap=0.3)
    S(B, 'b17', gaze='cam', expr='serious', gap=0.7)
    S(B, 'b18', gaze='cam', expr='soft', gap=0.6)
    M(B, rng, 'ㄱㄱ', at=B.t - 0.2); M(B, rng, '꼭꼭 ㅋㅋ', at=B.t + 0.4)

    # ---- page 2: the cows
    B.hand_at(B.t); B.clear_canvas()
    S(B, 'c01', gaze='cam', expr='soft', at=B.hand_t + 0.3, gap=0.4)
    S(B, 'c02', gaze='cam', expr='neutral', gap=0.3)
    S(B, 'c03', gaze='away', expr='soft', gap=0.5)
    t = B.t; look_screen(B, t - 0.3, t + 30)
    B.hand_at(t); B.pick_tool('pencil'); B.pick_color('brown')
    R['cow0'] = B.hand_t
    cow(B, rng, 70, 150, s=0.95, legs=5, tail=False)          # the one with five legs ('하나는 꼬리예요')
    S(B, 'c04', gaze='screen', expr='smile', at=B.hand_t + 0.2, gap=0.3)
    B.hand_at(B.t)
    cow(B, rng, 330, 120, s=0.9)
    S(B, 'c05', gaze='screen', expr='neutral', at=B.hand_t + 0.2, gap=0.2)
    S(B, 'c06', gaze='cam', expr='deadpan', gap=0.5)
    burst(B, rng, B.t - 1.4, 'cows', 3, 3.0)
    B.hand_at(B.t)
    cow(B, rng, 590, 170, s=0.85, speed=380)
    B.pick_color('black')
    typed(B, 80, 330, '20분 지나면 안 보임', size=36, minw=320)
    B.sync_hand(0.3)
    S(B, 'c07', gaze='cam', expr='soft', gap=0.5)
    M(B, rng, '다리 다섯 개 아님?', at=B.t - 0.8)                    # nobody answers it (the sister will)
    S(B, 'c08', gaze='cam', expr='neutral', gap=0.5)
    S(B, 'c09', gaze='cam', expr='earnest', gap=0.3)
    S(B, 'c10', gaze='cam', expr='surprise', gap=0.6)
    t = B.t; look_screen(B, t - 0.3, t + 14)
    B.hand_at(t); B.pick_tool('pencil'); B.pick_color('purple')
    R['purple0'] = B.hand_t
    cow(B, rng, 760, 380, s=1.25)
    B.pick_color('black')
    typed(B, 700, 610, '보랏빛 소!', size=40, minw=200)
    B.sync_hand(0.5)
    M(B, rng, '보라 소 ㅋㅋㅋ', at=B.t - 1.2); M(B, rng, '소 귀엽다', at=B.t - 0.3)
    S(B, 'c11', gaze='cam', expr='bigsmile', gap=0.4)
    S(B, 'c12', gaze='cam', expr='smile', gap=0.9)
    M(B, rng, '근데 보라색 소 진짜 있음?', at=B.t - 0.5)
    B.t += 1.0
    S(B, 'c28', gaze='chat', expr='smile', gap=1.0)
    R['aurochs'] = B.t
    S(B, 'c13', gaze='screen', expr='neutral', gap=0.3)
    S(B, 'c14', gaze='screen', expr='soft', gap=0.4)
    S(B, 'c15', gaze='cam', expr='soft', gap=0.8)
    M(B, rng, '오록스 ㄷㄷ', at=B.t - 1.0); M(B, rng, '오록스는 또 어떻게 아심 ㅋㅋ', at=B.t + 0.3)   # unanswered
    B.t += 0.8
    S(B, 'c16', gaze='cam', expr='neutral', gap=0.4)
    S(B, 'c24', gaze='chat', expr='soft', gap=0.5)
    S(B, 'c25', gaze='cam', expr='serious', gap=0.5)
    S(B, 'c26', gaze='cam', expr='neutral', gap=0.3)
    S(B, 'c27', gaze='cam', expr='deadpan', gap=0.4)
    S(B, 'c17', gaze='cam', expr='deadpan', gap=0.6)
    M(B, rng, '유튜브도 들판 ㅋㅋ 찔린다', at=B.t - 0.4)
    S(B, 'c18', gaze='cam', expr='neutral', gap=0.5)
    S(B, 'c19', gaze='chat', expr='smile', gap=1.4)
    M(B, rng, '하나도 기억 안 남', at=B.t - 1.0); M(B, rng, '편의점 하나?', at=B.t - 0.3)
    S(B, 'c20', gaze='chat', expr='laugh', gap=0.5)
    S(B, 'c21', gaze='cam', expr='earnest', gap=0.7)
    M(B, rng, '이 채널은 보라 소인가', at=B.t - 0.5)
    B.t += 0.6
    S(B, 'c22', gaze='chat', expr='soft', gap=0.3)
    S(B, 'c23', gaze='cam', expr='deadpan', gap=0.9)

    # ---- page 3: remarkable
    B.hand_at(B.t); B.clear_canvas()
    S(B, 'r01', gaze='cam', expr='earnest', at=B.hand_t + 0.3, gap=0.4)
    t = B.t; look_screen(B, t - 0.2, t + 4)
    typed(B, 40, 30, '리마커블', size=44, minw=260, t0=t + 0.1, commit=False)
    S(B, 'r02', gaze='screen', expr='neutral', at=B.hand_t + 0.2, gap=0.3)
    S(B, 'r03', gaze='cam', expr='neutral', gap=0.3)
    S(B, 'r04', gaze='cam', expr='earnest', gap=0.2)
    B.hand_at(B.t - 1.8)
    B.type('\n= 말할 가치가 있는 것', prefix='리마커블', t0=B.t - 1.6)
    B.commit_box(); B.sync_hand(0.3)
    S(B, 'r05', gaze='cam', expr='bigsmile', gap=0.5)
    t = B.t; look_screen(B, t - 0.3, t + 6)
    B.hand_at(t); B.pick_tool('pencil')
    B.stroke(densify(loop_pts(860, 130, 190, 72, a0=2.4, seed=33)), speed=360, wob=2.0, jit=0.5)
    line(B, [(760, 190), (720, 250), (800, 196)], speed=260, wob=1.0)
    typed(B, 715, 108, '야 이거 봤어?', size=38, minw=260)
    B.sync_hand(0.4)
    M(B, rng, '야 이거 봤어? ㅋㅋ', at=B.t - 0.6)
    M(B, rng, '오 그렇게 쪼개니까 이해됨', at=B.t + 0.4)
    # the question, typed: what is the opposite?
    t = B.t; look_screen(B, t - 0.2, t + 4)
    typed(B, 40, 250, '반대말은?', size=40, minw=220, t0=t + 0.2, commit=False)
    S(B, 'r06', gaze='cam', expr='sneaky', at=B.hand_t + 0.2, gap=0.6)
    M(B, rng, '평범함?', at=B.t + 0.1); M(B, rng, '지루한 거', at=B.t + 0.9); M(B, rng, '구린 거?', at=B.t + 1.6); M(B, rng, '노잼', at=B.t + 2.4)
    B.t += 2.8
    S(B, 'r07', gaze='chat', expr='smile', gap=0.4)
    t = B.t
    B.think.append((t - 0.2, t + 4.4)); B.scratch.append((t + 0.5, t + 3.2))
    R['think1'] = t
    S(B, 'r08', gaze='think', expr='think', gap=1.4)
    S(B, 'r09', gaze='cam', expr='earnest', gap=0.3)
    B.hand_at(B.t - 1.2)
    B.type('\n= 아주 좋은 것', prefix='반대말은?', t0=B.t - 1.0)
    B.commit_box(); B.sync_hand(0.4)
    M(B, rng, '???', at=B.t - 1.4); M(B, rng, '엥 아주 좋은 게 왜?', at=B.t - 0.6)
    S(B, 'r10', gaze='chat', expr='soft', gap=0.4)
    S(B, 'r11', gaze='cam', expr='neutral', gap=0.4)
    S(B, 'r12', gaze='cam', expr='deadpan', gap=0.4)
    S(B, 'r13', gaze='cam', expr='bigsmile', gap=0.6)
    M(B, rng, 'ㅋㅋㅋ 노래하는 기장', at=B.t - 0.6); M(B, rng, '그건 평생 얘기함', at=B.t + 0.2)
    burst(B, rng, B.t - 0.5, 'laugh', 2, 1.4)
    t = B.t; look_screen(B, t - 0.3, t + 8)
    B.hand_at(t); B.pick_tool('pencil')
    airplane(B, 620, 470)
    B.pick_tool('text'); B.text_box(650, 580, size=32, minw=200); B.type('노래하는 기장님'); B.commit_box()
    B.sync_hand(0.5)
    M(B, rng, '비행기 귀엽', at=B.t - 0.8)
    S(B, 'r14', gaze='cam', expr='earnest', gap=0.4)
    S(B, 'r15', gaze='cam', expr='serious', gap=0.8)
    M(B, rng, '그럼 이상하게만 만들면 됨?', at=B.t - 0.3)
    B.t += 1.5
    S(B, 'r16', gaze='chat', expr='earnest', gap=0.3)
    S(B, 'r17', gaze='cam', expr='serious', gap=0.4)
    S(B, 'r18', gaze='cam', expr='soft', gap=0.6)
    M(B, rng, '명언 나왔다', at=B.t - 0.5); M(B, rng, '비 오면 갈색 ㅋㅋ', at=B.t + 0.3)
    S(B, 'r19', gaze='cam', expr='earnest', gap=0.3)
    S(B, 'r20', gaze='cam', expr='neutral', gap=0.5)
    S(B, 'r25', gaze='cam', expr='soft', gap=0.3)
    S(B, 'r26', gaze='cam', expr='neutral', gap=0.4)
    S(B, 'r27', gaze='away', expr='serious', gap=0.4)
    S(B, 'r28', gaze='cam', expr='smile', gap=0.8)
    M(B, rng, '우리 동네 줄 서는 빵집 있음', at=B.t - 0.4)
    B.t += 1.3
    S(B, 'r29', gaze='chat', expr='surprise', gap=0.4)
    S(B, 'r30', gaze='cam', expr='earnest', gap=0.3)
    S(B, 'r31', gaze='cam', expr='neutral', gap=0.3)
    S(B, 'r32', gaze='cam', expr='smile', gap=1.2)
    # the first donation (no name)
    ta = B.alert('', '1,000치즈', '첫방 축하드려요! 구독 눌렀어요', em='🎉')
    R['don1'] = ta
    B.gaze.append((ta, ta + 3.8, 'alert', 'main')); B.expr.append((ta + 0.2, ta + 3.6, 'surprise', 'main'))
    S(B, 'r21', gaze='alert', expr='surprise', at=ta + 4.1, gap=0.3)   # after the machine voice has read the message
    S(B, 'r22', gaze='cam', expr='embarrassed', gap=0.3)
    S(B, 'r23', gaze='cam', expr='laugh', gap=0.4)
    S(B, 'r24', gaze='cam', expr='bigsmile', gap=0.8)
    burst(B, rng, ta + 0.6, 'don1', 4, 3.5)
    M(B, rng, 'ㅋㅋㅋ 바로 써먹음', at=B.t - 0.4)

    # ---- page 4: the TV formula, sliced bread, the P's
    B.hand_at(B.t); B.clear_canvas()
    S(B, 't01', gaze='cam', expr='neutral', at=B.hand_t + 0.3, gap=0.3)
    S(B, 't02', gaze='cam', expr='earnest', gap=0.4)
    S(B, 't03', gaze='cam', expr='soft', gap=0.3)
    t = B.t; look_screen(B, t - 0.2, t + 30)
    typed(B, 50, 50, '무난한 물건', size=36, minw=230, t0=t + 0.1)
    S(B, 't04', gaze='screen', expr='neutral', at=B.hand_t, gap=0.2)
    B.hand_at(B.t); B.pick_tool('pencil')
    arrow(B, (290, 78), (650, 78))
    typed(B, 690, 50, 'TV 광고', size=36, minw=200)
    S(B, 't05', gaze='screen', expr='neutral', at=B.hand_t, gap=0.2)
    B.hand_at(B.t); B.pick_tool('pencil')
    arrow(B, (770, 120), (770, 300))
    typed(B, 720, 320, '팔림', size=36, minw=140)
    S(B, 't06', gaze='cam', expr='sneaky', at=B.hand_t, gap=0.2)
    B.hand_at(B.t); B.pick_tool('pencil')
    arrow(B, (690, 350), (300, 350))
    typed(B, 60, 322, '광고 더!', size=36, minw=180)
    B.pick_tool('pencil')
    arrow(B, (120, 312), (120, 120))
    B.sync_hand(0.2)
    S(B, 't07', gaze='cam', expr='neutral', gap=0.5)
    M(B, rng, '그 시절 ㄹㅇ', at=B.t - 0.3)
    S(B, 't08', gaze='cam', expr='soft', gap=0.5)
    M(B, rng, 'TV에 나온 맛집 ㅋㅋ', at=B.t - 0.2)
    S(B, 't27', gaze='cam', expr='neutral', gap=0.4)
    S(B, 't09', gaze='cam', expr='deadpan', gap=0.4)
    t = B.t; look_screen(B, t - 0.3, t + 4)
    B.hand_at(t); B.pick_color('red')
    xmark(B, 770, 72, 90)
    B.pick_color('black'); B.sync_hand(0.3)
    S(B, 't10', gaze='cam', expr='neutral', gap=0.3)
    S(B, 't11', gaze='cam', expr='soft', gap=0.6)
    M(B, rng, '광고 스킵 ㄹㅇ', at=B.t - 0.4); M(B, rng, '유튜브 프리미엄 씀 ㅋㅋ', at=B.t + 0.3)
    B.t += 0.8
    S(B, 't12', gaze='chat', expr='laugh', gap=0.5)
    S(B, 't28', gaze='cam', expr='neutral', gap=0.3)
    S(B, 't29', gaze='cam', expr='earnest', gap=0.7)
    # sliced bread (her time sense slips at t15; she does not notice)
    S(B, 't13', gaze='cam', expr='smile', gap=0.4)
    t = B.t; look_screen(B, t - 0.3, t + 11)
    B.hand_at(t); B.pick_tool('pencil')
    loaf(B, rng, 70, 470)
    typed(B, 300, 520, '식빵 기계 1912', size=34, minw=240)
    B.sync_hand(0.3)
    M(B, rng, '식빵 ㅋㅋㅋ', at=B.t - 0.8)
    R['bread'] = B.t
    S(B, 't14', gaze='cam', expr='neutral', gap=0.4)
    S(B, 't15', gaze='away', expr='neutral', gap=0.3)
    M(B, rng, '??? 백 년 넘었는데요', at=B.t + 0.4); M(B, rng, '시간 감각 뭐야 ㅋㅋ', at=B.t + 1.6)   # unanswered
    S(B, 't16', gaze='cam', expr='neutral', gap=0.3)
    S(B, 't17', gaze='cam', expr='smile', gap=0.4)
    S(B, 't18', gaze='cam', expr='deadpan', gap=0.4)
    S(B, 't19', gaze='cam', expr='earnest', gap=0.6)
    S(B, 't20', gaze='cam', expr='exasp', gap=0.3)
    t = B.t; look_screen(B, t - 0.2, t + 9)
    B.hand_at(t)
    B.text_box(600, 440, size=30, minw=400)
    B.type('제품 가격 판촉 포지셔닝', t0=t + 0.2)
    S(B, 't21', gaze='screen', expr='deadpan', at=B.hand_t - 1.5, gap=0.2)
    B.type('\n홍보 포장 입소문 허락', prefix='제품 가격 판촉 포지셔닝')
    B.sync_hand(0.4)
    M(B, rng, '외우다 죽을 뻔', at=B.t - 0.9); M(B, rng, '4P만 배웠는데', at=B.t - 0.2)
    S(B, 't22', gaze='chat', expr='sneaky', gap=0.3)
    B.hand_at(B.t - 0.4)
    B.type('\n+ 보랏빛 소', prefix='제품 가격 판촉 포지셔닝\n홍보 포장 입소문 허락')
    B.commit_box(); B.sync_hand(0.2)
    S(B, 't23', gaze='cam', expr='bigsmile', gap=0.4)
    M(B, rng, 'ㅋㅋㅋ P 하나 추가', at=B.t - 0.3)
    S(B, 't24', gaze='cam', expr='serious', gap=0.5)
    S(B, 't30', gaze='cam', expr='neutral', gap=0.3)
    S(B, 't31', gaze='cam', expr='earnest', gap=0.5)
    S(B, 't25', gaze='cam', expr='smile', gap=0.3)
    S(B, 't26', gaze='cam', expr='soft', gap=0.6)
    M(B, rng, '뉴비틀 귀엽긴 함', at=B.t - 0.4)
    M(B, rng, '마케팅팀인데 뼈 맞는 중', at=B.t + 0.6)
    M(B, rng, '원서로 읽는 게 나아요?', at=B.t + 1.6)
    B.t += 2.8
    S(B, 't32', gaze='chat', expr='soft', gap=0.3)
    S(B, 't33', gaze='cam', expr='neutral', gap=1.6)

    # ---- the parcel: the doorbell, 120 s away; her sister drops in for a little while
    t_bell = B.t
    B.sfx.append((t_bell, 'bell', None))
    B.expr.append((t_bell + 0.3, t_bell + 1.8, 'startled', 'main'))
    S(B, 'p01', gaze='away', expr='surprise', at=t_bell + 1.1, gap=0.2)
    M(B, rng, '띵동 ㅋㅋㅋ', at=B.t - 0.3)
    S(B, 'p02', gaze='cam', expr='hurried', gap=0.25)
    M(B, rng, 'ㄷㄱ', at=B.t - 0.2); M(B, rng, '다녀오세요~', at=B.t + 0.5)
    t_hot = B.t
    B.sfx.append((t_hot, 'key', None)); B.sfx.append((t_hot + 0.09, 'key', None))     # her BRB hotkey
    B.brb = (t_hot + 0.15, None)
    t_out = t_hot + 0.5
    B.sfx.append((t_out - 0.1, 'chair', None))
    B.move(980, 1040, t0=t_out + 0.05, dur=0.3)                                         # the mouse gets bumped
    B.sfx.append((t_out + 1.3, 'steps', [5, 0.52, 0.12, False]))
    B.sfx.append((t_out + 6.0, 'door', None))
    AWAY = 120.0
    t_in = t_out + AWAY
    for dt_, m_ in [(2.2, '택배 ㄷㄷ'), (4.8, '2분 잰다'), (8.5, '뭐 시키셨지'), (12.0, '책일 듯'), (19.0, '브금 좋다'), (26.5, '기다리는 중'),
                    (33.0, '첫방에 택배 ㅋㅋㅋ'), (41.0, '그림판 TV 광고 X 친 거 웃김'), (48.5, '00:48'), (55.0, '물 마시러 감')]:
        M(B, rng, m_, at=t_out + dt_)
    # the sister: peeks in about a minute later, whispers, leaves a note, runs when the door lock beeps
    sis_est = sum(B.dur(l) for l in ('y01', 'y02', 'y03', 'y04', 'y05', 'y06', 'y07', 'y08')) + 21.0   # her lines + pauses + the note
    t_sin = t_out + AWAY - 4.0 - sis_est                                                             # she is gone ~4 s before the door
    B.gaze.append((t_sin, t_sin + 3.4, 'look', 'sis'))
    B.t = t_sin + 3.2
    B.sis_keys = []
    e1, _ = S(B, 'y01', gaze='look', expr='sneaky', gap=0.5)
    B.sis_keys += [(e1 + 0.15, 188, -0.36), (e1 + 0.9, 168, -0.32)]
    S(B, 'y02', gaze='cam', expr='startled', gap=0.5)
    e3s, e3 = S(B, 'y03', gaze='cam', expr='shh', gap=0.5)
    M(B, rng, '소리 끊겨요', at=e3 + 0.1)
    B.gaze.append((e3 + 0.1, e3 + 1.3, 'door', 'sis'))
    B.sis_keys += [(e3 + 0.05, 162, -0.31), (e3 + 0.45, 212, -0.43), (e3 + 1.2, 206, -0.42), (e3 + 1.7, 152, -0.29)]
    B.gaze.append((e3 + 1.5, e3 + 2.7, 'chat', 'sis'))
    B.t = e3 + 2.6
    e4, _ = S(B, 'y04', gaze='cam', expr='sneaky', gap=0.4)
    B.sis_keys += [(e4 - 0.3, 150, -0.29), (e4 + 0.8, 138, -0.25)]
    S(B, 'y05', gaze='cam', expr='sneaky', gap=0.7)
    M(B, rng, '몇 살이에요?', at=B.t - 0.4)
    B.gaze.append((B.t - 0.1, B.t + 1.0, 'chat', 'sis'))
    B.t += 0.9
    S(B, 'y06', gaze='cam', expr='neutral', gap=0.6)
    M(B, rng, '…올해도요?', at=B.t + 0.2)
    t7s, t7e = S(B, 'y07', gaze='cam', expr='sneaky', gap=0.6)
    B.expr.append((t7e + 0.05, t7e + 0.85, 'wink', 'sis'))
    B.tool = 'pencil'
    B.hand_at(B.t)
    B.text_box(330, 190, size=36, minw=300)
    B.type('소 다리 다섯 개였음 ㅋ', who='sis', cps=1.2, typo=0.0)
    B.commit_box()
    B.sync_hand(0.3)
    t_lock = B.t
    B.sfx.append((t_lock, 'doorlock', None))
    S(B, 'y08', gaze='door', expr='startled', at=t_lock + 1.6, gap=0.0)
    t_sout = B.t + 0.05
    B.sfx.append((t_sout - 0.15, 'steps', [3, 0.2, 0.16, True]))
    B.sis_win.append((t_sin, t_sout))
    R['sis_in'], R['sis_out'] = t_sin, t_sout
    t_in = max(t_in, t_sout + 3.0)
    B.sfx.append((t_in - 1.8, 'door', None)); B.sfx.append((t_in + 2.3, 'chair', None))
    B.sfx.append((t_in - 0.9, 'steps', [5, 0.5, 0.11, False]))
    B.afk = (t_out, t_in)
    B.sfx.append((t_in + 3.1, 'key', None)); B.sfx.append((t_in + 3.19, 'key', None))   # banner off once she is sitting
    B.brb = (B.brb[0], t_in + 3.2)
    burst(B, rng, t_sin + 1.0, 'sis_in', 6, 3.5)
    tt_ = t_sin + 6.5
    for m_ in rng.permutation(BURST['sis_mid']).tolist():
        if tt_ > t_sout - 7.5: break
        M(B, rng, m_, at=tt_); tt_ += rng.uniform(2.0, 4.0)
    burst(B, rng, t_sout - 6.5, 'doodle', 5, 3.5)
    burst(B, rng, t_in + 0.2, 'back', 6, 3.2)
    B.t = t_in + 3.7
    S(B, 'p03', gaze='chat', expr='breathless', gap=0.5)
    M(B, rng, '2분 10초 ㅋㅋ', at=B.t - 0.4)
    S(B, 'p04', gaze='chat', expr='smile', gap=0.3)
    S(B, 'p05', gaze='cam', expr='sneaky', gap=0.7)
    M(B, rng, '총균쇠?', at=B.t - 0.5); M(B, rng, '사피엔스 ㄱㄱ', at=B.t + 0.3); M(B, rng, '코스모스?', at=B.t + 1.0)   # unanswered
    # she looks back at Paint and only then sees the note
    t_look = B.t + 0.6
    look_screen(B, t_look, t_look + 2.8)
    B.hand_at(t_look + 0.3)
    B.move(CV['x'] + 560, CV['y'] + 420, t0=t_look + 0.4)
    B.t = t_look + 2.3
    B.expr.append((t_look + 1.5, t_look + 2.7, 'notice', 'main'))
    R['notice'] = t_look + 1.6
    S(B, 'p06', gaze='screen', expr='suspicious', gap=0.3)
    t07, _ = S(B, 'p07', gaze='screen', expr='suspicious', gap=0.4)
    B.move(CV['x'] + 480, CV['y'] + 212, t0=t07 + 0.1)
    B.move(CV['x'] + 560, CV['y'] + 200, t0=B.hand_t + 0.15, dur=0.35)
    M(B, rng, '동생이 썼어요 ㅋㅋㅋ', at=B.t - 0.2); M(B, rng, '동생 등장함', at=B.t + 0.4)
    B.t += 0.9
    S(B, 'p08', gaze='chat', expr='exasp', gap=0.4)
    S(B, 'p09', gaze='cam', expr='pout', gap=0.6)
    M(B, rng, '꼬리가 밑에 달림?', at=B.t - 0.3); M(B, rng, '캡처 있음 ㅋㅋ', at=B.t + 0.6)          # unanswered
    burst(B, rng, B.t - 1.0, 'laugh', 2, 1.6)
    t = B.t
    B.hand_at(t - 0.2)
    B.drag_select(320, 182, 720, 248)
    B.hand_t += 0.8
    B.key('delete')
    B.ops.append((B.hand_t - 0.1, {'op': 'erase', 'x': 320, 'y': 182, 'w': 400, 'h': 66}))
    B.ops.append((B.hand_t - 0.1, {'op': 'sel', 'x': 0, 'y': 0, 'w': 0, 'h': 0}))
    B.t = B.hand_t + 0.4
    S(B, 'p10', gaze='cam', expr='smile', gap=0.4)
    S(B, 'p13', gaze='cam', expr='breathless', gap=0.5)
    S(B, 'p11', gaze='screen', expr='neutral', gap=0.3)
    S(B, 'p12', gaze='cam', expr='earnest', gap=0.6)

    # ---- page 5: who listens — the curve, sneezers, otaku
    B.hand_at(B.t); B.clear_canvas()
    S(B, 'i01', gaze='cam', expr='earnest', at=B.hand_t + 0.3, gap=0.3)
    S(B, 'i02', gaze='cam', expr='neutral', gap=0.3)
    t = B.t; look_screen(B, t - 0.3, t + 14)
    B.hand_at(t); B.pick_tool('pencil')
    R['curve0'] = B.hand_t
    bell_curve(B, 70, 990, 520, 230)
    typed(B, 30, 560, '새것 좋아함', size=30, minw=170)
    typed(B, 440, 560, '대다수', size=30, minw=110)
    typed(B, 800, 560, '끝까지 안 바꿈', size=30, minw=200)
    B.sync_hand(0.3)
    S(B, 'i03', gaze='screen', expr='neutral', gap=0.3)
    S(B, 'i04', gaze='cam', expr='neutral', gap=0.3)
    S(B, 'i05', gaze='cam', expr='soft', gap=0.6)
    M(B, rng, '저 폴더폰 씀', at=B.t - 0.4); M(B, rng, '우리 아빠 ㅋㅋ', at=B.t + 0.4)
    t = B.t; look_screen(B, t - 0.2, t + 4)
    typed(B, 360, 40, '누구한테 팔까?', size=38, minw=280, t0=t + 0.1)
    B.sync_hand(0.2)
    S(B, 'i06', gaze='cam', expr='sneaky', gap=0.5)
    M(B, rng, '가운데요', at=B.t + 0.2); M(B, rng, '대다수', at=B.t + 1.0); M(B, rng, '사람 제일 많은 데', at=B.t + 1.7)
    t = B.t + 0.6
    B.think.append((t - 0.2, t + 3.6)); B.scratch.append((t + 0.4, t + 2.8))
    R['think2'] = t
    B.t = t + 3.4
    S(B, 'i07', gaze='chat', expr='smile', gap=0.3)
    S(B, 'i08', gaze='cam', expr='earnest', gap=0.3)
    S(B, 'i09', gaze='cam', expr='deadpan', gap=0.4)
    t = B.t; look_screen(B, t - 0.2, t + 5)
    B.hand_at(t); B.pick_tool('pencil'); B.pick_color('red')
    arrow(B, (230, 330), (130, 450))
    B.pick_color('black')
    typed(B, 200, 270, '여기!', size=38, minw=120)
    B.sync_hand(0.2)
    S(B, 'i10', gaze='cam', expr='earnest', gap=0.7)
    M(B, rng, '근데 왼쪽 사람들 너무 적잖아요', at=B.t - 0.3)
    B.t += 1.4
    S(B, 'i11', gaze='chat', expr='soft', gap=0.3)
    S(B, 'i12', gaze='cam', expr='earnest', gap=0.4)
    S(B, 'i31', gaze='cam', expr='neutral', gap=0.3)
    S(B, 'i32', gaze='cam', expr='soft', gap=0.5)
    t = B.t; look_screen(B, t - 0.3, t + 9)
    B.hand_at(t); B.pick_tool('pencil')
    B.stickman(930, 236, s=34, pose='stand', speed=330)
    for a_, b_ in [((955, 182), (1000, 160)), ((958, 192), (1010, 192)), ((955, 202), (998, 222))]:
        line(B, [a_, b_], speed=240, wob=0.6)
    typed(B, 800, 100, '에취!', size=36, minw=110)
    B.pick_tool('pencil')
    B.stickman(1010, 330, s=22, pose='stand', speed=360)
    B.stickman(1066, 336, s=22, pose='stand', speed=380)
    B.sync_hand(0.3)
    S(B, 'i13', gaze='cam', expr='smile', gap=0.3)
    S(B, 'i14', gaze='cam', expr='bigsmile', gap=0.6)
    M(B, rng, '재채기 ㅋㅋㅋ', at=B.t - 0.6); M(B, rng, '나 재채기꾼임', at=B.t + 0.2)
    S(B, 'i15', gaze='chat', expr='laugh', gap=0.5)
    S(B, 'i16', gaze='cam', expr='serious', gap=0.4)
    S(B, 'i17', gaze='cam', expr='soft', gap=0.4)
    S(B, 'i33', gaze='cam', expr='smile', gap=0.4)
    S(B, 'i26', gaze='cam', expr='neutral', gap=0.3)
    S(B, 'i27', gaze='cam', expr='soft', gap=0.3)
    S(B, 'i28', gaze='cam', expr='earnest', gap=0.6)
    t = B.t; look_screen(B, t - 0.2, t + 7)
    typed(B, 40, 120, '오타쿠', size=36, minw=120, t0=t + 0.1, commit=False)
    S(B, 'i18', gaze='screen', expr='surprise', at=B.hand_t + 0.1, gap=0.5)
    M(B, rng, '오타쿠가 책에 나옴?', at=B.t - 0.4); M(B, rng, '일본어 ㅋㅋ', at=B.t + 0.3)
    B.t += 0.8
    B.hand_at(B.t)
    B.type(': 취미 < ? < 집착', prefix='오타쿠')
    B.commit_box()
    S(B, 'i19', gaze='screen', expr='neutral', at=B.hand_t - 1.4, gap=0.3)
    B.sync_hand(0.2)
    S(B, 'i20', gaze='cam', expr='soft', gap=0.3)
    S(B, 'i21', gaze='cam', expr='earnest', gap=0.4)
    S(B, 'i34', gaze='cam', expr='soft', gap=0.4)
    S(B, 'i29', gaze='cam', expr='surprise', gap=0.3)
    S(B, 'i30', gaze='cam', expr='smile', gap=1.0)
    # the second donation
    ta = B.alert('', '2,000치즈', '저 키보드 여섯 개 있음… 오타쿠 맞죠?', em='⌨️')
    R['don2'] = ta
    B.gaze.append((ta, ta + 3.8, 'alert', 'main')); B.expr.append((ta + 0.2, ta + 3.6, 'surprise', 'main'))
    B.t = ta + 4.8
    S(B, 'i22', gaze='alert', expr='bigsmile', gap=0.3)
    S(B, 'i23', gaze='cam', expr='deadpan', gap=0.4)
    S(B, 'i24', gaze='cam', expr='bigsmile', gap=0.6)
    burst(B, rng, ta + 0.6, 'don2', 4, 3.5)
    M(B, rng, 'ㅋㅋㅋ 정확함', at=B.t - 0.4); M(B, rng, '제 친구 그분한테 추천받음', at=B.t + 0.5)
    B.t += 0.6
    S(B, 'i25', gaze='chat', expr='laugh', gap=0.9)

    # ---- page 6: real purple cows
    B.hand_at(B.t); B.clear_canvas()
    S(B, 'x01', gaze='cam', expr='soft', at=B.hand_t + 0.3, gap=0.4)
    t = B.t; look_screen(B, t - 0.2, t + 3)
    typed(B, 40, 30, '1. 페인트 통', size=34, minw=220, t0=t + 0.1)
    S(B, 'x02', gaze='screen', expr='neutral', at=B.hand_t, gap=0.3)
    S(B, 'x03', gaze='cam', expr='earnest', gap=0.4)
    t = B.t; look_screen(B, t - 0.3, t + 7)
    B.hand_at(t); B.pick_tool('pencil')
    jug(B, 60, 100)
    B.sync_hand(0.2)
    S(B, 'x04', gaze='cam', expr='neutral', gap=0.3)
    S(B, 'x05', gaze='cam', expr='surprise', gap=0.3)
    S(B, 'x06', gaze='cam', expr='earnest', gap=0.6)
    M(B, rng, '페인트통 ㅋㅋ 혁신', at=B.t - 0.5); M(B, rng, '그림 우유통 같음', at=B.t + 0.2)
    B.t += 0.9
    S(B, 'x07', gaze='chat', expr='pout', gap=0.6)
    burst(B, rng, B.t - 0.6, 'laugh', 2, 1.4)
    t = B.t; look_screen(B, t - 0.2, t + 4)
    typed(B, 380, 30, '2. 에어론 의자 = 미술관', size=34, minw=360, t0=t + 0.1)
    S(B, 'x08', gaze='screen', expr='neutral', at=B.hand_t - 1.0, gap=0.3)
    B.sync_hand(0.1)
    t = B.t; look_screen(B, t - 0.3, t + 6)
    B.hand_at(t); B.pick_tool('pencil')
    chair(B, 420, 176)
    B.sync_hand(0.3)
    S(B, 'x09', gaze='cam', expr='neutral', gap=0.3)
    S(B, 'x10', gaze='cam', expr='smile', gap=0.3)
    S(B, 'x11', gaze='cam', expr='laugh', gap=0.6)
    M(B, rng, '그 의자 겁나 비쌈', at=B.t - 0.4); M(B, rng, '회사 사장실에 있음', at=B.t + 0.4)
    B.t += 0.6
    S(B, 'x12', gaze='chat', expr='deadpan', gap=0.6)
    t = B.t; look_screen(B, t - 0.2, t + 3)
    typed(B, 380, 110, '3. 엘리베이터', size=34, minw=230, t0=t + 0.1)
    S(B, 'x13', gaze='screen', expr='neutral', at=B.hand_t, gap=0.3)
    S(B, 'x14', gaze='chat', expr='smile', gap=0.7)
    M(B, rng, '아 그거 회사에 있음', at=B.t - 0.4); M(B, rng, '처음에 안에 버튼 없어서 당황함', at=B.t + 0.4)
    B.t += 0.6
    t = B.t; look_screen(B, t - 0.3, t + 6)
    B.hand_at(t); B.pick_tool('pencil')
    lift(B, 770, 170)
    B.sync_hand(0.3)
    S(B, 'x15', gaze='cam', expr='neutral', gap=0.3)
    S(B, 'x16', gaze='cam', expr='earnest', gap=0.8)
    S(B, 'x33', gaze='cam', expr='smile', gap=0.3)
    S(B, 'x34', gaze='cam', expr='sneaky', gap=0.4)
    S(B, 'x35', gaze='away', expr='neutral', gap=0.3)
    S(B, 'x36', gaze='cam', expr='smile', gap=0.8)
    M(B, rng, '크리스피 신촌 줄 기억남', at=B.t - 0.6)
    S(B, 'x30', gaze='cam', expr='bigsmile', gap=0.3)
    S(B, 'x31', gaze='cam', expr='soft', gap=0.5)
    M(B, rng, '단테 ㅋㅋ', at=B.t - 0.4); M(B, rng, '가보고 싶다', at=B.t + 0.4)
    S(B, 'x21', gaze='cam', expr='sneaky', gap=0.3)
    S(B, 'x22', gaze='cam', expr='smile', gap=0.4)
    S(B, 'x32', gaze='cam', expr='earnest', gap=1.0)
    # 'why purple?' — the Tyrian purple slip, said plainly; nobody gets an answer
    M(B, rng, '근데 왜 하필 보라색이에요?', at=B.t - 0.4)
    B.t += 1.4
    R['purple_dye'] = B.t
    S(B, 'x17', gaze='chat', expr='soft', gap=0.3)
    S(B, 'x18', gaze='away', expr='neutral', gap=0.3)
    S(B, 'x19', gaze='away', expr='exasp', gap=0.6)
    M(B, rng, '냄새를 어떻게 앎 ㅋㅋㅋ', at=B.t - 0.3); M(B, rng, '고둥 ㄷㄷ', at=B.t + 0.6)
    S(B, 'x20', gaze='cam', expr='soft', gap=0.8)
    # safe is risky, and the committee's camel
    S(B, 'x23', gaze='cam', expr='soft', gap=0.4)
    t = B.t; look_screen(B, t - 0.2, t + 6)
    typed(B, 40, 360, '안전한 게 제일 위험하다', size=42, minw=480, t0=t + 0.1)
    S(B, 'x24', gaze='cam', expr='serious', at=B.hand_t + 0.2, gap=0.4)
    S(B, 'x25', gaze='cam', expr='neutral', gap=0.4)
    S(B, 'x26', gaze='cam', expr='sneaky', gap=0.3)
    S(B, 'x27', gaze='cam', expr='deadpan', gap=0.4)
    t = B.t; look_screen(B, t - 0.3, t + 8)
    B.hand_at(t); B.pick_tool('pencil')
    R['camel0'] = B.hand_t
    camel(B, rng, 640, 470)
    B.sync_hand(0.4)
    M(B, rng, 'ㅋㅋㅋㅋ 낙타', at=B.t - 1.2); M(B, rng, '회의 ㄹㅇ', at=B.t - 0.5); M(B, rng, '그림 낙타 맞음?', at=B.t + 0.3)
    B.t += 0.9
    S(B, 'x28', gaze='chat', expr='pout', gap=0.4)
    burst(B, rng, B.t - 0.8, 'laugh', 2, 1.4)
    S(B, 'x29', gaze='cam', expr='serious', gap=0.5)
    S(B, 'x37', gaze='chat', expr='sneaky', gap=1.0)

    # ---- page 7: go to the edges; the third donation; closing
    B.hand_at(B.t); B.clear_canvas()
    S(B, 'g01', gaze='cam', expr='earnest', at=B.hand_t + 0.3, gap=0.3)
    t = B.t; look_screen(B, t - 0.2, t + 4)
    typed(B, 40, 30, '가장자리로 가라', size=42, minw=330, t0=t + 0.1)
    S(B, 'g02', gaze='cam', expr='earnest', at=B.hand_t - 1.6, gap=0.3)
    B.sync_hand(0.2)
    t = B.t; look_screen(B, t - 0.2, t + 8)
    B.hand_at(t)
    B.text_box(40, 110, size=30, minw=560)
    B.type('제일 싼 / 비싼 / 빠른 / 느린', t0=t + 0.1)
    S(B, 'g03', gaze='screen', expr='neutral', at=B.hand_t - 2.4, gap=0.2)
    B.type(' / 쉬운 / 어려운', prefix='제일 싼 / 비싼 / 빠른 / 느린')
    B.commit_box()
    S(B, 'g04', gaze='cam', expr='soft', at=B.hand_t - 0.6, gap=0.4)
    B.sync_hand(0.2)
    t = B.t; look_screen(B, t - 0.3, t + 8)
    B.hand_at(t); B.pick_tool('pencil')
    line(B, [(60, 300), (1040, 302)], speed=440, wob=1.8)
    for k in range(9):
        cx = 470 + k * 18 + rng.uniform(-4, 4)
        line(B, [(cx, 284 + rng.uniform(-4, 4)), (cx + rng.uniform(-3, 3), 318)], speed=380, wob=0.4)
    arrow(B, (430, 260), (110, 260)); arrow(B, (680, 260), (1000, 260))
    typed(B, 488, 216, '꽉 참', size=30, minw=90)
    B.sync_hand(0.3)
    S(B, 'g05', gaze='cam', expr='earnest', gap=0.3)
    S(B, 'g16', gaze='cam', expr='smile', gap=0.3)
    S(B, 'g17', gaze='cam', expr='neutral', gap=0.4)
    S(B, 'g18', gaze='cam', expr='serious', gap=0.3)
    S(B, 'g19', gaze='cam', expr='soft', gap=0.7)
    M(B, rng, '제일 느린 택배 ㅋㅋㅋ', at=B.t - 0.5); M(B, rng, '제일 두꺼운 책만 읽는 방송', at=B.t + 0.5)
    B.t += 1.2
    S(B, 'g06', gaze='chat', expr='surprise', gap=0.3)
    S(B, 'g07', gaze='cam', expr='laugh', gap=1.0)
    ta = B.alert('', '1,000치즈', '다음 책 총균쇠 가능? 진짜 벽돌', em='📚')
    R['don3'] = ta
    B.gaze.append((ta, ta + 3.8, 'alert', 'main')); B.expr.append((ta + 0.2, ta + 3.6, 'surprise', 'main'))
    B.t = ta + 4.8
    S(B, 'g08', gaze='alert', expr='smile', gap=0.3)
    S(B, 'g09', gaze='cam', expr='laugh', gap=0.4)
    S(B, 'g10', gaze='cam', expr='sneaky', gap=0.8)
    burst(B, rng, ta + 0.6, 'don3', 4, 3.5)
    S(B, 'g11', gaze='cam', expr='soft', gap=0.3)
    S(B, 'g12', gaze='cam', expr='serious', gap=0.4)
    S(B, 'g13', gaze='cam', expr='deadpan', gap=0.4)
    S(B, 'g14', gaze='cam', expr='soft', gap=0.4)
    M(B, rng, '와 처음 소 얘기로 돌아옴', at=B.t - 0.4); M(B, rng, '수미상관 ㄷㄷ', at=B.t + 0.4)
    S(B, 'g15', gaze='cam', expr='earnest', gap=0.9)
    # closing: the one line, typed, then the recap
    S(B, 'z01', gaze='cam', expr='soft', gap=0.3)
    t = B.t; look_screen(B, t - 0.2, t + 6)
    typed(B, 40, 400, '아주 좋은 것 = 안 보이는 것', size=40, minw=520, t0=t + 0.1)
    S(B, 'z02', gaze='cam', expr='serious', at=B.hand_t - 1.0, gap=0.4)
    B.sync_hand(0.2)
    S(B, 'z03', gaze='cam', expr='soft', gap=0.4)
    t = B.t; look_screen(B, t - 0.2, t + 4)
    typed(B, 40, 480, '당신의 보랏빛 소는?', size=40, minw=380, t0=t + 0.1)
    B.pick_tool('pencil'); B.pick_color('purple')
    cow(B, rng, 530, 470, s=0.8, speed=360)
    B.pick_color('black')
    B.sync_hand(0.4)
    M(B, rng, '보라 소 다시 등장 ㅋㅋ', at=B.t - 0.8)
    R['last_type'] = B.t
    S(B, 'z04', gaze='cam', expr='soft', gap=0.7)
    M(B, rng, '숙제 받음', at=B.t - 0.4); M(B, rng, '생각해볼게요', at=B.t + 0.4)
    S(B, 'z09', gaze='cam', expr='neutral', gap=0.4)
    S(B, 'z10', gaze='cam', expr='soft', gap=0.4)
    S(B, 'z11', gaze='cam', expr='earnest', gap=0.4)
    S(B, 'z12', gaze='cam', expr='soft', gap=0.4)
    S(B, 'z13', gaze='cam', expr='smile', gap=0.7)
    S(B, 'z14', gaze='cam', expr='soft', gap=0.4)
    S(B, 'z15', gaze='chat', expr='smile', gap=0.6)
    S(B, 'z16', gaze='cam', expr='embarrassed', gap=0.4)
    S(B, 'z17', gaze='cam', expr='embarrassed', gap=0.3)
    S(B, 'z18', gaze='away', expr='embarrassed', gap=0.8)
    S(B, 'z05', gaze='cam', expr='soft', gap=0.4)
    S(B, 'z06', gaze='cam', expr='embarrassed', gap=0.4)
    S(B, 'z07', gaze='cam', expr='sneaky', gap=0.5)
    S(B, 'z08', gaze='cam', expr='soft', gap=0.4)
    B.gaze.append((B.t, B.t + 5.0, 'chat', 'main')); B.expr.append((B.t, B.t + 5.0, 'soft', 'main'))
    B.t += 5.0
    R['end'] = B.t
    burst(B, rng, B.t - 8.0, 'end', 8, 7.0)
    for lt, w, st in list(B.laughs):
        if w == 'main': burst(B, rng, lt + 0.3, 'laugh', 2, 1.6)
    fill_chat(B, rng, B.t + 2.0, [(t_sin - 1.0, t_sout + 1.5), (ta, ta + 6.0)])
    B.review_marks = R


MAIN_BOX, WIDE = [1380, 470, 1880, 1080], [1250, 380, 1920, 1080]
REVIEW = {
    'keys': [['오프닝: 첫 인사', ['line', 'o03', .5]], ['채널 이름 타이핑 후 소개', ['line', 'o07', .4]], ['책 제목 타이핑', ['line', 'b01', .5]],
             ['우유팩 그림', ['line', 'b09', .2]], ['소 그리기(갈색)', ['line', 'c04', .5]], ['보라색 소', ['line', 'c11', .5]],
             ['오록스 이야기(그림 보며)', ['line', 'c14', .5]], ['반대말 질문 → 생각+머리 긁기', ['line', 'r08', .5]], ['첫 후원 알림', ['line', 'r21', .2]],
             ['TV 광고 공식 순환도 + X', ['line', 't10', .5]], ['식빵 그림', ['line', 't14', .5]], ['초인종 → 택배 받으러 일어남', ['line', 'p02', .9]],
             ['자리비움: 빈자리 + 택배 배너', ['afk', 0, 30.0]], ['동생이 빼꼼', ['extra', 0, 1.6]], ['동생 속삭임', ['line', 'y04', .5]],
             ['동생이 그림판에 타이핑', ['line', 'y08', 0, -2.5]], ['복귀: 걸어 들어옴', ['afk', 1, 0.9]], ['낙서 발견', ['line', 'p07', .5]],
             ['확산 곡선 + 여기!', ['line', 'i10', .5]], ['재채기 졸라맨', ['line', 'i13', .5]], ['두 번째 후원', ['line', 'i22', .3]],
             ['페인트 통', ['line', 'x05', .5]], ['낙타', ['line', 'x28', .5]], ['가장자리 그림', ['line', 'g05', .5]], ['마무리 인사', ['line', 'z08', .5]]],
    'strips': [{'label': '립싱크 연속 8프레임(15fps)', 'at': ['line', 'c14', .3], 'box': [1440, 640, 1800, 960]},
               {'label': '머리 긁기 연속 8프레임 (0.1초 간격)', 'at': ['line', 'r08', .3], 'box': [1400, 560, 1880, 1000], 'step': 0.1},
               {'label': '메인 퇴장 (0.45초 간격 8컷)', 'at': ['afk', 0, -0.1], 'box': WIDE, 'step': 0.45},
               {'label': '메인 복귀 (0.5초 간격 8컷)', 'at': ['afk', 1, 0.2], 'box': WIDE, 'step': 0.5},
               {'label': '동생 등장 (0.4초 간격 8컷)', 'at': ['extra', 0, 0.2], 'box': [1440, 380, 1920, 1080], 'step': 0.4},
               {'label': '동생 퇴장 (0.1초 간격 8컷)', 'at': ['extra', 1, -0.6], 'box': WIDE, 'step': 0.1},
               {'label': '마우스로 소 그리는 연속 8프레임', 'at': ['first_draw'], 'box': [100, 300, 700, 700], 'step': 4 / 30}],
    'gaze': [['그림판 작업 중', ['line', 'c04', .5]], ['채팅 읽는 중', ['line', 'o05', .5]], ['정면', ['line', 'o11', .5]], ['후원 알림', ['line', 'r21', .3]]],
    'gaze_box': MAIN_BOX, 'lip_main': 'c14', 'lip_extra': 'y04',
}
