"""Example for the reading-book content theme: 『아주 작은 습관의 힘』 as a live-stream VOD (~4 min).
Owner rules this script follows: no nicknames anywhere (chat shows messages only, nobody is named, not even the streamer);
natural entrances and exits (she walks off and back, the extra peeks in and scurries off); she never narrates her own
actions (the screen shows them) — she talks about the book and reacts to chat.
Run with --streaming default --streamer kate --content reading-book (the defaults)."""
import json, os, re
from build import densify, humanize, CV
TAIL = 3.2
CLOCK0 = 23 * 3600 + 7 * 60 + 41   # 오후 11:07:41
BRB_SECS = 0   # no countdown: she said five minutes and came back in one
BADGES = {}
STREAM_TITLE = '📖 책 읽는 밤 · 아주 작은 습관의 힘'
WHISPER_HARD_DROP = ['e02']   # the one whisper the noise gate chops (chat: '소리 끊겨요')
LINES = {l['id']: l for l in json.load(open(os.path.join(os.path.dirname(__file__), 'lines.json')))}
U = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't']   # internal ids only, never shown
# chat filler: (message, not before this line id, a reply that follows a second or two later)
FILLER = [('오늘 처음 왔는데 분위기 좋네요', None, None), ('이 책 회사에서 독서모임으로 읽었는데 결국 아무도 안 읽음 ㅋㅋ', 'n03', 'ㄴ ㅋㅋㅋ 국룰'),
          ('아 나도 운동 3일 하고 접음', 'n08', None), ('그림판 오랜만에 본다', None, None), ('키보드 소리 좋다 무슨 축이에요?', 'n03', 'ㄴ 갈축 같음'),
          ('저 1%씩 해서 지금 영어 단어 하루 3개 외우는중', 'p08', '오 그거 좋네'), ('배고프다', None, None), ('야식 먹을까 말까', None, None),
          ('마우스 그림 왜케 귀엽냐', 'm31', None), ('내일 월요일이네', None, None), ('ㅠㅠ', None, None), ('오늘 몇 장까지 읽어요?', 'n03', None),
          ('자막 있으면 좋겠다', None, None), ('ㄱㄱ', None, None), ('ㅋㅋㅋㅋ', None, None), ('ㅎㅇ', None, None), ('오늘 늦었다', None, None),
          ('저녁 먹고 옴', None, None), ('목소리 오늘 좋다', None, None), ('👍', None, None), ('ㄹㅇ', None, None), ('ㅇㅈ', None, None),
          ('나 이 책 있음 ㅋㅋ', 'n03', None), ('내일 방송 몇 시에요?', None, None), ('와', None, None), ('😂😂', None, None), ('하이요~', None, None),
          ('오 습관 책이다', 'n03', None), ('리스닝 중', None, None), ('👏👏', None, None), ('과제하면서 듣는중', None, None), ('ㅎㅎ', None, None),
          ('매일 1%면 몇 년 걸림?', 'p08', None), ('오늘도 힐링', None, None), ('모자 귀엽', None, None), ('ㄱㅇㄷ', None, None), ('ㅋㅋ', None, None),
          ('ㄷㄷ', 'm15', None), ('오오', None, None), ('아 졸려', None, None), ('오늘 텐션 좋다', None, None), ('물 많이 드세요', 'm20', None),
          ('책 제목 다시요?', 'n03', None), ('오늘 몇 시까지 해요?', None, None), ('공감', None, None), ('굿굿', None, None), ('🔥', None, None),
          ('❤️', None, None), ('🥲', None, None), ('저도 작심삼일임', 'n04', None), ('1%씩 ㄹㅇ 어렵다', 'p08', None), ('나 방금 옴', None, None),
          ('지금 무슨 얘기해요?', None, None), ('퇴근길 듣는 중', None, None), ('헬스 가야 되는데', None, None), ('내일 시험인데 여기 있음', None, None),
          ('작은 습관 ㄹㅇ', 'p08', None), ('방송 소리 좋다', None, None), ('나도 해봐야지', 'p08', None), ('어제 다시보기 봤어요', None, None),
          ('모자 새로 샀어요?', None, None), ('책 추천해주세요', None, None), ('독서방 최고', None, None), ('자기 전에 틀어놓는 방송', None, None),
          ('타자 소리 좋다', 'n03', 'ㄴ ASMR 같음'), ('이거 메모함', 'p08', None), ('공부하러 왔다가 눌러앉음', None, None),
          ('방금 왔는데 무슨 책?', 'n03', 'ㄴ 아주 작은 습관의 힘'),
          ('이 책 읽고 아침에 물 한 잔 마시기 3주째인데 이게 진짜 쌓이긴 하더라고요 신기함', 'n04', None),
          ('그림판 졸라맨 볼 때마다 웃김 ㅋㅋㅋㅋ 머리가 계속 감자임', 'n06', None), ('🔥🔥', None, None), ('🙏', None, None),
          ('근데 1%는 하루하루 티가 하나도 안 나서 다들 포기하는 듯', 'p08', None), ('ㅇㅎ', None, None)]
