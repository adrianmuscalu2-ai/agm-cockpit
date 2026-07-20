# POC02-IMP – DOCUMENT DE INIȚIERE

**Data:** 2026-07-20
**Statut:** IMPLEMENTARE FINALIZATĂ – ÎN AUDIT TEHNIC
**Baseline de intrare:** `493554d58001bc445a0854d74418d243562b3371`
**Baseline protejat POC 01:** `769a6a2c4bca200341d3eee9b685ec3ec3c8bb5b`

## 1. Context

Reauditul I5.3 confirmă:

- Browser și Android sunt funcționale;
- modulul Premium „Siguranța încărcăturii” este prezent și accesibil;
- celelalte module Premium sunt afișate „În pregătire”;
- artefactele tehnice POC 02 există în repository;
- „După Plecare” nu este integrat în versiunile Browser și Android oficiale;
- niciun defect funcțional al aplicației livrate nu a fost demonstrat;
- I5.3 s-a închis decizional fără PASS și fără checkpoint.

POC02-IMP separă implementarea/integrerea de validările ulterioare Browser și
Android.

## 2. Obiectiv general

Integrarea controlată a funcționalității POC 02 „După Plecare” în suprafețele
oficiale Browser și Android, pornind de la artefactele tehnice existente, fără
modificarea POC 01 și fără extinderea neautorizată a modulelor Premium.

## 3. Obiective specifice

1. Identificarea exactă a suprafeței oficiale de acces POC 02.
2. Integrarea unui punct de navigare vizibil în Browser.
3. Includerea aceleiași suprafețe în buildul Android Capacitor.
4. Păstrarea celor 8 scenarii, 9 stări și a limbilor RO/DE/EN.
5. Păstrarea comportamentului local, fără efecte externe automate.
6. Păstrarea funcționalității Premium „Siguranța încărcăturii”.
7. Menținerea celorlalte module Premium în starea lor actuală.
8. Confirmarea protecției POC 01 prin comparație cu baseline-ul.
9. Producerea unor modificări mici, trasabile și reversibile.

## 4. Domeniu

### 4.1 Inclus

- punct de acces Browser către „După Plecare”;
- integrarea POC 02 în navigația oficială aprobată;
- includerea entry point-ului și asseturilor în buildul Android;
- reutilizarea nucleului existent din
  `apps/web/src/poc02-after-departure/`;
- adaptări strict necesare ale rutării/navigației și buildului;
- verificări automate, TypeScript, build Browser și sincronizare Android;
- documentație de trasabilitate și raport de implementare.

### 4.2 Exclus

- modificarea funcțională a POC 01;
- implementarea „Înainte de Plecare” în acest increment;
- funcționalități noi în nucleul POC 02;
- schimbarea regulilor celor 8 scenarii sau 9 stări;
- activarea modulelor Premium marcate „În pregătire”;
- modificarea funcțională a modulului „Siguranța încărcăturii”;
- validarea practică finală Browser sau Android;
- acțiuni externe automate, servicii noi sau colectare nouă de date;
- includerea modificărilor paralele existente în workspace.

## 5. Decizie necesară privind suprafața de integrare

Înaintea implementării trebuie aprobată explicit una dintre următoarele
variante:

| Variantă | Descriere | Impact |
|---|---|---|
| A – navigație generală AGM | punct de acces separat de zona Premium | separare clară între POC 02 și Premium |
| B – modul Premium Transport | acces din cardul Transport, păstrând logica POC 02 izolată | integrează POC 02 în suprafața Premium |

Decizie Product Owner: **Varianta A este aprobată**, deoarece POC 02 nu este
definit ca funcționalitate Premium, iar această variantă reduce riscul de
extindere a scope-ului Premium. Alegerea arhitecturală nu autorizează
implementarea.

## 6. Livrabile

| ID | Livrabil | Rezultat necesar |
|---|---|---|
| IMP-L01 | decizie privind suprafața de integrare | varianta A sau B aprobată |
| IMP-L02 | inventar de fișiere permis | listă exactă înaintea editării |
| IMP-L03 | integrare Browser | punct de acces vizibil și rută funcțională |
| IMP-L04 | integrare Android | entry point și asseturi incluse în build |
| IMP-L05 | matrice de trasabilitate | cerință–fișier–test–dovadă |
| IMP-L06 | raport de regresie | teste, TypeScript și builduri |
| IMP-L07 | raport protecție POC 01/Premium | comparații și rezultate |
| IMP-L08 | raport de implementare | modificări, limite și recomandare |

