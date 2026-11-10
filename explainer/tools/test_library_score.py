"""Tests for the library score (catalogue, planner, bed assembly) — synthetic audio, no downloads, no ffmpeg."""
import contextlib, io, json, os, sys, unittest
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import library_score as LS  # noqa: E402


def timeline(n=4, sents=14, sd=7.0, music=None):
    """n chapters of `sents` sentences each; `music` = {(scene, k): mood} marks a turn on sentence k."""
    t, scenes, script = 0.0, [], []
    for i in range(n):
        st = t + 2.6
        ss = [{'text': f'문장 {k}', 'start': st + k * sd, 'end': st + k * sd + sd - 0.6} for k in range(sents)]
        scenes.append({'id': f's{i}', 'start': t, 'sentences': ss})
        src = [{'text': f'문장 {k}'} for k in range(sents)]
        for (sc, k), m in (music or {}).items():
            if sc == i: src[k]['music'] = m
        script.append({'id': f's{i}', 'mood': ['tension', 'wonder', 'warm', 'reflective'][i % 4], 'sentences': src})
        t = st + sents * sd + 1.1
    return {'scenes': script}, {'total': t, 'scenes': scenes}


class Catalogue(unittest.TestCase):
    def setUp(self):
        with open(LS.CATALOGUE) as f: self.all = json.load(f)['tracks']
        self.beds = LS.catalogue()

    def test_every_bed_is_attributable_and_has_a_body(self):
        self.assertGreaterEqual(len(self.beds), 20)
        self.assertEqual(len({t['id'] for t in self.all}), len(self.all))
        for t in self.beds:
            self.assertTrue(t['moods'], t['id'])
            self.assertTrue(t['license'].startswith('CC BY') and 'NC' not in t['license'], t['id'])
            self.assertTrue(t['source'].startswith('https://archive.org/details/'), t['id'])
            self.assertLess(t.get('body_start', 0), t.get('body_end', t['dur']))
            self.assertGreaterEqual(t['use'], 60, t['id'])

    def test_beds_are_quiet_enough_to_talk_over(self):
        for t in self.beds:   # the measured reasons a track is a bed (music/library.json "about")
            self.assertLessEqual(t['perc'], 0.1, t['id'])          # no drums
            self.assertLessEqual(t['onsets_per_s'], 3.5, t['id'])  # few attacks
            self.assertLessEqual(t['band_1_4k'], 0.2, t['id'])     # little energy where consonants live

    def test_no_bed_has_an_internal_silence(self):
        for t in self.all: self.assertIn('holes', t, t['id'])   # measured (library_score.py --measure)
        for t in self.beds: self.assertEqual(t['holes'], 0, t['id'])

    def test_holes_finds_a_silence_inside_a_track(self):
        sr = 8000; rng = np.random.default_rng(3)
        x = rng.standard_normal(sr * 20).astype(np.float32) * 0.1
        self.assertEqual(LS.holes(x, sr), [])
        x[sr * 8:sr * 10] *= 0.001                             # 2 s, 60 dB down
        self.assertEqual(len(LS.holes(x, sr)), 1); self.assertAlmostEqual(LS.holes(x, sr)[0][1], 2.0, delta=0.07)
        y = rng.standard_normal(sr * 20).astype(np.float32) * 0.1
        y[sr * 8:int(sr * 8.8)] *= 0.001                       # a breath under a second is not a hole
        self.assertEqual(LS.holes(y, sr), [])

    def test_a_one_second_silence_is_found_wherever_it_starts(self):
        sr = 8000; rng = np.random.default_rng(4)
        for k in range(25):                                    # review of PR #59: missed at 24 of 25 offsets
            x = rng.standard_normal(sr * 12).astype(np.float32) * 0.1
            a = sr * 5 + k * sr // 25; x[a:a + sr] *= 0.001
            self.assertEqual(len(LS.holes(x, sr)), 1, k)

    def test_every_script_mood_finds_beds(self):
        for mood, fam in LS.FAMILY.items():
            n = sum(1 for t in self.beds if set(t['moods']) & set(fam))
            self.assertGreaterEqual(n, 3, mood)


