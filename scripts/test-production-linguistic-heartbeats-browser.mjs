import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import * as sharedContractNamespace from '../packages/shared/dist/index.js';
import { publishProductionLinguisticHeartbeats } from './publish-production-linguistic-heartbeats-browser.mjs';

const sharedContract = sharedContractNamespace.default ?? sharedContractNamespace;
const { canonicalLinguisticResourceCounts, formatLinguisticResourceEvidence } = sharedContract;

const agentLanguages = {
  'premium-linguist-it': 'it',
  'premium-linguist-es': 'es',
  'premium-linguist-sv': 'sv',
};

async function main() {
  const counts = canonicalLinguisticResourceCounts();
  const heartbeatDetails = Object.fromEntries(
    Object.entries(agentLanguages).map(([agentId, language]) => [
      agentId,
      formatLinguisticResourceEvidence({ language, counts, errors: 0, journalStatus: 'ACTIVE' }),
    ]),
  );
  const requests = { unlock: 0, logout: 0, heartbeats: [] };
  const session = { accessToken: 'controlled-release-turn-admin-token', expiresInSeconds: 300 };

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (request.method === 'GET' && url.pathname === '/turn') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(renderTurnPage(heartbeatDetails));
      return;
    }
    if (request.method === 'POST' && url.pathname === '/custom-api/turn-admin/unlock') {
      requests.unlock += 1;
      const body = JSON.parse(await readBody(request));
      assert.equal(body.pin, 'controlled-owner-pin');
      response.writeHead(201, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ data: session }));
      return;
    }
    if (request.method === 'POST' && url.pathname === '/custom-api/turn-admin/logout') {
      requests.logout += 1;
      assert.equal(request.headers.authorization, ['Bearer', session.accessToken].join(' '));
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ data: { loggedOut: true } }));
      return;
    }
    const heartbeatMatch = url.pathname.match(/\/api\/v1\/operations\/turn\/components\/(premium-linguist-(?:it|es|sv))\/heartbeat$/);
    if (request.method === 'POST' && heartbeatMatch) {
      const agentId = heartbeatMatch[1];
      const body = JSON.parse(await readBody(request));
      assert.equal(request.headers.authorization, ['Bearer', session.accessToken].join(' '));
      assert.equal(body.status, 'ONLINE');
      assert.equal(body.detail, heartbeatDetails[agentId]);
      requests.heartbeats.push(agentId);
      response.writeHead(201, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ data: { componentId: agentId, status: 'ONLINE' } }));
      return;
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ message: 'not found' }));
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');

  try {
    const report = await publishProductionLinguisticHeartbeats({
      target: `http://127.0.0.1:${address.port}/turn`,
      apiBaseUrl: `http://127.0.0.1:${address.port}/custom-api//`,
      pin: 'controlled-owner-pin',
    });
    assert.equal(report.status, 'PASS');
    assert.equal(report.candidateAvailable, true);
    assert.deepEqual(requests.heartbeats.sort(), Object.keys(agentLanguages).sort());
    assert.equal(requests.unlock, 1);
    assert.equal(requests.logout, 1);
    console.log(JSON.stringify({
      status: report.status,
      unlockRequests: requests.unlock,
      logoutRequests: requests.logout,
      heartbeatRequests: requests.heartbeats.length,
    }));
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function renderTurnPage(heartbeatDetails) {
  return `<!doctype html>
<html lang="en">
  <body>
    <script>
      const session = JSON.parse(sessionStorage.getItem('agm.admin.session') || 'null');
      if (session?.accessToken) {
        const heartbeats = ${JSON.stringify(heartbeatDetails)};
        void Promise.all(Object.entries(heartbeats).map(([agentId, detail]) =>
          fetch('/api/v1/operations/turn/components/' + agentId + '/heartbeat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + session.accessToken,
            },
            body: JSON.stringify({ status: 'ONLINE', reason: 'CONTROLLED_RELEASE', detail }),
          }),
        ));
      }
    </script>
  </body>
</html>`;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

void main();
