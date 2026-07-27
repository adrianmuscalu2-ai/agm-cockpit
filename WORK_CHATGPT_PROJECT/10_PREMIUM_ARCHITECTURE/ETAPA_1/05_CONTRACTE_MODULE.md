# Livrabil 5 — Contractele modulelor

| Modul | Intrare | Finalizare | Blocaje | Acceptabil cu avertisment | Transfer |
|---|---|---|---|---|---|
| Înainte de plecare | cursă, șofer, vehicul | checklist evaluat | identitate/date critice lipsă | date necritice planificate | sarcini și context |
| Vehicul/documente | vehicul, remorcă, documente | controale obligatorii evaluate | defect critic/document obligatoriu lipsă | expirare apropiată/defect minor acceptat | checks, warnings, incidents |
| Ladungssicherung | cargo, vehicul, echipament | evaluare și confirmare explicită | fixare critic neconformă | abatere permisă de regulă și acceptată | dovezi, măsuri, restricții |
| Tahograf/legislație | șofer, timp, traseu, reguli | obligații calculate și afișate | limită legală incompatibilă cu plecarea | atenționare viitoare | alerte și termene |
| Traducere/comunicare | text original, limbă, scop | rezultat cu provider și proveniență | serviciu necesar indisponibil | fallback etichetat | mesaj și sursă |
| OCR/documente | media, tip, consimțământ | OCR verificat sau trimis la revizuire | fișier corupt/consimțământ absent | încredere redusă marcată | document, text, corecții |
| Asistență traseu | TRIP_ACTIVE, evenimente | eveniment rezolvat sau transferat | incident critic | recomandare necritică | incidente și sarcini |
| După cursă | sosire, open items | verificări închise | lipsă dovadă critică | element cu dispoziție aprobată | raport și open items |
| Raport/arhivare | proiecție completă, audit | raport hash-uit; sync confirmat | conflict/sync/recovery | niciun avertisment pentru integritate | arhivă read-only |
| Istoric/incidente | evenimente autorizate | proiecție disponibilă | integritate jurnal | indisponibilitate temporară de căutare | export auditabil |

## Online, offline, salvare și resetare

Toate modulele:

- salvează local operațiile permise și le marchează `SYNC_PENDING`;
- afișează separat starea locală și confirmarea serverului;
- restaurează ultima stare validă plus outbox-ul;
- nu simulează succesul unei operații online;
- folosesc reset UI separat de abandonarea sau ștergerea cursei;
- protejează o cursă activă și datele nesincronizate de resetare.
