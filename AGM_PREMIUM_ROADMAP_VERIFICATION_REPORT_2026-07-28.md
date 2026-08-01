# AGM Premium — Raport de verificare a Roadmap-ului

Data auditului: 2026-07-28  
Regim: analiză documentară, fără modificarea Roadmap-ului sau a infrastructurii  
Scop: identificarea sursei unice de adevăr și evaluarea compatibilității acesteia cu arhitectura AGM Premium validată

## 1. Concluzie executivă

Există un Roadmap oficial AGM: `ROADMAP.md`. Documentul se declară explicit „roadmap-ul oficial AGM validat în AG-019” și este singurul document inventariat care revendică această autoritate. El trebuie păstrat ca sursă canonică pentru priorități, faze și ordinea de livrare.

Roadmap-ul nu mai descrie însă suficient arhitectura Premium actuală. Secțiunea Premium este organizată preponderent ca listă de funcții și module, în timp ce direcția actuală este un ecosistem integrat bazat pe Hub-uri Operaționale, `TripContext`, Context Operațional Comun, Arhivă Operațională și Servicii Comune. Primul flux vertical MVP nu este definit în Roadmap, iar progresul arhitectural deja realizat nu este reflectat.

Recomandarea oficială este **ACTUALIZARE**. Documentul canonic poate fi adaptat fără înlocuire și fără crearea unui al doilea Roadmap.

## 2. Metodă și limite

Au fost inventariate documentele din repository care folosesc sau descriu noțiuni de roadmap, etapizare, ordine de integrare, MVP, migrare de module, strategie Premium ori rezultate de implementare. Conținutul a fost clasificat după autoritate și funcție:

- roadmap strategic;
- contract sau viziune arhitecturală;
- plan tehnic specializat;
- decizie de etapă;
- raport de execuție sau dovadă.

Auditul nu a modificat niciun document existent și nu a redactat un Roadmap alternativ.

## 3. Inventarul documentelor relevante

| Document | Rol real | Autoritate recomandată | Observație |
|---|---|---|---|
| `ROADMAP.md` | Roadmap oficial general AGM | **Canonic pentru roadmap** | Definește Basic, Premium, backlog și ordinea generală; necesită actualizare Premium. |
| `AGM_PREMIUM_ARCHITECTURAL_CONTRACT_V1.md` | Contract arhitectural Premium | Normativ pentru constrângeri arhitecturale | Definește `TripContext`, lifecycle, contracte, offline/outbox și gate-uri; nu este roadmap. |
| `AGM_PREMIUM_HUB_ARCHITECTURE_VISION_2026-07-28.md` | Viziune arhitecturală integrată | Referință de aliniere strategică, până la aprobarea formală aplicabilă | Definește Hub-urile, Serviciile Comune, Arhiva, fluxurile și MVP-ul vertical; nu trebuie transformat într-un roadmap paralel. |
| `WORK_CHATGPT_PROJECT/10_PREMIUM_ARCHITECTURE/ETAPA_1/09_PLAN_ETAPIZAT_IMPLEMENTARE.md` | Plan tehnic etapizat | Subordonat Roadmap-ului | Succesiune istorică în 10 etape, utilă ca detaliu de execuție. |
| `WORK_CHATGPT_PROJECT/10_PREMIUM_ARCHITECTURE/ETAPA_2_0/03_PLAN_ORDINE_INTEGRARE.md` | Ordine tehnică de integrare | Subordonat Roadmap-ului | Detaliază integrarea `TripContext`, orchestrator, OCR, documente și arhivă. |
| `WORK_CHATGPT_PROJECT/10_PREMIUM_ARCHITECTURE/ETAPA_3/08_PLAN_MIGRARE_MODULE.md` | Plan specializat de migrare | Subordonat Roadmap-ului | Acoperă migrarea modulelor către Contextul Operațional Comun. |
| `WORK_CHATGPT_PROJECT/10_PREMIUM_ARCHITECTURE/ETAPA_3/11_DECIZIE_INCHIDERE_OFICIALA.md` | Decizie și stare de etapă | Dovadă de guvernanță | Confirmă Contextul Operațional Comun ca bază obligatorie și consemnează condițiile încă deschise. |
| `WORK_CHATGPT_PROJECT/10_PREMIUM_ARCHITECTURE/ETAPA_2_2/README.md` | Index și statut pentru Arhiva Operațională | Referință specializată | Confirmă arhiva ca sursă canonică de evenimente Premium; nu stabilește prioritățile întregului program. |
| `AGM_PREMIUM_FOUNDATION_STAGE1_REPORT.md` | Raport de implementare | Dovadă | Confirmă progresul fundației, nu planificarea viitoare. |
| `AGM_PREMIUM_SHELL_REPORT.md` | Raport de implementare | Dovadă | Confirmă starea shell-ului Premium. |
| `AGM_PREMIUM_ROUTES_REGISTRY_REPORT.md` | Raport de implementare | Dovadă | Confirmă registrul rutelor. |
| `AGM_PREMIUM_TEAM_STAGE2_REPORT.md` | Raport de etapă | Dovadă | Confirmă rezultatele etapei, nu este roadmap. |

