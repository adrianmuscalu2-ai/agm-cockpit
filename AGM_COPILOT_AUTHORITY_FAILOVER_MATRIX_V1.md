# Copilot Authority & Failover Matrix v1

**Contract ID:** `AGM-COP-AUTH-FAIL-v1`  
**Versiune:** `1.0.0`  
**Data:** 2026-08-24  
**Autoritate:** Human Authority / Product Owner AGM  
**Stare:** `APPROVED ARCHITECTURAL FOUNDATION / NOT IMPLEMENTED`  
**Contract părinte:** `AGM_PREMIUM_GOVERNANCE_AGENT_NETWORK_CONTRACT_V1.md`

## 1. Principiu

GitHub, Codex și Gemini sunt provideri executivi substituibili. Niciun provider
nu este authority store, failover arbiter, secret owner sau proprietar al unui
mandat AGM.

```text
ONE SCOPE -> ONE ACTIVE EXECUTIVE AUTHORITY
NO COPILOT MAY SELF-PROMOTE
```

## 2. Matricea inițială

| Actor / provider | Basic | Premium | Cross-module recovery | Poate emite lease | Poate decide acțiuni reale | Acces la secrete |
|---|---|---|---|---|---|---|
| Codex | primary propus | emergency standby | secondary candidat | nu | nu | numai grant Guardian separat |
| GitHub | secondary | secondary | recovery provider preferat | nu | nu | numai grant Guardian separat |
| Gemini | emergency standby | primary propus | secondary candidat | nu | nu | numai grant Guardian separat |
| Basic Inspector | independent assurance Basic | fără autoritate Premium | validează numai scope-ul mandatului | nu | poate refuza PASS, nu aprobă business | fără acces implicit |
| Premium Architecture Inspector | fără autoritate Basic | architecture assurance | validează contract/scope/handoff | nu | poate refuza gate, nu execută | fără acces implicit |
| Premium Release Inspector | fără autoritate Basic | release assurance | validează recovery și revenire | nu | poate refuza PASS, nu execută | fără acces implicit |
| Secret & Credentials Guardian | secret authority Basic | secret authority Premium | neschimbat în failover | nu | numai decizii din domeniul secretelor | custode unic |
| Human Authority | decizie finală | decizie finală | autorizează/revocă mandat critic | prin AGM Control Plane | da | nu divulgă secrete |
| AGM Authority Control Plane | authority state Basic | authority state Premium | authority/fencing/audit | da, conform politicii | nu substituie decizia umană | secret references only |

Asocierea providerilor este o politică bootstrap, reevaluată periodic după
quality, availability, latency, cost, error rate, contract compliance, privacy
și tool capability. Ea nu reprezintă ownership permanent.

## 3. Moduri de autoritate

| Mod | Drepturi | Failover |
|---|---|---|
| `STANDBY` | health și pregătire; zero operații pe scope | nu necesită fencing executiv |
| `ADVISORY` | read autorizat și recomandări; zero domain write | poate fi mutat automat prin politică preaprobată |
| `PROPOSE` | produce propuneri versionate; zero domain write | poate fi mutat automat, cu provenance nou |
| `EXECUTE` | emite comenzi numai prin lease, decision și fencing | necesită autoritate umană sau mandat de urgență preaprobat și bounded |

Un provider poate avea moduri diferite pe scope-uri diferite. `EXECUTE` este
întotdeauna limitat de write set și resource selectors.

## 4. Starea failover-ului

```text
PRIMARY_ACTIVE
-> PRIMARY_SUSPECTED
-> PRIMARY_UNAVAILABLE
-> FAILOVER_REQUESTED
-> FAILOVER_AUTHORIZED
-> SECONDARY_ACTIVE
-> PRIMARY_RECOVERED_STANDBY
-> HANDOFF_PENDING
-> SECONDARY_DRAINING
-> PRIMARY_ACTIVE
```

Tranziții terminale/control: `FAILOVER_DENIED`, `MANUAL_ONLY`, `LEASE_EXPIRED`,
`AUTHORITY_REVOKED`.

Detecția indisponibilității poate fi automată. Emiterea unui lease executiv nu
este decisă de provider. Revenirea providerului principal nu produce takeover
automat.

## 5. Authority Lease

Un lease executiv conține minimum:

```text
authorityLeaseId
scopeId
agentId
providerId
mandateId
decisionPolicyRef
mode = EXECUTE
epoch
fencingToken
readSet[]
writeSet[]
resourceSelectors[]
inheritedContractHash
issuedBy
issuedAt
expiresAt
state
```

Providerul de rezervă moștenește `mandateId`, scope, contract hash, write set,
prohibited actions, approval boundaries și recovery policy. Nu le poate redefini.

## 6. Validarea oricărui write

Domain boundary cere:

