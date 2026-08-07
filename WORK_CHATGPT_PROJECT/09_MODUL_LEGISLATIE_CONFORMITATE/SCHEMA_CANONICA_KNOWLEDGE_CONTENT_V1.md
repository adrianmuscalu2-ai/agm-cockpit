# Schema canonică AGM Knowledge Content v1

**Status:** `OFFICIAL / ACTIVE`  
**Baseline operațional aprobat:** 2026-08-02  
**Pachet de referință:** `KNOWLEDGE DRIVING & REST TIMES v0.1.3`  
**Owner:** Documentation Owner  
**Validator juridic:** Agent Legal  
**Validator independent:** QA / Chief Inspector  
**Lifecycle:** draft → domain-reviewed → legal-reviewed → qa-reviewed → published

## Câmpuri obligatorii pentru pachet

| Câmp | Regula |
|---|---|
| `id` | ID stabil, nereutilizabil |
| `domain` | domeniul canonic AGM Knowledge |
| `title` | titlu editorial |
| `jurisdiction` | jurisdicția explicită |
| `verifiedAt` | data ultimei verificări a surselor |
| `reviewDueAt` | termenul următoarei revizuiri |
| `version` | versiune semantică editorială |
| `status` | starea lifecycle-ului |
| `sources` | numai surse oficiale, cu ID și URL |
| `items` | elementele de conținut trasabile |
| `history` | versiune, dată, schimbare și autor |
| `validation` | dovezi separate Domain, Legal și QA |

## Câmpuri obligatorii pentru fiecare element

```text
id
topic
legalRule
practicalExplanation
examples[]
commonMistakes[]
sourceReferences[]: sourceId + articol/pasaj exact
jurisdiction
verifiedAt
reviewDueAt
```

`legalRule` nu conține recomandări orientative. `practicalExplanation`, exemplele
și greșelile sunt etichetate ca explicații și nu emit verdict individual.

## Regula de publicare

Publicarea este permisă numai dacă:

- toate sursele sunt oficiale și rezolvabile;
- `domainReviewed`, `legalReviewed` și `qaReviewed` sunt `true`;
- există identitatea și data fiecărui validator;
- sursele sunt marcate rezolvabile la ultima verificare, au termen de revizuire
  neexpirat și fiecare referință de element indică un ID existent;
- `reviewDueAt` nu este expirat;
- nu există contradicții sau HOLD activ.

Orice modificare normativă, contradicție confirmată ori expirare a termenului
retrage automat pachetul din starea publicabilă până la reverificare.

## Model operațional obligatoriu

Fluxul validat prin pachetul `KNOWLEDGE DRIVING & REST TIMES v0.1.3` devine
modelul oficial pentru toate pachetele AGM Knowledge viitoare:

```text
Infrastructure Reuse Report
→ registru de surse oficiale
→ redactare cu separarea regulii de explicația orientativă
→ Domain Review
→ Legal Review, unde conținutul are caracter juridic
→ QA editorial independent
→ Publication Gate
→ publicare controlată
→ revizuire periodică și istoric de versiuni
```

Un verdict `PASS WITH CORRECTIONS`, `HOLD` sau `REJECT` readuce pachetul în
redactare. Niciun verdict anterior nu se transferă automat unei versiuni
corectate. Trecerea la `published` necesită toate verdictele obligatorii `PASS`
pentru exact aceeași versiune.
