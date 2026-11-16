import { randomUUID } from 'node:crypto';
import type { AcpmEvent } from '@agm/shared';
import type { RequestContext } from '../common/request-context';

// Telemetry-only process session; never an authentication token or identity grant.
export const ACPM_RUNTIME_SESSION = Object.freeze({id:randomUUID(),startedAt:new Date(Date.now()-process.uptime()*1000).toISOString()});
export function runtimeObservation(ctx:RequestContext,orchestratorId:string|null=null):NonNullable<AcpmEvent['execution']> {
  return {runtimeSessionId:ACPM_RUNTIME_SESSION.id,processStartedAt:ACPM_RUNTIME_SESSION.startedAt,
    requestCorrelationId:ctx.correlationId,orchestratorId,buildRevision:process.env.AGM_BUILD_SHA??null,source:'RUNTIME_OBSERVER'};
}
