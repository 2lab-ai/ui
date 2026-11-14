"""python -m unittest explainer/tools/test_ko_say.py"""
import os, sys, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ko_say import check_say, check_script, leftovers, native, sino, spoken, strip_tags, to_say  # noqa: E402

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
        self.assertEqual(to_say('1500년대로'), '천오백 년대로')
        self.assertEqual(to_say('100퍼센트라고'), '백 퍼센트라고')

    def test_irregular_months(self):
        self.assertEqual(to_say('2018년 6월 마지막 주'), '이천십팔 년 유월 마지막 주')
        self.assertEqual(to_say('그해 10월, 그는'), '그해 시월, 그는')
        self.assertEqual(to_say('8월과 12월'), '팔 월과 십이 월')
        self.assertEqual(to_say('6개월 뒤'), '육 개월 뒤')     # 개월 is a duration, read as written
        self.assertEqual(to_say('10월에'), '시월에')
        self.assertEqual(to_say('16월'), '십육 월')           # only 6 and 10 change
        self.assertEqual(to_say('언제냐고요? 6월요.'), '언제냐고요? 유월요.')
        self.assertEqual(to_say('-6월'), '마이너스 육 월')      # a sign keeps the plain reading

    def test_particles_stay_attached(self):
        self.assertEqual(to_say('0에서 위로'), '영에서 위로')
        self.assertEqual(to_say('1에 놓아'), '일에 놓아')
        self.assertEqual(to_say('90도 돌아가요'), '구십도 돌아가요')
        self.assertEqual(to_say('2분의 1 더하기 6분의 1'), '이분의 일 더하기 육분의 일')

    def test_signs_and_fractions(self):
        self.assertEqual(to_say('-1'), '마이너스 일')
        self.assertEqual(to_say('-2.5원'), '마이너스 이 쩜 오 원')
        self.assertEqual(to_say('3-1'), '삼 빼기 일')
        self.assertEqual(to_say('1/2'), '이분의 일')

    def test_counter_must_end_its_word(self):
        # review of #45: 개월/달러/개국 are not 개/달 and a counter never reaches across a space
        self.assertEqual(to_say('5개월'), '오 개월')
        self.assertEqual(to_say('5달러'), '오 달러')
        self.assertEqual(to_say('3개국'), '삼 개국')
        self.assertEqual(to_say('숫자 2 대신 3을'), '숫자 이 대신 삼을')
        self.assertEqual(to_say('1번지'), '일 번지')
        self.assertEqual(to_say('2번 곱하면'), '두 번 곱하면')
        self.assertEqual(to_say('3바퀴를'), '세 바퀴를')
        self.assertEqual(to_say('2배로'), '두 배로')

    def test_ordinals_hundreds_codes_and_hangul_before_digits(self):
        self.assertEqual(to_say('1번째'), '첫 번째')
        self.assertEqual(to_say('11번째'), '열한 번째')
        self.assertEqual(to_say('101개'), '백한 개')
        self.assertEqual(to_say('120개'), '백스무 개')
        self.assertEqual(to_say('007'), '영영칠')
        self.assertEqual(to_say('제1장'), '제일장')
        self.assertEqual(to_say('총3개'), '총세 개')

    def test_what_it_cannot_read_is_left_for_the_check(self):
        for raw in ['3:00', '2=2', '1~2개', 'x^2']:
            with self.assertRaises(ValueError): check_say(to_say(raw, {'x': '엑스'}))
        with self.assertRaises(ValueError): to_say('10000000000000000')


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


class Directions(unittest.TestCase):
    """Drama 3 directions go to the voice model as written; the words between them are converted; the timeline and
    the hearing check get the words alone (2026-11-14)."""
    def test_dir_and_inline_tags(self):
        s = {'text': '그런데 2024년에는 12만 명이 넘었어요.', 'dir': 'excited, can\'t hide it',
             'tts': '그런데 2024년에는 12만 명이 넘었어요! [sighs] <soft>정말요</soft>.'}
        out = spoken(s, {})
        self.assertTrue(out.startswith("[excited, can't hide it] 그런데 이천이십사"))
        self.assertIn('[sighs]', out); self.assertIn('<soft>정말요</soft>', out)
        self.assertNotIn('[', strip_tags(out)); self.assertNotIn('<', strip_tags(out))

    def test_spaces_around_tags_survive(self):
        out = spoken({'text': '오빠, 안녕. 나예요.', 'tts': '오빠, 안녕. [laughs softly] 나예요.'}, {})
        self.assertEqual(out, '오빠, 안녕. [laughs softly] 나예요.')

    def test_check_script_ignores_tags(self):
        check_script({'scenes': [{'id': 'a', 'sentences': [{'text': '안녕.', 'dir': 'warm, smiling'}]}]}, {})

    def test_latin_outside_tags_still_stops(self):
        with self.assertRaises(SystemExit):
            check_script({'scenes': [{'id': 'a', 'sentences': [{'text': 'x', 'tts': '[soft] hello 안녕'}]}]}, {})

    def test_bracket_in_text_still_stops(self):
        # a bracket in plain text would reach Drama 3 as a direction and never be said (PR #69 review)
        with self.assertRaises(SystemExit):
            check_script({'scenes': [{'id': 'a', 'sentences': [{'text': '오늘의 책은 [아주 작은 습관의 힘]이에요.'}]}]}, {})

    def test_tag_splitting_number_and_counter_stops(self):
        with self.assertRaises(SystemExit):
            check_script({'scenes': [{'id': 'a', 'sentences': [
                {'text': '하루에 2번이나 잊었어요.', 'tts': '하루에 <emphasis>2</emphasis>번이나 잊었어요.'}]}]}, {})
        check_script({'scenes': [{'id': 'a', 'sentences': [
            {'text': '하루에 2번이나 잊었어요.', 'tts': '하루에 <emphasis>2번</emphasis>이나 잊었어요.'}]}]}, {})
        self.assertIn('<emphasis>두 번</emphasis>', spoken({'text': '2번', 'tts': '<emphasis>2번</emphasis>'}, {}))

    def test_paired_tag_keeps_the_word_whole(self):
        self.assertEqual(strip_tags('<emphasis>정신</emphasis>을 차려 보니'), '정신을 차려 보니')
        self.assertEqual(strip_tags('안녕. [laughs softly] 나예요.'), '안녕. 나예요.')

    def test_tts_words_must_match_text(self):
        with self.assertRaises(SystemExit):
            check_script({'scenes': [{'id': 'a', 'sentences': [{'text': '새 문장이에요.', 'tts': '[soft] 옛 문장이에요.'}]}]}, {})


if __name__ == '__main__':
    unittest.main()
