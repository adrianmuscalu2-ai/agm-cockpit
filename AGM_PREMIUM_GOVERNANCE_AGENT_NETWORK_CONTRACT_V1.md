# Premium Governance & Agent Network v1

**Contract ID:** `AGM-PREM-GOV-NET-v1`  
**Versiune:** `1.0.0`  
**Data:** 2026-08-24  
**Autoritate:** Human Authority / Product Owner AGM  
**Stare:** `APPROVED ARCHITECTURAL FOUNDATION / NOT IMPLEMENTED`  
**Domeniu:** AGM Premium, cu extensia inițială Car Mover  
**Efect:** contract normativ; nu autorizează implementare, deployment, acces la secrete sau activarea providerilor

## 1. Scop

Prezentul contract definește guvernanța Premium, identitatea și limitele rețelei
de agenți și servicii, separarea autorităților, regulile de execuție, recovery,
telemetrie și continuitate operațională.

Contractul trebuie închis și verificat împreună cu:

- `AGM_COPILOT_AUTHORITY_FAILOVER_MATRIX_V1.md`;
- `AGM_AUTHORITY_SCOPE_CONFLICT_MODEL_V1.md`.

Opportunity Intelligence rămâne `NO-GO` pentru implementare până când această
fundație primește un Gate tehnic `PASS`.

## 2. Precedență și compatibilitate

Pentru guvernanța Premium și Car Mover, acest contract are precedență asupra
oricărei formulări legacy care:

- tratează un provider extern drept proprietar al unui agent AGM;
- folosește `Architecture Guardian` sau un alt Guardian în afara domeniului
  secretelor și credentialelor;
- permite unui Incident să blocheze implicit un Job;
- confundă Incident, Operational Hold, Cancellation sau runtime failure;
- permite Orchestratorului ori Inspectorului să își aprobe propria execuție;
- permite dual-write sau două autorități executive active pe write scope-uri
  suprapuse.

Compatibilitatea legacy poate păstra identificatori sau stări vechi la citire,
dar toate operațiile noi respectă semantica prezentului contract.

## 3. Invariante fundamentale

1. Agenții aparțin AGM; providerii sunt executori substituibili.
2. Persistența, mandatele, deciziile, authority state și auditul aparțin AGM.
3. `Secret & Credentials Guardian` este singurul Guardian al sistemului.
4. Authority grant și secret grant sunt contracte independente.
5. Basic Governance și Premium Governance sunt separate la nivel de roluri,
   scope și responsabilitate.
6. Infrastructura comună AGM poate furniza authority, audit, secrets, telemetry,
   fencing și decision records fără amestecarea guvernanței de domeniu.
7. Inspectorii inspectează; Orchestratorul orchestrează; agenții și serviciile
   execută; autoritatea umană decide consecințele reale.
8. Niciun copilot nu se poate auto-promova.
9. `ONE SCOPE -> ONE ACTIVE EXECUTIVE AUTHORITY`.
10. `NO OVERLAPPING EXECUTIVE WRITE AUTHORITY`.
11. Premium se degradează local, nu global.
12. Telemetria observă; nu comandă și nu primește authority.

## 4. Structura de autoritate

```text
Human Authority / Product Owner
|
+-- Secret & Credentials Guardian (unic)
|
+-- AGM Authority Control Plane
|   +-- Mandate Registry
|   +-- Decision Registry
|   +-- Authority Lease / Epoch / Fencing
|   +-- Provider Binding / Failover State
|   +-- Audit Journal
|   `-- Telemetry Collector
|
+-- Premium Architecture Inspector (independent)
+-- Premium Release Inspector (independent)
|
`-- Premium Orchestrator
    +-- Opportunity Planning
    +-- Active Car Mover Operations
    +-- Primary Accounting
    +-- Archive & Retention
    +-- Copilot Gateway
    `-- Recovery Executor
