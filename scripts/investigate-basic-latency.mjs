import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';

const base = 'http://127.0.0.1:3000/api/v1';
const rounds = Number(process.argv[2] ?? 60);
const targets = [
  { id: 'health', url: `${base}/health`, init: { method: 'GET' } },
  { id: 'login-invalid', url: `${base}/auth/login`, init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'p9-root-cause.invalid@example.invalid', password: 'invalid' }) } },
  { id: 'entitlement-unauthenticated', url: `${base}/auth/entitlements`, init: { method: 'GET' } },
];
const delay = monitorEventLoopDelay({ resolution: 10 }); delay.enable();
const samples = [];
for (let round = 1; round <= rounds; round += 1) for (const target of targets) {
  const startedAt = new Date().toISOString(); const started = performance.now(); let status = 0; let error = null;
  try { const response = await fetch(target.url, { ...target.init, signal: AbortSignal.timeout(10_000) }); status = response.status; await response.arrayBuffer(); }
  catch (value) { error = value instanceof Error ? value.name : 'UNKNOWN'; }
  samples.push({ target: target.id, round, startedAt, latencyMs: Math.round((performance.now() - started) * 100) / 100, status, error });
}
delay.disable();
const sorted = samples.map(x => x.latencyMs).sort((a,b)=>a-b), pct=p=>sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)];
const report={contract:'agm-p9-basic-latency-diagnostic.v1',generatedAt:new Date().toISOString(),rounds,samples,latencyMs:{p50:pct(.5),p95:pct(.95),p99:pct(.99),max:sorted.at(-1)},over3000:samples.filter(x=>x.latencyMs>3000),clientEventLoopDelayMs:{mean:delay.mean/1e6,p95:delay.percentile(95)/1e6,p99:delay.percentile(99)/1e6,max:delay.max/1e6}};
await mkdir('evidence/governance/copilot-v1.2/p9/root-cause/runtime',{recursive:true});await writeFile('evidence/governance/copilot-v1.2/p9/root-cause/runtime/basic-latency-diagnostic.json',JSON.stringify(report,null,2)+'\n');
console.log(`BASIC LATENCY DIAGNOSTIC samples=${samples.length} p95=${report.latencyMs.p95} max=${report.latencyMs.max} over3000=${report.over3000.length} clientLoopMax=${report.clientEventLoopDelayMs.max.toFixed(2)}`);