Documentele `README.md` din etapele Premium și celelalte rapoarte de implementare sunt indexuri sau dovezi locale. Ele nu trebuie promovate la rang de Roadmap și nu trebuie să repete planificarea strategică.

## 4. Identificarea sursei canonice

### Sursa canonică recomandată

`ROADMAP.md`

Argumente:

1. este singurul document care se identifică explicit drept roadmap oficial;
2. acoperă întregul produs AGM, nu doar o etapă tehnică Premium;
3. separă deja domeniile Basic, Premium și Future Backlog;
4. poate integra noua direcție prin revizie controlată, fără pierderea istoricului;
5. păstrarea sa evită două surse concurente pentru priorități și faze.

### Ierarhia documentară recomandată

1. `ROADMAP.md` — ce se livrează, în ce ordine, cu ce rezultate și gate-uri;
2. contractul arhitectural și viziunea Hub — cum trebuie construit și ce constrângeri se respectă;
3. planurile de etapă și migrare — pașii tehnici detaliați;
4. rapoartele și deciziile — dovezile stării realizate.

În caz de contradicție, un plan tehnic nu trebuie să schimbe implicit Roadmap-ul. Diferența trebuie soluționată printr-o revizie controlată a documentului canonic.

## 5. Compatibilitatea cu arhitectura actuală

| Element arhitectural validat | Situația în `ROADMAP.md` | Verdict |
|---|---|---|
| Hub-uri Operaționale | Nu sunt definite ca structură principală; apar funcții separate | Nealiniere structurală |
| `TripContext` | Nu este prezentat ca obiect transversal și nucleu de lifecycle | Lipsă |
| Arhiva Operațională | Nu este definită drept memoria canonică de evenimente și dovezi | Lipsă |
| Servicii Comune | Capabilitățile apar dispersat, fără contract transversal comun | Compatibilitate parțială |
| Context Operațional Comun | Nu este consemnat ca bază obligatorie pentru toate modulele Premium | Lipsă |
| Flux vertical MVP | Nu există un increment end-to-end explicit | Lipsă |

Nu există o contradicție ireconciliabilă. Funcțiile enumerate în Roadmap — AI Copilot, WhatsApp, documente, traducere, transport și business — pot fi repoziționate în Hub-uri și pot consuma Serviciile Comune. Problema este de structurare, statut și ordine, nu de direcție fundamental greșită.

## 6. Diferențe și neconcordanțe

### 6.1 Model funcțional

Roadmap-ul tratează Premium ca o colecție de capabilități. Arhitectura actuală cere fluxuri complete între Hub-uri, cu stare comună și memorie operațională. Menținerea formei actuale ar favoriza module izolate și duplicarea contextului.

### 6.2 Ordinea de implementare

Roadmap-ul plasează inițierea arhitecturii Premium după stabilizarea Basic. Între timp, fundația Premium, shell-ul, registrul rutelor, `TripContext`, Contextul Operațional Comun și contractul Arhivei au evoluat. Ordinea și stările trebuie reconciliate cu dovezile existente.

### 6.3 MVP

Roadmap-ul nu stabilește un MVP vertical. Viziunea actuală propune un flux coerent care leagă Cockpit-ul, lifecycle-ul călătoriei, documentele și dovezile, Camera/OCR, revizuirea umană, traducerea/citirea, draftul de comunicare, EventStore și funcționarea offline.

### 6.4 Sursa de adevăr și proiecțiile

Rolul Arhivei Operaționale ca sursă canonică de evenimente nu este reflectat. Fără această precizare, jurnalele modulelor pot fi interpretate greșit ca surse independente.

### 6.5 Statut și trasabilitate

Roadmap-ul nu reflectă uniform rezultatele rapoartelor Premium și condițiile rămase deschise. Lipsesc metadate operaționale explicite precum owner, ultimă validare, rezultat măsurabil, dependențe și gate de închidere.

### 6.6 Mai multe secvențe tehnice

Planurile din Etapele 1, 2.0 și 3 descriu secvențe diferite, dar complementare. Fără o trimitere clară din Roadmap, ele pot părea planuri concurente. Acestea trebuie declarate planuri specializate sau istorice, nu surse strategice alternative.