```

Human Authority este singura autoritate care aprobă schimbări arhitecturale,
acțiuni comerciale și operaționale materiale sau extinderi de mandat.

## 5. Separarea Basic / Premium

Basic și Premium au politici, orchestratori, inspectori și mandate distincte.
Ele pot utiliza aceeași infrastructură tehnică AGM, însă:

- un lease Basic nu conferă drepturi Premium;
- un lease Premium nu conferă drepturi Basic;
- provider binding-ul se emite separat pentru fiecare scope;
- evidence-ul și verdicturile se păstrează pe guvernanța corespunzătoare;
- cross-module recovery necesită mandat explicit și nu produce ownership comun.

## 6. Contractul identității AGM

Identitatea canonică a unui agent sau serviciu este independentă de provider.

```text
canonicalId
kind
module
owner
supervisor
contractVersion
readScope[]
writeScope[]
prohibitedActions[]
requiredCapabilities[]
humanApprovalBoundary
telemetryRequirement
allowedProviders[]
fallbackProviders[]
recoveryPolicy
lifecycleStatus
```

Un provider binding este o asociere temporară între `canonicalId`, `providerId`,
`mandateId` și un Authority Lease. Schimbarea providerului nu creează un agent
nou și nu resetează istoricul agentului AGM.

## 7. Catalogul canonic inițial Premium

Legendă provider: `LOCAL` înseamnă runtime determinist controlat de AGM, fără
dependență de un copilot extern.

| Canonical ID | Tip / modul | Owner / supervisor | Read scope | Write scope | Provideri permiși / fallback | Aprobare / telemetrie |
|---|---|---|---|---|---|---|
| `agm.human.product-owner` | human authority / global | Product Owner / n/a | toate referințele autorizate | decision și mandate records | niciun provider | autoritate umană; audit obligatoriu |
| `agm.guardian.secrets` | specialized authority / secrets | Product Owner / independent | secret metadata și policy | secret lifecycle/grants | `LOCAL` | aprobare conform clasei secretului; health metadata only |
| `agm.authority.control-plane` | control-plane service / shared | Product Owner / Architecture Inspector | registries, policies, leases | mandate, decision, lease, fencing, audit | `LOCAL` | mutații privilegiate auditate; telemetry obligatorie |
| `premium.architecture-inspector` | inspector / Premium | Independent Assurance / Product Owner | contracte, ownership, evidence | findings și verdict arhitectural | provider-neutral; deterministic checks preferate | nu implementează; telemetry obligatorie |
| `premium.release-inspector` | inspector / Premium | Independent Assurance / Product Owner | artefacte, teste, release evidence | verdict release | provider-neutral; deterministic checks preferate | nu execută release-ul; telemetry obligatorie |
| `premium.orchestrator` | orchestrator / Premium | Premium Operations / Product Owner | workflow state, decision refs, health | workflow și handoff records | Gemini; GitHub; Codex emergency | human decision pentru consecințe reale; telemetry obligatorie |
| `premium.recovery-executor` | bounded executor / Premium | Operations & Reliability / Release Inspector validează | runbook, target state, mandate | exclusiv acțiuni din runbook | `LOCAL` implicit | mandat și fencing obligatorii; telemetry obligatorie |
| `premium.car-mover.intake-dedup` | deterministic service / planning | Car Mover Planning / Premium Orchestrator | mesaje și alerte autorizate | normalized intake records | `LOCAL` | fără acceptare comercială; telemetry proporțională |
| `premium.car-mover.opportunity-normalizer` | deterministic service / planning | Car Mover Planning / Premium Orchestrator | intake records | normalized opportunities | `LOCAL` | fără Job File; telemetry proporțională |
| `premium.car-mover.route-mobility` | analysis agent / planning | Car Mover Planning / Premium Orchestrator | opportunity, route/public mobility data | route estimates only | Gemini; GitHub; Codex | `PROPOSE` only; telemetry obligatorie |
| `premium.car-mover.cost-risk` | deterministic engine + analysis agent | Car Mover Planning / Premium Orchestrator | normalized opportunity și route estimates | cost/risk estimates only | `LOCAL` pentru calcule; Gemini/GitHub/Codex pentru explicații | zero accounting write; telemetry obligatorie |
| `premium.car-mover.opportunity-planner` | planning agent / planning | Car Mover Planning / Premium Orchestrator | specialist outputs | plans/chains de 1-3 curse | Gemini; GitHub; Codex | `PROPOSE` only; telemetry obligatorie |
| `premium.car-mover.opportunity-judge` | evaluation agent / planning | Car Mover Planning / Premium Orchestrator | planuri, estimates, policy | verdict versionat | Gemini; GitHub; Codex | verdictul nu acceptă oferta; telemetry obligatorie |
| `premium.copilot-gateway` | gateway / Premium | Premium Experience / Premium Orchestrator | rezultate și context autorizat | conversation/handoff records | Gemini; GitHub; Codex | fără domain write; telemetry obligatorie |
| `premium.car-mover.job-service` | authoritative domain service | Car Mover Operations / Premium Orchestrator | decisions și Job state | `CarMoverJob` commands | `LOCAL` | `decisionId` pentru acțiuni materiale; audit obligatoriu |
| `premium.car-mover.incident-service` | domain service | Car Mover Operations / Premium Orchestrator | subject/evidence refs | Incident lifecycle | `LOCAL` | nu modifică Job lifecycle; audit obligatoriu |
| `premium.car-mover.evidence-service` | domain service | Car Mover Operations / Premium Orchestrator | subject, consent, retention | evidence metadata/bindings | `LOCAL` | fără secret/raw telemetry; audit obligatoriu |
| `premium.car-mover.primary-accounting` | authoritative actual domain | Finance / Product Owner policy | completed Job și documente reale | actual ledger/invoices | `LOCAL` | zero estimate import automat; telemetry obligatorie |
| `premium.car-mover.archive-retention` | deterministic service | Data Governance / Premium Orchestrator | completed Job, evidence policy | retention state/compaction records | `LOCAL` | `PRESERVE` are prioritate; audit obligatoriu |

Acest catalog este seed-ul normativ pentru viitorul Premium Agent Network
Registry. El nu reprezintă încă o înregistrare runtime activă.

### 7.1 Declarații obligatorii pentru registrul viitor

Toate intrările de mai jos au `lifecycleStatus = CONTRACTED_NOT_IMPLEMENTED` până
la înregistrarea și validarea runtime. `fallback=[]` înseamnă că serviciul se
degradează local/manual și nu este preluat de un provider extern.

| Canonical ID | Required capability | Prohibited actions | Human approval boundary | Telemetry | Allowed providers / fallback | Recovery policy |
|---|---|---|---|---|---|---|
| `agm.human.product-owner` | `governance.decide` | execuție tehnică și validarea propriei execuții | este chiar authority boundary | audit decision/mandate | `allowed=[]; fallback=[]` | delegat uman valid sau material writes intră în hold |
| `agm.guardian.secrets` | `secrets.custody` | business writes, lease issuance, failover control, divulgare secret | granturile sensibile urmează politica umană aplicabilă | health/status metadata only | `allowed=[LOCAL]; fallback=[]` | conservare sigură și escaladare; fără transfer de custody |
| `agm.authority.control-plane` | `authority.control` | decizie comercială, secret disclosure, auto-extindere policy | privileged policy changes cer authority umană | obligatorie, content-free | `allowed=[LOCAL]; fallback=[]` | fail-closed pentru provider writes; manual safe mode |
| `premium.architecture-inspector` | `premium.architecture.inspect` | implementare, domain writes, self-approval | verdictul merge la Product Owner | obligatorie | `allowed=[LOCAL,CODEX,GITHUB,GEMINI]; fallback=[LOCAL]` | deterministic/read-only inspection |
| `premium.release-inspector` | `premium.release.inspect` | deploy, rollback execution, self-approval | Product Owner acceptă release-ul | obligatorie | `allowed=[LOCAL,CODEX,GITHUB,GEMINI]; fallback=[LOCAL]` | release rămâne fără PASS; produsul existent continuă |
| `premium.orchestrator` | `premium.workflow.orchestrate` | architecture redefine, release approval, direct child-domain writes | orice consecință reală cere `decisionId` | obligatorie | `allowed=[GEMINI,GITHUB,CODEX]; fallback=[GITHUB,CODEX]` | provider failover prin Authority Control Plane; apoi manual workflow |
| `premium.recovery-executor` | `premium.recovery.runbook.execute` | pași în afara runbook-ului, redesign, scope expansion, secret custody | mandat explicit pentru fiecare runbook/scope | obligatorie | `allowed=[LOCAL]; fallback=[]` | stop sigur și `NEW_AUTHORIZATION_REQUIRED` |
| `premium.car-mover.intake-dedup` | `car-mover.opportunity.intake` | Job creation, commercial decision, raw secret capture | nu, cât timp rămâne deterministic intake | proporțională | `allowed=[LOCAL]; fallback=[]` | queue/outbox și reluare idempotentă |
| `premium.car-mover.opportunity-normalizer` | `car-mover.opportunity.normalize` | Job creation, verdict, accounting write | nu | proporțională | `allowed=[LOCAL]; fallback=[]` | queue/outbox și replay idempotent |
| `premium.car-mover.route-mobility` | `car-mover.opportunity.route.propose` | Job/accounting writes, acceptance, source fabrication | decizia comercială este umană | obligatorie | `allowed=[GEMINI,GITHUB,CODEX]; fallback=[GITHUB,CODEX]` | `DEGRADED/RECALCULATION_REQUIRED`; fără blocare globală |
| `premium.car-mover.cost-risk` | `car-mover.opportunity.cost-risk.propose` | ledger/invoice write, transformarea estimate în actual | decizia comercială este umană | obligatorie | `allowed=[LOCAL,GEMINI,GITHUB,CODEX]; fallback=[LOCAL,GITHUB,CODEX]` | calcul deterministic local; explicația poate lipsi |
| `premium.car-mover.opportunity-planner` | `car-mover.opportunity.chain.propose` | Job creation, acceptare, duplicarea arbitrară a calculelor specialist | acceptarea chain-ului este umană | obligatorie | `allowed=[GEMINI,GITHUB,CODEX]; fallback=[GITHUB,CODEX]` | planning degraded; single-job manual fallback |
| `premium.car-mover.opportunity-judge` | `car-mover.opportunity.verdict.propose` | acceptare, anulare, Operational Hold, domain write | verdictul nu este decizie | obligatorie | `allowed=[GEMINI,GITHUB,CODEX]; fallback=[GITHUB,CODEX]` | rezultat indisponibil/stale; fără acțiune implicită |
| `premium.copilot-gateway` | `premium.copilot.present` | calcul autoritativ, verdict, business/domain write | confirmare umană înaintea handoff-ului executiv | obligatorie | `allowed=[GEMINI,GITHUB,CODEX]; fallback=[GITHUB,CODEX]` | provider failover sau UI/manual presentation |
| `premium.car-mover.job-service` | `car-mover.job.command` | lease issuance, decision fabrication, estimate import automat | create/accept/cancel/hold material cer policy/decision aplicabil | audit obligatoriu | `allowed=[LOCAL]; fallback=[]` | manual safe operation și outbox |
| `premium.car-mover.incident-service` | `car-mover.incident.command` | Job state mutation, implicit hold/cancellation | dispozițiile materiale cer authority aplicabilă | audit obligatoriu | `allowed=[LOCAL]; fallback=[]` | incidentul rămâne persistent și independent |
| `premium.car-mover.evidence-service` | `car-mover.evidence.command` | secret telemetry, policy bypass, delete sub `PRESERVE` | ștergerea/preservarea urmează retention authority | audit obligatoriu | `allowed=[LOCAL]; fallback=[]` | preserve local/durable conform clasificării |
| `premium.car-mover.primary-accounting` | `car-mover.accounting.actual.command` | estimate write/import, pre-completion actual posting, AI direct write | politica financiară și documentele reale sunt obligatorii | obligatorie | `allowed=[LOCAL]; fallback=[]` | queue/manual accounting; zero contamination din estimates |
| `premium.car-mover.archive-retention` | `car-mover.archive.retention.command` | compactare sub `PRESERVE`, ștergere fără manifest/audit | excepțiile și legal holds cer authority aplicabilă | audit obligatoriu | `allowed=[LOCAL]; fallback=[]` | suspendă compactarea și păstrează evidence-ul relevant |

## 8. Acțiuni interzise

Niciun provider sau agent de analiză nu poate:

- emite ori modifica un Authority Lease;
- modifica `CarMoverJob`, Incident, Evidence, Archive sau contabilitatea direct;
- transforma un verdict în acceptare, anulare sau Operational Hold;
- obține secrete doar pentru că a primit authority;
- extinde scope-ul, write set-ul sau durata mandatului;
- suprascrie un verdict anterior;
- modifica politica de guvernanță în timpul failover-ului;
- prezenta lipsa telemetriei drept oprire globală a produsului.

## 9. PROPOSE -> DECIDE -> EXECUTE

```text
PROPOSE
  proposalId + version + sources + freshness + assumptions
  + confidence + inputHash + logic/modelVersion

