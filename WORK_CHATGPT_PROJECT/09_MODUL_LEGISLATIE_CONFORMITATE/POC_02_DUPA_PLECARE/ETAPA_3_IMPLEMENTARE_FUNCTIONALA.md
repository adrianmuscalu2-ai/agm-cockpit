# ETAPA 3 – IMPLEMENTARE FUNCȚIONALĂ CONTROLATĂ

**Data:** 2026-07-20  
**Statut:** PASS IMPLEMENTARE – ÎNCHISĂ OFICIAL  
**Baseline protejat:** POC 01, commit `769a6a2c4bca200341d3eee9b685ec3ec3c8bb5b`

## 1. Decizie și domeniu

Autorizarea Product Owner din 2026-07-20 definește ETAPA 3 drept prima etapă
de implementare funcțională a POC 02. Pentru păstrarea unui increment mic și
verificabil, livrabilul este un nucleu TypeScript pur, izolat de UI, API și de
componentele POC 01.

## 2. Livrabil

Implementarea conține:

- tipurile comune pentru cele 8 scenarii operaționale;
- cele 4 niveluri de prioritate și cele 9 stări aprobate;
- politici explicite pentru date obligatorii, acțiuni imediate, escaladări și
  acțiuni interzise;
- evaluarea conservatoare a situației;
- reguli explicite pentru tranzițiile de stare;
- un modul dezactivat implicit, fără efecte externe;
- teste automate pentru scenarii nominale și pragurile de siguranță.

Fișiere:

- `apps/web/src/poc02-after-departure/after-departure.types.ts`;
- `apps/web/src/poc02-after-departure/after-departure.evaluator.ts`;
- `apps/web/src/poc02-after-departure/after-departure.module.ts`;
- `apps/web/scripts/test-poc02-after-departure.ts`.

## 3. Reguli demonstrate

- urgența întrerupe fluxul obișnuit și conduce la `EMERGENCY`;
- interacțiunea nesigură conduce la `UNSAFE_TO_INTERACT`;
- datele obligatorii absente conduc la `NEEDS_FACTS`;
- o acțiune externă solicitată conduce la `AWAITING_CONFIRMATION`;
- evaluarea nu autorizează automat continuarea deplasării;
- nicio politică nu emite mai mult de trei acțiuni imediate;
- stările terminale nu permit revenirea în fluxul operațional;
- modulul nu execută apeluri, mesaje, raportări sau alte efecte externe.

## 4. Limite

Acest increment nu include interfață Browser, integrare Android, persistență,
telemetrie, servicii de rețea sau automatizarea escaladărilor. Validarea
multiplatformă rămâne în ETAPA 4, după aprobarea închiderii ETAPEI 3.

Nu sunt introduse afirmații juridice individualizate, cuantumuri monetare sau
surse prezentate drept garanții juridice.

## 5. Protecția baseline-ului

Implementarea este aditivă și izolată. Niciun fișier din POC 01 și nicio
componentă validată a baseline-ului POC 01 nu au fost modificate.

## 6. Decizie de închidere

Product Owner a validat livrabilul la 2026-07-20 și a autorizat închiderea
ETAPEI 3 și crearea checkpoint-ului Git separat. ETAPA 4 poate fi pregătită
după înregistrarea și verificarea checkpoint-ului.
