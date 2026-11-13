"""narrate_soma's job queue (no server): one worker, a failed job stops the queue, an ahead job is used only for the
exact texts and seed it was queued for."""
import importlib, os, sys, tempfile, threading, time, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def load():
    """import narrate_soma inside an empty project folder (it makes cache_voice/ in the working directory)."""
    cwd, argv = os.getcwd(), sys.argv
    os.chdir(tempfile.mkdtemp()); sys.argv = ['narrate_soma.py']
    try:
        sys.modules.pop('narrate_soma', None)
        return importlib.import_module('narrate_soma')
    finally:
        os.chdir(cwd); sys.argv = argv


class Queue(unittest.TestCase):
    def setUp(self):
        self.n = load(); self.calls = []; self.gate = threading.Event()
        def fake(texts, seed, tag):
            self.calls.append((tag, tuple(texts), seed))
            if tag.startswith('slow'): self.gate.wait(2)
            if tag.startswith('bad'): raise SystemExit(f'{tag}: job failed')
            return [f'{t}.wav' for t in texts]
        self.n.run_job = fake

    def tearDown(self):
        self.n.GPU.shutdown(wait=True, cancel_futures=True)

    def test_a_failed_job_stops_everything_queued_after_it(self):
        f1 = self.n.GPU.submit(self.n.gpu_job, ['a'], 1, 'bad r0')
        f2 = self.n.GPU.submit(self.n.gpu_job, ['b'], 2, 'next r0')
        with self.assertRaises(SystemExit): f1.result()
        with self.assertRaises(SystemExit) as e: f2.result()
        self.assertIn('not started', str(e.exception))
        self.assertEqual([c[0] for c in self.calls], ['bad r0'])   # the second never reached the server

    def test_ahead_job_is_used_only_for_its_own_texts_and_seed(self):
        self.n.GPU.submit(self.n.gpu_job, ['x'], 9, 'slow r0')   # keeps the worker busy so the ahead job waits
        queued = self.n.GPU.submit(self.n.gpu_job, ['a', 'b'], 100, 's r0')
        self.n.AHEAD['s'] = ((('a', 'b'), 100), queued)
        fut = self.n.job(['a', 'b'], 100, 's r0', 's')
        self.assertIs(fut, queued)   # popped and returned as is, no second job
        self.assertNotIn('s', self.n.AHEAD)
        self.gate.set(); self.assertEqual(fut.result(), ['a.wav', 'b.wav'])

    def test_a_stale_ahead_job_is_cancelled(self):
        self.n.GPU.submit(self.n.gpu_job, ['x'], 9, 'slow r0')
        stale = self.n.GPU.submit(self.n.gpu_job, ['a', 'b'], 100, 's r0')
        self.n.AHEAD['s'] = ((('a', 'b'), 100), stale)
        fut = self.n.job(['b'], 101, 's r0', 's')   # synth_scene now needs only one take
        self.gate.set(); self.assertEqual(fut.result(), ['b.wav'])
        self.assertTrue(stale.cancelled())
        self.assertNotIn(('s r0', ('a', 'b'), 100), self.calls)


if __name__ == '__main__':
    unittest.main()
