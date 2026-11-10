"""Mix check (run inside a project after export.py mix): mix and voice loudness, how far the music sits under the voice
while someone speaks and how much it swells in the gaps (music = mix - voice, after aligning the mix's small delay),
and the cues used. REFERENCE §7 target: 20-22 dB under the voice, swell <= ~5 dB in short gaps, -30..-22 dBFS on title cards,
chapter breaks and the end (music_open_dbfs; before 2026-11-10 it sat near -33, near-silent), mix about -15.5 LUFS.

    python mix_check.py      # prints JSON with a verdict; exit 1 when < 18 dB or > 26 dB under the voice, swell > 6 dB, or open music outside -30..-22 dBFS
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
# short gaps (between sentences, < 1.2 s) must not pump; open gaps (title cards, chapter breaks, the end) should lift
sents = sorted((s['start'], s['end']) for sc in tl['scenes'] for s in sc['sentences'])
openm, prev = np.zeros(n, bool), 0.0
for a, b in sents + [(n / sr + 10, 0)]:
    if a - prev >= 1.2: openm[int(prev * sr):int(min(a, n / sr - 1.5) * sr)] = True   # the final fade is not judged
    prev = max(prev, b)
short = ~speech & ~openm
short[int(max(0, n / sr - 1.5) * sr):] = False
out['music_in_gaps_dbfs'] = round(float(rms_db(music[short])), 1) if short.any() else None
out['music_open_dbfs'] = round(float(rms_db(music[openm])), 1) if openm.any() else None
out['music_under_speech_dbfs'] = round(float(rms_db(music[speech])), 1) if speech.any() else None
out['cues'] = [l for l in open('out/cue_sheet.md').read().splitlines() if l.startswith('| ') and not l.startswith('| time')] if os.path.exists('out/cue_sheet.md') else []
if out['music_in_gaps_dbfs'] is not None and out['music_under_speech_dbfs'] is not None:
    out['swell_db'] = round(out['music_in_gaps_dbfs'] - out['music_under_speech_dbfs'], 1)
if out['music_open_dbfs'] is not None and out['music_under_speech_dbfs'] is not None:
    out['open_lift_db'] = round(out['music_open_dbfs'] - out['music_under_speech_dbfs'], 1)
u, w, L = out.get('music_under_voice_db'), out.get('swell_db'), out.get('music_open_dbfs')
out['verdict'] = ('too loud: music < 18 dB under the voice' if u is not None and u < 18 else
                  'too quiet: music > 26 dB under the voice' if u is not None and u > 26 else
                  'pumping: music swells > 6 dB in the gaps' if w is not None and w > 6 else
                  'flat: music below -30 dBFS on title cards and breaks (near-silent)' if L is not None and L < -30 else
                  'too loud: music above -22 dBFS on title cards and breaks' if L is not None and L > -22 else 'ok')
print(json.dumps(out, ensure_ascii=False, indent=1))
if out['verdict'] != 'ok': sys.exit(1)

