"""책듣는밤 1화 편집본 (fast edit of the 30-minute live VOD): what edit/cut.py keeps, cuts, zooms and captions.
Structure the channel asked for: a 10-second cold open (the funniest, most absurd beat, cut off hard) -> 5-second title card
with the channel's signature jingle -> the stream, jump-cut, about 13-14 minutes -> end card.
Times refer to the live build (events.json voices, marks.json); lines are ids from lines.json."""

TITLE = {'channel': '지구에서 온 Kate', 'series': '📖 책듣는밤', 'ep': '1화', 'title': '보랏빛 소가 온다', 'sub': '세스 고딘 · 첫 방송 편집본',
         'bg': 'props/purple_cow_field_full.jpg', 'cow': [0.615, 0.40, 0.095, 0.15]}   # the purple cow in the photo (centre, radii as fractions)
END = {'next': '다음 화', 'next_title': '택배로 온 진짜 벽돌', 'next_sub': '제목은 아직 비밀', 'full': '30분 풀버전 라이브', 'bye': '잘 자요, 여러분 🌙'}

# zoom boxes on the 1920x1080 live frame (x, y, w, h), 16:9
Z = {'face': (1000, 563, 920, 517), 'kate': (640, 360, 1280, 720), 'note': (180, 250, 800, 450), 'note2': (260, 290, 640, 360), 'note3': (370, 380, 420, 236),
     'tvloop': (120, 280, 880, 495), 'plist': (110, 585, 880, 495), 'curve_left': (40, 360, 1100, 619), 'chair': (380, 270, 720, 405),
     'cows': (100, 290, 960, 540), 'cow5': (31, 314, 448, 252), 'camel': (560, 600, 560, 315)}

# 10 s cold open: Kate comes back, finds her sister's note on the canvas, insists the cow had four legs ... then the evidence.
COLD_OPEN = [{'line': 'p06', 'zoom': 'note3', 'pre': 0.4}, {'line': 'p07', 'zoom': 'kate'}, {'line': 'p09', 'zoom': 'face', 'post': 0.35},
             {'at': ['line', 'c05', 0.1], 'dur': 0.1, 'hold': 'fill', 'zoom': 'cow5', 'mute': True,
              'count': {'xs': [643, 733, 870, 1003, 1101], 'y': 975, 'at': 0.1, 'step': 0.2, 'sfx': 'pop'},   # her five legs, counted
              'caption': {'text': '다리 5개 (꼬리 없음)', 'style': 'gag', 'x': 960, 'y': 170, 'at': 1.2, 'sfx': 'boing'}, 'end_sfx': 'scratch'}]
COLD_LEN = 10.0   # the last shot holds until the cold open is this long

# lines left out of the edit (about 6 minutes of a 17.9-minute script): greetings, side notes, second examples, the long recap
DROP = {'o01', 'o02', 'o05', 'o08', 'o09', 'o11', 'o12', 'o15', 'o06', 'o16', 'o17', 'o18', 'o19', 'o20', 'o21', 'o22', 'o23',
        'b10', 'b11', 'b12', 'b14', 'b15', 'b18', 'b19', 'b20', 'b21', 'b22', 'b23', 'b24', 'b25',
        'c16', 'c24', 'c25', 'c26', 'c27',
        'r03', 'r15', 'r16', 'r17', 'r20', 'r25', 'r27', 'r28', 'r31',
        't08', 't19', 't25', 't26', 't27', 't28', 't29', 't30', 't31', 't32', 't33',
        'p04', 'p12', 'p13', 'y02', 'y05',
        'i11', 'i16', 'i17', 'i26', 'i27', 'i28', 'i29', 'i30', 'i31', 'i32', 'i33', 'i34',
        'x09', 'x12', 'x21', 'x22', 'x30', 'x31', 'x32', 'x33', 'x34', 'x35', 'x36', 'x37',
        'g10', 'g11', 'g16', 'g17', 'g18', 'g19',
        'z09', 'z10', 'z11', 'z12', 'z13', 'z14', 'z15', 'z16', 'z17', 'z18'}

# punch-ins on a line (a cut to a closer frame for the whole line)
ZOOM = {'o14': 'face', 'b05': 'face', 'c04': 'cows', 'c23': 'face', 'r10': 'face', 'r21': 'face', 'r23': 'face', 't12': 'face',
        't07': 'tvloop', 't21': 'plist', 't22': 'plist', 't23': 'plist', 'i10': 'curve_left', 'x10': 'chair', 'x11': 'chair',
        'p02': 'face', 'p07': 'note2', 'p08': 'face', 'p09': 'face', 'i23': 'face', 'x28': 'camel', 'g07': 'face', 'z08': 'kate'}

