# AGM Persistent Runtime / Recovery After Restart

## Status

Architecture freeze design. No installation, build, restart, Task Scheduler change,
Defender change, policy change, secure-store rebind, certificate installation, or
runtime execution is authorized by this document.

**Final verdict: PERSISTENT RUNTIME ARCHITECTURE — NOT READY**

The design is directionally complete, but implementation is blocked until the
unknowns listed in the final section are resolved by Owner Review.

## 1. Exact functional requirement

After `Windows restart → user logon → AGM recovery`, the system must, without
manual intervention:

1. start one transparent AGM runtime entrypoint under
   `DESKTOP-2MU7PHH\\adria`;
2. resolve the existing user-bound secure-store;
3. decrypt and validate all three required references:
   `AGM_SECRET_REF_GUARDIAN`, `AGM_SECRET_REF_RELEASE`, and
   `AGM_SECRET_REF_VALIDATOR`;
4. fail closed if any reference is absent or undecryptible;
5. publish state and telemetry without recording secret values;
6. produce independently verifiable Guardian, Release & Operations, Validator,
   and Telemetry evidence;
7. remain persistent across a real Windows restart.

The recovery contract is PASS only when the same execution identity, task
definition, binary hash, evidence timestamps, and secure-store binding are
verified after the restart.

## 2. Current architecture and demonstrated failures

| Sequence | Cause | Evidence | Attempted remediation | Architectural conclusion |
|---|---|---|---|---|
| Task absent after restart | Persistent registration was not proven after logon | `schtasks` and `Get-ScheduledTask` could not find the task | Post-restart read-only verification | Pre-restart observation is insufficient |
| False-positive installer | Installer observed API state in a non-authoritative context and did not prove native persistent ownership | Installer used `Register-ScheduledTask`; later native inspection found no task | Added independent checks in revised installer | Registration must be proven through API, file, TaskCache, and a new process |
| DPAPI identity mismatch | Bindings were created under a different identity than the real runtime | Recovery journal: DPAPI files created under another Windows identity | Rebind was previously attempted under sandbox identity | Runtime identity and secure-store owner must be fixed before installation |
| Defender detection | Task chain resembled persistence malware | Defender Operational evidence: `Trojan:Win32/Commando.A!ml`, source `System`, action `Remove` | None; Defender was not disabled | No `cmd`/`.cmd`/hidden PowerShell/Bypass indirection |
| Task removed by Defender | Defender remediation removed the task artifact | Defender action `Remove`, result `0x00000000` | None | Binary and task must be transparent, signed, and scanned before install |
| PowerShell Restricted | Direct `.ps1` execution was blocked | `running scripts is disabled on this system`; effective default `Restricted` | No policy change permitted | Autostart cannot depend on PowerShell scripts |
| Native toolchain absent | No `dotnet`, `csc`, `msbuild`, `cl`, `gcc`, or `clang` | Local command discovery | SDK installation attempted but timed out; no verified SDK resulted | Toolchain must be installed and verified manually or through an approved path |
| Code signing absent | No valid trusted Authenticode certificate | Certificate store inspection returned none | No certificate created or installed | Final installation gate requires trusted signing |

## 3. Dependency inventory

### Windows

- Windows 10/11 x64 with Task Scheduler service enabled.
- Native administrator token for installation.
- Task Scheduler API and persistent task store.
- User profile for `DESKTOP-2MU7PHH\\adria`.
- Windows DPAPI user scope.
- Defender Operational log and active real-time protection.
- NTFS ACLs for the binary, runtime state, evidence, and secure-store.

### Build and runtime

- .NET 10 SDK x64, exact pinned patch version selected at Gate 1.
- Target framework `net10.0-windows`.
- RID `win-x64`.
- Self-contained single-file publish.
- `System.Security.Cryptography.ProtectedData` package/API for Windows DPAPI.
- `System.Text.Json` and BCL file/registry/process APIs.
- No PowerShell runtime dependency.

### Security and provenance

- Trusted Authenticode code-signing certificate with private key controlled by
  the owner organization.
- Certificate chain trusted by the host; timestamping service for release
  signing.
- Git source commit, locked SDK/toolchain, reproducible publish settings,
  SHA-256 manifest, and provenance record.
- No secrets in source, arguments, task XML, binary resources, logs, or Git.

