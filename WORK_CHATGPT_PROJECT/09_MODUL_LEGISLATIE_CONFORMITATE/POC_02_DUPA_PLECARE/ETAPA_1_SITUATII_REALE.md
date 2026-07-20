# POC 02 „DUPĂ PLECARE”
## ETAPA 1 – DEFINIREA SITUAȚIILOR REALE

**Data inițierii:** 2026-07-20  
**Statut:** ✅ CONFIRMATĂ DOCUMENTAR – ÎNCHISĂ OFICIAL  
**Baseline protejat:** POC 01, commit `769a6a2c4bca200341d3eee9b685ec3ec3c8bb5b`  
**Tip livrabil:** model documentar; fără implementare de cod  

## 1. Limita operațională

ETAPA 1 acoperă perioada dintre confirmarea plecării și intrarea în procedura
de sosire/predare. Scopul este descrierea situației și a informațiilor
necesare, nu emiterea unei concluzii juridice sau automatizarea deciziei.

### Eveniment de intrare

- vehiculul a plecat;
- verificările pre-plecare aparțin POC 01 și sunt considerate încheiate;
- șoferul se află în cursă sau într-o oprire asociată cursei.

### Eveniment de ieșire

- situația a fost stabilizată, documentată și escaladată, dacă este necesar;
- transportul continuă în siguranță; sau
- transportul rămâne oprit și responsabilitatea a fost transferată către
  operator, serviciul de urgență ori autoritatea competentă; sau
- începe procedura „După Sosire”, în afara POC 02.

## 2. Actori

| Actor | Rol în situație | Limită |
|---|---|---|
| Șofer | observă, oprește în siguranță, introduce date și confirmă acțiuni | nu este înlocuit de aplicație |
| Operator/dispecerat | decide operațional, oferă instrucțiuni și resurse | nu este contactat automat fără confirmare |
| Autoritate | controlează și emite instrucțiuni oficiale | aplicația nu interpretează ori contestă autoritatea |
| Serviciu de urgență | gestionează urgența | are prioritate față de fluxul aplicației |
| Destinatar/expeditor | clarifică marfa, documentele sau livrarea | primește doar date confirmate |
| AGM | structurează informația și propune pași conservatori | nu oferă aviz juridic sau diagnostic complet |

## 3. Date comune minime

Datele sunt solicitate numai dacă sunt relevante și disponibile:

- tipul situației;
- vehicul oprit în siguranță: da/nu/necunoscut;
- existența persoanelor rănite sau a unui pericol imediat;
- țara și poziția aproximativă;
- direcția și etapa cursei;
- ora observării;
- descrierea faptelor observabile;
- instrucțiuni deja primite;
- persoana sau instituția contactată;
- documente ori fotografii disponibile;
- acțiunea pe care utilizatorul dorește să o execute.

Aplicația nu trebuie să blocheze apelarea serviciilor de urgență pentru lipsa
unor date.

## 4. Reguli transversale

1. Siguranța persoanelor are prioritate.
2. Dacă vehiculul nu este oprit în siguranță, interacțiunea detaliată este
   amânată.
3. Faptele observabile sunt separate de presupuneri.
4. Lipsa datelor produce solicitare de clarificare, nu rezultat inventat.
5. Orice mesaj, apel sau transmitere externă necesită confirmarea utilizatorului.
6. Instrucțiunile autorităților și procedurile operatorului au prioritate.
7. Recomandarea trebuie să permită explicit „OPREȘTE ȘI ESCALEAZĂ”.
8. Datele personale și comerciale sunt minimizate.
9. Traducerea trebuie verificată înainte de utilizarea oficială.
10. Limitele și incertitudinile sunt afișate, nu ascunse.

## 5. Catalogul scenariilor

### S-01 – Control rutier sau solicitare de documente

**Declanșator:** șoferul este oprit ori primește o solicitare oficială.

**Obiectiv:** organizarea faptelor, identificarea documentului solicitat și
sprijinirea comunicării fără obstrucționarea controlului.

**Intrări specifice:**

- autoritatea/semnele de identificare observate;
- documentul sau informația solicitată;
- limba comunicării;
- termenul ori instrucțiunea primită;
- existența unui proces-verbal sau formular.

**Ieșire sigură:**

- prezentarea documentului disponibil;
- solicitarea calmă de clarificare/traducere;
- contactarea operatorului, dacă este necesar;
- păstrarea unei evidențe a solicitării.

