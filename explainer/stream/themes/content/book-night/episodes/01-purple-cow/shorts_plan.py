"""책듣는밤 1화 쇼츠 — three ~45 s Shorts cut from the live stream (shorts/shorts.py, rules in shorts/RESEARCH.md).
One idea each (shorts/RESEARCH.md): the first spoken line is the hook and frame 0 carries the hook title; the last line opens a
question only the live stream answers, then one caption-styled line says where the full stream is, and the short ends.
Titles follow real clip Shorts (shorts/RESEARCH.md §10): a few plain words, one in colour; the first version's question-form
titles over an emoji series label were called AI slop by the owner and replaced on 2026-11-18.
Short 2 changed its idea in that remake (the remarkable/opposite cut kept scoring ~78-80 with the panel: its first words are
an answer fragment); the bread-slicer story from the same stream opens on a fact and ends on 'that era is over'.
Schedule (owner, 2026-11-18): no. 1 with the live stream (18:00), no. 2 at 22:00 the same day, no. 3 at 16:00 the next day.
Episode 1's live stream was already up, so no. 1 went up at once and nos. 2 and 3 were scheduled from there."""

LIVE = 'https://youtu.be/y1pxUrelf58'
TAGS = '보랏빛 소가 온다, 세스 고딘, Purple Cow, 책듣는밤, 쇼츠, 책 요약, 마케팅, 버튜버, 지구에서 온 Kate'


def desc(hook, credits):
    return f"""{hook}
30분 풀버전 라이브: {LIVE}
(쇼츠에선 링크가 안 눌려요. 채널 이름 → 홈 → 「[책듣는밤 1화] 보랏빛 소가 온다 30분 대신 읽기」)

책: 『보랏빛 소가 온다』 세스 고딘 (Purple Cow, 2003)
{credits}
목소리는 AI 음성, 채팅과 후원은 연출입니다.

#책듣는밤 #보랏빛소가온다 #세스고딘"""


SHORTS = [
    {'id': 's1', 'publish': 'now',
     'title': '소가 풍경이 되는 데 걸리는 시간 | 보랏빛 소가 온다 #책듣는밤',
     'hook': '소가 풍경이 되는 데\n걸리는 시간', 'hook_key': '풍경',
     'lines': ['c10', 'c03', 'c04', 'c05', 'c06', 'c07', 'c10', 'c11', 'c12', 'c17', 'c18', 'g01'],   # the hook comes back before its answer
     'hl': {'c07': '그냥 풍경', 'c12': '보랏빛 소', 'c18': '안 보죠'},
     'show': {'c10': ('props/purple_cow_field_full.jpg', '', (0.62, 0.5)),            # the hook frame is the oddity itself
              'c03': ('props/broll/cows_roadside.jpg', '길가 목장의 소들', (0.55, 0.5)),  # the canvas is still blank there
              'c04': ('props/broll/cows_roadside.jpg', '길가 목장의 소들', (0.55, 0.5)),
              'c18': ('props/broll/cows_roadside.jpg', '길가 목장의 소들', (0.5, 0.5)),
              'g01': ('props/purple_cow_field_full.jpg', '', (0.62, 0.45))},           # the open question over the purple cow
     'zoom': {'c17': (94, 300, 700)},                                                 # her brown cows, big
     'end': '풀버전은 채널 홈에서', 'end_key': '채널 홈',
     'desc': desc('갈색 소는 20분이면 풍경이 되고, 보라색 소는 차를 세우게 만들어요.',
                  '사진 · 길가의 소: qwesy qwesy (CC BY 3.0) · 보랏빛 소: Quintin Soloviev (CC BY 4.0, 소 색 변경)')},
    {'id': 's2', 'publish': '2026-11-18 22:00',
     'title': '20년 동안 아무도 안 쓴 식빵 기계 | 보랏빛 소가 온다 #책듣는밤',
     'hook': '20년 동안 아무도\n안 쓴 식빵 기계', 'hook_key': '20년',
     'lines': ['t14', 't15', 't16', 't17', 't18', 't19'],   # the fact at 0 s, the twist, the payoff (Wonder Bread's ads), the open end
     'hl': {'t16': '이십 년', 't17': '대박', 't19': '끝났다'},
     'split': ['t15', 't16', 't17', 't18', 't19'],                                 # one continuous stretch, a new picture per line
     'show': {'t14': ('props/broll/bread_slicer_1928.jpg', '', (0.5, 0.5)),         # frame 0: the real machine
              't16': ('props/broll/bread_slicer_1928.jpg', '', (0.5, 0.5)),         # '아무도 안 썼어요' over it
              't17': ('props/broll/wonder_bread.jpg', '', (0.5, 0.4))},             # the ads that sold it
     'zoom': {'t15': (100, 600, 640),                                               # her '식빵 기계 1912' doodle
              't19': (560, 262, 560)},                                              # 'TV 광고' with her red X: that era is over
     'end': '그다음 시대 얘기는 채널 홈 풀버전에서', 'end_key': '채널 홈',
     'desc': desc('빵 써는 기계는 1912년에 나왔는데, 거의 20년 동안 아무도 안 썼대요. 바꾼 건 기계가 아니라 광고였어요.',
                  '사진 · 빵 절단기: Smithsonian NMAH (CC0) · 원더 브레드: Mike Mozart (CC BY 2.0)')},
    {'id': 's3', 'publish': '2026-11-19 16:00',
     'title': '말 만들려다 낙타 만드는 회의 | 보랏빛 소가 온다 #책듣는밤',
     'hook': '말 만들려다\n낙타 만드는 회의', 'hook_key': '낙타',
     'lines': ['x26', 'x27', 'x28', 'x29', 'x24', 'x25', 'g01'],   # one idea: the committee camel is the safe choice nobody talks about
     'show': {'x26': ('props/broll/horse.jpg', '원래 만들려던 것: 말', (0.6, 0.45)),   # frame 0: a horse, while the title says camel
              'x27': ('props/broll/bactrian_camel.jpg', '실제 낙타', (0.5, 0.5)),   # '…낙타가 나와요': the camel; x28-x29 on her own camel
              'x24': ('props/broll/bactrian_camel.jpg', '', (0.5, 0.5)),           # '안전한 게 제일 위험하다 … 무난하게 가자' = the committee camel again
              'x25': ('props/broll/bactrian_camel.jpg', '', (0.5, 0.5)),           # (the page there is white but for one line and a cursor)
              'g01': ('props/purple_cow_field_full.jpg', '', (0.62, 0.45))},
     'zoom': {'x28': (560, 600, 560)},                                              # x28-x29 on her camel doodle
     'no_broll': ['x28'],                                                           # the edit's camel card would cut into her doodle
     'hl': {'x27': '낙타', 'x24': '제일 위험하다', 'g01': '보라색 소'},
     'end': '풀버전은 채널 홈에서', 'end_key': '채널 홈',
     'desc': desc('말을 만들려다가 낙타가 나와요. 안전한 게 제일 위험하대요.',
                  '사진 · 말: Joselodos (CC0) · 낙타: 퍼블릭 도메인 · 보랏빛 소: Quintin Soloviev (CC BY 4.0, 소 색 변경)')},
]
for S in SHORTS:
    S.setdefault('tags', TAGS); S.setdefault('related', LIVE)
