import assert from 'node:assert/strict';
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { OPERATIONAL_EVENT_RIGHTS, OperationalEventAccessGuard, tokenScope, type OperationalEventRight } from '../src/operational-event-store/operational-event-access';

const turnToken = `h.${Buffer.from(JSON.stringify({ scope: 'turn-admin' })).toString('base64url')}.s`;
const calls: string[] = [];
const turnAdmin = { requireOperationalAccess: async (a: string | undefined) => { calls.push(a ?? ''); if (a?.includes('revoked')) throw new UnauthorizedException(); } };

function run(right: OperationalEventRight | undefined, authorization: string) {
  const request: { headers: { authorization: string }; user?: Record<string, unknown> } = { headers: { authorization } };
  const reflector = { get: () => right };
  const guard = new OperationalEventAccessGuard(reflector as never, turnAdmin as never);
  const context = { switchToHttp: () => ({ getRequest: () => request }), getHandler: () => run } as unknown as ExecutionContext;
  return { request, result: guard.canActivate(context) };
}

async function main() {
  assert.equal(tokenScope(`Bearer ${turnToken}`), 'turn-admin');
  assert.equal(tokenScope('Bearer garbage'), undefined);
  assert.equal(tokenScope(undefined), undefined);

  for (const right of ['read', 'sync'] as const) {
    const { request, result } = run(right, `Bearer ${turnToken}`);
    assert.equal(await result, true);
    assert.equal(request.user?.companyId, OPERATIONAL_EVENT_RIGHTS.turnAdminCompanyId);
    assert.deepEqual(request.user?.roles, ['TURN_ADMIN_SESSION']);
  }
  await assert.rejects(run('write', `Bearer ${turnToken}`).result, ForbiddenException);
  await assert.rejects(run(undefined, `Bearer ${turnToken}`).result, UnauthorizedException);
  await assert.rejects(run('read', `Bearer ${turnToken}revoked`).result, UnauthorizedException);
  assert.deepEqual([...OPERATIONAL_EVENT_RIGHTS.turnAdminSession], ['read', 'sync']);
  console.log('operational-event-access: PASS');
}

main().catch((error) => { console.error(error); process.exit(1); });