POOL = []
BURST = {'sis_in': ['????', '누구야 ㅋㅋㅋ', '동생?', 'ㅋㅋㅋㅋㅋㅋ', '?????', '헐', '누구세요 ㅋㅋ', 'ㅋㅋㅋㅋㅋㅋㅋㅋ', 'ㄷㄷ', 'ㅋㅋㅋ뭐야'],
         'sis_mid': ['ㅋㅋㅋ', '안 들려요', '언니한테 이를거임', '스쿼트 한 개 ㅋㅋㅋ', 'ㅋㅋㅋㅋㅋ', '튀어', '동생 자주 와요?', '😂', 'ㄹㅇ', '한 개 ㅋㅋㅋㅋ', '이를게요'],
         'doodle': ['ㅋㅋㅋㅋㅋㅋㅋㅋ', '언니 바보 ㅋㅋㅋ', '박제', 'ㅋㅋㅋㅋ 이거 남겨둬요', '캡처함', '언니바보 ㅋㅋ', '동생 최고'],
         'back': ['오셨다', '왔다!!', '동생 왔다감', '다녀오셨어요', '동생 누구에요', 'ㅋㅋㅋㅋ 그림판 보세요', '언니 바보 ㅋㅋ', '오셨네'],
         'laugh': ['ㅋㅋㅋㅋㅋ', 'ㅋㅋㅋㅋㅋㅋㅋ', '😂', 'ㅋㅋㅋ'],
         'donate': ['오 치즈', '3일 ㄷㄷ', '헬스 화이팅', '👏👏', 'ㅋㅋㅋ 3일']}


def laughs_in(B, lid, t0, d, who, strength=1.0):
    tts = LINES[lid].get('tts') or ''
    for m in re.finditer(r'\[(laughs[^\]]*)\]', tts):
        before = re.sub(r'<[^>]+>|\[[^\]]+\]', '', tts[:m.start()])
        n_before = len(re.sub(r'[^가-힣0-9]', '', before)); n_all = len(re.sub(r'[^가-힣0-9]', '', LINES[lid]['text']))
        B.laughs.append((t0 + d * n_before / max(1, n_all), who, strength * (0.75 if 'softly' in m.group(1) else 1.0)))


def S(B, lid, gap=0.35, gaze=None, expr=None, at=None):
    t0, t1 = B.say(lid, gap=gap, gaze=gaze, expr=expr, at=at)
    laughs_in(B, lid, t0, t1 - t0, 'sis' if lid.startswith(('s', 'e')) or lid == 'n09' else 'main')
    return t0, t1


def M(B, rng, text, dt=0.0, at=None):
    B.msg(U[rng.integers(len(U))], text, dt=dt, at=at)


def fill_chat(B, rng, T, skip):
    said = {lid: t0 for w, lid, t0, d in B.voices}
    used = set(); t = 3.0
    while t < T:
        if not any(a <= t < b for a, b in skip) and not any(abs(t - c[0]) < 0.35 for c in B.chat):
            ok = [k for k, (m_, g_, r_) in enumerate(FILLER) if k not in used and (g_ is None or said.get(g_, 1e9) + 1.5 <= t)]
            if ok:
                k = ok[int(rng.integers(len(ok)))]; used.add(k); m_, g_, r_ = FILLER[k]
                M(B, rng, m_, at=t)
                if r_: M(B, rng, r_, at=t + rng.uniform(1.3, 2.6))
        t += rng.exponential(1.9) + 0.4


