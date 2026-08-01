# APP-003 — Matrice G1 cerințe și teste

| ID | Cerință | Test obligatoriu |
|---|---|---|
| A-01 | selectare controlată de fișiere | acceptă fișiere valide; respinge limită număr/dimensiune |
| A-02 | preview și eliminare | lista reflectă nume/dimensiune; eliminarea invalidează review-ul |
| A-03 | compatibilitate baseline | e-mail fără atașamente păstrează contractul existent |
| A-04 | Android attachment handoff | URI `content://`, grant read-only, chooser, fișiere accesibile |
| A-05 | Browser sigur | fără suport fals; mesaj clar; draftul rămâne intact |
| W-01 | WhatsApp Share controlat | preview și confirmare înainte de share sheet |
| W-02 | fără automatizare | fără package pinning, destinatar sau auto-send |
| S-01 | privacy | fără conținut în loguri; cache temporar; nume sanitizat |
| R-01 | regresie | SR-07B, SR-08B, translation guard și build PASS |
| D-01 | device | validare Android reală pentru e-mail cu fișier și share către WhatsApp |

NO-GO: expunere `file://`, auto-send, bypass confirmare, pierderea draftului, regresie baseline sau acces persistent nejustificat.

