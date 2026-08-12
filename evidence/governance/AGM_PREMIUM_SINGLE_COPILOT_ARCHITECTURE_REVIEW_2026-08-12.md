# AGM Premium — Single Voice-First Copilot Architecture Review

Date: 2026-08-12  
Status: **PROPOSAL / PRODUCT OWNER IMPLEMENTATION AUTHORIZATION REQUIRED**

## 1. Outcome

Premium becomes one driver-facing surface. The two hub pages cease to be navigation concepts for the user, but their validated domain capabilities and all 24 situation definitions remain internal. The new principle is:

> The driver does not search for a function. The driver speaks to AGM; AGM identifies the intent and guides the driver to a useful, human-controlled action.

This is primarily an orchestration and presentation migration, not a rewrite of the validated domain foundation.

## 2. Visible Android-first surface

```text
┌──────────────────────────────────────┐
│ AGM COPILOT                    [RO▼] │
│ Cursa activă · Online / Offline      │
├──────────────────────────────────────┤
│                                      │
│         Cum te pot ajuta?            │
│                                      │
│            [ 🎙 ȚINE APĂSAT ]         │
│                                      │
│ [📷 Cameră/OCR] [⌨ Text] [🔊 Ascultă] │
│                                      │
│ Transcript editabil                  │
│ „Mi s-a aprins martorul de frână.”   │
│ [Anulează]             [Confirmă]    │
├──────────────────────────────────────┤
│ Situația activă                      │
│ AGM a înțeles: posibil risc frână    │
│ Următorul pas sigur, unul singur     │
│ [Oprește într-un loc sigur]          │
├──────────────────────────────────────┤
│ [Urgență aprobată]    [⋯ Recuperare] │
└──────────────────────────────────────┘
```

Rules: one column, one foreground case, one primary action, targets ≥44 px, no module grid, no technical identifiers, transcript visible before AI action, text fallback always available.

## 3. Internal capability registry

```ts
type CopilotCapability = {
  id: CapabilityId;
  productId: 'agm-cockpit';
  moduleId: string;
  requiredEntitlement: string;
  supportedIntents: readonly IntentId[];
  inputContract: SchemaRef;
  outputContract: SchemaRef;
  authority: 'READ' | 'PREPARE' | 'DEVICE_HANDOFF' | 'EXTERNAL_EFFECT';
  safetyPolicy?: SafetyPolicyId;
  permissionPolicy?: PermissionPolicyId;
  offlinePolicy: 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE';
  adapter: CapabilityAdapter;
};
```

Initial adapters reuse existing foundations:

| Intent family | Internal capability | User-visible result |
|---|---|---|
| question/advice | AGM knowledge + conversational engine | concise answer and next safe step |
| dashboard warning/technical symptom | warning analysis + safety policy | safe qualification, evidence request, escalation |
| document question | Camera/import + OCR + provenance + human confirmation | verified text, analysis/translation |
| required documents/readiness | Situation Router + READY/BLOCKED semantics | only the applicable progressive flow |
| translation/language barrier | Translator + TTS | translated, visible and playable text |
| route/location/platform nearby | device location + Maps handoff | previewed destination and explicit navigation handoff |
| phone/service call | contact resolution + device call handoff | confirmed recipient and explicit dial action |
| dispatcher message | communications preparation | preview/edit/confirm; no autonomous send |
| incident/road control/fatigue/cargo | approved OperationalCase definitions | safety gate then one active flow |
| evidence/history | Evidence + EventStore projection | current case summary/timeline |

No feature is selected by a large language model alone. The intent router produces a recommendation with confidence; deterministic policy validates entitlement, safety, required facts and authority before activating an adapter.

## 4. Intent routing contract

```text
CAPTURE VOICE/TEXT
→ LOCAL TRANSCRIPTION WHEN AVAILABLE
→ DISPLAY / EDIT / CANCEL
→ EXPLICIT CONFIRM
→ INTENT CANDIDATES + CONFIDENCE
→ DETERMINISTIC POLICY GATE
→ CLARIFY IF AMBIGUOUS
→ ACTIVATE ONE CAPABILITY / ONE OPERATIONAL CASE
→ PROGRESSIVE STEPS
→ PREVIEW + HUMAN CONFIRM FOR EFFECTS
→ RESULT / RECEIPT / FOLLOW-UP
```

Ambiguous or low-confidence intent never triggers an effect. It produces a short clarification. A new request matching the active case continues that case; an unrelated request offers explicit switch/resume choices and never silently abandons state.

## 5. Authority matrix

