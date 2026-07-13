import { agentGovernanceRegistry, type AgentGovernanceRecord } from './agent-governance.registry';
import { t } from './i18n/app-i18n';
import { type UiLanguage } from './i18n/app-i18n.types';
import { type InspectorReport, inspectorReportFor, inspectorReports } from './inspector-agent';
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
};

export function renderTurnCommandCenter({ language, appVersion }: TurnCommandCenterViewOptions) {
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

      <section class="turn-grid">
        ${renderTurnSection(language, 'turn.section.departments', 'turn.section.departmentsDesc', turnDepartments)}
        ${renderTurnSection(language, 'turn.section.agents', 'turn.section.agentsDesc', turnAgents)}
        ${renderAgentGovernanceSection(language)}
        ${renderTurnSection(language, 'turn.section.modules', 'turn.section.modulesDesc', turnModules)}
        ${renderTurnMissionSection(language, 'turn.section.missions', 'turn.section.missionsDesc', turnMissions)}
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
    </section>
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

function renderTurnSection(language: UiLanguage, titleKey: string, descriptionKey: string, items: TurnCommandItem[]) {
  return `
    <article class="turn-card">
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
  return `
    <details class="agent-registry-row">
      <summary>
        <span class="turn-status ${agent.status === 'monitoring' ? 'watch' : agent.status === 'planned' ? 'planned' : 'active'}">${escapeHtml(t(language, `agentRegistry.status.${agent.status}`))}</span>
        <strong>${escapeHtml(t(language, agent.nameKey))}</strong>
        <code>${escapeHtml(agent.code)}</code>
      </summary>
      <dl>
        <div>
          <dt>${escapeHtml(t(language, 'agentRegistry.field.identity'))}</dt>
          <dd>${escapeHtml(agent.id)}</dd>
        </div>
        <div>
          <dt>${escapeHtml(t(language, 'agentRegistry.field.role'))}</dt>
          <dd>${escapeHtml(t(language, agent.roleKey))}</dd>
        </div>
        <div>
          <dt>${escapeHtml(t(language, 'agentRegistry.field.responsibilities'))}</dt>
          <dd>${escapeHtml(t(language, agent.responsibilitiesKey))}</dd>
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

function renderTurnMissionSection(language: UiLanguage, titleKey: string, descriptionKey: string, items: TurnMissionItem[]) {
  return `
    <article class="turn-card">
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
