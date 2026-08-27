# Rescue recovery matrix

| Cause | Evidence | Approved recovery | Minimal proof |
|---|---|---|---|
| Product | failing product test/log tied to current revision | scoped code fix only with change mandate | affected test only |
| Local configuration | current versus last-working config diff | restore documented value from known-good evidence | configuration consumer succeeds |
| Extension | installed state, Extension Host logs/process | reconnect or safe Extension Host restart | extension tool call succeeds |
| Runtime | executable/dependency/process/log evidence | retry, reconnect, safe component restart | runtime handshake succeeds |
| Codex session | tool advertised but backend absent; stale session IDs | host-supported reattachment or new provisioned session | exact backend selection + neutral action |
| External infrastructure | remote health/status and local path healthy | approved provider recovery or escalation | direct remote health probe |
| Procedure/governance | contradictory or missing approved route | correct procedure under owner mandate | deterministic preflight decision |

An alternate route is valid only if governance explicitly accepts it for the
same gate. Record a fallback as evidence, never silently promote it to PASS.