def burst(B, rng, t0, kind, n, dur):
    msgs = list(BURST[kind]); rng.shuffle(msgs)
    for k in range(min(n, len(msgs))):
        M(B, rng, msgs[k], at=t0 + rng.uniform(0.6, dur))


def script(B, rng):
    # the stream is already running: pencil picked, the mouse drifts onto the canvas
    B.gaze.append((0.0, 1.8, 'screen', 'main'))
    B.pick_tool('pencil', 0.3)
    B.move(700, 560)
    M(B, rng, 'ㅎㅇㅎㅇ', at=0.2)
    M(B, rng, '소리 작아요?', at=0.9)
    B.t = 1.9
    S(B, 'm01', gaze='cam', expr='neutral')
    M(B, rng, 'ㅇㅇ 잘들림', dt=-0.1)
    M(B, rng, '잘 들려요!', dt=0.4)
    S(B, 'm02', gaze='cam', expr='smile', gap=0.25)
    M(B, rng, '하이~', dt=1.2)
    S(B, 'm03', gaze='cam', expr='bigsmile', gap=0.45)
    S(B, 'n01', gaze='chat', expr='smile', gap=0.5)
    M(B, rng, '오늘 무슨 책?', dt=-1.8)
    M(B, rng, '방에 화분 또 늘었다', dt=-0.4)                      # her lore, only ever implied (streamer theme kate: kate.md)
    # the title: she just types it (no narration), then names the book
    B.hand_at(B.t - 0.2)
    B.gaze.append((B.t - 0.2, B.t + 6.0, 'screen', 'main'))
    B.text_box(36, 26, size=40, minw=420)
    B.type('아주 작은 습관의 힘', t0=B.t + 0.3)
    t3 = B.hand_t - 1.2
    S(B, 'n03', gaze='screen', expr='neutral', at=t3, gap=0.1)
    B.type('\n- 제임스 클리어', prefix='아주 작은 습관의 힘')
    B.commit_box()
    B.sync_hand(0.1)
    M(B, rng, '아 그거 유명한 책', dt=-1.6)
    M(B, rng, '읽다 말았는데 ㅋㅋ', dt=-0.6)
    S(B, 'n04', gaze='chat', expr='smile', gap=0.35)
    S(B, 'p08', gaze='cam', expr='earnest', gap=0.3)
    M(B, rng, '브금 뭐에요?', dt=-2.0)
    # stick figure (the arm comes out too long -> Ctrl+Z -> redraw), then the stairs; she draws in silence
    B.hand_at(B.t - 0.6)
    B.pick_tool('pencil')
    t9 = B.t
    B.gaze.append((t9 - 0.6, t9 + 18, 'screen', 'main'))
    cx, hip, s = 125, 566, 60
    B.stickman_parts(cx, hip, s, parts=('head', 'body'))
    sh = (cx, hip - 1.25 * s + 0.42 * s * 0.95 + 0.28 * 1.25 * s)
    B.stroke(densify([(sh[0] - 0.7 * s, sh[1] + 0.5 * s), sh, (sh[0] + 2.3 * s, sh[1] + 0.25 * s)]), speed=330, wob=4.5, snap=True)
    tm = B.hand_t
    cx0, cy0 = B.cur
    B.move(cx0 - 5, cy0 + 3, t0=tm + 0.35, dur=0.18); B.move(cx0 + 2, cy0 - 1, t0=tm + 1.3, dur=0.2)   # the hand stalls on the bad line
    S(B, 'm31', gaze='screen', expr='pout', at=tm + 0.15, gap=0.1)
    B.undo(at=B.t - 0.4)
    B.stickman_parts(cx, hip, s, parts=('arms', 'legs'))
    t9b = B.hand_t
    # the stairs come in separate drags: a fairly steady first run, a shakier second one that starts a few px off the first,
    # and a short fix-up where a joint did not meet
    stairsA = [(70, 641), (171, 650), (188, 571), (309, 579)]
    stairsB = [(304, 585), (316, 532), (408, 516)]
    stairs2 = [(410, 527), (398, 431), (531, 447), (539, 369), (642, 380)]
    B.stroke(densify(humanize(stairsA, rng, over=(4, 9))), speed=300, t0=t9b + 0.5, wob=1.6, jit=0.35)
    B.stroke(densify(humanize(stairsB, rng, over=(8, 14))), speed=240, wob=5.5, jit=0.6)
    S(B, 'n05', gaze='screen', expr='neutral', at=B.hand_t + 0.2, gap=0.2)
    B.stroke(densify(humanize(stairs2, rng)), speed=260, wob=3.0, jit=0.5, hook=True)
    B.sync_hand(2.3)   # a quiet stretch: she looks at the drawing
    M(B, rng, '졸라맨 머리 찌그러짐 ㅋㅋㅋ', dt=-1.6)
    M(B, rng, '그림 실력 무엇', dt=-0.4)
    S(B, 'n06', gaze='chat', expr='pout', gap=0.25)
    S(B, 'm38', gaze='chat', expr='neutral', gap=0.5)
    # the question, typed
    t12 = B.t
    B.hand_at(t12 - 0.6)
    B.text_box(630, 186, size=38, minw=360)
    B.type('매일 1%씩 1년이면?', t0=t12 + 0.3)
    S(B, 'm34', gaze='screen', expr='smile', at=t12 + 0.9, gap=0.3)
    M(B, rng, '언니는 1년 금방이라며 ㅋㅋ', dt=-0.6)
    B.sync_hand(0.2)
    # thinking: eyes roll, hand to her head, the caret keeps blinking
    t13 = B.t
    B.think.append((t13 - 0.2, t13 + 5.6))
    B.scratch.append((t13 + 0.6, t13 + 3.8))
    S(B, 'm13', gaze='think', expr='think', gap=1.3)
    M(B, rng, '37배요!!', at=B.t - 1.4)
    M(B, rng, '37배', at=B.t - 0.7)
    S(B, 'n07', gaze='chat', expr='bigsmile', gap=0.2)
    B.type('\n= 약 37배 (복리)', prefix='매일 1%씩 1년이면?', t0=B.t - 0.9)
    B.commit_box()
    B.sync_hand(0.2)
    M(B, rng, '근데 37배는 좀 과장 아님?', at=B.t + 0.5)
    M(B, rng, 'ㄴ 복리 계산하면 맞음', at=B.t + 1.7)
    S(B, 'm41', gaze='chat', expr='soft', at=B.t + 2.1, gap=0.4)
    # the other way down
    t15 = B.t
    B.pick_tool('pencil', t15 - 0.2)
    S(B, 'm15', gaze='screen', expr='serious', at=t15 + 0.2, gap=0.2)
    down = [(700, 418), (796, 424), (788, 490), (884, 481), (879, 556), (975, 548), (968, 641), (1066, 636)]
    B.stroke(densify(humanize(down, rng)), speed=320, wob=4.0, jit=0.5)
    B.stickman(1010, 578, s=36, pose='stand', speed=330)
    B.text_box(690, 326, size=36, minw=260)
    B.type('매일 -1%면 0.03배')
    B.commit_box()
    B.sync_hand(0.2)
    S(B, 'm16', gaze='cam', expr='soft', gap=0.7)
    M(B, rng, '복리 무섭네', dt=-1.5)
    # donation (no name anywhere)
    ta = B.alert('', '1,000치즈', '저 헬스 3일째임', em='💪')
    B.gaze.append((ta, ta + 3.8, 'alert', 'main')); B.expr.append((ta + 0.2, ta + 3.8, 'surprise', 'main'))
    S(B, 'n08', gaze='alert', expr='surprise', gap=0.25)
    S(B, 'm18', gaze='cam', expr='bigsmile', gap=0.3)
    S(B, 'm19', gaze='cam', expr='soft', gap=0.6)
    # bathroom
    S(B, 'm20', gaze='away', expr='embarrassed', gap=0.2)
    S(B, 'm21', gaze='cam', expr='hurried', gap=0.3)
    M(B, rng, 'ㄷㄱ', dt=-0.5)
    M(B, rng, '다녀오세요~', dt=0.2)
    t_hot = B.t
    B.sfx.append((t_hot, 'key', None)); B.sfx.append((t_hot + 0.09, 'key', None))   # her BRB hotkey
    B.brb = (t_hot + 0.15, None)
    t_out = t_hot + 0.5                                                                   # she stands up
    B.sfx.append((t_out - 0.1, 'chair', None))
    B.move(980, 1040, t0=t_out + 0.05, dur=0.3)                                           # the mouse gets bumped
    B.sfx.append((t_out + 1.3, 'steps', [5, 0.52, 0.12, False]))
    B.sfx.append((t_out + 6.0, 'door', None))
    M(B, rng, '물 마시는 습관 ㅋㅋㅋ', at=t_out + 2.0)
    M(B, rng, '돌아오면 매머드 얘기 마저 해주세요', at=t_out + 8.9)
    M(B, rng, 'ㄷㄱ', at=t_out + 4.6)
    M(B, rng, '브금 좋다', at=t_out + 7.6)
    M(B, rng, '기다리는중', at=t_out + 10.4)
    tj = t_out + 11.0
    B.t = t_out + 12.5
    # the sister peeks in beside the idle model
    t_sin = B.t
    B.gaze.append((t_sin, t_sin + 3.4, 'look', 'sis'))

    B.t = t_sin + 3.3
    B.sis_keys = []
    e1, _ = S(B, 'e01', gaze='cam', expr='sneaky', gap=0.6)
    B.sis_keys += [(e1 + 0.15, 188, -0.36), (e1 + 0.9, 128, -0.27)]           # once she talks she settles further in
    e2s, e2 = S(B, 'e02', gaze='cam', expr='shh', gap=0.5)
    M(B, rng, '소리 끊겨요', dt=-0.2)
    B.gaze.append((e2 + 0.1, e2 + 1.35, 'door', 'sis'))                      # a look back at the door, half hiding
    B.sis_keys += [(e2 + 0.05, 130, -0.27), (e2 + 0.45, 212, -0.43), (e2 + 1.2, 208, -0.42), (e2 + 1.7, 124, -0.26)]
    B.gaze.append((e2 + 1.55, e2 + 2.75, 'chat', 'sis'))                    # reads '소리 끊겨요' in chat
    B.t = e2 + 2.6
    S(B, 'e03', gaze='cam', expr='sneaky', gap=0.4)
    M(B, rng, '꿀팁 주세요 ㅋㅋ', dt=-0.2)
    S(B, 'e04', gaze='cam', expr='sneaky', gap=0.4)
    e5, _ = S(B, 'e05c', gaze='cam', expr='sneaky', gap=0.45)
    B.sis_keys += [(e5 - 0.3, 124, -0.26), (e5 + 0.8, 110, -0.22), (e5 + 2.9, 120, -0.24)]   # leaning in for the secret
    t6s, t6e = S(B, 'e06', gaze='cam', expr='sneaky', gap=0.6)
    B.expr.append((t6e + 0.05, t6e + 0.85, 'wink', 'sis'))
    # she leaves a note on her sister's Paint
    B.tool = 'pencil'
    B.hand_at(B.t)
    B.text_box(760, 60, size=40, minw=240)
    B.type('언니 바보 ㅋ', who='sis', cps=1.25, typo=0.0)
    B.commit_box()
    B.sync_hand(0.4)
    S(B, 'e07', gaze='look', expr='startled', gap=0.0)
    t_sout = B.t + 0.05
    B.sfx.append((t_sout - 0.15, 'steps', [3, 0.2, 0.16, True]))   # she scurries off
    B.sis_win.append((t_sin, t_sout))
    B.t = t_sout + 2.2
    # she comes back
    t_in = B.t
    B.sfx.append((t_in - 1.8, 'door', None)); B.sfx.append((t_in + B.afk_t['ret_pause_end'] + 0.1, 'chair', None))   # walks in, stops, faces the screen, sits
    B.sfx.append((t_in - 0.9, 'steps', [5, 0.5, 0.11, False]))   # walks in (1.9 s), stops at the seat, sits
    B.afk = (t_out, t_in)
    B.sfx.append((t_in + B.afk_t['ret_sit_end'] + 0.25, 'key', None)); B.sfx.append((t_in + B.afk_t['ret_sit_end'] + 0.34, 'key', None))   # BRB off once she is sitting
    B.brb = (B.brb[0], t_in + B.afk_t['ret_sit_end'] + 0.35)
    B.t = t_in + B.afk_t['ret_end'] - 0.1
    S(B, 'm22', gaze='chat', expr='breathless', gap=0.3)
    S(B, 'm35', gaze='chat', expr='breathless', gap=0.6)
    # back to the book: she looks at the canvas, the hand drifts to the mouse ... and only then she notices the note
    t_look = B.t
    B.gaze.append((t_look, t_look + 2.6, 'screen', 'main'))
    B.hand_at(t_look + 0.4)
    B.move(CV['x'] + 600, CV['y'] + 420, t0=t_look + 0.5)
    B.t = t_look + 2.4
    B.expr.append((t_look + 1.55, t_look + 2.75, 'notice', 'main'))   # eyes stop on it, mouth shuts, brows go
    t23, _ = S(B, 'm23', gaze='screen', expr='suspicious', gap=0.3)
    B.move(CV['x'] + 905, CV['y'] + 118, t0=t23 + 0.1)          # to the note
    B.move(CV['x'] + 960, CV['y'] + 92, t0=B.hand_t + 0.15, dur=0.35)   # a little circle around it
    B.move(CV['x'] + 870, CV['y'] + 100, t0=B.hand_t + 0.05, dur=0.4)
    S(B, 'm24', gaze='cam', expr='exasp', gap=0.25)
    S(B, 'n10', gaze='cam', expr='laugh', gap=0.2)
    B.laughs.append((B.t - 1.0, 'main', 0.8))
    t26 = B.t
    B.hand_at(t26 - 0.3)
    B.drag_select(745, 48, 1030, 125)
    B.hand_t += 1.0
    B.key('delete')
    B.ops.append((B.hand_t - 0.1, {'op': 'erase', 'x': 745, 'y': 48, 'w': 285, 'h': 77}))
    B.ops.append((B.hand_t - 0.1, {'op': 'sel', 'x': 0, 'y': 0, 'w': 0, 'h': 0}))
    B.t = B.hand_t + 0.4
    S(B, 'm42', gaze='cam', expr='soft', gap=0.5)   # compounding -> identity: the bridge
    t36 = B.t
    B.hand_at(t36 - 0.3)
    B.text_box(470, 590, size=36, minw=380)
    B.type('나는 운동하는 사람이다', t0=t36 + 0.6)
    S(B, 'm36', gaze='screen', expr='earnest', at=t36 + 1.4, gap=0.35)
    B.sync_hand(0.2)
    S(B, 'm43', gaze='cam', expr='soft', gap=0.35)
    t37, _ = S(B, 'm37', gaze='cam', expr='soft', gap=0.4)
    M(B, rng, '오 이거 좋다', at=t37 - 0.8)
    M(B, rng, '나는 책 읽는 사람이다', at=t37 + 3.6)
    M(B, rng, '근데 자매 나이 차이 몇 살임?', at=t37 + 2.2); M(B, rng, 'ㄴ 그건 묻는 거 아님 ㅋㅋ', at=t37 + 3.2)
    # chat flow: bursts after events, quiet baseline
    burst(B, rng, t_sin + 1.2, 'sis_in', 6, 3.5)
    burst(B, rng, t_sout - 4.0, 'doodle', 6, 3.0)
    tt_ = t_sin + 6.0
    for m_ in rng.permutation(BURST['sis_mid']).tolist():
        if tt_ > t_sout - 4.5: break
        M(B, rng, m_, at=tt_); tt_ += rng.uniform(1.6, 4.2)
    burst(B, rng, t_in + 0.2, 'back', 7, 3.0)
    burst(B, rng, ta + 0.5, 'donate', 4, 3.0)
    for lt, w, st in list(B.laughs):
        if w == 'main': burst(B, rng, lt + 0.3, 'laugh', 2, 1.6)
    M(B, rng, '5분이라며 ㅋㅋㅋ', at=t_in + 0.7); M(B, rng, '1분컷 ㅋㅋ', at=t_in + 1.4)
    fill_chat(B, rng, B.t + 1.0, [(t_sin, t_sout + 1.5)])


