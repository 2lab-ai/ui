"""Upload files to the session's Slack thread via files.getUploadURLExternal + completeUploadExternal."""
import json, os, sys, urllib.request, urllib.parse
TOKEN = os.environ['SLACK_BOT_TOKEN']
CHANNEL, THREAD = sys.argv[1], sys.argv[2]
comment = sys.argv[3]
paths = sys.argv[4:]

def api(method, data):
    req = urllib.request.Request(f'https://slack.com/api/{method}', data=urllib.parse.urlencode(data).encode(),
                                 headers={'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/x-www-form-urlencoded'})
    r = json.load(urllib.request.urlopen(req, timeout=120))
    if not r.get('ok'): sys.exit(f'{method} failed: {r}')
    return r

files = []
for p in paths:
    title = None
    if '::' in p: p, title = p.split('::', 1)
    size = os.path.getsize(p)
    r = api('files.getUploadURLExternal', {'filename': os.path.basename(p), 'length': size})
    with open(p, 'rb') as f:
        req = urllib.request.Request(r['upload_url'], data=f.read(), method='POST', headers={'Content-Type': 'application/octet-stream'})
        resp = urllib.request.urlopen(req, timeout=600); assert resp.status == 200, resp.status
    files.append({'id': r['file_id'], 'title': title or os.path.basename(p)})
    print('uploaded', p, size)
r = api('files.completeUploadExternal', {'files': json.dumps(files), 'channel_id': CHANNEL, 'thread_ts': THREAD, 'initial_comment': comment})
print(json.dumps([{'id': f['id'], 'permalink': f.get('permalink')} for f in r['files']], ensure_ascii=False))
