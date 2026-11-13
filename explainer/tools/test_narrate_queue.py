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


class HttpCache(unittest.TestCase):
    """a finished http job is reused only for the same texts, seed, voice and padding (no server)."""
    def setUp(self):
        self.n = load()
        def no_server(*a, **k): raise RuntimeError('server called')
        self.n.http = no_server

    def finished(self, texts, seed):
        """run the reuse path's folder logic once by writing what a finished job leaves behind."""
        import hashlib, json
        req = json.dumps([self.n.VOICE, self.n.PAD, list(texts)], ensure_ascii=False).encode()
        tmp = os.path.join(self.n.CACHE, f'http_{seed}_{hashlib.sha1(req).hexdigest()[:8]}')
        os.makedirs(tmp, exist_ok=True)
        for i in range(len(texts)): open(os.path.join(tmp, f'r{i:03d}.wav'), 'wb').write(b'x')
        json.dump({'texts': list(texts), 'seed': seed, 'voice': self.n.VOICE, 'pad': self.n.PAD},
                  open(os.path.join(tmp, 'manifest.json'), 'w'), ensure_ascii=False)
        return tmp

    def test_same_request_is_reused_without_the_server(self):
        tmp = self.finished(['가', '나'], 7)
        self.assertEqual(self.n.run_jobs_http(['가', '나'], 7, 't'), [os.path.join(tmp, 'r000.wav'), os.path.join(tmp, 'r001.wav')])

    def test_another_voice_does_not_reuse_it(self):
        self.finished(['가', '나'], 7)
        self.n.VOICE = 'elon'
        with self.assertRaises(RuntimeError): self.n.run_jobs_http(['가', '나'], 7, 't')


class ForgottenJob(unittest.TestCase):
    """a server restart forgets its jobs: a 404 while waiting submits the job once more (2026-11-14), never twice."""
    def setUp(self):
        import urllib.error
        self.n = load(); self.posts = []; self.fetched = []
        ids = ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333']
        def http(method, path, body=None, timeout=60):
            if method == 'POST': self.posts.append(body); return {'job_id': ids[len(self.posts) - 1]}
            raise urllib.error.HTTPError(path, 404, 'not found', {}, None)   # live_job: nothing to resume
        self.gone = set()
        def wait_job(job, tag, limit):
            if job in self.gone: raise urllib.error.HTTPError(job, 404, 'not found', {}, None)
        def fetch_result(job, dst, timeout=900):
            self.fetched.append(job); raise KeyboardInterrupt   # stop before ffprobe: the job id is what is checked
        self.n.http, self.n.wait_job, self.n.fetch_result = http, wait_job, fetch_result
        self.ids = ids

    def test_resubmits_once_after_a_404(self):
        self.gone = {self.ids[0]}
        with self.assertRaises(KeyboardInterrupt): self.n.run_jobs_http(['가', '나'], 7, 't')
        self.assertEqual(len(self.posts), 2); self.assertEqual(self.fetched, [self.ids[1]])

    def test_a_second_404_stops(self):
        import urllib.error
        self.gone = {self.ids[0], self.ids[1]}
        with self.assertRaises(urllib.error.HTTPError): self.n.run_jobs_http(['가', '나'], 7, 't')
        self.assertEqual(len(self.posts), 2); self.assertEqual(self.fetched, [])


if __name__ == '__main__':
    unittest.main()
