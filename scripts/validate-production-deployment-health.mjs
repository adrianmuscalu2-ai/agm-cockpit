const endpoints = [
  ['API live', process.env.AGM_PRODUCTION_HEALTH_LIVE_URL ?? 'https://api.agmcockpit.com/api/v1/health/live'],
  ['API ready', process.env.AGM_PRODUCTION_HEALTH_READY_URL ?? 'https://api.agmcockpit.com/api/v1/health/ready'],
  ['Web basic', process.env.AGM_PRODUCTION_BASIC_URL ?? 'https://app.agmcockpit.com/basic'],
  ['Web TURN', process.env.AGM_PRODUCTION_TURN_URL ?? 'https://app.agmcockpit.com/turn'],
];

const results = [];
for (const [name, url] of endpoints) {
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  });
  results.push({ name, url, status: response.status, pass: response.status === 200 });
}

const pass = results.every((result) => result.pass);
console.log(JSON.stringify({
  contract: 'agm-production-deployment-health.v1',
  deployment: pass ? 'PASS' : 'FAIL',
  deploymentHealth: pass ? 'PASS' : 'FAIL',
  certification: 'PENDING',
  results,
}));

if (!pass) process.exitCode = 1;
