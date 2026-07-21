# E6.1 – INVENTARUL CERINȚELOR

**Data:** 2026-07-20
**Statut:** livrabil documentar E6.1
**Implementare:** neautorizată

## Clasificare

- **INCLUSĂ:** poate deveni comportament local al aplicației în scope-ul aprobat;
- **CONDIȚIONATĂ:** necesită context selectat ori formulare prudentă;
- **EXCLUSĂ:** nu intră în implementarea ETAPEI 6.

## Cerințe inventariate

| ID | Cerință normalizată | Clasificare | Sursă POC01 | Motiv/limită |
|---|---|---|---|---|
| E6-REQ-01 | utilizatorul poate iniția o verificare „Înainte de Plecare” | INCLUSĂ | ETAPA 1 §1.3, §7 | flux local |
| E6-REQ-02 | utilizatorul selectează contextul: local, distanță lungă, ADR sau condiții dificile | INCLUSĂ | ETAPA 1 §3 | selecție multiplă permisă pentru condiții |
| E6-REQ-03 | aplicația prezintă verificări pentru vehicul | INCLUSĂ | ETAPA 1 §4.1 | răspuns declarativ, nu inspecție tehnică |
| E6-REQ-04 | aplicația prezintă verificări privind aptitudinea șoferului | INCLUSĂ | ETAPA 1 §4.2 | autoevaluare, nu diagnostic medical |
| E6-REQ-05 | aplicația prezintă verificări pentru documentele transportului | INCLUSĂ | ETAPA 1 §4.3 | fără certificarea autenticității |
| E6-REQ-06 | aplicația prezintă verificări pentru tahograf | INCLUSĂ | ETAPA 1 §4.4 | confirmare declarativă |
| E6-REQ-07 | aplicația prezintă verificări pentru încărcătură | INCLUSĂ | ETAPA 1 §4.5 | fără măsurare automată |
| E6-REQ-08 | aplicația prezintă verificări pentru planificarea rutei | INCLUSĂ | ETAPA 1 §4.6 | fără calcul juridic automat |
| E6-REQ-09 | verificările ADR apar numai când contextul ADR este selectat | CONDIȚIONATĂ | ETAPA 1 §3 scenariul 3; ETAPA 4 §scenariul 3 | fără verdict juridic automat |
| E6-REQ-10 | verificările de vreme/noapte apar numai pentru condițiile selectate | CONDIȚIONATĂ | ETAPA 1 §3 scenariul 4; ETAPA 4 §scenariul 4 | context declarat de utilizator |
| E6-REQ-11 | utilizatorul răspunde fiecărei verificări cu Confirmat, Problemă sau Neaplicabil | INCLUSĂ | ETAPA 1 §4; limită POC01 | răspuns explicit și auditabil |
| E6-REQ-12 | Neaplicabil necesită o justificare locală | INCLUSĂ | regula de dovadă ETAPA 5 | previne omisiunea implicită |
| E6-REQ-13 | o problemă deschisă blochează verdictul „Pregătit de plecare” | INCLUSĂ | ETAPA 1 §7 | recomandare operațională, nu ordin juridic |
| E6-REQ-14 | utilizatorul poate reveni și remedia o problemă declarată | INCLUSĂ | ETAPA 4, protocoale de remediere | fără remediere automată |
| E6-REQ-15 | rezultatul enumeră problemele și verificările incomplete | INCLUSĂ | ETAPA 1 §4, §7 | explicație locală |
| E6-REQ-16 | confirmarea finală cere completarea tuturor elementelor aplicabile | INCLUSĂ | ETAPA 1 §7 | fără PASS implicit |
| E6-REQ-17 | sesiunea poate fi salvată și reluată local | INCLUSĂ | ETAPA 6, AC06 | fără sincronizare cloud |
| E6-REQ-18 | resetarea sesiunii necesită confirmare | INCLUSĂ | control de integritate ETAPA 6 | previne pierderea accidentală |
| E6-REQ-19 | toate stările și acțiunile sunt disponibile în RO/DE/EN | INCLUSĂ | ETAPA 6, AC06 | echivalență semantică |
| E6-REQ-20 | interfața declară limitele modelului și lipsa transmiterii externe | INCLUSĂ | POC01 §6.3; decizia finală | informare obligatorie |
| E6-REQ-21 | aplicația calculează și afișează amenzi certe | EXCLUSĂ | Registru remediere §3 | valorile monetare sunt nevalidate |
| E6-REQ-22 | aplicația emite verdict juridic sau medical | EXCLUSĂ | POC01 §6.3; decizia finală | depășește competența modelului |
| E6-REQ-23 | aplicația transmite automat date către companie sau autorități | EXCLUSĂ | scope ETAPA 6 | integrare externă neautorizată |
| E6-REQ-24 | aplicația pretinde validare juridică independentă, în teren sau cu șofer profesionist | EXCLUSĂ | decizia finală POC01 | validările nu au fost efectuate |

## Rezultat inventar

- cerințe inventariate: 24;
- incluse: 18;
- condiționate: 2;
- excluse: 4;
- cerințe fără clasificare: 0.

Acest inventar nu modifică documentele POC01. Formulările tehnice viitoare se
supun matricei canonice E6.1 și aprobării Product Owner.
