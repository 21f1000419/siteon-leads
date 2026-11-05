// node sheets.mjs scraped.jsonl shotsdir outdir  -> 2x2 labelled grids + index.json
import { chromium } from 'playwright';
import fs from 'fs';
const [,, inf, shots, out] = process.argv;
fs.mkdirSync(out, { recursive: true });
const recs = fs.readFileSync(inf, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  .filter(r => !r.error && r.status < 400 && fs.existsSync(`${shots}/${r.host}.jpg`) && fs.statSync(`${shots}/${r.host}.jpg`).size > 5000);
const seen = new Set(); const items = [];
for (const f of fs.readdirSync('../data').filter(f => /^ratings_.*\.jsonl$/.test(f) || f === 'queued.txt'))
  for (const l of fs.readFileSync('../data/' + f, 'utf8').split('\n')) { const m = l.match(/"host"\s*:\s*"([^"]+)"/) || (f === 'queued.txt' && [0, l.trim()]); if (m && m[1]) seen.add(m[1]); }
for (const r of recs) { if (seen.has(r.host)) continue; seen.add(r.host); items.push(r); }
const b = await chromium.launch(); let p = await b.newPage({ viewport: { width: 1400, height: 960 } });
const index = []; let sheetNo = 0;
for (let s = 0; s * 4 < items.length; s++) {
  const grp = items.slice(s * 4, s * 4 + 4);
  const html = `<body style="margin:0;background:#222;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:4px;font:bold 18px sans-serif">${grp.map(r => `<div style="position:relative"><img src="data:image/jpeg;base64,${fs.readFileSync(`${shots}/${r.host}.jpg`).toString('base64')}" style="width:100%;display:block"><div style="position:absolute;top:0;left:0;background:#ff0;color:#000;padding:2px 8px">${r.host}</div></div>`).join('')}</body>`;
  try { await p.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 }); } catch (e) { console.error('skip sheet', grp.map(r => r.host).join(',')); grp.length = 0; await p.close(); p = await b.newPage({ viewport: { width: 1400, height: 960 } }); continue; }
  await p.evaluate(() => Promise.race([Promise.all([...document.images].map(i => i.decode().catch(() => {}))), new Promise(r => setTimeout(r, 8000))]));
  const f = `${out}/sheet_${String(++sheetNo).padStart(3, '0')}.jpg`;
  await p.screenshot({ path: f, type: 'jpeg', quality: 70, fullPage: true, timeout: 120000 });
  index.push({ sheet: f, hosts: grp.map(r => r.host) });
}
fs.writeFileSync(`${out}/index.json`, JSON.stringify(index, null, 1));
fs.appendFileSync('../data/queued.txt', index.flatMap(x => x.hosts).join('\n') + '\n');
fs.writeFileSync(`${out}/context.tsv`, 'host\ttitle\tplatform\tmobile_viewport\tcopyright_year\tsnippet\n' + items.map(r => [r.host, r.title, r.sig?.gen || '', r.sig?.viewport, r.sig?.copyYear || '', (r.snippet || '').slice(0, 220)].join('\t').replace(/\r/g, '')).join('\n'));
console.log(index.flatMap(x => x.hosts).length, 'sites,', index.length, 'sheets');
await b.close();
