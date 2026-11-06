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

let build = { checked: false };
const expectedSha = process.env.AGM_EXPECT_BUILD_SHA;
if (expectedSha) {
  const url = process.env.AGM_PRODUCTION_BUILD_INFO_URL ?? 'https://app.agmcockpit.com/build-info.json';
  let info = null;
  // The public frontend is published by Cloudflare Pages asynchronously; wait for it to serve this commit.
  const attempts = Number(process.env.AGM_BUILD_INFO_ATTEMPTS ?? 12);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${url}?expect=${expectedSha.slice(0, 12)}&n=${attempt}`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      info = response.ok ? await response.json() : null;
    } catch {
      info = null;
    }
    if (info?.commit === expectedSha || attempt === attempts) break;
    await new Promise((resolve) => setTimeout(resolve, 30_000));
  }
  build = {
    checked: true,
    expected: expectedSha,
    served: info?.commit ?? null,
    buildId: info?.buildId ?? null,
    builtAt: info?.builtAt ?? null,
    pass: info?.contract === 'agm-web-build-info.v1' && info.commit === expectedSha,
  };
}
const buildPass = !build.checked || build.pass;

console.log(JSON.stringify({
  contract: 'agm-production-deployment-health.v1',
  deployment: pass && buildPass ? 'PASS' : 'FAIL',
  deploymentHealth: pass && buildPass ? 'PASS' : 'FAIL',
  certification: 'PENDING',
  results,
  build,
}));

if (!pass || !buildPass) process.exitCode = 1;
