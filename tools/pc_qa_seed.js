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
    const log = [];
    const put = (k, v) => log.push(k + ': ' + JSON.stringify(v).slice(0, 260));
    const me0 = await apiRequest('me');
    put('me', { ok: me0.ok, name: me0.me && me0.me.name, balance: me0.me && me0.me.balance, chats: me0.me && (me0.me.chat_slots || me0.me.chats_left), virtuals: (me0.virtuals || []).length });
    put('ack_hint', await apiRequest('ack_hint'));
    put('tos_check', await apiRequest('tos_check'));
    put('tos_accept', await apiRequest('tos_accept'));
    state.tosAccepted = true;
    const packs = (state.storePacks || []).map((p) => ({ id: p.pack_id, chats: p.chats, price: p.price_eur || p.price }));
    put('packs', packs);
    const big = packs.slice().sort((a, b) => (b.chats | 0) - (a.chats | 0))[0];
    if (big) put('buy pack ' + big.id, await authApi('test_checkout', { pack_id: big.id, amount_eur: 0, profile_id: 0, intent_id: 'seed-p-' + Date.now() }));
    put('topup 30', await authApi('test_checkout', { pack_id: 0, amount_eur: 30, profile_id: 0, intent_id: 'seed-t-' + Date.now() }));
    const ids = (me0.virtuals || []).map((v) => v.id);
    put('virtual ids', ids.slice(0, 14));
    for (const id of ids.slice(0, 4)) put('profile_like ' + id, await apiRequest('profile_like', { virtual: id }));
    const texts = ['Привет! Как проходит день?', 'Привет 🙂 Чем занимаешься вечером?', 'Видел твою анкету — любишь путешествовать?', 'Добрый вечер! Какую музыку слушаешь?', 'Привет! Что посоветуешь посмотреть?'];
    for (let i = 0; i < texts.length && ids[i + 4]; i++) {
      put('send ' + ids[i + 4], await apiRequest('send', { virtual: ids[i + 4], text: texts[i], self_destruct_sec: 0, request_id: 'seed-' + i + '-' + Date.now() }));
    }
    const me1 = await apiRequest('me');
    put('after', { balance: me1.me && me1.me.balance, keys: Object.keys(me1.me || {}).filter((k) => /chat|slot|pack|balance|like/.test(k)).map((k) => k + '=' + JSON.stringify(me1.me[k]).slice(0, 40)) });
    return log;
  });
  console.log(out.join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
