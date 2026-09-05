import { agentGovernanceRegistry, type AgentGovernanceRecord } from './agent-governance.registry';
import { t } from './i18n/app-i18n';
import { type UiLanguage } from './i18n/app-i18n.types';
import { type InspectorReport, inspectorReportFor, inspectorReports } from './inspector-agent';
import { renderIncidentJournal, type IncidentJournalFilters, type OperationalIncident } from './incident-journal';
import { renderMaintenanceDepartment } from './maintenance-department';
import { operationalClosureRegistry } from './operational-closure.registry';
import { monitoringHealthSources, operationsHealthSources } from './operations-health';
import { renderMonitoringDepartment } from './monitoring-department';
import { renderTurnOrganizationChart, turnOrganizationAgents } from './turn-organization-chart';
import { renderP9TurnProjection } from './p9-turn-projection';
import { turnCommandCenterContract } from './turn-command-center.contract';
import { currentProductionPreflightSnapshot, renderProductionPreflight } from './production-preflight';
import { activateIncidentRoute, routeIncident } from './incident-routing.registry';
import { renderStatusLight } from './turn-status-lights';
import { renderTurnAuthorityControlPlane } from './premium-governance/premium-governance.view';
import {
  type TurnCommandItem,
  type TurnHealthStatus,
  type TurnMissionItem,
  turnAgents,
  turnAuditTrail,
  turnDepartments,
  turnMissions,
  turnModules,
} from './turn-command-center';

type TurnCommandCenterViewOptions = {
  language: UiLanguage;
  appVersion: string;
  incidents: OperationalIncident[];
  incidentFilters: IncidentJournalFilters;
};

export function renderTurnCommandCenter({ language, appVersion, incidents, incidentFilters }: TurnCommandCenterViewOptions) {
  const activeDepartments = countByStatus(turnDepartments, 'active');
  const stableModules = countByStatus(turnModules, 'stable');
  const activeMissions = countByStatus(turnMissions, 'active');
  const acceptedAudits = countByValidation(turnAuditTrail, 'turn.validation.accepted');
  const inspectorFreshnessLimitMs = 24 * 60 * 60 * 1000;
  const freshInspectorReports = inspectorReports.filter((report) => Date.now() - new Date(report.lastCheckedAt).getTime() <= inspectorFreshnessLimitMs);
  const staleInspectorReports = inspectorReports.length - freshInspectorReports.length;
  const attentionReports = freshInspectorReports.filter((report) => report.status !== 'ok').length;
  const inspectorStatusCounts = freshInspectorReports.reduce(
    (counts, report) => {
      counts[report.status] += 1;
      return counts;
    },
    { ok: 0, attention: 0, error: 0 },
  );

  return `
    <section
      class="turn-command-center"
      aria-label="${escapeHtml(t(language, 'turn.ariaLabel'))}"
      data-module-contract="${turnCommandCenterContract.version}"
      data-operation-mode="${turnCommandCenterContract.mode}"
      data-active-turn-page="basic"
    >
      <header class="turn-command-header">
        <div>
          <span class="turn-kicker">TURN · REAL OPERATIONAL COMMAND</span>
          <h1>${escapeHtml(t(language, 'turn.title'))}</h1>
          <p>SEE → UNDERSTAND → DRILL DOWN → ACT. Suprafețele spațiale folosesc aceleași surse canonice ca detaliile operaționale.</p>
        </div>
        <div class="turn-command-header-actions">
          <strong>PRODUCT OWNER ACCEPTANCE · NOT GRANTED</strong>
          <a href="/basic" data-module="basic" data-turn-exit>Ieși din TURN · Înapoi în aplicație</a>
        </div>
      </header>

      <nav class="turn-page-navigation" data-turn-page-navigation aria-label="Pagini TURN">
        <button type="button" data-turn-page-target="basic" aria-selected="true">1 · BASIC</button>
        <button type="button" data-turn-page-target="premium" aria-selected="false">2 · PREMIUM</button>
        <button type="button" data-turn-page-target="incidents" aria-selected="false">3 · INCIDENTE</button>
        <button type="button" data-turn-page-target="investigate" aria-selected="false">4 · DRILL-DOWN</button>
      </nav>

      ${renderFunctionalOverview()}

      ${renderTurnAuthorityControlPlane()}

      <section class="turn-incident-page" data-turn-page="incidents" hidden aria-labelledby="turn-incident-page-title">
        <header><div><span class="turn-kicker">TURN · INCIDENT PIPELINE</span><h2 id="turn-incident-page-title">Failure → qualification → EventStore → API → TURN</h2><p>Nicio stare non-healthy nu este echivalată automat cu un incident. Fiecare decizie arată regula, sursa și dovada persistentă.</p></div><strong data-incident-pipeline-status>SE ÎNCARCĂ</strong></header>
        <div data-operational-incident-summary></div>
        <div data-operational-incident-decisions></div>
        <details class="turn-secondary-registry turn-subsystem-incident-journal">
          <summary><strong>Jurnal separat · incidente aplicație / transport</strong><span>NU ESTE folosit pentru agent health</span></summary>
          ${renderActiveOperationsIncident(incidents)}
          ${renderIncidentJournal(language, incidents, incidentFilters)}
        </details>
      </section>

      <section class="turn-investigation-page" data-turn-page="investigate" hidden aria-label="TURN drill-down și registre">
        ${renderP9TurnProjection()}

        <header class="turn-hero">
        <div>
          <span class="turn-kicker">${escapeHtml(t(language, 'turn.code'))}</span>
          <h1>${escapeHtml(t(language, 'turn.title'))}</h1>
          <p>${escapeHtml(t(language, 'turn.description'))}</p>
        </div>
        <div class="turn-readonly-badge">
          <strong>${escapeHtml(t(language, 'turn.readOnly'))}</strong>
          <span>${escapeHtml(t(language, 'turn.readOnlyDesc'))}</span>
          <small>Surse: ${turnCommandCenterContract.dataSources.map(escapeHtml).join(' · ')}</small>
        </div>
      </header>

      <nav class="turn-module-nav" aria-label="Turn modules">
        ${[
          ['Valoare Product Owner', 'turn-functional-overview'],
          ['Authority Control Plane', 'turn-authority-control-plane'],
          ['Premium Agent Network', 'turn-premium-network'],
          ['Agent Directory', 'turn-dashboard'],
          ['Organigramă', 'turn-structure'],
          ['Monitoring', 'turn-monitoring'],
          ['Agents', 'turn-agents'],
          ['Missions', 'turn-missions'],
          ['Alerts', 'turn-alerts'],
          ['Incidents', 'incident-journal'],
          ['Registers', 'turn-registers'],
          ['Architecture', 'turn-architecture'],
          ['Modules', 'turn-modules'],
          ['Documentation', 'turn-documentation'],
          ['System', 'turn-system'],
        ]
          .map(([label, target]) => `<a href="#${target}">${label}</a>`)
          .join('')}
      </nav>

      <details class="turn-secondary-registry" data-secondary-registry>
        <summary><strong>Inventar secundar · identități și responsabilități</strong><span>REGISTRY ONLY · nu reprezintă runtime</span></summary>
        ${renderApprovedTurnDashboard(language)}
      </details>

      <section class="turn-metrics" aria-label="${escapeHtml(t(language, 'turn.metrics'))}">
        ${renderTurnMetric(language, 'turn.metric.departments', String(activeDepartments), 'turn.metric.departmentsDesc')}
        ${renderTurnMetric(language, 'turn.metric.modules', String(stableModules), 'turn.metric.modulesDesc')}
        ${renderTurnMetric(language, 'turn.metric.missions', String(activeMissions), 'turn.metric.missionsDesc')}
        ${renderTurnMetric(language, 'turn.metric.audits', String(acceptedAudits), 'turn.metric.auditsDesc')}
        ${renderTurnMetric(
          language,
          'turn.metric.attention',
          `${attentionReports} LIVE · ${staleInspectorReports} STALE`,
          'turn.metric.attentionDesc',
          renderGeneralInspectorReport(language, inspectorStatusCounts),
        )}
      </section>

      ${renderExecutionReadinessGate(incidents)}
      ${renderTurnRealityContract()}
      ${renderOperationalProtocol()}
      ${renderProductionPreflight()}
      ${renderOperationsCenter(incidents)}
      ${renderMonitoringDepartment(incidents)}

      <section class="turn-grid">
        ${renderProjectCatalogCard()}
        ${renderPlatformMapCard()}
        ${renderRegistersSection(language, incidents)}
        ${renderTurnSection(language, 'turn.section.departments', 'turn.section.departmentsDesc', turnDepartments, 'turn-departments')}
        ${renderTurnSection(language, 'turn.section.agents', 'turn.section.agentsDesc', turnAgents, 'turn-agents')}
        ${renderAgentGovernanceSection(language)}
        ${renderTurnSection(language, 'turn.section.modules', 'turn.section.modulesDesc', turnModules, 'turn-modules')}
        ${renderTurnMissionSection(language, 'turn.section.missions', 'turn.section.missionsDesc', turnMissions, 'turn-missions')}
        ${renderTurnMissionSection(language, 'turn.section.validations', 'turn.section.validationsDesc', turnAuditTrail)}
        <article class="turn-card turn-system-card" id="turn-system">
          <header>
            <strong>${escapeHtml(t(language, 'turn.section.system'))}</strong>
            <p>${escapeHtml(t(language, 'turn.section.systemDesc'))}</p>
          </header>
          <dl class="turn-system-list">
            <div>
              <dt>${escapeHtml(t(language, 'turn.system.version'))}</dt>
              <dd>${escapeHtml(appVersion)}</dd>
            </div>
            <div>
              <dt>${escapeHtml(t(language, 'turn.system.build'))}</dt>
              <dd>${escapeHtml(t(language, 'turn.status.stable'))}</dd>
            </div>
            <div>
              <dt>${escapeHtml(t(language, 'turn.system.backend'))}</dt>
              <dd>${escapeHtml(t(language, 'turn.system.backendReadonly'))}</dd>
            </div>
            <div>
              <dt>${escapeHtml(t(language, 'turn.system.ai'))}</dt>
              <dd>${escapeHtml(t(language, 'turn.system.aiReadonly'))}</dd>
            </div>
          </dl>
        </article>
      </section>
      ${renderMaintenanceDepartment(language)}
      </section>
      <button id="turnBackToTop" class="turn-back-to-top" type="button" hidden aria-label="Înapoi sus">↑ Înapoi sus</button>
    </section>
  `;
}

