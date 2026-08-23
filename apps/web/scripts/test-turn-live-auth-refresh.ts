import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/turn-agent-live-state.ts', import.meta.url), 'utf8');

assert.match(source, /fetcher\(`\$\{apiBaseUrl\(\)\}\/auth\/refresh`/,
  'TURN live state must restore the official Premium session through /auth/refresh.');
assert.match(source, /credentials:\s*'include'/,
  'Refresh must use the existing HttpOnly refresh-cookie custody.');
assert.match(source, /sessionStorage\.setItem\(tokenKey, restored\)/,
  'The restored short-lived access token must be kept in session storage only.');
assert.match(source, /const token = await accessToken\(fetcher\)/,
  'Both polling and real execution must await the restored session.');
assert.match(source, /response\.status === 401\) sessionStorage\.removeItem\(tokenKey\)/,
  'A rejected stale access token must be discarded fail-closed.');

console.log('TURN live Premium session restoration contract: PASS');
