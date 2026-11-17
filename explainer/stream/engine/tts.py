"""lines.json -> audio/<id>.wav (48k mono, pad-cut) via soma-voice Drama 3 on blade-4090.
usage: python tts.py lines.json outdir [--streamer kate] [--redo id,id] [--only id,id]
Each line's "who" (main | sis) picks the voice from the streamer theme's cast."""
import hashlib, json, os, subprocess, sys, time, urllib.request, wave
from concurrent.futures import ThreadPoolExecutor
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
K = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'tools'); sys.path.insert(0, K); sys.path.insert(0, HERE)   # explainer/tools: padcut, ko_say
from padcut import PAD_HEAD, PAD_TAIL, cut, edges_ok, edge_db, removed, is_filler_text
from ko_say import spoken, strip_tags
API = os.environ.get('SOMA_VOICE_URL', 'http://blade-4090:9999')
SR = 48000
lines = json.load(open(sys.argv[1])); OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
args = sys.argv[3:]
import themes as TH
VOICES = {role: c['voice'] for role, c in TH.load_one('streamer', args[args.index('--streamer') + 1] if '--streamer' in args else TH.DEFAULTS['streamer'])['cast'].items()}
redo = set(args[args.index('--redo') + 1].split(',')) if '--redo' in args else set()
only = set(args[args.index('--only') + 1].split(',')) if '--only' in args else None
LEX = {}
_wh = None
def ear(x):
    global _wh
    if _wh is None:
        os.environ.setdefault('HF_HUB_OFFLINE', '1'); import mlx_whisper; _wh = mlx_whisper
    pad = np.zeros(int(0.15 * SR), np.float32)
    r = _wh.transcribe(np.concatenate([pad, x, pad])[::3], path_or_hf_repo='mlx-community/whisper-large-v3-turbo', language='ko', temperature=0.0, condition_on_previous_text=False, initial_prompt='아아.')
    return r['text'].strip()
def http(method, path, body=None, timeout=60):
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r: return json.load(r)
def rd(p):
    with wave.open(p) as w: n = w.getnframes(); d = w.readframes(n)
    return np.frombuffer(d, dtype=np.int16).astype(np.float32) / 32768
def wr(p, a):
    with wave.open(p, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes())
def synth(L, seed):
    voice = VOICES[L['who']]
    say = spoken(L, LEX)
    body = {'mode': 'async', 'format': 'wav', 'seed': seed, 'turns': [{'voice': voice, 'text': PAD_HEAD + say + PAD_TAIL}]}
    for att in range(4):
        try:
            job = http('POST', '/api/tts', body)['job_id']
            while True:
                st = http('GET', f'/api/jobs/{job}')
                if st['status'] in ('succeeded', 'completed'): break
                if st['status'] == 'failed': raise RuntimeError(st.get('error'))
                time.sleep(2)
            raw = os.path.join(OUT, 'raw', f"{L['id']}_{seed}.src")
            os.makedirs(os.path.dirname(raw), exist_ok=True)
            with urllib.request.urlopen(API + f'/api/jobs/{job}/result', timeout=120) as r: open(raw, 'wb').write(r.read())
            p = raw[:-4] + '.wav'
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-ar', str(SR), '-ac', '1', p], check=True)
            return p
        except Exception as e:
            print(L['id'], 'job error', e, flush=True); time.sleep(20)
    raise SystemExit(L['id'] + ' failed')
def one(L):
    dst = os.path.join(OUT, L['id'] + '.wav'); meta = dst[:-4] + '.json'
    key = hashlib.sha1(json.dumps([L, VOICES[L['who']]], ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:12]
    if os.path.exists(meta) and L['id'] not in redo:
        m = json.load(open(meta))
        if m.get('key') == key: return L['id'], 'cached', m
    base = int(hashlib.sha1(L['id'].encode()).hexdigest()[:6], 16) % 100000 + (777 if L['id'] in redo else 0)
    last = ''
    for rnd in range(4):
        raw = synth(L, base + rnd)
        a = rd(raw)
        clip, info = cut(a, SR)
        if clip is None: last = f'cut: {info}'; print(L['id'], 'round', rnd, last, flush=True); continue
        if not edges_ok(clip, SR): last = f'edges {edge_db(clip, SR)}'; print(L['id'], 'round', rnd, last, flush=True); continue
        ok = True
        for side, piece in zip(('head', 'tail'), removed(a, SR, info)):
            h = ear(piece)
            if not is_filler_text(h): ok = False; last = f'{side} heard {h!r}'; break
        if not ok: print(L['id'], 'round', rnd, last, flush=True); continue
        heard = ear(clip)
        wr(dst, clip)
        m = {'key': key, 'id': L['id'], 'who': L['who'], 'dur': len(clip) / SR, 'heard': heard, 'seed': base + rnd, 'said': strip_tags(spoken(L, LEX))}
        json.dump(m, open(meta, 'w'), ensure_ascii=False)
        return L['id'], 'ok', m
    return L['id'], 'FAIL ' + last, None
todo = [L for L in lines if only is None or L['id'] in only]
with ThreadPoolExecutor(1) as ex:
    for i, st, m in ex.map(one, todo):
        print(i, st, (f"{m['dur']:.2f}s heard={m['heard']}" if m else ''), flush=True)
