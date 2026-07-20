# ETAPA 4 – MATRICE STARE–ECRAN

**Data:** 2026-07-20
**Statut:** IMPLEMENTATĂ ÎN ADAPTOR – VALIDARE MANUALĂ PENDENTĂ

| Stare | Reprezentare obligatorie | Acțiune permisă |
|---|---|---|
| `NEW` | formular fără rezultat calculat | selectare scenariu și fapte |
| `UNSAFE_TO_INTERACT` | avertizare prioritară, flux detaliat oprit | oprire sigură și reluare |
| `EMERGENCY` | rezultat P0 evidențiat | inițiere umană a urgenței |
| `NEEDS_FACTS` | lista exactă a datelor lipsă | completarea faptelor |
| `ASSESSED` | prioritate, maximum 3 acțiuni și limite | revizuire sau pregătire escaladare |
| `AWAITING_CONFIRMATION` | mesaj că rezultatul este numai schiță | confirmare locală/anulare |
| `ESCALATED` | responsabilitate transferată | așteptare sau închidere |
| `SAFE_TO_CONTINUE` | stare distinctă, fără emitere automată | închidere |
| `CLOSED` | rezultat numai pentru vizualizare | flux nou |

## Reguli de prezentare

- starea și prioritatea sunt afișate separat;
- P0 utilizează accent vizual critic;
- offline-ul este vizibil și nu blochează evaluatorul local;
- datele lipsă sunt separate de faptele declarate;
- acțiunile interzise și limitele sunt vizibile;
- nicio stare nu produce efect extern;
- revenirea aplicației în prim-plan elimină evaluarea dacă interacțiunea nu
  fusese declarată sigură.

## Implementare

Matricea este implementată prin:

- `after-departure.presenter.ts` – catalogul complet al celor 9 stări;
- `after-departure.view.ts` – reprezentarea rezultatului;
- `after-departure.controller.ts` – ciclul fluxului și revenirea conservatoare;
- `after-departure.styles.css` – diferențierea vizuală a priorităților.
