# E6.1 – MATRICE CANONICĂ DE STĂRI ȘI TRANZIȚII

**Versiune:** 1.1 – amendată prin decizia Product Owner E6.2-NC01
**Statut:** unica sursă normativă propusă pentru E6.2
**Cod:** neautorizat

## 1. Stări canonice

| ID stare | Denumire | Definiție | Intrări permise | Ieșiri permise |
|---|---|---|---|---|
| E6-S00 | NOT_STARTED | nu există sesiune activă | stare inițială sau resetare confirmată din E6-S10–E6-S70 | E6-S10, restaurare locală în E6-S20/E6-S30/E6-S40/E6-S50 |
| E6-S10 | CONTEXT_SELECTION | sesiunea este activă și așteaptă selectarea contextului | E6-S00 | E6-S20, E6-S00 |
| E6-S20 | IN_PROGRESS | evaluarea este activă și nu a fost finalizată explicit; poate conține verificări necompletate sau toate răspunsurile fără probleme | E6-S10, E6-S20, E6-S30, E6-S40, reluare locală | E6-S20, E6-S30, E6-S50, E6-S00 |
| E6-S30 | NEEDS_ATTENTION | există cel puțin o problemă declarată, dar evaluarea poate continua | E6-S20, E6-S30, E6-S40 sau restaurare locală | E6-S20, E6-S30, E6-S40, E6-S50, E6-S00 |
| E6-S40 | BLOCKED | evaluarea este completă și există cel puțin o problemă nerezolvată | E6-S30 sau restaurare locală | E6-S30, E6-S20, E6-S50, E6-S00 |
| E6-S50 | READY_TO_CONFIRM | toate verificările aplicabile sunt completate fără probleme deschise | E6-S20, E6-S30, E6-S40 sau restaurare locală | E6-S20, E6-S30, E6-S60, E6-S00 |
| E6-S60 | CONFIRMED | utilizatorul a confirmat rezultatul local „pregătit” | E6-S50 | E6-S70, E6-S00 |
| E6-S70 | CLOSED | sesiunea este închisă și numai consultabilă | E6-S60 | E6-S00 |

## 2. Evenimente canonice

| ID | Eveniment |
|---|---|
| E6-E01 | START_SESSION |
| E6-E02 | SELECT_CONTEXT |
| E6-E03 | ANSWER_CONFIRMED |
| E6-E04 | ANSWER_PROBLEM |
| E6-E05 | ANSWER_NOT_APPLICABLE_WITH_REASON |
| E6-E06 | EDIT_ANSWER |
| E6-E07 | COMPLETE_ASSESSMENT |
| E6-E08 | CONFIRM_READY |
| E6-E09 | CLOSE_SESSION |
| E6-E10 | RESET_CONFIRMED |
| E6-E11 | RESTORE_SESSION |

## 3. Tranziții permise

| ID | Sursă | Eveniment și condiție | Destinație | Reguli asociate |
|---|---|---|---|---|
| E6-T01 | E6-S00 | E6-E01 | E6-S10 | E6-REQ-01 |
| E6-T02 | E6-S10 | E6-E02; context valid și cel puțin o verificare aplicabilă | E6-S20 | E6-REQ-02, E6-REQ-09, E6-REQ-10 |
| E6-T03 | E6-S20 | E6-E03 sau E6-E05; mai sunt elemente incomplete, fără probleme | E6-S20 | E6-REQ-11, E6-REQ-12 |
| E6-T04 | E6-S20 | E6-E04 | E6-S30 | E6-REQ-11, E6-REQ-13 |
| E6-T05 | E6-S30 | E6-E03/E6-E05/E6-E06; există încă probleme | E6-S30 | E6-REQ-12, E6-REQ-14 |
| E6-T06 | E6-S30 | E6-E06; probleme rezolvate, dar există elemente incomplete | E6-S20 | E6-REQ-14, E6-REQ-15 |
| E6-T07 | E6-S20 | E6-E07; toate elementele aplicabile sunt complete și fără probleme | E6-S50 | E6-REQ-16 |
| E6-T09 | E6-S30 | E6-E07; evaluarea completă conține probleme | E6-S40 | E6-REQ-13, E6-REQ-15 |
| E6-T10 | E6-S40 | E6-E06; există încă probleme | E6-S30 | E6-REQ-14 |
| E6-T11 | E6-S40 | E6-E06; fără probleme, dar cu elemente incomplete | E6-S20 | E6-REQ-14 |
| E6-T12 | E6-S40 | E6-E06; toate elementele sunt complete și fără probleme | E6-S50 | E6-REQ-14, E6-REQ-16 |
| E6-T13 | E6-S50 | E6-E06 produce un element incomplet | E6-S20 | E6-REQ-14 |
| E6-T14 | E6-S50 | E6-E06 produce o problemă | E6-S30 | E6-REQ-13, E6-REQ-14 |
| E6-T15 | E6-S50 | E6-E08 cu confirmare explicită | E6-S60 | E6-REQ-16, E6-REQ-20 |
| E6-T16 | E6-S60 | E6-E09 | E6-S70 | E6-REQ-15 |
| E6-T17 | orice stare E6-S10–E6-S70 | E6-E10 cu confirmare explicită | E6-S00 | E6-REQ-18 |
| E6-T18 | E6-S00 | E6-E11 cu sesiune locală validă | starea salvată E6-S20/E6-S30/E6-S40/E6-S50 | E6-REQ-17 |
| E6-T19 | E6-S30 | E6-E06; toate elementele sunt complete și problemele au fost rezolvate | E6-S50 | E6-REQ-14, E6-REQ-16 |

## 4. Tranziții interzise

- E6-S20 sau E6-S30 → E6-S60 fără trecerea prin E6-S50;
- E6-S40 → E6-S60 cât timp există o problemă deschisă;
- E6-S50 → E6-S60 fără confirmare explicită;
- E6-S60/E6-S70 → editare directă a răspunsurilor;
- orice tranziție bazată exclusiv pe expirarea timpului;
- orice tranziție care transmite date extern;
- orice tranziție neenumerată în tabelul de mai sus.

E6-T08 a fost eliminată prin decizia Product Owner E6.2-NC01 deoarece orice
răspuns „Problemă” mută imediat sesiunea din E6-S20 în E6-S30 prin E6-T04.
Finalizarea cu probleme rămâne acoperită exclusiv de E6-T09.

## 5. Regula de derivare

`E6-S50` și `E6-S40` sunt rezultate operaționale locale, nu verdicte juridice,
medicale sau tehnice profesionale. Matricea nu conține amenzi și nu afirmă că
validările externe recomandate pentru POC01 au avut loc.
