# Security-safe Android evidence capture

Raw Android diagnostics can include third-party application metadata and provider
credentials. Never redirect raw `dumpsys`, `logcat`, instrumentation, package,
activity, service, manifest, UI XML, or similar output directly into the
repository.

## Required capture path

Pipe textual output through the sanitizer before it reaches disk:

```powershell
& $adb shell dumpsys activity activities |
  node scripts/evidence-sanitizer.mjs --stdin --output evidence/<scope>/activity.txt
```

The sanitizer redacts Google API keys, Google OAuth tokens, Authorization
headers, JWTs, private keys, AWS/GitHub/OpenAI/Slack tokens, client secrets,
passwords, session/cookie material, and webhook secrets. Its output contains
only categories, paths, line numbers, and SHA-256 fingerprints; it never prints
secret values.

Install the tracked pre-commit hook once per clone:

```text
pnpm security:hooks:install
```

The hook runs `pnpm security:evidence:staged` and rejects a commit when a
credential-like value remains in staged content. CI independently runs
`pnpm security:evidence:check` and `pnpm security:evidence:test`.

Screenshots must be limited to AGM UI surfaces. Do not capture system package
metadata, developer consoles, account screens, notification content, or input
fields containing credentials. Inspect every new screenshot visually before
staging it; pair state evidence with sanitizer-checked UI XML where available.