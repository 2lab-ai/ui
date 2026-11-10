"""Mix check (run inside a project after export.py mix): mix and voice loudness, how far the music sits under the voice
while someone speaks and how much it swells in the gaps (music = mix - voice, after aligning the mix's small delay),
and the cues used. REFERENCE §7 target: 20-22 dB under the voice, swell <= ~5 dB, mix about -15.5 LUFS.

    python mix_check.py      # prints JSON; exit 1 when the music sits less than 18 dB under the voice
"""
import json, os, re, subprocess, sys, wave
import numpy as np

def read(p):
    with wave.open(p) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        a = a.reshape(-1, w.getnchannels()).mean(axis=1); return a, w.getframerate()

def lufs(path):
    m = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', m)[-1])

def rms_db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)

out = {'mix_lufs': lufs('mix.wav'), 'voice_lufs': lufs('narration.wav')}
v, sr = read('narration.wav'); m, sr2 = read('mix.wav')
if sr2 != sr:
    import math; idx = (np.arange(int(len(m) * sr / sr2)) * sr2 / sr).astype(int); m = m[np.minimum(idx, len(m) - 1)]
n = min(len(v), len(m)); v, m = v[:n], m[:n]
# the mix's limiter/filters delay the voice by a few hundred samples: align before subtracting
seg = slice(0, min(n, sr * 8)); best, lag = -1, 0
for L in range(0, 600):
    c = float(np.dot(m[seg][L:], v[seg][:len(m[seg]) - L]))
    if c > best: best, lag = c, L
v = np.concatenate([np.zeros(lag, np.float32), v])[:n]
gain = float(np.dot(m, v) / (np.dot(v, v) + 1e-9))   # how the mix scaled the voice
music = m - gain * v
tl = json.load(open('timeline.json'))
speech = np.zeros(n, bool)
for sc in tl['scenes']:
    for s in sc['sentences']: speech[int(s['start'] * sr):int(s['end'] * sr)] = True
out['voice_delay_samples'] = lag
out['music_under_voice_db'] = round(float(rms_db(gain * v[speech]) - rms_db(music[speech])), 1) if speech.any() else None
out['music_in_gaps_dbfs'] = round(float(rms_db(music[~speech])), 1) if (~speech).any() else None
out['music_under_speech_dbfs'] = round(float(rms_db(music[speech])), 1) if speech.any() else None
out['cues'] = [l for l in open('out/cue_sheet.md').read().splitlines() if l.startswith('| ') and not l.startswith('| time')] if os.path.exists('out/cue_sheet.md') else []
print(json.dumps(out, ensure_ascii=False, indent=1))
if out['music_under_voice_db'] is not None and out['music_under_voice_db'] < 18: sys.exit(1)
