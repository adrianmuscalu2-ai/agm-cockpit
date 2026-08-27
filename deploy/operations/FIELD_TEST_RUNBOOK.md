# AGM Car Mover — Field Test Runbook

Status target: `FIELD TEST READY`  
Build: Web/Android `1.3.0` (`versionCode 21`)  
Safety rule: no manual operation while the vehicle is moving.

## 1. Before departure — 5 minutes

With the vehicle parked:

1. Run the automatic preparation check:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Invoke-AGMFieldTest.ps1 -Action Prepare
   ```

2. Confirm the short checklist in `FIELD_TEST_PRE_DEPARTURE_CHECKLIST.md`.
3. Start the session with one identifiable ID:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Invoke-AGMFieldTest.ps1 `
     -Action Start -SessionId "field-2026-08-26-france" `
     -Device "Android AGM Cockpit 1.3.0" -Connectivity MOBILE -SafetyConfirmed
   ```

4. In the app verify: open/login, Planning, fresh live data, geocoding, one simple route, traffic, Copilot result, telemetry increments, no authority/fencing error, manual fallback visible.

If an AI/provider component is unavailable, continue as `DEGRADED` only when the documented fallback works.

## 2. Safe operational scenarios

Run only when naturally relevant and only while parked or through a passenger/tester:

- Normal route: departure → pickup → delivery; record predicted/observed distance and ETA.
- Traffic change: record natural reroute/freshness and whether Judge/Copilot changed.
- Repositioning: car plus public transport when relevant; record time, cost, feasibility.
- Chain: individual, two, and three jobs when real opportunities exist.
- Toll: invoke TollGuru only with `tollRequired=true` and an allowlisted reason.
- Gmail: relevant, irrelevant, duplicate, changed price/conditions; verify no automatic Job.

Do not create traffic, connectivity loss, incidents, damage, conflict, or vehicle problems for testing.

## 3. Capture a checkpoint

Copy `templates/field-test-observation.json`, fill only observed values, and capture while parked:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Invoke-AGMFieldTest.ps1 `
  -Action Capture -SessionId "field-2026-08-26-france" `
  -ObservationPath ".\tmp\field-observation.json"
```

The runner rejects a checkpoint unless `vehicleStationary=true` or `operatedBy=PASSENGER`.

## 4. Safe fallback test

Execute one controlled software fallback before departure or while parked. Follow `FIELD_TEST_SAFE_FALLBACK_SCENARIOS.md`. Do not intentionally disable connectivity while driving.

## 5. Complete and report

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Invoke-AGMFieldTest.ps1 `
  -Action Complete -SessionId "field-2026-08-26-france"
```

The runner creates `final-report.json` and `final-report.md`. The verdict remains `PENDING HUMAN ACCEPTANCE` until operational usefulness is reviewed and set to one of: `PASS`, `PASS WITH OBSERVATIONS`, `PARTIAL`, `FAIL`.

During the field test do not redesign contracts, authority, lifecycle, provider selection, agents, accounting, or UI. Log defects for controlled follow-up.

