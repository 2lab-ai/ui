"""Rig adapter for Live2D's Hiyori sample (the extra who peeks in): leans into the mic when she whispers, checks the
door, reads the chat, small whisper mouth (ParamMouthOpenY + ParamMouthForm). Hiyori's design must not be changed (license)."""
import math
import numpy as np
from common import FPS, rng, Noise1D, Spring, seg_at

EXPR = {'neutral': {'smile': .12}, 'smile': {'smile': .85, 'laugh': .2}, 'sneaky': {'smile': .6, 'laugh': .25, 'lid': .2, 'cheek': .5},
        'startled': {'eyeopen': 1.2, 'brow': 1}, 'shh': {'smile': .5, 'laugh': .3, 'cheek': .6}, 'wink': {'smile': .7, 'cheek': .6}}

def synth(B, N, vt, motion=None):
    """the sister: leans into the mic when she whispers, keeps checking the door (screen right), head tilted."""
    sm, vow = vt['sis']
    nz = [Noise1D(s) for s in range(40, 52)]
    P = {k: np.zeros(N) for k in ['ParamAngleX', 'ParamAngleY', 'ParamAngleZ', 'ParamBodyAngleX', 'ParamBodyAngleZ', 'ParamEyeBallX', 'ParamEyeBallY',
                                  'ParamEyeLOpen', 'ParamEyeROpen', 'ParamEyeLSmile', 'ParamEyeRSmile', 'ParamBrowLY', 'ParamBrowRY',
                                  'ParamMouthForm', 'ParamMouthOpenY', 'ParamCheek', 'ParamBreath', 'PartArmA', 'PartArmB', 'ParamHandLB', 'ParamHandRB']}
    sc = np.ones(N); sy = np.zeros(N)
    hx, hy, hz = Spring(0, .13), Spring(0, .12), Spring(-8, .08)
    ex, ey = Spring(0, .5), Spring(0, .5)
    lean = Spring(0, .06)
    sp = {k: Spring(0, .1) for k in ['smile', 'laugh', 'cheek', 'brow', 'eyeopen', 'lid']}; sp['eyeopen'].x = 1
    blinks = []; t = 0.8
    while t < N / FPS: blinks.append(t); t += rng.uniform(1.8, 4.2)
    door = []; t = 1.0
    while t < N / FPS: door.append((t, t + rng.uniform(0.45, 0.8))); t += rng.uniform(3.0, 5.5)
    lines = [(t0, t0 + d, k) for k, (w, lid, t0, d) in enumerate([v for v in B.voices if v[0] == 'sis'])]
    for i in range(N):
        t = i / FPS
        g = seg_at(B.gaze, t, 'sis', 'cam')
        typing = any(a <= t < b and w == 'sis' for a, b, w in B.typing)
        speaking_line = [k for a, b, k in lines if a - 0.3 <= t < b + 0.2]
        tilt = -9 if not speaking_line else (-9 if speaking_line[0] % 2 == 0 else 6)
        if typing: tx, ty, tex, tey = -24, -20, -1.0, -1.0
        elif g == 'look': tx, ty, tex, tey = 22 * math.sin(t * 1.7), 2, .9 * math.sin(t * 1.7), .1
        elif g == 'door': tx, ty, tex, tey = 24, 1, 0.95, 0.05
        elif g == 'chat': tx, ty, tex, tey = -6, 17, -0.35, 0.95   # reading the chat above her
        else:
            tx, ty, tex, tey = -2, -5, 0.05, -0.1
            if any(a <= t < b for a, b in door): tx, tex = 14, 0.95   # checking the door
        e = sm[i]
        ln = lean(1.0 if speaking_line else 0.0)
        sc[i] = 1 + 0.07 * ln; sy[i] = 18 * ln
        ax = hx(tx) + 2.6 * nz[0](t * 1.9)
        ay = hy(ty - 6 * ln) + 2.2 * nz[1](t * 1.7) + 7 * (e - (sm[i - 2] if i > 2 else 0))
        az = hz(tilt) + 2.5 * nz[2](t * 1.3)
        P['ParamAngleX'][i] = ax; P['ParamAngleY'][i] = ay; P['ParamAngleZ'][i] = az
        P['ParamBodyAngleX'][i] = ax * .3; P['ParamBodyAngleZ'][i] = az * .35
        P['ParamEyeBallX'][i] = ex(tex); P['ParamEyeBallY'][i] = ey(tey)
        name = seg_at(B.expr, t, 'sis', 'sneaky'); xp = dict(EXPR.get(name, {}))
        for lt, w, st in B.laughs:
            if w == 'sis' and lt - 0.1 <= t < lt + 1.0: xp['laugh'] = st; xp['smile'] = 1
        v = {k: sp[k](xp.get(k, 1.0 if k == 'eyeopen' else 0.0)) for k in sp}
        bl = 1.0
        for b in blinks:
            if b - 0.08 <= t < b + 0.18: bl = min(bl, abs(t - b) / 0.08 if t < b else (t - b) / 0.18)
        eo = v['eyeopen'] * bl * (1 - 0.4 * v['lid'])
        P['ParamEyeLOpen'][i] = eo * (1 - v['laugh'] * .9); P['ParamEyeROpen'][i] = eo * (1 - v['laugh'] * .9)
        P['ParamEyeLSmile'][i] = v['laugh']; P['ParamEyeRSmile'][i] = v['laugh']
        if name == 'wink': P['ParamEyeLOpen'][i] = 0.0; P['ParamEyeLSmile'][i] = 1.0
        P['ParamBrowLY'][i] = v['brow']; P['ParamBrowRY'][i] = v['brow']
        P['ParamCheek'][i] = min(1, v['cheek'] + .3)
        hold_e = max(sm[max(0, i - k)] for k in range(5))
        P['ParamMouthOpenY'][i] = 0.03 * (hold_e > 0.05) + 0.34 * max(0.0, (e - 0.12) / 0.88) ** 1.15   # small on soft syllables, a bit more on stress
        form = 0.7 * vow['I'][i] + 0.5 * vow['E'][i] - 1.2 * vow['O'][i] - 1.0 * vow['U'][i] + 0.1 * vow['A'][i]
        ew = min(1.0, 0.45 + e); P['ParamMouthForm'][i] = (0.2 + 0.8 * v['smile']) * (1 - ew) + form * ew if hold_e > 0.05 else (0.2 + 0.8 * v['smile'])
        P['ParamBreath'][i] = 0.5 + 0.5 * math.sin(t * 2 * math.pi / 3.2)
        shh = name == 'shh'
        P['PartArmA'][i] = 0 if shh else 1; P['PartArmB'][i] = 1 if shh else 0
        P['ParamHandLB'][i] = -10; P['ParamHandRB'][i] = -10
    return P, sc, sy


