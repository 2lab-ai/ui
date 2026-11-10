"""Scene lint: render every shot at rest (its last moment before the next cut) and report what docent.js recorded in
that frame. These are the defects that made earlier docent videos look like AI slop and that a contact sheet makes
easy to miss. Run inside a project folder (timeline.json may be a draft).

    python lint_scenes.py [--scene id ...] [--strict]

Writes out/lint.json, out/lint.md, out/lint/<scene>_<t>.jpg for every frame with a P1 or worse, and out/lint_sheet.jpg:
every rest frame on one contact sheet, to look at before the voice is even done (lint cannot see everything).
Exit code 1 when a P0/P1 defect is found (--strict: also P2).

P0  page errors, missing cues, missing props / animals / cast ids
P1  half-drawn element at rest; faded "ghost" element (a < 0.55); ink under the subtitles (y > 905) or off the frame;
    empty bubble; bubble tail that points at no head; bubble over a face; text overflowing its bubble; two people in
    one frame with the same look; an animal drawn on the stick-figure rig
P2  bubble over 8 words; a prop whose box covers a face drawn before it (look at the frame); a picture held longer than 8 s; a shot shorter than 1.2 s; a scene without shots();
    two or more people in one frame and one of them without a cast look; two cast looks with the same silhouette
    (hair and hat), so they differ only by colour
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
    if r.get('propFace'): out.append(('P2', 'prop-over-face', str(r['propFace'][:3]) + ' — open the frame: a box test, it can be empty space'))
    ink = r.get('ink')
    if ink and not r.get('textBig') and (ink[3] - ink[1]) < 0.3 * 1080 and (ink[2] - ink[0]) < 0.5 * 1920:
        out.append(('P2', 'small-subject', f"everything drawn fits in {int(ink[2] - ink[0])}x{int(ink[3] - ink[1])} px (< 30 % of the height): draw the subject bigger"))
    return out

async def main(only, strict):
    from playwright.async_api import async_playwright
    tl = json.load(open('timeline.json'))
    srv, port = serve(); report = []; shots_out = {}; thumbs = []
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
                thumbs.append((sc['id'], t, await page.evaluate("() => document.getElementById('c').toDataURL('image/jpeg', 0.7).slice(23)")))
                iss = judge(r)
                if iss:
                    report.append({'scene': sc['id'], 't': round(t, 2), 'issues': iss})
                    if any(s in ('P0', 'P1') for s, _, _ in iss):
                        b64 = await page.evaluate("(t) => { renderAt(t); return document.getElementById('c').toDataURL('image/jpeg', 0.85).slice(23); }", t)
                        open(os.path.join(OUT, 'lint', f"{sc['id']}_{t:07.2f}.jpg"), 'wb').write(base64.b64decode(b64))
        miss = await page.evaluate('[...MISS].concat(window.missingCues ? window.missingCues() : [])')
        cast = await page.evaluate('typeof CAST === "object" ? CAST : {}')
        await browser.close()
    srv.shutdown()
    head = []
    if errs: head.append({'scene': '*', 't': 0, 'issues': [('P0', 'page-error', e) for e in errs[:5]]})
    if miss: head.append({'scene': '*', 't': 0, 'issues': [('P0', 'missing', str(m)) for m in miss[:20]]})
    sil = {}
    for cid, look in cast.items():
        hair = look.get('hair'); hair = 'long' if hair is True else (hair or 'none'); hat = look.get('hat'); hat = 'top' if hat is True else (hat or 'none')
        sil.setdefault((hair, hat, bool(look.get('beard')), bool(look.get('glasses'))), []).append(cid)
    same = [ids for ids in sil.values() if len(ids) > 1]
    if same: head.append({'scene': '*', 't': 0, 'issues': [('P2', 'cast-similar', f"{' / '.join(ids)} share a silhouette (hair, hat): give each a different hair or hat") for ids in same]})
    report = head + report
    counts = {}
    for r in report:
        for s, c, _ in r['issues']: counts[s] = counts.get(s, 0) + 1
    json.dump({'counts': counts, 'shots': shots_out, 'frames': report}, open(os.path.join(OUT, 'lint.json'), 'w'), ensure_ascii=False, indent=1)
    lines = [f"# Scene lint — {sum(counts.values())} issues {counts}", '']
    for r in report:
        for s, c, d in r['issues']: lines.append(f"- [{s}] {r['scene']} @{r['t']:.2f}s {c}: {d}")
    open(os.path.join(OUT, 'lint.md'), 'w').write('\n'.join(lines) + '\n')
    if thumbs:   # every rest frame, 6 across
        import io
        from PIL import Image, ImageDraw
        cols, tw, th = 6, 320, 180; rows = (len(thumbs) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * tw, rows * (th + 22)), 'white'); d = ImageDraw.Draw(sheet)
        for i, (sid, t, b64) in enumerate(thumbs):
            im = Image.open(io.BytesIO(base64.b64decode(b64))).resize((tw, th)); x, y = (i % cols) * tw, (i // cols) * (th + 22)
            sheet.paste(im, (x, y)); d.text((x + 4, y + th + 4), f'{sid} @{t:.2f}s', fill='black')
        sheet.save(os.path.join(OUT, 'lint_sheet.jpg'), quality=80)
    print('\n'.join(lines[:60]))
    bad = counts.get('P0', 0) + counts.get('P1', 0) + (counts.get('P2', 0) if strict else 0)
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    a = sys.argv[1:]
    only = a[a.index('--scene') + 1:] if '--scene' in a else []
    only = [x for x in only if not x.startswith('--')]
    asyncio.run(main(only, '--strict' in a))
