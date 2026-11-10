"""Scene lint: render every shot at rest (its last moment before the next cut) and report what docent.js recorded in
that frame. These are the defects that made earlier docent videos look like AI slop and that a contact sheet makes
easy to miss. Run inside a project folder (timeline.json may be a draft).

    python lint_scenes.py [--scene id ...] [--strict]

Writes out/lint.json, out/lint.md and out/lint/<scene>_<t>.jpg for every frame with a P1 or worse.
Exit code 1 when a P0/P1 defect is found (--strict: also P2).

P0  page errors, missing cues, missing props / animals / cast ids
P1  half-drawn element at rest; faded "ghost" element (a < 0.55); ink under the subtitles (y > 905) or off the frame;
    empty bubble; bubble tail that points at no head; bubble over a face; text overflowing its bubble; two people in
    one frame with the same look; an animal drawn on the stick-figure rig
P2  bubble over 8 words; a picture held longer than 8 s; a shot shorter than 1.2 s; a scene without shots();
    two or more people in one frame and one of them without a cast look
"""
import asyncio, base64, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from export import serve, open_page, OUT

STEP = 0.1     # finer than the shortest shot worth judging
FADE = 0.22    # shots() cross-fade: a frame inside it shows two shots at once

def judge(r):
    """docentReport() of one rest frame -> list of (severity, code, detail)."""
    out = []
    if r['partial']: out.append(('P1', 'half-drawn', f"{len(r['partial'])} parts still drawing at rest: {sorted(set(r['partial']))[:4]}"))
    if r['ghost']: out.append(('P1', 'ghost', f"faded parts left on screen: {r['ghost'][:3]}"))
    if r['zone']: out.append(('P1', 'subtitle-zone', f"ink under the subtitles: {r['zone'][:3]}"))
    if r['off']: out.append(('P1', 'off-frame', f"ink off the frame: {r['off'][:3]}"))
    if r['empty']: out.append(('P1', 'empty-bubble', f"bubble with nothing inside: {r['empty'][:3]}"))
    if r['tailFar']: out.append(('P1', 'tail-far', f"bubble tail points at no head: {r['tailFar'][:3]}"))
    if r['cover']: out.append(('P1', 'bubble-over-face', str(r['cover'][:3])))
    if r['overflow']: out.append(('P1', 'bubble-overflow', str(r['overflow'][:3])))
    if r['rig']: out.append(('P1', 'animal-on-rig', r['rig'][0]))
    groups = {}
    for p in r['people']:
        if not p['crowd']: groups.setdefault(p['sig'], []).append(p['id'])
    # the same cast id twice is one person shown twice (before/after, a memory): fine; two ids or anonymous copies are not
    dup = [ids for ids in groups.values() if len(ids) > 1 and (None in ids or len(set(ids)) > 1)]
    if dup: out.append(('P1', 'twins', f"{sum(len(g) for g in groups.values())} people, {len(dup)} look(s) shared by different people — give each person a cast() look"))
    if len(r['people']) >= 2 and any(p['id'] is None and not p['crowd'] for p in r['people']):
        out.append(('P2', 'no-cast', f"{len(r['people'])} people and some without a cast look"))
    if r['wordy']: out.append(('P2', 'wordy-bubble', str(r['wordy'][:3])))
    return out

async def main(only, strict):
    from playwright.async_api import async_playwright
    tl = json.load(open('timeline.json'))
    srv, port = serve(); report = []; shots_out = {}
    os.makedirs(os.path.join(OUT, 'lint'), exist_ok=True)
    async with async_playwright() as pw:
        browser, page, errs = await open_page(pw, port)
        for sc in tl['scenes']:
            if only and sc['id'] not in only: continue
            body0, end = sc['start'] + sc['lead'] + 0.4, sc['start'] + sc['dur'] - 0.6
            # 1. find the cuts: shots() records { i, t0, t1 } for the frame it draws
            starts, t = {}, body0
            while t < end:
                sh = await page.evaluate('(t) => { renderAt(t); return DOCENT.shot; }', t)
                if sh: starts[round(sh['t0'], 3)] = sh['t1']
                t += STEP
            if not starts:
                report.append({'scene': sc['id'], 't': round(body0, 2), 'issues': [('P2', 'no-shots', 'scene does not use shots(): no cuts to check')]})
                rest = [end - 0.2]
            else:
                ts = sorted(starts); rest = []
                for k, t0 in enumerate(ts):
                    t1 = ts[k + 1] if k + 1 < len(ts) else end
                    rest.append(min(max(t0 + FADE + 0.03, min(t1, end) - 0.3), min(t1, end) - 0.02))   # inside this shot, after its fade
                    held = min(t1, end) - max(t0, body0)
                    if held > 8.0: report.append({'scene': sc['id'], 't': round(t0, 2), 'issues': [('P2', 'long-hold', f'picture held {held:.1f}s (> 8 s)')]})
                    if 0 < held < 1.2 and k + 1 < len(ts): report.append({'scene': sc['id'], 't': round(t0, 2), 'issues': [('P2', 'short-shot', f'shot only {held:.1f}s')]})
                shots_out[sc['id']] = ts
            # 2. judge each rest frame
            for t in rest:
                r = await page.evaluate('(t) => { renderAt(t); return docentReport(); }', t)
                iss = judge(r)
                if iss:
                    report.append({'scene': sc['id'], 't': round(t, 2), 'issues': iss})
                    if any(s in ('P0', 'P1') for s, _, _ in iss):
                        b64 = await page.evaluate("(t) => { renderAt(t); return document.getElementById('c').toDataURL('image/jpeg', 0.85).slice(23); }", t)
                        open(os.path.join(OUT, 'lint', f"{sc['id']}_{t:07.2f}.jpg"), 'wb').write(base64.b64decode(b64))
        miss = await page.evaluate('[...MISS].concat(window.missingCues ? window.missingCues() : [])')
        await browser.close()
    srv.shutdown()
    head = []
    if errs: head.append({'scene': '*', 't': 0, 'issues': [('P0', 'page-error', e) for e in errs[:5]]})
    if miss: head.append({'scene': '*', 't': 0, 'issues': [('P0', 'missing', str(m)) for m in miss[:20]]})
    report = head + report
    counts = {}
    for r in report:
        for s, c, _ in r['issues']: counts[s] = counts.get(s, 0) + 1
    json.dump({'counts': counts, 'shots': shots_out, 'frames': report}, open(os.path.join(OUT, 'lint.json'), 'w'), ensure_ascii=False, indent=1)
    lines = [f"# Scene lint — {sum(counts.values())} issues {counts}", '']
    for r in report:
        for s, c, d in r['issues']: lines.append(f"- [{s}] {r['scene']} @{r['t']:.2f}s {c}: {d}")
    open(os.path.join(OUT, 'lint.md'), 'w').write('\n'.join(lines) + '\n')
    print('\n'.join(lines[:60]))
    bad = counts.get('P0', 0) + counts.get('P1', 0) + (counts.get('P2', 0) if strict else 0)
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    a = sys.argv[1:]
    only = a[a.index('--scene') + 1:] if '--scene' in a else []
    only = [x for x in only if not x.startswith('--')]
    asyncio.run(main(only, '--strict' in a))
