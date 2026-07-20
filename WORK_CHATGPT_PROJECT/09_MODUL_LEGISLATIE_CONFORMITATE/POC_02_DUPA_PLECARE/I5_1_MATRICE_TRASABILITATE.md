# I5.1 – MATRICE DE TRASABILITATE

**Data:** 2026-07-20
**Statut:** COMPLETATĂ – ÎN AȘTEPTAREA VALIDĂRII

## 1. Obiective POC 02

| Obiectiv | Sursă documentară | Livrabil/cod | Dovadă disponibilă |
|---|---|---|---|
| O-01 situații reale după plecare | ETAPA 1 | 8 scenarii în tipuri și politici | decizie E1; teste evaluator |
| O-02 acțiuni imediate vs. escaladare | ETAPA 2 | politici, evaluator și presenter | matrice situație–acțiune; teste |
| O-03 informații minime | ETAPA 2 | `requiredFacts`, `NEEDS_FACTS` | teste date lipsă |
| O-04 flux situație–evaluare–acțiune | ETAPELE 2–4 | model de stare, controller și view | teste tranziții și flux practic |
| O-05 limite de responsabilitate | ETAPELE 1–2 | escaladări, interdicții și limitări | registre și UI |
| O-06 experiență Browser/Android | ETAPA 4 | HTML, Vite, UI responsive | build, sync și validări practice |
| O-07 controale de siguranță | ETAPELE 2–4 | P0, unsafe, confirmare locală | teste negative și registru E4 |
| O-08 compatibilitate POC 01 | toate etapele | implementare izolată | comparații Git și regresie |

## 2. Livrabile I5.1

| Livrabil | Criteriu | Dovadă | Rezultat |
|---|---|---|---|
| L5-01 – inventar oficial | AC5-01 | 18 documente + 10 surse + 2 teste + 2 entry/config | complet |
| L5-01 – checkpoint-uri | AC5-02 | 4 checkpoint-uri POC 02 și baseline POC 01 | complet |
| L5-02 – trasabilitate | AC5-03 | O-01–O-08 mapate la document, cod și dovadă | complet |
| L5-02 – stare criterii | AC5-04 | fiecare control I5.1 are rezultat explicit | complet |

## 3. Referințe și dependențe

| Referință | Utilizare | Verificare |
|---|---|---|
| `769a6a2...` | baseline POC 01 | commit existent |
| `e882681...` | checkpoint ETAPA 1 | commit existent, părinte corect |
| `b14bc10...` | checkpoint ETAPA 2 | commit existent, părinte corect |
| `1bbbc0f...` | checkpoint ETAPA 3 | commit existent, părinte corect |
| `290aad1...` | checkpoint ETAPA 4 | commit existent, părinte corect |
| Node/pnpm | I5.2 | declarată, neexecutată în I5.1 |
| Browser | I5.3 | declarat, neexecutat în I5.1 |
| Android SDK/Java/Gradle | I5.4 | declarate, neexecutate în I5.1 |
| Product Owner | toate porțile | decizie separată obligatorie |

## 4. Controale de proces

| Control | Rezultat |
|---|---|
| un singur increment activ | PASS – numai I5.1 |
| modificări funcționale | 0 |
| modificări POC 01 | 0 |
| I5.2–I5.7 executate | 0 |
| checkpoint I5.1 creat prematur | nu |
| modificări paralele incluse | nu |

## 5. Neconcordanțe identificate și armonizate

| ID | Constatare | Corecție documentară |
|---|---|---|
| T5-01 | documentul de inițiere afișa numai statutul inițial E1 | statutul inițial și cel curent sunt separate |
| T5-02 | raportul E3 nu conținea hash-ul checkpoint-ului | hash-ul `1bbbc0f...` este înregistrat |
| T5-03 | planul/raportul E4 descriau checkpoint-ul ca viitor | hash-ul `290aad1...` este înregistrat |

După armonizare, nu rămân neconcordanțe documentare cunoscute în aria verificată.
