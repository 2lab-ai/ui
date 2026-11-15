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
    def test_time(self):   # once per shot, at its cut + 0.8 s (fix round F1: no per-sentence checks inside a shot)
        self.assertEqual(L.cover_time(10.0, 20.0, 3.0), 10.8)
        self.assertIsNone(L.cover_time(10.0, 10.5, 3.0))   # a shot shorter than 0.8 s is not judged
        self.assertEqual(L.cover_time(0.0, 9.0, 3.0), 3.4)  # cut inside the title card: judged 0.8 s after the body shows
        self.assertIsNone(L.cover_time(0.0, 3.2, 3.0))     # ... unless the shot ends before that
        self.assertEqual(L.cover_time(2.4, 9.0, 3.0), 3.4)  # cut in the lead: first seen at the first sentence (2.6)
        self.assertEqual(L.cover_time(3.0, 9.0, 3.0), 3.8)

    def test_late(self):
        rest = [['cover_a_en', 1.0], ['cover_a_ko', 1.0]]
        self.assertEqual(L.cover_late([['cover_a_en', 1.0], ['cover_a_ko', 0.95]], rest), [])
        got = L.cover_late([['cover_a_en', 1.0], ['cover_a_ko', 0.5]], rest)
        self.assertEqual([(s, c) for s, c, _ in got], [('P1', 'cover-late')])
        self.assertIn('cover_a_ko', got[0][2]); self.assertNotIn('cover_a_en', got[0][2])
        self.assertEqual(L.cover_late(None, None), []); self.assertEqual(L.cover_late([], []), [])

    def test_not_started_at_the_check_is_late(self):   # astra F1: a cover drawn from 1.2 s into its shot went unreported
        for at in ([], [['cover_a_ko', 0]]):   # not called yet, or called at p 0 (docent.js lists it at 0)
            got = L.cover_late(at, [['cover_a_ko', 1.0]])
            self.assertEqual([(s, c) for s, c, _ in got], [('P1', 'cover-late')]); self.assertIn('not drawn yet', got[0][2])
        self.assertEqual(L.cover_late([['cover_a_ko', 0.4]], []), [])   # gone by the rest frame: not this shot's cover
        self.assertEqual(L.cover_late([], [['cover_a_ko', 0]]), [])     # still at p 0 at rest: never shown


def frame(**kw):
    r = {'partial': [], 'ghost': [], 'zone': [], 'off': [], 'empty': [], 'tailFar': [], 'tailHigh': [], 'cover': [],
         'overflow': [], 'rig': [], 'people': [], 'wordy': [], 'propFace': [], 'ink': [200, 300, 1700, 880],
         'textBig': False, 'figures': 0, 'things': ['crowd'], 'words': [], 'marks': [], 'colours': [], 'budget': True}
    r.update(kw); return r


def crowd(n, hpx, top=True):
    return [{'id': None, 'crowd': True, 'sig': '', 'look': {}, 'hpx': hpx, 'top': top} for _ in range(n)]


class CrowdRow(unittest.TestCase):   # p04, p09, p10: six, five and eight small figures in a row
    def codes(self, r): return {(s, c) for s, c, _ in L.judge(r)}

    def test_five_small_people(self):
        self.assertIn(('P1', 'crowd-row'), self.codes(frame(people=crowd(5, 340))))   # s 1: about 32 % of 1080
        self.assertIn(('P1', 'crowd-row'), self.codes(frame(people=crowd(5, 340) + crowd(2, 600))))

    def test_not_a_crowd_row(self):
        self.assertNotIn(('P1', 'crowd-row'), self.codes(frame(people=crowd(4, 200))))            # four
        self.assertNotIn(('P1', 'crowd-row'), self.codes(frame(people=crowd(5, 400))))            # big: 37 %
        self.assertNotIn(('P1', 'crowd-row'), self.codes(frame(people=crowd(6, 200, top=False))))  # drawn inside a composite or bubble
        self.assertNotIn(('P1', 'crowd-row'), self.codes(frame(people=crowd(6, 200), budget=False)))   # colour projects: no budget

    def test_upright_frame(self):   # a Short: 35 % of 1920
        self.assertIn(('P1', 'crowd-row'), {(s, c) for s, c, _ in L.judge(frame(people=crowd(5, 600)), size=(1080, 1920))})


