# AGM Library Control Plane — Phase 2A evidence

Date: 2026-09-19

Parent SHA: `59868bd7b3ba2fb5388c7344c8fdb7849a24e197`

Scope: Profile + Personal Contacts source migration; no Production deploy.

## Implemented source migration

- Profile is the canonical logical owner of user-entered personal contacts;
- the existing validated `agm.contact-manager.contacts` store remains the data
  source, with no duplicate contact store introduced;
- `ProfilePersonalContactsResolver` implements the Phase 1 common resolver
  contract;
- the resolver is eligible under explicit Basic, Premium, Profile and Car Mover
  mandates;
- Browser and Android requests use the same Global Library Authority entry
  point and domain-orchestrator contract;
- Profile data is read only inside `resolve()`, after authorization and mandate
  issuance; planning does not inspect the store;
- only the selected contact command crosses the minimal-authorized-payload
  boundary; notes, address and unrelated profile fields are excluded;
- duplicate identities produce `CLARIFICATION_REQUIRED` and cannot reach the
  generic Assistant;
- a verified no-contact result produces `VERIFIED_NO_DATA` before legacy
  routing or generic Assistant fallback;
- the Premium runtime no longer invokes the personal-contact voice resolver
  directly;
- the downstream Android action executor preserves the existing confirmation,
  `ACTION_DIAL`, Guardian and handoff boundaries.

## Reproducible commands

```text
pnpm.cmd --filter @agm/library-control-plane build
pnpm.cmd --filter @agm/library-control-plane test:phase1
pnpm.cmd --filter @agm/web test:library:phase2a
pnpm.cmd --filter @agm/web test:quick-contacts
pnpm.cmd --filter @agm/web test:android-action-layer
pnpm.cmd --filter @agm/web exec tsc --noEmit
pnpm.cmd --filter @agm/web build
```

Observed dedicated 2A results:

```text
PHASE 2A PROFILE CANONICAL CONTACT SOURCE = PASS
PHASE 2A BROWSER + ANDROID DOMAIN MANDATES = PASS
PHASE 2A ALIAS + PHONE + EMAIL RESOLUTION = PASS
PHASE 2A DUPLICATE CLARIFICATION = PASS
PHASE 2A VERIFIED NO-DATA FALLBACK = PASS
PHASE 2A ACTION_DIAL SAFETY CONTRACT PRESERVED = PASS
```

Regression results:

```text
GLOBAL LIBRARY AUTHORITY = IMPLEMENTED
4 DOMAIN ORCHESTRATORS = REGISTERED
COMMON RESOLVER CONTRACT = PASS
AUTHORIZATION BEFORE RETRIEVAL = PASS
NO GENERIC ASSISTANT FALLBACK BEFORE LIBRARY RESOLUTION = PASS
AGM PERSONAL CONTACTS 20 PEOPLE + PHONE/GMAIL/MESSENGER RESOLUTION = PASS
ANDROID ACTION LAYER PROTOCOL = PASS
WEB TYPES = PASS
WEB BUILD = PASS
```

## Negative controls

- planning performed zero Profile-store reads;
- weather, navigation and conversation-history phrases returned
  `VERIFIED_NO_DATA` from the Profile Contacts source;
- duplicate names never selected a person automatically;
- Profile notes and address markers did not appear in the resolved package;
- resolved context could not use generic fallback;
- ambiguity could not dispatch to Assistant or an external action;
- the direct Premium invocation of
  `resolvePersonalContactVoiceRequest(confirmedVoiceText, ...)` is absent.

## Preserved boundaries

- contact validation and the 20-person limit;
- generated first-name and Romanian genitive aliases;
- exactly one AGM confirmation before a telephone handoff;
- `ACTION_DIAL`, without automatic call initiation;
- duplicate clarification;
- `enforceVerifiedContactBoundary()`;
- Permission Guardian observations;
- Android contact fallback for names not stored in the AGM Profile;
- Gmail behavior, which is not modified in 2A.

## Explicit cross-surface limitation

This phase proves that Browser and Android requests use the same resolver and
mandate contract. It does not claim that `https://localhost` and
`https://app.agmcockpit.com` share `localStorage`. The storage classification,
user-approved synchronization policy and any backend shared store remain Phase
2C work. No local-only data was uploaded or migrated automatically.

## Gate verdict

`PHASE 2A PROFILE + PERSONAL CONTACTS = PASS`

`PROFILE CANONICAL SOURCE = PASS`

`GLOBAL LIBRARY AUTHORITY ROUTING = PASS`

`AUTHORIZATION BEFORE PROFILE READ = PASS`

`DUPLICATE CLARIFICATION = PASS`

`ACTION_DIAL SAFETY = PASS`

`ANDROID/BROWSER RESOLVER CONTRACT = PASS`

`ANDROID/BROWSER SHARED STORAGE = NOT CLAIMED / PHASE 2C`

`PHASE 2B = NOT STARTED`

`PRODUCTION DEPLOY = NOT TRIGGERED`