# the editor's captions: at = fraction of the line; style gag (yellow, tilted) | key (purple box) | tag (small pink label)
EMPH = {
    'b05': ('벽돌은 다음부터', 'gag', 'pop'),
    'b07': ('책을 우유팩에?!', 'key', 'ding'), 'c04': ('다리… 5개?', 'gag', 'boing'),
    
    'r09': ('리마커블의 반대말 = 아주 좋은', 'key', 'ding'), 'r14': ('아주 좋은 건, 안 보인다', 'key', 'ding'),
    'r21': ('첫 후원!!', 'gag', 'ding'), 
    't23': ('아홉 번째 P = 보랏빛 소', 'key', 'ding'), 'y01': ('동생 등장', 'tag', 'ding'),
    'y08': ('(도망)', 'gag', 'boing'), 
    'i05': ('(폴더폰 저격)', 'gag', 'pop'), 'i13': ('재채기꾼 = 스니저', 'key', 'ding'), 
    'x07': ('(우유통 맞음)', 'gag', 'boing'), 'x11': ('의자가 미술관에', 'key', 'ding'), 'x24': ('안전한 게 제일 위험하다', 'key', 'ding'),
    'x28': ('(낙타 맞음?)', 'gag', 'boing'), 'g02': ('가장자리로 가라', 'key', 'ding'), 
    'g09': ('다음 벽돌 후보: 총균쇠', 'tag', 'ding'), 'z02': ('아주 좋은 건, 안 보인다', 'key', 'ding'),
}

# chat that a line answers, shown as a bubble (the live chat panel is too small to read at edit speed)
CHAT = {'b04': '근데 벽돌책이라면서 얇지 않아요?', 'b13': '표지 보라색이죠?', 'c22': '이 채널은 보라 소인가',
        'c28': '근데 보라색 소 진짜 있음?', 'r07': '평범함? 지루한 거? 노잼', 'r29': '우리 동네 줄 서는 빵집 있음', 't12': '유튜브 프리미엄 씀 ㅋㅋ',
        't22': '4P만 배웠는데', 'y06': '몇 살이에요?', 'i07': '가운데요 / 대다수', 'i15': '나 재채기꾼임', 'i19': '오타쿠가 책에 나옴?',
        'x07': '그림 우유통 같음', 'x17': '근데 왜 하필 보라색이에요?', 'x28': '그림 낙타 맞음?', 'g06': '제일 두꺼운 책만 읽는 방송'}

# the book's symbol as a real picture: the photo she pastes at '사진 찍고' fills the screen for a moment
INSERTS = [{'at': ['mark', 'photo', 0.35], 'dur': 3.6, 'image': 'props/purple_cow_field_full.jpg', 'focus': [0.62, 0.52],
            'chat': '합성 아님? ㅋㅋㅋ', 'sfx': 'whoosh'},
           {'at': ['line', 'c21', 0.05], 'dur': 1.4, 'image': 'props/purple_cow_field_full.jpg', 'focus': [0.62, 0.45], 'zoom0': 1.35, 'sfx': 'whoosh'},   # callback: '보라색이어야'
           {'at': ['line', 'g13', 0.35], 'dur': 1.8, 'image': 'props/purple_field_all.jpg', 'focus': [0.5, 0.5], 'zoom0': 1.0, 'sfx': 'whoosh'},   # '그 들판은 또 보라색 소 천지'
           {'at': ['line', 'z02', 0.0], 'dur': 1.8, 'image': 'props/purple_cow_field_full.jpg', 'focus': [0.62, 0.45], 'zoom0': 1.15, 'sfx': 'whoosh'}]   # the one line to keep

# a cut that skips minutes gets a small time card
JUMP_CARDS = {'y01': '⏩ 1분 뒤'}

CHAPTERS = [('o03', '오프닝 — 첫 방송'), ('b01', '첫 책: 보랏빛 소가 온다 (우유팩 초판)'), ('c01', '고속도로 옆 소, 그리고 보라색 소'),
            ('r01', '리마커블의 반대말'), ('t01', 'TV 광고 공식이 고장 났다'), ('p01', '택배, 그리고 동생'), ('i01', '누구한테 팔까: 재채기꾼과 오타쿠'),
            ('x01', '진짜 보라색 소들'), ('g01', '가장자리로 가라'), ('z01', '한 줄 정리')]
CHAPTERS_EN = ['Opening: the first stream', 'First book: Purple Cow (the milk-carton edition)', 'Cows by the highway, and a purple one',
               'The opposite of remarkable', 'The TV-industrial complex broke', 'A parcel, and my sister', 'Who to sell to: sneezers and otaku',
               'Real purple cows', 'Go to the edges', 'One line to keep']
