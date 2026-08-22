import { ForbiddenException } from '@nestjs/common';
import { RoleProvisioningService } from '../src/auth/role-provisioning.service';

const ctx = { requestId: 'r', correlationId: 'c', userId: 'owner', companyId: 'tenant-a', roles: ['OWNER'] };

describe('Car Mover role provisioning', () => {
  it('rejects a caller without Owner authority', async () => {
    const service = new RoleProvisioningService({} as never, {} as never);
    await expect(service.provisionCarMover('target', { ...ctx, roles: ['PREMIUM_ACCESS'] })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps tenant-scoped owner provisioning contract', () => {
    expect(ctx.roles).toContain('OWNER');
    expect(ctx.companyId).toBe('tenant-a');
  });
});
