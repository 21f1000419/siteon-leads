// usage: node shot.mjs outdir in.txt out.jsonl   (in.txt: one url per line). Resumable.
import { chromium } from 'playwright';
import fs from 'fs';
const [,, outdir, infile, outfile] = process.argv;
fs.mkdirSync(outdir, { recursive: true });
const done = new Set(fs.existsSync(outfile) ? fs.readFileSync(outfile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).url) : []);
const urls = fs.readFileSync(infile, 'utf8').split('\n').map(s => s.trim()).filter(u => u && !done.has(u));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, ignoreHTTPSErrors: true, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36' });
ctx.setDefaultTimeout(30000);
await ctx.route('**/*', route => {
  const r = route.request(), u = r.url();
  if (r.resourceType() === 'media' || /googletagmanager|google-analytics|doubleclick|facebook\.net|connect\.facebook|hotjar|clarity\.ms|youtube\.com\/embed|ytimg|maps\.googleapis|maps\.google|tawk\.to|crisp\.chat|zopim|livechat|recaptcha|googlesyndication/.test(u)) return route.abort();
  return route.continue();
});
const BADMAIL = /(sentry|wixpress|example|domain\.com|email\.com|godaddy|\.png|\.jpg|\.webp|\.gif|yourmail|youremail|grid\.net|@2x|\.svg|schema\.org|w3\.org|ingest)/;
async function extract(page) {
  return page.evaluate(() => {
    const html = document.documentElement.outerHTML, text = document.body?.innerText || '';
    const links = [...document.querySelectorAll('a[href]')].map(a => ({ h: a.href, raw: a.getAttribute('href'), t: (a.innerText || '').toLowerCase().trim() }));
    return { html: html.slice(0, 600000), text: text.slice(0, 30000), links };
  });
}
function contacts(d) {
  const all = d.html + ' ' + d.text;
  const emails = [...new Set([...(all.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,6}\b/g) || []), ...d.links.filter(l => l.raw?.startsWith('mailto:')).map(l => l.raw.slice(7).split('?')[0])].map(e => e.toLowerCase().trim()).filter(e => !BADMAIL.test(e) && e.length < 60))];
  const tel = d.links.filter(l => l.raw?.startsWith('tel:')).map(l => decodeURIComponent(l.raw.slice(4)));
  const txt = d.text.match(/(?:\+91[\s-]?|0)?[6-9]\d{2}[\s-]?\d{3}[\s-]?\d{4}\b|(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b|\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}/g) || [];
  const phones = [...new Set([...tel, ...txt].map(p => p.replace(/[^\d+]/g, '')).filter(p => p.replace('+', '').length >= 10 && p.replace('+', '').length <= 13))];
  const wa = d.links.find(l => /wa\.me|api\.whatsapp|whatsapp\.com\/send|web\.whatsapp/.test(l.h))?.h || '';
  const social = {};
  for (const [k, re] of [['instagram', /instagram\.com\/(?!p\/|reel|share)/], ['facebook', /facebook\.com\/(?!sharer|share|dialog|plugins|tr\?)/], ['linkedin', /linkedin\.com\/(company|in)\//], ['youtube', /youtube\.com\/(@|c\/|channel|user)/]]) {
    const l = d.links.find(x => re.test(x.h)); if (l) social[k] = l.h;
  }
  return { emails, phones, wa, social };
}
let i = 0;
async function worker() {
  while (i < urls.length) {
    const url = urls[i++];
    const host = new URL(url).hostname.replace(/^www\./, '');
    const page = await ctx.newPage(); const rec = { url, host }; const t0 = Date.now();
    const guard = setTimeout(() => { rec.error = rec.error || 'hard timeout'; page.close().catch(() => {}); }, 60000);
    try {
      const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      rec.status = r?.status(); await page.waitForTimeout(3000);
      rec.loadMs = Date.now() - t0; rec.finalUrl = page.url(); rec.title = (await page.title()).slice(0, 150);
      const d = await extract(page);
      const c = contacts(d);
      const h = d.html;
      const years = (d.text.match(/(?:©|copyright|&copy;)[^\n]{0,60}/gi) || []).join(' ').match(/20\d\d|19\d\d/g) || [];
      rec.sig = {
        viewport: /<meta[^>]+name=["']viewport/i.test(h), https: page.url().startsWith('https'),
        copyYear: years.length ? Math.max(...years.map(Number)) : null,
        oldTags: (h.match(/<(font|marquee|center|frameset|blink)\b/gi) || []).length,
        tables: (h.match(/<table\b/gi) || []).length,
        flash: /\.swf|shockwave/i.test(h),
        jquery: (h.match(/jquery[.-]?(\d\.\d+)/i) || [])[1] || '',
        gen: (h.match(/<meta name="generator" content="([^"]+)"/i) || [])[1] || (/wp-content/.test(h) ? 'WordPress' : /static\.wixstatic|wix\.com/.test(h) ? 'Wix' : /blogspot|blogger/.test(h) ? 'Blogger' : /weebly/.test(h) ? 'Weebly' : /sites\.google/.test(h) ? 'Google Sites' : /shopify/.test(h) ? 'Shopify' : /_next\/|__NEXT/.test(h) ? 'Next.js' : ''),
        words: d.text.split(/\s+/).length, imgs: (h.match(/<img\b/gi) || []).length,
      };
      rec.snippet = d.text.replace(/\s+/g, ' ').slice(0, 400);
      rec.address = (d.text.match(/[^\n]{0,80}\b(?:road|nagar|sector|colony|marg|street|chowk|near)\b[^\n]{0,80}\d{6}/i) || [])[0] || '';
      await page.screenshot({ path: `${outdir}/${host}.jpg`, type: 'jpeg', quality: 60, timeout: 15000 });
      // contact page if needed
      if (!c.emails.length || !c.phones.length) {
        const cl = d.links.find(l => /contact|reach|enquir/i.test(l.t + ' ' + l.raw) && l.h.startsWith('http') && new URL(l.h).hostname.replace(/^www\./, '') === new URL(page.url()).hostname.replace(/^www\./, ''));
        if (cl) { try { await page.goto(cl.h, { waitUntil: 'domcontentloaded', timeout: 20000 }); await page.waitForTimeout(1500);
          const c2 = contacts(await extract(page)); rec.contactPage = cl.h;
          c.emails = [...new Set([...c.emails, ...c2.emails])]; c.phones = [...new Set([...c.phones, ...c2.phones])]; c.wa ||= c2.wa; c.social = { ...c2.social, ...c.social };
          if (!rec.address) rec.address = ''; } catch {} }
      }
      Object.assign(rec, { emails: c.emails.slice(0, 4), phones: c.phones.slice(0, 4), whatsapp: c.wa, social: c.social });
    } catch (e) { rec.error = String(e.message).split('\n')[0].slice(0, 120); }
    clearTimeout(guard); await page.close().catch(() => {});
    if (!rec.emails && !rec.error) rec.error = 'incomplete';
    fs.appendFileSync(outfile, JSON.stringify(rec) + '\n');
  }
}
await Promise.all(Array.from({ length: 3 }, worker));
await browser.close();
