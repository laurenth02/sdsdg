/* Runs on the server: fills the QA account of the redesign stand (DB vibecheckdb_aitest, test payment provider) with data
 * the screens need — a chat pack and wallet balance through test_checkout, likes, several opened chats.
 *   node tools/pc_qa_seed.js           (uses _dev/redesign_20261014/cookies.json of the redesign worktree) */
const path = require('path');
const fs = require('fs');
const puppeteer = require('D:/server-projects/virtual.vibecods.xyz/_dev/qa_browser/node_modules/puppeteer-core');
const DEV = 'D:/server-projects/virtual.vibecods.xyz-redesign/_dev/redesign_20261014';
const BASE = process.env.VC_BASE || 'http://127.0.0.1:8098/app/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setCookie(...JSON.parse(fs.readFileSync(path.join(DEV, 'cookies.json'), 'utf8')));
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + '#/store', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2500);
  const out = await page.evaluate(async () => {
    // app.js runs inside a closure: call the endpoints directly, with the CSRF token the app would add.
    const log = [];
    const put = (k, v) => log.push(k + ': ' + JSON.stringify(v).slice(0, 300));
    const tok = await (await fetch('/app/api.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'action=get_csrf_token', credentials: 'same-origin' })).json();
    const call = async (url, action, extra) => {
      const fd = new FormData();
      fd.append('action', action);
      for (const k in (extra || {})) fd.append(k, extra[k]);
      if (tok && tok.token) fd.append('_csrf', tok.token);
      const t = await (await fetch(url, { method: 'POST', body: fd, credentials: 'same-origin' })).text();
      try { return JSON.parse(t); } catch (e) { return { raw: t.slice(0, 200) }; }
    };
    const api = (a, x) => call('/app/api.php', a, x), auth = (a, x) => call('/app/auth.php', a, x);
    const me0 = await api('me');
    put('me', { ok: me0.ok, err: me0.err, virtuals: (me0.virtuals || []).length, me: Object.keys(me0.me || me0.user || {}).slice(0, 30) });
    put('ack_hint', await api('ack_hint'));
    put('tos_check', await api('tos_check'));
    put('tos_accept', await api('tos_accept'));
    const cp = await auth('crypto_packs');
    put('crypto_packs keys', Object.keys(cp || {}));
    put('crypto_packs', JSON.stringify(cp).slice(0, 700));
    const arr = (x) => (Array.isArray(x) ? x : x && typeof x === 'object' ? Object.values(x) : []);
    const list = arr(cp.packs).concat(arr(cp.catalog && (cp.catalog.packs || cp.catalog.chat_packs))).filter((p) => p && typeof p === 'object' && (p.pack_id || p.id));
    put('packs', list.map((p) => ({ id: p.pack_id || p.id, chats: p.chats, eur: p.price_eur || p.amount_eur || p.price })));
    const big = list.slice().sort((a, b) => (b.chats | 0) - (a.chats | 0))[0];
    if (big) put('buy pack', await auth('test_checkout', { pack_id: big.pack_id || big.id, amount_eur: 0, profile_id: 0, intent_id: 'seed-p-' + Date.now() }));
    put('topup 30', await auth('test_checkout', { pack_id: 0, amount_eur: 30, profile_id: 0, intent_id: 'seed-t-' + Date.now() }));
    const ids = (me0.virtuals || []).map((v) => v.id);
    put('virtual ids', ids.slice(0, 14));
    for (const id of ids.slice(0, 4)) put('profile_like ' + id, await api('profile_like', { virtual: id }));
    const texts = ['Привет! Как проходит день?', 'Привет 🙂 Чем занимаешься вечером?', 'Видел твою анкету — любишь путешествовать?', 'Добрый вечер! Какую музыку слушаешь?', 'Привет! Что посоветуешь посмотреть?'];
    for (let i = 0; i < texts.length && ids[i + 4]; i++) put('send ' + ids[i + 4], await api('send', { virtual: ids[i + 4], text: texts[i], self_destruct_sec: 0, request_id: 'seed-' + i + '-' + Date.now() }));
    const me1 = await api('me');
    const m = me1.me || me1.user || {};
    put('after', Object.keys(m).filter((k) => /chat|slot|pack|balance|like/.test(k)).map((k) => k + '=' + JSON.stringify(m[k]).slice(0, 40)));
    return log;
  });
  console.log(out.join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
