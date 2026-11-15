"""The lint checks added after research run 4 (2026-11-15): cover-late, crowd-row, letter-cast, and lint_scenes.py's
--timeline and --help. Pure checks on synthetic reports, then the real lint on a tiny fixture project (Node + Skia,
noderender/; skipped when node or @napi-rs/canvas is not installed: npm install in explainer/noderender)."""
import json, os, shutil, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
EX = os.path.dirname(HERE)
sys.path.insert(0, HERE)
_cwd = os.getcwd(); os.chdir(tempfile.mkdtemp())   # export.py makes ./out on import
import lint_scenes as L  # noqa: E402
os.chdir(_cwd)
from test_budget_engine import node_ok  # noqa: E402

PY = sys.executable


class CoverLate(unittest.TestCase):
    def test_times(self):   # the shot's start + 0.8 s and each sentence start inside it + 0.8 s, inside the shot only
        self.assertEqual(L.cover_times(10.0, 20.0, [5.0, 10.3, 14.0, 19.5]), [10.8, 11.1, 14.8])
        self.assertEqual(L.cover_times(10.0, 10.5, [10.0]), [])   # a shot shorter than 0.8 s is not judged

    def test_late(self):
        self.assertEqual(L.cover_late([['cover_a_en', 1.0], ['cover_a_ko', 0.95]]), [])
        got = L.cover_late([['cover_a_en', 1.0], ['cover_a_ko', 0.5]])
        self.assertEqual([(s, c) for s, c, _ in got], [('P1', 'cover-late')])
        self.assertIn('cover_a_ko', got[0][2]); self.assertNotIn('cover_a_en', got[0][2])
        self.assertEqual(L.cover_late(None), [])


# ---- the real lint on a fixture project ----
FIXTURE = r"""
TITLE_CARD = signCard;
cast('me', { name: '나', hair: 'long', h: 0.94 });
SCENES.a = (t, q) => shots(t, [
  // the old template's timing: the pair over 2 s, so the Korean cover is still fading 0.8 s in
  [q.s(0), (t, lt) => { person('me', 560, 870, { s: 1.5, pose: 'present', face: 'happy', p: dp(lt, 0, 0.5) });
                        realCoverPair('cover_x_en', 'cover_x_ko', 1250, 860, 420, { p: dp(lt, 0, 2.0) }); }],
  // on time: whole by p 0.6
  [q.s(1), (t, lt) => { const f = person('me', 560, 870, { s: 1.5, pose: 'showBook', face: 'happy', p: dp(lt, 0, 0.5) });
                        holdCover(f, 'cover_x_ko', { h: 280, p: dp(lt, 0, 0.5) }); }],
]);
"""


def write(path, obj):
    with open(path, 'w', encoding='utf-8') as f:
        if isinstance(obj, str): f.write(obj)
        else: json.dump(obj, f, ensure_ascii=False)


def read(path):
    with open(path, encoding='utf-8') as f: return json.load(f)


def fixture(scenes=FIXTURE, project=None, sentences=('가' * 40, '나' * 40)):
    """a sketch project in ink mode with a draft timeline and two cover images: (dir)"""
    import new_video, timeline_draft
    from PIL import Image
    d = tempfile.mkdtemp()
    for f in ('engine.js', 'docent.js', 'video.html'): shutil.copy(os.path.join(EX, 'engine', f), d)
    th = new_video.theme('sketch'); write(os.path.join(d, 'theme.json'), {k: v for k, v in th.items() if k != 'fontFiles'})
    os.makedirs(os.path.join(d, 'img'))
    for n in ('cover_x_en', 'cover_x_ko'): Image.new('RGB', (68, 100), (120, 40, 40)).save(os.path.join(d, 'img', n + '.jpg'))
    write(os.path.join(d, 'project.json'), {'slug': 'fx', 'theme': 'sketch', 'colour': False, 'subtitles': 'off', 'chip': False,
                                            'images': ['cover_x_en', 'cover_x_ko'], **(project or {})})
    script = {'title': 'fx', 'scenes': [{'id': 'a', 'title': 'a', 'sentences': [{'text': s} for s in sentences]}]}
    write(os.path.join(d, 'script.json'), script)
    write(os.path.join(d, 'timeline.json'), timeline_draft.draft(script))
    write(os.path.join(d, 'scenes.js'), scenes)
    return d


def lint(d, *args):
    env = dict(os.environ, PYTHONPATH=os.path.join(EX, 'noderender', 'shim'), NODE_PATH=os.path.join(EX, 'noderender', 'node_modules'))
    p = subprocess.run([PY, os.path.join(HERE, 'lint_scenes.py'), *args], cwd=d, env=env, capture_output=True, text=True, timeout=300)
    out = os.path.join(d, 'out', 'lint.json')
    return p, (read(out) if os.path.exists(out) else None)


def issues(rep):
    return [(f['scene'], f['t'], s, c) for f in rep['frames'] for s, c, _ in f['issues']]


@unittest.skipUnless(node_ok(), 'node or @napi-rs/canvas missing (npm install in explainer/noderender)')
class OnFixture(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.d = fixture()
        cls.p, cls.rep = lint(cls.d)

    def test_cover_late_on_the_slow_pair_only(self):
        tl = read(os.path.join(self.d, 'timeline.json'))
        s0, s1 = [x['start'] for x in tl['scenes'][0]['sentences']]
        late = [(t, s) for sc, t, s, c in issues(self.rep) if c == 'cover-late']
        self.assertTrue(late, issues(self.rep))
        self.assertTrue(all(s == 'P1' and s0 <= t < s1 for t, s in late), late)   # the first shot only, not the held cover
        self.assertEqual(self.p.returncode, 1)
        self.assertFalse([c for sc, t, s, c in issues(self.rep) if s == 'P0'], issues(self.rep))   # the fixture itself is sound
