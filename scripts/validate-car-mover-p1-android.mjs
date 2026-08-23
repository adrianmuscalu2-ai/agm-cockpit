import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const root=process.cwd(),runId=new Date().toISOString().replace(/[:.]/g,'-');
const out=path.join(root,'evidence','car-mover','p1-operations','android',runId);
const runFile=promisify(execFile);
const adb=path.join(process.env.LOCALAPPDATA??'','Android','Sdk','platform-tools','adb.exe');
const captureOnly=process.env.CAR_MOVER_CAPTURE_ONLY==='1';
const externalCheck=process.env.CAR_MOVER_VALIDATE_GMAIL==='1';
const results=[],diagnostics=[];let browser,fatal;
await mkdir(out,{recursive:true});

async function forward(){const {stdout}=await runFile(adb,['shell','pidof','com.agm.cockpit']);const pid=stdout.trim().split(/\s+/)[0];if(!pid)throw Error('ANDROID_PROCESS_NOT_RUNNING');await runFile(adb,['forward','tcp:9222',`localabstract:webview_devtools_remote_${pid}`]);}

try{
  await runFile(adb,['shell','am','force-stop','com.agm.cockpit']);
  await runFile(adb,['shell','monkey','-p','com.agm.cockpit','-c','android.intent.category.LAUNCHER','1']);
  await new Promise(resolve=>setTimeout(resolve,2500));
  await forward();
  browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page=browser.contexts().flatMap(context=>context.pages()).find(item=>!item.url().includes('sw.js'));
  if(!page)throw Error('ANDROID_PAGE_UNAVAILABLE');
  page.on('requestfailed',request=>diagnostics.push({type:'requestfailed',url:request.url(),failure:request.failure()}));
  page.on('console',message=>diagnostics.push({type:'console',level:message.type(),text:message.text()}));
  if(new URL(page.url()).origin!=='https://localhost')throw Error(`ANDROID_ORIGIN_MISMATCH:${page.url()}`);
  const runtime=await page.evaluate(async({runId,captureOnly,externalCheck})=>{
    const api='https://api.agmcockpit.com/api/v1';
    const fetchRetry=async(url,init)=>{let failure;for(let attempt=0;attempt<5;attempt++){try{return await fetch(url,init);}catch(error){failure=error;await new Promise(resolve=>setTimeout(resolve,1000));}}throw failure;};
    let token=sessionStorage.getItem('agm.auth.accessToken');
    if(!token){const response=await fetchRetry(`${api}/auth/refresh`,{method:'POST',credentials:'include'});const body=await response.json().catch(()=>({}));token=response.ok?body.data?.accessToken:'';if(token)sessionStorage.setItem('agm.auth.accessToken',token);}
    if(!token)throw Error('AUTH_SESSION_NOT_RESTORED');
    const call=async(route,init={})=>{const response=await fetchRetry(`${api}${route}`,{...init,headers:{authorization:`Bearer ${token}`,'content-type':'application/json',...(init.headers||{})}});const body=await response.json().catch(()=>({}));if(!response.ok)throw Error(`${route}:${body.message??response.status}`);return body.data;};
    const jobs=await call('/car-mover/jobs');
    if(!jobs.length)throw Error('NO_EXISTING_CAR_MOVER_JOB');
    const job=jobs[0],occurredAt=new Date().toISOString(),reference=`p1-android-${runId}`;
    if(!captureOnly){
      await call(`/car-mover/jobs/${job.id}/finance`,{method:'POST',body:JSON.stringify({entryType:'REVENUE',category:'transport-test',amount:'100.00',currencyCode:'EUR',occurredAt,description:'P1 Android Production verification',sourceReference:reference})});
      await call(`/car-mover/jobs/${job.id}/finance`,{method:'POST',body:JSON.stringify({entryType:'COST',category:'fuel-test',amount:'25.00',currencyCode:'EUR',occurredAt,description:'P1 Android Production verification',sourceReference:reference})});
      await call(`/car-mover/jobs/${job.id}/invoices`,{method:'POST',body:JSON.stringify({direction:'ISSUED',invoiceNumber:`P1-${runId}`.slice(0,120),counterparty:'AGM Production Verification',issueDate:occurredAt,amount:'100.00',currencyCode:'EUR',evidenceReference:reference})});
    }
    const file=await call(`/car-mover/jobs/${job.id}`);
    const providers=await call('/communications/providers/status');
    const externalReference=`AGM-${runId}`.replace(/[^A-Z0-9-]/gi,'').slice(0,36);
    if(externalCheck){
      await call('/communications/messages',{method:'POST',body:JSON.stringify({message:{contractVersion:'communication-message.v1',clientMessageId:crypto.randomUUID(),channel:'email',to:'agm.transporte.logistik@gmail.com',subject:`ONLOGIST order ${externalReference} from Berlin to Hamburg`,bodyText:`Vehicle: VW Golf offer 480 EUR 292 km. Reference: ${externalReference}`}})});
    }
    let gmailSync={scanned:0,ingested:0,duplicates:0},extraction={scanned:0,created:0,duplicates:0},offers=[];
    for(let attempt=0;attempt<(externalCheck?6:1);attempt++){
      if(attempt)await new Promise(resolve=>setTimeout(resolve,2500));
      gmailSync=await call('/communications/sync/email',{method:'POST'});
      extraction=await call('/car-mover/jobs/platform-offers/analyze',{method:'POST'});
      offers=await call('/car-mover/jobs/platform-offers/list');
      if(!externalCheck||offers.some(item=>item.externalReference===externalReference))break;
    }
    const externalOfferFound=!externalCheck||offers.some(item=>item.externalReference===externalReference);
    return{jobId:job.id,analysis:file.analysis,financeRecorded:captureOnly||file.financialEntries.some(item=>item.sourceReference===reference),invoiceRecorded:captureOnly||file.invoices.some(item=>item.evidenceReference===reference),providers,gmailSync,extraction,offerCount:offers.length,offerReferences:offers.slice(0,20).map(item=>({platformName:item.platformName,externalReference:item.externalReference,status:item.status,score:item.score})),captureOnly,externalCheck,externalReference,externalOfferFound};
  },{runId,captureOnly,externalCheck});
  if(!runtime.financeRecorded||!runtime.invoiceRecorded)throw Error('P1_RECORDS_NOT_PERSISTED');
  if(externalCheck&&!runtime.externalOfferFound)throw Error('GMAIL_PLATFORM_OFFER_NOT_INGESTED');
  await page.evaluate(()=>{history.pushState({},'','/car-mover');dispatchEvent(new PopStateEvent('popstate'));});
  await page.waitForSelector('[data-car-mover-root]');
  await page.waitForSelector('[data-car-mover-provider-status]');
  await page.locator('[data-job]').first().click();
  await page.waitForSelector('dialog[open]');
  const text=await page.locator('[data-car-mover-file]').innerText();
  for(const expected of ['Analiza cursei','Contabilitate primară','Facturi','Gmail / WhatsApp'])if(!text.includes(expected))throw Error(`UI_SECTION_MISSING:${expected}`);
  const screenshot=path.join(out,'android-car-mover-p1-operations.png');
  const jobFileScreenshot=path.join(out,'android-car-mover-job-file.png');
  const captures={};
  try{await page.screenshot({path:screenshot,fullPage:true});captures.screenshot=path.relative(root,screenshot);}catch(error){diagnostics.push({type:'optional-full-page-screenshot',detail:String(error)});}
  try{await page.locator('dialog[open] .car-mover-analysis').scrollIntoViewIfNeeded();await page.waitForTimeout(300);await page.screenshot({path:jobFileScreenshot});captures.jobFileScreenshot=path.relative(root,jobFileScreenshot);}catch(error){diagnostics.push({type:'optional-job-file-screenshot',detail:String(error)});}
  results.push({id:'car-mover-p1-production-android',status:'PASS',origin:new URL(page.url()).origin,route:'/car-mover',...runtime,...captures});
}catch(error){fatal=String(error);results.push({id:'car-mover-p1-production-android',status:'FAIL',detail:fatal});}
finally{await browser?.close();const report={schemaVersion:1,runId,status:fatal?'FAIL':'PASS',revision:'53b0f6b7896dc180cce23b72f2ac72e9414222c7',runner:'Android WebView + controlled CDP',browserPluginStatus:'PASS',integratedBrowserControlStatus:'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',browserSessionStatus:fatal?'FAIL':'PASS',targetPageStatus:fatal?'FAIL':'PASS',results,diagnostics,finishedAt:new Date().toISOString()};await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(`CAR MOVER P1 ANDROID: ${report.status}`);console.log(path.join(out,'report.json'));if(fatal)process.exitCode=1;}
