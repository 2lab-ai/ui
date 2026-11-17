"""Fill CHANNEL.tmpl.md with episode 1's chapter times, Shorts ranges and length from the final build -> CHANNEL.md.
usage: python gen_package.py <build dir>"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ev = json.load(open(os.path.join(sys.argv[1], 'events.json')))
start = {lid: t0 for who, lid, t0, d in ev['voices']}
end = {lid: t0 + d for who, lid, t0, d in ev['voices']}
T = ev['T']

CH = [  # (first line, ko, en)
    (None, '오프닝: 첫 방송, 책듣는밤이 뭐냐면', 'Opening: first stream, what Book Night is'),
    ('b01', '첫 책 『보랏빛 소가 온다』와 우유팩 초판', 'The first book, and the edition that came in a milk carton'),
    ('c01', '프랑스 고속도로의 소들: 20분이면 안 보인다', 'The cows by the French highway: invisible in 20 minutes'),
    ('r01', '리마커블의 반대말은 "아주 좋은"', 'The opposite of remarkable is "very good"'),
    ('t01', 'TV 광고 공식은 왜 고장 났나 (식빵, 아홉 번째 P)', 'Why the TV formula broke (sliced bread, the ninth P)'),
    ('p01', '택배 왔다! (2분 자리 비움)', 'A parcel at the door (two minutes away)'),
    ('i01', '누구한테 팔까: 재채기꾼과 오타쿠', 'Who to sell to: sneezers and otaku'),
    ('x01', '진짜 보라색 소들: 페인트 통, 의자, 엘리베이터', 'Real purple cows: a paint jug, a chair, a lift'),
    ('x23', '안전한 게 제일 위험하다 (위원회가 만든 낙타)', 'Safe is risky (the committee camel)'),
    ('g01', '가장자리로 가라', 'Go to the edges'),
    ('z01', '오늘의 한 줄과 다음 화 예고', "Today's one line, and what's next"),
]


def ts(t):
    t = int(t); h, m, s = t // 3600, t // 60 % 60, t % 60
    return f'{h}:{m:02d}:{s:02d}' if h else f'{m:02d}:{s:02d}'


def chapters(col):
    rows = []
    for lid, ko, en in CH:
        t = 0 if lid is None else start[lid] - 1.0
        rows.append(f'{ts(t)} {ko if col == 0 else en}')
    return '\n'.join(rows)


afk0, afk1 = ev['afk']
sis0, sis1 = ev['sis'][0]
SHORTS = [
    ('c02', 'c08', '20분이면 소가 안 보인다 (프랑스 고속도로의 소)', 'The cows go invisible in 20 minutes'),
    ('r06', 'r13', '리마커블의 반대말 퀴즈 → "아주 좋은" → 노래하는 기장', 'Quiz: the opposite of remarkable'),
    ('x24', 'x28', '안전한 게 제일 위험하다 → 위원회가 만든 낙타 그림', 'Safe is risky, and the camel drawing'),
]
rows = [f'- {ts(start[a] - 1.0)}–{ts(end[b] + 1.5)} · {ko} / {en}' for a, b, ko, en in SHORTS]
rows.append(f'- {ts(sis0 - 2.0)}–{ts(sis1 + 2.0)} · 언니가 택배 받으러 간 사이 동생 등장 / The sister sneaks in while she is at the door')
rows.append(f'- {ts(start["p03"] - 1.0)}–{ts(end["p09"] + 1.5)} · 돌아와서 "소 다리 다섯 개였음" 발견 / She finds the note: "the cow had five legs"')

s = open(os.path.join(HERE, 'CHANNEL.tmpl.md')).read()
s = s.replace('{{CHAPTERS_KO}}', chapters(0)).replace('{{CHAPTERS_EN}}', chapters(1)).replace('{{SHORTS}}', '\n'.join(rows))
s = s.replace('{{LENGTH}}', f'{int(T // 60)}분 {int(T % 60)}초, 1920×1080 30fps')
open(os.path.join(HERE, 'CHANNEL.md'), 'w').write(s)
print(chapters(0)); print('\n'.join(rows)); print('length', ts(T))