function renderFunctionalOverview() {
  return `<div id="turn-functional-overview" data-turn-functional-overview aria-live="polite" aria-busy="true">
    <section class="turn-spatial-page turn-basic-spatial-page" data-turn-page="basic" aria-labelledby="turn-functional-overview-title">
      <header><div><span class="turn-kicker">PAGINA 1 · BASIC · LIVE FUNCTIONAL VALUE</span><h2 id="turn-functional-overview-title">BASIC operational space</h2><p>Fiecare zonă este proiectată din EventStore/API și evaluatorul funcțional. Click pe un nod pentru sursă, lipsă și acțiune.</p></div><strong data-functional-verdict>SE ÎNCARCĂ</strong></header>
      <section class="turn-approved-orbital-panel basic" data-basic-operational-orbit data-orbital-source="PENDING_REAL_SOURCE" aria-labelledby="turn-basic-orbit-title">
        <header>
          <div><span class="turn-kicker">TURN · APPROVED VISUAL SOURCE</span><h3 id="turn-basic-orbit-title">AGM TURN BASIC AGENT / CAPABILITY CONTROL PANEL</h3><p>Fiecare planetă reprezintă o capabilitate sau un agent Basic și este alimentată exclusiv de evaluatorul funcțional real.</p></div>
          <p class="turn-orbital-legend"><strong>Criteriu vizual:</strong> verde = operațional/observat, galben = atenție, roșu = failed/capability missing, albastru = fără activitate/referință statică, gri = UNKNOWN legitim. Culoarea nu este derivată din registry.</p>
        </header>
        <nav class="turn-orbital-criteria" data-basic-orbital-criteria aria-label="Criteriul de colorare Basic">
          <button type="button" data-basic-orbital-criterion="functional" aria-selected="true">Stare funcțională</button>
          <button type="button" data-basic-orbital-criterion="telemetry" aria-selected="false">Telemetrie</button>
          <button type="button" data-basic-orbital-criterion="procedural" aria-selected="false">Procedură / acțiune</button>
          <button type="button" data-basic-orbital-criterion="component" aria-selected="false">Componentă / sursă</button>
          <button type="button" data-basic-orbital-criterion="incidents" aria-selected="false">Incidente / atenții</button>
          <button type="button" data-basic-orbital-criterion="freshness" aria-selected="false">Freshness</button>
        </nav>
        <p class="turn-orbital-criterion-message" data-basic-orbital-criterion-message>Se încarcă evaluatorul funcțional real…</p>
        <div class="turn-approved-orbital-stage" data-basic-orbital-stage aria-busy="true"><p>Se citesc sursele reale autorizate…</p></div>
        <section class="turn-orbital-criterion-maps" data-basic-orbital-criterion-maps aria-label="Hărți planetare Basic pe criterii"></section>
        <aside class="turn-approved-orbital-selection" data-basic-orbital-selection><p>Selectează o planetă BASIC pentru sursă, motiv și acțiune.</p></aside>
      </section>
      <div class="turn-spatial-summary" data-basic-spatial-summary><span>Se citesc sursele reale autorizate…</span></div>
      <div class="turn-spatial-stage turn-basic-stage" data-basic-spatial-stage aria-busy="true"></div>
      <aside class="turn-spatial-selection" data-basic-spatial-selection><p>Selectează o zonă BASIC.</p></aside>
      ${renderBasicOperationalEntries()}
      <p class="turn-functional-generated" data-functional-generated-at>Se solicită proiecția live…</p>
    </section>
    <section class="turn-functional-overview turn-functional-drilldown" data-turn-page="investigate" hidden aria-labelledby="turn-functional-drilldown-title">
      <header><div><span class="turn-kicker">DRILL-DOWN · BASIC + PREMIUM</span><h2 id="turn-functional-drilldown-title">Informație, sursă, acțiune și limită</h2><p>Tabelele și cardurile detaliate sunt instrumente de investigație, nu suprafața principală TURN.</p></div><strong data-functional-drilldown-verdict>PRODUCT OWNER ACCEPTANCE NOT_GRANTED</strong></header>
      <div class="turn-functional-summary" data-functional-summary><article><small>Stare</small><strong>SE ÎNCARCĂ</strong></article></div>
      <div data-functional-zones><p>Se citesc exclusiv sursele reale autorizate…</p></div>
    </section>
  </div>`;
}

