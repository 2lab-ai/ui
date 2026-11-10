"""Draft timeline: script.json -> timeline.json with estimated timings (no voice yet), so scenes, the asset gallery
and the scene lint can run while cwon is still narrating. Run inside a project folder.

    python timeline_draft.py [--cps 7.8] [--force]

7.8 characters of `text` per second is cwon's measured pace (GEB: 12,962 chars -> 30:31 with gaps). Leads, tails
and gaps match narrate_soma.py, so shot times written against the draft move only a little when the real timeline
replaces it. Refuses to overwrite a real timeline (one whose voice is not 'draft') unless --force.
"""
import json, os, sys

LEAD_TITLE, LEAD, TAIL, GAP, GAP_Q = 2.6, 0.7, 1.1, 0.50, 0.70

def word_times(text, t0, d):
    ws = text.split(); n = sum(len(w) for w in ws) or 1; out = []; t = t0
    for w in ws:
        wd = d * len(w) / n; out.append({'t': round(t, 3), 'd': round(wd * 0.9, 3), 'w': w.strip('.,?!"\'')}); t += wd
    return out

def draft(script, cps=7.8):
    t = 0.0; scenes = []
    for sc in script['scenes']:
        lead = LEAD_TITLE if sc.get('subtitle') else LEAD
        start, cur, sents, words = t, t + lead, [], []
        ss = sc['sentences']
        for k, s in enumerate(ss):
            say = s.get('say') or s['text']; d = max(1.2, len(s['text']) / cps)
            gap = (GAP_Q if say.rstrip().endswith('?') else GAP) if k + 1 < len(ss) else 0.0
            sents.append({'text': s['text'], 'say': say, 'start': round(cur, 3), 'end': round(cur + d, 3), 'dur': round(d + gap, 3)})
            words += word_times(say, cur + 0.06, d - 0.12); cur += d + gap
        dur = cur - start + TAIL
        scenes.append({'id': sc['id'], 'chip': sc.get('chip', ''), 'title': sc.get('title', ''), 'subtitle': sc.get('subtitle', ''),
                       'start': round(start, 3), 'lead': lead, 'dur': round(dur, 3), 'sentences': sents, 'words': words})
        t += dur
    return {'total': round(t, 3), 'fps': 30, 'title': script.get('title', ''), 'subtitle': script.get('subtitle', ''),
            'voice': 'draft', 'scenes': scenes}

if __name__ == '__main__':
    a = sys.argv[1:]; cps = float(a[a.index('--cps') + 1]) if '--cps' in a else 7.8
    if os.path.exists('timeline.json') and json.load(open('timeline.json')).get('voice') != 'draft' and '--force' not in a:
        sys.exit('timeline.json comes from the voice; not overwriting (use --force)')
    tl = draft(json.load(open('script.json')), cps)
    json.dump(tl, open('timeline.json', 'w'), ensure_ascii=False, indent=1)
    print(f"draft timeline: {len(tl['scenes'])} scenes, {tl['total']:.1f}s")
