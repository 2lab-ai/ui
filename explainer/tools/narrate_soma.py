"""Narration through the soma-voice API on blade-4090 (Fish Speech S2 Pro), default voice `cwon`.

Run inside a video project folder (script.json there). Writes narration.wav + timeline.json.

- One async multi-turn job per scene: the model loads once (~45 s), then ~6 s per sentence.
- One turn per sentence, so every sentence has an exact start and end.
- Filler padding: each turn is sent as "아아. [pause] <sentence> [pause] 아아." and the filler is cut off again
  inside the [pause] silences (padcut.py). Fish otherwise starts and stops right at the sentence edge and can clip
  the first or last plosive; with the filler the sentence is mid-utterance on both sides.
- Ear check: everything cut off (prefix and suffix) is transcribed with mlx-whisper and must be positively heard as
  filler. Structure alone cannot tell a missing filler from a short first or last word. A take failing either check
  is re-synthesised with the next take seed (up to 3 rounds). `--no-verify` skips the ear check (not recommended).
- Cache: cache_voice/<key>.wav plus <key>.json, the take's record: text, take seed, the seed the server actually used
  (the API has no per-turn seed: turn i of a job seed s gets s+i), the raw take it was cut from, the cutter version
  and whether the ear check ran. A cached take is used only when its record matches the current cutter and check;
  otherwise it is re-cut from its raw take (no GPU) or re-synthesised.

usage: python narrate_soma.py [--voice cwon] [--no-pad] [--no-verify] [--redo scene:k[:seed],...] [--recut]
  SOMA_VOICE_TURN_S (default 40): seconds to wait per sentence of a scene job; a GPU shared with another model needs
  ~150. A run that gave up is re-run as is: it waits for the job it had submitted (job.json in the take folder).
  --recut  re-cut and re-check every cached take from its recorded raw take (no GPU). Takes without a record
           (made by an older version) are adopted only from a raw take of exactly the same text that passes both
           checks; anything else is dropped and re-synthesised on the next run.
The API is reached through an SSH tunnel to the Windows host (WSL uses mirrored networking):
    ssh -f -N -L 19999:127.0.0.1:9999 blade-4090-ps        (override the URL with SOMA_VOICE_URL)
The takes are copied from blade-4090 by tools/blade/fetchjob.sh; with SOMA_VOICE_FETCH=http they come from the job's
result URL instead (one job per scene cut at the merge's digital silence, no access to blade-4090 needed beyond the
tunnel). Jobs run one at a time on one worker thread; the next scene synthesises while this one is cut and checked.
"""
import concurrent.futures, hashlib, json, os, re, subprocess, sys, tempfile, time, urllib.error, urllib.request, wave
import numpy as np

TOOLS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOLS)
from padcut import PAD_HEAD, PAD_TAIL, cut, edge_db, edges_ok, is_filler_text, removed, split_at_silence  # noqa: E402
from ko_say import check_script, load_lexicon, spoken, strip_tags  # noqa: E402

PROJ = os.getcwd()
LEX = load_lexicon(PROJ)
API = os.environ.get('SOMA_VOICE_URL', 'http://127.0.0.1:19999')
SR = 48000
LEAD_TITLE, LEAD, TAIL = 2.6, 0.7, 1.1
GAP, GAP_Q = 0.50, 0.70            # silence between sentences (longer after a question)
CACHE = os.path.join(PROJ, 'cache_voice'); os.makedirs(CACHE, exist_ok=True)
FETCH = os.path.join(TOOLS, 'blade', 'fetchjob.sh')
# SOMA_VOICE_FETCH=http: no ssh to blade-4090 (a sandboxed session cannot read ~/.ssh). The API serves only a job's
# merged result, so the scene goes as one multi-turn job (the model loads once: ~6-20 s a sentence instead of ~55 s)
# merged with SPLIT_MS of digital silence between turns, and the result is cut at those all-zero runs. If the cut does
# not give one piece per sentence (a turn with its own long all-zero run), the scene falls back to one job per
# sentence. Job seed s + i keeps the server seed of turn i either way (see run_job).
FETCH_MODE = os.environ.get('SOMA_VOICE_FETCH', 'ssh')
CUTTER = 'padcut-v4'   # v4: an onset may hold a stop closure (v3 cut the 스 off 스토아); v3: follow the sound to the floor
ARGS = sys.argv[1:]
VOICE = ARGS[ARGS.index('--voice') + 1] if '--voice' in ARGS else 'cwon'
PAD = '--no-pad' not in ARGS
VERIFY = PAD and '--no-verify' not in ARGS
SPLIT_MS = 1000   # digital silence the server puts between turns of a merged http-mode result
JOB_ID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
_whisper = None