- `authorityLeaseId` activ;
- `epoch` curent;
- `fencingToken` curent;
- `mandateId` identic;
- `decisionId` valid pentru acțiunile cu consecințe reale;
- `idempotencyKey` stabil;
- command type și resource în write set-ul lease-ului;
- tenant/company și subject ownership valide;
- lease neexpirat și nerevocat.

Orice neconcordanță produce refuz înaintea mutației. Un răspuns întârziat cu
token vechi este respins chiar dacă providerul a început calculul înainte de
failover.

## 7. Failover și handoff

### Activare secondary

1. health/freshness indică indisponibilitatea;
2. Control Plane marchează primary ca suspect, fără auto-promovare;
3. politica selectează candidatul permis;
4. conflict model verifică scope-ul și write set-ul;
5. authority umană sau mandatul bounded autorizează;
6. vechiul lease este revocat/expirat și fenced;
7. se emite un singur lease cu epoch superior;
8. secondary verifică inherited contract hash;
9. execuția începe sau se reia idempotent;
10. auditul consemnează fiecare tranziție.

### Revenirea primary

1. primary revine în `PRIMARY_RECOVERED_STANDBY`;
2. nu poate emite comenzi;
3. secondary finalizează operația sau ajunge la checkpoint sigur;
4. se emit output hash și handoff receipt;
5. Release Inspector validează continuitatea;
6. secondary intră în `DRAINING`, apoi lease-ul este revocat;
7. Control Plane emite un nou epoch pentru primary;
8. numai după aceea primary revine `ACTIVE`.

## 8. Network partition

Sursa autoritativă este starea persistentă AGM, nu memoria providerului. Dacă un
provider nu poate valida lease-ul la AGM boundary:

- poate continua calcule locale/advisory marcate neconfirmate;
- nu poate produce domain write;
- nu poate reînnoi ori substitui lease-ul;
- rezultatele întârziate rămân propuneri și cer revalidare.

Control Plane indisponibil înseamnă fail-closed pentru noi write-uri executive
provenite de la provideri, nu oprirea globală a operațiilor manuale sigure.

## 9. Scenarii obligatorii

| Test ID | Scenariu | Rezultat obligatoriu |
|---|---|---|
| `FAIL-01` | GitHub down | scope-urile unde este standby continuă; dacă era activ, lease-ul este fenced și se face handoff explicit |
| `FAIL-02` | Codex down în Basic | Basic AI devine degraded; GitHub poate primi lease temporar; manual fallback rămâne |
| `FAIL-03` | Gemini down în Premium | Planning devine degraded; GitHub poate primi lease temporar; cursele active continuă |
| `FAIL-04` | GitHub + Codex down | Premium poate continua prin Gemini; Basic rămâne manual sau primește Gemini numai prin mandat explicit |
| `FAIL-05` | GitHub + Gemini down | Basic poate continua prin Codex; Premium rămâne manual sau primește Codex numai prin mandat explicit |
| `FAIL-06` | Codex + Gemini down | GitHub poate primi mandate Basic/Premium separate, fără amestecarea scope-urilor |
| `FAIL-07` | toate trei down | zero AI execution; serviciile AGM locale/manuale și datele persistate continuă |
| `FAIL-08` | network partition | un singur fencing token este acceptat; toate write-urile stale sunt respinse |
| `FAIL-09` | primary revine în failover activ | revine standby; handoff controlat, fără takeover automat |
| `FAIL-10` | stale provider response | `DENIED / STALE_FENCING_TOKEN`; zero mutații |
| `FAIL-11` | parent/child write overlap | `DENIED / CONFLICT`; niciun al doilea token executiv valid |
| `FAIL-12` | secret request după failover | authority lease nu produce secret grant; cererea urmează Guardian policy |

## 10. Manual fallback

Când toate rețelele externe sunt indisponibile, rămân disponibile în limitele
infrastructurii AGM locale:

- vizualizarea și operarea manuală a curselor acceptate;
- Job File, protocoale, Incident, Evidence și Operational Hold;
- persistence și audit local;
- Primary Accounting local pentru date reale documentate;
- Archive/Retention conform politicii;
- outbox pentru operații externe amânate.

Nu se emit verdicturi AI noi, iar datele externe de rută/preț/orar sunt marcate
`UNAVAILABLE`, `STALE` sau `RECALCULATION_REQUIRED`.

## 11. Criterii PASS

Matricea primește PASS tehnic numai dacă testele demonstrează:

1. niciun provider nu poate emite lease;
2. maximum un lease executiv valid pe write scope conflictual;
3. stale writes sunt respinse la domain boundary;
4. idempotency elimină execuțiile duplicate;
5. secondary moștenește contractul fără extindere;
6. secret grants rămân separate;
7. primary recovery nu produce authority race;
8. manual fallback nu este dezactivat;
9. toate tranzițiile și handoff-urile sunt auditate.

