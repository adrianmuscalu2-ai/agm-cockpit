# AGM Gate 1 remediation report

Date: 2026-07-28
Mode: source discovery and validation, read-only
Verdict: **FAIL / NOT READY — approved production source unavailable**

## Objective

Install `/opt/agm/production/secrets/agm-production.env` from the approved secure
source, enforce the approved owner and mode `0600`, verify integrity and rerun Gate 1.

## Source discovery evidence

### Local workspace

- Backend production environment source: not found.
- Production template:
  `deploy/production/production.env.template`
- Template SHA-256:
  `fe6ea2b65e55901ddb36e958a1c246a82c32c482b8e9b5528576325a4c9c9b70`
- The template contains redacted placeholders and is not an installable secret source.
- `apps/web/.env.production` is a frontend build file and is not an API production
  environment source.

### Hetzner

Candidate paths discovered:

1. `/opt/agm/secrets/agm-validation.env`
   - owner/group: `root:root`
   - mode: `0600`
   - SHA-256:
     `2ef14786a239c4e50e88e95ec16aafeb66c9be88e487195c3b1324593aecb6e8`
   - classification: validation environment, not an approved production source

2. `/opt/agm/app/docker-compose.env`
   - owner/group: `root:root`
   - mode: `0666`
   - SHA-256:
     `06857d96b1aa739f6f5ecf2962b5fc5abb40efdb7d5923f06c7a537c69e8bb2f`
   - no recognized AGM environment keys were returned by the redacted key inventory
   - classification: legacy/insecure; prohibited as production source

No values or secrets were displayed.

## Stop decision

Installation was not attempted because no approved production secret source was
available. Copying `agm-validation.env` would reuse a configuration explicitly
classified for validation. Installing the template would install placeholders rather
than approved secrets. Using `docker-compose.env` would rely on an insecure legacy
file.

## State conservation

- The target production environment file remains absent.
- No remote file or directory was created.
- No ownership or permission was changed.
- No service or systemd unit was started, stopped, reloaded or restarted.
- No Docker, database, Cloudflare or deployment action occurred.
- The approved image was not modified.

## Required authorization/input

Before Gate 1 remediation can resume, coordination must identify one concrete approved
secret source or authorize creation of new production credentials through an approved
secret-management channel. The authorization must also specify:

- approved source path or secret-manager reference;
- approved owner/group (`root:root` or another explicit policy);
- production database identity to encode in `DATABASE_URL`;
- source for `OPENAI_API_KEY`;
- source or rotation policy for `JWT_SECRET`;
- source or rotation policy for `AGM_TURN_ADMIN_PIN_HASH`;
- audit owner and expected checksum or signed manifest.

