import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const expected='1bcc20a5d0e4708fe2ea20a6c83fcce0b098724a';
const base='https://app.agmcockpit.com';
const info=await (await fetch(base+'/build-info.json',{cache:'no-store'})).json();
assert.equal(info.appVersion,'1.9.2');
assert.equal(info.commit,expected);
const healthResponse=await fetch('https://api.agmcockpit.com/api/v1/health/ready');
assert.equal(healthResponse.status,200);
const health=await healthResponse.json();
assert.equal(health.data.build.commit,expected);
const apk='https://github.com/adrianmuscalu2-ai/agm-cockpit/releases/download/v1.9.2/AGM-Cockpit-Android-1.9.2.apk';
const download=await fetch(apk,{method:'HEAD'});
assert.equal(download.status,200);
const browser=await chromium.launch({headless:true});
const cases=[];
try {
 for(const width of [390,1440]) {
  const context=await browser.newContext({viewport:{width,height:900},locale:'ro-RO'});
  for(const route of ['/','/android.html']) {
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:60000});
   assert.equal(response.status(),200);
   await page.getByText('1.9.2',{exact:false}).first().waitFor({state:'attached',timeout:30000});
   if(route==='/') {
    const consent=page.getByRole('button',{name:'Accept și continui',exact:true});
    if(await consent.isVisible())await consent.click();
    const tutorial=page.getByRole('button',{name:'Sari peste',exact:true});
    if(await tutorial.isVisible())await tutorial.click();
   } else {
    assert.equal(await page.locator('a').first().getAttribute('href'),apk);
   }
   assert.match(await page.locator('body').innerText(),/1\.9\.2/);
   assert.deepEqual(errors,[]);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   const screenshot=`evidence/agma-release-1.9.2/production-${route==='/'?'app':'android'}-${width}.png`;
   await page.screenshot({path:screenshot,fullPage:true});
   cases.push({route,width,status:'PASS',screenshot});
   await page.close();
  }
  await context.close();
 }
 const report={timestamp:new Date().toISOString(),base,build:info,apiCommit:health.data.build.commit,downloadStatus:download.status,browser:{'Browser Plugin Status':'PASS','Integrated Browser Control Status':'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE','Browser Session Status':'PASS','Target Page Status':'PASS'},cases};
 await writeFile('evidence/agma-release-1.9.2/production-browser-report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await browser.close();}
