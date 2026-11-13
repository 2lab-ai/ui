"""Unit tests for title_check.py's offline parts (form lint, hook, keyword bar, off-topic). python -m unittest"""
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import title_check  # noqa: E402
from title_check import hook_of, is_small_hit, lint, off_topic, passes_bar


def codes(title, **kw):
    return {c for c, _ in lint(title, **kw)}


class Form(unittest.TestCase):
    def test_old_template_fails(self):   # every baseline probe of 2026-11-14 used this shape
        c = codes('그릿 — 끝까지 가는 사람은 무엇이 다를까 (20분 도슨트북)', book='그릿')
        self.assertIn('label', c); self.assertIn('name-first', c); self.assertIn('no-hook', c)

    def test_hook_first_passes(self):
        self.assertEqual(codes('모임이 귀찮아졌다면 정상입니다 — 쇼펜하우어가 혼자를 권한 이유'), set())
        self.assertEqual(codes('게을러서가 아니라 시간이 안 보여서예요 — 성인 ADHD 시간관리, 책 3권'), set())

    def test_situation_hooks_count(self):   # '~할 때', '~한 밤' are the viewer's situation (verification v03)
        self.assertNotIn('no-hook', codes('잠이 안 오는 밤 — 윤동주'))
        self.assertNotIn('no-hook', codes('일이 손에 안 잡힐 때 — 원씽'))

    def test_label_only(self):
        self.assertIn('no-hook', codes('오일러 항등식의 역사 — 반 바퀴 걷기를 적는 데 수천 년이 걸린 이야기'))

    def test_lengths(self):
        self.assertIn('long', codes('가' * 56))
        self.assertIn('hook-long', codes('나' * 31 + ' — 책'))
        self.assertEqual(hook_of('질문인가요? — 책 | 저자'), '질문인가요?')

    def test_a_name_is_not_a_hook(self):   # trinity review: 법 inside a word and a bare number used to pass
        self.assertIn('no-hook', codes('방법서설 — 데카르트'))
        self.assertIn('no-hook', codes('1984 — 조지 오웰'))
        self.assertNotIn('no-hook', codes('습관을 만드는 법 — 아주 작은 습관의 힘'))
        self.assertNotIn('no-hook', codes('세 번 터졌다 — 일론 머스크'))
        self.assertNotIn('no-hook', codes('37배 차이 — 작은 습관'))

    def test_one_label_per_place(self):   # "도슨트북" matched two patterns and was reported twice
        self.assertEqual(sum(c == 'label' for c, _ in lint('그릿 — 도슨트북')), 1)
        self.assertEqual(sum(c == 'label' for c, _ in lint('그릿 (20분 도슨트북)')), 2)   # the running time and the format


class Strict(unittest.TestCase):
    def test_strict_needs_a_keyword(self):
        with self.assertRaises(SystemExit) as e: title_check.main(['시간이 샌다면 — 책', '--strict'])
        self.assertEqual(e.exception.code, 1)
        with self.assertRaises(SystemExit) as e: title_check.main(['시간이 샌다면 — 책', '--strict', '--keyword', '시간', '--no-net'])
        self.assertEqual(e.exception.code, 1)

    def test_failed_subscriber_lookups_are_not_cached(self):
        import tempfile, json
        old_cache, old_ytdlp = title_check.CACHE, title_check.ytdlp
        title_check.CACHE = tempfile.mkdtemp()
        def flaky(*a):
            if a[-1].endswith('/ok'): return {'channel_follower_count': 5}
            raise RuntimeError('timeout')
        title_check.ytdlp = flaky
        try:
            got = title_check.subs_of(['ok', 'bad'])
            self.assertEqual(got, {'ok': 5, 'bad': None})
            self.assertEqual(json.load(open(os.path.join(title_check.CACHE, 'subs.json'))), {'ok': 5})
        finally:
            title_check.CACHE, title_check.ytdlp = old_cache, old_ytdlp


class Demand(unittest.TestCase):
    def test_small_hit(self):
        self.assertTrue(is_small_hit(60_000, 10_000)); self.assertTrue(is_small_hit(300_000, 90_000))
        self.assertFalse(is_small_hit(60_000, 60_000)); self.assertFalse(is_small_hit(10_000, 100)); self.assertFalse(is_small_hit(1, None))

    def test_bar(self):
        self.assertTrue(passes_bar({'median': 120_000, 'small': 0})); self.assertTrue(passes_bar({'median': 5_000, 'small': 8}))
        self.assertFalse(passes_bar({'median': 99_000, 'small': 7}))

    def test_off_topic(self):   # 블랙 스완 → BTS, 집중력 → study music (verification n2)
        d = {'top': [{'title': 'BTS (방탄소년단) Black Swan Official MV'}, {'title': '공부할 때 듣는 피아노 음악 3시간'},
                     {'title': '집중력 높이는 플레이리스트'}, {'title': '블랙 스완 책 리뷰'}, {'title': None}]}
        self.assertEqual(off_topic(d), 3)


if __name__ == '__main__':
    unittest.main()
