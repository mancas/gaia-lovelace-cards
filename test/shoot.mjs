import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : 'text/html' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const widths = process.argv[2] || '160,240,343,520';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--headless=new'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/test/harness.html?w=${widths}`);
await page.waitForFunction(() => window.__ready);
await page.waitForTimeout(800);
// detect horizontal overflow inside cards
const overflow = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.col').forEach((col) => {
    const card = col.querySelector('[class]') ?? col.children[1];
    const el = col.children[1];
    const sr = el.shadowRoot;
    if (!sr) return;
    const host = el.getBoundingClientRect();
    sr.querySelectorAll('*').forEach((n) => {
      const r = n.getBoundingClientRect();
      if (r.width && r.right > host.right + 1) out.push(`${col.querySelector('.label').textContent}: <${n.tagName.toLowerCase()} class="${n.className}"> overflows by ${Math.round(r.right - host.right)}px`);
    });
  });
  return out;
});
fs.mkdirSync('test/out', { recursive: true });
await page.screenshot({ path: `test/out/cards-${widths.replace(/,/g, '_')}.png`, fullPage: true });
console.log('errors:', errors);
console.log('overflow:', overflow.length ? overflow : 'none');
await browser.close();
server.close();
