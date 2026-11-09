"""Fallback narration (no GPU host): one take per scene with edge-tts, sentence alignment from word
boundaries, extra breathing pauses at sentence boundaries, timeline.json + narration.wav."""
import asyncio, hashlib, json, os, subprocess, sys, wave
import numpy as np
import edge_tts

HERE = os.getcwd()   # the project folder
SR = 48000
LEAD_TITLE, LEAD, TAIL = 2.6, 0.7, 1.1
EXTRA_PAUSE = 0.25          # added inside the take at every sentence boundary
CACHE = os.path.join(HERE, 'cache'); os.makedirs(CACHE, exist_ok=True)

def say_of(s): return s.get('say', s['text'])

async def synth(text, voice, rate, mp3_path):
    comm = edge_tts.Communicate(text, voice, rate=rate, boundary='WordBoundary')
    words = []
    with open(mp3_path, 'wb') as f:
        async for ch in comm.stream():
            if ch['type'] == 'audio': f.write(ch['data'])
            elif ch['type'] == 'WordBoundary':
                words.append({'t': ch['offset'] / 1e7, 'd': ch['duration'] / 1e7, 'w': ch['text']})
    return words

def load_wav(path):
    with wave.open(path) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return a

def take(scene, voice, rate):
    sents = [say_of(s) for s in scene['sentences']]
    text = ' '.join(sents)
    key = hashlib.sha1(json.dumps(['edge', voice, rate, text]).encode()).hexdigest()[:16]
    mp3, wav, js = (os.path.join(CACHE, f'{scene["id"]}_{key}.{e}') for e in ('mp3', 'wav', 'json'))
    if not os.path.exists(js):
        words = asyncio.run(synth(text, voice, rate, mp3))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp3, '-ar', str(SR), '-ac', '1', wav], check=True)
        json.dump(words, open(js, 'w'), ensure_ascii=False)
    words = json.load(open(js))
    audio = load_wav(wav)
    # char offset of each word inside text, then sentence index of each word
    starts, pos = [], 0
    for s in sents:
        starts.append(pos); pos += len(s) + 1
    sent_of_word, cur = [], 0
    for w in words:
        i = text.find(w['w'], cur)
        if i < 0: i = cur
        cur = i + len(w['w'])
        k = max(j for j, st in enumerate(starts) if st <= i)
        sent_of_word.append(k)
    first = {}
    last_end = {}
    for w, k in zip(words, sent_of_word):
        first.setdefault(k, w['t'])
        last_end[k] = w['t'] + w['d']
    n = len(sents)
    missing = [k for k in range(n) if k not in first]
    if missing: sys.exit(f'scene {scene["id"]}: no word boundary for sentences {missing}')
    # cut points between sentences (middle of the silence), insert EXTRA_PAUSE there
    cuts = [0.5 * (last_end[k - 1] + first[k]) for k in range(1, n)]
    pieces, prev, shift = [], 0, []
    gap = np.zeros(int(EXTRA_PAUSE * SR), dtype=np.float32)
    for c in cuts:
        ci = int(c * SR); pieces += [audio[prev:ci], gap]; prev = ci
    pieces.append(audio[prev:])
    out = np.concatenate(pieces)
    sent_t = [first[k] + EXTRA_PAUSE * k for k in range(n)]
    sent_end = [last_end[k] + EXTRA_PAUSE * k for k in range(n)]
    return out, sent_t, sent_end, words, sent_of_word

def main():
    script = json.load(open(os.path.join(HERE, 'script.json')))
    voice, rate = script['voice'], script['rate']
    t = 0.0; scenes = []; track = []
    for sc in script['scenes']:
        lead = LEAD_TITLE if sc.get('subtitle') else LEAD
        audio, st, en, words, sow = take(sc, voice, rate)
        start = t
        t0 = t + lead
        sents = []
        for k, s in enumerate(sc['sentences']):
            nxt = st[k + 1] if k + 1 < len(st) else len(audio) / SR
            sents.append({'text': s['text'], 'say': say_of(s), 'start': round(t0 + st[k], 3),
                          'end': round(t0 + en[k], 3), 'dur': round(nxt - st[k], 3)})
        dur = lead + len(audio) / SR + TAIL
        track += [np.zeros(int(lead * SR), np.float32), audio, np.zeros(int(TAIL * SR), np.float32)]
        scenes.append({'id': sc['id'], 'chip': sc['chip'], 'title': sc['title'], 'subtitle': sc.get('subtitle', ''),
                       'start': round(start, 3), 'lead': lead, 'dur': round(dur, 3), 'sentences': sents,
                       'words': [{'t': round(t0 + w['t'] + EXTRA_PAUSE * k, 3), 'd': w['d'], 'w': w['w']} for w, k in zip(words, sow)]})
        t += dur
        print(f'{sc["id"]:7s} take {len(audio)/SR:6.1f}s  scene {dur:6.1f}s')
    full = np.concatenate(track)
    pcm = (np.clip(full, -1, 1) * 32767).astype(np.int16)
    with wave.open(os.path.join(HERE, 'narration.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    tl = {'total': round(t, 3), 'fps': 30, 'title': script['title'], 'subtitle': script['subtitle'], 'scenes': scenes}
    json.dump(tl, open(os.path.join(HERE, 'timeline.json'), 'w'), ensure_ascii=False, indent=1)
    print(f'TOTAL {t:.1f}s = {t/60:.2f} min')

if __name__ == '__main__':
    main()
