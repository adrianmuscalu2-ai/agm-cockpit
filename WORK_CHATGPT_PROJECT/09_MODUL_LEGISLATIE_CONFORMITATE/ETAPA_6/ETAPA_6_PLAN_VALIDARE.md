# ETAPA 6 – PLAN DE VALIDARE

**Stare:** propunere documentară
**Execuția testelor:** neautorizată în această fază

## 1. Niveluri de verificare

| Nivel | Obiect | Condiție PASS viitoare |
|---|---|---|
| V6-DOC | documentație | criteriile E6-AC01–E6-AC12 au dovezi și nu se contrazic |
| V6-CORE | nucleu operațional | toate tranzițiile aprobate au teste pozitive și negative |
| V6-BRW | Browser | scenariile funcționale și de reziliență sunt demonstrate |
| V6-AND | Android | paritate cu Browser, inclusiv background/resume |
| V6-I18N | RO/DE/EN | chei complete și rezultate semantic echivalente |
| V6-REG | regresie | POC02 și Premium trec; POC01 are zero diferențe |
| V6-FIN | audit consolidat | zero neconformități critice și staging conform scope-ului |

## 2. Set minim de scenarii practice

1. acces din navigația generală AGM;
2. inițiere și parcurgere completă a fluxului;
3. fiecare stare operațională aprobată;
4. intrări invalide și tranziții interzise;
5. rezultat terminal și reluare controlată;
6. tastatură, pointer și ordine de focus;
7. back, refresh și retry;
8. consolă fără erori funcționale relevante;
9. offline → evaluare locală → online;
10. Android background/resume;
11. RO, DE și EN;
12. absența efectelor secundare asupra „După Plecare” și Premium.

## 3. Formatul obligatoriu al dovezii

Pentru fiecare scenariu se înregistrează: identificator, data și ora, mediul și
versiunea, precondițiile, pașii, rezultatul așteptat, rezultatul observat,
captura sau jurnalul și verdictul PASS/FAIL/NEAPLICABIL justificat.

Disponibilitatea mediului nu echivalează cu PASS funcțional. În mod similar,
indisponibilitatea automatizării nu demonstrează un defect al aplicației.

## 4. Regula verdictului

Nu se acordă PASS pe baza intenției, a existenței codului sau a unei afirmații
anterioare. FAIL necesită abatere reproductibilă. NEAPLICABIL necesită o
justificare de scope aprobată. Orice defect real este documentat înainte de
propunerea unei modificări.

## 5. Condiția checkpoint-ului

Checkpoint-ul unui increment poate fi autorizat numai după auditul dovezilor,
inventarierea explicită a staging-ului, `git diff --check`, regresia relevantă
și confirmarea diferenței zero pentru POC01.
