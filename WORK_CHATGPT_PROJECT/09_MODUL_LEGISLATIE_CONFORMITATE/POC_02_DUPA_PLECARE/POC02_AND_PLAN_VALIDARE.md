# POC02-AND – PLAN DE REVALIDARE ANDROID

**Data:** 2026-07-20
**Statut:** PASS – 11/11 VALIDAT DE PRODUCT OWNER
**Intrare:** POC02-BRW PASS
**APK tehnic:** `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`
**SHA-256 APK:** `83F7C57A36837D1461EE5CCE7C2B6BCBC5A099DFFA9977F083BA1BBF0A219635`

## Domeniu

Se validează exclusiv POC 02 „După Plecare” în aplicația Android. „Înainte de
Plecare” este exclus și necesită un increment separat.

## Matrice

| ID | Verificare Android | Dovadă minimă | Stare |
|---|---|---|---|
| AND-01 | instalare/lansare APK și identificare dispozitiv | model, versiune Android, APK și captură | PASS |
| AND-02 | navigare AGM → „După Plecare” | pași și captură | PASS |
| AND-03 | flux complet până la rezultat | intrări, stare și captură | PASS |
| AND-04 | stări negative | `UNSAFE_TO_INTERACT`, `EMERGENCY`, `NEEDS_FACTS` | PASS |
| AND-05 | tranziții terminale | `ESCALATED` → `SAFE_TO_CONTINUE` → `CLOSED` | PASS |
| AND-06 | background/resume | stare înainte și după reluare | PASS |
| AND-07 | offline → evaluare locală → online | banner, rezultat local și revenire | PASS |
| AND-08 | RO/DE/EN | același flux în cele trei limbi | PASS |
| AND-09 | orientare și dimensiune țintă | portret/peisaj, fără blocaje critice | PASS |
| AND-10 | lipsa efectelor externe și a permisiunilor noi | observație și configurație | PASS |
| AND-11 | logcat fără erori funcționale relevante | jurnal pe durata fluxului | PASS |

## Reguli

- fiecare rezultat este PASS, FAIL sau NEVALIDAT;
- un defect reproductibil oprește incrementul;
- lipsa dovezii nu produce PASS;
- nu se modifică aplicația în timpul validării;
- nu se creează checkpoint înaintea auditului Product Owner.

## Condiții de închidere

- AND-01–AND-11: 11/11 PASS;
- defecte funcționale reziduale: 0;
- raport Android complet;
- audit Product Owner: PASS;
- POC02-FIN rămâne blocat până la decizia separată.
