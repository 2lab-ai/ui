"""word timings for every voice clip (mlx-whisper word_timestamps), cached in <audio dir>/<id>.words.json (lip sync uses them).
usage: python align.py <audio dir> <id> [<id> ...]"""
import json, os, sys, wave
import numpy as np
os.environ.setdefault('HF_HUB_OFFLINE', '1')
import mlx_whisper
D = sys.argv[1]; ids = sys.argv[2:]
for lid in ids:
    out = os.path.join(D, lid + '.words.json')
    if os.path.exists(out): continue
    w = wave.open(os.path.join(D, lid + '.wav')); a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768; sr = w.getframerate()
    x = a[::3] if sr == 48000 else a
    r = mlx_whisper.transcribe(x, path_or_hf_repo='mlx-community/whisper-large-v3-turbo', language='ko', word_timestamps=True, temperature=0.0, condition_on_previous_text=False)
    words = [{'w': x_['word'].strip(), 's': x_['start'], 'e': x_['end']} for seg in r['segments'] for x_ in seg.get('words', [])]
    json.dump(words, open(out, 'w'), ensure_ascii=False)
    print(lid, len(words))
