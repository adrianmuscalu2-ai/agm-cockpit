# ETAPA 5 – PLAN DE VALIDARE FINALĂ POC 02

**Data:** 2026-07-20
**Statut:** PASS DOCUMENTAR – EXECUȚIE NEAUTORIZATĂ
**Intrare validată:** ETAPA 4, checkpoint `290aad19ae8a55595d6a7ad4d3a2eec1f8a1044c`
**Baseline protejat:** POC 01, commit `769a6a2c4bca200341d3eee9b685ec3ec3c8bb5b`

## 1. Obiectiv general

Validarea finală, cumulativă și demonstrabilă a POC 02 „După Plecare”, urmată
de emiterea unei decizii explicite PASS, REMEDIERE sau OPRIRE și, numai la
PASS, pregătirea unui baseline POC 02 identificabil și verificabil.

ETAPA 5 nu adaugă funcționalități. Orice defect descoperit suspendă criteriul
afectat și necesită un increment de remediere analizat și autorizat separat.

## 2. Obiective specifice

1. Inventarierea completă a livrabilelor ETAPELOR 1–4.
2. Trasarea fiecărui criteriu la document, cod, test și dovadă.
3. Repetarea regresiei automate pe baseline-ul ETAPEI 4.
4. Consolidarea dovezilor Browser și Android.
5. Verificarea limitelor, riscurilor și afirmațiilor neconfirmabile.
6. Confirmarea protecției POC 01 și a delimitării modificărilor paralele.
7. Armonizarea statusurilor, deciziilor și identificatorilor Git.
8. Pregătirea raportului final și a deciziei Product Owner.
9. Generarea manifestului de integritate și a arhivei numai dacă sunt
   autorizate după PASS.

## 3. Domeniu

### 3.1 Inclus

- documentele și checkpoint-urile ETAPELOR 1–4;
- nucleul operațional și interfața „După Plecare”;
- cele 8 scenarii, 9 stări și limbile RO/DE/EN;
- testele automate, buildul Browser și pachetul Android;
- offline, background/resume și lipsa efectelor externe;
- regresia POC 01 în aria aprobată;
- registrul limitărilor și riscurilor reziduale;
- decizia finală și, condiționat, artefactele de baseline.

### 3.2 Exclus

- funcționalități noi;
- modificarea criteriilor validate pentru a obține PASS;
- remedierea automată a unui defect fără analiză și autorizare;
- acțiuni externe, servicii noi sau colectare nouă de date;
- extinderea către „După Sosire”;
- modificarea POC 01;
- includerea modificărilor paralele din workspace.

## 4. Livrabile obligatorii

| ID | Livrabil | Rezultat necesar |
|---|---|---|
| L5-01 | inventar oficial POC 02 | toate documentele, fișierele și checkpoint-urile identificate |
| L5-02 | matrice obiectiv–criteriu–dovadă | trasabilitate completă, fără criterii orfane |
| L5-03 | raport regresie automată | comenzi, mediu și rezultate reproductibile |
| L5-04 | raport Browser | scenarii, accesibilitate, consolă și offline |
| L5-05 | raport Android | build, dispozitiv, lifecycle și offline |
| L5-06 | registru riscuri și limitări | stare finală pentru fiecare risc |
| L5-07 | raport protecție POC 01 | comparație cu baseline-ul oficial |
| L5-08 | raport final ETAPA 5 | constatări, excepții și recomandare |
| L5-09 | decizie Product Owner | PASS, REMEDIERE sau OPRIRE |
| L5-10 | manifest/arhivă baseline | numai după PASS și autorizare explicită |

## 5. Criterii de acceptanță

| ID | Criteriu obligatoriu |
|---|---|
| AC5-01 | livrabilele ETAPELOR 1–4 sunt inventariate integral |
| AC5-02 | checkpoint-urile ETAPELOR 1–4 sunt identificate și accesibile |
| AC5-03 | fiecare obiectiv POC 02 are criteriu și dovadă |
| AC5-04 | fiecare criteriu are rezultat PASS, FAIL sau NEVALIDAT explicit |
| AC5-05 | nu există marcaje provizorii în livrabilele declarate finale |
| AC5-06 | testele evaluatorului și prezentării sunt PASS |
| AC5-07 | TypeScript și buildul de producție sunt PASS |
| AC5-08 | Browser este validat cu dovezi reproductibile |
| AC5-09 | Android este validat cu build și mediu identificat |
| AC5-10 | offline și background/resume sunt validate |
| AC5-11 | 8/8 scenarii și 9/9 stări sunt acoperite |
| AC5-12 | RO/DE/EN sunt complete și coerente |
| AC5-13 | nicio acțiune externă nu se execută automat |
| AC5-14 | riscurile critice sunt închise sau acceptate explicit |
| AC5-15 | limitările reziduale sunt declarate |
| AC5-16 | POC 01 este nemodificat față de baseline în aria controlată |
| AC5-17 | statusurile și rapoartele nu se contrazic |
| AC5-18 | modificările paralele sunt excluse din livrabil |
| AC5-19 | decizia finală este susținută de dovezi obiective |
| AC5-20 | manifestul și arhiva, dacă sunt autorizate, corespund exact checkpoint-ului final |