function renderBasicOperationalEntries() {
  const entries = [
    ['p9', 'P9 Operational Board', 'OPERATIONAL_EVIDENCE · runtime + smoke + policy', 'investigate', 'turn-p9'],
    ['event-store', 'EventStore / Incident Evidence', 'AuthorityAuditJournal · incidente persistente', 'incidents', 'turn-incident-page-title'],
    ['canonical-agent-registry', 'Registrul Oficial de Agenți', 'REGISTRY ONLY · identitate, rol, departament', 'investigate', 'turn-agent-register'],
    ['organization-chart', 'Organization Chart', 'Lanț oficial de coordonare și escaladare', 'investigate', 'turn-structure'],
    ['departments', 'Departamente', 'Responsabilități declarative, separat de runtime', 'investigate', 'turn-departments'],
    ['agent-control-panel', 'TURN Agent Control Panel', 'Panou de intrare în metadatele agenților', 'investigate', 'turn-agent-control-panel'],
  ] as const;
  return `<section class="turn-operational-entry-points" aria-labelledby="turn-operational-entry-title">
    <header><div><span class="turn-kicker">ACCES DIRECT · INSTRUMENTE TURN</span><h3 id="turn-operational-entry-title">Agenți, departamente, P9 și evidence</h3></div><p>Intrările deschid instrumentul solicitat; registry rămâne separat de starea runtime.</p></header>
    <nav aria-label="Intrări operaționale secundare">${entries.map(([id, label, source, page, target]) => `<a href="#${target}" data-open-turn-page="${page}" data-operational-entry="${id}" data-operational-entry-target="${target}"><strong>${label}</strong><small>${source}</small><span>DESCHIDE →</span></a>`).join('')}</nav>
  </section>`;
}

function renderOperationalProtocol() {
  return `<section class="turn-operational-protocol" id="turn-protocol" aria-labelledby="turn-protocol-title">
    <header><div><span class="turn-kicker">AGM · OPERATIONAL BASELINE</span><h2 id="turn-protocol-title">PROTOCOL OPERAȚIONAL AGM</h2><p>OWNER APPROVED / OPERATIONAL BASELINE · Versiunea 1.0 · 21 august 2026</p></div><span class="protocol-status">MANDATORY · READ FIRST</span></header>
    <p>Protocol obligatoriu înainte de recovery, incident, runtime, Task Scheduler, Docker, secrets/DPAPI, API, restart, deploy, P9, Production, monitorizare sau recovery după update.</p>
    <p class="protocol-gates"><strong>Gate-uri:</strong> READ-ONLY → KNOWN-GOOD → ROOT CAUSE → MINIMAL PATCH → STATIC PASS → RUNTIME PASS → HEALTH PASS → STABILITY → RESTART TEST → FINAL VERDICT</p>
    <div class="protocol-actions"><a class="protocol-link" href="/operations/AGM_Protocol_Operational_Autonom_v1.0.txt" target="_blank" rel="noreferrer">Deschide AGM Protocol Operațional Autonom v1.0</a><a href="#turn-operations">Recovery / Operations</a></div>
    <small>Regulă: nu se improvizează; se consultă protocolul. PASS intermediar ≠ mandat închis: Release &amp; Operations duce rezultatul până la deploy, rutare, runtime, health, stability și verdict final. Țintă: OWNER ACTION: NONE.</small>
  </section>`;
}

function renderTurnRealityContract() {
  const live = monitoringHealthSources.filter((source) => source.kind === 'http').length;
  const staticSources = monitoringHealthSources.filter((source) => source.kind === 'static').length;
  const aggregate = monitoringHealthSources.filter((source) => source.kind === 'aggregate').length;
  return `<section class="turn-reality-contract" id="turn-reality" aria-labelledby="turn-reality-title">
    <header><div><span class="turn-kicker">TURN · DATA QUALITY</span><h2 id="turn-reality-title">Stare reală, nu status decorativ</h2></div><strong>LIVE COVERAGE: ${live} · STATIC: ${staticSources} · AGGREGATE: ${aggregate}</strong></header>
    <p>Indicatorii HTTP sunt verificați automat la 30s și devin STALE după 90s. Sursele fără collector runtime rămân explicit configurate/static și nu pot produce PASS live.</p>
    <dl><div><dt>Health / runtime</dt><dd>API live/ready și dependențe: telemetrie HTTP actuală</dd></div><div><dt>Agents / missions</dt><dd>registru de guvernanță; nu reprezintă disponibilitate runtime</dd></div><div><dt>Production</dt><dd>numai din Production Preflight cu timestamp și contract valid</dd></div><div><dt>Evidence</dt><dd>fără timestamp sau sursă actuală: UNKNOWN / NOT REPORTED</dd></div></dl>
  </section>`;
}

export function renderActiveOperationsIncident(incidents: OperationalIncident[]) {
  const active = incidents
    .filter((incident) => !['validated', 'archived'].includes(incident.status))
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.updatedAt.localeCompare(a.updatedAt));
  const incident = active[0];
  if (!incident) return `<section class="active-operations-incident normal" id="turn-alerts"><header><div><span class="turn-kicker">TURN · OPERATIONS</span><h2>Niciun incident activ</h2></div>${renderStatusLight('incident', undefined)}</header><p>Incidentele validate/archivate sunt istorice și nu blochează operațiunile curente.</p></section>`;

  const route = routeIncident(incident);
  const snapshot = currentProductionPreflightSnapshot();
  const passed = snapshot?.checks.filter((check) => check.status === 'PASS').length ?? 0;
  const total = snapshot?.checks.length ?? 0;
  const activations = route ? activateIncidentRoute(route) : [];

  return `<section class="active-operations-incident ${escapeHtml(incident.severity)}" id="turn-alerts" aria-live="polite">
    <header><div><span class="turn-kicker">INCIDENT OPERAȚIONAL ACTIV</span><h2>${escapeHtml(incident.id)} · ${escapeHtml(incident.module)}</h2><p>${escapeHtml(incident.symptom)}</p></div>${renderStatusLight('incident', incident.status)}</header>
    <div class="active-incident-grid">
      <article><strong>Responsabilități activate</strong><dl><div><dt>Owner</dt><dd>${escapeHtml(route?.owner ?? incident.owner)}</dd></div><div><dt>Executor</dt><dd>${escapeHtml(route?.executor ?? 'Nedesemnat')}</dd></div><div><dt>Guardian</dt><dd>${escapeHtml(route?.guardian ?? 'Nedesemnat')}</dd></div><div><dt>Validator</dt><dd>${escapeHtml(route?.validator ?? 'Nedesemnat')}</dd></div></dl><p>${activations.length} activări corelate automat.</p></article>
      <article><strong>Production în timp real</strong><p class="recovery-progress">${snapshot ? `${passed}/${total} verificări PASS · ${snapshot.overallStatus}` : 'Telemetrie preflight indisponibilă'}</p><progress max="${Math.max(total, 1)}" value="${passed}">${passed}/${total}</progress><small>${snapshot ? `Ultima verificare: ${escapeHtml(new Date(snapshot.checkedAt).toLocaleString())}` : 'Starea nu este dedusă.'}</small></article>
      <article id="turn-procedures"><strong>Procedura incidentului curent</strong>${route ? `<p>${escapeHtml(route.recoveryChannel)}</p><ol>${route.procedure.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol><small>${escapeHtml(route.privilegedAction)}</small>` : '<p>Nu există încă o rută executabilă pentru acest incident. Escaladare către Turn Operations.</p>'}</article>
    </div>
    <nav class="central-alert-actions"><a href="#production-preflight">Preflight</a><a href="#incident-journal">Jurnal tehnic</a><a href="#turn-monitoring">Monitorizare</a></nav>
  </section>`;
}

