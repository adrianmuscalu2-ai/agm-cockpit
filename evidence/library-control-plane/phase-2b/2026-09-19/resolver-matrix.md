# Phase 2B resolver matrix

| Field | Gmail | Conversation history |
| --- | --- | --- |
| SOURCE | Authenticated private Gmail mailbox | AGM session conversation history |
| AUTHORIZATION | Premium entitlement plus Permission Guardian Gmail readonly decision | Premium entitlement plus authenticated session owner |
| QUERY | Semantic inbox intent and extracted sender/topic/time constraints | Subject, entity, significant terms, time constraints and relevance |
| RESULT | Locally composed answer, Gmail operation, optional action context | Locally composed answer and selected relevant turns |
| CONFIDENCE | Resolver match confidence plus authenticated provider result | Intent confidence plus term/relevance score |
| AMBIGUITY | Explicit resolver contract field; no implicit generic fallback | Explicit resolver contract field; no full-history dump |
| PROVENANCE | Authenticated mailbox source references in engineering trace | Hashed session-turn references in engineering trace |
| FRESHNESS | Provider observation with five-minute expiry | Current session observation or UNKNOWN for verified no-data |
| MINIMAL AUTHORIZED PAYLOAD | Answer, operation, engineering sources, action context and translation trace | Answer, at most four selected turns and engineering sources |

## Cross-domain behavior

The query "Ce am discutat despre Clicktrans si verifica daca mi-au scris intre
timp" produces one Premium mandate containing both authorized resolvers. The
Global Library Authority packages two contexts and the AGM Assistant returns
one response. Gmail failure or Gmail no-data remains explicit even when history
retrieval succeeds.

## Negative controls

- Outbound email composition does not trigger inbox retrieval.
- Unrelated public questions do not trigger Gmail or history.
- Permission Guardian denial prevents the Gmail resolver call.
- Missing history subject reaches VERIFIED_NO_DATA only after the history
  resolver was called.
- Generic Assistant and web are not called for resolved, denied, unavailable or
  verified-empty Gmail requests.
