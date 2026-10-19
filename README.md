# FocusUp backend on Supabase

The FocusUp API runs in Supabase Edge Functions alongside Supabase Auth and
PostgreSQL. No Render service or purchased domain is required.

API base URL:

```text
https://vrmfrhvzvjrktiosptdp.supabase.co/functions/v1/focusup-api
```

The function entry point in `supabase/functions/focusup-api/` imports the shared
Fetch handler, schemas and data gateway in `backend/src/`. Private routes verify
the user through Supabase Auth and use their RLS-scoped access token. Shared rate
limits use a server-role-only PostgreSQL function with private counters.

See [deployment instructions](docs/production-deployment.md) for secrets,
migrations, deployment commands and remaining authentication requirements.
Public email signup/recovery needs custom SMTP, or configured Google/Apple
credentials for social login. A deployed API alone does not establish release
readiness or email delivery.

## Deploy

```sh
npx --yes supabase@2.121.0 login
npx --yes supabase@2.121.0 link --project-ref vrmfrhvzvjrktiosptdp
npx --yes supabase@2.121.0 db push
# Configure function secrets privately before deployment.
npx --yes supabase@2.121.0 functions deploy focusup-api --use-api
```

## Validate

```sh
npm --prefix backend ci
npm --prefix backend run lint
npm --prefix backend run typecheck
npm --prefix backend test
npm --prefix backend run build
npx --yes deno@2.9.6 check --config supabase/functions/focusup-api/deno.json supabase/functions/focusup-api/index.ts
```

The optional Fastify adapter supports local Node.js development; it is not needed
by the hosted Edge API. See [backend setup](docs/backend-setup.md).

This repository contains backend deployment source. The Expo mobile application
and its connection changes are maintained in the existing local FocusUp workspace.
Never commit actual environment files, API secrets or database passwords.
