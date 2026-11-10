"""python -m unittest explainer/tools/test_padcut.py — padcut on synthetic takes (no audio files, no GPU)."""
import os, sys, unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from padcut import cut, edge_db, edges_ok, is_filler_text, removed  # noqa: E402

SR = 16000


def take(*parts):
    """parts: ('v', seconds) voiced, ('s', seconds) silence (-80 dB floor) or ('d', seconds) a soft sound at about -50 dB
    (a fading final vowel, a breath, an ㅎ/ㅅ onset: below padcut's -40 dB voiced threshold) -> a waveform."""
    rng = np.random.default_rng(0); out = []
    for kind, sec in parts:
        n = int(sec * SR); t = np.arange(n) / SR
        out.append((0.3 * np.sin(2 * np.pi * 220 * t)).astype(np.float32) if kind == 'v'
                   else (0.0045 * np.sin(2 * np.pi * 180 * t)).astype(np.float32) if kind == 'd'
                   else (0.03 * np.sin(2 * np.pi * 180 * t)).astype(np.float32) if kind == 'D'
                   else (1e-4 * rng.standard_normal(n)).astype(np.float32))
    return np.concatenate(out)


class PadCut(unittest.TestCase):
    def test_full_pattern_keeps_the_speech_between_the_gaps(self):
        a = take(('s', .05), ('v', .3), ('s', .6), ('v', 1.2), ('s', .15), ('v', .8), ('s', .7), ('v', .35), ('s', .1))
        clip, info = cut(a, SR)
        self.assertIsNotNone(clip, info)
        self.assertAlmostEqual(info['cut'][0], 0.95 - 0.05, delta=0.03)   # speech starts at 0.95 s
        self.assertAlmostEqual(info['cut'][1], 3.10 + 0.05, delta=0.03)   # speech ends (settles) at 3.10 s
        head, tail = removed(a, SR, info)
        self.assertGreater(len(head), 0); self.assertGreater(len(tail), 0)

    def test_head_filler_merged_into_speech_is_rejected(self):
        a = take(('s', .05), ('v', 1.6), ('s', .3), ('v', .9), ('s', .6), ('v', .3))
        self.assertIsNone(cut(a, SR)[0])

    def test_swallowed_tail_filler_long_last_run_is_rejected(self):
        a = take(('v', .3), ('s', .6), ('v', 1.0), ('s', .3), ('v', 1.4), ('s', .2))
        self.assertIsNone(cut(a, SR)[0])

    def test_no_gap_after_the_head_filler_is_rejected(self):
        a = take(('v', .3), ('s', .1), ('v', 1.0), ('s', .6), ('v', .3))
        self.assertIsNone(cut(a, SR)[0])

    def test_two_runs_only_is_rejected(self):
        self.assertIsNone(cut(take(('v', .3), ('s', .6), ('v', 1.0)), SR)[0])

    def test_a_short_first_word_passes_the_structure_check_so_the_ear_check_must_catch_it(self):
        # missing head filler + short first word + internal pause: structure alone cannot tell; removed() exposes it
        a = take(('v', .5), ('s', .3), ('v', 1.2), ('s', .6), ('v', .3))
        clip, info = cut(a, SR)
        self.assertIsNotNone(clip)
        self.assertFalse(is_filler_text('반 바퀴'))

    def test_filler_text(self):
        for t in ('아', '아아.', ' 아, 아… ', '음.', '어'): self.assertTrue(is_filler_text(t), t)
        for t in ('', '  ', '.', '…', '일', '반바퀴', '감사합니다', '그게', '아 일'): self.assertFalse(is_filler_text(t), t)

    def test_removed_covers_everything_outside_the_clip(self):
        a = take(('s', .05), ('v', .3), ('s', .6), ('v', 1.2), ('s', .7), ('v', .35), ('s', .1))
        clip, info = cut(a, SR)
        head, tail = removed(a, SR, info)
        self.assertEqual(len(head) + len(clip) + len(tail), len(a))


class SoftEdges(unittest.TestCase):
    """v2 cut at the -40 dB run edge + 80 ms and chopped soft endings ("…였습" with 다 gone); v3 follows the sound."""

    def test_a_soft_final_decay_is_kept(self):
        # speech ends 2.15 s, then 0.25 s of soft decay (-50 dB) -> settles at 2.40 s
        a = take(('s', .05), ('v', .3), ('s', .6), ('v', 1.2), ('d', .25), ('s', .8), ('v', .35), ('s', .1))
        clip, info = cut(a, SR)
        self.assertIsNotNone(clip, info)
        self.assertAlmostEqual(info['settled'], 2.40, delta=0.02)
        self.assertGreaterEqual(info['cut'][1], 2.40)
        self.assertTrue(edges_ok(clip, SR), edge_db(clip, SR))

    def test_a_short_dip_inside_the_decay_does_not_end_it(self):
        # decay, a 30 ms dip (a stop closure), more decay: all of it belongs to the sentence
        a = take(('v', .3), ('s', .6), ('v', 1.0), ('d', .1), ('s', .03), ('d', .12), ('s', .8), ('v', .3))
        clip, info = cut(a, SR)
        self.assertIsNotNone(clip, info)
        self.assertAlmostEqual(info['settled'], 0.9 + 1.0 + 0.25, delta=0.02)

    def test_a_soft_onset_is_kept(self):
        # an ㅎ/ㅅ-like soft onset of 0.1 s right before the voiced speech
        a = take(('v', .3), ('s', .6), ('d', .1), ('v', 1.0), ('s', .6), ('v', .3))
        clip, info = cut(a, SR)
        self.assertIsNotNone(clip, info)
        self.assertAlmostEqual(info['onset'], 0.9, delta=0.02)
        self.assertLessEqual(info['cut'][0], 0.9)

    def test_a_breath_separated_by_silence_stays_out(self):
        # breath at 0.55-0.70 s, then 0.25 s of silence, then speech at 0.95 s: the cut starts after the breath
        a = take(('v', .3), ('s', .25), ('d', .15), ('s', .25), ('v', 1.0), ('s', .6), ('v', .3))
        clip, info = cut(a, SR)
        self.assertIsNotNone(clip, info)
        self.assertGreater(info['cut'][0], 0.70)

    def test_sound_still_going_at_the_middle_of_the_tail_gap_is_rejected(self):
        a = take(('v', .3), ('s', .6), ('v', 1.0), ('d', .45), ('s', .3), ('v', .3))
        clip, why = cut(a, SR)
        self.assertIsNone(clip)
        self.assertIn('middle of the tail gap', why)

    def test_edge_check_flags_a_chopped_ending(self):
        # real v2 cuts landed -16..-25 dB under the speech; v3 cuts land -38 dB or lower (80 real takes measured)
        clean = take(('s', .05), ('v', 1.0), ('D', .1), ('d', .2), ('s', .08))
        chopped = take(('s', .05), ('v', 1.0), ('D', .04))           # cut 40 ms into the decay
        self.assertTrue(edges_ok(clean, SR), edge_db(clean, SR))
        self.assertFalse(edges_ok(chopped, SR), edge_db(chopped, SR))


if __name__ == '__main__':
    unittest.main()
