# Etapa 2 — Contract API și model de date

Data: 2026-07-26  
Branch: `feature/pre-departure-stage-2-api-contract`  
Checkpoint propus: `pre-departure-stage-2-api-contract`  
Contract: `1.0.0`

## Obiectiv

Definirea contractului versionat și a modelului de date pentru sincronizarea
viitoare a modulului „Înainte de plecare”, fără activarea endpointurilor, fără
migrare de bază de date și fără deployment.

## Livrabile

- tipuri TypeScript pentru cereri, resurse, răspunsuri și conflicte;
- enumerări canonice pentru limbi, contexte, verificări, răspunsuri și stări;
- validare pură, fără efecte externe;
- derivarea deterministă a verificărilor din contextele selectate;
- contract OpenAPI 3.1 versionat;
- model de persistență propus pentru sesiuni și răspunsuri;
- constrângeri de unicitate, ownership și indexare;
- teste de compatibilitate și consistență.

## Contract API documentat

| Metodă | Rută | Scop |
| --- | --- | --- |
| POST | `/api/v1/pre-departure/sessions` | creare idempotentă |
| GET | `/api/v1/pre-departure/sessions/{sessionId}` | citire în tenantul autentificat |
| PUT | `/api/v1/pre-departure/sessions/{sessionId}` | sincronizare cu revision check |
| POST | `/api/v1/pre-departure/sessions/{sessionId}/confirm` | confirmare fără probleme |
| POST | `/api/v1/pre-departure/sessions/{sessionId}/close` | închidere după confirmare |

Rutele sunt documentate, dar **nu sunt înregistrate în NestJS** în Etapa 2.

## Decizii de contract

- `contractVersion` este obligatoriu și fixat la `1.0.0`;
- `clientSessionId` și `idempotencyKey` previn dublarea la retry;
- `clientRevision` și `serverRevision` permit detectarea conflictelor;
- conflictul standard este `PRE_DEPARTURE_REVISION_CONFLICT`;
- `companyId` și `driverUserId` provin exclusiv din autentificare și nu sunt
  acceptate din payloadul clientului;
- răspunsurile „problemă” necesită notă;
- răspunsurile „neaplicabil” necesită motiv;
- sesiunile pregătite, confirmate sau închise trebuie să fie complete și fără
  probleme;
- o sesiune blocată trebuie să fie completă și să conțină cel puțin o problemă;
- `confirmedAt` și `closedAt` sunt validate în raport cu starea.

## Model de date propus

### PreDepartureSession

- identificatori server/client și cheie de idempotency;
- tenant, șofer, transport și dispozitiv;
- referințe vehicul/remorcă;
- versiuni contract/checklist;
- limbă, contexte și stare;
- revizii client/server;
- timestamps operaționale.

### PreDepartureAnswer

- relație către sesiune;
- verificare unică în cadrul sesiunii;
- status, notă și motiv de neaplicabilitate;
- timestampul răspunsului.

Schema Prisma activă nu a fost modificată și nu a fost creată migrare.

## Validare

| Verificare | Rezultat |
| --- | --- |
| Contract API v1 — teste | 9/9 PASS |
| Versiune incompatibilă respinsă | PASS |
| Răspunsuri duplicate respinse | PASS |
| Problemă fără notă respinsă | PASS |
| Stare blocată inconsistentă respinsă | PASS |
| Timestampuri finale obligatorii | PASS |
| Ownership exclus din payload | PASS |
| Build API | PASS |
| E6.2 — 18 tranziții | PASS |
| Etapa 1 — regresie flux local | PASS |
| Build Web | PASS |

## Limitări intenționate

- fără controller sau service NestJS;
- fără scriere/citire în PostgreSQL;
- fără migrare Prisma;
- fără sincronizare reală;
- fără modificări Android;
- fără deployment.

Aceste elemente aparțin Etapei 3 și etapelor ulterioare.

## Verdict

**PASS TEHNIC — READY FOR PRODUCT OWNER CONTRACT REVIEW**

Etapa 3 nu trebuie inițiată înaintea acceptării contractului și modelului de
date din Etapa 2.

