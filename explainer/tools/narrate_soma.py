"""Narration through the soma-voice API on blade-4090 (Fish Speech S2 Pro), default voice `cwon`.

Run inside a video project folder (script.json there). Writes narration.wav + timeline.json.

- One async multi-turn job per scene: the model loads once (~45 s), then ~6 s per sentence.
- One turn per sentence, so every sentence has an exact start and end.
- Filler padding: each turn is sent as "아아. [pause] <sentence> [pause] 아아." and the filler is cut off again
  inside the [pause] silence (padcut.py). Fish otherwise starts and stops right at the sentence edge and can clip
  the first or last plosive; with the filler the sentence is mid-utterance on both sides.
- Ear check: the two cut-off pieces are transcribed (mlx-whisper) and must hold only the filler. Structure alone
  cannot tell a missing filler from a short first or last word, so a take that fails either check is re-synthesised
  with the next take seed (up to 3 rounds). `--no-verify` skips the ear check (not recommended).
- Seeds: the API has no per-turn seed; a job's seed s gives turn i the seed s+i. The number in the cache key is a
  take handle (re-roll it with --redo); the seed the server actually used is recorded in cache_voice/<key>.json.

usage: python narrate_soma.py [--voice cwon] [--no-pad] [--no-verify] [--redo scene:k[:seed],...] [--recut]
  --recut  re-cut every cached sentence from the raw takes kept in cache_voice/job_*/ (no GPU), dropping takes
           that fail, so the next run re-synthesises only those
The API is reached through an SSH tunnel to the Windows host (WSL uses mirrored networking):
    ssh -f -N -L 19999:127.0.0.1:9999 blade-4090-ps        (override the URL with SOMA_VOICE_URL)
"""
import hashlib, json, os, re, subprocess, sys, time, urllib.request, wave
import numpy as np

TOOLS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOLS)
from padcut import PAD_HEAD, PAD_TAIL, cut, is_filler_text, removed  # noqa: E402

PROJ = os.getcwd()
API = os.environ.get('SOMA_VOICE_URL', 'http://127.0.0.1:19999')
SR = 48000
LEAD_TITLE, LEAD, TAIL = 2.6, 0.7, 1.1
GAP, GAP_Q = 0.50, 0.70            # silence between sentences (longer after a question)
CACHE = os.path.join(PROJ, 'cache_voice'); os.makedirs(CACHE, exist_ok=True)
FETCH = os.path.join(TOOLS, 'blade', 'fetchjob.sh')
ARGS = sys.argv[1:]
VOICE = ARGS[ARGS.index('--voice') + 1] if '--voice' in ARGS else 'cwon'
PAD = '--no-pad' not in ARGS
VERIFY = PAD and '--no-verify' not in ARGS
JOB_ID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
_whisper = None


def ear(audio):
    """transcribe a short piece (48 kHz mono float) with mlx-whisper."""
    global _whisper
    if _whisper is None:
        # a cached model needs no network; an online metadata check can hang the whole run
        if os.path.isdir(os.path.expanduser('~/.cache/huggingface/hub/models--mlx-community--whisper-large-v3-turbo')):
            os.environ.setdefault('HF_HUB_OFFLINE', '1')
        try:
            import mlx_whisper
        except ImportError:
            sys.exit('ear check needs mlx-whisper in this venv (pip install mlx-whisper), or pass --no-verify')
        _whisper = mlx_whisper
    pad = np.zeros(int(0.15 * SR), np.float32)
    x = np.concatenate([pad, audio, pad])[::3]          # 48 kHz -> 16 kHz
    r = _whisper.transcribe(x, path_or_hf_repo='mlx-community/whisper-large-v3-turbo', language='ko',
                            temperature=0.0, condition_on_previous_text=False, initial_prompt='아아.')
    return r['text'].strip()


def cut_and_check(a):
    """(clip, None) or (None, reason)."""
    clip, info = cut(a, SR)
    if clip is None: return None, info
    if VERIFY:
        for side, piece in zip(('head', 'tail'), removed(a, SR, info)):
            heard = ear(piece)
            if not is_filler_text(heard): return None, f'{side} piece heard as {heard!r}'
    return clip, None


def say_of(s): return s.get('say', s['text'])


def http(method, path, body=None, timeout=60):
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def key_of(text, seed):
    return hashlib.sha1(json.dumps([VOICE, seed, text, 'pad1' if PAD else 'raw'], ensure_ascii=False).encode()).hexdigest()[:16]


def wav_read(path):
    with wave.open(path) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768


def wav_write(path, a):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes())


def run_job(texts, seed, tag):
    """one async job, one turn per text; returns local raw wav paths in order (48 kHz mono)."""
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
    subprocess.run([FETCH, job, tmp], check=True)
    chunks = st['response']['chunks']
    if len(chunks) != len(texts): sys.exit(f'{tag}: expected {len(texts)} chunks, got {len(chunks)} (a turn was split)')
    out = []
    json.dump({'job': job, 'seed': seed, 'texts': texts}, open(os.path.join(tmp, 'manifest.json'), 'w'), ensure_ascii=False)
    for i, ch in enumerate(chunks):
        p = os.path.join(tmp, f'r{i:03d}.wav')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(tmp, os.path.basename(ch['path'])),
                        '-ar', str(SR), '-ac', '1', p], check=True)
        out.append(p)
    print(f'  {tag}: {len(texts)} sentences in {time.time() - t0:.0f}s (job {job[:8]})', flush=True)
    return out


