import { readFileSync } from 'node:fs';

const productionEnv = readFileSync(new URL('../.env.production', import.meta.url), 'utf8');
const configuredUrl = productionEnv
  .split(/\r?\n/)
  .find((line) => line.trim().startsWith('VITE_AGM_API_BASE_URL='))
  ?.split('=', 2)[1]
  ?.trim();

if (!configuredUrl) {
  throw new Error('VITE_AGM_API_BASE_URL is required in apps/web/.env.production.');
}

const apiUrl = new URL(configuredUrl);

const allowLanHttp = process.env.AGM_ALLOW_LAN_HTTP_BUILD === 'true';

if (apiUrl.protocol !== 'https:' && !allowLanHttp) {
  throw new Error(
    'Production builds require an HTTPS API endpoint. ' +
      'For the existing LAN test build only, set AGM_ALLOW_LAN_HTTP_BUILD=true explicitly.',
  );
}

if (apiUrl.hostname.endsWith('.trycloudflare.com')) {
  throw new Error(
    'Production builds cannot embed a temporary Cloudflare Quick Tunnel hostname. ' +
      'Configure a stable API endpoint before building.',
  );
}

if (!apiUrl.pathname.endsWith('/api/v1')) {
  throw new Error('VITE_AGM_API_BASE_URL must end with /api/v1.');
}

console.info(`Production API endpoint validated: ${apiUrl.href.replace(/\/$/, '')}`);
if (allowLanHttp) console.warn('LAN HTTP build override is active. This build must not be distributed as a release.');
