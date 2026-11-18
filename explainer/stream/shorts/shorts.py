"""Live-stream VOD -> 9:16 Shorts of about a minute (쇼츠), cut from the live build by the episode's shorts_plan.py.

Each short is a list of whole lines from the stream, jump-cut, laid out for a phone (1080x1920):
  top     the title: a few words of plain heavy white type on black, one word in one colour (stays the whole short)
  middle  the Paint canvas (or the real photo of the thing she names, from the edit plan's BROLL/INSERTS)
  lower   her face, big
  seam    big captions over her hat, inside the Shorts safe zone
  end     the last words on screen say where the full live stream is (set like a caption)
Why it is built this way: shorts/RESEARCH.md (§10: the look, from 56 real clip Shorts). The live link itself is set at upload (YouTube's related-video field).

usage: python shorts.py <episode dir> <live build> <out dir> [--only s1,s2] [--plan-only]
   -> <out>/<id>/short.mp4, captions_ko.srt, meta.json (title, description, publish time)"""
import argparse, json, os, subprocess, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'edit'))
import cut as E   # the edit's HTML/fonts, plan loader, wav helpers and card renderer are shared

W, H, FPS, SR = 1080, 1920, E.FPS, E.SR
CANVAS = (94, 262, 1100, 700)        # the Paint canvas on the 1920x1080 live frame
FACE = (1262, 600, 658, 370)         # her face, a little lower than the edit's 'face' so the hat brim and eyes both fit
# RESEARCH.md §6: text that must be read stays in x 48..888, y 288..1248 (the player's top icons, right button rail and
# bottom title bar cover the rest); her eyes may sit down to ~1530
# real clip Shorts put the title at y ~150-450 (§10); the text itself starts below ~280
SAFE_X, SAFE_W = 48, 840
TITLE_Y, TITLE_H = 200, 300          # title band 200..500 on the black frame
TITLE_X, TITLE_W = 40, 1000          # nearly full width like real clips: the button rail starts far lower, the top icons sit higher
SLOT_C = (520, 640)                  # canvas slot 520..1160 (full width; the canvas crop is widened to 1080:640)
SLOT_F = (1160, 607)                 # face slot 1160..1767, her eyes at ~1420
CAP_Y, CAP_H = 1040, 240             # captions over the seam 1040..1280, in the safe column
PRE, POST, MERGE = 0.10, 0.22, 0.45  # pad around a line; lines closer than MERGE in the source stay one shot
CAP_MAX = 26                         # characters on screen at once (2 lines of <= ~13, RESEARCH.md §3); longer lines play as 2 captions
BOX = (CANVAS[0], CANVAS[1] + (CANVAS[3] - round(CANVAS[2] * SLOT_C[1] / W)) // 2, CANVAS[2], round(CANVAS[2] * SLOT_C[1] / W))   # the whole canvas at the slot's shape


def segments(lines, V, split=()):
    """whole lines -> source shots [(s0, s1, [line ids])]; neighbours in source order merge when the gap is short, unless the
    line is in `split` (a new shot there, e.g. to change the canvas framing)"""
    out = []
    for lid in lines:
        _, t, d = V[lid]; s0, s1 = t - PRE, t + d + POST
        if out and out[-1][2] and lid not in split and V[out[-1][2][-1]][1] < t and s0 - out[-1][1] < MERGE: out[-1] = (out[-1][0], s1, out[-1][2] + [lid])
        else: out.append((s0, s1, [lid]))
    return out


def timeline(segs, V):
    """output times: shot k starts where shot k-1 ended; a line's caption runs over its spoken span"""
    t, shots, subs = 0.0, [], []
    for s0, s1, ls in segs:
        shots.append({'s0': s0, 's1': s1, 'o0': t, 'o1': t + s1 - s0, 'lines': ls})
        for lid in ls:
            _, lt, d = V[lid]; subs.append((t + lt - s0, t + lt - s0 + d, lid))
        t += s1 - s0
    return shots, subs, t


def chunks(text, n=CAP_MAX):
    """a line longer than n characters becomes captions shown one after another, split at a space (after punctuation
    when one is near the middle); [(text, share of the line's time)]"""
    if len(text) <= n or ' ' not in text: return [(text, 1.0)]
    a, b = split2(text, 0).split('\n', 1)
    out = chunks(a, n) + chunks(b, n); tot = sum(len(x) for x, _ in out)
    return [(x, len(x) / tot) for x, _ in out]


def captions(subs, text_of, end, tail=0.12):
    """[(o0, o1, line, text)] on screen: a long line as consecutive chunks timed by length; the first caption from frame 0
    (frame 0 is the thumbnail); each held `tail` s past its words but never into the next caption (two captions overlapping
    for a few frames read as garbage)"""
    caps = []
    for o0, o1, lid in subs:
        t = o0
        for txt, share in chunks(text_of(lid)):
            caps.append([0.0 if not caps else t, t + (o1 - o0) * share, lid, txt]); t += (o1 - o0) * share
    for k, c in enumerate(caps):
        nxt = caps[k + 1][0] if k + 1 < len(caps) else end
        c[1] = min(c[1] + tail, nxt, end)
    return [tuple(c) for c in caps]


def split2(text, n=15):
    """a caption on at most two lines, broken at a space near the middle; a space after punctuation wins when it is close
    enough (so '신기한데, / 백 번째 소는' rather than '백 / 번째'); Korean keeps words whole"""
    if len(text) <= n or ' ' not in text: return text
    mid = len(text) / 2
    score = lambda i: abs(i - mid) - (len(text) * 0.22 if text[i - 1] in ',.?!' else 0)
    cut = min((i for i, c in enumerate(text) if c == ' '), key=score)
    return text[:cut] + '\n' + text[cut + 1:]


# The look of real Korean clip Shorts (RESEARCH.md §10: 56 shorts sampled 2026-11-18): a black frame; the title in plain heavy
# white type, at most one word in one flat colour; captions white with a black outline. No gradients, glows, emoji, pills or
# series badges: the owner called the first version (purple gradient, emoji series label, gradient-filled outlined title,
# emoji pill cards) "AI slop".
SHEAD = E.HEAD.replace('</style>', '@font-face{font-family:PB;src:url(' + E.FONT + 'Pretendard-Black.woff2);font-weight:900}\n</style>')
EM = lambda c: 1.0 if '\uac00' <= c <= '\ud7a3' else (0.32 if c == ' ' else 0.6)   # rough glyph widths in em (Hangul, space, other)


def fit(lines, width, cap):
    """the font size at which the widest line fills `width`, at most `cap`"""
    return int(min(cap, width / max(sum(EM(c) for c in x) for x in lines)))


def html_cap(text, who, key=''):
    fam, fill = ('PB', '#ffffff') if who != 'sis' else ('JU', '#ffd6ea')
    body = '<br>'.join(E.hl(x, key) for x in split2(text, 13).split('\n'))
    return SHEAD + f"""<body style="width:{SAFE_W}px;height:{CAP_H}px;display:flex;align-items:center;justify-content:center">
<div style="max-width:{SAFE_W - 10}px;text-align:center;font-family:{fam};font-weight:900;font-size:62px;line-height:1.2;color:{fill};text-shadow:{E.ring(5, '#000')};
word-break:keep-all">{body}</div></body>"""


def html_hook(hook, key=''):
    """the title: one or two short lines of heavy white type on the black frame, `key` (a word in it) in the accent colour"""
    lines = hook.split('\n')[:2]
    size = fit(lines, TITLE_W - 30, 128)
    body = '<br>'.join(E.hl(x, key) for x in lines)
    return SHEAD + f"""<body style="width:{TITLE_W}px;height:{TITLE_H}px;display:flex;align-items:center;justify-content:center">
<div style="font-family:PB;font-weight:900;font-size:{size}px;line-height:1.16;letter-spacing:-2px;color:#fff;text-align:center;white-space:nowrap">{body}</div></body>"""


def html_photo(src, label, focus=(0.5, 0.5)):
    """the real thing in the canvas slot; a plain small label (what the photo is) in white with a black outline"""
    fx, fy = focus
    lab = f"""<div style="position:absolute;left:22px;top:18px;font-family:PB;font-weight:900;font-size:34px;color:#fff;text-shadow:{E.ring(4, '#000')};
white-space:nowrap">{E.esc(label)}</div>""" if label else ''
    return SHEAD + f"""<body style="width:{W}px;height:{SLOT_C[1]}px;position:relative;overflow:hidden">
<img src="{src}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:{fx * 100:.0f}% {fy * 100:.0f}%">{lab}</body>"""


def html_end(text, key=''):
    """the last words on screen after the last line: where the full stream is, set like a caption (no card, no emoji)"""
    return html_cap(text, 'main', key)


def html_bg():
    return SHEAD + f"""<body style="width:{W}px;height:{H}px;background:#000"></body>"""


def photos(EP, P, lines, V, marks, shots, show=None, skip=()):
    """the edit plan's real photos (BROLL, INSERTS) whose line is in this short, placed in the canvas slot at the same word;
    plus the short's own `show` = {line: (image, label, focus)}: a photo over that whole line (a blank canvas there, or the
    picture the ending needs), held through the end card when it is the last line"""
    out = []
    for lid, (img, lab, foc) in (show or {}).items():
        for sh in (s for s in shots if lid in s['lines']):   # every time the line plays (a hook that comes back)
            _, t, d = V[lid]
            o0 = sh['o0'] + max(0.0, t - PRE - sh['s0']); o1 = sh['o0'] + min(sh['s1'], t + d + POST) - sh['s0']
            if sh is shots[-1] and lid == sh['lines'][-1]: o1 = 1e6
            out.append({'img': os.path.join(EP, img), 'label': lab.replace('📷', '').strip(), 'focus': foc, 'o0': o0, 'o1': o1})
    if not P: return out
    for b in list(getattr(P, 'BROLL', [])) + list(getattr(P, 'INSERTS', [])):
        kind, ref, frac = b['at']
        if ref in skip: continue   # the short frames this line itself (its own photo or a punch-in)
        if kind == 'line' and ref in lines: _, t, d = V[ref]; ts = t + frac * d
        elif kind == 'mark' and ref in marks: ts = marks[ref] + frac
        else: continue
        sh = next((s for s in shots if s['s0'] <= ts < s['s1']), None)
        if not sh: continue
        o0 = sh['o0'] + ts - sh['s0']; o1 = min(o0 + b['dur'], sh['o1'])
        if o1 - o0 < 0.6: continue
        lab = b.get('label', '').replace('📷', '').strip()   # the edit's labels carry a camera emoji; shorts do not
        out.append({'img': os.path.join(EP, b['image']), 'label': lab, 'focus': b.get('focus', b.get('crop', (0.5, 0.5))), 'o0': o0, 'o1': o1})
    return out


def canvas_box(Pe, lid, zoom=None):
    """the edit's punch-in box for this line when it is on the canvas, at the slot's shape; else the whole canvas (BOX)"""
    if zoom and lid in zoom:   # the short's own box (x, y, w) on the live frame, for small canvas text the edit did not punch into
        x, y, w = zoom[lid]; h = w * SLOT_C[1] / W; y = max(CANVAS[1], min(CANVAS[1] + CANVAS[3] - h, y))
        return (int(x), int(y), int(w), int(round(h)))
    Z = getattr(Pe, 'Z', {}) if Pe else {}; name = (getattr(Pe, 'ZOOM', {}) if Pe else {}).get(lid)
    if isinstance(name, (list, tuple)): name = name[0]
    box = Z.get(name) if name else None
    if not box or box[0] + box[2] > 1260 or box[1] < 200: return BOX
    x, y, w, _ = box; h = w * SLOT_C[1] / W   # widened (or cropped) to the slot's 1080:640
    cy = y + box[3] / 2; y = max(CANVAS[1], min(CANVAS[1] + CANVAS[3] - h, cy - h / 2))
    return (int(x), int(y), int(w), int(round(h)))


def blank_frames(video):
    """frames where the face slot shows only the background (a shot that started before its picture): their indices"""
    x, y, w, h = 0, SLOT_F[0], W, SLOT_F[1]
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-vf', f'crop={w}:{h}:{x}:{y},scale=16:9,format=gray', '-f', 'rawvideo', '-'],
                       capture_output=True, check=True)
    a = np.frombuffer(r.stdout, np.uint8).reshape(-1, 9 * 16).astype(np.float32)
    return [int(i) for i in np.where(a.std(1) < 6)[0]]


