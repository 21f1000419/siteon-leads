import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36', locale:'en-IN' });
const q = encodeURIComponent('abacus academy Lucknow');
for (const u of [`https://search.brave.com/search?q=${q}`, `https://duckduckgo.com/?q=${q}&kl=in-en`, `https://www.startpage.com/do/search?q=${q}`, `https://www.ecosia.org/search?q=${q}`, `https://www.google.com/search?q=${q}&num=20`, `https://yandex.com/search/?text=${q}`, `https://www.qwant.com/?q=${q}`]) {
 try { await p.goto(u, {timeout:20000}); await p.waitForTimeout(3000);
 const hosts = [...new Set(await p.$$eval('a[href^="http"]', as => as.map(a => { try { return new URL(a.href).hostname } catch { return '' } })))];
 console.log(u.split('/')[2], hosts.length, hosts.slice(0,15).join(' ')); } catch(e) { console.log(u.split('/')[2], 'ERR', e.message.slice(0,60)); }
}
await b.close();