def say_of(s): return spoken(s, LEX)   # what the voice model gets: Hangul words (ko_say.py) + Drama 3 directions
def heard_of(s): return strip_tags(say_of(s))   # the words alone: timeline, word cues, hearing check


def http(method, path, body=None, timeout=60):
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def key_of(text, take):
    return hashlib.sha1(json.dumps([VOICE, take, text, 'pad1' if PAD else 'raw'], ensure_ascii=False).encode()).hexdigest()[:16]


def wav_read(path):
    """16-bit mono PCM -> float32. A wrong format or a payload shorter than the header declares raises wave.Error."""
    with wave.open(path) as w:
        if w.getnchannels() != 1 or w.getsampwidth() != 2:
            raise wave.Error(f'{path}: expected 16-bit mono, got {w.getnchannels()} ch / {w.getsampwidth() * 8} bit')
        n = w.getnframes(); data = w.readframes(n)
    if len(data) != 2 * n: raise wave.Error(f'{path}: truncated ({len(data)} of {2 * n} bytes)')
    return np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768


def wav_write(path, a):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes())


def ear(audio):
    """transcribe a piece (48 kHz mono float) with mlx-whisper."""
    global _whisper
    if _whisper is None:
        # a cached model needs no network; an online metadata check can hang the whole run
        if os.path.isdir(os.path.expanduser('~/.cache/huggingface/hub/models--mlx-community--whisper-large-v3-turbo')):
            os.environ.setdefault('HF_HUB_OFFLINE', '1')
        try:
            import mlx_whisper
        except ImportError:
            sys.exit('the ear check needs mlx-whisper in this venv (pip install mlx-whisper), or pass --no-verify')
        _whisper = mlx_whisper
    pad = np.zeros(int(0.15 * SR), np.float32)
    x = np.concatenate([pad, audio, pad])[::3]          # 48 kHz -> 16 kHz
    r = _whisper.transcribe(x, path_or_hf_repo='mlx-community/whisper-large-v3-turbo', language='ko',
                            temperature=0.0, condition_on_previous_text=False, initial_prompt='아아.')
    return r['text'].strip()


def process(raw_path):
    """raw take -> (clip, None) or (None, reason). Padded takes are cut and (if VERIFY) ear-checked."""
    try:
        a = wav_read(raw_path)
    except (OSError, EOFError, ValueError, wave.Error) as e:
        return None, f'unreadable raw take ({e.__class__.__name__})'
    if len(a) < SR // 10: return None, 'raw take too short'
    if not PAD: return a, None
    clip, info = cut(a, SR)
    if clip is None: return None, info
    if not edges_ok(clip, SR): return None, f'cut lands on sound (edges {edge_db(clip, SR)} dB vs speech)'
    if VERIFY:   # each side on its own: one pass over both can hear a single filler and miss the other side
        for side, piece in zip(('head', 'tail'), removed(a, SR, info)):
            heard = ear(piece)
            if not is_filler_text(heard): return None, f'{side} cut-off heard as {heard!r}'
    return clip, None


def sha1_file(path):
    with open(path, 'rb') as f: return hashlib.sha1(f.read()).hexdigest()


def read_record(path):
    """the take's record, or None when absent or malformed (a malformed record counts as stale)."""
    try:
        return json.load(open(path[:-4] + '.json'))
    except (OSError, ValueError):
        return None


def record_ok(rec, text, path):
    return bool(rec and rec.get('text') == text and rec.get('voice') == VOICE and rec.get('cutter') == (CUTTER if PAD else 'none')
                and (rec.get('verified') or not VERIFY) and os.path.exists(path) and rec.get('wav_sha1') == sha1_file(path))


