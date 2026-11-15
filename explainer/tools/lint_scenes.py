"""Scene lint: render every shot at rest (its last moment before the next cut) and report what docent.js recorded in
that frame. These are the defects that made earlier docent videos look like AI slop and that a contact sheet makes
easy to miss. Run inside a project folder (timeline.json may be a draft).

    python lint_scenes.py [--scene id ...] [--strict]

Writes out/lint.json, out/lint.md, out/lint/<scene>_<t>.jpg for every frame with a P1 or worse, and out/lint_sheet.jpg
(+ lint_sheet_02.jpg … past 60 frames): every rest frame on contact sheets, to look at before the voice is even done (lint cannot see everything).
Exit code 1 when a P0/P1 defect is found (--strict: also P2).

P0  page errors, missing cues, missing props / animals / cast ids
P1  half-drawn element at rest; faded "ghost" element (a < 0.55); ink under the subtitles (y > 905) or off the frame;
    empty bubble; bubble tail that points at no head; bubble over a face; text overflowing its bubble; two people in
    one frame with the same look; an animal drawn on the stick-figure rig
P2  bubble over 8 words; a prop whose box covers a face drawn before it (look at the frame); a prop drawn over most of
    a torso (prop-over-body); a picture held longer than 8 s (6.7 s on a draft timeline: hold_limit); a shot shorter
    than 1.2 s; a scene without shots();
    two or more people in one frame and one of them without a cast look; two cast looks with the same silhouette
    (cast-similar: see looks_like), so they differ only by colour
P1  cast-lookalike: a figure drawn without a cast id (figure(), a crowd) that has a cast look's silhouette, so viewers
    read it as that person (P2 in a colour project, where an accent colour may still tell them apart)
P1  cover-late: a real cover (realCover / realCoverPair / holdCover) still under 90 % opacity at its shot's start +
    0.8 s, or at the start + 0.8 s of a sentence inside the shot (run 4: the Korean cover a grey ghost on the line that
    names the book)
Emphasis budget (docent.js counts what each top-level call drew; REFERENCE.md §0):
P1  busy: 5+ things in one frame · words: 3+ written words or labels · marks: 2+ red marks
P2  busy: 4 things · words: 2 · list: a written list of 3+ lines · colour: any colour besides ink, purple and red
    (ink-mode projects) · mark-budget: red in more shots than about one per 45 s of a scene
Words and marks count wherever they are drawn (a word inside a thought bubble's picture too; a hand-drawn red line is a
mark); a bubble's speech counts as a word; a prop's own lettering and a list's items do not. Only projects in ink mode
(project.json "colour": false, every new docent project) are held to the budget.
"""
import asyncio, base64, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from export import serve, open_page, project_frame, OUT

STEP = 0.1     # finer than the shortest shot worth judging

# The silhouette a viewer tells people apart by, at phone size in ink (총균쇠 Gate C, 2026-11-15): the top of the head
# (a hat hides the hair; short and side hair draw as one dark cap, a bun and a beanie as one round cap with a knob,
# bald is no hair at all), a beard, glasses (round or square alike). A crown or a laurel sits on the head and shows it.
SHAPE = {'side': 'short', 'bald': None, 'bun': 'knob', 'beanie': 'knob'}
OPEN = {'crown', 'laurel'}


def silhouette(look):
    hair = 'long' if look.get('hair') is True else (look.get('hair') or None)
    hat = 'top' if look.get('hat') is True else (look.get('hat') or None)
    hat = SHAPE.get(hat, hat) or ('helmet' if look.get('helmet') else None) or ('shell' if look.get('shell') else None)
    hair = SHAPE.get(hair, hair)
    top = f'{hat}:{hair}' if hat in OPEN else hat or hair   # under a crown or a laurel the hair still shows
    return {'top': top, 'hair': hair, 'hat': hat, 'beard': bool(look.get('beard')), 'glasses': bool(look.get('glasses'))}


