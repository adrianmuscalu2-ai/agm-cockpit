import { monitoringAgents } from './monitoring-department';

export type TurnAccessLevel = 'strategic' | 'administrative' | 'oversight' | 'operational-readonly';
export type TurnEscalationLevel = 'L1' | 'L2' | 'L3' | 'L4';
export type TurnOrganizationKind = 'leader' | 'coordinator' | 'department' | 'agent';

export type TurnOrganizationAgent = {
  id: string;
  name: string;
  kind: TurnOrganizationKind;
  departmentId: string;
  coordinatorId: string;
  reportsToId: string;
  responsibility: string;
  accessLevel: TurnAccessLevel;
  procedure: string;
  escalationLevel: TurnEscalationLevel;
  subordinateAgentIds: string[];
};

export type TurnOrganizationAgentInput = Omit<TurnOrganizationAgent, 'subordinateAgentIds'> & {
  subordinateAgentIds?: string[];
};

const requiredAgentFields: Array<keyof TurnOrganizationAgentInput> = [
  'id',
  'name',
  'departmentId',
  'coordinatorId',
  'reportsToId',
  'responsibility',
  'accessLevel',
  'procedure',
  'escalationLevel',
];

export function createOrganizationAgent(
  existing: TurnOrganizationAgent[],
  input: TurnOrganizationAgentInput,
) {
  for (const field of requiredAgentFields) {
    if (!String(input[field] ?? '').trim()) throw new Error(`ORGANIZATION_FIELD_REQUIRED:${field}`);
  }
  if (existing.some((agent) => agent.id === input.id)) throw new Error('ORGANIZATION_AGENT_DUPLICATE');
  const coordinator = existing.find((agent) => agent.id === input.coordinatorId);
  if (!coordinator) throw new Error('ORGANIZATION_COORDINATOR_NOT_FOUND');
  if (!existing.some((agent) => agent.id === input.reportsToId)) {
    throw new Error('ORGANIZATION_REPORTING_TARGET_NOT_FOUND');
  }
  if (!turnOrganizationDepartments.some((department) => department.id === input.departmentId)) {
    throw new Error('ORGANIZATION_DEPARTMENT_NOT_FOUND');
  }
  const agent: TurnOrganizationAgent = { ...input, subordinateAgentIds: input.subordinateAgentIds ?? [] };
  return {
    agent,
    placement: {
      departmentId: agent.departmentId,
      coordinatorId: agent.coordinatorId,
      reportsToId: agent.reportsToId,
      level: coordinator.id === 'adrian-turn-commander' ? 2 : 3,
    },
  };
}

export const turnOrganizationDepartments = [
  { id: 'leadership', name: 'Conducere' },
  { id: 'operational-coordination', name: 'Coordonare Operațională Atlas' },
  { id: 'monitoring', name: 'Departamentul de Monitorizare' },
] as const;

const atlasUnits = [
  ['inspection-basic', 'Inspecție Basic', 'Validarea funcțiilor AGM Basic.'],
  ['inspection-premium', 'Inspecție Premium', 'Validarea modulelor Premium.'],
  ['website', 'Website', 'Pagina publică și experiența web.'],
  ['browser', 'Browser', 'Clientul Browser AGM.'],
  ['android', 'Android', 'Clientul Android AGM.'],
  ['ai', 'AI', 'Furnizorii și funcțiile AI.'],
  ['api', 'API', 'Serviciile API AGM.'],
  ['databases', 'Baze de date', 'Persistența și PostgreSQL.'],
  ['i18n', 'i18n', 'Localizare RO/DE/EN.'],
  ['ux-ui', 'UX/UI', 'Experiența și interfața utilizatorului.'],
  ['release-operations', 'Release & Operations', 'Build, release și recuperare.'],
  ['other-operations', 'Alte departamente operaționale', 'Unități operaționale viitoare validate.'],
] as const;

