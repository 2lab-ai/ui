"""print the review marks (seconds and frames) of beats.py against an audio dir, and write <out>/marks.json (qa_stills.py reads it).
usage: python marks.py <audio dir> [<out dir>]   (run from the episode's project folder; STREAM_KIT = the kit's explainer/stream)"""
import sys, json, os
S = os.environ.get('STREAM_KIT') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), *['..'] * 5))   # explainer/stream
sys.path.insert(0, S + '/engine')
import build, themes as TH
from common import rng
cfg = TH.load('default', 'kate', 'book-night'); build.configure(cfg['layout']); sys.modules['build'] = build
mod = build.load_beats('beats.py')
B = build.Builder(sys.argv[1]); mod.script(B, rng)
R = dict(B.review_marks); R['afk0'], R['afk1'] = float(B.afk[0]), float(B.afk[1])
for k, v in R.items(): print(k, round(v, 1), int(v * 30))
json.dump(R, open(os.path.join(sys.argv[2] if len(sys.argv) > 2 else '.', 'marks.json'), 'w'))
