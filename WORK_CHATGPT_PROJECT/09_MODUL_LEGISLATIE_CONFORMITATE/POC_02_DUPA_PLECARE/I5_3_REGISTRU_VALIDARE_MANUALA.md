# I5.3 – REGISTRU DE VALIDARE MANUALĂ ASISTATĂ

**Data deschiderii:** 2026-07-20
**Baseline de intrare:** `493554d58001bc445a0854d74418d243562b3371`
**Mediu:** Browser și aplicație funcționale; mediul de automatizare indisponibil
**Statut:** RETRAS DIN EXECUȚIE – NEAPLICABIL / NEIMPLEMENTAT

## Reguli

- fiecare scenariu este documentat și verificat separat;
- o declarație fără pași și rezultat observat nu este dovadă completă;
- regula inițială NEVALIDAT este înlocuită de decizia Product Owner:
  scenariile fără obiect livrat sunt NEAPLICABIL / NEIMPLEMENTAT;
- un defect reproductibil produce FAIL și oprește incrementul;
- nu se modifică aplicația în timpul validării;
- checkpoint-ul rămâne blocat până la PASS Product Owner.

## Date comune obligatorii

Se completează o singură dată dacă sunt identice pentru întreaga sesiune:

| Câmp | Valoare |
|---|---|
| data și ora sesiunii | DE COMPLETAT |
| sistem de operare | DE COMPLETAT |
| Browser și versiune | DE COMPLETAT |
| URL de pornire observat | `http://localhost:5173/premium` |
| URL țintă POC 02 | `http://localhost:5173/after-departure.html` |
| commit/baseline | `493554d58001bc445a0854d74418d243562b3371` |
| numele buildului, dacă diferă de localhost | nu se aplică / DE COMPLETAT |

## Registru consolidat

| ID | Scenariu | Criterii | Verdict |
|---|---|---|---|
| B5.3-01 | acces direct la `/after-departure.html` | AC5-08 | NEAPLICABIL / NEIMPLEMENTAT |
| B5.3-02 | flux nominal până la `ASSESSED` | AC5-08, AC5-11 | NEAPLICABIL / NEIMPLEMENTAT |
| B5.3-03 | `UNSAFE_TO_INTERACT` | AC5-11 | NEAPLICABIL / NEIMPLEMENTAT |
| B5.3-04 | `EMERGENCY` | AC5-11 | NEAPLICABIL / NEIMPLEMENTAT |
| B5.3-05 | `NEEDS_FACTS` | AC5-11 | NEAPLICABIL / NEIMPLEMENTAT |
| B5.3-06 | confirmare fără efect extern | AC5-13 | NEAPLICABIL / NEIMPLEMENTAT |
| B5.3-07 | `ESCALATED` → `SAFE_TO_CONTINUE` → `CLOSED` | AC5-11 | NEAPLICABIL / NEIMPLEMENTAT |
| B5.3-08 | utilizare exclusiv cu tastatura | AC5-08 | NEAPLICABIL / NEIMPLEMENTAT |
| B5.3-09 | pointer, back, refresh și retry | AC5-08, AC5-13 | NEAPLICABIL / NEIMPLEMENTAT |
| B5.3-10 | consola Browser | AC5-08 | NEAPLICABIL / NEIMPLEMENTAT |
| B5.3-11 | offline → evaluare locală → online | AC5-10 | NEAPLICABIL / NEIMPLEMENTAT |
| B5.3-12 | RO, DE și EN | AC5-12 | NEAPLICABIL / NEIMPLEMENTAT |

## Fișe individuale retrase

Fișele de mai jos nu se mai completează pentru versiunea curentă. Ele sunt
păstrate numai ca istoric al planului inițial.

1. starea inițială;
2. pașii executați și datele introduse;
3. rezultatul observat;
4. numele sau identificatorul capturii/jurnalului;
5. PASS sau FAIL propus de tester.

### B5.3-01 – Acces la entry point-ul POC 02

- Stare inițială: `/premium` disponibil; modulul „După Plecare” nu este
  prezent în registrul Premium
- Clarificare: POC 02 este entry point separat, nu rută Premium
- URL de executat: `http://localhost:5173/after-departure.html`
- Pași: deschiderea directă a URL-ului țintă și verificarea titlului/suprafeței
- Rezultat observat: DE COMPLETAT DUPĂ EXECUȚIA PE URL-UL CORECT
- Dovadă: captură cu URL-ul și pagina „După Plecare” – DE COMPLETAT
- Verdict: NEAPLICABIL / NEIMPLEMENTAT