def store(path, clip, text, take, server_seed, raw):
    """publish wav + record via temp files and atomic replaces. The old record stays until the new one replaces it:
    in between, the record's wav digest no longer matches, so the take reads as stale (re-cut from the recorded raw
    take), never as record-less (which would allow adopting another take)."""
    side = path[:-4] + '.json'
    d = os.path.dirname(path)
    fd, tw = tempfile.mkstemp(suffix='.wav.tmp', dir=d); os.close(fd)
    wav_write(tw, clip)
    rec = {'text': text, 'voice': VOICE, 'take': take, 'server_seed': server_seed, 'raw': os.path.relpath(raw, PROJ),
           'cutter': CUTTER if PAD else 'none', 'verified': VERIFY, 'wav_sha1': sha1_file(tw)}
    fd, tj = tempfile.mkstemp(suffix='.json.tmp', dir=d)
    with os.fdopen(fd, 'w') as f: json.dump(rec, f, ensure_ascii=False)
    os.replace(tw, path); os.replace(tj, side)


def drop(path):
    for p in (path, path[:-4] + '.json'):
        if os.path.exists(p): os.remove(p)


def usable(path, text):
    """a cached take is used only with a matching record; a stale record is re-cut from its raw take."""
    rec = read_record(path)
    if not rec or not os.path.exists(path):
        drop(path); return False
    if record_ok(rec, text, path): return True
    raw = os.path.join(PROJ, rec.get('raw') or '')
    if rec.get('text') == text and rec.get('voice') == VOICE and os.path.isfile(raw):
        clip, why = process(raw)
        if clip is not None:
            store(path, clip, text, rec.get('take'), rec.get('server_seed'), raw); return True
        print(f'    stale take {os.path.basename(path)} fails now ({why})', flush=True)
    drop(path)
    return False


def fetch_result(job, dst, timeout=900):
    """GET /api/jobs/{id}/result until it is ready (202 while running); writes the audio file as served."""
    t0 = time.time()
    while True:
        req = urllib.request.Request(API + f'/api/jobs/{job}/result', method='GET')
        with urllib.request.urlopen(req, timeout=120) as r:
            if r.status == 200:
                data = r.read()
                if len(data) < 1000: sys.exit(f'job {job}: result is only {len(data)} bytes')
                open(dst, 'wb').write(data)
                return dst
        if time.time() - t0 > timeout: sys.exit(f'job {job}: no result after {timeout}s')
        time.sleep(3)


class JobFailed(RuntimeError):
    """The server marked a job failed. Drama 3's engine process can die mid-job ("Remote end closed connection
    without response", 2026-11-14) and is restarted by its supervisor, so the caller submits the job again."""


def wait_job(job, tag, limit):
    t0 = time.time()
    while True:
        st = http('GET', f'/api/jobs/{job}')
        if st['status'] in ('succeeded', 'completed'): return st
        if st['status'] == 'failed': raise JobFailed(f'{tag}: job {job} failed: {st.get("error")}')
        if time.time() - t0 > limit: sys.exit(f'{tag}: job {job} still {st["status"]} after {limit:.0f} s')
        time.sleep(3)


RESUBMITS = 3   # a failed job is submitted again this many times before the run stops


def healthy(wait=180):
    """Wait until /health answers ok (the engine restarts after a crash)."""
    t0 = time.time()
    while time.time() - t0 < wait:
        try:
            if http('GET', '/health', timeout=10).get('status') == 'ok': return True
        except (OSError, ValueError):
            pass
        time.sleep(10)
    return False


def retry_failed(e, tag, attempt):
    """After a failed job: stop on the last attempt, else wait for the server and say so."""
    if attempt >= RESUBMITS: sys.exit(str(e))
    print(f'  {tag}: {e}; submitting it again ({attempt + 1}/{RESUBMITS})', flush=True)
    time.sleep(20)
    if not healthy(): sys.exit(f'{e}; the voice server did not come back')


TURN_S = float(os.environ.get('SOMA_VOICE_TURN_S', '40'))   # wait per turn before giving up; a shared GPU needs more


