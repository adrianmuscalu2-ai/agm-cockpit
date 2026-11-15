import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestContext } from '../common/request-context';
import { canonicalAcpm } from '../acpm/acpm.canonical';
import type { CopilotUsage } from './agmatcc-copilot.contract';

const SCOPE = 'agm-luna-evaluation-20261115';
const RESERVE = 100_000_000; // $0.10: >100k input bytes at conservative long-context rate +120 output tokens.
export type LunaReservation = { callId: string; executionId: string; companyId: string; mandateId: string; startedAt: string };

/** Internal measurement, never an OWNER grant or a model-callable write tool.
 * PostgreSQL serializes reservations across processes. Uncertain usage retains its full reservation.
 */
@Injectable()
export class LunaAcpmLedger {
  constructor(private readonly prisma: PrismaService) {}
  protected requireTarget() {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if(process.env.NODE_ENV==='production') {
      if(process.env.AGMATCC_LUNA_PRODUCTION_ENABLED!=='true'||url.pathname!=='/agm'||url.hostname!==process.env.AGMATCC_LUNA_PRODUCTION_DB_HOST||!process.env.AGMATCC_LUNA_PRODUCTION_DB_HOST||url.port==='55432')throw new Error('LUNA_PRODUCTION_TARGET_REQUIRED');
      return;
    }
    if (!['127.0.0.1','localhost'].includes(url.hostname)
      || url.port !== '55432' || url.pathname !== '/agm_cockpit_191_rehearsal') throw new Error('LUNA_REHEARSAL_TARGET_REQUIRED');
  }
  async reserve(ctx: RequestContext, executionId: string, mandateId: string): Promise<LunaReservation> {
    this.requireTarget();
    const reservation = { callId: randomUUID(), executionId, companyId: ctx.companyId, mandateId, startedAt: new Date().toISOString() };
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL synchronous_commit = on`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(191, 61115)::text`;
      const handoffs=await tx.$queryRaw<Array<{carriedNanoUsd:bigint;receiptHash:string;receipt:Record<string,unknown>;targetDatabase:string}>>`SELECT "carriedNanoUsd","receiptHash","receipt","targetDatabase" FROM "LunaBudgetHandoff" WHERE scope=${SCOPE}`;
      const production=process.env.NODE_ENV==='production';
      if(!production&&handoffs.length)throw new Error('LUNA_SOURCE_BUDGET_FROZEN');
      const handoff=handoffs[0];
      if(production&&(!handoff||handoff.targetDatabase!=='agm'||createHash('sha256').update(canonicalAcpm(handoff.receipt)).digest('hex')!==handoff.receiptHash||handoff.receiptHash!==process.env.AGMATCC_LUNA_HANDOFF_SHA256||String(handoff.receipt.carriedNanoUsd)!==String(handoff.carriedNanoUsd)))throw new Error('LUNA_VERIFIED_HANDOFF_REQUIRED');
      const carried=production?handoff.carriedNanoUsd:0n;
      const budget = await tx.$queryRaw<Array<{ available: bigint }>>`SELECT b."limitNanoUsd"-GREATEST(b."priorNanoUsd",${carried}::bigint)-COALESCE((SELECT SUM(COALESCE(r."chargedNanoUsd",r."reservedNanoUsd")) FROM "LunaEvaluationReservation" r WHERE r."scope"=b."scope"),0)::bigint AS available FROM "LunaEvaluationBudget" b WHERE b."scope"=${SCOPE}`;
      if (!budget.length || BigInt(budget[0].available) < BigInt(RESERVE)) throw new Error('ACPM_BUDGET_EXHAUSTED');
      await tx.$executeRaw`INSERT INTO "LunaEvaluationReservation" ("callId","companyId","executionId","scope","reservedNanoUsd","state","startedAt") VALUES (${reservation.callId}::uuid,${ctx.companyId}::uuid,${executionId}::uuid,${SCOPE},${RESERVE},'RESERVED',${reservation.startedAt}::timestamptz)`;
      await this.event(tx, reservation, 'STARTED', 1, { accounting: 'RESERVED', reservedNanoUsd: RESERVE });
    }, { maxWait: 30_000, timeout: 10_000 });
    return reservation;
  }
  async settle(r: LunaReservation, usage: CopilotUsage | undefined, errorCode: string | null, evidenceRefs: string[], providerOutcome?: string) {
    this.requireTarget();
    const valid = usage && Number.isSafeInteger(usage.inputTokens) && usage.inputTokens >= 0 && Number.isSafeInteger(usage.outputTokens) && usage.outputTokens >= 0;
    // Integer nanodollars: $0.20/M input + $0.75/M output. No binary float accumulation.
    const charged = valid ? usage.inputTokens * 200 + usage.outputTokens * 750 : RESERVE;
    if (!Number.isSafeInteger(charged)) throw new Error('ACPM_USAGE_RANGE');
    const measurement = { schema: 'luna-acpm-usage.v1', accounting: valid ? 'CONFIRMED_ESTIMATE' : 'UNCONFIRMED_RESERVED', inputTokens: valid ? usage.inputTokens : null,
      outputTokens: valid ? usage.outputTokens : null, chargedNanoUsd: charged, reservedNanoUsd: RESERVE,
      pricing: 'conservative-long-context-20261115:input=0.20/output=0.75 USD/M; https://developers.openai.com/api/docs/pricing',
      elapsedMs: Math.max(0, Date.now()-Date.parse(r.startedAt)), errorCode, providerOutcome: providerOutcome ?? null, evidenceRefs };
    const hash = createHash('sha256').update(canonicalAcpm(measurement)).digest('hex');
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL synchronous_commit = on`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(191, 61115)::text`;
      const rows = await tx.$queryRaw<Array<{ state: string; settlementHash: string | null }>>`SELECT "state","settlementHash" FROM "LunaEvaluationReservation" WHERE "callId"=${r.callId}::uuid AND "companyId"=${r.companyId}::uuid FOR UPDATE`;
      if (!rows.length || rows[0].state !== 'RESERVED') throw new Error('ACPM_RESERVATION_ALREADY_SETTLED_OR_MISSING');
      await tx.$executeRaw`UPDATE "LunaEvaluationReservation" SET "chargedNanoUsd"=${charged},"state"=${valid ? 'SETTLED' : 'UNCONFIRMED'},"settlementHash"=${hash} WHERE "callId"=${r.callId}::uuid AND "companyId"=${r.companyId}::uuid`;
      await this.event(tx, r, errorCode ? 'FAILED' : 'COMPLETED', 2, measurement);
    }, { maxWait: 30_000, timeout: 10_000 });
    if (charged > RESERVE) throw new Error('ACPM_RESERVATION_BOUND_EXCEEDED');
  }
  private async event(tx: Prisma.TransactionClient, r: LunaReservation, kind: string, sequence: number, measurement: object) {
    const evidenceHash = createHash('sha256').update(canonicalAcpm(measurement)).digest('hex');
    const payload = canonicalAcpm({ eventId: randomUUID(), chainId: r.executionId, runId: r.callId, mandateId: r.mandateId,
      componentId: 'agmatcc.gpt-6-luna', componentKind: 'AGENT', kind, sequence, occurredAt: new Date().toISOString(),
      evidenceRef: `luna-evaluation:${r.executionId}:${r.callId}:${sequence}`, evidenceHash, source: 'ACP',
      model: { provider: 'openai', name: 'gpt-6-luna', version: 'alias-observed' }, measurement });
    const event = JSON.parse(payload) as { eventId: string };
    const hash = createHash('sha256').update(payload).digest('hex');
    await tx.$executeRaw`INSERT INTO "AgentChainPerformanceEvent" ("companyId","eventId","recordedBy","payload","payloadHash") VALUES (${r.companyId}::uuid,${event.eventId}::uuid,'agmatcc:internal-measurement:v1',${payload}::jsonb,${hash})`;
  }
}
