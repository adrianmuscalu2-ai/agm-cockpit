# Premium voice shell foundation

Date: 2026-08-10 (Europe/Berlin)

Scope: technical foundation for `Vorbește cu AGM` only. This is not a UI,
runtime microphone, AI conversation, Production or release authorization.

## Canonical source

- The Premium workshop resolves voice as a minimal shell in the foundation.
- Multi-turn conversation, wake word and advanced automation remain later work.
- The roadmap still classifies the Premium voice assistant as backlog and
  requires dedicated privacy/UX review plus Change Control before activation.

## Implemented foundation

- one-utterance capture contract tied optionally to the active trip,
  OperationalCase and situation;
- fail-closed state machine: disabled → idle → permission → listening →
  processing → human transcript review → confirmed;
- cancellation and explicit failure states;
- original transcript preserved separately from the user-confirmed transcript;
- capture adapter and clock ports without a runtime implementation;
- the same semantic message registry for RO, DE, EN, FR, NL, RU, PL, TR and SQ;
- registration inside the internal Premium application module registry.
- a conversational session contract accepting natural language rather than a
  fixed command vocabulary;
- multi-turn history scoped to the active session, trip and OperationalCase;
- interpretation records with intent confidence, context references and
  missing-information fields;
- clarification questions, user corrections and continuation of the same
  conversation;
- answer and action-proposal turns kept separate;
- PREPARE → HUMAN CONFIRM/REJECT boundary for every proposed action.
- a voice-to-conversation bridge that accepts only a provenance-valid,
  human-confirmed transcript from the same trip/case/situation scope;
- raw or altered recognition output, wrong-scope audio and duplicate/invalid
  turns are rejected before conversational interpretation.

## Enforced boundaries

- module disabled by default and advertises zero enabled capabilities;
- explicit user activation and microphone permission required;
- no continuous listening and no wake word;
- no audio storage and no audio transmission;
- no external action and no automatic OperationalCase creation;
- no persistent conversational memory yet; session history is capped at 20
  confirmed user turns;
- no user-visible route, card, HUB identifier or capability claim;
- Basic, Production, Fitness, Gmail, WhatsApp, Slice A and Slice B unchanged by
  this foundation.

## Automated evidence

- `pnpm.cmd --filter @agm/web test:premium-voice-foundation`: PASS.
- `pnpm.cmd --filter @agm/web test:premium-conversation-foundation`: PASS.
- Contract, privacy boundaries, transitions, cancellation, locale/context
  matching, transcript provenance and human confirmation: PASS.
- Natural-language multi-turn, clarification, correction, contextual answer,
  action proposal, wrong-confirmation rejection and explicit accept/reject:
  PASS.
- Confirmed voice → conversational turn, raw/altered transcript rejection and
  cross-scope rejection: PASS.
- I18N shared keys and non-empty content: 9/9 PASS.
- Existing Premium foundation regression: PASS.
- TypeScript and Production-endpoint web build: PASS (243 modules).

## Deliberately pending for joint validation

- privacy and UX approval;
- visible Android-first wireframe and final user terminology;
- real Browser microphone permission grant/deny/retry;
- real Android microphone permission grant/deny/restart;
- native and Browser recognition adapter selection;
- real reasoning/provider adapter and response-quality evaluation;
- session recovery and an approved retention policy if persistent memory is
  later authorized;
- accessibility, visual layout and field validation;
- Change Control decision to expose or enable the module.

Verdicts:

- PREMIUM VOICE SHELL CONTRACT — PASS
- PRIVACY FAIL-CLOSED BOUNDARIES — PASS
- STATE MACHINE FOUNDATION — PASS
- CONTEXT BINDING FOUNDATION — PASS
- CONVERSATIONAL MULTI-TURN FOUNDATION — PASS
- CLARIFICATION / CORRECTION / CONTINUATION — PASS
- HUMAN-CONFIRMED ACTION PROPOSALS — PASS
- I18N 9/9 FOUNDATION — PASS
- RUNTIME MICROPHONE — PENDING JOINT VALIDATION
- USER INTERFACE — NOT EXPOSED / PENDING APPROVAL
- PRODUCTION — UNTOUCHED
- PREMIUM VOICE FEATURE — NOT RELEASED
