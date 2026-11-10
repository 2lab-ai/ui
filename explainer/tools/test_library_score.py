"""Tests for the library score (catalogue, planner, bed assembly) — synthetic audio, no downloads, no ffmpeg."""
import json, os, sys, unittest
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
        self.assertGreaterEqual(len(self.beds), 24)
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

    def test_a_section_never_outlasts_its_track(self):
        cat = {t['id']: t for t in LS.catalogue()}
        script, tl = timeline(n=3, sents=40)   # 3 chapters of ~4.7 min: every chapter chains tracks
        pl = LS.plan(LS.chapters(script, tl), 'test', None)
        for p in pl: self.assertLessEqual(p['end'] - p['start'], cat[p['cue']]['use'] - LS.FADE_OUT + 1e-6, p)
        self.assertGreater(len(pl), 3)

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
    tracks (steady noise), the bed must stay within 12 dB of its level everywhere between the opening fade-in and the
    closing fade-out: every change is a cross-fade, never a fade-out followed by a fade-in."""

    def setUp(self):
        self.saved = LS.decode, LS.lufs_of, LS.SR
        LS.SR = 8000
        rng = np.random.default_rng(1)
        LS.decode = lambda path: (rng.standard_normal((int(300 * LS.SR), 2)) * 0.1).astype(np.float32)
        LS.lufs_of = lambda x: 20 * np.log10(np.sqrt(np.mean(np.square(x))) + 1e-9)

    def tearDown(self): LS.decode, LS.lufs_of, LS.SR = self.saved

    def test_no_silence_longer_than_a_fade(self):
        script, tl = timeline(n=3, sents=30)
        pl = LS.plan(LS.chapters(script, tl), 'test', None)
        bed = LS.assemble(pl, tl['total'], -20.0)
        win = LS.SR // 2
        mono = bed[:(int(tl['total'] * LS.SR) // win) * win].mean(axis=1)
        rms = np.sqrt(np.mean(np.square(mono.reshape(-1, win)), axis=1))
        quiet = rms < rms.max() * 10 ** (-12 / 20)   # 12 dB under the loudest half-second (a cross-fade dips 3 dB)
        run = longest = 0
        for q in quiet[3:-6]:                        # skip the opening fade-in and the closing fade-out
            run = run + 1 if q else 0; longest = max(longest, run)
        self.assertLessEqual(longest * 0.5, 0.5, f'{longest * 0.5:.1f} s near-silence inside the bed')


if __name__ == '__main__':
    unittest.main()
