# AGM temporary HTTPS tunnel testing

Date: 2026-07-14

This branch is isolated to external-connectivity testing. It does not change dictation, translation logic, or UI behavior.

## Test endpoint

```text
https://solutions-horses-weather-diesel.trycloudflare.com/api/v1
```

The endpoint is a Cloudflare Quick Tunnel and is temporary. The APK works only while both the AGM API and the `cloudflared` process remain running on the development PC. Restarting the tunnel normally creates a different hostname and requires another APK build.

## Start services

From the repository root, start the API and wait for `Nest application successfully started`:

```powershell
pnpm run api:dev
```

In a second terminal:

```powershell
cloudflared tunnel --url http://127.0.0.1:3000 --no-autoupdate
```

The generated hostname must match `VITE_AGM_API_BASE_URL` in `apps/web/.env.production`.

## Required validation

1. Open `/api/v1/health` through the public HTTPS hostname.
2. Test one real translation through the public endpoint.
3. Keep both terminals running.
4. Install the matching APK.
5. Disable Wi-Fi on the phone and test on 4G/5G.
6. Repeat from an unrelated Wi-Fi network.

## Verified before APK build

- Cloudflare tunnel registered over QUIC in Frankfurt.
- Public HTTPS health endpoint returned `status: ok`.
- Public RO -> DE translation returned an available OpenAI result.
- No CORS change was required for the Capacitor origin `https://localhost`.

This tunnel is for testing only and has no uptime guarantee. It must not be treated as production infrastructure.
