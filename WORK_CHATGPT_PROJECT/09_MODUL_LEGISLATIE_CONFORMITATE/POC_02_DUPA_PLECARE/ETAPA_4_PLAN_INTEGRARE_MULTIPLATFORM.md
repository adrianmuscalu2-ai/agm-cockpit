# ETAPA 4 – PLAN DE INTEGRARE MULTIPLATFORMĂ

**Data:** 2026-07-20
**Statut:** PASS IMPLEMENTARE – ÎNCHISĂ OFICIAL
**Intrare validată:** ETAPA 3, checkpoint `1bbbc0f8a5ad17e9fbad1b3bec5cc73692a10309`
**Baseline protejat:** POC 01, commit `769a6a2c4bca200341d3eee9b685ec3ec3c8bb5b`

## 1. Obiectiv general

Proiectarea integrării controlate a nucleului operațional „După Plecare”
validat în ETAPA 3 într-un flux minim utilizabil în Browser și Android, fără
modificarea POC 01 și fără executarea automată a unor acțiuni externe.

## 2. Obiective specifice

1. Definirea unui adaptor de prezentare comun peste evaluatorul ETAPEI 3.
2. Definirea fluxului minim: selectare scenariu, siguranță, fapte, evaluare,
   acțiuni recomandate, escaladare și închidere.
3. Stabilirea stărilor vizibile pentru date lipsă, offline, eroare și
   confirmare.
4. Asigurarea aceleiași logici în Browser și în aplicația Android Capacitor.
5. Păstrarea tuturor efectelor externe în afara livrabilului sau în stare
   simulată explicit, fără transmitere.
6. Definirea dovezilor automate și manuale necesare validării.

## 3. Domeniu

### 3.1 Inclus

- integrarea exclusivă a celor 8 scenarii și 9 stări validate;
- ecran sau secțiune nouă, izolată de fluxurile POC 01;
- colectarea minimă a faptelor declarate de utilizator;
- afișarea priorității, acțiunilor imediate, limitelor și escaladării;
- confirmare locală înaintea oricărei propuneri de acțiune externă;
- tratament explicit pentru lipsa conexiunii;
- texte RO, DE și EN pentru suprafața nouă;
- teste unitare, de integrare, Browser și Android;
- dovezi de regresie pentru aria POC 01.

### 3.2 Exclus

- trimiterea efectivă de apeluri, mesaje, e-mailuri sau rapoarte;
- integrarea cu servicii juridice, mecanice, medicale ori de urgență;
- persistența în cloud, telemetria și colectarea nouă de date personale;
- monitorizarea automată a poziției;
- recomandarea automată de continuare a deplasării;
- extinderea către fluxurile „Înainte de Plecare” sau „După Sosire”;
- modificarea rutelor, componentelor sau documentelor POC 01.

## 4. Livrabile obligatorii

| ID | Livrabil | Dovadă minimă |
|---|---|---|
| L4-01 | specificație flux și hartă stare–ecran | matrice completă pentru 9/9 stări |
| L4-02 | adaptor de prezentare izolat | teste pentru maparea evaluator–UI |
| L4-03 | flux minim Browser | capturi și raport pentru scenarii nominale/negative |
| L4-04 | flux minim Android | build, dispozitiv/emulator și raport de test |
| L4-05 | dicționar RO/DE/EN | verificare chei și control de fallback |
| L4-06 | tratament offline și eroare | teste fără rezultat fabricat |
| L4-07 | regresie POC 01 | listă de verificări și rezultate |
| L4-08 | raport consolidat ETAPA 4 | trasabilitate, limite, riscuri și decizie |

## 5. Flux minim proiectat

1. Utilizatorul deschide explicit modulul „După Plecare”.
2. Aplicația verifică dacă interacțiunea poate avea loc în siguranță.
3. Utilizatorul selectează unul dintre cele 8 scenarii.
4. Sunt solicitate numai faptele obligatorii pentru scenariul selectat.
5. Evaluatorul validat în ETAPA 3 calculează starea și prioritatea.
6. UI separă faptele declarate, datele lipsă, acțiunile și limitele.
7. Orice propunere externă ajunge în `AWAITING_CONFIRMATION`.
8. În ETAPA 4 confirmarea nu execută transmiterea; rezultatul rămâne o schiță
   locală marcată explicit.
9. Închiderea este permisă numai conform tranzițiilor validate.

## 6. Criterii de acceptanță

### 6.1 Obligatorii

