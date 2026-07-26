import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestContext } from '../common/request-context';
import type { PreDepartureSessionPayload } from '../pre-departure-contract/pre-departure-contract.types';
import { validatePreDepartureSessionPayload } from '../pre-departure-contract/pre-departure-contract.validation';
import { PrismaService } from '../prisma/prisma.service';

type SessionWithAnswers = Prisma.PreDepartureSessionGetPayload<{ include: { answers: true } }>;

@Injectable()
export class PreDepartureSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: unknown, ctx: RequestContext) {
    const payload = this.validate(input);
    await this.ensureTransportOwnership(payload.transportJobId, ctx);
    const existing = await this.prisma.preDepartureSession.findFirst({
      where: {
        companyId: ctx.companyId,
        OR: [
          { clientSessionId: payload.clientSessionId },
          { idempotencyKey: payload.idempotencyKey },
        ],
      },
      include: { answers: true },
    });
    if (existing) return this.resource(existing);

    const created = await this.prisma.preDepartureSession.create({
      data: {
        ...this.sessionData(payload, ctx),
        answers: { create: this.answerData(payload, ctx.companyId) },
      },
      include: { answers: true },
    });
    return this.resource(created);
  }

  async get(id: string, ctx: RequestContext) {
    const session = await this.prisma.preDepartureSession.findFirst({
      where: { id, companyId: ctx.companyId },
      include: { answers: true },
    });
    if (!session) throw new NotFoundException('Pre-departure session not found.');
    return this.resource(session);
  }

  async update(id: string, input: unknown, expectedServerRevision: number, ctx: RequestContext) {
    const payload = this.validate(input);
    await this.ensureTransportOwnership(payload.transportJobId, ctx);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.preDepartureSession.findFirst({
        where: { id, companyId: ctx.companyId },
        include: { answers: true },
      });
      if (!current) throw new NotFoundException('Pre-departure session not found.');
      if (current.serverRevision !== expectedServerRevision) {
        throw new ConflictException({
          code: 'PRE_DEPARTURE_REVISION_CONFLICT',
          message: 'The server session has a newer revision.',
          serverRevision: current.serverRevision,
        });
      }
      if (current.clientSessionId !== payload.clientSessionId) {
        throw new BadRequestException('clientSessionId cannot be changed.');
      }

      await tx.preDepartureAnswer.deleteMany({ where: { sessionId: id } });
      return this.resource(
        await tx.preDepartureSession.update({
          where: { id },
          data: {
            ...this.sessionData(payload, ctx),
            serverRevision: { increment: 1 },
            answers: { create: this.answerData(payload, ctx.companyId) },
          },
          include: { answers: true },
        }),
      );
    });
  }

  private validate(input: unknown) {
    const result = validatePreDepartureSessionPayload(input);
    if (!result.valid) {
      throw new BadRequestException({ code: 'PRE_DEPARTURE_INVALID_PAYLOAD', issues: result.issues });
    }
    return result.value;
  }

  private sessionData(payload: PreDepartureSessionPayload, ctx: RequestContext) {
    return {
      companyId: ctx.companyId,
      driverUserId: ctx.userId,
      transportJobId: payload.transportJobId,
      clientSessionId: payload.clientSessionId,
      idempotencyKey: payload.idempotencyKey,
      deviceId: payload.deviceId,
      vehicleReference: payload.vehicleReference,
      trailerReference: payload.trailerReference,
      contractVersion: payload.contractVersion,
      checklistVersion: payload.checklistVersion,
      language: payload.language,
      contexts: payload.contexts,
      state: payload.state,
      clientRevision: payload.clientRevision,
      clientUpdatedAt: new Date(payload.updatedAt),
      startedAt: new Date(payload.startedAt),
      confirmedAt: payload.confirmedAt ? new Date(payload.confirmedAt) : null,
      closedAt: payload.closedAt ? new Date(payload.closedAt) : null,
    };
  }

  private answerData(payload: PreDepartureSessionPayload, companyId: string) {
    return payload.answers.map((answer) => ({
      companyId,
      checkId: answer.checkId,
      status: answer.status,
      note: answer.note,
      notApplicableReason: answer.notApplicableReason,
      answeredAt: new Date(answer.answeredAt),
    }));
  }

  private async ensureTransportOwnership(transportJobId: string | undefined, ctx: RequestContext) {
    if (!transportJobId) return;
    const transport = await this.prisma.transportJob.findFirst({
      where: { id: transportJobId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!transport) throw new BadRequestException('transportJobId is not available in the authenticated company.');
  }

  private resource(session: SessionWithAnswers) {
    return {
      id: session.id,
      companyId: session.companyId,
      driverUserId: session.driverUserId,
      contractVersion: session.contractVersion,
      clientSessionId: session.clientSessionId,
      idempotencyKey: session.idempotencyKey,
      transportJobId: session.transportJobId ?? undefined,
      deviceId: session.deviceId ?? undefined,
      vehicleReference: session.vehicleReference ?? undefined,
      trailerReference: session.trailerReference ?? undefined,
      checklistVersion: session.checklistVersion,
      language: session.language,
      contexts: session.contexts,
      state: session.state,
      answers: session.answers.map((answer) => ({
        checkId: answer.checkId,
        status: answer.status,
        note: answer.note ?? undefined,
        notApplicableReason: answer.notApplicableReason ?? undefined,
        answeredAt: answer.answeredAt.toISOString(),
      })),
      clientRevision: session.clientRevision,
      serverRevision: session.serverRevision,
      startedAt: session.startedAt.toISOString(),
      updatedAt: session.clientUpdatedAt.toISOString(),
      confirmedAt: session.confirmedAt?.toISOString(),
      closedAt: session.closedAt?.toISOString(),
      createdAt: session.createdAt.toISOString(),
      serverUpdatedAt: session.updatedAt.toISOString(),
    };
  }
}