### Operations

- Fixed execution identity and secure-store ACL.
- Evidence directory with append/overwrite policy defined.
- Event Log access for installation and post-restart verification.
- Rollback copy and an owner-approved uninstall procedure.

## 4. Alternative analysis

| Option | Security | Defender | DPAPI | Signing | Complexity / recovery |
|---|---|---|---|---|---|
| A. Task Scheduler → native `.exe` | Strongest fit; explicit identity and path | Best, if transparent and signed | Direct under `adria` | Required for production gate | Low/medium; simple rollback |
| B. Windows Service | Strong service isolation, but normally SYSTEM | Good when signed | Conflicts with user-bound DPAPI unless service runs as `adria` | Required | Higher install/ACL/recovery complexity |
| C. Startup application | User-scoped and easy to inspect | Better than hidden chains, but weaker persistence guarantees | Compatible with `adria` | Recommended | Less robust and more user-profile dependent |
| D. Framework-dependent .NET exe | Small; requires runtime presence | Good if signed | Compatible | Required | Adds runtime dependency and recovery risk |
| E. Self-contained .NET exe | No runtime dependency; deterministic deployment | Good if signed and scanned | Compatible | Required | Larger binary; simplest host recovery |

## 5. Single final recommendation

Use **Task Scheduler → self-contained, single-file, Authenticode-signed native
.NET executable**, running as `DESKTOP-2MU7PHH\\adria` at `AtLogOn`.

The task action must be a direct absolute executable path with no arguments
containing secrets. The executable must implement the runtime contract itself.
No Startup-folder launcher and no PowerShell or shell intermediary are allowed.

## 6. DPAPI design

The current `.dpapi` files are text serialized for PowerShell
`ConvertFrom-SecureString`/`ConvertTo-SecureString`. Direct use of
`.NET ProtectedData.Unprotect` has **not** been proven compatible with that
serialization.

Therefore:

- DPAPI compatibility status: **MIGRATION REQUIRED unless a read-only fixture
  test proves PowerShell-format compatibility**.
- No migration may occur during implementation discovery.
- The compatibility test must use a non-secret fixture or an owner-approved
  disposable test binding, never production secret values.
- If migration is required, the new format must be created under `adria`, with
  ACL restricted to `adria`, atomic replacement, checksum, and rollback copy.
- Migration must decrypt/re-encrypt in memory without logging plaintext.
- Old and new formats must have an explicit version marker and a bounded
  rollback window.

## 7. Code signing

Signing is not required to compile locally, but it is required for the final
host-installation gate because Defender already removed the prior persistence
pattern.

Required certificate:

- organization-controlled Authenticode code-signing certificate;
- private key available only to the release process;
- trusted chain on the target Windows host;
- timestamped signature;
- verification with `Get-AuthenticodeSignature` and independent certificate
  chain validation.

No self-signed trust, certificate import, Defender exclusion, or trust-store
modification is permitted.

## 8. Toolchain plan

- Official source: Microsoft .NET download channel.
- Target: current supported .NET 10 LTS x64 SDK, pinned to one exact patch.
- Install size/time: must be measured during Gate 1; do not assume either.
- Restart: normally not required for SDK installation, but any installer request
  for restart is an OWNER REVIEW boundary.
- Online install: official Microsoft installer or approved package source.
- Offline install: download the official installer manually, verify its vendor
  checksum/signature, then install locally.
- Manual installation is preferred if Codex timeout or elevation is unreliable.
- Verification: `dotnet --info`, `dotnet --list-sdks`, `dotnet build`, and
  `dotnet publish` on a disposable sample before project build.
- No Visual Studio, Build Tools, workloads, or certificates are dependencies
  unless a later approved design proves otherwise.

## 9. Defender constraints

The prior trigger was the combination:

`Task Scheduler → cmd.exe → Startup .cmd → powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden`.

The new solution must contain none of:

- `powershell.exe`, `.ps1`, `.cmd`, `cmd.exe`;
- `ExecutionPolicy Bypass`;
- `WindowStyle Hidden`;
- Startup-folder persistence;
- encoded or constructed command execution;
- explicit `schtasks.exe /Create`;
- secret values in XML, arguments, source, binary resources, or logs.

