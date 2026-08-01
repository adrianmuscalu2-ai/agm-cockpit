# PRE-001 — Inventar interfețe

| Interfață | Direcție | Contract |
|---|---|---|
| APP-001 App Shell | Basic ↔ PRE-001 | navigație și Browser history |
| PRE-008 TripContext | PRE-008 → PRE-001 | read model; fără tranziții în shell |
| PRE-007 Load Safety | PRE-001 → PRE-007 | rută și view dispatch |
| PRE-002…006 AI | PRE-001 → module | stare vizibilă; fără activare implicită |
| APP-008 I18n | cataloage → PRE-001 | RO/DE/EN și status keys |
| OPS-001/002 | Browser/Android → PRE-001 | runtime și navigație platformă |
| OPS-003 | PRE-001 → monitoring | health UI prin contract separat |

