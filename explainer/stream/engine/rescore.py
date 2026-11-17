"""re-score an existing review packet with one engine, optionally with a different note or without some images.
usage: python rescore.py <build dir> <model> <runs> <tag> [--note file] [--drop substr,substr]"""
import base64, json, os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
B, MODEL, RUNS, TAG = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
args = sys.argv[5:]
OUT = os.path.join(B, 'review')
meta = json.load(open(os.path.join(OUT, 'content.json')))
prompt = open(os.path.join(OUT, 'prompt.txt')).read()
if '--note' in args:
    new = open(args[args.index('--note') + 1]).read()
    assert meta['note'] in prompt
    prompt = prompt.replace(meta['note'], new)
drop = args[args.index('--drop') + 1].split(',') if '--drop' in args else []
C = []
for cap, p in meta['imgs']:
    if any(d in cap for d in drop): continue
    C.append({'type': 'text', 'text': f'[이미지] {cap}'})
    C.append({'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': base64.b64encode(open(p, 'rb').read()).decode()}})
C.append({'type': 'text', 'text': prompt})
def call(k):
    body = {'model': MODEL, 'max_tokens': 4000, 'messages': [{'role': 'user', 'content': C}]}
    for att in range(3):
        try:
            req = urllib.request.Request(os.environ['ANTHROPIC_BASE_URL'] + '/v1/messages', data=json.dumps(body).encode(), headers={'content-type': 'application/json', 'x-api-key': os.environ['ANTHROPIC_API_KEY'], 'anthropic-version': '2023-06-01'})
            r = json.load(urllib.request.urlopen(req, timeout=600))
            txt = ''.join(x.get('text', '') for x in r.get('content', []))
            return k, json.loads(txt[txt.find('{'): txt.rfind('}') + 1]), txt
        except Exception as e:
            print('attempt', att, e, flush=True)
    return k, None, ''
with ThreadPoolExecutor(RUNS) as ex:
    for k, j, txt in ex.map(call, range(RUNS)):
        open(os.path.join(OUT, f'{MODEL}{TAG}_{k}.txt'), 'w').write(txt)
        print(TAG, k, j and j['total'], j and j['scores'], j and j.get('verdict', '')[:80], flush=True)