DECIDE
  decisionId + humanAuthorityId + proposalVersion
  + approvedAction + bounds + decidedAt

EXECUTE
  domain command + mandateId + decisionId + authorityLeaseId
  + epoch + fencingToken + idempotencyKey
```

Serviciul de domeniu verifică integral comanda. Providerul AI nu primește port de
scriere direct asupra agregatului autoritativ.

## 10. Opportunity Intelligence

Fluxul aprobat este:

```text
Platform Intake & Deduplication Service
-> Opportunity Normalizer
-> Route & Mobility Agent
-> Cost & Risk
-> Opportunity Planner
-> Opportunity Judge
-> Copilot Gateway
```

Reguli:

- Intake, dedup, persistence și calculele strict deterministe sunt servicii AGM.
- Route & Mobility produce estimări cu surse și freshness.
- Cost & Risk este exclusiv estimativ și nu are port de accounting write.
- Plannerul compune rezultatele specialiștilor; nu recalculează arbitrar aceleași
  valori.
- Judge produce `RECOMMENDED | ACCEPTABLE | WEAK | REJECT`, versionat și explicat.
- Copilot Gateway prezintă rezultatul; nu este Judge și nu este calculator.
- Opportunity Chain este plan, nu super-job.
- Fiecare cursă acceptată devine un `CarMoverJob` distinct numai după decizie umană.

## 11. Recovery Executor

Recovery Executor este `RUNBOOK-ONLY` implicit. Fiecare execuție cere:

- `runbookId` și versiune aprobată;
- target și scope explicit;
- mandat și decizie aplicabilă;
- lease AGM executiv valid;
- parametri aflați în limitele runbook-ului;
- precondition checks;
- idempotency key;
- audit și rezultat verificabil.

Orice pas absent din runbook, extindere de scope sau schimbare de contract produce
`DENIED / NEW AUTHORIZATION REQUIRED`. Inspectorul validează evidence-ul, dar nu
execută runbook-ul.

## 12. Incident, Hold și Cancellation

```text
Incident: OPEN -> DOCUMENTED -> UNDER_REVIEW -> RESOLVED -> CLOSED
OperationalHold: ACTIVE -> RELEASED
Cancellation: termination definitivă
```

- Incidentul este non-blocking implicit.
- Operational Hold este explicit, temporar, reversibil și limitat la un Job sau
  o acțiune.
- Hold-ul nu schimbă starea de bază a Job-ului; după `RELEASED`, Job-ul continuă
  din aceeași stare.
- Cancellation necesită decizie umană și audit.
- `BLOCKED` nu este folosit în contractele noi pentru un hold temporar.

Exemplu obligatoriu valid:

```text
Job = COMPLETED
Incident = UNDER_REVIEW
FinancialSettlement = PENDING
```

## 13. Degradare locală și manual fallback

Indisponibilitatea unui agent, provider sau collector afectează numai capabilitatea
dependentă. Trebuie să rămână disponibile, când infrastructura AGM locală este
sănătoasă:

- accesul la Job File;
- continuarea manuală a unei curse acceptate;
- protocoalele, Incident, Evidence și Operational Hold;
- arhivarea și accounting-ul local conform politicilor lor;
- consultarea datelor deja persistate;
- outbox-ul pentru operații externe amânate.

Rezultatele care depind de date externe stale sunt marcate `DEGRADED` sau
`RECALCULATION_REQUIRED`, nu prezentate ca actuale.

## 14. Telemetrie și release evidence

Telemetria inițial obligatorie se aplică Orchestratorului, Inspectorilor,
Recovery Executorului, Route & Mobility, Cost & Risk, Plannerului, Judge-ului,
Primary Accounting, Copilot Gateway și Authority Control Plane.

Câmpuri minime:

- health și dependency health;
- freshness și last run;
- duration;
- `PASS | DEGRADED | FAIL | NO_TELEMETRY`;
- errors și backlog;
- confidence unde este relevant;
- input/output references și hash-uri;
- contract/model/logic version.

Telemetria nu conține secrete, documente complete, fotografii brute, prompturi
sensibile sau payload-uri operaționale integrale.

`NO_TELEMETRY` nu oprește produsul existent. Separat, absența release evidence
obligatoriu poate împiedica emiterea unui nou verdict `PASS`.

## 15. Archive și retenție

Termenul de 45 de zile se aplică exclusiv media locală neesențială pentru
`PASS CLEAN`. Nu se aplică automat Incident/Claim evidence, documentelor
financiar-fiscale, contractuale, auditului sau datelor aflate sub legal hold.

```text
ACTIVE -> COMPACTION_DUE -> COMPACTED
   `---------------------> PRESERVE
PRESERVE -> RELEASED_FOR_COMPACTION -> COMPACTED
```

