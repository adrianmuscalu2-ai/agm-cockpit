# CAR MOVER — PRODUCTION EVIDENCE — 2026-08-23

## Scope

Car Mover remains an AGM Premium component. No parallel product, authentication system, tenant model, or infrastructure was introduced.

## Released implementation

- Primary accounting: append-only `REVENUE`, `COST`, `PAYMENT`, and `REVERSAL` entries; invoice metadata; revenue/cost/payment/margin projection.
- Communications: Gmail and WhatsApp Cloud provider adapters scoped to the Car Mover Job File, with authenticated API, tenant/company isolation, audit references, and EventStore evidence.
- Platform alerts: controlled extraction, scoring, human review, and no automatic acceptance.
- Gmail: OAuth refresh custody bound to Production; authenticated inbox sync operational.
- Android: isolated Capacitor origin `https://localhost`; compact APK build excludes public download binaries from the packaged APK.

## Verification

- Commit: `5e91b6013b608d114288eba1206f938fbeb75a93`
- Production workflow: `32660689111` — `verify`, `publish`, and `deploy` all `SUCCESS`.
- API regression: 42 suites / 214 tests PASS in the release workflow.
- Production health: `/api/v1/health/live` HTTP 200, status `ok`; `/api/v1/health/ready` HTTP 200, status `ready`, database available.
- Production Web: `https://app.agmcockpit.com/car-mover` visually verified; Car Mover jobs and completed E2E records visible.
- Public Web bundle: `/assets/main--5yKeDxi.js`; Gmail sync route marker `/communications/sync/email` present.
- Android runtime: `CAR MOVER P1 ANDROID: PASS` after real phone reboot/unlock; origin `https://localhost`; Gmail sync scanned 18 messages; accounting projection 100.00 EUR revenue / 25.00 EUR cost / 75.00 EUR margin; invoice recorded.
- Android report: `android/2026-08-23T19-13-03-041Z/report.json`.
- Public APK: 15,705,495 bytes; SHA-256 `5F6EC70EC24B54ED20A340C508AF5C8CD4E157A671237D35BC9462FD78BD0C19`; downloaded Production hash matches the installed build.
- Gmail provider: `configured=true`; real inbox sync operational; prior five parser false positives reconciled to `DISMISSED` with audit/EventStore evidence.
- Automatic platform-offer acceptance: `false`.

## WhatsApp external provider state — OWNER DEFERRED

- AGM code path and provider contract exist and remain fail-closed.
- Production provider state: `configured=false`.
- Meta Business account `AGM Transporte` exists, but Meta reports `Cont restricționat` with permanent restrictions.
- Meta explicitly blocks starting conversations, responding to customers, and adding phone numbers.
- No phone number is registered and the add-number control is disabled.
- Meta requires business confirmation, while the Business Security Center currently states that the organization does not require confirmation and exposes no executable eligible verification flow.
- Evidence: `final-2026-08-23/meta-whatsapp-restriction.png`.
- Owner instruction on 2026-08-23: stop WhatsApp work. No review, credential issuance, provider activation, or additional Meta action was executed.

## Verdict

- Car Mover Premium core, lifecycle, takeover/handover, accounting, Gmail extraction/analysis, Web Production, Android runtime, audit, and persistence: **PASS**.
- WhatsApp Cloud live messaging/extraction: **OWNER DEFERRED / NOT CONFIGURED; NO FALSE PASS**.
- Current approved scope excluding deferred WhatsApp activation: **PASS / PRODUCTION VERIFIED**.
