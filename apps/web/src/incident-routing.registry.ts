import type { OperationalIncident } from './incident-journal';

type MonitoringEventRoutingInput = {
  monitorCode: string;
  checkId: string;
  component: string;
  summary: string;
  observedResult: string;
};

export type IncidentRouteId = 'production-access' | 'api-runtime' | 'public-routing' | 'secret-lifecycle';
export type ActivationMode = 'automatic-readonly' | 'authorization-required';
export type RecoveryAttempt = { mechanism: string; outcome: 'PASS' | 'FAILED' | 'UNAVAILABLE'; safeDetail: string };
export type EscalationReason = 'PRODUCT_DECISION' | 'SCOPE_CHANGE' | 'MAJOR_RISK' | 'IRREVERSIBLE_ACTION' | 'AUTHORITY_CONFLICT' | 'INTERNAL_RECOVERY_EXHAUSTED';

export type IncidentRoute = {
  id: IncidentRouteId;
  match: { monitorCodes: string[]; checkTerms: string[] };
  owner: string; executor: string; guardian: string | null; validator: string;
  monitors: string[]; consulted: string[];
  privilegedAction: string; recoveryChannel: string;
  executionRequiresAuthorization: boolean;
  recoveryMechanisms: string[];
  procedure: string[];
};

export type AgentActivation = { agentId: string; role: 'owner' | 'executor' | 'guardian' | 'validator' | 'monitor' | 'consulted'; mode: ActivationMode; status: 'ACTIVE' | 'AWAITING AUTHORIZATION' };
export type TurnAuthorization = { authorizationId: string; routeId: IncidentRouteId; actor: string; authorizedAt: string };

export const incidentRoutingRegistry: IncidentRoute[] = [
  {
    id: 'production-access', match: { monitorCodes: ['MON-001', 'MON-012'], checkTerms: ['ssh', 'production access', 'credential', 'authorized_keys', 'rescue'] },
    owner: 'release-operations', executor: 'backend-infrastructure', guardian: 'secret-credentials-guardian', validator: 'agent-inspector', monitors: ['monitor-server-primary', 'monitor-security', 'monitor-incidents'], consulted: ['architecture-inspector'],
    privilegedAction: 'Modificarea accesului sau a cheilor necesită autorizare Turn explicită.', recoveryChannel: 'Guardian folosește exclusiv o identitate deja autorizată sau Hetzner API/Rescue automatizat; introducerea manuală a cheilor în consola web este interzisă.', executionRequiresAuthorization: true,
    recoveryMechanisms: ['identitate SSH deja autorizată', 'Hetzner API', 'Rescue automatizat', 'custodie Guardian'],
    procedure: ['Activează automat agenții desemnați.', 'Inventariază și încearcă mecanismele interne autorizate fără expunerea secretelor.', 'Guardian validează metadatele identității.', 'Release & Operations execută recuperarea prin canalul disponibil.', 'Escaladează numai pentru criteriile rezervate sau după epuizarea documentată a mecanismelor interne.', 'Inspectorul confirmă preflight PASS și închiderea.'],
  },
  {
    id: 'api-runtime', match: { monitorCodes: ['MON-003'], checkTerms: ['api', 'health', 'ready', 'runtime'] },
    owner: 'backend-infrastructure', executor: 'release-operations', guardian: null, validator: 'agent-inspector', monitors: ['monitor-api', 'monitor-database', 'monitor-incidents'], consulted: ['architecture-inspector'],
    privilegedAction: 'Restartul local reversibil folosește drepturile administrative deja autorizate; deploy-ul Production necesită fereastra sa autorizată.', recoveryChannel: 'Release & Operations execută runbook-ul runtime și mecanismele administrative disponibile.', executionRequiresAuthorization: false,
    recoveryMechanisms: ['oprire controlată runtime', 'terminare administrativă WMI', 'restart serviciu', 'restart controlat sistem', 'pornire build canonic'],
    procedure: ['Confirmă incidentul API și activează automat agenții desemnați.', 'Validează health/readiness și dependențele.', 'Execută în ordine mecanismele interne autorizate până la recovery.', 'Validează endpointul pe portul oficial și testul funcțional relevant.', 'Escaladează numai dacă mecanismele sunt epuizate sau apare un criteriu rezervat.', 'Inspectorul validează și închide incidentul.'],
  },
  {
    id: 'public-routing', match: { monitorCodes: ['MON-008'], checkTerms: ['cloudflare', 'tunnel', 'dns', 'public route'] },
    owner: 'release-operations', executor: 'release-operations', guardian: null, validator: 'agent-inspector', monitors: ['monitor-cloudflare', 'monitor-server-primary', 'monitor-incidents'], consulted: ['architecture-inspector'],
    privilegedAction: 'Schimbarea rutării necesită autorizare Turn explicită.', recoveryChannel: 'Release & Operations folosește API-ul și configurația declarativă Cloudflare.', executionRequiresAuthorization: true,
    recoveryMechanisms: ['Cloudflare API', 'configurație declarativă', 'rollback origine validată'],
    procedure: ['Activează agenții desemnați.', 'Verifică DNS, tunnel și ingress.', 'Încearcă mecanismele interne autorizate.', 'Aplică schimbarea autorizată declarativ.', 'Validează ruta din exterior.', 'Inspectorul închide incidentul.'],
  },
  {
    id: 'secret-lifecycle', match: { monitorCodes: ['MON-012'], checkTerms: ['secret', 'credentials guardian', 'token', 'key', 'rotation', 'invalid'] },
    owner: 'secret-credentials-guardian', executor: 'secret-credentials-guardian', guardian: 'secret-credentials-guardian', validator: 'agent-inspector', monitors: ['monitor-security', 'monitor-incidents'], consulted: ['architecture-inspector', 'release-operations'],
    privilegedAction: 'Generarea, instalarea, rotația sau revocarea necesită autorizare Turn explicită.', recoveryChannel: 'Guardian operează prin magazinul de secrete și API-urile autorizate; valorile nu sunt introduse manual în UI.', executionRequiresAuthorization: true,
    recoveryMechanisms: ['secret manager aprobat', 'custodie DPAPI', 'API furnizor', 'rotație și revocare controlată'],
    procedure: ['Activează agenții desemnați.', 'Guardian validează numai metadatele secretului.', 'Încearcă mecanismele interne autorizate.', 'Aplică instalarea sau rotația prin canal securizat.', 'Reverifică serviciul dependent.', 'Inspectorul validează telemetria și închiderea.'],
  },
];

