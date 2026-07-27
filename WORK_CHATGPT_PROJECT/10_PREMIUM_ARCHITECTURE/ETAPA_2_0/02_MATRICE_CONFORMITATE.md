# Matricea de conformitate cu Contractul Arhitectural Premium v1

Legendă:

- 🟢 `COMPATIBLE`
- 🟡 `REQUIRES ADAPTATION`
- 🟠 `REQUIRES REFACTORING`
- 🔴 `REQUIRES REDESIGN`

## Clasificare oficială

| ID | Componentă / modul | Clasificare | TripContext | Constatare principală |
|---|---|---|---|---|
| INF-01 | Premium Foundation / catalog | 🟠 REQUIRES REFACTORING | obligatoriu indirect | catalogul promovează pagini independente, nu fluxul canonic |
| INF-02 | Premium Shell | 🟢 COMPATIBLE | slot de context recomandat | separare și prezentare comună corecte; nu conține reguli |
| INF-03 | Premium Routes Registry | 🟡 REQUIRES ADAPTATION | da, prin rutare cu trip selectat | rutele sunt centralizate, dar nu reprezintă etapele fluxului |
| INF-04 | Premium Application Registry | 🟠 REQUIRES REFACTORING | obligatoriu | registru plat de capabilități, fără orchestrator și lifecycle |
| INF-05 | Operational Team Foundation | 🟢 COMPATIBLE | nu pentru prezentarea statică | informativ, fără efecte; rolurile pot fi păstrate |
| INF-06 | Premium i18n | 🟢 COMPATIBLE | nu | separare bună; trebuie extins numai prin chei |
| MOD-01 | Pre-departure | 🟠 REQUIRES REFACTORING | obligatoriu | logică solidă, dar lifecycle, session ID, outbox și reset proprii |
| MOD-02 | After-departure POC02 | 🟠 REQUIRES REFACTORING | obligatoriu | evaluator bun, dar fără Trip, persistență, transfer sau audit comun |
| MOD-03 | Ladungssicherung | 🔴 REQUIRES REDESIGN | obligatoriu | stare globală UI, DOM/listener global, fetch direct, fără audit/sync |
| MOD-04 | AI Governance | 🟡 REQUIRES ADAPTATION | obligatoriu în permit/operație | limite, confirmări, kill switch și permit sunt aliniate |
| MOD-05 | Premium Copilot | 🟠 REQUIRES REFACTORING | obligatoriu | workflow izolat, mission fără trip/version/actor și fără governance wiring |
| MOD-06 | Context Analysis | 🟡 REQUIRES ADAPTATION | obligatoriu | workflow pur și confirmare; requestul nu are trip/proveniență completă |
| MOD-07 | Linguistic Agents | 🟡 REQUIRES ADAPTATION | obligatoriu când operează pe cursă | limite corecte; lipsesc sursa versionată, auditul și contractul Trip |
| MOD-08 | Proactive Recommendations | 🟡 REQUIRES ADAPTATION | obligatoriu | porturi și workflow bune; lipsesc trip, lifecycle și transferul |
| CAT-02 | Asistent transport placeholder | 🔴 REQUIRES REDESIGN | obligatoriu | nu există contract sau implementare de domeniu |
| CAT-07 | Jurnalul șoferului placeholder | 🔴 REQUIRES REDESIGN | obligatoriu | cardul nu este jurnalul append-only cerut |

## Conformitate detaliată a modulelor funcționale

| Criteriu | Pre-departure | After-departure | Load Safety |
|---|---|---|---|
| cunoaște cursa activă | FAIL | FAIL | FAIL |
| model canonic partajat | PARTIAL | FAIL | FAIL |
| tranziții controlate | PASS local | PASS evaluator | FAIL |
| confirmări trasabile | PARTIAL | PARTIAL | FAIL |
| probleme transferate | PARTIAL | FAIL | FAIL |
| offline explicit | PASS | PARTIAL | FAIL |
| outbox / sync | PASS local | FAIL | FAIL |
| conflict / recovery | PARTIAL | FAIL | FAIL |
| reset sigur pentru Trip | FAIL | N/A | FAIL |
| UI separat de domeniu | PARTIAL | PASS | FAIL |
| stări operaționale reale | PARTIAL | PARTIAL | PARTIAL |
| separare Basic/Premium | PARTIAL | PARTIAL | PASS rută/API |

## Elemente reutilizabile

### Pre-departure

- funcția pură de tranziție;
- verificările de restaurare;
- modelele de răspuns și issue;
- outbox-ul cu conflict HTTP 409;
- confirmarea cu actor, timp și versiune statement.

### After-departure

- politicile pe scenarii;
- prioritățile și acțiunile interzise;
- evaluarea pură și cerința de confirmare.

### Load Safety

- rolurile fotografiilor;
- controlul calității;
- separarea original/OCR confirmat/user-declared;
- structura raportului și explicațiile;
- erorile API tipizate.

### Fundații AI

- kill switch, risc, policy, permit single-use;
- confirmarea utilizator/Inspector;
- workflows pure;
- porturile de audit;
- interdicția efectelor externe automate.

## Componente care trebuie conectate la TripContext

Obligatoriu: MOD-01–MOD-08, INF-01, INF-03 și INF-04. Shell-ul primește numai o
proiecție read-only. i18n și Team Foundation nu trebuie să depindă de TripContext.
