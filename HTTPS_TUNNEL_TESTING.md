# AGM HTTPS tunnel testing

Date: 2026-07-14

This branch is isolated to external-connectivity testing. It does not change dictation, translation logic, or UI behavior.

## Stable endpoint

```text
https://api.agmcockpit.com/api/v1
```

The endpoint uses the named Cloudflare Tunnel `agm-api-production`. DNS remains stable across connector restarts. The API process and the Windows `cloudflared` service must both be running.

## Start services

From the repository root, start the API and wait for `Nest application successfully started`:

```powershell
pnpm run api:dev
```

The Windows service routes `api.agmcockpit.com` to `http://127.0.0.1:3000`. Credentials and `config.yml` stay outside the repository in the Windows system profile.

## Required validation

1. Open `/api/v1/health` through the public HTTPS hostname.
2. Test one real translation through the public endpoint.
3. Keep both terminals running.
4. Install the matching APK.
5. Disable Wi-Fi on the phone and test on 4G/5G.
6. Repeat from an unrelated Wi-Fi network.

## Verified before APK build

- Cloudflare Named Tunnel registered over QUIC in Frankfurt.
- Public HTTPS health endpoint returned `status: ok`.
- Public RO -> DE translation returned an available OpenAI result.
- No CORS change was required for the Capacitor origin `https://localhost`.

The current origin remains a single-machine connector. Production readiness still requires automatic API startup, monitoring, and recovery testing.