## 7. Modificările necesare

Actualizarea ulterioară a `ROADMAP.md` trebuie să fie limitată la consolidare și aliniere:

1. adăugarea metadatelor de guvernanță: versiune, statut, owner, dată de validare și document succesor;
2. definirea explicită a ierarhiei documentare și a legăturilor către contractul arhitectural, viziunea Hub și planurile tehnice;
3. restructurarea secțiunii Premium din listă de module în program bazat pe Hub-uri Operaționale și Servicii Comune;
4. introducerea `TripContext`, Contextului Operațional Comun și Arhivei Operaționale ca fundații transversale;
5. definirea primului MVP vertical prin rezultat end-to-end, nu doar prin funcții individuale;
6. reconcilierea etapelor viitoare cu starea deja demonstrată de rapoartele de implementare;
7. consemnarea condițiilor rămase deschise: EventStore server-side, politici reale de acces, proiecție UI comună și migrarea controlată a modulelor rămase;
8. asocierea fiecărei faze cu owner, dependențe, criteriu de intrare, rezultat verificabil și gate de ieșire;
9. marcarea planurilor vechi drept „activ specializat”, „înlocuit” sau „istoric”, fără ștergerea dovezilor;
10. adăugarea unei reguli de revizie pentru a preveni apariția altor roadmap-uri concurente.

Detaliile tehnice, schemele și contractele nu trebuie copiate în Roadmap. Acesta trebuie să le indice prin referințe, păstrând separarea dintre strategie și implementare.

## 8. Impactul actualizării

### Impact pozitiv

- restaurează o singură sursă de adevăr pentru priorități și faze;
- aliniază execuția cu arhitectura integrată Premium;
- reduce riscul dezvoltării unor module izolate;
- face progresul și condițiile deschise vizibile;
- permite planificarea pe termen lung fără reorganizarea documentației;
- păstrează istoricul și dovezile tehnice existente.

### Cost și risc

- efort documentar moderat;
- necesită validarea atentă a stărilor curente înainte de marcarea etapelor drept finalizate;
- trimiterile din documentele secundare trebuie aliniate ulterior;
- dacă viziunea Hub nu are încă statut normativ final, Roadmap-ul trebuie să indice clar acest statut și să nu prezinte propunerile drept aprobări inexistente.

Nu rezultă impact asupra codului, artefactelor, infrastructurii sau serviciilor.

## 9. Recomandarea oficială

# ACTUALIZARE

`ROADMAP.md` rămâne documentul canonic. El este încă adaptabil și nu există justificare pentru înlocuire sau pentru redactarea unui Roadmap nou.

Actualizarea trebuie executată numai printr-un mandat separat, controlat, folosind contractul arhitectural și viziunea Hub ca surse de aliniere, planurile tehnice ca detaliu subordonat și rapoartele de implementare ca dovezi. Până atunci, `ROADMAP.md` rămâne sursa oficială existentă, cu nealinierea Premium consemnată prin prezentul raport.

## 10. Trasabilitate

SHA-256 pentru sursele principale verificate:

- `ROADMAP.md`: `6AA1B467605044015857D844D7D3CB9577516FE3865D6CD8106907735BE32E34`
- `AGM_PREMIUM_ARCHITECTURAL_CONTRACT_V1.md`: `A224F0296D7C24852D29FD9D487203E1C733AF6607A6FA884C31A701588B0CDF`
- `AGM_PREMIUM_HUB_ARCHITECTURE_VISION_2026-07-28.md`: `D983D90A321C231EE7303F695D08B0498D697E8503EC043A650807DE511C7170`
- `ETAPA_1/09_PLAN_ETAPIZAT_IMPLEMENTARE.md`: `50433E12C8BA73C5A8655947AED67FEEBAB512E592B3137A1B183EB5834AE842`
- `ETAPA_2_0/03_PLAN_ORDINE_INTEGRARE.md`: `F607A664637A1AE3A9A2604EFED247D81DB8B41DBCCC9CF2BC1367B90BF6040A`
- `ETAPA_3/08_PLAN_MIGRARE_MODULE.md`: `EB506AD31AFC8225DF14368E80E0947B4902AF6EED788474DEDF71EA48DFB8AA`
- `ETAPA_3/11_DECIZIE_INCHIDERE_OFICIALA.md`: `D1432AE9B6862B81EF7141331F2D810C89F0ED71BE8D8FEFD56DEA2B90003956`
- `ETAPA_2_2/README.md`: `1A0AA562428D105666A614009F448E22AF023F55E3CABE41EC1E775A8C6B3CAF`

