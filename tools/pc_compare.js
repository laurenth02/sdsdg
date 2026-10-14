/* Runs on the server: the prototype and the redesign stand side by side, one PNG per screen and viewport.
 *   set VC_PAIRS=discover,chat & set VC_VP=m,d & node tools/pc_compare.js
 * Output: <VC_OUT or ..\cmp>\<name>-<m|d>.png — phone: prototype | stand; desktop: prototype above the stand. */
const path = require('path');
const fs = require('fs');
const puppeteer = require('D:/server-projects/virtual.vibecods.xyz/_dev/qa_browser/node_modules/puppeteer-core');
const DEV = 'D:/server-projects/virtual.vibecods.xyz-redesign/_dev/redesign_20261014';
const PROTO = 'file:///D:/server-projects/virtual.vibecods.xyz/deliverables/site-prototype-20261014/app.html';
const BASE = process.env.VC_BASE || 'http://127.0.0.1:8098/';
const OUT = path.resolve(process.env.VC_OUT || path.join(__dirname, '..', '..', 'cmp'));
const PID = process.env.VC_PID || '999906';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (sel) => `(function(){var e=document.querySelector(${JSON.stringify(sel)});if(e)e.click();return !!e;})()`;
// name: [prototype hash, stand hash, stand action, guest]
const PAIRS = {
  discover: ['#/', '#/'],
  profile: ['#/profile/999906', '#/profile/' + PID],
  likes: ['#/likes', '#/likes'],
  chats: ['#/chats', '#/chats'],
  chat: ['#/chat/c1', '#/chat/' + PID],
  notifications: ['#/notifications', '#/activity'],
  me: ['#/me', '#/profile'],
  'me-edit': ['#/me/edit', '#/profile', click('#vc-prof-edit')],
  store: ['#/store', '#/store'],
  purchases: ['#/purchases', '#/purchases'],
  settings: ['#/settings', '#/settings'],
  'settings-notifications': ['#/settings/notifications', '#/settings/notifications'],
  'settings-appearance': ['#/settings/appearance', '#/settings/appearance'],
  'settings-account': ['#/settings/account', '#/settings/account'],
  support: ['#/support', '#/support'],
  'support-new': ['#/support/new', '#/support/new'],
  welcome: ['#/welcome', '#/onboarding', '', true],
  signup: ['#/signup', '#/', "(function(){var b=document.querySelector('[data-act=like],.act.like,#vc-like');if(b)b.click();})()", true],
  login: ['#/login', '#/auth', '', true],
  'guest-discover': ['#/?guest=1', '#/', '', true],
};
const names = (process.env.VC_PAIRS || Object.keys(PAIRS).join(',')).split(',');
const vps = (process.env.VC_VP || 'm').split(',');
const VP = { m: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }, d: { width: 1440, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 } };

async function shot(browser, url, vp, action, cookies, theme) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  if (cookies) await page.setCookie(...cookies);
  await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('vc_theme', t); localStorage.setItem('vc_coach_seen', '1'); } catch (e) {} }, theme);
  await page.setViewport(VP[vp]);
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }).catch((e) => errs.push('goto ' + e.message));
  await sleep(1600);
  if (action) { await page.evaluate(action).catch((e) => errs.push('action ' + e.message)); await sleep(1100); }
  const buf = await page.screenshot({ type: 'png' });
  await ctx.close();
  return { b64: buf.toString('base64'), errs };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const cookies = JSON.parse(fs.readFileSync(path.join(DEV, 'cookies.json'), 'utf8'));
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'] });
  const theme = process.env.VC_THEME || 'light';
  for (const name of names) {
    const [ph, ah, action, guest] = PAIRS[name];
    for (const vp of vps) {
      const p = await shot(browser, PROTO + (theme === 'dark' ? '?theme=dark' : '') + ph, vp, '', null, theme);
      const a = await shot(browser, BASE + ah, vp, action, guest ? null : cookies, theme);
      const page = await browser.newPage();
      const W = VP[vp].width, H = VP[vp].height, side = vp === 'm';
      await page.setViewport({ width: side ? W * 2 + 12 : W, height: side ? H + 26 : H * 2 + 52 });
      const lab = (t) => `<div style="font:700 14px Arial;padding:5px 8px;background:#222;color:#fff">${t}</div>`;
      await page.setContent(`<body style="margin:0;background:#888;display:flex;${side ? 'gap:12px' : 'flex-direction:column'}">` +
        `<div>${lab('PROTOTYPE ' + ph)}<img style="display:block" src="data:image/png;base64,${p.b64}"></div>` +
        `<div>${lab('SITE ' + ah + (a.errs.length ? ' — ERR ' + a.errs.join(' | ') : ''))}<img style="display:block" src="data:image/png;base64,${a.b64}"></div></body>`);
      await page.screenshot({ path: path.join(OUT, `${name}-${vp}${theme === 'dark' ? '-dark' : ''}.png`) });
      await page.close();
      console.log(name, vp, a.errs.length ? 'ERR ' + a.errs.join(' | ') : 'ok');
    }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
