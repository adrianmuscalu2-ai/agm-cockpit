# DOCUMENT OFICIAL DE INIȚIERE – POC 02
## „După Plecare” – Asistență și conformitate în timpul transportului

**Data redactării:** 2026-07-20  
**Statut:** ✅ APROBAT – ETAPA 1 AUTORIZATĂ  
**Modul:** 09 – Legislație și conformitate  
**Baseline protejat:** POC 01 „Înainte de Plecare”  
**Commit baseline POC 01:** `769a6a2c4bca200341d3eee9b685ec3ec3c8bb5b`  

---

## 1. Decizia de inițiere

POC 02 este definit ca extensia operațională a POC 01 pentru intervalul care
începe după plecarea vehiculului și se termină înaintea procedurilor de
închidere a transportului la destinație.

Documentul autorizează numai analiza, planificarea și pregătirea arhitecturală.
Implementarea funcțională poate începe exclusiv după aprobarea explicită a
acestui document.

## 2. Obiectiv general

Construirea unui model documentar și operațional care ajută șoferul să
recunoască, să evalueze și să gestioneze în mod controlat situațiile apărute
în timpul transportului, fără a afecta funcționalitățile validate și fără a
prezenta recomandările drept aviz juridic, instrucțiune a autorităților sau
substitut pentru procedurile operatorului.

## 3. Obiective specifice

1. Definirea situațiilor reale apărute după plecare.
2. Separarea acțiunilor imediate de acțiunile care necesită escaladare.
3. Stabilirea informațiilor minime necesare pentru fiecare decizie.
4. Trasarea fluxului situație → evaluare → acțiune → dovadă → escaladare.
5. Definirea limitelor dintre responsabilitatea șoferului, operatorului și
   autorităților.
6. Proiectarea unei experiențe coerente în Browser și Android.
7. Introducerea controalelor de siguranță care previn recomandările
   neverificabile sau periculoase.
8. Păstrarea compatibilității cu POC 01 și cu infrastructura AGM existentă.

## 4. Domeniu de aplicare

### 4.1 Inclus în POC 02

POC 02 va documenta și valida conceptual următoarele familii de situații:

- control rutier sau solicitare de documente;
- incident, accident sau avarie;
- abatere de la rută, blocaj sau restricție apărută în traseu;
- oboseală, depășirea estimată a timpilor sau imposibilitatea continuării;
- problemă privind marfa, fixarea încărcăturii sau integritatea sigiliului;
- condiții meteo ori de drum care schimbă nivelul de risc;
- problemă de comunicare care necesită traducere asistată;
- escaladare către operator, dispecerat, serviciu de urgență sau autoritate;
- înregistrarea minimă a situației și a deciziei luate.

### 4.2 Exclus din POC 02

- activitățile „Înainte de Plecare”, deja acoperite de POC 01;
- procedurile complete „După Sosire”, rezervate unui POC ulterior;
- consultanță juridică individualizată;
- stabilirea sau garantarea cuantumului sancțiunilor;
- automatizarea apelurilor, mesajelor sau raportărilor fără confirmarea
  utilizatorului;
- conducerea autonomă ori decizii care înlocuiesc șoferul;
- diagnostic mecanic complet;
- monitorizare continuă a poziției sau colectare nouă de date personale;
- modificarea componentelor validate din POC 01 fără analiză și aprobare.

## 5. Ipoteze și limite

- Utilizatorul principal este șoferul profesionist.
- Aplicația poate avea conectivitate instabilă.
- Informațiile introduse pot fi incomplete sau inexacte.
- Recomandările trebuie formulate conservator și trebuie să permită oprirea
  fluxului atunci când siguranța este incertă.
- Pentru urgențe, instrucțiunile autorităților și procedurile operatorului au
  prioritate.
- Traducerile și textele generate trebuie verificate de utilizator înainte de
  folosirea oficială.
- Browser și Android trebuie să ofere aceeași logică de bază; diferențele de
  capabilități native trebuie documentate.

## 6. Livrabile etapizate

| Etapă | Livrabil obligatoriu | Rezultat necesar |
|---|---|---|
| E1 – Situații reale | catalog de scenarii, actori, date de intrare și limite | situații clare și diferențiate |
| E2 – Analiză operațională | obligații practice, drepturi, riscuri și escaladări | matrice situație–acțiune |
| E3 – Implementare funcțională controlată | nucleu operațional izolat, fără efecte externe și fără integrare în POC 01 | comportament testabil, conservator și reversibil |
| E4 – Integrare și prototip multiplatformă | flux minim Browser și Android, în limitele aprobate | comportament observabil și reversibil |
| E5 – Validare finală | raport de regresie, dovezi, limitări și decizie | PASS sau revenire în remediere |

Fiecare etapă va avea raport propriu, criterii măsurabile și checkpoint Git
după obținerea unui rezultat stabil.

## 7. Criterii de acceptanță

### 7.1 Criterii generale obligatorii

- toate cerințele implementate sunt trasabile la un obiectiv aprobat;
- nu există modificări neanalizate asupra POC 01;
- nu există marcaje provizorii în livrabilul declarat final;
- afirmațiile juridice sau monetare neconfirmabile sunt eliminate ori marcate;
- fluxurile critice au ieșire sigură: oprire, escaladare sau solicitare de date;
- nicio acțiune externă nu este executată fără confirmare explicită;
- textele și stările sunt coerente în limbile suportate;
- testele proiectului relevante trec;
- Browser și Android sunt validate separat;
- documentația reflectă fidel starea implementării.

### 7.2 Criterii Browser

