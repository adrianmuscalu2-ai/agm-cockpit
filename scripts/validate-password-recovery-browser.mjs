import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { mkdir,writeFile } from 'node:fs/promises';

const root=process.cwd(),runId=new Date().toISOString().replace(/[:.]/g,'-');
const output=path.join(root,'evidence/password-recovery/browser',runId);
const report={runId,scope:'LOCAL_RECOVERY_UI_WITH_CONTROLLED_API_FIXTURES',productionPass:false,browserPluginStatus:'PASS',integratedBrowserControlStatus:'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',browserSessionStatus:'PENDING',targetPageStatus:'PENDING',results:[]};
let server,browser;
try {
  await mkdir(output,{recursive:true});
  const port=await new Promise(resolve=>{const socket=net.createServer();socket.listen(0,'127.0.0.1',()=>{const port=socket.address().port;socket.close(()=>resolve(port));});});
  const target=`http://127.0.0.1:${port}`;
  server=spawn(process.execPath,[path.join(root,'apps/web/node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:path.join(root,'apps/web'),windowsHide:true,stdio:'ignore'});
  let available=false;
  for(let i=0;i<80;i++){try{if((await fetch(target,{signal:AbortSignal.timeout(1000)})).status===200){available=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,150));}
  assert.ok(available,'LOCAL_PREVIEW_NOT_READY');
  browser=await chromium.launch({headless:true});report.browserSessionStatus='PASS';
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const page=await context.newPage();
  const requests=[];
  await context.route('**/api/v1/**',async route=>{
    const request=route.request();
    if(request.url().includes('/auth/password-recovery/')){
      requests.push({url:request.url(),body:request.postDataJSON()});
      return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({data:request.url().endsWith('/request')?{accepted:true}:{passwordChanged:true,signInRequired:true}})});
    }
    return route.fulfill({status:401,contentType:'application/json',body:'{}'});
  });
  await page.goto(`${target}/access?recover=1`,{waitUntil:'domcontentloaded'});
  // Consent is exercised only on this local test fixture, never on a real user session.
  await page.getByRole('button',{name:'Accept și continui',exact:true}).click();
  const requestForm=page.locator('[data-recovery-request]');
  await requestForm.waitFor({state:'visible'});
  await requestForm.locator('input[name="email"]').fill('fixture@example.invalid');
  await requestForm.locator('button[type="submit"]').click();
  await page.getByText('Dacă există un cont activ pentru această adresă,',{exact:false}).waitFor();
  assert.equal(requests.length,1);assert.equal(requests[0].body.email,'fixture@example.invalid');
  report.results.push({scenario:'request-and-generic-confirmation',verdict:'PASS'});
  await page.screenshot({path:path.join(output,'request.png'),fullPage:true});
  const token='t'.repeat(43);
  await page.goto(`${target}/access#password-reset=${token}`,{waitUntil:'domcontentloaded'});
  const confirm=page.locator('[data-recovery-confirm]');await confirm.waitFor({state:'visible'});
  assert.equal(new URL(page.url()).hash,'');
  assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('t'.repeat(43))),false);
  await confirm.locator('input[name="password"]').fill('test-password-only');
  await confirm.locator('input[name="repeat"]').fill('different-test-password');
  await confirm.locator('button[type="submit"]').click();
  await page.getByText('Parolele nu coincid.',{exact:true}).waitFor();assert.equal(requests.length,1);
  await confirm.locator('input[name="repeat"]').fill('test-password-only');
  await confirm.locator('button[type="submit"]').click();
  await page.getByText('Parola a fost schimbată.',{exact:false}).waitFor();
  assert.equal(requests[1].body.token,token);assert.equal(await page.locator('[data-access-login]').isVisible(),true);
  report.results.push({scenario:'fragment-redaction-password-confirmation-and-sign-in',verdict:'PASS'});
  await page.screenshot({path:path.join(output,'confirmed.png'),fullPage:true});
  // Fresh browser: consent triggers a re-render before entering the new password.
  await context.clearCookies();await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.goto(`${target}/access#password-reset=${token}`,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Accept și continui',exact:true}).click();
  await confirm.waitFor({state:'visible'});
  await confirm.locator('input[name="password"]').fill('test-password-only');await confirm.locator('input[name="repeat"]').fill('test-password-only');
  await confirm.locator('button[type="submit"]').click();
  await page.getByText('Parola a fost schimbată.',{exact:false}).waitFor();assert.equal(requests[2].body.token,token);
  report.results.push({scenario:'ownership-token-survives-consent-rerender-in-memory',verdict:'PASS'});
  report.targetPageStatus='PASS';report.verdict='PASS';report.target=target;
} catch(error){report.verdict='FAIL';report.targetPageStatus='FAIL';report.error=error.message;process.exitCode=1;}
finally {
  await browser?.close();server?.kill();
  await mkdir(output,{recursive:true});await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
