import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { cosine, embedText } from '@agm/shared';
import { AuthorityControlPlaneService } from '../authority-control-plane/authority-control-plane.service';
import { TurnOperationalTruthService } from '../turn-operational-truth/turn-operational-truth.service';
import { TurnAdminService } from '../turn-admin/turn-admin.service';
import { OPERATIONAL_EVENT_RIGHTS } from '../operational-event-store/operational-event-access';
import type { RequestContext } from '../common/request-context';
import type { CopilotEvidence } from './agmatcc-copilot.contract';
import { evidenceRelationKeys } from './evidence-relations';

export type SourceState = 'AVAILABLE' | 'INACCESSIBLE' | 'NOT_CONNECTED' | 'NOT_AUTHORIZED' | 'UNAVAILABLE' | 'NO_DATA';
export const TURN_READ_SOURCES = ['agents', 'telemetry', 'overview', 'incidents', 'authority', 'connections'] as const;
type Row = Record<string, unknown>;

/** Reuses the existing TURN read boundary, without synthesizing an OWNER identity.
 * The bearer is verified locally and never enters provider messages or evidence.
 * Observational projections cannot reconcile incidents or execute health probes.
 */
@Injectable()
export class TurnObservationReader {
  constructor(private readonly turnAdmin: TurnAdminService, private readonly authority: AuthorityControlPlaneService,
    private readonly truth: TurnOperationalTruthService) {}

  async read(source: string, query: string, user: RequestContext, authorization?: string): Promise<CopilotEvidence[]> {
    if (!TURN_READ_SOURCES.includes(source as typeof TURN_READ_SOURCES[number])) return [sourceStatus(source, 'NOT_CONNECTED')];
    if (!user.roles.includes('TURN_ADMIN_SESSION') || user.companyId !== OPERATIONAL_EVENT_RIGHTS.turnAdminCompanyId) return [sourceStatus(source, 'NOT_AUTHORIZED')];
    try { await this.turnAdmin.requireOperationalAccess(authorization); }
    catch (error) {
      const status = (error as { getStatus?: () => number })?.getStatus?.();
      return [sourceStatus(source, status === 401 || status === 403 ? 'NOT_AUTHORIZED' : 'UNAVAILABLE')];
    }
    try {
      if (source === 'connections') return [evidence(source, {
        state: 'AVAILABLE', recordKind: 'ADAPTER_CONFIGURATION_ONLY', configuredAdapters: ['tenant operational journal', ...TURN_READ_SOURCES.filter(s => s !== 'connections')], runtimeConnectivity: 'NOT_CHECKED: each source must be read separately; adapter presence is not proof of connectivity',
        restricted: { acpm: 'NOT_AUTHORIZED: requires a separate OWNER identity', governance: 'NOT_AUTHORIZED: requires a bound human APPROVER/VALIDATOR', riskKnowledge: 'NOT_AUTHORIZED: existing Governance boundary' },
        notConnected: { versionHistory: 'Historical UI projection; no complete live release history adapter', evidenceLedger: 'Historical UI projection; individual original references remain available in connected records', functionalOverview: 'Active translation probe excluded from observation-only reader' },
        limits: 'No full-history claim. No causal relationship inferred from similarity or timestamps.',
      })];
      if (source === 'agents') {
        const snapshot = await this.authority.agentAccountability(user, true);
        return records(source, snapshot.agents, query, { generatedAt: snapshot.generatedAt, fleet: snapshot.fleet, operationalFleet: snapshot.operationalFleet, inspector: snapshot.inspector, verdict: snapshot.verdict });
      }
      if (source === 'telemetry') {
        const [truth, dashboard] = await Promise.all([this.truth.snapshot(), this.authority.dashboard(user, true)]);
        return records(source, dashboard.nodes.map(node => pick(node, ['canonicalId', 'status', 'health', 'freshness', 'statusObservedAt', 'lastHeartbeat', 'lastActivity', 'reason', 'runtimeEvidence', 'activityEvidence', 'telemetry'])), query,
          { generatedAt: dashboard.generatedAt, operationalTruth: truth, runtimeWindow: dashboard.telemetryInventory.runtimeEventWindow });
      }
      const dashboard = await this.authority.dashboard(user, true);
      if (source === 'incidents') return records(source, dashboard.incidents, query, { generatedAt: dashboard.generatedAt, pipeline: dashboard.incidentPipeline, coverage: 'Latest 2000 OPENED/RESOLVED authority journal records; not all incident stores', observationOnly: true });
      if (source === 'authority') return records(source, dashboard.nodes.map(node => pick(node, ['canonicalId', 'kind', 'scope', 'supervisorId', 'status', 'reason', 'requiredAction', 'dependencyState', 'dependencyFailures', 'evidence', 'incidentQualification'])), query,
        { generatedAt: dashboard.generatedAt, controlPlane: dashboard.controlPlane, recovery: dashboard.recovery });
      return records(source, dashboard.nodes.map(node => pick(node, ['canonicalId', 'kind', 'module', 'scope', 'currentFunction', 'status', 'statusLabel', 'health', 'freshness', 'statusObservedAt', 'reason', 'evidence'])), query,
        { generatedAt: dashboard.generatedAt, departments: dashboard.departments, capabilityGaps: dashboard.capabilityGaps });
    } catch (error) {
      const status = (error as { getStatus?: () => number })?.getStatus?.();
      return [sourceStatus(source, status === 401 || status === 403 ? 'NOT_AUTHORIZED' : status === 404 ? 'INACCESSIBLE' : 'UNAVAILABLE')];
    }
  }
}

