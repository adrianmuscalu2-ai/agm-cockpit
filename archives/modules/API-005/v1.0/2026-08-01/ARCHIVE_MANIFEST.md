# API-005 v1.0 — Manifest de arhivă oficială

**Modul:** API-005 — Pre-departure Contract & Sync  
**Versiune:** 1.0  
**Închidere:** PASS / CLOSED  
**Data:** 1 august 2026  
**Custodie:** AGM Chronicler / Version Guardian

## Dosar canonic

`evidence/governance/modules/API-005/v1.0/`

Dosarul conține G0, continuitatea, inventarul interfețelor, contractul Pre-departure & Sync, validarea tehnică, verdictul utilizatorului, decizia de închidere și starea finală.

## Baseline tehnic

- `apps/api/src/pre-departure-contract/pre-departure-contract.types.ts`;
- `apps/api/src/pre-departure-contract/pre-departure-contract.validation.ts`;
- `apps/api/src/pre-departure-contract/pre-departure-confirmation-contract.ts`;
- `apps/api/src/pre-departure-contract/pre-departure-issue-contract.ts`;
- `apps/api/src/pre-departure-sync/pre-departure-sync.service.ts`;
- `apps/api/test/pre-departure-sync.service.spec.ts`;
- suitele `apps/api/test/pre-departure-*.spec.ts`.

## Imutabilitate și limită

Contractul v1.0 protejează payload-ul, idempotency, izolarea tenantului și optimistic concurrency. Arhiva nu acordă autoritate Production și nu substituie APP-012 sau APP-014.

