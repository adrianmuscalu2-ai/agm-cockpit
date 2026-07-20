# POC 02 „DUPĂ PLECARE”
## ETAPA 2 – ANALIZĂ OPERAȚIONALĂ

**Data inițierii:** 2026-07-20  
**Statut:** ✅ PASS DOCUMENTAR – ÎNCHISĂ OFICIAL  
**Sursă:** ETAPA 1 validată, commit `e88268185c2e0ba4b8902e10652c7b75529bb01f`  
**Implementare de cod:** NEINIȚIATĂ  

## 1. Obiectiv

Transformarea celor 8 situații reale validate în reguli operaționale
verificabile. ETAPA 2 definește ce trebuie observat, ce acțiuni sunt permise,
ce drepturi operaționale trebuie respectate, când fluxul se oprește și către
cine se escaladează.

Documentul nu validează baza juridică și nu introduce cuantumuri de sancțiuni.

## 2. Reguli comune de decizie

### 2.1 Ordinea obligatorie

1. **Siguranță:** există persoane rănite sau pericol imediat?
2. **Poziție sigură:** poate utilizatorul interacționa fără a conduce?
3. **Fapte:** ce este observat direct?
4. **Incertitudini:** ce informații lipsesc?
5. **Prioritate:** P0, P1, P2 sau P3.
6. **Acțiune minimă sigură:** maximum trei pași.
7. **Escaladare:** cine trebuie informat?
8. **Confirmare:** utilizatorul aprobă orice acțiune externă.
9. **Dovadă:** se păstrează numai dacă este sigur și permis.
10. **Închidere:** continuare, așteptare, transfer sau sosire.

### 2.2 Drepturi operaționale comune

Utilizatorul trebuie să poată:

- opri fluxul și cere ajutor;
- declara că nu poate interacționa în siguranță;
- corecta datele introduse;
- vedea faptele separat de recomandări;
- vedea sursa și limita unei afirmații;
- refuza transmiterea externă;
- solicita o formulare mai scurtă sau o traducere;
- reveni la starea anterioară fără trimitere duplicată;
- păstra ori șterge schița locală conform funcției aprobate;
- escalada către un om atunci când situația depășește modelul.

### 2.3 Interdicții comune

AGM nu trebuie să:

- solicite interacțiune detaliată în timpul conducerii;
- simuleze un apel, mesaj sau raport trimis;
- completeze date lipsă ca și cum ar fi certe;
- promită că un document ori comportament garantează conformitatea;
- ofere diagnostic medical, mecanic sau juridic complet;
- contrazică instrucțiunile autorităților ori serviciilor de urgență;
- recomande manipularea unei mărfi cu risc necunoscut;
- ascundă lipsa conectivității sau indisponibilitatea serviciului;
- reutilizeze date într-un alt scop fără acțiunea utilizatorului;
- transforme recomandarea într-o comandă automată.

## 3. Modelul stărilor

| Stare | Semnificație | Tranziție permisă |
|---|---|---|
| `NEW` | situație nouă, neclasificată | colectare minimă |
| `UNSAFE_TO_INTERACT` | utilizatorul conduce sau locul nu este sigur | instrucțiune scurtă; reluare ulterioară |
| `EMERGENCY` | există indiciu P0 | urgență și transfer |
| `NEEDS_FACTS` | lipsesc date esențiale | întrebări minime |
| `ASSESSED` | faptele și prioritatea sunt stabilite | propunere acțiune |
| `AWAITING_CONFIRMATION` | există o acțiune externă propusă | confirmare/anulare |
| `ESCALATED` | responsabilitatea este transferată | așteptare și evidență |
| `SAFE_TO_CONTINUE` | situația este stabilizată | revenire la cursă |
| `CLOSED` | fluxul este încheiat | numai vizualizare/evidență |

### Reguli de tranziție

