# Rescue journal — field backend preparation

1. `adb` was absent from PATH.
   - Classification: `DEFECT DE CONFIGURARE`.
   - Recovery: existing Android SDK executable used directly.
   - Minimal retest: Samsung SM-S931B detected and authorized.

2. Default `bash` invoked an inaccessible WSL runtime.
   - Classification: `DEFECT DE RUNTIME/SESIUNE`.
   - Recovery: existing Git Bash used; no installation.
   - Minimal retest: all field shell scripts passed `bash -n`.

3. Initial provisioning used .NET/encoding APIs incompatible with PowerShell 5.
   - Classification: compatibility defect.
   - Recovery: compatible RNG and explicit UTF-8 without BOM.
   - Minimal retest: four identities created; tokens not displayed.

4. Local Docker Desktop was unavailable.
   - Classification: `OPȚIONAL` for this objective.
   - Recovery: existing authorized Validation host Docker runtime used.
   - No local installation or service mutation.

5. First transfer attempt was rejected by the egress safety gate.
   - Classification: authorization blocker.
   - Recovery: stopped until the owner provided explicit execution mandate.
   - Only field source plus token hashes were transferred after approval.

6. Initial image build included nested local `node_modules`.
   - Classification: source-package contamination.
   - Recovery: only the two verified nested dependency directories were removed
     from the remote field source; field images then built successfully.

7. SQL seed failed on Prisma `updatedAt` columns without DB defaults.
   - Classification: configuration defect.
   - Recovery: explicit timestamps added; only seed step rerun.
   - Minimal retest: transactional seed committed 1 company, 4 users, 120 cases.

8. Gateway port existed in HostConfig but had no listener.
   - Classification: Docker network configuration defect.
   - Root cause: gateway attached only to an `internal` network.
   - Recovery: separate ingress bridge added only to gateway.
   - Minimal retest: loopback port 3301, blocked route 404, unauth route 401.

9. Public Validation returned HTTP 503.
   - Classification: connector configuration defect.
   - Root cause: connector log stated no ingress rules were defined.
   - Recovery: validated field-only ingress to `127.0.0.1:3301` plus 404 fallback.
   - Minimal retest: public unauthorized route 401 and non-field route 404.

10. Gateway internal JWT contained no API roles.
    - Classification: authorization mapping defect.
    - Recovery: TESTER maps to `PREMIUM_ACCESS`; OWNER maps to
      `OWNER + PREMIUM_ACCESS`.
    - Minimal retest: role mapping, role separation and token non-forwarding PASS.

11. DPAPI bundle could not be decrypted in the escalated sandbox identity.
    - Classification: runtime/security-context defect.
    - Recovery: authenticated network requests executed through the connected
      physical phone while decryption stayed in the user session.
    - No plaintext secret file was created.

12. Android shell stripped JSON quoting from the first POST attempt.
    - Classification: transport quoting defect.
    - Recovery: body transferred through Base64-decoded stdin.
    - Minimal retest: API parsed the payload; the failed 400 created no event.

13. Preallocated md5 UUIDs failed API RFC UUID validation.
    - Classification: seed defect.
    - Safety check: zero routing observations and FK `ON UPDATE CASCADE` proved.
    - Recovery: transactional conversion to deterministic UUID v4 IDs.
    - Minimal retest: 120 jobs and 120 subjects normalized; phone POST HTTP 201.

Final recovery outcome: PASS. Frozen Production PASS evidence was preserved and
only affected FIELD paths were retested.
