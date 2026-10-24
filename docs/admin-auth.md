# Municipal authentication

Admin routes use Neon Auth OAuth. `packages/auth` owns the Neon Auth client/server config, session and profile helpers, role checks, and logout. Every OAuth user gets a `user_profiles` row with the `CITIZEN` role by default. A successful Google or Vercel login alone never grants municipal access.

## Configure providers

Google is currently configured on the production branch with Neon’s shared development OAuth app. It is suitable for local development only. For production, create a Google OAuth app and configure it in the Neon Auth provider settings.

Vercel OAuth requires a Vercel OAuth app. Add its client ID and secret to the Neon Auth provider settings for the `production` branch. The callback URI to register is:

```text
${NEON_AUTH_BASE_URL}/callback/vercel
```

The application sends users back to `/admin` after Neon Auth completes. Add each deployed app origin as a trusted domain in Neon Auth. `localhost` is pre-approved by default.

The Vercel login button remains visible but disabled until its provider is configured. Then set `NEXT_PUBLIC_ENABLE_VERCEL_OAUTH=true` in the app environment.

## Grant municipal access

New profiles remain citizens. Promote a verified administrator explicitly after their first OAuth sign-in:

```sql
UPDATE user_profiles
SET role = 'MUNICIPAL_ADMIN', updated_at = now()
WHERE email = 'admin@example.gov';
```

Run this only from a trusted database administration session. Do not expose a role-promotion endpoint to users.

## Local environment

Copy `.env.example` to `.env` and keep secrets server-side. Neon Auth requires `NEON_AUTH_BASE_URL` and a 32-character-or-longer `NEON_AUTH_COOKIE_SECRET`. OAuth provider credentials belong to Neon Auth configuration; the client never reads `*_CLIENT_SECRET` variables.