const leadership: TurnOrganizationAgent[] = [
  {
    id: 'mentor', name: 'MENTOR', kind: 'leader', departmentId: 'leadership',
    coordinatorId: 'mentor', reportsToId: 'mentor', responsibility: 'Direcție strategică și mentorat.',
    accessLevel: 'strategic', procedure: 'Emite orientarea strategică și escaladează către Turn Commander.',
    escalationLevel: 'L4', subordinateAgentIds: ['adrian-turn-commander'],
  },
  {
    id: 'adrian-turn-commander', name: 'ADRIAN – TURN COMMANDER', kind: 'leader', departmentId: 'leadership',
    coordinatorId: 'mentor', reportsToId: 'mentor', responsibility: 'Comandă, prioritizare și aprobare finală.',
    accessLevel: 'strategic', procedure: 'Aprobă direcția, checkpoint-urile și intervențiile majore.',
    escalationLevel: 'L4', subordinateAgentIds: ['atlas-operations', 'chief-monitoring-inspector'],
  },
  {
    id: 'atlas-operations', name: 'ATLAS – Coordonare Operațională', kind: 'coordinator',
    departmentId: 'operational-coordination', coordinatorId: 'adrian-turn-commander',
    reportsToId: 'adrian-turn-commander', responsibility: 'Coordonează implementarea și departamentele operaționale.',
    accessLevel: 'administrative', procedure: 'Planifică, implementează, verifică și raportează către Turn Commander.',
    escalationLevel: 'L3', subordinateAgentIds: atlasUnits.map(([id]) => `unit-${id}`),
  },
  {
    id: 'chief-monitoring-inspector', name: 'INSPECTOR ȘEF MONITORIZARE', kind: 'coordinator',
    departmentId: 'monitoring', coordinatorId: 'adrian-turn-commander',
    reportsToId: 'adrian-turn-commander', responsibility: 'Coordonează independent monitorizarea și escaladarea.',
    accessLevel: 'oversight', procedure: 'Verifică sursele comune, deschide incidente și raportează Turn Commander-ului.',
    escalationLevel: 'L3', subordinateAgentIds: monitoringAgents.map((agent) => agent.id),
  },
];

const operationalUnits: TurnOrganizationAgent[] = atlasUnits.map(([id, name, responsibility]) => ({
  id: `unit-${id}`,
  name,
  kind: 'department',
  departmentId: 'operational-coordination',
  coordinatorId: 'atlas-operations',
  reportsToId: 'atlas-operations',
  responsibility,
  accessLevel: 'operational-readonly',
  procedure: 'Execută responsabilitatea unității, consemnează rezultatele și escaladează către Atlas.',
  escalationLevel: 'L2',
  subordinateAgentIds: [],
}));

const monitoringNodes: TurnOrganizationAgent[] = monitoringAgents.map((agent) => ({
  id: agent.id,
  name: agent.name,
  kind: 'agent',
  departmentId: 'monitoring',
  coordinatorId: 'chief-monitoring-inspector',
  reportsToId: 'chief-monitoring-inspector',
  responsibility: agent.responsibilities,
  accessLevel: agent.id === 'monitor-security' ? 'oversight' : 'operational-readonly',
  procedure: agent.intervention,
  escalationLevel: agent.id === 'monitor-security' ? 'L3' : 'L2',
  subordinateAgentIds: [],
}));

export const turnOrganizationAgents: TurnOrganizationAgent[] = [
  ...leadership,
  ...operationalUnits,
  ...monitoringNodes,
];

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[
      character
    ] || character,
  );
}

function nodeButton(agent: TurnOrganizationAgent) {
  return `<button class="turn-org-node ${agent.kind}" type="button" data-turn-org-agent="${escapeHtml(agent.id)}"><strong>${escapeHtml(agent.name)}</strong><span>${escapeHtml(agent.responsibility)}</span></button>`;
}

function relationDetails(agent: TurnOrganizationAgent) {
  const coordinator = turnOrganizationAgents.find((item) => item.id === agent.coordinatorId)?.name ?? agent.coordinatorId;
  const reportsTo = turnOrganizationAgents.find((item) => item.id === agent.reportsToId)?.name ?? agent.reportsToId;
  const department = turnOrganizationDepartments.find((item) => item.id === agent.departmentId)?.name ?? agent.departmentId;
  const subordinates = agent.subordinateAgentIds
    .map((id) => turnOrganizationAgents.find((item) => item.id === id)?.name)
    .filter(Boolean);
  return `<dl>
    <div><dt>Departament</dt><dd data-org-field="department">${escapeHtml(department)}</dd></div>
    <div><dt>Coordonator direct</dt><dd data-org-field="coordinator">${escapeHtml(coordinator)}</dd></div>
    <div><dt>Raportează către</dt><dd data-org-field="reports">${escapeHtml(reportsTo)}</dd></div>
    <div><dt>Nivel de escaladare</dt><dd data-org-field="escalation">${escapeHtml(agent.escalationLevel)}</dd></div>
    <div><dt>Nivel acces</dt><dd data-org-field="access">${escapeHtml(agent.accessLevel)}</dd></div>
    <div><dt>Responsabilitate</dt><dd data-org-field="responsibility">${escapeHtml(agent.responsibility)}</dd></div>
    <div><dt>Procedură</dt><dd data-org-field="procedure">${escapeHtml(agent.procedure)}</dd></div>
    <div><dt>Agenți subordonați</dt><dd data-org-field="subordinates">${escapeHtml(subordinates.join(', ') || 'Niciunul')}</dd></div>
  </dl>`;
}

