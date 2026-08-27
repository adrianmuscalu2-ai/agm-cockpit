import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const [mode='P9_OFF', run='1', requestRoundsArg='15', base='http://127.0.0.1:3100/api/v1', output='controlled-probe.json'] = process.argv.slice(2);
const requestRounds=Number(requestRoundsArg), officialSloMs=3000, diagnosticTimeoutMs=10000;
const targets=[
  {id:'health-live',url:`${base}/health`,init:{method:'GET'},expected:[200],layer:'HTTP_NO_DB'},
  {id:'health-ready-db',url:`${base}/health/ready`,init:{method:'GET'},expected:[200],layer:'HTTP_DB_READINESS'},
  {id:'login-invalid',url:`${base}/auth/login`,init:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'controlled-reproduction.invalid@example.invalid',password:'invalid'})},expected:[400,401,429],layer:'HTTP_DB_LOOKUP'},
  {id:'entitlement-unauthenticated',url:`${base}/auth/entitlements`,init:{method:'GET'},expected:[401,429],layer:'HTTP_AUTH_GUARD'},
];
const loop=monitorEventLoopDelay({resolution:10});loop.enable();const clientRuntime=[];let prior=performance.now();
const timer=setInterval(()=>{const now=performance.now();clientRuntime.push({at:new Date().toISOString(),driftMs:Math.max(0,now-prior-50)});prior=now;},50);
const request=async(target,kind,timeoutMs,parentCorrelationId=null)=>{const correlationId=`cr-${mode.toLowerCase()}-${run}-${randomUUID()}`,startedAt=new Date().toISOString(),started=performance.now(),cpuBefore=process.cpuUsage();let status=0,error=null,responseAt=null;try{const response=await fetch(target.url,{...target.init,headers:{...(target.init.headers??{}),'x-correlation-id':correlationId,'x-agm-probe-kind':kind},signal:AbortSignal.timeout(timeoutMs)});status=response.status;await response.arrayBuffer();responseAt=new Date().toISOString();}catch(value){error=value instanceof Error?value.name:'UNKNOWN';}const cpu=process.cpuUsage(cpuBefore),latencyMs=Math.round((performance.now()-started)*100)/100;return{correlationId,parentCorrelationId,mode,run:Number(run),kind,target:target.id,layer:target.layer,startedAt,responseAt,completedAt:new Date().toISOString(),latencyMs,status,error,expected:target.expected,officialSloPass:target.expected.includes(status)&&latencyMs<=officialSloMs,clientCpuMicros:cpu.user+cpu.system};};
const samples=[];
for(let round=1;round<=requestRounds;round++)for(const target of targets){const sample=await request(target,'OFFICIAL',officialSloMs);sample.round=round;samples.push(sample);if(sample.error==='TimeoutError'||sample.latencyMs>officialSloMs){const diagnostic=await request(target,'DIAGNOSTIC_AFTER_FAILURE',diagnosticTimeoutMs,sample.correlationId);diagnostic.round=round;samples.push(diagnostic);}}
clearInterval(timer);loop.disable();const official=samples.filter(x=>x.kind==='OFFICIAL'),sorted=official.map(x=>x.latencyMs).sort((a,b)=>a-b),pct=p=>sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)],failures=official.filter(x=>!x.officialSloPass);
const report={contract:'agm-basic-controlled-reproduction-client.v1',generatedAt:new Date().toISOString(),mode,run:Number(run),requestRounds,officialSlo:{maxLatencyMs:officialSloMs,unchanged:true},diagnosticTimeoutMs,samples,summary:{requests:official.length,passed:official.length-failures.length,availabilityPercent:(official.length-failures.length)/official.length*100,p50Ms:pct(.5),p95Ms:pct(.95),p99Ms:pct(.99),maxMs:sorted.at(-1),failures:failures.length,timeouts:failures.filter(x=>x.error==='TimeoutError').length},clientEventLoopDelayMs:{mean:loop.mean/1e6,p95:loop.percentile(95)/1e6,p99:loop.percentile(99)/1e6,max:loop.max/1e6},clientRuntime};
await mkdir(output.replace(/[\\/][^\\/]+$/,''),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(`${mode} run=${run} requests=${report.summary.requests} failures=${report.summary.failures} p95=${report.summary.p95Ms} max=${report.summary.maxMs}`);
