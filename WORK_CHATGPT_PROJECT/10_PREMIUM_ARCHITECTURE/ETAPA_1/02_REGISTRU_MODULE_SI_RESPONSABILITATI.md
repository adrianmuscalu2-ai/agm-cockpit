# Livrabil 2 — Registrul oficial al modulelor

| ID | Modul | Responsabilitate canonică | Nu are voie să |
|---|---|---|---|
| PRM-01 | Înainte de plecare | inițializează contextul și checklistul cursei | confirme singur plecarea |
| PRM-02 | Vehicul și documente | validează vehiculul, remorca și documentele | creeze copii divergente ale datelor |
| PRM-03 | Ladungssicherung | evaluează și documentează siguranța încărcăturii | emită automat confirmarea șoferului |
| PRM-04 | Tahograf, timpi și legislație | calculează limite și obligații aplicabile | prezinte recomandarea ca decizie juridică finală |
| PRM-05 | Traducere și comunicare | produce traduceri și comunicări cu proveniență | suprascrie textul original |
| PRM-06 | OCR și documente | extrage, verifică și indexează documente | considere automat OCR-ul drept adevăr confirmat |
| PRM-07 | Asistență pe traseu | coordonează evenimente, alerte și escaladări | închidă automat incidente |
| PRM-08 | După cursă | colectează obligațiile și verificările finale | piardă elementele transferate |
| PRM-09 | Raport final și arhivare | generează raportul versionat și închide fluxul | arhiveze cu sincronizare restantă |
| PRM-10 | Istoric, incidente și trasabilitate | păstrează jurnalul și proiecțiile de audit | rescrie retroactiv evenimente |

## Roluri de guvernanță

| Rol | Răspundere |
|---|---|
| Arhitect Principal AGM | proprietarul contractului și coordonarea integrării |
| Architecture Guardian | verifică limitele, stările și dependențele |
| Version Guardian | schema, compatibilitatea și checkpointurile |
| Security | acces, clasificare, criptare și minimizare |
| QA | matricea de teste, dovezi și regresie |
| UX/UI | claritatea stărilor, confirmărilor și erorilor |
| Release & Operations | medii, observabilitate, rollback și lansare |
| Cronicarul AGM | registrul deciziilor, schimbărilor și aprobărilor |
