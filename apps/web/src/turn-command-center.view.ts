import { agentGovernanceRegistry, type AgentGovernanceRecord } from './agent-governance.registry';
import { t } from './i18n/app-i18n';
import { type UiLanguage } from './i18n/app-i18n.types';
import { type InspectorReport, inspectorReportFor, inspectorReports } from './inspector-agent';
import { renderIncidentJournal, type IncidentJournalFilters, type OperationalIncident } from './incident-journal';
import { renderMaintenanceDepartment } from './maintenance-department';
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
  const attentionReports = inspectorReports.filter((report) => report.status !== 'ok').length;
  const inspectorStatusCounts = inspectorReports.reduce(
    (counts, report) => {
      counts[report.status] += 1;
      return counts;
    },
    { ok: 0, attention: 0, error: 0 },
  );

  return `
    <section class="turn-command-center" aria-label="${escapeHtml(t(language, 'turn.ariaLabel'))}">
      ${renderCentralAlertPanel(incidents)}
      <header class="turn-hero">
        <div>
          <span class="turn-kicker">${escapeHtml(t(language, 'turn.code'))}</span>
          <h1>${escapeHtml(t(language, 'turn.title'))}</h1>
          <p>${escapeHtml(t(language, 'turn.description'))}</p>
        </div>
        <div class="turn-readonly-badge">
          <strong>${escapeHtml(t(language, 'turn.readOnly'))}</strong>
          <span>${escapeHtml(t(language, 'turn.readOnlyDesc'))}</span>
        </div>
      </header>

      <section class="turn-metrics" aria-label="${escapeHtml(t(language, 'turn.metrics'))}">
        ${renderTurnMetric(language, 'turn.metric.departments', String(activeDepartments), 'turn.metric.departmentsDesc')}
        ${renderTurnMetric(language, 'turn.metric.modules', String(stableModules), 'turn.metric.modulesDesc')}
        ${renderTurnMetric(language, 'turn.metric.missions', String(activeMissions), 'turn.metric.missionsDesc')}
        ${renderTurnMetric(language, 'turn.metric.audits', String(acceptedAudits), 'turn.metric.auditsDesc')}
        ${renderTurnMetric(
          language,
          'turn.metric.attention',
          String(attentionReports),
          'turn.metric.attentionDesc',
          renderGeneralInspectorReport(language, inspectorStatusCounts),
        )}
      </section>

      <nav class="turn-module-nav" aria-label="Turn modules">
        ${['dashboard', 'organization', 'agents', 'missions', 'alerts', 'incidents', 'registers', 'architecture', 'modules', 'documentation', 'system']
          .map((module) => `<a href="#turn-${module}">${module[0].toUpperCase()}${module.slice(1)}</a>`)
          .join('')}
      </nav>

      <section class="turn-grid">
        ${renderProjectCatalogCard()}
        ${renderPlatformMapCard()}
        ${renderTurnSection(language, 'turn.section.departments', 'turn.section.departmentsDesc', turnDepartments, 'turn-dashboard')}
        ${renderTurnSection(language, 'turn.section.agents', 'turn.section.agentsDesc', turnAgents, 'turn-agents')}
        ${renderAgentGovernanceSection(language)}
        ${renderOrganizationMapSection(language)}
        ${renderTurnSection(language, 'turn.section.modules', 'turn.section.modulesDesc', turnModules, 'turn-modules')}
        ${renderTurnMissionSection(language, 'turn.section.missions', 'turn.section.missionsDesc', turnMissions, 'turn-missions')}
        ${renderTurnMissionSection(language, 'turn.section.validations', 'turn.section.validationsDesc', turnAuditTrail)}
        <article class="turn-card turn-system-card">
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
      ${renderIncidentJournal(language, incidents, incidentFilters)}
    </section>
  `;
}