def live_job(tmp):
    """The job this folder's last run submitted, if the server still has it running or finished. None when there is
    none to resume: no job.json, the server answers 404 (a restart forgot it) or the job failed. Any other error (a
    timeout, a 5xx) is retried and then stops the run: it is no proof the job is gone, and submitting it again would
    run the same scene twice on a shared GPU."""
    try:
        job = json.load(open(os.path.join(tmp, 'job.json')))['job']
    except (OSError, ValueError, KeyError, TypeError):
        return None
    if not isinstance(job, str) or not JOB_ID.match(job): return None
    for attempt in range(3):
        try:
            st = http('GET', f'/api/jobs/{job}')
            return job if st.get('status') in ('pending', 'queued', 'running', 'succeeded', 'completed') else None
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
            err = e
        except (OSError, ValueError) as e:   # URLError and timeouts are OSErrors
            err = e
        time.sleep(5 * (attempt + 1))
    sys.exit(f'job {job}: could not ask the voice server whether it is still running ({err}); re-run when it answers')


def run_jobs_http(texts, seed, tag):
    """SOMA_VOICE_FETCH=http: one multi-turn job, split at the merge's silences (see SPLIT_MS); one job per text when
    that fails. Returns local raw wav paths in order (48 kHz mono)."""
    t0 = time.time(); out = []
    req = json.dumps([VOICE, PAD, list(texts)], ensure_ascii=False).encode()   # everything that shapes the takes
    tmp = os.path.join(CACHE, f'http_{seed}_{hashlib.sha1(req).hexdigest()[:8]}')
    os.makedirs(tmp, exist_ok=True)
    try:   # a run cut off after the job finished: its pieces are already here (same texts, seed, voice, padding)
        m = json.load(open(os.path.join(tmp, 'manifest.json')))
        done = [os.path.join(tmp, f'r{i:03d}.wav') for i in range(len(texts))]
        if (m.get('texts'), m.get('seed'), m.get('voice'), m.get('pad')) == (list(texts), seed, VOICE, PAD) \
                and all(os.path.isfile(p) for p in done):
            print(f'  {tag}: {len(texts)} sentences from the finished job in {os.path.basename(tmp)}', flush=True)
            return done
    except (OSError, ValueError):
        pass
    try:   # this folder is rewritten now: until the new manifest lands it must not read as finished
        os.remove(os.path.join(tmp, 'manifest.json'))
    except FileNotFoundError:
        pass
    if len(texts) > 1:
        turns = [{'voice': VOICE, 'text': (PAD_HEAD + t + PAD_TAIL) if PAD else t} for t in texts]
        forgot = False
        for attempt in range(RESUBMITS + 1):
            job = live_job(tmp) if attempt == 0 else None   # a run cut off while its job still ran picks it up again
            if not job:
                job = http('POST', '/api/tts', {'mode': 'async', 'format': 'wav', 'seed': seed, 'turns': turns,
                                                'merge_policy': {'silence_min_ms': SPLIT_MS, 'silence_max_ms': SPLIT_MS}})['job_id']
                if not JOB_ID.match(job): sys.exit(f'{tag}: unexpected job id {job!r}')
                json.dump({'job': job}, open(os.path.join(tmp, 'job.json'), 'w'))
            else:
                print(f'  {tag}: resuming job {job[:8]}', flush=True)
            try:
                wait_job(job, tag, 180 + TURN_S * len(texts))
                src = fetch_result(job, os.path.join(tmp, 'merged'))
                break
            except JobFailed as e:
                retry_failed(e, tag, attempt)
            except urllib.error.HTTPError as e:   # 404: the service restarted and forgot its jobs (2026-11-14)
                if e.code != 404 or forgot: raise
                forgot = True
                print(f'  {tag}: the server forgot job {job[:8]} (restarted?); submitting it again', flush=True)
        else:
            sys.exit(f'{tag}: no job finished after {RESUBMITS + 1} submissions')
        sr = int(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate',
                                 '-of', 'csv=p=0', src], capture_output=True, text=True, check=True).stdout.strip())
        pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-f', 's16le', '-ac', '1', '-'], capture_output=True, check=True).stdout
        pieces = split_at_silence(np.frombuffer(pcm, np.int16), sr, len(texts), 0.9 * SPLIT_MS / 1000, 1.5 * SPLIT_MS / 1000)
        if pieces is not None:
            for i, pc in enumerate(pieces):
                p0, p = os.path.join(tmp, f's{i:03d}.raw'), os.path.join(tmp, f'r{i:03d}.wav')
                pc.tofile(p0)
                subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(sr), '-ac', '1', '-i', p0,
                                '-ar', str(SR), '-ac', '1', p], check=True)
                os.remove(p0); out.append(p)
            json.dump({'jobs': 'http-split', 'job': job, 'seed': seed, 'texts': texts, 'voice': VOICE, 'pad': PAD},
                      open(os.path.join(tmp, 'manifest.json'), 'w'), ensure_ascii=False)
            print(f'  {tag}: {len(texts)} sentences in {time.time() - t0:.0f}s (http, one job {job[:8]}, split)', flush=True)
            return out
        print(f'  {tag}: merged result did not split into {len(texts)} turns; one job per sentence', flush=True)
    for i, t in enumerate(texts):
        body = {'mode': 'async', 'format': 'wav', 'seed': seed + i, 'turns': [{'voice': VOICE, 'text': (PAD_HEAD + t + PAD_TAIL) if PAD else t}]}
        for attempt in range(RESUBMITS + 1):
            job = http('POST', '/api/tts', body)['job_id']
            if not JOB_ID.match(job): sys.exit(f'{tag}: unexpected job id {job!r}')
            try:
                wait_job(job, f'{tag}:{i}', 900)
                break
            except JobFailed as e:
                retry_failed(e, f'{tag}:{i}', attempt)
        src = fetch_result(job, os.path.join(tmp, f'src{i:03d}'))
        p = os.path.join(tmp, f'r{i:03d}.wav')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-ar', str(SR), '-ac', '1', p], check=True)
        out.append(p)
    json.dump({'jobs': 'http', 'seed': seed, 'texts': texts, 'voice': VOICE, 'pad': PAD},
              open(os.path.join(tmp, 'manifest.json'), 'w'), ensure_ascii=False)
    print(f'  {tag}: {len(texts)} sentences in {time.time() - t0:.0f}s (http, {len(texts)} jobs)', flush=True)
    return out


