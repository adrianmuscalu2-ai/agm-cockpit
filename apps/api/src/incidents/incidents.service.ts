import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { ResolveIncidentDto } from './dto/resolve-incident.dto';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateIncidentDto, ctx: RequestContext) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.ensureTransportExists(dto.transportJobId, ctx, tx);

      const incident = await tx.incidentReport.create({
        data: {
          companyId: ctx.companyId,
          transportJobId: dto.transportJobId,
          incidentType: dto.incidentType,
          severity: dto.severity,
          title: dto.title,
          description: dto.description,
          reportedByUserId: ctx.userId,
        },
      });

      const auditEvent = await this.audit.create(
        {
          actionCode: 'create-incident-report',
          entityType: 'IncidentReport',
          entityId: incident.id,
          transportJobId: incident.transportJobId,
          reason: 'Incident report registered through business action API.',
          afterSnapshot: incident,
        },
        ctx,
        tx,
      );

      return {
        incidentId: incident.id,
        transportJobId: incident.transportJobId,
        status: incident.status,
        severity: incident.severity,
        auditEventId: auditEvent.id,
      };
    });
  }

  list(ctx: RequestContext) {
    return this.prisma.incidentReport.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string, ctx: RequestContext) {
    const incident = await this.prisma.incidentReport.findFirst({
      where: { id, companyId: ctx.companyId },
    });

    if (!incident) {
      throw new NotFoundException('Incident report not found.');
    }

    return incident;
  }

  async resolve(id: string, dto: ResolveIncidentDto, ctx: RequestContext) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const incident = await tx.incidentReport.findFirst({
        where: { id, companyId: ctx.companyId },
      });

      if (!incident) {
        throw new NotFoundException('Incident report not found.');
      }

      if (incident.status === 'resolved') {
        throw new BadRequestException('Incident report is already resolved.');
      }

      const updatedIncident = await tx.incidentReport.update({
        where: { id: incident.id },
        data: {
          status: 'resolved',
          resolvedByUserId: ctx.userId,
          resolvedAt: new Date(),
          resolutionNotes: dto.resolutionNotes,
        },
      });

      const auditEvent = await this.audit.create(
        {
          actionCode: 'resolve-incident-report',
          entityType: 'IncidentReport',
          entityId: updatedIncident.id,
          transportJobId: updatedIncident.transportJobId,
          reason: dto.resolutionNotes ?? 'Incident report resolved through business action API.',
          beforeSnapshot: incident,
          afterSnapshot: updatedIncident,
        },
        ctx,
        tx,
      );

      return {
        incidentId: updatedIncident.id,
        transportJobId: updatedIncident.transportJobId,
        previousStatus: incident.status,
        status: updatedIncident.status,
        auditEventId: auditEvent.id,
      };
    });
  }

  private async ensureTransportExists(transportJobId: string, ctx: RequestContext, tx: Prisma.TransactionClient) {
    const transport = await tx.transportJob.findFirst({
      where: {
        id: transportJobId,
        companyId: ctx.companyId,
      },
      select: { id: true },
    });

    if (!transport) {
      throw new NotFoundException('Transport not found.');
    }
  }
}
