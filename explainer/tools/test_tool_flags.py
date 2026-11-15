"""Tool flags from the run-4 verification probes (2026-11-16): narrate_soma.py --help prints its usage without
creating or sending anything (v2, r10: it started a narration against the default URL and crashed), and
timeline_draft.py --out <file> writes the draft elsewhere, so it survives the narration for lint_scenes.py --timeline
(r10: the draft was kept by copying timeline.json around by hand)."""
import json, os, subprocess, sys, tempfile, time, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable
SCRIPT = {'title': 'x', 'scenes': [{'id': 's1', 'title': 'x', 'sentences': [{'text': '가나다라마바사'}, {'text': '아자차카타파하'}]}]}


def run(tool, *args, cwd, env=None):
    return subprocess.run([PY, os.path.join(HERE, tool), *args], cwd=cwd, capture_output=True, text=True, timeout=60,
                          env=dict(os.environ, **(env or {})))


class NarrateHelp(unittest.TestCase):
    def test_help_prints_usage_and_touches_nothing(self):
        d = tempfile.mkdtemp()
        for flag in ('--help', '-h'):
            t0 = time.time()
            # a closed port: a request would fail with URLError, as on the probes
            p = run('narrate_soma.py', flag, cwd=d, env={'SOMA_VOICE_URL': 'http://127.0.0.1:9'})
            self.assertEqual(p.returncode, 0, p.stderr)
            self.assertIn('usage: python narrate_soma.py', p.stdout); self.assertIn('--redo', p.stdout)
            self.assertNotIn('Traceback', p.stderr); self.assertLess(time.time() - t0, 20)
        self.assertEqual(os.listdir(d), [])   # no cache_voice/, no narration.wav, no timeline.json


class DraftOut(unittest.TestCase):
    def project(self):
        d = tempfile.mkdtemp()
        with open(os.path.join(d, 'script.json'), 'w', encoding='utf-8') as f: json.dump(SCRIPT, f, ensure_ascii=False)
        real = {'total': 9.9, 'voice': 'cwon', 'scenes': []}   # the voice's timeline
        with open(os.path.join(d, 'timeline.json'), 'w') as f: json.dump(real, f)
        return d

    def test_out_writes_elsewhere_and_leaves_the_real_timeline(self):
        d = self.project()
        with open(os.path.join(d, 'timeline.json'), 'rb') as f: before = f.read()
        p = run('timeline_draft.py', '--out', 'timeline_draft.json', cwd=d)
        self.assertEqual(p.returncode, 0, p.stderr); self.assertIn('timeline_draft.json', p.stdout)
        with open(os.path.join(d, 'timeline.json'), 'rb') as f: self.assertEqual(f.read(), before)
        with open(os.path.join(d, 'timeline_draft.json'), encoding='utf-8') as f: tl = json.load(f)
        self.assertEqual(tl['voice'], 'draft'); self.assertEqual(len(tl['scenes'][0]['sentences']), 2)
        self.assertEqual(run('timeline_draft.py', '--out', 'timeline_draft.json', cwd=d).returncode, 0)   # a draft over a draft

    def test_out_still_guards_a_real_timeline(self):
        d = self.project()
        p = run('timeline_draft.py', '--out', 'timeline.json', cwd=d)
        self.assertNotEqual(p.returncode, 0); self.assertIn('not overwriting', p.stderr)
        self.assertNotEqual(run('timeline_draft.py', cwd=d).returncode, 0)   # the default target too
        self.assertNotEqual(run('timeline_draft.py', '--out', cwd=d).returncode, 0)   # --out without a file
        self.assertEqual(run('timeline_draft.py', '--out', 'timeline.json', '--force', cwd=d).returncode, 0)

    def test_help(self):
        d = tempfile.mkdtemp(); p = run('timeline_draft.py', '--help', cwd=d)
        self.assertEqual(p.returncode, 0); self.assertIn('--out <file>', p.stdout); self.assertEqual(os.listdir(d), [])


if __name__ == '__main__':
    unittest.main()