def run_job(texts, seed, tag):
    """one async job, one turn per text; returns local raw wav paths in order (48 kHz mono)."""
    if FETCH_MODE == 'http': return run_jobs_http(texts, seed, tag)
    turns = [{'voice': VOICE, 'text': (PAD_HEAD + t + PAD_TAIL) if PAD else t} for t in texts]
    body = {'mode': 'async', 'format': 'wav', 'seed': seed, 'turns': turns,
            'merge_policy': {'silence_min_ms': 100, 'silence_max_ms': 100}}
    t0 = time.time()
    job = http('POST', '/api/tts', body)['job_id']
    if not JOB_ID.match(job): sys.exit(f'{tag}: unexpected job id {job!r}')
    while True:
        st = http('GET', f'/api/jobs/{job}')
        if st['status'] in ('succeeded', 'completed'): break
        if st['status'] == 'failed': sys.exit(f'{tag}: job {job} failed: {st.get("error")}')
        time.sleep(4)
    tmp = os.path.join(CACHE, 'job_' + job); os.makedirs(tmp, exist_ok=True)
    if subprocess.run([FETCH, job, tmp]).returncode != 0:
        sys.exit(f'{tag}: copying job {job} from blade-4090 failed — without that access, run with SOMA_VOICE_FETCH=http')
    chunks = st['response']['chunks']
    if len(chunks) != len(texts): sys.exit(f'{tag}: expected {len(texts)} chunks, got {len(chunks)} (a turn was split)')
    out = []
    for i, ch in enumerate(chunks):
        p = os.path.join(tmp, f'r{i:03d}.wav')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(tmp, os.path.basename(ch['path'])),
                        '-ar', str(SR), '-ac', '1', p], check=True)
        out.append(p)
    json.dump({'job': job, 'seed': seed, 'texts': texts, 'voice': VOICE, 'pad': PAD},
              open(os.path.join(tmp, 'manifest.json'), 'w'), ensure_ascii=False)
    print(f'  {tag}: {len(texts)} sentences in {time.time() - t0:.0f}s (job {job[:8]})', flush=True)
    return out


