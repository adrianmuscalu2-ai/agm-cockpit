# Risk & Knowledge Regression Prevention Contract

Implemented locally in `apps/web/src/risk-knowledge-regression.contract.ts`.

Implemented rules:

- precheck requires capability, LKG, regression-window, incident, version,
  snapshot, worktree, CSC/PCR, Event Ledger, prior-mandate, rollback,
  candidate and validation references;
- material scope/worktree/candidate/source/writer/dependency/recovery changes
  require an in-mandate recheck;
- BEFORE/AFTER comparison is mandatory for regression safety;
- P0/P1 UNKNOWN is fail-closed;
- DEGRADED, DISCONNECTED and LOST create a new-regression condition;
- Risk BLOCK vetoes final PASS;
- human override data is not allowed to erase the original risk verdict.

Validation: `pnpm --filter @agm/web test:risk-knowledge-regression` PASS.
Lifecycle regression suite: PASS.

Remaining integration work is explicit: persist the protection set and
pre/post-review through the backend universal lifecycle writer and independent
validator. This is `TASK_REMAINING`, not a real blocker under the active mandate.
