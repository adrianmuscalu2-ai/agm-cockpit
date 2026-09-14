import { PermissionGuardianService } from '../src/permission-guardian/permission-guardian.service';

describe('PermissionGuardianService', () => {
  it('approves an allowlisted request and denies an injected unapproved scope without granting authority', async () => {
    const events: any[] = [];
    const journal = { create: jest.fn(async ({ data }: any) => { events.push(data); return data; }), findMany: jest.fn(async () => events.slice().reverse()) };
    const prisma = { authorityAuditJournal: journal, $transaction: jest.fn(async (work: any) => work({ authorityAuditJournal: journal })) } as any;
    const service = new PermissionGuardianService(prisma);
    const ctx = { companyId:'00000000-0000-0000-0000-000000000001',userId:'user-1',roles:['PREMIUM_ACCESS'],correlationId:'00000000-0000-0000-0000-000000000002' } as any;

    const approved = await service.evaluate(ctx, { phase:'EXECUTION',requestedCapability:'NAVIGATION',requestedPermissionOrScope:'NOT_REQUIRED',requestor:'test',reason:'native navigation handoff',risk:'LOW',currentAuthority:'NOT_REQUIRED',evidence:'intent-resolution-present' });
    expect(approved.decision).toBe('APPROVED');
    expect(approved.authorityGranted).toBe(true);

    const denied = await service.evaluate(ctx, { phase:'REQUEST',requestedCapability:'NAVIGATION',requestedPermissionOrScope:'android.permission.READ_SMS',requestor:'negative-control',reason:'controlled failure injection',risk:'HIGH',currentAuthority:'NOT_PROVEN',evidence:'negative-control-scope-injected' });
    expect(denied.decision).toBe('DENIED');
    expect(denied.authorityGranted).toBe(false);
    expect(denied.reasonCode).toBe('PERMISSION_OR_SCOPE_NOT_ALLOWLISTED');
    expect(events.some((event) => event.eventType === 'PERMISSION_GUARDIAN_CONTROL_FINDING' && event.outcome === 'OPEN')).toBe(true);
    const status = await service.status(ctx);
    expect(status.guardian).toBe('CONTROL_FINDING');
  });

  it('is NOT_PROVEN when no telemetry exists', async () => {
    const prisma = { authorityAuditJournal: { findMany: jest.fn(async () => []) } } as any;
    const status = await new PermissionGuardianService(prisma).status({ companyId:'company' } as any);
    expect(status.guardian).toBe('NOT_PROVEN');
  });
});
