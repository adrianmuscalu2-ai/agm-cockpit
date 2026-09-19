import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AgmLibrarySourceId } from '@agm/library-control-plane';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { CAR_MOVER_SCOPE } from './car-mover.contract';

export type CarMoverLibraryRecord = {
  id: string;
  entityType: string;
  title: string;
  summary: string;
  observedAt: string;
  payload: Readonly<Record<string, unknown>>;
  deduplicationKey: string;
  confidence: number;
};

export interface CarMoverLibraryRepositoryPort {
  search(source: AgmLibrarySourceId, query: string, ctx: RequestContext, jobId?: string): Promise<readonly CarMoverLibraryRecord[]>;
}

@Injectable()
export class PrismaCarMoverLibraryRepository implements CarMoverLibraryRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async search(source: AgmLibrarySourceId, query: string, ctx: RequestContext, jobId?: string) {
    authorize(ctx);
    const records = await this.read(source, ctx.companyId, jobId);
    return rankRecords(records, query).slice(0, 5);
  }

  private async read(source: AgmLibrarySourceId, companyId: string, jobId?: string): Promise<CarMoverLibraryRecord[]> {
    if (source === 'CAR_MOVER_TRANSPORTS' || source === 'CAR_MOVER_TRIP_HISTORY') {
      const rows = await this.prisma.carMoverJob.findMany({
        where: { companyId, productId: CAR_MOVER_SCOPE.productId, ...(jobId ? { id: jobId } : {}) },
        include: { vehicleSubject: true }, orderBy: { updatedAt: 'desc' }, take: 100,
      });
      return rows.map((row) => {
        const pickup = jsonLabel(row.pickupSnapshot);
        const destination = jsonLabel(row.destinationSnapshot);
        return record(row.id, 'TRANSPORT', `${pickup} → ${destination}`, `${row.currentState}; ${vehicleLabel(row.vehicleSubject)}`, row.updatedAt, {
          jobId: row.id, state: row.currentState, pickup, destination, sourceReference: row.sourceReference,
          vehicle: minimalVehicle(row.vehicleSubject),
        }, `car-mover-job:${row.id}`);
      });
    }
    if (source === 'CAR_MOVER_OFFERS' || source === 'CAR_MOVER_PLATFORMS') {
      const rows = await this.prisma.carMoverPlatformOffer.findMany({
        where: { companyId, ...(jobId ? { linkedJobId: jobId } : {}) }, orderBy: { updatedAt: 'desc' }, take: 100,
      });
      return rows.map((row) => record(row.id, source === 'CAR_MOVER_OFFERS' ? 'QUOTE' : 'PLATFORM', `${row.pickupLabel ?? '—'} → ${row.destinationLabel ?? '—'}`, `${row.platformName}; ${row.offeredAmount?.toString() ?? '—'} ${row.currencyCode ?? ''}; ${row.status}`, row.updatedAt, {
        offerId: row.id, platformName: row.platformName, externalReference: row.externalReference,
        pickup: row.pickupLabel, destination: row.destinationLabel, vehicleDescription: row.vehicleDescription,
        offeredAmount: row.offeredAmount?.toString() ?? null, currencyCode: row.currencyCode,
        estimatedKm: row.estimatedKm, status: row.status, extractionConfidence: row.extractionConfidence,
      }, `car-mover-offer:${row.id}`, Math.max(0.5, Math.min(1, row.extractionConfidence / 100))));
    }
    if (source === 'CAR_MOVER_CLIENTS') {
      const rows = await this.prisma.carMoverInvoice.findMany({
        where: { companyId, ...(jobId ? { jobId } : {}) }, orderBy: { updatedAt: 'desc' }, take: 100,
      });
      return rows.map((row) => record(row.id, 'CLIENT_REFERENCE', row.counterparty, `${row.direction}; factura ${row.invoiceNumber}; ${row.amount.toString()} ${row.currencyCode}`, row.updatedAt, {
        counterparty: row.counterparty, jobId: row.jobId, direction: row.direction,
        invoiceNumber: row.invoiceNumber, amount: row.amount.toString(), currencyCode: row.currencyCode,
      }, `business-client:${normalize(row.counterparty)}`));
    }
    if (source === 'CAR_MOVER_VEHICLES') {
      const rows = await this.prisma.carMoverVehicleSubject.findMany({
        where: { companyId, productId: CAR_MOVER_SCOPE.productId, ...(jobId ? { jobs: { some: { id: jobId } } } : {}) },
        orderBy: { updatedAt: 'desc' }, take: 100,
      });
      return rows.map((row) => record(row.id, 'VEHICLE', vehicleLabel(row), [row.registration, row.vin].filter(Boolean).join('; '), row.updatedAt, minimalVehicle(row), `car-mover-vehicle:${row.id}`));
    }
    if (source === 'CAR_MOVER_COSTS' || source === 'CAR_MOVER_RATES') {
      const rows = await this.prisma.carMoverFinancialEntry.findMany({
        where: { companyId, ...(jobId ? { jobId } : {}) }, orderBy: { occurredAt: 'desc' }, take: 100,
      });
      return rows
        .filter((row) => source === 'CAR_MOVER_COSTS' ? row.entryType === 'COST' : row.entryType === 'REVENUE')
        .map((row) => record(row.id, source === 'CAR_MOVER_COSTS' ? 'COST' : 'RATE', row.category, `${row.amount.toString()} ${row.currencyCode}${row.description ? `; ${row.description}` : ''}`, row.occurredAt, {
          entryId: row.id, jobId: row.jobId, entryType: row.entryType, category: row.category,
          amount: row.amount.toString(), currencyCode: row.currencyCode, description: row.description,
        }, `car-mover-finance:${row.id}`));
    }
    if (source === 'CAR_MOVER_EMPTY_KILOMETRES') {
      const rows = await this.prisma.opportunityCostAssessment.findMany({
        where: { companyId }, orderBy: { calculatedAt: 'desc' }, take: 100,
      });
      return rows.map((row) => record(row.id, 'EMPTY_KILOMETRES', `${row.emptyKm} km goi`, `${row.estimatedTotalCost.toString()} ${row.currencyCode}; ${row.financialRisk}`, row.calculatedAt, {
        costAssessmentId: row.costAssessmentId, opportunityId: row.opportunityId,
        emptyKm: row.emptyKm, estimatedTotalCost: row.estimatedTotalCost.toString(),
        currencyCode: row.currencyCode, financialRisk: row.financialRisk,
      }, `car-mover-empty-km:${row.id}`));
    }
    if (source === 'CAR_MOVER_DOCUMENTS') {
      const rows = await this.prisma.carMoverInvoice.findMany({
        where: { companyId, ...(jobId ? { jobId } : {}), evidenceReference: { not: null } },
        orderBy: { updatedAt: 'desc' }, take: 100,
      });
      return rows.map((row) => record(row.id, 'DOCUMENT_REFERENCE', `Factura ${row.invoiceNumber}`, row.evidenceReference ?? '', row.updatedAt, {
        documentType: 'INVOICE_EVIDENCE', jobId: row.jobId, invoiceNumber: row.invoiceNumber,
        evidenceReference: row.evidenceReference,
      }, `car-mover-document:${row.id}`));
    }
    return [];
  }
}

