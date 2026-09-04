import { PremiumLoadSafetyController } from '../src/premium-load-safety/premium-load-safety.controller';

describe('Premium load-safety Product Owner telemetry', () => {
  it('persists provider outcome after a real analysis result', async () => {
    const provider = { analyze: jest.fn().mockResolvedValue({ available: true, provider: 'openai', analysis: { correct: [], recommendations: [], risks: [] } }) };
    const prisma = { providerUsageEvent: { create: jest.fn().mockResolvedValue({}) } };
    const controller = new PremiumLoadSafetyController(provider as never, {} as never, {} as never, prisma as never);
    const consent = JSON.stringify({
      confirmed: true,
      purpose: 'load-safety-analysis',
      policyVersion: 'load-safety-privacy-v0.1',
      providerPolicyVersion: 'provider-review-required-v0.1',
      consentedAt: new Date().toISOString(),
    });
    const user = { userId: 'user-1', companyId: 'tenant-1', roles: ['PREMIUM_ACCESS'], requestId: '', correlationId: '' };

    await expect(controller.analyze({ mimetype: 'image/jpeg', buffer: Buffer.from('image') } as never, 'ro', consent, user)).resolves.toMatchObject({ data: { available: true } });
    expect(prisma.providerUsageEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      companyId: 'tenant-1', userId: 'user-1', adapterId: 'premium-load-safety.analysis', eventType: 'PROVIDER_REQUEST', outcome: 'SUCCESS',
    }) });
  });
});
