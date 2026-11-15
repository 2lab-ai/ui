"""mix_check's band and open-stretch measure, and export.py mix's one-pass bed trim (research run 4, 2026-11-15:
music 19.3-24.3 dB under the voice passed as "ok"; one-scene clips failed "flat" on the bed's own fade-in).
Synthetic audio: a voice of noise syllables and a steady bed; the trim test needs ffmpeg."""
import contextlib, io, json, os, shutil, sys, tempfile, unittest, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mix_check  # noqa: E402

SR = 48000
SENTS = [(2.6, 6.0), (6.5, 10.5)]   # a title card 0-2.6 s, two sentences, a short gap, the end
TOTAL = 12.0


def wav(path, x):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def db(x): return 10 ** (x / 20)


def voice(rms_dbfs=-20.0):
    rng = np.random.default_rng(1); n = int(TOTAL * SR); v = np.zeros(n, np.float32)
    for a, b in SENTS:
        t = np.arange(int((b - a) * SR)) / SR
        syll = 0.55 + 0.45 * np.sin(2 * np.pi * 4 * t) ** 2   # four syllables a second
        v[int(a * SR):int(a * SR) + len(t)] = rng.standard_normal(len(t)) * syll
    sp = np.zeros(n, bool)
    for a, b in SENTS: sp[int(a * SR):int(b * SR)] = True
    return (v * db(rms_dbfs) / np.sqrt(np.mean(v[sp] ** 2))).astype(np.float32)


def bed(under=-41.0, open_=-28.5, fade_in=1.5):
    """a steady noise bed: `under` dBFS RMS while the voice speaks, `open_` dBFS in the open stretches, fading in from
    silence over fade_in s at the start (library_score.py FADE_IN)"""
    rng = np.random.default_rng(2); n = int(TOTAL * SR); t = np.arange(n) / SR
    lvl = np.full(n, db(open_), np.float32)
    for a, b in SENTS: lvl[int(a * SR):int((b + 0.6) * SR)] = db(under)   # the short gap between sentences too
    if fade_in: lvl *= np.clip(t / fade_in, 0, 1)
    return (rng.standard_normal(n) * lvl).astype(np.float32)


def project(mix=None, score=None):
    d = tempfile.mkdtemp()
    scenes = [{'id': 's', 'start': 0, 'lead': 2.6, 'dur': TOTAL, 'sentences': [{'text': 'x', 'start': a, 'end': b, 'dur': b - a} for a, b in SENTS]}]
    with open(os.path.join(d, 'timeline.json'), 'w') as f: json.dump({'total': TOTAL, 'scenes': scenes}, f)
    v = voice(); wav(os.path.join(d, 'narration.wav'), v)
    if mix is not None: wav(os.path.join(d, 'mix.wav'), v + mix)
    if score is not None: wav(os.path.join(d, 'score.wav'), score)
    return d


class Band(unittest.TestCase):
    def check(self, under):
        out = mix_check.measure(project(mix=bed(under=-20 - under)), loudness=False)
        out['verdict'] = mix_check.verdict(out)
        return out

    def test_target_is_ok(self):
        out = self.check(21.0)
        self.assertAlmostEqual(out['music_under_voice_db'], 21.0, delta=0.4); self.assertEqual(out['verdict'], 'ok')

    def test_outside_19_5_to_22_5_fails(self):   # 22.4 / 19.3 passed before run 4 (it accepted 18-26)
        self.assertTrue(self.check(23.5)['verdict'].startswith('too quiet'))
        self.assertTrue(self.check(18.6)['verdict'].startswith('too loud'))
        self.assertEqual(self.check(22.2)['verdict'], 'ok'); self.assertEqual(self.check(19.8)['verdict'], 'ok')

    def test_open_stretch_skips_the_beds_fade_in(self):
        # the title card 0-2.6 s: the bed fades in from silence over 1.5 s, then sits at -28.5 dBFS. Averaged from 0 s
        # it measures about -30.6 ("flat"); from 1.5 s it is the bed's real level.
        d = project(mix=bed(under=-41.0, open_=-28.5))
        out = mix_check.measure(d, loudness=False)
        self.assertAlmostEqual(out['music_open_dbfs'], -28.5, delta=0.5)
        self.assertEqual(mix_check.verdict(out), 'ok')
        head = mix_check.HEAD; mix_check.HEAD = 0   # the old measure, from 0 s
        try: old = mix_check.measure(d, loudness=False)
        finally: mix_check.HEAD = head
        self.assertLess(old['music_open_dbfs'], -30); self.assertTrue(mix_check.verdict(old).startswith('flat'))


