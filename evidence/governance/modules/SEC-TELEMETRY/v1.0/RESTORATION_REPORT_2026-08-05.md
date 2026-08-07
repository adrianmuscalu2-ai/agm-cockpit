# Secret & Credentials Guardian — raport de identificare și restaurare

Data: 2026-08-05

## Verdict

`IMPLEMENTARE ȘI TEST CONTROLAT LOCAL — PASS`

`TELEMETRIE PUBLICĂ / HETZNER — FAIL / NOT OPERATIONAL`

Modulul nu poate primi verdictul operațional final până când build-ul este instalat pe mediul Hetzner și endpoint-ul public răspunde. În sesiunea curentă portul SSH al gazdei a răspuns, dar autentificarea disponibilă a fost refuzată (`publickey`); nu s-a încercat ocolirea controlului de acces.

## Agentul oficial existent

Agentul oficial este **Secret & Credentials Guardian**. Nu a fost creat un agent conceptual nou. Contractul existent îl definește ca autoritate permanentă, cu raportare directă către Turn Commander și acces minim pentru ciclul de viață al secretelor.

Monitorul separat este **MON-012 — Agent de Securitate**. Guardian validează și administrează referințele în mediul protejat; MON-012 consumă numai telemetria redactată și corelează starea cu monitorizarea.

Surse canonice existente:

- `AGM_ORGANIZATIONAL_CONTRACT_V1.md`, articolul „Secret & Credentials Guardian”;
- `AGM_COCKPIT_GOVERNANCE_REGISTER_V1.md`, profilul `GOV-SEC`;
- `apps/web/src/monitoring-department.ts`, monitorul `MON-012`;
- `apps/web/src/incident-journal.ts`, istoricul incidentelor de securitate.

## Cauza stării statice

Contractul și istoricul existau, dar Guardian lipsea din registrul executabil și din organigrama Turn. MON-012 consulta readiness-ul API generic și afișa controale descriptive statice. Nu exista un contract de telemetrie pentru secrete, un endpoint dedicat sau reconciliere automată cu Incident Journal.

## Harta restaurată

1. Guardian / mediu protejat:
   - `apps/api/src/secret-telemetry/secret-telemetry.contract.ts`
   - `apps/api/src/secret-telemetry/secret-telemetry.service.ts`
   - `apps/api/src/secret-telemetry/secret-telemetry.controller.ts`
   - `apps/api/src/secret-telemetry/secret-telemetry.module.ts`
   - `apps/api/src/app.module.ts`
2. Operations Center și MON-012:
   - `config/operations-health.json`
   - `apps/web/src/operations-health.ts`
   - `apps/web/src/monitoring-department.ts`
3. Turn și guvernanță:
   - `apps/web/src/agent-governance.registry.ts`
   - `apps/web/src/turn-organization-chart.ts`
   - `apps/web/src/secret-telemetry.ts`
   - `apps/web/src/main.ts`
4. Incident Journal:
   - incident canonic `AGM-SEC-SECRET-TELEMETRY`;
   - `ATTENTION` creează sau redeschide incidentul;
   - revenirea la `CONFIGURED` mută incidentul în `ready-test`;
   - validarea umană rămâne obligatorie și nu este acordată automat.

Fluxul rezultat este:

`Secret & Credentials Guardian → secret-telemetry.v1 → Operations Center / MON-012 → Turn Console → Incident Journal`

## Metadate și limite de securitate

Endpoint-ul transmite exclusiv:

- `CONFIGURED`, `MISSING`, `INVALID` sau `ROTATION REQUIRED`;
- identificator logic;
- furnizor;
- serviciu dependent;
- mediu;
- data ultimei validări;
- ID-ul incidentului asociat.

Nu transmite numele variabilei de mediu, valoarea, fragmentul valorii, hash-ul, tokenul sau credentialul. Dacă endpoint-ul nu răspunde, consola afișează `TELEMETRY UNAVAILABLE` și nu deduce că un secret este lipsă.

## Test controlat

Test API: `apps/api/test/secret-telemetry.service.spec.ts`

- toate referințele valide → `CONFIGURED`;
- referință absentă / invalidă → `MISSING` / `INVALID`, overall `ATTENTION`;
- restaurare → `CONFIGURED`;
- serializarea rezultatelor nu conține valorile fictive folosite în test.

Test Web: `apps/web/scripts/test-secret-telemetry-integration.ts`

- stare validă fără incident → PASS;
- degradare și creare incident → PASS;
- restaurare și trecere în `ready-test` → PASS;
- degradare ulterioară și redeschidere → PASS;
- randare fără nume de variabile sensibile → PASS;
- legături registry / MON-012 / Operations / main → PASS.

Build-uri:

- API Nest build → PASS;
- Web TypeScript + Vite production build → PASS.

## Confirmare anti-expunere

Nicio cheie, valoare secretă, parolă, valoare PIN, hash sau credential real nu a fost citit, afișat, scris în raport ori introdus în Git de această restaurare. Testele utilizează exclusiv valori fictive în memorie și verifică explicit absența lor din telemetrie.

## Acțiunea restantă

Release & Operations trebuie să instaleze build-ul pe Hetzner folosind accesul autorizat existent, să repornească serviciul și tunelul persistent, apoi să demonstreze răspunsul endpoint-ului public și actualizarea Turn. Până atunci verdictul public rămâne `FAIL / NOT OPERATIONAL`.