class LetterCast(unittest.TestCase):   # p08: 오빠 never cast, so Schrödinger's side hair + round glasses read as him
    def test_letter_without_oppa(self):
        got = L.letter_cast({'concept': 'letter'}, {'me': {'hair': 'long'}})
        self.assertEqual([(s, c) for s, c, _ in got], [('P2', 'letter-cast')]); self.assertIn("'oppa'", got[0][2])
        self.assertEqual(len(L.letter_cast({'concept': 'letter'}, {})), 2)

    def test_not_a_letter_or_cast(self):
        self.assertEqual(L.letter_cast({'concept': 'letter'}, {'me': {}, 'oppa': {}}), [])
        self.assertEqual(L.letter_cast({}, {}), []); self.assertEqual(L.letter_cast({'concept': 'docent'}, {}), [])

    def test_no_concept_in_ink_mode_is_a_letter(self):   # fable F3: CONCEPTS, no concept -> letter
        self.assertEqual(L.concept({'colour': False}), 'letter'); self.assertEqual(L.concept({'colour': False, 'concept': 'lecture'}), 'lecture')
        self.assertIsNone(L.concept({})); self.assertIsNone(L.concept({'colour': True})); self.assertIsNone(L.concept(None))   # older colour videos
        self.assertEqual([c for _, c, _ in L.letter_cast({'colour': False}, {'me': {}})], ['letter-cast'])
        self.assertEqual(L.letter_cast({'colour': False, 'concept': 'lecture'}, {}), [])


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
  // a row of five small strangers (crowd-row), then three big ones (fine)
  [q.s(1) + 2.0, (t, lt) => { for (let i = 0; i < 5; i++) figure(400 + i * 280, 870, { s: 1.0, crowd: true, face: 'neutral' }); }],
  [q.s(1) + 3.5, (t, lt) => { for (let i = 0; i < 3; i++) figure(560 + i * 400, 870, { s: 1.3, crowd: true, face: 'neutral' }); }],
  // late start (fix round F1): the cover is drawn from 1.2 s into its shot, so it is absent 0.8 s after the cut
  [q.s(2), (t, lt) => { person('me', 560, 870, { s: 1.5, pose: 'present', face: 'happy', p: dp(lt, 0, 0.5) });
                        realCover('cover_x_ko', 1300, 860, 420, { p: dp(lt, 1.2, 0.6) }); }],
]);
// a chapter with a 2.6 s title card whose one shot starts at the scene start: its cover is whole long before the scene
// body shows, and 0.8 s after the cut is still the title card (no scene drawn): not judged, not a false cover-late
SCENES.b = (t, q, sc) => shots(t, [
  [sc.start, (t, lt) => { const f = person('me', 560, 870, { s: 1.5, pose: 'showBook', face: 'happy', p: dp(lt, 0, 0.5) });
                          holdCover(f, 'cover_x_ko', { h: 280, p: dp(lt, 0, 0.5) }); }],
]);
"""


def write(path, obj):
    with open(path, 'w', encoding='utf-8') as f:
        if isinstance(obj, str): f.write(obj)
        else: json.dump(obj, f, ensure_ascii=False)


def read(path):
    with open(path, encoding='utf-8') as f: return json.load(f)


# fable, trinity round 2: a shot declared at sc.start is first seen when the title card ends; its cover is judged
# 0.8 s after that, not skipped. Scene a is clean; scene b's one shot draws its cover 1.5 s after the first sentence.
TITLE_CARD_LATE = """
TITLE_CARD = signCard;
cast('me', { name: '나', hair: 'long', h: 0.94 });
cast('oppa', { name: '오빠', hair: 'short', glasses: 'square', h: 1.08 });
SCENES.a = (t, q) => shots(t, [
  [q.s(0), (t, lt) => { const f = person('me', 560, 870, { s: 1.5, pose: 'showBook', face: 'happy', p: dp(lt, 0, 0.5) });
                        holdCover(f, 'cover_x_ko', { h: 280, p: dp(lt, 0, 0.5) }); }],
]);
SCENES.b = (t, q, sc) => shots(t, [
  [sc.start, (t, lt) => { person('me', 560, 870, { s: 1.5, pose: 'present', face: 'happy', p: dp(lt, 0, 0.5) });
                          realCover('cover_x_ko', 1300, 860, 420, { p: dp(lt, q.s(0) - sc.start + 1.5, 0.5) }); }],
]);
"""


def fixture(scenes=FIXTURE, project=None, sentences=('가' * 40, '나' * 40, '다' * 30)):
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
    script = {'title': 'fx', 'scenes': [{'id': 'a', 'title': 'a', 'sentences': [{'text': s} for s in sentences]},
                                        {'id': 'b', 'title': 'b', 'subtitle': '둘째', 'sentences': [{'text': '라' * 30}]}]}
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
        cls.d = fixture(project={'concept': 'letter'})   # a letter video that casts only 'me'
        cls.p, cls.rep = lint(cls.d)

    def test_cover_late_on_the_slow_pair_and_the_late_start_only(self):
        tl = read(os.path.join(self.d, 'timeline.json'))
        s0, s1, s2 = [x['start'] for x in tl['scenes'][0]['sentences']]
        late = [(sc, t, s) for sc, t, s, c in issues(self.rep) if c == 'cover-late']
        self.assertTrue(all(s == 'P1' and sc == 'a' for sc, t, s in late), late)   # not the held cover, not scene b's title card
        # once per shot at its cut + 0.8 s: the slow pair's (cut at s0) and the late start's (cut 0.3 s before s2)
        self.assertEqual(len(late), 2, late)
        self.assertAlmostEqual(late[0][1], s0 + 0.8, delta=0.02); self.assertAlmostEqual(late[1][1], s2 - 0.3 + 0.8, delta=0.02)
        detail = [d for f in self.rep['frames'] for s, c, d in f['issues'] if c == 'cover-late']
        self.assertIn('not drawn yet', detail[1])
        self.assertEqual(self.p.returncode, 1)
        self.assertFalse([c for sc, t, s, c in issues(self.rep) if s == 'P0'], issues(self.rep))   # the fixture itself is sound

    def test_letter_cast(self):
        self.assertIn(('*', 0, 'P2', 'letter-cast'), issues(self.rep))
        self.assertEqual(sum(c == 'letter-cast' for *_, c in issues(self.rep)), 1)   # 'me' is cast: only 오빠 is missing

    def test_crowd_row_on_the_five_small_strangers_only(self):
        tl = read(os.path.join(self.d, 'timeline.json'))
        s1 = tl['scenes'][0]['sentences'][1]['start']
        rows = [t for sc, t, s, c in issues(self.rep) if c == 'crowd-row' and s == 'P1']
        self.assertEqual(len(rows), 1, issues(self.rep))
        self.assertTrue(s1 + 1.6 <= rows[0] < s1 + 3.3, (rows, s1))   # the rest frame of the five, not of the three


def old_docent(rev='9e4ce16'):
    """docent.js as it was at rev (the kit before run 4), or None outside a git checkout"""
    try: p = subprocess.run(['git', '-C', EX, 'show', f'{rev}:explainer/engine/docent.js'], capture_output=True, text=True, timeout=30)
    except OSError: return None
    return p.stdout if p.returncode == 0 and 'DOCENT_KINDS' in p.stdout else None


@unittest.skipUnless(node_ok(), 'node or @napi-rs/canvas missing (npm install in explainer/noderender)')
class OldEngine(unittest.TestCase):   # astra F2: 9e4ce16's docent.js has the budget, so the lint ran and passed silently
    def test_fails_loudly(self):
        js = old_docent()
        if js is None: self.skipTest('git history with 9e4ce16 not available')
        d = fixture(project={'concept': 'letter'}); write(os.path.join(d, 'docent.js'), js)
        os.makedirs(os.path.join(d, 'out')); write(os.path.join(d, 'out', 'lint.json'), {'counts': {}, 'shots': {}, 'frames': []})   # an old pass
        p, rep = lint(d)
        self.assertEqual(p.returncode, 1, p.stdout + p.stderr)
        self.assertIn('engine too old: run new_video.py to refresh engine.js/docent.js', p.stdout)
        self.assertEqual([(s, c) for f in rep['frames'] for s, c, _ in f['issues']], [('P0', 'engine-too-old')])
        detail = rep['frames'][0]['issues'][0][2]
        self.assertIn('covers', detail); self.assertIn('hpx', detail)
        with open(os.path.join(d, 'out', 'lint.md'), encoding='utf-8') as f: self.assertIn('engine-too-old', f.read())

    def test_the_current_engine_passes_the_probe(self):
        d = fixture(); p, rep = lint(d)
        self.assertNotIn('engine-too-old', p.stdout)


class Args(unittest.TestCase):
    def test_timeline_flag(self):
        self.assertEqual(L.args(['--timeline', 'tl_draft.json', '--scene', 'a', 'b', '--strict']), (['a', 'b'], True, 'tl_draft.json'))
        self.assertEqual(L.args(['--scene', 'a', '--timeline', 'x.json']), (['a'], False, 'x.json'))
        self.assertEqual(L.args([]), ([], False, 'timeline.json'))
        with self.assertRaises(SystemExit): L.args(['--timeline'])

    def test_help_prints_usage_and_runs_nothing(self):   # p03: --help ran the whole lint
        d = tempfile.mkdtemp()
        for flag in ('--help', '-h'):
            p = subprocess.run([PY, os.path.join(HERE, 'lint_scenes.py'), flag], cwd=d, capture_output=True, text=True, timeout=60)
            self.assertEqual(p.returncode, 0, p.stderr)
            self.assertIn('--timeline <file>', p.stdout); self.assertIn('cover-late', p.stdout)
        self.assertEqual(os.listdir(d), [])   # no out/, no lint.json


class ClearStills(unittest.TestCase):
    def test_only_its_own_stills_go(self):   # p06: sheets.py tiled stills left from an earlier call
        import export
        d = tempfile.mkdtemp(); out = os.path.join(d, 'out'); os.makedirs(out)
        for f in ('still_0001.00.jpg', 'still_0002.50.jpg', 'still_notes.txt', 'lint_sheet.jpg', 'cover.jpg', 'shot_still_1.jpg'): open(os.path.join(out, f), 'w').close()
        old = export.OUT; export.OUT = out
        try: export.clear_stills()
        finally: export.OUT = old
        self.assertEqual(sorted(os.listdir(out)), ['cover.jpg', 'lint_sheet.jpg', 'shot_still_1.jpg', 'still_notes.txt'])


@unittest.skipUnless(node_ok(), 'node or @napi-rs/canvas missing (npm install in explainer/noderender)')
class ToolsOnFixture(unittest.TestCase):
    env = dict(os.environ, PYTHONPATH=os.path.join(EX, 'noderender', 'shim'), NODE_PATH=os.path.join(EX, 'noderender', 'node_modules'))

    def test_lint_against_another_timeline(self):   # p02, p06: the draft re-linted only by swapping timeline.json by hand
        import timeline_draft
        d = fixture()
        tl_path = os.path.join(d, 'timeline.json')
        with open(tl_path, 'rb') as f: before = f.read()
        slow = timeline_draft.draft(read(os.path.join(d, 'script.json')), cps=4.0)   # sentence 1 starts ~5 s later
        write(os.path.join(d, 'timeline_slow.json'), slow)
        p, rep = lint(d, '--timeline', 'timeline_slow.json')
        s1 = slow['scenes'][0]['sentences'][1]['start']
        rows = [t for sc, t, s, c in issues(rep) if c == 'crowd-row']
        self.assertEqual(len(rows), 1, issues(rep)); self.assertTrue(s1 + 1.6 <= rows[0] < s1 + 3.3, (rows, s1))
        with open(tl_path, 'rb') as f: self.assertEqual(f.read(), before)   # timeline.json untouched
        self.assertIn('timeline_slow.json', p.stdout)

    def test_stills_clear_their_old_stills(self):
        d = fixture()
        for t in ('1.0', '2.5'):
            subprocess.run([PY, os.path.join(HERE, 'export.py'), 'stills', t], cwd=d, env=self.env, check=True, capture_output=True, timeout=120)
        self.assertEqual(sorted(f for f in os.listdir(os.path.join(d, 'out')) if f.startswith('still_')), ['still_0002.50.jpg'])


@unittest.skipUnless(node_ok(), 'node or @napi-rs/canvas missing (npm install in explainer/noderender)')
class TitleCardShot(unittest.TestCase):
    def test_late_cover_in_a_shot_cut_inside_the_title_card(self):
        d = fixture(TITLE_CARD_LATE, project={'concept': 'letter'})
        p, rep = lint(d)
        b = read(os.path.join(d, 'timeline.json'))['scenes'][1]
        late = [(sc, t) for sc, t, s, c in issues(rep) if c == 'cover-late']
        self.assertEqual([sc for sc, t in late], ['b'], issues(rep))   # scene a's held cover is on time
        self.assertAlmostEqual(late[0][1], b['sentences'][0]['start'] + 0.8, delta=0.45)
        self.assertEqual(p.returncode, 1)


if __name__ == '__main__':
    unittest.main()