- fluxul principal poate fi parcurs cu tastatură și pointer;
- stările loading, succes, lipsă date și eroare sunt vizibile;
- reîncărcarea sau revenirea nu produce acțiuni externe duplicate;
- funcționalitățile POC 01 relevante nu regresează;
- consola nu conține erori neexplicate în scenariile validate.

### 7.3 Criterii Android

- interfața este utilizabilă la dimensiunea țintă;
- revenirea din background păstrează o stare sigură;
- permisiunile sunt cerute numai la nevoie și refuzul este tratat;
- lipsa conexiunii produce un mesaj clar și nu o recomandare inventată;
- build-ul/sincronizarea Android și testele manuale stabilite sunt documentate.

## 8. Riscuri și măsuri de control

| ID | Risc | Impact | Control obligatoriu |
|---|---|---|---|
| R-01 | recomandare greșită într-o situație critică | foarte ridicat | răspuns conservator, oprire și escaladare |
| R-02 | utilizatorul tratează rezultatul ca aviz juridic | ridicat | limită vizibilă și surse declarate |
| R-03 | traducere incorectă a datelor esențiale | ridicat | avertizare și verificarea numelor, adreselor și numerelor |
| R-04 | regresie asupra POC 01 | ridicat | test de regresie și revizuire de impact |
| R-05 | comportament diferit Browser/Android | mediu | matrice de paritate și teste separate |
| R-06 | conectivitate absentă sau instabilă | ridicat | stare offline explicită și fără rezultat fabricat |
| R-07 | date personale sau sensibile în text | ridicat | minimizare, informare și transmitere numai la cerere |
| R-08 | dublarea unei acțiuni după retry | ridicat | idempotentă sau confirmare înaintea acțiunii |
| R-09 | extinderea necontrolată a scope-ului | mediu | change control și aprobare înainte de implementare |
| R-10 | documentație care depășește starea reală | ridicat | dovezi atașate fiecărei afirmații de validare |

## 9. Dependențe

- baseline-ul POC 01 și commitul său validat;
- serviciile AGM existente pentru traducere și stările lor de eroare;
- PWA/Capacitor pentru distribuția și testarea Android;
- infrastructura de i18n RO/DE/EN;
- mecanismele existente de confirmare, guvernanță și audit;
- disponibilitatea mediului Browser și a unui mediu Android de test;
- aprobarea Product Owner la checkpoint-urile definite.

Nicio dependență externă indisponibilă nu va fi ascunsă prin simularea unui
rezultat de producție.

## 10. Strategie de validare și testare

### Nivel 1 – verificare documentară

- trasabilitate între obiective, scenarii, cerințe și riscuri;
- verificarea limitelor și a formulărilor neconfirmabile;
- actualizarea manifestului și a deciziilor.

### Nivel 2 – verificare automată

- typecheck, teste unitare și teste de integrare relevante;
- teste pentru tranzițiile de stare și gestionarea erorilor;
- teste de regresie pentru componentele baseline;
- verificarea că nicio acțiune externă nu pornește fără confirmare.

### Nivel 3 – Browser

- scenarii nominale și negative;
- accesibilitate de bază și navigare cu tastatura;
- comportament la refresh, retry, timeout și lipsa conexiunii;
- capturi sau loguri asociate rezultatului.

### Nivel 4 – Android

- build/sync conform procedurii existente;
- verificarea dimensiunii, ciclului de viață și permisiunilor;
- testarea conectivității și revenirea din background;
- raport cu dispozitivul/versiunea și rezultatul fiecărui scenariu.

### Nivel 5 – checkpoint

- raport consolidat;
- diferențe Git controlate;
- zero regresii critice cunoscute;
- decizie explicită: PASS, REMEDIERE sau OPRIRE.

## 11. Criterii oficiale de închidere

POC 02 poate fi închis numai dacă:

1. toate livrabilele aprobate există și sunt inventariate;
2. criteriile de acceptanță obligatorii sunt demonstrate;
3. testele Browser și Android au dovezi și rezultat acceptat;
4. regresia față de POC 01 este exclusă în aria testată;
5. riscurile critice sunt închise sau acceptate explicit;
6. limitările rămase sunt declarate;
7. documentația și statusurile sunt armonizate;
8. checkpoint-ul Git este identificat;
9. Product Owner emite decizia finală;
10. arhiva și manifestul de integritate sunt generate, dacă se autorizează
    baseline-ul POC 02.

## 12. Controlul schimbărilor

Orice schimbare care extinde scope-ul, modifică un criteriu de acceptanță,
afectează baseline-ul POC 01 sau introduce o acțiune externă nouă necesită:

1. descrierea schimbării;
2. analiza impactului și a riscurilor;
3. actualizarea testelor și documentației;
4. aprobarea înainte de implementare.

## 13. Condiția de start a implementării

Implementarea ETAPEI 1 a POC 02 este autorizată numai după completarea
următorului checkpoint:

| Control | Stare |
|---|---|
| Obiectiv general definit | ✅ |
| Obiective specifice definite | ✅ |
| Scope inclus/exclus definit | ✅ |
| Livrabile etapizate definite | ✅ |
| Criterii de acceptanță definite | ✅ |
| Riscuri și dependențe definite | ✅ |
| Strategie de testare definită | ✅ |
| Criterii de închidere definite | ✅ |
| Aprobare Product Owner | ✅ ACORDATĂ – 2026-07-20 |

**Decizie curentă:** document aprobat. ETAPELE 1 și 2 sunt închise oficial.
Prin autorizarea Product Owner din 2026-07-20, ETAPA 3 este redefinită și
autorizată ca prima etapă de implementare funcțională controlată. Schimbarea
este limitată la un nucleu izolat, fără integrare în POC 01 și fără acțiuni
externe. ETAPA 4 va prelua integrarea și prototipul Browser/Android.

---

🚛 **AGM respiră prin noi.**
