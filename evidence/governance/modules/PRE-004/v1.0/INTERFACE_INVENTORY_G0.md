# PRE-004 — Inventar interfețe G0

| Interfață | Contract | Regula PRE-004 |
|---|---|---|
| Operational context / transports | `PremiumContextAnalysisRequest.contextRefs` | doar referințe explicite și limitate |
| PRE-002 AI Governance | `AiGovernancePermit` | binding operațiune/modul/capabilitate/politică; single-use |
| Constatări | `PremiumContextFinding.sourceRefs` | minimum o sursă, confidence 0…1 |
| Utilizator | `confirm` / `reject` | nicio constatare nu devine confirmată automat |
| PRE-006 | constatări confirmate | consum ulterior numai prin contract separat |

Nu există interfață de rețea, persistență, telemetrie continuă sau execuție externă în baseline v1.0.
