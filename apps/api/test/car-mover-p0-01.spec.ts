import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CarMoverService } from '../src/car-mover/car-mover.service';
import { CAR_MOVER_SCOPE, canTransitionCarMoverJob } from '../src/car-mover/car-mover.contract';

const companyA = randomUUID();
const companyB = randomUUID();
const userId = randomUUID();
const context = (companyId = companyA, roles = ['PREMIUM_ACCESS']) => ({
  requestId: randomUUID(), correlationId: randomUUID(), userId, companyId, roles,
});

function createHarness() {
  const vehicles: any[] = [];
  const jobs: any[] = [];
  const streams: any[] = [];
  const events: any[] = [];
  const audits: any[] = [];
  const tx: any = {
    carMoverVehicleSubject: {
      create: async ({ data }: any) => { const row = { id: randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() }; vehicles.push(row); return row; },
    },
    carMoverJob: {
      create: async ({ data }: any) => { const row = { id: randomUUID(), currentState: 'DRAFT', lifecycleVersion: 0, assignedDriverUserId: null, ...data, createdAt: new Date(), updatedAt: new Date() }; jobs.push(row); return row; },
      findFirst: async ({ where }: any) => jobs.find(row => row.id === where.id && row.companyId === where.companyId && row.productId === where.productId) ?? null,
      update: async ({ where, data }: any) => { const row = jobs.find(item => item.id === where.id); if(data.currentState!==undefined)row.currentState=data.currentState; row.lifecycleVersion += data.lifecycleVersion.increment; if(data.assignedDriverUserId!==undefined)row.assignedDriverUserId=data.assignedDriverUserId; return row; },
    },
    operationalEventStream: {
      create: async ({ data }: any) => { const row = { id: randomUUID(), ...data }; streams.push(row); return row; },
      update: async ({ where, data }: any) => { const row = streams.find(item => item.companyId === where.companyId_streamId.companyId && item.streamId === where.companyId_streamId.streamId); Object.assign(row, data); return row; },
    },
    operationalEvent: {
      create: async ({ data }: any) => { const row = { id: randomUUID(), ...data }; events.push(row); return row; },
      findMany: async ({ where }: any) => events.filter(row => row.companyId === where.companyId && row.productId === where.productId && row.subjectId === where.subjectId).sort((a,b) => a.aggregateVersion-b.aggregateVersion),
      findFirst: async ({ where }: any) => events.find(row => row.companyId === where.companyId && row.productId === where.productId && row.subjectId === where.subjectId && row.eventType === where.eventType) ?? null,
    },
    auditEvent: {
      findMany: async ({ where }: any) => audits.filter(row => row.companyId === where.companyId && row.productId === where.productId && row.subjectId === where.subjectId),
    },
  };
  const prisma: any = {
    ...tx,
    $transaction: async (callback: any) => callback(tx),
    carMoverJob: {
      ...tx.carMoverJob,
      findMany: async ({ where }: any) => jobs.filter(row => row.companyId === where.companyId && row.productId === where.productId).map(row => ({ ...row, vehicleSubject: vehicles.find(vehicle => vehicle.id === row.vehicleSubjectId) })),
      findFirst: async ({ where }: any) => { const row = await tx.carMoverJob.findFirst({ where }); return row ? { ...row, vehicleSubject: vehicles.find(vehicle => vehicle.id === row.vehicleSubjectId) } : null; },
    },
  };
  const audit: any = {
    create: async (input: any, ctx: any) => { const row = { id: randomUUID(), companyId: ctx.companyId, productId: input.productId, moduleId: input.moduleId, subjectType: input.subjectType, subjectId: input.subjectId, occurredAt: new Date(), evidenceMetadataId: null }; audits.push(row); return row; },
  };
  return { service: new CarMoverService(prisma, audit), vehicles, jobs, events, audits };
}

const intake = (vehicleClass: 'PASSENGER_CAR' | 'TRACTOR_UNIT', vehicleType: string) => ({
  vehicle: { vehicleClass, vehicleType, make: vehicleClass === 'PASSENGER_CAR' ? 'Volkswagen' : 'MAN', model: vehicleClass === 'PASSENGER_CAR' ? 'Golf' : 'TGX', registration: `TEST-${vehicleType}` },
  pickup: { label: 'Berlin', countryCode: 'DE' },
  destination: { label: 'Hamburg', countryCode: 'DE' },
  sourceReference: `${vehicleClass}-${randomUUID()}`,
});

