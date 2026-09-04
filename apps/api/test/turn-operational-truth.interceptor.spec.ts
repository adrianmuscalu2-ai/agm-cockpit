import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { GITHUB_ACTIONS_PROVISIONING_CONTRACT } from '../src/machine-auth/github-actions-oidc.contract';
import { TurnOperationalTruthInterceptor } from '../src/turn-operational-truth/turn-operational-truth.interceptor';

const companyId = GITHUB_ACTIONS_PROVISIONING_CONTRACT.companyId;
const machine = {
  requestId: '10000000-0000-4000-8000-000000000001',
  correlationId: '20000000-0000-4000-8000-000000000001',
  companyId,
  subject: 'production-release-1-1',
  machineIdentityId: '30000000-0000-4000-8000-000000000001',
  credentialId: '40000000-0000-4000-8000-000000000001',
  scopes: ['acp:read'],
};

function contextFor(originalUrl: string, user = machine) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method: 'GET', originalUrl, user }) }),
  } as unknown as ExecutionContext;
}

describe('TurnOperationalTruthInterceptor', () => {
  it('records the successful authenticated M2M registry response before returning it', async () => {
    const truth = { recordAuthenticatedAcpRead: jest.fn().mockResolvedValue({}) };
    const interceptor = new TurnOperationalTruthInterceptor(truth as never);
    const response = { data: [{ canonicalId: 'agm.authority.control-plane' }, { canonicalId: 'premium.release-operations' }] };
    const result = await lastValueFrom(interceptor.intercept(
      contextFor(`/api/v1/m2m/authority-control-plane/companies/${companyId}/network-registry`),
      { handle: () => of(response) } as CallHandler,
    ));

    expect(result).toBe(response);
    expect(truth.recordAuthenticatedAcpRead).toHaveBeenCalledWith({
      machine,
      route: `/api/v1/m2m/authority-control-plane/companies/${companyId}/network-registry`,
      responseBody: response,
      registryNodeCount: 2,
    });
  });

  it('does not manufacture telemetry for another route or an unscoped context', async () => {
    const truth = { recordAuthenticatedAcpRead: jest.fn().mockResolvedValue({}) };
    const interceptor = new TurnOperationalTruthInterceptor(truth as never);
    const handler = { handle: () => of({ data: [] }) } as CallHandler;
    await lastValueFrom(interceptor.intercept(contextFor('/api/v1/health/live'), handler));
    await lastValueFrom(interceptor.intercept(
      contextFor(`/api/v1/m2m/authority-control-plane/companies/${companyId}/network-registry`, { ...machine, scopes: [] }),
      handler,
    ));
    expect(truth.recordAuthenticatedAcpRead).not.toHaveBeenCalled();
  });
});
