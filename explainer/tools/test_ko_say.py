"""python -m unittest explainer/tools/test_ko_say.py"""
import os, sys, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ko_say import check_say, leftovers, native, sino, to_say  # noqa: E402

LEX = {'e': '이', 'i': '아이', 'Euler': '오일러'}


class Numbers(unittest.TestCase):
    def test_sino(self):
        for n, s in [(0, '영'), (1, '일'), (10, '십'), (11, '십일'), (100, '백'), (1748, '천칠백사십팔'), (1500, '천오백'),
                     (10000, '만'), (12000, '만이천'), (21000, '이만천'), (100000000, '일억'), (3005, '삼천오')]:
            self.assertEqual(sino(n), s, n)

    def test_native(self):
        for n, s in [(1, '한'), (2, '두'), (3, '세'), (4, '네'), (14, '열네'), (20, '스무'), (21, '스물한'), (99, '아흔아홉')]:
            self.assertEqual(native(n), s, n)
        with self.assertRaises(ValueError): native(100)

    def test_decimal_point_is_jjeom_and_digits_are_words(self):
        self.assertEqual(to_say('2.71원'), '이 쩜 칠 일 원')
        self.assertEqual(to_say('2.25원이 돼요'), '이 쩜 이 오 원이 돼요')
        self.assertEqual(to_say('3.14159, 끝이 없다'), '삼 쩜 일 사 일 오 구, 끝이 없다')
        self.assertEqual(to_say('점은 2.718에 도착'), '점은 이 쩜 칠 일 팔에 도착')
        self.assertEqual(to_say('0.05초'), '영 쩜 영 오 초')
        self.assertEqual(to_say('12.5퍼센트'), '십이 쩜 오 퍼센트')

    def test_counters(self):
        self.assertEqual(to_say('1748년, 오일러'), '천칠백사십팔 년, 오일러')
        self.assertEqual(to_say('1년 뒤면 2원이죠'), '일 년 뒤면 이 원이죠')
        self.assertEqual(to_say('20세기에'), '이십 세기에')
        self.assertEqual(to_say('2번 곱하면'), '두 번 곱하면')
        self.assertEqual(to_say('20살'), '스무 살')
        self.assertEqual(to_say('1시간'), '한 시간')
        self.assertEqual(to_say('3바퀴'), '세 바퀴')
        self.assertEqual(to_say('100퍼센트'), '백 퍼센트')
        self.assertEqual(to_say('100%'), '백 퍼센트')
        self.assertEqual(to_say('12,000원'), '만이천 원')

    def test_particles_stay_attached(self):
        self.assertEqual(to_say('0에서 위로'), '영에서 위로')
        self.assertEqual(to_say('1에 놓아'), '일에 놓아')
        self.assertEqual(to_say('90도 돌아가요'), '구십도 돌아가요')
        self.assertEqual(to_say('2분의 1 더하기 6분의 1'), '이분의 일 더하기 육분의 일')

    def test_signs_and_fractions(self):
        self.assertEqual(to_say('-1'), '마이너스 일')
        self.assertEqual(to_say('1/2'), '이분의 일')


class Letters(unittest.TestCase):
    def test_lexicon(self):
        self.assertEqual(to_say('e 위에 i를 올리면', LEX), '이 위에 아이를 올리면')
        self.assertEqual(to_say('Euler는 e를', LEX), '오일러는 이를')
        self.assertEqual(to_say('π만큼', LEX), '파이만큼')

    def test_unknown_latin_is_an_error_not_a_guess(self):
        say = to_say('x를 구하면', LEX)
        self.assertEqual(leftovers(say), ['x'])
        with self.assertRaises(ValueError): check_say(say, 'sc:0')

    def test_check_passes_hangul_and_punctuation(self):
        self.assertEqual(check_say("이 쩜 칠 일 원, '허수 번'… 정말?"), "이 쩜 칠 일 원, '허수 번'… 정말?")
        for raw in ['2.71원', 'e를', '1+1', 'x=2']:
            with self.assertRaises(ValueError): check_say(raw)


if __name__ == '__main__':
    unittest.main()