- orice stare poate trece în `EMERGENCY` dacă apare un indiciu P0;
- nicio stare nu trece la `SAFE_TO_CONTINUE` cât timp există risc critic
  necunoscut;
- `AWAITING_CONFIRMATION` nu produce efect extern fără confirmare;
- timeout-ul nu echivalează cu acceptarea;
- retry-ul nu trebuie să dubleze acțiunea;
- anularea păstrează o stare sigură și explicită.

## 4. Analiza scenariilor

### AO-01 – Control rutier

**Obligații practice:**

1. utilizatorul confirmă că vehiculul este oprit;
2. identifică solicitarea fără a interpreta intenția autorității;
3. prezintă numai documentele disponibile și solicitate;
4. cere clarificare dacă nu înțelege;
5. informează operatorul când solicitarea depășește informația disponibilă;
6. păstrează evidența documentului primit, dacă este permis.

**Drepturi operaționale:**

- traducerea solicitării;
- afișarea textului sursă și țintă;
- corectarea numelor și numerelor înainte de comunicare;
- contactarea operatorului;
- marcarea rezultatului ca traducere necertificată.

**Prag de oprire:** conflict, solicitare neînțeleasă, document indisponibil,
semnarea unui text neînțeles sau indicație oficială de a aștepta.

**Escaladare:** autoritate → operator/dispecerat → suport uman specializat.

**Dovadă minimă:** ora, locul aproximativ, documentul solicitat și
instrucțiunea primită.

### AO-02 – Accident sau pericol imediat

**Obligații practice:**

1. verifică existența răniților și a pericolului activ;
2. oprește fluxul normal;
3. contactează serviciul de urgență potrivit;
4. comunică poziția și natura pericolului;
5. menționează marfa periculoasă dacă este cunoscută;
6. informează operatorul după gestionarea priorității imediate.

**Drepturi operaționale:**

- acces rapid la mesajul de urgență;
- folosirea unei traduceri scurte;
- omiterea completării formularului înaintea apelului;
- abandonarea fluxului aplicației.

**Prag de oprire:** orice indiciu de rănire, foc, fum, scurgere, trafic expus
sau pericol necunoscut.

**Escaladare:** serviciu de urgență → autoritate → operator.

**Dovadă minimă:** numai după stabilizare; ora și poziția aproximativă.

### AO-03 – Avarie

**Obligații practice:**

1. descrie simptomul observat, nu diagnosticul presupus;
2. oprește în siguranță dacă există risc;
3. semnalizează conform contextului;
4. transmite simptomele operatorului/asistenței;
5. nu continuă dacă siguranța nu poate fi stabilită;
6. urmează instrucțiunea asistenței competente.

**Drepturi operaționale:**

- declararea situației „nu pot continua în siguranță”;
- transmiterea structurată a simptomelor;
- refuzul unei recomandări automate de continuare;
- revenirea la flux după confirmarea reparației/asistenței.

**Prag de oprire:** frâne, direcție, pneu deteriorat, temperatură critică,
fum, scurgere sau martor critic neînțeles.

**Escaladare:** operator → asistență tehnică → urgență, dacă apare pericol.

**Dovadă minimă:** simptom, martor, oră, poziție și instrucțiune primită.

### AO-04 – Oboseală sau plan imposibil

**Obligații practice:**

1. recunoaște semnele de pierdere a capacității de concentrare;
2. evită interacțiunea complexă în mers;
3. identifică prima posibilitate sigură de oprire;
4. informează operatorul că planul trebuie revizuit;
5. păstrează dovada informării;
6. nu confirmă continuarea pe baza presiunii de timp.

**Drepturi operaționale:**

- declararea oboselii fără mascarea motivului;
- solicitarea revizuirii planului;
- respingerea unui termen imposibil în condiții sigure;
- păstrarea mesajului trimis operatorului.

**Prag de oprire:** somnolență, microsomn, dezorientare, vedere neclară,
reacții întârziate sau imposibilitatea estimării sigure.