`PRESERVE` suspendă compactarea. Matricea juridică și de retenție pe categorii
este un contract separat necesar înainte de activarea automată a compactării.

## 16. Versionare, provenance și deduplicare

- aceeași ofertă multi-channel se corelează prin sursă, external reference,
  content hash și fereastră temporală;
- deduplicarea nu șterge proveniența surselor;
- fiecare rezultat conține timestamp, freshness, assumptions, confidence,
  input hash și logic/model version;
- o versiune nouă nu suprascrie versiunea anterioară;
- o decizie indică exact versiunea propunerii aprobate;
- Job A nu este invalidat retroactiv dacă Job B dintr-un chain nu mai este valid.

## 17. Gate de implementare

Implementarea AGM Authority Control Plane și înregistrarea runtime a rețelei
Premium pot începe numai după:

1. aprobarea și consistența celor trei contracte v1;
2. registrul canonic machine-readable proiectat;
3. modelul de scope/write conflict verificat;
4. contractele de lease, fencing, decision și idempotency fixate;
5. matricea de failover și manual fallback verificată;
6. testele failure/collision definite;
7. confirmarea separării Inspector / Executor / Guardian;
8. verdict Architecture Inspector `PASS`.

Opportunity Intelligence rămâne neautorizat până la închiderea acestui gate.
