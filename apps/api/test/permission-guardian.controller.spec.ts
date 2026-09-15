import { PermissionGuardianController } from '../src/permission-guardian/permission-guardian.controller';

describe('PermissionGuardianController', () => {
  it('creates a persisted-safe request context for Guardian evaluation', async () => {
    const guardian = {
      evaluate: jest.fn(async () => ({ decision: 'DENIED' })),
      status: jest.fn(),
    } as any;
    const controller = new PermissionGuardianController(guardian);
    const authenticatedUser = {
      companyId: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000002',
      roles: ['PREMIUM_ACCESS'],
      requestId: '',
      correlationId: '',
    };
    const request = {
      phase: 'EXECUTION' as const,
      requestedCapability: 'NAVIGATION',
      requestedPermissionOrScope: 'android.permission.ACCESS_FINE_LOCATION',
      requestor: 'negative-control',
      reason: 'controlled failure injection',
      risk: 'HIGH' as const,
      currentAuthority: 'DENIED' as const,
      evidence: 'negative-control-scope-injected',
    };

    const response = await controller.evaluate(authenticatedUser, request, 'release-request-id');

    const context = guardian.evaluate.mock.calls[0][0];
    expect(context.requestId).toBe('release-request-id');
    expect(context.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(response.meta.requestId).toBe('release-request-id');
  });
});
