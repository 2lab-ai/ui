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
        ['빈 페이지에 손으로 그린 확산 곡선: 구간 이름, 사람 수·받아들이는 순서 축, 얼리어답터와 다수 사이에 끊어 둔 틈(캐즘)', ['line', 'k051xb', 0.9]],
        ['리마커블의 반대말 인용 페이지에 밑줄', ['line', 'k091', 0.95]],
        ['더치 보이 전/후 사진 페이지', ['line', 'k110b', 0.95]],
        ['요즘 뉴스: 소가 바래는 속도 기사 스크랩', ['line', 'k140b', 0.9]],
        ['마지막 정리 페이지', ['line', 'k159b', 0.9]],
    ],
    'lip_main': 'k091',
}


def script(B, rng):
    play(B, rng, HERE)


# the upload, cut like the edit (book/assemble.py): cold open from the recording's own lines → the book's title card on its
# own tune → the recording → the end card on the book's closing tune (never the live's tunes or cards)
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.join(_os.path.dirname(HERE), '..', '..', '..', '..', '..', 'book'))
from cards_book import title_html, end_html
_ART = _os.path.expanduser('~/2lab.ai/ARTIFACTS/stream/book-night-01-purple-cow/book/v2/')
_BG = 'file://' + _ART + 'card_bg.jpg'
ASSEMBLY = {
    'audio': _os.path.expanduser('~/2lab.ai/ARTIFACTS/stream/book-night-01-purple-cow/book/audio'),
    'cold': [('k090b', None, None),                 # 리마커블의 반대말이 뭘까요. 나쁜 거?  (stop before the answer)
             ('k019', '식빵이', None),               # 식빵이 무슨 헬스장이에요 (laugh)
             ('k153b', None, None),                 # 저자가 만 부를 직접 찍어서 보라색 우유팩에 넣었대요.
             ('omt05a', None, None)],               # 그리고 진짜로 칠했어요. (the one more thing, teased)
    'title': {'dur': 5.0, 'tune': 'book_night_open',
              'html': title_html('책듣는밤', '1화 · 스트리밍 북', '보랏빛 소가 온다', '한 권 다 읽어드림 · 30분', '#b18cff', _BG,
                                 photo='file://' + _os.path.join(HERE, 'props', 'paris_milka_cow.jpg'), author='세스 고딘 『Purple Cow』')},
    'end': {'dur': 7.5, 'tune': 'book_night_close',
            'html': end_html('다음 책듣는밤에서<br>만나요', ['라이브 다시보기 · 편집본 · 쇼츠는 설명란에', '다음 책: 택배로 온 진짜 벽돌'], '#b18cff', _BG,
                             box_img='file://' + _ART + 'live_frame.jpg', box_label='▶ 1화 라이브 다시보기 (가볍게 30분)')},
}