def looks_like(fig, look):
    """an unnamed figure reads as the person with this cast look: the same head top, and the look's beard and glasses
    when it has them (what the figure adds does not help: a forager with curly hair and a beard is still Yali). A crown
    or a laurel on a hatless look still matches: a ruler drawn bald + beard + crown read as Diamond (bald + beard)."""
    f, c = silhouette(fig), silhouette(look)
    if (c['beard'] and not f['beard']) or (c['glasses'] and not f['glasses']): return False
    return f['top'] == c['top'] or (c['hat'] is None and f['hat'] in OPEN and f['hair'] == c['hair'])


def same_head(a, b):
    """two cast looks that tell each other apart only by colour: the same head top, beard and glasses (or one is the
    other plus a crown or a laurel). Columbus in a beanie read as 정화 with her bun."""
    A, B = silhouette(a), silhouette(b)
    if (A['beard'], A['glasses']) != (B['beard'], B['glasses']): return False
    return A['top'] == B['top'] or any(x['hat'] is None and y['hat'] in OPEN and y['hair'] == x['hair'] for x, y in ((A, B), (B, A)))


def describe(look):
    s = silhouette(look)
    return ', '.join(x for x in (s['hair'] or 'no hair', s['hat'], 'beard' if s['beard'] else '', 'glasses' if s['glasses'] else '') if x)


def lookalikes(people, cast):
    """unnamed figures in a frame that read as a cast member: ['a crowd figure (curly) reads as 얄리 (curly)', …]"""
    out = []
    for p in people:
        if p.get('id') is not None or not p.get('look'): continue
        for cid, look in cast.items():
            if looks_like(p['look'], look):
                m = f"an unnamed {'crowd ' if p.get('crowd') else ''}figure ({describe(p['look'])}) reads as {look.get('name') or cid} ({describe(look)})"
                if m not in out: out.append(m)
    return out

FADE = 0.22    # shots() cross-fade: a frame inside it shows two shots at once
COVER_BY, COVER_MIN = 0.8, 0.9   # a real cover is (almost) whole 0.8 s into its shot or its sentence


def cover_times(t0, t1, starts):
    """when the covers of the shot [t0, t1) are judged: its start + 0.8 s and every sentence start in it + 0.8 s (only
    times inside the shot)."""
    ts = [t0 + COVER_BY] + [s + COVER_BY for s in starts if s >= t0 - 0.05]
    return sorted({round(t, 3) for t in ts if t < t1 - 0.02})


def cover_late(covers):
    """[name, opacity] pairs (docentReport().covers) at a judged moment -> lint issues for covers still fading in."""
    late = [(n, a) for n, a in covers or [] if a < COVER_MIN]
    if not late: return []
    return [('P1', 'cover-late', '; '.join(f"real cover '{n}' at {100 * a:.0f} % opacity" for n, a in late[:3])
             + f" {COVER_BY} s after its shot or sentence started: the book must be there when it is named"
             " (realCoverPair is whole by p 0.6: start its p at the cut, over ≤ 0.6 s)")]
LONG = 8.0     # a picture held longer than this is a long hold (P2)
DRAFT_SLOW = 1.2   # the voice against timeline_draft.py: 1 sentence in 10 ran >= 20 % longer (총균쇠, 2026-11-15)


def hold_limit(tl):
    """the long-hold limit for this timeline: on a draft one, 8 s / 1.2, so a shot written against the draft is still
    under 8 s when the voice is slower (총균쇠: five shots of 7.0-7.8 s on the draft held 8.1-8.4 s on the voice)."""
    return LONG / DRAFT_SLOW if tl.get('voice') == 'draft' else LONG

