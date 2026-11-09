"""Colored formulas -> glyph outline paths (matplotlib mathtext, Computer Modern), for the engine's write-on effect.
Run in a project folder: reads formulas.py (F = {id: (mathtext, colour spec)}), writes formulas.json
(per formula: glyph outlines [{d, x, y, ch, c}] + rule rects, in em units)."""
import json, os
import matplotlib
matplotlib.rcParams['mathtext.fontset'] = 'cm'
from matplotlib.textpath import TextToPath
from matplotlib.font_manager import FontProperties
from matplotlib.path import Path

import importlib.util
PROJ = os.getcwd()
_spec = importlib.util.spec_from_file_location('formulas', os.path.join(PROJ, 'formulas.py'))
_mod = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_mod)
F = _mod.F
W = 'white'

def path_d(verts, codes):
    out, i = [], 0
    while i < len(codes):
        c = codes[i]
        if c == Path.MOVETO: out.append('M%.4f %.4f' % tuple(verts[i])); i += 1
        elif c == Path.LINETO: out.append('L%.4f %.4f' % tuple(verts[i])); i += 1
        elif c == Path.CURVE3: out.append('Q%.4f %.4f %.4f %.4f' % (*verts[i], *verts[i + 1])); i += 2
        elif c == Path.CURVE4: out.append('C%.4f %.4f %.4f %.4f %.4f %.4f' % (*verts[i], *verts[i + 1], *verts[i + 2])); i += 3
        elif c == Path.CLOSEPOLY: out.append('Z'); i += 1
        else: i += 1
    return ' '.join(out)

def main():
    t2p = TextToPath()
    prop = FontProperties(size=100)
    CM = {'\u00bc': 'π', '\u00b5': 'θ', '\u00a1': '−', '\u00a3': '×'}
    out = {}
    for fid, (s, spec) in F.items():
        glyph_info, glyph_map, rects = t2p.get_glyphs_mathtext(prop, s)
        width, height, depth, pglyphs, prects = t2p.mathtext_parser.parse(s, 72, prop.copy())
        chars = [CM.get(chr(g[2]), chr(g[2])) for g in pglyphs]
        assert len(chars) == len(glyph_info), (fid, len(chars), len(glyph_info))
        runs = spec.get('runs'); default = spec.get('_', W)
        glyphs = []
        for k, (gid, x, y, scale) in enumerate(glyph_info):
            verts, codes = glyph_map[gid]
            v = [(vx * scale / 100, -vy * scale / 100) for vx, vy in verts]   # em units, y down
            ch = chars[k]
            c = runs[k] if runs and k < len(runs) else spec.get(ch, default)
            glyphs.append({'x': x / 100, 'y': -y / 100, 'd': path_d(v, codes), 'ch': ch, 'c': c})
        rs = []
        for verts, codes in rects:
            xs = [vx / 100 for vx, vy in verts[:-1]]; ys = [-vy / 100 for vx, vy in verts[:-1]]
            rs.append({'x': min(xs), 'y': min(ys), 'w': max(xs) - min(xs), 'h': max(ys) - min(ys), 'c': spec.get('rc', default)})
        out[fid] = {'tex': s, 'w': width / 100, 'h': height / 100, 'depth': depth / 100, 'glyphs': glyphs, 'rects': rs}
        print(f'{fid:10s} w={width/100:.2f} h={height/100:.2f} d={depth/100:.2f} chars={"".join(chars)} colors={"".join(g["c"][0] for g in glyphs)} rects={len(rs)}')
    json.dump(out, open(os.path.join(PROJ, 'formulas.json'), 'w'), ensure_ascii=False)

if __name__ == '__main__':
    main()
