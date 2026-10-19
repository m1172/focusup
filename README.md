# FocusUp backend

Production deployment source for the FocusUp API. Supabase hosts authentication
and PostgreSQL; the Node.js/Fastify API runs independently on Render.

## Deployment

Use `render.yaml` to create a Render Blueprint. Render supplies an HTTPS
`onrender.com` address, so a custom domain is optional. The prepared compute plan
is paid: review pricing before creating the service. Supply Supabase credentials
through Render environment secrets, never through committed `.env` files.

Authentication needs configured Google/Apple credentials or SMTP before public
signup can be enabled and tested. Deployment preparation alone does not make
this service production-ready.

See [production deployment](docs/production-deployment.md) and
[backend setup](docs/backend-setup.md) for the remaining requirements.

## Local API development

Use Node.js 22.13 or newer:

```sh
npm --prefix backend ci
cp backend/.env.example backend/.env
# Fill backend/.env with the current Supabase URL and API keys.
npm --prefix backend run dev
```

## Validation

```sh
npm --prefix backend run lint
npm --prefix backend run typecheck
npm --prefix backend test
npm --prefix backend run build
```

This repository currently contains the backend deployment source. The Expo
mobile application is maintained in the existing local FocusUp workspace.
