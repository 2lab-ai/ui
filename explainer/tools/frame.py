"""The frame a project renders at, from project.json:

    "format": "short"        a vertical YouTube Short, 1080 x 1920
    "size": [w, h]           any size (even numbers: H.264 4:2:0 needs them); wins over "format"
    neither                  the 1080p landscape video, 1920 x 1080 (every project made before formats existed)

engine/engine.js FORMATS holds the same table and also the safe area and subtitle size of each format;
test_frame.py checks that the two agree.
"""

FORMATS = {'landscape': (1920, 1080), 'short': (1080, 1920)}


def frame_size(pj):
    """project.json (a dict, or None) -> (width, height). Raises ValueError on an unknown format or a bad size."""
    pj = pj or {}
    fmt = pj.get('format') or 'landscape'
    if fmt not in FORMATS: raise ValueError(f'project.json "format": {fmt!r} is not one of {", ".join(FORMATS)}')
    size = pj.get('size')
    if size is None: return FORMATS[fmt]
    if (not isinstance(size, (list, tuple)) or len(size) != 2
            or not all(isinstance(v, int) and not isinstance(v, bool) and 16 <= v <= 8192 and v % 2 == 0 for v in size)):
        raise ValueError(f'project.json "size": {size!r} must be [width, height], even whole numbers from 16 to 8192')
    return int(size[0]), int(size[1])
