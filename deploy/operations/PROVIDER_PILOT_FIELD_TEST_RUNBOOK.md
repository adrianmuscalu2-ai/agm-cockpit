# AGM controlled provider pilot — field runbook

Window: 2026-08-24 through 2026-08-27 22:00 UTC  
Scope: one allowlisted AGM Premium owner account; Car Mover only  
Google Maps: excluded

## One-time secure provisioning

Run interactively. Keys are entered in a protected prompt and stored only in the current Windows user's Guardian DPAPI bundle.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Provision-AGMLiveProviderSecrets.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Confirm-AGMLiveProviderCustody.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Invoke-AGMProviderPilot.ps1 -Action Seed
```

Do not paste keys into chat, source files, `.env`, audit records, or telemetry.

## Field probe

Use the actual origin and destination coordinates. The probe performs one controlled sequence: geocoding, live route, cache reuse, route recalculation, traffic, HERE intermodal, toll, TomTom-to-HERE fallback, Gmail intake, Opportunity Intelligence import, and the final telemetry report.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Invoke-AGMProviderPilot.ps1 `
  -Action Probe `
  -OriginLat "48.0000" -OriginLon "11.0000" `
  -DestinationLat "48.5734" -DestinationLon "7.7521" `
  -DestinationQuery "Strasbourg, France"
```

Do not repeat the probe when the input and provider state have not changed. Normal Car Mover manual flows remain available when external providers are unavailable.

## Report

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Invoke-AGMProviderPilot.ps1 -Action Report
```

The report distinguishes estimated cost from reconciled actual cost. An absent billing value is `null`, never an invented zero.

## Controlled state change

Suspend without deleting configuration:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Invoke-AGMProviderPilot.ps1 `
  -Action State -Provider tomtom -PilotState SUSPENDED -StateReason OWNER_AFTER_FIELD_TEST
```

Use `here`, `tollguru`, or `gmail` for the other providers. Reactivate only a provider with a valid Guardian reference:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Invoke-AGMProviderPilot.ps1 `
  -Action State -Provider tomtom -PilotState ACTIVE -StateReason OWNER_REACTIVATED
```

Every transition is stored as a control event without credential material.

## Gate rule

Do not issue `PROVIDER ACTIVATION GATE = PASS` until TomTom, HERE, and TollGuru have each produced real successful telemetry and the field sequence demonstrates cache, recalculation, fallback, provider-loss behavior, Gmail intake/dedup, Opportunity Intelligence, Cost & Risk, Planning, Judge, Copilot presentation, and manual Car Mover continuity.
