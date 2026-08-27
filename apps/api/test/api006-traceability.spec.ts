import { BadRequestException, NotFoundException } from '@nestjs/common';
import { API006_TRACEABILITY_CONTRACT } from '../src/common/api006-traceability.contract';
import { EvidenceService } from '../src/evidence/evidence.service';
import { IncidentsService } from '../src/incidents/incidents.service';
import { ValidationReportsService } from '../src/validation-reports/validation-reports.service';

const ctx = {
  companyId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  requestId: '33333333-3333-4333-8333-333333333333',
  correlationId: '44444444-4444-4444-8444-444444444444',
  roles: ['operator'],
};

describe('API-006 traceability contract', () => {
  it('creates an incident and its audit event in the same transaction', async () => {
    const incident = {
      id: '55555555-5555-4555-8555-555555555555',
      transportJobId: '66666666-6666-4666-8666-666666666666',
      status: 'open',
      severity: 'critical',
    };
    const tx = {
      transportJob: { findFirst: jest.fn().mockResolvedValue({ id: incident.transportJobId }) },
      incidentReport: { create: jest.fn().mockResolvedValue(incident) },
    };
    const prisma = { $transaction: jest.fn(async (operation: (transaction: typeof tx) => unknown) => operation(tx)) };
    const audit = { create: jest.fn().mockResolvedValue({ id: 'audit-incident' }) };
    const service = new IncidentsService(prisma as never, audit as never);

    const result = await service.create({
      transportJobId: incident.transportJobId,
      incidentType: 'service-failure',
      severity: 'critical',
      title: 'API unavailable',
    }, ctx);

    expect(result.auditEventId).toBe('audit-incident');
    expect(tx.incidentReport.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ companyId: ctx.companyId, reportedByUserId: ctx.userId }),
    }));
    expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({
      actionCode: API006_TRACEABILITY_CONTRACT.actions.createIncident,
      entityType: API006_TRACEABILITY_CONTRACT.entities.incident,
      entityId: incident.id,
    }), ctx, tx);
  });

  it('keeps incident reads tenant-scoped and rejects cross-tenant lookup', async () => {
    const prisma = {
      incidentReport: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new IncidentsService(prisma as never, { create: jest.fn() } as never);
    await service.list(ctx);
    expect(prisma.incidentReport.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: ctx.companyId } }));
    await expect(service.get('foreign-incident', ctx)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.incidentReport.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign-incident', companyId: ctx.companyId } });
  });

  it('accepts a tenant-scoped Car Mover Job as the incident subject without blocking its lifecycle', async () => {
    const carMoverJobId = '77777777-7777-4777-8777-777777777777';
    const incident = { id:'88888888-8888-4888-8888-888888888888', transportJobId:carMoverJobId, status:'open', severity:'medium' };
    const tx = {
      transportJob: { findFirst: jest.fn().mockResolvedValue(null) },
      carMoverJob: { findFirst: jest.fn().mockResolvedValue({ id:carMoverJobId }) },
      incidentReport: { create: jest.fn().mockResolvedValue(incident) },
    };
    const prisma = { $transaction: jest.fn(async (operation: (transaction: typeof tx) => unknown) => operation(tx)) };
    const audit = { create: jest.fn().mockResolvedValue({ id:'audit-car-mover-incident' }) };
    const service = new IncidentsService(prisma as never, audit as never);

    const result = await service.create({ transportJobId:carMoverJobId, incidentType:'handover-exception', severity:'medium', title:'Handover requires review' }, ctx);

    expect(result).toMatchObject({ transportJobId:carMoverJobId, status:'open' });
    expect(tx.carMoverJob.findFirst).toHaveBeenCalledWith({ where:{ id:carMoverJobId, companyId:ctx.companyId }, select:{ id:true } });
  });

  it('does not resolve an incident twice', async () => {
    const tx = { incidentReport: { findFirst: jest.fn().mockResolvedValue({ id: 'incident-1', companyId: ctx.companyId, status: 'resolved' }) } };
    const prisma = { $transaction: jest.fn(async (operation: (transaction: typeof tx) => unknown) => operation(tx)) };
    const service = new IncidentsService(prisma as never, { create: jest.fn() } as never);
    await expect(service.resolve('incident-1', {}, ctx)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates evidence metadata and audit linkage atomically', async () => {
    const evidence = {
      id: '77777777-7777-4777-8777-777777777777',
      transportJobId: '66666666-6666-4666-8666-666666666666',
      evidenceType: 'photo',
      storageProvider: 'object-storage',
      storageKey: 'company/transport/photo.jpg',
    };
    const tx = {
      transportJob: { findFirst: jest.fn().mockResolvedValue({ id: evidence.transportJobId }) },
      evidenceMetadata: { create: jest.fn().mockResolvedValue(evidence) },
    };
    const prisma = { $transaction: jest.fn(async (operation: (transaction: typeof tx) => unknown) => operation(tx)) };
    const audit = { create: jest.fn().mockResolvedValue({ id: 'audit-evidence' }) };
    const service = new EvidenceService(prisma as never, audit as never);

    const result = await service.create({
      transportJobId: evidence.transportJobId,
      evidenceType: evidence.evidenceType,
      storageProvider: evidence.storageProvider,
      storageKey: evidence.storageKey,
    }, ctx);

    expect(result.auditEventId).toBe('audit-evidence');
    expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({
      actionCode: API006_TRACEABILITY_CONTRACT.actions.createEvidence,
      entityType: API006_TRACEABILITY_CONTRACT.entities.evidence,
      entityId: evidence.id,
    }), ctx, tx);
  });

  it('persists validation reports with request and correlation trace fields', async () => {
    const create = jest.fn().mockResolvedValue({ validationReportId: 'report-1' });
    const service = new ValidationReportsService({ businessValidationReport: { create } } as never);
    await service.create({
      validationType: 'incident-resolution',
      relatedBusinessAction: 'resolve-incident-report',
      relatedEntityType: 'IncidentReport',
      relatedEntityId: '55555555-5555-4555-8555-555555555555',
      overallResult: 'passed',
      executedChecks: [],
      executionDurationMs: 12,
    }, ctx);

    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      companyId: ctx.companyId,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      validationVersion: API006_TRACEABILITY_CONTRACT.validationVersion,
      createdByUserId: ctx.userId,
    }) });
  });
});
