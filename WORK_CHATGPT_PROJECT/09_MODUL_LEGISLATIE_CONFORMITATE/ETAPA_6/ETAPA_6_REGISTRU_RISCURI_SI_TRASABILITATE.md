# ETAPA 6 – REGISTRU DE RISCURI ȘI TRASABILITATE

**Stare:** proiectare documentară
**Verdict de implementare:** neautorizată

## 1. Registru de riscuri

| ID | Risc | Impact | Control | Proprietar control | Poartă de verificare |
|---|---|---|---|---|---|
| E6-R01 | cerințe POC01 istorice sau neconfirmabile preluate ca adevăr curent | ridicat | folosire ca model operațional; afirmațiile juridice neconfirmabile rămân etichetate | Product Owner | E6.1 |
| E6-R02 | regresie în „După Plecare” | ridicat | modul separat și suită POC02 obligatorie | responsabil tehnic | fiecare increment |
| E6-R03 | afectarea Premium | ridicat | navigație AGM separată și diff de scope | responsabil tehnic | fiecare checkpoint |
| E6-R04 | divergență Browser–Android | ridicat | aceleași stări și scenarii pe ambele platforme | responsabil validare | E6.6 |
| E6-R05 | traduceri incomplete sau semantic diferite | mediu | inventar comun de chei și matrice RO/DE/EN | Product Owner | E6.4 |
| E6-R06 | pierderea sau coruperea stării la resume | ridicat | schemă versionată și teste refresh/background | responsabil tehnic | E6.5–E6.6 |
| E6-R07 | validare declarată fără dovadă | ridicat | registru individual de dovezi; fără PASS implicit | responsabil audit | toate auditurile |
| E6-R08 | fișiere paralele incluse în checkpoint | ridicat | staging explicit și inventar IMP-AC15 echivalent | responsabil checkpoint | fiecare checkpoint |
| E6-R09 | extindere neautorizată a scope-ului | mediu | orice cerință nouă revine la Product Owner | Product Owner | continuu |
| E6-R10 | acțiunea locală este interpretată ca transmitere externă | ridicat | etichete explicite și lipsa integrării externe | Product Owner | E6.3–E6.7 |

## 2. Trasabilitate inițială

| Obiectiv | Livrabil | Criterii | Dovadă viitoare |
|---|---|---|---|
| sursă canonică POC01 | E6-L03 | E6-AC02, E6-AC05 | inventar și matrice aprobate |
| integrare AGM separată de Premium | E6-L02 | E6-AC04 | diagramă, diff și regresie Premium |
| flux multiplatformă | E6-L02, E6-L06 | E6-AC06, E6-AC08 | rapoarte Browser și Android |
| localizare completă | E6-L02, E6-L06 | E6-AC06 | matrice RO/DE/EN și capturi |
| protecție baseline | E6-L03, E6-L07 | E6-AC01, E6-AC09 | hash, diff și staging inventariat |
| execuție incrementală | E6-L05 | E6-AC07, E6-AC12 | decizii și checkpoint-uri distincte |

## 3. Dependențe

- aprobarea Product Owner a obiectivului propus;
- selectarea explicită a conținutului POC01 care poate deveni cerință tehnică;
- păstrarea testelor POC02 și Premium disponibile;
- medii Browser și Android disponibile pentru validarea practică;
- autorizare separată înaintea fiecărei modificări de cod.

## 4. Condiții pentru auditul documentar

- toate livrabilele E6-L01–E6-L06 sunt prezente sau planificate fără ambiguități;
- criteriile E6-AC01–E6-AC12 sunt verificabile;
- riscurile au control și poartă asociată;
- nu există rezultate tehnice declarate înainte de execuție;
- modificările curente sunt exclusiv documentare;
- nu se creează checkpoint până la autorizarea explicită.
