# DECIZIE PRODUCT OWNER – AUTORIZARE E6.1

**Data:** 2026-07-20
**Decizie:** E6.1 DESCHIS DOCUMENTAR
**Baseline protejat:** POC02, commit `b1ab90f0c7718576905696c1fa725e79f72e7d13`

## Temeiul deciziei

- documentația ETAPEI 6 este aprobată;
- reauditul documentar este 12/12 PASS;
- neconformitățile E6-NC01–E6-NC03 sunt închise;
- neconformități noi demonstrate: 0;
- E6.1 este următoarea poartă prevăzută de planul incremental aprobat.

## Autorizare

Se autorizează exclusiv execuția documentară a incrementului E6.1 – Inventar
cerințe și model canonic de stare.

Activități autorizate:

1. inventarierea cerințelor POC01 eligibile pentru integrarea în aplicație;
2. clasificarea cerințelor ca incluse, excluse sau condiționate;
3. atribuirea identificatorilor unici cerințelor selectate;
4. crearea artefactului canonic
   `E6_1_MATRICE_CANONICA_STARI_SI_TRANZITII.md`;
5. definirea stărilor, evenimentelor, condițiilor și tranzițiilor permise;
6. trasarea fiecărei reguli către sursa POC01 și către dovada viitoare;
7. întocmirea raportului de validare documentară E6.1.

## Livrabile obligatorii

- `E6_1_INVENTAR_CERINTE.md`;
- `E6_1_MATRICE_CANONICA_STARI_SI_TRANZITII.md`;
- `E6_1_MATRICE_TRASABILITATE.md`;
- `E6_1_RAPORT_VALIDARE.md`.

## Criterii de închidere

- toate cerințele selectate au identificator, sursă și clasificare;
- fiecare stare are definiție, intrări și ieșiri explicite;
- fiecare tranziție are stare-sursă, eveniment, condiție și stare-destinație;
- tranzițiile interzise și terminale sunt explicite;
- nu există reguli contradictorii sau surse canonice paralele;
- afirmațiile juridice limitate ori neconfirmabile nu sunt transformate în
  reguli tehnice certe;
- auditul documentar E6.1 este PASS;
- neconformitățile reziduale sunt zero înaintea deciziei de închidere.

## Restricții

- modificările de cod și implementarea funcțională sunt neautorizate;
- POC01 și baseline-ul POC02 nu se modifică;
- E6.2–E6.7 rămân neautorizate;
- staging-ul și checkpoint-ul Git rămân neautorizate până la auditul E6.1 și o
  decizie separată Product Owner;
- prezenta decizie nu autorizează automat E6.2.

## Statut rezultat

**E6.1: AUTORIZAT ȘI DESCHIS EXCLUSIV DOCUMENTAR.**

Echipa poate începe livrabilele E6.1 în limitele de mai sus.
