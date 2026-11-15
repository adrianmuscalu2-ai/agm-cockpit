import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const req=createRequire(resolve('apps/web/package.json'));
const {createServer}=await import(pathToFileURL(req.resolve('vite')).href);
const dir='D:/AGM-ACPM-Isolated-20261115-GPT6Luna/evidence';
const id=process.env.REHEARSAL_RUN_ID;
const report={realHttp:true,turn:'BLOCKED',owner:'BLOCKED',conversation:'BLOCKED',steps:[]};
const server=await createServer({configFile:resolve('apps/web/vite.config.mjs'),root:resolve('apps/web'),optimizeDeps:{force:true},server:{host:'127.0.0.1',port:Number(process.env.REHEARSAL_WEB_PORT),strictPort:true},logLevel:'error'});
let browser,page;
try {
 await server.listen();
 browser=await chromium.launch({headless:true});
 page=await browser.newPage({viewport:{width:1440,height:1000},locale:'ro-RO'});
 const base=`http://127.0.0.1:${process.env.REHEARSAL_WEB_PORT}`;
 await page.goto(`${base}/legal`);
 report.legalText=(await page.locator('body').innerText());
 await page.screenshot({path:`${dir}/legal-${id}.png`,fullPage:true});
 await page.goto(`${base}/access`);
 const consent=page.locator('#acceptLegalNotice');
 await consent.waitFor({state:'visible'});await consent.click();
 await consent.waitFor({state:'hidden'});
 for(const selector of ['#closeTutorial','#skipTutorial','#closeContextualHints'])if(await page.locator(selector).isVisible())await page.locator(selector).click();
 await page.locator('form[data-access-login] [name=email]').fill(process.env.AGM_REHEARSAL_OWNER_EMAIL);
 await page.locator('form[data-access-login] [name=password]').fill(process.env.AGM_REHEARSAL_OWNER_PASSWORD);
 const [lr]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/auth/login')),page.locator('form[data-access-login] button[type=submit]').click()]);
 assert.ok(lr.ok());report.steps.push('OWNER login authenticated');
 await page.goto(`${base}/#turn`);
 await page.locator('#adminPin').waitFor({state:'visible'});
 if(await page.locator('#closeTutorial').isVisible())await page.locator('#closeTutorial').click();
 await page.locator('#adminPin').fill(process.env.AGM_REHEARSAL_TURN_PIN);
 const [unlock]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/turn-admin/unlock')),page.locator('#adminLoginForm button[type=submit]').click()]);
 assert.ok(unlock.ok());report.turn='PASS';
 if(process.env.REHEARSAL_REUSE_EVIDENCE) {
   const prior=JSON.parse(readFileSync(process.env.REHEARSAL_REUSE_EVIDENCE,'utf8'));
   assert.equal(prior.conversation,'PASS');report.copilot=prior.copilot;report.conversation='REUSED_PASS';report.reusedEvidence=process.env.REHEARSAL_REUSE_EVIDENCE;
 } else {
 await page.locator('[data-agmatcc-draft]').fill('Notă exclusiv rehearsal PR35: transportul demonstrativ are status PREGĂTIT. Nu reprezintă o operațiune Production.');
 const [sync]=await Promise.all([page.waitForResponse(r=>r.url().includes('/operational-events/sync')),page.locator('[data-agmatcc-confirm]').click()]);
 assert.ok(sync.ok());report.steps.push('test note persisted through TURN');
 const [journal]=await Promise.all([page.waitForResponse(r=>r.url().includes('/operational-events/')&&r.request().method()==='GET'),page.locator('[data-agmatcc-read-remote]').click()]);
 assert.ok(journal.ok());report.journal=await journal.json();report.steps.push('TURN journal authorized HTTP 200');
 await page.locator('[data-agmatcc-ai-question]').fill('Citește jurnalul operațional pentru PR35. Ce status are transportul demonstrativ? Răspunde în română și citează dovada.');
 const [rr]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/agmatcc-copilot/respond'),{timeout:90000}),page.locator('[data-agmatcc-ai-send]').click()]);
 report.copilot=await rr.json();assert.ok(rr.ok());
 const answer=report.copilot.data??report.copilot;
 assert.equal(answer.provider,'openai');assert.equal(answer.model,'gpt-6-luna');assert.equal(answer.status,'PASS');assert.ok(answer.evidenceRefs.length);
 report.conversation='PASS';
 }
 const answer=report.copilot.data??report.copilot;
 const [ar]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/acpm')),page.locator('[data-acpm-refresh]').click()]);
 report.acpm=await ar.json();assert.ok(ar.ok());assert.ok(JSON.stringify(report.acpm).includes(answer.executionId));report.owner='PASS';
 await page.locator('[data-acpm-status]').filter({hasText:'Citire reușită'}).waitFor();
 assert.ok(await page.locator('[data-acpm-content] tbody tr').count()>=2);
 assert.ok((await page.locator('[data-acpm-content]').innerText()).includes('agmatcc.gpt-6-luna'));
 report.ownerUi='PASS';
 await page.screenshot({path:`${dir}/authenticated-${id}.png`,fullPage:true});
} catch(e){report.error=e.message;process.exitCode=1;if(page)await page.screenshot({path:`${dir}/failure-${id}.png`,fullPage:true}).catch(()=>{});}
finally {writeFileSync(`${dir}/authenticated-browser-${id}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({turn:report.turn,owner:report.owner,conversation:report.conversation,error:report.error}));await browser?.close();await server.close();}