GPU = concurrent.futures.ThreadPoolExecutor(max_workers=1)   # one job at a time, in submission order
AHEAD = {}   # scene -> ((texts, seed), future): its first job, synthesising while the scene before is cut and checked
FATAL = []   # set by the first failed job: nothing queued after it reaches the server (its job may still be running)


def gpu_job(texts, seed, tag):
    if FATAL: raise SystemExit(f'{tag}: not started, an earlier job failed ({FATAL[0]})')
    try:
        return run_job(texts, seed, tag)
    except BaseException as e:
        FATAL.append(f'{tag}: {e}'); raise


def job(texts, seed, tag, scene):
    """the future of run_job(texts, seed): the scene's job queued ahead when it is for exactly these texts and seed
    (otherwise that one is cancelled, or left to finish if it already runs), else a new one."""
    k, fut = AHEAD.pop(scene, (None, None))
    if fut is not None and k == (tuple(texts), seed): return fut
    if fut is not None: fut.cancel()
    return GPU.submit(gpu_job, list(texts), seed, tag)


def rescuable(rec, text):
    """usable() would re-cut this take from its recorded raw take (no GPU)."""
    return bool(rec and rec.get('text') == text and rec.get('voice') == VOICE and os.path.isfile(os.path.join(PROJ, rec.get('raw') or '')))


def ahead(items, tag):
    """queue a scene's first job now, for the takes neither recorded nor rescuable from a raw take."""
    paths = [os.path.join(CACHE, f'{key_of(t, k)}.wav') for t, k in items]
    recs = [read_record(p) for p in paths]
    todo = [i for i, p in enumerate(paths) if not record_ok(recs[i], items[i][0], p) and not rescuable(recs[i], items[i][0])]
    if todo and tag not in AHEAD:
        texts, seed = tuple(items[i][0] for i in todo), items[todo[0]][1]
        AHEAD[tag] = ((texts, seed), GPU.submit(gpu_job, list(texts), seed, f'{tag} r0'))


STUBBORN = []   # scene:k that failed 3 rounds; the run finishes every other scene, then stops (re-run with --redo)


def synth_scene(items, tag):
    """items: [(text, take)]. Failed cuts / ear checks retry with a new job seed (3 rounds)."""
    paths = [os.path.join(CACHE, f'{key_of(t, k)}.wav') for t, k in items]
    for rnd in range(3):
        todo = [i for i, p in enumerate(paths) if not usable(p, items[i][0])]
        if not todo: return paths
        job_seed = items[todo[0]][1] + 1000 * rnd
        raws = job([items[i][0] for i in todo], job_seed, f'{tag} r{rnd}', tag).result()
        for pos, (i, raw) in enumerate(zip(todo, raws)):
            clip, why = process(raw)
            if clip is None:
                print(f'    {tag}:{i} rejected ({why}); retrying', flush=True); continue
            store(paths[i], clip, items[i][0], items[i][1], job_seed + pos, raw)
            if rnd > 0: print(f'    {tag}:{i} fixed in round {rnd}', flush=True)
    missing = [i for i, p in enumerate(paths) if not usable(p, items[i][0])]
    if missing:   # keep the queue busy with the other scenes; the run stops before the timeline (see main)
        STUBBORN.extend(f'{tag}:{i}' for i in missing)
        print(f'  {tag}: sentences {missing} still failed the pad cut / ear check after 3 rounds; going on', flush=True)
        return None
    return paths


def raw_takes():
    """{text: [raw path, ...]} from job folders whose voice and padding are positively known: a manifest naming both,
    or a legacy status.json whose chunks name the voice and carry the padded text. Unknown provenance is skipped."""
    out = {}
    for d in sorted(os.listdir(CACHE)):
        jd = os.path.join(CACHE, d)
        if not d.startswith('job_') or not os.path.isdir(jd): continue
        try:
            mp = os.path.join(jd, 'manifest.json')
            m = json.load(open(mp)) if os.path.exists(mp) else {}
            if 'voice' in m and 'pad' in m:
                if m['voice'] != VOICE or m['pad'] != PAD: continue
                texts = m['texts']
            else:
                chunks = json.load(open(os.path.join(jd, 'status.json')))['result']['chunks']
                if not all(c.get('voice') == VOICE and c['text'].startswith(PAD_HEAD) == PAD for c in chunks): continue
                texts = [c['text'].removeprefix(PAD_HEAD).removesuffix(PAD_TAIL) for c in chunks]
        except (OSError, KeyError, TypeError, ValueError) as e:
            print(f'  skip incomplete job folder {d} ({e.__class__.__name__})', flush=True); continue
        for i, t in enumerate(texts):
            raw = os.path.join(jd, f'r{i:03d}.wav')
            if os.path.isfile(raw): out.setdefault(t, []).append(raw)
    return out


