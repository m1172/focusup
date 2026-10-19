# Production deployment without a custom domain

The prepared deployment is a single FocusUp API container on Render using its
generated HTTPS `onrender.com` address. Supabase continues to host Auth and the
database. No domain registration or second database is required.

## Current deployment requirements

- This checkout needs a GitHub repository and remote. Publish the backend,
  migrations and deployment configuration without private environment files.
- Render must be connected to that repository and account access must be available.
- Review the current price of the `0.5c-512mb` paid compute plan before creating
  the service. Render explicitly describes Free compute as unsuitable for
  production; it can sleep longer than the mobile client's request timeout.
- Authentication still needs provider credentials: configure Google/Apple in
  Supabase, or configure custom SMTP and the verification-code email templates.
  The Blueprint deliberately leaves unconfigured OAuth providers disabled.

## Deployment configuration

`render.yaml` builds only `backend/` using its existing Dockerfile, runs with
`NODE_ENV=production`, and checks `/ready` before routing traffic to a deployment.
It uses one instance because the current rate limiter is in memory. Automatic
deployments require passing repository CI checks.

Provide these existing values through Render's secret environment settings:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

The private `backend/.env` already contains these values for the configured
project. Do not upload that file, its database password, or a Supabase management
token. `backend/.env.production.example` lists the settings without credentials.

Set `TRUST_PROXY` to the verified ingress proxy IP/CIDR. Confirm that two separate
client IPs have separate rate-limit buckets and that a forged forwarding header
cannot choose a different bucket. Leaving this unset can group all users behind
the hosting proxy into one bucket; trusting arbitrary forwarded headers lets a
caller evade throttling. Complete this check before public release.

The native callback is `focusup://auth/callback`. Add it to the Supabase redirect
allowlist. `CORS_ORIGINS` can stay empty for native clients; a web deployment needs
its exact HTTPS origin and a separate appropriate callback configuration.

## Authentication

For Google, use the provider credentials and exact Supabase callback shown in the
Supabase dashboard, then add `google` to `AUTH_OAUTH_PROVIDERS` after a successful
device test. Apple requires the application's Apple developer configuration
before adding `apple`. The app already has provider integration code; adding a
provider name alone does not provision those credentials.

For email signup and recovery, configure a real SMTP provider, then apply the
confirmation and recovery templates from `supabase/templates/`. The current app
expects email codes. The default Supabase mailer is restricted to authorized
project-team addresses and is insufficient for public email registration.

## Connect the released mobile app

After Render assigns the actual service address, set `EXPO_PUBLIC_API_URL` to its
HTTPS origin in the EAS **production** environment. Build the release with that
value. Keep `.env` pointing at the laptop for local development until the public
deployment passes verification. Do not use an invented or unassigned service URL.

Verify the deployed `/health`, `/ready`, authenticated profile/settings requests,
and the chosen sign-in flow from a physical device using a production build.
Verify email recovery if email authentication is enabled. The local connection
tests do not establish production device or delivery behavior.

Before public release, configure uptime/error monitoring and a database backup
and restore procedure. The Free Supabase project's availability and backup limits
need to be included in that operational decision.

References: [Render Blueprints](https://render.com/docs/blueprint-spec),
[Render Free limitations](https://render.com/docs/free),
[Supabase email delivery](https://supabase.com/docs/guides/auth/auth-smtp),
[EAS environment variables](https://docs.expo.dev/eas/environment-variables/).