export function renderExecutionReadinessGate(incidents: OperationalIncident[]) {
  const active = incidents.filter((incident) => !['validated', 'archived'].includes(incident.status));
  const snapshot = currentProductionPreflightSnapshot();
  const preflightPass = Boolean(snapshot && snapshot.overallStatus === 'READY' && snapshot.checks.every((check) => check.status === 'PASS'));
  const routes = active.map(routeIncident).filter((route): route is NonNullable<typeof route> => Boolean(route));
  const agents = new Map<string, { role: string; status: 'PASS' | 'HOLD' }>();
  routes.flatMap(activateIncidentRoute).forEach((activation) => agents.set(`${activation.agentId}:${activation.role}`, { role: `${activation.agentId} · ${activation.role}`, status: 'HOLD' }));
  if (!routes.length) {
    ['release-operations · owner', 'secret-credentials-guardian · guardian', 'agent-inspector · validator', 'monitor-incidents · monitor'].forEach((role) => agents.set(role, { role, status: preflightPass ? 'PASS' : 'HOLD' }));
  }
  const ready = executionGateReady(incidents, snapshot) && [...agents.values()].every((agent) => agent.status === 'PASS');
  return `<section class="execution-readiness-gate ${ready ? 'ready' : 'hold'}" id="turn-execution-gate"><header><div><span class="turn-kicker">POARTĂ OBLIGATORIE PRE-EXECUȚIE</span><h2>${ready ? 'GO ELIGIBLE' : 'HOLD — EXECUȚIA ESTE BLOCATĂ'}</h2></div>${renderStatusLight('incident', active[0]?.status)}</header><p>${ready ? 'Condițiile procedurale sunt PASS; execuția este permisă fără autorizare manuală suplimentară a Product Owner-ului.' : 'Gate-ul rămâne blocat numai de incidente confirmate curent sau de Production Preflight neconform.'}</p><div class="execution-agent-verdicts">${[...agents.values()].map((agent) => `<span class="${agent.status.toLowerCase()}">${escapeHtml(agent.role)} · ${agent.status}</span>`).join('')}</div><div class="gate-status-lights">${renderStatusLight('agent', 'AVAILABLE')}${renderStatusLight('target', snapshot?.overallStatus === 'READY' ? 'READY' : snapshot ? 'DEGRADED' : 'UNKNOWN')}</div><dl><div><dt>Production Preflight</dt><dd>${snapshot ? escapeHtml(snapshot.overallStatus) : 'NOT REPORTED'}</dd></div><div><dt>Autorizare execuție</dt><dd>${ready ? 'PERMISĂ AUTOMAT PRIN PROCEDURĂ' : 'INTERZISĂ'}</dd></div></dl></section>`;
}

export function executionGateReady(incidents: OperationalIncident[], snapshot = currentProductionPreflightSnapshot()) {
  const preflightPass = Boolean(snapshot && snapshot.overallStatus === 'READY' && snapshot.checks.every((check) => check.status === 'PASS'));
  return incidents.every((incident) => ['validated', 'archived'].includes(incident.status)) && preflightPass;
}

export function renderOperationsCenter(incidents: OperationalIncident[]) {
  const active = incidents.filter((incident) => !['validated', 'archived'].includes(incident.status));
  return `<section class="operations-center" id="turn-operations" aria-labelledby="operations-center-title"><header><div><span class="turn-kicker">TURN · OPERATIONS</span><h2 id="operations-center-title">Operations Center</h2><p>Starea ecosistemului AGM, cu agentul, ținta și incidentul afișate independent.</p></div><span class="operations-source">Health-check automat · interval 30s · stale după 90s · timeout 5s</span></header><div class="operations-grid">${operationsHealthSources.map((service) => { const incident = active.find((item) => item.module.toLocaleLowerCase().includes(service.label.toLocaleLowerCase().split(' ')[0])); const initialStatus = service.kind === 'static' ? service.staticStatus ?? 'NOT CONFIGURED' : 'UNKNOWN'; const displayStatus = service.displayStatus ?? initialStatus; const state = service.kind === 'static' ? (initialStatus === 'NOT IMPLEMENTED' ? 'not-implemented' : 'unconfigured') : 'attention'; return `<article class="operation-service ${state}" data-operation-id="${escapeHtml(service.id)}"><div class="operation-service-head"><strong class="operation-service-title"><span class="operation-service-icon">⚪</span> ${escapeHtml(service.label)}</strong><span class="operation-service-status">${escapeHtml(displayStatus)}</span></div><dl><div><dt>Agent status</dt><dd>${renderStatusLight('agent', service.kind === 'http' ? 'ACTIVE' : 'DEGRADED', 'operation-agent-status')}</dd></div><div><dt>Target status</dt><dd>${renderStatusLight('target', 'UNKNOWN', 'operation-target-status')}</dd></div><div><dt>Incident status</dt><dd>${renderStatusLight('incident', incident?.status, 'operation-incident-status')}</dd></div><div><dt>Data freshness</dt><dd class="operation-service-freshness">UNKNOWN</dd></div><div><dt>Vârsta datelor</dt><dd class="operation-service-age">—</dd></div><div><dt>Ultima verificare</dt><dd class="operation-service-checked">—</dd></div><div><dt>Timp răspuns</dt><dd class="operation-service-latency">—</dd></div><div><dt>Sursa</dt><dd>${escapeHtml(service.source)}</dd></div><div><dt>Ultima schimbare</dt><dd class="operation-service-changed">—</dd></div><div><dt>Incident asociat</dt><dd>${incident ? `<a href="#incident-${escapeHtml(incident.id)}">${escapeHtml(incident.id)}</a>` : 'Niciun incident activ'}</dd></div></dl>${incident ? `<p class="operation-cause">${escapeHtml(incident.symptom)}</p>` : ''}<div class="operation-actions"><button type="button" data-operation-recheck="${escapeHtml(service.id)}" ${service.kind === 'http' ? '' : 'disabled'}>Reverifică</button><a href="#turn-procedures">SOP</a><a href="#incident-journal">Jurnal</a>${incident ? `<a href="#incident-${escapeHtml(incident.id)}">Incident</a>` : ''}</div></article>`; }).join('')}</div></section>`;
}

export function renderCentralAlertPanel(incidents: OperationalIncident[]) {
  const open = incidents.filter((incident) => !['validated', 'archived'].includes(incident.status)).sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  const archived = incidents.filter((incident) => ['validated', 'archived'].includes(incident.status)).length;
  const highest = open[0];
  const label = highest ? (highest.severity === 'critical' ? '🔴 CRITIC' : highest.severity === 'major' ? '🟠 IMPORTANT' : highest.severity === 'minor' ? '🟡 ATENȚIE' : '🟢 NORMAL') : '🟢 NORMAL';
  return `<section class="central-alert-panel ${highest?.severity ?? 'normal'}" id="turn-alerts" aria-live="polite"><div class="central-alert-summary"><strong>${label}</strong><span>${open.length} alerte active · ${archived} incidente validate/arhivate</span></div>${open.length ? `<div class="central-alert-list">${open.slice(0, 5).map((incident) => `<article class="central-alert-item ${incident.severity}"><div><strong>${escapeHtml(incident.id)} · ${escapeHtml(incident.module)}</strong><span>${escapeHtml(incident.owner)} · ${escapeHtml(new Date(incident.occurredAt).toLocaleString())}</span></div><div class="central-alert-actions"><a href="#incident-journal">Deschide incidentul</a><a href="#turn-procedures">Vezi procedura</a><a href="#incident-journal">Jurnal tehnic</a></div></article>`).join('')}</div>` : ''}</section>`;
}

function severityRank(severity: OperationalIncident['severity']) {
  return severity === 'critical' ? 4 : severity === 'major' ? 3 : severity === 'minor' ? 2 : 1;
}

