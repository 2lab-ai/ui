"""Tests for the cue library and the score planner (no SoundFont, no audio rendering)."""
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import music_lib as ML  # noqa: E402
import score  # noqa: E402


def tl_of(n_scenes=6, sents=12, sd=6.0):
    t, scenes = 0.0, []
    for i in range(n_scenes):
        st = t + 2.6
        ss = [{'text': f'문장 {k}', 'start': st + k * sd, 'end': st + k * sd + sd - 0.5, 'dur': sd} for k in range(sents)]
        dur = 2.6 + sents * sd + 1.1
        scenes.append({'id': f's{i}', 'chip': f'{i}', 'title': f'장 {i}', 'subtitle': f'{i}장', 'start': t, 'lead': 2.6, 'dur': dur, 'sentences': ss})
        t += dur
    return {'total': t, 'scenes': scenes}


class Catalogue(unittest.TestCase):
    def setUp(self): self.cues = ML.catalogue()

    def test_at_least_120_cues_all_distinct(self):
        self.assertGreaterEqual(len(self.cues), 120)
        fps = {(c['pad'], c['tex'], c['pat'], tuple(c['prog']), c['key'], c['mode']) for c in self.cues}
        self.assertEqual(len(fps), len(self.cues))
        self.assertEqual(len({c['id'] for c in self.cues}), len(self.cues))

    def test_twelve_moods_ten_each(self):
        from collections import Counter
        n = Counter(c['mood'] for c in self.cues)
        self.assertEqual(len(n), 12); self.assertTrue(all(v >= 10 for v in n.values()))

    def test_catalogue_file_matches_builder(self):
        self.assertEqual([c['id'] for c in ML.build()], [c['id'] for c in self.cues])


class Composer(unittest.TestCase):
    def test_every_cue_ends_on_its_home_chord_and_fits(self):
        for c in ML.catalogue():
            for dur in (12.0, 37.5, 95.0):
                ev, length = ML.compose(c, dur)
                self.assertLessEqual(max(st for st, *_ in ev), dur, c['id'])
                last = max(st for st, _, ch, *_ in ev if ch == 0)
                pads = sorted({e[4] % 12 for e in ev if e[0] == last and e[2] == 0})
                home = (c['key'] + ML.SCALES[c['mode']][0]) % 12
                self.assertIn(home, pads, f"{c['id']} {dur}: last chord {pads} lacks the tonic {home}")

    def test_texture_stays_out_of_the_voice_band(self):
        """Moving texture notes sit above C5 (72) unless staccato (< 0.5 s); pads stay below C5."""
        for c in ML.catalogue():
            ev, _ = ML.compose(c, 40.0)
            for st, d, ch, prog, pitch, vel in ev:
                if ch == 2 and d >= 0.5: self.assertGreaterEqual(pitch, 72, f"{c['id']} sustained texture at {pitch}")
                if ch == 0: self.assertLessEqual(pitch, 72, f"{c['id']} pad at {pitch}")
                if ch == 1: self.assertLessEqual(pitch, 52, f"{c['id']} bass at {pitch}")

    def test_deterministic(self):
        c = ML.catalogue()[7]
        self.assertEqual(ML.compose(c, 30.0, seed=3), ML.compose(c, 30.0, seed=3))


class Planner(unittest.TestCase):
    def test_sections_cover_each_scene_and_no_cue_repeats(self):
        tl = tl_of(); script = {'scenes': [{'id': s['id'], 'sentences': [{'text': x['text']} for x in s['sentences']]} for s in tl['scenes']]}
        pl = score.plan(script, tl, 30.0)
        self.assertEqual(len({p['cue'] for p in pl}), len(pl))
        for sc in tl['scenes']:
            mine = [p for p in pl if p['scene'] == sc['id']]
            self.assertTrue(mine[0]['chapter_start']); self.assertAlmostEqual(mine[0]['start'], sc['start'], 3)
            self.assertAlmostEqual(mine[-1]['end'], sc['start'] + sc['dur'], 3)
            self.assertGreaterEqual(len(mine), 2)   # a 75 s chapter changes cue at least once

    def test_mood_and_forced_change(self):
        tl = tl_of(2)
        script = {'scenes': [{'id': 's0', 'mood': 'tension', 'sentences': [{'text': 'a'}] * 5 + [{'text': 'b', 'music': 'triumph'}] + [{'text': 'c'}] * 6},
                             {'id': 's1', 'mood': 'warm', 'sentences': [{'text': 'a'}] * 12}]}
        pl = score.plan(script, tl, 30.0)
        self.assertEqual(pl[0]['mood'], 'tension')
        forced = [p for p in pl if p['scene'] == 's0' and abs(p['start'] - tl['scenes'][0]['sentences'][5]['start']) < 1e-3]
        self.assertEqual(forced[0]['mood'], 'triumph')
        self.assertEqual([p for p in pl if p['scene'] == 's1'][0]['mood'], 'warm')

    def test_more_sections_than_cues_still_plans(self):
        tl = tl_of(50, 12, 6.0); script = {'scenes': [{'id': s['id'], 'mood': 'mystery', 'sentences': []} for s in tl['scenes']]}
        self.assertGreater(len(score.plan(script, tl, 20.0)), 120)


if __name__ == '__main__':
    unittest.main()
