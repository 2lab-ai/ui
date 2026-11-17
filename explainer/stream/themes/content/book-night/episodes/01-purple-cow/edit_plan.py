"""책듣는밤 1화 편집본 — the 30-minute live VOD cut to ~12 minutes with the editing grammar of edit/RESEARCH.md §4, every real thing she
names shown as its real photo (the reference sweep, edit/README.md §2) and the channel jingle on real instruments (edit/jingles.py).
History: v1 (edit_plan_v1.py) was the first public edit; v2 added the reference grammar (unlisted demo); this plan adds the reference
sweep and the jingle and is the public edit. Both earlier uploads are private.
  A (a streamer's gag edit)   caption voice by tone, state labels over her head, the editor's handwritten asides, corner labels,
                              a punch-in on the live chat when it erupts, follow-the-drawing punch-ins, a result card, a bonus clip under the end card
  B (a calm book channel)     the real thing behind every example, a dark thesis card for the line to keep
  C (a live-stream channel)   a '생방송 내용입니다' label where the stream part starts
Times refer to the live build (events.json voices, marks.json); lines are ids from lines.json."""

TITLE = {'channel': '지구에서 온 Kate', 'series': '📖 책듣는밤', 'ep': '1화', 'title': '보랏빛 소가 온다', 'sub': '세스 고딘 · 첫 방송 편집본',
         'bg': 'props/purple_cow_field_full.jpg', 'cow': [0.615, 0.40, 0.095, 0.15]}   # the purple cow in the photo (centre, radii as fractions)
# the end card over a bonus clip: her sister peeking in while she is away (muted; reference A ends on a peek-in clip)
END = {'next': '다음 화', 'next_title': '택배로 온 진짜 벽돌', 'next_sub': '제목은 아직 비밀', 'full': '30분 풀버전 라이브',
       'ask': '구독 · 좋아요 · 알림설정 부탁드려요', 'clip': ['mark', 'sis_in', -0.8], 'clip_zoom': 'peek',
       'clip_pip': (110, 450, 760), 'dur': 12.0}   # the clip in a window at the left; the right 40% is for YouTube's end-screen elements

LIVE = '2026. 11. 17(화) 생방송 내용입니다'
MAIN_LEAD = 0.35   # air between the jingle and her first word
JINGLE = 'lofi_keys'   # edit/jingles.py: one of the 14 candidates sent to the owner on 2026-11-18 (swap the name to change it)

# zoom boxes on the 1920x1080 live frame (x, y, w, h), 16:9; a pair of names in ZOOM is a pan (same size)
Z = {'face': (1262, 560, 658, 370),   # her face only: no strip of white canvas at the left edge
     'face_wide': (1000, 563, 920, 517), 'kate': (640, 360, 1280, 720), 'note': (368, 360, 400, 225),
     'loop_tl': (60, 190, 640, 360), 'loop_tr': (430, 190, 640, 360), 'loop_br': (430, 360, 640, 360), 'loop_bottom': (100, 380, 900, 506),
     'remark': (120, 270, 640, 360), 'bread': (100, 640, 640, 360), 'curve': (110, 345, 1040, 585), 'edges_text': (100, 270, 640, 360),
     'plist': (110, 560, 900, 506), 'curve_left': (40, 360, 1100, 619), 'chair': (380, 250, 720, 405),
     'cows': (100, 290, 960, 540), 'cow5': (31, 314, 448, 252), 'camel': (560, 600, 560, 315), 'chat': (1294, 255, 560, 315), 'peek': (1262, 600, 658, 370)}
HEAD = (1590, 600)   # a point on her hat in the live frame: where state labels sit (they follow the punch-ins)

# 10 s cold open: while she is away her sister types a note on the canvas (2x, framed on the note) -> she comes back, reads it -> '그리고 네 개였어요.'
# (cut before '하나는 꼬리예요', so the hook stops on the contradiction) -> her own five-legged cow, counted -> scratch, title.
# v1 framed the canvas around the note (the ninth-P list leaked in) and ended after the excuse; reviewers asked for both to go.
COLD_OPEN = [{'at': ['t', 975.7], 'dur': 3.2, 'speed': 2.0, 'zoom': 'note',   # the note mid-typing, readable from the first frame
              'caption': {'text': '(언니 자리 비운 사이)', 'style': 'narr', 'x': 960, 'y': 170, 'at': 0.0, 'sfx': None}},
             {'line': 'p06', 'zoom': 'face', 'pre': 0.6}, {'line': 'p07', 'zoom': 'face'},
             {'line': 'p09', 'zoom': 'face', 'from': 0.28, 'cut': 1.36, 'text': '네 개였어요.', 'text_en': 'It had four.'},
             {'at': ['line', 'c05', 0.1], 'dur': 0.1, 'hold': 'fill', 'zoom': 'cow5', 'mute': True,
              'count': {'xs': [643, 733, 870, 1003, 1101], 'y': 975, 'at': 0.05, 'step': 0.1, 'sfx': 'pop'},   # her five legs, counted
              'caption': {'text': '다리 5개', 'style': 'gag', 'x': 960, 'y': 170, 'at': 0.55, 'sfx': 'boing'}, 'end_sfx': 'scratch'}]
