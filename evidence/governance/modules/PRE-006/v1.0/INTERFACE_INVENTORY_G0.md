# PRE-006 — Inventar interfețe G0

| Interfață | Contract | Regula PRE-006 |
|---|---|---|
| PRE-004 / reguli / Inspector | `ProactiveRecommendationSource` | sursă versionată și confirmată de utilizator |
| PRE-002 | `AiGovernancePermit` | binding exact și consum single-use |
| Inspector | `inspectProactiveRecommendation` | validare obligatorie înainte de utilizator |
| Utilizator | accept / defer / reject | numai după aprobarea Inspectorului și înainte de expirare |
| Audit | `ProactiveRecommendationAuditEntry` | identitate, sursă, regulă și tranziție |

Nu există execuție de acțiuni, rețea, persistență sau monitorizare continuă.
