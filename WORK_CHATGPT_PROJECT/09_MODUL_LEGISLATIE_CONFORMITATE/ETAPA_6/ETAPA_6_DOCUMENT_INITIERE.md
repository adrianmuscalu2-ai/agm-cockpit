# ETAPA 6 – DOCUMENT DE INIȚIERE

**Data:** 2026-07-20
**Stare:** proiectare documentară – pentru audit și aprobare
**Baseline de referință:** POC02, commit `b1ab90f0c7718576905696c1fa725e79f72e7d13`
**Implementare:** neautorizată

## 1. Obiectiv general propus

Proiectarea integrării controlate în aplicația AGM a fluxului „Înainte de
Plecare”, utilizând modelul documentar validat în POC01 și păstrând integral
comportamentul validat prin POC02.

Obiectivul devine executabil numai după aprobarea explicită a acestui document
și autorizarea separată a fiecărui increment.

## 2. Obiective specifice

1. Stabilirea sursei canonice pentru cerințele „Înainte de Plecare”.
2. Definirea navigației generale AGM, separată de zona Premium.
3. Definirea modelului de stare și a tranzițiilor permise.
4. Definirea prezentării RO/DE/EN și a regulilor de accesibilitate.
5. Definirea comportamentului offline, refresh și reluare a aplicației.
6. Protejarea explicită a fluxului „După Plecare” și a POC01/POC02.
7. Stabilirea testelor Browser, Android și de regresie.
8. Asigurarea trasabilității cerință–implementare–test–dovadă.

## 3. Domeniu propus

### Inclus

- acces UI la „Înainte de Plecare” din navigația generală AGM;
- flux local ghidat pe baza modelului POC01 aprobat;
- stări, tranziții, rezultate și mesaje explicite;
- localizare RO/DE/EN;
- comportament Browser și Android;
- funcționare locală și recuperare după offline/online;
- verificări de regresie pentru POC02 și Premium.

### Exclus

- schimbarea conținutului juridic al baseline-ului POC01;
- transmiterea automată către autorități, angajator sau terți;
- consultanță juridică ori înlocuirea deciziei șoferului;
- backend nou, conturi, sincronizare cloud sau plăți;
- modificarea modulelor Premium;
- extinderea fluxului „După Plecare”.

## 4. Livrabile documentare

| ID | Livrabil | Criteriu de completare |
|---|---|---|
| E6-L01 | document de inițiere | scope, obiective și limite explicite |
| E6-L02 | arhitectură propusă | componente, granițe și protecții definite |
| E6-L03 | matrice de trasabilitate | toate cerințele mapate la dovezi viitoare |
| E6-L04 | registru de riscuri | risc, control, proprietar și poartă |
| E6-L05 | plan incremental | incrementări independente și ordonate |
| E6-L06 | plan de validare | Browser, Android, regresie și dovezi |
| E6-L07 | raport de audit documentar | verdict complet, fără implementare |

## 5. Criterii de acceptanță documentară

| ID | Criteriu |
|---|---|
| E6-AC01 | baseline-ul POC02 este identificat prin hash complet |
| E6-AC02 | sursele POC01 utilizabile sunt inventariate fără a fi modificate |
| E6-AC03 | domeniul inclus și exclus nu admite interpretări funcționale majore |
| E6-AC04 | arhitectura păstrează navigația generală separată de Premium |
| E6-AC05 | stările și tranzițiile au o singură sursă canonică propusă |
| E6-AC06 | RO/DE/EN, accesibilitatea și offline/resume sunt planificate |
| E6-AC07 | fiecare increment are intrări, ieșiri și poartă de închidere |
| E6-AC08 | testele Browser, Android și regresie sunt separate |
| E6-AC09 | protecția POC01 și POC02 poate fi demonstrată prin Git |
| E6-AC10 | nu există marcaje TBD și nu sunt formulate rezultate de test fictive |
| E6-AC11 | documentația distinge cerințele de dovezile ce vor fi obținute ulterior |
| E6-AC12 | implementarea rămâne blocată până la decizia Product Owner |

## 6. Porți decizionale

1. audit documentar ETAPA 6;
2. aprobare Product Owner a obiectivului, scope-ului și arhitecturii;
3. autorizare separată pentru primul increment;
4. implementare, testare și audit individual pentru fiecare increment;
5. checkpoint Git numai după PASS-ul incrementului activ.

## 7. Stare curentă

Documentul nu autorizează cod, staging sau checkpoint Git. Orice afirmație
privind funcționarea viitoare va necesita dovadă produsă în faza autorizată de
validare.