def render(S, EP, BD, out, P, Pe, V, L, marks):
    os.makedirs(out, exist_ok=True); G = os.path.join(out, 'gfx'); os.makedirs(G, exist_ok=True)
    segs = segments(S['lines'], V, S.get('split', ())); shots, subs, total = timeline(segs, V)
    hold = S.get('end_hold', 1.4); total_out = total + hold   # the CTA card alone after the last line, then the end (RESEARCH.md §3-4)
    # during the card the stream keeps running (she blinks, breathes) unless she speaks again within it; then the frame holds
    last_t = V[shots[-1]['lines'][-1]][1]
    nxt = min([t for _, t, _ in V.values() if t > last_t] + [1e9])
    ext = hold if nxt > shots[-1]['s1'] + hold + 0.3 else 0.0
    print(f"{S['id']}: {len(S['lines'])} lines, {len(shots)} shots, {total:.1f}s + end {hold}s = {total_out:.1f}s", flush=True)
    assert total_out <= 59.5, f"{S['id']} is {total_out:.1f}s: a short must stay under 60 s"
    if os.environ.get('SHORTS_PLAN_ONLY'): return total_out
    # graphics
    PNG, OV = [], []
    def png(name, html, w, h): p = os.path.join(G, name + '.png'); PNG.append({'out': p, 'w': w, 'h': h, 'html': html}); return p
    bg = png('bg', html_bg(), W, H)
    OV.append((png('hook', html_hook(S['hook'], S.get('hook_key', '')), TITLE_W, TITLE_H), TITLE_X, TITLE_Y, 0, total_out))
    # photos first: captions and the end card are drawn over them, never under
    for k, ph in enumerate(photos(EP, Pe, S['lines'], V, marks, shots, S.get('show'), S.get('no_broll', ()))):
        lab = ph['label'] if S.get('photo_labels') else ''   # real clips do not caption their pictures; the spoken line says what it is
        OV.append((png(f'photo_{k}', html_photo('file://' + ph['img'], lab, ph['focus']), W, SLOT_C[1]), 0, SLOT_C[0], ph['o0'], min(ph['o1'], total_out)))
    caps = captions(subs, lambda lid: S.get('text', {}).get(lid, L[lid]['text']), total_out)
    for k, (o0, o1, lid, txt) in enumerate(caps):
        key = S.get('hl', {}).get(lid, '')
        OV.append((png(f'cap_{k}', html_cap(txt, V[lid][0], key if key in txt else ''), SAFE_W, CAP_H), SAFE_X, CAP_Y, o0, o1))
    if S.get('end'):   # RESEARCH.md §4: the CTA in the last seconds; reviewers (ep. 1) asked that it not cover the drawing or
        # the open question, so it comes when the last line has ended, alone in the caption band, and the short ends 1.3 s later
        t_end = subs[-1][1] + 0.1
        OV.append((png('end', html_end(S['end'], S.get('end_key', '')), SAFE_W, CAP_H), SAFE_X, CAP_Y, t_end, total_out))
    spec = os.path.join(G, 'spec.json'); json.dump({'png': PNG, 'clips': []}, open(spec, 'w'))
    E.run(['node', os.path.join(HERE, '..', 'edit', 'cards.mjs'), spec])
    # the picture: one base clip per shot (canvas + face on the background), then the overlays in one pass
    parts = []
    for k, sh in enumerate(shots):
        zl = next((l for l in sh['lines'] if l in S.get('zoom', {})), sh['lines'][0])
        cx, cy, cw, ch = canvas_box(Pe, zl, S.get('zoom'))
        p = os.path.join(G, f'shot_{k}.mp4'); parts.append(p)
        last = k == len(shots) - 1; dur = sh['s1'] - sh['s0'] + (ext if last else 0)
        tail = f",tpad=stop_mode=clone:stop_duration={hold:.3f}" if last and not ext else ''
        E.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f"{sh['s0']:.3f}", '-t', f'{dur:.3f}', '-i', os.path.join(BD, 'final.mp4'), '-loop', '1', '-framerate', str(FPS), '-i', bg,
               '-filter_complex', f"[0:v]fps={FPS},setpts=PTS-STARTPTS,split[a][b];[a]crop={cw}:{ch}:{cx}:{cy},scale={W}:{SLOT_C[1]}[c];[b]crop={FACE[2]}:{FACE[3]}:{FACE[0]}:{FACE[1]},scale={W}:{SLOT_F[1]}[f];"
               f"[1:v][c]overlay=0:{SLOT_C[0]}:shortest=1[t];[t][f]overlay=0:{SLOT_F[0]}{tail}[v]",
               '-map', '[v]', '-an', '-r', str(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', p])
    lst = os.path.join(G, 'parts.txt'); open(lst, 'w').write('\n'.join(f"file '{p}'" for p in parts))
    base = os.path.join(G, 'base.mp4'); E.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', base])
    blank = blank_frames(base)
    assert not blank, f"{S['id']}: {len(blank)} frames without the stream in them (first at {blank[0] / FPS:.2f}s)"
    args, chain, last = ['ffmpeg', '-y', '-loglevel', 'error', '-i', base], [], '0:v'
    for k, (p, x, y, t0, t1) in enumerate(OV):
        args += ['-i', p]; nxt = f'v{k}'
        chain.append(f"[{last}][{k + 1}:v]overlay={x}:{y}:enable='between(t,{t0:.3f},{t1:.3f})'[{nxt}]"); last = nxt
    vid = os.path.join(G, 'video.mp4')
    E.run(args + ['-filter_complex', ';'.join(chain), '-map', f'[{last}]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', str(FPS), vid])
    # the sound: her voice from the dry mix, cut the same way; the stream's BGM bed under it; the hold fades out
    dry = E.read_wav(os.path.join(BD, 'mix_dry.wav')); N = int(round(total_out * SR)); voice = np.zeros((N, 2), np.float32); f = int(0.004 * SR)
    for sh in shots:
        i0, j0, n = int(round(sh['o0'] * SR)), int(round(sh['s0'] * SR)), int(round((sh['s1'] - sh['s0'] + (ext if sh is shots[-1] else 0)) * SR))
        seg = dry[j0:j0 + n].copy(); seg = np.pad(seg, ((0, n - len(seg)), (0, 0)))
        r = np.ones(n, np.float32); r[:f] = np.linspace(0, 1, f); r[-f:] = np.linspace(1, 0, f); voice[i0:i0 + n] += seg[:N - i0] * r[:N - i0, None]
    on = np.abs(voice).max(1) > 0.02; rms = float(np.sqrt(np.mean(voice[on] ** 2))) if on.any() else 0.05
    bgm = E.read_wav_any(os.path.join(E.CACHE, 'bgm', 'tokyo_sunset.mp3'))
    loop = np.concatenate([bgm] * (N // len(bgm) + 2))[:N]; g = np.full(N, rms / (float(np.sqrt(np.mean(bgm ** 2))) + 1e-9) * 10 ** (-17 / 20), np.float32)
    k = int(0.6 * SR); g[-k:] *= np.linspace(1, 0, k)
    mix = voice + loop * g[:, None]; mix = mix / max(1e-6, float(np.abs(mix).max())) * 0.9
    wav = os.path.join(G, 'mix.wav')
    with wave.open(wav, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
    final = os.path.join(out, 'short.mp4')
    E.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', vid, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9',
           '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final])
    # captions (YouTube can show them; the burned-in ones are the main read) and the upload metadata
    ts = lambda t: '%02d:%02d:%02d,%03d' % (int(t // 3600), int(t % 3600 // 60), int(t % 60), int(round(t * 1000)) % 1000)
    open(os.path.join(out, 'captions_ko.srt'), 'w').write('\n'.join(f'{k + 1}\n{ts(o0)} --> {ts(o1)}\n{txt}\n' for k, (o0, o1, lid, txt) in enumerate(caps)))
    meta = {'id': S['id'], 'file': 'short.mp4', 'title': S['title'], 'desc': S['desc'], 'tags': S.get('tags', ''), 'publish': S.get('publish', 'now'),
            'related': S.get('related'), 'length': round(total_out, 2), 'lines': S['lines'], 'shots': shots, 'subs': subs,
            'hook': S['hook'], 'end': S.get('end', ''), 'end_hold': hold, 'lines_json': os.path.join(EP, 'lines.json'),
            'photos': [o[0] for o in OV if '/photo_' in o[0]]}
    json.dump(meta, open(os.path.join(out, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
    print(f"{S['id']} -> {final} {total_out:.1f}s", flush=True)
    return total_out


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('ep'); ap.add_argument('bd'); ap.add_argument('out')
    ap.add_argument('--only', default=''); ap.add_argument('--plan-only', action='store_true'); a = ap.parse_args()
    if a.plan_only: os.environ['SHORTS_PLAN_ONLY'] = '1'
    EP, BD = os.path.abspath(a.ep), os.path.abspath(a.bd)
    P = E.load_plan(os.path.join(EP, 'shorts_plan.py'))
    Pe = E.load_plan(os.path.join(EP, 'edit_plan.py')) if os.path.exists(os.path.join(EP, 'edit_plan.py')) else None
    L = {x['id']: x for x in json.load(open(os.path.join(EP, 'lines.json')))}
    ev = json.load(open(os.path.join(BD, 'events.json'))); V = {lid: (who, t, d) for who, lid, t, d in ev['voices']}
    mp = os.path.join(BD, 'marks.json'); marks = json.load(open(mp)) if os.path.exists(mp) else {}
    only = set(x for x in a.only.split(',') if x)
    for S in P.SHORTS:
        if only and S['id'] not in only: continue
        for lid in S['lines']: assert lid in V, f"{S['id']}: line {lid} is not in the live build"
        render(S, EP, BD, os.path.join(a.out, S['id']), P, Pe, V, L, marks)


if __name__ == '__main__':
    main()
