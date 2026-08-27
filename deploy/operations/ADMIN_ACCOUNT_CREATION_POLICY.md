# AGM administrative account creation policy

Status: mandatory for the closed controlled pilot.

1. Accounts may be created only by AGM or an authorized customer administrator.
2. Public self-registration is disabled.
3. Before activation, the administrator must attest that the user is at least 18 years old.
4. A complete date of birth must not be collected when the binary 18+ confirmation is sufficient.
5. Approved provisioning commands require the explicit `-Age18Confirmed` switch and record only the confirmation method, not a birth date.
6. The administrator must not use the switch unless the confirmation has actually been obtained.
7. A future public B2C self-registration flow requires a separately reviewed, technically enforced 18+ gate before activation.

Example invocation pattern (no credentials shown):

```powershell
.\scripts\New-AGM-ProductOwnerAccount.ps1 -Age18Confirmed
```
