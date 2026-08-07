import { type UiLanguage } from './i18n/app-i18n.types';

export type IncidentEnvironment = 'Web' | 'Android/APK' | 'API' | 'Docker/PostgreSQL' | 'Cloudflare' | 'Wi-Fi/date mobile';
export type IncidentSeverity = 'informational' | 'minor' | 'major' | 'critical';
export type IncidentStatus = 'new' | 'analysis' | 'remediation' | 'ready-test' | 'validated' | 'reopened' | 'archived';
export type IncidentCategory = 'technical' | 'ux' | 'translation' | 'network' | 'security' | 'infrastructure';

export type IncidentHistoryEntry = {
  at: string;
  action: string;
  actor: string;
  fromStatus?: IncidentStatus;
  toStatus: IncidentStatus;
  note: string;
};

export type OperationalIncident = {
  id: string;
  occurredAt: string;
  updatedAt: string;
  module: string;
  environments: IncidentEnvironment[];
  category: IncidentCategory;
  symptom: string;
  severity: IncidentSeverity;
  reproduction: string;
  cause: string;
  attemptedSolutions: string;
  appliedSolution: string;
  owner: string;
  fixedInVersion: string;
  tests: string;
  humanValidation: string;
  preventiveMeasure: string;
  status: IncidentStatus;
  relatedIncidentIds: string[];
  reusableSolution: boolean;
  history: IncidentHistoryEntry[];
};

export type IncidentJournalFilters = {
  query: string;
  module: string;
  severity: '' | IncidentSeverity;
  status: '' | IncidentStatus;
  category: '' | IncidentCategory;
  dateFrom: string;
  dateTo: string;
  version: string;
};

export type IncidentDraft = Omit<OperationalIncident, 'id' | 'updatedAt' | 'history'> & { id?: string };

export const incidentEnvironments: IncidentEnvironment[] = ['Web', 'Android/APK', 'API', 'Docker/PostgreSQL', 'Cloudflare', 'Wi-Fi/date mobile'];
export const incidentSeverities: IncidentSeverity[] = ['informational', 'minor', 'major', 'critical'];
export const incidentStatuses: IncidentStatus[] = ['new', 'analysis', 'remediation', 'ready-test', 'validated', 'reopened', 'archived'];
export const incidentCategories: IncidentCategory[] = ['technical', 'ux', 'translation', 'network', 'security', 'infrastructure'];
export const incidentJournalStorageKey = 'agm.turn.incident-journal.v1';

export function emptyIncidentFilters(): IncidentJournalFilters {
  return { query: '', module: '', severity: '', status: '', category: '', dateFrom: '', dateTo: '', version: '' };
}

export function readIncidentJournal(storage: Storage): OperationalIncident[] {
  const seeded = historicalIncidents();
  try {
    const parsed = JSON.parse(storage.getItem(incidentJournalStorageKey) || '[]') as OperationalIncident[];
    const byId = new Map(seeded.map((item) => [item.id, item]));
    if (Array.isArray(parsed)) {
      parsed.forEach((item) => {
        if (!item?.id) return;
        const local = normalizeIncident(item);
        const official = byId.get(local.id);
        if (!official || local.updatedAt > official.updatedAt) {
          byId.set(local.id, local);
        }
      });
    }
    const incidents = Array.from(byId.values()).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    saveIncidentJournal(storage, incidents);
    return incidents;
  } catch {
    saveIncidentJournal(storage, seeded);
    return seeded;
  }
}

export function saveIncidentJournal(storage: Storage, incidents: OperationalIncident[]) {
  storage.setItem(incidentJournalStorageKey, JSON.stringify(incidents));
}

export function createIncident(draft: IncidentDraft, actor: string, now = new Date()): OperationalIncident {
  if (!draft.environments.length) throw new Error('ENVIRONMENT_REQUIRED');
  const at = now.toISOString();
  const status = draft.status === 'validated' && !hasValidationEvidence(draft) ? 'ready-test' : draft.status;
  return normalizeIncident({
    ...draft,
    id: draft.id || createIncidentId(now),
    occurredAt: draft.occurredAt || at,
    updatedAt: at,
    status,
    history: [{ at, action: 'created', actor, toStatus: status, note: 'Incident înregistrat în jurnal.' }],
  });
}

export function transitionIncident(incident: OperationalIncident, status: IncidentStatus, actor: string, note: string, now = new Date()) {
  if (status === 'validated' && !hasValidationEvidence(incident)) {
    throw new Error('VALIDATION_EVIDENCE_REQUIRED');
  }
  if (incident.status === 'archived' && status !== 'reopened') {
    throw new Error('ARCHIVED_INCIDENT_MUST_BE_REOPENED');
  }
  const at = now.toISOString();
  return normalizeIncident({
    ...incident,
    status,
    updatedAt: at,
    history: [...incident.history, { at, action: status === 'reopened' ? 'reopened' : 'status-changed', actor, fromStatus: incident.status, toStatus: status, note }],
  });
}

export function updateIncident(incident: OperationalIncident, draft: IncidentDraft, actor: string, note: string, now = new Date()) {
  if (!draft.environments.length) throw new Error('ENVIRONMENT_REQUIRED');
  if (draft.status === 'validated' && !hasValidationEvidence(draft)) throw new Error('VALIDATION_EVIDENCE_REQUIRED');
  if (incident.status === 'archived' && draft.status !== 'reopened') throw new Error('ARCHIVED_INCIDENT_MUST_BE_REOPENED');
  const at = now.toISOString();
  return normalizeIncident({
    ...incident,
    ...draft,
    id: incident.id,
    updatedAt: at,
    history: [...incident.history, { at, action: 'updated', actor, fromStatus: incident.status, toStatus: draft.status, note: note || 'Fișa incidentului a fost actualizată.' }],
  });
}

