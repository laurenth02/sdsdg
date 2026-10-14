/* Runs on the server: screenshots + checks of the redesign stand (127.0.0.1:8098, QA account from cookies.json).
 *   set VC_ROUTES=discover,chats & set VC_VP=m,d & set VC_THEMES=light,dark & node tools/pc_shots.js
 * Output: <VC_OUT or ..\shots>\<route>-<m|d>[-dark].png and one PASS/FAIL line per check. */
const path = require('path');
const fs = require('fs');
const puppeteer = require('D:/server-projects/virtual.vibecods.xyz/_dev/qa_browser/node_modules/puppeteer-core');
const DEV = 'D:/server-projects/virtual.vibecods.xyz-redesign/_dev/redesign_20261014';
const BASE = process.env.VC_BASE || 'http://127.0.0.1:8098/app/';
const OUT = path.resolve(process.env.VC_OUT || path.join(__dirname, '..', '..', 'shots'));
const PID = process.env.VC_PID || '999865';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// name -> [hash, action run in the page after load (optional)]
const ALL = {
  discover: ['#/'], likes: ['#/likes'], chats: ['#/chats'], chat: ['#/chat/' + PID], 'profile-detail': ['#/profile/' + PID],
  me: ['#/profile'], store: ['#/store'], activity: ['#/activity'], settings: ['#/settings'], support: ['#/support'],
  filters: ['#/', "(document.querySelector('[data-act=filters],.v4-filter-btn,#vc-discover-filters,button[aria-label*=\"ильтр\"]')||{click(){}}).click()"],
  'chat-typing': ['#/chat/' + PID, "(function(){var t=document.querySelector('#vc-chat-input,textarea');if(t){t.focus();t.value='Привет!';t.dispatchEvent(new Event('input',{bubbles:true}));}})()"],
};
const routes = (process.env.VC_ROUTES || 'discover,likes,chats,chat,profile-detail,me,store,activity,settings,support').split(',');
const vps = (process.env.VC_VP || 'm,d').split(',');
const themes = (process.env.VC_THEMES || 'light').split(',');
const VP = { m: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }, d: { width: 1440, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }, w: { width: 1366, height: 768, isMobile: false, hasTouch: false, deviceScaleFactor: 1 } };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const res = [];
  const check = (label, ok, extra) => res.push((ok ? 'PASS ' : 'FAIL ') + label + (extra ? ' — ' + extra : ''));
  for (const theme of themes) {
    for (const v of vps) {
      const page = await browser.newPage();
      if (!process.env.VC_GUEST) await page.setCookie(...JSON.parse(fs.readFileSync(path.join(DEV, 'cookies.json'), 'utf8')));
      await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('vc_theme', t); localStorage.setItem('vc_coach_seen', '1'); } catch (e) {} }, theme);
      const errors = [];
      page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)); });
      await page.setViewport(VP[v]);
      for (const name of routes) {
        const [hash, action] = ALL[name] || ['#/' + name];
        const before = errors.length;
        await page.goto(BASE + hash, { waitUntil: 'networkidle2', timeout: 60000 }).catch((e) => errors.push('goto: ' + e.message));
        await sleep(1500);
        if (action) { await page.evaluate(action).catch((e) => errors.push('action: ' + e.message)); await sleep(900); }
        const info = await page.evaluate(() => {
          const app = document.getElementById('app'), body = document.getElementById('vc-main-body');
          return { v4: !!app && app.classList.contains('v4'), font: getComputedStyle(document.body).fontFamily,
            docOverflow: document.documentElement.scrollWidth > window.innerWidth + 1, bodyOverflow: !!body && body.scrollWidth > body.clientWidth + 1,
            route: location.hash, theme: document.documentElement.getAttribute('data-theme') };
        });
        const file = `${name}-${v}${theme === 'dark' ? '-dark' : ''}.png`;
        await page.screenshot({ path: path.join(OUT, file) });
        const tag = `${theme}/${v}/${name}`;
        check(tag + ' no horizontal overflow', !info.docOverflow && !info.bodyOverflow);
        check(tag + ' Onest + theme', /Onest/.test(info.font) && info.theme === theme, info.theme);
        check(tag + ' no JS errors', errors.length === before, errors.slice(before).join(' | ').slice(0, 300));
      }
      await page.close();
    }
  }
  await browser.close();
  res.filter((r) => r.startsWith('FAIL')).forEach((r) => console.log(r));
  const failed = res.filter((r) => r.startsWith('FAIL')).length;
  console.log(`RESULT ${res.length - failed}/${res.length} checks passed; shots in ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