## 7. Criterii de acceptanță

| ID | Criteriu |
|---|---|
| IMP-AC01 | suprafața de integrare este aprobată înaintea codului |
| IMP-AC02 | lista fișierelor permise este aprobată |
| IMP-AC03 | „După Plecare” este accesibil din Browserul oficial |
| IMP-AC04 | „După Plecare” este inclus în buildul Android oficial |
| IMP-AC05 | 8/8 scenarii și 9/9 stări rămân acoperite automat |
| IMP-AC06 | RO/DE/EN rămân complete |
| IMP-AC07 | nicio acțiune externă nu este executată automat |
| IMP-AC08 | TypeScript și buildul Browser sunt PASS |
| IMP-AC09 | sincronizarea/buildul Android sunt PASS în aria autorizată |
| IMP-AC10 | „Siguranța încărcăturii” nu regresează |
| IMP-AC11 | modulele „În pregătire” nu sunt activate accidental |
| IMP-AC12 | POC 01 are zero diferențe față de baseline |
| IMP-AC13 | modificările paralele sunt excluse |
| IMP-AC14 | documentația corespunde implementării |
| IMP-AC15 | checkpoint-ul include exclusiv incrementul autorizat |

## 8. Subincrementări propuse

| Subincrement | Obiectiv unic | Condiție de start | Checkpoint |
|---|---|---|---|
| IMP.1 | decizie integrare și inventar fișiere | aprobarea documentului de inițiere | documentar |
| IMP.2 | integrare Browser | PASS și checkpoint IMP.1 | funcțional |
| IMP.3 | integrare Android | PASS și checkpoint IMP.2 | funcțional |
| IMP.4 | regresie, protecție și raport | PASS și checkpoint IMP.3 | închidere POC02-IMP |

Un singur subincrement poate fi activ. Niciun subincrement nu începe înaintea
închiderii complete a precedentului.

## 9. Riscuri și controale

| ID | Risc | Impact | Control |
|---|---|---|---|
| IMP-R01 | modificarea POC 01 | critic | căi excluse și comparație cu baseline |
| IMP-R02 | activarea accidentală a modulelor Premium | ridicat | regresie pe registry și UI Premium |
| IMP-R03 | regresia „Siguranța încărcăturii” | critic | suita Premium și test practic ulterior |
| IMP-R04 | Browser și Android folosesc navigații diferite | ridicat | aceeași sursă de configurare |
| IMP-R05 | artefact izolat confundat din nou cu integrarea | critic | criterii de acces din platforma oficială |
| IMP-R06 | modificări paralele incluse | critic | staging explicit și listă de fișiere |
| IMP-R07 | extinderea nucleului POC 02 | ridicat | reutilizare fără schimbarea regulilor |
| IMP-R08 | checkpoint prea mare | ridicat | patru subincrementări independente |
| IMP-R09 | PASS bazat doar pe build | ridicat | revalidări POC02-BRW și POC02-AND separate |
| IMP-R10 | remediere neautorizată | ridicat | oprire și decizie separată |

## 10. Strategia de verificare

În POC02-IMP se permit numai verificările tehnice necesare implementării:

- testele POC 02 existente;
- testele Premium relevante;
- TypeScript;
- build Browser;
- sincronizare/build Android, numai în subincrementul autorizat;
- comparații Git pentru POC 01 și aria Premium.

Validarea practică finală nu aparține POC02-IMP:

- POC02-BRW va verifica Browserul;
- POC02-AND va verifica Android;
- POC02-FIN va consolida decizia.

## 11. Condiții de închidere POC02-IMP

- IMP.1–IMP.4 închise prin checkpoint-uri dedicate;
- IMP-AC01–IMP-AC15 au rezultate explicite;
- neconformitățile sunt închise sau raportate;
- POC 01 este nemodificat;
- implementarea este pregătită pentru POC02-BRW;
- Product Owner emite decizia finală POC02-IMP.

## 12. Limita autorizării curente

Este autorizată exclusiv pregătirea prezentului document. Nu sunt autorizate:

- alegerea implicită a variantei de integrare;
- modificările de cod;
- execuția IMP.1–IMP.4;
- checkpoint Git;
- POC02-BRW, POC02-AND sau POC02-FIN;
- I5.4–I5.7.

Auditul Product Owner a confirmat documentația și Varianta A, apoi a autorizat
execuția. Implementarea și validarea tehnică sunt finalizate. Următorul pas
permis este auditul tehnic Product Owner; checkpoint-ul rămâne neautorizat.