COLD_LEN = 10.0

# lines left out: v1's list, plus o04, o07, o10 (the opening reaches the book sooner; the title card already names the series);
# z17-z18 come back (her awkward 'subscribe' is a beat)
DROP = {'o01', 'o02', 'o04', 'o05', 'o07', 'o08', 'o09', 'o10', 'o13', 'o14', 'o11', 'o12', 'o15', 'o06', 'o16', 'o17', 'o18', 'o19', 'o20', 'o21', 'o22', 'o23',
        'b10', 'b11', 'b12', 'b14', 'b15', 'b18', 'b19', 'b20', 'b21', 'b22', 'b23', 'b24', 'b25',
        'c08', 'c16', 'c19', 'c20', 'c24', 'c25', 'c26', 'c27',
        'r03', 'r10', 'r15', 'r16', 'r17', 'r20', 'r25', 'r27', 'r28', 'r31',
        't08', 't11', 't15', 't19', 't21', 't25', 't26', 't27', 't28', 't29', 't30', 't31', 't32', 't33',
        'p04', 'p12', 'p13', 'y02', 'y05',
        'i09', 'i11', 'i16', 'i17', 'i26', 'i27', 'i28', 'i29', 'i30', 'i31', 'i32', 'i33', 'i34',
        'x09', 'x12', 'x21', 'x22', 'x30', 'x31', 'x32', 'x33', 'x34', 'x35', 'x36', 'x37',
        'g10', 'g11', 'g16', 'g17', 'g18', 'g19',
        'z09', 'z10', 'z11', 'z12', 'z13', 'z14', 'z15', 'z16'}

# punch-ins on a line; the TV loop is followed box by box as she draws it (t04 -> t07); a term or diagram fills the frame while it is explained
# one mark per line: a line that carries a state label or an aside gets no face punch-in (the label is the emphasis)
ZOOM = {'c04': 'cows', 'c23': 'face', 't12': 'face',
        't04': 'loop_tl', 't05': 'loop_tr', 't06': 'loop_br', 't07': 'loop_bottom',
        'r04': 'remark', 'r05': 'remark', 'i04': 'curve', 'i08': 'curve', 'g03': 'edges_text', 'g04': 'edges_text',
        't17': 'bread', 't18': 'bread', 'r12': 'face', 'i20': 'face',
        't22': 'plist', 't23': 'plist', 'i10': 'curve_left', 'x11': 'chair',
        'p02': 'face', 'p07': 'note', 'x27': 'camel', 'z08': 'kate'}
CHATZOOM = ['c12', 'g06']   # the live chat erupts here (the purple-cow photo, the 'thickest books only' idea): cut to the chat, her line as a chat box

# caption voice (reference A): shout = heavy face, mutter = small handwriting; HL colours one key phrase inside a caption
TONE = {'i22': 'shout', 'p09': 'shout', 'p06': 'mutter', 'p07': 'mutter', 'z18': 'mutter'}
HL = {'b17': '눈에 안 띄면, 없는 거랑 똑같다', 'c12': '보랏빛 소', 'r02': '리마커블', 't02': 'TV 산업 복합체', 'i13': '스니저', 'i18': '오타쿠'}

# corner labels (reference A): the start of each part, in the editor's words
CORNERS = {'b01': '오늘의 책: 보랏빛 소가 온다', 'c01': '고속도로 옆 소 떼', 'r01': '리마커블의 반대말', 't01': 'TV 광고 공식, 고장 나다',
           'p01': '돌발 상황: 택배', 'i01': '누구한테 팔까', 'x01': '진짜 보라색 소들', 'g01': '가장자리로 가라', 'z01': '한 줄 정리'}

# state labels over her head while a state lasts (reference A: (움찔), (위기)); never on the lore lines
STATE = [('o03', 'o03', '첫 방송 긴장'), ('r21', 'r23', '첫 후원 동공지진'), ('p08', 'p09', '억울'), 
         ('z17', 'z18', '대본 읽는 중')]

