# Municipal authentication

Admin routes use Neon Auth OAuth. `packages/auth` holds the Neon Auth server instance (`auth`) and the browser client (sign-in and logout). A successful OAuth login alone never grants municipal access.

## Configure providers

Google is currently configured on the production branch with Neon’s shared development OAuth app. It is suitable for local development only. For production, create a Google OAuth app and configure it in the Neon Auth provider settings.

The application sends users back to `/admin` after Neon Auth completes. Add each deployed app origin as a trusted domain in Neon Auth. `localhost` is pre-approved by default.

## Designated municipal administrators

The Go API (`reportAR-server`) decides who is an admin. It verifies the Neon Auth JWT that this app sends as `Authorization: Bearer <token>` and checks the email against `ADMIN_EMAILS`. The email must be verified in Neon Auth. To add or remove an administrator, change `ADMIN_EMAILS` in the API environment.

The web gets the JWT on the server with `auth.token()` and never sends it to the browser. When the API answers `403`, the panel redirects to `/admin/login?error=not-admin`.

## Local environment

Copy `.env.example` to `.env` and keep secrets server-side. Neon Auth requires `NEON_AUTH_BASE_URL` and a 32-character-or-longer `NEON_AUTH_COOKIE_SECRET`. `REPORTAR_API_URL` points to the Go API. OAuth provider credentials belong to Neon Auth configuration.
