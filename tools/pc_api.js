/* Runs on the server: calls app endpoints with the QA session of the redesign stand and prints compact JSON shapes.
 *   node tools/pc_api.js "me" "vprofile virtual=999906" "auth:crypto_packs"   (prefix auth: for auth.php)
 * Env VC_FULL=1 prints full JSON (truncated to VC_MAX chars, default 3000). */
const path = require('path');
const fs = require('fs');
const puppeteer = require('D:/server-projects/virtual.vibecods.xyz/_dev/qa_browser/node_modules/puppeteer-core');
const DEV = 'D:/server-projects/virtual.vibecods.xyz-redesign/_dev/redesign_20261014';
const BASE = process.env.VC_BASE || 'http://127.0.0.1:8098/';
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setCookie(...JSON.parse(fs.readFileSync(path.join(DEV, 'cookies.json'), 'utf8')));
  await page.goto(BASE + 'app/offline.html', { waitUntil: 'domcontentloaded' }).catch(() => {});
  const calls = process.argv.slice(2).map((s) => { const [a, ...kv] = s.split(' '); const o = {}; kv.forEach((x) => { const i = x.indexOf('='); o[x.slice(0, i)] = x.slice(i + 1); }); return [a, o]; });
  const out = await page.evaluate(async (calls, full, max) => {
    const shape = (v, d) => {
      if (v === null || typeof v !== 'object') return typeof v === 'string' ? JSON.stringify(v.slice(0, 40)) : String(v);
      if (Array.isArray(v)) return '[' + v.length + (v.length && d < 3 ? ' × ' + shape(v[0], d + 1) : '') + ']';
      if (d >= 3) return '{…}';
      return '{' + Object.keys(v).slice(0, 60).map((k) => k + ':' + shape(v[k], d + 1)).join(', ') + '}';
    };
    const tok = await (await fetch('/app/api.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'action=get_csrf_token', credentials: 'same-origin' })).json();
    const res = [];
    for (const [a, o] of calls) {
      const auth = a.startsWith('auth:'), action = auth ? a.slice(5) : a;
      const fd = new FormData(); fd.append('action', action); for (const k in o) fd.append(k, o[k]); if (tok.token) fd.append('_csrf', tok.token);
      const t = await (await fetch(auth ? '/app/auth.php' : '/app/api.php', { method: 'POST', body: fd, credentials: 'same-origin' })).text();
      let j; try { j = JSON.parse(t); } catch (e) { res.push('== ' + a + ' RAW ' + t.slice(0, 300)); continue; }
      res.push('== ' + a + ' ' + JSON.stringify(o) + '\n' + (full ? JSON.stringify(j).slice(0, max) : shape(j, 0)));
    }
    return res.join('\n');
  }, calls, !!process.env.VC_FULL, parseInt(process.env.VC_MAX || '3000', 10));
  console.log(out);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
