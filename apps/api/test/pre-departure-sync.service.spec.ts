import { ConflictException } from '@nestjs/common';
import { PreDepartureSyncService } from '../src/pre-departure-sync/pre-departure-sync.service';

const now = new Date('2026-07-26T03:00:00.000Z');
const payload = {
  contractVersion: '1.0.0',
  clientSessionId: '11111111-1111-4111-8111-111111111111',
  idempotencyKey: '22222222-2222-4222-8222-222222222222',
  checklistVersion: 'pre-departure-checklist-v1',
  language: 'ro',
  contexts: ['local'],
  state: 'IN_PROGRESS',
  answers: [],
  clientRevision: 1,
  startedAt: now.toISOString(),
  updatedAt: now.toISOString(),
};
const record = {
  id: '33333333-3333-4333-8333-333333333333',
  companyId: '44444444-4444-4444-8444-444444444444',
  driverUserId: '55555555-5555-4555-8555-555555555555',
  transportJobId: null,
  deviceId: null,
  vehicleReference: null,
  trailerReference: null,
  ...payload,
  contexts: ['local'],
  state: 'IN_PROGRESS',
  clientUpdatedAt: now,
  startedAt: now,
  confirmedAt: null,
  closedAt: null,
  serverRevision: 2,
  createdAt: now,
  updatedAt: now,
  answers: [],
};
const ctx = {
  companyId: record.companyId,
  userId: record.driverUserId,
  requestId: '66666666-6666-4666-8666-666666666666',
  correlationId: '77777777-7777-4777-8777-777777777777',
  roles: ['driver'],
};

describe('PreDepartureSyncService', () => {
  it('returns the existing resource for an idempotent create retry', async () => {
    const prisma = {
      preDepartureSession: {
        findFirst: jest.fn().mockResolvedValue(record),
        create: jest.fn(),
      },
    };
    const service = new PreDepartureSyncService(prisma as never);
    const result = await service.create(payload, ctx);
    expect(result.id).toBe(record.id);
    expect(result.serverRevision).toBe(2);
    expect(prisma.preDepartureSession.create).not.toHaveBeenCalled();
  });

  it('rejects an update when the expected server revision is stale', async () => {
    const transaction = {
      preDepartureSession: { findFirst: jest.fn().mockResolvedValue(record) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    const service = new PreDepartureSyncService(prisma as never);
    await expect(service.update(record.id, payload, 1, ctx)).rejects.toBeInstanceOf(ConflictException);
  });
});
