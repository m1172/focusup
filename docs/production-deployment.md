# Deploy the API on Supabase

For the authenticated free-feature launch, complete the findings in [release readiness](release-readiness.md) before building or submitting a production release.

FocusUp runs its API, Auth and PostgreSQL in the existing Supabase project.
Render, a separate Node host and a purchased domain are not required.

The deployed API base URL is:

```text
https://vrmfrhvzvjrktiosptdp.supabase.co/functions/v1/focusup-api
```

The Edge Function entry point is `supabase/functions/focusup-api/index.ts`.
It imports the Fetch handler, validation schemas and data gateway from
`backend/src/`, so the deployed API uses the same settings schema and RLS-scoped
gateway as the optional local Fastify server. Dependencies are pinned in the
function's `deno.json` and `deno.lock`. Deploy from the repository root so these
imports outside the function directory are included.

## Deploy

Use a compatible Node 22 installation and the pinned Supabase CLI:

```sh
npx --yes supabase@2.121.0 login
npx --yes supabase@2.121.0 link --project-ref vrmfrhvzvjrktiosptdp
npx --yes supabase@2.121.0 db push
```

Apply all migrations in filename order, including the Edge rate-limit migration.
Never use `db reset` against the hosted project.

Set these function secrets through the Supabase dashboard or CLI:

- `FOCUSUP_PUBLISHABLE_KEY`: the current publishable key from private `backend/.env`.
- `FOCUSUP_SECRET_KEY`: the current server secret key from private `backend/.env`.
- `AUTH_REDIRECT_URL`: `focusup://auth/callback` for the native app.
- `AUTH_OAUTH_PROVIDERS`: only providers configured and tested in Supabase; empty initially.
- `CORS_ORIGINS`: exact HTTPS web origins if deploying a web client; empty for native clients.

The runtime supplies `SUPABASE_URL`. Custom key names avoid the reserved
`SUPABASE_` prefix and reliance on the revoked legacy JWT keys. Keep all actual
credentials in an ignored `.env.local` file if using CLI secret import:

```sh
npx --yes supabase@2.121.0 secrets set --env-file supabase/functions/.env.local
npx --yes supabase@2.121.0 functions deploy focusup-api --use-api
```

`--use-api` bundles the function on Supabase without a local Docker daemon.
The function configuration in `supabase/config.toml` deliberately sets
`verify_jwt = false` because login, refresh and health must accept callers without
a session. Every private route explicitly verifies the Bearer token with
Supabase Auth before running; profile/settings access uses that user's RLS token.
The server key is used only for verified-owner account deletion and rate limits.
No server key belongs in the mobile app or GitHub repository.

## Rate limits

Edge workers share atomic PostgreSQL counters through a server-role-only RPC.
The counter table is in a private schema, has RLS enabled, and is inaccessible to
anonymous and authenticated clients. Expired counters are cleaned in bounded
batches. Subjects are HMAC hashes; counters do not store emails, passwords,
refresh/access tokens or IP addresses.

There is a project-wide budget of 120 public auth calls per minute plus 10 per
normalized email or refresh token, 120 private calls per verified user per minute,
a 1200/minute shared budget before private token verification, and 3 account
deletion attempts per user per minute. Readiness is limited to 60/minute. Public
health/provider/config responses do not access the database. No caller-provided
forwarding header is trusted for identity or rate limiting. The global budgets
are conservative MVP limits: monitor saturation before expanding to more users.
If the shared limiter is unavailable, affected routes fail closed with 503.

## Connect the mobile app

Set `EXPO_PUBLIC_API_URL` in the root `.env` to the full base URL above, including
`/functions/v1/focusup-api`. The client preserves that path when appending routes.
The production EAS build profile also sets this public URL explicitly. Changing
an environment value does not update an already-distributed native bundle:
reload development builds and produce a new release build or compatible EAS
Update for existing installations.

Only the HTTPS API URL is public in the app. No Supabase server secret is bundled.
The optional blocker config URL is the same base URL plus `/v1/blocker-config`.

## Authentication and release checks

Email confirmation remains enabled and passwords require 8 characters.
Public email registration/recovery still needs custom SMTP and the confirmation
and recovery code templates in `supabase/templates/`. The default Supabase
mailer is limited to authorized project-team addresses. Alternatively configure
Google/Apple credentials, test the device flow, then enable those provider names.
Moving to Edge Functions does not provision email or provider credentials.

Verify `/health`, `/ready`, missing/invalid-token rejection, email-code exchange,
password sign-in/refresh/sign-out, profiles, settings backup/read/conflicts,
account isolation, export and deletion. Temporary admin-generated verification
codes can test the API without sending emails, but do not test email delivery.
Test the chosen real sign-in flow in a physical-device production build before
public release. Configure monitoring, backups and a restore procedure; review
Supabase project quotas and free-project pausing before relying on availability.

Run local checks before deployment:

```sh
npm run lint
npm run typecheck
npm test -- --runTestsByPath src/services/backend/__tests__/client.test.ts
npm run backend:check
npm --prefix backend run build
npx --yes deno@2.9.6 check --config supabase/functions/focusup-api/deno.json supabase/functions/focusup-api/index.ts
```

GitHub Actions currently cannot start because the GitHub account reports a
billing lock. Local CLI deployment does not require GitHub Actions. Resolve
that account issue before relying on repository CI; no automated deployment
secret has been placed in GitHub.

References: [Supabase Edge Functions](https://supabase.com/docs/guides/functions),
[deployment](https://supabase.com/docs/guides/functions/deploy),
[function authentication](https://supabase.com/docs/guides/functions/auth),
[email delivery](https://supabase.com/docs/guides/auth/auth-smtp),
[Expo environment variables](https://docs.expo.dev/guides/environment-variables/).