function renderCentralAlertPanel(incidents: OperationalIncident[]) {
  const open = incidents.filter((incident) => !['validated', 'archived'].includes(incident.status)).sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  const highest = open[0];
  const label = highest ? (highest.severity === 'critical' ? '🔴 CRITIC' : highest.severity === 'major' ? '🟠 IMPORTANT' : highest.severity === 'minor' ? '🟡 ATENȚIE' : '🟢 NORMAL') : '🟢 NORMAL';
  return `<section class="central-alert-panel ${highest?.severity ?? 'normal'}" id="turn-alerts" aria-live="polite"><div class="central-alert-summary"><strong>${label}</strong><span>${open.length ? `${open.length} alertă(e) deschisă(e)` : 'Sistem funcțional'}</span></div>${open.length ? `<div class="central-alert-list">${open.slice(0, 5).map((incident) => `<article class="central-alert-item ${incident.severity}"><div><strong>${escapeHtml(incident.id)} · ${escapeHtml(incident.module)}</strong><span>${escapeHtml(incident.owner)} · ${escapeHtml(new Date(incident.occurredAt).toLocaleString())}</span></div><div class="central-alert-actions"><a href="#incident-journal">Deschide incidentul</a><a href="#turn-procedures">Vezi procedura</a><a href="#incident-journal">Jurnal tehnic</a></div></article>`).join('')}</div>` : ''}</section>`;
}

function severityRank(severity: OperationalIncident['severity']) {
  return severity === 'critical' ? 4 : severity === 'major' ? 3 : severity === 'minor' ? 2 : 1;
}