**Limite:** AGM nu recomandă refuzul controlului, nu contestă sancțiunea și nu
pretinde că un document este suficient fără verificarea contextului.

### S-02 – Accident, incident sau pericol imediat

**Declanșator:** coliziune, persoană rănită, incendiu, scurgere sau pericol
pentru trafic.

**Obiectiv:** prioritatea vieții, oprirea fluxului normal și escaladarea.

**Intrări specifice:**

- persoane rănite: da/nu/necunoscut;
- pericol activ: foc, fum, scurgere, trafic;
- poziție aproximativă și sens de mers;
- tipul încărcăturii cunoscut;
- servicii deja contactate.

**Ieșire sigură:**

- instrucțiune de oprire și protejare numai dacă poate fi făcută în siguranță;
- apelarea serviciului de urgență potrivit;
- informarea privind marfa periculoasă, dacă este cazul;
- contactarea operatorului după gestionarea urgenței.

**Limite:** AGM nu oferă instrucțiuni medicale avansate, nu recomandă
manipularea substanțelor și nu cere fotografii înaintea apelului de urgență.

### S-03 – Avarie sau imposibilitatea tehnică de continuare

**Declanșator:** martor critic, pierdere de putere, pană, temperatură excesivă,
problemă la frâne sau alt simptom care poate face continuarea nesigură.

**Obiectiv:** separarea simptomului observat de diagnostic și oprirea sigură.

**Intrări specifice:**

- simptomul exact și martorul afișat;
- vehiculul se poate opri în siguranță;
- poziția și condițiile de trafic;
- existența unui pericol asociat mărfii;
- asistența tehnică/operatorul contactat.

**Ieșire sigură:**

- oprirea și semnalizarea conform contextului;
- transmiterea simptomelor către operator/asistență;
- interdicția de a continua atunci când siguranța nu poate fi stabilită.

**Limite:** aplicația nu diagnostichează mecanic și nu autorizează reparații
periculoase pe carosabil.

### S-04 – Oboseală sau imposibilitatea respectării timpilor

**Declanșator:** somnolență, pierderea concentrării, întârziere semnificativă
sau estimarea că planul nu mai poate fi respectat în siguranță.

**Obiectiv:** oprirea presiunii de a continua și documentarea escaladării.

**Intrări specifice:**

- semne observabile de oboseală;
- durata aproximativă a activității și pauzele înregistrate;
- loc sigur disponibil pentru oprire;
- instrucțiunea dispeceratului;
- estimarea revizuită a cursei.

**Ieșire sigură:**

- identificarea primei opriri sigure;
- informarea operatorului că planul trebuie revizuit;
- păstrarea unei evidențe a informării;
- continuarea numai după ce utilizatorul confirmă că situația este sigură și
  regulile aplicabile sunt respectate.

**Limite:** AGM nu calculează automat conformitatea legală din date incomplete
și nu recomandă folosirea telefonului în timpul conducerii.

### S-05 – Problemă privind marfa, fixarea sau sigiliul

**Declanșator:** zgomot neobișnuit, deplasarea încărcăturii, sigiliu deteriorat,
scurgere, temperatură neconformă ori diferență observată.

**Obiectiv:** evitarea manipulării riscante și escaladarea către rolul competent.

**Intrări specifice:**

- tipul mărfii și pericolul cunoscut;
- semnul observat;
- integritatea compartimentului/sigiliului;
- existența unei scurgeri;
- instrucțiuni ADR sau proceduri ale operatorului disponibile.

**Ieșire sigură:**

- oprire într-un loc adecvat, dacă este sigur;
- neatingerea mărfii când riscul este necunoscut;
- contactarea operatorului și, la nevoie, a serviciilor competente;
- documentarea numai dintr-o poziție sigură.

**Limite:** AGM nu recomandă desigilarea, rearanjarea sau neutralizarea unei
mărfi fără autoritate și competență.

### S-06 – Rută blocată, restricție sau abatere

**Declanșator:** drum închis, restricție de tonaj/înălțime, deviere impusă,
frontieră blocată sau rută incompatibilă cu transportul.

**Obiectiv:** prevenirea intrării pe o rută nesigură și revizuirea controlată.

**Intrări specifice:**

- semnul/restricția observată;
- dimensiunile și masa relevante cunoscute;
- tipul mărfii și restricțiile speciale;
- traseul alternativ propus;
- aprobarea operatorului.

**Ieșire sigură:**

