"""Rig adapter for Live2D's Mao sample (the main streamer).
Maps the beat cues (gaze targets, expressions, think / scratch windows, laughs, AFK) to Mao's own parameters, including the
artist's expression params (ParamMouthAngry, ParamEyeBallForm, ParamEyeEffect) and arm B (hand to head, from mtn_04)."""
import math
import numpy as np
from common import FPS, rng, ease, Noise1D, Spring, seg_at, AFK_TIMING

GAZE = {   # head X/Y, eyes X/Y   (+X = viewer's right, +Y = up)
    'cam': (0, 0, 0, 0), 'chat': (-3, 26, -0.1, 1.0), 'screen': (-30, -16, -1.0, -0.8), 'alert': (-2, 24, 0.05, 1.0),
    'down': (-8, -16, -0.3, -0.9), 'think': (-5, 12, 0, 0.85), 'away': (16, 4, 0.75, 0.1),
}
EXPR = {   # smile = mouth corners up, frown = corners down (Mao exp_05/07), angry = pout mouth (exp_08), pupil = small pupils (exp_07), sparkle = exp_04
    'neutral': {'smile': .12}, 'focus': {'smile': 0, 'frown': .15, 'lid': .22, 'brow': -.15},
    'smile': {'smile': .85, 'laugh': .2, 'cheek': .25}, 'bigsmile': {'smile': 1, 'laugh': .6, 'cheek': .55, 'sparkle': .7},
    'earnest': {'brow': .6, 'smile': .1, 'eyeopen': 1.1}, 'soft': {'smile': .6, 'laugh': .1, 'cheek': .15},
    'pout': {'angry': .9, 'brow': -.7, 'browworry': .5, 'lid': .3, 'cheek': .6}, 'deadpan': {'lid': .8, 'frown': .3},
    'think': {'brow': .3, 'browasym': .8, 'mouthU': .5}, 'surprise': {'eyeopen': 1.2, 'brow': 1, 'mouthO': .45, 'pupil': .8},
    'serious': {'frown': .75, 'brow': -.5, 'browworry': .6, 'lid': .35}, 'embarrassed': {'cheek': 1, 'browworry': 1, 'smile': .25, 'lid': .3},
    'hurried': {'brow': .6, 'eyeopen': 1.12, 'browworry': .5}, 'notice': {'eyeopen': 1.08, 'brow': .25, 'frown': .35, 'pupil': .3},
    'suspicious': {'lid': .85, 'brow': -.8, 'browasym': .7, 'frown': .5, 'angry': .3}, 'exasp': {'lid': .7, 'browworry': 1, 'frown': .35},
    'laugh': {'smile': 1, 'laugh': 1, 'cheek': .7, 'sparkle': .4}, 'breathless': {'brow': .3, 'mouthA': .35, 'eyeopen': 1.05, 'smile': .45, 'browworry': .4, 'cheek': .5},
    'sneaky': {'smile': .6, 'laugh': .25, 'lid': .2, 'cheek': .5}, 'startled': {'eyeopen': 1.2, 'brow': 1}, 'shh': {'smile': .5, 'laugh': .3, 'cheek': .6},
}


