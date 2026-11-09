"""python -m unittest explainer/tools/test_padcut.py — padcut on synthetic takes (no audio files, no GPU)."""
import os, sys, unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from padcut import cut, is_filler_text, removed  # noqa: E402

SR = 16000


def take(*parts):
    """parts: ('v', seconds) voiced or ('s', seconds) silence -> a waveform."""
    rng = np.random.default_rng(0); out = []
    for kind, sec in parts:
        n = int(sec * SR)
        out.append(0.3 * np.sin(2 * np.pi * 220 * np.arange(n) / SR).astype(np.float32) if kind == 'v'
                   else (1e-4 * rng.standard_normal(n)).astype(np.float32))
    return np.concatenate(out)


class PadCut(unittest.TestCase):
    def test_full_pattern_keeps_the_speech_between_the_gaps(self):
        a = take(('s', .05), ('v', .3), ('s', .6), ('v', 1.2), ('s', .15), ('v', .8), ('s', .7), ('v', .35), ('s', .1))
        clip, info = cut(a, SR)
        self.assertIsNotNone(clip, info)
        self.assertAlmostEqual(info['cut'][0], 0.95 - 0.05, delta=0.03)   # speech starts at 0.95 s
        self.assertAlmostEqual(info['cut'][1], 3.10 + 0.08, delta=0.03)   # speech ends at 3.10 s
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


if __name__ == '__main__':
    unittest.main()
