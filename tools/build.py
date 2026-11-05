# Combine candidates + scraped + ratings -> docs/data/<list>.json (+ .csv) and thumbnails
import json, glob, re, os, subprocess, csv, io
from urllib.parse import urlparse
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, *p)
LIST_ID, MAXSCORE = 'edtech-small-2026-11', 4
cands = {}
for c in json.load(open(D('data/candidates.json'))):
    cands[(urlparse(c['url']).hostname or '').removeprefix('www.')] = c
scraped = {}
for l in open(D('data/scraped.jsonl')):
    r = json.loads(l)
    if not r.get('error'): scraped[r['host']] = r
ratings = {}
for f in sorted(glob.glob(D('data/ratings_*.jsonl'))):
    for l in open(f):
        l = l.strip()
        if l.startswith('{'):
            try: r = json.loads(l); ratings[r['host'].removeprefix('www.')] = r
            except Exception: pass
OV = json.load(open(D('data/overrides.json'))) if os.path.exists(D('data/overrides.json')) else {}
GENERIC = re.compile(r'^(best|top|no\.?\s?1|#1|home|welcome|online|learn|join|get|music school|school|index)\b', re.I)
def clean_name(r, c):
    if OV.get(r['host'], {}).get('name'): return OV[r['host']]['name']
    n = (c or {}).get('name') or ''
    if not n or GENERIC.match(n):
        segs = [x.strip() for x in re.split(r'\s[|\-–:»]\s|\s\|\s?', r.get('title') or '') if x.strip()]
        good = [x for x in segs if not GENERIC.match(x) and 2 < len(x) < 45]
        if good: n = min(good, key=len) if len(good) > 1 and len(good[0]) > 40 else good[0]
    if not n:
        t = re.split(r'\s[|\-–:»]\s', r.get('title') or '')[0].strip()
        n = t if 2 < len(t) < 60 else r['host']
    return n
def fmt_phone(p):
    d = re.sub(r'\D', '', p)
    if len(d) == 10 and d[0] in '6789': return '+91 ' + d[:5] + ' ' + d[5:]
    if len(d) == 12 and d.startswith('91') and d[2] in '6789': return '+91 ' + d[2:7] + ' ' + d[7:]
    if len(d) == 11 and d.startswith('0'): return '+91 ' + d[1:]  # landline with STD code
    if p.startswith('+') and not d.startswith('91') and 10 <= len(d) <= 13: return '+' + d  # foreign number
    return None
EMAIL = re.compile(r'^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,6}$')
def clean_email(e):
    e = re.sub(r'^(?:%20|\+?\d{10,13})', '', (e or '').strip().lower())
    return e if EMAIL.match(e) and not re.search(r'(wordpress|wix|sentry|@sample|@test|noreply|no-reply|@support\.com|@domain|@mysite|@site\.com|@company\.com|xyz@|abc@|^mail@mail\.com|^email@email|^info@example|^name@|^user@|^your)', e) else None
def platform(g):
    g = g or ''
    if re.search(r'wordpress|seo|site kit|elementor|wpbakery|woocommerce|slider revolution|powered by visual composer|divi|astra|yoast|rank math|litespeed|wp rocket', g, re.I): return 'WordPress'
    for k in ['Wix', 'Weebly', 'Blogger', 'Google Sites', 'Shopify', 'Next.js', 'Joomla', 'Drupal', 'Squarespace', 'Webflow', 'Framer', 'Hostinger', 'GoDaddy', 'Zoho', 'Odoo']:
        if k.lower() in g.lower(): return k
    return g[:20]
