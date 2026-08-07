# AGM Production SSH access recovery

This procedure contains no secret values. It is executed only in an authorized change window.

1. Monitoring creates `AGM-OPS-PRODUCTION-ACCESS` and applies route `production-access`.
2. Release & Operations owns the incident; Backend & Infrastructure is the technical executor.
3. Secret & Credentials Guardian validates the approved public-key fingerprint and awaits explicit Turn authorization before installation, rotation or revocation.
4. The Product Owner authorizes the recovery but never enters keys or commands in the Hetzner web console.
5. Release & Operations uses an already-authorized SSH identity or `scripts/Invoke-AGM-HetznerSshRecovery.ps1` with `HCLOUD_TOKEN` injected through the protected process environment.
6. The automated workflow verifies the server ID and IPv4 before enabling Rescue, installs the approved public key for `agmops`, preserves existing keys, restores ownership and modes, disables Rescue, reboots normally and validates `agmops` authentication.
7. The temporary Hetzner SSH-key resource is revoked automatically. Token values, private keys and Rescue credentials must never appear in UI, logs, Git or reports.
8. Verify SSH, API, PostgreSQL and Cloudflare without printing environment values.
9. Recovery moves the incident only to `ready-test`; Independent Validator and human validation are required before closure.