def recut(script, seeds):
    if not PAD: sys.exit('--recut applies to padded takes; it cannot be combined with --no-pad')
    takes = None; kept = adopted = dropped = 0
    for j, sc in enumerate(script['scenes']):
        for k, s in enumerate(sc['sentences']):
            text, take = say_of(s), seeds.get(f'{sc["id"]}:{k}', 100 + 17 * j + k)
            path = os.path.join(CACHE, f'{key_of(text, take)}.wav'); side = path[:-4] + '.json'
            rec = read_record(path)
            if rec is not None or os.path.exists(side):    # a record exists (maybe malformed): only its own raw take counts
                raw = os.path.join(PROJ, (rec or {}).get('raw') or '')
                if rec and rec.get('text') == text and rec.get('voice') == VOICE and os.path.isfile(raw):
                    clip, why = process(raw)
                    if clip is not None:
                        store(path, clip, text, take, rec.get('server_seed'), raw); kept += 1; continue
                    print(f'  {sc["id"]}:{k} its take fails now ({why})', flush=True)
                else:
                    print(f'  {sc["id"]}:{k} its recorded raw take is gone or does not match', flush=True)
            elif os.path.exists(path):           # legacy take without any record: adopt a verified raw take of this text
                takes = takes if takes is not None else raw_takes()
                found = None
                for raw in takes.get(text, []):
                    clip, why = process(raw)
                    if clip is not None:
                        store(path, clip, text, take, None, raw); found = raw; break
                if found:
                    adopted += 1; continue
                print(f'  {sc["id"]}:{k} no verified raw take of this text', flush=True)
            else:
                continue
            drop(path); dropped += 1
    print(f'recut: {kept} re-checked, {adopted} adopted, {dropped} dropped (re-synthesised on the next run)')


