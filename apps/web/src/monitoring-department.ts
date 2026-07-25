import { type AgentGovernanceRecord } from './agent-governance.registry';
import { type OperationalIncident } from './incident-journal';
import { monitoringHealthSources } from './operations-health';

type MonitoringAgent = {
  id: string;
  code: string;
  name: string;
  component: string;
  sourceId?: string;
  source: string;
  responsibilities: string;
  intervention: string;
  incidentTerms: string[];
  securityChecks?: string[];
};

export const monitoringAgents: MonitoringAgent[] = [
  {
    id: 'monitor-server-primary', code: 'MON-001', name: 'Agent Monitorizare Server Principal',
    component: 'Server principal și disponibilitate publică', sourceId: 'server-primary',
    source: 'API public · health/live', responsibilities: 'Detectează disponibilitatea serverului principal și latența rutei live.',
    intervention: 'Verifică VPS, Docker, reverse proxy și supervisorul AGM.', incidentTerms: ['server principal', 'infrastructură', 'platformă agm'],
  },
  {
    id: 'monitor-server-backup', code: 'MON-002', name: 'Agent Monitorizare Server Backup',
    component: 'Server backup', sourceId: 'server-backup', source: 'Registru infrastructură · fără endpoint backup',
    responsibilities: 'Confirmă existența și starea endpoint-ului de backup fără a deduce disponibilitatea.',
    intervention: 'Configurează endpoint-ul numai după aprobarea Release & Operations.', incidentTerms: ['server backup', 'backup'],
  },
  {
    id: 'monitor-api', code: 'MON-003', name: 'Agent Monitorizare API',
    component: 'AGM API ready', sourceId: 'api', source: 'API public · health/ready',
    responsibilities: 'Verifică readiness, dependențe și timpul de răspuns al API-ului.',
    intervention: 'Verifică health payload, PostgreSQL, provider AI și serviciul API.', incidentTerms: ['api'],
  },
  {
    id: 'monitor-browser', code: 'MON-004', name: 'Agent Monitorizare Browser',
    component: 'Client Browser AGM', sourceId: 'browser', source: 'Origin AGM curent · UI LIVE',
    responsibilities: 'Verifică încărcarea clientului Browser și sincronizarea cu auditul UI LIVE.',
    intervention: 'Repornește frontend-ul și verifică ruta locală/publică.', incidentTerms: ['browser', 'web'],
  },
  {
    id: 'monitor-android', code: 'MON-005', name: 'Agent Monitorizare Android',
    component: 'Client Android AGM', sourceId: 'android', source: 'Android operațional + ADB/UI LIVE',
    responsibilities: 'Separă funcționarea clientului Android de lipsa telemetriei continue.',
    intervention: 'Conectează ADB și rulează validarea pe dispozitiv fără a expune date.', incidentTerms: ['android'],
  },
  {
    id: 'monitor-ai', code: 'MON-006', name: 'Agent Monitorizare AI',
    component: 'Furnizor AI / traducere', sourceId: 'ai', source: 'API ready · dependencies.translationProvider',
    responsibilities: 'Monitorizează exclusiv starea configurată a furnizorului, fără acces la cheie.',
    intervention: 'Verifică readiness și configurația secretă în mediul protejat.', incidentTerms: ['ai', 'traduc'],
  },
  {
    id: 'monitor-database', code: 'MON-007', name: 'Agent Monitorizare Bază de date',
    component: 'PostgreSQL', sourceId: 'databases', source: 'API ready · dependencies.database',
    responsibilities: 'Monitorizează disponibilitatea bazei de date prin readiness.',
    intervention: 'Verifică Docker, containerul PostgreSQL și persistența volumului.', incidentTerms: ['baza de date', 'postgres', 'docker'],
  },
  {
    id: 'monitor-cloudflare', code: 'MON-008', name: 'Agent Monitorizare Cloudflare / rute publice',
    component: 'Cloudflare și hostname-uri publice', sourceId: 'cloudflare-public',
    source: 'Rută publică Cloudflare · app.agmcockpit.com', responsibilities: 'Verifică accesul public și latența rutei Cloudflare.',
    intervention: 'Verifică DNS, tunnel, ingress și origin fără afișarea credentialelor.', incidentTerms: ['cloudflare', 'rută publică'],
  },
  {
    id: 'monitor-ui-live', code: 'MON-009', name: 'Agent Monitorizare UI LIVE',
    component: 'Audit vizual Desktop/Mobile', sourceId: 'ui-live', source: 'Runner pnpm audit:ui-live',
    responsibilities: 'Corelează HTTP 200, capturile Desktop/Mobile și raportul automat.',
    intervention: 'Rulează auditul izolat și păstrează artefactele în .tmp.', incidentTerms: ['ui live', 'uilive'],
  },
  {
    id: 'monitor-incidents', code: 'MON-010', name: 'Agent Monitorizare Incidente',
    component: 'Registrul incidentelor', source: 'Incident Journal reconciliat după updatedAt',
    responsibilities: 'Distinge incidente active, avertizări, închise și arhivate.',
    intervention: 'Aplică ciclul analiză → remediere → validare → arhivare.', incidentTerms: [],
  },
  {
    id: 'monitor-telemetry', code: 'MON-011', name: 'Agent Monitorizare Telemetrie',
    component: 'Colectare telemetrie continuă', sourceId: 'telemetry',
    source: 'Registru monitorizare · colector neimplementat', responsibilities: 'Semnalează explicit lipsa telemetriei fără a crea incident.',
    intervention: 'Definește colectorul și politica de retenție înainte de activare.', incidentTerms: ['telemetrie'],
  },
  {
    id: 'monitor-security', code: 'MON-012', name: 'Agent de Securitate',
    component: 'Acces, secrete, configurații și integritate', sourceId: 'security',
    source: 'API ready + CORS + controale locale fără secrete', responsibilities: 'Monitorizează accesul Turn, PIN, tentative, CORS, rute, fișiere critice, loguri și capturi.',
    intervention: 'Blochează publicarea, rotește credentialele expuse și deschide incident de securitate.',
    incidentTerms: ['securitate', 'security', 'cors', 'acces'],
    securityChecks: [
      'Turn protejat prin PIN; valoarea PIN nu este afișată.',
      'Limitarea tentativelor este gestionată de serviciul Turn Admin.',
      'Cheile, tokenurile și hash-urile nu sunt citite sau randate.',
      'CORS este verificat prin accesul controlat la API ready.',
      'UI LIVE nu salvează headere, corpuri HTTP sau query-uri sensibile.',
      'Fișierele critice sunt urmărite prin Git și Version Guardian.',
    ],
  },
];

