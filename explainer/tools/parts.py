"""Scenes written by several authors at once: one file per scene in parts/, assembled into scenes.js, and a private
preview project per author so authors never overwrite each other's scenes.js. Run inside a project folder.

    python parts.py build                         # scenes.js = parts/common.js + parts/<id>.js in script order
    python parts.py preview <author> <id> [<id> …] [--no-sheets]

`preview` makes ../<project>-<author>/ (audio, timeline, engine and fonts linked from the project, scenes.js = common +
the author's parts), runs lint_scenes.py on those scenes, and writes Gate C stills (every sentence start + 0.8 s and
end - 0.3 s, REFERENCE §8.3) as contact sheets out/sheet_<id>_<n>.jpg. Exit code = the lint's (1 on P0/P1).

parts/common.js holds the cast block, registered assets and shared helpers; a scene file holds `SCENES.<id> = …` and
helpers whose names start with the scene id. Used for the v2 redraw of two videos by nine authors (2026-11-10).
"""
import json, os, shutil, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
LINKS = ['engine.js', 'docent.js', 'video.html', 'theme.json', 'project.json', 'script.json', 'timeline.json',
         'narration.wav', 'mix.wav', 'formulas.json', 'fonts', 'img']


def scene_ids():
    return [s['id'] for s in json.load(open('script.json'))['scenes']]


def build(out_dir='.', ids=None):
    ids = ids or scene_ids()
    chunks = [open('parts/common.js').read()]
    used = []
    for i in ids:
        p = f'parts/{i}.js'
        if os.path.exists(p):
            chunks.append(f'\n// ===== {i} =====\n' + open(p).read()); used.append(i)
    path = os.path.join(out_dir, 'scenes.js')
    open(path, 'w').write('\n'.join(chunks))
    missing = [i for i in ids if i not in used]
    print(f'{path}: common + {len(used)} scenes' + (f' (no part yet: {" ".join(missing)})' if missing else ''))
    return missing


def gate_stills(ids):
    """stills at every sentence start + 0.8 s and end - 0.3 s, one contact sheet set per scene."""
    tl = json.load(open('timeline.json'))
    py = sys.executable
    for sc in tl['scenes']:
        if sc['id'] not in ids: continue
        ts = []
        for s in sc['sentences']:
            ts += [round(s['start'] + 0.8, 2), round(max(s['start'] + 0.9, s['end'] - 0.3), 2)]
        d = f'out/st_{sc["id"]}'
        if os.path.isdir(d):   # keep the previous round for comparison instead of deleting it
            os.makedirs('out/.old', exist_ok=True); shutil.move(d, f'out/.old/st_{sc["id"]}_{int(time.time())}')
        os.makedirs(d)
        r = subprocess.run([py, os.path.join(HERE, 'export.py'), 'stills', *map(str, ts)], capture_output=True, text=True)
        for line in r.stdout.splitlines():
            if line.startswith(('PAGE ERRORS', 'MISSING CUES')): print(sc['id'], line)
        for f in os.listdir('out'):
            if f.startswith('still_') and f.endswith('.jpg'): shutil.move(os.path.join('out', f), os.path.join(d, f))
        subprocess.run([py, os.path.join(HERE, 'sheets.py'), f'{d}/still_*.jpg', f'out/sheet_{sc["id"]}'])


def preview(author, ids, sheets=True):
    proj = os.getcwd(); dest = f'{proj}-{author}'
    os.makedirs(os.path.join(dest, 'out'), exist_ok=True)
    for f in LINKS:
        src, dst = os.path.join(proj, f), os.path.join(dest, f)
        if os.path.exists(src) and not os.path.lexists(dst): os.symlink(src, dst)
    build(dest, ids)
    os.chdir(dest)
    args = [sys.executable, os.path.join(HERE, 'lint_scenes.py')]
    for i in ids: args += ['--scene', i]
    r = subprocess.run(args, capture_output=True, text=True)
    open('out/lint_run.txt', 'w').write(r.stdout + r.stderr)
    print('\n'.join((r.stdout + r.stderr).splitlines()[-25:])); print(f'LINT_EXIT={r.returncode}  ({dest})')
    if sheets: gate_stills(ids)
    return r.returncode


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] not in ('build', 'preview'): sys.exit(__doc__)
    if a[0] == 'build': build()
    else:
        sheets = '--no-sheets' not in a; rest = [x for x in a[1:] if x != '--no-sheets']
        if len(rest) < 2: sys.exit('parts.py preview <author> <scene id> [<scene id> …]')
        sys.exit(preview(rest[0], rest[1:], sheets))