describe('Car Mover P0-01 foundation', () => {
  it('uses the same intake foundation for a passenger car and a tractor unit', async () => {
    const h = createHarness();
    const car = await h.service.create(intake('PASSENGER_CAR', 'hatchback'), context());
    const truck = await h.service.create(intake('TRACTOR_UNIT', 'tractor-unit'), context());
    expect([car.state, truck.state]).toEqual(['DRAFT', 'DRAFT']);
    expect(h.vehicles.map(row => row.vehicleClass)).toEqual(['PASSENGER_CAR', 'TRACTOR_UNIT']);
    expect(h.jobs.every(row => row.productId === CAR_MOVER_SCOPE.productId && row.subjectType === CAR_MOVER_SCOPE.subjectType)).toBe(true);
    expect(h.events.every(row => row.productId === CAR_MOVER_SCOPE.productId && row.subjectId)).toBe(true);
  });

  it('enforces product entitlement and company isolation', async () => {
    const h = createHarness();
    await expect(h.service.create(intake('PASSENGER_CAR', 'sedan'), context(companyA, ['BASIC']))).rejects.toBeInstanceOf(ForbiddenException);
    const created = await h.service.create(intake('PASSENGER_CAR', 'sedan'), context(companyA));
    await expect(h.service.getJobFile(created.jobId, context(companyB))).rejects.toBeInstanceOf(NotFoundException);
    expect(await h.service.list(context(companyB))).toHaveLength(0);
  });

  it('supports the explicit lifecycle and creates scoped events and audit references', async () => {
    const h = createHarness();
    const created = await h.service.create(intake('TRACTOR_UNIT', 'tractor-unit'), context());
    const driver = randomUUID();
    const states = ['READY','ASSIGNED','ACCEPTED','IN_PROGRESS','ARRIVED','HANDOVER_PENDING','COMPLETED'] as const;
    for (const toState of states) {
      if (toState === 'IN_PROGRESS') await h.service.recordProtocol(created.jobId, { protocolType:'TAKEOVER', odometerKm:120000, energyPercent:75, keyCount:2, conditionNotes:'Vehicle accepted.', photoDigests:['takeover-sha256'] }, context());
      if (toState === 'COMPLETED') await h.service.recordProtocol(created.jobId, { protocolType:'HANDOVER', odometerKm:120412, energyPercent:62, keyCount:2, conditionNotes:'Vehicle delivered.', photoDigests:['handover-sha256'] }, context());
      await h.service.transition(created.jobId, { toState, assignedDriverUserId: toState === 'ASSIGNED' ? driver : undefined }, context());
    }
    const file = await h.service.getJobFile(created.jobId, context());
    expect((file.job as any).currentState).toBe('COMPLETED');
    expect(file.timeline).toHaveLength(10);
    expect(file.auditReferences).toHaveLength(10);
    expect(h.events.every(row => row.correlationId && row.productId === 'agm-car-mover' && row.moduleId === 'jobs')).toBe(true);
  });

  it('requires recorded takeover and handover evidence at the operational gates', async () => {
    const h = createHarness();
    const created = await h.service.create(intake('PASSENGER_CAR', 'sedan'), context());
    const driver = randomUUID();
    await h.service.transition(created.jobId, { toState:'READY' }, context());
    await h.service.transition(created.jobId, { toState:'ASSIGNED', assignedDriverUserId:driver }, context());
    await h.service.transition(created.jobId, { toState:'ACCEPTED' }, context());
    await expect(h.service.transition(created.jobId, { toState:'IN_PROGRESS' }, context())).rejects.toThrow('Takeover protocol is required');
    await h.service.recordProtocol(created.jobId, { protocolType:'TAKEOVER', odometerKm:1, keyCount:1, photoDigests:[] }, context());
    await h.service.transition(created.jobId, { toState:'IN_PROGRESS' }, context());
    await h.service.transition(created.jobId, { toState:'ARRIVED' }, context());
    await h.service.transition(created.jobId, { toState:'HANDOVER_PENDING' }, context());
    await expect(h.service.transition(created.jobId, { toState:'COMPLETED' }, context())).rejects.toThrow('Handover protocol is required');
  });

  it('denies lifecycle shortcuts and keeps terminal states terminal', () => {
    expect(canTransitionCarMoverJob('DRAFT', 'READY')).toBe(true);
    expect(canTransitionCarMoverJob('DRAFT', 'COMPLETED')).toBe(false);
    expect(canTransitionCarMoverJob('COMPLETED', 'READY')).toBe(false);
    expect(canTransitionCarMoverJob('CANCELLED', 'DRAFT')).toBe(false);
  });
});
