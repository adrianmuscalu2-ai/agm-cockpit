# I5.3 – REAUDIT DE TRASABILITATE

**Data:** 2026-07-20
**Statut:** REMEDIERE DOCUMENTARĂ
**Decizie Product Owner:** scenariile fără obiect livrat se clasifică
NEAPLICABIL / NEIMPLEMENTAT

## 1. Constatare

Verificarea a separat două noțiuni care fuseseră tratate incorect drept
echivalente:

1. existența unui artefact tehnic izolat;
2. existența unei funcționalități livrate și accesibile în platforma oficială.

În repository există artefacte tehnice pentru POC 02:

- `apps/web/after-departure.html`;
- `apps/web/src/poc02-after-departure/`;
- intrarea Vite `afterDeparture`;
- teste automate dedicate.

Endpoint-ul tehnic `/after-departure.html` răspunde local, dar această
constatare nu demonstrează integrarea funcționalității în suprafața Browser
oficială `/premium` și nici livrarea ei în aplicația Android curentă.

Product Owner confirmă că „Înainte de Plecare” și „După Plecare” nu sunt
funcționalități implementate și accesibile în versiunile Browser și Android
supuse validării. Prin urmare, artefactul izolat nu constituie obiect valid
pentru validarea funcțională I5.3 a platformei curente.

## 2. Cauza neconcordanței

Planul I5.3 a derivat scenariile din documentele și testele POC 02 fără să
impună mai întâi o poartă de eligibilitate a obiectului testat:

- funcționalitatea apare în navigația/platforma oficială;
- versiunea rulată corespunde livrabilului declarat;
- Browser și Android expun funcționalitatea în aria aprobată.

Această poartă nu este îndeplinită. Existența sursei, a unui HTML separat sau
a unui test automat nu poate înlocui livrarea funcțională.

## 3. Reclasificarea scenariilor

| Grup | Rezultat |
|---|---|
| B5.3-01–B5.3-12 | NEAPLICABIL / NEIMPLEMENTAT |
| Scenarii PASS | 0 |
| Scenarii FAIL | 0 |
| Defecte funcționale demonstrate | 0 |
| Neconformități de trasabilitate | 1 |

Scenariile sunt retrase din execuția Browser curentă. Clasificarea nu
reprezintă PASS și nu reprezintă FAIL.

## 4. Impact asupra criteriilor

| Criteriu | Stare după reaudit | Justificare |
|---|---|---|
| AC5-08 | NEAPLICABIL / NEIMPLEMENTAT | obiectul Browser POC 02 nu este livrat în platforma oficială |
| AC5-10 | NEAPLICABIL / NEIMPLEMENTAT | offline/background nu pot fi validate pentru o funcționalitate nelivrată |
| AC5-11 | NEAPLICABIL / NEIMPLEMENTAT practic | acoperirea automată nu demonstrează accesibilitatea platformei |
| AC5-12 | NEAPLICABIL / NEIMPLEMENTAT practic | textele artefactului izolat nu sunt funcționalitate livrată |
| AC5-13 | NEAPLICABIL / NEIMPLEMENTAT practic | lipsa efectelor externe nu poate fi validată în fluxul oficial inexistent |

I5.3 nu poate primi PASS pe criteriile inițiale.

## 5. Aria Browser efectiv livrată

Versiunea observată expune `/premium` și modulele Premium curente. Aceste
funcționalități nu aparțin POC 02 „După Plecare” și nu pot fi introduse în
I5.3 prin extinderea retroactivă a scope-ului.

În consecință, după eliminarea scenariilor fără obiect, nu rămâne niciun
scenariu Browser executabil în aria I5.3 aprobată.

## 6. Decizie de proces

- planul anterior B5.3-01–B5.3-12 este retras din execuție;
- registrul păstrează scenariile numai pentru trasabilitate, marcate
  NEAPLICABIL / NEIMPLEMENTAT;
- validarea modulelor Premium necesită un plan și o autorizare distincte, în
  proiectul căruia îi aparțin;
- implementarea sau integrarea POC 02 necesită decizie separată și nu poate fi
  realizată în incrementul de audit I5.3;
- checkpoint-ul I5.3 rămâne neautorizat;
- I5.4–I5.7 rămân neautorizate.

## 7. Recomandare pentru decizia Product Owner

I5.3 rămâne deschis în remediere documentară. Pentru continuare este necesară
o decizie separată între:

1. oprirea I5.3 ca NEAPLICABIL pentru versiunea curentă; sau
2. planificarea, în afara I5.3, a implementării și integrării funcționalității,
   urmată de un nou increment de validare.
