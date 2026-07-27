# Inventarul complet al suprafeței Premium existente

## A. Suprafață și infrastructură Premium

| ID | Componentă | Cod principal | Stare actuală |
|---|---|---|---|
| INF-01 | Premium Foundation / catalog | `premium-foundation.ts` | activ; șapte carduri |
| INF-02 | Premium Shell | `premium-shell.ts` | activ; prezentare comună |
| INF-03 | Premium Routes Registry | `premium-routes.ts` | activ; trei rute Premium |
| INF-04 | Premium Application Registry | `premium-app.ts` | activ; agregă șase module |
| INF-05 | Operational Team Foundation | `premium-team-foundation.ts`, `premium-agents.ts` | informativ; agenți `preparing` |
| INF-06 | Premium i18n | `i18n/premium-i18n.dictionary.ts` | activ; RO/DE/EN |

## B. Module vizibile în catalog

| ID | Card | Implementare asociată | Observație |
|---|---|---|---|
| CAT-01 | Prietenul meu AI | Copilot + AI Governance, dezactivate | card fără intrare operațională |
| CAT-02 | Asistent transport | nu există modul operațional dedicat | placeholder |
| CAT-03 | Înainte de plecare | `pre-departure/*` | funcțional, rută HTML separată |
| CAT-04 | După plecare | `poc02-after-departure/*` | evaluator funcțional, modul dezactivat |
| CAT-05 | Ladungssicherung | `premium-load-safety/*` | funcțional și activ |
| CAT-06 | Comunicare inteligentă | Linguistic Agents, dezactivat | card fără flux |
| CAT-07 | Jurnalul șoferului | nu există modul Premium dedicat | placeholder |

Structura obligatorie v1 are zece module. Catalogul actual nu expune explicit:
vehicul/documente, tahograf/legislație, OCR/document management, raport final și
istoric/incidente ca module orchestrate.

## C. Module și fundații de domeniu

| ID | Modul | Fișiere | Activare | Persistență / API |
|---|---|---|---|---|
| MOD-01 | Pre-departure | `pre-departure/*` | activ separat | localStorage, outbox, API sync |
| MOD-02 | After-departure POC02 | `poc02-after-departure/*` | `enabled: false` | evaluare locală |
| MOD-03 | Load Safety | `premium-load-safety/*` | `enabled: true` | apeluri API directe; stare în memorie |
| MOD-04 | AI Governance | `premium-ai-governance/*` | `enabled: false` | contract, permit, audit local abstract |
| MOD-05 | Premium Copilot | `premium-copilot/*` | `enabled: false` | workflow pur, fără adaptor |
| MOD-06 | Context Analysis | `premium-context-analysis/*` | `enabled: false` | workflow pur, fără adaptor |
| MOD-07 | Linguistic Agents | `premium-linguistic-agents/*` | `enabled: false` | registru și limite |
| MOD-08 | Proactive Recommendations | `premium-proactive-recommendations/*` | `enabled: false` | workflow și porturi de audit/inspector |

## D. Subcomponente Load Safety

- analiză imagine generală;
- recomandare de asigurare a încărcăturii;
- field test cu fotografii pe roluri;
- verificarea calității fotografiei;
- OCR pentru eticheta chingii;
- raport cu observații, riscuri, recomandări, lipsuri și conflicte;
- explicații „why”.

Aceste capabilități sunt relevante, dar sunt legate de stare singleton de UI și nu
de o cursă.

## E. Dovezi de separare existente

- rutele Premium sunt centralizate;
- shell-ul Premium este separat de Basic;
- fundațiile AI sunt dezactivate și declară limite fără efecte externe;
- pre-departure are mașină de stări și outbox proprii;
- Load Safety folosește endpoint Premium dedicat;
- niciuna dintre fundațiile AI nu declară `TripContext`.
