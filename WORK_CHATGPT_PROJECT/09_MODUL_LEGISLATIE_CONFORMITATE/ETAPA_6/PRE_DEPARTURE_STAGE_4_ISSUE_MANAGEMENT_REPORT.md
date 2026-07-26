# Etapa 4 — Gestionarea problemelor și blocajelor critice

Data: 2026-07-26
Branch: `feature/pre-departure-stage-4-issue-management`
Checkpoint propus: `pre-departure-stage-4-issue-management`

## Rezultat

A fost implementat registrul local al problemelor pentru modulul „Înainte de
plecare”, separat de deployment și fără migrare sau scrieri în PostgreSQL.

## Flux implementat

- descriere obligatorie la declararea unei probleme;
- clasificare `warning` sau `critical`;
- legare explicită între problemă și verificarea care a generat-o;
- jurnal cu stare `open` / `resolved` și momentele operaționale;
- problemele critice sunt afișate ca blocaje de plecare;
- o sesiune cu probleme nu poate fi confirmată;
- rezolvarea necesită notă de remediere;
- după rezolvare, verificarea asociată devine din nou incompletă și trebuie
  reverificată;
- istoricul rezolvat rămâne vizibil, fără a fi numărat ca problemă deschisă;
- salvarea și restaurarea locală includ registrul problemelor.

## Contract

- contract separat `pre-departure-issues-v1`, versiunea `1.0.0`;
- validare pentru identitate, severitate, stare și dovada rezolvării;
- rutele create/resolve sunt documentate în OpenAPI;
- endpoint-urile nu sunt activate și nu există persistență DB în acest
  checkpoint.

## Validare

| Verificare | Rezultat |
| --- | --- |
| Issue management local | PASS |
| Blocaj critic | PASS |
| Confirmare interzisă cu problemă deschisă | PASS |
| Notă de remediere obligatorie | PASS |
| Reverificare după rezolvare | PASS |
| Contract issue API | 3/3 PASS |
| Contract + sync API total | 14/14 PASS |
| Outbox Etapa 3 | PASS |
| Regresie Etapa 1 | PASS |
| Build API | PASS |
| Build Web responsive | PASS |
| Test DOM registru probleme | PASS |
| Captură instrumentată Desktop/Mobile | PENDING — Browser Runtime indisponibil |
| Migrare / scrieri PostgreSQL | NU — intenționat |
| Deployment public | NEMODIFICAT |

## Limitări controlate

- rutele issue sunt numai contractuale până la aprobarea persistenței;
- fotografiile binare nu sunt încă încărcate sau sincronizate;
- Browser Runtime nu a fost detectat în sesiunea de validare, astfel încât
  validarea vizuală Product Owner rămâne separată;
- raportul final și confirmarea server-side aparțin Etapei 5.

## Verdict

**PASS TEHNIC — READY FOR PRODUCT OWNER STAGE 4 REVIEW**