function routeText(input: MonitoringEventRoutingInput | OperationalIncident) { return 'monitorCode' in input ? `${input.monitorCode} ${input.checkId} ${input.component} ${input.summary} ${input.observedResult}`.toLowerCase() : `${input.module} ${input.category} ${input.symptom} ${input.cause}`.toLowerCase(); }
export function routeIncident(input: MonitoringEventRoutingInput | OperationalIncident): IncidentRoute | null { const text = routeText(input); return incidentRoutingRegistry.map((route) => ({ route, score: (route.match.monitorCodes.some((code) => text.includes(code.toLowerCase())) ? 1 : 0) + route.match.checkTerms.filter((term) => text.includes(term)).length * 10 })).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score)[0]?.route ?? null; }
export function activateIncidentRoute(route: IncidentRoute): AgentActivation[] { const activations = new Map<string, AgentActivation>(); const add = (agentId: string, role: AgentActivation['role'], privileged = false) => { if (!activations.has(`${agentId}:${role}`)) activations.set(`${agentId}:${role}`, { agentId, role, mode: privileged ? 'authorization-required' : 'automatic-readonly', status: privileged ? 'AWAITING AUTHORIZATION' : 'ACTIVE' }); }; add(route.owner, 'owner'); add(route.executor, 'executor', route.executionRequiresAuthorization); if (route.guardian) add(route.guardian, 'guardian', true); add(route.validator, 'validator'); route.monitors.forEach((agent) => add(agent, 'monitor')); route.consulted.forEach((agent) => add(agent, 'consulted')); return [...activations.values()]; }
export function authorizeIncidentRoute(activations: AgentActivation[], authorization: TurnAuthorization) { if (!authorization.authorizationId.trim() || !authorization.actor.trim() || !authorization.authorizedAt.trim()) throw new Error('TURN_AUTHORIZATION_REQUIRED'); return activations.map((activation) => activation.mode === 'authorization-required' ? { ...activation, status: 'ACTIVE' as const } : activation); }
export function assessProductOwnerEscalation(route: IncidentRoute, attempts: readonly RecoveryAttempt[], reservedReason?: Exclude<EscalationReason, 'INTERNAL_RECOVERY_EXHAUSTED'>) { if (reservedReason) return { allowed: true as const, reason: reservedReason }; if (attempts.some((attempt) => attempt.outcome === 'PASS')) return { allowed: false as const, reason: 'RECOVERED_INTERNAL' as const }; const attempted = new Set(attempts.map((attempt) => attempt.mechanism)); const relevant = attempts.filter((attempt) => route.recoveryMechanisms.includes(attempt.mechanism)); const exhausted = route.recoveryMechanisms.every((mechanism) => attempted.has(mechanism)) && relevant.every((attempt) => attempt.outcome !== 'PASS'); return exhausted ? { allowed: true as const, reason: 'INTERNAL_RECOVERY_EXHAUSTED' as const } : { allowed: false as const, reason: 'INTERNAL_RECOVERY_REQUIRED' as const }; }
