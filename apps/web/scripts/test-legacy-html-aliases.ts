import assert from 'node:assert/strict';

function legacyAlias(pathname: string): string | null {
  const normalized = pathname.toLowerCase();
  if (normalized === '/copilot.html') return '/premium/copilot';
  if (normalized === '/contabilitate.html') return '/car-mover/accounting';
  return null;
}

assert.equal(legacyAlias('/copilot.html'), '/premium/copilot');
assert.equal(legacyAlias('/contabilitate.html'), '/car-mover/accounting');
assert.equal(legacyAlias('/basic'), null);
console.log('legacy html aliases: PASS');
