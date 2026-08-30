# AGM Cockpit — IT / ES / SV final validation

Date: 2026-08-28 (Europe/Berlin)
Scope: AGM Cockpit application only — Basic, Premium and Car Mover
Publication: NOT EXECUTED

## Final verdict

- APP IT = PASS
- APP ES = PASS
- APP SV = PASS
- ANDROID = PASS
- BROWSER APP = PASS
- NO MISSING KEYS = PASS (IT / ES / SV)
- NO WRONG FALLBACKS = PASS (IT / ES / SV)

## Root causes closed

1. The central application and API language contracts still stopped at the original nine languages.
2. IT / ES / SV had no complete application or operational catalogs.
3. Several Premium, pre-departure, after-departure, e-mail, maintenance and Car Mover surfaces used narrower language unions or implicit fallback branches.
4. The Premium user dashboard contained Romanian/English hardcoded presentation text despite available i18n keys.
5. The Profile “More languages” listener was accidentally located inside `registerServiceWorker()` after the Development/Android early return, so the selector could not activate IT / ES / SV on those runtimes.

## Implemented changes

- Central 12-language registry: `ro,de,en,fr,nl,ru,pl,tr,sq,it,es,sv`.
- API translation, Premium assistant and load-safety language contracts extended to IT / ES / SV.
- Full generated app catalogs for IT / ES / SV.
- Full operational catalogs for pre-departure, after-departure, e-mail templates and maintenance.
- Explicit IT / ES / SV catalogs for Car Mover and direct Premium surfaces.
- Premium dashboard bound to existing i18n keys; Premium Access view and runtime states localized.
- Profile and Text Corrector “More languages” listeners moved to their correct bind functions.
- Android Capacitor assets synchronized and APK compiled/installed in-place on the physical test device.

Only authorized English UI strings were sent to `translate.googleapis.com`. No source code, i18n keys, secrets, credentials, personal data or runtime data were transmitted.

## Exact catalog counts

Per language (IT, ES and SV):

- Main application catalog: 1,155 keys
- Operational catalog: 308 string leaves
- Car Mover direct catalog: 37 keys
- Direct Premium catalogs: 199 keys
- Total validated entries: 1,699
- Missing keys: 0
- Wrong fallbacks: 0
- Unresolved protected tokens: 0
- Placeholder mismatches: 0

## Verification commands and results

- `pnpm.cmd --filter @agm/api lint` — PASS
- `pnpm.cmd --filter @agm/api build` — PASS
- `pnpm.cmd --filter @agm/web exec tsc --noEmit` — PASS
- `pnpm.cmd --filter @agm/web test:final-language-wave` — PASS
- `pnpm.cmd --filter @agm/web exec tsx scripts/test-app008-i18n-runtime-contract.ts` — PASS
- `pnpm.cmd --filter @agm/web test:premium-handsfree` — PASS, 12/12 languages
- `pnpm.cmd --filter @agm/web test:premium-assistant-ui` — PASS, 12/12 languages
- `pnpm.cmd --filter @agm/web test:operational-context` — PASS
- `pnpm.cmd --filter @agm/web test:car-mover-p0-02` — PASS
- `pnpm.cmd --filter @agm/web exec tsx scripts/test-pre005-linguistic-agents-contract.ts` — PASS
- `pnpm.cmd --filter @agm/web exec tsx scripts/test-e6-4-to-e6-6.ts` — PASS
- `pnpm.cmd --filter @agm/web build` — PASS
- `cap sync android` + `gradlew assembleDebug` — PASS
- Controlled Browser matrix — PASS, 18/18: 3 languages × 3 surfaces × Desktop/Mobile
- Physical Android WebView matrix — PASS, 9/9: 3 languages × Basic/Premium/Car Mover

Browser preflight fields:

- Browser Plugin Status: PASS
- Integrated Browser Control Status: PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE
- Browser Session Status: PASS
- Target Page Status: PASS

## Evidence

- Strict Browser report: `evidence/app-i18n/browser/2026-08-27T23-54-43-119Z/report.json`
- Browser screenshots: same directory, 18 PNG files
- Physical Android report: `evidence/app-i18n/android/2026-08-28T00-11-13-940Z/report.json`
- Android device: Samsung SM-S931B, serial RFCY70WDHXK, physical display 1080×2340
- Android package: `com.agm.cockpit`, versionName 1.3.0, versionCode 21
- APK SHA-256: `B4C5470794F6EFE3C1CB487409B99D9D51A6E84ABD8D8F271461E78777BBB8AC`
- Recovery journal: `evidence/app-i18n/RESCUE_JOURNAL.md`

Native ADB screenshots captured while the device was locked or through a black hardware layer were inspected and explicitly excluded from PASS evidence. Android PASS is based on the controlled physical WebView DOM, exact localized markers, selector interaction, runtime-error check and overflow check; mobile visual screenshots are supplied by the controlled Browser matrix.

## Out-of-scope observation

The legacy `test:multilingual-wave1` test reports four missing French legal keys (`legal.operatorTitle`, `legal.operatorBody`, `legal.gdprTitle`, `legal.gdprBody`). This predates and is separate from IT / ES / SV. It was not hidden or converted to PASS. The strict IT / ES / SV audit has zero missing keys and zero RO / DE / EN fallback.

## Repository and release boundary

- No website publication performed.
- No Production deployment performed.
- No DNS, tunnel, connector or API routing changes performed.
- No commit or push performed.
- HEAD: `dc8d793d45fe4108bf3f9b8eb833d8423cd27201` on `agm-canonical-20260820`.
- Working tree: intentionally modified, 53 tracked files and 9 untracked entries containing the implementation/evidence; an unrelated pre-existing modification to `scripts/validate-website-final-release-browser.mjs` was preserved.
