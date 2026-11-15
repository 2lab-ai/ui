"""The docent kit on the real engine (docent.js on Node + Skia, noderender/): the real covers' timing, the held cover,
animal() options and the assets harvested from the run-4 probes (research 2026-11-15). Skipped when node or
@napi-rs/canvas is not installed (npm install in explainer/noderender)."""
import json, os, shutil, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
EX = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from test_budget_engine import node_ok, evaluate  # noqa: E402

SCENES = r"""
cast('me', { name: '나', hair: 'long', h: 0.94 });
SCENES.s = (t, q) => shots(t, [[0.0, (t, lt) => person('me', 600, 870, {})]]);
"""


@unittest.skipUnless(node_ok(), 'node or @napi-rs/canvas missing (npm install in explainer/noderender)')
class Kit(unittest.TestCase):
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

    def run_js(self, expr, arg=None):
        return evaluate(self.proj, expr, arg, False)

    def test_cover_pair_is_whole_by_p_0_6(self):   # run 4: the Korean cover was a grey ghost at the shot's start + 0.8 s
        probe = """(p) => { DOCENT_FRAME(0); realCoverPair('cover_a', 'cover_b', 960, 800, 400, { p }); return DOCENT.partial; }"""
        self.assertEqual(self.run_js(probe, 0.6), [])
        self.assertEqual(self.run_js(probe, 1.0), [])
        self.assertEqual(self.run_js(probe, 0.45), ['cover:cover_b'])   # A is whole, B still drawing
        self.assertEqual(sorted(self.run_js(probe, 0.3)), ['cover:cover_a', 'cover:cover_b'])


if __name__ == '__main__':
    unittest.main()
