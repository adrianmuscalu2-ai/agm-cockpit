# AGM 1.9.1 local Luna / AGMaTCC / ACPM integration

Base: `7ec519588b74f384abe8dc84dda35e3741d7fd82`. Destination: existing
`codex/acpm-gpt6-luna-isolated-20261115` worktree. This is a local review candidate,
not a Production release. No model or authority configuration in Production changes.

## Provenance

- `b966d4eb050d225ad66650d73b285df8a6bda536`: preserves the 20 Luna candidate files.
  The synthetic credential fixture was explicitly labelled EXAMPLE for the secret scanner.
- `b287c52290d7561be51a2553cdb58117514657f7`: preserves 44 ACPM source files from
  `D:/AGM-ACP-20261115`; anchored by `preserve/acpm-operational-20261115`.
- `4949eb2`: transfers that ACPM commit with `cherry-pick -x`. AppModule and the
  AGMaTCC view/runtime/CSS retain both features. No whole-directory replacement.
- Source archives, original manifests, failed attempts, test logs and database backup
  stay outside Git in `D:/AGM-ACPM-Isolated-20261115-GPT6Luna/evidence`.

## Runtime and accounting

Paid service calls require the exact existing rehearsal target:
`127.0.0.1:55432/agm_cockpit_191_rehearsal` (localhost is also accepted).
The existing reduced bootstrap includes the real authentication, copilot and ACPM
modules; it does not boot the full application's unrelated initializers.

Each provider call reserves USD 0.10 under a PostgreSQL transaction advisory lock.
The shared ceiling is USD 5 across tenants and processes. Historical estimated
USD 0.0005412 is rounded UP to USD 0.001, linked to the original JSONL chain hash.
Reservations and STARTED observations commit together before calling the provider.
Settlement and terminal ACPM observation also commit together. Duplicate settlement
is rejected. Unknown usage, network failure, process interruption or failed settlement
never releases the reservation automatically. No model/network retries are added.

Accounting uses integer nanodollars at conservative long-context estimates of
USD 0.20/M input and USD 0.75/M output, ignoring cache discounts. These are estimates,
not invoice values. Pricing reference checked 2026-11-15:
https://developers.openai.com/api/docs/pricing . Payload input is bounded to 100 KB;
output is capped at 120 tokens and service tier is default. The reserve exceeds the
bounded request's conservative cost. The fixture expectation is USD 0.00095 for
1,000 input plus 1,000 output tokens.

Malformed final JSON retains returned usage. Missing usage remains unconfirmed,
including in the service response. Measurement payloads include execution/call IDs,
tenant, model, tokens, pricing, elapsed response time, provider outcome, errors and
authorized evidence references. Timing is full-response latency, not streaming TTFT.
The original evaluation JSONL is not imported as fabricated operational events and
is not written by the paid integrated path. The legacy direct paid runner is disabled;
use the authenticated rehearsal runner so all paid calls share the same budget.

## Authorization

Copilot continues to use the existing OperationalEventAccessGuard and TURN read scope.
Agent/incident reads still require PREMIUM_ACCESS. ACPM HTTP endpoints still use
JwtAuthGuard and the existing OWNER/company_owner/PRODUCT_OWNER service gate.
The panel now uses authenticatedApiFetch for the existing user session, not a TURN
token. No conversion of TURN into OWNER, new role grant or synthetic session is used.
Internal measurement writes are not exposed as model tools or new HTTP authority.

## Migration and recovery

Only these migrations were applied, transactionally, to the named rehearsal database,
with their checksums recorded in its existing Prisma migration registry:

- `20261115003000_agent_chain_performance`
- `20261115210000_luna_acpm_budget`

Before application, the Docker loopback binding, database name and schema were checked.
Backup `rehearsal-before-luna-20261115T195853Z.dump` has SHA256
`95c207c4fcefe2658f32eb29448ec50711590a7a5804b1cda5060f7fc2fa165e`.
pg_restore listing and full SQL decoding passed. A destructive restore was not run.
Recovery must use this archive and the same rehearsal database under a recovery
mandate; do not reset, reseed or create another database. Test fixtures remain labelled
and retained, with no user/role provisioning or cleanup deletes.

## Validation and remaining gates

- API and Web typecheck: PASS. Only changed shared code was built for package exports.
- Luna/adapter/accounting unit tests: 24 PASS; malformed usage and no-spend-on-refusal covered.
- Existing TURN read/sync/refused-write contract and AGMaTCC gates: PASS.
- Real PostgreSQL: 55 simultaneous requests across two clients; 49 accepted, 6 budget
  refusals; peak USD 4.901 reserved including historical debit. 98 events persisted,
  hashes verified and reread through a second client; duplicate settlement rejected.
  These are explicitly labelled TEST_NO_PROVIDER_CALL fixtures, not model executions.
  Initial lock-deserialization and pool-wait failures are retained; the bounded retry
  used explicit SQL result typing and a 30-second transaction acquisition limit.
- Real reduced Nest HTTP runtime: copilot, ACPM and TURN validation return 401 without
  credentials; no reservation or paid request created. No guards were overridden.
- Browser preflight and controlled Playwright shell navigation/capture succeeded during
  integration. IAB host unavailable (optional). Legal notice/PIN remain intact; this is
  not authenticated UI acceptance or final combined-flow visual certification.
- **Blocking security gate:** rehearsal has zero users and zero TURN credentials.
  No legitimate combined login/conversation/OWNER read can be claimed. No account,
  PIN or role was manufactured. No new paid API calls were made.

The live runner is `apps/api/scripts/test-luna-rehearsal-live.ts`. After an authorized
owner separately provisions/restores the existing rehearsal identity through the
approved onboarding process, supply existing credentials only in process environment:
`AGM_REHEARSAL_TURN_PIN`, `AGM_REHEARSAL_OWNER_EMAIL`, `AGM_REHEARSAL_OWNER_PASSWORD`.
Use the rehearsal launcher environment and real OpenAI credential from existing custody,
then run `pnpm.cmd exec ts-node scripts/test-luna-rehearsal-live.ts` from apps/api.
It authenticates through real HTTP endpoints, checks OWNER read before any spend,
calls Luna, reads ACPM through that owner and reconciles persisted cost. It does not
create credentials. Browser E2E and independent review must follow before promotion.

Decision: GO for draft PR and independent review; NO-GO for promotion until the
legitimate authenticated live flow and independent review are complete. No merge,
Production deployment, new worktree/clone/database, or RK/Guardian/Governance edits.
