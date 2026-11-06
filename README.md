# ReportAR · Panel municipal

This Next.js app is the **admin panel** for ReportAR. Citizens report through the native iOS/Android apps and the Telegram bot. The backend (reports, photos, geography, bots, classification) is the Go API in [`reportAR-server`](../reportAR-server); its contract is in that repo's `API.md`.

## How it works

- Login uses Neon Auth (Google OAuth) through `app/api/auth/[...path]`. `proxy.ts` redirects signed-out users from `/admin` to `/admin/login`, and `/` redirects to `/admin`.
- Server Components and Server Actions call the Go API (`lib/api.ts`) with `Authorization: Bearer <Neon Auth JWT>`. The JWT is minted on the server from the session cookie (`auth.token()`), so it never reaches the browser.
- The CSV export goes through the `/admin/export` route handler, which proxies `GET /api/admin/reports/export` for the same reason.
- Admin access is decided by the Go API (`ADMIN_EMAILS`, verified email). A `403` sends the user back to the login page with an access-denied message.

## Run locally

```sh
pnpm install
cp .env.example .env   # NEON_AUTH_BASE_URL, NEON_AUTH_COOKIE_SECRET (32+ chars), REPORTAR_API_URL
pnpm dev               # http://localhost:3000
pnpm lint && pnpm build
```

`REPORTAR_API_URL` is the Go API origin (for example `http://localhost:8080`). The Go API must use the same `NEON_AUTH_BASE_URL` so it can verify the JWT.

The Telegram bot (n8n workflows) lives in `integrations/telegram-bot`. Run its tests with `npm test` from that folder.