# the editor's marks: key (purple box, the book's point), tag (pink pill), gag (tilted yellow), narr (the editor's handwritten aside),
# result (two-line tally), thesis (the line to keep on a dark screen; its caption is the card). No mark repeats the line; none on lore lines.
EMPH = {
    'r09': ('리마커블의 반대말 = 아주 좋은', 'key', 'ding'), 'r14': ('아주 좋은 건, 안 보인다', 'key', 'ding'),
'y01': ('동생 등장', 'tag', 'ding'), 'y08': ('(도망)', 'gag', 'boing'),
    'p10': ('다 봤음', 'narr', 'pop'),
    'i13': ('재채기꾼 = 스니저', 'key', 'ding'), 'i25': ('재채기 감염 1명 확인', 'narr', 'pop'),
    'x07': ('(누가 봐도 우유통)', 'narr', 'boing'),   # x11: the canvas already says '= 미술관' and x10 shows the real chair
    'x24': ('제일 좋아하는 말|안전한 게 제일 위험하다', 'thesis', None),
    'g02': ('가장자리로 가라', 'key', 'ding'), 'g07': ('채널 콘셉트: 채팅이 정함', 'narr', 'pop'), 
    'z02': ('아주 좋은 건, 안 보인다', 'thesis', None),
    'z05': ('첫 방송 결산\n후원 3번 · 동생 1번 · 다리 다섯 개 소 1마리', 'result', 'ding'),
}

# chat that a line answers, shown as a bubble (the live chat panel is too small to read at edit speed); g06 now punches into the real chat
CHAT = {'b04': '근데 벽돌책이라면서 얇지 않아요?', 'b13': '표지 보라색이죠?', 'c22': '이 채널은 보라 소인가',
        'c28': '근데 보라색 소 진짜 있음?', 'r07': '평범함? 지루한 거? 노잼', 'r29': '우리 동네 줄 서는 빵집 있음', 't12': '유튜브 프리미엄 씀 ㅋㅋ',
        't22': '4P만 배웠는데', 'y06': '몇 살이에요?', 'i07': '가운데요 / 대다수', 'i15': '나 재채기꾼임', 'i19': '오타쿠가 책에 나옴?',
        'x17': '근데 왜 하필 보라색이에요?'}

# the book's symbol as a real picture: the photo she pastes at '사진 찍고' fills the screen; the real chat follows (CHATZOOM c12)
INSERTS = [{'at': ['mark', 'photo', 0.35], 'dur': 2.0, 'image': 'props/purple_cow_field_full.jpg', 'focus': [0.62, 0.52], 'sfx': 'whoosh'},
           {'at': ['line', 'c21', 0.05], 'dur': 1.4, 'image': 'props/purple_cow_field_full.jpg', 'focus': [0.62, 0.45], 'zoom0': 1.35, 'sfx': 'whoosh'},
           {'at': ['line', 'g13', 0.35], 'dur': 1.8, 'image': 'props/purple_field_all.jpg', 'focus': [0.5, 0.5], 'zoom0': 1.0, 'sfx': 'whoosh'},   # '그 들판은 또 보라색 소 천지'
           ]

# the reference sweep (edit/README.md §2): every real thing she names, its real photo, on the word (at = the word's start / the line's
# length, from audio/<id>.words.json). Full screen = a dissolve with a 📷 label; 'card' = a tilted photo beside the drawing.
# Credits: props/broll/CREDITS.md. Not found under PD/CC0/CC BY: the milk-carton first edition (a generic carton stands in, labelled so).
C = lambda line, frac, img, label, dur=3.0, size=(420, 420), pos=(1000, 560), tilt=3, crop=(0.5, 0.5), sfx='pop': {
    'at': ['line', line, frac], 'layout': 'card', 'dur': dur, 'image': 'props/broll/' + img, 'size': size, 'pos': pos, 'tilt': tilt, 'crop': crop,
    'label': label, 'sfx': sfx}
F = lambda line, frac, img, label, dur=3.0, focus=(0.5, 0.5), zoom0=1.0: {
    'at': ['line', line, frac], 'dur': dur, 'image': 'props/broll/' + img, 'focus': list(focus), 'zoom0': zoom0, 'label': label}