Before installation, scan source, PE strings, task XML, and published output;
hash the binary; verify Authenticode; and run an approved Defender scan. If
Defender detects the binary, installation stops. No exclusion or Defender
disablement is allowed.

## 10. Final implementation gates

### GATE 0 — prerequisites

Verify identity, native administrator access, Windows architecture, Task
Scheduler availability, secure-store ACL, Git cleanliness/scope, certificate
availability, and approved rollback location.

PASS: all prerequisites recorded. FAIL: stop; Owner Review.

### GATE 1 — toolchain

Install only the approved SDK, pin its exact version, and verify build/publish
on a disposable sample.

PASS: x64 SDK and commands work. FAIL: no source/build changes.

### GATE 2 — source implementation

Create the SDK-style project and native runtime. Implement identity checks,
DPAPI adapter, Require-Refs, component checks, telemetry, state, evidence,
fail-closed errors, and explicit exit codes.

PASS: code review and no prohibited mechanisms. FAIL: discard unpublished build
outputs and return to design.

### GATE 3 — DPAPI compatibility

Run only the approved non-secret fixture compatibility test.

PASS: existing format reads correctly under `adria`, or migration design is
approved. FAIL: no production rebind or migration.

### GATE 4 — build

Publish `win-x64`, self-contained, single-file, with locked inputs and a
provenance manifest.

PASS: stable hash across repeat publish. FAIL: do not sign or install.

### GATE 5 — Defender/static validation

Scan source, PE strings, binary, and task definition; verify Authenticode and
absence of secrets/prohibited chains.

PASS: no detection and trusted signature. FAIL: stop; never add exclusions.

### GATE 6 — host installation

Only after Owner Review, install one task as `adria`, `AtLogOn`, direct `.exe`.

PASS: API, `System32\\Tasks`, HKLM TaskCache, XML, principal, trigger, action,
and enabled state agree. FAIL: approved rollback only.

### GATE 7 — persistence validation

Use independent native/admin reads and a new process. Confirm no secret values,
correct binary hash, event registration, and no Defender removal.

PASS: all sources agree. FAIL: uninstall/rollback; no restart.

### GATE 8 — real restart

Owner explicitly authorizes a real restart. Capture pre-restart manifest first.

PASS: machine returns and `adria` logs on. FAIL: preserve evidence; no automatic
retry.

### GATE 9 — final recovery PASS

Verify task persistence, automatic trigger, current-session Last Run Time, result
0, binary identity, DPAPI compatibility, all component statuses, telemetry, and
post-restart timestamps.

PASS: issue `RECOVERY AFTER REAL RESTART — PASS`. Any missing proof is FAIL.

Every gate ends at an Owner Review boundary before the next gate.

## 11. No-more-surprises check

The following remain unresolved and could block implementation:

1. SDK installation may require manual native-admin execution or a different
   approved installer path because the previous installer timed out.
2. The exact PowerShell `.dpapi` serialization may not be directly readable by
   C# DPAPI APIs; this is the primary technical unknown.
3. The target host may lack a trusted organization Authenticode certificate.
4. Defender may classify the new unsigned or newly built binary despite the
   cleaner behavior.
5. Task Scheduler registration may still be denied or virtualized under the
   current execution context.
6. The real `adria` token and the secure-store ACL may not be available to the
   Codex-controlled process.
7. Single-file extraction behavior and writable extraction paths require review
   because self-contained .NET single-file apps can extract native components.
8. Deterministic publishing may vary with SDK patch, NuGet cache, PE metadata,
   timestamping, or signing timestamp.
9. Runtime parity may reveal missing semantics in the current PowerShell
   `ConvertTo-SecureString`, JSON, telemetry, or fail-closed behavior.
10. The Task Scheduler event log may be disabled, inaccessible, or retain
    insufficient historical evidence.
11. Rollback permissions and Defender quarantine behavior may prevent a clean
    recovery after a failed installation.

These were not all discoverable earlier because the prior work stopped at the
first failed prerequisite or used a different execution identity. They require
separate authorized gates and cannot be safely assumed away.

## Owner decision

No implementation is authorized by this document until Owner Review resolves
the DPAPI format decision, native SDK installation path, trusted signing
certificate, real `adria` administrative execution context, and Defender
pre-installation acceptance criteria.
