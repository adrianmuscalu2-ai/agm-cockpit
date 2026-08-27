'use strict';
const fs = require('node:fs');
const http = require('node:http');
const { monitorEventLoopDelay, PerformanceObserver, performance } = require('node:perf_hooks');
const output = process.env.AGM_DIAGNOSTIC_TELEMETRY_PATH;
if (!output) throw new Error('AGM_DIAGNOSTIC_TELEMETRY_PATH_REQUIRED');
const stream = fs.createWriteStream(output, { flags: 'a', encoding: 'utf8' });
const write = (record) => stream.write(`${JSON.stringify({ at: new Date().toISOString(), pid: process.pid, ...record })}\n`);
const loop = monitorEventLoopDelay({ resolution: 10 }); loop.enable();
let lastTick = performance.now();
const interval = setInterval(() => {
  const now = performance.now(), memory = process.memoryUsage(), usage = process.resourceUsage();
  write({ type: 'runtime', intervalDriftMs: Math.max(0, now-lastTick-250), eventLoopDelayMs: { mean: loop.mean/1e6, p95: loop.percentile(95)/1e6, p99: loop.percentile(99)/1e6, max: loop.max/1e6 }, memory: { rss: memory.rss, heapUsed: memory.heapUsed, heapTotal: memory.heapTotal, external: memory.external }, cpu: process.cpuUsage(), scheduling: { voluntaryContextSwitches: usage.voluntaryContextSwitches, involuntaryContextSwitches: usage.involuntaryContextSwitches }, io: { fsRead: usage.fsRead, fsWrite: usage.fsWrite } });
  loop.reset(); lastTick = now;
}, 250); interval.unref();
const gcObserver = new PerformanceObserver((list) => { for (const entry of list.getEntries()) write({ type: 'gc', gcKind: entry.detail?.kind ?? entry.kind, durationMs: entry.duration }); });
gcObserver.observe({ entryTypes: ['gc'] });
const originalEmit = http.Server.prototype.emit;
http.Server.prototype.emit = function(event, request, response) {
  if (event === 'request' && request && response) {
    const received = performance.now(), correlationId = String(request.headers['x-correlation-id'] ?? 'missing');
    const base = { type: 'request', correlationId, method: request.method, url: request.url, receivedAt: new Date().toISOString() };
    response.once('finish', () => write({ ...base, completedAt: new Date().toISOString(), serverDurationMs: performance.now()-received, status: response.statusCode, outcome: 'finish' }));
    response.once('close', () => { if (!response.writableFinished) write({ ...base, completedAt: new Date().toISOString(), serverDurationMs: performance.now()-received, status: response.statusCode, outcome: 'client_closed_before_finish' }); });
    const fault = process.env.AGM_DIAGNOSTIC_FAULTS === 'AUTHORIZED' ? String(request.headers['x-agm-diagnostic-fault'] ?? '') : '';
    if (fault === 'EVENT_LOOP_STALL') { write({type:'fault-injection',correlationId,fault}); const until=performance.now()+3500;while(performance.now()<until){} }
    if (fault === 'GC_MEMORY_PRESSURE') { write({type:'fault-injection',correlationId,fault}); const pressure=[];for(let i=0;i<64;i++)pressure.push(Buffer.alloc(4*1024*1024));if(global.gc)global.gc(); }
    if (fault === 'IO_CONTENTION') { write({type:'fault-injection',correlationId,fault}); const temp=`${output}.io.tmp`;for(let i=0;i<32;i++)fs.writeFileSync(temp,Buffer.alloc(4*1024*1024));try{fs.unlinkSync(temp)}catch{} }
    if (fault === 'DB_NETWORK_DELAY') { write({type:'fault-injection',correlationId,fault}); setTimeout(()=>originalEmit.call(this,event,request,response),3500);return true; }
  }
  return originalEmit.apply(this, arguments);
};
write({ type: 'runtime-start', node: process.version, argv: process.argv.slice(1) });
process.once('exit', () => { write({ type: 'runtime-stop', signal: 'exit' }); stream.end(); });
