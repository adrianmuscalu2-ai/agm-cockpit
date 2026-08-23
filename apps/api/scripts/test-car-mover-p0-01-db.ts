import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditService } from '../src/audit/audit.service';
import { CarMoverService } from '../src/car-mover/car-mover.service';

const prisma = new PrismaClient();
const ROLLBACK = 'AGM_CAR_MOVER_P0_01_TEST_ROLLBACK';

async function main() {
  try {
    await prisma.$transaction(async tx => {
      const user = await tx.user.findFirst({ select: { id: true, companyId: true } });
      if (!user) throw new Error('Local validation requires one existing user.');
      const transactionalPrisma = Object.assign(tx, { $transaction: async (callback: any) => callback(tx) });
      const service = new CarMoverService(transactionalPrisma as any, new AuditService(transactionalPrisma as any));
      const ctx = { requestId: randomUUID(), correlationId: randomUUID(), userId: user.id, companyId: user.companyId, roles: ['PREMIUM_ACCESS'] };
      const make = (vehicleClass: 'PASSENGER_CAR' | 'TRACTOR_UNIT', vehicleType: string) => ({
        vehicle: { vehicleClass, vehicleType, make: vehicleClass === 'PASSENGER_CAR' ? 'Volkswagen' : 'MAN', model: vehicleClass === 'PASSENGER_CAR' ? 'Golf' : 'TGX', registration: `P001-${randomUUID().slice(0, 8)}` },
        pickup: { label: 'Berlin', countryCode: 'DE' }, destination: { label: 'Hamburg', countryCode: 'DE' }, sourceReference: `p0-01-${randomUUID()}`,
      });
      const car = await service.create(make('PASSENGER_CAR', 'hatchback'), ctx);
      const truck = await service.create(make('TRACTOR_UNIT', 'tractor-unit'), { ...ctx, correlationId: randomUUID() });
      for (const toState of ['READY','ASSIGNED','ACCEPTED','IN_PROGRESS','ARRIVED','HANDOVER_PENDING','COMPLETED'] as const) {
        if (toState === 'IN_PROGRESS') await service.recordProtocol(truck.jobId, { protocolType:'TAKEOVER', odometerKm:120000, energyPercent:75, keyCount:2, conditionNotes:'Vehicle accepted.', photoDigests:['takeover-sha256'] }, { ...ctx, correlationId:randomUUID() });
        if (toState === 'COMPLETED') await service.recordProtocol(truck.jobId, { protocolType:'HANDOVER', odometerKm:120412, energyPercent:62, keyCount:2, conditionNotes:'Vehicle delivered.', photoDigests:['handover-sha256'] }, { ...ctx, correlationId:randomUUID() });
        await service.transition(truck.jobId, { toState, assignedDriverUserId: toState === 'ASSIGNED' ? user.id : undefined }, { ...ctx, correlationId: randomUUID() });
      }
      const carFile = await service.getJobFile(car.jobId, ctx);
      const truckFile = await service.getJobFile(truck.jobId, ctx);
      if ((carFile.vehicle as any).vehicleClass !== 'PASSENGER_CAR') throw new Error('Passenger car projection mismatch.');
      if ((truckFile.vehicle as any).vehicleClass !== 'TRACTOR_UNIT' || (truckFile.job as any).currentState !== 'COMPLETED') throw new Error('Truck lifecycle/projection mismatch.');
      if (truckFile.timeline.length !== 10 || truckFile.auditReferences.length !== 10) throw new Error('EventStore/audit/protocol projection mismatch.');
      throw new Error(ROLLBACK);
    }, { timeout: 30_000 });
  } catch (error) {
    if (error instanceof Error && error.message === ROLLBACK) {
      console.log('Car Mover P0-01 PostgreSQL car/truck/lifecycle/EventStore/audit/Job File: PASS (transaction rolled back)');
      return;
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
