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

`genericFallbackAllowed` can only be true for `VERIFIED_NO_DATA`. A domain with
no registered resolver, denied authorization, incomplete resolution,
unavailable sources, or ambiguity fails closed. When every requested domain has
registered resolvers and all of them decline the query as irrelevant, the
authority records a verified no-relevant-library boundary before generic
dispatch.

Phase 2A migrates Profile Personal Contacts as the first real source. The Web
adapter reads the existing user-managed contact store only after authorization,
uses Profile as the canonical owner, and is registerable under Basic, Premium,
Profile and Car Mover mandates. Premium voice routing consumes this adapter
before driver routing and before generic Assistant dispatch.

Phase 2B registers authenticated Gmail and AGM conversation history under the
Premium orchestrator. Gmail authorization is evaluated through Permission
Guardian before provider retrieval. Conversation history searches a bounded
20-turn session input by subject, entity, term, time and relevance, and returns
only the selected turns. A mixed request is resolved in one mandate and one
context package; partial failures remain visible and cannot be hidden by a
successful sibling resolver.

Cross-surface persistence and synchronization of conversation history remain
outside Phase 2B. They are governed by the storage policy work in Phase 2C;
Phase 2B does not imply that browser and Android session storage are shared.
OCR, translations, shared archive and Car Mover source migration also remain
outside Phase 2B.
