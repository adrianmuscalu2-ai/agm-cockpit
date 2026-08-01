# API-002 v1.0 — Manifest de arhivă oficială

**Modul:** API-002 — Auth & Users  
**Versiune:** 1.0  
**Închidere:** PASS / CLOSED  
**Data:** 1 august 2026  
**Custodie:** AGM Chronicler / Version Guardian

## Dosar canonic

`evidence/governance/modules/API-002/v1.0/`

Dosarul conține G0, continuitatea, inventarul interfețelor, contractul Auth & Users, validarea tehnică, verdictul utilizatorului, decizia de închidere și starea finală.

## Baseline tehnic

- `apps/api/src/auth/auth.contract.ts`;
- `apps/api/src/auth/auth.controller.ts`;
- `apps/api/src/auth/auth.module.ts`;
- `apps/api/src/auth/auth.service.ts`;
- `apps/api/src/auth/jwt.strategy.ts`;
- `apps/api/src/users/users.service.ts`;
- `apps/api/test/api002-auth-users.spec.ts`.

## Imutabilitate și limită

Contractul v1.0 protejează autentificarea, izolarea tenantului, scope-ul sesiunii și derivarea rolurilor active. Arhiva nu acordă autoritate Production și nu autorizează accesul ori rotația secretelor.

