import { BadRequestException, Injectable } from '@nestjs/common';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { COMPONENT_TELEMETRY_CONTRACT, type ComponentHealthSnapshot } from './component-telemetry.contract';
import type { RecordComponentHeartbeatDto } from './dto/record-component-heartbeat.dto';

type StoredHeartbeat = {
  componentId: string;
  reportedStatus: string;
  lastSeenAt: Date;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastFailureReason: string | null;
  lastDetail: string | null;
};

@Injectable()
export class ComponentTelemetryService {
  constructor(private readonly prisma: PrismaService) {}

  async heartbeat(componentId: string, input: RecordComponentHeartbeatDto, ctx: RequestContext) {
    this.assertSupported(componentId);
    const now = new Date();
    const reason = input.reason?.trim() || (input.status === 'ONLINE' ? 'HEARTBEAT_RECEIVED' : 'COMPONENT_REPORTED_DEGRADED');
    const detail = input.detail?.trim() || null;
    const stored = await this.prisma.componentHeartbeat.upsert({
      where: { companyId_componentId: { companyId: ctx.companyId, componentId } },
      create: {
        companyId: ctx.companyId,
        componentId,
        reportedStatus: input.status,
        lastSeenAt: now,
        lastSuccessAt: input.status === 'ONLINE' ? now : null,
        lastFailureAt: input.status === 'DEGRADED' ? now : null,
        lastFailureReason: input.status === 'DEGRADED' ? reason : null,
        lastDetail: detail,
      },
      update: {
        reportedStatus: input.status,
        lastSeenAt: now,
        ...(input.status === 'ONLINE'
          ? { lastSuccessAt: now }
          : { lastFailureAt: now, lastFailureReason: reason }),
        lastDetail: detail,
      },
    });
    return this.snapshotFrom(stored, now);
  }

  async health(componentId: string, ctx: RequestContext) {
    this.assertSupported(componentId);
    const stored = await this.prisma.componentHeartbeat.findUnique({
      where: { companyId_componentId: { companyId: ctx.companyId, componentId } },
    });
    return this.snapshotFrom(stored, new Date(), componentId);
  }

  snapshotFrom(stored: StoredHeartbeat | null, checkedAt: Date, componentId = stored?.componentId ?? ''): ComponentHealthSnapshot {
    if (!stored) {
      return {
        contract: COMPONENT_TELEMETRY_CONTRACT.version,
        componentId,
        status: 'UNKNOWN',
        checkedAt: checkedAt.toISOString(),
        lastSeenAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        reason: 'NO_HEARTBEAT_RECORDED',
        detail: null,
        freshness: 'UNKNOWN',
      };
    }
    const stale = checkedAt.getTime() - stored.lastSeenAt.getTime() > COMPONENT_TELEMETRY_CONTRACT.staleAfterMs;
    const status = stale ? 'OFFLINE' : stored.reportedStatus === 'DEGRADED' ? 'DEGRADED' : 'ONLINE';
    return {
      contract: COMPONENT_TELEMETRY_CONTRACT.version,
      componentId: stored.componentId,
      status,
      checkedAt: checkedAt.toISOString(),
      lastSeenAt: stored.lastSeenAt.toISOString(),
      lastSuccessAt: stored.lastSuccessAt?.toISOString() ?? null,
      lastFailureAt: stored.lastFailureAt?.toISOString() ?? null,
      reason: stale ? 'HEARTBEAT_STALE' : status === 'DEGRADED' ? stored.lastFailureReason ?? 'COMPONENT_REPORTED_DEGRADED' : 'HEARTBEAT_CURRENT',
      detail: stored.lastDetail,
      freshness: stale ? 'OFFLINE' : 'LIVE',
    };
  }

  private assertSupported(componentId: string) {
    if (!(COMPONENT_TELEMETRY_CONTRACT.supportedComponents as readonly string[]).includes(componentId)) {
      throw new BadRequestException('COMPONENT_TELEMETRY_NOT_SUPPORTED');
    }
  }
}