def synth(B, N, vt, cursor_xy, motion=None):
    """the main streamer on Mao: gaze springs (eyes lead, head follows), blinks, expressions, the hand-to-head scratch,
    lip sync and the walk off / back in pose. motion: the streamer theme's knobs (talk_sway, nod, idle_sway)."""
    motion = motion or {}
    TS, NOD, IJ = motion.get('talk_sway', 1.0), motion.get('nod', 1.0), motion.get('idle_sway', 1.0)
    sm, vow = vt['main']
    nz = [Noise1D(s) for s in range(20, 32)]
    P = {k: np.zeros(N) for k in ['ParamAngleX', 'ParamAngleY', 'ParamAngleZ', 'ParamBodyAngleX', 'ParamBodyAngleY', 'ParamBodyAngleZ',
                                  'ParamEyeBallX', 'ParamEyeBallY', 'ParamEyeLOpen', 'ParamEyeROpen', 'ParamEyeLSmile', 'ParamEyeRSmile',
                                  'ParamEyeLForm', 'ParamEyeRForm', 'ParamBrowLY', 'ParamBrowRY', 'ParamBrowLForm', 'ParamBrowRForm',
                                  'ParamBrowLAngle', 'ParamBrowRAngle', 'ParamCheek',
                                  'ParamA', 'ParamI', 'ParamU', 'ParamE', 'ParamO', 'ParamMouthUp', 'ParamMouthDown', 'ParamBreath',
                                  'PartArmLA', 'PartArmLB', 'ParamArmLB01', 'ParamArmLB02', 'ParamArmLB03', 'ParamHandLB', 'ParamAllY', 'ParamHatForm',
                                  'ParamMouthAngry', 'ParamMouthAngryLine', 'ParamEyeBallForm', 'ParamEyeEffect']}
    hx, hy, ez = Spring(0, .14), Spring(0, .14), Spring(0, .12)
    nodf = Spring(0, .1)   # the speech nod, low-passed: a phrase-level dip, not a per-syllable bob (owner: 'talking head shakes too much')
    ex, ey = Spring(0, .55), Spring(0, .55)
    sp = {k: Spring(0, .14) for k in ['smile', 'cheek', 'brow', 'mdown', 'lid', 'browasym', 'mouthU', 'eyeopen', 'browworry', 'mouthO', 'mouthA',
                                     'frown', 'angry', 'pupil', 'sparkle']}
    sp['eyeopen'].x = 1.0
    arm = Spring(0, .2)
    talk = Spring(0, .08)
    # scratch bursts: 2-3 irregular scrubs inside each scratch window
    bursts = []
    for a, b in B.scratch:
        t = a + 0.45
        for d, gap in [(0.48, 0.1), (0.42, 0.55), (0.4, 0.3)]:   # rub, rub, a pause, one more
            if t + d > b - 0.2: break
            bursts.append((t, t + d, rng.uniform(0.85, 1.0), rng.uniform(20, 25))); t += d + gap
    bx = Spring(0, .06)
    # blinks
    blinks = []; t = 1.3
    T = N / FPS
    def busy(t): return any(a - .3 <= t < b + .5 for a, b, w in B.typing) or any(a <= t < b and g == 'screen' for a, b, g, w in B.gaze if w == 'main')
    def talking(t): return any(w == 'main' and t0 <= t < t0 + d for w, lid, t0, d in B.voices)
    while t < T:
        blinks.append(t)
        if rng.random() < (0.22 if talking(t) else 0.1): blinks.append(t + 0.3)
        mean = 6.5 if busy(t) else (2.5 if talking(t) else 3.6)
        t += max(0.9, rng.gamma(4, mean / 4))
    blink_f = np.ones(N)
    for b in blinks:
        for i in range(int((b - .1) * FPS), int((b + .25) * FPS)):
            if 0 <= i < N:
                x = i / FPS - b
                v = 1 - (1 - min(1, abs(x) / 0.075)) if x < 0 else (min(1, x / 0.16))
                blink_f[i] = min(blink_f[i], v)
    sp['laugh'] = Spring(0, .14)
    # glances at the screen/chat while talking to camera
    glances = []; t = 2.0
    while t < T:
        glances.append((t, t + rng.uniform(0.35, 0.7), rng.choice(['screen', 'chat'])))
        t += rng.uniform(4.0, 8.0)
    in_any = lambda t, L: any(a <= t < b for a, b in L)
    sacc = []; t = 0.5
    while t < T: sacc.append((t, rng.normal(0, 0.13), rng.normal(0, 0.09))); t += rng.uniform(0.35, 1.2)
    sacc_t = np.array([x[0] for x in sacc])
    hist = []
    ex.k = 0.7; ey.k = 0.7
    for i in range(N):
        t = i / FPS
        g = seg_at(B.gaze, t, 'main', 'cam')
        typing = any(a <= t < b and w == 'main' for a, b, w in B.typing)
        if g == 'cam' and typing: g = 'screen'
        if g == 'cam':
            for a, b, gg in glances:
                if a <= t < b: g = gg
        tx, ty, tex, tey = GAZE[g]
        if g == 'screen':   # follow the cursor
            cx, cy = cursor_xy[i]
            tx += (cx - 650) / 600 * 7; ty += -(cy - 620) / 400 * 5
            tex += (cx - 650) / 600 * 0.2; tey += -(cy - 620) / 400 * 0.3
            if typing and (math.sin(t * 1.3) > 0.8): tex, tey, ty = -0.3, -1.0, ty - 6   # glance at the keyboard
        if g == 'chat':     # reading lines: eyes sweep across, then jump back
            ph = (t * 1.6) % 1.0
            tex += -0.35 + 0.6 * ph; tey += -0.15 * math.floor((t * 1.6) % 3) / 2
        thinking = [(a, b) for a, b in B.think if a <= t < b]
        scratching = in_any(t, B.scratch)
        if thinking and not scratching:
            a0 = thinking[0][0]; u = (t - a0)
            # eye roll: an arc from up-left over the top to up-right and back
            ang = math.pi * (0.85 - 0.7 * ((u * 0.55) % 2 if (u * 0.55) % 2 < 1 else 2 - (u * 0.55) % 2))
            tex = 0.9 * math.cos(ang); tey = 0.55 + 0.4 * math.sin(ang)
            tx, ty = tex * 7, 13
        if scratching:
            tex, tey, tx, ty = 0.3, 0.6, 6, 6
        e = sm[i]
        tk = talk(1.0 if e > 0.05 else 0.0)
        nod = nodf(3.0 * (e - (sm[i - 2] if i > 2 else 0)))
        jitter = [nz[k](t * (1.7 + k * .3)) for k in range(6)]
        bu = [x for x in bursts if x[0] <= t < x[1]]
        scr = 0.0
        if bu:
            a_, b_, amp, w_ = bu[0]; env = math.sin(math.pi * (t - a_) / (b_ - a_)); scr = amp * env * math.sin((t - a_) * w_)
        hist.append((tx, ty)); dtx, dty = hist[max(0, len(hist) - 7)]
        ax = hx(dtx) + 2.5 * scr + IJ * 2.4 * jitter[0] + TS * 5.5 * tk * nz[12 % len(nz)](t * 2.3) + IJ * 0.5 * nz[6](t * 9)
        ay = hy(dty) + IJ * 2.0 * jitter[1] + NOD * 8 * nod + TS * 2.5 * tk * nz[7](t * 1.9) + IJ * 0.45 * nz[7](t * 9)
        en = seg_at(B.expr, t, 'main', '')
        az = ez(IJ * 3.2 * jitter[2] + TS * 4.0 * tk * nz[8](t * 1.6) + (-9 if scratching else 0) + (5 if thinking else 0) + (8 if en in ('suspicious', 'exasp') else 0) + (-6 if en == 'pout' else 0)) + 0.4 * nz[8](t * 8) + 4.0 * scr
        P['ParamAngleX'][i] = ax; P['ParamAngleY'][i] = ay; P['ParamAngleZ'][i] = az
        brth = seg_at(B.expr, t, 'main', '') == 'breathless'
        P['ParamBodyAngleX'][i] = bx(ax * 0.45) + IJ * 1.6 * jitter[3] + TS * 2.5 * tk * jitter[4]
        P['ParamBodyAngleY'][i] = ay * 0.25 + (3.5 * math.sin(t * 2 * math.pi * 1.7) if brth else 0)
        P['ParamBodyAngleZ'][i] = az * 0.35 + IJ * 1.2 * jitter[5]
        if brth: P['ParamAngleY'][i] = ay + 2 * math.sin(t * 2 * math.pi * 1.7)
        si_ = max(0, int(np.searchsorted(sacc_t, t)) - 1); _, sxx, syy = sacc[si_]
        P['ParamEyeBallX'][i] = ex(tex + sxx); P['ParamEyeBallY'][i] = ey(tey + syy)
        # expression
        name = seg_at(B.expr, t, 'main', 'neutral')
        if name == 'neutral' and g == 'screen' and e < 0.05: name = 'focus'   # drawing or typing in silence: the smile drops, eyes narrow
        xp = dict(EXPR.get(name, {}))
        for lt, w, st in B.laughs:
            if w == 'main' and lt - 0.1 <= t < lt + 1.0:
                xp['laugh'] = max(xp.get('laugh', 0), st); xp['smile'] = 1
                P['ParamAngleY'][i] += 3 * math.sin((t - lt) * 30) * (1 - (t - lt))
        if scratching: xp.update({'smile': .5, 'laugh': .0, 'browworry': .8, 'lid': .5, 'cheek': .7})
        vals = {k: sp[k](xp.get(k, 1.0 if k == 'eyeopen' else 0.0)) for k in sp}
        eo = vals['eyeopen'] * blink_f[i] * (1 - 0.45 * vals['lid']) * (1 - 0.12 * (g in ('screen', 'down')))
        lg = vals['laugh']
        P['ParamEyeLOpen'][i] = eo * (1 - lg * 0.92); P['ParamEyeROpen'][i] = eo * (1 - lg * 0.92)
        P['ParamEyeLSmile'][i] = lg; P['ParamEyeRSmile'][i] = lg
        P['ParamEyeLForm'][i] = vals['lid'] * .8; P['ParamEyeRForm'][i] = vals['lid'] * .8
        b = vals['brow']
        P['ParamBrowLY'][i] = b + vals['browasym'] * .5 + 0.35 * e * nz[11](t * 2)
        P['ParamBrowRY'][i] = b - vals['browasym'] * .3 + 0.35 * e * nz[11](t * 2 + 5)
        P['ParamBrowLForm'][i] = -vals['browworry'] + (b < 0) * b; P['ParamBrowRForm'][i] = -vals['browworry'] + (b < 0) * b
        P['ParamBrowLAngle'][i] = -vals['browworry'] * .6; P['ParamBrowRAngle'][i] = -vals['browworry'] * .6
        P['ParamCheek'][i] = min(1, vals['cheek'] + 0.06)
        speaking = e > 0.04
        for k in 'AIUEO': P['Param' + k][i] = min(0.92, vow[k][i] * e * (0.95 if k != 'I' else 0.8))
        if e > 0.04: P['ParamMouthDown'][i] = 0.35 * (vow['O'][i] + vow['U'][i]) * e
        if not speaking:
            P['ParamU'][i] = max(P['ParamU'][i], vals['mouthU'])
            P['ParamO'][i] = max(P['ParamO'][i], vals['mouthO'])
            P['ParamA'][i] = max(P['ParamA'][i], vals['mouthA'] * (0.7 + 0.3 * math.sin(t * 2 * math.pi * 1.7)))
        mu = (0.08 + 0.92 * vals['smile']) * (1 - 0.8 * min(1, e * 1.6))
        P['ParamMouthUp'][i] = mu * (1 - vals['mdown']) - vals['frown'] * (1 - 0.6 * min(1, e * 1.6))
        P['ParamMouthAngry'][i] = vals['angry'] * (1 - 0.7 * min(1, e * 1.6)); P['ParamMouthAngryLine'][i] = vals['angry'] * 0.6
        P['ParamEyeBallForm'][i] = -vals['pupil']; P['ParamEyeEffect'][i] = vals['sparkle']
        P['ParamMouthDown'][i] = max(P['ParamMouthDown'][i], vals['mdown'])
        P['ParamBreath'][i] = 0.5 + 0.5 * math.sin(t * 2 * math.pi / 3.8)
        # arm: scratch (raise -> scratch -> drop)
        av = arm(1.0 if scratching else 0.0)
        P['PartArmLA'][i] = 0 if av > 0.02 else 1; P['PartArmLB'][i] = 1 if av > 0.02 else 0
        # the artist's own hand-on-head pose from Mao's mtn_04 (arm B 15/9/8, hand 7) + the hat squashing under the hand
        P['ParamArmLB01'][i] = -30 + 45 * av + 20 * scr
        P['ParamArmLB02'][i] = -30 + 39 * av + 9 * scr
        P['ParamArmLB03'][i] = -10 + 18 * av + 34 * scr
        P['ParamHandLB'][i] = av * 7 if not scr else av * (1 + 9 * math.sin(t * 14))   # fingers open and curl while rubbing (full range, slow enough to see)
        P['ParamHatForm'][i] = av * (4 + 28 * abs(scr))   # the hat gives under each rub
        P['ParamAllY'][i] = 0
    if B.afk:
        AT = getattr(B, 'afk_t', AFK_TIMING['walk'])
        EXIT_WALK, EXIT_GONE = AT['exit_walk'], AT['exit_gone']
        RET_WALK, RET_PAUSE_END, RET_SIT_END, RET_END = AT['ret_walk'], AT['ret_pause_end'], AT['ret_sit_end'], AT['ret_end']
        tl, tb = B.afk   # tl: she stands up, tb: she walks back in (see afk_motion for the body path)
        fr = lambda t: int(round(t * FPS))
        live = {k: P[k].copy() for k in P}
        for i in range(fr(tl), min(N, fr(tb + RET_END))):
            t = i / FPS
            if t < tl + EXIT_GONE:     # rising, eyes then head turn to the door, then walking off
                u_up = ease((t - tl) / 0.9)                    # rising: looks up a touch as the face goes up
                u_eye = ease((t - tl - 0.35) / 0.3)            # eyes lead to the door
                u_hd = ease((t - tl - 0.55) / 0.55)            # head and shoulders follow ~0.2 s later, done before she walks
                walk = max(0.0, t - tl - EXIT_WALK)
                sway = 1.4 * math.sin(walk * 2 * math.pi * 0.95) * min(1, walk / 0.3)
                sway += 1.2 * math.sin(math.pi * min(1, walk / 0.5)) * (walk > 0)   # leans into the first step
                P['ParamAngleY'][i] = live['ParamAngleY'][i] * (1 - u_hd) + 6 * u_up * (1 - u_hd) - 8 * u_hd
                P['ParamAngleX'][i] = live['ParamAngleX'][i] * (1 - u_hd) + 30 * u_hd
                P['ParamAngleZ'][i] = live['ParamAngleZ'][i] * (1 - u_hd) + 4 * sway
                P['ParamBodyAngleX'][i] = live['ParamBodyAngleX'][i] * (1 - u_hd) + 10 * u_hd
                P['ParamBodyAngleZ'][i] = live['ParamBodyAngleZ'][i] * (1 - u_hd) + 3 * sway
                P['ParamEyeBallX'][i] = live['ParamEyeBallX'][i] * (1 - u_eye) + 0.9 * u_eye
                P['ParamEyeBallY'][i] = live['ParamEyeBallY'][i] * (1 - u_eye)
                for k in 'AIUEO': P['Param' + k][i] *= (1 - u_up)
            elif t < tb:               # off screen: hold the last pose
                for k in P:
                    if not k.startswith('Part'): P[k][i] = P[k][fr(tl + EXIT_GONE) - 1]
            else:                      # walking in from the right, stopping at the seat, eyes to the screen, sitting, settling
                r = t - tb
                walk_in = r < RET_WALK
                sway = (1.4 * math.sin(r * 2 * math.pi * 0.95) - 1.0) * (1 - ease(r / RET_WALK)) if walk_in else 0.0   # leaning into the walk (to the left)
                if not walk_in and r < RET_WALK + 0.5: sway = 1.0 * math.sin(math.pi * (r - RET_WALK) / 0.5)   # the stop: a small sway past upright
                u_eye = ease((r - RET_WALK + 0.25) / 0.3)      # at the seat: eyes to the screen first
                u_hd = ease((r - RET_WALK) / 0.45)             # then the head
                u_live = ease((r - RET_SIT_END) / (RET_END - RET_SIT_END))
                hx_ = -22 * (1 - u_hd) + (-26) * u_hd           # head: walking direction -> the screen
                hy_ = -4 * (1 - u_hd) + (-12) * u_hd
                P['ParamAngleX'][i] = hx_ * (1 - u_live) + live['ParamAngleX'][i] * u_live
                P['ParamAngleY'][i] = hy_ * (1 - u_live) + live['ParamAngleY'][i] * u_live
                P['ParamAngleZ'][i] = (4 * sway) * (1 - u_live) + live['ParamAngleZ'][i] * u_live
                sit = ease((r - RET_PAUSE_END) / (RET_SIT_END - RET_PAUSE_END))
                adj = math.sin(math.pi * min(1, max(0, (r - RET_SIT_END) / 0.6)))   # a little wriggle into the chair
                P['ParamBodyAngleX'][i] = (-8 * (1 - sit) + 4 * adj) * (1 - u_live) + live['ParamBodyAngleX'][i] * u_live
                P['ParamBodyAngleZ'][i] = (3 * sway - 3 * adj) * (1 - u_live) + live['ParamBodyAngleZ'][i] * u_live
                P['ParamBodyAngleY'][i] = (-5 * math.sin(math.pi * sit)) * (1 - u_live) + live['ParamBodyAngleY'][i] * u_live
                ex_ = -0.6 * (1 - u_eye) - 1.0 * u_eye; ey_ = -0.55 * u_eye
                P['ParamEyeBallX'][i] = ex_ * (1 - u_live) + live['ParamEyeBallX'][i] * u_live
                P['ParamEyeBallY'][i] = ey_ * (1 - u_live) + live['ParamEyeBallY'][i] * u_live
    return P


