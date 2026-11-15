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


# the 총균쇠 cast (2026-11-15), as the Gate C reviewers saw it
CAST = {'yali': {'name': '얄리', 'hair': 'curly'}, 'diamond': {'name': '다이아몬드', 'hair': 'bald', 'beard': True},
        'oppa': {'name': '오빠', 'hair': 'short', 'glasses': 'square'}, 'zhenghe': {'name': '정화', 'hair': 'bun', 'mustache': True},
        'pizarro': {'name': '피사로', 'hair': 'short', 'beard': True, 'hat': 'morion'},
        'atahuallpa': {'name': '아타우알파', 'hair': 'short', 'hat': 'crown'}}


def fig(cid=None, crowd=False, **look):
    return {'id': cid, 'crowd': crowd, 'sig': '', 'look': {'hair': None, 'hat': None, 'beard': False, 'glasses': False, **look}}


def lookalike(*people, budget=True):
    return [(s, d) for s, c, d in L.judge(frame(people=list(people), budget=budget), cast=CAST) if c == 'cast-lookalike']


class Lookalike(unittest.TestCase):
    """an unnamed figure with a cast look's silhouette reads as that person: the run's most common Gate C P1"""
    def test_gate_c_cases(self):
        for f, who in [(fig(crowd=True, hair='curly'), '얄리'),                                  # foragers read as Yali
                       (fig(hair='curly', beard=True), '얄리'),                                  # a beard added does not help
                       (fig(hair='bald', beard=True, hat='crown'), '다이아몬드'),                 # the ruler read as Diamond
                       (fig(beard=True, hat='crown'), '다이아몬드'),                              # no hair is bald
                       (fig(hair='side', glasses=True), '오빠'),                                 # the scholar read as 오빠
                       (fig(crowd=True, hair='bun'), '정화'),                                    # a crowd bun read as 정화
                       (fig(hair='side', hat='beanie'), '정화'),                                 # Columbus's beanie
                       (fig(hair='side', hat='crown', mustache=True), '아타우알파')]:              # a crowned extra with his hair
            got = lookalike(f)
            self.assertEqual(len(got), 1, (f, got)); self.assertEqual(got[0][0], 'P1'); self.assertIn(who, got[0][1])

    def test_a_different_head_is_fine(self):
        for f in [fig(crowd=True), fig(hair='curly', hat='cap'),             # plain; a cap hides the curls (a beanie is 정화's knob)
                  fig(hat='crown', mustache=True), fig(hair='spiky', hat='crown'),   # crowned, unlike 아타우알파 and Diamond
                  fig(hair='short'), fig(hair='short', beard=True),          # no glasses: not 오빠; no morion: not 피사로
                  fig('yali', hair='curly')]:                                # the cast member himself
            self.assertEqual(lookalike(f), [], f)

    def test_colour_projects_get_a_p2(self):   # an accent colour may still tell them apart
        self.assertEqual(lookalike(fig(hair='curly'), budget=False)[0][0], 'P2')

    def test_cast_similar(self):
        self.assertEqual(L.cast_similar({'col': {'hair': 'side', 'hat': 'beanie'}, 'zh': {'hair': 'bun', 'mustache': True}}), [('col', 'zh')])
        self.assertEqual(L.cast_similar({'musk': {'hair': 'short'}, 'viewer': {'hair': 'side'}}), [('musk', 'viewer')])
        self.assertEqual(L.cast_similar({'king': {'hair': 'bald', 'beard': True, 'hat': 'crown'}, 'd': {'hair': 'bald', 'beard': True}}), [('king', 'd')])
        self.assertEqual(L.cast_similar({'k1': {'hair': 'bald', 'hat': 'crown'}, 'k2': {'hair': 'curly', 'hat': 'crown'}}), [])   # the hair shows
        self.assertEqual(L.cast_similar({'oppa': CAST['oppa'], 'musk': {'hair': 'short'}, 'piz': CAST['pizarro'],
                                         'cortes': {'hair': 'spiky', 'mustache': True, 'hat': 'morion'}}), [])


class LongHold(unittest.TestCase):
    def test_draft_timeline_holds_are_judged_shorter(self):   # five 8.1-8.4 s holds appeared only on the voice
        self.assertAlmostEqual(L.hold_limit({'voice': 'draft'}), 8 / 1.2)
        self.assertEqual(L.hold_limit({'voice': 'cwon'}), 8.0); self.assertEqual(L.hold_limit({}), 8.0)


class EngineSource(unittest.TestCase):
    """A statement written after a trailing // comment is dead code: twice an edit appended a comment to a line and
    swallowed the registrations after it (docent.js 2026-11-13: a SyntaxError, then figs/mouths silently gone)."""
    def test_no_statement_after_a_trailing_comment(self):
        import re
        code = re.compile(r'\b[A-Za-z_$][\w$.]*\.push\(|\);\s*[A-Za-z_$][\w$.]*(\.[\w$]+)+\(')
        bad = []
        for rel in ('engine/docent.js', 'engine/engine.js', 'noderender/page.js'):
            for i, line in enumerate(open(os.path.join(HERE, '..', rel), encoding='utf-8'), 1):
                m = re.search(r'(?<![:\'"])//(?![\'"])', line)
                if m and line[:m.start()].strip() and code.search(line[m.end():]): bad.append(f'{rel}:{i}')
        self.assertEqual(bad, [], 'code after a trailing // comment never runs: put the comment on its own line')


if __name__ == '__main__':
    unittest.main()