export const monitoringAgentGovernanceRecords: AgentGovernanceRecord[] =
  monitoringAgents.map((agent) => ({
    id: agent.id,
    code: agent.code,
    nameKey: 'agentRegistry.codex.name',
    roleKey: 'agentRegistry.codex.role',
    responsibilitiesKey: 'agentRegistry.codex.responsibilities',
    ownerDepartmentId: 'monitoring',
    status: agent.sourceId === 'telemetry' ? 'planned' : 'monitoring',
    lastValidationKey: 'agentRegistry.codex.validation',
    lastActivityKey: 'agentRegistry.codex.activity',
    reliabilityKey:
      agent.sourceId === 'telemetry'
        ? 'agentRegistry.reliability.planned'
        : 'agentRegistry.reliability.monitoring',
    displayName: agent.name,
    displayRole: agent.component,
    displayResponsibilities: agent.responsibilities,
  }));

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[
      character
    ] || character,
  );
}

function incidentFor(agent: MonitoringAgent, active: OperationalIncident[]) {
  return active.find((incident) => {
    const haystack = `${incident.module} ${incident.symptom}`.toLocaleLowerCase();
    return agent.incidentTerms.some((term) => haystack.includes(term));
  });
}

export function renderMonitoringDepartment(incidents: OperationalIncident[]) {
  const active = incidents.filter(
    (incident) => !['validated', 'archived'].includes(incident.status),
  );
  return `<section class="monitoring-department" id="turn-monitoring" aria-labelledby="monitoring-department-title">
    <header><div><span class="turn-kicker">AGM · DEPARTAMENT PERMANENT</span><h2 id="monitoring-department-title">Departamentul de Monitorizare</h2><p>Sursă unică pentru starea ecosistemului, corelată cu Operations Center, UI LIVE și registrul incidentelor.</p></div><strong>${monitoringAgents.length} agenți</strong></header>
    <div class="monitoring-agent-grid">${monitoringAgents.map((agent) => {
      const source = monitoringHealthSources.find((item) => item.id === agent.sourceId);
      const incident = incidentFor(agent, active);
      const isIncidentAgent = agent.id === 'monitor-incidents';
      const initialStatus = isIncidentAgent
        ? active.length ? `${active.length} ACTIVE` : 'NO ACTIVE INCIDENTS'
        : source?.displayStatus ?? source?.staticStatus ?? 'CHECKING';
      const initialClass = isIncidentAgent
        ? active.length ? 'degraded' : 'online'
        : source?.kind === 'static'
          ? source.staticStatus === 'NOT IMPLEMENTED' ? 'not-implemented' : source.staticStatus === 'READY' ? 'online' : 'unconfigured'
          : 'attention';
      return `<article class="operation-service monitoring-agent ${initialClass}" ${source ? `data-operation-id="${escapeHtml(source.id)}"` : ''}>
        <div class="operation-service-head"><strong class="operation-service-title"><span class="operation-service-icon">${initialClass === 'online' ? '🟢' : '⚪'}</span> ${escapeHtml(agent.name)}</strong><span class="operation-service-status">${escapeHtml(initialStatus)}</span></div>
        <p class="monitoring-agent-component"><strong>Componentă:</strong> ${escapeHtml(agent.component)}</p>
        <dl>
          <div><dt>Ultima verificare</dt><dd class="operation-service-checked">${isIncidentAgent ? new Date().toLocaleString() : '—'}</dd></div>
          <div><dt>Timp răspuns</dt><dd class="operation-service-latency">${isIncidentAgent ? 'N/A' : '—'}</dd></div>
          <div><dt>Sursa datelor</dt><dd>${escapeHtml(agent.source)}</dd></div>
          <div><dt>Incident activ</dt><dd>${incident ? `<a href="#incident-${escapeHtml(incident.id)}">${escapeHtml(incident.id)}</a>` : 'Niciun incident activ'}</dd></div>
          <div><dt>Responsabilitate</dt><dd>${escapeHtml(agent.responsibilities)}</dd></div>
          <div><dt>Procedură</dt><dd>${escapeHtml(agent.intervention)}</dd></div>
          <div><dt>Ultima schimbare</dt><dd class="operation-service-changed">${isIncidentAgent ? new Date().toLocaleString() : '—'}</dd></div>
        </dl>
        ${agent.securityChecks ? `<details class="security-monitor-checks"><summary>Controale Agent de Securitate</summary><ul>${agent.securityChecks.map((check) => `<li>${escapeHtml(check)}</li>`).join('')}</ul><p>Nicio valoare secretă nu este colectată sau afișată.</p></details>` : ''}
        <div class="operation-actions">${source?.kind === 'http' ? `<button type="button" data-operation-recheck="${escapeHtml(source.id)}">Reverifică</button>` : '<button type="button" disabled>Reverificare indisponibilă</button>'}<a href="#incident-journal">Jurnal tehnic</a><a href="#turn-procedures">Procedură</a></div>
      </article>`;
    }).join('')}</div>
  </section>`;
}
