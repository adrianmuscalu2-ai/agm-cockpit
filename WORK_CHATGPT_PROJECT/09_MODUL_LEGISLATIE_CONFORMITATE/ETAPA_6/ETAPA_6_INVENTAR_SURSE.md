# ETAPA 6 – INVENTARUL SURSELOR DE PROIECTARE

**Data:** 2026-07-20
**Scop:** identificarea surselor; nu modifică și nu revalidează baseline-urile

## Surse canonice și rol

| Sursă | Utilizare permisă în ETAPA 6 |
|---|---|
| POC01 `ETAPA_1_DEFINIREA_SITUATIEI_REALE.md` | situația și actorii operaționali |
| POC01 `ETAPA_4_RECOMANDARE_OPERATIONALA.md` | structură de flux propusă, supusă selecției Product Owner |
| POC01 `REGISTRU_SURSE_OFICIALE.md` | statutul și trasabilitatea surselor |
| POC01 `REGISTRU_REMEDIERE_ETAPA5.md` | limitări, retrageri și clasificări existente |
| POC01 `DECIZIE_FINALA_BASELINE_POC01.md` | limitele baseline-ului documentar POC01 |
| POC02 `POC02_IMP_DOCUMENT_INITIERE.md` | arhitectura de navigație generală aprobată |
| POC02 `POC02_IMP_MATRICE_TRASABILITATE.md` | modelul de trasabilitate tehnică |
| POC02 `POC02_BRW_RAPORT_VALIDARE.md` | cerințe practice Browser reutilizabile |
| POC02 `POC02_AND_RAPORT_VALIDARE.md` | cerințe practice Android reutilizabile |
| POC02 `POC02_FIN_RAPORT_AUDIT_CONSOLIDAT.md` | protecții, excluderi și rezultat consolidat |
| POC02 `DECIZIE_FINALA_POC02_FIN.md` | poarta procedurală finală |
| commit `b1ab90f0c7718576905696c1fa725e79f72e7d13` | baseline tehnic oficial de comparație |

## Reguli de utilizare

1. Documentele POC01 descriu modelul de referință, nu demonstrează automat
   implementarea lui în aplicație.
2. O afirmație juridică retrasă, limitată sau neconfirmabilă nu este promovată
   la cerință tehnică certă.
3. Conținutul selectat pentru implementare va primi identificatori proprii în
   E6.1 și aprobare Product Owner.
4. POC02 stabilește modelul arhitectural și baseline-ul de regresie; fișierele
   sale nu sunt modificate în ETAPA 6 documentară.

## Artefact canonic pentru stări și tranziții

Unica sursă canonică propusă pentru modelul de stare al implementării este
`E6_1_MATRICE_CANONICA_STARI_SI_TRANZITII.md`.

Artefactul va fi creat exclusiv după autorizarea E6.1. El va deriva cerințele
selectate din sursele POC01 inventariate, va atribui identificatori unici
stărilor și tranzițiilor și va consemna aprobarea Product Owner. Niciun document
POC01 și nicio descriere UI nu vor funcționa în paralel ca sursă normativă.

E6.2 nu poate fi autorizat până când această matrice nu este completă, auditată
și aprobată.
