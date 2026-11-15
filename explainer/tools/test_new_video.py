"""new_video.py: a docent project gets a starter scenes.js with the letter cast block, only when it has none
(research run 4, 2026-11-15: a letter that never drew 오빠 never cast him, and a stranger took his look)."""
import json, os, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
EX = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import new_video  # noqa: E402


class Starter(unittest.TestCase):
    def test_written_when_absent(self):
        d = tempfile.mkdtemp()
        self.assertTrue(new_video.write_starter(d, '편지'))
        with open(os.path.join(d, 'scenes.js'), encoding='utf-8') as f: js = f.read()
        self.assertIn('TITLE_CARD = signCard;', js)
        self.assertIn("cast('me', { name: '나', hair: 'long', h: 0.94 });", js)
        self.assertIn("cast('oppa', { name: '오빠', hair: 'short', glasses: 'square', h: 1.08 });", js)
        self.assertIn('TEMPLATES T1', js); self.assertIn('TEMPLATES B', js); self.assertIn('편지', js)

    def test_the_original_cover_appears_once(self):   # fable F4: not only the Korean edition in a hand
        d = tempfile.mkdtemp(); new_video.write_starter(d, 'x')
        with open(os.path.join(d, 'scenes.js'), encoding='utf-8') as f: js = f.read()
        self.assertIn("The original's cover appears at least once in the\n// video", js)
        self.assertIn('A Korean original is the\n// exception', js)
        self.assertIn("realCoverPair('cover_<book>_<lang>', 'cover_<book>_ko'", js); self.assertIn('inkLine(880, top, 1400, top', js)   # the desk in plain lines, as TEMPLATES B
        self.assertLess(js.index('realCoverPair('), js.index('holdCover(me'))   # the pair first, where the book is introduced

    def test_never_overwrites(self):
        d = tempfile.mkdtemp(); path = os.path.join(d, 'scenes.js')
        with open(path, 'w') as f: f.write('// mine')
        self.assertFalse(new_video.write_starter(d, 'x'))
        with open(path) as f: self.assertEqual(f.read(), '// mine')

    def test_the_starter_parses(self):   # node --check: a starter that fails to load would blank every frame
        import shutil
        if not shutil.which('node'): self.skipTest('node missing')
        d = tempfile.mkdtemp(); new_video.write_starter(d, 'x')
        self.assertEqual(subprocess.run(['node', '--check', os.path.join(d, 'scenes.js')], capture_output=True).returncode, 0)


def fonts_cached(theme):
    return all(os.path.exists(os.path.join(new_video.FONT_CACHE, f)) for f in new_video.theme(theme)['fontFiles'])


@unittest.skipUnless(fonts_cached('sketch') and fonts_cached('mono-black'), 'fonts not cached (new_video.py would download them)')
class Scaffold(unittest.TestCase):
    def run_new(self, *args):
        d = tempfile.mkdtemp()
        subprocess.run([sys.executable, os.path.join(HERE, 'new_video.py'), d, *args], check=True, capture_output=True, timeout=120)
        return d

    def test_sketch_project_gets_the_starter(self):
        d = self.run_new('--theme', 'sketch')
        with open(os.path.join(d, 'scenes.js'), encoding='utf-8') as f: self.assertIn("cast('oppa'", f.read())

    def test_from_an_example_keeps_its_scenes(self):
        d = self.run_new('--theme', 'sketch', '--from', os.path.join(EX, 'examples', 'docent-lab'))
        with open(os.path.join(d, 'scenes.js'), encoding='utf-8') as f, open(os.path.join(EX, 'examples', 'docent-lab', 'scenes.js'), encoding='utf-8') as g:
            self.assertEqual(f.read(), g.read())

    def test_not_for_a_math_video(self):
        d = self.run_new('--theme', 'mono-black')
        self.assertFalse(os.path.exists(os.path.join(d, 'scenes.js')))

    def test_docent_flag_on_mono_black(self):
        self.assertTrue(os.path.exists(os.path.join(self.run_new('--theme', 'mono-black', '--docent'), 'scenes.js')))

    def pj(self, d):
        with open(os.path.join(d, 'project.json'), encoding='utf-8') as f: return json.load(f)

    def test_a_new_docent_project_is_a_letter(self):   # fable F3: letter-cast never fired, no project carried "concept"
        self.assertEqual(self.pj(self.run_new('--theme', 'sketch'))['concept'], 'letter')
        self.assertEqual(self.pj(self.run_new('--theme', 'mono-black', '--docent'))['concept'], 'letter')
        self.assertNotIn('concept', self.pj(self.run_new('--theme', 'mono-black')))   # a math video
        d = tempfile.mkdtemp()
        with open(os.path.join(d, 'project.json'), 'w') as f: json.dump({'concept': 'lecture'}, f)
        subprocess.run([sys.executable, os.path.join(HERE, 'new_video.py'), d, '--theme', 'sketch'], check=True, capture_output=True, timeout=120)
        self.assertEqual(self.pj(d)['concept'], 'lecture')   # setdefault: a lecture stays a lecture

    def test_new_video_then_lint_sees_letter_cast(self):   # the whole path: scaffold, a draft timeline, the real lint
        from test_budget_engine import node_ok
        if not node_ok(): self.skipTest('node or @napi-rs/canvas missing (npm install in explainer/noderender)')
        env = dict(os.environ, PYTHONPATH=os.path.join(EX, 'noderender', 'shim'), NODE_PATH=os.path.join(EX, 'noderender', 'node_modules'))
        d = self.run_new('--theme', 'sketch')
        with open(os.path.join(d, 'script.json'), 'w', encoding='utf-8') as f:
            json.dump({'title': 'x', 'scenes': [{'id': 's1', 'title': 'x', 'sentences': [{'text': '가' * 30}]}]}, f, ensure_ascii=False)
        subprocess.run([sys.executable, os.path.join(HERE, 'timeline_draft.py')], cwd=d, check=True, capture_output=True, timeout=60)
        with open(os.path.join(d, 'scenes.js'), encoding='utf-8') as f: starter = f.read()
        shot = "\nSCENES.s1 = (t, q) => shots(t, [[q.s(0), (t, lt) => person('me', 760, 870, { s: 1.5, p: dp(lt, 0, 0.5) })]]);\n"
        codes = {}
        for name, js in (('full', starter), ('no oppa', '\n'.join(l for l in starter.splitlines() if not l.startswith("cast('oppa'")))):
            with open(os.path.join(d, 'scenes.js'), 'w', encoding='utf-8') as f: f.write(js + shot)
            subprocess.run([sys.executable, os.path.join(HERE, 'lint_scenes.py')], cwd=d, env=env, capture_output=True, timeout=300)
            with open(os.path.join(d, 'out', 'lint.json'), encoding='utf-8') as f: rep = json.load(f)
            codes[name] = [(s, c, x) for fr in rep['frames'] for s, c, x in fr['issues'] if c == 'letter-cast']
        self.assertEqual(codes['full'], [])
        self.assertEqual(len(codes['no oppa']), 1, codes); self.assertIn("cast('oppa'", codes['no oppa'][0][2])


if __name__ == '__main__':
    unittest.main()
