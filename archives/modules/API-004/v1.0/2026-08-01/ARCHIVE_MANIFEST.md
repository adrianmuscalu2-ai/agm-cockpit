# API-004 v1.0 — Manifest de arhivă oficială

**Modul:** API-004 — Transports Lifecycle  
**Versiune:** 1.0  
**Închidere:** PASS / CLOSED  
**Data:** 1 august 2026  
**Custodie:** AGM Chronicler / Version Guardian

## Dosar canonic

`evidence/governance/modules/API-004/v1.0/`

Dosarul conține G0, continuitatea, inventarul interfețelor, contractul lifecycle, validarea tehnică, verdictul utilizatorului, decizia de închidere și starea finală.

## Baseline tehnic

- `apps/api/src/transports/transport-lifecycle.contract.ts`;
- `apps/api/src/transports/transport-transition.policy.ts`;
- `apps/api/src/transports/transport-transition.use-case.ts`;
- `apps/api/src/transports/transport-create.use-case.ts`;
- `apps/api/src/transports/transports.service.ts`;
- `apps/api/test/api004-transports-lifecycle-contract.spec.ts`;
- suitele `apps/api/test/transport-*.spec.ts` și caracterizarea serviciului.

## Imutabilitate și limită

Contractul v1.0 protejează lanțul canonic, izolarea tenantului și legăturile validation/audit/history/ledger. Arhiva nu acordă autoritate Production.