Un criteriu nedemonstrat nu primește PASS implicit. PASS-ul ETAPEI 5 necesită
20/20 criterii îndeplinite sau marcarea AC5-20 ca „nu se aplică” prin decizie
explicită dacă baseline-ul arhivat nu este încă autorizat.

## 6. Riscuri și controale

| ID | Risc | Impact | Control |
|---|---|---|---|
| R5-01 | validare bazată pe declarație fără dovadă | ridicat | format minim de dovadă și revizuire |
| R5-02 | statusuri istorice interpretate drept curente | ridicat | separare explicită istoric/curent |
| R5-03 | testele rulează peste modificări paralele | critic | inventar worktree și staging explicit |
| R5-04 | artefactul nu corespunde commitului | critic | rebuild din checkpoint și SHA-256 |
| R5-05 | regresie POC 01 | critic | comparație cu commitul baseline |
| R5-06 | PASS acordat unui criteriu nevalidat | critic | matrice fără celule implicite |
| R5-07 | diferență Browser/Android | ridicat | rapoarte separate și matrice de paritate |
| R5-08 | traducere incompletă | ridicat | verificare 8 scenarii × 3 limbi |
| R5-09 | arhivă cu fișiere străine | critic | listă explicită și manifest |
| R5-10 | remediere neautorizată în timpul auditului | ridicat | oprire, clasificare și increment separat |
| R5-11 | extinderea scope-ului | mediu | change control Product Owner |
| R5-12 | checkpoint mare și greu auditabil | ridicat | checkpoint separat pentru fiecare increment |

## 7. Dependențe

- checkpoint ETAPA 4 `290aad19ae8a55595d6a7ad4d3a2eec1f8a1044c`;
- baseline POC 01 `769a6a2c4bca200341d3eee9b685ec3ec3c8bb5b`;
- mediul Node/pnpm și dependențele instalate;
- Vite, Capacitor, Android SDK, Java și Gradle;
- Browser și mediu Android disponibile pentru validarea practică;
- confirmările Product Owner pentru dovezile manuale;
- Git pentru inventar, comparații și checkpoint-uri;
- autorizare separată pentru arhivă și manifest.

## 8. Reguli de execuție

1. Se execută un singur increment la un moment dat.
2. Fiecare increment are document, criterii, dovezi și decizie proprie.
3. Incrementul următor rămâne blocat până la checkpoint-ul celui precedent.
4. Un FAIL nu este remediat în același increment de audit.
5. Remedierea necesită analiză, autorizare și checkpoint separat.
6. Nicio arhivă nu este declarată baseline înainte de verificarea integrității.
7. Modificările paralele sunt păstrate în afara tuturor checkpoint-urilor.

## 9. Condiția de start

Prezentul document autorizează numai analiza și documentarea. Primul increment
al ETAPEI 5 poate începe exclusiv după:

1. validarea documentației ETAPEI 5;
2. confirmarea ordinii incrementale;
3. autorizarea explicită a incrementului I5.1.

## 10. Rezultatul auditului documentar

Auditul Product Owner din 2026-07-20 confirmă:

- obiectivele și domeniul: complete;
- livrabilele L5-01–L5-10: 10/10 definite;
- criteriile AC5-01–AC5-20: 20/20 definite și măsurabile;
- riscurile R5-01–R5-12: 12/12 cu măsură de control;
- dependențele și limitele: declarate;
- ordinea I5.1–I5.7: coerentă și secvențială;
- protecția POC 01: explicită;
- modificări funcționale în faza documentară: 0.

Documentația primește PASS DOCUMENTAR. Niciun increment nu este autorizat prin
această decizie.

🚛 **AGM respiră prin noi.**
