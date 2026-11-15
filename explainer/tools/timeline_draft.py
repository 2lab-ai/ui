"""Draft timeline: script.json -> timeline.json with estimated timings (no voice yet), so scenes, the asset gallery
and the scene lint can run while cwon is still narrating. Run inside a project folder.

    python timeline_draft.py [--cps 7.8] [--force] [--out <file>]

7.8 characters of `text` per second is cwon's measured pace (GEB: 12,962 chars -> 30:31 with gaps). Leads, tails
and gaps match narrate_soma.py, so shot times written against the draft move only a little when the real timeline
replaces it. Refuses to overwrite a real timeline (one whose voice is not 'draft') unless --force.
--out <file>: write the draft there instead of timeline.json (timeline_draft.json: the draft survives the narration,
which writes timeline.json, for `lint_scenes.py --timeline timeline_draft.json`).
"""
import json, os, sys
if __name__ == '__main__' and ('--help' in sys.argv[1:] or '-h' in sys.argv[1:]):
    print(__doc__.strip()); sys.exit(0)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ko_say import load_lexicon, spoken, strip_tags   # the same words narrate_soma.py puts in the timeline, so q.w() cues match

LEAD_TITLE, LEAD, TAIL, GAP, GAP_Q = 2.6, 0.7, 1.1, 0.50, 0.70

def word_times(text, t0, d):
    ws = text.split(); n = sum(len(w) for w in ws) or 1; out = []; t = t0
    for w in ws:
        wd = d * len(w) / n; out.append({'t': round(t, 3), 'd': round(wd * 0.9, 3), 'w': w.strip('.,?!"\'')}); t += wd
    return out

def draft(script, cps=7.8, lexicon=None):
    t = 0.0; scenes = []
    for sc in script['scenes']:
        lead = LEAD_TITLE if sc.get('subtitle') else LEAD
        start, cur, sents, words = t, t + lead, [], []
        ss = sc['sentences']
        for k, s in enumerate(ss):
            try: say = strip_tags(spoken(s, lexicon or {}))   # Drama 3 directions are not words
            except Exception: say = s.get('say') or s['text']   # unconvertible text: narrate_soma will stop on it anyway
            d = max(1.2, max(len(s['text']), len(say)) / cps)   # numbers are longer spoken (1898 -> 천팔백구십팔)
            gap = (GAP_Q if say.rstrip().endswith('?') else GAP) if k + 1 < len(ss) else 0.0
            sents.append({'text': s['text'], 'say': say, 'start': round(cur, 3), 'end': round(cur + d, 3), 'dur': round(d + gap, 3)})
            words += word_times(say, cur + 0.06, d - 0.12); cur += d + gap
        dur = cur - start + TAIL
        scenes.append({'id': sc['id'], 'chip': sc.get('chip', ''), 'title': sc.get('title', ''), 'subtitle': sc.get('subtitle', ''),
                       'start': round(start, 3), 'lead': lead, 'dur': round(dur, 3), 'sentences': sents, 'words': words})
        t += dur
    return {'total': round(t, 3), 'fps': 30, 'title': script.get('title', ''), 'subtitle': script.get('subtitle', ''),
            'voice': 'draft', 'scenes': scenes}

def out_path(a):
    """argv -> the file the draft goes to (--out <file>, else timeline.json)"""
    if '--out' not in a: return 'timeline.json'
    i = a.index('--out')
    if i + 1 >= len(a) or a[i + 1].startswith('--'): sys.exit('--out needs a file: timeline_draft.py --out timeline_draft.json')
    return a[i + 1]


if __name__ == '__main__':
    a = sys.argv[1:]; cps = float(a[a.index('--cps') + 1]) if '--cps' in a else 7.8
    out = out_path(a)
    if os.path.exists(out) and json.load(open(out)).get('voice') != 'draft' and '--force' not in a:
        sys.exit(f'{out} comes from the voice; not overwriting (use --force, or --out timeline_draft.json)')
    tl = draft(json.load(open('script.json')), cps, load_lexicon(os.getcwd()))
    with open(out, 'w', encoding='utf-8') as f: json.dump(tl, f, ensure_ascii=False, indent=1)
    chars = sum(len(x['text']) for sc in tl['scenes'] for x in sc['sentences'])
    print(f"draft timeline: {out}, {len(tl['scenes'])} scenes, {tl['total']:.1f}s, {chars} characters of text")
