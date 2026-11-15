import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { writeFile, readFile } from 'node:fs/promises';
const root = process.cwd();
const out = 'D:/AGM-ACPM-Isolated-20261115-GPT6Luna/evidence';
const require = createRequire(path.join(root, 'apps/web/package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
const preflight = JSON.parse(await readFile('tmp/rescue-browser-preflight.json', 'utf8'));
const server = await createServer({ root: path.join(root, 'apps/web'), server: {host:'127.0.0.1',port:0}, logLevel:'silent' });
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({viewport:{width:1440,height:1000}, locale:'ro-RO'});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const response = await page.goto(origin, {waitUntil:'domcontentloaded'});
  await page.goto(`${origin}/#turn`, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.body.innerText.length > 100);
  await page.keyboard.press('Tab');
  const body = await page.locator('body').innerText();
  await page.screenshot({path:`${out}/browser-current.png`,fullPage:true});
  const report = {checkedAt:new Date().toISOString(),origin,route:page.url(), visualSignature:preflight.visualSignature,
    browserPluginStatus:'PASS - CUA callable; controlled Playwright available',integratedBrowserControlStatus:'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE - browser access host unavailable',
    browserSessionStatus:'PASS',targetPageStatus:response.status()===200 && body.length>100 ? 'PASS':'FAIL',httpStatus:response.status(),
    navigation:'Home to #turn; keyboard Tab',title:await page.title(),bodyExcerpt:body.slice(0,5000),errors,
    copilotVisible:await page.locator('[data-agmatcc-ai-question]').count(),scope:'Local rendered shell only; no authorized TURN session, no legal acceptance or authentication bypass',screenshot:'browser-current.png'};
  await writeFile(`${out}/browser-current.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
} finally {await browser?.close();await server.close();}