function renderOrganizationMapSection(language: UiLanguage) {
  const grouped = new Map<string, AgentGovernanceRecord[]>();
  agentGovernanceRegistry.forEach((agent) => {
    const list = grouped.get(agent.ownerDepartmentId) ?? [];
    list.push(agent);
    grouped.set(agent.ownerDepartmentId, list);
  });
  const departmentLabel = (id: string) => id.replace(/[-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  return `<article class="turn-card organization-map-card" id="turn-organization"><header><strong>Harta organizațională AGM</strong><p>Departamente, agenți, responsabilități și fluxuri de colaborare.</p></header><div class="organization-map"><div class="organization-root"><strong>Product Owner / AGM</strong><span>Aprobă direcția și închiderea etapelor</span></div>${[...grouped.entries()].map(([department, agents]) => `<section class="organization-department"><h3>${escapeHtml(departmentLabel(department))}</h3><div class="organization-agents">${agents.map((agent) => `<details class="organization-agent"><summary><strong>${escapeHtml(agent.displayName ?? t(language, agent.nameKey))}</strong><span>${escapeHtml(agent.status)}</span></summary><dl><div><dt>Rol</dt><dd>${escapeHtml(agent.displayRole ?? t(language, agent.roleKey))}</dd></div><div><dt>Responsabilități</dt><dd>${escapeHtml(agent.displayResponsibilities ?? t(language, agent.responsibilitiesKey))}</dd></div><div><dt>Flux</dt><dd>Primește → execută → raportează → verifică</dd></div></dl></details>`).join('')}</div></section>`).join('')}</div></article>`;
}

function renderProjectCatalogCard() {
  const entries = [
    ['AGM Cockpit', 'apps/web/src/main.ts', 'baseline/agm-basic-v1', '7670640a7a8cdcd49418bfc85079c33105094d78', '/turn', 'http://localhost:5173/turn', 'https://app.agmcockpit.com/'],
    ['Turn Command Center', 'apps/web/src/turn-command-center.view.ts', 'feature/post-basic-turn-architecture-audit', 'c362476b358c11c16d8834a176f7aa01a8f45745', '/turn', 'http://localhost:5173/turn', 'https://app.agmcockpit.com/turn'],
    ['AGM Cockpit Web', 'agmcockpit-website/src/pages/index.astro', 'feature/post-contest-functions-v02', '708f1dfad0c1d7e6027837a6ca24594cfd229db4', '/', 'http://localhost:4321/', 'neconfigurat'],
    ['Version Guardian', 'agmcockpit-website/guardians/version-registry.json', 'feature/post-contest-functions-v02', '6558c0e4c9b454d05ac4f96b0c2774d3411417fe', 'registru', 'local repository', 'neconfigurat'],
    ['Architecture Guardian', 'agmcockpit-website/guardians/architecture-map.json', 'feature/post-contest-functions-v02', '6558c0e4c9b454d05ac4f96b0c2774d3411417fe', 'registru', 'local repository', 'neconfigurat'],
    ['Email Assistant', 'apps/web/src/main.ts + apps/web/src/mailmaster', 'baseline/agm-basic-v1', '7670640a7a8cdcd49418bfc85079c33105094d78', '/email', 'http://localhost:5173/email', 'https://app.agmcockpit.com/email'],
    ['Transfer Android → aplicație e-mail', 'apps/web/src/native-email.ts + AgmEmailPlugin.java', 'baseline/agm-basic-v1', 'validat practic', '/email', 'ACTION_SENDTO + mailto:', 'Gmail finalizează expedierea'],
  ];
  return `<article class="turn-card project-catalog-card"><header><strong>Catalog proiect · Unde găsesc?</strong><p>Căutare verificabilă în componente, fișiere, branch-uri, commituri și URL-uri.</p></header><label class="catalog-search"><span>Caută componentă, agent, URL, branch, commit, fișier, misiune sau incident</span><input id="projectCatalogSearch" type="search" placeholder="Ex.: Turn, 7670640, /turn, AG-017" /></label><div id="projectCatalogResults" class="project-catalog-list">${entries.map(([name, file, branch, commit, route, localUrl, publicUrl]) => `<details class="catalog-entry" data-search="${[name, file, branch, commit, route, localUrl, publicUrl].join(' ').toLocaleLowerCase()}"><summary><strong>${name}</strong><span>Activ</span></summary><dl><div><dt>Fișier sursă</dt><dd><code>${file}</code></dd></div><div><dt>Branch / commit</dt><dd><code>${branch}</code><br /><code>${commit}</code></dd></div><div><dt>Rută / URL local</dt><dd><code>${route}</code> · ${localUrl}</dd></div><div><dt>URL public</dt><dd>${publicUrl}</dd></div><div><dt>Registru</dt><dd>Architecture Map · Version Registry · Turn</dd></div></dl></details>`).join('')}</div></article>`;
}

function renderPlatformMapCard() {
  const entries = [
    ['AGM Cockpit', 'AGM', 'baseline/agm-basic-v1', '7670640a7a8cdcd49418bfc85079c33105094d78', 'apps/web', 'https://app.agmcockpit.com/'],
    ['AGM Cockpit Web', 'agmcockpit-website', 'feature/post-contest-functions-v02', '708f1dfad0c1d7e6027837a6ca24594cfd229db4', 'src/pages/index.astro', 'http://localhost:4321/'],
    ['AGM API', 'AGM', 'baseline/agm-basic-v1', '7670640a7a8cdcd49418bfc85079c33105094d78', 'apps/api/src', 'https://api.agmcockpit.com/api/v1'],
  ];
  return `<article class="turn-card platform-map-card"><header><strong>Harta platformei</strong><p>Repository, branch, baseline, rute și URL-uri canonice.</p></header><div class="platform-map-list">${entries.map(([name, repo, branch, commit, path, url]) => `<details><summary><strong>${name}</strong><span>${repo}</span></summary><dl><div><dt>Branch</dt><dd><code>${branch}</code></dd></div><div><dt>Commit</dt><dd><code>${commit}</code></dd></div><div><dt>Fișiere principale</dt><dd><code>${path}</code></dd></div><div><dt>URL</dt><dd><a href="${url}" target="_blank" rel="noreferrer">${url}</a></dd></div></dl></details>`).join('')}</div></article>`;
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
        <span class="turn-status ${agent.status === 'monitoring' ? 'watch' : agent.status === 'planned' ? 'planned' : 'active'}">${escapeHtml(t(language, `agentRegistry.status.${agent.status}`))}</span>
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
        <span class="turn-status ${item.status}">${escapeHtml(turnStatusLabel(language, item.status))}</span>
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
  return `
    <span class="inspector-badge ${report.status}" title="${escapeHtml(t(language, 'inspector.openReport'))}">
      <span class="inspector-dot" aria-hidden="true"></span>
      ${escapeHtml(t(language, `inspector.status.${report.status}`))}
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