def synth_scene(items, tag):
    """items: [(text, seed)]. Cached per sentence; failed pad cuts retry with seed+1 (3 rounds)."""
    paths = [os.path.join(CACHE, f'{key_of(t, s)}.wav') for t, s in items]
    seeds = [s for _, s in items]
    for rnd in range(3):
        todo = [i for i, p in enumerate(paths) if not os.path.exists(p)]
        if not todo: return paths
        job_seed = seeds[todo[0]] + 1000 * rnd
        raws = run_job([items[i][0] for i in todo], job_seed, f'{tag} r{rnd}')
        for pos, (i, raw) in enumerate(zip(todo, raws)):
            a = wav_read(raw)
            if PAD:
                a, why = cut_and_check(a)
                if a is None:
                    print(f'    {tag}:{i} rejected ({why}); retrying', flush=True)
                    continue
            wav_write(paths[i], a)
            json.dump({'text': items[i][0], 'take': seeds[i], 'server_seed': job_seed + pos, 'raw': os.path.relpath(raw, PROJ)},
                      open(paths[i][:-4] + '.json', 'w'), ensure_ascii=False)
            if rnd > 0: print(f'    {tag}:{i} fixed in round {rnd}', flush=True)
    missing = [i for i, p in enumerate(paths) if not os.path.exists(p)]
    if missing: sys.exit(f'{tag}: sentences {missing} still failed the pad cut / ear check after 3 rounds')
    return paths


def trim(a, thr_db=-42, pad=0.06):
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


def recut(script, seeds):
    """re-cut cached sentences from the raw takes in cache_voice/job_*/ (manifest.json or status.json)."""
    want = {}
    for j, sc in enumerate(script['scenes']):
        for k, s in enumerate(sc['sentences']):
            want[say_of(s)] = (sc['id'], k, seeds.get(f'{sc["id"]}:{k}', 100 + 17 * j + k))
    kept = dropped = 0
    for d in sorted(os.listdir(CACHE)):
        jd = os.path.join(CACHE, d)
        if not d.startswith('job_') or not os.path.isdir(jd): continue
        if os.path.exists(os.path.join(jd, 'manifest.json')):
            texts = json.load(open(os.path.join(jd, 'manifest.json')))['texts']
        else:
            chunks = json.load(open(os.path.join(jd, 'status.json')))['result']['chunks']
            texts = [c['text'].removeprefix(PAD_HEAD).removesuffix(PAD_TAIL) for c in chunks]
        for i, t in enumerate(texts):
            raw = os.path.join(jd, f'r{i:03d}.wav')
            if t not in want or not os.path.exists(raw): continue
            sid, k, take = want[t]
            path = os.path.join(CACHE, f'{key_of(t, take)}.wav')
            if not os.path.exists(path): continue      # a later round already replaced it, or never made
            a, why = cut_and_check(wav_read(raw))
            if a is None:
                os.remove(path); dropped += 1
                print(f'  {sid}:{k} dropped ({why})', flush=True)
            else:
                wav_write(path, a); kept += 1
    print(f'recut: {kept} kept, {dropped} dropped (re-synthesised on the next run)')


def main():
    script = json.load(open(os.path.join(PROJ, 'script.json')))
    seeds_path = os.path.join(PROJ, 'seeds.json')
    seeds = json.load(open(seeds_path)) if os.path.exists(seeds_path) else {}
    if '--redo' in ARGS:   # scene:k[:seed] -> new seed for one sentence, so only it re-synthesises
        for spec in ARGS[ARGS.index('--redo') + 1].split(','):
            p = spec.split(':'); sid, k = p[0], int(p[1])
            seeds[f'{sid}:{k}'] = int(p[2]) if len(p) > 2 else seeds.get(f'{sid}:{k}', 5000) + 1
        json.dump(seeds, open(seeds_path, 'w'), indent=1)
    if '--recut' in ARGS:
        recut(script, seeds); return
    clips = {}
    for j, sc in enumerate(script['scenes']):
        items = [(say_of(s), seeds.get(f'{sc["id"]}:{k}', 100 + 17 * j + k)) for k, s in enumerate(sc['sentences'])]
        clips[sc['id']] = [trim(wav_read(p)) for p in synth_scene(items, sc['id'])]
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
            gap = (GAP_Q if say_of(s).rstrip().endswith('?') else GAP) if k + 1 < len(cs) else 0.0
            sents.append({'text': s['text'], 'say': say_of(s), 'start': round(t0 + cur, 3), 'end': round(t0 + cur + d, 3), 'dur': round(d + gap, 3)})
            words += word_times(say_of(s), t0 + cur + 0.06, max(0.1, d - 0.12))
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
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', f'volume={-18.5 - lufs:.2f}dB,alimiter=limit=0.89:level=false',
                    '-ar', str(SR), '-ac', '1', os.path.join(PROJ, 'narration.wav')], check=True)
    tl = {'total': round(t, 3), 'fps': 30, 'title': script['title'], 'subtitle': script.get('subtitle', ''),
          'voice': f'soma-voice:{VOICE}' + (':pad' if PAD else ''), 'scenes': scenes}
    json.dump(tl, open(os.path.join(PROJ, 'timeline.json'), 'w'), ensure_ascii=False, indent=1)
    print(f'TOTAL {t:.1f}s = {t / 60:.2f} min (raw {lufs:.1f} LUFS -> -18.5)')


if __name__ == '__main__':
    main()
