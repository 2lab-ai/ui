"""lip sync: per-frame mouth opening + vowel weights from each voice clip (loudness x syllables from word timings)."""
import json, math, os
import numpy as np
from common import FPS, rd
from hangul import decompose

VOWEL = {}
for v, w in {'ㅏ': 'A', 'ㅑ': 'A', 'ㅘ': 'A', 'ㅣ': 'I', 'ㅟ': 'I', 'ㅢ': 'I', 'ㅜ': 'U', 'ㅠ': 'U', 'ㅡ': 'U', 'ㅔ': 'E', 'ㅐ': 'E', 'ㅖ': 'E',
             'ㅒ': 'E', 'ㅞ': 'E', 'ㅙ': 'E', 'ㅚ': 'E', 'ㅗ': 'O', 'ㅛ': 'O', 'ㅝ': 'O', 'ㅓ': 'AO', 'ㅕ': 'AO'}.items():
    VOWEL[v] = w


def voice_tracks(B, N):
    """per-frame mouth open + vowel weights for each character. Loudness (RMS) drives the opening; the text's
    syllables, spread over the voiced frames, give each frame a vowel, an open-close bump per syllable and a closed
    mouth on ㅁ/ㅂ/ㅍ."""
    out = {}
    for who in ('main', 'sis'):
        open_ = np.zeros(N); vow = {k: np.zeros(N) for k in 'AIUEO'}
        for w, lid, t0, d in B.voices:
            if w != who: continue
            a, sr = rd(os.path.join(B.audio_dir, lid + '.wav'))
            hop = sr // FPS
            nf = len(a) // hop
            db = np.array([20 * math.log10(math.sqrt(float(np.mean(a[i * hop:(i + 1) * hop] ** 2))) + 1e-7) for i in range(nf)])
            peak = np.percentile(db, 95)
            o = np.clip((db - (peak - 30)) / 24, 0, 1) ** 0.85
            text = B.meta[lid]['said']
            mod = np.ones(nf) * 0.8
            vk = [None] * nf
            wpath = os.path.join(B.audio_dir, lid + '.words.json')
            words = json.load(open(wpath)) if os.path.exists(wpath) else []
            if words:   # syllables spread inside each recognised word's own time span
                for wd in words:
                    sy = [decompose(c) for c in wd['w'] if decompose(c)] or [('ㅇ', 'ㅏ', ''), ('ㅇ', 'ㅏ', '')]
                    a_, b_ = int(wd['s'] * FPS), max(int(wd['s'] * FPS) + 1, int(round(wd['e'] * FPS)))
                    for fi in range(a_, min(nf, b_)):
                        pos = (fi - a_ + 0.5) * len(sy) / (b_ - a_); k = min(len(sy) - 1, int(pos)); ph = pos - k
                        cho, jung, jong = sy[k]
                        fl = getattr(B, 'lip_floor', {}).get(who, 0.82)   # how far the mouth stays open inside a syllable (a whisper: lower)
                        m = fl + (1 - fl) * math.sin(math.pi * min(1, ph * 1.1)) ** 0.7
                        if cho in 'ㅁㅂㅃㅍ' and ph < 0.25: m = 0.05
                        mod[fi] = m; vk[fi] = VOWEL.get(jung, 'A')
            else:
                syl = [decompose(c) for c in text if decompose(c)] or [('ㅇ', 'ㅏ', '')]
                voiced = np.where(db > peak - 26)[0]
                nv = max(1, len(voiced)); ns = len(syl)
                for j, fi in enumerate(voiced):
                    pos = j * ns / nv; k = min(ns - 1, int(pos)); ph = pos - k
                    cho, jung, jong = syl[k]
                    m = 0.55 + 0.45 * math.sin(math.pi * min(1, ph * 1.15)) ** 0.7
                    if cho in 'ㅁㅂㅃㅍ' and ph < 0.2: m = 0.05
                    mod[fi] = m; vk[fi] = VOWEL.get(jung, 'A')
            f0 = int(round(t0 * FPS))
            for i in range(nf):
                g = f0 + i
                if not (0 <= g < N): continue
                open_[g] = max(open_[g], o[i] * mod[i])
                v = vk[i]
                if v == 'AO': vow['A'][g] = .55; vow['O'][g] = .45
                elif v: vow[v][g] = 1.0
        sm = np.zeros(N); x = 0
        for i in range(N):
            tgt = open_[i]; x += (tgt - x) * (0.8 if tgt > x else 0.6); sm[i] = x
        for k in vow:
            y = 0; v = vow[k]; r = np.zeros(N)
            for i in range(N): y += (v[i] - y) * 0.55; r[i] = y
            vow[k] = r
        out[who] = (sm, vow)
    return out