# what the review panel sees (engine/review.py): anchors are ['line', id, frac(, offset)], ['afk', 0|1, offset],
# ['extra', 0|1, offset], ['first_draw'], ['t', seconds]
MAIN_BOX, WIDE = [1380, 470, 1880, 1080], [1250, 380, 1920, 1080]
REVIEW = {
    'keys': [['오프닝 인사', ['line', 'm02']], ['제목 타이핑 중', ['line', 'n03', .55]], ['그리다 망침(팔이 너무 김): 뾰로통', ['line', 'm31', .4]],
             ['그림 그리는 중: 집중한 얼굴', ['line', 'n05', 0, -1.5]], ['계단 그리기/졸라맨', ['line', 'n05', .9]], ['생각+머리긁기', ['line', 'm13', .5]],
             ["채팅 '37배 과장 아님?' → 정정하는 중", ['line', 'm41', .3]], ['반대로 나빠지면: 진지한 얼굴', ['line', 'm15', .5]],
             ['후원 알림', ['line', 'n08', 0, -0.8]], ['일어나서 문 쪽으로 고개를 돌림', ['afk', 0, 1.05]], ['화면 가장자리에서 얼굴 추적이 끊겨 멈춘 순간', ['afk', 0, 1.9]],
             ['자리비움: 빈자리 + 왼쪽 아래 배너(지난 시간)', ['afk', 0, 6.0]], ['동생이 화면 끝에서 빼꼼', ['extra', 0, 1.6]],
             ['동생이 문 쪽을 돌아보며 살짝 숨음', ['line', 'e02', 1.0, 0.8]], ['동생이 채팅을 올려다봄', ['line', 'e02', 1.0, 2.1]],
             ['동생 속삭임(언니 일화, 몸을 더 들이밂)', ['line', 'e05c', .5]], ['동생 윙크', ['line', 'e06', 1.0, 0.4]],
             ['동생이 PC 쪽으로 몸을 숙여 타이핑', ['line', 'e07', 0, -1.6]], ['복귀: 추적이 다시 잡혀 자리로 들어오는 중', ['afk', 1, 0.5]],
             ['자리 앞에서 멈췄다가 앉는 중', ['afk', 1, 1.5]], ['낙서를 알아챔(말하기 전)', ['line', 'm23', 0, -0.5]], ['낙서 읽기: 커서로 가리킴', ['line', 'm23', .7]],
             ['선택 후 삭제', ['line', 'n10', .3]], ['마무리: 정체성 타이핑', ['line', 'm36', .8]], ['복리에서 정체성으로 넘어가는 말', ['line', 'm42', .6]], ['마지막 문장 + 채팅 반응', ['line', 'm37', .95]]],
    'strips': [{'label': '립싱크 연속 8프레임(15fps) — 메인 발화 중', 'at': ['line', 'p08', .3], 'box': [1440, 640, 1800, 960]},
               {'label': '머리 긁기 연속 8프레임 (0.1초 간격)', 'at': ['line', 'm13', .42], 'box': [1400, 560, 1880, 1000], 'step': 0.1},
               {'label': '동생 속삭임 연속 8프레임', 'at': ['line', 'e05c', .4], 'box': [1440, 380, 1920, 1080]},
               {'label': '메인 퇴장 전체 (0.35초 간격 8컷)', 'at': ['afk', 0, -0.1], 'box': WIDE, 'step': 0.35},
               {'label': '메인 복귀 전체 (0.35초 간격 8컷)', 'at': ['afk', 1, -0.1], 'box': WIDE, 'step': 0.35},
               {'label': '동생 퇴장 (0.1초 간격 8컷)', 'at': ['extra', 1, -0.6], 'box': WIDE, 'step': 0.1},
               {'label': '메인 2초 모션: 말하는 동안 고개·몸·머리카락 (0.27초 간격 8컷)', 'at': ['line', 'p08', .05], 'box': MAIN_BOX, 'step': 0.27},
               {'label': '생각→눈 굴리기→머리 긁기→깨달음 전체 과정 (0.6초 간격 8컷)', 'at': ['line', 'm13', 0, -0.1], 'box': MAIN_BOX, 'step': 0.6},
               {'label': '동생 등장 (0.4초 간격 8컷)', 'at': ['extra', 0, 0.2], 'box': [1440, 380, 1920, 1080], 'step': 0.4},
               {'label': '마우스로 계단 긋는 중 연속 8프레임(커서 포함, 0.1초 간격)', 'at': ['line', 'n05', 0, -1.6], 'box': [100, 560, 600, 960], 'step': 0.1}],
    'gaze': [['그림판 작업 중(좌하단 응시)', ['line', 'n05', .5]], ['채팅 읽는 중(위쪽 응시)', ['line', 'n01', .5]],
             ['시청자에게 말할 때(정면)', ['line', 'm02', .5]], ['후원 알림 볼 때', ['line', 'n08', 0, 0.3]]],
    'gaze_box': MAIN_BOX, 'lip_main': 'p08', 'lip_extra': 'e04',
}