- oprirea înaintea încălcării restricției, dacă este posibil;
- solicitarea unei rute verificate;
- transmiterea datelor către operator;
- actualizarea estimării numai după confirmare.

**Limite:** AGM nu garantează că o rută este autorizată doar pe baza unei hărți
generale și nu recomandă ignorarea semnalizării locale.

### S-07 – Condiții meteo sau de drum deteriorate

**Declanșator:** ploaie severă, zăpadă, gheață, vânt, vizibilitate redusă,
inundație sau carosabil nesigur.

**Obiectiv:** reducerea expunerii și oprirea atunci când continuarea este
incertă.

**Intrări specifice:**

- fenomenul observat;
- vizibilitatea și starea carosabilului;
- avertizări sau restricții oficiale;
- loc sigur de oprire;
- încărcătura și stabilitatea cunoscută.

**Ieșire sigură:**

- adaptarea conservatoare sau oprirea în condiții sigure;
- consultarea avertizărilor oficiale disponibile;
- informarea operatorului despre întârziere.

**Limite:** AGM nu stabilește o viteză universal sigură și nu contrazice
restricțiile autorităților.

### S-08 – Barieră de limbă în cursul unei situații

**Declanșator:** șoferul nu înțelege o solicitare ori trebuie să transmită rapid
date esențiale.

**Obiectiv:** structurarea unui mesaj scurt și verificabil.

**Intrări specifice:**

- limba sursă și limba țintă;
- interlocutorul;
- scopul mesajului;
- numele, adresele, numerele și termenii care nu trebuie alterați;
- nivelul de urgență.

**Ieșire sigură:**

- traducere scurtă cu avertizare de verificare;
- afișarea textului sursă și țintă împreună;
- posibilitatea de copiere/redare numai la acțiunea utilizatorului.

**Limite:** traducerea nu este certificată, iar datele critice trebuie
confirmate de interlocutori.

## 6. Matrice de prioritate

| Nivel | Condiție | Răspuns conceptual |
|---|---|---|
| P0 – Urgență | persoane rănite, incendiu, scurgere, pericol imediat | oprește fluxul normal; urgență și instrucțiuni oficiale |
| P1 – Siguranță | continuarea poate produce accident sau agrava situația | oprire sigură și escaladare |
| P2 – Conformitate/operațional | control, document, rută, marfă fără pericol imediat | clarificare, dovadă și operator |
| P3 – Comunicare | barieră de limbă fără risc imediat | traducere asistată și verificare |

Orice indiciu P0 are prioritate față de toate celelalte clasificări.

## 7. Model comun de ieșire

Fiecare scenariu din ETAPA 2 trebuie să poată produce următoarea structură:

1. **Ce știm** – fapte introduse sau observate.
2. **Ce nu știm** – date lipsă și incertitudini.
3. **Nivel de prioritate** – P0–P3, cu explicație.
4. **Acțiune imediată sigură** – maximum trei pași.
5. **Cine trebuie contactat** – fără contact automat.
6. **Ce dovadă se păstrează** – numai dacă este sigur și permis.
7. **Ce nu trebuie făcut** – limită explicită.
8. **Confirmarea utilizatorului** – înaintea oricărei acțiuni externe.

## 8. Criterii de acceptanță ETAPA 1

- minimum 8 scenarii distincte;
- fiecare scenariu are declanșator, obiectiv, intrări, ieșire și limite;
- actorii și responsabilitățile sunt delimitate;
- există reguli transversale și prioritizare P0–P3;
- există model comun de ieșire pentru ETAPA 2;
- urgențele nu sunt condiționate de completarea formularului;
- nu există sancțiuni monetare ori afirmații juridice prezentate ca certe;
- Browser și Android sunt considerate în limitele de utilizare;
- POC 01 nu este modificat;
- implementarea de cod nu este inițiată.

## 9. Condiția de trecere la ETAPA 2

ETAPA 2 poate începe numai după:

1. validarea catalogului de scenarii;
2. aprobarea regulilor transversale;
3. confirmarea limitelor POC;
4. consemnarea observațiilor și remedierea lor;
5. autorizarea explicită Product Owner.

**Checkpoint ETAPA 1:** criteriile 1–4 sunt confirmate documentar. ETAPA 1 este
închisă oficial. Este autorizată pregătirea procesului de validare pentru
ETAPA 2, dar implementarea ETAPEI 2 rămâne neautorizată până la o decizie
explicită separată.

---

🚛 **AGM respiră prin noi.**