export function filterIncidents(incidents: OperationalIncident[], filters: IncidentJournalFilters) {
  const query = normalizeSearch(filters.query);
  return incidents.filter((item) => {
    const haystack = normalizeSearch([item.id, item.module, item.symptom, item.cause, item.appliedSolution, item.preventiveMeasure, item.owner, item.fixedInVersion].join(' '));
    return (!query || haystack.includes(query)) &&
      (!filters.module || normalizeSearch(item.module).includes(normalizeSearch(filters.module))) &&
      (!filters.severity || item.severity === filters.severity) &&
      (!filters.status || item.status === filters.status) &&
      (!filters.category || item.category === filters.category) &&
      (!filters.version || normalizeSearch(item.fixedInVersion).includes(normalizeSearch(filters.version))) &&
      (!filters.dateFrom || item.occurredAt.slice(0, 10) >= filters.dateFrom) &&
      (!filters.dateTo || item.occurredAt.slice(0, 10) <= filters.dateTo);
  });
}

export function exportIncidentAudit(incidents: OperationalIncident[]) {
  return JSON.stringify({
    report: 'AGM Turn — Jurnalul erorilor și soluțiilor aplicate',
    exportedAt: new Date().toISOString(),
    recordCount: incidents.length,
    incidents,
  }, null, 2);
}

export function hasValidationEvidence(incident: Pick<OperationalIncident, 'appliedSolution' | 'tests' | 'humanValidation'>) {
  return Boolean(incident.appliedSolution.trim() && incident.tests.trim() && incident.humanValidation.trim());
}

