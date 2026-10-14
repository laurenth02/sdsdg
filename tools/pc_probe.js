/* Runs on the server: computed styles and the matched CSS rules (with their stylesheet) for elements of the redesign stand.
 *   node tools/pc_probe.js "<hash>" m|d "<selector>[;<selector>...]" "width,height,border-left" [index]
 * Prints, per selector: the element count, the computed values and every matched rule that sets one of the properties. */
const path = require('path');
const fs = require('fs');
const puppeteer = require('D:/server-projects/virtual.vibecods.xyz/_dev/qa_browser/node_modules/puppeteer-core');
const DEV = 'D:/server-projects/virtual.vibecods.xyz-redesign/_dev/redesign_20261014';
const BASE = process.env.VC_BASE || 'http://127.0.0.1:8098/app/';
const [hash, vp, sels, propsArg, idxArg] = process.argv.slice(2);
const props = (propsArg || 'display,width,height').split(',');
const idx = parseInt(idxArg || '0', 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  if (!process.env.VC_GUEST) await page.setCookie(...JSON.parse(fs.readFileSync(path.join(DEV, 'cookies.json'), 'utf8')));
  await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('vc_theme', t); } catch (e) {} }, process.env.VC_THEME || 'light');
  await page.setViewport(vp === 'm' ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1440, height: 900 });
  const client = await page.target().createCDPSession();
  const sheets = {};
  client.on('CSS.styleSheetAdded', (e) => { sheets[e.header.styleSheetId] = (e.header.sourceURL || 'inline').replace(/^.*\/app\//, '').replace(/\?.*$/, ''); });
  await page.goto(BASE + hash, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1800);
  if (process.env.VC_ACTION) { await page.evaluate(process.env.VC_ACTION); await sleep(900); }
  await client.send('DOM.enable');
  await client.send('CSS.enable');
  const { root } = await client.send('DOM.getDocument', { depth: -1 });
  for (const sel of sels.split(';')) {
    const { nodeIds } = await client.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: sel });
    console.log('== ' + sel + '  count=' + nodeIds.length);
    if (!nodeIds.length) continue;
    const nodeId = nodeIds[Math.min(idx, nodeIds.length - 1)];
    const { computedStyle } = await client.send('CSS.getComputedStyleForNode', { nodeId });
    console.log('computed: ' + props.map((p) => p + '=' + ((computedStyle.find((c) => c.name === p) || {}).value || '')).join('; '));
    const m = await client.send('CSS.getMatchedStylesForNode', { nodeId });
    for (const r of (m.matchedCSSRules || [])) {
      const hit = r.rule.style.cssProperties.filter((c) => props.some((p) => c.name === p || c.name.startsWith(p + '-')) && c.value);
      if (hit.length) console.log('  [' + (sheets[r.rule.styleSheetId] || r.rule.origin) + '] ' + r.rule.selectorList.text.slice(0, 150) + ' { ' + hit.map((c) => c.name + ':' + c.value + (c.important ? '!' : '')).join('; ').slice(0, 300) + ' }');
    }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
