# AGM Field Validation — authorized technical identities

No personal names, emails, phone numbers or credentials are stored in this
evidence file.

| Technical identity | User ID | Access | Assigned cases |
|---|---|---|---:|
| FIELD-TESTER-01 | f3000000-0000-4000-8000-000000000001 | GET protocol; POST observations | 40 |
| FIELD-TESTER-02 | f3000000-0000-4000-8000-000000000002 | GET protocol; POST observations | 40 |
| FIELD-TESTER-03 | f3000000-0000-4000-8000-000000000003 | GET protocol; POST observations | 40 |
| FIELD-OWNER | f3000000-0000-4000-8000-00000000000f | GET protocol; GET telemetry; observation denied | 0 |

All four identities were validated through the field gateway. All three tester
identities returned HTTP 200 and exactly 40 assigned cases from the connected
physical Samsung SM-S931B. Tester telemetry and owner observation access each
returned HTTP 403 as designed.

The owner maps these technical identities to physical testers privately. Access
tokens were generated locally, were never displayed in execution evidence, and
remain only in the Windows-user-bound DPAPI bundle:
`.tmp/field-test-backend/field-access.dpapi`.

When the owner is ready to distribute the three credentials privately, the
local helper `scripts/Show-AGMFieldTestAccess.ps1` displays them only in the
owner's interactive Windows session. Tokens must not be committed, attached to
reports, or sent through public channels.
