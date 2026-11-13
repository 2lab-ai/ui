"""Title check for a YouTube upload: lints the title's form and measures the search demand of its keywords.

usage: python title_check.py "<title>" [--keyword KW]... [--book "<book title>"] [--author "<name>"]
                              [--json out.json] [--no-net] [--strict]

Form (REFERENCE §10): the hook comes first and fits in about 30 characters; the whole title stays within about 55; a
book or author name never opens the title; no format labels such as "도슨트북", "(30분 …)", "N분 요약".

Demand: for every --keyword, the top 30 YouTube search results (yt-dlp, no API key) and the subscriber counts of the
channels behind results with 30,000+ views. Printed per keyword:
  median   median views of the 30 results (how many people watch this topic)
  n100k    results with 100,000+ views
  small    small-channel hits: a channel under 50,000 subscribers with 50,000+ views, or 100,000+ views and at least 3x
           the channel's subscribers (can a new channel break in with this topic?)
  top      the 5 most viewed result titles (Korean titles from a second, Korean-language search)
Research 2026-11-14 (research-skill make-docent-book, packaging run): the same genre differed 100x by keyword
(세네카 median 1,682 vs 쇼펜하우어 198,213; 칸토어 24,702 vs 수학 역설 262,821).
Subscriber counts are cached in ~/.cache/2lab-explainer-titles/subs.json. Needs yt-dlp in the venv.
--strict needs --keyword and the network: one measured keyword must be in the title, pass the bar (median ≥ 100,000 or
≥ 8/30 small-channel hits) and be on topic (fewer than 3 of its top 5 look like music, ASMR or sleep sound).
Exit 0 unless --strict and a check fails (exit 1), or the search fails (exit 2)."""
import json, os, re, statistics, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

HOOK_MAX, TITLE_MAX = 30, 55
SEPARATORS = (' — ', ' – ', ' | ', ' - ', ': ', ' · ')
LABELS = [r'도슨트\s*북', r'도슨트', r'\(\s*\d+\s*분', r'\d+\s*분\s*(요약|정리|만에|짜리|오디오북|도슨트)', r'오디오북',
          r'^\s*\S+의\s*역사\s*$']
CACHE = os.path.expanduser('~/.cache/2lab-explainer-titles')

# what makes a hook: a question, a claim ending (~다, ~요, ~까), a situation (~라면, ~때, ~밤), a reason or a method
# ("~하는 법" at the end, 방법), or a number with a counter ("세 번", "3가지", "37배"). A bare number (1984) or a word
# that merely contains 법 (방법서설) is a name, not a hook.
HOOK = (r'[?？!]|왜|어떻게|무엇|라면|면\b|다\b|요\b|까\b|이유|방법(\s|$)|[는은] 법\s*$|때\b|때면|밤\b|날\b|순간'
        r'|\d+\s*(가지|개|권|배|명|년|일|분|시간|번|살|만|억|%|퍼센트|주)'
        r'|(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*(가지|개|권|배|명|번|살|주)')

def hook_of(title):
    """The part before the first separator (the whole title when there is none)."""
    cut = [title.find(s) for s in SEPARATORS if title.find(s) > 0]
    return title[:min(cut)] if cut else title

def lint(title, book=None, author=None):
    """Form problems as (code, message); an empty list passes."""
    out, t = [], title.strip()
    hook = hook_of(t).strip()
    if len(t) > TITLE_MAX: out.append(('long', f'{len(t)} characters (keep ≤ {TITLE_MAX}: search cuts the rest)'))
    if len(hook) > HOOK_MAX: out.append(('hook-long', f'hook "{hook}" is {len(hook)} characters (≤ {HOOK_MAX})'))
    seen = []
    for pat in LABELS:
        m = re.search(pat, t)
        if m and not any(a < m.end() and m.start() < b for a, b in seen):   # "도슨트북" matches two patterns: report it once
            seen.append(m.span())
            out.append(('label', f'format label "{m.group(0).strip()}": a running time or format is no reason to click'))
    for name, what in ((book, 'book title'), (author, 'author')):
        if name and hook.replace(' ', '').startswith(name.replace(' ', '')):
            out.append(('name-first', f'the {what} opens the title: put the viewer\'s question or problem first'))
    if not re.search(HOOK, hook):
        out.append(('no-hook', f'hook "{hook}" reads as a label: no question, claim, number or viewer situation'))
    return out

MUSIC = re.compile(r'노래|가사|뮤직|음악|플레이리스트|playlist|\bMV\b|M/V|ASMR|커버|cover|라이브|\blive\b|피아노|OST|노래방|백색소음|수면\s*음악', re.I)

def off_topic(d):
    """How many of the top 5 look like music, ASMR or sleep sound: the keyword's audience is not looking for a talk."""
    return sum(bool(MUSIC.search(t['title'] or '')) for t in d['top'])

def passes_bar(d):
    return d['median'] >= 100_000 or d['small'] >= 8

def ytdlp(*args):
    r = subprocess.run([sys.executable, '-m', 'yt_dlp', *args], capture_output=True, text=True, timeout=120)
    if r.returncode != 0 and not r.stdout.strip():
        raise RuntimeError(r.stderr.strip().splitlines()[-1] if r.stderr.strip() else 'yt-dlp failed')
    return json.loads(r.stdout)

