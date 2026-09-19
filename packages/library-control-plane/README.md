# AGM Library Control Plane — Phase 1

This package is the common entry point for AGM library access. It owns no user
data and performs no source migration in Phase 1.

The authority classifies the AGM domain, obtains explicit authorization before
calling any resolver, issues domain-scoped mandates, collects and de-duplicates
results, and returns one `ResolvedContextPackage` with an explicit dispatch
decision.

The four registered orchestrators are:

- Basic Library Orchestrator;
- Premium Library Orchestrator;
- Profile Library Orchestrator;
- Car Mover Library Orchestrator.

`genericFallbackAllowed` can only be true for `VERIFIED_NO_DATA`. Missing
orchestrators, missing eligible resolvers, denied authorization, incomplete
resolution, unavailable sources, or ambiguity fail closed.

Existing real sources are intentionally not migrated in this phase. Phase 2
will add adapters for contacts, Gmail, history, OCR, translations, canonical
knowledge, Profile and Car Mover data behind the common resolver contract.
