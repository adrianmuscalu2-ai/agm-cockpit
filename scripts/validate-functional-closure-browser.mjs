import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
const req=createRequire(resolve('apps/web/package.json'));
const {createServer}=await import(pathToFileURL(req.resolve('vite')).href);
const out=process.env.FUNCTIONAL_EVIDENCE_DIR;
const server=await createServer({configFile:resolve('apps/web/vite.config.mjs'),root:resolve('apps/web'),optimizeDeps:{force:true},server:{host:'127.0.0.1',port:Number(process.env.REHEARSAL_WEB_PORT),strictPort:true},logLevel:'error'});
const report={at:new Date().toISOString(),scope:'REHEARSAL_REAL_HTTP_NO_PROVIDER_CALL',verdict:'FAIL',browserPluginStatus:'PASS',integratedBrowserControlStatus:'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',browserSessionStatus:'PENDING',targetPageStatus:'PENDING',responses:[],providerRequests:0};
let browser,page;
try {
 await server.listen();const port=server.httpServer.address().port;assert.ok(![5173,5174].includes(port));
 const base=`http://127.0.0.1:${port}`;report.target=base;
 browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1440,height:1000},locale:'ro-RO'});
 report.browserSessionStatus='PASS';
 await page.route('**/*',route=>{
  if(route.request().url().includes('/agmatcc-copilot/respond')){report.providerRequests++;return route.abort();}
  return ['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort();
 });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(`${base}/access`,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
 const consent=page.locator('#acceptLegalNotice');await consent.waitFor();await consent.click();await consent.waitFor({state:'hidden'});
 for(const selector of ['#closeTutorial','#skipTutorial','#closeContextualHints']) if(await page.locator(selector).isVisible())await page.locator(selector).click();
 await page.locator('form[data-access-login] [name=email]').fill(process.env.AGM_REHEARSAL_OWNER_EMAIL);
 await page.locator('form[data-access-login] [name=password]').fill(process.env.AGM_REHEARSAL_OWNER_PASSWORD);
 const [login]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/auth/login')),page.locator('form[data-access-login] button[type=submit]').click()]);
 assert.ok(login.ok());report.responses.push({route:'auth/login',status:login.status()});
 await page.goto(`${base}/#turn`,{waitUntil:'domcontentloaded'});
 await page.locator('#adminPin').waitFor();
 if(await page.locator('#closeTutorial').isVisible())await page.locator('#closeTutorial').click();
 await page.locator('#adminPin').fill(process.env.AGM_REHEARSAL_TURN_PIN);
 const [unlock]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/turn-admin/unlock')),page.locator('#adminLoginForm button[type=submit]').click()]);
 assert.ok(unlock.ok());report.responses.push({route:'turn-admin/unlock',status:unlock.status()});
 const [acpm]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/acpm')),page.locator('[data-acpm-refresh]').click()]);
 assert.equal(acpm.status(),200);report.responses.push({route:'acpm',status:200});
 await page.locator('[data-acpm-status]').filter({hasText:'Citire reușită'}).waitFor();
 await page.locator('[data-agmatcc-ai-question]').fill('Verificare control fără apel plătit.');
 const [control]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/agmatcc-copilot/control-status')),page.locator('[data-agmatcc-ai-send]').click()]);
 assert.equal(control.status(),200);report.responses.push({route:'agmatcc-copilot/control-status',status:200});
 await page.locator('[data-agmatcc-ai-answer]').filter({hasText:'Nu s-a solicitat un răspuns plătit'}).waitFor();
 assert.equal(report.providerRequests,0);assert.deepEqual(errors,[]);
 await page.screenshot({path:join(out,'authenticated-local-control.png'),fullPage:true});
 report.targetPageStatus='PASS';report.verdict='PASS';
} catch(e) {report.error=e.message;process.exitCode=1;if(page)await page.screenshot({path:join(out,'browser-failure.png'),fullPage:true}).catch(()=>{});}
finally {writeFileSync(join(out,'authenticated-browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser?.close();await server.close();}