BROLL = [C('b01', 0.30, 'purple_cow_book.jpg', '보랏빛 소가 온다 (원서)', 3.0, (360, 420), crop=(0.12, 0.5)),
         C('b02', 0.0, 'seth_godin.jpg', '세스 고딘', 3.2, (300, 420), tilt=-3, crop=(0.6, 0.2)),
         C('b07', 0.1, 'milk_carton.jpg', '이런 우유팩에 책을', 3.6, (520, 420), tilt=-3),
         F('c03', 0.05, 'cows_roadside.jpg', '📷 길가 목장의 소들', 3.2, (0.55, 0.5)),
         F('c14', 0.0, 'aurochs.jpg', '📷 오록스 골격 · 코펜하겐 국립박물관', 3.8, (0.35, 0.4)),
         F('c15', 0.0, 'cave_painting_aurochs_alt.jpg', '📷 라스코 동굴벽화의 오록스 (복제 동굴)', 3.2, (0.45, 0.45)),
         F('r11', 0.15, 'airplane_landing.jpg', '📷 아무 일 없는 착륙', 2.4, (0.6, 0.65)),
         F('t02', 0.1, 'vintage_tv.jpg', '📷 그 시절 TV', 2.6, (0.35, 0.4)),
         C('t14', 0.15, 'bread_slicer_1928.jpg', '1928년 첫 판매된 빵 절단기', 3.0, (480, 360)),
         F('t17', 0.08, 'wonder_bread.jpg', '📷 원더 브레드', 3.0, (0.5, 0.4)),
         C('t23', 0.35, '../purple_cow_field_full.jpg', '아홉 번째 P = 이 소', 2.6, (440, 300), (420, 470), -3),
         C('i05', 0.6, 'flip_phone.jpg', '(폴더폰 저격)', 2.4, (380, 350), tilt=-4),
         F('i23', 0.0, 'keyboards.jpg', '📷 키보드 여섯 개의 세계', 3.0, (0.55, 0.6)),
         C('x02', 0.3, 'dutchboy_metal_can.jpg', '더치 보이 페인트', 2.4, (440, 330)),
         F('x04', 0.0, 'dutchboy_metal_can.jpg', '📷 원래: 무거운 철 깡통', 1.45, (0.5, 0.42), 1.1),
         F('x04', 0.22, 'dutchboy_twist_pour.jpg', '📷 바뀐 통: 손잡이 + 돌려 여는 뚜껑', 4.4, (0.5, 0.45)),
         C('x10', 0.05, 'aeron_chair.jpg', '실제 에어론 의자', 3.4, (420, 560), (1060, 600), 2),
         C('x11', 0.42, 'moma.jpg', '뉴욕 현대미술관 (MoMA)', 3.0, (420, 420), crop=(0.3, 0.4)),
         C('x14', 0.1, 'elevator_destination_panel.jpg', '층 먼저 누르는 버튼', 3.2, (400, 540), (980, 540), -2),
         F('x17', 0.39, 'tyrian_purple.jpg', '📷 고둥 염료로 물들인 양털', 2.8, (0.5, 0.5)),
         F('x18', 0.0, 'murex_shells.jpg', '📷 뿔고둥 (보라 염료의 원료)', 3.2, (0.4, 0.6)),
         C('x28', 0.15, 'bactrian_camel.jpg', '실제 낙타 (혹 2개 맞음)', 3.4, (440, 320), (330, 430), -3),
         C('g09', 0.0, 'guns_germs_steel.jpg', '채팅 추천: 총균쇠', 2.8, (300, 440), tilt=-3),
         F('g14', 0.2, 'cows_roadside.jpg', '📷 그 고속도로 옆 소들', 2.2, (0.45, 0.5), 1.1)]

# a cut that skips minutes gets a small time card
JUMP_CARDS = {'y01': '⏩ 1분 뒤'}

CHAPTERS = [('o03', '오프닝 — 첫 방송'), ('b01', '첫 책: 보랏빛 소가 온다 (우유팩 초판)'), ('c01', '고속도로 옆 소, 그리고 보라색 소'),
            ('r01', '리마커블의 반대말'), ('t01', 'TV 광고 공식이 고장 났다'), ('p01', '택배, 그리고 동생'), ('i01', '누구한테 팔까: 재채기꾼과 오타쿠'),
            ('x01', '진짜 보라색 소들'), ('g01', '가장자리로 가라'), ('z01', '한 줄 정리')]
CHAPTERS_EN = ['Opening: the first stream', 'First book: Purple Cow (the milk-carton edition)', 'Cows by the highway, and a purple one',
               'The opposite of remarkable', 'The TV-industrial complex broke', 'A parcel, and my sister', 'Who to sell to: sneezers and otaku',
               'Real purple cows', 'Go to the edges', 'One line to keep']