| ID | Criteriu |
|---|---|
| AC4-01 | 8/8 scenarii pot fi inițiate separat |
| AC4-02 | 9/9 stări au reprezentare vizibilă și neambiguă |
| AC4-03 | P0 și interacțiunea nesigură întrerup fluxul obișnuit |
| AC4-04 | datele lipsă nu sunt completate sau presupuse automat |
| AC4-05 | maximum trei acțiuni imediate sunt afișate |
| AC4-06 | nicio acțiune externă nu este executată |
| AC4-07 | offline și eroarea sunt declarate explicit |
| AC4-08 | textele noi există în RO, DE și EN, fără chei lipsă |
| AC4-09 | navigarea înapoi, refresh-ul și retry-ul nu dublează efecte |
| AC4-10 | fluxul Browser este utilizabil cu tastatură și pointer |
| AC4-11 | fluxul Android este utilizabil la dimensiunea țintă |
| AC4-12 | revenirea Android din background păstrează o stare sigură |
| AC4-13 | testele automate și buildurile relevante sunt PASS |
| AC4-14 | POC 01 rămâne nemodificat și fără regresii în aria testată |
| AC4-15 | documentația corespunde exact implementării și dovezilor |

Toate cele 15 criterii sunt obligatorii pentru PASS. Un criteriu nedemonstrat
primește statut FAIL sau NEVALIDAT, nu PASS implicit.

## 7. Strategie de testare

### 7.1 Automat

- testele existente ale evaluatorului ETAPEI 3;
- teste ale adaptorului pentru fiecare stare și scenariu;
- teste pentru date lipsă, P0, offline, confirmare și retry;
- typecheck și build web;
- regresia testelor existente relevante.

### 7.2 Browser

- scenariu nominal și negativ pentru fiecare familie de prioritate;
- navigare cu tastatură și pointer;
- refresh, back, reluare și stare offline;
- verificarea consolei;
- capturi asociate versiunii testate.

### 7.3 Android

- build și sincronizare Capacitor;
- test pe emulator sau dispozitiv identificat în raport;
- dimensiune, orientare, background/resume și offline;
- confirmarea că nu sunt cerute permisiuni noi;
- capturi și versiunea APK/buildului.

## 8. Riscuri și măsuri de control

| ID | Risc | Impact | Control |
|---|---|---|---|
| R4-01 | integrarea modifică POC 01 | critic | rută și componente izolate; revizuire diff |
| R4-02 | diferență Browser/Android | ridicat | logică comună și matrice de paritate |
| R4-03 | UI permite interacțiune în mers | critic | poartă de siguranță înaintea formularului |
| R4-04 | urgența este îngropată în formular | critic | randare prioritară P0 și oprirea fluxului |
| R4-05 | acțiune externă executată accidental | critic | adaptor fără efecte și teste negative |
| R4-06 | date lipsă prezentate drept certe | ridicat | afișare separată și `NEEDS_FACTS` |
| R4-07 | offline produce recomandare fabricată | ridicat | stare offline explicită |
| R4-08 | retry/refresh dublează acțiuni | ridicat | stare locală idempotentă, fără transmitere |
| R4-09 | traduceri incomplete sau divergente | mediu | verificarea automată a cheilor |
| R4-10 | revenire Android în stare nesigură | ridicat | resetare/rehidratare conservatoare |
| R4-11 | modificări paralele intră în livrabil | ridicat | staging explicit și revizuire commit |
| R4-12 | documentația declară rezultate netestate | ridicat | dovezi legate de fiecare criteriu |

## 9. Ordinea de implementare propusă

1. adaptorul de prezentare și testele sale;
2. scheletul izolat al fluxului Browser;
3. stările de siguranță, date lipsă, offline și eroare;
4. dicționarul RO/DE/EN;
5. validarea Browser;
6. buildul și validarea Android;
7. regresia POC 01 și raportul consolidat;
8. decizia Product Owner și checkpoint-ul Git.

Fiecare pas trebuie să lase proiectul într-o stare verificabilă. O problemă
critică oprește continuarea până la remediere.

## 10. Poarta de implementare

Documentația a primit PASS DOCUMENTAR prin decizia Product Owner din
2026-07-20. Prezenta validare nu autorizează implementarea funcțională.
Implementarea poate începe exclusiv după:

1. menținerea domeniului validat;
2. menținerea livrabilelor L4-01–L4-08;
3. menținerea criteriilor AC4-01–AC4-15;
4. menținerea controalelor R4-01–R4-12;
5. emiterea unei autorizări explicite și separate Product Owner.

## 11. Rezultatul final

Implementarea a fost autorizată, executată, remediată și reauditată.

- criterii AC4-01–AC4-15: 15/15 PASS;
- remedieri D4-01–D4-03: 3/3 PASS;
- validări practice E4-01–E4-05: 5/5 PASS;
- regresie și build: PASS;
- POC 01: nemodificat;
- neconformități reziduale: 0.

ETAPA 4 primește PASS IMPLEMENTARE și este închisă oficial. Checkpoint-ul Git
a fost înregistrat la `290aad19ae8a55595d6a7ad4d3a2eec1f8a1044c`, cu staging
limitat la aria ETAPEI 4.

🚛 **AGM respiră prin noi.**
