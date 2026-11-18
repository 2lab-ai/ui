"""책듣는밤 1화 쇼츠 — three ~45 s Shorts cut from the live stream (shorts/shorts.py, rules in shorts/RESEARCH.md).
One idea each (shorts/RESEARCH.md): the first spoken line is the hook and frame 0 carries the hook title; the last line opens a
question only the live stream answers, the end card over it points down at the related-video link (= the live stream), and the
short ends right after that line.
Schedule (owner, 2026-11-18): no. 1 with the live stream (18:00), no. 2 at 22:00 the same day, no. 3 at 16:00 the next day.
Episode 1's live stream was already up, so no. 1 went up at once and nos. 2 and 3 were scheduled from there."""

LIVE = 'https://youtu.be/y1pxUrelf58'
SERIES = '📖 책듣는밤 1화 · 보랏빛 소가 온다'
FOOT = '지구에서 온 Kate'
TAGS = '보랏빛 소가 온다, 세스 고딘, Purple Cow, 책듣는밤, 쇼츠, 책 요약, 마케팅, 버튜버, 지구에서 온 Kate'


def desc(hook, credits):
    return f"""{hook}
▶ 30분 풀버전 라이브: {LIVE}
(쇼츠에선 링크가 안 눌려요. 채널 이름 → 홈 → 「[책듣는밤 1화] 보랏빛 소가 온다 30분 대신 읽기」)

📖 『보랏빛 소가 온다』 세스 고딘 (Purple Cow, 2003)
{credits}
목소리는 AI 음성, 채팅과 후원은 연출입니다.

#책듣는밤 #보랏빛소가온다 #세스고딘"""


SHORTS = [
    {'id': 's1', 'publish': 'now',
     'title': '들판에 보라색 소가 한 마리 있으면? | 보랏빛 소가 온다 #책듣는밤',
     'hook': '소 100마리 중에\n왜 1마리만 기억날까',
     'lines': ['c10', 'c03', 'c04', 'c05', 'c06', 'c07', 'c10', 'c11', 'c12', 'c17', 'c18', 'g01'],   # the hook comes back before its answer
     'hl': {'c07': '그냥 풍경', 'c12': '보랏빛 소', 'c18': '안 보죠'},
     'show': {'c10': ('props/purple_cow_field_full.jpg', '', (0.62, 0.5)),            # the hook frame is the oddity itself
              'c03': ('props/broll/cows_roadside.jpg', '📷 길가 목장의 소들', (0.55, 0.5)),  # the canvas is still blank there
              'c04': ('props/broll/cows_roadside.jpg', '📷 길가 목장의 소들', (0.55, 0.5)),
              'c18': ('props/broll/cows_roadside.jpg', '📷 길가 목장의 소들', (0.5, 0.5)),
              'g01': ('props/purple_cow_field_full.jpg', '', (0.62, 0.45))},           # the open question over the purple cow
     'zoom': {'c17': (94, 300, 700)},                                                 # her brown cows, big
     'end': '만드는 법은 채널 홈 풀버전에서',
     'desc': desc('갈색 소는 20분이면 풍경이 되고, 보라색 소는 차를 세우게 만들어요.',
                  '📷 길가의 소: qwesy qwesy (CC BY 3.0) · 보랏빛 소: Quintin Soloviev (CC BY 4.0, 소 색 변경)')},
    {'id': 's2', 'publish': '2026-11-18 22:00',
     'title': "'리마커블'의 반대말이 '아주 좋은'인 이유 | 보랏빛 소가 온다 #책듣는밤",
     'hook': "'리마커블'의 반대말이\n'아주 좋은'이라고?",
     'lines': ['r09', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15', 'r16'],   # the paradox spoken at 0 s; the short is about why
     'hl': {'r09': '아주 좋은', 'r14': '안 보이는 거', 'r13': '노래를 불렀다'},
     'zoom': {lid: (94, 262, 680) for lid in ('r09', 'r10')},   # her notes at the top left, big, above the captions
     'split': ['r12'],                                          # back to the whole canvas for the singing pilot she draws
     'show': {'r11': ('props/broll/airplane_landing.jpg', '📷 아무 일 없는 착륙', (0.6, 0.65))},
     'end': '다른 점은 채널 홈 풀버전에서',
     'desc': desc('아무 일 없이 잘 도착한 비행기는 아무도 얘기하지 않아요. 아주 좋은 건, 안 보여요.',
                  '📷 착륙: Matthew Groh (CC BY 4.0)')},
    {'id': 's3', 'publish': '2026-11-19 16:00',
     'title': '회의에서 다 같이 고치면 낙타가 나온다 | 보랏빛 소가 온다 #책듣는밤',
     'hook': '회의로 고친 제품이\n낙타가 되는 이유',
     'lines': ['x26', 'x27', 'x28', 'x29', 'x24', 'x25', 'g01'],   # one idea: the committee camel is the safe choice nobody talks about
     'show': {'x26': ('props/broll/horse.jpg', '📷 원래 만들려던 것: 말', (0.6, 0.45)),   # frame 0: a horse, while the title says camel
              'x27': ('props/broll/horse.jpg', '📷 원래 만들려던 것: 말', (0.6, 0.45)),   # '말을 만들려다가' ... the camel comes with x28
              'x28': ('props/broll/bactrian_camel.jpg', '📷 실제 낙타 (혹 2개 맞음)', (0.5, 0.5)),   # x27: her own camel, punched in
              'g01': ('props/purple_cow_field_full.jpg', '', (0.62, 0.45))},
     'zoom': {'x28': (560, 600, 560)},                                              # x29 plays on her camel doodle
     'hl': {'x27': '낙타', 'x24': '제일 위험하다', 'g01': '보라색 소'},
     'end': '만드는 법은 채널 홈 풀버전에서',
     'desc': desc('말을 만들려다가 낙타가 나와요. 안전한 게 제일 위험하대요.',
                  '📷 말: Joselodos (CC0) · 낙타: 퍼블릭 도메인 · 보랏빛 소: Quintin Soloviev (CC BY 4.0, 소 색 변경)')},
]
for S in SHORTS:
    S.setdefault('series', SERIES); S.setdefault('foot', FOOT); S.setdefault('tags', TAGS); S.setdefault('related', LIVE)