| Capability | Copilot may do | Human confirmation required | Copilot may never do autonomously |
|---|---|---|---|
| Conversation/knowledge | answer, ask clarification | confirmation before using transcript | assert legal/technical certainty without source limits |
| OCR/document | capture/import, propose OCR | confirm/edit derived text | overwrite original or treat OCR as verified |
| Safety case | identify policy and guide | confirm facts when safe | bypass safety gate or declare emergency resolved |
| READY | recommend warnings/blocked/eligible | user confirms READY_CONFIRMED | confirm departure itself |
| Maps/navigation | prepare destination/deep link | explicit open/navigation handoff | start/change route silently |
| Phone | resolve proposed contact and prepare dial | explicit recipient + call tap | place a call silently |
| Email/WhatsApp | prepare, preview, edit | explicit final send | send/retry confirmed receipt automatically |
| Incident/lifecycle | create/update case evidence where authorized | disposition/closure as required | close incident/objective or impersonate Product Owner |

## 6. On-device versus cloud policy

Prefer the device when it improves latency/privacy and the capability is available with permission:

- speech-to-text;
- TTS;
- camera capture;
- location;
- Maps deep link;
- phone dialer handoff;
- safe local persistence;
- OCR where the validated quality threshold is met.

Use cloud only for capabilities that require it or when the user accepts the fallback. Before sending data, apply minimization and show the user the confirmed transcript/document scope. Permission denial must leave a usable alternative: typing, import, visible text, manual address/contact selection or later retry.

## 7. Safety-first behavior

The existing post-departure gate becomes global. If the context implies driving, danger or injury, the Copilot first asks whether interaction is safe. A negative answer suppresses normal controls and allows only approved emergency/safe-stop actions. Camera, forms, communications and AI elaboration remain unavailable until explicit safe-interaction confirmation.

## 8. State and recovery

- Existing `SituationDefinition` and `OperationalCase` remain canonical.
- One foreground case; other cases become visible resumable items behind a compact history control.
- Every transition remains autosaved and EventStore/outbox compatible.
- Conversation turns reference the active case but do not become domain truth automatically.
- Refresh/restart restores transcript draft, active case, last confirmed step and pending preview without replaying effects.
- Offline preparation remains possible; reconnect never converts PREPARE into SEND.

## 9. Migration from two visible hubs

1. Add feature flag `premium.single-copilot.enabled` default OFF.
2. Preserve current routes and state sources read-only during migration.
3. Map both hub entrypoints to intent/case suggestions, not new duplicate cases.
4. Reuse the same situation IDs, definition versions and persistence keys.
5. Move technical recovery controls into the existing secondary diagnostic menu.
6. After proof, the `/premium` route renders Copilot; old hub URLs redirect to `/premium` with a non-domain intent hint.
7. Rollback turns the flag OFF and restores the old projection without reversing events or deleting state.

No accepted Slice A/B or field-test evidence is invalidated by the architecture decision. Only changed navigation, orchestration and visible UI require new evidence.

## 10. Implementation slices proposed

### C0 — Shell and intent contract

Single surface, microphone/text/camera/speaker controls, transcript review, capability registry, deterministic policy gate, feature flag and rollback. No new external effects.

### C1 — Three read-only vertical intents

1. general AGM question;
2. dashboard warning/technical symptom;
3. required-document question with Camera/OCR and human confirmation.

### C2 — Device handoffs

Location/Maps and phone dialer, each with permission, preview, explicit activation and fallback.

### C3 — Delegated communications

Email and WhatsApp only after their separate external integrations are authorized and validated, preserving the approved send contract.

## 11. Risks and controls

- Wrong intent → confidence threshold + clarification + visible interpreted intent.
- Hidden safety rule → deterministic policy owns safety, not prompt text.
- False automation impression → explicit labels for recommendation/preparation/execution.
- State duplication → same OperationalCase IDs and idempotent migration.
- Cloud privacy/cost → device-first policy and data minimization.
- Too much voice dependence → permanent text controls and visible results.
- Android capability variance → feature detection, permissions and graceful fallbacks.
- Regression of validated flows → feature flag rollback and targeted evidence only.

## 12. Acceptance gates proposed for C0

- single visible Copilot surface;
- two hubs absent from user navigation but internal state preserved;
- microphone → transcript → edit → confirm;
- text fallback;
- Camera/OCR handoff available contextually;
- TTS visible-result fallback;
- deterministic intent/policy boundary;
- safety gate precedence;
- no autonomous external effects;
- refresh/restart/offline state preservation;
- i18n 9/9;
- Desktop controlled Chromium;
- physical Android;
- feature-flag rollback;
- Basic regression preserved;
- no Production deployment without separate mandate.

## 13. Decision requested

Authorize **C0 only**. C1–C3 remain proposals and require separate authorization after C0 evidence.

Recommended verdict:

**PREMIUM SINGLE COPILOT ARCHITECTURE — READY FOR PRODUCT OWNER REVIEW**  
**IMPLEMENTATION — NOT STARTED / C0 AUTHORIZATION REQUIRED**
