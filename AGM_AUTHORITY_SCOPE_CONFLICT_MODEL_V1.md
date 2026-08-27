# Authority Scope Conflict Model v1

**Contract ID:** `AGM-AUTH-SCOPE-CONFLICT-v1`  
**Versiune:** `1.0.0`  
**Data:** 2026-08-24  
**Autoritate:** Human Authority / Product Owner AGM  
**Stare:** `APPROVED ARCHITECTURAL FOUNDATION / NOT IMPLEMENTED`  
**Contracte asociate:** `AGM_PREMIUM_GOVERNANCE_AGENT_NETWORK_CONTRACT_V1.md`, `AGM_COPILOT_AUTHORITY_FAILOVER_MATRIX_V1.md`

## 1. Scop

Modelul definește cum detectează AGM conflictele dintre Authority Leases cu
scope-uri ierarhice, resurse și write capabilities suprapuse.

Invariant:

```text
NO OVERLAPPING EXECUTIVE WRITE AUTHORITY
```

`scopeId` nu este singur suficient. Autoritatea efectivă este intersecția dintre
scope, write set, resource selectors, tenant și mode.

## 2. Termeni canonici

### Scope node

Un scope este o cale ierarhică versionată:

```text
basic
premium
premium.car-mover
premium.car-mover.planning
premium.car-mover.operations
premium.car-mover.accounting
premium.car-mover.archive
```

Fiecare nod declară `parentScopeId`, owner, resurse deținute și capabilități
permise. Ierarhia nu conferă implicit write authority.

### Read set

Lista capabilităților de citire. Read-only nu intră în conflict cu un lease
executiv dacă nu poate produce mutații indirecte.

### Write set

Lista nominală a comenzilor pe care lease-ul le poate solicita, de exemplu:

```text
opportunity.normalized.write
opportunity.estimate.write
opportunity.verdict.write
car-mover.job.create
car-mover.job.transition
car-mover.incident.write
car-mover.hold.write
car-mover.accounting.actual.write
car-mover.archive.retention.write
authority.lease.issue
```

Wildcard-urile sunt interzise implicit pentru providerii externi. Orice excepție
necesită contract versionat și aprobare explicită.

### Resource selector

Restrânge write set-ul la resurse concrete:

```text
tenantId
productId
moduleId
subjectType
subjectId | subjectIdSet | predicateId
commandTypeSet
```

Predicatele arbitrare furnizate de provider sunt interzise. `predicateId` trebuie
să indice o regulă AGM înregistrată și versionată.

## 3. Modelul normativ

```ts
type AuthorityScope = {
  scopeId: string;
  parentScopeId?: string;
  ownerId: string;
  resourceOwnership: readonly string[];
  allowedReadSet: readonly string[];
  allowedWriteSet: readonly string[];
  contractVersion: 'authority-scope.v1';
};

type ExecutiveLeaseIntent = {
  requestId: string;
  scopeId: string;
  mode: 'EXECUTE';
  tenantId: string;
  agentId: string;
  providerId: string;
  mandateId: string;
  readSet: readonly string[];
  writeSet: readonly string[];
  resourceSelectors: readonly ResourceSelector[];
};
```

Tipurile sunt normative conceptual; prezentul contract nu autorizează încă
introducerea lor în cod.

## 4. Regula de conflict

Două lease-uri `A` și `B` sunt în conflict dacă toate condițiile sunt adevărate:

1. ambele sunt `EXECUTE` și active în aceeași fereastră;
2. tenant scope se intersectează;
3. write set-urile se intersectează sau unul îl subsumează pe celălalt;
4. resource selectors se intersectează sau intersecția nu poate fi demonstrată
   ca fiind vidă;
5. scope-urile sunt identice, ancestor/descendant sau dețin aceleași resurse.

Principiul este `deny on uncertainty`: dacă disjuncția nu poate fi demonstrată,
Control Plane răspunde `DENIED / CONFLICT`.

## 5. Coexistență permisă

| Lease A | Lease B | Verdict |
|---|---|---|
| parent `ADVISORY` | child `EXECUTE` | permis, deoarece parent nu are write authority |
| planning `EXECUTE` pe estimates | accounting `EXECUTE` pe actual ledger | permis numai dacă write sets și resources sunt demonstrabil disjuncte |
| două child scopes executive cu subject ID sets disjuncte | executive | permis, cu dovada disjuncției persistată |
| aceeași cerere repetată cu același `requestId` | lease existent | `IDEMPOTENT_EXISTING`; nu se emite token nou |

Coexistența nu se deduce doar din numele modulelor. Ea trebuie demonstrată prin
write sets și resource selectors canonice.

## 6. Cazuri obligatoriu respinse

| Caz | Motiv | Rezultat |
|---|---|---|
| `premium` executive + `premium.car-mover` executive cu job writes | ancestor/descendant și write overlap | `DENIED_SCOPE_WRITE_CONFLICT` |
| două lease-uri pe `car-mover.job.transition` pentru același Job | aceeași resursă și comandă | `DENIED_RESOURCE_CONFLICT` |
| lease cu write wildcard de la provider extern | write set nedeterminat | `DENIED_UNBOUNDED_WRITE_SET` |
| resource selector arbitrar/neînregistrat | intersecție neverificabilă | `DENIED_UNKNOWN_SELECTOR` |
| lease nou cu epoch egal/inferior | authority stale | `DENIED_STALE_EPOCH` |
| provider încearcă să își extindă write set-ul | mandat neschimbat | `DENIED_MANDATE_EXPANSION` |
| aceeași acțiune cu alt idempotency key după timeout | risc duplicate execution | `DENIED_IDEMPOTENCY_MISMATCH` sau review manual |

