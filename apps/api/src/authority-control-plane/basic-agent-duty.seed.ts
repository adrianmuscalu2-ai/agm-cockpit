export const CHIEF_MONITORING_INSPECTOR_ID = 'chief-monitoring-inspector';
export const CHIEF_MONITORING_INSPECTOR_CONTRACT = 'basic-chief-monitoring-inspector-duty.v1';

export const basicAgentDutySeed = [{
  canonicalId: CHIEF_MONITORING_INSPECTOR_ID,
  kind: 'INSPECTOR',
  module: 'basic.monitoring',
  scope: 'basic.monitoring',
  mode: 'INSPECTOR',
  readPermissions: [
    'authority.mandates.read',
    'authority.runtime-events.read',
    'authority.audit-journal.read',
    'authority.incidents.read',
    'turn.accountability.read',
  ],
  writePermissions: [] as string[],
  prohibitedActions: [
    'business.write',
    'authority.expand',
    'authority.override',
    'incident.direct-write',
    'component-heartbeat.write',
    'production.deploy',
    'secret.read',
  ],
  scheduleMs: 60_000,
  telemetrySource: 'AgentRuntimeEvent',
  approvalReference: 'PHASE_4_CMI_BASIC_RUNTIME_APPROVAL_2026-09-27',
}] as const;

export const chiefMonitoringInspectorDuty = basicAgentDutySeed[0];
