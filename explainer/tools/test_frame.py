"""The frame size a project renders at (frame.py, engine.js FORMATS): the default stays 1920x1080, "format": "short" is
1080x1920, "size" wins; the engine and the export agree; the subtitles and covers follow the frame."""
import json, os, shutil, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from frame import FORMATS, frame_size  # noqa: E402
_cwd = os.getcwd(); os.chdir(tempfile.mkdtemp())   # export.py makes ./out on import
import export  # noqa: E402
import lint_scenes  # noqa: E402
os.chdir(_cwd)

ENGINE = os.path.join(os.path.dirname(HERE), 'engine', 'engine.js')
CASES = [{}, {'slug': 'old-video', 'theme': 'mono-black'}, {'format': 'landscape'}, {'format': 'short'},
         {'size': [1080, 1920]}, {'size': [1280, 720]}, {'format': 'short', 'size': [720, 1280]},
         {'format': None}, {'format': ''}]


class FrameSize(unittest.TestCase):
    def test_default_is_1080p_landscape(self):   # every project made before formats existed renders as before
        self.assertEqual(frame_size({}), (1920, 1080))
        self.assertEqual(frame_size(None), (1920, 1080))
        self.assertEqual(frame_size({'slug': 'euler-identity-history', 'theme': 'mono-black'}), (1920, 1080))
        self.assertEqual(frame_size({'format': 'landscape'}), (1920, 1080))

    def test_short_is_vertical_1080x1920(self):
        self.assertEqual(frame_size({'format': 'short'}), (1080, 1920))

    def test_size_wins(self):
        self.assertEqual(frame_size({'size': [1080, 1920]}), (1080, 1920))
        self.assertEqual(frame_size({'format': 'short', 'size': [720, 1280]}), (720, 1280))

    def test_bad_values_are_refused(self):
        for pj in ({'format': 'vertical'}, {'size': [1080]}, {'size': [1081, 1920]}, {'size': ['1080', '1920']},
                   {'size': [0, 0]}, {'size': [True, 1920]}, {'size': 1080}):
            with self.assertRaises(ValueError, msg=pj): frame_size(pj)

    def test_project_frame_reads_the_project_folder(self):
        d = tempfile.mkdtemp(); old = export.HERE
        try:
            export.HERE = d
            self.assertEqual(export.project_frame(), (1920, 1080))   # no project.json
            json.dump({'format': 'short'}, open(os.path.join(d, 'project.json'), 'w'))
            self.assertEqual(export.project_frame(), (1080, 1920))
        finally:
            export.HERE = old; shutil.rmtree(d)


@unittest.skipUnless(shutil.which('node'), 'node is not installed')
class EngineAgrees(unittest.TestCase):
    """engine.js frameOf() runs in Node and must give the sizes frame.py gives, and the 1080p layout of old."""
    @classmethod
    def setUpClass(cls):
        js = ("const vm = require('vm'), fs = require('fs'); const c = vm.createContext({});"
              f"vm.runInContext(fs.readFileSync({json.dumps(ENGINE)}, 'utf8'), c);"
              "const cases = JSON.parse(process.argv[1]);"
              "console.log(JSON.stringify({ frames: cases.map(p => vm.runInContext('frameOf', c)(p)),"
              " formats: vm.runInContext('FORMATS', c), W: vm.runInContext('W', c), H: vm.runInContext('H', c) }));")
        out = subprocess.run(['node', '-e', js, json.dumps(CASES)], capture_output=True, text=True, check=True).stdout
        cls.js = json.loads(out)

    def test_same_sizes_as_frame_py(self):
        for pj, f in zip(CASES, self.js['frames']):
            self.assertEqual((f['W'], f['H']), frame_size(pj), pj)

    def test_same_format_table(self):
        self.assertEqual({k: tuple(v['size']) for k, v in self.js['formats'].items()}, FORMATS)

    def test_engine_starts_at_1080p(self):   # W, H before project.json is read (scripts that measure at load)
        self.assertEqual((self.js['W'], self.js['H']), (1920, 1080))

    def test_landscape_layout_unchanged(self):   # the subtitle box and docent's SUB_Y line of every older video
        f = self.js['frames'][0]
        self.assertEqual(f['safe'], {'x0': 0, 'y0': 0, 'x1': 1920, 'y1': 1080})
        self.assertEqual((f['sub'], f['subBottom'], f['subTop']), ([36, 50], 1036, 905))

    def test_short_keeps_text_out_of_the_player(self):   # Shorts: the bottom 20 % and the right 15 % are covered
        f = self.js['frames'][3]
        self.assertEqual(f['format'], 'short')
        self.assertLessEqual(f['safe']['x1'], 0.85 * 1080)
        self.assertLessEqual(f['subBottom'], 0.8 * 1920)
        self.assertLess(f['subTop'], f['subBottom'])

    def test_upright_size_gets_the_short_layout(self):
        self.assertEqual(self.js['frames'][4]['format'], 'short')
        self.assertEqual(self.js['frames'][5]['format'], 'landscape')


class FollowsTheFrame(unittest.TestCase):
    def test_cover_sizes(self):
        self.assertEqual(export.cover_sizes(1920, 1080), [(1280, 720), (320, 180), (168, 94)])   # as before
        self.assertEqual(export.cover_sizes(1080, 1920), [(720, 1280), (180, 320), (94, 168)])

    def test_small_subject_is_measured_against_the_frame(self):
        r = {k: [] for k in ('partial', 'ghost', 'zone', 'off', 'empty', 'tailFar', 'cover', 'overflow', 'rig', 'people', 'wordy')}
        r.update(ink=[100, 100, 700, 400], textBig=False)   # 600 x 300 px of ink
        small = lambda size: any(c == 'small-subject' for _, c, _ in lint_scenes.judge(r, size))
        self.assertTrue(small((1920, 1080)))    # 300 < 30 % of 1080 and 600 < 50 % of 1920
        self.assertFalse(small((1080, 1920)))   # 600 > 50 % of 1080


if __name__ == '__main__':
    unittest.main()