def judge(r, size=(1920, 1080), cast=None):
    """docentReport() of one rest frame -> list of (severity, code, detail). size: the frame (export.project_frame());
    cast: the project's CAST looks ({id: look})."""
    fw, fh = size
    out = []
    if r['partial']: out.append(('P1', 'half-drawn', f"{len(r['partial'])} parts still drawing at rest: {sorted(set(r['partial']))[:4]}"))
    if r['ghost']: out.append(('P1', 'ghost', f"faded parts left on screen: {r['ghost'][:3]}"))
    if r['zone']: out.append(('P1', 'subtitle-zone', f"ink under the subtitles: {r['zone'][:3]}"))
    if r['off']: out.append(('P1', 'off-frame', f"ink off the frame: {r['off'][:3]}"))
    if r['empty']: out.append(('P1', 'empty-bubble', f"bubble with nothing inside: {r['empty'][:3]}"))
    if r['tailFar']: out.append(('P1', 'tail-far', f"bubble tail points at no head: {r['tailFar'][:3]}"))
    if r.get('tailHigh'): out.append(('P1', 'tail-high', f"speech tail ends at the top or side of a head, not beside the mouth: {r['tailHigh'][:3]} — use say()"))
    if r['cover']: out.append(('P1', 'bubble-over-face', str(r['cover'][:3])))
    if r['overflow']: out.append(('P1', 'bubble-overflow', str(r['overflow'][:3])))
    if r['rig']: out.append(('P1', 'animal-on-rig', r['rig'][0]))
    groups = {}
    for p in r['people']:
        if not p['crowd']: groups.setdefault(p['sig'], []).append(p['id'])
    # the same cast id twice is one person shown twice (before/after, a memory): fine; two ids or anonymous copies are not
    dup = [ids for ids in groups.values() if len(ids) > 1 and (None in ids or len(set(ids)) > 1)]
    if dup: out.append(('P1', 'twins', f"{sum(len(g) for g in groups.values())} people, {len(dup)} look(s) shared by different people — give each person a cast() look"))
    like = lookalikes(r['people'], cast or {})
    if like: out.append(('P1' if r.get('budget') else 'P2', 'cast-lookalike', '; '.join(like[:3]) + " — give an extra a head no cast look has (REFERENCE §2), or draw that person with person()"))
    if len(r['people']) >= 2 and any(p['id'] is None and not p['crowd'] for p in r['people']):
        out.append(('P2', 'no-cast', f"{len(r['people'])} people and some without a cast look"))
    if r['wordy']: out.append(('P2', 'wordy-bubble', str(r['wordy'][:3])))
    if r.get('propFace'): out.append(('P2', 'prop-over-face', str(r['propFace'][:3]) + ' — open the frame: a box test, it can be empty space'))
    if r.get('propBody'): out.append(('P2', 'prop-over-body', str(r['propBody'][:3]) + ' — a prop over the torso reads as the body: hold it at the hand, beside the body (bodyOk: true if hugging is the point)'))
    ink = r.get('ink')
    if ink and not r.get('textBig') and (ink[3] - ink[1]) < 0.3 * fh and (ink[2] - ink[0]) < 0.5 * fw:
        out.append(('P2', 'small-subject', f"everything drawn fits in {int(ink[2] - ink[0])}x{int(ink[3] - ink[1])} px (< 30 % of the height): draw the subject bigger"))
    # emphasis budget (2026-11-13, owner: "the reference is minimal; you show too much and emphasise everything"):
    # one thing per shot plus at most two around it, one written word, one red verdict, ink plus purple and red only.
    # (bottom-heavy, which asked to fill the top of every frame, is gone: empty page is the reference's default.)
    if not r.get('budget'): return out   # older and make-3b1b projects (no project.json "colour": false) are not held to it
    things, words, marks, colours = r.get('things') or [], r.get('words') or [], r.get('marks') or [], r.get('colours') or []
    if len(things) >= 5: out.append(('P1', 'busy', f"{len(things)} things compete for the eye ({', '.join(things[:7])}): one subject, at most two around it — cut what the sentence can do without"))
    elif len(things) == 4: out.append(('P2', 'busy', f"4 things on screen ({', '.join(things)}): can one go?"))
    if r.get('listItems', 0) >= 3: out.append(('P2', 'list', f"a written list of {r['listItems']} lines: the reference shows a list twice in 17 minutes — keep it only if the list itself is the point, else one item per shot"))
    if len(words) >= 3: out.append(('P1', 'words', f"{len(words)} written words or labels ({' / '.join(words[:5])}): write only the named idea or the one number to remember"))
    elif len(words) == 2: out.append(('P2', 'words', f"2 written words ({' / '.join(words)}): fine for a deliberate pair or equation, otherwise keep one"))
    if len(marks) >= 2: out.append(('P1', 'marks', f"{len(marks)} red marks ({', '.join(marks)}): one verdict per shot — the red means 'this one'"))
    if colours: out.append(('P2', 'colour', f"colours besides ink, purple and red: {', '.join(colours[:6])} — paint only what the colour means (`colour: true` on that call), the rest in ink"))
    return out