## 7. Algoritmul de admitere

```text
1. Authenticate requester; providers cannot issue leases.
2. Validate mandate, requested mode and contract version.
3. Resolve scope node and all ancestors.
4. Verify requested read/write sets are subsets of scope policy and mandate.
5. Resolve resource selectors to canonical sets or registered predicates.
6. Load every ACTIVE/AUTHORIZED/DRAINING executive lease that can overlap.
7. Compare tenant, write capabilities, resource ownership and selectors.
8. If any overlap exists or disjunction is unprovable: DENY.
9. If requestId already owns the identical lease: return existing lease.
10. Otherwise increment epoch/fencing token atomically and persist one lease.
11. Append signed audit event before returning the lease.
```

Lease issuance, epoch increment și audit append trebuie să fie o singură operație
atomică. Nu este permisă emiterea tokenului înaintea persistării deciziei.

## 8. Domain-boundary enforcement

Conflict detection la emitere nu este suficient. Fiecare write verifică din nou:

```text
authorityLeaseId
epoch
fencingToken
mandateId
decisionId
idempotencyKey
tenantId
subject/resource selector
command type
lease state and expiry
```

Domain service nu are încredere în UI, Orchestrator sau provider pentru această
validare. O comandă fenced nu poate fi reîncercată cu un token nou fără
reconcilierea idempotency/decision state.

## 9. Scope ownership inițial

| Scope | Owner | Write ownership permis |
|---|---|---|
| `premium` | Premium Governance | workflow/handoff only; fără wildcard domain writes |
| `premium.car-mover.planning` | Car Mover Planning | intake, normalized opportunities, estimates, plans, verdicts |
| `premium.car-mover.operations` | Car Mover Operations | Job commands, protocols, Incident, Operational Hold, Evidence |
| `premium.car-mover.accounting` | Primary Accounting | actual financial entries și invoices documentate |
| `premium.car-mover.archive` | Data Governance | retention, preserve, compaction și archive records |
| `premium.recovery` | Operations & Reliability | numai acțiunile nominale din runbook-ul mandatat |
| `agm.authority` | Human Authority / Control Plane | mandate, decision, lease, epoch și fencing |
| `agm.secrets` | Secret & Credentials Guardian | secret lifecycle și grants; niciun business write |

Premium Orchestrator nu primește automat write ownership asupra child scopes. El
coordonează prin comenzi către ownerul de domeniu.

## 10. Scope Collision Test

### Test minim obligatoriu

1. se emite lease executiv A pentru `premium`, cu write set care include
   `car-mover.job.transition`;
2. se solicită lease executiv B pentru `premium.car-mover.operations`, cu aceeași
   capabilitate și același tenant;
3. Control Plane trebuie să răspundă `DENIED / CONFLICT`;
4. epoch-ul nu este incrementat pentru B;
5. nu este emis al doilea fencing token;
6. auditul conține cererea, conflictul și lease-ul activ care a cauzat refuzul;
7. domain boundary continuă să accepte numai tokenul A.

### Suita obligatorie

| Test ID | Caz | Rezultat |
|---|---|---|
| `SCOPE-01` | same scope, same write, same resource | deny conflict |
| `SCOPE-02` | parent/child, overlapping write | deny conflict |
| `SCOPE-03` | parent advisory, child executive | allow |
| `SCOPE-04` | planning estimates vs accounting actual | allow only with proven disjoint sets |
| `SCOPE-05` | different Job IDs, canonical disjoint selectors | allow și persist proof |
| `SCOPE-06` | unknown selector | deny |
| `SCOPE-07` | identical request replay | existing lease, no new token |
| `SCOPE-08` | stale epoch write | deny before mutation |
| `SCOPE-09` | failover while old command delayed | old token denied, new token accepted once |
| `SCOPE-10` | recovery runbook requests out-of-bounds action | deny/new authorization required |

## 11. Audit minim

Fiecare admitere/refuz consemnează:

- request și lease IDs;
- scope și resolved ancestors;
- read/write sets;
- resource selector hashes;
- conflicting lease IDs, fără date sensibile;
- mandate și decision references;
- epoch/fencing outcome;
- policy și contract versions;
- actor/issuer;
- timestamp și correlation ID;
- verdict și reason code.

## 12. Criterii PASS

Modelul primește PASS numai dacă:

1. toate scope-urile executive au owner și write set nominal;
2. wildcard-urile providerilor sunt respinse;
3. parent/child overlap este detectat;
4. disjuncția resources este demonstrabilă și auditabilă;
5. lease issuance și fencing sunt atomice;
6. replay-ul identic nu emite token nou;
7. stale writes sunt respinse la domain boundary;
8. toate testele `SCOPE-01` - `SCOPE-10` sunt PASS;
9. niciun provider nu poate modifica scope graph sau conflict policy.

