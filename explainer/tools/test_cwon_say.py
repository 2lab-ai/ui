"""python -m unittest explainer/tools/test_cwon_say.py   (no GPU, no audio)"""
import os, sys, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cwon_say import plan, sentences, words_off  # noqa: E402

LEX = {'Claude': '클로드', 'GitHub': '기터브', 'PR': '피알', '회의': '훼이'}


class Split(unittest.TestCase):
    def test_sentences(self):
        self.assertEqual(sentences('첫 문장. 둘째? 셋째!\n넷째 줄\n\n다섯… 끝'), ['첫 문장.', '둘째?', '셋째!', '넷째 줄', '다섯…', '끝'])
        self.assertEqual(sentences('2.71원이에요. 다음'), ['2.71원이에요.', '다음'])   # a decimal point does not split


class Plan(unittest.TestCase):
    def test_spoken_form_with_lexicon(self):
        rows, bad, missing = plan('Claude가 GitHub에 PR 3개를 올렸어요! 회의는 3시에, 2.71원.', LEX)
        self.assertEqual([r[1] for r in rows], ['클로드가 기터브에 피알 세 개를 올렸어요!', '훼이는 세 시에, 이 쩜 칠 일 원.'])
        self.assertEqual((bad, missing), ({}, []))

    def test_missing_latin_words_are_listed_not_guessed(self):
        rows, bad, missing = plan('Claude가 Slack에 올렸어요. 괜찮아요.', {'Claude': '클로드'})
        self.assertEqual(list(bad), [0])
        self.assertEqual(missing, ['Slack'])

    def test_unreadable_symbols_stop_the_run(self):
        _rows, bad, _missing = plan('회의는 3:00에 해요. 1~2개 주세요.', {})
        self.assertEqual(sorted(bad), [0, 1])


class Check(unittest.TestCase):
    def test_numbers_heard_as_digits_match(self):
        self.assertEqual(words_off('하루마다 주면 이 쩜 칠 일 원이 됩니다.', '하루마다 주면 2.71원이 됩니다.')[0], 1.0)
        self.assertEqual(words_off('정답률은 구십팔 쩜 오 퍼센트였습니다.', '정답률은 98.5%였습니다.')[0], 1.0)

    def test_a_misheard_word_is_named(self):
        ratio, off = words_off('회의는 세 시에 시작해요.', '네이는 3시에 시작해요')
        self.assertLess(ratio, 0.9)
        self.assertEqual(off, ['회의는'])

    def test_a_respelling_counts_as_what_was_meant(self):
        ratio, off = words_off('훼이는 세 시에 시작해요.', '회의는 3시에 시작해요.', LEX, meant='회의는 세 시에 시작해요.')
        self.assertEqual((ratio, off), (1.0, []))
        self.assertEqual(words_off('클로드가 기터브에 피알 세 개를 올렸어요!', '클로드가 GitHub에 PR 3개를 올렸어요.', LEX)[0], 1.0)


if __name__ == '__main__':
    unittest.main()