Constatarea privind absența modulului din `/premium` este o clarificare de
trasabilitate și nu primește verdict PASS sau FAIL pentru B5.3-01.

### B5.3-02 – Flux nominal `ASSESSED`

- Stare inițială: DE COMPLETAT
- Pași și date: DE COMPLETAT
- Rezultat observat: DE COMPLETAT
- Dovadă: DE COMPLETAT
- Verdict: NEAPLICABIL / NEIMPLEMENTAT

### B5.3-03 – `UNSAFE_TO_INTERACT`

- Stare inițială: DE COMPLETAT
- Pași și date: DE COMPLETAT
- Rezultat observat: DE COMPLETAT
- Dovadă: DE COMPLETAT
- Verdict: NEAPLICABIL / NEIMPLEMENTAT

### B5.3-04 – `EMERGENCY`

- Stare inițială: DE COMPLETAT
- Pași și date: DE COMPLETAT
- Rezultat observat: DE COMPLETAT
- Dovadă: DE COMPLETAT
- Verdict: NEAPLICABIL / NEIMPLEMENTAT

### B5.3-05 – `NEEDS_FACTS`

- Stare inițială: DE COMPLETAT
- Pași și date: DE COMPLETAT
- Rezultat observat: DE COMPLETAT
- Dovadă: DE COMPLETAT
- Verdict: NEAPLICABIL / NEIMPLEMENTAT

### B5.3-06 – Fără efect extern

- Stare inițială: DE COMPLETAT
- Pași și date: DE COMPLETAT
- Rezultat observat: DE COMPLETAT
- Dovadă privind lipsa transmiterii: DE COMPLETAT
- Verdict: NEAPLICABIL / NEIMPLEMENTAT

### B5.3-07 – Tranziții terminale

- Stare inițială: DE COMPLETAT
- Pași și tranziții: DE COMPLETAT
- Rezultat observat: DE COMPLETAT
- Dovadă: DE COMPLETAT
- Verdict: NEAPLICABIL / NEIMPLEMENTAT

### B5.3-08 – Tastatură

- Stare inițială: DE COMPLETAT
- Traseu Tab/Shift+Tab/Enter: DE COMPLETAT
- Focus și rezultat observat: DE COMPLETAT
- Dovadă: DE COMPLETAT
- Verdict: NEAPLICABIL / NEIMPLEMENTAT

### B5.3-09 – Pointer, back, refresh și retry

- Stare inițială: DE COMPLETAT
- Pași: DE COMPLETAT
- Rezultat și lipsa efectelor duplicate: DE COMPLETAT
- Dovadă: DE COMPLETAT
- Verdict: NEAPLICABIL / NEIMPLEMENTAT

### B5.3-10 – Consolă

- Interval observat: de la încărcare până la finalul fluxului
- Pași: DE COMPLETAT
- Erori sau avertismente observate: DE COMPLETAT
- Jurnal/captură: DE COMPLETAT
- Verdict: NEAPLICABIL / NEIMPLEMENTAT

### B5.3-11 – Offline/online

- Stare inițială online: DE COMPLETAT
- Metoda trecerii offline: DE COMPLETAT
- Mesajul și evaluarea locală observate: DE COMPLETAT
- Rezultatul revenirii online: DE COMPLETAT
- Dovadă: DE COMPLETAT
- Verdict: NEAPLICABIL / NEIMPLEMENTAT

### B5.3-12 – RO/DE/EN

- Flux și câmpuri verificate în RO: DE COMPLETAT
- Flux și câmpuri verificate în DE: DE COMPLETAT
- Flux și câmpuri verificate în EN: DE COMPLETAT
- Diferențe sau texte reziduale: DE COMPLETAT
- Dovezi: DE COMPLETAT
- Verdict: NEAPLICABIL / NEIMPLEMENTAT

## Poarta de audit revizuită

Raportul L5-04 nu poate primi PASS pe planul inițial. Este necesară decizia
Product Owner privind oprirea ca NEAPLICABIL sau planificarea separată a
implementării. Nicio fișă nu se transformă în PASS sau FAIL.