export function sourceStatus(source: string, state: SourceState): CopilotEvidence {
  return evidence(source, { state, factualDataAvailable: false, message: 'This is a connection/read result, not evidence of operational health or absence of incidents.' });
}

function records(source: string, rows: readonly unknown[], query: string, summary: unknown): CopilotEvidence[] {
  const vector = embedText(query.slice(0, 200));
  const ranked = rows.map((row, index) => ({ row: safeObservation(row), index, score: cosine(vector, embedText(JSON.stringify(safeObservation(row)).slice(0, 4000))) }))
    .sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 10);
  const selected: CopilotEvidence[] = [];
  let remaining = 8000;
  for (const { row, score } of ranked) {
    const item = evidence(source, { state: 'AVAILABLE', score, record: row });
    if (item.content.length > remaining) continue;
    selected.push(item);
    remaining -= item.content.length;
  }
  return [evidence(source, { state: rows.length ? 'AVAILABLE' : 'NO_DATA', coverage: { totalInProjection: rows.length, returned: selected.length, complete: rows.length <= selected.length }, retrieval: 'Shared concept-vector contextual ranking; similarity is not proof of causality', summary: safeObservation(summary) }), ...selected];
}

function evidence(source: string, content: unknown): CopilotEvidence {
  const serialized = JSON.stringify(safeObservation(content));
  const safe = serialized.length <= 3500 ? serialized : JSON.stringify({ state: (content as Row).state, coverage: (content as Row).coverage, originalReferences: [...evidenceRelationKeys(safeObservation(content))].slice(0, 12), partial: true, limitation: 'Evidence excerpt truncated; omitted fields cannot support claims.', excerpt: serialized.slice(0, 2200) });
  return { sourceRef: `turn-observation:${source}:${createHash('sha256').update(safe).digest('hex').slice(0, 24)}`, observedAt: new Date().toISOString(), content: safe };
}

function pick(value: object, keys: readonly string[]): Row {
  const row = value as Row;
  return Object.fromEntries(keys.filter(key => key in row).map(key => [key, row[key]]));
}

export function safeObservation(value: unknown, depth = 0): unknown {
  if (depth > 10) return '[DEPTH LIMIT]';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value.slice(0, 1600)
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{12,}/g, '[REDACTED]')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*/gi, '[REDACTED]')
    .replace(/\b(password|secret|token|api[_ -]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]');
  if (Array.isArray(value)) return value.slice(0, 150).map(item => safeObservation(item, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, /password|passwd|secret|token|authorization|api.?key|private.?key|credential|cookie/i.test(key) ? '[REDACTED]' : safeObservation(item, depth + 1)]));
  return value;
}
