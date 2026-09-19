# AGM Library Control Plane

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

Phase 2A migrates Profile Personal Contacts as the first real source. The Web
adapter reads the existing user-managed contact store only after authorization,
uses Profile as the canonical owner, and is registerable under Basic, Premium,
Profile and Car Mover mandates. Premium voice routing consumes this adapter
before driver routing and before generic Assistant dispatch.

Gmail, history, OCR, translations, shared persistence, canonical knowledge and
Car Mover source adapters remain outside Phase 2A.