class Plan(unittest.TestCase):
    def test_covers_every_chapter_without_gaps_or_repeats(self):
        script, tl = timeline()
        pl = LS.plan(LS.chapters(script, tl), 'test', None)
        self.assertEqual(len({p['cue'] for p in pl}), len(pl))           # no track twice in one video
        self.assertAlmostEqual(pl[0]['start'], 0.0)
        self.assertAlmostEqual(pl[-1]['end'], tl['total'], places=2)
        for a, b in zip(pl, pl[1:]): self.assertAlmostEqual(a['end'], b['start'], places=3)
        starts = {round(sc['start'], 3) for sc in tl['scenes']}
        self.assertEqual({p['start'] for p in pl if p['chapter_start']}, starts)

    def fits(self, pl):
        """every section plus its cross-fades fits its track's body (review of PR #59: a 2.5 s overrun cut the fade-out
        short and the cross-fade dipped 6-11 dB)"""
        cat = {t['id']: t for t in LS.catalogue()}
        for k, p in enumerate(pl):
            pre, post, _, _ = LS.extent(pl, k)
            self.assertLessEqual(p['end'] - p['start'] + pre + post, cat[p['cue']]['use'] + 1e-6, p)

    def test_a_section_never_outlasts_its_track(self):
        script, tl = timeline(n=3, sents=40)   # 3 chapters of ~4.7 min: every chapter chains tracks
        pl = LS.plan(LS.chapters(script, tl), 'test', None)
        self.fits(pl); self.assertGreater(len(pl), 3)

    def test_random_timelines(self):
        rng = np.random.default_rng(7)
        moods = list(LS.FAMILY) + ['nonsense']
        for _ in range(150):
            t, scenes, script = 0.0, [], []
            for i in range(int(rng.integers(1, 14))):
                st = t + 2.6; ss = []; src = []
                for k in range(int(rng.integers(1, 60))):
                    d = float(rng.uniform(1.5, 12)); ss.append({'text': '문장', 'start': st, 'end': st + d - 0.4}); st += d
                    src.append({'text': '문장', **({'music': str(rng.choice(moods))} if rng.random() < 0.06 else {})})
                scenes.append({'id': f's{i}', 'start': t, 'sentences': ss})
                script.append({'id': f's{i}', 'mood': str(rng.choice(moods[:-1])), 'sentences': src}); t = st + 1.1
            tl = {'total': t, 'scenes': scenes}
            with contextlib.redirect_stderr(io.StringIO()): pl = LS.plan(LS.chapters({'scenes': script}, tl), 'test', None)
            self.assertAlmostEqual(pl[0]['start'], 0.0)
            self.assertAlmostEqual(pl[-1]['end'], round(t, 3), places=2)
            for a, b in zip(pl, pl[1:]): self.assertAlmostEqual(a['end'], b['start'], places=3)
            self.assertTrue(all(p['mood'] in LS.FAMILY for p in pl))
            self.fits(pl)

    def test_turn_in_the_first_seconds_sets_the_chapter_mood(self):
        script, tl = timeline(n=2, sents=8)
        script['scenes'][1]['sentences'][0]['music'] = 'triumph'   # 2.6 s into the chapter
        pl = [p for p in LS.plan(LS.chapters(script, tl), 'test', None) if p['scene'] == 's1']
        self.assertEqual(pl[0]['mood'], 'triumph')

    def test_unknown_turn_mood_is_ignored(self):
        script, tl = timeline(n=1, sents=8)
        script['scenes'][0]['sentences'][4]['music'] = 'jazzy'
        err = io.StringIO()
        with contextlib.redirect_stderr(err): pl = LS.plan(LS.chapters(script, tl), 'test', None)
        self.assertEqual({p['mood'] for p in pl}, {'tension'}); self.assertIn("'jazzy' ignored", err.getvalue())

    def test_music_turn_changes_track_exactly_there(self):
        script, tl = timeline(music={(1, 5): 'triumph'})
        pl = LS.plan(LS.chapters(script, tl), 'test', None)
        at = tl['scenes'][1]['sentences'][5]['start']
        turn = [p for p in pl if abs(p['start'] - at) < 1e-3]
        self.assertEqual(len(turn), 1); self.assertEqual(turn[0]['mood'], 'triumph')

    def test_mood_family_is_respected(self):
        cat = {t['id']: t for t in LS.catalogue()}
        script, tl = timeline()
        for p in LS.plan(LS.chapters(script, tl), 'test', None):
            self.assertTrue(set(cat[p['cue']]['moods']) & set(LS.FAMILY[p['mood']]), p)

    def test_unset_mood_is_guessed_from_the_words(self):
        script, tl = timeline(n=2, sents=6)
        del script['scenes'][1]['mood']
        for s in tl['scenes'][1]['sentences']: s['text'] = '죽음과 슬픔, 눈물의 이별'
        self.assertEqual(LS.chapters(script, tl)[1]['mood'], 'melancholy')

    def test_recent_videos_push_tracks_down(self):
        script, tl = timeline(n=1, sents=6)
        first = LS.plan(LS.chapters(script, tl), 'a', None)[0]['cue']
        again = LS.plan(LS.chapters(script, tl), 'b', {'videos': [{'project': 'x', 'cues': [first]}]})[0]['cue']
        self.assertNotEqual(first, again)

    def test_credits_name_every_track_once(self):
        script, tl = timeline()
        pl = LS.plan(LS.chapters(script, tl), 'test', None)
        lines = LS.credits(pl).splitlines()[1:]
        self.assertEqual(len(lines), len({p['cue'] for p in pl}))
        for ln in lines: self.assertIn('Lee Rosevere — CC BY', ln)


