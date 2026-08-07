# AGM Production recovery status — 2026-08-06

Status: **INCIDENT OPEN / AUTHORIZATION BLOCKED / NO PASS / NO CLOSED**

## Confirmed PASS evidence

- HCLOUD token custody: DPAPI configured; no secret value was printed or copied into evidence.
- Hetzner automation channel: PASS; server identity verified by server ID and IPv4.
- SSH recovery: `agmops` public-key authentication PASS; passwordless operational sudo PASS.
- API Release Candidate: `rc-20260806-2ed15a86`.
- API source artifact SHA-256: `2ED15A8684AD4C6B611ECD1BD956FB55D05C3B490161EB4286C7EB930E9EBE64`.
- API container: active and healthy on Hetzner.
- Public API readiness: `ready`; database available; translation provider configured.
- Secret & Credentials Guardian: `CONFIGURED`; telemetry exposes metadata only.
- Production Preflight: `READY`, 8/8 checks PASS.
- Web/Turn Release Candidate: `rc-20260806-829535af`.
- Web source artifact SHA-256: `829535AFABF1B7A128E3F72F6EE967A35623010CA1EB028F7AA7E92377614F36`.
- Public Turn route on the authorized Hetzner tunnel: `https://api.agmcockpit.com/turn`, HTTP 200.
- Cloudflare hostname cutover: `app.agmcockpit.com` now routes through `agm-api-production` to the validated Hetzner Web service.
- Public application TLS: valid certificate for `app.agmcockpit.com`; HTTP 200.
- Public application revision: `rc-20260806-829535af`; public bundle hash matches the validated local artifact.
- Previous origin identified as `agm-cockpit.pages.dev`; it remains available and was not deleted.
- Public JavaScript bundle SHA-256 equals the locally validated bundle:
  `F4A0C8A9B9F62167DF7C4BEFD4F8A1AB0F305471137557E502954D47EFEE611C`.
- Executable monitoring contract test: RED/OFFLINE → incident → routing → HOLD → recovery/READY-TEST PASS.
- API, Web, PostgreSQL and Cloudflare tunnel lifecycle services are installed as persistent systemd/Docker services.

## Mandatory HOLD items

1. Public Browser visual validation could not be executed because no controllable Browser session was available.
2. The reported Android bottom-navigation defect was remediated and deployed, but visual validation cannot be executed until an ADB device is connected.
3. HTTP checks, artifact identity and automated functional contracts passed, but do not substitute for the mandated visual validation.
4. Inspector closure is therefore not issued. The incident must remain open until visual Browser and Android validation pass.

## Android bottom safe-area remediation

- Scope was limited to the global `Camera OCR / Email / Microphone` action bar on coarse-pointer screens up to 620 px.
- The mobile rule is now final in the cascade and cannot be overwritten by the base declaration.
- Added deterministic Android navigation clearance plus `env(safe-area-inset-bottom)`.
- Action labels use three stable columns and no wrapping.
- Responsive contract test: PASS.
- Web build and Capacitor sync: PASS.
- Android debug APK build: PASS.
- APK SHA-256: `B413ED82F28D17BCF6D68452B3CE07011F6562BC17FA424CEDA53D33225B1C6E`.
- Public Web revision: `rc-20260806-2e5df636`; deployed CSS hash matches the local validated CSS.
- Real-device visual result: PENDING because no ADB device is connected.

## Turn HOLD / active incident interpretation

- The execution gate deliberately treats `new`, `analysis`, `remediation`, `ready-test` and `reopened` as active.
- A recovered monitoring incident transitions to `ready-test`; it is not automatically marked `validated` or `archived`.
- Therefore `HOLD — EXECUTION BLOCKED` remains intentional while Inspector evidence is missing.
- The displayed count of eight belongs to the browser-origin incident journal, which merges historical records with dynamically detected incidents. It does not mean eight services are currently offline.
- Production API, Guardian, database, Web and Cloudflare health are currently PASS; incident records must not be deleted merely to change the counter.

## Safe access policy

Turn uses the explicitly approved `open-pre-release` access mode. This is not a fabricated PIN and does not expose a credential. Before public launch, this mode must be removed and replaced by limited authenticated access under Secret & Credentials Guardian custody.

## Rollback references

- Previous API compose and systemd configurations were preserved on the Hetzner host before cutover.
- Previous Cloudflare production configuration was preserved with suffix `.pre-turn-web-20260806`.
- No database migration was pending; `prisma migrate status` reported the schema up to date before cutover.