os.makedirs(D('docs/shots'), exist_ok=True)
leads = []; need_thumbs = []
for host, rt in ratings.items():
    r = scraped.get(host)
    if host in OV and OV[host].get('drop'): continue
    if not r or not rt.get('keep') or not (2 <= int(rt.get('score', 10)) <= MAXSCORE): continue
    c = cands.get(host) or next((v for k, v in cands.items() if host.endswith(k) or k.startswith(host)), {})
    phones, seen = [], set()
    for p in r.get('phones', []):
        f = fmt_phone(p)
        if not f: continue
        k = re.sub(r'\D', '', f)[-10:]
        if k not in seen: seen.add(k); phones.append(f)
    emails = list(dict.fromkeys(x for x in (clean_email(e) for e in r.get('emails', [])) if x))
    wa = r.get('whatsapp', '')
    if not (emails or phones or wa): continue  # must be contactable
    thumb = f'shots/{host}.jpg'
    if not os.path.exists(D('docs', thumb)): need_thumbs.append(D('shots', host + '.jpg') + '\t' + D('docs', thumb))
    sig = r.get('sig', {})
    leads.append({
        'score': int(rt['score']), 'name': clean_name(r, c), 'website': r.get('finalUrl') or r['url'],
        'category': c.get('category') or rt.get('category') or 'Education', 'city': c.get('city') or '', 'state': '', 'country': c.get('country') or 'India',
        'emails': emails[:3], 'phones': phones[:3], 'whatsapp': wa,
        'instagram': r.get('social', {}).get('instagram', ''), 'facebook': r.get('social', {}).get('facebook', ''), 'linkedin': r.get('social', {}).get('linkedin', ''),
        'platform': platform(sig.get('gen', '')),
        'issues': rt.get('issues', ''), 'pitch': rt.get('pitch', ''), 'screenshot': thumb, 'status': 'New',
        'notes': '; '.join(x for x in [
            'no mobile viewport' if sig.get('viewport') is False else '', 'no HTTPS' if sig.get('https') is False else '',
            f"copyright {sig['copyYear']}" if sig.get('copyYear') and sig['copyYear'] < 2024 else '',
            f"slow load {r['loadMs']//1000}s" if r.get('loadMs', 0) > 9000 else ''] if x),
    })
if need_thumbs:
    open('/tmp/thumbs.txt', 'w').write('\n'.join(need_thumbs)); subprocess.run(['node', 'thumbs.mjs', '/tmp/thumbs.txt'], cwd=D('tools'), check=True)
# merge leads that share a phone/email (same owner, several sites)
parent = list(range(len(leads)))
def find(i):
    while parent[i] != i: parent[i] = parent[parent[i]]; i = parent[i]
    return i
owner = {}
for i, l in enumerate(leads):
    for k in l['phones'] + l['emails']:
        if k in owner: parent[find(i)] = find(owner[k])
        else: owner[k] = i
groups = {}
for i in range(len(leads)): groups.setdefault(find(i), []).append(leads[i])
merged = []
for g in groups.values():
    g.sort(key=lambda x: x['score']); m = g[0]
    for o in g[1:]:
        m['emails'] = list(dict.fromkeys(m['emails'] + o['emails']))[:3]; m['phones'] = list(dict.fromkeys(m['phones'] + o['phones']))[:3]
        m['notes'] = '; '.join(x for x in [m['notes'], 'Also runs ' + o['website'] + f" ({o['score']}/10) — multi-site owner, good SiteOn fit"] if x)
    merged.append(m)
leads = merged
leads.sort(key=lambda x: (x['score'], x['category'], x['name']))
json.dump(leads, open(D('docs/data', LIST_ID + '.json'), 'w'), indent=1, ensure_ascii=False)
lists_f = D('docs/data/lists.json')
lists = json.load(open(lists_f)) if os.path.exists(lists_f) else []
meta = {'id': LIST_ID, 'title': f'EdTech & Education SMBs · Nov 2026 ({len(leads)})', 'file': LIST_ID + '.json', 'created': '2026-11-05',
        'description': 'Small education businesses similar to Gyanity Learning, with dated websites (design score 2–4/10)'}
lists = [meta] + [l for l in lists if l['id'] != LIST_ID]
json.dump(lists, open(lists_f, 'w'), indent=1)
# shot cleanup: remove thumbs not referenced by any list
print(len(leads), 'leads;', sum(1 for l in leads if l['emails']), 'with email;', sum(1 for l in leads if l['phones']), 'with phone')
from collections import Counter; print(Counter(l['score'] for l in leads)); print(Counter(l['category'] for l in leads).most_common())