class Assemble(unittest.TestCase):
    """The first library mix had 12-23 s near-silences where a track's outro fell under the voice. With synthetic
    tracks (steady noise), the bed must stay within 6 dB of its level everywhere after the opening fade-in: every
    change is a cross-fade, never a fade-out followed by a fade-in."""

    def setUp(self):
        self.saved = LS.decode, LS.lufs_of, LS.SR
        LS.SR = 8000
        rng = np.random.default_rng(1)
        LS.decode = lambda path: (rng.standard_normal((int(300 * LS.SR), 2)) * 0.1).astype(np.float32)
        LS.lufs_of = lambda x: 20 * np.log10(np.sqrt(np.mean(np.square(x))) + 1e-9)

    def tearDown(self): LS.decode, LS.lufs_of, LS.SR = self.saved

    def test_a_short_cached_file_fails_loudly(self):
        LS.decode = lambda path: np.zeros((int(20 * LS.SR), 2), np.float32)   # 20 s where the catalogue promises minutes
        script, tl = timeline(n=1, sents=12)
        pl = LS.plan(LS.chapters(script, tl), 'test', None)
        with self.assertRaises(RuntimeError): LS.assemble(pl, tl['total'], -20.0)

    def test_no_silence_longer_than_a_fade(self):
        script, tl = timeline(n=3, sents=30)
        pl = LS.plan(LS.chapters(script, tl), 'test', None)
        bed = LS.assemble(pl, tl['total'], -20.0)
        win = LS.SR // 4
        mono = bed[:(int(tl['total'] * LS.SR) // win) * win].mean(axis=1)
        rms = np.sqrt(np.mean(np.square(mono.reshape(-1, win)), axis=1))
        quiet = rms < rms.max() * 10 ** (-6 / 20)    # 6 dB under the loudest quarter-second (a cross-fade dips 3 dB)
        run = longest = 0
        for q in quiet[8:-2]:                        # skip the opening fade-in
            run = run + 1 if q else 0; longest = max(longest, run)
        self.assertEqual(longest, 0, f'{longest * 0.25:.2f} s more than 6 dB under the bed')


class Download(unittest.TestCase):
    """a body shorter than its Content-Length is an error, not a cached track (review of PR #59)"""

    def serve(self, body, length):
        import http.server, threading
        class H(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200); self.send_header('Content-Length', str(length)); self.end_headers()
                self.wfile.write(body); self.wfile.flush(); self.connection.shutdown(1)
            def log_message(self, *a): pass
        srv = http.server.HTTPServer(('127.0.0.1', 0), H)
        threading.Thread(target=srv.handle_request, daemon=True).start()
        return f'http://127.0.0.1:{srv.server_address[1]}/x.flac', srv

    def test_truncated_body_raises_and_caches_nothing(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            url, srv = self.serve(b'x' * 100, 1000); dest = os.path.join(d, 'x.flac')
            with self.assertRaises(Exception): LS.download(url, dest)
            srv.server_close()
            self.assertEqual(os.listdir(d), [])

    def test_full_body_is_cached(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            url, srv = self.serve(b'x' * 1000, 1000); dest = os.path.join(d, 'x.flac')
            LS.download(url, dest); srv.server_close()
            self.assertEqual(os.path.getsize(dest), 1000); self.assertEqual(os.listdir(d), ['x.flac'])


class Main(unittest.TestCase):
    def test_plan_only_touches_cue_plan(self):
        """--plan must not rewrite the credits or cue sheet of the score.wav already there (review of PR #59)"""
        import subprocess, tempfile
        script, tl = timeline(n=2, sents=6)
        with tempfile.TemporaryDirectory() as d:
            for name, obj in (('script.json', script), ('timeline.json', tl), ('project.json', {'slug': 'plan-test'})):
                with open(os.path.join(d, name), 'w') as f: json.dump(obj, f)
            os.makedirs(os.path.join(d, 'home'))
            r = subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'library_score.py'), '--plan'],
                               cwd=d, env={**os.environ, 'HOME': os.path.join(d, 'home')}, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertEqual(sorted(os.listdir(os.path.join(d, 'out'))), ['cue_plan.md'])
            self.assertFalse(os.path.exists(os.path.join(d, 'score.json')))
            self.assertFalse(os.path.exists(os.path.join(d, 'home', '.cache', '2lab-explainer-music', 'history.json')))


if __name__ == '__main__':
    unittest.main()
