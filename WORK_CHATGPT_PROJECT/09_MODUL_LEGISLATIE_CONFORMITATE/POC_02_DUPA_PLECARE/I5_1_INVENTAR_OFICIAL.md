# I5.1 – INVENTAR OFICIAL POC 02

**Data:** 2026-07-20
**Statut:** PASS – VALIDAT DE PRODUCT OWNER
**Commit inventariat:** `290aad19ae8a55595d6a7ad4d3a2eec1f8a1044c`

## 1. Rezumat

Baseline-ul ETAPEI 4 conține 32 de componente POC 02:

| Categorie | Număr |
|---|---:|
| documente POC 02 | 18 |
| fișiere sursă în `poc02-after-departure` | 10 |
| teste dedicate | 2 |
| entry point și configurație build | 2 |
| **Total** | **32** |

În worktree există suplimentar documentele de guvernanță ETAPA 5 și I5.1.
Acestea nu fac parte din baseline-ul ETAPEI 4 și vor aparține checkpoint-urilor
incrementale ETAPA 5 numai după validare.

## 2. Checkpoint-uri

| Etapă | Commit | Părinte | Mesaj | Verificat |
|---|---|---|---|---|
| POC 01 | `769a6a2c4bca200341d3eee9b685ec3ec3c8bb5b` | baseline extern POC 02 | baseline protejat | da |
| ETAPA 1 | `e88268185c2e0ba4b8902e10652c7b75529bb01f` | POC 01 | `docs(poc02): close stage 1 definition` | da |
| ETAPA 2 | `b14bc105f05a651a3668471f72e2da2d1cd0eb35` | ETAPA 1 | `docs(poc02): close stage 2 analysis` | da |
| ETAPA 3 | `1bbbc0f8a5ad17e9fbad1b3bec5cc73692a10309` | ETAPA 2 | `feat(poc02): close stage 3 operational core` | da |
| ETAPA 4 | `290aad19ae8a55595d6a7ad4d3a2eec1f8a1044c` | ETAPA 3 | `feat(poc02): close stage 4 multiplatform flow` | da |

Lanțul de părinți este continuu de la POC 01 la ETAPA 4.

## 3. Documente în baseline-ul ETAPEI 4

1. `DOCUMENT_INITIERE_POC02.md`
2. `INDEX_POC02.md`
3. `ETAPA_1_SITUATII_REALE.md`
4. `RAPORTARE_PROGRES_ETAPA1.md`
5. `DECIZIE_VALIDARE_ETAPA1.md`
6. `ETAPA_2_ANALIZA_OPERATIONALA.md`
7. `RAPORTARE_PROGRES_ETAPA2.md`
8. `RAPORT_VALIDARE_ETAPA2.md`
9. `DECIZIE_VALIDARE_ETAPA2.md`
10. `ETAPA_3_IMPLEMENTARE_FUNCTIONALA.md`
11. `RAPORTARE_PROGRES_ETAPA3.md`
12. `DECIZIE_VALIDARE_ETAPA3.md`
13. `ETAPA_4_PLAN_INTEGRARE_MULTIPLATFORM.md`
14. `ETAPA_4_MATRICE_STARE_ECRAN.md`
15. `ETAPA_4_REGISTRU_REMEDIERE_SI_DOVEZI.md`
16. `RAPORTARE_PROGRES_ETAPA4.md`
17. `DECIZIE_VALIDARE_DOCUMENTATIE_ETAPA4.md`
18. `DECIZIE_VALIDARE_ETAPA4.md`

## 4. Cod sursă

1. `after-departure.types.ts`
2. `after-departure.evaluator.ts`
3. `after-departure.module.ts`
4. `after-departure.i18n.ts`
5. `after-departure.operational-i18n.ts`
6. `after-departure.presenter.ts`
7. `after-departure.view.ts`
8. `after-departure.controller.ts`
9. `after-departure.entry.ts`
10. `after-departure.styles.css`

Toate sunt sub `apps/web/src/poc02-after-departure/`.

## 5. Teste, entry point și configurație

| Fișier | Rol |
|---|---|
| `apps/web/scripts/test-poc02-after-departure.ts` | evaluator, scenarii și tranziții |
| `apps/web/scripts/test-poc02-stage4.ts` | prezentare, localizare și entry point |
| `apps/web/after-departure.html` | entry point Browser/Android |
| `apps/web/vite.config.ts` | build multipagină și navigare izolată |

## 6. Documente curente ETAPA 5

| Document | Rol | Stare |
|---|---|---|
| `ETAPA_5_PLAN_VALIDARE_FINALA.md` | plan general | PASS documentar |
| `ETAPA_5_PLAN_INCREMENTAL.md` | ordinea I5.1–I5.7 | aprobat documentar |
| `RAPORTARE_PROGRES_ETAPA5.md` | progres și limite | activ |
| `DECIZIE_VALIDARE_DOCUMENTATIE_ETAPA5.md` | decizia auditului documentar | aprobat |
| `I5_1_INVENTAR_OFICIAL.md` | inventar L5-01 | PASS |
| `I5_1_MATRICE_TRASABILITATE.md` | matrice L5-02 | PASS |
| `RAPORT_VALIDARE_I5_1.md` | rezultat I5.1 | PASS |
| `DECIZIE_VALIDARE_I5_1.md` | decizie Product Owner | aprobat |

## 7. Delimitarea ariei

Nu aparțin inventarului POC 02:

- modificările Premium și API aflate în lucru paralel;
- documentele cloud/deploy din rădăcina workspace-ului;
- artefactele generate `dist`, buildurile Android și cache-urile;
- orice fișier POC 01.

Aceste elemente trebuie excluse din checkpoint-ul I5.1.
