# ETAPA 6 – ARHITECTURĂ ȘI PLAN INCREMENTAL

**Stare:** propunere pentru audit
**Implementare:** neautorizată

## 1. Principii arhitecturale

- navigația AGM rămâne separată de catalogul Premium;
- fluxurile „Înainte de Plecare” și „După Plecare” sunt module distincte;
- starea fluxului este locală, explicită și serializabilă;
- logica operațională este separată de randarea UI și de dicționarele i18n;
- nicio acțiune nu simulează transmiterea externă;
- extensiile nu schimbă contractele validate ale POC02.

## 2. Componente propuse

| Componentă | Responsabilitate | Limită |
|---|---|---|
| registru navigație AGM | expune intrarea către modul | nu modifică Premium |
| nucleu pre-departure | stare, reguli și tranziții | fără DOM/Capacitor |
| prezentare pre-departure | ecrane și acțiuni accesibile | fără reguli duplicate |
| dicționar i18n | texte RO/DE/EN cu chei comune | fără conținut juridic nou |
| adaptor persistență locală | salvare și reluare controlată | fără cloud/backend |
| suită de validare | teste nucleu, Browser, Android, regresie | fără mutarea criteriilor |

## 3. Flux de date propus

`Navigație AGM → inițializare sesiune → evaluare locală → stare/rezultat → persistare locală → reluare sau închidere`

Stările exacte și tranzițiile lor vor fi definite exclusiv în artefactul
canonic `E6_1_MATRICE_CANONICA_STARI_SI_TRANZITII.md`, creat și aprobat în
E6.1 înainte de implementarea nucleului. UI-ul nu va putea genera o tranziție
pe care nucleul nu o permite.

## 4. Incrementări propuse

| Increment | Intrare obligatorie | Scop și ieșire verificabilă | Poartă de închidere |
|---|---|---|---|
| E6.1 | audit documentar ETAPA 6 PASS și autorizare Product Owner | inventar cerințe și `E6_1_MATRICE_CANONICA_STARI_SI_TRANZITII.md` | matrice completă, audit documentar PASS, decizie de închidere și checkpoint documentar autorizat |
| E6.2 | E6.1 închis și matrice canonică aprobată | nucleu izolat și teste unitare ale tuturor tranzițiilor | teste nucleu PASS, TypeScript PASS, regresie relevantă PASS, audit și checkpoint autorizat |
| E6.3 | E6.2 închis | navigație AGM și shell Browser, fără modificarea Premium | acces Browser demonstrat, regresie Premium/POC02 PASS, audit și checkpoint autorizat |
| E6.4 | E6.3 închis | flux UI accesibil și localizare RO/DE/EN | fluxurile și matricea i18n PASS, audit și checkpoint autorizat |
| E6.5 | E6.4 închis | persistență locală, offline și resume | refresh/retry/offline/resume Browser PASS, audit și checkpoint autorizat |
| E6.6 | E6.5 închis | integrare Android cu comportament echivalent | build/sync, scenarii Android și paritate Browser PASS, audit și checkpoint autorizat |
| E6.7 | E6.6 închis | regresie completă și audit consolidat | Browser/Android/POC02/Premium PASS, POC01 cu zero diferențe, staging verificat și decizie finală |

Un singur increment poate fi activ. Fiecare necesită autorizare, testare,
validare și checkpoint propriu înainte de deschiderea următorului.

## 5. Strategie de validare

- **static:** TypeScript și verificări de formatare/diff;
- **nucleu:** cazuri pozitive, negative și tranziții terminale;
- **Browser:** tastatură, pointer, back, refresh, retry, consolă și offline/online;
- **Android:** instalare, navigare, background/resume și offline/online;
- **localizare:** aceleași acțiuni și rezultate în RO/DE/EN;
- **regresie:** POC02 „După Plecare”, Premium și diferențe POC01;
- **dovezi:** comandă sau pași, dată, mediu, rezultat observat și artefact.

## 6. Protecția baseline-ului

Înaintea fiecărui checkpoint se verifică lista exactă de fișiere staged,
diferența față de baseline-ul POC02 și absența modificărilor în POC01. Orice
fișier paralel sau din afara incrementului este exclus.