**Escaladare:** operator/dispecerat → responsabil operațional.

**Dovadă minimă:** ora informării, simptome declarate și răspunsul operatorului.

### AO-05 – Marfă, fixare sau sigiliu

**Obligații practice:**

1. nu deschide și nu manipulează când riscul este necunoscut;
2. oprește într-o poziție adecvată, dacă poate;
3. identifică semnul observabil;
4. verifică instrucțiunile disponibile fără a improviza;
5. contactează operatorul;
6. escaladează imediat dacă există scurgere sau pericol.

**Drepturi operaționale:**

- refuzul manipulării nesigure;
- transmiterea unei descrieri/fotografii numai din poziție sigură;
- solicitarea instrucțiunilor competente;
- păstrarea integrității sigiliului până la autorizare.

**Prag de oprire:** scurgere, miros, fum, deplasare majoră, ușă instabilă,
sigiliu deteriorat sau marfă necunoscută.

**Escaladare:** operator → responsabil marfă/ADR → urgență/autoritate.

**Dovadă minimă:** semnul observat, sigiliul, ora și instrucțiunea primită.

### AO-06 – Rută blocată sau restricție

**Obligații practice:**

1. respectă semnalizarea locală;
2. nu intră într-o zonă cu compatibilitate incertă;
3. transmite restricția și poziția;
4. compară alternativa cu datele confirmate ale vehiculului/mărfii;
5. solicită aprobarea operatorului;
6. actualizează estimarea după confirmarea rutei.

**Drepturi operaționale:**

- refuzul unei rute neverificate;
- solicitarea unui traseu alternativ;
- afișarea motivului restricției;
- păstrarea propunerii ca schiță până la confirmare.

**Prag de oprire:** limită de înălțime/masă incompatibilă, drum închis,
interdicție pentru marfă ori traseu fără posibilitate sigură de întoarcere.

**Escaladare:** operator/planificator → autoritate locală, dacă este necesar.

**Dovadă minimă:** restricția, poziția, ruta propusă și aprobarea.

### AO-07 – Meteo sau drum deteriorat

**Obligații practice:**

1. descrie condiția observată;
2. consultă avertizarea oficială disponibilă;
3. reduce expunerea fără a stabili o viteză universală;
4. caută oprire sigură când continuarea este incertă;
5. informează operatorul;
6. reia numai după reevaluare.

**Drepturi operaționale:**

- oprirea cursei din motive de siguranță;
- solicitarea revizuirii termenului;
- acces la sursa avertizării;
- refuzul unei recomandări care contrazice semnalizarea.

**Prag de oprire:** vizibilitate insuficientă, gheață, inundație, vânt sever,
carosabil blocat sau avertizare oficială incompatibilă cu continuarea.

**Escaladare:** operator → autoritate/serviciu rutier → urgență, dacă este cazul.

**Dovadă minimă:** fenomen, loc, oră și avertizare consultată.

### AO-08 – Barieră de limbă

**Obligații practice:**

1. identifică interlocutorul și scopul;
2. păstrează mesajul scurt;
3. marchează numele, adresele și numerele care nu trebuie alterate;
4. afișează sursa și traducerea;
5. cere verificarea interlocutorului;
6. nu prezintă traducerea drept certificată.

**Drepturi operaționale:**

- editarea textului sursă;
- schimbarea limbii țintă;
- copiere/redare numai la comandă;
- anularea înaintea transmiterii;
- solicitarea unui interpret uman.

**Prag de oprire:** mesaj juridic complex, termen necunoscut, discrepanță între
date, traducere indisponibilă sau rezultat cu încredere insuficientă.

**Escaladare:** interlocutor → operator/interpret → serviciu competent.

**Dovadă minimă:** textul sursă, traducerea folosită și confirmarea umană.

## 5. Matrice situație–acțiune

