"""The emphasis-budget counts measured on the real engine (docent.js), not on synthetic reports: words and red marks
drawn inside other primitives count, a bubble's speech and a prop's own lettering do not, a list's items are counted,
ink mode strips colours only in a project with "colour": false. Runs the engine on Node + Skia (noderender/); skipped
when node or @napi-rs/canvas is not installed (npm install in explainer/noderender)."""
import json, os, shutil, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
EX = os.path.dirname(HERE)
sys.path.insert(0, HERE)
PAGE = os.path.join(EX, 'noderender', 'page.js')


def node_ok():
    if not shutil.which('node'): return False
    env = dict(os.environ, NODE_PATH=os.path.join(EX, 'noderender', 'node_modules'))
    return subprocess.run(['node', '-e', "require('@napi-rs/canvas')"], cwd=os.path.join(EX, 'noderender'), env=env, capture_output=True).returncode == 0


SCENES = r"""
cast('a', { name: '갑', hair: 'short', outfit: 'suit', accent: 'red' });
SCENES.s = (t, q) => shots(t, [
  [0.0, (t, lt) => { const v = person('a', 700, 880, {}); think(v, null, { w: 400, h: 240, body: (x, y) => hand('내 판단', x + 200, y + 120, { size: 60 }) }); }],
  [2.0, (t, lt) => { const v = person('a', 700, 880, {}); say(v, '말풍선은 단어가 아님'); prop('calendar', 1300, 860, 1.2, { label: '월' }); }],
  [4.0, (t, lt) => { scrollList(600, 150, 600, '규칙', ['하나', '둘', '셋', '넷'], { mark: [2] }); }],
  [6.0, (t, lt) => { inkPath([[300, 300], [600, 700]], { color: MARK(), w: 6 }); cross(900, 300, 200, 200); }],
  [8.0, (t, lt) => { hand('나', 500, 400); hand('너', 900, 400); hand('우리', 1300, 400); }],
]);
"""


def report(proj, t, colour, before=None):
    pj = {'slug': 't', 'theme': 'sketch'}
    if colour is not None: pj['colour'] = colour
    json.dump(pj, open(os.path.join(proj, 'project.json'), 'w'))
    env = dict(os.environ, NODE_PATH=os.path.join(EX, 'noderender', 'node_modules'))
    msg = json.dumps({'id': 1, 'expr': '(t) => { renderAt(t); return docentReport(); }', 'arg': t})
    if before is not None:   # render another frame first, in the same page: counts must not carry over
        msg = json.dumps({'id': 0, 'expr': '(t) => { renderAt(t); return 0; }', 'arg': before}) + '\n' + msg
    out = subprocess.run(['node', PAGE, proj], input=msg + '\n', capture_output=True, text=True, env=env, timeout=60).stdout.splitlines()
    rep = [json.loads(l) for l in out if l.startswith('{')][-1]
    assert 'value' in rep, rep
    return rep['value']


@unittest.skipUnless(node_ok(), 'node or @napi-rs/canvas missing (npm install in explainer/noderender)')
class BudgetOnEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import new_video
        cls.proj = tempfile.mkdtemp()
        for f in ('engine.js', 'docent.js', 'video.html'): shutil.copy(os.path.join(EX, 'engine', f), cls.proj)
        th = new_video.theme('sketch'); json.dump({k: v for k, v in th.items() if k != 'fontFiles'}, open(os.path.join(cls.proj, 'theme.json'), 'w'))
        sents = [{'text': '가', 'start': 0.1, 'end': 9.5, 'dur': 9.9}]
        json.dump({'total': 10, 'scenes': [{'id': 's', 'chip': '1', 'title': 't', 'subtitle': '', 'start': 0, 'lead': 0, 'dur': 10,
                                            'sentences': sents, 'words': []}]}, open(os.path.join(cls.proj, 'timeline.json'), 'w'))
        open(os.path.join(cls.proj, 'scenes.js'), 'w').write(SCENES)

    def test_word_inside_a_thought_and_speech_count_prop_lettering_does_not(self):
        self.assertEqual(report(self.proj, 1.5, False)['words'], ['내 판단'])
        self.assertEqual(report(self.proj, 3.5, False)['words'], ['말풍선은 단어가 아님'])   # not the calendar's own label

    def test_budget_only_in_ink_mode(self):
        self.assertTrue(report(self.proj, 1.5, False)['budget']); self.assertFalse(report(self.proj, 1.5, None)['budget'])

    def test_list_items_and_a_mark_inside_the_list(self):
        r = report(self.proj, 5.5, False)
        self.assertEqual(r['listItems'], 4); self.assertEqual(r['marks'], ['ring'])

    def test_counts_reset_every_frame(self):
        self.assertEqual(report(self.proj, 9.5, False, before=5.5)['listItems'], 0)
        self.assertEqual(report(self.proj, 1.5, False, before=9.5)['words'], ['내 판단'])

    def test_hand_drawn_red_line_is_a_mark(self):
        self.assertEqual(sorted(report(self.proj, 7.5, False)['marks']), ['cross', 'red line'])

    def test_three_words(self):
        self.assertEqual(len(report(self.proj, 9.5, False)['words']), 3)

    def test_ink_mode_only_when_asked(self):
        ink, old = report(self.proj, 1.5, False), report(self.proj, 1.5, None)
        self.assertEqual(ink['colours'], [])        # the red suit paints as ink and page
        self.assertEqual(old['colours'], [])        # an older project: colours kept, and not reported (no ink mode)


class Srt(unittest.TestCase):
    def test_millisecond_rounding_carries(self):
        import export
        tmp = tempfile.mkdtemp(); cwd = os.getcwd()
        try:
            os.chdir(tmp)
            json.dump({'slug': 'x'}, open('project.json', 'w'))
            json.dump({'scenes': [{'sentences': [{'text': 'a', 'start': 1.8, 'end': 1.9996, 'dur': 0.4},
                                                 {'text': 'b', 'start': 59.9996, 'end': 3600.0004, 'dur': 1}]}]}, open('timeline.json', 'w'))
            export.HERE = tmp; export.OUT = os.path.join(tmp, 'out'); os.makedirs(export.OUT, exist_ok=True)
            export.srt()
            txt = open(os.path.join(export.OUT, 'x.srt')).read()
        finally:
            os.chdir(cwd)
        self.assertIn('00:00:01,800 --> 00:00:02,000', txt)
        self.assertIn('00:01:00,000 --> 01:00:00,000', txt)


if __name__ == '__main__':
    unittest.main()
