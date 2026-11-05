import json, csv, glob, re, sys
from urllib.parse import urlparse
BLOCK = re.compile(r"(justdial|sulekha|urbanpro|superprof|teacheron|myprivatetutor|indiamart|shiksha|quora|facebook|instagram|youtube|linkedin|magicpin|threebestrated|5bestincity|yellowpages|webindia123|clickindia|grotal|academyfind|idbf\.in|lyfskills|starofmysore|mysurulive|mysuru\.directory|infoisinfo|starofservice|bdir\.in|tripadvisor|indiaonline|trendingnearme|hackerone|brave\.app|interlochen|wikipedia|gov\.in|nic\.in|ac\.in|edu\.in|collegedunia|careers360|vedantu|byjus|unacademy|physicswallah|pw\.live|toppr|cuemath|planetspark|allen\.|fiitjee|aakash|narayana|resonance|meritnation|extramarks|ucmas|sipabacus|aloha|sharpabacus|brainobrain|whitehatjr|brightchamps|codingal|campk12|britishcouncil|idp\.com|leverageedu|yocket|niit|aptech|jetking|simplilearn|upgrad|greatlearning|eurokids|kidzee|podar|orchids|vibgyor|ryan|google\.|bing\.|yahoo|amazon|flipkart|reddit|medium\.com|blogspot\.com/20|jagranjosh|ndtv|timesofindia|hindustantimes|thehindu|indianexpress|news|magazine|twitter|x\.com|pinterest|wa\.me|whatsapp|apple\.com|play\.google|schoolmykids|edustoke|yellowslate|skoodos|uniformapp|homeshiksha|gharpeshiksha|ziyyara|the-tuition|tutorbureau|mapquest|zaubacorp|tofler|crunchbase|glassdoor|naukri|indeed|ambitionbox|apps\.apple|threads\.net|wikimedia|archive\.org|github\.com|stackoverflow|coursera|udemy|teachmint|classplus|edmingle\.com$)", re.I)
def norm(u):
    u = u.strip()
    if not u.startswith('http'): u = 'https://' + u
    p = urlparse(u); h = (p.hostname or '').lower()
    return h, h.removeprefix('www.')
rows = {}
for f in sorted(glob.glob('agent_*.tsv')):
    for r in csv.DictReader(open(f), delimiter='\t'):
        if not r.get('url'): continue
        h, key = norm(r['url'])
        if not h or BLOCK.search(h): continue
        # keep subpaths for shared hosts
        if re.search(r"(weebly|wixsite|blogspot|sites\.google|business\.site|wordpress\.com|github\.io|vercel\.app|netlify|pages\.dev)", h):
            key = h + urlparse(r['url']).path.rstrip('/')
            url = r['url']
        else:
            url = f"https://{h}/"
        rows.setdefault(key, {'url': url, 'name': r.get('name','').strip(), 'category': r.get('category','').strip(), 'city': r.get('city','').strip(), 'country': (r.get('country') or 'India').strip(), 'src': f})
# serp results: host-level
CAT = [('abacus|vedic', 'Abacus & Vedic Maths'), ('ielts|pte', 'IELTS/PTE Coaching'), ('spoken english', 'Spoken English'), ('computer', 'Computer Training'), ('olympiad', 'Olympiad'), ('play school', 'Preschool'), ('music', 'Music Academy'), ('CA coaching', 'Commerce/CA Coaching'), ('bank|ssc', 'Govt Exam Coaching'), ('jee|neet|foundation', 'JEE/NEET Coaching'), ('home tuition|home tutor', 'Home Tuition Bureau'), ('online', 'Online Tuition'), ('tuition|coaching', 'School Tuition Centre')]
try:
    for l in open('serp.jsonl'):
        d = json.loads(l); h, key = norm(d['url'])
        if not h or BLOCK.search(h) or key in rows: continue
        if re.search(r"(weebly|wixsite|blogspot|sites\.google|wordpress\.com)", h): continue
        q = d['q'].split(' -')[0]
        cat = next((c for pat, c in CAT if re.search(pat, q, re.I)), 'Education')
        words = q.split(); city = words[-1]
        rows[key] = {'url': f"https://{h}/", 'name': '', 'category': cat, 'city': city, 'country': 'India', 'src': 'serp'}
except FileNotFoundError: pass
json.dump(list(rows.values()), open('candidates.json', 'w'), indent=0)
open('candidates.txt', 'w').write('\n'.join(r['url'] for r in rows.values()))
from collections import Counter
print(len(rows), Counter(r['src'] for r in rows.values()))