def trim(a, thr_db=-60, pad=0.06):
    """unpadded takes only: drop leading/trailing silence. -60 dB, not -42: a soft final syllable (-다 fading at -41..-56
    dB) is speech. Padded takes are never trimmed; padcut already cut them where the sound settles."""
    hop = int(0.01 * SR); n = len(a) // hop
    db = 20 * np.log10(np.sqrt(np.mean(a[:n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12))
    on = np.where(db > thr_db)[0]
    if len(on) == 0: return a
    return a[max(0, on[0] * hop - int(pad * SR)):min(len(a), (on[-1] + 1) * hop + int(pad * SR))]


def level(a):
    hop = int(0.02 * SR); n = len(a) // hop
    rms = np.sqrt(np.mean(a[:n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    act = rms[20 * np.log10(rms) > -45]
    return 20 * np.log10(np.sqrt(np.mean(act ** 2))) if len(act) else -60


def word_times(text, t0, dur):
    """estimated word starts inside the voiced span, proportional to characters (+2 per comma/period pause)."""
    toks = [(re.sub(r"[.,?!'\"‘’“”…]", '', tok), tok) for tok in text.split()]
    toks = [(w, tok) for w, tok in toks if w]
    weights = [len(w) + (2 if re.search(r'[,.?!]$', tok) else 0) for w, tok in toks]
    total = sum(weights) or 1; acc, out = 0, []
    for (w, _tok), wt in zip(toks, weights):
        out.append({'t': round(t0 + dur * acc / total, 3), 'd': round(dur * len(w) / total, 3), 'w': w})
        acc += wt
    return out


def main():
    script = json.load(open(os.path.join(PROJ, 'script.json')))
    check_script(script, LEX)   # nothing raw reaches the voice model; fails before any GPU job
    seeds_path = os.path.join(PROJ, 'seeds.json')
    seeds = json.load(open(seeds_path)) if os.path.exists(seeds_path) else {}
    if '--redo' in ARGS:   # scene:k[:seed] -> new take for one sentence, so only it re-synthesises
        for spec in ARGS[ARGS.index('--redo') + 1].split(','):
            p = spec.split(':'); sid, k = p[0], int(p[1])
            seeds[f'{sid}:{k}'] = int(p[2]) if len(p) > 2 else seeds.get(f'{sid}:{k}', 5000) + 1
        json.dump(seeds, open(seeds_path, 'w'), indent=1)
    if '--recut' in ARGS:
        recut(script, seeds); return
    clips = {}
    items = [[(say_of(s), seeds.get(f'{sc["id"]}:{k}', 100 + 17 * j + k)) for k, s in enumerate(sc['sentences'])]
             for j, sc in enumerate(script['scenes'])]
    ids = [sc['id'] for sc in script['scenes']]
    if ids: ahead(items[0], ids[0])
    for j, sc in enumerate(script['scenes']):
        if j + 1 < len(ids): ahead(items[j + 1], ids[j + 1])   # the GPU works on the next scene meanwhile
        got = synth_scene(items[j], sc['id'])
        if got is not None: clips[sc['id']] = [wav_read(p) if PAD else trim(wav_read(p)) for p in got]
    if STUBBORN:
        sys.exit(f'stopped before the timeline: {",".join(STUBBORN)} failed 3 rounds; every other take is cached. '
                 f'Re-run with --redo {",".join(STUBBORN)} (a new take seed), or reword the sentence.')
    target = float(np.median([level(c) for cs in clips.values() for c in cs]))
    t = 0.0; scenes = []; track = []
    for sc in script['scenes']:
        lead = LEAD_TITLE if sc.get('subtitle') else LEAD
        start, t0, cur = t, t + lead, 0.0
        pieces, sents, words = [], [], []
        cs = clips[sc['id']]
        for k, (s, c) in enumerate(zip(sc['sentences'], cs)):
            c = c * (10 ** (np.clip(target - level(c), -6, 6) / 20))
            d = len(c) / SR
            gap = (GAP_Q if heard_of(s).rstrip().endswith('?') else GAP) if k + 1 < len(cs) else 0.0
            sents.append({'text': s['text'], 'say': heard_of(s), 'start': round(t0 + cur, 3), 'end': round(t0 + cur + d, 3), 'dur': round(d + gap, 3)})
            words += word_times(heard_of(s), t0 + cur + 0.06, max(0.1, d - 0.12))
            pieces += [c, np.zeros(int(gap * SR), np.float32)]
            cur += d + gap
        audio = np.concatenate(pieces)
        dur = lead + len(audio) / SR + TAIL
        track += [np.zeros(int(lead * SR), np.float32), audio, np.zeros(int(TAIL * SR), np.float32)]
        scenes.append({'id': sc['id'], 'chip': sc['chip'], 'title': sc['title'], 'subtitle': sc.get('subtitle', ''),
                       'start': round(start, 3), 'lead': lead, 'dur': round(dur, 3), 'sentences': sents, 'words': words})
        t += dur
        print(f'{sc["id"]:8s} speech {len(audio) / SR:6.1f}s  scene {dur:6.1f}s', flush=True)
    raw = os.path.join(PROJ, 'narration_raw.wav'); wav_write(raw, np.concatenate(track))
    m = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', raw, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    lufs = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', m)[-1])
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', f'volume={-18.5 - lufs:.2f}dB,alimiter=limit=0.89:level=false:latency=1',
                    '-ar', str(SR), '-ac', '1', os.path.join(PROJ, 'narration.wav')], check=True)
    tl = {'total': round(t, 3), 'fps': 30, 'title': script['title'], 'subtitle': script.get('subtitle', ''),
          'voice': f'soma-voice:{VOICE}' + (':pad' if PAD else ''), 'scenes': scenes}
    json.dump(tl, open(os.path.join(PROJ, 'timeline.json'), 'w'), ensure_ascii=False, indent=1)
    print(f'TOTAL {t:.1f}s = {t / 60:.2f} min (raw {lufs:.1f} LUFS -> -18.5)')


if __name__ == '__main__':
    try:
        main()
    finally:   # an exit (a failed job, ^C) drops whatever is still queued instead of running it
        GPU.shutdown(wait=False, cancel_futures=True)
