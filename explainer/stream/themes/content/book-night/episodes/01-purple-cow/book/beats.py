"""책듣는밤 1화 스트리밍 북 『보랏빛 소가 온다』 — the whole book, alone (streaming theme studio, streamer kate, content book-night).
Everything comes from script.py through engine/storyboard.py (lines.json, pages/pages.json, story.json); this file only plays it.
build: python engine/build.py --beats <this> --audio <audio> --out <build> --streaming studio --streamer kate --content book-night"""
import json, os
from storyboard import play

HERE = os.path.dirname(os.path.abspath(__file__))
TAIL = 3.0
STREAM_TITLE = '📖 책듣는밤 1화 · 보랏빛 소가 온다 — 스트리밍 북'
TOC = json.load(open(os.path.join(HERE, 'story.json')))['toc']

# what the review panel looks at (labels say only what is on screen)
REVIEW = {
    'keys': [
        ['첫 페이지: 보랏빛 소 사진 + 오늘의 목표, 밑줄', ['line', 'k002b', 0.8]],
        ['프랑스 시골길의 소 떼 페이지', ['line', 'k006b', 0.8]],
        ['리마커블 정의 페이지: 보랏빛 소 사진 둘레에 빨간 네모', ['line', 'k010b', 0.6]],
        ['TV-산업 복합체 순환 목록에 동그라미', ['line', 'k028b', 0.8]],
        ['요즘 뉴스 기사 스크랩: 방송광고 감소', ['line', 'k030b', 0.9]],
        ['빈 페이지에 손으로 그린 확산 곡선: 구간 이름, 사람 수·시간 축, 캐즘 표시', ['line', 'k051xb', 0.9]],
        ['리마커블의 반대말 인용 페이지에 밑줄', ['line', 'k091', 0.95]],
        ['더치 보이 전/후 사진 페이지', ['line', 'k110b', 0.95]],
        ['요즘 뉴스: 소가 바래는 속도 기사 스크랩', ['line', 'k140b', 0.9]],
        ['마지막 정리 페이지', ['line', 'k159b', 0.9]],
    ],
    'lip_main': 'k091',
}


def script(B, rng):
    play(B, rng, HERE)
