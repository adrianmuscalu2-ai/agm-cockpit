# AGM persistent runtime control plane

Versioned, fail-closed bootstrap contract. It stores no secret values; bindings
are references resolved by an external Guardian through approved host context.

```powershell
pwsh -File deploy/runtime/bootstrap.ps1
pwsh -File deploy/runtime/health.ps1
pwsh -File deploy/runtime/ready.ps1
pwsh -File deploy/runtime/validate.ps1
pwsh -File deploy/runtime/rollback-dry-run.ps1
```