def subs_of(cids):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, 'subs.json')
    cache = json.load(open(path)) if os.path.exists(path) else {}
    cache = {c: n for c, n in cache.items() if n is not None}   # a failure an older version cached is asked again
    need = [c for c in cids if c not in cache]
    def one(cid):
        try: return cid, ytdlp('--flat-playlist', '-J', '--playlist-items', '0', f'https://www.youtube.com/channel/{cid}').get('channel_follower_count')
        except Exception: return cid, None
    with ThreadPoolExecutor(8) as ex:
        got = dict(ex.map(one, need))
    cache.update({c: n for c, n in got.items() if n is not None})   # a failed lookup is asked again next run, never cached
    json.dump(cache, open(path, 'w'))
    return {**cache, **got}

def is_small_hit(views, subs):
    return bool(subs) and ((views >= 50_000 and subs < 50_000) or (views >= 100_000 and views >= 3 * subs))

def demand(keyword):
    res = ytdlp('--flat-playlist', '-J', f'ytsearch30:{keyword}')
    es = [e for e in res.get('entries', []) if e.get('view_count') is not None]
    try: ko = {e['id']: e.get('title') for e in ytdlp('--flat-playlist', '-J', '--extractor-args', 'youtube:lang=ko', f'ytsearch30:{keyword}').get('entries', [])}
    except Exception: ko = {}
    views = sorted((e['view_count'] for e in es), reverse=True)
    big = [e for e in es if e['view_count'] >= 30_000 and e.get('channel_id')]
    subs = subs_of(sorted({e['channel_id'] for e in big}))
    small = [e for e in big if is_small_hit(e['view_count'], subs.get(e['channel_id']))]
    top = sorted(es, key=lambda e: -e['view_count'])[:5]
    return {'keyword': keyword, 'n': len(views), 'median': int(statistics.median(views)) if views else 0,
            'n100k': sum(v >= 100_000 for v in views), 'small': len(small),
            'top': [{'views': e['view_count'], 'title': ko.get(e['id']) or e.get('title'), 'channel': e.get('channel')} for e in top]}

def main(argv):
    if not argv or argv[0].startswith('-'): sys.exit(__doc__)
    title, kws, book, author, out, net, strict = argv[0], [], None, None, None, True, False
    i = 1
    while i < len(argv):
        a = argv[i]
        if a == '--keyword': kws.append(argv[i + 1]); i += 2
        elif a == '--book': book = argv[i + 1]; i += 2
        elif a == '--author': author = argv[i + 1]; i += 2
        elif a == '--json': out = argv[i + 1]; i += 2
        elif a == '--no-net': net = False; i += 1
        elif a == '--strict': strict = True; i += 1
        else: sys.exit(f'unknown argument {a}')
    problems = lint(title, book, author)
    if strict and not (net and kws):   # the keyword is half the check: --strict without it would pass on form alone
        problems.append(('keyword', '--strict needs at least one --keyword and the network (no --no-net)'))
    print(f'title  {title}\nhook   {hook_of(title).strip()}  ({len(hook_of(title).strip())} chars, whole {len(title.strip())})')
    print('form   ' + ('ok' if not problems else '\n       '.join(f'{c}: {m}' for c, m in problems)))
    report = {'title': title, 'hook': hook_of(title).strip(), 'form': [{'code': c, 'message': m} for c, m in problems], 'demand': []}
    if net and kws:
        try:
            for kw in kws:
                d = demand(kw); report['demand'].append(d)
                d['in_title'] = kw.replace(' ', '') in title.replace(' ', ''); d['off_topic'] = off_topic(d); d['bar'] = passes_bar(d)
                print(f"\n「{kw}」 median {d['median']:,} · 100k+ {d['n100k']}/{d['n']} · small-channel hits {d['small']}/{d['n']}"
                      f" · {'in the title' if d['in_title'] else 'NOT in the title'}" + (' · passes the bar' if d['bar'] else ''))
                for t in d['top']: print(f"   {t['views']:>11,}  {t['title']}  ({t['channel']})")
                if d['off_topic'] >= 3: print(f"   WARNING: {d['off_topic']} of the top 5 look like music / ASMR / sleep sound — the people searching this want something else")
        except Exception as e:
            print(f'search failed: {e}'); sys.exit(2)
    if net and kws:   # --strict with keywords: one keyword that passes the bar, is on topic, and is in the title
        ok = [d for d in report['demand'] if d.get('in_title') and d.get('bar') and d.get('off_topic', 0) < 3]
        if not ok:
            problems.append(('keyword', 'no measured keyword is in the title, on topic and over the bar (median ≥ 100k or ≥ 8/30 small-channel hits)'))
            print('\nform   keyword: no measured keyword is in the title, on topic and over the bar')
    if out: json.dump(report, open(out, 'w'), ensure_ascii=False, indent=1)
    sys.exit(1 if strict and problems else 0)

if __name__ == '__main__':
    main(sys.argv[1:])
