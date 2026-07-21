# AGM public frontend — Cloudflare Pages

## Official URLs

- Frontend fallback: `https://agm-cockpit.pages.dev`
- Frontend custom domain: `https://app.agmcockpit.com`
- API: `https://api.agmcockpit.com/api/v1`

The frontend is a static Vite build deployed to the Cloudflare Pages project
`agm-cockpit`. The `_redirects` file keeps direct navigation to application routes such
as `/turn` and `/email` inside the SPA.

## Deploy

```powershell
corepack pnpm --filter @agm/web build
npx.cmd --yes wrangler@latest pages deploy apps/web/dist --project-name agm-cockpit --branch main --commit-dirty=true
```

The production build is rejected unless `apps/web/.env.production` contains an HTTPS
API URL ending in `/api/v1`.

## Custom DNS

The Pages custom domain requires this DNS record in the `agmcockpit.com` Cloudflare zone:

```text
Type: CNAME
Name: app
Target: agm-cockpit.pages.dev
Proxy: Proxied
```

After DNS propagation, Pages provisions the certificate and marks
`app.agmcockpit.com` as active.

## API CORS

The API runtime must include both public frontend origins:

```text
https://agm-cockpit.pages.dev
https://app.agmcockpit.com
```

Restart the AGM API after changing `CORS_ALLOWED_ORIGINS`. Verify the response contains
`Access-Control-Allow-Origin` for each public origin before declaring external access
validated.

## External validation

1. Open the public frontend from a network unrelated to the AGM PC.
2. Open `/turn` directly and refresh the page.
3. Perform a real translation through the public API.
4. Repeat with Wi-Fi disabled on a phone.
5. Confirm Camera/OCR, Email Assistant, and local-only history remain stable.

Cloudflare Pages stays online independently of the AGM PC. API-backed functions still
depend on the PC, PostgreSQL, AGM API supervisor, and Cloudflare Tunnel until the API is
migrated to cloud hosting.