def cast_similar(cast):
    """pairs of cast ids with the same head (same_head)"""
    ids = list(cast)
    return [(a, b) for i, a in enumerate(ids) for b in ids[i + 1:] if same_head(cast[a], cast[b])]


async def main(only, strict):
    from playwright.async_api import async_playwright
    tl = json.load(open('timeline.json'))
    srv, port = serve(); report = []; shots_out = {}; thumbs = []; size = project_frame(); limit = hold_limit(tl)
    os.makedirs(os.path.join(OUT, 'lint'), exist_ok=True)
    async with async_playwright() as pw:
        browser, page, errs = await open_page(pw, port)
        # the project's engine copy must match these checks (an older docent.js silently skips the newer ones)
        stale = await page.evaluate("typeof DOCENT_KINDS === 'undefined' || !DOCENT_KINDS.includes('things') || typeof docentReport !== 'function'")
        if stale:
            await browser.close(); srv.shutdown()
            print('[P0] the project\'s engine/docent.js is older than this lint: run tools/new_video.py <project> to refresh it, then lint again')
            sys.exit(1)
        cast = await page.evaluate('typeof CAST === "object" ? CAST : {}')   # cast() runs when scenes.js loads
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
                    if held > limit: report.append({'scene': sc['id'], 't': round(t0, 2), 'issues': [('P2', 'long-hold', f'picture held {held:.1f}s (> {limit:.1f} s' + (', draft timeline: the voice may run 20 % longer)' if limit < LONG else ')'))]})
                    if 0 < held < 1.2 and k + 1 < len(ts): report.append({'scene': sc['id'], 't': round(t0, 2), 'issues': [('P2', 'short-shot', f'shot only {held:.1f}s')]})
                    for tc in cover_times(t0, min(t1, end), [x['start'] for x in sc['sentences']]):   # 1b. real covers on time
                        r = await page.evaluate('(t) => { renderAt(t); return docentReport(); }', tc)
                        late = cover_late(r.get('covers'))
                        if late:
                            report.append({'scene': sc['id'], 't': round(tc, 2), 'issues': late})
                            b64 = await page.evaluate("() => document.getElementById('c').toDataURL('image/jpeg', 0.85).slice(23)")
                            open(os.path.join(OUT, 'lint', f"{sc['id']}_{tc:07.2f}.jpg"), 'wb').write(base64.b64decode(b64))
                shots_out[sc['id']] = ts
            # 2. judge each rest frame
            marked = []
            for t in rest:
                r = await page.evaluate('(t) => { renderAt(t); return docentReport(); }', t)
                if r.get('budget') and r.get('marks'): marked.append(round(t, 2))   # only ink-mode projects carry the budget
                thumbs.append((sc['id'], t, await page.evaluate("() => document.getElementById('c').toDataURL('image/jpeg', 0.7).slice(23)")))
                iss = judge(r, size, cast)
                if iss:
                    report.append({'scene': sc['id'], 't': round(t, 2), 'issues': iss})
                    if any(s in ('P0', 'P1') for s, _, _ in iss):
                        b64 = await page.evaluate("(t) => { renderAt(t); return document.getElementById('c').toDataURL('image/jpeg', 0.85).slice(23); }", t)
                        open(os.path.join(OUT, 'lint', f"{sc['id']}_{t:07.2f}.jpg"), 'wb').write(base64.b64decode(b64))
            budget = max(1, round((end - body0) / 45))   # about one red verdict per chapter, more only in a long one
            if len(marked) > budget:
                report.append({'scene': sc['id'], 't': marked[0], 'issues': [('P2', 'mark-budget', f"red marks in {len(marked)} shots ({marked[:6]}), budget {budget}: keep red for the chapter's one verdict")]})
        miss = await page.evaluate('[...MISS].concat(window.missingCues ? window.missingCues() : [])')
        await browser.close()
    srv.shutdown()
    head = []
    if errs: head.append({'scene': '*', 't': 0, 'issues': [('P0', 'page-error', e) for e in errs[:5]]})
    if miss: head.append({'scene': '*', 't': 0, 'issues': [('P0', 'missing', str(m)) for m in miss[:20]]})
    same = cast_similar(cast)
    if same: head.append({'scene': '*', 't': 0, 'issues': [('P2', 'cast-similar', f"{a} / {b} share a silhouette ({describe(cast[a])} / {describe(cast[b])}): give each a different hair or hat") for a, b in same]})
    report = head + report
    counts = {}
    for r in report:
        for s, c, _ in r['issues']: counts[s] = counts.get(s, 0) + 1
    json.dump({'counts': counts, 'shots': shots_out, 'frames': report}, open(os.path.join(OUT, 'lint.json'), 'w'), ensure_ascii=False, indent=1)
    lines = [f"# Scene lint — {sum(counts.values())} issues {counts}", '']
    for r in report:
        for s, c, d in r['issues']: lines.append(f"- [{s}] {r['scene']} @{r['t']:.2f}s {c}: {d}")
    open(os.path.join(OUT, 'lint.md'), 'w').write('\n'.join(lines) + '\n')
    for f in os.listdir(OUT):   # no stale pages from an earlier run, even when this run has no frames
        if f.startswith('lint_sheet') and f.endswith('.jpg'): os.remove(os.path.join(OUT, f))
    if thumbs:   # every rest frame, 3 across, 60 per page: lint_sheet.jpg, lint_sheet_02.jpg, …
        # one sheet for a 45-minute video was ~140,000 px tall: past JPEG's 65,535 px limit, so the save crashed and
        # the lint exited 1 with no P1 (2026-11-10, ten-books v2, 1,000+ rest frames)
        import io
        from PIL import Image, ImageDraw
        cols, tw, th, per = 3, 640, 360, 60   # big enough to see an arm through a prop
        if size[1] > size[0]: cols, tw, th = 5, 384, 683   # an upright frame: same width per row, thumbnails not squashed
        for pg in range(0, len(thumbs), per):
            part = thumbs[pg:pg + per]; rows = (len(part) + cols - 1) // cols
            sheet = Image.new('RGB', (cols * tw, rows * (th + 22)), 'white'); d = ImageDraw.Draw(sheet)
            for i, (sid, t, b64) in enumerate(part):
                im = Image.open(io.BytesIO(base64.b64decode(b64))).resize((tw, th)); x, y = (i % cols) * tw, (i // cols) * (th + 22)
                sheet.paste(im, (x, y)); d.text((x + 4, y + th + 4), f'{sid} @{t:.2f}s', fill='black')
            sheet.save(os.path.join(OUT, 'lint_sheet.jpg' if pg == 0 else f'lint_sheet_{pg // per + 1:02d}.jpg'), quality=80)   # names sort in page order
    print('\n'.join(lines[:60]))
    bad = counts.get('P0', 0) + counts.get('P1', 0) + (counts.get('P2', 0) if strict else 0)
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    a = sys.argv[1:]
    only = a[a.index('--scene') + 1:] if '--scene' in a else []
    only = [x for x in only if not x.startswith('--')]
    known = [sc['id'] for sc in json.load(open('timeline.json'))['scenes']] if os.path.exists('timeline.json') else []
    bad = [x for x in only if known and x not in known]
    if bad: sys.exit(f"unknown scene id: {' '.join(bad)} (timeline.json has: {' '.join(known)})")   # exit 1, not a false '0 issues'
    asyncio.run(main(only, '--strict' in a))
