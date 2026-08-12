# Integrated Browser / iab recurring failure

## Classification

`EXTERNAL SESSION PROVISIONING BLOCKER`

This is not an AGM product failure and not a missing local browser dependency.

## Root cause evidence

- Browser plugin files and node runtime exist.
- Configuration advertises `BROWSER_USE_AVAILABLE_BACKENDS=chrome,iab`.
- Configuration still identifies Codex app `26.803.41515` and a session-specific
  pipe `codex-computer-use-30bdecfd-9402-407e-b58f-80c9cdac175f`.
- Installed Codex Desktop is `26.803.5235.0`; two VS Code extensions coexist:
  `26.803.41515` and `26.803.61601`.
- No live `codex-computer-use` process serves the configured pipe.
- Exact `agent.browsers.get("iab")` returns
  `Browser is not available: iab` and runtime discovery returns `[]`.
- A controlled Codex Desktop process restart did not start the helper and did
  not attach a new backend.

Configured backend names and a filesystem-visible pipe name are stale metadata,
not proof of a live browser-control attachment.

## Why the earlier recovery was not persistent

The earlier PASS belonged to one Desktop session whose host had attached `iab`.
That attachment was treated as reusable capability even though the native
backend and pipe are session-scoped. A later VS Code session inherited static
configuration but not the serving backend process. Installing browsers or
launching Desktop cannot recreate a host-issued session attachment.

## Local remediation completed

- Preflight now separates configured backends from runtime backends.
- It compares configured and installed Codex versions.
- It verifies the serving helper process instead of trusting a pipe path.
- A configured pipe without a helper is classified
  `SESSION_ATTACHMENT_MISSING`.
- The permanent runbook now forbids carrying one-session attachment evidence
  into a later session and documents the host-provisioning boundary.
- Browser validation flow contract test passes.

## Permanent correction required

The Codex Desktop/platform host must attach Integrated Browser during every
eligible session bootstrap, start `codex-computer-use`, and provide a fresh
pipe. This cannot be implemented by AGM repository code, PATH changes, local
browser installation, or a manually started helper.

Until the platform supplies that invariant, the unavoidable manual action is
opening an eligible new Codex Desktop session and confirming exact `iab`
selection. It must not be repeated inside an unchanged session.

## Restart validation

- Codex Desktop targets were resolved and restarted without stopping VS Code.
- Desktop relaunched successfully.
- Post-restart helper process: absent.
- Post-restart session attachment: `STALE_OR_NOT_PROVISIONED`.
- Post-restart iab status: `SESSION_ATTACHMENT_MISSING`.
- Real post-restart iab browser action: not possible.

## Verdict

`IAB INCIDENT — HOLD / PLATFORM SESSION PROVISIONING REQUIRED`

Slice A, Android, Production, Basic, Fitness and existing PASS evidence were
not modified or repeated.