function renderOrganizationMapSection(language: UiLanguage) {
  const grouped = new Map<string, AgentGovernanceRecord[]>();
  agentGovernanceRegistry.map((agent) => ({ ...agent, status: 'planned' as const })).forEach((agent) => {
    const list = grouped.get(agent.ownerDepartmentId) ?? [];
    list.push(agent);
    grouped.set(agent.ownerDepartmentId, list);
  });
  const departmentLabel = (id: string) => id.replace(/[-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  return `<article class="turn-card organization-map-card" id="turn-organization"><header><div><span class="turn-kicker">TURN · AGENT DIRECTORY</span><strong>Registrul organizațional AGM</strong><p>Identități, departamente și responsabilități aprobate; acest registru nu afirmă stare runtime.</p></div>${renderStatusLight('agent', undefined, 'turn-network-status')}</header><div class="organization-map"><div class="organization-root"><strong>Product Owner / AGM</strong><span>Aprobă direcția și închiderea etapelor</span></div>${[...grouped.entries()].map(([department, agents]) => `<section class="organization-department"><h3>${escapeHtml(departmentLabel(department))}</h3><div class="organization-agents">${agents.map((agent) => `<details class="organization-agent" data-agent-directory-id="${escapeHtml(agent.id)}"><summary><strong>${escapeHtml(agent.displayName ?? t(language, agent.nameKey))}</strong><span class="turn-status planned">REGISTRY ONLY</span></summary><dl><div><dt>Rol</dt><dd>${escapeHtml(agent.displayRole ?? t(language, agent.roleKey))}</dd></div><div><dt>Responsabilități</dt><dd>${escapeHtml(agent.displayResponsibilities ?? t(language, agent.responsibilitiesKey))}</dd></div><div><dt>Flux</dt><dd>Primește → execută → raportează → verifică</dd></div></dl></details>`).join('')}</div></section>`).join('')}</div></article>`;
}

function agentDisplayName(language: UiLanguage, agent: AgentGovernanceRecord) {
  return agent.displayName ?? t(language, agent.nameKey);
}

function agentDisplayRole(language: UiLanguage, agent: AgentGovernanceRecord) {
  return agent.displayRole ?? t(language, agent.roleKey);
}

function departmentDisplayName(id: string) {
  const names: Record<string, string> = {
    'ai-agents': 'Rețeaua AI',
    'architecture-platform': 'Arhitectură & Platformă',
    'backend-infrastructure': 'Backend & Infrastructură',
    'documentation-knowledge': 'Documentație & Cunoaștere',
    'frontend-experience': 'Frontend & Experiență',
    'maintenance-quality-evolution': 'Mentenanță, Calitate & Evoluție',
    monitoring: 'Monitorizare independentă',
    'product-roadmap': 'Produs & Roadmap',
    'qa-validation': 'QA & Validare',
    'release-operations': 'Release & Operations',
    'security-legal': 'Securitate & Legal',
  };
  return names[id] ?? id.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderApprovedTurnDashboard(language: UiLanguage) {
  const approvedAgents = agentGovernanceRegistry.filter((agent) => agent.id !== 'p9-copilot-control-plane');
  const statusCounts = agentGovernanceRegistry.reduce(
    (counts, agent) => ({ ...counts, [agent.status]: (counts[agent.status] ?? 0) + 1 }),
    {} as Record<string, number>,
  );
  const departments = [...new Set(agentGovernanceRegistry.map((agent) => agent.ownerDepartmentId))];
  const aiAgents = agentGovernanceRegistry.filter((agent) => agent.ownerDepartmentId === 'ai-agents');
  const p9 = aiAgents.find((agent) => agent.id === 'p9-copilot-control-plane');
  const independentMonitor = turnOrganizationAgents.find((agent) => agent.id === 'chief-monitoring-inspector');

  return `<section class="turn-agent-dashboard" id="turn-dashboard" aria-labelledby="turn-dashboard-title" data-agent-count="${approvedAgents.length}" data-p9-count="${p9 ? 1 : 0}">
    <header class="turn-dashboard-header">
      <div><span class="turn-kicker">TURN · SECONDARY GOVERNANCE REFERENCE</span><h2 id="turn-dashboard-title">Registrul de guvernanță</h2><p>Referință secundară pentru arhitectură și responsabilități. Starea funcțională Product Owner provine exclusiv din proiecția live de mai sus.</p></div>
      <div class="turn-dashboard-verdict"><span class="turn-light planned" aria-hidden="true"></span><strong>${approvedAgents.length} AGENȚI + P9</strong><small>REGISTRY ONLY · fără afirmație runtime</small></div>
    </header>

    <section class="turn-entry-panel" id="turn-agent-control-panel" aria-labelledby="turn-entry-title">
      <header><div><span class="turn-kicker">PANOU DE INTRARE · REGISTRY METADATA</span><h3 id="turn-entry-title">Clasificarea din registru — nu stare runtime</h3></div><dl><div><dt>Înregistrați ca active</dt><dd>${statusCounts.active ?? 0}</dd></div><div><dt>Înregistrați pentru monitorizare</dt><dd>${statusCounts.monitoring ?? 0}</dd></div><div><dt>Planificați</dt><dd>${statusCounts.planned ?? 0}</dd></div></dl></header>
      <div class="turn-agent-light-grid">${agentGovernanceRegistry.map((agent) => `<div class="turn-agent-light" data-entry-agent-id="${escapeHtml(agent.id)}" title="${escapeHtml(agentDisplayRole(language, agent))}"><span class="turn-light planned" aria-hidden="true"></span><span><strong>${escapeHtml(agent.code)}</strong><small>${escapeHtml(agentDisplayName(language, agent))}</small></span><b>REGISTRY ONLY</b></div>`).join('')}</div>
    </section>

    <section class="turn-wide-board" aria-labelledby="turn-architecture-title">
      <header><div><span class="turn-kicker">ARHITECTURĂ ȘI GUVERNANȚĂ</span><h3 id="turn-architecture-title">Lanțul complet de autoritate</h3></div><span>4 niveluri · ${departments.length} domenii</span></header>
      <div class="turn-command-chain">
        <article class="authority product-owner"><small>NIVEL 1 · AUTORITATE</small><strong>PRODUCT OWNER / TURN COMMANDER</strong><p>Direcție, prioritizare și acceptare fizică finală.</p></article>
        <span class="chain-arrow">→</span>
        <article class="authority atlas"><small>NIVEL 2 · EXECUȚIE</small><strong>ATLAS · COORDONARE OPERAȚIONALĂ</strong><p>Planifică, orchestrează și raportează implementarea.</p></article>
        <span class="chain-arrow">→</span>
        <article class="authority departments"><small>NIVEL 3 · RESPONSABILITATE</small><strong>${departments.length} DOMENII OPERAȚIONALE</strong><p>Execută prin proceduri, acces controlat și escaladare.</p></article>
      </div>
      <div class="turn-governance-rails">
        <article><strong>Guvernanță obligatorie</strong><p>Mandat → owner → executor → guardian → validator → evidence → acceptare Product Owner.</p></article>
        <article><strong>Separarea atribuțiilor</strong><p>Atlas coordonează execuția; monitorizarea verifică independent și nu își validează propria activitate.</p></article>
        <article><strong>Regulă de escaladare</strong><p>L1 observație · L2 incident operațional · L3 Inspector/Atlas · L4 Turn Commander.</p></article>
        <article><strong>Control de schimbare</strong><p>Read-only implicit; intervențiile cer trasabilitate, rollback și dovadă verificabilă.</p></article>
      </div>
      <div class="turn-network-grid">${departments.map((department) => {
        const agents = agentGovernanceRegistry.filter((agent) => agent.ownerDepartmentId === department);
        return `<article class="turn-network-department ${department === 'ai-agents' ? 'ai-network' : ''}"><header><strong>${escapeHtml(departmentDisplayName(department))}</strong><span>${agents.length}</span></header><div>${agents.map((agent) => `<span class="network-agent ${agent.id === 'p9-copilot-control-plane' ? 'p9-network-node' : ''}"><i class="turn-light planned"></i><b>${escapeHtml(agent.code)}</b><small>${escapeHtml(agentDisplayName(language, agent))} · REGISTRY ONLY</small></span>`).join('')}</div>${department === 'ai-agents' && p9 ? `<aside class="p9-network-position"><strong>P9 · CONTROL-PLANE INTERN</strong><span>Poziție: Rețeaua AI → orchestrare Copilot → execuție read-only</span><small>Proiecția operațională P9 este afișată în suprafața principală de mai sus.</small></aside>` : ''}</article>`;
      }).join('')}</div>
    </section>

    <section class="turn-independent-monitor" aria-labelledby="turn-independent-monitor-title">
      <div class="independent-monitor-seal"><span class="turn-light monitoring"></span><strong>CONTROL INDEPENDENT</strong></div>
      <div><span class="turn-kicker">RAPORTEAZĂ DIRECT TURN COMMANDER-ULUI</span><h3 id="turn-independent-monitor-title">${escapeHtml(independentMonitor?.name ?? 'Inspector Șef Monitorizare')} · CHIEF-MONITORING-INSPECTOR</h3><p>Coordonează independent MON-001–MON-012; MON-010 rămâne exclusiv Agent Monitorizare Incidente.</p></div>
      <dl><div><dt>Independență</dt><dd>Oversight</dd></div><div><dt>Escaladare</dt><dd>L3 → L4</dd></div><div><dt>Autovalidare</dt><dd>Interzisă</dd></div></dl>
    </section>

    <section class="turn-agent-register" id="turn-agent-register" aria-labelledby="turn-agent-register-title">
      <header><div><span class="turn-kicker">REGISTRU CANONIC COMPLET</span><h3 id="turn-agent-register-title">Tabelul celor ${approvedAgents.length} de agenți</h3></div><strong>${agentGovernanceRegistry.length} poziții</strong></header>
      <div class="turn-agent-table-wrap"><table><thead><tr><th>#</th><th>Semnal</th><th>Cod</th><th>Agent</th><th>Rol</th><th>Departament</th><th>Stare</th></tr></thead><tbody>${approvedAgents.map((agent, index) => `<tr data-agent-row-id="${escapeHtml(agent.id)}"><td>${index + 1}</td><td><span class="turn-light planned" aria-label="registry only"></span></td><td><code>${escapeHtml(agent.code)}</code></td><td><strong>${escapeHtml(agentDisplayName(language, agent))}</strong></td><td>${escapeHtml(agentDisplayRole(language, agent))}</td><td>${escapeHtml(departmentDisplayName(agent.ownerDepartmentId))}</td><td><span class="turn-status planned">REGISTRY ONLY</span></td></tr>`).join('')}</tbody></table></div>
    </section>

    <div class="turn-dashboard-detail">${renderTurnOrganizationChart()}</div>
  </section>`;
}

function renderProjectCatalogCard() {
  const entries = [
    ['AGM Cockpit', 'apps/web/src/main.ts', 'baseline/agm-basic-v1', '7670640a7a8cdcd49418bfc85079c33105094d78', '/turn', 'http://localhost:5173/turn', 'https://app.agmcockpit.com/'],
    ['Turn Command Center', 'apps/web/src/turn-command-center.view.ts', 'feature/post-basic-turn-architecture-audit', 'c362476b358c11c16d8834a176f7aa01a8f45745', '/turn', 'http://localhost:5173/turn', 'https://app.agmcockpit.com/turn'],
    ['AGM Cockpit Web', 'agmcockpit-website/src/pages/index.astro', 'feature/post-contest-functions-v02', '708f1dfad0c1d7e6027837a6ca24594cfd229db4', '/', 'http://localhost:4321/', 'neconfigurat'],
    ['Version Custodian', 'agmcockpit-website/governance/version-registry.json', 'feature/post-contest-functions-v02', '6558c0e4c9b454d05ac4f96b0c2774d3411417fe', 'registru', 'local repository', 'neconfigurat'],
    ['Architecture Inspector', 'agmcockpit-website/inspectors/architecture-map.json', 'feature/post-contest-functions-v02', '6558c0e4c9b454d05ac4f96b0c2774d3411417fe', 'registru', 'local repository', 'neconfigurat'],
    ['Email Assistant', 'apps/web/src/main.ts + apps/web/src/mailmaster', 'baseline/agm-basic-v1', '7670640a7a8cdcd49418bfc85079c33105094d78', '/email', 'http://localhost:5173/email', 'https://app.agmcockpit.com/email'],
    ['Transfer Android → aplicație e-mail', 'apps/web/src/native-email.ts + AgmEmailPlugin.java', 'baseline/agm-basic-v1', 'validat practic', '/email', 'ACTION_SENDTO + mailto:', 'Gmail finalizează expedierea'],
  ];
  return `<article class="turn-card project-catalog-card"><header><strong>Catalog istoric proiect · Unde găsesc?</strong><p>Referințe statice pentru localizarea codului; nu reprezintă branch-ul, commitul sau starea runtime curentă.</p></header><label class="catalog-search"><span>Caută componentă, agent, URL, branch istoric, commit istoric, fișier, misiune sau incident</span><input id="projectCatalogSearch" type="search" placeholder="Ex.: Turn, /turn, AG-017" /></label><div id="projectCatalogResults" class="project-catalog-list">${entries.map(([name, file, branch, commit, route, localUrl, publicUrl]) => `<details class="catalog-entry" data-search="${[name, file, branch, commit, route, localUrl, publicUrl].join(' ').toLocaleLowerCase()}"><summary><strong>${name}</strong><span>STATIC REFERENCE</span></summary><dl><div><dt>Fișier sursă</dt><dd><code>${file}</code></dd></div><div><dt>Branch / commit istoric</dt><dd><code>${branch}</code><br /><code>${commit}</code></dd></div><div><dt>Rută / URL local istoric</dt><dd><code>${route}</code> · ${localUrl}</dd></div><div><dt>URL public de referință</dt><dd>${publicUrl}</dd></div><div><dt>Limită</dt><dd>Architecture Map / Version Registry; fără afirmație runtime.</dd></div></dl></details>`).join('')}</div></article>`;
}

function renderPlatformMapCard() {
  const entries = [
    ['AGM Cockpit', 'AGM', 'baseline/agm-basic-v1', '7670640a7a8cdcd49418bfc85079c33105094d78', 'apps/web', 'https://app.agmcockpit.com/'],
    ['AGM Cockpit Web', 'agmcockpit-website', 'feature/post-contest-functions-v02', '708f1dfad0c1d7e6027837a6ca24594cfd229db4', 'src/pages/index.astro', 'http://localhost:4321/'],
    ['AGM API', 'AGM', 'baseline/agm-basic-v1', '7670640a7a8cdcd49418bfc85079c33105094d78', 'apps/api/src', 'https://api.agmcockpit.com/api/v1'],
  ];
  return `<article class="turn-card platform-map-card" id="turn-architecture"><header><strong>Harta platformei</strong><p>Repository, branch, baseline, rute și URL-uri canonice.</p></header><div class="platform-map-list">${entries.map(([name, repo, branch, commit, path, url]) => `<details><summary><strong>${name}</strong><span>${repo}</span></summary><dl><div><dt>Branch</dt><dd><code>${branch}</code></dd></div><div><dt>Commit</dt><dd><code>${commit}</code></dd></div><div><dt>Fișiere principale</dt><dd><code>${path}</code></dd></div><div><dt>URL</dt><dd><a href="${url}" target="_blank" rel="noreferrer">${url}</a></dd></div></dl></details>`).join('')}</div></article>`;
}

function renderRegistersSection(language: UiLanguage, incidents: OperationalIncident[]) {
  const openIncidents = incidents.filter((incident) => !['validated', 'archived'].includes(incident.status)).length;
  const inspectorHistoryEntries = inspectorReports.reduce((total, report) => total + report.alertHistory.length, 0);
  const closures = operationalClosureRegistry;

  return `
    <article class="turn-card turn-system-card" id="turn-registers">
      <header>
        <strong>Registre operaționale</strong>
        <p>Index read-only al registrelor existente în Turn Command Center.</p>
      </header>
      <dl class="turn-system-list">
        <div>
          <dt>Registrul agenților</dt>
          <dd>${agentGovernanceRegistry.length} înregistrări · <a href="#turn-agents">Deschide Agents</a></dd>
        </div>
        <div>
          <dt>Registrul incidentelor</dt>
          <dd>${incidents.length} total · ${openIncidents} deschise · <a href="#incident-journal">Deschide Incidents</a></dd>
        </div>
        <div>
          <dt>Registrul închiderilor operaționale</dt>
          <dd>${closures.length} înregistrări · ${closures.map((item) => `${escapeHtml(item.id)} (${escapeHtml(item.status)})`).join(', ')}</dd>
        </div>
        <div>
          <dt>Istoric alerte Inspector</dt>
          <dd>${inspectorHistoryEntries} înregistrări · <a href="#turn-alerts">Deschide Alerts</a></dd>
        </div>
        <div>
          <dt>Registrul misiunilor</dt>
          <dd>${turnMissions.length} misiuni · ${turnAuditTrail.length} validări · <a href="#turn-missions">Deschide Missions</a></dd>
        </div>
      </dl>
      ${closures.map((closure) => `<details class="register-closure"><summary><strong>${escapeHtml(closure.incidentId)}</strong><span>${escapeHtml(closure.status)}</span></summary><p>${escapeHtml(closure.summary)}</p><dl><div><dt>Checkpoint</dt><dd><code>${escapeHtml(closure.checkpoint)}</code></dd></div><div><dt>Raport</dt><dd><code>${escapeHtml(closure.auditReport)}</code></dd></div><div><dt>Confirmări</dt><dd>${closure.signoffs.map((item) => `${escapeHtml(item.owner)} — ${escapeHtml(item.conclusion)}`).join('<br />')}</dd></div><div><dt>Follow-up</dt><dd>${closure.followUps.map((item) => `<code>${escapeHtml(item.id)}</code> [${escapeHtml(item.status)}] — ${escapeHtml(item.condition)}`).join('<br />')}</dd></div></dl></details>`).join('')}
      <p>${escapeHtml(t(language, 'turn.readOnlyDesc'))}</p>
    </article>
  `;
}

function renderTurnMetric(language: UiLanguage, labelKey: string, value: string, descriptionKey: string, detailsHtml = '') {
  if (detailsHtml) {
    return `
      <details class="turn-metric turn-metric-alerts">
        <summary>
          <strong>${escapeHtml(value)}</strong>
          <span>${escapeHtml(t(language, labelKey))}</span>
          <small>${escapeHtml(t(language, descriptionKey))}</small>
        </summary>
        ${detailsHtml}
      </details>
    `;
  }

  return `
    <article class="turn-metric">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(t(language, labelKey))}</span>
      <small>${escapeHtml(t(language, descriptionKey))}</small>
    </article>
  `;
}

function renderGeneralInspectorReport(language: UiLanguage, counts: Record<InspectorReport['status'], number>) {
  const generalStatus: InspectorReport['status'] = counts.error > 0 ? 'error' : counts.attention > 0 ? 'attention' : 'ok';
  const latestChecks = [...inspectorReports]
    .sort((left, right) => new Date(right.lastCheckedAt).getTime() - new Date(left.lastCheckedAt).getTime())
    .slice(0, 5);

  return `
    <section class="inspector-general-report">
      <p><strong>SNAPSHOT ISTORIC / STALE</strong> · Aceste rapoarte nu reprezintă starea runtime curentă. Ultima verificare: ${escapeHtml(new Date(latestChecks[0]?.lastCheckedAt ?? 0).toLocaleString())}.</p>
      <dl>
        <div>
          <dt>${escapeHtml(t(language, 'inspector.general.platformSituation'))}</dt>
          <dd>${escapeHtml(t(language, `inspector.general.situation.${generalStatus}`))}</dd>
        </div>
        <div>
          <dt>${escapeHtml(t(language, 'inspector.general.statusTotals'))}</dt>
          <dd>
            <span class="inspector-badge ok"><span class="inspector-dot" aria-hidden="true"></span>${escapeHtml(t(language, 'inspector.status.ok'))}: ${counts.ok}</span>
            <span class="inspector-badge attention"><span class="inspector-dot" aria-hidden="true"></span>${escapeHtml(t(language, 'inspector.status.attention'))}: ${counts.attention}</span>
            <span class="inspector-badge error"><span class="inspector-dot" aria-hidden="true"></span>${escapeHtml(t(language, 'inspector.status.error'))}: ${counts.error}</span>
          </dd>
        </div>
        <div>
          <dt>${escapeHtml(t(language, 'inspector.general.codexPriorities'))}</dt>
          <dd>${escapeHtml(t(language, 'inspector.general.codexPrioritiesText'))}</dd>
        </div>
        <div>
          <dt>${escapeHtml(t(language, 'inspector.general.recommendations'))}</dt>
          <dd>${escapeHtml(t(language, 'inspector.general.recommendationsText'))}</dd>
        </div>
        <div>
          <dt>${escapeHtml(t(language, 'inspector.general.trend'))}</dt>
          <dd>${escapeHtml(t(language, `inspector.general.trend.${generalStatus}`))}</dd>
        </div>
      </dl>
      <section class="inspector-general-checks">
        <strong>${escapeHtml(t(language, 'inspector.general.latestChecks'))}</strong>
        <ul>
          ${latestChecks
            .map(
              (report) => `
                <li>
                  <span class="inspector-badge ${report.status}">
                    <span class="inspector-dot" aria-hidden="true"></span>
                    ${escapeHtml(t(language, `inspector.status.${report.status}`))}
                  </span>
                  <time>${escapeHtml(new Date(report.lastCheckedAt).toLocaleString())}</time>
                  <span>${escapeHtml(t(language, report.summaryKey))}</span>
                </li>
              `,
            )
            .join('')}
        </ul>
      </section>
    </section>
  `;
}

function renderTurnSection(language: UiLanguage, titleKey: string, descriptionKey: string, items: TurnCommandItem[], id = '') {
  return `
    <article class="turn-card"${id ? ` id="${id}"` : ''}>
      <header>
        <strong>${escapeHtml(t(language, titleKey))}</strong>
        <p>${escapeHtml(t(language, descriptionKey))}</p>
      </header>
      <div class="turn-list">
        ${items.map((item) => renderTurnItem(language, item)).join('')}
      </div>
    </article>
  `;
}

function renderAgentGovernanceSection(language: UiLanguage) {
  return `
    <article class="turn-card agent-registry-card">
      <header>
        <strong>${escapeHtml(t(language, 'agentRegistry.section.title'))}</strong>
        <p>${escapeHtml(t(language, 'agentRegistry.section.description'))}</p>
      </header>
      <div class="agent-registry-list">
        ${agentGovernanceRegistry.map((agent) => renderAgentGovernanceItem(language, agent)).join('')}
      </div>
    </article>
  `;
}

function renderAgentGovernanceItem(language: UiLanguage, agent: AgentGovernanceRecord) {
  const name = agent.displayName ?? t(language, agent.nameKey);
  const role = agent.displayRole ?? t(language, agent.roleKey);
  const responsibilities = agent.displayResponsibilities ?? t(language, agent.responsibilitiesKey);
  return `
    <details class="agent-registry-row">
      <summary>
        <span class="turn-status planned">REGISTRY ONLY · ${escapeHtml(t(language, `agentRegistry.status.${agent.status}`))}</span>
        <strong>${escapeHtml(name)}</strong>
        <code>${escapeHtml(agent.code)}</code>
      </summary>
      <dl>
        <div>
          <dt>${escapeHtml(t(language, 'agentRegistry.field.identity'))}</dt>
          <dd>${escapeHtml(agent.id)}</dd>
        </div>
        <div>
          <dt>${escapeHtml(t(language, 'agentRegistry.field.role'))}</dt>
          <dd>${escapeHtml(role)}</dd>
        </div>
        <div>
          <dt>${escapeHtml(t(language, 'agentRegistry.field.responsibilities'))}</dt>
          <dd>${escapeHtml(responsibilities)}</dd>
        </div>
        <div>
          <dt>${escapeHtml(t(language, 'agentRegistry.field.ownerDepartment'))}</dt>
          <dd>${escapeHtml(agent.ownerDepartmentId)}</dd>
        </div>
        <div>
          <dt>${escapeHtml(t(language, 'agentRegistry.field.lastValidation'))}</dt>
          <dd>${escapeHtml(t(language, agent.lastValidationKey))}</dd>
        </div>
        <div>
          <dt>${escapeHtml(t(language, 'agentRegistry.field.lastActivity'))}</dt>
          <dd>${escapeHtml(t(language, agent.lastActivityKey))}</dd>
        </div>
        <div>
          <dt>${escapeHtml(t(language, 'agentRegistry.field.reliability'))}</dt>
          <dd>${escapeHtml(t(language, agent.reliabilityKey))}</dd>
        </div>
      </dl>
    </details>
  `;
}

function renderTurnMissionSection(language: UiLanguage, titleKey: string, descriptionKey: string, items: TurnMissionItem[], id = '') {
  return `
    <article class="turn-card"${id ? ` id="${id}"` : ''}>
      <header>
        <strong>${escapeHtml(t(language, titleKey))}</strong>
        <p>${escapeHtml(t(language, descriptionKey))}</p>
      </header>
      <div class="turn-list">
        ${items.map((item) => renderTurnMissionItem(language, item)).join('')}
      </div>
    </article>
  `;
}

function renderTurnItem(language: UiLanguage, item: TurnCommandItem) {
  const inspectorReport = inspectorReportFor(item.id);

  return `
    <details class="turn-row">
      <summary>
        <span class="turn-status planned">REGISTRY ONLY · ${escapeHtml(turnStatusLabel(language, item.status))}</span>
        <strong>${escapeHtml(t(language, item.titleKey))}</strong>
        ${inspectorReport ? renderInspectorBadge(language, inspectorReport) : ''}
      </summary>
      <div>
        <p>${escapeHtml(t(language, item.descriptionKey))}</p>
        ${inspectorReport ? renderInspectorReport(language, inspectorReport) : ''}
      </div>
    </details>
  `;
}

function renderInspectorBadge(language: UiLanguage, report: InspectorReport) {
  const stale = Date.now() - new Date(report.lastCheckedAt).getTime() > 24 * 60 * 60 * 1000;
  return `
    <span class="inspector-badge ${stale ? 'stale' : report.status}" title="${escapeHtml(t(language, 'inspector.openReport'))}">
      <span class="inspector-dot" aria-hidden="true"></span>
      ${stale ? 'STALE · ISTORIC' : escapeHtml(t(language, `inspector.status.${report.status}`))}
    </span>
  `;
}

function renderInspectorReport(language: UiLanguage, report: InspectorReport) {
  return `
    <dl class="inspector-report">
      <div>
        <dt>${escapeHtml(t(language, 'inspector.report.lastAudit'))}</dt>
        <dd>${escapeHtml(t(language, report.auditKey))}</dd>
      </div>
      <div>
        <dt>${escapeHtml(t(language, 'inspector.report.summary'))}</dt>
        <dd>${escapeHtml(t(language, `inspector.generalState.${report.status}`))}</dd>
      </div>
      <div>
        <dt>${escapeHtml(t(language, 'inspector.report.issues'))}</dt>
        <dd>${escapeHtml(t(language, report.issuesKey))}</dd>
      </div>
      <div>
        <dt>${escapeHtml(t(language, 'inspector.report.impact'))}</dt>
        <dd>${escapeHtml(t(language, report.impactKey))}</dd>
      </div>
      <div>
        <dt>${escapeHtml(t(language, 'inspector.report.recommendations'))}</dt>
        <dd>${escapeHtml(t(language, report.recommendationsKey))}</dd>
      </div>
      <div>
        <dt>${escapeHtml(t(language, 'inspector.report.codexPriority'))}</dt>
        <dd>${escapeHtml(t(language, report.priorityKey))}</dd>
      </div>
      <div>
        <dt>${escapeHtml(t(language, 'inspector.report.lastCheck'))}</dt>
        <dd>${escapeHtml(new Date(report.lastCheckedAt).toLocaleString())}</dd>
      </div>
      <div>
        <dt>${escapeHtml(t(language, 'inspector.report.trend'))}</dt>
        <dd>${escapeHtml(t(language, `inspector.trend.${report.trend}`))}</dd>
      </div>
    </dl>
    <section class="inspector-alert-history">
      <strong>${escapeHtml(t(language, 'inspector.report.alertHistory'))}</strong>
      <ol>
        ${report.alertHistory
          .map(
            (alert) => `
              <li>
                <span class="inspector-badge ${alert.status}">
                  <span class="inspector-dot" aria-hidden="true"></span>
                  ${escapeHtml(t(language, `inspector.status.${alert.status}`))}
                </span>
                <time>${escapeHtml(new Date(alert.createdAt).toLocaleString())}</time>
                <p>${escapeHtml(t(language, alert.messageKey))}</p>
              </li>
            `,
          )
          .join('')}
      </ol>
    </section>
  `;
}

function renderTurnMissionItem(language: UiLanguage, item: TurnMissionItem) {
  return `
    <section class="turn-row">
      <span class="turn-status ${item.status}">${escapeHtml(item.id)}</span>
      <div>
        <strong>${escapeHtml(t(language, item.titleKey))}</strong>
        <p>${escapeHtml(t(language, item.validationKey))}</p>
      </div>
    </section>
  `;
}

function countByStatus(items: Array<{ status: TurnHealthStatus }>, status: TurnHealthStatus) {
  return items.filter((item) => item.status === status).length;
}

function countByValidation(items: TurnMissionItem[], validationKey: string) {
  return items.filter((item) => item.validationKey === validationKey).length;
}

function turnStatusLabel(language: UiLanguage, status: TurnHealthStatus) {
  return t(language, `turn.status.${status}`);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
