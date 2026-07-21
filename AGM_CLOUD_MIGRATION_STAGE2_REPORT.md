# AGM Cloud Migration - Stage 2 Infrastructure Report

Date: 2026-07-17
Stage: 2 - Operating system, access security, Docker and tunnel runtime
Status: TECHNICAL PASS - READY FOR HUMAN VALIDATION
Production cutover: NOT STARTED
AGM services deployment: NOT STARTED
Cloudflare Tunnel configuration: NOT STARTED

## Server baseline

```text
Hostname: agm-cloud-validation-01
Provider: Hetzner
Plan: CPX22
Architecture: x86-64
vCPU: 2
RAM: 3.7 GiB usable
Disk: 75 GiB filesystem, approximately 70 GiB free after Stage 2
Operating system: Ubuntu 24.04.4 LTS
Kernel: 6.8.0-136-generic
```

CPX22 meets the audit's staging resource floor. It has 4 GB RAM rather than the 8 GB
recommended for initial production plus Premium headroom. No resize is required for
validation. Resource measurements must be reviewed before production cutover.

## Completed operations

### Operating system

- refreshed Ubuntu package indexes;
- upgraded 52 system and security packages;
- explicitly installed the current `linux-image-virtual` metapackage;
- rebooted into kernel `6.8.0-136-generic`;
- confirmed no pending package updates;
- confirmed no failed systemd services;
- confirmed no further reboot is required.

### Administrative access

- created dedicated administrator `agmops`;
- installed the dedicated AGM Ed25519 public key;
- validated a new SSH login before disabling root access;
- granted controlled passwordless sudo to the key-authenticated administrator;
- disabled direct SSH login for `root`;
- disabled SSH password and keyboard-interactive authentication;
- retained public-key authentication;
- restricted SSH users to `agmops`;
- reduced `MaxAuthTries` to 3;
- disabled SSH X11 forwarding;
- confirmed root SSH login is rejected.

SSH starts automatically through Ubuntu's enabled `ssh.socket`, which triggers the
active `ssh.service`.

### Firewall and intrusion protection

```text
UFW status: active
Incoming default: deny
Outgoing default: allow
Routed default: deny
Allowed inbound: TCP 22 only, IPv4 and IPv6
UFW logging: low
```

Fail2ban is installed, enabled, and active with an `sshd` jail:

```text
maxretry: 5
findtime: 10 minutes
bantime: 1 hour
backend: systemd
```

### Docker runtime

```text
Docker Engine: 29.6.2
Docker Compose: 5.3.1
containerd: active and enabled
Docker: active and enabled
```

The official Docker Ubuntu repository is configured. The official `hello-world`
container completed successfully and was removed automatically.

The administrator was not added to the `docker` group because membership provides
root-equivalent privileges. Docker administration uses `sudo`.

Docker daemon controls:

- JSON-file logging;
- maximum log file size 10 MB;
- five rotated log files;
- live restore enabled;
- default no-new-privileges enabled.

Repository configuration:

```text
deploy/cloud/docker-daemon.json
SHA-256: 9767BEBBC347965DC788086BA59E1BB3FAE7C89DD855B457D692E5D35C70B9AE
```

The installed remote file has the same SHA-256.

### Cloudflare runtime

```text
cloudflared: 2026.7.2
```

Only the official binary is installed. There is no tunnel credential, no systemd
service, no DNS change, and no connection to the production tunnel.

## Final validation

| Check | Result |
|---|---|
| SSH through `agmops` | PASS |
| Password authentication disabled | PASS |
| Root SSH login disabled | PASS |
| UFW enabled | PASS |
| Only public listener TCP 22 | PASS |
| Fail2ban `sshd` jail active | PASS |
| Docker daemon active | PASS |
| Docker Compose available | PASS |
| Docker test container | PASS |
| Docker log rotation configuration | PASS |
| `cloudflared` binary available | PASS |
| Cloudflare production service absent | PASS |
| AGM containers running | 0 |
| Pending Ubuntu updates | 0 |
| Failed system services | 0 |
| Production traffic changed | NO |

## Rollback position

The local PC remains `PRIMARY`. The VPS remains `VALIDATION`.

No application data, production secrets, database, API container, or tunnel credential
has been copied to the VPS. Rolling back Stage 2 means deleting the validation VPS;
the existing AGM production service is unaffected.

## Open items before AGM deployment

- decide whether to add a small encrypted swap file before database load testing;
- prepare a complete cloud Compose definition for PostgreSQL and AGM API;
- generate strong production database credentials outside Git;
- define persistent database backup paths and retention;
- restore the Stage 0 database into validation only;
- deploy the API under a temporary validation route;
- measure CPU, RAM, disk, and translation latency;
- reassess CPX22 versus an 8 GB production target before cutover;
- configure Cloudflare only after application validation.

## Stage 2 decision

Technical result: **PASS**

Recommended gate decision: **GO for the AGM validation deployment stage**, subject to
explicit human approval.

## Human validation

```text
Change Owner: pending
Inspector: pending
Decision: pending
Validated at: pending
```
