# PRE-007 — Inventar interfețe

| Interfață | Direcție | Contract |
|---|---|---|
| PRE-001 Shell | PRE-001 → PRE-007 | rută și view dispatch |
| APP-015 Platform | cameră/galerie → PRE-007 | selecție explicită, permisiuni minime |
| APP-004 OCR | PRE-007 → OCR local | LC/STF utilizabile numai după confirmare |
| API-008 | PRE-007 ↔ API-008 | analyze, recommendation, field-test |
| PRE-008 TripContext | PRE-007 → PRE-008 | rezultat oferit; fără tranziție automată |
| APP-014 Outbox | PRE-007 → handoff | numai prin contract aprobat ulterior |
| OPS-003 | PRE-007 → monitoring | erori configuration/network/endpoint/provider/request |