export function renderIncidentJournal(language: UiLanguage, incidents: OperationalIncident[], filters: IncidentJournalFilters) {
  const copy = labels[language] ?? labels.en;
  const filtered = filterIncidents(incidents, filters);
  const known = incidents.filter((item) => !['validated', 'archived'].includes(item.status));
  const quick = incidents.filter((item) => item.status === 'validated' && item.reusableSolution && item.appliedSolution.trim());
  const modules = Array.from(new Set(incidents.map((item) => item.module))).sort();

  return `
    <section class="incident-journal" id="incident-journal" aria-labelledby="incident-journal-title">
      <header class="incident-journal-header">
        <div><span>TURN · OPERATIONAL MEMORY</span><h2 id="incident-journal-title">${escapeHtml(copy.title)}</h2><p>${escapeHtml(copy.description)}</p></div>
        <div class="incident-journal-actions"><button id="newJournalIncident" type="button" class="primary">${escapeHtml(copy.newIncident)}</button><button id="exportIncidentJournal" type="button">${escapeHtml(copy.export)}</button></div>
      </header>
      <p class="incident-rule">${escapeHtml(copy.rule)}</p>
      <form id="incidentJournalFilters" class="incident-filters">
        <label><span>${escapeHtml(copy.search)}</span><input name="query" type="search" value="${escapeHtml(filters.query)}" /></label>
        <label><span>${escapeHtml(copy.module)}</span><select name="module"><option value="">${escapeHtml(copy.all)}</option>${modules.map((value) => `<option ${filters.module === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label>
        ${filterSelect('severity', copy.severity, incidentSeverities, filters.severity, copy)}
        ${filterSelect('status', copy.status, incidentStatuses, filters.status, copy)}
        ${filterSelect('category', copy.category, incidentCategories, filters.category, copy)}
        <label><span>${escapeHtml(copy.from)}</span><input name="dateFrom" type="date" value="${escapeHtml(filters.dateFrom)}" /></label>
        <label><span>${escapeHtml(copy.to)}</span><input name="dateTo" type="date" value="${escapeHtml(filters.dateTo)}" /></label>
        <label><span>${escapeHtml(copy.version)}</span><input name="version" value="${escapeHtml(filters.version)}" /></label>
        <button type="submit">${escapeHtml(copy.apply)}</button><button id="clearIncidentFilters" type="button">${escapeHtml(copy.clear)}</button>
      </form>
      <div class="incident-summary-grid">
        ${renderSummary(copy.known, known, copy)}
        ${renderSummary(copy.quick, quick, copy)}
      </div>
      <section class="incident-results"><header><strong>${escapeHtml(copy.results)}: ${filtered.length}</strong></header>${filtered.length ? filtered.map((item) => renderIncident(item, copy)).join('') : `<p>${escapeHtml(copy.noResults)}</p>`}</section>
      <dialog id="incidentEditorDialog" class="incident-editor-dialog">${renderIncidentForm(copy)}</dialog>
    </section>`;
}

function renderSummary(title: string, incidents: OperationalIncident[], copy: JournalLabels) {
  return `<article><strong>${escapeHtml(title)} (${incidents.length})</strong><ul>${incidents.slice(0, 8).map((item) => `<li><button type="button" data-incident-focus="${escapeHtml(item.id)}"><code>${escapeHtml(item.id)}</code> ${escapeHtml(item.module)} — ${escapeHtml(item.reusableSolution && item.appliedSolution ? item.appliedSolution : item.symptom)}</button></li>`).join('') || `<li>${escapeHtml(copy.none)}</li>`}</ul></article>`;
}

function renderIncident(item: OperationalIncident, copy: JournalLabels) {
  return `<details class="incident-record" id="incident-${escapeHtml(item.id)}">
    <summary><span class="incident-severity ${item.severity}">${escapeHtml(copy[item.severity])}</span><strong>${escapeHtml(item.id)} · ${escapeHtml(item.module)}</strong><span class="incident-status ${item.status}">${escapeHtml(copy[item.status])}</span><time>${escapeHtml(new Date(item.occurredAt).toLocaleString())}</time></summary>
    <div class="incident-record-body">
      <dl>
        ${field(copy.environment, item.environments.join(', '))}${field(copy.category, copy[item.category])}${field(copy.symptom, item.symptom)}${field(copy.reproduction, item.reproduction)}${field(copy.cause, item.cause)}${field(copy.attempted, item.attemptedSolutions)}${field(copy.solution, item.appliedSolution)}${field(copy.owner, item.owner)}${field(copy.version, item.fixedInVersion)}${field(copy.tests, item.tests)}${field(copy.human, item.humanValidation)}${field(copy.preventive, item.preventiveMeasure)}${relatedField(copy.related, item.relatedIncidentIds)}${field(copy.reusable, item.reusableSolution ? copy.yes : copy.no)}
      </dl>
      <section class="incident-history"><strong>${escapeHtml(copy.history)}</strong><ol>${item.history.map((event) => `<li><time>${escapeHtml(new Date(event.at).toLocaleString())}</time> · ${escapeHtml(event.actor)} · ${escapeHtml(copy[event.toStatus])}${event.note ? ` — ${escapeHtml(event.note)}` : ''}</li>`).join('')}</ol></section>
      <div class="incident-record-actions"><button type="button" data-incident-edit="${escapeHtml(item.id)}">${escapeHtml(copy.edit)}</button>${item.status !== 'reopened' ? `<button type="button" data-incident-reopen="${escapeHtml(item.id)}">${escapeHtml(copy.reopen)}</button>` : ''}</div>
    </div></details>`;
}

function renderIncidentForm(copy: JournalLabels) {
  return `<form id="incidentEditorForm" method="dialog"><header><strong>${escapeHtml(copy.editorTitle)}</strong><button id="closeIncidentEditor" type="button" aria-label="${escapeHtml(copy.close)}">×</button></header>
    <input name="id" type="hidden" /><div class="incident-editor-grid">
    ${input('occurredAt', copy.occurredAt, 'datetime-local', true)}${input('module', copy.module, 'text', true)}
    <fieldset><legend>${escapeHtml(copy.environment)}</legend>${incidentEnvironments.map((environment) => `<label class="toggle"><input name="environments" type="checkbox" value="${escapeHtml(environment)}" /><span>${escapeHtml(environment)}</span></label>`).join('')}</fieldset>
    ${select('category', copy.category, incidentCategories, copy)}${select('severity', copy.severity, incidentSeverities, copy)}${select('status', copy.status, incidentStatuses, copy)}
    ${textarea('symptom', copy.symptom, true)}${textarea('reproduction', copy.reproduction)}${textarea('cause', copy.cause)}${textarea('attemptedSolutions', copy.attempted)}${textarea('appliedSolution', copy.solution)}
    ${input('owner', copy.owner)}${input('fixedInVersion', copy.version)}${textarea('tests', copy.tests)}${textarea('humanValidation', copy.human)}${textarea('preventiveMeasure', copy.preventive)}${input('relatedIncidentIds', copy.related)}
    <label class="toggle"><input name="reusableSolution" type="checkbox" /><span>${escapeHtml(copy.reusable)}</span></label>${textarea('historyNote', copy.historyNote)}
    </div><p class="incident-editor-error" id="incidentEditorError" role="alert"></p><footer><button type="submit" class="primary">${escapeHtml(copy.save)}</button><button id="cancelIncidentEditor" type="button">${escapeHtml(copy.cancel)}</button></footer></form>`;
}

function filterSelect(name: string, title: string, values: string[], selected: string, copy: JournalLabels) {
  return `<label><span>${escapeHtml(title)}</span><select name="${name}"><option value="">${escapeHtml(copy.all)}</option>${values.map((value) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${escapeHtml(copy[value])}</option>`).join('')}</select></label>`;
}
function select(name: string, title: string, values: string[], copy: JournalLabels) { return `<label><span>${escapeHtml(title)}</span><select name="${name}" required>${values.map((value) => `<option value="${value}">${escapeHtml(copy[value])}</option>`).join('')}</select></label>`; }
function input(name: string, title: string, type = 'text', required = false) { return `<label><span>${escapeHtml(title)}</span><input name="${name}" type="${type}" ${required ? 'required' : ''} /></label>`; }
function textarea(name: string, title: string, required = false) { return `<label class="incident-wide"><span>${escapeHtml(title)}</span><textarea name="${name}" rows="3" ${required ? 'required' : ''}></textarea></label>`; }
function field(title: string, value: string) { return `<div><dt>${escapeHtml(title)}</dt><dd>${escapeHtml(value || '—')}</dd></div>`; }
function relatedField(title: string, ids: string[]) { return `<div><dt>${escapeHtml(title)}</dt><dd>${ids.length ? ids.map((id) => `<button type="button" data-incident-focus="${escapeHtml(id)}"><code>${escapeHtml(id)}</code></button>`).join(' ') : '—'}</dd></div>`; }
function normalizeSearch(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim(); }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character); }
function createIncidentId(now: Date) { return `AGM-INC-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; }
function normalizeIncident(item: OperationalIncident): OperationalIncident { return { ...item, environments: Array.isArray(item.environments) ? item.environments : [], relatedIncidentIds: Array.isArray(item.relatedIncidentIds) ? item.relatedIncidentIds : [], reusableSolution: Boolean(item.reusableSolution), history: Array.isArray(item.history) ? item.history : [] }; }

function historicalIncidents(): OperationalIncident[] {
  const resolved = (id: string, date: string, module: string, environments: IncidentEnvironment[], category: IncidentCategory, severity: IncidentSeverity, symptom: string, cause: string, solution: string, tests: string, preventive: string, relatedIncidentIds: string[] = []): OperationalIncident => ({
    id, occurredAt: date, updatedAt: date, module, environments, category, symptom, severity,
    reproduction: `Reprodus în mediile: ${environments.join(', ')}.`, cause, attemptedSolutions: 'Diagnosticare, verificarea configurației și testarea controlată a variantelor.', appliedSolution: solution,
    owner: category === 'infrastructure' || category === 'network' ? 'Backend & Infrastructure / Release Operations' : 'Frontend Experience / QA & Validation', fixedInVersion: 'A.G.M. Cockpit v0.1-test', tests,
    humanValidation: 'Validare umană confirmată pe dispozitiv real și consemnată în sesiunea AGM.', preventiveMeasure: preventive, status: 'validated', relatedIncidentIds, reusableSolution: true,
    history: [{ at: date, action: 'historical-import', actor: 'Turn Command Center', toStatus: 'validated', note: 'Incident istoric importat cu soluția și validarea existente.' }],
  });
  return [
    {
      id: 'AGM-INC-20260728-ANDROID-CORS',
      occurredAt: '2026-07-28T15:25:00.000Z',
      updatedAt: '2026-07-28T17:40:33.000Z',
      module: 'Traducere Android / Production API Hetzner',
      environments: ['Android/APK', 'API', 'Cloudflare'],
      category: 'network',
      symptom: 'APK-ul Android afișa „Translator indisponibil”, deși API-ul Production și furnizorul OpenAI erau funcționale.',
      severity: 'major',
      reproduction: 'Din APK 1.2.6, o cerere POST de traducere pornea cu Origin https://localhost și era respinsă înainte să ajungă la fluxul normal de traducere.',
      cause: 'Origin-ul nativ Android https://localhost lipsea din CORS_ALLOWED_ORIGINS al API-ului Production Hetzner.',
      attemptedSolutions: 'Au fost comparate comportamentele Browser/APK, verificate endpointul public, preflight-ul și logurile API fără modificarea APK-ului.',
      appliedSolution: 'A fost adăugat exact origin-ul https://localhost în configurația CORS Production; manifestul de integritate a fost actualizat, iar exclusiv serviciul API Production a fost repornit.',
      owner: 'Secret & Credentials Guardian / Release & Operations / Inspector',
      fixedInVersion: 'Configurație Production 2026-07-28; artefact Docker neschimbat',
      tests: 'Preflight Android și Browser HTTP 204; POST funcțional cu origin Android și Browser HTTP 201; răspuns OpenAI returnat; health live/ready PASS.',
      humanValidation: 'Captura Android din 2026-07-28 17:40 confirmă rezultatul „Morgen fahren wir ab.” și indicatorii Internet, AI Copilot și Traducere activi.',
      preventiveMeasure: 'Preflight obligatoriu pentru https://localhost și test real din APK după orice modificare a origin-urilor, proxy-ului sau configurației Production.',
      status: 'archived',
      relatedIncidentIds: ['AGM-INC-20260702-001', 'AGM-INC-20260704-003'],
      reusableSolution: true,
      history: [
        { at: '2026-07-28T15:25:00.000Z', action: 'created', actor: 'Turn Command Center', toStatus: 'analysis', note: 'Incidentul Android a fost confirmat prin comportamentul uniform al traducerilor.' },
        { at: '2026-07-28T15:35:49.000Z', action: 'remediation', actor: 'Secret & Credentials Guardian / Release & Operations', fromStatus: 'analysis', toStatus: 'remediation', note: 'Origin-ul Android a fost adăugat controlat; secretul și manifestul au fost actualizate fără expunerea valorilor.' },
        { at: '2026-07-28T15:40:00.000Z', action: 'technical-validation', actor: 'Inspector', fromStatus: 'remediation', toStatus: 'ready-test', note: 'Preflight 204, traduceri HTTP 201 și health checks PASS.' },
        { at: '2026-07-28T17:40:33.000Z', action: 'archived', actor: 'Turn Command Center', fromStatus: 'ready-test', toStatus: 'archived', note: 'Validarea umană pe APK real confirmă traducerea completă.' },
      ],
    },
    {
      id: 'AGM-INC-20260728-EMAIL-HANDOFF',
      occurredAt: '2026-07-28T17:49:21.000Z',
      updatedAt: '2026-07-28T18:01:34.000Z',
      module: 'Asistent Email Android / Gmail',
      environments: ['Android/APK'],
      category: 'ux',
      symptom: 'După predarea mesajului către Gmail, utilizatorul nu a observat imediat e-mailul la destinație și a suspectat o eroare AGM.',
      severity: 'informational',
      reproduction: 'Mesajul este compus în AGM, apoi aplicația deschide clientul Gmail prin mecanismul Android; livrarea finală poate apărea cu întârziere.',
      cause: 'AGM nu expediază e-mailul server-side și nu primește confirmare de livrare; responsabilitatea expedierii trece la Gmail după deschiderea compozitorului.',
      attemptedSolutions: 'Au fost verificate fluxul nativ ACTION_SENDTO/mailto și responsabilitatea fiecărei componente, fără modificări de cod sau infrastructură.',
      appliedSolution: 'Livrarea finală a fost confirmată de utilizator. Incidentul a fost reclasificat drept întârziere externă, nu defect al API-ului AGM.',
      owner: 'Frontend Experience / QA & Validation',
      fixedInVersion: 'Nu necesită remediere tehnică în 1.2.6',
      tests: 'Deschiderea compozitorului Gmail din APK PASS; mesajele au apărut ulterior în căsuța destinatarului.',
      humanValidation: 'Fotografia furnizată de utilizator confirmă primirea finală a celor două mesaje în Gmail.',
      preventiveMeasure: 'Interfața și procedura de suport trebuie să precizeze că deschiderea Gmail nu reprezintă confirmare de livrare; incidentele se închid numai după verificarea clientului de e-mail.',
      status: 'archived',
      relatedIncidentIds: [],
      reusableSolution: true,
      history: [
        { at: '2026-07-28T17:49:21.000Z', action: 'created', actor: 'Turn Command Center', toStatus: 'analysis', note: 'A fost raportată lipsa aparentă a livrării.' },
        { at: '2026-07-28T18:01:34.000Z', action: 'archived', actor: 'Turn Command Center / Human Validator', fromStatus: 'analysis', toStatus: 'archived', note: 'Utilizatorul a confirmat că mesajele au ajuns în final.' },
      ],
    },
    {
      id: 'AGM-FU-20260728-CLOUDFLARED-PERSISTENCE',
      occurredAt: '2026-07-28T17:00:00.000Z',
      updatedAt: '2026-07-28T18:01:34.000Z',
      module: 'Cloudflare Production Hetzner',
      environments: ['Cloudflare'],
      category: 'infrastructure',
      symptom: 'Conectorul Production Hetzner funcționează ca unitate systemd tranzitorie; un restart al serverului poate întrerupe ruta publică.',
      severity: 'major',
      reproduction: 'Starea unității arată un lifecycle tranzitoriu, fără unitate persistentă aprobată și validată pentru boot.',
      cause: 'Deploymentul a activat conectorul printr-o unitate tranzitorie; permanentizarea a fost exclusă din mandatul de deployment.',
      attemptedSolutions: 'Riscul a fost documentat, serverul a fost pus sub interdicție de restart, iar fallback-ul PC a fost conservat.',
      appliedSolution: 'Măsură temporară activă: fără restart Hetzner, monitorizarea conectorului și păstrarea fallback-ului. Remedierea permanentă necesită mandat separat.',
      owner: 'Release & Operations / Crisis Coordination Cell',
      fixedInVersion: 'PENDING – ciclu separat pentru unitatea systemd persistentă',
      tests: 'Tunel Production healthy și trafic public funcțional după deployment; persistența la reboot nu este încă validată.',
      humanValidation: 'Production este accesibilă extern; limitarea operațională a fost acceptată explicit la închiderea deploymentului.',
      preventiveMeasure: 'Crearea, verificarea, activarea și testarea controlată la reboot a unei unități systemd persistente înainte de eliminarea interdicției de restart.',
      status: 'remediation',
      relatedIncidentIds: ['AGM-FU-20260725-CF1033'],
      reusableSolution: false,
      history: [
        { at: '2026-07-28T17:00:00.000Z', action: 'created', actor: 'Turn Command Center', toStatus: 'remediation', note: 'Follow-up operațional deschis la închiderea deploymentului Production.' },
        { at: '2026-07-28T18:01:34.000Z', action: 'status-confirmed', actor: 'Release & Operations', fromStatus: 'remediation', toStatus: 'remediation', note: 'Production rămâne activă; restartul Hetzner rămâne interzis până la remedierea persistentă.' },
      ],
    },
    {
      id: 'AGM_INTEGRITY_AUDIT_2026-07-25',
      occurredAt: '2026-07-25T08:00:00.000Z',
      updatedAt: '2026-07-25T14:45:00.000Z',
      module: 'Platformă AGM / Turn Command Center',
      environments: ['Web', 'Android/APK', 'API', 'Docker/PostgreSQL', 'Cloudflare'],
      category: 'infrastructure',
      symptom: 'Indisponibilitate simultană a serviciilor după incidentul Docker și necesitatea verificării integrității complete.',
      severity: 'critical',
      reproduction: 'Docker indisponibil a întrerupt PostgreSQL, API-ul și lanțul public dependent.',
      cause: 'Reinstalarea Docker și repornirea sistemului au întrerupt dependențele; monitorizarea, autostartul și izolarea Compose/.env necesitau consolidare.',
      attemptedSolutions: 'Restaurare controlată, audit Hetzner/Docker/date/API/UI/Git/configurație și validări repetate.',
      appliedSolution: 'Serviciile au fost restaurate; monitorul, autostartul și configurația Compose au fost consolidate; codul, datele și baseline-ul au fost verificate.',
      owner: 'Turn Command Center / Release & Operations / Inspector',
      fixedInVersion: 'feature/post-basic-turn-architecture-audit · cf54ecf2b977ad04df8fdb1e9a6a255fd1f3e73e',
      tests: 'PostgreSQL healthy; API local/public HTTP 200; build Web/Android PASS; API 11/11; monitor, autostart și Compose PASS.',
      humanValidation: 'Funcționarea Android și Browser a fost confirmată în sesiunea AGM; instrumentarea completă este transferată în AGM-FU-20260725-UILIVE.',
      preventiveMeasure: 'Monitorizare completă, rearmare automată, separarea .env/Compose, checkpoint Git și audit după incidente de infrastructură.',
      status: 'archived',
      relatedIncidentIds: ['AGM-FU-20260725-CF1033', 'AGM-FU-20260725-UILIVE'],
      reusableSolution: true,
      history: [
        { at: '2026-07-25T08:00:00.000Z', action: 'created', actor: 'Turn Command Center', toStatus: 'analysis', note: 'Auditul de integritate a fost deschis.' },
        { at: '2026-07-25T12:00:00.000Z', action: 'remediation', actor: 'Release & Operations', fromStatus: 'analysis', toStatus: 'remediation', note: 'Serviciile și mecanismele de recuperare au fost remediate.' },
        { at: '2026-07-25T14:30:00.000Z', action: 'validated', actor: 'Inspector', fromStatus: 'remediation', toStatus: 'validated', note: 'Dovezile sunt PASS; observațiile reziduale au fost transferate separat.' },
        { at: '2026-07-25T14:45:00.000Z', action: 'archived', actor: 'AGM Chronicler / Turn Command Center', fromStatus: 'validated', toStatus: 'archived', note: 'Cronologia, semnăturile, lecțiile și rezoluția au fost arhivate.' },
      ],
    },
    {
      id: 'AGM-FU-20260725-CF1033', occurredAt: '2026-07-25T14:45:00.000Z', updatedAt: '2026-07-25T14:53:48.000Z',
      module: 'Cloudflare validation-api', environments: ['Cloudflare'], category: 'network', severity: 'major',
      symptom: 'validation-api.agmcockpit.com răspunde HTTP 530 / Cloudflare 1033.',
      reproduction: 'Solicitare HTTPS către hostname-ul de validare.',
      cause: 'Cloudflare nu detectează un conector cloudflared sănătos pentru tunelul de validare.',
      attemptedSolutions: 'DNS, TLS, Hetzner, unitatea systemd, tokenul și configurația ingress au fost verificate independent.',
      appliedSolution: 'Credential rotit, tunel nou dedicat, DNS validation-api mutat, override-ul de producție eliminat și originul 127.0.0.1:3000 configurat explicit.',
      owner: 'Release & Operations', fixedInVersion: 'agm-api-validation-rotated-20260725 · f4343acc-7303-4422-a10a-587a9dc96114',
      tests: 'Patru conexiuni Hetzner; validation live/ready 5/5 HTTP 200; producție 5/5 HTTP 200; tunel vechi revocat.',
      humanValidation: 'Follow-up validat end-to-end fără impact asupra API-ului public activ.',
      preventiveMeasure: 'Separarea strictă a unităților production/validation, verificarea tunnelID și rotația oricărui credential expus.', status: 'archived',
      relatedIncidentIds: ['AGM_INTEGRITY_AUDIT_2026-07-25'], reusableSolution: false,
      history: [
        { at: '2026-07-25T14:45:00.000Z', action: 'transferred', actor: 'Inspector', toStatus: 'remediation', note: 'Transferat din incidentul principal.' },
        { at: '2026-07-25T14:53:21.000Z', action: 'validated', actor: 'Inspector / Release & Operations', fromStatus: 'remediation', toStatus: 'validated', note: 'Tunel rotit și health-check validare/producție 5/5 PASS.' },
        { at: '2026-07-25T14:53:48.000Z', action: 'archived', actor: 'Turn Command Center', fromStatus: 'validated', toStatus: 'archived', note: 'Credentialul vechi a fost revocat și follow-up-ul a fost închis.' },
      ],
    },
    {
      id: 'AGM-FU-20260725-UILIVE', occurredAt: '2026-07-25T14:45:00.000Z', updatedAt: '2026-07-25T17:57:18.000Z',
      module: 'Browser / Android live validation', environments: ['Web', 'Android/APK'], category: 'ux', severity: 'informational',
      symptom: 'Probele automate sunt PASS, dar lipsește o captură instrumentată completă Browser și Android.',
      reproduction: 'Audit fără instanță Browser automation și fără dispozitiv Android instrumentat.',
      cause: 'Canalele de instrumentare nu au fost disponibile: Browser runtime a raportat zero browsere, iar adb zero dispozitive.',
      attemptedSolutions: 'Builduri, paritate asset, regresii, fotografii de validare umană și diagnostic Browser runtime/Android SDK/ADB/USB.',
      appliedSolution: 'Modul UI LIVE separat cu Chromium izolat, registru comun de endpoint-uri, health-check-uri locale/publice și capturi automate Desktop/Mobile. Captura Android ADB rămâne legată ca dovadă a dispozitivului real.', owner: 'Frontend Experience / QA & Validation', fixedInVersion: 'UI LIVE Automation follow-up',
      tests: 'Web build PASS; Browser Shell PASS; opt rute locale/publice HTTP 200; capturi Desktop/Mobile PASS; Operations Center sincronizat fără DEGRADED/OFFLINE; Galaxy S25 autorizat ADB și captură Android automată PASS.',
      humanValidation: 'Fotografiile utilizatorului confirmă website, Turn și traducerea Android; captura ADB confirmă automat AGM Cockpit pe dispozitiv.',
      preventiveMeasure: 'Rulare pnpm audit:ui-live după schimbări operaționale; același registru de endpoint-uri pentru raport și dashboard; Android nu este declarat monitorizat până la existența telemetriei continue.', status: 'archived',
      relatedIncidentIds: ['AGM_INTEGRITY_AUDIT_2026-07-25'], reusableSolution: false,
      history: [
        { at: '2026-07-25T14:45:00.000Z', action: 'transferred', actor: 'Inspector', toStatus: 'ready-test', note: 'Transferat pentru probă instrumentată separată.' },
        { at: '2026-07-25T14:54:30.000Z', action: 'blocked-evidence', actor: 'Inspector / Frontend Experience', fromStatus: 'ready-test', toStatus: 'ready-test', note: 'Browser runtime: 0 instanțe; adb: 0 dispozitive. Follow-up-ul rămâne deschis până la capturi reale.' },
        { at: '2026-07-25T14:56:30.000Z', action: 'diagnosed', actor: 'Inspector / Frontend Experience', fromStatus: 'ready-test', toStatus: 'ready-test', note: 'Platforma este funcțională; lipsesc exclusiv sesiunea Browser instrumentabilă și transportul ADB autorizat.' },
        { at: '2026-07-25T17:19:00.000Z', action: 'android-evidence-captured', actor: 'Inspector / Frontend Experience', fromStatus: 'ready-test', toStatus: 'ready-test', note: 'Galaxy S25 autorizat; AGM Cockpit lansat; captură ADB salvată. Rămâne numai Browser Runtime.' },
        { at: '2026-07-25T17:57:18.000Z', action: 'validated', actor: 'UI LIVE Automation / Inspector', fromStatus: 'ready-test', toStatus: 'validated', note: 'Audit automat complet PASS: opt rute HTTP 200, capturi Desktop/Mobile și Operations Center sincronizat.' },
        { at: '2026-07-25T17:57:18.000Z', action: 'archived', actor: 'Turn Command Center', fromStatus: 'validated', toStatus: 'archived', note: 'Follow-up închis; dovezile și cronologia rămân disponibile exclusiv în jurnal.' },
      ],
    },
    resolved('AGM-INC-20260702-001', '2026-07-02T19:00:00.000Z', 'Translator', ['Web', 'API'], 'translation', 'critical', 'Translatorul raporta serviciul indisponibil.', 'Endpoint API sau furnizor de traducere indisponibil/configurat incorect.', 'Configurarea adaptorului AGM API cu fallback controlat și mesaje clare.', 'Build web, teste API și traduceri reale RO/DE/EN.', 'Validarea endpointului de producție la fiecare build.'),
    resolved('AGM-INC-20260703-002', '2026-07-03T10:00:00.000Z', 'Infrastructură', ['Android/APK', 'Wi-Fi/date mobile'], 'network', 'major', 'Aplicația funcționa numai în rețeaua locală.', 'APK-ul utiliza o adresă LAN inaccesibilă din exterior.', 'Mutarea API pe endpoint HTTPS public stabil.', 'Teste Wi-Fi și date mobile pe telefon.', 'Interzicerea adreselor localhost/LAN în buildurile de producție.', ['AGM-INC-20260704-003']),
    resolved('AGM-INC-20260704-003', '2026-07-04T12:00:00.000Z', 'Translator', ['Android/APK', 'Cloudflare', 'Wi-Fi/date mobile'], 'network', 'critical', 'Traducerea nu funcționa pe date mobile.', 'Tunelul HTTPS și endpointul public nu erau stabilizate.', 'Configurarea Cloudflare HTTPS și includerea endpointului public în APK.', 'Restart aplicație și traduceri repetate pe date mobile.', 'Monitorizarea tunelului și test obligatoriu pe două rețele.', ['AGM-INC-20260703-002']),
    resolved('AGM-INC-20260706-004', '2026-07-06T09:00:00.000Z', 'Dictare', ['Android/APK'], 'translation', 'major', 'Dictarea recunoștea limba greșită.', 'Locale-ul recunoașterii nu urma limba selectată.', 'Transmiterea explicită a limbii active către recunoașterea vocală nativă.', 'Dictare RO, DE și EN pe dispozitiv real.', 'Test multilingv obligatoriu după schimbări audio.'),
    resolved('AGM-INC-20260707-005', '2026-07-07T11:00:00.000Z', 'Legal', ['Web', 'Android/APK'], 'ux', 'major', 'Butonul Termeni și condiții era acoperit pe ecrane mici.', 'Layout și suprapuneri responsive insuficient verificate.', 'Corectarea poziționării și spațierii responsive.', 'Test pe ecran mobil și verificarea tuturor acțiunilor legale.', 'Checklist vizual pentru ecrane mici.'),
    resolved('AGM-INC-20260708-006', '2026-07-08T14:00:00.000Z', 'Translator', ['API', 'Cloudflare'], 'technical', 'major', 'Traducerile aveau întârzieri mari.', 'Pornire rece și acces instabil la serviciile din infrastructură.', 'Stabilizarea serviciilor și a tunelului, plus mesaje de progres.', 'Traduceri repetate pe Wi-Fi/date mobile și măsurarea timpului.', 'Monitorizare latență și limită de 60 secunde în validare.'),
    resolved('AGM-INC-20260709-007', '2026-07-09T16:00:00.000Z', 'Camera și audio', ['Android/APK'], 'security', 'major', 'Camera sau microfonul nu porneau după refuzarea permisiunii.', 'Permisiunile Android lipseau sau erau refuzate/blocate.', 'Declararea permisiunilor și ghidarea utilizatorului către setările aplicației.', 'Acordare, refuz, relansare și restart telefon.', 'Matrice obligatorie de testare a permisiunilor.'),
    resolved('AGM-INC-20260710-008', '2026-07-10T18:00:00.000Z', 'Cloudflare', ['Cloudflare'], 'infrastructure', 'major', 'Cloudflared se bloca la oprirea serviciului.', 'Procesul nu era gestionat complet de ciclul serviciului Windows.', 'Gestionarea controlată a procesului și verificarea opririi/pornirii.', 'Restart servicii și restart Windows.', 'Health-check și oprire idempotentă.'),
    resolved('AGM-INC-20260711-009', '2026-07-11T08:00:00.000Z', 'Autostart', ['Docker/PostgreSQL', 'Cloudflare'], 'infrastructure', 'critical', 'AGM depindea de VS Code și terminale pornite manual.', 'Serviciile nu aveau autostart Windows independent.', 'Instalarea autostartului și scripturilor de servicii independente.', 'Restart complet Windows fără VS Code și terminale.', 'Test de autostart după orice modificare de infrastructură.'),
    resolved('AGM-INC-20260712-010', '2026-07-12T13:00:00.000Z', 'HTTPS', ['Android/APK', 'API', 'Cloudflare'], 'infrastructure', 'critical', 'APK-ul nu avea o rută HTTPS publică stabilă.', 'Configurație de dezvoltare bazată pe HTTP/LAN.', 'Endpoint public HTTPS, validare Vite și tunel persistent.', 'Build producție și teste telefon Wi-Fi/date mobile.', 'Blocarea buildului dacă endpointul de producție nu este HTTPS.'),
    resolved('AGM-INC-20260713-011', '2026-07-13T15:00:00.000Z', 'Camera/OCR', ['Android/APK'], 'technical', 'major', 'OCR producea artefacte sau fragmente neutilizabile.', 'Imagini dificile și rezultate cu încredere redusă.', 'Preprocesare adaptivă, normalizare și praguri de utilizabilitate.', 'Documente standard, AOK, lumină slabă, unghi și document îndoit.', 'Păstrarea setului real de scenarii OCR în regresie.'),
    resolved('AGM-INC-20260714-012', '2026-07-14T17:00:00.000Z', 'Platformă AGM', ['Web', 'Android/APK', 'API'], 'technical', 'major', 'Modificările puteau produce regresii în module validate.', 'Lipsa unei matrice unificate de regresie și validare umană.', 'Builduri complete, protocoale pe modul și validare reală înainte de închidere.', 'Translator, OCR, dictare, Email Assistant, HTTPS și autostart retestate.', 'Nicio închidere fără test automat, test real și validare umană.'),
  ];
}

type JournalLabels = Record<string, string>;
const labels: Partial<Record<UiLanguage, JournalLabels>> & Record<'en', JournalLabels> = {
  ro: { title: 'Jurnalul erorilor și soluțiilor aplicate', description: 'Memoria tehnică permanentă a proiectului AGM.', newIncident: 'Incident nou', export: 'Export audit', rule: 'Un incident devine Validat numai după remediere tehnică, teste și validare umană consemnată.', search: 'Cuvinte-cheie', module: 'Modul', all: 'Toate', severity: 'Severitate', status: 'Statut', category: 'Categorie', from: 'De la', to: 'Până la', version: 'Versiune / commit', apply: 'Aplică filtre', clear: 'Șterge filtrele', known: 'Probleme cunoscute', quick: 'Soluții rapide validate', results: 'Rezultate', noResults: 'Niciun incident nu corespunde filtrelor.', none: 'Niciun element.', environment: 'Mediu', symptom: 'Simptom exact', reproduction: 'Condiții de reproducere', cause: 'Cauză confirmată/probabilă', attempted: 'Soluții încercate', solution: 'Soluția aplicată', owner: 'Agent / departament responsabil', tests: 'Teste după remediere', human: 'Validare umană', preventive: 'Măsură preventivă', related: 'Incidente similare', reusable: 'Soluție validată și reutilizabilă', history: 'Istoric complet', edit: 'Actualizează', reopen: 'Redeschide', editorTitle: 'Fișă incident', close: 'Închide', occurredAt: 'Data și ora apariției', historyNote: 'Notă pentru istoric', save: 'Salvează în jurnal', cancel: 'Anulează', yes: 'Da', no: 'Nu', informational: 'Informativ', minor: 'Minor', major: 'Major', critical: 'Critic', new: 'Nou', analysis: 'În analiză', remediation: 'În remediere', 'ready-test': 'Pregătit pentru test', validated: 'Validat', reopened: 'Redeschis', archived: 'Arhivat', technical: 'Tehnică', ux: 'UX', translation: 'Traducere', network: 'Rețea', security: 'Securitate', infrastructure: 'Infrastructură' },
  de: { title: 'Fehler- und Lösungsjournal', description: 'Das dauerhafte technische Gedächtnis des AGM-Projekts.', newIncident: 'Neuer Vorfall', export: 'Audit exportieren', rule: 'Ein Vorfall wird erst nach technischer Behebung, Tests und dokumentierter menschlicher Validierung validiert.', search: 'Suchbegriffe', module: 'Modul', all: 'Alle', severity: 'Schweregrad', status: 'Status', category: 'Kategorie', from: 'Von', to: 'Bis', version: 'Version / Commit', apply: 'Filter anwenden', clear: 'Filter löschen', known: 'Bekannte Probleme', quick: 'Validierte Schnelllösungen', results: 'Ergebnisse', noResults: 'Keine passenden Vorfälle.', none: 'Keine Einträge.', environment: 'Umgebung', symptom: 'Genaues Symptom', reproduction: 'Reproduktionsbedingungen', cause: 'Bestätigte/vermutete Ursache', attempted: 'Versuchte Lösungen', solution: 'Angewandte Lösung', owner: 'Verantwortlicher Agent / Bereich', tests: 'Tests nach Behebung', human: 'Menschliche Validierung', preventive: 'Präventivmaßnahme', related: 'Ähnliche Vorfälle', reusable: 'Validierte wiederverwendbare Lösung', history: 'Vollständiger Verlauf', edit: 'Aktualisieren', reopen: 'Wieder öffnen', editorTitle: 'Vorfallsdatensatz', close: 'Schließen', occurredAt: 'Datum und Uhrzeit', historyNote: 'Verlaufsnotiz', save: 'Im Journal speichern', cancel: 'Abbrechen', yes: 'Ja', no: 'Nein', informational: 'Informativ', minor: 'Gering', major: 'Hoch', critical: 'Kritisch', new: 'Neu', analysis: 'In Analyse', remediation: 'In Behebung', 'ready-test': 'Testbereit', validated: 'Validiert', reopened: 'Wieder geöffnet', archived: 'Archiviert', technical: 'Technik', ux: 'UX', translation: 'Übersetzung', network: 'Netzwerk', security: 'Sicherheit', infrastructure: 'Infrastruktur' },
  en: { title: 'Error and Applied Solutions Journal', description: 'The permanent technical memory of the AGM project.', newIncident: 'New incident', export: 'Export audit', rule: 'An incident becomes Validated only after technical remediation, testing, and documented human validation.', search: 'Keywords', module: 'Module', all: 'All', severity: 'Severity', status: 'Status', category: 'Category', from: 'From', to: 'To', version: 'Version / commit', apply: 'Apply filters', clear: 'Clear filters', known: 'Known issues', quick: 'Validated quick solutions', results: 'Results', noResults: 'No incidents match the filters.', none: 'No entries.', environment: 'Environment', symptom: 'Exact symptom', reproduction: 'Reproduction conditions', cause: 'Confirmed/probable cause', attempted: 'Attempted solutions', solution: 'Applied solution', owner: 'Responsible agent / department', tests: 'Post-remediation tests', human: 'Human validation', preventive: 'Preventive measure', related: 'Similar incidents', reusable: 'Validated reusable solution', history: 'Complete history', edit: 'Update', reopen: 'Reopen', editorTitle: 'Incident record', close: 'Close', occurredAt: 'Occurrence date and time', historyNote: 'History note', save: 'Save to journal', cancel: 'Cancel', yes: 'Yes', no: 'No', informational: 'Informational', minor: 'Minor', major: 'Major', critical: 'Critical', new: 'New', analysis: 'In analysis', remediation: 'In remediation', 'ready-test': 'Ready for test', validated: 'Validated', reopened: 'Reopened', archived: 'Archived', technical: 'Technical', ux: 'UX', translation: 'Translation', network: 'Network', security: 'Security', infrastructure: 'Infrastructure' },
};