| ID | Prioritate implicită | Acțiune imediată | Confirmare externă | Escaladare primară | Închidere permisă |
|---|---|---|---|---|---|
| AO-01 | P2 | oprire sigură și clarificare | obligatorie | autoritate/operator | solicitare clarificată |
| AO-02 | P0 | urgență | utilizatorul inițiază | serviciu urgență | numai după transfer |
| AO-03 | P1 | oprire și simptom | obligatorie | operator/asistență | siguranță confirmată |
| AO-04 | P1 | oprire sigură | obligatorie | operator | plan revizuit |
| AO-05 | P1/P0 | nu manipula; izolare | obligatorie | operator/urgență | instrucțiune competentă |
| AO-06 | P2 | nu intra pe rută | obligatorie | operator | rută confirmată |
| AO-07 | P1 | reducere expunere/oprire | obligatorie | operator | condiții reevaluate |
| AO-08 | P3, poate escalada | mesaj scurt | obligatorie | interpret/operator | sens confirmat |

Prioritatea implicită este ridicată dacă apar indicii noi. AO-08 devine P0/P1
dacă bariera de limbă împiedică gestionarea unei urgențe.

## 6. Registru de riscuri operaționale

| ID | Risc | Scenarii | Control | Dovadă cerută |
|---|---|---|---|---|
| RO-01 | interacțiune în mers | toate | `UNSAFE_TO_INTERACT` | test stare |
| RO-02 | urgență tratată ca formular normal | AO-02, AO-05 | salt P0 | test tranziție |
| RO-03 | recomandare bazată pe date inventate | toate | `NEEDS_FACTS` | test date lipsă |
| RO-04 | acțiune externă fără acord | toate | confirmare explicită | jurnal/test |
| RO-05 | trimitere duplicată | toate | idempotentă/reconfirmare | test retry |
| RO-06 | diagnostic mecanic fals | AO-03 | simptome, nu diagnostic | review text |
| RO-07 | presiune de continuare | AO-04, AO-07 | drept de oprire | scenariu negativ |
| RO-08 | manipulare nesigură marfă | AO-05 | interdicție explicită | review flux |
| RO-09 | rută neverificată | AO-06 | aprobare operator | test alternativă |
| RO-10 | traducere alterează date critice | AO-01, AO-08 | protecție entități | test nume/numere |
| RO-11 | lipsa conectivității ascunsă | toate | stare offline | test offline |
| RO-12 | închidere prematură | AO-02–AO-07 | criteriu pe scenariu | test tranziție |

## 7. Cerințe pentru livrabilul următor

ETAPA 3 trebuie să:

- atașeze surse numai afirmațiilor care necesită fundament extern;
- separe regula operațională conservatoare de obligația juridică;
- elimine cuantumurile monetare nevalidate;
- indice versiunea și data sursei;
- păstreze recomandările post-POC distincte de criteriile de închidere;
- nu extindă automat scope-ul către „După Sosire”.

## 8. Criterii de acceptanță ETAPA 2

- 8/8 scenarii din ETAPA 1 analizate;
- fiecare scenariu include minimum 5 obligații practice;
- fiecare scenariu include drepturi operaționale;
- fiecare scenariu are prag de oprire, escaladare și dovadă minimă;
- există model de stare și reguli de tranziție;
- există matrice situație–acțiune;
- există minimum 10 riscuri cu control și dovadă;
- acțiunile externe necesită confirmare;
- nu există valori monetare ori aviz juridic implicit;
- codul și POC 01 nu sunt modificate.

## 9. Condiția de trecere

ETAPA 3 poate începe numai după validarea explicită a analizei operaționale și
înregistrarea deciziei. Prezentul document nu autorizează implementarea de cod.

**Checkpoint:** analiza operațională a primit PASS DOCUMENTAR și ETAPA 2 este
închisă oficial. ETAPA 3 și implementarea funcțională necesită autorizare
explicită separată.

---

🚛 **AGM respiră prin noi.**
