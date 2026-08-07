# AGM Cockpit — Visual Asset Provenance Policy v1

**Status:** `OFFICIAL / ACTIVE`  
**Data aprobării:** 2026-08-02

## Active acceptate

- active create intern;
- active Open Source sau Open Content cu licență compatibilă;
- active acoperite de o licență comercială validă.

## Informație oficială versus activ protejat

Legislația și informațiile oficiale publice se citează, se explică fidel și se
revizuiesc periodic. Menționarea sau explicarea lor nu este tratată automat ca
reutilizare a unui activ grafic și nu declanșează o cerere inutilă de autorizare.

Licența și dreptul de reutilizare se verifică atunci când AGM preia efectiv un
logo, o fotografie, diagramă, ilustrație, pictogramă ori alt material grafic.

## Metadate obligatorii

Un activ vizual poate primi `VERIFIED` numai dacă registrul consemnează:

1. identificatorul unic al activului;
2. sursa și linkul oficial;
3. autorul sau organizația;
4. tipul și identificatorul licenței;
5. data verificării licenței;
6. obligațiile de atribuire ori mențiunea explicită că nu există;
7. locația atribuirii în aplicație/documentație, când este obligatorie;
8. validatorul provenienței și validatorul QA vizual;
9. rezultatul verificării fidelității față de sursă.
10. pentru active interne: calea repository, hash-ul SHA-256, titularul drepturilor
    și înregistrarea declarației, cesiunii ori autorizației interne.

## Poarta de publicare

`reference-only`, proveniența incompletă, licența necunoscută/incompatibilă ori QA
vizual lipsă produc obligatoriu:

`VISUAL ASSET — HOLD` / `USER VISIBILITY — BLOCKED`.

Activele create intern trebuie să aibă creatorul sau echipa responsabilă, titularul
real al drepturilor, data creației, calea și hash-ul, plus declarația dreptului de
utilizare. Referințele editoriale nu devin sursa imaginii. Licența comercială trebuie să indice contractul sau dovada
internă, fără expunerea secretelor comerciale în interfața utilizatorului.
Pentru o creație proprie aprobată de titular nu se solicită autorizație externă.

## Atribuire

Când licența impune atribuire, textul exact și linkul trebuie incluse atât în
registrul activului, cât și în secțiunea Licențe a aplicației. Eliminarea atribuirii
reactivează HOLD-ul.
