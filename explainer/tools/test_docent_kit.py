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

    def test_covers_report_their_opacity(self):   # lint cover-late reads docentReport().covers
        probe = """(p) => { DOCENT_FRAME(0); realCoverPair('cover_a', 'cover_b', 960, 800, 400, { p }); return docentReport().covers; }"""
        self.assertEqual(self.run_js(probe, 0.6), [['cover_a', 1], ['cover_b', 1]])
        a, b = self.run_js(probe, 0.3)
        self.assertLess(b[1], 0.9); self.assertEqual(self.run_js(probe, 0.1)[1:], [])   # B not started: not drawn, not listed

    def test_people_carry_their_height_and_whether_the_scene_drew_them(self):   # lint crowd-row
        probe = """() => { DOCENT_FRAME(0); figure(300, 870, { s: 1, crowd: true }); person('me', 700, 870, { s: 1.5 });
          bubble(1100, 200, 400, 300, { tail: [700, 400], body: (x, y, w, h) => figure(x + w / 2, y + h - 20, { s: 0.4 }) });
          return docentReport().people.map((p) => [p.top, p.hpx]); }"""
        (t1, h1), (t2, h2), (t3, h3) = self.run_js(probe)
        self.assertEqual((t1, t2, t3), (True, True, False))   # the figure inside a bubble's picture is not the scene's
        self.assertAlmostEqual(h1, 338, delta=12); self.assertAlmostEqual(h2, 1.5 * 0.94 * 360, delta=25)
        night = """() => { DOCENT_FRAME(0); letterNight({}); return docentReport().people.map((p) => p.top); }"""
        self.assertEqual(self.run_js(night), [False])   # a letter place's own person

    def test_animal_passes_its_own_options(self):   # run 4: run: 1 and mood: 'sad' never reached the drawing
        probe = """() => { ANIMALS.__probe = (T, o, q) => { globalThis.__seen = { ...o }; return { head: T(0, -100), r: 20, mouth: T(10, -90), top: T(0, -120) }; };
          DOCENT_FRAME(0); animal('__probe', 900, 800, { s: 2, dir: -3, run: 1, mood: 'sad', banana: true, t: 1.5, p: 0.5 });
          const seen = globalThis.__seen; delete ANIMALS.__probe; return seen; }"""
        o = self.run_js(probe)
        self.assertEqual((o['run'], o['mood'], o['banana'], o['t']), (1, 'sad', True, 1.5))
        self.assertEqual((o['s'], o['dir'], o['p']), (2, -1, 0.5))           # the computed ones still win
        self.assertAlmostEqual(o['w'], 4 * 2 ** 0.5, places=3)

    def test_hold_cover_beside_the_body_never_over_the_face(self):
        probe = """([flip, pose, side]) => { DOCENT_FRAME(0); const f = person('me', 960, 870, { s: 1.5, pose, flip });
          const b = holdCover(f, 'cover_a', { h: 280, side }); const r = docentReport();
          return { b, head: f.head, r: f.r, hand: f.hands[side === 'back' ? 0 : 1], things: r.things, partial: r.partial }; }"""
        for flip in (False, True):
            for pose, side in (('showBook', 'front'), ('stand', 'front'), ('cheer', 'back')):
                r = self.run_js(probe, [flip, pose, side])
                b, (hx, hy), R = r['b'], r['head'], r['r']
                out = (-1 if flip else 1) * (-1 if side == 'back' else 1)
                self.assertAlmostEqual(b['h'], 280)
                beside = b['y'] < hy + R * 1.3 and b['y'] + b['h'] > hy - R * 1.3
                if beside: self.assertTrue(b['x'] >= hx + R * 1.39 if out > 0 else b['x'] + b['w'] <= hx - R * 1.39, (flip, pose, b))
                self.assertGreater((b['x'] + b['w'] / 2 - hx) * out, 0, (flip, pose))   # on the hand's side of the body
                if pose == 'showBook':   # the hand on the cover's inner edge: it is held, not floating beside her
                    self.assertLessEqual(b['x'] - 2, r['hand'][0]); self.assertLessEqual(r['hand'][0], b['x'] + b['w'] + 2)
                    self.assertTrue(b['y'] < r['hand'][1] < b['y'] + b['h'])
                self.assertEqual(r['partial'], [])
                self.assertEqual(sorted(t.split('#')[0] for t in r['things']), ['book', 'person'])   # one thing, as realCover


if __name__ == '__main__':
    unittest.main()
