# RAPORT REGRESIE AUTOMATĂ – I5.2

**Data execuției:** 2026-07-20
**Baseline de intrare:** `335b48c24f006056b226382e22902a245a610fb2`
**Statut:** PASS – VALIDAT DE PRODUCT OWNER
**Livrabil:** L5-03

## 1. Mediu

| Element | Valoare |
|---|---|
| sistem | Windows |
| Node.js | `v24.16.0` |
| pnpm | `9.12.3` |
| Vite | `5.4.21` |
| endpoint validat de build | `https://api.agmcockpit.com/api/v1` |

## 2. Rezultate

| ID | Control | Comandă | Rezultat |
|---|---|---|---|
| T5.2-01 | nucleu POC 02 | `pnpm.cmd --filter @agm/web exec tsx scripts/test-poc02-after-departure.ts` | PASS |
| T5.2-02 | prezentare ETAPA 4 | `pnpm.cmd --filter @agm/web exec tsx scripts/test-poc02-stage4.ts` | PASS |
| T5.2-03 | TypeScript web | `pnpm.cmd --filter @agm/web exec tsc --noEmit` | PASS |
| T5.2-04 | build web producție | `pnpm.cmd --filter @agm/web build` | PASS |
| T5.2-05 | regresie fundație existentă | `pnpm.cmd --filter @agm/web test:premium` | PASS |

Total: **5/5 PASS**.

Buildul a transformat 132 de module și a generat inclusiv
`dist/after-departure.html` și bundle-urile POC 02.

## 3. Acoperirea criteriilor I5.2

| Criteriu | Dovadă | Rezultat |
|---|---|---|
| AC5-05 – fără marcaje provizorii reale | scanarea documentelor finale; apariția „Marcaje TBD” este denumirea istorică a unei metrici cu valoarea 0 | PASS |
| AC5-06 – evaluator și prezentare | T5.2-01 și T5.2-02 | PASS |
| AC5-07 – TypeScript și build producție | T5.2-03 și T5.2-04 | PASS |
| AC5-11 – 8 scenarii și 9 stări | aserțiuni explicite în cele două suite POC 02 | PASS |
| AC5-12 – RO/DE/EN complete și coerente | buclă de validare pe cele trei limbi în T5.2-02 | PASS |
| AC5-13 – fără acțiuni externe automate | aserțiuni `externalSideEffects` și `externalEffectExecuted` false | PASS |

Rezultat criterii I5.2: **6/6 PASS**.

## 4. Clasificarea constatărilor

| ID | Constatare | Clasificare | Stare |
|---|---|---|---|
| E5.2-01 | prima execuție a buildului nu a putut citi configurația Vite din cauza restricției sandbox | mediu de execuție, nu defect de produs | închis prin rerulare autorizată PASS |

Regresii funcționale reproductibile: **0**.
Neconformități reziduale cunoscute în aria I5.2: **0**.

## 5. Integritate și limite

- fișierele runtime POC 02 nu diferă față de checkpoint-ul I5.1;
- POC 01 nu diferă față de baseline-ul
  `769a6a2c4bca200341d3eee9b685ec3ec3c8bb5b`;
- modificările paralele Premium/API existente în worktree nu aparțin I5.2 și
  trebuie excluse din eventualul checkpoint;
- nu au fost efectuate modificări funcționale;
- I5.3–I5.7 nu au fost executate;
- nu a fost creat checkpoint I5.2.

## 6. Decizie Product Owner

I5.2 primește **PASS**. Checkpoint-ul Git dedicat este autorizat, iar
livrabilele I5.2 devin parte a baseline-ului documentar al ETAPEI 5 după
înregistrarea checkpoint-ului.

I5.3–I5.7 rămân neautorizate.
