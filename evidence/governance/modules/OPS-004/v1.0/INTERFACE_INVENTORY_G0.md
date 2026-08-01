# OPS-004 — Inventar interfețe G0

| Interfață | Contract |
|---|---|
| module validate → release | numai baseline PASS și artefact identificat |
| OPS-002 → OPS-004 | APK verificat; semnare/publicare separată |
| API/DATA → Compose/systemd | digest/revision fixe, fără build în producție |
| OPS-003 → release | live/ready/functional health și alerte |
| Cloudflare → origin | un singur origin aprobat, schimbare mandatată |
| fallback → rollback | stare și rută capturate înaintea schimbării |
| database → cutover | dump verificat, rehearsal, single-writer și reconciliere |
| incident management → rollback | trigger documentat, STOP și dovezi păstrate |
