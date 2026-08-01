# APP-003 — Inventar preliminar de interfețe

| Interfață | Provider → Consumer | Stare | Regula G1 |
|---|---|---|---|
| Translator handoff | APP-002 → APP-003 | existentă | păstrarea textului editabil și a Unicode |
| Text correction | APP-006 → APP-003 | existentă | aplicare numai la acțiunea utilizatorului |
| Contact selection | APP-005 → APP-003 | existentă | numai adresă selectată explicit |
| Profile/signature | APP-007 → APP-003 | existentă | date locale, fără secret |
| OCR/document candidate | APP-004 → APP-003 | de proiectat pentru fișiere | referință controlată, fără copiere divergentă |
| Browser e-mail | APP-003 → handler `mailto:` | existentă | utilizatorul finalizează expedierea |
| Android e-mail | APP-003 → APP-015/OPS-002 → client e-mail | existentă; extensie necesară | contract separat pentru atașamente dacă este aprobat |
| WhatsApp Share | APP-003 → APP-015/OPS-002 → share target | nouă | share explicit; fără auto-send și fără WhatsApp Premium |
| Monitoring | APP-003 → MON-004/005/009 | incompletă | evenimente fără conținut sensibil |

Acesta este un inventar G0. Contractele, schemele, erorile, permisiunile, timeout-urile și compatibilitatea se aprobă la G1–G2.
