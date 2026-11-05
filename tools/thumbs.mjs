// node thumbs.mjs list.txt  (lines: srcPath<TAB>dstPath) -> 900px-wide JPEG thumbnails
import { chromium } from 'playwright';
import fs from 'fs';
const pairs = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map(l => l.split('\t'));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 900 / 1366 });
for (const [src, dst] of pairs) {
  try { await p.goto('file://' + src, { timeout: 60000 }); await p.addStyleTag({ content: 'body{margin:0}img{display:block}' });
    await p.screenshot({ path: dst, type: 'jpeg', quality: 62, clip: { x: 0, y: 0, width: 1366, height: 900 } }); }
  catch (e) { console.error('thumb fail', src, e.message.slice(0, 60)); }
}
await b.close();
