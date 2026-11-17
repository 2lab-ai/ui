"""Subtitles from the final build: every voice line at its real time -> subs_ko.srt (the lines' text) and subs_en.srt
(subs_en.json). The sister's lines are marked with a dash so a reader can tell the two voices apart.
usage: python make_srt.py <build dir>"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ev = json.load(open(os.path.join(sys.argv[1], 'events.json')))
L = {l['id']: l for l in json.load(open(os.path.join(HERE, 'lines.json')))}
EN = json.load(open(os.path.join(HERE, 'subs_en.json')))


def ts(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'


cues = sorted(ev['voices'], key=lambda v: v[2])
for lang, text_of in (('ko', lambda lid: L[lid]['text']), ('en', lambda lid: EN[lid])):
    out = []
    for k, (who, lid, t0, d) in enumerate(cues):
        nxt = cues[k + 1][2] if k + 1 < len(cues) else t0 + d + 2
        t1 = min(t0 + d + 0.6, nxt - 0.05)
        txt = text_of(lid)
        if who == 'sis': txt = '— ' + txt
        out.append(f'{k + 1}\n{ts(t0)} --> {ts(t1)}\n{txt}\n')
    open(os.path.join(HERE, f'subs_{lang}.srt'), 'w').write('\n'.join(out))
    print(lang, len(out), 'cues')
missing = [lid for _, lid, _, _ in cues if lid not in EN]
assert not missing, missing
