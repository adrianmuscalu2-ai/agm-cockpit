import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { catchError, defer, from, map, mergeMap, type Observable, throwError } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { OPPORTUNITY_CONTRACT_VERSION } from './opportunity-intelligence.engine';

const HANDLER_AGENTS: Readonly<Record<string, readonly string[]>> = {
  intake: ['premium.car-mover.intake-dedup', 'premium.car-mover.opportunity-normalizer'],
  importExisting: ['premium.car-mover.intake-dedup', 'premium.car-mover.opportunity-normalizer'],
  analyze: ['premium.car-mover.route-mobility', 'premium.car-mover.cost-risk', 'premium.car-mover.opportunity-planner', 'premium.car-mover.opportunity-judge'],
  copilot: ['premium.copilot-gateway'],
};

type AuthenticatedRequest = Request & { user?: { companyId?: string }; requestId?: string };

@Injectable()
export class OpportunityTelemetryInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler().name;
    const agentIds = HANDLER_AGENTS[handler] ?? [];
    if (!agentIds.length) return next.handle();
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const companyId = request.user?.companyId;
    const startedAt = Date.now();
    if (!companyId) return next.handle();
    const operationId = randomUUID();
    const requestId = request.requestId ?? headerValue(request.headers?.['x-request-id']) ?? operationId;
    return defer(() => from(this.recordLifecycle(companyId, agentIds, handler, operationId, requestId, 'STARTED', 1).catch(() => undefined))).pipe(
      mergeMap(() => next.handle()),
      mergeMap((value) => from(this.recordLifecycle(companyId, agentIds, handler, operationId, requestId, 'COMPLETED', 2).catch(() => undefined)).pipe(map(() => value))),
      catchError((error: unknown) => from(Promise.all([
        this.recordFailure(companyId, agentIds, error, Date.now() - startedAt).catch(() => undefined),
        this.recordLifecycle(companyId, agentIds, handler, operationId, requestId, 'FAILED', 2, safeErrorCode(error)).catch(() => undefined),
      ])).pipe(mergeMap(() => throwError(() => error)))),
    );
  }

  private async recordLifecycle(companyId: string, agentIds: readonly string[], handler: string, operationId: string, requestId: string, lifecycle: 'STARTED' | 'COMPLETED' | 'FAILED', sequence: number, errorCode?: string) {
    const occurredAt = new Date();
    await Promise.all(agentIds.map((agentId) => this.prisma.agentRuntimeEvent.create({ data: {
      companyId,
      eventId: randomUUID(),
      mandateId: `opportunity-request:${handler}`,
      agentId,
      dossierId: operationId,
      lifecycle,
      sequence,
      occurredAt,
      evidenceRef: `Request:${requestId}`,
      outputRef: errorCode ? `failure:${errorCode}` : `request:${requestId}`,
      detail: JSON.stringify({ handler, requestId, operationId, lifecycle }),
    } })));
  }

  private async recordFailure(companyId: string, agentIds: readonly string[], error: unknown, durationMs: number) {
    const statusCode = httpStatus(error);
    const errorCode = safeErrorCode(error);
    const health = statusCode >= 500 ? 'FAIL' : 'DEGRADED';
    const dependencyHealth = statusCode >= 500 ? 'FAIL' : 'PASS';
    const now = new Date();
    await Promise.all(agentIds.map((agentId) => this.prisma.opportunityAgentTelemetry.upsert({
      where: { companyId_agentId: { companyId, agentId } },
      create: { companyId, agentId, health, lastRunAt: now, durationMs, freshnessStatus: 'FRESH', backlog: 0, dependencyHealth, outputReference: `failure:${errorCode}`, providerId: 'request-boundary', contractVersion: OPPORTUNITY_CONTRACT_VERSION },
      update: { health, lastRunAt: now, durationMs, freshnessStatus: 'FRESH', dependencyHealth, outputReference: `failure:${errorCode}`, providerId: 'request-boundary', contractVersion: OPPORTUNITY_CONTRACT_VERSION },
    })));
  }
}

function httpStatus(error: unknown) {
  if (error && typeof error === 'object' && 'getStatus' in error && typeof error.getStatus === 'function') {
    const status = Number((error.getStatus as () => number)());
    if (Number.isInteger(status)) return status;
  }
  return 500;
}

function safeErrorCode(error: unknown) {
  const raw = error instanceof Error ? error.message : 'OPPORTUNITY_EXECUTION_FAILED';
  return raw.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 220) || 'OPPORTUNITY_EXECUTION_FAILED';
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
