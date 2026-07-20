# ETAPA 4 – REGISTRU DE REMEDIERE ȘI DOVEZI

**Data:** 2026-07-20
**Statut:** 3/3 REMEDIERI ȘI 5/5 VALIDĂRI PRACTICE – PASS
**Regulă:** nicio modificare funcțională fără defect demonstrat

## 1. Defecte reale

| ID | Defect demonstrat | Remediere permisă | Test obligatoriu | Stare |
|---|---|---|---|---|
| D4-01 | pagina nu avea punct de navigare din aplicație | entry point izolat, injectat numai la build | build Browser și asseturi Android conțin linkul și ținta | închis automat |
| D4-02 | trei stări nu erau accesibile din UI | controale și tranziții conforme modelului validat | `ESCALATED` → `SAFE_TO_CONTINUE` → `CLOSED`, plus tranziții interzise | închis automat |
| D4-03 | rezultatul operațional DE/EN rămânea în română | localizarea integrală a conținutului operațional | 8/8 scenarii verificate în DE și EN | închis automat |

## 2. Verificări fără defect demonstrat

| ID | Verificare | Dovadă acceptată | Acțiune la PASS | Acțiune la FAIL |
|---|---|---|---|---|
| E4-01 | Android background/resume | confirmare practică Product Owner | închidere criteriu | PASS |
| E4-02 | Browser tastatură | confirmare practică Product Owner | închidere criteriu | PASS |
| E4-03 | consola Browser | fără erori relevante observate | închidere criteriu | PASS |
| E4-04 | offline Browser/Android | revenirea conexiunii restabilește funcționalitatea | închidere criteriu | PASS |
| E4-05 | flux complet multiplatformă | confirmare practică Product Owner | închidere criteriu | PASS |

## 3. Format minim al dovezii

Fiecare dovadă trebuie să includă:

1. identificatorul criteriului;
2. mediul și versiunea/buildul;
3. data testului;
4. starea inițială;
5. pașii executați;
6. rezultatul observat;
7. PASS sau FAIL;
8. captură, jurnal ori rezultat automat, după caz.

## 4. Protecția baseline-ului

- POC 01 rămâne nemodificat;
- modificările sunt limitate la aria ETAPEI 4;
- fișierele paralele din workspace nu intră în checkpoint;
- checkpoint-ul se creează numai după PASS implementare;
- validarea prin declarație este separată de validarea prin dovadă tehnică.

## 5. Dovezile remedierilor

| Dovadă | Rezultat |
|---|---|
| teste prezentare și tranziții ETAPA 4 | PASS |
| teste evaluator ETAPA 3 | PASS |
| localizare 8/8 scenarii × DE/EN | PASS |
| TypeScript `--noEmit` | PASS |
| regresie premium existentă | PASS |
| build Vite multipagină | PASS |
| entry point în `dist/index.html` | prezent |
| pagina țintă în `dist/after-departure.html` | prezentă |
| entry point în asseturile Android | prezent |
| pagina țintă în asseturile Android | prezentă |
| modificări în calea documentară POC 01 | 0 |

Închiderea D4-01–D4-03 reprezintă o verificare tehnică a remedierilor. Testele
practice E4-01–E4-05 au fost executate ulterior și confirmate PASS de Product
Owner. Detectarea automată a mediului nu înlocuiește și nu invalidează aceste
dovezi practice.

## 6. Situația consolidată

| Grup | Rezultat |
|---|---|
| D4-01–D4-03 – remedieri tehnice | 3/3 PASS |
| E4-01–E4-05 – validări practice | 5/5 PASS |
| Puncte deschise în registru | 0 |