@unittest.skipUnless(shutil.which('ffmpeg'), 'ffmpeg missing')
class Trim(unittest.TestCase):
    def test_mix_trims_the_bed_to_about_21_db(self):
        import export, score
        for level, moved in ((-26.0, True), (-15.0, True)):   # too quiet, too loud
            d = project(score=bed(under=level, open_=level, fade_in=1.5))
            with open(os.path.join(d, 'score.json'), 'w') as f:
                json.dump({'kind': 'library', 'score_wav': score.wav_sig(os.path.join(d, 'score.wav'))}, f)
            export.HERE = d; export.OUT = os.path.join(d, 'out'); os.makedirs(export.OUT, exist_ok=True)
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf): export.mix()
            log = buf.getvalue()
            self.assertIn('->', log, log)   # both numbers printed: before -> bed correction -> after
            first = float(log.split('mix: music ')[1].split(' dB')[0])
            self.assertFalse(20.5 <= first <= 21.5, first)
            got = mix_check.measure(d, loudness=False)['music_under_voice_db']
            self.assertAlmostEqual(got, 21.0, delta=0.6, msg=log)

    def test_a_bed_in_the_band_is_kept(self):
        import export, score
        d = project(score=bed(under=-22.9, open_=-22.9))
        with open(os.path.join(d, 'score.json'), 'w') as f:
            json.dump({'kind': 'library', 'score_wav': score.wav_sig(os.path.join(d, 'score.wav'))}, f)
        export.HERE = d; export.OUT = os.path.join(d, 'out'); os.makedirs(export.OUT, exist_ok=True)
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf): export.mix()
        self.assertIn('kept', buf.getvalue()); self.assertNotIn('->', buf.getvalue())
        self.assertTrue(20.5 <= mix_check.measure(d, loudness=False)['music_under_voice_db'] <= 21.5)


def quiet_head(head_db, body_db=-26.0):
    """a bed whose first seconds (the title card) sit at head_db and the rest at body_db, fading in over 1.5 s: a track
    that starts quietly (verify v1: warm -30.1, nostalgic -34.9 dBFS on the title card after the trim)"""
    rng = np.random.default_rng(3); n = int(TOTAL * SR); t = np.arange(n) / SR
    lvl = np.full(n, db(body_db), np.float32); lvl[t < 2.6] = db(head_db)
    return (rng.standard_normal(n) * lvl * np.clip(t / 1.5, 0, 1)).astype(np.float32)


@unittest.skipUnless(shutil.which('ffmpeg'), 'ffmpeg missing')
class OpenStretch(unittest.TestCase):   # fix round F6: one-scene clips failed "flat" on the track's first seconds
    def mix(self, sc):
        import export, score
        d = project(score=sc)
        with open(os.path.join(d, 'score.json'), 'w') as f:
            json.dump({'kind': 'library', 'score_wav': score.wav_sig(os.path.join(d, 'score.wav'))}, f)
        export.HERE = d; export.OUT = os.path.join(d, 'out'); os.makedirs(export.OUT, exist_ok=True)
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf): export.mix()
        out = mix_check.measure(d, loudness=False); out['verdict'] = mix_check.verdict(out)
        return buf.getvalue(), out

    def test_a_quiet_start_is_lifted_toward_minus_27(self):
        for head in (-30.0, -34.0):   # about -32 and -36 dBFS on the title card after the trim: "flat" before
            log, out = self.mix(quiet_head(head))
            self.assertIn('mix: open stretch -3', log, log)   # printed: before -> extra lift -> after
            self.assertTrue(-29.0 <= out['music_open_dbfs'] <= -26.0, (head, out, log))
            self.assertAlmostEqual(out['music_under_voice_db'], 21.0, delta=0.6)   # the lift leaves the voice's bed alone
            self.assertEqual(out['verdict'], 'ok', log); self.assertIn('mix: mix_check ok', log); self.assertNotIn('WARNING', log)

    def test_a_bed_at_level_is_not_lifted(self):
        log, out = self.mix(bed(under=-22.9, open_=-22.9))
        self.assertNotIn('open stretch', log); self.assertIn('mix: mix_check ok', log)

    def test_still_flat_is_a_visible_warning(self):   # +8 dB at most: a near-silent head stays flat, and says so
        log, out = self.mix(quiet_head(-40.0))
        self.assertTrue(out['verdict'].startswith('flat'), out)
        self.assertIn('mix: WARNING: mix_check will fail: flat', log); self.assertIn('lift hit its +8 dB bound', log)
        self.assertIn('lift +8.0 dB', log)

    def test_the_clamp_is_a_visible_warning(self):   # a bed ~43 dB under the voice: the trim stops at +12
        log, out = self.mix(bed(under=-45.0, open_=-45.0))
        self.assertIn('bed +12.0 dB', log); self.assertIn('hit the ±12 dB clamp', log)
        self.assertIn('mix: WARNING: mix_check will fail: too quiet', log)


if __name__ == '__main__':
    unittest.main()
