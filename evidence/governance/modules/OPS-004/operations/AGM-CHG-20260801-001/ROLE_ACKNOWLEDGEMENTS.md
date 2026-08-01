# AGM-CHG-20260801-001 — Confirmări roluri

## Command Lead

Adrian / Turn Commander — confirmat prin mandatul inițial și aprobarea continuării imediate.

## Independent Validator

Banach / `app003_inspector_review` — rol acceptat în sesiune distinctă. După remediere: **GO pentru revenirea la PRE-CHANGE**; nu reprezintă încă GO pentru mutație.

## Fallback Responsible

Plato / `app003_qa_review` — rol acceptat pentru readiness read-only. După remediere: **PASS fallback readiness**; PC read-only, Windows Cloudflared standby/stopped, Hetzner single-writer.

## Rollback Responsible

Lorentz / `app003_owner_review` — rol acceptat în sesiune distinctă. Remedierea: **PASS**. Verdict PRE-CHANGE: **HOLD** până la emiterea unei ferestre curente, a checklistului adaptat topologiei post-cutover și a secvenței exacte de rollback.

## Executor tehnic

Codex `/root` — preflight read-only executat; nicio mutație și niciun secret accesat.
