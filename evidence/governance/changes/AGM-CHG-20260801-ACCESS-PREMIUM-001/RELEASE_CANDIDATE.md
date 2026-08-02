# Access / Premium — Release Candidate

**Change:** AGM-CHG-20260801-ACCESS-PREMIUM-001

**Data constituirii:** 2 august 2026

**Statut:** RELEASE CANDIDATE / VALIDARE EXTERNĂ RĂMASĂ

## Conținut

Release candidate-ul include contractul de entitlement API/Web, gateway-ul
`/access`, sesiunea Web, protecția rutelor Premium, integrarea în app shell,
stilurile asociate și reconcilierea documentației arhitecturale.

## Validări automate

- API Jest: 27 suite / 136 teste — PASS;
- API build — PASS;
- Web structural regression MC-3A și SR-01–SR-14 — PASS;
- Web production build — PASS;
- Access/Premium separation contract — PASS;
- Capacitor sync — PASS;
- Android debug APK build — PASS.

## Artefact Android de test

- fișier generat: `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`;
- mărime: `22,299,146` bytes;
- SHA-256: `D3B8555361BCB7FE4C1A27351FDD035C51CF02994D9D382929DE5A7EECAABCC2`;
- clasificare: debug candidate, nesemnat pentru distribuție publică.

## Porți rămase

- retest vizual Browser pe release candidate;
- instalare și retest fizic Android pe dispozitiv;
- verdict final asupra candidate-ului;
- constituirea și aprobarea baseline-ului succesor.

Browser-ul integrat nu a fost disponibil în sesiunea de constituire. Această limitare
nu este convertită într-un PASS. Baseline-ul oficial rămâne AGM v1.2.9 până la
închiderea porților externe de mai sus.
