"""Tests for the emphasis-budget checks of lint_scenes.judge() (REFERENCE.md §0) — synthetic frame reports, no browser."""
import os, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
_cwd = os.getcwd(); os.chdir(tempfile.mkdtemp())   # export.py makes ./out on import
import lint_scenes as L  # noqa: E402
os.chdir(_cwd)


def frame(**kw):
    r = {'partial': [], 'ghost': [], 'zone': [], 'off': [], 'empty': [], 'tailFar': [], 'tailHigh': [], 'cover': [],
         'overflow': [], 'rig': [], 'people': [], 'wordy': [], 'propFace': [], 'ink': [600, 300, 1300, 880],
         'textBig': False, 'figures': 1, 'things': [], 'words': [], 'marks': [], 'colours': [], 'budget': True}
    r.update(kw); return r


def codes(r): return {(s, c) for s, c, _ in L.judge(r)}


class Budget(unittest.TestCase):
    def test_reference_like_frame_is_clean(self):   # a figure and one word, nothing else
        self.assertEqual(codes(frame(things=['person#0', 'word#1'], words=['빌려준 시간'])), set())

    def test_busy(self):
        self.assertIn(('P2', 'busy'), codes(frame(things=['person#0', 'person#1', 'bubble#2', 'prop:clock'])))
        self.assertIn(('P1', 'busy'), codes(frame(things=['person#0', 'person#1', 'bubble#2', 'prop:clock', 'word#4'])))

    def test_words(self):
        self.assertIn(('P2', 'words'), codes(frame(words=['tag:세네카', '시간'])))
        self.assertIn(('P1', 'words'), codes(frame(words=['1971', '태어남', '1995'])))

    def test_marks(self):
        self.assertNotIn(('P1', 'marks'), codes(frame(marks=['cross'])))
        self.assertIn(('P1', 'marks'), codes(frame(marks=['cross', 'ring'])))

    def test_colour(self):
        self.assertIn(('P2', 'colour'), codes(frame(colours=['#d9661c'])))

    def test_not_in_colour_projects(self):   # older and make-3b1b projects are not held to the budget
        self.assertEqual(codes(frame(budget=False, words=['a', 'b', 'c'], marks=['cross', 'ring'])), set())

    def test_list(self):
        self.assertIn(('P2', 'list'), codes(frame(listItems=4)))

    def test_bottom_heavy_is_gone(self):   # an empty top is the reference's default, not a defect
        self.assertEqual(codes(frame(ink=[700, 480, 1200, 880], figures=1, things=['person#0'])), set())


if __name__ == '__main__':
    unittest.main()