function authorize(ctx: RequestContext) {
  if (!ctx.companyId?.trim() || !ctx.userId?.trim() || !ctx.roles.includes('PREMIUM_ACCESS')) throw new ForbiddenException('CAR_MOVER_LIBRARY_AUTHORITY_REQUIRED');
}

function record(id: string, entityType: string, title: string, summary: string, observedAt: Date, payload: Record<string, unknown>, deduplicationKey: string, confidence = 1): CarMoverLibraryRecord {
  return { id, entityType, title, summary, observedAt: observedAt.toISOString(), payload, deduplicationKey, confidence };
}

function rankRecords(records: readonly CarMoverLibraryRecord[], query: string) {
  const terms = significantTerms(query);
  return records.map((item) => ({ item, score: terms.reduce((score, term) => score + (normalize(`${item.title} ${item.summary} ${JSON.stringify(item.payload)}`).includes(term) ? 4 : 0), 0) }))
    .filter(({ score }) => !terms.length || score > 0)
    .sort((left, right) => right.score - left.score || right.item.observedAt.localeCompare(left.item.observedAt))
    .map(({ item }) => item);
}

function significantTerms(value: string) {
  const stop = new Set(['am', 'mai', 'ce', 'pentru', 'clientul', 'acesta', 'aceasta', 'ultima', 'data', 'ruta', 'traseu', 'masina', 'vehiculul', 'transportul', 'oferta', 'ofertele', 'compar', 'verifica', 'despre', 'ceva', 'the', 'this', 'last', 'route', 'client', 'vehicle', 'transport', 'quote', 'check']);
  return [...new Set((normalize(value).match(/[a-z0-9]+/g) ?? []).filter((term) => term.length >= 3 && !stop.has(term)))];
}

function jsonLabel(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) && typeof (value as Record<string, unknown>).label === 'string'
    ? String((value as Record<string, unknown>).label) : '—';
}

function minimalVehicle(value: { id: string; vehicleClass: string; vehicleType: string; make: string | null; model: string | null; vin: string | null; registration: string | null }) {
  return { vehicleId: value.id, vehicleClass: value.vehicleClass, vehicleType: value.vehicleType, make: value.make, model: value.model, vin: value.vin, registration: value.registration };
}

function vehicleLabel(value: { vehicleType: string; make: string | null; model: string | null; registration: string | null }) {
  return [value.make, value.model, value.vehicleType, value.registration].filter(Boolean).join(' ') || value.vehicleType;
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