export function renderTurnOrganizationChart() {
  const mentor = turnOrganizationAgents.find((agent) => agent.id === 'mentor')!;
  const adrian = turnOrganizationAgents.find((agent) => agent.id === 'adrian-turn-commander')!;
  const atlas = turnOrganizationAgents.find((agent) => agent.id === 'atlas-operations')!;
  const inspector = turnOrganizationAgents.find((agent) => agent.id === 'chief-monitoring-inspector')!;
  return `<section class="turn-organization-chart" id="turn-structure" aria-labelledby="turn-structure-title">
    <header><div><span class="turn-kicker">TURN · ORGANIZATION CHART</span><h2 id="turn-structure-title">Structura Turnului</h2><p>Lanț oficial de coordonare, execuție, monitorizare și escaladare.</p></div><strong>3 niveluri</strong></header>
    <nav class="turn-org-department-selector" aria-label="Selectează departamentul">${turnOrganizationDepartments.map((department) => `<button type="button" data-turn-org-department="${department.id}">${escapeHtml(department.name)}</button>`).join('')}</nav>
    <div class="turn-org-layout">
      <div class="turn-org-tree">
        <details open data-org-branch="leadership"><summary>Nivelul 1 · Conducere</summary>${nodeButton(mentor)}<div class="turn-org-connector">↓</div>${nodeButton(adrian)}</details>
        <details open data-org-branch="coordination"><summary>Nivelul 2 · Coordonare</summary><div class="turn-org-peer-row">${nodeButton(atlas)}${nodeButton(inspector)}</div></details>
        <details open data-org-branch="operational-coordination"><summary>Nivelul 3 · Subordonare Atlas</summary><div class="turn-org-node-grid">${operationalUnits.map(nodeButton).join('')}</div></details>
        <details open data-org-branch="monitoring"><summary>Nivelul 3 · Subordonare Inspector Șef Monitorizare</summary><div class="turn-org-node-grid">${monitoringNodes.map(nodeButton).join('')}</div></details>
      </div>
      <aside class="turn-org-relations" id="turnOrgRelations" aria-live="polite"><header><span>Relații selectate</span><h3 data-org-field="name">${escapeHtml(adrian.name)}</h3></header>${relationDetails(adrian)}</aside>
    </div>
    <footer><strong>Regulă de creare</strong><p>Un agent nou este respins dacă lipsește departamentul, coordonatorul, raportarea, responsabilitatea, nivelul de acces, procedura sau escaladarea.</p></footer>
  </section>`;
}

export function bindTurnOrganizationChart() {
  const relationPanel = document.querySelector<HTMLElement>('#turnOrgRelations');
  if (!relationPanel) return;
  const showAgent = (agent: TurnOrganizationAgent) => {
    relationPanel.innerHTML = `<header><span>Relații selectate</span><h3 data-org-field="name">${escapeHtml(agent.name)}</h3></header>${relationDetails(agent)}`;
    document.querySelectorAll('[data-turn-org-agent]').forEach((button) => {
      button.classList.toggle('selected', (button as HTMLElement).dataset.turnOrgAgent === agent.id);
    });
  };
  document.querySelectorAll<HTMLButtonElement>('[data-turn-org-agent]').forEach((button) => {
    button.addEventListener('click', () => {
      const agent = turnOrganizationAgents.find((item) => item.id === button.dataset.turnOrgAgent);
      if (agent) showAgent(agent);
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-turn-org-department]').forEach((button) => {
    button.addEventListener('click', () => {
      const departmentId = button.dataset.turnOrgDepartment;
      document.querySelectorAll<HTMLDetailsElement>('[data-org-branch]').forEach((branch) => {
        branch.open =
          departmentId === 'leadership' ||
          branch.dataset.orgBranch === departmentId ||
          branch.dataset.orgBranch === 'leadership' ||
          branch.dataset.orgBranch === 'coordination';
      });
      const first = turnOrganizationAgents.find((agent) => agent.departmentId === departmentId);
      if (first) showAgent(first);
    });
  });
}
