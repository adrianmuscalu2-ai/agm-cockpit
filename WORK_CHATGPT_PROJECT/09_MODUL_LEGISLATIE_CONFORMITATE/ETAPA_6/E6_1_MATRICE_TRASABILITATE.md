# E6.1 – MATRICE DE TRASABILITATE

**Statut:** pentru validare documentară

| Grup cerințe | Stări/tranziții | Dovadă documentară | Dovadă viitoare E6.2–E6.7 |
|---|---|---|---|
| E6-REQ-01–02 | E6-S00, E6-S10; E6-T01–T02 | inventar și matrice canonică | teste inițiere/context și navigație Browser |
| E6-REQ-03–08 | E6-S20; E6-T03–T07 și E6-T09 | categoriile POC01 §4 inventariate | teste de completare pentru fiecare categorie |
| E6-REQ-09–10 | E6-S10, E6-S20; E6-T02 | reguli condiționate de context | teste ADR și condiții dificile activate/dezactivate |
| E6-REQ-11–12 | E6-S20, E6-S30; E6-T03–T05 | răspunsuri și justificare definite | teste Confirmat/Problemă/Neaplicabil |
| E6-REQ-13–16 | E6-S30–E6-S60; E6-T06–T07, E6-T09–T15 și E6-T19 | blocare, remediere și confirmare explicite | teste pozitive, negative și terminale |
| E6-REQ-17–18 | E6-S00–E6-S50; E6-T17–T18 | reset/restore definite | teste refresh, offline și background/resume |
| E6-REQ-19 | toate stările | obligație RO/DE/EN | matrice chei și scenarii în trei limbi |
| E6-REQ-20 | E6-S50–E6-S70 | limite declarate | verificare mesaje și lipsa transmiterii externe |
| E6-REQ-21–24 | nicio stare/tranziție | excluderi explicite | diff de scope și audit negativ |

## Acoperirea stărilor

| Stare | Intrare definită | Ieșire definită | Cerință asociată |
|---|---|---|---|
| E6-S00 | da | da | E6-REQ-01, E6-REQ-18 |
| E6-S10 | da | da | E6-REQ-02 |
| E6-S20 | da | da | E6-REQ-03–12 |
| E6-S30 | da | da | E6-REQ-11, E6-REQ-13–15 |
| E6-S40 | da | da | E6-REQ-13–15 |
| E6-S50 | da | da | E6-REQ-16 |
| E6-S60 | da | da | E6-REQ-16, E6-REQ-20 |
| E6-S70 | da | da | E6-REQ-15 |

## Acoperirea criteriilor E6.1

| Criteriu | Dovadă |
|---|---|
| cerințele au ID, sursă și clasificare | `E6_1_INVENTAR_CERINTE.md` |
| stările au definiții, intrări și ieșiri | matrice canonică §1 |
| tranzițiile au sursă, eveniment/condiție și destinație | matrice canonică §3 |
| tranzițiile interzise și terminale sunt explicite | matrice canonică §4 și E6-S60/E6-S70 |
| nu există surse canonice paralele | inventar surse ETAPA 6 și matrice canonică |
| limitele juridice sunt păstrate | REQ-20–24 și matrice canonică §5 |

Nu sunt declarate dovezi de implementare sau test practic în E6.1.
