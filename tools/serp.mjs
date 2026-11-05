// usage: node serp.mjs queries.txt out.jsonl
import { chromium } from 'playwright';
import fs from 'fs';
const [,, qfile, out] = process.argv;
const done = new Set(fs.existsSync(out) ? fs.readFileSync(out, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).q) : []);
const queue = fs.readFileSync(qfile, 'utf8').split('\n').map(s => s.trim()).filter(s => s && !done.has(s));
const b = await chromium.launch();
const engines = {
  brave: q => `https://search.brave.com/search?q=${encodeURIComponent(q)}&source=web`,
  yahoo: q => `https://search.yahoo.com/search?p=${encodeURIComponent(q)}&n=30`,
};
const skip = /(brave\.com|yahoo\.|bing\.com|yimg|google\.|microsoft|duckduckgo)/;
async function worker(name) {
  const ctx = await b.newContext({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36', locale: 'en-IN' });
  const p = await ctx.newPage(); let fails = 0;
  while (queue.length) {
    const q = queue.shift();
    try {
      await p.goto(engines[name](q), { timeout: 25000 }); await p.waitForTimeout(1500);
      let res = await p.$$eval('a[href]', as => as.map(a => ({ h: a.href, t: (a.innerText || '').trim().slice(0, 120) })));
      res = res.map(r => { const m = r.h.match(/RU=([^/]+)\//); return { ...r, h: m ? decodeURIComponent(m[1]) : r.h }; })
               .filter(r => r.h.startsWith('http') && !skip.test(new URL(r.h).hostname));
      if (res.length < 3) { fails++; queue.push(q); process.stderr.write(`${name} BLOCK? ${q}\n`); await p.waitForTimeout(Math.min(30000 * fails, 180000)); continue; }
      fails = 0;
      fs.appendFileSync(out, res.map(r => JSON.stringify({ q, engine: name, url: r.h, title: r.t })).join('\n') + '\n');
      process.stderr.write(`${name} ${res.length} ${q}\n`);
    } catch (e) { process.stderr.write(`${name} ERR ${e.message.slice(0, 60)}\n`); queue.push(q); await p.waitForTimeout(20000); }
    await p.waitForTimeout(9000 + Math.random() * 6000);
  }
}
await Promise.all([worker('brave'), worker('yahoo')]);
await b.close();
