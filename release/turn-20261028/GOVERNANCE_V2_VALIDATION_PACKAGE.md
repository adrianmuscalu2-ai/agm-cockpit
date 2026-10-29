# Governance V2 — independent validation package

Prepared: 2026-10-29
Candidate: `C:\Users\adria\Documents\AGM-CANONICAL-CANDIDATE-20261022`
Branch: `phase3-rc-preparation`
Scope: Governance V2 implementation and controlled-local verification.

## Files in scope

| File | SHA-256 | Status |
|---|---|---|
| `apps/api/src/app.module.ts` | `701EAE1D584B3A4EA81725943AB0A5F52D33E2E75BC17A2000A5C48F288D250E` | modified |
| `apps/api/src/governance-v2/governance-v2.contract.ts` | `1ACA5BB5D22B72D3A9BC40FB64D3DFC9C40A79CC9A56E50D0E5C37911665DC62` | added |
| `apps/api/src/governance-v2/governance-v2.engine.ts` | `14E058E4AC5131A3776D9D6BD8C629912AFE4B514CBED6807DEFD11076635405` | added |
| `apps/api/src/governance-v2/governance-v2.module.ts` | `C740AC3A8A6225E91C6CF8B66724CA0D9B8CEA87B9A716A65A40564B8B8EF5C3` | added |
| `apps/api/src/governance-v2/governance-v2.persistence.ts` | `F2B51819E4A121CCF4798AF214C24F7A0FFA600C02E372E65736968723E70344` | added |
| `apps/api/src/governance-v2/governance-v2.runtime.ts` | `7D4D5BA92D398DB2F3D72948834F7395B8D50D20DF0ADCFD1EF4E74342B8ED62` | added |
| `apps/api/src/governance-v2/risk-knowledge-orchestrator.ts` | `51CF5C37388B42906C11630C32C1E3A8806BECFE7A6D21BE83B6E19CBC4B1407` | added |
| `apps/api/test/governance-v2-hardening.spec.ts` | `027DB3F8B81250A6411928BC5B09F69E7473B73C6A42E53A596BF566A1005676` | added |
| `prisma/migrations/20261029120000_add_governance_v2/migration.sql` | `42E1CF95D1554FBC26D6B39F5E8E92DB0C41263ECC7435F2506434B7592A7EE6` | added |
| `apps/web/src/premium-governance/premium-governance.view.ts` | `BDD6E6B2735326559ACB955AECDC5D8FA8D3F019BDBC907D8E4483634B6E519F` | modified |

## Verification already performed

- Governance V2 hardening: `8/8 PASS`.
- Controlled-local persistence/recovery test: PASS, including negative controls.
- API TypeScript: PASS.
- Web TypeScript: PASS.
- Premium foundation test: PASS.
- `git diff --check`: PASS; only Git line-ending warnings.
- Local schema: 14 tables and 43 triggers observed.
- Direct SQL insert/delete guards: rejected.
- Executor/validator collision: rejected.

Evidence files:

- `release/turn-20261028/GOVERNANCE_V2_INTEGRATION.md`
- `release/turn-20261028/GOVERNANCE_V2_LOCAL_EVIDENCE_20261029.md`
- `AGM_SAFE_SHUTDOWN_20261026.md`
- `AGM_SAFE_SHUTDOWN_20261026_MANIFEST.json`

## Validator checklist

The independent validator must confirm:

- [ ] file list and SHA-256 digests match the candidate;
- [ ] runtime is registered in the API module;
- [ ] migration is isolated to `agm_governance`;
- [ ] append-only ledger and no-direct-write controls are present;
- [ ] executor and validator identities are separate;
- [ ] controlled-local evidence is not presented as Production evidence;
- [ ] Production activation remains gated until an official environment is designated;
- [ ] rollback and restore evidence are sufficient for the intended target;
- [ ] the final candidate commit/ref is the one being validated.

## Explicit non-claims

This package does not claim Production activation, Production migration,
Production runtime PASS, or final release PASS. No commit, push or deploy is
included in this validation package.
